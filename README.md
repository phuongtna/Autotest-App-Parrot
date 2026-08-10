# Autotest app Parrot

Bộ khung test automation cho app Android chạy trên máy ảo (AVD) trong Android Studio, dùng [Maestro](https://maestro.mobile.dev/).

## Cấu trúc thư mục

```
.
├── .maestro/config.yaml     # cấu hình workspace Maestro
├── flows/
│   ├── smoke_test.yaml      # test mở app cơ bản
│   ├── login/               # tất cả testcase riêng cho màn hình đăng nhập
│   │   ├── login_success_valid_otp.yaml       # TC1: đăng nhập thành công với OTP hợp lệ (đã pass)
│   │   └── login_fail_unregistered_phone.yaml # TC2: đăng nhập thất bại - số điện thoại chưa đăng ký (đã pass)
│   ├── profile/              # testcase cho chức năng chuyển profile (tài khoản con)
│   │   └── switch_profile_success.yaml # TC: chuyển profile thành công Ngoc -> Ha (đã pass)
│   ├── vui_hoc/               # testcase cho màn hình "Vui học"
│   │   ├── TESTCASES.md       # template để điền case Step/Output trước khi viết flow
│   │   └── study_unit9_protecting_environment.yaml # TC: học Unit 9 ở Khối 10 (đã pass)
│   ├── homework/             # HW-01→27: tab "Bài tập" (port từ maestro_1, xem mục dưới)
│   ├── exercise/              # EX-01→11: cơ chế làm bài (cần build bật EXPO_PUBLIC_E2E=1)
│   ├── report/                # RP-01→26: tab "Báo cáo"
│   ├── helpers/                # subflow dùng chung riêng cho 3 bộ trên (login, mở tab...)
│   └── subflows/
│       └── launch_app.yaml  # subflow dùng chung: clear state + mở app (tự cấp quyền notification)
├── scripts/
│   ├── find_appid.sh        # tìm package name (appId) của app trên máy ảo
│   └── run_tests.sh         # chạy toàn bộ test và xuất báo cáo JUnit
├── test_data/
│   ├── accounts.env         # tài khoản test dạng biến môi trường (số chưa đăng ký...) - không commit lên git
│   └── datatest.js          # tài khoản test dạng JS, nạp bằng runScript (dùng cho flow login, vui_hoc) - không commit lên git
├── .env                     # APP_ID=com.inet.parrotedu (đã cấu hình sẵn)
└── reports/                 # báo cáo test sau khi chạy (tự tạo, không commit)
```

App đang test: **ParrotEdu** — package name `com.inet.parrotedu` (React Native, không có resource-id nên các flow chọn phần tử theo text).

## Chuẩn bị

1. Mở máy ảo Android trong Android Studio (AVD Manager > chọn thiết bị > Run).
2. Kiểm tra máy ảo đã kết nối:
   ```bash
   adb devices
   ```
   Phải thấy một dòng dạng `emulator-5554   device`.
3. Cài app ParrotEdu vào máy ảo (kéo thả file .apk vào cửa sổ emulator, hoặc `adb install path/to/app.apk`).
4. `.env` đã có sẵn `APP_ID=com.inet.parrotedu`. Nếu test app/package khác, dùng `./scripts/find_appid.sh <từ khóa>` để tìm lại.
5. Tài khoản test đã lưu sẵn ở 2 nơi (tùy flow dùng cách nào):
   - `test_data/accounts.env` - biến môi trường, nạp qua `-e` khi chạy `maestro test` (xem `scripts/run_tests.sh`).
   - `test_data/datatest.js` - nạp trực tiếp trong flow bằng lệnh `runScript` (flow `login_success_valid_otp.yaml` đang dùng cách này). Sửa file này nếu cần đổi số điện thoại/OTP/tên profile test khác.

## Chạy test

```bash
# Chạy toàn bộ flows/
./scripts/run_tests.sh

# Chỉ chạy toàn bộ testcase của màn login
./scripts/run_tests.sh flows/login

# Chỉ chạy 1 testcase cụ thể
./scripts/run_tests.sh flows/login/login_success_valid_otp.yaml

# Chạy trực tiếp bằng maestro CLI
maestro test flows/login/login_success_valid_otp.yaml -e APP_ID=com.inet.parrotedu -e PHONE_NUMBER=0936021880 -e OTP_CODE=888888
```

Báo cáo JUnit XML được ghi vào `reports/report.xml` sau mỗi lần chạy `run_tests.sh`.

## Viết test mới

1. Dùng Maestro Studio để xem chính xác id/text của từng phần tử trong app (không cần đoán):
   ```bash
   maestro studio
   ```
2. Mỗi màn hình có 1 thư mục riêng trong `flows/` (vd: `flows/login/`). Mỗi testcase là 1 file `.yaml` riêng trong thư mục đó, đặt tên mô tả rõ case (vd: `login_success_valid_otp.yaml`, `login_invalid_phone.yaml`, `login_wrong_otp.yaml`...). Tham khảo cấu trúc của `flows/login/login_success_valid_otp.yaml`.
3. Nếu nhiều flow dùng chung bước, tách vào `flows/subflows/` và gọi bằng `runFlow: ../subflows/ten_file.yaml` (đường dẫn tương đối từ thư mục con, ví dụ `flows/login/`).
4. Thêm đường dẫn thư mục mới vào danh sách `flows:` trong `.maestro/config.yaml` để Maestro nhận diện (đã thêm sẵn `flows/login/*.yaml`, `flows/profile/*.yaml`, `flows/vui_hoc/*.yaml`).

### Lưu ý khi viết testcase liên quan đến trạng thái tài khoản (vd: chuyển profile)

Một số hành động đổi trạng thái phía backend (không bị xóa bởi `clearState` vì backend nhớ theo tài khoản, không theo app cài trên máy). Ví dụ testcase `switch_profile_success.yaml`: tài khoản test có 2 profile con **Ngoc** và **Ha**, "Chuyển profile" chỉ toggle qua lại giữa 2 profile này. Để lần chạy test sau vẫn ở đúng trạng thái ban đầu (profile Ngoc) và test không bị flaky theo thứ tự chạy, flow cần **chuyển lại về profile ban đầu ở cuối bài test** (bước dọn dẹp) sau khi đã assert xong.

### Các lệnh Maestro thường dùng

| Lệnh | Mục đích |
|---|---|
| `launchApp` / `clearState` | mở app / xóa dữ liệu app |
| `tapOn: {id: "..."}` hoặc `{text: "..."}` | chạm vào phần tử |
| `inputText: "..."` | nhập chữ vào ô đang focus |
| `assertVisible: {text/id: "..."}` | kiểm tra phần tử hiển thị |
| `assertNotVisible` | kiểm tra phần tử không hiển thị |
| `scroll` / `scrollUntilVisible` | cuộn màn hình |
| `back` | nút back |
| `takeScreenshot: ten_anh` | chụp màn hình lưu vào báo cáo |
| `waitForAnimationToEnd` | đợi animation kết thúc trước khi thao tác tiếp |
| `extendedWaitUntil: {visible: {...}, timeout: ms}` | đợi phần tử xuất hiện trong tối đa `timeout` ms (dùng cái này thay vì thêm `timeout` vào `assertVisible` — `assertVisible` KHÔNG nhận field `timeout`, sẽ báo lỗi `Unknown Property`) |

Tài liệu đầy đủ: https://maestro.mobile.dev/api-reference/commands

### Lưu ý khi chọn selector cho input dạng nhiều ô (OTP, mã PIN...)

App React Native thường render input OTP/PIN nhiều ô là **1 vùng bấm ẩn duy nhất** chứ không phải 6 EditText riêng, và không có resource-id. Cách xác định selector đáng tin cậy:
1. Dùng `adb shell uiautomator dump` hoặc `maestro studio` để soi cấu trúc.
2. Nếu chỉ dùng `below: "text mốc"`, Maestro có thể chọn nhầm phần tử lớn hơn ở phía dưới (như nút hoặc text đếm ngược) chứ không phải đúng ô input, khiến `inputText` chạy "thành công" nhưng không có gì được nhập.
3. Khắc phục: kết hợp cả `below` và `above` để khoanh vùng chính xác giữa 2 mốc text đã biết:
   ```yaml
   - tapOn:
       below: "Đổi số điện thoại"
       above: "Xác nhận"
   - inputText: "888888"
   ```

### Popup xin quyền hệ thống (thông báo, camera, vị trí...)

Sau `clearState`, Android có thể hiện lại popup xin quyền (vd: "Allow ParrotEdu... to send you notifications?") ngay sau khi đăng nhập, làm flow bị chặn/flaky vì đây là dialog hệ thống, không phải view của app. Khắc phục bằng cách cho `launchApp` tự cấp quyền luôn khi mở app (đã áp dụng trong `flows/subflows/launch_app.yaml`):

```yaml
- launchApp:
    permissions:
      all: allow
```

### Nạp dữ liệu test từ file `.js` bằng `runScript`

Maestro không dùng `module.exports` hay object literal thông thường. File JS truyền cho `runScript` phải gán trực tiếp vào object có sẵn tên `output`, các thuộc tính đó dùng được ở bước sau qua `${output.ten_bien}`:

```js
// test_data/datatest.js
output.PHONE = '0915775115';
output.OTP = '888888';
```

```yaml
# trong flow
- runScript: ../../test_data/datatest.js
- inputText: ${output.PHONE}
```

Lỗi thường gặp: dùng dấu `;` để ngăn cách các thuộc tính như object literal (`{ PHONE: '...'; OTP: '...'; }`) — đây không phải cú pháp JS hợp lệ cho object, sẽ không lấy được giá trị nào. Phải viết mỗi dòng là 1 câu lệnh gán `output.x = ...;` riêng biệt.

### Viết testcase có nhánh rẽ (if/else) bằng `runFlow: when:`

Một số case có 2 trường hợp tùy trạng thái hiện tại của app (vd: đang ở đúng Khối/đúng Unit hay chưa). Maestro không có if/else thật, thay vào đó viết 2 khối `runFlow` với điều kiện đối lập nhau (`visible` / `notVisible`):

```yaml
- runFlow:
    when:
      notVisible: "Khối 10"
    commands:
      - tapOn: { leftOf: "Chuyển profile" }   # mở dropdown chọn khối
      - tapOn: "Khối 10"
```

Lưu ý khi phần tử cần bấm để MỞ 1 lựa chọn có text thay đổi tùy trạng thái hiện tại (vd: hiển thị "Khối 3", "Khối 8"... tùy lúc, không cố định là "Khối 10"), không thể `tapOn: "Khối 10"` để mở nó. Dùng vị trí tương đối so với 1 mốc cố định bên cạnh thay vì text động, ví dụ `tapOn: { leftOf: "Chuyển profile" }` (chọn phần tử bên trái mốc "Chuyển profile" cố định, bất kể text bên trong là Khối mấy).

### `scrollUntilVisible` dừng sớm khi card quá cao

Nếu 1 "card" trong danh sách cao hơn màn hình (ảnh + tiêu đề + mô tả + nút), `scrollUntilVisible` nhắm vào tiêu đề sẽ dừng ngay khi tiêu đề vừa hiện ra — nút bên dưới có thể vẫn chưa vào khung hình, khiến bước bấm nút sau đó không tìm thấy phần tử. Khắc phục bằng cách `scrollUntilVisible` thêm 1 lần nữa, nhắm thẳng vào nút cần bấm (kết hợp `below` + regex cho các text có thể có):

```yaml
- scrollUntilVisible:
    element:
      text: "Unit 9: Protecting the enviroment"
    direction: DOWN
- scrollUntilVisible:
    element:
      below: "Unit 9: Protecting the enviroment"
      text: "Chinh phục|Ôn tập"   # regex: chấp nhận 1 trong 2 trạng thái nút
    direction: DOWN
```

## Cài đặt Maestro (nếu máy khác chưa có)

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

Máy hiện tại đã có Maestro CLI `2.8.0` cài tại `~/.maestro/bin/maestro`.

## flows/homework, flows/exercise, flows/report - port từ maestro_1

3 bộ này (71 file, HW-\*/EX-\*/RP-\*) được port nguyên bản từ project Maestro riêng
`Documents/maestro_1` (bộ test cho tab "Bài tập" + "Báo cáo" + cơ chế làm bài, viết độc
lập, KHÔNG dùng `automation/`). Chỉ sửa tối thiểu để chạy được trong repo này:

- `appId: com.inet.parrotedu` (hardcode) → `appId: ${APP_ID}` trong toàn bộ 71 file.
- Thêm biến `PHONE`, `OTP`, `PROFILE_NAME_B` vào `test_data/accounts.env` (tên biến khác
  `PHONE_NUMBER`/`OTP_CODE` vì nội dung flow gốc dùng `${PHONE}`/`${OTP}` - chưa đổi tên
  biến bên trong 71 file để giữ đúng bản gốc).
- Sửa 2 chỗ dùng selector `".*<tab>, tab.*"` (hậu tố ", tab" chỉ tồn tại trên iOS
  VoiceOver, luôn FAILED trên Android) còn sót lại trong `helpers/open-tab-report.yaml`
  và `homework/HW-26-filter-resets-on-tab-return.yaml` - cùng lỗi đã được fix trước đó ở
  `helpers/login.yaml`/`helpers/open-tab-homework.yaml`.

**Còn 1 lỗi Android CHƯA sửa** (ghi lại theo đúng chú thích gốc, trước khi HW-02/03/04 được
gộp thành `homework/HW-02_03_04-filter-lifecycle.yaml`; chưa tự sửa vì cần xác nhận lại trên
thiết bị thật trước khi đổi selector):
testID `homework-filter-*` không lộ ra thành Android resource-id, nên selector
`id: "homework-filter-..."` luôn FAILED trên Android. Ảnh hưởng `homework/HW-26`,
`report/RP-12`, `RP-25`, `helpers/open-exercise.yaml` - cần đổi sang selector `text:`
(xem cách `homework/HW-02_03_04-filter-lifecycle.yaml` đã làm) sau khi xác nhận lại trên máy ảo.
`homework/HW-02_03_04-filter-lifecycle.yaml` (gộp từ HW-02+03+04, xem mục tối ưu bên dưới) đã
tự dùng selector `text:` nên không còn bị lỗi này.

### Tối ưu bộ testcase tab "Bài tập" (27 -> 17 flow)

27 case HW-01..HW-27 gốc đã được gộp còn 17 flow để giảm số lần login/relaunch lặp lại mà
không mất coverage - chi tiết mapping, lý do gộp từng cặp case nằm trong các comment đầu mỗi
file gộp (`HW-02_03_04-filter-lifecycle.yaml`, `HW-07_08_09_10_11-card-matrix.yaml`,
`HW-12_13-ai-consent-lifecycle.yaml`, `HW-14_15-exercise-lifecycle.yaml`,
`HW-18_19-role-play-lifecycle.yaml`, `HW-21_22-upgrade-sheet-lifecycle.yaml`). 16 file gốc đã
gộp được giữ nguyên nội dung tại `homework/_deprecated/` (không nằm trong glob
`flows/homework/*.yaml` nên không còn được Maestro chạy) để đối chiếu khi cần, không xoá hẳn
vì thư mục `flows/homework/` tại thời điểm gộp chưa được commit vào git.

Yêu cầu riêng của `exercise/*` (EX-\*): app phải build với `EXPO_PUBLIC_E2E=1` để có
testID `exercise_answer_{i}_correct/_wrong` (xem `flows/exercise/README.md`) - nếu
không case sẽ tự skip qua `runFlow.when`, không fail giả.

Case tag `data-dependent` (cần tài khoản có sẵn dữ liệu cụ thể: bài quá hạn, tài khoản
Pro/Free/rỗng...) có thể fail vì THIẾU DATA, không phải app lỗi - xem
`flows/homework/TEST-CASES.md` mục điều kiện từng case trước khi báo bug.

## automation/ - discovery + bridge bài học ngẫu nhiên từ CMS (đang phát triển)

Project Node.js riêng, độc lập với các flow Maestro ở trên (không sửa/ảnh hưởng gì tới
`flows/`, `scripts/`). Tự khám phá Book/Unit/Lesson/Exercise/Exam/Question/Correct Answer từ
CMS, chọn ngẫu nhiên 1 Exercise, và dùng kiến trúc plugin (1 handler/dạng bài) để sinh ra 1
file Maestro YAML trả lời đúng câu hỏi đó - chưa có bước tự điều hướng app tới đúng màn hình
(vẫn cần tự mở app thủ công trước khi chạy file sinh ra). Xem chi tiết ở
[automation/README.md](automation/README.md).
