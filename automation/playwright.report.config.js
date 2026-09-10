import { defineConfig } from "@playwright/test";

/**
 * Config Playwright Test riêng cho `*.spec.js` trong `../flows/web/teacher/testcases/`
 * (báo cáo học tập - Web GV) - TÁCH KHỎI `playwright.config.js` (dùng cho CMS Quản lý
 * `flows/cms/goi_dich_vu/`) để không đổi hành vi/testDir của bộ đó. Chạy:
 * `cd automation && npx playwright test --config=playwright.report.config.js` (hoặc
 * `npm run test-bao-cao-hoc-tap-pw`).
 *
 * `workers: 1` + `fullyParallel: false` - mỗi file `.spec.js` dùng 1 phiên đăng nhập GV dùng
 * chung qua `test.describe.serial()` (cùng quy ước với `automation/playwright.config.js`), không
 * chạy song song được vì các test sau phụ thuộc trạng thái điều hướng (đã mở đúng màn Báo cáo
 * lớp) do test trước để lại.
 *
 * Test CHỈ ĐỌC (không tạo/sửa/xóa dữ liệu) - chạy trên tài khoản GV production thật
 * (`TEACHER_PORTAL_ENV`), nhắm đúng lớp chỉ định sẵn cho Báo cáo học tập
 * (`7QA-Test-20260909_085649`, xem ghi chú đầu file spec + `test_data/historical_activity_log.md`
 * protocol `REPORT_TEST_PROFILE`) - KHÔNG tạo thêm lớp/học sinh nào khác.
 */
export default defineConfig({
  testDir: "../flows/web/teacher/testcases",
  testMatch: "**/bao-cao-hoc-tap/**/*.spec.js",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"], ["html", { outputFolder: "output/playwright-report-bao-cao-hoc-tap", open: "never" }]],
  use: {
    headless: process.env.TEACHER_REPORT_HEADLESS !== "false",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
