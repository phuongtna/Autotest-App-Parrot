import { test, expect } from "../../../../../automation/bao_cao_speaking/playwrightTest.js";
import { config } from "../../../../../automation/src/config.js";
import { gotoMockedReport } from "../../../../../automation/bao_cao_speaking/mock/mockReportApi.js";
import { buildRoomAnalytic } from "../../../../../automation/bao_cao_speaking/fixtures/roomAnalyticFixture.js";
import { buildRoomQuestionsAnalytic } from "../../../../../automation/bao_cao_speaking/fixtures/roomQuestionsAnalyticFixture.js";
import { buildQuestionDetailAnalytic } from "../../../../../automation/bao_cao_speaking/fixtures/questionDetailAnalyticFixture.js";
import { po as reportPo } from "../../../../../automation/bao_cao_speaking/navigation/speakingReportPageObjects.js";

/**
 * Nhóm F (TC_037 - câu hỏi Speaking chưa ai làm) của TestCase_BaoCaoSpeaking.xlsx - Tầng 2 (mock),
 * vì cần 1 câu hỏi Speaking với 0 lượt trả lời tuyệt đối - không chắc tìm được sẵn trên dữ liệu
 * thật của room đang dùng cho Nhóm B/C (mọi câu đều đã có HS làm).
 */
const QUESTION_ID = "mock-q-group-f";

test.describe("Báo cáo Speaking - Nhóm F: trường hợp đặc biệt", () => {
  test.skip(
    !config.teacherUsernameSpeakingReport || !config.teacherPasswordSpeakingReport,
    "Thiếu TEACHER_USERNAME_SPEAKING_REPORT/TEACHER_PASSWORD_SPEAKING_REPORT trong .env.",
  );

  test("TC_037 - câu hỏi Speaking chưa ai làm: cả 2 badge = 0, empty-state khi chọn tab", async ({
    page,
  }) => {
    const roomAnalytic = buildRoomAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      // HS đã nộp bài nói chung (không phải phụ thuộc câu này) - vẫn cần ít nhất 1 HS "đã hoàn
      // thành" để trang report có nội dung hợp lệ, nhưng câu Speaking đang xét thì KHÔNG ai trả lời.
      submitted: [{ id: "u1", name: "Answered Other Q", score: 8 }],
    });
    const roomQuestionsAnalytic = buildRoomQuestionsAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      totalStudents: 1,
      questions: [{ questionId: QUESTION_ID, questionIndex: 0, incorrectCount: 0, errorRate: 0 }],
    });
    const questionDetailAnalytic = buildQuestionDetailAnalytic({
      questionId: QUESTION_ID,
      index: 0,
      question: { content: "Unanswered content", title: "Unanswered Question" },
      correctAnswers: [],
      incorrectAnswers: [],
    });

    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });

    await expect(page.getByRole("button", { name: "Sai (0)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Đúng (0)" })).toBeVisible();

    // Tab "Sai" mặc định active (xem Nhóm B/C) - đã rỗng sẵn.
    await expect(page.getByText(reportPo.emptyTabMessage)).toBeVisible();

    await page.getByRole("button", { name: "Đúng (0)" }).click();
    await expect(page.getByText(reportPo.emptyTabMessage)).toBeVisible();
  });
});
