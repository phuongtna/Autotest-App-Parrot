import { defineConfig } from "@playwright/test";

/**
 * Config cho Playwright Test - CHỈ dùng bởi các file `*.spec.js` trong
 * `../flows/cms/quan_ly_on_thi/ngan_hang_de_thi/` (test CMS "Ngân hàng đề thi" -
 * `/exam-prep/papers` - chạy thật qua `resolveCmsAdminBaseUrl("dev")`, xem
 * `CMS_ADMIN_URL_DEV`/`CMS_USERNAME_DEV`/`CMS_PASSWORD_DEV` trong `.env`). Cùng quy ước với
 * `playwright.quan-ly-ky-thi.config.js`/`playwright.quan-ly-section.config.js`/
 * `playwright.cau-hinh-bang-diem.config.js`.
 *
 * `workers: 1` + `fullyParallel: false` - mỗi file `.spec.js` dùng `test.describe.serial()` và
 * nhiều file CÙNG dùng chung 1 bộ fixture Kỳ thi/Section/Bảng điểm (tiền tố `AUTO-<runId>-`) dựng
 * riêng cho Đề thi - chạy song song nhiều file dễ đụng dữ liệu nhau. Chạy:
 * `npx playwright test --config=playwright.ngan-hang-de-thi.config.js` (từ thư mục `automation/`),
 * hoặc `npm run test-ngan-hang-de-thi-pw`.
 */
export default defineConfig({
  testDir: "../flows/cms/quan_ly_on_thi/ngan_hang_de_thi",
  testMatch: "**/*.spec.js",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [["list"], ["html", { outputFolder: "output/playwright-report-ngan-hang-de-thi", open: "never" }]],
  use: {
    headless: process.env.CMS_ADMIN_HEADLESS !== "false",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
