/**
 * Đọc danh sách tên học sinh đang hiển thị trên "Chi tiết lớp" (/teacher/class/:id) - dùng cho
 * TC_14 (kế hoạch test "Rời khỏi lớp" - học sinh KHÔNG còn trong danh sách sau khi rời lớp).
 *
 * ĐÃ XÁC NHẬN THẬT (2026-09-08, staging, lớp "5X-RKLRejoin2" sau khi duyệt 1 học sinh): bảng roster
 * có 3 cột "Học sinh" / "Loại tài khoản" / "Hành động", mỗi hàng có 1 NÚT (`<button>`, KHÔNG phải
 * `<a>` - đã thử `<a>` trước, sai thật, đọc ra 0 hàng dù roster có 1 học sinh) "Xem báo cáo học
 * tập" - dùng nút này để xác định hàng thật (khác hàng trống/skeleton). Trang có 2 `<table>` cùng
 * lúc (nghi 1 bảng ẩn/skeleton tương tự ghi chú "(0)" ẩn trong classListCount.js) nhưng chỉ 1 bảng
 * có `<tr>` thật - scope `main table tbody tr` gộp cả 2 vẫn ra đúng số hàng thật vì bảng kia rỗng.
 */
export async function listClassRosterStudents(page) {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("main table tbody tr")).filter((tr) =>
      Array.from(tr.querySelectorAll("button")).some((b) => /Xem báo cáo học tập/i.test(b.textContent || "")),
    );
    return rows.map((tr) => {
      const cells = Array.from(tr.querySelectorAll("td")).map((c) => c.innerText.trim());
      return cells[0] ?? "";
    });
  });
}
