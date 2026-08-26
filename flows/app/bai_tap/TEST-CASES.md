# Bảng test case — Tab "Bài tập" & Tab "Báo cáo"

Nguồn kỳ vọng: đọc trực tiếp từ code, không phỏng đoán.

- Tab Bài tập: `app/dashboard/(tabs)/homework.tsx`, `app/dashboard/exercise/*`
- Tab Báo cáo: `app/dashboard/(tabs)/account.tsx`, `app/dashboard/reports/study-report.tsx`
- Tab bar / badge: `app/dashboard/(tabs)/_layout.tsx`

Cột **Auto** = có file Maestro chạy tự động. Cột **Tay** = cần QA kiểm chứng thêm bằng mắt/thao tác.

---

## A. TAB BÀI TẬP (HW)

| ID    | Tên case                        | Điều kiện / dữ liệu                     | Bước                                                                 | Kỳ vọng PASS                                                                                                                | Coi là FAIL khi                                                                     | Auto | Tay |
| ----- | ------------------------------- | --------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---- | --- |
| HW-01 | Load tab mặc định               | `PHONE` bất kỳ đã login                 | Mở tab Bài tập                                                       | Banner + filter mặc định **"2 tuần gần nhất"** + tiêu đề **"Bài tập"** + thanh tiến độ `đã xong / tổng`                      | Filter không phải "2 tuần gần nhất"; trắng màn; spinner quay > 30s                  | ✅   |     |
| HW-02 | Mở sheet filter                 |                                         | Tap nhãn filter                                                      | Sheet **"Xem bài tập theo"**, đúng 2 option, radio đang chọn = giá trị hiện tại, nút **"Xem"**                               | Thiếu option; radio sai; sheet không mở                                             | ✅   |     |
| HW-03 | Đổi filter → 1 tháng            |                                         | Scroll xuống giữa list → sheet → chọn "1 tháng gần nhất" → "Xem"      | Sheet đóng, nhãn đổi thành "1 tháng gần nhất", danh sách reload từ trang 1, **scroll về đầu**. Ngoài ra: **mọi** card đang hiển thị sau filter phải có Hạn nộp nằm trong `[hôm nay - 1 tháng lịch, hôm nay]` (2 biên đều hợp lệ) — verify bằng `homework/hw03-verify-filter-dates.js` (Maestro YAML thuần không tự đọc hierarchy/ngày hệ thống được, xem comment đầu file đó) | Nhãn không đổi; list không reload; **hoặc** có ≥1 card Hạn nộp ngoài khoảng trên. ⚠️ Scroll **hiện KHÔNG** về đầu — xem mục C-4 (script tự cuộn lại về đầu để bù) | ✅   | ✔   |
| HW-04 | Đóng sheet không áp dụng        |                                         | Sheet → chọn option khác → swipe xuống đóng                          | Lựa chọn **KHÔNG** áp dụng, nhãn giữ nguyên (`rangeTimeTemp` chỉ commit khi bấm "Xem")                                       | Nhãn tự đổi khi chỉ chọn radio                                                      | ✅   |     |
| HW-05 | Pull-to-refresh                 |                                         | Kéo xuống ở đầu list                                                 | Spinner refresh, list render lại, filter giữ nguyên                                                                         | Không refresh; crash; filter bị reset                                                | ✅   |     |
| HW-06 | Empty state                     | Tự tạo hồ sơ con mới rồi chuyển sang (không cần `PHONE_EMPTY` riêng) | Tạo hồ sơ con mới → chuyển sang hồ sơ đó → mở tab                     | Hiện **"Bạn không có bài tập nào đang chờ."**, không có section nào                                                          | Hiện section rỗng; trắng màn                                                        | ✅   |     |
| HW-07 | 3 nhóm section + thứ tự         | `PHONE_DATA`                            | Scroll hết list                                                      | Thứ tự: **Bài tập về nhà** → **Bài tập nâng cao** → **Kiến thức trong bài**; unit gợi ý dedupe theo `unit_id` (không trùng)  | Sai thứ tự; unit lặp lại                                                            | ✅   | ✔   |
| HW-08 | Card bài chưa hoàn thành        | `PHONE_DATA`                            | Xem card                                                             | Có "Hạn nộp DD/MM", thanh tiến độ `đã trả lời / tổng câu`, nút "Làm bài"/"Tiếp tục"/"Chinh phục"; **không** có khối điểm     | Hiện điểm ở bài chưa làm; thiếu hạn nộp                                              | ✅   |     |
| HW-09 | Nhãn quá hạn                    | Bài `due_date` < hôm nay                | Xem card                                                             | Ngày + **"(QUÁ HẠN)"** in hoa, chữ đỏ                                                                                       | Không hiện nhãn; nhãn không đỏ                                                      | ✅   | ✔   |
| HW-10 | Nhãn hôm nay                    | Bài `due_date` = hôm nay                | Xem card                                                             | Ngày + **"(Hôm nay)"**, màu bình thường                                                                                     | Không hiện; hiện luôn "Quá hạn"                                                     | ✅   | ✔   |
| HW-11 | Card bài đã hoàn thành          | `PHONE_DATA`                            | Xem card                                                             | Banner điểm đổi nền theo mốc **<7 / 7–9 / ≥9**, chữ "Điểm" + số, dòng "Điểm n", link "Xem bài đã làm", nút "Làm lại"         | Sai mốc màu; thiếu link lịch sử; còn hiện "Hạn nộp"                                  | ✅   | ✔   |
| HW-12 | Consent AI — đồng ý             | State sạch                              | Tap "Làm bài" lần đầu                                                | Dialog **"AI hỗ trợ học tập"** với "Tiếp tục" / "Để sau"; tap "Tiếp tục" → vào màn làm bài; lần sau **không** hỏi lại        | Không hỏi consent lần đầu; hỏi lại sau khi đã đồng ý                                | ✅   |     |
| HW-13 | Consent AI — từ chối            | State sạch                              | Tap "Làm bài" → "Để sau"                                             | Dialog đóng, **không** điều hướng, vẫn ở tab; tap lại → dialog hiện lại (khoá chống spam đã nhả)                             | Vẫn vào màn làm bài; nút chết không tap lại được                                     | ✅   |     |
| HW-14 | Làm bài đầy đủ → kết quả        | `PHONE_DATA`                            | Làm hết các câu                                                      | Progress bar tăng theo câu; câu cuối → toast **"Bạn đã hoàn thành bài tập!"** → màn kết quả (Điểm số/Chính xác) + confetti   | Kẹt ở 1 câu; không sang kết quả; điểm sai so với số câu đúng                          | ✅   | ✔   |
| HW-14b| Câu dạng SPEAK (đọc/nói)        | Bài có câu speak, thiết bị thật         | Đọc câu vào mic                                                      | Hiện "Em đọc là …" + "Phát âm đúng là …", chấm điểm phát âm                                                                  | Không thu được âm trên **thiết bị thật**; app treo khi ghi âm                         |      | ✔   |
| HW-15 | Nút X thoát giữa bài            | `PHONE_DATA`                            | Vào bài → tap X                                                      | Về tab Bài tập; refresh lại → card đó đổi nút thành **"Tiếp tục"** (còn `doing_answer_id`)                                    | Mất tiến độ; nút vẫn là "Làm bài"; kẹt màn                                            | ✅   |     |
| HW-16 | Lịch sử làm bài                 | Bài đã hoàn thành                       | Tap "Xem bài đã làm"                                                 | Danh sách "Lần 1…n" mỗi lần có "Điểm", "Đúng", "Thời gian nộp", nút "Xem chi tiết"; cuối màn nút "Làm lại"                    | Thiếu lần làm; sai thứ tự lần; nút "Làm lại" mất                                      | ✅   |     |
| HW-17 | Xem chi tiết đáp án             | Có ≥1 lần làm                           | Lịch sử → "Xem chi tiết"                                             | Màn xem lại đáp án: từng câu, đáp án đúng/sai, "Parrot giải thích"; back về lịch sử                                          | Trắng màn; back nhảy sai chỗ                                                        | ✅   |     |
| HW-18 | Bài role-play — mở phiên        | Có bài `item_type = role_play`          | Xem card → tap nút                                                   | Card title **"Trò chuyện cùng Parrot: <tên>"**, **không** có thanh tiến độ câu; tap → màn intro role-play (không tạo exam)  | Card hiện thanh tiến độ; đi vào màn exam thường                                      | ✅   | ✔   |
| HW-19 | Lịch sử role-play               | Bài role-play đã xong                   | Tap "Xem bài đã làm" trên card role-play                             | Mở **lịch sử role-play** (`/exercise/role-play/history`) — "Lịch sử hội thoại"/"Xem nhận xét", KHÔNG phải lịch sử exam       | Vào lịch sử exam thường                                                             | ✅   |     |
| HW-20 | Unit gợi ý "Kiến thức trong bài" — đủ Unit + đúng mapping Khối/Unit (DATA-DRIVEN, không hardcode) + điều hướng đúng Lesson list (2 màn: Danh sách bài tập & Kết quả BTVN) | Bất kỳ assignment nào cô giao (không cần biết trước Khối/Unit cụ thể) — Khối/Unit kỳ vọng lấy TỪ DỮ LIỆU THẬT của chính assignment đó lúc chạy, không cấu hình trước | **Màn Danh sách bài tập:** mở tab Bài tập → scroll tới section "Kiến thức trong bài" → đọc tên từng Unit hiển thị → tap 1 card Unit.<br>**Màn Kết quả BTVN:** mở + hoàn thành 1 bài → xem section "Kiến thức trong bài" ở màn kết quả → đối chiếu Unit hiển thị → tap 1 card Unit. | **Danh sách bài tập:** "Hiển thị đầy đủ tất cả các Unit Self-learning có liên quan đến bài tập cô giao" — đúng số lượng (không giới hạn 1 Unit), mapping đúng **Khối + Tên Unit** LẤY TỪ DỮ LIỆU RUNTIME THẬT của assignment (không hardcode Khối/Unit, không kiểm tra thứ tự).<br>**Kết quả BTVN:** "Hiển thị các thẻ Unit Self-learning có liên quan đến bài tập cô giao" — mapping đúng **Khối + Tên Unit** (không bắt buộc phải đủ 100% như màn Danh sách bài tập, cũng không kiểm tra thứ tự).<br>**Cả 2 màn:** tap Unit → `router.replace` sang tab **Vui học**, vào đúng **Danh sách Lesson** của đúng Unit + đúng Khối (xem chi tiết mapping ở ghi chú dưới bảng). | **Danh sách bài tập:** thiếu Unit liên quan (chưa hiển thị đủ 100%); Unit hiển thị không khớp Khối+Unit thật của bất kỳ assignment nào đang xét.<br>**Kết quả BTVN:** hiện Unit không khớp Khối+Unit thật của assignment vừa hoàn thành.<br>**Cả 2 màn:** tap Unit điều hướng sang Unit sai khối/sai tên; không vào được đúng Danh sách Lesson. | ✅   | ✔   |
| HW-21 | FREE + bài nâng cao (403)       | `PHONE_FREE`, có bài ADVANCED           | Tap "Chinh phục"                                                     | iOS: sheet **"Nâng cấp để con thực hành nâng cao"** + note "Bài tập nâng cao dành cho tài khoản PRO". Android(payment on): sheet Google Play. Android(off): toast "Không thể bắt đầu làm bài" | Vào được bài; message của case redo; crash                                            | ✅   | ✔   |
| HW-22 | FREE + làm lại (403)            | `PHONE_FREE`, có bài đã xong            | Tap "Làm lại"                                                        | iOS: sheet **"Nâng cấp để con tiếp tục học không giới hạn"** + note "Làm lại bài tập dành cho tài khoản PRO"                 | Hiện message của bài nâng cao (lẫn nhánh `is_completed`)                              | ✅   | ✔   |
| HW-23 | Chống spam tap                  | `PHONE_DATA`                            | Tap "Làm bài" 3 lần thật nhanh                                       | Chỉ tạo **1** phiên, chỉ push **1** màn; bấm X 1 lần là về tab                                                                | Phải bấm X ≥2 lần (đã push trùng); tạo 2 answer_id                                    | ✅   | ✔   |
| HW-24 | Badge số bài chưa làm           | `PHONE_DATA`, có bài chưa nộp           | Đứng tab Vui học / Báo cáo → sang tab Bài tập                        | Ở tab khác: badge đỏ hiện số (>9 hiện "9+"). Vào tab Bài tập: badge **mất**                                                  | Badge sai số; badge vẫn hiện khi đang ở tab Bài tập; badge không cập nhật sau khi nộp | ✅   | ✔   |
| HW-25 | Offline / API lỗi               | Bật chế độ máy bay                      | Mở tab Bài tập                                                       | Hiện empty state, **không crash**, đổi tab được                                                                             | Crash; spinner vô hạn; trắng màn                                                    | ✅   | ✔   |
| HW-26 | Filter reset khi quay lại tab   |                                         | Đổi sang "1 tháng" → sang tab khác → quay lại                        | Nhãn về **"2 tuần gần nhất"** (theo `useFocusEffect` hiện tại)                                                               | — (nếu PO muốn GIỮ filter thì ghi vào cột Ghi nhận là defect thiết kế)                | ✅   | ✔   |
| HW-27 | Đổi hồ sơ con → reload list     | ≥2 hồ sơ con                            | Header → Chuyển profile → chọn con khác                              | Toast "Thay đổi tài khoản con thành công!", list + tiến độ đổi theo hồ sơ mới, scroll về đầu                                  | List vẫn của con cũ; tiến độ không đổi                                               | ✅   | ✔   |
| HW-28 | Xem chi tiết — bấm "Giải thích" | Có ≥1 lần làm, vào được màn xem chi tiết | Xem chi tiết → mỗi câu bấm "Giải thích"                              | Câu **đúng**: popup "Parrot giải thích" gồm **"Kiến thức"** + **"Tóm lại"**. Câu **sai**: popup gồm **"Kiến thức"** + **"Tại sao sai"** + **"Gợi ý"**. 2 nhánh loại trừ nhau. Nút "Đóng" đóng popup, ở lại đúng câu | Thiếu field theo đúng nhánh; 2 nhánh lẫn nhau; "Đóng"/`back` thoát nhầm ra khỏi màn xem chi tiết | ✅   |     |
| HW-29 | Màn Kết quả — CTA "Tiếp theo" (còn bài) và "Hoàn thành" (hết bài) | Tài khoản/profile "Hoàng Lan" (PHONE=0911122231, lớp "2A", cố tình giữ ít bài — xem ghi chú dưới bảng), 3 bài MỚI chưa hoàn thành (current/near/far) | Hoàn thành "current" → màn Kết quả → bấm THẬT "Tiếp theo" (không dùng workaround tap X) → vào 1 màn Doing mới → trả lời "near" (đang đứng sẵn) → màn Kết quả → bấm THẬT "Tiếp theo" lần 2 → trả lời "far" (bài cuối) → màn Kết quả → bấm THẬT "Hoàn thành" | Còn bài chưa hoàn thành → CTA = **"Tiếp theo"**, bấm vào phải vào được 1 màn Doing mới (không dùng tap X). Hết bài (sau khi hoàn thành "far") → CTA đổi thành **"Hoàn thành"**, bấm vào phải quay về đúng màn danh sách Bài tập (`homework_screen`). **Phạm vi đã thống nhất 2026-08-22: chỉ verify hành vi CTA/điều hướng, KHÔNG verify "Tiếp theo" có đưa đúng vào bài hạn nộp gần nhất hay không** | CTA sai nhãn theo đúng/sai trạng thái còn bài; bấm "Tiếp theo"/"Hoàn thành" không điều hướng đúng; dùng workaround tap X thay vì bấm thật | ✅   |     |

