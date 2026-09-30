import {
  collectTextNodesWithBoundsInsideScrollableList,
  parseHomeworkCardsWithDetail,
  centerPoint,
} from "./homeworkUiList.js";
import { runSearchStateMachine } from "./assignmentSearchEngine.js";

/**
 * findAssignment() - cơ chế TÌM 1 assignment CỤ THỂ trong danh sách "Bài tập", DÙNG CHUNG cho toàn
 * bộ homework automation, KHÔNG phụ thuộc số lượng assignment trong danh sách.
 *
 * TẠI SAO CẦN FILE NÀY (không phải thêm 1 tham số cho `scrollUntilVisible`): xem lịch sử sửa lỗi
 * trong flows/helpers/locate-assignment-card.yaml (6 lần "fix" liên tiếp: tăng speed, tăng
 * timeout, đổi scrollUntilVisible -> repeat.while, chỉnh biên độ swipe, đổi anchor điều kiện dừng -
 * KHÔNG lần nào sửa được root cause). Root cause thật: `scrollUntilVisible` tự quyết định "hết danh
 * sách" bằng cách SO SÁNH nội dung màn hình giữa 2 lượt cuộn - danh sách thật có nhiều card liên
 * tiếp TRÙNG HỆT title+Hạn nộp (room test tự động cùng ngày mặc định cùng hạn nộp) khiến so sánh đó
 * bị đánh lừa, dừng cuộn SỚM. Selector `below` cũng không có biên trên nên có thể khớp nhầm hàng
 * xóm của 1 card trùng lặp. Maestro `runScript` chạy trong JS engine sandbox riêng (KHÔNG phải
 * Node, không `require`, không đọc được hierarchy - xác nhận qua flows/bai_tap/hw03-verify-filter-
 * dates.js dòng 14 + automation/bai_tap/runtime/homeworkRandomE2E.js dòng 24) nên cơ chế đúng đắn
 * BẮT BUỘC phải sống ở Node, lái Maestro qua bridge/session (giống kiến trúc discovery/
 * homeworkUiList.js đã có, KHÔNG phải kiến trúc mới) - không thể vá trong 1 file `.yaml` thuần.
 *
 * THUẬT TOÁN (Phase 1, 2026-09-30 - xem assignmentSearchEngine.js): TÌM KIẾM/SCROLL/PROGRESS-
 * DETECTION giờ SỐNG Ở `runSearchStateMachine()` (assignmentSearchEngine.js), DÙNG CHUNG với
 * `locateSpecificCompletedCandidate()` (locateCompletedCandidate.js) - file này chỉ còn cung cấp
 * PARSER (`parseHomeworkCardsWithDetail`) + MATCHER (`matchesTarget`) + dedupIdentity riêng cho card
 * CHƯA làm. Tóm tắt thuật toán (chi tiết đầy đủ + lý do root cause xem docblock
 * `assignmentSearchEngine.js`): đọc hierarchy -> parse card -> khớp target? (đúng 1 khớp: FOUND,
 * dừng ngay; ≥2 khớp: AMBIGUOUS, dừng ngay, KHÔNG tự chọn; 0 khớp: cuộn -> chờ ổn định -> đọc lại ->
 * lặp). Phát hiện "cuộn không tiến triển" giờ dùng `viewportSignature` ĐA TÍN HIỆU (nội dung + vị
 * trí Y + số node thô, KHÔNG PHẢI 1 chuỗi fingerprint text đơn) + LUÔN thử 2 chiến lược gesture khác
 * BẢN CHẤT trước khi kết luận bất cứ điều gì - KHÔNG BAO GIỜ tự đoán APP_FROZEN/END_OF_LIST khi
 * thiếu bằng chứng độc lập (trả `PROGRESS_STALLED` thay vì đoán).
 *
 * IDENTITY: title BẮT BUỘC + dueDateDM ("DD/MM", optional) + cta (optional) - dueDateDM lấy từ
 * HomeworkModel.deadline.endTime qua `homeworkModel.js#isoToDueDateDM()`. Không có ID nào khác lộ
 * ra trên UI (xem homeworkModel.js - room.id chỉ có qua API, không hiển thị trên card).
 *
 * @typedef {Object} AssignmentTarget
 * @property {string} title
 * @property {?string} [dueDateDM] - "DD/MM", optional nhưng NÊN CÓ nếu title có thể trùng.
 * @property {?string} [cta]
 *
 * @typedef {Object} AssignmentBridge - interface tối thiểu findAssignment() cần, thoả mãn CẢ
 *   MaestroBridge (hierarchy() SYNC) LẪN adapter bọc MaestroMcpSession (hierarchy() ASYNC) - `await`
 *   1 giá trị không phải Promise vẫn hoạt động đúng nên cùng 1 code path chạy được cả 2 backend.
 * @property {function(): (Object|Promise<Object>)} hierarchy
 * @property {function(Array<Object|string>): Promise<{success:boolean, error?:string}>} runSteps
 */

