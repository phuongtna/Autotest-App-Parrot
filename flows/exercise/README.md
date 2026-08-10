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

## Những gì bộ case này KHÔNG kiểm được

Nói rõ để không hiểu nhầm là đã phủ hết:

1. **SORT, SENTENCE_BUILDER, DRAG_DROP** — 3 dạng này dùng kéo–thả qua
   react-native-gesture-handler + Reanimated. Maestro chỉ có tap/swipe theo toạ
   độ, không tạo được pan gesture mà các component này nhận. Không thêm testID
   cho chúng vì có id cũng không kéo được. **Phải test tay.**
2. **SPEAK** — cần thu âm thật. Không tự động hoá.
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
