import { defineConfig } from "@playwright/test";

/**
 * Config RIÊNG, CHỦ ĐỘNG, cho các spec GHI DỮ LIỆU THẬT trên DEV (tạo/sửa/xóa đề luyện tập test,
 * XÓA SẠCH ở `test.afterAll` dù PASS/FAIL giữa chừng) - tách khỏi
 * `playwright.giao-de-luyen-tap.config.js` (bị loại qua `testIgnore`) vì Playwright áp dụng
 * `testIgnore`/`testMatch` TRƯỚC khi lọc theo tên file truyền qua CLI, cùng lý do/cơ chế đã áp dụng
 * cho `playwright.kho-bai-tap-ca-nhan-destructive.config.js`:
 *   - `assign-submit.spec.js` (ASSIGN-SUBMIT-01..06, TESTCASES-giao-de-1.xlsx - màn Giao đề luyện
 *     tập tạo mới)
 *   - `ac-multi-exercise.spec.js` (AC-01..07, TESTCASES-giao-de-1.xlsx)
 *   - `assign-edit.spec.js` (ASSIGN-EDIT-01..08)
 *   - `assign-delete.spec.js` (ASSIGN-DELETE-01..06)
 *
 * LƯU Ý: `ac-multiclass-delete.spec.js` (AC-01..05, màn "Danh sách đề luyện tập đã giao") đã
 * CHUYỂN sang `playwright.danh-sach-de-da-giao-destructive.config.js` (thư mục riêng
 * `danh_sach_de_da_giao/`).
 *
 * *** CÁC TEST NÀY GHI DỮ LIỆU THẬT trên DEV (không phải production) - CHỦ ĐỘNG chạy khi cần
 * re-verify, KHÔNG đưa vào bất kỳ script CI/full-suite nào. ***
 *
 * Chạy: `cd automation && npx playwright test --config=playwright.giao-de-luyen-tap-destructive.config.js`
 * (hoặc `npm run test-giao-de-luyen-tap-destructive-pw`).
 */
export default defineConfig({
  testDir: "../flows/web/giao_bai_tap/giao_de_luyen_tap",
  testMatch: [
    "**/assign-submit.spec.js",
    "**/ac-multi-exercise.spec.js",
    "**/assign-edit.spec.js",
    "**/assign-delete.spec.js",
  ],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 200_000,
  reporter: [["list"], ["html", { outputFolder: "output/playwright-report-giao-de-luyen-tap-destructive", open: "never" }]],
  use: {
    headless: process.env.ASSIGN_HEADLESS !== "false",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
