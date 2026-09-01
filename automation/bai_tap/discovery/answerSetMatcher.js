/**
 * Answer-set + question-content matcher (SHARED, single source of truth).
 *
 * ===================== ROOT CAUSE (2026-08-28) =====================
 * `findMatchingQuestion()` tồn tại độc lập, copy-paste, trong 9 file khác nhau trong repo (grep
 * `function findMatchingQuestion` để xác nhận danh sách hiện tại). Bản "đã vá" (full answer-set
 * match, port từ `pro_lamlai_target_score.mjs` ngày 2026-08-25 - xem
 * project_teacher_materials_examid_order_mismatch.md) chỉ yêu cầu answer-set của 1 candidate KHỚP
 * ĐỦ với tập đáp án đang hiển thị trên màn hình - đây là điều kiện CẦN nhưng KHÔNG ĐỦ khi 1 exercise
 * có NHIỀU câu hỏi khác nhau dùng chung 1 bộ đáp án ("word-bank" style - vd 4 câu điền từ vào chỗ
 * trống cùng dùng 4 từ "cycling/flying a kite/playing badminton/playing volleyball", đã xác nhận
 * live 2 lần độc lập, xem project_teacher_materials_examid_order_mismatch.md) - answer-set không đủ
 * để biết ĐÚNG câu nào trong 4 câu đó đang hiển thị, nên bản vá cũ chỉ có thể trả AMBIGUOUS và dừng
 * (an toàn, nhưng chặn cả những case đáng lẽ PHÂN BIỆT ĐƯỢC nếu so thêm nội dung câu hỏi).
 *
 * FIX: khi có >1 candidate cùng khớp đủ answer-set, so thêm NỘI DUNG câu hỏi/đoạn văn dẫn đề
 * (`question.question` - đã strip HTML qua `questionModel.js`, gồm cả passage nếu câu hỏi loại
 * DRAG_DROP/fill-in-the-blank) với TOÀN BỘ text đang hiển thị trên màn hình (không neo theo 1 dòng
 * cụ thể - passage dài có thể trải nhiều text node). Answer-set vẫn là điều kiện CẦN (lọc trước,
 * không đổi); nội dung câu hỏi là tín hiệu để CHỌN ĐÚNG 1 trong số candidate đã qua vòng lọc đó.
 *
 * KHÔNG đoán khi không đủ tin cậy: nếu winner không đủ ngưỡng coverage tối thiểu, hoặc không bỏ xa
 * candidate đứng thứ 2 đủ margin, vẫn trả AMBIGUOUS - không first-fit, không hạ ngưỡng để "cho qua".
 */

import { decideAnswerAction } from "../navigation/homeworkExamEngine.js";
import { detectQuestionType } from "./questionTypeDetector.js";

function stripHtmlLite(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ");
}

export function normalizeAnswerText(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function buildNormalizedVisibleSet(texts) {
  const set = new Set();
  for (const t of texts) set.add(normalizeAnswerText(t));
  return set;
}

/** Answer-set ĐẦY ĐỦ (không phải first-fit) - GIỮ NGUYÊN hành vi đã có từ bản vá 2026-08-25/26. */
export function findFullAnswerSetMatches(pool, normalizedVisibleSet) {
  const matches = [];
  let anyPartialTextVisible = false;
  for (const q of pool) {
    const answers = (q.answers ?? []).filter((a) => typeof a === "string" && a.trim().length > 0);
    if (answers.length < 2) continue;
    const visibleCount = answers.filter((a) => normalizedVisibleSet.has(normalizeAnswerText(a))).length;
    if (visibleCount >= 2) anyPartialTextVisible = true;
    if (visibleCount === answers.length) matches.push(q);
  }
  return { matches, anyPartialTextVisible };
}

// Stopword tối giản (tiếng Anh, đủ để lọc từ boilerplate hay lặp lại giữa các câu VD "choose the
// correct answer") - KHÔNG cần đầy đủ ngôn ngữ học, chỉ cần loại các từ không mang tính phân biệt
// giữa các câu hỏi trong CÙNG 1 exercise (đó là toàn bộ mục đích của bộ lọc này).
const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "to", "of", "in", "on", "at",
  "for", "and", "or", "but", "with", "as", "by", "from", "that", "this", "these", "those", "it", "its",
  "you", "your", "i", "he", "she", "they", "we", "do", "does", "did", "not", "no", "yes", "which",
  "what", "who", "whom", "choose", "complete", "correct", "answer", "answers", "sentence", "sentences",
  "question", "questions", "best", "fill", "blank", "each", "following", "word", "words", "read", "text",
]);

