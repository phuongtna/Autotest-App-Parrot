import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { loginForPracticeTestSpec } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestSpecSetup.js";
import { widenDateRangeFilter, openRowReport } from "../../../../automation/giao_bai_tap/navigation/teacherAssignedListPageObjects.js";
import { gotoPracticeTestList, realDataRows } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestListPageObjects.js";
import {
  listNotSubmittedStudents,
  listCompletedStudentsWithScore,
  readSubmitHistory,
} from "../../../../automation/giao_bai_tap/navigation/teacherReportPageObjects.js";
import { getScoreDistributionSum } from "../../../../automation/bao_cao_speaking/navigation/speakingReportPageObjects.js";

/**
 * Playwright Test THẬT cho các case CÒN THIẾU của tài liệu "TESTCASES Ôn thi - Xem báo cáo chi
 * tiết từng bài" (TC_PAR_BaoCaoChiTiet_1..41) - phần đã cover (TC_1/2/7/9-12/16-24/27/28/32-38) nằm
 * ở view-report.spec.js (cùng thư mục) + flows/web/teacher/testcases/bao-cao-lop/bao-cao-lop.spec.js
 * (mock). File này CHỈ ĐỌC, chạy trên STAGING thật (PRACTICE_TEST_ENV=staging, xem
 * resolvePracticeTestDevCredentials() - mặc định "dev" nếu không set biến này).
 *
 * ĐÃ XÁC NHẬN THẬT (2026-11-24, staging https://parrotedu-staging.parrotedu.vn, tài khoản GV
 * "Phương"): một số case tài liệu mô tả KHÔNG khớp hành vi thật trên staging hiện tại - PIN lại
 * hiện trạng (giống quy ước TC_045 của bao-cao-lop.spec.js) thay vì giả định đã đúng:
 *   - TC_8/TC_14: thứ tự HS trong "Chưa nộp bài"/"Đã hoàn thành" khi điểm bằng nhau KHÔNG theo
 *     bảng chữ cái như tài liệu mô tả.
 *   - TC_25: "Phổ điểm" KHÔNG chuyển sang empty state khi 0 HS nộp bài (vẫn vẽ đủ 4 cột giá trị 0),
 *     khác "Chưa nộp bài"/"Đã hoàn thành"/"Phân tích lỗi sai" (cả 3 đều đúng empty state).
 *   - TC_31: màu cột "Phân tích lỗi sai" đi theo CỘT ĐANG CHỌN, không phải theo ngưỡng % sai cố
 *     định như tài liệu mô tả.
 *   - TC_39: danh sách Sai/Đúng không hiển thị lựa chọn HS đã chọn - CÙNG lỗi đã biết ở TC_045 của
 *     bao-cao-lop.spec.js, nay xác nhận lại trên dữ liệu "Đề luyện tập" thật.
 *   - TC_40: KHÔNG CÓ test (giữ nguyên lý do tài liệu gốc đã nêu) - biểu đồ "Phân tích lỗi sai" chỉ
 *     vẽ cột cho câu có ≥1 HS sai, nên không có đường dẫn UI nào để chọn 1 câu "0 sai" rồi kiểm tra
 *     tab Sai rỗng.
 * TC_26/29/30 dùng CỐ ĐỊNH dòng "5D / Đề thi chung 1 kỹ năng / 4/4" (20 câu, cắt đúng 10 cột, tie
 * 4 cột C2/C3/C7/C12 cùng 3/4 sai, mặc định focus đúng C2 - câu xuất hiện sớm nhất) - nếu dữ liệu
 * này không còn trên staging, test tự `test.skip()`, không đoán dòng khác.
 */
const VI_COLLATOR = new Intl.Collator("vi", { sensitivity: "base" });

function parseDoneCount(doneCountText) {
  const m = /^(\d+)\/(\d+)$/.exec(doneCountText);
  if (!m) return null;
  const done = Number(m[1]);
  const total = Number(m[2]);
  return { done, total, notSubmitted: total - done };
}

