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

// Danh sách Kỳ thi
await page.goto(`${baseUrl}/exam-prep/exam-types`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const examTypeRows = await page.locator("table tbody tr").allInnerTexts();
console.log("=== KỲ THI ===");
examTypeRows.forEach((t, i) => console.log(i, JSON.stringify(t.split("\n").filter(Boolean))));

// Danh sách Section
await page.goto(`${baseUrl}/exam-prep/sections`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const sectionRows = await page.locator("table tbody tr").allInnerTexts();
console.log("=== SECTION ===");
sectionRows.forEach((t, i) => console.log(i, JSON.stringify(t.split("\n").filter(Boolean))));

// Danh sách Đề thi hiện có (để tránh trùng tên)
await page.goto(`${baseUrl}/exam-prep/papers`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const examRows = await page.locator("table tbody tr").allInnerTexts();
console.log("=== ĐỀ THI (hiện có) ===");
examRows.forEach((t, i) => console.log(i, JSON.stringify(t.split("\n").filter(Boolean))));

await browser.close();
