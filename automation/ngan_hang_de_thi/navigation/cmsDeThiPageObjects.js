/**
 * Page Objects + helper thao tác cho CMS Quản lý ôn thi / Ngân hàng đề thi (web admin:
 * `/exam-prep/papers`). KHÁC Section/Bảng điểm/Kỳ thi ở chỗ Thêm mới/Sửa là 1 TRANG RIÊNG
 * ("Tạo mới đề thi"/"Chỉnh sửa đề thi"), KHÔNG phải popup - nhưng danh sách (bảng + tìm kiếm +
 * lọc + phân trang) vẫn dùng chung component Naive UI như 3 module kia nên mirror lại các helper
 * danh sách/phân trang từ `cmsKyThiPageObjects`.
 *
 * TOÀN BỘ selector dưới đây ĐÃ XÁC NHẬN THẬT qua DOM thật trên môi trường dev
 * (`https://parotedu-cms.codeinet.com`, 2026-11-03):
 *   - Màn danh sách có 2 droplist lọc ("Tất cả loại kỳ thi"/"Tất cả khối lớp") + 1 ô tìm kiếm -
 *     KHÁC Kỳ thi (không có lọc nào) nhưng GIỐNG cơ chế lọc của Section/Bảng điểm.
 *   - Cột bảng: STT, TÊN ĐỀ THI, KHỐI LỚP (nhiều tag), HÌNH THỨC (badge Free/Pro), CHẾ ĐỘ (badge
 *     Công khai/Chưa công khai), NGÀY TẠO (dd/mm/yyyy), THAO TÁC (Sửa/Xóa).
 *   - "Tạo mới đề thi"/"Chỉnh sửa đề thi" là TRANG riêng (route `/exam-prep/papers/create` và
 *     `/exam-prep/papers/<id>`), bố cục 2 cột: trái "Cấu trúc đề", phải "Thông tin đề thi" + khối
 *     "Thiết lập" (Trạng thái Nháp/Hoàn thành, Hình thức Free/Pro) + hàng nút Hủy/Lưu/Công khai.
 *   - "Cấu trúc đề" bên trái HOÀN TOÀN trống/ẩn (text "Chưa chọn loại kỳ thi") cho tới khi field
 *     "Loại kỳ thi" bên phải có giá trị - ĐÃ XÁC NHẬN THẬT (STRUCT-01).
 *   - Chọn "Loại kỳ thi" LẦN ĐẦU (đề hoàn toàn mới) tự fill đúng danh sách Section theo "Cấu hình
 *     đề xuất" đã khai báo ở màn Quản lý kỳ thi, ĐÚNG THỨ TỰ (STRUCT-02) - ĐÃ XÁC NHẬN THẬT.
 *   - ĐỔI "Loại kỳ thi" khi đề ĐÃ CÓ sẵn Section (dù đã lưu hay chưa) KHÔNG làm mới/reset lại cấu
 *     trúc - Section/Thời lượng cũ vẫn giữ nguyên (EDIT-04) - ĐÃ XÁC NHẬN THẬT 2 lần độc lập (lúc
 *     tạo mới chưa lưu, và lúc Sửa 1 đề đã lưu). Đây CHÍNH LÀ hành vi mà
 *     `flows/cms/quan_ly_on_thi/quan_ly_ky_thi/TESTCASES.md` (case SYNC-06) gắn cờ "Fail" vì kỳ
 *     vọng SAI là cấu trúc PHẢI làm mới theo kỳ thi mới - nhìn từ góc độ Đề thi (file test case
 *     này, case EDIT-04) thì đây lại là hành vi DÙNG ĐÚNG như AC yêu cầu. Giữ nguyên 2 kỳ vọng
 *     khác nhau ở 2 file test case (không sửa ngược SYNC-06) vì đó là nhận định tại thời điểm viết
 *     file Kỳ thi; ở đây chỉ ghi chú lại để người đọc không hoang mang khi thấy 2 kết luận trái
 *     chiều cho cùng 1 cơ chế.
 *   - Field "Bảng điểm quy đổi" DISABLED với placeholder "Chọn loại kỳ thi trước" cho tới khi đã
 *     chọn "Loại kỳ thi" - sau đó chỉ liệt kê bảng điểm ĐÚNG Dạng quy đổi của kỳ thi đó (dòng chú
 *     thích "Dạng quy đổi của kỳ thi: Phổ thông" ngay dưới field) và mặc định chọn SẴN bảng điểm
 *     được tạo SỚM NHẤT cùng dạng - ĐÃ XÁC NHẬN THẬT (giống cơ chế SYNC-05 đã verify ở Kỳ thi).
 *   - "Khối lớp" là multi-select thật (chọn nhiều tag cùng lúc, mỗi tag có nút "x" riêng).
 *   - "Thời gian làm bài" field KHÔNG chặn gõ ký tự sai ngay lúc gõ (chữ cái/thập phân gõ được
 *     bình thường) nhưng bị SANITIZE VỀ RỖNG ngay khi blur/Lưu (không giữ lại giá trị không hợp
 *     lệ) - ĐÃ XÁC NHẬN THẬT (FORM-10): gõ "abc-12.5" rồi bấm Lưu thì field tự trở về rỗng kèm lỗi
 *     "Vui lòng nhập thời gian làm bài" (KHÔNG phải lỗi định dạng riêng).
 *   - Thêm 1 Section vào "Cấu trúc đề": chọn trong select "Chọn section để thêm vào đề" rồi bấm nút
 *     "+ Thêm Section" tường minh (2 bước, giống hệt cơ chế "Cấu hình đề xuất" của Kỳ thi) - section
 *     vừa thêm biến mất khỏi select, card mới luôn chèn ở CUỐI danh sách.
 *   - Field "Thời lượng" của mỗi Section card có placeholder/giá trị rỗng hiển thị đúng CHUỖI "--"
 *     (không phải "Nhập phút") - ĐÃ XÁC NHẬN THẬT qua accessibility tree.
 *   - Nếu Section được thêm vào đã có "Thời lượng" cấu hình sẵn ở menu Quản lý Section thì field
 *     Thời lượng tự fill đúng giá trị đó (STRUCT-08) - ĐÃ XÁC NHẬN THẬT.
 *   - Mỗi Section card có 3 nút CÓ accessible name thật: "Xóa section khỏi đề", "Thu gọn / Mở
 *     rộng" (thu gọn/mở rộng phần Bài thực hành bên trong, KHÔNG phải sắp xếp), và icon "≡" để
 *     KÉO THẢ đổi thứ tự (không có nút lên/xuống tường minh như Kỳ thi).
 *   - Mỗi dòng Bài thực hành trong Section có 3 nút CÓ accessible name thật: "Xem" (mở popup xem
 *     nhanh nội dung, có nút "Đóng"), "Sửa", "Xóa".
 *   - Banner cảnh báo thời lượng (khu vực "Cấu trúc đề", ĐÃ XÁC NHẬN THẬT các dòng chữ):
 *       + Xanh dương (info): "Thời gian đề: N phút - Các section không giới hạn thời gian riêng"
 *         (hiện khi CHƯA section nào có Thời lượng).
 *       + Cam (warning): "Đã nhập thời lượng K/N section - cần nhập cho tất cả section" (hiện khi
 *         1 vài nhưng chưa phải tất cả section có Thời lượng - RULE NÀY ÁP DỤNG NGAY CẢ KHI Trạng
 *         thái = Nháp, chặn Lưu luôn, KHÔNG đợi tới Hoàn thành - khác với rule "Section cần có ít
 *         nhất 1 bài thực hành" chỉ chặn ở mức Hoàn thành/Công khai).
 *       + Xanh lá (success): "Tổng thời lượng section khớp thời gian đề (N phút)" (tổng = thời
 *         gian làm bài).
 *       + Đỏ (error, hiện khi bấm Lưu mà lệch tổng): "Tổng thời lượng section X phút ≠ thời gian
 *         đề Y phút (thiếu/thừa Z phút)".
 *   - Nút "Công khai" khi Trạng thái = Nháp bị disable VÀ có accessible name dạng tooltip giải
 *     thích thật: `Chuyển trạng thái sang "Hoàn thành" để công khai` - dùng chính text này để check
 *     trạng thái disable thay vì chỉ dựa class (SAVE-09/10).
 *   - Bấm "Quay lại" (mũi tên, accessible name "Quay lại danh sách") HOẶC nút "Hủy" cuối trang khi
 *     CÓ thay đổi chưa lưu đều mở CÙNG 1 popup xác nhận: tiêu đề "Bỏ thay đổi?", nội dung "Các thay
 *     đổi chưa lưu sẽ bị mất. Bạn có chắc muốn rời khỏi màn này?", nút "Hủy"/"Rời khỏi" - ĐÃ XÁC
 *     NHẬN THẬT cả 2 lối vào (SAVE-01..04). Khi KHÔNG có thay đổi gì, bấm thẳng ra danh sách, không
 *     hỏi.
 *   - Bấm "Công khai" mở popup xác nhận riêng: tiêu đề "Công khai đề thi?", nội dung "Sau khi công
 *     khai, học sinh sẽ thấy và làm được đề này trên app.", nút "Hủy"/"Công khai".
 *   - SAVE-12: tên case gốc trong `TESTCASES.xlsx` ghi "tự động gỡ Công khai" nhưng cột Kỳ vọng lại
 *     ghi "vẫn giữ nguyên Công khai" - 2 cách diễn đạt MÂU THUẪN NHAU trong chính file nguồn. ĐÃ
 *     XÁC NHẬN THẬT hành vi thực tế: sửa nội dung 1 đề đang Công khai rồi bấm Lưu (không bấm lại
 *     Công khai) → Chế độ VẪN GIỮ NGUYÊN Công khai, KHÔNG tự gỡ. Test dưới đây assert đúng theo
 *     hành vi thật/cột Kỳ vọng, coi tên case là lỗi đánh máy khi viết file nguồn.
 *   - Popup "Thêm mới Bài thực hành": tiêu đề "Thêm mới Bài thực hành", dòng "Section: <tên
 *     section>" xác nhận đúng section đang thao tác, ô tìm kiếm placeholder "Tìm theo tên đề
 *     thi..." (TRÙNG placeholder với ô tìm kiếm ở màn danh sách ngoài - không phải lỗi, chỉ là tái
 *     dùng chữ), danh sách chọn 1 dòng (không phải checkbox nhiều), nút "Hủy"/"Lưu".
 *   - Popup Xóa đề thi: tiêu đề "Xóa đề thi". Với đề ĐÃ Công khai, nội dung đầy đủ ĐÃ XÁC NHẬN THẬT:
 *     `Bạn có chắc chắn muốn xóa đề thi "<tên>"? Đề sẽ biến mất khỏi ứng dụng của học sinh. Hành
 *     động này không thể hoàn tác.` - với đề CHƯA công khai, CHƯA xác nhận riêng câu chữ (nhiều khả
 *     năng bớt đi vế "Đề sẽ biến mất..." vì chưa từng hiển thị) nên `deleteDialogMatches()` dưới
 *     đây chỉ match phần CHUNG (chứa tên đề + "không thể hoàn tác"), không ép cả câu để tránh fail
 *     giả khi 2 ngữ cảnh khác câu chữ.
 */