_Ghi chú (2026-08-22) HW-29: dùng tài khoản/profile riêng "Hoàng Lan" (không phải PHONE=0915775115 mặc định của các case khác trong bảng) vì tài khoản mặc định tích luỹ rất nhiều room test cũ qua nhiều lần chạy — không thể đảm bảo "hết bài chưa hoàn thành" một cách xác định (deterministic). Setup dữ liệu (giao 3 bài mới qua Web GV) chạy qua `automation/bai_tap/setup-ktra_ket_qua_tiep_theo_hoan_thanh.mjs`, bản thân case là Maestro YAML thuần `flows/app/bai_tap/ktra_ket_qua_tiep_theo_hoan_thanh.yaml` (tái sử dụng đúng cách `flows/app/bai_tap/ktra_fullluong_lambai.yaml` mở/trả lời bài qua `helpers/open-exercise.yaml` + `helpers/answer-current-exercise-generic.yaml`) — không tự tạo dữ liệu, không chạy độc lập nếu chưa có đủ 3 bài + tham số ENV mà script `.mjs` trên tự truyền vào. Xem thêm memory `feedback_tieptheo_hoanthanh_test_account`._

_Ghi chú (2026-08-18): HW-16 và HW-17 dùng CHUNG 1 luồng điều hướng liên tiếp (card đã hoàn thành → "Xem bài đã làm" → màn lịch sử → "Xem chi tiết") — HW-17 vốn đã đi qua đúng màn lịch sử mà HW-16 verify trước khi tap "Xem chi tiết", nên đã gộp thành 1 case "HW-16+17" ở CẢ hai bản: `automation/bai_tap/xemchitietbailam.yaml` (Maestro yaml thuần, dùng `scrollUntilVisible` — có rủi ro flaky đã ghi nhận trong file) và `automation/bai_tap/xemchitietbailam.mjs` (Node + MaestroMcpBridge, tự đọc hierarchy để định vị card, đáng tin cậy hơn). `flows/bai_tap/HW-16-attempt-history.yaml` (bản HW-16 tách riêng cũ) đã bị xóa (2026-08-18, nội dung đã gộp hết vào 2 file trên)._

