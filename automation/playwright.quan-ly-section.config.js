import { defineConfig } from "@playwright/test";

/**
 * Config cho Playwright Test - CHỈ dùng bởi các file `*.spec.js` trong
 * `../flows/cms/quan_ly_on_thi/quan_ly_section/` (test CMS "Quản lý Section" -
 * `/exam-prep/sections` - chạy thật qua `resolveCmsAdminBaseUrl("dev")`, xem
 * `CMS_ADMIN_URL_DEV`/`CMS_USERNAME_DEV`/`CMS_PASSWORD_DEV` trong `.env`). Cùng quy ước với
 * `playwright.config.js` (goi_dich_vu): test đặt ở `flows/`, `automation/quan_ly_section/` chỉ
 * chứa code dùng lại (page objects/session).
 *
 * `workers: 1` + `fullyParallel: false` - mỗi file `.spec.js` dùng `test.describe.serial()` và
 * thao tác trên CÙNG bảng danh sách Section (tạo/sửa/xóa dữ liệu test tiền tố `AUTO-`) - chạy song
 * song nhiều file dễ đụng dữ liệu nhau (vd 1 file đang lọc/phân trang trong khi file khác vừa
 * tạo/xóa dòng). Chạy: `npx playwright test --config=playwright.quan-ly-section.config.js` (từ
 * thư mục `automation/`), hoặc `npm run test-quan-ly-section-pw`.
 */
export default defineConfig({
  testDir: "../flows/cms/quan_ly_on_thi/quan_ly_section",
  testMatch: "**/*.spec.js",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"], ["html", { outputFolder: "output/playwright-report-quan-ly-section", open: "never" }]],
  use: {
    headless: process.env.CMS_ADMIN_HEADLESS !== "false",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
