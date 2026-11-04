import { test, expect } from "../../../../automation/quan_ly_ky_thi/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsKyThiPageObjects as po,
  gotoKyThi,
  createKyThi,
  openAddKyThiPopup,
  openEditKyThiPopup,
  fillKyThiForm,
  saveKyThiPopup,
  cancelKyThiPopup,
  closeKyThiPopupByIcon,
  readDialogText,
  readRowDescription,
  readAllKyThiNamesInOrder,
  attachSection,
  unassignSection,
  readAttachedSectionNamesInOrder,
  readAttachableSectionOptionTexts,
  readAttachedTotalCount,
  deleteKyThiByName,
  kyThiRow,
} from "../../../../automation/quan_ly_ky_thi/navigation/cmsKyThiPageObjects.js";
import {
  cmsDeThiPageObjects as deThiPo,
  gotoDeThi,
  clickAddNew as clickAddNewDeThi,
  fillExamName,
  selectExamType,
  readSelectedExamType,
  fillExamDuration,
  selectGrades,
  selectScoreTable,
  clickSave as clickSaveDeThi,
  openEditDeThi,
  readStructureSectionNamesInOrder,
  deleteDeThiByName,
  setupDeThiFixtures,
  teardownDeThiFixtures,
} from "../../../../automation/ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

/**
 * Nhóm "3. Chỉnh sửa Kỳ thi" (EDIT-01..11) - xem ghi chú chung (env staging, tiền tố AUTO-) tại
 * `ky-thi-list.spec.js`.
 *
 * EDIT-02/03/05/06 (2026-11-04): tự động hoá đầy đủ, KHÔNG còn `test.skip` - tái sử dụng
 * `setupDeThiFixtures`/`teardownDeThiFixtures` + page objects "Ngân hàng đề thi" (cùng khuôn mẫu đã
 * dùng ở `score-table-edit.spec.js`/`score-table-delete.spec.js`).
 *
 * EDIT-04 VẪN `test.skip` - KHÔNG áp dụng được (N/A, không phải thiếu code): hệ thống hiện chỉ có
 * đúng 1 giá trị "Dạng quy đổi" ("Phổ thông") cho mọi Kỳ thi, không có cách nào đổi sang giá trị
 * khác để tạo điều kiện "Dạng quy đổi của Kỳ thi Y đã đổi" - cùng kết luận đã áp dụng cho ADD-03 và
 * SYNC-02 của `score-table-perm-sync.spec.js`.
 *
 * Không dùng `examTypeWithSections`/`examTypeEmpty` của `setupDeThiFixtures` làm đối tượng test
 * (2 Kỳ thi đó chỉ là fixture built-in của helper) - tạo riêng Kỳ thi test (`KT_EDIT02/0305/06`) vì
 * chính Kỳ thi đó mới là đối tượng đang bị Sửa; chỉ tái sử dụng `sectionA`/`sectionB`/`scoreTable`
 * của fixture để dựng "Cấu hình đề xuất"/Bảng điểm cho các Đề thi test.
 */
async function firstAvailableOption(page) {
  const opts = (await readAttachableSectionOptionTexts(page)).map((t) => t.trim()).filter(Boolean);
  if (opts.length === 0) {
    throw new Error("Không còn Section nào trong hệ thống dev để chọn - cần có sẵn Section trước khi chạy test này.");
  }
  return opts[0];
}

