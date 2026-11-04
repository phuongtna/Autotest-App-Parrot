import { chromium } from "@playwright/test";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "./src/config.js";
import { cmsDeThiPageObjects as po, gotoDeThi, setupDeThiFixtures, clickAddNew, fillExamName, selectExamType, fillExamDuration } from "./ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

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
  const fixtures = await setupDeThiFixtures(page, baseUrl, "diagmax");
  await gotoDeThi(page, baseUrl);
  await clickAddNew(page);
  await fillExamName(page, "AUTO-diagmax-test");
  await selectExamType(page, fixtures.examTypeEmpty);
  for (const v of [600, 601, 650, 500]) {
    await fillExamDuration(page, v);
    console.log(`fillExamDuration(${v}) -> field = "${await page.locator(po.durationInput).inputValue()}"`);
  }
} catch (err) {
  console.error("Loi:", err);
} finally {
  await context.close();
  await browser.close();
}
