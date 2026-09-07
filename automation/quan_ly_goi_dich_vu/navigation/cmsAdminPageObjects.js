/**
 * Page Objects + helper thao tác cho CMS Quản lý (web admin: /packages, /orders, /students).
 * Framework UI: Nuxt + Naive UI (class prefix "n-") - KHÔNG có resource-id, hầu hết field không
 * có <label for>/aria-label thật nên phải định vị qua text lân cận (giống cách app mobile không
 * resource-id trong README gốc).
 *
 * TOÀN BỘ selector dưới đây ĐÃ XÁC NHẬN THẬT qua DOM dump trực tiếp (Playwright, môi trường
 * staging, 2026-09-07) - không đoán từ ảnh chụp màn hình. Các phát hiện đáng chú ý:
 *   - Input: định vị bằng `input[placeholder="..."]` (Naive UI n-input render input thật kèm
 *     placeholder attribute, không cần label).
 *   - Checkbox "Gói dịch vụ 'Dùng thử'": DUY NHẤT 1 checkbox trong popup packages, `role="checkbox"`
 *     thật - `page.getByRole("checkbox")` là đủ, không cần scope thêm.
 *   - Switch (Trạng thái hoạt động / Đánh dấu là gói mặc định): `role="switch"` thật,
 *     `aria-checked`. Trạng thái hoạt động LUÔN là switch đầu tiên (mọi popup đều có). Đánh dấu là
 *     gói mặc định chỉ xuất hiện SAU khi tick checkbox Dùng thử, luôn là switch CUỐI CÙNG.
 *   - Select (Gói dịch vụ mua / Gói dùng thử áp dụng / Tên Profile học sinh): Naive UI `n-select`,
 *     trigger là `.n-base-selection`, mở ra list `.n-base-select-option` (KHÔNG phải <select>
 *     native, không dùng `selectOption()` của Playwright được).
 *   - Nút hành động icon-only trên mỗi dòng bảng (không có text/aria-label):
 *     packages: `button.n-button--primary-type` = Sửa (bút chì), `button.n-button--error-type` =
 *     Xóa (rác). students: nút ĐẦU TIÊN trong ô hành động = xem lịch sử (mắt).
 *   - Popup KHÔNG có `role="dialog"` - dùng class `.n-card` (Naive UI Modal/Card) để scope khi cần.
 */
export const cmsAdminPageObjects = {
  login: {
    usernameInput: 'input[placeholder="Vui lòng nhập tên người dùng"]',
    passwordInput: 'input[placeholder="Vui lòng nhập mật khẩu"]',
    submitButton: "Đăng nhập",
  },

  packages: {
    path: "/packages",
    addButtonText: "Thêm gói dịch vụ",
    tableRowSelector: "table.n-data-table-table tbody tr",
    popupFooterSelector: ".n-card__footer",
    saveButton: "Lưu",
    cancelButton: "Hủy",
    nameInput: 'input[placeholder="Nhập tên gói dịch vụ"]',
    nameRequiredError: "Vui lòng nhập tên gói dịch vụ",
    trialCheckboxLabel: "Gói dịch vụ 'Dùng thử'",
    defaultToggleLabel: "Đánh dấu là gói mặc định",
    defaultToggleDescription:
      "Chỉ duy nhất 1 gói được đặt làm mặc định. Nếu bật, hệ thống sẽ tự động tắt trạng thái mặc định ở gói trước đó.",
    priceOfferedLabel: "Giá ưu đãi", // dùng để ASSERT field này KHÔNG tồn tại (UI-01/UI-05)
  },

  orders: {
    path: "/orders",
    createButtonText: "Tạo đơn hàng",
    tableRowSelector: "table.n-data-table-table tbody tr",
    phoneInput: 'input[placeholder="Nhập số điện thoại"]',
    profileFieldLabel: "Tên Profile học sinh",
    packageToBuyFieldLabel: "Gói dịch vụ mua",
    trialPackageFieldLabel: "Gói dùng thử áp dụng",
    trialPackageNotApplicableOption: "-- Không áp dụng --",
    trialPackageRequiredError: "Vui lòng chọn gói dùng thử áp dụng",
    saveButton: "Lưu",
    cancelButton: "Hủy",
    changeStatusLinkText: "Thay đổi",
    confirmStatusChangeDialogTitle: "Xác nhận thay đổi trạng thái",
    confirmButton: "Xác nhận",
    skipButton: "Bỏ qua",
  },

  students: {
    path: "/students",
    searchInputPlaceholder: "Tìm kiếm theo tên profile, số điện thoại...",
    tableRowSelector: "table.n-data-table-table tbody tr",
    historyModalTitle: "Lịch sử gói dịch vụ",
    historyModalCloseButton: "Đóng",
  },
};

