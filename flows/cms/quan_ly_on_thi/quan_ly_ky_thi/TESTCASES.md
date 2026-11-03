# Testcase — CMS Quản lý (Web Admin): Quản lý ôn thi / Quản lý kỳ thi

Nguồn: Statement (1.3.1) + Flow (1.3.2) + mô tả màn hình (1.3.3) + Acceptance Criteria (1.3.4) do
người dùng cung cấp trong hội thoại (2026-10-20), kèm 2 ảnh chụp màn hình (danh sách Kỳ thi, popup
Thêm mới kỳ thi).

**Tính năng**: tính năng mới trong module CMS "Quản lý ôn thi" (breadcrumb `Quản lý ôn thi / Quản lý
kỳ thi`), cho phép Admin CRUD các **Kỳ thi** (loại kỳ thi dùng để phân loại Đề thi — vd. "Kỳ thi tốt
nghiệp THPT", "Kỳ thi vào lớp 10", "Cambridge A2 Flyers"). Khi tạo Đề thi và chọn 1 Kỳ thi, hệ thống
tự đề xuất cấu trúc đề (danh sách Section theo đúng thứ tự khai báo trong Kỳ thi) và chỉ cho chọn
Bảng điểm đúng Dạng quy đổi của Kỳ thi đó, tránh người tạo đề chọn nhầm cách tính điểm.

Cùng module với [`../quan_ly_section/TESTCASES.md`](../quan_ly_section/TESTCASES.md) (Section) và
[`../cau_hinh_bang_diem/TESTCASES.md`](../cau_hinh_bang_diem/TESTCASES.md) (Bảng điểm) — Kỳ thi là
màn "tiêu thụ" dữ liệu của cả 2 màn kia (gắn Section vào Cấu hình đề xuất, chọn Dạng quy đổi để lọc
Bảng điểm hợp lệ ở màn Đề thi).

**Cập nhật (2026-11-03)**: đã có automation Playwright tại
`flows/cms/quan_ly_on_thi/quan_ly_ky_thi/*.spec.js` (chạy `cd automation && npm run
test-quan-ly-ky-thi-pw`), môi trường dev (`CMS_ADMIN_URL_DEV=https://parotedu-cms.codeinet.com`,
tài khoản `CMS_USERNAME_DEV`/`CMS_PASSWORD_DEV` trong `.env`). 47/66 case đã chạy thật PASS trên
dev; 19 case còn lại `test.skip()` kèm lý do cụ thể (chủ yếu cần thao tác trên màn "Ngân hàng đề
thi" — màn KHÁC `/exam-prep/exam-types`, ngoài phạm vi automation lần này; xem cột "Automation" ở
từng dòng và `ky-thi-perm-sync.spec.js`). LIST-08/ADD-16 bị skip vì cần xóa sạch dữ liệu Kỳ thi/
Section thật trên dev — không an toàn để automation tự thực hiện trên môi trường dùng chung.

Trong lúc automate đã xác nhận thật (không suy đoán) một số hành vi mà spec gốc chưa nêu rõ:
- Dạng quy đổi LUÔN pre-fill sẵn "Phổ thông" và KHÔNG thể xoá trống (giống Bảng điểm) → ADD-03
  không áp dụng được, đã `test.skip()`.
- Trùng tên Kỳ thi BỊ CHẶN với lỗi "Tên kỳ thi đã tồn tại" (giống rule Section/Bảng điểm) → ADD-21.
- Tên kỳ thi giới hạn tối đa 500 ký tự, vượt quá bị chặn Lưu với lỗi "Tên kỳ thi tối đa 500 ký tự"
  → ADD-23 (ban đầu viết dạng Exploratory, sau khi chạy thật đã chốt lại thành assertion xác định).
- Mỗi dòng "Section đã gắn" trong "Cấu hình đề xuất" có 3 nút CÓ accessible name thật ("Lên trên",
  "Xuống dưới", "Bỏ gắn") — không phải icon-only vô danh như lo ngại ban đầu.

**Giả định cần xác nhận với BA/Dev trước khi chạy** (spec chưa nêu rõ):
- Màn danh sách Kỳ thi (ảnh chụp 1) **không có droplist lọc** nào (chỉ có ô Tìm kiếm), khác hẳn 2 màn
  sibling Section/Bảng điểm đều có thêm droplist lọc (theo Kỹ năng / theo Dạng quy đổi). Cần xác nhận
  đây là thiết kế có chủ đích (Dạng quy đổi hiện chỉ có 1 giá trị nên chưa cần lọc) hay thiếu sót cần
  bổ sung khi có thêm Dạng quy đổi khác (xem LIST-07).
- Ảnh chụp popup Thêm mới cho thấy field "Dạng quy đổi" đã **sẵn giá trị "Phổ thông"** khi mở popup
  (không phải trống với placeholder "Chọn dạng quy đổi" như mô tả). Cần xác nhận field có cho phép để
  trống/bắt buộc Admin tự chọn, hay luôn tự động pre-fill giá trị duy nhất hiện có (xem ADD-01/ADD-03).
- Spec không nói rõ rule **Sửa** có bị chặn khi Kỳ thi đã gắn Đề thi hay không (chỉ nêu rule chặn cho
  **Xóa**). Khác với Bảng điểm (chặn Sửa khi gắn Đề thi đã Công khai), tại đây suy luận Sửa luôn được
  phép bất kể trạng thái gắn Đề thi — cần xác nhận lại với BA đây có đúng chủ ý hay là thiếu sót của
  spec (xem EDIT-06).
- Rule Xóa của AC ("Khi đã gắn kỳ thi vào đề thi -> Không cho phép xóa") **không phân biệt** Đề thi đã
  Công khai hay chưa — khác với Section (chỉ chặn khi đề đã Công khai) nhưng **giống** Bảng điểm (chặn
  tuyệt đối một khi đã gắn). Cần xác nhận đây không phải lỗi đánh máy khi so với rule Section (xem
  DEL-02/DEL-03).
- Có giới hạn độ dài ký tự cho Tên kỳ thi / Mô tả hay không — spec không nêu.
- Có cho phép trùng tên Kỳ thi hay không — spec không nêu rule unique.
- Icon "×" góc trên popup có hành vi giống nút "Hủy" hay không — không có trong bảng control của spec,
  suy luận theo quy ước UI thông thường (và theo cách 2 màn sibling đã làm).
- Cơ chế phân quyền theo vai trò (Admin vs vai trò khác) có áp dụng cho menu này không — Statement chỉ
  nêu "Là quản trị viên, tôi muốn...", chưa chắc đã có enforcement thực tế (xem PERM-01).
- Nội dung đầy đủ rule tính điểm theo từng Dạng quy đổi (tương tự mục 13.4.4 được Bảng điểm dẫn chiếu)
  không có trong phần spec được cung cấp ở đây — hiện chưa ảnh hưởng vì Dạng quy đổi mới chỉ có 1 giá
  trị "Phổ thông".
- Ảnh chụp danh sách Kỳ thi được cung cấp chỉ có 3 bản ghi, chưa đủ để quan sát khu vực phân trang.
  Nhóm 7 (PAGE) suy luận màn này dùng chung control phân trang đã quan sát thực tế ở màn Section/Bảng
  điểm ("Tổng X bản ghi | ◀ [số trang] ▶ | Hiển thị: [10/20/50/100] / trang", mặc định 10/trang) — cần
  xác nhận lại bằng cách tạo đủ > 10 Kỳ thi rồi quan sát trực tiếp (xem PAGE-01).

**Ngoài phạm vi file này** (cần testcase riêng khi màn liên quan được đặc tả đầy đủ): chi tiết màn Đề
thi (Ngân hàng đề) — nơi Admin thực sự chọn Kỳ thi khi tạo Đề thi, nhận cấu trúc đề xuất, và bị giới
hạn danh sách Bảng điểm theo Dạng quy đổi. Hiện chưa có ảnh chụp/spec riêng cho màn đó nên nhóm 6
(SYNC) chỉ viết case ở mức suy luận hợp lý từ AC mục 1.3.4, cần đối chiếu lại khi màn Đề thi có mặt.

---

## 1. Danh sách Kỳ thi

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| LIST-01 | Truy cập menu hiển thị đúng bảng danh sách | Vào menu `Quản lý ôn thi` → `Quản lý kỳ thi` | Hiển thị bảng với các cột: STT, Tên kỳ thi, Mô tả, Thao tác (Sửa/Xóa); góc phải hiển thị tổng số "X kỳ thi" | Pass (automated, live-run dev 2026-11-03) | [ky-thi-list.spec.js](ky-thi-list.spec.js) `LIST-01` |
| LIST-02 | Thứ tự danh sách: mới nhất lên đầu | Tạo mới liên tiếp 2 Kỳ thi A rồi B | B (tạo sau) hiển thị phía trên A trong bảng | Pass (automated, live-run dev 2026-11-03) | [ky-thi-list.spec.js](ky-thi-list.spec.js) `LIST-02` |
| LIST-03 | Tổng số kỳ thi hiển thị đúng | Đối chiếu số "X kỳ thi" góc phải với số dòng thực tế trong bảng (không tìm kiếm) | Số hiển thị khớp đúng tổng số bản ghi | Pass (automated, live-run dev 2026-11-03) | [ky-thi-list.spec.js](ky-thi-list.spec.js) `LIST-03` |
| LIST-04 | Tìm kiếm tương đối theo tên kỳ thi | Nhập 1 phần tên (vd. "THPT") vào ô "Tìm theo tên kỳ thi..." | Chỉ hiển thị các Kỳ thi có tên chứa chuỗi đã nhập, không phân biệt hoa/thường | Pass (automated, live-run dev 2026-11-03) | [ky-thi-list.spec.js](ky-thi-list.spec.js) `LIST-04` |
| LIST-05 | Tìm kiếm không có kết quả | Nhập chuỗi không khớp tên Kỳ thi nào | Bảng hiển thị rỗng / thông báo không có dữ liệu, không lỗi hệ thống | Pass (automated, live-run dev 2026-11-03) | [ky-thi-list.spec.js](ky-thi-list.spec.js) `LIST-05` |
| LIST-06 | Cột Mô tả khi không nhập Mô tả lúc tạo | Tạo 1 Kỳ thi để trống Mô tả, quan sát dòng tương ứng trong bảng | Cột Mô tả hiển thị trống hoặc ký tự placeholder (vd. "—") — xác nhận hành vi thật trước khi gắn Pass/Fail | Pass (automated, live-run dev 2026-11-03) | [ky-thi-list.spec.js](ky-thi-list.spec.js) `LIST-06` |
| LIST-07 | [Exploratory] Không có droplist lọc theo Dạng quy đổi trên màn danh sách | Quan sát khu vực tìm kiếm/lọc của màn Quản lý kỳ thi | Hiện tại chỉ có 1 ô Tìm kiếm, không có droplist lọc nào khác — xác nhận đây là thiết kế có chủ đích (xem Giả định) chứ không phải thiếu sót | Pass (automated, live-run dev 2026-11-03) | [ky-thi-list.spec.js](ky-thi-list.spec.js) `LIST-07` |
| LIST-08 | Danh sách trống khi hệ thống chưa có Kỳ thi nào | Vào màn Quản lý kỳ thi khi thực sự không còn bản ghi nào (không phải do tìm kiếm) | Hiển thị trạng thái rỗng rõ ràng (vd. "Chưa có kỳ thi nào"), không lỗi hệ thống; số đếm hiển thị "0 kỳ thi" | Skip (automated) - cần xóa sạch dữ liệu Kỳ thi thật trên dev, không an toàn trên môi trường dùng chung | [ky-thi-list.spec.js](ky-thi-list.spec.js) `LIST-08` |

## 2. Thêm mới Kỳ thi

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| ADD-01 | Mở popup Thêm mới | Bấm nút "+ Thêm mới" | Popup "Thêm mới kỳ thi" mở ra; Tên kỳ thi và Mô tả trống với đúng placeholder; xác nhận giá trị mặc định thật sự của Dạng quy đổi (pre-fill sẵn "Phổ thông" theo ảnh chụp, hay trống với placeholder — xem Giả định); Cấu hình đề xuất/Section đã gắn trống, KHÔNG hiển thị dòng "Tổng: N section" | Pass (automated, live-run dev 2026-11-03) | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-01` |
| ADD-02 | Validate thiếu "Tên kỳ thi" | Để trống Tên kỳ thi, giữ Dạng quy đổi mặc định, bấm Lưu | Hiển thị lỗi tương ứng ngay dưới field Tên kỳ thi; KHÔNG tạo mới; popup vẫn mở | Pass (automated, live-run dev 2026-11-03) | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-02` |
| ADD-03 | [Phụ thuộc giá trị mặc định ở ADD-01] Validate thiếu "Dạng quy đổi" | Nhập Tên kỳ thi hợp lệ, thử xóa/bỏ chọn Dạng quy đổi nếu UI cho phép để trống, bấm Lưu | Nếu field cho phép ở trạng thái trống: hiển thị lỗi bắt buộc, KHÔNG tạo mới. Nếu field luôn có sẵn giá trị mặc định (không thể để trống): case này không áp dụng được — cần Dev xác nhận | Skip (automated) - Dạng quy đổi luôn pre-fill 'Phổ thông', không thể xoá trống (đã xác nhận thật) | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-03` |
| ADD-04 | Mô tả không bắt buộc | Nhập đủ Tên kỳ thi + Dạng quy đổi, để trống Mô tả, bấm Lưu | Tạo mới thành công; dòng mới trong bảng hiển thị cột Mô tả trống/"—" | Pass (automated, live-run dev 2026-11-03) | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-04` |
| ADD-05 | Cấu hình đề xuất không bắt buộc | Nhập Tên kỳ thi hợp lệ, giữ Dạng quy đổi mặc định, KHÔNG thêm section nào, bấm Lưu | Tạo mới thành công dù không gắn section nào vào Cấu hình đề xuất | Pass (automated, live-run dev 2026-11-03) | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-05` |
| ADD-06 | Thêm 1 section vào Cấu hình đề xuất | Mở droplist "Cấu hình đề xuất", chọn 1 section, bấm "Thêm" | Section xuất hiện trong khu vực "Section đã gắn" với số thứ tự 1, hiển thị đúng tên section + kỹ năng; dòng "Tổng: 1 section" xuất hiện; section đó biến mất khỏi droplist (không chọn lại được lần 2) | Pass (automated, live-run dev 2026-11-03) | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-06` |
| ADD-07 | Thêm nhiều section theo đúng thứ tự bấm | Thêm liên tiếp 3 section A, B, C theo đúng thứ tự đó | Khu vực "Section đã gắn" hiển thị đúng thứ tự 1-A, 2-B, 3-C; dòng "Tổng: 3 section" | Pass (automated, live-run dev 2026-11-03) | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-07` |
| ADD-08 | Đổi vị trí section đã gắn bằng mũi tên lên/xuống | Với ≥2 section đã gắn, bấm mũi tên xuống (▼) ở section đang ở vị trí 1 | Section đó chuyển xuống vị trí 2; section trước đó ở vị trí 2 chuyển lên vị trí 1; số thứ tự hiển thị cập nhật đúng ngay lập tức | Pass (automated, live-run dev 2026-11-03) | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-08` |
| ADD-09 | Nút mũi tên lên (▲) vô hiệu ở section đầu tiên | Quan sát section đang ở vị trí 1 trong "Section đã gắn" | Nút mũi tên lên ở trạng thái disabled / bấm không có tác dụng | Pass (automated, live-run dev 2026-11-03) | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-09` |
| ADD-10 | Nút mũi tên xuống (▼) vô hiệu ở section cuối cùng | Quan sát section đang ở vị trí cuối cùng trong "Section đã gắn" | Nút mũi tên xuống ở trạng thái disabled / bấm không có tác dụng | Pass (automated, live-run dev 2026-11-03) | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-10` |
| ADD-11 | Xóa 1 section khỏi "Section đã gắn" | Bấm icon "×" trên 1 section đã gắn (không phải section cuối) | Section đó biến mất khỏi "Section đã gắn"; số thứ tự các section còn lại được re-index liên tục (không để trống số thứ tự); section vừa gỡ xuất hiện TRỞ LẠI trong droplist "Cấu hình đề xuất" để có thể chọn lại | Pass (automated, live-run dev 2026-11-03) | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-11` |
| ADD-12 | Dòng "Tổng: N section" ẩn khi gỡ hết section đã gắn | Từ trạng thái chỉ còn 1 section đã gắn, gỡ bỏ section duy nhất đó | Dòng "Tổng: N section" biến mất khỏi popup (đúng mô tả spec: chỉ hiện khi có ≥1 section) | Pass (automated, live-run dev 2026-11-03) | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-12` |
| ADD-13 | Chọn section trong droplist nhưng không bấm "Thêm" | Chọn 1 section ở droplist "Cấu hình đề xuất", KHÔNG bấm nút "Thêm", bấm Lưu luôn | Kỳ thi được tạo mới thành công nhưng KHÔNG gắn section vừa chọn ở droplist — section chỉ được thêm vào cấu trúc khi bấm tường minh nút "Thêm" | Pass (automated, live-run dev 2026-11-03) | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-13` |
| ADD-14 | Nút "Thêm" khi chưa chọn section nào trong droplist | Mở popup, không chọn gì ở droplist "Cấu hình đề xuất", bấm nút "Thêm" | Không có section nào được thêm vào "Section đã gắn" (hoặc nút "Thêm" ở trạng thái disabled) | Pass (automated, live-run dev 2026-11-03) | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-14` |
| ADD-15 | [Edge] Droplist "Cấu hình đề xuất" rỗng khi đã gắn hết toàn bộ Section hiện có | Thêm lần lượt toàn bộ Section đang tồn tại trong hệ thống (màn Quản lý Section) vào cấu trúc | Droplist "Cấu hình đề xuất" trở nên rỗng/disabled vì không còn section nào chưa gắn để chọn thêm | Pass (automated, live-run dev 2026-11-03) | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-15` |
| ADD-16 | [Edge] Droplist "Cấu hình đề xuất" rỗng khi hệ thống chưa có Section nào | (Cần môi trường không còn Section nào ở màn Quản lý Section) Mở popup Thêm mới Kỳ thi | Droplist trống/disabled; popup vẫn cho phép Lưu Kỳ thi không gắn section nào (vì field này không bắt buộc) | Skip (automated) - cần xóa sạch dữ liệu Section thật trên dev, không an toàn trên môi trường dùng chung | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-16` |
| ADD-17 | Tạo mới hợp lệ đầy đủ | Nhập Tên kỳ thi, Mô tả, giữ Dạng quy đổi = Phổ thông, thêm 2 section, bấm Lưu | Tạo mới thành công; popup đóng; dòng mới xuất hiện ở đầu bảng với đúng Tên kỳ thi + Mô tả vừa nhập | Pass (automated, live-run dev 2026-11-03) | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-17` |
| ADD-18 | Bấm Hủy khi đang nhập dở | Nhập dữ liệu vào các field + thêm ít nhất 1 section, bấm "Hủy" | Popup đóng, KHÔNG tạo mới, danh sách giữ nguyên như trước khi mở popup | Pass (automated, live-run dev 2026-11-03) | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-18` |
| ADD-19 | Đóng popup bằng icon "×" góc trên bên phải | Nhập dữ liệu vào popup Thêm mới, bấm icon "×" (không phải nút Hủy) | Hành vi giống hệt bấm Hủy: popup đóng, KHÔNG tạo mới, danh sách giữ nguyên | Pass (automated, live-run dev 2026-11-03) | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-19` |
| ADD-20 | Popup Thêm mới không giữ dữ liệu cũ sau khi Lưu thành công | Tạo mới 1 Kỳ thi thành công (có gắn section), sau đó bấm lại "+ Thêm mới" | Popup mở ra với Tên kỳ thi/Mô tả trống, Cấu hình đề xuất/Section đã gắn trống (không còn dữ liệu của lần tạo trước); Dạng quy đổi về đúng trạng thái mặc định ban đầu | Pass (automated, live-run dev 2026-11-03) | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-20` |
| ADD-21 | [Edge — chưa có rule chính thức] Tạo 2 Kỳ thi trùng tên | Tạo Kỳ thi A, sau đó tạo tiếp Kỳ thi khác với tên trùng hệt A | Quan sát khách quan: hệ thống có chặn trùng tên hay cho phép tồn tại song song — **Exploratory**, cần BA xác nhận | Pass (automated, live-run dev 2026-11-03) | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-21` |
| ADD-22 | [Edge — chưa có rule chính thức] Tên kỳ thi chỉ gồm khoảng trắng | Nhập toàn dấu cách vào Tên kỳ thi, bấm Lưu | Quan sát khách quan: hệ thống coi là rỗng và báo lỗi bắt buộc, hay chấp nhận lưu — **Exploratory**, cần BA xác nhận | Pass (automated, live-run dev 2026-11-03) | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-22` |
| ADD-23 | [Edge — chưa có rule chính thức] Giới hạn độ dài Tên kỳ thi / Mô tả | Nhập chuỗi rất dài (vd. 500+ ký tự) vào Tên kỳ thi và Mô tả, bấm Lưu | Quan sát khách quan: có giới hạn ký tự (chặn gõ/báo lỗi) hay cho lưu tự do — **Exploratory**, cần BA xác nhận | Pass (automated, live-run dev 2026-11-03) | [ky-thi-add.spec.js](ky-thi-add.spec.js) `ADD-23` |

## 3. Chỉnh sửa Kỳ thi

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| EDIT-01 | Mở popup Sửa hiển thị đúng dữ liệu hiện tại | Bấm icon "Sửa" trên 1 Kỳ thi | Popup mở ra, các field được điền sẵn đúng dữ liệu hiện tại: Tên kỳ thi, Mô tả, Dạng quy đổi, danh sách "Section đã gắn" đúng thứ tự hiện tại | Pass (automated, live-run dev 2026-11-03) | [ky-thi-edit.spec.js](ky-thi-edit.spec.js) `EDIT-01` |
| EDIT-02 | Sửa Tên kỳ thi → cập nhật ở các màn khác | Đổi Tên của 1 Kỳ thi đang được gắn vào ≥1 Đề thi, bấm Lưu, mở lại màn Đề thi (Ngân hàng đề) đang tham chiếu Kỳ thi đó | Tên Kỳ thi hiển thị NGAY tên mới ở màn Đề thi, đúng theo AC "Sửa tên -> cập nhật lại tên kỳ thi ở các màn" | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi `/exam-prep/exam-types`) | [ky-thi-edit.spec.js](ky-thi-edit.spec.js) `EDIT-02` |
| EDIT-03 | Sửa Cấu hình đề xuất KHÔNG ảnh hưởng Đề thi đã tạo trước đó | Tạo Đề thi X nhận cấu trúc gợi ý từ Kỳ thi Y, sau đó sửa Cấu hình đề xuất của Kỳ thi Y (thêm/bớt/đổi thứ tự section), bấm Lưu, mở lại Đề thi X | Cấu trúc của Đề thi X giữ nguyên như lúc tạo, KHÔNG tự cập nhật theo thay đổi mới của Kỳ thi Y (đúng AC: "các đề cũ được gắn với kỳ thi sẽ không thay đổi") | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi `/exam-prep/exam-types`) | [ky-thi-edit.spec.js](ky-thi-edit.spec.js) `EDIT-03` |
| EDIT-04 | Sửa Dạng quy đổi KHÔNG ảnh hưởng Bảng điểm đã chọn của Đề thi cũ | Tương tự EDIT-03 nhưng quan sát riêng Dạng quy đổi + Bảng điểm đã gắn sẵn của Đề thi X | Bảng điểm đã chọn của Đề thi X giữ nguyên, không bị đổi/mất hiệu lực dù Dạng quy đổi của Kỳ thi Y đã đổi | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi `/exam-prep/exam-types`) | [ky-thi-edit.spec.js](ky-thi-edit.spec.js) `EDIT-04` |
| EDIT-05 | Cấu trúc/Dạng quy đổi mới chỉ áp dụng cho Đề thi tạo SAU khi sửa | Ngay sau EDIT-03 (đã sửa Kỳ thi Y), tạo mới 1 Đề thi Z và chọn Kỳ thi Y | Đề thi Z nhận đúng cấu trúc gợi ý + danh sách Bảng điểm lọc theo Dạng quy đổi MỚI (đã sửa) của Kỳ thi Y, không phải cấu hình cũ | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi `/exam-prep/exam-types`) | [ky-thi-edit.spec.js](ky-thi-edit.spec.js) `EDIT-05` |
| EDIT-06 | [Cần xác nhận BA — xem Giả định] Sửa Kỳ thi đã gắn Đề thi vẫn được phép | Gắn Kỳ thi vào 1 Đề thi bất kỳ (công khai hoặc chưa), mở Sửa Kỳ thi đó, đổi Tên/Mô tả/Cấu hình đề xuất, bấm Lưu | Lưu thành công bình thường — AC chỉ giới hạn hành động XÓA, không nêu giới hạn SỬA theo trạng thái gắn Đề thi; khác với rule Sửa của Bảng điểm (chặn khi gắn đề đã Công khai) — cần xác nhận lại nếu đây không phải hành vi mong muốn | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi `/exam-prep/exam-types`) | [ky-thi-edit.spec.js](ky-thi-edit.spec.js) `EDIT-06` |
| EDIT-07 | Validate khi Sửa: xóa trống Tên kỳ thi | Mở Sửa 1 Kỳ thi, xóa trống Tên kỳ thi, bấm Lưu | Hiển thị lỗi tương ứng; KHÔNG lưu thay đổi; dữ liệu gốc không đổi | Pass (automated, live-run dev 2026-11-03) | [ky-thi-edit.spec.js](ky-thi-edit.spec.js) `EDIT-07` |
| EDIT-08 | Thêm/xóa/sắp xếp lại Section trong popup Sửa | Ở popup Sửa, lặp lại các thao tác thêm section từ droplist, xóa khỏi "Section đã gắn", đổi vị trí bằng mũi tên lên/xuống (tương tự ADD-06..ADD-12) | Hành vi giống hệt popup Thêm mới: thêm/xóa/re-index/đổi vị trí đều hoạt động đúng trong ngữ cảnh Sửa | Pass (automated, live-run dev 2026-11-03) | [ky-thi-edit.spec.js](ky-thi-edit.spec.js) `EDIT-08` |
| EDIT-09 | Bấm Hủy khi đang sửa | Mở Sửa, thay đổi dữ liệu (tên, mô tả, cấu hình đề xuất), bấm "Hủy" | Popup đóng, dữ liệu gốc của Kỳ thi giữ nguyên, danh sách không đổi | Pass (automated, live-run dev 2026-11-03) | [ky-thi-edit.spec.js](ky-thi-edit.spec.js) `EDIT-09` |
| EDIT-10 | Đóng popup Sửa bằng icon "×" | Mở Sửa, thay đổi dữ liệu, bấm icon "×" góc trên bên phải | Hành vi giống Hủy: popup đóng, dữ liệu gốc giữ nguyên, danh sách không đổi | Pass (automated, live-run dev 2026-11-03) | [ky-thi-edit.spec.js](ky-thi-edit.spec.js) `EDIT-10` |
| EDIT-11 | Vị trí trong danh sách không đổi sau khi Sửa | Sửa Tên/Mô tả/Cấu hình đề xuất của 1 Kỳ thi không phải mới nhất, Lưu lại | Kỳ thi vẫn giữ nguyên vị trí theo thứ tự tạo mới nhất ban đầu, KHÔNG nhảy lên đầu danh sách theo thời điểm sửa | Pass (automated, live-run dev 2026-11-03) | [ky-thi-edit.spec.js](ky-thi-edit.spec.js) `EDIT-11` |

