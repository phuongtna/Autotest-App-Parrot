# Staging Report Testing — Historical Activity Log

Log thủ công, append-only, cho **STAGING Report Testing** profile "Trang" (tài khoản
`0912252152`, Lớp 6C). File này ĐỘC LẬP hoàn toàn với `test_data/historical_activity_log.md`
(scoped riêng cho production `REPORT_TEST_PROFILE` "QA Report Test"/84912252152/7QA-Test-...,
xem `project_report_test_account_migration`) — KHÔNG trộn dữ liệu 2 môi trường, KHÔNG ghi
activity Staging vào file production và ngược lại.

Format mỗi entry:
```
Activity
- Timestamp: YYYY-MM-DD HH:mm:ss +0700
- Environment: STAGING
- Account: 0912252152
- Profile: Trang
- Class: Lớp 6C
- Profile ID: PROFILE_ID hoặc UNRESOLVED
- Session ID: SESSION_ID
- Activity Type: ACTIVITY_TYPE
- Activity Detail: DESCRIPTION
- Result: success/failure
- Test Case / Test Type: ...
```

Device-side login/thao tác do user thực hiện trực tiếp trên máy (session hiện tại KHÔNG có
tool điều khiển thiết bị/Maestro/ADB) — agent chỉ ghi log dựa trên xác nhận của user, KHÔNG
tự thực hiện hành động trên app.

## 2026-09-18

### Session Started

Activity
- Timestamp: 2026-09-18 14:18:00 +0700 (do user báo trực tiếp, giây chính xác không quan sát được)
- Environment: STAGING
- Account: 0912252152
- Profile: Trang
- Class: Lớp 6C
- Profile ID: UNRESOLVED (chưa có cách resolve qua backend/API cho tài khoản này trên môi
  trường Staging — chưa có room/hoạt động nào để tra ngược `answers[].user_id` như cách đã
  dùng cho production REPORT_TEST_PROFILE; KHÔNG đoán giá trị)
- Session ID: SESS-20260918-STAGING-TRANG-ACTIVATE
- Activity Type: login
- Activity Detail: User xác nhận đã tự đăng nhập/mở app trên môi trường Staging, hồ sơ đang
  active là "Trang" / Lớp 6C. Agent không thực hiện bước login (không có tool thiết bị trong
  session này), chỉ ghi nhận lại theo xác nhận của user.
- Result: success
- Test Type: Report Testing

**STAGING_REPORT_PROFILE_STATE = REPORT_TESTING_ACTIVE** (từ 2026-09-18 14:18:00 +0700).
Chưa có activity học tập nào được ghi nhận kể từ mốc này — chờ user báo lại hoạt động tiếp
theo (mở bài/làm bài/nộp bài/...) để log.

**Đã ghi nhận trước đó (từ screenshot, THUỘC kỳ báo cáo TRƯỚC, dùng làm baseline tham khảo):**
xem `test_data/staging_report_trang_lop6c_2026-09-18.md` — báo cáo "Tuần 1 tháng 9
(05/09/2026 - 11/09/2026)" của profile này, ghi tay từ 1 screenshot, CHƯA đối chiếu API.
