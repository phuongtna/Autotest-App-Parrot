# Testcase — CMS Quản lý (Web Admin): Quản lý ôn thi / Cấu hình bảng điểm

Nguồn: Statement + Flow + mô tả màn hình + Acceptance Criteria do người dùng cung cấp trong hội
thoại (2026-10-19), kèm 2 ảnh chụp màn hình (danh sách Bảng điểm, popup Thêm mới bảng điểm), và
`cauhinhbangdiem.xlsx` (bộ test case chạy tay thật, 2026-11-03).

**Tính năng**: tính năng mới trong module CMS "Quản lý ôn thi" (breadcrumb `Quản lý ôn thi / Cấu
hình bảng điểm`), cho phép Admin CRUD các Bảng điểm (quy tắc tính điểm, quy đổi điểm/số câu đúng của
1 section sang kết quả cuối cùng) để gắn vào Đề thi theo đúng Dạng quy đổi của Kỳ thi mà đề đó thuộc
về, giúp hệ thống tự tính điểm cuối cùng khi học sinh làm đề.

Cùng module với [`../quan_ly_section/TESTCASES.md`](../quan_ly_section/TESTCASES.md) (Section) — cấu
trúc màn hình rất giống nhau (danh sách + tìm kiếm + lọc droplist + popup CRUD), nhưng **rule Xóa
khác hẳn** (xem mục 4 và phần Giả định bên dưới).

**Cập nhật (2026-11-03)**: đã có automation Playwright tại
`flows/cms/quan_ly_on_thi/cau_hinh_bang_diem/*.spec.js` (chạy `cd automation && npm run
test-cau-hinh-bang-diem-pw`), môi trường dev (`CMS_ADMIN_URL_DEV=https://parotedu-cms.codeinet.com`,
tài khoản `CMS_USERNAME_DEV`/`CMS_PASSWORD_DEV` trong `.env`). 41/57 case đã chạy thật PASS trên dev
(2026-11-03); 16 case còn lại `test.skip()` kèm lý do cụ thể — chủ yếu cần thao tác trên màn Ngân
hàng đề thi (gắn Bảng điểm vào 1 Đề thi công khai/chưa công khai) hoặc tài khoản phân quyền khác, cả
2 đều NGOÀI PHẠM VI `/exam-prep/score-tables` mà automation module này bao phủ — xem cột
"Automation" ở từng dòng và `score-table-perm-sync.spec.js`. ADD-03/ADD-04 không áp dụng được (field
Dạng quy đổi không có cách nào để trống). LIST-11 bị skip vì cần xóa sạch dữ liệu thật trên dev —
không an toàn cho automation trên môi trường dùng chung. Một số giả định bên dưới đã được xác nhận
THẬT qua chạy tay (xlsx) và qua script dò hành vi bằng Playwright thật trước khi viết code — xem chú
thích "ĐÃ XÁC NHẬN THẬT" ở từng dòng.

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
- **ĐÃ XÁC NHẬN THẬT (2026-11-03, DOM thật trên dev)**: field Dạng quy đổi trong popup Thêm mới
  **LUÔN có sẵn giá trị "Phổ thông"** ngay khi mở popup (không bao giờ ở trạng thái trống/placeholder
  "Chọn dạng quy đổi") — field KHÔNG bắt buộc Admin tự chọn vì chỉ có đúng 1 giá trị khả dụng (xem
  ADD-01, ADD-03/ADD-04 không áp dụng được vì lý do này).
- Rule Sửa ghi "cập nhật lại ở các màn" nhưng không liệt kê cụ thể màn nào — suy luận theo Statement
  là màn Đề thi (Ngân hàng đề), vì Bảng điểm được gắn trực tiếp vào Đề thi (xem nhóm 6 SYNC).
- Có giới hạn độ dài ký tự cho Tên bảng điểm / Mô tả hay không — **ĐÃ XÁC NHẬN THẬT (xlsx, 2026-11-03,
  ADD-13)**: KHÔNG giới hạn, hệ thống cho lưu thành công với chuỗi 500+ ký tự.