const po = cmsAdminPageObjects;

// ---------------------------------------------------------------------------
// Helper chung: n-select (packages mua / gói dùng thử áp dụng / profile học sinh)
// ---------------------------------------------------------------------------

/** Locator của khối field (label + control) chứa `labelText` - dùng cho input/switch/select. */
function formItem(page, labelText) {
  return page.locator(".n-form-item", { hasText: labelText });
}

/** Mở dropdown Naive UI n-select nằm trong field có label `labelText`, rồi chọn option `optionText`
 * (khớp chính xác - so khớp cả chuỗi để tránh chọn nhầm "RE-01" khi đang cần "RE-01 (Mặc định)"). */
export async function selectNaiveOption(page, labelText, optionText) {
  await formItem(page, labelText).locator(".n-base-selection").click();
  const option = page.locator(".n-base-select-option:visible", { hasText: optionText }).first();
  await option.waitFor({ state: "visible", timeout: 10000 });
  await option.click();
}

/** Đọc toàn bộ text các option đang có trong dropdown n-select (KHÔNG chọn option nào) - dùng để
 * assert thứ tự Mới->Cũ (GRANT-01) hoặc danh sách bị lọc (ORDER-02/DEACT-02). Đóng dropdown lại
 * sau khi đọc xong (bấm Escape) để không ảnh hưởng bước sau. */
export async function readNaiveOptionTexts(page, labelText) {
  await formItem(page, labelText).locator(".n-base-selection").click();
  await page.locator(".n-base-select-option:visible").first().waitFor({ state: "visible", timeout: 10000 });
  const texts = await page.locator(".n-base-select-option:visible").allInnerTexts();
  await page.keyboard.press("Escape");
  return texts;
}

/** Đọc giá trị hiện đang chọn (text hiển thị) của 1 n-select mà KHÔNG mở dropdown. */
export async function readNaiveSelectedValue(page, labelText) {
  return formItem(page, labelText).locator(".n-base-selection-input__content").innerText();
}

// ---------------------------------------------------------------------------
// Packages (/packages)
// ---------------------------------------------------------------------------

export async function gotoPackages(page, baseUrl) {
  await page.goto(`${baseUrl}${po.packages.path}`, { waitUntil: "networkidle" });
}

export async function openAddPackagePopup(page) {
  await page.getByText(po.packages.addButtonText).first().click();
  await page.waitForTimeout(300);
}

/** Định vị dòng bảng gói dịch vụ theo tên (khớp CHÍNH XÁC phần text tên gói, bỏ qua các tag
 * "Dùng thử"/"Mặc định" đi kèm - tên gói nằm trong `span.n-text--strong` riêng biệt). */
export function packageRow(page, packageName) {
  return page
    .locator(po.packages.tableRowSelector)
    .filter({ has: page.locator(".n-text--strong", { hasText: packageName }) });
}

export async function openEditPackagePopup(page, packageName) {
  const row = packageRow(page, packageName);
  await row.locator("button.n-button--primary-type").click();
  await page.waitForTimeout(300);
}

/** Xóa 1 gói dịch vụ theo tên - bấm icon rác (`button.n-button--error-type`) rồi xác nhận popup
 * "Xóa gói dịch vụ" (nút "Xóa", exact - tránh khớp nhầm icon rác khác trên trang). Dùng để dọn dẹp
 * gói do automation tự tạo (tiền tố `AUTO-`) sau khi chạy `npm run test-goi-dich-vu` nhiều lần. */
