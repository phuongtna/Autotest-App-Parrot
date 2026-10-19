# Testcase — CMS Quản lý (Web Admin): Quản lý ôn thi / Cấu hình bảng điểm

Nguồn: Statement + Flow + mô tả màn hình + Acceptance Criteria do người dùng cung cấp trong hội
thoại (2026-10-19), kèm 2 ảnh chụp màn hình (danh sách Bảng điểm, popup Thêm mới bảng điểm).

**Tính năng**: tính năng mới trong module CMS "Quản lý ôn thi" (breadcrumb `Quản lý ôn thi / Cấu
hình bảng điểm`), cho phép Admin CRUD các Bảng điểm (quy tắc tính điểm, quy đổi điểm/số câu đúng của
1 section sang kết quả cuối cùng) để gắn vào Đề thi theo đúng Dạng quy đổi của Kỳ thi mà đề đó thuộc
về, giúp hệ thống tự tính điểm cuối cùng khi học sinh làm đề.

Cùng module với [`../quan_ly_section/TESTCASES.md`](../quan_ly_section/TESTCASES.md) (Section) — cấu
trúc màn hình rất giống nhau (danh sách + tìm kiếm + lọc droplist + popup CRUD), nhưng **rule Xóa
khác hẳn** (xem mục 4 và phần Giả định bên dưới). Tại thời điểm viết file này tính năng **chưa có
automation** — file này CHỈ gồm testcase thiết kế từ spec, chưa chạy thật trên môi trường nào. Cột
"Trạng thái" để trống/`Chưa test` cho tới khi có lần chạy tay/tự động đầu tiên.

**Giả định cần xác nhận với BA/Dev trước khi chạy** (spec chưa nêu rõ):
- Rule tính điểm được spec dẫn chiếu "mục 13.4.4" nhưng nội dung đầy đủ của mục đó không có trong
  phần Acceptance Criteria được cung cấp — chỉ thấy mô tả cho riêng "Phổ thông" (điểm đề = tổng điểm
  câu hỏi con). Cần lấy đầy đủ nội dung 13.4.4 trước khi viết thêm case cho dạng quy đổi khác (hiện
  chưa ảnh hưởng vì mới có 1 loại).
- 3 bảng điểm mẫu trong ảnh chụp ("Phổ thông – Thang 100", "Phổ thông – Thang 10", "Phổ thông – Tổng
  điểm") đều có cùng Dạng quy đổi = "Phổ thông", dù tên gợi ý 3 cách quy đổi khác nhau (thang 100,
  thang 10, điểm thô). Theo AC, rule "Phổ thông" chỉ là tổng điểm thô — chưa rõ cơ chế quy đổi sang
  thang 10/100 nằm ở đâu. Cần xác nhận: đây chỉ là 3 tên gợi nhớ do Admin tự đặt (không có logic khác
  biệt thật sự), hay có cấu hình quy đổi ẩn chưa thấy trong popup.
- Spec ghi placeholder Dạng quy đổi trong popup Thêm mới là "Chọn dạng quy đổi" (ngụ ý ban đầu trống),
  nhưng ảnh chụp popup Thêm mới lại cho thấy field này **đã có sẵn giá trị "Phổ thông"** khi mở popup.
  Cần xác nhận hành vi thật: field có bắt buộc Admin tự chọn, hay tự động chọn sẵn giá trị duy nhất
  hiện có (xem ADD-01/ADD-03).
- Rule Sửa ghi "cập nhật lại ở các màn" nhưng không liệt kê cụ thể màn nào — suy luận theo Statement
  là màn Đề thi (Ngân hàng đề), vì Bảng điểm được gắn trực tiếp vào Đề thi (xem nhóm 6 SYNC).
- Có giới hạn độ dài ký tự cho Tên bảng điểm / Mô tả hay không — spec không nêu.
- Có cho phép trùng tên Bảng điểm hay không — spec không nêu rule unique.
- Icon "×" góc trên popup có hành vi giống nút "Hủy" hay không — không có trong bảng control của
  spec, suy luận theo quy ước UI thông thường (và theo cách Section đã làm, xem ADD-09/EDIT-10).
- Cơ chế phân quyền theo vai trò (Admin vs vai trò khác) có áp dụng cho menu này không — Statement chỉ
  nêu "Là quản trị viên, tôi muốn...", chưa chắc đã có enforcement thực tế (xem PERM-01).
