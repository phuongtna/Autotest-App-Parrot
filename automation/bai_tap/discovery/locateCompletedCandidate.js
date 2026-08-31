import { CTA_TEXTS, SECTION_HEADERS } from "./homeworkUiList.js";
// scrollToTop() (KHÔNG phải findAssignment() - card "Làm lại" cần parser/CTA riêng của module này,
// xem findCompletedCardsWithCtaBounds() bên dưới) - TÁI SỬ DỤNG nguyên logic đã verify (2026-08-21)
// thay vì viết lại: cuộn về đỉnh trước khi tìm, tránh trường hợp vị trí cuộn còn sót lại từ tab
// trước đã nằm SAU (dưới) target thật. findAssignment.js CHỈ import từ homeworkUiList.js nên import
// này KHÔNG tạo circular dependency.
import { scrollToTop } from "./findAssignment.js";

/**
 * locateCompletedCandidate.js - cơ chế TÌM 1 card đã hoàn thành (cta="Làm lại") trong danh sách
 * "Bài tập", DÙNG CHUNG cho case "làm lại"/redo (KHÁC parser/CTA với `findAssignment.js` - file đó
 * tìm card CHƯA làm dùng `homeworkUiList.js#parseHomeworkCardsWithDetail()`, card đã hoàn thành cần
 * đọc thêm điểm/CTA "Làm lại" riêng - xem `findCompletedCardsWithCtaBounds()`).
 *
 * TÁCH RA từ automation/bai_tap/pro_lamlai_target_score.mjs (2026-08-24, theo yêu cầu đưa scroll/
 * locate logic vào automation/bai_tap để dùng chung/dễ test độc lập) - KHÔNG đổi hành vi so với bản
 * đã fix+verify live trên thiết bị thật cùng ngày (xem ROOT CAUSE, [[project_lamlai_scroll_root_cause]]).
 */

const COMPLETED_CTA = "Làm lại";
const VIEW_LINK_TEXT = "Xem bài đã làm";
const ADVANCED_SECTION_HEADER = "Bài tập nâng cao";
const PROGRESS_PATTERN = /^\d+\s*\/\s*\d+$/;
const DUE_DATE_PATTERN = /^Hạn nộp \d{2}\/\d{2}(\s*\(QUÁ HẠN\))?$/;
const SCORE_PATTERN = /^Điểm\s*[0-9.,]+.*$/;
const MAX_CTA_LOOKAHEAD = 6;
// Giá trị GIỐNG HỆT NORMAL_SWIPE/RECOVERY_SWIPE trong findAssignment.js (không export nên phải khai
// báo lại, không phải divergence có chủ đích) - dùng bởi locateSpecificCompletedCandidate() để tái
// tạo đúng cơ chế "2-tier swipe" đã proven ở đó (xem ROOT CAUSE 2026-08-24).
const NORMAL_SWIPE_STEP = { start: "50%,80%", end: "50%,25%", duration: 400 };
const RECOVERY_SWIPE_STEP = { start: "50%,90%", end: "50%,10%", duration: 700 };

function now() {
  return Date.now();
}

/** Bọc 1 async step đã có sẵn bằng timer - KHÔNG đổi input/output/behavior của `fn`, chỉ đo (bản
 * copy tối giản của `timed()` trong pro_lamlai_target_score.mjs - hàm đó dùng CHUNG cho nhiều phase
 * không liên quan scroll (CMS/scoring/...) nên KHÔNG kéo nguyên file đó qua đây, chỉ nhân đôi 2 hàm
 * thuần/không trạng thái này). */
async function timed(fn) {
  const startedAt = now();
  const result = await fn();
  const endedAt = now();
  return { result, startedAt, endedAt, durationMs: endedAt - startedAt };
}

function parseBounds(boundsStr) {
  const m = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(boundsStr ?? "");
  if (!m) return null;
  const [x1, y1, x2, y2] = m.slice(1).map(Number);
  return { x1, y1, x2, y2 };
}

