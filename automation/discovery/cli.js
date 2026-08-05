#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getLessonsOfUnit } from "./lessons.js";
import { getLessonItemsOfLesson, flattenLessonItems, filterExerciseItems } from "./lessonItems.js";
import { getExerciseDetail } from "./exercises.js";
import { getExamOfExercise } from "./exams.js";
import { parseQuestionsFromExamPage } from "./examPageScraper.js";
import { pickRandom } from "./randomPicker.js";
import { findRandomCompletedUnit } from "./unitCompletion.js";
import { getEntityId, getEntityName } from "./entityId.js";
import { CmsApiError } from "./cmsClient.js";
import { normalizeQuestions } from "../model/questionModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");
const OUTPUT_FILE = join(OUTPUT_DIR, "discovery.json");

// Hỗ trợ cả 2 cách gọi:
//   node discovery/cli.js --verbose         (hoặc npm run discover -- --verbose)
//   npm run discover --verbose               (KHÔNG có "--" - npm tự hiểu "--verbose" thành
//                                              flag riêng của npm, set biến môi trường
//                                              npm_config_loglevel=verbose thay vì forward
//                                              vào process.argv của script)
const VERBOSE =
  process.argv.includes("--verbose") || process.env.npm_config_loglevel === "verbose";

function toRef(entity) {
  return { id: safeCall(() => getEntityId(entity)), name: getEntityName(entity) };
}

function describe(entity) {
  const { id, name } = toRef(entity);
  if (name && id !== undefined) return `${name} (id=${id})`;
  if (name) return name;
  if (id !== undefined) return `id=${id}`;
  return JSON.stringify(entity);
}

function safeCall(fn) {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

function log(...args) {
  console.log(...args);
}

function verboseLog(...args) {
  if (VERBOSE) console.log(...args);
}

async function main() {
  log("== Random Exercise Discovery (CMS ParrotEdu) ==\n");

  log("Đang random Book + Unit đã Hoàn thành (UnitStateDetector - xem discovery/unitStateDetector.js)...");
  const { book, unit } = await findRandomCompletedUnit(log);
  verboseLog(`  -> Book: ${describe(book)}`);
  verboseLog(`  -> Unit: ${describe(unit)}`);

  log("Đang lấy danh sách Lesson của Unit đã chọn...");
  const lessons = await getLessonsOfUnit(unit);
  const lesson = pickRandom(lessons);
  verboseLog(`  -> Lesson: ${describe(lesson)}`);

  log("Đang lấy danh sách Lesson Item của Lesson đã chọn (và duyệt children)...");
  const topLevelItems = await getLessonItemsOfLesson(lesson);
  const lessonItems = await flattenLessonItems(topLevelItems);
  verboseLog(`  -> Tổng Lesson Item (đã duyệt children): ${lessonItems.length}`);
  const exerciseItems = filterExerciseItems(lessonItems);
  if (exerciseItems.length === 0) {
    throw new Error(
      `Lesson "${describe(lesson)}" không có Lesson Item nào type = EXERCISE ` +
        `(tổng ${lessonItems.length} lesson item sau khi duyệt hết children). Thử chạy lại để ` +
        `random Lesson khác, hoặc kiểm tra lại lessonItems.js nếu chắc chắn Lesson này có bài tập.`,
    );
  }
  const exerciseItem = pickRandom(exerciseItems);
  verboseLog(`  -> Lesson Item (đã lọc EXERCISE, ${exerciseItems.length} lựa chọn): ${describe(exerciseItem)}`);

  log("Đang lấy chi tiết Exercise đã chọn...");
  const exercise = await getExerciseDetail(exerciseItem);
  verboseLog(`  -> Exercise: ${describe(exercise)}`);

  log("Đang xác định Exam tương ứng...");
  const exam = getExamOfExercise(exercise);
  verboseLog(`  -> Exam ID (random trong exam_ids=${JSON.stringify(exercise.exam_ids)}): ${exam.id}`);

  log("Đang mở trang Exam thật (Playwright) để đọc Question/Correct Answer...\n");
  const examData = await parseQuestionsFromExamPage(exam.id);
  const questions = normalizeQuestions(examData);

  log("---------------------------------------------");
  log(`Book: ${describe(book)}`);
  log(`Unit: ${describe(unit)}`);
  log(`Lesson: ${describe(lesson)}`);
  log(`Lesson Item: ${describe(exerciseItem)}`);
  log(`Exercise: ${describe(exercise)}`);
  log(`Exam: ${examData.examName} (id=${examData.examId})`);
  log(`Question count: ${questions.length}`);
  log(`Question types: ${[...new Set(questions.map((q) => q.type))].join(", ") || "(none)"}`);

  if (questions.length === 0) {
    log("(không có question nào)");
  }
  for (const q of questions) {
    log(`\n- Question [${q.type}] (id=${q.id})`);
    log(`  Question: ${q.question}`);
    if (VERBOSE) {
      log(`  Answers:`);
      for (const a of q.answers) log(`    - ${a}`);
    }
    log(`  Correct answer: ${q.correctAnswer ?? "(không xác định được đáp án đúng)"}`);
  }
  log("---------------------------------------------");

  const result = {
    book: toRef(book),
    unit: toRef(unit),
    lesson: toRef(lesson),
    exercise: toRef(exercise),
    examId: examData.examId,
    examName: examData.examName,
    questionTypes: [...new Set(questions.map((q) => q.type))],
    questions,
  };
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  log(`\nĐã ghi kết quả ra ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("\n[discover] Dừng lại vì lỗi:\n");
  if (err instanceof CmsApiError) {
    console.error(`  ${err.message}`);
    if (err.status) console.error(`  HTTP status: ${err.status}`);
    if (err.body) console.error(`  Response body: ${JSON.stringify(err.body)}`);
  } else {
    console.error(`  ${err.message}`);
  }
  console.error(
    "\nNếu đây là lỗi do path endpoint sai/chưa xác nhận, cập nhật automation/discovery/endpoints.js " +
      "sau khi có curl/response mẫu thật tương ứng. Nếu lỗi liên quan tới Exam Scraper (session " +
      "hết hạn), cập nhật lại automation/.cache/exam_session.json theo automation/README.md.",
  );
  process.exitCode = 1;
});
