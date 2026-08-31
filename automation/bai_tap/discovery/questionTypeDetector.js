import { hasResourceId, detectImageChoiceGrid } from "../navigation/homeworkExamEngine.js";

/**
 * questionTypeDetector.js - PHASE 4 (2026-08-31), theo thiết kế PHASE 3B đã được duyệt.
 *
 * `detectQuestionType()` là bước TÁCH RIÊNG "màn hình hiện tại thuộc loại câu hỏi nào" khỏi việc
 * "nội dung có khớp CMS không" (2 việc trước đây gộp chung trong `decideAnswerAction()` - xem PHASE
 * 1/2 audit). Hàm này THUẦN/ĐỒNG BỘ/CHỈ ĐỌC - không gọi bridge, không tap/type/submit, không đổi
 * state - nhận `tree` (đã fetch sẵn) làm input.
 *
 * KHÔNG viết detector mới - mọi tín hiệu ở đây PORT NGUYÊN VĂN từ 2 nguồn đã verify trong PHASE 3A:
 *   - CONNECT/FILL_WORD/IMAGE_CHOICE_GRID/TEXT_CHOICE: tái sử dụng thẳng `hasResourceId()`/
 *     `detectImageChoiceGrid()` đã có trong homeworkExamEngine.js (pipeline tự động vốn đã dùng).
 *   - DRAG_DROP/SPEAK/SORT-hoặc-SENTENCE_BUILDER: PORT chuỗi/id từ lớp thủ công
 *     flows/app/helpers/answer-current-exercise-generic.yaml (dòng 64-66, 145-147, 178-181) - CHỈ
 *     mang tín hiệu detect (id/text), KHÔNG mang logic tap của các handler .yaml đó.
 *
 * PRECEDENCE CỐ ĐỊNH (PHASE 3B mục C - KHÔNG đổi thứ tự): CONNECT > FILL_WORD > DRAG_DROP >
 * IMAGE_CHOICE_GRID > SPEAK > SORT_OR_SENTENCE_BUILDER > TEXT_CHOICE > UNKNOWN. DRAG_DROP BẮT BUỘC
 * đứng TRƯỚC TEXT_CHOICE - đây chính là fix cho Conflict 1 đã audit (PHASE 3A §D.2): word-bank chip
 * text của DRAG_DROP tình cờ thoả điều kiện "≥2 answers[] hiển thị" của TEXT_CHOICE, khiến trước đây
 * 1 câu DRAG_DROP có thể bị phân loại NHẦM thành TEXT_CHOICE và trả lời sai (tap 1 lần cho câu có
 * nhiều ô trống). Chạy TẤT CẢ detector (không dừng sớm) để giữ đủ evidence cho
 * `matchedDetectors`/`detectorConflict` - CHỈ dùng precedence để chọn `questionType` cuối cùng.
 *
 * "SORT_OR_SENTENCE_BUILDER" CỐ Ý KHÔNG tách thành SORT hay SENTENCE_BUILDER riêng - PHASE 3A đã
 * xác nhận "Reorder the letters" là tín hiệu UI DUY NHẤT đang thực sự dùng cho cả 2 loại, không có
 * bằng chứng nào đã verify sống để phân biệt (id `exercise_sort_area`/`exercise_sentence_builder_area`
 * là ứng viên trên giấy, README tự ghi nhận CHƯA verify qua fixture SORT thật) - TYPE_AMBIGUOUS theo
 * đúng kết luận audit, không đoán 1 trong 2.
 *
 * MULTI (`exercise_answer_list_multi`) KHÔNG phải 1 nhánh precedence riêng - CHỦ Ý giữ nguyên hành vi
 * hiện tại (MULTI vẫn được coi là TEXT_CHOICE, xem PHASE 3B §9 "KHÔNG fix MULTI trong phase này") -
 * chỉ gắn thêm cờ `knownCorrectnessRisk` để không mất dấu vết bug `extractCorrectAnswer()` join nhiều
 * đáp án đúng thành 1 chuỗi (questionModel.js) đã ghi nhận ở PHASE 3A §E.
 */

