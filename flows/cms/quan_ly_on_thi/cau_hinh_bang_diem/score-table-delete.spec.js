import { test, expect } from "../../../../automation/cau_hinh_bang_diem/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsScoreTablePageObjects as po,
  gotoScoreTables,
  createScoreTable,
  openDeleteConfirm,
  confirmDelete,
  cancelDeleteConfirm,
  deleteScoreTableByName,
  readDialogText,
  readTotalRecordsText,
  scoreTableRow,
} from "../../../../automation/cau_hinh_bang_diem/navigation/cmsScoreTablePageObjects.js";
import {
  cmsDeThiPageObjects as deThiPo,
  gotoDeThi,
  clickAddNew,
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
  clickSave,
  clickPublishButton,
  confirmPublish,
  deleteDeThiByName,
  setupDeThiFixtures,
  teardownDeThiFixtures,
} from "../../../../automation/ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

/**
 * Nhóm "4. Xóa Bảng điểm" (DEL-01..06) - xem ghi chú chung (env staging, tiền tố AUTO-) tại
 * `score-table-list.spec.js`.
 *
 * KHÁC VỚI Section: AC quy định hễ Bảng điểm đã gắn vào BẤT KỲ Đề thi nào (công khai HAY chưa công
 * khai) thì đều KHÔNG cho phép xóa (rule chặt hơn rule Xóa Section - so với `section-delete.spec.js`
 * nơi Đề thi CHƯA công khai KHÔNG chặn xóa Section).
 *
 * DEL-02/03/06 (2026-11-04): tự động hoá đầy đủ, KHÔNG còn `test.skip` - tái sử dụng thẳng
 * `setupDeThiFixtures`/`teardownDeThiFixtures` + page objects của "Ngân hàng đề thi" (giống cách
 * EDIT-03/04/09 của `score-table-edit.spec.js` đã làm, và cùng khuôn mẫu `expectDeleteBlocked()` đã
 * viết cho `section-delete.spec.js`). `expectDeleteBlocked()` xử lý CẢ 2 khả năng chặn (nút Xóa
 * disable HOẶC hệ thống báo lỗi khi xác nhận) thay vì giả định 1 cơ chế cụ thể, vì TESTCASES.md ghi
 * cả 2 khả năng.
 */
const runId = `AUTO-${Date.now().toString(36)}`;
const SCORE_DEL02 = `${runId}-bd-del02`;
const SCORE_DEL03 = `${runId}-bd-del03`;
const SCORE_DEL06 = `${runId}-bd-del06`;
const EXAM_DEL02 = `${runId}-examDel02`;
const EXAM_DEL03 = `${runId}-examDel03`;
const EXAM_DEL06 = `${runId}-examDel06`;

