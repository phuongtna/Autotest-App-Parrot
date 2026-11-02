/**
 * Page Objects cho màn "Giao đề luyện tập" (form TẠO MỚI `/teacher/exercise/practice/add` VÀ form
 * "Chỉnh sửa đề luyện tập" `/teacher/exercise/practice/{id}/edit` - 2 màn dùng chung gần như y hệt
 * 1 bộ component, chỉ khác vài field bị khóa ở màn sửa) - phục vụ bộ testcase ASSIGN-x / AC-x
 * (TESTCASES-giao-de-1.xlsx), SIBLING của practiceTestListPageObjects.js (màn danh sách).
 *
 * ĐÃ XÁC NHẬN THẬT (2026-11-02, discovery DOM thật qua assignFormDiscovery.mjs +
 * assignFormDiscovery2.mjs + nhiều lệnh node ad-hoc, môi trường/tài khoản xem
 * resolvePracticeTestDevCredentials() trong practiceTestListPageObjects.js):
 *
 *   - "Nguồn đề luyện tập": 2 `<input type="radio" name="practice-source">`, value="parrot" (mặc
 *     định checked, LUÔN checked - KHÔNG có cách bấm đổi qua "personal" trong UI) / value="personal"
 *     (LUÔN `disabled` - đúng tag "[PENDING]"/"(sắp ra mắt)" ở UI, xác nhận ASSIGN-SOURCE-03 chỉ là
 *     khung chờ tính năng, chưa thể test thật).
 *   - "Giao tới lớp": y hệt cơ chế đã dùng ở multiClassAndDeleteFlow.js (label bọc
 *     `input[type="checkbox"]`, click label để toggle) - ĐÃ XÁC NHẬN THÊM: chọn 1 lớp sẽ
 *     DISABLE (không phải ẩn) mọi checkbox của lớp KHÁC KHỐI (khối = số đứng đầu tên lớp, vd "3C"
 *     khối "3") - checkbox CÙNG khối (kể cả lớp đã chọn) vẫn enabled. Bỏ chọn hết lớp đã chọn ->
 *     mọi checkbox trở lại enabled. Nút "Giao đề đã chọn" DISABLED khi chưa chọn lớp nào, chuyển
 *     ENABLED ngay khi chọn 1 lớp (CHƯA cần chọn đề) - validate "phải chọn ≥1 đề" xảy ra ở bước bấm
 *     submit (xem clickSubmitExpectingValidationError), không phải disable nút.
 *   - "Thời gian giao"/"Hạn nộp": CÙNG 1 cấu trúc popover `role="menu"` (dùng lại
 *     `setDueDateViaPopover` từ `dueDatePopover.js`) - trigger của cả 2 field là PHẦN TỬ DUY NHẤT
 *     vừa hiển thị text ngày vừa có `aria-haspopup="menu"`, định vị bằng
 *     `getByText(label, {exact:true}).locator("xpath=following::*[@aria-haspopup='menu'][1]")`.
 *     Mặc định "Thời gian giao" = hôm nay, "Hạn nộp" = hôm nay + 2 ngày. Lịch "Thời gian giao"
 *     disable mọi ngày TRƯỚC hôm nay. Đổi "Thời gian giao" sang ngày X -> "Hạn nộp" TỰ ĐỘNG nhảy
 *     theo thành X+2 (đã xác nhận thật: đổi giao=07/11 thì hạn tự đổi 09/11). Lịch "Hạn nộp" disable
 *     mọi ngày TRƯỚC "Thời gian giao" đang chọn (đã xác nhận thật: giao=10/11 thì hạn nộp disable
 *     hết ngày 1-9/11) - NHƯNG cho phép chọn hạn nộp TRÙNG NGÀY với thời gian giao (đã thử chọn
 *     thành công ngày trùng).
 *   - "Chọn loại kỳ thi": CHỈ xuất hiện SAU khi đã chọn ≥1 lớp - danh sách `<button type="button"
 *     aria-pressed="true|false">` (KHÔNG phải role="tab" dù UI trông như tab), mặc định loại ĐẦU
 *     TIÊN trong danh sách tự aria-pressed="true" ngay sau khi chọn lớp. Bấm vào nút ĐANG active sẽ
 *     TOGGLE OFF (aria-pressed chuyển false) và ẩn hẳn "Danh sách đề luyện tập", hiện placeholder
 *     "Thầy/cô hãy chọn loại kỳ thi để xem danh sách đề" - đã xác nhận thật đây CHÍNH LÀ hành vi
 *     thật của case "[CẦN XÁC NHẬN] Bỏ chọn loại kỳ thi đang active" (ASSIGN-EXAMTYPE-04), không
 *     phải lỗi script.
 *   - PHÁT HIỆN QUAN TRỌNG (dễ hiểu nhầm nếu chỉ đọc UI): "Chọn loại kỳ thi" là MULTI-SELECT CHIP,
 *     KHÔNG phải single-select tab dù pill trông giống tab UI. Bấm vào 1 chip ĐANG TẮT sẽ THÊM chip
 *     đó vào tập active (chip trước đó KHÔNG tự tắt) - "Danh sách đề luyện tập" hiển thị là HỢP
 *     (UNION) đề của MỌI chip đang active cùng lúc, không phải riêng chip vừa bấm (đã xác nhận thật:
 *     bấm thêm "Kỳ thi 2610" khi "QA test" vẫn active -> CẢ 2 chip cùng aria-pressed="true", danh
 *     sách = hợp 2 loại). Chỉ khi tắt HẾT mọi chip active mới quay về placeholder "chưa chọn loại kỳ
 *     thi". Dùng `selectOnlyExamType()` (tắt hết rồi bật đúng 1 chip) khi cần so sánh số lượng/nội
 *     dung CÔ LẬP theo từng loại kỳ thi - `selectExamType()` chỉ toggle 1 chip, KHÔNG cô lập các
 *     chip khác.
 *   - "Danh sách đề luyện tập (N)": N=0 khi loại kỳ thi đang chọn không có đề nào thuộc lớp đã chọn
 *     - placeholder "Kho đề hiện chưa có đề bạn cần" (đã xác nhận thật tổ hợp lớp "5D"/"10D"/"11A2"/
 *     "11H" + loại kỳ thi "QA test" trên tài khoản DEV dùng chung = N=0, dùng tổ hợp này cho
 *     EXAMTYPE-06 thay vì đoán). Mỗi dòng đề: `button[role="checkbox"][id^="lesson-item-"]` + div
 *     tiêu đề (sibling ngay sau) + 2 span "N Câu hỏi"/"N phút" + button "Xem chi tiết" - CHƯA thấy
 *     badge "Pro" ở BẤT KỲ đề nào trong toàn bộ pool tài khoản DEV hiện có (đã quét hết 7 lớp x 8
 *     loại kỳ thi) - ASSIGN-LIST-03 không có dữ liệu thật để verify, phải SKIP cho tới khi có đề Pro
 *     thật trên môi trường test.
 *   - Popup "Xem chi tiết" (`role="dialog"`): title = tên đề, 2 badge đầu "N câu hỏi"/"N phút", nội
 *     dung nhóm theo `<h4>Section N: tên</h4>` + "N câu hỏi", mỗi câu là 1 khối "Câu N" + đề bài +
 *     các option `aria-disabled="true"` (READ-ONLY xác nhận thật - không có cách tương tác chọn đáp
 *     án trong popup). Đáp án ĐÚNG được tô thêm các class
 *     `bg-surface-action-sub! text-action! border-main!` (dấu `!` LÀ MỘT PHẦN tên class thật, kiểu
 *     Tailwind "important" suffix - không phải lỗi gõ) so với option sai - dùng CSS attribute
 *     substring `[class*="border-main!"]` để đếm, KHÔNG dùng dot-class vì ký tự `!` không hợp lệ
 *     trong cú pháp `.class`. Nút đóng `button[data-slot="dialog-close"]` (góc phải trên, Radix
 *     chuẩn) - đóng popup KHÔNG ảnh hưởng checkbox đã tích ở danh sách phía sau (đã xác nhận thật).
 *   - Nút "Giao đề đã chọn" đổi label thành "Giao đề đã chọn (N)" khi đã chọn N đề (đã xác nhận
 *     thật N=1 -> "Giao đề đã chọn (1)"). Toast thành công khớp regex
 *     `/Đã giao .* đề luyện tập tới .* lớp/` (TÁI SỬ DỤNG đúng regex multiClassAndDeleteFlow.js đã
 *     dùng).
 *   - Màn "Chỉnh sửa đề luyện tập" (`/teacher/exercise/practice/{id}/edit`): "Giao tới lớp" mọi
 *     checkbox đều DISABLED (kể cả lớp đã chọn sẵn) - xác nhận ASSIGN-EDIT-03 là "disable/khóa,
 *     không sửa được". "Chọn loại kỳ thi" KHÔNG disable (bấm đổi được bình thường) NHƯNG - ĐÃ XÁC
 *     NHẬN THẬT BUG ASSIGN-EDIT-02/ASSIGN-EDIT-05 - "Danh sách đề luyện tập" LUÔN LUÔN chỉ hiển thị
 *     ĐÚNG 1 dòng DUY NHẤT là đề đã giao gốc (checkbox disabled, checked=true), BẤT KỂ đang bấm loại
 *     kỳ thi nào trong 8 loại (đã thử lần lượt 4 loại khác nhau, dòng hiển thị + tiêu đề KHÔNG ĐỔI
 *     "Đề thi QA test 01" dù bấm sang "Kỳ thi 2610"/"QA-TC-Kythi-02-renamed"/"Kỳ thi G") - route
 *     "Chọn loại kỳ thi" ở màn Chỉnh sửa hoàn toàn KHÔNG tác dụng lên danh sách đề (khác hẳn số
 *     lượng thật ở màn tạo mới cho đúng lớp+loại kỳ thi đó, vd "Kỳ thi 2610" có 2-3 đề thật ở màn
 *     tạo mới). Đây là BUG THẬT đã xác nhận, không phải suy đoán từ mô tả spec.
 */
