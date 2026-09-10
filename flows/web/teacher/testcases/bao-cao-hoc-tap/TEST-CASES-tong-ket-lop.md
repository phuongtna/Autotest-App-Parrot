# Testcase — "Báo cáo học tập" (Web GV) > Tab "Tổng kết lớp" > Học kỳ I

Nguồn yêu cầu: `Case báo cáo.docx` (người dùng cung cấp qua Google Drive, mục **2.2. Báo cáo Tổng
kết lớp**, màn "Màn tổng kết học kỳ") — toàn văn control 1-7 + acceptance criteria đã trích ở cuối
file này (mục "Nguyên văn yêu cầu"). **Phạm vi file này CHỈ gồm case đối chiếu dữ liệu cho tab
"Tổng kết lớp" / "Học kỳ I"** (theo đúng lựa chọn ưu tiên của user, 2026-09-10) — 3 phần còn lại
của docx (tab "Bài tập về nhà", "Màn tổng kết năm học", "Màn import điểm") **CHƯA làm**, để case
riêng sau.

## Bối cảnh cadence (quan trọng nhất, do user nêu trước khi giao việc)

> Báo cáo sẽ chạy cập nhật lại theo ngày ... Bên giáo viên báo cáo sẽ luôn chạy cập nhật mỗi ngày.
> còn học sinh sẽ cập nhật mỗi tuần, tháng, kỳ...

Nghĩa là: **báo cáo Web GV (tab Tổng kết lớp) chạy theo 1 batch/ngày** (không realtime theo từng
hành động), khác với báo cáo App HS (`flows/app/report/`, đã biết cadence tuần/tháng/kỳ qua
RP-05/RP-08). Mọi case đối chiếu dưới đây **phải tính đến độ trễ batch này** — hành động làm THẬT
hôm nay (ngày N) có thể chỉ phản ánh đúng vào báo cáo từ ngày N+1 trở đi, KHÔNG phải ngay lập tức.

⚠️ **SỬA LẠI 2026-09-10 (bản trước KẾT LUẬN SAI, đã tự sửa sau khi kiểm tra kỹ hạn nộp từng room —
xem thêm 2 quy tắc chính thức user bổ sung trực tiếp vào `historical_activity_log.md` dòng 578-594):**

Bản ghi trước của mục này từng kết luận "CONFIRMED BUG, cần báo dev" chỉ dựa trên việc `0/0` không
đổi sau >20h — **kết luận đó THIẾU BƯỚC KIỂM TRA HẠN NỘP của từng room, dẫn tới sai**. Kiểm tra lại
đầy đủ: **CẢ 6 room thật của profile này (4 từ 09-09 + 2 từ 09-10) đều có hạn nộp 11/09/2026 (Thứ
Sáu) hoặc 16/09/2026 — nghĩa là TẤT CẢ đều CHƯA TỚI hạn nộp** (hôm nay kiểm tra là 09-10, Thứ Năm).
Kết hợp với 2 quy tắc user đã xác nhận và ghi vào log:

1. **"Báo cáo chỗ Bài tập về nhà sẽ hiển thị từ NGÀY HÔM SAU hạn nộp trở đi"** — không phải ngay
   khi hạn nộp còn hiệu lực. 3 room hạn 11/09 (Thứ Sáu) sẽ KHÔNG lên số nếu kiểm tra TRƯỚC 12/09
   (Thứ Bảy — trùng mốc report tuần chạy 00:00 Thứ Bảy, xem `project_weekly_report_btvn_duedate_rule`).
2. **Quy tắc CHUNG (áp dụng mọi số liệu report, không riêng BTVN)**: "trên web chỉ cho xem báo cáo
   của ngày hôm trước, ngày hôm nay sẽ cộng dồn và cập nhật vào báo cáo của ngày tiếp theo" — kiểm
   tra report vào ngày X chỉ thấy dữ liệu tính tới HẾT ngày X-1.

