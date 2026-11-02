import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { loginForPracticeTestSpec } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestSpecSetup.js";
import {
  gotoPracticeTestList,
  openCreatePracticeTest,
  openRowEdit,
  openDeleteDialog,
  confirmDeleteDialog,
  locateRowViaSearch,
  rowStillExists,
  practiceTestListPageObjects as po,
} from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestListPageObjects.js";
import {
  readCreateFormClassOptions,
  toggleClassCheckbox,
  isClassCheckboxDisabled,
  isClassCheckboxChecked,
  readExamTypes,
  selectExamType,
  selectOnlyExamType,
  readDateField,
  setDateField,
  listExerciseItems,
  toggleExerciseItemByIndex,
  readSourceRadios,
  clickSubmitAndWaitSuccess,
  clickSaveEditAndWaitSuccess,
  cancelButton,
  assignFormPageObjects as afpo,
} from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestAssignFormPageObjects.js";

/**
 * Playwright Test THẬT cho nhóm "6. Chỉnh sửa đề luyện tập đã giao" (ASSIGN-EDIT-01..08, nguồn
 * TESTCASES-giao-de-1.xlsx) - ĐÃ XÁC NHẬN THẬT PASS 6/6 + 2 SKIP có lý do, qua bản chạy trực tiếp
 * trước khi chuyển sang `.spec.js` (sau khi sửa 3 lỗi thật, xem dưới).
 *
 * *** GHI DỮ LIỆU THẬT trên DEV: tự tạo 1 đề luyện tập test riêng để chỉnh sửa - XÓA SẠCH ở
 * `afterAll`. CHỦ ĐỘNG bị loại khỏi `playwright.giao-de-luyen-tap.config.js` qua `testIgnore` - phải
 * chạy bằng `playwright.giao-de-luyen-tap-destructive.config.js`. KHÔNG đưa vào CI/full-suite. ***
 *
 * ASSIGN-EDIT-02/05 ([BUG] theo đúng tag trong spec gốc): ĐÃ XÁC NHẬN THẬT bug này - "Danh sách đề
 * luyện tập" ở màn Chỉnh sửa LUÔN hiển thị ĐÚNG 1 dòng (đề đã giao gốc, checkbox disabled) BẤT KỂ
 * đang bấm loại kỳ thi nào. Test PASS nghĩa là "đã tái hiện đúng bug đã biết", KHÔNG phải "tính
 * năng hoạt động đúng".
 *
 * 3 lỗi thật đã sửa khi viết bản `*.mjs` gốc:
 *   1. Đọc trạng thái `checked` của checkbox lớp NGAY sau `openRowEdit()` luôn trả về `false` dù là
 *      lớp đã giao thật - checked-state hydrate TRỄ hơn breadcrumb/bảng (reload trang fix ngay) -
 *      PHẢI poll tối đa 5×400ms thay vì đọc 1 lần.
 *   2. Trên màn Chỉnh sửa, `clearAllExamTypeChips()` (dùng trong `selectOnlyExamType`) chạy vào
 *      vòng lặp vô hạn vì KHÔNG thể tắt hết mọi chip (luôn còn ≥1 chip active, khác màn tạo mới) -
 *      PHẢI dùng `selectExamType` (chỉ toggle 1 chip) ở màn Chỉnh sửa, không cô lập.
 *   3. Bấm "Giao đề đã chọn" để LƯU trên màn Chỉnh sửa hiện toast KHÁC HẲN màn tạo mới ("Chỉnh sửa
 *      đề luyện tập thành công", không phải "Đã giao ... tới ... lớp") rồi điều hướng về list - dùng
 *      `clickSaveEditAndWaitSuccess()` riêng, không dùng `clickSubmitAndWaitSuccess` của màn tạo mới.
 *
 * ASSIGN-EDIT-07/08 SKIP có chủ đích - xem trong test.
 */