function collectNodesWithBoundsInsideScrollableList(node, acc, insideScrollableList = false) {
  const attrs = node?.attributes ?? {};
  const nowInside = insideScrollableList || attrs?.scrollable === "true";
  const text = attrs.text;
  if (nowInside && typeof text === "string" && text.trim()) {
    acc.push({ text: text.trim(), bounds: parseBounds(attrs.bounds) });
  }
  for (const child of node?.children ?? []) collectNodesWithBoundsInsideScrollableList(child, acc, nowInside);
  return acc;
}

function findCompletedCardsWithCtaBounds(nodes, { sectionSeen: initialSectionSeen = false } = {}) {
  const results = [];
  let sectionSeen = initialSectionSeen;
  for (let i = 0; i < nodes.length; i++) {
    const { text } = nodes[i];
    if (SECTION_HEADERS.includes(text)) {
      sectionSeen = true;
      continue;
    }
    if (!sectionSeen) continue;
    if (!PROGRESS_PATTERN.test(text) && !DUE_DATE_PATTERN.test(text)) continue;

    const titleNode = nodes[i - 1];
    const title = titleNode?.text;
    if (!title || SECTION_HEADERS.includes(title) || PROGRESS_PATTERN.test(title) || DUE_DATE_PATTERN.test(title) || CTA_TEXTS.includes(title)) {
      continue;
    }
    const maybeDueBeforeTitle = nodes[i - 2]?.text;
    const dueDateBefore = maybeDueBeforeTitle && DUE_DATE_PATTERN.test(maybeDueBeforeTitle) ? maybeDueBeforeTitle : null;

    let cta = null;
    let ctaBounds = null;
    let scoreText = null;
    let viewLinkBounds = null;
    for (let j = i + 1; j < Math.min(nodes.length, i + 1 + MAX_CTA_LOOKAHEAD); j++) {
      const t = nodes[j].text;
      if (SCORE_PATTERN.test(t)) scoreText = t;
      if (t === VIEW_LINK_TEXT) viewLinkBounds = nodes[j].bounds;
      if (CTA_TEXTS.includes(t)) {
        cta = t;
        ctaBounds = nodes[j].bounds;
        break;
      }
      if (PROGRESS_PATTERN.test(t) || SECTION_HEADERS.includes(t)) break;
    }
    if (cta === COMPLETED_CTA && ctaBounds) {
      results.push({ title, cta, ctaBounds, scoreText, dueDateBefore, viewLinkBounds });
    }
  }
  return { results, sectionSeen };
}

/** Cuộn thăm dò NHỎ + đọc lại hierarchy giữa mỗi lượt (KHÔNG scroll mù/cố định) - dừng NGAY khi đủ
 * candidate mong muốn hoặc hết section, dừng SỚM khi (mặc định 2) lượt liên tiếp không tiến triển
 * thêm (cùng nguyên tắc dừng-sớm đã dùng trong findAssignment.js/homeworkUiList.js).
 *
 * 2 tham số MỚI (2026-08-27, additive - KHÔNG đổi default nên 4 caller hiện có không đổi hành
 * vi), thêm cho use case "gọi hàm này SAU KHI đã cuộn qua khỏi header bằng tay" (vd cross-check
 * App<->Web, xem verifyAssignedHomeworkScoredCrossCheck.mjs):
 *   - initialSectionSeen: caller đã tự xác nhận section "Bài tập về nhà" từng hiển thị (vd đã đọc
 *     hierarchy riêng trước đó) thì truyền true - né đúng bug thật đã gặp: sectionSeen luôn khởi
 *     tạo false, chỉ set true khi ĐÍCH THÂN hàm này thấy header trong 1 lượt đọc CỦA NÓ; header
 *     chỉ hiện ĐÚNG 1 lần lúc đầu danh sách (xem docblock homeworkUiList.js) nên nếu đã cuộn qua
 *     khỏi header TRƯỚC KHI gọi hàm, sectionSeen never true -> mọi card đều bị bỏ qua âm thầm.
 *   - maxNoProgressStreak: nới ngưỡng dừng sớm khi caller CHỦ ĐỘNG bắt đầu từ vùng biết chắc chưa
 *     có card completed nào (vd đỉnh danh sách) và cần cuộn qua nhiều card CHƯA làm trước khi tới
 *     card đầu tiên đã hoàn thành - "không tiến triển" (byTitle.size không tăng) trong vài lượt
 *     KHÔNG đồng nghĩa list đã đứng yên thật trong trường hợp này.
 */
