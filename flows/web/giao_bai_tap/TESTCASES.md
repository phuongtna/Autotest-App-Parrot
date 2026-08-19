# Testcase - Chức năng "Giao bài tập" (Web GV -> App HS)

Điền testcase theo mẫu bên dưới (giống định dạng đã dùng cho màn "Vui học" / "Bài tập").
Khác với 2 màn kia, case ở đây liên quan tới **2 hệ thống**: web Giáo viên
(https://parrotedu.vn/teacher/login) để giao bài, và app di động tài khoản Học sinh để
nhận thông báo/bài đã giao -> không tự động hoá bằng Maestro (Maestro chỉ chạy trên app
Android) mà dùng để ghi lại bước test manual, tôi sẽ thao tác trực tiếp (web trên máy tính
+ app trên máy ảo/máy thật) để xác nhận hành vi thực tế rồi báo kết quả lại.

---

## TC1: Giáo viên giao bài tập thành công tới nhiều lớp khác khối cho học sinh

ĐÃ XÁC NHẬN THẬT (2026-08-09, tài khoản GV "Phương" 0912312312 - trùng TEACHER_USERNAME/
TEACHER_PASSWORD trong `.env`, không phải tài khoản GV thật ngoài dự án):
- Tài khoản GV này chỉ quản lý 2 lớp: 3B (Khối 3) và 6D (Khối 6) - không có 2 lớp cùng
  khối để test nốt vế "lớp cùng khối vẫn chọn được thêm", nhưng đã xác nhận đúng vế chính:
  chọn 3B -> 6D chuyển disable (xám, không bấm được) ngay lập tức.
- Đã thực hiện thật: chọn lớp 3B, Hạn nộp 20/08/2026, Unit 1: Hello - Lesson 1 - bài
  "G3-U1-Lesson 1: Listen and repeat" -> bấm "Giao bài đã chọn" -> toast "Giao bài tập mới
  thành công" -> danh sách "Bài tập đã giao" tăng đúng 47 -> 48, dòng mới hiện đúng lớp/bài/
  hạn nộp, "0/5 HS đã làm".
- Trên app HS (tài khoản "Ngoc", lớp 3B): mở icon thông báo, nhận được đúng thông báo
  "Ngoc nhận được bài tập "G3-U1-Lesson 1: Listen and repeat" từ cô Phương. Hạn nộp:
  20/08/2026. Chúc con học tốt!" - khớp 100% với bài/hạn nộp vừa giao.
- CHƯA verify được vế "bài tập hiển thị trong danh sách Bài tập của app": danh sách này
  sort theo hạn nộp và khá dài (25-35 item tuỳ filter "2 tuần/1 tháng gần nhất", có xen
  section Unit "Chinh phục" ở giữa) - dò tay chưa tìm thấy đúng card trong thời gian hợp
  lý, không kết luận là thiếu/lỗi, chỉ là chưa xác nhận được qua UI.

Precondition:
- Có tài khoản Giáo viên (GV) đã được cấp quyền, đã đăng nhập được vào web GV tại
  https://parrotedu.vn/teacher/login.
- Tài khoản GV được phân công quản lý ít nhất 2 khối, trong đó có khối gồm >= 2 lớp
  (vd: Khối 3 có lớp 3A và 3B) và 1 khối khác chỉ có 1 lớp (vd: Khối 6 có lớp 6D), để
  kiểm tra được rule disable giữa các khối.
- Có ít nhất 1 học sinh (HS) thuộc lớp sẽ được giao bài (vd: lớp 3A) đã cài app, đã đăng
  nhập, và đã bật quyền nhận thông báo (notification) trên máy đang test.
- Có sẵn Unit/Lesson với danh sách bài tập để chọn giao.

Step:
1. Truy cập web GV tại https://parrotedu.vn/teacher/login, đăng nhập bằng tài khoản GV.
2. Vào menu "Giao bài tập" -> bấm button "Giao bài tập".
3. Ở bước chọn lớp: bấm chọn lớp 3A (thuộc Khối 3).
   - Xác nhận: lớp 6D (thuộc Khối 6, khối khác với lớp vừa chọn) chuyển sang trạng thái
     disable, không bấm chọn được.
   - Xác nhận: lớp 3B (cùng Khối 3 với lớp vừa chọn) vẫn ở trạng thái cho phép chọn.
4. Bấm chọn thêm lớp 3B -> xác nhận cả 3A và 3B đều đang được chọn (giao tới 2 lớp cùng
   1 khối).
5. Chọn "Hạn nộp" là 1 ngày bất kỳ trong khoảng từ ngày hiện tại đến 1 ngày bất kỳ trong
   tương lai.
6. Chọn Unit -> chọn Lesson -> chọn 1 (hoặc nhiều) bài tập bất kỳ trong danh sách bài tập
   của Lesson đó.
7. Bấm "Giao bài đã chọn".

Output:
- Sau khi bấm "Giao bài đã chọn": bài tập vừa giao xuất hiện trong danh sách bài tập đã
  giao ở web GV (đúng lớp 3A + 3B, đúng hạn nộp, đúng bài đã chọn).
- Trên app của HS thuộc lớp 3A (hoặc 3B): nhận được thông báo đẩy (push notification) về
  bài tập mới, và trong icon thông báo của app cũng hiển thị thông báo tương ứng.
- Trong app HS, bài tập GV vừa giao xuất hiện trong danh sách bài tập của HS đó, đúng với
  Unit/Lesson/bài đã chọn và đúng hạn nộp đã đặt ở bước 5.

---

<!--
Copy khối "## TCx" bên trên để thêm case mới.
Có thể ghi thêm dữ liệu test cần dùng (tài khoản GV, lớp, Unit/Lesson...) ngay trong case -
tôi sẽ đưa vào test_data/ nếu cần tái sử dụng.
-->
