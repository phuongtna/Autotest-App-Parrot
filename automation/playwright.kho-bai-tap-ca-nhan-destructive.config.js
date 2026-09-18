import { defineConfig } from "@playwright/test";

/**
 * Config RIÊNG, CHỦ ĐỘNG, cho các spec PHÁ HUỶ THẬT (xóa vĩnh viễn item trong Kho bài tập cá nhân)
 * - `delete-source-regression.spec.js` (TC033), `delete-source-while-selected-race.spec.js` (TC026)
 * và `delete-source-multi-room-cascade.spec.js` (case bổ sung, xóa item dùng cho nhiều room) - tách
 * khỏi `playwright.kho-bai-tap-ca-nhan.config.js` (3 file này bị loại khỏi config kia qua
 * `testIgnore`) vì Playwright ÁP DỤNG `testIgnore`/`testMatch` TRƯỚC khi lọc theo tên file truyền
 * qua CLI - nên không thể "chạy riêng" 1 file đã bị `testIgnore` bằng cách truyền tên file, BẮT
 * BUỘC phải có config khác trỏ đúng các test này.
 *
 * *** CÁC TEST NÀY XÓA THẬT 1 item trong Kho bài tập cá nhân - CHỈ chạy khi chủ động cần re-verify
 * TC033/TC026/multi-room-cascade (xem TESTCASES.md), KHÔNG đưa vào bất kỳ script CI/full-suite nào.
 * ***
 *
 * Chạy (thêm tên file vào cuối để chạy riêng 1 trong 3 spec):
 *   cd automation && npx playwright test --config=playwright.kho-bai-tap-ca-nhan-destructive.config.js [delete-source-regression|delete-source-while-selected-race|delete-source-multi-room-cascade]
 */
export default defineConfig({
  testDir: "../flows/web/giao_bai_tap/kho_bai_tap_ca_nhan",
  testMatch: [
    "**/delete-source-regression.spec.js",
    "**/delete-source-while-selected-race.spec.js",
    "**/delete-source-multi-room-cascade.spec.js",
  ],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 200_000,
  reporter: [["list"], ["html", { outputFolder: "output/playwright-report-kho-bai-tap-ca-nhan-destructive", open: "never" }]],
  use: {
    headless: process.env.SOURCE_HEADLESS !== "false",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
