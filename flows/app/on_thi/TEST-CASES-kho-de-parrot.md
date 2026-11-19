# Bảng test case — Tab "Ôn thi" > "Kho đề Parrot" (Danh sách đề + 2 bottom sheet Lọc/Tìm)

Nguồn: chuyển thể từ `~/Downloads/Ôn thi-Kho đề.xlsx` (Jira PAR-3170, `TC_PAR_DSDE_1..56`, 56 test
case) sang bộ automation Maestro. QA **ĐÃ CHẠY THẬT và Pass** toàn bộ 56 case này trên thiết bị thật
(kèm ảnh chụp `prnt.sc` đính kèm xlsx gốc) - khác các module `on_thi` viết trước đây (OT-*) vốn CHƯA
từng chạy thật lần nào khi viết code. Vì vậy mọi NGUYÊN VĂN TEXT dưới đây (tên sheet, tên tab, nhãn
trạng thái...) coi là **đã xác nhận thật**, nhưng **CHƯA có file `.yaml`/selector nào trong nhóm này
từng chạy qua `maestro test` thật** - không suy đoán quá mức cho phần *cơ chế tap* (đặc biệt 2 icon
Lọc/Tìm kiếm không có text hiển thị, và vài selector mới dùng lần đầu: `selected`/`enabled` kết hợp
`text`, `pressKey: Enter`, `eraseText`, tap theo tọa độ `%` - xem chi tiết từng ghi chú trong mỗi
file).

Cột **Auto** = có file Maestro viết sẵn (CHƯA chạy thật, xem trên). Phần lớn case là **guarded
block** (tham số optional, tự skip nếu không truyền đủ dữ liệu) theo đúng kỹ thuật đã dùng ở
`CD-35_36_37_38_39_40_41-dong-nhat-2-nguon-de.yaml` - KHÔNG hardcode tên đề/kỳ thi/lớp cụ thể nào
làm mặc định bắt buộc (xem memory `feedback_never_hardcode_score_or_exercise`), QA tự truyền tham số
đúng dữ liệu thật đang có trên môi trường test khi chạy có ý nghĩa.

Trang bị mới: `automation/on_thi/navigation/onThiPageObjects.js#khoDeParrot` (selector/copy riêng
tab Kho đề Parrot), `flows/app/helpers/open-kho-de-parrot-filter-sheet.yaml`,
`flows/app/helpers/open-kho-de-parrot-search-sheet.yaml`.

---

## I. Màn hình Danh sách đề (TC_1 .. TC_32)

### 1. Card "Tiếp tục bài đang làm dở" — `KDE-01_to_05-card-tiep-tuc-lam-do.yaml`

| ID | Tên case | Auto | Ghi chú |
| --- | --- | --- | --- |
| TC_1 | Hiển thị card khi có đề đang làm dở | ✅ | guarded `DE_NAME_LAM_DO` |
| TC_2 | Không hiển thị khi không có đề làm dở | ✅ | mặc định khi KHÔNG truyền `DE_NAME_LAM_DO` |
| TC_3 | Chỉ hiện đề làm dở GẦN NHẤT khi có ≥2 đề | ✅ | guarded `DE_NAME_LAM_DO` + `DE_NAME_LAM_DO_2` |
| TC_4 | Tap "Tiếp tục" vào đúng đề, giữ tiến trình | ✅ | guarded `DE_NAME_LAM_DO` |
| TC_5 | Card tự ẩn sau khi hệ thống tự động nộp do hết giờ | ❌ | cần đề thời lượng rất ngắn do QA tự tạo, không thực tế chờ timer thật trong CI (cùng giới hạn OT-33) |

### 2. Label "N đề" — `KDE-06_to_08-label-so-luong-de.yaml`

| ID | Tên case | Auto | Ghi chú |
| --- | --- | --- | --- |
| TC_6 | Đúng tổng số đề ở bộ lọc mặc định | ✅ | không truyền `EXPECTED_COUNT_DEFAULT` -> chỉ verify ĐỊNH DẠNG (cùng giới hạn OT-02, chưa có network-capture API) |
| TC_7 | Cập nhật ngay sau khi áp dụng bộ lọc mới | ✅ | guarded `EXAM_TYPE_WITH_MATCH` |
| TC_8 | "0 đề" khi bộ lọc không khớp đề nào | ✅ | guarded `EXAM_TYPE_NO_MATCH` |

