# Testcase — CMS Quản lý (Web Admin): Quản lý ôn thi / Quản lý Section

Nguồn: Statement + Flow + mô tả màn hình + Acceptance Criteria do người dùng cung cấp trong hội
thoại (2026-10-19), kèm 2 ảnh chụp màn hình (danh sách Section, popup Thêm mới/Chỉnh sửa Section).

**Tính năng**: tính năng mới trong module CMS "Quản lý ôn thi" (breadcrumb `Quản lý ôn thi / Quản
lý Section`), cho phép Admin CRUD các Section (phần thi theo từng kỹ năng) để tái sử dụng khi cấu
hình Kỳ thi và khi xây dựng Đề thi trong Ngân hàng đề, thay vì khai báo lại cho từng đề.

Khác với `flows/cms/goi_dich_vu/` (đã có code Playwright), tại thời điểm viết file này tính năng
**chưa có automation** — file này CHỈ gồm testcase thiết kế từ spec, chưa chạy thật trên môi trường
nào. Cột "Trạng thái" để trống/`Chưa test` cho tới khi có lần chạy tay/tự động đầu tiên.

**Giả định cần xác nhận với BA/Dev trước khi chạy** (spec chưa nêu rõ):
- Danh sách kỹ năng cố định trong code là những giá trị nào (ảnh mẫu cho thấy ít nhất: Nói, Viết,
  Đọc, Nghe).
- Hành vi input "Thời lượng" khi gõ ký tự không phải số nguyên: chặn gõ (chỉ cho gõ số) hay cho gõ
  tự do rồi validate khi bấm Lưu.
- Có giới hạn giá trị Thời lượng (ví dụ > 0, max) hay không — spec chỉ ghi "chỉ nhập số nguyên".
- Có cho phép trùng tên Section hay không (spec không nêu rule unique).
- "Đề thi đã Công khai" được xác định bằng trạng thái nào trên UI Ngân hàng đề (tên field/trạng
  thái chính xác cần đối chiếu màn Ngân hàng đề khi màn đó có mặt).
- Icon "×" ở góc trên popup (thấy trong ảnh chụp màn hình) có hành vi giống nút "Hủy" hay không —
  không có trong bảng control của spec, suy luận theo quy ước UI thông thường (xem ADD-11/EDIT-11).
- Cơ chế phân quyền theo vai trò (Admin CMS vs vai trò khác) có áp dụng cho menu này không (xem
  PERM-01) — Statement chỉ nêu "Là Admin CMS, tôi muốn...", chưa chắc đã có enforcement thực tế.

**Ngoài phạm vi file này** (cần testcase riêng khi các màn liên quan được đặc tả): việc Section
được tái sử dụng thực tế trong màn cấu hình Kỳ thi và màn xây dựng Đề thi (Ngân hàng đề) — Statement
có nhắc tới mục đích này nhưng 2 màn đó chưa có spec/ảnh chụp để viết case cụ thể.

---

