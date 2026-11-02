import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { loginForPracticeTestSpec } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestSpecSetup.js";
import { widenDateRangeFilter, filterByClass } from "../../../../automation/giao_bai_tap/navigation/teacherAssignedListPageObjects.js";
import {
  gotoPracticeTestList,
  searchByItemName,
  realDataRows,
  practiceTestListPageObjects as po,
} from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestListPageObjects.js";

/**
 * Playwright Test THẬT cho nhóm "9. Kết hợp nhiều bộ lọc" (COMBO-01..04, TESTCASES.xlsx tab "Giao
 * đề luyện tập") - chuyển thể 1:1 từ runtime/comboFiltersFlow.js (ĐÃ XÁC NHẬN THẬT PASS). CHỈ ĐỌC,
 * dùng 1 dòng CÓ SẴN thật làm nguồn lớp/tên đề/hạn nộp cho mọi tổ hợp.
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
async function readVisibleRows(page) {
  return realDataRows(page).evaluateAll((trs) =>
    trs.map((r) => {
      const cells = r.querySelectorAll("td");
      return { className: cells[0]?.innerText.trim() ?? "", title: cells[1]?.innerText.trim() ?? "", dueDateCellText: cells[2]?.innerText.trim() ?? "" };
    }),
  );
}
function rowDueDate(row) {
  const lines = row.dueDateCellText.split("\n").map((l) => l.trim()).filter(Boolean);
  return parseDdMmYyyy(lines[0]);
}

test.describe.serial('"Giao đề luyện tập" > Kết hợp nhiều bộ lọc (COMBO-01..04)', () => {
  let context;
  let page;
  let baseRow;
  let partialTerm;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await loginForPracticeTestSpec(browser));
    await gotoPracticeTestList(page);
    await widenDateRangeFilter(page);
    const rows = await readVisibleRows(page);
    expect(rows.length, "Danh sách rỗng - không có dữ liệu để test kết hợp bộ lọc.").toBeGreaterThan(0);
    baseRow = rows[0];
    const words = baseRow.title.split(/\s+/).filter(Boolean);
    partialTerm = words.length >= 2 ? words.slice(0, 2).join(" ") : baseRow.title.slice(0, Math.max(3, Math.ceil(baseRow.title.length / 2)));
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test("COMBO-01: kết hợp tìm kiếm + lọc lớp", async () => {
    await filterByClass(page, baseRow.className);
    await searchByItemName(page, partialTerm);
    const rows = await readVisibleRows(page);
    expect(rows.length).toBeGreaterThan(0);
    const normalizedTerm = partialTerm.toLocaleLowerCase("vi");
    for (const r of rows) {
      expect(r.className).toBe(baseRow.className);
      expect(r.title.toLocaleLowerCase("vi")).toContain(normalizedTerm);
    }
  });

  test("COMBO-02: kết hợp tìm kiếm + lọc thời gian", async () => {
    await filterByClass(page, "Tất cả các lớp");
    await widenDateRangeFilter(page);
    await searchByItemName(page, partialTerm);
    const rows = await readVisibleRows(page);
    expect(rows.length).toBeGreaterThan(0);
    const today = todayAtMidnight();
    const normalizedTerm = partialTerm.toLocaleLowerCase("vi");
    for (const r of rows) {
      expect(Math.abs(daysBetween(rowDueDate(r), today))).toBeLessThanOrEqual(30);
      expect(r.title.toLocaleLowerCase("vi")).toContain(normalizedTerm);
    }
  });

  test("COMBO-03: kết hợp lọc lớp + lọc thời gian", async () => {
    await searchByItemName(page, "");
    await filterByClass(page, baseRow.className);
    const rows = await readVisibleRows(page);
    expect(rows.length).toBeGreaterThan(0);
    const today = todayAtMidnight();
    for (const r of rows) {
      expect(r.className).toBe(baseRow.className);
      expect(Math.abs(daysBetween(rowDueDate(r), today))).toBeLessThanOrEqual(30);
    }
  });

  test("COMBO-04a: kết hợp cả 3 bộ lọc không có kết quả thỏa mãn đồng thời", async () => {
    await searchByItemName(page, "zzzxyz123_khong_ton_tai");
    await expect(page.getByText("Xem báo cáo", { exact: true })).toHaveCount(0);
    await expect(page.getByText(po.listHeadingPrefix, { exact: false }).first()).toContainText("(0)");
  });

  test("COMBO-04b: kết hợp cả 3 bộ lọc có kết quả thỏa mãn đồng thời", async () => {
    // Vẫn đang lọc lớp=baseRow.className + "1 tháng gần nhất" từ COMBO-03 - chỉ cần đổi search về
    // đúng partialTerm (khớp cả 3 điều kiện cùng lúc với dòng gốc).
    await searchByItemName(page, partialTerm);
    const rows = await readVisibleRows(page);
    expect(rows.length).toBeGreaterThan(0);
    const today = todayAtMidnight();
    const normalizedTerm = partialTerm.toLocaleLowerCase("vi");
    for (const r of rows) {
      expect(r.className).toBe(baseRow.className);
      expect(Math.abs(daysBetween(rowDueDate(r), today))).toBeLessThanOrEqual(30);
      expect(r.title.toLocaleLowerCase("vi")).toContain(normalizedTerm);
    }
  });
});