/**
 * Tokenize nội dung câu hỏi/đoạn văn để so khớp - loại placeholder chỗ trống ("___", chỉ tồn tại
 * trong text CMS, KHÔNG render literal trên màn hình nên không thể so trực tiếp), loại dấu câu, loại
 * token quá ngắn (<3 ký tự, thường là stopword/hạt nhân không mang nghĩa) và stopword. Giữ Unicode
 * chữ cái (an toàn cho tiếng Việt) qua `\p{L}`.
 */
export function normalizeQuestionTokens(text) {
  const cleaned = stripHtmlLite(text)
    .toLowerCase()
    .replace(/_+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];
  return cleaned.split(" ").filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

const MIN_CONTENT_TOKENS = 3;
const MIN_MATCH_COVERAGE = 0.6;
const MIN_MARGIN_OVER_RUNNER_UP = 0.25;

/**
 * Disambiguate giữa các candidate ĐÃ cùng khớp đủ answer-set, bằng nội dung câu hỏi/đoạn văn thay vì
 * answer-set (answer-set lúc này giống hệt nhau giữa các candidate nên không còn phân biệt được).
 * CHỈ gọi khi `candidates.length > 1` (answer-set đã đủ cho trường hợp unique, giữ nguyên fast path
 * ở `findMatchingQuestion()`).
 *
 * Thuật toán: coverage(candidate) = tỉ lệ token nội dung (đã normalize, loại placeholder/stopword)
 * của CHÍNH candidate đó xuất hiện trong tập token của TOÀN BỘ text đang hiển thị trên màn hình
 * (không neo 1 dòng cụ thể - đoạn văn dài có thể trải nhiều text node). Winner phải đạt
 * `coverage >= MIN_MATCH_COVERAGE` VÀ bỏ xa candidate đứng thứ 2 (runner-up) ít nhất
 * `MIN_MARGIN_OVER_RUNNER_UP` - không đủ 1 trong 2 điều kiện => AMBIGUOUS, không đoán.
 * @param {Array<{id:string, question:string}>} candidates - fullMatches (đã qua findFullAnswerSetMatches)
 * @param {string[]} visibleTexts - toàn bộ text đang hiển thị (collectAllTexts(tree))
 * @returns {{status:"MATCHED", winner:object, scores:Array<{question:object, coverage:number, tokenCount:number}>}
 *         | {status:"AMBIGUOUS", scores:Array<{question:object, coverage:number, tokenCount:number}>}}
 */
function scoreAgainstTexts(candidates, sourceTexts) {
  const visibleTokenSet = new Set();
  for (const t of sourceTexts) {
    for (const tok of normalizeQuestionTokens(t)) visibleTokenSet.add(tok);
  }
  const scored = candidates.map((question) => {
    const tokens = [...new Set(normalizeQuestionTokens(question.question))];
    if (tokens.length < MIN_CONTENT_TOKENS) {
      return { question, coverage: 0, tokenCount: tokens.length };
    }
    const hit = tokens.filter((tok) => visibleTokenSet.has(tok)).length;
    return { question, coverage: hit / tokens.length, tokenCount: tokens.length };
  });
  const ranked = [...scored].sort((a, b) => b.coverage - a.coverage);
  const [top, runnerUp] = ranked;
  const marginOk = runnerUp ? top.coverage - runnerUp.coverage >= MIN_MARGIN_OVER_RUNNER_UP : true;
  if (top.tokenCount >= MIN_CONTENT_TOKENS && top.coverage >= MIN_MATCH_COVERAGE && marginOk) {
    return { status: "MATCHED", winner: top.question, scores: ranked };
  }
  return { status: "AMBIGUOUS", scores: ranked };
}

export function disambiguateByQuestionText(candidates, visibleTexts) {
  // FIX (2026-09-01, live "Read and tick True or False" group-passage: 5 câu con dùng chung ĐÚNG 1
  // đoạn văn dẫn đề hiển thị NGUYÊN VẸN cho MỌI câu con, cộng 1 dòng phát biểu ("Today is Club
  // Day.") ngắn, đứng RIÊNG ngay trước 2 nút True/False - đoạn văn chung liệt kê từ vựng của TẤT CẢ
  // câu con (vd nhắc tới "Music Club"/"Art Club"/"Sports Club"/"Reading Club" trong 1 đoạn), nên
  // coverage-toàn-trang cũ cho MỌI candidate điểm cao gần bằng nhau -> luôn thiếu margin -> AMBIGUOUS
  // dù dòng phát biểu riêng NGAY TRƯỚC nút trả lời thừa sức phân biệt rạch ròi. SỬA: thử thêm coverage
  // trên các "cửa sổ" dòng text ngay TRƯỚC block đáp án (1 dòng, 2 dòng, ... tới hết phần trước đáp
  // án) TRƯỚC KHI tính coverage-toàn-trang - cửa sổ hẹp nhất cho kết quả đủ tin cậy (đạt CÙNG ngưỡng
  // MIN_MATCH_COVERAGE/MIN_MARGIN_OVER_RUNNER_UP, không hạ chuẩn) thắng ngay. Không tìm được cửa sổ
  // nào đủ tin cậy -> fallback NGUYÊN VẸN coverage-toàn-trang cũ (identical kết quả case [B]/[E] đã
  // có fixture - đoạn dẫn đề của các case đó vốn đã nằm liền trước block đáp án, không có nội dung gây
  // nhiễu đứng trước, nên cửa sổ hẹp hoặc toàn trang cho ra CÙNG 1 winner, chỉ khác điểm dừng).
  const optionTexts = new Set();
  for (const c of candidates) {
    for (const a of c.answers ?? []) {
      if (typeof a === "string" && a.trim()) optionTexts.add(normalizeAnswerText(a));
    }
  }
  let optionsStartIdx = -1;
  for (let i = 0; i < visibleTexts.length; i++) {
    if (optionTexts.has(normalizeAnswerText(visibleTexts[i]))) {
      optionsStartIdx = i;
      break;
    }
  }
  if (optionsStartIdx > 0) {
    for (let windowSize = 1; windowSize <= optionsStartIdx; windowSize++) {
      const windowTexts = visibleTexts.slice(Math.max(0, optionsStartIdx - windowSize), optionsStartIdx);
      const windowResult = scoreAgainstTexts(candidates, windowTexts);
      if (windowResult.status === "MATCHED") return windowResult;
    }
  }
  return scoreAgainstTexts(candidates, visibleTexts);
}

function collectAllTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectAllTexts(c, acc);
  return acc;
}