- **Quan trọng — khác với Section**: AC ghi rõ "Đề thi đã Công khai, HOẶC chưa công khai → Không cho
  phép xóa bảng điểm" một khi đã gắn vào bất kỳ Đề thi nào. Đây là rule **chặt hơn** rule Xóa Section
  (Section cho xóa nếu đề chưa công khai — xem `DEL-02` ở file Section). Cần xác nhận lại với BA đây
  không phải lỗi đánh máy trong spec, vì 2 tính năng cùng module nhưng rule khác biệt hẳn.

**Ngoài phạm vi file này** (cần testcase riêng khi màn liên quan được đặc tả đầy đủ): chi tiết màn
Đề thi (Ngân hàng đề) nơi Admin thực sự gắn Bảng điểm vào Đề thi, và cơ chế hệ thống chặn/cho phép
chọn Bảng điểm theo đúng Dạng quy đổi của Kỳ thi (nêu ở Statement) — hiện chưa có ảnh chụp/spec riêng
cho màn đó nên nhóm 6 (SYNC) chỉ viết case ở mức suy luận hợp lý, cần đối chiếu lại khi màn Đề thi có
mặt.

---

## 1. Danh sách Bảng điểm

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| LIST-01 | Truy cập menu hiển thị đúng bảng danh sách | Vào menu `Quản lý ôn thi` → `Cấu hình bảng điểm` | Hiển thị bảng với các cột: STT, Tên bảng điểm, Dạng quy đổi, Mô tả, Thao tác (Sửa/Xóa) | Chưa test | — |
| LIST-02 | Thứ tự danh sách: mới nhất lên đầu | Tạo mới liên tiếp 2 Bảng điểm A rồi B | B (tạo sau) hiển thị phía trên A trong bảng | Chưa test | — |
| LIST-03 | Tổng số bảng điểm hiển thị đúng | Đối chiếu số "X bảng điểm" góc phải với số dòng thực tế trong bảng (không lọc/tìm kiếm) | Số hiển thị khớp đúng tổng số bản ghi | Chưa test | — |
| LIST-04 | Tìm kiếm tương đối theo tên bảng điểm | Nhập 1 phần tên (vd. "Thang 10") vào ô "Tìm theo tên bảng điểm..." | Chỉ hiển thị các Bảng điểm có tên chứa chuỗi đã nhập (không phân biệt hoa/thường); lưu ý tìm "Thang 10" không được khớp nhầm cả "Thang 100" nếu match theo substring thuần | Chưa test | — |
| LIST-05 | Tìm kiếm không có kết quả | Nhập chuỗi không khớp tên Bảng điểm nào | Bảng hiển thị rỗng / thông báo không có dữ liệu, không lỗi hệ thống | Chưa test | — |
| LIST-06 | Lọc theo Dạng quy đổi | Chọn giá trị "Phổ thông" ở dropdown "Tất cả dạng quy đổi" | Bảng chỉ hiển thị Bảng điểm có Dạng quy đổi = "Phổ thông" | Chưa test | — |
| LIST-07 | Bỏ lọc dạng quy đổi | Sau khi đã lọc, chọn lại "Tất cả dạng quy đổi" | Hiển thị lại đầy đủ toàn bộ Bảng điểm | Chưa test | — |
| LIST-08 | Kết hợp tìm kiếm + lọc dạng quy đổi | Nhập từ khóa tìm kiếm VÀ chọn 1 Dạng quy đổi cùng lúc | Kết quả thỏa đồng thời cả 2 điều kiện (AND) | Chưa test | — |
| LIST-09 | Danh sách dạng quy đổi trong dropdown lọc đúng với hard-code | Mở dropdown "Tất cả dạng quy đổi", đối chiếu với danh sách dev cung cấp | Danh sách khớp đầy đủ — hiện tại chỉ có "Tất cả dạng quy đổi" + "Phổ thông", không thiếu/thừa | Chưa test | — |
| LIST-10 | Danh sách trống khi hệ thống chưa có Bảng điểm nào | Vào màn Cấu hình bảng điểm khi thực sự không còn bản ghi nào (không phải do lọc/tìm kiếm) | Hiển thị trạng thái rỗng rõ ràng (vd. "Chưa có bảng điểm nào"), không lỗi hệ thống; số đếm hiển thị "0 bảng điểm" | Chưa test | — |
| LIST-11 | Cột Mô tả khi không nhập Mô tả lúc tạo | Tạo 1 Bảng điểm để trống Mô tả, quan sát dòng tương ứng trong bảng | Cột Mô tả hiển thị trống hoặc ký tự placeholder (vd. "—") — xác nhận hành vi thật trước khi gắn Pass/Fail | Chưa test | — |

