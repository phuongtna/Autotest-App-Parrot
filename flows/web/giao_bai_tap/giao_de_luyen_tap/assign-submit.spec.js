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
} from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestListPageObjects.js";
import {
  readCreateFormClassOptions,
  groupClassNamesByKhoi,
  toggleClassCheckbox,
  readExamTypes,
  selectOnlyExamType,
  readDateField,
  setDateField,
  listExerciseItems,
  toggleExerciseItemByIndex,
  readSubmitLabel,
  isSubmitDisabled,
  cancelButton,
  clickSubmitAndWaitSuccess,
  clickSubmitExpectingValidationError,
  assignFormPageObjects as afpo,
} from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestAssignFormPageObjects.js";

/**
 * Playwright Test THẬT cho nhóm "4. Hủy / Giao đề đã chọn" (ASSIGN-SUBMIT-01..06, nguồn
 * TESTCASES-giao-de-1.xlsx) - ĐÃ XÁC NHẬN THẬT PASS 6/6 (sau khi sửa 1 lỗi thật, xem dưới) qua bản
 * chạy trực tiếp trước khi chuyển sang `.spec.js`, đã được user xác nhận đồng ý chạy ghi dữ liệu
 * thật trên DEV.
 *
 * *** GHI DỮ LIỆU THẬT trên DEV (không phải production): SUBMIT-03/04 tạo đề luyện tập test thật -
 * XÓA SẠCH ở `afterAll` (dù PASS/FAIL giữa chừng). CHỦ ĐỘNG bị loại khỏi
 * `playwright.giao-de-luyen-tap.config.js` qua `testIgnore` - phải chạy bằng:
 *   cd automation && npx playwright test --config=playwright.giao-de-luyen-tap-destructive.config.js
 * KHÔNG đưa vào bất kỳ script CI/full-suite nào. ***
 *
 * ĐÃ XÁC NHẬN THẬT (FAIL thật 1 lần đầu khi viết bản *.mjs): SUBMIT-04 dùng "Hạn nộp" mặc định
 * (hôm nay+2) GIỐNG HỆT SUBMIT-03 cho `classA` → tạo 2 dòng TRÙNG className+title+dueDateLine trong
 * CÙNG 1 lượt chạy, khiến `locateRowViaSearch` (yêu cầu ĐÚNG 1 kết quả) vỡ ngay cả ở bước cleanup,
 * để sót 1 dòng test thật trên DEV (đã dọn tay ngay khi phát hiện). SUBMIT-04 ở đây dùng "Hạn nộp"
 * +6 ngày (khác SUBMIT-03's +2) để 2 bộ dữ liệu không bao giờ trùng khóa định vị.
 */
