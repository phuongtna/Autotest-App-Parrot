# Testcase — CMS Quản lý (Web Admin): Gói dịch vụ / Đơn hàng / Học sinh

Nguồn: kế hoạch test do người dùng cung cấp trong hội thoại (2026-09-07) — 2 nhóm case: "Gói mặc
định" (UI/Sửa/Lưu/Dừng hoạt động/Lịch sử/Tạo đơn hàng/Giá ưu đãi/Gói thường/Danh sách/Validate) và
"Gán gói dùng thử khi tạo đơn thủ công" (GRANT-*). Tổng 40 case.

Khác với `flows/web/teacher/` (Web GV, `parrotedu.vn/teacher`) và `flows/app/` (app Android), đây
là **CMS Quản lý** (web admin nghiệp vụ, KHÔNG phải web GV) — 3 màn `/packages` "Quản lý gói dịch
vụ", `/orders` "Quản lý đơn hàng", `/students` "Quản lý học sinh". Đăng nhập `admin`/mật khẩu lưu ở
`CMS_USERNAME`/`CMS_PASSWORD` trong `.env`.

**Môi trường**: 3 môi trường dev/staging/production, chọn qua `CMS_ADMIN_ENV` (xem
`automation/README.md` mục "Quản lý gói dịch vụ" để biết chi tiết biến môi trường). Tại thời điểm
viết file này CHỈ CÓ staging (`https://cms-staging.parrotedu.vn`) và production
(`https://cms.parrotedu.vn`, **chưa xác nhận truy cập thật**) — chưa có môi trường dev riêng.

**Automation**: đã có Playwright tự động hoá TOÀN BỘ case đánh dấu "Automated" bên dưới, xem
`automation/quan_ly_goi_dich_vu/` — entrypoint `npm run test-goi-dich-vu` (xem README của module đó
để biết cách chọn môi trường). Case đánh dấu "Manual" chỉ có bằng chứng thao tác tay (Claude
Browser, 2026-09-07), chưa có code.

**Trạng thái Pass/Blocked/Exploratory dưới đây** là kết quả chạy tay lần gần nhất (2026-09-07, môi
trường staging) — không tự động cập nhật khi chạy `npm run test-goi-dich-vu` lần sau; xem output
JSON trong `automation/output/goi_dich_vu_report_*.json` để biết kết quả lần chạy tự động gần nhất.

---

## 1. Popup Thêm mới gói dịch vụ

34 case (UI-01→06, SAVE-01→05, DEACT-01→05, ORDER-01→04, FIELD-01, REG-01→03, GRANT-01/02/02b/03/
04a/08/12/05/06/04b) đã có test THẬT chạy được bằng Playwright Test (`test()`/`expect()`, ĐÃ CHẠY
PASS 34/34 trên staging 2026-09-07) - TẤT CẢ DỒN CHUNG 1 FILE (kể cả khi thêm case mới sau này,
không tách file):
[`goi-mac-dinh-pass-01-20.spec.js`](goi-mac-dinh-pass-01-20.spec.js) (tên file giữ nguyên dù nay đã
hơn 20 case - CÙNG thư mục này, không phải trong `automation/` - chỉ import code dùng lại từ
`automation/quan_ly_goi_dich_vu/` qua đường dẫn tương đối, giống quy ước
`flows/web/giao_bai_tap/*.mjs`). Chạy bằng `cd automation && npx playwright test` (xem
`automation/README.md` mục "Playwright Test thật"). DEACT-05/GRANT-03/GRANT-04a/GRANT-12/GRANT-05/
GRANT-06/GRANT-04b cần `CMS_ADMIN_TEST_STUDENT_PHONE` (xem `automation/README.md`) - tự
`test.skip()` nếu thiếu.

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| UI-01 | Mặc định checkbox "Dùng thử" chưa chọn | Vào `/packages` → "Thêm gói dịch vụ" → quan sát checkbox Dùng thử + Giá ưu đãi | Checkbox không tick; toggle mặc định KHÔNG hiện; Giá ưu đãi KHÔNG hiện (ẩn với MỌI gói) | Pass | ✅ Automated |
| UI-02 | Tick "Dùng thử" → hiện toggle mặc định | Tick checkbox Dùng thử | Hiện khối "Đánh dấu là gói mặc định", toggle OFF; Giá ưu đãi vẫn ẩn | Pass | ✅ Automated |
| UI-03 | Bỏ tick sau khi đã tick → ẩn toggle | Bỏ tick lại checkbox Dùng thử | Toggle mặc định ẩn hoàn toàn; Giá ưu đãi vẫn ẩn | Pass | ✅ Automated |
| UI-04 | Nội dung label/mô tả toggle mặc định | Quan sát label + dòng mô tả | "Đánh dấu là gói mặc định" + "Chỉ duy nhất 1 gói được đặt làm mặc định. Nếu bật, hệ thống sẽ tự động tắt trạng thái mặc định ở gói trước đó" | Pass | ✅ Automated |
| UI-05 | Giá ưu đãi ẩn hẳn (không chỉ disable), mọi gói | Kiểm tra cả 2 trạng thái tick/không tick | Field không render ở CẢ 2 trường hợp | Pass | ✅ Automated |