## 1. Danh sách Section

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| LIST-01 | Truy cập menu hiển thị đúng bảng danh sách | Vào menu `Quản lý ôn thi` → `Quản lý Section` | Hiển thị bảng với các cột: STT, Tên section, Kỹ năng, Thời lượng, Thao tác (Sửa/Xóa) | Chưa test | — |
| LIST-02 | Thứ tự danh sách: mới nhất lên đầu | Tạo mới liên tiếp 2 Section A rồi B | B (tạo sau) hiển thị phía trên A trong bảng | Chưa test | — |
| LIST-03 | Thời lượng rỗng hiển thị "—" | Quan sát 1 Section không nhập Thời lượng khi tạo | Cột Thời lượng hiển thị ký tự "—" | Chưa test | — |
| LIST-04 | Tổng số section hiển thị đúng | Đối chiếu số "X section" góc phải với số dòng thực tế trong bảng (không lọc/tìm kiếm) | Số hiển thị khớp đúng tổng số bản ghi | Chưa test | — |
| LIST-05 | Tìm kiếm tương đối theo tên | Nhập 1 phần tên (vd. "Reading") vào ô tìm kiếm | Chỉ hiển thị các Section có tên chứa chuỗi đã nhập (không phân biệt hoa/thường) | Chưa test | — |
| LIST-06 | Tìm kiếm không có kết quả | Nhập chuỗi không khớp tên Section nào | Bảng hiển thị rỗng / thông báo không có dữ liệu, không lỗi hệ thống | Chưa test | — |
| LIST-07 | Lọc theo Kỹ năng | Chọn 1 giá trị cụ thể ở dropdown "Tất cả kỹ năng" (vd. "Đọc") | Bảng chỉ hiển thị Section có Kỹ năng = giá trị đã chọn | Chưa test | — |
| LIST-08 | Bỏ lọc kỹ năng | Sau khi đã lọc, chọn lại "Tất cả kỹ năng" | Hiển thị lại đầy đủ toàn bộ Section | Chưa test | — |
| LIST-09 | Kết hợp tìm kiếm + lọc kỹ năng | Nhập từ khóa tìm kiếm VÀ chọn 1 Kỹ năng cùng lúc | Kết quả thỏa đồng thời cả 2 điều kiện (AND) | Chưa test | — |
| LIST-10 | Danh sách kỹ năng trong dropdown lọc đúng với danh sách hard-code | Mở dropdown "Tất cả kỹ năng", đối chiếu với danh sách kỹ năng dev cung cấp | Danh sách khớp đầy đủ, không thiếu/thừa | Chưa test | — |
| LIST-11 | Danh sách trống khi hệ thống chưa có Section nào | Vào màn Quản lý Section khi thực sự không còn bản ghi Section nào (không phải do lọc/tìm kiếm) | Hiển thị trạng thái rỗng rõ ràng (vd. "Chưa có section nào"), không lỗi hệ thống; số đếm hiển thị "0 section" | Chưa test | — |

## 2. Thêm mới Section

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| ADD-01 | Mở popup Thêm mới | Bấm nút "+ Thêm mới" | Popup "Thêm mới section" mở ra, 3 field (Tên phần thi, Kỹ năng, Thời lượng) đều trống, placeholder đúng như mô tả | Chưa test | — |
| ADD-02 | Validate thiếu "Tên phần thi" | Để trống Tên phần thi, chọn Kỹ năng hợp lệ, bấm Lưu | Hiển thị lỗi tương ứng ngay dưới field Tên phần thi; KHÔNG tạo mới; popup vẫn mở | Chưa test | — |
| ADD-03 | Validate thiếu "Kỹ năng" | Nhập Tên phần thi hợp lệ, không chọn Kỹ năng, bấm Lưu | Hiển thị lỗi tương ứng ngay dưới field Kỹ năng; KHÔNG tạo mới; popup vẫn mở | Chưa test | — |
| ADD-04 | Validate thiếu đồng thời cả 2 field bắt buộc | Để trống cả Tên phần thi và Kỹ năng, bấm Lưu | Hiển thị lỗi cho CẢ 2 field cùng lúc; KHÔNG tạo mới | Chưa test | — |
| ADD-05 | Thời lượng không bắt buộc | Nhập đủ Tên phần thi + Kỹ năng, để trống Thời lượng, bấm Lưu | Tạo mới thành công; dòng mới trong bảng hiển thị Thời lượng = "—" | Chưa test | — |
| ADD-06 | Thời lượng chỉ nhận số nguyên | Thử nhập chữ cái/ký tự đặc biệt/số thập phân vào field Thời lượng | Không cho nhập ký tự không hợp lệ, hoặc báo lỗi khi Lưu (xác nhận hành vi thật trước khi gắn kết quả Pass/Fail) | Chưa test | — |
| ADD-07 | Tạo mới hợp lệ đầy đủ 3 field | Nhập Tên phần thi, chọn Kỹ năng, nhập Thời lượng là số nguyên dương, bấm Lưu | Tạo mới thành công; popup đóng; dòng mới xuất hiện ở đầu bảng với đúng dữ liệu vừa nhập (Thời lượng kèm đơn vị "phút") | Chưa test | — |
| ADD-08 | [Edge — chưa có rule chính thức] Thời lượng = 0 hoặc số âm | Nhập 0 hoặc số âm vào Thời lượng, bấm Lưu | Quan sát khách quan hành vi thực tế (chặn hay cho lưu) — **Exploratory**, cần BA xác nhận rule | Chưa test | — |
| ADD-09 | Bấm Hủy khi đang nhập dở | Nhập dữ liệu vào cả 3 field, bấm "Hủy" | Popup đóng, KHÔNG tạo mới, danh sách giữ nguyên như trước khi mở popup | Chưa test | — |
| ADD-10 | [Edge — chưa có rule chính thức] Tạo 2 Section trùng tên | Tạo Section A, sau đó tạo tiếp Section khác với tên trùng hệt A | Quan sát khách quan: hệ thống có chặn trùng tên hay cho phép tồn tại song song — **Exploratory**, cần BA xác nhận | Chưa test | — |
| ADD-11 | Đóng popup bằng icon "×" góc trên bên phải | Nhập dữ liệu vào popup Thêm mới, bấm icon "×" (không phải nút Hủy) | Hành vi giống hệt bấm Hủy: popup đóng, KHÔNG tạo mới, danh sách giữ nguyên | Chưa test | — |
| ADD-12 | Popup Thêm mới không giữ dữ liệu cũ sau khi Lưu thành công | Tạo mới 1 Section thành công, sau đó bấm lại "+ Thêm mới" | Popup mở ra với cả 3 field đều trống (không còn dữ liệu của lần tạo trước) | Chưa test | — |
| ADD-13 | [Edge — chưa có rule chính thức] Tên phần thi chỉ gồm khoảng trắng | Nhập toàn dấu cách vào Tên phần thi, chọn Kỹ năng hợp lệ, bấm Lưu | Quan sát khách quan: hệ thống coi là rỗng và báo lỗi bắt buộc, hay chấp nhận lưu — **Exploratory**, cần BA xác nhận | Chưa test | — |

