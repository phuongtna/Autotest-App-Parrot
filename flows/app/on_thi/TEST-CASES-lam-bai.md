# Bảng test case — Màn "Doing" (đang làm 1 lượt đề On thi), bộ "Làm bài"

Nguồn: `Ôn thi.xlsx` (sheet "B.App-Ôn thi-Làm bài", `TC_PAR_OnThiLamBai_1..52`, trùng
`TestCase_PAR-3172_OnThi_LamBai.xlsx` đã được trích dẫn sẵn trong docblock
`automation/on_thi/navigation/onThiPageObjects.js`/`onThiExamEngine.js`). Đây LÀ bộ test case
riêng cho NỘI DUNG màn Doing (section/đồng hồ/tiến độ/đánh dấu/bottom sheet/popup/mất mạng) - KHÁC
`TEST-CASES-chi-tiet-de.md` (bộ `TC_1..41`, chỉ tới lúc VÀO màn Doing, không đi sâu bên trong).

**Trạng thái chung (cập nhật 2026-11-17): đã chạy `maestro test` thật nhiều lần**, không còn "chưa
chạy lần nào" như ghi chú gốc bên dưới. Xem cột **Auto** của từng TC để biết PASS thật/FAIL
thật/chưa chạy tới - đừng tin theo câu mô tả id/text này một mình, ưu tiên các ghi chú "chạy thật"
cụ thể ở mỗi dòng và các mục "Ghi chú TC_*" bên dưới. Phần lớn id/text dùng dưới đây ĐÃ CONFIRMED
thật qua `maestro hierarchy` (xem `onThiPageObjects.js#doing`, 2026-11-04) - rủi ro còn lại chủ yếu
ở các selector MỚI (tên section, thanh Tiến độ, id lúc đã Đánh dấu) chưa từng dump hierarchy, và ở
việc khớp đúng tên/số liệu fixture CMS (`DE_NAME_*`) khi chạy thật lần đầu.

Cột **Auto** = có file Maestro viết sẵn. **Gated** = có nhưng mặc định BỎ QUA (cần chờ thời gian
thật/mất mạng, bật bằng biến env riêng). **Tay** = không tự động hoá được (giới hạn kỹ thuật thật,
không phải chưa viết).

## I. Đề có thời gian theo Section (TC_1..31)