**Kết luận ĐÚNG (thay thế bản trước):** `0/0` ở "Bài tập cô giao" và empty-state "chưa có bài tập
nào được giao" ở tab "Bài tập về nhà" **là HÀNH VI ĐÚNG DỰ KIẾN tại thời điểm 09-10**, KHÔNG phải
bằng chứng bug backend — vì chưa có room nào qua khỏi hạn nộp. **CHƯA THỂ kết luận khớp hay không
khớp cho tới khi kiểm tra lại từ 12/09/2026 trở đi** (ngày sau hạn nộp 11/09 + đúng chu kỳ báo cáo
tuần Thứ Bảy). Xem TK-08 đã sửa lại tương ứng — bài học rút ra: **luôn kiểm tra hạn nộp/ranh giới
ngày trước khi kết luận "báo cáo sai", đừng chỉ nhìn con số hiện tại**.

## Tài khoản / dữ liệu dùng để test

- Web GV: `TEACHER_USERNAME=0912312312` ("Phương") — tài khoản DUY NHẤT cấu hình trong `.env`,
  **quản lý cả 3 lớp** `3B` / `7QA-Test-20260909_085649` / `8D` (đã xác nhận thật qua
  `GET /api/classes/teacher`, cùng `teacher_id=a7436d6f-4e2d-41ba-8d4a-e7ce8155a412`).
- **Dùng đúng lớp `7QA-Test-20260909_085649`** (id `4d423639-8c35-4194-9c10-8e76bb092f08`) — lớp
  này chỉ có **1 học sinh**: profile "QA Report Test", đúng profile đang được ghi log thật ở
  `test_data/historical_activity_log.md` (protocol `REPORT_TEST_PROFILE`, xem
  `project_report_test_account_migration` trong memory). Dùng lớp này để đối chiếu 1-1 với log,
  tránh nhiễu từ HS khác.
- ⚠️ **Lưu ý ID KHÁC NHAU cho cùng 1 học sinh** (đã quan sát thật, chưa rõ nguyên nhân — không kết
  luận là bug): `historical_activity_log.md` ghi Profile ID app-side =
  `d79076ca-5ef8-4c7e-9dad-25c1c8df9a9b`; API `GET /api/scores` (Web GV) trả về
  `profile_id = c7d237db-9d73-4f6e-a4b5-1fae42cbe6fa` cho cùng `full_name = "QA Report Test"` trong
  lớp trên. Nhiều khả năng là 2 bảng khác nhau (student-record ID của Web GV vs profile ID app) —
  **đối chiếu tạm thời theo `full_name` cho tới khi xác nhận được mapping thật**, các case dưới ghi
  rõ chỗ này.
- ⚠️ **Môi trường**: `.env` hiện có `TEACHER_PORTAL_ENV=production` (không phải staging — khác với
  ghi nhận cũ trong memory `project_test_environment_target`, có thể đã đổi lại sau lần ghi đó).
  Toàn bộ số liệu/API response trích trong file này là **dữ liệu PRODUCTION THẬT**, không phải
  giả lập — cẩn trọng khi viết script tự động chạy lặp lại (không tạo thêm lớp/HS thật ngoài kế
  hoạch, xem `feedback_verify_teacher_portal_env_before_writes`).

## Công cụ khảo sát (read-only, không sửa dữ liệu)

`automation/giao_bai_tap/reportClassSummaryDiscovery.mjs` (script MỚI, viết cùng lúc với file
này, mô phỏng đúng kiến trúc `reportDiscovery.mjs` đã có cho tab "Bài tập về nhà") — login Web GV
thật, mở "Báo cáo học tập" > đổi lớp (qua `TARGET_CLASS_TEXT` env, mặc định giữ nguyên lớp đầu) >
tab "Tổng kết lớp" > dump text/screenshot/bảng HTML/toàn bộ network `/api/*` ra
`automation/output/data_discovery/REPORT_CLASS_SUMMARY/` (dùng `process.cwd()` giống
`reportDiscovery.mjs` — **phải chạy với cwd = `automation/`**, xem lệnh dưới). Chạy lại:
`cd automation && TARGET_CLASS_TEXT="7QA-Test" node giao_bai_tap/reportClassSummaryDiscovery.mjs`
(thêm `ASSIGN_HEADLESS=false` để xem browser thật).

## Bằng chứng khảo sát thật (2026-09-10, lớp `7QA-Test-20260909_085649`)

Ảnh chụp: `automation/output/data_discovery/REPORT_CLASS_SUMMARY/03_class_summary_tab.png`. 3 API request
chính đứng sau tab này (bắt qua network log thật, KHÔNG suy đoán):

