/**
 * Page Objects + helper thao tác cho CMS Quản lý ôn thi / Quản lý kỳ thi (web admin:
 * `/exam-prep/exam-types`). Cùng stack UI (Nuxt + Naive UI) và CÙNG CẤU TRÚC MÀN HÌNH với
 * `quan_ly_section`/`cau_hinh_bang_diem` (danh sách + tìm kiếm + popup CRUD) nên tái sử dụng
 * `cmsAdminPageObjects.login` và mirror phần lớn helper của 2 module đó.
 *
 * TOÀN BỘ selector dưới đây ĐÃ XÁC NHẬN THẬT qua DOM thật trên môi trường dev
 * (`https://parotedu-cms.codeinet.com`, 2026-11-03) - không đoán từ ảnh chụp màn hình:
 *   - Bảng danh sách dùng `<tr>` thật (`table tbody tr`), giống hệt Section/Bảng điểm.
 *   - KHÁC Section/Bảng điểm: màn này KHÔNG có droplist lọc nào (chỉ có 1 ô tìm kiếm) - xác nhận
 *     đúng giả định nêu trong TESTCASES.md (LIST-07).
 *   - Dialog Thêm mới/Chỉnh sửa CÓ `role="dialog"` thật, tiêu đề "Thêm mới kỳ thi".
 *   - "Dạng quy đổi" LUÔN pre-fill sẵn "Phổ thông" ngay khi mở popup Thêm mới (hover vào select
 *     KHÔNG hiện icon "clear") - CÙNG hành vi với Bảng điểm: field không bao giờ ở trạng thái
 *     trống, ADD-03 (validate thiếu Dạng quy đổi) KHÔNG áp dụng được.
 *   - "Cấu hình đề xuất" là 1 `n-select` RIÊNG (không phải multi-select) + nút "Thêm" tường minh -
 *     chọn 1 section trong select KHÔNG tự gắn, phải bấm "Thêm" mới thêm vào "Section đã gắn"
 *     (ĐÃ XÁC NHẬN THẬT: chọn "Writing (Viết)" trong select nhưng không bấm Thêm thì danh sách
 *     "Section đã gắn" không đổi).
 *   - Mỗi dòng trong "Section đã gắn" là 1 `listitem` thật (`role="list"`/`role="listitem"`) gồm:
 *     tên section, kỹ năng (text riêng, vd "Nghe"), và 3 nút CÓ accessible name thật: "Lên trên",
 *     "Xuống dưới", "Bỏ gắn" (KHÔNG phải icon-only không tên như đã lo ngại trước khi dò DOM thật).
 *   - Section vừa gắn biến mất khỏi select "Cấu hình đề xuất" (không chọn lại được lần 2) và xuất
 *     hiện TRỞ LẠI khi bấm "Bỏ gắn" - ĐÃ XÁC NHẬN THẬT qua 1 vòng thêm/gỡ thật trên dev.
 *   - Bấm "Xuống dưới" ở dòng đang đứng đầu ĐÃ XÁC NHẬN THẬT hoán đổi đúng vị trí với dòng kế tiếp.
 *   - Dòng "Tổng: N section" CHỈ xuất hiện khi N >= 1 - lúc popup chưa gắn section nào chỉ hiện
 *     text "Chưa gắn section nào", không có dòng "Tổng:" nào cả (ĐÃ XÁC NHẬN THẬT).
 *   - Validate: tên trống -> "Vui lòng nhập tên kỳ thi" (khác text Section/Bảng điểm).
 *   - Nút Sửa/Xóa trên mỗi dòng CÓ accessible name thật ("Sửa"/"Xóa").
 *   - Phân trang: Naive UI `n-pagination`, cùng cấu trúc `.n-pagination-item--button/--disabled/
 *     --clickable/--active` như Section/Bảng điểm.
 *
 * `deleteDialogTitle`/`deleteConfirmText()`/`editDialogTitle`/`nameDuplicateError` ĐÃ XÁC NHẬN
 * THẬT qua lần chạy đầy đủ `npm run test-quan-ly-ky-thi-pw` trên dev (2026-11-03, 47 case Pass) -
 * ban đầu suy luận theo đúng quy ước đặt tên nhất quán của 2 màn sibling (Section: "Xóa section" /
 * Bảng điểm: "Xóa bảng điểm" -> Kỳ thi: "Xóa kỳ thi"; "Tên bảng điểm đã tồn tại" -> "Tên kỳ thi đã
 * tồn tại"), suy luận này ĐÚNG - Kỳ thi dùng đúng cùng rule chặn trùng tên như Section/Bảng điểm.
 */
