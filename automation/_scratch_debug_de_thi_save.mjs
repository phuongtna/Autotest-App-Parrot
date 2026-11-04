import { chromium } from "@playwright/test";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials } from "./src/config.js";
import { cmsDeThiPageObjects as po } from "./ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";
import {
  gotoDeThi,
  clickAddNew,
  fillExamName,
  selectExamType,
  fillExamDuration,
  selectGrades,
  addSectionToStructure,
  clickAddPracticeButton,
  readPracticePopupOptionTexts,
  selectPracticeInPopup,
  clickPracticePopupSave,
  selectTrangThai,
  selectScoreTable,
  readSelectedScoreTable,
  readPageBannerTexts,
} from "./ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

const baseUrl = resolveCmsAdminBaseUrl("staging");
const { username, password } = resolveCmsAdminCredentials("staging");

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(20000);

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator(po.login.usernameInput).fill(username);
await page.locator(po.login.passwordInput).fill(password);
await page.getByRole("button", { name: po.login.submitButton }).click();
await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

await gotoDeThi(page, baseUrl);
await clickAddNew(page);
await fillExamName(page, "DEBUG-de-thi-xyz-123");
await selectExamType(page, "Kỳ thi đánh giá năng lực tiếng Anh");
await fillExamDuration(page, 45);
await selectGrades(page, ["Lớp 6"]);
await selectScoreTable(page, "Bảng điểm 1");
console.log("score table selected:", await readSelectedScoreTable(page).catch((e) => "ERR:" + e.message));

await addSectionToStructure(page, "Nghe hiểu hội thoại");
await clickAddPracticeButton(page, "Nghe hiểu hội thoại");
const options = await readPracticePopupOptionTexts(page);
console.log("options:", options.slice(0, 5));
await selectPracticeInPopup(page, options[0].trim());
await clickPracticePopupSave(page);

await selectTrangThai(page, po.completedRadioLabel);

await page.getByRole("button", { name: po.saveButton, exact: true }).click();
await page.waitForTimeout(1500);

console.log("URL after save:", page.url());
console.log("banners:", await readPageBannerTexts(page));
await page.screenshot({ path: "/tmp/debug_de_thi_save.png", fullPage: true });
console.log("screenshot saved to /tmp/debug_de_thi_save.png");

await browser.close();
