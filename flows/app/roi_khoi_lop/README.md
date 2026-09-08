# Bộ case RỜI KHỎI LỚP (RKL-*)

Tự động hoá kế hoạch test tay "Rời khỏi lớp" (`Ke_hoach_chay_test_RoiKhoiLop.docx`, 6 giai đoạn
P0-P5, 21 test case TC_01-TC_21). Module này CHỈ phủ phần **flows/app** (phụ huynh thao tác trên
app Android) - phần Giai đoạn 3 (đối chiếu phía web giáo viên, TC_14/15/16) và phần duyệt yêu cầu
vào lớp phía giáo viên (TC_12/19) nằm ngoài phạm vi Maestro, xem ghi chú riêng bên dưới.

## Bắt buộc đọc trước khi chạy: case nào AN TOÀN, case nào GHI DỮ LIỆU THẬT

| Nhóm | Case | Ghi dữ liệu thật? | Chạy lại được nhiều lần? |
| --- | --- | --- | --- |
| Hiển thị/popup | RKL-01, RKL-02, RKL-03, RKL-04, RKL-05 | Không (RKL-02 tự tạo 1 profile con dùng-1-lần nhưng không chọn lớp nào) | Có |
| Rời lớp thật | RKL-06, RKL-18, RKL-20 | **Có - rời lớp thật, không tự hoàn tác được** | Không (cần profile khác có lớp mỗi lần) |
| Tham gia lớp mới | RKL-11 | Có - tạo yêu cầu vào lớp thật (tự tạo profile dùng-1-lần) | Có (profile mới mỗi lần) |
| Rời lớp khi mất mạng | RKL-17 | Có nếu app xử lý SAI (đây là mục đích kiểm) | Có, nhưng PHẢI chạy qua `scripts/run_rkl17_offline_case.sh`, không chạy `maestro test` trực tiếp |
| Vào lại lớp sau khi GV duyệt | RKL-12_19 | N/A - là runbook `.md`, chưa có file `.yaml` chạy thẳng | — |

**KHÔNG chạy RKL-06, RKL-18, RKL-20 tự động trong CI cùng lúc với các case khác mà không xác nhận
trước với người phụ trách dữ liệu test** - đây là các case mutate dữ liệu lớp học thật, cần giáo
viên phụ trách duyệt lại mới đưa profile quay lại đúng lớp.

## Data cần chuẩn bị (Giai đoạn 0 của kế hoạch test)

Staging hiện có sẵn đúng bộ dữ liệu kế hoạch test yêu cầu, dưới tài khoản phụ huynh
`PHONE=0915775115` (xem `test_data/accounts.env`):

| Profile con | Trạng thái (xác nhận thật 2026-09-07) | Dùng cho |
| --- | --- | --- |
| `Hang` | Đang có lớp: `5D - Trường Tiểu học QA` | `PROFILE_WITH_CLASS` (RKL-01, 03, 04, 05, 05b, 06, 18, 20) |
| `Bich diep` | Đang chờ duyệt vào lớp | `PROFILE_OTHER` cho TC_13 (RKL-06), hoặc tham khảo trạng thái "pending" |
| `Duy` | ~~Chưa tham gia lớp học~~ **ĐÃ BỊ THAY ĐỔI** trong phiên viết bộ case này - xem mục "Sự cố dữ liệu" bên dưới | KHÔNG dùng làm `PROFILE_WITHOUT_CLASS` nữa |

### Sự cố dữ liệu đã xảy ra (2026-09-07) - đọc để không lặp lại