// PORT nguyên văn từ flows/app/helpers/answer-current-exercise-generic.yaml - KHÔNG phải detector
// mới, chỉ mang tín hiệu id/text đã verify ở lớp thủ công sang đây (xem docblock đầu file).
const DRAG_DROP_ZONE_ID_PATTERN = /^exercise_dragdrop_zone_0$/; // yaml dòng 178-181
const CHOICE_OPTION_ID_PATTERN = /^exercise_answer_0$/; // yaml dòng 225-228 (CHOICE family: ONE/MULTI/TRUE_FALSE)
const MULTI_FRAME_ID_PATTERN = /^exercise_answer_list_multi$/; // README.md:48, goto-question-type.yaml
const SPEAK_TEXT_PATTERN = /Nhấn để nói/; // yaml dòng 64-66
const SORT_OR_SENTENCE_BUILDER_TEXT_PATTERN = /Reorder the letters/; // yaml dòng 145-147

/** true nếu bất kỳ dòng nào trong `texts` khớp `pattern` (test thô, không cần match nguyên dòng -
 * cùng tinh thần `.*(...).*` các selector Maestro trong yaml gốc). */
function anyTextMatches(texts, pattern) {
  return texts.some((t) => pattern.test(t));
}

/** Số đáp án CỦA BẤT KỲ candidate nào trong pool đang hiển thị nhiều nhất trên màn - dùng để quyết
 * định tín hiệu TEXT_CHOICE có nổ ra hay không (>=2), KHÔNG cần biết ĐÚNG candidate nào (đó là việc
 * của content matching, xem answerSetMatcher.js#diagnoseCurrentQuestion()). */
function maxVisibleAnswerCount(pool, texts) {
  const textSet = new Set(texts);
  let max = 0;
  for (const q of pool) {
    const hits = (q.answers ?? []).filter((a) => typeof a === "string" && textSet.has(a)).length;
    if (hits > max) max = hits;
  }
  return max;
}

/**
 * @param {Object} tree - bridge.hierarchy()
 * @param {string[]} texts - collectAllTexts(tree) ĐÃ TÍNH SẴN (không tính lại)
 * @param {import("../model/questionModel.js").QuestionModel[]} pool
 * @returns {{
 *   questionType: "CONNECT"|"FILL_WORD"|"DRAG_DROP"|"IMAGE_CHOICE_GRID"|"SPEAK"|
 *     "SORT_OR_SENTENCE_BUILDER"|"TEXT_CHOICE"|"UNKNOWN",
 *   typeConfidence: "HIGH"|"MEDIUM"|"LOW",
 *   typeEvidence: Array<{detector:string, matched:boolean, citation:string, detail:?string}>,
 *   matchedDetectors: string[],
 *   detectorConflict: boolean,
 *   answerable: boolean,
 *   knownCorrectnessRisk: ?string,
 *   gridBoxCount: ?number,
 * }}
 */
