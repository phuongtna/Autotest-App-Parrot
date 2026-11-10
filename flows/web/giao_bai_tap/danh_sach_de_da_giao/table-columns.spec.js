import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { loginForPracticeTestSpec } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestSpecSetup.js";
import { widenDateRangeFilter } from "../../../../automation/giao_bai_tap/navigation/teacherAssignedListPageObjects.js";
import {
  gotoPracticeTestList,
  openRowEdit,
  openRowReport,
  realDataRows,
  searchByItemName,
} from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestListPageObjects.js";
import { readClassCardSiSo } from "../../../../automation/quan_ly_lop_hoc/navigation/classListCount.js";
import { teacherClassPageObjects as classPo } from "../../../../automation/quan_ly_lop_hoc/navigation/teacherClassPageObjects.js";
import { listCompletedStudents, readSubmitHistory } from "../../../../automation/giao_bai_tap/navigation/teacherReportPageObjects.js";

/**
 * Playwright Test THẬT cho nhóm "6. Hiển thị cột Hạn nộp & Điểm TB" (TABLE-01..11, TESTCASES.xlsx
 * tab "Giao đề luyện tập") - chuyển thể 1:1 từ runtime/tableColumnsFlow.js (ĐÃ XÁC NHẬN THẬT PASS).
 * CHỈ ĐỌC.
 *
 * TABLE-07 (2026-11-05): HẾT "Pending" - lấy ground-truth sĩ số lớp thật qua màn "Lớp phụ trách"
 * (tái sử dụng readClassCardSiSo()/teacherClassPageObjects.js của quan_ly_lop_hoc, nguyên cơ chế
 * addClassFlow.js dùng để mở màn đó) thay vì chỉ check định dạng "x/y" suông.
 *
 * TABLE-09/10/11 (2026-11-05): HẾT "Pending" - công thức "Điểm TB" THẬT (do PM/QA cung cấp, đã đối
 * chiếu khớp 2 ví dụ thật độc lập trước khi viết assertion):
 *   Điểm TB = (TỔNG điểm CAO NHẤT của mỗi HS đã nộp) / (TỔNG SỐ LẦN NỘP của tất cả HS), làm tròn 1
 *   chữ số thập phân.
 * Ground-truth lấy qua chính UI (Xem báo cáo -> "Đã hoàn thành" -> tên HS -> "Lịch sử nộp bài"),
 * KHÔNG qua API riêng - tái sử dụng nguyên listCompletedStudents()/readSubmitHistory() của
 * teacherReportPageObjects.js (đã xác nhận thật DOM/URL giống hệt màn "Bài tập").
 * Giả thuyết đơn giản hơn ("trung bình cộng mọi lần nộp") đã bị BÁC BỎ bằng dữ liệu thật (2 HS, tính
 * ra 4.78 nhưng UI hiển thị 1.7) trước khi chốt công thức trên.
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
          avgScoreText: cells[4]?.innerText.trim() ?? "",
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

/** Mở report của 1 dòng (đã search về đúng trang 1), drill-down từng HS "Đã hoàn thành" ->
 * "Lịch sử nộp bài", tính Điểm TB THẬT theo công thức đã xác nhận (xem docblock đầu file). Trả về
 * điểm TB kỳ vọng + dữ liệu thô để assertion in ra thông báo lỗi đầy đủ. */