## 4. Xóa Kỳ thi

AC quy định rõ: cho phép xóa Kỳ thi khi **chưa** gắn vào Đề thi nào; một khi đã gắn vào Đề thi (không
phân biệt Công khai hay chưa) thì **không** cho phép xóa. Rule này **giống** Bảng điểm (chặn tuyệt
đối khi đã gắn) và **khác** Section (Section vẫn cho xóa nếu chỉ gắn đề thi chưa công khai) — xem
Giả định đầu file.

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| DEL-01 | Xóa Kỳ thi chưa gắn vào Đề thi nào | Bấm icon "Xóa" trên 1 Kỳ thi chưa được dùng ở Đề thi nào → popup xác nhận → Đồng ý | Popup xác nhận xóa hiển thị; sau khi đồng ý, Kỳ thi biến mất khỏi danh sách, xóa thành công | Pass (automated, live-run dev 2026-11-03) | [ky-thi-delete.spec.js](ky-thi-delete.spec.js) `DEL-01` |
| DEL-02 | Xóa Kỳ thi đã gắn Đề thi CHƯA công khai | Gắn Kỳ thi vào 1 Đề thi chưa công khai, sau đó thử xóa Kỳ thi đó | KHÔNG cho phép xóa (khác rule Section, xem ghi chú đầu mục 4); nút Xóa bị ẩn/disable, hoặc hệ thống báo lỗi chặn xóa khi xác nhận | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi `/exam-prep/exam-types`) | [ky-thi-delete.spec.js](ky-thi-delete.spec.js) `DEL-02` |
| DEL-03 | Xóa Kỳ thi đã gắn Đề thi ĐÃ công khai | Gắn Kỳ thi vào 1 Đề thi đã Công khai, sau đó thử xóa Kỳ thi đó | KHÔNG cho phép xóa — nút Xóa bị ẩn/disable, hoặc hệ thống báo lỗi chặn xóa khi xác nhận; Kỳ thi vẫn còn trong danh sách | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi `/exam-prep/exam-types`) | [ky-thi-delete.spec.js](ky-thi-delete.spec.js) `DEL-03` |
| DEL-04 | Hủy ở popup xác nhận xóa | Bấm icon "Xóa" trên 1 Kỳ thi hợp lệ để xóa → popup xác nhận hiện ra → bấm Hủy/đóng popup | Kỳ thi KHÔNG bị xóa, vẫn còn nguyên trong danh sách | Pass (automated, live-run dev 2026-11-03) | [ky-thi-delete.spec.js](ky-thi-delete.spec.js) `DEL-04` |
| DEL-05 | Số đếm "X kỳ thi" giảm đúng sau khi xóa thành công | Ghi nhận số "X kỳ thi" trước khi xóa, thực hiện DEL-01 (xóa 1 Kỳ thi hợp lệ) | Số đếm giảm đúng 1 đơn vị so với trước khi xóa, không cần tải lại trang | Pass (automated, live-run dev 2026-11-03) | [ky-thi-delete.spec.js](ky-thi-delete.spec.js) `DEL-05` |
| DEL-06 | [Edge] Kỳ thi từng gắn Đề thi nhưng Đề thi đó sau đó bị xóa/gỡ gắn | Gỡ Kỳ thi khỏi Đề thi đã gắn (hoặc xóa hẳn Đề thi đó, nếu màn Đề thi cho phép), thử xóa lại Kỳ thi | Vì không còn gắn vào Đề thi nào nữa, hệ thống cho phép xóa bình thường — xác nhận hành vi thật vì phụ thuộc cách hệ thống lưu vết quan hệ (có "nhớ" từng gắn hay chỉ xét trạng thái gắn hiện tại) | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi `/exam-prep/exam-types`) | [ky-thi-delete.spec.js](ky-thi-delete.spec.js) `DEL-06` |

