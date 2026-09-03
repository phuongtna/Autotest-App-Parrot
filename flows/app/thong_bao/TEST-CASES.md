# Bảng test case — Icon "Thông báo" (chuông) trên App HS

Nguồn kỳ vọng: yêu cầu QA (thông báo giao bài phải xuất hiện NGAY sau khi GV giao; nhắc hạn nộp
gửi lúc 19:00) + khảo sát THẬT trên thiết bị (`maestro hierarchy` qua MaestroMcpSession,
2026-09-01, thiết bị `3201d866d40a1681`) - repo này **không có source code app** (chỉ có Maestro
flow), không suy đoán ngoài phần đã quan sát/đã chạy thật dưới đây. Cùng quy ước cột với
`flows/app/bai_tap/TEST-CASES.md`.

Cập nhật (2026-09-03): QA cung cấp thêm 1 ảnh đặc tả RULE CHÍNH THỨC cho nội dung notification (2
nhóm sự kiện, mỗi nhóm random 1 trong 10 mẫu câu cố định + hành vi click chung) - xem nguyên văn ở
mục "QUY TẮC NỘI DUNG THÔNG BÁO CHÍNH THỨC" cuối file. Bổ sung TB-03 (nhóm "Sắp tới hạn nộp bài",
tách riêng khỏi TB-02 vốn gộp chung 3 trạng thái) + TB-04 (verify hành vi click) - TB-04 phát hiện
1 lỗi thật (KHÔNG khớp mô tả rule), xem mục "TB-04" để biết đầy đủ bằng chứng.

Cập nhật tiếp (2026-09-03, cùng ngày): QA cung cấp thêm 1 rule nữa cho nhóm sự kiện thứ 3 - "HS đã
hoàn thành bài tập" (báo cho PHỤ HUYNH, không phải HS - văn bản xưng hô "Ba mẹ"), 3 mức điểm
(<5 / 5-<7 / ≥7) x 5 mẫu câu/mức = 15 mẫu, xem mục "QUY TẮC NỘI DUNG THÔNG BÁO CHÍNH THỨC" phần
"Nhóm 3". Bổ sung TB-05 - KHÁC TB-04: hành vi click của nhóm này **ĐÃ XÁC NHẬN THẬT ĐÚNG** như rule
mô tả (dẫn tới màn "Xem chi tiết bài làm", không phải lỗi như TB-04).

- Icon chuông: `resource-id: notification_bell_button` - có mặt trên header của **cả 3 tab**
  dashboard (Vui học / Bài tập / Báo cáo), xác nhận qua `maestro hierarchy` thật (không phải 1
  trong "4 testID" đã ghi ở `flows/app/bai_tap/TEST-CASES.md` mục D#9 - icon này có resource-id
  native riêng, độc lập).
- Màn Thông báo: tiêu đề "Thông báo", danh sách item - mỗi item là 1 `ViewGroup` clickable, có
  `content-desc = "<nội dung thông báo>, <x phút/giờ trước>"` (thời gian dạng tương đối, chỉ tới
  phút - không có giây).
- Helper mới: `flows/app/helpers/open-notification.yaml` (tap icon chuông, assert màn "Thông báo"
  hiện ra) - giả định đã login + đang đứng ở 1 trong 3 tab dashboard, giống quy ước
  `open-tab-homework.yaml`/`open-tab-report.yaml`.

Cột **Auto** = có file Maestro/script chạy tự động. Cột **Tay** = cần QA kiểm chứng thêm bằng
mắt/thao tác.

**Artifact case-level (Maestro YAML thuần, chạy bằng `maestro test`, giống mọi case khác dưới
`flows/app/*/`)**:

- `flows/app/thong_bao/TB-01-thong-bao-giao-bai-ngay.yaml` — nửa APP-SIDE của TB-01 (mở icon
  chuông, tìm 1 item mang ngữ nghĩa "giao bài mới").
- `flows/app/thong_bao/TB-02-thong-bao-nhac-han-19h.yaml` — TB-02 mechanic-only (mở/đóng icon
  chuông lặp lại, tìm 1 item mang ngữ nghĩa "nhắc hạn nộp").
- `flows/app/thong_bao/TB-03-thong-bao-sap-den-han.yaml` — TB-03 MỚI (2026-09-03), riêng cho nhóm
  "Sắp tới hạn nộp bài" của rule chính thức (10 mẫu câu) - KHÁC TB-02 (TB-02 gộp chung cả 3 trạng
  thái hôm nay/quá hạn/sắp tới hạn, KHÔNG loại trừ "quá hạn"; TB-03 dùng regex hẹp hơn, cố tình
  loại trừ các cụm "quá hạn"/"đã hết hạn" để chỉ khớp đúng nhóm "sắp tới" theo rule mới).
- `flows/app/thong_bao/TB-04-thong-bao-click-focus.yaml` — TB-04 MỚI (2026-09-03), verify hành vi
  click 1 item thông báo có đúng "hiển thị màn hình danh sách bài tập và focus vào bài tập đó" như
  rule mô tả không. **ĐÃ CHẠY THẬT: FAIL** - hành vi thật sự KHÁC hẳn mô tả rule, xem mục "TB-04"
  để biết đầy đủ bằng chứng (KHÔNG phải lỗi viết test - đã tái hiện 2 lần độc lập, 2 item khác
  nhau, cả 2 lần đều cho cùng 1 kết quả).
- `flows/app/thong_bao/TB-05-thong-bao-hoan-thanh-bai-tap.yaml` — TB-05 MỚI (2026-09-03), nhóm sự
  kiện thứ 3 "HS đã hoàn thành bài tập" (báo phụ huynh) + verify click → màn "Xem chi tiết bài
  làm". **ĐÃ CHẠY THẬT: PASS** - cả nội dung LẪN hành vi click đều khớp đúng rule, xem mục "TB-05".

2 file .mjs mô tả bên dưới (`e2e-teacher-assign-notification-immediate.mjs`,
`tb02-check-19h-reminder.mjs`) VẪN giữ nguyên, đóng vai trò công cụ ORCHESTRATION/quan sát (không
phải bị thay thế): `.mjs` của TB-01 chạy TOÀN BỘ pipeline Web-GV-giao-bài -> App-HS-đối-chiếu
end-to-end (đối chiếu CHẶT theo đúng title+hạn nộp vừa giao, đo timing chính xác) - dùng cho CI/lượt
chứng minh 1 lần duy nhất "xuất hiện NGAY sau khi giao". `.mjs` của TB-02 là công cụ CHẨN
ĐOÁN/QUAN SÁT phong phú hơn (poll quanh mốc 19:00, phân loại text, cross-reference với dữ liệu
due-state thật qua API) - dùng khi cần điều tra sâu, KHÔNG tự PASS/FAIL. 2 file `.yaml` mới ở trên
mới là ARTIFACT CASE-LEVEL đúng quy ước Maestro thuần của repo (`maestro test <file>.yaml`, có thể
chạy độc lập không cần Node/Playwright/MCP), verify NGỮ NGHĨA chung (không đối chiếu title/ngày cụ
thể) - nhanh hơn để chạy lại khi debug UI/selector.

---

## Bảng test case

