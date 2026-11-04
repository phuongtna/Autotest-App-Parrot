import { test, expect } from "../../../../automation/ngan_hang_de_thi/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsDeThiPageObjects as po,
  gotoDeThi,
  createExam,
  openEditDeThi,
  setupDeThiFixtures,
  teardownDeThiFixtures,
  selectExamType,
  readSelectedExamType,
  fillSectionDurationInStructure,
  readSectionDurationInStructure,
  readStructureSectionNamesInOrder,
  readScoreTableConversionNote,
  readSelectedScoreTable,
  clickBackIcon,
  isDiscardChangesDialogVisible,
  confirmDiscardChanges,
} from "../../../../automation/ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

/**
 * Nhóm "7. Sửa đề & ảnh hưởng tới lượt làm (AC)" (EDIT-01..06) - xem ghi chú chung tại
 * `de-thi-list.spec.js`.
 *
 * EDIT-02/03 (ảnh hưởng tới lượt làm MỚI/CŨ của user) CHỦ ĐỘNG BỎ QUA - cần user thật làm bài qua
 * app để sinh "lượt làm" (không thể dựng qua CMS web admin), cùng tinh thần "case liên quan app
 * học sinh chưa viết vội" đã thống nhất.
 *
 * EDIT-04 là case đối xứng (và quan trọng cần đọc cùng) với `SYNC-06` trong
 * `flows/cms/quan_ly_on_thi/quan_ly_ky_thi/` - xem ghi chú dài ở đầu `cmsDeThiPageObjects.js` giải
 * thích vì sao 2 file test case kết luận TRÁI NGƯỢC nhau cho CÙNG 1 cơ chế thật.
 */
const runId = `AUTO-${Date.now().toString(36)}`;
const EXAM_WITH_STRUCT = `${runId}-editStruct`;
const EXAM_EMPTY = `${runId}-editEmpty`;

test.describe.serial("Ngân hàng đề thi - 7. Sửa đề & ảnh hưởng tới lượt làm (EDIT-01..06)", () => {
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
    await createExam(page, { name: EXAM_WITH_STRUCT, examType: fixtures.examTypeWithSections, duration: 25, grades: ["Lớp 1"], scoreTable: fixtures.scoreTable });
    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, EXAM_WITH_STRUCT);
    await fillSectionDurationInStructure(page, fixtures.sectionA, 10);
    await fillSectionDurationInStructure(page, fixtures.sectionB, 15);
    const { clickSave } = await import("../../../../automation/ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js");
    await clickSave(page);
    await gotoDeThi(page, baseUrl);
    await createExam(page, { name: EXAM_EMPTY, examType: fixtures.examTypeEmpty, duration: 20, grades: ["Lớp 1"], scoreTable: fixtures.scoreTable });
  });

  test.afterAll(async () => {
    await teardownDeThiFixtures(page, baseUrl, fixtures, [EXAM_WITH_STRUCT, EXAM_EMPTY]);
    await context.close();
  });

  test("EDIT-01: mở màn Sửa hiển thị đúng dữ liệu hiện tại", async () => {
    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, EXAM_WITH_STRUCT);
    expect(await readSelectedExamType(page)).toContain(fixtures.examTypeWithSections);
    const sections = await readStructureSectionNamesInOrder(page);
    expect(sections.some((n) => n.includes(fixtures.sectionA))).toBe(true);
    expect(sections.some((n) => n.includes(fixtures.sectionB))).toBe(true);
    expect(await readSectionDurationInStructure(page, fixtures.sectionA)).toBe("10");
    expect(await readSectionDurationInStructure(page, fixtures.sectionB)).toBe("15");
  });

  test.skip("EDIT-02: sửa nội dung đề -> lượt làm MỚI dùng nội dung/điểm đã sửa (AC) - BỎ QUA: cần user thật làm bài qua app để tạo lượt làm, ngoài phạm vi CMS", () => {});
  test.skip("EDIT-03: lượt làm ĐÃ hoàn thành TRƯỚC khi sửa giữ nguyên (AC) - BỎ QUA: cần user thật làm bài qua app để tạo lượt làm, ngoài phạm vi CMS", () => {});

  test("EDIT-04: đổi Loại kỳ thi của đề đã có sẵn Section/Thời lượng -> giữ nguyên cấu trúc (AC)", async () => {
    await selectExamType(page, fixtures.examTypeEmpty);
    const sections = await readStructureSectionNamesInOrder(page);
    expect(sections.some((n) => n.includes(fixtures.sectionA))).toBe(true);
    expect(sections.some((n) => n.includes(fixtures.sectionB))).toBe(true);
    expect(await readSectionDurationInStructure(page, fixtures.sectionA)).toBe("10");
    expect(await readSectionDurationInStructure(page, fixtures.sectionB)).toBe("15");
    await clickBackIcon(page);
    if (await isDiscardChangesDialogVisible(page)) await confirmDiscardChanges(page);
  });

  test("EDIT-05: đổi Loại kỳ thi của đề CHƯA có Section nào -> tự fill cấu trúc đề xuất (AC)", async () => {
    await openEditDeThi(page, EXAM_EMPTY);
    const before = await readStructureSectionNamesInOrder(page);
    expect(before.length).toBe(0);
    await selectExamType(page, fixtures.examTypeWithSections);
    const after = await readStructureSectionNamesInOrder(page);
    expect(after.some((n) => n.includes(fixtures.sectionA))).toBe(true);
    expect(after.some((n) => n.includes(fixtures.sectionB))).toBe(true);
    await clickBackIcon(page);
    if (await isDiscardChangesDialogVisible(page)) await confirmDiscardChanges(page);
  });

  test("EDIT-06: đổi Loại kỳ thi -> Bảng điểm quy đổi làm mới theo Dạng quy đổi mới (liên hệ FORM-15)", async () => {
    await openEditDeThi(page, EXAM_EMPTY);
    await selectExamType(page, fixtures.examTypeWithSections);
    const note = await readScoreTableConversionNote(page);
    expect(note).toContain("Phổ thông");
    const selected = await readSelectedScoreTable(page);
    expect(selected.trim().length).toBeGreaterThan(0);
    await clickBackIcon(page);
    if (await isDiscardChangesDialogVisible(page)) await confirmDiscardChanges(page);
  });
});
