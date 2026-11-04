import { chromium } from "@playwright/test";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "./src/config.js";
import {
  cmsDeThiPageObjects as po,
  gotoDeThi,
  createExam,
  setupDeThiFixtures,
  openEditDeThi,
  fillSectionDurationInStructure,
  readSectionDurationInStructure,
  readAllExamNamesInOrder,
  clickSave,
} from "./ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

requireCmsAdminConfig();
const baseUrl = resolveCmsAdminBaseUrl("staging");
const { username, password } = resolveCmsAdminCredentials("staging");
const EXAM = `AUTO-diagresave-${Date.now().toString(36)}`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator(po.login.usernameInput).fill(username);
  await page.locator(po.login.passwordInput).fill(password);
  await page.getByRole("button", { name: po.login.submitButton }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

  const fixtures = await setupDeThiFixtures(page, baseUrl, "diagresave");
  console.log("Fixtures:", JSON.stringify(fixtures));

  await gotoDeThi(page, baseUrl);
  await createExam(page, { name: EXAM, examType: fixtures.examTypeWithSections, duration: 25, grades: ["Lớp 1"], scoreTable: fixtures.scoreTable });
  console.log(`createExam() xong, URL: ${page.url()}`);

  await gotoDeThi(page, baseUrl);
  const namesAfterCreate = await readAllExamNamesInOrder(page);
  console.log(`Sau create, co trong list? ${namesAfterCreate.includes(EXAM)}`);

  await openEditDeThi(page, EXAM);
  console.log(`Mo Sua thanh cong, URL: ${page.url()}`);

  const durABefore = await readSectionDurationInStructure(page, fixtures.sectionA).catch((e) => `LOI: ${e.message}`);
  const durBBefore = await readSectionDurationInStructure(page, fixtures.sectionB).catch((e) => `LOI: ${e.message}`);
  console.log(`Truoc khi dien lai - sectionA: "${durABefore}", sectionB: "${durBBefore}"`);

  await fillSectionDurationInStructure(page, fixtures.sectionA, 10);
  await fillSectionDurationInStructure(page, fixtures.sectionB, 15);

  const durAAfterFill = await readSectionDurationInStructure(page, fixtures.sectionA).catch((e) => `LOI: ${e.message}`);
  const durBAfterFill = await readSectionDurationInStructure(page, fixtures.sectionB).catch((e) => `LOI: ${e.message}`);
  console.log(`Sau khi dien lai - sectionA: "${durAAfterFill}", sectionB: "${durBAfterFill}"`);

  const bodyBeforeSave = await page.locator("body").innerText().catch((e) => `LOI: ${e.message}`);
  console.log(`--- BODY TRUOC KHI LUU (tim 'Vui long'/'khop') ---`);
  console.log(bodyBeforeSave.split("\n").filter((l) => /Vui lòng|khớp|lỗi|Lỗi/.test(l)).join("\n") || "(khong co dong nao chua tu khoa)");

  const t0 = Date.now();
  await clickSave(page);
  console.log(`clickSave() xong sau ${Date.now() - t0}ms, URL hien tai: ${page.url()}`);

  await page.waitForTimeout(1000);
  const bodyAfterSave = await page.locator("body").innerText().catch((e) => `LOI: ${e.message}`);
  console.log(`--- BODY SAU KHI LUU (tim 'Vui long'/'khop'/'thanh cong') ---`);
  console.log(bodyAfterSave.split("\n").filter((l) => /Vui lòng|khớp|lỗi|Lỗi|thành công/.test(l)).join("\n") || "(khong co dong nao chua tu khoa)");

  for (let i = 1; i <= 6; i += 1) {
    await gotoDeThi(page, baseUrl);
    const names = await readAllExamNamesInOrder(page).catch((e) => [`LOI: ${e.message}`]);
    const found = names.includes(EXAM);
    console.log(`  goto lan ${i} -> found=${found}, tong dong: ${names.length}`);
    if (found) break;
    await page.waitForTimeout(1500);
  }
} catch (err) {
  console.error("Loi:", err);
} finally {
  await context.close();
  await browser.close();
}