1. `GET /api/scores?academicYearId=<id>&classId=<id>&schoolId=<id>&semester={1|2}` → trả
   `data.classAvg.bt2Avg` (số dùng cho card "Điểm TB bài tập" cấp lớp) +
   `data.industryStats[]` (mỗi phần tử: `profile_id, full_name, complete_assignments,
   teacher_assignments, self_learn_lessons, study_time` — nguồn của BẢNG "Chuyên cần").
2. `GET /api/classes/:classId/students` — roster (tên, `student_id`, `birth_year`...).
3. `GET /api/user/report-stats/rooms-by-class?class_id=<id>` — danh sách room/exercise của lớp
   kèm `total_students`/`completed_students` (chưa xác định rõ dùng cho control nào trên UI, có
   thể phục vụ 1 view khác — ghi nhận để điều tra thêm, KHÔNG chặn các case dưới).

Số liệu THẬT quan sát được lúc khảo sát (~2026-09-10, sau khi 2 room đã được giao+làm thật trong
cùng ngày theo `historical_activity_log.md`):

| Nguồn | Giá trị thật |
|---|---|
| 3 card tổng quát (Điểm TB cuối kỳ / giữa kỳ / bài tập) | `-` / `-` / `-` (chưa có `Nhập điểm`; `classAvg.bt2Avg = 0`) |
| Bảng "Kết quả học tập" (Điểm 15'x4, giữa kỳ, cuối kỳ, Điểm TB) | toàn bộ `-` cho "QA Report Test" |
| Bảng "Chuyên cần" — Bài tập cô giao | `0 / 0` (KHÔNG phải `2/2` hay tương tự dù đã giao+làm 2 room thật hôm nay — xem cadence ở trên) |
| Bảng "Chuyên cần" — Bài tự học | `0` |
| Bảng "Chuyên cần" — Thời gian học | `3 giờ` (API: `study_time = 9149` giây → 9149/3600 = 2.54h → **làm tròn LÊN = 3** — khớp đúng công thức docx, VÀ có vẻ cập nhật NHANH hơn số liệu bài tập, xem TK-09) |
| `GET rooms-by-class?class_id=<lớp 7QA-Test>` | `{"data": [], "total": 0}` — rỗng, xác nhận thêm cadence trễ |
| Droplist "Học kỳ" | đúng 3 option "Học kỳ I" (đang chọn, khớp lời user) / "Học kỳ II" / "Cả năm" |
| Cột bảng "Kết quả học tập" thật (đọc DOM, không phải chỉ nhìn ảnh) | **9 cột**, gồm cả `XẾP HẠNG` — cột này bị cắt khỏi khung nhìn màn hình chuẩn (cần cuộn ngang mới thấy, xem TK-05) |

Đối chiếu chéo với lớp `3B` (6 học sinh, khảo sát cùng lượt để có mẫu nhiều dòng hơn,
`output/.../REPORT_CLASS_SUMMARY` bản trước khi đổi `TARGET_CLASS_TEXT`): thứ tự hiển thị bảng
"Kết quả học tập" khi CHƯA có điểm là **Hang, Gia Linh, Ngoc, Nguyệt, Minh Thien, Hanh vy** — đây
**KHÔNG phải thứ tự alphabet** (alphabet đúng phải là Gia Linh, Hang, Hanh vy, Minh Thien, Ngoc,
Nguyệt) dù docx nói rõ "Trong TH chưa có đầu điểm, sẽ hiển thị danh sách theo thứ tự bảng chữ cái
của tên" — xem TK-07 (chưa kết luận là bug, cần xác nhận thêm — có thể sort theo tiêu chí khác vd
thứ tự tham gia lớp).

---

## Bảng test case

