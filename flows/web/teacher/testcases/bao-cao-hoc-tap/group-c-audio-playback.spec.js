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
  clickAudioButton,
  isCardExpanded,
  isStudentAudioPlaying,
  waitForStudentAudioPlaying,
} from "../../../../../automation/bao_cao_speaking/navigation/speakingReportPageObjects.js";

/**
 * Nhóm C (TC_018/019/020 - phát audio) của TestCase_BaoCaoSpeaking.xlsx.
 *
 * ĐÃ XÁC NHẬN THẬT (2026-09-11, JS evaluate trực tiếp trên Dev, room 9cf81245-...-d66794f9832a,
 * Câu 8, tab "Sai (3)"): mỗi thẻ có 1 `<audio>` riêng, bấm nút loa gọi `audio.play()` thật
 * (`paused` chuyển `false` ngay lập tức) - bấm audio HS khác trong lúc đang phát sẽ dừng audio cũ
 * (`paused` quay lại `true`) rồi phát audio mới. Dùng lại cùng room/dữ liệu thật với Nhóm B (xem
 * group-b-card-expand-collapse.spec.js) - KHÔNG mock, đây là Tầng 1 (chỉ cần audio phát/dừng,
 * không cần ép accuracy_score chính xác).
 */
test.describe.serial("Báo cáo Speaking - Nhóm C: phát audio", () => {
  test.skip(
    !config.teacherUsernameSpeakingReport || !config.teacherPasswordSpeakingReport,
    "Thiếu TEACHER_USERNAME_SPEAKING_REPORT/TEACHER_PASSWORD_SPEAKING_REPORT trong .env.",
  );

  test.beforeEach(async ({ page }) => {
    // Session đã đăng nhập sẵn qua `storageState` (globalSetup.js, xem group-b để biết lý do).
    await gotoDashboard(page);
    await gotoAssignedList(page);
    const row = await locateAssignedRow(page, {
      className: config.teacherPortalClassSpeakingReport || "11A2",
      itemName: config.teacherPortalExerciseSpeakingReport || "Vocab",
      dueDateLine: "12/09/2026",
    });
    await openRowReport(page, row);
    const wrongTab = page.getByRole("button", { name: reportPo.wrongTabAny });
    await wrongTab.waitFor({ timeout: 15000 });
  });

  test("TC_018 - bấm audio trên thẻ đang thu gọn -> thẻ mở rộng ĐỒNG THỜI audio phát", async ({
    page,
  }) => {
    expect(await isCardExpanded(page, "Luuk")).toBe(false);
    expect(await isStudentAudioPlaying(page, "Luuk")).toBe(false);

    await clickAudioButton(page, "Luuk");

    expect(await isCardExpanded(page, "Luuk")).toBe(true);
    await waitForStudentAudioPlaying(page, "Luuk");
  });

  test("TC_019 - bấm audio khi thẻ đang mở rộng -> audio phát, thẻ giữ nguyên mở rộng", async ({
    page,
  }) => {
    // Mở rộng thẻ qua bấm THÂN thẻ (không phải audio - xem Nhóm B TC_011) trước, để tiền đề "thẻ
    // đang mở rộng" độc lập với hành động audio đang test ở đây. SỬA (2026-09-11, FAIL thật xác
    // nhận qua chạy live): bấm audio 2 LẦN LIÊN TIẾP vào CÙNG 1 nút (dùng để mở rộng ở lần 1) khiến
    // lần bấm thứ 2 chỉ TOGGLE dừng lại audio đang phát dở (audio.wav chỉ dài ~2.9s, lần bấm 2 rơi
    // đúng lúc vẫn đang phát) thay vì phát lại từ đầu - không phản ánh đúng tiền đề TC_019 ("thẻ đã
    // mở rộng SẴN", không quan tâm bằng cách nào), gây FAIL giả (không phải lỗi sản phẩm).
    await studentAnswerCard(page, "Luuk").click();
    expect(await isCardExpanded(page, "Luuk")).toBe(true);
    expect(await isStudentAudioPlaying(page, "Luuk")).toBe(false);

    await clickAudioButton(page, "Luuk");

    expect(await isCardExpanded(page, "Luuk")).toBe(true);
    await waitForStudentAudioPlaying(page, "Luuk");
  });

  test("TC_020 - đang phát audio HS A, bấm audio HS B -> dừng A, phát B", async ({ page }) => {
    await clickAudioButton(page, "Luuk");
    await waitForStudentAudioPlaying(page, "Luuk");

    await clickAudioButton(page, "Hoang Gia Minh");

    // SỬA (2026-09-11): có 1 nhịp chuyển tiếp ngắn (dừng A -> mới phát B) - poll thay vì check tức
    // thời cho B (xem waitForStudentAudioPlaying). Luuk (A) thì check tức thời ĐÚNG ý nghĩa hơn:
    // muốn xác nhận A đã dừng NGAY tại thời điểm B bắt đầu, không phải "cuối cùng A cũng dừng".
    await waitForStudentAudioPlaying(page, "Hoang Gia Minh");
    expect(await isStudentAudioPlaying(page, "Luuk")).toBe(false);
  });
});
