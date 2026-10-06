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

/** Strategy A - gesture MẶC ĐỊNH. Amplitude 25% (Phase 4, 2026-10-06) - THAY cho 55% cũ
 * (`start:"50%,80%" end:"50%,25%"`) sau khi Phase 3 benchmark trên device thật (profile Ngoc/4D,
 * 6 round/amplitude, 0 INFRA_FAILURE) đo được: 55% có OverlapRate=0% (6/6 round NO_OVERLAP - CHÍNH
 * root cause Phase 2 đã sửa ở compareSignatures(), tái hiện sạch trong benchmark), trong khi 25% có
 * OverlapRate=100%, NoProgressRate=0%, vẫn reveal card mới (avgNewCount=0.83/swipe) - SAFE_CANDIDATE
 * duy nhất có throughput tốt hơn 20% (SAFE_CANDIDATE còn lại, avgNewCount=0.67). X-anchor (50%) và
 * start Y (80%) GIỮ NGUYÊN - CHỈ amplitude (end Y, 25%->55%) đổi. Xem automation/bai_tap/discovery/
 * amplitudeBenchmark.mjs (benchmark Phase 3, giữ lại làm bằng chứng/tái benchmark sau này). */
const STRATEGY_A = { start: "50%,80%", end: "50%,55%", duration: 400 };

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
 * So sánh 2 viewportSignature liên tiếp - trả 1 trong 4 verdict, KHÔNG BAO GIỜ tự leo thẳng lên
 * END_OF_LIST/APP_FROZEN (đó là việc của state machine gọi hàm này, dựa trên NHIỀU lượt gọi + recovery
 * strategy, xem `runSearchStateMachine()`). Xem contract mục 4 cho lý giải từng nhánh (Case A-E).
 *
 * PHASE 2 (2026-10-06, sửa BUG đã xác nhận bằng benchmark thật - xem
 * `assignmentSearchBenchmark.mjs`/benchmark_run3.log): bản Phase 1 coi MỌI "bộ card đổi hẳn"
 * (`!sameCardSet`) là `STRONG_PROGRESS`, KHÔNG phân biệt "đổi hẳn nhưng có ít nhất 1 card chung
 * (anchor thật, xác nhận 2 viewport nối tiếp)" với "đổi hẳn và 2 bộ card HOÀN TOÀN rời nhau (0 card
 * chung)". Benchmark thật trên device (Strategy A, 6/6 round) cho thấy case thứ 2 xảy ra ở MỌI round
 * - swipe hiện tại di chuyển xấp xỉ đúng 1 "card pitch" (~1056-1107px đo thật) nên thường xuyên
 * KHÔNG để lại overlap nào, trong khi code cũ vẫn tự tin báo STRONG_PROGRESS - nghĩa là nếu có 1 card
 * nằm TRỌN trong vùng bị nhảy qua giữa 2 lần đọc, nó sẽ KHÔNG BAO GIỜ xuất hiện ở bất kỳ snapshot
 * nào mà thuật toán vẫn tưởng đã an toàn tiến lên. SỬA: thêm `hasOverlap` (≥1 card identity chung
 * CẢ 2 phía) làm điều kiện BẮT BUỘC cho STRONG_PROGRESS khi bộ card đổi hẳn; nếu không có overlap,
 * trả `LOW_CONFIDENCE_PROGRESS` (verdict MỚI) - `runSearchStateMachine()` bắt buộc verdict này phải
 * qua xác minh (Strategy B cross-check) trước khi được chấp nhận là tiến triển, KHÔNG được tự động
 * continue như STRONG_PROGRESS nữa (xem docblock hàm đó).
 * @param {ReturnType<typeof computeViewportSignature>} prev
 * @param {ReturnType<typeof computeViewportSignature>} curr
 * @returns {"STRONG_PROGRESS"|"LOW_CONFIDENCE_PROGRESS"|"WEAK_PROGRESS"|"NO_PROGRESS"}
 */
