# Testcase — Chức năng "Quản lý lớp học" > Thêm mới lớp học (Web GV)

Nguồn: tài liệu yêu cầu mục **3. Quản lý lớp học > 3.1. CRUD lớp học** (statement, flow, mô tả
màn hình "Lớp phụ trách", popup "Thêm mới lớp học", acceptance criteria 3.1.4) do người dùng
cung cấp trong hội thoại.

Đây là màn hình **web Giáo viên** (menu "Lớp phụ trách" -> nút "+ Thêm lớp học"). Giống cách xử
lý ở `flows/giao_bai_tap/TESTCASES.md`: repo này chỉ tự động hoá được app Android bằng Maestro,
không có automation cho web -> các case dưới đây là **spec để test thủ công** trên
https://parrotedu.vn/teacher (hoặc CMS tương ứng), chưa phải flow chạy tự động được.

Case đánh dấu **⚠️ Cần xác nhận với PO/dev** là do tài liệu gốc không mô tả rõ hành vi — liệt
kê ra để không bỏ sót, nhưng cần hỏi lại trước khi coi kết quả nào là đúng/sai.

---

## TC-ADD-FULL: Thêm mới lớp học thành công (luồng đầy đủ, happy path)

ĐÃ XÁC NHẬN THẬT (2026-08-17, tài khoản GV "Phương" 0912312312 — trùng
`TEACHER_USERNAME`/`TEACHER_PASSWORD` trong `.env`, không phải tài khoản GV thật ngoài dự án):

- Trạng thái trước khi test: màn "Lớp phụ trách" chỉ có đúng 1 lớp **"3B"** (năm học 2025-2026),
  Sĩ số: 6, Học sinh Pro: 0, tiêu đề "Danh sách lớp học (1)".
- Bấm "+ Thêm lớp học" → popup **"Thêm mới lớp học"** mở đúng spec: dropdown "Khối học"
  (placeholder "Chọn khối"), input "Tên lớp" (placeholder **"Ví dụ: 7A"**), dropdown "Năm học"
  mặc định sẵn **"Năm học 2025-2026"** (đúng năm học hiện tại — khớp AC2), 2 nút "Hủy"/"Lưu".
- Chọn Khối **"Khối 7"**, nhập tên lớp **"7QA-Test"**, giữ nguyên Năm học 2025-2026 → bấm "Lưu".
- Network xác nhận request thật thành công:
  `POST https://parrotedu.vn/api/classes` → **201**, response:
  ```json
  {
    "status": true,
    "message": "Tạo lớp thành công",
    "data": {
      "id": "da3efdea-e0ea-4627-b119-a11c329d3d4e",
      "name": "7QA-Test",
      "school_id": "5dadbd5d-7d54-4faa-95b7-7f1aec60cdeb",
      "grade_id": "aa9b85d2-b6eb-11f0-95e3-366756151bd8",
      "academic_year_id": "db2c61ad-5e49-4f78-872f-b0adda0d8441",
      "teacher_id": "a7436d6f-4e2d-41ba-8d4a-e7ce8155a412",
      "status": "active",
      "student_count": 0
    }
  }
  ```
- Sau khi Lưu: popup tự đóng ngay, quay lại màn "Lớp phụ trách"; tiêu đề đổi đúng từ
  "Danh sách lớp học (1)" → **"Danh sách lớp học (2)"**; card mới **"7QA-Test"** hiện đúng
  Sĩ số: 0, Học sinh Pro: 0, **không** có nút "Xem yêu cầu" (đúng vì chưa có học sinh xin vào
  lớp); lớp "3B" cũ giữ nguyên không đổi — khớp 100% với mô tả 3.1.3.

Phát hiện thêm (ghi nhận để lưu ý, CHƯA kết luận là lỗi):
- Dropdown "Khối" hiển thị đủ **12 khối (Khối 1 → Khối 12)**, không thấy giới hạn theo "cấp học
  mà trường dạy" như AC1 mô tả (VD trường chỉ dạy tiểu học thì phải chỉ có khối 1-5). Chưa xác
  định được đây là bug hay do trường của GV "Phương" (`school_id`
  `5dadbd5d-7d54-4faa-95b7-7f1aec60cdeb`) dạy liên cấp nên hợp lệ có đủ 12 khối — xem case
  **ADD-02/ADD-03** ở bảng dưới, cần đối chiếu cấp học thật của trường trước khi báo lỗi cho dev.
- Lớp test **"7QA-Test"** (`id: da3efdea-e0ea-4627-b119-a11c329d3d4e`) hiện **vẫn còn tồn tại
  thật** trong tài khoản GV "Phương" sau khi verify xong — chưa dọn dẹp, có thể tái sử dụng làm
  dữ liệu cho case Sửa/Xóa lớp học (xem `quan-ly-lop-hoc-sua-lop.md` /
  `quan-ly-lop-hoc-xoa-lop.md`), hoặc xóa đi qua chính flow DEL-02 nếu không cần giữ lại.

