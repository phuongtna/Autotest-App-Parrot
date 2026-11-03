/**
 * Page Objects + helper thao tác cho CMS Quản lý ôn thi / Cấu hình bảng điểm (web admin:
 * `/exam-prep/score-tables`). Cùng stack UI (Nuxt + Naive UI) và CÙNG CẤU TRÚC MÀN HÌNH với
 * `quan_ly_section` (danh sách + tìm kiếm + lọc droplist + popup CRUD) nên tái sử dụng
 * `cmsAdminPageObjects.login` thay vì khai báo lại, và mirror gần như nguyên vẹn các helper của
 * `cmsSectionPageObjects.js`.
 *
 * TOÀN BỘ selector dưới đây ĐÃ XÁC NHẬN THẬT qua DOM thật trên môi trường dev
 * (`https://parotedu-cms.codeinet.com`, 2026-11-03) - không đoán từ ảnh chụp màn hình:
 *   - Bảng danh sách dùng `<tr>` thật (`table tbody tr`), giống hệt `/exam-prep/sections`.
 *   - Nút Sửa/Xóa trên mỗi dòng là icon-only (không có text hiển thị) nhưng CÓ accessible name
 *     thật qua thuộc tính `title="Sửa"`/`title="Xóa"` (Playwright tính accessible name từ `title`
 *     khi không có text/aria-label) - `page.getByRole("button", { name: "Sửa" })` vẫn hoạt động
 *     bình thường, không cần định vị qua class icon.
 *   - Dialog Thêm mới/Chỉnh sửa CÓ `role="dialog"` thật, tiêu đề lần lượt "Thêm mới bảng điểm" /
 *     "Chỉnh sửa bảng điểm".
 *   - KHÔNG CÓ field "Thời lượng" như Section - popup chỉ có 3 field: Tên bảng điểm (bắt buộc),
 *     Mô tả (không bắt buộc), Dạng quy đổi (bắt buộc, nhưng LUÔN có sẵn giá trị mặc định "Phổ
 *     thông" ngay khi mở popup Thêm mới - XÁC NHẬN giả định nêu trong TESTCASES.md/xlsx: field
 *     KHÔNG bao giờ ở trạng thái trống, nên ADD-03/ADD-04 (validate thiếu Dạng quy đổi) KHÔNG áp
 *     dụng được - hiện tại hệ thống chỉ có đúng 1 giá trị "Phổ thông" nên không cách nào tạo được
 *     trạng thái "chưa chọn").
 *   - Validate: tên trống -> "Vui lòng nhập tên bảng điểm" (khác text Section "...tên phần thi").
 *   - Chọn Dạng quy đổi = "Phổ thông" hiển thị alert 2 dòng: "Không cần cấu hình quy đổi." +
 *     "Điểm đề = tổng điểm các câu hỏi được gắn với đề (điểm thô)." (ADD-06).
 *   - Icon đóng popup góc trên bên phải CÓ accessible name "close", hành vi giống nút "Hủy".
 *   - Popup xác nhận xóa: tiêu đề "Xóa bảng điểm", nội dung
 *     `Bạn có chắc chắn muốn xóa bảng điểm "<tên>"? Hành động này không thể hoàn tác.`
 *   - Dropdown lọc "Tất cả dạng quy đổi" là `.n-base-selection` ĐẦU TIÊN trên trang (index 0),
 *     dropdown "Hiển thị X / trang" là phần tử thứ 2 - cùng thứ tự với Section.
 *   - Phân trang: Naive UI `n-pagination`, cùng cấu trúc `.n-pagination-item--button/--disabled/
 *     --clickable/--active` như Section.
 */
import { cmsAdminPageObjects } from "../../quan_ly_goi_dich_vu/navigation/cmsAdminPageObjects.js";

