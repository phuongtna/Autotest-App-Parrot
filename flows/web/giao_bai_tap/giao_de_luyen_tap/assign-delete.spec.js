import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { loginForPracticeTestSpec } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestSpecSetup.js";
import {
  gotoPracticeTestList,
  openCreatePracticeTest,
  openRowEdit,
  openRowReport,
  openDeleteDialog,
  confirmDeleteDialog,
  cancelDeleteDialog,
  locateRowViaSearch,
  rowStillExists,
  deleteAllMatchingRows,
  searchByItemName,
  practiceTestListPageObjects as po,
} from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestListPageObjects.js";
import { listCompletedStudents } from "../../../../automation/giao_bai_tap/navigation/teacherReportPageObjects.js";
import {
  readCreateFormClassOptions,
  toggleClassCheckbox,
  readExamTypes,
  selectOnlyExamType,
  readDateField,
  listExerciseItems,
  toggleExerciseItemByIndex,
  clickSubmitAndWaitSuccess,
  assignFormPageObjects as afpo,
} from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestAssignFormPageObjects.js";

/**
 * Playwright Test THẬT cho nhóm "7. Xóa đề luyện tập đã giao" (ASSIGN-DELETE-01..06, nguồn
 * TESTCASES-giao-de-1.xlsx) - ĐÃ XÁC NHẬN THẬT PASS 4/4 + 2 SKIP có lý do, qua bản chạy trực tiếp
 * trước khi chuyển sang `.spec.js`.
 *
 * *** GHI DỮ LIỆU THẬT trên DEV: tự tạo 1 đề luyện tập test riêng - dòng này CHÍNH LÀ đối tượng bị
 * xóa thật ở ASSIGN-DELETE-03 (không cần cleanup riêng cho trường hợp đó). CHỦ ĐỘNG bị loại khỏi
 * `playwright.giao-de-luyen-tap.config.js` qua `testIgnore` - phải chạy bằng
 * `playwright.giao-de-luyen-tap-destructive.config.js`. KHÔNG đưa vào CI/full-suite. ***
 *
 * Cơ chế dialog xác nhận xóa (title/2 nút Hủy-Xóa) đã được xác nhận thật + test kỹ ở
 * `ac-multiclass-delete.spec.js` (nhóm case CŨ, TESTCASES.xlsx) - file này TÁI SỬ DỤNG trực tiếp
 * `openDeleteDialog`/`confirmDeleteDialog`/`cancelDeleteDialog` để verify lại dưới ID case MỚI
 * (ASSIGN-DELETE-*) theo đúng bộ spec hiện tại, không copy-paste lại cơ chế.
 *
 * ASSIGN-DELETE-04: ĐÃ XÁC NHẬN THẬT trên staging (2026-11-05) - dùng lại dòng THẬT có sẵn (lớp
 * "5X-RKLRejoin2", đề "Đề kiểm tra giữa kỳ 1 - Khối 6", 1/3 HS "Đã hoàn thành" với điểm, xem "Báo
 * cáo lớp") thay vì tự tạo (đề tự tạo luôn 0 HS làm, không dựng được trạng thái này qua UI GV
 * thuần). Dòng do người dùng chỉ định, KHÔNG phải dữ liệu tự sinh - xóa THẬT, không cleanup lại.
 *
 * ASSIGN-DELETE-05 [N/A] (2026-11-05, đã xác nhận với người yêu cầu test): trạng thái "làm dở, chưa
 * nộp bài" KHÔNG TỒN TẠI như 1 trạng thái riêng biệt của sản phẩm - "Báo cáo lớp" (Web GV) chỉ có
 * NHỊ PHÂN "Đã hoàn thành" / "Chưa nộp bài" (đã xác nhận thật qua DOM dump report thật), không có
 * khái niệm "đang làm, chưa nộp" nằm giữa 2 trạng thái đó. Case này SKIP VĨNH VIỄN (N/A), không
 * phải giới hạn tạm thời của automation.
 */
