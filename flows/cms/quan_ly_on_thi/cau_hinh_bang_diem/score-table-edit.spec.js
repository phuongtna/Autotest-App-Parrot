import { test, expect } from "../../../../automation/cau_hinh_bang_diem/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsScoreTablePageObjects as po,
  gotoScoreTables,
  createScoreTable,
  openEditScoreTablePopup,
  fillScoreTableForm,
  saveScoreTablePopup,
  cancelScoreTablePopup,
  closeScoreTablePopupByIcon,
  readDialogText,
  readRowDescription,
  readAllScoreTableNamesInOrder,
  readSelectedConversionInForm,
  deleteScoreTableByName,
} from "../../../../automation/cau_hinh_bang_diem/navigation/cmsScoreTablePageObjects.js";

/**
 * Nhóm "3. Chỉnh sửa Bảng điểm" (EDIT-01..10) - xem ghi chú chung (env dev, tiền tố AUTO-) tại
 * `score-table-list.spec.js`.
 *
 * EDIT-03/04/09 BỎ QUA (`test.skip`) - cần gắn Bảng điểm vào 1 Đề thi (công khai/chưa công khai)
 * ở màn "Ngân hàng đề thi" - MÀN KHÁC, ngoài phạm vi `/exam-prep/score-tables` mà automation
 * module này bao phủ. `cauhinhbangdiem.xlsx` ghi nhận các case này đã chạy tay Pass (2026-11-03).
 *
 * EDIT-10 (sửa Dạng quy đổi sang giá trị khác) BỎ QUA - hệ thống hiện tại chỉ có đúng 1 giá trị
 * "Phổ thông", không có giá trị thứ 2 để đổi sang - xlsx ghi "Pending" (chưa test được).
 */
const runId = `AUTO-${Date.now().toString(36)}`;
const BASE = `${runId}-base`;
const ORDER_A = `${runId}-ord-A`;
const ORDER_B = `${runId}-ord-B`;
const ORDER_C = `${runId}-ord-C`;
const createdNames = [BASE, ORDER_A, ORDER_B, ORDER_C];

test.describe.serial("Cấu hình bảng điểm - 3. Chỉnh sửa Bảng điểm (EDIT-01..10)", () => {
  let context;
  let page;
  let baseUrl;

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

    await gotoScoreTables(page, baseUrl);
    await createScoreTable(page, { name: BASE, description: "Mô tả gốc" });
  });

  test.afterAll(async () => {
    for (const name of createdNames) {
      await deleteScoreTableByName(page, name).catch(() => {});
    }
    await context.close();
  });

  test("EDIT-01: mở popup Sửa hiển thị đúng dữ liệu hiện tại", async () => {
    await gotoScoreTables(page, baseUrl);
    await openEditScoreTablePopup(page, BASE);
    await expect(page.getByRole("dialog").getByText(po.editDialogTitle)).toBeVisible();
    await expect(page.locator(po.nameInput)).toHaveValue(BASE);
    await expect(page.locator(po.descriptionInput)).toHaveValue("Mô tả gốc");
    expect((await readSelectedConversionInForm(page)).trim()).toBe(po.conversionDefaultValue);
    await cancelScoreTablePopup(page);
  });

  test("EDIT-02: sửa Tên/Mô tả Bảng điểm chưa gắn Đề thi nào -> bảng cập nhật ngay, không cần tải lại", async () => {
    const newName = `${BASE}-renamed`;
    await openEditScoreTablePopup(page, BASE);
    await fillScoreTableForm(page, { name: newName, description: "Mô tả mới" });
    await saveScoreTablePopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(po.tableRowSelector, { hasText: newName })).toBeVisible();
    expect((await readRowDescription(page, newName)).trim()).toBe("Mô tả mới");
    // đổi lại tên/mô tả gốc để các case sau (và afterAll cleanup) vẫn định vị được bằng BASE
    await openEditScoreTablePopup(page, newName);
    await fillScoreTableForm(page, { name: BASE, description: "Mô tả gốc" });
    await saveScoreTablePopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test.skip(
    "EDIT-03: sửa Bảng điểm đã gắn Đề thi CHƯA công khai - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "EDIT-04: sửa Bảng điểm đã gắn Đề thi ĐÃ công khai - KHÔNG cho phép sửa - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );

  test("EDIT-05: validate khi Sửa - xóa trống Tên bảng điểm", async () => {
    await openEditScoreTablePopup(page, BASE);
    await fillScoreTableForm(page, { name: "" });
    await saveScoreTablePopup(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await readDialogText(page)).toContain(po.nameRequiredError);
    await cancelScoreTablePopup(page);
    await expect(page.locator(po.tableRowSelector, { hasText: BASE })).toBeVisible();
  });

  test("EDIT-06: bấm Hủy khi đang sửa -> dữ liệu gốc giữ nguyên", async () => {
    await openEditScoreTablePopup(page, BASE);
    await fillScoreTableForm(page, { name: `${BASE}-should-not-save`, description: "không được lưu" });
    await cancelScoreTablePopup(page);
    await expect(page.locator(po.tableRowSelector, { hasText: BASE })).toBeVisible();
    expect((await readRowDescription(page, BASE)).trim()).toBe("Mô tả gốc");
  });

  test("EDIT-07: đóng popup Sửa bằng icon '×' -> dữ liệu gốc giữ nguyên", async () => {
    await openEditScoreTablePopup(page, BASE);
    await fillScoreTableForm(page, { name: `${BASE}-should-not-save-x` });
    await closeScoreTablePopupByIcon(page);
    await expect(page.locator(po.tableRowSelector, { hasText: BASE })).toBeVisible();
  });

  test("EDIT-08: vị trí trong danh sách không đổi sau khi Sửa bảng điểm không phải mới nhất", async () => {
    await createScoreTable(page, { name: ORDER_A });
    await createScoreTable(page, { name: ORDER_B });
    await createScoreTable(page, { name: ORDER_C });
    const beforeNames = await readAllScoreTableNamesInOrder(page);
    const beforeIdxB = beforeNames.indexOf(ORDER_B);
    expect(beforeIdxB).toBeGreaterThanOrEqual(0);

    await openEditScoreTablePopup(page, ORDER_B);
    await fillScoreTableForm(page, { description: "đã sửa mô tả" });
    await saveScoreTablePopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const afterNames = await readAllScoreTableNamesInOrder(page);
    expect(afterNames.indexOf(ORDER_B)).toBe(beforeIdxB);
    // C (tạo sau B) vẫn phải đứng trước B - B không nhảy lên đầu
    expect(afterNames.indexOf(ORDER_C)).toBeLessThan(afterNames.indexOf(ORDER_B));
  });

  test.skip(
    "EDIT-09: Bảng điểm vừa gắn Đề thi đã công khai vừa gắn Đề thi chưa công khai - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "EDIT-10: sửa Dạng quy đổi sang giá trị khác - BỎ QUA: hệ thống hiện chỉ có đúng 1 giá trị 'Phổ thông', chưa có giá trị thứ 2 để test",
    () => {},
  );
});
