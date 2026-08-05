import { pickRandom } from "./randomPicker.js";

/**
 * Lấy Exam ID tương ứng với 1 Exercise (đã resolve qua getExerciseDetail(), luôn có
 * "exam_ids" - 1 Exercise có thể có nhiều exam_ids, random 1 cái để đa dạng hoá).
 *
 * Không còn gọi CMS API nào ở đây (đã xác nhận "/exams/:examId" không tồn tại, 404 thật) -
 * tên/nội dung đầy đủ của Exam (câu hỏi, đáp án đúng) lấy trực tiếp qua
 * examPageScraper.js#parseQuestionsFromExamPage(examId), trả về sẵn cả "examName".
 */
export function getExamOfExercise(exercise) {
  const examId = pickRandom(exercise.exam_ids);
  return { id: examId };
}
