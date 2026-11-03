import { test, expect } from "../../../../automation/quan_ly_section/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsSectionPageObjects as po,
  gotoSections,
  createSection,
  openDeleteConfirm,
  confirmDelete,
  cancelDeleteConfirm,
  readDialogText,
  readTotalRecordsText,
  sectionRow,
} from "../../../../automation/quan_ly_section/navigation/cmsSectionPageObjects.js";
import { gotoKyThi, createKyThi, openEditKyThiPopup, attachSection as attachSectionToKyThi, saveKyThiPopup } from "../../../../automation/quan_ly_ky_thi/navigation/cmsKyThiPageObjects.js";
import { gotoScoreTables, createScoreTable } from "../../../../automation/cau_hinh_bang_diem/navigation/cmsScoreTablePageObjects.js";
import {
  cmsDeThiPageObjects as deThiPo,
  gotoDeThi,
  clickAddNew as clickAddNewDeThi,
  openEditDeThi,
  fillExamName,
  selectExamType,
  fillExamDuration,
  selectGrades,
  selectScoreTable,
  addSectionToStructure,
  fillSectionDurationInStructure,
  clickAddPracticeButton,
  selectPracticeInPopup,
  clickPracticePopupSave,
  selectTrangThai,
  clickSave as clickSaveDeThi,
  clickPublishButton,
  confirmPublish,
} from "../../../../automation/ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

/**
 * Nhóm "4. Xóa Section" (DEL-01..07) - xem ghi chú chung (env dev, tiền tố AUTO-) tại
 * `section-list.spec.js`.
 *
 * DEL-02/03/04/06 (2026-11-03): tự động hoá đầy đủ bằng cách tái sử dụng page objects của
 * "Ngân hàng đề thi"/"Quản lý kỳ thi" (giống cách đã làm ở EDIT-04/05/12/13 của
 * `section-edit.spec.js`) - KHÔNG còn `test.skip`. Bài thực hành dùng chung "Put the words in the
 * correct order" (Kỹ năng Đọc, đã xác nhận có thật trên staging - xem ghi chú ở
 * `section-edit.spec.js`) nên MỌI Section cần Bài thực hành trong file này đều tạo với Kỹ năng
 * "Đọc".
 *
 * DEL-03/06 (Đề thi ĐÃ Công khai chặn xóa): TESTCASES.md ghi "nút Xóa bị ẩn/disable, HOẶC hệ thống
 * báo lỗi chặn xóa khi xác nhận" - CHƯA biết cơ chế thật trên UI nên `expectDeleteBlocked()` dưới
 * đây xử lý CẢ 2 khả năng thay vì giả định 1 cách cụ thể.
 */
const SECTION_ENV = process.env.QUAN_LY_SECTION_ENV || "dev";
const runId = `AUTO-${Date.now().toString(36)}`;
const KT_EMPTY_FOR_DEL = `${runId}-kt-del-empty`;
const KT_FOR_DEL04 = `${runId}-kt-del04`;
const SCORE_TABLE_FOR_DEL = `${runId}-bd-del`;
const PRACTICE_ITEM_TEXT = "Put the words in the correct order";

