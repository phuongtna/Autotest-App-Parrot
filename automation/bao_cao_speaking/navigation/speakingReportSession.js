import { config, resolveTeacherPortalBaseUrl } from "../../src/config.js";
import { loginTeacherPortal, TeacherPortalAuthError } from "../../giao_bai_tap/navigation/teacherPortalSession.js";
import { teacherPortalPageObjects as po } from "../../giao_bai_tap/navigation/teacherPortalPageObjects.js";

/**
 * Đăng nhập teacher-portal RIÊNG cho automation/bao_cao_speaking/ - dùng lại loginTeacherPortal()
 * của giao_bai_tap (cùng 1 form login thật, không có form riêng), nhưng ép baseUrl="dev" +
 * tài khoản TEACHER_USERNAME_SPEAKING_REPORT/TEACHER_PASSWORD_SPEAKING_REPORT thay vì
 * config.teacherPortalBaseUrl/teacherUsername mặc định (đang phục vụ GV "Phương"/giao_bai_tap
 * trên production) - 2 bộ test không đụng tài khoản/môi trường của nhau.
 */
export async function loginSpeakingReportPortal({ headless = true } = {}) {
  return loginTeacherPortal({
    headless,
    baseUrl: resolveTeacherPortalBaseUrl("dev"),
    username: config.teacherUsernameSpeakingReport,
    password: config.teacherPasswordSpeakingReport,
  });
}

/**
 * Bản dùng cho Playwright Test (`*.spec.js`, fixture `page` do test runner tự tạo/tự đóng browser)
 * - KHÔNG tự `chromium.launch()` như loginSpeakingReportPortal() ở trên (dành cho script `.mjs`
 * tự quản browser) - nhận `page` có sẵn, chỉ điều hướng + điền form, dùng lại ĐÚNG selector thật
 * của teacherPortalPageObjects.js (login.usernameInput/passwordInput/submitButton).
 */
export async function loginSpeakingReportPortalOnPage(page, { retries = 2 } = {}) {
  const username = config.teacherUsernameSpeakingReport;
  const password = config.teacherPasswordSpeakingReport;
  if (!username || !password) {
    throw new TeacherPortalAuthError(
      "Thiếu TEACHER_USERNAME_SPEAKING_REPORT/TEACHER_PASSWORD_SPEAKING_REPORT trong .env.",
    );
  }
  const baseUrl = resolveTeacherPortalBaseUrl("dev");

  // SỬA (2026-09-11, FAIL thật xác nhận qua chạy live nhiều lần - Nhóm A/C): "networkidle" hay
  // timeout giả (30s) trên host Dev này - có vẻ trang giữ vài kết nối nền (polling/analytics)
  // không bao giờ "idle" thật sự, gây FAIL ngẫu nhiên không liên quan gì tới logic test. Đổi sang
  // "domcontentloaded" (chỉ cần DOM parse xong) + để chính các bước điền form/chờ điều hướng sau
  // đó tự chờ actionability - đáng tin hơn nhiều so với chờ mạng "yên tĩnh" trên trang có kết nối
  // nền liên tục.
  //
  // SỬA THÊM (2026-09-11, FAIL thật xác nhận qua globalSetup - "vẫn ở /teacher/login" dù tài
  // khoản/mật khẩu đúng, retry ngay sau đó luôn thành công): host Dev này thi thoảng FAIL đăng
  // nhập ngẫu nhiên (nghi do bản thân môi trường Dev kém ổn định hơn staging/production, KHÔNG
  // phải do đăng nhập dồn dập - đã giảm xuống 1 lần/suite qua storageState, vẫn còn gặp). Thêm
  // retry vài lần thay vì fail cứng ngay lần đầu - đúng bản chất lỗi môi trường thoáng qua.
  let lastNetworkError = null;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    // SỬA THÊM LẦN 2 (2026-09-11, FAIL thật: `net::ERR_CONNECTION_CLOSED` ngay ở `page.goto` -
    // lỗi mạng cấp thấp, khác hẳn "vẫn ở /teacher/login" sau khi bấm nút) - bản retry trước chỉ
    // bọc `waitForURL` trong try/catch, còn chính `page.goto`/`fill`/`click` NÉM lỗi thẳng ra
    // ngoài vòng lặp, bỏ qua retry. Bọc TOÀN BỘ 1 lượt thử trong try/catch để lỗi mạng cấp thấp
    // (server Dev tạm ngắt kết nối) cũng được retry như lỗi "vẫn ở trang login".
    try {
      await page.goto(`${baseUrl}${po.login.path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.locator(po.login.usernameInput).first().fill(username);
      await page.locator(po.login.passwordInput).first().fill(password);
      await page.getByRole("button", { name: po.login.submitButton }).click();

      const stillOnLoginPage = await page
        .waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 })
        .then(() => false)
        .catch(() => true);
      if (!stillOnLoginPage) return;
    } catch (err) {
      lastNetworkError = err;
    }
    if (attempt <= retries) {
      await page.waitForTimeout(1000);
      continue;
    }
    throw new TeacherPortalAuthError(
      `Đăng nhập GV (Speaking report) thất bại sau ${retries + 1} lần thử - vẫn ở /teacher/login ` +
        `sau khi bấm 'Đăng nhập'${lastNetworkError ? ` (lỗi mạng gần nhất: ${lastNetworkError.message})` : ""}.`,
    );
  }
}

/**
 * Điều hướng `page` (đã có sẵn session qua `storageState`, xem playwright.speaking-report.config.js)
 * tới /teacher/dashboard - BẮT BUỘC gọi trước `gotoAssignedList()`/mọi thao tác cần 1 trang đã tải
 * làm điểm xuất phát.
 *
 * SỬA (2026-09-11, FAIL thật xác nhận qua chạy live): sau khi bỏ `loginSpeakingReportPortalOnPage()`
 * khỏi `beforeEach` (đổi sang dùng chung `storageState`, xem globalSetup.js), `page` của mỗi test
 * bắt đầu ở "about:blank" - KHÔNG có trang nào được tải dù cookie đăng nhập đã có sẵn trong context
 * (storageState chỉ gắn cookie vào context, không tự điều hướng page tới đâu cả). Gọi thẳng
 * `gotoAssignedList(page)` lúc này bấm vào text "Giao bài tập" không tồn tại trên trang trắng, chờ
 * đủ 60s rồi timeout - trông giống lỗi đăng nhập nhưng thực ra là thiếu bước điều hướng ban đầu.
 */
export async function gotoDashboard(page) {
  const baseUrl = resolveTeacherPortalBaseUrl("dev");
  await page.goto(`${baseUrl}/teacher/dashboard`, { waitUntil: "domcontentloaded", timeout: 30000 });
}
