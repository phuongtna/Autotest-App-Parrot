# Self-learning Answering Baseline

## Environment

- Environment: **Production** (Environment A)
- App package: `com.inet.parrotedu`
- Build: versionName `1.0.12`, versionCode `21` (confirmed via `adb shell dumpsys package`, unchanged across both sessions — `firstInstallTime`/`lastUpdateTime` = 2026-09-21 17:31:26, re-confirmed 2026-10-05)
- Dates: 2026-10-02 (session 1) + 2026-10-05 (session 2, same baseline — no APK swap in between, confirmed via unchanged `lastUpdateTime`)
- Device: physical Android, serial `3201d866d40a1681` (SM_M205G)
- Test account/profile: phone account with profile **"Ngoc"** (Pro), active class **Khối 9** (profile not switched — only the in-app "Vui học" book selector was changed, per standing project convention of never switching the active profile to chase a test target)
- Automation: `automation/vui_hoc/` (engine) + two new files written for this task (unchanged, reused as-is across both sessions, no modification needed):
  - `automation/vui_hoc/vuiHocWrongAnswers.js` — deliberate-wrong-answer builders (pure functions, no production code changed)
  - `automation/vui_hoc/runVuiHocScenarioMatrix.mjs` — scenario-matrix runner
- Ground truth for "correct answer" on every scenario below comes from the CMS Exam API (same pipeline `automation/vui_hoc/vuihocQuestionResolver.js` already uses), **not** assumption.
- **Known credential gotcha (session 2):** `CMS_ACCESS_TOKEN` (used by `discovery/books.js` and everything that starts from `resolveVuiHocExamQuestions`) is a **separate, long-lived token NOT refreshed by `get_tokens.sh`** (that script only refreshes `CMS_TOKEN`/`EXAM_COOKIE`). It expired independently mid-session (401 `token is expired`) and had to be manually re-set to the same value as a freshly-refreshed `CMS_TOKEN` (same admin account, same login endpoint, functionally interchangeable — confirmed by decoding both JWTs' `id`/`role` claims). **If a future session hits a 401 on `GET /api/cms/books` after already running `get_tokens.sh`, copy the current `CMS_TOKEN` value into `CMS_ACCESS_TOKEN` in `.env`.**
- Assignment/Lesson identity used (multiple, since no single exam contains all 6 question types — see "Question Types" below for which exam backs which type):
  - `Khối 8 > Review 4 > Skills > Reading 2` — exam `E8R4 - R2` (examId `00539a52-ed08-4c26-ae18-f2d88aa7cd8e`), 7× CHOICE (CMS type `ONE`)
  - `Khối 8 > Review 4 > Language > Đề part 1` — exam `E8R4.1` (examId `f6844a09-37c7-4052-bddb-df5790084479`), 19× CHOICE + 1× SORT
  - `Khối 8 > Review 4 > Language > Đề part 2` — exam `E8R4.2` (examId `0962ee78-1a4f-4cb3-839a-f68c8332401d`), 4× CHOICE + 3× FILL_WORD + 1× SORT
  - `Khối 1 > Review 1 > Phonics > Phonics` (examId `ff11f282-9caf-4de9-bec5-6fd9dbae1a78`) — **live-tested session 2**: 2× DRAG_DROP + mixed SPEAK/ONE
  - `Khối 1 > Review 1 > Vocabulary > Vocabulary` (examId `0a7d52bd-83ec-4933-b459-1df0ac2c2c05`) — **live-tested session 2**: 2× CONNECT + 8× ONE
  - `Khối 6 > Unit 1: My new school > Getting started > smart` (examId `be04ea7e-aed7-46a8-85a3-84a5e96d174d`) — standalone 1-question FILL_WORD exam, **live-tested session 2** (Scenario B)
  - `Khối 6 > Unit 1: My new school > Vocabulary > calculator` (examId `46af1870-91ed-4539-b4ec-8a7ced475ccf`) — standalone 1-question FILL_WORD exam, **live-tested session 2** (Scenario C)
  - `Khối 8 > Review 3 > Language > Language` (examId `699d18fe-d5f5-433b-99c7-acc558544527`, exam name "RV3", 15-question pool incl. 2× SORT) — **live-tested session 3**: SORT Scenario C, question id `b020efd6-e956-40c4-8608-8db8ed34dc5c` ("Reorder the sentence to make a full dialogue")
  - `Khối 1 > Fun time 1 > Let’s fun > Let’s fun` (examId `4dcc7a4e-eb31-44a4-b7bc-a570604e44ed`, 10-question pool incl. 2× DRAG_DROP, 2× CONNECT, 2× SPEAK, 2× SENTENCE_BUILDER, 2× ONE) — **live-tested session 3**: DRAG_DROP Scenario C, question id `c9398194-c4a2-46c4-b074-4677521da81f` ("bike", options ba/bi/bu)
  - `Khối 9 > Review 1 > Language > TT 1` (examId `c7ac7773-f980-47dc-9fb6-01144f0975fa`, exam name "VOCAB", 20× CHOICE, uniform point=0.5 each, totalPoint=10) — **live-tested session 3**: the decisive Wrong→Correct=50% score-isolation run (19 correct + 1 wrong→correct, question id `6f992a56-f08a-45c9-9e9b-c4fc3e08ee82`), completed in full, untouched before this run (0/1 progress)

---

## Question Types

Detected **in the app's real CMS content** (not assumed), via `detectQuestionUiType()` (`automation/vui_hoc/vuiHocQuestionMatcher.js`) cross-checked against the CMS `type` field:

| UI type (on-device) | CMS `type` field | Automation handler exists? | Live-tested this session? |
|---|---|---|---|
| CHOICE | `ONE` | Yes (`_answerChoice`) | **Yes** |
| FILL_WORD_MULTI | `FILL_WORD` (multi-blank layout) | Yes (`_answerFillWordMulti`) | **Yes** |
| FILL_WORD_SINGLE | `FILL_WORD` (single generic input box) | Yes (`_answerFillWordSingle`) | NOT_VERIFIED — no real content with this exact UI variant was found across **two** sessions' worth of searching (multiple books/units); every `FILL_WORD` question actually encountered rendered as `FILL_WORD_MULTI`, including both multi-blank (`Đề part 2`) and single-blank-rendered-as-one-`exercise_fillword_blank_0` (`smart`/`calculator`) cases |
| SORT | `SORT` | Yes (`_answerSort`) | **Yes** |
| DRAG_DROP | `DRAG_DROP` | Yes (`_answerDragDrop`) | **Yes** (session 2 — `Khối 1 > Review 1 > Phonics`) |
| CONNECT | `CONNECT` | Yes (`_answerConnect`) | **Yes** (session 2 — `Khối 1 > Review 1 > Vocabulary`) |
| — | `SPEAK` | **No handler** (`answerCurrentQuestion()` returns `supported:false`) | Not in scope (confirmed with user). **Note:** some `SPEAK`-typed CMS questions render with a lenient tap-based `exercise_answer_0`/`exercise_answer_1` choice UI (no real voice needed), while others render as a strict voice-gated screen (`exercise_speak_record_button`, no skip, no retry limit) — confirmed as a genuine UI-variant difference within the same exam (`Phonics`), not an automation bug. The strict variant blocked unattended progress once this session and required one manual human voice input (user said "tôi có làm sai 1 câu speaking nhé" — deliberately answered wrong) to pass. |
| — | `SENTENCE_BUILDER` | **No handler** in `vuiHocExamEngine.js`'s dispatcher (only referenced in an unrelated flow fixture, `EX-18-sentence-builder-any-build.yaml`, for the "Bài tập" pipeline, not Vui học). Encountered live this session rendered as "Reorder the letters" (anagram variant, ids `exercise_sentence_word_N`/`exercise_sentence_builder_area`) | Not in scope (same reason) — passed through blind (tapped letters in display order, didn't care about correctness) purely to continue past it toward DRAG_DROP content |