import { config, resolveTeacherPortalBaseUrl } from "../../../src/config.js";
import { setDueDateViaPopover } from "../../navigation/dueDatePopover.js";

export class AssignFormAssertionError extends Error {}

export const assignFormPageObjects = {
  sourceRadioName: "practice-source",
  sourceValues: { parrot: "parrot", personal: "personal" },
  dateLabels: { assignedAt: "Thời gian giao", dueDate: "Hạn nộp" },
  examTypeNotSelectedText: "Thầy/cô hãy chọn loại kỳ thi để xem danh sách đề",
  examTypeEmptyListText: "Kho đề hiện chưa có đề bạn cần",
  classNotSelectedText: "Thầy/cô hãy chọn lớp học trước để bắt đầu chọn đề luyện tập",
  previewButtonText: "Xem chi tiết",
  submitButtonPattern: /Giao đề đã chọn/,
  successTextPattern: /Đã giao .* đề luyện tập tới .* lớp/,
  // ĐÃ XÁC NHẬN THẬT (2026-11-02): bấm "Giao đề đã chọn" trên màn CHỈNH SỬA (update) hiện toast
  // KHÁC HẲN màn tạo mới - "Chỉnh sửa đề luyện tập thành công" (đúng i18n key "updateSuccess"), rồi
  // ĐIỀU HƯỚNG VỀ thẳng "/teacher/exercise?tab=practice" (khác màn tạo mới ở lại tại chỗ sau toast).
  // KHÔNG dùng `successTextPattern` (dành riêng cho tạo mới) cho hành động lưu ở màn Chỉnh sửa.
  editSuccessText: "Chỉnh sửa đề luyện tập thành công",
  requiredExerciseErrorText: "Vui lòng chọn ít nhất 1 đề luyện tập",
  correctAnswerClassMarker: "border-main!",
};

