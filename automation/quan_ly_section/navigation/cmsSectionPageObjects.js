/**
 * Page Objects + helper thao tác cho CMS Quản lý ôn thi / Quản lý Section (web admin:
 * `/exam-prep/sections`). Cùng stack UI với `quan_ly_goi_dich_vu` (Nuxt + Naive UI, class prefix
 * "n-") nên tái sử dụng `cmsAdminPageObjects.login` cho form đăng nhập thay vì khai báo lại.
 *
 * TOÀN BỘ selector dưới đây ĐÃ XÁC NHẬN THẬT qua Playwright thật (headless chromium) trên môi
 * trường dev (`https://parotedu-cms.codeinet.com`, 2026-11-03) - không đoán từ ảnh chụp màn hình:
 *   - Bảng danh sách dùng `<tr>` thật (data table), KHÔNG giống `/packages` (div-based) - định vị
 *     dòng bằng `table tbody tr` + `hasText`.
 *   - Nút Sửa/Xóa trên mỗi dòng CÓ accessible name thật ("Sửa"/"Xóa") - không cần định vị qua class
 *     icon như `/packages`.
 *   - Dialog Thêm mới/Chỉnh sửa CÓ `role="dialog"` thật (khác `/packages` dùng `.n-card` thường).
 *   - Trường "Thời lượng" là Naive UI `n-input-number` (không phải input tự do): gõ ký tự không
 *     phải số KHÔNG bị chặn tại thời điểm gõ, nhưng tự chuẩn hoá khi blur - ĐÃ XÁC NHẬN THẬT: chữ
 *     cái/ký tự không hợp lệ -> đảo về giá trị HỢP LỆ GẦN NHẤT (rỗng nếu field đang rỗng - ADD-06;
 *     giữ nguyên giá trị cũ nếu field đang có giá trị - EDIT-14), số âm/0 -> ép về `1`, số thập
 *     phân -> làm tròn (vd `12.5` -> `13`).
 *   - Validate: tên trống (kể cả chuỗi toàn khoảng trắng) -> "Vui lòng nhập tên phần thi"; tên
 *     trùng (kể cả khi Sửa, so với section khác) -> "Tên phần thi đã tồn tại"; bỏ trống Kỹ năng ->
 *     "Vui lòng chọn kỹ năng". Validate chạy khi bấm Lưu (không chặn khi đang gõ).
 *   - Icon đóng popup góc trên bên phải CÓ accessible name "close" (`page.getByRole("button", {
 *     name: "close" })`), hành vi giống hệt nút "Hủy".
 *   - Phân trang: Naive UI `n-pagination`, nút lùi/tiến là `.n-pagination-item--button` (KHÔNG có
 *     text/aria-label, phân biệt lùi/tiến bằng thứ tự DOM: đầu tiên = lùi, cuối = tiến), disabled
 *     qua class `n-pagination-item--disabled`. Số trang là `.n-pagination-item--clickable`.
 */
import { cmsAdminPageObjects } from "../../quan_ly_goi_dich_vu/navigation/cmsAdminPageObjects.js";

export const cmsSectionPageObjects = {
  login: cmsAdminPageObjects.login,

  path: "/exam-prep/sections",
  heading: "Quản lý Section",
  addButtonText: "Thêm mới",
  tableRowSelector: "table tbody tr",
  searchInputPlaceholder: "Tìm theo tên section...",
  skillFilterPlaceholder: "Tất cả kỹ năng",
  skillOptions: ["Nghe", "Nói", "Đọc", "Viết"],
  emptyDurationText: "—",

  addDialogTitle: "Thêm mới section",
  editDialogTitle: "Chỉnh sửa section",
  nameInput: 'input[placeholder="Nhập tên Section"]',
  nameRequiredError: "Vui lòng nhập tên phần thi",
  nameDuplicateError: "Tên phần thi đã tồn tại",
  skillPlaceholder: "Chọn kỹ năng",
  skillRequiredError: "Vui lòng chọn kỹ năng",
  durationInput: 'input[placeholder="Nhập số phút"]',
  saveButton: "Lưu",
  cancelButton: "Hủy",
  closeIconButton: "close",

  deleteDialogTitle: "Xóa section",
  deleteConfirmButton: "Xóa",
  deleteConfirmText: (name) =>
    `Bạn có chắc chắn muốn xóa section "${name}"? Hành động này không thể hoàn tác.`,
};

const po = cmsSectionPageObjects;

export async function gotoSections(page, baseUrl) {
  await page.goto(`${baseUrl}${po.path}`, { waitUntil: "networkidle" });
}

export async function openAddSectionPopup(page) {
  await page.getByRole("button", { name: po.addButtonText }).click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 10000 });
}

/** Định vị dòng bảng theo tên section (substring match - đặt tên đủ riêng biệt, vd gắn runId, để
 * tránh khớp nhầm giữa các dòng dữ liệu có sẵn trên môi trường dev). */
export function sectionRow(page, name) {
  return page.locator(po.tableRowSelector).filter({ hasText: name });
}