## 2. Thêm mới Bảng điểm

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| ADD-01 | Mở popup Thêm mới | Bấm nút "+ Thêm mới" | Popup "Thêm mới bảng điểm" mở ra; Tên bảng điểm và Mô tả trống với đúng placeholder; xác nhận giá trị mặc định thật sự của Dạng quy đổi (trống với placeholder "Chọn dạng quy đổi", hay tự chọn sẵn "Phổ thông" — xem Giả định) | Chưa test | — |
| ADD-02 | Validate thiếu "Tên bảng điểm" | Để trống Tên bảng điểm, chọn Dạng quy đổi hợp lệ, bấm Lưu | Hiển thị lỗi tương ứng ngay dưới field Tên bảng điểm; KHÔNG tạo mới; popup vẫn mở | Chưa test | — |
| ADD-03 | [Phụ thuộc giá trị mặc định ở ADD-01] Validate thiếu "Dạng quy đổi" | Nhập Tên bảng điểm hợp lệ, xóa/bỏ chọn Dạng quy đổi nếu UI cho phép để trống, bấm Lưu | Nếu field cho phép ở trạng thái trống: hiển thị lỗi bắt buộc, KHÔNG tạo mới. Nếu field luôn có sẵn giá trị mặc định (không thể để trống): case này không áp dụng được — cần Dev xác nhận | Chưa test | — |
| ADD-04 | Validate thiếu đồng thời cả 2 field bắt buộc | Để trống cả Tên bảng điểm và Dạng quy đổi (nếu để trống được), bấm Lưu | Hiển thị lỗi cho CẢ 2 field cùng lúc; KHÔNG tạo mới | Chưa test | — |
| ADD-05 | Mô tả không bắt buộc | Nhập đủ Tên bảng điểm + Dạng quy đổi, để trống Mô tả, bấm Lưu | Tạo mới thành công; dòng mới trong bảng hiển thị cột Mô tả trống/"—" | Chưa test | — |
| ADD-06 | Chọn Dạng quy đổi = "Phổ thông" hiển thị đúng thông báo mô tả rule | Mở popup Thêm mới, chọn/giữ Dạng quy đổi = "Phổ thông" | Hiển thị đúng khối thông báo: "Không cần cấu hình quy đổi. Điểm đề = tổng điểm các câu hỏi được gắn với đề (điểm thô)." như trong ảnh chụp | Chưa test | — |
| ADD-07 | Tạo mới hợp lệ đầy đủ | Nhập Tên bảng điểm, chọn Dạng quy đổi = "Phổ thông", nhập Mô tả, bấm Lưu | Tạo mới thành công; popup đóng; dòng mới xuất hiện ở đầu bảng với đúng dữ liệu vừa nhập | Chưa test | — |
| ADD-08 | Bấm Hủy khi đang nhập dở | Nhập dữ liệu vào cả 3 field, bấm "Hủy" | Popup đóng, KHÔNG tạo mới, danh sách giữ nguyên như trước khi mở popup | Chưa test | — |
| ADD-09 | Đóng popup bằng icon "×" góc trên bên phải | Nhập dữ liệu vào popup Thêm mới, bấm icon "×" (không phải nút Hủy) | Hành vi giống hệt bấm Hủy: popup đóng, KHÔNG tạo mới, danh sách giữ nguyên | Chưa test | — |
| ADD-10 | [Edge — chưa có rule chính thức] Tạo 2 Bảng điểm trùng tên | Tạo Bảng điểm A, sau đó tạo tiếp Bảng điểm khác với tên trùng hệt A | Quan sát khách quan: hệ thống có chặn trùng tên hay cho phép tồn tại song song — **Exploratory**, cần BA xác nhận | Chưa test | — |
| ADD-11 | [Edge — chưa có rule chính thức] Tên bảng điểm chỉ gồm khoảng trắng | Nhập toàn dấu cách vào Tên bảng điểm, chọn Dạng quy đổi hợp lệ, bấm Lưu | Quan sát khách quan: hệ thống coi là rỗng và báo lỗi bắt buộc, hay chấp nhận lưu — **Exploratory**, cần BA xác nhận | Chưa test | — |
| ADD-12 | Popup Thêm mới không giữ dữ liệu cũ sau khi Lưu thành công | Tạo mới 1 Bảng điểm thành công, sau đó bấm lại "+ Thêm mới" | Popup mở ra với Tên bảng điểm/Mô tả trống (không còn dữ liệu của lần tạo trước); Dạng quy đổi về đúng trạng thái mặc định ban đầu | Chưa test | — |
| ADD-13 | [Edge — chưa có rule chính thức] Giới hạn độ dài Tên bảng điểm / Mô tả | Nhập chuỗi rất dài (vd. 500+ ký tự) vào Tên bảng điểm và Mô tả, bấm Lưu | Quan sát khách quan: có giới hạn ký tự (chặn gõ/báo lỗi) hay cho lưu tự do — **Exploratory**, cần BA xác nhận | Chưa test | — |