## 5. Phân quyền truy cập

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| PERM-01 | [Exploratory] Tài khoản không có quyền Admin truy cập menu Quản lý kỳ thi | Đăng nhập bằng tài khoản CMS không có quyền Admin (nếu hệ thống có phân quyền theo vai trò), thử truy cập menu `Quản lý ôn thi / Quản lý kỳ thi` | Theo Statement ("Là quản trị viên, tôi muốn..."), menu/chức năng này nên giới hạn cho vai trò quản trị viên — cần BA/Dev xác nhận cơ chế phân quyền thực tế (ẩn menu, chặn truy cập, hay không giới hạn) trước khi gắn kết quả Pass/Fail | Skip (automated) - chưa có tài khoản CMS non-Admin được cấu hình cho module này | [ky-thi-perm-sync.spec.js](ky-thi-perm-sync.spec.js) `PERM-01` |

## 6. Đồng bộ dữ liệu Kỳ thi ↔ Section, Bảng điểm, Đề thi

Nhóm case xác nhận mục tiêu nêu ở Statement/AC: Kỳ thi tiêu thụ dữ liệu Section (qua "Cấu hình đề
xuất") và kiểm soát việc chọn Bảng điểm (qua "Dạng quy đổi") khi Admin tạo Đề thi. Toàn bộ case trong
nhóm này **chưa live-verify** — màn Đề thi (Ngân hàng đề) nơi thực sự tiêu thụ dữ liệu này chưa có
ảnh chụp/spec riêng tại thời điểm viết file, case được viết ở mức suy luận hợp lý từ AC mục 1.3.4. Đối
chiếu thêm với [`../quan_ly_section/TESTCASES.md`](../quan_ly_section/TESTCASES.md) nhóm 6 (SYNC-02/
SYNC-05, đã live-verify chiều Section → Kỳ thi) và
[`../cau_hinh_bang_diem/TESTCASES.md`](../cau_hinh_bang_diem/TESTCASES.md) nhóm 6 (SYNC-02, Đề thi lọc
Bảng điểm theo Dạng quy đổi của Kỳ thi).

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| SYNC-01 | Section mới tạo/sửa ở màn Quản lý Section phản ánh đúng khi chọn vào Cấu hình đề xuất | Tạo mới hoặc sửa Tên/Kỹ năng 1 Section ở màn Quản lý Section, không tải lại trang, sang Quản lý kỳ thi → mở popup Thêm mới/Sửa Kỳ thi → mở droplist "Cấu hình đề xuất" | Section vừa tạo/sửa xuất hiện đúng dữ liệu mới nhất trong droplist, không cần tải lại trang (đối xứng với Section `SYNC-02`) | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi `/exam-prep/exam-types`) | [ky-thi-perm-sync.spec.js](ky-thi-perm-sync.spec.js) `SYNC-01` |
| SYNC-02 | Tạo Đề thi và chọn Kỳ thi → cấu trúc đề xuất đúng theo Cấu hình đề xuất hiện tại của Kỳ thi | Ở màn Đề thi (Ngân hàng đề), bấm Tạo mới, chọn 1 Kỳ thi đã có sẵn Cấu hình đề xuất gồm N section theo thứ tự cụ thể | Đề thi mới hiển thị sẵn cấu trúc gồm đúng N section, đúng thứ tự như trong Kỳ thi tại thời điểm chọn | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi `/exam-prep/exam-types`) | [ky-thi-perm-sync.spec.js](ky-thi-perm-sync.spec.js) `SYNC-02` |
| SYNC-03 | Cấu trúc đề xuất chỉ là gợi ý — người tạo đề vẫn sửa được cấu trúc/thời lượng riêng của đề đó | Sau SYNC-02, ở chính Đề thi vừa tạo, thử thêm/bớt section hoặc đổi thời lượng ngay trên Đề thi (không qua màn Kỳ thi) | Sửa được độc lập, không bị khóa theo cấu hình gốc của Kỳ thi; thay đổi này không ảnh hưởng ngược lại Cấu hình đề xuất gốc ở màn Quản lý kỳ thi | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi `/exam-prep/exam-types`) | [ky-thi-perm-sync.spec.js](ky-thi-perm-sync.spec.js) `SYNC-03` |
| SYNC-04 | Tạo Đề thi và chọn Kỳ thi → dropdown Bảng điểm chỉ liệt kê đúng Dạng quy đổi của Kỳ thi | Tạo mới Đề thi, chọn 1 Kỳ thi có Dạng quy đổi = "Phổ thông", mở dropdown chọn Bảng điểm | Dropdown chỉ liệt kê các Bảng điểm có Dạng quy đổi = "Phổ thông"; không hiển thị Bảng điểm thuộc Dạng quy đổi khác (nếu hệ thống sau này có thêm Dạng quy đổi khác) — đối xứng với Bảng điểm `SYNC-02` | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi `/exam-prep/exam-types`) | [ky-thi-perm-sync.spec.js](ky-thi-perm-sync.spec.js) `SYNC-04` |
| SYNC-05 | Dropdown Bảng điểm mặc định chọn bảng điểm được TẠO ĐẦU TIÊN cùng Dạng quy đổi | Đảm bảo tồn tại ≥2 Bảng điểm cùng Dạng quy đổi "Phổ thông" (tạo ở các thời điểm khác nhau), tạo mới Đề thi và chọn Kỳ thi có Dạng quy đổi "Phổ thông", quan sát giá trị Bảng điểm được chọn sẵn | Bảng điểm được chọn mặc định = bảng điểm được tạo SỚM NHẤT trong số các bảng điểm cùng Dạng quy đổi đó, đúng theo AC "default vào bảng điểm được tạo đầu tiên" — không phải bảng điểm mới nhất hay bảng điểm đầu danh sách hiển thị (danh sách Bảng điểm hiển thị mới nhất lên đầu, nên "đầu tiên" ở đây cần hiểu là tạo sớm nhất, không phải dòng đầu bảng) | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi `/exam-prep/exam-types`) | [ky-thi-perm-sync.spec.js](ky-thi-perm-sync.spec.js) `SYNC-05` |
| SYNC-06 | Đổi Kỳ thi đang chọn khi tạo Đề thi → cấu trúc gợi ý và danh sách Bảng điểm làm mới hoàn toàn | Ở màn Tạo mới Đề thi, chọn Kỳ thi A (có cấu trúc/Dạng quy đổi riêng), sau đó đổi sang chọn Kỳ thi B (cấu trúc/Dạng quy đổi khác A) trước khi Lưu | Cấu trúc đề xuất và dropdown Bảng điểm cập nhật lại hoàn toàn theo Kỳ thi B, không giữ lại lựa chọn/cấu trúc cũ của Kỳ thi A | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi `/exam-prep/exam-types`) | [ky-thi-perm-sync.spec.js](ky-thi-perm-sync.spec.js) `SYNC-06` |
| SYNC-07 | Kỳ thi bị xóa không còn xuất hiện trong dropdown chọn Kỳ thi ở màn Tạo mới Đề thi | Sau khi xóa thành công 1 Kỳ thi chưa từng gắn Đề thi nào (DEL-01), mở dropdown chọn Kỳ thi ở màn Tạo mới Đề thi | Kỳ thi đã xóa không còn xuất hiện trong danh sách để chọn | Skip (automated) - cần màn Ngân hàng đề thi (ngoài phạm vi `/exam-prep/exam-types`) | [ky-thi-perm-sync.spec.js](ky-thi-perm-sync.spec.js) `SYNC-07` |

