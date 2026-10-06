#!/usr/bin/env node
/**
 * assignmentSearchBenchmark.mjs - BENCHMARK-ONLY, KHÔNG sửa production search logic.
 *
 * Mục đích (2026-10-06, theo yêu cầu audit "Phase Benchmark" trước khi thiết kế adaptive scroll):
 * đo SỐ LIỆU THẬT cho card geometry / Y-shift / overlap / chi phí thời gian của Strategy A/B hiện
 * tại (assignmentSearchEngine.js), kiểm tra skip-risk bằng fixture, và chiếu (PROJECT - không phải
 * ĐO) số lượt cuộn cần cho list 30/50/100 card bằng fixture tổng hợp chạy qua CHÍNH
 * `runSearchStateMachine()` thật (import, không sửa).
 *
 * CHỈ ĐỌC (import readonly) từ các file production - KHÔNG sửa:
 *   - findAssignment.js (scrollToTop, normalizeDueDateDM)
 *   - assignmentSearchEngine.js (runSearchStateMachine, computeViewportSignature, compareSignatures)
 *   - homeworkUiList.js (collectTextNodesWithBoundsInsideScrollableList, parseHomeworkCardsWithDetail)
 *   - bridge/maestroMcpBridge.js (MaestroMcpBridge - hạ tầng, không phải search logic)
 *
 * STRATEGY_A/STRATEGY_B/WAIT_AFTER_SCROLL_MS bên dưới là COPY NGUYÊN VĂN giá trị hiện có trong
 * assignmentSearchEngine.js (module-private const, không export được mà KHÔNG sửa file gốc - đúng
 * yêu cầu "không sửa production logic"). Nếu file gốc đổi giá trị này sau này mà benchmark không
 * cập nhật theo, số liệu ở đây sẽ KHÔNG còn phản ánh đúng hành vi thật - đã ghi chú rõ dòng tham
 * chiếu để dễ đối chiếu lại.
 *
 * PHASE 4 (2026-10-06): production STRATEGY_A đã đổi 55%->25% (xem assignmentSearchEngine.js) sau
 * khi amplitudeBenchmark.mjs (Phase 3) xác nhận 25% an toàn (OverlapRate=100%) còn 55% KHÔNG an
 * toàn (OverlapRate=0%, 6/6 round NO_OVERLAP). COPY bên dưới đã cập nhật theo ĐÚNG giá trị mới.
 * benchmark_after1.log/benchmark_after2.log (log cũ, nếu còn giữ) được đo khi STRATEGY_A còn 55% -
 * ĐỌC LẠI các log đó phải hiểu là "trước Phase 4", KHÔNG phản ánh hành vi hiện tại.
 *
 * CHẠY: node automation/bai_tap/discovery/assignmentSearchBenchmark.mjs
 * OUTPUT: in trực tiếp ra console theo cấu trúc A-F đã thống nhất với yêu cầu; KHÔNG ghi file (đây
 * là 1 lần đo, không phải suite lặp lại định kỳ).
 */

import { fileURLToPath } from "node:url";
import { parseEnvFile } from "../../src/config.js";
import { MaestroMcpBridge } from "../../bridge/maestroMcpBridge.js";
import { collectTextNodesWithBoundsInsideScrollableList, parseHomeworkCardsWithDetail } from "./homeworkUiList.js";
import { scrollToTop } from "./findAssignment.js";
import { findAssignment } from "./findAssignment.js";

const PROJECT_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const ROOT_ENV = parseEnvFile(PROJECT_ROOT + ".env");
const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";

// === COPY NGUYÊN VĂN từ assignmentSearchEngine.js (dòng 43/51/57) - xem docblock trên. Phase 4: 25%. ===
const STRATEGY_A = { start: "50%,80%", end: "50%,55%", duration: 400 };
const STRATEGY_B = { start: "20%,80%", end: "20%,25%", duration: 400 };
const WAIT_AFTER_SCROLL_MS = 1200;

const ROUNDS_PER_STRATEGY = 6;
const INFRA_RETRY_MAX = 3;
const INFRA_ERROR_PATTERNS = [/DeviceServerDiedException/i, /tcp:\d+.*closed/i, /UNAVAILABLE/i, /timed out/i, /timeout/i];

function now() {
  return Date.now();
}
async function timed(fn) {
  const startedAt = now();
  const result = await fn();
  return { result, durationMs: now() - startedAt };
}
function isInfraError(errOrMsg) {
  const msg = typeof errOrMsg === "string" ? errOrMsg : errOrMsg?.message ?? String(errOrMsg ?? "");
  return INFRA_ERROR_PATTERNS.some((re) => re.test(msg));
}

/** Đếm riêng INFRA_FAILURE (bridge chết) - KHÔNG tính vào benchmark thuật toán (yêu cầu #6). */
const infraLog = { count: 0, errors: [] };

