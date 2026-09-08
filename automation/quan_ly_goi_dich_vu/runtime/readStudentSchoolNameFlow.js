import { loginCmsAdmin } from "../navigation/cmsAdminSession.js";
import { gotoStudents, searchStudent, readStudentSchoolName } from "../navigation/cmsAdminPageObjects.js";
import { resolveCmsAdminBaseUrl } from "../../src/config.js";

/**
 * Đọc 1 snapshot cột "TÊN TRƯỜNG" trên CMS Quản lý > "/students" cho 1 profile cụ thể - dùng cho
 * case 9 (kế hoạch test "Rời khỏi lớp": rời lớp thành công -> CMS để trống Trường học; đang chờ
 * duyệt -> cũng để trống; đã duyệt -> hiện đúng tên trường thật).
 *
 * Gọi hàm này NHIỀU LẦN (mỗi lần sau 1 thao tác đổi trạng thái lớp thật ở phía app/Maestro) để lấy
 * chuỗi snapshot theo thời gian - so sánh thủ công hoặc qua CLI wrapper.
 *
 * @param {object} params
 * @param {string} params.phoneDigits - số điện thoại tài khoản cha (không dấu +/khoảng trắng, vd
 *   "84915775115" - khớp CHÍNH XÁC text hiển thị cột "SỐ ĐIỆN THOẠI").
 * @param {string} params.profileName - tên profile con, PHẢI truyền khi 1 số điện thoại có nhiều
 *   profile con (xem `studentRow()` trong cmsAdminPageObjects.js).
 * @param {boolean} [params.headless=true]
 * @param {string} [params.envOverride] - ép môi trường CMS Admin cụ thể, bỏ qua CMS_ADMIN_ENV
 *   trong .env nếu truyền.
 * @returns {Promise<{phoneDigits:string, profileName:string, schoolName:string, isEmpty:boolean}>}
 */
export async function readStudentSchoolNameFlow({ phoneDigits, profileName, headless = true, envOverride } = {}) {
  if (!phoneDigits || !profileName) {
    throw new Error("Thiếu tham số bắt buộc: phoneDigits, profileName.");
  }

  const baseUrl = resolveCmsAdminBaseUrl(envOverride);
  const { browser, page } = await loginCmsAdmin({ headless, envOverride });
  try {
    await gotoStudents(page, baseUrl);
    await searchStudent(page, baseUrl, profileName);
    const schoolName = (await readStudentSchoolName(page, phoneDigits, profileName)).trim();
    // "—" (em dash) là giá trị rỗng thật đã xác nhận (2026-09-08) - xem readStudentSchoolName().
    return { phoneDigits, profileName, schoolName, isEmpty: schoolName === "—" || schoolName === "" };
  } finally {
    await browser.close();
  }
}
