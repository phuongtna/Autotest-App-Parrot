# Biên bản kết quả test — Tab Bài tập & Báo cáo

**Người test:** Claude Code (chạy hộ)  **Ngày:** 10/08/2026
**Build:** app đang cài sẵn trên máy thật (không rõ version)  **Nền tảng:** ☐ iOS ☑ Android
**Thiết bị:** Samsung SM-M205G (device thật qua USB, id `3201d866d40a1681`)
**Tài khoản dùng:** PHONE=0915775115 / profile "Ha" (Pro) — chưa xác nhận đây có phải PHONE_DATA chuẩn không
**Lệnh chạy:** `maestro test -e PHONE=... -e OTP=... homework/HW-01-tab-load.yaml` và tương tự cho HW-07 (chạy lẻ từng case, không dùng `run.sh`)
**Report tự động:** không xuất junit lần này; ảnh chụp đính kèm tại `artifacts/`

> ⚠️ Mới chạy 2/27 case tab Bài tập (HW-01, HW-07) và 0/25 case tab Báo cáo trong lần này — các dòng còn lại trong bảng dưới vẫn để trống, chưa test.

## Quy ước điền kết quả

| Ký hiệu   | Nghĩa                                                                    |
| --------- | ------------------------------------------------------------------------ |
| `PASS`    | Đúng như cột "Kỳ vọng PASS" trong TEST-CASES.md                          |
| `FAIL`    | App sai. **Bắt buộc** ghi hiện tượng thực tế + ảnh/video                 |
| `BLOCKED` | Không test được vì thiếu dữ liệu / thiếu quyền / môi trường. Ghi rõ lý do |
| `N/A`     | Không áp dụng cho nền tảng đang test (vd RP-25 chỉ Android)              |

> ⚠️ Thiếu dữ liệu ⇒ ghi `BLOCKED`, **không** ghi `FAIL`.

---

## A. TAB BÀI TẬP

