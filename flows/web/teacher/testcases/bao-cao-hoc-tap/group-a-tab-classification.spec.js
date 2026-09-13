import { test, expect } from "../../../../../automation/bao_cao_speaking/playwrightTest.js";
import { config } from "../../../../../automation/src/config.js";
import {
  gotoMockedReport,
  MOCK_REPORT_ROOM_ID,
} from "../../../../../automation/bao_cao_speaking/mock/mockReportApi.js";
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
 * Nhóm A (TC_001/002/004/005/007/008/009/053 - phân loại tab Sai/Đúng theo %) của
 * TestCase_BaoCaoSpeaking.xlsx - Tầng 2 (mock `page.route()`), vì cần ép % CHÍNH XÁC tuyệt đối
 * (0/51/100...) mà không thể chủ động ép AI chấm ra đúng giá trị qua UI thật (xem plan gốc mục 3).
 *
 * Điều hướng thẳng vào MOCK_REPORT_ROOM_ID (room thật có sẵn, chỉ mock phần dữ liệu report-stats)
 * qua gotoMockedReport() - KHÔNG cần tìm đúng dòng "Giao bài tập" như Nhóm B/C (Tầng 1) vì toàn bộ
 * nội dung hiển thị ở đây do fixture quyết định, không phụ thuộc dữ liệu thật của room đó.
 *
 * QUAN TRỌNG: server tự phân loại Sai/Đúng qua correct_answer_groups/incorrect_answer_groups
 * (KHÔNG phải FE tự so accuracy_score >= 51) - mỗi fixture dưới đây khai báo TƯỜNG MINH HS nào ở
 * nhóm nào, accuracy_score chỉ là số hiển thị trên badge, xem comment ở questionDetailAnalyticFixture.js.
 */
const QUESTION_ID = "mock-q-group-a";

function buildScenario({ correct = [], incorrect = [] }) {
  const submitted = [...correct, ...incorrect].map((s) => ({ id: s.userId, name: s.userName, score: s.accuracyScore / 10 }));
  const roomAnalytic = buildRoomAnalytic({ roomId: MOCK_REPORT_ROOM_ID, roomName: "Vocab", submitted });
  const roomQuestionsAnalytic = buildRoomQuestionsAnalytic({
    roomId: MOCK_REPORT_ROOM_ID,
    roomName: "Vocab",
    totalStudents: submitted.length,
    questions: [
      {
        questionId: QUESTION_ID,
        questionIndex: 0,
        incorrectCount: incorrect.length,
        errorRate: submitted.length ? (incorrect.length / submitted.length) * 100 : 0,
      },
    ],
  });
  const questionDetailAnalytic = buildQuestionDetailAnalytic({
    questionId: QUESTION_ID,
    index: 0,
    question: { content: "Mock speaking content", title: "Mock Speaking Question" },
    correctAnswers: correct.map((s) => buildStudentAnswer({ ...s, isCorrect: true })),
    incorrectAnswers: incorrect.map((s) => buildStudentAnswer({ ...s, isCorrect: false })),
  });
  return { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic };
}

