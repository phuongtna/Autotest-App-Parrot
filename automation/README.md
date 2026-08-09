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
# Optional - chỉ cần khi dùng Runtime (npm run run-e2e) và có NHIỀU thiết bị/emulator cùng kết
# nối. Để trống thì maestro/adb tự chọn thiết bị duy nhất đang kết nối. `discover` KHÔNG dùng
# biến này (không cần thiết bị nào).
DEVICE_ID=
```

## Random Book/Unit/Lesson/Exercise (thuần CMS, không kiểm tra trạng thái Hoàn thành)

`npm run discover` random trên dữ liệu CMS - bất kỳ Book nào, bất kỳ Unit nào **đã publish/hiển
thị trên app** đều có thể được chọn. KHÔNG kiểm tra Unit đang "Hoàn thành"/"Ôn tập" hay chưa,
KHÔNG đọc UI/hierarchy, KHÔNG cần thiết bị/emulator/Maestro nào - chỉ gọi CMS API + Playwright
(Exam Scraper). Trình tự (toàn bộ trong `discovery/cli.js`):

```
random Book, CHỈ trong Book type="SELF_LEARN" (getBooks + filterSelfLearnBooks + pickRandom)
  -> random Unit, CHỈ trong Unit status="done" (getUnitsOfBook + filterPublishedUnits + pickRandom)
  -> random Lesson trong Unit đó (getLessonsOfUnit + pickRandom)
  -> random Lesson Item type=EXERCISE trong Lesson đó (getLessonItemsOfLesson + flatten + filter + pickRandom)
  -> resolve Exercise (getExerciseDetail)
  -> random Exam trong exam_ids của Exercise (getExamOfExercise)
  -> đọc Question/Correct Answer thật (parseQuestionsFromExamPage, Playwright)
```

**Vì sao phải lọc Book type="SELF_LEARN" (`books.js#filterSelfLearnBooks`)**: ĐÃ XÁC NHẬN THẬT
(2026-08-05) mỗi Khối có 2 bản ghi Book TRÙNG TÊN, `id` khác hẳn nhau - `"BY_TEACHER"` (sách giao
bởi giáo viên) và `"SELF_LEARN"` (sách tự học). Toàn bộ Unit của bản ghi `"BY_TEACHER"` KHÔNG tồn
tại trên tab "Vui học" (tự học) của app - chỉ `"SELF_LEARN"` mới đúng. Không lọc field này thì có
thể random trúng Unit "hợp lệ" theo CMS nhưng không tồn tại trên app, khiến Runtime tốn rất nhiều
thời gian scroll tìm 1 Unit không bao giờ thấy.

**Vì sao phải lọc Unit status="done" (`units.js#filterPublishedUnits`)**: ĐÃ XÁC NHẬN THẬT
(2026-08-05, đối chiếu toàn bộ 25 Unit của 1 Book SELF_LEARN thật với kết quả quét `maestro
hierarchy` trên app thật - khớp 100%, không ngoại lệ): field `status` trên Unit (`"draft"` vs
`"done"`) chính là trạng thái publish/nháp - `"done"` = đã publish, hiển thị trên app;
`"draft"` = chưa publish, học sinh không thấy. Khác với field `status` ở CẤP BOOK (luôn là
`"active"`, không liên quan tới publish Unit).

**Tự thử lại khi gặp ngõ cụt**: nếu 1 cấp bất kỳ rỗng (vd Book không có Unit nào đã publish,
Lesson không có Lesson Item nào type EXERCISE) hoặc Exam Scraper lỗi, `pickRandomExerciseWithRetry()`
log lại lỗi rồi random lại HOÀN TOÀN từ Book (tối đa 10 lần) - không cần biết/không phụ thuộc
trạng thái Hoàn thành/Ôn tập nào. Hết 10 lần vẫn lỗi mới dừng hẳn và báo lỗi gần nhất.

**Lịch sử**: bản trước đây chỉ random trong nhóm Unit "đã Hoàn thành" (đọc `maestro hierarchy`
thật qua 1 thiết bị/emulator kết nối - xem `unitStateDetector.js`/`unitStatusProbe.js`/
`unitCompletion.js` cũ, đã xoá). Lý do ban đầu là tránh làm bài trong Unit CHƯA hoàn thành sẽ
hoàn thành thật lần đầu (tốn nội dung mới, không lặp lại được mỗi lần chạy automation) - đã đổi
theo yêu cầu nghiệp vụ mới: không cần quan tâm tiến độ học (Hoàn thành/Ôn tập), chỉ cần đảm bảo
Unit chọn ra THẬT SỰ tồn tại trên app (lọc theo Book type + Unit status ở trên).

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

