# RKL-12/19 - Vào lại lớp sau khi giáo viên duyệt (TC_12, TC_19)

Nguồn: Kế hoạch chạy test "Rời khỏi lớp" - Giai đoạn 4, bước 4.2.

## Vì sao case này KHÔNG phải 1 file `.yaml` Maestro chạy thẳng được

TC_12/19 cần **2 vai trò khác tài khoản** phối hợp giữa 2 bước:
1. Phụ huynh (app, Maestro) chọn lại Trường/Khối/Lớp **đúng lớp vừa rời** > Lưu > trạng thái
   "Đang chờ duyệt vào lớp".
2. Giáo viên phụ trách **đúng lớp đó** (web, Playwright) duyệt yêu cầu.
3. Phụ huynh (app, Maestro) vào lại tab Bài tập, đối chiếu bài còn hạn/quá hạn.

Bước 2 bắt buộc dùng **tài khoản giáo viên đúng chủ của lớp đó**. Trong phiên xác nhận dữ liệu
(2026-09-07, thiết bị `3201d866d40a1681`, tài khoản test `0915775115`):

- Danh sách "Lớp" hiện ra khi chọn "Trường Tiểu học QA" > "Lớp 3" có **3 lựa chọn trùng/gần trùng
  tên** ("Lớp 3A", "Lớp 3B", "3B") - đây là 3 lớp THẬT khác nhau của (khả năng) 3 giáo viên khác
  nhau, tên hiển thị không phải bằng chứng cùng 1 lớp.
- Tài khoản giáo viên test có sẵn (`TEACHER_USERNAME=0912312312`, tên hiển thị "Phương" - xem
  `test_data/accounts.env`) xác nhận **không phải chủ của bất kỳ lựa chọn nào trong 3 lựa chọn
  trên** (verify bằng `student_request_count` qua API `/api/classes/teacher` = 0 cho TẤT CẢ lớp
  của tài khoản này, kể cả sau khi 1 profile con thật submit yêu cầu vào "Lớp 3B" rồi "3B").
- Để loại trừ nhầm lẫn, đã cho tài khoản GV "Phương" tự tạo 1 lớp mới riêng biệt
  (`3QA-RKLTest`, dùng lại `automation/quan_ly_lop_hoc/runtime/addClassFlow.js` - xem mục dưới),
  rồi mở lại sheet chọn Trường/Khối cho 1 profile con MỚI để ép app refetch danh sách lớp - lớp
  mới tạo **vẫn KHÔNG xuất hiện** trong danh sách "Lớp" dù đã chọn lại đúng Trường + Khối (nghi vấn
  danh sách lớp trong luồng "chọn lớp" của app có cache/index riêng không đồng bộ ngay với lớp mới
  tạo qua web GV - CHƯA xác định được nguyên nhân gốc trong phiên này, cần thêm thời gian điều tra
  hoặc dữ liệu mới hơn để verify lại).
- Lớp `3QA-RKLTest` đã được xoá lại (`npm run delete-class`) sau khi xác nhận không dùng được,
  không để lại rác trong tài khoản GV test.

**Kết luận**: trong phạm vi tài khoản test hiện có, KHÔNG xác định được lớp nào ở "Trường Tiểu học
QA" thuộc quyền quản lý của tài khoản giáo viên `0912312312`. Vì vậy bước 2 (duyệt) không thể tự
động hoá đầu-cuối trong phiên này - cần 1 trong 2 điều kiện sau trước khi viết file `.yaml` chạy
thẳng được:
  (a) xác định đúng tài khoản giáo viên phụ trách lớp mà profile con SẼ chọn (dò theo
      `student_request_count` như mục trên, hoặc hỏi người quản lý dữ liệu test), hoặc
  (b) xác nhận lại tại sao lớp mới tạo bởi `addClassFlow.js` không refetch được vào danh sách chọn
      lớp phía app (có thể chỉ là timing/cache phía app cần lượt sau điều tra thêm).

## Cách chạy tay (cho tới khi có 1 trong 2 điều kiện trên)

1. **App (Maestro)** - chọn lại đúng lớp vừa rời, dùng chung cơ chế với
   [`RKL-11-join-new-class-shows-pending.yaml`](RKL-11-join-new-class-shows-pending.yaml) (đổi
   `CLASS_OPTION_TEXT` thành đúng lớp vừa rời ở RKL-06). Sau khi chạy xong, dòng trạng thái profile
   chuyển "Đang chờ duyệt vào lớp".
2. **Web GV (thủ công hoặc Playwright)** - đăng nhập đúng tài khoản giáo viên phụ trách lớp đó >
   "Lớp phụ trách" > vào đúng lớp > bấm "Yêu cầu chờ duyệt" (đã xác nhận thật: nút này nằm cạnh
   heading "Lớp \<tên>", hiện số đếm = `student_request_count`) > duyệt yêu cầu của đúng tên
   profile con. **CHƯA xác nhận được** UI chi tiết bên trong dialog "Yêu cầu chờ duyệt" (dialog
   này luôn rỗng `data: []` trong mọi lần thử ở phiên này vì không tìm được đúng lớp có request
   thật) - khi có đúng lớp, cần mở dialog này để lấy đúng selector cho nút duyệt/từ chối trước khi
   viết `automation/quan_ly_lop_hoc/runtime/approveStudentRequestFlow.js` (chưa tồn tại).
3. **App (Maestro)** - mở lại tab "Bài tập" của đúng profile đó (dùng
   `helpers/ensure-profile-active.yaml` + `helpers/open-tab-homework.yaml`), so sánh:
   - Bài tập ĐANG hạn/đến hạn hôm nay: phải hiện lại.
   - Bài tập ĐÃ quá hạn (tại thời điểm rời lớp): KHÔNG hiện lại (TC_19 - rời lớp khi có bài đến hạn
     hôm nay vẫn xoá/loại học sinh khỏi bài đó đúng rule, không ngoại lệ).

## Tái sử dụng khi đã có đúng lớp/giáo viên

Một khi xác định được đúng cặp (lớp, tài khoản giáo viên), phần **tạo lớp mới cho giáo viên test**
(nếu cần dựng lớp riêng thay vì dùng lớp có sẵn) đã có sẵn, tái sử dụng thẳng - không cần viết lại:

```bash
cd automation
ADD_CLASS_KHOI="Khối 3" ADD_CLASS_TEN_LOP="<tên lớp riêng>" npm run add-class
```

Phần **duyệt yêu cầu vào lớp** cần viết mới (`approveStudentRequestFlow.js`, theo đúng khuôn mẫu
`addClassFlow.js`/`deleteClassFlow.js` - `loginTeacherPortal()` tái sử dụng thẳng, chỉ cần thêm
page object cho dialog "Yêu cầu chờ duyệt" vào `teacherClassPageObjects.js` sau khi có ít nhất 1
request thật để soi cấu trúc DOM).
