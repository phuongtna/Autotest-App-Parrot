# Historical activity log — REPORT_TEST_PROFILE

Log thủ công, append-only, theo protocol STRICT PROFILE ISOLATION do user cung cấp
2026-09-09 (xem memory `feedback_report_test_profile_isolation`). Chỉ ghi hoạt động của
`REPORT_TEST_PROFILE` (profile "QA Report Test", tài khoản 84912252152). KHÔNG xoá/ghi đè
entry cũ, KHÔNG reset giữa các ngày — luôn append.

Đây là log THAY THẾ pipeline tự động `scripts/session-logger/` (dùng cho tài khoản
0915151519/"Trần Duy Anh", xem `test_data/activity_log_tranduyanh.md`) — quyết định
2026-09-09, xem memory `project_historical_activity_log_format`. Hai log này độc lập,
không dùng chung.

Format mỗi entry theo đúng yêu cầu Part 11 của protocol:
```
Activity
- Timestamp: YYYY-MM-DD HH:mm:ss
- Profile ID: PROFILE_ID
- Session ID: SESSION_ID
- Activity Type: ACTIVITY_TYPE
- Activity Detail: DESCRIPTION
- Result: success/failure
- Test Case: TEST_CASE_ID
```

## 2026-09-09

Activity
- Timestamp: 2026-09-09 (thời điểm chính xác không quan sát được — user tự đăng ký
  bằng SMS OTP thật, agent không tham gia bước này theo policy tạo tài khoản)
- Profile ID: (chưa có — tài khoản 84912252152 vừa đăng ký, chưa resolve profile ID
  qua API)
- Session ID: SESS-20260909-QA-REPORT-SETUP
- Activity Type: account_registration
- Activity Detail: User tự hoàn tất đăng ký tài khoản mới 84912252152 qua màn "Đăng ký
  học cho con" của app (agent không thực hiện bước OTP/tạo tài khoản, chỉ viết
  flows/app/helpers/register.yaml và xác nhận UI đăng ký tồn tại)
- Result: success
- Test Case: N/A (thiết lập REPORT_TEST_ACCOUNT, xem project_report_test_account_migration)

Activity
- Timestamp: 2026-09-09 09:42:xx +0700 (tap "Hoàn thành" xác nhận lúc đồng hồ máy hiển thị
  09:42; giây chính xác không chụp lại được, lần check adb date gần nhất ngay sau đó là
  09:43:26 +0700 — dùng mốc này làm cận trên nếu cần độ chính xác giây)
- Profile ID: (chưa có — chưa resolve qua API, xem ghi chú trên)
- Session ID: SESS-20260909-QA-REPORT-SETUP
- Activity Type: profile_created
- Activity Detail: Agent tạo hồ sơ con mới theo yêu cầu user, tái sử dụng kỹ thuật tap
  từ flows/app/profile/create_child_profile_success.yaml (radio SVG chỉ nhận tap đúng
  icon, không nhận tap theo text). Họ tên "QA Report Test", Năm sinh 2017, Trường
  "Trường Tiểu học QA" (243 Cầu Giấy, Phường Cầu Giấy, Hà Nội), Khối "Lớp 7", Lớp
  "7QA-Test-20260909_085649" (chọn theo tên lớp user chỉ định). Bấm "Hoàn thành" ->
  vào thẳng màn dashboard chính (Vui học/Bài tập/Trò chuyện/Báo cáo) -> xác nhận hồ sơ
  đã được tạo và đang active.
- Result: success
- Test Case: N/A (thiết lập REPORT_TEST_PROFILE ban đầu)

**PROFILE_CREATED_AT (mốc cho Weekly Report period, xem Part 9 protocol): 2026-09-09
~09:42 +0700** (dùng mốc "profile_created" activity ở trên). Chưa xác nhận profile ID
thật qua API — cần bổ sung khi có cách resolve (vd bearer token của tài khoản
84912252152 qua API tương tự get_tokens.sh nhưng cho app student, chưa có script này
trong repo).

Activity
- Timestamp: 2026-09-09 ~09:58 +0700 (GV giao bài qua Web GV, xác nhận qua API room.json)
- Profile ID: (chưa resolve — xem ghi chú trên); Room/assignment_id=48819f9f-c58b-4e81-849c-167531f663f4
- Session ID: SESS-20260909-QA-REPORT-TARGET5
- Activity Type: homework_assigned
- Activity Detail: GV (tài khoản 0912312312, cùng GV quản lý các lớp 2A/3B/7QA-* khác
  trong repo) giao bài "Choose the word whose underlined part is pronounced differently
  from the others." (Unit 3: Community service, 10 câu) tới lớp "7QA-Test-20260909_085649"
  (school_id 5dadbd5d-..., class_id 4d423639-8c35-4194-9c10-8e76bb092f08, đúng lớp duy
  nhất của REPORT_TEST_PROFILE, student_count=1). Hạn nộp 16/09/2026. Thực hiện qua tái
  sử dụng flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs (Playwright +
  Maestro MCP), KHÔNG viết code mới, theo yêu cầu tái sử dụng của user. Môi trường
  TEACHER_PORTAL_ENV=production (user xác nhận đúng trước khi chạy).
- Result: success
- Test Case: N/A (sinh dữ liệu thật cho weekly report đối chiếu)

Activity
- Timestamp: 2026-09-09 ~10:08 +0700 (kết thúc script, xem duration bên dưới)
- Profile ID: (chưa resolve); Room/assignment_id=48819f9f-c58b-4e81-849c-167531f663f4
- Session ID: SESS-20260909-QA-REPORT-TARGET5
- Activity Type: homework_completed
- Activity Detail: Trên app (profile "QA Report Test" active, xác nhận qua screenshot
  live giữa lúc chạy), mở đúng bài vừa giao, thoát giữa chừng (0 câu đã trả lời) rồi
  resume lại (đúng lifecycle audit của flows/bai_tap/ktra_fullluong_lambai.yaml — xem
  ghi chú app_exit bên dưới), trả lời đủ 10/10 câu bằng đáp án CMS thật (không phải tap
  mù), điểm số THẬT đọc từ màn Kết quả = 5/10, đúng targetScore=5 (random runtime trong
  [4.5, 5.5], không hardcode). Overall progress "Bài tập" tổng: 0/1 -> 1/1 (đúng 1 bài
  vừa giao, đúng 1 bài đã hoàn thành). Duration đo được: tổng 638.1s, riêng phần làm bài
  223.0s (trong đó trả lời 10 câu mất 122.5s).
- Result: success
- Test Case: N/A (sinh dữ liệu thật cho weekly report đối chiếu)

