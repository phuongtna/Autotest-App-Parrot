import { defineConfig } from "@playwright/test";

/**
 * Config Playwright Test cho `*.spec.js` trong `../flows/web/giao_bai_tap/danh_sach_de_da_giao/`
 * (màn "Danh sách đề luyện tập đã giao" - tab "Giao đề luyện tập", Web GV) - TÁCH KHỎI
 * `playwright.giao-de-luyen-tap.config.js` (màn tạo mới "Giao đề luyện tập" - form assign, module
 * khác) để 2 bộ test độc lập, không lẫn report/output. Cùng tài khoản DEV (xem
 * `resolvePracticeTestDevCredentials()` trong navigation/practiceTestListPageObjects.js) - tính
 * năng CHƯA tồn tại trên production/staging tại thời điểm viết (2026-11-02).
 *
 * `testIgnore: ac-multiclass-delete.spec.js` - case AC-01..05 GHI DỮ LIỆU THẬT (tạo rồi xóa 1 đề
 * luyện tập test) - CHỦ ĐỘNG loại khỏi default testMatch, phải dùng
 * `playwright.danh-sach-de-da-giao-destructive.config.js` để chạy.
 *
 * `workers: 1` + `fullyParallel: false` - mỗi spec dùng 1 phiên đăng nhập dùng chung qua
 * `test.describe.serial()`, nhiều case phụ thuộc trạng thái filter/search của bước trước.
 *
 * Chạy: `cd automation && npx playwright test --config=playwright.danh-sach-de-da-giao.config.js`
 * (hoặc `npm run test-danh-sach-de-da-giao-pw`).
 */
export default defineConfig({
  testDir: "../flows/web/giao_bai_tap/danh_sach_de_da_giao",
  testMatch: "**/*.spec.js",
  testIgnore: ["**/ac-multiclass-delete.spec.js"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [["list"], ["html", { outputFolder: "output/playwright-report-danh-sach-de-da-giao", open: "never" }]],
  use: {
    headless: process.env.ASSIGN_HEADLESS !== "false",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
