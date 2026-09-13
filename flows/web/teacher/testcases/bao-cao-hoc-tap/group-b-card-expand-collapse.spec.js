import { test, expect } from "../../../../../automation/bao_cao_speaking/playwrightTest.js";
import { config } from "../../../../../automation/src/config.js";
import { gotoDashboard } from "../../../../../automation/bao_cao_speaking/navigation/speakingReportSession.js";
import {
  gotoAssignedList,
  locateAssignedRow,
  openRowReport,
} from "../../../../../automation/giao_bai_tap/navigation/teacherAssignedListPageObjects.js";
import {
  po as reportPo,
  studentAnswerCard,
  isCardExpanded,
  clickAudioButton,
} from "../../../../../automation/bao_cao_speaking/navigation/speakingReportPageObjects.js";

/**
 * Playwright Test THẬT (`cd automation && npx playwright test --config=playwright.speaking-
 * report.config.js`) cho Nhóm B (TC_011/012/013 - mở rộng/thu gọn thẻ học sinh trong tab Sai/Đúng)
 * của TestCase_BaoCaoSpeaking.xlsx - xem plan gốc trong hội thoại 2026-09-11.
 *
 * DÙNG DỮ LIỆU THẬT trên Dev (https://parrotedu.codeinet.com, tài khoản
 * TEACHER_USERNAME_SPEAKING_REPORT) - lớp 11A2, bài "Vocab" hạn nộp 12/09/2026 (3/3 HS đã nộp,
 * ĐÃ XÁC NHẬN THẬT qua debug live 2026-09-11: roomId=9cf81245-787e-44c8-8178-d66794f9832a, câu
 * Speaking mặc định là "CÂU 8", tab "Sai (3)" có sẵn 3 HS Luuk/Hoang Gia Minh/Phuong). Assert
 * TƯƠNG ĐỐI (trạng thái mở rộng/thu gọn trước/sau click) - KHÔNG hardcode accuracy_score/nội dung
 * transcription vì đó là dữ liệu AI chấm, có thể đổi nếu HS làm lại bài.
 *
 * dueDateLine "12/09/2026" là due date CALENDAR THẬT của room này - nếu sau này dòng này biến mất
 * khỏi filter mặc định ("2 tuần gần nhất") hoặc GV đổi hạn nộp, cần cập nhật lại giá trị này (xem
 * automation/giao_bai_tap/navigation/teacherAssignedListPageObjects.js#locateAssignedRow).
 */
test.describe.serial("Báo cáo Speaking - Nhóm B: mở rộng/thu gọn thẻ học sinh", () => {
  // `test.skip()` gọi TRỰC TIẾP trong thân describe (không phải trong beforeAll/beforeEach) -
  // đúng cách Playwright Test tài liệu hoá để skip TOÀN BỘ test trong block này theo 1 điều kiện
  // (thiếu credential .env), tương tự cách goi_dich_vu skip GRANT-*/DEACT-05 khi thiếu
  // CMS_ADMIN_TEST_STUDENT_PHONE.
  test.skip(
    !config.teacherUsernameSpeakingReport || !config.teacherPasswordSpeakingReport,
    "Thiếu TEACHER_USERNAME_SPEAKING_REPORT/TEACHER_PASSWORD_SPEAKING_REPORT trong .env.",
  );

  test.beforeEach(async ({ page }) => {
    // Session đã đăng nhập sẵn qua `storageState` (globalSetup.js) - không tự đăng nhập lại ở
    // đây, nhưng vẫn cần điều hướng tới 1 trang thật trước (xem gotoDashboard, SỬA 2026-09-11).
    await gotoDashboard(page);
    await gotoAssignedList(page);
    const row = await locateAssignedRow(page, {
      className: config.teacherPortalClassSpeakingReport || "11A2",
      itemName: config.teacherPortalExerciseSpeakingReport || "Vocab",
      dueDateLine: "12/09/2026",
    });
    await openRowReport(page, row);
    // Câu Speaking ("CÂU 8") + tab "Sai (3)" đã mặc định active khi vào trang report của room này
    // (ĐÃ XÁC NHẬN THẬT) - chỉ cần đảm bảo đúng tab đang chọn trước khi test expand/collapse.
    const wrongTab = page.getByRole("button", { name: reportPo.wrongTabAny });
    await wrongTab.waitFor({ timeout: 15000 });
  });

  test("TC_011 - bấm thân thẻ (đang thu gọn) -> mở rộng, hiện transcription", async ({ page }) => {
    expect(await isCardExpanded(page, "Luuk")).toBe(false);

    await studentAnswerCard(page, "Luuk").click();

    expect(await isCardExpanded(page, "Luuk")).toBe(true);
    await expect(page.getByText(reportPo.expandedTranscriptionLabel)).toBeVisible();
  });

  test("TC_012 - bấm lại thân thẻ (đang mở rộng) -> thu gọn", async ({ page }) => {
    await studentAnswerCard(page, "Luuk").click();
    expect(await isCardExpanded(page, "Luuk")).toBe(true);

    await studentAnswerCard(page, "Luuk").click();
    expect(await isCardExpanded(page, "Luuk")).toBe(false);
  });

  test("TC_013 - bấm nút audio khi thẻ đang mở rộng -> thẻ KHÔNG thu gọn", async ({ page }) => {
    await studentAnswerCard(page, "Luuk").click();
    expect(await isCardExpanded(page, "Luuk")).toBe(true);

    await clickAudioButton(page, "Luuk");

    expect(await isCardExpanded(page, "Luuk")).toBe(true);
  });
});