function isVisibleInTree(texts, textPattern) {
  const pattern = new RegExp(`^${textPattern}$`);
  return texts.some((t) => pattern.test(t));
}

/** Flat walk thu resource-id thật trong tree (giống collectAllTexts nhưng đọc attributes["resource-id"])
 * - MỚI (PHASE 4), dùng cho diagnostic payload khi không MATCH (xem PHASE 3B mục G/H). */
function collectResourceIds(node, acc = []) {
  const id = node?.attributes?.["resource-id"];
  if (typeof id === "string" && id.trim()) acc.push(id.trim());
  for (const c of node?.children ?? []) collectResourceIds(c, acc);
  return acc;
}

/** Forensic evidence cho từng candidate lộ MỘT PHẦN đáp án (PHASE 3B mục 4 - Phase 3B Revision):
 * matchedTexts (đáp án của CHÍNH candidate này đang hiển thị) / missingExpectedTexts (đáp án của
 * candidate này KHÔNG thấy) / unexpectedVisibleTexts (đáp án CỦA CANDIDATE KHÁC trong pool đang
 * hiển thị nhưng KHÔNG thuộc candidate này - tín hiệu "màn hình có thể đang là 1 câu khác"). CHỈ
 * tính trên dữ liệu đã có sẵn (pool/normalizedVisibleSet) - không suy đoán field nào không tính
 * được (để [] theo đúng yêu cầu, không bịa). */