## 2. Popup Sửa gói dịch vụ

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| UI-06 | Mở sửa gói dùng thử đang mặc định | Sửa 1 gói dùng thử đang `is_default=true` | Checkbox tick, toggle mặc định ON, không có Giá ưu đãi | Pass | ✅ Automated |

## 3. Lưu gói dịch vụ

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| SAVE-01 | Lưu gói dùng thử, toggle mặc định OFF, hệ thống chưa có mặc định | Thêm mới, tick Dùng thử, để toggle mặc định OFF, Lưu | Lưu thành công; gói không phải mặc định | Pass | ✅ Automated |
| SAVE-02 | Bật toggle mặc định khi chưa có mặc định nào | Thêm mới, tick Dùng thử, bật toggle mặc định, Lưu | Gói mới trở thành mặc định | Pass | ✅ Automated |
| SAVE-03 | [Rule chính] Bật mặc định cho gói mới → tự tắt gói cũ | Gói A đang mặc định; tạo/sửa gói B bật toggle mặc định, Lưu | B thành mặc định; A tự động mất mặc định, không cần thao tác thủ công | Pass | ✅ Automated |
| SAVE-04 | Chủ động tắt toggle mặc định của gói đang mặc định | Sửa gói đang mặc định, tắt toggle, Lưu | Gói không còn mặc định; hệ thống tạm thời không có gói mặc định nào (không tự chọn gói khác thay thế) | Pass | ✅ Automated |
| SAVE-05 | 2 người dùng cùng bật mặc định cho 2 gói khác nhau gần như đồng thời | 2 tab/2 phiên: tab1 bật mặc định gói B + Lưu, tab2 bật mặc định gói C + Lưu ngay sau | Tại 1 thời điểm chỉ đúng 1 gói mặc định (gói lưu sau cùng); KHÔNG có lúc nào 2 gói cùng mặc định | Pass — verify thật bằng 2 `page` Playwright riêng biệt (không chỉ suy luận tuần tự như evidence cũ) | ✅ Automated |

## 4. Dừng hoạt động gói mặc định

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| DEACT-01 | Tắt "Trạng thái hoạt động" của gói mặc định | Sửa gói mặc định, tắt toggle Trạng thái hoạt động, Lưu | Trạng thái → Dừng hoạt động; toggle "Đánh dấu là gói mặc định" VẪN ON | Pass | ✅ Automated |
| DEACT-02 | Gói mặc định đã dừng hoạt động không hiện ở đơn hàng thủ công | Mở "Tạo đơn hàng", xem dropdown "Gói dùng thử áp dụng" | Gói KHÔNG xuất hiện trong danh sách | Pass | ✅ Automated |
| DEACT-03 | Không tự chọn gói khác làm mặc định thay thế | Sau khi dừng hoạt động gói mặc định, xem toàn bộ danh sách | Không gói dùng thử nào khác tự nhận tag "Mặc định" | Pass | ✅ Automated |
| DEACT-04 | Bật lại hoạt động → hiện lại ở đơn hàng, vẫn giữ mặc định | Bật lại Trạng thái hoạt động, Lưu | Hiện lại trong dropdown; vẫn giữ `is_default=true` | Pass | ✅ Automated |

## 5. Lịch sử mua hàng

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| DEACT-05 | Lịch sử mua hàng giữ nguyên sau khi gói bị dừng hoạt động | Có đơn hàng dùng gói X → dừng hoạt động gói X → xem lại lịch sử | Toàn bộ lịch sử (tên gói/giá/thời hạn/trạng thái) giữ nguyên, không lỗi hiển thị | Pass | ✅ Automated |