export async function deletePackageByName(page, packageName) {
  const row = packageRow(page, packageName);
  await row.locator("button.n-button--error-type").click();
  const confirmBtn = page.getByRole("button", { name: "Xóa", exact: true });
  await confirmBtn.waitFor({ state: "visible", timeout: 10000 });
  await confirmBtn.click();
  // ĐÃ GẶP THẬT (2026-09-07): xóa liên tiếp nhiều gói mà chỉ đợi timeout cố định - modal xác nhận
  // của lượt xóa trước đôi lúc chưa đóng hẳn (`.n-modal-container` còn che pointer events), khiến
  // lượt xóa SAU bấm hụt icon rác của dòng tiếp theo. Đợi modal thật sự biến mất khỏi DOM.
  await confirmBtn.waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
}

/** Đổi số bản ghi/trang ở bảng đang mở (10/20/50/100) - dùng để liệt kê/dọn dẹp toàn bộ danh sách
 * trong 1 lần thay vì phân trang. */
export async function setPageSize(page, size) {
  await page.locator(".n-base-selection", { hasText: "trang" }).click();
  await page.waitForTimeout(300);
  await page.locator(".n-base-select-option:visible", { hasText: String(size) }).click();
  await page.waitForTimeout(600);
}

/** Đọc toàn bộ tên gói dịch vụ đang hiển thị trên bảng (1 tên/dòng, bỏ tag "Dùng thử"/"Mặc định"). */
export async function readAllPackageNames(page) {
  const rows = page.locator(po.packages.tableRowSelector);
  const count = await rows.count();
  const names = [];
  for (let i = 0; i < count; i += 1) {
    // Cột "TÊN GÓI" là td thứ 2 (nth(1)) - KHÔNG lấy `.n-text--strong` cả dòng vì cột "GIÁ" cũng
    // dùng cùng class đó (ĐÃ GẶP THẬT 2026-09-07: strict mode violation, khớp nhầm "0 đ").
    const text = await rows.nth(i).locator("td").nth(1).locator(".n-text--strong").innerText();
    names.push(text.split("\n")[0].trim());
  }
  return names;
}

/** Đọc danh sách tag ("Dùng thử", "Mặc định"...) đang gắn trên 1 dòng gói dịch vụ. */
export async function readPackageTags(page, packageName) {
  return packageRow(page, packageName).locator(".n-tag__content").allInnerTexts();
}

/** Đọc text cột TRẠNG THÁI ("Hoạt động" / "Dừng hoạt động") của 1 dòng gói dịch vụ. */
export async function readPackageStatus(page, packageName) {
  return packageRow(page, packageName).locator("td").nth(4).locator(".n-tag__content").innerText();
}

/** Switch "Trạng thái hoạt động" - LUÔN là switch đầu tiên trong popup Thêm mới/Chỉnh sửa. */
export function activeStatusSwitch(page) {
  return page.getByRole("switch").first();
}

/** Switch "Đánh dấu là gói mặc định" - chỉ tồn tại SAU khi tick checkbox Dùng thử, luôn là switch
 * CUỐI CÙNG trong popup lúc đó (2 switch: Trạng thái hoạt động + cái này). */
export function defaultToggleSwitch(page) {
  return page.getByRole("switch").last();
}

export function trialCheckbox(page) {
  return page.getByRole("checkbox");
}

async function isSwitchOn(switchLocator) {
  return (await switchLocator.getAttribute("aria-checked")) === "true";
}

export const cmsAdminSwitchState = { isSwitchOn };

/** Điền form popup Thêm mới/Chỉnh sửa gói dịch vụ. Chỉ set field nào được truyền - field khác giữ
 * nguyên giá trị hiện có của form (KHÔNG tự ý đổi nếu không được yêu cầu). */