export const cmsScoreTablePageObjects = {
  login: cmsAdminPageObjects.login,

  path: "/exam-prep/score-tables",
  heading: "Cấu hình bảng điểm",
  addButtonText: "Thêm mới",
  tableRowSelector: "table tbody tr",
  searchInputPlaceholder: "Tìm theo tên bảng điểm...",
  conversionFilterPlaceholder: "Tất cả dạng quy đổi",
  conversionOptions: ["Phổ thông"],
  emptyDescriptionText: "—",

  addDialogTitle: "Thêm mới bảng điểm",
  editDialogTitle: "Chỉnh sửa bảng điểm",
  nameInput: 'input[placeholder="Nhập tên bảng điểm"]',
  nameRequiredError: "Vui lòng nhập tên bảng điểm",
  // ĐÃ XÁC NHẬN THẬT qua Playwright thật (2026-11-03, script dò real behavior trước khi viết
  // test) - trùng tên (kể cả khi tạo lần 2 y hệt lần 1) bị CHẶN với lỗi này; tên toàn khoảng
  // trắng bị coi là rỗng -> dùng chung `nameRequiredError` ở trên, KHÔNG có lỗi riêng.
  nameDuplicateError: "Tên bảng điểm đã tồn tại",
  descriptionInput: 'input[placeholder="Nhập mô tả cho bảng điểm"]',
  conversionDefaultValue: "Phổ thông",
  conversionAlertLine1: "Không cần cấu hình quy đổi.",
  conversionAlertLine2: "Điểm đề = tổng điểm các câu hỏi được gắn với đề (điểm thô).",
  saveButton: "Lưu",
  cancelButton: "Hủy",
  closeIconButton: "close",

  deleteDialogTitle: "Xóa bảng điểm",
  deleteConfirmButton: "Xóa",
  deleteConfirmText: (name) =>
    `Bạn có chắc chắn muốn xóa bảng điểm "${name}"? Hành động này không thể hoàn tác.`,
};

const po = cmsScoreTablePageObjects;

export async function gotoScoreTables(page, baseUrl) {
  await page.goto(`${baseUrl}${po.path}`, { waitUntil: "networkidle" });
}

export async function openAddScoreTablePopup(page) {
  await page.getByRole("button", { name: po.addButtonText }).click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 10000 });
}

/** Định vị dòng bảng theo tên bảng điểm (substring match - đặt tên đủ riêng biệt, vd gắn runId, để
 * tránh khớp nhầm giữa các dòng dữ liệu có sẵn trên dev, vd "Thang điểm 1".."Thang điểm 9"). */
export function scoreTableRow(page, name) {
  return page.locator(po.tableRowSelector).filter({ hasText: name });
}

export async function openEditScoreTablePopup(page, name) {
  await scoreTableRow(page, name).getByRole("button", { name: "Sửa" }).click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 10000 });
}

/** Mở popup xác nhận xóa cho 1 dòng (chưa bấm xác nhận) - dùng để test Hủy (DEL-04) hoặc đọc nội
 * dung cảnh báo trước khi quyết định xóa thật. */
export async function openDeleteConfirm(page, name) {
  await scoreTableRow(page, name).getByRole("button", { name: "Xóa" }).click();
  // `exact: true` - BẮT BUỘC: mặc định `getByText()` so khớp substring, khớp nhầm nội dung cảnh
  // báo "...muốn xóa bảng điểm..." nếu không exact (cùng lỗi ĐÃ GẶP THẬT ở Section).
  await page.getByText(po.deleteDialogTitle, { exact: true }).waitFor({ state: "visible", timeout: 10000 });
}

export async function confirmDelete(page) {
  // PHẢI scope trong `role="dialog"` - nút "Xóa" KHÔNG scope sẽ khớp page-wide luôn cả icon "Xóa"
  // của MỌI dòng trong bảng (cùng lỗi ĐÃ GẶP THẬT ở Section/quan_ly_goi_dich_vu).
  const dialog = page.getByRole("dialog");
  const confirmBtn = dialog.getByRole("button", { name: po.deleteConfirmButton, exact: true });
  await confirmBtn.click();
  // Đợi dialog "detached" hẳn trước khi thao tác tiếp - overlay còn chặn pointer events 1 nhịp sau
  // khi nút đã detach (cùng lý do với `confirmDelete()` của Section).
  await dialog.waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(400);
}

