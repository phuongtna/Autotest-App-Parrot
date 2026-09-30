/**
 * assignmentSearchEngine.js - state machine CHUNG cho việc tìm 1 assignment/card cụ thể trong danh
 * sách "Bài tập" bằng cách cuộn+đọc hierarchy lặp lại, DÙNG CHUNG cho cả `findAssignment.js` (card
 * CHƯA làm) và `locateCompletedCandidate.js` (card ĐÃ hoàn thành, cta="Làm lại").
 *
 * NGUỒN GỐC: Phase 1 của kiến trúc mới, đặc tả đầy đủ trong (không nằm trong repo, tài liệu review
 * ngoài luồng) `assignment_search_final_implementation_contract.md`, mục 4/5/6/12/18. File này CHỈ
 * implement ĐÚNG phạm vi Phase 1 đã chốt ở đó - KHÔNG thêm `scrollUntilVisible`, KHÔNG adaptive
 * amplitude, KHÔNG binary search, KHÔNG OS-level liveness probe (Probe 3 hoãn Phase 3).
 *
 * TẠI SAO CẦN FILE NÀY (không viết lại logic trong từng caller): `findAssignment()` và
 * `locateSpecificCompletedCandidate()` trước đây có 2 bản copy ĐỘC LẬP của CÙNG 1 thuật toán scroll/
 * progress-detection (NORMAL_SWIPE/RECOVERY_SWIPE trùng giá trị nhưng
 * `waitForAnimationToEnd` lệch nhau 800ms/1200ms - bằng chứng SỐNG cho thấy 2 bản copy tay đã DRIFT
 * ngoài ý muốn) - hợp nhất phần state-machine/progress-detection vào 1 nơi DUY NHẤT, PARSER/MATCHER
 * vẫn giữ riêng (2 cấu trúc UI card khác nhau thật, không nên gộp - xem contract mục 2.G).
 *
 * ROOT CAUSE được sửa ở đây (tóm tắt, xem dossier/review đầy đủ ở 2 tài liệu ngoài luồng nói trên):
 * thuật toán CŨ dùng ĐÚNG 1 tín hiệu (fingerprint text nối chuỗi) để quyết định "còn tiến triển hay
 * không", rồi dùng `scrollCount` (một con số ĐẾM, không phải BẰNG CHỨNG) để đoán tiếp giữa
 * NO_PROGRESS/END_OF_LIST - khiến "hết danh sách thật", "gesture bị carousel nuốt", "app treo",
 * "UI chưa kịp render" đều tạo ra CÙNG 1 input và bị xử lý NHƯ NHAU. File này thay bằng:
 *   1. `viewportSignature` đa tín hiệu (nội dung + vị trí Y + số node thô) thay vì 1 chuỗi text.
 *   2. Recovery LUÔN thử 2 chiến lược gesture KHÁC BIỆT VỀ BẢN CHẤT (không phải lặp lại cùng 1 loại
 *      gesture với biên độ lớn hơn - đã CHỨNG MINH THẤT BẠI thật, xem docblock `scrollToTop()` trong
 *      findAssignment.js) trước khi kết luận bất cứ điều gì.
 *   3. KHÔNG BAO GIỜ đoán `APP_FROZEN` hay `END_OF_LIST` khi thiếu bằng chứng độc lập (Probe 3/OS-
 *      level, CHƯA triển khai ở Phase 1) - trả về `PROGRESS_STALLED` (confidence LOW), một kết cục
 *      TRUNG THỰC thay vì đoán sai 1 trong 2 hướng.
 *   4. `maxScrolls` CHỈ là safety limit (status `MAX_SCROLLS_REACHED` RIÊNG BIỆT), không bao giờ được
 *      diễn giải thành bằng chứng "đã hết danh sách".
 *
 * @typedef {Object} SearchTarget - opaque với engine, chỉ truyền lại cho `matchesTarget`/`dedupIdentity`.
 *
 * @typedef {Object} EngineCard - hình dạng card cụ thể do `parseVisibleCards` của TỪNG wrapper quyết
 *   định (findAssignment.js dùng {title,titleBounds,dueDate,cta,ctaBounds,...}, locateCompletedCandidate.js
 *   dùng {title,titleBounds,cta,ctaBounds,scoreText,dueDateBefore,...}) - engine KHÔNG giả định field
 *   nào ngoài `title` (dùng cho `cardIdentityString()` chung, xem bên dưới) + optional `titleBounds`.
 */

