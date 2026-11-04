import { defineConfig } from "@playwright/test";

/**
 * Config cho Playwright Test - CHỈ dùng bởi các file `*.spec.js` trong
 * `../flows/cms/quan_ly_on_thi/quan_ly_ky_thi/` (test CMS "Quản lý kỳ thi" -
 * `/exam-prep/exam-types` - chạy thật qua `resolveCmsAdminBaseUrl("staging")`, xem
 * `CMS_ADMIN_URL_STAGING`/`CMS_USERNAME_STAGING`/`CMS_PASSWORD_STAGING` trong `.env`. ĐỔI từ "dev"
 * sang "staging" 2026-11-04 theo yêu cầu chạy trên https://cms-staging.parrotedu.vn). Cùng quy ước
 * với `playwright.quan-ly-section.config.js`/`playwright.cau-hinh-bang-diem.config.js`.
 *
 * `workers: 1` + `fullyParallel: false` - mỗi file `.spec.js` dùng `test.describe.serial()` và
 * thao tác trên CÙNG bảng danh sách Kỳ thi (tạo/sửa/xóa dữ liệu test tiền tố `AUTO-`) - chạy song
 * song nhiều file dễ đụng dữ liệu nhau. Chạy:
 * `npx playwright test --config=playwright.quan-ly-ky-thi.config.js` (từ thư mục `automation/`),
 * hoặc `npm run test-quan-ly-ky-thi-pw`.
 *
 * `CMS_ADMIN_SLOWMO` (ms) - làm chậm mọi thao tác Playwright để quan sát bằng mắt khi chạy headed
 * (`CMS_ADMIN_HEADLESS=false`). Cùng quy ước với `playwright.cau-hinh-bang-diem.config.js`.
 */
export default defineConfig({
  testDir: "../flows/cms/quan_ly_on_thi/quan_ly_ky_thi",
  testMatch: "**/*.spec.js",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"], ["html", { outputFolder: "output/playwright-report-quan-ly-ky-thi", open: "never" }]],
  use: {
    headless: process.env.CMS_ADMIN_HEADLESS !== "false",
    launchOptions: {
      slowMo: Number(process.env.CMS_ADMIN_SLOWMO) || 0,
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