test.describe("Báo cáo Speaking - Nhóm A: phân loại tab Sai/Đúng theo %", () => {
  test.skip(
    !config.teacherUsernameSpeakingReport || !config.teacherPasswordSpeakingReport,
    "Thiếu TEACHER_USERNAME_SPEAKING_REPORT/TEACHER_PASSWORD_SPEAKING_REPORT trong .env.",
  );

  test("TC_001 - chọn câu hỏi Speaking hiển thị đúng 2 tab Sai/Đúng", async ({ page }) => {
    await gotoMockedReport(
      page,
      buildScenario({
        correct: [{ userId: "u1", userName: "Correct One", accuracyScore: 80 }],
        incorrect: [{ userId: "u2", userName: "Wrong One", accuracyScore: 20 }],
      }),
    );
    await expect(page.getByRole("button", { name: reportPo.wrongTabAny })).toBeVisible();
    await expect(page.getByRole("button", { name: reportPo.correctTabAny })).toBeVisible();
  });

  test("TC_002 - HS 0% nằm trong tab Sai", async ({ page }) => {
    await gotoMockedReport(
      page,
      buildScenario({ incorrect: [{ userId: "u0", userName: "Zero Percent", accuracyScore: 0 }] }),
    );
    await expect(studentAnswerCard(page, "Zero Percent")).toBeVisible();
    await page.getByRole("button", { name: reportPo.correctTabAny }).click();
    // SỬA (2026-09-11, FAIL thật xác nhận qua chạy live): "Zero Percent" CŨNG xuất hiện (đúng, có
    // chủ ý) trong panel "Đã hoàn thành" luôn hiển thị ở đầu trang (buildScenario() đưa MỌI HS vào
    // `submitted` cho roomAnalytic) - kiểm tra text bất kỳ đâu trên trang là sai, phải kiểm tra cụ
    // thể KHÔNG có trong danh sách thẻ Sai/Đúng qua `studentAnswerCard` (chỉ khớp thẻ có nút audio
    // đi kèm - panel "Đã hoàn thành" không có nút audio nên không khớp nhầm).
    await expect(studentAnswerCard(page, "Zero Percent")).toHaveCount(0);
  });

  test("TC_004 - HS 51% nằm trong tab Đúng, KHÔNG có trong tab Sai", async ({ page }) => {
    await gotoMockedReport(
      page,
      buildScenario({ correct: [{ userId: "u51", userName: "FiftyOne Percent", accuracyScore: 51 }] }),
    );
    // Mặc định tab "Sai" đang active (xem Nhóm B/C) - phải bấm sang "Đúng" trước khi thấy thẻ này
    // trong danh sách thẻ (KHÔNG dùng getByText thô - xem lý do ở TC_002 ngay trên, panel "Đã hoàn
    // thành" luôn hiển thị tên HS này bất kể tab nào đang active).
    await expect(studentAnswerCard(page, "FiftyOne Percent")).toHaveCount(0);
    await page.getByRole("button", { name: reportPo.correctTabAny }).click();
    await expect(studentAnswerCard(page, "FiftyOne Percent")).toBeVisible();
  });

  test("TC_005 - HS 100% nằm trong tab Đúng", async ({ page }) => {
    await gotoMockedReport(
      page,
      buildScenario({ correct: [{ userId: "u100", userName: "Hundred Percent", accuracyScore: 100 }] }),
    );
    await page.getByRole("button", { name: reportPo.correctTabAny }).click();
    await expect(studentAnswerCard(page, "Hundred Percent")).toBeVisible();
  });

  test("TC_007 - badge số trên tab khớp số thẻ hiển thị thật", async ({ page }) => {
    await gotoMockedReport(
      page,
      buildScenario({
        correct: [
          { userId: "c1", userName: "Correct A", accuracyScore: 60 },
          { userId: "c2", userName: "Correct B", accuracyScore: 70 },
        ],
        incorrect: [{ userId: "w1", userName: "Wrong A", accuracyScore: 10 }],
      }),
    );
    await expect(page.getByRole("button", { name: "Sai (1)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Đúng (2)" })).toBeVisible();

    await page.getByRole("button", { name: "Đúng (2)" }).click();
    await expect(studentAnswerCard(page, "Correct A")).toBeVisible();
    await expect(studentAnswerCard(page, "Correct B")).toBeVisible();
  });

  test("TC_008 - tab Sai rỗng khi toàn bộ HS đúng", async ({ page }) => {
    await gotoMockedReport(
      page,
      buildScenario({ correct: [{ userId: "c1", userName: "All Correct", accuracyScore: 90 }] }),
    );
    await expect(page.getByRole("button", { name: "Sai (0)" })).toBeVisible();
    await page.getByRole("button", { name: "Sai (0)" }).click();
    await expect(page.getByText(reportPo.emptyTabMessage)).toBeVisible();
  });

  test("TC_009 - tab Đúng rỗng khi toàn bộ HS sai", async ({ page }) => {
    await gotoMockedReport(
      page,
      buildScenario({ incorrect: [{ userId: "w1", userName: "All Wrong", accuracyScore: 10 }] }),
    );
    await expect(page.getByRole("button", { name: "Đúng (0)" })).toBeVisible();
    await page.getByRole("button", { name: "Đúng (0)" }).click();
    await expect(page.getByText(reportPo.emptyTabMessage)).toBeVisible();
  });

  test("TC_053 - màu badge % đúng Sai=đỏ / Đúng=xanh lá", async ({ page }) => {
    await gotoMockedReport(
      page,
      buildScenario({
        correct: [{ userId: "c1", userName: "Green Badge", accuracyScore: 80 }],
        incorrect: [{ userId: "w1", userName: "Red Badge", accuracyScore: 10 }],
      }),
    );
    await expect(studentScoreBadge(page, "Red Badge")).toHaveCSS("color", reportPo.wrongBadgeColorRgb);

    await page.getByRole("button", { name: reportPo.correctTabAny }).click();
    await expect(studentScoreBadge(page, "Green Badge")).toHaveCSS("color", reportPo.correctBadgeColorRgb);
  });
});