### Chi tiết HW-20 — Section "Kiến thức trong bài" (2 màn hình, requirement + ảnh từ QA, 2026-08-20)

> Nguồn: requirement nghiệp vụ + ảnh chụp UI do QA cung cấp trực tiếp, **không** phải đọc từ code app (repo này không có source code app, chỉ có Maestro flow). Không suy đoán thêm ngoài phần dưới đây.

Section "Kiến thức trong bài" xuất hiện ở **2 màn hình khác nhau**, mỗi màn có requirement riêng — KHÔNG dùng chung 1 rule.

**Rule mapping chung cho cả 2 màn:** `Khối + Tên Unit`. Vd bài tập giao cho Khối 7 - Unit 6 → card hiển thị phải là Unit 6 của Self-learning **Khối 7**, không được lấy Unit 6 của khối khác (dù trùng tên/số Unit).

#### 0. ĐÍNH CHÍNH BẮT BUỘC (2026-08-20) — KHÔNG hardcode Khối/Lớp

**KHÔNG** được hard-code bất kỳ mapping cố định nào kiểu "Lớp 3 → Khối 3" hay "Lớp 3 → Khối 7", và **KHÔNG** được tự suy ra Khối bằng cách parse số trong tên lớp hiển thị (vd đọc "Lớp 3" rồi tự hiểu là "Khối 3"). Trường hợp "tên lớp là 'Lớp 3' nhưng Khối cấu hình thật lại là 'Khối 7'" chỉ là VÍ DỤ minh hoạ rằng tên lớp không đáng tin — **không** phải test data cố định, **không** cần test riêng cho case này.