Khi verify TC_11 bằng tay để lấy bằng chứng UI thật, profile `Duy` (lúc đó đang "Chưa tham gia lớp
học") đã được dùng để chọn thử Trường/Khối/Lớp - sau khi Lưu, nó chuyển sang "Đang chờ duyệt vào
lớp" và **không có cách nào trong app hủy yêu cầu này** (không có nút "Huỷ yêu cầu" ở màn "Hồ sơ
học tập" khi đang pending). Kết quả: `Duy` hiện đang kẹt ở trạng thái pending vô thời hạn cho tới
khi ĐÚNG giáo viên phụ trách lớp mà nó lỡ chọn duyệt/từ chối yêu cầu đó (chưa xác định được tài
khoản giáo viên nào - xem `RKL-12_19-rejoin-after-teacher-approval.md`).

**Bài học áp dụng cho toàn bộ case trong module này**: KHÔNG dùng profile đặt tên sẵn của tài
khoản (Duy/Hang/Bich diep) cho bất kỳ thao tác nào sẽ CHỌN LỚP (RKL-02, RKL-11) - luôn tự tạo 1
profile con dùng-1-lần bằng `test_data/create_child_profile_data.js` (đã áp dụng trong RKL-02 và
RKL-11). Chỉ dùng profile đặt tên sẵn cho các thao tác KHÔNG đổi trạng thái lớp (RKL-01/03/04/05/
05b chỉ mở popup rồi huỷ, không bấm "Đồng ý" thật).

### CẢNH BÁO DỮ LIỆU (2026-09-08) - Hang/Duy/Bich diep KHÔNG còn thấy trong tài khoản nữa

Kiểm tra thật qua Maestro (`helpers/open-thong-tin-cac-con.yaml`, tài khoản `PHONE=0915775115`)
trong phiên làm việc 2026-09-08: "Thông tin các con" hiện chỉ còn **5 profile** - `Bao`, `Gia Linh`
(`3B - Trường Tiểu học QA`), `Ngoc`, cùng 2 profile `QA Auto Child ...` tạo trong phiên này. **Không
còn `Hang`, `Duy`, hay `Bich diep`** như bảng ở trên mô tả (xác nhận 2026-09-07). Chưa xác định rõ
nguyên nhân - trùng thời điểm người phụ trách cài lại bản staging lên thiết bị test
(`3201d866d40a1681`), khả năng cao là dữ liệu staging đã được reset/reseed. **HỆ QUẢ**: mọi lệnh
`maestro test` mẫu trong README này + các file RKL-01/03/04/05/05b/06/18/20 dùng
`PROFILE_WITH_CLASS=Hang` sẽ FAIL SAI (không tìm thấy profile) cho tới khi xác nhận lại dữ liệu
hiện có và cập nhật `PROFILE_WITH_CLASS`/`PROFILE_OTHER` cho đúng profile thật đang tồn tại (vd
`Gia Linh` đang có lớp `3B`, có thể dùng thay `Hang` sau khi xác nhận lại toàn bộ case với lớp
mới). KHÔNG tự ý sửa lại các file case cho khớp `Gia Linh` mà chưa hỏi người phụ trách dữ liệu -
cần xác nhận trước liệu đây có phải môi trường/tài khoản đúng cho bộ case này không.

## Danh sách case

| Case | TC | Nội dung | Trạng thái xác nhận |
| --- | --- | --- | --- |
| RKL-01 | TC_01 | Nút "Rời khỏi lớp" hiển thị khi profile đang có lớp | **Đã chạy PASS thật** trên thiết bị `3201d866d40a1681` |
| RKL-02 | TC_02 | Không có nút "Rời khỏi lớp" khi chưa có lớp | **Đã chạy PASS thật** (tự tạo profile dùng-1-lần) |
| RKL-03 | TC_03 | Nội dung popup xác nhận | **Đã chạy PASS thật** |
| RKL-04 | TC_04 | "Ở lại" đóng popup, dữ liệu không đổi | **Đã chạy PASS thật** |
| RKL-05 | TC_05 (nhánh tap ngoài) | Tap ngoài popup đóng, dữ liệu không đổi | **Đã chạy PASS thật** |
| RKL-05b | TC_05 (nhánh back) | **NGOÀI PHẠM VI, đã xoá file (2026-09-08, quyết định của user)** - kịch bản không yêu cầu kiểm nhánh back | Đã xoá `.yaml` (tracked trong git, khôi phục được qua `git checkout` nếu cần lại) |
| RKL-06 | TC_06,07,08,09,13,21 | Rời lớp thật + verify toàn bộ hệ quả | Cơ chế cốt lõi **đã chạy PASS thật (2026-09-08)** bằng 1 profile dùng-1-lần trong lớp test: TC_06 (banner "Đã rời khỏi lớp" + Lớp học trống), và **TC_09 xác nhận thật với 1 bài tập THẬT đã giao+đã làm** (không phải lớp rỗng) - sau khi rời, tab "Bài tập" của profile đó hiện đúng "0/0 - Bạn không có bài tập nào đang chờ" ở CẢ 2 bộ lọc ("2 tuần gần nhất" VÀ "1 tháng gần nhất", dùng lại `helpers/homework-select-month-filter.yaml`) - bài `G5-U4-Lesson 3: Listen and match` biến mất hoàn toàn, không chỉ ẩn theo bộ lọc mặc định. Xem TC_14/15/16 bên dưới. File `RKL-06-leave-class-real-full-verify.yaml` (dùng `PROFILE_WITH_CLASS=Hang`) bản thân nó CHƯA chạy được - profile `Hang` không còn tồn tại (xem "CẢNH BÁO DỮ LIỆU" bên dưới), cần đổi `PROFILE_WITH_CLASS`/`PROFILE_OTHER` trước khi chạy |
| RKL-11 | TC_11 | Chọn lớp mới -> "Đang chờ duyệt vào lớp" | **Đã chạy thật, xác nhận cơ chế đúng như spec** |
| RKL-12_19 | TC_12, TC_19 | Vào lại lớp sau khi GV duyệt | **Cơ chế 3 bước đã chạy PASS thật (2026-09-08)** bằng lớp test mới ("5X-RKLRejoin2") - xem runbook `.md`. Phần TC_19 cụ thể (đúng lớp vừa rời + kiểm bài đến hạn/quá hạn) vẫn CHƯA chạy full, phụ thuộc RKL-06 chạy thật trước |
| RKL-17 | TC_17 | Rời lớp khi mất mạng -> lỗi rõ ràng, dữ liệu không đổi | Viết theo spec, CHƯA chạy (cần `scripts/run_rkl17_offline_case.sh`) |
| RKL-18 | TC_18 | Bấm dồn dập "Đồng ý" -> chỉ xử lý 1 lần | Viết theo spec, CHƯA chạy (ghi dữ liệu thật) |
| RKL-20 | TC_20 | Trạng thái loading khi xử lý | Viết theo spec (giới hạn: xem ghi chú trong file), CHƯA chạy |
| TC_14/15 | TC_14, TC_15 | Đối chiếu phía GV: học sinh biến mất khỏi roster + sĩ số giảm đúng 1 | **Đã chạy PASS thật (2026-09-08)** - `automation/quan_ly_lop_hoc/{classRosterSnapshotCli,compareClassRosterCli}.js`, xem `automation/README.md` mục "Snapshot roster lớp" |
| TC_16 | TC_16 | Đối chiếu phía GV: tổng số HS đã làm + điểm TB "Báo cáo lớp" tính lại | **Phần "tổng số HS" đã chạy PASS thật (2026-09-08)** (1 -> 0 đúng sau khi HS duy nhất rời lớp). Phần "điểm TB" **SKIP** (không kết luận được - lớp chỉ có 1 HS nên sau khi rời còn 0 HS, "điểm TB" mất ý nghĩa toán học; cần ≥2 HS ban đầu để verify công thức tính lại thật) - xem `automation/README.md` |
| Case 9 | (không có số TC, đề bài bổ sung riêng) | Đối chiếu CMS "Quản lý học sinh" > cột "TÊN TRƯỜNG": rời lớp/đang chờ duyệt -> để trống ("—"), đã duyệt -> hiện đúng tên trường | **Đã chạy PASS thật (2026-09-08)**, cả 3 trạng thái (đang chờ duyệt/đã duyệt/sau khi rời lớp) - `automation/quan_ly_goi_dich_vu/{readStudentSchoolNameCli,compareSchoolNameSequenceCli}.js`, xem `automation/README.md` mục "Case 9" |
| RKL-case-report-teacher-name-lost | (không có số TC, do QA yêu cầu bổ sung) | Dữ liệu "Báo cáo học tập" (tab Báo cáo, phía app) không bị mất sau khi rời lớp thật | **Đã chạy, FAIL đúng như phát hiện thật (2026-09-08)** - nội dung nhận xét + số liệu (Chuyên cần) giữ nguyên, nhưng **tên giáo viên "Phương" bị xóa mất** khỏi lời chào + chữ ký của báo cáo tuần trước (còn lại khoảng trắng thừa). Dùng profile THẬT `Gia Linh` (lớp 3B cũ, tài khoản BASIC vẫn xem được báo cáo tuần - không bị paywall chặn hoàn toàn như lầm tưởng ban đầu) vì cần dữ liệu báo cáo tuần trước có thật, profile dùng-1-lần mới tạo không có. Xem file `.yaml` để biết chi tiết + label `LOI APP:` dùng để theo dõi bug |

**Không có case cho TC_10**: không tồn tại trong kế hoạch test gốc (đánh số nhảy từ TC_09 sang
TC_11). TC_14/15/16 (Giai đoạn 3 - đối chiếu phía web giáo viên) đã có automation kể từ 2026-09-08
(xem bảng ở trên) - nằm dưới `automation/quan_ly_lop_hoc/` (TC_14/15) và `automation/giao_bai_tap/`
(TC_16), KHÔNG phải Maestro (web không chạy được bằng Maestro) và KHÔNG phải file `.yaml` trong
thư mục này - gọi qua `npm run capture-class-roster`/`compare-class-roster`/
`capture-assignment-snapshot`/`compare-assignment-snapshot`, xem `automation/README.md`.

## Phát hiện đáng chú ý (không phải bug automation)

### (ĐÃ XOÁ) Nút back Android không đóng popup xác nhận rời lớp - NGOÀI PHẠM VI

**QUYẾT ĐỊNH (2026-09-08, user)**: kịch bản KHÔNG yêu cầu kiểm nhánh back của TC_05 - file
`RKL-05b-back-button-does-not-dismiss-popup-BUG.yaml` đã bị XOÁ theo yêu cầu trực tiếp (tracked
trong git, khôi phục được qua `git checkout` nếu sau này cần lại). Không còn là case cần
theo dõi/fix/chạy lại.

Ghi chú lịch sử (không còn hiệu lực để hành động): trước khi xoá, đã xác nhận thật (2026-09-07,
thiết bị `3201d866d40a1681`) rằng popup "Xác nhận rời khỏi lớp" đóng đúng khi bấm "Ở lại" HOẶC tap
ra ngoài vùng popup, nhưng giữ nguyên không phản hồi gì khi bấm nút back cứng của Android.

### Danh sách "Lớp" khi chọn lớp mới có thể có nhiều lớp trùng/gần trùng tên hiển thị

Xác nhận thật (2026-09-07): chọn "Trường Tiểu học QA" + "Lớp 3" hiện ra 3 lựa chọn "Lớp 3A",
"Lớp 3B", "3B" - là 3 lớp THẬT khác nhau (có thể của nhiều giáo viên khác nhau), tên hiển thị
KHÔNG phải bằng chứng cùng 1 lớp. Xem chi tiết + hệ quả tới TC_12/19 trong
[`RKL-12_19-rejoin-after-teacher-approval.md`](RKL-12_19-rejoin-after-teacher-approval.md).

## Helper mới thêm cho module này

- `helpers/open-thong-tin-cac-con.yaml` - mở màn "Thông tin các con" từ tab "Báo cáo".
- `helpers/goto-profile-edit.yaml` - mở "Hồ sơ học tập" của 1 profile theo tên (tham số
  `PROFILE_NAME`), dùng `below` thay vì index cố định để không phụ thuộc thứ tự danh sách.

## Chạy test

```bash
# Case an toàn (không ghi dữ liệu thật ngoài ý muốn)
maestro test flows/app/roi_khoi_lop/RKL-01-leave-button-visible-when-has-class.yaml \
  -e APP_ID=com.inet.parrotedu -e PHONE=0915775115 -e OTP=888888 -e PROFILE_WITH_CLASS=Hang

# Case ghi dữ liệu thật - PHẢI xác nhận trước, không chạy trong CI không giám sát
maestro test flows/app/roi_khoi_lop/RKL-06-leave-class-real-full-verify.yaml \
  -e APP_ID=com.inet.parrotedu -e PHONE=0915775115 -e OTP=888888 \
  -e PROFILE_WITH_CLASS=Hang -e PROFILE_OTHER=Bich diep

# Case cần script wrapper (bật/tắt mạng ngoài Maestro)
./scripts/run_rkl17_offline_case.sh Hang
```

Nhớ thêm `flows/app/roi_khoi_lop/*.yaml` vào `.maestro/config.yaml` (đã thêm sẵn) để Maestro nhận
diện khi chạy `./scripts/run_tests.sh` toàn bộ.