### 3. Card đề trong danh sách — `KDE-09_to_16-card-noi-dung-dieu-huong.yaml`

| ID | Tên case | Auto | Ghi chú |
| --- | --- | --- | --- |
| TC_9 | Sắp xếp mới nhất lên đầu | ✅ | BẰNG CHỨNG YẾU (chỉ xác nhận newest không cần cuộn, oldest cần cuộn), không đếm vị trí chính xác |
| TC_10 | Card đủ Loại kỳ thi/Tên đề/Thời lượng/Số câu | ✅ | guarded `DE_NAME_CONTENT_CHECK` |
| TC_11 | Card gắn Pro hiển thị badge Pro | ✅ | guarded `DE_NAME_PRO` |
| TC_12 | Card không gắn Pro không có badge | ✅ | guarded `DE_NAME_FREE` |
| TC_13 | Đề Chưa công khai bị ẩn khỏi danh sách | ✅ | guarded `DE_NAME_UNPUBLISHED`, QA tự unpublish trên CMS trước |
| TC_14 | Đề đang làm dở bị unpublish GIỮA LÚC làm vẫn cho nộp + ẩn sau đó | ❌ | cần Node orchestrator App (mid-exam) + Web/CMS xen giữa cùng lúc - cùng lý do Ghi chú #3 của `TEST-CASES.md` (OT-20/21/22), CHƯA đọc `automation/ngan_hang_de_thi/`/`flows/web/giao_bai_tap/giao_de_luyen_tap/` để biết có sẵn thao tác "Ẩn đề" dạng code hay không |
| TC_15 | Xóa đề trên CMS mất cả lịch sử làm bài | ✅ (1 phần) | guarded `DE_NAME_CMS_DELETED`, QA tự xóa trên CMS trước; chỉ verify "mất card danh sách", KHÔNG tự verify được phần "mất lịch sử làm bài" bằng 1 assertion đơn giản |
| TC_16 | Tap Card -> đúng màn Thông tin đề | ✅ | guarded `DE_NAME_NAV` |

### 4. Rule trạng thái đề & điểm số — `KDE-17_to_24-rule-trang-thai-diem-so.yaml`

| ID | Tên case | Auto | Ghi chú |
| --- | --- | --- | --- |
| TC_17 | Hoàn thành, không phiên dở -> "Đã hoàn thành" | ✅ | guarded `DE_NAME_COMPLETED_ONLY` |
| TC_18 | Từng hoàn thành + đang làm dở lần 2 -> "Đang làm dở" ưu tiên | ✅ | guarded `DE_NAME_RETRY_IN_PROGRESS` (chung khối với TC_23) |
| TC_19 | Chưa từng làm -> không hiển thị trạng thái nào | ✅ | guarded `DE_NAME_NEVER_DONE` |
| TC_20 | Tự chuyển "Đã hoàn thành" khi hết giờ tự động nộp | ❌ | cần đề thời lượng rất ngắn, cùng lý do TC_5 |
| TC_21 | "Điểm số: X" đúng theo BA note bổ sung | ✅ | guarded `DE_NAME_SCORE_CHECK` + `EXPECTED_SCORE` |
| TC_22 | Hoàn thành nhiều lần -> hiển thị điểm CAO NHẤT | ✅ | guarded `DE_NAME_MULTI_ATTEMPT` + `EXPECTED_HIGHEST_SCORE` |
| TC_23 | Đang làm dở không hiển thị Điểm số của lần trước | ✅ | chung khối TC_18 |
| TC_24 | Sau auto-submit, Điểm số = cao nhất TÍNH CẢ lần tự nộp | ❌ | cần đề thời lượng rất ngắn, cùng lý do TC_5/20 |

### 5. Rule phân quyền gói (Free/Pro/Dùng thử) — `KDE-25_to_32-rule-phan-quyen-goi.yaml`