Rule đúng: `Class/Assignment data → lấy grade/Khối THỰC TẾ → xác định Unit liên quan → verify Unit đề xuất trong "Kiến thức trong bài"`. Khối thực tế phải lấy từ dữ liệu backend của CHÍNH assignment/lớp đang test (vd field `book.name`/`book_id` sẵn có trên response của assignment — xem mục "Nguồn dữ liệu" bên dưới), **không** đi chiều ngược "tên lớp → tự suy khối". Test phải PASS/FAIL dựa trên dữ liệu runtime thực tế của assignment đang chạy, không phải giá trị gõ sẵn — không set cứng `expectedGrade`/`expectedUnit` trừ khi giá trị đó CHÍNH LÀ dữ liệu vừa đọc được từ runtime. Verify Unit đề xuất = lấy Unit đang hiển thị → xác định Unit đó thuộc Khối nào → so với Khối thực tế của assignment đang test → khớp thì PASS, khác thì FAIL. Không kiểm tra thứ tự Unit.

#### 1. Màn Danh sách bài tập (card bài tập trong list — ảnh 1)

- Hiển thị **tất cả** Unit Self-learning có liên quan đến bài tập cô giao — có bao nhiêu Unit liên quan thì hiển thị đủ bấy nhiêu, **không giới hạn chỉ 1 Unit**, **không hardcode số lượng**.
- Unit phải thuộc đúng Khối THỰC TẾ của bài/lớp đang test (lấy từ dữ liệu runtime, không hardcode Khối, không hardcode tên Unit).
- **Không kiểm tra thứ tự Unit.**
- Expected Result (nguyên văn): **"Hiển thị đầy đủ tất cả các Unit Self-learning có liên quan đến bài tập cô giao."**
- Fail khi: thiếu bất kỳ Unit liên quan nào; Unit hiển thị không thuộc đúng Khối thực tế của assignment đang test.

