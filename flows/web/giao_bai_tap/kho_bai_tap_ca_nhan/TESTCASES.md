# Testcase - "Giao bài tập" bổ sung "Kho bài tập cá nhân" (Web GV)

Nguồn: `TestCase_GiaoBaiTap_KhoBaiTapCaNhan.xlsx` (30 test case, 29 Pass / 1 Fail:
`TC_GBT_KBTCN_033`). Module con của `flows/web/giao_bai_tap/` (xem TC7 ở file `TESTCASES.md` cha)
- code riêng tại `automation/giao_bai_tap/kho_bai_tap_ca_nhan/`.

Field mới: "Nguồn bài tập" trên form tạo "Giao bài tập", 2 lựa chọn "Bộ sách Kết nối tri thức"
(mặc định) / "Kho bài tập cá nhân".

---

## ⚠️ BUG THẬT DÙNG CHUNG CHO MỌI SPEC TRONG MODULE - PHẢI ĐỌC TRƯỚC KHI SỬA/THÊM TEST

**Radio "Kho bài tập cá nhân" có thể ÂM THẦM revert về lại "Bộ sách Kết nối tri thức" ngay SAU KHI
bấm chọn 1 checkbox Lớp** - không phải do thời gian trôi qua (đã verify radio giữ checked ổn định
suốt 3.5s nếu không đụng gì khác), mà do CHÍNH thao tác chọn Lớp kích hoạt hiệu ứng ghi đè. Hậu
quả: toàn bộ luồng sau đó (Unit/Lesson/Danh sách bài tập/tick/submit/"Xem chi tiết") ÂM THẦM dùng
NHẦM nguồn KNTT dù UI/thao tác nhìn như đang ở Kho bài tập cá nhân - rất khó phát hiện nếu không
đối chiếu id thật qua API response hoặc nội dung thật hiển thị. Đã từng làm sai lệch kết quả ở
`assign-submit.spec.js` (TC021 giao nhầm bài KNTT "BTCB 1" thay vì item Kho cá nhân) và
`tick-and-detail.spec.js` (TC018 "Xem chi tiết" mở nhầm modal "BTCB 1") trước khi tìm ra nguyên
nhân thật (2026-09-16).

**Cách né ĐÚNG DUY NHẤT**: dùng `selectPersonalBankClassStably(page, className)` từ
`automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/selectPersonalBankSource.js` - verify CẢ 2
điều kiện (radio checked + đúng lớp checked) ĐỒNG THỜI ngay sau khi chọn lớp, không chỉ verify
radio một lần riêng lẻ trước đó rồi giả định nó còn đúng. Mọi spec MỚI thao tác tới "Kho bài tập cá
nhân" + chọn lớp PHẢI dùng helper này (hoặc pattern tương đương nếu cần bật/tắt lớp nhiều lần, xem
`class-selection.spec.js#clickClassLabel`) - KHÔNG tự viết lại vòng lặp retry riêng.

**CHƯA báo dev** - cần cân nhắc mức độ ưu tiên báo cáo (không nằm trong xlsx gốc, chỉ lộ ra khi
thao tác chọn lớp NGAY SAU khi chọn nguồn trong cùng 1 phiên, giống thao tác thật của GV).

---

## ĐÃ RÚT LẠI (2026-09-18): "Tag kỹ năng Lesson luôn ra Other trên staging" KHÔNG phải bug hệ thống

**Phát hiện ban đầu (nay đã rút lại)**: quan sát thấy MỌI Lesson trên staging (GV A `0912312312`,
Khối 5 > Unit 1 và Unit 2, ≥8 lesson kiểm tra kể cả của GV B) đều hiển thị tag **"Other"**, trong
khi trên dev (GV Ngân `0985285285`, Khối 11 > READING) tag hiển thị đúng "Reading" - ban đầu kết
luận đây là bug backend tính tag sai trên staging.