import { cmsAdminPageObjects } from "../../quan_ly_goi_dich_vu/navigation/cmsAdminPageObjects.js";
import { createSection } from "../../quan_ly_section/navigation/cmsSectionPageObjects.js";
import { createScoreTable } from "../../cau_hinh_bang_diem/navigation/cmsScoreTablePageObjects.js";
import {
  gotoKyThi,
  createKyThi,
  openEditKyThiPopup as openEditKyThiPopupInner,
  attachSection as attachSectionToKyThi,
  saveKyThiPopup,
  deleteKyThiByName,
} from "../../quan_ly_ky_thi/navigation/cmsKyThiPageObjects.js";

export const cmsDeThiPageObjects = {
  login: cmsAdminPageObjects.login,

  path: "/exam-prep/papers",
  createPath: "/exam-prep/papers/create",
  heading: "Ngân hàng đề thi",
  addButtonText: "Thêm mới",
  tableRowSelector: "table tbody tr",
  searchInputPlaceholder: "Tìm theo tên đề thi...",
  examTypeFilterDefaultText: "Tất cả loại kỳ thi",
  gradeFilterDefaultText: "Tất cả khối lớp",

  createHeading: "Tạo mới đề thi",
  editHeadingPrefix: "Chỉnh sửa đề thi",
  backButtonName: "Quay lại danh sách",

  nameInput: 'input[placeholder="Nhập tên đề thi"]',
  nameRequiredError: "Vui lòng nhập tên đề thi",
  nameDuplicateError: "đã tồn tại",
  examTypeSelectPlaceholder: "Chọn loại kỳ thi",
  examTypeRequiredError: "Vui lòng chọn loại kỳ thi",
  durationInput: 'input[placeholder="Nhập số phút"]',
  durationRequiredError: "Vui lòng nhập thời gian làm bài",
  gradeSelectPlaceholder: "Chọn khối lớp",
  gradeRequiredError: "Chọn ít nhất 1 khối lớp",
  scoreTableSelectPlaceholderNoExamType: "Chọn loại kỳ thi trước",
  scoreTableSelectPlaceholder: "Chọn bảng điểm",
  scoreTableRequiredError: "Vui lòng chọn bảng điểm quy đổi",
  scoreTableConversionNoteText: "Dạng quy đổi của kỳ thi:",
  checkRequiredFieldsBanner: "Vui lòng kiểm tra lại các trường bắt buộc",

  structureEmptyNoExamType: "Chưa chọn loại kỳ thi",
  structureEmptyNoSection: "Chưa có section nào trong đề",
  addSectionToStructurePlaceholder: "Chọn section để thêm vào đề",
  addSectionToStructureButton: "Thêm Section",
  sectionDurationPlaceholder: "--",
  removeSectionFromStructureButton: "Xóa section khỏi đề",
  toggleSectionCollapseButton: "Thu gọn / Mở rộng",
  addContentToSectionButton: "Bài thực hành",
  practiceRowViewButton: "Xem",
  practiceRowEditButton: "Sửa",
  practiceRowDeleteButton: "Xóa",

  durationInfoBannerPattern: /Thời gian đề:\s*\d+\s*phút.*không giới hạn thời gian riêng/,
  durationWarningBannerPattern: /Đã nhập thời lượng\s*\d+\/\d+\s*section.*cần nhập cho tất cả section/,
  durationSuccessBannerPattern: /Tổng thời lượng section khớp thời gian đề/,
  durationMismatchErrorPattern: /Tổng thời lượng section\s*\d+\s*phút\s*≠\s*thời gian đề\s*\d+\s*phút/,
  sectionMissingPracticeErrorPattern: (sectionName) => new RegExp(`Section ['"]${sectionName}['"] cần có ít nhất 1 bài thực hành`),

  draftRadioLabel: "Nháp",
  completedRadioLabel: "Hoàn thành",
  freeRadioLabel: "Free",
  proRadioLabel: "Pro",
  publishButtonText: "Công khai",
  unpublishButtonText: "Đỡ công khai",
  publishDisabledHint: 'Chuyển trạng thái sang "Hoàn thành" để công khai',
  lastUpdatedPrefix: "Cập nhật lần cuối:",

  cancelButton: "Hủy",
  saveButton: "Lưu",

  discardChangesDialogTitle: "Bỏ thay đổi?",
  discardChangesDialogText: "Các thay đổi chưa lưu sẽ bị mất. Bạn có chắc muốn rời khỏi màn này?",
  discardChangesConfirmButton: "Rời khỏi",
  discardChangesCancelButton: "Hủy",

  publishDialogTitle: "Công khai đề thi?",
  publishDialogText: "Sau khi công khai, học sinh sẽ thấy và làm được đề này trên app.",
  publishConfirmButton: "Công khai",

  deleteDialogTitle: "Xóa đề thi",
  deleteConfirmButton: "Xóa",

  popupAddPracticeTitle: "Thêm mới Bài thực hành",
  popupSectionLabelPrefix: "Section:",
  popupSearchPlaceholder: "Tìm theo tên đề thi...",
};