export function detectQuestionType(tree, texts, pool) {
  const gridBoxes = detectImageChoiceGrid(tree);

  const detectors = [
    {
      type: "CONNECT",
      confidence: "HIGH",
      answerable: true,
      citation: "hasResourceId(/^exercise_connect_left_0$/) - homeworkExamEngine.js",
      ok: hasResourceId(tree, /^exercise_connect_left_0$/),
    },
    {
      type: "FILL_WORD",
      confidence: "HIGH",
      answerable: true,
      citation: "hasResourceId(/^exercise_fillword_blank_0$/) - homeworkExamEngine.js",
      ok: hasResourceId(tree, /^exercise_fillword_blank_0$/),
    },
    {
      type: "DRAG_DROP",
      confidence: "HIGH",
      answerable: false,
      citation: "hasResourceId(/^exercise_dragdrop_zone_0$/) - ported from flows/app/helpers/answer-current-exercise-generic.yaml:178-181",
      ok: hasResourceId(tree, DRAG_DROP_ZONE_ID_PATTERN),
    },
    {
      type: "IMAGE_CHOICE_GRID",
      confidence: "HIGH",
      answerable: true,
      citation: "detectImageChoiceGrid() - homeworkExamEngine.js",
      ok: gridBoxes !== null,
      detail: gridBoxes ? `${gridBoxes.length} box` : null,
    },
    {
      type: "SPEAK",
      confidence: "MEDIUM",
      answerable: false,
      citation: 'text /Nhấn để nói/ - ported from answer-current-exercise-generic.yaml:64-66',
      ok: anyTextMatches(texts, SPEAK_TEXT_PATTERN),
    },
    {
      type: "SORT_OR_SENTENCE_BUILDER",
      confidence: "LOW",
      answerable: false,
      citation: 'text /Reorder the letters/ - ambiguous by design, xem PHASE 3A §D.1/§F (SORT vs SENTENCE_BUILDER không phân biệt được)',
      ok: anyTextMatches(texts, SORT_OR_SENTENCE_BUILDER_TEXT_PATTERN),
    },
    {
      type: "TEXT_CHOICE",
      confidence: "LOW",
      answerable: true,
      // 2 tín hiệu OR: (a) id CẤU TRÚC độc lập với pool (exercise_answer_0, PORT từ
      // answer-current-exercise-generic.yaml:225-228 - lớp thủ công) - QUAN TRỌNG: đây là tín hiệu
      // DUY NHẤT không phụ thuộc nội dung pool, cho phép detect "đây là màn TEXT_CHOICE" ngay cả khi
      // KHÔNG có đáp án nào của pool trùng khớp (đúng mục tiêu tách DETECTION khỏi CONTENT MATCHING -
      // nếu chỉ dùng (b) sẽ lặp lại đúng lỗi cũ: 1 màn TEXT_CHOICE thật nhưng pool sai hoàn toàn sẽ
      // KHÔNG được nhận diện là TEXT_CHOICE, rơi vào UNKNOWN thay vì CONTENT_MISMATCH); (b)
      // questionModel.answers[] >=2 khớp text hiển thị (bản cũ, giữ lại làm dự phòng nếu id (a) vắng
      // mặt trên build - tín hiệu YẾU NHẤT trong 2, đặt cuối precedence có chủ đích, xem Conflict 1).
      citation: "hasResourceId(/^exercise_answer_0$/) [structural, ported từ yaml:225-228] OR questionModel.answers[] >=2 khớp text hiển thị [pool-dependent, dự phòng]",
      ok: hasResourceId(tree, CHOICE_OPTION_ID_PATTERN) || maxVisibleAnswerCount(pool, texts) >= 2,
    },
  ];

  const typeEvidence = detectors.map((d) => ({ detector: d.type, matched: d.ok, citation: d.citation, detail: d.detail ?? null }));
  const matchedDetectors = detectors.filter((d) => d.ok).map((d) => d.type);
  const winner = detectors.find((d) => d.ok);

  // MULTI: tín hiệu PHỤ, KHÔNG tham gia precedence (xem docblock đầu file) - chỉ gắn cờ risk.
  const hasMultiSignal = hasResourceId(tree, MULTI_FRAME_ID_PATTERN);
  typeEvidence.push({
    detector: "MULTI_SIGNAL",
    matched: hasMultiSignal,
    citation: "hasResourceId(/^exercise_answer_list_multi$/) - README.md:48, KHÔNG đổi questionType (xem PHASE 3B §9)",
    detail: null,
  });

  return {
    questionType: winner ? winner.type : "UNKNOWN",
    typeConfidence: winner ? winner.confidence : "LOW",
    typeEvidence,
    matchedDetectors,
    detectorConflict: matchedDetectors.length > 1,
    answerable: winner ? winner.answerable : false,
    knownCorrectnessRisk: hasMultiSignal ? "MULTI_JOIN_BUG" : null,
    gridBoxCount: gridBoxes ? gridBoxes.length : null,
  };
}