import { cmsAdminPageObjects } from "../../quan_ly_goi_dich_vu/navigation/cmsAdminPageObjects.js";

export const cmsKyThiPageObjects = {
  login: cmsAdminPageObjects.login,

  path: "/exam-prep/exam-types",
  heading: "Quản lý kỳ thi",
  addButtonText: "Thêm mới",
  tableRowSelector: "table tbody tr",
  searchInputPlaceholder: "Tìm theo tên kỳ thi...",
  emptyDescriptionText: "—",

  addDialogTitle: "Thêm mới kỳ thi",
  editDialogTitle: "Chỉnh sửa kỳ thi",
  nameInput: 'input[placeholder="Nhập tên kỳ thi"]',
  nameRequiredError: "Vui lòng nhập tên kỳ thi",
  nameDuplicateError: "Tên kỳ thi đã tồn tại",
  // ĐÃ XÁC NHẬN THẬT (2026-11-03, ADD-23): Tên kỳ thi giới hạn tối đa 500 ký tự - vượt quá bị chặn
  // Lưu kèm lỗi này (Mô tả không thấy lỗi tương ứng trong cùng lần thử, dù cũng nhập rất dài).
  nameMaxLength: 500,
  nameMaxLengthError: "Tên kỳ thi tối đa 500 ký tự",
  descriptionInput: '[placeholder="Nhập mô tả ngắn về kỳ thi"]',
  conversionDefaultValue: "Phổ thông",
  saveButton: "Lưu",
  cancelButton: "Hủy",
  closeIconButton: "close",

  // "Cấu hình đề xuất" - select chọn Section để gắn + nút "Thêm" tường minh.
  attachSectionPlaceholder: "Chọn section để gắn",
  attachButtonText: "Thêm",
  emptyAttachedSectionsText: "Chưa gắn section nào",
  moveUpButton: "Lên trên",
  moveDownButton: "Xuống dưới",
  unassignButton: "Bỏ gắn",

  deleteDialogTitle: "Xóa kỳ thi",
  deleteConfirmButton: "Xóa",
  deleteConfirmText: (name) =>
    `Bạn có chắc chắn muốn xóa kỳ thi "${name}"? Hành động này không thể hoàn tác.`,
};

const po = cmsKyThiPageObjects;

export async function gotoKyThi(page, baseUrl) {
  await page.goto(`${baseUrl}${po.path}`, { waitUntil: "networkidle" });
}

/** Popup vừa mở gọi API riêng để nạp danh sách Section cho select "Cấu hình đề xuất" - ĐÃ GẶP
 * THẬT (2026-11-03): đọc option/kiểm tra class disabled của select này NGAY sau khi dialog vừa
 * hiện (trước khi API nạp Section kịp trả về) đôi khi trúng đúng lúc select còn rỗng/đang nạp, bị
 * hiểu NHẦM thành "đã hết Section" - gây flaky ngẫu nhiên giữa các lần chạy (thỉnh thoảng Pass,
 * thỉnh thoảng throw "Không còn Section nào"). Đợi qua `networkidle` sau khi dialog hiện để chắc
 * chắn API nạp Section đã về trước khi thao tác tiếp.
 */
async function waitForAttachSectionSelectReady(page) {
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
}