function buildPartialMatchForensics(pool, normalizedVisibleSet) {
  const allKnownAnswerTexts = new Set();
  for (const q of pool) {
    for (const a of q.answers ?? []) {
      if (typeof a === "string" && a.trim()) allKnownAnswerTexts.add(a);
    }
  }
  const results = [];
  for (const q of pool) {
    const answers = (q.answers ?? []).filter((a) => typeof a === "string" && a.trim());
    if (answers.length < 2) continue;
    const matchedTexts = answers.filter((a) => normalizedVisibleSet.has(normalizeAnswerText(a)));
    if (matchedTexts.length === 0 || matchedTexts.length === answers.length) continue; // 0 = không partial; full = đã xử lý ở nhánh khác
    const missingExpectedTexts = answers.filter((a) => !matchedTexts.includes(a));
    const unexpectedVisibleTexts = [...allKnownAnswerTexts].filter(
      (a) => normalizedVisibleSet.has(normalizeAnswerText(a)) && !answers.includes(a),
    );
    results.push({ id: q.id, overlapCount: matchedTexts.length, totalCount: answers.length, matchedTexts, missingExpectedTexts, unexpectedVisibleTexts });
  }
  return results;
}

/** contentMatch/answerable -> nhãn failure classification cuối cùng (PHASE 3B mục F/H - Phase 3B
 * Revision mục 5: CONTENT_MISMATCH KHÔNG BAO GIỜ được diễn giải thành WRONG_ASSIGNMENT/WRONG_ROOM/
 * EXERCISE_IDENTITY_MISMATCH - chỉ có nghĩa "actual UI content != expected CMS content", không hơn).
 * QUESTION_MISMATCH KHÔNG được tính ở đây - đó là quyết định CẤP CALLER (cần biết lịch sử phiên làm
 * bài: các câu TRƯỚC đó trong CÙNG session đã MATCH sạch hay chưa - diagnoseCurrentQuestion() thuần/
 * không trạng thái nên không tự biết điều này, xem docblock diagnoseCurrentQuestion()). */
function classify(answerable, questionType, contentMatch) {
  if (!answerable) {
    // UNKNOWN (không detector nào nổ - "chưa đủ bằng chứng") KHÁC hẳn 1 type ĐÃ nhận diện được
    // nhưng pipeline chưa hỗ trợ answer (DRAG_DROP/SPEAK) - không được gộp chung, đúng PHASE 3B §H.
    if (questionType === "UNKNOWN") return "IDENTITY_UNVERIFIABLE";
    if (questionType === "SORT_OR_SENTENCE_BUILDER") return "AMBIGUOUS_QUESTION_TYPE";
    return "UNSUPPORTED_QUESTION_TYPE";
  }
  switch (contentMatch) {
    case "MATCH":
      return null; // thành công, không cần classification lỗi
    case "AMBIGUOUS":
      return "AMBIGUOUS_QUESTION_TYPE"; // nhiều candidate cùng khớp full answer-set, không phân biệt được - dùng chung nhãn AMBIGUOUS như trạng thái status hiện có
    case "PARTIAL_MATCH":
      return "PARTIAL_CONTENT_MATCH";
    case "NO_CONTENT_MATCH":
      return "CONTENT_MISMATCH";
    case "NOT_ENOUGH_CONTENT":
    default:
      return "IDENTITY_UNVERIFIABLE";
  }
}

/**
 * diagnoseCurrentQuestion() - THUẦN/ĐỒNG BỘ/CHỈ ĐỌC (PHASE 4, theo thiết kế PHASE 3B đã duyệt).
 * KHÔNG gọi bridge, KHÔNG tap/type/submit/điều hướng - chỉ nhận `tree` đã fetch sẵn.
 *
 * Tách 2 bước TUẦN TỰ, bước 1 KHÔNG phụ thuộc bước 2 (khác `decideAnswerAction()` cũ vốn gộp chung
 * detect+match+quyết định answer):
 *   1. detectQuestionType() - loại câu hỏi trên màn là gì, có `answerable` không (questionTypeDetector.js).
 *   2. Nếu answerable: so nội dung với `expectedPool` (TÁI SỬ DỤNG NGUYÊN `findFullAnswerSetMatches()`/
 *      `disambiguateByQuestionText()` đã có, KHÔNG viết lại thuật toán answer-set/disambiguate) ->
 *      1 trong 6 trạng thái `contentMatch`: MATCH/AMBIGUOUS/PARTIAL_MATCH/NO_CONTENT_MATCH/
 *      NOT_ENOUGH_CONTENT/NOT_ATTEMPTED.
 *
 * `identityStatus` CHỈ nhận "UNVERIFIED" hoặc "MISMATCH_SUSPECTED" - KHÔNG BAO GIỜ "VERIFIED" (đúng
 * khoá cứng PHASE 3B Revision mục 5/6: app không expose immutable room/exam/lesson-item ID nào trên
 * UI - content khớp/không khớp KHÔNG chứng minh được identity, xem "What this design can prove /
 * cannot prove" trong PHASE 3B).
 *
 * @param {Object} tree - bridge.hierarchy() ĐÃ fetch sẵn
 * @param {import("../model/questionModel.js").QuestionModel[]} expectedPool
 * @param {{questionIndex?: number|string, examIdContext?: {roomExamId?:string, candidateExamId?:string}}} [ctx]
 */
