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
  studentScoreBadge,
} from "../../../../../automation/bao_cao_speaking/navigation/speakingReportPageObjects.js";

/**
 * Nhóm I (TC_050/051 - định dạng transcription) của TestCase_BaoCaoSpeaking.xlsx - Tầng 2 (mock).
 *
 * TC_050 dựng 2 câu hỏi mock với `content_type` khác nhau (ĐÃ XÁC NHẬN THẬT tồn tại trong schema
 * thật - network capture 2026-09-11 thấy cả "word" (câu "clothes") lẫn "sentence" ("Bring reusable
 * water bottles...")) - kiểm tra cả 2 dạng đều hiển thị đủ nội dung khi mở rộng, không lỗi/rỗng.
 *
 * TC_051 trùng cơ chế với TC_053 (Nhóm A) - viết ngắn gọn ở đây cho traceability, không lặp lại
 * toàn bộ Nhóm A.
 */
test.describe("Báo cáo Speaking - Nhóm I: định dạng transcription", () => {
  test.skip(
    !config.teacherUsernameSpeakingReport || !config.teacherPasswordSpeakingReport,
    "Thiếu TEACHER_USERNAME_SPEAKING_REPORT/TEACHER_PASSWORD_SPEAKING_REPORT trong .env.",
  );

  test("TC_050 - câu trả lời ngắn (1 từ) và dài (cả câu) đều hiển thị đúng, không vỡ layout", async ({
    page,
  }) => {
    const roomAnalytic = buildRoomAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      submitted: [
        { id: "u1", name: "Short Answer Kid", score: 5 },
        { id: "u2", name: "Long Answer Kid", score: 5 },
      ],
    });
    const roomQuestionsAnalytic = buildRoomQuestionsAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      totalStudents: 2,
      questions: [{ questionId: "q1", questionIndex: 0, incorrectCount: 2, errorRate: 100 }],
    });
    const questionDetailAnalytic = buildQuestionDetailAnalytic({
      questionId: "q1",
      index: 0,
      question: { content: "Mixed length answers", title: "Mixed Length Question" },
      incorrectAnswers: [
        buildStudentAnswer({
          userId: "u1",
          userName: "Short Answer Kid",
          accuracyScore: 30,
          isCorrect: false,
          words: [{ text: "clothes", isError: true }], // content_type: "word" (1 từ, ngắn)
        }),
        buildStudentAnswer({
          userId: "u2",
          userName: "Long Answer Kid",
          accuracyScore: 40,
          isCorrect: false,
          words: [
            { text: "Bring", isError: false },
            { text: "reusable", isError: true },
            { text: "water", isError: true },
            { text: "bottles", isError: true },
            { text: "to", isError: false },
            { text: "school", isError: false },
          ], // content_type: "sentence" (câu dài)
        }),
      ],
    });

    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });

    await studentAnswerCard(page, "Short Answer Kid").click();
    await expect(page.getByText("clothes", { exact: true })).toBeVisible();

    await studentAnswerCard(page, "Long Answer Kid").click();
    await expect(
      page.getByText("Bring reusable water bottles to school", { exact: false }),
    ).toBeVisible();

    // Cả 2 thẻ đều còn hiển thị đủ audio + badge (không vỡ layout do độ dài nội dung khác nhau).
    await expect(
      studentAnswerCard(page, "Short Answer Kid").getByRole("button", {
        name: reportPo.audioButtonName,
      }),
    ).toBeVisible();
    await expect(
      studentAnswerCard(page, "Long Answer Kid").getByRole("button", {
        name: reportPo.audioButtonName,
      }),
    ).toBeVisible();
  });

  test("TC_051 - thẻ thu gọn hiện % kèm màu đúng theo ngưỡng", async ({ page }) => {
    const roomAnalytic = buildRoomAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      submitted: [{ id: "u1", name: "Collapsed Kid", score: 2 }],
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
      incorrectAnswers: [
        buildStudentAnswer({ userId: "u1", userName: "Collapsed Kid", accuracyScore: 15, isCorrect: false }),
      ],
    });

    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });

    // Thẻ đang thu gọn (chưa bấm gì) - badge % vẫn hiện đúng số + màu đỏ (Sai).
    await expect(studentScoreBadge(page, "Collapsed Kid")).toHaveText("15%");
    await expect(studentScoreBadge(page, "Collapsed Kid")).toHaveCSS(
      "color",
      reportPo.wrongBadgeColorRgb,
    );
  });

  test("TC_052 (Phase 2) - % badge thẻ thu gọn khớp % badge khi mở rộng (cùng 1 HS)", async ({
    page,
  }) => {
    const roomAnalytic = buildRoomAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      submitted: [{ id: "u1", name: "Consistency Kid", score: 6 }],
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
      incorrectAnswers: [
        buildStudentAnswer({ userId: "u1", userName: "Consistency Kid", accuracyScore: 62, isCorrect: false }),
      ],
    });

    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });

    // Đọc % lúc thẻ ĐANG THU GỌN.
    const collapsedText = await studentScoreBadge(page, "Consistency Kid").textContent();

    await studentAnswerCard(page, "Consistency Kid").click(); // mở rộng

    // Đọc lại % lúc thẻ ĐANG MỞ RỘNG - phải khớp y hệt (không lệch do 2 nguồn dữ liệu khác nhau
    // trên FE, không phải giả định - đây chính là điều TC_052 muốn xác nhận).
    const expandedText = await studentScoreBadge(page, "Consistency Kid").textContent();
    expect(expandedText).toBe(collapsedText);
    expect(expandedText).toBe("62%");
  });
});