| ID | Tên case | Auto | Ghi chú |
| --- | --- | --- | --- |
| TC_25 | Free làm được đề Free | ✅ | guarded `DE_NAME_FREE`, dùng profile BASIC ("Gia Linh") |
| TC_26 | Free bị chặn "Làm lại" đề Free đã làm | ✅ (best-effort) | guarded `DE_NAME_FREE_COMPLETED` |
| TC_27 | Free bị chặn AI giải thích đề Free | ✅ (best-effort) | guarded `DE_NAME_FREE_COMPLETED`; nút "Giải thích" tái dùng text đã verify ở module Bài tập, CHƯA xác nhận module Ôn thi dùng chung |
| TC_28 | Free xem Thông tin đề Pro OK, chặn khi Bắt đầu | ✅ | guarded `DE_NAME_PRO`, cùng pattern đã Pass ở `CD-35_36_37_38_39_40_41` (TC_40) |
| TC_29 | Pro làm Pro không giới hạn | ✅ (1 phần) | guarded `DE_NAME_PRO`, dùng profile PRO ("Ngoc"); chỉ verify "không bị chặn + Làm lại/Xem lại hiện ra", KHÔNG verify sâu nội dung AI giải thích |
| TC_30 | Dùng thử làm Pro như Pro | ❌ | KHÔNG có tài khoản Dùng thử trong `test_data/accounts.env` - guarded `PHONE_TRIAL`, tự skip nếu chưa truyền |
| TC_31 | Hết hạn Pro vẫn xem Kết quả/đáp án đề Pro đã làm | ❌ | KHÔNG có tài khoản hết hạn Pro có sẵn - guarded `PHONE_EXPIRED_PRO`, tự skip |
| TC_32 | Hết hạn Pro bị chặn AI giải thích/Làm lại | ❌ | cùng lý do TC_31, chung khối |

---

## II. Bottom sheet "Lọc đề thi" (TC_33 .. TC_49)

### 1. Mở sheet, badge số lượng, tab Loại kỳ thi — `KDE-33_to_41-mo-sheet-tab-loai-ky-thi.yaml`

| ID | Tên case | Auto | Ghi chú |
| --- | --- | --- | --- |
| TC_33 | Tap icon Lọc mở đúng sheet, 2 tab | ✅ | icon Lọc CHƯA xác nhận selector tap thật (đoán accessibility label) |
| TC_34 | Badge số lượng khi khác mặc định | ✅ (yếu) | guarded, chỉ verify YẾU qua text (không tách được badge khỏi icon) |
| TC_35 | Không badge khi ở mặc định | ✅ (yếu) | chỉ chụp screenshot để QA đối chiếu bằng mắt |
| TC_36 | Thứ tự Kỳ thi đúng CMS | ✅ | guarded `EXAM_TYPE_LIST`, không hardcode mặc định |
| TC_37 | Mặc định tick "Tất cả kỳ thi" | ✅ | dùng `selected: true` kết hợp `text` - CHƯA có tiền lệ cho đúng component này |
| TC_38 | Chọn 1 kỳ thi cụ thể tự hủy "Tất cả" | ✅ | guarded `EXAM_TYPE_SAMPLE` + `EXAM_TYPE_SAMPLE_2` |
| TC_39 | Chọn nhiều kỳ thi cùng lúc | ✅ | chung khối TC_38 |
| TC_40 | Tick lại "Tất cả" hủy các lựa chọn cụ thể | ✅ | chung khối TC_38 |
| TC_41 | Bỏ tick hết cụ thể -> tự tick lại "Tất cả" | ✅ | chung khối TC_38 |

### 2. Tab Lớp & nút Xác nhận — `KDE-42_to_49-tab-lop-xac-nhan.yaml`

| ID | Tên case | Auto | Ghi chú |
| --- | --- | --- | --- |
| TC_42 | Tab Lớp đúng danh sách Khối set cứng | ✅ | guarded `CLASS_LIST` |
| TC_43 | Lần đầu vào tab -> tự chọn đúng Khối theo profile | ✅ | guarded `EXPECTED_DEFAULT_CLASS`, không ép buộc "lần đầu tuyệt đối" |
| TC_44 | Chọn nhiều Khối cùng lúc | ✅ | guarded `CLASS_SAMPLE_1` + `CLASS_SAMPLE_2` |
| TC_45 | Badge "Lớp (N)" trên tên tab | ✅ | chung khối TC_44 |
| TC_46 | "Xác nhận" disable khi chưa đổi gì | ✅ | dùng `enabled: false` - CHƯA có tiền lệ trong repo |
| TC_47 | "Xác nhận" active khi đã đổi | ✅ | dùng `enabled: true`, cùng giới hạn TC_46 |
| TC_48 | Bấm Xác nhận áp dụng đúng bộ lọc + đóng sheet | ✅ | guarded `EXAM_TYPE_SAMPLE` + `CLASS_SAMPLE_CONFIRM` |
| TC_49 | Chạm ngoài sheet -> đóng, KHÔNG áp dụng | ✅ | guarded `CLASS_SAMPLE_OUTSIDE_TAP`, tap theo tọa độ `"50%,5%"` CHƯA xác nhận thật |