async function withInfraRetry(label, fn, { maxAttempts = INFRA_RETRY_MAX } = {}) {
  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return { ok: true, value: await fn() };
    } catch (err) {
      const msg = err?.message ?? String(err);
      if (isInfraError(msg)) {
        infraLog.count++;
        infraLog.errors.push({ label, attempt, msg: msg.slice(0, 200) });
        console.log(`  [INFRA_FAILURE] ${label} lượt ${attempt}/${maxAttempts}: ${msg.slice(0, 150)}`);
        lastErr = err;
        continue;
      }
      throw err; // lỗi KHÔNG phải infra - không nuốt, để lộ ra thật.
    }
  }
  return { ok: false, error: lastErr };
}

function readCards(tree) {
  const nodes = collectTextNodesWithBoundsInsideScrollableList(tree, []);
  const parsed = parseHomeworkCardsWithDetail(nodes, { sectionSeen: true });
  return { nodes, cards: parsed.cards };
}

function cardKey(c) {
  return `${c.title}|${c.dueDate ?? ""}|${c.score ?? ""}`;
}

/** Pitch (khoảng cách Y giữa 2 title liên tiếp CÙNG 1 snapshot) - đo "chiều cao card" theo đúng ý
 * nghĩa cần cho skip-risk (khoảng Y mà 1 swipe phải < để không nhảy qua 1 card trọn vẹn). */
function medianPitch(cards) {
  const ys = cards.map((c) => c.titleBounds?.y1).filter((y) => typeof y === "number").sort((a, b) => a - b);
  if (ys.length < 2) return null;
  const diffs = [];
  for (let i = 1; i < ys.length; i++) diffs.push(ys[i] - ys[i - 1]);
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)];
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  if (!s.length) return null;
  return s[Math.floor(s.length / 2)];
}
function mean(nums) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Benchmark 1 strategy swipe: ROUNDS_PER_STRATEGY lượt, mỗi lượt đo:
 *  - timing: swipe / wait / hierarchy-trước / hierarchy-sau
 *  - cards trước/sau, card chung (để tính Y-shift thật), card mới, card biến mất
 * Trả về mảng per-round + null nếu round đó bị INFRA_FAILURE (loại khỏi benchmark thuật toán).
 */
async function benchStrategy(bridge, strategy, label) {
  const rounds = [];
  for (let i = 0; i < ROUNDS_PER_STRATEGY; i++) {
    const beforeT = await withInfraRetry(`${label} round ${i} hierarchy(before)`, () => timed(() => bridge.hierarchy()));
    if (!beforeT.ok) {
      rounds.push({ infraFailure: true });
      continue;
    }
    const before = readCards(beforeT.value.result);
    const beforeHierarchyMs = beforeT.value.durationMs;

    const swipeT = await withInfraRetry(`${label} round ${i} swipe`, () => timed(() => bridge.runSteps([{ swipe: strategy }])));
    if (!swipeT.ok || !swipeT.value.result.success) {
      rounds.push({ infraFailure: true, reason: swipeT.ok ? swipeT.value.result.error : "retry exhausted" });
      continue;
    }
    const swipeMs = swipeT.value.durationMs;

    const waitT = await withInfraRetry(`${label} round ${i} wait`, () => timed(() => bridge.runSteps([{ waitForAnimationToEnd: { timeout: WAIT_AFTER_SCROLL_MS } }])));
    if (!waitT.ok) {
      rounds.push({ infraFailure: true });
      continue;
    }
    const waitMs = waitT.value.durationMs;

    const afterT = await withInfraRetry(`${label} round ${i} hierarchy(after)`, () => timed(() => bridge.hierarchy()));
    if (!afterT.ok) {
      rounds.push({ infraFailure: true });
      continue;
    }
    const after = readCards(afterT.value.result);
    const afterHierarchyMs = afterT.value.durationMs;

    const beforeByKey = new Map(before.cards.map((c) => [cardKey(c), c]));
    const afterByKey = new Map(after.cards.map((c) => [cardKey(c), c]));
    const sharedKeys = [...beforeByKey.keys()].filter((k) => afterByKey.has(k));
    const newKeys = [...afterByKey.keys()].filter((k) => !beforeByKey.has(k));
    const disappearedKeys = [...beforeByKey.keys()].filter((k) => !afterByKey.has(k));

    const yShifts = sharedKeys
      .map((k) => {
        const b = beforeByKey.get(k).titleBounds?.y1;
        const a = afterByKey.get(k).titleBounds?.y1;
        return typeof b === "number" && typeof a === "number" ? b - a : null;
      })
      .filter((v) => v != null);

    rounds.push({
      infraFailure: false,
      beforeCardCount: before.cards.length,
      afterCardCount: after.cards.length,
      beforeRawNodeCount: before.nodes.length,
      afterRawNodeCount: after.nodes.length,
      sharedCount: sharedKeys.length,
      newCount: newKeys.length,
      disappearedCount: disappearedKeys.length,
      disappearedTitles: disappearedKeys.map((k) => k.split("|")[0]),
      yShifts,
      medianYShift: median(yShifts),
      beforePitch: medianPitch(before.cards),
      afterPitch: medianPitch(after.cards),
      timing: { swipeMs, waitMs, beforeHierarchyMs, afterHierarchyMs },
    });
  }
  return rounds;
}