| TC | Tên case | Auto | File |
| --- | --- | --- | --- |
| 1 | Màn Doing hiển thị đủ control | **✅ chạy thật PASS** | `LB-01_02_05_06_07_08_09-hien-thi-danh-dau.yaml` |
| 2 | Tên section đổi đúng khi sang section 2 | **Tay/known-issue** (xem ghi chú lỗi encoding bên dưới) | cùng file trên |
| 3 | Icon Thoát → popup xác nhận | ✅ | `LB-21_to_31-cta-popup.yaml` (TC_29/30) |
| 4 | Nộp bài (toolbar) → popup xác nhận | ✅ | cùng file trên (dùng chung popup với TC_27/28) |
| 5 | Thanh Tiến độ chạy khi chọn đáp án | **✅ chạy thật PASS** (chỉ chụp màn hình, không đọc được %) | `LB-01...09.yaml` |
| 6 | Mỗi Section 1 thanh tiến độ riêng, reset khi đổi | **Tay/known-issue** (dùng chung block với TC_2, xem ghi chú lỗi encoding bên dưới) | cùng file trên |
| 7 | Bật Đánh dấu xem lại | **✅ chạy thật PASS** | cùng file trên |
| 8 | Tắt Đánh dấu xem lại | **✅ chạy thật PASS** | cùng file trên |
| 9 | Câu đã đánh dấu hiện màu cam trong bottom sheet | **✅ chạy thật PASS** (chỉ chụp màn hình, không đọc được màu) | cùng file trên |
| 10 | Đồng hồ khởi tạo đúng N phút | ✅ | `LB-10_to_14-dong-ho-section.yaml` |
| 11 | Đồng hồ đỏ khi dưới 5 phút | Gated | cùng file trên (`RUN_LB11_RED_TIMER`) |
| 12 | Hết giờ section giữa đề → tự chuyển section | Gated, **xác nhận thật ngoài ý muốn** (xem ghi chú bên dưới) | cùng file trên (`RUN_LB12_AUTO_SWITCH`) |
| 13 | Hết giờ section cuối → tự nộp | Gated | cùng file trên (`RUN_LB13_AUTO_SUBMIT`) |
| 14 | Đồng hồ reset đúng khi đổi section (chủ động) | **FAIL thật, chưa rõ gốc rễ** (xem ghi chú bên dưới) | cùng file trên |
| 15 | Nút Danh sách câu hỏi dạng x/y | ✅ | `LB-15_to_20-bottom-sheet-cau-hoi.yaml` |
| 16 | Mở bottom sheet, nhóm theo section | ✅ | cùng file trên |
| 17 | Section đã qua bị khoá trong bottom sheet | ✅ (gián tiếp - xem giới hạn trong file) | cùng file trên |
| 18 | Section chưa mở bị khoá | ✅ (gián tiếp) | cùng file trên |
| 19 | Di chuyển tự do trong section hiện tại | ✅ | cùng file trên |
| 20 | Câu nhóm cha-con tính riêng từng câu con | ✅ (cần biết trước 2 số câu con) | cùng file trên |
| 21 | "Tiếp theo" ở câu giữa section → sang câu kế, không popup | **✅ chạy thật PASS** | `LB-21_to_31-cta-popup.yaml` |
| 22 | Nhãn đổi "Chuyển phần" ở câu cuối section (không phải cuối đề) | **✅ chạy thật PASS** | cùng file trên |
| 23 | Bấm "Chuyển phần" (còn giờ) → popup xác nhận | **✅ chạy thật PASS** | cùng file trên |
| 24 | Nhãn đổi "Nộp bài" ở câu cuối đề | **Tay/known-limit** (xem ghi chú TC_24/27/28 bên dưới - giới hạn thời gian thật của fixture) | cùng file trên |
| 25 | Popup Chuyển phần - "Ở lại" | **✅ chạy thật PASS** (cần fix point-tap, xem ghi chú) | cùng file trên |
| 26 | Popup Chuyển phần - "Chuyển phần" | **✅ chạy thật PASS** (cần fix point-tap, xem ghi chú) | cùng file trên |
| 27 | Popup Nộp bài - "Làm tiếp" | **Tay/known-limit** (cùng lý do TC_24) | cùng file trên |
| 28 | Popup Nộp bài - "Nộp bài" → màn Kết quả | **Tay/known-limit** (cùng lý do TC_24) | cùng file trên |
| 29 | Popup Thoát - "Ở lại làm bài" | ✅ | cùng file trên |
| 30 | Popup Thoát - "Thoát" → lưu + "Đang làm dở" | ✅ | cùng file trên |
| 31 | Hết giờ toàn đề dù đã thoát → tự "Hoàn thành" | Gated | `LB-44_45_46-nen-kill-app.yaml` (chung cơ chế với TC_45, xem `RUN_LB45_KILL_APP_AUTOSUBMIT`) |

## II. Đề không gắn thời gian theo Section (TC_32..43)

**CHƯA CHẠY THẬT ĐƯỢC (2026-11-17):** cột Auto dưới đây vẫn là nhãn LÝ THUYẾT từ lúc viết code, CHƯA
có lần chạy thật nào thành công cho nhóm này. Đã thử với fixture "Đề thi chung 1 kỹ năng"
(DE_NAME_WHOLE_EXAM) nhưng bị chặn bởi 1 lỗi thật chưa fix được - xem docblock đầu file
`LB-32_to_43-de-khong-section-timer.yaml` (nghi do encoding khi truyền tên đề có dấu tiếng Việt qua
`-e` dòng lệnh, scrollUntilVisible cuộn qua hết danh sách mà không khớp được dù thẻ đang hiện ngay
đầu danh sách - CHƯA xác minh dứt điểm gốc rễ). Cần điều tra thêm trước khi tin bất kỳ TC nào trong
nhóm này đã PASS thật.

