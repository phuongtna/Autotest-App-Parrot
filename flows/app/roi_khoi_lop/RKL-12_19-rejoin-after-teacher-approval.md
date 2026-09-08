# RKL-12/19 - Vào lại lớp sau khi giáo viên duyệt (TC_12, TC_19)

Nguồn: Kế hoạch chạy test "Rời khỏi lớp" - Giai đoạn 4, bước 4.2.

## ĐÃ GIẢI QUYẾT (2026-09-08) - cơ chế 3 bước chạy PASS trọn vẹn trên staging

Bản ghi cũ của file này (trước 2026-09-08) kết luận bước 2 "không thể tự động hoá đầu-cuối" vì lớp
test mới tạo (`3QA-RKLTest`) không xuất hiện trong danh sách "Lớp" của app dù đã chọn đúng
Trường+Khối. **Nguyên nhân thật không phải app bug**: lúc đó `npm run add-class` (Playwright, web
GV) mặc định trỏ `TEACHER_PORTAL_BASE_URL` về **production**, trong khi app trên thiết bị test +
toàn bộ dữ liệu module `roi_khoi_lop` (tài khoản `0915775115`, profile Hang/Duy/Bich diep, trường
"Trường Tiểu học QA") nằm ở **staging** - lớp tạo trên production dĩ nhiên không thể xuất hiện
trong danh sách mà app (staging) đọc. Hai môi trường hoàn toàn tách biệt, không liên quan gì đến
cache hay đồng bộ như suy đoán ban đầu.

**Đã fix (2026-09-08)**: `automation/src/config.js` giờ có `TEACHER_PORTAL_ENV` (mặc định
`"staging"`) + hàm `resolveTeacherPortalBaseUrl()`, cùng cơ chế với `CMS_ADMIN_ENV` đã có sẵn cho
`quan_ly_goi_dich_vu`. Xem `.env`/`.env.example` để biết `TEACHER_PORTAL_BASE_URL_STAGING`/
`_PRODUCTION`. **Mọi script Playwright dùng `config.teacherPortalBaseUrl`** (`giao_bai_tap/`,
`quan_ly_lop_hoc/`) từ nay mặc định chạy trên staging - nếu cần production, set
`TEACHER_PORTAL_ENV=production` trong `.env` hoặc truyền override khi gọi `resolveTeacherPortalBaseUrl("production")`.

Xác nhận lại thật (2026-09-08, staging, lớp `"5X-RKLRejoin2"` id
`db7ae7b7-ead9-4fd0-841d-7c1c13c5d57a`, tài khoản GV "Phương" `0912312312`, profile con
`"QA Auto Child 20260908_112008"`) - toàn bộ 3 bước chạy PASS, verify bằng ảnh chụp thật ở mỗi
bước:

1. **App (Maestro)** - [`RKL-12_19-step1-request-join-known-class.yaml`](RKL-12_19-step1-request-join-known-class.yaml):
   tạo profile con dùng-1-lần, chọn "Trường Tiểu học QA" > "Lớp 5" > lớp test (hardcode tên lớp
   trong file - xem "QUAN TRỌNG VỀ ENCODING" trong đó) > Lưu. Kết quả: dòng trạng thái profile
   chuyển "Đang chờ duyệt vào lớp", ảnh `rkl12_19_step1_pending__<CHILD_NAME>` xác nhận. Đọc
   `<CHILD_NAME>` thật từ TÊN FILE screenshot này (Maestro không có cơ chế truyền biến sang tiến
   trình Playwright khác ở bước 2).
   ```bash
   maestro test flows/app/roi_khoi_lop/RKL-12_19-step1-request-join-known-class.yaml \
     -e APP_ID=com.inet.parrotedu -e PHONE=0915775115 -e OTP=888888 \
     -e SCHOOL_SEARCH_TEXT=QA -e SCHOOL_RADIO_POINT=84,978
   ```