function summarizeRounds(rounds, label) {
  const valid = rounds.filter((r) => !r.infraFailure);
  const infraCount = rounds.length - valid.length;
  if (!valid.length) {
    return { label, infraCount, status: "BLOCKED_BY_INFRA (0/${rounds.length} round hợp lệ)" };
  }
  const allYShifts = valid.flatMap((r) => r.yShifts);
  const pitches = valid.flatMap((r) => [r.beforePitch, r.afterPitch].filter((v) => v != null));
  return {
    label,
    infraCount,
    validRounds: valid.length,
    avgCardsPerSnapshot: mean(valid.map((r) => r.beforeCardCount)),
    avgNewCardsPerSwipe: mean(valid.map((r) => r.newCount)),
    avgDisappearedPerSwipe: mean(valid.map((r) => r.disappearedCount)),
    avgSharedPerSwipe: mean(valid.map((r) => r.sharedCount)),
    medianYShiftPx: median(allYShifts),
    yShiftSamples: allYShifts,
    medianCardPitchPx: median(pitches),
    pitchSamples: pitches,
    avgSwipeMs: mean(valid.map((r) => r.timing.swipeMs)),
    avgWaitMs: mean(valid.map((r) => r.timing.waitMs)),
    avgHierarchyMs: mean(valid.map((r) => (r.timing.beforeHierarchyMs + r.timing.afterHierarchyMs) / 2)),
    rounds: valid,
  };
}

/** SKIP-RISK mechanism-level test (KHÔNG cần device) - đúng kịch bản user yêu cầu: snapshot N =
 * [A,B,C,D,E], snapshot N+1 = [D,E,F,G,H] (overlap AN TOÀN) VS [A,B,C,D,E] -> [F,G,H,I,J] (0 overlap)
 * - kiểm tra compareSignatures() thật có tự phát hiện được tình huống "0 overlap = có thể đã nhảy
 * qua nội dung" hay không (KHÔNG sửa compareSignatures(), chỉ gọi nó - import readonly). */
function cardFix(title, y) {
  return { title, titleBounds: { x1: 0, y1: y, x2: 100, y2: y + 40 }, cta: "Làm bài", dueDate: "01/01" };
}
function skipRiskFixtureTest() {
  const { computeViewportSignature, compareSignatures } = globalThis.__assignmentSearchEngineExports;
  const safeOverlap = {
    prev: computeViewportSignature([cardFix("A", 100), cardFix("B", 140), cardFix("C", 180), cardFix("D", 220), cardFix("E", 260)], 5),
    curr: computeViewportSignature([cardFix("D", 100), cardFix("E", 140), cardFix("F", 180), cardFix("G", 220), cardFix("H", 260)], 5),
  };
  const zeroOverlap = {
    prev: computeViewportSignature([cardFix("A", 100), cardFix("B", 140), cardFix("C", 180), cardFix("D", 220), cardFix("E", 260)], 5),
    curr: computeViewportSignature([cardFix("F", 100), cardFix("G", 140), cardFix("H", 180), cardFix("I", 220), cardFix("J", 260)], 5),
  };
  const safeVerdict = compareSignatures(safeOverlap.prev, safeOverlap.curr);
  const zeroVerdict = compareSignatures(zeroOverlap.prev, zeroOverlap.curr);
  return {
    safeOverlapCase: { cards: "[A..E] -> [D..H] (2 card chung: D,E)", verdict: safeVerdict },
    zeroOverlapCase: { cards: "[A..E] -> [F..J] (0 card chung - card ẩn danh giữa E và F, nếu có, sẽ KHÔNG BAO GIỜ xuất hiện)", verdict: zeroVerdict },
    mechanismFinding:
      zeroVerdict === "STRONG_PROGRESS"
        ? "BUG CONFIRMED (mechanism-level, Phase 1): compareSignatures() trả STRONG_PROGRESS cho CẢ 2 case (an toàn lẫn 0-overlap) - thuật toán KHÔNG có cách tự phân biệt '0 overlap nguy hiểm' với 'tiến triển bình thường'. Không có bất kỳ guard/warning nào khi 2 bộ card liên tiếp hoàn toàn rời nhau."
        : zeroVerdict === "LOW_CONFIDENCE_PROGRESS"
          ? "FIXED (Phase 2, 2026-10-06): compareSignatures() giờ trả LOW_CONFIDENCE_PROGRESS cho case 0-overlap (KHÁC safeOverlapCase vẫn trả STRONG_PROGRESS đúng như cũ) - thuật toán ĐÃ phân biệt được '0 overlap nguy hiểm' và bắt buộc qua xác minh (Strategy B) ở runSearchStateMachine() trước khi chấp nhận, KHÔNG còn tự tin vô điều kiện."
          : `KHÔNG như kỳ vọng: zeroOverlapCase trả ${zeroVerdict}, cần xem lại logic trước khi kết luận.`,
  };
}

