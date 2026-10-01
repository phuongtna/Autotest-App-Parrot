#!/usr/bin/env node
// Retry DUY NHẤT của _scratch_nested_group_e2e_run.mjs - GIỮ NGUYÊN target đã LOCK ở lượt chạy
// trước (2026-10-01): Khối 9 / Unit 6: Vietnamese lifestyle: Then and now / Lesson "Vocabulary" /
// group "Thử thách" / Exercise "Thử thách" - KHÔNG random lại (đúng yêu cầu "giữ nguyên target và
// debug đúng failure"). Lượt trước FAIL ở NAVIGATION (tap "below Vocabulary" not found) - đã debug
// xong: thiếu settle-wait sau khi tap "Chinh phục" (navigationEngine.js đã patch). Script này CHỈ
// resolve lại CHÍNH XÁC target cũ theo tên (không gọi random) rồi chạy lại navigateTo()+answer.
import { writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
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
function findLatestMaestroScreenshot(namePart, sinceMs) {
  const root = join_(process.env.HOME || "/root", ".maestro", "tests");
  if (!existsSync(root)) return null;
  let best = null;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join_(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile() && entry.name.includes(namePart) && entry.name.endsWith(".png")) {
        const st = statSync(p);
        if (st.mtimeMs >= sinceMs && (!best || st.mtimeMs > best.mtimeMs)) best = { path: p, mtimeMs: st.mtimeMs };
      }
    }
  };
  try { walk(root); } catch { /* best-effort */ }
  return best?.path ?? null;
}
function join_(...parts) { return parts.join("/"); }

async function main() {
  log(`[RESOLVE] (giữ nguyên target cũ) ${TARGET.bookName} > ${TARGET.unitName} > ${TARGET.lessonName} > group "${TARGET.groupName}" > ${TARGET.exerciseName}`);
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
  if (!entry) {
    throw new Error(
      `Không tìm lại được Exercise "${TARGET.exerciseName}" trong group "${TARGET.groupName}" - CMS có thể đã đổi. ` +
        `Có: ${exerciseEntries.map((e) => `${getEntityName(e.item)} [${e.groupPath.map((g) => getEntityName(g)).join(">")}]`).join(", ")}`,
    );
  }
  const exerciseItem = entry.item;
  const groupPath = entry.groupPath;
  log(`[RESOLVE] groupPath xác nhận khớp: ${groupPath.map((g) => getEntityName(g)).join(" > ")}`);

  const exercise = await getExerciseDetail(exerciseItem);
  const exam = getExamOfExercise(exercise);
  const examData = await parseQuestionsFromExamPageWithRetry(exam.id);
  const questions = normalizeQuestions(examData);
  log(`[RESOLVE] Exam: ${examData.examName} (${examData.examId}) - ${questions.length} câu: ${questions.map((q) => q.type).join(", ")}`);

  const navTarget = {
    book: toRef(book),
    unit: toRef(unit),
    lesson: toRef(lesson),
    groups: groupPath.map(toRef),
    exercise: toRef(exercise),
  };

  const bridge = new MaestroBridge({ appId: config.appId, deviceId: DEVICE_ID });
  const nav = new NavigationEngine(bridge);

  log("\n[NAVIGATE] (1 lần DUY NHẤT, cùng target, sau khi đã vá navigationEngine.js)...");
  const navStart = Date.now();
  let navError = null;
  try {
    await nav.navigateTo(navTarget);
  } catch (err) {
    navError = err.message;
  }
  const navSeconds = (Date.now() - navStart) / 1000;

  const screenshotBefore = findLatestMaestroScreenshot("nav_target_found", navStart);
  const screenshotAfter = navError ? null : findLatestMaestroScreenshot("nav_target_opened", navStart);
  log(`[NAV] Screenshot TRƯỚC khi mở target: ${screenshotBefore ?? "(không dò được)"}`);
  log(`[NAV] Screenshot SAU khi mở target: ${screenshotAfter ?? "(không dò được)"}`);

  if (navError) {
    log(`\n[NAV] VẪN FAIL (${navSeconds.toFixed(2)}s): ${navError}`);
    mkdirSync(OUTPUT_DIR, { recursive: true });
    writeFileSync(join(OUTPUT_DIR, "nested_group_retry_result.json"), JSON.stringify({ navTarget, navError, failPhase: "NAVIGATION" }, null, 2));
    process.exitCode = 1;
    return;
  }
  log(`[NAV] Đã mở target thành công (${navSeconds.toFixed(2)}s).`);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const handoffScreenshot = join(OUTPUT_DIR, `nested_group_retry_vuihoc_started_${Date.now()}.png`);
  captureScreenshotViaAdb(DEVICE_ID, handoffScreenshot);
  log(`[HANDOFF] Vui học automation BẮT ĐẦU - screenshot: ${handoffScreenshot}`);

  const engine = new VuiHocExamEngine(bridge);
  const outcome = await runVuiHocQuestionPool({
    bridge,
    engine,
    questions,
    maxAttemptsPerQuestion: 3,
    deviceId: DEVICE_ID,
    outputDir: OUTPUT_DIR,
    screenshotPrefix: "nested_group_retry",
  });

  const result = {
    navTarget,
    screenshotBeforeOpenTarget: screenshotBefore,
    screenshotAfterOpenTarget: screenshotAfter,
    handoffScreenshot,
    timings: { navSeconds },
    outcome,
  };
  writeFileSync(join(OUTPUT_DIR, "nested_group_retry_result.json"), JSON.stringify(result, null, 2));
  log(`\n[DONE] stoppedReason=${outcome.stoppedReason}`);
  log(`[DONE] finalResult=${JSON.stringify(outcome.finalResult)}`);
  log(`[DONE] resultScreenshotPath=${outcome.resultScreenshotPath}`);
  if (outcome.stoppedReason !== "COMPLETED") process.exitCode = 1;
}

main().catch((err) => {
  console.error("[FAIL]", err);
  process.exitCode = 1;
});