| ID | Tên case | Điều kiện/dữ liệu | Bước | Kỳ vọng PASS | Coi là FAIL khi | Auto | Tay |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TB-01 | Thông báo giao bài xuất hiện NGAY sau khi GV bấm "Giao bài đã chọn" | Tài khoản GV "Phương" (0912312312, lớp 3B, `TARGET_CLASS_ID=b3336062-...`), tài khoản HS "Ngoc" (PHONE=0915775115, lớp 3B) đã login sẵn trên App; hạn nộp đặt = **hôm nay** | 1. App HS: login, đứng ở dashboard.<br>2. Web GV (Playwright): chọn lớp 3B, hạn nộp = hôm nay, random 1 Unit/Lesson/bài -> bấm "Giao bài đã chọn" -> chờ toast thành công (mốc t0).<br>3. App HS: tap icon chuông -> đọc danh sách thông báo -> đối chiếu.<br>4. Nếu chưa thấy: đóng (back) rồi mở lại icon chuông, lặp lại tới khi khớp hoặc hết 90s. | Trong danh sách Thông báo xuất hiện **1 item** mà `content-desc` chứa cả `"<tên bài vừa giao>"` (giữ nguyên ngoặc kép) VÀ `Hạn nộp: <hôm nay DD/MM/YYYY>` - đo được thời gian từ t0 tới lúc khớp | Sau 90s poll (đóng/mở lại icon chuông) KHÔNG có item nào khớp cả 2 điều kiện trên | ✅ | |
| TB-02 | Nhắc hạn nộp (hôm nay/quá hạn/sắp tới hạn) gửi lúc 19:00 | Có ít nhất 1 bài của HS đang test rơi vào 1 trong 3 trạng thái: hạn nộp hôm nay, đã quá hạn, sắp tới hạn | Vào đúng lúc 19:00 (giờ VN): mở icon chuông trên App HS, kiểm tra có thông báo nhắc nhở tương ứng | Xuất hiện thông báo nhắc nhở đúng ngữ cảnh (hạn nộp hôm nay/quá hạn/sắp hạn), đúng khung giờ 19:00 | Không có thông báo nhắc nào trong icon chuông tại/quanh 19:00 dù có bài rơi vào 1 trong 3 trạng thái trên | | ✔ |
| TB-03 | Nội dung thông báo "Sắp tới hạn nộp bài" khớp 1 trong 10 mẫu câu chính thức (rule QA 2026-09-03) | Có ít nhất 1 item thông báo dạng "sắp tới hạn" (KHÔNG phải "quá hạn"/"hôm nay") đang hiển thị trong icon chuông | Mở icon chuông, tìm 1 item khớp NGỮ NGHĨA nhóm "sắp tới hạn" (không khớp "quá hạn"/"đã hết hạn") | Có ≥1 item content-desc khớp regex nhóm "sắp tới hạn" (xem file .yaml để biết cụm từ) | Không có item nào khớp trong toàn bộ danh sách cuộn được | ✅ | |
| TB-04 | Click 1 item thông báo → hiển thị màn "danh sách bài tập", focus vào đúng bài tập đó | Có ≥1 item thông báo dạng bài tập (giao bài mới HOẶC sắp tới hạn) đang hiển thị | Mở icon chuông, tap vào 1 item, (nếu có) chấp nhận popup "AI hỗ trợ học tập" bằng "Tiếp tục" | Màn "Bài tập" (danh sách) hiện ra, đúng card/bài tập vừa click được cuộn tới/hiển thị nổi bật | Không thấy màn danh sách Bài tập sau khi click (vd rơi thẳng vào màn làm bài, hoặc báo lỗi, hoặc ở lại màn Thông báo) | ✅ (đã chạy - **FAIL, xem mục TB-04**) | |
| TB-05 | Thông báo "HS đã hoàn thành bài tập" (báo phụ huynh, 3 mức điểm x 5 mẫu) + click → xem chi tiết bài làm | Có ≥1 thông báo dạng "đã hoàn thành ... bài tập ... điểm" đang hiển thị (HS vừa nộp xong 1 bài bất kỳ) | Mở icon chuông, tìm item khớp NGỮ NGHĨA "hoàn thành + bài tập + điểm", tap vào -> (nếu có) chấp nhận "AI hỗ trợ học tập" | Có ≥1 item khớp regex; sau khi click, hiện màn "Xem chi tiết bài làm" (điểm, đáp án đúng/sai từng câu, nút "Giải thích") | Không có item khớp; HOẶC click không dẫn tới màn xem chi tiết bài làm | ✅ (đã chạy - **PASS**, xem mục TB-05) | |

---

## TB-01 — ĐÃ XÁC NHẬN THẬT (2026-09-01, tài khoản GV "Phương" 0912312312 + tài khoản HS "Ngoc" PHONE=0915775115, lớp 3B, thiết bị `3201d866d40a1681`)

Chạy bằng `node flows/web/giao_bai_tap/e2e-teacher-assign-notification-immediate.mjs` (script MỚI,
tái sử dụng nguyên vẹn `assignHomeworkFlow()`/`homeworks.js`/`MaestroMcpSession` - không viết lại
phần Web GV, xem docblock đầu file để biết đầy đủ lý do kiến trúc).

- Random chọn được: Unit 12: Jobs / LESSON 3 / bài "Read the text and choose the correct answer."
  (10 câu, type OTHER). Hạn nộp đặt = hôm nay (01/09/2026).
- Web GV: bấm "Giao bài đã chọn" -> toast "Giao bài tập mới thành công" lúc
  `2026-09-01T11:55:02.084Z`. room_id = `8e1ddd90-b903-4895-bfcc-80c3c882bca2`.
- App HS: tap icon chuông lần đầu tiên (poll lần 1, không cần đóng/mở lại) đã thấy đúng item khớp
  sau **8020ms**:
  > "Cô Phương đã giao cho Ngoc bài "Read the text and choose the correct answer.". Hạn nộp:
  > 01/09/2026. Cùng bắt đầu làm ngay nào!, 0 phút trước"
- **PASS** - report đầy đủ: `automation/output/e2e_teacher_assign_notification_immediate_report.json`.
- 8020ms bao gồm CẢ round-trip MCP (tap icon chuông + chờ màn "Thông báo" render + đọc hierarchy),
  không phải riêng độ trễ backend/push - vẫn đủ để kết luận "xuất hiện ngay" theo đúng yêu cầu
  TB-01 (không phải chờ nhiều phút/phải refresh nhiều lần).

### TB-01.yaml — ĐÃ CHẠY THẬT bằng `maestro test` (2026-09-01, thiết bị `3201d866d40a1681`)

`flows/app/thong_bao/TB-01-thong-bao-giao-bai-ngay.yaml`:
`maestro test flows/app/thong_bao/TB-01-thong-bao-giao-bai-ngay.yaml -e APP_ID=com.inet.parrotedu -e PHONE=0915775115 -e OTP=888888`
- **PASS** (exit code 0) - `scrollUntilVisible` khớp regex
  `.*(giao bài|bài tập mới|nhận được bài tập|đã giao cho|đã sẵn sàng).*` NGAY Ở MÀN HÌNH ĐẦU TIÊN
  (không cần cuộn - "Scrolling DOWN until ... COMPLETED" trong log, item khớp đã nằm sẵn trong
  viewport) - bài TB-01 giao sáng nay (`"Read the text and choose the correct answer."`, hạn nộp
  01/09) vẫn còn hiển thị gần đầu danh sách lúc chạy (~20:20 tối, chưa bị đẩy xuống xa).
