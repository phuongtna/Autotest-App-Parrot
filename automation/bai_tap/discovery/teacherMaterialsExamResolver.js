import { getHomeworks, fetchRoomDetails } from "./homeworks.js";
import { fetchLessonItems } from "../../giao_bai_tap/navigation/teacherAssignmentApiDiscovery.js";
import { parseQuestionsFromExamPage } from "../../discovery/examPageScraper.js";
import { normalizeQuestions } from "../../model/questionModel.js";

/**
 * Nguồn đáp án THAY THẾ cho homeworkExamResolver.js#resolveHomeworkExamQuestions() (KHÔNG xoá bản
 * cũ - vẫn cần khi nguồn này BLOCKED, xem status bên dưới). Khác biệt duy nhất: examId lấy qua
 * "Tài liệu giáo viên" (catalog CMS đứng sau form Giao bài, `POST /api/learn/items`) thay vì
 * `room.attempts[].examId` - nghĩa là dùng được NGAY CẢ KHI chưa có học sinh nào làm bài (không cần
 * đợi 1 lượt attempt), khác hẳn giới hạn đã ghi trong homeworkExamResolver.js.
 *
 * ĐÃ XÁC NHẬN THẬT (2026-08-14, xem memory project_teacher_materials_answer_source.md), KHÔNG PHẢI
 * SUY ĐOÁN:
 * - "Tài liệu giáo viên" thật ra nằm ở CMS (cms.parrotedu.vn/document/materials), nhưng trang đó
 *   CHỈ để biên tập cấu trúc Unit/Lesson (thêm/import/sửa/xoá) - KHÔNG có UI xem câu hỏi/đáp án của
 *   1 Lesson đã có. Nguồn dữ liệu câu hỏi+đáp án dùng được thực chất là examId của catalog
 *   `/api/learn/items` (đã tồn tại sẵn trong teacherAssignmentApiDiscovery.js, dùng cho form Giao
 *   bài) đưa thẳng vào PIPELINE ĐÃ CÓ SẴN (`examPageScraper.js#parseQuestionsFromExamPage()` +
 *   `questionModel.js#normalizeQuestions()`) - KHÔNG viết lại parser mới.
 * - examId của catalog (vd "ea6fe7d0-...") KHÁC với examId thật của lượt làm
 *   (`room.answers[].exam_id`, vd "5a260a0b-...") - ĐÚNG như cảnh báo cũ trong
 *   automation/README.md/homeworkModel.js. NHƯNG đã đối chiếu NỘI DUNG (không phải ID): câu hỏi
 *   CONNECT "Listen and match" (Tom/Linda/Peter/Lucy/Ben <-> skipping/skating/cycling/painting/
 *   flying a kite) lấy qua examId catalog KHỚP 100% với nội dung hiển thị trên trang "Báo cáo lớp"
 *   thật (điểm số/Đúng-Sai thật của học sinh "Ngoc") của ĐÚNG Room đó. Tức: dùng được để lấy đáp án
 *   đúng, dù examId không trùng - vì hệ thống copy nguyên nội dung từ "đề gốc" (catalog) sang "đề
 *   giao" (instance) lúc Giao bài, ÍT NHẤT khi `is_swap_answer`/`is_swap_question` đều false (case
 *   đã verify). CHƯA verify khi 2 cờ swap này true - rủi ro còn lại, xem status "CONTENT_MAY_DIFFER"
 *   không tồn tại (chưa phát hiện được cách phân biệt trước khi lấy nội dung) - nếu cần production
 *   cứng, phải tự đối chiếu lại qua "Báo cáo lớp" như trên trước khi tin tưởng tuyệt đối.
 * - Mapping Room -> catalog item dùng ĐÚNG 3 stable ID lấy từ `room_details.json` (KHÔNG match theo
 *   tên/index): `unit_id` + `tag_id` (định danh Lesson cho catalog, KHÁC `lesson_id`) để tra
 *   `POST /api/learn/items`, rồi tìm phần tử có `item.id === lesson_item_id` (chính là
 *   `HomeworkModel.lessonItem.id`) - loại bỏ hoàn toàn rủi ro trùng tên bài tập đã ghi trong
 *   homeworkExamResolver.js (vd nhiều bài cùng chứa "Read and choose").
 *
 * CHƯA XÁC NHẬN / GIỚI HẠN CÒN LẠI (không suy đoán thêm):
 * - 1 lesson item CÓ THỂ có nhiều "mã đề" (`exam_ids.length > 1` - đã thấy UI "Mã đề 1" trong modal
 *   "Xem chi tiết" của form Giao bài) - CHƯA có cách xác định đúng mã đề nào được giao cho Room cụ
 *   thể khi có nhiều hơn 1. Hàm dưới đây trả status "AMBIGUOUS_EXAM_ID" thay vì đoán lấy phần tử
 *   đầu.
 * - Chỉ verify content-match cho ĐÚNG 1 loại bài (CONNECT). Các loại khác (FILL_WORD, DRAG_DROP,
 *   SPEAK, MULTI, SORT, SENTENCE_BUILDER...) CHƯA kiểm chứng - không suy rộng kết luận.
 */

