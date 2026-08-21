# Activity log — tài khoản 0915151519 / profile "Trần Duy Anh"

Log này được sinh TỰ ĐỘNG bởi `scripts/session-logger/render.mjs` từ `test_data/session_events.jsonl`
(nguồn sự thật duy nhất, append-only, ghi liên tục trong lúc dùng app). KHÔNG sửa tay
file này — mọi thay đổi phải đi qua event log rồi render lại. Xem `scripts/session-logger/`
để biết cách chạy watcher liên tục / ghi activity / seed lịch sử.

## Quy ước session

- **session_start**: ngay khi login thành công, HOẶC ngay khi mở app mà profile đã đăng nhập sẵn.
- **session_end**: CHỈ khi (a) logout, (b) màn hình điện thoại khoá/tắt thật, (c) process bị
  chấm dứt (crash/force-stop/kill), hoặc (d) mất kết nối thiết bị kéo dài. Không thao tác
  trong một khoảng thời gian KHÔNG kết thúc session — chỉ ghi "không thao tác", session vẫn
  tiếp diễn.
- App về background một chút (screen vẫn sáng, chưa logout) rồi mở lại → vẫn cùng session.
- Logout rồi login lại → luôn tạo session mới.
- Chỉ ghi hoạt động thật của user (mở/chuyển màn hình, làm bài, hoàn thành bài, dùng chức
  năng...). KHÔNG ghi debug/kỹ thuật ở đây — xem `test_data/session_watcher_debug.log` và
  memory riêng (ví dụ project_switch_profile_confirm_button_bug).
- `adb shell dumpsys usagestats --history` chỉ dùng để ĐỐI CHIẾU/RECOVERY khi watcher bị
  gián đoạn, không phải nguồn ghi chính — và thiết bị chỉ giữ rolling 24h nên không phải lúc
  nào cũng recover được.

## Sessions — 2026-08-20

### Session #1 — không rõ → 17:49:31 +0700
| Mốc | Loại | Nội dung |
|---|---|---|
| không rõ | session_start (usagestats_reconciliation) | start_time = unknown — thiết bị chỉ giữ usagestats rolling 24h, mốc bắt đầu thật đã nằm ngoài cửa sổ lưu trữ lúc phát hiện (21/08). |
| 17:49:31 +0700 | session_end | end_reason = **screen_locked** (Màn hình điện thoại khoá/tắt thật) — Xác nhận qua adb shell dumpsys usagestats --history (SCREEN_NON_INTERACTIVE ngay sau ACTIVITY_STOPPED của app). |
| | session_duration | không xác định (thiếu mốc bắt đầu hoặc kết thúc thật) |

## Sessions — 2026-08-21

### Session #1 — 08:42:00 +0700 → 09:37:00 +0700
| Mốc | Loại | Nội dung |
|---|---|---|
| 08:42:00 +0700 | session_start (manual_note) | Login — ghi từ note thủ công trước khi có đối chiếu usagestats cho phiên này. |
| 09:20:00 +0700 | activity | G7U2-HW-Lis-BTCB (Listening): làm câu 1-4/5, chưa hoàn thành (mất mạng giữa chừng 2 lần, mốc giờ ước lượng trong khoảng phiên). |
| 09:37:00 +0700 | session_end | end_reason = **manual_stop_unverified** (Dừng theo yêu cầu thủ công (chưa xác minh được bằng chứng thiết bị)) — Dừng theo yêu cầu (mạng chập chờn) — chưa xác minh bằng usagestats nên chưa rõ lý do kết thúc thật là logout hay màn hình khoá. |
| | session_duration | 55 phút |

### Session #2 — 09:44:35 +0700 → 16:03:11 +0700
| Mốc | Loại | Nội dung |
|---|---|---|
| 09:44:35 +0700 | session_start (maestro_flow) | Login thật (OTP) — xác nhận qua log Maestro (helpers/login.yaml). |
| 09:50:00 +0700 | activity | G7U2-HW-Lis-BTCB: HOÀN THÀNH (5/5 câu, Điểm 10, "Bài tập 3/6" trên màn kết quả) — mốc giờ ước lượng trong khoảng 09:44-10:00 (chưa có timestamp Maestro chính xác đến giây cho bước này). |
| 12:21:56 +0700 | không thao tác (bắt đầu) | App về background ~2 phút (chưa tắt màn hình, chưa logout) — không tách session. |
| 12:23:59 +0700 | không thao tác (kết thúc) | App mở lại foreground. |
| 16:03:11 +0700 | session_end | end_reason = **screen_locked** (Màn hình điện thoại khoá/tắt thật) — Xác nhận qua adb shell dumpsys usagestats --history (SCREEN_NON_INTERACTIVE). |
| | session_duration | 6 giờ 18 phút 36 giây |

### Session #3 — 16:50:38 +0700 → 17:12:16 +0700
| Mốc | Loại | Nội dung |
|---|---|---|
| 16:50:38 +0700 | session_start (usagestats_reconciliation) | Màn hình sáng lại lúc 16:46:46 (còn ở launcher), app thực sự mở foreground lúc 16:50:38 (profile đã đăng nhập sẵn). |
| 17:12:16 +0700 | session_end | end_reason = **logout** (Logout) — Xác nhận qua log Maestro (flows/app/report/RP-20-logout-confirm.yaml) — về màn "Nhập số điện thoại". |
| | session_duration | 21 phút 38 giây |

