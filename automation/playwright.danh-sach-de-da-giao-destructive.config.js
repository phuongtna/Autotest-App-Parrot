import { defineConfig } from "@playwright/test";

/**
 * Config RIÊNG, CHỦ ĐỘNG, cho `ac-multiclass-delete.spec.js` (AC-01..05, màn "Danh sách đề luyện
 * tập đã giao") - test này TẠO THẬT 1 đề luyện tập giao cho 2 lớp trên DEV rồi XÓA SẠCH ở cuối (dù
 * PASS/FAIL giữa chừng, xem `test.afterAll` trong spec) - tách khỏi
 * `playwright.danh-sach-de-da-giao.config.js` (bị loại qua `testIgnore`) vì Playwright áp dụng
 * `testIgnore`/`testMatch` TRƯỚC khi lọc theo tên file truyền qua CLI.
 *
 * *** TEST NÀY GHI DỮ LIỆU THẬT trên DEV (không phải production) - CHỦ ĐỘNG chạy khi cần
 * re-verify AC-01..05, KHÔNG đưa vào bất kỳ script CI/full-suite nào. ***
 *
 * Chạy: `cd automation && npx playwright test --config=playwright.danh-sach-de-da-giao-destructive.config.js`
 * (hoặc `npm run test-danh-sach-de-da-giao-destructive-pw`).
 */
export default defineConfig({
  testDir: "../flows/web/giao_bai_tap/danh_sach_de_da_giao",
  testMatch: ["**/ac-multiclass-delete.spec.js"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 200_000,
  reporter: [["list"], ["html", { outputFolder: "output/playwright-report-danh-sach-de-da-giao-destructive", open: "never" }]],
  use: {
    headless: process.env.ASSIGN_HEADLESS !== "false",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
