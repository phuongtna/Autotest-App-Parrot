import { chromium } from "playwright";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials } from "../src/config.js";
import { cmsAdminPageObjects as loginPo } from "../quan_ly_goi_dich_vu/navigation/cmsAdminPageObjects.js";
import { gotoScoreTables, searchScoreTables, readAllScoreTableNamesInOrder, deleteScoreTableByName } from "./navigation/cmsScoreTablePageObjects.js";
import { gotoDeThi, searchDeThi, deleteDeThiByName } from "../ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";
import { gotoKyThi, searchKyThi, readAllKyThiNamesInOrder, deleteKyThiByName } from "../quan_ly_ky_thi/navigation/cmsKyThiPageObjects.js";
import { gotoSections, searchSections, readAllSectionNamesInOrder, deleteSectionByName } from "../quan_ly_section/navigation/cmsSectionPageObjects.js";

const prefix = process.argv[2];
if (!prefix) {
  console.error("Dùng: node verify_and_clean.mjs <prefix>");
  process.exit(1);
}

const baseUrl = resolveCmsAdminBaseUrl("staging");
const { username, password } = resolveCmsAdminCredentials("staging");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator(loginPo.login.usernameInput).fill(username);
await page.locator(loginPo.login.passwordInput).fill(password);
await page.getByRole("button", { name: loginPo.login.submitButton }).click();
await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

await gotoDeThi(page, baseUrl);
await searchDeThi(page, prefix);
const examRows = await page.locator("table tbody tr").allInnerTexts();
console.log("DeThi rows:", examRows);
for (const row of examRows) {
  const name = row.split("\t")[1] || row.split("\n")[0];
}
// lấy tên chính xác qua cột thay vì regex thô
const { readAllExamNamesInOrder } = await import("../ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js");
const examNames = (await readAllExamNamesInOrder(page)).filter((n) => n.includes(prefix));
console.log("Đề thi cần xóa:", examNames);
for (const n of examNames) {
  await gotoDeThi(page, baseUrl);
  await deleteDeThiByName(page, n).catch((e) => console.log("del exam err", n, e.message));
}

await gotoScoreTables(page, baseUrl);
await searchScoreTables(page, prefix);
const scoreTableNames = (await readAllScoreTableNamesInOrder(page)).filter((n) => n.includes(prefix));
console.log("Bảng điểm cần xóa:", scoreTableNames);
for (const n of scoreTableNames) {
  await deleteScoreTableByName(page, n).catch((e) => console.log("del scoretable err", n, e.message));
}

await gotoKyThi(page, baseUrl);
await searchKyThi(page, prefix);
const kyThiNames = (await readAllKyThiNamesInOrder(page)).filter((n) => n.includes(prefix));
console.log("Kỳ thi cần xóa:", kyThiNames);
for (const n of kyThiNames) {
  await deleteKyThiByName(page, n).catch((e) => console.log("del kythi err", n, e.message));
}

await gotoSections(page, baseUrl);
await searchSections(page, prefix);
const sectionNames = (await readAllSectionNamesInOrder(page)).filter((n) => n.includes(prefix));
console.log("Section cần xóa:", sectionNames);
for (const n of sectionNames) {
  await deleteSectionByName(page, n).catch((e) => console.log("del section err", n, e.message));
}

console.log("DONE");
await browser.close();