export async function openAddKyThiPopup(page) {
  await page.getByRole("button", { name: po.addButtonText }).click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 10000 });
  await waitForAttachSectionSelectReady(page);
}

/** Định vị dòng bảng theo tên kỳ thi (substring match - đặt tên đủ riêng biệt, vd gắn runId, để
 * tránh khớp nhầm giữa các dòng dữ liệu có sẵn trên dev, vd "Kỳ thi B".."Kỳ thi G"). */
export function kyThiRow(page, name) {
  return page.locator(po.tableRowSelector).filter({ hasText: name });
}

export async function openEditKyThiPopup(page, name) {
  await kyThiRow(page, name).getByRole("button", { name: "Sửa" }).click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 10000 });
  await waitForAttachSectionSelectReady(page);
}

/** Mở popup xác nhận xóa cho 1 dòng (chưa bấm xác nhận) - dùng để test Hủy (DEL-04) hoặc đọc nội
 * dung cảnh báo trước khi quyết định xóa thật. */
export async function openDeleteConfirm(page, name) {
  await kyThiRow(page, name).getByRole("button", { name: "Xóa" }).click();
  // `exact: true` - BẮT BUỘC, cùng lý do ĐÃ GẶP THẬT ở Section/Bảng điểm: mặc định `getByText()`
  // so khớp substring, khớp nhầm nội dung cảnh báo "...muốn xóa kỳ thi..." nếu không exact.
  await page.getByText(po.deleteDialogTitle, { exact: true }).waitFor({ state: "visible", timeout: 10000 });
}

export async function confirmDelete(page) {
  // PHẢI scope trong `role="dialog"` - nút "Xóa" KHÔNG scope sẽ khớp page-wide luôn cả icon "Xóa"
  // của MỌI dòng trong bảng (cùng lỗi ĐÃ GẶP THẬT ở Section/Bảng điểm).
  const dialog = page.getByRole("dialog");
  const confirmBtn = dialog.getByRole("button", { name: po.deleteConfirmButton, exact: true });
  await confirmBtn.click();
  // Đợi dialog "detached" hẳn trước khi thao tác tiếp - overlay còn chặn pointer events 1 nhịp sau
  // khi nút đã detach (cùng lý do với Section/Bảng điểm).
  await dialog.waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(400);
}

export async function cancelDeleteConfirm(page) {
  await page.getByRole("dialog").getByRole("button", { name: po.cancelButton }).click();
}

/** Xóa 1 kỳ thi theo tên - dùng để dọn dẹp dữ liệu automation tự tạo (tiền tố `AUTO-`) sau khi
 * chạy test. */
export async function deleteKyThiByName(page, name) {
  const row = kyThiRow(page, name);
  if ((await row.count()) === 0) return;
  await openDeleteConfirm(page, name);
  await confirmDelete(page);
}

const conversionSelectInFormLocator = (page) => page.getByRole("dialog").locator(".n-base-selection").nth(0);
const attachSectionSelectLocator = (page) => page.getByRole("dialog").locator(".n-base-selection").nth(1);

export async function readSelectedConversionInForm(page) {
  return conversionSelectInFormLocator(page).innerText();
}

/** Chọn 1 Section trong select "Cấu hình đề xuất" (CHƯA gắn vào "Section đã gắn" - phải gọi thêm
 * `clickAttachSectionButton()` để gắn thật, xem ADD-13). `optionText` theo đúng format hiển thị
 * trong dropdown: `"<Tên section> (<Kỹ năng>)"`, vd `"Listening (Nghe)"`. */
export async function selectSectionToAttach(page, optionText) {
  await attachSectionSelectLocator(page).click();
  const option = page.locator('.n-base-select-option:visible, [role="option"]:visible', { hasText: optionText }).first();
  await option.waitFor({ state: "visible", timeout: 10000 });
  await option.click();
}

export async function clickAttachSectionButton(page) {
  await page.getByRole("dialog").getByRole("button", { name: po.attachButtonText, exact: true }).click();
}