## 3. Chỉnh sửa Bảng điểm

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| EDIT-01 | Mở popup Sửa hiển thị đúng dữ liệu hiện tại | Bấm icon "Sửa" trên 1 Bảng điểm chưa gắn Đề thi nào | Popup mở ra, các field được điền sẵn đúng với dữ liệu hiện tại (Tên bảng điểm, Mô tả, Dạng quy đổi) | Chưa test | — |
| EDIT-02 | Sửa Bảng điểm chưa gắn Đề thi nào | Đổi Tên bảng điểm và/hoặc Mô tả sang giá trị mới hợp lệ, bấm Lưu | Lưu thành công; bảng danh sách cập nhật ngay lập tức, không cần tải lại trang | Chưa test | — |
| EDIT-03 | Sửa Bảng điểm đã gắn Đề thi CHƯA công khai | Gắn Bảng điểm X vào 1 Đề thi chưa công khai, sau đó Sửa Tên/Mô tả của X, bấm Lưu | Cho phép sửa thành công (theo AC: đề thi chưa công khai vẫn cho sửa) | Chưa test | — |
| EDIT-04 | Sửa Bảng điểm đã gắn Đề thi ĐÃ công khai | Gắn Bảng điểm Y vào 1 Đề thi đã Công khai, thử mở Sửa/Lưu thay đổi cho Y | KHÔNG cho phép sửa — nút Sửa bị ẩn/disable trên danh sách, hoặc hệ thống chặn/báo lỗi khi bấm Lưu; dữ liệu Y không đổi | Chưa test | — |
| EDIT-05 | Validate khi Sửa: xóa trống Tên bảng điểm | Mở Sửa 1 Bảng điểm được phép sửa, xóa trống Tên bảng điểm, bấm Lưu | Hiển thị lỗi tương ứng; KHÔNG lưu thay đổi; dữ liệu gốc không đổi | Chưa test | — |
| EDIT-06 | Bấm Hủy khi đang sửa | Mở Sửa, thay đổi dữ liệu, bấm "Hủy" | Popup đóng, dữ liệu gốc của Bảng điểm giữ nguyên, danh sách không đổi | Chưa test | — |
| EDIT-07 | Đóng popup Sửa bằng icon "×" | Mở Sửa, thay đổi dữ liệu, bấm icon "×" góc trên bên phải | Hành vi giống Hủy: popup đóng, dữ liệu gốc giữ nguyên, danh sách không đổi | Chưa test | — |
| EDIT-08 | Vị trí trong danh sách không đổi sau khi Sửa | Sửa Tên/Mô tả của 1 Bảng điểm không phải mới nhất, Lưu lại | Bảng điểm vẫn giữ nguyên vị trí theo thứ tự tạo mới nhất ban đầu, KHÔNG nhảy lên đầu danh sách theo thời điểm sửa | Chưa test | — |
| EDIT-09 | [Edge] Bảng điểm vừa gắn Đề thi đã công khai vừa gắn Đề thi chưa công khai | Gắn 1 Bảng điểm vào 2 Đề thi: 1 đã Công khai + 1 chưa Công khai, thử Sửa Bảng điểm đó | KHÔNG cho phép sửa — rule chặn vì có ÍT NHẤT 1 đề đã Công khai được ưu tiên áp dụng (đối xứng với rule Xóa ở DEL-06) | Chưa test | — |
| EDIT-10 | Sửa Dạng quy đổi (khi tương lai có >1 lựa chọn) | [Chỉ áp dụng khi hệ thống đã mở rộng thêm Dạng quy đổi khác ngoài "Phổ thông"] Đổi Dạng quy đổi của 1 Bảng điểm được phép sửa sang giá trị khác, bấm Lưu | Lưu thành công, cột Dạng quy đổi cập nhật đúng giá trị mới — **chưa thể test ở thời điểm hiện tại vì chỉ có 1 giá trị** | Chưa test | — |