test.describe.serial("Quản lý Section - 4. Xóa Section (DEL-01..07)", () => {
  let context;
  let page;
  let baseUrl;
  let delFixtureReady = false;

  /** Dựng 1 lần: 1 Kỳ thi rỗng (chỉ dùng làm "Loại kỳ thi" khi tạo Đề thi, KHÔNG gắn Section nào
   * vào "Cấu hình đề xuất" của nó - tránh tự fill nhầm sang Cấu trúc đề của các Đề thi tạo sau) + 1
   * Kỳ thi RIÊNG dành cho DEL-04 (gắn Section thật vào "Cấu hình đề xuất") + 1 Bảng điểm. */
  async function ensureDelFixtures() {
    if (delFixtureReady) return;
    await gotoKyThi(page, baseUrl);
    await createKyThi(page, { name: KT_EMPTY_FOR_DEL });
    await createKyThi(page, { name: KT_FOR_DEL04 });

    await gotoScoreTables(page, baseUrl);
    await createScoreTable(page, { name: SCORE_TABLE_FOR_DEL });
    delFixtureReady = true;
  }

  /** Tạo 1 Đề thi (Nháp mặc định) gắn sẵn `sectionName` vào Cấu trúc đề, Thời lượng đề = Thời
   * lượng section = 20 (tường minh, không phụ thuộc Thời lượng riêng của Section - xem EDIT-05). */
  async function createDraftExamWithSection(examName, sectionName) {
    await gotoDeThi(page, baseUrl);
    await clickAddNewDeThi(page);
    await fillExamName(page, examName);
    await selectExamType(page, KT_EMPTY_FOR_DEL);
    await fillExamDuration(page, 20);
    await selectGrades(page, ["Lớp 1"]);
    await selectScoreTable(page, SCORE_TABLE_FOR_DEL);
    await addSectionToStructure(page, sectionName);
    await fillSectionDurationInStructure(page, sectionName, 20);
    await clickSaveDeThi(page);
  }

  /** Đưa 1 Đề thi ĐANG Nháp (đã có sẵn `sectionName` trong Cấu trúc đề) lên Công khai - cần thêm 1
   * Bài thực hành (rule Hoàn thành/Công khai) + chuyển Trạng thái + Lưu + Công khai. */
  async function publishExamWithSection(examName, sectionName) {
    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, examName);
    await clickAddPracticeButton(page, sectionName);
    await selectPracticeInPopup(page, PRACTICE_ITEM_TEXT);
    await clickPracticePopupSave(page);
    await selectTrangThai(page, deThiPo.completedRadioLabel);
    await clickSaveDeThi(page);

    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, examName);
    await clickPublishButton(page);
    await confirmPublish(page);
  }

  /** DEL-03/06: xác nhận KHÔNG xóa được - chấp nhận CẢ 2 cách hệ thống có thể chặn (nút disable
   * HOẶC vẫn mở được popup xác nhận nhưng xóa xong Section vẫn còn nguyên/có lỗi). */
  async function expectDeleteBlocked(sectionName) {
    await gotoSections(page, baseUrl);
    const deleteBtn = sectionRow(page, sectionName).getByRole("button", { name: "Xóa" });
    if (await deleteBtn.isDisabled()) {
      expect(await deleteBtn.isDisabled()).toBe(true);
      return;
    }
    await openDeleteConfirm(page, sectionName);
    await confirmDelete(page);
    await expect(sectionRow(page, sectionName)).toBeVisible();
  }

  test.beforeAll(async ({ browser }) => {
    requireCmsAdminConfig();
    baseUrl = resolveCmsAdminBaseUrl(SECTION_ENV);
    const { username, password } = resolveCmsAdminCredentials(SECTION_ENV);
    context = await browser.newContext();
    page = await context.newPage();

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator(po.login.usernameInput).fill(username);
    await page.locator(po.login.passwordInput).fill(password);
    await page.getByRole("button", { name: po.login.submitButton }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    await gotoSections(page, baseUrl);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("DEL-01: xóa Section chưa gắn vào Đề thi nào -> popup xác nhận -> Đồng ý -> xóa thành công", async () => {
    const name = `${runId}-del01`;
    await createSection(page, { name, skill: "Nghe" });
    await expect(sectionRow(page, name)).toBeVisible();

    await openDeleteConfirm(page, name);
    await expect(page.getByText(po.deleteDialogTitle, { exact: true })).toBeVisible();
    expect(await readDialogText(page)).toContain(po.deleteConfirmText(name));
    await confirmDelete(page);
    await expect(sectionRow(page, name)).toHaveCount(0);
  });

  test("DEL-02: xóa Section đã gắn Đề thi CHƯA Công khai - cho phép xóa thành công", async () => {
    await ensureDelFixtures();
    const name = `${runId}-del02`;
    await gotoSections(page, baseUrl);
    await createSection(page, { name, skill: "Đọc" });
    await createDraftExamWithSection(`${runId}-examDel02`, name);

    await gotoSections(page, baseUrl);
    await openDeleteConfirm(page, name);
    await confirmDelete(page);
    await expect(sectionRow(page, name)).toHaveCount(0);
  });

  test("DEL-03: xóa Section đã gắn Đề thi ĐÃ Công khai - KHÔNG cho phép xóa", async () => {
    const name = `${runId}-del03`;
    await gotoSections(page, baseUrl);
    await createSection(page, { name, skill: "Đọc" });
    await createDraftExamWithSection(`${runId}-examDel03`, name);
    await publishExamWithSection(`${runId}-examDel03`, name);

    await expectDeleteBlocked(name);
  });

  test("DEL-04: xóa Section đang gắn vào Kỳ thi - hệ thống vẫn cho phép xóa", async () => {
    const name = `${runId}-del04`;
    await gotoSections(page, baseUrl);
    await createSection(page, { name, skill: "Nói" });

    await gotoKyThi(page, baseUrl);
    await openEditKyThiPopup(page, KT_FOR_DEL04);
    await attachSectionToKyThi(page, `${name} (Nói)`);
    await saveKyThiPopup(page);

    await gotoSections(page, baseUrl);
    await openDeleteConfirm(page, name);
    await confirmDelete(page);
    await expect(sectionRow(page, name)).toHaveCount(0);
  });

  test("DEL-05: Hủy ở popup xác nhận xóa -> Section không bị xóa", async () => {
    const name = `${runId}-del05`;
    await createSection(page, { name, skill: "Nghe" });
    await openDeleteConfirm(page, name);
    await cancelDeleteConfirm(page);
    await expect(sectionRow(page, name)).toBeVisible();
    // KHÔNG xóa `name` sau khi test xong - theo yêu cầu, giữ lại dữ liệu test để xem sau khi chạy.
  });

  test("DEL-06: [Edge] Section vừa gắn Đề thi đã Công khai vừa gắn Đề thi chưa Công khai - KHÔNG cho phép xóa", async () => {
    const name = `${runId}-del06`;
    await gotoSections(page, baseUrl);
    await createSection(page, { name, skill: "Đọc" });
    await createDraftExamWithSection(`${runId}-examDel06pub`, name);
    await publishExamWithSection(`${runId}-examDel06pub`, name);
    await createDraftExamWithSection(`${runId}-examDel06draft`, name);

    await expectDeleteBlocked(name);
  });

  test("DEL-07: số đếm 'Tổng X bản ghi' giảm đúng 1 đơn vị sau khi xóa thành công", async () => {
    const name = `${runId}-del07`;
    await createSection(page, { name, skill: "Nghe" });
    await gotoSections(page, baseUrl);
    const before = await readTotalRecordsText(page);

    await openDeleteConfirm(page, name);
    await confirmDelete(page);
    const after = await readTotalRecordsText(page);
    expect(after).toBe(before - 1);
  });
});
