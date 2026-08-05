# automation/ — Discovery + Bridge cho test random bài học

Module này **không đụng tới** `flows/`, `scripts/` hay bất kỳ testcase Maestro hiện có nào
(đặc biệt các flow Unit9). Gồm 2 phần tách biệt hoàn toàn:

- **Discovery** (`discovery/`): CHỈ có nhiệm vụ lấy dữ liệu - gọi CMS backend, tự khám phá
  Book → Unit → Lesson → Lesson Item → Exercise → Exam → Question → Correct Answer, chọn
  ngẫu nhiên 1 Exercise, đọc đúng Question/Correct Answer thật từ trang Exam Editor
  (Playwright), chuẩn hoá về `QuestionModel` (`model/questionModel.js`) rồi ghi ra
  `automation/output/discovery.json`.
- **Bridge** (`bridge/`): đọc `discovery.json`, dùng kiến trúc plugin (1 handler/dạng bài) để
  sinh ra 1 file Maestro YAML cụ thể (`automation/output/generated_flow.yaml`). Bridge KHÔNG
  tự chạy `maestro test` - chạy Maestro là bước tách biệt, tự thao tác thủ công.

```
discover (CMS + Exam Scraper)
      ↓
automation/output/discovery.json   (QuestionModel[])
      ↓
generate-flow (bridge, chọn handler theo type)
      ↓
automation/output/generated_flow.yaml
      ↓
maestro test ... (bạn tự chạy, tách biệt hoàn toàn)
```

## Cấu trúc

```
automation/
  package.json            # deps: playwright, js-yaml
  README.md
  src/
    config.js             # đọc CMS_BASE_URL / CMS_ACCESS_TOKEN / APP_ID từ ../.env
  discovery/               # === CHỈ lấy dữ liệu, không biết gì về Maestro ===
    endpoints.js            # bảng path CMS - nơi DUY NHẤT cần sửa khi biết endpoint thật
    cmsClient.js             # gọi API có auth (CMS token hoặc Exam Token), tự refresh Exam Token khi 401
    examToken.js             # cache Exam Token CMS (theo phiên chạy, không phải file bảo mật lâu dài)
    endpointProbe.js          # dò endpoint thay thế khi path suy đoán trong endpoints.js sai
    fetchList.js              # helper dùng chung để gọi endpoint + fallback probe
    entityId.js               # đọc field id/tên của 1 entity CMS khi chưa biết chắc tên field thật
    books.js / units.js / lessons.js / lessonItems.js
    exercises.js / exams.js
    randomPicker.js
    examSession.js             # nạp session thật (cookie/localStorage) export từ Chrome cho Exam Scraper
    examPageScraper.js          # Playwright: mở trang Exam Editor thật, trả RAW question (chưa chuẩn hoá)
    cli.js                     # entrypoint `npm run discover` (--verbose), ghi output/discovery.json
  model/
    questionModel.js         # normalizeQuestion(): RAW CMS shape -> QuestionModel chuẩn - lớp
                              # DUY NHẤT diễn giải shape thô, handler không bao giờ đọc raw trực tiếp
  bridge/                   # === CHỈ dịch QuestionModel -> Maestro step, không gọi CMS ===
    handlers/
      trueFalseHandler.js        # type "TRUE_FALSE" - đã xác nhận
      multipleChoiceHandler.js   # type "ONE" - đã xác nhận (kèm cảnh báo edge-case)
      dragDropHandler.js         # type "DRAG_DROP" - đã xác nhận type, UI action CHƯA verify
      fillBlankHandler.js        # placeholder - CHƯA gặp type thật
      matchingHandler.js         # placeholder - CHƯA gặp type thật
      sentenceBuilderHandler.js  # placeholder - cần hierarchyProbe.js (deferred)
      unsupportedHandler.js      # fallback (vd "SPEAK") - log cảnh báo, bỏ qua, không throw
      index.js                   # registry: type string -> handler
    flowGenerator.js          # entrypoint `npm run generate-flow` - đọc discovery.json, sinh YAML
    maestroBridge.js          # MỚI - Bridge "sống" (tap/input/swipe/wait/isVisible/checkAnswer/
                               # nextQuestion), dùng cho pipeline Runtime bên dưới - khác hẳn
                               # flowGenerator.js (sinh YAML tĩnh), không liên quan tới nhau
  navigation/                 # MỚI - NavigationEngine: điều hướng Book->Unit->Lesson->Exercise
    navigationEngine.js       # bằng thao tác của MaestroBridge, không hardcode, không gọi CMS
  runtime/                    # MỚI - điều phối Discovery(chỉ đọc JSON) -> Navigation -> Handler
    discoveryReader.js         # đọc output/discovery.json (không import automation/discovery/)
    resultWriter.js             # ghi output/run-result.json
    handlers/                    # Handler theo QuestionType (khác bridge/handlers/ - contract mới,
                                  # gọi MaestroBridge trực tiếp thay vì sinh bước Maestro tĩnh)
    index.js                     # entrypoint `npm run run-e2e`
  output/                    # gitignore - discovery.json + generated_flow.yaml + run-result.json
                              # (ghi đè mỗi lần chạy)
```

