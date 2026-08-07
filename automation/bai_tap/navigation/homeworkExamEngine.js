/**
 * HomeworkExamEngine - điều hướng màn "Doing" (đang làm 1 lượt Exam thật của Bài tập) + màn
 * "Kết thúc" (Kết quả) - 2 màn CỐ TÌNH CHƯA có trong `homeworkPageObjects.js`/
 * `homeworkNavigationEngine.js` (xem comment đầu 2 file đó: ranh giới "Start Homework/Open Exam"
 * trước đây chưa implement). Tách riêng file này, KHÔNG sửa 2 file trên, để giữ nguyên ranh giới đã
 * document trong đó (`startHomework()` vẫn cố tình throw `PendingExamLaunchError` cho luồng cũ) -
 * engine này chỉ dùng cho testcase random-E2E mới, tự tap CTA để mở bài (đã xác nhận qua thao tác
 * thật, xem automation/README.md mục "Đã LÀM THẬT 1 Homework tới hết", điểm 1: mở bài KHÔNG cần
 * endpoint riêng, chỉ là điều hướng UI thuần).
 *
 * QUY TẮC UI "Bài tập KHÁC Vui học" (đã xác nhận lại rõ, KHÔNG suy đoán): Bài tập KHÔNG hiển thị
 * chỉ báo đúng/sai ngay sau từng câu (không có "Kiểm tra"/"Chính xác"/"Chưa chính xác" như Vui
 * học) - chỉ có 1 màn Kết thúc DUY NHẤT sau khi trả lời hết toàn bộ câu. Vì vậy `answerCurrentQuestion()`
 * KHÔNG BAO GIỜ đọc/chờ chỉ báo đúng/sai - chỉ chọn 1 đáp án rồi bấm CTA để qua câu kế tiếp.
 *
 * NGUỒN "đáp án đúng" (để random đúng/sai theo tỉ lệ mong muốn + verify điểm sau Submit): tái sử
 * dụng NGUYÊN VẸN pipeline Exam/CMS đã có (`discovery/examPageScraper.js` + `model/questionModel.js`
 * - đọc thẳng `window.__NUXT__.data` của trang Exam Editor thật qua Playwright, KHÔNG gọi API mới/
 * không suy đoán endpoint) qua `discovery/homeworkExamResolver.js` (resolve examId của 1 Homework
 * cụ thể bằng `attempts[].examId`, nguồn DUY NHẤT đáng tin cậy đã xác nhận - xem file đó). Khi
 * KHÔNG resolve được (Room chưa có ai làm -> examId UNRESOLVED, hoặc session Exam Scraper hết hạn),
 * engine vẫn trả lời HỢP LỆ (tap 1 đáp án thật) nhưng KHÔNG kiểm soát đúng/sai - gọi
 * `answerCurrentQuestion(null)` (không truyền QuestionModel).
 *
 * PHẠM VI Question Type ĐƯỢC HỖ TRỢ (KHÔNG suy đoán/không tự tạo selector cho dạng bài chưa từng
 * xác nhận trên chính màn Doing của Bài tập):
 *   1. "TEXT_CHOICE" - answers[] (từ QuestionModel) có chữ THẬT trùng khớp text đang hiển thị
 *      trên màn hình (>= 2 lựa chọn khớp được) -> tapOn theo TEXT giống Vui học (đã xác nhận ổn
 *      định) - áp dụng được cho MỌI Question Type có đáp án dạng chữ (ONE/TRUE_FALSE...), không
 *      cần biết trước type cụ thể.
 *   2. "IMAGE_CHOICE_GRID" - answers[] không có chữ nào hiển thị được (đáp án là ảnH) NHƯNG khớp
 *      fingerprint lưới 2x2 đã xác nhận qua README (điểm 4: ĐÚNG 4 phần tử `clickable="true"`,
 *      không chữ, xếp 2x2, không có phần tử clickable nào khác có chữ trên màn) VÀ
 *      `questionModel.answers.length === 4` (khớp số box) -> map theo ĐÚNG thứ tự answers[] (đã
 *      xác nhận qua README: answers[0..3] -> A/B/C/D theo thứ tự đọc lưới trên-trái/trên-phải/
 *      dưới-trái/dưới-phải).
 * Mọi trường hợp khác (không có QuestionModel VÀ không khớp lưới 2x2; hoặc có QuestionModel nhưng
 * không khớp CẢ 2 chiến lược trên - vd matching/audio, sentence builder, fill blank, số đáp án
 * không khớp...) trả về `{ supported: false }` - CHỦ ĐÍCH để Runtime dừng lại và báo FAIL trung
 * thực theo đúng tiêu chí đề bài ("Handler không hỗ trợ Question Type" là 1 lý do FAIL hợp lệ).
 */