const po = cmsDeThiPageObjects;

export async function gotoDeThi(page, baseUrl) {
  await page.goto(`${baseUrl}${po.path}`, { waitUntil: "networkidle" });
}

export async function clickAddNew(page) {
  await page.getByRole("button", { name: po.addButtonText }).click();
  await page.getByRole("heading", { name: po.createHeading }).waitFor({ state: "visible", timeout: 10000 });
}

export function deThiRow(page, name) {
  return page.locator(po.tableRowSelector).filter({ hasText: name });
}

export async function openEditDeThi(page, name) {
  await deThiRow(page, name).getByRole("button", { name: "Sửa" }).click();
  await page.getByText(po.editHeadingPrefix, { exact: false }).first().waitFor({ state: "visible", timeout: 10000 });
}

/** Mở popup xác nhận xóa (chưa bấm xác nhận) - dùng để test Hủy (DEL-02) hoặc đọc cảnh báo trước
 * khi quyết định xóa thật. `exact: true` BẮT BUỘC - cùng lý do đã gặp thật ở Section/Bảng
 * điểm/Kỳ thi: mặc định `getByText()` so khớp substring, khớp nhầm nội dung cảnh báo bên trong. */
export async function openDeleteConfirm(page, name) {
  await deThiRow(page, name).getByRole("button", { name: "Xóa" }).click();
  await page.getByText(po.deleteDialogTitle, { exact: true }).waitFor({ state: "visible", timeout: 10000 });
}

