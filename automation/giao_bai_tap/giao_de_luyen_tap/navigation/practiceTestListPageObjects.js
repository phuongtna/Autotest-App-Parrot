/**
 * Page Objects cho tab "Giao đề luyện tập" (Web GV, `/teacher/exercise?tab=practice`) - tính năng
 * MỚI, SIBLING của "Bài tập đã giao" (automation/giao_bai_tap/navigation/teacherAssignedListPageObjects.js)
 * nhưng tách riêng thư mục theo đúng quy ước đã nêu ở teacherPortalPageObjects.js ("tách biệt code
 * của tính năng mới, không lẫn vào page object dùng chung của Giao bài tập"). Phần cơ chế DÙNG
 * CHUNG (combobox lọc lớp/thời gian, phân trang, "Xem báo cáo") được TÁI SỬ DỤNG trực tiếp từ
 * teacherAssignedListPageObjects.js (re-export cuối file) - KHÔNG copy-paste - vì cấu trúc DOM
 * giống hệt, đã xác nhận thật qua discovery (xem dưới).
 *
 * ĐÃ XÁC NHẬN THẬT (2026-11-02, discovery DOM dump thật qua
 * automation/giao_bai_tap/giao_de_luyen_tap/practiceTestDiscovery.mjs + lệnh node ad-hoc, môi
 * trường DEV https://parrotedu.codeinet.com, tài khoản GV "Phương" SĐT 0915315315 - ĐÃ CÓ SẴN
 * trong .env là TEACHER_USERNAME_SPEAKING_REPORT/TEACHER_PASSWORD_SPEAKING_REPORT, dùng lại nguyên
 * cặp tài khoản đó, KHÔNG phải TEACHER_USERNAME/PASSWORD mặc định - tài khoản mặc định KHÔNG đăng
 * nhập được trên DEV. Tính năng "Giao đề luyện tập" CHƯA tồn tại trên production/staging tại thời
 * điểm xác nhận - chỉ thấy trên DEV):
 *   - Vào từ sidebar "Giao bài tập" -> trang "/teacher/exercise" có breadcrumb/heading "Giao bài"
 *     + 2 tab thật (role="tab", tablist role="tablist"): "Giao bài tập" (mặc định, aria-controls
 *     kết thúc "-content-exercise") / "Giao đề luyện tập" (aria-controls kết thúc
 *     "-content-practice"). Bấm tab "Giao đề luyện tập" để chuyển - KHÔNG đổi URL path, chỉ đổi
 *     nội dung tab (page.goto trực tiếp kèm "?tab=practice" cũng vào thẳng được tab này).
 *   - Heading "Danh sách đề luyện tập đã giao (N)". Nút tạo mới là <button> (role="button", text
 *     CHÍNH XÁC "Giao đề luyện tập" - PHÂN BIỆT với tab cùng tên qua role khác nhau: tab có
 *     role="tab", nút có role="button") - bấm mở ĐÚNG "/teacher/exercise/practice/add" (breadcrumb
 *     "Giao bài / Danh sách đề luyện tập đã giao / Giao đề luyện tập"), không lẫn sang form
 *     "Giao bài tập".
 *   - Cột bảng: Lớp / Đề luyện tập / Hạn nộp / HS đã làm / Điểm TB / Hành động (khác "Bài tập" ở
 *     cột thứ 2 của màn kia) - cùng cấu trúc `<table tbody tr><td>` nên mọi hàm đọc theo index cột
 *     của teacherAssignedListPageObjects.js dùng lại được nguyên vẹn.
 *   - Ô tìm kiếm placeholder "Tìm theo tên đề luyện tập" (khác "Tìm theo tên bài tập") - CHƯA xác
 *     nhận lại hành vi "phải bấm Enter" riêng cho màn này (giả định giống màn bài tập vì cùng 1 bộ
 *     component input tìm kiếm - sẽ tự lộ ra qua network log nếu khác khi chạy flow thật).
 *   - Cột "Hạn nộp": dòng ngày dd/mm/yyyy + span nhãn trạng thái ngay dưới, ĐÃ THẤY THẬT 4 giá trị
 *     text gốc trong HTML (chữ thường, hiển thị HOA do CSS `uppercase` - `page.innerText()` của
 *     Playwright trả về bản ĐÃ áp dụng text-transform, đọc được y hệt UI thật):
 *     "Còn N ngày" / "Đến hạn" / "Quá hạn" / "Chưa giao". Khi "Chưa giao": cột "HS đã làm"/"Điểm
 *     TB" hiển thị "-", KHÔNG có link "Xem báo cáo" (dòng chưa kích hoạt - khớp giả định nêu ở
 *     sheet "Ghi chú & Giả định" của TESTCASES.xlsx, SORT-01).
 *   - Link tên đề (cột "Đề luyện tập") trỏ "/teacher/exercise/practice/{id}/edit" (CÓ thêm đoạn
 *     "/practice/" - KHÁC href "/teacher/exercise/{id}/edit" của bài tập). Link "Xem báo cáo" trỏ
 *     "/teacher/exercise/{id}/report" (giống hệt bài tập, KHÔNG có "/practice/").
 *   - Trang "/edit": breadcrumb+heading "Chỉnh sửa đề luyện tập". Field "Giao tới lớp" mọi checkbox
 *     đều `disabled` (kể cả lớp đã chọn sẵn, chỉ khác style active) - CHỈ "Hạn nộp" sửa được, đúng
 *     acceptance criteria, giống hệt cơ chế màn bài tập. Nút lưu text "Giao đề đã chọn" (khác "Giao
 *     bài đã chọn"). Nút xóa icon-only `button[title="Xóa"]` (CÙNG selector màn bài tập). Dialog
 *     xác nhận (role="dialog"): title "Xóa đề luyện tập", message "Bạn có chắc chắn muốn xóa đề
 *     luyện tập không?", 2 nút "Hủy"/"Xóa" (exact text) - ĐÃ THỬ CLICK THẬT nút Xóa rồi bấm "Hủy"
 *     ngay (KHÔNG xác nhận xóa) để xác nhận đúng dialog này, không làm mất dữ liệu thật nào trên
 *     DEV.
 */
