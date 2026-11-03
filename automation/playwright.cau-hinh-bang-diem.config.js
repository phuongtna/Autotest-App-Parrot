import { defineConfig } from "@playwright/test";

/**
 * Config cho Playwright Test - CHỈ dùng bởi các file `*.spec.js` trong
 * `../flows/cms/quan_ly_on_thi/cau_hinh_bang_diem/` (test CMS "Cấu hình bảng điểm" -
 * `/exam-prep/score-tables` - chạy thật qua `resolveCmsAdminBaseUrl("dev")`, xem
 * `CMS_ADMIN_URL_DEV`/`CMS_USERNAME_DEV`/`CMS_PASSWORD_DEV` trong `.env`). Cùng quy ước với
 * `playwright.quan-ly-section.config.js`: test đặt ở `flows/`, `automation/cau_hinh_bang_diem/`
 * chỉ chứa code dùng lại (page objects/session).
 *
 * `workers: 1` + `fullyParallel: false` - mỗi file `.spec.js` dùng `test.describe.serial()` và
 * thao tác trên CÙNG bảng danh sách bảng điểm (tạo/sửa/xóa dữ liệu test tiền tố `AUTO-`) - chạy
 * song song nhiều file dễ đụng dữ liệu nhau. Chạy:
 * `npx playwright test --config=playwright.cau-hinh-bang-diem.config.js` (từ thư mục
 * `automation/`), hoặc `npm run test-cau-hinh-bang-diem-pw`.
 *
 * `CMS_ADMIN_SLOWMO` (ms) - làm chậm mọi thao tác Playwright để quan sát bằng mắt khi chạy headed
 * (`CMS_ADMIN_HEADLESS=false`). Cùng quy ước với `playwright.quan-ly-section.config.js`.
 */
export default defineConfig({
  testDir: "../flows/cms/quan_ly_on_thi/cau_hinh_bang_diem",
  testMatch: "**/*.spec.js",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"], ["html", { outputFolder: "output/playwright-report-cau-hinh-bang-diem", open: "never" }]],
  use: {
    headless: process.env.CMS_ADMIN_HEADLESS !== "false",
    launchOptions: {
      slowMo: Number(process.env.CMS_ADMIN_SLOWMO) || 0,
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
