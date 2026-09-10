/**
 * Page Objects cho màn "Báo cáo học tập" > tab "Bài tập về nhà" (Web GV, sidebar "Báo cáo học
 * tập", điều hướng tới `/teacher/dashboard`) - ĐÂY LÀ màn ĐÚNG mà Module I "Bài tập về nhà" của kế
 * hoạch automation 85 case mô tả (zone "Thống kê bài làm", "Phổ điểm", "Biểu đồ phân tích lỗi
 * sai"...), KHÁC với màn "Giao bài tập" > "Danh sách bài tập đã giao" > "Xem báo cáo"
 * (`/teacher/exercise/{id}/report`, xem `teacherAssignedListPageObjects.js` +
 * `teacherReportPageObjects.js`) - 2 màn khác hẳn nhau dù cùng nói về "báo cáo bài tập":
 *   - "Giao bài tập" > "Xem báo cáo": quản lý bài tập, dữ liệu gần như real-time.
 *   - "Báo cáo học tập" > "Bài tập về nhà" (file NÀY): màn báo cáo tổng hợp, có độ trễ batch
 *     1 lần/ngày + quy tắc "chỉ hiện từ ngày hôm sau hạn nộp" (xem
 *     `flows/web/teacher/testcases/bao-cao-hoc-tap/TEST-CASES-tong-ket-lop.md` mục "Bối cảnh
 *     cadence" - quy tắc áp dụng chung cho cả tab "Tổng kết lớp" LẪN tab "Bài tập về nhà" này).
 *
 * ĐÃ XÁC NHẬN THẬT (2026-09-10, `reportHomeworkTabDiscovery.mjs`, tài khoản GV "Phương", lớp
 * `7QA-Test-20260909_085649`, screenshot + DOM dump thật):
 *   - Sidebar "Báo cáo học tập" -> điều hướng client-side, URL cuối = `/teacher/dashboard` (KHÔNG
 *     có URL con riêng cho tab/lớp).
 *   - Heading "Báo cáo lớp" + droplist chọn lớp ngay cạnh (hiển thị CHÍNH tên lớp đang chọn dạng
 *     text bấm được, KHÔNG phải `<select>` native, KHÔNG match `role=combobox` qua evaluate ban
 *     đầu) - default lúc mới vào là lớp "3B" (xác nhận thật 2 lần chạy độc lập).
 *   - 2 tab "Bài tập về nhà" (mặc định)/"Tổng kết lớp" ngay dưới droplist.
 *   - Nội dung tab có SPINNER RIÊNG (không phải text "Hãy chờ trong giây lát" dùng ở màn khác) -
 *     1 lần `waitForLoadState("networkidle")` KHÔNG đủ (ĐÃ GẶP THẬT: dump lúc còn spinner) - phải
 *     chờ thêm ~3s rồi networkidle lại lần 2 (xem `waitForReportContentSettled`).
 *   - TH lớp CHƯA có bài tập nào hiển thị trên tab này (dù đã giao thật trên "Giao bài tập" -
 *     đúng quy tắc cadence, KHÔNG phải bug): text CHÍNH XÁC
 *     `Lớp {className} chưa có bài tập nào được giao` + nút `GIAO BÀI TẬP NGAY`.
 */

/** Vào màn "Báo cáo học tập" từ sidebar (hoạt động từ bất kỳ trang nào khác trong app GV). */
export async function gotoReportHomeworkTab(page) {
  await page.getByText("Báo cáo học tập", { exact: false }).first().click();
  await page.getByText("Báo cáo lớp", { exact: true }).first().waitFor({ timeout: 15000 });
  await waitForReportContentSettled(page);
}

/** Chờ nội dung tab (Bài tập về nhà/Tổng kết lớp) tải xong - xem ghi chú "ĐÃ XÁC NHẬN THẬT" ở đầu
 * file: có spinner riêng (không phải text "Hãy chờ trong giây lát"), 1 lần networkidle KHÔNG đủ
 * và cả chờ cố định 3s cũng KHÔNG đủ (ĐÃ GẶP THẬT lần chạy Playwright Test thật: vẫn còn spinner
 * sau 3s). SỬA: chờ ĐÚNG 1 trong 2 kết quả cuối cùng thật sự xuất hiện (empty-state HOẶC ≥1 dòng
 * bảng dữ liệu) với timeout đủ rộng, thay vì đoán khoảng thời gian cố định. */
export async function waitForReportContentSettled(page) {
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await Promise.race([
    page.getByText(/chưa có bài tập nào được giao/i).first().waitFor({ timeout: 20000 }),
    page.locator("table tbody tr").first().waitFor({ timeout: 20000 }),
  ]).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
}

/**
 * Đổi lớp trong droplist "Báo cáo lớp" - bấm vào label ĐANG hiển thị (`currentLabel`, mặc định
 * "3B" - default xác nhận thật của tài khoản GV "Phương") để MỞ dropdown trước, rồi mới bấm tên
 * lớp đích (lúc đó mới có trong danh sách option hiển thị) - bấm thẳng tên lớp đích khi dropdown
 * còn đóng sẽ không trúng gì (ĐÃ GẶP THẬT ở lượt khảo sát đầu, xem reportHomeworkTabDiscovery.mjs).
 * Cùng kỹ thuật đã xác nhận trong `reportClassSummaryDiscovery.mjs` (tab "Tổng kết lớp").
 */
export async function switchReportClass(page, targetClassLabel, { currentLabel = "3B" } = {}) {
  await page.getByText(currentLabel, { exact: true }).first().click();
  await page.getByText(targetClassLabel, { exact: false }).first().click();
  await waitForReportContentSettled(page);
}

/**
 * Đọc trạng thái rỗng của tab "Bài tập về nhà" (TH lớp chưa có bài tập nào hiển thị trên report -
 * xem ghi chú "ĐÃ XÁC NHẬN THẬT" ở đầu file để biết text chính xác).
 * @returns {Promise<{isEmpty:boolean, messageText:string|null, hasCtaButton:boolean}>}
 */
export async function readHomeworkTabEmptyState(page) {
  const emptyHeading = page.getByText(/chưa có bài tập nào được giao/i);
  const isEmpty = (await emptyHeading.count()) > 0;
  const messageText = isEmpty ? (await emptyHeading.first().textContent())?.trim() ?? null : null;
  const hasCtaButton = (await page.getByRole("button", { name: "GIAO BÀI TẬP NGAY" }).count()) > 0;
  return { isEmpty, messageText, hasCtaButton };
}