## 3. Chỉnh sửa Section

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| EDIT-01 | Mở popup Sửa hiển thị đúng dữ liệu hiện tại | Bấm icon "Sửa" trên 1 dòng Section | Popup mở ra, 3 field được điền sẵn đúng với dữ liệu hiện tại của dòng đó | Chưa test | — |
| EDIT-02 | Sửa Tên phần thi | Đổi Tên phần thi sang giá trị mới hợp lệ, bấm Lưu | Lưu thành công; bảng danh sách cập nhật tên mới ngay lập tức, không cần tải lại trang | Chưa test | — |
| EDIT-03 | Sửa Kỹ năng | Đổi Kỹ năng sang giá trị khác, bấm Lưu | Lưu thành công; cột Kỹ năng cập nhật đúng giá trị mới; bộ lọc Kỹ năng phản ánh đúng thay đổi | Chưa test | — |
| EDIT-04 | Sửa Thời lượng của Section đã gắn vào Đề thi — không cascade | Gắn Section X (Thời lượng = 20) vào 1 Đề thi, sau đó sửa Thời lượng của Section X thành 30 ở màn Quản lý Section, Lưu | Section X trong danh sách hiển thị Thời lượng = 30; Thời lượng của Section X bên trong Đề thi đã gắn **vẫn giữ nguyên 20**, không tự cập nhật theo | Chưa test | — |
| EDIT-05 | Thời lượng trong Đề thi vẫn sửa được riêng | Sau EDIT-04, vào Đề thi đã gắn Section X, sửa riêng giá trị Thời lượng tại đó | Sửa được độc lập, không ảnh hưởng ngược lại giá trị Thời lượng gốc ở màn Quản lý Section | Chưa test | — |
| EDIT-06 | Validate khi Sửa: xóa trống Tên phần thi | Mở Sửa 1 Section, xóa trống Tên phần thi, bấm Lưu | Hiển thị lỗi tương ứng; KHÔNG lưu thay đổi; dữ liệu gốc không đổi | Chưa test | — |
| EDIT-07 | Validate khi Sửa: bỏ chọn Kỹ năng | Mở Sửa 1 Section, bỏ chọn Kỹ năng (nếu UI cho phép), bấm Lưu | Hiển thị lỗi tương ứng; KHÔNG lưu thay đổi | Chưa test | — |
| EDIT-08 | Bấm Hủy khi đang sửa | Mở Sửa, thay đổi dữ liệu, bấm "Hủy" | Popup đóng, dữ liệu gốc của Section giữ nguyên, danh sách không đổi | Chưa test | — |
| EDIT-09 | Sửa Thời lượng từ có giá trị về trống | Mở Sửa 1 Section đang có Thời lượng, xóa trống field này, bấm Lưu | Lưu thành công; cột Thời lượng của Section đó chuyển về hiển thị "—" | Chưa test | — |
| EDIT-10 | Vị trí trong danh sách không đổi sau khi Sửa | Sửa Tên/Kỹ năng/Thời lượng của 1 Section không phải mới nhất, Lưu lại | Section vẫn giữ nguyên vị trí theo thứ tự tạo mới nhất ban đầu, KHÔNG nhảy lên đầu danh sách theo thời điểm sửa | Chưa test | — |
| EDIT-11 | Đóng popup Sửa bằng icon "×" | Mở Sửa, thay đổi dữ liệu, bấm icon "×" góc trên bên phải | Hành vi giống Hủy: popup đóng, dữ liệu gốc giữ nguyên, danh sách không đổi | Chưa test | — |
| EDIT-12 | Sửa Section đã gắn Đề thi đã Công khai vẫn được phép (khác với Xóa) | Gắn Section vào 1 Đề thi đã Công khai, mở Sửa Section đó và đổi Tên/Kỹ năng, bấm Lưu | Lưu thành công bình thường — AC chỉ giới hạn việc XÓA với Đề thi đã Công khai, không giới hạn việc SỬA; cần xác nhận lại với BA nếu đây không phải hành vi mong muốn | Chưa test | — |
| EDIT-13 | [Exploratory] Sửa Tên/Kỹ năng của Section đã gắn Đề thi — có cascade hay không | Gắn Section X vào 1 Đề thi, đổi Tên phần thi hoặc Kỹ năng của Section X (không phải Thời lượng), Lưu, rồi xem lại Đề thi đã gắn | Spec chỉ nêu rõ rule không-cascade cho riêng Thời lượng; quan sát khách quan Tên/Kỹ năng hiển thị trong Đề thi có cập nhật theo hay giữ bản cũ — **Exploratory**, cần BA xác nhận rule chính thức | Pass (live-verify 2026-10-19: Tên + Kỹ năng cascade, chỉ Thời lượng độc lập — xem thêm nhóm 6 SYNC) | — |
| EDIT-14 | Validate khi Sửa: nhập Thời lượng sai định dạng (không phải số nguyên) | Mở Sửa 1 Section, sửa Thời lượng thành giá trị sai định dạng (chữ cái/ký tự đặc biệt/số thập phân/số âm), bấm Lưu | Không cho nhập ký tự không hợp lệ, hoặc hiển thị lỗi định dạng khi bấm Lưu; KHÔNG lưu giá trị sai định dạng, Thời lượng gốc giữ nguyên (hành vi đối xứng với ADD-06 ở popup Thêm mới) | Chưa test | — |

