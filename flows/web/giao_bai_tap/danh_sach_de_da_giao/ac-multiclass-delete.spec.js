import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { loginForPracticeTestSpec } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestSpecSetup.js";
import { AssignedRowNotFoundError } from "../../../../automation/giao_bai_tap/navigation/teacherAssignedListPageObjects.js";
import {
  gotoPracticeTestList,
  openCreatePracticeTest,
  openRowEdit,
  openDeleteDialog,
  confirmDeleteDialog,
  cancelDeleteDialog,
  searchByItemName,
  practiceTestListPageObjects as po,
} from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestListPageObjects.js";

/**
 * Playwright Test THẬT cho nhóm "8. Acceptance Criteria — Giao nhiều lớp & Xóa" (AC-01..05,
 * TESTCASES.xlsx tab "Giao đề luyện tập") - chuyển thể 1:1 từ runtime/multiClassAndDeleteFlow.js
 * (ĐÃ XÁC NHẬN THẬT PASS 2026-11-02, đã được user xác nhận đồng ý chạy ghi dữ liệu thật trên DEV).
 *
 * *** GHI DỮ LIỆU THẬT trên DEV (không phải production): TẠO 1 đề luyện tập test giao cho 2 lớp
 * (2 lớp ĐẦU TIÊN đọc được thật từ form, không hardcode) rồi XÓA SẠCH ở `afterAll` (dù PASS/FAIL
 * giữa chừng) - KHÔNG đụng tới bất kỳ dòng có sẵn nào của tài khoản. CHỦ ĐỘNG bị loại khỏi
 * `playwright.giao-de-luyen-tap.config.js` qua `testIgnore` - phải chạy bằng config riêng:
 *   cd automation && npx playwright test --config=playwright.giao-de-luyen-tap-destructive.config.js
 *   (hoặc `npm run test-giao-de-luyen-tap-destructive-pw`)
 * KHÔNG đưa vào bất kỳ script CI/full-suite nào. ***
 *
 * AC-05 trả lời trực tiếp câu hỏi "CẦN XÁC NHẬN PHẠM VI" ở sheet "Ghi chú & Giả định": xóa 1 dòng
 * của đề đã giao nhiều lớp có xóa luôn dòng của lớp kia không - quan sát THẬT qua kết quả (ĐÃ XÁC
 * NHẬN: KHÔNG ảnh hưởng, chỉ xóa riêng lớp đã thao tác).
 */
async function selectClassOnCreateForm(page, className) {
  const labelText = page.getByText(className, { exact: true }).first();
  const checkbox = labelText.locator("xpath=ancestor::label[1]//input[@type='checkbox']");
  let checked = false;
  for (let attempt = 1; attempt <= 3 && !checked; attempt++) {
    await labelText.click();
    await page.waitForTimeout(300);
    checked = await checkbox.isChecked().catch(() => false);
  }
  expect(checked, `Đã bấm chọn lớp "${className}" 3 lần nhưng checkbox vẫn KHÔNG chuyển sang checked.`).toBe(true);
}

