#!/usr/bin/env node
// PILOT (2026-10-02) - Persistent Maestro Session (MaestroMcpBridge) cho Self-Learning (Vui học).
// BẢN SAO 1:1 của `_scratch_perf_profile_run.mjs` (baseline CLI-per-call, 647.62s) - CHỈ khác đúng
// 1 chỗ kiến trúc: `new MaestroBridge(...)` -> `new MaestroMcpBridge(...)` + thêm
// `await bridge.start()`/`await bridge.stop()` bao quanh TOÀN BỘ navigation+question flow (1 tiến
// trình `maestro mcp` DUY NHẤT sống xuyên suốt cả E2E, thay vì spawn/kill `maestro test`/`maestro
// hierarchy` riêng cho MỖI lệnh). KHÔNG đổi target, KHÔNG đổi NavigationEngine/VuiHocExamEngine/
// vuiHocExamRunner logic, KHÔNG đổi answer-selection/validation - thuần TRANSPORT SWAP, tái sử
// dụng NGUYÊN VẸN `MaestroMcpSession`/`MaestroMcpBridge` đã production-proven ở bai_tap/
// giao_bai_tap (xem docblock 2 file đó) - KHÔNG viết class session mới.
//
// TARGET (giữ nguyên, KHÔNG random): Khối 9 > Unit 6: Vietnamese lifestyle: Then and now >
// Vocabulary > group "Thử thách" > Exercise "Thử thách" > Exam "Thử thách V" (10 câu).
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "./src/config.js";
import { MaestroMcpBridge } from "./bridge/maestroMcpBridge.js";
import { NavigationEngine } from "./navigation/navigationEngine.js";
import { VuiHocExamEngine } from "./vui_hoc/vuiHocExamEngine.js";
import { runVuiHocQuestionPool, captureScreenshotViaAdb } from "./vui_hoc/vuiHocExamRunner.js";
import { getBooks, filterSelfLearnBooks } from "./discovery/books.js";
import { getUnitsOfBook } from "./discovery/units.js";
import { getLessonsOfUnit } from "./discovery/lessons.js";
import { getLessonItemsOfLesson, flattenLessonItemsWithPath, filterExerciseEntries } from "./discovery/lessonItems.js";
import { getExerciseDetail } from "./discovery/exercises.js";
import { getExamOfExercise } from "./discovery/exams.js";
import { parseQuestionsFromExamPageWithRetry } from "./discovery/examPageScraper.js";
import { normalizeQuestions } from "./model/questionModel.js";
import { getEntityId, getEntityName } from "./discovery/entityId.js";

const TARGET = {
  bookName: "Khối 9",
  unitName: "Unit 6: Vietnamese lifestyle: Then and now",
  lessonName: "Vocabulary",
  groupName: "Thử thách",
  exerciseName: "Thử thách",
};
const DEVICE_ID = "3201d866d40a1681";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");

function log(...a) { console.log(...a); }
function namesEqual(a, b) { return a && b && a.trim().toLowerCase() === b.trim().toLowerCase(); }
function toRef(entity) {
  try { return { id: getEntityId(entity), name: getEntityName(entity) }; }
  catch { return { name: getEntityName(entity) }; }
}
function fmt(s) { return `${s.toFixed(2)}s`; }

/** Gộp bridge.callLog theo phase - GIỐNG HỆT _scratch_perf_profile_run.mjs (không đổi logic báo cáo,
 * chỉ đổi nguồn callLog đến từ MaestroMcpBridge thay vì MaestroBridge). */
function summarizeByPhase(callLog) {
  const map = new Map();
  for (const entry of callLog) {
    if (!map.has(entry.phase)) map.set(entry.phase, { phase: entry.phase, count: 0, totalSeconds: 0, testCount: 0, hierarchyCount: 0 });
    const bucket = map.get(entry.phase);
    bucket.count++;
    bucket.totalSeconds += entry.seconds;
    if (entry.type === "test") bucket.testCount++;
    if (entry.type === "hierarchy") bucket.hierarchyCount++;
  }
  return [...map.values()].map((b) => ({ ...b, avgSeconds: b.totalSeconds / b.count })).sort((a, b) => b.totalSeconds - a.totalSeconds);
}

