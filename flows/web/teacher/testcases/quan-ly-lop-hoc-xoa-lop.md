# Testcase — Chức năng "Quản lý lớp học" > Xóa lớp học (Web GV)

Nguồn: tài liệu yêu cầu mục **3. Quản lý lớp học > 3.1. CRUD lớp học** (mô tả popup "Chỉnh sửa
lớp học" > nút "Xoá lớp học", popup xác nhận xóa, acceptance criteria 3.1.4) do người dùng cung
cấp trong hội thoại.

Web GV — chỉ test thủ công (xem ghi chú trong
[quan-ly-lop-hoc-them-lop.md](quan-ly-lop-hoc-them-lop.md), repo không có automation web).

Đường vào: Danh sách lớp học -> chọn lớp -> chi tiết lớp -> "Chỉnh sửa lớp học" -> bấm "Xoá lớp
học" -> hiện popup xác nhận **"Xoá lớp học `<tên lớp>`"** ("Toàn bộ dữ liệu sẽ không thể khôi
phục sau khi xoá. Bạn có chắc chắn muốn xoá toàn bộ dữ liệu của lớp `<tên lớp>`?") với 2 nút:
"Từ chối" và "Đồng ý".

**Rule quan trọng nhất của nhóm case này (AC3):** có dữ liệu học sinh trong lớp -> **không**
cho phép xóa; không có dữ liệu học sinh -> cho phép xóa. Tài liệu chỉ nêu rule, **không mô tả
UI cụ thể** khi lớp có học sinh (nút ẩn? disable? bấm vẫn hiện popup nhưng báo lỗi khi bấm Đồng
ý?) — các case DEL-04/05/06 liệt kê để không bỏ sót, cần xác nhận với PO/dev trước khi chốt kỳ
vọng PASS/FAIL.

---

| ID | Tên case | Điều kiện / dữ liệu | Bước thực hiện | Kỳ vọng PASS | Coi là FAIL khi | Ưu tiên | AC/Ghi chú |
|----|----------|----------------------|-----------------|--------------|-----------------|---------|------------|
| DEL-01 | Mở popup xác nhận xóa — lớp KHÔNG có học sinh | Lớp test chưa có học sinh nào được duyệt vào (Sĩ số = 0) | Vào popup Chỉnh sửa lớp -> bấm "Xoá lớp học" | Hiện đúng popup "Xoá lớp học `<tên lớp>`" với nội dung cảnh báo không thể khôi phục, 2 nút "Từ chối"/"Đồng ý" | Không hiện popup; sai tên lớp trong tiêu đề; thiếu nội dung cảnh báo | Cao | 3.1.3 (popup Xoá lớp) |
| DEL-02 | Xác nhận xóa thành công — lớp không có học sinh | Đang ở popup xác nhận xóa, lớp không có học sinh | Bấm "Đồng ý" | Lớp bị xóa khỏi hệ thống; biến mất khỏi "Danh sách lớp học"; tiêu đề "Danh sách lớp học (n)" giảm đúng 1; đóng cả 2 popup, quay về màn danh sách | Lớp vẫn còn trong danh sách sau khi xóa; số đếm không giảm; báo lỗi dù đủ điều kiện xóa | Cao | 3.1.3, 3.1.2 "Quản trị viên có thể lựa chọn lớp học bất kì để xóa" |
| DEL-03 | Từ chối xóa — quay lại popup Chỉnh sửa | Đang ở popup xác nhận xóa | Bấm "Từ chối" | Đóng popup xác nhận xóa, quay lại popup "Chỉnh sửa lớp học" (không phải về thẳng danh sách); dữ liệu lớp không đổi | Xóa lớp dù đã bấm Từ chối; quay về sai màn (VD về thẳng danh sách thay vì popup Chỉnh sửa) | Cao | 3.1.3: "Click 'Từ chối', giao diện sẽ tắt Popup và quay lại popup Chỉnh sửa" |
| DEL-04 | Thử xóa lớp ĐANG có dữ liệu học sinh | Lớp test có >= 1 học sinh đã được duyệt vào lớp (Sĩ số > 0) | Vào popup Chỉnh sửa lớp có học sinh -> quan sát/bấm nút "Xoá lớp học" | ⚠️ Cần xác nhận với PO/dev cách thể hiện trên UI, nhưng kết quả cuối cùng bắt buộc đúng rule: lớp **không được xóa** | Lớp bị xóa thành công dù đang có học sinh (vi phạm rule) — đây là FAIL bất kể UI thể hiện thế nào | Cao | **AC3 (3.1.4-3)**: "Khi có dữ liệu học sinh trong lớp -> Không cho phép xóa" |
| DEL-05 | UI khi không cho phép xóa (lớp có học sinh) — nút bị disable ngay từ popup Chỉnh sửa | Lớp có học sinh | Mở popup Chỉnh sửa, quan sát nút "Xoá lớp học" trước khi bấm | ⚠️ Một trong các phương án hợp lệ (cần PO chốt): (a) nút "Xoá lớp học" disable/ẩn khi lớp có học sinh, hoặc (b) nút vẫn bấm được nhưng bấm "Đồng ý" ở popup xác nhận sẽ báo lỗi/toast giải thích lý do không xóa được | Không có phản hồi nào cho GV biết lý do không xóa được (im lặng / không hành động) | Trung bình | ⚠️ Cần xác nhận với PO/dev — bổ sung cho DEL-04 |
| DEL-06 | Bấm "Đồng ý" khi lớp có học sinh (nếu nút không bị chặn từ trước) | Lớp có học sinh, popup xác nhận xóa vẫn mở được | Bấm "Đồng ý" | Hệ thống từ chối thao tác: hiện thông báo lỗi rõ ràng (VD "Lớp học đang có học sinh, không thể xóa"), lớp KHÔNG bị xóa | Lớp bị xóa thành công (vi phạm AC3); hoặc lỗi không rõ ràng/crash | Cao | AC3 (3.1.4-3) |
| DEL-07 | Xóa lớp cuối cùng -> danh sách trống -> màn hình mặc định | GV chỉ còn đúng 1 lớp không có học sinh | Xóa lớp cuối cùng (Đồng ý) | Sau khi xóa, "Danh sách lớp học" hiển thị đúng màn hình mặc định (empty state) theo design, không lỗi/trắng màn | Trắng màn; lỗi khi danh sách rỗng; hiện sai empty state | Trung bình | **AC5 (3.1.4-5)**: "TH chưa có dữ liệu lớp học -> Hiển thị màn hình default giống design" |
| DEL-08 | Đóng popup xác nhận xóa bằng cách khác (bấm ra ngoài / nút X nếu có) | Đang ở popup xác nhận xóa | Bấm ra vùng ngoài popup hoặc icon X (nếu có) | Hành vi tương tự "Từ chối": đóng popup xác nhận, quay lại popup Chỉnh sửa, không xóa | Xóa lớp dù đóng bằng cách khác "Từ chối" | Trung bình | Suy ra từ hành vi popup thông thường |
| DEL-09 | Mất kết nối mạng khi bấm "Đồng ý" | Tắt mạng / mô phỏng lỗi API, lớp đủ điều kiện xóa | Bấm "Đồng ý" khi mất mạng | Hiện lỗi kết nối; lớp KHÔNG bị xóa (dữ liệu vẫn còn trong danh sách); popup cho phép thử lại | Lớp bị coi như đã xóa ở UI dù request thất bại (optimistic update sai); app treo | Trung bình | Không có trong tài liệu gốc — case bổ sung theo thực hành QA |
| DEL-10 | Dữ liệu liên quan sau khi xóa lớp thành công | Lớp vừa xóa từng có bài tập đã giao / báo cáo liên quan (nhưng không có học sinh — theo đúng rule AC3 mới xóa được) | Sau khi xóa, kiểm tra các màn "Giao bài tập", "Báo cáo" có tham chiếu tới lớp vừa xóa | Không còn hiển thị lớp đã xóa ở các bộ lọc/danh sách liên quan; không có lỗi/tham chiếu treo (dangling reference) tới lớp đã xóa | Lớp đã xóa vẫn xuất hiện ở nơi khác; lỗi khi mở màn có tham chiếu tới lớp đã xóa | Thấp | Không có trong tài liệu gốc — case bổ sung theo thực hành QA |

---

<!--
Copy 1 dòng bảng trên để thêm case mới. Khi test thật, ghi kết quả xác nhận (ngày, tài khoản
GV dùng để test, số liệu thật) ngay bên dưới bảng, theo mẫu của
flows/giao_bai_tap/TESTCASES.md.
-->