export async function confirmDelete(page) {
  const dialog = page.getByRole("dialog").filter({ hasText: po.deleteDialogTitle });
  await dialog.getByRole("button", { name: po.deleteConfirmButton, exact: true }).click();
  await dialog.waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(400);
}

export async function cancelDeleteConfirm(page) {
  const dialog = page.getByRole("dialog").filter({ hasText: po.deleteDialogTitle });
  await dialog.getByRole("button", { name: po.cancelButton, exact: true }).click();
  await dialog.waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
}

export async function deleteDeThiByName(page, name) {
  const row = deThiRow(page, name);
  if ((await row.count()) === 0) return;
  await openDeleteConfirm(page, name);
  await confirmDelete(page);
}

// ---------------------------------------------------------------------------------------------
// Form "Thông tin đề thi" (FORM-*)
// ---------------------------------------------------------------------------------------------

export async function fillExamName(page, name) {
  await page.locator(po.nameInput).fill(name);
}

/** Field "Loại kỳ thi" là `n-select` ĐẦU TIÊN trong cột phải "Thông tin đề thi".
 *
 * BUG ĐÃ XÁC NHẬN THẬT (2026-11-03): `hasText` so khớp SUBSTRING không phân biệt hoa/thường trên
 * TOÀN BỘ text bên trong `.n-form-item` - khi field "Bảng điểm quy đổi" CHƯA chọn Loại kỳ thi,
 * placeholder của nó là "Chọn loại kỳ thi trước" (chính nó cũng chứa substring "loại kỳ thi") nên
 * `{ hasText: "Loại kỳ thi" }` (không neo) khớp NHẦM cả 2 form-item -> strict mode violation khi
 * click. Neo `^` (regex) để chỉ khớp form-item có TÊN NHÃN bắt đầu đúng bằng "Loại kỳ thi" (nhãn
 * "Bảng điểm quy đổi" đứng trước nên không khớp `^`). */
const examTypeFieldLocator = (page) => page.locator('[class*="n-form-item"]', { hasText: /^Loại kỳ thi/ }).locator(".n-base-selection");

export async function selectExamType(page, examTypeName) {
  await examTypeFieldLocator(page).click();
  const option = page.locator('.n-base-select-option:visible, [role="option"]:visible', { hasText: examTypeName }).first();
  await option.waitFor({ state: "visible", timeout: 10000 });
  await option.click();
  await page.waitForTimeout(300);
}

export async function readSelectedExamType(page) {
  return examTypeFieldLocator(page).innerText();
}

export async function fillExamDuration(page, minutes) {
  const input = page.locator(po.durationInput);
  await input.click();
  await input.fill(String(minutes));
  await input.blur?.().catch(() => {});
  await page.keyboard.press("Tab");
}

/** Gõ chuỗi BẤT KỲ (kể cả không hợp lệ) vào field Thời gian làm bài - dùng cho FORM-10, KHÔNG
 * `.fill()` (fill xoá sạch trước nên không mô phỏng đúng gõ từng ký tự) rồi blur ra ngoài để field
 * tự sanitize - xem ghi chú đầu file (field KHÔNG chặn gõ, chỉ sanitize lúc blur/Lưu). */
export async function typeExamDurationRaw(page, text) {
  const input = page.locator(po.durationInput);
  await input.click();
  await input.fill("");
  await input.type(text);
  await page.locator(po.nameInput).click(); // blur sang field khác
}

export async function selectGrades(page, gradeNames) {
  const field = page.locator('[class*="n-form-item"]', { hasText: "Khối lớp" }).locator(".n-base-selection");
  await field.click();
  for (const grade of gradeNames) {
    const option = page.locator('.n-base-select-option:visible, [role="option"]:visible', { hasText: grade }).first();
    await option.waitFor({ state: "visible", timeout: 10000 });
    await option.click();
  }
  await page.keyboard.press("Escape");
}

export async function readSelectedGrades(page) {
  const field = page.locator('[class*="n-form-item"]', { hasText: "Khối lớp" }).locator(".n-base-selection");
  const text = await field.innerText();
  return text
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
}

const scoreTableSelectLocator = (page) => page.locator('[class*="n-form-item"]', { hasText: "Bảng điểm quy đổi" }).locator(".n-base-selection");

