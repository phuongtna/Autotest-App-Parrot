#!/usr/bin/env node
/**
 * amplitudeBenchmark.mjs - BENCHMARK-ONLY, KHÔNG sửa production search logic.
 *
 * Phase 3 (2026-10-06, theo yêu cầu "Benchmark amplitude" sau khi Phase 2 fix correctness xong):
 * đo SỐ LIỆU THẬT overlap/geometry/cost cho NHIỀU amplitude swipe khác nhau (10/15/20/25/30/35[/40]%)
 * trên device thật, để tìm (các) amplitude có overlap ổn định - KHÔNG implement adaptive scroll,
 * KHÔNG đổi production, KHÔNG đổi WAIT_AFTER_SCROLL_MS/MAX_LOCATE_SCROLLS.
 *
 * CHỈ ĐỌC (import readonly) từ production:
 *   - findAssignment.js (scrollToTop, findAssignment)
 *   - assignmentSearchEngine.js (KHÔNG dùng trong file này - geometry benchmark không cần state machine)
 *   - homeworkUiList.js (collectTextNodesWithBoundsInsideScrollableList, parseHomeworkCardsWithDetail)
 *   - navigation/homeworkNavigationEngine.js (HomeworkNavigationEngine.openHomeworkTab() - nav tin cậy,
 *     đã verify thật 2026-08-06, KHÔNG dùng tapOn({text:"Bài tập"}) thô vì đã CONFIRMED match nhầm
 *     sang nội dung Vui học khi app đang ở tab khác - xem check_list_state.log phiên benchmark này)
 *   - bridge/maestroMcpBridge.js (MaestroMcpBridge - hạ tầng)
 *
 * CHẠY: node automation/bai_tap/discovery/amplitudeBenchmark.mjs
 * OUTPUT: in trực tiếp ra console theo đúng 9 mục user yêu cầu; KHÔNG ghi file production.
 */

import { fileURLToPath } from "node:url";
import { parseEnvFile } from "../../src/config.js";
import { MaestroMcpBridge } from "../../bridge/maestroMcpBridge.js";
import { collectTextNodesWithBoundsInsideScrollableList, parseHomeworkCardsWithDetail } from "./homeworkUiList.js";
import { scrollToTop, findAssignment } from "./findAssignment.js";
import { HomeworkNavigationEngine } from "../navigation/homeworkNavigationEngine.js";
import { homeworkPageObjects as po } from "../navigation/homeworkPageObjects.js";

const PROJECT_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const ROOT_ENV = parseEnvFile(PROJECT_ROOT + ".env");
const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";

// Amplitude = % màn hình di chuyển trong 1 swipe. Cùng X-anchor (50%) + start Y (80%) với
// Strategy A hiện tại (assignmentSearchEngine.js) - CHỈ amplitude (end Y) thay đổi, duration giữ
// nguyên 400ms (không thuộc phạm vi "amplitude", không đổi theo yêu cầu #9).
const AMPLITUDES = [10, 15, 20, 25, 30, 35];
// LƯU Ý (Phase 4, 2026-10-06): 55% KHÔNG còn là "Strategy A hiện tại" - production đã đổi sang 25%
// (xem assignmentSearchEngine.js) dựa trên chính kết quả benchmark này. Giữ nguyên 55% ở đây làm
// baseline LỊCH SỬ (giá trị TRƯỚC Phase 4) để lần chạy lại script này trong tương lai vẫn tái hiện
// được đúng phép so sánh "cũ vs mới" đã dùng để ra quyết định Phase 4 - KHÔNG đổi thành 25% (nếu đổi
// sẽ trùng với 1 phần tử trong AMPLITUDES, mất luôn ý nghĩa "baseline").
const BASELINE_AMPLITUDE = 55;
const EXTRA_AMPLITUDE_IF_35_UNSAFE = 40;