/**
 * @param {{ unitId: string, tagId: string, lessonItemId: string }} params
 * @returns {Promise<
 *     { status: "RESOLVED", examId: string, item: Object }
 *   | { status: "ITEM_NOT_FOUND", reason: string }
 *   | { status: "NO_EXAM_ID", reason: string, item: Object }
 *   | { status: "AMBIGUOUS_EXAM_ID", reason: string, item: Object, examIds: string[] }
 * >}
 */
export async function resolveExamIdFromTeacherMaterials({ unitId, tagId, lessonItemId }) {
  if (!unitId || !tagId || !lessonItemId) {
    throw new Error(
      "resolveExamIdFromTeacherMaterials: thiếu unitId/tagId/lessonItemId - không thể tra catalog Teacher Materials (/api/learn/items).",
    );
  }
  const items = await fetchLessonItems({ unitId, tagId });
  const item = (items || []).find((it) => it.id === lessonItemId);
  if (!item) {
    return {
      status: "ITEM_NOT_FOUND",
      reason: `Không tìm thấy lesson item id=${lessonItemId} trong catalog Teacher Materials (unitId=${unitId}, tagId=${tagId}) - Lesson có thể đã bị xoá/đổi cấu trúc từ lúc Room được tạo.`,
    };
  }
  const examIds = Array.isArray(item.exam_ids) ? item.exam_ids : [];
  if (examIds.length === 0) {
    return {
      status: "NO_EXAM_ID",
      reason: `Lesson item "${item.name}" (id=${lessonItemId}) không có exam_ids nào trong catalog.`,
      item,
    };
  }
  if (examIds.length > 1) {
    return {
      status: "AMBIGUOUS_EXAM_ID",
      reason: `Lesson item "${item.name}" (id=${lessonItemId}) có ${examIds.length} exam_ids ("mã đề") trong catalog - chưa có cách xác định đúng mã đề nào được giao cho Room cụ thể, KHÔNG đoán lấy phần tử đầu.`,
      item,
      examIds,
    };
  }
  return { status: "RESOLVED", examId: examIds[0], item };
}

/**
 * Bản thay thế của homeworkExamResolver.js#resolveHomeworkExamQuestions() - CÙNG chữ ký/shape trả
 * về (drop-in) nhưng dùng examId catalog Teacher Materials thay vì attempts[].examId, nên hoạt
 * động được kể cả khi Room CHƯA có học sinh nào làm.
 * @param {string} title - HomeworkModel.title (= room.name)
 * @param {{ period?: string, testClassId?: string }} [options]
 * @returns {Promise<
 *     { status: "RESOLVED", examId: string, examName: string, questions: import("../../model/questionModel.js").QuestionModel[], room: Object, catalogItem: Object }
 *   | { status: "ROOM_NOT_FOUND", reason: string }
 *   | { status: "ITEM_NOT_FOUND"|"NO_EXAM_ID"|"AMBIGUOUS_EXAM_ID", reason: string, room: Object }
 *   | { status: "SESSION_ERROR", reason: string, examId: string, room: Object }
 * >}
 */
export async function resolveHomeworkExamQuestionsFromTeacherMaterials(
  title,
  { period = "MONTH", testClassId } = {},
) {
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
  const room = matches[0];

  const roomDetails = await fetchRoomDetails(room.id);
  const tagId = roomDetails?.tag_id;
  const unitId = room.unit.id;
  const lessonItemId = room.lessonItem.id;

  const resolved = await resolveExamIdFromTeacherMaterials({ unitId, tagId, lessonItemId });
  if (resolved.status !== "RESOLVED") {
    return { ...resolved, room };
  }

  let examData;
  try {
    examData = await parseQuestionsFromExamPage(resolved.examId);
  } catch (err) {
    return { status: "SESSION_ERROR", reason: err.message, examId: resolved.examId, room };
  }

  return {
    status: "RESOLVED",
    examId: resolved.examId,
    examName: examData.examName,
    questions: normalizeQuestions(examData),
    room,
    catalogItem: resolved.item,
  };
}