/** Strategy A - gesture MẶC ĐỊNH, GIỮ NGUYÊN giá trị NORMAL_SWIPE đã proven ở quy mô nhỏ (không đổi
 * so với findAssignment.js/locateCompletedCandidate.js trước đây). */
const STRATEGY_A = { start: "50%,80%", end: "50%,25%", duration: 400 };

/** Strategy B - CHỈ dùng trong RECOVERING, sau khi Strategy A + settle-retry đều NO_PROGRESS. Toạ độ
 * X lệch khỏi trung tâm (20% thay vì 50%) - [ASSUMPTION, xem contract mục 6]: carousel "Kiến thức
 * trong bài" (bug thật đã xác nhận trong docblock scrollToTop(), findAssignment.js) nhiều khả năng
 * bắt touch ở vùng trung tâm màn hình; dịch điểm chạm ra xa tâm tăng khả năng rơi vào vùng scrollable
 * CHA (danh sách Homework) thay vì carousel con. GIÁ TRỊ "20%" CẦN BENCHMARK để xác nhận/hiệu chỉnh
 * (contract mục 6, mục 20) - KHÔNG tự đổi giá trị này khi chưa có benchmark xác nhận ngược lại. */
const STRATEGY_B = { start: "20%,80%", end: "20%,25%", duration: 400 };

/** Thống nhất `waitForAnimationToEnd` timeout (BLOCKER 5 của contract) - trước đây findAssignment.js
 * dùng 800ms trong khi locateCompletedCandidate.js VÀ homeworkUiList.js dùng 1200ms (2/3 phiếu bầu).
 * Chọn giá trị AN TOÀN HƠN (chờ lâu hơn không bao giờ tạo kết luận SAI, chỉ tốn thêm thời gian) theo
 * đúng thứ tự ưu tiên Correctness > ... > Speed - không cần benchmark để quyết định điều này. */
const WAIT_AFTER_SCROLL_MS = 1200;

/** Ngưỡng Y-shift (pixel) để coi "cùng 1 card dịch chuyển" là STRONG_PROGRESS thật (không phải
 * nhiễu đo đạc/làm tròn). [ASSUMPTION, BENCHMARK NEEDED - contract mục 3/4/20]: chưa có số đo thật về
 * chiều cao card/độ nhạy bounds trên thiết bị đang dùng. Giá trị 10px là điểm khởi đầu BẢO THỦ (đủ
 * lớn để loại nhiễu làm tròn toạ độ, đủ nhỏ để không bỏ sót dịch chuyển thật rất nông) - cần hiệu
 * chỉnh sau khi có benchmark, KHÔNG phải quyết định cuối cùng. */
const MIN_MEANINGFUL_Y_SHIFT_PX = 10;

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Identity NỘI DUNG dùng cho `viewportSignature.cardIdentities` - công thức GENERIC xử lý ĐƯỢC cả
 * 2 hình dạng card hiện có (not-done: dueDate/score; completed: dueDateBefore/scoreText) bằng
 * optional-chaining fallback, đúng theo contract mục 4 (cột "Source" của `cardIdentities`). Đây
 * KHÔNG PHẢI dedup identity (mục 9 contract, do wrapper tự truyền qua `dedupIdentity`) - chỉ dùng để
 * so sánh NỘI DUNG viewport giữa 2 lượt đọc.
 * @param {EngineCard} card
 */
function cardIdentityString(card) {
  const secondary = card.dueDate ?? card.dueDateBefore ?? "";
  const tertiary = card.score ?? card.scoreText ?? "";
  return `${card.title}|${secondary}|${card.cta}|${tertiary}`;
}

/**
 * @param {EngineCard[]} cards
 * @param {number} rawNodeCount - `nodes.length` TOÀN BỘ (không chỉ card đã parse) - xem contract mục 4.
 * @returns {{cardIdentities: string[], topCard: ?{title:string, y: ?number}, bottomCard: ?{title:string, y: ?number}, rawNodeCount: number}}
 */
export function computeViewportSignature(cards, rawNodeCount) {
  const topCard = cards.length ? { title: cards[0].title, y: cards[0].titleBounds?.y1 ?? null } : null;
  const bottomCard = cards.length ? { title: cards.at(-1).title, y: cards.at(-1).titleBounds?.y1 ?? null } : null;
  return {
    cardIdentities: cards.map(cardIdentityString),
    topCard,
    bottomCard,
    rawNodeCount,
  };
}