#### 2. Màn Kết quả BTVN (dialog kết quả sau khi làm bài — ảnh 2)

- Hiển thị các thẻ Unit Self-learning có liên quan đến bài tập cô giao (theo rule mapping `Khối + Tên Unit` ở trên, Khối lấy từ dữ liệu runtime thực tế — không hardcode Khối, không hardcode Unit).
- **KHÔNG** áp dụng yêu cầu "hiển thị đầy đủ tất cả Unit liên quan" của màn Danh sách bài tập cho màn này — requirement của màn Kết quả BTVN chỉ nói hiển thị các thẻ Unit liên quan, không quy định phải đủ 100% số lượng.
- **Không kiểm tra thứ tự Unit.**
- Expected Result (nguyên văn): **"Hiển thị các thẻ Unit Self-learning có liên quan đến bài tập cô giao."**
- Fail khi: hiển thị Unit không thuộc đúng Khối thực tế tương ứng của bài tập vừa hoàn thành.

#### 3. Điều hướng khi tap card Unit (áp dụng cả 2 màn)

- Tap vào 1 card Unit → điều hướng đến trang **Danh sách Lesson** của đúng Unit Self-learning đó (`router.replace` sang tab Vui học, mang đúng `book_id` + `unit_id`).
- Phải đúng cả **Khối** lẫn **Tên Unit** — không được điều hướng sang Unit cùng tên nhưng khác khối.

#### Nguồn dữ liệu Khối/Unit thực tế (quan trọng — không lấy từ tên lớp)

Ưu tiên lấy grade/Khối từ dữ liệu backend/CMS/API hoặc state đã có sẵn trong flow, **không** lấy tên hiển thị "Lớp X" rồi tự parse số X thành grade. Nguồn cụ thể đang dùng trong automation của repo này: `automation/bai_tap/model/homeworkModel.js` — mỗi assignment (Room) trả về sẵn `book: {id, name}` (vd `name = "Khối 3"`) + `unit: {id, name}` (vd `name = "Unit 6: Wonder of Vietnam"`), lấy phẳng từ field `book_name`/`unit_name` gốc của response GET `/api/user/exams/room.json` (đã xác nhận thật, xem docblock file đó) — đây CHÍNH LÀ Khối/Unit thật của assignment, không phải suy luận từ tên lớp. Nếu assignment đã có sẵn `grade`/`book_id`/`unit_id`/`class_id` thì dùng thẳng dữ liệu đó, không tự chế biến thêm.

#### Ghi chú Auto/Tay

`ktra-kienthuctrongbai.yaml` (cập nhật 2026-08-20, đính chính lần 2) giờ CHỈ còn là **smoke-test điều hướng** cho cả 2 màn (tap 1 Unit bất kỳ → verify sang tab Vui học) — không hardcode gì, nhưng cũng KHÔNG verify được mapping Khối+Unit (Maestro yaml thuần không gọi được API backend để biết Khối thật).

Verify ĐÚNG mapping Khối+Unit (data-driven, không hardcode) chạy bằng script riêng: `node automation/bai_tap/ktra-kienthuctrongbai-mapping.mjs`. Script này:
- Lấy Khối/Unit thật của MỌI assignment hiện có qua `automation/bai_tap/discovery/homeworks.js#getHomeworks()` (xem mục "Nguồn dữ liệu" ở trên) — không hardcode, không parse tên lớp.
- Đối chiếu chéo với catalog Self-learning thật (`discovery/books.js` + `discovery/units.js`) để xác nhận Unit đó thực sự tồn tại/đã publish đúng Khối.
- Đọc THẬT các Unit đang hiển thị trong "Kiến thức trong bài" trên máy (scroll hội tụ, không shallow scroll — xem lesson đã ghi nhận trong `feedback_homework_list_full_scroll_scan`), so khớp 2 chiều: Unit hiển thị phải khớp 1 cặp Khối+Unit thật (không rõ nguồn → FAIL), và (chỉ ở màn Danh sách bài tập) mọi cặp Khối+Unit thật phải xuất hiện đủ trên màn hình.
- **Chưa chạy thử trên thiết bị/API thật** ở bản này — cần refresh token trước (xem `feedback_get_tokens_script.md`) rồi chạy thử, đối chiếu `catalogUnitName` trong report bằng mắt ở lần chạy đầu (xem GIỚI HẠN ĐÃ BIẾT trong docblock đầu file script).

---

## B. TAB BÁO CÁO (RP)