export async function openEditSectionPopup(page, name) {
  await sectionRow(page, name).getByRole("button", { name: "Sửa" }).click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 10000 });
}

/** Mở popup xác nhận xóa cho 1 dòng (chưa bấm xác nhận) - dùng để test Hủy (DEL-05) hoặc đọc nội
 * dung cảnh báo trước khi quyết định xóa thật. */
export async function openDeleteConfirm(page, name) {
  await sectionRow(page, name).getByRole("button", { name: "Xóa" }).click();
  // `exact: true` - BẮT BUỘC: mặc định `getByText()` so khớp substring KHÔNG phân biệt hoa/thường,
  // khớp nhầm luôn cả nội dung cảnh báo "...muốn xóa section..." (ĐÃ GẶP THẬT, strict mode
  // violation 2 phần tử) nếu không exact.
  await page.getByText(po.deleteDialogTitle, { exact: true }).waitFor({ state: "visible", timeout: 10000 });
}

export async function confirmDelete(page) {
  // PHẢI scope trong `role="dialog"` - popup xác nhận xóa CŨNG `role="dialog"` giống popup Thêm
  // mới/Sửa, nhưng nút "Xóa" KHÔNG scope sẽ khớp page-wide luôn cả icon "Xóa" của MỌI dòng trong
  // bảng (ĐÃ GẶP THẬT, strict mode violation 7 phần tử).
  const dialog = page.getByRole("dialog");
  const confirmBtn = dialog.getByRole("button", { name: po.deleteConfirmButton, exact: true });
  await confirmBtn.click();
  // ĐÃ GẶP THẬT (cùng lý do với `deletePackageByName()`): overlay đóng popup còn chặn pointer
  // events 1 nhịp SAU KHI nút đã detach - xóa liên tiếp nhiều dòng ngay sau nhau dễ bấm hụt dòng
  // tiếp theo nếu không đợi `role="dialog"` biến mất hẳn khỏi DOM (KHÔNG dùng `.n-modal-container`
  // - container đó được giữ mount thường trực, chỉ đổi nội dung, không bao giờ "detached" thật).
  await dialog.waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(400);
}

export async function cancelDeleteConfirm(page) {
  await page.getByRole("dialog").getByRole("button", { name: po.cancelButton }).click();
}

/** Xóa 1 section theo tên - dùng để dọn dẹp dữ liệu automation tự tạo (tiền tố `AUTO-`) sau khi
 * chạy test, giống `deletePackageByName()` của `quan_ly_goi_dich_vu`. */
export async function deleteSectionByName(page, name) {
  const row = sectionRow(page, name);
  if ((await row.count()) === 0) return;
  await openDeleteConfirm(page, name);
  await confirmDelete(page);
}

const skillSelectLocator = (page) => page.getByRole("dialog").locator(".n-base-selection");

export async function selectSkillInForm(page, skillText) {
  await skillSelectLocator(page).click();
  const option = page.locator('.n-base-select-option:visible, [role="option"]:visible', { hasText: skillText }).first();
  await option.waitFor({ state: "visible", timeout: 10000 });
  await option.click();
}

export async function readSelectedSkillInForm(page) {
  return skillSelectLocator(page).innerText();
}

/** Điền form popup Thêm mới/Chỉnh sửa section. Chỉ set field nào được truyền - field khác giữ
 * nguyên giá trị hiện có (KHÔNG tự ý đổi nếu không được yêu cầu), cùng quy ước với
 * `fillPackageForm()`. `duration: null` nghĩa là xoá trắng field (EDIT-09). */
export async function fillSectionForm(page, { name, skill, duration } = {}) {
  if (name !== undefined) {
    await page.locator(po.nameInput).fill(name);
  }
  if (skill !== undefined) {
    await selectSkillInForm(page, skill);
  }
  if (duration !== undefined) {
    const durationInput = page.locator(po.durationInput);
    if (duration === null) {
      await durationInput.fill("");
    } else {
      // Gõ phím thật qua `.click()` + chọn hết (Control+A) + `.type()` - KHÔNG `.fill("")` trước
      // (ĐÃ GẶP THẬT 2026-11-03: `.fill("")` set giá trị qua đường khác với gõ phím thật, khiến
      // n-input-number mất đồng bộ nội bộ, bước gõ tiếp theo bị bỏ qua). Chọn hết text cũ trước khi
      // gõ để thay thế HOÀN TOÀN (không bị nối vào cuối giá trị cũ, vd "20" + gõ "30" phải thành
      // "30" chứ không phải "2030"). Nếu chuỗi gõ vào không parse được thành số nguyên hợp lệ,
      // n-input-number tự ĐẢO VỀ giá trị hợp lệ gần nhất khi blur (rỗng nếu field đang rỗng như
      // ADD-06; giá trị CŨ nếu field đang có giá trị như EDIT-14 - "Thời lượng gốc giữ nguyên").
      await durationInput.click();
      await durationInput.press("Control+A");
      await durationInput.type(String(duration), { delay: 20 });
    }
    // Blur để trigger chuẩn hoá giá trị (clamp/round) của n-input-number trước khi Lưu.
    await page.locator(po.nameInput).click();
  }
}

