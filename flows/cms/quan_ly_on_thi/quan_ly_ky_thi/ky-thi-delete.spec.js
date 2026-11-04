import { test, expect } from "../../../../automation/quan_ly_ky_thi/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsKyThiPageObjects as po,
  gotoKyThi,
  createKyThi,
  openEditKyThiPopup,
  attachSection as attachSectionToKyThi,
  saveKyThiPopup,
  openDeleteConfirm,
  confirmDelete,
  cancelDeleteConfirm,
  deleteKyThiByName,
  readDialogText,
  readTotalRecordsText,
  kyThiRow,
} from "../../../../automation/quan_ly_ky_thi/navigation/cmsKyThiPageObjects.js";
import {
  cmsDeThiPageObjects as deThiPo,
  gotoDeThi,
  clickAddNew as clickAddNewDeThi,
  fillExamName,
  selectExamType,
  fillExamDuration,
  selectGrades,
  selectScoreTable,
  searchDeThi,
  openEditDeThi,
  fillSectionDurationInStructure,
  clickAddPracticeButton,
  readPracticePopupOptionTexts,
  selectPracticeInPopup,
  clickPracticePopupSave,
  selectTrangThai,
  clickSave as clickSaveDeThi,
  clickPublishButton,
  confirmPublish,
  deleteDeThiByName,
  setupDeThiFixtures,
  teardownDeThiFixtures,
} from "../../../../automation/ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

/**
 * Nhóm "4. Xóa Kỳ thi" (DEL-01..06) - xem ghi chú chung (env staging, tiền tố AUTO-) tại
 * `ky-thi-list.spec.js`.
 *
 * AC quy định: cho phép xóa Kỳ thi khi CHƯA gắn vào Đề thi nào; một khi đã gắn (không phân biệt
 * Công khai hay chưa) thì KHÔNG cho phép xóa - KHÁC Section (vẫn cho xóa nếu đề chỉ chưa công
 * khai) nhưng GIỐNG Bảng điểm (chặn tuyệt đối một khi đã gắn).
 *
 * DEL-02/03/06 (2026-11-04): tự động hoá đầy đủ, KHÔNG còn `test.skip` - tái sử dụng
 * `setupDeThiFixtures`/`teardownDeThiFixtures` + page objects "Ngân hàng đề thi" (cùng khuôn mẫu
 * đã viết ở `score-table-delete.spec.js`). KHÁC `score-table-delete.spec.js`: ở đây chính Kỳ thi
 * test (`KT_DEL02/03/06`, không phải `deThiFixtures.examTypeWithSections`) được CHỌN làm "Loại kỳ
 * thi" khi tạo Đề thi - với DEL-03 cần Công khai được, phải tự gắn sẵn `sectionA`/`sectionB` của
 * fixture vào "Cấu hình đề xuất" RIÊNG của `KT_DEL03` trước (để màn Đề thi tự fill Cấu trúc đề).
 *
 * `deleteDialogTitle`/`deleteConfirmText()` ĐÃ XÁC NHẬN THẬT qua chạy test thật trên dev
 * (2026-11-03) - xem comment đầu `cmsKyThiPageObjects.js`.
 */
const runId = `AUTO-${Date.now().toString(36)}`;
const KT_DEL02 = `${runId}-kt-del02`;
const KT_DEL03 = `${runId}-kt-del03`;
const KT_DEL06 = `${runId}-kt-del06`;
const EXAM_DEL02 = `${runId}-examDel02`;
const EXAM_DEL03 = `${runId}-examDel03`;
const EXAM_DEL06 = `${runId}-examDel06`;

