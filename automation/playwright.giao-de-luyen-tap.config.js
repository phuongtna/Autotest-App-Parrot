import { defineConfig } from "@playwright/test";

/**
 * Config Playwright Test cho `*.spec.js` trong `../flows/web/giao_bai_tap/giao_de_luyen_tap/`
 * (tab mới "Giao đề luyện tập", Web GV) - TÁCH KHỎI `playwright.config.js`/
 * `playwright.kho-bai-tap-ca-nhan.config.js` vì chạy trên môi trường/tài khoản KHÁC hẳn: tính năng
 * này CHƯA tồn tại trên production/staging tại thời điểm viết (2026-11-02) - CHỈ xác nhận có trên
 * DEV (`https://parrotedu.codeinet.com`, tài khoản GV "Phương" SĐT 0915315315, ĐÃ CÓ SẴN trong
 * `.env` là `TEACHER_USERNAME_SPEAKING_REPORT`/`TEACHER_PASSWORD_SPEAKING_REPORT` - các spec dưới
 * đây gọi `resolvePracticeTestDevCredentials()` để lấy lại ĐÚNG cặp tài khoản đó, KHÔNG cần khai
 * báo thêm biến .env mới, KHÔNG dùng `TEACHER_PORTAL_ENV`/`TEACHER_USERNAME` mặc định).
 *
 * LƯU Ý: màn "Danh sách đề luyện tập đã giao" (LIST/SEARCH/FILTER/SORT/TABLE/ACTION/COMBO/EDGE/AC)
 * đã CHUYỂN sang thư mục riêng `../flows/web/giao_bai_tap/danh_sach_de_da_giao/` + config riêng
 * `playwright.danh-sach-de-da-giao(-destructive).config.js` - file này giờ CHỈ còn phục vụ màn tạo
 * mới "Giao đề luyện tập" (form assign).
 *
 * `testIgnore` - các spec GHI DỮ LIỆU THẬT (tạo/sửa/xóa đề luyện tập test trên DEV) - CHỦ ĐỘNG loại
 * khỏi default testMatch (không chỉ dựa vào thiếu ENV để "tự chặn"), phải dùng
 * `playwright.giao-de-luyen-tap-destructive.config.js` để chạy, cùng lý do/cơ chế đã áp dụng cho
 * `kho_bai_tap_ca_nhan`:
 *   - `assign-submit.spec.js` (ASSIGN-SUBMIT-01..06, TESTCASES-giao-de-1.xlsx - màn Giao đề luyện
 *     tập tạo mới)
 *   - `ac-multi-exercise.spec.js` (AC-01..07, TESTCASES-giao-de-1.xlsx)
 *   - `assign-edit.spec.js` (ASSIGN-EDIT-01..08)
 *   - `assign-delete.spec.js` (ASSIGN-DELETE-01..06)
 *
 * `workers: 1` + `fullyParallel: false` - mỗi spec dùng 1 phiên đăng nhập dùng chung qua
 * `test.describe.serial()`, nhiều case trong cùng file phụ thuộc trạng thái bước trước (filter/
 * search đang áp dụng) - không chạy song song được. Chạy song song NHIỀU FILE cũng rủi ro vì tài
 * khoản DEV dùng chung với các module khác (bao_cao_speaking, kho_bai_tap_ca_nhan) đang active.
 *
 * Chạy: `cd automation && npx playwright test --config=playwright.giao-de-luyen-tap.config.js`
 * (hoặc `npm run test-giao-de-luyen-tap-pw`).
 */
export default defineConfig({
  testDir: "../flows/web/giao_bai_tap/giao_de_luyen_tap",
  testMatch: "**/*.spec.js",
  testIgnore: [
    "**/assign-submit.spec.js",
    "**/ac-multi-exercise.spec.js",
    "**/assign-edit.spec.js",
    "**/assign-delete.spec.js",
  ],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [["list"], ["html", { outputFolder: "output/playwright-report-giao-de-luyen-tap", open: "never" }]],
  use: {
    headless: process.env.ASSIGN_HEADLESS !== "false",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