`discover` KHÔNG cần máy ảo/thiết bị nào (chỉ CMS API + Playwright headless). `generate-flow`
cũng không cần (chỉ đọc `discovery.json` đã có, sinh YAML). `run-e2e` cần máy ảo/thiết bị đang
kết nối VÀ app đã mở sẵn, đăng nhập sẵn, đang ở tab gốc "Vui học" (xem giả định của
`NavigationEngine` ở mục "Runtime End-to-End").

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
  liên tiếp KHÔNG làm mất trạng thái app).
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

## Bài tập (Homework) - Discovery (`bai_tap/discovery/homeworks.js` + `bai_tap/model/homeworkModel.js`)

Feature KHÁC hẳn "Vui học" (tab riêng, giáo viên giao bài theo lớp thay vì tự học random) - nằm
riêng trong module `bai_tap/` (đặt tên theo cùng quy ước với `flows/vui_hoc/`), ĐỘC LẬP hoàn toàn
với `discovery/books.js`/`units.js`/... ở trên, không dùng chung code (dù cùng gọi
`discovery/cmsClient.js` + `bridge/maestroBridge.js` - 2 module hạ tầng dùng chung giữa Vui học và
Bài tập, không đặt trong `bai_tap/`):

```
automation/
  bai_tap/
    discovery/
      homeworks.js       # gọi GET /api/user/exams/room.json (teacher portal) + resolveHomeworkLevel()
      homeworkCli.js     # entrypoint `npm run discover-homework`, ghi output/homework_discovery.json
    model/
      homeworkModel.js   # normalizeHomework() + resolveMyStatus()
    navigation/
      homeworkPageObjects.js     # selector/text - CHỈ 3 màn List/FilterSheet/AttemptHistory
      homeworkNavigationEngine.js
    runtime/
      pendingExamLaunch.js       # PendingExamLaunchError + message cố định
      homeworkResultWriter.js    # ghi output/homework_run_result.json
      homeworkIndex.js           # entrypoint `npm run run-homework-e2e`
```

**Đường nối Student → Book đã xác nhận thật (2026-08-06)**: mỗi Khối có Book `type="BY_TEACHER"`
riêng (khác Book `type="SELF_LEARN"` mà Vui học dùng, xem mục lọc `filterSelfLearnBooks` ở trên) -
`Book.grade.id` khớp đúng `Class.grade_id` (đã đối chiếu qua `GET /api/classes/teacher`: Class
"3B" có `grade_id` = đúng `grade.id` của Book "Khối 3" `type=BY_TEACHER`). LessonItem thuộc diện
Bài tập có field `mode: "BY_TEACHER"` riêng (khác Vui học, chưa xác nhận giá trị `mode` bên Vui
học là gì).

### Endpoint danh sách Bài tập - ĐÃ XÁC NHẬN THẬT

```
GET https://parrotedu.vn/api/user/exams/room.json?limit=&page=&period=
```

Test thật 2026-08-06 bằng token vai trò `"teacher"` (tài khoản GV, KHÔNG phải CMS admin token) -
lấy đủ 45/45 bản ghi (page 1+2, `period=WEEK`; `period=MONTH` cho `total=149` - endpoint có filter
theo khoảng thời gian, khớp ý "2 tuần gần nhất"/"1 tháng gần nhất" trong Figma nhưng CHƯA xác nhận
giá trị enum chính xác của `period` khớp 2 lựa chọn đó). Response: `{ status, total, class_names,
creator_rooms, data: [...] }` - `data[]` là danh sách Room (= 1 Bài tập), đã phẳng sẵn
book/unit/lesson/lessonItem, không cần tự đi bộ cây Book→Unit→Lesson→LessonItem như Vui học.

**GIỚI HẠN CHƯA XÁC NHẬN**: token/cookie test được lấy từ tài khoản **giáo viên**, path là
`/api/user/...` (không phải `/api/teacher/...`) nên khả năng cao dùng chung cho token học sinh,
nhưng **chưa có bằng chứng trực tiếp** (chưa capture network request từ chính app học sinh mở màn
"Bài tập"). Cần xác nhận trước khi coi đây là nguồn dữ liệu chính thức cho Runtime.

