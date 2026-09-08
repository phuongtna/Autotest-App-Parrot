import { loginTeacherPortal } from "../../giao_bai_tap/navigation/teacherPortalSession.js";
import { teacherClassPageObjects as po } from "../navigation/teacherClassPageObjects.js";
import { readClassCardSiSo } from "../navigation/classListCount.js";
import { listClassRosterStudents } from "../navigation/classRosterList.js";
import { config } from "../../src/config.js";

/**
 * Chụp 1 "snapshot" trạng thái lớp phía web GV - dùng để so sánh BEFORE/AFTER quanh 1 sự kiện rời
 * lớp thật (TC_14/TC_15, kế hoạch test "Rời khỏi lớp" - Giai đoạn 3). Gọi hàm này 2 lần (trước và
 * sau khi chạy Maestro cho học sinh rời lớp thật), rồi so hai kết quả bằng
 * `compareClassRosterSnapshotsCli.js` - KHÔNG so trực tiếp trong 1 lần chạy Playwright vì sự kiện
 * "rời lớp thật" xảy ra ở tiến trình Maestro khác (app), không nằm trong tầm với của script này.
 *
 * @param {object} params
 * @param {string} params.classId - id lớp (dùng cho "Chi tiết lớp" - đọc roster theo TC_14).
 * @param {string} params.className - tên lớp CHÍNH XÁC (dùng cho card "Sĩ số" ở "Lớp phụ trách" -
 *   đọc theo TC_15). PHẢI khớp `exact` với heading hiển thị.
 * @param {boolean} [params.headless=true]
 * @returns {Promise<{classId:string, className:string, siSo:number, rosterRows:string[]}>}
 */
export async function captureClassRosterSnapshot({ classId, className, headless = true }) {
  if (!classId || !className) {
    throw new Error("Thiếu tham số bắt buộc: classId, className.");
  }

  const { browser, page } = await loginTeacherPortal({ headless });
  try {
    // Đọc "Chi tiết lớp" trước (roster - TC_14) - dùng networkidle giống
    // approveStudentRequestFlow.js (trang bắn 3 GET song song sau mount).
    await page.goto(`${config.teacherPortalBaseUrl}${po.path}/${classId}`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(1000); // chờ ngắn cho re-render bảng roster sau khi GET resolve
    const rosterRows = await listClassRosterStudents(page);

    // Đọc "Lớp phụ trách" (danh sách) - sĩ số card của ĐÚNG lớp này (TC_15).
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes("/api/classes/teacher") && res.request().method() === "GET",
        { timeout: 15000 },
      ),
      page.getByRole("link", { name: po.sidebar.classMenuLink }).click(),
    ]);
    await page.getByRole("heading", { name: po.pageHeading }).waitFor({ state: "visible", timeout: 15000 });
    const siSo = await readClassCardSiSo(page, className);

    return { classId, className, siSo, rosterRows };
  } finally {
    await browser.close();
  }
}
