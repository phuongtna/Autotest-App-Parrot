import { test, expect } from "../../../../../automation/bao_cao_speaking/playwrightTest.js";
import { config } from "../../../../../automation/src/config.js";
import { gotoMockedReport } from "../../../../../automation/bao_cao_speaking/mock/mockReportApi.js";
import { buildRoomAnalytic } from "../../../../../automation/bao_cao_speaking/fixtures/roomAnalyticFixture.js";
import { buildRoomQuestionsAnalytic } from "../../../../../automation/bao_cao_speaking/fixtures/roomQuestionsAnalyticFixture.js";
import {
  buildQuestionDetailAnalytic,
  buildStudentAnswer,
} from "../../../../../automation/bao_cao_speaking/fixtures/questionDetailAnalyticFixture.js";
import {
  po as reportPo,
  studentAnswerCard,
  questionCell,
  getScoreDistributionSum,
} from "../../../../../automation/bao_cao_speaking/navigation/speakingReportPageObjects.js";

/**
 * Nhóm H (TC_043/045/046/047/048/054 - tổng quan Báo cáo lớp) của TestCase_BaoCaoSpeaking.xlsx -
 * Tầng 2 (mock) cho phần cần dữ liệu chính xác (TC_045/046), Tầng 1 concept áp dụng qua mock cho
 * phần đếm số lượng (TC_043/054).
 *
 * TC_045 dùng getScoreDistributionSum() - ĐÃ XÁC NHẬN THẬT (2026-09-11): 4 số trên biểu đồ "Phổ
 * điểm" là <text> SVG (Recharts), cần chờ ĐỦ LÂU (~2.5s) sau khi trang tải mới render xong (chart
 * có animation vào) - xem gotoMockedReport().
 *
 * TC_046 dùng class SVG thật "fill-error-dark" (>=50% sai)/"fill-slate-400" (<50% sai) trên nhãn
 * "C{n}" - KHÔNG dùng background-color (đã thử, không tin cậy vì đây là SVG <text>, không phải
 * div nền).
 */