/** Đọc trạng thái 2 radio "Nguồn đề luyện tập" - trả về [{value, checked, disabled}]. */
export async function readSourceRadios(page) {
  const radios = page.locator(`input[type="radio"][name="${assignFormPageObjects.sourceRadioName}"]`);
  const n = await radios.count();
  const result = [];
  for (let i = 0; i < n; i++) {
    const r = radios.nth(i);
    result.push({
      value: await r.getAttribute("value"),
      checked: await r.isChecked(),
      disabled: await r.isDisabled(),
    });
  }
  return result;
}

/** Đọc danh sách tên lớp thật trong "Giao tới lớp" - input ẩn `type="checkbox"` là dấu hiệu DUY
 * NHẤT của section này trên trang (checkbox chọn đề luyện tập là `<button role="checkbox">`). */
export async function readCreateFormClassOptions(page) {
  const labels = page.locator("label").filter({ has: page.locator('input[type="checkbox"]') });
  return (await labels.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
}

function classLabelLocator(page, className) {
  return page.locator("label").filter({ has: page.locator('input[type="checkbox"]') }).filter({ hasText: className }).first();
}

export async function isClassCheckboxDisabled(page, className) {
  return classLabelLocator(page, className).locator('input[type="checkbox"]').isDisabled();
}

export async function isClassCheckboxChecked(page, className) {
  return classLabelLocator(page, className).locator('input[type="checkbox"]').isChecked();
}

/** Bấm chọn/bỏ chọn 1 lớp (toggle) trên form tạo mới - xác nhận lại checkbox đổi trạng thái đúng
 * như kỳ vọng, thử lại tối đa 3 lần (bù race giữa click và re-render). */
export async function toggleClassCheckbox(page, className, { expectChecked } = {}) {
  const label = classLabelLocator(page, className);
  const checkbox = label.locator('input[type="checkbox"]');
  for (let attempt = 1; attempt <= 3; attempt++) {
    await label.click();
    await page.waitForTimeout(300);
    const checked = await checkbox.isChecked().catch(() => null);
    if (expectChecked === undefined || checked === expectChecked) return checked;
  }
  throw new AssignFormAssertionError(`Đã bấm lớp "${className}" 3 lần nhưng checkbox không đạt trạng thái mong đợi (expectChecked=${expectChecked}).`);
}

/** Group tên lớp theo "khối" (chữ số đứng đầu tên lớp, vd "11A2" -> "11") - dùng để tìm 2 lớp cùng
 * khối (ASSIGN-CLASS-03) hoặc khác khối (ASSIGN-CLASS-02) từ danh sách lớp thật, KHÔNG hardcode tên
 * lớp (danh sách lớp của tài khoản DEV dùng chung có thể đổi theo thời gian). */
export function groupClassNamesByKhoi(classNames) {
  const groups = {};
  for (const name of classNames) {
    const match = /^(\d+)/.exec(name);
    const key = match ? match[1] : name;
    (groups[key] = groups[key] || []).push(name);
  }
  return groups;
}

/** Locator phần tử VỪA hiển thị text ngày VỪA là trigger mở popover chọn ngày - đã xác nhận thật
 * đây là CÙNG 1 phần tử cho cả "Thời gian giao" và "Hạn nộp" (xem docblock đầu file). */
export function dateFieldTrigger(page, label) {
  return page.getByText(label, { exact: true }).locator("xpath=following::*[@aria-haspopup='menu'][1]");
}

export async function readDateField(page, label) {
  const text = (await dateFieldTrigger(page, label).innerText()).trim();
  const match = /^(\d{2}\/\d{2}\/\d{4})/.exec(text);
  if (!match) {
    throw new AssignFormAssertionError(`Không đọc được giá trị ngày của field "${label}" - text thật: "${text}".`);
  }
  return match[1];
}

export async function setDateField(page, label, { day, month }) {
  await setDueDateViaPopover(page, dateFieldTrigger(page, label), { day, month });
}

/** Mở popover ngày của field, đọc danh sách số ngày (của tháng đang hiển thị) đang bị `disabled`,
 * rồi đóng lại bằng Escape - dùng để xác nhận rule "không cho chọn ngày quá khứ"/"không cho chọn
 * Hạn nộp trước Thời gian giao" bằng dữ liệu DOM thật thay vì suy đoán. */
export async function readDisabledCalendarDays(page, label) {
  const trigger = dateFieldTrigger(page, label);
  await trigger.click();
  const popover = page.getByRole("menu");
  await popover.waitFor({ state: "visible", timeout: 10000 });
  const dayButtons = popover.locator("button");
  const n = await dayButtons.count();
  const disabledDays = [];
  for (let i = 0; i < n; i++) {
    const btn = dayButtons.nth(i);
    const text = (await btn.innerText()).trim();
    if (/^\d{1,2}$/.test(text) && (await btn.isDisabled())) disabledDays.push(Number(text));
  }
  await page.keyboard.press("Escape");
  await popover.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
  return disabledDays;
}

/** Locator các nút "Chọn loại kỳ thi" (button[aria-pressed], KHÔNG phải role="tab" dù UI giống tab -
 * xem docblock đầu file). CHỈ xuất hiện sau khi đã chọn ≥1 lớp. */
export function examTypeButtons(page) {
  return page.locator("button[aria-pressed]");
}

export async function readExamTypes(page) {
  const buttons = examTypeButtons(page);
  const n = await buttons.count();
  const result = [];
  for (let i = 0; i < n; i++) {
    const btn = buttons.nth(i);
    result.push({
      name: (await btn.innerText()).trim(),
      active: (await btn.getAttribute("aria-pressed")) === "true",
      index: i,
    });
  }
  return result;
}

/** Bấm TOGGLE 1 chip loại kỳ thi theo tên (bật nếu đang tắt, tắt nếu đang bật) - CHỈ bấm nếu đang
 * CHƯA active (bấm vào nút đang active sẽ TOGGLE OFF, xem docblock đầu file) - mặc định
 * `allowToggleOff:false` để tránh bẫy này, truyền `true` khi cố ý test hành vi toggle-off
 * (ASSIGN-EXAMTYPE-04). ĐÃ XÁC NHẬN THẬT (quan trọng, dễ hiểu nhầm): "Chọn loại kỳ thi" là
 * MULTI-SELECT CHIP (KHÔNG phải single-select tab dù UI trông như tab) - bấm 1 chip ĐANG TẮT sẽ
 * THÊM nó vào tập đang active chứ KHÔNG thay thế chip trước đó; "Danh sách đề luyện tập" là HỢP
 * (UNION) đề của MỌI chip đang active, không phải riêng chip vừa bấm. Dùng `selectOnlyExamType()`
 * khi cần cô lập đúng 1 loại kỳ thi để so sánh số lượng/nội dung (vd ASSIGN-EXAMTYPE-03/05). */
export async function selectExamType(page, name, { allowToggleOff = false } = {}) {
  const types = await readExamTypes(page);
  const target = types.find((t) => t.name === name);
  if (!target) {
    throw new AssignFormAssertionError(`Không tìm thấy loại kỳ thi "${name}" - danh sách thật: ${JSON.stringify(types.map((t) => t.name))}.`);
  }
  if (target.active && !allowToggleOff) return; // đã active sẵn, không bấm lại để tránh toggle-off
  await examTypeButtons(page).nth(target.index).click();
  await page.waitForTimeout(500);
}

/** Tắt TOÀN BỘ chip "Chọn loại kỳ thi" đang active (bấm lần lượt từng chip active cho tới khi
 * không còn chip nào active) - đưa về trạng thái "chưa chọn loại kỳ thi nào" sạch sẽ trước khi cô
 * lập 1 chip duy nhất (xem `selectOnlyExamType`). */
export async function clearAllExamTypeChips(page) {
  for (let guard = 0; guard < 20; guard++) {
    const types = await readExamTypes(page);
    const active = types.find((t) => t.active);
    if (!active) return;
    await examTypeButtons(page).nth(active.index).click();
    await page.waitForTimeout(400);
  }
  throw new AssignFormAssertionError('Đã thử tắt chip "Chọn loại kỳ thi" 20 lần nhưng vẫn còn chip active - có thể có lỗi vòng lặp.');
}

/** Cô lập ĐÚNG 1 loại kỳ thi đang active (tắt mọi chip khác, bật đúng chip tên `name`) - dùng khi
 * cần so sánh danh sách đề/N câu THEO TỪNG LOẠI riêng biệt, tránh bị nhiễu bởi hành vi UNION đa chọn
 * thật của UI (xem docblock `selectExamType`). */
export async function selectOnlyExamType(page, name) {
  await clearAllExamTypeChips(page);
  await selectExamType(page, name);
}

/** Đọc label "Danh sách đề luyện tập (N)" hiện tại, hoặc null nếu đang ở placeholder
 * "chưa chọn loại kỳ thi"/"chưa chọn lớp". */
export async function readExerciseListLabel(page) {
  const label = page.getByText(/Danh sách đề luyện tập \(\d+\)/).first();
  if (await label.count()) return (await label.innerText()).trim();
  return null;
}

export function exerciseItemCheckboxes(page) {
  return page.locator('button[role="checkbox"][id^="lesson-item-"]');
}

export async function listExerciseItems(page) {
  const checkboxes = exerciseItemCheckboxes(page);
  const n = await checkboxes.count();
  const result = [];
  for (let i = 0; i < n; i++) {
    const checkbox = checkboxes.nth(i);
    const card = checkbox.locator("xpath=following-sibling::div[1]");
    const row = checkbox.locator("xpath=ancestor::div[contains(@class,'justify-between')][1]");
    const questionsBadge = row.locator("span").first();
    result.push({
      id: await checkbox.getAttribute("id"),
      title: (await card.innerText()).trim().split("\n")[0],
      checked: (await checkbox.getAttribute("aria-checked")) === "true",
      disabled: await checkbox.isDisabled(),
      index: i,
      checkbox,
      row,
    });
  }
  return result;
}

export async function toggleExerciseItemByIndex(page, index, { expectChecked } = {}) {
  const checkbox = exerciseItemCheckboxes(page).nth(index);
  for (let attempt = 1; attempt <= 3; attempt++) {
    await checkbox.click();
    await page.waitForTimeout(300);
    const checked = (await checkbox.getAttribute("aria-checked")) === "true";
    if (expectChecked === undefined || checked === expectChecked) return checked;
  }
  throw new AssignFormAssertionError(`Đã bấm checkbox đề index=${index} 3 lần nhưng không đạt trạng thái mong đợi (expectChecked=${expectChecked}).`);
}

/** Mở popup "Xem chi tiết" của 1 đề theo index trong danh sách đang hiển thị - trả về locator
 * dialog (role="dialog") đã chờ visible. */
export async function openPreviewByIndex(page, index) {
  const items = await listExerciseItems(page);
  const target = items[index];
  if (!target) throw new AssignFormAssertionError(`Không có đề ở index=${index} (danh sách hiện có ${items.length} đề).`);
  await target.row.getByText(assignFormPageObjects.previewButtonText, { exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 10000 });
  // ĐÃ XÁC NHẬN THẬT: dialog container hiện `visible` TRƯỚC khi nội dung (section/câu hỏi) mount
  // xong - chờ thêm phần tử nội dung đầu tiên (h4 "Section...") để tránh đọc rỗng ngay sau khi mở.
  await dialog.locator("h4").first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  return dialog;
}

export async function closePreview(page, dialog) {
  await dialog.locator('[data-slot="dialog-close"]').click();
  await dialog.waitFor({ state: "hidden", timeout: 10000 });
}

/** Đọc danh sách section + số câu hỏi mỗi section trong popup preview (vd "Section 1: Writing" +
 * "10 câu hỏi"). */
export async function readPreviewSections(dialog) {
  const headers = dialog.locator("h4");
  const n = await headers.count();
  const result = [];
  for (let i = 0; i < n; i++) {
    const header = headers.nth(i);
    const name = (await header.innerText()).trim();
    const countText = await header.locator("xpath=following-sibling::span[1]").innerText().catch(() => "");
    result.push({ name, countText: countText.trim() });
  }
  return result;
}

/** Đếm tổng số câu hỏi hiển thị trong popup preview ("Câu N" blocks) - ĐÃ XÁC NHẬN THẬT: selector
 * theo class CSS (`div.mb-4.font-bold`) CHỈ khớp đúng với section dạng trắc nghiệm thường (vd
 * "Writing"/"Reading"), các dạng section khác (vd "Speaking") render khối "Câu N" bằng class/cấu
 * trúc KHÁC - đếm theo class bị THIẾU (18/37 câu thật trên 1 đề test có 4 section hỗn hợp). Dùng
 * `readPreviewSections()` cộng dồn "N câu hỏi" của từng section để lấy tổng ĐÚNG, hàm này CHỈ dùng
 * tham khảo/không phải nguồn sự thật chính cho tổng số câu. */
export function previewQuestionBlocks(dialog) {
  return dialog.locator("div.mb-4.font-bold");
}

/** Cuộn khung nội dung popup preview xuống đáy, trả về true nếu đã chạm đáy thật (scrollTop +
 * clientHeight ~ scrollHeight) - dùng cho ASSIGN-PREVIEW-05 ("cuộn xem hết toàn bộ câu hỏi trong đề
 * dài") thay vì đếm số khối câu hỏi (không đáng tin cậy xuyên suốt nhiều dạng câu hỏi, xem
 * `previewQuestionBlocks`). */
export async function scrollPreviewToBottom(dialog) {
  const scrollArea = dialog.locator(".overflow-y-auto").first();
  await scrollArea.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await scrollArea.page().waitForTimeout(500);
  return scrollArea.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2);
}