- Có cho phép trùng tên Bảng điểm hay không — **ĐÃ XÁC NHẬN THẬT (script dò bằng Playwright thật,
  2026-11-03)**: KHÔNG cho phép, bị chặn với lỗi "Tên bảng điểm đã tồn tại" (xem ADD-10).
- Icon "×" góc trên popup có hành vi giống nút "Hủy" hay không — **ĐÃ XÁC NHẬN THẬT**: giống hệt,
  cùng quy ước Section (xem ADD-09/EDIT-07).
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
| LIST-01 | Truy cập menu hiển thị đúng bảng danh sách | Vào menu `Quản lý ôn thi` → `Cấu hình bảng điểm` | Hiển thị bảng với các cột: STT, Tên bảng điểm, Dạng quy đổi, Mô tả, Thao tác (Sửa/Xóa) | Pass (automated, live-run dev 2026-11-03) | [score-table-list.spec.js](score-table-list.spec.js) `LIST-01` |
| LIST-02 | Thứ tự danh sách: mới nhất lên đầu | Tạo mới liên tiếp 2 Bảng điểm A rồi B | B (tạo sau) hiển thị phía trên A trong bảng | Pass (automated, live-run dev 2026-11-03) | [score-table-list.spec.js](score-table-list.spec.js) `LIST-02` |
| LIST-03 | Tổng số bảng điểm hiển thị đúng | Đối chiếu số "X bảng điểm" góc phải với số dòng thực tế trong bảng (không lọc/tìm kiếm) | Số hiển thị khớp đúng tổng số bản ghi | Pass (automated, live-run dev 2026-11-03) | [score-table-list.spec.js](score-table-list.spec.js) `LIST-03` |
| LIST-04 | Tìm kiếm tương đối theo tên bảng điểm | Nhập 1 phần tên (vd. "Thang 10") vào ô "Tìm theo tên bảng điểm..." | Chỉ hiển thị các Bảng điểm có tên chứa chuỗi đã nhập (không phân biệt hoa/thường); **ĐÃ XÁC NHẬN THẬT (xlsx)**: tìm "Thang 10" khớp cả "Thang 100" (substring thuần) | Pass (automated, live-run dev 2026-11-03) | [score-table-list.spec.js](score-table-list.spec.js) `LIST-04` |
| LIST-05 | Tìm kiếm không có kết quả | Nhập chuỗi không khớp tên Bảng điểm nào | Bảng hiển thị rỗng / thông báo không có dữ liệu, không lỗi hệ thống | Pass (automated, live-run dev 2026-11-03) | [score-table-list.spec.js](score-table-list.spec.js) `LIST-05` |
| LIST-06 | Lọc theo Dạng quy đổi | Chọn giá trị "Phổ thông" ở dropdown "Tất cả dạng quy đổi" | Bảng chỉ hiển thị Bảng điểm có Dạng quy đổi = "Phổ thông" | Pass (automated, live-run dev 2026-11-03) | [score-table-list.spec.js](score-table-list.spec.js) `LIST-06` |
| LIST-07 | Bỏ lọc dạng quy đổi | Sau khi đã lọc, chọn lại "Tất cả dạng quy đổi" | Hiển thị lại đầy đủ toàn bộ Bảng điểm | Pass (automated, live-run dev 2026-11-03) | [score-table-list.spec.js](score-table-list.spec.js) `LIST-07` |
| LIST-08 | Kết hợp tìm kiếm + lọc dạng quy đổi | Nhập từ khóa tìm kiếm VÀ chọn 1 Dạng quy đổi cùng lúc | Kết quả thỏa đồng thời cả 2 điều kiện (AND) | Pass (automated, live-run dev 2026-11-03) | [score-table-list.spec.js](score-table-list.spec.js) `LIST-08` |
| LIST-09 | Danh sách dạng quy đổi trong dropdown lọc đúng với hard-code | Mở dropdown "Tất cả dạng quy đổi", đối chiếu với danh sách dev cung cấp | Danh sách khớp đầy đủ — hiện tại chỉ có "Tất cả dạng quy đổi" + "Phổ thông", không thiếu/thừa | Pass (automated, live-run dev 2026-11-03) | [score-table-list.spec.js](score-table-list.spec.js) `LIST-09` |
| LIST-10 | Danh sách trống khi hệ thống chưa có Bảng điểm nào | Vào màn Cấu hình bảng điểm khi thực sự không còn bản ghi nào (không phải do lọc/tìm kiếm) | Hiển thị trạng thái rỗng rõ ràng (vd. "Chưa có bảng điểm nào"), không lỗi hệ thống; số đếm hiển thị "0 bảng điểm" | Chưa test | Skip (automated) - cần xóa sạch dữ liệu thật trên dev, không an toàn cho automation trên môi trường dùng chung |
| LIST-11 | Cột Mô tả khi không nhập Mô tả lúc tạo | Tạo 1 Bảng điểm để trống Mô tả, quan sát dòng tương ứng trong bảng | Cột Mô tả hiển thị ký tự "—" | Pass (automated, live-run dev 2026-11-03) | [score-table-list.spec.js](score-table-list.spec.js) `LIST-10` |

