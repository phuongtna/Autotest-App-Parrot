/**
 * Page Objects cho tab "Tổng kết lớp" của màn "Báo cáo học tập" (Web GV) - cùng màn với
 * `reportHomeworkTabPageObjects.js` (tab "Bài tập về nhà"), chỉ khác tab đang chọn. Vào đúng
 * màn/lớp bằng `gotoReportHomeworkTab()` + `switchReportClass()` (import lại từ file đó) TRƯỚC,
 * rồi gọi `gotoClassSummaryTab()` ở đây để chuyển tab.
 *
 * ĐÃ XÁC NHẬN THẬT (2026-09-10, `reportClassSummaryDiscovery.mjs` chạy lại đúng lớp chỉ định
 * `7QA-Test-20260909_085649` + probe DOM riêng, screenshot/DOM dump/network log thật):
 *   - Tab "Tổng kết lớp" cạnh tab "Bài tập về nhà" (bấm text để chuyển).
 *   - Droplist "Học kỳ" góc phải: đúng 3 option "Học kỳ I"/"Học kỳ II"/"Cả năm", default
 *     "Học kỳ I" - trigger là 1 custom combobox (KHÔNG phải `<select>` native).
 *   - Zone "Tổng quát": 3 card "ĐIỂM TB CUỐI KỲ"/"ĐIỂM TB GIỮA KỲ"/"ĐIỂM TB BÀI TẬP" - TH chưa có
 *     dữ liệu hiển thị ĐÚNG "-" (không phải "0"/NaN).
 *   - "Kết quả học tập": droplist "Sắp xếp theo:" LÀ `<select>` NATIVE (KHÔNG phải Radix - ĐÃ GẶP
 *     THẬT: `getByText(...).click()` trên 1 `<option>` timeout vì option ẩn khi select đóng) -
 *     `<select>` ĐẦU TIÊN trên trang, 7 option đúng thứ tự value/text:
 *     avg="Điểm trung bình" (default) / tx1="Điểm 15'(1)" / tx2="Điểm 15'(2)" / tx3="Điểm 15'(3)" /
 *     tx4="Điểm 15'(4)" / gk="Thi giữa kỳ" / ck="Thi cuối kỳ". Nút "NHẬP ĐIỂM" (button, exact text,
 *     chỉ 1 nút này khi popup CHƯA mở) ngay cạnh. Bảng 9 cột (TÊN HỌC SINH, ĐIỂM 15'(1-4),
 *     THI GIỮA KỲ, THI CUỐI KỲ, ĐIỂM TB, XẾP HẠNG - cột cuối bị cắt khỏi viewport chuẩn, PHẢI đọc
 *     qua DOM/innerText, KHÔNG dùng screenshot để đếm cột). Dòng
 *     "Hiển thị X–Y trên tổng số Z học sinh" LUÔN hiển thị (kể cả Z=1, KHÔNG có nút số trang khi
 *     Z nhỏ - lớp chỉ định chỉ có 1 học sinh nên không quan sát được nút số trang thật).
 *   - Bấm "NHẬP ĐIỂM" (nút mở, accessible name IN HOA thật, KHÔNG phải nút submit trong popup) mở
 *     1 modal overlay THẬT "Nhập điểm từ file" (xác nhận qua screenshot: nền tối phủ, khối trắng
 *     giữa màn hình, icon "×" đóng góc phải - KHÔNG có attribute `role="dialog"` nên dò qua
 *     `[role="dialog"]` trả về `null`, dù đúng là modal) gồm: hướng dẫn + nút/link "TẢI FILE MẪU"
 *     + vùng kéo-thả file (`.xlsx`/`.xls`, tối đa 10MB) + 2 nút "Hủy"/"Nhập điểm" (nút submit).
 *     ĐÃ GẶP THẬT: nút "Hủy" + nút submit "Nhập điểm" hiển thị IN HOA nhưng là CSS
 *     `text-transform: uppercase` (accessible name thật viết hoa-đầu, KHÁC nút MỞ gốc vốn đã IN
 *     HOA thật trong DOM) - dò 2 nút này bằng regex không phân biệt hoa/thường. Đóng lại AN TOÀN
 *     (không tạo/sửa dữ liệu) bằng bấm đúng nút "Hủy".
 *   - "Chuyên cần": droplist "Sắp xếp theo:" CŨNG LÀ `<select>` NATIVE - `<select>` THỨ HAI trên
 *     trang (thứ tự DOM: select đầu = Kết quả học tập, select sau = Chuyên cần), 3 option:
 *     homework="Bài tập cô giao" (default) / self_study="Bài tự học" / time="Thời gian học". Bảng
 *     4 cột (TÊN HỌC SINH, BÀI TẬP CÔ GIAO, BÀI TỰ HỌC, THỜI GIAN HỌC), cùng dòng phân trang
 *     "Hiển thị X–Y trên tổng số Z học sinh".
 *   - API xác nhận qua network log (`GET /api/scores?...&semester=2`): lớp chỉ định có
 *     `classAvg.bt2Avg=0` + `industryStats[0]` toàn 0 cho Học kỳ II - XÁC NHẬN THẬT (không suy
 *     đoán) lớp này KHÔNG có dữ liệu Học kỳ II - mọi case cần dữ liệu Học kỳ II (so sánh kỳ,
 *     default focus kỳ II...) THẬT SỰ không thể test được với fixture hiện tại, không phải do
 *     chưa tìm đúng chỗ.
 */
