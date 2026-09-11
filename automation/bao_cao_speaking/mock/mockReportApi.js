import { resolveTeacherPortalBaseUrl } from "../../src/config.js";

// ĐÃ XÁC NHẬN THẬT (2026-09-11) - room có sẵn trên Dev, dùng làm "vỏ" trang report cho MỌI test
// Tầng 2 (mock) - không cần room khác vì toàn bộ dữ liệu hiển thị đều bị mock ghi đè, chỉ cần 1
// room THẬT tồn tại để trang tải được (room_details.json, quyền truy cập... vẫn gọi API thật).
export const MOCK_REPORT_ROOM_ID = "9cf81245-787e-44c8-8178-d66794f9832a";

/**
 * Interceptor `page.route()` (Tầng 2 - mock) cho 3 API report-stats thật đứng sau trang
 * "Báo cáo lớp" (xem schema + đường dẫn xác nhận thật trong speakingReportPageObjects.js).
 *
 * CHIẾN LƯỢC: chỉ mock 3 endpoint report-stats (dữ liệu cần kiểm soát chính xác % để test ngưỡng/
 * phân loại) - VẪN điều hướng tới 1 ROOM THẬT đã tồn tại (roomId thật, xem
 * flows/web/teacher/testcases/bao-cao-hoc-tap/) để mọi API khác (room_details.json, auth session,
 * v.v.) chạy qua backend THẬT bình thường - giảm bề mặt phải mock, chỉ kiểm soát đúng phần dữ liệu
 * cần ép giá trị chính xác (áp dụng đúng tinh thần "Tầng 2" của plan gốc).
 *
 * PHẢI gọi `mockSpeakingReportApi(page, ...)` TRƯỚC `page.goto(reportUrl)` - `page.route()` chỉ
 * áp dụng cho request phát sinh SAU khi đăng ký.
 */
export async function mockSpeakingReportApi(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic }) {
  if (roomAnalytic) {
    await page.route("**/api/user/report-stats/room-analytic**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(roomAnalytic) }),
    );
  }
  if (roomQuestionsAnalytic) {
    await page.route("**/api/user/report-stats/room-questions-analytic**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(roomQuestionsAnalytic) }),
    );
  }
  if (questionDetailAnalytic) {
    await page.route("**/api/user/report-stats/question-detail-analytic**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(questionDetailAnalytic) }),
    );
  }
}

/** Đăng ký mock RỒI điều hướng thẳng tới trang report của MOCK_REPORT_ROOM_ID (KHÔNG qua "Giao
 * bài tập" -> tìm dòng - không cần thiết cho test Tầng 2, dữ liệu hiển thị hoàn toàn do mock quyết
 * định) - dùng chung cho mọi spec Nhóm A/D/E/F/H/I. Phải đăng nhập TRƯỚC khi gọi hàm này (cần
 * `page` đã có session). */
export async function gotoMockedReport(page, mocks) {
  await mockSpeakingReportApi(page, mocks);
  const reportUrl = `${resolveTeacherPortalBaseUrl("dev")}/teacher/exercise/${MOCK_REPORT_ROOM_ID}/report`;
  // SỬA (2026-09-11, FAIL thật xác nhận qua chạy live Nhóm A): "networkidle" không đáng tin trên
  // host Dev này (xem cùng lý do đã sửa ở speakingReportSession.js#loginSpeakingReportPortalOnPage)
  // - đổi "domcontentloaded" + chờ tường minh nút tab "Sai (N)" xuất hiện (luôn có vì mock luôn
  // cấp room-questions-analytic với ít nhất 1 câu) làm bằng chứng trang đã render xong dữ liệu mock.
  await page.goto(reportUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.getByRole("button", { name: /^Sai \(\d+\)$/ }).waitFor({ timeout: 30000 });
}
