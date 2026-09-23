import { defineConfig } from "@playwright/test";

/**
 * Config Playwright Test riêng cho `*.spec.js` trong
 * `../flows/web/teacher/testcases/them-bai-thuc-hanh/` (tính năng "Thêm bài thực hành" trong
 * Lesson - màn "Kho đề cá nhân" Web GV) - TÁCH KHỎI `playwright.report.config.js` (dùng cho
 * `testcases/bao-cao-hoc-tap/`) để không đổi hành vi/testDir của bộ đó. Chạy:
 * `cd automation && npx playwright test --config=playwright.them-bai-thuc-hanh.config.js` (hoặc
 * `npm run test-them-bai-thuc-hanh-pw`).
 *
 * Chạy trên DEV (`SOURCE_BASE_URL=https://parrotedu.codeinet.com`, tài khoản GV dev
 * `0915315315`), KHÔNG phải `TEACHER_PORTAL_ENV` production trong `.env` - xem docblock đầu mỗi
 * file spec để biết đủ ENV bắt buộc/tuỳ chọn.
 *
 * `workers: 1` + `fullyParallel: false` - mỗi file `.spec.js` dùng 1 phiên đăng nhập GV dùng
 * chung qua `test.describe.serial()`, nhiều test trong cùng file TẠO/XOÁ bài thực hành thật trên
 * CÙNG 1 Lesson cố định (env `PRACTICE_KHOI`/`PRACTICE_UNIT_LABEL`/`PRACTICE_LESSON_WITH_ITEMS`) -
 * chạy song song sẽ đụng độ dữ liệu giữa các file.
 */
export default defineConfig({
  testDir: "../flows/web/teacher/testcases",
  testMatch: "**/them-bai-thuc-hanh/**/*.spec.js",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // 75s (không phải 60s mặc định của các config khác) - TC_TBT_017 cần reload lặp lại (giãn cách
  // 5s/lần) chờ backend lan truyền tên MỚI vào trang edit, đã xác nhận thật có thể mất >20s (xem
  // ghi chú trong 05-quiz-edit-navigation.spec.js).
  timeout: 75_000,
  reporter: [["list"], ["html", { outputFolder: "output/playwright-report-them-bai-thuc-hanh", open: "never" }]],
  use: {
    headless: process.env.THEM_BAI_THUC_HANH_HEADLESS !== "false",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
