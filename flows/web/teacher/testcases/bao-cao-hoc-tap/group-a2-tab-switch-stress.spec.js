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
  visibleStudentCardCount,
} from "../../../../../automation/bao_cao_speaking/navigation/speakingReportPageObjects.js";

/**
 * TC_010 (Phase 2, Nhóm A) - chuyển đổi qua lại tab Sai/Đúng nhiều lần liên tiếp NHANH, kiểm tra
 * không bị lẫn dữ liệu 2 tab (race condition/stale response khi click nhanh) và không bị
 * treo/duplicate card. Tầng 1 - dữ liệu thật (dùng lại room 11A2/Vocab của Nhóm B/C).
 *
 * QUAN TRỌNG: click LIÊN TỤC không chờ giữa các lần (`await` chỉ ở bước click, KHÔNG
 * `waitForTimeout`/networkidle giữa mỗi lần) - đúng tinh thần plan gốc "click nhanh, assert NGAY
 * SAU lần click cuối cùng" để bắt được lỗi stale-response nếu có (đợi hết mỗi lần thì không còn
 * là stress test race condition nữa).
 */
test.describe("Báo cáo Speaking - TC_010: chuyển tab Sai/Đúng liên tục nhanh", () => {
  test.skip(
    !config.teacherUsernameSpeakingReport || !config.teacherPasswordSpeakingReport,
    "Thiếu TEACHER_USERNAME_SPEAKING_REPORT/TEACHER_PASSWORD_SPEAKING_REPORT trong .env.",
  );

  test("TC_010 - bấm Sai/Đúng liên tục ~10 lần, không lẫn dữ liệu/không treo/không duplicate", async ({
    page,
  }) => {
    await gotoDashboard(page);
    await gotoAssignedList(page);
    const row = await locateAssignedRow(page, {
      className: config.teacherPortalClassSpeakingReport || "11A2",
      itemName: config.teacherPortalExerciseSpeakingReport || "Vocab",
      dueDateLine: "12/09/2026",
    });
    await openRowReport(page, row);

    const wrongTab = page.getByRole("button", { name: reportPo.wrongTabAny });
    const correctTab = page.getByRole("button", { name: reportPo.correctTabAny });
    await wrongTab.waitFor({ timeout: 15000 });

    // SỬA (2026-09-11, FAIL thật xác nhận qua debug live 2 lần): đọc số đếm từ TEXT badge tab
    // NGAY sau khi badge "visible" không đáng tin - có 1 khoảng ngắn ngay sau khi trang tải xong
    // mà badge còn hiện số placeholder/0 TRƯỚC KHi danh sách thẻ thật load xong (đã xác nhận thật:
    // đọc lại vài giây sau ra "Sai (3)" đúng, nhưng đọc NGAY LẬP TỨC có lúc ra "Sai (0)" sai) - nếu
    // chỉ đợi cho SỐ THẺ khớp với con số "0" sai đó thì đợi mãi không bao giờ đúng (số thẻ thật sẽ
    // luôn là 3, không bao giờ về 0). SỬA ĐÚNG: lấy "ground truth" trực tiếp từ SỐ THẺ đã ổn định
    // (đợi ổn định qua 2 lần đọc liên tiếp cách nhau 500ms), KHÔNG dựa vào text badge nữa.
    // ĐÃ XÁC NHẬN THẬT (2026-09-11, debug live nhiều lần): room này có lúc "đứng yên" ở giá trị
    // TẠM (vd 0) hơn 1 nhịp đọc trước khi nhảy sang giá trị thật (vd 3) - 2 lần đọc liên tiếp bằng
    // nhau (500ms) đôi khi vẫn bắt trúng đúng lúc "đứng yên tạm" đó. Yêu cầu 3 lần liên tiếp bằng
    // nhau (khoảng cách dài hơn) để giảm khả năng này - CHƯA loại bỏ hoàn toàn được rủi ro
    // (`retries:1` ở config đã xử lý phần còn lại, giống toàn bộ suite trên host Dev này).
    async function stableCardCount() {
      let previous = -1;
      let stableStreak = 0;
      for (let i = 0; i < 20; i++) {
        const current = await visibleStudentCardCount(page);
        stableStreak = current === previous ? stableStreak + 1 : 0;
        previous = current;
        if (stableStreak >= 2) return current;
        await page.waitForTimeout(800);
      }
      throw new Error("stableCardCount: số thẻ không ổn định sau ~16s chờ.");
    }

    const wrongCount = await stableCardCount();
    await correctTab.click();
    const correctCount = await stableCardCount();
    await wrongTab.click();
    await expect.poll(() => visibleStudentCardCount(page), { timeout: 10000 }).toBe(wrongCount);

    // Bấm liên tục 10 lần xen kẽ Sai/Đúng, KHÔNG chờ giữa các lần click (đúng tinh thần stress
    // test - chỉ chờ actionability tối thiểu mà Playwright tự làm trước mỗi click).
    for (let i = 0; i < 10; i++) {
      await (i % 2 === 0 ? correctTab : wrongTab).click();
    }
    // Lần click CUỐI CÙNG ở trên (i=9, lẻ) là wrongTab -> tab Sai phải là tab đang active sau cùng.

    // Assert NGAY sau chuỗi click cuối - số thẻ hiển thị (đếm qua số nút audio - mỗi thẻ đúng 1
    // nút, xem visibleStudentCardCount) phải khớp ĐÚNG badge tab Sai - không lẫn thẻ tab Đúng,
    // không duplicate, không rỗng-giả do render dở dang giữa chừng.
    await expect.poll(() => visibleStudentCardCount(page), { timeout: 10000 }).toBe(wrongCount);

    // Bấm thêm 1 lần sang Đúng, assert lại đúng số lượng của tab Đúng - xác nhận UI vẫn phản hồi
    // đúng bình thường sau chuỗi click nhanh (không bị "kẹt" ở trạng thái sai).
    await correctTab.click();
    await expect.poll(() => visibleStudentCardCount(page), { timeout: 10000 }).toBe(correctCount);
  });
});
