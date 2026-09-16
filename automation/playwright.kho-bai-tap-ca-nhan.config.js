import { defineConfig } from "@playwright/test";

/**
 * Config Playwright Test riêng cho `*.spec.js` trong
 * `../flows/web/giao_bai_tap/kho_bai_tap_ca_nhan/` (tính năng mới "Kho bài tập cá nhân") - TÁCH
 * KHỎI `playwright.config.js`/`playwright.report.config.js` vì test này chạy trên môi trường/tài
 * khoản KHÁC hẳn (dev `https://parrotedu.codeinet.com`, tài khoản GV dev `0915315315`, KHÔNG phải
 * `TEACHER_PORTAL_ENV`/`TEACHER_USERNAME` production trong `.env`).
 *
 * Chạy: `cd automation && npx playwright test --config=playwright.kho-bai-tap-ca-nhan.config.js`
 * (hoặc `npm run test-kho-bai-tap-ca-nhan-pw`).
 *
 * `workers: 1` + `fullyParallel: false` - các case TC001-008 dùng CHUNG 1 phiên đăng nhập +
 * TRẠNG THÁI FORM qua `test.describe.serial()` (TC003 phụ thuộc lớp đã chọn ở TC001/002, TC007
 * phụ thuộc item đã tick từ bước trước) - không chạy song song được.
 *
 * `testIgnore: delete-source-regression.spec.js` - TC033 XÓA THẬT 1 item trong Kho bài tập cá
 * nhân ("Hành động này không thể hoàn tác"), CHỦ ĐỘNG loại khỏi default testMatch (không chỉ dựa
 * vào việc thiếu ENV để "tự chặn") để không ai vô tình kích hoạt qua lệnh chạy full suite - phải
 * gọi rõ tên file qua CLI để chạy (xem docblock đầu file spec đó).
 */
export default defineConfig({
  testDir: "../flows/web/giao_bai_tap/kho_bai_tap_ca_nhan",
  testMatch: "**/*.spec.js",
  testIgnore: "**/delete-source-regression.spec.js",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"], ["html", { outputFolder: "output/playwright-report-kho-bai-tap-ca-nhan", open: "never" }]],
  use: {
    headless: process.env.SOURCE_HEADLESS !== "false",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