/**
 * So sánh 2 viewportSignature liên tiếp - trả 1 trong 3 verdict, KHÔNG BAO GIỜ tự leo thẳng lên
 * END_OF_LIST/APP_FROZEN (đó là việc của state machine gọi hàm này, dựa trên NHIỀU lượt gọi + recovery
 * strategy, xem `runSearchStateMachine()`). Xem contract mục 4 cho lý giải từng nhánh (Case A-E).
 * @param {ReturnType<typeof computeViewportSignature>} prev
 * @param {ReturnType<typeof computeViewportSignature>} curr
 * @returns {"STRONG_PROGRESS"|"WEAK_PROGRESS"|"NO_PROGRESS"}
 */
export function compareSignatures(prev, curr) {
  const sameCardSet = arraysEqual(prev.cardIdentities, curr.cardIdentities);
  const sameTopTitle = prev.topCard?.title === curr.topCard?.title;
  const topYShift =
    sameTopTitle && prev.topCard?.y != null && curr.topCard?.y != null ? Math.abs(prev.topCard.y - curr.topCard.y) : null;
  const nodeCountChanged = prev.rawNodeCount !== curr.rawNodeCount;

  // Case A: same cards (cùng topCard.title), Y đổi ĐÁNG KỂ -> chắc chắn đã cuộn thật.
  if (sameTopTitle && topYShift !== null && topYShift > MIN_MEANINGFUL_Y_SHIFT_PX) {
    return "STRONG_PROGRESS";
  }
  // Case B: bộ card đổi hẳn (topCard.title khác NHAU hoặc identity list khác) -> KHÔNG xét Y (vô
  // nghĩa khi so 2 card khác nhau - viewport luôn hiển thị "đầu danh sách hiện tại" ở cùng vùng Y
  // màn hình bất kể cuộn bao xa, xem contract mục 2.A câu 3).
  if (!sameCardSet) {
    return "STRONG_PROGRESS";
  }
  // Case C (nhánh NO_PROGRESS thật): cùng card, Y giống hệt (hoặc không so được), VÀ node count
  // cũng không đổi -> bằng chứng mạnh nhất hiện có cho "đứng yên thật".
  if (!nodeCountChanged && (topYShift === 0 || topYShift === null)) {
    return "NO_PROGRESS";
  }
  // Case C (nhánh WEAK): cùng card, Y giống hệt, nhưng node count đổi (badge/score render trễ...)
  // Case E: chưa đủ dữ liệu bounds để kết luận mạnh theo hướng nào.
  return "WEAK_PROGRESS";
}

/**
 * @typedef {Object} SearchEngineOptions
 * @property {SearchTarget} target
 * @property {function(Object): Array<{text:string, bounds:?Object}>} collectNodes - thu thập node
 *   thô từ cây hierarchy (GIỮ NGUYÊN hàm hiện có của từng wrapper - KHÔNG hợp nhất, xem contract mục 2.G).
 * @property {function(Array<{text:string,bounds:?Object}>, Object): {cards: EngineCard[], parserState: Object}} parseVisibleCards
 * @property {function(EngineCard, SearchTarget): boolean} matchesTarget
 * @property {function(EngineCard): string} dedupIdentity - identity RỘNG dùng để đếm "đã thấy bao
 *   nhiêu card phân biệt" (seenAssignments, contract mục 9) - KHÔNG dùng để quyết định FOUND/AMBIGUOUS
 *   (đó là việc của `matchesTarget`, identity riêng, mạnh hơn - xem contract mục 7/13 "không lẫn 2
 *   loại identity").
 * @property {number} maxScrolls - BẮT BUỘC, safety limit thuần tuý (KHÔNG phải evidence).
 * @property {Array<Object>} [scrollLog] - optional, mảng nhận log từng bước (cùng convention
 *   `scrollLog?.push(...)` đã có sẵn trong locateCompletedCandidate.js - KHÔNG phát minh tham số
 *   logging mới, xem contract mục "Logging").
 */

/**
 * @param {import("./findAssignment.js").AssignmentBridge} bridge
 * @param {SearchEngineOptions} options
 * @returns {Promise<
 *   | {status:"FOUND", card:EngineCard, matches:null, reason:null, confidence:null, scrollsUsed:number, diagnostics:string}
 *   | {status:"AMBIGUOUS", card:null, matches:EngineCard[], reason:null, confidence:null, scrollsUsed:number, diagnostics:string}
 *   | {status:"NOT_FOUND", card:null, matches:null, reason:"PROGRESS_STALLED", confidence:"LOW", scrollsUsed:number, diagnostics:string}
 *   | {status:"MAX_SCROLLS_REACHED", card:null, matches:null, reason:null, confidence:null, scrollsUsed:number, diagnostics:string}
 *   | {status:"ERROR", card:null, matches:null, reason:string, confidence:null, scrollsUsed:number, diagnostics:string}
 * >}
 */