const AI_POPUP_TRIGGER = "AI hỗ trợ học tập";
const AI_POPUP_ACTION = "Tiếp tục";
// Chưa xác nhận chữ CTA thật ở câu CUỐI (README không nói tới nút "Nộp bài" riêng - mô tả "làm hết
// N câu rồi mới có 1 màn Kết thúc", gợi ý CTA cuối có thể vẫn là 1 trong các chữ dưới, tự đổi tuỳ
// UI) - dò LẦN LƯỢT các chữ đã biết trong app (đã xác nhận dùng nơi khác), KHÔNG đoán chữ mới.
const NEXT_OR_SUBMIT_CTA_CANDIDATES = ["Tiếp theo", "Nộp bài", "Hoàn thành"];
// Nhãn nút xác nhận phổ biến của app - dùng best-effort cho popup xác nhận nộp bài NẾU xuất hiện,
// không throw nếu không thấy (chưa xác nhận popup này có tồn tại thật hay không).
const CONFIRM_SUBMIT_BUTTON_CANDIDATES = ["Nộp bài", "Đồng ý", "Xác nhận"];

const RESULT_SCORE_LABEL = "ĐIỂM SỐ";
const RESULT_CORRECT_LABEL = "CHÍNH XÁC";

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectTexts(c, acc);
  return acc;
}

function flattenNodes(node, acc) {
  acc.push(node);
  for (const child of node?.children ?? []) flattenNodes(child, acc);
  return acc;
}

function nodeHasNonEmptyTextDeep(node) {
  const text = node?.attributes?.text;
  if (typeof text === "string" && text.trim()) return true;
  return (node?.children ?? []).some(nodeHasNonEmptyTextDeep);
}

function parseBounds(boundsStr) {
  const m = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(boundsStr || "");
  if (!m) return null;
  const [, x1, y1, x2, y2] = m.map(Number);
  return { x1, y1, x2, y2, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
}

/**
 * Nhận diện lưới 2x2 - xem fingerprint mô tả đầu file. Trả về null nếu không khớp (KHÔNG throw -
 * để caller tự thử fingerprint khác/kết luận unsupported).
 * @param {Object} tree - `bridge.hierarchy()`
 * @returns {Array<{x1:number,y1:number,x2:number,y2:number,cx:number,cy:number}> | null}
 */
function detectImageChoiceGrid(tree) {
  const all = flattenNodes(tree, []);
  const clickableWithText = all.filter(
    (n) => n?.attributes?.clickable === "true" && nodeHasNonEmptyTextDeep(n),
  );
  if (clickableWithText.length > 0) return null; // có nút/label chữ khác -> không phải dạng này

  const blankLeafClickables = all.filter(
    (n) => n?.attributes?.clickable === "true" && !nodeHasNonEmptyTextDeep(n),
  );
  const boxes = blankLeafClickables.map((n) => parseBounds(n.attributes.bounds)).filter(Boolean);
  if (boxes.length !== 4) return null;

  const xs = [...new Set(boxes.map((b) => Math.round(b.cx / 20)))];
  const ys = [...new Set(boxes.map((b) => Math.round(b.cy / 20)))];
  const clusterCount = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    let groups = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] > 5) groups++;
    }
    return groups;
  };
  if (clusterCount(xs) !== 2 || clusterCount(ys) !== 2) return null;

  return boxes;
}

