import { getBooks, filterSelfLearnBooks } from "../discovery/books.js";
import { getUnitsOfBook, filterPublishedUnits } from "../discovery/units.js";
import { getLessonsOfUnit } from "../discovery/lessons.js";
import { getLessonItemsOfLesson, flattenLessonItems, filterExerciseItems } from "../discovery/lessonItems.js";
import { getEntityName } from "../discovery/entityId.js";

const books = filterSelfLearnBooks(await getBooks());
const targetBooks = books.filter((b) => ["Khối 6", "Khối 7", "Khối 8", "Khối 9", "Khối 10", "Khối 11", "Khối 12"].includes(getEntityName(b)));

let totalVocabExercises = 0;
const vocabLessons = [];
for (const book of targetBooks) {
  const units = filterPublishedUnits(await getUnitsOfBook(book));
  for (const unit of units) {
    const lessons = await getLessonsOfUnit(unit);
    for (const lesson of lessons) {
      const name = (getEntityName(lesson) || "").toLowerCase();
      if (name.includes("vocab") || name.includes("từ vựng")) {
        const items = await flattenLessonItems(await getLessonItemsOfLesson(lesson));
        const exercises = filterExerciseItems(items);
        totalVocabExercises += exercises.length;
        vocabLessons.push({
          book: getEntityName(book),
          unit: getEntityName(unit),
          lesson: getEntityName(lesson),
          exerciseNames: exercises.map((e) => getEntityName(e)),
        });
      }
    }
  }
}
console.log(`Vocabulary-ish lessons found: ${vocabLessons.length}, total exercises inside them: ${totalVocabExercises}`);
for (const v of vocabLessons) {
  console.log(`${v.book} > ${v.unit} > ${v.lesson}: [${v.exerciseNames.join(", ")}]`);
}
