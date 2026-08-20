# Testcase — Chức năng "Quản lý lớp học" > Sửa/Chỉnh sửa lớp học (Web GV)

Nguồn: tài liệu yêu cầu mục **3. Quản lý lớp học > 3.1. CRUD lớp học** (mô tả popup "Chỉnh sửa
lớp học", acceptance criteria 3.1.4) do người dùng cung cấp trong hội thoại.

Web GV — chỉ test thủ công cho tới 2026-08-20 (xem ghi chú trong [them-moi.md](them-moi.md));
case "Thêm mới" giờ đã có automation Playwright thật, xem `automation/quan_ly_lop_hoc/`.

Đường vào màn Sửa: Danh sách lớp học -> chọn 1 lớp -> vào màn chi tiết lớp -> bấm nút "Chỉnh
sửa lớp học" -> hiện popup "Chỉnh sửa lớp học".

Case liên quan đến việc **xóa lớp từ trong popup Sửa** (nút "Xoá lớp học") chỉ test luồng mở
popup xác nhận xóa ở đây (EDIT-09); chi tiết đầy đủ luồng xóa nằm ở [xoa-lop.md](xoa-lop.md).

---

| ID | Tên case | Điều kiện / dữ liệu | Bước thực hiện | Kỳ vọng PASS | Coi là FAIL khi | Ưu tiên | AC/Ghi chú |
|----|----------|----------------------|-----------------|--------------|-----------------|---------|------------|
| EDIT-01 | Mở popup "Chỉnh sửa lớp học" đúng dữ liệu hiện tại | Có sẵn 1 lớp (VD "7D", Khối 7, năm 2024-2025) | Danh sách lớp -> chọn lớp -> vào chi tiết -> bấm "Chỉnh sửa lớp học" | Popup mở, 3 field Khối/Lớp/Năm học được điền sẵn đúng dữ liệu hiện tại của lớp; có thêm nút "Xoá lớp học" ở góc trái dưới | Field trống hoặc sai dữ liệu; thiếu nút Xoá lớp học | Cao | 3.1.3 (popup Chỉnh sửa) |
| EDIT-02 | Sửa tên Lớp thành công | Đang ở popup Chỉnh sửa lớp "7D" | Đổi tên Lớp thành "7D-Moi" -> bấm "Lưu" | Popup đóng; danh sách lớp học hiển thị đúng tên mới; thông tin khác (khối, năm học, sĩ số) giữ nguyên | Tên không đổi; lưu bị lỗi; các thông tin khác bị mất/sai theo | Cao | 3.1.2, 3.1.3-5 |
| EDIT-03 | Đồng bộ tên lớp xuống hồ sơ học sinh sau khi sửa | Lớp đang sửa có >= 1 học sinh đã được duyệt vào lớp | Sửa tên Lớp (VD "7D" -> "7D-Moi") -> Lưu -> kiểm tra hồ sơ/báo cáo của học sinh thuộc lớp đó | Tên lớp hiển thị ở hồ sơ học sinh (và các màn liên quan như báo cáo, danh sách lớp phía học sinh) cập nhật đúng theo tên lớp mới, đồng bộ ngay | Hồ sơ học sinh vẫn hiển thị tên lớp cũ; đồng bộ trễ/không đồng bộ | Cao | **AC4 (3.1.4-4)**: "Sửa lớp sẽ chỉnh sửa tên lớp của các học sinh trong lớp để đồng bộ" |
| EDIT-04 | Sửa Khối của lớp | Lớp hiện tại thuộc Khối 7 | Đổi dropdown Khối sang Khối 8 -> Lưu | Lưu thành công; lớp hiển thị đúng Khối 8 trong danh sách/chi tiết | Không đổi được khối; lưu lỗi | Trung bình | 3.1.2 |
| EDIT-05 | Sửa Năm học của lớp | Lớp hiện tại ở năm 2024-2025; bộ lọc danh sách đang chọn năm 2024-2025 | Đổi dropdown Năm học sang 2025-2026 -> Lưu -> quay lại danh sách, thử đổi bộ lọc năm | Lưu thành công; khi bộ lọc chọn 2025-2026 thấy lớp này; khi bộ lọc chọn lại 2024-2025 KHÔNG còn thấy lớp này | Lớp vẫn hiện ở cả 2 năm hoặc biến mất khỏi cả 2 năm | Trung bình | 3.1.3-3 (bộ lọc năm học) |
| EDIT-06 | Validate bắt buộc — xoá trắng tên Lớp | Đang ở popup Chỉnh sửa | Xoá hết nội dung ô "Lớp" (còn placeholder "Ví dụ: 7A") -> bấm "Lưu" | Hiện lỗi yêu cầu nhập tên lớp; không lưu thay đổi; dữ liệu lớp cũ giữ nguyên | Vẫn lưu được lớp không có tên | Cao | 3.1.2 |
| EDIT-07 | Validate bắt buộc — bỏ chọn Khối (nếu UI cho phép clear) | Đang ở popup Chỉnh sửa | Xoá lựa chọn Khối về trạng thái chưa chọn -> bấm "Lưu" | Hiện lỗi yêu cầu chọn Khối; không lưu | Vẫn lưu được khi thiếu Khối | Cao | 3.1.2 |
| EDIT-08 | Hủy khi đang sửa dữ liệu | Đang ở popup Chỉnh sửa, đã đổi 1 vài field | Bấm "Hủy" | Popup đóng, quay lại màn Lớp học; thông tin lớp trong danh sách giữ nguyên như trước khi sửa (không lưu thay đổi tạm) | Thay đổi vẫn được lưu dù bấm Hủy | Cao | 3.1.3-6 |
| EDIT-09 | Bấm "Xoá lớp học" từ popup Chỉnh sửa | Đang ở popup Chỉnh sửa | Bấm nút "Xoá lớp học" (góc trái dưới) | Hiện đúng popup xác nhận xóa "Xoá lớp học <tên lớp>" với nội dung cảnh báo không thể khôi phục (chi tiết xem file xóa lớp) | Không hiện popup xác nhận; xóa luôn không hỏi lại | Cao | 3.1.3-4 (popup Chỉnh sửa) — chi tiết ở xoa-lop.md |
| EDIT-10 | Đóng popup Chỉnh sửa bằng nút X góc trên | Đang ở popup Chỉnh sửa, đã đổi 1 vài field | Bấm icon "X" | Hành vi giống "Hủy": đóng popup, không lưu | Vẫn lưu 1 phần thay đổi | Trung bình | Suy ra từ layout popup |
| EDIT-11 | Sửa tên Lớp trùng với lớp khác đã tồn tại (cùng Khối/Năm học) | Đã tồn tại lớp "7A" và lớp đang sửa là "7B" (cùng Khối 7, năm 2025-2026) | Đổi tên lớp "7B" thành "7A" -> Lưu | ⚠️ Cần xác nhận: tài liệu không nêu rule chống trùng tên khi sửa | — | Cao | ⚠️ Cần xác nhận với PO/dev |
| EDIT-12 | Quyền chỉnh sửa lớp không do mình phụ trách | GV khác (không phải GV phụ trách lớp) | Thử truy cập trực tiếp màn chi tiết/sửa của lớp không thuộc quyền quản lý | ⚠️ Cần xác nhận: tài liệu không mô tả rule phân quyền chi tiết ngoài "lớp phụ trách" — kỳ vọng hợp lý là không truy cập được / không thấy nút sửa | — | Cao | ⚠️ Cần xác nhận với PO/dev |
| EDIT-13 | Mất kết nối mạng khi bấm Lưu | Tắt mạng / mô phỏng lỗi API | Sửa dữ liệu hợp lệ -> bấm "Lưu" khi mất mạng | Hiện lỗi, popup vẫn mở, dữ liệu vừa sửa không bị mất, cho phép bấm Lưu lại | Mất dữ liệu vừa sửa; popup tự đóng dù chưa lưu thành công | Trung bình | Không có trong tài liệu gốc — case bổ sung theo thực hành QA |
| EDIT-14 | Sửa lớp trong TH danh sách lớp học đang trống | Giáo viên chưa có lớp nào (màn hiển thị default) | Xác nhận không có entrypoint nào để mở popup Chỉnh sửa khi chưa có lớp | Không có nút/luồng nào dẫn tới popup Chỉnh sửa khi danh sách rỗng (hợp lý vì chưa có lớp để sửa) | Xuất hiện lỗi/crash khi vô tình truy cập route sửa lúc chưa có lớp | Thấp | AC5 (3.1.4-5): màn hình default khi chưa có dữ liệu lớp học |

---

<!--
Copy 1 dòng bảng trên để thêm case mới. Khi test thật, ghi kết quả xác nhận (ngày, tài khoản
GV dùng để test, số liệu thật) ngay bên dưới bảng, theo mẫu của
flows/giao_bai_tap/TESTCASES.md.
-->