**Xác minh lại theo yêu cầu trực tiếp của user (2026-09-18)** - user tự thêm 1 Unit mới ("UNIT 3:
FREE TIME", Khối 5, tài khoản GV A) với NHIỀU tag khác nhau để kiểm chứng: PRONUNCIATION→
**Speaking**, VOCABULARY AND GRAMMAR→**Reading**, SPEAKING→Other, READING→Other, WRITING→
**Skills 1**. Kiểm tra lại "Giao bài tập" cho đúng Unit này: hiển thị ĐÚNG 4 nút Lesson tách biệt
"Speaking"/"Reading"/"Other"/"Skills 1" - khớp hoàn toàn với "Kho đề cá nhân".

**KẾT LUẬN ĐÃ SỬA: KHÔNG phải bug hệ thống/backend** - hệ thống hiển thị ĐÚNG bất kỳ tag nào đã
được gán, kể cả khi đa dạng. Việc TOÀN BỘ Lesson cũ trên staging (Unit 1/Unit 2, cả GV A lẫn GV B)
đều ra "Other" chỉ là do DỮ LIỆU những Lesson đó tình cờ/thực sự được gán tag "Other" khi tạo (có
thể do cách seed/import dữ liệu test trên staging), KHÔNG PHẢI do backend tính sai. Không cần báo
dev/PM về mục này nữa.

---

## TC001-008: Giao diện + Chọn/chuyển đổi nguồn bài tập

Tự động hoá bằng **Playwright Test runner thật** (`test.describe`/`test`/`expect`, KHÔNG phải
CLI/`node` script như phần lớn `giao_bai_tap` - xem lý do chọn format này ở cuối mục này) -
`flows/web/giao_bai_tap/kho_bai_tap_ca_nhan/source-selector.spec.js`, config riêng
`automation/playwright.kho-bai-tap-ca-nhan.config.js`. Selector dùng chung tại
`automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/sourcePageObjects.js`. CHỈ ĐỌC - không bấm
"Giao bài đã chọn", không tạo/sửa/xóa dữ liệu nào.

Chạy:
```
cd automation
SOURCE_BASE_URL="https://parrotedu.codeinet.com" SOURCE_USERNAME="0915315315" \
SOURCE_PASSWORD="123456789" SOURCE_PERSONAL_BANK_CLASS="11A2" \
npm run test-kho-bai-tap-ca-nhan-pw
```
HTML report ghi ra `output/playwright-report-kho-bai-tap-ca-nhan/`.

Precondition: tài khoản GV đã đăng nhập được (giống TC1 ở TESTCASES.md cha) + có ít nhất 1 lớp CÓ
dữ liệu thật trong "Kho bài tập cá nhân" (BẮT BUỘC cho TC003/TC007 - cần ít nhất 1 item thật để mở
khung "Chọn bài tập"/để tick).

**Môi trường/tài khoản dùng thật**: dev `https://parrotedu.codeinet.com`, tài khoản GV
`0915315315` / `123456789` (hiển thị tên "Phương" trên UI - tài khoản dev riêng, KHÁC tài khoản
production `0912312312` đang có trong `.env` mặc định của `automation/`, nên mọi lần chạy PHẢI
truyền `SOURCE_BASE_URL`/`SOURCE_USERNAME`/`SOURCE_PASSWORD`, không dùng mặc định `.env`). Chỉ lớp
**"11A2" (Khối 11)** có dữ liệu thật trong "Kho bài tập cá nhân" tại thời điểm test.

**ĐÃ XÁC NHẬN THẬT (2026-09-16, chạy live 2 lần liên tiếp qua chính script tự động hoá, không chỉ
thao tác tay - cả 2 lần đều PASS toàn bộ 8/8 bước)**:
- Radio group "Nguồn bài tập" có 2 option: "Bộ sách Kết nối tri thức" (value = UUID book-set
  thật) và "Kho bài tập cá nhân" (value CỐ ĐỊNH literal `__personal_bank__`).
- Với hầu hết lớp (vd "3E", "10D"), "Kho bài tập cá nhân" RỖNG (dropdown "Chọn Unit" không có
  option nào). Chỉ lớp "11A2" có dữ liệu thật.
- TC001: 2 option hiển thị đúng, cạnh nhau trong cùng 1 group - PASS.
- TC002: mặc định load trang, "Bộ sách Kết nối tri thức" được chọn sẵn - PASS.
- TC003: chọn "Kho bài tập cá nhân" + lớp "11A2" -> khung "Chọn bài tập" hiện ĐÚNG cấu trúc
  "Chọn Unit" -> "Chọn Lesson" -> "Danh sách bài tập" - CÙNG cấu trúc với nguồn KNTT (không phải
  UI khác biệt như có thể hiểu nhầm từ tên gọi "danh sách bài tập cá nhân") - PASS.
- TC004/TC008: "Giao tới lớp"/"Thời gian giao"/"Hạn nộp" giữ nguyên vị trí VÀ giá trị qua nhiều
  lần đổi Nguồn bài tập - PASS.
- TC005/TC006: chuyển qua lại 2 nguồn, radio state + khung "Chọn bài tập" cập nhật đúng mỗi lần -
  PASS.
- **TC007: tick 1 item ở "Kho bài tập cá nhân" (lớp 11A2) -> đổi sang "Bộ sách Kết nối tri thức"
  -> đổi lại "Kho bài tập cá nhân" -> tick bị RESET (không giữ nguyên), kể cả khi Unit/Lesson tự
  re-select về đúng vị trí cũ.** File nguồn ghi TC007 là "Pass" (chỉ TC_GBT_KBTCN_033 Fail trong
  30 case) -> RESET là hành vi ĐÚNG theo kỳ vọng đã test, KHÔNG phải bug - test assert đúng theo
  hành vi RESET này.

**BUG ĐÃ SỬA TRONG QUÁ TRÌNH VIẾT (2026-09-16)**: lần chạy đầu tiên FAIL ở bước
`tickOnePersonalBankAssignment` ("không có item nào để tick") dù lớp/tài khoản có dữ liệu thật -
nguyên nhân là race condition (label "Danh sách bài tập" render trước, item bên trong fetch/
re-render sau, giống race đã biết ở `assignHomeworkFlow.js#selectUnitLessonHomework`) - đã sửa
bằng cách chờ (`waitFor`) checkbox đầu tiên xuất hiện thay vì tin `count()` tức thời. Xác nhận thật
bằng thao tác tay ngay sau khi FAIL: dữ liệu vẫn còn nguyên, không phải do thiếu dữ liệu.

Step: xem chi tiết từng `test(...)` trong `source-selector.spec.js` (đặt tên bắt đầu bằng đúng mã
TC tương ứng: `TC001: ...` .. `TC008: ...`; 2 test không tên TC là bước setup dùng chung - chọn lớp
có dữ liệu, tick 1 item - không thuộc case nào trong xlsx gốc).

Output: 10/10 test PASS (8 case + 2 setup), chạy trên lớp "11A2", tài khoản GV dev `0915315315`.

**GIỚI HẠN**: chưa test TC003/TC007 trên tài khoản GV KHÔNG có dữ liệu "Kho bài tập cá nhân" nào
(case rỗng hoàn toàn) - đó là phạm vi TC010 (Nhóm 3, chưa tự động hoá).

**Vì sao dùng Playwright Test runner (`.spec.js`) thay vì quy ước CLI/`node` của phần còn lại
`giao_bai_tap`**: theo yêu cầu trực tiếp của user (2026-09-16) - giữ đồng bộ với format
`quan_ly_goi_dich_vu`/`bao_cao_hoc_tap` (test runner thật, HTML report + trace tự sinh) thay vì
format CLI tự chế (`runtime/*Flow.js` + JSON PASS/FAIL) mà các flow khác của `giao_bai_tap` đang
dùng. Bản đầu tiên đã viết theo format CLI cũ, sau đó chuyển đổi lại đúng như hiện tại.

---

## TC033 (RULE ĐÃ ĐỔI 2026-09-18): xóa bài trong Kho bài tập cá nhân sau khi đã giao

**⚠️ ACCEPTANCE CRITERIA MỚI (xác nhận trực tiếp bởi user, 2026-09-18) - ĐẢO NGƯỢC hoàn toàn so với
xlsx gốc**: xóa 1 bài trong "Kho bài tập cá nhân" -> bản ghi "Bài tập đã giao" tương ứng **PHẢI
BIẾN MẤT** ở CẢ web ("Bài tập đã giao") LẪN app. xlsx gốc (2026-09-16 trở về trước) yêu cầu NGƯỢC
LẠI (bản ghi phải VẪN CÒN) - phần "ĐÃ XÁC NHẬN THẬT" bên dưới mô tả các lần chạy dưới rule CŨ, giữ
nguyên làm lịch sử tham khảo, KHÔNG còn là acceptance criteria hiện hành. Hệ quả quan trọng: 2 lần
FAIL trên staging (2026-09-17, 2026-09-18, xem bảng cuối mục này) **thực ra đã đúng theo rule MỚI
ngay từ đầu** - kết luận trước đó "fix của dev chưa deploy sang staging" bị RÚT LẠI, không còn là
bug. Spec `delete-source-regression.spec.js` đã được sửa để assert theo chiều MỚI (biến mất).

Tự động hoá bằng Playwright Test - `flows/web/giao_bai_tap/kho_bai_tap_ca_nhan/delete-source-regression.spec.js`,
cùng config `playwright.kho-bai-tap-ca-nhan.config.js`. **CẢNH BÁO: test này TỰ XÓA 1 bài thật
trong Kho bài tập cá nhân (`SOURCE_ITEM_ID_TO_DELETE`) - KHÔNG chạy mặc định cùng
`test-kho-bai-tap-ca-nhan-pw`** (dùng `--grep` để chạy riêng, xem lệnh chạy bên dưới), để tránh vô
tình tiêu tốn dữ liệu thật của tài khoản dev mỗi lần chạy full suite.

**ĐÃ XÁC NHẬN THẬT (2026-09-16, tài khoản GV dev `0915315315`, lớp "11A2")** - làm đúng step gốc
của xlsx:
1. Giao bài "Choose the word that has a different stress pattern from the others." (item Kho cá
   nhân id `c1a994c6-3631-4ceb-8b8b-28c8feefdcd4`, Unit 2 - Khối 11) tới lớp "11A2", hạn nộp
   18/09/2026 -> tạo bản ghi "Bài tập đã giao" id `bf573c78-aa74-4b43-b7ae-3c024d5f430a`
   ("Danh sách bài tập đã giao" tăng 18 -> 19).
2. Vào "Kho đề cá nhân" > Khối 11 > UNIT 2: OUTDOOR ACTIVITY > PRONUNCIATION, xóa đúng bài
   `c1a994c6-...` (dialog "Xóa bài" xác nhận, toast "Xóa bài thành công").
3. Kiểm tra lại "Danh sách bài tập đã giao": đếm về LẠI 18 (mất đúng 1 dòng), text "stress
   pattern" biến mất khỏi trang - **bản ghi đã giao KHÔNG còn hiển thị, trái với acceptance
   criteria gốc ("vẫn còn ở web và app")**.
4. Vào thẳng URL edit của bản ghi (`/teacher/exercise/bf573c78-.../edit`) bằng id - trang vẫn load
   (không 404) nhưng RỖNG hoàn toàn: cả radio "Nguồn bài tập" LẪN checkbox lớp "11A2" đều
   `checked: false` (xác nhận qua JS, không chỉ quan sát UI) - bản ghi backend có vẻ vẫn tồn tại
   nhưng không còn hydrate được dữ liệu thật, khớp với việc nó biến mất khỏi danh sách.
5. App HS (profile "Hoang Gia Minh", lớp 11A2, tài khoản app-dev `0987652170`): tab "Bài tập" chỉ
   còn đúng 4 item cũ (2 Vocab quá hạn + 2 "Choose the word whose underlined part..." đã làm) -
   **KHÔNG có "stress pattern" ở bất kỳ đâu trong danh sách** - xác nhận mất đồng bộ ở CẢ 2 phía
   web và app, không phải riêng web.
6. Kiểm tra lại KỸ theo đúng từng bộ lọc ngày (không chỉ tin bộ lọc mặc định, có thể "mất" chỉ do
   phạm vi ngày hẹp chứ không phải bug thật):
   - Web: đổi dropdown "2 tuần gần nhất" -> "1 tháng gần nhất" (dùng `form_input` trên
     `<select>`, KHÔNG click trực tiếp option - browser render native picker ngoài DOM tree).
     Tổng số đổi 18 -> 19 (có thêm 1 dòng khác ngoài phạm vi 2 tuần) nhưng "stress pattern"/id
     `bf573c78` VẪN KHÔNG xuất hiện.
   - App: dùng lại helper có sẵn `flows/app/helpers/homework-select-month-filter.yaml` (chạy qua
     `maestro test`, KHÔNG dò toạ độ tay - selector theo text, ổn định hơn hẳn) để chuyển "2 tuần
     gần nhất" -> "1 tháng gần nhất". Tổng "2/4" GIỮ NGUYÊN (không đổi so với bộ lọc 2 tuần) -
     xác nhận bản ghi biến mất khỏi app KHÔNG PHẢI do phạm vi ngày hẹp, mà mất thật.

   -> Kết luận CUỐI: bug KHÔNG phải do filter, bản ghi thật sự biến mất khỏi cả 2 danh sách bất kể
   khoảng thời gian xem.

**LƯU Ý QUAN TRỌNG (theo xác nhận trực tiếp của user, 2026-09-16)**: việc mất khỏi danh sách web
có **độ trễ cache ~2 phút** sau khi xóa bài trong Kho - KHÔNG biến mất ngay lập tức. Test PHẢI chờ
(poll) tối thiểu ~2 phút trước khi assert bản ghi đã biến mất, nếu không sẽ có nguy cơ false
negative (assert quá sớm, thấy bản ghi "vẫn còn" do cache chưa invalidate, tưởng nhầm là bug đã
được sửa).

Test này **KHÔNG nằm trong `playwright.kho-bai-tap-ca-nhan.config.js`** (config đó có
`testIgnore` loại trừ file này ra hẳn - Playwright áp dụng `testIgnore` trước khi lọc theo tên
file CLI, nên không thể "gọi riêng" test bị ignore bằng cách truyền tên file). Dùng config RIÊNG
`playwright.kho-bai-tap-ca-nhan-destructive.config.js`, và BẮT BUỘC truyền
`SOURCE_ITEM_ID_TO_DELETE` là 1 item THẬT, KHÔNG PHẢI item cuối cùng còn lại của lớp dùng cho
TC001-008 (xem cảnh báo trong file spec) - lệnh chạy đầy đủ xem cuối mục này.

**TRẠNG THÁI CŨ (theo rule GỐC, đã hết hiệu lực từ 2026-09-18 - xem cảnh báo đầu mục này): ĐÃ FIX,
xác nhận PASS live end-to-end lần đầu 2026-09-16** (user báo dev đã sửa,
`8a0f372c-c06a-4c83-a682-0429f50455b2` - "Choose the best answer (A, B, C or D) to complete each
sentence.", Khối 11 > UNIT 2: OUTDOOR ACTIVITY > VOCABULARY AND GRAMMAR - dùng làm item disposable
mới vì `3fea1b0a-...` vẫn đang giữ cho TC001-008/TC034). Kết quả: `test.fail()` báo
**"Expected to fail, but passed"** - đúng cơ chế tự báo động đã thiết kế, xác nhận bản ghi "Bài tập
đã giao" VẪN CÒN hiển thị NGAY LẬP TỨC sau khi xóa item nguồn (không cần chờ hết ~2 phút cache như
bug cũ). Đã bỏ `test.fail()` khỏi spec, giữ lại `expect.poll` (chỉ để phòng hờ regress cache-lag
quay lại, không còn kỳ vọng FAIL).

