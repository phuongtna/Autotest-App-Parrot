import { chromium } from "@playwright/test";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "./src/config.js";
import { cmsDeThiPageObjects as po, gotoDeThi, clickAddNew, fillExamName } from "./ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

requireCmsAdminConfig();
const baseUrl = resolveCmsAdminBaseUrl("staging");
const { username, password } = resolveCmsAdminCredentials("staging");
const NAME = `AUTO-diagnamereset-${Date.now().toString(36)}`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator(po.login.usernameInput).fill(username);
  await page.locator(po.login.passwordInput).fill(password);
  await page.getByRole("button", { name: po.login.submitButton }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await gotoDeThi(page, baseUrl);
    const t0 = Date.now();
    await clickAddNew(page);
    console.log(`[lan ${attempt}] clickAddNew() xong sau ${Date.now() - t0}ms`);
    await fillExamName(page, NAME);
    const v0 = await page.locator(po.nameInput).inputValue();
    console.log(`[lan ${attempt}] ngay sau fillExamName: "${v0}"`);
    const steps = [100, 200, 300, 400, 1000];
    let elapsed = 0;
    for (const step of steps) {
      await page.waitForTimeout(step);
      elapsed += step;
      const v = await page.locator(po.nameInput).inputValue();
      console.log(`[lan ${attempt}] sau cong don ${elapsed}ms: "${v}"`);
    }
  }
} catch (err) {
  console.error("Loi:", err);
} finally {
  await context.close();
  await browser.close();
}