const DEFAULT_MAX_SCROLLS = 40;

/** "Hôm nay" - THẬT xác nhận 2026-09-14: card hạn nộp đúng ngày hiện tại render "Hạn nộp Hôm nay"
 * (không có DD/MM) - quy đổi về DD/MM hôm nay để so khớp được với dueDateDM caller truyền vào
 * (caller luôn tính dueDateDM bằng DD/MM cụ thể, kể cả khi hạn nộp = hôm nay). */
function todayDdMm() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

export function normalizeDueDateDM(dueDateText) {
  if (!dueDateText) return null;
  const stripped = dueDateText
    .replace(/^Hạn nộp\s*/, "")
    .replace(/\s*\(QUÁ HẠN\)\s*$/, "")
    .trim();
  return stripped === "Hôm nay" ? todayDdMm() : stripped;
}

function matchesTarget(card, target) {
  if (card.title !== target.title) return false;
  if (target.dueDateDM && normalizeDueDateDM(card.dueDate) !== target.dueDateDM) return false;
  if (target.cta && card.cta !== target.cta) return false;
  return true;
}

// dedupIdentity RỘNG (không phải match identity - xem matchesTarget() ở trên) - dùng để engine đếm
// "đã thấy bao nhiêu card phân biệt" (seenAssignments, contract Phase 1 mục 9) cho diagnostics, KHÔNG
// ảnh hưởng quyết định FOUND/AMBIGUOUS/NOT_FOUND.
function dedupIdentity(card) {
  return `${card.title}|${card.dueDate ?? ""}|${card.cta}`;
}

/**
 * @param {AssignmentBridge} bridge
 * @param {AssignmentTarget} target
 * @param {{ maxScrolls?: number }} [options]
 * @returns {Promise<
 *   | { status: "FOUND", card: Object, scrollCount: number, diagnostics: string }
 *   | { status: "AMBIGUOUS", matches: Object[], scrollCount: number, diagnostics: string }
 *   | { status: "NOT_FOUND", reason: "PROGRESS_STALLED"|"MAX_SCROLLS_REACHED", scrollCount: number, diagnostics: string }
 *   | { status: "ERROR", reason: string, scrollCount: number, diagnostics: string }
 * >}
 *
 * PHASE 1 (assignment-search-engine) - CHUYỂN sang gọi runSearchStateMachine() dùng CHUNG với
 * locateSpecificCompletedCandidate() (assignmentSearchEngine.js) thay vì tự lặp fingerprint/
 * recovery-swipe RIÊNG (bản cũ, đã DRIFT khỏi bản trong locateCompletedCandidate.js - waitForAnimationToEnd
 * 800ms vs 1200ms - chính là bằng chứng SỐNG cho việc hợp nhất). THUẬT TOÁN/EVIDENCE bên trong đã đổi
 * (xem assignmentSearchEngine.js docblock: viewportSignature đa tín hiệu, 2 gesture strategy khác
 * BẢN CHẤT, PROGRESS_STALLED thay vì đoán NO_PROGRESS/END_OF_LIST) - `reason` trả về giờ là
 * "PROGRESS_STALLED"/"MAX_SCROLLS_REACHED" thay vì "NO_PROGRESS"/"END_OF_LIST" cũ. Public SHAPE
 * (status/scrollCount/card/matches/reason/diagnostics) giữ NGUYÊN - caller hiện có
 * (HomeworkNavigationEngine._locateAssignmentOrThrow(), throw generic cho mọi status khác FOUND)
 * KHÔNG cần sửa gì.
 */