/** Large-list PROJECTION fixture (KHÔNG cần device) - chạy `findAssignment()` thật (không sửa) qua
 * 1 fake bridge tổng hợp mô phỏng list N card, revealPerSwipe card mới/lượt (tham số hoá theo số đo
 * thật nếu có, fallback giá trị rõ ràng ghi chú PROJECTED nếu không đo được). */
function buildSyntheticListBridge(totalCards, { cardsPerViewport = 5, revealPerSwipe = 2 } = {}) {
  let scrollIdx = 0;
  let hierarchyCalls = 0;
  const maxStart = Math.max(0, totalCards - cardsPerViewport);
  return {
    bridge: {
      async hierarchy() {
        hierarchyCalls++;
        const start = Math.min(scrollIdx * revealPerSwipe, maxStart);
        const nodes = [{ text: "Bài tập về nhà", bounds: null }];
        for (let i = start; i < Math.min(start + cardsPerViewport, totalCards); i++) {
          nodes.push({ text: `Synthetic Card ${i}`, bounds: { x1: 0, y1: (i - start) * 200 + 100, x2: 900, y2: (i - start) * 200 + 140 } });
          nodes.push({ text: "0 / 5", bounds: null });
          nodes.push({ text: "Hạn nộp 01/01", bounds: null });
          nodes.push({ text: "Làm bài", bounds: { x1: 0, y1: (i - start) * 200 + 150, x2: 200, y2: (i - start) * 200 + 190 } });
        }
        return {
          attributes: { scrollable: "true" },
          children: nodes.map((n) => ({
            attributes: { text: n.text, scrollable: "false", bounds: n.bounds ? `[${n.bounds.x1},${n.bounds.y1}][${n.bounds.x2},${n.bounds.y2}]` : undefined },
            children: [],
          })),
        };
      },
      async runSteps(steps) {
        if (steps.some((s) => s && typeof s === "object" && "swipe" in s)) scrollIdx++;
        return { success: true };
      },
    },
    getHierarchyCalls: () => hierarchyCalls,
  };
}

async function largeListProjection(revealPerSwipe, cardsPerViewport = 5) {
  const sizes = [30, 50, 100];
  const positions = [
    { label: "đầu list", frac: 0.02 },
    { label: "giữa list", frac: 0.5 },
    { label: "cuối list", frac: 0.96 },
  ];
  const results = [];
  for (const total of sizes) {
    for (const pos of positions) {
      const targetIdx = Math.min(total - 1, Math.max(0, Math.round(total * pos.frac)));
      const { bridge, getHierarchyCalls } = buildSyntheticListBridge(total, { revealPerSwipe, cardsPerViewport });
      const targetTitle = `Synthetic Card ${targetIdx}`;
      const t0 = now();
      const result = await findAssignment(bridge, { title: targetTitle, cta: "Làm bài" }, { maxScrolls: 60 });
      const elapsedMs = now() - t0; // chi phí JS thuần, KHÔNG phản ánh I/O thật - chỉ dùng để sanity-check không treo.
      results.push({
        totalCards: total,
        targetPosition: pos.label,
        targetIdx,
        status: result.status,
        scrollsUsed: result.scrollCount,
        hierarchyCalls: getHierarchyCalls(),
        syntheticElapsedMs: elapsedMs,
        lowConfidenceCount: result.lowConfidenceCount ?? null,
        unresolvedGapSteps: result.unresolvedGapSteps ?? null,
      });
    }
  }
  return results;
}

