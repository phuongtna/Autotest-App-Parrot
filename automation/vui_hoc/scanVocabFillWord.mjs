import { writeFileSync } from "node:fs";
import { getBooks, filterSelfLearnBooks } from "../discovery/books.js";
import { getUnitsOfBook, filterPublishedUnits } from "../discovery/units.js";
import { getLessonsOfUnit } from "../discovery/lessons.js";
import { getLessonItemsOfLesson, flattenLessonItems, filterExerciseItems } from "../discovery/lessonItems.js";
import { getExerciseDetail } from "../discovery/exercises.js";
import { getExamOfExercise } from "../discovery/exams.js";
import { parseQuestionsFromExamPageWithRetry } from "../discovery/examPageScraper.js";
import { normalizeQuestions } from "../model/questionModel.js";
import { getEntityName } from "../discovery/entityId.js";

/**
 * Deep scan: EVERY single-word exercise (excludes Wrap up/matching/test/quiz group exercises)
 * inside every "Vocabulary" lesson across Khối 6-12 - this is the known hotspot where FILL_WORD
 * exams (calculator/international, both FILL_WORD_MULTI) were previously found live. Goal: find
 * ANY FILL_WORD exercise whose on-device UI renders as FILL_WORD_SINGLE (exercise_fillword_input)
 * instead of FILL_WORD_MULTI - CMS data alone can't distinguish (confirmed: both are CMS type
 * "FILL_WORD", the single-vs-multi split is a pure UI rendering choice), so this script only
 * narrows the CANDIDATE list (every FILL_WORD CMS question found) - actual single/multi check
 * still requires a device visit per candidate.
 */
const CONCURRENCY = 8;
const EXCLUDE_NAME_PATTERN = /wrap|thử thách|test|quiz|matching|nối|ghép|btcb/i;

async function withConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let idx = 0;
  async function runNext() {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      try {
        results[i] = await worker(items[i], i);
      } catch (err) {
        results[i] = { error: err.message };
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, runNext));
  return results;
}

async function main() {
  const books = filterSelfLearnBooks(await getBooks());
  const targetBooks = books.filter((b) => !["Khối 1", "Khối 2", "Khối 3", "Khối 4", "Khối 5"].includes(getEntityName(b)));

  const samples = [];
  for (const book of targetBooks) {
    const units = filterPublishedUnits(await getUnitsOfBook(book));
    for (const unit of units) {
      const lessons = await getLessonsOfUnit(unit);
      for (const lesson of lessons) {
        const name = (getEntityName(lesson) || "").toLowerCase();
        if (!name.includes("vocab") && !name.includes("từ vựng")) continue;
        const items = await flattenLessonItems(await getLessonItemsOfLesson(lesson));
        const exercises = filterExerciseItems(items).filter((e) => !EXCLUDE_NAME_PATTERN.test(getEntityName(e) || ""));
        for (const ex of exercises) {
          samples.push({
            bookName: getEntityName(book),
            unitName: getEntityName(unit),
            lessonName: getEntityName(lesson),
            exerciseName: getEntityName(ex),
            exerciseItem: ex,
          });
        }
      }
    }
  }
  console.log(`[scan] ${samples.length} single-word-pattern exercises to open (concurrency=${CONCURRENCY})...`);

  let done = 0;
  const results = await withConcurrency(samples, CONCURRENCY, async (sample) => {
    const detail = await getExerciseDetail(sample.exerciseItem);
    const examRef = getExamOfExercise(detail);
    const examData = await parseQuestionsFromExamPageWithRetry(examRef.id);
    const questions = normalizeQuestions(examData);
    done++;
    if (done % 25 === 0) console.log(`  [progress] ${done}/${samples.length}`);
    const fillWordQuestions = questions
      .filter((q) => q.type === "FILL_WORD")
      .map((q) => ({ id: q.id, point: q.metadata.point, correctLen: Array.isArray(q.metadata.raw.correct) ? q.metadata.raw.correct.length : null }));
    if (fillWordQuestions.length === 0) return null; // KHÔNG giữ bản ghi không liên quan - giảm kích thước output.
    return {
      bookName: sample.bookName,
      unitName: sample.unitName,
      lessonName: sample.lessonName,
      exerciseName: sample.exerciseName,
      examId: examRef.id,
      fillWordQuestions,
    };
  });

  const errors = results.filter((r) => r && r.error);
  const fillWordExams = results.filter((r) => r && !r.error);
  console.log(`[scan] Done. ${samples.length} scanned, ${errors.length} errors, ${fillWordExams.length} exams contain FILL_WORD.`);
  console.log(`=== FILL_WORD CANDIDATES (${fillWordExams.length}) ===`);
  fillWordExams.forEach((r) =>
    console.log(`  ${r.bookName} > ${r.unitName} > ${r.lessonName} > ${r.exerciseName} (exam ${r.examId}): ${JSON.stringify(r.fillWordQuestions)}`),
  );
  if (errors.length > 0) {
    console.log(`=== ERRORS (${errors.length}) ===`);
    errors.slice(0, 20).forEach((e) => console.log(`  ${e.error}`));
  }
  writeFileSync(new URL("./scan_vocab_fillword_output.json", import.meta.url), JSON.stringify({ sampledCount: samples.length, errorCount: errors.length, fillWordExams }, null, 2));
  console.log(`[scan] Full results written to vui_hoc/scan_vocab_fillword_output.json`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
