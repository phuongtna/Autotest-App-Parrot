import { chromium } from "playwright";

const base = "https://parrotedu.vn";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`${base}/teacher/login`, { waitUntil: "networkidle", timeout: 30000 });
await page.locator("input").first().fill("84915981598");
await page.locator("input[type=password]").first().fill("123456789");
await page.getByRole("button", { name: /Đăng nhập/i }).click();
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 });
await page.goto(`${base}/teacher/profile`, { waitUntil: "networkidle", timeout: 20000 });
await page.waitForTimeout(1500);
const inputs = await page.$$eval("input", els => els.map(e => ({ name: e.name, value: e.value, placeholder: e.placeholder })));
console.log("INPUTS:", JSON.stringify(inputs, null, 2));
