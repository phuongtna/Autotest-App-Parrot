import { CTA_TEXTS, SECTION_HEADERS } from "./homeworkUiList.js";
// scrollToTop() (KHÔNG phải findAssignment() - card "Làm lại" cần parser/CTA riêng của module này,
// xem findCompletedCardsWithCtaBounds() bên dưới) - TÁI SỬ DỤNG nguyên logic đã verify (2026-08-21)
// thay vì viết lại: cuộn về đỉnh trước khi tìm, tránh trường hợp vị trí cuộn còn sót lại từ tab
// trước đã nằm SAU (dưới) target thật. findAssignment.js CHỈ import từ homeworkUiList.js nên import
// này KHÔNG tạo circular dependency.
import { scrollToTop, normalizeDueDateDM } from "./findAssignment.js";
import { runSearchStateMachine } from "./assignmentSearchEngine.js";

/**
 * locateCompletedCandidate.js - cơ chế TÌM 1 card đã hoàn thành (cta="Làm lại") trong danh sách
 * "Bài tập", DÙNG CHUNG cho case "làm lại"/redo (KHÁC parser/CTA với `findAssignment.js` - file đó
 * tìm card CHƯA làm dùng `homeworkUiList.js#parseHomeworkCardsWithDetail()`, card đã hoàn thành cần
 * đọc thêm điểm/CTA "Làm lại" riêng - xem `findCompletedCardsWithCtaBounds()`).
 *
 * TÁCH RA từ automation/bai_tap/pro_lamlai_target_score.mjs (2026-08-24, theo yêu cầu đưa scroll/
 * locate logic vào automation/bai_tap để dùng chung/dễ test độc lập) - KHÔNG đổi hành vi so với bản
 * đã fix+verify live trên thiết bị thật cùng ngày (xem ROOT CAUSE, [[project_lamlai_scroll_root_cause]]).
 *
 * PHASE 1 (2026-09-30, assignment-search-engine): `locateSpecificCompletedCandidate()` giờ là
 * wrapper mỏng gọi `runSearchStateMachine()` (assignmentSearchEngine.js) DÙNG CHUNG với
 * `findAssignment.js` - xem docblock hàm đó. `findCompletedCardsWithCtaBounds()` (parser) VÀ
 * `collectDistinctCompletedCandidates()` (hàm quét-nhiều-candidate, mục đích KHÁC hẳn "tìm 1 target
 * cụ thể" - xem docblock riêng của nó) GIỮ NGUYÊN 100%, không thuộc phạm vi Phase 1.
 */

const COMPLETED_CTA = "Làm lại";
const VIEW_LINK_TEXT = "Xem bài đã làm";
const ADVANCED_SECTION_HEADER = "Bài tập nâng cao";
const PROGRESS_PATTERN = /^\d+\s*\/\s*\d+$/;
const DUE_DATE_PATTERN = /^Hạn nộp \d{2}\/\d{2}(\s*\(QUÁ HẠN\))?$/;
const SCORE_PATTERN = /^Điểm\s*[0-9.,]+.*$/;
const MAX_CTA_LOOKAHEAD = 6;

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
      // titleBounds (MỚI - Phase 1 assignment-search-engine): field additive, cùng pattern chính
      // xác đã dùng ở homeworkUiList.js#parseHomeworkCardsWithDetail() (titleNode.bounds). Cần cho
      // computeViewportSignature() (assignmentSearchEngine.js) tính Y-shift của top/bottom card -
      // KHÔNG có field này trước đây khiến viewportSignature suy biến về fingerprint text thuần cho
      // đúng luồng "Làm lại" (xem assignment_search_final_implementation_contract.md, Blocker 1).
      results.push({ title, titleBounds: titleNode.bounds, cta, ctaBounds, scoreText, dueDateBefore, viewLinkBounds });
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
function parseScoreValue(scoreText) {
  const m = /([0-9]+(?:[.,][0-9]+)?)/.exec(scoreText ?? "");
  return m ? Number(m[1].replace(",", ".")) : null;
}

const norm = (s) => (s ?? "").trim();

/** Matcher cho card ĐÃ hoàn thành - target = {title, dueDateDM?, expectedScore?}. GIỮ NGUYÊN 3 tiêu
 * chí identity đã có (title bắt buộc + dueDateDM/expectedScore optional để phân biệt card trùng
 * title, xem comment gốc ở dưới về expectedScore là disambiguator thật sự dùng được). */
function matchesCompletedTarget(card, target) {
  if (norm(card.title) !== norm(target.title)) return false;
  if (target.dueDateDM && normalizeDueDateDM(card.dueDateBefore) !== target.dueDateDM) return false;
  if (target.expectedScore != null && Math.abs((parseScoreValue(card.scoreText) ?? NaN) - target.expectedScore) >= 0.05) return false;
  return true;
}

/** dedupIdentity RỘNG (không phải match identity - xem matchesCompletedTarget() ở trên) - dùng để
 * engine đếm "đã thấy bao nhiêu card phân biệt" (seenAssignments, contract Phase 1 mục 9). */
function dedupIdentity(card) {
  return `${card.title}|${card.scoreText ?? ""}`;
}

