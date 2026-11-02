import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { loginForPracticeTestSpec } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestSpecSetup.js";
import { listClassFilterOptions, filterByClass } from "../../../../automation/giao_bai_tap/navigation/teacherAssignedListPageObjects.js";
import {
  gotoPracticeTestList,
  realDataRows,
  practiceTestListPageObjects as po,
} from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestListPageObjects.js";

/**
 * Playwright Test THẬT cho nhóm "3. Lọc theo lớp" (FILTER-CLASS-01..04, TESTCASES.xlsx tab "Giao
 * đề luyện tập") - chuyển thể 1:1 từ runtime/filterByClassFlow.js (ĐÃ XÁC NHẬN THẬT PASS). CHỈ ĐỌC.
 */
async function readAssignedClassNames(page) {
  await page.getByText("Lớp phụ trách", { exact: false }).first().click();
  await page.getByText("Lớp phụ trách", { exact: true }).first().waitFor({ timeout: 15000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  // ĐÃ XÁC NHẬN THẬT: mỗi lớp là 1 heading <h3> trên toàn trang (KHÔNG scope "main" - không khớp,
  // xem filterByClassFlow.js gốc) - chờ hẳn ≥1 h3 trước khi đọc (tránh race lúc trang chưa fetch
  // xong).
  await page.locator("h3").first().waitFor({ timeout: 15000 });
  const headings = await page.locator("h3").allInnerTexts();
  return headings.map((t) => t.trim()).filter(Boolean);
}

test.describe.serial('"Giao đề luyện tập" > Lọc theo lớp (FILTER-CLASS-01..04)', () => {
  let context;
  let page;
  let classOptions;
  let classesWithData;
  let targetClass;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await loginForPracticeTestSpec(browser));
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test("FILTER-CLASS-01: danh sách lớp trong dropdown đúng phân công năm học hiện tại", async () => {
    const assignedClassNames = await readAssignedClassNames(page);
    await gotoPracticeTestList(page);
    classOptions = await listClassFilterOptions(page);
    const realOptions = classOptions.filter((c) => c !== "Tất cả các lớp");
    expect(new Set(realOptions)).toEqual(new Set(assignedClassNames));
  });

  test("setup: đọc lớp nào đang có dữ liệu ở view mặc định (không phải case, chuẩn bị cho CLASS-02)", async () => {
    classesWithData = new Set(await realDataRows(page).evaluateAll((rows) => rows.map((r) => r.querySelectorAll("td")[0]?.innerText.trim())));
    const realOptions = classOptions.filter((c) => c !== "Tất cả các lớp");
    targetClass = realOptions.find((c) => classesWithData.has(c)) || realOptions[0];
  });

  test("FILTER-CLASS-02: chọn 1 lớp cụ thể lọc đúng dữ liệu", async () => {
    await filterByClass(page, targetClass);
    const classValues = await realDataRows(page).evaluateAll((rows) => rows.map((r) => r.querySelectorAll("td")[0]?.innerText.trim() ?? ""));
    for (const c of classValues) expect(c).toBe(targetClass);
  });

  test('FILTER-CLASS-03: chọn lại "Tất cả các lớp" khôi phục danh sách đầy đủ', async () => {
    await filterByClass(page, "Tất cả các lớp");
    const classValues = await realDataRows(page).evaluateAll((rows) => rows.map((r) => r.querySelectorAll("td")[0]?.innerText.trim() ?? ""));
    const distinctClasses = new Set(classValues);
    if (classOptions.length > 2) {
      expect(distinctClasses.size, `Chọn lại "Tất cả các lớp" nhưng vẫn chỉ còn 1 lớp ("${[...distinctClasses]}").`).toBeGreaterThan(1);
    }
  });

  test("FILTER-CLASS-04: lọc 1 lớp không có đề luyện tập nào trong khoảng đang lọc", async () => {
    // KHÔNG dùng `classesWithData` (chỉ trang 1 của view mặc định) để suy ra lớp "rỗng" - danh sách
    // có phân trang, 1 lớp có thể có dữ liệu ở trang 2/3 dù không thấy ở trang 1 (SAI THẬT đã gặp ở
    // runtime/filterByClassFlow.js). Lọc THẬT từng lớp tới khi gặp lớp 0 dòng.
    const realOptions = classOptions.filter((c) => c !== "Tất cả các lớp");
    let emptyClass = null;
    for (const candidate of realOptions) {
      await filterByClass(page, candidate);
      const count = await realDataRows(page).count();
      if (count === 0) {
        emptyClass = candidate;
        break;
      }
    }
    test.skip(!emptyClass, "Đã lọc thử lần lượt toàn bộ lớp trong dropdown, lớp nào cũng có ≥1 dòng trong khoảng filter mặc định - không có lớp nào để test case rỗng.");
    await expect(page.getByText(po.listHeadingPrefix, { exact: false }).first()).toContainText("(0)");
    await filterByClass(page, "Tất cả các lớp");
  });
});