| TC | Tên case | Auto | File |
| --- | --- | --- | --- |
| 32 | Màn Doing hiển thị 1 đồng hồ chung, không đồng hồ riêng section | ✅ | `LB-32_to_43-de-khong-section-timer.yaml` |
| 33 | Đồng hồ chung đếm đúng tổng thời gian, không reset | ✅ (chỉ chụp màn hình) | cùng file trên |
| 34 | Đồng hồ chung đỏ dưới 5 phút | ✅ (chỉ chụp màn hình) | cùng file trên |
| 35 | Hết giờ → tự nộp, không popup | Gated | cùng file trên (`RUN_LB35_TIMEOUT_AUTOSUBMIT`) |
| 36 | Tiến độ tính theo cả đề, không chia section | ✅ | cùng file trên |
| 37 | "Tiếp theo" giữa section → sang câu kế cùng section | ✅ | cùng file trên |
| 38 | "Tiếp theo" ở câu cuối section → chuyển THẲNG section kế, không popup | ✅ | cùng file trên |
| 39 | Nhãn đổi "Nộp bài" ở câu cuối đề | ✅ | cùng file trên |
| 40 | Bottom sheet cho chọn tự do mọi section, không khoá | ✅ | cùng file trên |
| 41 | Câu nhóm cha-con tính riêng từng câu con | ✅ (cần biết trước 2 số câu con) | cùng file trên |
| 42 | Popup Nộp bài - "Nộp bài" → màn Kết quả | ✅ | cùng file trên |
| 43 | Popup Thoát - "Thoát" → lưu + "Đang làm dở" | ✅ | cùng file trên |

## III. Rule chung: thời gian/kill app/lưu cục bộ/mất mạng (TC_44..52)

| TC | Tên case | Auto | File |
| --- | --- | --- | --- |
| 44 | Đồng hồ không dừng khi thoát (background) | Gated | `LB-44_45_46-nen-kill-app.yaml` (`RUN_LB44_TIMER_BACKGROUND`) — chỉ so sánh TRƯỚC/SAU qua ảnh chụp, không đọc được đúng số phút (xem readTimerBadge) |
| 45 | Kill app hoàn toàn qua mốc hết giờ vẫn tự nộp | **✅ xác nhận thật (tình cờ)** | cùng file trên (`RUN_LB45_KILL_APP_AUTOSUBMIT`) — xem ghi chú bên dưới |
| 46 | Mở lại đề đúng lúc hết giờ → tự nộp ngay | Gated | cùng file trên (`RUN_LB46_REOPEN_AT_TIMEOUT`) — fixture phải được QA tự dàn đúng thời điểm, ngoài phạm vi tự động hoá |
| 47 | Đáp án lưu cục bộ ngay khi chọn | ✅ | `LB-47_48-luu-cuc-bo.yaml` |
| 48 | Đồng bộ server trong ≤10s | **Tay** | module `on_thi` chưa có API/network-capture nào được xác nhận (`onThiModel.js`) - không tự verify được "đã lên server", chỉ verify gián tiếp qua UI (trùng TC_47) |
| 49 | Toast "Mất kết nối" khi mất mạng | Gated/script | `LB-49_to_52-mat-mang.yaml` qua `scripts/run_lb49_52_offline_case.sh` |
| 50 | Vẫn làm bài được khi mất mạng, lưu cục bộ | Gated/script | cùng file trên |
| 51 | Có mạng lại tự đồng bộ | Gated/script, best-effort | cùng file trên — chỉ verify KHÔNG CRASH + đáp án còn, không verify được "đã lên server" (cùng giới hạn TC_48) |
| 52 | Hết giờ lúc mất mạng → có mạng lại mới tự nộp, đúng thời điểm hết giờ | Gated/script, **Tay cho phần "đúng thời điểm"** | cùng file trên (`RUN_LB52_TIMEOUT_WHILE_OFFLINE`, chạy qua `--lb52`) — không đọc được timestamp nộp bài qua UI |

### Ghi chú TC_45 — xác nhận thật tình cờ (2026-11-14)

