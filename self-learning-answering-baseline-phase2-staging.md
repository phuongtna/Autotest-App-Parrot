# Self-learning Answering Baseline — Phase 2 (Staging, Environment B)

## Purpose

Re-run the scenarios **already VERIFIED in Phase 1** (`self-learning-answering-baseline.md`, Environment A / Production) against a new app build on the staging environment, and diff behavior. FILL_WORD_SINGLE is out of scope (never verified in Phase 1 either).

## Environment

- Environment: **Staging** (Environment B)
- App package: `com.inet.parrotedu` (same package id as Production — staging is a separate build/install, not a separate app)
- Build: versionName `1.0.14`, versionCode `23` (vs Environment A's `1.0.12`/`21`) — confirmed via `adb shell dumpsys package`, `firstInstallTime`/`lastUpdateTime` = 2026-10-08 13:27:04
- Device: same physical Android device, serial `3201d866d40a1681` (SM_M205G) — user reinstalled the staging build on the same device Phase 1 used
- Test account/profile: phone account with profile **"Phương"** (Pro), active book **Khối 8** at time of testing (user's own pre-existing login, not set up by this session)
- **Critical finding confirmed before any testing**: the CMS content backend for staging is **`https://parrotedu-staging.parrotedu.vn/api/cms`** (confirmed directly by the user — not guessed), a genuinely separate host from Production's `https://parrotedu.vn/api/cms`. However, **staging and production share the exact same underlying content database** — confirmed empirically: resolving the same Book/Unit/Lesson/Exercise path on both hosts returns **identical examIds and identical question CMS ids** (e.g. `Khối 1 > Unit 1 > Lesson 1 > Letter B-b` → examId `a66dbf57-...` on both; `Khối 8 > Review 4 > Skills > Reading 2` → examId `00539a52-...` with the exact same 8 question ids on both). This means Phase 2 is testing **the same content on a newer app build**, not different content — the point of comparison is app *behavior*, not data.
- **Exam Editor (ground-truth ".cache/exam_session.json" equivalent) for staging**: `https://exam-staging.parrotedu.vn` (confirmed directly by the user, not guessed). Per `automation/README.md`'s own documented mechanism, the session's required `Bearer` cookie **is the same Exam Token** obtainable via `GET /api/cms/exams/token` (no separate browser login needed) — fetched directly via `curl` against the staging CMS host and saved to `automation/.cache/exam_session_staging.json` (new file, doesn't touch the Production `.cache/exam_session.json`).
- **Code change (minimal, backward-compatible)**: `automation/discovery/examSession.js` now reads an optional `EXAM_SESSION_FILE` env var to override which session file to load, defaulting to the original hardcoded path if unset — mirrors the existing `CMS_BASE_URL`/`CMS_ACCESS_TOKEN` override pattern already used throughout this project (`src/config.js#readVar()` checks `process.env` first). No other file was modified.
- **Staging invocation pattern** (used for all CMS/ground-truth resolution calls below, as process-env overrides — `.env` itself is untouched):
  ```bash
  CMS_BASE_URL="https://parrotedu-staging.parrotedu.vn/api/cms" \
  CMS_ACCESS_TOKEN="<staging admin token, from POST /api/cms/login>" \
  EXAM_SESSION_FILE="automation/.cache/exam_session_staging.json" \
  node <script>
  ```
- **New UI element observed, not present in Production (build 1.0.12)**: an "AI hỗ trợ học tập" (AI learning support) consent dialog appears when entering certain lesson content (observed on `Khối 8 > Review 4 > Skills`), disclosing that learning content and user input may be sent to Google Gemini / Microsoft Azure AI. Dismissed via "Để sau" (the privacy-preserving default) each time — this dialog reappeared on every fresh entry into this lesson during this session (did not appear to be a true one-time app-level consent). This is a genuine new-build feature difference worth flagging, not a bug.
- **Operational note — severe Maestro driver instability this session, root-caused**: `--no-reinstall-driver` relies on the on-device driver server staying alive between separate CLI invocations, but during this session the port-forward (tcp:7001) was not staying up between calls at all (confirmed via `ss -tlnp`/`netstat` showing no listener) — every `--no-reinstall-driver` call failed, including immediately after a successful full reinstall. **Reliable workaround adopted for the rest of Phase 2**: batch each scenario's full step sequence into **one single `maestro test <flow.yaml>` call without `--no-reinstall-driver`** (full driver reinstall each time, ~50-60s fixed cost, but reliable), rather than many small bridge calls. This is purely an infra/tooling issue, unrelated to app behavior.
- **New text-matching gotcha found this session**: some CMS answer option text carries **trailing whitespace** (e.g. `"out  "` with two trailing spaces) in the on-device accessibility tree — exact-string `tapOn` fails silently distinguishing this from "element truly absent"; fixed by using a regex (`"out.*"`) instead. Same family of bug as the already-documented "Pronunciation answer nbsp tap bug" memory, now confirmed for plain CHOICE text too, not just pronunciation content.

---

## Test Matrix (Phase 2, staging build 1.0.14)

Status values: same 4-state vocabulary as Phase 1 — **VERIFIED** / **BLOCKED** / **NOT_VERIFIED** / **NOT_APPLICABLE**. A 5th column captures the diff vs Phase 1.

| Question Type | Correct 1st (A) | Wrong → Correct (B) | Wrong → Wrong (C) | Diff vs Phase 1 (Production) |
|---|---|---|---|---|
| CHOICE | VERIFIED | VERIFIED | VERIFIED | **No behavioral difference found** |
| SORT | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | — |
| FILL_WORD_MULTI | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | — |
| DRAG_DROP | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | — |
| CONNECT | NOT_VERIFIED | NOT_APPLICABLE | NOT_APPLICABLE | — |

---

## Detailed Results

### CHOICE

Content: `Khối 8 > Review 4 > Skills > Reading 1` (examId `5cc207dd-1dfd-427f-ac9a-44e06417c3af`, exam name "E8R24 - R1" — same examId referenced in Phase 1's CMS scoring table), passage "THE FUTURE OF COMMUNICATION", 5 questions.

#### Scenario A — Correct first attempt
- Action: tapped CMS-correct answer (`with`, question id `4f04187f-6d00-457d-987a-254a90f5d592`), "Kiểm tra".
- Actual: `["...","Chính xác","Đáp án đúng: C. with.","Giải thích","Tiếp theo"]` — reveal shown even on correct first try, exactly matching Phase 1's documented "Thử thách"-branded-exercise behavior (Known Production Behavior #4 in the Phase 1 doc).
- Result: **VERIFIED, no diff from Production.**

#### Scenario B — Wrong first → Correct second
- Action: tapped wrong (`lived`), "Kiểm tra" → "Thử lại" → tapped correct (`live`, question id `d335bd14-2d06-436c-99f8-ac19dcb0201e`), "Kiểm tra" again.
- Actual: attempt 1 `["...","Chưa chính xác","Con chú ý","thì và chủ ngữ","để chọn động từ thích hợp.","Giải thích","Thử lại"]`; attempt 2 `["...","Chính xác","Đáp án đúng: C. live.","Giải thích","Tiếp theo"]` — no more retry after correct.
- Result: **VERIFIED, no diff from Production.**

#### Scenario C — Wrong first → Wrong second
- Action: tapped wrong (`out`, regex `"out.*"` needed — see trailing-whitespace gotcha above), "Kiểm tra" → "Thử lại" → tapped different wrong (`up`), "Kiểm tra" again. Question id `f39823ff-02ef-41bd-8365-720168148a37`, correct=`down`.
- Actual: final state `["...","Chưa chính xác","Đáp án đúng: D. down.","Giải thích","Tiếp theo"]` — no "Thử lại" after 2nd wrong attempt, matches Phase 1 exactly.
- Result: **VERIFIED, no diff from Production.**

---

### SORT

NOT_VERIFIED yet — not yet attempted this session.

---

### FILL_WORD_MULTI

NOT_VERIFIED yet — not yet attempted this session.

---

### DRAG_DROP

NOT_VERIFIED yet — not yet attempted this session.

---

### CONNECT

NOT_VERIFIED yet — not yet attempted this session.

---

## Phase 2 Completion Summary (in progress)

| Question Type | A | B | C |
|---|---|---|---|
| CHOICE | VERIFIED | VERIFIED | VERIFIED |
| SORT | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED |
| FILL_WORD_MULTI | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED |
| DRAG_DROP | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED |
| CONNECT | NOT_VERIFIED | NOT_APPLICABLE | NOT_APPLICABLE |

**Status: IN PROGRESS.** 1 of 5 in-scope question types (CHOICE) fully re-verified with no behavioral diff found. 4 remain.
