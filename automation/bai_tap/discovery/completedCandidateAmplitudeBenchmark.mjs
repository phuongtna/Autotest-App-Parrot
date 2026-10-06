#!/usr/bin/env node
/**
 * completedCandidateAmplitudeBenchmark.mjs - BENCHMARK-ONLY, KHÔNG sửa production search logic.
 *
 * Phase 5 (2026-10-06): tiếp nối Phase 3 (amplitudeBenchmark.mjs, benchmark list "Làm bài" CHƯA làm)
 * sang đúng list "Làm lại" (ĐÃ hoàn thành) - vì 2/2 lần chạy thật GBT+làm bài+làm lại liên tiếp
 * trong ngày đều FAIL ở bước "Tìm lại card Làm lại" (locateSpecificCompletedCandidate(), PROGRESS_
 * STALLED chỉ sau 2-4 scroll) dù card tồn tại thật ở scroll thứ 14-18 - card template/geometry của
 * list ĐÃ HOÀN THÀNH (có thêm dòng điểm "Điểm X", link "Xem bài đã làm") CÓ THỂ khác card "Làm bài"
 * (có "Hạn nộp") đã benchmark ở Phase 3, nên amplitude 25% (chọn từ Phase 3) có thể KHÔNG an toàn
 * trên chính list này.
 *
 * MỤC TIÊU: đo lại overlap/geometry/throughput TRÊN ĐÚNG list "Làm lại" (không phải list "Làm bài")
 * cho cùng dải amplitude đã test ở Phase 3, xác nhận amplitude nào (nếu có) an toàn cho ĐÚNG use
 * case này. KHÔNG sửa production, KHÔNG đổi WAIT_AFTER_SCROLL_MS/MAX_LOCATE_SCROLLS.
 *
 * CHỈ ĐỌC (import readonly) từ production:
 *   - findAssignment.js (scrollToTop - KHÔNG tin tưởng, chỉ dùng best-effort, có manual-verify riêng)
 *   - homeworkUiList.js (collectTextNodesWithBoundsInsideScrollableList, CTA_TEXTS, SECTION_HEADERS)
 *   - navigation/homeworkNavigationEngine.js (openHomeworkTab/openFilterSheet/selectFilterRange/applyFilter)
 *   - bridge/maestroMcpBridge.js
 *
 * BÀI HỌC THẬT từ 2 lần recovery trong ngày (giữ nguyên trong code bên dưới, KHÔNG được bỏ qua):
 *   1. scrollToTop() không đáng tin cậy - verify "về đỉnh thật" bằng cách TỰ đọc hierarchy tìm filter
 *      header pattern, KHÔNG tin giá trị trả về của scrollToTop().
 *   2. Filter "1 tháng gần nhất" có thể tự reset về "2 tuần" giữa các phiên bridge khác nhau - LUÔN
 *      áp lại filter sau khi xác nhận đã ở đỉnh, trước khi benchmark.
 *
 * CHẠY: node automation/bai_tap/discovery/completedCandidateAmplitudeBenchmark.mjs
 */

import { fileURLToPath } from "node:url";
import { parseEnvFile } from "../../src/config.js";
import { MaestroMcpBridge } from "../../bridge/maestroMcpBridge.js";
import { collectTextNodesWithBoundsInsideScrollableList, CTA_TEXTS, SECTION_HEADERS } from "./homeworkUiList.js";
import { HomeworkNavigationEngine } from "../navigation/homeworkNavigationEngine.js";
import { homeworkPageObjects as po } from "../navigation/homeworkPageObjects.js";

const PROJECT_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const ROOT_ENV = parseEnvFile(PROJECT_ROOT + ".env");
const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";

const COMPLETED_CTA = "Làm lại";
const PROGRESS_PATTERN = /^\d+\s*\/\s*\d+$/;
const SCORE_PATTERN = /^Điểm\s*[0-9.,]+.*$/;
const MAX_CTA_LOOKAHEAD = 6;