## 6. Tạo mới đơn hàng thủ công

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| ORDER-01 | Gói mặc định đang Hoạt động được pre-select | Mở "Tạo đơn hàng", chọn loại Dùng thử | Gói mặc định được chọn sẵn | Pass | ✅ Automated |
| ORDER-02 | Danh sách chỉ hiện gói dùng thử đang Hoạt động | Đối chiếu dropdown với trang quản lý gói | Gói Dừng hoạt động bị loại khỏi danh sách dù đang mặc định | Pass | ✅ Automated |
| ORDER-03 | Không có gói mặc định active khả dụng | Gói mặc định duy nhất đang dừng hoạt động | Dropdown về "-- Không áp dụng --", không lỗi phát sinh | Pass | ✅ Automated |
| ORDER-04 | Vẫn chọn được gói dùng thử khác (không phải mặc định) | Đổi lựa chọn sang gói khác | Chọn được, không bị khoá cứng vào gói mặc định | Pass | ✅ Automated |

## 7. Trường "Giá ưu đãi"

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| FIELD-01 | Giá ưu đãi không bắt buộc, không lỗi validate (field đã ẩn hẳn) | Lưu gói cả 2 trường hợp tick/không tick Dùng thử | Lưu thành công cả 2, không lỗi liên quan Giá ưu đãi | Pass | ✅ Automated |
| FIELD-02 | Giá trị "Giá ưu đãi" được hệ thống xử lý thế nào khi field đã ẩn | Kiểm tra qua API/DB (không có UI nào hiển thị lại) | Cần dev/API xác nhận — không thao tác được qua UI | **Blocked** | — (field ẩn hoàn toàn khỏi UI, không có gì để tự động hoá thêm) |
| FIELD-03 | Dữ liệu "Giá ưu đãi" của gói cũ (trước khi ẩn field) có bị mất không | Sửa gói cũ đã có Giá ưu đãi ≠ 0, Lưu lại, kiểm tra qua API/DB | Giá trị cũ KHÔNG bị ghi đè thành 0/null | **Blocked** | — (cần dev kiểm tra DB trực tiếp) |

## 8. Gói dịch vụ thường

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| REG-01 | Gói KHÔNG phải "Dùng thử" không có tuỳ chọn mặc định | Không tick Dùng thử, quan sát toàn bộ form | Không có toggle mặc định ở bất kỳ đâu; không có Giá ưu đãi | Pass | ✅ Automated |

## 9. Danh sách gói dịch vụ

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| REG-02 | Danh sách hiện nhãn "Mặc định" cho gói dùng thử đang được đánh dấu | Vào danh sách, quan sát dòng gói mặc định | Hiện 2 tag: "Dùng thử" (xanh) + "Mặc định" (cam) | Pass | ✅ Automated |

## 10. Validate chung

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| REG-03 | Validate "Tên gói dịch vụ" bắt buộc | Để trống Tên gói dịch vụ, bấm Lưu | Lỗi "Vui lòng nhập tên gói dịch vụ" ngay dưới field, không lưu | Pass | ✅ Automated |

## 11. Gán gói dùng thử khi tạo đơn thủ công

