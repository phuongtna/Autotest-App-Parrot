import { test, expect } from "../../../../automation/quan_ly_section/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsSectionPageObjects as po,
  gotoSections,
  createSection,
  openDeleteConfirm,
  confirmDelete,
  cancelDeleteConfirm,
  deleteSectionByName,
  readDialogText,
  readTotalRecordsText,
  sectionRow,
} from "../../../../automation/quan_ly_section/navigation/cmsSectionPageObjects.js";

/**
 * Nhóm "4. Xóa Section" (DEL-01..07) - xem ghi chú chung (env dev, tiền tố AUTO-) tại
 * `section-list.spec.js`.
 *
 * DEL-02/03/04/06 BỎ QUA (`test.skip`) - cần gắn Section vào 1 Đề thi/Kỳ thi (màn "Ngân hàng đề
 * thi"/"Quản lý kỳ thi", ngoài phạm vi `/exam-prep/sections`) để tạo đúng tiền điều kiện rule chặn
 * xóa khi "Đề thi đã Công khai". `TESTCASES.md` ghi nhận các case này đã chạy tay Pass (2026-10-19).
 */
const SECTION_ENV = process.env.QUAN_LY_SECTION_ENV || "dev";
const runId = `AUTO-${Date.now().toString(36)}`;

test.describe.serial("Quản lý Section - 4. Xóa Section (DEL-01..07)", () => {
  let context;
  let page;
  let baseUrl;

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

  test.skip(
    "DEL-02: xóa Section đã gắn Đề thi CHƯA Công khai - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "DEL-03: xóa Section đã gắn Đề thi ĐÃ Công khai - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "DEL-04: xóa Section đang gắn vào Kỳ thi - BỎ QUA: cần màn Quản lý kỳ thi (ngoài phạm vi)",
    () => {},
  );

  test("DEL-05: Hủy ở popup xác nhận xóa -> Section không bị xóa", async () => {
    const name = `${runId}-del05`;
    await createSection(page, { name, skill: "Nghe" });
    await openDeleteConfirm(page, name);
    await cancelDeleteConfirm(page);
    await expect(sectionRow(page, name)).toBeVisible();
    await deleteSectionByName(page, name);
  });

  test.skip(
    "DEL-06: Section vừa gắn Đề thi đã công khai vừa gắn Đề thi chưa công khai - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );

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
