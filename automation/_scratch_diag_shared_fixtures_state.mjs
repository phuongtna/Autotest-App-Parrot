import { chromium } from "@playwright/test";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "./src/config.js";
import { cmsDeThiPageObjects as po, gotoDeThi, clickAddNew, fillExamName, selectExamType, fillExamDuration, selectGrades, readSelectedScoreTable, readStructureSectionNamesInOrder } from "./ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";
import { gotoKyThi, kyThiRow, searchKyThi, openEditKyThiPopup } from "./quan_ly_ky_thi/navigation/cmsKyThiPageObjects.js";
import { gotoSections, sectionRow, searchSections } from "./quan_ly_section/navigation/cmsSectionPageObjects.js";
import { gotoScoreTables, scoreTableRow, searchScoreTables } from "./cau_hinh_bang_diem/navigation/cmsScoreTablePageObjects.js";

requireCmsAdminConfig();
const baseUrl = resolveCmsAdminBaseUrl("staging");
const { username, password } = resolveCmsAdminCredentials("staging");

const SECTION_A = "AUTO-shared-ngan-hang-de-thi-secA";
const SECTION_B = "AUTO-shared-ngan-hang-de-thi-secB";
const SCORE_TABLE = "AUTO-shared-ngan-hang-de-thi-bd";
const EXAM_TYPE_FULL = "AUTO-shared-ngan-hang-de-thi-kt-full";
const EXAM_TYPE_EMPTY = "AUTO-shared-ngan-hang-de-thi-kt-empty";

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
  console.log(`Section A ton tai: ${(await sectionRow(page, SECTION_A).count()) > 0}`);
  await searchSections(page, SECTION_B);
  console.log(`Section B ton tai: ${(await sectionRow(page, SECTION_B).count()) > 0}`);

  await gotoScoreTables(page, baseUrl);
  await searchScoreTables(page, SCORE_TABLE);
  console.log(`Score table ton tai: ${(await scoreTableRow(page, SCORE_TABLE).count()) > 0}`);

  await gotoKyThi(page, baseUrl);
  await searchKyThi(page, EXAM_TYPE_EMPTY);
  console.log(`Exam type EMPTY ton tai: ${(await kyThiRow(page, EXAM_TYPE_EMPTY).count()) > 0}`);

  await gotoKyThi(page, baseUrl);
  await searchKyThi(page, EXAM_TYPE_FULL);
  const fullExists = (await kyThiRow(page, EXAM_TYPE_FULL).count()) > 0;
  console.log(`Exam type FULL ton tai: ${fullExists}`);
  if (fullExists) {
    await openEditKyThiPopup(page, EXAM_TYPE_FULL);
    const bodyText = await page.getByRole("dialog").innerText();
    console.log(`--- Noi dung popup Sua Ky thi FULL ---\n${bodyText}\n--- het ---`);
    await page.keyboard.press("Escape").catch(() => {});
  }

  // Thu tao 1 de thi bang EXAM_TYPE_FULL, xem Bang diem co tu fill khong
  await gotoDeThi(page, baseUrl);
  await clickAddNew(page);
  await selectExamType(page, EXAM_TYPE_FULL);
  await page.waitForTimeout(500);
  const scoreTableFull = await readSelectedScoreTable(page).catch((e) => `LOI: ${e.message}`);
  console.log(`Bang diem tu fill khi chon EXAM_TYPE_FULL: "${scoreTableFull}"`);
  const structFull = await readStructureSectionNamesInOrder(page).catch((e) => [`LOI: ${e.message}`]);
  console.log(`Cau truc de (section) khi chon EXAM_TYPE_FULL: ${JSON.stringify(structFull)}`);

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await gotoDeThi(page, baseUrl);
  await clickAddNew(page);
  await selectExamType(page, EXAM_TYPE_EMPTY);
  await page.waitForTimeout(500);
  const scoreTableEmpty = await readSelectedScoreTable(page).catch((e) => `LOI: ${e.message}`);
  console.log(`Bang diem tu fill khi chon EXAM_TYPE_EMPTY: "${scoreTableEmpty}"`);
} catch (err) {
  console.error("Loi:", err);
} finally {
  await context.close();
  await browser.close();
}