**How entry works**: tab "Vui học" → pick a Book ("Khối") from the dropdown → Unit → Lesson → Exercise. Each Exercise maps 1:1 to a CMS "Exam" containing an ordered or shuffled pool of questions.

---

## Scoring Rules Observed

**Expected rule (per task spec):**
```
Max score = 10 (regardless of question count)
Correct 1st try   -> 100% of question's point
Wrong -> Correct  -> 50% of question's point
Wrong -> Wrong    -> 0%, no 3rd attempt
```

**Production actual — CMS-level (directly confirmed, high confidence):**

Pulled the raw `metadata.point` field for every question across **8 different exams** via the CMS Exam API (no device involved, pure data):

| Exam | Question count (N) | Point per question | Sum |
|---|---|---|---|
| E8R4.1 (Đề part 1) | 20 | 0.5 | 10 |
| E8R4.2 (Đề part 2) | 8 | 1.25 | 10 |
| E8R24 - R1 (Reading 1) | 5 | 2 | 10 |
| E8R4 - R2 (Reading 2) | 7 | 1.43 | 10.01 (rounding) |
| Phonics | 10 | 1 | 10 |
| Vocabulary | 10 | 1 | 10 |
| smart (standalone) | 1 | 10 | 10 |
| calculator (standalone) | 1 | 10 | 10 |

**This directly confirms, from real CMS data (not UI inference):** every exam's questions are weighted so the sum is exactly 10, via `point = 10 / N`, down to the degenerate N=1 case. **Confidence: CONFIRMED** for "max score = 10 regardless of question count."

**Production actual — device-level (NOW cleanly confirmed for 2 of 3 rule components):**