import { config, resolveTeacherPortalBaseUrl } from "../../../src/config.js";
import { setDueDateViaPopover } from "../../navigation/dueDatePopover.js";
import { AssignedRowNotFoundError } from "../../navigation/teacherAssignedListPageObjects.js";

export {
  widenDateRangeFilter,
  listClassFilterOptions,
  filterByClass,
  locateAssignedRowAcrossPages,
  locateAssignedRow,
  openRowReport,
  AssignedRowNotFoundError,
} from "../../navigation/teacherAssignedListPageObjects.js";

export class PracticeTestNavigationError extends Error {}

/** Tài khoản GV + môi trường DUY NHẤT đã xác nhận thật có tính năng này (xem docblock đầu file) -
 * TÁI SỬ DỤNG nguyên cặp config có sẵn (KHÔNG thêm biến .env mới) vì đúng là 1 tài khoản, chỉ khác
 * mục đích dùng trước đây (automation/bao_cao_speaking/). */
export function resolvePracticeTestDevCredentials() {
  return {
    baseUrl: resolveTeacherPortalBaseUrl("dev"),
    username: config.teacherUsernameSpeakingReport,
    password: config.teacherPasswordSpeakingReport,
  };
}

export const practiceTestListPageObjects = {
  tabs: {
    homeworkTab: "Giao bài tập",
    practiceTab: "Giao đề luyện tập",
  },
  createButton: "Giao đề luyện tập",
  searchPlaceholder: "Tìm theo tên đề luyện tập",
  listHeadingPrefix: "Danh sách đề luyện tập đã giao",
  statusLabels: {
    dueSoon: /^Còn \d+ ngày$/i,
    dueToday: /^Đến hạn$/i,
    overdue: /^Quá hạn$/i,
    notYetAssigned: /^Chưa giao$/i,
  },
  editPage: {
    breadcrumb: "Chỉnh sửa đề luyện tập",
    saveButton: "Giao đề đã chọn",
    deleteIconButtonSelector: 'button[title="Xóa"]',
  },
  deleteConfirmDialog: {
    title: "Xóa đề luyện tập",
    confirmButton: "Xóa",
    cancelButton: "Hủy",
  },
  createPage: {
    breadcrumb: "Giao đề luyện tập",
    saveButton: "Giao đề đã chọn",
  },
};

