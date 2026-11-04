import { chromium } from "@playwright/test";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials } from "./src/config.js";
import { cmsDeThiPageObjects as po, gotoDeThi, deleteDeThiByName } from "./ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

const baseUrl = resolveCmsAdminBaseUrl("staging");
const { username, password } = resolveCmsAdminCredentials("staging");
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator(po.login.usernameInput).fill(username);
await page.locator(po.login.passwordInput).fill(password);
await page.getByRole("button", { name: po.login.submitButton }).click();
await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
await gotoDeThi(page, baseUrl);
await deleteDeThiByName(page, "DEBUG-de-thi-xyz-123");
console.log("cleaned up debug entry");
await browser.close();
