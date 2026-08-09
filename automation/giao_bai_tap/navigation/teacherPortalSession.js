import { chromium } from "playwright";
import { config } from "../../src/config.js";
import { teacherPortalPageObjects as po } from "./teacherPortalPageObjects.js";

export class TeacherPortalAuthError extends Error {}

/**
 * Đăng nhập THẬT qua form UI web GV (KHÔNG dùng TEACHER_ACCESS_TOKEN/localStorage injection
 * như examSession.js làm cho Exam Editor) - token lấy qua get_teacher_token.sh đã xác nhận
 * dùng được cho API (GET /api/user/exams/room.json), CHƯA có bằng chứng web SPA
 * (parrotedu.vn/teacher) đọc token đó từ đâu để coi là "đã đăng nhập". Đăng nhập qua form là
 * cách DUY NHẤT đã biết chắc chắn đúng - đúng thao tác tay ở bước 1, TC1.
 */
export async function loginTeacherPortal({ headless = true } = {}) {
  if (!config.teacherUsername || !config.teacherPassword) {
    throw new TeacherPortalAuthError(
      "Thiếu TEACHER_USERNAME/TEACHER_PASSWORD trong .env (xem automation/README.md).",
    );
  }

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${config.teacherPortalBaseUrl}${po.login.path}`, {
    waitUntil: "networkidle",
    timeout: 30000,
  });

  await page.locator(po.login.usernameInput).first().fill(config.teacherUsername);
  await page.locator(po.login.passwordInput).first().fill(config.teacherPassword);
  await page.getByRole("button", { name: po.login.submitButton }).click();

  const stillOnLoginPage = await page
    .waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 })
    .then(() => false)
    .catch(() => true);
  if (stillOnLoginPage) {
    throw new TeacherPortalAuthError(
      "Đăng nhập GV thất bại - vẫn ở trang /teacher/login sau khi bấm 'Đăng nhập'. Kiểm tra lại " +
        "TEACHER_USERNAME/TEACHER_PASSWORD hoặc selector form login (xem teacherPortalPageObjects.js).",
    );
  }

  return { browser, context, page };
}
