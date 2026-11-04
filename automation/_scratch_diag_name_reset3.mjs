import { chromium } from "@playwright/test";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "./src/config.js";
import { cmsDeThiPageObjects as po, gotoDeThi, clickAddNew, fillExamName } from "./ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

requireCmsAdminConfig();
const baseUrl = resolveCmsAdminBaseUrl("staging");
const { username, password } = resolveCmsAdminCredentials("staging");
const NAME = `AUTO-diagname3-${Date.now().toString(36)}`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

page.on("framenavigated", (frame) => {
  if (frame === page.mainFrame()) console.log(`[EVENT] framenavigated -> ${frame.url()}`);
});
page.on("console", (msg) => console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`));

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator(po.login.usernameInput).fill(username);
  await page.locator(po.login.passwordInput).fill(password);
  await page.getByRole("button", { name: po.login.submitButton }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

  await gotoDeThi(page, baseUrl);
  await clickAddNew(page);
  console.log(`URL ngay sau clickAddNew: ${page.url()}`);
  await page.locator(po.nameInput).click();
  await page.locator(po.nameInput).pressSequentially(NAME, { delay: 30 });
  console.log(`So luong input khop placeholder NGAY SAU pressSequentially: ${await page.locator(po.nameInput).count()}`);
  console.log(`URL ngay sau pressSequentially: ${page.url()}`);
  console.log(`Gia tri ngay sau pressSequentially (go tung ky tu): "${await page.locator(po.nameInput).inputValue()}"`);

  await page.screenshot({ path: "/tmp/diagname3_t0.png" });

  for (const step of [150, 150, 150, 150]) {
    await page.waitForTimeout(step);
    const count = await page.locator(po.nameInput).count();
    const url = page.url();
    const val = count > 0 ? await page.locator(po.nameInput).first().inputValue().catch((e) => `LOI: ${e.message}`) : "(KHONG CON INPUT NAO KHOP)";
    console.log(`  +${step}ms -> count=${count}, url=${url}, value="${val}"`);
  }
  await page.screenshot({ path: "/tmp/diagname3_t1.png" });

  const html = await page.locator(po.nameInput).first().evaluate((el) => el.outerHTML).catch((e) => `LOI: ${e.message}`);
  console.log(`outerHTML cua input hien tai: ${html}`);
} catch (err) {
  console.error("Loi:", err);
} finally {
  await context.close();
  await browser.close();
}