async function main() {
  const scriptStartMs = Date.now();
  log(`[RESOLVE] (giữ nguyên target cũ, KHÔNG random) ${TARGET.bookName} > ${TARGET.unitName} > ${TARGET.lessonName} > group "${TARGET.groupName}" > ${TARGET.exerciseName}`);
  const books = filterSelfLearnBooks(await getBooks());
  const book = books.find((b) => namesEqual(getEntityName(b), TARGET.bookName));
  if (!book) throw new Error(`Không tìm thấy Book "${TARGET.bookName}"`);
  const units = await getUnitsOfBook(book);
  const unit = units.find((u) => namesEqual(getEntityName(u), TARGET.unitName));
  if (!unit) throw new Error(`Không tìm thấy Unit "${TARGET.unitName}"`);
  const lessons = await getLessonsOfUnit(unit);
  const lesson = lessons.find((l) => namesEqual(getEntityName(l), TARGET.lessonName));
  if (!lesson) throw new Error(`Không tìm thấy Lesson "${TARGET.lessonName}"`);

  const topLevelItems = await getLessonItemsOfLesson(lesson);
  const flatEntries = await flattenLessonItemsWithPath(topLevelItems);
  const exerciseEntries = filterExerciseEntries(flatEntries);
  const entry = exerciseEntries.find(
    (e) => namesEqual(getEntityName(e.item), TARGET.exerciseName) && e.groupPath.some((g) => namesEqual(getEntityName(g), TARGET.groupName)),
  );
  if (!entry) throw new Error(`Không tìm lại được Exercise "${TARGET.exerciseName}" trong group "${TARGET.groupName}".`);
  const exerciseItem = entry.item;
  const groupPath = entry.groupPath;

  const exercise = await getExerciseDetail(exerciseItem);
  const exam = getExamOfExercise(exercise);
  const examData = await parseQuestionsFromExamPageWithRetry(exam.id);
  const questions = normalizeQuestions(examData);
  log(`[RESOLVE] Exam: ${examData.examName} (${examData.examId}) - ${questions.length} câu: ${questions.map((q) => q.type).join(", ")}`);
  const resolveSeconds = (Date.now() - scriptStartMs) / 1000;

  const navTarget = {
    book: toRef(book),
    unit: toRef(unit),
    lesson: toRef(lesson),
    groups: groupPath.map(toRef),
    exercise: toRef(exercise),
  };

  // ===== KHÁC DUY NHẤT SO VỚI BASELINE: MaestroMcpBridge + lifecycle start()/stop() =====
  // CHÍNH XÁC 1 tiến trình `maestro mcp` cho TOÀN BỘ navigation + 10 câu + result - KHÔNG spawn
  // thêm tiến trình nào khác qua bridge này (NavigationEngine/VuiHocExamEngine/vuiHocExamRunner
  // KHÔNG tự spawn CLI riêng - toàn bộ thao tác thiết bị đều qua `this.bridge.*`).
  const bridge = new MaestroMcpBridge({ appId: config.appId, deviceId: DEVICE_ID });
  await bridge.start();
  const sessionStartedAt = new Date().toISOString();
  log(`[MCP] Persistent Maestro session đã khởi động (deviceId=${bridge.deviceId}).`);

  let navSeconds = 0;
  let navError = null;
  const nav = new NavigationEngine(bridge);

  try {
    log("\n[NAVIGATE] (pilot MaestroMcpBridge - cùng target, cùng navigationEngine.js, 1 session MCP xuyên suốt)...");
    const navStartMs = Date.now();
    try {
      await nav.navigateTo(navTarget);
    } catch (err) {
      navError = err.message;
    }
    navSeconds = (Date.now() - navStartMs) / 1000;

    if (navError) {
      log(`\n[NAV] FAIL (${fmt(navSeconds)}): ${navError}`);
      mkdirSync(OUTPUT_DIR, { recursive: true });
      writeFileSync(
        join(OUTPUT_DIR, "perf_pilot_mcp_result.json"),
        JSON.stringify({ navTarget, navError, failPhase: "NAVIGATION", callLog: bridge.callLog }, null, 2),
      );
      process.exitCode = 1;
      return;
    }
    log(`[NAV] Mở target thành công (${fmt(navSeconds)}).`);

    mkdirSync(OUTPUT_DIR, { recursive: true });
    const handoffScreenshot = join(OUTPUT_DIR, `perf_pilot_mcp_vuihoc_started_${Date.now()}.png`);
    captureScreenshotViaAdb(DEVICE_ID, handoffScreenshot);
    log(`[HANDOFF] Vui học automation BẮT ĐẦU - screenshot: ${handoffScreenshot}`);

    const engine = new VuiHocExamEngine(bridge);
    const vuihocStartMs = Date.now();
    const outcome = await runVuiHocQuestionPool({
      bridge,
      engine,
      questions,
      maxAttemptsPerQuestion: 3,
      deviceId: DEVICE_ID,
      outputDir: OUTPUT_DIR,
      screenshotPrefix: "perf_pilot_mcp",
    });
    const vuihocSeconds = (Date.now() - vuihocStartMs) / 1000;
    const totalSeconds = (Date.now() - scriptStartMs) / 1000;

    // ===== TỔNG HỢP BÁO CÁO (CÙNG logic baseline) =====
    const phaseSummary = summarizeByPhase(bridge.callLog);
    const navPhases = phaseSummary.filter((p) => p.phase.startsWith("nav:") && p.phase !== "nav:open_exercise");
    const openExercisePhase = phaseSummary.find((p) => p.phase === "nav:open_exercise");
    const navSubtotal = navPhases.reduce((s, p) => s + p.totalSeconds, 0);
    const openExerciseSeconds = openExercisePhase?.totalSeconds ?? 0;

    const answeredCount = outcome.perQuestionResults.length;
    const loopOverheadPhases = phaseSummary.filter((p) => p.phase.startsWith("vuihoc:loop_overhead_"));
    const perQuestionLoopOverhead = loopOverheadPhases.filter((p) => {
      const n = Number(p.phase.replace("vuihoc:loop_overhead_", ""));
      return n <= answeredCount;
    });
    const resultDetectOverhead = loopOverheadPhases.find((p) => {
      const n = Number(p.phase.replace("vuihoc:loop_overhead_", ""));
      return n === answeredCount + 1;
    });
    const loopOverheadSeconds = perQuestionLoopOverhead.reduce((s, p) => s + p.totalSeconds, 0);
    const pureAnswerSeconds = outcome.perQuestionResults.reduce((s, r) => s + r.seconds, 0);
    const questionExecutionSeconds = loopOverheadSeconds + pureAnswerSeconds;
    const submitResultSeconds = (resultDetectOverhead?.totalSeconds ?? 0) + (vuihocSeconds - (questionExecutionSeconds + (resultDetectOverhead?.totalSeconds ?? 0)));

    const totalMcpToolCalls = bridge.runCallCount + bridge.hierarchyCallCount;
    // Đúng 1 tiến trình `maestro mcp` cho TOÀN BỘ phase này - `bridge.start()` được gọi ĐÚNG 1 lần
    // phía trên, bao trùm cả navigation lẫn question execution - KHÔNG suy đoán, đây là invariant
    // kiến trúc của chính đoạn code này (chỉ 1 lệnh `await bridge.start()` trong toàn bộ file).
    const newMaestroProcessesSpawnedForThisPhase = 1;

    const report = {
      target: navTarget,
      architecture: "MaestroMcpBridge (persistent maestro mcp session) - PILOT",
      mcpSessionStartedAt: sessionStartedAt,
      resolveSeconds,
      navSeconds,
      vuihocSeconds,
      totalSeconds,
      breakdown: {
        cmsResolveSeconds: resolveSeconds,
        navigationSeconds: navSubtotal,
        contentOpeningSeconds: openExerciseSeconds,
        questionExecutionSeconds,
        pureAnswerSeconds,
        loopOverheadSeconds,
        submitResultSeconds,
        otherUnaccountedSeconds: totalSeconds - (resolveSeconds + navSeconds + vuihocSeconds),
      },
      mcpPerformance: {
        runCallCount: bridge.runCallCount,
        hierarchyCallCount: bridge.hierarchyCallCount,
        totalMcpToolCalls,
        newMaestroProcessesSpawnedForThisPhase,
      },
      navigationPhaseDetail: navPhases,
      contentOpeningPhaseDetail: openExercisePhase ?? null,
      perQuestionResults: outcome.perQuestionResults,
      perQuestionLoopOverhead,
      resultDetectOverhead: resultDetectOverhead ?? null,
      retries: {
        totalRetryAttempts: outcome.benchmark.totalRetryAttempts,
      },
      stoppedReason: outcome.stoppedReason,
      finalResult: outcome.finalResult,
      resultScreenshotPath: outcome.resultScreenshotPath,
      fullCallLog: bridge.callLog,
    };
    writeFileSync(join(OUTPUT_DIR, "perf_pilot_mcp_result.json"), JSON.stringify(report, null, 2));

    // ===== IN BÁO CÁO RA CONSOLE =====
    log("\n" + "=".repeat(70));
    log("PERF PILOT REPORT (MaestroMcpBridge - persistent session)");
    log("=".repeat(70));
    log(`TOTAL RUNTIME:              ${fmt(totalSeconds)}`);
    log(`  CMS resolve (Node, no device): ${fmt(resolveSeconds)}`);
    log(`  Navigation: ${fmt(navSubtotal)}`);
    log(`  Content opening: ${fmt(openExerciseSeconds)}`);
    log(`  Question execution total:   ${fmt(questionExecutionSeconds)} (pure answer=${fmt(pureAnswerSeconds)} + loop overhead=${fmt(loopOverheadSeconds)})`);
    log(`  Submit/result detection:    ${fmt(submitResultSeconds)}`);
    log(`  stoppedReason=${outcome.stoppedReason}, finalResult=${JSON.stringify(outcome.finalResult)}`);
    log(`\nMCP TOOL CALLS: ${bridge.runCallCount} run + ${bridge.hierarchyCallCount} hierarchy = ${totalMcpToolCalls} total`);
    log(`MAESTRO PROCESSES SPAWNED FOR THIS PHASE: ${newMaestroProcessesSpawnedForThisPhase}`);
    log(`Average seconds / MCP tool call (warm, excl. cold-start skew): ${fmt(phaseSummary.reduce((s, p) => s + p.totalSeconds, 0) / Math.max(1, bridge.callLog.length))}`);
    log(`Total retry attempts (Vui học answer retries): ${outcome.benchmark.totalRetryAttempts}`);

    log("\n--- TOP 10 PHASE BY TOTAL SECONDS ---");
    for (const p of phaseSummary.slice(0, 10)) {
      log(`  ${p.phase.padEnd(28)} count=${String(p.count).padEnd(3)} total=${fmt(p.totalSeconds).padEnd(10)} avg=${fmt(p.avgSeconds)} (test=${p.testCount}, hierarchy=${p.hierarchyCount})`);
    }

    log("\n--- PER-QUESTION TIMING ---");
    outcome.perQuestionResults.forEach((r, i) => {
      log(`  Q${i + 1} cmsType=${r.cmsType} uiType=${r.uiType} correct=${r.correct} attempts=${r.attempts} seconds=${fmt(r.seconds)} (test=${r.testInvocations}, hierarchy=${r.hierarchyInvocations})`);
    });
    log(`  AVERAGE pure-answer seconds/question: ${fmt(pureAnswerSeconds / Math.max(1, answeredCount))}`);

    log("\n--- FIRST CALL (cold-start) vs REST (warm) ---");
    if (bridge.callLog.length > 0) {
      const first = bridge.callLog[0];
      const rest = bridge.callLog.slice(1);
      log(`  Call #1 (${first.type}, phase=${first.phase}): ${fmt(first.seconds)} (cold-start driver init)`);
      if (rest.length > 0) {
        const warmAvg = rest.reduce((s, c) => s + c.seconds, 0) / rest.length;
        const warmRun = rest.filter((c) => c.type === "test");
        const warmHierarchy = rest.filter((c) => c.type === "hierarchy");
        log(`  Remaining ${rest.length} calls - avg ${fmt(warmAvg)}`);
        if (warmRun.length) log(`    run (warm) avg: ${fmt(warmRun.reduce((s, c) => s + c.seconds, 0) / warmRun.length)} (n=${warmRun.length})`);
        if (warmHierarchy.length) log(`    hierarchy (warm) avg: ${fmt(warmHierarchy.reduce((s, c) => s + c.seconds, 0) / warmHierarchy.length)} (n=${warmHierarchy.length})`);
      }
    }

    log("\n" + "=".repeat(70));
    if (outcome.stoppedReason !== "COMPLETED") process.exitCode = 1;
  } finally {
    await bridge.stop();
    log("[MCP] Persistent Maestro session đã dừng.");
  }
}

main().catch((err) => {
  console.error("[FAIL]", err);
  process.exitCode = 1;
});