---

## III. Bottom sheet "Tìm đề thi" (TC_50 .. TC_56) — `KDE-50_to_56-tim-de-thi.yaml`

| ID | Tên case | Auto | Ghi chú |
| --- | --- | --- | --- |
| TC_50 | Tap icon Tìm kiếm mở đúng sheet, placeholder đúng | ✅ | icon Tìm kiếm CHƯA xác nhận selector tap thật |
| TC_51 | Tìm theo tên trả đúng 1 kết quả | ✅ | guarded `SEARCH_KEYWORD` + `SEARCH_RESULT_DE_NAME` |
| TC_52 | Tìm kiếm KHÔNG bị giới hạn bởi bộ lọc danh sách | ✅ | guarded `EXAM_TYPE_FILTER_UNRELATED` + `SEARCH_KEYWORD_52` |
| TC_53 | Không khớp -> "Không tìm thấy đề phù hợp" | ✅ | LUÔN chạy, không cần dữ liệu đặc biệt |
| TC_54 | Enter khi trống không báo lỗi bắt buộc | ✅ | LUÔN chạy |
| TC_55 | Xóa nội dung -> về trạng thái ban đầu | ✅ | dùng `eraseText` (lệnh Maestro, chưa có tiền lệ trong repo) thay vì đoán icon xóa; guarded `SEARCH_KEYWORD` |
| TC_56 | Chọn 1 dòng kết quả -> đúng màn Thông tin đề | ✅ | guarded `SEARCH_KEYWORD` + `SEARCH_RESULT_DE_NAME` |

---

## Ghi chú chung

1. **56/56 case có file Maestro**, nhưng 5 case (TC_5/20/24/30/31/32... thực chất 6: TC_5, TC_14,
   TC_20, TC_24, TC_30, TC_31/32) đánh dấu ❌ vì cần 1 trong 2 thứ KHÔNG có sẵn: (a) đề thời lượng
   cực ngắn để chờ auto-submit thật trong CI, hoặc (b) tài khoản Dùng thử/đã hết hạn Pro, hoặc (c)
   Node orchestrator phối hợp Web+App cùng lúc (TC_14) - xem cột Ghi chú từng dòng.
2. **Không có tài khoản "Dùng thử" (Trial) nào trong `test_data/accounts.env`** tại thời điểm viết
   bộ test này - tài khoản `PHONE`/`OTP` hiện có chỉ 2 hồ sơ Free/Pro ("Gia Linh"/"Ngoc"). TC_30 để
   `PHONE_TRIAL` optional, tự skip cho tới khi QA tạo tài khoản thật.
3. **2 icon Lọc/Tìm kiếm không có text hiển thị** - cả 2 helper mở sheet tạm đoán selector theo
   accessibility label trùng tên chức năng ("Lọc"/"Tìm kiếm"), CHƯA đối chiếu `maestro hierarchy`
   thật. Đây là điểm CẦN XÁC MINH ĐẦU TIÊN khi chạy thật lần đầu nếu gặp FAIL "Element not found".
4. **Badge số lượng trên icon Lọc (TC_34/35) và trạng thái tick checkbox (TC_37..41/43..47)** là 2
   nhóm selector MỚI lần đầu dùng cho đúng component này (`selected`/`enabled` kết hợp `text`) -
   tuy Maestro có hỗ trợ 2 property này (đã có tiền lệ dùng `selected` kết hợp `id` ở
   `flows/app/exercise/EX-15-one-choice-any-build.yaml`), nhưng CHƯA xác nhận hoạt động khi định
   danh bằng `text` cho component checkbox này - nếu FAIL đúng bước đó, đối chiếu `maestro
   hierarchy` thật rồi đổi sang `id` nếu checkbox có id riêng.