## 2. Thêm mới Bảng điểm

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| ADD-01 | Mở popup Thêm mới | Bấm nút "+ Thêm mới" | Popup "Thêm mới bảng điểm" mở ra; Tên bảng điểm và Mô tả trống với đúng placeholder; Dạng quy đổi tự chọn sẵn "Phổ thông" (ĐÃ XÁC NHẬN THẬT) | Pass (automated, live-run dev 2026-11-03) | [score-table-add.spec.js](score-table-add.spec.js) `ADD-01` |
| ADD-02 | Validate thiếu "Tên bảng điểm" | Để trống Tên bảng điểm, bấm Lưu | Hiển thị lỗi "Vui lòng nhập tên bảng điểm" ngay dưới field Tên bảng điểm; KHÔNG tạo mới; popup vẫn mở | Pass (automated, live-run dev 2026-11-03) | [score-table-add.spec.js](score-table-add.spec.js) `ADD-02` |
| ADD-03 | Validate thiếu "Dạng quy đổi" | — | **KHÔNG áp dụng được**: field luôn có sẵn giá trị mặc định "Phổ thông", không có cách nào đưa về trạng thái trống để test (ĐÃ XÁC NHẬN THẬT) | N/A | Skip (automated) - field luôn có giá trị mặc định, không thể để trống |
| ADD-04 | Validate thiếu đồng thời cả 2 field bắt buộc | — | N/A (phụ thuộc ADD-03) | N/A | Skip (automated) - phụ thuộc ADD-03 |
| ADD-05 | Mô tả không bắt buộc | Nhập đủ Tên bảng điểm, để trống Mô tả, bấm Lưu | Tạo mới thành công; dòng mới trong bảng hiển thị cột Mô tả "—" | Pass (automated, live-run dev 2026-11-03) | [score-table-add.spec.js](score-table-add.spec.js) `ADD-05` |
| ADD-06 | Chọn Dạng quy đổi = "Phổ thông" hiển thị đúng thông báo mô tả rule | Mở popup Thêm mới, quan sát Dạng quy đổi = "Phổ thông" | Hiển thị đúng khối thông báo: "Không cần cấu hình quy đổi." + "Điểm đề = tổng điểm các câu hỏi được gắn với đề (điểm thô)." | Pass (automated, live-run dev 2026-11-03) | [score-table-add.spec.js](score-table-add.spec.js) `ADD-06` |
| ADD-07 | Tạo mới hợp lệ đầy đủ | Nhập Tên bảng điểm, Mô tả, bấm Lưu | Tạo mới thành công; popup đóng; dòng mới xuất hiện ở đầu bảng với đúng dữ liệu vừa nhập | Pass (automated, live-run dev 2026-11-03) | [score-table-add.spec.js](score-table-add.spec.js) `ADD-07` |
| ADD-08 | Bấm Hủy khi đang nhập dở | Nhập dữ liệu vào các field, bấm "Hủy" | Popup đóng, KHÔNG tạo mới, danh sách giữ nguyên như trước khi mở popup | Pass (automated, live-run dev 2026-11-03) | [score-table-add.spec.js](score-table-add.spec.js) `ADD-08` |
| ADD-09 | Đóng popup bằng icon "×" góc trên bên phải | Nhập dữ liệu vào popup Thêm mới, bấm icon "×" (không phải nút Hủy) | Hành vi giống hệt bấm Hủy: popup đóng, KHÔNG tạo mới, danh sách giữ nguyên | Pass (automated, live-run dev 2026-11-03) | [score-table-add.spec.js](score-table-add.spec.js) `ADD-09` |
| ADD-10 | Tạo 2 Bảng điểm trùng tên | Tạo Bảng điểm A, sau đó tạo tiếp Bảng điểm khác với tên trùng hệt A | **ĐÃ XÁC NHẬN THẬT**: bị CHẶN với lỗi "Tên bảng điểm đã tồn tại", không tạo bản ghi thứ 2 | Pass (automated, live-run dev 2026-11-03) | [score-table-add.spec.js](score-table-add.spec.js) `ADD-10` |
| ADD-11 | Tên bảng điểm chỉ gồm khoảng trắng | Nhập toàn dấu cách vào Tên bảng điểm, bấm Lưu | **ĐÃ XÁC NHẬN THẬT**: hệ thống coi là rỗng, báo lỗi "Vui lòng nhập tên bảng điểm" | Pass (automated, live-run dev 2026-11-03) | [score-table-add.spec.js](score-table-add.spec.js) `ADD-11` |
| ADD-12 | Popup Thêm mới không giữ dữ liệu cũ sau khi Lưu thành công | Tạo mới 1 Bảng điểm thành công, sau đó bấm lại "+ Thêm mới" | Popup mở ra với Tên bảng điểm/Mô tả trống (không còn dữ liệu của lần tạo trước); Dạng quy đổi về đúng trạng thái mặc định ban đầu | Pass (automated, live-run dev 2026-11-03) | [score-table-add.spec.js](score-table-add.spec.js) `ADD-12` |
| ADD-13 | Giới hạn độ dài Tên bảng điểm / Mô tả | Nhập chuỗi rất dài (500+ ký tự) vào Tên bảng điểm và Mô tả, bấm Lưu | **ĐÃ XÁC NHẬN THẬT**: hệ thống cho lưu thành công, KHÔNG giới hạn độ dài | Pass (automated, live-run dev 2026-11-03) | [score-table-add.spec.js](score-table-add.spec.js) `ADD-13` |

