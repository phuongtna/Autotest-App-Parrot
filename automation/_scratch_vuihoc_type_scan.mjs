import { getBooks, filterSelfLearnBooks } from "./discovery/books.js";
import { getUnitsOfBook } from "./discovery/units.js";
import { getLessonsOfUnit } from "./discovery/lessons.js";
import { getLessonItemsOfLesson, flattenLessonItems, filterExerciseItems } from "./discovery/lessonItems.js";
import { getExerciseDetail } from "./discovery/exercises.js";
import { getExamOfExercise } from "./discovery/exams.js";
import { parseQuestionsFromExamPageWithRetry } from "./discovery/examPageScraper.js";
import { normalizeQuestions } from "./model/questionModel.js";
import { getEntityName } from "./discovery/entityId.js";

// Pure API scan (NO device) - find real Vui hoc exercises whose CMS question types include
// DRAG_DROP and/or CONNECT, to complement the already-known "Khoi 8 > Review 4 > Language > De
// part 2" (FILL_WORD, ONE/CHOICE, SORT). Scans "Review" units first (mixed-type observed there),
// bounded to avoid excessive API calls.

const found = { DRAG_DROP: null, CONNECT: null };

async function scanExercise(path, exerciseItem) {
  try {
    const detail = await getExerciseDetail(exerciseItem);
    const examRef = getExamOfExercise(detail);
    const examData = await parseQuestionsFromExamPageWithRetry(examRef.id);
    const questions = normalizeQuestions(examData);
    const types = questions.map((q) => q.type);
    console.log(`${path} -> exam="${examData.examName}" (${examRef.id}) types=[${types.join(", ")}]`);
    if (types.includes("DRAG_DROP") && !found.DRAG_DROP) {
      found.DRAG_DROP = { path, examId: examRef.id, examName: examData.examName, types };
    }
    if (types.includes("CONNECT") && !found.CONNECT) {
      found.CONNECT = { path, examId: examRef.id, examName: examData.examName, types };
    }
  } catch (err) {
    console.log(`${path} -> ERROR: ${err.message}`);
  }
}

async function main() {
  const books = filterSelfLearnBooks(await getBooks());
  console.log(`Books (SELF_LEARN): ${books.map((b) => getEntityName(b)).join(", ")}`);

  for (const book of books) {
    if (found.DRAG_DROP && found.CONNECT) break;
    const bookName = getEntityName(book);
    const units = await getUnitsOfBook(book);
    const reviewUnits = units.filter((u) => /review/i.test(getEntityName(u) || ""));
    const targetUnits = reviewUnits.length > 0 ? reviewUnits : units.slice(0, 2);

    for (const unit of targetUnits) {
      if (found.DRAG_DROP && found.CONNECT) break;
      const unitName = getEntityName(unit);
      const lessons = await getLessonsOfUnit(unit);
      for (const lesson of lessons) {
        if (found.DRAG_DROP && found.CONNECT) break;
        const lessonName = getEntityName(lesson);
        const topLevelItems = await getLessonItemsOfLesson(lesson);
        const flatItems = await flattenLessonItems(topLevelItems);
        const exerciseItems = filterExerciseItems(flatItems);
        for (const ex of exerciseItems) {
          if (found.DRAG_DROP && found.CONNECT) break;
          const exName = getEntityName(ex);
          const path = `${bookName} > ${unitName} > ${lessonName} > ${exName}`;
          await scanExercise(path, ex);
        }
      }
    }
  }

  console.log("\n=== RESULT ===");
  console.log(JSON.stringify(found, null, 2));
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
