import { test, expect } from "../../../../automation/ngan_hang_de_thi/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsDeThiPageObjects as po,
  gotoDeThi,
  clickAddNew,
  openEditDeThi,
  setupDeThiFixtures,
  teardownDeThiFixtures,
  fillExamName,
  selectExamType,
  fillExamDuration,
  selectGrades,
  fillSectionDurationInStructure,
  clickAddPracticeButton,
  selectPracticeInPopup,
  clickPracticePopupSave,
  selectTrangThai,
  readSelectedTrangThai,
  clickSave,
  clickBackIcon,
  clickCancelButton,
  isDiscardChangesDialogVisible,
  confirmDiscardChanges,
  cancelDiscardChangesDialog,
  isPublishButtonDisabled,
  clickPublishButton,
  confirmPublish,
  readLastUpdatedText,
  readRowStatusBadge,
} from "../../../../automation/ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

/**
 * Nhóm "5. Lưu / Công khai / Trạng thái đề thi" (SAVE-01..13) - xem ghi chú chung tại
 * `de-thi-list.spec.js`.
 *
 * SAVE-13 (kiểm tra đề KHÔNG hiển thị trên app phía user) CHỦ ĐỘNG BỎ QUA - cần kiểm tra app di
 * động thật, ngoài phạm vi CMS web admin. SAVE-11 chỉ assert phần CMS-side (Chế độ chuyển Công
 * khai) - KHÔNG assert phần "hiển thị được trên app cho đúng Khối lớp" (cũng cần app thật).
 *
 * SAVE-12: xem ghi chú mâu thuẫn tên case/cột Kỳ vọng trong `TESTCASES.xlsx` tại đầu
 * `cmsDeThiPageObjects.js` - test dưới đây assert ĐÚNG theo hành vi thật đã live-verify (Chế độ
 * GIỮ NGUYÊN Công khai sau khi Lưu, không tự gỡ).
 */
const runId = `AUTO-${Date.now().toString(36)}`;
const EXAM = `${runId}-save`;

