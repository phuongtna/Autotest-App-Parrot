import { getBooks, filterSelfLearnBooks } from "../discovery/books.js";
import { getUnitsOfBook, filterPublishedUnits } from "../discovery/units.js";
import { getLessonsOfUnit } from "../discovery/lessons.js";
import { getLessonItemsOfLesson, flattenLessonItems, filterExerciseItems } from "../discovery/lessonItems.js";
import { getEntityName } from "../discovery/entityId.js";

const books = filterSelfLearnBooks(await getBooks());
console.log(`SELF_LEARN books: ${books.length} -> ${books.map((b) => getEntityName(b)).join(", ")}`);

let totalUnits = 0, totalLessons = 0, totalExercises = 0;
for (const book of books) {
  const units = filterPublishedUnits(await getUnitsOfBook(book));
  totalUnits += units.length;
  let bookExercises = 0;
  for (const unit of units) {
    const lessons = await getLessonsOfUnit(unit);
    totalLessons += lessons.length;
    for (const lesson of lessons) {
      const items = await flattenLessonItems(await getLessonItemsOfLesson(lesson));
      const exercises = filterExerciseItems(items);
      bookExercises += exercises.length;
      totalExercises += exercises.length;
    }
  }
  console.log(`  ${getEntityName(book)}: ${units.length} units, ${bookExercises} exercises`);
}
console.log(`TOTAL: ${books.length} books, ${totalUnits} units, ${totalLessons} lessons, ${totalExercises} exercises`);
