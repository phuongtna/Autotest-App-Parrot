import { test, expect } from "../../../../automation/cau_hinh_bang_diem/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsScoreTablePageObjects as po,
  gotoScoreTables,
  createScoreTable,
  searchScoreTables,
  clearSearch,
  filterByConversion,
  resetConversionFilter,
  readAllScoreTableNamesInOrder,
  readTotalRecordsText,
  readActivePageNumber,
  readPageNumbersAvailable,
  clickPrevPage,
  clickNextPage,
  isPrevPageDisabled,
  isNextPageDisabled,
  gotoPageNumber,
  setPageSize,
  deleteScoreTableByName,
} from "../../../../automation/cau_hinh_bang_diem/navigation/cmsScoreTablePageObjects.js";

/**
 * Nhóm "7. Phân trang danh sách Bảng điểm" (PAGE-01..11) - xem ghi chú chung (env dev, tiền tố
 * AUTO-) tại `score-table-list.spec.js`.
 *
 * Toàn bộ case trong file này chạy TRONG PHẠM VI kết quả tìm kiếm theo `runId` (toàn bộ dữ liệu
 * tự tạo, tiền tố `AUTO-<runId>-`) - KHÔNG dựa vào số bản ghi "thật" có sẵn trên dev - để không bao
 * giờ cần đụng/xóa dữ liệu thật khi test phân trang. Mặc định 10/trang (quan sát thật trên dev,
 * 2026-11-03).
 *
 * PAGE-09 (lọc theo Dạng quy đổi khi đang ở trang 2) ĐIỀU CHỈNH so với case gốc của Section: hệ
 * thống hiện tại chỉ có đúng 1 giá trị Dạng quy đổi ("Phổ thông") nên MỌI bản ghi tự tạo đều cùng
 * giá trị này - không thể tạo tập con khác dạng để lọc ra số lượng ít hơn như Section (Kỹ năng có
 * 4 giá trị). Case được viết lại để xác nhận đúng HÀNH VI cốt lõi (lọc khi đang ở trang 2 -> tự
 * động quay về trang 1) mà không cần tập con - lọc theo "Phổ thông" vẫn khớp toàn bộ 14 bản ghi.
 */
const runId = `AUTOPG${Date.now().toString(36)}`;
const names11 = Array.from({ length: 11 }, (_, i) => `${runId}-item${String(i + 1).padStart(2, "0")}`);
const names3 = Array.from({ length: 3 }, (_, i) => `${runId}-extra${i + 1}`);