## 4. Xóa Bảng điểm

Khác với Section (cho xóa nếu Section chỉ gắn đề thi **chưa công khai**), AC của Bảng điểm quy định
rõ: hễ đã gắn vào **bất kỳ** Đề thi nào (công khai hay chưa) thì đều **không** cho xóa. Chỉ bảng điểm
hoàn toàn chưa gắn đề thi nào mới xóa được.

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| DEL-01 | Xóa Bảng điểm chưa gắn vào Đề thi nào | Bấm icon "Xóa" trên 1 Bảng điểm chưa được dùng ở Đề thi nào → popup xác nhận → Đồng ý | Popup xác nhận xóa hiển thị; sau khi đồng ý, Bảng điểm biến mất khỏi danh sách, xóa thành công | Chưa test | — |
| DEL-02 | Xóa Bảng điểm đã gắn Đề thi CHƯA công khai | Gắn Bảng điểm vào 1 Đề thi chưa công khai, sau đó thử xóa Bảng điểm đó | KHÔNG cho phép xóa (khác với rule Xóa Section — xem ghi chú đầu mục 4); nút Xóa bị ẩn/disable, hoặc hệ thống báo lỗi chặn xóa khi xác nhận | Chưa test | — |
| DEL-03 | Xóa Bảng điểm đã gắn Đề thi ĐÃ công khai | Gắn Bảng điểm vào 1 Đề thi đã Công khai, sau đó thử xóa Bảng điểm đó | KHÔNG cho phép xóa — nút Xóa bị ẩn/disable, hoặc hệ thống báo lỗi chặn xóa khi xác nhận; Bảng điểm vẫn còn trong danh sách | Chưa test | — |
| DEL-04 | Hủy ở popup xác nhận xóa | Bấm icon "Xóa" trên 1 Bảng điểm hợp lệ để xóa → popup xác nhận hiện ra → bấm Hủy/đóng popup | Bảng điểm KHÔNG bị xóa, vẫn còn nguyên trong danh sách | Chưa test | — |
| DEL-05 | Số đếm "X bảng điểm" giảm đúng sau khi xóa thành công | Ghi nhận số "X bảng điểm" trước khi xóa, thực hiện DEL-01 (xóa 1 Bảng điểm hợp lệ) | Số đếm giảm đúng 1 đơn vị so với trước khi xóa, không cần tải lại trang | Chưa test | — |
| DEL-06 | [Edge] Bảng điểm đã từng gắn Đề thi nhưng Đề thi đó sau đó bị xóa/gỡ gắn | Gắn Bảng điểm vào 1 Đề thi, sau đó gỡ Bảng điểm ra khỏi Đề thi đó (hoặc xóa hẳn Đề thi, nếu màn Đề thi cho phép), thử xóa lại Bảng điểm | Vì không còn gắn vào Đề thi nào nữa, hệ thống cho phép xóa bình thường — xác nhận hành vi thật vì phụ thuộc cách hệ thống lưu vết quan hệ (có "nhớ" từng gắn hay chỉ xét trạng thái gắn hiện tại) | Chưa test | — |

## 5. Phân quyền truy cập

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| PERM-01 | [Exploratory] Tài khoản không có quyền Admin truy cập menu Cấu hình bảng điểm | Đăng nhập bằng tài khoản CMS không có quyền Admin (nếu hệ thống có phân quyền theo vai trò), thử truy cập menu `Quản lý ôn thi / Cấu hình bảng điểm` | Theo Statement ("Là quản trị viên, tôi muốn..."), menu/chức năng này nên giới hạn cho vai trò quản trị viên — cần BA/Dev xác nhận cơ chế phân quyền thực tế (ẩn menu, chặn truy cập, hay không giới hạn) trước khi gắn kết quả Pass/Fail | Chưa test | — |

