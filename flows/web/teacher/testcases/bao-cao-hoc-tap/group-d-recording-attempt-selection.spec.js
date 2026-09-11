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
 * Nhóm D (TC_025/027 - quy tắc chọn lượt/lần ghi âm) của TestCase_BaoCaoSpeaking.xlsx.
 *
 * PHÁT HIỆN QUAN TRỌNG (2026-09-11, network capture thật trên Dev - cả 2 API đã kiểm tra):
 *   - `GET /api/user/report-stats/question-detail-analytic?...` (trang "Báo cáo lớp" đang test) VÀ
 *   - `GET /api/user/exams/u-answer/{id}` (trang "Chi tiết bài làm", /result/{userId})
 * CẢ HAI đều chỉ trả về ĐÚNG 1 object `answer`/`select` cho mỗi câu hỏi của mỗi học sinh - KHÔNG
 * có mảng nhiều lần ghi âm nào lộ ra ở tầng API. Nghĩa là việc "1 lượt ghi âm lại nhiều lần -> lấy
 * lần GẦN NHẤT" (TC_027) đã được BACKEND giải quyết xong TRƯỚC KHI trả dữ liệu - FE không bao giờ
 * nhìn thấy nhiều hơn 1 lần ghi âm để mà "chọn". Mock API trả lời "đây là lần ghi âm gần nhất" rồi
 * assert UI hiển thị đúng y như vậy là test VÔ NGHĨA (FE chỉ có 1 lựa chọn, không có logic nào để
 * kiểm chứng) - KHÔNG viết case giả cho việc này.
 *
 * => TC_027 KHÔNG kiểm chứng được ở tầng UI/FE (thuộc phạm vi test backend/API, ngoài phạm vi bộ
 * Playwright này) - `test.skip()` có ghi rõ lý do thay vì bỏ sót âm thầm.
 * => TC_025 (1 lượt/1 lần ghi âm -> hiển thị đúng audio/% duy nhất) vẫn hợp lệ nhưng thực chất
 * trùng với hành vi đã kiểm chứng xuyên suốt Nhóm A/E (mỗi HS luôn có ĐÚNG 1 answer) - viết 1 test
 * tường minh ở đây để có traceability với mã test case gốc, không lặp lại toàn bộ Nhóm A.
 */
test.describe("Báo cáo Speaking - Nhóm D: quy tắc chọn lượt/lần ghi âm", () => {
  test.skip(
    !config.teacherUsernameSpeakingReport || !config.teacherPasswordSpeakingReport,
    "Thiếu TEACHER_USERNAME_SPEAKING_REPORT/TEACHER_PASSWORD_SPEAKING_REPORT trong .env.",
  );

  test("TC_025 - HS chỉ 1 lượt/1 lần ghi âm -> hiển thị đúng audio/% duy nhất", async ({ page }) => {
    const QUESTION_ID = "mock-q-single-attempt";
    const roomAnalytic = buildRoomAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      submitted: [{ id: "u1", name: "Single Attempt", score: 7 }],
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
      question: { content: "Single attempt content", title: "Single Attempt Question" },
      correctAnswers: [
        buildStudentAnswer({ userId: "u1", userName: "Single Attempt", accuracyScore: 72, isCorrect: true }),
      ],
    });

    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });
    await page.getByRole("button", { name: /^Đúng \(\d+\)$/ }).click();

    await expect(studentAnswerCard(page, "Single Attempt")).toBeVisible();
    await expect(studentScoreBadge(page, "Single Attempt")).toHaveText("72%");
    // Đúng 1 thẻ duy nhất, không có bản ghi trùng lặp nào khác cho cùng HS.
    // SỬA (2026-09-11, FAIL thật xác nhận qua chạy live): `getByText("Single Attempt")` không
    // `exact:true` khớp CẢ các div tổ tiên "chứa" chuỗi này (không chỉ đúng 1 node lá), luôn ra
    // >1 dù chỉ có 1 thẻ thật - dùng `studentAnswerCard(...).count()` (đã scope đúng panel + cấu
    // trúc thẻ) để đếm đúng ý "chỉ 1 thẻ".
    await expect(studentAnswerCard(page, "Single Attempt")).toHaveCount(1);
  });

  // SỬA (2026-09-11, FAIL thật xác nhận qua chạy live: gọi `test.skip(true, reason)` TRẦN (không
  // bọc trong `test(...)`) áp dụng cho CẢ describe block đang chứa nó, khiến TC_025 ở TRÊN cũng bị
  // skip theo dù có assertion thật - dùng `test.skip(name, fn)` (định nghĩa 1 test LUÔN skip có
  // tên riêng) thay vì gọi dạng "điều kiện" ở đây.
  test.skip("TC_027 - ghi âm lại nhiều lần -> lấy lần GẦN NHẤT (không kiểm chứng được ở tầng UI/FE)", async () => {
    // cả question-detail-analytic và u-answer API đều chỉ trả 1 answer/câu, việc chọn lần ghi âm
    // gần nhất đã được backend xử lý xong trước đó (xem comment đầu file). Cần test ở tầng backend/API.
  });
});

