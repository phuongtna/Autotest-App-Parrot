import { collectTextNodesWithBoundsInsideScrollableList, parseOnThiCardsWithDetail, centerPoint } from "./onThiUiList.js";
import { runSearchStateMachine } from "../../bai_tap/discovery/assignmentSearchEngine.js";
import { normalizeDueDateDM, scrollToTop as scrollToTopHomeworkList } from "../../bai_tap/discovery/findAssignment.js";

/**
 * findDeThi() - bản dành cho tab "Ôn thi > Đề thầy cô giao", THEO ĐÚNG kiến trúc
 * automation/bai_tap/discovery/findAssignment.js (target-driven, không phụ thuộc số lượng đề) - TÁI
 * SỬ DỤNG NGUYÊN VẸN `runSearchStateMachine()` (assignmentSearchEngine.js, generic by design, không
 * có gì riêng của module Bài tập) và `normalizeDueDateDM()` (định dạng "Hạn nộp DD/MM (QUÁ
 * HẠN)"/"Hạn nộp Hôm nay" GIỐNG HỆT module Bài tập theo ảnh mockup - xem onThiUiList.js) - CHỈ thay
 * parser (`parseOnThiCardsWithDetail` thay `parseHomeworkCardsWithDetail`).
 *
 * KHÔNG copy-paste lại normalizeDueDateDM()/scrollToTop() - import thẳng từ findAssignment.js vì
 * logic hoàn toàn chung (không có gì đặc thù Bài tập trong 2 hàm này: normalizeDueDateDM() chỉ xử
 * lý chuỗi text, scrollToTop() chỉ cần đúng anchor "2 tuần gần nhất|1 tháng gần nhất" - theo
 * spec.json mục 3.3.1, on_thi dùng Y HỆT 2 nhãn dropdown này nên anchor cũ áp dụng đúng không cần
 * sửa). Nếu sau này on_thi cần hành vi khác, TÁCH riêng lúc đó - không tách trước khi có bằng chứng
 * cần thiết.
 *
 * CHƯA VERIFY TRÊN THIẾT BỊ THẬT (xem ghi chú đầu onThiUiList.js) - khung sẵn sàng chạy ngay khi có
 * app thật + tài khoản có đề ôn thi, nhưng các hằng số parser cần đối chiếu `maestro hierarchy` thật
 * trước khi tin tưởng kết quả FOUND/NOT_FOUND cho 1 lượt chạy có ý nghĩa.
 *
 * @typedef {Object} DeThiTarget
 * @property {string} title
 * @property {?string} [dueDateDM] - "DD/MM", optional nhưng NÊN CÓ nếu title có thể trùng.
 * @property {?string} [cta]
 */

const DEFAULT_MAX_SCROLLS = 40;

function matchesTarget(card, target) {
  if (card.title !== target.title) return false;
  if (target.dueDateDM && normalizeDueDateDM(card.dueDate) !== target.dueDateDM) return false;
  if (target.cta && card.cta !== target.cta) return false;
  return true;
}

function dedupIdentity(card) {
  return `${card.title}|${card.dueDate ?? ""}|${card.cta}`;
}

/**
 * @param {import("../../bai_tap/discovery/findAssignment.js").AssignmentBridge} bridge
 * @param {DeThiTarget} target
 * @param {{ maxScrolls?: number }} [options]
 * @returns {Promise<
 *   | { status: "FOUND", card: Object, scrollCount: number, diagnostics: string }
 *   | { status: "AMBIGUOUS", matches: Object[], scrollCount: number, diagnostics: string }
 *   | { status: "NOT_FOUND", reason: "PROGRESS_STALLED"|"MAX_SCROLLS_REACHED", scrollCount: number, diagnostics: string }
 *   | { status: "ERROR", reason: string, scrollCount: number, diagnostics: string }
 * >}
 */
export async function findDeThi(bridge, target, { maxScrolls = DEFAULT_MAX_SCROLLS } = {}) {
  if (!target?.title) {
    throw new Error("findDeThi() cần target.title (identity tối thiểu - xem docblock).");
  }

  const result = await runSearchStateMachine(bridge, {
    target,
    collectNodes: collectTextNodesWithBoundsInsideScrollableList,
    parseVisibleCards: (nodes, parserState) => {
      const parsed = parseOnThiCardsWithDetail(nodes, { sectionSeen: parserState.sectionSeen });
      return { cards: parsed.cards, parserState: { sectionSeen: parsed.sectionSeen } };
    },
    matchesTarget,
    dedupIdentity,
    maxScrolls,
  });

  if (result.status === "FOUND")
    return { status: "FOUND", scrollCount: result.scrollsUsed, card: result.card, diagnostics: result.diagnostics, lowConfidenceCount: result.lowConfidenceCount, unresolvedGapSteps: result.unresolvedGapSteps };
  if (result.status === "AMBIGUOUS")
    return { status: "AMBIGUOUS", scrollCount: result.scrollsUsed, matches: result.matches, diagnostics: result.diagnostics, lowConfidenceCount: result.lowConfidenceCount, unresolvedGapSteps: result.unresolvedGapSteps };
  if (result.status === "ERROR") return { status: "ERROR", scrollCount: result.scrollsUsed, reason: result.reason, diagnostics: result.diagnostics };
  const reason = result.status === "MAX_SCROLLS_REACHED" ? "MAX_SCROLLS_REACHED" : result.reason;
  return { status: "NOT_FOUND", scrollCount: result.scrollsUsed, reason, diagnostics: result.diagnostics, lowConfidenceCount: result.lowConfidenceCount, unresolvedGapSteps: result.unresolvedGapSteps };
}

/**
 * Tap CTA của 1 card đã `findDeThi()` trả về FOUND - CÙNG kỹ thuật tap-bằng-toạ-độ đã verify thật
 * ở findAssignment.js#tapFoundCard() (né lỗi tap-nhầm-card-trùng-lặp của selector `below`).
 * @param {import("../../bai_tap/discovery/findAssignment.js").AssignmentBridge} bridge
 * @param {{title:string, cta:string, ctaBounds:?Object}} card
 */
export async function tapFoundDeCard(bridge, card) {
  if (card.ctaBounds) {
    const point = centerPoint(card.ctaBounds);
    return bridge.runSteps([{ tapOn: { point: `${point.x},${point.y}` } }]);
  }
  return bridge.runSteps([{ tapOn: { below: card.title, text: card.cta } }]);
}

export { normalizeDueDateDM };
export const scrollToTop = scrollToTopHomeworkList;