const ROUNDS_PER_AMPLITUDE = 6;
const WAIT_AFTER_SCROLL_MS = 1200; // COPY NGUYÊN VĂN assignmentSearchEngine.js - KHÔNG đổi (yêu cầu #9).
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
      throw err;
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
function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  if (!s.length) return null;
  return s[Math.floor(s.length / 2)];
}
function mean(nums) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function medianPitch(cards) {
  const ys = cards.map((c) => c.titleBounds?.y1).filter((y) => typeof y === "number").sort((a, b) => a - b);
  if (ys.length < 2) return null;
  const diffs = [];
  for (let i = 1; i < ys.length; i++) diffs.push(ys[i] - ys[i - 1]);
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)];
}

function strategyForAmplitude(amp) {
  const endY = 80 - amp;
  return { start: "50%,80%", end: `50%,${endY}%`, duration: 400, amplitude: amp };
}

/** 1 round = read(before) -> swipe -> wait -> read(after), đúng method Phase 1/2 benchStrategy(). */
async function benchOneRound(bridge, strategy, label) {
  const beforeT = await withInfraRetry(`${label} hierarchy(before)`, () => timed(() => bridge.hierarchy()));
  if (!beforeT.ok) return { infraFailure: true };
  const before = readCards(beforeT.value.result);
  const beforeHierarchyMs = beforeT.value.durationMs;

  const swipeT = await withInfraRetry(`${label} swipe`, () => timed(() => bridge.runSteps([{ swipe: { start: strategy.start, end: strategy.end, duration: strategy.duration } }])));
  if (!swipeT.ok || !swipeT.value.result.success) return { infraFailure: true, reason: swipeT.ok ? swipeT.value.result.error : "retry exhausted" };
  const swipeMs = swipeT.value.durationMs;

  const waitT = await withInfraRetry(`${label} wait`, () => timed(() => bridge.runSteps([{ waitForAnimationToEnd: { timeout: WAIT_AFTER_SCROLL_MS } }])));
  if (!waitT.ok) return { infraFailure: true };
  const waitMs = waitT.value.durationMs;

  const afterT = await withInfraRetry(`${label} hierarchy(after)`, () => timed(() => bridge.hierarchy()));
  if (!afterT.ok) return { infraFailure: true };
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

  const beforeCardCount = before.cards.length;
  const afterCardCount = after.cards.length;
  const sharedCount = sharedKeys.length;
  const newCount = newKeys.length;
  const disappearedCount = disappearedKeys.length;
  const hasOverlap = sharedCount > 0;
  const sameViewport = newCount === 0 && disappearedCount === 0 && beforeCardCount === afterCardCount && beforeCardCount > 0;

  let classification;
  if (beforeCardCount === 0 && afterCardCount === 0) classification = "EMPTY_VIEWPORT";
  else if (sameViewport) classification = "NO_PROGRESS";
  else if (hasOverlap) classification = "SAFE_OVERLAP";
  else if (afterCardCount > 0) classification = "NO_OVERLAP";
  else classification = "END_OF_LIST_LIKELY";

  return {
    infraFailure: false,
    classification,
    beforeCardCount,
    afterCardCount,
    beforeTitles: before.cards.map((c) => c.title),
    afterTitles: after.cards.map((c) => c.title),
    sharedCount,
    newCount,
    disappearedCount,
    disappearedTitles: disappearedKeys.map((k) => k.split("|")[0]),
    hasOverlap,
    yShifts,
    medianYShift: median(yShifts),
    beforePitch: medianPitch(before.cards),
    afterPitch: medianPitch(after.cards),
    timing: { swipeMs, waitMs, beforeHierarchyMs, afterHierarchyMs },
    elapsedMs: swipeMs + waitMs + beforeHierarchyMs + afterHierarchyMs,
  };
}

