/**
 * @typedef {Object} HomeworkModel
 * @property {string} id                 - = room.id. QUYẾT ĐỊNH HIỆN TẠI (không phải giả định):
 *                                          response thật của GET /api/user/exams/room.json (đã
 *                                          xác nhận qua 45/45 bản ghi thật, 2026-08-06) KHÔNG có
 *                                          field "homework_id"/"assignment_id" nào riêng - "Bài
 *                                          tập" không phải 1 entity độc lập, chỉ là 1 "Room" (cùng
 *                                          khái niệm Room đã thấy ở Vui học qua lesson-items/:id).
 *                                          Dùng room.id làm khoá chính vì đây là ID ổn định duy
 *                                          nhất định danh đúng 1 lượt giao bài cụ thể.
 * @property {string} title              - room.name (đã xác nhận có cả tiếng Việt tự nhiên, vd
 *                                          "Giải bài trọng âm, rinh ngay điểm 10!" - khớp phong
 *                                          cách tiêu đề card trong Figma)
 * @property {string} type               - room.type - 2 giá trị THẬT quan sát được (45/45 bản
 *                                          ghi): "exercise" (có Question/Exam) | "role_play" (AI
 *                                          Role Play - luôn không có exam, xem "attempts" bên dưới)
 * @property {{startTime: string, endTime: string}} deadline
 *                                        - room.start_time / room.end_time, giữ NGUYÊN chuỗi ISO
 *                                          gốc (không parse Date, không giả định timezone hiển thị)
 * @property {string[]} classIds         - room.class_ids ?? [] (lớp được giao bài)
 * @property {{id: string, name: string}} book       - book_id/book_name (phẳng sẵn trong response)
 * @property {{id: string, name: string}} unit        - unit_id/unit_name
 * @property {{id: string, name: string}} lesson      - lesson_id/lesson_name
 * @property {{id: string, name: string}} lessonItem  - lesson_item_id/lesson_item_name (dùng
 *                                          lessonItem.id để gọi resolveHomeworkLevel() lấy
 *                                          category BASIC/ADVANCED - xem discovery/homeworks.js)
 * @property {{totalStudents: number, completedStudents: number, averageScore: number,
 *             totalQuestions: number}} stats - số liệu tổng hợp phía giáo viên, đọc thẳng từ room
 * @property {?Array<{id: string, examId: string, userId: string, point: number,
 *             totalPoint: number, status: string, finishedAt: ?string}>} attempts
 *                                        - room.answers[] NGUYÊN VĂN (chỉ đổi tên field sang
 *                                          camelCase) - null nếu room KHÔNG có key "answers"
 *                                          (nghĩa là CHƯA có học sinh nào bắt đầu làm - đã xác
 *                                          nhận 37/45 bản ghi thật rơi vào trường hợp này). CỐ TÌNH
 *                                          giữ null thay vì [] để phân biệt "chưa có dữ liệu" với
 *                                          "có dữ liệu nhưng rỗng" - 2 trạng thái khác nghĩa nhau.
 * @property {Object} metadata
 * @property {Object} metadata.raw       - bản ghi thô nguyên văn (1 phần tử data[] từ response) -
 *                                          giữ lại để debug/mở rộng, giống quy ước questionModel.js
 *
 * TRƯỜNG ĐÃ CỐ TÌNH LOẠI KHỎI MODEL (không suy đoán, xem automation/README.md để biết lý do chi
 * tiết từng điểm - đã kiểm tra thật, không phải chưa nghĩ tới):
 * - "examId" ở CẤP HOMEWORK: **UNRESOLVED - chưa có field nào cho việc này, không phải quyết định
 *   cuối cùng.** Hiện KHÔNG có nguồn dữ liệu nào đã được xác nhận đáng tin cậy để lấy Exam ID của
 *   1 Homework trước khi có lượt làm đầu tiên:
 *     - `room.exams` luôn `null` trong toàn bộ dữ liệu hiện có (45/45 bản ghi test được).
 *     - `lesson-items/:id` (`exam_ids`) ĐÃ ĐƯỢC CHỨNG MINH KHÔNG ĐÁNG TIN CẬY (2026-08-06): room
 *       `7325fd77-...` có `attempts[].examId` thật là `"53d15f32-1d00-4785-b152-b93387dc7151"`
 *       nhưng `lesson-items/:id` cùng `lessonItemId` lại trả `exam_ids:
 *       ["188d6a2d-5508-4d45-9c90-61ccd56e05ee"]` - khác hẳn. KHÔNG dùng nguồn này.
 *     - `attempts[].examId` (khi có) CHỈ đúng cho ĐÚNG lượt làm đã xảy ra đó, không suy rộng ra
 *       "exam sẽ dùng cho lượt làm MỚI".
 *   KHÔNG tạo field `examId` placeholder (vd `null`) trong model cho tới khi tìm được đúng
 *   endpoint mà app học sinh THẬT SỰ gọi để mở bài (network capture lúc bấm "Làm bài" trên 1 bài
 *   chưa từng ai làm) - chỉ bổ sung field này vào model khi có nguồn đó, không sớm hơn.
 * - "level"/category (Bài tập về nhà vs Bài tập nâng cao): field "level" (BASIC/ADVANCED) CÓ THẬT
 *   nhưng nằm ở endpoint KHÁC (CMS lesson-items/:id, auth khác hẳn response này) - không có sẵn
 *   trong response GET /api/user/exams/room.json nên KHÔNG đưa vào model này (tránh trộn 2 nguồn
 *   dữ liệu vào 1 object). Dùng discovery/homeworks.js#resolveHomeworkLevel(lessonItem.id) khi
 *   cần, gọi riêng.
 * - "assignedDate" (ngày giáo viên giao bài): không tìm thấy field nào đại diện đúng khái niệm
 *   này trong response - room không có created_at/updated_at, data[] cũng không có. start_time
 *   RẤT có thể bị hiểu nhầm thành ngày giao nhưng thực chất là mốc MỞ bài (đầu cửa sổ deadline) -
 *   không đủ căn cứ để đồng nhất 2 khái niệm.
 * - "status" chưa làm/đang làm/hoàn thành ở CẤP HOMEWORK: không phải 1 field có sẵn - phải tự suy
 *   ra từ việc có/không có 1 phần tử trong "attempts" khớp đúng userId của profile đang xét (xem
 *   hàm resolveMyStatus() bên dưới - đây là suy luận dựa trên field CÓ THẬT (attempts[].userId/
 *   status), không phải field bịa thêm).
 *
 * Nguồn: GET https://parrotedu.vn/api/user/exams/room.json?limit=&page=&period=
 * (đã xác nhận thật bằng token vai trò "teacher", 2026-08-06 - xem automation/README.md mục
 * "Bài tập" để biết giới hạn: CHƯA xác nhận cùng endpoint này khi gọi bằng token học sinh thật
 * có trả cùng shape/đúng phạm vi hiển thị hay không).
 */