- **Friction gặp phải khi build (ĐÃ SỬA)**: lượt thử ĐẦU TIÊN dùng `runFlow: ../subflows/launch_app.yaml`
  (clearState + launchApp, không có bước chờ ổn định UI) làm login.yaml `Run flow when ".*(Chào
  mừng...|Nhập số điện thoại).*" is visible` SKIPPED sai (check chạy TRƯỚC khi màn welcome kịp
  render) -> assertVisible dashboard cuối `login.yaml` FAILED dù đang đứng đúng màn welcome (xác
  nhận qua screen-hierarchy dump lúc FAILED, thấy rõ "Chào mừng bạn đến với ParrotEdu!" +
  "Nhập số điện thoại" trong cây view). SỬA: đổi sang `runFlow: ../helpers/launch-keep-session.yaml`
  (có sẵn `extendedWaitUntil` chờ ổn định UI trước khi vào login.yaml) - đúng cặp
  `flows/app/bai_tap/ktra_fullluong_lambai.yaml` đã dùng làm mẫu. Sau khi sửa: PASS ngay lượt chạy
  kế tiếp (session lúc đó đã login sẵn từ lượt chạy TB-02 trước đó trong cùng phiên làm việc nên
  nhánh login SKIPPED đúng nghĩa "đã có session" - đã verify riêng 1 lượt clearState thật ở TB-02
  bên dưới để xác nhận login.yaml tự chạy đúng khi cần login thật từ đầu).

**Cập nhật (2026-09-03)** - regex mở rộng thêm cụm "gửi bài tập" (xem mục "QUY TẮC NỘI DUNG THÔNG
BÁO CHÍNH THỨC" nhóm 1 mẫu #8) - đã chạy lại `maestro test` THẬT: **PASS** (exit code 0), khớp ngay
màn hình đầu (không cần cuộn) qua cụm "đã giao cho" của item thật hiện có trên máy - regex mới
không phá vỡ hành vi cũ, chỉ mở rộng thêm phạm vi khớp.

### Phát hiện đáng chú ý — KHÔNG có 1 mẫu câu thông báo cố định

`flows/web/giao_bai_tap/TESTCASES.md` TC1 (2026-08-09) từng ghi nhận đúng 1 mẫu câu:
`"Ngoc nhận được bài tập "<tên bài>" từ cô Phương. Hạn nộp: <ngày>. Chúc con học tốt!"`. Khảo sát
lại lần này (2026-09-01, cùng tài khoản, đọc thật `content-desc` của nhiều item khác nhau trong
cùng 1 lần mở icon chuông) cho thấy có **NHIỀU mẫu câu khác nhau** cho các sự kiện "bài tập mới",
không phải 1 câu cố định duy nhất - vd đã quan sát thật cả các mẫu sau (khác cả về người nhận
"Ngoc" hay "Gia Linh" - 1 hồ sơ con KHÁC cùng tài khoản, thấy CHUNG trong 1 icon chuông):

- `Cô Phương giao bài "<tên bài>" cho Ngoc. Hạn nộp: <ngày>. Hãy hoàn thành đúng hạn nhé!`
- `Đã có bài tập mới "<tên bài>" từ cô Phương cho Gia Linh. Hạn nộp: <ngày>.`
- `Bài tập mới "<tên bài>" từ cô Phương đã sẵn sàng cho Ngoc. Hạn nộp: <ngày>.`
- `Cô Phương đã giao cho Ngoc bài "<tên bài>". Hạn nộp: <ngày>. Cùng bắt đầu làm ngay nào!` (mẫu
  quan sát được trong lượt chạy PASS ở trên)
- `Ngoc nhận được bài tập "<tên bài>" từ cô Phương. Hạn nộp: <ngày>. Chúc con học tốt!` (mẫu đã ghi
  ở TC1, 2026-08-09)

**Ghi nhận cho dev** (không chặn PASS - cả 5 mẫu đều truyền tải đúng thông tin bài+hạn nộp, script
tự động match theo `"<tên bài>"` + `Hạn nộp: <ngày>` thay vì match nguyên câu, không phụ thuộc mẫu
nào): có vẻ như hệ thống random/A-B nhiều mẫu câu cho CÙNG 1 loại sự kiện "giao bài mới" - nên xác
nhận với dev đây là chủ đích (đa dạng hoá câu chữ) hay là dấu hiệu nhiều luồng code khác nhau đang
cùng tạo thông báo cho cùng 1 sự kiện (dễ lệch nội dung không kiểm soát về sau).

---

## TB-02 — Quyết định: **Tay** cho phần TIMING 19:00, **Auto (mechanic-only)** cho phần cơ chế

Cập nhật (2026-09-01, sau khi user yêu cầu case app-side phải viết bằng Maestro YAML thuần): đã
thêm `flows/app/thong_bao/TB-02-thong-bao-nhac-han-19h.yaml` - file này tự động hoá ĐÚNG PHẦN CƠ CHẾ
("mở icon chuông -> có item dạng nhắc hạn nộp -> đóng/mở lại -> vẫn thấy") bằng `maestro test` thật,
xem kết quả chạy live ở mục "TB-02.yaml — ĐÃ CHẠY THẬT" cuối file. **KHÔNG đổi cột Auto/Tay của bảng
ở đầu file** (vẫn giữ "Tay") vì lý do dưới đây KHÔNG đổi: file `.yaml` mới chỉ chứng minh cơ chế mở
chuông thấy thông báo dạng nhắc nhở, KHÔNG chứng minh đúng lúc 19:00 (không chờ tới giờ đó mới
chạy) và KHÔNG phân loại theo 3 trạng thái - đọc header comment của chính file `.yaml` đó để biết
đầy đủ giới hạn. Phần lý luận gốc bên dưới (vì sao KHÔNG tự động hoá được phần TIMING) vẫn nguyên vẹn.

TB-02 là thông báo **kích hoạt theo giờ tường (19:00, có khả năng cron/scheduled job phía server)**,
không phải hệ quả trực tiếp của 1 hành động do script điều khiển được (khác TB-01, nơi trigger là
chính hành động "GV bấm giao bài" mà script chủ động thực hiện). Đã cân nhắc các hướng sau trước
khi kết luận:

1. **Chờ thật tới 19:00 rồi assert** - kỹ thuật khả thi nhưng **không đưa vào bộ test tự động chạy
   thường xuyên**: biến 1 script thành phụ thuộc đồng hồ tường thực tế (chỉ chạy đúng nghĩa 1 lần/
   ngày, gần vô dụng khi cần chạy lại nhanh để debug/regress), không phải lỗi nằm ở cách viết test
   mà ở chính bản chất "time-gated, server-triggered" của tính năng - không có cách nào rút ngắn
   một cách trung thực.
2. **`adb shell date` (chỉnh giờ hệ thống máy)** - **không dùng**: cơ chế nhắc lúc 19:00 nhiều khả
   năng là job phía SERVER (backend quét bài due-today/quá hạn/sắp hạn rồi đẩy push tại 1 mốc giờ
   tường cố định), không phải app tự tính giờ trên máy rồi tự bắn local notification - chỉnh đồng
   hồ máy client (dù chỉnh được) nhiều khả năng KHÔNG kích hoạt sớm job phía server, đồng thời có
   rủi ro phụ: làm sai lệch timestamp OTP/login, làm sai nhãn ngày "Hạn nộp"/"(QUÁ HẠN)"/"(Hôm
   nay)" đang hiển thị đúng ở nơi khác (xem HW-09/HW-10 trong `flows/app/bai_tap/TEST-CASES.md`),
   ảnh hưởng ngoài phạm vi case này. Repo hiện KHÔNG có cơ chế test-only để ép chạy sớm 1 cron job
   phía server (không có endpoint debug/trigger nào được biết tới).
