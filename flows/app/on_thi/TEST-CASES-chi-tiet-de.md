# Bảng test case — Màn "Chi tiết đề" (Thông tin đề), dùng chung "Đề thầy cô giao" & "Kho đề Parrot"

Nguồn: `Ôn thi-Chi tiết đề.xlsx` (`TC_APP_OnThi_ChiTietDe_1..41`, 82 lượt Pass Android+iOS — **QA ĐÃ
CHẠY THẬT trên thiết bị**, có ảnh chụp màn hình đính kèm từng case, nguồn đáng tin hơn hẳn phần lớn
module `on_thi` hiện có trong repo vốn phần nhiều đang "CHƯA VERIFY TRÊN THIẾT BỊ THẬT"). Đây LÀ bộ
test case riêng cho màn Chi tiết đề/Thông tin đề — KHÁC `TEST-CASES.md` (bộ `OT-01..42`, màn Danh
sách đề).

**Trạng thái chung: các file `.yaml` bên dưới CHƯA được chạy qua `maestro test` lần nào.** Mọi
selector lấy từ `onThiPageObjects.js#examInfo` (continueButton/resumeIncompletePopup/
historyRowPattern — THÊM MỚI cùng đợt viết bộ `CD-*.yaml` này) là NGUYÊN VĂN text QA đã gõ lại từ
ảnh chụp thật, nhưng **chưa từng chạy qua MaestroBridge/`maestro test` thật** — chưa xác nhận lại
resource-id/khớp đúng cú pháp selector. Không chạy hàng loạt tới khi đã đối chiếu `maestro
hierarchy` thật ít nhất 1 lần trên màn Chi tiết đề (đúng văn hoá chung của repo).

Cột **Auto** = có file Maestro viết sẵn (nhưng CHƯA chạy thật). Cột **Tay** = cần QA verify thêm
bằng mắt/dàn dựng precondition thủ công. Cột **File** = flow Maestro tương ứng.

---

## I.1 Icon button Quay lại (TC_1..4)

| ID | Tên case | Auto | Tay | File |
| --- | --- | --- | --- | --- |
| TC_1 | Quay lại từ "Đề thầy cô giao" giữ nguyên bộ lọc | ✅ | | `CD-01_02_03_04-back-button-preserve-state.yaml` |
| TC_2 | Quay lại từ "Kho đề Parrot" giữ nguyên tab | ✅ | | cùng file trên |
| TC_3 | Quay lại từ kết quả tìm kiếm giữ nguyên từ khoá | ❌ | ✔ | module `on_thi` CHƯA có automation nào cho tính năng tìm kiếm đề (không có page object/helper cho ô tìm kiếm) — cần viết `onThiPageObjects.js#search` + helper mở/nhập từ khoá trước khi tự động hoá case này |
| TC_4 | Back hệ thống tương đương icon Quay lại | ✅ | ✔ | cùng file TC_1 — xem Ghi chú #1 (icon "Quay lại" CHƯA có toạ độ xác nhận, hiện dùng action `back` làm proxy cho CẢ icon lẫn hệ thống nên 2 nhánh đang test TRÙNG cơ chế) |

## I.2 Khối Thông tin chung (TC_5..8)