| ID     | Case                          | Kết quả | Hiện tượng thực tế / ảnh | Ticket |
| ------ | ----------------------------- | ------- | ------------------------ | ------ |
| HW-01  | Load tab mặc định             | PASS    | Đúng filter mặc định "2 tuần gần nhất" + tiêu đề "Bài tập" + có nội dung (section "Bài tập về nhà"). Ảnh: `artifacts/HW-01-tab-load.png` |        |
| HW-02  | Mở sheet filter               | PASS    | Sheet hiện đúng tiêu đề "Xem bài tập theo", 2 lựa chọn "2 tuần gần nhất"/"1 tháng gần nhất", nút "Xem". Script gốc dùng selector `id: homework-filter-trigger`/`homework-filter-option-*`/`homework-filter-apply` → FAILED vì các testID này không hề lộ ra thành Android resource-id (kiểm tra bằng `uiautomator dump` lúc mở sheet: toàn app chỉ có 1 resource-id duy nhất là `action_bar_root`, không có testID nào khác) — đã sửa sang selector theo text để test chạy được. Ảnh: `artifacts/HW-02-filter-sheet.png` | **Cần dev kiểm tra**: RN testID không được expose làm accessibility resource-id trên Android — cùng lỗi này còn ảnh hưởng HW-03, HW-04, HW-26, RP-12, RP-25 và helpers/open-exercise.yaml (đều dùng selector `id:`), cần rà lại toàn bộ trước khi chạy |
| HW-03  | Đổi filter → 1 tháng          | PASS    | Chọn "1 tháng gần nhất" + bấm "Xem" → sheet đóng, nhãn filter đổi đúng, danh sách reload (1/26 → 1/34), không crash/trắng màn. Cùng lỗi testID như HW-02 nên đã sửa sang selector text. Ảnh: `artifacts/HW-03-filter-month.png` |        |
| HW-04  | Đóng sheet không áp dụng      | PASS    | Chọn "1 tháng gần nhất" trong sheet rồi vuốt đóng (không bấm "Xem") → nhãn filter giữ nguyên "2 tuần gần nhất" (1/26), lựa chọn tạm không bị áp dụng. Cùng lỗi testID như HW-02/03 nên đã sửa sang selector text. Ảnh: `artifacts/HW-04-filter-dismiss.png` |        |
| HW-05  | Pull-to-refresh               | PASS    | Kéo xuống refresh → nội dung render lại bình thường, filter giữ nguyên "2 tuần gần nhất", không crash/trắng màn. Ảnh: `artifacts/HW-05-refresh.png` |        |
| HW-06  | Empty state                   |         |                          |        |
| HW-07  | 3 nhóm section + thứ tự       | PASS    | Cả 3 nhóm đều hiện đúng thứ tự **Bài tập về nhà → Bài tập nâng cao → Kiến thức trong bài**. Script tự động (`scrollUntilVisible`) báo WARNED không tìm thấy 2 nhóm sau — đã kiểm tra tay bằng scroll thủ công (adb) và xác nhận cả 2 đều hiện đúng, không phải lỗi app mà là scroll tự động không tới kịp vì tài khoản này có rất nhiều bài "về nhà" quá hạn phải lướt qua trước. Ảnh: `artifacts/HW-07-bai-tap-nang-cao.png`, `artifacts/HW-07-kien-thuc-trong-bai.png` | Đề xuất: sửa lại `scrollUntilVisible` trong HW-07 (tăng speed/scroll theo bước lớn hơn) hoặc dùng tài khoản test có ít bài "về nhà" quá hạn hơn |
| HW-08  | Card bài chưa hoàn thành      |         |                          |        |
| HW-09  | Nhãn quá hạn                  |         |                          |        |
| HW-10  | Nhãn hôm nay                  |         |                          |        |
| HW-11  | Card bài đã hoàn thành        |         |                          |        |
| HW-12  | Consent AI — đồng ý           |         |                          |        |
| HW-13  | Consent AI — từ chối          |         |                          |        |
| HW-14  | Làm bài đầy đủ → kết quả      |         |                          |        |
| HW-15  | Nút X thoát giữa bài          |         |                          |        |
| HW-16  | Lịch sử làm bài               |         |                          |        |
| HW-17  | Xem chi tiết đáp án           |         |                          |        |
| HW-18  | Role-play — mở phiên          |         |                          |        |
| HW-19  | Role-play — lịch sử           |         |                          |        |
| HW-20  | Unit gợi ý → Vui học          |         |                          |        |
| HW-21  | FREE + bài nâng cao (403)     |         |                          |        |
| HW-22  | FREE + làm lại (403)          |         |                          |        |
| HW-23  | Chống spam tap                |         |                          |        |
| HW-24  | Badge số bài chưa làm         |         |                          |        |
| HW-25  | Offline / API lỗi             |         |                          |        |
| HW-26  | Filter reset khi quay lại tab |         |                          |        |
| HW-27  | Đổi hồ sơ con → reload list   |         |                          |        |

**Tổng tab Bài tập:** PASS `6` (HW-01, HW-02, HW-03, HW-04, HW-05, HW-07) / FAIL `0` / BLOCKED `0` / N/A `0` / Chưa test `21`

---

## B. TAB BÁO CÁO

| ID    | Case                           | Kết quả | Hiện tượng thực tế / ảnh | Ticket |
| ----- | ------------------------------ | ------- | ------------------------ | ------ |
| RP-01 | Load tab                       |         |                          |        |
| RP-02 | Nhận xét tuần — rỗng           |         |                          |        |
| RP-03 | Nhận xét tuần — có dữ liệu     |         |                          |        |
| RP-04 | Mở màn Báo cáo học tập         |         |                          |        |
| RP-05 | Sheet chọn kỳ (7 option)       |         |                          |        |
| RP-06 | Đổi kỳ → Tuần này              |         |                          |        |
| RP-07 | FREE + Tháng trước (403)       |         |                          |        |
| RP-08 | PRO + 4 kỳ học kỳ              |         |                          |        |
| RP-09 | Khối Nhận xét chung            |         |                          |        |
| RP-10 | Khối Kết quả học tập           |         |                          |        |
| RP-11 | Khối Chuyên cần (4 thẻ)        |         |                          |        |
| RP-12 | Chia sẻ báo cáo                |         |                          |        |
| RP-13 | Ẩn Chia sẻ khi rỗng            |         |                          |        |
| RP-14 | Back từ màn báo cáo            |         |                          |        |
| RP-15 | Menu Thông tin các con         |         |                          |        |
| RP-16 | Menu Khôi phục đăng ký         |         |                          |        |
| RP-17 | Menu Quản lý tài khoản         |         |                          |        |
| RP-18 | 2 dòng chính sách              |         |                          |        |
| RP-19 | Đăng xuất — huỷ                |         |                          |        |
| RP-20 | Đăng xuất — xác nhận           |         |                          |        |
| RP-21 | Xóa tài khoản — điều hướng     |         |                          |        |
| RP-22 | Thẻ nâng cấp theo gói          |         |                          |        |
| RP-23 | Đổi hồ sơ con → reload báo cáo |         |                          |        |
| RP-24 | Offline / API lỗi              |         |                          |        |
| RP-25 | Android ẩn Khôi phục đăng ký   |         |                          |        |

