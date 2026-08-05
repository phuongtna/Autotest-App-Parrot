#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getBooks, filterSelfLearnBooks } from "./books.js";
import { getUnitsOfBook, filterPublishedUnits } from "./units.js";
import { getLessonsOfUnit } from "./lessons.js";
import { getLessonItemsOfLesson, flattenLessonItems, filterExerciseItems } from "./lessonItems.js";
import { getExerciseDetail } from "./exercises.js";
import { getExamOfExercise } from "./exams.js";
import { parseQuestionsFromExamPage } from "./examPageScraper.js";
import { pickRandom } from "./randomPicker.js";
import { getEntityId, getEntityName } from "./entityId.js";
import { CmsApiError } from "./cmsClient.js";
import { normalizeQuestions } from "../model/questionModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");
const OUTPUT_FILE = join(OUTPUT_DIR, "discovery.json");

// Số lần thử lại tối đa khi 1 lượt random (Book/Unit/Lesson/Exercise) gặp ngõ cụt (vd Lesson
// không có Lesson Item nào type EXERCISE, hoặc Exam Scraper lỗi) - random lại HOÀN TOÀN từ đầu
// (Book mới) thay vì chỉ đổi 1 cấp, giữ discovery đơn giản và không phụ thuộc trạng thái Unit.
const MAX_ATTEMPTS = 10;

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

/**
 * 1 lượt random thuần CMS: Book -> Unit -> Lesson -> Lesson Item (lọc EXERCISE) -> Exercise ->
 * Exam -> Question. KHÔNG kiểm tra trạng thái Hoàn thành/Ôn tập, KHÔNG đọc UI/thiết bị - nhưng
 * CÓ lọc Book/Unit theo trạng thái publish (xem filterSelfLearnBooks()/filterPublishedUnits()) để
 * chỉ random trong những gì THẬT SỰ hiển thị trên app - tránh Runtime tốn thời gian tìm 1 Unit
 * không tồn tại trên app. Throw ngay khi 1 cấp rỗng (vd Book không có Unit đã publish, Lesson
 * không có Exercise) hoặc Exam Scraper lỗi - để pickRandomExerciseWithRetry() quyết định thử
 * lại với lựa chọn khác.
 */
async function pickExerciseAttempt() {
  const books = filterSelfLearnBooks(await getBooks());
  if (books.length === 0) throw new Error("Không lấy được Book type SELF_LEARN nào từ CMS.");
  const book = pickRandom(books);
  verboseLog(`  -> Book: ${describe(book)}`);

  const units = filterPublishedUnits(await getUnitsOfBook(book));
  if (units.length === 0) throw new Error(`Book "${describe(book)}" không có Unit nào đã publish (status=done).`);
  const unit = pickRandom(units);
  verboseLog(`  -> Unit: ${describe(unit)}`);

  const lessons = await getLessonsOfUnit(unit);
  if (lessons.length === 0) throw new Error(`Unit "${describe(unit)}" không có Lesson nào.`);
  const lesson = pickRandom(lessons);
  verboseLog(`  -> Lesson: ${describe(lesson)}`);

  const topLevelItems = await getLessonItemsOfLesson(lesson);
  const lessonItems = await flattenLessonItems(topLevelItems);
  verboseLog(`  -> Tổng Lesson Item (đã duyệt children): ${lessonItems.length}`);
  const exerciseItems = filterExerciseItems(lessonItems);
  if (exerciseItems.length === 0) {
    throw new Error(
      `Lesson "${describe(lesson)}" không có Lesson Item nào type = EXERCISE ` +
        `(tổng ${lessonItems.length} lesson item sau khi duyệt hết children).`,
    );
  }
  const exerciseItem = pickRandom(exerciseItems);
  verboseLog(`  -> Lesson Item (đã lọc EXERCISE, ${exerciseItems.length} lựa chọn): ${describe(exerciseItem)}`);

  const exercise = await getExerciseDetail(exerciseItem);
  verboseLog(`  -> Exercise: ${describe(exercise)}`);

  const exam = getExamOfExercise(exercise);
  verboseLog(`  -> Exam ID (random trong exam_ids=${JSON.stringify(exercise.exam_ids)}): ${exam.id}`);

  const examData = await parseQuestionsFromExamPage(exam.id);
  const questions = normalizeQuestions(examData);

  return { book, unit, lesson, exerciseItem, exercise, examData, questions };
}

/**
 * Thử pickExerciseAttempt() tối đa MAX_ATTEMPTS lần - gặp lỗi (ngõ cụt ở bất kỳ cấp nào) thì
 * log lại rồi random lại HOÀN TOÀN từ Book, không cần biết/không phụ thuộc trạng thái Unit.
 */
async function pickRandomExerciseWithRetry() {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await pickExerciseAttempt();
    } catch (err) {
      lastErr = err;
      log(
        `[discover] Lượt random #${attempt}/${MAX_ATTEMPTS} thất bại (${err.message}) - ` +
          `thử random lựa chọn khác...`,
      );
    }
  }
  throw new Error(
    `Đã thử ${MAX_ATTEMPTS} lượt random liên tiếp đều thất bại. Lỗi gần nhất: ${lastErr.message}`,
  );
}

async function main() {
  log("== Random Exercise Discovery (CMS ParrotEdu) ==\n");
  log("Đang random Book -> Unit -> Lesson -> Lesson Item -> Exercise -> Exam...");

  const { book, unit, lesson, exerciseItem, exercise, examData, questions } =
    await pickRandomExerciseWithRetry();

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
