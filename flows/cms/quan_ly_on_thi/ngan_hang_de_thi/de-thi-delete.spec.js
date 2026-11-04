import { test, expect } from "../../../../automation/ngan_hang_de_thi/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsDeThiPageObjects as po,
  gotoDeThi,
  createExam,
  setupDeThiFixtures,
  teardownDeThiFixtures,
  openEditDeThi,
  fillSectionDurationInStructure,
  clickAddPracticeButton,
  selectFirstPracticeInPopup,
  clickPracticePopupSave,
  selectTrangThai,
  clickSave,
  clickPublishButton,
  confirmPublish,
  openDeleteConfirm,
  cancelDeleteConfirm,
  confirmDelete,
  readAllExamNamesInOrder,
  readTotalRecordsText,
  searchDeThi,
} from "../../../../automation/ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

/**
 * Nhóm "6. Xóa đề thi" (DEL-01..06) - xem ghi chú chung tại `de-thi-list.spec.js`.
 *
 * DEL-06 ("[Edge - cần xác nhận BA]" - xóa đề mà user đã có lượt làm/đang làm dở) CHỦ ĐỘNG BỎ QUA -
 * cần dữ liệu lượt làm thật của user trên app, ngoài phạm vi CMS web admin và rủi ro cho dữ liệu
 * thật nếu cố tạo kịch bản này trên môi trường dùng chung.
 *
 * DEL-04 chỉ assert phần CMS-side (đề biến mất khỏi danh sách CMS) - phần "biến mất khỏi hiển thị
 * phía app" cần kiểm tra app di động thật, ngoài phạm vi ở đây.
 */
const runId = `AUTO-${Date.now().toString(36)}`;
const DRAFT_EXAM = `${runId}-delDraft`;
const PUBLIC_EXAM = `${runId}-delPublic`;

test.describe.serial("Ngân hàng đề thi - 6. Xóa đề thi (DEL-01..06)", () => {
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
    await createExam(page, { name: DRAFT_EXAM, examType: fixtures.examTypeEmpty, grades: ["Lớp 1"], scoreTable: fixtures.scoreTable });

    // Dựng 1 đề Công khai thật cho DEL-04.
    await gotoDeThi(page, baseUrl);
    const { clickAddNew, fillExamName, selectExamType, fillExamDuration, selectGrades } = await import(
      "../../../../automation/ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js"
    );
    await clickAddNew(page);
    await fillExamName(page, PUBLIC_EXAM);
    await selectExamType(page, fixtures.examTypeWithSections);
    await fillExamDuration(page, 25);
    await selectGrades(page, ["Lớp 1"]);
    await fillSectionDurationInStructure(page, fixtures.sectionA, 10);
    await fillSectionDurationInStructure(page, fixtures.sectionB, 15);
    for (const section of [fixtures.sectionA, fixtures.sectionB]) {
      await clickAddPracticeButton(page, section);
      await selectFirstPracticeInPopup(page);
      await clickPracticePopupSave(page);
    }
    await selectTrangThai(page, po.completedRadioLabel);
    await clickSave(page);
    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, PUBLIC_EXAM);
    await clickPublishButton(page);
    await confirmPublish(page);
  });

  test.afterAll(async () => {
    await teardownDeThiFixtures(page, baseUrl, fixtures, [DRAFT_EXAM, PUBLIC_EXAM]);
    await context.close();
  });

  test("DEL-01: bấm icon Xóa hiện popup xác nhận, nêu rõ tên đề thi sắp xóa", async () => {
    await gotoDeThi(page, baseUrl);
    await openDeleteConfirm(page, DRAFT_EXAM);
    await expect(page.getByRole("dialog").getByText(DRAFT_EXAM, { exact: false })).toBeVisible();
  });

  test("DEL-02: Hủy ở popup xác nhận xóa - đề KHÔNG bị xóa", async () => {
    await cancelDeleteConfirm(page);
    await searchDeThi(page, DRAFT_EXAM);
    expect(await readAllExamNamesInOrder(page)).toContain(DRAFT_EXAM);
  });

  test("DEL-03: xác nhận xóa đề CHƯA công khai - đề biến mất khỏi danh sách CMS", async () => {
    await openDeleteConfirm(page, DRAFT_EXAM);
    await confirmDelete(page);
    await searchDeThi(page, DRAFT_EXAM);
    expect(await readAllExamNamesInOrder(page)).not.toContain(DRAFT_EXAM);
  });

  test("DEL-04: xác nhận xóa đề ĐÃ công khai (AC) - đề biến mất khỏi danh sách CMS", async () => {
    await searchDeThi(page, PUBLIC_EXAM);
    await openDeleteConfirm(page, PUBLIC_EXAM);
    await expect(page.getByRole("dialog").getByText(/không thể hoàn tác/)).toBeVisible();
    await confirmDelete(page);
    await searchDeThi(page, PUBLIC_EXAM);
    expect(await readAllExamNamesInOrder(page)).not.toContain(PUBLIC_EXAM);
  });

  test("DEL-05: số đếm 'X đề thi' giảm đúng sau khi xóa thành công", async () => {
    await searchDeThi(page, "");
    const before = await readTotalRecordsText(page);
    await createExam(page, { name: `${runId}-delCount`, examType: fixtures.examTypeEmpty, grades: ["Lớp 1"], scoreTable: fixtures.scoreTable });
    await gotoDeThi(page, baseUrl);
    const afterCreate = await readTotalRecordsText(page);
    expect(afterCreate).toBe(before + 1);
    await openDeleteConfirm(page, `${runId}-delCount`);
    await confirmDelete(page);
    const afterDelete = await readTotalRecordsText(page);
    expect(afterDelete).toBe(before);
  });

  test.skip("DEL-06: [Edge - cần xác nhận BA] xóa đề mà user đã có lượt làm/đang làm dở - BỎ QUA: cần dữ liệu lượt làm thật của user trên app, ngoài phạm vi CMS và rủi ro dữ liệu thật", () => {});
});