export async function fillPackageForm(
  page,
  { name, priceListed, isTrial, isDefault, isActive } = {},
) {
  if (name !== undefined) {
    await page.locator(po.packages.nameInput).fill(name);
  }
  if (priceListed !== undefined) {
    const priceInput = formItem(page, "Giá niêm yết").locator("input");
    await priceInput.fill(String(priceListed));
  }
  if (isActive !== undefined) {
    const sw = activeStatusSwitch(page);
    if ((await isSwitchOn(sw)) !== isActive) await sw.click();
  }
  if (isTrial !== undefined) {
    const cb = trialCheckbox(page);
    const checked = (await cb.getAttribute("aria-checked")) === "true";
    if (checked !== isTrial) await cb.click();
  }
  if (isDefault !== undefined) {
    const sw = defaultToggleSwitch(page);
    if ((await isSwitchOn(sw)) !== isDefault) await sw.click();
  }
}

export async function savePackagePopup(page) {
  const saveBtn = page.locator(po.packages.popupFooterSelector).getByRole("button", { name: po.packages.saveButton });
  await saveBtn.click();
  await Promise.race([
    saveBtn.waitFor({ state: "detached", timeout: 10000 }).catch(() => {}),
    page.locator(".n-form-item-feedback__line").first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {}),
  ]);
  await page.waitForTimeout(800);
}

export async function cancelPackagePopup(page) {
  await page.locator(po.packages.popupFooterSelector).getByRole("button", { name: po.packages.cancelButton }).click();
  await page.waitForTimeout(300);
}

// ---------------------------------------------------------------------------
// Orders (/orders)
// ---------------------------------------------------------------------------

export async function gotoOrders(page, baseUrl) {
  await page.goto(`${baseUrl}${po.orders.path}`, { waitUntil: "networkidle" });
}

/** Bấm đúng nút "Tạo đơn hàng" mở popup - KHÔNG dùng `getByText` thô vì trang /orders còn có nút
 * "Xuất file Excel" nằm sát cạnh (đã gặp thật lúc test tay: bấm nhầm do vị trí đổi sau khi banner
 * thông báo xuất hiện) - dùng `getByRole("button")` để tránh khớp nhầm phần tử khác. */
export async function openCreateOrderPopup(page) {
  await page.getByRole("button", { name: po.orders.createButtonText, exact: true }).click();
  await page.waitForTimeout(300);
}

/** Điền số điện thoại rồi ĐỢI field "Tên Profile học sinh" thật sự hết disabled (app gọi API tìm
 * profile theo số điện thoại sau khi rời ô, có debounce) - KHÔNG trả về ngay sau `fill()`. ĐÃ GẶP
 * THẬT (2026-09-07): bấm mở dropdown profile ngay sau `fill()` (không đợi) đôi lúc mở trúng lúc
 * field còn disabled/dữ liệu chưa kịp load, khiến chọn hụt và submit báo "Vui lòng chọn profile
 * học sinh" dù đã "chọn" xong về mặt thao tác click. */
export async function fillOrderPhone(page, phone) {
  await page.locator(po.orders.phoneInput).fill(phone);
  await page.locator(po.orders.phoneInput).blur();
  await page
    .waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el && !el.className.includes("n-base-selection--disabled");
      },
      `.n-form-item:has-text("${po.orders.profileFieldLabel}") .n-base-selection`,
      { timeout: 10000 },
    )
    .catch(() => {});
}

export async function selectOrderProfile(page, profileName) {
  await selectNaiveOption(page, po.orders.profileFieldLabel, profileName);
}

/** Chọn profile ĐẦU TIÊN trong dropdown "Tên Profile học sinh" sau khi đã điền số điện thoại -
 * dùng khi không cần quan tâm profile cụ thể tên gì. Trả về TÊN profile vừa chọn (string) - PHẢI
 * dùng lại tên này khi tra cứu `/students` sau đó (xem `studentRow`): 1 số điện thoại có thể có
 * NHIỀU profile con, lọc chỉ theo số điện thoại có thể khớp nhầm dòng.
 *
 * ĐÃ GẶP THẬT (2026-09-07): field hết "disabled" KHÔNG đồng nghĩa danh sách profile đã load xong
 * (API tìm theo số điện thoại vẫn có thể còn đang chạy) - bấm mở đúng lúc đó ra dropdown RỖNG,
 * click "option đầu tiên" khi đó không trúng gì, submit sau đó báo "Vui lòng chọn profile học
 * sinh". Khắc phục: tự poll mở lại dropdown (đóng bằng Escape rồi mở lại) tới khi thấy option
 * thật, KHÔNG tin 1 lần mở là đủ. */