## Cấu hình

Điền vào file `.env` ở thư mục gốc repo (đã gitignore, không commit):

```
CMS_BASE_URL=https://parrotedu.vn/api/cms
CMS_ACCESS_TOKEN=<token thật của bạn>
# Optional - chỉ cần khi có NHIỀU thiết bị/emulator cùng kết nối (xem mục "Chỉ random Unit đã
# Hoàn thành" bên dưới). Để trống thì maestro/adb tự chọn thiết bị duy nhất đang kết nối.
DEVICE_ID=
```

## Chỉ random Unit đã "Hoàn thành" (bắt buộc thiết bị/emulator + Maestro)

`npm run discover` chỉ random Unit trong nhóm **đã Hoàn thành trên app** - không bao giờ chọn
Unit đang khoá/chưa mở khoá/chưa hoàn thành. Toàn bộ logic nằm trong 3 file tách biệt rõ vai trò:

- `discovery/unitStateDetector.js` - **UnitStateDetector**: nơi DUY NHẤT quyết định
  `COMPLETED`/`NOT_COMPLETED`/`UNKNOWN` + độ tin cậy (`confidence`, 0-1) + nguồn (`CMS`/`UI`).
  Không nơi nào khác trong `discovery/` tự so khớp text nút hay tự đọc field CMS - muốn đổi
  rule (CMS đổi field, app đổi chữ nút, thêm tín hiệu mới...) CHỈ cần sửa file này.
- `discovery/unitStatusProbe.js` - lái Maestro/adb thật, CHỈ trả tín hiệu THÔ (progress fraction
  "x / y", nhãn nút, `enabled`/`clickable` của nút) cho detector, không tự kết luận trạng thái.
- `discovery/unitCompletion.js` - orchestrator: random Book → random Unit trong Book đó → hỏi
  detector → chưa `COMPLETED` thì random Unit khác/Book khác, tới khi tìm được hoặc đã thử hết.

**UnitStateDetector đọc gì (không chỉ dựa vào nhãn nút):** đã xác nhận qua `maestro hierarchy`
thật rằng card layout luôn là tiêu đề → **"x / y" (progress fraction)** → [mô tả] → nút hành
động (`class="android.widget.Button"`, có `clickable`/`enabled`/`accessibilityText`) - nút được
định vị theo **cấu trúc** (class Button), không theo chữ hiển thị. `detectFromUiSignals()` ưu
tiên progress fraction (số liệu, ổn định) làm tín hiệu chính; nhãn nút hiện tại
(`KNOWN_ACTION_LABELS` - data tách riêng, không hardcode trong logic) chỉ dùng đối chiếu để
tăng/giảm confidence:

| Tín hiệu | State | Confidence |
|---|---|---|
| fraction done≥total + nhãn khớp | COMPLETED | 0.98 |
| fraction done<total + nhãn khớp | NOT_COMPLETED | 0.95-0.98 |
| chỉ có fraction (nhãn lạ/thiếu) | theo fraction | 0.90 |
| fraction và nhãn KHÔNG khớp | theo fraction (tin số liệu hơn) | 0.70 |
| chỉ có nhãn (không đọc được fraction) | theo nhãn | 0.55 |
| không đọc được cả 2 / không thấy card | **UNKNOWN** | 0.30-0.40 |

