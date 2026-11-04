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
  clickSave,
  deThiRow,
  readPageBannerTexts,
} from "./ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";
import { gotoKyThi, createKyThi, kyThiRow, searchKyThi } from "./quan_ly_ky_thi/navigation/cmsKyThiPageObjects.js";
import { gotoSections, createSection, sectionRow, searchSections } from "./quan_ly_section/navigation/cmsSectionPageObjects.js";

const baseUrl = resolveCmsAdminBaseUrl("staging");
const { username, password } = resolveCmsAdminCredentials("staging");

const KY_THI_NAME = "Kỳ thi đánh giá năng lực tiếng Anh";
const SCORE_TABLE_NAME = "Bảng điểm 1";

const SECTIONS = [
  { name: "Nghe hiểu hội thoại", skill: "Nghe" },
  { name: "Đọc hiểu đoạn văn", skill: "Đọc" },
  { name: "Viết đoạn văn ngắn", skill: "Viết" },
  { name: "Nói phản xạ", skill: "Nói" },
  { name: "Đọc hiểu từ vựng", skill: "Đọc" },
];

const PAPERS = [
  { name: "Đề kiểm tra giữa kỳ 1 - Khối 6", duration: 45, grade: "Lớp 6", section: SECTIONS[0].name },
  { name: "Đề kiểm tra cuối kỳ 1 - Khối 7", duration: 60, grade: "Lớp 7", section: SECTIONS[1].name },
  { name: "Đề ôn luyện kỹ năng Viết - Khối 8", duration: 30, grade: "Lớp 8", section: SECTIONS[2].name },
  { name: "Đề ôn luyện kỹ năng Nói - Khối 9", duration: 20, grade: "Lớp 9", section: SECTIONS[3].name },
  { name: "Đề tổng hợp từ vựng - Khối 10", duration: 40, grade: "Lớp 10", section: SECTIONS[4].name },
];

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(20000);

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator(po.login.usernameInput).fill(username);
await page.locator(po.login.passwordInput).fill(password);
await page.getByRole("button", { name: po.login.submitButton }).click();
await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
console.log("Logged in.");

// --- Ensure 1 clean Kỳ thi (no pre-config) to classify all 5 papers under ---
await gotoKyThi(page, baseUrl);
await searchKyThi(page, KY_THI_NAME);
if ((await kyThiRow(page, KY_THI_NAME).count()) === 0) {
  await createKyThi(page, { name: KY_THI_NAME, description: "Kỳ thi chuẩn dùng cho dữ liệu mẫu Ngân hàng đề thi" });
  console.log("Created Kỳ thi:", KY_THI_NAME);
} else {
  console.log("Kỳ thi already exists:", KY_THI_NAME);
}

// --- Ensure 5 distinct standard Sections ---
await gotoSections(page, baseUrl);
for (const s of SECTIONS) {
  await searchSections(page, s.name);
  if ((await sectionRow(page, s.name).count()) === 0) {
    await createSection(page, { name: s.name, skill: s.skill });
    console.log("Created Section:", s.name);
  } else {
    console.log("Section already exists:", s.name);
  }
}

// --- Create 5 papers ---
const usedPracticeNames = new Set();
const results = [];

for (const p of PAPERS) {
  await gotoDeThi(page, baseUrl);

  // Skip if a paper with this exact name already exists (idempotent re-run).
  if ((await deThiRow(page, p.name).count()) > 0) {
    console.log("SKIP (already exists):", p.name);
    results.push({ ...p, status: "already-existed" });
    continue;
  }

  await clickAddNew(page);
  await fillExamName(page, p.name);
  await selectExamType(page, KY_THI_NAME);
  await fillExamDuration(page, p.duration);
  await selectGrades(page, [p.grade]);
  await selectScoreTable(page, SCORE_TABLE_NAME);

  await addSectionToStructure(page, p.section);
  await clickAddPracticeButton(page, p.section);

  const options = await readPracticePopupOptionTexts(page);
  const pick = options.find((t) => t.trim() && !usedPracticeNames.has(t.trim()));
  if (!pick) {
    console.log("WARNING: no unused Bài thực hành found for", p.name, "- options were:", options);
  } else {
    usedPracticeNames.add(pick.trim());
    await selectPracticeInPopup(page, pick.trim());
    await clickPracticePopupSave(page);
    console.log("Attached Bài thực hành:", JSON.stringify(pick.trim()), "->", p.name);
  }

  await selectTrangThai(page, po.completedRadioLabel);
  await clickSave(page);
  await page.waitForURL((url) => /\/exam-prep\/papers$/.test(url.pathname), { timeout: 10000 }).catch(() => {});

  const ok = /\/exam-prep\/papers$/.test(new URL(page.url()).pathname);
  if (!ok) {
    console.log("DEBUG banners:", await readPageBannerTexts(page));
    await page.screenshot({ path: `/tmp/seed_fail_${results.length}.png`, fullPage: true });
  }
  console.log(ok ? "SAVED:" : "SAVE FAILED:", p.name, page.url());
  results.push({ ...p, status: ok ? "created" : "failed", practice: pick });
}

console.log("\n=== SUMMARY ===");
console.table(results);

await browser.close();
