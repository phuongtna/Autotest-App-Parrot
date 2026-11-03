import { test, expect } from "../../../../automation/quan_ly_ky_thi/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsKyThiPageObjects as po,
  gotoKyThi,
  createKyThi,
  openDeleteConfirm,
  confirmDelete,
  cancelDeleteConfirm,
  deleteKyThiByName,
  readDialogText,
  readTotalRecordsText,
  kyThiRow,
} from "../../../../automation/quan_ly_ky_thi/navigation/cmsKyThiPageObjects.js";

/**
 * Nhóm "4. Xóa Kỳ thi" (DEL-01..06) - xem ghi chú chung (env dev, tiền tố AUTO-) tại
 * `ky-thi-list.spec.js`.
 *
 * AC quy định: cho phép xóa Kỳ thi khi CHƯA gắn vào Đề thi nào; một khi đã gắn (không phân biệt
 * Công khai hay chưa) thì KHÔNG cho phép xóa - KHÁC Section (vẫn cho xóa nếu đề chỉ chưa công
 * khai) nhưng GIỐNG Bảng điểm (chặn tuyệt đối một khi đã gắn).
 *
 * DEL-02/03/06 BỎ QUA (`test.skip`) - cần gắn Kỳ thi vào 1 Đề thi (màn "Ngân hàng đề thi", ngoài
 * phạm vi `/exam-prep/exam-types`) để tạo đúng tiền điều kiện rule chặn xóa. `TESTCASES.md`/
 * `qlykythi.xlsx` ghi nhận các case này đã chạy tay Pass - tự động hoá đầy đủ cần thêm
 * `automation/ngan_hang_de_thi/` (ngoài phạm vi yêu cầu lần này).
 *
 * `deleteDialogTitle`/`deleteConfirmText()` ĐÃ XÁC NHẬN THẬT qua chạy test thật trên dev
 * (2026-11-03) - xem comment đầu `cmsKyThiPageObjects.js`.
 */
const runId = `AUTO-${Date.now().toString(36)}`;

test.describe.serial("Quản lý kỳ thi - 4. Xóa Kỳ thi (DEL-01..06)", () => {
  let context;
  let page;
  let baseUrl;

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
  });

  test.afterAll(async () => {
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

  test.skip(
    "DEL-02: xóa Kỳ thi đã gắn Đề thi CHƯA công khai - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "DEL-03: xóa Kỳ thi đã gắn Đề thi ĐÃ công khai - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );

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

  test.skip(
    "DEL-06: Kỳ thi từng gắn Đề thi nhưng Đề thi đó sau đó bị xóa/gỡ gắn -> cho phép xóa lại bình thường - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
});
