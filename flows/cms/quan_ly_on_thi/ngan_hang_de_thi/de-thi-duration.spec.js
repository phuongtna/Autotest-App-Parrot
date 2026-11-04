import { test, expect } from "../../../../automation/ngan_hang_de_thi/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsDeThiPageObjects as po,
  gotoDeThi,
  clickAddNew,
  setupDeThiFixtures,
  teardownDeThiFixtures,
  fillExamName,
  selectExamType,
  fillExamDuration,
  selectGrades,
  selectScoreTable,
  fillSectionDurationInStructure,
  clearSectionDurationInStructure,
  clickSave,
} from "../../../../automation/ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

/**
 * Nhóm "4. Quy tắc Thời lượng đề & Section" (DURATION-01..06) - xem ghi chú chung tại
 * `de-thi-list.spec.js`.
 *
 * DURATION-05/06 ("[App-side, Exploratory]" theo đúng nhãn trong `TESTCASES.xlsx`) CHỦ ĐỘNG BỎ QUA
 * - cần user thật làm bài trên app di động, hoàn toàn ngoài phạm vi automation CMS web admin -
 * cùng tinh thần "case liên quan app học sinh chưa viết vội" đã thống nhất.
 *
 * Rule thời lượng (DURATION-01..03) ĐÃ XÁC NHẬN THẬT áp dụng NGAY CẢ khi Trạng thái = Nháp (không
 * đợi tới Hoàn thành) - xem ghi chú ở đầu `cmsDeThiPageObjects.js`.
 */
const runId = `AUTO-${Date.now().toString(36)}`;
const EXAM = `${runId}-duration`;

test.describe.serial("Ngân hàng đề thi - 4. Quy tắc Thời lượng đề & Section (DURATION-01..06)", () => {
  let context;
  let page;
  let baseUrl;
  let fixtures;

  test.beforeAll(async ({ browser }) => {
    requireCmsAdminConfig();
    baseUrl = resolveCmsAdminBaseUrl("staging");
    const { username, password } = resolveCmsAdminCredentials("staging");
    context = await browser.newContext();
    page = await context.newPage();

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator(po.login.usernameInput).fill(username);
    await page.locator(po.login.passwordInput).fill(password);
    await page.getByRole("button", { name: po.login.submitButton }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    fixtures = await setupDeThiFixtures(page, baseUrl, runId);
    await gotoDeThi(page, baseUrl);
    await clickAddNew(page);
    await fillExamName(page, EXAM);
    await selectExamType(page, fixtures.examTypeWithSections);
    await fillExamDuration(page, 25);
    await selectGrades(page, ["Lớp 1"]);
    await selectScoreTable(page, fixtures.scoreTable);
  });

  test.afterAll(async () => {
    await teardownDeThiFixtures(page, baseUrl, fixtures, [EXAM]);
    await context.close();
  });

  test("DURATION-01: để trống Thời lượng ở TẤT CẢ Section -> Lưu/Cập nhật thành công bình thường", async () => {
    await clearSectionDurationInStructure(page, fixtures.sectionA);
    await clearSectionDurationInStructure(page, fixtures.sectionB);
    await clickSave(page);
    await expect(page.getByText(po.durationWarningBannerPattern)).toHaveCount(0);
    await expect(page.getByText(po.durationMismatchErrorPattern)).toHaveCount(0);
    await expect(page).toHaveURL(/\/exam-prep\/papers$/);
  });

  test("DURATION-02: nhập Thời lượng cho 1 Section, Section còn lại để trống -> chặn Lưu", async () => {
    await gotoDeThi(page, baseUrl);
    const { openEditDeThi } = await import("../../../../automation/ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js");
    await openEditDeThi(page, EXAM);
    await fillSectionDurationInStructure(page, fixtures.sectionA, 10);
    await clickSave(page);
    await expect(page.getByText(po.durationWarningBannerPattern)).toBeVisible();
    await expect(page).not.toHaveURL(/\/exam-prep\/papers$/);
  });

  test("DURATION-03: nhập đủ Thời lượng mọi Section nhưng TỔNG khác Thời gian làm bài -> chặn Lưu", async () => {
    await fillSectionDurationInStructure(page, fixtures.sectionB, 5); // tổng 15, đề 25 -> lệch
    await clickSave(page);
    await expect(page.getByText(po.durationMismatchErrorPattern)).toBeVisible();
    await expect(page).not.toHaveURL(/\/exam-prep\/papers$/);
  });

  test("DURATION-04: nhập đủ Thời lượng mọi Section và TỔNG = Thời gian làm bài -> Lưu thành công", async () => {
    await fillSectionDurationInStructure(page, fixtures.sectionB, 15); // tổng 10+15=25, khớp đề 25
    await clickSave(page);
    await expect(page).toHaveURL(/\/exam-prep\/papers$/);
  });

  test.skip("DURATION-05: [App-side, Exploratory] Section có cấu hình Thời lượng riêng hết giờ - BỎ QUA: cần user thật làm bài trên app, ngoài phạm vi CMS", () => {});
  test.skip("DURATION-06: [App-side, Exploratory] Section KHÔNG cấu hình Thời lượng riêng - BỎ QUA: cần user thật làm bài trên app, ngoài phạm vi CMS", () => {});
});