export function diagnoseCurrentQuestion(tree, expectedPool, { questionIndex, examIdContext } = {}) {
  const texts = collectAllTexts(tree);
  const isVisible = (t) => isVisibleInTree(texts, t);
  const normalizedVisibleSet = buildNormalizedVisibleSet(texts);
  const resourceIds = collectResourceIds(tree);
  const typeResult = detectQuestionType(tree, texts, expectedPool);

  const base = {
    questionIndex: questionIndex ?? null,
    poolSize: expectedPool.length,
    examIdContext: examIdContext ?? null,
    questionType: typeResult.questionType,
    typeConfidence: typeResult.typeConfidence,
    typeEvidence: typeResult.typeEvidence,
    matchedDetectors: typeResult.matchedDetectors,
    detectorConflict: typeResult.detectorConflict,
    answerable: typeResult.answerable,
    knownCorrectnessRisk: typeResult.knownCorrectnessRisk,
    visibleTexts: texts,
    resourceIds,
    expectedPoolSummary: { size: expectedPool.length, ids: expectedPool.map((q) => q.id) },
    tree,
  };

  const finalize = (contentMatch, extra, diagnosticReason, identityStatus) => ({
    ...base,
    contentMatch,
    contentEvidence: extra.contentEvidence ?? null,
    matchedQuestion: extra.matchedQuestion ?? null,
    identityStatus,
    diagnosticReason,
    classification: classify(base.answerable, base.questionType, contentMatch),
  });

  if (!typeResult.answerable) {
    return finalize(
      "NOT_ATTEMPTED",
      {},
      `Loại câu "${typeResult.questionType}" chưa được pipeline này hỗ trợ answer - không thử content matching (xem matchedDetectors/typeEvidence để biết bằng chứng).`,
      "UNVERIFIED",
    );
  }

  // IMAGE_CHOICE_GRID: answers[] không có chữ (không thể answer-set match qua text) - tín hiệu nội
  // dung DUY NHẤT khả dụng là SỐ LƯỢNG đáp án khớp số box. Khác bản cũ (chọn candidate ĐẦU TIÊN khớp
  // box count không cần biết có >1 candidate cùng khớp hay không) - giờ phân biệt rõ:
  // đúng-1-khớp -> MATCH thật; >1 cùng khớp -> AMBIGUOUS (không đoán); 0 khớp -> NOT_ENOUGH_CONTENT.
  if (typeResult.questionType === "IMAGE_CHOICE_GRID") {
    const boxCount = typeResult.gridBoxCount;
    const boxCountMatches = expectedPool.filter((q) => (q.answers ?? []).length === boxCount);
    if (boxCountMatches.length === 1) {
      const winner = boxCountMatches[0];
      const action = decideAnswerAction(tree, isVisible, winner, true);
      if (action) {
        return finalize(
          "MATCH",
          { matchedQuestion: winner, contentEvidence: { fullMatchIds: [winner.id], partialMatches: [] } },
          `IMAGE_CHOICE_GRID: đúng 1 candidate có số đáp án (${boxCount}) khớp số box.`,
          "UNVERIFIED",
        );
      }
      return finalize(
        "NOT_ENOUGH_CONTENT",
        { contentEvidence: { fullMatchIds: [winner.id], partialMatches: [] } },
        `IMAGE_CHOICE_GRID: candidate id=${winner.id} khớp số box nhưng decideAnswerAction() từ chối - bất thường, cần điều tra riêng.`,
        "UNVERIFIED",
      );
    }
    if (boxCountMatches.length > 1) {
      return finalize(
        "AMBIGUOUS",
        { contentEvidence: { fullMatchIds: boxCountMatches.map((q) => q.id), partialMatches: [] } },
        `IMAGE_CHOICE_GRID: ${boxCountMatches.length} candidate cùng có ${boxCount} đáp án - không phân biệt được chỉ bằng số box.`,
        "MISMATCH_SUSPECTED",
      );
    }
    return finalize(
      "NOT_ENOUGH_CONTENT",
      { contentEvidence: { fullMatchIds: [], partialMatches: [] } },
      `IMAGE_CHOICE_GRID: không candidate nào trong pool có ${boxCount} đáp án - không đủ dữ liệu so khớp.`,
      "UNVERIFIED",
    );
  }

  // Mọi type answerable còn lại (TEXT_CHOICE/CONNECT/FILL_WORD) - TÁI SỬ DỤNG NGUYÊN answer-set
  // matching/disambiguation đã có, KHÔNG viết lại thuật toán.
  const { matches: fullMatches, anyPartialTextVisible } = findFullAnswerSetMatches(expectedPool, normalizedVisibleSet);

  if (fullMatches.length === 1) {
    const winner = fullMatches[0];
    const action = decideAnswerAction(tree, isVisible, winner, true);
    if (action) {
      return finalize(
        "MATCH",
        { matchedQuestion: winner, contentEvidence: { fullMatchIds: [winner.id], partialMatches: [] } },
        "Unique full answer-set match.",
        "UNVERIFIED",
      );
    }
    return finalize(
      "NOT_ENOUGH_CONTENT",
      { contentEvidence: { fullMatchIds: [winner.id], partialMatches: [] } },
      `Full answer-set match id=${winner.id} nhưng decideAnswerAction() từ chối - bất thường cần điều tra riêng, KHÔNG phải content mismatch thông thường (xem PHASE 3A §I).`,
      "UNVERIFIED",
    );
  }

  if (fullMatches.length > 1) {
    const disambig = disambiguateByQuestionText(fullMatches, texts);
    if (disambig.status === "MATCHED") {
      const action = decideAnswerAction(tree, isVisible, disambig.winner, true);
      if (action) {
        return finalize(
          "MATCH",
          { matchedQuestion: disambig.winner, contentEvidence: { fullMatchIds: fullMatches.map((m) => m.id), partialMatches: [] } },
          "Answer-set + question-text disambiguation.",
          "UNVERIFIED",
        );
      }
      return finalize(
        "NOT_ENOUGH_CONTENT",
        { contentEvidence: { fullMatchIds: fullMatches.map((m) => m.id), partialMatches: [] } },
        `Disambiguated winner id=${disambig.winner.id} nhưng decideAnswerAction() từ chối - bất thường.`,
        "UNVERIFIED",
      );
    }
    return finalize(
      "AMBIGUOUS",
      {
        contentEvidence: {
          fullMatchIds: fullMatches.map((m) => m.id),
          partialMatches: [],
          normalizedVisibleAnswers: [...normalizedVisibleSet],
          candidates: fullMatches.map((m) => ({ id: m.id, answers: m.answers, question: m.question })),
          questionTextScores: disambig.scores.map((s) => ({ id: s.question.id, coverage: s.coverage, tokenCount: s.tokenCount })),
        },
      },
      `${fullMatches.length} candidate cùng khớp ĐỦ answer-set đang hiển thị, nội dung câu hỏi KHÔNG đủ phân biệt.`,
      "MISMATCH_SUSPECTED",
    );
  }

  if (anyPartialTextVisible) {
    return finalize(
      "PARTIAL_MATCH",
      { contentEvidence: { fullMatchIds: [], partialMatches: buildPartialMatchForensics(expectedPool, normalizedVisibleSet) } },
      "Một số candidate lộ MỘT PHẦN đáp án nhưng không candidate nào đủ HẾT answer-set - nghi ngờ catalog content khác served content (H1/H2, KHÔNG phân biệt được - xem identityStatus).",
      "MISMATCH_SUSPECTED",
    );
  }

  return finalize(
    "NO_CONTENT_MATCH",
    { contentEvidence: { fullMatchIds: [], partialMatches: [] } },
    `Type answerable (${typeResult.questionType}) nhưng KHÔNG candidate nào trong pool lộ dù 1 phần đáp án - CONTENT_MISMATCH khả nghi (mở nhầm room HOẶC đúng room nhưng served content khác catalog - 2 khả năng này KHÔNG phân biệt được từ automation, xem identityStatus).`,
    "MISMATCH_SUSPECTED",
  );
}

