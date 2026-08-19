/**
 * @typedef {Object} QuestionModel
 * @property {string} id
 * @property {string} type              - dạng bài thô từ CMS (vd "ONE", "TRUE_FALSE", "DRAG_DROP", "SPEAK"...)
 * @property {string} question          - nội dung câu hỏi dạng text đọc được (đã strip HTML)
 * @property {string[]} answers         - danh sách nội dung các đáp án dạng text (đã strip HTML)
 * @property {?string} correctAnswer    - đáp án đúng dạng text (nhiều đáp án đúng thì nối bằng ", "),
 *                                        null nếu dạng bài không có đáp án đúng rời rạc (vd SPEAK)
 * @property {Object} metadata          - dữ liệu phụ giữ lại để debug/mở rộng (vd viết handler mới)
 * @property {string} metadata.title
 * @property {number} metadata.point
 * @property {number} metadata.index
 * @property {Object} metadata.raw      - question/answers/correct NGUYÊN VĂN từ CMS (chưa strip HTML,
 *                                        chưa diễn giải shape) - handler dạng bài phức tạp (Drag&Drop,
 *                                        Sentence Builder...) cần dữ liệu gốc thay vì bản đã dồn thành text.
 *
 * Đây là hợp đồng (contract) DUY NHẤT giữa Discovery và Bridge/Maestro - handler trong
 * automation/bridge/ chỉ được đọc field ở tầng này, không bao giờ đọc thẳng shape thô của
 * window.__NUXT__ (đã đóng gói toàn bộ trong discovery/examPageScraper.js).
 */

