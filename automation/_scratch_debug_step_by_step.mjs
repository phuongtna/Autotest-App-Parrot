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
  selectScoreTable,
  addSectionToStructure,
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

async function check(label) {
  const val = await page.locator(po.nameInput).inputValue().catch((e) => "ERR:" + e.message);
  console.log(label, "-> name field value:", JSON.stringify(val));
}

await fillExamName(page, "Đề kiểm tra giữa kỳ 1 - Khối 6");
await check("after fillExamName");

await selectExamType(page, "Kỳ thi đánh giá năng lực tiếng Anh");
await check("after selectExamType");

await fillExamDuration(page, 45);
await check("after fillExamDuration");

await selectGrades(page, ["Lớp 6"]);
await check("after selectGrades");

await selectScoreTable(page, "Bảng điểm 1");
await check("after selectScoreTable");

await addSectionToStructure(page, "Nghe hiểu hội thoại");
await check("after addSectionToStructure");

await browser.close();