async function computeExpectedAvgScore(page, row) {
  await openRowReport(page, row);
  await page.getByText(/Đã hoàn thành/).first().waitFor({ state: "visible", timeout: 15000 });
  const students = await listCompletedStudents(page);
  const reportUrl = page.url();
  let sumMax = 0;
  let sumAttempts = 0;
  const perStudent = [];
  for (const student of students) {
    await page.goto(new URL(student.href, reportUrl).toString());
    await page.getByText("Lịch sử nộp bài", { exact: false }).first().waitFor({ timeout: 15000 });
    const history = await readSubmitHistory(page);
    const scores = history.entries.map((e) => Number(e.scoreText)).filter((n) => !Number.isNaN(n));
    const max = Math.max(...scores);
    sumMax += max;
    sumAttempts += history.attemptCount;
    perStudent.push({ name: student.name, attemptCount: history.attemptCount, max });
  }
  const expected = Math.round((sumMax / sumAttempts) * 10) / 10;
  return { expected, sumMax, sumAttempts, perStudent };
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
    for (const r of rows) {
      expect(r.doneCountText, `"${r.title}" (lớp "${r.className}") - "HS đã làm" không đúng định dạng "x/y": "${r.doneCountText}".`).toMatch(/^\d+\/\d+$/);
    }

    // Mở "Lớp phụ trách" (cùng cơ chế addClassFlow.js#openClassList) để lấy sĩ số thật làm
    // ground-truth cho "y" - trang hiển thị TOÀN BỘ lớp của GV trong 1 danh sách, chỉ cần mở 1 lần.
    await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/classes/teacher") && res.request().method() === "GET", { timeout: 15000 }),
      page.getByRole("link", { name: classPo.sidebar.classMenuLink }).click(),
    ]);
    await page.getByRole("heading", { name: classPo.pageHeading }).waitFor({ state: "visible", timeout: 15000 });

    const siSoByClass = new Map();
    for (const className of new Set(rows.map((r) => r.className))) {
      siSoByClass.set(className, await readClassCardSiSo(page, className));
    }
    for (const r of rows) {
      const [, yText] = r.doneCountText.split("/");
      expect(
        Number(yText),
        `"${r.title}" (lớp "${r.className}") - "y" hiển thị = ${yText}, sĩ số thật trên "Lớp phụ trách" = ${siSoByClass.get(r.className)}.`,
      ).toBe(siSoByClass.get(r.className));
    }

    await gotoPracticeTestList(page);
    await widenDateRangeFilter(page);
  });

  test('TABLE-08: cột "HS đã làm" = "0/y" khi chưa có HS nào làm bài', async () => {
    const zeroPrefixedButMalformed = rows.filter((r) => r.doneCountText.startsWith("0") && !/^0\/\d+$/.test(r.doneCountText));
    expect(zeroPrefixedButMalformed, JSON.stringify(zeroPrefixedButMalformed)).toEqual([]);
    const anyZero = rows.some((r) => /^0\/\d+$/.test(r.doneCountText));
    test.skip(!anyZero, 'Không có dòng nào đang ở trạng thái "0/y" trong dữ liệu thật hiện tại.');
  });

  test('TABLE-09: cột "Điểm TB" hiển thị đúng điểm trung bình, đúng quy tắc làm tròn', async () => {
    const target = rows.find((r) => /^\d+\/\d+$/.test(r.doneCountText) && Number(r.doneCountText.split("/")[0]) > 0);
    test.skip(!target, 'Không có dòng nào đã có HS hoàn thành để đối chiếu công thức Điểm TB.');

    await searchByItemName(page, target.title);
    const row = page.locator("table tbody tr").filter({ hasText: target.title }).first();
    const { expected, sumMax, sumAttempts, perStudent } = await computeExpectedAvgScore(page, row);

    expect(
      Number(target.avgScoreText),
      `"${target.title}" (lớp "${target.className}") - Điểm TB hiển thị "${target.avgScoreText}", tính từ Lịch sử nộp bài (tổng điểm cao nhất mỗi HS=${sumMax} / tổng số lần nộp=${sumAttempts} = ${expected}) - chi tiết: ${JSON.stringify(perStudent)}.`,
    ).toBe(expected);

    await gotoPracticeTestList(page);
    await widenDateRangeFilter(page);
  });

  test('TABLE-10: cột "Điểm TB" không lỗi khi chưa có HS nào nộp bài (0/y)', async () => {
    const zeroDone = rows.find((r) => /^0\/\d+$/.test(r.doneCountText));
    test.skip(!zeroDone, 'Không có dòng nào đang ở trạng thái "0/y" trong dữ liệu thật hiện tại.');
    expect(
      zeroDone.avgScoreText,
      `"${zeroDone.title}" (lớp "${zeroDone.className}") - "${zeroDone.doneCountText}" nhưng Điểm TB hiển thị "${zeroDone.avgScoreText}" (kỳ vọng "0.0", không lỗi/NaN).`,
    ).toBe("0.0");
  });

  test('TABLE-11: [REGRESSION] "Điểm TB" không bị tính sai khi HS làm lại nhiều lần', async () => {
    // Quét tới khi gặp 1 dòng có HS thật sự đã làm lại (attemptCount > 1) - nếu công thức sai (vd
    // cộng dồn mọi lần nộp thay vì lấy điểm cao nhất) thì case này sẽ lộ sai số ngay.
    let target = null;
    let computed = null;
    for (const r of rows) {
      if (!/^\d+\/\d+$/.test(r.doneCountText) || Number(r.doneCountText.split("/")[0]) === 0) continue;
      await searchByItemName(page, r.title);
      const row = page.locator("table tbody tr").filter({ hasText: r.title }).first();
      const result = await computeExpectedAvgScore(page, row);
      await gotoPracticeTestList(page);
      await widenDateRangeFilter(page);
      if (result.perStudent.some((s) => s.attemptCount > 1)) {
        target = r;
        computed = result;
        break;
      }
    }
    test.skip(!target, 'Không có dòng nào có HS làm lại nhiều lần (attemptCount > 1) trong dữ liệu thật hiện tại.');

    expect(
      Number(target.avgScoreText),
      `"${target.title}" (lớp "${target.className}") - HS làm lại nhiều lần, Điểm TB hiển thị "${target.avgScoreText}", kỳ vọng ${computed.expected} (tổng điểm cao nhất mỗi HS=${computed.sumMax} / tổng số lần nộp=${computed.sumAttempts}) - chi tiết: ${JSON.stringify(computed.perStudent)}.`,
    ).toBe(computed.expected);
  });
});
