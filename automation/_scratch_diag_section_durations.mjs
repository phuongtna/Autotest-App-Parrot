import { chromium } from "@playwright/test";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "./src/config.js";
import { cmsDeThiPageObjects as po } from "./ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";
import { gotoSections, sectionRow, searchSections } from "./quan_ly_section/navigation/cmsSectionPageObjects.js";

requireCmsAdminConfig();
const baseUrl = resolveCmsAdminBaseUrl("staging");
const { username, password } = resolveCmsAdminCredentials("staging");
const SECTION_A = "AUTO-shared-ngan-hang-de-thi-secA";
const SECTION_B = "AUTO-shared-ngan-hang-de-thi-secB";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator(po.login.usernameInput).fill(username);
  await page.locator(po.login.passwordInput).fill(password);
  await page.getByRole("button", { name: po.login.submitButton }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

  await gotoSections(page, baseUrl);
  await searchSections(page, SECTION_A);
  const rowA = await sectionRow(page, SECTION_A).innerText();
  console.log(`Section A row text: ${JSON.stringify(rowA)}`);

  await searchSections(page, SECTION_B);
  const rowB = await sectionRow(page, SECTION_B).innerText();
  console.log(`Section B row text: ${JSON.stringify(rowB)}`);
} catch (err) {
  console.error("Loi:", err);
} finally {
  await context.close();
  await browser.close();
}