async function main() {
  console.log("=== assignmentSearchBenchmark.mjs - Phase Benchmark (KHÔNG sửa production logic) ===\n");

  // ===== PHẦN KHÔNG CẦN DEVICE (luôn chạy được) =====
  console.log("[PURE] Nạp assignmentSearchEngine.js để test skip-risk mechanism-level...");
  const engineModule = await import("./assignmentSearchEngine.js");
  globalThis.__assignmentSearchEngineExports = engineModule;
  const skipRisk = skipRiskFixtureTest();
  console.log(`  safeOverlapCase verdict=${skipRisk.safeOverlapCase.verdict}`);
  console.log(`  zeroOverlapCase verdict=${skipRisk.zeroOverlapCase.verdict}`);
  console.log(`  [MECHANISM FINDING] ${skipRisk.mechanismFinding}\n`);

  console.log("[PURE] Large-list PROJECTION qua findAssignment() thật, fixture tổng hợp 30/50/100 card...");
  console.log("  (revealPerSwipe=2 giả định TẠM - sẽ thay bằng số đo thật nếu device đo được bên dưới)");
  const projectionAssumed = await largeListProjection(2);
  for (const r of projectionAssumed) {
    console.log(`  total=${r.totalCards} pos=${r.targetPosition} -> status=${r.status} scrolls=${r.scrollsUsed} hierarchyCalls=${r.hierarchyCalls}`);
  }

  // ===== PHẦN CẦN DEVICE (có thể BLOCKED_BY_INFRA) =====
  console.log("\n[DEVICE] Khởi động MaestroMcpBridge để đo geometry/timing thật...");
  if (!APP_ID) {
    console.log("  [BLOCKED_BY_INFRA] Thiếu APP_ID trong .env - không thể khởi động bridge.");
    printFinalReport({ skipRisk, projectionAssumed, deviceBlocked: true, blockReason: "Thiếu APP_ID" });
    return;
  }

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  let startOk = false;
  let startErr = null;
  try {
    await bridge.start();
    startOk = true;
  } catch (err) {
    startErr = err?.message ?? String(err);
    console.log(`  [BLOCKED_BY_INFRA] bridge.start() thất bại: ${startErr}`);
  }

  if (!startOk) {
    printFinalReport({ skipRisk, projectionAssumed, deviceBlocked: true, blockReason: startErr, infraLog });
    return;
  }

  try {
    console.log("  [PASS] Bridge đã sống. Đảm bảo đang ở tab \"Bài tập\" (phiên MCP mới có thể kế thừa vị trí cuộn/tab từ app process cũ)...");
    await withInfraRetry("tap Bài tập tab", () => bridge.runSteps([{ tapOn: { text: "Bài tập" } }]));
    await withInfraRetry("wait after tab tap", () => bridge.runSteps([{ waitForAnimationToEnd: { timeout: 2000 } }]));
    console.log("  Cuộn về đỉnh danh sách trước khi benchmark...");
    const topResult = await withInfraRetry("scrollToTop", () => scrollToTop(bridge));
    if (!topResult.ok || !topResult.value.atTop) {
      console.log(`  [WARN] scrollToTop() không xác nhận được atTop (${topResult.ok ? topResult.value.reason : "infra retry exhausted"}) - vẫn tiếp tục, nhưng geometry đo được có thể không đáng tin cậy nếu list thật sự rỗng ở vị trí hiện tại.`);
    }

    console.log(`\n[DEVICE] Benchmark Strategy A (${ROUNDS_PER_STRATEGY} lượt)...`);
    const roundsA = await benchStrategy(bridge, STRATEGY_A, "StrategyA");
    const summaryA = summarizeRounds(roundsA, "Strategy A");
    console.log(`  validRounds=${summaryA.validRounds ?? 0}/${ROUNDS_PER_STRATEGY}, infraCount=${summaryA.infraCount}`);
    for (const r of roundsA.filter((r) => !r.infraFailure)) {
      console.log(
        `    round: before=${r.beforeCardCount} after=${r.afterCardCount} shared=${r.sharedCount} new=${r.newCount} disappeared=${r.disappearedCount} disappearedTitles=${JSON.stringify(r.disappearedTitles)}`,
      );
    }

    console.log(`\n[DEVICE] scrollToTop() lại trước Strategy B (Strategy A đã cuộn qua hết danh sách thật, cần reset để B cũng có dữ liệu thật)...`);
    const topResult2 = await withInfraRetry("scrollToTop(before B)", () => scrollToTop(bridge));
    if (!topResult2.ok || !topResult2.value.atTop) {
      console.log(`  [WARN] scrollToTop() trước Strategy B không xác nhận được (${topResult2.ok ? topResult2.value.reason : "infra retry exhausted"}) - Strategy B có thể vẫn chạy trên vùng list đã cạn.`);
    }
    console.log(`\n[DEVICE] Benchmark Strategy B (${ROUNDS_PER_STRATEGY} lượt)...`);
    const roundsB = await benchStrategy(bridge, STRATEGY_B, "StrategyB");
    const summaryB = summarizeRounds(roundsB, "Strategy B");
    console.log(`  validRounds=${summaryB.validRounds ?? 0}/${ROUNDS_PER_STRATEGY}, infraCount=${summaryB.infraCount}`);
    for (const r of roundsB.filter((r) => !r.infraFailure)) {
      console.log(
        `    round: before=${r.beforeCardCount} after=${r.afterCardCount} shared=${r.sharedCount} new=${r.newCount} disappeared=${r.disappearedCount} disappearedTitles=${JSON.stringify(r.disappearedTitles)}`,
      );
    }

    // Nếu có số đo thật (medianCardPitchPx + medianYShiftPx), chạy lại large-list projection với
    // revealPerSwipe THẬT thay vì giả định =2. cardsPerViewport CŨNG lấy từ avgCardsPerSnapshot đo
    // thật (KHÔNG giữ default=5 - benchmark thật cho thấy viewport chỉ chứa ~1.2-1.8 card, dùng
    // default=5 sẽ TỰ TẠO overlap giả không khớp geometry thật đã đo).
    let projectionMeasured = null;
    const pitch = summaryA.medianCardPitchPx ?? summaryB.medianCardPitchPx;
    const yShift = summaryA.medianYShiftPx ?? summaryB.medianYShiftPx;
    const avgCardsPerSnapshotMeasured = summaryA.avgCardsPerSnapshot || summaryB.avgCardsPerSnapshot;
    const avgNewCardsMeasured = summaryA.avgNewCardsPerSwipe || summaryB.avgNewCardsPerSwipe;
    if (pitch && yShift) {
      const revealPerSwipeMeasured = Math.max(1, Math.round(yShift / pitch));
      const cardsPerViewportMeasured = Math.max(1, Math.round(avgCardsPerSnapshotMeasured || revealPerSwipeMeasured));
      console.log(
        `\n[PURE] Large-list PROJECTION lại với revealPerSwipe ĐO ĐƯỢC = round(${yShift}/${pitch}) = ${revealPerSwipeMeasured}, cardsPerViewport ĐO ĐƯỢC = ${cardsPerViewportMeasured}...`,
      );
      projectionMeasured = { revealPerSwipeMeasured, cardsPerViewportMeasured, results: await largeListProjection(revealPerSwipeMeasured, cardsPerViewportMeasured) };
      for (const r of projectionMeasured.results) {
        console.log(`  total=${r.totalCards} pos=${r.targetPosition} -> status=${r.status} scrolls=${r.scrollsUsed} hierarchyCalls=${r.hierarchyCalls}`);
      }
    } else if (avgCardsPerSnapshotMeasured && avgNewCardsMeasured) {
      // yShift không đo được (CHÍNH VÌ 0 overlap mọi round - xem mục C) - dùng avgCardsPerSnapshot/
      // avgNewCardsPerSwipe (đo được độc lập, không cần Y-shift) để tái tạo TRUNG THỰC đúng geometry
      // zero-overlap đã benchmark: cardsPerViewport NHỎ (~1-2), revealPerSwipe = cardsPerViewport (0
      // overlap by construction) - đây là fixture PHẢN ÁNH ĐÚNG pathology thật đo được hôm nay, KHÔNG
      // phải fixture "an toàn" dùng cardsPerViewport mặc định =5 (sẽ tự tạo overlap giả không có thật).
      const cardsPerViewportMeasured = Math.max(1, Math.round(avgCardsPerSnapshotMeasured));
      const revealPerSwipeMeasured = cardsPerViewportMeasured; // = cardsPerViewport -> 0 overlap by construction, khớp benchmark (sharedCount=0 mọi round).
      console.log(
        `\n[PURE] Large-list PROJECTION lại với cardsPerViewport ĐO ĐƯỢC = round(${avgCardsPerSnapshotMeasured}) = ${cardsPerViewportMeasured}, revealPerSwipe = cardsPerViewport (tái tạo ĐÚNG zero-overlap đã benchmark, vì Y-shift không đo được CHÍNH VÌ 0 overlap mọi round)...`,
      );
      projectionMeasured = { revealPerSwipeMeasured, cardsPerViewportMeasured, zeroOverlapByConstruction: true, results: await largeListProjection(revealPerSwipeMeasured, cardsPerViewportMeasured) };
      for (const r of projectionMeasured.results) {
        console.log(`  total=${r.totalCards} pos=${r.targetPosition} -> status=${r.status} scrolls=${r.scrollsUsed} hierarchyCalls=${r.hierarchyCalls} lowConfidenceCount=${r.lowConfidenceCount} unresolvedGapSteps=${r.unresolvedGapSteps}`);
      }
    }

    printFinalReport({ skipRisk, projectionAssumed, projectionMeasured, summaryA, summaryB, deviceBlocked: false, infraLog });
  } finally {
    await bridge.stop();
    console.log("\n[MCP] Đã dừng tiến trình `maestro mcp`.");
  }
}