export async function collectDistinctCompletedCandidates(
  bridge,
  { maxScrolls, maxDistinct, scrollLog = null, initialSectionSeen = false, maxNoProgressStreak = 2 },
) {
  let sectionSeen = initialSectionSeen;
  let enteredAdvanced = false;
  const byTitle = new Map();

  // readOnce() ĐO từng bước con (hierarchy/parse/match) - KHÔNG đổi thứ tự/logic bên trong, chỉ bọc
  // timer quanh 2 lệnh đã có sẵn (collectNodesWithBoundsInsideScrollableList, findCompletedCardsWithCtaBounds).
  const readOnce = async () => {
    const hierarchyT = await timed(() => bridge.hierarchy());
    const tree = hierarchyT.result;
    const parseStart = now();
    const nodes = collectNodesWithBoundsInsideScrollableList(tree, []);
    const advancedIdx = nodes.findIndex((n) => n.text === ADVANCED_SECTION_HEADER);
    if (advancedIdx !== -1) enteredAdvanced = true;
    const relevantNodes = advancedIdx === -1 ? nodes : nodes.slice(0, advancedIdx);
    const parseDurationMs = now() - parseStart;
    const matchStart = now();
    const { results, sectionSeen: newSectionSeen } = findCompletedCardsWithCtaBounds(relevantNodes, { sectionSeen });
    const matchDurationMs = now() - matchStart;
    sectionSeen = newSectionSeen;
    for (const r of results) {
      if (!byTitle.has(r.title)) byTitle.set(r.title, r);
    }
    return {
      hierarchyDurationMs: hierarchyT.durationMs,
      parseDurationMs,
      matchDurationMs,
      visibleCardRange: { totalNodes: nodes.length, advancedSectionFound: advancedIdx !== -1 },
      candidateCount: results.length,
    };
  };

  const readStats0 = await readOnce();
  scrollLog?.push({ scrollIndex: 0, scrollDurationMs: null, waitDurationMs: null, ...readStats0, cumulativeDistinct: byTitle.size });
  let scrollsUsed = 0;
  let noProgressStreak = 0;
  let lastSize = byTitle.size;
  while (byTitle.size < maxDistinct && scrollsUsed < maxScrolls && !enteredAdvanced && noProgressStreak < maxNoProgressStreak) {
    // Tách swipe/waitForAnimationToEnd thành 2 lần gọi runSteps() riêng (CÙNG lệnh, CÙNG thứ tự cũ,
    // chỉ thêm 1 ranh giới đo) để có scrollDurationMs/waitDurationMs riêng biệt.
    const swipeT = await timed(() => bridge.runSteps([{ swipe: { start: "50%,80%", end: "50%,25%", duration: 400 } }]));
    if (!swipeT.result.success) {
      console.log(`  [LOCATE] swipe thất bại ở lượt ${scrollsUsed + 1}: ${swipeT.result.error} - dừng cuộn.`);
      break;
    }
    const waitT = await timed(() => bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1200 } }]));
    if (!waitT.result.success) {
      // GIỮ NGUYÊN hành vi cũ: bản gốc gộp swipe+wait trong 1 lần gọi runSteps() DUY NHẤT - Maestro
      // dừng NGAY khi 1 lệnh trong chuỗi fail, nên wait fail cũng khiến runSteps() gốc trả về
      // success=false y hệt swipe fail -> loop cũ `break` luôn trong cả 2 trường hợp. Tách lệnh để
      // đo riêng KHÔNG được đổi nhánh lỗi này - phải break tương tự khi wait fail.
      console.log(`  [LOCATE] waitForAnimationToEnd thất bại ở lượt ${scrollsUsed + 1}: ${waitT.result.error} - dừng cuộn.`);
      break;
    }
    scrollsUsed++;
    const readStats = await readOnce();
    noProgressStreak = byTitle.size > lastSize ? 0 : noProgressStreak + 1;
    lastSize = byTitle.size;
    scrollLog?.push({
      scrollIndex: scrollsUsed,
      scrollDurationMs: swipeT.durationMs,
      waitDurationMs: waitT.durationMs,
      ...readStats,
      cumulativeDistinct: byTitle.size,
    });
  }
  return { candidates: [...byTitle.values()], scrollsUsed, enteredAdvanced };
}

