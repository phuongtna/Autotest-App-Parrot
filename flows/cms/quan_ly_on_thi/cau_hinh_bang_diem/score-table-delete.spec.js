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

/**
 * Nhóm "4. Xóa Bảng điểm" (DEL-01..06) - xem ghi chú chung (env dev, tiền tố AUTO-) tại
 * `score-table-list.spec.js`.
 *
 * KHÁC VỚI Section: AC quy định hễ Bảng điểm đã gắn vào BẤT KỲ Đề thi nào (công khai HAY chưa công
 * khai) thì đều KHÔNG cho phép xóa (rule chặt hơn rule Xóa Section). DEL-02/03/06 BỎ QUA
 * (`test.skip`) - cần gắn Bảng điểm vào 1 Đề thi ở màn "Ngân hàng đề thi" (ngoài phạm vi
 * `/exam-prep/score-tables`) để tạo đúng tiền điều kiện - `cauhinhbangdiem.xlsx` ghi nhận các case
 * này đã chạy tay Pass (2026-11-03).
 */
const runId = `AUTO-${Date.now().toString(36)}`;

test.describe.serial("Cấu hình bảng điểm - 4. Xóa Bảng điểm (DEL-01..06)", () => {
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
  });

  test.afterAll(async () => {
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

  test.skip(
    "DEL-02: xóa Bảng điểm đã gắn Đề thi CHƯA công khai - KHÔNG cho phép - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "DEL-03: xóa Bảng điểm đã gắn Đề thi ĐÃ công khai - KHÔNG cho phép - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );

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

  test.skip(
    "DEL-06: Bảng điểm đã từng gắn Đề thi nhưng Đề thi đó sau đó bị xóa/gỡ gắn -> cho phép xóa bình thường - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
});