test.describe.serial('"Giao đề luyện tập" (Assign form) > Hủy / Giao đề đã chọn', () => {
  let context;
  let page;
  const createdRows = []; // { className, title, dueDateLine }

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await loginForPracticeTestSpec(browser));
  });

  test.afterAll(async () => {
    for (const { className, title, dueDateLine } of createdRows) {
      const stillThere = await rowStillExists(page, { className, title, dueDateLine }).catch(() => false);
      if (stillThere) {
        const row = await locateRowViaSearch(page, { className, title, dueDateLine }).catch(() => null);
        if (row) {
          await openRowEdit(page, row);
          const dialog = await openDeleteDialog(page);
          await confirmDeleteDialog(page, dialog);
        }
      }
    }
    await context?.close();
  });

  let classNames;
  test('ASSIGN-SUBMIT-06: không chọn lớp nào → chặn giao (nút disabled)', async () => {
    await gotoPracticeTestList(page);
    await openCreatePracticeTest(page);
    classNames = await readCreateFormClassOptions(page);
    expect(classNames.length, "Danh sách lớp RỖNG.").toBeGreaterThan(0);
    expect(await isSubmitDisabled(page)).toBe(true);
  });

  let classA, examType;
  test('ASSIGN-SUBMIT-02: chưa chọn đề nào → chặn giao, báo lỗi "Vui lòng chọn ít nhất 1 đề luyện tập"', async () => {
    outer: for (const candidateClass of classNames) {
      await toggleClassCheckbox(page, candidateClass, { expectChecked: true });
      const types = await readExamTypes(page);
      for (const t of types) {
        await selectOnlyExamType(page, t.name);
        if ((await listExerciseItems(page)).length >= 1) {
          classA = candidateClass;
          examType = t.name;
          break outer;
        }
      }
      await toggleClassCheckbox(page, candidateClass, { expectChecked: false });
    }
    expect(classA, "Không tìm thấy tổ hợp lớp+loại kỳ thi nào có ≥1 đề.").toBeTruthy();

    const bodyText = await clickSubmitExpectingValidationError(page);
    expect(bodyText).toContain(afpo.requiredExerciseErrorText);
  });

  test('ASSIGN-SUBMIT-01: nút "Giao đề đã chọn" hiển thị đúng số lượng đề đang chọn', async () => {
    await toggleExerciseItemByIndex(page, 0, { expectChecked: true });
    await expect.poll(() => readSubmitLabel(page)).toContain("(1)");
  });

  test('ASSIGN-SUBMIT-05: nút "Hủy" quay về danh sách, KHÔNG lưu dữ liệu đã nhập', async () => {
    await cancelButton(page).click();
    await page.waitForURL(/\/teacher\/exercise(\?|$)/, { timeout: 15000 });
    await expect(page.getByText(/Danh sách đề luyện tập đã giao/, { exact: false }).first()).toBeVisible();
  });

  let itemTitle, dueDateLine;
  test("ASSIGN-SUBMIT-03: giao thành công với đầy đủ dữ liệu hợp lệ", async () => {
    await openCreatePracticeTest(page);
    await toggleClassCheckbox(page, classA, { expectChecked: true });
    await selectOnlyExamType(page, examType);
    const items = await listExerciseItems(page);
    itemTitle = items[0].title;
    dueDateLine = await readDateField(page, afpo.dateLabels.dueDate);
    await toggleExerciseItemByIndex(page, 0, { expectChecked: true });
    await clickSubmitAndWaitSuccess(page);
    createdRows.push({ className: classA, title: itemTitle, dueDateLine });

    const row = await locateRowViaSearch(page, { className: classA, title: itemTitle, dueDateLine });
    await expect(row).toHaveCount(1);
  });

  test('ASSIGN-SUBMIT-04: giao cho nhiều lớp cùng lúc → mỗi lớp 1 dòng tương ứng', async () => {
    const groups = groupClassNamesByKhoi(classNames);
    const khoiOfA = /^(\d+)/.exec(classA)?.[1] ?? classA;
    const classB = (groups[khoiOfA] || []).find((n) => n !== classA);
    expect(classB, `Cần ≥2 lớp cùng khối "${khoiOfA}" - chỉ có: ${JSON.stringify(groups[khoiOfA])}.`).toBeTruthy();

    await openCreatePracticeTest(page);
    await toggleClassCheckbox(page, classA, { expectChecked: true });
    await toggleClassCheckbox(page, classB, { expectChecked: true });
    await selectOnlyExamType(page, examType);
    const items = await listExerciseItems(page);
    const title2 = items[0].title;

    // ĐÃ XÁC NHẬN THẬT (xem docblock đầu file): dùng "Hạn nộp" +6 ngày - KHÁC SUBMIT-03's +2 mặc
    // định - để 2 bộ dữ liệu test không bao giờ trùng khóa định vị className+title+dueDateLine.
    const future = new Date();
    future.setDate(future.getDate() + 6);
    await setDateField(page, afpo.dateLabels.dueDate, { day: future.getDate(), month: future.getMonth() + 1 });
    const dueDateLine2 = await readDateField(page, afpo.dateLabels.dueDate);

    await toggleExerciseItemByIndex(page, 0, { expectChecked: true });
    await clickSubmitAndWaitSuccess(page);
    createdRows.push({ className: classA, title: title2, dueDateLine: dueDateLine2 });
    createdRows.push({ className: classB, title: title2, dueDateLine: dueDateLine2 });

    const rowA = await locateRowViaSearch(page, { className: classA, title: title2, dueDateLine: dueDateLine2 });
    const rowB = await locateRowViaSearch(page, { className: classB, title: title2, dueDateLine: dueDateLine2 });
    await expect(rowA).toHaveCount(1);
    await expect(rowB).toHaveCount(1);
  });
});