// Cùng dải amplitude đã dùng ở Phase 3 (amplitudeBenchmark.mjs) - để so sánh ngang hàng list khác.
const AMPLITUDES = [10, 15, 20, 25, 30, 35];
const BASELINE_AMPLITUDE_PRE_PHASE4 = 55; // giá trị Strategy A TRƯỚC Phase 4, giữ làm mốc lịch sử.
const PRODUCTION_AMPLITUDE = 25; // giá trị Strategy A HIỆN TẠI (Phase 4) - quan trọng nhất phải test.
const EXTRA_AMPLITUDE_IF_35_UNSAFE = 40;

const ROUNDS_PER_AMPLITUDE = 6;
const WAIT_AFTER_SCROLL_MS = 1200;
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

function collectAllTexts(node, acc = []) {
  if (!node) return acc;
  const t = node.attributes?.text;
  if (t) acc.push(t);
  for (const c of node.children ?? []) collectAllTexts(c, acc);
  return acc;
}

/** Parser card "Làm lại" (ĐÃ hoàn thành) - REPLICATE findCompletedCardsWithCtaBounds() của
 * locateCompletedCandidate.js (hàm đó KHÔNG export) - CÙNG logic nhận diện 100%, KHÔNG đổi. */
function findCompletedCards(nodes, { sectionSeen: initialSectionSeen = false } = {}) {
  const results = [];
  let sectionSeen = initialSectionSeen;
  for (let i = 0; i < nodes.length; i++) {
    const { text } = nodes[i];
    if (SECTION_HEADERS.includes(text)) {
      sectionSeen = true;
      continue;
    }
    if (!sectionSeen) continue;
    if (!PROGRESS_PATTERN.test(text)) continue;
    const titleNode = nodes[i - 1];
    const title = titleNode?.text;
    if (!title || SECTION_HEADERS.includes(title) || PROGRESS_PATTERN.test(title) || CTA_TEXTS.includes(title)) continue;
    let cta = null;
    let ctaBounds = null;
    let scoreText = null;
    for (let j = i + 1; j < Math.min(nodes.length, i + 1 + MAX_CTA_LOOKAHEAD); j++) {
      const t = nodes[j].text;
      if (SCORE_PATTERN.test(t)) scoreText = t;
      if (CTA_TEXTS.includes(t)) {
        cta = t;
        ctaBounds = nodes[j].bounds;
        break;
      }
      if (PROGRESS_PATTERN.test(t) || SECTION_HEADERS.includes(t)) break;
    }
    if (cta === COMPLETED_CTA && ctaBounds) {
      results.push({ title, titleBounds: titleNode.bounds, cta, ctaBounds, scoreText });
    }
  }
  return { results, sectionSeen };
}

function readCompletedCards(tree) {
  const nodes = collectTextNodesWithBoundsInsideScrollableList(tree, []);
  const { results } = findCompletedCards(nodes, { sectionSeen: true });
  return { nodes, cards: results };
}

function cardKey(c) {
  return `${c.title}|${c.scoreText ?? ""}`;
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
function fmt(n, unit = "") {
  if (n == null || Number.isNaN(n)) return "N/A";
  return `${Math.round(n * 100) / 100}${unit}`;
}

function strategyForAmplitude(amp) {
  const endY = 80 - amp;
  return { start: "50%,80%", end: `50%,${endY}%`, duration: 400, amplitude: amp };
}

/** Verify "đã về đỉnh THẬT" bằng cách tự đọc hierarchy - KHÔNG tin scrollToTop() (bài học thật
 * trong ngày: scrollToTop() nhiều lần không throw nhưng cũng không thật sự về đỉnh). */
async function robustScrollToTopVerified(bridge, { maxAttempts = 15 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const tree = await bridge.hierarchy();
    const texts = collectAllTexts(tree, []);
    if (texts.some((t) => /\d+ (tuần|tháng) gần nhất/.test(t))) return { atTop: true, attemptsUsed: i };
    await bridge.runSteps([{ swipe: { start: "50%,30%", end: "50%,85%", duration: 400 } }]);
    await bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1200 } }]);
  }
  return { atTop: false, attemptsUsed: maxAttempts };
}