test.describe.serial("Ngân hàng đề thi - 5. Lưu / Công khai / Trạng thái (SAVE-01..13)", () => {
  let context;
  let page;
  let baseUrl;
  let fixtures;

  test.beforeAll(async ({ browser }) => {
    requireCmsAdminConfig();
    baseUrl = resolveCmsAdminBaseUrl("dev");
    const { username, password } = resolveCmsAdminCredentials("dev");
    context = await browser.newContext();
    page = await context.newPage();

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator(po.login.usernameInput).fill(username);
    await page.locator(po.login.passwordInput).fill(password);
    await page.getByRole("button", { name: po.login.submitButton }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    fixtures = await setupDeThiFixtures(page, baseUrl, runId);

    // Dựng sẵn 1 đề Hoàn thành hợp lệ đầy đủ (2 section đều có bài thực hành + thời lượng khớp)
    // để dùng xuyên suốt các case Công khai/Sửa - tránh lặp lại thao tác nặng ở từng test.
    await gotoDeThi(page, baseUrl);
    await clickAddNew(page);
    await fillExamName(page, EXAM);
    await selectExamType(page, fixtures.examTypeWithSections);
    await fillExamDuration(page, 25);
    await selectGrades(page, ["Lớp 1"]);
    await fillSectionDurationInStructure(page, fixtures.sectionA, 10);
    await fillSectionDurationInStructure(page, fixtures.sectionB, 15);
    for (const section of [fixtures.sectionA, fixtures.sectionB]) {
      await clickAddPracticeButton(page, section);
      await selectPracticeInPopup(page, "AI vocabulary");
      await clickPracticePopupSave(page);
    }
    await selectTrangThai(page, po.completedRadioLabel);
    await clickSave(page);
  });

  test.afterAll(async () => {
    await teardownDeThiFixtures(page, baseUrl, fixtures, [EXAM]);
    await context.close();
  });

  test("SAVE-01: nút Quay lại khi KHÔNG có thay đổi - về thẳng danh sách, không hỏi", async () => {
    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, EXAM);
    await clickBackIcon(page);
    await expect(page).toHaveURL(/\/exam-prep\/papers$/);
  });

  test("SAVE-02: nút Quay lại khi CÓ thay đổi chưa lưu - chọn Bỏ thay đổi", async () => {
    await openEditDeThi(page, EXAM);
    await fillExamDuration(page, 999); // thay đổi tạm, không lưu thật
    await clickBackIcon(page);
    expect(await isDiscardChangesDialogVisible(page)).toBe(true);
    await confirmDiscardChanges(page);
    await expect(page).toHaveURL(/\/exam-prep\/papers$/);
    await openEditDeThi(page, EXAM);
    await expect(page.locator(po.durationInput)).not.toHaveValue("999");
  });

  test("SAVE-03: nút Quay lại khi CÓ thay đổi chưa lưu - Hủy popup xác nhận", async () => {
    await fillExamDuration(page, 888);
    await clickBackIcon(page);
    expect(await isDiscardChangesDialogVisible(page)).toBe(true);
    await cancelDiscardChangesDialog(page);
    await expect(page.locator(po.durationInput)).toHaveValue("888");
    await fillExamDuration(page, 25); // trả lại giá trị gốc, KHÔNG lưu (rời trang sẽ tự hỏi lại)
  });

  test("SAVE-04: nút Hủy có hành vi giống hệt Quay lại", async () => {
    await fillExamDuration(page, 777);
    await clickCancelButton(page);
    expect(await isDiscardChangesDialogVisible(page)).toBe(true);
    await confirmDiscardChanges(page);
    await expect(page).toHaveURL(/\/exam-prep\/papers$/);
  });

  test("SAVE-05: 'Cập nhật lần cuối' hiển thị đúng sau khi Lưu", async () => {
    await openEditDeThi(page, EXAM);
    await fillExamName(page, `${EXAM}-touched`);
    await fillExamName(page, EXAM); // đổi rồi trả lại để chắc chắn có "thay đổi" kích hoạt Lưu
    await clickSave(page);
    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, EXAM);
    const text = await readLastUpdatedText(page);
    expect(text).toContain(po.lastUpdatedPrefix);
  });

  test("SAVE-09: nút Công khai bị vô hiệu hoá khi Trạng thái = Nháp", async () => {
    await selectTrangThai(page, po.draftRadioLabel);
    expect(await isPublishButtonDisabled(page)).toBe(true);
  });

  test("SAVE-10: nút Công khai active khi Trạng thái = Hoàn thành", async () => {
    await selectTrangThai(page, po.completedRadioLabel);
    expect(await isPublishButtonDisabled(page)).toBe(false);
    await clickSave(page); // lưu lại Trạng thái Hoàn thành cho case sau
  });

  test("SAVE-08: lưu hợp lệ quay về danh sách đúng vị trí", async () => {
    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, EXAM);
    await clickSave(page);
    await expect(page).toHaveURL(/\/exam-prep\/papers$/);
  });

  test("SAVE-11: bấm Công khai đề hợp lệ -> Chế độ chuyển Công khai (CMS-side; phần hiển thị trên app KHÔNG kiểm tra ở đây)", async () => {
    await openEditDeThi(page, EXAM);
    await clickPublishButton(page);
    await confirmPublish(page);
    await gotoDeThi(page, baseUrl);
    expect(await readRowStatusBadge(page, EXAM)).toContain("Công khai");
  });

  test("SAVE-12: sửa đề đang Công khai rồi Lưu (không bấm lại Công khai) -> Chế độ GIỮ NGUYÊN Công khai", async () => {
    await openEditDeThi(page, EXAM);
    await fillExamName(page, `${EXAM}-v2`);
    await clickSave(page);
    await gotoDeThi(page, baseUrl);
    expect(await readRowStatusBadge(page, `${EXAM}-v2`)).toContain("Công khai");
  });

  test.skip("SAVE-13: đề Chưa công khai không hiển thị trên app dù trước đó từng công khai - BỎ QUA: cần kiểm tra app di động thật, ngoài phạm vi CMS", () => {});

  test("SAVE-06: lưu ở Trạng thái Nháp chỉ validate mức tối thiểu (Tên/Loại kỳ thi/Thời gian/Khối lớp/Bảng điểm - KHÔNG bắt Section/Bài thực hành)", async () => {
    await gotoDeThi(page, baseUrl);
    await clickAddNew(page);
    await fillExamName(page, `${runId}-save06`);
    await selectExamType(page, fixtures.examTypeEmpty);
    await fillExamDuration(page, 10);
    await selectGrades(page, ["Lớp 2"]);
    await selectTrangThai(page, po.draftRadioLabel);
    await clickSave(page);
    await expect(page).toHaveURL(/\/exam-prep\/papers$/);
    await gotoDeThi(page, baseUrl);
    const { deleteDeThiByName } = await import("../../../../automation/ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js");
    await deleteDeThiByName(page, `${runId}-save06`);
  });

  test("SAVE-07: lưu ở Trạng thái Hoàn thành validate đầy đủ - thiếu Bài thực hành ở Section bị chặn Lưu", async () => {
    await clickAddNew(page);
    await fillExamName(page, `${runId}-save07`);
    await selectExamType(page, fixtures.examTypeWithSections);
    await fillExamDuration(page, 25);
    await selectGrades(page, ["Lớp 2"]);
    await fillSectionDurationInStructure(page, fixtures.sectionA, 10);
    await fillSectionDurationInStructure(page, fixtures.sectionB, 15);
    await selectTrangThai(page, po.completedRadioLabel);
    await clickSave(page);
    await expect(page.getByText(po.sectionMissingPracticeErrorPattern(fixtures.sectionA))).toBeVisible();
    await clickBackIcon(page);
    if (await isDiscardChangesDialogVisible(page)) await confirmDiscardChanges(page);
  });
});
