import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { loginForPracticeTestSpec } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestSpecSetup.js";
import {
  gotoPracticeTestList,
  openCreatePracticeTest,
  locateRowViaSearch,
  deleteAllMatchingRows,
} from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestListPageObjects.js";
import {
  readCreateFormClassOptions,
  toggleClassCheckbox,
  readExamTypes,
  selectExamType,
  clearAllExamTypeChips,
  readDateField,
  listExerciseItems,
  toggleExerciseItemByIndex,
  clickSubmitAndWaitSuccess,
  assignFormPageObjects as afpo,
} from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestAssignFormPageObjects.js";

/**
 * Playwright Test THẬT cho nhóm "5. Acceptance Criteria (đa đề / HS vào lớp sau / thông báo)"
 * (AC-01..07, nguồn TESTCASES-giao-de-1.xlsx) - CHỈ tự động hóa AC-01 (case DUY NHẤT verify được
 * thuần qua UI Web GV). AC-02..07 SKIP có lý do cụ thể, KHÔNG fake/giả lập:
 *   - AC-02/03/04: cần thao tác thêm/rời HS khỏi lớp PHÍA APP rồi quan sát danh sách bài phía app -
 *     vượt phạm vi 1 spec Web GV thuần.
 *   - AC-05/06: cần giả lập cron job xử lý trễ ở backend - không có control nào lộ ra ở UI Web GV.
 *   - AC-07: cần xác nhận thông báo nhận được ở phía app/push - cross-check app-side.
 *
 * *** GHI DỮ LIỆU THẬT trên DEV: AC-01 tạo đề luyện tập test thật (giao 3 đề cho 1 lớp) - XÓA SẠCH
 * ở `afterAll`. CHỦ ĐỘNG bị loại khỏi `playwright.giao-de-luyen-tap.config.js` qua `testIgnore` -
 * phải chạy bằng `playwright.giao-de-luyen-tap-destructive.config.js`. KHÔNG đưa vào CI/full-suite. ***
 *
 * ĐÃ XÁC NHẬN THẬT PASS qua bản chạy trực tiếp trước khi chuyển sang `.spec.js` (sau khi sửa 1 lỗi
 * thật: đọc nhiều dòng theo nhiều tên đề khác nhau PHẢI đọc `.innerText()` ngay trong cùng 1 vòng
 * lặp search, KHÔNG định vị cả 3 locator trước rồi đọc sau - `locateRowViaSearch` đổi nội dung ô
 * search đang hiển thị trên `page` dùng chung, locator định vị TRƯỚC sẽ trỏ nhầm vào kết quả search
 * CỦA LẦN SAU).
 */
