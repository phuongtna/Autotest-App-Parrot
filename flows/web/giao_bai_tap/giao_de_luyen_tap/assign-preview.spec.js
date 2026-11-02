import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { loginForPracticeTestSpec } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestSpecSetup.js";
import { gotoPracticeTestList, openCreatePracticeTest } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestListPageObjects.js";
import {
  readCreateFormClassOptions,
  toggleClassCheckbox,
  readExamTypes,
  selectOnlyExamType,
  listExerciseItems,
  toggleExerciseItemByIndex,
  openPreviewByIndex,
  closePreview,
  readPreviewSections,
  correctAnswerMarkers,
  scrollPreviewToBottom,
  assignFormPageObjects as afpo,
} from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestAssignFormPageObjects.js";

/**
 * Playwright Test THẬT cho nhóm "3. Popup xem chi tiết đề (Preview)" (ASSIGN-PREVIEW-01..07, nguồn
 * TESTCASES-giao-de-1.xlsx) - màn "Giao đề luyện tập" tạo mới. ĐÃ XÁC NHẬN THẬT PASS 7/7 qua bản
 * chạy trực tiếp trước khi chuyển sang `.spec.js`.
 *
 * Dùng loại kỳ thi/đề có nhiều section, nhiều câu hỏi nhất tìm được thật trên tài khoản DEV để có
 * đủ dữ liệu test PREVIEW-02/03/05. ASSIGN-PREVIEW-03 ("mỗi câu hỏi hiển thị đủ 4 đáp án") CHỈ
 * spot-check 1 câu thuộc khối câu hỏi trắc nghiệm chuẩn (border rounded-xl), không áp đặt "luôn
 * đúng 4 đáp án" lên MỌI dạng câu hỏi trong đề (đề thật có nhiều dạng khác nhau).
 *
 * CHỈ ĐỌC - không bấm "Giao đề đã chọn", không tạo dữ liệu thật trên DEV.
 */