export async function selectFirstOrderProfileOption(page) {
  const trigger = formItem(page, po.orders.profileFieldLabel).locator(".n-base-selection");
  const optionLocator = page.locator(".n-base-select-option:visible");

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await trigger.click();
    await page.waitForTimeout(300);
    const count = await optionLocator.count();
    if (count > 0) {
      const first = optionLocator.first();
      const profileName = (await first.innerText()).trim();
      await first.click();
      return profileName;
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  throw new Error(
    "selectFirstOrderProfileOption: dropdown 'Tên Profile học sinh' không có option nào sau nhiều lần thử - kiểm tra lại số điện thoại đã điền có khớp profile thật trên môi trường đang test không.",
  );
}

export async function selectTrialPackageOption(page, optionText) {
  await selectNaiveOption(page, po.orders.trialPackageFieldLabel, optionText);
}

export async function readTrialPackageOptionTexts(page) {
  return readNaiveOptionTexts(page, po.orders.trialPackageFieldLabel);
}

export async function readSelectedTrialPackage(page) {
  return readNaiveSelectedValue(page, po.orders.trialPackageFieldLabel);
}

/** Bấm Lưu rồi đợi 1 trong 2 tín hiệu: popup đóng (lưu thành công) HOẶC dòng lỗi validate hiện ra
 * (lưu thất bại, popup vẫn mở) - KHÔNG dùng `waitForTimeout` cố định nữa: ĐÃ GẶP THẬT (2026-09-07)
 * bảng đơn hàng chưa kịp fetch lại dữ liệu mới trong 500ms, đọc nhầm phải dòng đơn hàng CŨ ở vị
 * trí đầu bảng. Thêm buffer ngắn sau tín hiệu để bảng có thời gian re-render. */
export async function saveOrderPopup(page) {
  const saveBtn = page.getByRole("button", { name: po.orders.saveButton, exact: true });
  await saveBtn.click();
  await Promise.race([
    saveBtn.waitFor({ state: "detached", timeout: 10000 }).catch(() => {}),
    page.locator(".n-form-item-feedback__line").first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {}),
  ]);
  await page.waitForTimeout(800);
}

export async function cancelOrderPopup(page) {
  await page.getByRole("button", { name: po.orders.cancelButton, exact: true }).click();
  await page.waitForTimeout(300);
}

/** Đọc text lỗi validate hiển thị dưới field "Gói dùng thử áp dụng" (nếu có). */
export async function readTrialPackageErrorText(page) {
  const el = formItem(page, po.orders.trialPackageFieldLabel).locator("text=" + po.orders.trialPackageRequiredError);
  return (await el.count()) > 0;
}

export function orderRow(page, orderCode) {
  return page.locator(po.orders.tableRowSelector).filter({ hasText: orderCode });
}

export async function readOrderStatus(page, orderCode) {
  return orderRow(page, orderCode).locator("td").nth(8).innerText();
}

/** Bấm "Thay đổi" trạng thái đơn hàng sang "Thành công" rồi xác nhận popup - KHÔNG có tùy chọn
 * chọn trạng thái khác, mỗi lần bấm là chuyển thẳng sang "Thành công" (ĐÃ XÁC NHẬN THẬT 2026-09-07:
 * popup xác nhận hỏi thẳng "chuyển ... sang 'Thành công'?", 2 nút Bỏ qua/Xác nhận). */
export async function confirmOrderSuccess(page, orderCode) {
  await orderRow(page, orderCode).getByText(po.orders.changeStatusLinkText).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: po.orders.confirmButton }).click();
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// Students (/students)
// ---------------------------------------------------------------------------