**Vì sao KHÔNG dùng field CMS (`status`/`progress`/...) làm nguồn chính**: đã gọi thật
`getUnitsOfBook()` (2026-08-05) - CMS admin (`CMS_ACCESS_TOKEN`, role "admin") trả
`status: "draft"|"done"` (trạng thái BIÊN TẬP nội dung, không phải tiến độ học) và
`progress`/`completed_items`/`completed_lessons` LUÔN = 0 (tiến độ gắn với 1 học sinh/profile cụ
thể như "Ngoc"/"Ha" trong app, API admin CMS không có ngữ cảnh học sinh nào để tính khác 0). Vì
vậy `detectFromCmsFields()` cố tình KHÔNG tin 2 field này - chỉ dùng field CMS nếu sau này CMS bổ
sung field theo học sinh thật (`completed`/`is_completed`/`percent_completed`/`unlocked`/
`is_locked`/`completion_status`) - hiện tại luôn trả `null` (để UI quyết định).

**UNKNOWN là kết quả hợp lệ, không phải lỗi và không bị coi là "chưa hoàn thành"**: nếu sau khi
thử random hết TẤT CẢ Book/Unit vẫn còn Unit ở trạng thái UNKNOWN, `discover` KHÔNG kết luận
`"No completed Unit found."` - báo riêng số Unit còn UNKNOWN (cần xác nhận thủ công). Chỉ khi
MỌI Unit đều xác định chắc là NOT_COMPLETED (không còn UNKNOWN nào) mới báo
`"No completed Unit found."`.

**Chiến lược random (tối ưu, không scan toàn bộ trước khi thử)**: random 1 Book chưa thử →
random THỨ TỰ Unit trong Book đó → gặp `COMPLETED` là dừng ngay, trả về luôn (không cần đọc hết
Book). Vì chi phí thật nằm ở bước mở app + chuyển Khối (không phải ở việc đọc 1 hay nhiều Unit),
khi đã mở "Danh sách Units" của 1 Book, code đọc tín hiệu của TẤT CẢ Unit trong Book đó ngay
trong 1 lượt scroll rồi mới random thứ tự để tra/log - tránh phải mở lại đúng 1 Book nhiều lần.
Đăng nhập (`bootstrapAppSession()`) chỉ chạy 1 lần cho cả lượt `discover`, chuyển Book
(`openUnitsListForBook()`) chạy lại cho mỗi Book mới cần thử.

Log in ra theo dạng:

```
Book Khối 5
Unit Unit 2: Our homes
State = COMPLETED
Source = UI
Confidence = 0.98
Reason = progress 3/3, khớp nhãn nút "Ôn tập"

Unit được chọn: Unit 2: Our homes
```

**Yêu cầu:** phải có 1 thiết bị/emulator Android đang kết nối (`adb devices`) và đã cài đúng app
(`APP_ID` trong `.env`) - khác với trước đây (`discover` chỉ cần CMS API + Playwright headless,
không cần emulator).

## Chạy

```bash
cd automation
npm run discover              # random 1 Exercise, in gọn, ghi output/discovery.json
npm run discover --verbose    # thêm chi tiết: Lesson Item random trong bao nhiêu lựa chọn,
                               # danh sách đầy đủ Answers của từng Question, v.v.
npm run generate-flow         # đọc discovery.json vừa tạo, sinh output/generated_flow.yaml
npm run run-e2e                # MỚI - tự lái Maestro thật: Navigation -> trả lời -> ghi
                                # output/run-result.json (xem mục "Runtime End-to-End" trên)
```

`discover` cần máy ảo/thiết bị đang kết nối (đọc trạng thái Hoàn thành trên app, xem mục "Chỉ
random Unit đã Hoàn thành"). `generate-flow` không cần (chỉ đọc `discovery.json` đã có, sinh
YAML). `run-e2e` cần máy ảo/thiết bị đang kết nối VÀ app đã mở sẵn, đăng nhập sẵn, đang ở tab
gốc "Vui học" (xem giả định của `NavigationEngine` ở mục "Runtime End-to-End").

