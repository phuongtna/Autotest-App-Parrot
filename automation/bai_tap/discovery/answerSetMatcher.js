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
export function disambiguateByQuestionText(candidates, visibleTexts) {
  const visibleTokenSet = new Set();
  for (const t of visibleTexts) {
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

/**
 * Orchestrator DUY NHẤT (thay 9 bản copy-paste rải rác) - matching thật cho 1 câu hỏi đang hiển
 * thị trên app, gọi bởi vòng lặp trả lời VÀ bởi content-fingerprint verify lúc mở/resume assignment.
 *
 * Thứ tự quyết định (KHÔNG đổi cho case fullMatches.length <= 1 - giữ nguyên hành vi đã verify sống
 * trước đây, tránh regression theo đúng yêu cầu):
 *   1. fullMatches.length === 1  -> MATCHED ngay (answer-set đã đủ phân biệt, fast path).
 *   2. fullMatches.length > 1   -> [MỚI] thử disambiguateByQuestionText(); MATCHED nếu thắng rõ
 *      ràng, ngược lại AMBIGUOUS (không first-fit).
 *   3. fullMatches.length === 0, có candidate lộ 1 phần đáp án -> NO_MATCH.
 *   4. Không candidate nào lộ dù 1 phần đáp án dạng text (nghi IMAGE_CHOICE_GRID) -> fallback
 *      first-fit CŨ (GIỮ NGUYÊN, chưa có dữ liệu thật để sửa đúng hơn).
 *
 * @param {{hierarchy: () => Promise<object>}} bridge
 * @param {Array<object>} pool - QuestionModel[] còn lại chưa dùng
 * @param {?object} priorTree - cây hierarchy đã đọc sẵn (tránh gọi lại bridge.hierarchy())
 * @param {number|string} questionIndex - chỉ dùng cho log
 * @param {?{roomExamId?:string, candidateExamId?:string}} examIdContext - chỉ dùng cho log
 */
export async function findMatchingQuestion(bridge, pool, priorTree, questionIndex, examIdContext) {
  const roomExamId = examIdContext?.roomExamId ?? "-";
  const candidateExamId = examIdContext?.candidateExamId ?? "-";
  const tree = priorTree ?? (await bridge.hierarchy());
  const texts = collectAllTexts(tree);
  const isVisible = (t) => isVisibleInTree(texts, t);
  const normalizedVisibleSet = buildNormalizedVisibleSet(texts);
  const logPrefix = `[answer-match] roomExamId=${roomExamId} candidateExamId=${candidateExamId}`;

  const { matches: fullMatches, anyPartialTextVisible } = findFullAnswerSetMatches(pool, normalizedVisibleSet);

  const tryDecide = (winner, matchKind) => {
    const action = decideAnswerAction(tree, isVisible, winner, true);
    if (!action) return null;
    console.log(`  [MATCH] UI question ${questionIndex} -> CMS question id=${winner.id} | ${matchKind}`);
    console.log(`${logPrefix} fullAnswerSetMatch=true matchKind=${matchKind}`);
    return { status: "MATCHED", question: { ...winner, _snapshot: { tree, texts } } };
  };

  if (fullMatches.length === 1) {
    const result = tryDecide(fullMatches[0], "exact answer-set match");
    if (result) return result;
    console.log(
      `  [MATCH][NO_MATCH] question_index=${questionIndex} pool_size=${pool.length} - candidate id=${fullMatches[0].id} ` +
        `khớp full answer-set nhưng decideAnswerAction() không tạo được action (loại câu hỏi không tương thích).`,
    );
    console.log(`${logPrefix} fullAnswerSetMatch=false`);
    return {
      status: "NO_MATCH",
      diagnostic: { questionIndex, poolSize: pool.length, reason: `decideAnswerAction() returned null for unique full-set match id=${fullMatches[0].id}` },
    };
  }

  if (fullMatches.length > 1) {
    const disambig = disambiguateByQuestionText(fullMatches, texts);
    if (disambig.status === "MATCHED") {
      const result = tryDecide(disambig.winner, "answer-set + question-text disambiguation");
      if (result) return result;
      console.log(
        `  [MATCH][NO_MATCH] question_index=${questionIndex} pool_size=${pool.length} - question-text winner id=${disambig.winner.id} ` +
          `nhưng decideAnswerAction() không tạo được action.`,
      );
      console.log(`${logPrefix} fullAnswerSetMatch=false`);
      return {
        status: "NO_MATCH",
        diagnostic: {
          questionIndex,
          poolSize: pool.length,
          reason: `decideAnswerAction() returned null for question-text-disambiguated id=${disambig.winner.id}`,
          questionTextScores: disambig.scores.map((s) => ({ id: s.question.id, coverage: s.coverage, tokenCount: s.tokenCount })),
        },
      };
    }
    console.log(
      `  [MATCH][AMBIGUOUS] question_index=${questionIndex} pool_size=${pool.length} - ${fullMatches.length} candidate cùng khớp ĐỦ ` +
        `answer-set đang hiển thị, nội dung câu hỏi KHÔNG đủ phân biệt (scores=` +
        `${JSON.stringify(disambig.scores.map((s) => ({ id: s.question.id, coverage: Number(s.coverage.toFixed(3)), tokenCount: s.tokenCount })))}).`,
    );
    console.log(`${logPrefix} fullAnswerSetMatch=false`);
    return {
      status: "AMBIGUOUS",
      diagnostic: {
        questionIndex,
        normalizedVisibleAnswers: [...normalizedVisibleSet],
        candidates: fullMatches.map((m) => ({ id: m.id, answers: m.answers, question: m.question })),
        questionTextScores: disambig.scores.map((s) => ({ id: s.question.id, coverage: s.coverage, tokenCount: s.tokenCount })),
      },
    };
  }

  if (anyPartialTextVisible) {
    console.log(
      `  [MATCH][NO_MATCH] question_index=${questionIndex} pool_size=${pool.length} - có candidate lộ MỘT PHẦN đáp án nhưng không ` +
        `candidate nào đủ HẾT answer-set.`,
    );
    console.log(`${logPrefix} fullAnswerSetMatch=false`);
    return {
      status: "NO_MATCH",
      diagnostic: { questionIndex, poolSize: pool.length, reason: "partial-only matches (>=2 nhưng chưa đủ hết) - không candidate nào đủ full answer-set" },
    };
  }

  // Không candidate nào lộ dù 1 phần đáp án dạng text - nghi ngờ IMAGE_CHOICE_GRID - GIỮ NGUYÊN
  // hành vi first-fit CŨ cho trường hợp CHƯA có dữ liệu thật để sửa đúng, tránh regression.
  for (const question of pool) {
    const action = decideAnswerAction(tree, isVisible, question, true);
    if (action) {
      console.log(
        `  [MATCH] UI question ${questionIndex} -> CMS question id=${question.id} | fallback first-fit (không có đáp án dạng text nào hiển thị, có thể IMAGE_CHOICE_GRID)`,
      );
      console.log(`${logPrefix} fullAnswerSetMatch=false (fallback first-fit, non-text UI)`);
      return { status: "MATCHED", question: { ...question, _snapshot: { tree, texts } } };
    }
  }
  console.log(`  [MATCH][NO_MATCH] question_index=${questionIndex} pool_size=${pool.length} - fallback first-fit cũng không tìm được candidate nào (decideAnswerAction() trả null cho toàn bộ pool).`);
  console.log(`${logPrefix} fullAnswerSetMatch=false`);
  return {
    status: "NO_MATCH",
    diagnostic: { questionIndex, poolSize: pool.length, reason: "no text answers visible at all and legacy image-grid fallback found no match" },
  };
}