test.describe.serial("Cấu hình bảng điểm - 7. Phân trang danh sách Bảng điểm (PAGE-01..11)", () => {
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

    await gotoScoreTables(page, baseUrl);
  });

  test.afterAll(async () => {
    await gotoScoreTables(page, baseUrl);
    await clearSearch(page);
    await searchScoreTables(page, runId);
    await setPageSize(page, 100);
    for (let guard = 0; guard < 30; guard += 1) {
      const names = await readAllScoreTableNamesInOrder(page);
      const target = names.find((n) => n.includes(runId));
      if (!target) break;
      await deleteScoreTableByName(page, target).catch(() => {});
      await page.waitForTimeout(400);
    }
    await context.close();
  });

  test("PAGE-01: số bản ghi <= page size (10) -> không có nút chuyển trang", async () => {
    await createScoreTable(page, { name: names11[0] });
    await searchScoreTables(page, runId);
    const names = await readAllScoreTableNamesInOrder(page);
    expect(names.length).toBe(1);
    expect(await readPageNumbersAvailable(page)).toEqual([1]);
    expect(await isNextPageDisabled(page)).toBe(true);
  });

  test("PAGE-02: số bản ghi > page size -> xuất hiện trang kế tiếp, nút ▶ khả dụng", async () => {
    for (let i = 1; i < names11.length; i += 1) {
      await createScoreTable(page, { name: names11[i] });
    }
    await searchScoreTables(page, runId);
    const pages = await readPageNumbersAvailable(page);
    expect(pages).toContain(2);
    expect(await isNextPageDisabled(page)).toBe(false);
  });

  test("PAGE-03: chuyển sang trang 2 hiển thị đúng dữ liệu còn lại, STT không reset", async () => {
    await gotoPageNumber(page, 2);
    expect(await readActivePageNumber(page)).toBe(2);
    const rows = page.locator(po.tableRowSelector);
    const count = await rows.count();
    expect(count).toBe(1); // 11 bản ghi, 10/trang -> trang 2 còn đúng 1
    const stt = await rows.first().locator("td").first().innerText();
    expect(stt.trim()).toBe("11"); // đánh số toàn cục, không nhảy về STT 1
  });

  test("PAGE-04: quay lại trang 1 từ trang 2", async () => {
    await clickPrevPage(page);
    expect(await readActivePageNumber(page)).toBe(1);
    expect((await readAllScoreTableNamesInOrder(page)).length).toBe(10);
  });

  test("PAGE-05: nút '◀' bị vô hiệu hoá khi đang ở trang đầu", async () => {
    expect(await readActivePageNumber(page)).toBe(1);
    expect(await isPrevPageDisabled(page)).toBe(true);
  });

  test("PAGE-06: nút '▶' bị vô hiệu hoá khi đang ở trang cuối", async () => {
    await clickNextPage(page);
    expect(await readActivePageNumber(page)).toBe(2);
    expect(await isNextPageDisabled(page)).toBe(true);
  });

  test("PAGE-07: đổi số bản ghi/trang (10 -> 20) gộp nhiều bản ghi hơn trên 1 trang", async () => {
    await setPageSize(page, 20);
    expect(await readPageNumbersAvailable(page)).toEqual([1]);
    expect((await readAllScoreTableNamesInOrder(page)).length).toBe(11);
    await setPageSize(page, 10); // trả lại mặc định cho các case sau
  });

  test("PAGE-08: tìm kiếm khi đang ở trang 2 -> tự động quay về trang 1", async () => {
    await gotoPageNumber(page, 2);
    expect(await readActivePageNumber(page)).toBe(2);
    await searchScoreTables(page, names11[0]);
    const names = await readAllScoreTableNamesInOrder(page);
    expect(names).toEqual([names11[0]]);
    expect(await readActivePageNumber(page)).toBe(1);
    await searchScoreTables(page, runId); // trả lại filter đầy đủ cho case sau
  });

  test("PAGE-09: lọc theo Dạng quy đổi khi đang ở trang 2 -> tự động quay về trang 1", async () => {
    for (const name of names3) {
      await createScoreTable(page, { name });
    }
    await searchScoreTables(page, runId); // 14 bản ghi
    await gotoPageNumber(page, 2);
    expect(await readActivePageNumber(page)).toBe(2);

    await filterByConversion(page, "Phổ thông");
    expect(await readActivePageNumber(page)).toBe(1);
    expect(await readTotalRecordsText(page)).toBe(14); // mọi bản ghi đều "Phổ thông" -> lọc vẫn khớp toàn bộ

    await resetConversionFilter(page); // trả lại "Tất cả dạng quy đổi" cho case sau, vẫn giữ search runId
  });

  test("PAGE-10: số đếm 'Tổng X bản ghi' luôn phản ánh TOÀN BỘ bản ghi, không chỉ trang hiện tại", async () => {
    await gotoPageNumber(page, 2);
    const rowsOnPage = (await readAllScoreTableNamesInOrder(page)).length;
    const total = await readTotalRecordsText(page);
    expect(total).toBe(14);
    expect(total).not.toBe(rowsOnPage);
  });

  test("PAGE-11: xóa hết bản ghi ở trang cuối -> điều hướng về trang trước đó", async () => {
    expect(await readActivePageNumber(page)).toBe(2);
    const lastPageNames = await readAllScoreTableNamesInOrder(page);
    expect(lastPageNames.length).toBe(4); // 14 bản ghi, 10/trang -> trang 2 còn 4

    for (const name of lastPageNames) {
      await deleteScoreTableByName(page, name);
    }

    expect(await readActivePageNumber(page)).toBe(1);
    expect(await readTotalRecordsText(page)).toBe(10);
  });
});