## 3. Chỉnh sửa Bảng điểm

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| EDIT-01 | Mở popup Sửa hiển thị đúng dữ liệu hiện tại | Bấm icon "Sửa" trên 1 Bảng điểm chưa gắn Đề thi nào | Popup mở ra, các field được điền sẵn đúng với dữ liệu hiện tại (Tên bảng điểm, Mô tả, Dạng quy đổi) | Pass (automated, live-run dev 2026-11-03) | [score-table-edit.spec.js](score-table-edit.spec.js) `EDIT-01` |
| EDIT-02 | Sửa Bảng điểm chưa gắn Đề thi nào | Đổi Tên bảng điểm và/hoặc Mô tả sang giá trị mới hợp lệ, bấm Lưu | Lưu thành công; bảng danh sách cập nhật ngay lập tức, không cần tải lại trang | Pass (automated, live-run dev 2026-11-03) | [score-table-edit.spec.js](score-table-edit.spec.js) `EDIT-02` |
| EDIT-03 | Sửa Bảng điểm đã gắn Đề thi CHƯA công khai | Gắn Bảng điểm X vào 1 Đề thi chưa công khai, sau đó Sửa Tên/Mô tả của X, bấm Lưu | Cho phép sửa thành công (theo AC: đề thi chưa công khai vẫn cho sửa) | Pass (manual, xlsx 2026-11-03) | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi) |
| EDIT-04 | Sửa Bảng điểm đã gắn Đề thi ĐÃ công khai | Gắn Bảng điểm Y vào 1 Đề thi đã Công khai, thử mở Sửa/Lưu thay đổi cho Y | KHÔNG cho phép sửa — nút Sửa bị ẩn/disable trên danh sách, hoặc hệ thống chặn/báo lỗi khi bấm Lưu; dữ liệu Y không đổi | Pass (manual, xlsx 2026-11-03) | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi) |
| EDIT-05 | Validate khi Sửa: xóa trống Tên bảng điểm | Mở Sửa 1 Bảng điểm được phép sửa, xóa trống Tên bảng điểm, bấm Lưu | Hiển thị lỗi tương ứng; KHÔNG lưu thay đổi; dữ liệu gốc không đổi | Pass (automated, live-run dev 2026-11-03) | [score-table-edit.spec.js](score-table-edit.spec.js) `EDIT-05` |
| EDIT-06 | Bấm Hủy khi đang sửa | Mở Sửa, thay đổi dữ liệu, bấm "Hủy" | Popup đóng, dữ liệu gốc của Bảng điểm giữ nguyên, danh sách không đổi | Pass (automated, live-run dev 2026-11-03) | [score-table-edit.spec.js](score-table-edit.spec.js) `EDIT-06` |
| EDIT-07 | Đóng popup Sửa bằng icon "×" | Mở Sửa, thay đổi dữ liệu, bấm icon "×" góc trên bên phải | Hành vi giống Hủy: popup đóng, dữ liệu gốc giữ nguyên, danh sách không đổi | Pass (automated, live-run dev 2026-11-03) | [score-table-edit.spec.js](score-table-edit.spec.js) `EDIT-07` |
| EDIT-08 | Vị trí trong danh sách không đổi sau khi Sửa | Sửa Tên/Mô tả của 1 Bảng điểm không phải mới nhất, Lưu lại | Bảng điểm vẫn giữ nguyên vị trí theo thứ tự tạo mới nhất ban đầu, KHÔNG nhảy lên đầu danh sách theo thời điểm sửa | Pass (automated, live-run dev 2026-11-03) | [score-table-edit.spec.js](score-table-edit.spec.js) `EDIT-08` |
| EDIT-09 | [Edge] Bảng điểm vừa gắn Đề thi đã công khai vừa gắn Đề thi chưa công khai | Gắn 1 Bảng điểm vào 2 Đề thi: 1 đã Công khai + 1 chưa Công khai, thử Sửa Bảng điểm đó | KHÔNG cho phép sửa — rule chặn vì có ÍT NHẤT 1 đề đã Công khai được ưu tiên áp dụng (đối xứng với rule Xóa ở DEL-06) | Pass (manual, xlsx 2026-11-03) | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi) |
| EDIT-10 | Sửa Dạng quy đổi (khi tương lai có >1 lựa chọn) | Đổi Dạng quy đổi của 1 Bảng điểm được phép sửa sang giá trị khác, bấm Lưu | Lưu thành công, cột Dạng quy đổi cập nhật đúng giá trị mới | Pending | Skip (automated) - hệ thống hiện chỉ có đúng 1 giá trị "Phổ thông", chưa có giá trị thứ 2 để test |