Precondition:
- Có tài khoản GV đã được cấp quyền, đăng nhập được vào web GV tại `https://parrotedu.vn`
  (form đăng nhập số điện thoại + mật khẩu).
- Đang đứng ở menu "Lớp phụ trách" (`/teacher/class`).

Step:
1. Bấm nút "+ Thêm lớp học" ở góc trên phải màn "Lớp phụ trách".
2. Ở popup "Thêm mới lớp học": chọn 1 giá trị bất kỳ ở dropdown "Khối học".
3. Nhập tên lớp (freetext) vào ô "Tên lớp", ví dụ "7A".
4. Giữ nguyên hoặc chọn 1 giá trị ở dropdown "Năm học".
5. Bấm nút "Lưu".

Output:
- Popup đóng ngay sau khi bấm "Lưu" thành công, quay lại màn "Lớp phụ trách".
- Tiêu đề "Danh sách lớp học (n)" tăng thêm đúng 1 so với trước khi thêm.
- Lớp mới xuất hiện đúng trong danh sách với đúng tên/Khối đã chọn, Năm học đã chọn (nếu bộ lọc
  năm học đang xem trùng năm học vừa chọn), Sĩ số: 0, Học sinh Pro: 0, không có nút "Xem yêu cầu".
- Các lớp đã có từ trước không bị thay đổi thông tin.

---

