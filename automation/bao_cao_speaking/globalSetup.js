import { chromium } from "playwright";
import { loginSpeakingReportPortalOnPage } from "./navigation/speakingReportSession.js";
import { config } from "../src/config.js";
import { STORAGE_STATE_PATH } from "./storageStatePath.js";

/**
 * `globalSetup` của Playwright Test (đăng ký trong playwright.speaking-report.config.js) - đăng
 * nhập ĐÚNG 1 LẦN trước khi chạy toàn bộ file test, lưu session (cookie better-auth) ra
 * `STORAGE_STATE_PATH`, mọi `*.spec.js` dùng lại qua `use.storageState` trong config - KHÔNG mỗi
 * test tự đăng nhập lại qua form.
 *
 * SỬA (2026-09-11, FAIL thật xác nhận qua chạy live nhiều lần Nhóm A): mỗi test tự
 * `loginSpeakingReportPortalOnPage(page)` riêng khiến tổng số lần đăng nhập trong 1 lần chạy suite
 * lên tới hàng chục lượt (nhiều spec file x nhiều test/file) - host Dev bắt đầu FAIL ngẫu nhiên
 * ("vẫn ở /teacher/login sau khi bấm Đăng nhập") dù tài khoản/mật khẩu đúng (xác nhận login đơn
 * lẻ vẫn luôn thành công ngay sau đó) - nghi do rate-limit/anti-automation phía server khi đăng
 * nhập dồn dập. Giảm xuống còn 1 lần/lần chạy suite giải quyết tận gốc, không phải patch retry.
 */
export default async function globalSetup() {
  if (!config.teacherUsernameSpeakingReport || !config.teacherPasswordSpeakingReport) {
    // Không throw - để từng spec file tự `test.skip()` với thông báo rõ ràng như đã làm, tránh
    // toàn bộ suite chết cứng ngay từ globalSetup chỉ vì thiếu .env khi user chỉ muốn chạy 1 phần.
    return;
  }
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginSpeakingReportPortalOnPage(page);
  await context.storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
}