Kết quả `discover` thật (ví dụ, đã chạy nhiều lần, luôn ra Book/Unit/Lesson/Exam khác nhau):

```
Book: Khối 4 (id=...)
Unit: Unit 1: My friends (id=...)
Lesson: Lesson 2 (id=...)
Lesson Item: Từ 4 (id=...)
Exercise: Từ 4 (id=...)
Exam: G4U1 8. Japan (id=...)
Question count: 2
Question types: SPEAK, ONE

- Question [SPEAK] (id=...)
  Question: Japan
  Correct answer: (không xác định được đáp án đúng)

- Question [ONE] (id=...)
  Question: Look and choose
  Correct answer: Japan

Đã ghi kết quả ra automation/output/discovery.json
```

(Dạng `SPEAK` - bài nói - không có "đáp án đúng" rời rạc nên không xác định được, đây là kỳ
vọng đúng chứ không phải lỗi - `bridge/handlers/unsupportedHandler.js` sẽ tự bỏ qua câu này.)

`automation/output/discovery.json` (input cho bridge, đúng theo `QuestionModel`):

```json
{
  "book": { "id": "...", "name": "Khối 4" },
  "unit": { "id": "...", "name": "Unit 1: My friends" },
  "lesson": { "id": "...", "name": "Lesson 2" },
  "exercise": { "id": "...", "name": "Từ 4" },
  "examId": "...",
  "examName": "G4U1 8. Japan",
  "questionTypes": ["SPEAK", "ONE"],
  "questions": [
    {
      "id": "...", "type": "ONE",
      "question": "Look and choose",
      "answers": ["Thailand", "Japan", "Singapore", "Malaysia"],
      "correctAnswer": "Japan",
      "metadata": { "title": "...", "point": 1, "index": 0, "raw": { "...": "..." } }
    }
  ]
}
```

## CMS API - đã xác nhận toàn bộ

Đã xác nhận bằng curl + HAR thật (2026-08-05): `examToken`, `books`, `bookDetail`,
`unitsOfBook`, `lessonsOfUnit`, `lessonItemsOfLesson`, `childrenOfLessonItem`,
`lessonItemDetail`, `examsList`. Pipeline chạy xuyên suốt Book → Unit → Lesson → Lesson Item
(đệ quy `children`) → Exercise → lấy được Exam ID thật (nhúng sẵn trong Exercise qua field
`exam_ids`, không cần gọi thêm API).

Cách cập nhật path khi CMS đổi API: sửa đúng dòng trong `discovery/endpoints.js` rồi đổi
`confirmed: true` — không cần sửa logic ở các file khác. Các field chưa chắc tên thật (id,
tên hiển thị...) cũng chỉ cần sửa 1 chỗ trong `entityId.js`.

## Exam Scraper (Playwright) - đọc Question/Correct Answer từ trang Exam thật

**Đã xác nhận (2026-08-05): Question/Correct Answer KHÔNG có API riêng.** Trang
`exam.parrotedu.vn/exam/add/manual?id=<examId>` là Nuxt SSR: server render sẵn toàn bộ dữ
liệu (kể cả đáp án đúng) thẳng vào `window.__NUXT__.data` dựa theo session của request gốc -
đây là lý do Network tab không bao giờ thấy request Fetch/XHR nào cho dữ liệu này dù trang
vẫn hiển thị đúng câu hỏi. `examPageScraper.js` vì vậy dùng Playwright mở đúng trang đó với
session thật rồi đọc thẳng `window.__NUXT__.data`, KHÔNG cố dò/gọi API nào nữa.

Trang yêu cầu đăng nhập qua OAuth2 (Casdoor, domain `account.cambridge.vn`) - đã xác nhận
site không cho xem nếu thiếu đúng session thật (test trực tiếp: mở URL không có cookie chỉ
ra form tạo Exam trống, 0 request nào được gọi). `examPageScraper.js` dùng session **export
từ 1 phiên Chrome thật đã đăng nhập** (không tự động đăng nhập bằng tài khoản/mật khẩu).

