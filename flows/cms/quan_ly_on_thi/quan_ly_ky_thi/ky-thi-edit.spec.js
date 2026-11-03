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

/**
 * Nhóm "3. Chỉnh sửa Kỳ thi" (EDIT-01..11) - xem ghi chú chung (env dev, tiền tố AUTO-) tại
 * `ky-thi-list.spec.js`.
 *
 * EDIT-02/03/04/05/06 BỎ QUA (`test.skip`) - cần thao tác qua lại với màn "Ngân hàng đề thi" (gắn
 * Kỳ thi vào 1 Đề thi, kiểm tra cascade/không-cascade, kiểm tra Sửa khi đã gắn Đề thi) - MÀN KHÁC,
 * ngoài phạm vi `/exam-prep/exam-types` mà automation module này bao phủ. `TESTCASES.md`/
 * `qlykythi.xlsx` ghi nhận các case này đã chạy tay Pass (EDIT-04 "Pending" vì Dạng quy đổi hiện
 * chỉ có 1 giá trị). Tự động hoá đầy đủ cần viết thêm `automation/ngan_hang_de_thi/` (việc riêng,
 * ngoài phạm vi yêu cầu lần này) - cùng quy ước BỎ QUA mà `quan_ly_section`/`cau_hinh_bang_diem`
 * đã áp dụng cho các case tương tự.
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

test.describe.serial("Quản lý kỳ thi - 3. Chỉnh sửa Kỳ thi (EDIT-01..11)", () => {
  let context;
  let page;
  let baseUrl;
  let baseSectionName;

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

    await gotoKyThi(page, baseUrl);
    await openAddKyThiPopup(page);
    await fillKyThiForm(page, { name: BASE, description: BASE_DESCRIPTION });
    const option = await firstAvailableOption(page);
    baseSectionName = sectionNameFromOption(option);
    await attachSection(page, option);
    await saveKyThiPopup(page);
  });

  test.afterAll(async () => {
    for (const name of createdNames) {
      await deleteKyThiByName(page, name).catch(() => {});
    }
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

  test.skip(
    "EDIT-02: sửa Tên kỳ thi của Kỳ thi đã gắn Đề thi -> cập nhật ngay ở màn Đề thi - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "EDIT-03: sửa Cấu hình đề xuất KHÔNG ảnh hưởng Đề thi đã tạo trước đó - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "EDIT-04: sửa Dạng quy đổi KHÔNG ảnh hưởng Bảng điểm đã chọn của Đề thi cũ - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi); hiện tại Dạng quy đổi chỉ có 1 giá trị nên cũng chưa thể tạo điều kiện khác biệt",
    () => {},
  );
  test.skip(
    "EDIT-05: Cấu trúc/Dạng quy đổi mới chỉ áp dụng cho Đề thi tạo SAU khi sửa - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "EDIT-06: sửa Kỳ thi đã gắn Đề thi vẫn được phép - BỎ QUA: cần màn Ngân hàng đề thi để gắn Kỳ thi vào 1 Đề thi trước (ngoài phạm vi)",
    () => {},
  );

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
