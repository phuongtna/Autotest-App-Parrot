#!/usr/bin/env node
// TEMP controlled verification (deleted after run, per user request "chọn thử vào 1 bài và học
// hết đi xem" - không random qua nhiều Khối nữa): resolve DUY NHẤT 1 target thật đã biết trước
// (Khối 9 / Unit 5: Our experiences / Grammar / group "Trạm khởi hành 1" / Exercise "định nghĩa" -
// lấy từ chính output CMS thật của lượt random trước đó), navigateTo() ĐÚNG 1 lần (không retry
// random lại), rồi chạy hết pool câu hỏi tới màn Kết quả.
import { writeFileSync, mkdirSync } from "node:fs";
import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { NavigationEngine } from "./navigation/navigationEngine.js";
import { VuiHocExamEngine } from "./vui_hoc/vuiHocExamEngine.js";
import { runVuiHocQuestionPool } from "./vui_hoc/vuiHocExamRunner.js";
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
  unitName: "Unit 5: Our experiences",
  lessonName: "Grammar",
  exerciseName: "định nghĩa",
};

function log(...a) { console.log(...a); }
function namesEqual(a, b) { return a && b && a.trim().toLowerCase() === b.trim().toLowerCase(); }
function findByName(list, name, label) {
  const m = list.find((i) => namesEqual(getEntityName(i), name));
  if (!m) throw new Error(`Không tìm thấy ${label} khớp "${name}". Có: ${list.map((i) => getEntityName(i)).join(", ")}`);
  return m;
}
function toRef(entity) {
  try { return { id: getEntityId(entity), name: getEntityName(entity) }; }
  catch { return { name: getEntityName(entity) }; }
}

async function main() {
  log(`[RESOLVE] ${TARGET.bookName} > ${TARGET.unitName} > ${TARGET.lessonName} > ${TARGET.exerciseName}`);
  const books = filterSelfLearnBooks(await getBooks());
  const book = findByName(books, TARGET.bookName, "Book");
  const units = await getUnitsOfBook(book);
  const unit = findByName(units, TARGET.unitName, "Unit");
  const lessons = await getLessonsOfUnit(unit);
  const lesson = findByName(lessons, TARGET.lessonName, "Lesson");

  const topLevelItems = await getLessonItemsOfLesson(lesson);
  const flatEntries = await flattenLessonItemsWithPath(topLevelItems);
  const exerciseEntries = filterExerciseEntries(flatEntries);
  const entry = exerciseEntries.find((e) => namesEqual(getEntityName(e.item), TARGET.exerciseName));
  if (!entry) {
    throw new Error(
      `Không tìm thấy Exercise "${TARGET.exerciseName}" trong Lesson "${TARGET.lessonName}". ` +
      `Có: ${exerciseEntries.map((e) => getEntityName(e.item)).join(", ")}`,
    );
  }
  const exerciseItem = entry.item;
  const groupPath = entry.groupPath;
  log(`[RESOLVE] groupPath: ${groupPath.length ? groupPath.map((g) => getEntityName(g)).join(" > ") : "(none - flat)"}`);

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

  const bridge = new MaestroBridge({ appId: config.appId, deviceId: "3201d866d40a1681" });
  const nav = new NavigationEngine(bridge);

  log("\n[NAVIGATE] (1 lần DUY NHẤT, không random lại)...");
  await nav.navigateTo(navTarget);
  log("[NAVIGATE] Đã vào đúng bài.");

  const OUTPUT_DIR = "./output";
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const engine = new VuiHocExamEngine(bridge);
  log("\n[ANSWER] Làm hết bài tới màn Kết quả...");
  const outcome = await runVuiHocQuestionPool({
    bridge,
    engine,
    questions,
    maxAttemptsPerQuestion: 3,
    deviceId: "3201d866d40a1681",
    outputDir: OUTPUT_DIR,
    screenshotPrefix: "fixed_target",
  });

  writeFileSync(`${OUTPUT_DIR}/fixed_target_run_result.json`, JSON.stringify({ navTarget, outcome }, null, 2));
  log(`\n[DONE] stoppedReason=${outcome.stoppedReason}`);
  log(`[DONE] finalResult=${JSON.stringify(outcome.finalResult)}`);
  log(`[DONE] resultScreenshotPath=${outcome.resultScreenshotPath}`);
}

main().catch((err) => {
  console.error("[FAIL]", err);
  process.exitCode = 1;
});
