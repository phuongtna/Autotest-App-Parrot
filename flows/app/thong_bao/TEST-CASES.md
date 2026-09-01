# Bảng test case — Icon "Thông báo" (chuông) trên App HS

Nguồn kỳ vọng: yêu cầu QA (thông báo giao bài phải xuất hiện NGAY sau khi GV giao; nhắc hạn nộp
gửi lúc 19:00) + khảo sát THẬT trên thiết bị (`maestro hierarchy` qua MaestroMcpSession,
2026-09-01, thiết bị `3201d866d40a1681`) - repo này **không có source code app** (chỉ có Maestro
flow), không suy đoán ngoài phần đã quan sát/đã chạy thật dưới đây. Cùng quy ước cột với
`flows/app/bai_tap/TEST-CASES.md`.

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

---

## Bảng test case

| ID | Tên case | Điều kiện/dữ liệu | Bước | Kỳ vọng PASS | Coi là FAIL khi | Auto | Tay |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TB-01 | Thông báo giao bài xuất hiện NGAY sau khi GV bấm "Giao bài đã chọn" | Tài khoản GV "Phương" (0912312312, lớp 3B, `TARGET_CLASS_ID=b3336062-...`), tài khoản HS "Ngoc" (PHONE=0915775115, lớp 3B) đã login sẵn trên App; hạn nộp đặt = **hôm nay** | 1. App HS: login, đứng ở dashboard.<br>2. Web GV (Playwright): chọn lớp 3B, hạn nộp = hôm nay, random 1 Unit/Lesson/bài -> bấm "Giao bài đã chọn" -> chờ toast thành công (mốc t0).<br>3. App HS: tap icon chuông -> đọc danh sách thông báo -> đối chiếu.<br>4. Nếu chưa thấy: đóng (back) rồi mở lại icon chuông, lặp lại tới khi khớp hoặc hết 90s. | Trong danh sách Thông báo xuất hiện **1 item** mà `content-desc` chứa cả `"<tên bài vừa giao>"` (giữ nguyên ngoặc kép) VÀ `Hạn nộp: <hôm nay DD/MM/YYYY>` - đo được thời gian từ t0 tới lúc khớp | Sau 90s poll (đóng/mở lại icon chuông) KHÔNG có item nào khớp cả 2 điều kiện trên | ✅ | |
| TB-02 | Nhắc hạn nộp (hôm nay/quá hạn/sắp tới hạn) gửi lúc 19:00 | Có ít nhất 1 bài của HS đang test rơi vào 1 trong 3 trạng thái: hạn nộp hôm nay, đã quá hạn, sắp tới hạn | Vào đúng lúc 19:00 (giờ VN): mở icon chuông trên App HS, kiểm tra có thông báo nhắc nhở tương ứng | Xuất hiện thông báo nhắc nhở đúng ngữ cảnh (hạn nộp hôm nay/quá hạn/sắp hạn), đúng khung giờ 19:00 | Không có thông báo nhắc nào trong icon chuông tại/quanh 19:00 dù có bài rơi vào 1 trong 3 trạng thái trên | | ✔ |

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

## TB-02 — Quyết định: **Tay** (không tự động hoá) - lý do

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
