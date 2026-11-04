import { chromium } from "@playwright/test";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "./src/config.js";
import {
  cmsDeThiPageObjects as po,
  gotoDeThi,
  setupDeThiFixtures,
  openEditDeThi,
  fillSectionDurationInStructure,
  readSectionDurationInStructure,
  fillExamDuration,
  clickBackIcon,
  isDiscardChangesDialogVisible,
  cancelDiscardChangesDialog,
  clickAddNew,
  fillExamName,
  selectExamType,
  selectGrades,
  selectScoreTable,
  readSelectedScoreTable,
  clickSave,
} from "./ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

requireCmsAdminConfig();
const baseUrl = resolveCmsAdminBaseUrl("staging");
const { username, password } = resolveCmsAdminCredentials("staging");
const EXAM = `AUTO-diagsave03-${Date.now().toString(36)}`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator(po.login.usernameInput).fill(username);
  await page.locator(po.login.passwordInput).fill(password);
  await page.getByRole("button", { name: po.login.submitButton }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

  const fixtures = await setupDeThiFixtures(page, baseUrl, "diagsave03");

  await gotoDeThi(page, baseUrl);
  await clickAddNew(page);
  await fillExamName(page, EXAM);
  await selectExamType(page, fixtures.examTypeWithSections);
  console.log(`Sau selectExamType - duration field: "${await page.locator(po.durationInput).inputValue()}"`);
  const dA = await readSectionDurationInStructure(page, fixtures.sectionA).catch((e) => `LOI: ${e.message}`);
  const dB = await readSectionDurationInStructure(page, fixtures.sectionB).catch((e) => `LOI: ${e.message}`);
  console.log(`Section durations auto-fill sau selectExamType: A="${dA}", B="${dB}"`);
  await fillExamDuration(page, 25);
  await selectGrades(page, ["Lớp 1"]);
  await selectScoreTable(page, fixtures.scoreTable);
  console.log(`Truoc khi Luu - duration field: "${await page.locator(po.durationInput).inputValue()}", scoreTable field: "${await readSelectedScoreTable(page).catch((e) => `LOI: ${e.message}`)}"`);
  await clickSave(page);
  console.log(`clickSave() xong, URL: ${page.url()}`);
  const bodyAfterCreate = await page.locator("body").innerText().catch((e) => `LOI: ${e.message}`);
  console.log(`--- BODY NGAY SAU LUU (tim 'Vui lòng'/'khớp'/'thành công') ---`);
  console.log(bodyAfterCreate.split("\n").filter((l) => /Vui lòng|khớp|thành công/.test(l)).join("\n") || "(khong co dong nao chua tu khoa)");

  await gotoDeThi(page, baseUrl);
  await openEditDeThi(page, EXAM);

  const durA0 = await readSectionDurationInStructure(page, fixtures.sectionA);
  const durB0 = await readSectionDurationInStructure(page, fixtures.sectionB);
  console.log(`Section durations ngay sau khi tao (truoc khi lam gi): A="${durA0}", B="${durB0}"`);
  console.log(`Duration field: "${await page.locator(po.durationInput).inputValue()}"`);

  // Replay dung chuoi SAVE-02 lam truoc do (fillExamDuration 999 -> Quay lai -> discard)
  await fillExamDuration(page, 999);
  console.log(`Sau fillExamDuration(999): duration field = "${await page.locator(po.durationInput).inputValue()}"`);
  const durA1 = await readSectionDurationInStructure(page, fixtures.sectionA);
  const durB1 = await readSectionDurationInStructure(page, fixtures.sectionB);
  console.log(`Section durations sau fillExamDuration(999): A="${durA1}", B="${durB1}"`);

  await clickBackIcon(page);
  console.log(`isDiscardChangesDialogVisible: ${await isDiscardChangesDialogVisible(page)}`);
  const { confirmDiscardChanges } = await import("./ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js");
  await confirmDiscardChanges(page);
  console.log(`Sau confirmDiscardChanges, URL: ${page.url()}`);

  await openEditDeThi(page, EXAM);
  console.log(`Mo lai Sua - duration field = "${await page.locator(po.durationInput).inputValue()}"`);
  const durA2 = await readSectionDurationInStructure(page, fixtures.sectionA);
  const durB2 = await readSectionDurationInStructure(page, fixtures.sectionB);
  console.log(`Section durations sau khi mo lai: A="${durA2}", B="${durB2}"`);

  // Gio lam dung step SAVE-03
  await fillExamDuration(page, 888);
  console.log(`Sau fillExamDuration(888): duration field = "${await page.locator(po.durationInput).inputValue()}"`);
  const durA3 = await readSectionDurationInStructure(page, fixtures.sectionA);
  const durB3 = await readSectionDurationInStructure(page, fixtures.sectionB);
  console.log(`Section durations ngay sau khi go 888: A="${durA3}", B="${durB3}"`);

  const bodyNow = await page.locator("body").innerText().catch((e) => `LOI: ${e.message}`);
  console.log(`--- BODY (tim 'Vui lòng'/'khớp'/'tối đa'/'vượt') ---`);
  console.log(bodyNow.split("\n").filter((l) => /Vui lòng|khớp|tối đa|vượt|quá/.test(l)).join("\n") || "(khong co dong nao chua tu khoa)");

  await page.waitForTimeout(500);
  console.log(`Sau 500ms cho them - duration field = "${await page.locator(po.durationInput).inputValue()}"`);

  await clickBackIcon(page);
  console.log(`isDiscardChangesDialogVisible: ${await isDiscardChangesDialogVisible(page)}`);
  await cancelDiscardChangesDialog(page);
  console.log(`Sau cancelDiscardChangesDialog - duration field = "${await page.locator(po.durationInput).inputValue()}"`);
} catch (err) {
  console.error("Loi:", err);
} finally {
  await context.close();
  await browser.close();
}
