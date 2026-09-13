import { defineConfig } from "@playwright/test";
import { STORAGE_STATE_PATH } from "./bao_cao_speaking/storageStatePath.js";

/**
 * Config Playwright Test RIÊNG cho automation/bao_cao_speaking/ (báo cáo bài Speaking, web GV) -
 * test thật *.spec.js đặt tại flows/web/teacher/testcases/bao-cao-hoc-tap/ (không phải automation/,
 * cùng quy ước với playwright.config.js của quan_ly_goi_dich_vu). Config riêng (không dùng chung
 * playwright.config.js) vì testDir khác + tài khoản/môi trường khác (Dev, TEACHER_USERNAME_
 * SPEAKING_REPORT) so với goi_dich_vu (CMS Quản lý, staging).
 *
 * `globalSetup` đăng nhập ĐÚNG 1 LẦN, lưu session vào `storageState` cho MỌI test - SỬA
 * (2026-09-11) sau khi mỗi test tự đăng nhập riêng gây FAIL ngẫu nhiên do đăng nhập dồn dập (xem
 * comment chi tiết trong bao_cao_speaking/globalSetup.js).
 *
 * Chạy: cd automation && npx playwright test --config=playwright.speaking-report.config.js
 */
export default defineConfig({
  testDir: "../flows/web/teacher/testcases/bao-cao-hoc-tap",
  testMatch: "**/*.spec.js",
  fullyParallel: false,
  workers: 1,
  // SỬA (2026-09-11) - host Dev đã xác nhận thoáng qua kém ổn định hơn staging/production (login
  // ngẫu nhiên fail dù tài khoản đúng, trang report thi thoảng tải chậm bất thường) - 1 retry cho
  // FAIL môi trường tự phục hồi, không che giấu lỗi logic thật (lỗi logic thật vẫn fail lại y hệt
  // ở lần retry, không đổi hành vi).
  retries: 1,
  timeout: 90_000,
  globalSetup: "./bao_cao_speaking/globalSetup.js",
  reporter: [
    ["list"],
    ["html", { outputFolder: "output/speaking-report-playwright-report", open: "never" }],
  ],
  use: {
    headless: process.env.SPEAKING_REPORT_HEADLESS !== "false",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    storageState: STORAGE_STATE_PATH,
  },
});
