import { chromium } from "playwright";

const base = "https://parrotedu.vn";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`${base}/teacher/login`, { waitUntil: "networkidle", timeout: 30000 });
await page.locator("input").first().fill("84915981598");
await page.locator("input[type=password]").first().fill("123456789");
await page.getByRole("button", { name: /Đăng nhập/i }).click();
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 });
await page.goto(`${base}/teacher/class`, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(1500);
const text = await page.innerText("body");
console.log(text.slice(0, 2500));
await browser.close();