export async function isAttachSectionButtonDisabled(page) {
  return page.getByRole("dialog").getByRole("button", { name: po.attachButtonText, exact: true }).isDisabled();
}

/** Chọn 1 Section trong droplist RỒI bấm "Thêm" luôn - gộp 2 bước hay dùng chung. */
export async function attachSection(page, optionText) {
  await selectSectionToAttach(page, optionText);
  await clickAttachSectionButton(page);
}

/** Select "Cấu hình đề xuất" tự chuyển sang class `n-base-selection--disabled` khi KHÔNG còn
 * Section nào chưa gắn để chọn (ADD-15) - ĐÃ XÁC NHẬN THẬT (2026-11-03): cố `.click()` vào select
 * lúc đã disabled khiến Playwright chờ "element is not stable"/"detached from the DOM" lặp vô hạn
 * tới khi hết timeout, KHÔNG throw lỗi rõ ràng ngay - PHẢI kiểm tra class này trước khi click. */
export async function isAttachSectionSelectDisabled(page) {
  const cls = (await attachSectionSelectLocator(page).getAttribute("class")) || "";
  return cls.includes("n-base-selection--disabled");
}

/** Đọc danh sách text các option còn lại trong select "Cấu hình đề xuất" (đã trừ các section đã
 * gắn - ADD-11/14/15). Trả về mảng rỗng ngay (không click) nếu select đang disabled. */
export async function readAttachableSectionOptionTexts(page) {
  if (await isAttachSectionSelectDisabled(page)) return [];
  await attachSectionSelectLocator(page).click();
  const options = page.locator('.n-base-select-option:visible, [role="option"]:visible');
  await options.first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  const texts = await options.allInnerTexts();
  await page.keyboard.press("Escape");
  return texts;
}

/** Danh sách "Section đã gắn" trong popup Thêm mới/Sửa - mỗi dòng 1 `listitem` thật. */
function attachedSectionList(page) {
  return page.getByRole("dialog").getByRole("list");
}

export function attachedSectionRow(page, name) {
  return attachedSectionList(page).getByRole("listitem").filter({ hasText: name });
}

/** Đọc đúng thứ tự tên các Section đang gắn (dòng trên = thứ tự nhỏ hơn) - dùng để assert thứ tự
 * sau khi thêm/sắp xếp lại (ADD-07/08). */
export async function readAttachedSectionNamesInOrder(page) {
  const rows = attachedSectionList(page).getByRole("listitem");
  const count = await rows.count();
  const names = [];
  for (let i = 0; i < count; i += 1) {
    const fullText = await rows.nth(i).innerText();
    // ĐÃ XÁC NHẬN THẬT (2026-11-03): dòng ĐẦU TIÊN là số thứ tự hiển thị ("1", "2"...) - KHÔNG
    // phải tên section (khác giả định ban đầu) - lọc bỏ dòng số thứ tự thuần và nhãn 3 nút, tên
    // section luôn là dòng/segment còn lại ĐẦU TIÊN (đứng trước dòng kỹ năng).
    const buttonLabels = [po.moveUpButton, po.moveDownButton, po.unassignButton];
    const nameLine = fullText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .find((l) => !/^\d+$/.test(l) && !buttonLabels.includes(l));
    names.push(nameLine || "");
  }
  return names;
}

export async function moveAttachedSectionUp(page, name) {
  await attachedSectionRow(page, name).getByRole("button", { name: po.moveUpButton }).click();
}

export async function moveAttachedSectionDown(page, name) {
  await attachedSectionRow(page, name).getByRole("button", { name: po.moveDownButton }).click();
}

export async function unassignSection(page, name) {
  await attachedSectionRow(page, name).getByRole("button", { name: po.unassignButton }).click();
}

export async function isMoveUpDisabled(page, name) {
  return attachedSectionRow(page, name).getByRole("button", { name: po.moveUpButton }).isDisabled();
}

