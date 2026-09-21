# Báo cáo Speaking — Score Log đối chiếu App vs Web GV (Staging, Lớp 5F)

Log thủ công, append-only. Mục đích: ghi lại điểm % TỪNG CÂU do **app** hiển thị ngay sau khi học
sinh làm bài (nguồn: screenshot user gửi trực tiếp trong chat), để sau này đối chiếu với **Web GV**
(`/teacher/exercise/{roomId}/report`, môn Speaking) MÀ KHÔNG CẦN gửi lại ảnh — user chỉ cần nói
"đối chiếu lượt N của profile X" và agent tra lại entry tương ứng ở file này.

Quy ước:
- Môi trường: STAGING (`https://parrotedu-staging.parrotedu.vn`)
- GV: `0912312312` / Lớp **5F**
- HS: `0936021880`, profile **Duy** / profile **Hang**
- % và nhãn "Đạt/Chưa đạt" lấy nguyên văn từ màn hình làm bài trên app (không phải điểm tổng quy
  đổi thang 10 bên Web GV — điểm tổng thang 10 ghi riêng ở dòng "Điểm tổng (Web GV)" nếu đã biết).
- "Học sinh đọc là" ghi nguyên văn phần phiên âm hiển thị dưới điểm (nếu app hiện dạng tách âm tiết
  kiểu "tay · buhl teh · nihs" thì giữ nguyên dấu `·`).

---

## Room: G5-U1-Lesson 2: Listen and repeat

- Room ID (Web GV): `198d3286-1480-4fcf-9740-3e9e02d30548`
- Lớp: 5F — Hạn nộp: 26/09/2026
- Tổng số câu: 8 (Câu 1 → Câu 8)

### Profile: Hang — Lượt 1

- Nguồn: screenshot user gửi 2026-09-21 (5 câu đầu qua app, xem lần lượt Câu 1→8)
- Điểm tổng (Web GV) đã quan sát cho lượt này: **5.6/10** (ghi nhận trước khi Hang làm lượt 2)

| Câu | Nội dung | % | Kết quả | Học sinh đọc là | Từ/cụm sai (tô đỏ) |
|---|---|---|---|---|---|
| 1 | table tennis | 91% | Đạt | tay · buhl teh · nihs | (không rõ, không có bản Câu 1 tô đỏ trong ảnh) |
| 2 | My favourite sport is table tennis. | 92% | Đạt | (audio, không có bản text) | "sport is" |
| 3 | pink | 53% | Đạt | kyook | (toàn bộ, phát âm không giống "pink" nhưng vẫn đủ ngưỡng Đạt) |
| 4 | My favorite color is pink. | 40% | Chưa đạt | (audio) | "is pink" |
| 5 | dolphin | 96% | Đạt | dohl · fihn | (không) |
| 6 | My favourite animal is dolphin. | 40% | Chưa đạt | (audio) | toàn bộ câu |
| 7 | sandwich | 87% | Đạt | san · dwihd | "dwihd" (phần "san" đúng) |
| 8 | Mom makes a cheese sandwich for me every morning. | 0% | Chưa đạt | (audio) | toàn bộ câu |

Tổng hợp tab trạng thái trên app (màu nhãn Câu 1..8): Đạt = {1,2,3,5,7} (5 câu), Chưa đạt =
{4,6,8} (3 câu) — khớp với "Phân tích lỗi sai" bên Web GV đã xem trước đó (C4 = Sai 1/2, nội dung
"My favorite color is pink.", Hang 40% — xác nhận đúng 1-1).

### Profile: Hang — Lượt 2

- **CHỐT (user xác nhận 2026-09-21): lượt 2 chính là điểm cao hơn đang hiển thị trên Web GV** —
  không có/không cần screenshot app riêng cho lượt này, dùng thẳng dữ liệu Web GV làm nguồn.
- Điểm tổng (Web GV): **10.0/10** (tăng từ 5.6/10 ở lượt 1).
- "Phân tích lỗi sai": cả 8 câu (C1→C8) đều **0 sai** — không câu nào còn ở tab "Sai".
- Chi tiết % đã xem qua tab "Đúng" (Web GV): Câu 8 "Mom makes a cheese sandwich for me every
  morning." = **96%** (so với 0% ở lượt 1 — cải thiện rõ nhất). Các câu 1-7 chưa mở từng ô để lấy
  % cụ thể (không cần thiết — đã đủ bằng chứng đối chiếu tổng + lỗi sai bằng 0 khớp điểm 10.0).

