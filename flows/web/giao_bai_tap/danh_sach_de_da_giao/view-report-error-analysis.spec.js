import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { teacherPortalPageObjects as po } from "../../../../automation/giao_bai_tap/navigation/teacherPortalPageObjects.js";
import { config, resolveTeacherPortalBaseUrl } from "../../../../automation/src/config.js";
import { openRowReport, widenDateRangeFilter } from "../../../../automation/giao_bai_tap/navigation/teacherAssignedListPageObjects.js";
import { gotoPracticeTestList, realDataRows } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestListPageObjects.js";
import { po as reportPo, questionCell } from "../../../../automation/bao_cao_speaking/navigation/speakingReportPageObjects.js";

/**
 * Playwright Test THẬT (STAGING, KHÔNG mock) cho TC_035/TC_037 của nhóm "Phân tích lỗi sai" (xem
 * docblock flows/web/teacher/testcases/bao-cao-lop/bao-cao-lop.spec.js#L24-33) - phần còn lại của
 * TC_032/036 KHÔNG viết được (xem lý do ở cuối file).
 *
 * LUÔN chạy STAGING (không qua `PRACTICE_TEST_ENV`/`resolvePracticeTestDevCredentials()` như
 * view-report.spec.js) - KHÁC CÓ CHỦ Ý: mục đích riêng của file này là dữ liệu THẬT trên staging
 * (chỉ môi trường có `TEACHER_USERNAME/PASSWORD` + `TEACHER_PORTAL_BASE_URL_STAGING` sẵn trong
 * .env lúc viết - KHÔNG có `TEACHER_PORTAL_BASE_URL_DEV`/`TEACHER_USERNAME_SPEAKING_REPORT`, nên
 * `view-report.spec.js` mặc định (dev) không chạy được trong môi trường này). Đăng nhập trực tiếp
 * bằng tài khoản GV mặc định (`config.teacherUsername/teacherPassword`) + base URL staging, dùng
 * lại NGUYÊN selector form login của `teacherPortalPageObjects.js` - KHÔNG mutate
 * `process.env.PRACTICE_TEST_ENV` (file này chạy CHUNG worker/process với view-report.spec.js khi
 * cùng 1 lần `playwright test` - đổi biến môi trường global sẽ ảnh hưởng lây sang file đó).
 *
 * ROOM THẬT (2026-11-24, dò qua toàn bộ "Đề luyện tập đã giao" có HS nộp bài của tài khoản GV mặc
 * định trên staging - chỉ có 2 lớp "5D"/"5X-RKLRejoin2", 7 đề có HS nộp bài, dò bằng 1 script
 * throwaway đã xoá sau khi dùng xong): "Đề thi Reading" (lớp "5D", roomId
 * 1ecd5c8b-4571-4d2c-99ad-415b1a9c70d7) là đề DUY NHẤT có HS làm sai câu nào - 10 câu loại "ONE"
 * (bỏ 1 câu "GROUP" question_index=0) + 2/3 HS đã nộp: incorrect_count 0 (x1 câu, index 8) / 1 (x8
 * câu, error_rate 50% hoặc 100% tuỳ số lượt nộp cho câu đó) / 2 (x1 câu DUY NHẤT - CAO NHẤT không
 * hoà, question_index=10). KHÔNG tạo/sửa dữ liệu thật - chỉ đọc.
 *
 * PHÁT HIỆN THẬT quan trọng (xem SỬA trong `nonGroupQuestionsOrdered()`/TC_035 bên dưới, ĐÃ FAIL 2
 * lần trước khi đúng): câu incorrect_count=0 KHÔNG có cột trên biểu đồ (khác "Phổ điểm" vẫn hiện
 * cột 0 - TC_030), nhưng số thứ tự "C{n}" của các cột còn lại GIỮ NGUYÊN vị trí gốc (bỏ số, không
 * dồn lại) - ví dụ thật: "...,C7,C9,C10" (thiếu C8), KHÔNG PHẢI "...,C7,C8,C9". Sửa lại hiểu biết cũ
 * của bao-cao-lop.spec.js ("nhãn liên tục bỏ GROUP, mock luôn hiện đủ") - mock cũ chưa bao giờ test
 * trường hợp có câu inc=0 xen giữa các câu inc>0 nên chưa lộ ra khác biệt này.
 */