/**
 * Orchestrator DUY NHẤT (thay 9 bản copy-paste rải rác) - matching thật cho 1 câu hỏi đang hiển
 * thị trên app, gọi bởi vòng lặp trả lời VÀ bởi content-fingerprint verify lúc mở/resume assignment.
 *
 * PHASE 4 (2026-08-31): giờ chỉ là 1 lớp orchestration MỎNG quanh `diagnoseCurrentQuestion()` (tách
 * biệt DETECTION/CONTENT MATCHING khỏi ANSWER EXECUTION, xem PHASE 3B Revision mục 1) - KHÔNG còn tự
 * chứa heuristic rời rạc. Nhánh fallback first-fit CŨ ("không có đáp án dạng text nào hiển thị -> tap
 * candidate ĐẦU TIÊN decideAnswerAction() không trả null") ĐÃ BỊ XOÁ HẲN theo yêu cầu khoá cứng PHASE
 * 3B Revision mục 7 - KHÔNG giữ lại dưới tên khác, KHÔNG có "first candidate/random/partial/closest/
 * shape-only candidate" nào trong pipeline này nữa. `contentMatch !== "MATCH"` -> LUÔN dừng, LUÔN trả
 * diagnostic đầy đủ (`status: "NO_MATCH"` giữ nguyên tên field cũ để KHÔNG phá vỡ caller hiện có kiểm
 * tra `result.status !== "MATCHED"`, nhưng `diagnostic` giờ là CHÍNH object `diagnoseCurrentQuestion()`
 * trả về - giàu hơn hẳn field cũ `{questionIndex, poolSize, reason}` - kèm `diagnostic.classification`
 * mang đúng 1 trong: UNSUPPORTED_QUESTION_TYPE/AMBIGUOUS_QUESTION_TYPE/CONTENT_MISMATCH/
 * PARTIAL_CONTENT_MATCH/IDENTITY_UNVERIFIABLE - `QUESTION_MISMATCH` KHÔNG được gán ở đây (cần lịch sử
 * phiên làm bài mà hàm THUẦN này không có - caller tự nâng cấp CONTENT_MISMATCH thành QUESTION_MISMATCH
 * khi biết CÁC CÂU TRƯỚC trong CÙNG session đã MATCH sạch, xem comment classify()).
 *
 * @param {{hierarchy: () => Promise<object>}} bridge
 * @param {Array<object>} pool - QuestionModel[] còn lại chưa dùng
 * @param {?object} priorTree - cây hierarchy đã đọc sẵn (tránh gọi lại bridge.hierarchy())
 * @param {number|string} questionIndex - dùng cho log VÀ đưa vào diagnostic
 * @param {?{roomExamId?:string, candidateExamId?:string}} examIdContext - dùng cho log
 */