export async function runSearchStateMachine(bridge, options) {
  const { target, collectNodes, parseVisibleCards, matchesTarget, dedupIdentity, scrollLog = null } = options;
  const maxScrolls = options.maxScrolls;
  if (typeof maxScrolls !== "number") {
    // BLOCKER 2 của contract: maxScrolls BẮT BUỘC truyền tường minh ở tầng engine (KHÔNG default
    // ngầm) - lỗi cấu hình phải phát hiện SỚM, không âm thầm dùng 1 giá trị đoán. 2 wrapper public
    // (findAssignment()/locateSpecificCompletedCandidate()) VẪN giữ default riêng của chúng, không
    // đổi hành vi caller hiện có - xem contract Blocker 2.
    throw new TypeError("runSearchStateMachine() cần options.maxScrolls (number) - safety limit bắt buộc, không có default ngầm.");
  }

  const seen = new Map();
  let parserState = {};
  let scrollsUsed = 0;
  let lastCards = [];

  const readCurrent = async () => {
    const tree = await bridge.hierarchy();
    const nodes = collectNodes(tree, []);
    const parsed = parseVisibleCards(nodes, parserState);
    parserState = parsed.parserState;
    lastCards = parsed.cards;
    for (const c of parsed.cards) {
      const id = dedupIdentity(c);
      if (!seen.has(id)) seen.set(id, c);
    }
    return { cards: parsed.cards, signature: computeViewportSignature(parsed.cards, nodes.length) };
  };

  const doSwipe = async (strategy) => {
    const swipeResult = await bridge.runSteps([{ swipe: strategy }]);
    if (!swipeResult.success) return { ok: false, error: swipeResult.error };
    const waitResult = await bridge.runSteps([{ waitForAnimationToEnd: { timeout: WAIT_AFTER_SCROLL_MS } }]);
    if (!waitResult.success) return { ok: false, error: waitResult.error };
    return { ok: true };
  };

  /** Chờ thêm, KHÔNG gửi gesture mới - Probe 1 / R1 settle-retry (contract mục 5/6/7). */
  const waitOnly = async () => {
    const waitResult = await bridge.runSteps([{ waitForAnimationToEnd: { timeout: WAIT_AFTER_SCROLL_MS } }]);
    return waitResult.success;
  };

  const summarizeCards = (cards) =>
    cards.length ? cards.map((c) => `- ${c.title}${c.dueDate ? ` | ${c.dueDate}` : ""}${c.scoreText ? ` | ${c.scoreText}` : ""} | CTA=${c.cta}`).join("\n") : "(không có card hợp lệ nào đang hiển thị)";

  const buildDiagnostics = ({ status, reason, confidence, matches, card }) => {
    const targetDesc = Object.entries(target ?? {})
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    const lines = [
      `TARGET: ${targetDesc}`,
      `SCROLL: ${scrollsUsed}`,
      `SEEN DISTINCT (dedupIdentity): ${seen.size}`,
      `LAST VISIBLE STATE:\n${summarizeCards(lastCards)}`,
      `STATUS: ${status}${reason ? ` / ${reason}` : ""}${confidence ? ` (confidence=${confidence})` : ""}`,
    ];
    if (status === "AMBIGUOUS") {
      lines.push(`AMBIGUOUS MATCHES (${matches.length}): ${matches.map((m) => JSON.stringify(m)).join("; ")}`);
    }
    if (status === "FOUND") {
      lines.push(`FOUND CARD: ${JSON.stringify(card)}`);
    }
    if (reason === "PROGRESS_STALLED") {
      lines.push(
        "WHY DID WE STOP: Strategy A (+ settle-retry) và Strategy B (toạ độ thay thế) đều không tạo " +
          "thay đổi viewport có thể quan sát được. KHÔNG có bằng chứng độc lập (Probe 3/OS-level, chưa " +
          "triển khai ở Phase 1) để phân biệt 'đã hết danh sách thật' khỏi 'app không phản hồi' - " +
          "KHÔNG đoán 1 trong 2 hướng. Cần người vận hành kiểm tra thủ công (xem thiết bị/app thật).",
      );
    }
    return lines.join("\n");
  };

  const finish = (status, extra = {}) => ({
    status,
    card: extra.card ?? null,
    matches: extra.matches ?? null,
    reason: extra.reason ?? null,
    confidence: extra.confidence ?? null,
    scrollsUsed,
    diagnostics: buildDiagnostics({ status, reason: extra.reason ?? null, confidence: extra.confidence ?? null, matches: extra.matches, card: extra.card }),
  });

  const log = (entry) => scrollLog?.push({ scrollIndex: scrollsUsed, ...entry });

  let current = await readCurrent();
  log({ state: "READING", visibleCards: current.cards.length, viewportSignature: current.signature });

  while (true) {
    const matches = current.cards.filter((c) => matchesTarget(c, target));
    if (matches.length === 1) {
      log({ state: "TARGET_FOUND" });
      return finish("FOUND", { card: matches[0] });
    }
    if (matches.length > 1) {
      log({ state: "TARGET_AMBIGUOUS", matchCount: matches.length });
      return finish("AMBIGUOUS", { matches });
    }
    if (scrollsUsed >= maxScrolls) {
      log({ state: "MAX_SCROLLS_REACHED" });
      return finish("MAX_SCROLLS_REACHED");
    }

    // SCROLLING - Strategy A (mặc định, mọi lượt bình thường).
    log({ state: "SCROLLING", strategy: "A" });
    const swipeA = await doSwipe(STRATEGY_A);
    if (!swipeA.ok) return finish("ERROR", { reason: swipeA.error });
    scrollsUsed++;

    const beforeSignature = current.signature;
    current = await readCurrent();
    let verdict = compareSignatures(beforeSignature, current.signature);
    log({ state: "RENDERING", strategy: "A", verdict, viewportSignature: current.signature });

    if (verdict !== "STRONG_PROGRESS") {
      // R1 (settle-retry): chờ thêm, KHÔNG gesture mới, so lại với beforeSignature (pre-Strategy-A) -
      // bắt buộc chạy TRƯỚC KHI coi WEAK_PROGRESS/NO_PROGRESS là plateau thật (contract mục 2.B: gap
      // đã tìm thấy trong pseudocode cũ - không được swipe tiếp mà chưa xác nhận render đã settle).
      await waitOnly();
      current = await readCurrent();
      verdict = compareSignatures(beforeSignature, current.signature);
      log({ state: "RENDERING", strategy: "A", action: "SETTLE_RETRY", verdict, viewportSignature: current.signature });
    }

    if (verdict === "STRONG_PROGRESS") continue; // render-delay đã được xác nhận resolve, hoặc tiến triển thật ngay từ đầu.

    // verdict còn lại (WEAK_PROGRESS hoặc NO_PROGRESS) sau settle-retry: CHƯA đủ bằng chứng progress -
    // chuyển RECOVERING (Strategy B) - KHÔNG BAO GIỜ tự động thành END_OF_LIST/PROGRESS_STALLED ở đây
    // (đúng ràng buộc "WEAK_PROGRESS không được tự động chuyển thành END_OF_LIST").
    log({ state: "RECOVERING", strategy: "B", reason: verdict });
    const beforeRecoverySignature = current.signature;
    const swipeB = await doSwipe(STRATEGY_B);
    if (!swipeB.ok) return finish("ERROR", { reason: swipeB.error });
    scrollsUsed++;

    current = await readCurrent();
    const recoveryVerdict = compareSignatures(beforeRecoverySignature, current.signature);
    log({ state: "RENDERING", strategy: "B", verdict: recoveryVerdict, viewportSignature: current.signature });

    if (recoveryVerdict !== "NO_PROGRESS") {
      // Strategy B tạo ra thay đổi (STRONG hoặc WEAK) trong khi Strategy A không - gesture gốc bị
      // "nuốt" (case carousel đã xác nhận, xem docblock scrollToTop()), KHÔNG PHẢI lỗi/kết thúc, chỉ
      // là cần đổi chiến lược - log nhãn GESTURE_INEFFECTIVE rồi quay lại vòng lặp bình thường.
      log({ state: "GESTURE_INEFFECTIVE" });
      continue;
    }

    // Cả Strategy A (+settle-retry) VÀ Strategy B đều NO_PROGRESS - cận trên 2 bước/episode đã dùng
    // hết (KHÔNG có bước R3/scrollUntilVisible nào ở Phase 1). KHÔNG có Probe 3 (OS-level, Phase 3)
    // để phân biệt APP_FROZEN khỏi END_OF_LIST - trả PROGRESS_STALLED (confidence LOW), KHÔNG đoán.
    log({ state: "PROGRESS_STALLED", confidence: "LOW" });
    return finish("NOT_FOUND", { reason: "PROGRESS_STALLED", confidence: "LOW" });
  }
}