export async function cancelDeleteConfirm(page) {
  await page.getByRole("dialog").getByRole("button", { name: po.cancelButton }).click();
}

/** Xóa 1 bảng điểm theo tên - dùng để dọn dẹp dữ liệu automation tự tạo (tiền tố `AUTO-`) sau khi
 * chạy test. */
export async function deleteScoreTableByName(page, name) {
  const row = scoreTableRow(page, name);
  if ((await row.count()) === 0) return;
  await openDeleteConfirm(page, name);
  await confirmDelete(page);
}

const conversionSelectInFormLocator = (page) => page.getByRole("dialog").locator(".n-base-selection");

export async function readSelectedConversionInForm(page) {
  return conversionSelectInFormLocator(page).innerText();
}

/** Điền form popup Thêm mới/Chỉnh sửa bảng điểm. Chỉ set field nào được truyền - field khác giữ
 * nguyên giá trị hiện có. KHÔNG có field Dạng quy đổi để chọn vì hiện tại chỉ có đúng 1 giá trị
 * ("Phổ thông"), luôn tự động điền sẵn - không cần (và không thể) chọn khác. */
export async function fillScoreTableForm(page, { name, description } = {}) {
  if (name !== undefined) {
    await page.locator(po.nameInput).fill(name);
  }
  if (description !== undefined) {
    await page.locator(po.descriptionInput).fill(description);
  }
}

export async function saveScoreTablePopup(page) {
  await page.getByRole("button", { name: po.saveButton }).click();
  await page.waitForTimeout(600);
}

export async function cancelScoreTablePopup(page) {
  await page.getByRole("button", { name: po.cancelButton }).click();
  await page.getByRole("dialog").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
}

export async function closeScoreTablePopupByIcon(page) {
  await page.getByRole("button", { name: po.closeIconButton }).click();
  await page.getByRole("dialog").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
}

export async function readDialogText(page) {
  return page.getByRole("dialog").innerText();
}

export async function readRowConversion(page, name) {
  return scoreTableRow(page, name).locator("td").nth(2).innerText();
}

export async function readRowDescription(page, name) {
  return scoreTableRow(page, name).locator("td").nth(3).innerText();
}

/** Đọc toàn bộ tên bảng điểm đang hiển thị trên bảng, ĐÚNG THỨ TỰ DOM - dùng để assert thứ tự mới
 * nhất lên đầu (LIST-02) hoặc vị trí không đổi sau khi Sửa (EDIT-08). Cột tên là td thứ 2
 * (nth(1)) - td đầu là STT. */
export async function readAllScoreTableNamesInOrder(page) {
  const rows = page.locator(po.tableRowSelector);
  const count = await rows.count();
  const names = [];
  for (let i = 0; i < count; i += 1) {
    names.push((await rows.nth(i).locator("td").nth(1).innerText()).trim());
  }
  return names;
}

/** Đợi bảng ổn định sau 1 thao tác tìm kiếm/lọc (debounce input + round-trip API) - cùng lý do
 * ĐÃ GẶP THẬT ở Section: gọi `waitForLoadState("networkidle")` NGAY sau khi gõ là SAI vì ô tìm
 * kiếm có debounce trước khi thật sự gọi API. */
async function waitForTableStable(page) {
  await page.waitForTimeout(500);
  await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
}

export async function searchScoreTables(page, text) {
  await page.locator(`input[placeholder="${po.searchInputPlaceholder}"]`).fill(text);
  await waitForTableStable(page);
}

export async function clearSearch(page) {
  await searchScoreTables(page, "");
}

const conversionFilterLocator = (page) => page.locator(".n-base-selection").first();

