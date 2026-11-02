import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { loginForPracticeTestSpec } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestSpecSetup.js";
import { widenDateRangeFilter, openRowReport } from "../../../../automation/giao_bai_tap/navigation/teacherAssignedListPageObjects.js";
import { gotoPracticeTestList, realDataRows } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestListPageObjects.js";

/**
 * Playwright Test THẬT cho nhóm "7. Hành động Xem báo cáo" (ACTION-01..04, TESTCASES.xlsx tab
 * "Giao đề luyện tập") - chuyển thể 1:1 từ runtime/viewReportFlow.js (ĐÃ XÁC NHẬN THẬT PASS). CHỈ
 * ĐỌC (điều hướng xem report, không sửa/xóa dữ liệu).
 *
 * ACTION-04 SKIP - GIỮ NGUYÊN "Pending" như bản test tay gốc (cần ground-truth ngoài UI).
 */
const REPORT_BREADCRUMB = "Báo cáo chi tiết đề luyện tập";

async function assertReportMatchesRow(page, { className, title }) {
  await expect(page).toHaveURL(/\/teacher\/exercise\/.+\/report/);
  // ĐÃ XÁC NHẬN THẬT: trang report render theo nhiều nhịp riêng biệt (breadcrumb/tên lớp có thể
  // chậm hơn tên đề vài giây, từng thấy placeholder "Lớp học" thay vì tên lớp thật) - poll body text
  // tới khi có đủ cả 3 tín hiệu thay vì đọc ngay sau networkidle.
  await expect(async () => {
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toContain(REPORT_BREADCRUMB);
    expect(bodyText).toContain(title);
    expect(bodyText).toContain(className);
  }).toPass({ timeout: 15000 });
}

async function findRowAcrossPages(page, predicate, { maxPages = 20 } = {}) {
  for (let pageIndex = 1; pageIndex <= maxPages; pageIndex++) {
    const rowsData = await realDataRows(page).evaluateAll((trs) =>
      trs.map((r, i) => {
        const cells = r.querySelectorAll("td");
        return {
          i,
          className: cells[0]?.innerText.trim() ?? "",
          title: cells[1]?.innerText.trim() ?? "",
          dueDateCellText: cells[2]?.innerText.trim() ?? "",
          doneCountText: cells[3]?.innerText.trim() ?? "",
        };
      }),
    );
    const found = rowsData.find(predicate);
    if (found) return found;
    const nextPageButton = page.locator("button").filter({ hasText: new RegExp(`^${pageIndex + 1}$`) });
    if (!(await nextPageButton.count())) return null;
    await nextPageButton.click();
    await page.waitForTimeout(500);
    await page.waitForLoadState("networkidle").catch(() => {});
  }
  return null;
}

test.describe.serial('"Giao đề luyện tập" > Hành động Xem báo cáo (ACTION-01..04)', () => {
  let context;
  let page;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await loginForPracticeTestSpec(browser));
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('ACTION-01: "Xem báo cáo" mở đúng màn chi tiết của đúng lớp trên dòng đó', async () => {
    await gotoPracticeTestList(page);
    const row = realDataRows(page).first();
    const className = (await row.locator("td").nth(0).innerText()).trim();
    const title = (await row.locator("td").nth(1).innerText()).trim();
    await openRowReport(page, row);
    await assertReportMatchesRow(page, { className, title });
  });

  test('ACTION-02: "Xem báo cáo" hoạt động đúng với dòng ở trạng thái "quá hạn"', async () => {
    await gotoPracticeTestList(page);
    await widenDateRangeFilter(page);
    const overdue = await findRowAcrossPages(page, (r) => /Quá hạn/i.test(r.dueDateCellText));
    test.skip(!overdue, 'Không có dòng "QUÁ HẠN" nào trong dữ liệu thật hiện tại (quét hết mọi trang).');
    const row = realDataRows(page).nth(overdue.i);
    await openRowReport(page, row);
    await assertReportMatchesRow(page, { className: overdue.className, title: overdue.title });
  });

  test('ACTION-03: "Xem báo cáo" hoạt động đúng với dòng chưa có HS nào làm bài', async () => {
    await gotoPracticeTestList(page);
    await widenDateRangeFilter(page);
    const zeroDone = await findRowAcrossPages(page, (r) => /^0\/\d+$/.test(r.doneCountText));
    test.skip(!zeroDone, 'Không có dòng "0/y" nào trong dữ liệu thật hiện tại (quét hết mọi trang).');
    const row = realDataRows(page).nth(zeroDone.i);
    await openRowReport(page, row);
    await assertReportMatchesRow(page, { className: zeroDone.className, title: zeroDone.title });

    const totalStudents = Number(/\/(\d+)$/.exec(zeroDone.doneCountText)[1]);
    await expect(page.getByText(`Chưa nộp bài (${totalStudents})`, { exact: true })).toBeVisible();
    await expect(page.getByText("Đã hoàn thành (0)", { exact: true })).toBeVisible();
  });

  test('ACTION-04: "Xem báo cáo" hoạt động đúng với dòng đã có HS làm bài', async () => {
    test.skip(true, 'App chưa có để check được (cần ground-truth ngoài UI về HS nào thật sự đã nộp) - giữ nguyên "Pending" như test tay gốc.');
  });
});