async function benchAmplitude(bridge, amp) {
  const strategy = strategyForAmplitude(amp);
  const label = `amp${amp}%`;
  console.log(`\n[DEVICE] Benchmark amplitude=${amp}% (swipe ${strategy.start} -> ${strategy.end}, ${ROUNDS_PER_AMPLITUDE} lượt)...`);

  const topResult = await withInfraRetry(`${label} scrollToTop`, () => scrollToTop(bridge));
  if (!topResult.ok || !topResult.value.atTop) {
    console.log(`  [WARN] scrollToTop() không xác nhận được atTop trước amplitude=${amp}% (${topResult.ok ? topResult.value.reason : "infra retry exhausted"}) - geometry đo được có thể không bắt đầu từ đỉnh thật.`);
  }

  const rounds = [];
  for (let i = 0; i < ROUNDS_PER_AMPLITUDE; i++) {
    const r = await benchOneRound(bridge, strategy, `${label} round${i}`);
    rounds.push(r);
    if (r.infraFailure) {
      console.log(`    round ${i}: INFRA_FAILURE`);
    } else {
      console.log(
        `    round ${i}: [${r.classification}] before=${r.beforeCardCount} after=${r.afterCardCount} shared=${r.sharedCount} new=${r.newCount} disappeared=${r.disappearedCount} yShift=${r.medianYShift ?? "N/A"} elapsedMs=${Math.round(r.elapsedMs)}`,
      );
    }
  }
  return { amp, strategy, rounds };
}

function summarizeAmplitude({ amp, rounds }) {
  const valid = rounds.filter((r) => !r.infraFailure);
  const infraCount = rounds.length - valid.length;
  if (!valid.length) {
    return { amp, infraCount, validRounds: 0, status: "BLOCKED_BY_INFRA" };
  }
  const safeOverlap = valid.filter((r) => r.classification === "SAFE_OVERLAP");
  const noOverlap = valid.filter((r) => r.classification === "NO_OVERLAP");
  const noProgress = valid.filter((r) => r.classification === "NO_PROGRESS");
  const endOfList = valid.filter((r) => r.classification === "END_OF_LIST_LIKELY" || r.classification === "EMPTY_VIEWPORT");
  const overlapRoundsCount = valid.filter((r) => r.sharedCount > 0).length; // đúng công thức user yêu cầu mục #6: sharedCount>0 / tổng valid rounds.
  const overlapRate = overlapRoundsCount / valid.length;
  const allYShifts = valid.flatMap((r) => r.yShifts);
  const totalMs = valid.map((r) => r.elapsedMs);

  // Pattern "zero-overlap lặp lại liên tiếp" (yêu cầu mục #4.2): đếm chuỗi dài nhất các round liên tiếp có classification NO_OVERLAP.
  let maxConsecutiveNoOverlap = 0;
  let cur = 0;
  for (const r of valid) {
    if (r.classification === "NO_OVERLAP") {
      cur++;
      maxConsecutiveNoOverlap = Math.max(maxConsecutiveNoOverlap, cur);
    } else cur = 0;
  }

  return {
    amp,
    infraCount,
    validRounds: valid.length,
    safeOverlapCount: safeOverlap.length,
    noOverlapCount: noOverlap.length,
    noProgressCount: noProgress.length,
    endOfListCount: endOfList.length,
    overlapRate,
    maxConsecutiveNoOverlap,
    avgSharedCount: mean(valid.map((r) => r.sharedCount)),
    avgNewCount: mean(valid.map((r) => r.newCount)),
    avgDisappearedCount: mean(valid.map((r) => r.disappearedCount)),
    medianYShiftPx: median(allYShifts),
    yShiftSamples: allYShifts,
    avgCardsPerSnapshot: mean(valid.map((r) => r.beforeCardCount)),
    noProgressRate: noProgress.length / valid.length,
    avgRoundMs: mean(totalMs),
    rounds: valid,
  };
}