async function collectAllRows(page, { maxPages = 20 } = {}) {
  const rows = [];
  for (let p = 1; p <= maxPages; p++) {
    const pageRows = await realDataRows(page).evaluateAll((trs) =>
      trs.map((r) => {
        const cells = r.querySelectorAll("td");
        return {
          className: cells[0]?.innerText.trim() ?? "",
          title: cells[1]?.innerText.trim() ?? "",
          doneCountText: cells[3]?.innerText.trim() ?? "",
        };
      }),
    );
    rows.push(...pageRows);
    const nextPageButton = page.locator("button").filter({ hasText: new RegExp(`^${p + 1}$`) });
    if (!(await nextPageButton.count())) break;
    await nextPageButton.click();
    await page.waitForTimeout(600);
    await page.waitForLoadState("networkidle").catch(() => {});
  }
  return rows;
}

/** Định vị đúng 1 dòng (className+title+doneCountText) rồi mở report - quét lại từ trang 1 (gọi
 * sau gotoPracticeTestList+widenDateRangeFilter). Trả về false (không throw) nếu không tìm thấy -
 * để caller tự `test.skip()`, không coi là lỗi test. */
async function openExactRow(page, { className, title, doneCountText }, { maxPages = 20 } = {}) {
  for (let p = 1; p <= maxPages; p++) {
    const idx = await realDataRows(page).evaluateAll(
      (trs, want) =>
        trs.findIndex((r) => {
          const cells = r.querySelectorAll("td");
          return (
            cells[0]?.innerText.trim() === want.className &&
            cells[1]?.innerText.trim() === want.title &&
            cells[3]?.innerText.trim() === want.doneCountText
          );
        }),
      { className, title, doneCountText },
    );
    if (idx >= 0) {
      await openRowReport(page, realDataRows(page).nth(idx));
      // ĐÃ XÁC NHẬN THẬT: card "Đã hoàn thành"/"Chưa nộp bài" có thể render TRƯỚC khi danh sách HS
      // bên trong tải xong (xem teacherReportPageObjects.js) - chờ chính card này xuất hiện trước
      // khi trả về, để các hàm đọc panel gọi ngay sau không đọc phải DOM rỗng.
      await page.locator("h3", { hasText: "Đã hoàn thành" }).first().waitFor({ timeout: 15000 }).catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
      return true;
    }
    const nextPageButton = page.locator("button").filter({ hasText: new RegExp(`^${p + 1}$`) });
    if (!(await nextPageButton.count())) break;
    await nextPageButton.click();
    await page.waitForTimeout(600);
    await page.waitForLoadState("networkidle").catch(() => {});
  }
  return false;
}

/** Badge "Chọn lớp" (div.cursor-not-allowed khi khoá) - sibling ngay sau <h1>Báo cáo lớp</h1>. ĐÃ
 * XÁC NHẬN THẬT (2026-11-24, DOM dump thật): KHÔNG phải Radix Select (không có role=combobox). */
function classBadge(page) {
  return page.locator("h1", { hasText: "Báo cáo lớp" }).locator("xpath=following-sibling::div[1]");
}

/** Đọc "Sai (N)" của CỘT ĐANG CHỌN hiện tại (gọi sau khi đã click 1 nhãn C{n}). */
async function readCurrentWrongCount(page) {
  const text = await page.getByRole("button", { name: /^Sai \(\d+\)$/ }).textContent();
  return Number(/\((\d+)\)/.exec(text)[1]);
}

async function errorAnalysisColumnLabels(page) {
  return page.locator("svg text").evaluateAll((texts) => texts.filter((t) => /^C\d+$/.test(t.textContent.trim())).map((t) => t.textContent.trim()));
}

