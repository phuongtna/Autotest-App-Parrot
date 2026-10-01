#!/usr/bin/env node
// PERF PROFILING RUN (2026-10-01) - PHASE 1 của task "performance optimization toàn bộ automation
// Self-Learning": CHƯA sửa bất kỳ logic/timeout/retry nào - chỉ chạy lại ĐÚNG target đã lock+PASS
// trước đó (Khối 9 / Unit 6: Vietnamese lifestyle: Then and now / Lesson "Vocabulary" / group "Thử
// thách" / Exercise "Thử thách") với instrumentation mới (bridge.callLog + setPhase(), xem
// maestroBridge.js/navigationEngine.js/vuiHocExamRunner.js) để đo THẬT từng giai đoạn, không suy
// đoán. KHÔNG random lại target - tái sử dụng đúng cơ chế resolve của
// _scratch_nested_group_fixed_retarget.mjs.
import { writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
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

/** Gộp bridge.callLog theo phase - trả {phase, count, totalSeconds, avgSeconds, testCount, hierarchyCount}[] */
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

  const bridge = new MaestroBridge({ appId: config.appId, deviceId: DEVICE_ID });
  const nav = new NavigationEngine(bridge);

  log("\n[NAVIGATE] (profiling run - cùng target, cùng navigationEngine.js đã PASS, chỉ thêm đo đạc)...");
  const navStartMs = Date.now();
  let navError = null;
  try {
    await nav.navigateTo(navTarget);
  } catch (err) {
    navError = err.message;
  }
  const navSeconds = (Date.now() - navStartMs) / 1000;

  if (navError) {
    log(`\n[NAV] FAIL (${fmt(navSeconds)}): ${navError}`);
    mkdirSync(OUTPUT_DIR, { recursive: true });
    writeFileSync(join(OUTPUT_DIR, "perf_profile_result.json"), JSON.stringify({ navTarget, navError, failPhase: "NAVIGATION", callLog: bridge.callLog }, null, 2));
    process.exitCode = 1;
    return;
  }
  log(`[NAV] Mở target thành công (${fmt(navSeconds)}).`);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const handoffScreenshot = join(OUTPUT_DIR, `perf_profile_vuihoc_started_${Date.now()}.png`);
  const handoffMs = Date.now();
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
    screenshotPrefix: "perf_profile",
  });
  const vuihocSeconds = (Date.now() - vuihocStartMs) / 1000;
  const totalSeconds = (Date.now() - scriptStartMs) / 1000;

  // ===== TỔNG HỢP BÁO CÁO =====
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
  // ^ submitResultSeconds = hierarchy() cuối phát hiện màn Kết quả + phần dư (JS overhead giữa các
  // lượt gọi, screenshot kết quả qua adb KHÔNG đi qua bridge nên không nằm trong callLog).

  const totalMaestroProcessLaunches = bridge.testInvocationCount + bridge.hierarchyInvocationCount;

  const report = {
    target: navTarget,
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
    maestroProcessCounts: {
      totalTestInvocations: bridge.testInvocationCount,
      totalHierarchyInvocations: bridge.hierarchyInvocationCount,
      totalProcessLaunches: totalMaestroProcessLaunches,
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
  writeFileSync(join(OUTPUT_DIR, "perf_profile_result.json"), JSON.stringify(report, null, 2));

  // ===== IN BÁO CÁO RA CONSOLE =====
  log("\n" + "=".repeat(70));
  log("PERF PROFILE REPORT");
  log("=".repeat(70));
  log(`TOTAL RUNTIME:              ${fmt(totalSeconds)}`);
  log(`  CMS resolve (Node, no device): ${fmt(resolveSeconds)}`);
  log(`  Navigation (book->unit->lesson->group->target-locate): ${fmt(navSubtotal)}`);
  log(`  Content opening (tap target->Dẫn nhập->first question): ${fmt(openExerciseSeconds)}`);
  log(`  Question execution total:   ${fmt(questionExecutionSeconds)} (pure answer=${fmt(pureAnswerSeconds)} + loop overhead=${fmt(loopOverheadSeconds)})`);
  log(`  Submit/result detection:    ${fmt(submitResultSeconds)}`);
  log(`  stoppedReason=${outcome.stoppedReason}, finalResult=${JSON.stringify(outcome.finalResult)}`);
  log(`\nMAESTRO PROCESS COUNTS: ${bridge.testInvocationCount} test + ${bridge.hierarchyInvocationCount} hierarchy = ${totalMaestroProcessLaunches} total launches`);
  log(`Average seconds / maestro test launch: ${fmt(phaseSummary.reduce((s, p) => s + p.totalSeconds, 0) / Math.max(1, bridge.callLog.length))}`);
  log(`Total retry attempts (Vui học answer retries): ${outcome.benchmark.totalRetryAttempts}`);

  log("\n--- TOP 10 PHASE BY TOTAL SECONDS ---");
  for (const p of phaseSummary.slice(0, 10)) {
    log(`  ${p.phase.padEnd(28)} count=${String(p.count).padEnd(3)} total=${fmt(p.totalSeconds).padEnd(10)} avg=${fmt(p.avgSeconds)} (test=${p.testCount}, hierarchy=${p.hierarchyCount})`);
  }

  log("\n--- PER-QUESTION TIMING (pure answer, excludes loop-detect overhead) ---");
  outcome.perQuestionResults.forEach((r, i) => {
    log(`  Q${i + 1} cmsType=${r.cmsType} uiType=${r.uiType} correct=${r.correct} attempts=${r.attempts} seconds=${fmt(r.seconds)} (test=${r.testInvocations}, hierarchy=${r.hierarchyInvocations})`);
  });
  log(`  AVERAGE pure-answer seconds/question: ${fmt(pureAnswerSeconds / Math.max(1, answeredCount))}`);

  log("\n--- NAVIGATION PHASE DETAIL ---");
  for (const p of navPhases) {
    log(`  ${p.phase.padEnd(28)} count=${p.count} total=${fmt(p.totalSeconds)} avg=${fmt(p.avgSeconds)}`);
  }
  if (openExercisePhase) log(`  ${openExercisePhase.phase.padEnd(28)} count=${openExercisePhase.count} total=${fmt(openExercisePhase.totalSeconds)} avg=${fmt(openExercisePhase.avgSeconds)}`);

  log("\n" + "=".repeat(70));
  if (outcome.stoppedReason !== "COMPLETED") process.exitCode = 1;
}

main().catch((err) => {
  console.error("[FAIL]", err);
  process.exitCode = 1;
});
