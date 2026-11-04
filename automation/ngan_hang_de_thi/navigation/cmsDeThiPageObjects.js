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
  kyThiRow,
  searchKyThi,
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
  examTypeLoadingFallbackText: "Chưa có kỳ thi – hãy tạo ở menu Quản lý kỳ thi",

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
  deletePracticeDialogTitle: "Xóa bài thực hành?",

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

/** ĐÃ XÁC NHẬN THẬT qua script debug trực tiếp (EDIT-01, 2026-11-04, theo yêu cầu user nghi ngờ bug
 * - test tay KHÔNG tái hiện được): KHÔNG phải mất dữ liệu - đây là race HIỂN THỊ thuần front-end.
 * Heading "Chỉnh sửa đề thi" render NGAY (tĩnh), nhưng field "Loại kỳ thi" (và Cấu trúc đề) phụ
 * thuộc 1 lệnh gọi API lấy chi tiết đề thi chạy BẤT ĐỒNG BỘ sau đó - trong khoảng hở này, field
 * "Loại kỳ thi" hiện tạm fallback "Chưa có kỳ thi – hãy tạo ở menu Quản lý kỳ thi" (y hệt khi hệ
 * thống KHÔNG CÓ kỳ thi nào, dễ gây hiểu nhầm là mất dữ liệu). Đọc ngay sau khi heading hiện (như
 * code cũ) bắt trúng khoảng hở này. Dữ liệu thật vẫn nguyên vẹn - chỉ cần đợi field hydrate xong
 * (đã xác nhận: đọc lại vài trăm ms sau đó ra đúng giá trị, section/thời lượng cũng luôn đúng). */