## 6. Đồng bộ dữ liệu Bảng điểm sang Đề thi

Nhóm case xác nhận mục tiêu nêu ở Statement: Bảng điểm được gắn vào Đề thi **theo đúng Dạng quy đổi
của Kỳ thi mà đề thuộc về**, và dữ liệu Bảng điểm sau khi Thêm mới/Sửa (khi được phép) phải phản ánh
đúng ở màn Đề thi (Ngân hàng đề). Toàn bộ case trong nhóm này **chưa live-verify** — màn Đề thi nơi
thực sự gắn Bảng điểm chưa có ảnh chụp/spec riêng tại thời điểm viết file, case được viết ở mức suy
luận hợp lý theo cách Section đã hoạt động (xem nhóm SYNC ở file Section để đối chiếu cơ chế tương tự).

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| SYNC-01 | Bảng điểm mới tạo hiển thị ngay trong dropdown chọn Bảng điểm ở Đề thi | Tạo mới 1 Bảng điểm ở màn Cấu hình bảng điểm, không tải lại trang, sang Ngân hàng đề thi → mở 1 Đề thi (hoặc Tạo mới) → mở dropdown chọn Bảng điểm | Bảng điểm vừa tạo xuất hiện ngay trong danh sách để chọn, không cần F5/tải lại trang | Chưa test | — |
| SYNC-02 | Đề thi chỉ cho chọn Bảng điểm có Dạng quy đổi KHỚP với Dạng quy đổi của Kỳ thi | Mở 1 Đề thi thuộc Kỳ thi có Dạng quy đổi = "Phổ thông", mở dropdown chọn Bảng điểm | Dropdown chỉ liệt kê các Bảng điểm có Dạng quy đổi = "Phổ thông" (khớp với Kỳ thi); không hiển thị Bảng điểm thuộc dạng quy đổi khác (nếu hệ thống sau này có thêm dạng khác) | Chưa test | — |
| SYNC-03 | Sửa Tên Bảng điểm (trường hợp được phép sửa) → Đề thi hiển thị đúng tên mới | Gắn Bảng điểm X (chưa công khai đề) vào 1 Đề thi (Lưu), sang Cấu hình bảng điểm đổi Tên bảng điểm của X (Lưu), quay lại mở Đề thi đã gắn | Đề thi hiển thị NGAY tên mới của Bảng điểm X, không giữ tên cũ | Chưa test | — |
| SYNC-04 | Bảng điểm bị xóa không còn xuất hiện trong dropdown chọn ở Đề thi | Sau khi xóa thành công 1 Bảng điểm chưa từng gắn đề thi nào (DEL-01), mở dropdown chọn Bảng điểm ở màn Đề thi | Bảng điểm đã xóa không còn xuất hiện trong danh sách để chọn | Chưa test | — |
| SYNC-05 | Điểm cuối cùng của học sinh được tính đúng theo rule "Phổ thông" khi làm đề | Gắn 1 Bảng điểm "Phổ thông" vào 1 Đề thi, cho học sinh làm đề và trả lời đúng/sai 1 số câu có điểm khác nhau, xem điểm kết quả cuối cùng | Điểm cuối cùng hiển thị đúng = tổng điểm (thô) của các câu hỏi con trong đề mà học sinh làm đúng, khớp đúng mô tả AC "Phổ thông: điểm đề thi được tính dựa trên tổng điểm các câu hỏi con trong đề" | Chưa test | — |

---

## Ghi chú chạy test

Tính năng chưa có script tự động hoá (Playwright) tại thời điểm viết file này — toàn bộ case trên
cần chạy tay trước. Khi có automation, bổ sung thư mục `automation/cau_hinh_bang_diem/` (theo đúng
quy ước thư mục của `automation/quan_ly_goi_dich_vu/`) và cập nhật cột "Automation" + "Trạng thái" ở
từng bảng, tương tự cách tổ chức tại [`flows/cms/goi_dich_vu/TESTCASES.md`](../../goi_dich_vu/TESTCASES.md)
và [`../quan_ly_section/TESTCASES.md`](../quan_ly_section/TESTCASES.md).
