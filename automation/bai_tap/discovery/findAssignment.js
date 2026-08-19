import {
  collectTextNodesWithBoundsInsideScrollableList,
  parseHomeworkCardsWithDetail,
  centerPoint,
} from "./homeworkUiList.js";

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
 * THUẬT TOÁN (đúng yêu cầu target-driven search, không giả định vị trí):
 *   đọc hierarchy -> parse card -> khớp target?
 *     -> đúng 1 khớp: FOUND, dừng ngay (không cuộn thêm)
 *     -> ≥2 khớp: AMBIGUOUS, dừng ngay (không tự đoán chọn 1 trong số đó)
 *     -> 0 khớp: cuộn 1 bước vừa phải -> chờ ổn định -> đọc lại -> lặp
 *   Phát hiện "cuộn không tiến triển" bằng fingerprint TOÀN BỘ card đang thấy (không phải so sánh
 *   riêng target) - giống hệt cơ chế ĐÃ HOẠT ĐỘNG ĐÚNG trong
 *   `homeworkUiList.js#collectVisibleHomeworkCards()` (dừng khi 2 lượt liên tiếp không có card
 *   mới), chỉ khác đây dừng khi 2 lượt liên tiếp fingerprint TOÀN BỘ giống hệt nhau (kể cả không có
 *   card mới lẫn không mất card cũ - dấu hiệu list đứng yên hoàn toàn, không phải chỉ "hết card
 *   MỚI"). Không so sánh nội dung để "đoán hết danh sách" như scrollUntilVisible - chỉ dùng để biết
 *   "còn đổi hay không", quyết định found/not-found luôn dựa vào chính target có khớp hay không.
 *
 * IDENTITY: title BẮT BUỘC + dueDateDM ("DD/MM", optional) + cta (optional) - dueDateDM lấy từ
 * HomeworkModel.deadline.endTime qua `homeworkModel.js#isoToDueDateDM()`. Không có ID nào khác lộ
 * ra trên UI (xem homeworkModel.js - room.id chỉ có qua API, không hiển thị trên card).
 *
 * LOADING INDICATOR (yêu cầu #9): ĐÃ KIỂM TRA, app KHÔNG lộ ra 1 testID/text riêng cho "đang tải
 * thêm trang" trong danh sách Bài tập (flows/helpers/open-tab-homework.yaml chỉ chờ NỘI DUNG thật
 * xuất hiện, không có selector spinner) - không có gì để hardcode. `waitForAnimationToEnd` sau mỗi
 * swipe + đọc lại hierarchy cho fingerprint là cơ chế thay thế thực tế: nếu list đang load/settle,
 * fingerprint đổi ở lượt đọc kế tiếp; nếu KHÔNG đổi dù đã cuộn thật, coi là NO_PROGRESS/END_OF_LIST
 * (xem bên dưới) - không search/tap khi chưa xác nhận fingerprint ổn định.
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

const NORMAL_SWIPE = { start: "50%,80%", end: "50%,25%", duration: 400 };
// Biên độ/tốc độ RỘNG HƠN NORMAL_SWIPE, dùng đúng 1 lần khi phát hiện plateau - mục đích loại trừ
// khả năng "chỉ là 1 lượt animation/settle chưa xong" trước khi kết luận NO_PROGRESS/END_OF_LIST.
const RECOVERY_SWIPE = { start: "50%,90%", end: "50%,10%", duration: 700 };
const DEFAULT_MAX_SCROLLS = 40;

function normalizeDueDateDM(dueDateText) {
  if (!dueDateText) return null;
  return dueDateText
    .replace(/^Hạn nộp\s*/, "")
    .replace(/\s*\(QUÁ HẠN\)\s*$/, "")
    .trim();
}

function matchesTarget(card, target) {
  if (card.title !== target.title) return false;
  if (target.dueDateDM && normalizeDueDateDM(card.dueDate) !== target.dueDateDM) return false;
  if (target.cta && card.cta !== target.cta) return false;
  return true;
}

function fingerprint(cards) {
  return cards.map((c) => `${c.title}|${c.dueDate ?? ""}|${c.cta}`).join("||");
}

function cardSummaryLine(card) {
  return `- ${card.title} | ${card.dueDate ?? "(không có hạn nộp)"} | CTA=${card.cta}`;
}

function formatDiagnostics({ target, scrollCount, previousCards, currentCards, status, reason }) {
  const targetLines = [`Title = ${target.title}`];
  if (target.dueDateDM) targetLines.push(`Due date = ${target.dueDateDM}`);
  if (target.cta) targetLines.push(`CTA = ${target.cta}`);

  const listOrEmpty = (cards, emptyLabel) => (cards.length ? cards.map(cardSummaryLine).join("\n") : emptyLabel);

  const lines = [
    "TARGET:",
    ...targetLines,
    "",
    "SCROLL:",
    String(scrollCount),
    "",
    "PREVIOUS VISIBLE STATE:",
    listOrEmpty(previousCards, "(chưa cuộn lần nào trước đó)"),
    "",
    "LAST VISIBLE STATE:",
    listOrEmpty(currentCards, "(không có card hợp lệ nào đang hiển thị)"),
    "",
    "PROGRESS AFTER LAST SCROLL:",
    fingerprint(previousCards) !== fingerprint(currentCards) ? "CÓ thay đổi" : "KHÔNG thay đổi (list không tiến triển)",
    "",
    "STATUS:",
    status,
  ];
  if (reason) lines.push("", "STOP REASON:", reason);
  return lines.join("\n");
}

/**
 * @param {AssignmentBridge} bridge
 * @param {AssignmentTarget} target
 * @param {{ maxScrolls?: number }} [options]
 * @returns {Promise<
 *   | { status: "FOUND", card: Object, scrollCount: number, diagnostics: string }
 *   | { status: "AMBIGUOUS", matches: Object[], scrollCount: number, diagnostics: string }
 *   | { status: "NOT_FOUND", reason: "END_OF_LIST"|"NO_PROGRESS", scrollCount: number, diagnostics: string }
 *   | { status: "ERROR", reason: string, scrollCount: number, diagnostics: string }
 * >}
 */
export async function findAssignment(bridge, target, { maxScrolls = DEFAULT_MAX_SCROLLS } = {}) {
  if (!target?.title) {
    throw new Error("findAssignment() cần target.title (identity tối thiểu - xem docblock).");
  }

  let sectionSeen = false;
  const readCards = async () => {
    const tree = await bridge.hierarchy();
    const nodes = collectTextNodesWithBoundsInsideScrollableList(tree, []);
    const parsed = parseHomeworkCardsWithDetail(nodes, { sectionSeen });
    sectionSeen = parsed.sectionSeen;
    return parsed.cards;
  };

  const swipe = async (step) => {
    const result = await bridge.runSteps([{ swipe: step }, { waitForAnimationToEnd: { timeout: 800 } }]);
    if (!result.success) throw new Error(`Cuộn thất bại: ${result.error}`);
  };

  let scrollCount = 0;
  let previousCards = [];
  let currentCards = await readCards();
  let recoveryAttempted = false;

  const finish = (status, extra = {}) => ({
    status,
    scrollCount,
    ...extra,
    diagnostics: formatDiagnostics({
      target,
      scrollCount,
      previousCards,
      currentCards,
      status,
      reason: extra.reason ?? null,
    }),
  });

  // Không giả định target nằm ở viewport thứ N - luôn kiểm tra viewport HIỆN TẠI trước, chỉ cuộn
  // khi thật sự chưa thấy (yêu cầu #3 TARGET-DRIVEN SEARCH).
  while (true) {
    const matches = currentCards.filter((card) => matchesTarget(card, target));
    if (matches.length === 1) return finish("FOUND", { card: matches[0] });
    if (matches.length > 1) return finish("AMBIGUOUS", { matches });
    if (scrollCount >= maxScrolls) return finish("NOT_FOUND", { reason: "END_OF_LIST" });

    const fingerprintBeforeScroll = fingerprint(currentCards);
    try {
      await swipe(NORMAL_SWIPE);
    } catch (err) {
      return finish("ERROR", { reason: err.message });
    }
    scrollCount++;
    previousCards = currentCards;
    currentCards = await readCards();

    if (fingerprint(currentCards) !== fingerprintBeforeScroll) {
      recoveryAttempted = false; // list vẫn đang tiến triển thật - "ngân sách" recovery được nạp lại.
      continue;
    }

    // List đứng yên sau 1 lượt cuộn thật - KHÔNG kết luận ngay (có thể chỉ là animation/settle
    // chưa xong) - thử recovery HỢP LÝ ĐÚNG 1 LẦN (yêu cầu #6), không lặp lại vô hạn.
    if (recoveryAttempted) {
      // scrollCount<=2 nghĩa là plateau xảy ra ngay từ (gần) đầu, trước khi list kịp tiến triển
      // thật sự - nhiều khả năng do UI kẹt/chưa settle hơn là "đã cuộn hết 1 danh sách dài" ->
      // NO_PROGRESS. Ngược lại (đã cuộn qua nhiều màn hình rồi mới đứng yên) -> END_OF_LIST.
      return finish("NOT_FOUND", { reason: scrollCount <= 2 ? "NO_PROGRESS" : "END_OF_LIST" });
    }
    recoveryAttempted = true;
    try {
      await swipe(RECOVERY_SWIPE);
    } catch (err) {
      return finish("ERROR", { reason: err.message });
    }
    scrollCount++;
    previousCards = currentCards;
    currentCards = await readCards();
    if (fingerprint(currentCards) === fingerprintBeforeScroll) {
      return finish("NOT_FOUND", { reason: scrollCount <= 3 ? "NO_PROGRESS" : "END_OF_LIST" });
    }
    recoveryAttempted = false;
  }
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