function sectionNameFromOption(optionText) {
  return optionText.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

const runId = `AUTO-${Date.now().toString(36)}`;
const BASE = `${runId}-base`;
const BASE_DESCRIPTION = `${runId} mo ta goc`;
const ORDER_A = `${runId}-ord-A`;
const ORDER_B = `${runId}-ord-B`;
const ORDER_C = `${runId}-ord-C`;
const createdNames = [BASE, ORDER_A, ORDER_B, ORDER_C];

const KT_EDIT02 = `${runId}-kt-edit02`;
const EXAM_EDIT02 = `${runId}-examEdit02`;
const KT_EDIT0305 = `${runId}-kt-edit0305`;
const EXAM_EDIT03 = `${runId}-examEdit03`;
const EXAM_EDIT05 = `${runId}-examEdit05`;
const KT_EDIT06 = `${runId}-kt-edit06`;
const EXAM_EDIT06 = `${runId}-examEdit06`;

test.describe.serial("Quản lý kỳ thi - 3. Chỉnh sửa Kỳ thi (EDIT-01..11)", () => {
  let context;
  let page;
  let baseUrl;
  let baseSectionName;
  let deThiFixtures;
  // Tên hiện tại của các Kỳ thi bị ĐỔI TÊN trong EDIT-02/06 - dọn theo tên MỚI NHẤT ở `afterAll`.
  let kt02CurrentName = KT_EDIT02;
  let kt06CurrentName = KT_EDIT06;

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
    await openAddKyThiPopup(page);
    await fillKyThiForm(page, { name: BASE, description: BASE_DESCRIPTION });
    const option = await firstAvailableOption(page);
    baseSectionName = sectionNameFromOption(option);
    await attachSection(page, option);
    await saveKyThiPopup(page);
  });

  test.afterAll(async () => {
    test.setTimeout(180_000);
    await teardownDeThiFixtures(page, baseUrl, deThiFixtures, [EXAM_EDIT02, EXAM_EDIT03, EXAM_EDIT05, EXAM_EDIT06]);
    for (const name of createdNames) {
      await deleteKyThiByName(page, name).catch(() => {});
    }
    await deleteKyThiByName(page, kt02CurrentName).catch(() => {});
    await deleteKyThiByName(page, KT_EDIT0305).catch(() => {});
    await deleteKyThiByName(page, kt06CurrentName).catch(() => {});
    await context.close();
  });

  test("EDIT-01: mở popup Sửa hiển thị đúng dữ liệu hiện tại", async () => {
    await gotoKyThi(page, baseUrl);
    await openEditKyThiPopup(page, BASE);
    await expect(page.getByRole("dialog").getByText(po.editDialogTitle)).toBeVisible();
    await expect(page.locator(po.nameInput)).toHaveValue(BASE);
    await expect(page.locator(po.descriptionInput)).toHaveValue(BASE_DESCRIPTION);
    await expect(page.getByText(po.conversionDefaultValue)).toBeVisible();
    expect(await readAttachedSectionNamesInOrder(page)).toEqual([baseSectionName]);
    await cancelKyThiPopup(page);
  });

  test("EDIT-02: sửa Tên kỳ thi của Kỳ thi đã gắn Đề thi -> cập nhật ngay ở màn Đề thi", async () => {
    await gotoKyThi(page, baseUrl);
    await createKyThi(page, { name: KT_EDIT02 });
    await createDraftExamWithExamType(EXAM_EDIT02, KT_EDIT02);

    const newName = `${KT_EDIT02}-renamed`;
    await gotoKyThi(page, baseUrl);
    await openEditKyThiPopup(page, KT_EDIT02);
    await fillKyThiForm(page, { name: newName });
    await saveKyThiPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    kt02CurrentName = newName;

    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, EXAM_EDIT02);
    await expect.poll(async () => (await readSelectedExamType(page)).trim(), { timeout: 10000 }).toContain(newName);
  });

  test("EDIT-03: sửa Cấu hình đề xuất KHÔNG ảnh hưởng Đề thi đã tạo trước đó", async () => {
    await gotoKyThi(page, baseUrl);
    await createKyThi(page, { name: KT_EDIT0305 });
    await openEditKyThiPopup(page, KT_EDIT0305);
    await attachSection(page, `${deThiFixtures.sectionA} (Nghe)`);
    await saveKyThiPopup(page);

    // Đề thi X nhận cấu trúc gợi ý CHỈ gồm sectionA (đúng Cấu hình đề xuất hiện tại của Kỳ thi).
    await gotoDeThi(page, baseUrl);
    await clickAddNewDeThi(page);
    await selectExamType(page, KT_EDIT0305);
    await fillExamName(page, EXAM_EDIT03);
    await fillExamDuration(page, 10);
    await selectGrades(page, ["Lớp 2"]);
    await selectScoreTable(page, deThiFixtures.scoreTable);
    expect(await readStructureSectionNamesInOrder(page)).toEqual([deThiFixtures.sectionA]);
    await clickSaveDeThi(page);

    // Sửa Cấu hình đề xuất của Kỳ thi (thêm sectionB) SAU KHI Đề thi X đã tạo.
    await gotoKyThi(page, baseUrl);
    await openEditKyThiPopup(page, KT_EDIT0305);
    await attachSection(page, `${deThiFixtures.sectionB} (Nói)`);
    await saveKyThiPopup(page);

    // Đề thi X giữ nguyên cấu trúc cũ (chỉ sectionA), KHÔNG tự cập nhật theo Kỳ thi.
    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, EXAM_EDIT03);
    await expect.poll(async () => readStructureSectionNamesInOrder(page), { timeout: 10000 }).toEqual([deThiFixtures.sectionA]);
  });

  test.skip(
    "EDIT-04: sửa Dạng quy đổi KHÔNG ảnh hưởng Bảng điểm đã chọn của Đề thi cũ - KHÔNG áp dụng: hệ thống hiện chỉ có đúng 1 giá trị Dạng quy đổi ('Phổ thông') cho mọi Kỳ thi, không có cách nào đổi sang giá trị khác để tạo điều kiện test (cùng kết luận ADD-03/SYNC-04)",
    () => {},
  );

  test("EDIT-05: Cấu trúc mới chỉ áp dụng cho Đề thi tạo SAU khi sửa", async () => {
    // Nối tiếp EDIT-03: Kỳ thi KT_EDIT0305 giờ có Cấu hình đề xuất = [sectionA, sectionB].
    await gotoDeThi(page, baseUrl);
    await clickAddNewDeThi(page);
    await selectExamType(page, KT_EDIT0305);
    await fillExamName(page, EXAM_EDIT05);
    await fillExamDuration(page, 10);
    await selectGrades(page, ["Lớp 2"]);
    await selectScoreTable(page, deThiFixtures.scoreTable);
    expect(await readStructureSectionNamesInOrder(page)).toEqual([deThiFixtures.sectionA, deThiFixtures.sectionB]);
    await clickSaveDeThi(page);
  });

  test("EDIT-06: sửa Kỳ thi đã gắn Đề thi vẫn được phép", async () => {
    await gotoKyThi(page, baseUrl);
    await createKyThi(page, { name: KT_EDIT06 });
    await createDraftExamWithExamType(EXAM_EDIT06, KT_EDIT06);

    const newName = `${KT_EDIT06}-renamed`;
    const newDescription = `${runId} mo ta edit06 moi`;
    await gotoKyThi(page, baseUrl);
    await openEditKyThiPopup(page, KT_EDIT06);
    await fillKyThiForm(page, { name: newName, description: newDescription });
    const option = await firstAvailableOption(page);
    await attachSection(page, option);
    await saveKyThiPopup(page);

    // Lưu thành công bình thường - không có dialog lỗi/popup chặn nào còn sót lại.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    kt06CurrentName = newName;
    await expect(kyThiRow(page, newName)).toBeVisible();
    expect((await readRowDescription(page, newName)).trim()).toBe(newDescription);
  });

  test("EDIT-07: validate khi Sửa - xóa trống Tên kỳ thi", async () => {
    await openEditKyThiPopup(page, BASE);
    await fillKyThiForm(page, { name: "" });
    await saveKyThiPopup(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await readDialogText(page)).toContain(po.nameRequiredError);
    await cancelKyThiPopup(page);
    await expect(kyThiRow(page, BASE)).toBeVisible();
  });

  test("EDIT-08: thêm/xóa Section trong popup Sửa", async () => {
    await openEditKyThiPopup(page, BASE);
    expect(await readAttachedSectionNamesInOrder(page)).toEqual([baseSectionName]);

    const option = await firstAvailableOption(page);
    const name = sectionNameFromOption(option);
    await attachSection(page, option);
    expect(await readAttachedSectionNamesInOrder(page)).toEqual([baseSectionName, name]);
    expect(await readAttachedTotalCount(page)).toBe(2);

    await unassignSection(page, name);
    expect(await readAttachedSectionNamesInOrder(page)).toEqual([baseSectionName]);
    expect(await readAttachedTotalCount(page)).toBe(1);
    await cancelKyThiPopup(page);
  });

  test("EDIT-09: bấm Hủy khi đang sửa -> dữ liệu gốc giữ nguyên", async () => {
    await openEditKyThiPopup(page, BASE);
    await fillKyThiForm(page, { name: `${BASE}-should-not-save`, description: "khong duoc luu" });
    await cancelKyThiPopup(page);
    await expect(kyThiRow(page, BASE)).toBeVisible();
    expect((await readRowDescription(page, BASE)).trim()).toBe(BASE_DESCRIPTION);
  });

  test("EDIT-10: đóng popup Sửa bằng icon 'close' -> dữ liệu gốc giữ nguyên", async () => {
    await openEditKyThiPopup(page, BASE);
    await fillKyThiForm(page, { name: `${BASE}-should-not-save-x` });
    await closeKyThiPopupByIcon(page);
    await expect(kyThiRow(page, BASE)).toBeVisible();
  });

  test("EDIT-11: vị trí trong danh sách không đổi sau khi Sửa kỳ thi không phải mới nhất", async () => {
    await createKyThi(page, { name: ORDER_A });
    await createKyThi(page, { name: ORDER_B });
    await createKyThi(page, { name: ORDER_C });
    const beforeNames = await readAllKyThiNamesInOrder(page);
    const beforeIdxB = beforeNames.indexOf(ORDER_B);
    expect(beforeIdxB).toBeGreaterThanOrEqual(0);

    await openEditKyThiPopup(page, ORDER_B);
    await fillKyThiForm(page, { description: "da sua mo ta" });
    await saveKyThiPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const afterNames = await readAllKyThiNamesInOrder(page);
    expect(afterNames.indexOf(ORDER_B)).toBe(beforeIdxB);
    // C (tạo sau B) vẫn phải đứng trước B - B không nhảy lên đầu
    expect(afterNames.indexOf(ORDER_C)).toBeLessThan(afterNames.indexOf(ORDER_B));
  });
});
