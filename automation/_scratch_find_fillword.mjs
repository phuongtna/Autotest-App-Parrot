import { getBooks, filterSelfLearnBooks } from "./discovery/books.js";
import { getUnitsOfBook } from "./discovery/units.js";
import { getLessonsOfUnit } from "./discovery/lessons.js";
import { getLessonItemsOfLesson, flattenLessonItems, filterExerciseItems } from "./discovery/lessonItems.js";
import { getExerciseDetail } from "./discovery/exercises.js";
import { getExamOfExercise } from "./discovery/exams.js";
import { parseQuestionsFromExamPageWithRetry } from "./discovery/examPageScraper.js";
import { normalizeQuestions } from "./model/questionModel.js";
import { getEntityName } from "./discovery/entityId.js";

const EXCLUDE_EXAM_ID = "0962ee78-1a4f-4cb3-839a-f68c8332401d"; // Đề part 2, already known bug #3
const candidates = [];

async function scanExercise(path, exerciseItem) {
  try {
    const detail = await getExerciseDetail(exerciseItem);
    const examRef = getExamOfExercise(detail);
    if (examRef.id === EXCLUDE_EXAM_ID) return;
    const examData = await parseQuestionsFromExamPageWithRetry(examRef.id);
    const questions = normalizeQuestions(examData);
    const types = questions.map((q) => q.type);
    const fillCount = types.filter((t) => t === "FILL_WORD").length;
    if (fillCount > 0) {
      console.log(`FOUND: ${path} -> exam="${examData.examName}" (${examRef.id}) fillCount=${fillCount} types=[${types.join(", ")}]`);
      candidates.push({ path, examId: examRef.id, examName: examData.examName, fillCount, types, ids: questions.filter(q=>q.type==="FILL_WORD").map(q=>q.id) });
    }
  } catch (err) {
    console.log(`${path} -> ERROR: ${err.message}`);
  }
}

async function main() {
  const books = filterSelfLearnBooks(await getBooks());
  const targetBooks = books.filter((b) => /Khối (6|7|8|9)/.test(getEntityName(b)));
  for (const book of targetBooks) {
    if (candidates.length >= 3) break;
    const bookName = getEntityName(book);
    const units = await getUnitsOfBook(book);
    for (const unit of units) {
      if (candidates.length >= 3) break;
      const unitName = getEntityName(unit);
      const lessons = await getLessonsOfUnit(unit);
      for (const lesson of lessons) {
        if (candidates.length >= 3) break;
        const lessonName = getEntityName(lesson);
        const topLevelItems = await getLessonItemsOfLesson(lesson);
        const flatItems = await flattenLessonItems(topLevelItems);
        const exerciseItems = filterExerciseItems(flatItems);
        for (const ex of exerciseItems) {
          if (candidates.length >= 3) break;
          const exName = getEntityName(ex);
          const path = `${bookName} > ${unitName} > ${lessonName} > ${exName}`;
          await scanExercise(path, ex);
        }
      }
    }
  }
  console.log("\n=== CANDIDATES ===");
  console.log(JSON.stringify(candidates, null, 2));
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