async function ensureOneMonthFilter(nav, bridge) {
  try {
    await nav.openFilterSheet();
    await nav.selectFilterRange(po.filterSheet.optionOneMonth);
    await nav.applyFilter();
    await bridge.runSteps([{ waitForAnimationToEnd: { timeout: 2000 } }]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err };
  }
}

async function benchOneRound(bridge, strategy, label) {
  const beforeT = await withInfraRetry(`${label} hierarchy(before)`, () => timed(() => bridge.hierarchy()));
  if (!beforeT.ok) return { infraFailure: true };
  const before = readCompletedCards(beforeT.value.result);
  const beforeHierarchyMs = beforeT.value.durationMs;

  const swipeT = await withInfraRetry(`${label} swipe`, () => timed(() => bridge.runSteps([{ swipe: { start: strategy.start, end: strategy.end, duration: strategy.duration } }])));
  if (!swipeT.ok || !swipeT.value.result.success) return { infraFailure: true, reason: swipeT.ok ? swipeT.value.result.error : "retry exhausted" };
  const swipeMs = swipeT.value.durationMs;

  const waitT = await withInfraRetry(`${label} wait`, () => timed(() => bridge.runSteps([{ waitForAnimationToEnd: { timeout: WAIT_AFTER_SCROLL_MS } }])));
  if (!waitT.ok) return { infraFailure: true };
  const waitMs = waitT.value.durationMs;

  const afterT = await withInfraRetry(`${label} hierarchy(after)`, () => timed(() => bridge.hierarchy()));
  if (!afterT.ok) return { infraFailure: true };
  const after = readCompletedCards(afterT.value.result);
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
    sharedCount,
    newCount,
    disappearedCount,
    hasOverlap,
    yShifts,
    medianYShift: median(yShifts),
    beforePitch: medianPitch(before.cards),
    afterPitch: medianPitch(after.cards),
    timing: { swipeMs, waitMs, beforeHierarchyMs, afterHierarchyMs },
    elapsedMs: swipeMs + waitMs + beforeHierarchyMs + afterHierarchyMs,
  };
}

async function benchAmplitude(bridge, nav, amp) {
  const strategy = strategyForAmplitude(amp);
  const label = `amp${amp}%`;
  console.log(`\n[DEVICE] Benchmark amplitude=${amp}% trên list "Làm lại" (swipe ${strategy.start} -> ${strategy.end}, ${ROUNDS_PER_AMPLITUDE} lượt)...`);

  const top = await robustScrollToTopVerified(bridge);
  console.log(`  robustScrollToTopVerified: atTop=${top.atTop} sau ${top.attemptsUsed} lượt.`);
  const filterResult = await ensureOneMonthFilter(nav, bridge);
  if (!filterResult.ok) console.log(`  [WARN] không áp được filter 1-tháng: ${filterResult.error?.message}`);

  const rounds = [];
  for (let i = 0; i < ROUNDS_PER_AMPLITUDE; i++) {
    const r = await benchOneRound(bridge, strategy, `${label} round${i}`);
    rounds.push(r);
    if (r.infraFailure) console.log(`    round ${i}: INFRA_FAILURE`);
    else
      console.log(
        `    round ${i}: [${r.classification}] before=${r.beforeCardCount} after=${r.afterCardCount} shared=${r.sharedCount} new=${r.newCount} disappeared=${r.disappearedCount} yShift=${r.medianYShift ?? "N/A"} elapsedMs=${Math.round(r.elapsedMs)}`,
      );
  }
  return { amp, strategy, rounds };
}

