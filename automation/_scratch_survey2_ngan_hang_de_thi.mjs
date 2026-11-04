import { chromium } from "@playwright/test";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials } from "./src/config.js";
import { cmsDeThiPageObjects as po } from "./ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

const baseUrl = resolveCmsAdminBaseUrl("staging");
const { username, password } = resolveCmsAdminCredentials("staging");

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator(po.login.usernameInput).fill(username);
await page.locator(po.login.passwordInput).fill(password);
await page.getByRole("button", { name: po.login.submitButton }).click();
await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

for (const path of ["/exam-prep/exam-types", "/exam-prep/sections", "/exam-prep/papers", "/exam-prep/score-tables"]) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const totalText = await page.locator("text=/Tổng \\d+ bản ghi/").first().innerText().catch(() => "N/A");
  console.log(path, "=>", totalText);
}

await browser.close();
