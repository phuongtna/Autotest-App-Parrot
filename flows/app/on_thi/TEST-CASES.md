# Bảng test case — Tab "Ôn thi" > "Đề thầy cô giao" (Danh sách đề)

Nguồn: chuyển thể từ `flows/app/on_thi/spec.json` / `TESTCASES-danh-sach-de.xlsx` (42 test case,
`TC_APP_OnThi_DanhSachDe_1..42`) sang bộ automation Maestro, **tái sử dụng tối đa** code đã có của
module Bài tập (`automation/bai_tap/`, `flows/app/bai_tap/`, `flows/app/helpers/`) vì 2 luồng gần
như giống hệt nhau (spec.json: "Gồm đề cơ bản và đề nâng cao, thể hiện giống module Bài tập").

**Trạng thái chung: CHƯA CHẠY THẬT LẦN NÀO.** Mọi file `.yaml`/`.js` trong module `on_thi` mới viết
đều mang nhãn "CHƯA VERIFY TRÊN THIẾT BỊ THẬT" trong docblock — khác hẳn `automation/bai_tap/`
(đã verify qua rất nhiều lượt device thật). **Không chạy `maestro test` hàng loạt cho tới khi đã
đối chiếu `maestro hierarchy` thật trên màn "Ôn thi" ít nhất 1 lần** (theo đúng yêu cầu "viết xong
chưa chạy test vội" + văn hoá chung của repo: không suy đoán, luôn xác minh thật trước khi tin).

Cột **Auto** = có file Maestro/Node viết sẵn (nhưng CHƯA chạy thật, xem trên). Cột **Tay** = cần QA
verify thêm bằng mắt/thao tác (bao gồm cả việc tự set up precondition qua Web giáo viên). Cột
**File** = Maestro flow hoặc Node script tương ứng.

**Chạy được ngay, KHÔNG cần thiết bị/app thật** — fixture test thuần logic cho parser card mới
(`automation/on_thi/discovery/onThiUiList.js` + `findDeThi.js`), dựng lại dữ liệu text theo đúng
ảnh mockup đính kèm yêu cầu gốc (kể cả case collision "2 đề cùng Hạn nộp" từng gây bug sắp xếp thật):

```
node automation/on_thi/discovery/onThiUiList.parseCard.fixtureTest.mjs
```

Hiện tại: **7/7 PASS**. Đây là lớp kiểm chứng DUY NHẤT đã thực sự chạy qua trong phiên viết code này
— mọi file `.yaml` Maestro bên dưới vẫn CHƯA được chạy `maestro test` lần nào.

---

## I. Màn hình Danh sách đề thầy cô giao (OT-01 .. OT-17)

### 1. Label Số lượng đề & Dropdown Thời gian giao đề

| ID | TC Excel | Tên case | Auto | Tay | File |
| --- | --- | --- | --- | --- | --- |
| OT-01 | _1 | Mặc định Dropdown = "2 tuần gần nhất" khi vào màn lần đầu | ✅ | | `OT-01_02_03_04_06-filter-and-count.yaml` |
| OT-02 | _2 | Label "N đề" đúng tổng số theo bộ lọc đang chọn | | ✔ | cùng file trên (chỉ assert **có** label đúng định dạng `\d+ đề`, KHÔNG tự tính được số đúng/sai vì chưa có API model — xem Ghi chú #1 dưới bảng) |
| OT-03 | _3 | Đổi bộ lọc sang "1 tháng gần nhất" cập nhật đúng danh sách | ✅ | ✔ | cùng file trên (đổi label + xuất hiện card mới là tự động được; đối chiếu card đó đúng nằm trong khoảng ngày cần xem bằng mắt/log, theo đúng cách HW-03 của Bài tập dùng thêm script Node riêng — chưa viết script đó cho on_thi, xem Ghi chú #1) |
| OT-04 | _4 | Rỗng do lọc hẹp (ngoài khoảng vẫn có đề) | ✅ | | cùng file trên |
| OT-05 | _5 | Rỗng tuyệt đối (lớp chưa từng được giao đề) | | ✔ | cần profile/lớp riêng chưa từng nhận đề nào (tương tự cách Bài tập dùng hồ sơ con mới cho HW-06) — chưa có hồ sơ cố định, QA tự tạo khi chạy |
| OT-06 | _6 | Dropdown chỉ có đúng 2 lựa chọn | ✅ | | cùng file trên |

### 2. Card đề chưa nộp

| ID | TC Excel | Tên case | Auto | Tay | File |
| --- | --- | --- | --- | --- | --- |
| OT-07 | _7 | Card hiển thị đủ Tên đề/tiến độ x-y/thanh tiến độ/hạn nộp | ✅ | | `OT-07_09_10_11_12_13-card-chua-nop-matrix.yaml` |
| OT-08 | _8 | Sắp xếp theo Ngày giao giảm dần | | ✔ | cần đối chiếu Ngày giao thật của ≥2 đề (không đọc được "ngày giao" từ UI, chỉ có "Hạn nộp" — xem Ghi chú #2) — **đã có bug thật ghi nhận cho đúng rule này**, xem jira log phiên làm việc trước |
| OT-09 | _9 | Nhãn "(QUÁ HẠN)" đỏ khi quá hạn | ✅ | | cùng file trên |
| OT-10 | _10 | Nhãn "(Hôm nay)" khi đến hạn đúng ngày | ✅ | | cùng file trên |
| OT-11 | _11 | CTA "Làm bài" khi chưa từng làm (0/y) | ✅ | | cùng file trên |
| OT-12 | _12 | CTA "Làm tiếp" khi đã làm dở ≥1 câu | ✅ | | cùng file trên |
| OT-13 | _13 | Tap CTA chuyển đến màn Chi tiết đề | ✅ | | cùng file trên (tap qua `automation/on_thi/navigation/onThiNavigationEngine.js#tapDeCta()` hoặc trực tiếp `flows/app/helpers/open-de.yaml`) |

### 3. Card đề đã nộp

| ID | TC Excel | Tên case | Auto | Tay | File |
| --- | --- | --- | --- | --- | --- |
| OT-14 | _14 | Card đã nộp hiển thị đủ khối điểm/Tên đề/x-y/điểm cao nhất | ✅ | | `OT-14_15_16_17-card-da-nop-matrix.yaml` |
| OT-15 | _15 | Thanh tỉ lệ đúng (xanh)/sai (đỏ) đúng màu | | ✔ | Maestro không đọc được màu qua text selector (cùng giới hạn đã ghi nhận ở `homeworkPageObjects.js#reviewDetail` — màu tab Câu N) — chỉ chụp screenshot, QA xem bằng mắt |
| OT-16 | _16 | Điểm hiển thị = điểm lần làm CAO NHẤT (không phải lần gần nhất) | | ✔ | cần ≥2 lần làm cùng 1 đề với điểm khác nhau — set up thủ công rồi đối chiếu bằng mắt/API, chưa có script tự làm nhiều lần + so điểm |
| OT-17 | _17 | Tap "Xem bài đã làm" mở đúng Lịch sử làm bài | ✅ | | cùng file trên (`onThiNavigationEngine.js#openAttemptHistory()`) |

---

## II. Rule hiển thị đề theo trạng thái công khai trên Web (OT-18 .. OT-22)

Đã đổ bug thật liên quan rule này trong phiên làm việc trước (xem log Jira "App ẩn mất đề bị giáo
viên Ẩn giữa chừng dù Web vẫn đang hiển thị" — case OT-21 bên dưới).

| ID | TC Excel | Tên case | Auto | Tay | File |
| --- | --- | --- | --- | --- | --- |
| OT-18 | _18 | Đề Công khai trên Web hiển thị trong danh sách | ✅ | ✔ | `OT-18_19-cms-publish-visibility.yaml` — precondition (giao viên publish đề trên Web) set up thủ công trước khi chạy |
| OT-19 | _19 | Đề Chưa công khai không hiển thị | ✅ | ✔ | cùng file trên — precondition (giáo viên để Chưa công khai) set up thủ công |
| OT-20 | _20 | Đang làm dở, giáo viên Ẩn giữa chừng → vẫn làm tiếp + có kết quả | ❌ | ✔ | **CẦN Node orchestrator** phối hợp 2 phía (App đang mid-exam + Web giáo viên bấm Ẩn) trong CÙNG 1 kịch bản — xem Ghi chú #3 |
| OT-21 | _21 | Đề bị Ẩn giữa chừng sau khi nộp: App phải đồng bộ đúng theo trạng thái hiển thị trên Web | ❌ | ✔ | cùng lý do Ghi chú #3 — **đây chính là case có bug thật đã log Jira** |
| OT-22 | _22 | Giáo viên Xoá đề trên Web → biến mất cả lịch sử làm bài phía HS | ❌ | ✔ | cùng lý do Ghi chú #3 (đơn giản hơn OT-20/21 vì không cần đồng bộ thời điểm, nhưng vẫn cần thao tác Web xen giữa 2 lượt đọc App) |

---

## III. Rule quyền truy cập theo gói dịch vụ (OT-23 .. OT-30)

**Chưa có copy thật của bottom sheet nâng cấp cho module Ôn thi** (khác hẳn module Bài tập, nơi
`automation/bai_tap/hw21-22-upgrade-sheets.mjs` đã có ≥4 biến thể copy capture thật) — xem Ghi chú
#4. Toàn bộ nhóm này đánh dấu Tay cho tới khi có copy thật để viết assertion không phải đoán.

| ID | TC Excel | Tên case | Auto | Tay | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| OT-23 | _23 | Mọi loại TK đều làm được đề Free | | ✔ | reuse `open-de.yaml` 3 lần (Free/Pro/Dùng thử), chỉ cần đổi `PHONE` |
| OT-24 | _24 | TK Free bị chặn "Làm lại" đề Free | | ✔ | cần copy thật trước |
| OT-25 | _25 | TK Free bị chặn AI giải thích/dịch đề Free | | ✔ | cần copy thật trước |
| OT-26 | _26 | TK Pro làm đề Pro không giới hạn | | ✔ | |
| OT-27 | _27 | TK Dùng thử làm đề Pro như Pro | | ✔ | |
| OT-28 | _28 | TK Free xem Thông tin đề Pro, bấm Bắt đầu → bottom sheet nâng cấp | | ✔ | cần copy thật trước (`onThiPageObjects.js#upgradeSheet.knownCopyPatterns` đang để trống) |
| OT-29 | _29 | TK hết hạn Pro vẫn xem được Kết quả/đáp án đề Pro đã làm | | ✔ | cần TK có lịch sử làm đề Pro TRƯỚC KHI hết hạn — setup dữ liệu dài hơi |
| OT-30 | _30 | TK hết hạn Pro bị chặn Làm lại/AI giải thích | | ✔ | cùng TK/setup với OT-29 |

---

## IV. Rule trạng thái đề (OT-31 .. OT-33)

| ID | TC Excel | Tên case | Auto | Tay | File |
| --- | --- | --- | --- | --- | --- |
| OT-31 | _31 | Hoàn thành, không phiên dở → "Đã hoàn thành" | ✅ | | reuse `OT-14_15_16_17-card-da-nop-matrix.yaml` (đã verify hiển thị khối điểm = coi như "Đã hoàn thành", không có text trạng thái riêng để assert thêm — xem Ghi chú #5) |
| OT-32 | _32 | Từng hoàn thành, đang Làm lại dở dang → "Đang làm dở" | ✅ | ✔ | cần mở "Làm lại" rồi thoát giữa chừng (tap X) trước khi assert lại danh sách — reuse pattern HW-15 (Bài tập) "tap X giữa bài → card đổi CTA" |
| OT-33 | _33 | Hết giờ làm bài → tự động nộp → "Đã hoàn thành" sau khi load lại | ❌ | ✔ | không thực tế chờ hết timer thật trong CI — cần 1 đề test có thời gian làm RẤT NGẮN (vài chục giây) do QA tự tạo trên Web mới automate được |

---

## V. Rule hạn nộp đề (OT-34 .. OT-35)

| ID | TC Excel | Tên case | Auto | Tay | File |
| --- | --- | --- | --- | --- | --- |
| OT-34 | _34 | Đề quá hạn vẫn làm + nộp bình thường | ✅ | | `OT-34_35-qua-han-nop-flow.yaml` (reuse `open-de.yaml` + `answer-current-exercise-generic.yaml` + `answer-and-wait-result.yaml`, y hệt cách Bài tập làm 1 lượt full luồng) |
| OT-35 | _35 | Sau khi nộp trễ hạn, Card chuyển đã nộp với điểm đúng | ✅ | | cùng file trên |

---

## VI. Rule thông báo giao đề & HS vào lớp sau khi được giao đề (OT-36 .. OT-42)

### 1. Thông báo giao đề mới

| ID | TC Excel | Tên case | Auto | Tay | File |
| --- | --- | --- | --- | --- | --- |
| OT-36 | _36 | HS nhận thông báo trong app khi được giao đề mới | ❌ | ✔ | cần copy thật nội dung thông báo "giao đề" trước (khác hẳn "giao bài tập" của TB-01) — xem Ghi chú #6 |
| OT-37 | _37 | Tap thông báo → vào thẳng Chi tiết đề | ❌ | ✔ | cùng lý do Ghi chú #6; khung reuse `flows/app/thong_bao/TB-05-...yaml` đã viết sẵn pattern, chỉ cần đổi regex nội dung |

### 2. HS vào lớp sau khi giáo viên đã giao đề

| ID | TC Excel | Tên case | Auto | Tay | File |
| --- | --- | --- | --- | --- | --- |
| OT-38 | _38 | Vào lớp sau khi giao đề vẫn thấy đề còn hạn | ❌ | ✔ | cần kịch bản: giáo viên giao đề cho lớp X (HS CHƯA ở lớp X) → thêm HS vào lớp X → mở app. Tương tự precondition module "roi_khoi_lop" (ngược chiều) — xem Ghi chú #7 |
| OT-39 | _39 | Không nhận thông báo cho đề đã giao TRƯỚC khi vào lớp | ❌ | ✔ | cùng kịch bản Ghi chú #7 |
| OT-40 | _40 | Đề đã hết hạn trước khi HS vào lớp vẫn hiển thị nếu trong khoảng lọc | ❌ | ✔ | cùng kịch bản Ghi chú #7 |

### 3. Phạm vi hiển thị đề theo lớp

| ID | TC Excel | Tên case | Auto | Tay | File |
| --- | --- | --- | --- | --- | --- |
| OT-41 | _41 | Chỉ hiển thị đề giao cho đúng lớp HS đang tham gia | | ✔ | cần 2 lớp test (HS chỉ ở lớp A) + giáo viên giao đề riêng cho lớp B — set up thủ công, assertion app-side thì tự động được (card lớp B không xuất hiện) |
| OT-42 | _42 | Đề giao cho lớp khác không hiển thị | | ✔ | cùng case trên (OT-41/42 gộp chung 1 lượt test, chỉ là 2 góc nhìn của cùng 1 kịch bản) |

---

## Ghi chú

1. **Không tự tính được "N đề" đúng/sai** (OT-02/03) vì module Ôn thi chưa có network-capture API nào
   được xác nhận (xem `automation/on_thi/model/onThiModel.js`) — module Bài tập xử lý case tương tự
   (HW-03) bằng 1 script Node riêng (`automation/bai_tap/hw03-verify-filter-dates.js`) đọc
   `maestro hierarchy` để tự đếm/so ngày; **chưa viết bản tương đương cho on_thi**, cần làm sau khi
   có ít nhất 1 lượt network capture thật.
2. **"Ngày giao" không hiển thị trên UI** (chỉ có "Hạn nộp") — không thể tự động verify thứ tự sắp
   xếp (OT-08) chỉ bằng app, cần đối chiếu với dữ liệu giao đề thật phía Web/CMS (giống cách bug sắp
   xếp vừa log Jira được phát hiện: đối chiếu 3 ảnh Web "Thời gian giao" với thứ tự card trên App).
3. **OT-20/21/22 cần Node orchestrator 2 phía** (App đang ở 1 trạng thái cụ thể + Web giáo viên thao
   tác xen giữa, cùng 1 kịch bản, đúng thời điểm) — mẫu đã có trong repo:
   `automation/thong_bao/e2e-teacher-assign-os-notification-shade.mjs` (Web assign → App OS shade) và
   `flows/web/giao_bai_tap/giao_de_luyen_tap/` (Web side cho chính module "đề luyện tập" này — CHƯA
   đọc kỹ để biết có sẵn hàm "Ẩn đề"/"Xoá đề" nào tái dùng được hay phải thêm mới). **Việc tiếp theo
   trước khi viết OT-20/21/22**: đọc `flows/web/giao_bai_tap/giao_de_luyen_tap/` + `automation/giao_bai_tap/`
   để biết có sẵn thao tác "chuyển Công khai/Chưa công khai" dạng code hay chỉ có qua UI thủ công.
4. **Copy bottom sheet nâng cấp Pro/Free của module Ôn thi chưa capture được** — cần 1 lượt chạy tay
   thật (tài khoản Free bấm "Bắt đầu làm bài" trên 1 đề Pro), ghi lại nguyên văn text hiện ra, rồi
   điền vào `automation/on_thi/navigation/onThiPageObjects.js#upgradeSheet.knownCopyPatterns` trước
   khi viết assertion cho OT-24/25/28/30 (theo đúng cách `hw21-22-upgrade-sheets.mjs` đã làm cho Bài
   tập — không đoán copy).
5. Spec.json không mô tả 1 nhãn trạng thái text riêng kiểu "Đã hoàn thành"/"Đang làm dở" hiển thị rõ
   trên card (khác hẳn khái niệm "trạng thái" của hệ thống) — suy luận hợp lý nhất là trạng thái này
   THỂ HIỆN QUA việc card nằm ở nhóm "đã nộp" (khối điểm) hay "chưa nộp" (CTA Làm bài/Làm tiếp), đúng
   như cách UI của module Bài tập thể hiện. **CẦN XÁC MINH lại với BA/ảnh thật** nếu có 1 badge/nhãn
   text riêng biệt mà spec chưa nói tới.
6. Nội dung thông báo "giao đề" (OT-36/37) chưa có — xem
   `flows/app/thong_bao/TEST-CASES.md` mục "QUY TẮC NỘI DUNG THÔNG BÁO CHÍNH THỨC" để biết format
   chung cách nhóm thông báo khác đã capture (vd nhóm 1 "giao bài tập" ở TB-01) — on_thi cần 1 lượt
   giao đề thật rồi mở app xem nguyên văn nội dung thông báo trước khi viết regex matcher.
7. OT-38/39/40 cần kịch bản "HS vào lớp sau khi đã giao đề" — có thể dựng NGƯỢC lại cơ chế đã có ở
   module `flows/app/roi_khoi_lop/` (rời lớp): tạo 1 hồ sơ đã rời lớp X (orphaned, xem memory
   `feedback_reuse_orphaned_profile_for_join_class`) rồi cho giáo viên giao đề cho lớp X TRƯỚC, sau
   đó mới cho hồ sơ đó join lại lớp X — cần xác nhận module join-class có sẵn thao tác nào tái dùng
   được trước khi viết script.
