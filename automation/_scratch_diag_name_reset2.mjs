import { chromium } from "@playwright/test";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "./src/config.js";
import { cmsDeThiPageObjects as po, gotoDeThi, clickAddNew, fillExamName, setupDeThiFixtures, selectExamType } from "./ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

requireCmsAdminConfig();
const baseUrl = resolveCmsAdminBaseUrl("staging");
const { username, password } = resolveCmsAdminCredentials("staging");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator(po.login.usernameInput).fill(username);
  await page.locator(po.login.passwordInput).fill(password);
  await page.getByRole("button", { name: po.login.submitButton }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  const fixtures = await setupDeThiFixtures(page, baseUrl, "diagname2");

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const NAME = `AUTO-diagname2-${attempt}-${Date.now().toString(36)}`;
    await gotoDeThi(page, baseUrl);
    await clickAddNew(page);
    await fillExamName(page, NAME);
    console.log(`[lan ${attempt}] ngay sau fillExamName: "${await page.locator(po.nameInput).inputValue()}"`);
    // Lam ngay buoc tiep theo nhu createExam() that, KHONG dung yen cho
    await selectExamType(page, fixtures.examTypeEmpty);
    console.log(`[lan ${attempt}] ngay sau selectExamType: "${await page.locator(po.nameInput).inputValue()}"`);
    await page.waitForTimeout(1000);
    console.log(`[lan ${attempt}] sau 1s cho them: "${await page.locator(po.nameInput).inputValue()}"`);
  }
} catch (err) {
  console.error("Loi:", err);
} finally {
  await context.close();
  await browser.close();
}