| ID    | Tên case                          | Điều kiện / dữ liệu       | Bước                                        | Kỳ vọng PASS                                                                                                                                       | Coi là FAIL khi                                                | Auto | Tay |
| ----- | --------------------------------- | ------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---- | --- |
| RP-01 | Load tab                          | login bất kỳ              | Mở tab Báo cáo                              | Header: avatar / tên hồ sơ / tên lớp / badge gói. Card "Báo cáo học tập". Card nhận xét tuần. Menu đủ 6 dòng. Cuối màn "Xóa tài khoản"              | Thiếu dòng menu; avatar mặc định không hiện khi `profile.avatar` null | ✅   |     |
| RP-02 | Nhận xét tuần — rỗng              | `PHONE_EMPTY`             | Mở tab                                      | Ảnh giáo viên + **"Chưa có báo cáo mới"** + dòng mô tả "cập nhật vào thứ bảy hàng tuần"; **không** có "Xem chi tiết"                                | Vẫn hiện "Xem chi tiết"; card trống hoàn toàn                   | ✅   |     |
| RP-03 | Nhận xét tuần — có dữ liệu        | `PHONE_DATA`              | Mở tab → "Xem chi tiết"                     | Ảnh đúng giới tính GV (`bao-cao-thay` nếu male, `bao-cao-co` nếu khác), nhận xét max 4 dòng, "Xem chi tiết" mở màn báo cáo                          | Ảnh sai giới tính; nhận xét tràn quá 4 dòng                     | ✅   | ✔   |
| RP-04 | Mở màn Báo cáo học tập            |                           | Tap dòng "Báo cáo học tập"                   | Header back + tiêu đề; filter kỳ mặc định = **"Tuần trước"** nếu hôm nay T2–T6, **"Tuần này"** nếu T7/CN; nút "Chia sẻ" hiện khi có dữ liệu         | Mặc định sai theo ngày; "Chia sẻ" hiện lúc đang loading         | ✅   | ✔   |
| RP-05 | Sheet chọn kỳ                     |                           | Tap nhãn kỳ                                 | Sheet **"Xem báo cáo"** đủ **7** option: Tuần trước / Tuần này / Tháng trước / Giữa HK1 / Cuối HK1 / Giữa HK2 / Cuối HK2 + nút "Xem"                | Thiếu/thừa option; option bị disable sai                        | ✅   |     |
| RP-06 | Đổi kỳ → Tuần này                 |                           | Sheet → "Tuần này" → "Xem"                  | Nhãn đổi, tiêu đề kỳ = "Báo cáo học tập tuần {n} - Tháng {mm}/{yyyy}" (parse từ `period_key`), nội dung reload                                     | Tiêu đề kỳ sai số tuần/tháng; nội dung không đổi                | ✅   | ✔   |
| RP-07 | FREE + Tháng trước (403)          | `PHONE_FREE`              | Sheet → "Tháng trước" → "Xem"               | iOS: sheet **"Nâng cấp để xem báo cáo tháng và học kỳ của con"** + note "Báo cáo tháng dành cho tài khoản PRO"; đồng thời empty state + ẩn "Chia sẻ" | Xem được báo cáo tháng bằng acc free; note sai chữ kỳ           | ✅   | ✔   |
| RP-08 | PRO + 4 kỳ học kỳ                 | `PHONE_PRO`               | Lần lượt chọn 4 kỳ HK                       | Không hiện sheet nâng cấp; tiêu đề kỳ đúng dạng giữa kỳ / cuối kỳ (semester I/II + năm học `YYYY - YYYY+1`); có dữ liệu hoặc empty state hợp lệ     | Acc PRO vẫn bị chặn; tiêu đề sai học kỳ/năm học                 | ✅   | ✔   |
| RP-09 | Khối "Nhận xét chung"             | `PHONE_DATA`              | Mở màn báo cáo                              | Dòng chào "Thầy/Cô \<tên\> chào ba/mẹ \<tên HS\>," — **Thầy** nếu GV male, **ba** nếu hồ sơ PH mặc định male; bullet điểm từng kỹ năng; ký tên GV     | Sai Thầy/Cô; sai ba/mẹ; bullet kỹ năng thiếu điểm               | ✅   | ✔   |
| RP-10 | Khối "Kết quả học tập"            | `PHONE_DATA`              | Scroll tới khối                             | Thẻ kỹ năng có vòng tròn `point×10`; delta>0 chữ xanh "tăng", <0 chữ đỏ "giảm", =0 "không đổi". Số thẻ **lẻ** → thẻ đầu full-width. Rỗng → "Chưa có dữ liệu" | Màu delta sai chiều; layout lệch khi số thẻ lẻ              | ✅   | ✔   |
| RP-11 | Khối "Chuyên cần"                 | `PHONE_DATA`              | Scroll tới khối                             | 4 thẻ: **Bài tập về nhà** `đã nộp/được giao`, **Bài đã học**, **Nỗ lực làm lại** "n lần", **Thời gian học** + trung bình/ngày. `summary` null → "Chưa có dữ liệu" | Thiếu thẻ; vòng tròn "Bài tập về nhà" chia 0 sai       | ✅   | ✔   |
| RP-12 | Chia sẻ báo cáo                   | Có dữ liệu                | Tap "Chia sẻ"                               | Mở share sheet OS với link `<apiUrl>/parent-share/academic-report/<token>?period_type=<kỳ>`; mở link ra đúng báo cáo đúng kỳ                        | Link 404; `period_type` không khớp kỳ đang xem                  | ✅   | ✔   |
| RP-13 | Ẩn "Chia sẻ" khi rỗng             | `PHONE_EMPTY`             | Mở màn báo cáo                              | Empty state + **không** có nút "Chia sẻ" (`isShowRightIcon = !isReportEmpty && !isLoading`)                                                          | Vẫn hiện "Chia sẻ" → bấm ra token rỗng                          | ✅   |     |
| RP-14 | Back từ màn báo cáo               |                           | Tap back header                             | Về tab Báo cáo, tab bar hiện lại, menu còn đủ                                                                                                       | Back ra ngoài app; mất tab bar                                  | ✅   |     |
| RP-15 | Menu "Thông tin các con"          |                           | Tap                                         | Mở `/dashboard/children`, back được                                                                                                                | Không mở; trắng màn                                             | ✅   |     |
| RP-16 | Menu "Khôi phục đăng ký"          | `PHONE_FREE` + sandbox store | Tap 2 lần nhanh                          | Đúng **1** alert "Khôi phục đăng ký" với 1 trong: "Bạn chưa đăng ký gói…" / "Khôi phục thành công. Thời hạn… DD/MM/YYYY" / "Gói Pro… hồ sơ \<tên\>"  | 2 alert xếp chồng (thiếu guard `loadingRestore`); message rỗng   | ✅   | ✔   |
| RP-17 | Menu "Quản lý tài khoản"          |                           | Xem dòng + tap                              | Dưới nhãn hiện **số điện thoại** của user; tap mở `/dashboard/profiles/manage`                                                                       | Không hiện SĐT; mở sai màn                                      | ✅   |     |
| RP-18 | 2 dòng chính sách                 |                           | Tap từng dòng                               | Mở đúng màn Chính sách thanh toán / Chính sách bảo mật, nội dung render, back được                                                                   | Trắng trang; 2 dòng mở cùng 1 màn                                | ✅   |     |
| RP-19 | Đăng xuất — huỷ                   |                           | Tap "Đăng xuất" → Huỷ                       | Dialog "Bạn có thật sự muốn đăng xuất khỏi ứng dụng?"; huỷ → **không** đăng xuất, session còn                                                        | Đăng xuất luôn khi chưa xác nhận                                 | ✅   |     |
| RP-20 | Đăng xuất — xác nhận              | ⚠️ destructive            | Tap "Đăng xuất" → Xác nhận                  | Gỡ FCM token → gọi logout API → về màn Đăng nhập; mở lại app **không** tự vào dashboard                                                              | Vẫn còn session sau khi mở lại; FCM còn nhận noti                | ✅   | ✔   |
| RP-21 | "Xóa tài khoản" — điều hướng      |                           | Tap link cuối màn                           | Mở `/dashboard/delete-account`, có bước xác nhận. **KHÔNG bấm xoá thật**                                                                            | Xoá ngay không cần xác nhận ⇒ lỗi nghiêm trọng                   | ✅   | ✔   |
| RP-22 | Thẻ nâng cấp hiện/ẩn theo gói     | `PHONE_FREE` + `PHONE_PRO`| Mở tab với từng acc                         | FREE → thấy thẻ "Nâng cấp tài khoản" (iOS luôn; Android chỉ khi `ANDROID_PAYMENT_ENABLED`). PRO → **không** thấy thẻ, có badge gói cạnh tên          | Acc PRO vẫn thấy thẻ mời nâng cấp                                | ✅   | ✔   |
| RP-23 | Đổi hồ sơ con → reload báo cáo    | ≥2 hồ sơ con              | Chuyển profile                              | Tên + lớp header đổi; card nhận xét tuần load lại theo `profileId` mới                                                                               | Vẫn nhận xét của con cũ                                          | ✅   | ✔   |
| RP-24 | Offline / API lỗi                 | Chế độ máy bay            | Mở tab + màn báo cáo                        | Empty state, ẩn "Chia sẻ", không crash, back được                                                                                                  | Crash; spinner vô hạn                                            | ✅   | ✔   |
| RP-25 | Android ẩn "Khôi phục đăng ký"    | Android, payment tắt      | Mở tab                                      | **Không** thấy dòng "Khôi phục đăng ký" và **không** thấy thẻ nâng cấp                                                                               | Vẫn hiện → user Android bấm vào lỗi                              | ✅   | ✔   |

