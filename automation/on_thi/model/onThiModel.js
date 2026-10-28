/**
 * Model cho "Đề thầy cô giao" (module Ôn thi) - KHÁC homeworkModel.js (automation/bai_tap/model/):
 * module Bài tập có 1 model đã verify thật qua `GET /api/user/exams/room.json` (45/45 bản ghi thật,
 * xem docblock homeworkModel.js). Module Ôn thi CHƯA có bất kỳ network capture nào được xác nhận
 * trong repo này (đã grep toàn bộ `automation/`+`flows/` - không có file nào chạm tới domain "đề
 * luyện tập"/"on_thi" phía API, chỉ có flows/web/giao_bai_tap/giao_de_luyen_tap/ ở phía CMS/Web giáo
 * viên, chưa phải API học sinh đọc danh sách đề).
 *
 * CỐ TÌNH CHƯA viết `normalizeDeThi(rawItem)`/`resolveMyStatus()` tương đương homeworkModel.js -
 * KHÔNG suy đoán response shape (field nào chứa "đã công khai"/"deleted"/"điểm cao nhất") khi chưa
 * có 1 bản ghi JSON thật nào để đối chiếu, đúng nguyên tắc đã áp dụng xuyên suốt repo này (so sánh:
 * homeworkModel.js từng CỐ TÌNH bỏ field "examId" ở cấp Homework cho tới khi có nguồn xác nhận, xem
 * docblock file đó mục "TRƯỜNG ĐÃ CỐ TÌNH LOẠI KHỎI MODEL"). BƯỚC TIẾP THEO trước khi viết model này:
 * bắt 1 lượt network capture thật lúc tài khoản học sinh mở tab "Ôn thi > Đề thầy cô giao" (DevTools/
 * mitmproxy trên thiết bị test) để biết đúng endpoint + shape, rồi mới viết `normalizeDeThi()`.
 *
 * `isoToDueDateDM()` là tiện ích thuần xử lý chuỗi (không gắn với domain Bài tập hay Ôn thi) - TÁI
 * SỬ DỤNG trực tiếp từ homeworkModel.js thay vì copy-paste lần thứ 5 (xem chính docblock hàm đó liệt
 * kê đã bị copy-paste 4 lần trước rồi, không lặp lại thêm).
 */
export { isoToDueDateDM } from "../../bai_tap/model/homeworkModel.js";