async function loginStagingDefaultAccount(browser) {
  const baseUrl = resolveTeacherPortalBaseUrl("staging");
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseUrl}${po.login.path}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.locator(po.login.usernameInput).first().fill(config.teacherUsername);
  await page.locator(po.login.passwordInput).first().fill(config.teacherPassword);
  await page.getByRole("button", { name: po.login.submitButton }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });
  return { context, page };
}

/** Giống hệt helper cùng tên ở bao-cao-lop.spec.js (không export được từ đó - nằm trong
 * `test.describe` callback của file kia) - đọc toàn bộ nhãn "C{n}" theo đúng thứ tự trái->phải. */
async function readErrorChartColumnLabels(page) {
  return page.evaluate((heading) => {
    const h = Array.from(document.querySelectorAll("h3")).find((el) => el.textContent.trim() === heading);
    let node = h;
    let svg = null;
    for (let i = 0; i < 8 && node && !svg; i++) {
      node = node.parentElement;
      svg = node?.querySelector("svg") ?? null;
    }
    if (!svg) return [];
    return Array.from(svg.querySelectorAll("text"))
      .map((t) => t.textContent.trim())
      .filter((t) => /^C\d+$/.test(t));
  }, reportPo.errorAnalysisHeading);
}

/** Đọc số "Câu N" đang auto-focus (chưa bấm cột nào) - leaf text duy nhất khớp /^Câu \d+$/, KHÁC
 * nhãn cột "C{n}" (pattern khác hẳn: "Câu" + số, không phải "C"+số dính liền). */
async function readFocusedQuestionNumber(page) {
  const text = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll("*")).find(
      (e) => e.children.length === 0 && /^Câu \d+$/.test(e.textContent.trim()),
    );
    return el ? el.textContent.trim() : null;
  });
  return text ? Number(/\d+/.exec(text)[0]) : null;
}