export async function filterByConversion(page, conversionText) {
  await conversionFilterLocator(page).click();
  const option = page.locator('.n-base-select-option:visible, [role="option"]:visible', { hasText: conversionText }).first();
  await option.waitFor({ state: "visible", timeout: 10000 });
  await option.click();
  await waitForTableStable(page);
}

/** Bỏ lọc Dạng quy đổi, trả dropdown về placeholder "Tất cả dạng quy đổi" - cùng cơ chế với
 * `resetSkillFilter()` của Section: placeholder KHÔNG phải 1 option chọn được, phải bấm icon
 * "clear" (hiện khi hover) để reset. */
export async function resetConversionFilter(page) {
  const select = conversionFilterLocator(page);
  await select.hover();
  await select.locator(".n-base-clear, [class*='clear']").first().click();
  await waitForTableStable(page);
}

export async function readConversionFilterOptionTexts(page) {
  await conversionFilterLocator(page).click();
  await page.locator('.n-base-select-option:visible, [role="option"]:visible').first().waitFor({ state: "visible", timeout: 10000 });
  const texts = await page.locator('.n-base-select-option:visible, [role="option"]:visible').allInnerTexts();
  await page.keyboard.press("Escape");
  return texts;
}

/** Đọc số trong badge "X bảng điểm" góc phải phía trên bảng. */
export async function readTotalCountBadge(page) {
  const text = await page.locator("text=/^\\d+ bảng điểm$/").first().innerText();
  return Number(text.match(/^(\d+) bảng điểm$/)[1]);
}

/** Đọc số trong "Tổng X bản ghi" ở khu vực phân trang cuối bảng. */
export async function readTotalRecordsText(page) {
  const text = await page.locator("text=/^Tổng \\d+ bản ghi$/").first().innerText();
  return Number(text.match(/^Tổng (\d+) bản ghi$/)[1]);
}

const paginationButtons = (page) => page.locator(".n-pagination-item--button");

export async function clickPrevPage(page) {
  await paginationButtons(page).first().click();
  await page.waitForTimeout(500);
}

export async function clickNextPage(page) {
  await paginationButtons(page).last().click();
  await page.waitForTimeout(500);
}

export async function isPrevPageDisabled(page) {
  const cls = await paginationButtons(page).first().getAttribute("class");
  return cls.includes("n-pagination-item--disabled");
}

export async function isNextPageDisabled(page) {
  const cls = await paginationButtons(page).last().getAttribute("class");
  return cls.includes("n-pagination-item--disabled");
}

export async function gotoPageNumber(page, pageNumber) {
  await page
    .locator(".n-pagination-item--clickable", { hasText: String(pageNumber) })
    .first()
    .click();
  await page.waitForTimeout(500);
}

export async function readActivePageNumber(page) {
  const text = await page.locator(".n-pagination-item--active").innerText();
  return Number(text.trim());
}

export async function readPageNumbersAvailable(page) {
  const texts = await page.locator(".n-pagination-item--clickable").allInnerTexts();
  return texts.map((t) => Number(t.trim()));
}

const pageSizeSelectLocator = (page) => page.locator(".n-base-selection", { hasText: "trang" });

export async function setPageSize(page, size) {
  await pageSizeSelectLocator(page).click();
  await page.waitForTimeout(300);
  await page.locator('.n-base-select-option:visible, [role="option"]:visible', { hasText: `${size} / trang` }).click();
  await page.waitForTimeout(600);
}

export async function readCurrentPageSizeText(page) {
  return pageSizeSelectLocator(page).innerText();
}

/** Tạo nhanh 1 bảng điểm hợp lệ (dùng trong setup của nhiều case: PAGE-*, EDIT-*, DELETE-*). */
export async function createScoreTable(page, { name, description } = {}) {
  await openAddScoreTablePopup(page);
  await fillScoreTableForm(page, { name, description });
  await saveScoreTablePopup(page);
}