**4 bug THẬT trong chính test script bị phát hiện khi chạy end-to-end lần đầu tiên** (spec trước đó
viết xong nhưng chưa từng chạy thật - xem "TRẠNG THÁI" cũ, các giả định chưa được kiểm chứng):
1. Form "Giao bài tập" KHÔNG tự load đúng Unit/Lesson chứa item chỉ định (chỉ nhớ lựa chọn GẦN NHẤT
   của tài khoản) - phải điều hướng thẳng bằng `resolveAndSelectUnit`/`resolveAndSelectLesson`
   (dùng lại nguyên, không viết mới) trước khi tìm checkbox.
2. **id-mismatch giữa 2 màn hình** (cùng loại bug đã phát hiện ở TC011): `SOURCE_ITEM_ID_TO_DELETE`
   (đọc từ URL "Sửa nội dung đề" ở "Kho đề cá nhân") KHÔNG khớp id `lesson-item-{id}` dùng ở
   checkbox bên "Giao bài tập" - phải tìm checkbox bằng TIÊU ĐỀ (`SOURCE_ITEM_TITLE` mới) thay vì
   id.
3. **Route xóa item nguồn SAI hoàn toàn trong bản gốc**: `/teacher/exercise/{id}/edit` (dùng ở
   TC034) là route của bản ghi ĐÃ GIAO, KHÔNG PHẢI của item nguồn - `/teacher/quiz/{id}/edit` cũng
   sai (chỉ là trang "Chỉnh sửa đề bài", không có nút xóa). Xóa item nguồn phải làm NGAY trên
   accordion `/teacher/quiz` (Khối > Unit > Lesson) bằng icon thùng rác (`svg.lucide-trash2`) cạnh
   từng item - đồng thời phát hiện tên Lesson KHÁC NHAU giữa 2 màn hình: "Kho đề cá nhân" hiển thị
   tên Lesson thật (vd "VOCABULARY AND GRAMMAR"), "Giao bài tập" hiển thị TAG KỸ NĂNG của Lesson đó
   (vd "Other") - cần 2 env var riêng (`SOURCE_ITEM_MANAGEMENT_LESSON` / `SOURCE_ITEM_ASSIGN_LESSON`).
4. Dialog xác nhận xóa item nguồn KHÔNG có `role="dialog"` (khác dialog xóa bản ghi đã giao ở
   TC034) - `getByRole("dialog")` timeout dù dialog đã hiển thị đúng; định vị qua nút "Xóa" có text
   (duy nhất, vì icon thùng rác từng hàng không có text) + đối chiếu tiêu đề dialog khớp đúng item
   trước khi bấm xác nhận (an toàn bắt buộc cho 1 hành động không thể hoàn tác).

Chạy (đã cập nhật thêm `SOURCE_ITEM_TITLE`/`SOURCE_ITEM_ASSIGN_LESSON`/`SOURCE_ITEM_MANAGEMENT_LESSON`
so với lần đầu viết, xem docblock đầu file spec để biết đầy đủ):
```
cd automation
SOURCE_BASE_URL="https://parrotedu.codeinet.com" SOURCE_USERNAME="0915315315" \
SOURCE_PASSWORD="123456789" SOURCE_PERSONAL_BANK_CLASS="11A2" \
SOURCE_ITEM_ID_TO_DELETE="<uuid item disposable>" SOURCE_ITEM_TITLE="<tiêu đề item>" \
SOURCE_ITEM_UNIT="<Unit chứa item>" SOURCE_ITEM_ASSIGN_LESSON="<tag kỹ năng ở Giao bài tập>" \
SOURCE_ITEM_MANAGEMENT_LESSON="<tên Lesson ở Kho đề cá nhân>" \
npx playwright test --config=playwright.kho-bai-tap-ca-nhan-destructive.config.js
```

**Lịch sử chạy trên staging (2026-09-17, 2026-09-18) - lúc đó bị hiểu NHẦM là "FAIL/bug môi
trường", nay đọc lại theo RULE MỚI (xem cảnh báo đầu mục) thì đây chính là hành vi ĐÚNG**:

Chạy y hệt kịch bản trên nhưng với `SOURCE_BASE_URL="https://parrotedu-staging.parrotedu.vn"`,
`SOURCE_USERNAME="0912312312"`, `SOURCE_PERSONAL_BANK_CLASS="5D"` - cả 2 lần bản ghi "Bài tập đã
giao" đều biến mất và không quay lại trong 150s poll, trang edit vẫn load nhưng rỗng hoàn toàn:

| Lần | Item nguồn bị xóa | Room "Bài tập đã giao" | Kết quả quan sát | Đánh giá theo rule MỚI |
|---|---|---|---|---|
| 1 (2026-09-17) | `cd05ab0e-...` "Choose the best answer (A, B, C or D) to complete each sentence." | `8c80726e-...` | Biến mất, không quay lại | ĐÚNG |
| 2 (2026-09-18) | `a7febe61-becb-4d4f-970d-a3388006fd89` "Read the passage above again and decide whether each statement is True (T) or False (F)." (Khối 5 > UNIT 2: OUTDOOR ACTIVITY > READING) | `1b8e51b3-abf5-4b88-8878-2781840aaf15` | Biến mất, không quay lại | ĐÚNG |

**Kết luận đã CẬP NHẬT (2026-09-18)**: kết luận trước đây "staging thiếu fix của dev" bị **RÚT
LẠI** - staging trong 2 lần chạy này thực ra đã đúng theo rule mới ngay từ đầu, không phải bug. Cả
2 item nguồn dùng ở trên đã bị xóa vĩnh viễn thật (đã xin xác nhận user qua AskUserQuestion trước
mỗi lần chạy) - dữ liệu mất là thật, nhưng không còn được tính là "bằng chứng bug môi trường" nữa.