function summarizeAmplitude({ amp, rounds }) {
  const valid = rounds.filter((r) => !r.infraFailure);
  const infraCount = rounds.length - valid.length;
  if (!valid.length) return { amp, infraCount, validRounds: 0, status: "BLOCKED_BY_INFRA" };
  const noOverlap = valid.filter((r) => r.classification === "NO_OVERLAP");
  const noProgress = valid.filter((r) => r.classification === "NO_PROGRESS");
  const overlapRoundsCount = valid.filter((r) => r.sharedCount > 0).length;
  const overlapRate = overlapRoundsCount / valid.length;
  const allYShifts = valid.flatMap((r) => r.yShifts);
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
    noOverlapCount: noOverlap.length,
    noProgressCount: noProgress.length,
    overlapRate,
    maxConsecutiveNoOverlap,
    avgSharedCount: mean(valid.map((r) => r.sharedCount)),
    avgNewCount: mean(valid.map((r) => r.newCount)),
    medianYShiftPx: median(allYShifts),
    avgCardsPerSnapshot: mean(valid.map((r) => r.beforeCardCount)),
    noProgressRate: noProgress.length / valid.length,
    avgRoundMs: mean(valid.map((r) => r.elapsedMs)),
    rounds: valid,
  };
}

function classifySafety(summary) {
  if (summary.validRounds === 0) return { verdict: "REJECTED", reason: "BLOCKED_BY_INFRA." };
  const reasons = [];
  if (summary.overlapRate < 1) reasons.push(`overlapRate=${(summary.overlapRate * 100).toFixed(0)}% < 100% (${summary.noOverlapCount} round NO_OVERLAP)`);
  if (summary.maxConsecutiveNoOverlap > 0) reasons.push(`chuỗi ${summary.maxConsecutiveNoOverlap} round NO_OVERLAP liên tiếp`);
  if (summary.avgNewCount <= 0) reasons.push(`avgNewCount=${summary.avgNewCount} - không reveal card mới`);
  if (summary.noProgressCount > 0) reasons.push(`${summary.noProgressCount} round NO_PROGRESS`);
  if (reasons.length === 0) return { verdict: "SAFE_CANDIDATE", reason: "100% overlap, không NO_OVERLAP/NO_PROGRESS, vẫn reveal card mới." };
  return { verdict: "REJECTED", reason: reasons.join("; ") };
}

async function main() {
  console.log("=== completedCandidateAmplitudeBenchmark.mjs - Phase 5 (list 'Làm lại', KHÔNG sửa production) ===");
  console.log(`Amplitudes test: [${[...AMPLITUDES, PRODUCTION_AMPLITUDE, BASELINE_AMPLITUDE_PRE_PHASE4].join(", ")}]% (PRODUCTION hiện tại=${PRODUCTION_AMPLITUDE}%, baseline lịch sử=${BASELINE_AMPLITUDE_PRE_PHASE4}%)\n`);

  if (!APP_ID) {
    console.log("[BLOCKED_BY_INFRA] Thiếu APP_ID.");
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
    console.log("[NAV] openHomeworkTab()...");
    const navResult = await withInfraRetry("openHomeworkTab", () => nav.openHomeworkTab());
    if (!navResult.ok) {
      console.log(`[BLOCKED_BY_INFRA] openHomeworkTab() thất bại: ${navResult.error?.message ?? navResult.error}`);
      return;
    }
    console.log("  [PASS] Đã ở tab Bài tập.");

    const ampsToRun = [...AMPLITUDES, PRODUCTION_AMPLITUDE, BASELINE_AMPLITUDE_PRE_PHASE4];
    for (const amp of ampsToRun) {
      const result = await benchAmplitude(bridge, nav, amp);
      const summary = summarizeAmplitude(result);
      const safety = classifySafety(summary);
      summaries.push({ ...summary, safety });
      console.log(`  => amplitude=${amp}%: overlapRate=${fmt((summary.overlapRate ?? 0) * 100)}% avgNewCount=${fmt(summary.avgNewCount)} noProgressCount=${summary.noProgressCount ?? "N/A"} verdict=${safety.verdict}`);
    }

    const s35 = summaries.find((s) => s.amp === 35);
    if (s35 && s35.safety.verdict !== "SAFE_CANDIDATE") {
      console.log(`\n[EXTEND] amplitude=35% vẫn REJECTED - thử thêm ${EXTRA_AMPLITUDE_IF_35_UNSAFE}%...`);
      const result40 = await benchAmplitude(bridge, nav, EXTRA_AMPLITUDE_IF_35_UNSAFE);
      const summary40 = summarizeAmplitude(result40);
      const safety40 = classifySafety(summary40);
      summaries.push({ ...summary40, safety: safety40 });
      console.log(`  => amplitude=${EXTRA_AMPLITUDE_IF_35_UNSAFE}%: overlapRate=${fmt((summary40.overlapRate ?? 0) * 100)}% avgNewCount=${fmt(summary40.avgNewCount)} verdict=${safety40.verdict}`);
    }

    printFinalReport(summaries);
  } finally {
    await bridge.stop();
    console.log("\n[MCP] Đã dừng tiến trình `maestro mcp`.");
  }
}