/** Cuộn tới ĐÚNG 1 title cụ thể - dùng khi TARGET_TITLE được cấu hình.
 *
 * LỊCH SỬ (giữ lại để không lặp lại các hướng đã thử/bỏ):
 *   - 2026-08-22: đã thử `scrollUntilVisible` gốc của Maestro cho hàm này - BỎ vì báo thành công
 *     (tìm thấy text) nhưng đọc hierarchy ngay sau đó lại ra 0 candidate - không điều tra sâu, đổi
 *     sang tái dùng vòng lặp cuộn nhỏ+đọc lại hierarchy của collectDistinctCompletedCandidates().
 *   - 2026-08-22: khi tái dùng vòng lặp đó, đã CỐ TÌNH bỏ hẳn điều kiện dừng sớm "2 lượt không tiến
 *     triển" của collectDistinctCompletedCandidates() vì tín hiệu "tiến triển" ở đó dựa trên
 *     `byTitle.size` (chỉ tăng khi thấy TITLE MỚI) - card cần tìm nằm xa hơn trong danh sách nhưng
 *     giữa đường có 2 lượt liên tiếp không xuất hiện title mới nào (dù list vẫn đang cuộn thật) khiến
 *     dừng sớm sai, bỏ lỡ "G3-U3-Lesson 1: Read and complete". Hệ quả của việc bỏ HẲN detection (thay
 *     vì thay bằng tín hiệu mạnh hơn): vòng lặp không còn cách nào phân biệt "còn card ở xa" với
 *     "list đã đứng yên thật" (plateau) - khi swipe rơi vào vùng carousel "Kiến thức trong bài" (BUG
 *     THẬT đã ghi trong `findAssignment.js#scrollToTop()` docblock, xác nhận 2026-08-21: gesture
 *     `swipe` thô bị "nuốt" ở đó, hierarchy đứng yên NGUYÊN VẸN dù đã swipe thật), hàm này cứ lặp mù
 *     tới hết `maxScrolls` (~8-10 phút) trước khi trả NOT_FOUND - xác nhận thật 2026-08-24 với 3 room
 *     hoàn toàn khác nhau (kể cả 1 room VỪA hoàn thành ~45 phút trước, loại trừ giả thuyết "do đã lâu
 *     không đụng tới").
 *
 * FIX 2026-08-24 (xem ROOT CAUSE, [[project_lamlai_scroll_root_cause]]): KHÔNG quay lại tín hiệu yếu
 * `byTitle.size`. Thay vào đó tái tạo ĐÚNG cơ chế đã proven trong `findAssignment.js#findAssignment()`:
 *   1. Gọi `scrollToTop()` (import từ findAssignment.js) TRƯỚC khi tìm - đúng tiền điều kiện đã ghi
 *      trong docblock của chính hàm đó (nếu vị trí cuộn còn sót lại từ tab trước đã ở SAU target thật,
 *      vòng lặp chỉ cuộn 1 chiều xuống sẽ không bao giờ tìm lại được).
 *   2. Fingerprint TOÀN BỘ text đang thấy trong scrollable list (không chỉ riêng candidate cta="Làm
 *      lại") trước/sau mỗi swipe - phản ánh đúng "visible assignment/card state" (kể cả card chưa
 *      hoàn thành, section header...), không thể bị đánh lừa bởi "chưa có title MỚI" như trước.
 *   3. Nếu fingerprint không đổi sau 1 swipe: KHÔNG kết luận ngay (có thể chỉ là animation/settle chưa
 *      xong) - thử recovery swipe biên độ lớn hơn ĐÚNG 1 LẦN (giống findAssignment()). Nếu recovery
 *      cũng không đổi -> dừng NGAY với NOT_FOUND/END_OF_LIST (hoặc NO_PROGRESS nếu xảy ra sớm), không
 *      lặp tiếp cho hết maxScrolls.
 *   4. Nếu fingerprint CÓ đổi -> chắc chắn còn tiến triển thật, tiếp tục cuộn bình thường - card nằm
 *      xa vẫn được tìm thấy đúng như thiết kế gốc (không lặp lại regression 2026-08-22, vì never dừng
 *      sớm chỉ vì "chưa thấy title mới" - chỉ dừng khi list thật sự đứng yên).
 * KHÔNG tăng maxScrolls/sleep để che giấu - fix này làm hàm dừng NHANH HƠN khi plateau thật, không
 * làm nó chạy lâu hơn khi vẫn còn tiến triển.
 *
 * VERIFIED LIVE 2026-08-24 (xem test_locate_fix.log, cùng ngày): 4/4 room test (3 room từng BLOCKED
 * + 1 room regression ee43f014) đều dừng NHANH (5-8 lượt, 80-102s) thay vì burn hết 60 lượt (~8-10
 * phút) - 1/4 tìm thấy card thật (4c01c6eb, scroll #5); 3/4 còn lại dừng đúng với stopReason=
 * END_OF_LIST sau khi node count sập từ ~11-13 xuống 3-4 (vùng carousel "Kiến thức trong bài") - CHƯA
 * chứng minh được các card đó có nằm ở phía SAU carousel hay không (cần fix kiến trúc dùng
 * scrollUntilVisible để xuyên qua carousel mới trả lời được, KHÔNG nằm trong scope tách file này). */
