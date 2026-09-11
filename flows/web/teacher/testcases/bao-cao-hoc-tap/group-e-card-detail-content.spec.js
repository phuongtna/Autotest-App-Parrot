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
  transcriptionWord,
} from "../../../../../automation/bao_cao_speaking/navigation/speakingReportPageObjects.js";

/**
 * Nhóm E (TC_032/033 - nội dung chi tiết khi mở rộng thẻ) của TestCase_BaoCaoSpeaking.xlsx.
 *
 * TC_032 tái dùng Tầng 1 (đã xác nhận thật ở Nhóm B/C: avatar/tên/audio/badge/label "Học sinh
 * phát âm là:" đều hiển thị khi mở rộng) - viết lại tường minh ở đây bằng mock cho traceability
 * với mã case gốc, không cần navigate qua room thật.
 *
 * TC_033 (tô đỏ từ sai) BẮT BUỘC Tầng 2 (mock) - ĐÃ XÁC NHẬN THẬT qua HTML dump 2026-09-11: mỗi
 * từ là 1 `<span>` riêng, từ có `assessment_details[].is_error=true` -> `class="text-[#FF3B30]"`
 * (rgb(255,59,48)), từ đúng giữ màu mặc định (không có class màu).
 */
const QUESTION_ID = "mock-q-group-e";

test.describe("Báo cáo Speaking - Nhóm E: nội dung chi tiết khi mở rộng thẻ", () => {
  test.skip(
    !config.teacherUsernameSpeakingReport || !config.teacherPasswordSpeakingReport,
    "Thiếu TEACHER_USERNAME_SPEAKING_REPORT/TEACHER_PASSWORD_SPEAKING_REPORT trong .env.",
  );

  test("TC_032 - mở rộng thẻ hiện đủ avatar/%/audio/label transcription", async ({ page }) => {
    const roomAnalytic = buildRoomAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      submitted: [{ id: "u1", name: "Detail Student", score: 4 }],
    });
    const roomQuestionsAnalytic = buildRoomQuestionsAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      totalStudents: 1,
      questions: [{ questionId: QUESTION_ID, questionIndex: 0, incorrectCount: 1, errorRate: 100 }],
    });
    const questionDetailAnalytic = buildQuestionDetailAnalytic({
      questionId: QUESTION_ID,
      index: 0,
      question: { content: "Detail content", title: "Detail Question" },
      incorrectAnswers: [
        buildStudentAnswer({
          userId: "u1",
          userName: "Detail Student",
          accuracyScore: 40,
          isCorrect: false,
          words: [{ text: "hello", isError: true }],
        }),
      ],
    });

    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });

    const card = studentAnswerCard(page, "Detail Student");
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: reportPo.audioButtonName })).toBeVisible();
    await expect(studentScoreBadge(page, "Detail Student")).toHaveText("40%");

    await card.click();

    await expect(page.getByText(reportPo.expandedTranscriptionLabel)).toBeVisible();
    await expect(transcriptionWord(page, "Detail Student", "hello")).toBeVisible();
    // Audio + badge vẫn còn nguyên sau khi mở rộng (không biến mất/thay bằng nội dung khác).
    await expect(card.getByRole("button", { name: reportPo.audioButtonName })).toBeVisible();
    await expect(studentScoreBadge(page, "Detail Student")).toHaveText("40%");
  });

  test("TC_033 - từ phát âm sai tô đỏ, từ đúng giữ màu mặc định", async ({ page }) => {
    const roomAnalytic = buildRoomAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      submitted: [{ id: "u1", name: "Mixed Words", score: 5 }],
    });
    const roomQuestionsAnalytic = buildRoomQuestionsAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      totalStudents: 1,
      questions: [{ questionId: QUESTION_ID, questionIndex: 0, incorrectCount: 1, errorRate: 100 }],
    });
    const questionDetailAnalytic = buildQuestionDetailAnalytic({
      questionId: QUESTION_ID,
      index: 0,
      question: { content: "Mixed words content", title: "Mixed Words Question" },
      incorrectAnswers: [
        buildStudentAnswer({
          userId: "u1",
          userName: "Mixed Words",
          accuracyScore: 50,
          isCorrect: false,
          words: [
            { text: "The", isError: false },
            { text: "quick", isError: true },
            { text: "brown", isError: false },
            { text: "fox", isError: true },
          ],
        }),
      ],
    });

    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });
    await studentAnswerCard(page, "Mixed Words").click();

    await expect(transcriptionWord(page, "Mixed Words", "quick")).toHaveCSS(
      "color",
      reportPo.wrongWordColorRgb,
    );
    await expect(transcriptionWord(page, "Mixed Words", "fox")).toHaveCSS(
      "color",
      reportPo.wrongWordColorRgb,
    );
    await expect(transcriptionWord(page, "Mixed Words", "The")).not.toHaveCSS(
      "color",
      reportPo.wrongWordColorRgb,
    );
    await expect(transcriptionWord(page, "Mixed Words", "brown")).not.toHaveCSS(
      "color",
      reportPo.wrongWordColorRgb,
    );
  });

  test("TC_035 (Phase 2) - tên học sinh quá dài không tràn giao diện thẻ", async ({ page }) => {
    const longName = "Nguyễn Thị Rất Là Một Cái Tên Cực Kỳ Dài Để Test Layout";
    const roomAnalytic = buildRoomAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      submitted: [{ id: "u1", name: longName, score: 5 }],
    });
    const roomQuestionsAnalytic = buildRoomQuestionsAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      totalStudents: 1,
      questions: [{ questionId: QUESTION_ID, questionIndex: 0, incorrectCount: 1, errorRate: 100 }],
    });
    const questionDetailAnalytic = buildQuestionDetailAnalytic({
      questionId: QUESTION_ID,
      index: 0,
      question: { content: "Long name content", title: "Long Name Question" },
      incorrectAnswers: [
        buildStudentAnswer({ userId: "u1", userName: longName, accuracyScore: 30, isCorrect: false }),
      ],
    });

    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });

    const card = studentAnswerCard(page, longName);
    await expect(card).toBeVisible();

    // Thẻ KHÔNG được tràn ra ngoài panel cha (bên phải, "lg:w-[40%]") - so `boundingBox()` thay vì
    // đoán CSS overflow/ellipsis cụ thể (không biết trước cơ chế UI dùng - có thể wrap dòng, cắt
    // chữ, hay ellipsis - miễn KHÔNG vỡ layout tràn ra ngoài là đạt).
    const panel = page.locator('div[class*="lg:w-\\[40\\%\\]"]').first();
    const [cardBox, panelBox] = await Promise.all([card.boundingBox(), panel.boundingBox()]);
    expect(cardBox).not.toBeNull();
    expect(panelBox).not.toBeNull();
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width + 1); // +1 làm tròn subpixel
    expect(cardBox.x).toBeGreaterThanOrEqual(panelBox.x - 1);

    // Audio + badge vẫn hiển thị/bấm được dù tên dài (không bị đẩy ra ngoài/che khuất).
    await expect(card.getByRole("button", { name: reportPo.audioButtonName })).toBeVisible();
    await expect(studentScoreBadge(page, longName)).toHaveText("30%");
  });
});