/** Locator chỉ khớp các <tr> DỮ LIỆU THẬT trong bảng - LOẠI TRỪ dòng thông báo rỗng ("Không tìm
 * thấy bài tập phù hợp.") khi search/filter không có kết quả.
 *
 * ĐÃ XÁC NHẬN THẬT (2026-11-02, debug DOM dump thật): bảng rỗng vẫn render ĐÚNG 1 `<tr>` nhưng bên
 * trong là 1 `<td colspan="6">` chứa câu thông báo (không có `colspan` ở dòng dữ liệu thật, mỗi
 * dòng thật có đúng 6 `<td>` riêng biệt theo 6 cột) - đếm `table tbody tr` trần sẽ đếm NHẦM dòng
 * thông báo này là 1 dòng dữ liệu (lỗi thật đã gặp khi viết SEARCH-04, xem
 * runtime/searchByNameFlow.js). Dùng locator này ở MỌI chỗ cần đếm/đọc dòng dữ liệu thay vì
 * `table tbody tr` trần.
 */
export function realDataRows(page) {
  return page.locator("table tbody tr").filter({ hasNot: page.locator("td[colspan]") });
}

/** Vào tab "Giao đề luyện tập" từ bất kỳ trang nào trong teacher-portal (bấm menu sidebar "Giao
 * bài tập" nếu chưa ở trang "/teacher/exercise", rồi bấm tab "Giao đề luyện tập"). */