/**
 * PHASE 1 (assignment-search-engine) - CHUYỂN sang gọi runSearchStateMachine() DÙNG CHUNG với
 * findAssignment() (assignmentSearchEngine.js) thay vì tự lặp fingerprint/recovery-swipe RIÊNG (bản
 * cũ có 2 lệch giá trị với findAssignment.js: NORMAL_SWIPE_STEP/RECOVERY_SWIPE_STEP đã export/import
 * KHÔNG được, phải khai báo lại - và `waitForAnimationToEnd` 1200ms trong khi findAssignment.js cũ
 * dùng 800ms - chính là bằng chứng SỐNG dẫn tới việc hợp nhất, xem docblock assignmentSearchEngine.js
 * và assignment_search_final_implementation_contract.md Blocker 5). PARSER
 * (`findCompletedCardsWithCtaBounds`) GIỮ NGUYÊN 100% - chỉ đổi state-machine/progress-detection.
 *
 * BLOCKER 4 (contract): silent-first-pick TỪNG tồn tại ở 2 TẦNG - tầng này (`results.find(...)` lấy
 * phần tử đầu) VÀ tầng caller (`.candidates[0]`, xem pro_lamlai_target_score.mjs/
 * resume_lamlai_range_score.mjs). Engine mới dùng `filter()` (qua matchesTarget được gọi trên TOÀN
 * BỘ card mỗi lượt đọc) nên tầng NÀY không còn silent-first-pick - trả `status:"AMBIGUOUS"` +
 * `matches` đầy đủ khi ≥2 card cùng khớp, map xuống `ambiguous:true` ở return shape cũ bên dưới.
 *
 * scrollToTop() GIỮ NGUYÊN - gọi TRƯỚC khi vào engine (đúng tiền điều kiện "xuất phát từ đỉnh danh
 * sách" đã ghi trong docblock chính hàm đó), engine KHÔNG tự gọi scrollToTop (đối xứng với
 * findAssignment(), caller/wrapper chịu trách nhiệm, không phải engine).
 */
export async function locateSpecificCompletedCandidate(bridge, title, { maxScrolls, scrollLog = null, dueDateDM = null, expectedScore = null }) {
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

  // enteredAdvanced: GIỮ NGUYÊN field trong return shape cũ (PHASE 9C - chỉ để log/diagnostics,
  // KHÔNG dùng để cắt/dừng vòng lặp từ trước) - tính qua side-effect trong parseVisibleCards vì
  // engine không có khái niệm "section nâng cao" (đặc thù luồng completed-card này).
  let enteredAdvanced = false;
  const target = { title, dueDateDM, expectedScore };

  const result = await runSearchStateMachine(bridge, {
    target,
    collectNodes: collectNodesWithBoundsInsideScrollableList,
    parseVisibleCards: (nodes, parserState) => {
      if (nodes.some((n) => n.text === ADVANCED_SECTION_HEADER)) enteredAdvanced = true;
      const parsed = findCompletedCardsWithCtaBounds(nodes, { sectionSeen: parserState.sectionSeen });
      return { cards: parsed.results, parserState: { sectionSeen: parsed.sectionSeen } };
    },
    matchesTarget: matchesCompletedTarget,
    dedupIdentity,
    maxScrolls,
    scrollLog,
  });

  if (result.status === "FOUND") {
    console.log(`  [LOCATE] Tìm thấy card "${title}" sau ${result.scrollsUsed} lượt cuộn.`);
    return { candidates: [result.card], ambiguous: false, scrollsUsed: result.scrollsUsed, enteredAdvanced, stopReason: null };
  }
  if (result.status === "AMBIGUOUS") {
    console.log(
      `  [LOCATE] AMBIGUOUS: ${result.matches.length} candidate cùng khớp title "${title}" sau ${result.scrollsUsed} ` +
        `lượt cuộn (${result.matches.map((c) => `score=${c.scoreText ?? "?"}`).join(", ")}) - KHÔNG tự chọn candidate đầu tiên.`,
    );
    // candidates: GIỮ NGUYÊN ý nghĩa cũ khi ambiguous=false (rỗng=not-found, 1 phần tử=found) - khi
    // ambiguous=true, chứa TOÀN BỘ candidate trùng để caller tự log/quyết định (contract Blocker 4).
    return { candidates: result.matches, ambiguous: true, scrollsUsed: result.scrollsUsed, enteredAdvanced, stopReason: "AMBIGUOUS" };
  }
  // NOT_FOUND (reason="PROGRESS_STALLED"), MAX_SCROLLS_REACHED, hoặc ERROR (bridge/swipe lỗi cứng).
  const stopReason = result.status === "MAX_SCROLLS_REACHED" ? "MAX_SCROLLS_REACHED" : result.status === "ERROR" ? "SWIPE_ERROR" : result.reason;
  console.log(
    `  [LOCATE] Không tìm thấy card "${title}" sau ${result.scrollsUsed} lượt cuộn (enteredAdvanced=${enteredAdvanced}, stopReason=${stopReason}).`,
  );
  return { candidates: [], ambiguous: false, scrollsUsed: result.scrollsUsed, enteredAdvanced, stopReason };
}

export { COMPLETED_CTA, VIEW_LINK_TEXT };