export async function findAssignment(bridge, target, { maxScrolls = DEFAULT_MAX_SCROLLS } = {}) {
  if (!target?.title) {
    throw new Error("findAssignment() cần target.title (identity tối thiểu - xem docblock).");
  }

  const result = await runSearchStateMachine(bridge, {
    target,
    collectNodes: collectTextNodesWithBoundsInsideScrollableList,
    parseVisibleCards: (nodes, parserState) => {
      const parsed = parseHomeworkCardsWithDetail(nodes, { sectionSeen: parserState.sectionSeen });
      return { cards: parsed.cards, parserState: { sectionSeen: parsed.sectionSeen } };
    },
    matchesTarget,
    dedupIdentity,
    maxScrolls,
  });

  if (result.status === "FOUND") return { status: "FOUND", scrollCount: result.scrollsUsed, card: result.card, diagnostics: result.diagnostics };
  if (result.status === "AMBIGUOUS") return { status: "AMBIGUOUS", scrollCount: result.scrollsUsed, matches: result.matches, diagnostics: result.diagnostics };
  if (result.status === "ERROR") return { status: "ERROR", scrollCount: result.scrollsUsed, reason: result.reason, diagnostics: result.diagnostics };
  // NOT_FOUND (reason=PROGRESS_STALLED) hoặc MAX_SCROLLS_REACHED (tầng engine) - CẢ 2 map về
  // status:"NOT_FOUND" ở public API cũ (chưa từng có status MAX_SCROLLS_REACHED riêng), NHƯNG
  // `reason` PHẢI phân biệt rõ 2 trường hợp này (KHÔNG BAO GIỜ diễn giải MAX_SCROLLS_REACHED thành
  // PROGRESS_STALLED/END_OF_LIST - đúng ràng buộc gốc).
  const reason = result.status === "MAX_SCROLLS_REACHED" ? "MAX_SCROLLS_REACHED" : result.reason;
  return { status: "NOT_FOUND", scrollCount: result.scrollsUsed, reason, diagnostics: result.diagnostics };
}

// Anchor GIỐNG HỆT `readOverallProgress()` (e2e-teacher-assign-full-scored-target5.mjs
// OVERALL_PROGRESS_BELOW_PATTERN) - dòng filter "2 tuần gần nhất"/"1 tháng gần nhất" nằm NGAY TRÊN
// section "Bài tập về nhà" đầu tiên, dùng làm anchor "đỉnh danh sách" chung, không riêng 1 màn.
const TOP_ANCHOR_REGEX = ".*(2 tuần gần nhất|1 tháng gần nhất).*";
const DEFAULT_SCROLL_TO_TOP_TIMEOUT_MS = 30000;