export async function isMoveDownDisabled(page, name) {
  return attachedSectionRow(page, name).getByRole("button", { name: po.moveDownButton }).isDisabled();
}

/** Đọc số trong dòng "Tổng: N section" - trả về `null` nếu dòng này không tồn tại (0 section đã
 * gắn, ADD-12). */
export async function readAttachedTotalCount(page) {
  const locator = page.getByRole("dialog").getByText(/Tổng:\s*\d+\s*section/);
  if ((await locator.count()) === 0) return null;
  const text = await locator.innerText();
  const match = text.match(/(\d+)\s*section/);
  return match ? Number(match[1]) : null;
}

/** Điền form popup Thêm mới/Chỉnh sửa kỳ thi. Chỉ set field nào được truyền - field khác giữ
 * nguyên giá trị hiện có. KHÔNG có field Dạng quy đổi để chọn vì hiện tại chỉ có đúng 1 giá trị
 * ("Phổ thông"), luôn tự động điền sẵn - không cần (và không thể) chọn khác. */
export async function fillKyThiForm(page, { name, description } = {}) {
  if (name !== undefined) {
    await page.locator(po.nameInput).fill(name);
  }
  if (description !== undefined) {
    await page.locator(po.descriptionInput).fill(description);
  }
}

export async function saveKyThiPopup(page) {
  await page.getByRole("button", { name: po.saveButton }).click();
  await page.waitForTimeout(600);
}

export async function cancelKyThiPopup(page) {
  await page.getByRole("button", { name: po.cancelButton }).click();
  await page.getByRole("dialog").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
}

export async function closeKyThiPopupByIcon(page) {
  await page.getByRole("button", { name: po.closeIconButton }).click();
  await page.getByRole("dialog").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
}

export async function readDialogText(page) {
  return page.getByRole("dialog").innerText();
}

export async function readRowDescription(page, name) {
  return kyThiRow(page, name).locator("td").nth(2).innerText();
}

/** Đọc toàn bộ tên kỳ thi đang hiển thị trên bảng, ĐÚNG THỨ TỰ DOM - dùng để assert thứ tự mới
 * nhất lên đầu (LIST-02) hoặc vị trí không đổi sau khi Sửa (EDIT-11). Cột tên là td thứ 2 (nth(1))
 * - td đầu là STT. */
export async function readAllKyThiNamesInOrder(page) {
  const rows = page.locator(po.tableRowSelector);
  const count = await rows.count();
  const names = [];
  for (let i = 0; i < count; i += 1) {
    names.push((await rows.nth(i).locator("td").nth(1).innerText()).trim());
  }
  return names;
}

/** Đợi bảng ổn định sau 1 thao tác tìm kiếm (debounce input + round-trip API) - cùng lý do ĐÃ GẶP
 * THẬT ở Section/Bảng điểm: gọi `waitForLoadState("networkidle")` NGAY sau khi gõ là SAI vì ô tìm
 * kiếm có debounce trước khi thật sự gọi API. */
async function waitForTableStable(page) {
  await page.waitForTimeout(500);
  await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
}

export async function searchKyThi(page, text) {
  await page.locator(`input[placeholder="${po.searchInputPlaceholder}"]`).fill(text);
  await waitForTableStable(page);
}

export async function clearSearch(page) {
  await searchKyThi(page, "");
}

/** Đọc số trong badge "X kỳ thi" góc phải phía trên bảng. */
export async function readTotalCountBadge(page) {
  const text = await page.locator("text=/^\\d+ kỳ thi$/").first().innerText();
  return Number(text.match(/^(\d+) kỳ thi$/)[1]);
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

/** Tạo nhanh 1 kỳ thi hợp lệ (dùng trong setup của nhiều case: PAGE-*, EDIT-*, DELETE-*). */
export async function createKyThi(page, { name, description } = {}) {
  await openAddKyThiPopup(page);
  await fillKyThiForm(page, { name, description });
  await saveKyThiPopup(page);
}