### Profile: Hang — Lượt 3

- Nguồn: screenshot user gửi 2026-09-21, chú thích "Lần 3 làm lại" (không nêu rõ tên profile trong
  tin nhắn — SUY LUẬN theo mạch hội thoại là Hang, vì đang theo dõi liên tục các lượt của Hang; CẦN
  đối chiếu Web GV ngay sau đây để xác nhận đúng profile nào vừa đổi điểm).
- **Quan trọng: đây là case cần tìm bấy lâu nay** — điểm lượt 3 THẤP/LẪN hơn lượt 2 (không phải
  toàn bộ Đạt như lượt 2 = 10.0), nên nếu Web GV vẫn giữ 10.0 → quy tắc là "điểm cao nhất"; nếu Web
  GV đổi sang khớp lượt 3 → quy tắc là "lượt mới nhất/gần nhất".

| Câu | Nội dung | % | Kết quả | Học sinh đọc là | Từ/cụm sai (tô đỏ) |
|---|---|---|---|---|---|
| 1 | table tennis | 40% | Chưa đạt | day · bawl | (toàn bộ, khác hẳn lượt 1 vốn Đạt 91%) |
| 2 | My favourite sport is table tennis. | 93% | Đạt | (audio) | "sport is" |
| 3 | pink | 68% | Đạt | poo · ook | (không tô đỏ trong ảnh dù phiên âm sai) |
| 4 | My favorite color is pink. | 97% | Đạt | (audio) | "favorite", "pink" (2 từ lẻ, câu vẫn Đạt) |
| 5 | dolphin | 91% | Đạt | duhl · fehn | (không) |
| 6 | My favourite animal is dolphin. | 40% | Chưa đạt | (audio) | "favourite animal is dolphin" (trừ "My") |
| 7 | sandwich | 98% | Đạt | san · dwihch | (không) |
| 8 | Mom makes a cheese sandwich for me every morning. | 93% | Đạt | (audio) | "sandwich" |

Tổng hợp: Đạt = {2,3,4,5,7,8} (6 câu), Chưa đạt = {1,6} (2 câu) — Câu 6 "My favourite animal is
dolphin." trượt ở CẢ lượt 1 và lượt 3 (điểm yếu lặp lại), Câu 1 đảo ngược từ Đạt(91%) → Chưa
đạt(40%) so với lượt 1.

**Kết quả đối chiếu Web GV (2026-09-21, ngay sau khi nhận ảnh lượt 3): CHỐT quy tắc chọn lượt.**
Web GV **VẪN giữ nguyên 10.0/10** sau lượt 3, KHÔNG đổi theo lượt 3 (thấp/lẫn hơn). Kiểm tra cụ
thể Câu 1 "table tennis" (lượt 3 = 40% Chưa đạt): Web GV hiển thị Hang = **88%** (không phải 40%,
không khớp lượt 3) và vẫn nằm trong tab "Đúng", Sai(0)/Đúng(2) không đổi trên cả 8 câu.

**→ QUY TẮC CHỌN LƯỢT (TC_025/027) = GIỮ ĐIỂM CAO NHẤT (best attempt), KHÔNG PHẢI lượt gần nhất.**
Lượt 3 (mới nhất nhưng điểm thấp hơn) bị bỏ qua hoàn toàn, hệ thống chỉ giữ kết quả tốt nhất đã đạt
được ở lượt 2. Đây là bằng chứng quyết định — trước đó lượt 2 (vừa mới hơn vừa cao điểm hơn lượt 1)
không đủ để phân biệt 2 giả thuyết, lượt 3 (mới hơn nhưng THẤP điểm hơn) mới tách bạch được.

---

## Room: G5-U1-Lesson 1: Listen and repeat

- Room ID (Web GV): `a14fd977-815d-44f2-be76-1bfa8642670d`
- Lớp: 5F — Hạn nộp: 23/09/2026
- Tổng số câu: 7 (Câu 1 → Câu 7)
- Điểm tổng (Web GV) lượt hiện tại: Duy **3.7/10**, Hang **8.7/10** (chưa có screenshot app
  chi tiết từng câu — mới đối chiếu qua Web GV, xem báo cáo 2026-09-21 trước đó trong hội thoại).