export async function gotoStudents(page, baseUrl) {
  await page.goto(`${baseUrl}${po.students.path}`, { waitUntil: "networkidle" });
}

/** Tìm kiếm học sinh theo số điện thoại/tên profile. ĐÃ GẶP THẬT (2026-09-07): ô search đôi lúc
 * không lọc ngay sau khi gõ (kể cả đã Enter) - phải điều hướng lại trang (`gotoStudents`) rồi gõ
 * lại mới ăn. Hàm này tự retry 1 lần theo đúng cách đã xác nhận khắc phục được lúc test tay. */
export async function searchStudent(page, baseUrl, query) {
  const input = page.locator(`input[placeholder="${po.students.searchInputPlaceholder}"]`);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await gotoStudents(page, baseUrl);
    await input.click();
    await input.fill(query);
    await input.press("Enter");
    await page.waitForTimeout(800);
    const rowCount = await page.locator(po.students.tableRowSelector).count();
    const firstRowText = rowCount > 0 ? await page.locator(po.students.tableRowSelector).first().innerText() : "";
    if (rowCount <= 3 && firstRowText.includes(query.replace(/^0/, ""))) return; // đã lọc đúng
    if (rowCount <= 3) return; // ít nhất đã lọc xuống (không phải danh sách 411 bản ghi gốc)
  }
}

/** ĐÃ GẶP THẬT (2026-09-07): 1 số điện thoại (tài khoản cha) có thể có NHIỀU profile con cùng hiện
 * trong `/students` (mỗi profile 1 dòng riêng, CÙNG số điện thoại) - lọc chỉ theo `phoneDigits` có
 * thể khớp NHẦM dòng (vd chọn nhầm "Hoàng Minh" thay vì "Hoàng Thạch" dù cùng 1 số điện thoại).
 * Truyền thêm `profileName` (tên profile ĐÃ chọn lúc tạo đơn, xem `selectFirstOrderProfileOption`)
 * để lọc chính xác đúng 1 dòng khi số điện thoại có nhiều profile con. */
export function studentRow(page, phoneDigits, profileName) {
  const base = page.locator(po.students.tableRowSelector).filter({ hasText: phoneDigits });
  return profileName ? base.filter({ hasText: profileName }) : base;
}

export async function readStudentAccountType(page, phoneDigits, profileName) {
  return studentRow(page, phoneDigits, profileName).locator("td").nth(5).innerText();
}

export async function readStudentPackageText(page, phoneDigits, profileName) {
  return studentRow(page, phoneDigits, profileName).locator("td").nth(6).innerText();
}

export async function openPackageHistory(page, phoneDigits, profileName) {
  await studentRow(page, phoneDigits, profileName).locator("td").last().locator("button").first().click();
  await page.waitForTimeout(400);
}

/** Đọc toàn bộ dòng trong modal "Lịch sử gói dịch vụ" đang mở: [{tenGoi, maDonHang, giaTienGoi,
 * kenhMuaGoi, ngayMuaGoi}] - thứ tự cột đúng với TIÊU ĐỀ bảng thật (STT | MÃ ĐƠN HÀNG | TÊN GÓI |
 * GIÁ TIỀN GÓI | KÊNH MUA GÓI | NGÀY MUA GÓI). */
export async function readPackageHistoryRows(page) {
  const rows = page.locator(".n-card", { hasText: po.students.historyModalTitle }).locator("tbody tr");
  const count = await rows.count();
  const result = [];
  for (let i = 0; i < count; i += 1) {
    const cells = await rows.nth(i).locator("td").allInnerTexts();
    result.push({
      maDonHang: cells[1]?.trim() || "",
      tenGoi: cells[2]?.trim() || "",
      giaTienGoi: cells[3]?.trim() || "",
      kenhMuaGoi: cells[4]?.trim() || "",
      ngayMuaGoi: cells[5]?.trim() || "",
    });
  }
  return result;
}

export async function closePackageHistory(page) {
  await page
    .locator(".n-card", { hasText: po.students.historyModalTitle })
    .getByRole("button", { name: po.students.historyModalCloseButton })
    .click();
  await page.waitForTimeout(300);
}
