# Self-learning Answering Baseline

## Environment

- Environment: **Production** (Environment A)
- App package: `com.inet.parrotedu`
- Build: versionName `1.0.12`, versionCode `21` (confirmed via `adb shell dumpsys package`, unchanged for the entire session — `firstInstallTime`/`lastUpdateTime` = 2026-09-21 17:31:26)
- Date: 2026-10-02
- Device: physical Android, serial `3201d866d40a1681` (SM_M205G)
- Test account/profile: phone account with profile **"Ngoc"** (Pro), active class **Khối 9** (profile not switched — only the in-app "Vui học" book selector was changed, per standing project convention of never switching the active profile to chase a test target)
- Automation: `automation/vui_hoc/` (engine) + two new files written for this task:
  - `automation/vui_hoc/vuiHocWrongAnswers.js` — deliberate-wrong-answer builders (new, pure functions, no production code changed)
  - `automation/vui_hoc/runVuiHocScenarioMatrix.mjs` — scenario-matrix runner (new)
- Ground truth for "correct answer" on every scenario below comes from the CMS Exam API (same pipeline `automation/vui_hoc/vuihocQuestionResolver.js` already uses), **not** assumption.
- Assignment/Lesson identity used (multiple, since no single exam contains all 6 question types — see "Question Types" below for which exam backs which type):
  - `Khối 8 > Review 4 > Skills > Reading 2` — exam `E8R4 - R2` (examId `00539a52-ed08-4c26-ae18-f2d88aa7cd8e`), 7× CHOICE (CMS type `ONE`)
  - `Khối 8 > Review 4 > Language > Đề part 1` — exam `E8R4.1` (examId `f6844a09-37c7-4052-bddb-df5790084479`), 19× CHOICE + 1× SORT
  - `Khối 8 > Review 4 > Language > Đề part 2` — exam `E8R4.2` (examId `0962ee78-1a4f-4cb3-839a-f68c8332401d`), 4× CHOICE + 3× FILL_WORD + 1× SORT
  - `Khối 1 > Review 1 > Phonics` (examId `ff11f282-9caf-4de9-bec5-6fd9dbae1a78`) and `Khối 1 > Review 1 > Vocabulary` (examId `0a7d52bd-83ec-4933-b459-1df0ac2c2c05`) — **identified via CMS API only** (contain DRAG_DROP and CONNECT respectively with full ground truth), **not live-tested on device** — see gaps below.

---

## Question Types

Detected **in the app's real CMS content** (not assumed), via `detectQuestionUiType()` (`automation/vui_hoc/vuiHocQuestionMatcher.js`) cross-checked against the CMS `type` field:

| UI type (on-device) | CMS `type` field | Automation handler exists? | Live-tested this session? |
|---|---|---|---|
| CHOICE | `ONE` | Yes (`_answerChoice`) | **Yes** |
| FILL_WORD_MULTI | `FILL_WORD` (multi-blank layout) | Yes (`_answerFillWordMulti`) | **Yes** |
| FILL_WORD_SINGLE | `FILL_WORD` (single generic input box) | Yes (`_answerFillWordSingle`) | NOT_VERIFIED — no real content with this exact UI variant was found within the session's time budget; every `FILL_WORD` question actually encountered rendered as `FILL_WORD_MULTI` |
| SORT | `SORT` | Yes (`_answerSort`) | **Yes** |
| DRAG_DROP | `DRAG_DROP` | Yes (`_answerDragDrop`) | NOT_VERIFIED — ground truth resolved via CMS (`Khối 1 > Review 1 > Phonics`), device verification not reached (time budget) |
| CONNECT | `CONNECT` | Yes (`_answerConnect`) | NOT_VERIFIED — ground truth resolved via CMS (`Khối 1 > Review 1 > Vocabulary`), device verification not reached (time budget) |
| — | `SPEAK` | **No handler** (`answerCurrentQuestion()` returns `supported:false`) | Not in scope (confirmed with user — automation can't drive this type at all) |
| — | `SENTENCE_BUILDER` | **No handler** in `vuiHocExamEngine.js`'s dispatcher (only referenced in an unrelated flow fixture, `EX-18-sentence-builder-any-build.yaml`, for the "Bài tập" pipeline, not Vui học) | Not in scope (same reason) |

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

Pulled the raw `metadata.point` field for every question across **6 different exams** via the CMS Exam API (no device involved, pure data):

| Exam | Question count (N) | Point per question | Sum |
|---|---|---|---|
| E8R4.1 (Đề part 1) | 20 | 0.5 | 10 |
| E8R4.2 (Đề part 2) | 8 | 1.25 | 10 |
| E8R24 - R1 (Reading 1) | 5 | 2 | 10 |
| E8R4 - R2 (Reading 2) | 7 | 1.43 | 10.01 (rounding) |
| Phonics | 10 | 1 | 10 |
| Vocabulary | 10 | 1 | 10 |

**This directly confirms, from real CMS data (not UI inference):** every exam's questions are weighted so the sum is exactly 10, via `point = 10 / N`. This is **not** a hardcoded assumption on our part — it's the literal stored value in the CMS question record for every exam checked. **Confidence: PASS / CONFIRMED** for "max score = 10 regardless of question count."

**Production actual — device-level (partially verified):**

- Final score display showed **"5"** (integer) on one run and **"5.5"** (one decimal) on another run — confirms the displayed score **can** show fractional values, which is consistent with partial credit existing, but these two runs were contaminated (see "Known Production Behavior" below) and **cannot** be used to pin down the exact 50% fraction for "wrong → correct."
- A clean, fully-controlled run (all-correct baseline vs. one-question-wrong→correct vs. one-question-wrong→wrong, same exam) was attempted on `Đề part 2` but could not be completed — see bug #3 below. **The exact per-question point deduction for Scenario B (50%?) and the exact final-score arithmetic are NOT_VERIFIED on-device within this session.**
- The retry/no-3rd-attempt **behavior** itself (not the score number) IS fully confirmed for CHOICE and SORT (see Detailed Results) — "Thử lại" is offered exactly once, then a 2nd wrong answer shows "Đáp án đúng: ..." + "Giải thích" + "Tiếp theo" with no further retry option.

---

## Test Matrix

| Question Type | Correct 1st | Wrong → Correct | Wrong → Wrong |
|---|---|---|---|
| CHOICE | PASS | PASS | PASS |
| FILL_WORD_MULTI | PASS | NOT_VERIFIED | NOT_VERIFIED |
| FILL_WORD_SINGLE | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED |
| SORT | PASS | PASS | NOT_VERIFIED |
| DRAG_DROP | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED |
| CONNECT | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED |

---

## Detailed Results

### CHOICE

#### Scenario A — Correct first attempt

- Action: tapped the CMS-correct answer text (via `decideAnswerAction(..., wantCorrect=true)`), then "Kiểm tra".
- Expected: "Chính xác" banner, no retry, advance to next question.
- Actual: confirmed 3× across different exams (`Reading 2` ids `df2bd457`, `7bf9374c`, `15ccdfd6`). Example raw texts after submit: `["...","Chính xác","Đáp án đúng: A. the discovery of signs of water","Giải thích","Tiếp theo",...]`.
- Score: not isolated per-question (see Scoring Rules).
- UI: "Chính xác" banner. On "Thử thách"-branded reading exercises, a "Đáp án đúng: ..." reveal + "Giải thích" button appear **even on a correct first try** (differs from "Đề part"-branded exercises, which show a plain "Chính xác" with no reveal on first-try-correct).
- Navigation: tapping the "Tiếp theo" text button advances to the next question. (On "Đề part"-branded exercises, re-tapping the same `exercise_check_button` id also works as advance — see bug #2, this is NOT universal.)
- Result: PASS.

#### Scenario B — Wrong first → Correct second

- Action: tapped a deliberately wrong option (`buildWrongChoiceAction()`, picks a non-correct answer from the same CMS answer set), "Kiểm tra", then "Thử lại", then the CMS-correct answer, "Kiểm tra" again.
- Expected: wrong banner + retry offered; correct banner + no more retry; final score = 50% of question's point.
- Actual (confirmed, `Reading 2` id `b30bfa15`, "Why must scientists study Mars carefully before sending people there?"):
  - Attempt 1: `success=true`, no explicit texts captured mid-run (handled by the scenario-matrix script), engine reported `canRetry=true`.
  - Attempt 2 (correct): accepted, advanced normally.
- Score of this specific question: NOT_VERIFIED in isolation (see Scoring Rules — no clean diff run completed).
- UI: "Thử lại" button offered after wrong attempt 1; after correct attempt 2, standard "Chính xác" advance.
- Navigation: normal, advanced to next question both times.
- Result: PASS (behavior matches expected rule; exact score fraction NOT_VERIFIED).

#### Scenario C — Wrong first → Wrong second

- Action: tapped "It is useless." (wrong), "Kiểm tra" → "Thử lại" → tapped "It is too dangerous to study." (wrong again) → "Kiểm tra".
- Actual (confirmed, `Reading 2` id `c3aa6693`, "What does the writer think about exploring Mars?"):
  - Attempt 1 (wrong): `["...","Chưa chính xác","Con chú ý","ý kiến của tác giả ở đoạn 3",".","Giải thích","Thử lại",...]` — hint text shown, retry offered.
  - Attempt 2 (wrong again): `["...","Chưa chính xác","Đáp án đúng: B. It can help scientists learn more about space and life.","Giải thích","Tiếp theo",...]` — **no "Thử lại" anymore**, correct answer revealed, only "Tiếp theo" to advance.
- Score: question's final contribution NOT isolated numerically (see Scoring Rules), but the **behavior** ("exactly 2 attempts, no 3rd, reveal answer on exhaustion") is directly confirmed.
- Button/action: "Thử lại" present after attempt 1, **absent** after attempt 2 (replaced by "Tiếp theo").
- Navigation: tapping "Tiếp theo" advances past the exhausted question normally.
- Result: PASS.

---

### FILL_WORD_MULTI

#### Scenario A — Correct first attempt

- Action: typed the CMS-correct phrase into `exercise_fillword_blank_0`, "Kiểm tra".
- Actual: confirmed 2× in `Đề part 2` (ids `2facf591` "Mars is uninhabitable...", `b6b32e57` "Two days ago, Tom phoned..."). Both returned `correct=true, attempts=1` and advanced.
- Result: PASS.

#### Scenario B — Wrong first → Correct second

- NOT_VERIFIED. The wrong-answer builder (`buildWrongFillWordValues` — types a fixed nonsense string) is implemented and ready, but every FILL_WORD question this session either completed cleanly on the first try (not useful for B/C) or was the one question hit by bug #3 below, which made the exercise un-progressable before a controlled B/C attempt could be run on this type.

#### Scenario C — Wrong first → Wrong second

- NOT_VERIFIED, same reason as Scenario B.

---

### FILL_WORD_SINGLE

NOT_VERIFIED for all 3 scenarios — no real CMS content rendering this specific UI variant (`exercise_fillword_input`, a single generic text box rather than per-blank `exercise_fillword_blank_N` fields) was located within the session's time budget. The handler code (`_answerFillWordSingle`) exists and is presumably exercised elsewhere in the repo's history, but this session has no fresh observation to report.

---

### SORT

#### Scenario A — Correct first attempt

- Action: read live element bounds, computed the correct drag sequence (`resolveSortTargetOrder` + `computeNextSortMove`, physical `swipe` gestures — tapping does not work for this type, confirmed by existing code comments), "Kiểm tra".
- Actual (confirmed, `Đề part 2` id `d787a63a`, "Reorder the sentences to make a meaningful paragraph"): `correct=true, attempts=1`, advanced normally. Took 94.2s (drag-based interaction is inherently slower than tap-based types).
- Result: PASS.

#### Scenario B — Wrong first → Correct second

- Action: dragged segments into a deliberately wrong order (`buildWrongSortTargetOrder` — swaps the first two target slots), "Kiểm tra" → "Thử lại" → dragged into the correct order → "Kiểm tra" again.
- Actual (confirmed, `Đề part 1` id `c4a617ef`, "Reorder the sentences to make a meaningful conversation"):
  - Attempt 1 (wrong order): `["...","Chưa chính xác","Giải thích","Thử lại",...]`.
  - Attempt 2 (correct order, after "Thử lại"): `["...","Chính xác","Đáp án đúng: \nMinh: Guess what!...\nQuang: That's great!...\nMinh: It was the Future...","Giải thích","Tiếp theo",...]`.
- Note: `collectTexts()` reads the accessibility tree in **DOM/traversal order**, which does **not** necessarily match the visual top-to-bottom order for draggable SORT rows (confirmed limitation, documented in `vuiHocSortHandler.js`) — the banner result is the reliable signal, not the apparent text order.
- Result: PASS.

#### Scenario C — Wrong first → Wrong second

- NOT_VERIFIED. Only 2 SORT question instances were encountered this session (one per exam found); both were consumed by Scenario A and B respectively. No 3rd SORT instance was reached to test Scenario C.

---

### DRAG_DROP

NOT_VERIFIED for all 3 scenarios. CMS ground truth **is** confirmed to exist and to be resolvable (`Khối 1 > Review 1 > Phonics`, CMS id `323c506a` — 1-blank question, `answers=["ce","co","ci","ca"]`, `correct=["ca"]`, confirming a real distractor bank exists for building a guaranteed-wrong attempt). The wrong-answer builder (`buildWrongDragDropValues`) is implemented and handles both the "≥2 zones → swap order" case and the "1 zone → pick a real CMS distractor" case. Device verification was not reached within the session's time budget (most of the session's device time went to navigation/resume-pointer issues on the Khối 8 content — see Known Production Behavior).

### CONNECT

NOT_VERIFIED for all 3 scenarios, same reason as DRAG_DROP. CMS ground truth confirmed (`Khối 1 > Review 1 > Vocabulary`, CMS id `1cb3ad42` — 4 pairs, full `answers[]`/`correct{}` resolved). The wrong-answer builder (`buildWrongConnectPairs`, rotates right-side matches among pairs) is implemented.

---

## Final Score Verification

- Maximum score: **10**, confirmed directly from CMS `point` field sums across 6 exams (5 to 20 questions each) — NOT an assumption.
- Number of questions: varies per exam (5, 7, 8, 10, 20 all observed).
- Score per question: `10 / N` — confirmed directly from CMS data for every exam checked (not inferred, not hardcoded by us).
- Final score (device display): observed values "5" and "5.5" on two different (contaminated, non-isolated) runs — confirms fractional display is possible, consistent with partial credit, but **not** a clean measurement.
- Score calculation (exact per-attempt-outcome formula, e.g., is wrong→correct really exactly 50%?): **NOT_VERIFIED**. A controlled 3-way comparison (all-correct vs. one-wrong-correct vs. one-wrong-wrong, same exam) was attempted on `Đề part 2` but blocked by bug #3 (exercise exits to home before reaching the final question, every time, at the same specific question).
- Result: Core structural rule (max=10, per-question weight=10/N) — **CONFIRMED**. Exact retry-penalty arithmetic — **NOT_VERIFIED**, flagged for follow-up.

---

## Evidence

- Logs: `/tmp/claude-1000/.../scratchpad/run*.log`, raw `bridge.runSteps()`/`hierarchy()` output quoted inline above (session-local, not committed).
- Screenshots: captured via `adb exec-out screencap` at several checkpoints this session (session-local temp files, not committed to the repo).
- Relevant CMS IDs: all exam/question/answer IDs quoted inline above (`examId`, CMS question `id`, CMS answer `id`) — sourced live from `https://parrotedu.vn` CMS Exam API during this session, 2026-10-02.
- Relevant API responses: raw `metadata.raw` dumps (question content, answers, correct keys, point) captured and quoted above for every question type tested.
- Timestamps: device clock timestamps embedded in captured `collectTexts()` output (e.g., `14:43`, `15:24`) correspond to the live interaction sequence described above, same session, 2026-10-02 ~10:20–15:45 local device time.

---

## Known Production Behavior

1. **Lesson "resume" (▶) button is book-global, not lesson-scoped.** Tapping the arrow next to *any* Lesson row resumes the profile's single global "continue learning" position for that Book, regardless of which Lesson's row was tapped. Reproduced 3× — tapping "Language"'s resume arrow while "Skills > Reading 2" was incomplete always routed into Reading 2, not Language's own content, until Reading 2 was fully finished.
2. **Inconsistent "advance to next question" control between exercise UI variants.** "Đề part"-branded exercises accept re-tapping the same `exercise_check_button` id as both "Kiểm tra" and the subsequent advance action. "Thử thách"-branded reading-comprehension exercises (`Reading 1`/`Reading 2`) use a **distinct** "Tiếp theo" text control — re-tapping `exercise_check_button` there is a no-op, which looked identical to a "stuck/duplicate question" bug until root-caused live (confirmed fix: tap "Tiếp theo" by text instead).
3. **Reproducible exit-to-home bug with lost progress, `Đề part 2` (`Khối 8 > Review 4 > Language`), question CMS id `b6b32e57` ("Two days ago, Tom phoned me and said...").** Answering this question (correctly, confirmed "Chính xác") and advancing exits the entire exercise back to the Vui học home tab instead of continuing to the exercise's 8th and final question. The exercise's progress is **not** persisted — every re-entry resumes at this exact same question, discarding the prior 6 correctly-answered questions. Reproduced identically 3× via two different interaction methods (engine's bundled native-advance step, and a fully manual step-by-step sequence), ruling out an automation-side bug. This blocked completion of a clean Case 1/2/3 scoring run on this exam.
4. **"Thử thách"-branded exercises always reveal "Đáp án đúng: ..." + a "Giải thích" button, even on a correct first try** — differs from "Đề part"-branded exercises, which show a bare "Chính xác" banner with no reveal on first-try-correct.
5. A **Maestro driver crash** (`DeviceServerDiedException`) occurred once mid-session — infrastructure-level (transient ADB/gRPC connection drop), self-recovered on retry, unrelated to app behavior.