export async function saveSectionPopup(page) {
  await page.getByRole("button", { name: po.saveButton }).click();
  await page.waitForTimeout(600);
}

export async function cancelSectionPopup(page) {
  await page.getByRole("button", { name: po.cancelButton }).click();
  await page.getByRole("dialog").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
}

export async function closeSectionPopupByIcon(page) {
  await page.getByRole("button", { name: po.closeIconButton }).click();
  await page.getByRole("dialog").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
}

export async function readDialogText(page) {
  return page.getByRole("dialog").innerText();
}

export async function readRowSkill(page, name) {
  return sectionRow(page, name).locator("td").nth(2).innerText();
}

export async function readRowDuration(page, name) {
  return sectionRow(page, name).locator("td").nth(3).innerText();
}

/** Đọc toàn bộ tên section đang hiển thị trên bảng, ĐÚNG THỨ TỰ DOM - dùng để assert thứ tự mới
 * nhất lên đầu (LIST-02) hoặc vị trí không đổi sau khi Sửa (EDIT-10). Cột tên là td thứ 2
 * (nth(1)) - td đầu là STT. */
export async function readAllSectionNamesInOrder(page) {
  const rows = page.locator(po.tableRowSelector);
  const count = await rows.count();
  const names = [];
  for (let i = 0; i < count; i += 1) {
    names.push((await rows.nth(i).locator("td").nth(1).innerText()).trim());
  }
  return names;
}

/** Đợi bảng ổn định sau 1 thao tác tìm kiếm/lọc (debounce input + round-trip API) - ĐÃ GẶP THẬT
 * (2026-11-03): gọi `waitForLoadState("networkidle")` NGAY sau khi gõ tìm kiếm là SAI - ô tìm kiếm
 * có debounce (~300-500ms) trước khi thật sự gọi API, nên ngay thời điểm gọi `waitForLoadState`
 * trình duyệt ĐANG thật sự "idle" (chưa có request nào bắt đầu) -> hàm trả về NGAY LẬP TỨC, sai
 * mục đích chờ ("đợi request MỚI xong" chứ không phải "xác nhận hiện không có request"), khiến
 * code đọc bảng SAI THỜI ĐIỂM (trước khi filter mới kịp áp dụng, bảng vẫn hiện danh sách cũ). Phải
 * đợi qua hết khoảng debounce TRƯỚC rồi mới gọi `networkidle` để bắt đúng lúc request thật sự chạy
 * xong. */
async function waitForTableStable(page) {
  await page.waitForTimeout(500); // qua hết debounce, đảm bảo request lọc mới đã BẮT ĐẦU
  await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300); // buffer cho UI render lại sau khi response về
}

export async function searchSections(page, text) {
  await page.locator(`input[placeholder="${po.searchInputPlaceholder}"]`).fill(text);
  await waitForTableStable(page);
}

export async function clearSearch(page) {
  await searchSections(page, "");
}

const skillFilterLocator = (page) => page.locator(".n-base-selection").first();

export async function filterBySkill(page, skillText) {
  await skillFilterLocator(page).click();
  const option = page.locator('.n-base-select-option:visible, [role="option"]:visible', { hasText: skillText }).first();
  await option.waitFor({ state: "visible", timeout: 10000 });
  await option.click();
  await waitForTableStable(page);
}

/** Bỏ lọc Kỹ năng, trả dropdown về placeholder "Tất cả kỹ năng" - ĐÃ XÁC NHẬN THẬT: placeholder
 * này KHÔNG phải 1 option chọn được trong danh sách (chỉ có 4 option Nghe/Nói/Đọc/Viết), phải bấm
 * icon "clear" (hiện ra khi hover vào ô chọn) để reset, giống hành vi 1 `n-select` có
 * `clearable` (khác hẳn select Kỹ năng BẮT BUỘC trong popup Thêm mới/Sửa - không cho clear). */
export async function resetSkillFilter(page) {
  const select = skillFilterLocator(page);
  await select.hover();
  await select.locator(".n-base-clear, [class*='clear']").first().click();
  await waitForTableStable(page);
}

export async function readSkillFilterOptionTexts(page) {
  await skillFilterLocator(page).click();
  await page.locator('.n-base-select-option:visible, [role="option"]:visible').first().waitFor({ state: "visible", timeout: 10000 });
  const texts = await page.locator('.n-base-select-option:visible, [role="option"]:visible').allInnerTexts();
  await page.keyboard.press("Escape");
  return texts;
}

/** Đọc số trong badge "X section" góc phải phía trên bảng. */
export async function readTotalCountBadge(page) {
  const text = await page.locator("text=/^\\d+ section$/").first().innerText();
  return Number(text.match(/^(\d+) section$/)[1]);
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

/** Tạo nhanh 1 section hợp lệ (dùng trong setup của nhiều case: PAGE-*, EDIT-*, DELETE-*). */
export async function createSection(page, { name, skill = "Nghe", duration } = {}) {
  await openAddSectionPopup(page);
  await fillSectionForm(page, { name, skill, duration });
  await saveSectionPopup(page);
}
