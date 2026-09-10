/**
 * Khớp CÂU ĐANG HIỂN THỊ trên thiết bị với ĐÚNG 1 câu trong pool CMS đã resolve - THAY THẾ hoàn
 * toàn giả định cũ "câu hiện tại = questions[START_INDEX]" (SAI với "Thử thách": đã xác nhận thật
 * 2026-09-10, thứ tự câu bị xáo trộn mỗi lượt, không khớp thứ tự mảng CMS gốc).
 *
 * KHÔNG có testID/identifier nào ổn định để nhận diện ĐÚNG câu nào trong số nhiều câu CÙNG type
 * (exercise_answer_{i}/exercise_sort_word_{i}... đều là testID THEO VỊ TRÍ, dùng lại y hệt cho
 * MỌI câu cùng dạng - xem ghi chú trong homeworkExamEngine.js) - vì vậy chiến lược DUY NHẤT khả
 * thi là so khớp NỘI DUNG:
 *   1. Lọc pool còn lại theo type CMS tương thích với UI type vừa detect.
 *   2. CHỈ CÒN ĐÚNG 1 candidate -> dùng luôn (0 rủi ro nhầm, không cần đọc text) - vẫn có 1 bước
 *      kiểm tra hợp lý tối thiểu (sanity check, xem `MIN_SCORE_BY_TYPE`) để KHÔNG âm thầm trả lời
 *      nhầm nếu resolver/pool thật sự sai lệch.
 *   3. CÒN NHIỀU candidate -> so khớp nội dung TĨNH đang hiển thị (đáp án/câu dẫn) - so khớp
 *      CHÍNH XÁC sau khi chuẩn hoá (KHÔNG fuzzy/similarity-threshold) để tránh match nhầm câu như
 *      yêu cầu - nếu không phân biệt được rõ ràng (điểm cao nhất không duy nhất hoặc dưới ngưỡng
 *      tối thiểu) THÌ BÁO LỖI RÕ RÀNG (AMBIGUOUS_MATCH), không đoán đại.
 */
import {
  collectTexts,
  hasResourceId,
  collectConnectSlots,
  resolveConnectCorrectPairs,
} from "../bai_tap/navigation/homeworkExamEngine.js";