/**
 * Nhóm D (Phase 2) - TC_026/028/029/030/031 (quy tắc chọn LƯỢT theo điểm tổng cả bài).
 *
 * PHÁT HIỆN CHẶN (2026-09-11, áp dụng lý do TƯƠNG TỰ TC_027 ở trên): API `question-detail-analytic`
 * KHÔNG có khái niệm "lượt làm bài" (attempt) nào cả - chỉ có 1 object answer/câu đã resolve sẵn.
 * Nghĩa là việc SO SÁNH GIỮA CÁC LƯỢT (rule 1: chọn lượt điểm tổng cao nhất) và KẾT HỢP rule 2
 * (lần ghi âm gần nhất TRONG 1 lượt) đều xảy ra ở backend, TRƯỚC KHI dữ liệu tới API này - FE
 * không có cách nào "chọn sai" vì nó chưa từng thấy các lựa chọn còn lại.
 *
 * => TC_028 (kết hợp rule 1+2), TC_029 (tie-break), TC_031 (transcription đúng lần được chọn) đều
 * thuộc dạng "kiểm chứng logic chọn lựa giữa nhiều lượt/lần" - KHÔNG mock được có căn cứ (sẽ phải
 * TỰ BỊA ra 1 field/shape API "attempt" chưa từng thấy thật - vi phạm nguyên tắc chỉ mock schema
 * ĐÃ XÁC NHẬN của bộ test này) - `test.skip()` với lý do rõ, giống TC_027.
 *
 * => TC_026/TC_030 CÓ THỂ test được, nhưng ở phạm vi HẸP HƠN ý định gốc: KHÔNG kiểm chứng "hệ
 * thống có chọn đúng lượt điểm cao nhất hay không" (đó là backend, vô hình với FE) - CHỈ kiểm
 * chứng "% hiển thị trên thẻ (accuracy_score - của CÂU Speaking) và điểm tổng cả bài (submitted[].
 * score - đã dùng để CHỌN lượt) là 2 GIÁ TRỊ ĐỘC LẬP, KHÔNG bị FE nhầm lẫn/tính lại từ nhau" - đây
 * là phần DUY NHẤT của rule còn quan sát được ở tầng UI, dùng 2 field THẬT đã xác nhận (accuracy_
 * score trong question-detail-analytic, score trong room-analytic).
 */
