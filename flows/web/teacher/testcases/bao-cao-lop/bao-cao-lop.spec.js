import { test, expect } from "../../../../../automation/bao_cao_speaking/playwrightTest.js";
import { config } from "../../../../../automation/src/config.js";
import { gotoMockedReport } from "../../../../../automation/bao_cao_speaking/mock/mockReportApi.js";
import { buildRoomAnalytic } from "../../../../../automation/bao_cao_speaking/fixtures/roomAnalyticFixture.js";
import { buildRoomQuestionsAnalytic } from "../../../../../automation/bao_cao_speaking/fixtures/roomQuestionsAnalyticFixture.js";
import { buildQuestionDetailAnalytic } from "../../../../../automation/bao_cao_speaking/fixtures/questionDetailAnalyticFixture.js";
import { po as reportPo, getScoreDistributionSum } from "../../../../../automation/bao_cao_speaking/navigation/speakingReportPageObjects.js";

/**
 * PAR-3169 "Ôn thi - Xem báo cáo theo lớp" (tab "Đề luyện tập", Web GV) - mock Tầng 2, CÙNG cơ chế
 * `gotoMockedReport`/fixtures/`po` của automation/bao_cao_speaking/ (màn /teacher/exercise/{roomId}
 * /report DÙNG CHUNG component + 3 API report-stats giữa Speaking và Đề luyện tập - đã xác nhận
 * thật qua test tay trên staging 2026-11-05/06, xem project_par3169_baocaolop_staging_run.md).
 * KHÔNG viết lại cơ chế mock/đăng nhập.
 *
 * Schema MCQ thật (type "ONE") cho room-questions-analytic/question-detail-analytic LẤY TỪ
 * capture thật tại automation/output/data_discovery/REPORT/network_log.json (room bài tập về nhà
 * "G3-U18-Lesson 1", 2026-08-11) - KHÔNG đoán: `question.explain_answer` (không phải "title"),
 * `answers[].{id,content,image}`, `correct` là id đáp án đúng, `correct_answer_groups`/
 * `incorrect_answer_groups[].{user_id,user_name,avatar,answer,is_correct}`. `buildQuestionDetailAnalytic`
 * dùng chung của Speaking chỉ đúng schema "SPEAK" nên KHÔNG tái dùng được cho nhóm test này - build
 * JSON tại chỗ (chỉ 2 câu, không đáng tách fixture builder riêng).
 *
 * KHÔNG viết TC_032/035/036/037 (giới hạn 10 cột + auto-focus + tie-break + ngưỡng màu biểu đồ
 * "Phân tích lỗi sai" khi có >10 câu sai) ở đây: ĐÃ THỬ NHIỀU GIẢ THUYẾT (field "type", số HS nộp
 * khớp total_students, exam_id không phải all-zero UUID) qua mock - KHÔNG giả thuyết nào tái tạo
 * được hành vi giới hạn 10 cột (mock luôn hiện đủ, trong khi 3 room THẬT khác nhau trên DEV đều
 * giới hạn đúng 10 cột). Đã xác nhận 1 phần của mô hình chọn cột qua dữ liệu thật: nhãn "C{n}" là
 * SỐ THỨ TỰ LIÊN TỤC bỏ qua câu loại GROUP (không phải question_index/question_index+1 thẳng), và
 * khi ≤10 câu có HS sai (không cần cắt bớt) thì mô hình "sai nhiều nhất trước, hoà thì ưu tiên câu
 * xuất hiện sớm hơn" khớp đúng 100% - chỉ riêng BƯỚC CHỌN 10/N khi N>10 là chưa tái tạo được qua
 * mock, có thể phụ thuộc 1 nguồn dữ liệu khác (vd cấu trúc đề) ngoài 3 API report-stats đã biết.
 * Xem project_par3169_baocaolop_staging_run.md để không lặp lại các giả thuyết đã thử.
 */