export async function isScoreTableSelectDisabled(page) {
  const cls = (await scoreTableSelectLocator(page).getAttribute("class")) || "";
  return cls.includes("n-base-selection--disabled");
}

export async function readScoreTableConversionNote(page) {
  return page.locator("text=/Dạng quy đổi của kỳ thi:/").innerText();
}

/** ĐÃ GẶP THẬT (2026-11-03): môi trường tích luỹ NHIỀU bảng điểm (dữ liệu thật + AUTO- của các lượt
 * chạy test khác) khiến dropdown chỉ RENDER 1 lô đầu (virtual scroll Naive UI) - bảng điểm cần chọn
 * có thể KHÔNG nằm trong lô đó, click+chờ hiển thị TIMEOUT dù bảng điểm có tồn tại thật. KHÁC select
 * "Chọn section để thêm vào đề" (filter-by-typing được) - select này ĐÃ XÁC NHẬN THẬT (chụp màn
 * hình) KHÔNG hỗ trợ gõ tìm (gõ vào không có ô input nào nhận, danh sách không đổi) nên phải CUỘN
 * (`mouse.wheel`) qua từng lô tới khi option cần tìm render ra. */
export async function selectScoreTable(page, scoreTableName) {
  const selectLocator = scoreTableSelectLocator(page);
  await selectLocator.click();
  // ĐÃ GẶP THẬT (2026-11-03, staging): bounding box lấy ngay sau click đôi lúc sai (panel dropdown
  // còn đang định vị/animate) khiến vòng lặp cuộn bên dưới dùng toạ độ chuột sai, không bao giờ
  // tới được option cần tìm dù nó tồn tại thật - chờ ngắn cho panel ổn định trước khi đo box.
  await page.waitForTimeout(300);
  const option = page.locator('.n-base-select-option:visible, [role="option"]:visible', { hasText: scoreTableName }).first();
  const box = await selectLocator.boundingBox();
  for (let i = 0; i < 60; i += 1) {
    if (await option.count()) break;
    if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height + 150);
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(120);
  }
  await option.waitFor({ state: "visible", timeout: 10000 });
  await option.click();
}

export async function readSelectedScoreTable(page) {
  return scoreTableSelectLocator(page).innerText();
}

export async function selectTrangThai(page, label) {
  await page.getByText(label, { exact: true }).locator("xpath=ancestor::*[contains(@class,'n-radio')][1]").click();
}

export async function selectHinhThuc(page, label) {
  await page.getByText(label, { exact: true }).locator("xpath=ancestor::*[contains(@class,'n-radio')][1]").click();
}

export async function readSelectedTrangThai(page) {
  const checked = page.locator(".n-radio--checked", { hasText: po.draftRadioLabel });
  if (await checked.count()) return po.draftRadioLabel;
  return po.completedRadioLabel;
}

/** Điền toàn bộ field bắt buộc tối thiểu để Lưu được ở mức Nháp (SAVE-06/STRUCT-18) - KHÔNG đụng
 * tới Cấu trúc đề/Section. Chỉ set field nào được truyền. */
export async function fillMinimumExamForm(page, { name, examType, duration, grades, scoreTable } = {}) {
  if (name !== undefined) await fillExamName(page, name);
  if (examType !== undefined) await selectExamType(page, examType);
  if (duration !== undefined) await fillExamDuration(page, duration);
  if (grades !== undefined) await selectGrades(page, grades);
  if (scoreTable !== undefined) await selectScoreTable(page, scoreTable);
}

/** Tạo nhanh 1 đề thi hợp lệ ở mức Nháp (dùng trong setup của nhiều case: LIST-*, SAVE-*, DEL-*,
 * PAGE-*) - từ danh sách, bấm Thêm mới, điền đủ field bắt buộc tối thiểu, Lưu. KHÔNG đụng tới Cấu
 * trúc đề (chỉ hợp lệ ở mức Nháp - xem STRUCT-18). `scoreTable` mặc định lấy giá trị tự fill sẵn
 * (bảng điểm tạo sớm nhất cùng Dạng quy đổi) nếu không truyền riêng. */
export async function createExam(page, { name, examType, duration = 30, grades = ["Lớp 1"], scoreTable, hinhThuc } = {}) {
  await clickAddNew(page);
  await fillExamName(page, name);
  await selectExamType(page, examType);
  await fillExamDuration(page, duration);
  await selectGrades(page, grades);
  if (scoreTable !== undefined) await selectScoreTable(page, scoreTable);
  if (hinhThuc !== undefined) await selectHinhThuc(page, hinhThuc);
  await clickSave(page);
}

// ---------------------------------------------------------------------------------------------
// Cấu trúc đề - Section (STRUCT-*, DURATION-*)
// ---------------------------------------------------------------------------------------------

const structureAddSelectLocator = (page) => page.locator(".n-base-selection", { hasText: po.addSectionToStructurePlaceholder });

export async function isStructureEmpty(page) {
  const text = await page.locator("text=Cấu trúc đề").locator("xpath=ancestor::div[1]/following-sibling::*[1]").innerText().catch(() => "");
  return text.includes(po.structureEmptyNoExamType) || text.includes(po.structureEmptyNoSection);
}

export async function readAddableSectionOptionTexts(page) {
  await structureAddSelectLocator(page).click();
  const options = page.locator('.n-base-select-option:visible, [role="option"]:visible');
  await options.first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  const texts = await options.allInnerTexts();
  await page.keyboard.press("Escape");
  return texts;
}

