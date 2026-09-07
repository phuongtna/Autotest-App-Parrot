# Bộ case RỜI KHỎI LỚP (RKL-*)

Tự động hoá kế hoạch test tay "Rời khỏi lớp" (`Ke_hoach_chay_test_RoiKhoiLop.docx`, 6 giai đoạn
P0-P5, 21 test case TC_01-TC_21). Module này CHỈ phủ phần **flows/app** (phụ huynh thao tác trên
app Android) - phần Giai đoạn 3 (đối chiếu phía web giáo viên, TC_14/15/16) và phần duyệt yêu cầu
vào lớp phía giáo viên (TC_12/19) nằm ngoài phạm vi Maestro, xem ghi chú riêng bên dưới.

## Bắt buộc đọc trước khi chạy: case nào AN TOÀN, case nào GHI DỮ LIỆU THẬT

| Nhóm | Case | Ghi dữ liệu thật? | Chạy lại được nhiều lần? |
| --- | --- | --- | --- |
| Hiển thị/popup | RKL-01, RKL-02, RKL-03, RKL-04, RKL-05, RKL-05b | Không (RKL-02 tự tạo 1 profile con dùng-1-lần nhưng không chọn lớp nào) | Có |
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

## Danh sách case

| Case | TC | Nội dung | Trạng thái xác nhận |
| --- | --- | --- | --- |
| RKL-01 | TC_01 | Nút "Rời khỏi lớp" hiển thị khi profile đang có lớp | **Đã chạy PASS thật** trên thiết bị `3201d866d40a1681` |
| RKL-02 | TC_02 | Không có nút "Rời khỏi lớp" khi chưa có lớp | **Đã chạy PASS thật** (tự tạo profile dùng-1-lần) |
| RKL-03 | TC_03 | Nội dung popup xác nhận | **Đã chạy PASS thật** |
| RKL-04 | TC_04 | "Ở lại" đóng popup, dữ liệu không đổi | **Đã chạy PASS thật** |
| RKL-05 | TC_05 (nhánh tap ngoài) | Tap ngoài popup đóng, dữ liệu không đổi | **Đã chạy PASS thật** |
| RKL-05b | TC_05 (nhánh back) | **Nút back thiết bị KHÔNG đóng popup** - xem mục Bug bên dưới | **Đã chạy, FAIL đúng như dự kiến** (chốt bug) - xem "HỆ QUẢ VẬN HÀNH" trong file, chạy cô lập/cuối cùng |
| RKL-06 | TC_06,07,08,09,13,21 | Rời lớp thật + verify toàn bộ hệ quả | Viết theo spec + helper đã verify riêng lẻ, CHƯA chạy full (ghi dữ liệu thật) |
| RKL-11 | TC_11 | Chọn lớp mới -> "Đang chờ duyệt vào lớp" | **Đã chạy thật, xác nhận cơ chế đúng như spec** |
| RKL-12_19 | TC_12, TC_19 | Vào lại lớp sau khi GV duyệt | **CHƯA tự động hoá được** - xem runbook `.md`, cần xác định đúng tài khoản GV |
| RKL-17 | TC_17 | Rời lớp khi mất mạng -> lỗi rõ ràng, dữ liệu không đổi | Viết theo spec, CHƯA chạy (cần `scripts/run_rkl17_offline_case.sh`) |
| RKL-18 | TC_18 | Bấm dồn dập "Đồng ý" -> chỉ xử lý 1 lần | Viết theo spec, CHƯA chạy (ghi dữ liệu thật) |
| RKL-20 | TC_20 | Trạng thái loading khi xử lý | Viết theo spec (giới hạn: xem ghi chú trong file), CHƯA chạy |

**Không có case cho TC_10, TC_14, TC_15, TC_16**: TC_10 không tồn tại trong kế hoạch test gốc
(đánh số nhảy từ TC_09 sang TC_11). TC_14/15/16 thuộc Giai đoạn 3 (đối chiếu phía web giáo viên) -
nằm ngoài phạm vi module `flows/app`, cần 1 bộ Playwright riêng dưới `flows/web/teacher/` nếu muốn
tự động hoá (có thể tái sử dụng `automation/quan_ly_lop_hoc/navigation/teacherClassPageObjects.js`
đã có sẵn `detail`/`classCardCountLabel` cho TC_14/15).

## Phát hiện đáng chú ý (không phải bug automation)

### BUG khả nghi: nút back Android không đóng popup xác nhận rời lớp

Xác nhận thật (2026-09-07, thiết bị `3201d866d40a1681`): popup "Xác nhận rời khỏi lớp" đóng đúng
khi bấm "Ở lại" HOẶC tap ra ngoài vùng popup, nhưng **giữ nguyên không phản hồi gì khi bấm nút back
cứng của Android** (verify bằng 2 screenshot liên tiếp cách nhau ~1s, không đổi). Kế hoạch test gốc
(bước 1.5) kỳ vọng back phải "giống hệt Ở lại". Xem
[`RKL-05b-back-button-does-not-dismiss-popup-BUG.yaml`](RKL-05b-back-button-does-not-dismiss-popup-BUG.yaml) -
case viết đúng theo kỳ vọng spec nên sẽ FAIL cho tới khi app xử lý đúng hardware back cho popup
này, dùng để theo dõi/chốt bug thay vì sửa assert cho qua.

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