/** Đếm số đáp án được đánh dấu "đúng" trong popup preview - dùng class substring
 * `[class*="border-main!"]` (ký tự `!` LÀ MỘT PHẦN tên class thật, xem docblock đầu file). */
export function correctAnswerMarkers(dialog) {
  return dialog.locator(`[class*="${assignFormPageObjects.correctAnswerClassMarker}"]`);
}

export function submitButton(page) {
  return page.getByRole("button", { name: assignFormPageObjects.submitButtonPattern });
}

export async function isSubmitDisabled(page) {
  return submitButton(page).isDisabled();
}

export async function readSubmitLabel(page) {
  return (await submitButton(page).innerText()).trim();
}

/** Bấm "Giao đề đã chọn" trên màn TẠO MỚI và chờ toast thành công - dùng cho các case GHI DỮ LIỆU
 * THẬT (SUBMIT-03/04, AC-01). KHÔNG dùng hàm này cho màn Chỉnh sửa - xem `clickSaveEditAndWaitSuccess`. */
export async function clickSubmitAndWaitSuccess(page) {
  await submitButton(page).click();
  await page.getByText(assignFormPageObjects.successTextPattern).waitFor({ timeout: 15000 });
}

/** Bấm "Giao đề đã chọn" trên màn CHỈNH SỬA (lưu thay đổi) và chờ ĐÚNG toast "Chỉnh sửa đề luyện
 * tập thành công" (KHÁC toast của màn tạo mới, xem `assignFormPageObjects.editSuccessText`) - sau
 * đó trang điều hướng VỀ "Danh sách đề luyện tập đã giao" (đã xác nhận thật), nên chờ thêm URL đổi
 * để đảm bảo đã rời khỏi màn Chỉnh sửa trước khi caller tiếp tục. */
export async function clickSaveEditAndWaitSuccess(page) {
  await submitButton(page).click();
  await page.getByText(assignFormPageObjects.editSuccessText, { exact: true }).waitFor({ timeout: 15000 });
  await page.waitForURL(/\/teacher\/exercise(\?|$)/, { timeout: 15000 }).catch(() => {});
}

/** Bấm "Giao đề đã chọn" khi ĐANG kỳ vọng lỗi validate phía client (vd chưa chọn đề nào) - trả về
 * text lỗi thật hiển thị (không phải đoán từ i18n) để caller tự so khớp. */
export async function clickSubmitExpectingValidationError(page) {
  await submitButton(page).click();
  await page.waitForTimeout(800);
  return page.locator("body").innerText();
}

export function cancelButton(page) {
  return page.getByRole("button", { name: "Hủy", exact: true });
}

export { resolveTeacherPortalBaseUrl, config };
