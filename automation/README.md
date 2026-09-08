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

# CMS Quản lý (web admin: /packages, /orders, /students) - KHÁC CMS_BASE_URL ở trên (đó là API
# nội dung bài học/Exam). Đăng nhập dùng chung CMS_USERNAME/CMS_PASSWORD đã có sẵn (cùng 1 tài
# khoản admin cho cả 3 môi trường). Xem mục "Quản lý gói dịch vụ" ở cuối file.
CMS_ADMIN_ENV=staging   # dev | staging | production
CMS_ADMIN_URL_DEV=
CMS_ADMIN_URL_STAGING=https://cms-staging.parrotedu.vn
CMS_ADMIN_URL_PRODUCTION=https://cms.parrotedu.vn
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
lấy/refresh `TEACHER_ACCESS_TOKEN` thay vì copy tay qua DevTools. Script này (và `get_tokens.sh`
tương tự cho `CMS_TOKEN`/`EXAM_COOKIE`) cần `jq`/`curl`/`awk`/`mktemp` có sẵn trong PATH - có sẵn
mặc định trên hầu hết máy Linux, nhưng **KHÔNG có sẵn mặc định trên Windows** (kể cả trong Git Bash/
MSYS) - cần cài `jq` riêng (vd `winget install jqlang.jq` hoặc tải từ https://jqlang.org/download/)
trước khi chạy trên Windows:

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

## Giao bài tập (Web GV) - Playwright, KHÁC hẳn Maestro (`giao_bai_tap/`)

Tự động hoá **phần web GV** của TC1 (`flows/giao_bai_tap/TESTCASES.md`) - feature này chạy trên
2 hệ thống (web GV `parrotedu.vn/teacher` + app HS), Maestro CHỈ điều khiển được app Android nên
không viết được flow Maestro cho phần web. Dùng Playwright (cùng công cụ với Exam Scraper ở
trên) để tự lái UI web GV thật, entrypoint `npm run assign-homework`:

```
giao_bai_tap/
  navigation/
    teacherPortalPageObjects.js   # text/selector web GV
    teacherPortalSession.js        # đăng nhập THẬT qua form UI (username/password từ .env)
  runtime/
    assignHomeworkFlow.js          # chọn lớp -> assert lớp khối khác disable -> hạn nộp ->
                                    # Unit/Lesson/bài -> "Giao bài đã chọn" -> assert toast
  cli.js                            # entrypoint `npm run assign-homework`
```

**ĐÃ CHẠY THẬT THÀNH CÔNG END-TO-END (2026-08-09)**: `ASSIGN_PRIMARY_CLASS=3B
ASSIGN_OTHER_GROUP_CLASS=6D ASSIGN_DUE_DATE=20/08/2026 ASSIGN_UNIT_NAME="Unit 1: Hello"
ASSIGN_LESSON_NAME="Lesson 1" ASSIGN_HOMEWORK_ITEM_NAME="G3-U1-Lesson 1: Listen and repeat"
npm run assign-homework` - toàn bộ 6 bước (đăng nhập, mở form, chọn lớp, assert lớp khối khác
disable, hạn nộp, chọn Unit/Lesson/bài, submit + assert toast) đều PASS trên web GV thật. Các
phát hiện thật đáng chú ý qua nhiều lượt debug (screenshot + DOM dump, xem comment tại chỗ trong
`assignHomeworkFlow.js`):
- "Hạn nộp" KHÔNG phải input ngày native - là nút mở popover Radix hiển thị lịch (header
  "Tháng N" + lưới ngày + 2 nút chuyển tháng).
- "Chọn Unit" là Radix Select thật (`role="combobox"` mở `role="listbox"`/`role="option"`).
- "Chọn Lesson" là nút toggle phẳng (không phải dropdown) - Unit/Lesson đều đã có sẵn 1 giá trị
  mặc định được chọn, bấm lại vào giá trị ĐANG được chọn sẽ BỎ CHỌN nó (đã gặp lỗi thật: bấm lại
  "Lesson 1" đang active làm mất trắng "Danh sách bài tập") - phải kiểm tra trạng thái hiện tại
  trước, chỉ bấm khi cần đổi khác.

Chỉ có phần "app HS nhận thông báo" của TC1 nằm ngoài phạm vi này - Playwright không điều khiển
app Android, vẫn cần verify riêng (tay hoặc 1 flow Maestro khác).

**Giới hạn còn lại (KHÔNG coi là đã giải quyết chung):** lượt chạy thành công này dựa vào 1 Room
ĐÃ có attempt thật (nên có `examId` đáng tin qua `room.answers[].examId`) - vấn đề gốc "examId
UNRESOLVED cho Room CHƯA từng có ai làm" (mục "Bài tập - Discovery" phía trên) VẪN CHƯA có lời giải
chung - mục 3 ở trên còn cho thấy nó có thể gây lệch đáp án thật nếu cố dùng `exam_ids` từ
`lesson-items/:id` làm nguồn thay thế. `startHomework()`/`openAttemptDetail()` trong
`homeworkNavigationEngine.js` VẪN cố tình chưa implement (vẫn throw `PendingExamLaunchError`) vì đây
là quyết định kiến trúc (cần thiết kế Handler theo QuestionType giống Vui học trước khi generalize
hoá, không phải giới hạn kỹ thuật) - lượt "làm thật" ở trên được thực hiện bằng script tạm/ad-hoc
bên ngoài NavigationEngine, chưa đưa vào code chính thức.

## Lớp phụ trách (Web GV) - Playwright, thêm mới lớp học (`quan_ly_lop_hoc/`)

Tự động hoá TC-ADD-FULL / ADD-05
(`flows/web/teacher/testcases/lop-phu-trach/them-moi.md`) - màn "Lớp phụ trách"
(`parrotedu.vn/teacher/class`), cùng cách làm với `giao_bai_tap/` ở trên (login qua form thật,
Playwright, KHÔNG phải Maestro). Đăng nhập dùng lại thẳng `loginTeacherPortal()` của
`giao_bai_tap/navigation/teacherPortalSession.js` (form login web GV chung, không riêng cho
nghiệp vụ giao bài). Entrypoint `npm run add-class`:

```
quan_ly_lop_hoc/
  navigation/
    teacherClassPageObjects.js   # text/selector popup "Thêm mới lớp học" + heading danh sách lớp
  runtime/
    addClassFlow.js               # mở "Lớp phụ trách" -> "+ Thêm lớp học" -> chọn Khối/Tên lớp/
                                   # Năm học -> Lưu -> assert POST /api/classes 201 + số lớp +1 +
                                   # card lớp mới xuất hiện
  cli.js                           # entrypoint `npm run add-class`
```

Chạy (ví dụ):
```
cd automation
ADD_CLASS_KHOI="Khối 7" ADD_CLASS_TEN_LOP="7QA-Test" ADD_CLASS_HEADLESS=false npm run add-class
```

**Xác nhận thật qua thao tác tay (Claude Browser, Playwright-backed) 2026-08-17 và 2026-08-20**,
chưa chạy qua chính script Node này (script viết lại đúng theo cấu trúc DOM/API đã xác nhận thật
qua 2 lượt đó) - evidence request/response thật xem
`flows/web/teacher/testcases/lop-phu-trach/them-moi-tc-add-full.json`. Phát hiện đáng chú ý khi
viết selector:
- Popup có 2 `<select>` native (Khối học, Năm học) đứng SAU 2 nút trigger tùy biến - set giá trị
  thẳng vào `<select>` là đủ, không cần click mở trigger trước.
- Heading "Danh sách lớp học (n)" xuất hiện ĐÚNG 1 lần bên trong `<main>`, nhưng còn 1 node ẩn
  trùng "(0)" nằm ngoài `<main>` trong accessibility tree - PHẢI scope locator vào `main` khi đọc
  số lượng lớp.

Case Sửa (`sua-lop.md`) trong cùng module `lop-phu-trach/` VẪN chỉ là spec test thủ công, chưa có
automation.

### Xóa lớp học (DEL-02) - `deleteClassCli.js`

Entrypoint `npm run delete-class`, chạy `runtime/deleteClassFlow.js`. Chỉ tự động hoá DEL-02 (xóa
lớp KHÔNG có học sinh) - DEL-04/05/06 (rule AC3 chặn xóa lớp có học sinh) chưa automation.

Chạy (ví dụ):
```
cd automation
DELETE_CLASS_NAME="7QA-Test" DELETE_CLASS_ID="da3efdea-e0ea-4627-b119-a11c329d3d4e" \
DELETE_CLASS_HEADLESS=false npm run delete-class
```

**ĐÃ XÁC NHẬN THẬT (2026-08-20)**: chạy thật xóa lớp `12QA-DeleteTest-0820` (tạo riêng để test) -
`DELETE /api/classes/:id` → 200, xác nhận lại qua gọi thẳng
`GET /api/classes/teacher?academic_year_id=...` (curl, không qua UI) rằng lớp đã biến mất thật,
3 lớp còn lại (`3B`, `7QA-ReRun-0820`, `7QA-Test`) không bị ảnh hưởng. Luồng UI thật khác spec cũ
trong `xoa-lop.md`:
- Nút "Xóa lớp học" nằm TRONG popup "Chỉnh sửa thông tin lớp học" (không phải nút riêng ở màn chi
  tiết).
- Popup xác nhận thật: heading "Xác nhận xóa lớp học", nội dung "Bạn có chắc chắn muốn xóa lớp
  `<tên>` không ?", 2 nút **"Hủy"/"Xác nhận"** (spec cũ đoán "Từ chối"/"Đồng ý" - SAI, cần sửa lại
  `xoa-lop.md`).