test.describe.serial('"Giao đề luyện tập" (Assign form) > Acceptance Criteria (AC-01..07)', () => {
  let context;
  let page;
  const createdRows = []; // { className, title, dueDateLine }

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await loginForPracticeTestSpec(browser));
  });

  test.afterAll(async () => {
    // Dùng `deleteAllMatchingRows` (xóa TẤT CẢ dòng khớp) thay vì `locateRowViaSearch` + `.catch`
    // (ÂM THẦM bỏ qua cleanup khi có ≥2 dòng trùng khóa định vị do chạy lại suite cùng ngày - xem
    // docblock assign-submit.spec.js).
    for (const { className, title, dueDateLine } of createdRows) {
      await deleteAllMatchingRows(page, { className, title, dueDateLine });
    }
    await context?.close();
  });

  let className, itemTitles, dueDateLine;
  test("AC-01 (setup): giao 3 đề khác nhau cùng lúc cho 1 lớp", async () => {
    await gotoPracticeTestList(page);
    await openCreatePracticeTest(page);
    const classNames = await readCreateFormClassOptions(page);
    expect(classNames.length, "Danh sách lớp RỖNG.").toBeGreaterThan(0);

    // Dùng hành vi MULTI-SELECT CHIP thật của "Chọn loại kỳ thi" (xem docblock
    // practiceTestAssignFormPageObjects.js) - bật nhiều loại kỳ thi cùng lúc để hợp (union) đủ ≥3
    // đề khác nhau cho 1 lớp.
    for (const candidateClass of classNames) {
      await toggleClassCheckbox(page, candidateClass, { expectChecked: true });
      await clearAllExamTypeChips(page);
      const types = await readExamTypes(page);
      for (const t of types) {
        await selectExamType(page, t.name);
        if ((await listExerciseItems(page)).length >= 3) break;
      }
      if ((await listExerciseItems(page)).length >= 3) {
        className = candidateClass;
        break;
      }
      await toggleClassCheckbox(page, candidateClass, { expectChecked: false });
    }
    expect(className, "Không tìm thấy lớp nào có ≥3 đề khả dụng (kể cả hợp nhiều loại kỳ thi).").toBeTruthy();

    dueDateLine = await readDateField(page, afpo.dateLabels.dueDate);
    const items = await listExerciseItems(page);
    itemTitles = [items[0].title, items[1].title, items[2].title];
    await toggleExerciseItemByIndex(page, 0, { expectChecked: true });
    await toggleExerciseItemByIndex(page, 1, { expectChecked: true });
    await toggleExerciseItemByIndex(page, 2, { expectChecked: true });
    await clickSubmitAndWaitSuccess(page);
    for (const title of itemTitles) createdRows.push({ className, title, dueDateLine });
  });

  test("AC-01: hiển thị riêng từng đề trong danh sách đã giao, không gộp", async () => {
    expect(new Set(itemTitles).size, `Kỳ vọng 3 đề khác nhau thật: ${JSON.stringify(itemTitles)}.`).toBe(3);

    // ĐÃ XÁC NHẬN THẬT: đọc `.innerText()` NGAY trong CÙNG 1 vòng lặp, ngay sau khi định vị, trước
    // khi search sang tên đề tiếp theo (xem docblock đầu file) - KHÔNG tách thành 2 vòng lặp.
    for (const title of itemTitles) {
      const row = await locateRowViaSearch(page, { className, title, dueDateLine });
      const doneCell = (await row.locator("td").nth(3).innerText()).trim();
      expect(doneCell, `Dòng đề "${title}" mới tạo kỳ vọng "0/y" (tính độc lập theo từng đề) - thực tế "${doneCell}".`).toMatch(/^0\//);
    }
  });

  test.skip("AC-02: [ĐÃ XÁC NHẬN THẬT - PASS, chưa tự động hóa] HS vào lớp SAU khi GV đã giao đề → tự động được gán đề còn hạn", () => {
    // ĐÃ XÁC NHẬN THẬT (2026-11-05, thao tác thủ công, lớp "5D" trên staging): lớp có 6 đề luyện
    // tập đã giao, 5 đề còn hạn (06/11) + 1 đề quá hạn ("Đề thi Reading", hạn 04/11). Duyệt 1 HS
    // mới vào lớp -> Web GV: sĩ số track của CẢ 5 đề còn hạn tăng từ 4 -> 5 (HS mới ĐƯỢC gán vào
    // tất cả). App (ảnh chụp màn hình thật của chính HS đó, tab "Ôn thi" > "Đề thầy cô giao"): hiện
    // ĐÚNG "5 đề". KẾT LUẬN: PASS thật.
  });

  test.skip("AC-03: [ĐÃ XÁC NHẬN THẬT - PASS, chưa tự động hóa] HS vào lớp sau khi đề ĐÃ quá hạn → KHÔNG được gán đề đó", () => {
    // ĐÃ XÁC NHẬN THẬT cùng lượt với AC-02 (xem ghi chú trên): đề quá hạn "Đề thi Reading" (lớp
    // "5D", hạn 04/11) sĩ số track VẪN GIỮ NGUYÊN 4 sau khi duyệt HS mới (không tăng lên 5 như 5
    // đề còn hạn kia) - HS mới KHÔNG được gán đề quá hạn. Khớp đúng app chỉ hiện "5 đề" (thiếu đúng
    // đề quá hạn này trong tổng 6 đề của lớp). KẾT LUẬN: PASS thật.
  });

  test.skip('AC-04: [ĐÃ XÁC NHẬN THẬT - PASS, chưa tự động hóa] HS rời lớp trước khi đề hết hạn — đề có bị thu hồi khỏi HS đó không', () => {
    // ĐÃ XÁC NHẬN THẬT ĐỦ 2 PHÍA (2026-11-05, thao tác thủ công, lớp "5X-RKLRejoin2", đề "Đề kiểm
    // tra giữa kỳ 1 - Khối 6 sửa 12", HS "QA Auto Child 20260918_132120"):
    //   - Web GV: giao đề cho lớp 3 HS, sau khi rời 1 HS khỏi lớp, "Báo cáo lớp" của đề đó chỉ còn
    //     track 2/2 HS - HS đã rời KHÔNG còn xuất hiện ở cả 2 nhóm "Chưa nộp bài"/"Đã hoàn thành".
    //   - App (ảnh chụp màn hình thật, tab "Ôn thi" > "Đề thầy cô giao" của chính HS đó): "0 đề" -
    //     "Chưa có đề ôn thi nào được giao" - đề ĐÃ bị thu hồi hoàn toàn khỏi app của HS.
    // KẾT LUẬN: PASS thật - đề bị thu hồi đúng khi HS rời lớp. SKIP ở đây vì đây là xác nhận THỦ
    // CÔNG 1 lần (cần Maestro/app automation + API rời lớp thật để tự động hóa lặp lại được).
  });

  test.skip('AC-05: thông báo "giao đề" có mốc kích hoạt đã qua → không gửi bù', () => {
    // Cần giả lập cron job xử lý trễ ở backend - không có control nào lộ ra ở UI Web GV.
  });

  test.skip('AC-06: thông báo "nhắc hạn nộp" có mốc đã qua → không gửi bù, chỉ gửi mốc còn ở tương lai', () => {
    // Cùng lý do SKIP với AC-05 - cần backend/cron control.
  });

  test.skip("AC-07: giao đề thành công kích hoạt đúng thông báo cho các mốc còn hiệu lực", () => {
    // Cần xác nhận thông báo nhận được ở phía app/push - cross-check app-side.
  });
});
