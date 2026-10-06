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
 * Broad sample scan: 1 exercise per published Unit across ALL 12 SELF_LEARN books (~201 units),
 * opens each sampled exercise's exam page once, records CMS type histogram + identity for every
 * FILL_WORD/SORT/DRAG_DROP question found, plus a general exam summary (question count, point
 * weights, type list) usable later to pick a clean "all-simple" exam for exact scoring isolation.
 * Pure CMS API + exam-page scrape, no device involved.
 */

const CONCURRENCY = 4;

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

async function sampleOneExerciseFromUnit(book, unit) {
  const lessons = await getLessonsOfUnit(unit);
  for (const lesson of lessons) {
    const items = await flattenLessonItems(await getLessonItemsOfLesson(lesson));
    const exercises = filterExerciseItems(items);
    if (exercises.length > 0) {
      return {
        bookName: getEntityName(book),
        unitName: getEntityName(unit),
        lessonName: getEntityName(lesson),
        exerciseName: getEntityName(exercises[0]),
        exerciseItem: exercises[0],
      };
    }
  }
  return null;
}

async function main() {
  const books = filterSelfLearnBooks(await getBooks());
  console.log(`[scan] ${books.length} SELF_LEARN books.`);

  const samples = [];
  for (const book of books) {
    const units = filterPublishedUnits(await getUnitsOfBook(book));
    console.log(`[scan] ${getEntityName(book)}: ${units.length} published units - sampling 1 exercise/unit...`);
    for (const unit of units) {
      try {
        const sample = await sampleOneExerciseFromUnit(book, unit);
        if (sample) samples.push(sample);
      } catch (err) {
        console.log(`  [skip] ${getEntityName(book)} > ${getEntityName(unit)}: ${err.message}`);
      }
    }
  }
  console.log(`[scan] Sampled ${samples.length} exercises (1 per unit). Opening exam pages (concurrency=${CONCURRENCY})...`);

  let done = 0;
  const examResults = await withConcurrency(samples, CONCURRENCY, async (sample) => {
    const detail = await getExerciseDetail(sample.exerciseItem);
    const examRef = getExamOfExercise(detail);
    const examData = await parseQuestionsFromExamPageWithRetry(examRef.id);
    const questions = normalizeQuestions(examData);
    done++;
    if (done % 10 === 0) console.log(`  [progress] ${done}/${samples.length}`);
    return {
      bookName: sample.bookName,
      unitName: sample.unitName,
      lessonName: sample.lessonName,
      exerciseName: sample.exerciseName,
      examId: examRef.id,
      examName: examData.examName,
      questionCount: questions.length,
      typeHistogram: questions.reduce((acc, q) => {
        acc[q.type] = (acc[q.type] || 0) + 1;
        return acc;
      }, {}),
      totalPoint: questions.reduce((sum, q) => sum + (q.metadata.point || 0), 0),
      fillWordQuestions: questions
        .filter((q) => q.type === "FILL_WORD")
        .map((q) => ({ id: q.id, point: q.metadata.point, correctLen: Array.isArray(q.metadata.raw.correct) ? q.metadata.raw.correct.length : null })),
      sortQuestions: questions.filter((q) => q.type === "SORT").map((q) => ({ id: q.id, point: q.metadata.point })),
      dragDropQuestions: questions.filter((q) => q.type === "DRAG_DROP").map((q) => ({ id: q.id, point: q.metadata.point })),
      allChoicePointsUniform:
        questions.length > 0 &&
        questions.every((q) => q.type === "ONE") &&
        new Set(questions.map((q) => q.metadata.point)).size === 1,
    };
  });

  const ok = examResults.filter((r) => !r.error);
  const errors = examResults.filter((r) => r.error);
  console.log(`[scan] Done. ${ok.length} ok, ${errors.length} errors.`);

  const fillWordExams = ok.filter((r) => r.fillWordQuestions.length > 0);
  const sortExams = ok.filter((r) => r.sortQuestions.length > 0);
  const dragDropExams = ok.filter((r) => r.dragDropQuestions.length > 0);
  const cleanChoiceExams = ok.filter((r) => r.allChoicePointsUniform && r.questionCount >= 5);

  console.log(`\n=== SUMMARY ===`);
  console.log(`FILL_WORD found in ${fillWordExams.length} exams:`);
  fillWordExams.forEach((r) => console.log(`  ${r.bookName} > ${r.unitName} > ${r.lessonName} > ${r.exerciseName} (exam ${r.examId}): ${JSON.stringify(r.fillWordQuestions)}`));
  console.log(`SORT found in ${sortExams.length} exams:`);
  sortExams.forEach((r) => console.log(`  ${r.bookName} > ${r.unitName} > ${r.lessonName} > ${r.exerciseName} (exam ${r.examId}): ${JSON.stringify(r.sortQuestions)}`));
  console.log(`DRAG_DROP found in ${dragDropExams.length} exams:`);
  dragDropExams.forEach((r) => console.log(`  ${r.bookName} > ${r.unitName} > ${r.lessonName} > ${r.exerciseName} (exam ${r.examId}): ${JSON.stringify(r.dragDropQuestions)}`));
  console.log(`Clean all-CHOICE-uniform-point exams (candidates for scoring isolation), N>=5: ${cleanChoiceExams.length}`);
  cleanChoiceExams.slice(0, 15).forEach((r) => console.log(`  ${r.bookName} > ${r.unitName} > ${r.lessonName} > ${r.exerciseName} (exam ${r.examId}): N=${r.questionCount}, totalPoint=${r.totalPoint}`));

  writeFileSync(
    new URL("./scan_output.json", import.meta.url),
    JSON.stringify({ sampledCount: samples.length, okCount: ok.length, errorCount: errors.length, results: ok, errors }, null, 2),
  );
  console.log(`\n[scan] Full results written to vui_hoc/scan_output.json`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
