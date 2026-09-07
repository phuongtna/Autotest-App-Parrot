import { chromium } from "playwright";
import { config, resolveCmsAdminBaseUrl, requireCmsAdminConfig } from "../../src/config.js";
import { cmsAdminPageObjects as po } from "./cmsAdminPageObjects.js";

export class CmsAdminAuthError extends Error {}

/**
 * Đăng nhập THẬT qua form UI web CMS Quản lý (Naive UI/Nuxt, KHÔNG có <form> chuẩn - input tìm
 * theo placeholder) - cùng cách làm với `giao_bai_tap/navigation/teacherPortalSession.js`
 * (Playwright, KHÔNG phải Maestro). ĐÃ XÁC NHẬN THẬT (2026-09-07, môi trường staging): sau khi
 * bấm "Đăng nhập", app gọi POST /api/cms/login rồi tự điều hướng bằng client-side routing (Nuxt) -
 * KHÔNG có full page navigation, nên phải `waitForURL` (không phải `waitForLoadState`) để bắt
 * đúng thời điểm rời khỏi `/login`.
 *
 * `envOverride`: "dev" | "staging" | "production" - ép 1 môi trường cụ thể bất kể CMS_ADMIN_ENV
 * trong .env (dùng bởi cli.js khi nhận tham số --env=...).
 */
export async function loginCmsAdmin({ headless = true, envOverride } = {}) {
  requireCmsAdminConfig();
  const baseUrl = resolveCmsAdminBaseUrl(envOverride);

  const browser = await chromium.launch({ headless });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30000 });

    await page.locator(po.login.usernameInput).fill(config.cmsUsername);
    await page.locator(po.login.passwordInput).fill(config.cmsPassword);
    await page.getByRole("button", { name: po.login.submitButton }).click();

    const stillOnLoginPage = await page
      .waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 })
      .then(() => false)
      .catch(() => true);
    if (stillOnLoginPage) {
      throw new CmsAdminAuthError(
        `Đăng nhập CMS Admin thất bại tại ${baseUrl} - vẫn ở trang /login sau khi bấm "Đăng nhập". ` +
          `Kiểm tra lại CMS_USERNAME/CMS_PASSWORD hoặc selector form login (xem cmsAdminPageObjects.js).`,
      );
    }

    return { browser, context, page, baseUrl };
  } catch (err) {
    // Cùng lý do với teacherPortalSession.js: nếu throw ở trên, browser vừa launch() sẽ treo vĩnh
    // viễn nếu không đóng ngay tại đây (caller chưa nhận được biến `browser`).
    await browser.close().catch(() => {});
    throw err;
  }
}