test.describe("Báo cáo Speaking - Nhóm H: tổng quan Báo cáo lớp", () => {
  test.skip(
    !config.teacherUsernameSpeakingReport || !config.teacherPasswordSpeakingReport,
    "Thiếu TEACHER_USERNAME_SPEAKING_REPORT/TEACHER_PASSWORD_SPEAKING_REPORT trong .env.",
  );

  test("TC_043 - HS 'Chưa nộp bài' KHÔNG xuất hiện ở tab Sai/Đúng của bất kỳ câu nào", async ({
    page,
  }) => {
    const roomAnalytic = buildRoomAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      submitted: [{ id: "u1", name: "Submitted Kid", score: 7 }],
      notSubmitted: [{ id: "u2", name: "NotSubmitted Kid" }],
    });
    const roomQuestionsAnalytic = buildRoomQuestionsAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      totalStudents: 1,
      questions: [
        { questionId: "q1", questionIndex: 0, incorrectCount: 0, errorRate: 0 },
        { questionId: "q2", questionIndex: 1, incorrectCount: 1, errorRate: 100 },
      ],
    });
    // Chỉ mock ĐÚNG 1 câu chi tiết (q1) - đủ để xác nhận "NotSubmitted Kid" không xuất hiện dù
    // trang mặc định chọn câu nào trong 2 câu trên (KHÔNG bao giờ có tên HS chưa nộp bài trong dữ
    // liệu answer_groups vì fixture không đưa họ vào).
    const questionDetailAnalytic = buildQuestionDetailAnalytic({
      questionId: "q1",
      index: 0,
      question: { content: "Q1", title: "Q1" },
      correctAnswers: [
        buildStudentAnswer({ userId: "u1", userName: "Submitted Kid", accuracyScore: 90, isCorrect: true }),
      ],
    });

    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });

    // SỬA (2026-09-11, FAIL thật xác nhận qua chạy live): "NotSubmitted Kid" ĐÚNG RA có xuất hiện
    // 1 lần trên trang - trong panel "Chưa nộp bài" ở đầu trang (đúng, mong muốn) - kiểm tra text
    // xuất hiện ở BẤT KỲ ĐÂU là sai ý đồ test. Phải kiểm tra cụ thể KHÔNG có trong danh sách thẻ
    // Sai/Đúng (dùng studentAnswerCard - chỉ khớp thẻ có kèm nút audio, panel "Chưa nộp bài"
    // không có nút audio nên không bao giờ khớp nhầm).
    await expect(studentAnswerCard(page, "NotSubmitted Kid")).toHaveCount(0);
    await page.getByRole("button", { name: reportPo.correctTabAny }).click();
    await expect(studentAnswerCard(page, "NotSubmitted Kid")).toHaveCount(0);
  });

  test("TC_045 - tổng số trên 'Phổ điểm' = số 'Đã hoàn thành'", async ({ page }) => {
    const submitted = [
      { id: "u1", name: "P1", score: 3 },
      { id: "u2", name: "P2", score: 3.5 },
      { id: "u3", name: "P3", score: 6 },
      { id: "u4", name: "P4", score: 9.5 },
    ];
    const roomAnalytic = buildRoomAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      submitted,
    });
    const roomQuestionsAnalytic = buildRoomQuestionsAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      totalStudents: submitted.length,
      questions: [{ questionId: "q1", questionIndex: 0, incorrectCount: 0, errorRate: 0 }],
    });
    const questionDetailAnalytic = buildQuestionDetailAnalytic({
      questionId: "q1",
      index: 0,
      question: { content: "Q1", title: "Q1" },
      correctAnswers: [buildStudentAnswer({ userId: "u1", userName: "P1", accuracyScore: 80, isCorrect: true })],
    });

    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });
    await expect(page.getByText(reportPo.completedHeading(submitted.length))).toBeVisible();

    // getScoreDistributionSum tự poll tới khi chart Recharts render xong (xem comment hàm đó) -
    // không cần chờ cố định ở đây nữa (SỬA 2026-09-11, FAIL thật: 2500ms cố định không đủ khi chạy
    // trong bộ suite đầy đủ).
    const sum = await getScoreDistributionSum(page);
    expect(sum).toBe(submitted.length);
  });

  test("TC_046 - ô câu hỏi trong 'Phân tích lỗi sai' tô đúng màu theo ngưỡng ≥50%/<50%", async ({
    page,
  }) => {
    const roomAnalytic = buildRoomAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      submitted: [{ id: "u1", name: "S1", score: 5 }],
    });
    const roomQuestionsAnalytic = buildRoomQuestionsAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      totalStudents: 1,
      questions: [
        { questionId: "q-high", questionIndex: 0, incorrectCount: 1, errorRate: 100 },
        { questionId: "q-low", questionIndex: 1, incorrectCount: 0, errorRate: 20 },
      ],
    });
    const questionDetailAnalytic = buildQuestionDetailAnalytic({
      questionId: "q-high",
      index: 0,
      question: { content: "Q high", title: "Q high" },
      incorrectAnswers: [buildStudentAnswer({ userId: "u1", userName: "S1", accuracyScore: 10, isCorrect: false })],
    });

    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });
    await page.waitForTimeout(2500);

    await expect(questionCell(page, 1)).toHaveClass(new RegExp(reportPo.errorRateHighClass));
    await expect(questionCell(page, 2)).toHaveClass(new RegExp(reportPo.errorRateLowClass));
  });

  test("TC_047 - bấm chọn ô câu hỏi khác -> panel chi tiết cập nhật đúng câu", async ({ page }) => {
    const roomAnalytic = buildRoomAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      submitted: [{ id: "u1", name: "S1", score: 5 }],
    });
    const roomQuestionsAnalytic = buildRoomQuestionsAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      totalStudents: 1,
      questions: [
        { questionId: "q1", questionIndex: 0, incorrectCount: 1, errorRate: 100 },
        { questionId: "q2", questionIndex: 1, incorrectCount: 0, errorRate: 0 },
      ],
    });
    // Trả lời khác nhau theo question_id trong query string - xem mockSpeakingReportApi (route
    // theo pattern chung "**/question-detail-analytic**", tự đọc query để trả đúng câu được bấm).
    await page.route("**/api/user/report-stats/question-detail-analytic**", (route) => {
      const url = new URL(route.request().url());
      const qid = url.searchParams.get("question_id");
      const data =
        qid === "q2"
          ? buildQuestionDetailAnalytic({
              questionId: "q2",
              index: 1,
              question: { content: "Content of Q2", title: "Title Q2" },
              correctAnswers: [buildStudentAnswer({ userId: "u1", userName: "S1", accuracyScore: 90, isCorrect: true })],
            })
          : buildQuestionDetailAnalytic({
              questionId: "q1",
              index: 0,
              question: { content: "Content of Q1", title: "Title Q1" },
              incorrectAnswers: [buildStudentAnswer({ userId: "u1", userName: "S1", accuracyScore: 20, isCorrect: false })],
            });
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    });
    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic });

    await expect(page.getByText("Title Q1")).toBeVisible();

    await questionCell(page, 2).click();

    await expect(page.getByText("Title Q2")).toBeVisible();
    await expect(page.getByText("Content of Q2")).toBeVisible();
    await expect(page.getByText("Title Q1")).toHaveCount(0);
  });

  test("TC_048 - tên tab hiển thị đúng 'Sai'/'Đúng'", async ({ page }) => {
    const roomAnalytic = buildRoomAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      submitted: [{ id: "u1", name: "S1", score: 5 }],
    });
    const roomQuestionsAnalytic = buildRoomQuestionsAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      totalStudents: 1,
      questions: [{ questionId: "q1", questionIndex: 0, incorrectCount: 1, errorRate: 100 }],
    });
    const questionDetailAnalytic = buildQuestionDetailAnalytic({
      questionId: "q1",
      index: 0,
      question: { content: "Q1", title: "Q1" },
      incorrectAnswers: [buildStudentAnswer({ userId: "u1", userName: "S1", accuracyScore: 10, isCorrect: false })],
    });

    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });

    await expect(page.getByRole("button", { name: reportPo.wrongTabAny })).toContainText("Sai");
    await expect(page.getByRole("button", { name: reportPo.correctTabAny })).toContainText("Đúng");
  });

  test("TC_054 - 'Chưa nộp bài' rỗng -> hiện thông báo hoàn thành, không hiện list rỗng", async ({
    page,
  }) => {
    const roomAnalytic = buildRoomAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      submitted: [{ id: "u1", name: "S1", score: 5 }],
      notSubmitted: [],
    });
    const roomQuestionsAnalytic = buildRoomQuestionsAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      totalStudents: 1,
      questions: [{ questionId: "q1", questionIndex: 0, incorrectCount: 0, errorRate: 0 }],
    });
    const questionDetailAnalytic = buildQuestionDetailAnalytic({
      questionId: "q1",
      index: 0,
      question: { content: "Q1", title: "Q1" },
      correctAnswers: [buildStudentAnswer({ userId: "u1", userName: "S1", accuracyScore: 90, isCorrect: true })],
    });

    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });

    await expect(page.getByText(reportPo.notSubmittedHeading(0))).toBeVisible();
    await expect(page.getByText(reportPo.allSubmittedMessage)).toBeVisible();
  });
});
