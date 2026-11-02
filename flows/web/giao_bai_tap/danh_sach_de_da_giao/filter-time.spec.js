import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { loginForPracticeTestSpec } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestSpecSetup.js";
import { widenDateRangeFilter } from "../../../../automation/giao_bai_tap/navigation/teacherAssignedListPageObjects.js";
import { gotoPracticeTestList, realDataRows } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestListPageObjects.js";

/**
 * Playwright Test THẬT cho nhóm "4. Lọc theo thời gian (biên 2 tuần / 1 tháng)" (FILTER-TIME-01..10,
 * TESTCASES.xlsx tab "Giao đề luyện tập") - chuyển thể 1:1 từ runtime/filterByTimeFlow.js (ĐÃ XÁC
 * NHẬN THẬT PASS). CHỈ ĐỌC, KHÔNG fabricate dữ liệu biên - case nào không có dữ liệu thật khớp
 * đúng ngày biên thì SKIP.
 *
 * FILTER-TIME-08/10 (biên NGOÀI "1 tháng gần nhất") LUÔN SKIP - không có bộ lọc nào rộng hơn để
 * quan sát qua UI (xem sheet "Ghi chú & Giả định"; bản test tay gốc cũng để "Doing", chưa "Pass").
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
function rowKey(r) {
  return `${r.className}|${r.title}|${r.dueDateLine}`;
}

async function readAllRowsWithDayDiff(page, { maxPages = 20 } = {}) {
  const page1Button = page.locator("button").filter({ hasText: /^1$/ });
  if (await page1Button.count()) {
    await page1Button.first().click();
    await page.waitForTimeout(500);
    await page.waitForLoadState("networkidle").catch(() => {});
  }
  const today = todayAtMidnight();
  const all = [];
  for (let pageIndex = 1; pageIndex <= maxPages; pageIndex++) {
    const rows = await realDataRows(page).evaluateAll((trs) =>
      trs.map((r) => {
        const cells = r.querySelectorAll("td");
        return { className: cells[0]?.innerText.trim() ?? "", title: cells[1]?.innerText.trim() ?? "", dueDateCellText: cells[2]?.innerText.trim() ?? "" };
      }),
    );
    all.push(
      ...rows.map((r) => {
        const dueDateLine = r.dueDateCellText.split("\n").map((l) => l.trim()).filter(Boolean)[0];
        return { ...r, dueDateLine, dayDiff: daysBetween(parseDdMmYyyy(dueDateLine), today) };
      }),
    );
    const nextPageButton = page.locator("button").filter({ hasText: new RegExp(`^${pageIndex + 1}$`) });
    if (!(await nextPageButton.count())) break;
    await nextPageButton.click();
    await page.waitForTimeout(500);
    await page.waitForLoadState("networkidle").catch(() => {});
  }
  return all;
}

test.describe.serial('"Giao đề luyện tập" > Lọc theo thời gian (FILTER-TIME-01..10)', () => {
  let context;
  let page;
  let twoWeekRows;
  let oneMonthRows;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await loginForPracticeTestSpec(browser));
    await gotoPracticeTestList(page);
    twoWeekRows = await readAllRowsWithDayDiff(page);
    await widenDateRangeFilter(page);
    oneMonthRows = await readAllRowsWithDayDiff(page);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('FILTER-TIME-01: "2 tuần gần nhất" lọc đúng theo hạn nộp (mặc định)', async () => {
    for (const r of twoWeekRows) {
      expect(r.dayDiff, `"${r.title}" hạn nộp ${r.dueDateLine} (${r.dayDiff} ngày) ngoài khoảng [-14,+14].`).toBeGreaterThanOrEqual(-14);
      expect(r.dayDiff).toBeLessThanOrEqual(14);
    }
  });

  test("FILTER-TIME-02: biên dưới hạn nộp = hôm nay − 14 ngày vẫn hiển thị", async () => {
    const match = twoWeekRows.find((r) => r.dayDiff === -14);
    test.skip(!match, "Không có dòng thật nào có hạn nộp đúng -14 ngày trong dữ liệu hiện tại.");
    expect(match).toBeTruthy();
  });

  test("FILTER-TIME-03: ngoài biên dưới hạn nộp = hôm nay − 15 ngày không hiển thị", async () => {
    const widenedOnly = oneMonthRows.filter((r) => !twoWeekRows.some((t) => rowKey(t) === rowKey(r)));
    const match = widenedOnly.find((r) => r.dayDiff === -15);
    test.skip(!match, "Không có dòng thật nào có hạn nộp đúng -15 ngày (chỉ xuất hiện khi mở rộng '1 tháng') trong dữ liệu hiện tại.");
    expect(match).toBeTruthy();
  });

  test("FILTER-TIME-04: biên trên hạn nộp = hôm nay + 14 ngày vẫn hiển thị", async () => {
    const match = twoWeekRows.find((r) => r.dayDiff === 14);
    test.skip(!match, "Không có dòng thật nào có hạn nộp đúng +14 ngày trong dữ liệu hiện tại.");
    expect(match).toBeTruthy();
  });

  test("FILTER-TIME-05: ngoài biên trên hạn nộp = hôm nay + 15 ngày không hiển thị", async () => {
    const widenedOnly = oneMonthRows.filter((r) => !twoWeekRows.some((t) => rowKey(t) === rowKey(r)));
    const match = widenedOnly.find((r) => r.dayDiff === 15);
    test.skip(!match, "Không có dòng thật nào có hạn nộp đúng +15 ngày (chỉ xuất hiện khi mở rộng '1 tháng') trong dữ liệu hiện tại.");
    expect(match).toBeTruthy();
  });

  test('FILTER-TIME-06: chuyển sang "1 tháng gần nhất" mở rộng đúng khoảng lọc', async () => {
    const missing = twoWeekRows.filter((t) => !oneMonthRows.some((r) => rowKey(r) === rowKey(t)));
    expect(missing, `"1 tháng gần nhất" thiếu dòng từ "2 tuần gần nhất": ${JSON.stringify(missing.map((r) => r.title))}.`).toEqual([]);
    for (const r of oneMonthRows) {
      expect(r.dayDiff).toBeGreaterThanOrEqual(-30);
      expect(r.dayDiff).toBeLessThanOrEqual(30);
    }
  });

  test("FILTER-TIME-07: biên dưới hạn nộp = hôm nay − 30 ngày vẫn hiển thị (1 tháng gần nhất)", async () => {
    const match = oneMonthRows.find((r) => r.dayDiff === -30);
    test.skip(!match, "Không có dòng thật nào có hạn nộp đúng -30 ngày trong dữ liệu hiện tại.");
    expect(match).toBeTruthy();
  });

  test("FILTER-TIME-08: ngoài biên dưới hạn nộp = hôm nay − 31 ngày không hiển thị (1 tháng gần nhất)", async () => {
    test.skip(
      true,
      '-31 ngày nằm ngoài cả "1 tháng gần nhất" (bộ lọc rộng nhất hiện có) - không có cách nào quan sát qua UI; bản test tay gốc cũng để "Doing", chưa "Pass".',
    );
  });

  test("FILTER-TIME-09: biên trên hạn nộp = hôm nay + 30 ngày vẫn hiển thị (1 tháng gần nhất)", async () => {
    const match = oneMonthRows.find((r) => r.dayDiff === 30);
    test.skip(!match, "Không có dòng thật nào có hạn nộp đúng +30 ngày trong dữ liệu hiện tại.");
    expect(match).toBeTruthy();
  });

  test("FILTER-TIME-10: ngoài biên trên hạn nộp = hôm nay + 31 ngày không hiển thị (1 tháng gần nhất)", async () => {
    test.skip(true, 'Cùng lý do FILTER-TIME-08 (+31 ngày nằm ngoài "1 tháng gần nhất", không có bộ lọc nào rộng hơn để quan sát qua UI).');
  });
});