## 4. Xóa Section

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| DEL-01 | Xóa Section chưa gắn vào Đề thi nào | Bấm icon "Xóa" trên 1 Section chưa được dùng ở Đề thi nào → popup xác nhận → Đồng ý | Popup xác nhận xóa hiển thị; sau khi đồng ý, Section biến mất khỏi danh sách, xóa thành công | Chưa test | — |
| DEL-02 | Xóa Section đã gắn Đề thi nhưng Đề thi CHƯA Công khai | Gắn Section vào 1 Đề thi ở trạng thái chưa công khai, sau đó xóa Section đó | Cho phép xóa thành công (popup xác nhận → Đồng ý → xóa được) | Chưa test | — |
| DEL-03 | Xóa Section đã gắn Đề thi ĐÃ Công khai | Gắn Section vào 1 Đề thi đã ở trạng thái Công khai, sau đó thử xóa Section đó | KHÔNG cho phép xóa — nút Xóa bị ẩn/disable, hoặc hệ thống báo lỗi chặn xóa khi xác nhận; Section vẫn còn trong danh sách | Chưa test | — |
| DEL-04 | Xóa Section đang được gắn vào Kỳ thi | Gắn Section vào 1 Kỳ thi (Section không nằm trong Đề thi đã công khai nào), sau đó xóa Section đó | Hệ thống vẫn cho phép xóa thành công dù Section đang gắn vào Kỳ thi | Chưa test | — |
| DEL-05 | Hủy ở popup xác nhận xóa | Bấm icon "Xóa" → popup xác nhận hiện ra → bấm Hủy/đóng popup | Section KHÔNG bị xóa, vẫn còn nguyên trong danh sách | Chưa test | — |
| DEL-06 | [Edge] Section vừa gắn Đề thi đã công khai vừa gắn Đề thi chưa công khai | Gắn 1 Section vào 2 Đề thi: 1 đã Công khai + 1 chưa Công khai, sau đó thử xóa Section | KHÔNG cho phép xóa — rule chặn vì có ÍT NHẤT 1 đề đã Công khai được ưu tiên áp dụng | Chưa test | — |
| DEL-07 | Số đếm "X section" giảm đúng sau khi xóa thành công | Ghi nhận số "X section" trước khi xóa, thực hiện DEL-01 (xóa 1 Section hợp lệ) | Số đếm giảm đúng 1 đơn vị so với trước khi xóa, không cần tải lại trang | Chưa test | — |