export async function gotoPracticeTestList(page) {
  const onExercisePage = /\/teacher\/exercise(\?|$)/.test(page.url());
  if (!onExercisePage) {
    await page.getByText(practiceTestListPageObjects.tabs.homeworkTab, { exact: false }).first().click();
    await page.waitForLoadState("networkidle").catch(() => {});
  }
  await page.getByRole("tab", { name: practiceTestListPageObjects.tabs.practiceTab }).click();
  await page
    .getByText(practiceTestListPageObjects.listHeadingPrefix, { exact: false })
    .first()
    .waitFor({ timeout: 15000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.locator("table tbody tr").first().waitFor({ timeout: 20000 }).catch(() => {});
}

/** Gõ vào ô "Tìm theo tên đề luyện tập" rồi bấm Enter - theo đúng cơ chế đã xác nhận thật ở màn
 * bài tập (searchByItemName trong teacherAssignedListPageObjects.js), CHƯA xác nhận lại riêng cho
 * màn này (xem docblock đầu file) nhưng cùng 1 bộ component input. */
export async function searchByItemName(page, itemName) {
  const searchBox = page.getByPlaceholder(practiceTestListPageObjects.searchPlaceholder);
  await searchBox.fill(itemName);
  await searchBox.press("Enter");
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(500);
}

/** Bấm vào TÊN đề (cột "Đề luyện tập") của 1 dòng đã định vị - điều hướng sang
 * "/teacher/exercise/practice/{id}/edit". */
export async function openRowEdit(page, row) {
  await row.locator("a[href*='/practice/'][href*='/edit']").click();
  await page
    .getByText(practiceTestListPageObjects.editPage.breadcrumb, { exact: true })
    .first()
    .waitFor({ timeout: 15000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

/** Đổi "Hạn nộp" trên trang "/edit" đang mở rồi bấm "Giao đề đã chọn" (Lưu) - chờ breadcrumb
 * "Chỉnh sửa đề luyện tập" biến mất làm bằng chứng đã điều hướng rời trang (đã lưu). */
export async function editDueDateAndSave(page, { day, month }) {
  const trigger = page
    .getByText("Hạn nộp", { exact: true })
    .locator("xpath=following::*[@aria-haspopup='menu'][1]");
  await setDueDateViaPopover(page, trigger, { day, month });

  await page.getByRole("button", { name: practiceTestListPageObjects.editPage.saveButton }).click();
  await page
    .getByText(practiceTestListPageObjects.editPage.breadcrumb, { exact: true })
    .first()
    .waitFor({ state: "hidden", timeout: 15000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

/** Bấm nút icon "Xóa" trên trang "/edit" đang mở -> mở dialog xác nhận "Xóa đề luyện tập", trả về
 * locator dialog để caller tự quyết định Xóa (confirmDeleteDialog) hay Hủy (cancelDeleteDialog). */
export async function openDeleteDialog(page) {
  await page.locator(practiceTestListPageObjects.editPage.deleteIconButtonSelector).click();
  const dialog = page.getByRole("dialog").filter({ hasText: practiceTestListPageObjects.deleteConfirmDialog.title });
  await dialog.waitFor({ state: "visible", timeout: 10000 });
  return dialog;
}

export async function confirmDeleteDialog(page, dialog) {
  await dialog
    .getByRole("button", { name: practiceTestListPageObjects.deleteConfirmDialog.confirmButton, exact: true })
    .click();
  await dialog.waitFor({ state: "hidden", timeout: 15000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

export async function cancelDeleteDialog(page, dialog) {
  await dialog
    .getByRole("button", { name: practiceTestListPageObjects.deleteConfirmDialog.cancelButton, exact: true })
    .click();
  await dialog.waitFor({ state: "hidden", timeout: 15000 });
}

/** Xóa thẳng 1 đề luyện tập (mở dialog + xác nhận) - gộp openDeleteDialog+confirmDeleteDialog cho
 * các flow chỉ cần xóa, không cần quan sát riêng dialog (vd cleanup sau AC-01). */
export async function deleteFromEditPage(page) {
  const dialog = await openDeleteDialog(page);
  await confirmDeleteDialog(page, dialog);
}

/** Bấm nút "+ Giao đề luyện tập" (role="button", PHÂN BIỆT với tab cùng tên qua role) để mở màn
 * tạo mới "/teacher/exercise/practice/add". */
export async function openCreatePracticeTest(page) {
  await page.getByRole("button", { name: practiceTestListPageObjects.createButton, exact: true }).click();
  await page.waitForURL(/\/teacher\/exercise\/practice\/add/, { timeout: 15000 });
  await page
    .getByRole("heading", { name: practiceTestListPageObjects.createPage.breadcrumb })
    .first()
    .waitFor({ timeout: 15000 })
    .catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
}

/** Định vị 1 dòng bằng className+title+dueDateLine - DÙNG SEARCH thay vì lật trang danh sách mặc
 * định (2 tuần, ~70+ dòng/3 trang trên tài khoản DEV dùng chung, liên tục có dữ liệu mới) - ĐÃ XÁC
 * NHẬN THẬT (2026-11-02, FAIL thật xác nhận qua 2 lượt chạy): `locateAssignedRowAcrossPages` quét
 * CHẬM và có thể bỏ sót dòng vừa tạo dù dòng đó CÓ THẬT. Search theo ĐÚNG tên đề thu hẹp kết quả về
 * rất ít dòng trên TRANG 1 trước khi so khớp className+dueDateLine - nhanh và ổn định hơn hẳn.
 *
 * ĐÃ XÁC NHẬN THẬT: ngay sau toast "Đã giao ... thành công", dòng mới có thể CHƯA lập tức xuất hiện
 * qua search (độ trễ propagate/index ngắn phía backend, dòng đó CÓ THẬT) - mặc định retry tối đa 5
 * lần, cách nhau 1.5s, trước khi coi là không tìm thấy thật.
 *
 * TÁI SỬ DỤNG chung cho mọi flow ghi dữ liệu thật trên "Giao đề luyện tập" (multiClassAndDeleteFlow,
 * submitFlow, editFlow, acFlow, deleteFlow) - KHÔNG copy-paste lại logic này lần nữa. */
export async function locateRowViaSearch(page, { className, title, dueDateLine }, { retries = 5, retryDelayMs = 1500 } = {}) {
  let lastCount = 0;
  for (let attempt = 1; attempt <= retries; attempt++) {
    await gotoPracticeTestList(page);
    await searchByItemName(page, title);
    const row = page
      .locator("table tbody tr", { hasText: className })
      .filter({ hasText: title })
      .filter({ hasText: dueDateLine });
    lastCount = await row.count();
    if (lastCount === 1) return row.first();
    if (attempt < retries) await page.waitForTimeout(retryDelayMs);
  }
  throw new AssignedRowNotFoundError(
    `locateRowViaSearch: tìm thấy ${lastCount} dòng khớp lớp="${className}" + bài="${title}" + hạn nộp="${dueDateLine}" (cần đúng 1) sau khi search, đã thử lại ${retries} lần.`,
  );
}

/** Kiểm tra 1 dòng (className+title+dueDateLine) còn tồn tại trên danh sách hay không - wrapper
 * tiện dụng quanh `locateRowViaSearch` cho các flow cleanup. */
export async function rowStillExists(page, { className, title, dueDateLine }) {
  try {
    await locateRowViaSearch(page, { className, title, dueDateLine });
    return true;
  } catch (err) {
    if (err instanceof AssignedRowNotFoundError) return false;
    throw err;
  }
}