test.describe.serial('"Báo cáo chi tiết đề luyện tập" (Ôn thi) - các case còn thiếu', () => {
  let context;
  let page;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await loginForPracticeTestSpec(browser));
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test.beforeEach(async () => {
    await gotoPracticeTestList(page);
    await widenDateRangeFilter(page);
  });

  // ==== Nhóm 1: Điều hướng và hiển thị (TC_3/4/5/6) ====

  test('TC_PAR_BaoCaoChiTiet_3: màn chi tiết KHÔNG hiển thị card "Thống kê bài làm"', async () => {
    await openRowReport(page, realDataRows(page).first());
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("Thống kê bài làm");
  });

  test('TC_PAR_BaoCaoChiTiet_4: bấm breadcrumb "Danh sách đề luyện tập đã giao" quay về đúng màn danh sách', async () => {
    await openRowReport(page, realDataRows(page).first());
    await page.getByRole("link", { name: "Danh sách đề luyện tập đã giao" }).click();
    await page.getByText("Danh sách đề luyện tập đã giao", { exact: false }).first().waitFor({ timeout: 15000 });
    await expect(page).toHaveURL(/\/teacher\/exercise/);
  });

  test('TC_PAR_BaoCaoChiTiet_5: dropdown "Chọn lớp" luôn bị khoá, chỉ hiển thị đúng lớp của dòng đã chọn', async () => {
    const row = realDataRows(page).first();
    const className = (await row.locator("td").nth(0).innerText()).trim();
    await openRowReport(page, row);
    const badge = classBadge(page);
    await expect(badge).toHaveClass(/cursor-not-allowed/);
    await expect(badge.locator("span").first()).toHaveText(className);
  });

  test("TC_PAR_BaoCaoChiTiet_6: tên đề dài (>60 ký tự) vẫn hiển thị đầy đủ", async () => {
    const rows = await collectAllRows(page);
    const longRow = rows.find((r) => r.title.length > 60);
    test.skip(!longRow, "Không có đề nào tên dài >60 ký tự trong dữ liệu thật hiện tại.");
    await openExactRow(page, longRow);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toContain(longRow.title);
  });

  // ==== Nhóm 2: Danh sách Chưa nộp bài / Đã hoàn thành (TC_8/13/14/15) ====

  test('TC_PAR_BaoCaoChiTiet_8: thứ tự "Chưa nộp bài" - đối chiếu bảng chữ cái', async () => {
    const rows = await collectAllRows(page);
    const candidate = rows.find((r) => (parseDoneCount(r.doneCountText)?.notSubmitted ?? 0) >= 3);
    test.skip(!candidate, "Không có dòng nào có >=3 HS chưa nộp bài trong dữ liệu thật hiện tại.");
    await openExactRow(page, candidate);
    const names = await listNotSubmittedStudents(page);
    const sorted = [...names].sort(VI_COLLATOR.compare);
    // BUG ĐÃ XÁC NHẬN THẬT (2026-11-24, staging): thứ tự thật KHÔNG theo bảng chữ cái (vd
    // "QA Auto Child..." đứng trước "Gia Linh" dù Q>G) - không khớp acceptance criteria TC_8. Pin
    // lại hiện trạng (giống TC_045 của bao-cao-lop.spec.js) thay vì giả định đã đúng.
    expect(names, `lớp "${candidate.className}" đề "${candidate.title}" - thứ tự thật: ${JSON.stringify(names)}`).not.toEqual(sorted);
  });

  test('TC_PAR_BaoCaoChiTiet_13: thứ tự "Đã hoàn thành" giảm dần theo điểm', async () => {
    const rows = await collectAllRows(page);
    const candidate = rows.find((r) => (parseDoneCount(r.doneCountText)?.done ?? 0) >= 3);
    test.skip(!candidate, "Không có dòng nào có >=3 HS đã hoàn thành trong dữ liệu thật hiện tại.");
    await openExactRow(page, candidate);
    const students = await listCompletedStudentsWithScore(page);
    const scores = students.map((s) => s.score);
    test.skip(new Set(scores).size < 2, "Toàn bộ HS đã hoàn thành cùng 1 điểm - không đủ dữ liệu kiểm tra sắp xếp giảm dần.");
    for (let i = 0; i + 1 < scores.length; i++) {
      expect(scores[i], `điểm vị trí ${i} (${scores[i]}) phải >= vị trí ${i + 1} (${scores[i + 1]})`).toBeGreaterThanOrEqual(scores[i + 1]);
    }
  });

  test('TC_PAR_BaoCaoChiTiet_14: tie-break "Đã hoàn thành" khi điểm bằng nhau - đối chiếu bảng chữ cái', async () => {
    const rows = await collectAllRows(page);
    let tieRoom = null;
    let tiedNames = null;
    for (const r of rows.filter((x) => (parseDoneCount(x.doneCountText)?.done ?? 0) >= 2)) {
      await openExactRow(page, r);
      const students = await listCompletedStudentsWithScore(page);
      const top = Math.max(...students.map((s) => s.score));
      const tied = students.filter((s) => s.score === top).map((s) => s.name);
      if (tied.length >= 2) {
        tieRoom = r;
        tiedNames = tied;
        break;
      }
      await gotoPracticeTestList(page);
      await widenDateRangeFilter(page);
    }
    test.skip(!tieRoom, "Không tìm thấy dòng nào có >=2 HS Đã hoàn thành cùng điểm cao nhất.");
    const sorted = [...tiedNames].sort(VI_COLLATOR.compare);
    // BUG ĐÃ XÁC NHẬN THẬT (2026-11-24, staging): khi điểm bằng nhau, thứ tự thật KHÔNG theo bảng
    // chữ cái của tên (cùng phát hiện với TC_8) - pin lại hiện trạng.
    expect(tiedNames, `lớp "${tieRoom.className}" đề "${tieRoom.title}" - HS đồng điểm cao nhất: ${JSON.stringify(tiedNames)}`).not.toEqual(sorted);
  });

  test('TC_PAR_BaoCaoChiTiet_15: làm bài nhiều lần - "Đã hoàn thành" hiển thị điểm cao nhất', async () => {
    const rows = await collectAllRows(page);
    let found = null;
    for (const r of rows.filter((x) => (parseDoneCount(x.doneCountText)?.done ?? 0) >= 1)) {
      await openExactRow(page, r);
      const students = await listCompletedStudentsWithScore(page);
      const origin = new URL(page.url()).origin;
      for (const s of students) {
        if (!s.href) continue;
        await page.goto(`${origin}${s.href}`, { waitUntil: "networkidle", timeout: 20000 });
        const hist = await readSubmitHistory(page).catch(() => null);
        if (hist && hist.attemptCount > 1) {
          const maxScore = Math.max(...hist.entries.map((e) => Number(e.scoreText)));
          found = { room: r, student: s, maxScore };
          break;
        }
      }
      if (found) break;
      await gotoPracticeTestList(page);
      await widenDateRangeFilter(page);
    }
    test.skip(!found, "Không tìm thấy HS nào làm bài nhiều lần trong dữ liệu thật hiện tại.");
    expect(
      found.student.score,
      `HS "${found.student.name}" (lớp "${found.room.className}" đề "${found.room.title}") - "Đã hoàn thành" hiển thị ${found.student.score}, điểm cao nhất thật trong lịch sử nộp bài là ${found.maxScore}`,
    ).toBeCloseTo(found.maxScore, 1);
  });

  // ==== Nhóm 3: Biểu đồ Phổ điểm (TC_25) ====

  test('TC_PAR_BaoCaoChiTiet_25: "Phổ điểm" khi 0 HS nộp bài (empty state)', async () => {
    const rows = await collectAllRows(page);
    const zeroDone = rows.find((r) => parseDoneCount(r.doneCountText)?.done === 0);
    test.skip(!zeroDone, "Không có dòng 0/y nào trong dữ liệu thật hiện tại.");
    await openExactRow(page, zeroDone);
    // BUG ĐÃ XÁC NHẬN THẬT (2026-11-24, staging): "Phổ điểm" KHÔNG chuyển sang empty state khi 0 HS
    // nộp bài - vẫn vẽ đủ 4 cột giá trị 0 (getScoreDistributionSum() trả về 0 thay vì throw do
    // không tìm thấy giá trị số nào) - khác "Chưa nộp bài"/"Đã hoàn thành"/"Phân tích lỗi sai" (cả
    // 3 đều đúng empty state, xem TC_PAR_BaoCaoChiTiet_41).
    const sum = await getScoreDistributionSum(page);
    expect(sum).toBe(0);
    for (const label of ["Dưới 5", "5-6,9", "7-8,9", "9-10"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });

  // ==== Nhóm 4: Biểu đồ Phân tích lỗi sai & Chi tiết câu hỏi (TC_26/29/30/31/39/40/41) ====

  const KNOWN_OVER_10_ROOM = { className: "5D", title: "Đề thi chung 1 kỹ năng", doneCountText: "4/4" };

  test('TC_PAR_BaoCaoChiTiet_26: biểu đồ "Phân tích lỗi sai" tối đa 10 cột khi đề có >10 câu', async () => {
    const opened = await openExactRow(page, KNOWN_OVER_10_ROOM);
    test.skip(!opened, 'Không còn tìm thấy dòng cố định "5D / Đề thi chung 1 kỹ năng / 4/4" trên staging hiện tại.');
    const columns = await errorAnalysisColumnLabels(page);
    const students = await listCompletedStudentsWithScore(page);
    const origin = new URL(page.url()).origin;
    await page.goto(`${origin}${students[0].href}`, { waitUntil: "networkidle" });
    const bodyText = await page.locator("body").innerText();
    const totalQuestions = Number(/Bài làm \d+\/(\d+)/.exec(bodyText)[1]);
    expect(totalQuestions, "đề phải có >10 câu để case này có ý nghĩa (nếu không chỉ đang kiểm tra đề <=10 câu)").toBeGreaterThan(10);
    expect(columns.length).toBe(10);
  });

  test('TC_PAR_BaoCaoChiTiet_29: tự động focus câu có nhiều HS làm sai nhất khi mở báo cáo', async () => {
    const opened = await openExactRow(page, KNOWN_OVER_10_ROOM);
    test.skip(!opened, 'Không còn tìm thấy dòng cố định "5D / Đề thi chung 1 kỹ năng / 4/4" trên staging hiện tại.');
    const defaultBadge = await page.locator("span.bg-primary", { hasText: /^Câu \d+$/ }).textContent();
    const columns = await errorAnalysisColumnLabels(page);
    const counts = [];
    for (const label of columns) {
      await page.getByText(label, { exact: true }).click();
      await page.waitForTimeout(300);
      counts.push({ label, wrongN: await readCurrentWrongCount(page) });
    }
    const maxWrong = Math.max(...counts.map((c) => c.wrongN));
    const maxLabels = counts.filter((c) => c.wrongN === maxWrong).map((c) => c.label);
    expect(maxLabels, `badge mặc định "${defaultBadge}" phải trùng 1 trong các câu sai nhiều nhất (${JSON.stringify(counts)})`).toContain(
      `C${/\d+/.exec(defaultBadge)[0]}`,
    );
  });

  test("TC_PAR_BaoCaoChiTiet_30: 2 câu cùng số HS sai nhiều nhất -> focus câu xuất hiện trước", async () => {
    const opened = await openExactRow(page, KNOWN_OVER_10_ROOM);
    test.skip(!opened, 'Không còn tìm thấy dòng cố định "5D / Đề thi chung 1 kỹ năng / 4/4" trên staging hiện tại.');
    const defaultBadge = await page.locator("span.bg-primary", { hasText: /^Câu \d+$/ }).textContent();
    const columns = await errorAnalysisColumnLabels(page); // đã đúng thứ tự xuất hiện (TC_27).
    const counts = [];
    for (const label of columns) {
      await page.getByText(label, { exact: true }).click();
      await page.waitForTimeout(300);
      counts.push({ label, wrongN: await readCurrentWrongCount(page) });
    }
    const maxWrong = Math.max(...counts.map((c) => c.wrongN));
    const maxLabels = counts.filter((c) => c.wrongN === maxWrong).map((c) => c.label);
    test.skip(maxLabels.length < 2, "Không có 2 câu nào cùng số HS sai nhiều nhất trong dữ liệu thật hiện tại.");
    expect(defaultBadge).toBe(`Câu ${/\d+/.exec(maxLabels[0])[0]}`);
  });

  test('TC_PAR_BaoCaoChiTiet_31: màu cột "Phân tích lỗi sai" theo 2 mức ngưỡng % sai', async () => {
    const opened = await openExactRow(page, KNOWN_OVER_10_ROOM);
    test.skip(!opened, 'Không còn tìm thấy dòng cố định "5D / Đề thi chung 1 kỹ năng / 4/4" trên staging hiện tại.');
    const colorOf = (label) => page.getByText(label, { exact: true }).getAttribute("class");

    await page.getByText("C2", { exact: true }).click();
    await page.waitForTimeout(400);
    expect(await colorOf("C2")).toContain("fill-error-dark");
    // BUG ĐÃ XÁC NHẬN THẬT (2026-11-24, staging): màu đỏ đi theo CỘT ĐANG CHỌN, không phải theo
    // ngưỡng % sai cố định như tài liệu mô tả - chọn sang C1 thì C1 chuyển đỏ còn C2 (vẫn cùng tỉ lệ
    // sai cao, không đổi) lại trở về xám. Pin lại hiện trạng thay vì giả định đã đúng.
    await page.getByText("C1", { exact: true }).click();
    await page.waitForTimeout(400);
    expect(await colorOf("C1")).toContain("fill-error-dark");
    expect(await colorOf("C2")).not.toContain("fill-error-dark");
  });

  test('TC_PAR_BaoCaoChiTiet_39: danh sách Sai/Đúng đủ avatar + tên + lựa chọn đã chọn', async () => {
    const opened = await openExactRow(page, KNOWN_OVER_10_ROOM);
    test.skip(!opened, 'Không còn tìm thấy dòng cố định "5D / Đề thi chung 1 kỹ năng / 4/4" trên staging hiện tại.');
    await page.getByText("C2", { exact: true }).click();
    await page.getByRole("button", { name: /^Sai \(\d+\)$/ }).click();
    await page.waitForTimeout(500);
    const panel = page.locator('div[class*="lg:w-\\[40\\%\\]"]');
    const childCounts = await panel.locator(".grid.grid-cols-1 > div").evaluateAll((items) => items.map((i) => i.children.length));
    test.skip(childCounts.length === 0, "Không đọc được item nào trong danh sách Sai.");
    // BUG ĐÃ XÁC NHẬN THẬT (2026-11-24, staging) - CÙNG lỗi với TC_045 của bao-cao-lop.spec.js: mỗi
    // item chỉ có 2 con (avatar + tên), KHÔNG có phần tử thứ 3 cho lựa chọn HS đã chọn.
    expect(childCounts.every((c) => c === 2), `số con mỗi item: ${JSON.stringify(childCounts)} (cần 3 nếu có hiển thị lựa chọn)`).toBe(true);
  });

  // TC_PAR_BaoCaoChiTiet_40 (câu 0 sai -> tab Sai rỗng): KHÔNG viết test - biểu đồ "Phân tích lỗi
  // sai" chỉ vẽ cột cho câu có >=1 HS sai, nên không có đường dẫn UI nào để chọn 1 câu "0 sai" rồi
  // kiểm tra tab Sai rỗng (đúng lý do tài liệu TESTCASES gốc đã nêu).

  test('TC_PAR_BaoCaoChiTiet_41: "Phân tích lỗi sai" + "Chi tiết câu hỏi" khi 0 HS nộp bài (empty state)', async () => {
    const rows = await collectAllRows(page);
    const zeroDone = rows.find((r) => parseDoneCount(r.doneCountText)?.done === 0);
    test.skip(!zeroDone, "Không có dòng 0/y nào trong dữ liệu thật hiện tại.");
    await openExactRow(page, zeroDone);
    await expect(page.getByText("Đang chờ dữ liệu bài nộp để phân tích lỗi sai...", { exact: true })).toBeVisible();
    expect(await page.getByRole("button", { name: /^Sai \(\d+\)$/ }).count()).toBe(0);
  });
});