test.describe.serial('"Giao đề luyện tập" (Assign form) > Popup xem chi tiết đề (Preview)', () => {
  let context;
  let page;
  let richestItemIndex = -1;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await loginForPracticeTestSpec(browser));
    await gotoPracticeTestList(page);
    await openCreatePracticeTest(page);
    const classNames = await readCreateFormClassOptions(page);
    expect(classNames.length, "Danh sách lớp RỖNG.").toBeGreaterThan(0);
    await toggleClassCheckbox(page, classNames[0], { expectChecked: true });

    const types = await readExamTypes(page);
    let richestType = null;
    let richestQuestionCount = -1;
    for (const t of types) {
      await selectOnlyExamType(page, t.name);
      const items = await listExerciseItems(page);
      for (let i = 0; i < items.length; i++) {
        const rowText = await items[i].row.innerText();
        const count = Number(/(\d+)\s*(C|c)âu hỏi/.exec(rowText)?.[1] ?? 0);
        if (count > richestQuestionCount) {
          richestQuestionCount = count;
          richestItemIndex = i;
          richestType = t.name;
        }
      }
    }
    expect(richestItemIndex, "Không tìm thấy đề nào để mở popup xem chi tiết.").toBeGreaterThanOrEqual(0);
    await selectOnlyExamType(page, richestType);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  let dialog;
  test('ASSIGN-PREVIEW-01: mở đúng popup xem chi tiết khi bấm "Xem chi tiết"', async () => {
    const items = await listExerciseItems(page);
    dialog = await openPreviewByIndex(page, richestItemIndex);
    await expect(dialog.locator("h2").first()).toHaveText(items[richestItemIndex].title);
  });

  test("ASSIGN-PREVIEW-02: câu hỏi được nhóm đúng theo Section, đúng số câu mỗi section", async () => {
    const sections = await readPreviewSections(dialog);
    expect(sections.length, "Popup không có section nào.").toBeGreaterThan(0);
    const sumFromSections = sections.reduce((sum, s) => sum + (Number(/\d+/.exec(s.countText)?.[0]) || 0), 0);
    const headerText = await dialog.locator('[data-slot="dialog-header"]').innerText();
    const headerTotal = Number(/(\d+)\s*câu hỏi/.exec(headerText)?.[1]);
    expect(headerTotal).toBeTruthy();
    expect(sumFromSections, `Tổng câu hỏi cộng dồn theo section (${sumFromSections}) không khớp header (${headerTotal}) - sections: ${JSON.stringify(sections)}.`).toBe(headerTotal);
  });

  test("ASSIGN-PREVIEW-03: nội dung câu hỏi đầu tiên hiển thị đủ đề bài, 4 đáp án, đáp án đúng", async () => {
    const firstQuestionCard = dialog.locator(".border.rounded-xl.p-6.bg-white").first();
    test.skip((await firstQuestionCard.count()) === 0, "Không tìm thấy khối câu hỏi trắc nghiệm chuẩn để spot-check.");
    const promptText = await firstQuestionCard.locator("h3, h6").first().innerText().catch(() => "");
    expect(promptText.trim()).toBeTruthy();
    await expect(firstQuestionCard.locator("[aria-disabled]")).toHaveCount(4);
    await expect(firstQuestionCard.locator(`[class*="${afpo.correctAnswerClassMarker}"]`)).toHaveCount(1);
  });

  test("ASSIGN-PREVIEW-04: popup chỉ ở chế độ xem (read-only), không cho sửa đáp án", async () => {
    const options = dialog.locator('[aria-disabled="true"]');
    expect(await options.count(), 'Không có đáp án nào mang aria-disabled="true".').toBeGreaterThan(0);
    await expect(dialog.locator('[aria-disabled="false"]')).toHaveCount(0);
  });

  test("ASSIGN-PREVIEW-05: cuộn xem hết toàn bộ câu hỏi trong đề dài", async () => {
    expect(await scrollPreviewToBottom(dialog), "Cuộn popup xuống đáy nhưng chưa đạt scrollHeight.").toBe(true);
    expect(await correctAnswerMarkers(dialog).count(), "Sau khi cuộn xuống đáy, không còn thấy đáp án đúng nào - nội dung có thể đã unmount.").toBeGreaterThan(0);
    // Đóng popup đang mở từ PREVIEW-01 trước khi các test sau thao tác lại với danh sách phía sau.
    await closePreview(page, dialog);
  });

  test('ASSIGN-PREVIEW-06: đóng popup bằng "X" không ảnh hưởng trạng thái tích chọn ngoài danh sách', async () => {
    await toggleExerciseItemByIndex(page, richestItemIndex, { expectChecked: true });
    const dialog2 = await openPreviewByIndex(page, richestItemIndex);
    await closePreview(page, dialog2);
    const items = await listExerciseItems(page);
    expect(items[richestItemIndex].checked, "Đóng popup bằng nút X làm MẤT trạng thái checked đã tích trước đó.").toBe(true);
    await toggleExerciseItemByIndex(page, richestItemIndex, { expectChecked: false });
  });

  test("ASSIGN-PREVIEW-07: xem chi tiết 1 đề CHƯA tích chọn", async () => {
    const items = await listExerciseItems(page);
    expect(items[richestItemIndex].checked, "Tiền điều kiện sai - đề cần đang unchecked.").toBe(false);
    const dialog3 = await openPreviewByIndex(page, richestItemIndex);
    await expect(dialog3.locator("h2").first()).not.toBeEmpty();
    await closePreview(page, dialog3);
    const itemsAfter = await listExerciseItems(page);
    expect(itemsAfter[richestItemIndex].checked, "Mở rồi đóng popup cho đề CHƯA tích chọn lại khiến đề đó TỰ TÍCH CHỌN.").toBe(false);
  });
});
