import { getHomeworks } from "./homeworks.js";
import { parseQuestionsFromExamPage } from "../../discovery/examPageScraper.js";
import { normalizeQuestions } from "../../model/questionModel.js";

/**
 * Nối "1 Homework đã random từ UI THẬT" (chỉ có `title`, không có examId - xem
 * `discovery/homeworkUiList.js`) sang đúng dữ liệu Exam/Question/Correct-Answer đã có sẵn qua
 * pipeline Exam/CMS hiện có (`discovery/examPageScraper.js` + `model/questionModel.js`) - KHÔNG
 * tạo pipeline mới, KHÔNG đoán endpoint mới, TÁI SỬ DỤNG NGUYÊN VẸN những gì đã xác nhận thật.
 *
 * Đường nối DUY NHẤT đã xác nhận đáng tin cậy (xem `model/homeworkModel.js` + automation/README.md
 * mục "Bài tập - Discovery"): `HomeworkModel.attempts[].examId` (= `room.answers[].exam_id`) - CHỈ
 * có khi Room đã có ít nhất 1 lượt làm trước đó. `lesson-items/:id.exam_ids` đã bị LOẠI vì đã
 * CHỨNG MINH sai lệch thật (README, 2026-08-06) - KHÔNG dùng lại nguồn đó dù có sẵn.
 *
 * title (UI) -> title (teacher-portal API, `HomeworkModel.title` = `room.name`) là điểm nối DUY
 * NHẤT hiện có giữa 2 nguồn dữ liệu (UI học sinh vs API giáo viên) - CHƯA có ID chung nào khác đã
 * xác nhận (xem README "GIỚI HẠN CHƯA XÁC NHẬN"). Nếu khớp NHIỀU Room cùng title (nhiều lớp cùng
 * được giao 1 bài giống tên), ưu tiên Room có `classIds` chứa `testClassId` nếu truyền vào, sau đó
 * ưu tiên Room đã có `attempts` (mới có examId để dùng) - không suy đoán nếu vẫn còn nhiều lựa
 * chọn, chỉ lấy phần tử đầu tiên còn lại (đã lọc hết mức có thể).
 */

/**
 * @param {string} title - `HomeworkModel.title`/UI title (đã xác nhận cùng nguồn text: `room.name`)
 * @param {{ period?: string, testClassId?: string }} [options]
 * @returns {Promise<
 *     { status: "RESOLVED", examId: string, examName: string, questions: import("../../model/questionModel.js").QuestionModel[], room: Object }
 *   | { status: "ROOM_NOT_FOUND", reason: string }
 *   | { status: "UNRESOLVED_EXAM_ID", reason: string, room: Object }
 *   | { status: "SESSION_ERROR", reason: string, examId: string, room: Object }
 * >}
 */
export async function resolveHomeworkExamQuestions(title, { period = "MONTH", testClassId } = {}) {
  const homeworks = await getHomeworks({ period });
  let matches = homeworks.filter((h) => h.title === title);
  if (matches.length === 0) {
    return {
      status: "ROOM_NOT_FOUND",
      reason: `Không tìm thấy Room nào khớp title "${title}" qua teacher-portal API (period=${period}) - có thể Homework này thuộc lớp khác/ngoài phạm vi token giáo viên đang dùng.`,
    };
  }
  if (testClassId) {
    const scoped = matches.filter((h) => h.classIds.includes(testClassId));
    if (scoped.length > 0) matches = scoped;
  }
  const withAttempts = matches.find((h) => Array.isArray(h.attempts) && h.attempts.some((a) => a.examId));
  const room = withAttempts ?? matches[0];

  const examId = (room.attempts ?? []).map((a) => a.examId).find(Boolean) ?? null;
  if (!examId) {
    return {
      status: "UNRESOLVED_EXAM_ID",
      reason:
        `Room "${title}" (id=${room.id}) chưa có "attempts[].examId" nào (chưa ai làm lượt nào) - ` +
        `đây là hạn chế ĐÃ BIẾT của teacher-portal API (không có nguồn nào khác đáng tin cậy để lấy ` +
        `examId trước lượt làm đầu tiên, xem automation/README.md mục "Bài tập - Discovery"). KHÔNG ` +
        `suy đoán examId từ nguồn khác (vd lesson-items/:id đã bị chứng minh sai lệch).`,
      room,
    };
  }

  let examData;
  try {
    examData = await parseQuestionsFromExamPage(examId);
  } catch (err) {
    return { status: "SESSION_ERROR", reason: err.message, examId, room };
  }

  return {
    status: "RESOLVED",
    examId,
    examName: examData.examName,
    questions: normalizeQuestions(examData),
    room,
  };
}