## 4. Xóa Bảng điểm

Khác với Section (cho xóa nếu Section chỉ gắn đề thi **chưa công khai**), AC của Bảng điểm quy định
rõ: hễ đã gắn vào **bất kỳ** Đề thi nào (công khai hay chưa) thì đều **không** cho xóa. Chỉ bảng điểm
hoàn toàn chưa gắn đề thi nào mới xóa được.

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| DEL-01 | Xóa Bảng điểm chưa gắn vào Đề thi nào | Bấm icon "Xóa" trên 1 Bảng điểm chưa được dùng ở Đề thi nào → popup xác nhận → Đồng ý | Popup xác nhận xóa hiển thị; sau khi đồng ý, Bảng điểm biến mất khỏi danh sách, xóa thành công | Pass (automated, live-run dev 2026-11-03) | [score-table-delete.spec.js](score-table-delete.spec.js) `DEL-01` |
| DEL-02 | Xóa Bảng điểm đã gắn Đề thi CHƯA công khai | Gắn Bảng điểm vào 1 Đề thi chưa công khai, sau đó thử xóa Bảng điểm đó | KHÔNG cho phép xóa (khác với rule Xóa Section); nút Xóa bị ẩn/disable, hoặc hệ thống báo lỗi chặn xóa khi xác nhận | Pass (manual, xlsx 2026-11-03) | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi) |
| DEL-03 | Xóa Bảng điểm đã gắn Đề thi ĐÃ công khai | Gắn Bảng điểm vào 1 Đề thi đã Công khai, sau đó thử xóa Bảng điểm đó | KHÔNG cho phép xóa — nút Xóa bị ẩn/disable, hoặc hệ thống báo lỗi chặn xóa khi xác nhận; Bảng điểm vẫn còn trong danh sách | Pass (manual, xlsx 2026-11-03) | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi) |
| DEL-04 | Hủy ở popup xác nhận xóa | Bấm icon "Xóa" trên 1 Bảng điểm hợp lệ để xóa → popup xác nhận hiện ra → bấm Hủy/đóng popup | Bảng điểm KHÔNG bị xóa, vẫn còn nguyên trong danh sách | Pass (automated, live-run dev 2026-11-03) | [score-table-delete.spec.js](score-table-delete.spec.js) `DEL-04` |
| DEL-05 | Số đếm "X bảng điểm" giảm đúng sau khi xóa thành công | Ghi nhận số "Tổng X bản ghi" trước khi xóa, thực hiện DEL-01 (xóa 1 Bảng điểm hợp lệ) | Số đếm giảm đúng 1 đơn vị so với trước khi xóa, không cần tải lại trang | Pass (automated, live-run dev 2026-11-03) | [score-table-delete.spec.js](score-table-delete.spec.js) `DEL-05` |
| DEL-06 | [Edge] Bảng điểm đã từng gắn Đề thi nhưng Đề thi đó sau đó bị xóa/gỡ gắn | Gắn Bảng điểm vào 1 Đề thi, sau đó gỡ Bảng điểm ra khỏi Đề thi đó (hoặc xóa hẳn Đề thi), thử xóa lại Bảng điểm | Vì không còn gắn vào Đề thi nào nữa, hệ thống cho phép xóa bình thường | Pass (manual, xlsx 2026-11-03) | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi) |

