import { test, expect } from "../../../../automation/quan_ly_ky_thi/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsKyThiPageObjects as po,
  gotoKyThi,
  createKyThi,
  searchKyThi,
  clearSearch,
  readAllKyThiNamesInOrder,
  readTotalRecordsText,
  readActivePageNumber,
  readPageNumbersAvailable,
  clickPrevPage,
  clickNextPage,
  isPrevPageDisabled,
  isNextPageDisabled,
  gotoPageNumber,
  setPageSize,
  deleteKyThiByName,
} from "../../../../automation/quan_ly_ky_thi/navigation/cmsKyThiPageObjects.js";

/**
 * Nhóm "7. Phân trang danh sách Kỳ thi" (PAGE-01..10) - xem ghi chú chung (env dev, tiền tố
 * AUTO-) tại `ky-thi-list.spec.js`.
 *
 * Toàn bộ case trong file này chạy TRONG PHẠM VI kết quả tìm kiếm theo `runId` (toàn bộ dữ liệu tự
 * tạo, tiền tố `AUTO-<runId>-`) - KHÔNG dựa vào số bản ghi "thật" có sẵn trên dev (có thể thay đổi
 * theo thời gian) để không bao giờ cần đụng/xóa dữ liệu thật khi test phân trang. Mặc định
 * 10/trang - cùng component phân trang (`n-pagination`) đã xác nhận thật ở Section/Bảng điểm.
 *
 * PAGE-01 (xác nhận cơ chế phân trang có tồn tại) gộp luôn vào case đầu tiên của file này (kiểm
 * tra control phân trang hiển thị đúng định dạng) thay vì tách riêng - cùng 1 lần quan sát.
 */
const runId = `AUTOPG${Date.now().toString(36)}`;
const names = Array.from({ length: 11 }, (_, i) => `${runId}-kt${String(i + 1).padStart(2, "0")}`);

test.describe.serial("Quản lý kỳ thi - 7. Phân trang danh sách Kỳ thi (PAGE-01..10)", () => {
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

    await gotoKyThi(page, baseUrl);
  });

  test.afterAll(async () => {
    await gotoKyThi(page, baseUrl);
    await clearSearch(page);
    await searchKyThi(page, runId);
    await setPageSize(page, 100);
    for (let guard = 0; guard < 30; guard += 1) {
      const current = await readAllKyThiNamesInOrder(page);
      const target = current.find((n) => n.includes(runId));
      if (!target) break;
      await deleteKyThiByName(page, target).catch(() => {});
      await page.waitForTimeout(400);
    }
    await context.close();
  });

  test("PAGE-01: control phân trang hiển thị đúng khi danh sách có dữ liệu", async () => {
    await createKyThi(page, { name: names[0] });
    await searchKyThi(page, runId);
    expect(await readPageNumbersAvailable(page)).toEqual([1]);
    await expect(page.locator("text=/^Tổng \\d+ bản ghi$/")).toBeVisible();
  });

  test("PAGE-02: số bản ghi <= page size (10) -> không có nút chuyển trang", async () => {
    expect((await readAllKyThiNamesInOrder(page)).length).toBe(1);
    expect(await readPageNumbersAvailable(page)).toEqual([1]);
    expect(await isNextPageDisabled(page)).toBe(true);
  });

  test("PAGE-03: số bản ghi > page size -> xuất hiện trang kế tiếp, nút ▶ khả dụng", async () => {
    for (let i = 1; i < names.length; i += 1) {
      await createKyThi(page, { name: names[i] });
    }
    await searchKyThi(page, runId);
    const pages = await readPageNumbersAvailable(page);
    expect(pages).toContain(2);
    expect(await isNextPageDisabled(page)).toBe(false);
  });

  test("PAGE-04: chuyển sang trang 2 hiển thị đúng dữ liệu còn lại, STT không reset", async () => {
    await gotoPageNumber(page, 2);
    expect(await readActivePageNumber(page)).toBe(2);
    const rows = page.locator(po.tableRowSelector);
    const count = await rows.count();
    expect(count).toBe(1); // 11 bản ghi, 10/trang -> trang 2 còn đúng 1
    const stt = await rows.first().locator("td").first().innerText();
    expect(stt.trim()).toBe("11"); // đánh số toàn cục, không nhảy về STT 1
  });

  test("PAGE-05: quay lại trang 1 từ trang 2", async () => {
    await clickPrevPage(page);
    expect(await readActivePageNumber(page)).toBe(1);
    expect((await readAllKyThiNamesInOrder(page)).length).toBe(10);
  });

  test("PAGE-06: nút '◀' bị vô hiệu hoá khi đang ở trang đầu", async () => {
    expect(await readActivePageNumber(page)).toBe(1);
    expect(await isPrevPageDisabled(page)).toBe(true);
  });

  test("PAGE-07: nút '▶' bị vô hiệu hoá khi đang ở trang cuối", async () => {
    await clickNextPage(page);
    expect(await readActivePageNumber(page)).toBe(2);
    expect(await isNextPageDisabled(page)).toBe(true);
  });

  test("PAGE-08: đổi số bản ghi/trang (10 -> 20) gộp nhiều bản ghi hơn trên 1 trang", async () => {
    await setPageSize(page, 20);
    expect(await readPageNumbersAvailable(page)).toEqual([1]);
    expect((await readAllKyThiNamesInOrder(page)).length).toBe(11);
    await setPageSize(page, 10); // trả lại mặc định cho các case sau
  });

  test("PAGE-09: tìm kiếm khi đang ở trang 2 -> tự động quay về trang 1", async () => {
    await gotoPageNumber(page, 2);
    expect(await readActivePageNumber(page)).toBe(2);
    await searchKyThi(page, names[0]);
    expect(await readAllKyThiNamesInOrder(page)).toEqual([names[0]]);
    expect(await readActivePageNumber(page)).toBe(1);
    await searchKyThi(page, runId); // trả lại filter đầy đủ cho case sau
  });

  test("PAGE-10: số đếm 'Tổng X bản ghi' luôn phản ánh TOÀN BỘ bản ghi, không chỉ trang hiện tại", async () => {
    await gotoPageNumber(page, 2);
    const rowsOnPage = (await readAllKyThiNamesInOrder(page)).length;
    const total = await readTotalRecordsText(page);
    expect(total).toBe(11);
    expect(total).not.toBe(rowsOnPage);
  });
});