/**
 * scrollToTop() - cuộn danh sách "Bài tập" về ĐẦU THẬT.
 *
 * BUG THẬT đã xác nhận (2026-08-21, script chẩn đoán standalone `test-scroll-methods.mjs` +
 * `dump-scrollable-nodes.mjs`, ảnh chụp màn hình thật): sau khi tab "Bài tập" đã từng bị cuộn rất
 * sâu (Android giữ nguyên vị trí cuộn theo tab khi rời/quay lại), app đứng NGAY GIỮA khu vực "Kiến
 * thức trong bài" (carousel "Unit 3: Community Service"/"Unit 9: ..." - NẰM CÙNG 1 vùng scrollable
 * VỚI các card Homework, không phải màn khác). ĐO THẬT: 3 lượt swipe point-based biên độ lớn
 * ("50%,90%"->"50%,10%") liên tiếp KHÔNG có tác dụng gì (fingerprint đứng yên NGUYÊN VẸN) - gesture
 * `swipe` thô bị "nuốt" ở vị trí này (rất có thể do carousel con bên trong xử lý touch riêng),
 * fingerprint "không đổi" ở đây là FALSE PLATEAU (do gesture vô tác dụng, KHÔNG PHẢI vì đã ở đỉnh) -
 * đây là lý do bản swipe/fingerprint tự chế TRƯỚC ĐÓ của hàm này báo `atTop:true` SAI (2 lượt, không
 * đổi) trong khi thực tế vẫn còn kẹt sâu trong "Kiến thức trong bài". Ngược lại, `scrollUntilVisible`
 * GỐC của Maestro (đã dùng khắp codebase, có cơ chế cuộn+chờ+thử lại riêng đáng tin cậy hơn 1 lệnh
 * `swipe` đơn) với `direction: "UP"` nhắm thẳng anchor "2 tuần gần nhất"/"1 tháng gần nhất" THÀNH
 * CÔNG NGAY, đưa đúng về "Bài tập về nhà" - ĐÃ XÁC NHẬN THẬT. SỬA: dùng LẠI cơ chế
 * `scrollUntilVisible` có sẵn thay vì tự chế 1 vòng lặp swipe/fingerprint riêng (không phát minh cơ
 * chế mới - đúng yêu cầu "reuse existing scroll optimization").
 *
 * `findAssignment()` phía dưới CHỈ cuộn 1 CHIỀU (xuống) nên nếu xuất phát điểm đã ở SAU (dưới) target
 * thật (như trạng thái kẹt mô tả ở trên), sẽ KHÔNG BAO GIỜ tìm lại được - báo NOT_FOUND/END_OF_LIST
 * dù card có thật và đang hiển thị ở phía TRÊN vị trí hiện tại. Đây CHÍNH XÁC là nguyên nhân case
 * "làm lại 1 bài đã có điểm" (room 0a8b7074-...) liên tục BLOCKED OPEN_EXERCISE_AMBIGUOUS "sau 0
 * lượt" xuyên suốt các lần chạy trước - KHÔNG phải do CTA khó tìm. `scrollToTop()` PHẢI được gọi
 * ngay trước `findAssignment()` để đảm bảo tiền điều kiện "xuất phát từ đỉnh danh sách".
 * @param {AssignmentBridge} bridge
 * @param {{ timeout?: number }} [options]
 * @returns {Promise<{ atTop: true } | { atTop: false, reason: string }>}
 */
export async function scrollToTop(bridge, { timeout = DEFAULT_SCROLL_TO_TOP_TIMEOUT_MS } = {}) {
  const result = await bridge.runSteps([
    { scrollUntilVisible: { element: { text: TOP_ANCHOR_REGEX }, direction: "UP", timeout } },
  ]);
  if (!result.success) return { atTop: false, reason: result.error ?? "scrollUntilVisible(direction=UP) thất bại." };
  return { atTop: true };
}

/**
 * Tap CTA của 1 card đã `findAssignment()` trả về FOUND - dùng toạ độ thật (`ctaBounds`) thay vì
 * lại nhờ Maestro khớp selector text (`below`/`text`) - selector đó là NGUỒN của lỗi "tap nhầm card
 * trùng lặp" đã ghi nhận (xem flows/helpers/open-exercise.yaml). Fallback về selector text CHỈ khi
 * node CTA hiếm khi thiếu `bounds` hợp lệ (chưa gặp thật, nhưng không nên throw cứng cho trường hợp
 * hiếm này).
 * @param {AssignmentBridge} bridge
 * @param {{title:string, cta:string, ctaBounds:?Object}} card
 */
export async function tapFoundCard(bridge, card) {
  if (card.ctaBounds) {
    const point = centerPoint(card.ctaBounds);
    return bridge.runSteps([{ tapOn: { point: `${point.x},${point.y}` } }]);
  }
  return bridge.runSteps([{ tapOn: { below: card.title, text: card.cta } }]);
}