2. **Web GV (Playwright)** - `automation/quan_ly_lop_hoc/runtime/approveStudentRequestFlow.js`
   (mới viết 2026-09-08, entrypoint `npm run approve-student-request`): đăng nhập tài khoản GV
   (`TEACHER_USERNAME`/`TEACHER_PASSWORD` trong `.env`) > vào thẳng `/teacher/class/{classId}` >
   mở dialog "Yêu cầu chờ duyệt" > tìm ĐÚNG hàng khớp tên học sinh > bấm "Duyệt" > xác nhận popup
   lồng bên trong ("Duyệt học sinh" - **2 lớp popup xác nhận liên tiếp**, xem ghi chú quan trọng
   bên dưới) > verify hàng biến mất khỏi danh sách chờ duyệt.
   ```bash
   cd automation
   APPROVE_CLASS_ID="<id lớp, lấy từ createdClass.id của add-class>" \
     APPROVE_STUDENT_NAME="<CHILD_NAME đọc từ bước 1>" \
     npm run approve-student-request
   ```
   **Phát hiện quan trọng cho ai viết thêm automation cho dialog này**: bấm "Duyệt" trên 1 hàng
   KHÔNG duyệt ngay - mở tiếp 1 dialog xác nhận lồng bên trên ("Duyệt học sinh", nhắc lại tên học
   sinh, 2 nút "Hủy"/"Xác nhận"). PHẢI bấm "Xác nhận" ở dialog thứ 2 này request duyệt thật mới
   được gửi. Cả 2 dialog đều `role="dialog"` và tên accessible (từ heading `<h2>`) CHỒNG LẤN nhau
   (heading dialog 1 chứa cả text nút "Duyệt tất cả (N)" bên trong cùng thẻ `<h2>`, vô tình khớp
   `getByRole("dialog", {name: "Duyệt học sinh"})` của dialog 2) - `exact:true` KHÔNG đủ để phân
   biệt (đã thử, vẫn sai). Fix dùng trong code: `page.locator('[role="dialog"]', {hasText: ...})`
   với 1 cụm text CHỈ có ở đúng 1 dialog ("Duyệt tất cả" cho dialog 1, "Bạn có chắc chắn muốn duyệt
   học sinh" cho dialog 2) - xem `teacherClassPageObjects.js#pendingRequestsDialog/confirmApproveDialog`.
   Endpoint duyệt thật CHƯA xác định được URL chính xác (không chứa `/requests` như đoán ban đầu) -
   verify bằng thay đổi UI (dialog đổi sang "0 học sinh đang chờ duyệt" + học sinh xuất hiện trong
   roster lớp) thay vì chờ 1 network response cụ thể.

3. **App (Maestro)** - xác nhận lại: profile chuyển từ "Đang chờ duyệt vào lớp" sang hiển thị
   ĐÚNG tên lớp đã duyệt (xác nhận thật: `"5X-RKLRejoin2 - Trường Tiểu học QA"` xuất hiện trong
   "Thông tin các con" ngay sau bước 2, screenshot `verify_rejoin_status` phiên 2026-09-08).
   Chưa có file `.yaml` riêng cho bước này (chỉ cần `helpers/open-thong-tin-cac-con.yaml` +
   `scrollUntilVisible` tên profile + `assertVisible` đúng tên lớp - xem ví dụ trong RKL-06 phần
   TC_07).

## Phần TC_19 (rejoin đúng lớp VỪA RỜI, kiểm bài đến hạn/quá hạn) - vẫn CHƯA chạy full

3 bước trên xác nhận **cơ chế join-request → duyệt → phản ánh lại app hoạt động đúng** bằng 1 lớp
test tạo mới (`5X-RKLRejoin2`, không có bài tập nào). TC_19 cụ thể đòi hỏi rejoin **ĐÚNG lớp mà
profile vừa rời thật** (kịch bản RKL-06, lớp "5D" của Hang) để so sánh bài ĐANG hạn (phải hiện lại)
với bài ĐÃ quá hạn (không hiện lại) - việc này CHƯA chạy vì RKL-06 (rời lớp thật) bản thân nó CHƯA
được chạy thật (ghi dữ liệu thật, cần xác nhận trước - xem README.md). Khi RKL-06 đã chạy thật:

1. Lặp lại bước 1 ở trên nhưng chọn ĐÚNG "5D" (không phải lớp test mới) làm `CLASS_NAME`.
2. Bước 2 dùng `APPROVE_CLASS_ID` = id lớp "5D" thật (lấy qua `automation/quan_ly_lop_hoc` hoặc
   dò qua danh sách "Lớp phụ trách" của đúng giáo viên chủ nhiệm 5D - CHƯA chắc là tài khoản
   `TEACHER_USERNAME` hiện có, cần xác nhận lại giống cách đã dò ở mục "Tái sử dụng" bên dưới).
3. Bước 3 mở tab "Bài tập" của Hang (`helpers/ensure-profile-active.yaml` +
   `helpers/open-tab-homework.yaml`), đối chiếu với ảnh `rkl06_before_bai_tap_tab`/
   `rkl06_tc09_bai_tap_sau_khi_roi` đã chụp trong RKL-06.

## Tái sử dụng - tạo lớp test mới cho giáo viên test (nếu không dùng lớp thật có sẵn)

```bash
cd automation
ADD_CLASS_KHOI="Khối 5" ADD_CLASS_TEN_LOP="<tên lớp riêng>" npm run add-class
```

**LUÔN kiểm tra `TEACHER_PORTAL_ENV` trong `.env` trước khi chạy** (mặc định đã là `"staging"` sau
fix 2026-09-08) - chạy nhầm production sẽ tạo dữ liệu thật ngoài ý muốn (đã xảy ra 1 lần thật
2026-09-08 khi cơ chế môi trường chưa tồn tại, đã xoá tay lớp tạo nhầm ngay sau đó).