### Tạo/refresh file session

Tạo `automation/.cache/exam_session.json` (đã gitignore, không commit):

```json
{
  "examOrigin": "https://exam.parrotedu.vn",
  "cookieHeader": "i18n_redirected=vi; Bearer=<JWT>; _dd_s=...",
  "localStorage": { "user": "{\"token\":\"<JWT>\",\"role\":\"teacher\"}" }
}
```

Cookie tên **`Bearer`** chính là Exam Token (cùng loại lấy được qua CMS API
`GET /api/cms/exams/token`) - đây là phần bắt buộc để SSR nhận diện session, không phải
`localStorage` (localStorage chỉ dùng cho hydrate phía client, không ảnh hưởng SSR).

Cách lấy, thực hiện trên đúng tab đang hiển thị được câu hỏi thật (vào từ CMS: Lesson Item →
icon con mắt → "Mở đề trên exam-core"):

1. DevTools → tab **Network** → filter **"Doc"** (không phải Fetch/XHR) → click request đầu
   tiên (URL dạng `.../exam/add/manual?id=...`) → Request Headers → copy giá trị dòng
   `cookie:` → dán vào `cookieHeader`.
2. DevTools → Console → gõ `allow pasting` nếu bị chặn → chạy
   `copy(JSON.stringify(localStorage))` → dán kết quả vào `localStorage`.

**Token trong cookie `Bearer` có hạn sử dụng** (JWT `exp`) - khi `npm run discover` báo lỗi
"không có window.__NUXT__" hoặc trang lại hiện form trống, lặp lại 2 bước trên để lấy session
mới.

### API chính

- `openExamPage(examId)` - mở trang, trả về `html`, `bodyText`, `windowState` (raw, để debug).
- `parseQuestionsFromExamPage(examId)` - trả về `{ examId, examName, questions: [...] }` với
  `questions` là **RAW nguyên văn từ CMS, chưa chuẩn hoá** - cố tình không strip HTML/diễn
  giải shape ở đây, vì đã quan sát được các dạng bài có shape khác hẳn nhau (vd "ONE"/
  "TRUE_FALSE" có `answers` là mảng object `{id, content}` + `correct` là 1 id; "DRAG_DROP"
  có `answers` là mảng string thuần + `correct` là mảng string). Việc diễn giải thuộc về
  `model/questionModel.js` (xem mục Bridge bên dưới) - đây là lớp DUY NHẤT biết cả 2 shape.

Tìm đúng exam trong `window.__NUXT__.data` bằng cách so khớp `entity.id === examId` (data
được Nuxt lưu theo key hash nội bộ, không phải theo examId) - hoạt động với bất kỳ examId
nào, không hardcode.

## Bridge - QuestionModel + Handler plugin + sinh Maestro flow

### QuestionModel (`model/questionModel.js`)

Hợp đồng dữ liệu DUY NHẤT giữa Discovery và Bridge - handler không bao giờ đọc thẳng shape
thô của CMS:

```ts
interface QuestionModel {
  id: string;
  type: string;              // "ONE" | "TRUE_FALSE" | "DRAG_DROP" | "SPEAK" | ... (thô từ CMS)
  question: string;          // đã strip HTML, đọc được luôn
  answers: string[];         // đã strip HTML
  correctAnswer: string | null;  // null nếu dạng bài không có đáp án đúng rời rạc (vd SPEAK)
  metadata: {
    title: string; point: number; index: number;
    raw: { question, answers, correct };  // nguyên văn CMS - cho handler phức tạp cần thêm dữ liệu
  };
}
```

`normalizeQuestion()` tự nhận diện `answers`/`correct` là dạng object-with-id hay string
thuần và xử lý đúng cho cả 2 - thêm dạng bài mới có shape khác chỉ cần sửa các hàm `extract*`
trong file này, không phải sửa `examPageScraper.js` hay bất kỳ handler nào.

### Handler plugin (`bridge/handlers/`)