Trong lúc dò fixture thật, đã vô tình tái hiện đúng TC_45: bấm "Bắt đầu làm bài" trên đề "Đề luyện
tập Unit 2: Health..." (section đầu "Nghe hiểu hội thoại" giới hạn 5 phút), chỉ thao tác ở câu 1
(bật/tắt Đánh dấu xem lại) rồi `adb shell am force-stop` kill hẳn app - KHÔNG bấm Nộp bài/Thoát.
Nhiều phút sau (quá mốc 5 phút của section lẫn tổng 15 phút toàn đề), mở lại danh sách "Đề thầy cô
giao" thấy đúng đề này đã chuyển sang trạng thái ĐÃ NỘP: "59 / 59", "Điểm 0", nút đổi thành "Làm
lại" - ĐÚNG hành vi TC_45 mô tả (kill app qua mốc hết giờ vẫn tự động tính hoàn thành, điểm 0 vì
chưa trả lời câu nào). KHÔNG tự verify được "đúng thời điểm nộp = đúng lúc hết giờ" (không có
timestamp hiển thị qua UI, giống giới hạn đã ghi ở TC_52) - chỉ xác nhận được HÀNH VI xảy ra, không
đo được ĐỘ CHÍNH XÁC thời điểm. Hệ quả: đề này sau sự cố đã tiêu thụ hết (trạng thái "đã nộp"),
không còn dùng được làm fixture "đề thầy cô giao - chưa làm" (TC_1/5/7/8/9 cần `0/59`) - đã giao lại
thành công qua automation "Giao đề luyện tập" (`automation/giao_bai_tap/giao_de_luyen_tap/`, tái sử
dụng nguyên page objects có sẵn, PRACTICE_TEST_ENV=staging, lớp "5D"/profile "Ngoc") rồi chạy lại
**PASS thật end-to-end TC_1/5/7/8/9** cùng ngày (xem ghi chú DE_NAME ngắn bên dưới).

### Ghi chú TC_2/6 — lỗi encoding tiếng Việt THẬT trong Maestro/JVM trên máy chạy test (2026-11-14)

GẶP THẬT, ĐÃ XÁC MINH DỨT ĐIỂM (loại trừ hết mọi nguyên nhân khác qua nhiều vòng test cô lập): assertion
tên section ("Nghe hiểu hội thoại") LUÔN FAILED dù text đang hiển thị đúng 100% trên màn hình thật
(xác nhận bằng mắt qua screenshot nhiều lần, đúng lúc assertion chạy, không phải do hết giờ/stale
session). Đã thử HẾT các hướng sau, TẤT CẢ đều fail y hệt:
  - Text literal viết thẳng trong YAML (không qua biến nào).
  - Text truyền qua `-e` env var, có/không wildcard `.*...*.`, có/không escape regex.
  - `JAVA_TOOL_OPTIONS=-Dfile.encoding=UTF-8 -Dsun.jnu.encoding=UTF-8`.
  - `decodeURIComponent()` trên chuỗi percent-encode (ASCII thuần, không thể bị hỏng charset khi
    truyền qua `-e`).
  - `.normalize("NFC")`.
Bằng chứng DỨT ĐIỂM: chạy thẳng `maestro hierarchy` (lệnh gốc của Maestro, không qua code nào viết
thêm) ngay lúc màn hình đang hiển thị đúng "Nghe hiểu hội thoại" → kết quả dump ra **"Nghe hi?u h?i
tho?i"** (dấu `?` thay cho mọi ký tự có dấu: ể, ộ, ạ). Đây là lỗi encoding THẬT xảy ra ngay trong
chính Maestro/JVM khi đọc dữ liệu tiếng Việt từ thiết bị trên máy Windows đang chạy test này (không
phải lỗi code .yaml, không phải do thao tác tay, không phải do hết giờ). (Ghi nhận thêm: các file
JSON hierarchy TRƯỚC ĐÓ tôi đọc qua Node.js lại hiển thị ĐÚNG tiếng Việt - khác với output trực tiếp
của lệnh `maestro hierarchy`/thông báo lỗi assertion - gợi ý lỗi nằm ở đường in-memory encoding dùng
cho SO KHỚP assertion/console output, KHÔNG phải ở file JSON ghi ra đĩa.)

QUYẾT ĐỊNH: KHÔNG tiếp tục debug sâu thêm (cần sửa ở tầng môi trường Windows/JVM, ngoài phạm vi sửa
code .yaml) - đánh dấu TC_2/6 **Tay/known-issue** trên máy hiện tại. Nếu chạy trên máy/môi trường
khác (Linux CI, macOS, hoặc Windows đã bật "Beta: Unicode UTF-8 for worldwide language support"),
nên thử lại - code `.yaml` (đã sửa escape + extendedWaitUntil cho đúng chuẩn chung của repo) không
cần sửa gì thêm, chỉ cần môi trường chạy đọc đúng UTF-8.

### Ghi chú TC_14 — lệch 1 câu, CHƯA RÕ GỐC RỄ (2026-11-15)