## 7. Phân trang danh sách Kỳ thi

Chưa có ảnh chụp/live-verify riêng cho khu vực phân trang của màn Kỳ thi (ảnh chụp được cung cấp chỉ
có 3 bản ghi). Nhóm case dưới đây suy luận theo đúng control phân trang đã quan sát thực tế ở 2 màn
sibling Section/Bảng điểm (`Tổng X bản ghi | ◀ [số trang] ▶ | Hiển thị: [10/20/50/100] / trang`, mặc
định 10/trang) — xem [`../quan_ly_section/TESTCASES.md`](../quan_ly_section/TESTCASES.md) mục 7 để
đối chiếu. PAGE-01 là case nền tảng cần chạy trước tiên để xác nhận cơ chế này có thật sự tồn tại trên
màn Kỳ thi hay không, trước khi coi PAGE-02..10 là áp dụng được.

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| PAGE-01 | [Exploratory] Xác nhận cơ chế phân trang có tồn tại trên màn Kỳ thi | Tạo đủ > 10 Kỳ thi, quan sát khu vực cuối bảng danh sách | Hệ thống hiển thị control phân trang dạng "Tổng X bản ghi \| ◀ [số trang] ▶ \| Hiển thị: [10/20/50/100] / trang" giống 2 màn Section/Bảng điểm (suy luận dùng chung component danh sách) — cần xác nhận thực tế trước khi chạy các case còn lại trong nhóm này | Pass (automated, live-run dev 2026-11-03) | [ky-thi-pagination.spec.js](ky-thi-pagination.spec.js) `PAGE-01` |
| PAGE-02 | Số bản ghi ≤ page size → không có nút chuyển trang | Có ≤10 Kỳ thi (đúng page size mặc định), quan sát khu vực phân trang | Chỉ hiển thị trang "1", không có nút trang "2" trở đi (hoặc nút có nhưng không khả dụng) | Pass (automated, live-run dev 2026-11-03) | [ky-thi-pagination.spec.js](ky-thi-pagination.spec.js) `PAGE-02` |
| PAGE-03 | Số bản ghi > page size → xuất hiện trang kế tiếp | Tạo đủ > 10 Kỳ thi (vd. 11), quan sát khu vực phân trang | Xuất hiện thêm nút trang "2"; nút "▶" (trang sau) chuyển từ disable sang khả dụng | Pass (automated, live-run dev 2026-11-03) | [ky-thi-pagination.spec.js](ky-thi-pagination.spec.js) `PAGE-03` |
| PAGE-04 | Chuyển sang trang 2 hiển thị đúng dữ liệu, STT không reset | Đang ở trang 1 (11 bản ghi, 10/trang), bấm vào trang "2" | Trang 2 hiển thị đúng (các) bản ghi còn lại; cột STT tiếp tục đánh số toàn cục (vd. bản ghi thứ 11 vẫn mang STT 11, KHÔNG nhảy về STT 1) | Pass (automated, live-run dev 2026-11-03) | [ky-thi-pagination.spec.js](ky-thi-pagination.spec.js) `PAGE-04` |
| PAGE-05 | Quay lại trang 1 từ trang 2 | Đang ở trang 2, bấm nút "◀" (trang trước) hoặc bấm trực tiếp vào số "1" | Quay lại đúng trang 1 với đủ 10 bản ghi đầu | Pass (automated, live-run dev 2026-11-03) | [ky-thi-pagination.spec.js](ky-thi-pagination.spec.js) `PAGE-05` |
| PAGE-06 | Nút "◀" (trang trước) bị vô hiệu hoá khi đang ở trang đầu | Quan sát nút "◀" khi đang ở trang 1 | Nút ở trạng thái disabled (không bấm được / không đổi trang khi bấm) | Pass (automated, live-run dev 2026-11-03) | [ky-thi-pagination.spec.js](ky-thi-pagination.spec.js) `PAGE-06` |
| PAGE-07 | Nút "▶" (trang sau) bị vô hiệu hoá khi đang ở trang cuối | Chuyển tới trang cuối cùng, quan sát nút "▶" | Nút ở trạng thái disabled khi đang ở trang cuối | Pass (automated, live-run dev 2026-11-03) | [ky-thi-pagination.spec.js](ky-thi-pagination.spec.js) `PAGE-07` |
| PAGE-08 | Đổi số bản ghi/trang (10 → 20/50/100) gộp nhiều bản ghi hơn trên 1 trang | Đang có > 10 Kỳ thi và nhiều hơn 1 trang, mở dropdown "Hiển thị", chọn "20 / trang" (hoặc 50/100) | Bảng hiển thị nhiều bản ghi hơn trên cùng 1 trang theo đúng giá trị mới chọn; số trang giảm tương ứng (vd. nếu tổng ≤ giá trị mới thì chỉ còn 1 trang) | Pass (automated, live-run dev 2026-11-03) | [ky-thi-pagination.spec.js](ky-thi-pagination.spec.js) `PAGE-08` |
| PAGE-09 | Tìm kiếm khi đang ở trang 2 → tự động quay về trang 1 | Đang ở trang 2, nhập từ khóa vào ô tìm kiếm tên kỳ thi | Hệ thống tự động quay về trang 1, hiển thị kết quả lọc đúng theo từ khóa (không kẹt ở trang 2 với danh sách rỗng) | Pass (automated, live-run dev 2026-11-03) | [ky-thi-pagination.spec.js](ky-thi-pagination.spec.js) `PAGE-09` |
| PAGE-10 | Số đếm tổng "X kỳ thi" luôn phản ánh TOÀN BỘ bản ghi, không chỉ trang hiện tại | Đối chiếu số "X kỳ thi" góc phải khi đang ở trang 2 (chỉ hiển thị 1 vài dòng) với tổng số bản ghi thật | Số đếm hiển thị đúng tổng toàn bộ (vd. "11 kỳ thi"), không bị nhầm thành số dòng hiển thị trên trang hiện tại | Pass (automated, live-run dev 2026-11-03) | [ky-thi-pagination.spec.js](ky-thi-pagination.spec.js) `PAGE-10` |