Mỗi handler chỉ xử lý 1 dạng bài, export `type` (khớp `QuestionModel.type`) và
`buildSteps(questionModel)` trả về mảng Maestro command (plain object, vd
`{ tapOn: "False" }`). Thêm dạng bài mới = thêm 1 file handler mới + đăng ký vào
`handlers/index.js` - **không sửa Discovery**.

| Handler | Type CMS | Trạng thái |
|---|---|---|
| `trueFalseHandler.js` | `TRUE_FALSE` | Đã xác nhận (đối chiếu chéo với flow Unit9 cũ) |
| `multipleChoiceHandler.js` | `ONE` | Đã xác nhận, nhưng xem cảnh báo edge-case trong file (cùng type từng render UI kéo-thả ở 1 lesson khác - xem flow Unit9 bước S05) |
| `dragDropHandler.js` | `DRAG_DROP` | Type đã xác nhận, **UI action (tap hay swipe) CHƯA verify trên emulator thật** |
| `fillBlankHandler.js` | placeholder | Chưa gặp type thật qua scraper - chưa dùng được |
| `matchingHandler.js` | placeholder | Chưa gặp type thật qua scraper - chưa dùng được |
| `sentenceBuilderHandler.js` | placeholder | Cần `hierarchyProbe.js` (chưa viết) để tính toạ độ lúc chạy |
| `unsupportedHandler.js` | fallback | Dùng cho type không có handler khớp (vd `SPEAK`) - chỉ log cảnh báo + bỏ qua, không throw |

### flowGenerator (`bridge/flowGenerator.js`, entrypoint `npm run generate-flow`)

Đọc `output/discovery.json` → resolve handler theo từng `question.type` → gom hết
`buildSteps()` → ghi 1 file Maestro YAML hợp lệ vào `output/generated_flow.yaml` (đã kiểm
bằng `maestro check-syntax` - pass). KHÔNG tự gọi `maestro test` (Discovery/Bridge và việc
chạy Maestro tách biệt hoàn toàn theo yêu cầu).

**Giới hạn hiện tại (chưa làm, không giả vờ đã xong):** file sinh ra chỉ gồm bước trả lời
câu hỏi, CHƯA có bước đăng nhập/điều hướng tới đúng Book/Unit/Lesson/Exercise đã random -
cần tự mở app và vào đúng màn hình bài tập đó trước khi chạy `maestro test` file sinh ra.

## Runtime End-to-End (NavigationEngine + Bridge sống + Handler)

Song song với pipeline "sinh 1 file YAML rồi tự chạy tay" ở trên, có 1 pipeline THỨ HAI tự lái
Maestro trực tiếp (`npm run run-e2e`), theo kiến trúc Dependency Injection:

```
Runtime (runtime/index.js)
  ↓ inject MaestroBridge
NavigationEngine (navigation/navigationEngine.js)   Handler (runtime/handlers/*.js)
  ↓ dùng                                              ↓ dùng
MaestroBridge (bridge/maestroBridge.js)  <-------------┘
```

- **`bridge/maestroBridge.js`** - lớp trung gian DUY NHẤT nói chuyện với Maestro/adb. Chỉ cung
  cấp thao tác chung: `tap`, `input`, `swipe`, `wait` (chờ có thật), `isVisible` (hỏi ngay, đọc
  `maestro hierarchy`, KHÔNG làm dừng flow nếu không thấy - dùng để rẽ nhánh), `checkAnswer`
  (bấm "Kiểm tra"), `nextQuestion` (bấm "Tiếp theo"), `assertAnswerResult` (poll "Chính xác"/
  "Chưa chính xác"). KHÔNG gọi CMS, KHÔNG biết Book/Unit/Lesson/Exercise/QuestionType là gì. Mỗi
  thao tác (trừ `isVisible`) chạy 1 lượt `maestro test` riêng - chậm hơn 1 file gộp nhiều bước,
  đổi lại đúng nghĩa "cung cấp thao tác" và đơn giản (đã xác nhận thật: nhiều lượt `maestro test`
  liên tiếp KHÔNG làm mất trạng thái app, xem mục Unit đã Hoàn thành ở trên).
