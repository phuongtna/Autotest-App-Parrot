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
| `exercise_close_button` | nút X trên header | thoát giữa bài |

Mọi ô đáp án còn khai `accessibilityState.selected` → kiểm trạng thái đã chọn
không cần dựa vào màu.

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
