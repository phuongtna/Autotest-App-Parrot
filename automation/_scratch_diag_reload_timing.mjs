import { chromium } from "@playwright/test";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "./src/config.js";
import { cmsDeThiPageObjects as po, gotoDeThi, createExam, readAllExamNamesInOrder, deThiRow, clickAddNew, fillExamName, selectExamType, fillExamDuration, selectGrades, selectScoreTable, clickSave } from "./ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

requireCmsAdminConfig();
const baseUrl = resolveCmsAdminBaseUrl("staging");
const { username, password } = resolveCmsAdminCredentials("staging");
const EXAM = `AUTO-diagtiming-${Date.now().toString(36)}`;
const EXAM_TYPE_FULL = "AUTO-shared-ngan-hang-de-thi-kt-full";
const SCORE_TABLE = "AUTO-shared-ngan-hang-de-thi-bd";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator(po.login.usernameInput).fill(username);
  await page.locator(po.login.passwordInput).fill(password);
  await page.getByRole("button", { name: po.login.submitButton }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

  await gotoDeThi(page, baseUrl);
  const t0 = Date.now();

  await clickAddNew(page);
  await fillExamName(page, EXAM);
  console.log(`Gia tri o Ten de thi NGAY SAU fillExamName: "${await page.locator(po.nameInput).inputValue()}"`);
  await selectExamType(page, EXAM_TYPE_FULL);
  console.log(`Gia tri o Ten de thi NGAY SAU selectExamType: "${await page.locator(po.nameInput).inputValue()}"`);
  await page.waitForTimeout(1000);
  console.log(`Gia tri o Ten de thi SAU 1s CHO THEM: "${await page.locator(po.nameInput).inputValue()}"`);
  await fillExamDuration(page, 25);
  await selectGrades(page, ["Lớp 1"]);
  await selectScoreTable(page, SCORE_TABLE);
  console.log(`Gia tri o Ten de thi TRUOC KHI Luu: "${await page.locator(po.nameInput).inputValue()}"`);
  await clickSave(page);

  console.log(`createExam() xong sau ${Date.now() - t0}ms, URL hien tai: ${page.url()}`);
  await page.waitForTimeout(1000);
  const bodyText = await page.locator("body").innerText().catch((e) => `LOI doc body: ${e.message}`);
  console.log(`--- TOAN BO TEXT TRANG SAU KHI LUU ---\n${bodyText}\n--- HET ---`);

  // 1) KHONG reload - kiem tra ngay tren page hien tai (sau khi Luu, app co tu dieu huong ve list khong)
  const namesNoReload = await readAllExamNamesInOrder(page).catch((e) => [`LOI: ${e.message}`]);
  console.log(`[KHONG reload] co trong list ngay sau Luu? ${namesNoReload.includes(EXAM)} - URL: ${page.url()}`);

  // 2) Reload cung URL (F5), khong di dau khac
  await page.reload({ waitUntil: "networkidle" });
  const namesAfterReload = await readAllExamNamesInOrder(page).catch((e) => [`LOI: ${e.message}`]);
  console.log(`[Sau 1 lan reload F5] co trong list? ${namesAfterReload.includes(EXAM)}`);

  // 3) goto lai tu dau (nhu gotoDeThi tu test) nhieu lan, do thoi gian
  for (let i = 1; i <= 8; i += 1) {
    const tStart = Date.now();
    await gotoDeThi(page, baseUrl);
    const names = await readAllExamNamesInOrder(page).catch((e) => [`LOI: ${e.message}`]);
    const found = names.includes(EXAM);
    console.log(`  goto lan ${i} (t+${Date.now() - t0}ms tu luc tao) -> found=${found}, mat ${Date.now() - tStart}ms de doc list, tong dong: ${names.length}`);
    if (found) break;
    await page.waitForTimeout(1500);
  }
} catch (err) {
  console.error("Loi:", err);
} finally {
  await context.close();
  await browser.close();
}