GẶP THẬT nhiều lần (kể cả sau khi giao lại đề sạch): dùng `advance-onthi-questions.yaml` với
`COUNT=SECTION_1_QUESTIONS_BEFORE_LAST=4` (section 1 có 5 câu, kỳ vọng dừng đúng Câu 5 - câu cuối)
lại đưa tới **Câu 6** (đã sang section 2) - lố mất 1 bước. CÙNG công thức `COUNT=5` (đi QUA HẲN
section 1) lại chạy ĐÚNG ở `LB-15_to_20` (đã PASS thật). Nghi ngờ: khi CTA đổi nhãn "Chuyển phần"
ở câu cuối section, tap CTA bên trong vòng lặp (`exam_prep_doing_next`, không phân biệt nhãn) có
thể tự kích hoạt luôn việc chuyển section (không dừng lại ở popup xác nhận như các file khác đã
quan sát) - CHƯA XÁC MINH DỨT ĐIỂM qua `maestro hierarchy` thật, tạm dừng điều tra theo quyết định
của user để ưu tiên chạy các case khác trước. CẦN QUAY LẠI điều tra kỹ hơn (chạy từng bước, xem
hierarchy ngay trước/sau tap CTA cuối cùng của vòng lặp) trước khi tin TC_14/các case khác dùng
chung tham số `SECTION_1_QUESTIONS_BEFORE_LAST` để dừng ĐÚNG câu cuối section (không phải đi QUA).

**CẬP NHẬT (2026-11-17) - ĐÃ ĐIỀU TRA DỨT ĐIỂM, root cause THẬT (khác hẳn suy đoán ban đầu):**
dùng `COUNT=TOTAL_QUESTIONS_BEFORE_LAST=58` với `AUTO_CONFIRM_SUBMIT=true` để đi hết đề luôn đưa
thẳng tới màn **Kết quả bài thi** (đã NỘP) thay vì dừng đúng ở câu cuối (TC_24 cần). Dò từng bước
bằng `maestro hierarchy`/screenshot thật qua nhiều vòng:
- Đếm tap-cơ-bản (1 tap = 1 câu) tự nó ĐÚNG hoàn toàn (xác nhận qua test riêng, Câu 1→5 qua 4 tap lẻ
  khớp 100%) - KHÔNG phải lỗi logic đếm hay câu nhóm cha-con như nghi ngờ ban đầu.
- Đổi sang chiến lược `STOP_BEFORE_LAST="true"` (vòng lặp tự dừng khi CTA đổi nhãn "Nộp bài", không
  cần biết trước số tap) - vẫn bị tự nộp sớm. Dò ra: nút "Nộp bài" ở GÓC HEADER (toolbar) LUÔN hiện
  diện ở MỌI câu (không riêng câu cuối) - điều kiện dừng ban đầu (`notVisible: "Nộp bài"` dạng text
  trần) sai ngay từ đầu. Sửa bằng combo `id: exam_prep_doing_next, text: "Nộp bài"` (chỉ khớp ĐÚNG
  nút CTA footer, không lẫn header) - vòng lặp dừng đúng vị trí nhưng VẪN bị tự nộp.
- **ROOT CAUSE THẬT:** đề "Health" có 7 section, 5 section CUỐI chỉ dài **1 phút/section** (đã xác
  nhận qua "Cấu trúc đề": Nói phản xạ 123/Viết đoạn văn ngắn/Đọc hiểu đoạn văn sửa/2×AUTO-shared đều
  1 phút). Tổng thời gian thao tác tự động thật (đăng nhập, điều hướng, mỗi lần tap+kiểm tra popup)
  tiêu tốn đủ lâu để các section 1-phút này HẾT GIỜ GIỮA CHỪNG trước khi tap kịp hết câu trong đó -
  app tự động nộp bài theo đúng cơ chế TC_13 ("hết giờ section cuối → tự nộp, KHÔNG popup"), HOÀN
  TOÀN ngoài tầm kiểm soát của code dù đã tối ưu tốc độ (bỏ bớt kiểm tra popup thừa cho mỗi lần tap
  "Tiếp theo" thường). Đã xác nhận: ngay cả khi tổng "Thời gian làm bài" lúc nộp chỉ 9:43-11:44 (dưới
  hạn mức 15 phút toàn đề) vẫn bị nộp sớm - chứng tỏ đây là do HẾT GIỜ 1 SECTION CON, không phải hết
  giờ toàn đề.