test.describe.serial("Cấu hình bảng điểm - 4. Xóa Bảng điểm (DEL-01..06)", () => {
  let context;
  let page;
  let baseUrl;
  let deThiFixtures;

  /** DEL-02/03: xác nhận KHÔNG xóa được - chấp nhận CẢ 2 cách hệ thống có thể chặn (nút disable
   * HOẶC vẫn mở được popup xác nhận nhưng xóa xong Bảng điểm vẫn còn nguyên/có lỗi). */
  async function expectDeleteBlocked(scoreTableName) {
    await gotoScoreTables(page, baseUrl);
    const deleteBtn = scoreTableRow(page, scoreTableName).getByRole("button", { name: "Xóa" });
    if (await deleteBtn.isDisabled()) {
      expect(await deleteBtn.isDisabled()).toBe(true);
      return;
    }
    await openDeleteConfirm(page, scoreTableName);
    await confirmDelete(page);
    await expect(scoreTableRow(page, scoreTableName)).toBeVisible();
    // Xóa bị chặn có thể khiến dialog KHÔNG tự đóng (báo lỗi nhưng vẫn giữ dialog mở) - ĐÃ GẶP
    // THẬT 2026-11-04: dialog còn sót lại đè màn hình làm kẹt test kế tiếp (popup "Thêm mới" của
    // test sau không mở được). Đóng dialog còn sót trước khi trả về.
    const dialog = page.getByRole("dialog");
    if (await dialog.first().isVisible({ timeout: 1000 }).catch(() => false)) {
      await cancelDeleteConfirm(page).catch(() => {});
      await dialog.first().waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
    }
  }

  /** Thêm 1 Bài thực hành (option ĐẦU TIÊN trong popup) vào `sectionName` - danh sách option tải
   * bất đồng bộ sau khi dialog hiện tiêu đề (ĐÃ GẶP THẬT 2026-11-03/04, staging: 1 lần chờ 800ms
   * không luôn đủ) nên poll thêm 1 lần nữa trước khi coi là rỗng thật. */
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

  /** Tạo 1 Đề thi Nháp tối thiểu (Loại kỳ thi rỗng, không có Cấu trúc đề), gắn `scoreTableName`. */
  async function createDraftExamWithScoreTable(examName, scoreTableName) {
    await gotoDeThi(page, baseUrl);
    await clickAddNew(page);
    await selectExamType(page, deThiFixtures.examTypeEmpty);
    await fillExamName(page, examName);
    await fillExamDuration(page, 10);
    await selectGrades(page, ["Lớp 2"]);
    await selectScoreTable(page, scoreTableName);
    await clickSave(page);
  }

  /** Tạo 1 Đề thi đầy đủ Cấu trúc đề (2 section có sẵn trong `examTypeWithSections`) + Bài thực
   * hành + Hoàn thành, rồi Công khai - gắn `scoreTableName`. */
  async function createPublishedExamWithScoreTable(examName, scoreTableName) {
    await gotoDeThi(page, baseUrl);
    await clickAddNew(page);
    await selectExamType(page, deThiFixtures.examTypeWithSections);
    await fillExamName(page, examName);
    await fillExamDuration(page, 25);
    await selectGrades(page, ["Lớp 1"]);
    await selectScoreTable(page, scoreTableName);
    await fillSectionDurationInStructure(page, deThiFixtures.sectionA, 10);
    await fillSectionDurationInStructure(page, deThiFixtures.sectionB, 15);
    await addFirstPracticeOption(deThiFixtures.sectionA);
    await addFirstPracticeOption(deThiFixtures.sectionB);
    await selectTrangThai(page, deThiPo.completedRadioLabel);
    await clickSave(page);

    await gotoDeThi(page, baseUrl);
    await searchDeThi(page, examName);
    await openEditDeThi(page, examName);
    await clickPublishButton(page);
    await confirmPublish(page);
  }

  test.beforeAll(async ({ browser }) => {
    // beforeAll nặng hơn các file khác trong module (dựng fixture Đề thi/Kỳ thi/Section cho
    // DEL-02/03/06 qua helper của Ngân hàng đề thi) - cùng lý do tăng timeout như
    // `score-table-edit.spec.js`.
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
    await gotoScoreTables(page, baseUrl);
  });

  test.afterAll(async () => {
    // `test.setTimeout()` chỉ áp dụng cho hook ĐANG chạy - phải gọi lại riêng ở đây (không kế thừa
    // từ beforeAll) vì cleanup nặng hơn mặc định 60s (xóa 3 Đề thi + 2 Kỳ thi + 2 Section + 3 Bảng
    // điểm tạo mới cho DEL-02/03/06).
    test.setTimeout(180_000);
    // PHẢI xóa Đề thi (tham chiếu) trước, sau đó mới xóa được Kỳ thi/Section - rồi mới tới Bảng
    // điểm (cũng bị chặn xóa khi còn gắn Đề thi, giống rule Xóa đang test ở DEL-02/03).
    await teardownDeThiFixtures(page, baseUrl, deThiFixtures, [EXAM_DEL02, EXAM_DEL03, EXAM_DEL06]);
    for (const name of [SCORE_DEL02, SCORE_DEL03, SCORE_DEL06]) {
      await deleteScoreTableByName(page, name).catch(() => {});
    }
    await context.close();
  });

  test("DEL-01: xóa Bảng điểm chưa gắn vào Đề thi nào -> popup xác nhận -> Đồng ý -> xóa thành công", async () => {
    const name = `${runId}-del01`;
    await createScoreTable(page, { name });
    await expect(scoreTableRow(page, name)).toBeVisible();

    await openDeleteConfirm(page, name);
    await expect(page.getByText(po.deleteDialogTitle, { exact: true })).toBeVisible();
    expect(await readDialogText(page)).toContain(po.deleteConfirmText(name));
    await confirmDelete(page);
    await expect(scoreTableRow(page, name)).toHaveCount(0);
  });

  test("DEL-02: xóa Bảng điểm đã gắn Đề thi CHƯA công khai - KHÔNG cho phép", async () => {
    await gotoScoreTables(page, baseUrl);
    await createScoreTable(page, { name: SCORE_DEL02 });
    await createDraftExamWithScoreTable(EXAM_DEL02, SCORE_DEL02);
    await expectDeleteBlocked(SCORE_DEL02);
  });

  test("DEL-03: xóa Bảng điểm đã gắn Đề thi ĐÃ công khai - KHÔNG cho phép", async () => {
    await gotoScoreTables(page, baseUrl);
    await createScoreTable(page, { name: SCORE_DEL03 });
    await createPublishedExamWithScoreTable(EXAM_DEL03, SCORE_DEL03);
    await expectDeleteBlocked(SCORE_DEL03);
  });

  test("DEL-04: Hủy ở popup xác nhận xóa -> Bảng điểm không bị xóa", async () => {
    const name = `${runId}-del04`;
    await createScoreTable(page, { name });
    await openDeleteConfirm(page, name);
    await cancelDeleteConfirm(page);
    await expect(scoreTableRow(page, name)).toBeVisible();
    await deleteScoreTableByName(page, name);
  });

  test("DEL-05: số đếm 'Tổng X bản ghi' giảm đúng 1 đơn vị sau khi xóa thành công", async () => {
    const name = `${runId}-del05`;
    await createScoreTable(page, { name });
    await gotoScoreTables(page, baseUrl);
    const before = await readTotalRecordsText(page);

    await openDeleteConfirm(page, name);
    await confirmDelete(page);
    const after = await readTotalRecordsText(page);
    expect(after).toBe(before - 1);
  });

  test("DEL-06: [Edge] Bảng điểm đã từng gắn Đề thi nhưng Đề thi đó sau đó bị xóa -> cho phép xóa bình thường", async () => {
    await gotoScoreTables(page, baseUrl);
    await createScoreTable(page, { name: SCORE_DEL06 });
    await createDraftExamWithScoreTable(EXAM_DEL06, SCORE_DEL06);
    // vẫn còn gắn Đề thi -> xác nhận chặn trước, rồi xóa hẳn Đề thi để gỡ ràng buộc
    await expectDeleteBlocked(SCORE_DEL06);

    await gotoDeThi(page, baseUrl);
    await deleteDeThiByName(page, EXAM_DEL06);

    await gotoScoreTables(page, baseUrl);
    await openDeleteConfirm(page, SCORE_DEL06);
    await confirmDelete(page);
    await expect(scoreTableRow(page, SCORE_DEL06)).toHaveCount(0);
  });
});