**Tổng tab Báo cáo:** PASS ...... / FAIL ...... / BLOCKED ...... / N/A ......

---

## C. Xác nhận các điểm nghi vấn từ code (mục C trong TEST-CASES.md)

| # | Nội dung nghi vấn                                                     | Reproduce được? | Ghi chú / Ticket |
| - | --------------------------------------------------------------------- | --------------- | ---------------- |
| 1 | Lỗi mạng tab Bài tập hiện giống "không có bài tập"                     |                 |                  |
| 2 | Lỗi API báo cáo tuần hiện giống "Chưa có báo cáo mới"                  |                 |                  |
| 3 | `bestAnswer` dùng AND → điểm hiển thị có thể không phải điểm cao nhất  |                 |                  |
| 4 | `flatListRef` không gắn ref → scroll-về-đầu + load-more là no-op       |                 |                  |
| 5 | `handleRestore` thiếu `break` ở nhánh `OTHER_PROFILE`                  |                 |                  |
| 6 | Badge chỉ fetch ở 3 pathname → số bài chưa làm không cập nhật ngay     |                 |                  |
| 7 | Filter tab Bài tập reset mỗi lần quay lại tab (PO xác nhận?)           |                 |                  |
| 8 | Vòng tròn "Bài tập về nhà" hiện `0/0` khi kỳ chưa giao bài             |                 |                  |
| 9 | Chỉ 4 `testID` trong app → test tự động dễ vỡ                          |                 |                  |

---

## D. Lỗi mới phát hiện (ngoài bảng case)

| # | Mã case liên quan | Mô tả lỗi | Bước tái hiện | Mức độ | Ảnh/Video |
| - | ----------------- | --------- | ------------- | ------ | --------- |
| 1 | (test script, không phải app) | `helpers/login.yaml` và `helpers/open-tab-homework.yaml` dùng selector `.*Bài tập, tab.*` — chỉ đúng label accessibility kiểu iOS VoiceOver. Trên Android label thật là `"Bài tập"` hoặc `"Bài tập, 9+"` → mọi case chạy trên Android đều FAIL ngay ở bước login/mở tab, dù app không có lỗi | Chạy bất kỳ case HW-*/RP-* nào trên Android | N/A (bug script) | Đã sửa: login.yaml dùng `.*(Vui học\|Bài tập\|Báo cáo).*`, open-tab-homework.yaml dùng full-match `"Bài tập"` |
| 2 | HW-02 (và HW-03, HW-04, HW-26, RP-12, RP-25, helpers/open-exercise.yaml) | `testID` đặt trong code RN không lộ ra thành Android `resource-id` — `uiautomator dump` khi mở sheet filter chỉ thấy đúng 1 resource-id `com.inet.parrotedu:id/action_bar_root` trong toàn app, không có testID nào khác | Mở sheet filter tab Bài tập (hoặc bất kỳ màn nào dùng testID) trên Android, dump UI hierarchy | Major (chặn toàn bộ case dùng selector `id:` trên Android) | Đã work around cho HW-02 bằng selector text; các case còn lại chưa sửa |
| 3 |                   |           |               |        |           |

Mức độ: `Blocker` / `Critical` / `Major` / `Minor` / `Trivial`

---

## E. Kết luận

- 2 tab đã đủ điều kiện release? ☐ Có ☐ Không — lý do: ......................................
- Case bắt buộc fix trước release: ..............................................................
- Case chấp nhận nợ (ghi ticket theo dõi): ......................................................