3. **Tìm dấu hiệu "đã lên lịch" hiển thị sẵn trên UI (badge/pending) mà không cần đợi thật 19:00**
   - đã xem lại toàn bộ item thông báo thu được ở khảo sát TB-01 (5 mẫu câu ở trên): tất cả đều là
     thông báo ĐÃ GỬI (có nhãn "x phút/giờ trước"), không có bất kỳ item/badge nào thể hiện "sẽ gửi
     lúc 19:00"/trạng thái "pending" - không có tín hiệu UI nào để assert được mà không phải đợi
     thật.

**Kết luận**: TB-02 giữ **Tay**, người kiểm thử nên tự làm vào đúng khung giờ ~19:00: mở icon
chuông trên App HS (tài khoản có sẵn ≥1 bài due-today/quá hạn/sắp hạn), xác nhận có thông báo dạng
nhắc nhở tương ứng (không nhất thiết đúng 5 mẫu "bài tập mới" ở trên - phần chữ của thông báo nhắc
hạn nộp CHƯA có mẫu nào được xác nhận thật, cần ghi lại nguyên văn khi quan sát lần đầu để bổ sung
bảng mẫu câu cho case này, giống cách TB-01 đã làm).

### TB-02.yaml — ĐÃ CHẠY THẬT bằng `maestro test` (2026-09-01 ~20:20 giờ VN, thiết bị `3201d866d40a1681`)

`flows/app/thong_bao/TB-02-thong-bao-nhac-han-19h.yaml`:
`maestro test flows/app/thong_bao/TB-02-thong-bao-nhac-han-19h.yaml -e APP_ID=com.inet.parrotedu -e PHONE=0915775115 -e OTP=888888`
- **PASS** (exit code 0) - cả **3/3 vòng lặp** `repeat:` (mở chuông -> assert -> đóng) đều khớp
  regex `.*(hạn nộp|quá hạn|sắp hết hạn|sắp đến hạn|nhắc nhở|nhắc con|nhắc bạn).*` - các item nhắc
  hạn nộp thật ghi nhận từ trưa nay (mục "PHÁT HIỆN NGOÀI DỰ KIẾN" bên dưới, quan sát ~13:00 giờ VN)
  VẪN còn hiển thị trong danh sách lúc chạy (~20:20 tối) - đúng dự đoán trong yêu cầu ("timestamp
  '1 giờ trước' lúc ~20:02 thì giờ sẽ hiện '~1-2 giờ trước' nhưng vẫn còn trong danh sách").
- **Login từ đầu (clearState thật, không phải session cũ)**: lượt chạy này thực thi ĐẦY ĐỦ chuỗi
  bước login.yaml (nhập SĐT, "Đăng nhập", nhập OTP, "Xác nhận" - tất cả COMPLETED, không SKIPPED) vì
  state trước đó đã bị `clearState` bởi 1 lượt thử trước (xem friction bên dưới) - xác nhận
  `login.yaml` hoạt động đúng cả khi cần login thật từ đầu lẫn khi đã có session.
- **Friction gặp phải khi build (ĐÃ SỬA - cùng root cause với TB-01.yaml)**: lượt thử ĐẦU TIÊN dùng
  `runFlow: ../subflows/launch_app.yaml` FAILED vì thiếu bước chờ ổn định UI trước
  `login.yaml`'s `when: visible` check (xem chi tiết đầy đủ trong mục "Friction" của TB-01.yaml ở
  trên - cùng 1 lỗi, gặp lần đầu ở đây). SỬA: đổi sang `runFlow: ../helpers/launch-keep-session.yaml`
  - PASS ngay sau khi sửa.
- **`repeat:` (native Maestro command) hoạt động đúng trên Maestro 2.8.0 của repo** - không cần
  unroll thủ công thành N khối riêng lẻ (khác giả định dự phòng nêu trong yêu cầu ban đầu).
- Screenshot bằng chứng: `TB-02-notification-matched` (Maestro tự lưu vào output folder mặc định
  của lượt chạy, 3 lần - 1 lần/vòng lặp).

### Công cụ cho lượt chạy thật tối nay (2026-09-01, ~19:00 giờ VN)

Script MỚI `flows/app/thong_bao/tb02-check-19h-reminder.mjs` (đọc docblock đầu file để biết đầy đủ
cơ chế) - tự động hoá ĐÚNG kỹ thuật "thoát thông báo bấm lại vào check" bằng
`MaestroMcpSession`/login/tap chuông/đọc hierarchy (cùng pattern TB-01), poll quanh mốc 19:00 (mặc
định: 18:55 -> 19:15), ghi lại NGUYÊN VĂN mọi text thông báo quan sát được + flag item nào "có vẻ
là nhắc hạn nộp". Đây là công cụ THU THẬP BẰNG CHỨNG (observational), KHÔNG tự PASS/FAIL - không đổi
verdict TB-02 sang "Auto" chỉ vì có script này, xem docblock để biết lý do đầy đủ.

Chạy: `node flows/app/thong_bao/tb02-check-19h-reminder.mjs` (báo cáo ghi ra
`automation/output/tb02_check_19h_reminder_report.json`).

**"Sắp tới hạn" KHÔNG có định nghĩa cửa sổ cố định nào trong repo** - đã tra
`flows/app/bai_tap/TEST-CASES.md` (HW-09 "quá hạn" = due_date < hôm nay, HW-10 "hôm nay" = due_date
= hôm nay) - chỉ có 2 nhãn UI xác nhận thật, không có nhãn/định nghĩa "sắp tới hạn" nào. Script trên
tự chọn cửa sổ "≤3 ngày tới" làm ứng viên (quy ước riêng của script, chưa xác nhận từ CMS/backend).

**Ứng viên THẬT của lớp 3B tại thời điểm khảo sát (đọc qua API, KHÔNG tạo bài mới, 2026-09-01
~13:00 giờ VN, `fetchAllHomeworkRooms`+`normalizeHomework`)** - danh sách đầy đủ hơn xem
`dueStateCandidatesSnapshot` trong report JSON của lần chạy thật:
- **Hạn nộp hôm nay (01/09/2026)**: `"Read the text and choose the correct answer."` (room
  `8e1ddd90-b903-4895-bfcc-80c3c882bca2`, cùng bài TB-01 đã giao).
- **Quá hạn**: 57 room (phần lớn dữ liệu test cũ, quá hạn nhiều ngày/tuần) - ứng viên GẦN NHẤT/hợp
  lý nhất: `"Listen and decide whether each statement is True (T) or False (F)."` (quá hạn 31/08,
  1 ngày), 2x `"Read the text and choose the correct answer."` (quá hạn 30/08, 2 ngày).
- **Sắp tới hạn (≤3 ngày, quy ước riêng script)**: 7 room, hạn 02/09 (2x `"Choose the correct
  answer."`) và 04/09 (5 room, gồm 1x `"Read the text and choose the correct answer."`).