- **KẾT LUẬN:** đây là GIỚI HẠN THẬT của fixture "Health" (không phải lỗi code) - TC_24/27/28 (cần
  dừng ở ĐÚNG câu cuối cùng, chưa nộp, để assert nhãn "Nộp bài"/popup) không thể tự động hoá ổn định
  với fixture này vì tổng độ trễ thao tác thật luôn có nguy cơ vượt quá các cửa sổ 1-phút ở cuối đề.
  Đánh dấu **Tay/known-limit**. Code `advance-onthi-questions.yaml` đã giữ lại fix `STOP_BEFORE_LAST`
  (đúng, hữu ích cho fixture có section cuối dài hơn) + tối ưu tốc độ (bỏ kiểm tra popup thừa) - nếu
  sau này có fixture WHOLE_EXAM/PER_SECTION với section cuối đủ dài (≥2-3 phút), nên thử lại TC_24/27/28
  với fixture đó thay vì "Health".

### Ghi chú TC_21/22/23/25/26 — sửa được bug tap-nhầm-thẻ-kề-bên trong `open-de.yaml` (2026-11-17)

GẶP THẬT, RẤT DAI DẲNG: `open-de.yaml` dùng `tapOn: text: "(Làm bài|Làm tiếp|Làm lại)", below: title`
để mở đề "Health" từ danh sách "Đề thầy cô giao" - nhưng liên tục vào NHẦM đề khác ("Đề thi chung 1
kỹ năng", đứng ngay dưới "Health" trong danh sách thật trên tài khoản 5D) dù đã loại trừ HẾT các khả
năng: sai profile (đã xác nhận đúng Ngọc/5D), cache cục bộ (đã `pm clear` sạch vẫn gặp), nhiều thẻ
trùng tên (đã dọn còn ĐÚNG 1 thẻ "Health" vẫn gặp), lỗi encoding (file `commands.json` lưu đúng
UTF-8), chưa kịp render (screenshot xác nhận nút CTA đúng thẻ đã hiện rõ, không có nút nào khác chen
vào tầm nhìn), race condition (thêm `waitForAnimationToEnd` không ăn thua). **Tap TAY thủ công đúng
toạ độ đó luôn vào ĐÚNG đề** - chứng minh đây là lỗi thật trong cơ chế `tapOn...below` của chính
Maestro khi thực thi (không phải lỗi app/dữ liệu/selector-logic như tưởng). FIX: thêm tham số mới
`DE_LIST_TAP_POINT` cho `open-de.yaml` (tap theo toạ độ `%` màn hình thay vì theo text/below khi được
truyền) - `LB-21_to_31-cta-popup.yaml` dùng `DE_LIST_TAP_POINT_PER_SECTION="50%,63%"`. Tương tự, nút
"Ở lại"/"Chuyển phần" bên TRONG popup "Bạn muốn chuyển phần khác?" cũng gặp đúng lỗi này (node text có
`clickable="false"`, Maestro tap nhầm ancestor) - sửa bằng `tapOn: point` tương tự ngay trong
`LB-21_to_31-cta-popup.yaml` (toạ độ `28%,61%` / `72%,61%`). Rủi ro: toạ độ `%` cố định này gắn với
đúng bố cục thẻ "Health" (tiêu đề 3-4 dòng) tại thời điểm sửa - nếu danh sách đổi thứ tự/thẻ khác dài
hơn chen vào, có thể cần đo lại toạ độ.

### Ghi chú TC_12 — xác nhận thật ngoài ý muốn (2026-11-15)

Trong lúc debug `LB-10_to_14` (chạy lại trực tiếp không giao lại đề, tiếp tục phiên dở), phiên đã tự
trôi qua nhiều section do các section 3-7 chỉ có 1 phút/section (xem cấu trúc đề ở ghi chú trên).
Quan sát trực tiếp: hết giờ section "Viết đoạn văn ngắn" (Câu 20, section 4) → app TỰ ĐỘNG nhảy
thẳng sang Câu 30 (section 5 "Đọc hiểu đoạn văn sửa") - KHÔNG hiện popup "Bạn muốn chuyển phần
khác?" nào. ĐÚNG hành vi TC_12 mô tả, xác nhận thật dù không chạy qua đúng kịch bản
`RUN_LB12_AUTO_SWITCH` formal (không có fixture `DE_NAME_SHORT_TIMER_NOT_LAST_SECTION` riêng) -
chỉ là quan sát tình cờ, chưa coi là chạy test chính thức.

### Ghi chú DE_NAME — dùng chuỗi NGẮN khi tên đề dài/wrap nhiều dòng (2026-11-14)

GẶP THẬT: truyền `DE_NAME_PER_SECTION` bằng CẢ TÊN ĐỀ ĐẦY ĐỦ (vd "Đề luyện tập Unit 2: Health -
Listening and Speaking Practice, Pronunciation, Vocabulary and Grammar", wrap 3-4 dòng trên UI) khiến
`open-de.yaml` (cả bản `repeat.while`+`swipe` tay LẪN bản `scrollUntilVisible` built-in, đã thử cả 2)
LUÔN "No visible element found" dù đề đang hiển thị thật, đúng vị trí, không bị che - đã loại trừ hết
nguyên nhân khác (trạng thái app/profile/dữ liệu/vị trí cuộn, đều xác nhận đúng qua screenshot tay).
SỬA: truyền 1 CHUỖI CON NGẮN, riêng biệt của tên đề (vd chỉ "Health" hoặc "Đề luyện tập Unit 2: Health"
rút gọn) thay vì cả câu dài - chạy PASS ngay lập tức không cần sửa gì thêm ở `open-de.yaml`. Nghi ngờ
nguyên nhân: tên đề dài bị tách thành nhiều text-node riêng theo từng dòng hiển thị, khiến regex đầy
đủ (dài hơn 1 dòng) không bao giờ khớp được dù `.*...*.` lồng 2 đầu. CHƯA XÁC MINH SÂU gốc rễ (không
dump được accessibility tree để thấy rõ cách tách node) - chỉ ghi nhận ĐÚNG CÁCH VÁ đã verify thật,
không suy đoán thêm. Áp dụng cho MỌI `DE_NAME`/`EXERCISE_NAME` dài tương tự ở các file LB-*/CD-*/OT-*
khác nếu gặp lại triệu chứng "scroll hết cỡ mà không tìm thấy dù đề đang hiển thị thật".

## Fixture CMS cần chuẩn bị trước khi chạy thật

- `DE_NAME_PER_SECTION` — đề ≥3 section, mỗi section có thời lượng, biết trước số câu mỗi section
  (`SECTION_1_QUESTIONS_BEFORE_LAST`, `SECTION_1_DURATION_MIN`, `SECTION_2_DURATION_MIN`, tên 2
  section đầu `SECTION_1_NAME`/`SECTION_2_NAME`), có ≥1 câu hỏi nhóm cha-con.
- `DE_NAME_WHOLE_EXAM` — đề không section nào gắn thời lượng, cùng yêu cầu biết trước số câu/tên.
- `DE_NAME_SHORT_TIMER*` (nhiều biến thể theo TC, xem comment đầu mỗi file `LB-10_to_14`/
  `LB-44_45_46`/`LB-49_to_52`) — chỉ cần khi bật cờ Gated tương ứng, thời lượng vài chục giây.

## Code mới thêm (ngoài file `.yaml`)

- `flows/app/helpers/advance-onthi-questions.yaml` — helper dùng chung, đi qua N câu bất kỳ không
  cần đúng/sai (derive từ `answer-current-exercise-generic.yaml`, đổi CTA/điều kiện dừng cho đúng
  khung On thi).
- `automation/on_thi/navigation/onThiExamEngine.js#tapMarkForReviewIcon()` — hàm mới cho lớp Node
  orchestrator (không bắt buộc cho các file `.yaml` thuần ở trên, chỉ cần nếu viết thêm script chạy
  ngẫu nhiên có thao tác đánh dấu).
- `scripts/run_lb49_52_offline_case.sh` — wrapper bật/tắt mạng qua `adb`, mirror
  `scripts/run_rkl17_offline_case.sh`.

## Giới hạn đã biết (không suy đoán thêm)

Giống hệt các giới hạn đã ghi nhận ở `TEST-CASES-chi-tiet-de.md`:
- `readTimerBadge()` chỉ best-effort, có thể đọc nhầm thời lượng audio player — mọi TC cần ĐÚNG
  giá trị đồng hồ chỉ verify được bằng ảnh chụp, không phải assertion tự động.
- Màu sắc (cam/đỏ) không đọc được qua text selector — chỉ chụp màn hình.
- Chưa có resource-id xác nhận cho tên Section hiển thị cạnh icon Thoát và cho thanh Tiến độ — cần
  1 lượt `maestro hierarchy` thật trước khi viết assertion chặt hơn mức hiện tại.
