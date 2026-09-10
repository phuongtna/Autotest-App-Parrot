/**
 * Resolver "đáp án đúng" cho 1 Exercise cụ thể của tab Vui học (tự học), theo TÊN (Book/Unit/
 * Lesson/Exercise) - KHÔNG random như automation/discovery/cli.js#pickExerciseAttempt(), vì mục
 * tiêu ở đây là trả lời ĐÚNG 1 bài user đang chỉ định (vd "Khối 8 > Review 4 > Language > Đề part
 * 2"), không phải khảo sát ngẫu nhiên.
 *
 * TÁI SỬ DỤNG NGUYÊN VẸN toàn bộ pipeline discovery đã có (books/units/lessons/lessonItems/
 * exercises/exams/examPageScraper/questionModel) - file này CHỈ thêm bước "tìm theo tên" ở mỗi
 * cấp, không đổi bất kỳ hàm nào trong automation/discovery/ hay automation/model/.
 */
import { getBooks, filterSelfLearnBooks } from "../discovery/books.js";
import { getUnitsOfBook } from "../discovery/units.js";
import { getLessonsOfUnit } from "../discovery/lessons.js";
import {
  getLessonItemsOfLesson,
  flattenLessonItems,
  filterExerciseItems,
} from "../discovery/lessonItems.js";
import { getExerciseDetail } from "../discovery/exercises.js";
import { getExamOfExercise } from "../discovery/exams.js";
import { parseQuestionsFromExamPageWithRetry } from "../discovery/examPageScraper.js";
import { normalizeQuestions } from "../model/questionModel.js";
import { getEntityName } from "../discovery/entityId.js";

function namesEqual(a, b) {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function findByName(list, name, label) {
  const match = list.find((item) => namesEqual(getEntityName(item), name));
  if (!match) {
    throw new Error(
      `Không tìm thấy ${label} khớp tên "${name}". Các tên hiện có: ${list.map((i) => getEntityName(i)).join(", ")}`,
    );
  }
  return match;
}

/**
 * @param {{ bookName: string, unitName: string, lessonName: string, exerciseName: string }} target
 * @returns {Promise<{ examId: string, examName: string, questions: import("../model/questionModel.js").QuestionModel[] }>}
 */
export async function resolveVuiHocExamQuestions({ bookName, unitName, lessonName, exerciseName }) {
  const books = filterSelfLearnBooks(await getBooks());
  const book = findByName(books, bookName, `Book (SELF_LEARN) "${bookName}"`);

  const units = await getUnitsOfBook(book);
  const unit = findByName(units, unitName, `Unit "${unitName}" trong Book "${getEntityName(book)}"`);

  const lessons = await getLessonsOfUnit(unit);
  const lesson = findByName(lessons, lessonName, `Lesson "${lessonName}" trong Unit "${getEntityName(unit)}"`);

  const topLevelItems = await getLessonItemsOfLesson(lesson);
  const flatItems = await flattenLessonItems(topLevelItems);
  const exerciseItems = filterExerciseItems(flatItems);
  const exercise = findByName(
    exerciseItems,
    exerciseName,
    `Exercise "${exerciseName}" trong Lesson "${getEntityName(lesson)}"`,
  );

  const detail = await getExerciseDetail(exercise);
  const examRef = getExamOfExercise(detail);
  const examData = await parseQuestionsFromExamPageWithRetry(examRef.id);
  const questions = normalizeQuestions(examData);

  return { examId: examRef.id, examName: examData.examName, questions };
}