function fmt(n, unit = "") {
  if (n == null || Number.isNaN(n)) return "N/A";
  return `${Math.round(n * 100) / 100}${unit}`;
}

function printFinalReport({ skipRisk, projectionAssumed, projectionMeasured, summaryA, summaryB, deviceBlocked, blockReason, infraLog: infra }) {
  console.log("\n\n========================================");
  console.log("=== FINAL REPORT (A-F) ===");
  console.log("========================================\n");

  console.log("--- A. Measured facts (Strategy A/B) ---");
  if (deviceBlocked) {
    console.log(`BLOCKED_BY_INFRA - không đo được geometry/timing thật trên device. Lý do: ${blockReason ?? "?"}`);
    console.log(`Số lần INFRA_FAILURE trong phiên này: ${infra?.count ?? 0}`);
  } else {
    for (const s of [summaryA, summaryB]) {
      console.log(`[${s.label}] validRounds=${s.validRounds}/${ROUNDS_PER_STRATEGY}, infraFailures=${s.infraCount}`);
      console.log(`  medianYShiftPx=${fmt(s.medianYShiftPx, "px")} (samples=${JSON.stringify(s.yShiftSamples)})`);
      console.log(`  medianCardPitchPx=${fmt(s.medianCardPitchPx, "px")} (samples=${JSON.stringify(s.pitchSamples)})`);
      console.log(`  avgCardsPerSnapshot=${fmt(s.avgCardsPerSnapshot)}`);
      console.log(`  avgNewCardsPerSwipe=${fmt(s.avgNewCardsPerSwipe)}  avgSharedPerSwipe=${fmt(s.avgSharedPerSwipe)}  avgDisappearedPerSwipe=${fmt(s.avgDisappearedPerSwipe)}`);
    }
  }

  console.log("\n--- B. Card geometry ---");
  if (deviceBlocked) {
    console.log("NOT_AVAILABLE (BLOCKED_BY_INFRA) - card height/viewport height/cards-per-viewport/overlap KHÔNG đo được thật lần này.");
  } else {
    console.log(`card pitch (A)=${fmt(summaryA.medianCardPitchPx, "px")}  card pitch (B)=${fmt(summaryB.medianCardPitchPx, "px")}`);
    console.log(`Y-shift (A)=${fmt(summaryA.medianYShiftPx, "px")}  Y-shift (B)=${fmt(summaryB.medianYShiftPx, "px")}`);
    console.log(`cards/viewport (A)=${fmt(summaryA.avgCardsPerSnapshot)}  (B)=${fmt(summaryB.avgCardsPerSnapshot)}`);
    console.log(`new cards/swipe (A)=${fmt(summaryA.avgNewCardsPerSwipe)}  (B)=${fmt(summaryB.avgNewCardsPerSwipe)}`);
  }

  console.log("\n--- C. Skip analysis ---");
  console.log(`Mechanism-level (fixture, KHÔNG cần device): ${skipRisk.mechanismFinding}`);
  // QUAN TRỌNG: "disappeared + sharedCount=0" KHÔNG tự động là skip thật - nếu afterCardCount===0
  // (màn sau hoàn toàn trống), cách giải thích đơn giản hơn là ĐÃ CUỘN QUA HẾT DANH SÁCH THẬT (list
  // ngắn, hết nội dung), KHÔNG PHẢI bỏ sót nội dung còn tồn tại. Chỉ tính là bằng chứng skip thật khi
  // sau swipe VẪN còn card hiển thị (afterCardCount>0) NHƯNG không có card nào trùng với trước đó -
  // nghĩa là có NỘI DUNG THẬT ở cả 2 phía nhưng không phía nào nối được với phía kia.
  const realSkipRounds = (deviceBlocked ? [] : [...(summaryA.rounds ?? []), ...(summaryB.rounds ?? [])]).filter(
    (r) => r.sharedCount === 0 && r.disappearedCount > 0 && r.afterCardCount > 0,
  );
  const endOfListRounds = (deviceBlocked ? [] : [...(summaryA.rounds ?? []), ...(summaryB.rounds ?? [])]).filter(
    (r) => r.sharedCount === 0 && r.disappearedCount > 0 && r.afterCardCount === 0,
  );
  let realWorldVerdict;
  if (deviceBlocked) {
    realWorldVerdict = "NOT_PROVEN (BLOCKED_BY_INFRA, chưa đo được)";
  } else if (realSkipRounds.length > 0) {
    realWorldVerdict = `CONFIRMED - ${realSkipRounds.length} lượt có card biến mất, sharedCount=0, NHƯNG sau swipe vẫn còn card khác hiển thị (afterCardCount>0) - tức là có nội dung thật ở cả 2 phía không nối được với nhau, không thể giải thích bằng "đã hết danh sách".`;
  } else if (endOfListRounds.length > 0) {
    realWorldVerdict = `NOT_PROVEN cho skip thật - có ${endOfListRounds.length} lượt "disappeared + sharedCount=0" NHƯNG afterCardCount=0 ở TẤT CẢ (màn sau trống hoàn toàn) - giải thích đơn giản hơn và nhất quán hơn là ĐÃ CUỘN QUA HẾT danh sách thật (list ngắn), KHÔNG PHẢI bỏ sót nội dung. Không dựng được phản ví dụ thật cho skip với dữ liệu này.`;
  } else {
    realWorldVerdict = "NOT_PROVEN - mọi lượt đo thật đều có ít nhất 1 card chung giữa 2 snapshot (hoặc màn sau trống), không dựng được phản ví dụ.";
  }
  console.log(`Real-world-occurrence (cần device đo pitch/Y-shift thật): ${realWorldVerdict}`);

  console.log("\n--- D. Cost analysis ---");
  if (deviceBlocked) {
    console.log("NOT_AVAILABLE (BLOCKED_BY_INFRA).");
  } else {
    for (const s of [summaryA, summaryB]) {
      console.log(`[${s.label}] avgSwipeMs=${fmt(s.avgSwipeMs, "ms")}  avgWaitMs=${fmt(s.avgWaitMs, "ms")}  avgHierarchyMs=${fmt(s.avgHierarchyMs, "ms")}`);
      const total = (s.avgSwipeMs ?? 0) + (s.avgWaitMs ?? 0) + (s.avgHierarchyMs ?? 0) * 2;
      console.log(`  total per scroll round (ước tính cộng dồn swipe+wait+2×hierarchy)=${fmt(total, "ms")}`);
    }
  }

  console.log("\n--- E. Large-list projection ---");
  console.log("MEASURED (synthetic fixture, chạy qua findAssignment() thật, KHÔNG phải device thật, scrollsUsed/hierarchyCalls LÀ con số thật từ chính engine production):");
  const table = projectionMeasured?.results ?? projectionAssumed;
  const tag = projectionMeasured ? `revealPerSwipe ĐO ĐƯỢC thật = ${projectionMeasured.revealPerSwipeMeasured}` : "revealPerSwipe GIẢ ĐỊNH = 2 (PROJECTED, chưa đo được thật - xem mục A)";
  console.log(`  (tham số hoá: ${tag})`);
  for (const r of table) {
    console.log(
      `  total=${r.totalCards} pos=${r.targetPosition} -> status=${r.status} scrollsUsed(MEASURED)=${r.scrollsUsed} hierarchyCalls(MEASURED)=${r.hierarchyCalls}${r.lowConfidenceCount != null ? ` lowConfidenceCount=${r.lowConfidenceCount} unresolvedGapSteps=${r.unresolvedGapSteps}` : ""}`,
    );
  }
  if (!projectionMeasured) {
    console.log("  LƯU Ý: vì revealPerSwipe ở trên là GIẢ ĐỊNH (không đo được thật do BLOCKED_BY_INFRA/thiếu dữ liệu), scrollsUsed/hierarchyCalls phía trên là PROJECTED (phụ thuộc giả định), KHÔNG phải MEASURED trên hành vi thật của device.");
  }
  if (deviceBlocked) {
    console.log("  Thời gian thực tế tương ứng (giây) cho mỗi scroll: NOT_AVAILABLE (cần mục D, hiện BLOCKED_BY_INFRA).");
  } else {
    const perScrollMs = ((summaryA.avgSwipeMs ?? 0) + (summaryA.avgWaitMs ?? 0) + (summaryA.avgHierarchyMs ?? 0) * 2);
    console.log(`  Thời gian PROJECTED (giây) = scrollsUsed × ${fmt(perScrollMs, "ms")}/scroll (đo thật Strategy A):`);
    for (const r of table) {
      if (typeof r.scrollsUsed === "number") console.log(`    total=${r.totalCards} pos=${r.targetPosition}: ~${fmt((r.scrollsUsed * perScrollMs) / 1000, "s")} (PROJECTED)`);
    }
  }

  console.log("\n--- F. Recommendation ---");
  if (deviceBlocked) {
    console.log("BLOCKED_BY_INFRA cho toàn bộ phần đo geometry/timing thật trên device - KHÔNG đủ dữ liệu để khuyến nghị scroll percentage/overlap tối thiểu/warning threshold cụ thể.");
    console.log("Điều CÓ THỂ kết luận từ phần PURE (không cần device): mechanism hiện tại không tự phát hiện 0-overlap (xem mục C) - đây là khuyến nghị CORRECTNESS, không phụ thuộc benchmark device, nên ưu tiên xử lý trước khi tối ưu performance, ĐÚNG nguyên tắc user đã nêu ('nếu có skip risk, ưu tiên sửa correctness trước performance') một khi real-world-occurrence được xác nhận CONFIRMED ở lần benchmark kế tiếp (device ổn định).");
  } else {
    console.log("(Chỉ liệt kê SAU KHI có số liệu - xem mục A-E ở trên để tự đánh giá theo đúng 2 nhánh user đã định: nếu Strategy A hiện tại an toàn nhưng chỉ chậm -> tối ưu performance; nếu phát hiện skip risk real-world -> ưu tiên sửa correctness trước.)");
  }
  console.log(`\nTổng số INFRA_FAILURE ghi nhận trong phiên benchmark này: ${infra?.count ?? 0}`);
  if (infra?.errors?.length) {
    console.log("Chi tiết:");
    for (const e of infra.errors) console.log(`  - [${e.label}] lượt ${e.attempt}: ${e.msg}`);
  }
}

main().catch((err) => {
  console.error("\n[assignmentSearchBenchmark] Dừng vì lỗi ngoài dự kiến:", err);
  process.exit(1);
});
