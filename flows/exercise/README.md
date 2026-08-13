# Bộ case LÀM BÀI (EX-\*)

Kiểm luồng làm bài tập: chọn đáp án, làm đúng, làm sai, thử lại, thoát giữa bài.

## Bắt buộc: build phải bật cờ E2E

Các case dựa vào testID có mang tính đúng/sai của đáp án. testID đó **chỉ tồn tại
khi build có `EXPO_PUBLIC_E2E=1`**:

```bash
EXPO_PUBLIC_E2E=1 npx expo run:ios --device <UDID> --configuration Release
```

Cờ tắt (mặc định, kể cả build EAS production) thì id rút về `exercise_answer_{i}`
không hậu tố, và mọi case dựa vào `_correct` / `_wrong` sẽ **skip** (bọc trong
`runFlow.when`) chứ không fail giả.

Lý do gate: id mang đáp án đúng đọc được qua accessibility tree — ship lên
production là lộ đáp án. Xem [constants/e2e.ts](../../constants/e2e.ts).

## Bảng testID

| testID | Ở đâu | Dùng để |
| --- | --- | --- |
| `exercise_answer_{i}_correct` | ô đáp án đúng thứ i | tap để trả lời đúng |
| `exercise_answer_{i}_wrong` | ô đáp án sai thứ i | tap để trả lời sai |
| `exercise_answer_{i}` | ô đáp án (khi tắt cờ E2E) | tap theo vị trí |
| `exercise_check_button` | nút chính ở footer | Kiểm tra / Tiếp tục / Thử lại |
| `exercise_result_correct` | nhãn "Chính xác" | chốt là app báo đúng |
| `exercise_result_incorrect` | nhãn "Chưa chính xác" | chốt là app báo sai |
| `exercise_explain_button` | nút "Giải thích thêm" | mở gợi ý |
| `exercise_show_answer_next_button` | nút tiếp ở màn xem đáp án | điều hướng |
| `exercise_fillword_input` | ô nhập của câu điền từ | gõ đáp án |
| `exercise_fillword_check_button` | nút Kiểm tra của câu điền từ | chốt câu |
| `exercise_fillword_next_button` | nút sang ô trống kế tiếp | nhiều ô trống |
| `exercise_connect_left_{i}` / `exercise_connect_right_{i}` | ô nối trái/phải | nối cặp |
| `exercise_connect_right_{j}_for_left_{i}` | ô nối cột phải, là cặp ĐÚNG của trái thứ i (chỉ khi bật cờ E2E) | nối đúng cặp — `helpers/solve-connect.yaml` |
| `exercise_close_button` | nút X trên header | thoát giữa bài |

Mọi ô đáp án còn khai `accessibilityState.selected` → kiểm trạng thái đã chọn
không cần dựa vào màu.

### Bảng testID nhận diện DẠNG CÂU (dùng bởi `helpers/goto-question-type.yaml`, KHÔNG bị gate bởi cờ E2E)

| testID KHUNG | Dạng câu | Ghi chú |
| --- | --- | --- |
| `exercise_answer_list_one` | ONE | 1 đáp án |
| `exercise_answer_list_multi` | MULTI | nhiều đáp án |
| `exercise_answer_list_true_false` | TRUE_FALSE | đúng 2 lựa chọn |
| `exercise_connect_left_0` | CONNECT | cột trái, xem bảng chính |
| `exercise_fillword_blanks` | FILL_WORD | khung câu điền từ |
| `exercise_drag_drop_area` | DRAG_DROP | khung kéo thả |
| `exercise_sentence_builder_area` | SENTENCE_BUILDER | khung ghép câu |
| `exercise_sort_area` | SORT | khung sắp xếp |
| `exercise_speak_section` | SPEAK | khung đọc/nói |
| `exercise_dragdrop_options` / `exercise_dragdrop_option_{i}` / `exercise_dragdrop_zone_{n}` / `exercise_dragdrop_zone_{n}_filled` | DRAG_DROP | tap chip -> tự điền ô trống đầu tiên còn rỗng (`DragDropAnswer2.selectAnswerAuto`) |
| `exercise_sentence_builder` / `exercise_sentence_word_{i}` | SENTENCE_BUILDER | tap từ -> đẩy xuống cuối hàng trả lời (`SentenceBuilder.tsx:526`) |
| `exercise_sort_word_{i}` / `exercise_question_header` | SORT | CHỈ dùng để assert render, không giải được câu bằng tap (xem mục "KHÔNG kiểm được") |
| `exercise_speak_record_button` / `exercise_speak_stop_button` / `exercise_speak_cancel_button` / `exercise_speak_result_sheet` | SPEAK | vòng đời nút ghi âm |

