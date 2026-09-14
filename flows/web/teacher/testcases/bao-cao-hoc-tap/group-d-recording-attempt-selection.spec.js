import { execSync } from "node:child_process";

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
  readStudentQuestionFingerprint,
} from "../../../../../automation/bao_cao_speaking/navigation/speakingReportPageObjects.js";
import { gotoDashboard } from "../../../../../automation/bao_cao_speaking/navigation/speakingReportSession.js";
import {
  gotoAssignedList,
  locateAssignedRow,
  openRowReport,
} from "../../../../../automation/giao_bai_tap/navigation/teacherAssignedListPageObjects.js";
import { MaestroMcpBridge } from "../../../../../automation/bridge/maestroMcpBridge.js";
import {
  readAttemptHistory,
  openAttemptDetailScreen,
  readAttemptQuestionFingerprint,
} from "../../../../../automation/bai_tap/xemchitietbailam.mjs";
import { selectBestAttempt } from "../../../../../automation/bao_cao_speaking/selectBestAttempt.js";
import {
  buildAttemptFingerprint,
  compareFingerprints,
  comparePercents,
  describeFingerprint,
} from "../../../../../automation/bao_cao_speaking/attemptFingerprint.js";

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

/**
 * Nhóm D (Track A, thêm 2026-09-14; NÂNG CẤP lên fingerprint theo từng câu cùng ngày) - đối chiếu
 * App (thật, qua MaestroMcpBridge) với Web Báo cáo Speaking (thật, KHÔNG mock) để xác nhận Web
 * đang hiển thị ĐÚNG lượt làm bài nào khi học sinh có nhiều lượt.
 *
 * LÝ DO NÂNG CẤP (đọc trước khi tưởng đây chỉ là "so điểm tổng" như bản đầu): so overall score
 * ĐƠN THUẦN không đủ phân biệt 2 lượt HÒA điểm - đã xác nhận thật (2026-09-14, room Vocab 11A2):
 *   Lần 5: Điểm 3, Đúng 3/10, fingerprint Q1..10 = F,T,T,T,F,F,F,F,F,F
 *   Lần 1: Điểm 3, Đúng 3/10, fingerprint Q1..10 = F,T,T,F,T,F,F,F,F,F   (khác Lần 5 ở Q4/Q5!)
 * Nếu chỉ so overall score, test sẽ PASS dù Web đang lấy NHẦM lượt. Assertion CHÍNH của case này vì
 * vậy là so fingerprint đúng/sai TỪNG CÂU (`compareFingerprints`), không phải overall score.
 *
 * QUY TRÌNH:
 *   App: readAttemptHistory() -> selectBestAttempt() -> expectedAttempt
 *   App: openAttemptDetailScreen(bridge, expectedAttempt.attemptNumber) -> readAttemptQuestionFingerprint()
 *   Web: mở report room Vocab -> readStudentQuestionFingerprint(page, student, totalQuestions)
 *   So sánh: compareFingerprints (assertion CHÍNH) + comparePercents/overall score (bằng chứng phụ).
 *
 * VẪN GIỮ NGUYÊN Ý NGHĨA CỦA TRACK B (2 khối Nhóm D phía trên, TC_027/028/029/031 vẫn `test.skip()`)
 * - fingerprint theo CORRECTNESS không cần field `attempt_id` tường minh từ API (khác giả định ban
 * đầu của Track B), nhưng KHÔNG unblock được TC_027 (latest recording TRONG 1 lượt - không có dữ
 * liệu nào phân biệt nhiều lần ghi âm trong CÙNG 1 lượt, cả App lẫn Web). TC_028/029/031 vẫn giữ
 * skip vì lý do gốc (không có attempt_id tường minh) - Track A dùng fingerprint làm PROXY gián tiếp
 * chỉ áp dụng được cho MỘT case cụ thể (so sánh với chính lượt `selectBestAttempt()` đã chọn),
 * KHÔNG phải bằng chứng tổng quát cho mọi trường hợp TC_028/029/031 mô tả - không tự ý un-skip các
 * case đó dựa trên kỹ thuật này.
 *
 * ĐÂY LÀ TEST CROSS-STACK ĐẦU TIÊN CỦA REPO (Maestro/adb cho App + Playwright cho Web trong CÙNG 1
 * test) - môi trường phụ thuộc NHIỀU hơn hẳn phần còn lại của bộ Speaking Report:
 *   1. Cần 1 thiết bị Android thật đã cắm (`adb devices`), đăng nhập ĐÚNG profile học sinh có dữ
 *      liệu "Lịch sử làm bài" cho room Vocab đang test trên Web (school/class 11A2).
 *   2. Cần TRÙNG danh tính: `SPEAKING_REPORT_TRACK_A_STUDENT_NAME` (tên hiển thị trên Web, mặc định
 *      "Phuong") PHẢI là ĐÚNG học sinh đang đăng nhập trên thiết bị đó - test KHÔNG có cách nào tự
 *      xác minh 2 identity này khớp nhau (không có API map phone<->display name đã xác nhận). ĐÃ
 *      xác nhận khớp thủ công 1 lần (2026-09-14) - KHÔNG coi là xác nhận vĩnh viễn, đổi thiết
 *      bị/tài khoản phải verify lại tay.
 *   3. `SPEAKING_REPORT_TRACK_A_DUE_DATE` (mặc định "12/09/2026", TRÙNG dueDateLine của TC_010) xác
 *      định ĐÚNG room "Vocab" nào trong số nhiều room cùng tên "Vocab" có thể tồn tại (đã xác nhận
 *      thật - device test có ít nhất 2 room "Vocab" khác nhau, hạn nộp khác nhau).
 *   4. TIỀN ĐIỀU KIỆN BẮT BUỘC (KHÔNG tự động hoá ở đây, ĐỌC KỸ): thiết bị App PHẢI đã đứng SẴN ở
 *      màn "Lịch sử làm bài" (sau khi bấm "Xem bài đã làm") của ĐÚNG room Vocab nói trên, đang ở
 *      ĐỈNH danh sách (chưa cuộn) - `readAttemptHistory()`/`openAttemptDetailScreen()` chỉ ĐỌC/thao
 *      tác trên màn hiện tại, KHÔNG tự login/tìm/mở room (những helper đó - launchFresh/
 *      loginIfNeeded/openHomeworkTab/locateCompletedRegularCard - là hàm PRIVATE trong
 *      xemchitietbailam.mjs, không export, và locateCompletedRegularCard() vốn chỉ tìm "1 card
 *      hoàn thành BẤT KỲ", không phân biệt được room Vocab nào trong nhiều room trùng tên). Nếu
 *      chưa đứng đúng màn, các hàm đọc sẽ throw rõ ràng thay vì đọc nhầm - test sẽ FAIL với lỗi đó,
 *      KHÔNG phải lỗi logic chọn lượt/fingerprint.
 *
 * GIỚI HẠN GIÁ TRỊ DỮ LIỆU ĐÃ XÁC NHẬN THẬT (2026-09-14, room thật 5 lượt "Lần 5..1"): "Thời gian
 * nộp" trên App chỉ có độ phân giải NGÀY (không giờ:phút) - CẢ 5 lượt rơi cùng 1 ngày (11/09), nghĩa
 * là tie-break "gần nhất" KHÔNG thể hiện được ở granularity này trong thực tế quan sát được -
 * `selectBestAttempt()` fallback về "candidate đầu tiên gặp" (attempt 5, do thứ tự App hiển thị
 * Lần 5 trước Lần 1). Fingerprint xác nhận Web ĐANG DÙNG đúng Lần 5 (không phải Lần 1) - nhưng đây
 * KHÔNG phải bằng chứng "Web dùng rule gần nhất" (2 giả thuyết "gần nhất" và "gặp đầu tiên theo App"
 * trùng nhau ở dữ liệu này, xem review trước đó) - chỉ là bằng chứng Web dùng ĐÚNG 1 lượt cụ thể mà
 * fallback của `selectBestAttempt()` cũng trỏ tới cùng lượt đó.
 */