function toIdName(id, name) {
  return { id: id ?? null, name: name ?? null };
}

/**
 * @param {Object} rawItem - 1 phần tử trong data[] của response GET .../api/user/exams/room.json
 * @returns {HomeworkModel}
 */
export function normalizeHomework(rawItem) {
  const room = rawItem.room ?? {};
  return {
    id: room.id,
    title: room.name,
    type: room.type,
    deadline: {
      startTime: room.start_time ?? null,
      endTime: room.end_time ?? null,
    },
    classIds: room.class_ids ?? [],
    book: toIdName(rawItem.book_id, rawItem.book_name),
    unit: toIdName(rawItem.unit_id, rawItem.unit_name),
    lesson: toIdName(rawItem.lesson_id, rawItem.lesson_name),
    lessonItem: toIdName(rawItem.lesson_item_id, rawItem.lesson_item_name),
    stats: {
      totalStudents: room.total_students ?? null,
      completedStudents: room.completed_students ?? null,
      averageScore: room.average_score ?? null,
      totalQuestions: room.total_questions ?? null,
    },
    attempts: Array.isArray(room.answers)
      ? room.answers.map((a) => ({
          id: a.id,
          examId: a.exam_id,
          userId: a.user_id,
          point: a.point,
          totalPoint: a.total_point,
          status: a.status,
          finishedAt: a.finished_at ?? null,
        }))
      : null,
    metadata: {
      raw: rawItem,
    },
  };
}

/**
 * Suy ra trạng thái làm bài của 1 profile cụ thể từ "attempts" - KHÔNG phải field có sẵn, đây là
 * suy luận trên field THẬT (attempts[].userId/status): không có attempt nào của userId đó =
 * "NOT_STARTED" (suy từ việc thiếu dữ liệu, đã xác nhận thật 37/45 bản ghi rơi vào TH này); có ít
 * nhất 1 attempt "status: done" = "COMPLETED"; ngược lại "IN_PROGRESS". 3 chuỗi trạng thái này là
 * quy ước đặt tên trong automation, không phải chuỗi lấy từ CMS.
 * @param {HomeworkModel} homework
 * @param {string} userId
 * @returns {"NOT_STARTED"|"IN_PROGRESS"|"COMPLETED"}
 */
export function resolveMyStatus(homework, userId) {
  const mine = (homework.attempts ?? []).filter((a) => a.userId === userId);
  if (mine.length === 0) return "NOT_STARTED";
  if (mine.some((a) => a.status === "done")) return "COMPLETED";
  return "IN_PROGRESS";
}

// Lệch giờ VN cố định (+7h, không có DST) - CÙNG hằng số đã dùng độc lập ở
// automation/bai_tap/pro_lamlai_fullluong.mjs, pro_lamlai_fullluong_xemchitiet.mjs,
// pro_lamlai_beat_previous_score.mjs, verify-filter-web-vs-app.mjs (4 bản copy-paste khác nhau) -
// đặt CHUNG ở đây (model-level, gắn liền field `deadline` mà nó thao tác) để findAssignment() và
// mọi caller mới không tự copy-paste thêm lần thứ 5.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Quy đổi 1 mốc ISO (vd `homework.deadline.endTime`) sang "DD/MM" giờ VN - dùng làm identity phụ
 * (title + dueDateDM) để phân biệt card trùng title trên UI (xem findAssignment.js). Trả về null
 * nếu thiếu iso (role_play/homework chưa có deadline).
 * @param {?string} iso
 * @returns {?string} "DD/MM" hoặc null
 */
export function isoToDueDateDM(iso) {
  if (!iso) return null;
  const shifted = new Date(new Date(iso).getTime() + VN_OFFSET_MS);
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  return `${d}/${m}`;
}
