# OTP - tiến độ chuyển đổi automation (Tier 1 - Pass)

Nguồn: `Ke_hoach_Test_Automation_OTP.docx` (52 case, 3 tier). Quyết định 2026-09-10: automate qua
UI thật (Maestro/MaestroBridge), KHÔNG gọi API trực tiếp - repo chưa có endpoint OTP nào được Dev
xác nhận (chỉ có luồng UI đăng nhập SĐT+OTP đã chạy thật qua `flows/app/helpers/login.yaml`).

Danh sách dưới đây là 15 case Tier 1 có trạng thái thủ công = Pass (không tính TC_EDGE_03, Tier 1
nhưng "Chưa test").

| Test Case ID | Trạng thái automation | Ghi chú |
|---|---|---|
| TC_LIM_SDT_01 | **PASS (chạy thật 2026-09-11)** | 0987652170, nhiều lần gửi liên tiếp thành công - xem `automation/output/otp_send_limit_result.json` (số lần chính xác trước khi chặn chưa 100% chắc do gián đoạn USB giữa chừng) |
| TC_LIM_SDT_02 | **PASS (chạy thật 2026-09-11)** | cùng thông báo lỗi: "Bạn đã gửi quá số lần cho phép trong ngày. Vui lòng thử lại vào ngày mai" |
| TC_LIM_DEV_01 | **PASS (chạy thật 2026-09-10)** | xem `automation/output/otp_device_limit_result.json` |
| TC_LIM_DEV_02 | **PASS (chạy thật 2026-09-10)** | thông báo lỗi thật: "Bạn đã gửi quá số lần cho phép trong ngày. Vui lòng thử lại vào ngày mai" |
| TC_LIM_DEV_04 | **KHÔNG THỂ TEST với hạ tầng hiện có** | giới hạn "thiết bị" nhiều khả năng tính theo IP mạng (đã xác nhận reinstall không reset được) - chỉ có 1 thiết bị/1 mạng thật, không tạo được Device-Id-2 độc lập thật sự để đối chiếu; nếu dùng thêm 1 thiết bị khác CÙNG mạng, không phân biệt được block do giới hạn SĐT (thứ cần chứng minh) hay do trùng giới hạn IP (nhiễu) |
| TC_LIM_SHARE_01 | Chưa làm | cần xác định luồng "đăng ký"/"đổi số điện thoại" thật trong app (register.yaml ghi CHƯA LIVE-VERIFIED quá bước nhập SĐT) |
| TC_LIM_SHARE_02 | Chưa làm | như trên |
| TC_WRONG_01 | Chưa làm | nhập sai OTP 2 lần, cần xác định vùng OTPField ẩn (đã có pattern trong helpers/login.yaml) |
| TC_WRONG_02 | Chưa làm | nhập sai OTP lần 3 - cần biết thông báo "mã đã huỷ" thật |
| TC_WRONG_04 | Chưa làm | verify đúng ngay lần đầu - gần như = `helpers/login.yaml` sẵn có, chỉ cần bọc thành testcase riêng |
| TC_FILE_01 | Không thể qua UI app | cần IMAP + file Excel (báo cáo đối soát qua email) - ngoài phạm vi app di động |
| TC_FILE_02 | Không thể qua UI app | như trên |
| TC_FILE_03 | Không thể qua UI app | như trên |
| TC_FILE_04 | Không thể qua UI app | như trên |
| TC_EDGE_01 | **PASS (chạy thật 2026-09-11)** | thêm 0987652170 vào CMS "Danh sách hạn chế OTP" (= whitelist/miễn trừ, KHÔNG phải blacklist chặn) - gửi OTP thành công dù đã bị chặn do vượt giới hạn 5 lần/ngày trước đó |
| TC_LOG_03 | **KHÔNG THỂ TEST - tính năng không tồn tại** | user xác nhận (2026-09-11): hệ thống KHÔNG có blacklist chặn gửi OTP, chỉ có whitelist (dùng cho TC_EDGE_01) - case này không áp dụng được cho môi trường hiện tại |

## Ràng buộc quan trọng khi chạy tiếp

- **1 thiết bị chỉ có 5 lượt gửi OTP thật/ngày TỔNG (không phân biệt SĐT)** - xem phát hiện thật
  trong `otp_device_limit_result.json`. TC_LIM_SDT_* và TC_LIM_DEV_* KHÔNG chạy trọn được trong
  cùng 1 ngày trên cùng 1 thiết bị nếu đã dùng SĐT chung.
- Nút "Gửi lại OTP" trên màn Xác thực OTP bị khoá 300s, nhưng quay lại màn đăng nhập rồi bấm
  "Đăng nhập" gửi lại NGAY không cần chờ - dùng cách này (`otpLoginSender.js`) thay vì chờ cooldown.
- TC_FILE_* (Tier 1 theo tài liệu gốc) thực chất phụ thuộc email/IMAP, KHÔNG test được qua app di
  động dù được xếp Tier 1 "automate ngay qua API" - cần hạ tầng IMAP riêng như Tier 2 mới làm được.
- **CMS "Danh sách hạn chế OTP" = whitelist/miễn trừ giới hạn 5 lần/ngày, KHÔNG phải blacklist
  chặn gửi** (đã xác nhận thật 2026-09-11, xác nhận lại với user - tên gọi "hạn chế" dễ hiểu nhầm
  là chặn). Thêm SĐT vào đây khiến SĐT đó gửi OTP luôn thành công dù đã vượt 5 lần/ngày. Đây là cơ
  chế cho TC_EDGE_01, KHÔNG áp dụng được cho TC_LOG_03 (blacklist chặn hẳn + log mã lỗi
  BLOCKED_LIST) - case đó cần 1 tính năng CMS khác (nếu có) để test.
- **Cài lại app KHÔNG reset được quota** (đã kiểm chứng thật 2026-09-10: reinstall xong, gửi lại
  cho CẢ 2 SĐT test đều bị chặn ngay dù mỗi số chưa dùng hết 5/5 riêng của nó) - giới hạn nhiều khả
  năng tính theo IP mạng hoặc 1 định danh phần cứng không đổi khi cài lại, KHÔNG theo device-id của
  riêng app. Muốn test tiếp trong cùng ngày, thử đổi mạng (WiFi khác/4G) trước khi kết luận phải
  đợi qua ngày mai.