| ID | Tên case | Điều kiện / dữ liệu | Bước thực hiện | Kỳ vọng PASS | Coi là FAIL khi | Ưu tiên | AC/Ghi chú |
|----|----------|----------------------|-----------------|--------------|-----------------|---------|------------|
| ADD-01 | Mở popup "Thêm mới lớp học" | GV đã đăng nhập, đang ở màn "Lớp phụ trách" | Bấm nút "+ Thêm lớp học" (góc trên phải) | Hiện popup "Thêm mới lớp học" với 3 field: Khối (dropdown, placeholder "Chọn khối"), Lớp (text input, placeholder "Ví dụ: 7A"), Năm học (dropdown); 2 nút Hủy/Lưu | Popup không mở; thiếu field; sai placeholder | Cao | 3.1.3 |
| ADD-02 | Danh sách Khối đúng theo cấp học của trường | GV thuộc trường có đủ 3 cấp (Tiểu học/THCS/THPT) hoặc trường chỉ dạy 1 cấp | Mở popup Thêm -> bấm dropdown "Khối" | Chỉ hiện đúng các khối thuộc cấp học mà trường đang dạy (VD trường chỉ có Tiểu học -> chỉ hiện khối 1,2,3,4,5; không hiện 6-12) | Hiện khối không thuộc trường; thiếu khối trường có dạy | Cao | AC1 (3.1.4-1) — ⚠️ Thử thật với acc GV "Phương" (2026-08-17): dropdown hiện đủ Khối 1->12 dù lớp hiện có chỉ là "3B". Chưa biết trường này có thật sự dạy liên cấp hay đây là bug chưa filter theo trường — cần đối chiếu dữ liệu trường/cấp học thật trước khi kết luận |
| ADD-03 | Nhóm khối hiển thị đúng theo cấp (Tiểu học 1-5, THCS 6-9, THPT 10-12) | Trường dạy đủ 3 cấp | Mở dropdown Khối, xem toàn bộ list | Đúng 12 khối (1->12), đúng nhóm cấp theo tài liệu: Tiểu học 1-5, THCS 6-9, THPT 10-12 (nhóm khối set cứng trong code, không phụ thuộc năm học) | Sai khối trong nhóm cấp; thiếu/thừa khối | Trung bình | AC1, mô tả 3.1.2 |
| ADD-04 | Dropdown "Năm học" hiển thị đúng danh sách + mặc định năm hiện tại | Có nhiều năm học đã được quản trị viên (admin) tạo trong hệ thống | Mở popup Thêm -> xem dropdown Năm học | Danh sách năm học đúng với danh sách admin đã tạo; giá trị mặc định = năm học hiện tại (VD 2025 - 2026) | Thiếu/thừa năm học so với admin đã tạo; mặc định sai năm hiện tại | Cao | AC2 (3.1.4-2) |
| ADD-05 | Thêm lớp học thành công (happy path) | Đã mở popup Thêm | Chọn Khối bất kỳ -> nhập tên Lớp (VD "7A") -> chọn Năm học -> bấm "Lưu" | Popup đóng; lớp mới xuất hiện đúng (tên/khối/năm học) trong "Danh sách lớp học"; tiêu đề "Danh sách lớp học (n)" tăng thêm 1 (nếu đang lọc đúng năm học vừa chọn); lớp mới có Sĩ số = 0, không có nút "Xem yêu cầu" | Không lưu được; lớp không xuất hiện hoặc sai thông tin; số đếm không tăng | Cao | 3.1.2, 3.1.3-4 — **ĐÃ XÁC NHẬN THẬT**, xem chi tiết luồng đầy đủ ở mục **TC-ADD-FULL** phía trên |
| ADD-06 | Validate bắt buộc — chưa chọn Khối | Đã mở popup Thêm | Bỏ trống Khối, nhập Lớp + chọn Năm học -> bấm "Lưu" | Hiện lỗi/inline validation yêu cầu chọn Khối; không tạo lớp, popup không đóng | Vẫn lưu được lớp không có Khối; không báo lỗi gì | Cao | 3.1.2 "báo lỗi nếu thiếu thông tin bắt buộc" |
| ADD-07 | Validate bắt buộc — để trống tên Lớp | Đã mở popup Thêm | Chọn Khối + Năm học, để trống ô "Lớp" -> bấm "Lưu" | Hiện lỗi yêu cầu nhập tên lớp; không tạo lớp | Vẫn lưu được lớp không có tên; không báo lỗi | Cao | 3.1.2 |
| ADD-08 | Validate bắt buộc — chỉ nhập khoảng trắng cho tên Lớp | Đã mở popup Thêm | Nhập tên Lớp toàn dấu cách (VD "   ") -> bấm "Lưu" | ⚠️ Cần xác nhận: hệ thống nên coi như rỗng và báo lỗi (không nêu rõ trong tài liệu) | — | Thấp | ⚠️ Cần xác nhận với PO/dev |
| ADD-09 | Hủy khi đang nhập dữ liệu | Đã mở popup Thêm, đã nhập một phần dữ liệu | Bấm "Hủy" | Popup đóng, quay lại màn "Lớp học"; dữ liệu vừa nhập không được lưu; danh sách lớp học không đổi | Vẫn tạo lớp dù bấm Hủy; giữ dữ liệu nháp khi mở lại popup | Trung bình | 3.1.3-5 |
| ADD-10 | Đóng popup bằng nút X góc trên | Đã mở popup Thêm | Bấm icon "X" ở góc trên popup | Hành vi giống nút "Hủy": đóng popup, không lưu | Hành vi khác Hủy (VD vẫn lưu 1 phần) | Trung bình | Suy ra từ layout popup (nút X) |
| ADD-11 | Thêm lớp trùng tên trong cùng Khối + Năm học với lớp đã có | Đã tồn tại lớp "7A" - Khối 7 - năm 2025-2026 | Mở popup Thêm -> Khối 7, Lớp "7A", Năm học 2025-2026 -> Lưu | ⚠️ Cần xác nhận: tài liệu không nêu rule chống trùng tên lớp — xác nhận với PO có cho phép trùng hay phải báo lỗi | — | Cao | ⚠️ Cần xác nhận với PO/dev |
| ADD-12 | Giới hạn độ dài / ký tự đặc biệt của tên Lớp | Đã mở popup Thêm | Nhập tên lớp rất dài (VD 100 ký tự) hoặc có ký tự đặc biệt/emoji -> Lưu | ⚠️ Cần xác nhận: tài liệu chỉ ghi "Freetext", không nêu giới hạn ký tự hay ký tự cấm | — | Thấp | ⚠️ Cần xác nhận với PO/dev |
| ADD-13 | Thêm lớp ở năm học khác với năm đang lọc trên danh sách | Bộ lọc năm học ở màn danh sách đang chọn năm A | Mở popup Thêm -> chọn Năm học B (khác A) -> nhập Khối/Lớp -> Lưu | ⚠️ Cần xác nhận: lớp mới (năm B) có nên tự hiện trong danh sách đang lọc theo năm A hay không (kỳ vọng hợp lý: không hiện cho tới khi đổi bộ lọc sang năm B) | — | Trung bình | ⚠️ Cần xác nhận, liên quan 3.1.3-3 (bộ lọc năm) |
| ADD-14 | Mất kết nối mạng khi bấm Lưu | Tắt mạng / mô phỏng lỗi API | Điền đầy đủ dữ liệu hợp lệ -> bấm "Lưu" khi mất mạng | Hiện thông báo lỗi (VD "Không thể kết nối"), popup vẫn mở, dữ liệu đã nhập không bị mất, cho phép bấm Lưu lại sau khi có mạng | Mất dữ liệu đã nhập; popup tự đóng dù chưa lưu thành công; app crash/treo | Trung bình | Không có trong tài liệu gốc — case bổ sung theo thực hành QA |
| ADD-15 | Loading/disable nút Lưu khi đang gọi API | Đã điền hợp lệ | Bấm "Lưu" và quan sát ngay sau đó | Nút "Lưu" chuyển trạng thái loading/disable, không cho bấm nhiều lần liên tiếp trong lúc chờ phản hồi | Bấm nhiều lần tạo ra nhiều lớp trùng nhau (double-submit) | Trung bình | Không có trong tài liệu gốc — case bổ sung theo thực hành QA |

---

<!--
Copy 1 dòng bảng trên để thêm case mới. Khi test thật, ghi kết quả xác nhận (ngày, tài khoản
GV dùng để test, số liệu thật) ngay bên dưới bảng, theo mẫu của
flows/giao_bai_tap/TESTCASES.md.
-->