/**
 * Quyết định chiến lược trả lời cho câu hiện tại - KHÔNG tap gì cả, chỉ nhận diện + chọn mục tiêu
 * (tách riêng khỏi việc tap để dễ test logic mà không cần thiết bị).
 * @param {Object} tree - `bridge.hierarchy()`
 * @param {(text: string) => boolean} isVisible - `bridge.isVisible` (nhận vào để dễ test)
 * @param {import("../../model/questionModel.js").QuestionModel | null} questionModel
 * @param {boolean} wantCorrect
 * @returns {{ type: "TEXT_CHOICE", text: string, isTargetCorrect: boolean|null }
 *         | { type: "IMAGE_CHOICE_GRID", point: string, isTargetCorrect: boolean|null }
 *         | null}
 */
export function decideAnswerAction(tree, isVisible, questionModel, wantCorrect) {
  if (questionModel?.answers?.length >= 2) {
    const visibleAnswers = questionModel.answers.filter((a) => a && isVisible(escapeRegExp(a)));
    if (visibleAnswers.length >= 2) {
      const correct = questionModel.correctAnswer;
      const correctIsVisible = correct && visibleAnswers.includes(correct);
      const target =
        wantCorrect && correctIsVisible ? correct : visibleAnswers.find((a) => a !== correct) ?? visibleAnswers[0];
      return { type: "TEXT_CHOICE", text: target, isTargetCorrect: correct ? target === correct : null };
    }
  }

  const grid = detectImageChoiceGrid(tree);
  if (!grid) return null;

  if (questionModel?.answers?.length === grid.length) {
    const correctIdx = questionModel.correctAnswer ? questionModel.answers.indexOf(questionModel.correctAnswer) : -1;
    let idx;
    if (wantCorrect && correctIdx >= 0) idx = correctIdx;
    else if (correctIdx >= 0) idx = [...grid.keys()].find((i) => i !== correctIdx) ?? 0;
    else idx = Math.floor(Math.random() * grid.length);
    const box = grid[idx];
    return {
      type: "IMAGE_CHOICE_GRID",
      point: `${Math.round(box.cx)},${Math.round(box.cy)}`,
      isTargetCorrect: correctIdx >= 0 ? idx === correctIdx : null,
    };
  }

  if (!questionModel) {
    // Không có QuestionModel (examId chưa resolve được) - vẫn trả lời HỢP LỆ (1 box thật có tồn
    // tại trên UI), KHÔNG kiểm soát đúng/sai vì không có dữ liệu để biết đáp án nào đúng.
    const box = grid[Math.floor(Math.random() * grid.length)];
    return { type: "IMAGE_CHOICE_GRID", point: `${Math.round(box.cx)},${Math.round(box.cy)}`, isTargetCorrect: null };
  }

  return null; // có QuestionModel nhưng số đáp án không khớp lưới - không suy đoán tiếp, unsupported.
}

export class HomeworkExamEngine {
  /** @param {import("../../bridge/maestroBridge.js").MaestroBridge} bridge */
  constructor(bridge) {
    this.bridge = bridge;
  }

  /** Dismiss popup "AI hỗ trợ học tập" nếu xuất hiện ngay sau khi mở bài - best-effort. */
  async dismissAiPopupIfPresent() {
    await this.bridge.runSteps([
      {
        runFlow: {
          when: { visible: AI_POPUP_TRIGGER },
          commands: [{ tapOn: AI_POPUP_ACTION }],
        },
      },
    ]);
  }