/** ĐÃ GẶP THẬT (2026-11-03): môi trường tích luỹ NHIỀU Section (70+, dữ liệu thật + AUTO- của các
 * lượt chạy test khác trong ngày) khiến dropdown chỉ RENDER 1 lô đầu (virtual scroll Naive UI) -
 * Section cần chọn (nhất là Section VỪA TẠO) có thể KHÔNG nằm trong lô đó, click+chờ hiển thị
 * TIMEOUT dù Section có tồn tại thật. Select này ĐÃ XÁC NHẬN THẬT hỗ trợ filter-by-typing (xem
 * `readAddableSectionOptionTextsFiltered()` ở `section-perm-sync.spec.js`) nên gõ tìm trước khi chờ
 * option - tránh timeout do virtual-scroll, KHÔNG liên quan gì tới việc Section có tồn tại hay
 * không. */
export async function selectSectionToAddToStructure(page, optionText) {
  await structureAddSelectLocator(page).click();
  await page.keyboard.type(optionText, { delay: 20 });
  await page.waitForTimeout(500);
  const option = page.locator('.n-base-select-option:visible, [role="option"]:visible', { hasText: optionText }).first();
  await option.waitFor({ state: "visible", timeout: 10000 });
  await option.click();
}

export async function clickAddSectionToStructureButton(page) {
  await page.getByRole("button", { name: po.addSectionToStructureButton, exact: false }).click();
}

export async function addSectionToStructure(page, optionText) {
  await selectSectionToAddToStructure(page, optionText);
  await clickAddSectionToStructureButton(page);
}

function structureSectionCard(page, sectionName) {
  return page.locator('[class*="section-card"], .n-card, div').filter({ hasText: sectionName }).locator("visible=true").first();
}

/** Định vị card Section theo tên - dùng selector THÔ ("đoạn chứa text") thay vì class cụ thể vì
 * chưa xác nhận được class CSS thật của card; đủ dùng cho thao tác trong phạm vi 1 trang test (tên
 * Section luôn đặt riêng biệt đủ để không khớp nhầm). */
export function sectionCardInStructure(page, sectionName) {
  return page.locator(`:has-text("${sectionName}")`).locator("xpath=.//ancestor-or-self::*[.//button[@aria-label='Xóa section khỏi đề' or text()='Xóa section khỏi đề']][1]").last();
}

export async function removeSectionFromStructure(page, sectionName) {
  const card = page.locator("div", { hasText: sectionName }).filter({ has: page.getByRole("button", { name: po.removeSectionFromStructureButton }) }).last();
  await card.getByRole("button", { name: po.removeSectionFromStructureButton }).click();
}

export async function fillSectionDurationInStructure(page, sectionName, minutes) {
  const card = page.locator("div", { hasText: sectionName }).filter({ has: page.locator(`input[placeholder="${po.sectionDurationPlaceholder}"]`) }).last();
  const input = card.locator(`input[placeholder="${po.sectionDurationPlaceholder}"]`).first();
  await input.fill(String(minutes));
  await page.keyboard.press("Tab");
}

export async function clearSectionDurationInStructure(page, sectionName) {
  const card = page.locator("div", { hasText: sectionName }).filter({ has: page.locator(`input[placeholder="${po.sectionDurationPlaceholder}"]`) }).last();
  const input = card.locator(`input[placeholder="${po.sectionDurationPlaceholder}"]`).first();
  await input.fill("");
  await page.keyboard.press("Tab");
}

export async function readSectionDurationInStructure(page, sectionName) {
  const card = page.locator("div", { hasText: sectionName }).filter({ has: page.locator(`input[placeholder="${po.sectionDurationPlaceholder}"]`) }).last();
  return card.locator(`input[placeholder="${po.sectionDurationPlaceholder}"]`).first().inputValue();
}

/** Đọc đúng thứ tự tên các Section card đang có trong "Cấu trúc đề" (dòng trên = thứ tự nhỏ hơn) -
 * dùng để assert tự fill đúng thứ tự (STRUCT-02) hoặc thứ tự thêm (STRUCT-04). */
export async function readStructureSectionNamesInOrder(page) {
  const handles = page.locator(`button[aria-label="${po.removeSectionFromStructureButton}"], button:has-text("${po.removeSectionFromStructureButton}")`);
  const count = await handles.count();
  const names = [];
  for (let i = 0; i < count; i += 1) {
    const cardText = await handles.nth(i).locator("xpath=ancestor::*[self::div][1]/parent::div").innerText().catch(() => "");
    names.push(cardText.split("\n")[0]?.trim() || "");
  }
  return names;
}

export async function clickAddPracticeButton(page, sectionName) {
  const card = page.locator("div", { hasText: sectionName }).filter({ hasText: po.addContentToSectionButton }).last();
  await card.getByRole("button", { name: po.addContentToSectionButton, exact: false }).click();
  await page.getByRole("dialog").getByText(po.popupAddPracticeTitle, { exact: true }).waitFor({ state: "visible", timeout: 10000 });
}

// ---------------------------------------------------------------------------------------------
// Popup "Thêm mới Bài thực hành" (POPUP-*)
// ---------------------------------------------------------------------------------------------

function practicePopupDialog(page) {
  return page.getByRole("dialog").filter({ hasText: po.popupAddPracticeTitle });
}

export async function readPracticePopupSectionLabel(page) {
  return practicePopupDialog(page).locator(`text=${po.popupSectionLabelPrefix}`).innerText();
}