### `bai_tap/model/homeworkModel.js` - field đã xác nhận vs. loại bỏ

Xem JSDoc đầu file để biết đầy đủ - tóm tắt các quyết định quan trọng:

- **`id` = `room.id`** (quyết định hiện tại, không phải giả định) - response không có
  "homework_id"/"assignment_id" riêng.
- **`examId` = UNRESOLVED, KHÔNG phải quyết định cuối cùng.** Hiện KHÔNG có nguồn dữ liệu nào đã
  được xác nhận đáng tin cậy cho field này:
    - `room.exams` luôn `null` trong toàn bộ dữ liệu hiện có (45/45 bản ghi).
    - `lesson-items/:id` (CMS) **đã được chứng minh KHÔNG đáng tin cậy** (2026-08-06): room
      `7325fd77-...` có `attempts[].examId` thật là `"53d15f32-..."` nhưng `lesson-items/:id`
      cùng `lessonItemId` lại trả `exam_ids: ["188d6a2d-..."]` - khác hẳn.
    - Đã thử đoán endpoint chi tiết 1 Room (404/không lọc) - không tìm ra thêm.
  KHÔNG tạo field `examId` placeholder trong model. Chỉ bổ sung field này khi tìm được đúng
  endpoint mà app học sinh THẬT SỰ dùng để mở bài (network capture lúc bấm "Làm bài" trên 1 bài
  CHƯA từng ai làm) - đây là việc cần làm tiếp, không phải đã đóng lại.