  /**
   * Xác nhận đã vào ĐÚNG bài (identity) - tiêu đề Homework hiện lại trên màn Doing, và 2 dấu hiệu
   * phủ định xác nhận đã rời màn List (không còn thấy bottom tab bar - cùng cơ chế đã dùng trong
   * `runRandomOpenHomeworkFlow.js`).
   * @param {string} title
   */
  async verifyIdentity(title) {
    const result = await this.bridge.runSteps([
      { extendedWaitUntil: { visible: { text: title }, timeout: 10000 } },
      { assertNotVisible: { text: "Trò chuyện" } },
      { assertNotVisible: { text: "Bài tập về nhà" } },
    ]);
    if (!result.success) {
      throw new Error(`Identity mismatch - không xác nhận được đúng màn Doing của "${title}": ${result.error}`);
    }
  }

  isResultScreen() {
    return this.bridge.isVisible(`${RESULT_SCORE_LABEL}.*`) || this.bridge.isVisible(`${RESULT_CORRECT_LABEL}.*`);
  }

  /**
   * Chọn 1 đáp án cho câu hiện tại rồi bấm CTA để qua câu tiếp theo (hoặc nộp bài nếu là câu
   * cuối), rồi xác nhận màn hình ĐÃ ĐỔI - KHÔNG đọc/chờ bất kỳ chỉ báo đúng/sai nào (xem quy tắc
   * UI ở đầu file).
   * @param {import("../../model/questionModel.js").QuestionModel | null} questionModel - truyền
   *   `null` nếu chưa resolve được Exam (đáp án đúng UNRESOLVED) - engine sẽ trả lời hợp lệ nhưng
   *   không kiểm soát đúng/sai.
   * @param {{ wantCorrect?: boolean }} [options] - `wantCorrect` chỉ có ý nghĩa khi có
   *   `questionModel` với `correctAnswer` đã biết.
   * @returns {Promise<
   *     { supported: true, type: "TEXT_CHOICE"|"IMAGE_CHOICE_GRID", isTargetCorrect: boolean|null }
   *   | { supported: false, reason: string, texts: string[] }>}
   */
  async answerCurrentQuestion(questionModel = null, { wantCorrect = true } = {}) {
    const tree = this.bridge.hierarchy();
    const textsBefore = collectTexts(tree);
    const isVisible = (t) => this.bridge.isVisible(t);

    const action = decideAnswerAction(tree, isVisible, questionModel, wantCorrect);
    if (!action) {
      return {
        supported: false,
        reason: "Không khớp chiến lược trả lời nào có Handler hỗ trợ (TEXT_CHOICE / IMAGE_CHOICE_GRID 2x2)",
        texts: textsBefore,
      };
    }

    const tapStep = action.type === "TEXT_CHOICE" ? { tapOn: action.text } : { tapOn: { point: action.point } };
    // Gộp tap + chờ hoạt ảnh + screenshot "trước Submit" vào ĐÚNG 1 lượt `maestro test` (yêu cầu
    // hiệu năng của đề bài) - screenshot bị ĐÈ mỗi câu (cùng tên cố định), nên khi loop dừng lại
    // (chạm màn Kết thúc), file còn lại đúng là trạng thái ngay TRƯỚC lần bấm nộp bài/qua câu CUỐI
    // CÙNG - không cần biết trước câu nào là câu cuối.
    const tapResult = await this.bridge.runSteps([
      tapStep,
      { waitForAnimationToEnd: { timeout: 1500 } },
      { takeScreenshot: "before_submit" },
    ]);
    if (!tapResult.success) {
      throw new Error(`UI không nhận câu trả lời (${JSON.stringify(tapStep)} thất bại): ${tapResult.error}`);
    }

    let advanced = false;
    for (const cta of NEXT_OR_SUBMIT_CTA_CANDIDATES) {
      if (this.bridge.isVisible(cta)) {
        const nextResult = await this.bridge.tap(cta);
        if (!nextResult.success) {
          throw new Error(`Không chuyển được câu (tapOn "${cta}" thất bại): ${nextResult.error}`);
        }
        advanced = true;
        break;
      }
    }
    if (!advanced) {
      throw new Error(
        `Không tìm thấy nút chuyển câu/nộp bài sau khi chọn đáp án (đã thử: ${NEXT_OR_SUBMIT_CTA_CANDIDATES.join(", ")}).`,
      );
    }

    await this.bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1500 } }]);
    // Popup xác nhận nộp bài - best-effort, KHÔNG throw nếu không thấy (chưa xác nhận có tồn tại).
    for (const label of CONFIRM_SUBMIT_BUTTON_CANDIDATES) {
      if (this.bridge.isVisible(label)) {
        await this.bridge.tap(label);
        await this.bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1000 } }]);
        break;
      }
    }

    // Xác nhận ĐÃ chuyển sang câu tiếp theo (hoặc màn Kết thúc) - so khớp toàn bộ text hiển thị
    // TRƯỚC/SAU khi bấm CTA, KHÔNG đọc bất kỳ chỉ báo đúng/sai nào. Nếu màn hình không đổi, coi là
    // "Không chuyển được câu" (FAIL thật, không phải lỗi ẩn).
    if (!this.isResultScreen()) {
      const textsAfter = collectTexts(this.bridge.hierarchy());
      if (JSON.stringify(textsAfter) === JSON.stringify(textsBefore)) {
        throw new Error("Không chuyển được câu tiếp theo - màn hình không đổi sau khi bấm CTA.");
      }
    }

    return { supported: true, type: action.type, isTargetCorrect: action.isTargetCorrect };
  }

  /**
   * Biến thể GỘP của answerCurrentQuestion() - CÙNG thuật toán quyết định đáp án
   * (decideAnswerAction, KHÔNG đổi) và CÙNG contract trả về, chỉ khác cách gọi MaestroBridge: dồn
   * toàn bộ native step của 1 câu (tap đáp án, chờ hoạt ảnh, chụp "before_submit", tap CTA, chờ,
   * tap confirm-nếu-có, chờ) vào ĐÚNG 1 mảng `runSteps()` = ĐÚNG 1 lượt `maestro test`/câu, thay
   * vì 3 lượt riêng của bản gốc (tap đáp án -> tap CTA -> tap confirm, MỖI lượt tự spawn 1 tiến
   * trình `maestro test` riêng).
   *
   * LÝ DO (đo thật, xem flows/bai_tap/testcases/homework-review-explanation.yaml mục "TRẠNG THÁI"
   * 2026-08-07): mỗi lượt `maestro test` tốn ~30-50s CHỈ để khởi động session (thiết bị
   * 3201d866d40a1681, trung bình 32.9s/lượt trên 8 lượt đo được) - hoàn toàn KHÔNG liên quan tới
   * số bước bên trong 1 lượt. Gộp 3 lượt/câu thành 1 lượt/câu giữ ĐÚNG hành vi, chỉ đổi kiến trúc
   * gọi Bridge.
   *
   * CÁCH CHỌN CTA/nút xác nhận: dùng `tapOn: { optional: true }` cho TỪNG candidate theo ĐÚNG thứ
   * tự của NEXT_OR_SUBMIT_CTA_CANDIDATES/CONFIRM_SUBMIT_BUTTON_CANDIDATES (KHÔNG đổi danh sách) -
   * Maestro tự bỏ qua candidate không thấy, tap đúng candidate đang hiển thị. KHÁC 1 điểm nhỏ so
   * với bản gốc (đã cân nhắc, chấp nhận được): bản gốc dừng NGAY ở candidate đầu tiên thấy được
   * (`break`); bản này vẫn tiếp tục thử các candidate còn lại dưới dạng `optional` (không gây hại
   * trong THỰC TẾ vì tại 1 thời điểm CHỈ 1 candidate hiển thị - các candidate còn lại tự no-op vì
   * không tìm thấy phần tử).
   *
   * @param {import("../../model/questionModel.js").QuestionModel | null} questionModel
   * @param {{ wantCorrect?: boolean, resultLabel?: string|null }} [options] - `resultLabel`: nếu
   *   đây là câu CUỐI (biết trước qua tổng số câu đã resolve), truyền tên screenshot màn Kết thúc
   *   để GỘP LUÔN vào lượt `runSteps()` này - tránh phải tốn thêm 1 lượt `maestro test` riêng chỉ
   *   để chụp màn Kết thúc ở phase RESULT.
   * @returns {Promise<
   *     { supported: true, type: "TEXT_CHOICE"|"IMAGE_CHOICE_GRID", isTargetCorrect: boolean|null }
   *   | { supported: false, reason: string, texts: string[] }>}
   */
  async answerCurrentQuestionOneShot(questionModel = null, { wantCorrect = true, resultLabel = null } = {}) {
    const tree = this.bridge.hierarchy();
    const textsBefore = collectTexts(tree);
    const isVisible = (t) => this.bridge.isVisible(t);

    const action = decideAnswerAction(tree, isVisible, questionModel, wantCorrect);
    if (!action) {
      return {
        supported: false,
        reason: "Không khớp chiến lược trả lời nào có Handler hỗ trợ (TEXT_CHOICE / IMAGE_CHOICE_GRID 2x2)",
        texts: textsBefore,
      };
    }

    const tapStep = action.type === "TEXT_CHOICE" ? { tapOn: action.text } : { tapOn: { point: action.point } };
    const steps = [
      tapStep,
      { waitForAnimationToEnd: { timeout: 1500 } },
      { takeScreenshot: "before_submit" },
      ...NEXT_OR_SUBMIT_CTA_CANDIDATES.map((cta) => ({ tapOn: { text: cta, optional: true } })),
      { waitForAnimationToEnd: { timeout: 1500 } },
      ...CONFIRM_SUBMIT_BUTTON_CANDIDATES.map((label) => ({ tapOn: { text: label, optional: true } })),
      { waitForAnimationToEnd: { timeout: 1000 } },
    ];
    if (resultLabel) steps.push({ takeScreenshot: resultLabel });

    const stepsResult = await this.bridge.runSteps(steps);
    if (!stepsResult.success) {
      throw new Error(
        `UI không nhận được chuỗi hành động cho câu hỏi (${JSON.stringify(tapStep)} thất bại): ${stepsResult.error}`,
      );
    }

    // Xác nhận ĐÃ chuyển sang câu tiếp theo (hoặc màn Kết thúc) - CÙNG cách so khớp text
    // trước/sau như bản gốc, đọc qua `bridge.hierarchy()` (KHÔNG spawn thêm `maestro test`).
    if (!this.isResultScreen()) {
      const textsAfter = collectTexts(this.bridge.hierarchy());
      if (JSON.stringify(textsAfter) === JSON.stringify(textsBefore)) {
        throw new Error("Không chuyển được câu tiếp theo - màn hình không đổi sau khi bấm CTA.");
      }
    }

    return { supported: true, type: action.type, isTargetCorrect: action.isTargetCorrect };
  }

  /**
   * Đọc điểm/kết quả thật trên màn Kết thúc - KHÔNG suy đoán vị trí cụ thể, chỉ lấy dòng text ĐI
   * NGAY SAU nhãn ("ĐIỂM SỐ" -> giá trị điểm, "CHÍNH XÁC" -> "X/Y").
   * @returns {{ score: string|null, correct: string|null, correctCount: number|null, totalCount: number|null }}
   */
  readResult() {
    const texts = collectTexts(this.bridge.hierarchy());
    const scoreIdx = texts.findIndex((t) => t.startsWith(RESULT_SCORE_LABEL));
    const correctIdx = texts.findIndex((t) => t.startsWith(RESULT_CORRECT_LABEL));
    const score = scoreIdx >= 0 ? texts[scoreIdx + 1] ?? null : null;
    const correct = correctIdx >= 0 ? texts[correctIdx + 1] ?? null : null;
    const m = /^(\d+)\s*\/\s*(\d+)$/.exec(correct || "");
    return {
      score,
      correct,
      correctCount: m ? Number(m[1]) : null,
      totalCount: m ? Number(m[2]) : null,
    };
  }
}