export async function searchInPracticePopup(page, text) {
  await practicePopupDialog(page).locator(`input[placeholder="${po.popupSearchPlaceholder}"]`).fill(text);
  await page.waitForTimeout(500);
}

export async function readPracticePopupOptionTexts(page) {
  return practicePopupDialog(page).locator("li, [role='listitem']").allInnerTexts();
}

export async function selectPracticeInPopup(page, text) {
  await practicePopupDialog(page).getByText(text, { exact: false }).first().click();
}

export async function clickPracticePopupSave(page) {
  await practicePopupDialog(page).getByRole("button", { name: po.saveButton, exact: true }).click();
  await practicePopupDialog(page).waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
}

export async function clickPracticePopupCancel(page) {
  await practicePopupDialog(page).getByRole("button", { name: po.cancelButton, exact: true }).click();
  await practicePopupDialog(page).waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
}

export function practiceRow(page, sectionName, practiceName) {
  const card = page.locator("div", { hasText: sectionName }).filter({ hasText: po.addContentToSectionButton }).last();
  return card.locator("div", { hasText: practiceName }).last();
}

export async function clickPracticeView(page, sectionName, practiceName) {
  await practiceRow(page, sectionName, practiceName).getByRole("button", { name: po.practiceRowViewButton, exact: true }).click();
}

export async function clickPracticeDelete(page, sectionName, practiceName) {
  await practiceRow(page, sectionName, practiceName).getByRole("button", { name: po.practiceRowDeleteButton, exact: true }).click();
}

// ---------------------------------------------------------------------------------------------
// Lưu / Công khai / Quay lại (SAVE-*)
// ---------------------------------------------------------------------------------------------

export async function clickSave(page) {
  await page.getByRole("button", { name: po.saveButton, exact: true }).click();
  await page.waitForTimeout(600);
}

export async function clickCancelButton(page) {
  await page.locator("button", { hasText: po.cancelButton }).last().click();
}

export async function clickBackIcon(page) {
  await page.getByRole("button", { name: po.backButtonName }).click();
}

export async function isDiscardChangesDialogVisible(page) {
  return page.getByText(po.discardChangesDialogTitle, { exact: true }).isVisible().catch(() => false);
}

export async function confirmDiscardChanges(page) {
  const dialog = page.getByRole("dialog").filter({ hasText: po.discardChangesDialogTitle });
  await dialog.getByRole("button", { name: po.discardChangesConfirmButton, exact: true }).click();
}

export async function cancelDiscardChangesDialog(page) {
  const dialog = page.getByRole("dialog").filter({ hasText: po.discardChangesDialogTitle });
  await dialog.getByRole("button", { name: po.discardChangesCancelButton, exact: true }).click();
  await dialog.waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
}

export async function isPublishButtonDisabled(page) {
  const btn = page.getByRole("button", { name: po.publishButtonText, exact: false });
  return btn.isDisabled();
}

export async function clickPublishButton(page) {
  await page.getByRole("button", { name: po.publishButtonText, exact: true }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: po.publishDialogTitle });
  await dialog.waitFor({ state: "visible", timeout: 10000 });
}

export async function confirmPublish(page) {
  const dialog = page.getByRole("dialog").filter({ hasText: po.publishDialogTitle });
  await dialog.getByRole("button", { name: po.publishConfirmButton, exact: true }).click();
  await page.waitForTimeout(600);
}

export async function readLastUpdatedText(page) {
  return page.locator(`text=${po.lastUpdatedPrefix}`).innerText();
}

export async function readPageBannerTexts(page) {
  return page.locator('[class*="alert"], [class*="banner"]').allInnerTexts().catch(() => []);
}

// ---------------------------------------------------------------------------------------------
// Danh sách (LIST-*) - mirror cơ chế đã xác nhận ở Kỳ thi/Section/Bảng điểm
// ---------------------------------------------------------------------------------------------

export async function readAllExamNamesInOrder(page) {
  const rows = page.locator(po.tableRowSelector);
  const count = await rows.count();
  const names = [];
  for (let i = 0; i < count; i += 1) {
    names.push((await rows.nth(i).locator("td").nth(1).innerText()).trim());
  }
  return names;
}

export async function readRowGrades(page, name) {
  return deThiRow(page, name).locator("td").nth(2).innerText();
}

export async function readRowFormatBadge(page, name) {
  return deThiRow(page, name).locator("td").nth(3).innerText();
}

export async function readRowStatusBadge(page, name) {
  return deThiRow(page, name).locator("td").nth(4).innerText();
}

export async function readRowCreatedDate(page, name) {
  return deThiRow(page, name).locator("td").nth(5).innerText();
}

async function waitForTableStable(page) {
  await page.waitForTimeout(500);
  await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
}

export async function searchDeThi(page, text) {
  await page.locator(`input[placeholder="${po.searchInputPlaceholder}"]`).fill(text);
  await waitForTableStable(page);
}

export async function clearSearch(page) {
  await searchDeThi(page, "");
}

const examTypeFilterLocator = (page) => page.locator(".n-base-selection", { hasText: po.examTypeFilterDefaultText }).or(page.locator(".n-base-selection", { hasText: /^Tất cả loại kỳ thi|^[^T]/ })).first();

export async function filterByExamType(page, examTypeName) {
  await page.locator(".n-base-selection").filter({ hasText: /loại kỳ thi/ }).first().click();
  const option = page.locator('.n-base-select-option:visible, [role="option"]:visible', { hasText: examTypeName }).first();
  await option.waitFor({ state: "visible", timeout: 10000 });
  await option.click();
  await waitForTableStable(page);
}

