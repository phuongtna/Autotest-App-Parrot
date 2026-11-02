import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { loginForPracticeTestSpec } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestSpecSetup.js";
import { widenDateRangeFilter } from "../../../../automation/giao_bai_tap/navigation/teacherAssignedListPageObjects.js";
import {
  gotoPracticeTestList,
  openRowEdit,
  realDataRows,
  searchByItemName,
} from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestListPageObjects.js";

/**
 * Playwright Test THẬT cho nhóm "6. Hiển thị cột Hạn nộp & Điểm TB" (TABLE-01..11, TESTCASES.xlsx
 * tab "Giao đề luyện tập") - chuyển thể 1:1 từ runtime/tableColumnsFlow.js (ĐÃ XÁC NHẬN THẬT PASS).
 * CHỈ ĐỌC.
 *
 * TABLE-07/09/10/11 SKIP - GIỮ NGUYÊN "Pending" như bản test tay gốc (cột ghi chú TESTCASES.xlsx:
 * "App chưa có để check được") - xem docblock runtime/tableColumnsFlow.js để biết lý do đầy đủ.
 */
function parseDdMmYyyy(value) {
  const [dd, mm, yyyy] = value.split("/").map(Number);
  return new Date(yyyy, mm - 1, dd);
}
function daysBetween(a, b) {
  return Math.round((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
}
function todayAtMidnight() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

async function readAllRowsWithCells(page, { maxPages = 20 } = {}) {
  const page1Button = page.locator("button").filter({ hasText: /^1$/ });
  if (await page1Button.count()) {
    await page1Button.first().click();
    await page.waitForTimeout(500);
    await page.waitForLoadState("networkidle").catch(() => {});
  }
  const all = [];
  for (let pageIndex = 1; pageIndex <= maxPages; pageIndex++) {
    const rows = await realDataRows(page).evaluateAll((trs) =>
      trs.map((r) => {
        const cells = r.querySelectorAll("td");
        return {
          className: cells[0]?.innerText.trim() ?? "",
          title: cells[1]?.innerText.trim() ?? "",
          dueDateCellText: cells[2]?.innerText.trim() ?? "",
          doneCountText: cells[3]?.innerText.trim() ?? "",
        };
      }),
    );
    all.push(...rows);
    const nextPageButton = page.locator("button").filter({ hasText: new RegExp(`^${pageIndex + 1}$`) });
    if (!(await nextPageButton.count())) break;
    await nextPageButton.click();
    await page.waitForTimeout(500);
    await page.waitForLoadState("networkidle").catch(() => {});
  }
  return all;
}

test.describe.serial('"Giao đề luyện tập" > Hiển thị cột Hạn nộp & Điểm TB (TABLE-01..11)', () => {
  let context;
  let page;
  let rows;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await loginForPracticeTestSpec(browser));
    await gotoPracticeTestList(page);
    await widenDateRangeFilter(page);
    rows = await readAllRowsWithCells(page);
    expect(rows.length, "Danh sách rỗng - không có dữ liệu để verify các cột.").toBeGreaterThan(0);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('TABLE-01: cột "Lớp" hiển thị đúng tên lớp được giao', async () => {
    // Dùng search để đưa đúng dòng cần test về trang 1 (dữ liệu có thể nằm ở bất kỳ trang nào).
    await searchByItemName(page, rows[0].title);
    const row = page.locator("table tbody tr").filter({ hasText: rows[0].title }).first();
    await openRowEdit(page, row);
    // ĐÃ XÁC NHẬN THẬT: mọi checkbox "Giao tới lớp" đều disabled trên trang edit, lớp ĐÃ giao có
    // thêm class active riêng (ring-1/ring-primary).
    const activeLabel = page.locator("label span.ring-1, label span.ring-primary").first();
    await expect(activeLabel).toHaveCount(1);
    await expect(activeLabel).toHaveText(rows[0].className);
    await page.goBack({ waitUntil: "networkidle" }).catch(() => {});
    await gotoPracticeTestList(page);
    await widenDateRangeFilter(page);
  });

  test('TABLE-02: cột "Đề luyện tập" hiển thị đủ tên, không cắt chữ khi tên dài', async () => {
    const longest = rows.reduce((a, b) => (b.title.length > a.title.length ? b : a), rows[0]);
    expect(longest.title.includes("…") || longest.title.endsWith("...")).toBe(false);

    await searchByItemName(page, longest.title);
    const cellHandle = page.locator("table tbody tr").filter({ hasText: longest.title }).first().locator("td").nth(1);
    const overflow = await cellHandle.evaluate((td) => {
      const inner = td.querySelector(".line-clamp-2") || td.firstElementChild;
      return { scrollHeight: inner.scrollHeight, clientHeight: inner.clientHeight };
    });
    expect(
      overflow.scrollHeight,
      `Tên đề dài nhất ("${longest.title}") bị CẮT MẤT nội dung do CSS line-clamp-2 (scrollHeight=${overflow.scrollHeight} > clientHeight=${overflow.clientHeight}).`,
    ).toBeLessThanOrEqual(overflow.clientHeight + 2);
  });

  test('TABLE-03: cột "Hạn nộp" hiển thị đúng ngày (dd/mm/yyyy) kèm nhãn trạng thái', async () => {
    const datePattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const labelPattern = /^(Còn \d+ ngày|Đến hạn|Quá hạn|Chưa giao)$/i;
    for (const r of rows) {
      const lines = r.dueDateCellText.split("\n").map((l) => l.trim()).filter(Boolean);
      expect(lines.length, `"${r.dueDateCellText}"`).toBeGreaterThanOrEqual(2);
      expect(datePattern.test(lines[0]), `"${lines[0]}"`).toBe(true);
      expect(labelPattern.test(lines[lines.length - 1]), `"${lines[lines.length - 1]}"`).toBe(true);
    }
  });

  test('TABLE-04: nhãn "CÒN X NGÀY" hiển thị đúng số ngày còn lại', async () => {
    const today = todayAtMidnight();
    for (const r of rows) {
      const lines = r.dueDateCellText.split("\n").map((l) => l.trim()).filter(Boolean);
      const label = lines[lines.length - 1];
      const match = /^Còn (\d+) ngày$/i.exec(label);
      if (!match) continue;
      const realDiff = daysBetween(parseDdMmYyyy(lines[0]), today);
      expect(Number(match[1]), `"${r.title}" hạn nộp ${lines[0]} - nhãn ghi ${match[1]} ngày, thật ${realDiff} ngày.`).toBe(realDiff);
    }
  });

  test('TABLE-05: nhãn "QUÁ HẠN" hiển thị đúng khi đã qua hạn nộp', async () => {
    const today = todayAtMidnight();
    for (const r of rows) {
      const lines = r.dueDateCellText.split("\n").map((l) => l.trim()).filter(Boolean);
      if (!/^Quá hạn$/i.test(lines[lines.length - 1])) continue;
      expect(daysBetween(parseDdMmYyyy(lines[0]), today), `"${r.title}" gắn "QUÁ HẠN" nhưng hạn nộp ${lines[0]} không ở quá khứ.`).toBeLessThan(0);
    }
  });

  test('TABLE-06: nhãn "ĐẾN HẠN" hiển thị đúng khi hạn nộp = hôm nay', async () => {
    const today = todayAtMidnight();
    for (const r of rows) {
      const lines = r.dueDateCellText.split("\n").map((l) => l.trim()).filter(Boolean);
      if (!/^Đến hạn$/i.test(lines[lines.length - 1])) continue;
      expect(daysBetween(parseDdMmYyyy(lines[0]), today), `"${r.title}" gắn "ĐẾN HẠN" nhưng hạn nộp ${lines[0]} không phải hôm nay.`).toBe(0);
    }
  });

  test('TABLE-07: cột "HS đã làm" hiển thị đúng định dạng "x/y"', async () => {
    test.skip(true, 'App chưa có để check được (cần biết sĩ số lớp thật tại thời điểm xem) - giữ nguyên "Pending" như test tay gốc.');
  });

  test('TABLE-08: cột "HS đã làm" = "0/y" khi chưa có HS nào làm bài', async () => {
    const zeroPrefixedButMalformed = rows.filter((r) => r.doneCountText.startsWith("0") && !/^0\/\d+$/.test(r.doneCountText));
    expect(zeroPrefixedButMalformed, JSON.stringify(zeroPrefixedButMalformed)).toEqual([]);
    const anyZero = rows.some((r) => /^0\/\d+$/.test(r.doneCountText));
    test.skip(!anyZero, 'Không có dòng nào đang ở trạng thái "0/y" trong dữ liệu thật hiện tại.');
  });

  test('TABLE-09: cột "Điểm TB" hiển thị đúng điểm trung bình, đúng quy tắc làm tròn', async () => {
    test.skip(true, 'App chưa có để check được (cần đối chiếu công thức thật qua API) - giữ nguyên "Pending" như test tay gốc.');
  });

  test('TABLE-10: cột "Điểm TB" không lỗi khi chưa có HS nào nộp bài (0/y)', async () => {
    test.skip(true, 'App chưa có để check được (cần ground-truth qua API) - giữ nguyên "Pending" như test tay gốc.');
  });

  test('TABLE-11: [REGRESSION] "Điểm TB" không bị tính sai khi HS làm lại nhiều lần', async () => {
    test.skip(true, 'Cần API discovery tương đương verifyAverageScoreFlow.js cho domain "đề luyện tập" (CHƯA có) - giữ nguyên "Pending" như test tay gốc.');
  });
});