export async function locateSpecificCompletedCandidate(bridge, title, { maxScrolls, scrollLog = null }) {
  const norm = (s) => (s ?? "").trim();
  let sectionSeen = false;
  let enteredAdvanced = false;
  let found = null;
  let lastResults = [];
  let lastFingerprint = "";

  const scrollTopT = await timed(() => scrollToTop(bridge));
  scrollLog?.push({
    scrollIndex: "scrollToTop",
    scrollDurationMs: scrollTopT.durationMs,
    waitDurationMs: null,
    hierarchyDurationMs: null,
    parseDurationMs: null,
    matchDurationMs: null,
    visibleCardRange: { totalNodes: null },
    candidateCount: null,
    atTop: scrollTopT.result.atTop,
    reason: scrollTopT.result.reason ?? null,
  });
  if (!scrollTopT.result.atTop) {
    console.log(`  [LOCATE] scrollToTop() không xác nhận về đỉnh (${scrollTopT.result.reason}) - vẫn tiếp tục tìm từ vị trí hiện tại.`);
  }

  // Fingerprint TOÀN BỘ text node đang thấy trong scrollable list (không riêng candidate cta="Làm
  // lại") - cùng nguyên tắc `fingerprint()` đã proven trong findAssignment.js, chỉ khác input là các
  // node thô của module này (không có parser card chung).
  const fingerprintNodes = (nodes) => nodes.map((n) => n.text).join("||");

  const readOnce = async () => {
    const hierarchyT = await timed(() => bridge.hierarchy());
    const tree = hierarchyT.result;
    const parseStart = now();
    const nodes = collectNodesWithBoundsInsideScrollableList(tree, []);
    const advancedIdx = nodes.findIndex((n) => n.text === ADVANCED_SECTION_HEADER);
    if (advancedIdx !== -1) enteredAdvanced = true;
    // PHASE 9C (2026-08-31, xem PHASE 9B): KHÔNG còn cắt relevantNodes tại "Bài tập nâng cao" nữa -
    // findCompletedCardsWithCtaBounds() đã tổng quát theo SECTION_HEADERS (gồm cả "Bài tập nâng cao",
    // homeworkUiList.js:60) từ trước; evidence thật (Phase 9B, card "G7U2-HW-LB lang-BTNC" đã hoàn
    // thành) xác nhận card completed trong section này CÙNG cấu trúc dòng (title -> "N / M" -> "Điểm
    // N" -> "Xem bài đã làm" -> CTA "Làm lại") như card completed ở "Bài tập về nhà" - không cần loại
    // riêng. `advancedIdx`/`enteredAdvanced` vẫn giữ để log/stopReason, chỉ không dùng để cắt/dừng.
    const relevantNodes = nodes;
    const parseDurationMs = now() - parseStart;
    const matchStart = now();
    const { results, sectionSeen: newSectionSeen } = findCompletedCardsWithCtaBounds(relevantNodes, { sectionSeen });
    const matchDurationMs = now() - matchStart;
    sectionSeen = newSectionSeen;
    lastResults = results;
    found = results.find((r) => norm(r.title) === norm(title)) ?? null;
    return {
      hierarchyDurationMs: hierarchyT.durationMs,
      parseDurationMs,
      matchDurationMs,
      visibleCardRange: { totalNodes: nodes.length, advancedSectionFound: advancedIdx !== -1 },
      candidateCount: results.length,
      fingerprint: fingerprintNodes(relevantNodes),
    };
  };

  const doSwipe = async (step, label) => {
    const swipeT = await timed(() => bridge.runSteps([{ swipe: step }]));
    if (!swipeT.result.success) {
      console.log(`  [LOCATE] swipe (${label}) thất bại: ${swipeT.result.error} - dừng cuộn.`);
      return { ok: false, swipeT, waitT: null };
    }
    const waitT = await timed(() => bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1200 } }]));
    if (!waitT.result.success) {
      // Giữ nguyên hành vi cũ (xem comment tương ứng trong collectDistinctCompletedCandidates()):
      // bản gốc gộp swipe+wait 1 lần gọi, wait fail cũng khiến vòng lặp dừng.
      console.log(`  [LOCATE] waitForAnimationToEnd (${label}) thất bại: ${waitT.result.error} - dừng cuộn.`);
      return { ok: false, swipeT, waitT };
    }
    return { ok: true, swipeT, waitT };
  };

  const readStats0 = await readOnce();
  lastFingerprint = readStats0.fingerprint;
  scrollLog?.push({ scrollIndex: 0, scrollDurationMs: null, waitDurationMs: null, ...readStats0, foundTarget: !!found, progress: null, recoveryAttempted: false });
  let scrollsUsed = 0;
  let recoveryAttempted = false;
  let stopReason = null;

  // PHASE 9C: bỏ `!enteredAdvanced` khỏi điều kiện dừng - xem comment trong readOnce() ở trên. Vòng
  // lặp giờ chỉ dừng khi tìm thấy, hết maxScrolls, hoặc plateau thật (SWIPE_ERROR/NO_PROGRESS/
  // END_OF_LIST, không đổi) - cho phép cuộn xuyên qua "Bài tập nâng cao" để tìm card completed nằm ở đó.
  while (!found && scrollsUsed < maxScrolls) {
    const fingerprintBeforeScroll = lastFingerprint;
    const swipeResult = await doSwipe(NORMAL_SWIPE_STEP, `normal #${scrollsUsed + 1}`);
    if (!swipeResult.ok) {
      stopReason = "SWIPE_ERROR";
      break;
    }
    scrollsUsed++;
    const readStats = await readOnce();
    const progressed = readStats.fingerprint !== fingerprintBeforeScroll;
    lastFingerprint = readStats.fingerprint;
    console.log(
      `  [LOCATE] scroll #${scrollsUsed} (normal): card/node=${readStats.visibleCardRange.totalNodes}, ` +
        `progress=${progressed}, recoveryAttempted=${recoveryAttempted}, foundTarget=${!!found}`,
    );
    scrollLog?.push({
      scrollIndex: scrollsUsed,
      scrollDurationMs: swipeResult.swipeT.durationMs,
      waitDurationMs: swipeResult.waitT.durationMs,
      ...readStats,
      fingerprintBeforeScroll,
      foundTarget: !!found,
      progress: progressed,
      recoveryAttempted,
    });
    if (found) break;
    if (progressed) {
      recoveryAttempted = false; // list vẫn tiến triển thật - nạp lại "ngân sách" recovery.
      continue;
    }

    // List đứng yên sau 1 lượt cuộn thật - KHÔNG kết luận ngay (có thể chỉ animation/settle chưa
    // xong, hoặc đây chính là FALSE PLATEAU do carousel "Kiến thức trong bài" nuốt gesture - xem
    // findAssignment.js#scrollToTop() docblock) - thử recovery ĐÚNG 1 LẦN, không lặp vô hạn.
    if (recoveryAttempted) {
      stopReason = scrollsUsed <= 2 ? "NO_PROGRESS" : "END_OF_LIST";
      console.log(`  [LOCATE] List không tiến triển sau recovery swipe (scroll #${scrollsUsed}) - dừng: ${stopReason}.`);
      break;
    }
    recoveryAttempted = true;
    const fingerprintBeforeRecovery = lastFingerprint;
    const recoveryResult = await doSwipe(RECOVERY_SWIPE_STEP, `recovery @${scrollsUsed + 1}`);
    if (!recoveryResult.ok) {
      stopReason = "SWIPE_ERROR";
      break;
    }
    scrollsUsed++;
    const recoveryStats = await readOnce();
    const recoveryProgressed = recoveryStats.fingerprint !== fingerprintBeforeRecovery;
    lastFingerprint = recoveryStats.fingerprint;
    console.log(
      `  [LOCATE] scroll #${scrollsUsed} (recovery): card/node=${recoveryStats.visibleCardRange.totalNodes}, ` +
        `progress=${recoveryProgressed}, recoveryAttempted=true, foundTarget=${!!found}`,
    );
    scrollLog?.push({
      scrollIndex: scrollsUsed,
      scrollDurationMs: recoveryResult.swipeT.durationMs,
      waitDurationMs: recoveryResult.waitT.durationMs,
      ...recoveryStats,
      fingerprintBeforeScroll: fingerprintBeforeRecovery,
      foundTarget: !!found,
      progress: recoveryProgressed,
      recoveryAttempted: true,
    });
    if (found) break;
    if (!recoveryProgressed) {
      stopReason = scrollsUsed <= 3 ? "NO_PROGRESS" : "END_OF_LIST";
      console.log(`  [LOCATE] Recovery swipe cũng không tiến triển (scroll #${scrollsUsed}) - dừng: ${stopReason}.`);
      break;
    }
    recoveryAttempted = false;
  }
  if (!found && !stopReason) {
    stopReason = scrollsUsed >= maxScrolls ? "MAX_SCROLLS_REACHED" : enteredAdvanced ? "ADVANCED_SECTION_REACHED" : "UNKNOWN";
  }
  if (!found) {
    console.log(
      `  [LOCATE] Không tìm thấy card "${title}" sau ${scrollsUsed} lượt cuộn (enteredAdvanced=${enteredAdvanced}, stopReason=${stopReason}) - ` +
        `${lastResults.length} candidate completed khác thấy được gần nhất: ${lastResults.map((r) => `"${r.title}"`).join(", ") || "(không có)"}.`,
    );
  }
  return { candidates: found ? [found] : [], scrollsUsed, enteredAdvanced, stopReason };
}

export { COMPLETED_CTA, VIEW_LINK_TEXT };
