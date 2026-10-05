import { getBooks, filterSelfLearnBooks } from "./discovery/books.js";
import { getUnitsOfBook } from "./discovery/units.js";
import { getLessonsOfUnit } from "./discovery/lessons.js";
import { getLessonItemsOfLesson, flattenLessonItems, filterExerciseItems } from "./discovery/lessonItems.js";
import { getExerciseDetail } from "./discovery/exercises.js";
import { getExamOfExercise } from "./discovery/exams.js";
import { parseQuestionsFromExamPageWithRetry } from "./discovery/examPageScraper.js";
import { normalizeQuestions } from "./model/questionModel.js";
import { getEntityName } from "./discovery/entityId.js";

const EXCLUDE = new Set(["ff11f282-9caf-4de9-bec5-6fd9dbae1a78"]); // Phonics, already used
const candidates = [];

async function scanExercise(path, exerciseItem) {
  try {
    const detail = await getExerciseDetail(exerciseItem);
    const examRef = getExamOfExercise(detail);
    if (EXCLUDE.has(examRef.id)) return;
    const examData = await parseQuestionsFromExamPageWithRetry(examRef.id);
    const questions = normalizeQuestions(examData);
    const types = questions.map((q) => q.type);
    const dd = types.filter((t) => t === "DRAG_DROP").length;
    if (dd > 0) {
      console.log(`FOUND: ${path} -> exam="${examData.examName}" (${examRef.id}) ddCount=${dd} types=[${types.join(", ")}]`);
      candidates.push({ path, examId: examRef.id, examName: examData.examName, dd });
    }
  } catch (err) {}
}

async function main() {
  const books = filterSelfLearnBooks(await getBooks());
  const targetBooks = books.filter((b) => /Khối (1|2|3)$/.test(getEntityName(b)));
  for (const book of targetBooks) {
    if (candidates.length >= 2) break;
    const bookName = getEntityName(book);
    const units = await getUnitsOfBook(book);
    const reviewUnits = units.filter((u) => /review/i.test(getEntityName(u) || ""));
    for (const unit of reviewUnits) {
      if (candidates.length >= 2) break;
      const unitName = getEntityName(unit);
      const lessons = await getLessonsOfUnit(unit);
      for (const lesson of lessons) {
        if (candidates.length >= 2) break;
        const lessonName = getEntityName(lesson);
        const topLevelItems = await getLessonItemsOfLesson(lesson);
        const flatItems = await flattenLessonItems(topLevelItems);
        const exerciseItems = filterExerciseItems(flatItems);
        for (const ex of exerciseItems) {
          if (candidates.length >= 2) break;
          const exName = getEntityName(ex);
          const path = `${bookName} > ${unitName} > ${lessonName} > ${exName}`;
          await scanExercise(path, ex);
        }
      }
    }
  }
  console.log("DONE. candidates:", candidates.length);
}
main().catch(e => console.error("FATAL", e.message));