---

## C. Điểm nghi vấn phát hiện khi đọc code (QA xác nhận, dev quyết định)

| # | Vị trí                                                     | Vấn đề                                                                                                                                                     | Case liên quan  |
| - | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1 | `homework.tsx` `getExercisesAssignment` catch rỗng          | Lỗi mạng và "không có bài tập" hiển thị **giống nhau** (cùng empty state). Phụ huynh không biết là mất mạng.                                                | HW-25           |
| 2 | `account.tsx` weekly report                                 | Lỗi API cũng rơi vào empty state "Chưa có báo cáo mới" — che mất lỗi thật.                                                                                  | RP-24           |
| 3 | `homework.tsx` `bestAnswer` reduce                          | Điều kiện chọn lần làm tốt nhất dùng **AND**: `total_point > best && total_correct > best`. Lần có điểm cao nhưng số câu đúng **bằng** lần khác sẽ bị bỏ qua → điểm hiển thị có thể **không phải** điểm cao nhất. | HW-11, HW-16    |
| 4 | `homework.tsx:88,193,211,251` — `flatListRef`                | `flatListRef` được khai báo và gọi `scrollToOffset` **3 chỗ** (khi focus tab, khi đổi hồ sơ, khi đổi filter) nhưng **không hề gắn `ref=` vào component nào** — màn dùng `ScrollView`, không dùng `FlatList`. ⇒ toàn bộ 3 lệnh "scroll về đầu danh sách" là **no-op**. Đồng thời `loadMore` / `PAGE_SIZE = 100` cũng chết vì `ScrollView` không có `onEndReached` ⇒ học sinh có >100 bài không xem được phần còn lại. | HW-03, HW-07, HW-27 |
| 5 | `account.tsx` `handleRestore` case `OTHER_PROFILE`          | Thiếu `break;` sau nhánh `OTHER_PROFILE` → rơi (fallthrough) xuống `default`. Hiện tại vô hại nhưng dễ sinh lỗi khi thêm case mới.                          | RP-16           |
| 6 | `_layout.tsx` badge                                         | Badge chỉ fetch khi đang ở `/dashboard`, `/dashboard/learningAi`, `/dashboard/account`. Ở màn khác badge bị set 0 → số bài chưa làm không phản ánh đúng ngay sau khi nộp bài. | HW-24           |
| 7 | `homework.tsx` `useFocusEffect`                             | Mỗi lần quay lại tab đều reset filter về "2 tuần gần nhất". Cần PO xác nhận đây là mong muốn hay defect UX.                                                  | HW-26           |
| 8 | `study-report.tsx` vòng tròn "Bài tập về nhà"               | `fill` chia cho `assignedTotal`; đã guard `> 0` nhưng text vẫn hiện `0/0`. Xác nhận thiết kế cho kỳ chưa giao bài.                                          | RP-11           |
| 9 | Toàn bộ 2 tab                                               | Chỉ 4 `testID` trong cả app → test tự động phải match text tiếng Việt + tap toạ độ. Rất dễ vỡ khi đổi copy/layout.                                          | tất cả          |