- Trang "Chi tiết lớp" (`/teacher/class/:id`) bắn 3 GET song song (`/api/classes/:id`, `/students`,
  `/requests`) - heading tên lớp chỉ hiện đúng SAU KHI cả 3 resolve; bấm "Chỉnh sửa lớp học" quá
  sớm (khi vừa điều hướng, GET còn chạy) có thể khiến các GET bị hủy (`net::ERR_ABORTED`) và nút
  không phản hồi.
- `GET /api/classes/teacher` (không kèm `academic_year_id`) trả về `classes: []` RỖNG dù tài khoản
  có lớp thật - phải luôn kèm `academic_year_id` khi gọi thẳng API (không qua UI) để lấy đúng dữ
  liệu, tránh nhầm tưởng mất dữ liệu.

**Giới hạn đã biết:** cả `addClassFlow.js` và `deleteClassFlow.js` đọc số lượng lớp qua
`navigation/classListCount.js#readStableClassListCount()` (đếm nhãn "Sĩ số:" + chờ 3 lần đọc liên
tiếp bằng nhau). Khi máy đang thiếu RAM nặng (đã gặp thật lúc debug, `free -h` chỉ còn ~300Mi free,
load average >2) giá trị "before" đôi lúc vẫn đọc sai (renderer bị delay bởi swap, "network response
đã về" không đồng nghĩa "DOM đã cập nhật xong") dù DELETE/POST thật đã chạy đúng - đây là giới hạn
của môi trường chạy test lúc đó, KHÔNG phải bug nghiệp vụ (đã đối chiếu qua API thật ở trên xác nhận
hành vi xóa luôn đúng). Nên chạy lại khi máy đỡ tải nếu gặp lại lỗi tương tự.

### Duyệt yêu cầu vào lớp - `approveStudentRequestCli.js`

Entrypoint `npm run approve-student-request`, chạy `runtime/approveStudentRequestFlow.js`. Tự
động hoá bước 2/3 của TC_12/TC_19 (`flows/app/roi_khoi_lop/RKL-12_19-rejoin-after-teacher-approval.md`)
- duyệt 1 yêu cầu vào lớp cụ thể (theo tên học sinh) trên "Chi tiết lớp".

Chạy (ví dụ):
```
cd automation
APPROVE_CLASS_ID="db7ae7b7-ead9-4fd0-841d-7c1c13c5d57a" \
APPROVE_STUDENT_NAME="QA Auto Child 20260908_112008" npm run approve-student-request
```

**ĐÃ XÁC NHẬN THẬT (2026-09-08)** end-to-end trên staging: app tạo yêu cầu vào lớp (Maestro) ->
script này duyệt (Playwright) -> app phản ánh lại đúng lớp đã duyệt. Phát hiện quan trọng: bấm
"Duyệt" trên 1 hàng KHÔNG duyệt ngay - mở tiếp 1 dialog xác nhận lồng bên trên ("Duyệt học sinh",
2 nút "Hủy"/"Xác nhận"). Cả 2 dialog (danh sách + xác nhận) đều `role="dialog"` với tên accessible
CHỒNG LẤN nhau (heading dialog danh sách chứa cả text nút "Duyệt tất cả (N)" trong cùng `<h2>`) -
`getByRole("dialog", {name})` (kể cả `exact:true`) không phân biệt được, phải dùng
`page.locator('[role="dialog"]', {hasText: <cụm CHỈ có ở 1 dialog>})` - xem
`teacherClassPageObjects.js#pendingRequestsDialog/confirmApproveDialog`.

### Snapshot roster lớp trước/sau khi rời lớp - `classRosterSnapshotCli.js` + `compareClassRosterCli.js`

Entrypoint `npm run capture-class-roster` (chụp) + `npm run compare-class-roster` (so sánh) - tự
động hoá TC_14/TC_15 (học sinh biến mất khỏi roster + sĩ số giảm đúng 1 sau khi rời lớp thật). Gọi
`capture` 2 lần (trước và sau sự kiện rời lớp thật ở Maestro, khác `OUT_FILE`), rồi `compare`.

```
cd automation
SNAPSHOT_CLASS_ID="..." SNAPSHOT_CLASS_NAME="5X-RKLRejoin2" \
  SNAPSHOT_OUT_FILE=output/roster_before.json npm run capture-class-roster
# ... chạy Maestro cho học sinh rời lớp thật ở giữa ...
SNAPSHOT_CLASS_ID="..." SNAPSHOT_CLASS_NAME="5X-RKLRejoin2" \
  SNAPSHOT_OUT_FILE=output/roster_after.json npm run capture-class-roster
COMPARE_BEFORE_FILE=output/roster_before.json COMPARE_AFTER_FILE=output/roster_after.json \
  COMPARE_STUDENT_NAME="..." npm run compare-class-roster
```

**ĐÃ XÁC NHẬN THẬT (2026-09-08)**, cả TC_14 và TC_15 PASS. 2 gotcha đã sửa khi viết
`navigation/classListCount.js#readClassCardSiSo` + `navigation/classRosterList.js`:
- Đọc "Sĩ số" của 1 lớp cụ thể: thử `page.locator("div", {has: heading})` trước - SAI (khớp cả các
  div bao ngoài cùng chứa TOÀN BỘ trang/mọi lớp khác, vì text bubble lên mọi cấp cha). Fix:
  `heading.locator("xpath=./parent::*")` lấy ĐÚNG 1 phần tử cha trực tiếp (khớp cấu trúc DOM thật).
- Nút "Xem báo cáo học tập" trong mỗi hàng roster là `<button>`, KHÔNG phải `<a>` - lọc theo `<a>`
  đọc ra 0 hàng dù roster có học sinh thật.

### Snapshot bài tập trước/sau khi rời lớp (TC_16) - `classAssignmentSnapshotCli.js` + `compareAssignmentSnapshotCli.js`

Entrypoint `npm run capture-assignment-snapshot` + `npm run compare-assignment-snapshot` - cùng
mẫu snapshot before/after như roster ở trên, nhưng đọc 1 dòng trên "Danh sách bài tập đã giao"
(tổng số HS đã làm + "ĐIỂM TB", cùng 2 giá trị `verifyAverageScoreFlow.js` đã đọc).

**ĐÃ XÁC NHẬN THẬT (2026-09-08)** phần "tổng số HS": giao 1 bài cho lớp test (`5X-RKLRejoin2`,
`npm run assign-homework` gọi trực tiếp qua `assignHomeworkFlow()` - CLI wrapper
`giao_bai_tap/cli.js` bắt `ASSIGN_OTHER_GROUP_CLASS` là bắt buộc dù hàm flow coi là optional, nên
gọi thẳng hàm thay vì qua CLI khi không có lớp khối khác để so sánh), tự làm bài đó qua app (1 HS
duy nhất trong lớp) rồi cho rời lớp thật - tổng số HS đã làm giảm ĐÚNG 1 -> 0. Phần "điểm TB"
**SKIP, không kết luận được**: lớp chỉ có 1 HS nên sau khi rời còn 0 HS - "điểm TB" của tập rỗng
không còn ý nghĩa toán học (giá trị hiển thị đứng yên ở "0.0" cả trước/sau chỉ vì HS duy nhất đó
điểm 0, không phải bằng chứng tính sai). Cần setup lại với ≥2 HS (1 người rời, còn lại có điểm để
tính trung bình mới) mới verify được công thức tính lại thật - xem `compareAssignmentSnapshotCli.js`.

**Phát hiện phụ (2026-09-08, KHÔNG liên quan automation/, nằm ở `flows/app/helpers/`)**: khi tự
làm bài loại "connect" (nghe-nối, `exercise_connect_left_N`/`right_N`) qua
`flows/app/bai_tap/ktra_fullluong_lambai.yaml` để tạo dữ liệu test cho case này, phát hiện 2 gap
thật trong `answer-current-exercise-generic.yaml`:
- Cặp đầu tiên (index 0) không được tap thành công trong 1 lượt scroll-và-tap (WARNED, optional
  không tìm thấy) trong khi các cặp 1..N phía dưới tap bình thường - nghi do cặp 0 nằm phía TRÊN
  cùng danh sách (cần cuộn NGƯỢC LÊN, không phải xuống) trong khi
  `ensure-exercise-controls-visible.yaml` chỉ cuộn XUỐNG để tìm control.
- Sau khi ghép hết các cặp, nút submit thật là **"Tiếp theo"** (text, xuất hiện SAU KHI ghép xong
  toàn bộ) - KHÔNG phải `exercise_check_button` (id) mà handler generic đang tap - khiến vòng lặp
  `repeat while exercise_result_screen not visible` chạy hết 25 lượt vô ích rồi FAIL dù bài đã ghép
  đúng gần hết. Phải hoàn thành cặp còn thiếu + bấm "Tiếp theo" bằng tay mới qua được màn kết quả.
  CHƯA sửa vào handler chung (ngoài phạm vi phiên này) - ghi lại để phiên sau xử lý nếu cần tự
  động hoá lại loại bài "connect" trên route Bài tập.

## Quản lý gói dịch vụ (CMS Admin, web) - Playwright (`quan_ly_goi_dich_vu/`)

Testcase đầy đủ (40 case, nhóm "Gói mặc định" + "Gán gói dùng thử khi tạo đơn thủ công"): xem
[`flows/cms/goi_dich_vu/TESTCASES.md`](../flows/cms/goi_dich_vu/TESTCASES.md).

CMS Quản lý (đăng nhập `admin`/mật khẩu ở `CMS_USERNAME`/`CMS_PASSWORD`, các màn `/packages` "Quản
lý gói dịch vụ", `/orders` "Quản lý đơn hàng", `/students` "Quản lý học sinh") là **hệ thống KHÁC
hẳn** `CMS_BASE_URL`/`giao_bai_tap`/`quan_ly_lop_hoc` ở trên (những cái đó là CMS nội dung bài
học/Exam và web GV `parrotedu.vn/teacher`) - web admin nghiệp vụ gói dịch vụ/đơn hàng/gán gói dùng
thử, UI Nuxt + Naive UI (class prefix `n-`, KHÔNG có resource-id).

**ĐÃ CHẠY THẬT THÀNH CÔNG (2026-09-07, `npm run test-goi-dich-vu`, môi trường staging)**: 30/35 case
Pass tự động, 1 Skip (GRANT-07, chờ 24h - xem bên dưới), 4 case cần thêm vài vòng fix trước khi ổn
định (race condition/eventual-consistency, đã sửa - xem "Bài học đã gặp thật" bên dưới). Report JSON
đầy đủ mỗi lần chạy: `automation/output/goi_dich_vu_report_<runId>.json`.

```
quan_ly_goi_dich_vu/
  navigation/
    cmsAdminSession.js        # đăng nhập thật qua form (Playwright, giống teacherPortalSession.js)
    cmsAdminPageObjects.js    # TOÀN BỘ selector đã xác nhận thật qua DOM dump (không đoán từ ảnh) +
                              # helper thao tác dùng chung (n-select, switch, checkbox, bảng, modal)
  runtime/
    packageCasesFlow.js       # UI-01..06, SAVE-01..05, DEACT-01..04, ORDER-01..04, FIELD-01,
                              # REG-01..03 - TỰ TẠO gói riêng (AUTO-<runId>-A/B/C/D), không phụ
                              # thuộc dữ liệu có sẵn -> an toàn chạy lại nhiều lần, mọi môi trường
    grantCasesFlow.js         # GRANT-01,02,02b,03,04a,04b,05,06,08,12 + DEACT-05 - CẦN 1 học sinh
                              # thật (CMS_ADMIN_TEST_STUDENT_PHONE), tự SKIP nếu thiếu
  cli.js                      # entrypoint `npm run test-goi-dich-vu`
```

### Chạy - 1 lệnh duy nhất, chọn môi trường qua biến

```bash
cd automation
CMS_ADMIN_ENV=staging npm run test-goi-dich-vu        # hoặc dev / production
npm run test-goi-dich-vu -- --env=production          # cách khác, không cần sửa .env
CMS_ADMIN_HEADLESS=false npm run test-goi-dich-vu      # xem browser thật khi cần debug selector
```

Không cần đổi code khi đổi môi trường - `cli.js` tự resolve URL qua `resolveCmsAdminBaseUrl()` +
tự lấy `studentPhone` qua `CMS_ADMIN_TEST_STUDENT_PHONE` (xem mục biến môi trường bên dưới).

### Biến môi trường (3 môi trường: dev/staging/production)

```
# .env
CMS_ADMIN_ENV=staging   # dev | staging | production - chọn môi trường khi chạy test
CMS_ADMIN_URL_DEV=
CMS_ADMIN_URL_STAGING=https://cms-staging.parrotedu.vn
CMS_ADMIN_URL_PRODUCTION=https://cms.parrotedu.vn

# 1 học sinh CÓ THẬT trên môi trường đang test - dùng bởi grantCasesFlow.js (tạo đơn hàng thật gán
# cho profile này). PHẢI đổi khi đổi môi trường - mỗi môi trường có dữ liệu học sinh khác nhau.
CMS_ADMIN_TEST_STUDENT_PHONE=0944123123
```

- Đăng nhập dùng chung `CMS_USERNAME`/`CMS_PASSWORD` đã có sẵn trong `.env` (xác nhận cùng 1 tài
  khoản `admin`/`Parrot@20266` cho cả 3 môi trường, 2026-09-07) - KHÔNG cần thêm biến riêng.
- `CMS_ADMIN_URL_DEV` đang để trống - **chưa có môi trường dev riêng tại thời điểm này**. Nếu
  `CMS_ADMIN_ENV=dev` mà biến này trống, code throw lỗi rõ ràng (tên biến cần điền) thay vì âm thầm
  chạy nhầm môi trường khác.
- `CMS_ADMIN_URL_PRODUCTION` **chưa xác nhận truy cập thật** - suy ra theo quy ước bỏ tiền tố
  `-staging` khỏi domain staging (xác nhận qua lựa chọn trong hội thoại, chưa tự tay mở link kiểm
  tra). Sửa lại giá trị này nếu sai, không cần đổi code.
- `CMS_ADMIN_TEST_STUDENT_PHONE` để trống thì `grantCasesFlow.js` tự SKIP toàn bộ case GRANT-*
  (không giả định Pass/Fail) - report sẽ liệt kê rõ lý do.

### Resolver (`automation/src/config.js`)

```js
import { config, resolveCmsAdminBaseUrl, requireCmsAdminConfig } from "./src/config.js";

requireCmsAdminConfig();                           // throw nếu thiếu CMS_USERNAME/CMS_PASSWORD
const baseUrl = resolveCmsAdminBaseUrl();          // đọc CMS_ADMIN_ENV trong .env
const stagingUrl = resolveCmsAdminBaseUrl("staging"); // hoặc ép 1 môi trường cụ thể
```

### Playwright Test thật (`*.spec.js`, `npx playwright test`)

Ngoài script tự viết (`cli.js`, dùng bởi `npm run test-goi-dich-vu`), 34 case (UI-01..06,
SAVE-01..05, DEACT-01..05, ORDER-01..04, FIELD-01, REG-01..03,
GRANT-01/02/02b/03/04a/08/12/05/06/04b) còn có bản chuyển sang **Playwright Test** (test runner
chính thức, `test()`/`expect()`) - **ĐÃ CHẠY THẬT PASS 34/34** (2026-09-07, `npx playwright test`,
môi trường staging), TẤT CẢ DỒN CHUNG 1 FILE theo yêu cầu (1 `test.describe.serial()`, dùng chung
đúng 3 gói tự tạo `AUTO-<runId>-A/B/C` xuyên suốt cho cả nhóm Gói mặc định lẫn nhóm GRANT - không
tạo thêm gói D/E riêng, khớp đúng luồng liên tục gốc của `packageCasesFlow.js`/`grantCasesFlow.js`).
GRANT-12 chạy TRƯỚC GRANT-05/06 (xác nhận đơn Thành công) vì sau khi Thành công gói dùng thử tự
inactive (GRANT-06) - không còn "đang hiệu lực" để test premise của GRANT-12 nữa:

```
../flows/cms/goi_dich_vu/
  goi-mac-dinh-pass-01-20.spec.js   # 34 case, 1 file duy nhất (tên giữ nguyên dù đã hơn 20 case -
                                    # tiếp tục thêm case mới vào ĐÂY, không tách file khác).
                                    # DEACT-05/GRANT-03/GRANT-04a/GRANT-12/GRANT-05/GRANT-06/
                                    # GRANT-04b cần CMS_ADMIN_TEST_STUDENT_PHONE, tự test.skip()
                                    # nếu thiếu - đặt ở flows/ (không phải automation/), cùng quy
                                    # ước file test/entrypoint thật nằm ở
                                    # flows/web/giao_bai_tap/*.mjs. Import code dùng lại từ
                                    # automation/quan_ly_goi_dich_vu/ qua đường dẫn tương đối + qua
                                    # playwrightTest.js (xem ghi chú dưới).
quan_ly_goi_dich_vu/
  playwrightTest.js                 # re-export test/expect từ @playwright/test - file ở flows/
                                    # PHẢI import qua đây, KHÔNG import "@playwright/test" trực
                                    # tiếp (Node resolve node_modules ngược từ vị trí file, flows/
                                    # không có node_modules riêng - xem comment trong file)
playwright.config.js                # testDir=../flows/cms/goi_dich_vu, workers=1 (case phụ thuộc
                                    # trạng thái lẫn nhau, KHÔNG chạy song song được)
```

**Lưu ý quan trọng khi thêm file `.spec.js` mới trong `flows/`:** repo gốc (thư mục cha của cả
`automation/` và `flows/`) giờ có 1 `package.json` tối giản `{"type": "module"}` - BẮT BUỘC phải có
file này thì Playwright Test mới load được các module `.js` ở `automation/` (vd `src/config.js` có
dùng `import.meta.url`) khi được import từ file test nằm NGOÀI `automation/` (ĐÃ GẶP THẬT
2026-09-07: thiếu file này báo lỗi `Cannot use 'import.meta' outside a module` dù `automation/`
đã tự có `"type": "module"` riêng - Playwright Test tính "rootDir" theo tổ tiên chung của `testDir`
và thư mục chứa config, không phải theo `package.json` gần nhất của từng file như Node thuần).

Chạy:
```bash
cd automation
CMS_ADMIN_ENV=staging npx playwright test    # hoặc npm run test-goi-dich-vu-pw
CMS_ADMIN_HEADLESS=false npx playwright test # xem browser thật
npx playwright show-report output/playwright-report  # xem HTML report sau khi chạy
```

Dùng `test.describe.serial()` + 1 `page` DÙNG CHUNG cho cả file (tạo ở `test.beforeAll` qua fixture
`browser`, KHÔNG dùng fixture `page` mặc định vì fixture đó tạo context mới cho MỖI test - sẽ mất
popup/gói vừa tạo ở test trước, các case này phụ thuộc trạng thái lẫn nhau theo đúng thứ tự nghiệp
vụ y hệt `packageCasesFlow.js`). Nhớ chạy `npm run cleanup-goi-dich-vu` sau khi test xong (spec tự
tạo gói riêng tiền tố `AUTO-`, không tự dọn).

### Case 9 (kế hoạch test "Rời khỏi lớp") - đối chiếu "Quản lý học sinh" > "TÊN TRƯỜNG" - `readStudentSchoolNameCli.js` + `compareSchoolNameSequenceCli.js`

Case bổ sung (không thuộc số TC_01..21 gốc, do QA cung cấp riêng): khi profile rời lớp thành công
HOẶC đang ở trạng thái "Đang chờ duyệt vào lớp", cột "TÊN TRƯỜNG" trên CMS Quản lý > "/students"
phải để trống; chỉ hiện đúng tên trường sau khi giáo viên duyệt. User đã tự tay verify case này
PASS trên staging trước đó - phiên 2026-09-08 viết lại thành automation + chạy lại xác nhận.

```
cd automation
# Đọc 1 snapshot tại 1 thời điểm - gọi lại nhiều lần quanh chuỗi thao tác đổi trạng thái lớp thật
SCHOOL_PHONE_DIGITS="84915775115" SCHOOL_PROFILE_NAME="QA Auto Child 20260908_131217" \
  SCHOOL_OUT_FILE=output/school_state_pending.json npm run read-student-school-name

# So 3 snapshot (pending/approved/after-leave), kết luận PASS/FAIL
SCHOOL_PENDING_FILE=output/school_state_pending.json \
  SCHOOL_APPROVED_FILE=output/school_state_approved.json \
  SCHOOL_AFTER_LEAVE_FILE=output/school_state_after_leave.json \
  SCHOOL_EXPECTED_NAME="Trường Tiểu học QA" npm run compare-school-name-sequence
```

**ĐÃ XÁC NHẬN THẬT (2026-09-08)** cả 3 trạng thái, TÁI SỬ DỤNG profile/lớp đã có sẵn từ TC_12/19/
14/15/16 (không tạo thêm dữ liệu mới) - cho profile đã hết lớp request-join lại chính lớp đó
(`5X-RKLRejoin2`), rồi lặp lại chuỗi duyệt → rời lớp:
- Đang chờ duyệt: `"—"` (em dash - giá trị rỗng thật, không phải chuỗi rỗng `""`) - PASS.
- Đã duyệt: `"Trường Tiểu học QA"` - PASS.
- Sau khi rời lớp: `"—"` - PASS.

Cột "TÊN TRƯỜNG" là index 4 (0-based) trên bảng `/students` (thứ tự cột thật: ` `, STT, SỐ ĐIỆN
THOẠI, TÊN PROFILE, TÊN TRƯỜNG, LOẠI TÀI KHOẢN, GÓI DỊCH VỤ, NGÀY TẠO, HÀNH ĐỘNG) - xem
`navigation/cmsAdminPageObjects.js#readStudentSchoolName`.

### Case KHÔNG có trong bộ chạy tự động

- **GRANT-07** (đơn tự Hủy sau 24h): luôn SKIP - không automate việc chờ 24h trong 1 lần chạy ngắn.
- **FIELD-02/03, GRANT-09**: Blocked từ khi test tay (field ẩn hoàn toàn khỏi UI / điều kiện tiên
  quyết không đạt được) - không có gì để tự động hoá thêm.
- **GRANT-10/11**: Exploratory, chưa có rule chính thức để assert Pass/Fail (cần BA xác nhận trước).

### Bài học đã gặp thật khi viết automation (Naive UI + Playwright)

- **Login**: không có `<form>` thật, input định vị bằng `input[placeholder="..."]`. Sau khi bấm
  "Đăng nhập", app điều hướng bằng client-side routing (Nuxt) - PHẢI `page.waitForURL(...)`, dùng
  `waitForLoadState("networkidle")` không đủ (không có full page navigation).
- **Naive UI `n-select` (Gói dịch vụ mua / Gói dùng thử áp dụng / Tên Profile học sinh)**: mỗi
  select MỞ RA 1 `.n-base-select-menu` TELEPORT riêng, nhưng menu CŨ không unmount khi đóng - chỉ
  ẩn đi (còn nguyên trong DOM). Query `.n-base-select-option` không kèm `:visible` sẽ khớp NHẦM
  option của 1 dropdown khác đã mở trước đó trong cùng phiên popup. Luôn dùng
  `.n-base-select-option:visible`.
- **Field "Tên Profile học sinh" (order popup)**: hết class `--disabled` KHÔNG đồng nghĩa danh sách
  profile đã load xong (API tìm theo số điện thoại có debounce) - bấm mở đúng lúc dữ liệu chưa về
  sẽ ra dropdown rỗng, chọn hụt. Khắc phục bằng tự poll mở lại (Escape rồi mở lại) tới khi thấy
  option thật, không tin 1 lần mở là đủ (xem `selectFirstOrderProfileOption`).
- **1 số điện thoại có thể có NHIỀU profile con** (`/students` hiện 1 dòng/profile, cùng chung số
  điện thoại) - lọc dòng bảng chỉ theo số điện thoại có thể khớp NHẦM profile. Phải lọc thêm theo
  TÊN profile đã chọn lúc tạo đơn (`selectFirstOrderProfileOption` trả về tên đã chọn để dùng lại).
- **Eventual consistency sau khi Lưu** (cả popup gói dịch vụ lẫn đơn hàng): đọc lại trạng thái NGAY
  sau khi popup đóng đôi lúc vẫn thấy dữ liệu CŨ trong vài trăm ms (vd SAVE-05: 2 lần lưu gần như
  đồng thời, đọc ngay sau đó vẫn thấy gói lưu TRƯỚC là mặc định, phải poll thêm ~1-3s mới thấy gói
  lưu SAU thắng đúng như kỳ vọng). `savePackagePopup`/`saveOrderPopup` đợi popup đóng HẲN (không
  dùng `waitForTimeout` cố định), và các case nhạy cảm với thứ tự ghi (SAVE-05, DEACT-01) tự poll
  thêm tới khi đúng trạng thái mong đợi hoặc hết lượt thử.
- **Xác định đơn hàng vừa tạo**: KHÔNG tin "dòng đầu bảng" ngay sau khi lưu (bảng có thể chưa kịp
  refetch) - đối chiếu tập mã đơn TRƯỚC/SAU khi lưu, lấy mã KHÔNG có trong tập trước.