## 5. Phân quyền truy cập

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| PERM-01 | [Exploratory] Tài khoản không có quyền Admin truy cập menu Cấu hình bảng điểm | Đăng nhập bằng tài khoản CMS không có quyền Admin (nếu hệ thống có phân quyền theo vai trò), thử truy cập menu `Quản lý ôn thi / Cấu hình bảng điểm` | Theo Statement ("Là quản trị viên, tôi muốn..."), menu/chức năng này nên giới hạn cho vai trò quản trị viên | Pass (manual, xlsx 2026-11-03) | Skip (automated) - cần tài khoản CMS phân quyền khác, automation không tự tạo được |

## 6. Đồng bộ dữ liệu Bảng điểm sang Đề thi

Nhóm case xác nhận mục tiêu nêu ở Statement: Bảng điểm được gắn vào Đề thi **theo đúng Dạng quy đổi
của Kỳ thi mà đề thuộc về**, và dữ liệu Bảng điểm sau khi Thêm mới/Sửa (khi được phép) phải phản ánh
đúng ở màn Đề thi (Ngân hàng đề).

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| SYNC-01 | Bảng điểm mới tạo hiển thị ngay trong dropdown chọn Bảng điểm ở Đề thi | Tạo mới 1 Bảng điểm ở màn Cấu hình bảng điểm, không tải lại trang, sang Ngân hàng đề thi → mở 1 Đề thi (hoặc Tạo mới) → mở dropdown chọn Bảng điểm | Bảng điểm vừa tạo xuất hiện ngay trong danh sách để chọn, không cần F5/tải lại trang | Pass (manual, xlsx 2026-11-03) | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi) |
| SYNC-02 | Đề thi chỉ cho chọn Bảng điểm có Dạng quy đổi KHỚP với Dạng quy đổi của Kỳ thi | Mở 1 Đề thi thuộc Kỳ thi có Dạng quy đổi = "Phổ thông", mở dropdown chọn Bảng điểm | Dropdown chỉ liệt kê các Bảng điểm có Dạng quy đổi = "Phổ thông" (khớp với Kỳ thi) | Pass (manual, xlsx 2026-11-03) | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi) |
| SYNC-03 | Sửa Tên Bảng điểm (trường hợp được phép sửa) → Đề thi hiển thị đúng tên mới | Gắn Bảng điểm X (chưa công khai đề) vào 1 Đề thi (Lưu), sang Cấu hình bảng điểm đổi Tên bảng điểm của X (Lưu), quay lại mở Đề thi đã gắn | Đề thi hiển thị NGAY tên mới của Bảng điểm X, không giữ tên cũ | Pass (manual, xlsx 2026-11-03) | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi) |
| SYNC-04 | Bảng điểm bị xóa không còn xuất hiện trong dropdown chọn ở Đề thi | Sau khi xóa thành công 1 Bảng điểm chưa từng gắn đề thi nào (DEL-01), mở dropdown chọn Bảng điểm ở màn Đề thi | Bảng điểm đã xóa không còn xuất hiện trong danh sách để chọn | Pass (manual, xlsx 2026-11-03) | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi) |
| SYNC-05 | Điểm cuối cùng của học sinh được tính đúng theo rule "Phổ thông" khi làm đề | Gắn 1 Bảng điểm "Phổ thông" vào 1 Đề thi, cho học sinh làm đề và trả lời đúng/sai 1 số câu có điểm khác nhau, xem điểm kết quả cuối cùng | Điểm cuối cùng hiển thị đúng = tổng điểm (thô) của các câu hỏi con trong đề mà học sinh làm đúng | Pending ("Web chưa có để check" - xlsx) | Skip (automated) - cần màn làm bài học sinh qua web, chưa sẵn sàng tại thời điểm chạy |