test.describe.serial('"Giao đề luyện tập" (Assign form) > Xóa đề luyện tập đã giao', () => {
  let context;
  let page;
  let className, itemTitle, dueDateLine;
  let created = false;
  let deletedForReal = false;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await loginForPracticeTestSpec(browser));
  });

  test.afterAll(async () => {
    // Dùng `deleteAllMatchingRows` thay vì `locateRowViaSearch` + `.catch` (ÂM THẦM bỏ qua cleanup
    // khi có ≥2 dòng trùng khóa định vị do chạy lại suite cùng ngày - xem docblock assign-submit.spec.js).
    if (created && !deletedForReal && className && itemTitle && dueDateLine) {
      await deleteAllMatchingRows(page, { className, title: itemTitle, dueDateLine });
    }
    await context?.close();
  });

  test("ASSIGN-DELETE (setup): tạo 1 đề luyện tập test riêng để xóa", async () => {
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

  test('ASSIGN-DELETE-01: hiển thị nút xóa (icon thùng rác) tách biệt với "Giao đề đã chọn"', async () => {
    const row = await locateRowViaSearch(page, { className, title: itemTitle, dueDateLine });
    await openRowEdit(page, row);
    const deleteBtn = page.locator(po.editPage.deleteIconButtonSelector);
    await expect(deleteBtn).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Hủy", exact: true })).toHaveCount(1);
    const saveBox = await page.getByRole("button", { name: /Giao đề đã chọn/ }).boundingBox();
    const deleteBox = await deleteBtn.boundingBox();
    expect(deleteBox && saveBox && (Math.abs(deleteBox.x - saveBox.x) >= 5 || Math.abs(deleteBox.y - saveBox.y) >= 5), "Icon xóa và nút \"Giao đề đã chọn\" trùng vị trí - selector có thể sai.").toBeTruthy();
  });

  test('ASSIGN-DELETE-02: [CẦN XÁC NHẬN] bấm icon xóa hiển thị popup xác nhận trước khi xóa thật', async () => {
    const dialog = await openDeleteDialog(page);
    await expect(dialog).toContainText(po.deleteConfirmDialog.title);
    await expect(dialog).toContainText("Bạn có chắc chắn muốn xóa đề luyện tập không?");
    await expect(dialog.getByRole("button", { name: po.deleteConfirmDialog.cancelButton, exact: true })).toHaveCount(1);
    await expect(dialog.getByRole("button", { name: po.deleteConfirmDialog.confirmButton, exact: true })).toHaveCount(1);
    await cancelDeleteDialog(page, dialog);
  });

  test('ASSIGN-DELETE-06: [CẦN XÁC NHẬN] hủy thao tác xóa giữa chừng ở popup xác nhận → dữ liệu không đổi', async () => {
    const dialog = await openDeleteDialog(page);
    await cancelDeleteDialog(page, dialog);
    const stillThere = await rowStillExists(page, { className, title: itemTitle, dueDateLine });
    expect(stillThere, 'Sau khi bấm "Hủy" ở dialog xác nhận xóa, dòng đề ĐÃ BIẾN MẤT.').toBe(true);
  });

  test('ASSIGN-DELETE-03: [CẦN XÁC NHẬN] xóa đề chưa có học sinh làm bài, xóa thành công', async () => {
    const row = await locateRowViaSearch(page, { className, title: itemTitle, dueDateLine });
    await openRowEdit(page, row);
    const dialog = await openDeleteDialog(page);
    await confirmDeleteDialog(page, dialog);
    deletedForReal = true;

    const stillThere = await rowStillExists(page, { className, title: itemTitle, dueDateLine });
    expect(stillThere, 'Sau khi xác nhận Xóa, dòng đề VẪN CÒN trong "Danh sách đề luyện tập đã giao" (phía Web GV).').toBe(false);
    // CHƯA kiểm tra phía app học sinh - ngoài phạm vi spec Web GV thuần.
  });

  test('ASSIGN-DELETE-04: [CẦN XÁC NHẬN] xóa đề luyện tập đã có học sinh làm bài và có điểm', async () => {
    const targetClassName = "5X-RKLRejoin2";
    const targetTitle = "Đề kiểm tra giữa kỳ 1 - Khối 6";

    await gotoPracticeTestList(page);
    await searchByItemName(page, targetTitle);
    const row = page.locator("table tbody tr", { hasText: targetClassName }).filter({ hasText: targetTitle });
    test.skip((await row.count()) !== 1, `Không tìm thấy đúng 1 dòng thật lớp "${targetClassName}" + đề "${targetTitle}" - dữ liệu có thể đã đổi/bị xóa.`);
    const deleteDueDateLine = (await row.locator("td").nth(2).innerText()).trim().split("\n")[0];

    // Xác nhận lại tiền điều kiện thật ngay trước khi xóa: vẫn còn ≥1 HS "Đã hoàn thành" (đã nộp,
    // có điểm) - tránh xóa nhầm nếu dữ liệu đã đổi so với lúc khảo sát.
    await openRowReport(page, row);
    await page.getByText(/Đã hoàn thành/).first().waitFor({ timeout: 15000 });
    const completed = await listCompletedStudents(page);
    test.skip(completed.length === 0, `Dòng "${targetTitle}" (lớp "${targetClassName}") không còn HS nào "Đã hoàn thành" - tiền điều kiện không còn đúng.`);

    const editRow = await locateRowViaSearch(page, { className: targetClassName, title: targetTitle, dueDateLine: deleteDueDateLine });
    await openRowEdit(page, editRow);
    const dialog = await openDeleteDialog(page);
    await confirmDeleteDialog(page, dialog);

    const stillThere = await rowStillExists(page, { className: targetClassName, title: targetTitle, dueDateLine: deleteDueDateLine });
    expect(stillThere, 'Sau khi xác nhận Xóa đề ĐÃ CÓ HS làm bài/có điểm, dòng đề VẪN CÒN trong "Danh sách đề luyện tập đã giao".').toBe(false);
  });

  test.skip('ASSIGN-DELETE-05: [N/A] xóa đề luyện tập đang có học sinh làm dở, chưa nộp bài', () => {
    // Đã xác nhận với người yêu cầu test: sản phẩm KHÔNG có trạng thái "làm dở, chưa nộp" riêng
    // biệt - chỉ có "Đã hoàn thành"/"Chưa nộp bài" (xem docblock đầu file). SKIP vĩnh viễn, không
    // phải giới hạn automation.
  });
});