test.describe.serial("Báo cáo chi tiết đề luyện tập - Phân tích lỗi sai (THẬT, staging)", () => {
  let context;
  let page;
  let roomQuestionsAnalytic;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await loginStagingDefaultAccount(browser));
    await gotoPracticeTestList(page);
    await widenDateRangeFilter(page);
    // SỬA (phát hiện lúc viết test này): ô tìm kiếm "Tìm theo tên đề luyện tập" trả về [] (0 dòng)
    // dù dòng thật tồn tại trong danh sách chưa lọc - KHÔNG rõ nguyên nhân (có thể khác cơ chế search
    // của màn bài tập), KHÔNG dùng search - lọc trực tiếp trên danh sách đã mở rộng phạm vi ngày.
    const row = realDataRows(page).filter({ hasText: "Đề thi Reading" }).filter({ hasText: "5D" }).first();
    test.skip(!(await row.count()), 'Không còn tìm thấy đề "Đề thi Reading" / lớp "5D" trên staging - dữ liệu thật có thể đã đổi.');

    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/user/report-stats/room-questions-analytic"), { timeout: 15000 }),
      openRowReport(page, row),
    ]);
    roomQuestionsAnalytic = await resp.json();
    await page.getByRole("button", { name: /^Sai \(\d+\)$/ }).waitFor({ timeout: 15000 });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  /** SỬA (2026-11-24, FAIL thật xác nhận qua chạy live, 2 lần): giả thuyết ban đầu "nhãn C{n} liên
   * tục bỏ GROUP" của bao-cao-lop.spec.js ĐÚNG MỘT PHẦN khi đối chiếu dữ liệu THẬT - số thứ tự n
   * được gán 1 LẦN DUY NHẤT cho TOÀN BỘ câu không phải "GROUP" theo question_index (1..10 ở room
   * này), KHÔNG đổi theo tập con hiển thị. Nhưng câu có incorrect_count=0 (question_index=8 ở room
   * này, số thứ tự 8) KHÔNG có cột trong biểu đồ (khác "Phổ điểm" TC_030 - "vẫn hiện cột 0") - cột
   * bị ẨN giữ NGUYÊN số gốc của các câu còn lại (thấy thật: "...,C7,C9,C10", KHÔNG dồn lại
   * "...,C7,C8,C9"). Tức là: số thứ tự = vị trí trong danh sách TOÀN BỘ câu non-GROUP (kể cả câu
   * inc=0); chỉ câu có inc>0 mới có cột thật trên biểu đồ. */
  function nonGroupQuestionsOrdered() {
    return roomQuestionsAnalytic.questions_analysis
      .filter((q) => q.type !== "GROUP")
      .sort((a, b) => a.question_index - b.question_index);
  }

  test('TC_035 - tự động focus vào câu có số HS làm sai nhiều nhất khi vừa mở báo cáo', async () => {
    const nonGroup = nonGroupQuestionsOrdered();
    const maxIncorrect = Math.max(...nonGroup.map((q) => q.incorrect_count));
    const winners = nonGroup.filter((q) => q.incorrect_count === maxIncorrect);
    test.skip(winners.length !== 1, "Dữ liệu thật hiện không có đúng 1 câu sai nhiều nhất duy nhất (có hoà) - không dùng được cho TC_035 (xem TC_036).");
    const expectedLabelNumber = nonGroup.indexOf(winners[0]) + 1; // số thứ tự gốc (xem SỬA ở trên), KHÔNG dồn lại theo tập con có cột.

    const expectedLabels = nonGroup
      .map((q, i) => (q.incorrect_count > 0 ? `C${i + 1}` : null))
      .filter(Boolean);
    const labels = await readErrorChartColumnLabels(page);
    expect(labels).toEqual(expectedLabels); // chỉ câu có HS sai mới có cột, giữ nguyên số gốc (≤10, N=9 cột ở room này - chưa vượt ngưỡng 10).

    const focused = await readFocusedQuestionNumber(page);
    expect(focused).toBe(expectedLabelNumber);
  });

  test('TC_037 - ngưỡng màu cột theo error_rate: >=50% tô đậm, <50% tô xám', async () => {
    const nonGroup = nonGroupQuestionsOrdered();
    const wrongQs = nonGroup.filter((q) => q.incorrect_count > 0);
    const high = wrongQs.find((q) => q.error_rate >= 50);
    const low = wrongQs.find((q) => q.error_rate < 50);
    test.skip(!high || !low, "Dữ liệu thật hiện không có đủ cả 2 mức (>=50% và <50%) trong số câu CÓ cột để đối chiếu.");

    await expect(questionCell(page, nonGroup.indexOf(high) + 1)).toHaveClass(new RegExp(reportPo.errorRateHighClass));
    await expect(questionCell(page, nonGroup.indexOf(low) + 1)).toHaveClass(new RegExp(reportPo.errorRateLowClass));
  });
});

/**
 * SỬA (2026-11-24): đoạn comment dưới đây ("KHÔNG viết được TC_032/036") mô tả kết quả dò ban đầu
 * (chỉ quét 7 đề trong phạm vi "1 tháng gần nhất" của riêng tài khoản GV mặc định) - SAU ĐÓ người
 * yêu cầu cung cấp trực tiếp roomId `d469b4ff-a6fa-4bcb-b4d2-3849c9b6ec7f` ("Đề thi chung 1 kỹ
 * năng", lớp "5D", giao 08/11/2026, 4/4 đã nộp) - đề này NẰM NGOÀI phạm vi quét ban đầu (hạn 1
 * tháng tính từ lúc quét, hoặc filter đã bỏ sót - không xác định được lý do chính xác), nhưng CÓ
 * đủ dữ liệu: 18/20 câu bị làm sai (>10) và 4 câu hoà điểm sai cao nhất (incorrect_count=3, tại
 * question_index 1/2/6/11) - viết được cả TC_032 và TC_036 bên dưới, giữ nguyên lịch sử dò tìm cũ
 * (không xoá) để biết các giả thuyết/phạm vi đã thử.
 */
