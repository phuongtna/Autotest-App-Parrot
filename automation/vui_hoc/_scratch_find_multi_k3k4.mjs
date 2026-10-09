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
 * Scoped scan: Khối 3 + Khối 4 only, staging CMS. Heuristic for MULTI ("Nhiều lựa chọn"): CMS
 * type "ONE" where raw.correct is an array with length > 1 (vs a single id string for normal
 * single-choice ONE) - matches questionTypeDetector.js's documented MULTI signal shape.
 */

const CONCURRENCY = 6;
const TARGET_BOOKS = ["Khối 3", "Khối 4"];

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
  const books = filterSelfLearnBooks(await getBooks()).filter((b) => TARGET_BOOKS.includes(getEntityName(b)));
  console.log(`[scan] ${books.length} books: ${books.map((b) => getEntityName(b)).join(", ")}`);

  const samples = [];
  for (const book of books) {
    const units = filterPublishedUnits(await getUnitsOfBook(book));
    for (const unit of units) {
      const lessons = await getLessonsOfUnit(unit);
      for (const lesson of lessons) {
        const items = await flattenLessonItems(await getLessonItemsOfLesson(lesson));
        const exercises = filterExerciseItems(items);
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
  console.log(`[scan] ${samples.length} total exercises in Khối 3 + Khối 4.`);

  let done = 0;
  const found = [];
  await withConcurrency(samples, CONCURRENCY, async (sample) => {
    try {
      const detail = await getExerciseDetail(sample.exerciseItem);
      const examRef = getExamOfExercise(detail);
      const examData = await parseQuestionsFromExamPageWithRetry(examRef.id);
      const questions = normalizeQuestions(examData);
      const multiQuestions = questions.filter(
        (q) => q.type === "ONE" && Array.isArray(q.metadata.raw.correct) && q.metadata.raw.correct.length > 1,
      );
      if (multiQuestions.length > 0) {
        found.push({
          bookName: sample.bookName,
          unitName: sample.unitName,
          lessonName: sample.lessonName,
          exerciseName: sample.exerciseName,
          examId: examRef.id,
          examName: examData.examName,
          multiQuestions: multiQuestions.map((q) => ({ id: q.id, question: q.question, answers: q.answers, correctRaw: q.metadata.raw.correct })),
        });
        console.log(`  [FOUND] ${sample.bookName} > ${sample.unitName} > ${sample.lessonName} > ${sample.exerciseName} (exam ${examRef.id}) - ${multiQuestions.length} MULTI candidate(s)`);
      }
    } catch (err) {
      // ignore per-exam errors for this scoped scan
    }
    done++;
    if (done % 50 === 0) console.log(`  [progress] ${done}/${samples.length}`);
  });

  console.log(`\n=== DONE: ${done}/${samples.length} scanned, ${found.length} exam(s) with MULTI candidates ===`);
  console.log(JSON.stringify(found, null, 2));
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