| ID | Tên case | Bước thực hiện | Kỳ vọng | Trạng thái | Automation |
|----|----------|-----------------|---------|------------|------------|
| GRANT-01 | Dropdown "Gói dùng thử áp dụng" sắp xếp Mới → Cũ | Đối chiếu thứ tự dropdown với Ngày tạo ở `/packages` | Gói tạo mới nhất lên đầu (sau "-- Không áp dụng --") | Pass | ✅ Automated |
| GRANT-02 | Trường "Gói dùng thử áp dụng" bắt buộc, không được rỗng | Thử để trường này ở trạng thái chưa chọn | Luôn có 1 giá trị (kể cả "-- Không áp dụng --"), không rỗng/null | Pass | ✅ Automated |
| GRANT-02b | Tự động pre-select gói mặc định đang Hoạt động | Mở "Tạo đơn hàng" khi có gói mặc định active | Trường tự pre-select đúng gói đó (kèm nhãn "Mặc định") | Pass | ✅ Automated |
| GRANT-03 | **[Case lõi]** Đơn thủ công gắn gói dùng thử → cấp quyền NGAY khi đơn còn Chờ thanh toán | Tạo đơn, chọn gói dùng thử, Lưu, KHÔNG xác nhận thanh toán | Profile được trải nghiệm Pro ngay khi đơn vừa tạo, không cần chờ "Thành công" | Pass | ✅ Automated |
| GRANT-04a | Lịch sử hiện dòng riêng cho gói dùng thử NGAY khi đơn còn Chờ thanh toán | Xem "Lịch sử gói dịch vụ" của profile trong lúc đơn Chờ thanh toán | Có dòng riêng, không mã đơn/giá tiền/kênh mua — đúng format chuẩn | Pass | ✅ Automated |
| GRANT-04b | Sau khi đơn Thành công, vẫn giữ đủ 2 dòng lịch sử | Xác nhận đơn Thành công, xem lại lịch sử | Dòng đơn hàng (nay có gói trả phí) + dòng gói dùng thử cũ đều còn nguyên | Pass | ✅ Automated |
| GRANT-05 | Đơn Thành công → gói trả phí active bình thường | Xác nhận đơn hàng | Gói trả phí active như luồng hiện tại (regression) | Pass | ✅ Automated |
| GRANT-06 | **[Case lõi]** Đơn Thành công → gói dùng thử tự inactive | Xác nhận đơn hàng | Gói dùng thử đã gắn chuyển inactive ngay, không song song 2 quyền lợi | Pass | ✅ Automated |
| GRANT-07 | **[Case lõi]** Đơn tự Hủy sau 24h → gói dùng thử KHÔNG bị thu hồi | Để đơn Chờ thanh toán quá 24h không xác nhận | Gói dùng thử tiếp tục hiệu lực tới hết hạn tự nhiên, không bị cắt ngang | Pass (evidence thủ công 2026-09-04) | Skipped trong `npm run test-goi-dich-vu` — không automate việc chờ 24h trong 1 lần chạy ngắn |
| GRANT-08 | Chọn "-- Không áp dụng --" rồi Lưu → chặn lưu | Chọn "Không áp dụng" ở "Gói dùng thử áp dụng", bấm Lưu | Lỗi "Vui lòng chọn gói dùng thử áp dụng", KHÔNG cho lưu đơn | Pass | ✅ Automated |
| GRANT-09 | [Không áp dụng] Đơn không gắn gói dùng thử bị Hủy sau 24h | — | Không thể đạt điều kiện tiên quyết (GRANT-08 xác nhận không thể tạo đơn không gắn gói dùng thử) | **Blocked** | — (điều kiện tiên quyết không đạt được qua UI, đề xuất loại khỏi phạm vi test) |
| GRANT-10 | [Edge — chưa có rule chính thức] Profile đã có trial A, tạo thêm đơn gắn trial B | Tạo đơn 2 gán trial khác cho profile đang có trial A hiệu lực | Quan sát khách quan: trial B (mới hơn) thay thế trial A trên trạng thái active, lịch sử vẫn giữ cả 2 dòng | **Exploratory** — cần BA xác nhận đây có phải hành vi đúng ý định | ⚠️ Không đưa vào bộ Pass tự động (chưa có rule để assert Pass/Fail) |
| GRANT-11 | [Edge — chưa có rule chính thức] 2 đơn Chờ xử lý cùng lúc, mỗi đơn 1 gói dùng thử khác nhau | Tạo đơn 1 (trial X) rồi đơn 2 (trial Y) cho cùng profile, cả 2 để Chờ xử lý | Quan sát khách quan: chỉ trial Y (tạo sau) hiện active; cả 2 đơn vẫn tồn tại độc lập; lịch sử giữ cả 2 dòng | **Exploratory** — cần BA xác nhận | ⚠️ Không đưa vào bộ Pass tự động |
| GRANT-12 | Gói dùng thử đã gắn vẫn hiệu lực dù package gốc bị dừng hoạt động | Dừng hoạt động package gốc trong lúc profile đang hiệu lực trial đó | Quyền lợi Dùng thử KHÔNG bị thu hồi/ảnh hưởng | Pass | ✅ Automated |

---

## Chạy test tự động

```bash
cd automation
CMS_ADMIN_ENV=staging npm run test-goi-dich-vu        # hoặc dev / production
# hoặc: npm run test-goi-dich-vu -- --env=production
```

Xem `automation/README.md` mục "Quản lý gói dịch vụ" để biết chi tiết biến môi trường
(`CMS_ADMIN_ENV`, `CMS_ADMIN_URL_DEV/STAGING/PRODUCTION`, `CMS_ADMIN_TEST_STUDENT_PHONE`) và cấu
trúc module `automation/quan_ly_goi_dich_vu/`.

**Case KHÔNG có trong bộ chạy tự động** (không đưa vào vì lý do riêng, xem cột "Automation" ở mỗi
bảng): FIELD-02, FIELD-03 (Blocked — field ẩn hoàn toàn khỏi UI), GRANT-09 (Blocked — điều kiện
tiên quyết không đạt được), GRANT-10/GRANT-11 (Exploratory — chưa có rule chính thức để assert
Pass/Fail, cần BA xác nhận trước).