Nếu build đang test CHƯA có các id khung này, mọi case `EX-14..EX-21` (bộ
"theo từng dạng câu") sẽ BLOCKED ngay ở `goto-question-type.yaml` — đó là do
thiếu id trên bản build, không phải lỗi app. Xem mục dưới.

## Danh sách case

| Case | Nội dung |
| --- | --- |
| EX-01 | trả lời đúng → báo "Chính xác" |
| EX-02 | sai lần 1 → báo sai + hiện "Thử lại" |
| EX-03 | sai → Thử lại → chọn đúng → báo đúng |
| EX-04 | sai 2 lần → hết lượt Thử lại, chuyển "Tiếp tục" |
| EX-05 | MULTI chọn hết đáp án đúng → báo đúng |
| EX-06 | MULTI chọn thiếu → phải báo sai |
| EX-07 | điền từ sai → báo sai |
| EX-08 | nối cặp → hoàn thành cơ chế |
| EX-09 | trạng thái đã chọn của ô đáp án |
| EX-10 | làm đúng hết bài → ra màn kết quả |
| EX-11 | thoát giữa bài rồi vào lại |
| EX-12 | SPEAKING: bật mic -> chờ ghi âm -> tắt mic gửi -> hiện popup kết quả (chỉ kiểm luồng UI, không kiểm điểm phát âm) |
| EX-13 | Sentence Builder (Vui học, Unit 9 "practical"): dispatcher (`answer-current-exercise-generic.yaml`) phải nhận diện màn hình ngay và báo `BLOCKED_MISSING_UI_EVIDENCE`, không timeout mù. Case này CHỦ ĐÍCH FAIL (giống quy ước EX-12) - xem `flows/helpers/answer-sentence-builder-question.yaml`. |

## Bộ case theo TỪNG DẠNG CÂU (EX-14..EX-21) — chạy được trên BẢN BUILD STORE

Bổ sung sau khi đối chiếu với bộ flow `maestro_4` (nguồn khác, cùng test app
Parrot): bộ đó phát hiện khung danh sách đáp án/khung câu mang theo id riêng
cho từng dạng câu (`constants/e2e.ts` -> `answerListTestID` và tương đương cho
DRAG_DROP/SENTENCE_BUILDER/SORT/SPEAK), và các id khung này KHÔNG bị gate bởi
`EXPO_PUBLIC_E2E` — nên viết được case riêng cho từng dạng mà chạy được trên cả
bản build store. Xem `helpers/goto-question-type.yaml`.

Không case nào dưới đây dùng id bị gate bởi `EXPO_PUBLIC_E2E`.

| Case | Dạng câu | Chốt được gì |
| --- | --- | --- |
| EX-14 | TRUE_FALSE | **chấm điểm ĐÚNG** — vét cạn 2 lựa chọn nên kết quả cuối bắt buộc là "Chính xác" |
| EX-15 | ONE | cơ chế chấm: đúng 1 nhãn kết quả, hai nhãn loại trừ nhau, chọn ô mới bỏ chọn ô cũ, sai lần 1 có "Thử lại" / lần 2 hết |
| EX-16 | MULTI | chọn nhiều ô cùng lúc, tap lại để bỏ chọn, chấm ra nhãn kết quả |
| EX-17 | DRAG_DROP | tap chip → điền ô trống, tap ô đã điền → gỡ ra, điền kín → chấm |
| EX-18 | SENTENCE_BUILDER | tap từ để ghép, ghép xong → chấm (đường vào KHÁC EX-13, xem ghi chú trong file) |
| EX-19 | CONNECT | nối kín hết ô (biến thể V2 của tab Bài tập, không cần cờ E2E khác EX-08) → chấm |
| EX-20 | SORT | **chỉ RENDER** — giải câu không tự động hoá được, xem mục "KHÔNG kiểm được" |
| EX-21 | SPEAK | **chỉ UI ghi âm** — bấm ghi → hiện Dừng/Huỷ → Huỷ → về trạng thái đầu (đường vào KHÁC EX-12, xem ghi chú trong file) |

Mức độ chốt được khác nhau theo dạng, và khác biệt đó là **bản chất**, không
phải do thiếu công sức:

| Mức | Dạng đạt được | Vì sao |
| --- | --- | --- |
| Chốt chấm điểm đúng, không cần cờ | TRUE_FALSE | 2 lựa chọn × 2 lượt thử = vét cạn |
| Chốt cơ chế + luồng, không cần cờ | ONE, MULTI, DRAG_DROP, SENTENCE_BUILDER, CONNECT, FILL_WORD (nhánh sai) | không vét cạn được đáp án, nhưng các tính chất bất biến vẫn chốt được |
| Chỉ chốt render / UI | SORT, SPEAK | giới hạn vật lý: SORT cần pan thật, SPEAK cần mic thật |

Muốn chốt "chọn đúng ô đúng thì app báo đúng" cho ONE / MULTI / CONNECT /
DRAG_DROP / SENTENCE_BUILDER thì **bắt buộc** phải có bản build
`EXPO_PUBLIC_E2E=1` (bộ EX-01→EX-10). Đáp án nằm ở BE, không có nguồn nào khác
để test biết, và id mang đáp án thì không thể ship lên store.

## Những gì bộ case này KHÔNG kiểm được

Nói rõ để không hiểu nhầm là đã phủ hết:

1. **SORT, SENTENCE_BUILDER** — dùng kéo–thả qua react-native-gesture-handler +
   Reanimated (dạng ghép từ/ghép câu theo thứ tự). Maestro chỉ có tap/swipe theo
   toạ độ, không tạo được pan gesture mà các component này nhận. **Phải test tay.**

   Cập nhật (2026-08-12, xem audit trong `flows/helpers/answer-sort-question.yaml` /
   `answer-sentence-builder-question.yaml`): dispatcher (`answer-current-exercise-generic.yaml`)
   NHẬN DIỆN được SORT/SENTENCE_BUILDER qua text "Reorder the letters" (không phân biệt được 2
   type này qua UI - xem naming conflict trong 2 file handler) và báo
   `BLOCKED_MISSING_UI_EVIDENCE` ngay thay vì để loop chạy hết 25 lần rồi timeout mù ở
   `exercise_result_screen`.

   Cập nhật (2026-08-12, lượt 2 - CMS type xác nhận thật qua `automation/discovery` +
   `exam_session.json` tự dựng từ `CMS_ACCESS_TOKEN`, không cần đăng nhập Casdoor/Cambridge):
   SORT và SENTENCE_BUILDER là **2 CMS type THẬT SỰ KHÁC NHAU** (không phải cùng 1 type gọi 2
   tên) - SENTENCE_BUILDER có `metadata.title` phổ biến là "Reorder the words" (ghép TỪ, data
   shape: `answers`/`correct` là mảng), SORT có `metadata.title` phổ biến là "Reorder the
   sentences" (ghép CÂU/dòng hội thoại, data shape: `answers=[]`, `correct` là 1 chuỗi ghép sẵn).
   `metadata.title` là text TỰ DO do người soạn CMS gõ (không phải nhãn cố định theo type) nên
   KHÔNG dùng làm bằng chứng type - đây chính là lý do dispatcher vẫn giữ `BLOCKED_UI_TYPE_
   AMBIGUOUS`-style (`BLOCKED_MISSING_UI_EVIDENCE`) cho tới khi có bằng chứng UI thật (hierarchy)
   phân biệt được 2 type này trên đúng loại màn hình tương ứng - chưa kịp verify trong phiên này
   (SENTENCE_BUILDER cần đi qua 5 câu trước, SORT cần đi qua 17 câu trước trong fixture tìm được).

   Chỉ có **EX-13** (Sentence Builder, fixture Unit 9 "practical") được tạo - xem
   `flows/exercise/EX-13-sentence-builder-blocked.yaml`. Chưa có EX-14 (SORT) - dù nay ĐÃ có
   fixture thật xác định (Khối 6, Review 4, Language, "Đề part 1", exerciseId
   `1ea73b9a-ad9a-4400-90e7-44106c24a488`, câu SORT ở index 17/20), việc dựng testcase cần đi
   qua 17 câu trước đó - chưa làm trong phiên này, không phải vì thiếu fixture.

   Cập nhật (2026-08-13, lượt 3 - re-verify CMS fixture SORT bằng lookup script mới, KHÔNG phải
   random walk mới, xem `automation/discovery/oneOffLookupSortFixture.mjs`):
   - **PHÁT HIỆN QUAN TRỌNG**: "index 17/20" ghi ở lượt trước là đọc từ field
     `metadata.index`/`raw.index` (do CMS lưu, `= 17` đúng), KHÔNG phải vị trí thật trong mảng
     `questions` mà `examPageScraper.js#parseQuestionsFromExamPage()` trả về - trong đúng lần gọi
     lại này, câu SORT nằm ở **vị trí mảng [8]** (0-based), còn `raw.index` của từng câu trong cả
     20 câu **KHÔNG khớp thứ tự mảng** (vd mảng[0] có `index=16`, mảng[8] có `index=17`,
     mảng[17] có `index=8`...) - tức 2 kiểu "thứ tự" này là 2 phép hoán vị khác nhau của cùng 20
     câu, không suy ra được thứ tự hiển thị thật trên app từ riêng 1 trong 2 field này. **Không
     được giả định "tap Tiếp tục N lần thì tới câu SORT" dựa vào 1 trong 2 số này** - phải xác
     định type CỦA TỪNG CÂU khi dispatcher đi qua (đúng cách generic dispatcher đang làm), không
     đếm index cứng.
   - Xác nhận lại content thật của câu SORT (không đổi so với suy luận cũ, chỉ có thêm full text):
     `metadata.title = "Reorder the sentences"`, `question.content` là 1 đoạn hội thoại 4 dòng
     Mai/Hoa xen kẽ (dạng chuỗi có `"/"` ngăn dòng, KHÔNG phải mảng), `answers = []`,
     `correct` = 1 chuỗi đã ghép sẵn đúng thứ tự cả 4 dòng nối bằng `" /"` - đúng shape "ghép
     CÂU/dòng" đã ghi nhận trước, khác hẳn shape "ghép TỪ" (mảng) của SENTENCE_BUILDER.
   - Real device (thiết bị `3201d866d40a1681`): login (0915775115/888888) + tab "Vui học" +
     chuyển Khối (đang ở Khối 7 mặc định sau login, không phải Khối 10 hay Khối 6) đều hoạt động
     đúng theo pattern trong `study_unit9_protecting_environment.yaml` - **KHÔNG gặp lại bug
     "Chuyển profile" index:0/1** ghi trong memory (tap thẳng `leftOf: "Chuyển profile"` +
     `"Khối 6"` thành công ngay lần đầu ở màn hình này) - có thể bug đó chỉ xảy ra ở 1 màn hình
     khác, không phải màn Vui học chính, cần cẩn thận không tổng quát hoá.
   - **BLOCKER MỚI phát hiện (chưa từng ghi nhận)**: sau khi tap "Vui học" xuất hiện popup toàn
     màn "Cập nhật phiên bản mới" ("Chú Vẹt vừa được cải tiến...") - che khuất toàn bộ
     header/"Chuyển profile", làm `tapOn leftOf: "Chuyển profile"` FAIL ngay (element not found)
     nếu không xử lý popup trước. Đã dismiss được bằng `tapOn: "Để sau"` (KHÔNG bấm "Cập nhật
     ngay") - đây là workaround tạm trong flow khám phá (scratch, không phải file repo), CHƯA
     thêm vào bất kỳ flow chính thức nào (`study_unit9_protecting_environment.yaml`,
     `unit9_getting_started_tram_khoi_hanh.yaml`...) vì ngoài phạm vi phiên này - nếu popup này
     xuất hiện không ổn định (có thể theo lần build/thời điểm), các flow `vui_hoc/` hiện có CÓ
     THỂ bắt đầu flaky vì lý do này, không phải lỗi logic của chúng.
   - Đã vào được `Danh sách Units - Khối 6` (Unit 1 "My new school", Unit 2 "My house", Unit 3
     "My friends"...) qua "Tất cả units" - xác nhận list Unit CÓ tồn tại và load được. **CHƯA
     tới được Unit "Review 4"**: mỗi card Unit rất cao (ảnh minh hoạ + tiêu đề + mô tả + nút), 1
     lượt `scrollUntilVisible` (speed 40, timeout 25000ms) chỉ lướt qua được khoảng 2-3 Unit -
     không đủ để tới Unit "Review 4" (dự kiến nằm sau nhiều Unit số, có thể đúng như brief đã
     cảnh báo là 1 section "Ôn tập" riêng biệt, KHÔNG phải card Unit thường - CHƯA xác nhận được
     hình dạng thật của nó). Đây là **BLOCKED_MISSING_FIXTURE (tạm thời, do budget cuộn màn hình
     trong phiên này, KHÔNG phải do fixture không tồn tại)** - cần lượt sau tăng timeout/scroll
     nhiều lần hơn (hoặc scroll theo từng đoạn ngắn lặp lại) để tới đúng Unit, Lesson "Language",
     Exercise "Đề part 1", rồi mới đi qua các câu bằng dispatcher để lấy UI evidence thật của câu
     SORT. **KHÔNG có UI evidence mới nào cho SORT trong phiên này** - phần UI vẫn giữ nguyên
     trạng thái BLOCKED_MISSING_UI_EVIDENCE như lượt trước, chỉ có thêm bằng chứng CMS mới (mục
     index ở trên) và bằng chứng navigation từng phần (tới được danh sách Unit, chưa tới được
     Unit đích).
   - Không đụng tới `answer-sort-question.yaml`/`answer-sentence-builder-question.yaml`/dispatcher
     trong phiên này - chưa có evidence UI mới đủ mạnh (đúng rule §9).

2. **DRAG_DROP** — ĐÃ CONFIRMED (2026-08-12, xem `flows/helpers/answer-drag-drop-question.yaml`).
   Khác với giả định ban đầu (CMS type xác nhận nhưng nghĩ cần gesture kéo thật), UI THẬT chỉ
   cần **TAP** vào 1 ô lựa chọn (`exercise_dragdrop_option_{i}`) là tự động điền vào đúng chỗ
   trống (`exercise_dragdrop_zone_{i}`) - không cần swipe/drag gì cả. Đã verify thật trên thiết
   bị thật (Khối 7, Unit 12: English-speaking countries, Grammar, "A/ An",
   exerciseId `ebb3a029-535c-4f41-9889-724e9ee9ba99`) bằng cả tap trực tiếp lẫn chạy nguyên
   dispatcher - dispatcher tự detect, gọi handler, tap đúng, bấm "Kiểm tra", và tiến đúng sang
   câu tiếp theo (FILL_WORD) mà không cần can thiệp gì thêm. Giới hạn còn lại: mới verify case
   1 chỗ trống - trường hợp nhiều chỗ trống cùng lúc (vd exam khác quan sát được: "What ___ you
   ___ to do ___ summer?" 3 chỗ trống) CHƯA verify thứ tự điền, xem comment trong file handler.
2. **SPEAK** — không xuất hiện trong bộ bài "Bài tập" mà EX-01..EX-11 dùng,
   chỉ có bên "Vui học" (Book/Unit/Lesson) - EX-12 tự điều hướng riêng, không
   dùng `open-exercise.yaml`. Cần thu âm thật để chấm điểm phát âm nên phần
   chấm điểm không tự động hoá được; EX-12 chỉ kiểm cơ chế UI. ĐÃ TỰ TAY XÁC
   NHẬN LẶP LẠI 2/2 LẦN (2026-08-11, thiết bị thật): bấm nút mic thật khiến
   app thoát khỏi bài về lại danh sách Lesson, không bao giờ vào được trạng
   thái ghi âm hay tới popup kết quả — khớp với bug đã biết ở
   homework/TEST-CASES.md dòng HW-14b ("app treo khi ghi âm").
3. **Điền từ ĐÚNG** — đáp án nằm ở BE, testID không mang nội dung đáp án. Chỉ
   test được nhánh sai. Muốn test nhánh đúng cần một bài seed cố định biết trước
   đáp án.
4. **CONNECT đúng/sai** — id chỉ mang vị trí (trái i / phải i), cặp đúng do BE
   quyết định. EX-08 chỉ kiểm cơ chế nối, không kiểm điểm.
5. **Điểm số ở màn kết quả** — chưa assert con số cụ thể vì phụ thuộc bài và số
   lần sai.

## Lưu ý khi chạy

Các case gắn tag `writes`: chúng **ghi dữ liệu thật** lên tài khoản test (lưu
câu trả lời, tăng lượt làm bài). Không chạy trên tài khoản thật của người dùng.

Đã bổ sung `flows/helpers/solve-connect.yaml` và `flows/helpers/open-vuihoc-connect.yaml`
(thiếu trong thư mục helpers dù `EX-08-connect-pairs.yaml` đã gọi tới — nếu
chạy EX-08 trước khi có bản cập nhật này sẽ báo lỗi "file not found", không
phải lỗi app).