/**
 * SAFE_CANDIDATE - operationalize đúng 5 điều kiện user yêu cầu mục #4 (tất cả đều có thể kiểm tra
 * được trực tiếp từ dữ liệu đo, KHÔNG dùng ngưỡng ma thuật ẩn):
 *  1. Nhiều round liên tiếp sharedCount>0            -> overlapRate === 1 (TẤT CẢ valid round, không chỉ "nhiều")
 *  2. Không có pattern zero-overlap lặp lại           -> maxConsecutiveNoOverlap === 0
 *  3. Có ít nhất 1 anchor card chung                  -> avgSharedCount > 0 (suy ra từ #1 khi overlapRate=1)
 *  4. Vẫn reveal được card mới                        -> avgNewCount > 0
 *  5. Không tạo repeated same viewport quá thường xuyên -> noProgressCount === 0
 * Yêu cầu CHẶT (không phải "đa số") vì đây là tiêu chí an toàn correctness, không phải performance -
 * 1 round NO_OVERLAP vẫn là 1 lần có khả năng bỏ sót nội dung thật (xem Phase 2 root cause).
 */
function classifySafety(summary) {
  if (summary.validRounds === 0) return { verdict: "REJECTED", reason: "BLOCKED_BY_INFRA - không có round hợp lệ nào để đánh giá." };
  const reasons = [];
  if (summary.overlapRate < 1) reasons.push(`overlapRate=${(summary.overlapRate * 100).toFixed(0)}% < 100% (có ${summary.noOverlapCount} round NO_OVERLAP thật, risk bỏ sót nội dung như Phase 2 root cause)`);
  if (summary.maxConsecutiveNoOverlap > 0) reasons.push(`có chuỗi ${summary.maxConsecutiveNoOverlap} round NO_OVERLAP liên tiếp`);
  if (summary.avgNewCount <= 0) reasons.push(`avgNewCount=${summary.avgNewCount} - không reveal được card mới (có thể đã hết list hoặc amplitude quá nhỏ)`);
  if (summary.noProgressCount > 0) reasons.push(`có ${summary.noProgressCount} round NO_PROGRESS (gesture không tạo tác dụng - viewport y hệt trước/sau)`);
  if (reasons.length === 0) return { verdict: "SAFE_CANDIDATE", reason: "100% valid round có overlap, không NO_OVERLAP/NO_PROGRESS nào, vẫn reveal card mới." };
  return { verdict: "REJECTED", reason: reasons.join("; ") };
}