## 7. Phân trang danh sách Bảng điểm

Nhóm case bổ sung (không có trong bản spec gốc, xuất hiện trong `cauhinhbangdiem.xlsx` sau khi chạy
tay 2026-11-03) — xác nhận hành vi phân trang (Naive UI `n-pagination`), cùng cấu trúc với nhóm
"7. Phân trang danh sách Section" ở file Section.

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| PAGE-01 | Số bản ghi ≤ page size → không có nút chuyển trang | Có ≤10 Bảng điểm (đúng page size mặc định), quan sát khu vực phân trang | Chỉ hiển thị trang "1", không có nút trang "2" trở đi | Pass (automated, live-run dev 2026-11-03) | [score-table-pagination.spec.js](score-table-pagination.spec.js) `PAGE-01` |
| PAGE-02 | Số bản ghi > page size → xuất hiện trang kế tiếp | Tạo đủ > 10 Bảng điểm (vd. 11), quan sát khu vực phân trang | Xuất hiện thêm nút trang "2"; nút "▶" (trang sau) chuyển từ disable sang khả dụng | Pass (automated, live-run dev 2026-11-03) | [score-table-pagination.spec.js](score-table-pagination.spec.js) `PAGE-02` |
| PAGE-03 | Chuyển sang trang 2 hiển thị đúng dữ liệu, STT không reset | Đang ở trang 1 (11 bản ghi, 10/trang), bấm vào trang "2" | Trang 2 hiển thị đúng (các) bản ghi còn lại; cột STT tiếp tục đánh số toàn cục | Pass (automated, live-run dev 2026-11-03) | [score-table-pagination.spec.js](score-table-pagination.spec.js) `PAGE-03` |
| PAGE-04 | Quay lại trang 1 từ trang 2 | Đang ở trang 2, bấm nút "◀" (trang trước) | Quay lại đúng trang 1 với đủ 10 bản ghi đầu | Pass (automated, live-run dev 2026-11-03) | [score-table-pagination.spec.js](score-table-pagination.spec.js) `PAGE-04` |
| PAGE-05 | Nút "◀" bị vô hiệu hoá khi đang ở trang đầu | Quan sát nút "◀" khi đang ở trang 1 | Nút ở trạng thái disabled | Pass (automated, live-run dev 2026-11-03) | [score-table-pagination.spec.js](score-table-pagination.spec.js) `PAGE-05` |
| PAGE-06 | Nút "▶" bị vô hiệu hoá khi đang ở trang cuối | Chuyển tới trang cuối cùng, quan sát nút "▶" | Nút ở trạng thái disabled khi đang ở trang cuối | Pass (automated, live-run dev 2026-11-03) | [score-table-pagination.spec.js](score-table-pagination.spec.js) `PAGE-06` |
| PAGE-07 | Đổi số bản ghi/trang (10 → 20/50/100) gộp nhiều bản ghi hơn trên 1 trang | Mở dropdown "Hiển thị", chọn "20" / "50" / "100" | Bảng hiển thị nhiều bản ghi hơn trên cùng 1 trang; số trang giảm | Pass (automated, live-run dev 2026-11-03) | [score-table-pagination.spec.js](score-table-pagination.spec.js) `PAGE-07` |
| PAGE-08 | Tìm kiếm khi đang ở trang 2 → tự động quay về trang 1 | Đang ở trang 2, nhập từ khóa vào ô tìm kiếm | Hệ thống tự động quay về trang 1, hiển thị kết quả lọc đúng theo từ khóa | Pass (automated, live-run dev 2026-11-03) | [score-table-pagination.spec.js](score-table-pagination.spec.js) `PAGE-08` |
| PAGE-09 | Lọc theo Dạng quy đổi khi đang ở trang 2 → tự động quay về trang 1 | Đang ở trang 2, chọn 1 giá trị ở dropdown "Tất cả dạng quy đổi" (vd. "Phổ thông") | Tự động quay về trang 1 | Pass (automated, live-run dev 2026-11-03) | [score-table-pagination.spec.js](score-table-pagination.spec.js) `PAGE-09` |
| PAGE-10 | Số đếm tổng "X bảng điểm" luôn phản ánh TOÀN BỘ bản ghi, không chỉ trang hiện tại | Đối chiếu số "X bảng điểm" khi đang ở trang 2 với tổng số bản ghi thật | Số đếm hiển thị đúng tổng toàn bộ, không bị nhầm thành số dòng trên trang hiện tại | Pass (automated, live-run dev 2026-11-03) | [score-table-pagination.spec.js](score-table-pagination.spec.js) `PAGE-10` |
| PAGE-11 | Xóa hết bản ghi ở trang N, điều hướng về trang trước đó N-1 | Bảng ghi có N trang, xóa hết bản ghi ở trang N đó | Hệ thống điều hướng về trang N-1 | Pass (automated, live-run dev 2026-11-03) | [score-table-pagination.spec.js](score-table-pagination.spec.js) `PAGE-11` |

---

## Ghi chú chạy test

Automation Playwright đã có tại `automation/cau_hinh_bang_diem/` (page objects + session, theo
đúng quy ước của `automation/quan_ly_section/`) và `flows/cms/quan_ly_on_thi/cau_hinh_bang_diem/
*.spec.js`. Chạy toàn bộ suite:

```
cd automation
npm run test-cau-hinh-bang-diem-pw
```

Dọn dẹp dữ liệu test (tiền tố `AUTO-`/`AUTOPG-`) nếu 1 lần chạy bị ngắt giữa chừng:

```
cd automation
npm run cleanup-cau-hinh-bang-diem
```

Tương tự cách tổ chức tại [`flows/cms/goi_dich_vu/TESTCASES.md`](../../goi_dich_vu/TESTCASES.md)
và [`../quan_ly_section/TESTCASES.md`](../quan_ly_section/TESTCASES.md).