## 5. Phân quyền truy cập

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| PERM-01 | [Exploratory] Tài khoản không có quyền Admin CMS truy cập menu Quản lý Section | Đăng nhập bằng tài khoản CMS không có quyền Admin (nếu hệ thống có phân quyền theo vai trò), thử truy cập menu `Quản lý ôn thi / Quản lý Section` | Theo Statement ("Là Admin CMS, tôi muốn..."), menu/chức năng này nên giới hạn cho vai trò Admin — cần BA/Dev xác nhận cơ chế phân quyền thực tế (ẩn menu, chặn truy cập, hay không giới hạn) trước khi gắn kết quả Pass/Fail | Chưa test | — |

## 6. Đồng bộ dữ liệu Section sang Kỳ thi / Đề thi

Nhóm case xác nhận mục tiêu tái sử dụng nêu ở Statement: dữ liệu Section (Tên, Kỹ năng) sau khi
Thêm mới/Sửa phải phản ánh đúng, ngay lập tức ở 2 màn tiêu thụ dữ liệu — Ngân hàng đề thi (Đề thi)
và Quản lý kỳ thi (Kỳ thi). SYNC-01/02/03/04 đã **live-verify 2026-10-19** trên CMS-dev
(`parotedu-cms.codeinet.com`); SYNC-05/06 suy luận cùng cơ chế nhưng chưa trực tiếp test trên màn
Kỳ thi.

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| SYNC-01 | Section mới tạo hiển thị ngay trong dropdown chọn Section ở Đề thi | Tạo mới 1 Section ở màn Quản lý Section, không tải lại trang, sang Ngân hàng đề thi → mở 1 Đề thi (hoặc Tạo mới) → mở dropdown "Chọn section để thêm vào đề" | Section vừa tạo xuất hiện ngay trong danh sách để chọn, không cần F5/tải lại trang | Pass (live-verify, chưa automate) | — |
| SYNC-02 | Section mới tạo hiển thị ngay trong dropdown chọn Section ở Kỳ thi | Tạo mới 1 Section, không tải lại trang, sang Quản lý kỳ thi → Sửa 1 Kỳ thi → mở dropdown "Chọn section để gắn" (mục Cấu hình đề xuất) | Section vừa tạo xuất hiện ngay trong danh sách để chọn, không cần tải lại trang | Pass (live-verify, chưa automate) | — |
| SYNC-03 | Sửa Tên phần thi của Section đã gắn Đề thi → Đề thi hiển thị đúng tên mới | Gắn Section X vào 1 Đề thi (Lưu), sang Quản lý Section đổi Tên phần thi của X (Lưu), quay lại mở Đề thi đã gắn | Đề thi hiển thị NGAY tên mới của Section X, không giữ tên cũ, không cần thao tác gì thêm trên Đề thi | Pass (live-verify, chưa automate) | — |
| SYNC-04 | Sửa Kỹ năng của Section đã gắn Đề thi → Đề thi hiển thị đúng kỹ năng mới | Gắn Section X vào 1 Đề thi (Lưu), sang Quản lý Section đổi Kỹ năng của X (Lưu), quay lại mở Đề thi đã gắn | Đề thi hiển thị NGAY nhãn kỹ năng mới cạnh tên Section X | Pass (live-verify, chưa automate) | — |
| SYNC-05 | Sửa Tên/Kỹ năng của Section đã gắn Kỳ thi → Kỳ thi hiển thị đúng dữ liệu mới | Gắn Section Y vào mục "Cấu hình đề xuất" của 1 Kỳ thi (Lưu), sang Quản lý Section đổi Tên và/hoặc Kỹ năng của Y (Lưu), quay lại mở Kỳ thi đã gắn | [Chưa live-verify riêng trên màn Kỳ thi — suy luận cùng cơ chế với SYNC-03/04 vì cùng là tham chiếu Section, cần xác nhận lại] Kỳ thi hiển thị đúng Tên/Kỹ năng mới của Section Y | Chưa test | — |
| SYNC-06 | Section bị xóa biến mất sạch khỏi cấu trúc Đề thi đang tham chiếu | Gắn Section Z vào 1 Đề thi chưa công khai (Lưu), xóa Section Z ở Quản lý Section (được phép vì đề chưa công khai — xem DEL-02), mở lại Đề thi đó | Đề thi hiển thị "Chưa có section nào trong đề", không lỗi, không còn tham chiếu mồ côi (orphan reference) đến Section đã xóa | Pass (live-verify, chưa automate) | — |