export async function openEditDeThi(page, name) {
  await deThiRow(page, name).getByRole("button", { name: "Sửa" }).click();
  await page.getByText(po.editHeadingPrefix, { exact: false }).first().waitFor({ state: "visible", timeout: 10000 });
  const examTypeField = page.locator('[class*="n-form-item"]', { hasText: /^Loại kỳ thi/ }).locator(".n-base-selection");
  for (let i = 0; i < 30; i += 1) {
    const text = await examTypeField.innerText().catch(() => "");
    if (text && !text.includes(po.examTypeLoadingFallbackText)) break;
    await page.waitForTimeout(200);
  }
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

/** ĐÃ GẶP THẬT (2026-11-04, staging - xem `_scratch_diag_name_reset*.mjs`): `.fill()` set giá trị
 * DOM bằng 1 sự kiện duy nhất, không khớp đúng cách Naive UI `n-input` này cập nhật state Vue nội
 * bộ của nó - giá trị HIỂN THỊ đúng ngay lúc đó nhưng ~300-600ms sau, component tự re-render (vd do
 * 1 watcher khác chạy xong) và GHI ĐÈ lại ô input về rỗng vì state thật vẫn chưa nhận được giá trị.
 * Test tay gõ từng ký tự (đúng sự kiện input/keyup thật) không bao giờ gặp - ĐÃ XÁC NHẬN cố định
 * bằng `pressSequentially()` (gõ từng ký tự giống người dùng thật) thay cho `fill()`. */
export async function fillExamName(page, name) {
  const input = page.locator(po.nameInput);
  await input.click();
  await input.fill("");
  await input.pressSequentially(name, { delay: 20 });
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

/** ĐÃ GẶP THẬT (2026-11-04, staging): chọn Loại kỳ thi CÓ sẵn Section kích hoạt fetch+auto-fill bất
 * đồng bộ (cấu trúc Section + thời lượng từng Section + Bảng điểm quy đổi) - `waitForTimeout(300)`
 * cũ không đủ, dẫn tới bấm Lưu ngay sau đó đọc phải state CHƯA fill xong (vd "Tổng thời lượng
 * section" vẫn 0/thiếu) -> Lưu bị chặn dù dữ liệu truyền vào đúng. Chờ `networkidle` để các fetch
 * do lựa chọn này kích hoạt kịp hoàn tất trước khi trả quyền điều khiển. */
export async function selectExamType(page, examTypeName) {
  await examTypeFieldLocator(page).click();
  const option = page.locator('.n-base-select-option:visible, [role="option"]:visible', { hasText: examTypeName }).first();
  await option.waitFor({ state: "visible", timeout: 10000 });
  await option.click();
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(300);
  // `networkidle` không phải lúc nào cũng đủ (vẫn gặp lại race dù đã thêm ở trên) - chờ thêm tới 5s
  // cho tín hiệu CHÍNH XÁC HƠN: input Thời lượng của Section (nếu có) phải có giá trị thật, không
  // còn rỗng, trước khi trả quyền điều khiển.
  const durationInputs = page.locator(`input[placeholder="${po.sectionDurationPlaceholder}"]`);
  for (let i = 0; i < 20; i += 1) {
    if (await page.getByText(po.structureEmptyNoSection, { exact: false }).count()) break;
    const count = await durationInputs.count();
    if (count === 0) break;
    const values = await Promise.all(Array.from({ length: count }, (_, idx) => durationInputs.nth(idx).inputValue()));
    if (values.every((v) => v !== "")) break;
    await page.waitForTimeout(250);
  }
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

/** ĐÃ XÁC NHẬN THẬT (FORM-09, 2026-11-04, qua test tay của user + screenshot lỗi): đây là `n-select`
 * multiple - bấm vào 1 option ĐÃ ĐƯỢC CHỌN SẴN sẽ TOGGLE OFF (bỏ chọn), không phải no-op. Khi 2 test
 * liên tiếp trong cùng `describe.serial` (dùng chung `page`) đều gọi `selectGrades(page, ["Lớp 1"])`,
 * lần gọi thứ 2 vô tình BỎ CHỌN "Lớp 1" thay vì giữ nguyên - khiến Khối lớp trống khi Lưu, che mất
 * lỗi thật đang test (xem thêm field khác). Luôn kiểm tra đã chọn chưa trước khi bấm. */
export async function selectGrades(page, gradeNames) {
  const field = page.locator('[class*="n-form-item"]', { hasText: "Khối lớp" }).locator(".n-base-selection");
  const alreadySelectedText = await field.innerText().catch(() => "");
  await field.click();
  for (const grade of gradeNames) {
    if (alreadySelectedText.includes(grade)) continue;
    const option = page.locator('.n-base-select-option:visible, [role="option"]:visible', { hasText: grade }).first();
    await option.waitFor({ state: "visible", timeout: 10000 });
    await option.click();
  }
  await page.keyboard.press("Escape");
}

/** Bỏ chọn HẾT Khối lớp đang chọn - bấm icon "×" trên từng tag (`n-tag__close`, giống `n-tag__content`
 * đã xác nhận thật ở module Quản lý gói dịch vụ) thay vì gọi lại `selectGrades` với cùng tên (sẽ bị
 * bắt sớm khi đã chọn - xem comment `selectGrades`). Dùng khi cần ép Khối lớp về trạng thái trống
 * thật (vd FORM-11) thay vì giả định field đang trống sẵn. */
export async function clearGrades(page) {
  const field = page.locator('[class*="n-form-item"]', { hasText: "Khối lớp" }).locator(".n-base-selection");
  const closeButtons = field.locator(".n-tag__close");
  while (await closeButtons.count()) {
    await closeButtons.first().click();
  }
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

/** Kiểm tra 1 tên Bảng điểm có xuất hiện trong dropdown "Bảng điểm quy đổi" hay không - dùng cho
 * SYNC-04 (xác nhận Bảng điểm đã xóa KHÔNG còn trong dropdown). Cùng cơ chế cuộn virtual-scroll
 * như `selectScoreTable()` ở trên nhưng KHÔNG click (chỉ đọc có/không) - trả về `false` sau khi đã
 * cuộn hết mà không tìm thấy, KHÔNG throw timeout như `selectScoreTable()`. */
export async function isScoreTableOptionAvailable(page, scoreTableName) {
  const selectLocator = scoreTableSelectLocator(page);
  await selectLocator.click();
  await page.waitForTimeout(300);
  const option = page.locator('.n-base-select-option:visible, [role="option"]:visible', { hasText: scoreTableName }).first();
  const box = await selectLocator.boundingBox();
  for (let i = 0; i < 60; i += 1) {
    if (await option.count()) break;
    if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height + 150);
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(120);
  }
  const found = (await option.count()) > 0;
  await page.keyboard.press("Escape");
  return found;
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

/** ĐÃ XÁC NHẬN THẬT qua DOM dump trực tiếp (STRUCT-01, 2026-11-04, theo yêu cầu user kiểm tra lại
 * sau khi test tay không tái hiện được): heading "Cấu trúc đề" (`<h3>`) và nội dung thật của nó
 * (vd div "Chưa chọn loại kỳ thi") là 2 ANH EM (siblings) TRONG CÙNG 1 card - XPath cũ
 * `ancestor::div[1]/following-sibling::*[1]` nhảy lên ancestor SAI 1 bậc (tới div BỌC CẢ CARD) rồi
 * lấy sibling CỦA CARD ĐÓ (card "Thông tin đề thi" bên phải) thay vì sibling của chính `<h3>` -
 * luôn đọc nhầm sang nội dung card khác nên `isStructureEmpty()` không bao giờ khớp đúng. Bỏ hẳn
 * bước `ancestor::div[1]/` - chỉ cần sibling trực tiếp của `<h3>`. */
export async function isStructureEmpty(page) {
  const text = await page.locator("text=Cấu trúc đề").locator("xpath=following-sibling::*[1]").innerText().catch(() => "");
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
 * dùng để assert tự fill đúng thứ tự (STRUCT-02) hoặc thứ tự thêm (STRUCT-04).
 *
 * ĐÃ GẶP THẬT (2026-11-04, staging - `ky-thi-edit.spec.js`/`ky-thi-perm-sync.spec.js` EDIT-03/
 * SYNC-02): bản cũ định vị card qua nút "Xóa section khỏi đề" (`aria-label`/text) - xác nhận THẬT
 * trên DEV nhưng SAI trên STAGING: dò trực tiếp DOM (10 nút trong màn, in hết aria-label/text) cho
 * thấy nút xóa icon-only KHÔNG có aria-label lẫn text accessible nào trên staging (chỉ "Bài thực
 * hành"/"Thêm Section"/"Hủy"/"Lưu"/"Công khai" có tên) dù Section card build đúng Cấu trúc đề thật
 * (xác nhận qua screenshot). Đổi sang định vị theo input Thời lượng (`placeholder="--"`, luôn có
 * trên MỌI card, đã dùng ổn định bởi `fillSectionDurationInStructure()`) rồi lấy `ancestor::div[5]`
 * (xác nhận đúng qua dò DOM thật: div[1..4] chỉ chứa text "--"/"phút" của riêng ô input, div[5] mới
 * là card đầy đủ "Tên Section\nKỹ năng\n--\nphút", div[6] lẫn thêm cả khối "Bài thực hành" bên dưới)
 * - KHÔNG còn phụ thuộc nút Xóa, hoạt động đúng trên CẢ dev và staging. */
export async function readStructureSectionNamesInOrder(page) {
  const inputs = page.locator(`input[placeholder="${po.sectionDurationPlaceholder}"]`);
  const count = await inputs.count();
  const names = [];
  for (let i = 0; i < count; i += 1) {
    const cardText = await inputs.nth(i).locator("xpath=ancestor::div[5]").first().innerText().catch(() => "");
    names.push(cardText.split("\n")[0]?.trim() || "");
  }
  return names;
}

export async function clickAddPracticeButton(page, sectionName) {
  const card = page.locator("div", { hasText: sectionName }).filter({ hasText: po.addContentToSectionButton }).last();
  await card.getByRole("button", { name: po.addContentToSectionButton, exact: false }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: po.popupAddPracticeTitle });
  await dialog.getByText(po.popupAddPracticeTitle, { exact: true }).waitFor({ state: "visible", timeout: 10000 });
  // Danh sách bài thực hành load bất đồng bộ SAU KHI dialog đã hiện (xác nhận thật 2026-11-04,
  // staging: đọc ngay sau khi dialog visible có lúc trả về 0 item dù list thật sự có dữ liệu) - đợi
  // item đầu tiên xuất hiện (hoặc hết 3s nếu thật sự rỗng) trước khi trả quyền điều khiển.
  await dialog.locator("li, [role='listitem']").first().waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
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

/** ĐÃ XÁC NHẬN THẬT qua trace Playwright thật (POPUP-03, 2026-11-04, theo yêu cầu user): KHÔNG phải
 * vấn đề chờ chưa đủ lâu (đã thử cả tăng timeout lẫn poll-tới-khi-ổn-định, list vẫn đứng yên y hệt
 * 51 item KHÔNG LỌC qua nhiều lần đọc liên tiếp) - đây là CÙNG HỌ bug với `fillExamName()` đã sửa
 * trước đó: `.fill()` set giá trị DOM bằng synthetic event, KHÔNG lan truyền đúng vào reactive state
 * của Naive UI `n-input` này, nên handler debounce/filter của Vue component không bao giờ được kích
 * hoạt - đợi bao lâu cũng vô ích vì không có gì đang chạy cả. Xác nhận qua test tay (giả lập bàn
 * phím thật qua JS native setter + dispatch "input" event) lọc đúng sau ~1.5-2s - chỉ cần gõ như
 * bàn phím thật (`pressSequentially`) thay vì `.fill()`. */
export async function searchInPracticePopup(page, text) {
  const input = practicePopupDialog(page).locator(`input[placeholder="${po.popupSearchPlaceholder}"]`);
  await input.click();
  await input.fill("");
  await input.pressSequentially(text, { delay: 20 });
  await page.waitForTimeout(2000);
}

/** ĐÃ XÁC NHẬN THẬT qua DOM dump trực tiếp (POPUP-04, 2026-11-04, theo yêu cầu user): placeholder
 * "Không tìm thấy đề phù hợp" (hiện khi search không khớp gì) VÀ nút "Tải thêm" đều là thẻ `<li>`
 * (khớp `li, [role='listitem']`) nhưng KHÔNG phải bài thực hành thật - cả 2 đều KHÔNG có
 * `role="option"` (chỉ item thật mới có). Dùng `li[role='option']` để loại cả 2 trường hợp giả này
 * thay vì đếm/chọn nhầm chúng như 1 kết quả/lựa chọn thật. */
export async function readPracticePopupOptionTexts(page) {
  return practicePopupDialog(page).locator("li[role='option']").allInnerTexts();
}

export async function selectPracticeInPopup(page, text) {
  await practicePopupDialog(page).getByText(text, { exact: false }).first().click();
}

/** Chọn ĐẠI 1 bài thực hành đầu tiên đang hiển thị trong popup (không quan tâm tên cụ thể) - trả
 * về tên đã chọn để test dùng lại cho các assertion sau. Dùng thay `selectPracticeInPopup()` với
 * tên hard-code (vd "AI vocabulary") - kho bài thực hành core exam khác nhau giữa các môi trường
 * (dev/staging), tên cố định không đảm bảo luôn tồn tại. */
export async function selectFirstPracticeInPopup(page) {
  const option = practicePopupDialog(page).locator("li[role='option']").first();
  await option.waitFor({ state: "visible", timeout: 10000 });
  const text = (await option.innerText()).trim();
  await option.click();
  return text;
}

/** Nút "Lưu" trong popup bị disable khi chưa chọn bài thực hành nào (POPUP-09) - PHẢI kiểm tra
 * trước khi `.click()`, vì Playwright chờ VÔ THỜI HẠN cho 1 nút disabled "trở nên enabled" (không
 * có timeout riêng), treo tới hết 90s của cả test thay vì báo lỗi rõ ràng. */
export async function isPracticePopupSaveDisabled(page) {
  return practicePopupDialog(page).getByRole("button", { name: po.saveButton, exact: true }).isDisabled();
}

export async function clickPracticePopupSave(page) {
  await practicePopupDialog(page).getByRole("button", { name: po.saveButton, exact: true }).click();
  await practicePopupDialog(page).waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
}

export async function clickPracticePopupCancel(page) {
  await practicePopupDialog(page).getByRole("button", { name: po.cancelButton, exact: true }).click();
  await practicePopupDialog(page).waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
}

/** ĐÃ XÁC NHẬN THẬT qua DOM dump trực tiếp (STRUCT-12/13/14, 2026-11-04, theo yêu cầu user): div
 * khớp SÂU NHẤT (`.last()`) chỉ là khối text "Bài thực hành: <tên>" - các nút Xem/Sửa/Xóa là ANH EM
 * (siblings) của khối text này, nằm trong 1 div CHA chung (class "flex items-center gap-2 rounded
 * px-2 py-1 hover:bg-gray-50"). `.last()` một mình chọn NHẦM div con (0 nút bên trong) khiến
 * `getByRole('button', {name:'Xem'})` không khớp gì, `.click()` treo vô thời hạn. Lên đúng 1 cấp
 * cha để lấy div chứa cả text LẪN nút hành động. */
export function practiceRow(page, sectionName, practiceName) {
  const card = page.locator("div", { hasText: sectionName }).filter({ hasText: po.addContentToSectionButton }).last();
  return card.locator("div", { hasText: practiceName }).last().locator("xpath=..");
}

export async function clickPracticeView(page, sectionName, practiceName) {
  await practiceRow(page, sectionName, practiceName).getByRole("button", { name: po.practiceRowViewButton, exact: true }).click();
}

/** ĐÃ XÁC NHẬN THẬT qua screenshot (STRUCT-12/13/14, 2026-11-04, theo yêu cầu user): bấm icon "Xóa"
 * CHỈ mở popup xác nhận "Xóa bài thực hành?" (Hủy/Xóa) - chưa xóa thật, phải bấm "Xóa" trong popup
 * đó mới xóa. Trước đây `clickPracticeDelete()` dừng lại ở bước mở popup nên bài thực hành vẫn còn
 * nguyên, khiến assertion sau đó (mong đợi đã biến mất) luôn fail. */
export async function clickPracticeDelete(page, sectionName, practiceName) {
  await practiceRow(page, sectionName, practiceName).getByRole("button", { name: po.practiceRowDeleteButton, exact: true }).click();
  // KHÔNG giả định popup này có role="dialog" (modal "Xem" cạnh đó đã xác nhận KHÔNG có) - scope
  // theo div chứa cả title lẫn nút Hủy, cùng kiểu định vị đã dùng cho các card khác trong file này.
  const confirmBox = page.locator("div", { hasText: po.deletePracticeDialogTitle }).filter({ hasText: po.cancelButton }).last();
  await confirmBox.waitFor({ state: "visible", timeout: 10000 });
  await confirmBox.getByRole("button", { name: po.deleteConfirmButton, exact: true }).click();
  await confirmBox.waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
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

// ĐỊNH VỊ THEO VỊ TRÍ, KHÔNG theo `hasText` - 2 ô filter này đổi text hiển thị thành giá trị đã
// chọn sau khi filter (không còn chứa "loại kỳ thi"/"khối lớp" nữa), nên hasText chỉ khớp lúc còn
// placeholder mặc định. Reset/filter-lại-lần-2 (gọi khi ô ĐÃ có giá trị khác mặc định) với hasText
// sẽ khớp 0 phần tử và `.click()` treo tới hết timeout của cả test (xác nhận qua LIST-08 2026-11-04:
// resetExamTypeFilter() treo 90s rồi "Target page, context or browser has been closed").
// Thứ tự DOM cố định trên thanh filter: [search input] [Loại kỳ thi] [Khối lớp] - search dùng
// input thường (không phải .n-base-selection) nên 2 ô dropdown này luôn là index 0 và 1 trong toàn
// trang (ô "X / trang" ở pagination cũng là .n-base-selection nhưng nằm SAU trong DOM). Cùng cách
// định vị theo vị trí đã dùng cho `skillFilterLocator` ở module Section.
const examTypeFilterSelectionLocator = (page) => page.locator(".n-base-selection").nth(0);
const gradeFilterSelectionLocator = (page) => page.locator(".n-base-selection").nth(1);

export async function filterByExamType(page, examTypeName) {
  await examTypeFilterSelectionLocator(page).click();
  const option = page.locator('.n-base-select-option:visible, [role="option"]:visible', { hasText: examTypeName }).first();
  await option.waitFor({ state: "visible", timeout: 10000 });
  await option.click();
  await waitForTableStable(page);
}

/** Bỏ lọc (Loại kỳ thi/Khối lớp), trả dropdown về placeholder mặc định - ĐÃ XÁC NHẬN THẬT qua
 * screenshot LIST-08 2026-11-04: "Tất cả loại kỳ thi"/"Tất cả khối lớp" KHÔNG phải 1 option chọn
 * được trong danh sách mở ra (list chỉ liệt kê tên kỳ thi/khối lớp thật), phải bấm icon "clear"
 * (hiện khi hover vào ô đã có giá trị) để reset - giống hệt hành vi `resetSkillFilter` ở module
 * Section. */
async function clearSelectionFilter(selectionLocator) {
  await selectionLocator.hover();
  await selectionLocator.locator(".n-base-clear, [class*='clear']").first().click();
  await waitForTableStable(selectionLocator.page());
}

export async function resetExamTypeFilter(page) {
  await clearSelectionFilter(examTypeFilterSelectionLocator(page));
}

/** Cuộn qua toàn bộ các lô virtual-scroll để gom hết text option - cùng kỹ thuật `mouse.wheel` đã
 * xác nhận thật ở `selectScoreTable`/`selectSectionToAddToStructure` (xem comment ở đó), nhưng dùng
 * cho mục đích ĐỌC HẾT danh sách thay vì tìm 1 option cụ thể. ĐÃ GẶP THẬT (LIST-11, 2026-11-04):
 * `allInnerTexts()` một lần duy nhất chỉ thấy lô đầu (vd Lớp 1-8), thiếu Lớp 9-12 nằm ngoài viewport
 * virtual list - phải cuộn dồn tích luỹ tới khi hết thay đổi (3 vòng liên tiếp không có text mới). */
async function readAllVirtualScrollOptionTexts(selectionLocator) {
  const page = selectionLocator.page();
  await selectionLocator.click();
  const options = page.locator('.n-base-select-option:visible, [role="option"]:visible');
  await options.first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  const seen = new Set();
  const box = await selectionLocator.boundingBox();
  let stableRounds = 0;
  for (let i = 0; i < 60 && stableRounds < 3; i += 1) {
    const before = seen.size;
    (await options.allInnerTexts()).forEach((t) => seen.add(t));
    stableRounds = seen.size === before ? stableRounds + 1 : 0;
    if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height + 150);
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(120);
  }
  await page.keyboard.press("Escape");
  return Array.from(seen);
}

export async function readExamTypeFilterOptionTexts(page) {
  return readAllVirtualScrollOptionTexts(examTypeFilterSelectionLocator(page));
}

export async function filterByGrade(page, gradeName) {
  await gradeFilterSelectionLocator(page).click();
  const option = page.locator('.n-base-select-option:visible, [role="option"]:visible', { hasText: gradeName }).first();
  await option.waitFor({ state: "visible", timeout: 10000 });
  await option.click();
  await waitForTableStable(page);
}

export async function resetGradeFilter(page) {
  await clearSelectionFilter(gradeFilterSelectionLocator(page));
}

export async function readGradeFilterOptionTexts(page) {
  return readAllVirtualScrollOptionTexts(gradeFilterSelectionLocator(page));
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
//
// DÙNG CHUNG 1 BỘ TÊN CỐ ĐỊNH (KHÔNG gắn runId nữa) - XÁC NHẬN TỒN TẠI TRƯỚC, CHỈ TẠO MỚI NẾU
// CHƯA CÓ (2026-11-04): trước đây mỗi lần chạy suite đều tạo mới + xóa sạch Section/Bảng điểm/Kỳ
// thi riêng theo `runId`, gây tạo/xóa liên tục không cần thiết (những fixture này KHÔNG phải đối
// tượng đang test, chỉ là điều kiện tiên quyết để tạo Đề thi) - giờ dựng 1 LẦN DUY NHẤT trên môi
// trường, các lần chạy sau tái sử dụng nguyên bản ghi cũ. CHỈ Đề thi (đối tượng thật sự đang test,
// vẫn đặt tên theo `runId` ở từng spec file) mới tạo/xóa mỗi lần chạy như cũ.
// ---------------------------------------------------------------------------------------------

const SHARED_FIXTURE_PREFIX = "AUTO-shared-ngan-hang-de-thi";
const SHARED_SECTION_A = `${SHARED_FIXTURE_PREFIX}-secA`;
const SHARED_SECTION_B = `${SHARED_FIXTURE_PREFIX}-secB`;
const SHARED_SCORE_TABLE = `${SHARED_FIXTURE_PREFIX}-bd`;
const SHARED_EXAM_TYPE_WITH_SECTIONS = `${SHARED_FIXTURE_PREFIX}-kt-full`;
const SHARED_EXAM_TYPE_EMPTY = `${SHARED_FIXTURE_PREFIX}-kt-empty`;

async function ensureSharedSection(page, baseUrl, name, skill, duration) {
  const { searchSections, sectionRow } = await import("../../quan_ly_section/navigation/cmsSectionPageObjects.js");
  await page.goto(`${baseUrl}/exam-prep/sections`, { waitUntil: "networkidle" });
  await searchSections(page, name);
  if ((await sectionRow(page, name).count()) === 0) {
    await createSection(page, { name, skill, duration });
  }
}

async function ensureSharedScoreTable(page, baseUrl, name) {
  const { searchScoreTables, scoreTableRow } = await import("../../cau_hinh_bang_diem/navigation/cmsScoreTablePageObjects.js");
  await page.goto(`${baseUrl}/exam-prep/score-tables`, { waitUntil: "networkidle" });
  await searchScoreTables(page, name);
  if ((await scoreTableRow(page, name).count()) === 0) {
    await createScoreTable(page, { name, description: `${name} score table` });
  }
}

async function ensureSharedExamTypeEmpty(page, baseUrl, name) {
  await gotoKyThi(page, baseUrl);
  await searchKyThi(page, name);
  if ((await kyThiRow(page, name).count()) === 0) {
    await createKyThi(page, { name });
  }
}

async function ensureSharedExamTypeWithSections(page, baseUrl, name, sectionA, sectionB) {
  await gotoKyThi(page, baseUrl);
  await searchKyThi(page, name);
  if ((await kyThiRow(page, name).count()) === 0) {
    await createKyThi(page, { name });
    await openEditKyThiPopupInner(page, name);
    await attachSectionToKyThi(page, `${sectionA} (Nghe)`);
    await attachSectionToKyThi(page, `${sectionB} (Nói)`);
    await saveKyThiPopup(page);
  }
}

/**
 * Đảm bảo có sẵn 2 Section + 1 Bảng điểm + 2 Kỳ thi (1 kỳ thi ĐÃ gắn sẵn 2 section vào "Cấu hình
 * đề xuất" để test STRUCT-02/EDIT-04, 1 kỳ thi HOÀN TOÀN trống để test STRUCT-01/EDIT-05) - TÁI SỬ
 * DỤNG nếu đã tồn tại từ lần chạy trước (xem ghi chú "DÙNG CHUNG 1 BỘ TÊN CỐ ĐỊNH" ở trên), chỉ tạo
 * mới nếu chưa có. `runId` (tham số cũ) KHÔNG còn dùng để đặt tên fixture nữa - giữ lại tham số chỉ
 * để KHÔNG phải sửa mọi lệnh gọi cũ `setupDeThiFixtures(page, baseUrl, runId)` ở các spec file.
 */
export async function setupDeThiFixtures(page, baseUrl, _runIdUnused) {
  await ensureSharedSection(page, baseUrl, SHARED_SECTION_A, "Nghe", 10);
  await ensureSharedSection(page, baseUrl, SHARED_SECTION_B, "Nói", 15);
  await ensureSharedScoreTable(page, baseUrl, SHARED_SCORE_TABLE);
  await ensureSharedExamTypeEmpty(page, baseUrl, SHARED_EXAM_TYPE_EMPTY);
  await ensureSharedExamTypeWithSections(page, baseUrl, SHARED_EXAM_TYPE_WITH_SECTIONS, SHARED_SECTION_A, SHARED_SECTION_B);

  return {
    sectionA: SHARED_SECTION_A,
    sectionB: SHARED_SECTION_B,
    scoreTable: SHARED_SCORE_TABLE,
    examTypeWithSections: SHARED_EXAM_TYPE_WITH_SECTIONS,
    examTypeEmpty: SHARED_EXAM_TYPE_EMPTY,
  };
}

/** Dọn dẹp SAU 1 lượt chạy test - CHỈ xóa Đề thi do spec file tự tạo (đối tượng thật sự đang test,
 * vẫn đặt tên theo `runId` nên không trùng giữa các lần chạy). KHÔNG còn xóa Kỳ thi/Section/Bảng
 * điểm dùng chung nữa (xem ghi chú "DÙNG CHUNG 1 BỘ TÊN CỐ ĐỊNH" ở `setupDeThiFixtures`) - những
 * fixture này được GIỮ LẠI để lần chạy sau tái sử dụng, không tạo/xóa lại mỗi lần. `fixtures` (tham
 * số cũ) KHÔNG còn dùng nhưng giữ lại để không phải sửa mọi lệnh gọi cũ. */
export async function teardownDeThiFixtures(page, baseUrl, _fixturesUnused, examNamesToDelete = []) {
  await gotoDeThi(page, baseUrl);
  for (const name of examNamesToDelete) {
    await deleteDeThiByName(page, name).catch(() => {});
  }
}
