import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { loginForPracticeTestSpec } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestSpecSetup.js";
import { widenDateRangeFilter } from "../../../../automation/giao_bai_tap/navigation/teacherAssignedListPageObjects.js";
import {
  gotoPracticeTestList,
  realDataRows,
} from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestListPageObjects.js";

/**
 * Playwright Test THẬT cho nhóm "5. Thứ tự sắp xếp danh sách" (SORT-01..03, TESTCASES.xlsx tab
 * "Giao đề luyện tập") - chuyển thể 1:1 từ runtime/sortOrderFlow.js (ĐÃ XÁC NHẬN THẬT PASS). CHỈ
 * ĐỌC, dùng dữ liệu CÓ SẴN thật (mở rộng "1 tháng gần nhất" để tăng khả năng có đủ 3 nhóm).
 */
const GROUP_RANK = { dueSoon: 0, notYetAssigned: 1, overdue: 2 };

function classifyStatusLabel(label) {
  if (/^Đến hạn$/i.test(label)) return { group: "dueSoon", daysLeft: 0 };
  const dueSoonMatch = /^Còn (\d+) ngày$/i.exec(label);
  if (dueSoonMatch) return { group: "dueSoon", daysLeft: Number(dueSoonMatch[1]) };
  if (/^Chưa giao$/i.test(label)) return { group: "notYetAssigned", daysLeft: null };
  if (/^Quá hạn$/i.test(label)) return { group: "overdue", daysLeft: null };
  throw new Error(`Nhãn trạng thái "${label}" không khớp bất kỳ pattern nào đã biết.`);
}

async function readAllRowsInDisplayOrder(page, { maxPages = 20 } = {}) {
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
        return { title: cells[1]?.innerText.trim() ?? "", dueDateCellText: cells[2]?.innerText.trim() ?? "" };
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

test.describe.serial('"Giao đề luyện tập" > Thứ tự sắp xếp danh sách (SORT-01..03)', () => {
  let context;
  let page;
  let classified;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await loginForPracticeTestSpec(browser));
    await gotoPracticeTestList(page);
    await widenDateRangeFilter(page);
    const rawRows = await readAllRowsInDisplayOrder(page);
    expect(rawRows.length, "Danh sách rỗng (kể cả sau khi mở rộng '1 tháng gần nhất').").toBeGreaterThan(0);
    classified = rawRows.map((r) => {
      const lines = r.dueDateCellText.split("\n").map((l) => l.trim()).filter(Boolean);
      const label = lines[lines.length - 1];
      return { ...r, label, ...classifyStatusLabel(label) };
    });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('SORT-01: thứ tự tổng thể sắp đến hạn → chưa giao → quá hạn', async () => {
    const ranks = classified.map((r) => GROUP_RANK[r.group]);
    for (let i = 1; i < ranks.length; i++) {
      expect(
        ranks[i],
        `Thứ tự nhóm SAI tại vị trí ${i}: trước "${classified[i - 1].label}", sau "${classified[i].label}".`,
      ).toBeGreaterThanOrEqual(ranks[i - 1]);
    }
  });

  test('SORT-02: trong nhóm "sắp đến hạn", sắp xếp tăng dần theo hạn nộp', async () => {
    const dueSoonRows = classified.filter((r) => r.group === "dueSoon");
    test.skip(dueSoonRows.length < 2, `Chỉ có ${dueSoonRows.length} dòng trong nhóm "sắp đến hạn" - không đủ để so sánh thứ tự.`);
    for (let i = 1; i < dueSoonRows.length; i++) {
      expect(dueSoonRows[i].daysLeft).toBeGreaterThanOrEqual(dueSoonRows[i - 1].daysLeft);
    }
  });

  test('SORT-03: nhóm "quá hạn" luôn nằm ở cuối bảng', async () => {
    const overdueIndexes = classified.map((r, i) => (r.group === "overdue" ? i : -1)).filter((i) => i >= 0);
    test.skip(overdueIndexes.length === 0, "Không có dòng nào thuộc nhóm 'quá hạn' trong dữ liệu thật hiện tại.");
    const nonOverdueIndexes = classified.map((r, i) => (r.group !== "overdue" ? i : -1)).filter((i) => i >= 0);
    const minOverdueIndex = Math.min(...overdueIndexes);
    const maxNonOverdueIndex = nonOverdueIndexes.length ? Math.max(...nonOverdueIndexes) : -1;
    expect(minOverdueIndex).toBeGreaterThan(maxNonOverdueIndex);
  });
});