**PHÁT HIỆN NGOÀI DỰ KIẾN (từ smoke-test cơ chế của script trên, chạy lúc 2026-09-01 ~13:02 giờ VN
- chỉ 2 lượt poll ngắn để test login/tap chuông/đọc hierarchy, KHÔNG PHẢI lượt chạy thật 19:00)**:
đã thấy SẴN 4 text thông báo dạng nhắc hạn nộp thật trong icon chuông, nhãn thời gian tương đối
"1 giờ trước" (nghĩa là đã gửi khoảng 12:00-13:00 giờ VN, KHÔNG PHẢI 19:00):
- `Cô Phương nhắc nhở Ngoc hoàn thành bài "Read the text and choose the correct answer." trước 01/09/2026.`
- `Cô Phương nhắc Gia Linh bài "Read the text and choose the correct answer." chỉ còn 24h nữa là đến hạn nộp.`
- `Ngoc đã quá hạn nộp bài "Listen and decide whether each statement is True (T) or False (F)." của cô Phương. Hãy hoàn thành và nộp sớm nhất có thể!`
- `Gia Linh lưu ý: bài "Listen and decide whether each statement is True (T) or False (F)." của cô Phương đã hết hạn nộp.`

**Ý nghĩa**: phát hiện này KHÔNG chứng minh/phủ định có hay không 1 đợt nhắc RIÊNG lúc 19:00 (lượt
chạy thật tối nay vẫn cần làm để trả lời đúng câu đó) - nhưng CHỨNG MINH giả định "nhắc hạn nộp chỉ
gửi đúng 1 lần lúc 19:00" là KHÔNG ĐÚNG với dữ liệu thật quan sát được: đã có ít nhất 1 đợt nhắc
khác gửi vào khoảng giữa trưa (~12h). Cần đối chiếu kỹ khi chạy tối nay: nếu thấy đúng các mẫu câu ở
trên (hoặc mẫu tương tự) xuất hiện MỚI quanh 19:00, đó là bằng chứng có (thêm) 1 đợt nhắc lúc 19:00;
nếu KHÔNG thấy gì mới quanh 19:00 (chỉ thấy lại các item cũ từ trưa), cần báo lại rõ ràng thay vì
mặc định "PASS" chỉ vì đã có nhắc hạn nộp (đợt trưa) trong danh sách.

---

## QUY TẮC NỘI DUNG THÔNG BÁO CHÍNH THỨC (theo ảnh yêu cầu QA đính kèm, 2026-09-03)

QA cung cấp 1 bảng rule (ảnh) mô tả nội dung notification cho 2 nhóm sự kiện, mỗi nhóm **random 1
trong 10 mẫu câu cố định** (biến `[...]` là placeholder điền động: tên HS, Thầy/Cô, tên bài, hạn
nộp). Chép lại nguyên văn 10 mẫu của mỗi nhóm bên dưới để làm nguồn đối chiếu - LƯU Ý: các test case
tự động (TB-01/TB-03 bên dưới) **KHÔNG match nguyên văn cả câu** (đúng tinh thần đã áp dụng ở TB-01
gốc - xem mục "Phát hiện đáng chú ý" phía trên: có nhiều mẫu câu, match theo NGỮ NGHĨA/cụm từ chung
bền vững hơn là match nguyên văn dễ vỡ khi câu chữ đổi nhỏ).

### Nhóm 1 — "Giáo viên giao bài tập mới"

1. `[Tên học sinh] ơi, [Thầy/Cô] [Tên giáo viên] vừa giao bài "[Tên bài tập]". Hạn nộp: [Hạn nộp]. Đừng quên hoàn thành nhé!`
2. `[Thầy/Cô] [Tên giáo viên] đã giao cho [Tên học sinh] bài "[Tên bài tập]". Hạn nộp: [Hạn nộp].`
3. `Bài tập mới "[Tên bài tập]" từ [Thầy/Cô] [Tên giáo viên] đã sẵn sàng cho [Tên học sinh]. Hạn nộp: [Hạn nộp].`
4. `[Tên học sinh] nhận được bài tập "[Tên bài tập]" từ [Thầy/Cô] [Tên giáo viên]. Hạn nộp: [Hạn nộp]. Chúc con học tốt!`
5. `[Thầy/Cô] [Tên giáo viên] nhắc [Tên học sinh] kiểm tra bài tập mới "[Tên bài tập]". Hạn nộp: [Hạn nộp].`
6. `Đã có bài tập mới "[Tên bài tập]" từ [Thầy/Cô] [Tên giáo viên] đã sẵn sàng cho [Tên học sinh]. Hạn nộp: [Hạn nộp].`
7. `[Thầy/Cô] [Tên giáo viên] chú ý: [Thầy/Cô] [Tên giáo viên] vừa giao bài "[Tên bài tập]" cho [Tên học sinh]. Hạn nộp: [Hạn nộp].`
8. `[Thầy/Cô] [Tên giáo viên] gửi bài tập "[Tên bài tập]" cho [Tên học sinh]. Hạn nộp: [Hạn nộp]. Đừng bỏ lỡ!`
9. `[Tên học sinh] ơi, đã có bài tập mới "[Tên bài tập]" từ [Thầy/Cô] [Tên giáo viên]. Hạn nộp: [Hạn nộp].`
10. `[Thầy/Cô] [Tên giáo viên] giao bài "[Tên bài tập]" cho [Tên học sinh]. Hạn nộp: [Hạn nộp]. Hãy hoàn thành đúng hạn nhé!`