function stripHtml(value) {
  if (typeof value !== "string") return value;
  return value.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

/** Chuẩn hoá text để SO SÁNH: Unicode NFC, bỏ HTML/entity, quy 1 kiểu dấu nháy, gộp khoảng
 * trắng/xuống dòng, hạ chữ thường - CHƯA bỏ dấu câu (dùng cho hiển thị/log). */
function normalize(text) {
  if (typeof text !== "string") return "";
  return stripHtml(text)
    .normalize("NFC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Chuẩn hoá CHẶT hơn cho so khớp thật (bỏ luôn dấu câu không quan trọng theo yêu cầu) - vẫn là
 * so khớp CHÍNH XÁC (exact-equality/containment) sau chuẩn hoá, KHÔNG phải fuzzy/similarity.
 * Gộp CHUỖI DẤU GẠCH DƯỚI (chỗ trống "_____" của CMS content_label) thành 1 khoảng trắng - số
 * lượng gạch dưới UI thật render ra có thể không khớp CHÍNH XÁC với CMS (xác nhận qua dry-run:
 * CMS "_____" 5 ký tự, không đáng để đòi khớp tuyệt đối số lượng - phần TEXT XUNG QUANH chỗ trống
 * mới là thứ cần khớp chính xác). */
function normalizeForCompare(text) {
  return normalize(text)
    .replace(/_{2,}/g, " ")
    .replace(/[.,!?;:"'()[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectQuestionUiType(tree) {
  if (hasResourceId(tree, /^exercise_sort_area$/)) return "SORT";
  if (hasResourceId(tree, /^exercise_connect_left_0$/)) return "CONNECT";
  if (hasResourceId(tree, /^exercise_fillword_input$/)) return "FILL_WORD_SINGLE";
  if (hasResourceId(tree, /^exercise_fillword_blank_0$/)) return "FILL_WORD_MULTI";
  if (hasResourceId(tree, /^exercise_dragdrop_zone_0$/)) return "DRAG_DROP";
  if (hasResourceId(tree, /^exercise_answer_0$/)) return "CHOICE";
  return null;
}

function isChoiceCms(q) {
  const rawAnswers = q?.metadata?.raw?.answers;
  return Array.isArray(rawAnswers) && rawAnswers.length > 0 && typeof rawAnswers[0] === "object";
}
function isFillWordCms(q) {
  return q.type === "FILL_WORD";
}
function isSortCms(q) {
  return q.type === "SORT";
}
function isDragDropCms(q) {
  return q.type === "DRAG_DROP";
}
function isConnectCms(q) {
  return q.type === "CONNECT";
}

const CMS_PREDICATE_BY_UI_TYPE = {
  CHOICE: isChoiceCms,
  FILL_WORD_SINGLE: isFillWordCms,
  FILL_WORD_MULTI: isFillWordCms,
  SORT: isSortCms,
  DRAG_DROP: isDragDropCms,
  CONNECT: isConnectCms,
};

// Ngưỡng điểm TỐI THIỂU để chấp nhận 1 candidate (kể cả khi chỉ còn 1 candidate - sanity check).
// CHOICE/DRAG_DROP: cần >=2 đáp án khớp (1 đáp án trùng ngẫu nhiên giữa 2 câu khác nhau không
// hiếm - vd "True"/"False" - nhưng 2 đáp án khớp cùng lúc thì gần như chắc chắn đúng câu).
// FILL_WORD/SORT: chỉ có 1 "anchor" tĩnh (content_label) nên ngưỡng là 1.
// CONNECT: >=2 (tối thiểu 1 cặp, mỗi cặp góp 2 điểm left+right).
const MIN_SCORE_BY_TYPE = {
  CHOICE: 2,
  DRAG_DROP: 2,
  FILL_WORD_SINGLE: 1,
  FILL_WORD_MULTI: 1,
  SORT: 1,
  CONNECT: 2,
};

/** Text "anchor" tĩnh, duy nhất của 1 câu (đoạn dẫn/câu gốc luôn hiển thị, không đổi theo lựa
 * chọn) - dùng cho FILL_WORD/SORT (answers[] không đọc được trên màn hoặc không đủ phân biệt).
 * Ưu tiên "content_label" (câu gốc hiển thị nguyên văn trong khung riêng, xác nhận thật qua
 * screenshot FILL_WORD "Mars lacks oxygen..." VÀ SORT dạng đoạn văn "Many people use
 * smartphones..."), fallback "content" (mảng đoạn quanh chỗ trống) rồi "title". SORT dạng hội
 * thoại có content_label RỖNG (xác nhận qua CMS raw) - khi đó fallback về title (vẫn phân biệt
 * được NẾU có >1 câu SORT khác title trong cùng exam; nếu trùng title + trùng content_label rỗng
 * thì để nguyên score=0, dựa vào nhánh "chỉ còn 1 candidate" thay vì đoán).
 */
function getAnchorText(question) {
  const raw = question?.metadata?.raw?.question;
  const label = raw?.content_label;
  if (label && stripHtml(label).trim()) return stripHtml(label);
  if (Array.isArray(raw?.content)) {
    const joined = raw.content.map(stripHtml).join(" ").trim();
    if (joined.replace(/_/g, "").trim()) return joined;
  } else if (typeof raw?.content === "string" && stripHtml(raw.content).trim()) {
    return stripHtml(raw.content);
  }
  return question?.metadata?.title || "";
}

function scoreChoiceLike(question, normTextSet, joinedBlob) {
  let score = 0;
  for (const ans of question.answers ?? []) {
    const na = normalizeForCompare(ans);
    if (!na) continue;
    if (normTextSet.has(na) || joinedBlob.includes(na)) score++;
  }
  return score;
}

function scoreAnchor(question, joinedBlob) {
  const anchor = normalizeForCompare(getAnchorText(question));
  if (!anchor) return 0;
  return joinedBlob.includes(anchor) ? 1 : 0;
}

function scoreConnect(question, normTextSet, joinedBlob) {
  const pairs = resolveConnectCorrectPairs(question);
  if (!pairs) return 0;
  let score = 0;
  for (const p of pairs) {
    const nl = normalizeForCompare(p.leftText);
    const nr = normalizeForCompare(p.rightText);
    if (nl && (normTextSet.has(nl) || joinedBlob.includes(nl))) score++;
    if (nr && (normTextSet.has(nr) || joinedBlob.includes(nr))) score++;
  }
  return score;
}

function scoreFor(uiType, question, normTextSet, joinedBlob) {
  if (uiType === "CHOICE" || uiType === "DRAG_DROP") return scoreChoiceLike(question, normTextSet, joinedBlob);
  if (uiType === "CONNECT") return scoreConnect(question, normTextSet, joinedBlob);
  return scoreAnchor(question, joinedBlob); // FILL_WORD_SINGLE / FILL_WORD_MULTI / SORT
}

/**
 * @param {Object} tree - `bridge.hierarchy()` của màn đang hiển thị.
 * @param {string} uiType - kết quả `detectQuestionUiType(tree)`.
 * @param {Array<{ question: Object, answered: boolean }>} pool - mutable, KHÔNG tự đánh dấu
 *   `answered` ở đây (caller quyết định sau khi trả lời THÀNH CÔNG - tách rời "tìm" và "đã dùng").
 * @returns {{ question: Object, answered: boolean }} - entry TRONG pool (cùng tham chiếu).
 * @throws {Error} "NO_CANDIDATE_QUESTION" | "SANITY_CHECK_FAILED" | "AMBIGUOUS_MATCH"
 */
export function findMatchingPoolEntry(tree, uiType, pool) {
  const predicate = CMS_PREDICATE_BY_UI_TYPE[uiType];
  if (!predicate) {
    throw new Error(`UNKNOWN_UI_TYPE: "${uiType}" chưa có bộ lọc CMS type tương ứng trong matcher.`);
  }
  const candidates = pool.filter((e) => !e.answered && predicate(e.question));
  if (candidates.length === 0) {
    throw new Error(
      `NO_CANDIDATE_QUESTION: không còn câu CMS nào type phù hợp UI type "${uiType}" trong pool ` +
        `(đã dùng hết hoặc resolver thiếu câu dạng này).`,
    );
  }

  const texts = collectTexts(tree);
  const normTextSet = new Set(texts.map(normalizeForCompare));
  const joinedBlob = texts.map(normalizeForCompare).join(" ");
  const minScore = MIN_SCORE_BY_TYPE[uiType] ?? 1;

  if (candidates.length === 1) {
    const entry = candidates[0];
    const score = scoreFor(uiType, entry.question, normTextSet, joinedBlob);
    if (score < minScore) {
      throw new Error(
        `SANITY_CHECK_FAILED: câu duy nhất còn lại trong pool cho UI type "${uiType}" (CMS id ` +
          `${entry.question.id}) không khớp đủ nội dung hiển thị trên màn (score=${score}, cần ` +
          `>=${minScore}) - có thể resolver sai đề/exam hoặc app đang hiển thị câu ngoài pool.`,
      );
    }
    return entry;
  }

  const scored = candidates
    .map((entry) => ({ entry, score: scoreFor(uiType, entry.question, normTextSet, joinedBlob) }))
    .sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  if (best.score < minScore || (second && second.score === best.score)) {
    throw new Error(
      `AMBIGUOUS_MATCH: không phân biệt được câu hiện tại giữa ${candidates.length} candidate ` +
        `cùng UI type "${uiType}" (điểm cao nhất=${best.score}, ngưỡng=${minScore}). Candidate id: ` +
        `${candidates.map((c) => c.question.id).join(", ")}.`,
    );
  }
  return best.entry;
}
