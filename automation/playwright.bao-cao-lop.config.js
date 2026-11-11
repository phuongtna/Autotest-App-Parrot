import { defineConfig } from "@playwright/test";
import { STORAGE_STATE_PATH } from "./bao_cao_speaking/storageStatePath.js";

/**
 * Config Playwright Test cho `flows/web/teacher/testcases/bao-cao-lop/` - PAR-3169 "Ôn thi - Xem
 * báo cáo theo lớp" (tab "Đề luyện tập" của màn /teacher/exercise/{roomId}/report). Màn hình này
 * DÙNG CHUNG component + 3 API report-stats (room-analytic/room-questions-analytic/question-
 * detail-analytic) với automation/bao_cao_speaking/ (đã xác nhận thật qua test tay trên staging
 * 2026-11-05/06: cùng URL, cùng class SVG, cùng cấu trúc card) - nên TÁI DÙNG NGUYÊN globalSetup +
 * storageState + mock route của bao_cao_speaking thay vì viết lại cơ chế đăng nhập/mock riêng.
 * Tách config riêng (không gộp playwright.speaking-report.config.js) vì testDir khác, theo đúng
 * quy ước 1 module = 1 config của dự án.
 *
 * Chạy: cd automation && npx playwright test --config=playwright.bao-cao-lop.config.js
 * (hoặc npm run test-bao-cao-lop-pw).
 */
export default defineConfig({
  testDir: "../flows/web/teacher/testcases/bao-cao-lop",
  testMatch: "**/*.spec.js",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 90_000,
  globalSetup: "./bao_cao_speaking/globalSetup.js",
  reporter: [["list"], ["html", { outputFolder: "output/bao-cao-lop-playwright-report", open: "never" }]],
  use: {
    headless: process.env.BAO_CAO_LOP_HEADLESS !== "false",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    storageState: STORAGE_STATE_PATH,
  },
});
