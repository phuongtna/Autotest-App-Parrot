import { config, requireTeacherPortalConfig } from "../../src/config.js";
import { callEndpoint } from "../../discovery/cmsClient.js";
import { normalizeHomework } from "../model/homeworkModel.js";

/**
 * Discovery cho "Bài tập" (Homework) - ĐỘC LẬP với discovery/books.js.js/units.js/... (Vui học):
 * nguồn dữ liệu là 1 hệ thống KHÁC hẳn (portal Giáo viên parrotedu.vn/teacher/exercise), không
 * phải CMS admin (parrotedu.vn/api/cms/...).
 *
 * ĐÃ XÁC NHẬN THẬT (2026-08-06, 45/45 bản ghi lấy được qua page 1+2, period=WEEK):
 * GET https://parrotedu.vn/api/user/exams/room.json?limit=&page=&period=
 * trả về { status, total, class_names, creator_rooms, data: [...] } - "data[]" là danh sách
 * "Room" (= "Bài tập" giao cho lớp), mỗi phần tử có sẵn book/unit/lesson/lessonItem phẳng +
 * room{} (deadline, class_ids, type, stats, answers nếu có học sinh đã làm).
 *
 * GIỚI HẠN ĐÃ BIẾT (xem model/homeworkModel.js để biết chi tiết field bị loại):
 * - Token/cookie hiện dùng để test là của tài khoản vai trò "teacher" - CHƯA xác nhận cùng
 *   endpoint này gọi bằng token học sinh thật có trả đúng/đủ phạm vi "Bài tập" hiển thị trên app
 *   học sinh hay không (path là /api/user/... không phải /api/teacher/... nên khả năng cao dùng
 *   chung, nhưng chưa có bằng chứng trực tiếp).
 * - Exam ID ở cấp Room hiện là UNRESOLVED (xem model/homeworkModel.js) - chưa có nguồn dữ liệu
 *   nào đã được xác nhận đáng tin cậy cho trường hợp CHƯA có học sinh nào làm. KHÔNG suy đoán/
 *   không tạo field placeholder ở đây - chỉ bổ sung khi tìm được đúng endpoint mà app học sinh
 *   thật sự dùng để mở bài.
 */

class TeacherPortalApiError extends Error {
  constructor(message, { status, url, body } = {}) {
    super(message);
    this.name = "TeacherPortalApiError";
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

async function rawGet(url) {
  const headers = {
    Accept: "*/*",
    Authorization: `Bearer ${config.teacherAccessToken}`,
  };
  if (config.teacherSessionCookie) headers.Cookie = config.teacherSessionCookie;

  const res = await fetch(url, { headers });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

/**
 * Gọi đúng 1 trang của GET /api/user/exams/room.json - KHÔNG tự lọc/diễn giải gì thêm, trả
 * nguyên response đã parse JSON (đúng shape đã xác nhận thật ở trên).
 * @param {{ period?: string, page?: number, limit?: number }} options
 */
export async function fetchHomeworkRoomsPage({ period = "WEEK", page = 1, limit = 30 } = {}) {
  requireTeacherPortalConfig();
  const url =
    `${config.teacherPortalBaseUrl}/api/user/exams/room.json` +
    `?limit=${encodeURIComponent(limit)}&page=${encodeURIComponent(page)}&period=${encodeURIComponent(period)}`;
  const result = await rawGet(url);
  if (!result.ok) {
    throw new TeacherPortalApiError(
      `GET ${url} trả về status ${result.status}`,
      { status: result.status, url, body: result.body },
    );
  }
  return result.body;
}

/**
 * Lấy TOÀN BỘ "data[]" (gộp hết các trang) cho 1 "period" - period là query param CỦA endpoint
 * (đã xác nhận "WEEK" và "MONTH" đều trả 200, số "total" khác nhau tương ứng - "WEEK"=45,
 * "MONTH"=149, tại thời điểm test 2026-08-06) - KHÔNG phải field trong response.
 * @param {{ period?: string, pageSize?: number }} options
 * @returns {Promise<Object[]>} mảng "data[]" thô, CHƯA normalize
 */
export async function fetchAllHomeworkRooms({ period = "WEEK", pageSize = 30 } = {}) {
  let page = 1;
  let all = [];
  let total = Infinity;
  while (all.length < total) {
    const body = await fetchHomeworkRoomsPage({ period, page, limit: pageSize });
    total = body.total ?? all.length + (body.data?.length ?? 0);
    if (!Array.isArray(body.data) || body.data.length === 0) break;
    all = all.concat(body.data);
    page += 1;
  }
  return all;
}

/**
 * Lấy toàn bộ Homework đã normalize theo HomeworkModel (model/homeworkModel.js).
 * @param {{ period?: string }} options
 * @returns {Promise<import("../model/homeworkModel.js").HomeworkModel[]>}
 */
export async function getHomeworks({ period = "WEEK" } = {}) {
  const rawRooms = await fetchAllHomeworkRooms({ period });
  return rawRooms.map(normalizeHomework);
}

/**
 * Lọc bỏ Homework type="role_play" (AI Role Play) - TẠM THỜI (theo yêu cầu 2026-08-06), không
 * phải kết luận cuối cùng. Lý do: room.exams/exam_ids của type này luôn null (đã xác nhận thật -
 * xem model/homeworkModel.js), tức KHÔNG có Question/Exam pipeline như các Homework type khác, và
 * theo xác nhận của bạn "AI Role Play luôn là bài nâng cao" - not tương thích với luồng
 * Discovery->Navigation->Launch đang test (không có gì để random trúng examId dù endpoint launch
 * có được xác nhận sau này). Bỏ filter này khi muốn random cả role_play trở lại.
 * @param {import("../model/homeworkModel.js").HomeworkModel[]} homeworks
 */
export function filterOutRolePlay(homeworks) {
  return homeworks.filter((h) => h.type !== "role_play");
}

/**
 * Lấy "level" (BASIC | ADVANCED) của 1 Homework qua lessonItem.id - ĐÃ XÁC NHẬN THẬT field này
 * tồn tại và nhất quán qua 3 lần gọi trực tiếp GET /api/cms/lesson-items/:id (2026-08-06,
 * "ADVANCED" khớp đúng 1 Room type="role_play" + 1 lesson-item chỉnh sửa thủ công bạn xác nhận;
 * "BASIC" ở các lesson-item còn lại) - KHÁC với exam_ids của cùng endpoint này (đã xác nhận SAI
 * lệch với Exam ID thật của Room, xem model/homeworkModel.js) nên hàm này CHỈ đọc field "level",
 * không đọc "exam_ids".
 *
 * Dùng lại nguyên endpoint "lessonItemDetail" đã có sẵn + xác nhận trong discovery/endpoints.js
 * (auth "cms", KHÁC credential với fetchHomeworkRoomsPage() ở trên).
 * @param {string} lessonItemId
 * @returns {Promise<"BASIC"|"ADVANCED"|null>}
 */
export async function resolveHomeworkLevel(lessonItemId) {
  const body = await callEndpoint("lessonItemDetail", { lessonItemId });
  const data = body?.data ?? body;
  return data?.level ?? null;
}

export { TeacherPortalApiError };