- **`navigation/navigationEngine.js`** - nhận `{book, unit, lesson, exercise}` (mỗi cái có
  `.name`, đọc từ `discovery.json` do Runtime truyền vào) rồi tự điều hướng bằng thao tác của
  Bridge - không hardcode tên nào, không gọi CMS, không xử lý câu hỏi. **Giả định**: app đã mở,
  đã đăng nhập, đang ở tab gốc "Vui học" (đăng nhập không thuộc phạm vi NavigationEngine).
- **`runtime/handlers/*.js`** - mỗi Handler chỉ xử lý ĐÚNG 1 `QuestionType`, nhận `bridge` qua
  constructor (Dependency Injection), export `static supports(type)` + `execute(question)`.
  Thêm dạng bài mới = thêm 1 file + đăng ký vào `handlerRegistry.js`.
- **`runtime/index.js`** (entrypoint `npm run run-e2e`) - đọc `output/discovery.json` (CHỈ đọc
  file JSON, không import gì trong `discovery/` - Discovery giữ độc lập hoàn toàn) → tạo 1
  `MaestroBridge` duy nhất, inject cho `NavigationEngine` + `HandlerRegistry` → điều hướng →
  lặp từng Question, resolve Handler, log `[DISCOVERY]/[NAVIGATION]/[RUNTIME]` → ghi
  `output/run-result.json` (book/unit/lesson/exercise/questionType/correctAnswer/
  selectedAnswer/status/duration/timestamp cho từng câu). 1 Handler lỗi (vd chưa implement)
  không làm hỏng cả lượt chạy - log rõ rồi qua câu tiếp theo.

| Handler (`runtime/handlers/`) | Type CMS | Trạng thái |
|---|---|---|
| `trueFalseHandler.js` | `TRUE_FALSE` | Đã xác nhận |
| `multipleChoiceHandler.js` | `ONE` | Đã xác nhận, xem cảnh báo edge-case trong file |
| `dragDropHandler.js` | `DRAG_DROP` | Type đã xác nhận, **UI action CHƯA verify** - chỉ throw TODO, KHÔNG đoán (khác bản `bridge/handlers/dragDropHandler.js` cũ có đoán tapOn) |
| `matchingHandler.js` | `CONNECT` | Type đã xác nhận (nhóm ảnh + nhóm text/audio, map `correct`) qua 1 lần discover thật, **UI action CHƯA verify** - chỉ throw TODO |
| `fillBlankHandler.js` | placeholder | Chưa gặp type thật |
| `sentenceBuilderHandler.js` | placeholder | Chưa gặp type thật, cần đọc toạ độ lúc runtime (chưa có API tương ứng trong Bridge) |

**ĐÃ VERIFY THẬT trên emulator (2026-08-05)**: toàn bộ `NavigationEngine.navigateTo()` cho tới
hết `openExercise()` (chọn Khối "Khối 1" → mở Unit "Unit 1: In the school playground" → mở
Lesson "Lesson 3" (phải scroll) → mở Exercise "Wrap-up grammar" (phải scroll tiếp trong danh
sách hoạt động đã sổ ra) - đã sửa 3 lỗi thật phát hiện qua chạy thật: (1) nút Chinh phục/Ôn tập
không tồn tại khi Unit đang là Unit "hiện tại" ngay trên tab Vui học (chỉ best-effort, không
throw); (2) danh sách Lesson của 1 Unit dài hơn 1 màn hình, cần scroll; (3) danh sách hoạt động
trong 1 Lesson cũng cần scroll để tìm đúng Exercise.

**CHƯA verify được**: bước cuối (Handler thật sự trả lời câu hỏi qua `checkAnswer`/
`assertAnswerResult`/`nextQuestion`) - emulator (AVD `Pixel_8`) mất kết nối ngay sau khi
`openExercise()` chạy xong (lỗi hạ tầng Maestro/adb, không phải lỗi code) trước khi kịp verify
tiếp. Cần chạy lại `npm run run-e2e` (đảm bảo emulator đang chạy) để verify hết
`TrueFalseHandler`/`MultipleChoiceHandler` và cập nhật lại mục này.
Phần điều hướng tham số hoá theo tên thật (`navigate_to_lesson.yaml`) là việc tiếp theo.
