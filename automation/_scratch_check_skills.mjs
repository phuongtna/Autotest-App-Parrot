import { getBooks, filterSelfLearnBooks } from "./discovery/books.js";
import { getUnitsOfBook } from "./discovery/units.js";
import { getLessonsOfUnit } from "./discovery/lessons.js";
import { getLessonItemsOfLesson, flattenLessonItems, filterExerciseItems } from "./discovery/lessonItems.js";
import { getExerciseDetail } from "./discovery/exercises.js";
import { getExamOfExercise } from "./discovery/exams.js";
import { parseQuestionsFromExamPageWithRetry } from "./discovery/examPageScraper.js";
import { normalizeQuestions } from "./model/questionModel.js";
import { getEntityName } from "./discovery/entityId.js";

const books = filterSelfLearnBooks(await getBooks());
const book = books.find((b) => getEntityName(b) === "Khối 8");
const units = await getUnitsOfBook(book);
const unit = units.find((u) => getEntityName(u) === "Review 4");
const lessons = await getLessonsOfUnit(unit);
const lesson = lessons.find((l) => getEntityName(l) === "Skills");
const topLevelItems = await getLessonItemsOfLesson(lesson);
const flatItems = await flattenLessonItems(topLevelItems);
const exerciseItems = filterExerciseItems(flatItems);
console.log("Exercises in Skills:", exerciseItems.map((e) => getEntityName(e)));
for (const ex of exerciseItems) {
  const exName = getEntityName(ex);
  const detail = await getExerciseDetail(ex);
  const examRef = getExamOfExercise(detail);
  const examData = await parseQuestionsFromExamPageWithRetry(examRef.id);
  const blob = JSON.stringify(examData);
  console.log(exName, "examId=", examRef.id, "hasInteract=", blob.includes("interact"), "hasFUTURE=", blob.includes("FUTURE OF COMMUNICATION"));
}