---

## Ghi chú chạy test

Đã có script tự động hoá (Playwright Test) tại `automation/quan_ly_ky_thi/` (page objects
`navigation/cmsKyThiPageObjects.js`, session `navigation/cmsKyThiSession.js`, cleanup
`cleanupCli.js`) + file test THẬT (`.spec.js`) đặt cùng thư mục với file này, tương tự cách tổ chức
tại [`../quan_ly_section/TESTCASES.md`](../quan_ly_section/TESTCASES.md) và
[`../cau_hinh_bang_diem/TESTCASES.md`](../cau_hinh_bang_diem/TESTCASES.md):

- `ky-thi-list.spec.js` — nhóm 1 (LIST-01..08, LIST-08 skip)
- `ky-thi-add.spec.js` — nhóm 2 (ADD-01..23, ADD-03/16 skip)
- `ky-thi-edit.spec.js` — nhóm 3 (EDIT-01..11, EDIT-02..06 skip)
- `ky-thi-delete.spec.js` — nhóm 4 (DEL-01..06, DEL-02/03/06 skip)
- `ky-thi-pagination.spec.js` — nhóm 7 (PAGE-01..10, đủ)
- `ky-thi-perm-sync.spec.js` — nhóm 5+6 (PERM-01, SYNC-01..07), TOÀN BỘ skip (lý do trong file)

Chạy (từ thư mục `automation/`):
```
npm run test-quan-ly-ky-thi-pw      # chạy toàn bộ 66 case (47 Pass live-run + 19 skip có lý do)
npm run cleanup-quan-ly-ky-thi      # dọn dữ liệu AUTO- còn sót nếu 1 lần chạy bị ngắt giữa chừng
```
