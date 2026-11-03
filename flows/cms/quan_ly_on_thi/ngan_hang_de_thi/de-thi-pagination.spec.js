import { test, expect } from "../../../../automation/ngan_hang_de_thi/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsDeThiPageObjects as po,
  gotoDeThi,
  createExam,
  setupDeThiFixtures,
  teardownDeThiFixtures,
  searchDeThi,
  clearSearch,
  readAllExamNamesInOrder,
  readTotalRecordsText,
  readActivePageNumber,
  readPageNumbersAvailable,
  clickPrevPage,
  clickNextPage,
  isPrevPageDisabled,
  isNextPageDisabled,
  gotoPageNumber,
  setPageSize,
  deleteDeThiByName,
} from "../../../../automation/ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

/**
 * Nhóm "10. Phân trang" (PAGE-01..10) - xem ghi chú chung tại `de-thi-list.spec.js`.
 *
 * Toàn bộ case chạy TRONG PHẠM VI kết quả tìm kiếm theo `runId` (dữ liệu tự tạo tiền tố
 * `AUTO-<runId>-`) - KHÔNG dựa vào số bản ghi thật có sẵn trên dev, cùng cơ chế đã dùng ở
 * `quan_ly_ky_thi/ky-thi-pagination.spec.js`.
 */
const runId = `AUTOPG${Date.now().toString(36)}`;
const names = Array.from({ length: 11 }, (_, i) => `${runId}-dt${String(i + 1).padStart(2, "0")}`);

test.describe.serial("Ngân hàng đề thi - 10. Phân trang (PAGE-01..10)", () => {
  let context;
  let page;
  let baseUrl;
  let fixtures;

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

    fixtures = await setupDeThiFixtures(page, baseUrl, runId);
    await gotoDeThi(page, baseUrl);
  });

  test.afterAll(async () => {
    await gotoDeThi(page, baseUrl);
    await clearSearch(page);
    await searchDeThi(page, runId);
    await setPageSize(page, 100);
    for (let guard = 0; guard < 30; guard += 1) {
      const current = await readAllExamNamesInOrder(page);
      const target = current.find((n) => n.includes(runId));
      if (!target) break;
      await deleteDeThiByName(page, target).catch(() => {});
      await page.waitForTimeout(400);
    }
    await teardownDeThiFixtures(page, baseUrl, fixtures, []);
    await context.close();
  });

  test("PAGE-01: control phân trang hiển thị đúng khi danh sách có dữ liệu", async () => {
    await createExam(page, { name: names[0], examType: fixtures.examTypeEmpty, grades: ["Lớp 1"] });
    await gotoDeThi(page, baseUrl);
    await searchDeThi(page, runId);
    expect(await readPageNumbersAvailable(page)).toEqual([1]);
    await expect(page.locator("text=/^Tổng \\d+ bản ghi$/")).toBeVisible();
  });

  test("PAGE-02: số bản ghi <= page size (10) -> không có nút chuyển trang", async () => {
    expect((await readAllExamNamesInOrder(page)).length).toBe(1);
    expect(await readPageNumbersAvailable(page)).toEqual([1]);
    expect(await isNextPageDisabled(page)).toBe(true);
  });

  test("PAGE-03: số bản ghi > page size -> xuất hiện trang kế tiếp, nút ▶ khả dụng", async () => {
    for (let i = 1; i < names.length; i += 1) {
      await createExam(page, { name: names[i], examType: fixtures.examTypeEmpty, grades: ["Lớp 1"] });
      await gotoDeThi(page, baseUrl);
    }
    await searchDeThi(page, runId);
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
    expect(stt.trim()).toBe("11");
  });

  test("PAGE-05: quay lại trang 1 từ trang 2", async () => {
    await clickPrevPage(page);
    expect(await readActivePageNumber(page)).toBe(1);
    expect((await readAllExamNamesInOrder(page)).length).toBe(10);
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
    expect((await readAllExamNamesInOrder(page)).length).toBe(11);
    await setPageSize(page, 10);
  });

  test("PAGE-09: tìm kiếm/lọc khi đang ở trang 2 -> tự động quay về trang 1", async () => {
    await gotoPageNumber(page, 2);
    expect(await readActivePageNumber(page)).toBe(2);
    await searchDeThi(page, names[0]);
    expect(await readAllExamNamesInOrder(page)).toEqual([names[0]]);
    expect(await readActivePageNumber(page)).toBe(1);
    await searchDeThi(page, runId);
  });

  test("PAGE-10: số đếm 'Tổng X bản ghi' luôn phản ánh TOÀN BỘ bản ghi, không chỉ trang hiện tại", async () => {
    await gotoPageNumber(page, 2);
    const rowsOnPage = (await readAllExamNamesInOrder(page)).length;
    const total = await readTotalRecordsText(page);
    expect(total).toBe(11);
    expect(total).not.toBe(rowsOnPage);
  });
});
