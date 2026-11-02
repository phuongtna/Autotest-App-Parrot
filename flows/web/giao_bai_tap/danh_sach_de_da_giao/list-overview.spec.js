import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { loginForPracticeTestSpec } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestSpecSetup.js";
import {
  gotoPracticeTestList,
  openCreatePracticeTest,
  practiceTestListPageObjects as po,
} from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestListPageObjects.js";

/**
 * Playwright Test THẬT (`cd automation && npx playwright test
 * --config=playwright.giao-de-luyen-tap.config.js`, hoặc `npm run test-giao-de-luyen-tap-pw`) cho
 * nhóm "1. Hiển thị danh sách & tổng quan" (LIST-01..05, nguồn TESTCASES.xlsx tab "Giao đề luyện
 * tập") - chuyển thể 1:1 từ automation/giao_bai_tap/giao_de_luyen_tap/runtime/listOverviewFlow.js
 * (ĐÃ XÁC NHẬN THẬT PASS 5/5 qua bản `*.mjs` CLI trước khi chuyển sang `.spec.js`) sang dạng
 * `test()`/`expect()` chuẩn Playwright, cùng quy ước với kho_bai_tap_ca_nhan/*.spec.js.
 *
 * CHỈ ĐỌC (trừ LIST-05 chỉ điều hướng, không submit). Chạy trên DEV (tài khoản/host CỐ ĐỊNH - xem
 * docblock navigation/practiceTestListPageObjects.js).
 */
const EXPECTED_COLUMNS = ["Lớp", "Đề luyện tập", "Hạn nộp", "HS đã làm", "Điểm TB", "Hành động"];

/** Đếm tổng số dòng <tr> TRÊN TẤT CẢ các trang - label "(n)" tính trên toàn bộ danh sách, không chỉ
 * trang hiện tại (ĐÃ XÁC NHẬN THẬT: label "(66)" nhưng 1 trang chỉ hiển thị 30 dòng, có 3 trang). */
async function countRowsAcrossAllPages(page, { maxPages = 20 } = {}) {
  const page1Button = page.locator("button").filter({ hasText: /^1$/ });
  if (await page1Button.count()) {
    await page1Button.first().click();
    await page.waitForTimeout(500);
    await page.waitForLoadState("networkidle").catch(() => {});
  }
  let total = 0;
  for (let pageIndex = 1; pageIndex <= maxPages; pageIndex++) {
    total += await page.locator("table tbody tr").count();
    const nextPageButton = page.locator("button").filter({ hasText: new RegExp(`^${pageIndex + 1}$`) });
    if (!(await nextPageButton.count())) break;
    await nextPageButton.click();
    await page.waitForTimeout(500);
    await page.waitForLoadState("networkidle").catch(() => {});
  }
  return total;
}

function parseCountFromHeading(headingText) {
  const match = /\((\d+)\)/.exec(headingText);
  expect(match, `Không đọc được số lượng (n) trong heading: "${headingText}".`).not.toBeNull();
  return Number(match[1]);
}

test.describe.serial('"Giao đề luyện tập" > Hiển thị danh sách & tổng quan (LIST-01..05)', () => {
  let context;
  let page;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await loginForPracticeTestSpec(browser));
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test("LIST-01: vào tab hiển thị đúng màn (tab highlight, nút tạo, search, dropdown, cột bảng)", async () => {
    await gotoPracticeTestList(page);

    await expect(page.getByRole("tab", { name: po.tabs.practiceTab })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: po.createButton, exact: true })).toBeVisible();
    await expect(page.getByText(po.listHeadingPrefix, { exact: false }).first()).toBeVisible();
    await expect(page.getByPlaceholder(po.searchPlaceholder)).toBeVisible();
    await expect(page.getByRole("combobox")).toHaveCount(2);

    // ĐÃ XÁC NHẬN THẬT: header <th> hiển thị HOA do CSS `uppercase` - so sánh không phân biệt
    // hoa/thường (xem listOverviewFlow.js gốc).
    const headerTexts = (await page.locator("table thead th").allInnerTexts()).map((t) => t.trim().toLocaleUpperCase("vi"));
    for (const col of EXPECTED_COLUMNS) {
      expect(headerTexts, `Thiếu cột "${col}" - header thật: ${JSON.stringify(headerTexts)}.`).toContain(col.toLocaleUpperCase("vi"));
    }
  });

  test("LIST-02: giá trị mặc định 2 dropdown lọc (Tất cả các lớp / 2 tuần gần nhất)", async () => {
    await expect(page.getByRole("combobox").first()).toHaveText("Tất cả các lớp");
    await expect(page.getByRole("combobox").last()).toHaveText("2 tuần gần nhất");
  });

  let totalRowsAcrossPages;
  test("LIST-03: label số lượng khớp đúng số dòng đang hiển thị (đếm trên mọi trang)", async () => {
    const headingText = await page.getByText(po.listHeadingPrefix, { exact: false }).first().innerText();
    const labelCount = parseCountFromHeading(headingText);
    totalRowsAcrossPages = await countRowsAcrossAllPages(page);
    expect(totalRowsAcrossPages, `Label ghi "(${labelCount})" nhưng đếm thật trên mọi trang = ${totalRowsAcrossPages}.`).toBe(labelCount);
  });

  test("LIST-04: label số lượng tự cập nhật khi đổi bộ lọc lớp", async () => {
    const trigger = page.getByRole("combobox").first();
    await trigger.click();
    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible();
    const options = (await listbox.getByRole("option").allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    const realClasses = options.filter((c) => c !== "Tất cả các lớp");
    expect(realClasses.length, "Dropdown lọc lớp không có lớp thật nào để test đổi filter.").toBeGreaterThan(0);

    await listbox.getByRole("option", { name: realClasses[0], exact: true }).click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(500);

    const headingText = await page.getByText(po.listHeadingPrefix, { exact: false }).first().innerText();
    const labelCount = parseCountFromHeading(headingText);
    const actualCount = await countRowsAcrossAllPages(page);
    expect(labelCount, `Sau khi lọc lớp "${realClasses[0]}", label ghi "(${labelCount})" nhưng đếm thật = ${actualCount}.`).toBe(actualCount);
    expect(
      labelCount,
      `Label KHÔNG đổi sau khi lọc lớp "${realClasses[0]}" (vẫn = ${labelCount}, giống lúc chưa lọc).`,
    ).not.toBe(totalRowsAcrossPages);

    // Khôi phục "Tất cả các lớp" để không ảnh hưởng case sau.
    await trigger.click();
    await expect(listbox).toBeVisible();
    await listbox.getByRole("option", { name: "Tất cả các lớp", exact: true }).click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(500);
  });

  test('LIST-05: nút "+ Giao đề luyện tập" mở đúng màn tạo mới', async () => {
    await openCreatePracticeTest(page);
    await expect(page).toHaveURL(/\/teacher\/exercise\/practice\/add/);
  });
});
