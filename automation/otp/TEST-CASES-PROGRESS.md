# OTP - tiến độ chuyển đổi automation (Tier 1 - Pass)

Nguồn: `Ke_hoach_Test_Automation_OTP.docx` (52 case, 3 tier). Quyết định 2026-09-10: automate qua
UI thật (Maestro/MaestroBridge), KHÔNG gọi API trực tiếp - repo chưa có endpoint OTP nào được Dev
xác nhận (chỉ có luồng UI đăng nhập SĐT+OTP đã chạy thật qua `flows/app/helpers/login.yaml`).

Danh sách dưới đây là 15 case Tier 1 có trạng thái thủ công = Pass (không tính TC_EDGE_03, Tier 1
nhưng "Chưa test").

| Test Case ID | Trạng thái automation | Ghi chú |
|---|---|---|
| TC_LIM_SDT_01 | Chưa chạy trọn - BỊ CHẶN cả ngày 2026-09-10 | cả 2 SĐT test (0987652170, 0936021880) đã hết quota, kể cả sau khi cài lại app (xem ghi chú reinstall bên dưới) - cần đợi mai hoặc đổi mạng |
| TC_LIM_SDT_02 | Chưa chạy trọn (như trên) | như trên |
| TC_LIM_DEV_01 | **PASS (chạy thật 2026-09-10)** | xem `automation/output/otp_device_limit_result.json` |
| TC_LIM_DEV_02 | **PASS (chạy thật 2026-09-10)** | thông báo lỗi thật: "Bạn đã gửi quá số lần cho phép trong ngày. Vui lòng thử lại vào ngày mai" |
| TC_LIM_DEV_04 | Chưa làm | cần 2 thiết bị THẬT KHÁC NHAU (khác mạng/IP) - reinstall app KHÔNG đủ, xem ghi chú reinstall bên dưới |
| TC_LIM_SHARE_01 | Chưa làm | cần xác định luồng "đăng ký"/"đổi số điện thoại" thật trong app (register.yaml ghi CHƯA LIVE-VERIFIED quá bước nhập SĐT) |
| TC_LIM_SHARE_02 | Chưa làm | như trên |
| TC_WRONG_01 | Chưa làm | nhập sai OTP 2 lần, cần xác định vùng OTPField ẩn (đã có pattern trong helpers/login.yaml) |
| TC_WRONG_02 | Chưa làm | nhập sai OTP lần 3 - cần biết thông báo "mã đã huỷ" thật |
| TC_WRONG_04 | Chưa làm | verify đúng ngay lần đầu - gần như = `helpers/login.yaml` sẵn có, chỉ cần bọc thành testcase riêng |
| TC_FILE_01 | Không thể qua UI app | cần IMAP + file Excel (báo cáo đối soát qua email) - ngoài phạm vi app di động |
| TC_FILE_02 | Không thể qua UI app | như trên |
| TC_FILE_03 | Không thể qua UI app | như trên |
| TC_FILE_04 | Không thể qua UI app | như trên |
| TC_EDGE_01 | Chưa làm | cần biết SĐT/thiết bị nào được whitelist trong môi trường test hiện tại |

## Ràng buộc quan trọng khi chạy tiếp

- **1 thiết bị chỉ có 5 lượt gửi OTP thật/ngày TỔNG (không phân biệt SĐT)** - xem phát hiện thật
  trong `otp_device_limit_result.json`. TC_LIM_SDT_* và TC_LIM_DEV_* KHÔNG chạy trọn được trong
  cùng 1 ngày trên cùng 1 thiết bị nếu đã dùng SĐT chung.
- Nút "Gửi lại OTP" trên màn Xác thực OTP bị khoá 300s, nhưng quay lại màn đăng nhập rồi bấm
  "Đăng nhập" gửi lại NGAY không cần chờ - dùng cách này (`otpLoginSender.js`) thay vì chờ cooldown.
- TC_FILE_* (Tier 1 theo tài liệu gốc) thực chất phụ thuộc email/IMAP, KHÔNG test được qua app di
  động dù được xếp Tier 1 "automate ngay qua API" - cần hạ tầng IMAP riêng như Tier 2 mới làm được.
- **Cài lại app KHÔNG reset được quota** (đã kiểm chứng thật 2026-09-10: reinstall xong, gửi lại
  cho CẢ 2 SĐT test đều bị chặn ngay dù mỗi số chưa dùng hết 5/5 riêng của nó) - giới hạn nhiều khả
  năng tính theo IP mạng hoặc 1 định danh phần cứng không đổi khi cài lại, KHÔNG theo device-id của
  riêng app. Muốn test tiếp trong cùng ngày, thử đổi mạng (WiFi khác/4G) trước khi kết luận phải
  đợi qua ngày mai.
