/**
 * Page Objects cho màn "Danh sách bài tập đã giao" (Web GV) + trang "Chỉnh sửa bài tập"
 * (/teacher/exercise/{id}/edit) - dùng bởi runtime/assignedListLifecycleFlow.js.
 *
 * ĐÃ XÁC NHẬN THẬT (2026-08-27, debug DOM dump/screenshot thật, tài khoản GV "Phương"): xem
 * comment chi tiết tại teacherPortalPageObjects.js#editPage/#deleteConfirmDialog.
 */
import { teacherPortalPageObjects as po } from "./teacherPortalPageObjects.js";
import { setDueDateViaPopover } from "./dueDatePopover.js";

export class AssignedRowNotFoundError extends Error {}

/** Vào màn "Danh sách bài tập đã giao" từ bất kỳ trang nào (bấm menu sidebar "Giao bài tập" -
 * hoạt động cả khi đang ở trang khác vì menu luôn hiển thị, ĐÃ XÁC NHẬN THẬT dùng lại được ở
 * nhiều flow khác trong file này). */
export async function gotoAssignedList(page) {
  await page.getByText(po.menu.menuItem, { exact: false }).first().click();
  await page.getByText("Danh sách bài tập đã giao", { exact: false }).waitFor({ timeout: 15000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  // ĐÃ XÁC NHẬN THẬT (2026-08-27): heading "Danh sách bài tập đã giao" hiển thị TRƯỚC khi bảng
  // fetch xong dữ liệu thật (có thể thấy "(0)" + spinner "Hãy chờ trong giây lát..." một nhịp) -
  // chờ thêm ĐÚNG 1 dòng <tr> thật xuất hiện trước khi trả về, để các bước gọi sau (locate row)
  // không đọc phải bảng rỗng/đang tải.
  await page.locator("table tbody tr").first().waitFor({ timeout: 20000 }).catch(() => {});
}

/** Đổi filter phạm vi thời gian (mặc định "2 tuần gần nhất") sang "1 tháng gần nhất" - ĐÃ XÁC
 * NHẬN THẬT (2026-08-27, debug DOM dump): mặc định có thể ra 0 dòng ngay sau khi giao (phụ thuộc
 * hạn nộp rơi ngoài "2 tuần gần nhất"), "1 tháng gần nhất" đủ rộng để luôn thấy dòng vừa tạo/sửa
 * trong phạm vi test của repo này (hạn nộp luôn đặt trong vài tuần tới).
 *
 * SỬA (2026-08-27, FAIL thật xác nhận qua chạy live openStudentResultFlow.js): bản cũ click vào
 * option qua `getByText(...).first()` (KHÔNG scope trong listbox) rồi swallow lỗi bằng
 * `.catch(()=>{})` - khi click không trúng đúng option (vd bị element khác che), listbox vẫn ở
 * trạng thái MỞ (che kín `<html>`, chặn pointer events của MỌI thao tác click sau đó trong toàn
 * bộ flow) mà không có lỗi nào lộ ra (bị nuốt), rất khó truy nguyên. SỬA: scope option trong đúng
 * `listbox` (giống cách resolveAndSelectUnit/listClassFilterOptions đã làm đúng), KHÔNG nuốt lỗi,
 * và LUÔN bấm Escape sau cùng để đảm bảo dropdown đóng lại dù chọn được hay không - không để lại
 * overlay treo ảnh hưởng bước sau. */
export async function widenDateRangeFilter(page) {
  const rangeDropdown = page.getByRole("combobox").last();
  if (!(await rangeDropdown.count())) return;
  try {
    await rangeDropdown.click();
    const listbox = page.getByRole("listbox");
    await listbox.waitFor({ state: "visible", timeout: 5000 });
    const widest = listbox.getByText("1 tháng gần nhất", { exact: true });
    if (await widest.count()) {
      await widest.click();
      await page.waitForTimeout(1000);
    }
  } finally {
    await page.keyboard.press("Escape").catch(() => {});
  }
}

/** Gõ vào ô "Tìm theo tên bài tập" rồi bấm Enter để lọc danh sách.
 *
 * SỬA (2026-08-27, đã hiểu SAI trước đó): lượt điều tra đầu tiên chỉ gọi `fill()` rồi chờ, kết
 * luận nhầm là "ô search không hoạt động" (0 network request mới). User chỉ ra ĐÚNG: ô này CHỦ
 * ĐỘNG yêu cầu bấm Enter để submit (không phải live-search theo từng ký tự) - `fill()` một mình
 * chỉ cập nhật giá trị input, không tự trigger tìm kiếm. ĐÃ XÁC NHẬN THẬT lại (2026-08-27, network
 * capture sạch): `fill()` + `press("Enter")` gọi ĐÚNG 1 request mới
 * `GET .../room.json?...&search=<tên đã gõ>`, danh sách lọc đúng còn lại các dòng khớp tên. Không
 * còn @deprecated - dùng an toàn được, xem thêm locateAssignedRowAcrossPages() nếu cần định vị
 * chắc chắn 1 dòng cụ thể khi title không unique (search chỉ lọc theo tên, không phân biệt được
 * 2 assignment trùng tên).
 */
export async function searchByItemName(page, itemName) {
  const searchBox = page.getByPlaceholder("Tìm theo tên bài tập");
  await searchBox.fill(itemName);
  await searchBox.press("Enter");
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(500);
}

/** Dropdown lọc lớp học ("Tất cả các lớp") - Radix Select thật (role="combobox", cùng cấu trúc
 * với dropdown thời gian ở widenDateRangeFilter, chỉ khác trigger text). ĐÃ XÁC NHẬN THẬT
 * (2026-08-27): option list CHÍNH XÁC là các lớp thật đang thuộc tài khoản GV đang đăng nhập (vd
 * "Tất cả các lớp","2A","3B","7QA-ReRun-0820","7QA-Test") - không hardcode, đọc trực tiếp từ
 * listbox thật mỗi lần gọi. */
export async function listClassFilterOptions(page) {
  const trigger = page.getByRole("combobox").first();
  await trigger.click();
  const listbox = page.getByRole("listbox");
  await listbox.waitFor({ state: "visible", timeout: 10000 });
  const options = (await listbox.getByRole("option").allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  // Đóng lại dropdown (không chọn gì) để không đổi filter hiện tại - bấm Escape thay vì click ra
  // ngoài (an toàn hơn, không phụ thuộc toạ độ).
  await page.keyboard.press("Escape");
  return options;
}

/** Chọn 1 lớp cụ thể trong dropdown "Tất cả các lớp" - ĐÃ XÁC NHẬN THẬT (2026-08-27, network
 * capture): chọn xong gọi lại `GET .../room.json?...&class_id=<id thật của lớp>...` và bảng chỉ
 * còn dòng của ĐÚNG lớp đó. `className` phải khớp CHÍNH XÁC 1 option thật (xem
 * listClassFilterOptions) - không đoán/không tự sinh tên. */
export async function filterByClass(page, className) {
  // Vị trí (combobox ĐẦU TIÊN trên trang, đứng trước dropdown thời gian - xem
  // widenDateRangeFilter dùng `.last()` cho dropdown thời gian) - KHÔNG dùng `hasText` như trước
  // (SỬA 2026-08-27: text hiển thị trên trigger đổi thành TÊN LỚP đã chọn sau lần filter đầu, nếu
  // gọi lại hàm này lần 2 để đổi sang lớp khác thì `hasText: /lớp/i` không còn khớp nữa).
  const trigger = page.getByRole("combobox").first();
  await trigger.click();
  const listbox = page.getByRole("listbox");
  await listbox.waitFor({ state: "visible", timeout: 10000 });
  await listbox.getByRole("option", { name: className, exact: true }).click();
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(500);
}

/** Lật qua các trang (nút số "1"/"2"/"3"... - ĐÃ XÁC NHẬN THẬT 2026-08-27, KHÔNG phải nút mũi tên
 * prev/next vì 2 nút đó không có text để định vị chắc chắn) tìm dòng khớp className+itemName+
 * dueDateLine, dừng ngay khi thấy. Dùng khi cần quét TOÀN BỘ danh sách hoặc khi title có thể trùng
 * giữa nhiều assignment (search theo tên - xem searchByItemName - không phân biệt được 2 dòng
 * trùng tên, chỉ lọc theo tên). Không phụ thuộc filter phạm vi thời gian (chỉ cần dueDateLine nằm
 * trong "2 tuần gần nhất" mặc định - xem ghi chú ở caller). Throw AssignedRowNotFoundError nếu lật
 * hết maxPages mà không thấy. */
export async function locateAssignedRowAcrossPages(page, { className, itemName, dueDateLine, maxPages = 8 }) {
  for (let pageIndex = 1; pageIndex <= maxPages; pageIndex++) {
    try {
      return await locateAssignedRow(page, { className, itemName, dueDateLine });
    } catch (err) {
      if (!(err instanceof AssignedRowNotFoundError)) throw err;
    }
    // ĐÃ SỬA (2026-08-27, FAIL thật xác nhận qua debug screenshot: nút số trang "2"/"3"/"4" hiển
    // thị rõ trên UI nhưng `getByRole("button", {name, exact:true})` KHÔNG khớp - accessible name
    // của nút này không phải chỉ là số trần, có thể do nội dung con/label khác. Đổi sang lọc
    // `<button>` bằng `hasText` regex neo đầu-cuối (khớp innerText, không phụ thuộc accessible
    // name) - ổn định hơn.
    const nextPageButton = page.locator("button").filter({ hasText: new RegExp(`^${pageIndex + 1}$`) });
    if (!(await nextPageButton.count())) {
      throw new AssignedRowNotFoundError(
        `locateAssignedRowAcrossPages: đã quét hết ${pageIndex} trang, không tìm thấy dòng khớp ` +
          `lớp="${className}" + bài="${itemName}" + hạn nộp="${dueDateLine}".`,
      );
    }
    await nextPageButton.click();
    await page.waitForTimeout(800);
    await page.waitForLoadState("networkidle").catch(() => {});
  }
  throw new AssignedRowNotFoundError(
    `locateAssignedRowAcrossPages: đã quét hết ${maxPages} trang (giới hạn) mà không tìm thấy.`,
  );
}

/**
 * Định vị ĐÚNG 1 dòng trong bảng "Bài tập đã giao" khớp className + itemName + dueDateLine (cùng
 * heuristic đã xác nhận thật trong automation/giao_bai_tap/reportDiscovery.mjs - tên bài KHÔNG
 * đủ phân biệt, phải cộng thêm lớp + hạn nộp). Throw AssignedRowNotFoundError nếu không khớp
 * đúng 1 dòng (0 hoặc nhiều đều là lỗi thật cần biết, không đoán).
 *
 * @param {import('playwright').Page} page
 * @param {{ className: string, itemName: string, dueDateLine: string }} params
 * @returns {Promise<import('playwright').Locator>}
 */
export async function locateAssignedRow(page, { className, itemName, dueDateLine }) {
  const row = page
    .locator("table tbody tr", { hasText: className })
    .filter({ hasText: itemName })
    .filter({ hasText: dueDateLine });
  const count = await row.count();
  if (count !== 1) {
    throw new AssignedRowNotFoundError(
      `locateAssignedRow: tìm thấy ${count} dòng khớp lớp="${className}" + bài="${itemName}" + ` +
        `hạn nộp="${dueDateLine}" (cần đúng 1) - BLOCKED, không đoán/không bấm nhầm dòng khác.`,
    );
  }
  return row.first();
}

/** Bấm "Xem báo cáo" (= "Xem chi tiết" trong mô tả flow của GV) của 1 dòng đã định vị - điều
 * hướng sang trang report (/teacher/exercise/{id}/report), chờ trang tải xong.
 *
 * SỬA (2026-08-27, FAIL thật xác nhận qua debug: URL ngay sau click dừng ở "/teacher/exercise"
 * CỤT trong ~500ms-2s trước khi tự hoàn tất thành "/teacher/exercise/{id}/report" - route
 * client-side có trạng thái pending tạm thời, KHÔNG sinh đủ network activity để `waitForLoadState
 * ("networkidle")` phát hiện đang điều hướng dở). Dùng `waitForURL` chờ ĐÚNG URL cuối cùng thay vì
 * suy đoán qua networkidle. */
export async function openRowReport(page, row) {
  await row.getByText("Xem báo cáo", { exact: true }).click();
  await page.waitForURL(/\/teacher\/exercise\/.+\/report/, { timeout: 15000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

/** Bấm vào TÊN bài (cột "BÀI TẬP") của 1 dòng đã định vị - đây CHÍNH là hành động "Sửa" (không có
 * nút "Sửa" riêng) - điều hướng sang trang "/edit", chờ tiêu đề "Chỉnh sửa bài tập" hiển thị để
 * xác nhận đã vào đúng trang.
 *
 * SỬA (2026-08-27, xác nhận thật qua lỗi strict-mode thật của Playwright): text "Chỉnh sửa bài
 * tập" xuất hiện HAI LẦN trên trang (breadcrumb + heading <h1> riêng) - `getByText(...).waitFor()`
 * KHÔNG tự thu hẹp về 1 phần tử như `.click()` (Playwright chỉ auto-strict-check khi thao tác
 * hành động thật), throw "strict mode violation" nếu dùng trực tiếp. Luôn thêm `.first()`. */
export async function openRowEdit(page, row) {
  await row.locator("a[href*='/edit']").click();
  await page.getByText(po.editPage.breadcrumb, { exact: true }).first().waitFor({ timeout: 15000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

/** Đổi "Hạn nộp" trên trang "/edit" đang mở (dùng lại chính xác cơ chế popover đã xác nhận thật ở
 * form tạo mới - xem dueDatePopover.js) rồi bấm "Giao bài đã chọn" (đóng vai trò Lưu ở trang này)
 * - chờ điều hướng trở lại danh sách (tiêu đề "Chỉnh sửa bài tập" biến mất) làm bằng chứng đã lưu
 * thành công (CHƯA xác nhận có toast riêng cho hành động Sửa hay dùng chung toast "Giao bài tập
 * mới thành công" của form tạo mới - dùng tín hiệu điều hướng, chắc chắn hơn). Cùng lý do cần
 * `.first()` như openRowEdit ở trên (text xuất hiện 2 lần). */
export async function editDueDateAndSave(page, { day, month }) {
  const trigger = page
    .getByText(po.editPage.dueDateLabel, { exact: true })
    .locator("xpath=following::*[@aria-haspopup='menu'][1]");
  await setDueDateViaPopover(page, trigger, { day, month });

  await page.getByRole("button", { name: po.editPage.saveButton }).click();
  await page
    .getByText(po.editPage.breadcrumb, { exact: true })
    .first()
    .waitFor({ state: "hidden", timeout: 15000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

/** Bấm nút icon "Xóa" (title="Xóa") trên trang "/edit" đang mở -> xác nhận dialog "Xóa bài tập"
 * (exact text nút, KHÔNG regex lỏng - xem cảnh báo lịch sử trong teacherPortalPageObjects.js). */
export async function deleteFromEditPage(page) {
  await page.locator(po.editPage.deleteIconButtonSelector).click();
  const dialog = page.getByRole("dialog").filter({ hasText: po.deleteConfirmDialog.title });
  await dialog.waitFor({ state: "visible", timeout: 10000 });
  await dialog.getByRole("button", { name: po.deleteConfirmDialog.confirmButton, exact: true }).click();
  await dialog.waitFor({ state: "hidden", timeout: 15000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}