function printFinalReport(summaries) {
  console.log("\n\n========================================");
  console.log("=== PHASE 5 FINAL REPORT (list 'Làm lại') ===");
  console.log("========================================\n");

  console.log("--- Amplitude comparison table (MEASURED, list ĐÃ HOÀN THÀNH) ---");
  console.log("Amplitude | ValidRounds | OverlapRate | AvgShared | AvgNew | MedianYShift | NoProgressRate | AvgRoundMs | Verdict");
  for (const s of summaries) {
    console.log(
      `${s.amp}%\t| ${s.validRounds ?? 0}/${ROUNDS_PER_AMPLITUDE}\t| ${fmt((s.overlapRate ?? 0) * 100, "%")}\t| ${fmt(s.avgSharedCount)}\t| ${fmt(s.avgNewCount)}\t| ${fmt(s.medianYShiftPx, "px")}\t| ${fmt((s.noProgressRate ?? 0) * 100, "%")}\t| ${fmt(s.avgRoundMs, "ms")}\t| ${s.safety?.verdict ?? "N/A"}`,
    );
  }

  const prodRow = summaries.find((s) => s.amp === PRODUCTION_AMPLITUDE);
  console.log(`\n--- Production amplitude (${PRODUCTION_AMPLITUDE}%) trên list 'Làm lại' ---`);
  if (prodRow) {
    console.log(`  overlapRate=${fmt((prodRow.overlapRate ?? 0) * 100, "%")} verdict=${prodRow.safety?.verdict} reason=${prodRow.safety?.reason}`);
  }

  const candidates = summaries.filter((s) => s.safety?.verdict === "SAFE_CANDIDATE");
  console.log(`\n--- SAFE_CANDIDATE tìm được: [${candidates.map((c) => c.amp + "%").join(", ") || "KHÔNG CÓ"}] ---`);
  for (const s of summaries) {
    if (s.safety?.verdict === "SAFE_CANDIDATE") console.log(`  [SAFE_CANDIDATE] ${s.amp}%: ${s.safety.reason}`);
    else console.log(`  [REJECTED] ${s.amp}%: ${s.safety?.reason}`);
  }

  console.log("\n--- Recommendation ---");
  if (!candidates.length) {
    console.log("  BLOCKED: không tìm được fixed amplitude nào an toàn cho list 'Làm lại' trong khoảng đã test.");
  } else {
    console.log(`  Có SAFE_CANDIDATE: [${candidates.map((c) => c.amp + "%").join(", ")}]. So sánh với production hiện tại (${PRODUCTION_AMPLITUDE}%) ở bảng trên để quyết định có cần đổi riêng Strategy A cho list completed hay không.`);
  }

  console.log(`\nTổng số INFRA_FAILURE: ${infraLog.count}`);
}

main().catch((err) => {
  console.error("\n[completedCandidateAmplitudeBenchmark] Dừng vì lỗi ngoài dự kiến:", err);
  process.exit(1);
});