**app_exit trong lúc chạy (theo yêu cầu user "thoát app thời điểm nào cũng ghi nhận"):**
đúng 1 lần thoát MÀN LÀM BÀI (tapOn exercise_close_button) TRONG lúc chạy script trên,
xảy ra SAU khi mở bài nhưng TRƯỚC KHI trả lời bất kỳ câu nào (0/10 câu tại thời điểm
thoát) — đây là bước CHỦ Ý của kịch bản test (audit lifecycle "thoát giữa chừng ->
refresh -> tìm lại card -> resume"), KHÔNG phải app bị crash/đóng ngoài ý muốn. Đã
resume thành công ngay sau đó (RESUME passed=true), không có app_restart/force-stop/
logout nào trong suốt phiên (xem [APP_RESTART] trong report JSON: stopApp=false,
terminateApp=false, forceStop=false, unexpected_restart=false; [SAFETY] logout=false).

**LƯU Ý QUAN TRỌNG — verdict PASS/FAIL của chính script vs thực tế:**
Script tự báo `KẾT QUẢ: FAIL (phase=SCORE_VERIFY)`, NHƯNG đây là false-negative của
chính bộ đếm nội bộ script, KHÔNG phải lỗi thật của app/report: script yêu cầu
"overall progress TRƯỚC KHI giao bài" phải là 1 con số hợp lệ (>= 0) để tính được
"tổng số bài Y có tăng không", nhưng vì đây là hồ sơ HOÀN TOÀN MỚI (0 bài tập từng
được giao trước đó), màn "Bài tập" KHÔNG hiển thị dòng progress tổng nào cả trước khi
có bài đầu tiên (`overallProgressBeforeAssign = null`) -> phép so sánh tự fail dù thực
tế 0 -> 1 CHÍNH LÀ tăng đúng. TẤT CẢ các check còn lại đều PASS thật (điểm khớp target,
đủ 10/10 câu, card verify đúng, progress tổng 0->1 tăng đúng qua check khác biệt
`overallProgressOk`). Xem code tại flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs
dòng ~1465-1473 (biến `assignIncreasedTotal`). Đối chiếu report tuần: dùng 2 activity
`homework_assigned`/`homework_completed` ở trên làm dữ liệu thật, KHÔNG dùng nhãn FAIL
của script làm căn cứ "chưa hoàn thành bài".

Activity
- Timestamp: 2026-09-09 10:11:xx +0700 (thời điểm chụp màn hình xác nhận; adb date check
  gần nhất ngay sau đó là 10:13:40 +0700)
- Profile ID: (chưa resolve — cả 2 hồ sơ trùng tên đều chưa có profile ID thật, xem ghi
  chú duplicate bên dưới)
- Session ID: SESS-20260909-QA-REPORT-TARGET5
- Activity Type: profile_switch (session_end cho REPORT_TEST_PROFILE)
- Activity Detail: Agent tap "Chuyển profile" (định điều tra hồ sơ trùng tên "QA Report
  Test" thứ 2 theo phát hiện của user) - vì tài khoản 84912252152 hiện chỉ có đúng 2 hồ
  sơ, tap này chuyển THẲNG sang hồ sơ còn lại (không qua màn chọn), rời khỏi
  REPORT_TEST_PROFILE (lớp 7QA-Test-20260909_085649, vừa hoàn thành bài Điểm 5) sang hồ
  sơ trùng tên KHÔNG có lớp (0/0 bài tập, "Bạn không có bài tập nào đang chờ" - xác nhận
  đây là hồ sơ orphan/thừa, khả năng cao là do agent lỡ bấm back giữa lúc tạo hồ sơ ban
  đầu). Theo yêu cầu user: thời điểm CHUYỂN PROFILE này được tính là session_end của
  REPORT_TEST_PROFILE cho mục đích đối chiếu report tuần - không có hoạt động nào của
  REPORT_TEST_PROFILE sau mốc này cho tới khi chuyển lại.
- Result: success (chuyển đúng, xác nhận qua header mất subtitle lớp + "0/0")
- Test Case: N/A (session boundary tracking)

**Hồ sơ trùng tên "QA Report Test" — user đã xác nhận sẽ tự xóa hồ sơ orphan (không có
lớp) chứ không cần agent thực hiện.** Agent DỪNG thao tác trên profile switcher từ đây,
không tự ý xóa/sửa hồ sơ nào nữa cho tới khi có chỉ định tiếp theo. Khi user xoá xong,
cần 1 activity `profile_deleted` bổ sung (ai xoá, lúc nào, hồ sơ nào) để log này đầy đủ.

Activity
- Timestamp: 2026-09-09 ~10:14 +0700 (user báo "tôi xóa profile thừa rồi"; adb date check
  ngay sau đó = 10:15:14 +0700)
- Profile ID: (hồ sơ orphan đã bị xoá, chưa từng resolve profile ID thật)
- Session ID: SESS-20260909-QA-REPORT-SETUP
- Activity Type: profile_deleted
- Activity Detail: User TỰ xoá hồ sơ "QA Report Test" orphan (không có lớp, 0/0 bài tập
  — bản duplicate tạo ra do agent lỡ bấm back giữa lúc tạo hồ sơ ban đầu, xem
  project_report_test_account_migration). Agent xác nhận lại (read-only, màn "Thông tin
  các con") sau khi user báo: tài khoản 84912252152 giờ chỉ còn ĐÚNG 1 hồ sơ "QA Report
  Test" - "7QA-Test-20260909_085649 - Trường Tiểu học QA", không còn trùng tên nữa.
- Result: success
- Test Case: N/A (dọn dẹp dữ liệu test, khôi phục name-only match an toàn trở lại)

**RESOLVED**: từ mốc này, hồ sơ trùng tên KHÔNG còn tồn tại — name-only match (kể cả
"Chuyển profile" hay regex `PROFILE_PRO_NAME` trong các script tái sử dụng) an toàn trở
lại cho tài khoản này. Vẫn CHƯA rõ profile hiện tại đang active là hồ sơ đúng hay app tự
chuyển sang hồ sơ còn lại sau khi xoá cái kia — cần verify subtitle lớp trước khi chạy
tiếp bất kỳ automation nào.

Activity
- Timestamp: 2026-09-09 ~10:16-10:23 +0700 (script chạy xong lúc adb date check = 10:24:18 +0700)
- Profile ID: (chưa resolve); Room/assignment_id=2bb7600b-790b-412e-885a-bc9e822399d0
- Session ID: SESS-20260909-QA-REPORT-LAMLAI
- Activity Type: homework_assigned
- Activity Detail: GV (0912312312) giao bài "Choose the correct article (A, B, C or D)
  to complete each sentence." (Review 4/GRAMMAR, 10 câu) tới lớp
  "7QA-Test-20260909_085649" theo yêu cầu user "chạy case làm lại" (user xác nhận
  profile đã lên PRO). Hạn nộp 16/09/2026. Tái sử dụng
  flows/web/giao_bai_tap/e2e-giaobai-profilehientai-diem3-lamlai-diem8.mjs, KHÔNG viết
  code mới. Target score lần đầu=4, lần làm lại=9 (chọn khác mặc định 3/8 của file, theo
  standing rule không hardcode điểm).
- Result: success
- Test Case: N/A (sinh dữ liệu thật cho weekly report đối chiếu)

Activity
- Timestamp: 2026-09-09 ~10:20 +0700
- Profile ID: (chưa resolve); Room/assignment_id=2bb7600b-790b-412e-885a-bc9e822399d0
- Session ID: SESS-20260909-QA-REPORT-LAMLAI
- Activity Type: homework_completed (lần làm đầu tiên)
- Activity Detail: Trả lời 10/10 câu bằng đáp án CMS thật (không tap mù), điểm THẬT đọc
  từ màn Kết quả = 4/10, đúng target=4 (achieved qua planning, không hardcode). Xác nhận
  hồ sơ "QA Report Test" active trước khi làm (không switch).
- Result: success
- Test Case: N/A (sinh dữ liệu thật cho weekly report đối chiếu)

Activity
- Timestamp: 2026-09-09 ~10:24 +0700
- Profile ID: (chưa resolve); Room/assignment_id=2bb7600b-790b-412e-885a-bc9e822399d0
- Session ID: SESS-20260909-QA-REPORT-LAMLAI
- Activity Type: lamlai_blocked (KHÔNG phải retry thật của user trong app)
- Activity Detail: Script cố tìm lại đúng card vừa hoàn thành (cta="Làm lại") để bấm redo
  làm lần 2 (target=9) nhưng KHÔNG tìm thấy - cuộn lạc vào section "Kiến thức trong bài"
  (Review 4/Unit 3 Community Service) sau đúng 4 lần cuộn rồi báo END_OF_LIST. Đây là BUG
  TỰ ĐỘNG HOÁ đã biết trước, tái hiện lần 3 (xem
  project_lamlai_relocate_fix_and_scroll_inconsistency), KHÔNG phải lỗi PRO/paywall thật
  (đã xác nhận badge "Pro" hiển thị đúng trên header profile qua screenshot) và KHÔNG
  phải lỗi report/app thật. Chưa thực hiện lượt "Làm lại" thứ 2 nào trong app - đây là
  activity CHƯA XẢY RA, không tính vào dữ liệu report.
- Result: failure (tự động hoá, không phải hành vi app)
- Test Case: N/A (đối chiếu report tuần: chỉ dùng activity homework_completed lần ĐẦU ở
  trên, KHÔNG có lượt làm lại thứ 2 nào để đối chiếu cho tới khi có hướng xử lý tiếp)

Activity
- Timestamp: 2026-09-09 ~10:28-10:33 +0700 (script kết thúc lúc adb date check = 10:32:59 +0700)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b (RESOLVED lần đầu ở entry này - đọc
  từ answers[].user_id của room_details.json cho room 2bb7600b-...); Room/assignment_id=
  2bb7600b-790b-412e-885a-bc9e822399d0
- Session ID: SESS-20260909-QA-REPORT-LAMLAI2
- Activity Type: homework_redone (lượt "Làm lại" thứ 2, đúng bài đã hoàn thành lần đầu)
- Activity Detail: Theo chỉ định user ("Tái sử dụng code đi, làm lại với bài vừa hoàn
  thành xong ấy"), tái sử dụng automation/bai_tap/pro_lamlai_target_score.mjs (engine
  làm-lại độc lập, KHÔNG phải script assign+first-attempt+redo đã fail ở trên) với
  TARGET_TITLE + TARGET_CLASS_ID + TARGET_STUDENT_ID (profile ID vừa resolve) pin CHÍNH
  XÁC vào room đã hoàn thành, REDO_TARGET_SCORE=9. KHÔNG giao bài mới
  (new_assignments_created=0), dùng lại đúng room cũ. Bấm "Làm lại" thành công, trả lời
  9/10 câu đúng bằng subset-sum trên đáp án CMS thật (không random đoán), điểm THẬT đọc
  từ màn Kết quả = 9, đúng target=9. Điểm cũ trên card (4) chỉ để log, không phải điều
  kiện pass/fail. Duration 252.1s.
- Result: success
- Test Case: N/A (sinh dữ liệu thật cho weekly report đối chiếu - homework này giờ có 2
  lượt làm: lần đầu 4/10, làm lại 9/10)

Activity
- Timestamp: 2026-09-09 ~10:41:xx +0700 (adb date check ngay sau khi xác nhận màn hình
  đăng nhập = 10:41:40 +0700)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260909-QA-REPORT-LAMLAI2
- Activity Type: logout
- Activity Detail: Theo yêu cầu user "giờ logout tài khoản này đi". Điều hướng tab "Báo
  cáo" (đã active sẵn) -> scroll xuống mục "Đăng xuất" -> tap -> dialog "Bạn có thật sự
  muốn đăng xuất khỏi ứng dụng?" -> tap ĐÚNG nút "OK" (không dùng regex rộng, tránh bug
  đã biết tap trúng message dialog thay vì nút, xem flows/app/logout/logout_success.yaml).
  Xác nhận qua screenshot: quay về màn "Chào mừng bạn đến với ParrotEdu!" (chưa đăng
  nhập). Không có hoạt động nào khác giữa lúc "Làm lại" thành công (10:32:59) và logout
  này ngoại trừ thời gian đứng yên trong app (KHÔNG thao tác nhưng vẫn tính là active
  session, theo yêu cầu user) - không tách session.
- Result: success
- Test Case: N/A (đóng phiên Report Testing theo Part 5 protocol)

**REPORT_TEST_PROFILE state: RELEASED** (Part 18 protocol) — không tự động login lại,
không tự động chọn lại profile này cho automation tiếp theo, cho tới khi có chỉ định
Report Testing mới.

**Ghi chú kỹ thuật cho lamlai_blocked ở trên**: script `pro_lamlai_target_score.mjs` này
CŨNG dùng `scrollToTop()`/`findAssignment()` (cùng cơ chế canonical bị nghi ngờ trong
project_lamlai_relocate_fix_and_scroll_inconsistency) nhưng lần này KHÔNG gặp bug
(scroll_iterations_used=0, tìm thấy ngay). Khác biệt so với lượt fail: (1) chạy như 1
INVOCATION MỚI HOÀN TOÀN (mở app/xác nhận profile lại từ đầu) thay vì relocate NGAY SAU
KHI vừa đóng màn Kết quả trong CÙNG session script, (2) TARGET_TITLE pin sẵn thay vì tự
quét. Chưa đủ bằng chứng kết luận nguyên nhân, chỉ ghi nhận: tách thành 2 lần chạy riêng
(assign+làm lần 1, RỒI làm-lại ở 1 lần chạy MỚI) là 1 WORKAROUND THỰC TẾ hoạt động, dù
chưa fix được root cause.

## Report Testing session #2 — kích hoạt lại (2026-09-09)

Trước khi login lại: phát hiện device đang ở 1 session KHÁC HẲN, không liên quan
(profile "Hạnh vy", tài khoản 0915775115, lớp 8D, đang giữa màn kết quả Unit 6:
Lifestyles chưa dismiss - rõ ràng là hoạt động thật xảy ra giữa lúc 2 lượt chat, không
phải leftover của agent). User xác nhận bỏ qua nội dung đó, cho phép logout để chuyển
sang Report Testing. KHÔNG ghi hoạt động của "Hạnh vy"/0915775115 vào log này (ngoài
phạm vi REPORT_TEST_PROFILE) - chỉ ghi lại đây làm bối cảnh.

Activity
- Timestamp: 2026-09-09 13:47:59 +0700 (thời điểm bấm "Xác nhận" OTP, verified qua adb date)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b (re-xác nhận đúng qua subtitle lớp
  "7QA-Test-20260909_085649" + trạng thái bài tập khớp y hệt lúc logout trước: 2/2,
  "Choose the correct article..." Điểm 9, 9/10)
- Session ID: SESS-20260909-QA-REPORT-ACTIVATE
- Activity Type: login
- Activity Detail: Kích hoạt lại REPORT_TESTING theo yêu cầu user (protocol PART 4/7).
  Logout profile "Hạnh vy" (0915775115) trước (khác account, không liên quan) -> login
  84912252152 (SĐT + OTP cố định 888888) -> verify đúng "QA Report Test" qua subtitle
  lớp trước khi làm bất kỳ activity nào.
- Result: success
- Test Case: (chưa xác định - user chưa nêu Test Case ID cụ thể)
- Report type: (chưa xác định)

**REPORT_PROFILE_STATE = REPORT_TESTING_ACTIVE** (từ 2026-09-09 13:47:59 +0700, theo
Part 18 protocol). Chưa có activity học tập nào được thực hiện kể từ khi kích hoạt lại -
chờ chỉ định tiếp theo.

Activity
- Timestamp: 2026-09-09 ~13:54 +0700 (GV giao bài qua Web GV, xác nhận qua API room.json)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b; Room/assignment_id=d6ec3edd-057a-455c-85f4-acdb87e9c39c
- Session ID: SESS-20260909-QA-REPORT-TARGET5-2
- Activity Type: homework_assigned
- Activity Detail: Theo yêu cầu user "chạy case giao bài tập -> làm bài tập", tái sử
  dụng flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs (không viết
  code mới). GV (0912312312) giao bài "Unit 12: English-speaking countries/Reading"
  (5 câu) tới lớp "7QA-Test-20260909_085649". Target score range đổi thành [6.5, 8.5]
  (khác lượt trước [4.5,5.5] mặc định của file, để tránh lặp cùng 1 khoảng điểm - theo
  standing rule không hardcode). Overall progress tổng: 2/2 -> 2/3 (tăng đúng, không
  còn false-negative như lần đầu vì profile đã có lịch sử).
- Result: success
- Test Case: (chưa xác định)

Activity
- Timestamp: 2026-09-09 ~14:04 +0700 (script kết thúc lúc adb date check = 14:03:59 +0700)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b; Room/assignment_id=d6ec3edd-057a-455c-85f4-acdb87e9c39c
- Session ID: SESS-20260909-QA-REPORT-TARGET5-2
- Activity Type: homework_completed
- Activity Detail: Trả lời 5/5 câu bằng đáp án CMS thật, điểm THẬT đọc từ màn Kết quả
  = 8/10 tương đương (achievable_scores=[0,2,4,6,8,10] do bài chỉ có 5 câu, mỗi câu 2
  điểm), đúng target=8 (random runtime trong [6.5,8.5], không hardcode). Thoát giữa
  chừng (0 câu) rồi resume đúng lifecycle audit, không gặp lại bug relocate/scrollToTop
  nào. Overall progress tổng 2/3 -> (không đổi mẫu số, chỉ tăng tử số hoàn thành).
  Script tự báo OVERALL=PASS (không có false-negative lần này). Duration 599.4s.
- Result: success
- Test Case: (chưa xác định)

**LƯU Ý ĐỐI CHIẾU WEEKLY REPORT (xác nhận với user 2026-09-09, xem
project_weekly_report_btvn_duedate_rule):** dòng "Bài tập về nhà" (X/Y) của Weekly Report
tính theo bài có HẠN NỘP rơi trong tuần đó, KHÔNG theo ngày giao/ngày hoàn thành. CẢ 3
room tạo hôm nay (5/9-9 QA, 5/9-9 QA lamlai, 12/9-9-2 QA) đều có hạn nộp 16/09/2026
(tuần SAU), nên KHÔNG bài nào trong 3 bài này được tính vào X/Y của Weekly Report tuần
này (period ~09/09-11/09). User xác nhận: giữ nguyên, không tạo lại bài có hạn nộp trong
tuần - kỳ vọng ĐÚNG khi kiểm tra report thật là dòng BTVN hiển thị 0/0 (hoặc không hiện)
cho profile này tuần này, KHÔNG coi đó là bug.

**CẬP NHẬT (cùng ngày, ngay sau đó): user đổi ý** - yêu cầu "giao bài tập mới có hạn
trong khoảng tuần này để chạy được báo cáo" - xem 2 activity mới ngay dưới đây.

Activity
- Timestamp: 2026-09-09 ~14:28 +0700 (GV giao bài qua Web GV, xác nhận qua API room.json)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b; Room/assignment_id=90a94466-bdcf-40c6-b86f-f21b144ac3f0
- Session ID: SESS-20260909-QA-REPORT-TARGET5-3
- Activity Type: homework_assigned
- Activity Detail: Theo yêu cầu user, tái sử dụng lại
  flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs, lần này ép
  ASSIGN_DUE_DATE="11/09/2026" (Thứ Sáu, nằm TRONG tuần report hiện tại, khác mặc định
  +7 ngày của file) để bài này ĐƯỢC tính vào Weekly Report tuần này (xem
  project_weekly_report_btvn_duedate_rule). GV (0912312312) giao bài "Rearrange the
  words to make a correct sentence. Choose the correct order." tới lớp
  "7QA-Test-20260909_085649", hạn nộp xác nhận qua API = 11/09/2026 đúng như ép.
- Result: success
- Test Case: (chưa xác định)

Activity
- Timestamp: 2026-09-09 ~14:34 +0700 (script kết thúc lúc adb date check = 14:37:54 +0700)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b; Room/assignment_id=90a94466-bdcf-40c6-b86f-f21b144ac3f0
- Session ID: SESS-20260909-QA-REPORT-TARGET5-3
- Activity Type: homework_completed
- Activity Detail: Trả lời đủ câu bằng đáp án CMS thật, điểm THẬT đọc từ màn Kết quả = 2,
  đúng target=2 (random runtime trong [1.5, 2.5], khác 2 lần trước [4.5,5.5]/[6.5,8.5] -
  không lặp cùng khoảng điểm). Script tự báo OVERALL=PASS.
- Result: success
- Test Case: (chưa xác định)

**Room này (hạn nộp 11/09/2026, TRONG tuần report hiện tại) LÀ dữ liệu thật dùng để
đối chiếu dòng "Bài tập về nhà" X/Y của Weekly Report tuần này - khác 3 room trước (hạn
16/09, không tính).**

Activity
- Timestamp: 2026-09-09 ~15:03-15:11 +0700 (script kết thúc lúc adb date check = 15:11:33 +0700)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b; Room/assignment_id=90a94466-bdcf-40c6-b86f-f21b144ac3f0
- Session ID: SESS-20260909-QA-REPORT-LAMLAI-FULL
- Activity Type: homework_redone (làm lại, điểm full)
- Activity Detail: Theo yêu cầu user "bấm làm lại 1 bài tập bất kỳ với điểm full", tái
  sử dụng automation/bai_tap/pro_lamlai_target_score.mjs KHÔNG pin TARGET_TITLE (để
  script tự chọn "bất kỳ" candidate đầu tiên thoả điều kiện qua
  collectDistinctCompletedCandidates() - cùng cơ chế scroll đã dùng thành công trước
  đó, không viết code mới). REDO_SCORE_MODE=target REDO_TARGET_SCORE=10 (điểm full tối
  đa trên thang 10). Script tự chọn room 90a94466 ("Rearrange the words to make a
  correct sentence. Choose the correct order." - CHÍNH bài vừa giao/làm lúc ~14:28-14:34
  cùng ngày, điểm cũ=2). Trả lời ĐÚNG cả 10/10 câu bằng subset-sum trên đáp án CMS thật,
  điểm THẬT đọc từ màn Kết quả = 10, đúng target=10.
- Result: success
- Test Case: (chưa xác định)

**LẦN CHẠY ĐẦU BỊ LỖI (không phải bug mới)**: lượt chạy trước đó (~14:52-14:57, cùng
lệnh) FAIL với ROOT_CAUSE=`GET .../room.json?...period=MONTH trả về status 401` (token
TEACHER_ACCESS_TOKEN hết hạn giữa các lượt chạy trong session - đã quên refresh trước
lượt đó). Cuộn 32 lần, kẹt ở "nodes=4" liên tục vì API cross-check 401 liên tục, KHÔNG
phải bug scrollToTop/carousel đã biết trước đó (project_lamlai_relocate_fix_and_scroll_inconsistency)
- 2 lỗi khác nhau, dễ nhầm vì triệu chứng bề ngoài giống nhau (kẹt lâu, nodes thấp).
Fix: chạy lại get_tokens.sh + get_teacher_token.sh rồi retry y nguyên lệnh -> PASS ngay.
Bài học: refresh token TRƯỚC MỖI lượt chạy automation/ trong session dài, không chỉ lượt
đầu tiên (xem feedback_get_tokens_script).

## Bổ sung: CMS Kỹ năng (Skill) của 4 bài đã giao (2026-09-09 ~15:20 +0700)

User hỏi có log field "Kỹ năng" (CMS, quyết định ring nào trong "Kết quả học tập" tăng -
xem project_cms_skill_to_report_mapping) của các bài đã giao chưa - CHƯA có, chỉ log
tên Unit/Lesson (nhãn nội dung, không đảm bảo trùng field "Kỹ năng" CMS thật). Bổ sung
ngay bằng cách gọi API `GET /api/cms/lesson-items/:id` (CMS_TOKEN, không phải
TEACHER_ACCESS_TOKEN) cho từng lesson_item_id đã biết:

| Room | Title | lesson_item_id | CMS `skills[]` |
|---|---|---|---|
| 48819f9f | Choose the word whose underlined part... | 8f59c73a-ca53-48ae-affa-2ec3b633821e | PRONUNCIATION |
| 2bb7600b | Choose the correct article... | f5673470-a311-4027-8bfa-2b21e7469c43 | GRAMMAR |
| d6ec3edd | Unit 12/Reading | 94bc26d4-51eb-4295-9e52-e966bf6f9cdc | READING |
| 90a94466 | Rearrange the words... | 79c89caf-ce40-4a17-b676-9da3019bd1fe | WRITING |

Cả 4 đều trùng khớp tên Lesson hiển thị trong app (không phải luôn luôn đúng theo memory
gốc - chỉ là trùng hợp ở 4 case này, KHÔNG suy ra quy luật chung). Kỳ vọng 4 ring khác
nhau trong "Kết quả học tập" sẽ được cập nhật: Phát âm, Ngữ pháp, Kỹ năng đọc, Kỹ năng
viết - chưa verify thật trên UI report, chỉ mới xác nhận qua CMS metadata.

**Ghi chú kỹ thuật (fix tạm cho known gap trong feedback_get_tokens_script):**
`CMS_ACCESS_TOKEN` (dùng bởi automation/discovery/cmsClient.js) KHÔNG được get_tokens.sh
refresh (chỉ refresh CMS_TOKEN/EXAM_COOKIE) - gặp 401 khi gọi lessonItemDetail. Workaround
dùng ngay: copy giá trị CMS_TOKEN vừa refresh vào CMS_ACCESS_TOKEN trong .env (cùng
endpoint /api/cms/login, có vẻ là cùng loại token, 2 dòng .env lịch sử tách rời nhau) -
hoạt động ngay. Chưa viết script chính thức cho việc này.

Activity
- Timestamp: 2026-09-09 15:41:08 +0700 (verified qua adb date, xác nhận qua screenshot
  màn "Chào mừng bạn đến với ParrotEdu!")
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260909-QA-REPORT-ACTIVATE
- Activity Type: logout
- Activity Detail: User gõ đúng trigger phrase "Logout tài khoản report." (Part 5
  protocol). Verify lại đúng profile "QA Report Test"/lớp "7QA-Test-20260909_085649"
  trước khi logout (4/4 bài tập, Điểm 10 khớp lần cuối). Điều hướng tab "Báo cáo" ->
  "Đăng xuất" -> tap ĐÚNG nút "OK" (không dùng regex rộng) -> xác nhận quay về màn
  "Chào mừng bạn đến với ParrotEdu!".
- Result: success
- Test Case: (chưa xác định)

**REPORT_PROFILE_STATE = PROTECTED / DO_NOT_USE** (từ 2026-09-09 15:41:08 +0700, theo
đúng chỉ định của user cho trigger phrase này - đi thẳng từ REPORT_TESTING_ACTIVE sang
PROTECTED/DO_NOT_USE, không dừng ở RELEASED). KHÔNG tự động login lại profile này,
KHÔNG tự động chọn profile này cho automation tiếp theo, cho tới khi có chỉ định Report
Testing mới (theo đúng activation sequence: kích hoạt REPORT_TESTING -> login -> verify
profile -> mới thực hiện activity).

## Tổng kết Report Testing session #2 (2026-09-09, 13:47:59 -> 15:41:08 +0700)

3 room mới được giao + hoàn thành trong session này (bổ sung 4 room từ session #1):
- d6ec3edd (Unit 12/Reading, hạn 16/09 - NGOÀI tuần report): điểm 8/10
- 90a94466 (Rearrange the words/Writing, hạn 11/09 - TRONG tuần report): điểm 2/10 ->
  làm lại điểm 10/10 (full)
- Cả 4 room (2 session gộp lại) đã resolve CMS Kỹ năng: PRONUNCIATION, GRAMMAR, READING,
  WRITING - phủ 4 ring khác nhau trong "Kết quả học tập", chưa verify qua UI report thật.
- Chỉ room 90a94466 (hạn 11/09) sẽ được tính vào dòng "Bài tập về nhà" X/Y của Weekly
  Report tuần này; 3 room còn lại (hạn 16/09) sẽ KHÔNG được tính tuần này (đúng theo
  business rule, không phải bug).

## 2026-09-10

## Report Testing session #3 — kích hoạt lại (2026-09-10, LƯU Ý: sang ngày mới)

Trước khi login: phát hiện lại 1 session KHÁC không liên quan (profile "Hạnh vy", tài
khoản 0915775115, Khối 8, tab Vui học "Review 4" Language 2/2 Skills 0/2) - logout trước
theo đúng quy trình, không ghi vào log này.

Activity
- Timestamp: 2026-09-10 ~13:15:xx +0700 (verified qua adb date ngay sau khi confirm OTP
  = 13:15:18 +0700)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b (re-xác nhận qua tên "QA Report Test"
  + badge Pro; subtitle lớp không hiện trên tab Vui học - sẽ verify lại qua tab Bài tập
  trước khi làm activity liên quan bài tập)
- Session ID: SESS-20260910-QA-REPORT-ACTIVATE
- Activity Type: login
- Activity Detail: Kích hoạt lại REPORT_TESTING theo yêu cầu user ("Activate Report
  Testing. Tiếp tục chạy Weekly Report từ historical activity hiện có và thực hiện các
  activity còn thiếu cho đến hết thứ 6."). Logout "Hạnh vy" (0915775115) trước -> login
  84912252152 (SĐT + OTP 888888).
- Result: success
- Test Case: (chưa xác định)
- Report type: Weekly Report (tuần hiện tại, period ~09/09-11/09/2026)

**REPORT_PROFILE_STATE = REPORT_TESTING_ACTIVE** (từ 2026-09-10 13:15:18 +0700).

**Kế hoạch "activity còn thiếu" (dựa trên đối chiếu với methodology cũ
test_data/weekly_report/baocaotuan_2026-08-15.xlsx - ledger đầy đủ cho 1 Weekly Report
test trước đó, tài khoản KHÁC 0915151519/"Tran Duy Anh"/lớp 7QA-Test, KHÔNG phải
REPORT_TEST_PROFILE hiện tại, chỉ dùng để tham khảo methodology):**
Ledger đó có 6 sheet: Session Log, Homework Log, Self-learning Log (Vui học/Trò chuyện),
Assignment Summary, Expected Report (tổng hợp: Homework X/Y, Kết quả học tập theo Skill,
Retry, Self-learning completed activities, Thời gian học). Đối chiếu với dữ liệu hiện có
của REPORT_TEST_PROFILE tuần này:
- Homework: CÓ (4 room, 1 trong tuần + làm lại) - xem log phía trên.
- Retry: CÓ (1 làm lại, room 90a94466).
- Self-learning (Vui học + Trò chuyện/AI Role Play): CHƯA CÓ HOẠT ĐỘNG NÀO - đây là gap
  chính cần bổ sung trước hết Thứ Sáu 11/09 23:59:59.
- Thời gian học: có thể tính được từ các mốc login/logout đã ghi, nhưng CHƯA có 1 phiên
  "Vui học" thật nào đóng góp thời gian học riêng biệt.

**Vui học tạm hoãn (theo yêu cầu user "chưa chạy học bài vui học nhé")**: agent đã mở
thử "Trạm khởi hành 1" (Khối 4/Unit 1: My friends/Lesson 1) nhưng THOÁT NGAY qua nút X
TRƯỚC KHI trả lời bất kỳ câu nào - xác nhận qua screenshot vẫn 0/6, KHÔNG tính là
activity. User chuyển hướng sang case "giao bài -> làm bài -> làm lại" trước.

Activity
- Timestamp: 2026-09-10 ~13:22-13:32 +0700 (GV giao bài qua Web GV, xác nhận qua API room.json)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b; Room/assignment_id=ea84dfc3-6179-4a41-90fb-d9cead9b1421
- Session ID: SESS-20260910-QA-REPORT-TARGET5
- Activity Type: homework_assigned + homework_attempt_incomplete
- Activity Detail: Tái sử dụng flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs,
  ASSIGN_DUE_DATE="11/09/2026" (trong tuần report), TARGET_SCORE range [3,4]. GV giao
  bài "Read the passage and decide whether each statement is True (T) or False (F)."
  (lớp 7QA-Test-20260909_085649, hạn 11/09) - GIAO THÀNH CÔNG (overall Y: 4->5). Nhưng
  BƯỚC RESUME (sau khi thoát X giữa chừng, 0 câu đã trả lời) FAIL với
  CONTENT_MISMATCH rồi NOT_FOUND khi tìm lại card - ĐÂY LÀ BUG SẢN PHẨM/NỘI DUNG ĐÃ
  BIẾT TRƯỚC (xem project_truefalse_answer_engine_score_mismatch: title này là template
  chung, nhiều room khác nhau dùng chung title nhưng nội dung thật khác nhau), KHÔNG
  phải lỗi tự động hoá mới. Kết quả: room này hiện ĐANG Ở TRẠNG THÁI 0 câu đã làm (giao
  rồi nhưng chưa hoàn thành) - vẫn là hoạt động thật (Y tăng), chỉ KHÔNG có X (completed)
  cho room này.
- Result: partial (assign=success, complete=failure do bug sản phẩm đã biết)
- Test Case: (chưa xác định)

Activity
- Timestamp: 2026-09-10 ~13:37-13:47 +0700 (giao bài + làm bài lần đầu)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b; Room/assignment_id=c74983d5-a5a1-4304-9a45-891d67aeb539
- Session ID: SESS-20260910-QA-REPORT-TARGET5-2
- Activity Type: homework_assigned + homework_completed
- Activity Detail: Retry ngay sau room lỗi ở trên (cùng lệnh, random picker chọn bài
  KHÁC lần này - né được đúng title templated có bug). GV giao bài "Read the passage
  and choose the best answer." tới lớp 7QA-Test-20260909_085649, hạn nộp 11/09/2026
  (trong tuần report). Trả lời đủ 10/10 câu, điểm THẬT = 4, đúng target (random trong
  [3,4]). Script tự báo OVERALL=PASS.
- Result: success
- Test Case: (chưa xác định)

Activity
- Timestamp: 2026-09-10 ~13:50-13:54 +0700 (script kết thúc lúc adb date check = 13:54:31 +0700)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b; Room/assignment_id=c74983d5-a5a1-4304-9a45-891d67aeb539
- Session ID: SESS-20260910-QA-REPORT-LAMLAI3
- Activity Type: homework_redone
- Activity Detail: Theo yêu cầu user "giao bài -> làm bài -> làm lại", tái sử dụng
  automation/bai_tap/pro_lamlai_target_score.mjs (KHÔNG dùng lại script gộp đã biết lỗi
  relocate - dùng combo 2 script riêng đã proven: target5.mjs cho giao+làm lần 1, rồi
  pro_lamlai_target_score.mjs invocation MỚI cho làm lại, đúng workaround đã ghi trong
  project_lamlai_relocate_fix_and_scroll_inconsistency). TARGET_TITLE pin đúng bài vừa
  làm, REDO_SCORE_MODE=random (chọn 1 điểm khả thi bất kỳ, không hardcode). Điểm cũ=4 ->
  làm lại điểm THẬT=5, đúng target random=5. Script tự báo OVERALL=PASS. KHÔNG gặp lại
  bug scrollToTop/carousel hay lỗi content-mismatch nào.
- Result: success
- Test Case: (chưa xác định)

**Tổng kết case "giao bài -> làm bài -> làm lại" (2026-09-10):** 1 room lỗi do bug sản
phẩm đã biết (title templated, KHÔNG hoàn thành - vẫn tính Y, không tính X) + 1 room
hoàn chỉnh (giao/làm/làm lại đều PASS, điểm 4 -> 5). Cả 2 room đều hạn nộp 11/09/2026 -
TRONG tuần report hiện tại.

Activity
- Timestamp: 2026-09-10 ~14:15-14:28 +0700 (script kết thúc lúc adb date check = 14:28:20 +0700)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b; Room/assignment_id=ea84dfc3-6179-4a41-90fb-d9cead9b1421
- Session ID: SESS-20260910-QA-REPORT-BYPASS
- Activity Type: homework_completed (KHÔNG đạt điểm full theo yêu cầu - xem root cause)
- Activity Detail: Theo yêu cầu user "làm nốt bài tập còn lại trong hệ thống với tổng
  điểm full", hoàn thành room bị kẹt ở trên (ea84dfc3, title templated bug) bằng script
  tự viết automation/_scratch_finish_stuck_room_fullscore.mjs - tái sử dụng
  findAssignment()/HomeworkExamEngine/answerSetMatcher.js NGUYÊN VẸN (không viết engine
  mới), chỉ bypass đúng 1 bước: dùng examId THẬT của room (16beddd8-..., lấy qua
  fetchRoomDetails().room.exams[0].id) thay vì examId catalog bị nhầm (31867a28-...) mà
  resolveHomeworkExamQuestionsForRoomId() (theo lessonItemId) trả về sai. Resume + trả
  lời 10/10 câu THÀNH CÔNG kỹ thuật (không còn CONTENT_MISMATCH), isResultScreen=true.
  NHƯNG điểm THẬT = 7/10, KHÔNG phải full - dù mọi câu đều gọi wantCorrect=true.
- Result: partial (hoàn thành kỹ thuật, KHÔNG đạt điểm full theo yêu cầu)
- Test Case: (chưa xác định)

**ROOT CAUSE điểm không full (phát hiện MỚI, khác bug title-collision ở trên):** debug
trực tiếp `parseQuestionsFromExamPage('16beddd8-...')` cho thấy raw question JSON của
CHÍNH exam này (10 câu TRUE_FALSE) HOÀN TOÀN KHÔNG CÓ field "correct" (không phải null/
rỗng - field không tồn tại trong response). `extractCorrectAnswer()`
(automation/model/questionModel.js) coi `correct === undefined` -> trả về `null` đúng
theo thiết kế -> `decideAnswerAction()` (homeworkExamEngine.js dòng ~440) nhận
`correctAnswer=null` -> `isTargetCorrect: correct ? ... : null` luôn null, KHÔNG có cách
nào biết đáp án đúng để nhắm - mọi lượt trả lời thực chất là KHÔNG KIỂM SOÁT (ngẫu nhiên
theo thứ tự UI), điểm 7/10 là ngẫu nhiên may mắn, không phải lỗi code. Đây là GIỚI HẠN
DỮ LIỆU THẬT của riêng exam 16beddd8-... (có thể do nội dung CMS chưa được thiết lập
đáp án đúng cho phần TRUE_FALSE này), KHÔNG phải bug trong automation, và KHÔNG chắc là
đại diện cho MỌI exam loại TRUE_FALSE khác (chưa kiểm tra các exam TRUE_FALSE khác có
cùng thiếu sót hay không). Retry/"Làm lại" trên CHÍNH room này sẽ KHÔNG khắc phục được -
vẫn thiếu dữ liệu đáp án đúng, điểm vẫn sẽ ngẫu nhiên.

**Quyết định user (2026-09-10): giữ nguyên điểm 7/10.** "Làm nốt bài tập còn lại" coi
như HOÀN THÀNH (không còn room nào dở dang trong hệ thống cho profile này) dù không đạt
điểm full cho riêng room ea84dfc3 - chấp nhận do giới hạn dữ liệu thật (thiếu đáp án
đúng), không tạo thêm room mới để bù.

**Bổ sung quy tắc hiển thị (user, 2026-09-10): "báo cáo chỗ bài tập về nhà sẽ hiển thị
ngày hôm sau hạn nộp".** Dòng "Bài tập về nhà" (X/Y) CHỈ phản ánh 1 bài từ NGÀY SAU hạn
nộp trở đi, không phải ngay khi hạn nộp còn hiệu lực - khớp với quy tắc report chạy lúc
Saturday 00:00 (xem project_weekly_report_btvn_duedate_rule). 3 room trong tuần
(90a94466, ea84dfc3, c74983d5 - đều hạn 11/09/2026, Thứ Sáu) sẽ CHƯA phản ánh trong X/Y
nếu kiểm tra report TRƯỚC 12/09/2026 (Thứ Bảy) - kiểm tra sớm thấy chưa lên số KHÔNG phải
bug, phải đợi tới 12/09 trở đi mới verify đúng.

**TỔNG QUÁT HOÁ (user, 2026-09-10): "trên web chỉ cho xem báo cáo của ngày hôm trước,
ngày hôm nay sẽ cộng dồn và cập nhật vào báo cáo của ngày tiếp theo".** Đây là quy tắc
CHUNG (report có độ trễ hiển thị 1 ngày), không riêng gì BTVN - áp dụng ít nhất cho
"Thời gian học". Kiểm tra report vào ngày X chỉ thấy dữ liệu tính tới HẾT ngày X-1; hoạt
động của ngày X đang diễn ra sẽ CỘNG DỒN nhưng chỉ hiện ra khi kiểm tra report vào ngày
X+1. Áp dụng cho ước tính "Thời gian học" đã báo cáo trước đó: nếu kiểm tra report vào
10/09, "Thời gian học" CHỈ nên hiện dữ liệu của 09/09 (~169 phút/2h49'), KHÔNG phải tổng
gộp cả 09/09+10/09 (~242 phút) như đã trình bày ban đầu - phần 10/09 (~73+ phút, phiên
CHƯA đóng) sẽ chỉ lên báo cáo nếu kiểm tra vào 11/09 trở đi.

Activity
- Timestamp: 2026-09-10 14:56:11 +0700 (verified qua adb date, xác nhận qua screenshot
  màn "Chào mừng bạn đến với ParrotEdu!")
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260910-QA-REPORT-ACTIVATE
- Activity Type: logout
- Activity Detail: User gõ đúng trigger phrase "Logout tài khoản report." (Part 5
  protocol). Trước khi logout: dismiss màn Kết quả còn sót lại (room ea84dfc3, Điểm 7,
  bấm "Hoàn thành") - đây là màn hình của chính agent để lại từ script bypass, không
  phải hoạt động ngoài ý muốn. Verify đúng profile "QA Report Test"/lớp
  "7QA-Test-20260909_085649" (6/6 bài tập) trước khi logout. Điều hướng tab "Báo cáo" ->
  "Đăng xuất" -> tap ĐÚNG nút "OK" -> xác nhận quay về màn "Chào mừng bạn đến với
  ParrotEdu!".
- Result: success
- Test Case: (chưa xác định)

**REPORT_PROFILE_STATE = PROTECTED / DO_NOT_USE** (từ 2026-09-10 14:56:11 +0700, đi
thẳng từ REPORT_TESTING_ACTIVE, không dừng ở RELEASED - đúng chỉ định user cho trigger
phrase "Logout tài khoản report."). KHÔNG tự động login lại, KHÔNG tự động chọn profile
này cho automation tiếp theo cho tới khi có chỉ định Report Testing mới.

## Tổng kết Report Testing session #3 (2026-09-10, 13:15:18 -> 14:56:11 +0700)

3 room mới trong session này (tổng cộng 7 room qua 2 ngày):
- ea84dfc3 (Read the passage.../T-F, Unit 7 Traffic, hạn 11/09 - TRONG tuần report):
  điểm 7/10 - KHÔNG kiểm soát được do exam thiếu field "correct" trong CMS (giới hạn dữ
  liệu thật, xem project_truefalse_missing_correct_answer_field), không phải bug
  automation. Chỉ 1 lượt làm (không làm lại vì retry không khắc phục được vấn đề).
- c74983d5 (Read the passage.../choose best answer, hạn 11/09 - TRONG tuần report):
  điểm 4/10 -> làm lại điểm 5/10.
- Cả 3 room trong tuần (90a94466, ea84dfc3, c74983d5) đều hạn 11/09/2026 - nhưng CHƯA
  phản ánh trong X/Y của report nếu kiểm tra trước 12/09 (xem quy tắc hiển thị trễ 1
  ngày ở trên).
- Vui học/Trò chuyện: vẫn CHƯA có hoạt động nào (tạm hoãn theo yêu cầu user).
- Thời gian học ngày 10/09: login 13:15:18 -> logout 14:56:11 = ~101 phút, phiên ĐÃ
  ĐÓNG (khác lần ước tính trước lúc phiên còn mở) - đây là số liệu ngày 10/09 CUỐI CÙNG,
  sẽ phản ánh trong báo cáo kiểm tra từ 11/09 trở đi.

## Report Testing session #4 - activation (2026-09-11)

Activity
- Timestamp: 2026-09-11 15:43:30 +0700 (verify qua adb date + screenshot dashboard,
  giây chính xác không capture được)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260911-QA-REPORT-ACTIVATE
- Activity Type: login
- Activity Detail: User gõ trigger phrase "Activate Report Testing." (protocol
  [[feedback_report_test_profile_isolation]]). Device đang login sẵn ở profile khác
  ("Hạnh vy", account 0915775115, lớp 8D - không liên quan report) do phiên automation
  trước đó chưa logout. Thực hiện: mở tab "Báo cáo" -> cuộn xuống "Đăng xuất" -> xác
  nhận dialog "OK" -> quay về màn "Nhập số điện thoại" -> login lại bằng
  REPORT_PHONE=84912252152/REPORT_OTP=888888 (test_data/accounts.env). Verify đúng
  profile "QA Report Test" (Pro) qua tab "Bài tập": hiển thị lớp
  "7QA-Test-20260909_085649" đúng REPORT_TEST_PROFILE. LƯU Ý: có một session Claude Code
  KHÁC (scratchpad khác, không phải session này) đang chạy Maestro đồng thời trên cùng
  thiết bị vật lý trong lúc thực hiện - gây 3 lần đầu retry
  DeviceServerDiedException/UNAVAILABLE trước khi thiết bị rảnh để chạy được; đã dừng
  chờ (không ép chạy chồng lên phiên kia) trước khi retry thành công.
- Result: success
- Test Case: (chưa xác định)

**REPORT_PROFILE_STATE = REPORT_TESTING_ACTIVE** (từ 2026-09-11 15:43:30 +0700, đi từ
PROTECTED/DO_NOT_USE sau chỉ định "Activate Report Testing." - lần kích hoạt thứ 4).
Profile "QA Report Test" nay đang active và sẵn sàng cho report test cases tiếp theo
trong session này.

## Test case: giao bài tập -> làm bài (2-5đ) -> làm lại (>8đ) (2026-09-11)

Case theo yêu cầu user: "giao bài tập -> làm bài được >2 và <5 -> làm lại được >8".
Chạy qua script tái sử dụng `flows/web/giao_bai_tap/e2e-giaobai-range34-lamlai-range67.mjs`
(env FIRST_SCORE_MIN=2.1/MAX=4.9, REDO_SCORE_MIN=8.1/MAX=10 để đảm bảo bất đẳng thức
NGHIÊM NGẶT >2/<5 và >8, TEACHER_PORTAL_ENV=production - đã hỏi và được user xác nhận
"Production (as currently set)" trước khi chạy).

Activity
- Timestamp: 2026-09-11 16:09:xx +0700 (bắt đầu lần chạy 1, giờ chính xác không capture)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260911-QA-REPORT-ACTIVATE
- Activity Type: assign+attempt
- Activity Detail: Giao bài "G7U3-Looking back skills- BTCB" (Unit 3: Community service,
  lesson Looking back: Skills), room_id=47e67474-85d9-4d09-a747-1fc75b703c5a, hạn nộp
  18/09/2026. Nhắm điểm 4/10 (range [2.1,4.9]). Trả lời tới câu 5/10 (câu đọc đoạn văn
  "Read the passage and choose the best answer", nội dung ẩn sau nút "Xem thêm") thì
  NO_MATCH/PARTIAL_CONTENT_MATCH - matcher không khớp đủ answer-set vì passage chưa mở
  rộng (giới hạn đã biết, xem feedback_xemthem_passage_case_selection - chưa implement
  trong shared engine, KHÔNG phải bug mới). Đóng bài qua nút X, quay lại danh sách Bài
  tập - card này còn lại 4/10 "Tiếp tục" (test debris, không dọn).
- Result: failure (BLOCKED_CONTENT_MATCH, không phải lỗi automation)
- Test Case: giao-bai-lambai-lamlai-range (lần 1, FAIL)

Activity
- Timestamp: 2026-09-11 16:22:41 +0700 (kết thúc lần chạy 2, PASS - xem
  automation/output/e2e_giaobai_range34_lamlai_range67_report.json)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260911-QA-REPORT-ACTIVATE
- Activity Type: assign+attempt+retry
- Activity Detail: Giao bài "G7-U1- Vocabulary - Practice 2" (Unit 1: Hobbies, lesson
  Vocabulary), room_id=8510bfea-6683-4f58-885e-82be3d3b5465, hạn nộp 18/09/2026 (10
  scored items). Lần làm đầu: nhắm 4/10 -> điểm thật 4/10 (139.67s, từ lúc vào Doing đến
  màn Kết quả). Bấm "Làm lại": nhắm 9/10 -> điểm thật 9/10 (123.66s). Cả 2 lần điểm thật
  KHỚP CHÍNH XÁC target. Bấm CTA thật "Tiếp theo" sau màn Kết quả cuối, điều hướng đúng.
  Tổng thời gian toàn bộ (assign + 2 lượt làm): 487.5s (~8.1 phút).
- Result: success
- Test Case: giao-bai-lambai-lamlai-range (lần 2, PASS)

Activity
- Timestamp: 2026-09-11 16:40:17 +0700 (verify qua adb date, xác nhận qua screenshot
  màn hình sau đăng xuất)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260911-QA-REPORT-ACTIVATE
- Activity Type: logout
- Activity Detail: User gõ đúng trigger phrase "Logout tài khoản report." (Part 5
  protocol). Verify đúng profile "QA Report Test"/lớp "7QA-Test-20260909_085649"
  (7/8 bài tập) trước khi logout. Điều hướng tab "Báo cáo" -> cuộn xuống "Đăng xuất" ->
  tap -> dialog "Bạn có thật sự muốn đăng xuất khỏi ứng dụng?" -> tap ĐÚNG nút "OK" ->
  xác nhận quay về màn hình đăng nhập, không còn thấy "Quản lý tài khoản".
- Result: success
- Test Case: (chưa xác định)

**REPORT_PROFILE_STATE = PROTECTED / DO_NOT_USE** (từ 2026-09-11 16:40:17 +0700, đi
thẳng từ REPORT_TESTING_ACTIVE, không dừng ở RELEASED - đúng chỉ định user cho trigger
phrase "Logout tài khoản report."). KHÔNG tự động login lại, KHÔNG tự động chọn profile
này cho automation tiếp theo cho tới khi có chỉ định Report Testing mới.

## Tổng kết Report Testing session #4 (2026-09-11, 15:43:30 -> 16:40:17 +0700)

2 room mới trong session này (tổng cộng 9 room qua 4 session):
- 47e67474 (G7U3-Looking back skills- BTCB, hạn 18/09): BLOCKED ở câu 5/10 do passage
  ẩn sau "Xem thêm" (giới hạn đã biết, không phải bug mới) - còn lại 4/10 "Tiếp tục",
  test debris chưa dọn.
- 8510bfea (G7-U1- Vocabulary - Practice 2, hạn 18/09): PASS hoàn chỉnh - lần đầu 4/10
  (139.67s), Làm lại 9/10 (123.66s), cả 2 khớp target chính xác.
- Cả 2 room đều hạn 18/09/2026 - cần kiểm tra rule hiển thị báo cáo theo tuần khi tới
  gần ngày đó.
- Thời gian phiên: login 15:43:30 -> logout 16:40:17 = ~57 phút, phiên ĐÃ ĐÓNG.

## Report Testing session #5 - activation (2026-09-13)

### Session Started
- Timestamp: 2026-09-13 09:27:xx +0700 (verify qua adb date [09:28:22] + screenshot màn
  "Bài tập" đúng profile ngay sau xác nhận OTP; giây chính xác lúc xác nhận không capture
  được)
- Account: REPORT_TEST_ACCOUNT = 84912252152 (SĐT 0912252152 + OTP cố định 888888)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b (REPORT_TEST_PROFILE, profile "QA
  Report Test")
- Session ID: SESS-20260913-QA-REPORT-ACTIVATE
- Test Type: Report Testing
- Report Type: chưa xác định (user chưa chỉ định Weekly/Monthly/Mid-term/Final cho
  session này ở bước activate - sẽ bổ sung khi có test scenario cụ thể)
- Action: Login
- Result: success

Activity
- Timestamp: 2026-09-13 09:21:xx -> 09:27:xx +0700 (adb date đầu phiên = 09:21:43 +0700)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260913-QA-REPORT-ACTIVATE
- Activity Type: profile_switch + login
- Activity Detail: User gõ trigger phrase "Activate Report Testing." (protocol
  [[feedback_report_test_profile_isolation]]). Mở app: device đang login sẵn ở profile
  khác ("Hạnh vy", account 84915775115, lớp 8D - không liên quan report, không thao tác
  gì thêm trên profile này ngoài logout). Điều hướng tab "Báo cáo" (bounds thật lấy qua
  `uiautomator dump`, tab_report) -> cuộn xuống "Đăng xuất" -> dialog "Bạn có thật sự
  muốn đăng xuất khỏi ứng dụng?" -> tap "OK" -> quay về màn "Chào mừng bạn đến với
  ParrotEdu!". Login lại bằng SĐT 0912252152 + OTP 888888 (test_data/accounts.env không
  còn có REPORT_PHONE/REPORT_OTP - dùng trực tiếp giá trị đã biết từ log các session
  trước; xem discrepancy bên dưới). App tự động vào thẳng profile "QA Report Test" (Pro)
  - tài khoản này chỉ có đúng 1 hồ sơ, không cần bước "Chuyển profile" thủ công. Verify
  qua tab "Bài tập": subtitle lớp "7QA-Test-20260909_085649" khớp CHÍNH XÁC, tiến độ
  "Bài tập 7/8" khớp CHÍNH XÁC trạng thái cuối session #4 (2026-09-11) - xác nhận KHÔNG
  có hoạt động/thay đổi ngoài ý muốn nào xảy ra trên profile này trong lúc ở trạng thái
  PROTECTED/DO_NOT_USE.
- Result: success
- Test Case: N/A (thiết lập session Report Testing mới, phiên #5)

**Discrepancy phát hiện (KHÔNG tự sửa, chỉ ghi nhận theo protocol mục 14):**
`test_data/accounts.env` hiện tại (2026-09-13) CHỈ có `PHONE_NUMBER`/`OTP_CODE`/`PHONE`/
`OTP`/`UNREGISTERED_PHONE_NUMBER` (account 0915775115) - KHÔNG có `REPORT_PHONE`/
`REPORT_OTP` như log session #4 (dòng 647) đã dẫn chiếu. `scripts/run_tests.sh` (dòng
44-48) có logic fallback `REPORT_PHONE="${REPORT_PHONE:-$PHONE}"` cho target có chứa
"report" - nếu chạy Maestro suite `flows/app/report/` lúc này mà không set thủ công
`REPORT_PHONE=0912252152 REPORT_OTP=888888` qua `-e`, script sẽ SAI dùng nhầm account
0915775115 (BASIC, không phải REPORT_TEST_ACCOUNT) cho case cần tab Báo cáo. Root cause
chưa xác định (file có thể đã bị chỉnh sửa/reset ở phiên nào đó ngoài phạm vi log này -
`accounts.env` nằm trong `.gitignore` nên không có lịch sử git để đối chiếu). Chưa sửa
file - chờ chỉ định user hoặc xác nhận lại giá trị đúng trước khi ghi thêm dòng
REPORT_PHONE/REPORT_OTP vào file.

**REPORT_PROFILE_STATE = REPORT_TESTING_ACTIVE** (từ 2026-09-13 09:27:xx +0700, đi từ
PROTECTED/DO_NOT_USE sau chỉ định "Activate Report Testing." - lần kích hoạt thứ 5).
Profile "QA Report Test" nay đang active và sẵn sàng cho report test cases tiếp theo
trong session này.

Activity
- Timestamp: 2026-09-13 09:30:59 -> 09:33:22 +0700 (adb date đầu/cuối thao tác)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260913-QA-REPORT-ACTIVATE
- Activity Type: report_check (đối chiếu số liệu, theo yêu cầu user "Mở tab báo cáo để
  đối chiếu số liệu đi")
- Activity Detail: Mở tab "Báo cáo" -> "Báo cáo học tập" -> "Tuần này": hiện "Báo cáo
  học tập tuần 01 - Tháng 09/2026", Kết quả học tập = "Chưa có dữ liệu", Chuyên cần =
  Bài tập về nhà 0/0, Bài đã học 0, Nỗ lực làm lại 0 lượt, Thời gian học 3 giờ 28 phút
  (tất cả ghi "Không thay đổi so với tuần trước"). Đổi bộ lọc sang "Tuần trước": hiện
  "Báo cáo học tập tuần 53 - Tháng 09/2026" nhưng ở trạng thái RỖNG HOÀN TOÀN ("Chưa có
  báo cáo mới" + "Báo cáo học tập thường được cập nhật vào thứ bảy hàng tuần..."),
  KHÔNG có card Chuyên cần nào - khớp đúng logic đã tài liệu hoá ở
  `flows/app/report/RP-02-weekly-card-empty.yaml` (period_type=LAST_WEEK cho thứ 2-6,
  weeklyReport=null khi general_comment rỗng). User xác nhận trực tiếp: bộ lọc hiển thị
  ĐÚNG, vì đang vào ĐẦU KỲ MỚI nên dữ liệu rơi vào "Tuần này" (tuần 01) thay vì cộng dồn
  vào tuần trước (tuần 53, thuộc kỳ/năm học cũ) - KHÔNG phải bug, KHÔNG cần điều tra
  thêm việc "Tuần trước" rỗng dù có hoạt động thật ngày 09-11/09 (hoạt động đó thuộc kỳ
  học trước, ranh giới kỳ mới cắt tại đây).
- Result: success (đối chiếu khớp kỳ vọng, user xác nhận đúng)
- Test Case: N/A (đối chiếu filter tuần này/tuần trước theo yêu cầu ad-hoc)

**Discrepancy phát hiện — "Thời gian học" của "Tuần này" KHÔNG khớp tổng thời gian đã
ghi log (KHÔNG tự sửa, chỉ ghi nhận theo protocol mục 14, cần điều tra thêm):**
Theo yêu cầu user "bộ lọc tuần này dữ liệu thời gian học đã đúng với thời điểm ghi nhận
log activity trong tuần chưa?" - đối chiếu số phút hiển thị "3 giờ 28 phút" (208 phút,
trung bình "1 giờ 44 phút/buổi" => backend tính ĐÚNG 2 buổi học, vì 208/104=2.0) với
tổng thời lượng login->logout đã ghi trong log cho 4 phiên tính tới nay (đều rơi trong
tuần hiện tại Thứ 2 07/09 - CN 13/09 theo lịch, không phân biệt kỳ học cũ/mới):
- Phiên 1 (09/09, ~09:42 -> 10:41:40): ~59.67 phút
- Phiên 2 (09/09 kích hoạt lại, 13:47:59 -> 15:41:08): ~113.15 phút
- Phiên 3 (09/10, 13:15:18 -> 14:56:11): ~100.88 phút
- Phiên 4 (09/11, 15:43:30 -> 16:40:17): ~56.78 phút
- Tổng cả 4 phiên: ~330.48 phút (~5g30) - KHÔNG khớp 208 phút hiển thị.
- Cặp gần nhất: Phiên 2 + Phiên 3 = ~214.03 phút - lệch ~6 phút so với 208 (gần nhất
  trong các tổ hợp 2 phiên, nhưng vẫn KHÔNG khớp chính xác, và không có căn cứ để loại
  Phiên 1/Phiên 4 khỏi phép tính).
- KHÔNG tìm được tổ hợp phiên nào (log đã có) khớp CHÍNH XÁC 208 phút / đúng 2 buổi.
Activity
- Timestamp: 2026-09-13 09:43:45 +0700 (verify qua adb date, xác nhận qua screenshot màn
  "Chào mừng bạn đến với ParrotEdu!")
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260913-QA-REPORT-ACTIVATE
- Activity Type: logout
- Activity Detail: User gõ đúng trigger phrase "Logout tài khoản report." (protocol
  mục 15). Verify đúng profile "QA Report Test" (Pro)/lớp "7QA-Test-20260909_085649" +
  account 84912252152 trước khi logout (screenshot tab Báo cáo). Điều hướng tab
  "Báo cáo" (đã active sẵn) -> "Đăng xuất" -> dialog "Bạn có thật sự muốn đăng xuất khỏi
  ứng dụng?" -> tap "OK" -> xác nhận quay về màn "Chào mừng bạn đến với ParrotEdu!",
  không còn "Quản lý tài khoản"/số điện thoại nào hiển thị.
- Result: success
- Test Case: N/A (đóng session Report Testing theo Part 5/15 protocol)

**REPORT_PROFILE_STATE = PROTECTED / DO_NOT_USE** (từ 2026-09-13 09:43:45 +0700, đi
thẳng từ REPORT_TESTING_ACTIVE, không dừng ở RELEASED - đúng chỉ định user cho trigger
phrase "Logout tài khoản report."). KHÔNG tự động login lại, KHÔNG tự động chọn profile
này cho automation tiếp theo cho tới khi có chỉ định Report Testing mới.

## Tổng kết Report Testing session #5 (2026-09-13, 09:27:xx -> 09:43:45 +0700)

Không có room/homework mới nào được giao hoặc làm trong session này - chỉ có hoạt động
đối chiếu số liệu report (report_check) theo yêu cầu user:
- Xác nhận "Tuần này" (tuần 01, theo rule Thứ 7 tuần trước -> hết Thứ 6 tuần này =
  05/09-11/09) hiển thị Bài tập về nhà 0/0, Bài đã học 0, Nỗ lực làm lại 0 lượt, Thời
  gian học 3g28 (208 phút).
- "Tuần trước" (tuần 53 = 29/08-04/09, trước khi profile tồn tại) hiển thị rỗng hoàn
  toàn - ĐÚNG vì chưa có profile trong khoảng này.
- **Discrepancy CHƯA GIẢI QUYẾT** (xem chi tiết ở trên): "Tuần này" (05/09-11/09) đúng
  là khoảng chứa cả 4 phiên thật (~330.48 phút tổng theo log) nhưng chỉ hiển thị 208
  phút - thiếu ~122 phút, chưa xác định root cause. Cần điều tra thêm ở session sau
  (có thể cần API `GET /api/scores` hoặc tương đương phía Web GV/backend để xem cách
  tính "Thời gian học" chi tiết theo từng ngày/phiên, thay vì chỉ xem được tổng theo
  tuần qua UI app).
- Thời gian phiên: login ~09:27:xx -> logout 09:43:45 = ~16-17 phút, phiên ĐÃ ĐÓNG.

Chưa xác định được root cause: có thể do (a) "Thời gian học" backend tính theo cơ chế
khác thời lượng login->logout thô (vd chỉ tính thời gian tương tác thật trong bài học,
loại trừ thời gian đứng ở màn Kết quả/menu), (b) ranh giới "tuần này" theo backend không
đúng Thứ 2-CN như log giả định, hoặc (c) có hoạt động/phiên KHÁC ngoài 4 phiên đã ghi mà
log này chưa capture được. Cần điều tra thêm trước khi kết luận đây là bug hay hành vi
đúng - CHƯA đủ căn cứ để xác nhận "khớp" như user hỏi.

**ĐÍNH CHÍNH ranh giới tuần (user bổ sung quy tắc chính thức, 2026-09-13): "báo cáo là
ghi nhận log trong 1 tuần từ thứ 7 tuần trước đến hết thứ 6 tuần này"** - tức 1 kỳ báo
cáo tuần = [Thứ 7, Thứ 7+6 ngày=Thứ 6]. Áp dụng lại với hôm nay = CN 13/09/2026:
- Kỳ tuần vừa generate (Thứ 7 12/09 00:00, theo rule cadence đã biết) = **Thứ 7 05/09 ->
  Thứ 6 11/09** - đây MỚI LÀ khoảng chứa CẢ 4 phiên thật đã ghi (09/09, 09/09, 09/10,
  09/11 đều nằm trong 05/09-11/09) => đây chính là **"Tuần này" (tuần 01)** đang hiển thị
  208 phút, KHÔNG phải do "đầu kỳ mới" như agent kết luận nhầm ở entry đối chiếu filter
  phía trên (bản ghi đó CẦN SỬA LẠI cách giải thích, xem dưới).
- **"Tuần trước" (tuần 53)** theo rule này = **Thứ 7 29/08 -> Thứ 6 04/09** - khoảng thời
  gian TRƯỚC KHI profile "QA Report Test" được tạo (PROFILE_CREATED_AT ~09/09) => rỗng
  là ĐÚNG, đơn giản vì chưa tồn tại profile trong khoảng này, KHÔNG liên quan gì đến "kỳ
  học mới" - giải thích "đầu kỳ mới" trước đó của agent (và cách user diễn giải nhanh lúc
  đó) là suy luận SAI, tuy kết luận cuối "tuần trước rỗng là đúng" vẫn ĐÚNG (đúng kết quả,
  sai lý do).
- **Discrepancy CHÍNH vẫn còn nguyên và giờ RÕ HƠN**: "Tuần này" (05/09-11/09, chứa cả 4
  phiên thật, tổng ~330.48 phút theo log) hiển thị CHỈ 208 phút - thiếu ~122 phút so với
  tổng log. Đây KHÔNG còn là câu hỏi "đúng tuần chưa" (đã xác nhận đúng tuần) mà là câu
  hỏi "vì sao số phút KHÔNG khớp tổng log" - vẫn CHƯA có root cause, cần điều tra thêm
  (xem giả thuyết (a)/(b)/(c) ở trên - giả thuyết (b) nay có thể loại bỏ vì ranh giới tuần
  đã xác nhận đúng qua rule user cung cấp; còn lại (a) tính riêng thời gian tương tác thật
  và (c) phiên/hoạt động thiếu sót trong log là 2 hướng khả dĩ nhất).

## ĐÍNH CHÍNH — lỗi đếm cộng dồn số room (phát hiện qua user hỏi lại, 2026-09-17)

Các dòng "tổng kết session" ở trên bị SAI ở bước cộng dồn: tổng kết session #3
(dòng ~617-628) ghi "3 room mới trong session này (tổng cộng 7 room qua 2 ngày)" nhưng
session #3 (09/10) thực tế chỉ có **2 room mới** (ea84dfc3, c74983d5) — room 90a94466
được liệt kê cùng nhóm "3 room trong tuần" nhưng đó là room ĐÃ giao từ session #2
(09/09), không phải room mới của session #3. Lỗi cộng dồn 4→7 (đáng lẽ 4→6) kéo theo
tổng kết session #4 cũng sai theo ("tổng cộng 9 room qua 4 session", đáng lẽ 8).

**Số room thật, đếm lại theo từng room_id duy nhất (05/09-11/09/2026):**
48819f9f, 2bb7600b, d6ec3edd, 90a94466, ea84dfc3, c74983d5, 47e67474, 8510bfea =
**8 room**, không phải 9. Không có room ẩn nào ngoài 8 room đã liệt kê chi tiết ở các
activity phía trên — chỉ là lỗi số học ở dòng tổng kết, dữ liệu activity gốc vẫn đúng.

Activity
- Timestamp: 2026-09-18 ~09:19 +0700 (đồng hồ hiển thị trên screenshot màn "Báo cáo học
  tập" do user cung cấp)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: N/A (user tự chụp màn hình, agent không thao tác trên thiết bị cho activity
  này - chỉ đối chiếu số liệu)
- Activity Type: report_check (đối chiếu screenshot report thật với log, theo yêu cầu
  user "báo cáo tuần vừa rồi")
- Activity Detail: Screenshot Weekly Report (tuần 05/09-11/09/2026, giáo viên "Cô Phương")
  hiển thị: Kỹ năng đọc=6, Kỹ năng viết=10, Bài tập về nhà 3/3, Bài đã học 0, Nỗ lực làm
  lại 2 lượt, Thời gian học 3 giờ 28 phút (208'). Đối chiếu khớp CHÍNH XÁC với 3 room hạn
  nộp trong tuần (90a94466/Writing, ea84dfc3/Reading, c74983d5/Reading):
  - BTVN 3/3: cả 3 room đã hoàn thành = X=Y=3 ✓ (giờ đã "chốt" đúng theo rule trễ 1 ngày,
    kiểm tra 09/13 trước đó còn thấy 0/0 vì chưa qua 12/09).
  - Nỗ lực làm lại = 2: CHỈ tính retry của room hạn-trong-tuần (90a94466 + c74983d5), loại
    trừ 2 retry khác trong log thuộc room hạn ngoài tuần (2bb7600b, 8510bfea) - phát hiện
    MỚI, trước đây chưa rõ retry-counter có lọc theo due-date-in-week hay không.
  - Kỹ năng viết = 10: khớp điểm CUỐI (sau làm lại) của 90a94466.
  - Kỹ năng đọc = 6 = trung bình (7 + 5)/2 của ea84dfc3 (không retry, điểm=7) và c74983d5
    (điểm CUỐI sau làm lại=5) - phát hiện MỚI: ring "Kết quả học tập" = TRUNG BÌNH điểm
    CUỐI CÙNG (không phải lần đầu) của các room CÙNG skill, CHỈ tính room hạn-trong-tuần.
    Đồng thời SUY RA (chưa verify qua CMS API) cả ea84dfc3 và c74983d5 đều mang skill
    READING - khớp con số tuyệt đối, độ tin cậy cao dù chưa xác nhận trực tiếp.
  - Thời gian học vẫn = 208 phút, KHÔNG đổi so với lần kiểm tra 09/13 (5 ngày trước) dù
    tuần đã hoàn toàn kết thúc và "chốt sổ" - xác nhận đây là số liệu CUỐI CÙNG, không
    phải do độ trễ hiển thị 1 ngày. Discrepancy ~122 phút so với tổng log thô (~330.5')
    vẫn CHƯA có root cause, không tự giải thích thêm được từ dữ liệu này.
- Result: success (đối chiếu khớp phần lớn, xác nhận được cơ chế tính report; 1
  discrepancy về thời gian học vẫn treo)
- Test Case: N/A (đối chiếu report thật ad-hoc theo yêu cầu user)

**ĐÍNH CHÍNH thuật ngữ (user cung cấp bảng spec chính thức, ngay sau đó cùng ngày
2026-09-18):** công thức đúng của ring "Kết quả học tập" là ĐTB (kỹ năng) = X/Y (làm tròn
1 chữ số thập phân), trong đó X = tổng điểm của LẦN LÀM BÀI **CAO NHẤT** mỗi bài thuộc kỹ
năng đó (không phải lần làm GẦN NHẤT/sau làm lại như agent suy luận ở activity trên) và
Y = số bài đã làm thuộc kỹ năng đó. Tuần 05-11/09 không phân biệt được 2 cách hiểu vì mọi
lượt làm lại đều đạt điểm cao hơn lần đầu (max = lần cuối trùng nhau). Xem chi tiết công
thức đã sửa tại memory `project_cms_skill_to_report_mapping`.

## Report Testing session #6 (2026-09-18) — kích hoạt lại theo chỉ định "Activate Report
Testing. Tiếp tục chạy Weekly Report từ historical activity hiện có và thực hiện các
activity còn thiếu cho đến hết thứ 6."

**Bối cảnh:** hôm nay 2026-09-18 là THỨ SÁU — theo quy tắc ranh giới tuần đã đính chính
2026-09-13 ("báo cáo tính từ Thứ 7 tuần trước đến hết Thứ 6 tuần này"), tuần report hiện
tại = **Thứ 7 12/09 → Thứ 6 18/09 (hôm nay, đóng tối nay)**. Log không có activity nào
trong khoảng 12/09-18/09 trước session này (session #5 gần nhất 09/13 chỉ report_check,
không tạo room mới) — cần ít nhất 1 room có hạn nộp rơi trong tuần này trước khi tuần
đóng.

Activity
- Timestamp: 2026-09-18 ~15:27-15:30 +0700 (khoảng bị chặn 2 đầu bởi 2 mốc CHÍNH XÁC qua
  screenshot đồng hồ: 15:23:xx màn đăng nhập trống ban đầu; sau đó 1 lượt chạy bị timeout-
  kill giữa lúc login, đồng hồ TẠI THỜI ĐIỂM ĐÓ = 15:27:xx (vẫn ở màn đăng nhập); giây
  login THẬT thành công ở lượt chạy lại ngay sau đó không có timestamp riêng, chỉ chặn
  trên bởi mốc kế tiếp CHÍNH XÁC = 15:31:33 +0700, xem activity giao bài dưới)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260918-QA-REPORT-ACTIVATE
- Activity Type: login (REPORT_TESTING_ACTIVE)
- Activity Detail: Trước khi login, verify màn hình thiết bị đã ở màn "Chào mừng bạn đến
  với ParrotEdu!" (KHÔNG có session lạ nào cần logout trước — khác các lần trước). Refresh
  CMS_TOKEN/EXAM_COOKIE (get_tokens.sh) + TEACHER_ACCESS_TOKEN (get_teacher_token.sh) +
  đồng bộ tay CMS_ACCESS_TOKEN. Login qua REPORT_PHONE=84912252152/REPORT_OTP=888888 (thực
  hiện tự động trong script `e2e-teacher-assign-full-scored-target5.mjs`, KHÔNG phải bước
  agent tự tay). Verify PASS: hồ sơ "QA Report Test" đã active, tier=PRO.
- Result: success
- Test Case: N/A (kích hoạt Report Testing theo protocol Part 10)

Activity
- Timestamp: 2026-09-18 15:31:33 +0700 (CHÍNH XÁC — lấy trực tiếp từ timestamp trả về của
  API room.json lúc GV giao bài, KHÔNG phải suy đoán: `t=2026-09-18T08:31:33.691Z` UTC)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260918-QA-REPORT-ACTIVATE
- Activity Type: homework_assigned
- Activity Detail: GV giao bài qua Web GV (Playwright, script `e2e-teacher-assign-full-scored-target5.mjs`) tới lớp "7QA-Test-20260909_085649": bài "Unit 3: Community
  service/Writing/Choose the correct sentence or the sentence closest in meaning."
  (itemId=ed938a7c-..., N=10 câu), **hạn nộp ép cố định = 18/09/2026 (hôm nay — để rơi
  đúng vào tuần report đang đóng)**. Web GV xác nhận qua toast "Giao bài tập mới thành
  công" + API room.json diff: room_id=662a4018-9f5d-47f4-8598-3e5e11ab5faf, ngày
  giao=18/09/2026, hạn nộp=18/09/2026. Target score range random (KHÔNG hardcode) =
  [6.8, 7.8] → targetScore resolve =7/10.
- Result: success (giao bài Web GV xác nhận qua API, KHÔNG phải qua UI App)
- Test Case: N/A

**Bug automation phát hiện lại (KHÔNG phải bug sản phẩm) — findAssignment() NOT_FOUND lặp
lại 3 lần độc lập trên CÙNG 1 card, dù đã xác nhận card CÓ THẬT qua screenshot tay:**
- Lượt 1: script chính tự locate ngay sau khi giao bài → NOT_FOUND, scrollCount=7,
  STOP_REASON=END_OF_LIST.
- Lượt 2: chạy lại với `REUSE_ROOM_ID` (bỏ qua giao bài lại, chỉ locate lại) → NOT_FOUND
  lại, cũng scrollCount=7, END_OF_LIST — loại trừ khả năng "sync delay" (đã cách lượt 1
  vài phút).
- Kiểm tra tay: agent tự cuộn thủ công (adb swipe) trên chính thiết bị, CHỤP ĐƯỢC
  screenshot card "Choose the correct sentence or the sentence closest in meaning." / "Hạn
  nộp 18/09 (Hôm nay)" / nút "Làm bài" hiển thị RÕ, ngay gần đầu danh sách "Bài tập về
  nhà" — xác nhận card có thật, KHÔNG phải do delay hay do agent nhìn nhầm.
- Lượt 3: script bypass viết riêng (`automation/_scratch_finish_new_room_report_2026_09_18.mjs`,
  theo kỹ thuật [[feedback_direct_handler_invocation_bypass]]) gọi `findAssignment()` với
  `maxScrolls=30` — VẪN NOT_FOUND, dừng ở scrollCount=7 (không tôn trọng maxScrolls=30,
  tự dừng sớm khi detect END_OF_LIST). → đây là bug xảy ra ỔN ĐỊNH (3/3), KHÁC với dạng
  flaky ~50% đã biết ở [[project_navigation_selector_and_card_locate_bugs]] và KHÁC dạng
  "sync delay false alarm" ở [[project_new_room_invisible_in_homework_list_bug]] — cần ghi
  nhận là 1 biến thể MỚI của lỗi locate (nghi ngờ liên quan tới cơ chế "cuộn về đầu" của
  bridge/scrollToTop bị lệch vị trí thật khi danh sách đang ở giữa 1 carousel ngang lồng
  trong list dọc — quan sát tay thấy 2 lần cuộn-về-đầu giống nhau từ CÙNG vị trí carousel
  cho ra 2 kết quả cuộn KHÁC nhau, gợi ý carousel nuốt gesture không ổn định — cùng họ với
  [[project_3b_carousel_swipe_swallow_locate_bug_2026_09_17]] nhưng xảy ra trên lớp
  7QA-Test, không phải 3B).
- **Workaround áp dụng (không sửa code chung, chỉ bypass cho lượt này):** agent tự mở
  card bằng tay (adb tap trực tiếp vào tọa độ nút "Làm bài" xác định qua screenshot đã
  cuộn đúng), popup "AI hỗ trợ học tập" chặn sau đó được dismiss qua
  `MaestroMcpBridge.runSteps` (`tapOn: { id: "app_dialog_ok_button" }` — TÁI SỬ DỤNG cơ chế
  runFlow/tapOn có sẵn, không viết logic mới), sau đó tiếp tục trả lời câu hỏi bằng ĐÚNG
  `HomeworkExamEngine`/`findMatchingQuestion` như mọi flow khác (script bypass thêm cờ
  `ALREADY_OPEN=true` để bỏ qua riêng bước locate+tap, KHÔNG bỏ qua bước trả lời).

Activity
- Timestamp: 2026-09-18 ~15:47 → 15:54:05 +0700 (mở đầu = 15:47:xx, CHÍNH XÁC qua screenshot
  đồng hồ ngay lúc tap tay "Làm bài"; kết thúc chặn trên bởi adb date check = 15:54:05,
  ngay TRƯỚC khi đọc log thấy cả 10 câu đã trả lời xong — quá trình dismiss popup AI hỗ
  trợ bị kẹt qua 3 lượt tap tay sai tọa độ từ ~15:47-15:49 [ĐÃ SỬA bằng cách chuyển sang
  tapOn qua resource-id thay vì tọa độ tay, theo đúng "tái sử dụng code" — xem note bug ở
  trên], sau đó bypass script chạy 10 câu mất phần lớn khoảng 15:50-15:54)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260918-QA-REPORT-ACTIVATE
- Activity Type: homework_started (làm bài, room 662a4018)
- Activity Detail: Mở đúng room "Choose the correct sentence or the sentence closest in
  meaning." (bypass tay do bug locate ở trên), dismiss popup AI hỗ trợ, vào màn Doing.
  Đang trả lời 10 câu qua HomeworkExamEngine, target 7/10 đúng (random trong [6.8,7.8],
  KHÔNG hardcode) — real_room_exam_id=97a9d97e-... (KHÁC catalog_exam_id=a1fd10c4-..., đã
  xử lý qua full-answer-set matcher theo [[project_teacher_materials_examid_order_mismatch]]).
- Result: in_progress (chờ script hoàn tất, sẽ log nốt Result cuối khi có màn Kết quả)
- Test Case: N/A

Activity
- Timestamp: 2026-09-18 ~15:54:20 +0700 (đọc qua màn Kết quả ngay sau khi script hoàn tất)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260918-QA-REPORT-ACTIVATE
- Activity Type: homework_completed
- Activity Detail: Room 662a4018-9f5d-47f4-8598-3e5e11ab5faf ("Choose the correct sentence
  or the sentence closest in meaning.", hạn nộp 18/09/2026, lớp 7QA-Test-20260909_085649)
  hoàn thành cả 10/10 câu qua HomeworkExamEngine/findMatchingQuestion (full-answer-set
  match PASS cả 10 câu, không câu nào lỗi match). Màn Kết quả đọc được: **Điểm 3
  (correct=3/10)** — KHÔNG khớp target dự kiến 7/10.
- Result: **partial/uncontrolled** — hoàn thành thật (real completion, tính cho BTVN X/Y
  tuần này), nhưng KHÔNG kiểm soát được điểm số như kế hoạch
- Test Case: N/A

**PHÁT HIỆN MỚI — exam loại "ONE" (câu hỏi trắc nghiệm 1 lựa chọn) cũng thiếu answer-key
CMS, KHÔNG chỉ riêng TRUE_FALSE:** cả 10/10 câu của exam thật `97a9d97e-5611-45d3-b72b-d3e9fb7984a2`
(real_room_exam_id, KHÁC catalog_exam_id=a1fd10c4-... — đã tự bypass qua đúng room exam
theo [[project_teacher_materials_examid_order_mismatch]], loại trừ khả năng lỗi resolve
sai exam) trả về `isTargetCorrect=null` xuyên suốt khi answerCurrentQuestionOneShot() gọi
với `wantCorrect` đã set đúng theo kế hoạch (7 câu true, 3 câu false) — nghĩa là
`decideAnswerAction()` hoàn toàn KHÔNG có ground truth (`correctAnswer=null` sau
`normalizeQuestions()`) cho MỌI câu, giống hệt cơ chế đã ghi ở
[[project_truefalse_missing_correct_answer_field]] nhưng lần này xảy ra trên type "ONE"
(không phải TRUE_FALSE) — **mở rộng phạm vi nghi vấn: đây có thể là 1 lỗ hổng authoring
CMS rộng hơn, không giới hạn ở TRUE_FALSE, cần kiểm tra thêm mẫu trước khi kết luận diện
rộng.** Điểm thật 3/10 (không phải 7/10 hay may rủi ra full điểm) xác nhận việc chọn đáp
án hoàn toàn KHÔNG kiểm soát được cho room này — retry ("Làm lại") trên CHÍNH room này sẽ
KHÔNG giúp gì (cùng root cause, không phải do sai sót thao tác) — nếu cần target score
kiểm soát được, phải chọn candidate KHÁC ngay từ bước pre-scan (ngoài phạm vi session này,
đã hết hạn — room đã tạo xong, hạn nộp hôm nay, không thể đổi bài khác được nữa).

Activity
- Timestamp: 2026-09-18 ~15:58 +0700
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260918-QA-REPORT-ACTIVATE
- Activity Type: user_decision (hỏi qua AskUserQuestion do 2 bug thật phát sinh + thời gian
  hạn hẹp trước khi tuần đóng tối nay)
- Activity Detail: User quyết định (1) room debris cũ "G7U3-Looking back skills- BTCB"
  (4/10, dở dang, due 18/09 hôm nay, đã biết lỗi "Xem thêm"/passage từ session #4) → BỎ
  QUA, không đụng vào; (2) KHÔNG cần chạy thêm "Làm lại" trên room 662a4018 vừa hoàn thành
  (điểm vẫn sẽ ngẫu nhiên do cùng lỗi thiếu answer-key, không đáng đánh đổi thêm thời
  gian/rủi ro cho 1 data-point "Nỗ lực làm lại" không cần thiết).
- Result: success (quyết định rõ ràng, dừng đúng lúc)
- Test Case: N/A

Đóng result screen bằng nút "X" (KHÔNG dùng "Tiếp theo" — tránh bug stuck-navigation đã
biết ở [[project_check_kienthuc_stuck_navigation_bug]]). Xác nhận quay về danh sách "Bài
tập" sạch: tổng "Bài tập 8/9" (tăng đúng 1 so với baseline 7/9 trước khi giao bài), room
"G7U3-Looking back skills- BTCB" (4/10, due 18/09 Hôm nay) vẫn hiển thị nguyên trạng dở
dang như quyết định của user — KHÔNG bị đụng vào.

## Tổng kết Report Testing session #6 (2026-09-18, ~15:23 → hiện tại, CHƯA logout)

- Tuần report đang chạy: **Thứ 7 12/09 → Thứ 6 18/09 (hôm nay, đóng tối nay)** — trước
  session này KHÔNG có activity nào trong khoảng này.
- **+1 room mới, due trong tuần:** 662a4018-9f5d-47f4-8598-3e5e11ab5faf ("Choose the
  correct sentence or the sentence closest in meaning.", Unit 3/Writing, hạn 18/09/2026),
  hoàn thành 10/10 câu, **Điểm 3 (3/10)** — KHÔNG đạt target 7/10 dự kiến, do phát hiện
  MỚI: exam thật của room thiếu hoàn toàn answer-key CMS (mọi câu `correctAnswer=null`),
  mở rộng phạm vi lỗi đã biết ở [[project_truefalse_missing_correct_answer_field]] sang
  type "ONE" (trắc nghiệm 1 lựa chọn) — KHÔNG chỉ TRUE_FALSE.
- **Bug automation MỚI phát hiện (3/3 lần tái hiện, ổn định — không phải flaky ngẫu
  nhiên):** `findAssignment()` báo NOT_FOUND/END_OF_LIST sau đúng 7 lượt cuộn, dù card đã
  xác nhận CÓ THẬT qua screenshot tay — khác cả 2 dạng lỗi locate đã biết trước đó (flaky
  ~50%, và sync-delay false-alarm). Workaround: mở card bằng tay (adb tap) + dismiss popup
  qua bridge, sau đó dùng lại nguyên `HomeworkExamEngine` cho phần trả lời — KHÔNG viết
  engine mới, chỉ bypass đúng 1 bước locate bị lỗi.
- Room debris cũ "G7U3-Looking back skills- BTCB" (4/10, due 18/09 hôm nay, lỗi
  "Xem thêm"/passage từ session #4) — user quyết định BỎ QUA, không xử lý trong session
  này. **Tác động tới BTVN tuần này:** với ít nhất 1 room due-trong-tuần chưa hoàn thành,
  BTVN X/Y tuần 12/09-18/09 nhiều khả năng sẽ hiển thị KHÔNG phải X=Y sạch (cần xác nhận
  lại qua report_check thật sau khi tuần đóng, từ 19/09 trở đi theo rule trễ 1 ngày).
- **REPORT_PROFILE_STATE: vẫn REPORT_TESTING_ACTIVE** (chưa có trigger phrase "Logout tài
  khoản report." trong session này) — KHÔNG tự logout, chờ chỉ định tiếp theo.

## Case mới cùng session #6: "giao bài tập -> làm bài 2-4đ -> làm lại điểm 8"

Activity
- Timestamp: 2026-09-18 16:06:11 +0700 (CHÍNH XÁC — API room.json: `t=2026-09-18T09:06:11.508Z` UTC)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260918-QA-REPORT-ACTIVATE
- Activity Type: homework_assigned
- Activity Detail: GV giao bài qua Web GV tới lớp "7QA-Test-20260909_085649": "Unit 1:
  Hobbies/Language/G7-U1- Language- Practice 1" (itemId=66e42438-..., N=15 câu), hạn nộp ép
  cố định = 18/09/2026 (trong tuần report đang đóng). API xác nhận room_id=46dfbfc5-4a3c-4fb0-956f-ea9ab0ad6cce.
  Target range đầu (KHÔNG hardcode, theo yêu cầu user "2-4đ") = [2, 4] → prescan resolve
  targetScore=2.667 (tương đương 4/15 câu đúng, N=15 không chia hết 10 nên achievable là
  bậc 0.6667).
- Result: success (giao bài Web GV xác nhận qua API)
- Test Case: N/A

**Bug locate findAssignment() lặp lại LẦN 4 trong ngày (cùng họ đã ghi ở session trước) —
NOT_FOUND/END_OF_LIST ngay sau khi giao bài.** Áp dụng lại ĐÚNG workaround đã dùng: mở tay
qua adb tap (xác định tọa độ qua cuộn thủ công + screenshot), sau đó tái sử dụng
`automation/_scratch_finish_new_room_report_2026_09_18.mjs` (đã tham số hoá qua ENV thay vì
sửa hardcode mỗi lần — ROOM_ID/REAL_EXAM_ID/ROOM_TITLE/DUE_DM/TARGET_SCORE/CORRECT_COUNT)
với `ALREADY_OPEN=true`. Lần này KHÔNG có popup "AI hỗ trợ học tập" chặn (khác lần trước) —
vào thẳng màn Doing. Cũng phát hiện + sửa 1 lỗi nhỏ của chính script bypass: check hồ sơ
active qua header text bị fail giả (header không hiển thị khi đã ở màn Doing sâu) — sửa
bằng cách bỏ qua check này khi `ALREADY_OPEN=true` (đã verify hồ sơ bằng tay qua screenshot
TRƯỚC khi mở card).

Activity
- Timestamp: 2026-09-18 ~16:19:16 +0700 (đọc màn Kết quả, chặn dưới bởi adb date check ngay
  sau khi script hoàn tất)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260918-QA-REPORT-ACTIVATE
- Activity Type: homework_completed
- Activity Detail: Room 46dfbfc5-4a3c-4fb0-956f-ea9ab0ad6cce ("G7-U1- Language- Practice
  1") hoàn thành 15/15 câu qua HomeworkExamEngine (full-answer-set match PASS toàn bộ, real
  exam_id=71eda5cb-8485-41d2-bdf0-0a540c513c0e). Kế hoạch 4/15 đúng (targetScore=2.667), màn
  Kết quả đọc được **Điểm 3.3 (5/15)** — LẠI KHÔNG khớp kế hoạch (giống case room 662a4018
  buổi sáng), nhưng LẦN NÀY tình cờ vẫn rơi trong khoảng user yêu cầu [2,4]. Xác nhận
  `isTargetCorrect=null` xuyên suốt 15/15 câu — CÙNG lỗi thiếu answer-key CMS, lần thứ 3
  trong ngày trên 3 exam khác nhau (662a4018 type ONE N=10, và giờ 46dfbfc5 type ONE N=15).
  Overall "Bài tập" tăng đúng 1 cặp X/Y: 8/9 → 9/10 (cả completed VÀ total đều +1, khớp kỳ
  vọng khi giao bài mới).
- Result: **partial/uncontrolled nhưng nằm trong range yêu cầu** (3.3 ∈ [2,4], coi như đạt
  mục tiêu "làm bài 2-4đ" dù không phải do kiểm soát được, mà do trùng hợp)
- Test Case: N/A

**Mở rộng thêm phát hiện lỗi thiếu answer-key (đã ghi ở
[[project_truefalse_missing_correct_answer_field]]):** nay là lần thứ 3 trong cùng 1 ngày
(2026-09-18) trên 3 room/exam riêng biệt (1 TRUE_FALSE trước đây 2026-09-10, +2 type "ONE"
hôm nay) — đủ cơ sở nghi ngờ đây là vấn đề DIỆN RỘNG trong nội dung CMS của môi trường này,
không phải hiện tượng hiếm/cá biệt. Khuyến nghị: báo lại cho team content/CMS để kiểm tra
tỷ lệ % exam thiếu trường `correct`, KHÔNG tiếp tục coi từng trường hợp là ngoại lệ riêng
lẻ.

Activity
- Timestamp: 2026-09-18 ~16:30:31 +0700 (CHÍNH XÁC qua adb date check ngay sau khi script
  hoàn tất, cũng khớp đồng hồ trên screenshot màn Kết quả = 16:31)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260918-QA-REPORT-ACTIVATE
- Activity Type: homework_redone (làm lại, room 46dfbfc5)
- Activity Detail: Tap "Làm lại" NGAY trên màn Kết quả lần 1 (KHÔNG qua
  `pro_lamlai_target_score.mjs` — tránh bug relocate riêng đã biết ở
  [[project-lamlai-relocate-fix-and-scroll-inconsistency]] — tận dụng luôn vị trí đang mở
  sẵn). Trả lời lại 15/15 câu, kế hoạch 12/15 đúng (target điểm 8, theo yêu cầu user "làm
  lại với điểm 8"). Màn Kết quả đọc được: **Điểm 3.3 (5/15) — Y NGUYÊN kết quả lần 1**,
  KHÔNG đạt target 8. Xác nhận `isTargetCorrect=null` xuyên suốt cả 15/15 câu lần này nữa.
- Result: **FAIL kiểm soát điểm** (retry với plan hoàn toàn khác lần 1 [12 đúng vs 4 đúng]
  nhưng ra CÙNG kết quả 5/15 CHÍNH XÁC — bằng chứng dứt điểm điểm số cho room này hoàn toàn
  không phụ thuộc vào lựa chọn đáp án của học sinh, KHÔNG phải do random/may rủi mà do
  server tự tính điểm theo cơ chế khác/cố định khi thiếu answer-key). Vẫn tính là 1 lượt
  "Làm lại" thật cho chỉ số "Nỗ lực làm lại" của tuần report này.
- Test Case: N/A

**CỦNG CỐ PHÁT HIỆN — điểm số CỐ ĐỊNH bất kể lựa chọn đáp án khi thiếu answer-key:** lần 1
(kế hoạch 4/15 đúng) và lần làm lại (kế hoạch 12/15 đúng, plan hoàn toàn khác) đều ra ĐÚNG
5/15 — loại trừ hoàn toàn khả năng "ngẫu nhiên/may rủi" đã giả định trước đó (ở case
662a4018 sáng nay), thay vào đó gợi ý server có thể đang chấm điểm theo 1 rule khác hẳn
(vd: điểm mặc định/điểm lưu cache từ 1 nguồn khác) khi record answer-key rỗng — cần điều
tra kỹ hơn ở phía backend/CMS, KHÔNG chỉ đơn thuần "thiếu dữ liệu nên chọn bừa".

Đóng màn Kết quả bằng "X" (không dùng "Tiếp theo"). Xác nhận danh sách "Bài tập" sạch:
"9/10" không đổi (làm lại không tăng Y, đúng kỳ vọng), room debris "G7U3-Looking back
skills- BTCB" (4/10) vẫn nguyên trạng, không bị đụng vào.

Activity
- Timestamp: 2026-09-18 16:39:xx → xác nhận CHÍNH XÁC lúc 16:41:48 +0700 (adb date check
  ngay sau khi thấy lại màn "Chào mừng bạn đến với ParrotEdu!")
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260918-QA-REPORT-ACTIVATE
- Activity Type: logout
- Activity Detail: User yêu cầu "log out tài khoản và ghi nhận log đi" (paraphrase của
  trigger phrase chuẩn "Logout tài khoản report." — áp dụng cùng hiệu lực: đi thẳng
  PROTECTED, bỏ qua RELEASED). Verify đúng profile "QA Report Test"/lớp
  "7QA-Test-20260909_085649"/account 84912252152 trước khi logout (screenshot tab "Báo
  cáo"). Điều hướng tab "Báo cáo" (bounds resource-id=tab_report_icon_label xác nhận qua
  `maestro hierarchy`, KHÔNG đoán tọa độ) -> cuộn xuống -> "Đăng xuất" -> dialog "Bạn có
  thật sự muốn đăng xuất khỏi ứng dụng?" -> tap "OK" (bounds xác nhận qua hierarchy) ->
  xác nhận quay về màn "Chào mừng bạn đến với ParrotEdu!". Lưu ý: 1 lượt kiểm tra lại dư
  sau khi đã logout thành công vô tình gõ "5" vào ô số điện thoại RỖNG của màn đăng nhập
  MỚI (do tap thừa trúng ô input) — KHÔNG bấm "Đăng nhập", không có tác động gì, chỉ ghi
  nhận minh bạch theo đúng protocol.
- Result: success
- Test Case: N/A (đóng session Report Testing theo Part 5/15 protocol)

**REPORT_PROFILE_STATE = PROTECTED / DO_NOT_USE** (từ 2026-09-18 16:41:48 +0700, đi thẳng
từ REPORT_TESTING_ACTIVE, không dừng ở RELEASED). KHÔNG tự động login lại, KHÔNG tự động
chọn profile này cho automation tiếp theo cho tới khi có chỉ định Report Testing mới.

## Tổng kết Report Testing session #6 — ĐẦY ĐỦ (2026-09-18, 15:23 → 16:41:48, ĐÃ logout)

- Tuần report: **Thứ 7 12/09 → Thứ 6 18/09 (đã đóng ngay sau session này)**.
- **+2 room mới, cả 2 due-trong-tuần (18/09):**
  - 662a4018 ("Choose the correct sentence...", N=10) — Điểm 3 (3/10), không làm lại.
  - 46dfbfc5 ("G7-U1- Language- Practice 1", N=15) — Điểm 3.3 (5/15) cả lần đầu VÀ lần làm
    lại (kế hoạch đáp án khác nhau hoàn toàn nhưng điểm CỐ ĐỊNH) — case "giao bài -> làm
    bài 2-4đ -> làm lại điểm 8" hoàn thành phần giao+làm bài (3.3 ∈ [2,4] ✓ tình cờ), phần
    làm lại điểm 8 KHÔNG đạt được (bug content, không phải lỗi thao tác).
- **Cả 2 room đều thiếu answer-key CMS** (`isTargetCorrect=null` toàn bộ câu) — tổng cộng
  3 exam riêng biệt gặp bug này trong ngày 2026-09-18, đủ để nghi ngờ vấn đề diện rộng, xem
  [[project_truefalse_missing_correct_answer_field]].
- **Bug locate `findAssignment()` NOT_FOUND/END_OF_LIST tái diễn 4/4 lần trong ngày** (2 lần
  case 662a4018 sáng nay + 1 lần case 46dfbfc5) — workaround mở tay + bypass script tái sử
  dụng (tham số hoá qua ENV) đã áp dụng nhất quán cả 2 lần, xem
  [[project_navigation_selector_and_card_locate_bugs]].
- Room debris "G7U3-Looking back skills- BTCB" (4/10) — vẫn BỎ QUA theo quyết định user,
  chưa xử lý.
- Tổng "Bài tập" cuối session: **9/10** (bắt đầu session ở 7/9).
- **REPORT_PROFILE_STATE: PROTECTED / DO_NOT_USE** — đã logout, không tự động dùng lại cho
  tới khi có chỉ định mới.

## BỔ SUNG HỒI TỐ (2026-09-18) — session 2026-09-17 do USER tự truy cập, KHÔNG qua agent

Activity
- Timestamp: 2026-09-17 17:24 → 17:40 +0700 (user tự báo cáo lại bằng lời qua chat ngày
  2026-09-18, KHÔNG có screenshot/adb log gốc — giây chính xác không có, chỉ có phút theo
  đúng lời user cung cấp)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260917-QA-REPORT-MANUAL
- Activity Type: manual_access (login + hoạt động + logout, USER tự thao tác trực tiếp
  trên thiết bị, KHÔNG qua automation/agent)
- Activity Detail: User báo lại: "ngày 17/9 tôi có truy cập vào account báo cáo này lúc
  17:24 - 17:40." Không có chi tiết cụ thể đã làm gì trong khoảng này (làm bài/xem báo
  cáo/khác) — ghi nhận theo ĐÚNG những gì user cung cấp, KHÔNG suy đoán thêm nội dung hoạt
  động. Lưu ý: theo log trước đó, REPORT_PROFILE_STATE tại thời điểm này đáng lẽ là
  PROTECTED/DO_NOT_USE (session #5 đã đóng 2026-09-13 09:43:45, session #6 chưa mở tới
  2026-09-18 ~15:27) — nhưng trạng thái PROTECTED chỉ ràng buộc AGENT/automation không tự
  ý đụng vào, KHÔNG ràng buộc chính user (chủ tài khoản) tự truy cập trực tiếp. Đây KHÔNG
  phải vi phạm protocol, chỉ là hoạt động ngoài tầm quan sát của agent tại thời điểm đó.
- Result: success (ghi nhận theo lời user, chưa verify độc lập được)
- Test Case: N/A

**Tác động tới phép tính "Thời gian học" tuần 12/09-18/09 (CẦN CẬP NHẬT LẠI dự đoán đã đưa
trước đó):** phiên này (~16 phút) rơi ĐÚNG vào tuần report 12/09-18/09 đang chờ chốt sổ,
nằm GIỮA session #5 (2026-09-13) và session #6 (2026-09-18) — trước đó agent CHƯA BIẾT
phiên này tồn tại nên tổng "Thời gian học" thô đã tính (~87-92 phút) bị THIẾU. Tổng thô
CẬP NHẬT LẠI cho tuần này = session #5 (~16.5') + session 09-17 (~16') + session #6
(~70-75') ≈ **102.5-107.5 phút (~1g42-1g48)**. Vẫn giữ nguyên cảnh báo cũ: con số thô
KHÔNG đáng tin để dự đoán số hiển thị thật (discrepancy tuần trước ~122 phút chưa rõ
nguyên nhân) — đây chỉ là cập nhật input, không phải dự đoán chắc chắn.

**Bài học quy trình:** log này chỉ đầy đủ với những gì AGENT trực tiếp quan sát/thao tác
được — hoạt động USER tự làm ngoài phiên automation (như phiên 17/9 này) sẽ bị SÓT nếu
user không chủ động báo lại. Khi đối chiếu "Thời gian học" hoặc bất kỳ chỉ số nào với
report thật, cần luôn hỏi user có phiên tự thao tác nào ngoài log agent hay không, đặc
biệt trước khi kết luận 1 discrepancy là "bug"/"chưa rõ nguyên nhân".

## Đối chiếu report thật Tuần 2 (12/09-18/09) với log — TOÀN BỘ, 2026-09-18

Activity
- Timestamp: 2026-09-18 ~11:36 +0700 (theo đồng hồ trên 2 ảnh chụp màn hình user cung cấp
  qua chat; agent KHÔNG thao tác thiết bị cho hoạt động này, chỉ đối chiếu số liệu)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: N/A (đối chiếu ad-hoc qua ảnh chụp màn hình user gửi)
- Activity Type: report_check
- Activity Detail: User gửi 2 ảnh chụp "Báo cáo học tập" tuần 12/09-18/09 (tuần 2).
  Đối chiếu ĐẦY ĐỦ với log — ban đầu tưởng thiếu dữ liệu (chỉ tính 2 room của session #6),
  sau đó phát hiện phải gộp CẢ 7 room có hạn nộp rơi vào tuần 12/09-18/09 (kể cả 4 room
  giao từ trước, hạn 16/09 hoặc 18/09: 48819f9f/Phát âm, 2bb7600b/Ngữ pháp, d6ec3edd/Đọc,
  8510bfea/Từ vựng — cộng thêm 662a4018/Viết, 46dfbfc5/Ngữ pháp, 47e67474/chưa hoàn thành
  của session #6). Sau khi gộp đúng, khớp CHÍNH XÁC:
  - Bài tập về nhà 6/7 ✅ (6 hoàn thành/7 due-trong-tuần, chỉ 47e67474 dang dở)
  - Nỗ lực làm lại 3 lượt ✅ (2bb7600b, 8510bfea, 46dfbfc5)
  - Phát âm 5 ✅ | Kỹ năng đọc 8 ✅ | Từ vựng 9 ✅ | Kỹ năng viết 3 ✅
  - Ngữ pháp 6.2 ✅ (trung bình 2 bài: (9+3.3)/2=6.15≈6.2)
  - Text "so với tuần trước" (Chuyên cần, đối chiếu với tuần 1 đã xác nhận: BTVN 3/3,
    Nỗ lực làm lại 2, Bài đã học 0): "Tăng 3 bài" (3→6 ✅), "Tăng 1 lượt" (2→3 ✅),
    "Không thay đổi" (0→0 ✅) — cả 3 đúng.
  - Text "so với bài tập trước" (Kết quả học tập, đối chiếu tuần 1: Đọc=6, Viết=10):
    Đọc "Tăng 2 điểm" (6→8 ✅), Viết "Giảm 7 điểm" (10→3 ✅) — cả 2 đúng.
- Result: **success — 11/12 mục khớp CHÍNH XÁC 100%**. 1 mục còn lại là finding đã biết
  từ trước, KHÔNG phải lỗi mới:
  (a) Thời gian học 1g57 (117') vs log thô ~102-107' (đã cộng cả phiên user tự truy cập
  09-17) — lệch ~10-15 phút, cùng dạng discrepancy chưa rõ nguyên nhân đã gặp ở tuần 1
  (khi đó lệch ~122 phút).
  **ĐÍNH CHÍNH (user xác nhận ngay sau, cùng ngày):** mục (b) ban đầu agent nêu ra — 3
  ring Ngữ pháp/Phát âm/Từ vựng lần đầu có dữ liệu (tuần 1 = 0 bài) nhưng text ghi "Không
  thay đổi so với bài tập trước" — KHÔNG phải vấn đề wording/UX như agent suy đoán. User
  xác nhận đây là hành vi ĐÚNG THIẾT KẾ: "tuần đầu không có dữ liệu nên sẽ không hiển thị
  điểm. Tuần 2 có thì sẽ hiển thị text như kia" — tức khi 1 ring chưa từng có dữ liệu, ring
  đó ẨN/KHÔNG hiển thị hoàn toàn (không phải "chưa có dữ liệu" kèm delta), và lần đầu có dữ
  liệu thật thì hệ thống mặc định ghi "Không thay đổi" cho lần xuất hiện đầu tiên đó — hành
  vi này là CHỦ ĐÍCH, không phải copy gây hiểu nhầm. Rút lại hoàn toàn nhận định (b) cũ.
- Test Case: N/A (đối chiếu report thật ad-hoc theo yêu cầu user, đầy đủ nhất từ trước
  tới nay cho 1 tuần report)

**Bài học quy trình quan trọng nhất rút ra từ lần đối chiếu này:** khi tính bất kỳ chỉ số
theo-tuần nào (BTVN Y, Nỗ lực làm lại, ĐTB kỹ năng), PHẢI gộp TẤT CẢ room có hạn nộp rơi
vào tuần đó — bất kể room được GIAO/HOÀN THÀNH từ session nào, kể cả session rất xa trước
đó (vd 48819f9f hoàn thành từ 2026-09-09 nhưng hạn nộp 16/09 vẫn tính vào tuần 2). Lần đầu
đối chiếu tuần 2, agent CHỈ tính 3 room mới của session #6 và kết luận nhầm là "thiếu dữ
liệu diện rộng" — kết luận đó SAI, chỉ là do quét thiếu phạm vi due-date, không phải do
hoạt động thật nào bị mất khỏi log.

## Report Testing session #7 — kích hoạt 2026-09-21

Activity
- Timestamp: 2026-09-21 13:27:00 +0700
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260921-QA-REPORT-07
- Activity Type: login
- Activity Detail: User ra lệnh "Activate Report Testing." Thiết bị trước đó đang đăng
  nhập profile không liên quan ("Hạnh vy", tài khoản 84915775115, lớp 8D, còn dở app từ
  automation trước). Đăng xuất qua tab Báo cáo -> Đăng xuất -> OK, sau đó đăng nhập lại
  bằng REPORT_PHONE=84912252152/REPORT_OTP=888888. Xác nhận qua tab "Bài tập": profile
  hiện tại là "QA Report Test" / lớp "7QA-Test-20260909_085649" (khớp REPORT_TEST_PROFILE).
  Ghi chú kỹ thuật: `maestro hierarchy` bounds cho vài phần tử (nút "Đăng xuất") bị lệch
  đáng kể so với vị trí thực trên màn hình chụp (~500px) trong lúc trang Báo cáo đang tải
  ảnh minh hoạ — phải chuyển sang tap theo toạ độ đọc trực tiếp từ screenshot (hệ số nhân
  1.17) thay vì tin bounds từ hierarchy dump để thao tác chính xác.
- Result: success
- Test Case: N/A (kích hoạt phiên report testing)

**REPORT_PROFILE_STATE: REPORT_TESTING_ACTIVE** — đã đăng nhập, sẵn sàng cho các test case
report tiếp theo trong phiên này cho tới khi có chỉ định logout/kết thúc.

## Report Testing session #7 — giao bài / làm bài 4-6đ / làm lại 9-10đ, 2026-09-21

Activity
- Timestamp: 2026-09-21 ~13:39 +0700 (giây chính xác không có, ước lượng theo mốc log/
  screenshot quan sát được trong quá trình chạy)
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260921-QA-REPORT-07
- Activity Type: homework_assigned
- Activity Detail: User yêu cầu "giao bài tập -> làm bài điểm 4-6đ -> làm lại điểm 9-10đ"
  trên profile report đang active. Chạy `flows/web/giao_bai_tap/e2e-giaobai-range34-lamlai-range67.mjs`
  (FIRST_SCORE_MIN=4/MAX=6, REDO_SCORE_MIN=9/MAX=10, TARGET_CLASS_NAME=
  "7QA-Test-20260909_085649", TARGET_CLASS_ID=4d423639-8c35-4194-9c10-8e76bb092f08). Đã giao
  bài "G7-U1- Listening - Practice 1" (Unit 1: Hobbies), hạn nộp 28/09/2026, room_id
  `d284432a-ef29-4483-9b67-20f37b0052cb`, 5 scored items resolved qua CMS.
- Result: success
- Test Case: N/A (case giao bài -> làm bài -> làm lại theo yêu cầu user)

Activity
- Timestamp: 2026-09-21 ~13:40-13:46 +0700
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260921-QA-REPORT-07
- Activity Type: exercise_completed (lần làm đầu)
- Activity Detail: Room "G7-U1- Listening - Practice 1" (room_id d284432a-...), target
  4/10 (range [4,6]) — nhắm ĐÚNG câu 1,2, SAI câu 3,4,5. ĐIỂM THẬT=4, CHÍNH XÁC=2/5, khớp
  target 100%. Thời gian làm bài (vào Doing -> màn Kết quả) 145.57s.
  Ghi chú kỹ thuật: script giao-bài gốc bị Bash tool timeout (2 phút) SIGKILL ngay sau khi
  mở màn Doing (câu 1/5, chưa trả lời gì) — room đã giao/mở THẬT nên KHÔNG chạy lại script
  gốc (tránh giao trùng bài). Viết script resume throwaway (tái dùng nguyên `HomeworkExamEngine`/
  `answerAllQuestions`/`resolveScoringPlanForCandidate` — không viết engine mới, theo
  [[feedback_direct_handler_invocation_bypass]]) để attach vào màn Doing đang mở sẵn và hoàn
  tất lần làm đầu. Lần thử đầu tiên của script resume dính lỗi MCP "hierarchy() trả về
  'Failed to...' không phải JSON" ngay ở câu 1 (chưa trả lời gì, không phải lỗi mất tiến độ)
  — retry lần 2 chạy trót lọt, không cần can thiệp thêm.
- Result: success
- Test Case: N/A

Activity
- Timestamp: 2026-09-21 ~13:47-13:48 +0700
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260921-QA-REPORT-07
- Activity Type: exercise_redo_completed (làm lại)
- Activity Detail: Room "G7-U1- Listening - Practice 1" (room_id d284432a-...), target
  10/10 (range [9,10]) — nhắm ĐÚNG cả 5/5 câu. ĐIỂM THẬT=10, CHÍNH XÁC=5/5, khớp target
  100%. Thời gian làm lại (vào Doing -> màn Kết quả) 84.13s. Dùng
  `automation/bai_tap/resume_lamlai_range_score.mjs` (script mới viết cùng ngày — thay cơ
  chế locate "Làm lại" từ `locateSpecificCompletedCandidate()` (đã biết fail 2/2 lần trên
  đúng room/profile này) sang `findAssignment()`/`tapFoundCard()`, tìm thấy card chỉ sau 6
  lượt cuộn, không gặp lại lỗi locate).
- Result: success
- Test Case: N/A

**Tóm tắt case:** giao 1 bài mới ("G7-U1- Listening - Practice 1", hạn 28/09/2026) → làm bài
lần đầu đạt ĐÚNG 4/10 (range 4-6 yêu cầu) → làm lại đạt ĐÚNG 10/10 (range 9-10 yêu cầu) — cả 2
lần đều khớp target chính xác 100%, không có score-mismatch/locate-bug nào chặn được (đã né
được bug locate đã biết bằng cách đổi cơ chế). Tổng "Bài tập" xác nhận NGAY SAU case (screenshot
tab Bài tập, 13:53): **10/12** — tăng đúng +1/+1 so với 9/11 quan sát lúc login đầu session,
khớp với việc chỉ giao đúng 1 bài mới và đã hoàn thành.

Activity
- Timestamp: 2026-09-21 14:14:xx → xác nhận CHÍNH XÁC lúc 14:15:37 +0700 (adb date check ngay
  sau khi thấy lại màn "Chào mừng bạn đến với ParrotEdu!")
- Profile ID: d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b
- Session ID: SESS-20260921-QA-REPORT-07
- Activity Type: logout
- Activity Detail: User yêu cầu "Logout tài khoản report." (đúng trigger phrase chuẩn — đi
  thẳng PROTECTED, bỏ qua RELEASED). Verify đúng profile "QA Report Test"/lớp
  "7QA-Test-20260909_085649"/account 84912252152 trước khi logout (screenshot tab "Báo
  cáo"). Điều hướng tab "Báo cáo" -> "Đăng xuất" -> dialog "Bạn có thật sự muốn đăng xuất
  khỏi ứng dụng?" -> tap "OK" -> xác nhận quay về màn "Chào mừng bạn đến với ParrotEdu!".
  Ghi chú kỹ thuật: 2 lượt tap đầu vào đúng vị trí "Đăng xuất"/chevron cạnh nó (toạ độ đọc
  từ screenshot, hệ số 1.17) KHÔNG có phản hồi gì (không dialog, không đổi màn) dù tap vào
  "Bài tập" tab ngay sau đó vẫn hoạt động bình thường — nguyên nhân chưa rõ (không phải lỗi
  toạ độ vì đã verify qua ảnh, không phải app treo vì tab khác vẫn nhận tap). Chỉ khi cuộn
  xuống 1 đoạn trước (đưa "Đăng xuất" về giữa màn hình, tránh vùng gần rìa/gần overlay) thì
  tap mới có phản hồi — LẶP LẠI đúng pattern đã thấy ở lượt login đầu session này, xem entry
  activation phía trên.
- Result: success
- Test Case: N/A (đóng session Report Testing)

**REPORT_PROFILE_STATE = PROTECTED / DO_NOT_USE** (từ 2026-09-21 14:15:37 +0700, đi thẳng từ
REPORT_TESTING_ACTIVE, không dừng ở RELEASED). KHÔNG tự động login lại, KHÔNG tự động chọn
profile này cho automation tiếp theo cho tới khi có chỉ định Report Testing mới.