**Lưu ý khi đọc nhóm này**: màn Kỳ thi (mục "Cấu hình đề xuất") chỉ hiển thị Tên + Kỹ năng cho mỗi
Section gắn vào, KHÔNG có trường Thời lượng riêng như màn Đề thi (mục "Cấu trúc đề") — vì vậy rule
"Thời lượng không cascade" (EDIT-04) chỉ áp dụng và có ý nghĩa ở màn Đề thi, không có case tương ứng
ở màn Kỳ thi.

## 7. Phân trang danh sách Section

Control thật quan sát được trên CMS-dev: `Tổng X bản ghi | ◀ [số trang] ▶ | Hiển thị: [10/20/50/100]
/ trang` — không có trong bảng control gốc của spec (spec chỉ mô tả "Bảng danh sách" chung chung).
Mặc định 10/trang. PAGE-02/03/04/05/08 đã **live-verify nhanh 2026-10-19** trên CMS-dev (dữ liệu do
người dùng tự tạo ~11 Section); PAGE-01/06/07/09/10 suy luận theo hành vi pagination chuẩn hoặc theo
đối xứng với case đã verify, **chưa chạy tay** — cần bạn tự test lại theo đúng yêu cầu.

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| PAGE-01 | Số bản ghi ≤ page size → không có nút chuyển trang | Có ≤10 Section (đúng page size mặc định), quan sát khu vực phân trang | Chỉ hiển thị trang "1", không có nút trang "2" trở đi (hoặc nút có nhưng không khả dụng) | Chưa test | — |
| PAGE-02 | Số bản ghi > page size → xuất hiện trang kế tiếp | Tạo đủ > 10 Section (vd. 11), quan sát khu vực phân trang | Xuất hiện thêm nút trang "2"; nút "▶" (trang sau) chuyển từ disable sang khả dụng | Pass (live-verify nhanh, chưa automate) | — |
| PAGE-03 | Chuyển sang trang 2 hiển thị đúng dữ liệu, STT không reset | Đang ở trang 1 (11 bản ghi, 10/trang), bấm vào trang "2" | Trang 2 hiển thị đúng (các) bản ghi còn lại; cột STT tiếp tục đánh số toàn cục (vd. bản ghi thứ 11 vẫn mang STT 11, KHÔNG nhảy về STT 1) | Pass (live-verify nhanh, chưa automate) | — |
| PAGE-04 | Quay lại trang 1 từ trang 2 | Đang ở trang 2, bấm nút "◀" (trang trước) hoặc bấm trực tiếp vào số "1" | Quay lại đúng trang 1 với đủ 10 bản ghi đầu | Pass (live-verify nhanh, chưa automate) | — |
| PAGE-05 | Nút "◀" (trang trước) bị vô hiệu hoá khi đang ở trang đầu | Quan sát nút "◀" khi đang ở trang 1 | Nút ở trạng thái disabled (không bấm được / không đổi trang khi bấm) | Pass (live-verify nhanh, chưa automate) | — |
| PAGE-06 | Nút "▶" (trang sau) bị vô hiệu hoá khi đang ở trang cuối | Chuyển tới trang cuối cùng, quan sát nút "▶" | [Chưa live-verify — suy luận đối xứng với PAGE-05] Nút ở trạng thái disabled khi đang ở trang cuối | Chưa test | — |
| PAGE-07 | Đổi số bản ghi/trang (10 → 20/50/100) gộp nhiều bản ghi hơn trên 1 trang | Đang có > 10 Section và nhiều hơn 1 trang, mở dropdown "Hiển thị", chọn "20 / trang" (hoặc 50/100) | [Chưa live-verify] Bảng hiển thị nhiều bản ghi hơn trên cùng 1 trang theo đúng giá trị mới chọn; số trang giảm tương ứng (vd. nếu tổng ≤ giá trị mới thì chỉ còn 1 trang) | Chưa test | — |
| PAGE-08 | Tìm kiếm khi đang ở trang 2 → tự động quay về trang 1 | Đang ở trang 2, nhập từ khóa vào ô tìm kiếm tên section | Hệ thống tự động quay về trang 1, hiển thị kết quả lọc đúng theo từ khóa (không kẹt ở trang 2 với danh sách rỗng) | Pass (live-verify nhanh, chưa automate) | — |
| PAGE-09 | Lọc theo Kỹ năng khi đang ở trang 2 → tự động quay về trang 1 | Đang ở trang 2, chọn 1 giá trị cụ thể ở dropdown "Tất cả kỹ năng" | [Chưa live-verify — suy luận cùng cơ chế với PAGE-08] Hệ thống tự động quay về trang 1, hiển thị kết quả lọc đúng theo kỹ năng đã chọn | Chưa test | — |
| PAGE-10 | Số đếm tổng "X section" luôn phản ánh TOÀN BỘ bản ghi, không chỉ trang hiện tại | Đối chiếu số "X section" góc phải khi đang ở trang 2 (chỉ hiển thị 1 vài dòng) với tổng số bản ghi thật | Số đếm hiển thị đúng tổng toàn bộ (vd. "11 section"), không bị nhầm thành số dòng hiển thị trên trang hiện tại | Pass (đã quan sát xuyên suốt các lần live-verify trước, chưa automate) | — |

---

## Ghi chú chạy test

Tính năng chưa có script tự động hoá (Playwright) tại thời điểm viết file này — toàn bộ case trên
cần chạy tay trước. Khi có automation, bổ sung thư mục `automation/quan_ly_on_thi/` (theo đúng quy
ước thư mục của `automation/quan_ly_goi_dich_vu/`) và cập nhật cột "Automation" + "Trạng thái" ở
từng bảng, tương tự cách tổ chức tại [`flows/cms/goi_dich_vu/TESTCASES.md`](../../goi_dich_vu/TESTCASES.md).