// ===== Phần reachability (synthetic 30/50/100 card, qua findAssignment() thật) =====
function buildOverlappingListBridge(totalCards, cardsPerViewport, revealPerSwipe) {
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

async function reachabilityBenchmark(cardsPerViewport, revealPerSwipe) {
  const sizes = [30, 50, 100];
  const positions = [
    { label: "giữa list", frac: 0.5 },
    { label: "gần cuối list", frac: 0.9 },
    { label: "cuối list (final card)", frac: 0.99 },
  ];
  const results = [];
  for (const total of sizes) {
    for (const pos of positions) {
      const targetIdx = Math.min(total - 1, Math.max(0, Math.round(total * pos.frac)));
      const { bridge, getHierarchyCalls } = buildOverlappingListBridge(total, cardsPerViewport, revealPerSwipe);
      const targetTitle = `Synthetic Card ${targetIdx}`;
      const result = await findAssignment(bridge, { title: targetTitle, cta: "Làm bài" }, { maxScrolls: 60 });
      results.push({
        totalCards: total,
        targetPosition: pos.label,
        targetIdx,
        status: result.status,
        reason: result.reason ?? null,
        scrollsUsed: result.scrollCount,
        hierarchyCalls: getHierarchyCalls(),
        lowConfidenceCount: result.lowConfidenceCount ?? null,
        unresolvedGapSteps: result.unresolvedGapSteps ?? null,
      });
    }
  }
  return results;
}

function fmt(n, unit = "") {
  if (n == null || Number.isNaN(n)) return "N/A";
  return `${Math.round(n * 100) / 100}${unit}`;
}

async function main() {
  console.log("=== amplitudeBenchmark.mjs - Phase 3 (KHÔNG sửa production logic) ===");
  console.log(`Amplitudes test: [${[...AMPLITUDES, BASELINE_AMPLITUDE].join(", ")}]% (baseline=${BASELINE_AMPLITUDE}% = Strategy A hiện tại)\n`);

  if (!APP_ID) {
    console.log("[BLOCKED_BY_INFRA] Thiếu APP_ID trong .env - không thể khởi động bridge. Dừng toàn bộ Phase 3.");
    return;
  }

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  try {
    await bridge.start();
  } catch (err) {
    console.log(`[BLOCKED_BY_INFRA] bridge.start() thất bại: ${err?.message ?? err}`);
    return;
  }

  const summaries = [];
  try {
    const nav = new HomeworkNavigationEngine(bridge);
    console.log("[NAV] openHomeworkTab() (nav tin cậy, KHÔNG dùng tapOn thô)...");
    const navResult = await withInfraRetry("openHomeworkTab", () => nav.openHomeworkTab());
    if (!navResult.ok) {
      console.log(`[BLOCKED_BY_INFRA] openHomeworkTab() thất bại: ${navResult.error?.message ?? navResult.error}`);
      await bridge.stop();
      return;
    }
    console.log("  [PASS] Đã ở tab Bài tập (section 'Bài tập về nhà' xác nhận hiển thị).");

    console.log("[NAV] scrollToTop() trước khi mở Filter Sheet (header filter chỉ hiển thị khi ở đỉnh danh sách)...");
    const preFilterTop = await withInfraRetry("scrollToTop(pre-filter)", () => scrollToTop(bridge));
    if (!preFilterTop.ok || !preFilterTop.value.atTop) {
      console.log(`  [WARN] scrollToTop() trước filter không xác nhận được (${preFilterTop.ok ? preFilterTop.value.reason : "infra retry exhausted"}) - mở Filter Sheet có thể vẫn fail nếu header thật sự không hiển thị.`);
    }

    console.log("[NAV] Áp filter '1 tháng gần nhất' để lấy đủ list thật (list ngắn hơn với filter mặc định 2 tuần)...");
    // KHÔNG dùng withInfraRetry ở đây - lỗi "Element not found" KHÔNG phải infra error (không retry
    // được bằng cách lặp lại), và KHÔNG nên làm crash toàn bộ Phase 3 chỉ vì filter sheet không mở
    // được (best-effort improvement, không phải điều kiện bắt buộc để benchmark amplitude).
    let filterResult = { ok: true };
    try {
      await nav.openFilterSheet();
      await nav.selectFilterRange(po.filterSheet.optionOneMonth);
      await nav.applyFilter();
      await bridge.runSteps([{ waitForAnimationToEnd: { timeout: 2000 } }]);
    } catch (err) {
      filterResult = { ok: false, error: err };
    }
    if (!filterResult.ok) {
      console.log(`  [WARN] Không áp được filter 1 tháng (${filterResult.error?.message ?? filterResult.error}) - tiếp tục với filter hiện tại, list có thể ngắn hơn kỳ vọng.`);
    } else {
      console.log("  [PASS] Đã áp filter '1 tháng gần nhất'.");
    }

    const ampsToRun = [...AMPLITUDES, BASELINE_AMPLITUDE];
    for (const amp of ampsToRun) {
      const result = await benchAmplitude(bridge, amp);
      const summary = summarizeAmplitude(result);
      const safety = classifySafety(summary);
      summaries.push({ ...summary, safety });
      console.log(`  => amplitude=${amp}%: overlapRate=${fmt((summary.overlapRate ?? 0) * 100)}% avgNewCount=${fmt(summary.avgNewCount)} noProgressCount=${summary.noProgressCount ?? "N/A"} verdict=${safety.verdict}`);
    }

    // Nếu 35% vẫn REJECTED, thử thêm 40% (yêu cầu #2: "có thể mở rộng thêm 40%, KHÔNG tự ý nhảy lên 50%+").
    const s35 = summaries.find((s) => s.amp === 35);
    if (s35 && s35.safety.verdict !== "SAFE_CANDIDATE") {
      console.log(`\n[EXTEND] amplitude=35% vẫn REJECTED (${s35.safety.reason}) - mở rộng thêm ${EXTRA_AMPLITUDE_IF_35_UNSAFE}% theo đúng cho phép của yêu cầu...`);
      const result40 = await benchAmplitude(bridge, EXTRA_AMPLITUDE_IF_35_UNSAFE);
      const summary40 = summarizeAmplitude(result40);
      const safety40 = classifySafety(summary40);
      summaries.push({ ...summary40, safety: safety40 });
      console.log(`  => amplitude=${EXTRA_AMPLITUDE_IF_35_UNSAFE}%: overlapRate=${fmt((summary40.overlapRate ?? 0) * 100)}% avgNewCount=${fmt(summary40.avgNewCount)} noProgressCount=${summary40.noProgressCount ?? "N/A"} verdict=${safety40.verdict}`);
    }

    printFinalReport(summaries);
  } finally {
    await bridge.stop();
    console.log("\n[MCP] Đã dừng tiến trình `maestro mcp`.");
  }
}

async function printFinalReport(summaries) {
  console.log("\n\n========================================");
  console.log("=== PHASE 3 FINAL REPORT ===");
  console.log("========================================\n");

  console.log("--- 2/3. Amplitude comparison table (MEASURED) ---");
  console.log("Amplitude | ValidRounds | OverlapRate | AvgShared | AvgNew | MedianYShift | NoProgressRate | AvgRoundMs | Verdict");
  for (const s of summaries) {
    console.log(
      `${s.amp}%\t| ${s.validRounds ?? 0}/${ROUNDS_PER_AMPLITUDE}\t| ${fmt((s.overlapRate ?? 0) * 100, "%")}\t| ${fmt(s.avgSharedCount)}\t| ${fmt(s.avgNewCount)}\t| ${fmt(s.medianYShiftPx, "px")}\t| ${fmt((s.noProgressRate ?? 0) * 100, "%")}\t| ${fmt(s.avgRoundMs, "ms")}\t| ${s.safety?.verdict ?? "N/A"}`,
    );
  }

  console.log("\n--- 3/4. SAFE_CANDIDATE vs REJECTED chi tiết ---");
  for (const s of summaries) {
    if (s.safety?.verdict === "SAFE_CANDIDATE") console.log(`  [SAFE_CANDIDATE] ${s.amp}%: ${s.safety.reason}`);
    else console.log(`  [REJECTED] ${s.amp}%: ${s.safety?.reason}`);
  }

  const candidates = summaries.filter((s) => s.safety?.verdict === "SAFE_CANDIDATE");
  console.log(`\n--- 5/6. Overlap rate / Reveal rate summary ---`);
  for (const s of summaries) {
    console.log(`  ${s.amp}%: overlapRate=${fmt((s.overlapRate ?? 0) * 100, "%")}  avgNewCount(reveal)=${fmt(s.avgNewCount)}  avgCardsPerSnapshot=${fmt(s.avgCardsPerSnapshot)}`);
  }

  console.log("\n--- 7. Reachability (100-card cuối, synthetic qua findAssignment() thật) ---");
  if (!candidates.length) {
    console.log("  KHÔNG có SAFE_CANDIDATE nào -> không chạy reachability benchmark (không có amplitude nào an toàn để dùng).");
  } else {
    // Chọn SAFE_CANDIDATE có avgNewCount cao nhất (amplitude lớn nhất vẫn an toàn -> ít scroll nhất cho cùng khoảng cách).
    const best = candidates.reduce((a, b) => ((b.avgNewCount ?? 0) > (a.avgNewCount ?? 0) ? b : a));
    console.log(`  Amplitude được chọn để benchmark reachability: ${best.amp}% (SAFE_CANDIDATE, avgNewCount cao nhất trong các candidate)`);
    const cardsPerViewport = Math.max(1, Math.round(best.avgCardsPerSnapshot || 1));
    const revealPerSwipe = Math.max(1, Math.round(best.avgNewCount || 1));
    console.log(`  Tham số hoá fixture từ số đo thật: cardsPerViewport=${cardsPerViewport} (round(avgCardsPerSnapshot)), revealPerSwipe=${revealPerSwipe} (round(avgNewCount)) - overlap=${cardsPerViewport - revealPerSwipe} card/swipe theo đúng tỉ lệ đo được.`);
    const reach = await reachabilityBenchmark(cardsPerViewport, revealPerSwipe);
    for (const r of reach) {
      console.log(`    total=${r.totalCards} pos=${r.targetPosition} -> status=${r.status}${r.reason ? `/${r.reason}` : ""} scrollsUsed=${r.scrollsUsed} lowConfidenceCount=${r.lowConfidenceCount} unresolvedGapSteps=${r.unresolvedGapSteps}`);
    }
    const final100 = reach.find((r) => r.totalCards === 100 && r.targetPosition === "cuối list (final card)");
    console.log(`\n  === 100 cards + target cuối: status=${final100?.status}${final100?.reason ? `/${final100.reason}` : ""} scrollsUsed=${final100?.scrollsUsed} ===`);
  }

  console.log("\n--- 8. So sánh với Strategy A hiện tại (baseline=55%, benchmark CÙNG session) ---");
  const baseline = summaries.find((s) => s.amp === BASELINE_AMPLITUDE);
  if (baseline) {
    console.log(`  Baseline (55%, = Strategy A production): overlapRate=${fmt((baseline.overlapRate ?? 0) * 100, "%")} avgNewCount=${fmt(baseline.avgNewCount)} verdict=${baseline.safety?.verdict}`);
    for (const s of summaries.filter((s) => s.amp !== BASELINE_AMPLITUDE)) {
      console.log(`  ${s.amp}% vs baseline: overlapRate ${fmt((s.overlapRate ?? 0) * 100, "%")} vs ${fmt((baseline.overlapRate ?? 0) * 100, "%")}; avgNewCount ${fmt(s.avgNewCount)} vs ${fmt(baseline.avgNewCount)}; verdict=${s.safety?.verdict} vs ${baseline.safety?.verdict}`);
    }
  } else {
    console.log("  NOT_AVAILABLE - baseline round bị BLOCKED_BY_INFRA trong phiên này.");
  }

  console.log("\n--- 9. Recommendation cho Phase 4 ---");
  if (candidates.length) {
    console.log(`  Tìm được ${candidates.length} SAFE_CANDIDATE: [${candidates.map((c) => c.amp + "%").join(", ")}]. Khuyến nghị Phase 4 dùng amplitude lớn nhất trong nhóm này làm fixed amplitude mới cho Strategy A (thay 55% hiện tại), ĐÃ chứng minh bằng overlap/reveal/reachability ở trên - KHÔNG cần adaptive scroll.`);
  } else {
    console.log("  BLOCKED: fixed-amplitude scroll cannot guarantee safe overlap with current UI geometry (không tìm được amplitude nào đáp ứng đủ 5 điều kiện SAFE_CANDIDATE trong khoảng đã test). KHÔNG tự chuyển sang adaptive scroll - cần user quyết định bước tiếp theo (mở rộng range amplitude hơn 40%, hoặc chấp nhận cần adaptive/multi-probe).");
  }

  console.log(`\nTổng số INFRA_FAILURE ghi nhận trong phiên benchmark Phase 3 này: ${infraLog.count}`);
  if (infraLog.errors.length) {
    console.log("Chi tiết:");
    for (const e of infraLog.errors) console.log(`  - [${e.label}] lượt ${e.attempt}: ${e.msg}`);
  }
}

main().catch((err) => {
  console.error("\n[amplitudeBenchmark] Dừng vì lỗi ngoài dự kiến:", err);
  process.exit(1);
});