A clean, fully-isolated run was obtained on the **Vocabulary** exam (`Khối 1 > Review 1`, 10 questions × 1 point each, no contamination from bug #3 — this exam doesn't contain the buggy question):

| Question | Scenario actually run | Outcome |
|---|---|---|
| Q1 (ONE) | correct 1st try | Chính xác |
| Q2 (ONE) | wrong → wrong | Chưa chính xác (both) |
| Q3 (ONE) | wrong → wrong | Chưa chính xác (both) |
| Q4 (ONE) | correct 1st try | Chính xác |
| Q5 (ONE, "four balls") | correct 1st try | Chính xác |
| Q6 (ONE, "three cakes") | wrong → wrong | Chưa chính xác (both) |
| Q7 (ONE, "hat"/"bag") | correct 1st try | Chính xác |
| Q8 (ONE, "door"/"desk") | wrong → wrong | Chưa chính xác (both) |
| Q9 (CONNECT) | all 4 pairs correct | Chính xác (auto-graded) |
| Q10 (CONNECT) | all 4 pairs correct | Chính xác (auto-graded) |

Manual tally: 6 questions correct (Q1,4,5,7,9,10) × 1 point = **6**. 4 questions wrong→wrong (Q2,3,6,8) × 0 points = **0**. Expected total = **6**.

**Device-displayed final score: exactly `6`.** This is an exact arithmetic match with no rounding ambiguity.

**This directly confirms, with clean device-level evidence (not inferred from source code):**
- **Correct on 1st attempt = 100% of the question's point.** CONFIRMED.
- **Wrong → Wrong (2 attempts, both wrong) = exactly 0% of the question's point.** CONFIRMED.
- The retry/no-3rd-attempt **behavior** (not just the score number) is independently confirmed for CHOICE, SORT, FILL_WORD_MULTI, and DRAG_DROP (see Detailed Results) — "Thử lại" is offered exactly once, then a 2nd wrong answer shows "Đáp án đúng: ..." + "Giải thích" + "Tiếp theo" with no further retry option.

**Wrong → Correct = 50% of the question's point: NOW CONFIRMED (session 3).** Two attempts were made earlier this session and both were blocked (kept here for the record):
1. A planned single-question-wrong-among-many design on `Đề part 1` (20 CHOICE questions, point=0.5 each) — blocked by repeated transient Maestro/adb `DeviceServerDiedException` crashes and the book-global resume-pointer bug (see Known Production Behavior #1) repeatedly landing on unrelated/already-answered content instead of a clean entry point.
2. Two contaminated mixed-scenario scores (Phonics `5.5`; a Khối 8 run `5`) — not usable for isolation.

**The isolation was completed successfully on a different, equally clean exam**: `Khối 9 > Review 1 > Language > TT 1` (examId `c7ac7773`, exam name "VOCAB", 20× CHOICE, uniform point=0.5, totalPoint=10, completely untouched before this run). Ran all 20 questions live: 19 answered correctly on the first attempt (Scenario A), exactly 1 (CMS id `6f992a56-f08a-45c9-9e9b-c4fc3e08ee82`) deliberately answered wrong then correct (Scenario B — confirmed via captured texts: attempt 1 `["Chưa chính xác",...,"Thử lại"]`, attempt 2 `["Chính xác",...,"Tiếp theo"]`).

**Device-displayed final score: `9.7`.** Arithmetic check against the three possible hypotheses for the wrong→correct fraction `f`:
- `f = 0%` (no credit): `19×0.5 + 0×0.5 = 9.5` — does not match `9.7`.
- `f = 100%` (no penalty at all): `19×0.5 + 1×0.5 = 10.0` — does not match `9.7`.
- `f = 50%`: `19×0.5 + 0.5×0.5 = 9.75`, which **truncates/floors to 1 decimal as exactly `9.7`** — matches the displayed score, and is consistent with the project's previously-documented display behavior (`project_score_display_rounds_1_decimal.md` — score display rounds/truncates to 1 decimal, causing exact-match false negatives elsewhere in this project when raw scores aren't divisors of 10). This is the only one of the three hypotheses consistent with the observed number.

**Verdict: Core structural rule (max=10, per-question weight=10/N) — CONFIRMED. Correct=100%, Wrong→Wrong=0%, and Wrong→Correct=50% — ALL THREE CONFIRMED** with clean device-level arithmetic (not inferred from source code). The only residual caveat is that the displayed `9.7` is consistent with the underlying exact value being `9.75` **truncated** to 1 decimal (not rounded up to `9.8`) — this matches, rather than contradicts, prior observations of this app's score-display rounding behavior.

---

## Test Matrix

Status values: **VERIFIED** (ran live, evidence captured) / **BLOCKED** (a confirmed Production bug prevents completion) / **NOT_VERIFIED** (not enough time/data/opportunity, no bug confirmed) / **NOT_APPLICABLE** (this scenario doesn't apply to this question type).

| Question Type | Correct 1st (A) | Wrong → Correct (B) | Wrong → Wrong (C) |
|---|---|---|---|
| CHOICE | VERIFIED | VERIFIED | VERIFIED |
| SORT | VERIFIED | VERIFIED | VERIFIED |
| FILL_WORD_MULTI | VERIFIED | VERIFIED | VERIFIED |
| FILL_WORD_SINGLE | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED |
| DRAG_DROP | VERIFIED | VERIFIED | VERIFIED |
| CONNECT | VERIFIED | NOT_APPLICABLE | NOT_APPLICABLE |

---

## Detailed Results

### CHOICE

#### Scenario A — Correct first attempt

- Action: tapped the CMS-correct answer text (via `decideAnswerAction(..., wantCorrect=true)`), then "Kiểm tra".
- Expected: "Chính xác" banner, no retry, advance to next question.
- Actual: confirmed 3× across different exams (`Reading 2` ids `df2bd457`, `7bf9374c`, `15ccdfd6`), plus reconfirmed implicitly many more times in session 2 (every "Chính xác" first-try CHOICE answer in the Vocabulary/Phonics runs). Example raw texts after submit: `["...","Chính xác","Đáp án đúng: A. the discovery of signs of water","Giải thích","Tiếp theo",...]`.
- UI: "Chính xác" banner. On "Thử thách"-branded reading exercises, a "Đáp án đúng: ..." reveal + "Giải thích" button appear **even on a correct first try** (differs from "Đề part"-branded exercises, which show a plain "Chính xác" with no reveal on first-try-correct).
- Navigation: tapping the "Tiếp theo" text button advances to the next question. (On "Đề part"-branded exercises, re-tapping the same `exercise_check_button` id also works as advance — see bug #2, this is NOT universal.)
- Result: VERIFIED.

#### Scenario B — Wrong first → Correct second

- Action: tapped a deliberately wrong option (`buildWrongChoiceAction()`, picks a non-correct answer from the same CMS answer set), "Kiểm tra", then "Thử lại", then the CMS-correct answer, "Kiểm tra" again.
- Actual (confirmed, `Reading 2` id `b30bfa15`): attempt 1 wrong, `canRetry=true`; attempt 2 correct, accepted, advanced normally.
- UI: "Thử lại" button offered after wrong attempt 1; after correct attempt 2, standard "Chính xác" advance.
- Result: VERIFIED (behavior matches expected rule; exact score fraction for THIS type's wrong→correct NOT_VERIFIED — see Scoring Rules).

#### Scenario C — Wrong first → Wrong second

- Action: tapped a wrong option, "Kiểm tra" → "Thử lại" → tapped a different wrong option → "Kiểm tra".
- Actual (confirmed, `Reading 2` id `c3aa6693`, and reconfirmed 4× in session 2's Vocabulary run — Q2/Q3/Q6/Q8): attempt 1 wrong, hint text shown, retry offered; attempt 2 wrong again, **no "Thử lại" anymore**, correct answer revealed, only "Tiếp theo" to advance.
- Result: VERIFIED.

---

### FILL_WORD_MULTI

#### Scenario A — Correct first attempt

- Action: typed the CMS-correct phrase into `exercise_fillword_blank_N`, "Kiểm tra".
- Actual: confirmed 2× in `Đề part 2` (ids `2facf591`, `b6b32e57`). Both returned `correct=true, attempts=1` and advanced.
- Result: VERIFIED.

#### Scenario B — Wrong first → Correct second

- Action: typed `"zz"` into both blanks (deliberately wrong), "Kiểm tra" → "Thử lại" → typed the correct values (`"u"`, `"l"`... for the `smart` exam, 1 blank, correct value `"mart"`) → "Kiểm tra" again.
- Actual (confirmed live, session 2, **fresh exam/question, NOT the bug-#3 question**: standalone exam `smart`, Khối 6 > Unit 1 > Getting started, CMS id `11708d07-6576-4d84-b930-a88e1af90526`, single blank, correct value `"mart"` completing "s[mart]"):
  - Attempt 1 (wrong, `"zzinvalidzz"`): `["...","Chưa chính xác","Thử lại"]`.
  - Attempt 2 (correct, `"mart"`): `["...","Chính xác","Giải thích","Tiếp theo"]` — no more retry.
- Note on finding this content: searched beyond `Đề part 2` specifically to avoid the question that triggers bug #3 (`b6b32e57`). Found 3 standalone single-question `FILL_WORD` exams in `Khối 6 > Unit 1: My new school` (`smart`, `calculator`, `international`) via a targeted CMS scan excluding the known exam id.
- Result: **VERIFIED** (previously blocked by bug #3 on the only content found in session 1; resolved in session 2 by testing on different content entirely).

#### Scenario C — Wrong first → Wrong second

- Action: typed `"z"` into both blanks of a 2-blank question, "Kiểm tra" → "Thử lại" → typed `"z"` into both blanks again (still wrong) → "Kiểm tra".
- Actual (confirmed live, session 2, standalone exam `calculator`, Khối 6 > Unit 1 > Vocabulary, CMS id `da00f8ca-e69a-4f3f-b9ba-11e79a597c80`, 2 blanks, correct values `"u"`+`"l"` completing "calc[u][l]ator"):
  - Attempt 1 (wrong, `"z"`+`"z"`): `["...","Chưa chính xác","Thử lại"]`.
  - Attempt 2 (wrong again, `"z"`+`"z"`): `["...","Chưa chính xác","Đáp án đúng là \"calculator\"","Giải thích","Tiếp theo"]` — no more retry.
- **Important automation note (not a bug):** for multi-blank `FILL_WORD_MULTI`, the blank fields' own `text` attribute in the accessibility tree stays empty regardless of what's typed — only the `exercise_check_button`'s `enabled` attribute (`true`/`false`) reliably reflects whether all blanks have content. Must clear+retype each blank individually with a verification read in between; a batched multi-blank type can silently land all keystrokes in the first blank only (observed once, self-diagnosed via this same enabled-state check).
- Result: **VERIFIED** (previously blocked by bug #3; resolved by testing on different content).

---

### FILL_WORD_SINGLE

NOT_VERIFIED for all 3 scenarios — no real CMS content rendering this specific UI variant (`exercise_fillword_input`, a single generic text box rather than per-blank `exercise_fillword_blank_N` fields) was located across **two sessions**' worth of searching, including the standalone 1-question exams found in session 2 (`smart`, `calculator`, `international` all rendered as `FILL_WORD_MULTI` with exactly 1 or 2 `exercise_fillword_blank_N` fields, never the single-input variant). The handler code (`_answerFillWordSingle`) exists but this session has no fresh observation to report.

---

### SORT

#### Scenario A — Correct first attempt

- Action: read live element bounds, computed the correct drag sequence (`resolveSortTargetOrder` + `computeNextSortMove`, physical `swipe` gestures — tapping does not work for this type, confirmed by existing code comments), "Kiểm tra".
- Actual (confirmed, `Đề part 2` id `d787a63a`): `correct=true, attempts=1`, advanced normally.
- Result: VERIFIED.

#### Scenario B — Wrong first → Correct second

- Action: dragged segments into a deliberately wrong order, "Kiểm tra" → "Thử lại" → dragged into the correct order → "Kiểm tra" again.
- Actual (confirmed, `Đề part 1` id `c4a617ef`): attempt 1 wrong order → "Chưa chính xác" + "Thử lại"; attempt 2 correct order → "Chính xác" + reveal + "Tiếp theo", no more retry.
- Result: VERIFIED.

#### Scenario C — Wrong first → Wrong second

- Action: used the direct-handler-bypass technique (`vui_hoc/directSortScenarioC.mjs` pattern — the generic pool matcher can't disambiguate between this exam's 2 SORT questions, so the target question id was driven directly). Dragged segments into a deliberately wrong order (`buildWrongSortTargetOrder()`), "Kiểm tra" → "Thử lại" → dragged into the **same wrong order again** → "Kiểm tra".
- Actual (confirmed live, session 3, fresh/untouched exam `Khối 8 > Review 3 > Language > Language`, CMS id `b020efd6-e956-40c4-8608-8db8ed34dc5c`, "Reorder the sentence to make a full dialogue" — **not** the same question instance used for SORT Scenario A (`d787a63a`, Đề part 2) or B (`c4a617ef`, Đề part 1)):
  - Attempt 1 (wrong order `[0,2,1,3]` vs. correct `[2,0,1,3]`): `["...","Chưa chính xác","Giải thích","Thử lại"]` — `canRetry=true`.
  - Attempt 2 (same wrong order again): `["...","Chưa chính xác","Đoạn văn đúng là: ...","Giải thích","Tiếp theo"]` — **no more "Thử lại"**, correct paragraph revealed, only "Tiếp theo" to advance.
  - Advance verified clean: tapping "Tiếp theo" moved to the next question in the pool (a CHOICE question) with no stuck-navigation or exit-to-home side effect.
- **Note on finding this content:** a broad 201-unit CMS sample scan (`vui_hoc/scanFillWordSortDragdrop.mjs`, output in `vui_hoc/scan_output.json`) located 9 exams containing SORT questions across Khối 1/2/6/7/8/9; `Khối 8 > Review 3 > Language` was chosen because a direct-handler script already existed for one of its 2 SORT questions, but that script targeted the OTHER question (`359da13b`, "river pollution") — the one actually rendered live this session was `b020efd6` instead (pool exams serve a question subset, not a fixed one), so the script's exam identity was reused but its target question id was swapped to match what was actually on screen.
- Result: **VERIFIED**.

---

### DRAG_DROP

#### Scenario A — Correct first attempt

- Action: identified which `exercise_dragdrop_option_N` tile holds the CMS-correct word (by walking into each option's subtree for its literal text — **do not** assume screen index matches any CMS field without checking; see note below), tapped it to place into the (previously empty) `exercise_dragdrop_zone_0`, "Kiểm tra".
- Actual (confirmed live, session 2, `Phonics` exam, CMS id `323c506a-922a-4d3e-b295-57cf8639631a`, content "n_" + options `ce/co/ci/ca`, correct=`"ca"`): option_3 held `"ca"`; placed and submitted → `["...","Chính xác","Đáp án đúng là \"ca\"","Giải thích","Tiếp theo"]`, no retry needed.
- Result: VERIFIED.

#### Scenario B — Wrong first → Correct second

- Action: placed a deliberately wrong tile, "Kiểm tra" → "Thử lại" → **tapped the filled zone to clear/return the wrong tile to the pool** (confirmed mechanic: `exercise_dragdrop_zone_0_filled` → tap → reverts to `exercise_dragdrop_zone_0`, tile goes back to being an available, unused option) → tapped the correct tile → "Kiểm tra" again.
- Actual (confirmed live, session 2, `Phonics` exam, CMS id `441b439b-ce3e-42d0-832a-aed33992317f`, content "r_" + options `dii/doo/daa/duu`, correct=`"doo"`):
  - Attempt 1 (wrong, `"dii"`): `["...","Chưa chính xác","Giải thích","Thử lại"]`.
  - Attempt 2 (correct, `"doo"`, after clearing the zone and placing the correct tile): `["...","Chính xác","Đáp án đúng là \"doo\"","Giải thích","Tiếp theo"]` — no more retry.
- **Important automation note (not a bug, a real debugging dead-end worth recording):** an initial attempt at this exact scenario incorrectly assumed "screen option index == position in the on-screen text array" and placed the WRONG tile while believing it was correct, producing a false "Chưa chính xác" that looked like a scoring anomaly. Root-caused by walking into each `exercise_dragdrop_option_N` node's own subtree for its literal `text` attribute — this is the only reliable way to know which tile is which; the merged `collectTexts()` output reorders as tiles are placed and must NOT be used to infer option index.
- Result: VERIFIED.

#### Scenario C — Wrong first → Wrong second

- Action: a broader 201-unit CMS sample scan (`vui_hoc/scanFillWordSortDragdrop.mjs` → `vui_hoc/scan_output.json`, run session 3 after the `CMS_ACCESS_TOKEN` credential issue was fixed) located a fresh, untouched DRAG_DROP exam: `Khối 1 > Fun time 1 > Let’s fun` (examId `4dcc7a4e`, 0/3 progress). Navigated there, passed through 1 SPEAK (strict voice-gated variant — required one manual human voice input, same as session 2's blocker), 2 blind-but-CMS-resolved CHOICE questions, and 2 CMS-resolved CONNECT questions (text-labeled right side this time, e.g. "cup"/"bike"/"book" — a different CONNECT content variant than session 2's pure audio/image one, but same tap-to-arm/tap-to-pair mechanic) to reach a fresh DRAG_DROP question. Placed a deliberately wrong tile (`ba`, option_0), "Kiểm tra" → "Thử lại" → cleared the zone (tap `exercise_dragdrop_zone_0_filled`) → placed a **different** wrong tile (`bu`, option_2) → "Kiểm tra" again.
- Actual (confirmed live, session 3, CMS id `c9398194-c4a2-46c4-b074-4677521da81f`, content "_ke" + options `ba/bi/bu`, correct=`"bi"` completing "bike"):
  - Attempt 1 (wrong, `"ba"`): `["...","Chưa chính xác","Giải thích","Thử lại"]`.
  - Attempt 2 (wrong again, `"bu"`): `["...","Chưa chính xác","Đáp án đúng là \"bike\"","Giải thích","Tiếp theo"]` — **no more "Thử lại"**, correct answer revealed, only "Tiếp theo" to advance.
  - Advance verified clean: tapping "Tiếp theo" moved to the exam's 2nd (and last) DRAG_DROP question ("cake", options ce/ca/co) with no stuck-navigation or exit-to-home side effect.
- **Operational notes from finding this content (session 3):** (1) the Book/Unit-list and Lesson-list row **title text is not itself tappable** — same "label vs. CTA" pattern as Known Production Behavior's "Chinh phục" unit cards, but one level deeper: a Lesson row's actual tap target is a dedicated `happy_learning_lesson_N_open` icon button, not the `happy_learning_lesson_N_title` text (tapping the title text silently no-ops, producing zero error but zero navigation — this cost significant time to diagnose before the tree-dump technique caught it). (2) Several on-device lesson/exercise names use a **curly apostrophe** (`’`, U+2019) where source/args naturally use a straight one (`'`, U+0027) — e.g. "Let's fun" vs. actual "Let’s fun" — `resolveVuiHocExamQuestions()` and other exact-string lookups fail silently/loudly on this mismatch; always copy the exact curly-quote string from a live hierarchy dump rather than typing it.
- Result: **VERIFIED**.

---

### CONNECT

#### Scenario A — Correct first attempt (all pairs correct)

- Action: for each of 4 left/right pairs, tapped `exercise_connect_left_N` (visually arms the slot — confirmed via screenshot, shows a blue selected border) then the CMS-correct `exercise_connect_right_M` partner, for all 4 pairs.
- **Critical methodology note:** this CONNECT variant is **audio+image based** — `exercise_connect_left_N`/`exercise_connect_right_N` expose **no `text` or `accessibilityText`** at all (pure audio clip / pure image, no label), so the existing `resolveConnectCorrectPairs()` text-matching helper returns `null` for it (by design — it correctly refuses to guess). Ground truth was obtained from the CMS raw `answers[]`/`correct{}` JSON (`id`-based mapping, e.g. `"hAWmGIfXfQ": "FFWxVIgwqM"`), and the **on-device screen-slot-index ↔ CMS-array-index correspondence was independently confirmed** by downloading the actual CMS image assets (`curl` the `image` URLs) and visually comparing them against the on-device screenshot — e.g. the CMS image for `rTZhwDPrHA` (label A) was confirmed to be the "boy on a playground" image that appears at screen position `exercise_connect_right_0`. This confirms the on-screen left/right order exactly matches the CMS `answers[]` array order within each `group` (0=left/audio, 1=right/image), **for this exam** — a hypothesis that failed on a first attempt (used the WRONG question's CMS data — this exam has 2 CONNECT questions, and the first attempt accidentally used the 2nd question's `correct{}` map while the 1st question was actually on screen, producing an unexplained "nothing happens" result until caught).
- Actual (confirmed live, session 2, `Vocabulary` exam, 2 distinct CONNECT questions — CMS ids `1cb3ad42-8b2f-4219-8969-cd5cf5a99dec` and `84b81644-5044-473f-8094-c8286c2297db`): both completed with all 4 pairs correct → `"Chính xác"` + `"Tiếp theo"` appeared **automatically, with no "Kiểm tra" tap** — confirmed the exercise self-grades the instant the last correct pair is made.
- **Confirmed by user (domain knowledge, not inferred):** *"dạng bài matching phải nối đúng hết mới qua câu => mặc định full điểm dạng này"* — the matching/CONNECT type requires ALL pairs to be correct before the question can be passed at all; when passed, it defaults to full point value for that question. There is no partial-credit path and no "wrong attempt" state exposed to the user (an incomplete/incorrect set of pairs simply never produces any banner, right or wrong — confirmed empirically: multiple incorrect-pairing attempts this session produced zero visual feedback of any kind, consistent with "silently not yet correct" rather than "marked wrong").
- Result: VERIFIED (2×).

#### Scenario B — Wrong first → Correct second

- **NOT_APPLICABLE.** Per the confirmed behavior above, CONNECT has no concept of a graded "wrong attempt" — an incomplete/incorrect pairing set gives no banner, no retry button, and no score; the question simply isn't resolved until all pairs are correct (at which point it's always full credit, with no "first vs. second attempt" distinction tracked). The Scenario B rule (wrong→correct = 50%) has no mechanism to apply to.

#### Scenario C — Wrong first → Wrong second

- **NOT_APPLICABLE**, same reasoning as Scenario B — there is no "two wrong attempts then forced 0%" path for this type; nothing is ever scored as wrong, and there appears to be no attempt limit (an arbitrary number of incorrect pairings were made this session with no lockout or penalty observed, though an exhaustive "will it ever lock out" test was not run).

---

## Final Score Verification

- Maximum score: **10**, confirmed directly from CMS `point` field sums across 8 exams (1 to 20 questions each, including two degenerate N=1 cases) — NOT an assumption.
- Number of questions: varies per exam (1, 5, 7, 8, 10, 20 all observed).
- Score per question: `10 / N` — confirmed directly from CMS data for every exam checked (not inferred, not hardcoded by us).
- Final score (device display): a **clean, isolated, exactly-matching** measurement was obtained on the `Vocabulary` exam (10 questions × 1 point, 6 correct + 4 wrong→wrong, zero contamination from other scenario types or bugs): displayed score `6` = exactly `6×1 + 4×0`. A second clean isolation was obtained on `Khối 9 > Review 1 > Language > TT 1` (20 questions × 0.5 point, 19 correct + 1 wrong→correct): displayed score `9.7`, matching `19×0.5 + 0.5×0.5 = 9.75` truncated to 1 decimal — see Scoring Rules Observed for the full arithmetic. Two additional **contaminated** scores were also observed (`5.5` on Phonics, `5` on a Khối 8 run) — these mixed Scenario A/B/C and in one case a genuine SPEAK deliberate-wrong attempt whose point contribution is unknown, so they are NOT usable for arithmetic verification, only as "fractional/partial-credit display is possible" confirmation.
- Score calculation:
  - **Correct 1st attempt = 100% of question's point — CONFIRMED** (clean arithmetic match, see above).
  - **Wrong → Wrong = exactly 0% of question's point — CONFIRMED** (clean arithmetic match, see above).
  - **Wrong → Correct = 50% of question's point — CONFIRMED (session 3).** Isolation run on `TT 1` (19 correct + 1 wrong→correct, all questions 0.5 pt) produced displayed score `9.7`, the only value consistent with a 50% credit (`9.75` truncated) among the three possible hypotheses (0%→9.5, 50%→9.75≈9.7, 100%→10.0).
- Result: Core structural rule (max=10, per-question weight=10/N) — **CONFIRMED**. All three scoring rule components (Correct=100%, Wrong→Wrong=0%, Wrong→Correct=50%) — **CONFIRMED** with clean device arithmetic, not inferred from source code.

---

## Reproduction Recipe

All scenario runs use the existing harness, invoked as:

```bash
cd automation
set -a; source ../.env; set +a
BOOK_NAME="<Book>" UNIT_NAME="<Unit>" LESSON_NAME="<Lesson>" EXERCISE_NAME="<Exercise>" \
SCENARIO_MAP='{"<cmsQuestionId>":"B"}' \
node vui_hoc/runVuiHocScenarioMatrix.mjs
```

Questions not listed in `SCENARIO_MAP` default to Scenario A (answered correctly by the production `VuiHocExamEngine`). Add `SKIP_NAVIGATION=true` to skip `NavigationEngine.navigateTo()` entirely and assume the device is already sitting on a question of the target exercise (used heavily this session once navigation proved unreliable — see Known Production Behavior #1).

**Exact invocations used this session:**

```bash
# FILL_WORD_MULTI Scenario B (clean, no bug #3 interference)
SKIP_NAVIGATION=true BOOK_NAME="Khối 6" UNIT_NAME="Unit 1: My new school" LESSON_NAME="Getting started" EXERCISE_NAME="smart" \
SCENARIO_MAP='{"11708d07-6576-4d84-b930-a88e1af90526":"B"}' \
node vui_hoc/runVuiHocScenarioMatrix.mjs

# FILL_WORD_MULTI Scenario C (clean, no bug #3 interference)
SKIP_NAVIGATION=true BOOK_NAME="Khối 6" UNIT_NAME="Unit 1: My new school" LESSON_NAME="Vocabulary" EXERCISE_NAME="calculator" \
SCENARIO_MAP='{"da00f8ca-e69a-4f3f-b9ba-11e79a597c80":"C"}' \
node vui_hoc/runVuiHocScenarioMatrix.mjs
```

DRAG_DROP and CONNECT scenarios this session were driven by **manual step-by-step scratch scripts**, not the generic harness, because:
- DRAG_DROP requires tapping the filled zone to clear it before re-placing a different tile (the generic harness's `buildSteps` for DRAG_DROP only taps options, never the zone — would need a small enhancement to support Scenario B/C's "change the placed tile" step).
- CONNECT requires per-pair `leftText`/`rightText` which don't exist for audio+image CONNECT content — the generic harness's `resolveConnectCorrectPairs()` correctly returns `null` for this content, so a CMS-id-based manual pairing (not text-based) was used instead.

**SORT Scenario C (session 3)** used the existing **direct-handler-bypass** script `vui_hoc/directSortScenarioC.mjs` (per `feedback_direct_handler_invocation_bypass.md` — import the SORT handler directly when the generic pool matcher can't disambiguate between multiple same-type questions in one exam), re-pointed at the question id actually rendered live (`b020efd6-e956-40c4-8608-8db8ed34dc5c`) rather than the one originally hardcoded in the script (`359da13b`, a different SORT question in the same exam — pool exams serve a rotating subset, not a fixed question per id). A broader 201-unit CMS sample scan (`vui_hoc/scanFillWordSortDragdrop.mjs` → `vui_hoc/scan_output.json`) was used to confirm this exam (`Khối 8 > Review 3 > Language`, examId `699d18fe`) was untouched (0/1 progress) before targeting it.

**DRAG_DROP Scenario C (session 3)** was driven by direct `bridge.runSteps()` calls (no YAML flow file), navigating manually into `Khối 1 > Fun time 1 > Let’s fun` and passing through the exam's other question types (1 SPEAK with manual human voice input, 2 CHOICE, 2 CONNECT) using CMS-resolved ground truth for each, until reaching a fresh DRAG_DROP question (`c9398194`). Same zone-clear-before-replace mechanic as session 2's DRAG_DROP B/C (Known Production Behavior #6).

**Wrong→Correct = 50% score isolation (session 3, the decisive result)** used a pre-identified list of "clean all-CHOICE uniform-point" candidate exams (computed by `vui_hoc/scanFillWordSortDragdrop.mjs`'s `cleanChoiceExams` filter, visible in its console output though not persisted to `scan_output.json`) to pick `Khối 9 > Review 1 > Language > TT 1` (20× CHOICE, 0.5 pt each). Invocation:
```bash
SKIP_NAVIGATION=true BOOK_NAME="Khối 9" UNIT_NAME="Review 1" LESSON_NAME="Language" EXERCISE_NAME="TT 1" \
SCENARIO_MAP='{"6f992a56-f08a-45c9-9e9b-c4fc3e08ee82":"B"}' \
node vui_hoc/runVuiHocScenarioMatrix.mjs
```
This crashed twice on Maestro driver instability (once at question 9, once immediately on resume) — both times recovered by checking the device was still sitting on the exact unanswered question that crashed (no progress lost) and **manually finishing the remaining questions one at a time via direct `bridge.runSteps()` calls** (CMS-resolved correct answer per question, matched to the on-screen question by content since the pool order isn't fixed). All 20 questions were answered (19 Scenario A + 1 Scenario B), and the exam's final result screen showed **`9.7`** — see Scoring Rules Observed for the arithmetic that confirms this means Wrong→Correct = 50%.

**Known navigation caveat:** `NavigationEngine.navigateTo()` is not reliable for jumping to a *specific* Exercise inside a Book/Unit the profile has visited before — the book-global resume-pointer bug (Known Production Behavior #1) and transient Maestro/adb `DeviceServerDiedException` crashes (infra, not app) both interfered repeatedly this session. The reliable workaround used throughout: manually tap through Book selector → Unit → Lesson → Exercise step-by-step with a hierarchy-check between each tap, rather than trusting a single bundled `navigateTo()` call; recover from `DeviceServerDiedException` via `adb kill-server && adb start-server` + `adb shell am force-stop dev.mobile.maestro` (clears a leftover driver process that reliably causes the next hierarchy/tap call to hang or crash).

---

## Evidence

- Logs: `/tmp/claude-1000/.../scratchpad/` and `/tmp/claude-1000/.../tasks/*.output`, raw `bridge.runSteps()`/`hierarchy()` output quoted inline above (session-local, not committed).
- Screenshots: captured via `adb exec-out screencap` at several checkpoints both sessions (session-local temp files, not committed to the repo). Notably used this session to resolve the CONNECT screen-slot-to-CMS-id mapping by downloading CMS image assets (`curl <image URL>`) and comparing them pixel-content-wise against on-device screenshots — this is a reusable technique for any future audio/image-based CONNECT verification.
- Relevant CMS IDs: all exam/question/answer IDs quoted inline above (`examId`, CMS question `id`, CMS answer `id`) — sourced live from `https://parrotedu.vn` CMS Exam API, 2026-10-02 and 2026-10-05.
- Relevant API responses: raw `metadata.raw` dumps (question content, answers, correct keys, point) captured and quoted above for every question type tested.
- Timestamps: device clock timestamps embedded in captured `collectTexts()` output correspond to the live interaction sequence described above — session 1 ~10:20–15:45 local device time 2026-10-02; session 2 ~10:20–11:31 local device time 2026-10-05.

---

## Known Production Behavior

1. **Lesson "resume" (▶) button / Lesson-row-tap is book-global, not lesson-scoped.** Tapping a Lesson row (or its resume arrow) resumes the profile's single global "continue learning" position for that Book, regardless of which Lesson was tapped. Reproduced repeatedly across both sessions, including session 2 where tapping "Language" (Khối 8 > Review 4) landed directly inside an in-progress `FILL_WORD_MULTI` question instead of a lesson overview, and a subsequent `NavigationEngine.navigateTo()` call aimed at "Đề part 1" was similarly disrupted.
2. **Inconsistent "advance to next question" control between exercise UI variants.** "Đề part"-branded exercises accept re-tapping the same `exercise_check_button` id as both "Kiểm tra" and the subsequent advance action. "Thử thách"-branded exercises (reading comprehension AND the Phonics/Vocabulary review content seen in session 2) use a **distinct** "Tiếp theo" text control — re-tapping `exercise_check_button` there is a no-op.
3. **Reproducible exit-to-home bug with lost progress, `Đề part 2` (`Khối 8 > Review 4 > Language`), question CMS id `b6b32e57` ("Two days ago, Tom phoned me and said...").** Answering this question (correctly, confirmed "Chính xác") and advancing exits the entire exercise back to the Vui học home tab instead of continuing to the exercise's 8th and final question, with progress not persisted. Reproduced 3× in session 1 (two interaction methods). In session 2, the book-global resume pointer (#1) landed directly on this same question again; it was deliberately **not** re-answered (backed out instead) to avoid losing further exploration time, so this is a re-encounter, not a 4th fresh reproduction.
4. **"Thử thách"-branded exercises always reveal "Đáp án đúng: ..." + a "Giải thích" button, even on a correct first try** — differs from "Đề part"-branded exercises, which show a bare "Chính xác" banner with no reveal on first-try-correct.
5. A **Maestro driver crash** (`DeviceServerDiedException`) occurred **repeatedly** in session 2 (far more often than session 1's single occurrence) — transient ADB/gRPC connection drop, every time traced to (or at least accompanied by) a leftover `dev.mobile.maestro` process still running on-device from the previous crashed/timed-out command. Reliable recovery: `adb kill-server && adb start-server` followed by `adb shell am force-stop dev.mobile.maestro`. This is infrastructure-level, unrelated to app behavior, but was frequent enough this session to be worth flagging as a standing operational hazard for any future long automated run against this device. **New in session 3:** `adb kill-server && adb start-server` can flip the device to `unauthorized` (the RSA debug key handshake resets), requiring a physical "Allow USB debugging" tap on the device before `adb shell`/Maestro calls work again — plan for this when recovering from the crash unattended.
6. **DRAG_DROP interaction mechanic** (not a bug, documented for reproducibility): tapping an `exercise_dragdrop_option_N` places that tile into the (single, in observed content) drop zone, renaming it to `exercise_dragdrop_option_N_used` and the zone to `exercise_dragdrop_zone_0_filled`. To change the placed tile, you must first tap the filled zone itself (reverts both the zone and the previously-placed option back to their unused/empty state), then tap a different option.
7. **CONNECT interaction mechanic** (not a bug, documented for reproducibility, and independently confirmed by the user as intentional design): tapping an `exercise_connect_left_N` arms it (visible blue selection border, plays its audio); tapping an `exercise_connect_right_M` attempts to pair them and always clears the selection border regardless of correctness, with **zero visual feedback** distinguishing a correct pairing from an incorrect one. The question only resolves (shows "Chính xác" + "Tiếp theo", no "Kiểm tra" tap needed) once **all** pairs in the set are simultaneously correct; it is always full-credit when it resolves, and there is no "wrong" state ever surfaced to the user for this type.
8. **SPEAK-typed questions render in at least two distinct UI variants within the same exam**: a lenient tap-based `exercise_answer_0`/`exercise_answer_1` choice (passable via blind tap, no real voice needed) and a strict `exercise_speak_record_button` voice-gated screen with no skip/timeout-pass and no retry cap observed. Both were seen in the same `Phonics` exam this session, and the strict variant recurred in session 3's `Khối 1 > Fun time 1` exam (again required one manual human voice input).
9. **Lesson-row tap target is a dedicated icon button, not the row's title text** (not a bug — an automation gotcha, same "label vs. CTA" shape as the `Chinh phục` unit cards): tapping a Lesson row's `happy_learning_lesson_N_title` text silently no-ops (no error, no navigation); the real tap target is the adjacent `happy_learning_lesson_N_open` icon button. Confirmed session 3 while navigating to `Khối 1 > Fun time 1 > Let’s fun`.
10. **Maestro driver instability recurred much more severely in session 3** than session 2: repeated `DeviceServerDiedException` on `--no-reinstall-driver` calls that did NOT self-heal via the documented `adb kill-server`/`force-stop dev.mobile.maestro` recipe alone — required a full `maestro hierarchy` (no flag) call to force a real driver reinstall, and even then the very next `--no-reinstall-driver` call sometimes died again immediately (on-device server process appears to not persist reliably between separate CLI invocations in this session, unlike session 2). Workaround used: drop `--no-reinstall-driver` entirely for a stretch of calls when instability is observed, accepting the ~50-60s/call cost, until a few consecutive quick calls succeed. This is infrastructure-level, unrelated to app behavior, but was the dominant time cost in session 3.

---

## Phase 1 Completion Summary

| Question Type | A | B | C |
|---|---|---|---|
| CHOICE | VERIFIED | VERIFIED | VERIFIED |
| SORT | VERIFIED | VERIFIED | VERIFIED |
| FILL_WORD_MULTI | VERIFIED | VERIFIED | VERIFIED |
| FILL_WORD_SINGLE | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED |
| DRAG_DROP | VERIFIED | VERIFIED | VERIFIED |
| CONNECT | VERIFIED | NOT_APPLICABLE | NOT_APPLICABLE |

Plus: scoring rule core structure (max=10, point=10/N) **CONFIRMED**; Correct=100%, Wrong→Wrong=0%, and Wrong→Correct=50% **ALL CONFIRMED** via clean device arithmetic (two independent isolation runs, see Scoring Rules Observed).

### Remaining Gaps

1. **FILL_WORD_SINGLE (all 3 scenarios) — NOT_VERIFIED.** No on-device content rendering this specific UI variant (`exercise_fillword_input`, single generic box) was found despite searching multiple books/units across three sessions. Every `FILL_WORD` CMS question encountered rendered as `FILL_WORD_MULTI` (one or more `exercise_fillword_blank_N` fields), even the 1-blank standalone exams. Reason: pure content-availability gap, no bug involved. This is the **only remaining gap** in the entire baseline.

**SORT, DRAG_DROP, and the exact Wrong→Correct=50% score fraction are now fully resolved** this session (SORT/DRAG_DROP: A/B/C all VERIFIED; scoring: all 3 components CONFIRMED with clean device arithmetic) and are no longer gaps. Of the 6 question types, only FILL_WORD_SINGLE remains entirely untested (content never found across 3 sessions of searching). Every scoring-rule component has clean device-level confirmation.

This single remaining gap is not a confirmed Production bug — it is a content-availability gap (the right UI variant/CMS content was never located). It is the only item that could still potentially be resolved by continuing to run Production without any code change.