import { gotoReportHomeworkTab, switchReportClass, waitForReportContentSettled } from "./reportHomeworkTabPageObjects.js";

export { gotoReportHomeworkTab, switchReportClass, waitForReportContentSettled };

/** Chuyển sang tab "Tổng kết lớp" - gọi SAU khi đã ở màn "Báo cáo học tập" (gotoReportHomeworkTab). */
export async function gotoClassSummaryTab(page) {
  await page.getByText("Tổng kết lớp", { exact: true }).first().click();
  await waitForReportContentSettled(page);
}

/** Đọc label đang chọn của droplist "Học kỳ" (custom combobox, không phải native select). */
export async function getSelectedSemesterLabel(page) {
  const trigger = page.getByText(/^Học kỳ (I|II)$|^Cả năm$/).first();
  return (await trigger.textContent())?.trim() ?? null;
}

/** Mở droplist "Học kỳ", xác nhận đúng 3 option hiển thị, rồi ĐÓNG LẠI bằng Escape (KHÔNG đổi lựa
 * chọn - tránh side effect ngoài dự kiến, cùng nguyên tắc reportClassSummaryDiscovery.mjs). */
export async function openSemesterDropdownAndReadOptions(page) {
  const currentLabel = await getSelectedSemesterLabel(page);
  await page.getByText(currentLabel, { exact: true }).first().click();
  await page.waitForTimeout(500);
  const expectedOptions = ["Học kỳ I", "Học kỳ II", "Cả năm"];
  const visibleOptions = [];
  for (const label of expectedOptions) {
    const count = await page.getByText(label, { exact: true }).count();
    if (count > 0) visibleOptions.push(label);
  }
  await page.keyboard.press("Escape").catch(() => {});
  return { currentLabel, visibleOptions };
}

/** Đọc 3 card zone "Tổng quát" - dùng evaluate thuần (KHÔNG dùng Playwright locator xpath
 * ancestor - ĐÃ GẶP THẬT: xpath đoán cấp tổ tiên sai gây timeout 60s/treo browser). Cùng kỹ thuật
 * "tìm phần tử LÁ theo text nhãn rồi đọc phần tử LÁ khác trong cùng khối cha" đã dùng thật trong
 * `teacherReportPageObjects.js#readStudentResultSummary`.
 *
 * ĐÃ GẶP THẬT (2026-09-10): nhãn card hiển thị IN HOA ("ĐIỂM TB CUỐI KỲ") chỉ là CSS
 * `text-transform: uppercase` - `textContent` DOM thật là chữ thường/hoa đầu câu
 * ("Điểm TB cuối kỳ"), khác với `innerText`/text hiển thị (đã áp dụng CSS) dùng ở chỗ khác trong
 * file này. So khớp KHÔNG phân biệt hoa/thường để không phụ thuộc CSS. */
export async function readOverviewCards(page) {
  async function readCardValue(labelText) {
    return page.evaluate((label) => {
      const target = label.toUpperCase();
      const labelEl = Array.from(document.querySelectorAll("div,span,p")).find(
        (el) => el.children.length === 0 && el.textContent.trim().toUpperCase() === target,
      );
      if (!labelEl) return null;
      let card = labelEl.parentElement;
      for (let i = 0; i < 5 && card && card.children.length < 2; i++) card = card.parentElement;
      if (!card) return null;
      const leaves = Array.from(card.querySelectorAll("*")).filter(
        (el) => el.children.length === 0 && el.textContent.trim(),
      );
      const valueEl = [...leaves].reverse().find((el) => el.textContent.trim().toUpperCase() !== target);
      return valueEl ? valueEl.textContent.trim() : null;
    }, labelText);
  }
  return {
    diemTbCuoiKy: await readCardValue("ĐIỂM TB CUỐI KỲ"),
    diemTbGiuaKy: await readCardValue("ĐIỂM TB GIỮA KỲ"),
    diemTbBaiTap: await readCardValue("ĐIỂM TB BÀI TẬP"),
  };
}

/** Đọc <select> "Sắp xếp theo:" của "Kết quả học tập" - LUÔN LÀ select đầu tiên trên trang (xem
 * ghi chú "ĐÃ XÁC NHẬN THẬT" ở đầu file). */
export function resultSortSelect(page) {
  return page.locator("select").nth(0);
}

/** Đọc <select> "Sắp xếp theo:" của "Chuyên cần" - LUÔN LÀ select thứ hai trên trang. */
export function attendanceSortSelect(page) {
  return page.locator("select").nth(1);
}

