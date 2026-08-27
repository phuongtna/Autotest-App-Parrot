# Testcase - Chức năng "Giao bài tập" (Web GV -> App HS)

Điền testcase theo mẫu bên dưới (giống định dạng đã dùng cho màn "Vui học" / "Bài tập").
Khác với 2 màn kia, case ở đây liên quan tới **2 hệ thống**: web Giáo viên
(https://parrotedu.vn/teacher/login) để giao bài, và app di động tài khoản Học sinh để
nhận thông báo/bài đã giao -> không tự động hoá bằng Maestro (Maestro chỉ chạy trên app
Android) mà dùng để ghi lại bước test manual, tôi sẽ thao tác trực tiếp (web trên máy tính
+ app trên máy ảo/máy thật) để xác nhận hành vi thực tế rồi báo kết quả lại.

---

## TC1: Giáo viên giao bài tập thành công tới nhiều lớp khác khối cho học sinh

ĐÃ XÁC NHẬN THẬT (2026-08-09, tài khoản GV "Phương" 0912312312 - trùng TEACHER_USERNAME/
TEACHER_PASSWORD trong `.env`, không phải tài khoản GV thật ngoài dự án):
- Tài khoản GV này chỉ quản lý 2 lớp: 3B (Khối 3) và 6D (Khối 6) - không có 2 lớp cùng
  khối để test nốt vế "lớp cùng khối vẫn chọn được thêm", nhưng đã xác nhận đúng vế chính:
  chọn 3B -> 6D chuyển disable (xám, không bấm được) ngay lập tức.
- Đã thực hiện thật: chọn lớp 3B, Hạn nộp 20/08/2026, Unit 1: Hello - Lesson 1 - bài
  "G3-U1-Lesson 1: Listen and repeat" -> bấm "Giao bài đã chọn" -> toast "Giao bài tập mới
  thành công" -> danh sách "Bài tập đã giao" tăng đúng 47 -> 48, dòng mới hiện đúng lớp/bài/
  hạn nộp, "0/5 HS đã làm".
- Trên app HS (tài khoản "Ngoc", lớp 3B): mở icon thông báo, nhận được đúng thông báo
  "Ngoc nhận được bài tập "G3-U1-Lesson 1: Listen and repeat" từ cô Phương. Hạn nộp:
  20/08/2026. Chúc con học tốt!" - khớp 100% với bài/hạn nộp vừa giao.
- CHƯA verify được vế "bài tập hiển thị trong danh sách Bài tập của app": danh sách này
  sort theo hạn nộp và khá dài (25-35 item tuỳ filter "2 tuần/1 tháng gần nhất", có xen
  section Unit "Chinh phục" ở giữa) - dò tay chưa tìm thấy đúng card trong thời gian hợp
  lý, không kết luận là thiếu/lỗi, chỉ là chưa xác nhận được qua UI.

Precondition:
- Có tài khoản Giáo viên (GV) đã được cấp quyền, đã đăng nhập được vào web GV tại
  https://parrotedu.vn/teacher/login.
- Tài khoản GV được phân công quản lý ít nhất 2 khối, trong đó có khối gồm >= 2 lớp
  (vd: Khối 3 có lớp 3A và 3B) và 1 khối khác chỉ có 1 lớp (vd: Khối 6 có lớp 6D), để
  kiểm tra được rule disable giữa các khối.
- Có ít nhất 1 học sinh (HS) thuộc lớp sẽ được giao bài (vd: lớp 3A) đã cài app, đã đăng
  nhập, và đã bật quyền nhận thông báo (notification) trên máy đang test.
- Có sẵn Unit/Lesson với danh sách bài tập để chọn giao.

Step:
1. Truy cập web GV tại https://parrotedu.vn/teacher/login, đăng nhập bằng tài khoản GV.
2. Vào menu "Giao bài tập" -> bấm button "Giao bài tập".
3. Ở bước chọn lớp: bấm chọn lớp 3A (thuộc Khối 3).
   - Xác nhận: lớp 6D (thuộc Khối 6, khối khác với lớp vừa chọn) chuyển sang trạng thái
     disable, không bấm chọn được.
   - Xác nhận: lớp 3B (cùng Khối 3 với lớp vừa chọn) vẫn ở trạng thái cho phép chọn.
4. Bấm chọn thêm lớp 3B -> xác nhận cả 3A và 3B đều đang được chọn (giao tới 2 lớp cùng
   1 khối).
5. Chọn "Hạn nộp" là 1 ngày bất kỳ trong khoảng từ ngày hiện tại đến 1 ngày bất kỳ trong
   tương lai.
6. Chọn Unit -> chọn Lesson -> chọn 1 (hoặc nhiều) bài tập bất kỳ trong danh sách bài tập
   của Lesson đó.
7. Bấm "Giao bài đã chọn".

Output:
- Sau khi bấm "Giao bài đã chọn": bài tập vừa giao xuất hiện trong danh sách bài tập đã
  giao ở web GV (đúng lớp 3A + 3B, đúng hạn nộp, đúng bài đã chọn).
- Trên app của HS thuộc lớp 3A (hoặc 3B): nhận được thông báo đẩy (push notification) về
  bài tập mới, và trong icon thông báo của app cũng hiển thị thông báo tương ứng.
- Trong app HS, bài tập GV vừa giao xuất hiện trong danh sách bài tập của HS đó, đúng với
  Unit/Lesson/bài đã chọn và đúng hạn nộp đã đặt ở bước 5.

---

---

## TC2: Màn "Danh sách bài tập đã giao" - Xem chi tiết, Sửa hạn nộp, Xóa

Tự động hoá bằng Playwright (Web GV) - `automation/giao_bai_tap/runtime/assignedListLifecycleFlow.js`,
chạy qua `flows/web/giao_bai_tap/e2e-assigned-list-lifecycle.mjs` (`npm run assign-list-lifecycle`
trong `automation/`).

ĐÃ XÁC NHẬN THẬT (2026-08-27, tài khoản GV "Phương", lớp "3B") - 2 lượt chạy live liên tiếp đều
PASS toàn bộ các bước:

Precondition: giống TC1 (tài khoản GV đã đăng nhập được, có ít nhất 1 lớp để giao bài).

Step (tự động hoá tự tạo 1 assignment mới rồi thao tác trên đúng dòng đó - KHÔNG đụng dữ liệu có
sẵn, xem docblock hàm trên để biết lý do):
1. Đăng nhập GV.
2. Vào menu "Giao bài tập" -> hệ thống hiển thị "Danh sách bài tập đã giao".
3. Bấm "Xem báo cáo" (= "Xem chi tiết" trong mô tả nghiệp vụ) của dòng vừa tạo -> điều hướng sang
   `/teacher/exercise/{id}/report`, hiển thị đúng màn "Báo cáo lớp".
4. Bấm vào tên bài (= hành động "Sửa" - màn "Bài tập đã giao" KHÔNG có nút "Sửa" riêng, bấm thẳng
   vào tên bài trong cột "BÀI TẬP") -> điều hướng sang `/teacher/exercise/{id}/edit` ("Chỉnh sửa
   bài tập"). Xác nhận: mọi field khác (Nguồn bài tập/Giao tới lớp/Chọn Unit/Lesson/Danh sách bài
   tập) đều bị khoá (disabled) - CHỈ "Hạn nộp" sửa được, đúng acceptance criteria "GV chỉ được
   phép chỉnh sửa hạn nộp của bài tập đã giao".
5. Đổi "Hạn nộp" (dùng lại đúng popover lịch của form tạo mới, cùng cấu trúc DOM) -> bấm "Giao bài
   đã chọn" (đóng vai trò nút Lưu ở màn này).
6. Xác nhận hạn nộp đã cập nhật thật (đối chiếu qua API `GET /api/user/exams/room.json`, không chỉ
   tin vào UI).
7. Bấm nút icon "Xóa" (title="Xóa", cạnh nút "Hủy") -> dialog xác nhận "Xóa bài tập" ("Bạn có chắc
   chắn muốn xóa bài tập không?") -> bấm "Xóa".
8. Xác nhận bài tập đã biến mất khỏi danh sách thật (đối chiếu qua API).

Phát hiện thêm trong lúc làm (không phải bug của case này, ghi lại để không điều tra lại):
- Title bài tập trên danh sách rất chung chung (vd "Choose the correct answer.") và LẶP LẠI ở
  nhiều catalog item khác nhau - 2 assignment thật có thể trùng cả title+lớp+hạn nộp cùng lúc. Định
  vị theo DOM (title+lớp+hạn nộp) vì vậy KHÔNG đủ tin cậy - dùng `lesson_item_id` (ổn định, không
  trùng) qua API để lấy đúng `room.id` thay thế.
- Assignment type SPEAK (kỹ năng Speaking) có link "Xem báo cáo" không điều hướng đúng - phù hợp
  với hạn chế đã biết "Speaking không đăng ký được điểm" (xem ghi chú nội bộ) - test này chủ động
  loại SPEAK khi random để không nhầm với lỗi thật của màn danh sách.
- Dropdown lọc phạm vi thời gian trên thực tế CHỈ có 2 lựa chọn "2 tuần gần nhất" / "1 tháng gần
  nhất" (user xác nhận 2026-08-27) - KHÁC với "Tuần này/Tuần trước/Tuần sau/tháng" trong tài liệu
  acceptance criteria gốc (tài liệu đã lỗi thời, UI đã đổi). Khớp đúng với những gì code ở đây
  quan sát được qua DOM dump thật (`widenDateRangeFilter` tìm text "1 tháng gần nhất").

**ĐÍNH CHÍNH (2026-08-27)**: dòng "Ô Tìm theo tên bài tập ... KHÔNG lọc lại danh sách" ghi TRƯỚC
ĐÂY ở case này là **kết luận SAI** - lượt điều tra đầu chỉ gọi `fill()` rồi chờ mà không bấm Enter.
User chỉ ra đúng: ô này cần bấm Enter để submit (không phải live-search theo ký tự). Đã điều tra
lại và XÁC NHẬN HOẠT ĐỘNG ĐÚNG - xem TC3 bên dưới.

---

## TC3: Tìm kiếm theo tên bài tập trên "Danh sách bài tập đã giao"

Tự động hoá bằng Playwright (Web GV) - `automation/giao_bai_tap/runtime/searchAssignedListFlow.js`,
chạy qua `flows/web/giao_bai_tap/e2e-assigned-list-search.mjs` (`npm run assign-list-search` trong
`automation/`). CHỈ ĐỌC - không tạo/sửa/xóa dữ liệu nào.

ĐÃ XÁC NHẬN THẬT (2026-08-27, tài khoản GV "Phương") - PASS:

- Ô "Tìm theo tên bài tập" **PHẢI bấm Enter** để submit tìm kiếm - gõ xong (`fill()`) mà không bấm
  Enter thì KHÔNG tự lọc lại danh sách (không phải live-search theo ký tự, đúng như user mô tả).
- `fill(tên)` + `press("Enter")` gọi đúng 1 request mới `GET .../room.json?...&search=<tên đã
  gõ>&...` (network capture xác nhận), danh sách sau đó CHỈ còn (các) dòng có tên khớp.

Step: lấy tên 1 dòng CÓ SẴN thật ở trang 1 (không hardcode/không đoán tên) -> gõ đúng tên đó vào ô
tìm kiếm -> bấm Enter -> xác nhận mọi dòng còn lại trong bảng đều chứa đúng tên đã gõ.

---

## TC4: Lọc theo lớp học trên "Danh sách bài tập đã giao"

Tự động hoá bằng Playwright (Web GV) -
`automation/giao_bai_tap/runtime/filterAssignedListByClassFlow.js`, chạy qua
`flows/web/giao_bai_tap/e2e-assigned-list-filter-by-class.mjs` (`npm run assign-list-filter-class`
trong `automation/`). CHỈ ĐỌC - không tạo/sửa/xóa dữ liệu nào.

ĐÃ XÁC NHẬN THẬT (2026-08-27, tài khoản GV "Phương") - PASS:

- Dropdown "Tất cả các lớp" liệt kê ĐÚNG các lớp thật thuộc tài khoản GV đang đăng nhập (đọc trực
  tiếp qua DOM, không hardcode) - lần chạy live: `["Tất cả các lớp","2A","3B","7QA-ReRun-0820",
  "7QA-Test"]`.
- Chọn 1 lớp cụ thể gọi lại đúng 1 request mới `GET .../room.json?...&class_id=<id thật của lớp
  đó>...` (network capture xác nhận) và bảng CHỈ còn dòng của ĐÚNG lớp đã chọn (verify 100% dòng
  hiển thị đều khớp cột "LỚP").

Step: đọc danh sách lớp thật từ dropdown -> chọn 1 lớp (ưu tiên lớp đang có ít nhất 1 dòng trong
view mặc định, để assertion có ý nghĩa) -> xác nhận mọi dòng còn lại trong bảng đều thuộc đúng lớp
đã chọn.

---

## TC5: Màn "Báo cáo lớp" - cột "Đã hoàn thành" -> chọn tên học sinh -> "Chi tiết bài làm học sinh"

Tự động hoá bằng Playwright (Web GV) - `automation/giao_bai_tap/runtime/openStudentResultFlow.js`,
chạy qua `flows/web/giao_bai_tap/e2e-open-student-result.mjs` (`npm run open-student-result` trong
`automation/`). CHỈ ĐỌC - không tạo/sửa/xóa dữ liệu nào.

**KHÁC với TC2**: case này dùng 1 assignment CÓ SẴN thật đã có HS nộp bài (không tự tạo mới) - vì
assignment tự tạo mới luôn có 0 HS làm bài (không có HS thật nào biết để làm ngay lập tức), không
có gì để test drill-down "Đã hoàn thành" -> "Chi tiết bài làm". Test tự tìm 1 dòng bất kỳ có HS đã
làm (không hardcode/không đoán assignment cụ thể) - an toàn tuyệt đối vì hoàn toàn CHỈ ĐỌC.

ĐÃ XÁC NHẬN THẬT (2026-08-27, tài khoản GV "Phương") - 2 lượt chạy live liên tiếp đều PASS:

- Mỗi HS trong card "Đã hoàn thành (N)" của màn "Báo cáo lớp" là 1 link thật
  `<a href="/teacher/exercise/{roomId}/result/{studentUserId}">{tên HS}</a>`.
- Bấm vào tên HS -> điều hướng đúng sang `/teacher/exercise/{roomId}/result/{studentUserId}`
  ("Chi tiết bài làm học sinh" - breadcrumb "Tổng quan / Bài tập về nhà / Chi tiết bài làm"), hiển
  thị đủ "Điểm số", "Thời gian nộp", "Thời gian làm bài", "Lịch sử nộp bài" - khớp mockup gốc.
- Card "Đã hoàn thành" render SAU heading tổng "Báo cáo lớp" (giống pattern đã gặp ở
  "Danh sách bài tập đã giao" - phải chờ chính card này xuất hiện, không chỉ chờ heading trang).

Step: tìm 1 dòng bất kỳ có "HS ĐÃ LÀM" > 0 trên trang 1 -> bấm "Xem báo cáo" -> đọc danh sách HS
trong card "Đã hoàn thành" -> bấm tên HS đầu tiên -> xác nhận điều hướng đúng + hiển thị đủ field.

Phát hiện thêm trong lúc làm (bug thật, đã sửa - xem `widenDateRangeFilter` trong
`teacherAssignedListPageObjects.js`): bản cũ của hàm đổi filter phạm vi thời gian click vào option
không scope trong đúng `listbox` + nuốt lỗi bằng `.catch(()=>{})` - khi click trượt, dropdown vẫn ở
trạng thái MỞ, che kín toàn trang (`<html>` chặn pointer events), khiến MỌI thao tác click sau đó
trong cùng flow bị timeout mà không có lỗi rõ ràng nào lộ ra trước đó. Đã sửa: scope đúng listbox,
không nuốt lỗi, luôn bấm Escape sau cùng để đảm bảo đóng dropdown.

---

## TC6 (REGRESSION - ĐANG FAIL, bug thật chưa sửa): "ĐIỂM TB" tính sai khi học sinh retake

Tự động hoá bằng Playwright + API (Web GV) -
`automation/giao_bai_tap/runtime/verifyAverageScoreFlow.js`, chạy qua
`flows/web/giao_bai_tap/e2e-verify-average-score.mjs` (`npm run verify-average-score` trong
`automation/`). CHỈ ĐỌC - không tạo/sửa/xóa dữ liệu nào.

**BUG THẬT ĐÃ XÁC NHẬN (2026-08-27, đối chiếu 11/11 assignment thật có retake trên tài khoản GV
"Phương", khớp CHÍNH XÁC không sai lệch)**: cột "ĐIỂM TB" trên "Danh sách bài tập đã giao" tính
SAI khi 1 học sinh làm lại (retake) ≥ 2 lần:

```
ĐIỂM TB hiển thị (SAI)  = MAX(điểm các lần làm) / SỐ LẦN LÀM
ĐIỂM TB đúng theo spec  = MAX(điểm các lần làm)   (acceptance criteria gốc: "Trong TH học sinh làm
                                                    lại nhiều lần thì sử dụng điểm của lần làm bài
                                                    có điểm cao nhất")
```

Ví dụ thật (verify lại được nhiều lần, tất cả đều khớp công thức trên):

| Assignment (rút gọn) | Điểm các lần làm | Điểm đúng (max) | ĐIỂM TB hiển thị (sai) |
|---|---|---|---|
| Choose the word whose underlined part... (7QA-Test) | [5, 5] | 5 | **2.5** (=5/2) |
| Choose the word that has a different stress... | [8, 10, 7] | 10 | **3.3** (=10/3) |
| G7U2-HW-Vocab-BTCB | [0, 0, 10] | 10 | **3.3** (=10/3) |
| G3-U2-Lesson 2: Read and tick True or False | [2, 8, 6] | 8 | **2.7** (=8/3) |

**Hậu quả nghiệp vụ**: học sinh càng chăm chỉ làm lại để cải thiện điểm thì "ĐIỂM TB" hiển thị cho
GV càng bị kéo THẤP xuống một cách giả tạo - ngược hẳn mục đích khuyến khích retake của chính rule
đã công bố. Case KHÔNG retake (chỉ 1 lần làm) thì "ĐIỂM TB" luôn tính ĐÚNG (đã đối chiếu nhiều case
- bug CHỈ xảy ra khi có retake).

Step: tìm 1 assignment CÓ SẴN thật có đúng 1 HS hoàn thành với ≥2 lần làm (không tự tạo được -
retake phải làm qua app HS, ngoài phạm vi Playwright Web GV) -> tính điểm ĐÚNG theo spec (= điểm
lần làm cao nhất) -> đọc "ĐIỂM TB" thật hiển thị trên danh sách -> assert 2 giá trị phải khớp nhau.

**KỲ VỌNG chạy test**: FAIL cho tới khi bug được backend sửa (test assert theo ĐÚNG spec, không hạ
chuẩn để PASS theo hành vi sai hiện tại) - giữ lại làm regression test, tự chuyển PASS khi sửa
xong. Đã chạy live 2 lần liên tiếp (2026-08-27), cả 2 đều FAIL đúng như dự kiến, cùng 1 bằng chứng.

---

<!--
Copy khối "## TCx" bên trên để thêm case mới.
Có thể ghi thêm dữ liệu test cần dùng (tài khoản GV, lớp, Unit/Lesson...) ngay trong case -
tôi sẽ đưa vào test_data/ nếu cần tái sử dụng.
-->
