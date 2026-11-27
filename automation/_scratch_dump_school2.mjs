import { chromium } from "playwright";

const base = "https://parrotedu.vn";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`${base}/teacher/login`, { waitUntil: "networkidle", timeout: 30000 });
await page.locator("input").first().fill("84915981598");
await page.locator("input[type=password]").first().fill("123456789");
await page.getByRole("button", { name: /Đăng nhập/i }).click();
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 });

for (const path of ["/teacher/class/39ec8e44-082e-4636-9bc6-aa9dac4fc832", "/teacher/settings", "/teacher/profile", "/teacher/account"]) {
  try {
    await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1200);
    const text = await page.innerText("body");
    console.log(`=== ${path} ===`);
    console.log(text.slice(0, 1500));
    console.log();
  } catch (e) {
    console.log(`=== ${path} === ERROR: ${e.message}`);
  }
}
await browser.close();