- **`level` (BASIC/ADVANCED, = category "Bài tập về nhà"/"Bài tập nâng cao")** không có trong
  response này - đã xác nhận field này tồn tại và nhất quán qua `GET /api/cms/lesson-items/:id`
  (3 lần test riêng: 1 role_play → `ADVANCED`, còn lại → `BASIC`, đúng theo xác nhận của bạn "AI
  Role Play luôn là bài nâng cao") - dùng `resolveHomeworkLevel(lessonItem.id)` gọi riêng, không
  gộp vào model chính vì khác nguồn/khác auth.
- **`assignedDate`** (ngày giao bài) - không tìm thấy field nào đại diện đúng khái niệm này, loại
  khỏi model.
- **Trạng thái làm bài** (chưa làm/đang làm/hoàn thành) không phải field có sẵn - suy ra bằng
  `resolveMyStatus(homework, userId)` từ `attempts[].userId`/`status` (đã xác nhận 37/45 bản ghi
  không có `answers[]` nào = chưa ai làm).

Đã smoke-test thật `getHomeworks()`/`resolveHomeworkLevel()` (2026-08-06) - chạy đúng, lấy đủ dữ
liệu, không lỗi.

### Cấu hình

**ĐÃ XÁC NHẬN THẬT (2026-08-09) - có API login riêng, KHÔNG cần DevTools thủ công nữa:**
`POST https://parrotedu.vn/api/auth/login` với body `{username, password, role:"teacher"}` trả về
`data.token` - đã test thật token này dùng MỘT MÌNH (không cần cookie đi kèm) authenticate thành
công `GET /api/user/exams/room.json` (200, dữ liệu thật). Đây là API JSON bình thường, KHÁC hẳn
luồng OAuth2 Casdoor ở mục "Exam Scraper" phía trên (luồng đó chỉ áp dụng cho
`exam.parrotedu.vn`/Exam Editor, không phải teacher portal này).

Dùng `../get_teacher_token.sh` (điền `TEACHER_USERNAME`/`TEACHER_PASSWORD` vào `.env` 1 lần) để tự
lấy/refresh `TEACHER_ACCESS_TOKEN` thay vì copy tay qua DevTools:

```bash
./get_teacher_token.sh
set -a; source .env; set +a
```

Thêm vào `.env` (ngoài `CMS_BASE_URL`/`CMS_ACCESS_TOKEN` đã có - `resolveHomeworkLevel()` vẫn cần
2 biến đó):

```
TEACHER_USERNAME=<username tài khoản giáo viên>
TEACHER_PASSWORD=<password tài khoản giáo viên>
TEACHER_ACCESS_TOKEN=<tự động điền bởi get_teacher_token.sh - không cần điền tay>
TEACHER_SESSION_COOKIE=<optional - config.js coi là optional, KHÔNG bắt buộc theo test thật ở trên>
```

`TEACHER_PORTAL_BASE_URL` mặc định `https://parrotedu.vn`, chỉ cần set nếu khác. Lưu ý:
`TEACHER_ACCESS_TOKEN` là JWT có hạn ngắn (quan sát thật ~1 giờ) - hết hạn thì `discover-homework`/
`run-homework-e2e` báo lỗi HTTP 401 rõ ràng, chạy lại `./get_teacher_token.sh` để lấy token mới.

### Test automation Bài tập - PHẠM VI hiện tại (2026-08-06)

Đã viết `bai_tap/navigation/homeworkNavigationEngine.js` + `bai_tap/runtime/homeworkIndex.js` + entrypoint
`npm run discover-homework` / `npm run run-homework-e2e`. **CHỈ implement phần KHÔNG phụ thuộc mở
bài làm thật** (Navigation/Discovery/Runtime/Assertions/Page Objects/Models cho 3 màn: HomeworkList,
HomeworkFilterSheet, HomeworkAttemptHistory) - theo đúng yêu cầu, KHÔNG implement "Start Homework"/
"Open Exam"/"Submit Exam" vì `examId` vẫn đang UNRESOLVED (xem mục trên).

- `bai_tap/navigation/homeworkPageObjects.js` - text/selector của 3 màn trên (lấy từ ảnh Figma, **CHƯA đối
  chiếu `maestro hierarchy` trên thiết bị thật** - cùng tình trạng bản đầu của
  `navigation/navigationEngine.js` trước khi refactor theo lần chạy thật).
- `bai_tap/navigation/homeworkNavigationEngine.js` - các method AN TOÀN: `openHomeworkTab()`,
  `assertHomeworkCardVisible()`, `openFilterSheet()`/`selectFilterRange()`/`applyFilter()`,
  `openAttemptHistory()` (chỉ xem lịch sử điểm/thời gian, KHÔNG hiển thị câu hỏi nên coi là ngoài
  ranh giới "Open Exam"). `startHomework()` và `openAttemptDetail()` **CỐ TÌNH luôn throw**
  `PendingExamLaunchError` (`bai_tap/runtime/pendingExamLaunch.js`), message cố định
  `"Waiting for verified exam launch endpoint."` - không suy đoán examId, không tự tạo endpoint
  mở bài giả.
- `bai_tap/runtime/homeworkIndex.js` - đọc Discovery thật -> mở tab -> assert từng card hiển thị đúng ->
  đánh dấu PENDING (đúng message trên) cho bước mở bài -> ghi `output/homework_run_result.json`
  (status `"CARD_VERIFIED..."`/`"PENDING"`/`"ERROR"` cho từng Homework, không throw làm hỏng cả
  lượt chạy - cùng nguyên tắc `runtime/index.js`).
- `bridge/maestroBridge.js` có thêm `back()` (cú pháp `back` chuẩn của Maestro).

**ĐÃ VERIFY THẬT trên thiết bị (2026-08-06, thiết bị `BDB00056877`, model "Aris", app
`com.inet.parrotedu`, tài khoản học sinh "Ngoc" lớp 3B - đúng khớp Khối 3/lớp "3B" đã xác nhận qua
CMS/teacher-portal ở trên):**

- `openHomeworkTab()` - cả 2 chiều (đã ở sẵn tab, và chuyển thật từ tab "Vui học" sang) - PASS.
  Text tab "Bài tập" KHÔNG bị nhầm với tiêu đề màn dù trùng chữ (lo ngại ban đầu không xảy ra).
- `assertHomeworkCardVisible()` - PASS cho card không cần scroll ("Speaking orange") và card cần
  scroll ("G3-U19-L1: Listen and repeat", card thứ 5 trong danh sách).
- `openFilterSheet()` / `selectFilterRange()` / `applyFilter()` - PASS, bottom sheet khớp 100%
  page objects (title "Xem bài tập theo", 2 radio, nút "Xem"); áp dụng "1 tháng gần nhất" thành
  công, header đổi đúng.
- `openAttemptHistory()` - PASS, màn AttemptHistory hiện đúng Close(X)/tiêu đề/"Lần 1"/điểm/
  "Xem chi tiết" (KHÔNG tap tiếp, đúng ranh giới) - phát hiện thêm 2 field chưa từng biết: "Đúng
  X/2" (số câu đúng) và "Thời gian nộp DD/MM" (ngày nộp, không phải khoảng).
- `bridge.back()` - PASS, quay từ AttemptHistory về List sạch sẽ, không có dialog xác nhận thoát.

**Đã SỬA theo phát hiện thật** (không phải suy đoán): `scrollUntilVisible` timeout tăng từ 20000
lên **45000ms** trong `assertHomeworkCardVisible()`/`openAttemptHistory()` - đã đo THẤT BẠI THẬT
với 20000ms/tốc độ mặc định khi cuộn từ đầu danh sách (báo "No visible element found"), ổn định
sau khi tăng. Phát hiện thêm 1 popup chung MỚI ("Cập nhật phiên bản mới", nút "Để sau") khi chuyển
tab - đã thêm `homeworkPageObjects.popups` + dismiss trong `openHomeworkTab()`.

**CHƯA VERIFY**: trạng thái CTA "Tiếp tục" (tài khoản test hiện không có Homework nào đang dở
dang - chỉ thấy thật "Làm bài"/"Làm lại"/"Chinh phục") - vẫn giữ nguyên trong page objects vì suy
luận hợp lý từ 3 trạng thái còn lại, nhưng chưa có bằng chứng thật. `startHomework()`/
`openAttemptDetail()` (throw `PendingExamLaunchError`) chỉ mới smoke-test bằng fake bridge, không
cần verify thêm trên thiết bị vì cố tình không thực thi hành vi thật nào.

### Milestone: test end-to-end 1 Homework random (`bai_tap/runtime/homeworkIndex.js`)

Viết lại `runtime/homeworkIndex.js` theo đúng yêu cầu milestone - CHỈ chạy 1 Homework random (không
phải lặp hết danh sách như bản trước), 3 giai đoạn tách biệt, giai đoạn sau CHỈ chạy nếu giai đoạn
trước PASS (không chạy tiếp trên nền lỗi, không tự quy lỗi thành PASS):

1. **Discovery** - `getHomeworks()` (danh sách thật) → `filterOutRolePlay()` (TẠM THỜI bỏ type
   `role_play` theo yêu cầu 2026-08-06 - loại này không có Question/Exam pipeline, xem
   `discovery/homeworks.js`) → `pickRandom()` (`discovery/randomPicker.js` dùng chung với Vui
   học) - random THUẦN trên kết quả API, không hardcode Book/Unit/Room nào.
2. **Navigation** - `openHomeworkTab()` → `assertHomeworkCardVisible()` cho đúng Homework vừa
   random ("điều hướng tới màn Homework" = cuộn tới đúng vị trí card, KHÔNG tap CTA).
3. **Runtime (launch)** - gọi THẬT `nav.startHomework(homework)` (không giả lập/không bỏ qua). Vì
   `startHomework()` hiện luôn throw `PendingExamLaunchError` (chưa có endpoint mở bài nào được
   xác nhận), nhánh này bắt đúng lỗi đó → dừng lại, ghi lý do cố định
   `"Blocked by unresolved exam launch endpoint."`, KHÔNG coi là crash. Lỗi nào KHÁC
   `PendingExamLaunchError` được ghi nhận trung thực là `"ERROR"` (không giấu thành PASS/BLOCKED).

**ĐÃ CHẠY THẬT THÀNH CÔNG** (2026-08-06, thiết bị `BDB00056877`, tài khoản học sinh "Ngoc" lớp 3B,
`TEACHER_ACCESS_TOKEN` mới xin lại từ DevTools):

```
Đã random 1/48 Homework: "G3-U18-Lesson 1: Listen and repeat" (type=exercise)
Book: Khối 3 / Unit 18: Playing and doing / Lesson 1

Discovery=PASS  Navigation=PASS  Launch=BLOCKED
  reason: "Blocked by unresolved exam launch endpoint."
```

`output/homework_run_result.json` ghi đủ 4 mục theo yêu cầu: `homework` (HomeworkModel đầy đủ, đã
bỏ `metadata.raw` cho gọn), `discovery`/`navigation` (`{status, message}`), `launch`
(`{status, reason}`). Cũng đã verify riêng nhánh **Discovery FAIL** (dùng token hết hạn trước đó) -
`navigation`/`launch` tự động thành `"SKIPPED"`, không có gì bị gán nhầm PASS.

Trong quá trình test KHÔNG phát hiện thêm request/endpoint thật nào dùng để mở bài (không chủ động
dò network - milestone chỉ yêu cầu dừng đúng lúc gặp `PendingExamLaunchError`, không yêu cầu dò
tiếp). Nếu sau này phát hiện được, sẽ báo cáo bằng chứng trước khi sửa `startHomework()`.

### Đã LÀM THẬT 1 Homework tới hết (vượt ranh giới `PendingExamLaunchError` theo yêu cầu mới 2026-08-06)

Theo yêu cầu mới ("Chạy end-to-end test trên làm 1 bài tập ngẫu nhiên thiết bị Android thật" - tức
KHÔNG dừng ở `PendingExamLaunchError` nữa mà thực sự bấm vào làm), đã thực hiện thật trên thiết bị
`BDB00056877`, tài khoản "Ngoc" lớp 3B. Đây là các phát hiện THẬT xác nhận qua thao tác thật (không
suy đoán):

**1. "Mở bài" (tap CTA "Làm bài") KHÔNG cần endpoint riêng nào - là điều hướng UI thuần.** Bấm
   `tapOn` đúng CTA của 1 Homework (toạ độ lấy từ `maestro hierarchy`, không hardcode text vì trùng
   nhiều CTA "Làm bài" trên cùng màn hình) đưa thẳng vào màn làm bài - app tự lo phần "mở đề" phía
   sau, Bridge/Automation không cần biết/gọi bất kỳ API nào để làm việc này. Popup "AI hỗ trợ học
   tập" đã thấy xuất hiện ở 1 lượt thử trước đó (dismiss bằng "Tiếp tục") nhưng KHÔNG xuất hiện ở
   lượt chạy thành công mô tả bên dưới - chưa xác định được điều kiện chính xác khi nào popup này
   hiện, ghi nhận là KHÔNG ổn định (flaky), không phải luôn có/luôn không.

**2. Homework thật đã hoàn thành:** "G3-U18-Lesson 1: Listen and choose" (`lessonItem.id`
   `c7e69a44-cbcc-4602-b153-2ee2254d2d59`, `room.id` `f2b959de-d042-4f70-a9ba-1a41fc134c99`), dạng
   `type="exercise"`, 5 câu loại `ONE` (single-choice, đáp án là ẢNH không có text). **KHÔNG phải
   random thuần** - cố tình chọn 1 Homework đã có sẵn `attempts[].examId` thật (học sinh khác đã
   làm) để có `examId` đáng tin cậy dùng cross-check qua Exam Scraper TRƯỚC khi làm, tránh lặp lại
   lỗi lệch dữ liệu đã gặp ở lượt thử trước (xem mục dưới).

**3. Phát hiện lỗi thật (chưa xử lý, chỉ ghi nhận):** ở lượt thử ĐẦU TIÊN (Homework
   "G3-U18-Lesson 1: Read and complete", `lessonItem.id` `ab20bfd5-ce15-42b6-bcad-c584c60ed4c3`),
   câu hỏi dạng SORT ("Reorder the letters") hiển thị THẬT 5 ô chữ cái (w,t,r,i,g) trên màn hình,
   nhưng đáp án "correct" scrape được từ `exam_ids` của `lesson-items/:id` (cách lấy examId DUY
   NHẤT khả dụng cho Room CHƯA có attempt nào) lại là chuỗi 7 ký tự "w/r/i/t/i/n/g" = "writing" -
   LỆCH với UI thật. Đây là bằng chứng THỨ HAI (sau lần phát hiện trong CMS ở mục "Bài tập -
   Discovery" phía trên) khẳng định `lesson-items/:id.exam_ids` KHÔNG đáng tin cho Room chưa có
   attempt - đã dừng lại, KHÔNG đoán/không tự sửa đáp án, chuyển sang Homework khác (theo lựa chọn
   của bạn) thay vì cố hoàn thành bài này.

**4. Cơ chế chọn đáp án dạng `ONE` (ảnh, lưới 2x2):** 4 lựa chọn A(trên-trái)/B(trên-phải)/
   C(dưới-trái)/D(dưới-phải) theo đúng thứ tự đọc chuẩn - **đã xác nhận thật** thứ tự này khớp
   1-1 với index trong mảng `answers[]` scrape được (`answers[0]`→A, `answers[1]`→B, `answers[2]`→C,
   `answers[3]`→D): 2/4 vị trí được xác nhận trực tiếp qua field `explain_answer` ghi rõ chữ cái
   (vd `"Đáp án đúng là B"` khớp đúng `answers[1]`), 2/4 vị trí còn lại suy ra từ cùng quy luật đọc
   lưới - và toàn bộ được XÁC NHẬN CHUNG CUỘC bởi màn Kết thúc báo đúng "CHÍNH XÁC 5/5". Bấm vào
   khung ảnh (`tapOn` theo toạ độ từ hierarchy, không theo text vì đáp án không có text) để chọn -
   khung được chọn hiện viền xanh, nút "Tiếp theo" chỉ bật (enable) sau khi đã chọn 1 đáp án.

**5. Bài tập (Homework) KHÔNG chấm từng câu như Vui học** - không có nút "Kiểm tra"/không có
   feedback "Chính xác"/"Chưa chính xác" ngay sau mỗi câu; làm hết toàn bộ N câu rồi mới có 1 màn
   Kết thúc chấm điểm tổng - khác hẳn cơ chế `checkAnswer()`/`assertAnswerResult()` của
   `bridge/maestroBridge.js` (2 hàm đó chỉ dùng cho Vui học).

**6. Nếu lưới đáp án không hiện đủ trên màn hình** (2 ô dưới bị cắt, chỉ thấy 1 sliver) - phải
   `swipe` cuộn xuống NGAY TRONG màn câu hỏi (không phải cuộn danh sách Homework) để hiện đủ nội
   dung trước khi xác định toạ độ tap, KHÔNG suy đoán toạ độ khi chưa thấy đủ ảnh - đã xác nhận
   toạ độ lưới đáp án ổn định lại sau khi cuộn (dùng lại được cho câu tiếp theo cùng dạng).

**7. Màn Kết thúc (`Bài tập X/32` ở header) đã xác nhận thật đủ layout:** mascot + tiêu đề động
   viên (vd "Con đang làm đúng hướng rồi!") + 2 ô thống kê "ĐIỂM SỐ" (vd `10`) và "CHÍNH XÁC" (vd
   `5/5`) + link "Xem bài đã làm" + section "Kiến thức trong bài" + 2 nút `"Tiếp theo"` (theo xác
   nhận của bạn: chuyển sang Homework TIẾP THEO chưa làm, không phải câu hỏi tiếp theo) và
   `"Làm lại"` (theo xác nhận của bạn: làm lại ĐÚNG bài vừa xong) + icon Close (X) góc phải trên
   (bounds thật `[954,96][1062,204]` lúc test) bấm vào quay thẳng về HomeworkList, danh sách tự
   cập nhật tiến độ tổng (`8/32` → `9/32`).

**8. Phát hiện phụ (ngoài ý muốn nhưng có giá trị):** vô tình gửi keyevent HOME (phím Home Android)
   giữa lúc đang làm câu 1/5 (chưa chọn đáp án nào) - app KHÔNG bị kill, toàn bộ trạng thái bài làm
   (câu 1/5, vị trí audio, chưa chọn gì) được giữ nguyên khi mở lại app bằng
   `adb shell monkey -p <package> -c android.intent.category.LAUNCHER 1` (không dùng force-stop) -
   cho thấy app chịu được việc bị đưa xuống nền/mở lại giữa chừng, không mất dữ liệu bài làm.

**Giới hạn còn lại (KHÔNG coi là đã giải quyết chung):** lượt chạy thành công này dựa vào 1 Room
ĐÃ có attempt thật (nên có `examId` đáng tin qua `room.answers[].examId`) - vấn đề gốc "examId
UNRESOLVED cho Room CHƯA từng có ai làm" (mục "Bài tập - Discovery" phía trên) VẪN CHƯA có lời giải
chung - mục 3 ở trên còn cho thấy nó có thể gây lệch đáp án thật nếu cố dùng `exam_ids` từ
`lesson-items/:id` làm nguồn thay thế. `startHomework()`/`openAttemptDetail()` trong
`homeworkNavigationEngine.js` VẪN cố tình chưa implement (vẫn throw `PendingExamLaunchError`) vì đây
là quyết định kiến trúc (cần thiết kế Handler theo QuestionType giống Vui học trước khi generalize
hoá, không phải giới hạn kỹ thuật) - lượt "làm thật" ở trên được thực hiện bằng script tạm/ad-hoc
bên ngoài NavigationEngine, chưa đưa vào code chính thức.