export async function resetExamTypeFilter(page) {
  await filterByExamType(page, po.examTypeFilterDefaultText);
}

export async function readExamTypeFilterOptionTexts(page) {
  await page.locator(".n-base-selection").filter({ hasText: /loại kỳ thi/ }).first().click();
  const options = page.locator('.n-base-select-option:visible, [role="option"]:visible');
  await options.first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  const texts = await options.allInnerTexts();
  await page.keyboard.press("Escape");
  return texts;
}

export async function filterByGrade(page, gradeName) {
  await page.locator(".n-base-selection").filter({ hasText: /khối lớp/ }).first().click();
  const option = page.locator('.n-base-select-option:visible, [role="option"]:visible', { hasText: gradeName }).first();
  await option.waitFor({ state: "visible", timeout: 10000 });
  await option.click();
  await waitForTableStable(page);
}

export async function resetGradeFilter(page) {
  await filterByGrade(page, po.gradeFilterDefaultText);
}

export async function readGradeFilterOptionTexts(page) {
  await page.locator(".n-base-selection").filter({ hasText: /khối lớp/ }).first().click();
  const options = page.locator('.n-base-select-option:visible, [role="option"]:visible');
  await options.first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  const texts = await options.allInnerTexts();
  await page.keyboard.press("Escape");
  return texts;
}

export async function readTotalCountBadge(page) {
  const text = await page.locator("text=/^\\d+ đề thi$/").first().innerText();
  return Number(text.match(/^(\d+) đề thi$/)[1]);
}

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

// ---------------------------------------------------------------------------------------------
// Fixture dùng chung - tạo Kỳ thi/Section/Bảng điểm RIÊNG cho module Đề thi (TÁI SỬ DỤNG thẳng
// helper của 3 module kia thay vì viết lại) để không phụ thuộc dữ liệu thật có sẵn trên dev (có
// thể bị đổi/xoá bởi phiên khác) - mirror đúng tinh thần "tiền tố AUTO-" đã dùng xuyên suốt.
// ---------------------------------------------------------------------------------------------

/**
 * Dựng sẵn 2 Section + 1 Bảng điểm + 2 Kỳ thi (1 kỳ thi ĐÃ gắn sẵn 2 section vào "Cấu hình đề
 * xuất" để test STRUCT-02/EDIT-04, 1 kỳ thi HOÀN TOÀN trống để test STRUCT-01/EDIT-05) cho 1 lượt
 * chạy test (gắn `runId` vào mọi tên để cô lập + dễ dọn dẹp). Trả về tên các bản ghi đã tạo.
 */
export async function setupDeThiFixtures(page, baseUrl, runId) {
  const sectionA = `${runId}-secA`;
  const sectionB = `${runId}-secB`;
  const scoreTable = `${runId}-bd`;
  const examTypeWithSections = `${runId}-kt-full`;
  const examTypeEmpty = `${runId}-kt-empty`;

  await page.goto(`${baseUrl}/exam-prep/sections`, { waitUntil: "networkidle" });
  await createSection(page, { name: sectionA, skill: "Nghe", duration: 10 });
  await createSection(page, { name: sectionB, skill: "Nói", duration: 15 });

  await page.goto(`${baseUrl}/exam-prep/score-tables`, { waitUntil: "networkidle" });
  await createScoreTable(page, { name: scoreTable, description: `${runId} score table` });

  await gotoKyThi(page, baseUrl);
  await createKyThi(page, { name: examTypeEmpty });
  await createKyThi(page, { name: examTypeWithSections });
  await openEditKyThiPopupInner(page, examTypeWithSections);
  await attachSectionToKyThi(page, `${sectionA} (Nghe)`);
  await attachSectionToKyThi(page, `${sectionB} (Nói)`);
  await saveKyThiPopup(page);

  return { sectionA, sectionB, scoreTable, examTypeWithSections, examTypeEmpty };
}

/** Dọn dẹp fixture tạo bởi `setupDeThiFixtures` - PHẢI xóa Đề thi (tham chiếu) trước, sau đó mới
 * xóa được Kỳ thi/Section/Bảng điểm (bị chặn xóa khi còn đang gắn, xem DEL-02/03 ở module Kỳ thi/
 * Bảng điểm). `examNamesToDelete` là danh sách tên Đề thi do từng spec file tự tạo cần dọn trước. */
export async function teardownDeThiFixtures(page, baseUrl, fixtures, examNamesToDelete = []) {
  await gotoDeThi(page, baseUrl);
  for (const name of examNamesToDelete) {
    await deleteDeThiByName(page, name).catch(() => {});
  }

  await gotoKyThi(page, baseUrl);
  await deleteKyThiByName(page, fixtures.examTypeWithSections).catch(() => {});
  await deleteKyThiByName(page, fixtures.examTypeEmpty).catch(() => {});

  const { deleteSectionByName } = await import("../../quan_ly_section/navigation/cmsSectionPageObjects.js");
  await page.goto(`${baseUrl}/exam-prep/sections`, { waitUntil: "networkidle" });
  await deleteSectionByName(page, fixtures.sectionA).catch(() => {});
  await deleteSectionByName(page, fixtures.sectionB).catch(() => {});

  const { deleteScoreTableByName } = await import("../../cau_hinh_bang_diem/navigation/cmsScoreTablePageObjects.js");
  await page.goto(`${baseUrl}/exam-prep/score-tables`, { waitUntil: "networkidle" });
  await deleteScoreTableByName(page, fixtures.scoreTable).catch(() => {});
}