/** Đọc value hiện tại + toàn bộ option {value,text} của 1 <select> (dùng cho cả 2 droplist Sắp
 * xếp trên) - đọc qua DOM thật, không suy đoán thứ tự. */
export async function readNativeSelect(selectLocator) {
  return selectLocator.evaluate((el) => ({
    currentValue: el.value,
    options: Array.from(el.options).map((o) => ({ value: o.value, text: o.textContent.trim() })),
  }));
}

/** Đọc header + 1 dòng dữ liệu của bảng "Kết quả học tập" theo tên học sinh, + dòng phân trang -
 * LUÔN LÀ bảng ĐẦU TIÊN trên trang (thứ tự DOM trên-xuống-dưới khớp thứ tự hiển thị thật, cùng quy
 * ước với `resultSortSelect`/`attendanceSortSelect` ở trên - ĐÃ XÁC NHẬN THẬT qua discovery). */
export async function readResultTable(page, studentName) {
  return readIndexedTable(page, 0, studentName);
}

/** Đọc header + 1 dòng dữ liệu của bảng "Chuyên cần" theo tên học sinh, + dòng phân trang - LUÔN
 * LÀ bảng THỨ HAI trên trang. */
export async function readAttendanceTable(page, studentName) {
  return readIndexedTable(page, 1, studentName);
}

async function readIndexedTable(page, tableIndex, studentName) {
  const table = page.locator("table").nth(tableIndex);
  const headers = await table.locator("thead th, thead td").allInnerTexts();
  const row = table.locator("tbody tr", { hasText: studentName });
  const rowCells = (await row.count()) > 0 ? await row.first().locator("td").allInnerTexts() : null;
  // Dòng "Hiển thị X-Y trên tổng số Z học sinh" nằm NGAY SAU bảng (không phải trong <table>) - đọc
  // qua khối cha gần nhất chứa cả bảng lẫn dòng này bằng evaluate thuần (tránh lặp lại lỗi xpath
  // ancestor đã gặp ở readOverviewCards).
  const paginationText = await table.evaluate((tableEl) => {
    let container = tableEl.parentElement;
    for (let i = 0; i < 5 && container; i++) {
      const match = container.textContent.match(/Hiển thị\s+\d+[–-]\d+\s+trên tổng số\s+\d+\s+học sinh/);
      if (match) return match[0];
      container = container.parentElement;
    }
    return null;
  });
  return {
    headers: headers.map((h) => h.trim()).filter(Boolean),
    rowCells: rowCells ? rowCells.map((c) => c.trim()) : null,
    paginationText,
  };
}

/** Mở popup "Nhập điểm từ file" (render inline, KHÔNG phải role=dialog - xem ghi chú đầu file) -
 * bấm ĐÚNG nút mở gốc (chỉ có 1 nút "NHẬP ĐIỂM" trên trang lúc popup CHƯA mở). */
export async function openNhapDiemPopup(page) {
  await page.getByRole("button", { name: "NHẬP ĐIỂM", exact: true }).click();
  await page.getByText("Nhập điểm từ file", { exact: true }).waitFor({ timeout: 10000 });
}

/** Đóng popup "Nhập điểm từ file" AN TOÀN - bấm nút "Hủy" (KHÔNG bấm "NHẬP ĐIỂM" submit, không
 * chọn/tải file nào - giữ ĐÚNG nguyên tắc CHỈ ĐỌC của toàn bộ case Module II). ĐÃ GẶP THẬT: nút
 * hiển thị "HỦY" IN HOA chỉ là CSS `text-transform: uppercase` (cùng hiện tượng với nhãn card ở
 * `readOverviewCards`) - `getByRole("button",{name:"HỦY",exact:true})` không khớp accessible name
 * thật ("Hủy") - dùng regex không phân biệt hoa/thường thay vì đoán case chính xác. */
export async function closeNhapDiemPopup(page) {
  await page.getByRole("button", { name: /^hủy$/i }).click();
  await page.getByText("Nhập điểm từ file", { exact: true }).waitFor({ state: "hidden", timeout: 10000 });
}

/** Đọc nội dung popup "Nhập điểm từ file" đang mở (hướng dẫn, nút tải file mẫu, nút Hủy/Nhập điểm).
 * "TẢI FILE MẪU" không xác nhận là `<button>` hay `<a>` - dò theo TEXT (getByText). Nút "Hủy"/
 * "Nhập điểm" dò không phân biệt hoa/thường (xem ghi chú ở `closeNhapDiemPopup`). */
export async function readNhapDiemPopupContent(page) {
  const hasDownloadTemplateButton = (await page.getByText("TẢI FILE MẪU", { exact: true }).count()) > 0;
  const hasCancelButton = (await page.getByRole("button", { name: /^hủy$/i }).count()) > 0;
  const hasSubmitButton = (await page.getByRole("button", { name: /^nhập điểm$/i }).count()) > 0;
  return { hasDownloadTemplateButton, hasCancelButton, hasSubmitButton };
}