| ID | Tên case | Điều kiện/dữ liệu | Bước thực hiện | Kỳ vọng PASS | Coi là FAIL khi | Ưu tiên | Nguồn đối chiếu |
|----|----------|--------------------|-----------------|--------------|-----------------|---------|-----------------|
| TK-01 | Default đúng "Học kỳ I" + đủ 3 option | Lớp bất kỳ, lần đầu vào tab "Tổng kết lớp" trong phiên | Vào tab "Tổng kết lớp", đọc droplist "Học kỳ" (không bấm) | Droplist hiển thị "Học kỳ I" (đã chọn); mở ra thấy đúng 3 option "Học kỳ I"/"Học kỳ II"/"Cả năm" | Default khác "Học kỳ I" khi Kỳ II chưa có dữ liệu điểm; thiếu/thừa option | Cao | **ĐÃ XÁC NHẬN THẬT** khớp 100% (ảnh `05_semester_dropdown_open.png`) |
| TK-02 | Card "Điểm TB bài tập" đối chiếu công thức X/Y khi CÓ điểm bài tập đã nộp trong kỳ | ≥1 học sinh của lớp test có ≥1 bài tập ĐÃ NỘP với hạn nộp rơi trong Học kỳ I (5/9-15/1) | Ghi lại toàn bộ điểm bài tập thật đã nộp trong kỳ (đối chiếu qua `historical_activity_log.md` hoặc API), tự tính X=ΣN1..Nn (N_i = tổng điểm bài đã nộp của HS i / số bài đã nộp, làm tròn 1 chữ số thập phân), Y=sĩ số lớp -> so với số hiển thị trên card | Card hiển thị đúng `X/Y` (làm tròn 1 chữ số thập phân) khớp số tự tính | Lệch số; card hiển thị `-` dù đã có ≥1 bài nộp hợp lệ trong kỳ (sau khi batch ngày đã chạy) | Cao | Công thức docx control 2 + `historical_activity_log.md` |
| TK-03 | Card hiển thị `-` khi CHƯA có dữ liệu điểm/bài nộp nào trong kỳ | Lớp/kỳ chưa có bài tập nộp nào tính vào kỳ đang chọn (đúng trạng thái thật của `7QA-Test-...` tại thời điểm khảo sát) | Mở tab "Tổng kết lớp", quan sát 3 card | Cả 3 card hiển thị `-` (không hiển thị `0`/`0.0`/NaN/crash) | Hiển thị `0` hoặc `NaN` thay vì `-`; hoặc ngược lại ẩn hẳn card | Trung bình | **ĐÃ XÁC NHẬN THẬT** (03_class_summary_tab.png, lớp 7QA-Test) |
| TK-04 | So sánh Kỳ II vs Kỳ I chỉ hiện khi có chênh lệch | Cần có dữ liệu điểm ở CẢ Kỳ I và Kỳ II để so sánh — hiện KHÔNG áp dụng được (đang ở Kỳ I, Kỳ II chưa có điểm) | (chưa chạy được) | Không hiển thị badge tăng/giảm khi đang ở Kỳ I (theo docx "Trong TH ở Kỳ I thì không có sự so sánh") | Hiện badge so sánh sai khi đang ở Kỳ I | Thấp | ⚠️ BLOCKED — chờ có dữ liệu Kỳ II, để case sau |
| TK-05 | Cột "XẾP HẠNG" tồn tại trong bảng "Kết quả học tập" nhưng bị cắt khỏi viewport chuẩn | Bảng có ≥1 dòng học sinh | Đọc DOM đầy đủ bảng (không chỉ xem screenshot) HOẶC cuộn ngang bảng tới cùng | Cột `XẾP HẠNG` tồn tại, đúng vị trí cuối cùng, có giá trị (hoặc `-` khi chưa có điểm) | Cột không tồn tại trong DOM (không phải do bị cắt UI); giá trị sai lệch khi cuộn tới | Trung bình | **ĐÃ XÁC NHẬN THẬT** (`04_class_summary_tables.json`, 9 cột kể cả `XẾP HẠNG`) — ghi chú riêng cho automation sau này: đừng dùng screenshot để đếm cột, phải đọc DOM |
| TK-06 | Điểm TB (control 5) đối chiếu công thức hệ số 1/2/3 khi đã "Nhập điểm" | Đã nhập ≥1 đầu điểm (15', giữa kỳ, hoặc cuối kỳ) qua chức năng "Nhập điểm" cho ≥1 học sinh | Nhập điểm thật (ví dụ 1 cột "Điểm 15'(1)" + "Thi giữa kỳ"), tự tính `Điểm TB = Σ(điểm × hệ số đã nhập) / Σ hệ số đã nhập` (15'=1, giữa kỳ=2, cuối kỳ=3) | Cột "Điểm TB" khớp đúng công thức, có màu đúng theo khoảng (Dưới 5/5-6,9/7-8,9/9-10 — màu cụ thể chưa xác nhận, đối chiếu bằng mắt) | Sai số học; sai màu theo khoảng điểm | Cao | ⚠️ BLOCKED — phụ thuộc luồng "Nhập điểm" (thuộc "Màn import điểm", CHƯA làm ở phase này) — để case sau khi làm phase Import điểm |
| TK-07 | Thứ tự bảng khi CHƯA có đầu điểm nào — kiểm tra có đúng alphabet như docx mô tả không | Lớp có ≥2 học sinh, chưa nhập điểm nào (dùng lớp `3B`, 6 HS, thay vì `7QA-Test` chỉ có 1 HS) | Mở tab "Tổng kết lớp" lớp 3B, đọc thứ tự cột "TÊN HỌC SINH" | Thứ tự = alphabet tên (Gia Linh, Hang, Hanh vy, Minh Thien, Ngoc, Nguyệt) | Thứ tự KHÁC alphabet | ⚠️ **ĐÃ QUAN SÁT THẬT: FAIL theo mô tả docx** — thứ tự thật là "Hang, Gia Linh, Ngoc, Nguyệt, Minh Thien, Hanh vy" (không phải alphabet) — cần chạy lại case này 1 cách độc lập (không chỉ tin ảnh chụp 1 lần) + hỏi dev xem đây là bug hay tiêu chí sort khác (vd thứ tự tham gia lớp) trước khi kết luận | Cao | `02_default_tab_tables.json` (bản khảo sát lớp 3B, xem note "Đối chiếu chéo" ở trên) |
| TK-08 | **Case CHÍNH của cadence "cập nhật theo ngày"** — "Bài tập cô giao" (x/y) phản ánh đúng hành động giao+làm bài thật, có độ trễ 1 batch/ngày | Đã có ≥1 room được **giao** (Web GV) + **hoàn thành** (App HS) trong lớp test, hạn nộp rơi trong Học kỳ I. Ngày thực hiện = N (log lại chính xác timestamp) | 1. Ngày N: giao bài + làm bài xong qua App HS (tái sử dụng flow `flows/web/giao_bai_tap/`), ghi vào `historical_activity_log.md` như thường lệ.<br>2. Ngày N (ngay sau khi làm xong): mở tab Tổng kết lớp, đọc "Bài tập cô giao" — kỳ vọng **CHƯA** cập nhật (x/y vẫn như trước khi giao).<br>3. Ngày N+1 (hoặc sau khi xác định được mốc batch chạy — cần dò thêm): mở lại, đọc "Bài tập cô giao" | Ngày N: số liệu KHÔNG đổi ngay (giữ nguyên baseline trước khi giao) — xác nhận cadence trễ. Ngày N+1: `y` tăng đúng số room có hạn nộp trong kỳ vừa giao thêm; `x` tăng đúng số room đã hoàn thành | Ngày N đã đổi ngay (real-time, không đúng "chạy theo ngày" như user mô tả — cần báo lại vì khác kỳ vọng); HOẶC ngày N+1 vẫn KHÔNG đổi (báo cáo không bao giờ cập nhật, đây mới là lỗi thật) | Cao | ⚠️ **SỬA LẠI 2026-09-10 (bản trước "FAIL/báo dev" là KẾT LUẬN SAI — đã tự sửa)**: bản trước quên kiểm tra hạn nộp từng room trước khi kết luận bug. Kiểm tra lại: **cả 6 room thật (4 từ 09-09 + 2 từ 09-10) đều hạn nộp 11/09/2026 (Thứ Sáu) hoặc 16/09/2026 — nghĩa là CHƯA room nào tới hạn nộp** tính đến thời điểm kiểm tra (09-10, Thứ Năm). User đã xác nhận + ghi vào `historical_activity_log.md` (dòng 578-594) 2 quy tắc: (1) dòng "Bài tập về nhà" chỉ hiển thị từ **ngày hôm sau hạn nộp** trở đi — 3 room hạn 11/09 sẽ không lên số nếu kiểm tra trước 12/09 (Thứ Bảy, trùng mốc report tuần); (2) quy tắc CHUNG cho MỌI số liệu report: xem vào ngày X chỉ thấy dữ liệu tính tới hết ngày X-1, hoạt động ngày X chỉ lên báo cáo khi xem từ ngày X+1. Do đó `0/0` + empty-state "chưa có bài tập nào được giao" tại 09-10 **là kỳ vọng ĐÚNG**, không phải bug. **Case này CHƯA ĐÓNG được** — phải kiểm tra lại đúng từ **2026-09-12** (ngày sau hạn nộp 11/09 + đúng chu kỳ báo cáo tuần) mới biết khớp hay không |
| TK-09 | "Thời gian học" — kiểm tra cadence RIÊNG (nghi vấn cập nhật nhanh hơn "Bài tập cô giao" cùng bảng Chuyên cần) | Có phiên đăng nhập/học App HS thật trong ngày N (không cần hoàn thành bài tập, chỉ cần thời gian online) | Ngày N: đối chiếu tổng thời gian đăng nhập app thật (từ log/timestamp) với số "Thời gian học" hiển thị NGAY TRONG NGÀY (không đợi N+1) | Số giờ hiển thị NGAY trong ngày N đã phản ánh đúng `ceil(tổng giây đăng nhập / 3600)` | Thời gian học cũng bị trễ 1 ngày giống "Bài tập cô giao" (nếu vậy TK-09 trùng TK-08, cần gộp lại) | Cao | ⚠️ **SỬA LẠI 2026-09-10 lần 2 (đối chiếu giây-chính-xác, không còn coi là "gần khớp")**: "Thời gian học" chịu quy tắc trễ 1 ngày CHUNG, **KHÔNG** bị chặn thêm bởi quy tắc "ngày hôm sau hạn nộp" (quy tắc đó CHỈ áp dụng riêng cho dòng BTVN theo đúng câu user ghi trong log) — nghĩa là **TK-09 verify được sớm hơn TK-08 1 ngày, từ 2026-09-11**, không cần đợi 09-12. Dựng lại chính xác tổng thời gian 09-09 từ mốc log (Session#1 phần A 09:42-10:11=29p + phần B ~10:15:30-10:41:40=26.2p [đã trừ khoảng chuyển profile không log mốc quay lại] + Session#2 13:47:59-15:41:08=113.15p chính xác) = **~168.3 phút (10099s)** — khớp sát ghi chú "~169 phút" có sẵn. So với API thật `study_time=9149s` (152.5 phút): **THIẾU ~15.8 phút (~9.4%)**, một khoảng KHÔNG nhỏ dù cả 2 số đều làm tròn ra cùng "3 giờ" trên UI (che mất chênh lệch nếu chỉ nhìn UI). CHƯA kết luận là bug (số dựng lại vẫn dựa 1 phần vào mốc "~" ước lượng, đặc biệt đoạn quay lại profile không có timestamp thật) — cần verify lại từ 09-11 khi có thêm 1 điểm dữ liệu SẠCH (session 09-10: login 13:15:18 - logout 14:56:11 = chính xác 100 phút 53 giây = 6053s, không có gap chuyển profile) để so khớp phép cộng dồn |
| TK-10 | Phân trang bảng 10 học sinh/trang | Lớp có **>10 học sinh** | (chưa chạy được — cả 3 lớp hiện có của tài khoản test đều <10 HS: 3B=6, 7QA-Test=1, 8D=2) | Trang 1 hiển thị đúng 10 dòng, có điều khiển chuyển trang, tổng số đúng | Hiển thị sai số dòng/trang; lỗi phân trang | Thấp | ⚠️ BLOCKED — thiếu dữ liệu (cần lớp ≥11 HS, hiện không có) |
| TK-11 | Empty state khi lớp chưa có học sinh nào | Lớp mới tạo, 0 học sinh | Mở tab "Tổng kết lớp" của lớp 0 HS | Hiển thị màn dữ liệu trống theo design (không lỗi/trắng màn) — theo AC docx "Trong TH chưa có dữ liệu -> Hiển thị theo design" | Trắng màn; lỗi console; bảng hiện dòng rỗng thay vì empty-state rõ ràng | Trung bình | Chưa chạy — cần tạo 1 lớp test mới 0 HS (side-effect ghi dữ liệu thật, cân nhắc trước khi chạy trên production) |
| TK-12 | Ranh giới ngày cấu hình học kỳ (5/9-15/1 = HK1, 16/1-31/5 = HK2) | Có bài tập với hạn nộp đúng NGÀY BIÊN 15/1 và 16/1 | Giao 2 bài, hạn nộp lần lượt 15/1 và 16/1 (năm học hiện tại) -> đối chiếu bài 15/1 được tính vào "Bài tập cô giao"/điểm TB bài tập của HK1, bài 16/1 tính vào HK2 | Đúng phân kỳ theo ranh giới ngày như cấu hình | Bài 15/1 bị tính nhầm sang HK2 hoặc ngược lại (lỗi off-by-one ranh giới) | Trung bình | Docx mục 2.2.4 Acceptance criteria — chưa chạy, cần đợi tới gần mốc 15/1 hoặc set hạn nộp thủ công đúng ngày biên |
| TK-13 | Rule "làm bài nhiều lần -> lấy điểm cao nhất" áp dụng cho "Điểm TB bài tập" | Có 1 room được làm rồi làm lại (đổi điểm), TRONG kỳ đang xét | Dùng lại chính case thật đã có trong `historical_activity_log.md` hôm nay: room `c74983d5-a5a1-4304-9a45-891d67aeb539` (lần 1 = 4 điểm, làm lại = 5 điểm) — hoặc room `2bb7600b`/`90a94466` từ 09-09 (cùng rule, cũng đã làm lại) — đối chiếu "Điểm TB bài tập" có dùng đúng điểm CAO NHẤT hay bị lẫn | Báo cáo dùng đúng điểm CAO NHẤT, không phải điểm lần đầu hay trung bình 2 lần | Dùng sai điểm (lần đầu, trung bình, hoặc lần làm SAU CÙNG bất kể cao/thấp hơn) | Cao | ⚠️ BLOCKED bởi TK-08 — chưa room nào tới hạn nộp (11/09) nên chưa có số liệu để đối chiếu. Kiểm tra lại từ **2026-09-12** cùng lúc với TK-08 |

---

## Việc cần làm tiếp (không thuộc phạm vi hôm nay)

- **TK-08 CHƯA đóng** (đã sửa lại sau khi tự phát hiện kết luận trước sai) — rerun
  `reportClassSummaryDiscovery.mjs` (`TARGET_CLASS_TEXT="7QA-Test"`) **từ 2026-09-12** trở đi (KHÔNG
  phải 09-11 — cả 3 room trong tuần đều hạn 11/09 Thứ Sáu, quy tắc "hiển thị từ ngày hôm sau hạn
  nộp" + report tuần chạy 00:00 Thứ Bảy nghĩa là mốc verify sớm nhất hợp lệ là 12/09 Thứ Bảy). Nếu
  đến 12/09 vẫn `0/0`/empty-state thì MỚI có cơ sở nghi bug thật, lúc đó mới báo dev.
- **TK-09 verify SỚM HƠN, từ 2026-09-11** (không bị chặn bởi quy tắc "ngày hôm sau hạn nộp", chỉ
  chịu quy tắc trễ 1 ngày chung) — đối chiếu `study_time` mới với tổng 09-09 (10099s) + phiên 09-10
  sạch (6053s, login 13:15:18–logout 14:56:11) = kỳ vọng **~16152s (~269 phút)** nếu cộng dồn đúng.
  Đã có 1 khoảng chênh ~950s (15.8 phút) CHƯA giải thích được ở lần đo 09-10 (API=9149s vs dựng lại
  từ log=10099s cho riêng 09-09) — theo dõi xem khoảng chênh này CỘNG DỒN THEO TỶ LỆ hay KHÔNG ĐỔI
  qua lần đo tiếp theo, sẽ giúp phân biệt "lỗi tính toán 1 lần" vs "định nghĩa study_time khác log"
  (vd loại trừ 1 loại thời gian đứng yên nào đó mà protocol log coi là active).
- TK-04/TK-06 cần dữ liệu Học kỳ II hoặc chức năng "Nhập điểm" (thuộc "Màn import điểm", để case
  riêng theo đúng lựa chọn phạm vi của user).
- TK-10 cần 1 lớp ≥11 học sinh — hiện không có, cần user xác nhận có tạo lớp test mới hay dùng lớp
  thật nào khác.
- TK-07 cần hỏi dev/PO xác nhận thứ tự sort thật khi chưa có điểm là gì (không phải alphabet như
  docx mô tả) trước khi gắn nhãn PASS/FAIL chính thức.
- Chưa viết case cho tab "Bài tập về nhà", "Màn tổng kết năm học", "Màn import điểm" — theo đúng
  phạm vi ưu tiên đã chọn (Tổng kết lớp / Học kỳ I trước).

---

## Nguyên văn yêu cầu (trích docx, mục 2.2.2-2.2.4, phần "Màn tổng kết học kỳ")

> **2.2.3. Màn hình và mô tả — Màn tổng kết học kỳ**
>
> 1. Học kỳ (Droplist) — Bộ lọc học kỳ gồm Học kỳ I, Học kỳ 2, Cả năm. Default vào học Học kỳ I.
>    Khi Học kỳ 2 có dữ liệu điểm sẽ default vào học kỳ II.
> 2. Tổng quát (Card) — Gồm các thẻ Điểm TB cuối kỳ, Điểm TB giữa kỳ, Điểm TB bài tập.
>    - Điểm TB cuối kỳ = Trung bình cộng cột Điểm thi cuối kỳ ở control 5 (làm tròn đến số thập
>      phân thứ nhất)
>    - Điểm TB giữa kỳ = Trung bình cộng cột Điểm thi giữa kỳ ở control 5 (làm tròn đến số thập
>      phân thứ nhất)
>    - Điểm TB bài tập = x/y (làm tròn đến số thập phân thứ nhất). X là tổng điểm TB của học sinh
>      trong lớp (X = N1+N2+...+Nn, N1 = Tổng điểm bài tập đã nộp / Số bài đã nộp, làm tròn đến số
>      thập phân thứ nhất). Y là số học sinh của lớp đó. Trong TH học sinh làm 1 bài nhiều lần, sẽ
>      sử dụng điểm cao nhất để tính dữ liệu. Lưu ý: Chỉ sử dụng những bài có hạn nộp trong học kỳ
>      đó. Có sự so sánh giữa kỳ II và kỳ I (Trong TH ở Kỳ I thì không có sự so sánh): nếu có chênh
>      lệch hiển thị tăng/giảm (số) điểm, nếu không có chênh lệch thì không hiển thị.
> 3. Sắp xếp (Droplist) — Sắp xếp Cao-Thấp: Điểm 15'(1..4), Thi giữa kỳ, Thi cuối kỳ, Điểm trung
>    bình. Focus mặc định vào Điểm trung bình.
> 4. Nhập điểm (Button) — mở popup import file điểm.
> 5. Bảng kết quả học tập (Table) — cột: Tên học sinh, Tìm kiếm, Điểm 15'(1..4), Thi giữa kỳ, Thi
>    cuối kỳ, Điểm TB (công thức hệ số: 15'=1, giữa kỳ=2, cuối kỳ=3; màu theo khoảng Dưới 5/5-6,9/
>    7-8,9/9-10), Xếp hạng (đồng hạng khi bằng điểm), phân trang 10 HS/trang. Chưa có đầu điểm thì
>    sắp xếp theo alphabet tên; đồng điểm cũng sắp theo tên.
> 6. Sắp xếp bảng chuyên cần (Droplist) — Bài tập cô giao / Lesson tự học / Thời gian học, focus
>    mặc định Bài tập cô giao.
> 7. Bảng chuyên cần (Table) — cột: Tên học sinh, Tìm kiếm, Bài tập cô giao (x/y, tính theo hạn nộp
>    trong kỳ), Lesson tự học, Thời gian học (tổng thời gian đăng nhập app trong kỳ, đơn vị giờ,
>    làm tròn LÊN), phân trang 10 HS/trang.
>
> **2.2.4. Acceptance criteria**
> - Trong TH chưa có dữ liệu -> hiển thị theo design.
> - Thời gian từng học kỳ config trong code: Học kỳ I 5/9-15/1, Học kỳ II 16/1-31/5.
