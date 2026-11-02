import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { loginForPracticeTestSpec } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestSpecSetup.js";
import {
  gotoPracticeTestList,
  searchByItemName,
  filterByClass,
  practiceTestListPageObjects as po,
} from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestListPageObjects.js";

/**
 * Playwright Test THẬT cho nhóm "2. Tìm kiếm theo tên đề" (SEARCH-01..06, TESTCASES.xlsx tab "Giao
 * đề luyện tập") - chuyển thể 1:1 từ runtime/searchByNameFlow.js (ĐÃ XÁC NHẬN THẬT PASS 8/8 step
 * qua bản `*.mjs` CLI). CHỈ ĐỌC. Lấy tên 1 dòng CÓ SẴN thật trên trang 1 làm nguồn cho mọi case
 * (không hardcode/không đoán tên đề).
 */
async function readTitlesOnCurrentPage(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("table tbody tr")).map((r) => r.querySelectorAll("td")[1]?.innerText.trim() ?? ""),
  );
}

async function clearSearch(page) {
  const searchBox = page.getByPlaceholder(po.searchPlaceholder);
  await searchBox.fill("");
  await searchBox.press("Enter");
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(500);
}

test.describe.serial('"Giao đề luyện tập" > Tìm kiếm theo tên đề (SEARCH-01..06)', () => {
  let context;
  let page;
  let fullTitle;
  let partialTerm;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await loginForPracticeTestSpec(browser));
    await gotoPracticeTestList(page);

    const count = await page.locator("table tbody tr").count();
    expect(count, "Trang 1 không có dòng nào để lấy tên thật cho test search.").toBeGreaterThan(0);
    fullTitle = (await page.locator("table tbody tr").first().locator("td").nth(1).innerText()).trim();
    expect(fullTitle).not.toBe("");

    const words = fullTitle.split(/\s+/).filter(Boolean);
    partialTerm = words.length >= 2 ? words.slice(0, 2).join(" ") : fullTitle.slice(0, Math.max(3, Math.ceil(fullTitle.length / 2)));
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test("SEARCH-01: tìm kiếm khớp chính xác tên đề", async () => {
    await searchByItemName(page, fullTitle);
    const titles = await readTitlesOnCurrentPage(page);
    expect(titles.length, `Search chính xác "${fullTitle}" trả về 0 kết quả.`).toBeGreaterThan(0);
    for (const t of titles) expect(t).toBe(fullTitle);
  });

  test("SEARCH-02: tìm kiếm tương đối (khớp 1 phần tên)", async () => {
    await searchByItemName(page, partialTerm);
    const titles = await readTitlesOnCurrentPage(page);
    expect(titles.length, `Search 1 phần "${partialTerm}" trả về 0 kết quả.`).toBeGreaterThan(0);
    const normalizedTerm = partialTerm.toLocaleLowerCase("vi");
    for (const t of titles) expect(t.toLocaleLowerCase("vi")).toContain(normalizedTerm);
  });

  test("SEARCH-03: tìm kiếm không phân biệt hoa/thường", async () => {
    await searchByItemName(page, partialTerm.toLocaleUpperCase("vi"));
    const titlesUpper = await readTitlesOnCurrentPage(page);
    await searchByItemName(page, partialTerm.toLocaleLowerCase("vi"));
    const titlesLower = await readTitlesOnCurrentPage(page);
    expect(titlesUpper).toEqual(titlesLower);
  });

  test("SEARCH-04: tìm kiếm không có kết quả khớp", async () => {
    await searchByItemName(page, "zzzxyz123_khong_ton_tai");
    // ĐÃ XÁC NHẬN THẬT: bảng rỗng vẫn render đúng 1 <tr> thông báo "Không tìm thấy..." (không phải
    // dữ liệu thật) - dùng link "Xem báo cáo" (chỉ có ở dòng dữ liệu thật) để đếm, không đếm <tr>.
    await expect(page.getByText("Xem báo cáo", { exact: true })).toHaveCount(0);
    await expect(page.getByText(po.listHeadingPrefix, { exact: false }).first()).toContainText("(0)");
  });

  test("SEARCH-05: xóa từ khóa trả lại danh sách đầy đủ", async () => {
    await clearSearch(page);
    const titles = await readTitlesOnCurrentPage(page);
    expect(titles.length, "Xóa từ khóa search nhưng danh sách vẫn rỗng.").toBeGreaterThan(0);
    expect(titles).toContain(fullTitle);
  });

  test("SEARCH-06: tìm kiếm kết hợp AND với bộ lọc lớp đang chọn", async () => {
    const originalClass = (await page.locator("table tbody tr").first().locator("td").nth(0).innerText()).trim();
    await filterByClass(page, originalClass);
    await searchByItemName(page, partialTerm);
    const rows = await page.evaluate(() =>
      Array.from(document.querySelectorAll("table tbody tr")).map((r) => ({
        className: r.querySelectorAll("td")[0]?.innerText.trim() ?? "",
        title: r.querySelectorAll("td")[1]?.innerText.trim() ?? "",
      })),
    );
    expect(rows.length, `Kết hợp lọc lớp "${originalClass}" + search "${partialTerm}" trả về 0 dòng.`).toBeGreaterThan(0);
    const normalizedTerm = partialTerm.toLocaleLowerCase("vi");
    for (const r of rows) {
      expect(r.className).toBe(originalClass);
      expect(r.title.toLocaleLowerCase("vi")).toContain(normalizedTerm);
    }
  });
});
