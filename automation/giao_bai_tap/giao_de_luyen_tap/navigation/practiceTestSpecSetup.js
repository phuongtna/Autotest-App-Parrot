import { teacherPortalPageObjects as po } from "../../navigation/teacherPortalPageObjects.js";
import { resolvePracticeTestDevCredentials } from "./practiceTestListPageObjects.js";

/**
 * Đăng nhập THẬT qua form UI (giống hệt cơ chế đã xác nhận ở
 * flows/web/giao_bai_tap/kho_bai_tap_ca_nhan/source-selector.spec.js#beforeAll) - dùng TRỰC TIẾP
 * `browser` fixture của Playwright Test (KHÔNG dùng `loginTeacherPortal()` ở
 * automation/giao_bai_tap/navigation/teacherPortalSession.js - hàm đó tự `chromium.launch()` riêng,
 * không gắn được vào fixture/trace/screenshot của Playwright Test). Luôn dùng tài khoản DEV CỐ
 * ĐỊNH qua `resolvePracticeTestDevCredentials()` (xem docblock navigation/practiceTestListPageObjects.js)
 * - KHÔNG dùng TEACHER_PORTAL_ENV/TEACHER_USERNAME mặc định (đó là production, không có tính năng
 * này tại thời điểm viết).
 *
 * @param {import('@playwright/test').Browser} browser
 * @returns {Promise<{context: import('@playwright/test').BrowserContext, page: import('@playwright/test').Page}>}
 */
export async function loginForPracticeTestSpec(browser) {
  const { baseUrl, username, password } = resolvePracticeTestDevCredentials();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${baseUrl}${po.login.path}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.locator(po.login.usernameInput).first().fill(username);
  await page.locator(po.login.passwordInput).first().fill(password);
  await page.getByRole("button", { name: po.login.submitButton }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });

  return { context, page };
}