test.describe("Báo cáo Speaking - Nhóm D (Phase 2): quy tắc chọn lượt theo điểm tổng", () => {
  test.skip(
    !config.teacherUsernameSpeakingReport || !config.teacherPasswordSpeakingReport,
    "Thiếu TEACHER_USERNAME_SPEAKING_REPORT/TEACHER_PASSWORD_SPEAKING_REPORT trong .env.",
  );

  test("TC_026 (phạm vi hẹp) - % câu Speaking và điểm tổng cả bài là 2 số ĐỘC LẬP, không lẫn nhau", async ({
    page,
  }) => {
    const QUESTION_ID = "mock-q-total-vs-question";
    // Cố ý cho 2 số NGƯỢC THỨ TỰ nhau: % câu Speaking THẤP (20%) nhưng điểm tổng cả bài (lượt đã
    // được chọn theo rule 1) lại CAO (9.0) - đúng tình huống "không cùng thứ tự" mà TC_026 mô tả.
    // KHÔNG khẳng định hệ thống "đã chọn đúng lượt" (không kiểm chứng được, xem comment đầu khối) -
    // chỉ khẳng định UI không tự ý đảo/tính lại 1 trong 2 số từ số còn lại.
    const roomAnalytic = buildRoomAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      submitted: [{ id: "u1", name: "Total Vs Question", score: 9.0 }],
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
      question: { content: "Q1", title: "Q1" },
      incorrectAnswers: [
        buildStudentAnswer({
          userId: "u1",
          userName: "Total Vs Question",
          accuracyScore: 20,
          isCorrect: false,
        }),
      ],
    });

    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });

    // Badge % trên thẻ (trong tab Sai) phải là 20% (accuracy_score của câu) - KHÔNG phải 90%.
    await expect(studentScoreBadge(page, "Total Vs Question")).toHaveText("20%");
    // Điểm tổng cả bài (panel "Đã hoàn thành") phải là 9.0 - KHÔNG bị hiển thị nhầm thành 20%/2.0.
    await expect(page.getByText(reportPo.completedHeading(1))).toBeVisible();
    // Panel "Đã hoàn thành" (Tầng 1, luôn hiển thị bất kể tab Sai/Đúng) hiển thị điểm tổng thật
    // ngay sau link tên HS - kiểm tra KHỚP số 9 (không assert format chính xác "9"/"9.0" vì chưa
    // xác nhận UI format thế nào) và chắc chắn KHÔNG bị nhầm với "20" (accuracy_score của câu).
    const completedRow = page
      .locator("a", { hasText: "Total Vs Question" })
      .locator("xpath=following-sibling::*[1]");
    await expect(completedRow).toContainText("9");
    await expect(completedRow).not.toContainText("20");
  });

  test.skip("TC_028 - kết hợp rule 2 trong lượt + rule 1 giữa các lượt (không kiểm chứng được ở tầng UI/FE)", async () => {
    // cùng lý do TC_027: API không có khái niệm 'lượt', cả 2 rule đã được backend giải quyết xong
    // trước khi trả dữ liệu. Cần test ở tầng backend/API khi có tài liệu/endpoint xác nhận.
  });

  test.skip("TC_029 - tie-break khi 2+ lượt bằng điểm tổng cao nhất (không kiểm chứng được ở tầng UI/FE)", async () => {
    // cùng lý do TC_027/028. User đã chọn GIẢ ĐỊNH 'lượt gần nhất' (2026-09-11) để dùng LÀM CĂN CỨ
    // SAU NÀY nếu có cơ chế test attempt thật (vd endpoint riêng hoặc capture network lúc redo bài
    // thật trên app di động) - CHƯA xác nhận với Dev/BA, KHÔNG dùng giả định này để tự tin báo Pass.
  });

  test("TC_030 (phạm vi hẹp) - % hiển thị trên thẻ là % câu Speaking, KHÔNG phải điểm tổng cả bài", async ({
    page,
  }) => {
    const QUESTION_ID = "mock-q-tc030";
    const roomAnalytic = buildRoomAnalytic({
      roomId: "9cf81245-787e-44c8-8178-d66794f9832a",
      roomName: "Vocab",
      submitted: [{ id: "u1", name: "TC030 Kid", score: 4.5 }],
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
      question: { content: "Q1", title: "Q1" },
      correctAnswers: [
        buildStudentAnswer({ userId: "u1", userName: "TC030 Kid", accuracyScore: 88, isCorrect: true }),
      ],
    });

    await gotoMockedReport(page, { roomAnalytic, roomQuestionsAnalytic, questionDetailAnalytic });
    await page.getByRole("button", { name: reportPo.correctTabAny }).click();

    // Badge % = 88% (accuracy_score câu Speaking) - hoàn toàn khác 4.5 (điểm tổng cả bài, thang 10).
    await expect(studentScoreBadge(page, "TC030 Kid")).toHaveText("88%");
    await expect(studentScoreBadge(page, "TC030 Kid")).not.toHaveText("4.5%");
  });

  test.skip("TC_031 - transcription đúng lần ghi âm được chọn (không kiểm chứng được ở tầng UI/FE)", async () => {
    // cùng lý do TC_027/028: chỉ có 1 transcription/câu tới được FE, không có 'lần khác' để so
    // sánh chọn nhầm. Cần test ở tầng backend/API.
  });
});