| ID | Tên case | Auto | Tay | File |
| --- | --- | --- | --- | --- |
| TC_5 | Tên đề đúng cấu hình CMS | ✅ | | `CD-05_06_07_08-thong-tin-chung.yaml` |
| TC_6 | Thời lượng tối đa đúng cấu hình | ✅ | ✔ | cùng file trên — chỉ tự verify ĐÚNG ĐỊNH DẠNG trừ khi truyền `DE_MAX_DURATION_PATTERN` chính xác (xem Ghi chú #2) |
| TC_7 | Tổng số câu = tổng section con | ✅ | ✔ | cùng file trên — cùng giới hạn Ghi chú #2 |
| TC_8 | Tên đề dài không vỡ layout | ✅ | ✔ | cùng file trên — OPTIONAL (cần `DE_NAME_LONG`), không assert được "không vỡ layout" qua text, chỉ chụp màn hình |

## I.3 List Lịch sử làm bài (TC_9..15)

| ID | Tên case | Auto | Tay | File |
| --- | --- | --- | --- | --- |
| TC_9 | Chưa từng nộp -> khối Lịch sử ẩn | ✅ | ✔ | `CD-09_10_11_12_13_14_15-lich-su-lam-bai.yaml` — cần đề `DE_NAME_0_LAN` |
| TC_10 | Đúng 1 lần -> 1 dòng, không "Xem tất cả" | ✅ | ✔ | cùng file trên — cần đề `DE_NAME_1_LAN` |
| TC_11 | Đúng 2 lần -> thứ tự giảm dần, không "Xem tất cả" | ✅ | ✔ | cùng file trên — cần đề `DE_NAME_2_LAN` |
| TC_12 | ≥3 lần -> có "Xem tất cả", chỉ 2 dòng gần nhất | ✅ | ✔ | cùng file trên — cần đề `DE_NAME_3PLUS_LAN` |
| TC_13 | Tap "Xem tất cả" -> mở đủ lịch sử | ✅ | ✔ | cùng file trên |
| TC_14 | Tap 1 dòng -> mở đúng Chi tiết bài đã làm của lượt đó | ✅ | ✔ | cùng file trên — OPTIONAL (cần `DE_3PLUS_TAP_ROW_PATTERN`), CHƯA biết tiêu đề màn đích thật (xem Ghi chú #3) |
| TC_15 | Điểm mỗi dòng đúng là điểm CỦA LƯỢT ĐÓ, không phải cao nhất | ✅ | ✔ | cùng file TC_14 |

## I.4 List Cấu trúc đề (TC_16..20)

| ID | Tên case | Auto | Tay | File |
| --- | --- | --- | --- | --- |
| TC_16 | Thứ tự Section đúng cấu hình CMS | ✅ | ✔ | `CD-16_17_18_19_20-cau-truc-de.yaml` — cần `DE_NAME_2_SECTIONS` + tên 2 section |
| TC_17 | Section có thời lượng hiển thị đúng "N phút" | ✅ | ✔ | cùng file trên |
| TC_18 | Section không thời lượng -> ẩn hẳn nhãn | ✅ | ✔ | cùng file trên |
| TC_19 | Chỉ 1 section vẫn hiển thị đúng | ✅ | ✔ | cùng file trên |
| TC_20 | Cuộn hết ≥6 section, không che nút action | ✅ | ✔ | cùng file trên |

## I.5 Nút Bắt đầu làm bài / Tiếp tục làm bài (TC_21..30) — NHÓM "CASE LÀM BÀI" CHÍNH

| ID | Tên case | Auto | Tay | File |
| --- | --- | --- | --- | --- |
| TC_21 | Hiện "Bắt đầu làm bài" khi chưa có phiên dở | ✅ | ✔ | `CD-21_22_23_24_25_26_27_28_29_30-bat-dau-tiep-tuc-lam-bai.yaml` — cần `DE_NAME_FRESH` |
| TC_22 | Popup xác nhận "Bắt đầu làm bài?" đúng 2 nút | ✅ | ✔ | cùng file trên |
| TC_23 | "Để sau" chỉ đóng popup, chưa tính giờ | ✅ | ✔ | cùng file trên |
| TC_24 | "Bắt đầu" -> vào Doing, đồng hồ chạy ngay | ✅ | ✔ | cùng file trên |
| TC_25 | Đồng hồ không dừng khi thoát-quay lại (~5 phút) | ✅ | ✔ | cùng file trên — OPTIONAL/nặng (gate `RUN_TC25_TIMER_PERSISTENCE`), KHÔNG tự verify được giá trị đồng hồ (xem Ghi chú #4) |
| TC_26 | Hiện "Tiếp tục làm bài" khi đang có phiên dở | ✅ | ✔ | cùng file trên — cần `DE_NAME_INPROGRESS` |
| TC_27 | Popup "Bài làm chưa hoàn thành" đúng 2 nút | ✅ | ✔ | cùng file trên |
| TC_28 | "Tiếp tục" -> resume đúng vị trí, giữ tiến độ | ✅ | ✔ | cùng file trên — chỉ verify tiến độ > "0/N", không đối chiếu đúng số câu trừ khi truyền `DE_INPROGRESS_EXPECTED_PROGRESS` |
| TC_29 | "Làm lại" -> xoá phiên dở, bắt đầu lại từ đầu | ✅ | ✔ | cùng file trên — không verify được đồng hồ reset (giá trị số), chỉ verify luồng vào lại Doing |
| TC_30 | Sau "Làm lại" không phát sinh phiên trùng | ✅ | ✔ | cùng file trên — KHÔNG đếm được số dòng qua Maestro thuần, chỉ best-effort |

## I.6 Rule quyền truy cập theo gói dịch vụ — đề Pro (TC_31..34)

| ID | Tên case | Auto | Tay | File |
| --- | --- | --- | --- | --- |
| TC_31 | Free xem đủ info Pro, bấm Bắt đầu -> bottom sheet nâng cấp | ✅ | ✔ | `CD-31_32_33_34-pro-free-rule.yaml` — dùng hồ sơ `Gia Linh`(BASIC)/`Ngoc`(PRO) có sẵn trong `accounts.env`, xem Ghi chú #5 |
| TC_32 | Free + phiên dở đề Pro -> vẫn bị chặn ở "Tiếp tục" | ✅ | ✔ | cùng file trên — OPTIONAL (cần `DE_NAME_PRO_INPROGRESS`, kịch bản hiếm phải dàn dựng tay) |
| TC_33 | Pro/Dùng thử bấm Bắt đầu đề Pro -> popup xác nhận bình thường | ✅ | ✔ | cùng file trên — chỉ test nhánh Pro (`Ngoc`), KHÔNG có tài khoản "Dùng thử" xác định |
| TC_34 | Free làm đề Free bình thường | ✅ | ✔ | cùng file trên |

## II.1 Đồng nhất/khác biệt giữa 2 nguồn đề (TC_35..41)

| ID | Tên case | Auto | Tay | File |
| --- | --- | --- | --- | --- |
| TC_35 | Đủ 5 khối control, đồng nhất bố cục 2 nguồn | ✅ | ✔ | `CD-35_36_37_38_39_40_41-dong-nhat-2-nguon-de.yaml` — cần cặp `DE_NAME_TEACHER`/`DE_NAME_KHO` cùng cấu hình |
| TC_36 | Lịch sử làm bài tính riêng, không gộp dù trùng tên | ✅ | ✔ | cùng file trên — cần `DE_SAME_TITLE` tồn tại ở cả 2 nguồn |
| TC_37 | Quay lại luôn đúng nguồn, không lẫn | ✅ | ✔ | cùng file trên (lặp lại TC_1/TC_2 liên tiếp trong 1 lượt) |
| TC_38 | Đề thầy cô giao quá hạn vẫn làm/nộp bình thường | ✅ | ✔ | cùng file trên — cần `DE_NAME_OVERDUE_TEACHER` + `DE_OVERDUE_DUE_DATE_DM` |
| TC_39 | Kho đề Parrot không hiển thị nhãn hạn nộp nào | ✅ | ✔ | cùng file trên |
| TC_40 | Rule Pro/Free nhất quán ở cả 2 nguồn | ✅ | ✔ | cùng file trên — cần cặp `DE_NAME_PRO_TEACHER`/`DE_NAME_PRO_KHO`, xem Ghi chú #6 (giả định đóng bottom sheet bằng `back`) |
| TC_41 | Cấu trúc đề nhất quán giữa 2 nguồn nếu cùng cấu hình CMS | ✅ | ✔ | cùng khối TC_35 (dùng chung 1 lượt mở đề) |

---

## Tổng hợp file đã viết

| File | TC | Reuse chính |
| --- | --- | --- |
| `CD-01_02_03_04-back-button-preserve-state.yaml` | 1,2,4 | `open-tab-on-thi.yaml`, `onthi-select-period-filter.yaml`, `open-de.yaml` |
| `CD-05_06_07_08-thong-tin-chung.yaml` | 5,6,7,8 | `open-de.yaml` |
| `CD-09_10_11_12_13_14_15-lich-su-lam-bai.yaml` | 9..15 | `open-de.yaml` |
| `CD-16_17_18_19_20-cau-truc-de.yaml` | 16..20 | `open-de.yaml` |
| `CD-21_22_23_24_25_26_27_28_29_30-bat-dau-tiep-tuc-lam-bai.yaml` | 21..30 | `open-de.yaml`, `launch-keep-session.yaml`, cơ chế "làm bài" của `OnThiExamEngine`/`onThiPageObjects.js` |
| `CD-31_32_33_34-pro-free-rule.yaml` | 31..34 | `ensure-profile-active.yaml`, `open-de.yaml` |
| `CD-35_36_37_38_39_40_41-dong-nhat-2-nguon-de.yaml` | 35..41 | `open-de.yaml` (tham số `ON_THI_TAB`), `ensure-profile-active.yaml` |

**Thay đổi code dùng chung (phục vụ cả bộ CD-*):**
- `flows/app/helpers/open-de.yaml` — thêm tham số `STOP_AT_INFO_SCREEN` (dừng tại màn Thông tin đề
  thay vì tự động đi tiếp vào Doing — hầu hết TC của bộ Chi tiết đề cần assert chính màn này).
- `automation/on_thi/navigation/onThiPageObjects.js#examInfo` — thêm `continueButton`,
  `resumeIncompletePopup`, `historyRowPattern` (NGUYÊN VĂN text từ QA xlsx, xem đầu file này).
- `automation/on_thi/navigation/onThiPageObjects.js#upgradeSheet` — thêm `genericTitlePattern`
  (tái dùng copy chung "Nâng cấp tài khoản" đã capture thật ở module Bài tập làm tín hiệu phát hiện).

## Ghi chú

1. **Icon "Quay lại" chưa có toạ độ/resource-id xác nhận** — ảnh QA đính kèm là link `prnt.sc`
   không truy cập được để soi vị trí icon. TC_1/2/4 hiện dùng Maestro `back` (xác nhận hoạt động
   thật ở nhiều module khác, vd `flows/app/report/RP-15-menu-children-info.yaml`) làm proxy, dựa
   trên chính TC_4 (khẳng định 2 hành vi tương đương) — cần thay bằng tap toạ độ/resource-id thật
   khi có ảnh chụp/`maestro hierarchy` thật để phân biệt lại nếu phát hiện khác biệt.
2. **Không tự tính được số TUYỆT ĐỐI đúng/sai cho Thời lượng tối đa/Tổng số câu** (TC_6/7) vì module
   `on_thi` chưa có network-capture API nào được xác nhận — cùng giới hạn đã ghi ở
   `TEST-CASES.md` Ghi chú #1 (áp dụng y hệt). Mặc định chỉ verify ĐÚNG ĐỊNH DẠNG, verify đúng SỐ khi
   caller truyền sẵn giá trị kỳ vọng qua tham số.
3. **Tiêu đề màn "Chi tiết bài đã làm"** (đích đến khi tap 1 dòng Lịch sử làm bài, TC_14) CHƯA có
   nguyên văn xác nhận — xlsx chỉ mô tả hành vi, không chụp/chép tiêu đề màn. `CD-09..15.yaml` hiện
   chỉ verify gián tiếp (màn đổi nội dung + điểm của lượt tap vẫn hiển thị), CẦN 1 lượt chạy tay/ảnh
   chụp thật để biết tiêu đề chính xác trước khi siết chặt assertion.
4. **`readTimerBadge()` (`onThiExamEngine.js`) chỉ best-effort/diagnostic** — có thể đọc nhầm thời
   lượng audio player thay vì đồng hồ đếm giờ thật (đã ghi nhận va chạm định dạng mm:ss thật). TC_25
   vì vậy chỉ tự động hoá được CƠ CHẾ (không bị kick khỏi phiên dở sau khi thoát/quay lại), KHÔNG tự
   verify được ĐÚNG SỐ PHÚT đã trôi qua — QA đối chiếu 2 ảnh chụp trước/sau bằng mắt.
5. **Giả định "BASIC" (`accounts.env`) == "Free"** (thuật ngữ xlsx dùng) — `PROFILE_BASIC_NAME`/
   `PROFILE_PRO_NAME` vốn được đặt tên cho case `HW-PROFILE-BASIC-PRO-ADVANCED` (module Bài tập),
   TÁI SỬ DỤNG lại cho `on_thi` vì cùng 1 tài khoản/2 hồ sơ — CẦN XÁC MINH lại với BA nếu app phân
   biệt 3 mức Free/Basic/Pro thay vì chỉ 2 mức như tên biến hiện tại ngụ ý. Không có tài khoản "Dùng
   thử" nào xác định trong `accounts.env` — nhánh đó của TC_33 vẫn là Tay.
6. **TC_40 giả định đóng bottom sheet nâng cấp bằng Maestro `back` 2 lần** (1 lần đóng sheet, 1 lần
   thoát màn Info) — CHƯA XÁC MINH sheet này có đóng được bằng back hệ thống hay bắt buộc phải tap
   ra ngoài/nút đóng riêng; nếu FAIL ngay ở khối Kho đề Parrot ngay sau đó, kiểm tra lại bằng
   `maestro hierarchy` thật trước khi kết luận lỗi app.