**Đối chiếu với 5 mẫu ĐÃ QUAN SÁT THẬT ở TB-01 (2026-09-01, mục "Phát hiện đáng chú ý" phía trên)**:
4/5 mẫu thật khớp gần đúng 1 trong 10 mẫu rule này (mẫu thật #4 "Cô Phương đã giao cho Ngoc bài
..." ≈ mẫu rule #2; mẫu thật #1 "Cô Phương giao bài ... cho Ngoc" ≈ mẫu rule #10; mẫu thật #2 "Đã có
bài tập mới ... cho Gia Linh" ≈ mẫu rule #6/#9; mẫu thật #3 "Bài tập mới ... đã sẵn sàng cho Ngoc" =
mẫu rule #3 gần như nguyên văn) - xác nhận rule này PHẢN ÁNH ĐÚNG hệ thống thật đang chạy, không
phải spec lý thuyết chưa triển khai. Cụm mới CHƯA từng quan sát thật trước đây: "gửi bài tập" (mẫu
#8) - đã bổ sung vào regex TB-01 (xem file .yaml).

### Nhóm 2 — "Sắp tới hạn nộp bài"

1. `[Tên học sinh] ơi, bài "[Tên bài tập]" của [Thầy/Cô] [Tên giáo viên] sắp đến hạn nộp rồi!`
2. `[Thầy/Cô] [Tên giáo viên] nhắc [Tên học sinh] bài "[Tên bài tập]" của [Thầy/Cô] [Tên giáo viên] sắp đến hạn nộp. Đừng quên hoàn thành nhé!`
3. `Hạn nộp bài "[Tên bài tập]" của [Thầy/Cô] [Tên giáo viên] sắp tới rồi! Còn 1 ngày nữa là đến hạn nộp.`
4. `[Tên học sinh] lưu ý: Bài "[Tên bài tập]" của [Thầy/Cô] [Tên giáo viên] sẽ hết hạn vào [Hạn nộp].`
5. `[Thầy/Cô] [Tên giáo viên] nhắc nhở [Tên học sinh] hoàn thành bài "[Tên bài tập]" trước [Hạn nộp].`
6. `Chỉ còn 1 ngày để [Tên học sinh] nộp bài "[Tên bài tập]" cho [Thầy/Cô] [Tên giáo viên]!`
7. `[Tên học sinh] hãy kiểm tra lại bài "[Tên bài tập]" từ [Thầy/Cô] [Tên giáo viên], hạn nộp sắp đến rồi!`
8. `[Thầy/Cô] [Tên giáo viên] gửi lời nhắc: "[Tên bài tập]" của [Tên học sinh] sắp hết hạn rồi!`
9. `[Tên học sinh] đừng quên hoàn thành bài "[Tên bài tập]" từ [Thầy/Cô] [Tên giáo viên] trước hạn nộp!`
10. `[Thầy/Cô] [Tên giáo viên] nhắc [Tên học sinh] bài "[Tên bài tập]" chỉ còn 24h nữa là đến hạn nộp.`

**Đối chiếu với dữ liệu thật quan sát được (2026-09-03, khảo sát cho TB-04 bên dưới)**: item thật
`Cô Phương nhắc Gia Linh bài "Choose the correct answer." chỉ còn 1 ngày nữa là đến hạn nộp!` khớp
RẤT SÁT cấu trúc mẫu rule #10 (chỉ khác "1 ngày" thay vì "24h" - cùng nghĩa) - xác nhận nhóm 2 của
rule này cũng PHẢN ÁNH ĐÚNG hệ thống thật, không phải spec chưa triển khai.

### Hành vi click — Nhóm 1 & 2 ("giao bài mới" / "sắp tới hạn nộp bài")

> User nhận được thông báo, click chọn sẽ hiển thị màn hình danh sách bài tập và focus vào bài tập đó.

**ĐÃ KIỂM CHỨNG THẬT - KHÔNG KHỚP** (2026-09-03) - xem mục "TB-04" bên dưới để biết đầy đủ bằng
chứng: hành vi thật là mở THẲNG màn LÀM BÀI (exercise doing screen) của bài tập đó, không phải màn
danh sách Bài tập.

### Nhóm 3 — "HS đã hoàn thành bài tập" (báo PHỤ HUYNH, KHÔNG phải HS)

QA cung cấp thêm rule cho 1 nhóm sự kiện KHÁC (2026-09-03, cùng ngày, gửi tiếp text không kèm ảnh):
thông báo khi HS **nộp xong 1 bài tập** (bất kể đúng/sai), nội dung xưng hô hướng tới **phụ huynh**
("Ba mẹ...") chứ không phải HS như nhóm 1/2 - nhưng vẫn hiện CHUNG trong 1 icon chuông trên App HS
(đúng như đã ghi nhận trước đó: bell này gộp cả thông báo hướng-HS lẫn hướng-phụ-huynh, xem các mẫu
"Bố mẹ Gia Linh ơi..." đã quan sát ở TB-02). Random 1 trong 5 mẫu theo **3 mức điểm** (thang điểm
bài tập vừa hoàn thành, KHÔNG phải điểm trung bình cộng dồn):

**TH1 — Điểm dưới trung bình (< 5)**

1. `{Tên học sinh} đã hoàn thành tất cả bài tập với kết quả {Điểm số} điểm. Ba mẹ hãy động viên con cố gắng hơn ở những bài tiếp theo nhé!`
2. `{Tên học sinh} đã làm xong toàn bộ bài tập, kết quả lần này là {Điểm số} điểm. Ba mẹ hãy cùng con xem lại bài và hỗ trợ con học tốt hơn nhé!`
3. `{Tên học sinh} đã hoàn thành các bài tập được giao, điểm của con là {Điểm số}. Ba mẹ hãy khích lệ con ôn tập thêm để tiến bộ hơn!`
4. `Ba mẹ ơi, {Tên học sinh} đã hoàn thành bài tập với kết quả {Điểm số} điểm. Ba mẹ động viên con cố gắng hơn ở những lần sau nhé!`
5. `{Tên học sinh} đã hoàn thành bài tập, điểm số lần này chưa cao ({Điểm số}). Ba mẹ hãy động viên giúp con cải thiện nhé!`

**TH2 — Điểm trung bình (5 đến dưới 7)**

1. `{Tên học sinh} đã hoàn thành tất cả bài tập với kết quả {Điểm số} điểm. Ba mẹ hãy động viên con tiếp tục cố gắng nhé!`
2. `{Tên học sinh} đã làm xong toàn bộ bài tập và đạt {Điểm số} điểm. Ba mẹ hãy khen ngợi và khuyến khích con học tốt hơn nữa!`
3. `Tuyệt vời! {Tên học sinh} đã hoàn thành các bài tập với kết quả {Điểm số} điểm. Ba mẹ hãy cùng con xem lại kết quả và động viên con nhé!`
4. `{Tên học sinh} đã hoàn thành đầy đủ các bài tập được giao và đạt {Điểm số} điểm. Ba mẹ hãy tiếp tục đồng hành cùng con!`
5. `Ba mẹ ơi, {Tên học sinh} đã hoàn thành tất cả bài tập với điểm {Điểm số}. Ba mẹ động viên con phát huy thêm nhé!`

**TH3 — Điểm cao (từ 7 trở lên)**

1. `Chúc mừng {Tên học sinh} đã hoàn thành tất cả bài tập với kết quả {Điểm số} điểm! Ba mẹ hãy động viên con tiếp tục phát huy nhé!`
2. `{Tên học sinh} đã xuất sắc hoàn thành toàn bộ bài tập và đạt {Điểm số} điểm. Ba mẹ hãy khen ngợi con nhé!`
3. `Tuyệt vời! {Tên học sinh} đã làm xong toàn bộ bài tập với điểm {Điểm số}. Ba mẹ hãy cùng con xem lại kết quả và động viên con học tiếp nhé!`
4. `{Tên học sinh} đã hoàn thành đầy đủ các bài tập được giao và đạt {Điểm số} điểm. Ba mẹ hãy tiếp tục đồng hành cùng con trên hành trình học tập nhé!`
5. `Ba mẹ ơi, {Tên học sinh} đã hoàn thành tất cả bài tập với kết quả {Điểm số} điểm. Ba mẹ dành lời khen cho con nhé!`

**ĐÃ ĐỐI CHIẾU THẬT (2026-09-03, hồ sơ "QA Auto Child 20260828_131937", lớp "7QA-ReRun-0820")** -
đọc content-desc thật trong icon chuông, tìm thấy **4 item khớp NGUYÊN VĂN 100%** với 4 mẫu rule ở
trên (không phải chỉ giống cấu trúc - khớp TỪNG CHỮ), trải đủ cả 2/3 mức điểm (chưa quan sát được
mẫu TH2 thật, nhưng không cần thiết - đã đủ bằng chứng rule PHẢN ÁNH ĐÚNG hệ thống thật):

- Điểm 4 (TH1) → khớp NGUYÊN VĂN mẫu TH1 #2: `"QA Auto Child 20260828_131937 đã làm xong toàn bộ
  bài tập, kết quả lần này là 4 điểm. Ba mẹ hãy cùng con xem lại bài và hỗ trợ con học tốt hơn
  nhé!"`
- Điểm 7 (TH3) → khớp NGUYÊN VĂN mẫu TH3 #1: `"Chúc mừng QA Auto Child 20260828_131937 đã hoàn
  thành tất cả bài tập với kết quả 7 điểm! Ba mẹ hãy động viên con tiếp tục phát huy nhé!"`
- Điểm 8 (TH3) → khớp NGUYÊN VĂN mẫu TH3 #5: `"Ba mẹ ơi, QA Auto Child 20260828_131937 đã hoàn
  thành tất cả bài tập với kết quả 8 điểm. Ba mẹ dành lời khen cho con nhé!"`
- Điểm 10 (TH3) → khớp NGUYÊN VĂN mẫu TH3 #4: `"QA Auto Child 20260828_131937 đã hoàn thành đầy đủ
  các bài tập được giao và đạt 10 điểm. Ba mẹ hãy tiếp tục đồng hành cùng con trên hành trình học
  tập nhé!"`

### Hành vi click — Nhóm 3

> User nhận được thông báo click chọn sẽ hiển thị màn hình xem chi tiết bài làm của học sinh: có
> nhận xét, điểm, đáp án đúng/sai.

**ĐÃ KIỂM CHỨNG THẬT - KHỚP ĐÚNG RULE** (2026-09-03, item điểm 8 ở trên) - **KHÁC hẳn Nhóm 1/2**
(xem TB-04 - nhóm đó click SAI, mở thẳng màn làm bài): click vào item Nhóm 3 dẫn ĐÚNG tới màn "Xem
chi tiết bài làm" (`exercise_show_answer_title` = "Choose the best answer. Focus on countable and
uncountable nouns. (Đúng 8/10)") - hiện đủ: tiêu đề bài + tổng số đúng/tổng ("Đúng 8/10"), từng câu
đánh dấu đúng/sai riêng (`exercise_show_answer_question_{i}_correct` / `..._incorrect` - quan sát
thật: câu 1/2/3 = `_correct`, câu 4 = `_incorrect`), nội dung câu hỏi + đáp án, nút "Giải thích"
(`exercise_explain_button`) và "Tiếp theo" (`exercise_show_answer_next_button`) để xem tiếp câu kế.
Đúng khớp mô tả rule "có nhận xét, điểm, đáp án đúng/sai" - **KHÔNG PHẢI 1 bug như TB-04**.

---

## TB-03 — "Sắp tới hạn nộp bài" khớp 1 trong 10 mẫu rule (regex hẹp, loại trừ "quá hạn")

`flows/app/thong_bao/TB-03-thong-bao-sap-den-han.yaml` - khác TB-02 (TB-02 dùng
`REMINDER_KEYWORD_PATTERN` gộp chung CẢ 3 trạng thái, không loại trừ "quá hạn"/"đã hết hạn"): TB-03
dùng regex CHỈ khớp các cụm xuất hiện ở 10 mẫu rule nhóm 2 (sắp đến hạn/sắp tới hạn/sẽ hết hạn/sắp
hết hạn/chỉ còn N ngày...) và **loại trừ** câu có "quá hạn"/"đã hết hạn" (dấu hiệu nhóm "đã trễ hạn"
- KHÔNG thuộc rule nhóm 2 này) bằng negative lookahead, tránh nhận nhầm 1 item "quá hạn" (nhóm KHÁC,
chưa có rule cố định) thành "sắp tới hạn".

### TB-03.yaml — ĐÃ CHẠY THẬT bằng `maestro test` (2026-09-03 ~08:50 giờ VN, thiết bị `3201d866d40a1681`)

`maestro test flows/app/thong_bao/TB-03-thong-bao-sap-den-han.yaml -e APP_ID=com.inet.parrotedu -e PHONE=0915775115 -e OTP=888888`
- **PASS** (exit code 0) - login SKIPPED đúng (đã có session), mở icon chuông, `scrollUntilVisible`
  khớp NGAY item thật `Cô Phương nhắc Gia Linh bài "Choose the correct answer." chỉ còn 1 ngày nữa
  là đến hạn nộp!` qua cụm "còn 1 ngày nữa" (khớp `còn\s*\d+\s*(ngày|giờ|h)\s*nữa`) - item này đúng
  khớp cấu trúc mẫu rule nhóm 2 #10, xác nhận cả regex lẫn rule đều phản ánh đúng dữ liệu thật đang
  có trên máy, không phải giả định suông.

---

## TB-04 — Click thông báo: **CONFIRMED KHÔNG KHỚP RULE** (2026-09-03, thiết bị `3201d866d40a1681`)

Rule QA mô tả: "User nhận được thông báo, click chọn sẽ hiển thị màn hình danh sách bài tập và
focus vào bài tập đó." Đã kiểm chứng THẬT qua `MaestroMcpSession` (đăng nhập tài khoản PHONE
`0915775115`, hồ sơ "Ngoc", lớp 3B/Khối 3, Pro) - **hành vi thật không khớp mô tả này**.

### Tái hiện lần 1 — item nhóm "quá hạn" (KHÔNG thuộc rule nhóm 1/2, dùng để dò cơ chế chung)

Item: `Cô Phương thông báo: "Read the text and choose the correct answer." của Ngoc đã quá hạn
nộp., 13 giờ trước`.

1. Mở icon chuông -> tap vào item trên.
2. Popup **"AI hỗ trợ học tập"** (bottom sheet, xin đồng ý gửi nội dung học tập cho AI bên thứ 3 -
   Google Gemini/Microsoft Azure AI) hiện ra NGAY (che 1 phần màn Thông báo) - đây là consent
   1-lần/phiên đã biết trong repo (xem `flows/app/helpers/open-exercise.yaml` dòng 178-183, cùng
   1 dialog dùng cho luồng "mở bài làm").
   - Nếu bấm **"Để sau"** (từ chối): dialog đóng, app hiện toast **"Không thể bắt đầu làm bài"**,
     ở lại NGUYÊN màn Thông báo - không có gì xảy ra thêm.
   - Nếu bấm **"Tiếp tục"** (đồng ý - đúng cách xử lý chuẩn của repo, xem `open-exercise.yaml`):
     app điều hướng THẲNG vào **màn LÀM BÀI** (`exercise_title` = "Read the text and choose the
     correct answer.", câu hỏi 1/10, các đáp án, nút "Tiếp tục"/`exercise_check_button`) - **KHÔNG
     PHẢI** màn danh sách Bài tập.
3. Thoát màn làm bài bằng `exercise_close_button` (không trả lời câu nào) -> app quay lại **màn
   Thông báo** (không phải màn danh sách Bài tập) - vì đó là màn đã push từ trước khi mở bài làm.

### Tái hiện lần 2 — item nhóm 2 CHÍNH THỨC "Sắp tới hạn nộp bài" (đúng phạm vi rule)

Item: `Cô Phương nhắc Gia Linh bài "Choose the correct answer." chỉ còn 1 ngày nữa là đến hạn nộp!,
13 giờ trước` (khớp cấu trúc mẫu rule nhóm 2 #10 - xem mục rule phía trên).

1. Mở icon chuông (đã có sẵn từ bước dọn dẹp trước) -> tap vào item trên.
2. Popup "AI hỗ trợ học tập" xuất hiện lại (mỗi lần mở 1 bài MỚI đều hỏi lại - không phải chỉ
   1 lần/phiên như đoán ban đầu) -> bấm "Tiếp tục".
3. Kết quả: điều hướng THẲNG vào màn LÀM BÀI (`exercise_title` = "Choose the correct answer.", câu
   hỏi "Which phrase means "đạp xe"?", 4 đáp án, `exercise_check_button` "Tiếp theo") - **CÙNG 1
   HÀNH VI** như lần 1, dù đây là item thuộc ĐÚNG 1 trong 2 nhóm rule chính thức (không phải nhóm
   "quá hạn" ngoài phạm vi rule).

### Kết luận

**Xác nhận 2 lần độc lập, 2 item khác nhau (1 item "quá hạn" ngoài rule + 1 item "sắp tới hạn"
ĐÚNG phạm vi rule)**: click vào 1 item thông báo bài tập mở **THẲNG màn làm bài (exercise doing
screen)** của đúng bài đó, chứ **KHÔNG** hiển thị "màn hình danh sách bài tập và focus vào bài tập
đó" như rule mô tả. Đóng màn làm bài sẽ quay lại màn Thông báo (nơi vừa tap ra), không phải màn
danh sách Bài tập - nghĩa là toàn bộ hành trình KHÔNG đi qua màn danh sách Bài tập ở bất kỳ bước
nào.

**Ghi nhận cho dev**: đây là 1 sự khác biệt THẬT giữa rule/spec và hành vi app hiện tại - không rõ
đây là (a) rule mô tả sai/lỗi thời so với hành vi đã triển khai thật (mở thẳng bài làm có thể là
UX chủ đích, tiện hơn cho HS), hay (b) app đang làm sai so với spec đúng (spec muốn HS thấy được
NGỮ CẢNH trong danh sách - vd các bài khác cùng lúc - trước khi vào làm bài). Cần xác nhận lại với
PM/QA gốc trước khi coi đây là bug cần fix hay chỉ là spec cần cập nhật lại cho khớp thực tế.

**Phát hiện phụ**: popup "AI hỗ trợ học tập" xuất hiện lại ở CẢ 2 lần thử (2 bài khác nhau trong
CÙNG 1 phiên đăng nhập) - không phải "chỉ hỏi 1 lần/phiên" như có thể suy đoán từ tên gọi "consent"
- cần lưu ý khi viết case mới có luồng "mở bài làm" từ notification: luôn xử lý `runFlow.when`
cho dialog này (đúng pattern `open-exercise.yaml` dòng 178-183), không giả định nó chỉ xuất hiện
lần đầu.

File `.yaml` cho case này (`TB-04-thong-bao-click-focus.yaml`) viết ASSERT ĐÚNG THEO RULE (màn danh
sách Bài tập hiện ra + đúng bài được cuộn tới) - **CHẠY THẬT SẼ FAIL** ở bước cuối, đúng như bằng
chứng ở trên - đây là chủ đích (test case theo rule, không phải theo hành vi bug hiện tại), giữ lại
để tự động phát hiện khi nào dev sửa/spec đổi thì case này tự chuyển PASS.

### TB-04.yaml — ĐÃ CHẠY THẬT bằng `maestro test` (2026-09-03 ~08:55 giờ VN, thiết bị `3201d866d40a1681`)

`maestro test flows/app/thong_bao/TB-04-thong-bao-click-focus.yaml -e APP_ID=com.inet.parrotedu -e PHONE=0915775115 -e OTP=888888`
- **FAILED đúng như dự đoán** (exit code khác 0) - toàn bộ các bước TRƯỚC đó đều COMPLETED bình
  thường (login SKIPPED đúng vì đã có session, mở icon chuông, cuộn tìm + tap item khớp regex, `Run
  flow when "AI hỗ trợ học tập"` lần này **SKIPPED** - dialog KHÔNG xuất hiện lượt chạy này, khác 2
  lần thử qua MCP session trước đó cùng ngày, có thể vì tài khoản đã "Tiếp tục" đủ số lần cần thiết
  từ các lượt thử trước - xác nhận thêm là dialog này KHÔNG xuất hiện theo quy luật cố định, đến
  bước cuối `extendedWaitUntil` chờ marker "Bài tập về nhà|Bài tập nâng cao|Bạn không có bài tập
  nào đang chờ" **FAILED** đúng 15s timeout.
- Screenshot debug tại thời điểm FAILED
  (`~/.maestro/tests/2026-09-03_085534/.../step-019-assertCondition-...png`) xác nhận NGUYÊN VĂN:
  app đang đứng ở màn LÀM BÀI thật ("Choose the correct answer.", câu hỏi "Which phrase means "đạp
  xe"?", 4 đáp án cycling/flying a kite/playing badminton/painting a picture, nút "Tiếp theo") -
  **KHÔNG PHẢI** màn danh sách Bài tập - khớp CHÍNH XÁC bằng chứng đã ghi nhận qua MCP session ở
  trên (2 lần tái hiện độc lập trước đó) - tổng cộng **3/3 lần thử độc lập** (2 qua MCP + 1 qua
  `maestro test` CLI thật) đều cho CÙNG 1 kết quả: click thông báo mở thẳng màn làm bài, không phải
  màn danh sách Bài tập như rule mô tả.

---

## TB-05 — "HS đã hoàn thành bài tập" khớp rule + click ĐÚNG (2026-09-03, thiết bị `3201d866d40a1681`)

`flows/app/thong_bao/TB-05-thong-bao-hoan-thanh-bai-tap.yaml`:
`maestro test flows/app/thong_bao/TB-05-thong-bao-hoan-thanh-bai-tap.yaml -e APP_ID=com.inet.parrotedu -e PHONE=0915775115 -e OTP=888888`

- **PASS** (exit code 0, chạy TOÀN BỘ end-to-end thật, KHÔNG cố ý FAIL như TB-04) - login SKIPPED
  đúng (đã có session, hồ sơ active lúc chạy là "QA Auto Child 20260828_131937" - login.yaml SKIP
  không phụ thuộc PHONE param có khớp hồ sơ active hay không, chỉ cần CÓ session, đúng cơ chế đã
  dùng ở TB-01/03/04), mở icon chuông, `scrollUntilVisible` khớp NGAY màn đầu (item điểm 8, xem
  mục "Nhóm 3" phía trên) qua regex `.*(đã hoàn thành|đã làm xong|đã xuất sắc hoàn thành).*(bài
  tập).*(điểm).*`, tap vào item -> `AI hỗ trợ học tập` SKIPPED (không xuất hiện cho luồng "xem lại
  bài đã nộp", khác luồng "mở bài làm mới" của TB-04 - đúng dự đoán trong docblock file) ->
  `exercise_show_answer_title` COMPLETED ngay.
- Screenshot bằng chứng
  (`~/.maestro/tests/2026-09-03_163235/.../TB-05-show-answer-detail.png`) xác nhận màn "Xem chi
  tiết bài làm" đầy đủ: tiêu đề bài + 4 chip "Câu 1/2/3/4" (3 xanh lá = đúng, 1 đỏ = sai, khớp
  đúng thứ tự đã đọc qua hierarchy: câu 4 sai), câu hỏi + 4 đáp án (đáp án HS đã chọn "bowls" tô
  xanh - SAI so với đáp án đúng thật của câu này, đúng ngữ nghĩa "câu 4 incorrect"), nút "Giải
  thích" (💡) và "Tiếp theo" - khớp ĐÚNG mô tả rule "có nhận xét, điểm, đáp án đúng/sai" 100%.
- **Kết luận**: Nhóm 3 ("HS đã hoàn thành bài tập") là nhóm DUY NHẤT trong 3 nhóm rule mà CẢ nội
  dung LẪN hành vi click đều khớp đúng như QA mô tả - khác hẳn Nhóm 1/2 (TB-04, click sai).
