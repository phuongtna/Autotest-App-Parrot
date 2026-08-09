# Testcase - Màn hình "Bài tập"

Điền testcase theo mẫu bên dưới (giống định dạng đã dùng cho màn "Vui học").
Sau khi điền xong 1 case, báo tôi biết - tôi sẽ thao tác trực tiếp trên máy ảo để
xác nhận đúng hành vi thực tế, viết file `.yaml` tương ứng vào thư mục này
(`flows/bai_tap/`), chạy test và báo cáo kết quả lại cho bạn.

Rule chung cho màn "Bài tập" (khác với "Vui học"):
- Dạng bài giống bên "Vui học" (Đúng/Sai, Trắc nghiệm, Điền ký tự, Điền từ, Sentence
  Builder, Nối, Speaking...) NHƯNG KHÔNG có bài Dẫn nhập và KHÔNG có Flashcard.
- Bài Speaking: bấm icon mic -> chờ 4-5s -> bấm lại icon mic để gửi audio lên -> hiện
  popup kết quả -> bấm "Tiếp theo"/"Tiếp tục" để qua câu kế tiếp.

---

## TC1: Học ngẫu nhiên 1 bài tập tới khi hoàn thành thành công

Precondition:
- Đã đăng nhập, đang ở màn chính của app.
- Trong tab "Bài tập" có ít nhất 1 bài đang ở trạng thái "Làm bài" / "Làm lại" /
  "Chinh phục" (chưa hoàn thành hoặc có thể làm lại) để chọn ngẫu nhiên.

Step:
1. Mở tab "Bài tập" (nếu đang ở tab "Vui học" thì bấm chuyển tab; nếu popup
   "Cập nhật phiên bản mới" hiện ra thì bấm "Để sau" để tắt).
2. Cuộn danh sách bài tập, chọn ngẫu nhiên 1 card đang có nút "Làm bài" / "Làm lại" /
   "Chinh phục" và bấm vào nút đó để bắt đầu làm bài.
3. Nếu popup "AI hỗ trợ học tập" hiện ra thì bấm "Tiếp tục" để tắt.
4. Làm lần lượt hết tất cả câu hỏi trong bài (bài tập không có Dẫn nhập, không có
   Flashcard, không chấm từng câu như Vui học - làm hết mới có màn Kết quả), theo
   đúng dạng bài đang hiển thị ở mỗi câu:
   - Đúng/Sai: chọn Đúng hoặc Sai -> "Tiếp theo".
   - Trắc nghiệm (chữ hoặc ảnh): chọn 1 đáp án -> "Tiếp theo".
   - Điền ký tự / Điền từ: nhập đáp án đúng vào ô trống -> "Tiếp theo".
   - Sentence Builder: chọn các từ/ký tự theo đúng thứ tự -> "Tiếp theo".
   - Nối (Matching): nối đúng từng cặp -> "Tiếp theo".
   - Speaking (Nói): bấm icon mic để bắt đầu ghi âm -> chờ 4-5 giây -> bấm lại icon
     mic để gửi audio lên -> chờ popup kết quả hiện ra -> bấm "Tiếp theo"/"Tiếp tục".
5. Sau câu hỏi cuối cùng, xác nhận màn "Kết quả" xuất hiện.

Output:
- Màn "Kết quả" hiển thị: mascot + tiêu đề động viên (vd "Con đang làm đúng hướng
  rồi!"), 2 ô thống kê "ĐIỂM SỐ" (vd 10) và "CHÍNH XÁC" (dạng x/N, vd 5/5), link
  "Xem bài đã làm", section "Kiến thức trong bài", 2 nút "Tiếp theo" (sang bài tập
  kế tiếp) và "Làm lại" (làm lại đúng bài vừa xong).
- Bấm nút Close (X) quay lại danh sách "Bài tập": tiến độ tổng của danh sách tăng
  đúng thêm 1 bài (vd 8/32 -> 9/32).

---

<!--
Copy khối "## TCx" bên trên để thêm case mới.
Có thể ghi thêm dữ liệu test cần dùng (tên bài tập, đáp án...) ngay trong case -
tôi sẽ đưa vào test_data/ nếu cần tái sử dụng.
-->