function stripHtml(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/**
 * "question" thô quan sát được có 2 dạng:
 *   - { title, content: "<p>...</p>", ... }              (ONE/TRUE_FALSE)
 *   - { title, content: ["", " harvester"], image, ... }  (DRAG_DROP - các đoạn quanh chỗ trống)
 * Chuẩn hoá về 1 chuỗi text đọc được, nối các đoạn quanh chỗ trống bằng "___" cho dễ hiểu.
 */
function extractQuestionText(rawQuestion) {
  const content = rawQuestion.question?.content;
  if (Array.isArray(content)) {
    const joined = content.map(stripHtml).join(" ___ ").trim();
    if (joined.replace(/_/g, "").trim()) return joined;
  } else if (typeof content === "string" && stripHtml(content)) {
    return stripHtml(content);
  }
  return stripHtml(rawQuestion.question?.title) || "";
}

/**
 * "answers" thô quan sát được có 2 dạng:
 *   - mảng object [{ id, content: "<p>...</p>" }, ...]   (ONE/TRUE_FALSE)
 *   - mảng string thuần ["combine", "decline", ...]       (DRAG_DROP - word bank)
 */
function extractAnswers(rawQuestion) {
  const answers = rawQuestion.answers ?? [];
  if (answers.length === 0) return [];
  if (typeof answers[0] === "string") {
    return answers.map(stripHtml);
  }
  return answers.map((a) => stripHtml(a.content));
}

/**
 * "correct" thô quan sát được có nhiều dạng:
 *   - 1 id string khớp với answers[].id                   (ONE/TRUE_FALSE)
 *   - mảng string thuần khớp trực tiếp giá trị answers      (DRAG_DROP, có thể nhiều hơn 1 chỗ trống)
 *   - object map {idAnswer -> idAnswer}                     (CONNECT - ghép cặp 2 group, xem
 *     runtime/handlers/matchingHandler.js; ĐÃ XÁC NHẬN THẬT 2026-08-14 qua
 *     teacherMaterialsExamResolver.js, đối chiếu với trang "Báo cáo lớp" thật)
 * null/undefined nếu dạng bài không có đáp án đúng rời rạc (vd SPEAK).
 */
function extractCorrectAnswer(rawQuestion) {
  const correct = rawQuestion.correct;
  const answers = rawQuestion.answers ?? [];
  const answersAreObjects = answers.length > 0 && typeof answers[0] === "object";

  // "" (SPEAK) và [] đều nghĩa là "không có đáp án đúng rời rạc" - coi như null luôn, không
  // chỉ null/undefined mới trả về null.
  if (correct === null || correct === undefined || correct === "") return null;
  if (Array.isArray(correct) && correct.length === 0) return null;

  const resolveOne = (value) => {
    if (answersAreObjects) {
      const match = answers.find((a) => a.id === value);
      return match ? stripHtml(match.content) : null;
    }
    return stripHtml(value) || null;
  };

  if (Array.isArray(correct)) {
    const resolved = correct.map(resolveOne).filter((v) => v !== null && v !== "");
    return resolved.length > 0 ? resolved.join(", ") : null;
  }
  if (typeof correct === "object") {
    if (!answersAreObjects) return null;
    const pairs = Object.entries(correct)
      .map(([leftId, rightId]) => {
        const left = resolveOne(leftId);
        const right = resolveOne(rightId);
        return left && right ? `${left} ↔ ${right}` : null;
      })
      .filter(Boolean);
    return pairs.length > 0 ? pairs.join(", ") : null;
  }
  return resolveOne(correct);
}

/**
 * Chuẩn hoá 1 câu hỏi thô (từ examPageScraper.js#parseQuestionsFromExamPage) thành
 * QuestionModel. Đây là điểm DUY NHẤT diễn giải shape thô của CMS - nếu CMS đổi field hoặc
 * xuất hiện dạng bài mới có shape khác, chỉ cần sửa các hàm extract* ở trên, không phải sửa
 * examPageScraper.js hay bất kỳ handler nào trong automation/bridge/.
 *
 * @param {Object} rawQuestion - 1 phần tử trong examData.questions (raw, xem examPageScraper.js)
 * @returns {QuestionModel}
 */
export function normalizeQuestion(rawQuestion) {
  return {
    id: rawQuestion.id,
    type: rawQuestion.type,
    question: extractQuestionText(rawQuestion),
    answers: extractAnswers(rawQuestion),
    correctAnswer: extractCorrectAnswer(rawQuestion),
    metadata: {
      title: stripHtml(rawQuestion.question?.title),
      point: rawQuestion.point,
      index: rawQuestion.index,
      raw: {
        question: rawQuestion.question,
        answers: rawQuestion.answers,
        correct: rawQuestion.correct,
      },
    },
  };
}

/**
 * SỬA (2026-08-19, root cause thật xác nhận qua parseQuestionsFromExamPage() trực tiếp trên 2 exam
 * thật - examId bb025c39-c0a5-4bc7-b0ad-1570577c8c2a "Read and tick True or False" N=6: item ĐẦU
 * TIÊN có type="GROUP", answers=[], correct="" - đây KHÔNG PHẢI 1 câu hỏi thật, chỉ là node tiêu đề/
 * đoạn văn của cả nhóm (group_label = đúng title bài, group_order=1), 5 item CÒN LẠI mới là câu
 * "ONE" thật (mỗi câu 3 đáp án + correct hợp lệ). Trước đây normalizeQuestions() coi node GROUP này
 * như 1 QuestionModel thật -> answers=[]/correctAnswer=null CỐ ĐỊNH -> MỌI exam có đoạn văn dẫn đề
 * (phần lớn bài đọc hiểu/true-false của toàn bộ curriculum) bị loại OAN ở bước kiểm tra correctness
 * (dù các câu ONE thật bên trong hoàn toàn tự động hoá được) - lộ rõ qua pre-scan
 * flows/giao_bai_tap/e2e-teacher-assign-partial-resume-scored-pro.mjs ngày 2026-08-19 (33/33
 * candidate fresh của lớp 3B đều BLOCKED, đa số vì "NO_CORRECT_ANSWER_DEFINED" ngay ở item đầu).
 * Lọc bỏ node "GROUP" (không phải câu hỏi thật) TRƯỚC khi chuẩn hoá - áp dụng cho MỌI caller của
 * normalizeQuestions() (candidate feasibility check LẪN nguồn QUESTIONS dùng để trả lời thật qua
 * teacherMaterialsExamResolver.js#resolveHomeworkExamQuestionsForRoomId(), cùng dùng chung hàm này).
 * @param {Object} examData - trả về từ examPageScraper.js#parseQuestionsFromExamPage
 * @returns {QuestionModel[]}
 */
export function normalizeQuestions(examData) {
  return (examData.questions ?? []).filter((q) => q.type !== "GROUP").map(normalizeQuestion);
}