> Mục 3, 4, 5 là lỗi logic đọc được trực tiếp từ code — nên tạo ticket dev, không chỉ ghi nhận QA.

---

## D. Mapping i18n key → text dùng trong selector

Đổi các giá trị này trong `i18n/locales/vi/common.json` là **phải sửa flow**.

| Key                                 | Text (vi)                                             |
| ----------------------------------- | ----------------------------------------------------- |
| `Homework`                          | Bài tập                                               |
| `report`                            | Báo cáo                                               |
| `happy_learning`                    | Vui học                                               |
| `Two weeks nearest`                 | 2 tuần gần nhất                                       |
| `One month nearest`                 | 1 tháng gần nhất                                      |
| `View homework by`                  | Xem bài tập theo                                      |
| `View`                              | Xem                                                   |
| `Exercise homework`                 | Bài tập về nhà                                        |
| `Exercise advance`                  | Bài tập nâng cao                                      |
| `Knowledge in the lesson`           | Kiến thức trong bài                                   |
| `Can not find exercise list`        | Bạn không có bài tập nào đang chờ.                    |
| `Assignment deadline`               | Hạn nộp                                               |
| `OVERDUE`                           | Quá hạn (render in hoa)                               |
| `Today`                             | Hôm nay                                               |
| `Do exercise` / `btn_continue2`     | Làm bài / Tiếp tục                                    |
| `Conquer` / `Do again`              | Chinh phục / Làm lại                                  |
| `Score`                             | Điểm                                                  |
| `View attempt history`              | Xem bài đã làm                                        |
| `chat_with_parrot`                  | Trò chuyện cùng Parrot                                |
| `Can not start exercise`            | Không thể bắt đầu làm bài                             |
| `Exercise advanced for pro account` | Bài tập nâng cao dành cho tài khoản PRO               |
| `Upgrade to exercise advanced`      | Nâng cấp để con thực hành nâng cao                    |
| `Exercise do again for pro account` | Làm lại bài tập dành cho tài khoản PRO                |
| `Upgrade to self learning`          | Nâng cấp để con tiếp tục học không giới hạn           |
| `Times` / `True` / `Submit time`    | Lần {n} / Đúng / Thời gian nộp                        |
| `View detail`                       | Xem chi tiết                                          |
| `Check` / `Continue 2` / `Complete` | Kiểm tra / Tiếp theo / Hoàn thành                     |
| `Input fillword content`            | Nhập câu trả lời                                      |
| `complete_exercise`                 | Bạn đã hoàn thành bài tập!                            |
| `Study report`                      | Báo cáo học tập                                       |
| `account_weekly_report_empty_title` | Chưa có báo cáo mới                                   |
| `Children info`                     | Thông tin các con                                     |
| `Restore subscription`              | Khôi phục đăng ký                                     |
| `Manage account`                    | Quản lý tài khoản                                     |
| `Payment policy` / `Privacy policy` | Chính sách thanh toán / Chính sách bảo mật            |
| `Logout` / `ask_sign_out`           | Đăng xuất / Bạn có thật sự muốn đăng xuất khỏi ứng dụng? |
| `delete_account`                    | Xóa tài khoản                                         |
| `Upgrade account`                   | Nâng cấp tài khoản                                    |
| `Last week` … `End semester 2`      | Tuần trước / Tuần này / Tháng trước / Giữa học kỳ 1 / Cuối học kỳ 1 / Giữa học kỳ 2 / Cuối học kỳ 2 |
| `View report` / `Share`             | Xem báo cáo / Chia sẻ                                 |
| `General comments`                  | Nhận xét chung                                        |
| `study_results` / `Attendance`      | Kết quả học tập / Chuyên cần                          |
| `data empty`                        | Chưa có dữ liệu                                       |
| `Report_*`                          | Kỹ năng nghe / nói / đọc / viết, Phát âm, Từ vựng, Ngữ pháp, Giao tiếp, Bài tập về nhà, Bài đã học, Nỗ lực làm lại, Thời gian học |
| Dialog consent (hardcode)           | AI hỗ trợ học tập / Tiếp tục / Để sau                 |
| `Change profile`                    | Chuyển profile                                        |
| `Change profile children success`   | Thay đổi tài khoản con thành công!                    |

> Dialog consent AI đang **hardcode tiếng Việt** trong `hooks/useAiConsent.ts`, không qua i18n —
> ghi nhận thêm cho dev nếu app cần hỗ trợ EN.