test.describe.serial("Quản lý kỳ thi - 4. Xóa Kỳ thi (DEL-01..06)", () => {
  let context;
  let page;
  let baseUrl;
  let deThiFixtures;

  /** DEL-02/03: xác nhận KHÔNG xóa được - chấp nhận CẢ 2 cách hệ thống có thể chặn (nút disable
   * HOẶC vẫn mở được popup xác nhận nhưng xóa xong Kỳ thi vẫn còn nguyên/có lỗi) - cùng khuôn mẫu
   * `expectDeleteBlocked()` đã dùng cho Section/Bảng điểm. */
  async function expectDeleteBlocked(kyThiName) {
    await gotoKyThi(page, baseUrl);
    const deleteBtn = kyThiRow(page, kyThiName).getByRole("button", { name: "Xóa" });
    if (await deleteBtn.isDisabled()) {
      expect(await deleteBtn.isDisabled()).toBe(true);
      return;
    }
    await openDeleteConfirm(page, kyThiName);
    await confirmDelete(page);
    await expect(kyThiRow(page, kyThiName)).toBeVisible();
    const dialog = page.getByRole("dialog");
    if (await dialog.first().isVisible({ timeout: 1000 }).catch(() => false)) {
      await cancelDeleteConfirm(page).catch(() => {});
      await dialog.first().waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
    }
  }

  async function addFirstPracticeOption(sectionName) {
    await clickAddPracticeButton(page, sectionName);
    await page.waitForTimeout(800);
    let options = await readPracticePopupOptionTexts(page);
    if (options.length === 0) {
      await page.waitForTimeout(800);
      options = await readPracticePopupOptionTexts(page);
    }
    await selectPracticeInPopup(page, options[0]);
    await clickPracticePopupSave(page);
  }

  async function attachFixtureSectionsToKyThi(kyThiName) {
    await gotoKyThi(page, baseUrl);
    await openEditKyThiPopup(page, kyThiName);
    await attachSectionToKyThi(page, `${deThiFixtures.sectionA} (Nghe)`);
    await attachSectionToKyThi(page, `${deThiFixtures.sectionB} (Nói)`);
    await saveKyThiPopup(page);
  }

  async function createDraftExamWithExamType(examName, examTypeName) {
    await gotoDeThi(page, baseUrl);
    await clickAddNewDeThi(page);
    await selectExamType(page, examTypeName);
    await fillExamName(page, examName);
    await fillExamDuration(page, 10);
    await selectGrades(page, ["Lớp 2"]);
    await selectScoreTable(page, deThiFixtures.scoreTable);
    await clickSaveDeThi(page);
  }

  /** `examTypeName` PHẢI đã có sẵn `sectionA`/`sectionB` trong "Cấu hình đề xuất" (gọi
   * `attachFixtureSectionsToKyThi()` trước) để màn Đề thi tự fill Cấu trúc đề. */
  async function createPublishedExamWithExamType(examName, examTypeName) {
    await gotoDeThi(page, baseUrl);
    await clickAddNewDeThi(page);
    await selectExamType(page, examTypeName);
    await fillExamName(page, examName);
    await fillExamDuration(page, 25);
    await selectGrades(page, ["Lớp 1"]);
    await selectScoreTable(page, deThiFixtures.scoreTable);
    await fillSectionDurationInStructure(page, deThiFixtures.sectionA, 10);
    await fillSectionDurationInStructure(page, deThiFixtures.sectionB, 15);
    await addFirstPracticeOption(deThiFixtures.sectionA);
    await addFirstPracticeOption(deThiFixtures.sectionB);
    await selectTrangThai(page, deThiPo.completedRadioLabel);
    await clickSaveDeThi(page);

    await gotoDeThi(page, baseUrl);
    await searchDeThi(page, examName);
    await openEditDeThi(page, examName);
    await clickPublishButton(page);
    await confirmPublish(page);
  }

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
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

    deThiFixtures = await setupDeThiFixtures(page, baseUrl, runId);
    await gotoKyThi(page, baseUrl);
  });

  test.afterAll(async () => {
    test.setTimeout(180_000);
    // PHẢI xóa Đề thi (tham chiếu) trước, sau đó mới xóa được Kỳ thi (bị chặn xóa khi còn gắn Đề
    // thi - chính rule đang test ở DEL-02/03).
    await teardownDeThiFixtures(page, baseUrl, deThiFixtures, [EXAM_DEL02, EXAM_DEL03, EXAM_DEL06]);
    for (const name of [KT_DEL02, KT_DEL03, KT_DEL06]) {
      await deleteKyThiByName(page, name).catch(() => {});
    }
    await context.close();
  });

  test("DEL-01: xóa Kỳ thi chưa gắn vào Đề thi nào -> popup xác nhận -> Đồng ý -> xóa thành công", async () => {
    const name = `${runId}-del01`;
    await createKyThi(page, { name });
    await expect(kyThiRow(page, name)).toBeVisible();

    await openDeleteConfirm(page, name);
    await expect(page.getByText(po.deleteDialogTitle, { exact: true })).toBeVisible();
    expect(await readDialogText(page)).toContain(po.deleteConfirmText(name));
    await confirmDelete(page);
    await expect(kyThiRow(page, name)).toHaveCount(0);
  });

  test("DEL-02: xóa Kỳ thi đã gắn Đề thi CHƯA công khai - KHÔNG cho phép", async () => {
    await gotoKyThi(page, baseUrl);
    await createKyThi(page, { name: KT_DEL02 });
    await createDraftExamWithExamType(EXAM_DEL02, KT_DEL02);
    await expectDeleteBlocked(KT_DEL02);
  });

  test("DEL-03: xóa Kỳ thi đã gắn Đề thi ĐÃ công khai - KHÔNG cho phép", async () => {
    await gotoKyThi(page, baseUrl);
    await createKyThi(page, { name: KT_DEL03 });
    await attachFixtureSectionsToKyThi(KT_DEL03);
    await createPublishedExamWithExamType(EXAM_DEL03, KT_DEL03);
    await expectDeleteBlocked(KT_DEL03);
  });

  test("DEL-04: Hủy ở popup xác nhận xóa -> Kỳ thi không bị xóa", async () => {
    const name = `${runId}-del04`;
    await createKyThi(page, { name });
    await openDeleteConfirm(page, name);
    await cancelDeleteConfirm(page);
    await expect(kyThiRow(page, name)).toBeVisible();
    await deleteKyThiByName(page, name);
  });

  test("DEL-05: số đếm 'Tổng X bản ghi' giảm đúng 1 đơn vị sau khi xóa thành công", async () => {
    const name = `${runId}-del05`;
    await createKyThi(page, { name });
    await gotoKyThi(page, baseUrl);
    const before = await readTotalRecordsText(page);

    await openDeleteConfirm(page, name);
    await confirmDelete(page);
    const after = await readTotalRecordsText(page);
    expect(after).toBe(before - 1);
  });

  test("DEL-06: [Edge] Kỳ thi từng gắn Đề thi nhưng Đề thi đó sau đó bị xóa -> cho phép xóa lại bình thường", async () => {
    await gotoKyThi(page, baseUrl);
    await createKyThi(page, { name: KT_DEL06 });
    await createDraftExamWithExamType(EXAM_DEL06, KT_DEL06);
    // Vẫn còn gắn Đề thi -> xác nhận chặn trước, rồi xóa hẳn Đề thi để gỡ ràng buộc.
    await expectDeleteBlocked(KT_DEL06);

    await gotoDeThi(page, baseUrl);
    await deleteDeThiByName(page, EXAM_DEL06);

    await gotoKyThi(page, baseUrl);
    await openDeleteConfirm(page, KT_DEL06);
    await confirmDelete(page);
    await expect(kyThiRow(page, KT_DEL06)).toHaveCount(0);
  });
});