function isMaestroDeviceAvailable(deviceId) {
  try {
    const output = execSync("adb devices", { encoding: "utf8", timeout: 10000 });
    return deviceId ? output.includes(`${deviceId}\tdevice`) : /\n[\w-]+\tdevice\b/.test(output);
  } catch {
    return false;
  }
}

test.describe("Báo cáo Speaking - Nhóm D (Track A): đối chiếu điểm tổng App vs Web (lượt điểm cao nhất/gần nhất)", () => {
  const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
  const TRACK_A_STUDENT_NAME = process.env.SPEAKING_REPORT_TRACK_A_STUDENT_NAME || "Phuong";
  const TRACK_A_DUE_DATE = process.env.SPEAKING_REPORT_TRACK_A_DUE_DATE || "12/09/2026";

  test.skip(
    !config.teacherUsernameSpeakingReport || !config.teacherPasswordSpeakingReport,
    "Thiếu TEACHER_USERNAME_SPEAKING_REPORT/TEACHER_PASSWORD_SPEAKING_REPORT trong .env.",
  );
  test.skip(!config.appId, "Thiếu APP_ID trong .env - cần để mở MaestroMcpBridge đọc Lịch sử làm bài trên App.");
  test.skip(
    !isMaestroDeviceAvailable(MAESTRO_DEVICE),
    `Track A cần 1 thiết bị Android thật đã cắm qua 'adb devices'${MAESTRO_DEVICE ? ` (kỳ vọng deviceId=${MAESTRO_DEVICE})` : ""} ` +
      `để đọc "Lịch sử làm bài" - không mock được (xem docblock đầu khối, PHẠM VI).`,
  );

  // KHÔNG dùng retries mặc định của config (1) cho riêng khối này - ĐÃ XÁC NHẬN THẬT (2026-09-14):
  // 1 lượt chạy đọc/điều hướng CẢ App lẫn Web (readAttemptHistory + openAttemptDetailScreen +
  // readAttemptQuestionFingerprint + readStudentQuestionFingerprint, ~10 câu mỗi bên) tốn NHIỀU
  // PHÚT thật (đo riêng lẻ ~4-5 phút cho phần App), vượt xa timeout 90s mặc định của Playwright Test
  // NẾU không nâng riêng (xem test.setTimeout bên dưới). Quan trọng hơn: nếu 1 lượt bị timeout/lỗi
  // giữa chừng, THIẾT BỊ ANDROID THẬT bị bỏ lại ở 1 màn hình BẤT KỲ (vd giữa danh sách Câu N của 1
  // lượt) - retry tự động của Playwright KHÔNG reset lại được thiết bị (ngoài tầm kiểm soát của
  // Playwright), nên lần retry chắc chắn FAIL THEO KIỂU KHÁC (readAttemptHistory không tìm thấy màn
  // "Lịch sử làm bài" - đã xác nhận thật) - retry ở đây chỉ tốn thêm thời gian, không có giá trị.
  test.describe.configure({ retries: 0 });

  test(`TC_029b (Track A) - fingerprint từng câu của lượt điểm cao nhất/gần nhất (App) khớp Web (HS "${TRACK_A_STUDENT_NAME}")`, async ({
    page,
  }) => {
    // Ngân sách rộng cho toàn bộ luồng cross-stack (App qua Maestro + Web qua Playwright) - xem lý
    // do đo thật ở comment `test.describe.configure` ngay trên.
    test.setTimeout(600_000);
    // ===== [APP - bước 1+2] đọc lịch sử làm bài thật qua Maestro, chọn lượt tốt nhất, rồi mở ĐÚNG
    // lượt đã chọn (không phải lượt đầu tiên tìm thấy) để đọc fingerprint từng câu của CHÍNH lượt
    // đó. Khai báo kết quả cần dùng SAU `finally` ở ngoài try - tránh phải gán qua biến trung gian. =====
    const bridge = new MaestroMcpBridge({ appId: config.appId, deviceId: MAESTRO_DEVICE });
    await bridge.start();
    let attempts;
    let expectedBestAttempt;
    let expectedRawFingerprint;
    try {
      attempts = await readAttemptHistory(bridge);
      expectedBestAttempt = selectBestAttempt(attempts);
      await openAttemptDetailScreen(bridge, expectedBestAttempt.attemptNumber);
      expectedRawFingerprint = await readAttemptQuestionFingerprint(bridge);
    } finally {
      await bridge.stop();
    }
    const expectedFingerprint = buildAttemptFingerprint(expectedRawFingerprint);

    // ===== [WEB] mở report room Vocab thật (KHÔNG mock) và đọc fingerprint từng câu của học sinh
    // - tổng số câu lấy từ CHÍNH fingerprint App vừa đọc (single source of truth, không hard-code
    // "10"). =====
    await gotoDashboard(page);
    await gotoAssignedList(page);
    const row = await locateAssignedRow(page, {
      className: config.teacherPortalClassSpeakingReport || "11A2",
      itemName: config.teacherPortalExerciseSpeakingReport || "Vocab",
      dueDateLine: TRACK_A_DUE_DATE,
    });
    await openRowReport(page, row);

    const totalQuestions = expectedFingerprint.length;
    const webRawFingerprint = await readStudentQuestionFingerprint(page, TRACK_A_STUDENT_NAME, totalQuestions);
    const webFingerprint = buildAttemptFingerprint(webRawFingerprint);

    // ===== Assertion 1 (CHÍNH) - fingerprint đúng/sai TỪNG CÂU phải khớp. Đây mới là bằng chứng
    // Web đang lấy ĐÚNG lượt - so overall score (Assertion 2 bên dưới) KHÔNG đủ vì nhiều lượt có
    // thể hòa điểm (xem docblock đầu khối, ví dụ thật Lần 5/Lần 1). =====
    const fingerprintResult = compareFingerprints(expectedFingerprint, webFingerprint);
    expect(
      fingerprintResult.match,
      "Track A MISMATCH (fingerprint) - Web KHÔNG khớp đúng/sai từng câu của lượt đã chọn.\n" +
        `Expected attempt (App): attemptNumber=${expectedBestAttempt.attemptNumber}, ` +
        `score=${expectedBestAttempt.score}, timestamp=${expectedBestAttempt.timestamp}\n` +
        `Expected fingerprint (App, Lần ${expectedBestAttempt.attemptNumber}): ${describeFingerprint(expectedFingerprint)}\n` +
        `Actual fingerprint (Web): ${describeFingerprint(webFingerprint)}\n` +
        `Câu lệch: ${JSON.stringify(fingerprintResult.mismatches)}\n` +
        `Toàn bộ lịch sử đọc được từ App: ${JSON.stringify(attempts)}`,
    ).toBe(true);

    // ===== Assertion 2 (phụ) - % từng câu cũng phải khớp (bằng chứng bổ sung, granularity mịn hơn
    // correctness - ĐÃ xác nhận thật percent khớp 10/10 câu cùng lúc với fingerprint đúng/sai). =====
    const percentMismatches = comparePercents(expectedFingerprint, webFingerprint);
    expect(
      percentMismatches,
      "Track A MISMATCH (percent) - % từng câu lệch dù correctness khớp:\n" + JSON.stringify(percentMismatches),
    ).toEqual([]);

    // ===== Assertion 3 (phụ) - overall score vẫn phải khớp (giữ lại bằng chứng của bản đầu, không
    // xoá - chỉ không còn là assertion DUY NHẤT nữa). =====
    const completedRow = page
      .locator("a", { hasText: TRACK_A_STUDENT_NAME })
      .locator("xpath=following-sibling::*[1]");
    await expect(completedRow).toBeVisible({ timeout: 15000 });
    const webScoreText = (await completedRow.textContent())?.trim() ?? "";
    const webScore = Number(webScoreText.replace(",", "."));
    expect(
      webScore,
      "Track A MISMATCH (overall score) - " +
        `expected=${expectedBestAttempt.score} actual scoreText="${webScoreText}" (parsed=${webScore})`,
    ).toBe(expectedBestAttempt.score);
  });
});