test.describe("PAR-3169 Báo cáo theo lớp (Đề luyện tập) - mock", () => {
  test.skip(
    !config.teacherUsernameSpeakingReport || !config.teacherPasswordSpeakingReport,
    "Thiếu TEACHER_USERNAME_SPEAKING_REPORT/TEACHER_PASSWORD_SPEAKING_REPORT trong .env.",
  );

  const roomId = "9cf81245-787e-44c8-8178-d66794f9832a";

  test("TC_017 - toàn bộ lớp đã nộp bài thì 'Chưa nộp bài (0)' + thông báo hết danh sách", async ({ page }) => {
    const roomAnalytic = buildRoomAnalytic({
      roomId,
      roomName: "Đề luyện tập mock",
      submitted: [
        { id: "u1", name: "HS A", score: 8 },
        { id: "u2", name: "HS B", score: 6 },
      ],
    });
    const roomQuestionsAnalytic = buildRoomQuestionsAnalytic({
      roomId,
      roomName: "Đề luyện tập mock",
      totalStudents: 2,
      questions: [{ questionId: "q1", questionIndex: 0, incorrectCount: 0, errorRate: 0 }],
    });
    const questionDetailAnalytic = buildQuestionDetailAnalytic({ questionId: "q1", question: { content: "Q1", title: "Q1" } });

    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });

    await expect(page.getByText(reportPo.notSubmittedHeading(0))).toBeVisible();
    await expect(page.getByText(reportPo.allSubmittedMessage)).toBeVisible();
  });

  test("TC_026 - trục X biểu đồ 'Phổ điểm' hiển thị đúng 4 nhãn", async ({ page }) => {
    const roomAnalytic = buildRoomAnalytic({ roomId, roomName: "Đề luyện tập mock", submitted: [{ id: "u1", name: "HS A", score: 3 }] });
    const roomQuestionsAnalytic = buildRoomQuestionsAnalytic({
      roomId,
      roomName: "Đề luyện tập mock",
      totalStudents: 1,
      questions: [{ questionId: "q1", questionIndex: 0, incorrectCount: 0, errorRate: 0 }],
    });
    const questionDetailAnalytic = buildQuestionDetailAnalytic({ questionId: "q1", question: { content: "Q1", title: "Q1" } });

    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });
    await getScoreDistributionSum(page); // chờ biểu đồ Phổ điểm render xong (animation) trước khi đọc nhãn.

    // ĐÃ XÁC NHẬN với người yêu cầu (2026-11-06): nhãn KHÔNG cần tiền tố "Từ" - "5-6,9" (dấu phẩy,
    // không "Từ 5 - 6.9") là format được chấp nhận, không phải bug - khớp đúng UI thật trên cả DEV
    // lẫn STAGING.
    const labels = ["Dưới 5", "5-6,9", "7-8,9", "9-10"];
    for (const label of labels) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });

  /** Card đầy đủ (header chứa h3 + khối scroll chứa item) của 1 panel "Chưa nộp bài"/"Đã hoàn
   * thành" - ĐÃ XÁC NHẬN THẬT (dump DOM qua mock, 2026-11-11): heading nằm trong 1 div header
   * riêng (`h.parentElement`), SIBLING với 1 div `.overflow-y-auto` chứa toàn bộ item - card chung
   * là `h.parentElement.parentElement`. */
  async function findPanelCard(doc, heading) {
    const h = Array.from(doc.querySelectorAll("h3")).find((el) => el.textContent.trim().startsWith(heading));
    return h ? h.parentElement.parentElement : null;
  }

  /** Danh sách tên HS trong 1 panel THEO ĐÚNG THỨ TỰ DOM - dùng cho TC_016/023 (đủ số lượng trong
   * DOM dù giới hạn hiển thị 6). Tên là <span> lá (không phải avatar - avatar là <div> 2 ký tự) -
   * ĐÃ XÁC NHẬN THẬT qua dump DOM. KHÔNG dùng để test thứ tự sắp xếp (xem TC_014/019/020 đã bỏ). */
  async function readPanelNames(page, headingText) {
    return page.evaluate(
      ({ heading }) => {
        const h = Array.from(document.querySelectorAll("h3")).find((el) => el.textContent.trim().startsWith(heading));
        if (!h) return [];
        const card = h.parentElement.parentElement;
        return Array.from(card.querySelectorAll("span"))
          .filter((e) => e.children.length === 0 && e.textContent.trim().length > 1)
          .map((e) => e.textContent.trim());
      },
      { heading: headingText },
    );
  }

  /** Khối `.overflow-y-auto` bên trong card - container thật sự cho phép scroll (ĐÃ XÁC NHẬN THẬT
   * qua dump DOM) - dùng cho TC_016/023 (giới hạn 6 + scroll). */
  async function isPanelScrollable(page, headingText) {
    return page.evaluate((heading) => {
      const h = Array.from(document.querySelectorAll("h3")).find((el) => el.textContent.trim().startsWith(heading));
      if (!h) return null;
      const scrollBox = h.parentElement.parentElement.querySelector(".overflow-y-auto");
      return scrollBox ? scrollBox.scrollHeight > scrollBox.clientHeight + 2 : null;
    }, headingText);
  }

  function buildListsFixture() {
    const notSubmittedNames = ["Zoe", "Anna", "Mai", "Binh", "Chi", "Dao", "Em"]; // cố ý không theo abc.
    const submitted = [
      { id: "s1", name: "Khoa", score: 9 },
      { id: "s2", name: "Lan", score: 9 }, // hoà Khoa - Khoa đứng trước (K<L).
      { id: "s3", name: "Giang", score: 7 },
      { id: "s4", name: "Hoa", score: 7 }, // hoà Giang - Giang đứng trước (G<H).
      { id: "s5", name: "Chau", score: 5 },
      { id: "s6", name: "Duc", score: 5 }, // hoà Chau - Chau đứng trước (C<D).
      { id: "s7", name: "An", score: 3 },
    ];
    const roomAnalytic = buildRoomAnalytic({
      roomId,
      roomName: "Đề kiểm tra Mock 11",
      submitted,
      notSubmitted: notSubmittedNames.map((name, i) => ({ id: `n${i}`, name })),
    });
    const roomQuestionsAnalytic = buildRoomQuestionsAnalytic({
      roomId,
      roomName: "Đề kiểm tra Mock 11",
      totalStudents: submitted.length,
      questions: [{ questionId: "q1", questionIndex: 0, incorrectCount: 1, errorRate: 100 / submitted.length }],
    });
    const questionDetailAnalytic = buildQuestionDetailAnalytic({ questionId: "q1", question: { content: "Q1", title: "Q1" } });
    return { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic, notSubmittedNames, submitted };
  }

  test("TC_011 - label Tên đề hiển thị đúng tên đề đang chọn", async ({ page }) => {
    const { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic } = buildListsFixture();
    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });
    await expect(page.getByText("Đề kiểm tra Mock 11", { exact: true }).first()).toBeVisible();
  });

  test("TC_013 - tiêu đề Chưa nộp bài hiển thị đúng số lượng trong ngoặc", async ({ page }) => {
    const { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic } = buildListsFixture();
    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });
    await expect(page.getByText(reportPo.notSubmittedHeading(7))).toBeVisible();
  });

  // TC_014/019/020 (sắp xếp alphabet/điểm/tie-break) ĐÃ THỬ, phát hiện component KHÔNG tự sắp xếp
  // ở frontend: đưa mock data cố ý chưa sắp xếp (Zoe,Anna,Mai,...) thì DOM render NGUYÊN THỨ TỰ ĐÓ,
  // không resort lại - xác nhận qua dump DOM thật (2026-11-11). Nghĩa là việc sắp xếp (nếu đúng
  // spec) là xử lý phía BACKEND trước khi trả API, không phải logic component - cùng lý do TC_21 bị
  // loại (giá trị/thứ tự backend đã tính sẵn, mock bỏ qua backend nên không kiểm tra được qua tầng
  // này). KHÔNG viết 3 case này - viết sẽ chỉ là tự xác nhận lại chính dữ liệu mock đưa vào, không
  // chứng minh được gì về hành vi thật.

  test("TC_015 - mỗi học sinh Chưa nộp bài hiển thị avatar + tên, không hiện điểm", async ({ page }) => {
    const { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic } = buildListsFixture();
    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });
    const item = await page.evaluate(() => {
      const h = Array.from(document.querySelectorAll("h3")).find((el) => el.textContent.trim().startsWith("Chưa nộp bài"));
      const nameEl = Array.from(h.parentElement.parentElement.querySelectorAll("span")).find((s) => s.textContent.trim() === "Anna");
      const card = nameEl ? (nameEl.closest(".flex.items-center.gap-3") ?? nameEl.parentElement) : null;
      // Lấy riêng textContent (không lẫn số trong class CSS như "h-14.25") để kiểm tra "không hiện điểm".
      return card ? { html: card.outerHTML, text: card.textContent } : null;
    });
    // Avatar là <div> hiển thị CHỮ CÁI ĐẦU LẶP ĐÔI (vd Anna -> "AA"), không phải 2 ký tự đầu của
    // tên - ĐÃ XÁC NHẬN THẬT qua dump DOM (2026-11-11).
    expect(item.html).toContain("AA");
    expect(item.text).not.toMatch(/\d/); // không có điểm số (chỉ avatar+tên, cả 2 đều không phải số).
  });

  test("TC_016 - danh sách Chưa nộp bài cho phép scroll khi có hơn 6 học sinh", async ({ page }) => {
    const { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic, notSubmittedNames } = buildListsFixture();
    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });
    const names = await readPanelNames(page, "Chưa nộp bài");
    expect(names).toHaveLength(notSubmittedNames.length); // đủ cả 7 trong DOM, không bị cắt bớt.
    expect(await isPanelScrollable(page, "Chưa nộp bài")).toBe(true);
  });

  test("TC_018 - tiêu đề Đã hoàn thành hiển thị đúng số lượng trong ngoặc", async ({ page }) => {
    const { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic } = buildListsFixture();
    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });
    await expect(page.getByText(reportPo.completedHeading(7))).toBeVisible();
  });

  // TC_019/TC_020 bỏ - xem ghi chú ở TC_014 phía trên (component không tự sắp xếp, sắp xếp là
  // logic backend không kiểm tra được qua mock tầng này).

  test("TC_022 - mỗi học sinh Đã hoàn thành hiển thị avatar + tên + điểm", async ({ page }) => {
    const { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic } = buildListsFixture();
    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });
    await expect(page.getByText("Khoa", { exact: true })).toBeVisible();
    await expect(page.getByText("9.0", { exact: true }).or(page.getByText("9", { exact: true })).first()).toBeVisible();
  });

  test("TC_023 - danh sách Đã hoàn thành cho phép scroll khi có hơn 6 học sinh", async ({ page }) => {
    const { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic, submitted } = buildListsFixture();
    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });
    const names = await readPanelNames(page, "Đã hoàn thành");
    expect(names).toHaveLength(submitted.length);
    expect(await isPanelScrollable(page, "Đã hoàn thành")).toBe(true);
  });

  test("TC_024 - chọn 1 học sinh Đã hoàn thành mở đúng màn chi tiết bài làm", async ({ page }) => {
    const { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic } = buildListsFixture();
    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });
    const href = await page.getByRole("link", { name: "Khoa" }).getAttribute("href");
    expect(href).toBe(`/teacher/exercise/${roomId}/result/s1`);
  });

  test("TC_025 - chưa có học sinh nào nộp bài thì Đã hoàn thành (0)", async ({ page }) => {
    const roomAnalytic = buildRoomAnalytic({
      roomId,
      roomName: "Đề kiểm tra Mock 11",
      submitted: [],
      notSubmitted: [{ id: "n1", name: "An" }],
    });
    const roomQuestionsAnalytic = buildRoomQuestionsAnalytic({
      roomId,
      roomName: "Đề kiểm tra Mock 11",
      totalStudents: 1,
      questions: [{ questionId: "q1", questionIndex: 0, incorrectCount: 0, errorRate: 0 }],
    });
    const questionDetailAnalytic = buildQuestionDetailAnalytic({ questionId: "q1", question: { content: "Q1", title: "Q1" } });
    // KHÔNG dùng gotoMockedReport() ở đây: hàm đó chờ nút "Sai (N)" xuất hiện để xác nhận trang đã
    // tải xong, nhưng câu duy nhất có incorrect_count=0 nên bị ẩn khỏi biểu đồ hoàn toàn (đã xác
    // nhận ở các round trước) -> không có câu nào được auto-focus -> không có nút Sai/Đúng nào cả,
    // chờ mãi sẽ timeout. Tự điều hướng + chờ đúng heading cần kiểm tra thay vì nút Sai.
    const mockReportApi = await import("../../../../../automation/bao_cao_speaking/mock/mockReportApi.js");
    const { resolveTeacherPortalBaseUrl } = await import("../../../../../automation/src/config.js");
    await mockReportApi.mockSpeakingReportApi(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });
    await page.goto(`${resolveTeacherPortalBaseUrl("dev")}/teacher/exercise/${roomId}/report`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await expect(page.getByText(reportPo.completedHeading(0))).toBeVisible();
  });

  /** Chiều cao cột biểu đồ "Phổ điểm" quy đổi ra % dựa theo toạ độ 2 mốc trục Y "0%"/"100%" (không
   * hard-code toạ độ pixel cụ thể - khác viewport/số liệu vẫn đúng). */
  async function readScoreChartBarPercents(page) {
    return page.evaluate((heading) => {
      const h = Array.from(document.querySelectorAll("h3")).find((el) => el.textContent.trim() === heading);
      let node = h;
      let svg = null;
      for (let i = 0; i < 8 && node && !svg; i++) {
        node = node.parentElement;
        svg = node?.querySelector("svg") ?? null;
      }
      if (!svg) return null;
      const texts = Array.from(svg.querySelectorAll("text"));
      const tick0 = texts.find((t) => t.textContent.trim() === "0%");
      const tick100 = texts.find((t) => t.textContent.trim() === "100%");
      if (!tick0 || !tick100) return null;
      const y0 = tick0.getBoundingClientRect().top;
      const y100 = tick100.getBoundingClientRect().top;
      const bars = Array.from(svg.querySelectorAll("path"));
      return bars.map((p) => Math.round(((y0 - p.getBoundingClientRect().top) / (y0 - y100)) * 100));
    }, reportPo.errorAnalysisHeading === "Phân tích lỗi sai" ? "Phổ điểm" : "Phổ điểm");
  }

  /** Số hiển thị trên đầu mỗi cột "Phổ điểm" (SVG <text> số nguyên, nằm TRÊN heading "Phân tích lỗi
   * sai" - cùng kỹ thuật với getScoreDistributionSum() nhưng trả mảng theo thứ tự thay vì tổng). */
  async function readScoreChartCounts(page) {
    return page.evaluate((errorHeading) => {
      const analysisHeading = Array.from(document.querySelectorAll("h3")).find((h) => h.textContent.trim() === errorHeading);
      if (!analysisHeading) return null;
      const cutoffY = analysisHeading.getBoundingClientRect().y;
      return Array.from(document.querySelectorAll("svg text"))
        .filter((t) => /^\d+$/.test(t.textContent.trim()) && t.getBoundingClientRect().y < cutoffY)
        .map((t) => Number(t.textContent.trim()));
    }, reportPo.errorAnalysisHeading);
  }

  function buildScoreChartFixture() {
    const submitted = [
      { id: "p1", name: "P1", score: 3 },
      { id: "p2", name: "P2", score: 4 },
      { id: "p3", name: "P3", score: 8 },
      { id: "p4", name: "P4", score: 8.5 },
    ]; // below5=2(50%), 5-6.9=0, 7-8.9=2(50%), 9-10=0.
    const roomAnalytic = buildRoomAnalytic({ roomId, roomName: "Đề kiểm tra Mock Phổ điểm", submitted });
    const roomQuestionsAnalytic = buildRoomQuestionsAnalytic({
      roomId,
      roomName: "Đề kiểm tra Mock Phổ điểm",
      totalStudents: submitted.length,
      questions: [{ questionId: "q1", questionIndex: 0, incorrectCount: 1, errorRate: 25 }],
    });
    const questionDetailAnalytic = buildQuestionDetailAnalytic({ questionId: "q1", question: { content: "Q1", title: "Q1" } });
    return { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic };
  }

  test("TC_027 - trục Y biểu đồ Phổ điểm thể hiện đúng tỷ lệ % theo từng khoảng điểm", async ({ page }) => {
    const { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic } = buildScoreChartFixture();
    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });
    await getScoreDistributionSum(page); // chờ chart render xong.
    const percents = await readScoreChartBarPercents(page);
    // Dung sai ±10pp: path SVG có bo góc (rounded-rect), getBoundingClientRect().top của cột lấy
    // luôn phần đỉnh cong nên luôn lệch thấp hơn giá trị thật 1 chút - chấp nhận vì mục đích test
    // là xác nhận ĐÚNG TỶ LỆ TƯƠNG ĐỐI (2 cột bằng nhau ~50%), không phải đọc % hiển thị bằng mắt
    // (chart này không render text %, chỉ render số lượng - xem TC_028).
    expect(percents[0]).toBeGreaterThanOrEqual(40);
    expect(percents[0]).toBeLessThanOrEqual(60); // Dưới 5: 2/4 = 50%.
    expect(percents[2]).toBeGreaterThanOrEqual(40);
    expect(percents[2]).toBeLessThanOrEqual(60); // 7-8.9: 2/4 = 50%.
  });

  test("TC_028 - mỗi cột Phổ điểm hiển thị đúng số lượng học sinh trên đầu cột", async ({ page }) => {
    const { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic } = buildScoreChartFixture();
    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });
    await getScoreDistributionSum(page);
    const counts = await readScoreChartCounts(page);
    expect(counts).toEqual([2, 0, 2, 0]);
  });

  test("TC_029 - tổng tỷ lệ % của 4 cột Phổ điểm cộng lại bằng 100%", async ({ page }) => {
    const { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic } = buildScoreChartFixture();
    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });
    await getScoreDistributionSum(page);
    const percents = await readScoreChartBarPercents(page);
    const sum = percents.reduce((a, b) => a + b, 0);
    // Dung sai rộng (85-105) cùng lý do đã ghi ở TC_027 - vẫn đủ chặt để bắt lỗi thật (vd thiếu hẳn
    // 1 cột sẽ ra ~50, sai nghiêm trọng sẽ ra gần 0 hoặc gần 200).
    expect(sum).toBeGreaterThanOrEqual(85);
    expect(sum).toBeLessThanOrEqual(105);
  });

  test("TC_030 - khoảng điểm không có học sinh nào vẫn hiển thị cột giá trị 0, không bị ẩn", async ({ page }) => {
    const { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic } = buildScoreChartFixture();
    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });
    await getScoreDistributionSum(page);
    await expect(page.getByText("5-6,9", { exact: true })).toBeVisible(); // bucket 0 HS vẫn còn nhãn trục X.
    await expect(page.getByText("9-10", { exact: true })).toBeVisible();
    const counts = await readScoreChartCounts(page);
    expect(counts[1]).toBe(0);
    expect(counts[3]).toBe(0);
  });

  /** Đọc toàn bộ cột "C{n}" đang hiển thị trong biểu đồ "Phân tích lỗi sai" theo đúng thứ tự
   * trái->phải - dùng cho TC_033/034 (thứ tự KHÔNG theo số sai nhiều->ít, câu hỏi nhóm đánh số liên
   * tục). KHÔNG dùng cho TC_032/035/036/037 (xem docblock đầu file - vùng >10 câu chưa rõ thuật toán). */
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

  test("TC_033 - các câu trong biểu đồ Phân tích lỗi sai sắp xếp theo thứ tự xuất hiện, không theo số sai", async ({ page }) => {
    // Câu 2 (index1) sai NHIỀU NHẤT (3) nhưng phải vẫn hiển thị Ở GIỮA (C1,C2,C3), không nhảy lên đầu.
    const roomAnalytic = buildRoomAnalytic({ roomId, roomName: "Đề kiểm tra Mock 33", submitted: [{ id: "u1", name: "HS A", score: 5 }] });
    const roomQuestionsAnalytic = buildRoomQuestionsAnalytic({
      roomId,
      roomName: "Đề kiểm tra Mock 33",
      totalStudents: 3,
      questions: [
        { questionId: "q1", questionIndex: 0, incorrectCount: 1, errorRate: 33.33 },
        { questionId: "q2", questionIndex: 1, incorrectCount: 3, errorRate: 100 },
        { questionId: "q3", questionIndex: 2, incorrectCount: 2, errorRate: 66.67 },
      ],
    });
    const questionDetailAnalytic = buildQuestionDetailAnalytic({ questionId: "q2", index: 1, question: { content: "Q2", title: "Q2" } });
    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });
    const labels = await readErrorChartColumnLabels(page);
    expect(labels).toEqual(["C1", "C2", "C3"]);
  });

  test("TC_034 - câu hỏi nhóm: mỗi câu con tính độc lập, đánh số liên tục (không gộp vào 1 câu)", async ({ page }) => {
    // 1 GROUP (index0) + 3 câu con (index1,2,3) - nhãn phải là C1,C2,C3 (bỏ qua GROUP, KHÔNG phải
    // C2,C3,C4 - đã xác nhận qua dữ liệu thật, xem docblock đầu file).
    const roomAnalytic = buildRoomAnalytic({ roomId, roomName: "Đề kiểm tra Mock 34", submitted: [{ id: "u1", name: "HS A", score: 5 }] });
    const roomQuestionsAnalytic = {
      status: true,
      room_id: roomId,
      room_name: "Đề kiểm tra Mock 34",
      exam_id: "22222222-2222-2222-2222-222222222222",
      total_students: 1,
      questions_analysis: [
        { question_id: "g0", question_index: 0, type: "GROUP", answer_stats: {}, correct_answer: '""', incorrect_count: 0, error_rate: 0 },
        { question_id: "q1", question_index: 1, type: "ONE", answer_stats: {}, correct_answer: '""', incorrect_count: 1, error_rate: 100 },
        { question_id: "q2", question_index: 2, type: "ONE", answer_stats: {}, correct_answer: '""', incorrect_count: 1, error_rate: 100 },
        { question_id: "q3", question_index: 3, type: "ONE", answer_stats: {}, correct_answer: '""', incorrect_count: 1, error_rate: 100 },
      ],
    };
    const questionDetailAnalytic = buildQuestionDetailAnalytic({ questionId: "q1", index: 1, question: { content: "Q1", title: "Q1" } });
    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });
    const labels = await readErrorChartColumnLabels(page);
    expect(labels).toEqual(["C1", "C2", "C3"]);
  });

  // --- Nhóm MCQ (loại câu "ONE") - 2 câu, cả 2 đều có HS sai nên không đụng tới vùng chưa rõ thuật
  // toán (giới hạn 10 cột) - xem docblock đầu file.
  function mcqRoomQuestionsAnalytic() {
    return {
      status: true,
      room_id: roomId,
      room_name: "Đề luyện tập mock",
      exam_id: "11111111-1111-1111-1111-111111111111",
      total_students: 2,
      questions_analysis: [
        { question_id: "q1", question_index: 0, type: "ONE", answer_stats: {}, correct_answer: '"B"', incorrect_count: 1, error_rate: 50 },
        { question_id: "q2", question_index: 1, type: "ONE", answer_stats: {}, correct_answer: '"Y"', incorrect_count: 2, error_rate: 100 },
      ],
    };
  }

  /** question-detail-analytic schema thật loại "ONE" (xem docblock đầu file) - KHÔNG dùng chung
   * buildQuestionDetailAnalytic (đó là schema "SPEAK"). */
  function buildMcqQuestionDetail({ questionId, index, content, answers, correct, explainAnswer = "", correctAnswerGroups = [], incorrectAnswerGroups = [] }) {
    return {
      status: true,
      id: questionId,
      index,
      question: { content, content_label: "", explain_answer: explainAnswer, suggest: "" },
      type: "ONE",
      answers,
      correct,
      correct_answer_groups: correctAnswerGroups,
      incorrect_answer_groups: incorrectAnswerGroups,
      total_answered: correctAnswerGroups.length + incorrectAnswerGroups.length,
      correct_count: correctAnswerGroups.length,
      incorrect_count: incorrectAnswerGroups.length,
    };
  }

  const q1Detail = buildMcqQuestionDetail({
    questionId: "q1",
    index: 0,
    content: "Nội dung câu 1 mock",
    answers: [
      { id: "A", content: "Option A", image: "" },
      { id: "B", content: "Option B dung", image: "" },
      { id: "C", content: "Option C", image: "" },
      { id: "D", content: "Option D", image: "" },
    ],
    correct: "B",
    explainAnswer: "Đáp án đúng là B",
    correctAnswerGroups: [{ user_id: "u1", user_name: "HS Dung", avatar: "", answer: "B", is_correct: true }],
    incorrectAnswerGroups: [{ user_id: "u2", user_name: "HS Sai", avatar: "", answer: "A", is_correct: false }],
  });

  const q2Detail = buildMcqQuestionDetail({
    questionId: "q2",
    index: 1,
    content: "Nội dung câu 2 mock",
    answers: [
      { id: "X", content: "Option X", image: "" },
      { id: "Y", content: "Option Y dung", image: "" },
    ],
    correct: "Y",
    explainAnswer: "",
    incorrectAnswerGroups: [
      { user_id: "u3", user_name: "HS Sai 1", avatar: "", answer: "X", is_correct: false },
      { user_id: "u4", user_name: "HS Sai 2", avatar: "", answer: "X", is_correct: false },
    ],
  });

  /** Mock question-detail-analytic trả theo ĐÚNG question_id được yêu cầu (q1 hoặc q2) - 2 câu nên
   * không thể dùng 1 response tĩnh như các test khác ở trên. */
  async function gotoMcqMockedReport(page) {
    const roomAnalytic = buildRoomAnalytic({
      roomId,
      roomName: "Đề luyện tập mock",
      submitted: [
        { id: "u1", name: "HS Dung", score: 10 },
        { id: "u2", name: "HS Sai", score: 5 },
      ],
    });
    await page.route("**/api/user/report-stats/room-analytic**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(roomAnalytic) }),
    );
    await page.route("**/api/user/report-stats/room-questions-analytic**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mcqRoomQuestionsAnalytic()) }),
    );
    await page.route("**/api/user/report-stats/question-detail-analytic**", (route) => {
      const url = new URL(route.request().url());
      const detail = url.searchParams.get("question_id") === "q2" ? q2Detail : q1Detail;
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(detail) });
    });
    const { resolveTeacherPortalBaseUrl } = await import("../../../../../automation/src/config.js");
    await page.goto(`${resolveTeacherPortalBaseUrl("dev")}/teacher/exercise/${roomId}/report`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.getByRole("button", { name: /^Sai \(\d+\)$/ }).waitFor({ timeout: 30000 });
  }

  /** 1 item học sinh trong danh sách Sai/Đúng của câu MCQ đang chọn - scope theo panel
   * `lg:w-[40%]` (cùng selector đã xác nhận thật ở speakingReportPageObjects.js#questionDetailPanel)
   * để không khớp nhầm panel "Đã hoàn thành" phía trên. */
  function mcqStudentItem(page, studentName) {
    return page.locator('div[class*="lg:w-\\[40\\%\\]"]').getByText(studentName, { exact: true });
  }

  test("TC_038/039 - chọn cột câu khác cập nhật đúng Chi tiết câu hỏi", async ({ page }) => {
    await gotoMcqMockedReport(page);
    // exact:true bắt buộc - nội dung mock "Nội dung câu 2 mock" cũng chứa substring "câu 2" nên
    // getByText mặc định (không phân biệt hoa/thường, khớp substring) sẽ khớp nhầm cả 2 phần tử.
    await expect(page.getByText(reportPo.currentQuestionBadge(2), { exact: true })).toBeVisible(); // mặc định focus câu 2 (2 HS sai, nhiều hơn câu 1).

    await page.getByText("C1", { exact: true }).click();
    await expect(page.getByText(reportPo.currentQuestionBadge(1), { exact: true })).toBeVisible();
    await expect(page.getByText("Nội dung câu 1 mock")).toBeVisible();
    await expect(page.getByText("Option A")).toBeVisible();
  });

  test("TC_040 - đáp án đúng được đánh dấu rõ so với các lựa chọn khác", async ({ page }) => {
    await gotoMcqMockedReport(page);
    await page.getByText("C1", { exact: true }).click();
    await expect(page.getByText("Option A")).toBeVisible();

    const classes = await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll("*")).filter(
        (e) => e.children.length === 0 && /^Option [A-D]/.test(e.textContent.trim()),
      );
      return opts.map((e) => ({ text: e.textContent.trim(), cardCls: e.closest('[class*="rounded-xl"]')?.className ?? "" }));
    });
    const correctOpt = classes.find((c) => c.text.startsWith("Option B"));
    const wrongOpt = classes.find((c) => c.text.startsWith("Option A"));
    // "border-main!" (Tailwind important-modifier, có dấu "!") là marker THẬT của đáp án đúng -
    // KHÔNG dùng "border-main" trần vì mọi option đều có biến thể hover "hover:...:border-main"
    // (không có "!") sẵn trong class tĩnh, dù không active.
    expect(correctOpt.cardCls).toContain("border-main!");
    expect(wrongOpt.cardCls).not.toContain("border-main!");
  });

  test("TC_041 - hiển thị Giải thích đáp án khi câu hỏi có nội dung giải thích", async ({ page }) => {
    await gotoMcqMockedReport(page);
    await page.getByText("C1", { exact: true }).click(); // câu 1 có explain_answer.
    await expect(page.getByText("Đáp án đúng là B")).toBeVisible();
  });

  test("TC_042 - ẩn mục Giải thích đáp án khi câu hỏi không có nội dung giải thích", async ({ page }) => {
    await gotoMcqMockedReport(page); // mặc định mở câu 2 - explain_answer rỗng.
    await expect(page.getByText("Nội dung câu 2 mock")).toBeVisible();
    expect(await page.getByText("Giải thích", { exact: false }).count()).toBe(0);
  });

  test("TC_043 - segmented 'Sai' hiển thị đúng danh sách học sinh làm sai câu đang chọn", async ({ page }) => {
    await gotoMcqMockedReport(page); // mặc định câu 2, 2 HS sai.
    await page.getByRole("button", { name: /^Sai \(2\)$/ }).click();
    await expect(mcqStudentItem(page, "HS Sai 1")).toBeVisible();
    await expect(mcqStudentItem(page, "HS Sai 2")).toBeVisible();
  });

  test("TC_044 - segmented 'Đúng' hiển thị đúng danh sách học sinh làm đúng câu đang chọn", async ({ page }) => {
    await gotoMcqMockedReport(page);
    await page.getByText("C1", { exact: true }).click(); // câu 1: 1 đúng (HS Dung), 1 sai (HS Sai).
    await page.getByRole("button", { name: /^Đúng \(1\)$/ }).click();
    await expect(mcqStudentItem(page, "HS Dung")).toBeVisible();
  });

  test("TC_045 - danh sách Sai/Đúng KHÔNG hiển thị lựa chọn học sinh đã chọn (bug đã xác nhận)", async ({ page }) => {
    await gotoMcqMockedReport(page);
    await page.getByText("C1", { exact: true }).click();
    await page.getByRole("button", { name: /^Sai \(1\)$/ }).click();
    await expect(mcqStudentItem(page, "HS Sai")).toBeVisible();

    // BUG ĐÃ XÁC NHẬN THẬT (DOM dump trên staging, xem project_par3169_baocaolop_staging_run.md):
    // item chỉ có avatar+tên, KHÔNG có lựa chọn/đáp án đã chọn ("A") dù API đã trả đủ field `answer`.
    const itemHtml = await mcqStudentItem(page, "HS Sai").locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]").innerHTML();
    expect(itemHtml).not.toContain("Option A");
  });
});