export function compareSignatures(prev, curr) {
  const sameCardSet = arraysEqual(prev.cardIdentities, curr.cardIdentities);
  const sameTopTitle = prev.topCard?.title === curr.topCard?.title;
  const topYShift =
    sameTopTitle && prev.topCard?.y != null && curr.topCard?.y != null ? Math.abs(prev.topCard.y - curr.topCard.y) : null;
  const nodeCountChanged = prev.rawNodeCount !== curr.rawNodeCount;
  // OVERLAP THẬT (Phase 2): ≥1 card identity xuất hiện ở CẢ 2 phía - anchor THẬT xác nhận 2 viewport
  // nối tiếp nhau. KHÁC HẲN "cardIdentities khác nhau" (bất kỳ 2 bộ card nào khác nhau - kể cả rời
  // nhau HOÀN TOÀN - cũng làm sameCardSet=false, bản Phase 1 coi NHƯ NHAU - chính là bug đã sửa).
  const hasOverlap = prev.cardIdentities.some((id) => curr.cardIdentities.includes(id));

  // Case A: same cards (cùng topCard.title), Y đổi ĐÁNG KỂ -> chắc chắn đã cuộn thật.
  if (sameTopTitle && topYShift !== null && topYShift > MIN_MEANINGFUL_Y_SHIFT_PX) {
    return "STRONG_PROGRESS";
  }
  if (!sameCardSet) {
    // Case B (SỬA, Phase 2): bộ card đổi hẳn - CHỈ còn là STRONG_PROGRESS khi có overlap THẬT. Không
    // overlap (dù cả 2 phía đều có card thật, hay 1 phía rỗng - vd cuộn qua khỏi cuối danh sách) đều
    // KHÔNG đủ bằng chứng để tự tin "đã tiến đúng, không bỏ sót gì" - trả LOW_CONFIDENCE_PROGRESS,
    // bắt buộc qua xác minh ở tầng gọi (runSearchStateMachine()) trước khi được chấp nhận.
    if (hasOverlap) return "STRONG_PROGRESS";
    return "LOW_CONFIDENCE_PROGRESS";
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
  // PHASE 2 (2026-10-06) - đếm riêng để minh bạch trong diagnostics, KHÔNG ảnh hưởng quyết định
  // FOUND/AMBIGUOUS/NOT_FOUND:
  //   lowConfidenceCount: số lần compareSignatures() trả LOW_CONFIDENCE_PROGRESS (Strategy A hoặc B).
  //   unresolvedGapSteps: số lần CHẤP NHẬN tiếp tục sau LOW_CONFIDENCE_PROGRESS nhờ Strategy B xác
  //     nhận vị trí hiện tại ổn định - nhưng quãng NẰM GIỮA (trước Strategy A) KHÔNG được quét (giới
  //     hạn hình học đã biết: Strategy A/B cùng khoảng cách Y, không gesture nào quét được phần nằm
  //     giữa 2 vị trí cách nhau đúng 1 bước - xem compareSignatures() docblock). Không giả vờ đã xác
  //     minh hết - số này giúp người đọc report biết có bao nhiêu bước "tiến nhưng chưa chứng minh
  //     được an toàn tuyệt đối".
  let lowConfidenceCount = 0;
  let unresolvedGapSteps = 0;

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
      `LOW_CONFIDENCE_PROGRESS events: ${lowConfidenceCount}, trong đó UNRESOLVED_GAP (chấp nhận tiến tiếp nhưng không quét được quãng giữa): ${unresolvedGapSteps}`,
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
    // PHASE 2 - field ADDITIVE (không đổi field cũ) - caller cũ không đọc field này vẫn hoạt động
    // nguyên vẹn (findAssignment.js/locateCompletedCandidate.js hiện chỉ đọc status/scrollsUsed/card/
    // matches/reason/diagnostics, không bị ảnh hưởng).
    lowConfidenceCount,
    unresolvedGapSteps,
    diagnostics: buildDiagnostics({ status, reason: extra.reason ?? null, confidence: extra.confidence ?? null, matches: extra.matches, card: extra.card }),
  });

  const log = (entry) => scrollLog?.push({ scrollIndex: scrollsUsed, ...entry });

  // PHASE 2 (2026-10-06): tách match-check thành helper, gọi KHÔNG CHỈ ở đỉnh vòng lặp mà còn NGAY
  // TRƯỚC mỗi lần sắp trả PROGRESS_STALLED (2 chỗ bên dưới). Lý do: Phase 2 khiến LOW_CONFIDENCE_
  // PROGRESS có thể dẫn tới PROGRESS_STALLED NGAY TRONG CÙNG 1 vòng lặp (qua RECOVERING) mà KHÔNG
  // quay lại đỉnh vòng lặp trước đó - nếu không recheck, dữ liệu `current.cards` MỚI NHẤT (vừa đọc
  // được, có thể ĐÃ chứa target thật) sẽ bị vứt bỏ oan uổng chỉ vì progress-detection không chắc chắn
  // - 2 việc này ĐỘC LẬP, match-detection phải luôn được ưu tiên khi có dữ liệu trong tay (phát hiện
  // qua regression test thật khi thêm overlap-check, xem assignmentSearchEngine.fixtureTest.mjs).
  const checkMatches = () => {
    const matches = current.cards.filter((c) => matchesTarget(c, target));
    if (matches.length === 1) return { done: true, result: finish("FOUND", { card: matches[0] }) };
    if (matches.length > 1) return { done: true, result: finish("AMBIGUOUS", { matches }) };
    return { done: false };
  };

  let current = await readCurrent();
  log({ state: "READING", visibleCards: current.cards.length, viewportSignature: current.signature });

  while (true) {
    const topCheck = checkMatches();
    if (topCheck.done) {
      log({ state: topCheck.result.status === "FOUND" ? "TARGET_FOUND" : "TARGET_AMBIGUOUS" });
      return topCheck.result;
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
      // bắt buộc chạy TRƯỚC KHI coi WEAK_PROGRESS/NO_PROGRESS/LOW_CONFIDENCE_PROGRESS là plateau/
      // zero-overlap thật (contract mục 2.B: gap đã tìm thấy trong pseudocode cũ - không được swipe
      // tiếp mà chưa xác nhận render đã settle).
      await waitOnly();
      current = await readCurrent();
      verdict = compareSignatures(beforeSignature, current.signature);
      log({ state: "RENDERING", strategy: "A", action: "SETTLE_RETRY", verdict, viewportSignature: current.signature });
    }

    if (verdict === "STRONG_PROGRESS") continue; // overlap THẬT đã xác nhận (trực tiếp hoặc sau settle) - an toàn, tiếp tục.

    if (verdict === "LOW_CONFIDENCE_PROGRESS") lowConfidenceCount++;

    // verdict còn lại (LOW_CONFIDENCE_PROGRESS, WEAK_PROGRESS, hoặc NO_PROGRESS) sau settle-retry:
    // CHƯA đủ bằng chứng progress AN TOÀN - chuyển RECOVERING (Strategy B) - KHÔNG BAO GIỜ tự động
    // thành END_OF_LIST/PROGRESS_STALLED/STRONG_PROGRESS ở đây.
    // PHASE 2 (2026-10-06): LOW_CONFIDENCE_PROGRESS giờ ĐI QUA CÙNG cổng RECOVERING này - ở Phase 1,
    // case "!sameCardSet" luôn là STRONG_PROGRESS nên KHÔNG BAO GIỜ tới được nhánh RECOVERING - đây
    // chính là root cause benchmark thật đã xác nhận (6/6 round Strategy A sharedCount=0 vẫn được
    // chấp nhận ngay, không qua xác minh nào, xem assignmentSearchBenchmark.mjs).
    log({ state: "RECOVERING", strategy: "B", reason: verdict });
    const beforeRecoverySignature = current.signature;
    const swipeB = await doSwipe(STRATEGY_B);
    if (!swipeB.ok) return finish("ERROR", { reason: swipeB.error });
    scrollsUsed++;

    current = await readCurrent();
    const recoveryVerdict = compareSignatures(beforeRecoverySignature, current.signature);
    log({ state: "RENDERING", strategy: "B", verdict: recoveryVerdict, viewportSignature: current.signature });

    if (recoveryVerdict === "STRONG_PROGRESS") {
      if (verdict === "LOW_CONFIDENCE_PROGRESS") {
        // Strategy B xác nhận overlap THẬT từ vị trí sau Strategy A - vị trí ĐÓ là thật/ổn định
        // (không phải artifact đọc nhầm). NHƯNG: quãng NẰM GIỮA beforeSignature (trước Strategy A) và
        // vị trí này KHÔNG được bất kỳ gesture nào quét qua (Strategy A VÀ Strategy B cùng khoảng
        // cách Y, không gesture nào lấy mẫu được phần nằm giữa 2 vị trí cách nhau đúng 1 bước - giới
        // hạn hình học đã biết, xem compareSignatures() docblock + assignmentSearchBenchmark.mjs mục
        // Recommendation, để Phase 3 xử lý bằng biên độ nhỏ hơn có benchmark). Chấp nhận tiếp tục
        // (KHÔNG chặn tiến trình chỉ vì 1 giới hạn hình học đã biết, không phải lỗi mới) nhưng GHI
        // NHẬN rõ ràng - KHÔNG giả vờ đã xác minh hết quãng giữa.
        unresolvedGapSteps++;
        log({
          state: "UNRESOLVED_GAP_ACCEPTED",
          note: "Strategy B xác nhận vị trí hiện tại ổn định, nhưng quãng giữa beforeSignature và vị trí này KHÔNG được quét - không loại trừ được khả năng bỏ sót card trong quãng đó.",
        });
      } else {
        // WEAK_PROGRESS/NO_PROGRESS (case cũ, giữ NGUYÊN hành vi/nhãn) -> Strategy B cho thấy tiến
        // triển thật - gesture gốc bị "nuốt" (case carousel đã xác nhận, xem docblock scrollToTop()),
        // KHÔNG PHẢI lỗi/kết thúc, chỉ là cần đổi chiến lược.
        log({ state: "GESTURE_INEFFECTIVE" });
      }
      continue;
    }

    if (recoveryVerdict === "LOW_CONFIDENCE_PROGRESS") {
      // Strategy B CŨNG nhảy zero-overlap - 2 gesture ĐỘC LẬP (khác X-anchor, cùng khoảng cách Y) đều
      // không xác nhận được tính liên tục. Đáng ngờ hơn hẳn 1 gesture đơn lẻ - KHÔNG an toàn để tự
      // tin "continue" (ĐÂY LÀ BUG PHASE 1 ĐÃ SỬA: trước đây case tương đương luôn trả STRONG_PROGRESS
      // bất kể recovery có xác nhận được gì hay không). TRƯỚC KHI dừng, recheck match trên dữ liệu
      // MỚI NHẤT vừa đọc được (xem checkMatches() docblock) - không vứt bỏ 1 match THẬT chỉ vì
      // progress-detection không chắc chắn.
      const recheck = checkMatches();
      if (recheck.done) {
        log({ state: "TARGET_FOUND_ON_STALL_RECHECK" });
        return recheck.result;
      }
      lowConfidenceCount++;
      log({
        state: "PROGRESS_STALLED",
        confidence: "LOW",
        reason: "LOW_CONFIDENCE_PROGRESS ở cả Strategy A lẫn Strategy B - không xác minh được tính liên tục của viewport.",
      });
      return finish("NOT_FOUND", { reason: "PROGRESS_STALLED", confidence: "LOW" });
    }

    if (recoveryVerdict !== "NO_PROGRESS") {
      // WEAK_PROGRESS (case cũ, giữ NGUYÊN) - Strategy B tạo thay đổi nhẹ, chấp nhận tiếp tục.
      log({ state: "GESTURE_INEFFECTIVE" });
      continue;
    }

    // Cả Strategy A (+settle-retry) VÀ Strategy B đều NO_PROGRESS thật - cận trên 2 bước/episode đã
    // dùng hết (KHÔNG có bước R3/scrollUntilVisible nào ở Phase 1/2). KHÔNG có Probe 3 (OS-level,
    // Phase 3) để phân biệt APP_FROZEN khỏi END_OF_LIST - trả PROGRESS_STALLED (confidence LOW),
    // KHÔNG đoán. Recheck match trên dữ liệu mới nhất trước khi dừng - cùng lý do như trên.
    {
      const recheck = checkMatches();
      if (recheck.done) {
        log({ state: "TARGET_FOUND_ON_STALL_RECHECK" });
        return recheck.result;
      }
    }
    log({ state: "PROGRESS_STALLED", confidence: "LOW" });
    return finish("NOT_FOUND", { reason: "PROGRESS_STALLED", confidence: "LOW" });
  }
}