**Re-run trên DEV để xác nhận rule mới (2026-09-18) - PASS 3/3**: item disposable mới
`50814bba-634c-47ea-90f1-67338e230c0d` ("Read the passage above again and decide whether each
statement is True (T) or False (F).", Khối 11 > UNIT 2: OUTDOOR ACTIVITY > READING, lớp 11A2) -
giao bài, xóa item nguồn, bản ghi "Bài tập đã giao" biến mất **gần như ngay lập tức** (assertion
`.toBe(false)` pass ở lần poll đầu tiên, tổng bước cuối chỉ 3.9s) - **CÙNG hành vi với staging**,
không còn khoảng lệch môi trường nào giữa dev/staging cho case này nữa. Item nguồn đã bị xóa vĩnh
viễn thật (đã xin xác nhận user trước khi chạy).

**Nhân tiện xác nhận lại tag kỹ năng trên dev vẫn đúng** (đối lập với bug "luôn Other" của staging,
xem mục "⚠️ BUG THẬT PHÁT HIỆN TRÊN STAGING" đầu file): Khối 11 > UNIT 2 của tài khoản Phương có
PRONUNCIATION→Language, VOCABULARY AND GRAMMAR→Other, SPEAKING→Speaking, READING→Reading,
WRITING→Writing - đa dạng, tính đúng theo từng kỹ năng thật.

**Xác nhận thêm chiều APP trên staging (2026-09-18, theo yêu cầu trực tiếp user "tôi cài app trên
staging mà") - PASS 5/5**: script mới `e2e-personal-bank-delete-source-app-check.mjs` - GHÉP TỪ
các khối có sẵn ([[feedback_reuse_first_workflow]]), quan trọng nhất là TÁI SỬ DỤNG ĐÚNG cơ chế
scroll/tìm bài gốc của module "Bài tập" (`findAssignment()` + `scrollToTop()` từ
`automation/bai_tap/discovery/findAssignment.js` - `scrollToTop()` BẮT BUỘC gọi ngay trước mỗi lần
`findAssignment()`, nếu không có thể báo NOT_FOUND SAI vì `findAssignment()` chỉ cuộn 1 chiều
xuống). GV A (`0912312312`)/lớp 5D giao item "Choose the sentence (A, B, C or D) that is closest in
meaning to the given sentence." (id `cf9b28dc-9e64-4bed-bf2c-09067f0601b3`, Khối 5 > UNIT 2 >
WRITING) tới HS "Gia Linh" (room_id `6cc6c714-2145-4fff-94cc-bdbf2f8206a0`) → App HS xác nhận THẤY
đúng card trước khi xóa → xóa item nguồn thật → App HS xác nhận card BIẾN MẤT (status cuối
NOT_FOUND) - khớp đúng rule mới ở CẢ web lẫn app.

**Sự cố quy trình khi build script này (minh bạch lại, không phải bug sản phẩm)**: lượt chạy đầu
tiên (item `e89bdb8c-...` "Choose the word whose underlined part is pronounced differently from
the others.", PRONUNCIATION) bị dừng bằng tay (`TaskStop`) sau khi phát hiện script thiếu bước
`scrollToTop()` - nhưng do output bị Node buffer khi redirect qua `| tail`, không có log nào kịp
flush ra ngoài trước khi tiến trình bị dừng, nên KHÔNG thể xác nhận nó đã chạy tới đâu. Kiểm tra lại
"Kho đề cá nhân" sau đó cho thấy item `e89bdb8c-...` đã bị xóa vĩnh viễn THẬT (nhiều khả năng lượt
chạy đó thực ra đã hoàn tất tới bước xóa trước khi bị dừng) - không có bản ghi nào khớp tên này
trong "Bài tập đã giao" (khớp đúng rule mới nếu quy trình đã chạy trọn). Từ lượt 2 trở đi, chạy
KHÔNG qua `| tail` (redirect thẳng ra file) và không dừng giữa chừng nữa để tránh lặp lại tình huống
này.

---

## TC034: xóa bản ghi "Bài tập đã giao" qua "Chỉnh sửa giao bài tập" (đã Pass, khoá lại tránh regress)

Tự động hoá bằng Playwright Test - `flows/web/giao_bai_tap/kho_bai_tap_ca_nhan/delete-assigned-regression.spec.js`,
cùng config. AN TOÀN để chạy lặp lại nhiều lần (không đụng tới Kho bài tập cá nhân - chỉ
tạo+xóa 1 bản ghi "Bài tập đã giao", dùng lại item Kho cá nhân CÒN LẠI của lớp 11A2, không xóa
item nguồn nào).

**ĐÃ XÁC NHẬN THẬT (2026-09-16)**: giao bài "Choose the word whose underlined part is pronounced
differently from the others." (item còn lại, id `3fea1b0a-8d30-49c4-87ff-dfe41d26d541`) tới lớp
11A2 -> bản ghi id `2ad8b7c5-ec4c-4120-a057-2cc94dfe28a0` -> vào "Chỉnh sửa bài tập" của chính bản
ghi này, bấm "Xóa" -> dialog "Xóa bài tập" -> xác nhận -> toast "Xóa bài tập thành công" -> danh
sách "Bài tập đã giao" mất NGAY LẬP TỨC (không có độ trễ cache như TC033 - kiểm tra lại URL ngay
sau khi xóa, `stillHasDeletedId: false`) -> app HS (profile "Hoang Gia Minh") cũng không thấy dấu
vết nào của bản ghi này - đồng bộ đúng cả 2 phía, không regress.

Chạy:
```
cd automation
SOURCE_BASE_URL="https://parrotedu.codeinet.com" SOURCE_USERNAME="0915315315" \
SOURCE_PASSWORD="123456789" SOURCE_PERSONAL_BANK_CLASS="11A2" \
npx playwright test --config=playwright.kho-bai-tap-ca-nhan.config.js delete-assigned-regression
```

---

## TC021/022/024/025: Giao bài tập (submit) từ Kho bài tập cá nhân

Tự động hoá bằng Playwright Test - `flows/web/giao_bai_tap/kho_bai_tap_ca_nhan/assign-submit.spec.js`,
cùng config. AN TOÀN chạy lặp lại - không xóa gì, chỉ tạo bản ghi mới (TC021, hạn nộp random) và 1
lần Hủy không lưu (TC025).

**ĐÃ XÁC NHẬN THẬT (2026-09-16, chạy live qua chính script tự động hoá)**:
- TC022: bấm "Giao bài đã chọn" khi chưa tick bài nào -> cảnh báo đỏ "Vui lòng chọn bài tập" hiện
  ngay dưới tab Lesson, không có toast thành công - PASS.
- TC021: tick 1 item, "Giao bài đã chọn" -> toast thành công, bản ghi mới xuất hiện đúng lớp/hạn
  nộp trong "Bài tập đã giao" - PASS.
- TC024: mở lại bản ghi vừa giao (Chỉnh sửa bài tập) -> Nguồn/Lớp/Hạn nộp/Unit/item tick đều đúng,
  khớp lúc giao - PASS.
- TC025: tick 1 item rồi bấm "Hủy" -> quay về danh sách, số bản ghi "Bài tập đã giao" KHÔNG đổi
  (lựa chọn không được lưu) - PASS.

**BUG THẬT PHÁT HIỆN + SỬA TRONG QUÁ TRÌNH VIẾT TEST (2026-09-16)**: ban đầu nghi do "submit rỗng
trước đó trong session", nhưng sau khi điều tra sâu hơn (xem mục "⚠️ BUG THẬT DÙNG CHUNG" đầu file)
xác định nguyên nhân THẬT là chọn Lớp NGAY SAU KHI chọn radio "Kho bài tập cá nhân" có thể làm
chính radio đó bị revert âm thầm về KNTT - không liên quan gì tới việc có submit rỗng trước đó hay
không. Đã sửa bằng `selectPersonalBankClassStably()` (helper dùng chung, verify cả radio lẫn lớp
đồng thời) thay vì verify radio một lần riêng lẻ.

Cũng phát hiện: dò id bản ghi vừa tạo bằng cách so text (due date + lớp + tên bài) trong bảng
KHÔNG đáng tin cậy - tên bài tập KHÔNG unique giữa Bộ sách KNTT và Kho bài tập cá nhân (cùng 1
chuỗi tên có thể là 2 item hoàn toàn khác nhau, id khác nhau). Cách đúng: bắt response API
`create_room.json`, đọc `data.created_rooms[0].room_id` - id này CHÍNH LÀ id dùng trong URL
`/teacher/exercise/{room_id}/edit`.

Chạy:
```
cd automation
SOURCE_BASE_URL="https://parrotedu.codeinet.com" SOURCE_USERNAME="0915315315" \
SOURCE_PASSWORD="123456789" SOURCE_PERSONAL_BANK_CLASS="11A2" \
npx playwright test --config=playwright.kho-bai-tap-ca-nhan.config.js assign-submit
```

---

## TC032: Chỉnh sửa bài tập đã giao — giới hạn phạm vi được sửa

Tự động hoá bằng Playwright Test - `flows/web/giao_bai_tap/kho_bai_tap_ca_nhan/edit-lock-by-date.spec.js`,
cùng config. AN TOÀN chạy lặp lại - chỉ tạo bản ghi mới mỗi lần (không xóa).

**ĐÃ XÁC NHẬN THẬT (2026-09-16)**:
- Bản ghi có Thời gian giao = HÔM NAY: radio "Nguồn bài tập", checkbox lớp, combobox "Chọn Unit"
  đều có thuộc tính HTML `disabled` chuẩn (khóa đúng). Riêng trigger "Thời gian giao" KHÔNG có
  `disabled`/`aria-disabled` (khác cơ chế) - khóa được thực hiện qua JS chặn mở popover khi click
  (click xong, popover `role="menu"` không hiện) - đã verify bằng debug script riêng trước khi viết
  assertion đúng cơ chế này. "Hạn nộp" vẫn sửa được bình thường: đổi xuống bằng đúng Thời gian giao
  -> toast "Chỉnh sửa giao bài tập thành công", giá trị cập nhật đúng.
- Bản ghi có Thời gian giao = TƯƠNG LAI (test dùng +4 ngày): trigger "Thời gian giao" click được,
  popover mở bình thường - không bị khóa.

Chạy:
```
cd automation
SOURCE_BASE_URL="https://parrotedu.codeinet.com" SOURCE_USERNAME="0915315315" \
SOURCE_PASSWORD="123456789" SOURCE_PERSONAL_BANK_CLASS="11A2" \
npx playwright test --config=playwright.kho-bai-tap-ca-nhan.config.js edit-lock-by-date
```

**GIỚI HẠN**: chưa test riêng trường hợp cố đặt "Hạn nộp" SỚM HƠN "Thời gian giao" (phải bị chặn/
báo lỗi theo kỳ vọng) - xlsx gốc cũng ghi nhận đây là phần chưa test trực tiếp.

---

## TC009: Kho bài tập cá nhân chỉ hiển thị bài tập do chính GV đó tạo (phân quyền dữ liệu)

Tự động hoá bằng Playwright Test - `flows/web/giao_bai_tap/kho_bai_tap_ca_nhan/data-isolation.spec.js`,
cùng config. Test case quan trọng nhất về bảo mật/phân quyền dữ liệu theo đánh giá của tester gốc.
Dùng 2 `BrowserContext` song song (2 phiên GV độc lập) - CHỈ ĐỌC, an toàn chạy lặp lại.

**ĐÃ XÁC NHẬN THẬT (2026-09-16, chạy live qua chính script tự động hoá, ĐÃ re-run lại sau khi sửa
bug revert radio dùng chung - xem mục "⚠️ BUG THẬT DÙNG CHUNG" đầu file - để đảm bảo kết quả PASS
không phải false-pass do cả 2 GV cùng âm thầm fallback về dữ liệu KNTT dùng chung)**: GV A
(`0915315315`, "Phương", lớp 11A2, UNIT 1: LEISURE TIME) và GV B (`0985285285`, "Hoàng Kim Ngân" -
đúng tài khoản được nhắc trong TC_GBT_KBTCN_009/019 gốc, lớp 11E, UNIT 1: LEISURE TIME > Reading) -
dù CÙNG tên Unit hiển thị (trùng ngẫu nhiên), item id của 2 GV hoàn toàn KHÔNG giao nhau (verify
bằng `lesson-item-{catalogItemId}` thật, không so text) - PASS.

Chạy:
```
cd automation
SOURCE_BASE_URL="https://parrotedu.codeinet.com" \
SOURCE_USERNAME="0915315315" SOURCE_PASSWORD="123456789" SOURCE_PERSONAL_BANK_CLASS="11A2" \
SOURCE_USERNAME_2="0985285285" SOURCE_PASSWORD_2="123456789" SOURCE_PERSONAL_BANK_CLASS_2="11E" \
npx playwright test --config=playwright.kho-bai-tap-ca-nhan.config.js data-isolation
```

---

## TC013/014/015/016: Kết hợp lựa chọn Lớp ở Kho bài tập cá nhân

Tự động hoá bằng Playwright Test - `flows/web/giao_bai_tap/kho_bai_tap_ca_nhan/class-selection.spec.js`,
cùng config. CHỈ ĐỌC - an toàn chạy lặp lại. Dùng cặp lớp thật của GV "Phương": "11A2" (có dữ liệu)
/ "3E" (rỗng) - đúng cặp lớp tester gốc đã dùng để xác nhận các case này trong xlsx.

**ĐÃ XÁC NHẬN THẬT (2026-09-16, chạy live qua chính script tự động hoá)**:
- TC016: danh sách Lớp phụ trách (3E, 10D, 11A2) hiển thị GIỐNG NHAU ở cả 2 Nguồn bài tập - PASS.
- TC013: chọn Lớp "11A2" (có dữ liệu) ở Kho bài tập cá nhân -> khung "Chọn bài tập" hiện đúng
  Unit/Lesson/Danh sách bài tập - PASS.
- TC015: chọn Lớp "3E" (không có dữ liệu) -> "Chọn Lesson" báo "Chưa có lesson nào", KHÔNG có item
  nào để tick, không lỗi hệ thống, nút "Giao bài đã chọn" vẫn hiển thị bình thường - PASS.
- TC014: đổi lại Lớp "11A2" -> danh sách bài tập cập nhật lại đúng, có item để tick - PASS.

Chạy:
```
cd automation
SOURCE_BASE_URL="https://parrotedu.codeinet.com" SOURCE_USERNAME="0915315315" \
SOURCE_PASSWORD="123456789" SOURCE_PERSONAL_BANK_CLASS="11A2" SOURCE_EMPTY_CLASS="3E" \
npx playwright test --config=playwright.kho-bai-tap-ca-nhan.config.js class-selection
```

---

## TC017/018/019: Tick chọn nhiều bài tập + Xem chi tiết

Tự động hoá bằng Playwright Test - `flows/web/giao_bai_tap/kho_bai_tap_ca_nhan/tick-and-detail.spec.js`,
cùng config. CHỈ ĐỌC - an toàn chạy lặp lại. Dùng tài khoản GV thứ 2 ("Hoàng Kim Ngân", lớp 11E) vì
đã xác nhận có ≥2 item thật cùng 1 Lesson (Unit 1: Leisure Time > Reading).

**ĐÃ XÁC NHẬN THẬT (2026-09-16)**:
- TC017: tick 2 checkbox liên tiếp -> cả 2 CÙNG giữ trạng thái đã chọn đồng thời, tick mục sau
  không làm mất tick mục trước - PASS.
- TC018: "Xem chi tiết" mở 1 **MODAL preview nội dung/câu hỏi ngay tại chỗ** - KHÔNG điều hướng
  sang trang khác. Đây là hành vi khớp với mô tả GỐC (chưa đính chính) của TC018 trong xlsx - ghi
  chú "ĐÍNH CHÍNH" trong xlsx (nói "Xem chi tiết" đưa vào màn "Chỉnh sửa bài tập") có thể đang mô
  tả 1 luồng khác (vd click từ icon sửa trong "Kho đề cá nhân", không phải từ form Giao bài tập) -
  CHƯA xác minh lại luồng đó. Modal hiển thị đúng tiêu đề bài tập đã chọn - PASS.
- TC019: đếm số "Câu N" thật hiển thị trong modal, khớp CHÍNH XÁC với badge "N câu hỏi" hiển thị
  cạnh bài tập trong danh sách - PASS.

**BUG THẬT QUAN TRỌNG PHÁT HIỆN RA TỪ CHÍNH FILE NÀY (2026-09-16)**: lần chạy đầu tiên, modal "Xem
chi tiết" mở ra hiển thị SAI hoàn toàn - tiêu đề "BTCB 1" (1 bài thuộc Bộ sách KNTT) thay vì đúng
item Kho bài tập cá nhân vừa tick. Đây chính là bằng chứng dẫn tới phát hiện bug revert radio dùng
chung (xem mục "⚠️ BUG THẬT DÙNG CHUNG" đầu file) - đã sửa bằng `selectPersonalBankClassStably()`.

Cũng phát hiện: nội dung modal ("Câu N") load DẦN, không có ngay khi modal vừa `visible` - phải
`expect.poll` chờ đủ số câu như badge, đọc 1 lần duy nhất ngay sau khi modal hiện có thể ra 0.

Chạy:
```
cd automation
SOURCE_BASE_URL="https://parrotedu.codeinet.com" \
SOURCE_USERNAME_2="0985285285" SOURCE_PASSWORD_2="123456789" SOURCE_PERSONAL_BANK_CLASS_2="11E" \
npx playwright test --config=playwright.kho-bai-tap-ca-nhan.config.js tick-and-detail
```

---

## TC011 + TC031: Màn hình quản lý "Kho đề cá nhân" (`kho-de-ca-nhan-management.spec.js`)

CHỈ ĐỌC - an toàn chạy lặp lại. Dùng tài khoản GV thứ 2 "_2" (Ngân, 11E - giống tick-and-
detail.spec.js).

**TC031** (Nhóm 8, hồi quy): bấm menu "Kho đề cá nhân" từ màn Giao bài tập -> điều hướng đúng sang
`/teacher/quiz`, hiển thị "Tổng số: N khối" + đủ Khối 1-12. Xác nhận LIVE PASS 2026-09-16.

**TC011** (Nhóm 3, phân quyền dữ liệu - đối chiếu số lượng/nội dung): danh sách bài tập hiển thị ở
"Giao bài tập" > "Kho bài tập cá nhân" phải khớp đúng dữ liệu gốc ở "Kho đề cá nhân" (menu quản lý
riêng). Cách làm: đọc tên Unit + tiêu đề item TỪ "Giao bài tập" trước (không đoán/hardcode), sau đó
sang "Kho đề cá nhân" tìm ĐÚNG Unit đó (suy ra khối từ chữ số đầu tên lớp, vd "11E" -> Khối 11) rồi
đối chiếu tiêu đề.

Phát hiện thật khi viết test (2026-09-16): **id của cùng 1 item KHÁC NHAU giữa 2 màn hình** -
`lesson-item-{id}` ở "Giao bài tập" không khớp id trong href "Sửa nội dung đề" ở "Kho đề cá nhân"
(2 tầng id khác nhau cho cùng 1 nội dung, giống pattern examId-mismatch đã gặp ở module khác - xem
[[project_teacher_materials_examid_order_mismatch]]). KHÔNG so khớp theo id được ở đây - phải so
khớp theo TIÊU ĐỀ (đúng cách tester gốc đã làm thủ công qua ảnh chụp). Text combobox Unit ở "Giao
bài tập" hiển thị NGUYÊN VĂN VIẾT HOA TOÀN BỘ trùng khớp 100% format hiển thị Unit ở "Kho đề cá
nhân" (vd "UNIT 1: LEISURE TIME" cả 2 nơi) - tiện lợi, không cần chuẩn hoá hoa/thường.

Bug nhỏ khi viết (đã fix, KHÔNG phải bug sản phẩm): đọc DOM ngay sau khi bấm mở Lesson bắt được 0
item dù item đã render đầy đủ ngay sau đó - race giữa click và re-render (cùng loại race đã gặp
khắp module này) - fix bằng cách chờ link "Sửa nội dung đề" đầu tiên xuất hiện trước khi đọc.
Xác nhận LIVE PASS 2026-09-16.

## TC030: Hồi quy Bộ sách Kết nối tri thức (`kntt-source-regression.spec.js`)

**TC030** (Nhóm 8, hồi quy) - luồng "Bộ sách Kết nối tri thức" (nguồn MẶC ĐỊNH, có từ trước khi bổ
sung "Kho bài tập cá nhân") không bị ảnh hưởng: chọn lớp, Unit/Lesson mặc định tự chọn sẵn (KHÔNG
hardcode tên Unit/Lesson cụ thể - dữ liệu dev có thể đổi), tick 2 bài tập, giao bài thành công (bắt
`create_room.json` lấy `room_id` giống pattern TC021). Dọn dẹp: xóa bản ghi vừa tạo ngay sau đó qua
"Chỉnh sửa giao bài tập" (pattern giống hệt TC034) để không cộng dồn rác mỗi lần chạy regression.
Xác nhận LIVE PASS 2026-09-16 (tài khoản Phương, lớp 11A2).

## TH1/TH2 (bổ sung 2026-09-17, KHÔNG có trong xlsx gốc): sửa tên đề trong Kho bài tập cá nhân

Yêu cầu bổ sung của user: kiểm tra tiêu đề hiển thị ở "Bài tập đã giao" (web + app) khi sửa TÊN ĐỀ
của 1 item trong Kho bài tập cá nhân, tuỳ theo THỜI ĐIỂM sửa so với thời điểm giao bài:
- **TH1**: đã giao bài (tiêu đề CŨ) -> sửa tên đề -> "Bài tập đã giao" VẪN hiển thị tiêu đề CŨ.
- **TH2**: sửa tên đề TRƯỚC -> giao bài -> "Bài tập đã giao" hiển thị tiêu đề MỚI.

Tự động hoá bằng Playwright Test (PHÍA WEB) -
`flows/web/giao_bai_tap/kho_bai_tap_ca_nhan/source-title-edit-propagation.spec.js`, cùng config
`playwright.kho-bai-tap-ca-nhan.config.js` (KHÔNG destructive - sửa tên đề CÓ THỂ phục hồi, mỗi test
tự phục hồi `SOURCE_ITEM_TITLE` gốc trong khối `finally` + tự xoá bản ghi "Bài tập đã giao" vừa tạo
qua đúng flow TC034, nên nằm chung config với các spec an toàn khác, không cần config destructive
riêng như TC033).

**ĐÃ XÁC NHẬN THẬT 2 LẦN (2026-09-17)** - lần 1 thao tác tay qua browser (trước khi viết spec, để
biết chắc UI + endpoint thật), lần 2 chạy chính spec tự động hoá (PASS 2/2, ~61s), tài khoản GV
Phương `0915315315`, lớp 11A2, item `3fea1b0a-8d30-49c4-87ff-dfe41d26d541` ("Choose the word whose
underlined part is pronounced differently from the others.", Khối 11 > UNIT 2: OUTDOOR ACTIVITY >
Other/PRONUNCIATION - item DÙNG CHUNG với nhiều spec khác trong module, an toàn vì luôn phục hồi
tên gốc ngay sau mỗi test):
- **TH1 ĐÚNG như kỳ vọng (không phải bug)**: giao bài xong (room `710759fa-...`, tiêu đề gốc) rồi
  sửa tên đề thành `...[TH1-EDITED]` -> "Bài tập đã giao" VẪN hiển thị tiêu đề GỐC, không đổi theo -
  xác nhận NGAY LẬP TỨC (không có độ trễ cache như bug TC033 cũ).
- **TH2 ĐÚNG như kỳ vọng**: sửa tên đề thành `...[TH1-EDITED]` TRƯỚC, rồi giao bài MỚI (room
  `53eb53f7-...`) -> "Bài tập đã giao" hiển thị ĐÚNG tiêu đề MỚI đó.
- Kết luận: "Bài tập đã giao" đọc "tên bài" như 1 **SNAPSHOT tại thời điểm giao** (không link sống
  tới tên đề gốc trong Kho bài tập cá nhân) - sửa tên đề chỉ ảnh hưởng các lượt giao MỚI SAU thời
  điểm sửa, không ảnh hưởng ngược lại các bản ghi đã giao trước đó.

**Phát hiện kiến trúc (khảo sát Network lúc thao tác tay)**: lưu "Tên đề" ở
`/teacher/quiz/{id}/edit` gọi `PATCH .../api/user/exams/update_room.json` - cùng họ endpoint
"exams"/"room" với "Bài tập đã giao" (`GET .../api/user/exams/room.json`, xem
`automation/bai_tap/discovery/homeworks.js`), và còn kéo theo `PUT
.../api/user/materials/lesson-items/{lessonItemId}` - xác nhận thêm chuỗi id 3 tầng cho CÙNG 1 item:
`quiz id` (URL "Sửa nội dung đề") -> `room id` nội bộ -> `lesson-item id` (= id checkbox
`lesson-item-{id}` ở form "Giao bài tập") - cùng loại kiến trúc "1 nội dung, nhiều id theo màn hình"
đã ghi nhận ở TC011/TC033.

**GIỚI HẠN - CHƯA verify phía APP**: user xác nhận thiết bị test đang dùng cho môi trường
production tại thời điểm viết (2026-09-17), nên KHÔNG chuyển profile/tài khoản trên thiết bị để
kiểm tra - để lại làm sau, cùng loại gap với TC023 (cần 1 flow Maestro riêng, tái dùng
`collectVisibleHomeworkCards()`/`automation/bai_tap/discovery/homeworkUiList.js` để đọc tiêu đề card
thật hiển thị trên app học sinh "Hoang Gia Minh"/`0987652170`/11A2, đối chiếu game/due-date để định
vị đúng room).

Chạy:
```
cd automation
SOURCE_BASE_URL="https://parrotedu.codeinet.com" SOURCE_USERNAME="0915315315" \
SOURCE_PASSWORD="123456789" SOURCE_PERSONAL_BANK_CLASS="11A2" \
SOURCE_ITEM_ID_FOR_TITLE_EDIT="3fea1b0a-8d30-49c4-87ff-dfe41d26d541" \
SOURCE_ITEM_TITLE="Choose the word whose underlined part is pronounced differently from the others." \
SOURCE_ITEM_UNIT="UNIT 2: OUTDOOR ACTIVITY" SOURCE_ITEM_ASSIGN_LESSON="Other" \
npx playwright test --config=playwright.kho-bai-tap-ca-nhan.config.js source-title-edit-propagation
```

---

## TC023: Học sinh nhận đúng bài tập được giao từ kho cá nhân (`e2e-personal-bank-assign-student-open.mjs`)

Tự động hoá bằng 1 script Node ghép nối (KHÔNG phải Playwright Test/Maestro yaml thuần) - GHÉP
TỪ các khối đã có sẵn, không viết logic mới ([[feedback_reuse_first_workflow]]):
- Web GV: `loginTeacherPortal()` + `selectPersonalBankClassStably()` + `setDueDateViaPopover()` +
  bắt `create_room.json` - đúng pattern các spec khác trong module, chỉ đổi transport (chạy như CLI
  độc lập thay vì Playwright Test fixture) để gọi được từ 1 script kết hợp cả web lẫn app.
- App HS: `flows/app/helpers/ensure-profile-active.yaml` (xác nhận đúng hồ sơ, KHÔNG hard switch
  mù) + `findAssignment()`/`MaestroMcpSession` (`automation/bai_tap/discovery/`, target-driven,
  không phụ thuộc số lượng assignment) + `flows/app/helpers/open-exercise.yaml` (bấm "Làm bài" xác
  nhận màn làm bài mở đúng).

**ĐÃ XÁC NHẬN PASS live trên STAGING (2026-09-18)**: GV A (`0912312312`, lớp **5D**) giao bài
"Read the passage and choose the best answer (A, B, C or D) for each question." (room_id
`f78e7755-5845-4037-8a3a-6cef16f137e7`) -> HS "Gia Linh" (`0915775115`, cùng lớp 5D) - App tìm
thấy ĐÚNG card (đúng tiêu đề + Hạn nộp 21/09) sau 1 lượt cuộn, không ambiguous - bấm "Làm bài" mở
đúng màn làm bài thật (`exercise_close_button` visible).

Chạy:
```
SOURCE_BASE_URL="https://parrotedu-staging.parrotedu.vn" SOURCE_USERNAME="0912312312" \
SOURCE_PASSWORD="123456789" SOURCE_PERSONAL_BANK_CLASS="5D" \
PHONE="0915775115" OTP="888888" PROFILE_NAME="Gia Linh" \
node flows/web/giao_bai_tap/kho_bai_tap_ca_nhan/e2e-personal-bank-assign-student-open.mjs
```

**Trên DEV** (`https://parrotedu.codeinet.com`): cặp tài khoản GV-HS đã biết là Phương
(`0915315315`)/11A2 + HS "Hoang Gia Minh" (`0987652170`) - chưa chạy lại script này trên dev, chỉ
mới xác nhận PASS trên staging.

**Re-run 2026-09-18 (kèm kiểm tra CẢ 2 bộ lọc theo yêu cầu user) - PASS, sau 1 lần báo động giả**:
giao item mới (room `1310f968-...`, "Choose the word whose underlined part is pronounced
differently from the others.", due 21/09) tới cùng cặp GV A/Gia Linh/5D - `findAssignment()` (đã có
`scrollToTop()` đúng cách, `atTop:true`) báo NOT_FOUND/END_OF_LIST ở CẢ 2 bộ lọc NGAY SAU KHI giao -
ban đầu nghi là bug "room vô hình" đã biết ([[project_new_room_invisible_in_homework_list_bug]]),
nhưng user kiểm tra lại trực tiếp trên thiết bị ngay sau đó và xác nhận **card ĐÃ HIỂN THỊ đúng**
(tiêu đề, Hạn nộp 21/09, 0/10, nút "Làm bài") - đã RÚT LẠI kết luận bug, nhiều khả năng chỉ là độ
trễ đồng bộ ngắn giữa lúc tạo room và lúc app render (không đủ để tự tin gọi là bug "vĩnh viễn
invisible" như lần 2026-09-03 - xem chi tiết trong memory). Bài học quy trình: automation nên đợi
thêm rồi kiểm tra lại trước khi báo NOT_FOUND là bug thật, không kết luận ngay từ 1 lần đọc.

**Xác nhận PASS đầy đủ bằng tay (bước 4/4 - mở bài)**: phát hiện thêm 1 chi tiết thật khi xác nhận
tay - có 2 bản ghi TRÙNG TIÊU ĐỀ trong danh sách ("Choose the word whose underlined part is
pronounced differently from the others.", 1 due 18/09 và 1 due 21/09 - do 2 lượt chạy khác nhau
trong phiên này đều "tick checkbox đầu tiên" trùng đúng item PRONUNCIATION của Unit 3) - đây CHÍNH
LÀ lý do `flows/app/helpers/open-exercise.yaml` (dùng `scrollUntilVisible` theo title + `Below` theo
Hạn nộp, KHÔNG có logic target-driven như `findAssignment()`) báo assertion FAILED (khớp nhầm bản
ghi 18/09). Xác nhận bằng tay: bấm đúng "Làm bài" ở thẻ 21/09 (phân biệt bằng vị trí + Hạn nộp) ->
mở đúng nội dung thật (Q1/10: heavy/bread/meat/ready) - TC023 PASS đầy đủ cả 4 bước.

---

## TC010: GV thứ 3 hoàn toàn chưa có bài tập nào trong kho cá nhân (`empty-personal-bank-account.spec.js`)

Tự động hoá bằng Playwright Test - CHỈ ĐỌC, an toàn chạy lặp lại. Tài khoản GV thứ 3 do user cung
cấp trực tiếp (2026-09-18): `84936021880`/`123456789` - hiển thị tên **"GV-Nga"**, chỉ quản lý
DUY NHẤT 1 lớp **"6C"**, xác nhận `.env` khớp bằng cách thử login cả 3 môi trường - **hoạt động
trên staging và production, THẤT BẠI trên dev** (`parrotedu.codeinet.com`). Đã dùng bản staging.

Xác nhận trực tiếp qua browser trước khi viết spec: chọn "Kho bài tập cá nhân" + lớp "6C" ->
"Chọn Unit" mở dropdown nhưng KHÔNG có option nào (khác hẳn TC015 - lớp rỗng trong 1 tài khoản VẪN
CÒN Unit ở lớp khác) - đây mới đúng 100% precondition gốc của TC010 ("GV hoàn toàn CHƯA CÓ bài tập
nào trong kho cá nhân", không phải "1 lớp cụ thể rỗng").

**ĐÃ XÁC NHẬN PASS (2026-09-18)**: chọn nguồn + lớp "6C" -> "Chọn Unit" hiển thị được (không kẹt ở
placeholder "chọn lớp trước"), "Chọn Lesson" báo "Chưa có lesson nào", 0 checkbox bài tập, KHÔNG
lỗi hệ thống/trắng trang, nút "Giao bài đã chọn" vẫn hiển thị bình thường.

Chạy:
```
cd automation
SOURCE_BASE_URL="https://parrotedu-staging.parrotedu.vn" SOURCE_USERNAME="84936021880" \
SOURCE_PASSWORD="123456789" SOURCE_EMPTY_ACCOUNT_CLASS="6C" \
npx playwright test --config=playwright.kho-bai-tap-ca-nhan.config.js empty-personal-bank-account
```

---

## TC026: Xóa item nguồn ngay khi đang được tick ở tab khác (`delete-source-while-selected-race.spec.js`)

Tự động hoá bằng Playwright Test, 2 `page` cùng 1 `browser.newContext()` (Tab A tick item, Tab B
xóa item đó, quay lại Tab A không reload rồi submit) - RACE 2-TAB THẬT, khác hẳn bằng chứng gốc
trong xlsx (chỉ test luồng tuần tự: xóa xong MỚI quay lại màn Giao bài tập, trang tự nhiên
reload/re-fetch). **PHÁ HUỶ THẬT** - dùng chung config destructive với TC033
(`playwright.kho-bai-tap-ca-nhan-destructive.config.js`).

**ĐÃ XÁC NHẬN PASS (2026-09-18)** - thao tác tay trước (GV A `0912312312`, lớp 5D staging, item
`e66648b7-...` "Choose the correct sentence..." WRITING), sau đó chạy lại qua script với item mới
`e1d9adf9-...` "Choose the word that has a different stress pattern from the others." (UNIT 3: FREE
TIME > PRONUNCIATION) - PASS 3/3 cả 2 lần: `POST create_room.json` trả **HTTP 500**
`{"status":false,"message":"Failed to create rooms","error":"no assignable lesson items found for
lesson_item_ids","error_code":"INTERNAL_ERROR"}`, UI hiện toast đỏ tiếng Anh thô, KHÔNG tạo bản ghi
"Bài tập đã giao" nào (đếm tổng trước/sau không đổi), trang không crash. Kết luận: backend chặn
đúng, không tạo dữ liệu hỏng - PASS theo đúng acceptance criteria gốc.

**Finding phụ (UX/API-design, đã báo user, KHÔNG chặn PASS)**: nên trả lỗi 4xx thay vì 500 (đây là
lỗi input hợp lệ - item không còn tồn tại - không phải lỗi hệ thống), và thông báo nên dịch tiếng
Việt (vd "Không giao được bài tập, vui lòng tải lại trang và thử lại") thay vì "Failed to create
rooms" nguyên văn tiếng Anh.

Chạy:
```
cd automation
SOURCE_BASE_URL="https://parrotedu-staging.parrotedu.vn" SOURCE_USERNAME="0912312312" \
SOURCE_PASSWORD="123456789" SOURCE_PERSONAL_BANK_CLASS="5D" \
SOURCE_ITEM_ID_TO_DELETE="<uuid item disposable>" SOURCE_ITEM_TITLE="<tiêu đề item>" \
SOURCE_ITEM_UNIT="<Unit chứa item>" SOURCE_ITEM_ASSIGN_LESSON="<tag kỹ năng>" \
SOURCE_ITEM_MANAGEMENT_LESSON="<tên Lesson ở Kho đề cá nhân>" \
npx playwright test --config=playwright.kho-bai-tap-ca-nhan-destructive.config.js delete-source-while-selected-race
```

---

## ⚠️ BUG THẬT NGHIÊM TRỌNG XÁC NHẬN (2026-09-18) - Học sinh MỚI join lớp SAU khi xóa item nguồn vẫn thấy bản ghi "ma"

**Phát hiện gốc**: user quan sát trực tiếp trên app thật (profile "Long"/lớp 11A2, ảnh chụp màn
hình) - 1 học sinh mới được duyệt vào lớp thấy 2 bản ghi "Bài tập" hiển thị **rỗng hoàn toàn** (0/0,
không tiêu đề) với Hạn nộp "Hôm nay". Nghi vấn: đây là các bản ghi mà item nguồn trong Kho bài tập
cá nhân ĐÃ BỊ XÓA - đáng lẽ theo rule TC033 (xem mục trên) phải BIẾN MẤT hoàn toàn, nhưng lại "rò
rỉ" ra cho học sinh MỚI join lớp SAU thời điểm xóa (khác với học sinh ĐÃ ở trong lớp từ trước, vốn
đã xác nhận đúng KHÔNG còn thấy).

**Tái hiện thành công bằng script tự động hoá mới** -
`e2e-new-joiner-sees-deleted-source-assignment.mjs` - GHÉP TỪ 3 khối module khác nhau, không viết
logic mới ([[feedback_reuse_first_workflow]]):
1. Giao 1 item Kho bài tập cá nhân tới lớp **"5X-RKLRejoin2"** (staging, id
   `db7ae7b7-ead9-4fd0-841d-7c1c13c5d57a`, tài khoản GV `0912312312` - lớp test riêng của module
   `roi_khoi_lop`, tách biệt lớp "5D" đang dùng cho các case khác), Hạn nộp XA (+30 ngày, chắc chắn
   còn hạn) - Y HỆT pattern `delete-source-regression.spec.js`.
2. Xóa item nguồn (PHÁ HUỶ THẬT) - Y HỆT pattern TC033.
3. **SAU KHI đã xóa**, tạo 1 profile con mới (`RKL-12_19-step1-request-join-known-class.yaml`) gửi
   yêu cầu vào ĐÚNG lớp đó, GV duyệt qua `approveStudentRequestFlow.js`
   (`automation/quan_ly_lop_hoc/`) - thứ tự thời gian ĐÚNG với kịch bản user báo (item bị xóa TRƯỚC
   khi học sinh mới vào, không phải ngược lại).
4. Chuyển app sang profile mới (`ensure-profile-active.yaml`), mở tab "Bài tập".

**KẾT QUẢ: BUG XÁC NHẬN THẬT (ảnh chụp màn hình thật)** - profile mới ("QA Auto Child
20260918_132120") thấy **2 bản ghi "0/0", tiêu đề RỖNG**: 1 chính là room vừa tạo ở bước 1
(`73a63895-...`, Hạn nộp 18/10 - khớp đúng +30 ngày từ hôm nay) VÀ 1 bản ghi cũ khác (Hạn nộp
20/09, tồn đọng từ trước, KHÔNG thuộc lượt chạy này) - xác nhận đây là lỗi **lặp lại nhất quán**,
không phải ngẫu nhiên 1 lần.

**Kết luận**: hành vi "ẩn bản ghi khi xóa item nguồn" (rule TC033) chỉ áp dụng ĐÚNG cho học sinh ĐÃ
ở trong lớp tại thời điểm xóa (query lúc đó loại bỏ đúng) - nhưng KHÔNG được áp dụng lại khi tính
danh sách "Bài tập" cho 1 thành viên MỚI join lớp sau đó (rất có thể do cơ chế cache/snapshot theo
lớp tại thời điểm join, không tính lại theo trạng thái item nguồn hiện tại) - dẫn tới lộ ra bản ghi
rỗng/hỏng cho học sinh mới. Đây là bug PRODUCT thật, mức độ nghiêm trọng (hiển thị dữ liệu hỏng cho
người dùng thật) - **CẦN báo dev/PM ngay**, chưa báo tại thời điểm viết.

**Ghi chú kỹ thuật phụ**: `approveStudentRequestFlow.js` FAIL ở lần gọi đầu tiên (timeout mở dialog
"Yêu cầu chờ duyệt", 10s) nhưng PASS ngay ở lần gọi lại thứ 2 với data giống hệt - có vẻ là flaky
timing, chưa rõ nguyên nhân sâu, chưa sửa (không thuộc phạm vi sở hữu của module này).

Chạy:
```
SOURCE_ITEM_ID_TO_DELETE="<uuid item disposable ở Khối 5>" SOURCE_ITEM_TITLE="<tiêu đề item>" \
SOURCE_ITEM_UNIT="<Unit chứa item>" SOURCE_ITEM_ASSIGN_LESSON="<tag kỹ năng>" \
SOURCE_ITEM_MANAGEMENT_LESSON="<tên Lesson ở Kho đề cá nhân>" \
PHONE="0915775115" OTP="888888" \
node flows/web/giao_bai_tap/kho_bai_tap_ca_nhan/e2e-new-joiner-sees-deleted-source-assignment.mjs
```

---

## TC027 (chưa tự động hoá)

Xem plan gốc (`plan_KHOBAITAP.md`) mục 1 nhóm 7 để biết phân loại/độ ưu tiên.

- **TC027** (hiệu năng khi kho cá nhân có >100 bài tập): không môi trường nào (dev/staging) có Unit
  nào đủ >100 item để test tải trực tiếp - xlsx tự nhận đây là suy luận của tester (cơ chế cuộn
  không phụ thuộc số lượng), không phải đo thật. Không có giá trị tự động hoá cho tới khi có dữ
  liệu thật đủ lớn.

Thêm case mới vào đây theo mẫu "## TCxxx" ở trên khi tự động hoá.
