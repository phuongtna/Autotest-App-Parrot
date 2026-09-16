import { defineConfig } from "@playwright/test";

/**
 * Config RIÊNG, CHỦ ĐỘNG, cho DUY NHẤT `delete-source-regression.spec.js` (TC033) - tách khỏi
 * `playwright.kho-bai-tap-ca-nhan.config.js` (test đó bị loại khỏi config kia qua `testIgnore`)
 * vì Playwright ÁP DỤNG `testIgnore`/`testMatch` TRƯỚC khi lọc theo tên file truyền qua CLI - nên
 * không thể "chạy riêng" 1 file đã bị `testIgnore` bằng cách truyền tên file, BẮT BUỘC phải có
 * config khác trỏ đúng test này.
 *
 * *** TEST NÀY XÓA THẬT 1 item trong Kho bài tập cá nhân - CHỈ chạy khi chủ động cần re-verify
 * bug TC033 (xem TESTCASES.md), KHÔNG đưa vào bất kỳ script CI/full-suite nào. ***
 *
 * Chạy: `cd automation && npx playwright test --config=playwright.kho-bai-tap-ca-nhan-destructive.config.js`
 */
export default defineConfig({
  testDir: "../flows/web/giao_bai_tap/kho_bai_tap_ca_nhan",
  testMatch: "**/delete-source-regression.spec.js",
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