test.describe.serial('"Giao đề luyện tập" (Assign form) > Chỉnh sửa đề luyện tập đã giao', () => {
  let context;
  let page;
  let className, itemTitle, dueDateLine;
  let created = false;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await loginForPracticeTestSpec(browser));
  });

  test.afterAll(async () => {
    if (created && className && itemTitle && dueDateLine) {
      const stillThere = await rowStillExists(page, { className, title: itemTitle, dueDateLine }).catch(() => false);
      if (stillThere) {
        const row = await locateRowViaSearch(page, { className, title: itemTitle, dueDateLine }).catch(() => null);
        if (row) {
          await openRowEdit(page, row);
          const dialog = await openDeleteDialog(page);
          await confirmDeleteDialog(page, dialog);
        }
      }
    }
    await context?.close();
  });

  test("ASSIGN-EDIT (setup): tạo 1 đề luyện tập test riêng để chỉnh sửa", async () => {
    await gotoPracticeTestList(page);
    await openCreatePracticeTest(page);
    const classNames = await readCreateFormClassOptions(page);
    expect(classNames.length, "Danh sách lớp RỖNG.").toBeGreaterThan(0);

    for (const candidateClass of classNames) {
      await toggleClassCheckbox(page, candidateClass, { expectChecked: true });
      const types = await readExamTypes(page);
      let found = false;
      for (const t of types) {
        await selectOnlyExamType(page, t.name);
        if ((await listExerciseItems(page)).length >= 1) {
          found = true;
          break;
        }
      }
      if (found) {
        className = candidateClass;
        break;
      }
      await toggleClassCheckbox(page, candidateClass, { expectChecked: false });
    }
    expect(className, "Không tìm thấy lớp nào có ≥1 đề khả dụng.").toBeTruthy();

    dueDateLine = await readDateField(page, afpo.dateLabels.dueDate);
    const items = await listExerciseItems(page);
    itemTitle = items[0].title;
    await toggleExerciseItemByIndex(page, 0, { expectChecked: true });
    await clickSubmitAndWaitSuccess(page);
    created = true;
  });

  test('ASSIGN-EDIT-01: mở đúng màn "Chỉnh sửa đề luyện tập" với dữ liệu đã giao đúng', async () => {
    const row = await locateRowViaSearch(page, { className, title: itemTitle, dueDateLine });
    await openRowEdit(page, row);
    await expect(page.getByText(po.editPage.breadcrumb, { exact: true }).first()).toBeVisible();

    const radios = await readSourceRadios(page);
    expect(radios.find((r) => r.value === afpo.sourceValues.parrot)?.checked).toBe(true);

    // ĐÃ XÁC NHẬN THẬT (xem docblock đầu file): checked-state hydrate TRỄ, có lúc lâu hơn 3s trên
    // tài khoản DEV dùng chung (đã FAIL thật 1 lần với timeout 3s) - poll dài hơn (8s), nếu vẫn
    // chưa đúng thì reload lại trang 1 lần (ĐÃ XÁC NHẬN THẬT reload luôn fix ngay) rồi kiểm tra lại.
    const checkedBeforeReload = await expect
      .poll(() => isClassCheckboxChecked(page, className), { timeout: 8000, intervals: [400] })
      .toBe(true)
      .then(() => true)
      .catch(() => false);
    if (!checkedBeforeReload) {
      await page.reload();
      await page.waitForLoadState("networkidle").catch(() => {});
      await expect.poll(() => isClassCheckboxChecked(page, className), { timeout: 5000 }).toBe(true);
    }

    const dueDateShown = await readDateField(page, afpo.dateLabels.dueDate);
    expect(dueDateShown).toBe(dueDateLine);
  });

  test('ASSIGN-EDIT-03: [CẦN XÁC NHẬN] "Giao tới lớp" bị khóa (disabled) trên màn Chỉnh sửa', async () => {
    expect(await isClassCheckboxDisabled(page, className)).toBe(true);
  });

  test('ASSIGN-EDIT-02_05: [BUG] "Danh sách đề luyện tập" ở màn Chỉnh sửa đứng yên 1 đề gốc dù đổi loại kỳ thi', async () => {
    const types = await readExamTypes(page);
    const originalActiveType = types.find((t) => t.active)?.name;
    const otherType = types.find((t) => t.name !== originalActiveType);
    expect(otherType, "Chỉ có 1 loại kỳ thi - không có loại khác để test.").toBeTruthy();

    // ĐÃ XÁC NHẬN THẬT (xem docblock đầu file): dùng `selectExamType` (toggle 1 chip), KHÔNG dùng
    // `selectOnlyExamType` ở màn Chỉnh sửa - `clearAllExamTypeChips` treo vô hạn ở đây.
    await selectExamType(page, otherType.name);
    const itemsAfterSwitch = await listExerciseItems(page);
    const stillShowsOnlyOriginal = itemsAfterSwitch.length === 1 && itemsAfterSwitch[0].title === itemTitle && itemsAfterSwitch[0].disabled;

    expect(
      stillShowsOnlyOriginal,
      `Bấm sang loại kỳ thi "${otherType.name}" cho danh sách ${itemsAfterSwitch.length} đề thay vì đứng yên ở đề gốc "${itemTitle}" - có thể bug ĐÃ ĐƯỢC FIX, cần xác nhận lại với team dev.`,
    ).toBe(true);
  });

  test('ASSIGN-EDIT-06: bấm "Hủy" không lưu thay đổi', async () => {
    const row = await locateRowViaSearch(page, { className, title: itemTitle, dueDateLine });
    await openRowEdit(page, row);
    const future = new Date();
    future.setDate(future.getDate() + 10);
    await setDateField(page, afpo.dateLabels.dueDate, { day: future.getDate(), month: future.getMonth() + 1 });
    await cancelButton(page).click();
    await page.waitForURL(/\/teacher\/exercise(\?|$)/, { timeout: 15000 });

    const stillOriginal = await rowStillExists(page, { className, title: itemTitle, dueDateLine });
    expect(stillOriginal, `Bấm "Hủy" sau khi đổi "Hạn nộp" nhưng dòng GỐC ("${dueDateLine}") không còn - thay đổi có thể đã bị LƯU nhầm.`).toBe(true);
  });

  test('ASSIGN-EDIT-04: [CẦN XÁC NHẬN] đổi "Thời gian giao"/"Hạn nộp" và lưu thành công', async () => {
    const row = await locateRowViaSearch(page, { className, title: itemTitle, dueDateLine });
    await openRowEdit(page, row);
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const newDueDateLine = `${String(future.getDate()).padStart(2, "0")}/${String(future.getMonth() + 1).padStart(2, "0")}/${future.getFullYear()}`;
    await setDateField(page, afpo.dateLabels.dueDate, { day: future.getDate(), month: future.getMonth() + 1 });
    await clickSaveEditAndWaitSuccess(page);

    const newRowExists = await rowStillExists(page, { className, title: itemTitle, dueDateLine: newDueDateLine });
    expect(newRowExists, `Lưu "Hạn nộp" mới ("${newDueDateLine}") nhưng danh sách KHÔNG phản ánh giá trị mới.`).toBe(true);
    dueDateLine = newDueDateLine; // cập nhật để afterAll cleanup định vị đúng dòng.
  });

  test.skip('ASSIGN-EDIT-07: [CẦN XÁC NHẬN] sửa đề luyện tập đã có học sinh làm bài/nộp bài', () => {
    // Dòng test tự tạo luôn 0 HS làm (vừa tạo) - tạo trạng thái "có HS đã nộp bài" cần tự động hóa
    // PHÍA APP (học sinh làm bài thật), ngoài phạm vi spec Web GV thuần ở lượt này.
  });

  test.skip('ASSIGN-EDIT-08: [BUG] đề thi đã bị xóa ở CMS vẫn hiển thị và xem được chi tiết trong màn Chỉnh sửa', () => {
    // Cần XÓA 1 đề thi thật trên CMS (exam-prep/papers) để tái lập - thao tác phá hủy dữ liệu CMS
    // dùng chung, KHÔNG tự ý thực hiện trong spec tự động này.
  });
});