async function readCreateFormClassOptions(page) {
  const labels = page.locator("label").filter({ has: page.locator('input[type="checkbox"]') });
  return (await labels.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
}

async function readDisplayedDueDate(page) {
  const container = page.getByText("Hạn nộp", { exact: true }).locator("xpath=following::*[1]");
  const text = (await container.innerText()).trim();
  const match = /^(\d{2}\/\d{2}\/\d{4})/.exec(text);
  expect(match, `Không đọc được "Hạn nộp" hiển thị trên form tạo mới - text thật: "${text}".`).not.toBeNull();
  return match[1];
}

/** Định vị 1 dòng bằng className+title+dueDateLine - DÙNG SEARCH (không phải lật trang danh sách
 * mặc định, ~70+ dòng/3 trang trên tài khoản DEV dùng chung, liên tục có dữ liệu mới - ĐÃ XÁC NHẬN
 * THẬT quét theo trang có thể bỏ sót dòng vừa tạo dù dòng đó CÓ THẬT). Retry vài lần cách nhau
 * 1.5s - ĐÃ XÁC NHẬN THẬT ngay sau toast thành công, dòng mới có thể CHƯA lập tức xuất hiện qua
 * search (độ trễ propagate/index ngắn phía backend). */
async function locateRowViaSearch(page, { className, title, dueDateLine }, { retries = 5, retryDelayMs = 1500 } = {}) {
  let lastCount = 0;
  for (let attempt = 1; attempt <= retries; attempt++) {
    await gotoPracticeTestList(page);
    await searchByItemName(page, title);
    const row = page.locator("table tbody tr", { hasText: className }).filter({ hasText: title }).filter({ hasText: dueDateLine });
    lastCount = await row.count();
    if (lastCount === 1) return row.first();
    if (attempt < retries) await page.waitForTimeout(retryDelayMs);
  }
  throw new AssignedRowNotFoundError(
    `locateRowViaSearch: tìm thấy ${lastCount} dòng khớp lớp="${className}" + bài="${title}" + hạn nộp="${dueDateLine}" (cần đúng 1), đã thử lại ${retries} lần.`,
  );
}

async function rowExists(page, className, title, dueDate) {
  try {
    await locateRowViaSearch(page, { className, title, dueDateLine: dueDate });
    return true;
  } catch (err) {
    if (err instanceof AssignedRowNotFoundError) return false;
    throw err;
  }
}

test.describe.serial('"Giao đề luyện tập" > Acceptance Criteria — Giao nhiều lớp & Xóa (AC-01..05)', () => {
  let context;
  let page;
  let classA;
  let classB;
  let itemTitle;
  let dueDateLine;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await loginForPracticeTestSpec(browser));
  });

  test.afterAll(async () => {
    // DỌN DẸP: xóa sạch mọi dòng vừa tạo còn sót lại (dù PASS/FAIL giữa chừng) - KHÔNG để lại dữ
    // liệu test trên tài khoản DEV dùng chung.
    if (itemTitle && dueDateLine) {
      for (const className of [classA, classB]) {
        if (!className) continue;
        const stillThere = await rowExists(page, className, itemTitle, dueDateLine).catch(() => false);
        if (stillThere) {
          const row = await locateRowViaSearch(page, { className, title: itemTitle, dueDateLine }).catch(() => null);
          if (row) {
            await openRowEdit(page, row);
            const dialog = await openDeleteDialog(page);
            await confirmDeleteDialog(page, dialog);
          }
        }
      }
    }
    await context?.close();
  });

  test("AC-01 (setup): tạo 1 đề luyện tập mới giao cho 2 lớp", async () => {
    await gotoPracticeTestList(page);
    await openCreatePracticeTest(page);

    const classOptions = await readCreateFormClassOptions(page);
    expect(classOptions.length, `Cần ≥2 lớp thật để test AC-01, chỉ đọc được ${classOptions.length}.`).toBeGreaterThanOrEqual(2);
    [classA, classB] = classOptions;

    await selectClassOnCreateForm(page, classA);
    await selectClassOnCreateForm(page, classB);

    dueDateLine = await readDisplayedDueDate(page);

    // Chờ "Danh sách đề luyện tập" (phụ thuộc lớp vừa chọn) render xong rồi chọn đề ĐẦU TIÊN -
    // button role="checkbox" id dạng "lesson-item-{id}" (CÙNG cơ chế DOM id của "Bài tập").
    const firstItemCheckbox = page.locator('button[role="checkbox"][id^="lesson-item-"]').first();
    await expect(firstItemCheckbox).toBeVisible({ timeout: 15000 });
    const itemCard = firstItemCheckbox.locator("xpath=following-sibling::div[1]");
    itemTitle = (await itemCard.innerText()).split("\n")[0].trim();
    await firstItemCheckbox.click();
    await expect(firstItemCheckbox).toHaveAttribute("aria-checked", "true");

    await page.getByRole("button", { name: /Giao đề đã chọn/ }).click();
    await expect(page.getByText(/Đã giao .* đề luyện tập tới .* lớp/)).toBeVisible({ timeout: 15000 });
  });

  test("AC-01: giao 1 đề cho nhiều lớp → mỗi lớp là 1 dòng riêng, tính độc lập", async () => {
    const rowA = await locateRowViaSearch(page, { className: classA, title: itemTitle, dueDateLine });
    const doneA = (await rowA.locator("td").nth(3).innerText()).trim();
    const rowB = await locateRowViaSearch(page, { className: classB, title: itemTitle, dueDateLine });
    const doneB = (await rowB.locator("td").nth(3).innerText()).trim();
    expect(doneA, `Kỳ vọng "0/y" - thực tế lớp ${classA}="${doneA}".`).toMatch(/^0\//);
    expect(doneB, `Kỳ vọng "0/y" - thực tế lớp ${classB}="${doneB}".`).toMatch(/^0\//);
  });

  test("AC-02: thao tác Xóa hiển thị dialog xác nhận trước khi xóa", async () => {
    const rowA = await locateRowViaSearch(page, { className: classA, title: itemTitle, dueDateLine });
    await openRowEdit(page, rowA);
    const dialog = await openDeleteDialog(page);
    await expect(dialog).toContainText(po.deleteConfirmDialog.title);
    await expect(dialog).toContainText("Bạn có chắc chắn muốn xóa đề luyện tập không?");
    await cancelDeleteDialog(page, dialog);
  });

  test('AC-04: hủy dialog xác nhận → dữ liệu không đổi', async () => {
    const stillThere = await rowExists(page, classA, itemTitle, dueDateLine);
    expect(stillThere, `Sau khi bấm "Hủy", dòng lớp "${classA}" đã BIẾN MẤT - kỳ vọng vẫn còn nguyên.`).toBe(true);
  });

  test("AC-03: xác nhận Xóa → toàn bộ dữ liệu về đề đó (dòng lớp đã thao tác) bị xóa", async () => {
    const rowA = await locateRowViaSearch(page, { className: classA, title: itemTitle, dueDateLine });
    await openRowEdit(page, rowA);
    const dialog = await openDeleteDialog(page);
    await confirmDeleteDialog(page, dialog);

    const stillThere = await rowExists(page, classA, itemTitle, dueDateLine);
    expect(stillThere, `Sau khi xác nhận "Xóa", dòng lớp "${classA}" VẪN CÒN trong danh sách.`).toBe(false);
  });

  test("AC-05: [CẦN XÁC NHẬN PHẠM VI] xóa 1 dòng khi đề đã giao cho nhiều lớp - không ảnh hưởng lớp kia", async () => {
    const rowBStillExists = await rowExists(page, classB, itemTitle, dueDateLine);
    expect(
      rowBStillExists,
      `KẾT LUẬN THẬT: xóa dòng lớp "${classA}" đã xóa LUÔN dòng lớp "${classB}" (xóa cả đề khỏi mọi lớp).`,
    ).toBe(true);
    // rowBStillExists === true xác nhận: xóa CHỈ áp dụng cho RIÊNG lớp đã thao tác (classA),
    // KHÔNG ảnh hưởng lớp classB - trả lời câu hỏi "CẦN XÁC NHẬN PHẠM VI" trong sheet Ghi chú & Giả định.
  });
});
