import { chromium } from "@playwright/test";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "./src/config.js";
import {
  cmsDeThiPageObjects as po,
  gotoDeThi,
  createExam,
  setupDeThiFixtures,
  teardownDeThiFixtures,
  readAllExamNamesInOrder,
  searchDeThi,
  clearSearch,
} from "./ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

requireCmsAdminConfig();
const baseUrl = resolveCmsAdminBaseUrl("staging");
const { username, password } = resolveCmsAdminCredentials("staging");
const runId = `AUTO-diag${Date.now().toString(36)}`;
const EXAM = `${runId}-diag`;

const browser = await chromium.launch({ headless: false, channel: "chrome", slowMo: 0 });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator(po.login.usernameInput).fill(username);
  await page.locator(po.login.passwordInput).fill(password);
  await page.getByRole("button", { name: po.login.submitButton }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

  console.log("Dung fixtures...");
  const fixtures = await setupDeThiFixtures(page, baseUrl, runId);

  await gotoDeThi(page, baseUrl);
  const t0 = Date.now();
  await createExam(page, { name: EXAM, examType: fixtures.examTypeEmpty, grades: ["Lớp 1"] });
  console.log(`createExam() xong sau ${Date.now() - t0}ms`);

  // 1) Check ngay trong list KHONG search (reload list)
  await gotoDeThi(page, baseUrl);
  const namesUnfiltered = await readAllExamNamesInOrder(page);
  console.log(`[Khong search] co trong list mac dinh (page 1)? ${namesUnfiltered.includes(EXAM)} - tong ${namesUnfiltered.length} dong, top5: ${JSON.stringify(namesUnfiltered.slice(0, 5))}`);

  // 2) Thu search ngay, neu khong thay thi retry voi khoang nghi tang dan, do thoi gian
  let found = false;
  let elapsedToFound = null;
  const tSearchStart = Date.now();
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    await searchDeThi(page, runId);
    const names = await readAllExamNamesInOrder(page);
    found = names.includes(EXAM);
    console.log(`  search attempt #${attempt} (t+${Date.now() - tSearchStart}ms) -> found=${found}, ket qua tra ve: ${JSON.stringify(names)}`);
    if (found) {
      elapsedToFound = Date.now() - tSearchStart;
      break;
    }
    await clearSearch(page);
    await page.waitForTimeout(1000);
  }
  console.log(`=> KET LUAN: search ${found ? `tim thay sau ${elapsedToFound}ms` : "KHONG BAO GIO tim thay sau 10 lan thu (~10s+)"}`);

  await teardownDeThiFixtures(page, baseUrl, fixtures, [EXAM]);
} catch (err) {
  console.error("Loi:", err);
} finally {
  await context.close();
  await browser.close();
}