export async function findMatchingQuestion(bridge, pool, priorTree, questionIndex, examIdContext) {
  const roomExamId = examIdContext?.roomExamId ?? "-";
  const candidateExamId = examIdContext?.candidateExamId ?? "-";
  const tree = priorTree ?? (await bridge.hierarchy());
  const logPrefix = `[answer-match] roomExamId=${roomExamId} candidateExamId=${candidateExamId}`;

  const diag = diagnoseCurrentQuestion(tree, pool, { questionIndex, examIdContext });

  if (diag.contentMatch === "MATCH") {
    console.log(`  [MATCH] UI question ${questionIndex} -> CMS question id=${diag.matchedQuestion.id} | ${diag.diagnosticReason}`);
    console.log(`${logPrefix} fullAnswerSetMatch=true`);
    return { status: "MATCHED", question: { ...diag.matchedQuestion, _snapshot: { tree, texts: diag.visibleTexts } } };
  }

  if (diag.contentMatch === "AMBIGUOUS" && diag.answerable) {
    console.log(`  [MATCH][AMBIGUOUS] question_index=${questionIndex} pool_size=${pool.length} - ${diag.diagnosticReason}`);
    console.log(`${logPrefix} fullAnswerSetMatch=false`);
    return { status: "AMBIGUOUS", diagnostic: diag };
  }

  console.log(
    `  [MATCH][NO_MATCH] question_index=${questionIndex} pool_size=${pool.length} - classification=${diag.classification} - ${diag.diagnosticReason}`,
  );
  console.log(`${logPrefix} fullAnswerSetMatch=false`);
  return { status: "NO_MATCH", diagnostic: diag };
}