test.describe.serial("Báo cáo chi tiết đề luyện tập - Phân tích lỗi sai >10 câu (THẬT, staging)", () => {
  let context;
  let page;
  let roomQuestionsAnalytic;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await loginStagingDefaultAccount(browser));
    await gotoPracticeTestList(page);
    await widenDateRangeFilter(page);
    // 3 filter hasText (tên đề + ngày giao + x/y đã nộp) để chọn ĐÚNG 1 trong 5 dòng cùng tên "Đề
    // thi chung 1 kỹ năng" (đề này được giao nhiều lần/nhiều lớp) - ĐÃ XÁC NHẬN THẬT dòng này dẫn
    // đúng tới roomId d469b4ff-a6fa-4bcb-b4d2-3849c9b6ec7f.
    const row = realDataRows(page)
      .filter({ hasText: "Đề thi chung 1 kỹ năng" })
      .filter({ hasText: "08/11/2026" })
      .filter({ hasText: "4/4" });
    test.skip(
      !(await row.count()),
      'Không còn tìm thấy đúng dòng đề "Đề thi chung 1 kỹ năng" (5D, 08/11/2026, 4/4) trên staging - dữ liệu thật có thể đã đổi.',
    );

    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/user/report-stats/room-questions-analytic"), { timeout: 15000 }),
      openRowReport(page, row),
    ]);
    roomQuestionsAnalytic = await resp.json();
    await page.getByRole("button", { name: /^Sai \(\d+\)$/ }).waitFor({ timeout: 15000 });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  /** Room này KHÔNG có câu loại "GROUP" (ĐÃ XÁC NHẬN THẬT: 20/20 câu đều "ONE") nên số thứ tự cột =
   * question_index + 1 trực tiếp - KHÁC `nonGroupQuestionsOrdered()` ở trên (room "Đề thi Reading"
   * có xen 1 câu GROUP nên phải lọc trước khi đánh số). */
  function wrongQuestions() {
    return roomQuestionsAnalytic.questions_analysis.filter((q) => q.incorrect_count > 0);
  }

  test("TC_032 - biểu đồ chỉ hiển thị tối đa 10 cột khi có >10 câu bị làm sai", async () => {
    const wrong = wrongQuestions();
    // Tiền đề thật của case này (18 câu sai ở room d469b4ff) - nếu dữ liệu đổi và không còn >10 nữa
    // thì assertion dưới (đúng 10 cột) không còn kiểm tra đúng ý TC_032 nữa, PHẢI fail rõ ở đây.
    expect(wrong.length).toBeGreaterThan(10);

    const top10 = wrong
      .slice()
      .sort((a, b) => b.incorrect_count - a.incorrect_count || a.question_index - b.question_index)
      .slice(0, 10);
    // Biểu đồ sắp xếp cột theo đúng thứ tự xuất hiện trong đề (TC_033), không theo số sai nhiều->ít.
    const expectedLabels = top10
      .slice()
      .sort((a, b) => a.question_index - b.question_index)
      .map((q) => `C${q.question_index + 1}`);

    const labels = await readErrorChartColumnLabels(page);
    expect(labels).toHaveLength(10);
    expect(labels).toEqual(expectedLabels);
  });

  test("TC_036 - 2+ câu hoà sai nhiều nhất -> tự động focus câu xuất hiện trước trong đề", async () => {
    const wrong = wrongQuestions();
    const maxIncorrect = Math.max(...wrong.map((q) => q.incorrect_count));
    const tied = wrong.filter((q) => q.incorrect_count === maxIncorrect);
    test.skip(tied.length < 2, "Dữ liệu thật hiện không còn hoà điểm sai cao nhất - không dùng được cho TC_036.");

    const winner = tied.slice().sort((a, b) => a.question_index - b.question_index)[0];
    const focused = await readFocusedQuestionNumber(page);
    expect(focused).toBe(winner.question_index + 1);
  });
});
