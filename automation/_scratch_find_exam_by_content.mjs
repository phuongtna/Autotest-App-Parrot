import { getBooks, filterSelfLearnBooks } from "./discovery/books.js";
import { getUnitsOfBook } from "./discovery/units.js";
import { getLessonsOfUnit } from "./discovery/lessons.js";
import { getLessonItemsOfLesson, flattenLessonItems, filterExerciseItems } from "./discovery/lessonItems.js";
import { getExerciseDetail } from "./discovery/exercises.js";
import { getExamOfExercise } from "./discovery/exams.js";
import { parseQuestionsFromExamPageWithRetry } from "./discovery/examPageScraper.js";
import { normalizeQuestions } from "./model/questionModel.js";
import { getEntityName } from "./discovery/entityId.js";

const SEARCH_TERM = process.argv[2] || "THE FUTURE OF COMMUNICATION";
const TARGET_BOOK = process.argv[3] || "Khối 8";

const books = filterSelfLearnBooks(await getBooks());
const book = books.find((b) => getEntityName(b) === TARGET_BOOK);
const units = await getUnitsOfBook(book);
console.log(`Scanning ${units.length} units of ${TARGET_BOOK} for "${SEARCH_TERM}"...`);

for (const unit of units) {
  const unitName = getEntityName(unit);
  const lessons = await getLessonsOfUnit(unit);
  for (const lesson of lessons) {
    const lessonName = getEntityName(lesson);
    const topLevelItems = await getLessonItemsOfLesson(lesson);
    const flatItems = await flattenLessonItems(topLevelItems);
    const exerciseItems = filterExerciseItems(flatItems);
    for (const ex of exerciseItems) {
      const exName = getEntityName(ex);
      try {
        const detail = await getExerciseDetail(ex);
        const examRef = getExamOfExercise(detail);
        const examData = await parseQuestionsFromExamPageWithRetry(examRef.id);
        const blob = JSON.stringify(examData);
        if (blob.includes(SEARCH_TERM)) {
          console.log(`FOUND: ${TARGET_BOOK} > ${unitName} > ${lessonName} > ${exName} (examId=${examRef.id}, examName=${examData.examName})`);
          const questions = normalizeQuestions(examData);
          console.log("types:", questions.map((q) => q.type).join(", "));
          process.exit(0);
        }
      } catch (err) {
        console.log(`  ERROR ${unitName}>${lessonName}>${exName}: ${err.message}`);
      }
    }
  }
}
console.log("NOT FOUND in", TARGET_BOOK);
