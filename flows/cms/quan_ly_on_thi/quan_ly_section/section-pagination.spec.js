import { test, expect } from "../../../../automation/quan_ly_section/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsSectionPageObjects as po,
  gotoSections,
  createSection,
  searchSections,
  clearSearch,
  filterBySkill,
  resetSkillFilter,
  readAllSectionNamesInOrder,
  readTotalRecordsText,
  readActivePageNumber,
  readPageNumbersAvailable,
  clickPrevPage,
  clickNextPage,
  isPrevPageDisabled,
  isNextPageDisabled,
  gotoPageNumber,
  setPageSize,
  deleteSectionByName,
} from "../../../../automation/quan_ly_section/navigation/cmsSectionPageObjects.js";

/**
 * Nhóm "7. Phân trang danh sách Section" (PAGE-01..11) - xem ghi chú chung (env dev, tiền tố
 * AUTO-) tại `section-list.spec.js`.
 *
 * Toàn bộ case trong file này chạy TRONG PHẠM VI kết quả tìm kiếm theo `runId` (toàn bộ dữ liệu
 * tự tạo, tiền tố `AUTO-<runId>-`) - KHÔNG dựa vào số bản ghi "thật" có sẵn trên dev (có thể thay
 * đổi theo thời gian) để không bao giờ cần đụng/xóa dữ liệu thật khi test phân trang (đặc biệt
 * PAGE-11 - xóa hết bản ghi ở trang cuối). Mặc định 10/trang (quan sát thật trên dev, 2026-11-03).
 */
const runId = `AUTOPG${Date.now().toString(36)}`;
const listenNames = Array.from({ length: 11 }, (_, i) => `${runId}-listen${String(i + 1).padStart(2, "0")}`);
const readNames = Array.from({ length: 3 }, (_, i) => `${runId}-read${i + 1}`);

test.describe.serial("Quản lý Section - 7. Phân trang danh sách Section (PAGE-01..11)", () => {
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

    await gotoSections(page, baseUrl);
  });

  test.afterAll(async () => {
    await gotoSections(page, baseUrl);
    await clearSearch(page);
    await searchSections(page, runId);
    await setPageSize(page, 100);
    for (let guard = 0; guard < 30; guard += 1) {
      const names = await readAllSectionNamesInOrder(page);
      const target = names.find((n) => n.includes(runId));
      if (!target) break;
      await deleteSectionByName(page, target).catch(() => {});
      await page.waitForTimeout(400);
    }
    await context.close();
  });

  test("PAGE-01: số bản ghi <= page size (10) -> không có nút chuyển trang", async () => {
    await createSection(page, { name: listenNames[0], skill: "Nghe" });
    await searchSections(page, runId);
    const names = await readAllSectionNamesInOrder(page);
    expect(names.length).toBe(1);
    expect(await readPageNumbersAvailable(page)).toEqual([1]);
    expect(await isNextPageDisabled(page)).toBe(true);
  });

  test("PAGE-02: số bản ghi > page size -> xuất hiện trang kế tiếp, nút ▶ khả dụng", async () => {
    for (let i = 1; i < listenNames.length; i += 1) {
      await createSection(page, { name: listenNames[i], skill: "Nghe" });
    }
    await searchSections(page, runId);
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
    expect((await readAllSectionNamesInOrder(page)).length).toBe(10);
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
    expect((await readAllSectionNamesInOrder(page)).length).toBe(11);
    await setPageSize(page, 10); // trả lại mặc định cho các case sau
  });

  test("PAGE-08: tìm kiếm khi đang ở trang 2 -> tự động quay về trang 1", async () => {
    await gotoPageNumber(page, 2);
    expect(await readActivePageNumber(page)).toBe(2);
    await searchSections(page, listenNames[0]);
    const names = await readAllSectionNamesInOrder(page);
    expect(names).toEqual([listenNames[0]]);
    expect(await readActivePageNumber(page)).toBe(1);
    await searchSections(page, runId); // trả lại filter đầy đủ cho case sau
  });

  test("PAGE-09: lọc theo Kỹ năng khi đang ở trang 2 -> tự động quay về trang 1", async () => {
    for (const name of readNames) {
      await createSection(page, { name, skill: "Đọc" });
    }
    await searchSections(page, runId); // 14 bản ghi (11 Nghe + 3 Đọc)
    await gotoPageNumber(page, 2);
    expect(await readActivePageNumber(page)).toBe(2);

    await filterBySkill(page, "Đọc");
    expect(await readActivePageNumber(page)).toBe(1);
    const names = await readAllSectionNamesInOrder(page);
    expect(names.length).toBe(3);
    for (const n of names) expect(readNames).toContain(n);

    await resetSkillFilter(page); // trả lại "Tất cả kỹ năng" cho case sau, vẫn giữ search runId
  });

  test("PAGE-10: số đếm 'Tổng X bản ghi' luôn phản ánh TOÀN BỘ bản ghi, không chỉ trang hiện tại", async () => {
    await gotoPageNumber(page, 2);
    const rowsOnPage = (await readAllSectionNamesInOrder(page)).length;
    const total = await readTotalRecordsText(page);
    expect(total).toBe(14);
    expect(total).not.toBe(rowsOnPage);
  });

  test("PAGE-11: xóa hết bản ghi ở trang cuối -> điều hướng về trang trước đó", async () => {
    expect(await readActivePageNumber(page)).toBe(2);
    const lastPageNames = await readAllSectionNamesInOrder(page);
    expect(lastPageNames.length).toBe(4); // 14 bản ghi, 10/trang -> trang 2 còn 4

    for (const name of lastPageNames) {
      await deleteSectionByName(page, name);
    }

    expect(await readActivePageNumber(page)).toBe(1);
    expect(await readTotalRecordsText(page)).toBe(10);
  });
});
