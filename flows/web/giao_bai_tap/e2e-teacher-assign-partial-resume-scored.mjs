#!/usr/bin/env node
/**
 * E2E-Teacher-Assign-Partial-Resume-Scored (bản RANDOM, 2026-08-17 - thay hẳn bản PINNED cũ)
 *
 * Lifecycle ĐẦY ĐỦ "hành vi giống USER THẬT":
 *
 *   GV giao 1 bài MỚI random (Web GV, Playwright) -> App HS nhận đúng assignment -> HS mở đúng bài
 *   -> làm THẬT 3 câu đầu (đáp án lấy từ CMS, KHÔNG đoán) -> thoát bằng nút X (UI thật, KHÔNG
 *   stopApp/launchApp) -> quay về danh sách Bài tập (VẪN CÙNG session app) -> mở LẠI ĐÚNG bài đó ->
 *   xác nhận RESUME -> làm hết câu còn lại -> màn Kết quả -> đọc điểm THẬT -> verify điểm khớp
 *   CHÍNH XÁC FIRST_TARGET_SCORE -> tìm lại ĐÚNG assignment -> "Làm lại" -> làm hết nhắm
 *   REDO_TARGET_SCORE -> màn Kết quả -> verify điểm khớp CHÍNH XÁC REDO_TARGET_SCORE -> đọc CTA
 *   thật ("Tiếp theo"/"Hoàn thành") -> tap CTA thật -> verify navigation.
 *
 * ═══════════════════════════ PHASE C - FULL ARCHITECTURE MIGRATION (2026-09-01) ═══════════════════
 * Sau chuỗi FAIL/BLOCKED thật (AMBIGUOUS do title-only identity, CONTENT_MISMATCH do locate-Làm-lại
 * không verify nội dung, occurrence-counting sai trong 1 hierarchy() snapshot...), đã audit TOÀN BỘ
 * execution chain (PHASE A) + thiết kế kiến trúc canonical (PHASE B) trước khi sửa - xem hội thoại.
 * Thay đổi so với bản trước (KHÔNG đụng answer semantics/scoring mathematics/CTA cuối/matcher):
 *
 *   1. SCORING: bỏ hẳn bản copy private (buildScoringPlan/scaledSumForScore/achievableScoresList/
 *      buildWeightedWantCorrectPlan/correctIndicesForExactScore) - IMPORT THẲNG từ
 *      `e2e-teacher-assign-full-scored-target5.mjs` (file ĐÃ EXPORT toàn bộ scoring engine subset-
 *      sum THẬT, cùng công thức, ĐÃ có fixture test riêng - xem
 *      e2e-teacher-assign-full-scored-target5.scoringAndMatcher.fixtureTest.mjs). `resolveScoringPlanForCandidate(questions,
 *      {mode:"target", targetScoreEnv})` đã đọc TOÀN VĂN trước khi dùng (PHASE C mục 2 yêu cầu) -
 *      semantics XÁC NHẬN tương đương 100% `correctIndicesForExactScore()` cũ (cùng buildScoringPlan
 *      + scaledSumForScore + correctIndicesForScaledSum bên trong), chỉ khác trả object có cấu trúc
 *      thay vì throw khi không khả thi (AN TOÀN HƠN - không throw ngoài dự kiến, xử lý BLOCKED tường
 *      minh). KHÔNG dùng mode="range" (không cần - luôn nhắm ĐÚNG 1 target cụ thể, không random range).
 *
 *   2. LOCATE + CONTENT VERIFICATION: bỏ hẳn `openAssignmentDisambiguated()`/`scrollAndReadCardState()`/
 *      `readCardState()`/`scrollToNextUntriedCardState()`/`cardStateSignature()`/`scrollToCard()`
 *      (bản private, dùng `findAssignment()`/`tapFoundCard()` riêng lẻ không content-verify hoặc
 *      dùng cơ chế đếm occurrence trong 1 hierarchy() snapshot đã audit là SAI khi RecyclerView
 *      không mount đồng thời nhiều occurrence) - IMPORT THẲNG `locateOpenAndVerifyAssignment()` từ
 *      `e2e-teacher-assign-full-scored-target5.mjs` (ĐÃ EXPORT, ĐÃ có lịch sử fix bug thật 2026-08-22
 *      trên room 19e78018-8c11-48e9-845f-efefe4dff82f - ĐÚNG loại lỗi "card liền kề title gần giống
 *      + cùng hạn nộp" mà file này từng gặp). Hàm này gọi lại NGUYÊN VẸN `findAssignment()`/
 *      `tapFoundCard()`/`findMatchingQuestion()` (KHÔNG viết lại, KHÔNG sửa `findAssignment.js`) -
 *      chỉ thêm ĐÚNG 1 lớp: mở candidate ra rồi xác thực nội dung câu hỏi hiển thị khớp với
 *      `QUESTIONS` đã resolve THẬT theo room.id - identity thật duy nhất còn lại khi UI không lộ
 *      room.id. KHÔNG first-fit: khi AMBIGUOUS (>=2 candidate cùng title+Hạn nộp[+cta]), thử HẾT mọi
 *      candidate (đóng lại sau mỗi lần), chỉ accept khi ĐÚNG 1 candidate khớp content.
 *      DÙNG CHUNG cho CẢ 3 use case (đúng thiết kế gốc của hàm, xem docblock trong file nguồn):
 *        - NEW (mở lần đầu):  cta = null (bất kỳ CTA nào - "Làm bài"/"Chinh phục" tuỳ tier)
 *        - RESUME:            cta = "Tiếp tục"
 *        - REDO ("Làm lại"):  cta = "Làm lại"
 *
 *   3. ROOM RESOLUTION: bỏ phụ thuộc `assignHomeworkAndLocateOnApp()` (e2e-teacher-assign-student-
 *      open.mjs) cho việc LOCATE khi giao bài mới - hàm đó vẫn CÒN 6 caller thật khác trong repo
 *      (đã audit qua grep, xem PHASE A/B), KHÔNG được sửa. Thay bằng gọi trực tiếp
 *      `assignHomeworkFlow()` (Web GV, PIN theo unitName/lessonName/homeworkItemId đã random chọn ở
 *      prescan - CÙNG cách `e2e-giaobai-profilehientai-diem3-lamlai-diem8.mjs` đã dùng) rồi
 *      `findRoomIdByLessonItem({lessonItemId, classId, endTimeDatePrefix})` (export,
 *      teacherAssignmentApiDiscovery.js, deterministic theo lesson_item_id - KHÔNG qua title/UI,
 *      throw rõ ràng nếu >1 match, KHÔNG đoán) - CANONICAL room resolver đã chốt, thay hẳn cơ chế
 *      diff-before/after room.json (vẫn tồn tại nguyên trong assignHomeworkAndLocateOnApp() cho 6
 *      caller kia, KHÔNG xoá).
 *
 *   4. PARTIAL_COUNT: từ `QUESTIONS.length >= 4 ? 3 : 2` (fallback ngầm, không phải guarantee) sang
 *      hard invariant `PARTIAL_COUNT = 3` + reject tường minh (`DATA_INVALID`) nếu N<3 TRƯỚC KHI mở
 *      bài (đã có sẵn N>=3 qua `isTextChoiceCompatible()` ở prescan/CMS_RESOLUTION, nhưng vẫn thêm
 *      assertion trực tiếp tại đây - đúng chính xác điều acceptance criterion yêu cầu, không suy ra
 *      gián tiếp qua 1 điều kiện khác).
 *
 *   5. ERROR TAXONOMY: chuẩn hoá `phase` trong file này theo taxonomy canonical (DATA_INVALID/
 *      PREFLIGHT_REJECT/ASSIGN_FAILED/ROOM_RESOLUTION_FAILED/CARD_NOT_FOUND/CARD_AMBIGUOUS/
 *      CARD_IDENTITY_MISMATCH/EXERCISE_OPEN_FAILED/QUESTION_NOT_FOUND/QUESTION_AMBIGUOUS/
 *      RESUME_INVALID/FIRST_SCORE_MISMATCH/REDO_CARD_NOT_FOUND/REDO_CARD_AMBIGUOUS/
 *      REDO_IDENTITY_MISMATCH/SECOND_SCORE_MISMATCH/CTA_INVALID) - CHỈ trong file này, KHÔNG refactor
 *      file khác.
 *
 * KHÔNG đổi (No-regression boundary, đã audit không có root cause liên quan):
 *   `findMatchingQuestion()`/`diagnoseCurrentQuestion()` (answerSetMatcher.js),
 *   `HomeworkExamEngine.answerCurrentQuestionOneShot()`, `resolveHomeworkExamQuestionsForRoomId()`,
 *   `assignHomeworkFlow()`, `exitToHomeworkList()` (giữ nguyên trong file, không đụng), vòng lặp trả
 *   lời partial/resume/redo (giữ nguyên cấu trúc, chỉ đổi NGUỒN correctIndices), CTA cuối (chưa có
 *   evidence lỗi), `findAssignment.js`/`tapFoundCard()` (không sửa, chỉ không còn gọi trực tiếp).
 *
 * TÁI SỬ DỤNG (không viết lại):
 *   - assignHomeworkFlow() (automation/giao_bai_tap/runtime/assignHomeworkFlow.js) - Web GV
 *     (Playwright), PIN theo unitName/lessonName/homeworkItemId đã random chọn ở pre-scan.
 *   - findRoomIdByLessonItem() (teacherAssignmentApiDiscovery.js) - canonical room resolver.
 *   - resolveScoringPlanForCandidate()/buildWeightedWantCorrectPlan()/locateOpenAndVerifyAssignment()
 *     (e2e-teacher-assign-full-scored-target5.mjs) - canonical scoring + locate/content-verify.
 *   - MaestroMcpBridge (bridge/maestroMcpBridge.js) - 1 tiến trình `maestro mcp` DUY NHẤT xuyên suốt
 *     toàn bộ phần thao tác thiết bị, KHÔNG spawn CLI mới cho từng tương tác.
 *   - HomeworkExamEngine (bai_tap/navigation/homeworkExamEngine.js) - decideAnswerAction()/
 *     answerCurrentQuestionOneShot(), KHÔNG sửa.
 *   - resolveHomeworkExamQuestionsForRoomId() (bai_tap/discovery/teacherMaterialsExamResolver.js) -
 *     resolve câu hỏi/đáp án CHÍNH XÁC theo room.id (KHÔNG qua title) - nguồn sự thật DUY NHẤT cho
 *     QUESTIONS của room vừa được giao.
 *   - fetchEligibleAssignmentTree()/parseQuestionsFromExamPage()/normalizeQuestions() - pre-scan
 *     read-only toàn bộ cây eligible + đọc thử nội dung candidate (KHÔNG side-effect, không giao bài
 *     thật cho tới khi đã chọn xong 1 candidate khả thi).
 *
 * CHẠY: node flows/giao_bai_tap/e2e-teacher-assign-partial-resume-scored.mjs
 * ENV: APP_ID/PHONE/OTP/MAESTRO_DEVICE (.env, test_data/accounts.env), TEACHER_* (.env, dùng bởi
 *   assignHomeworkFlow), ASSIGN_PRIMARY_CLASS (default "3B"), FIRST_TARGET_SCORE (default 3, chỉ là
 *   fallback KHÔNG phải hardcode logic - truyền qua env để đổi), REDO_TARGET_SCORE (default 8, cùng
 *   ý nghĩa), MAX_PRESCAN_ATTEMPTS (default 12), MAX_DISAMBIGUATE_CANDIDATES (default 10),
 *   ASSIGN_DUE_DATE_DAYS_AHEAD (default 7).
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MaestroMcpBridge } from "../../../automation/bridge/maestroMcpBridge.js";
import { HomeworkExamEngine } from "../../../automation/bai_tap/navigation/homeworkExamEngine.js";
import { findMatchingQuestion, normalizeAnswerText } from "../../../automation/bai_tap/discovery/answerSetMatcher.js";
import { fetchEligibleAssignmentTree, findRoomIdByLessonItem } from "../../../automation/giao_bai_tap/navigation/teacherAssignmentApiDiscovery.js";
// PHASE F (2026-09-01) - parseQuestionsFromExamPageWithRetry() thay parseQuestionsFromExamPage()
// trực tiếp ở prescan: page.goto() bên trong ĐÃ ĐO THẬT flaky (~2/3 timeout do networkidle - đúng
// nguyên nhân BLOCKED thật gặp ở PHASE D) - retry BOUNDED tối đa 2 lần, CHỈ cho lỗi timeout-shaped.
import { parseQuestionsFromExamPageWithRetry } from "../../../automation/discovery/examPageScraper.js";
import { normalizeQuestions } from "../../../automation/model/questionModel.js";
import { resolveHomeworkExamQuestionsForRoomId } from "../../../automation/bai_tap/discovery/teacherMaterialsExamResolver.js";
import { fetchRoomDetails } from "../../../automation/bai_tap/discovery/homeworks.js";
import { formatDM, formatDMY, isoToVnYmd } from "../../../automation/bai_tap/verify-filter-web-vs-app.mjs";
import { assignHomeworkFlow } from "../../../automation/giao_bai_tap/runtime/assignHomeworkFlow.js";
// PHASE C (2026-09-01, xem docblock đầu file mục 1/2) - canonical scoring + locate/content-verify,
// IMPORT THẲNG từ file ĐÃ EXPORT + ĐÃ PROVEN (KHÔNG copy, KHÔNG viết lại, KHÔNG sửa findAssignment.js).
import { resolveScoringPlanForCandidate, buildWeightedWantCorrectPlan, locateOpenAndVerifyAssignment } from "./e2e-teacher-assign-full-scored-target5.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "e2e_teacher_assign_partial_resume_scored_report.json");
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const TARGET_CLASS = process.env.ASSIGN_PRIMARY_CLASS || "3B";
const MAX_PRESCAN_ATTEMPTS = Number(process.env.MAX_PRESCAN_ATTEMPTS || 12);
const MAX_DISAMBIGUATE_CANDIDATES = Number(process.env.MAX_DISAMBIGUATE_CANDIDATES || 10);
// Target score ĐỘNG qua env - default là fallback, KHÔNG phải giá trị ép cứng.
const FIRST_TARGET_SCORE = Number(process.env.FIRST_TARGET_SCORE || 3);
const REDO_TARGET_SCORE = Number(process.env.REDO_TARGET_SCORE || 8);
const ASSIGN_DUE_DATE_DAYS_AHEAD = Number(process.env.ASSIGN_DUE_DATE_DAYS_AHEAD || 7);

function log(...args) {
  console.log(...args);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function collectAllTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectAllTexts(c, acc);
  return acc;
}

function addDaysDdMmYyyy(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function toIsoDatePrefix(ddmmyyyy) {
  const [dd, mm, yyyy] = ddmmyyyy.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

async function exitToHomeworkList(bridge) {
  const r = await bridge.runSteps([
    { tapOn: { id: "exercise_close_button" } },
    { waitForAnimationToEnd: { timeout: 1500 } },
    { tapOn: { text: "Thoát", optional: true } },
    { tapOn: { text: "Đồng ý", optional: true } },
    { tapOn: { text: "Xác nhận", optional: true } },
    { waitForAnimationToEnd: { timeout: 1000 } },
    { extendedWaitUntil: { visible: { id: "homework_screen" }, timeout: 20000 } },
  ]);
  if (!r.success) {
    throw new Error(`Tap X (exercise_close_button) + xử lý confirm-dialog + chờ "homework_screen" thất bại: ${r.error}`);
  }
}

async function answerOneQuestion(exam, matched, isLast, wantCorrectMap) {
  const wantCorrect = wantCorrectMap.get(matched.id);
  const outcome = await exam.answerCurrentQuestionOneShot(matched, {
    wantCorrect,
    resultLabel: isLast ? "e2e_partial_resume_scored_result_screen" : null,
    snapshot: matched._snapshot ?? null,
  });
  if (!outcome.supported) {
    throw new Error(`Handler không hỗ trợ câu "${matched.question}" (id=${matched.id}): ${outcome.reason}`);
  }
  return { matched, wantCorrect, outcome };
}

function finish(result) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  return result;
}

/**
 * Câu có "handler hỗ trợ đầy đủ" (đúng yêu cầu đề bài "chỉ chọn bài mà automation hiện tại có
 * handler hỗ trợ đầy đủ") theo ĐÚNG 2 chiến lược decideAnswerAction() hỗ trợ - chỉ pre-check được
 * chiến lược TEXT_CHOICE từ nội dung CMS (đáp án dạng chữ + correctAnswer xác định); KHÔNG pre-check
 * được IMAGE_CHOICE_GRID (cần nhìn layout thật trên màn hình, không suy ra được từ CMS) - CHỦ ĐÍCH
 * loại luôn candidate nào chỉ hỗ trợ được qua GRID (an toàn hơn, tránh false-positive lúc pre-scan).
 * Yêu cầu thêm N>=3 (đủ chỗ cho PARTIAL đúng 3 câu + còn ít nhất 1 câu để RESUME).
 */
function isTextChoiceCompatible(questions) {
  if (!Array.isArray(questions) || questions.length < 3) return false;
  return questions.every((q) => {
    const nonEmptyAnswers = (q.answers ?? []).filter((a) => typeof a === "string" && a.trim().length > 0);
    return nonEmptyAnswers.length >= 2 && q.correctAnswer && nonEmptyAnswers.includes(q.correctAnswer);
  });
}

/**
 * Loại candidate có >=2 câu cùng "full answer-set" (tập đáp án hiển thị giống hệt nhau sau khi
 * normalize) - đây CHÍNH XÁC là điều kiện khiến `findMatchingQuestion()`/`findFullAnswerSetMatches()`
 * (answerSetMatcher.js) trả nhiều candidate cùng khớp đủ answer-set cho 1 màn hình, dẫn tới
 * AMBIGUOUS. Dùng LẠI `normalizeAnswerText()` (export, CÙNG hàm canonical matcher dùng nội bộ để so
 * answer-set - KHÔNG viết lại quy tắc normalize riêng) - KHÔNG đụng `findMatchingQuestion()`, chỉ
 * loại candidate NGAY TỪ PRESCAN, trước khi giao bài thật.
 */
function hasDuplicateFullAnswerSet(questions) {
  const seenSignatures = new Set();
  for (const q of questions) {
    const nonEmptyAnswers = (q.answers ?? []).filter((a) => typeof a === "string" && a.trim().length > 0);
    if (nonEmptyAnswers.length < 2) continue;
    const signature = [...new Set(nonEmptyAnswers.map((a) => normalizeAnswerText(a)))].sort().join("|");
    if (seenSignatures.has(signature)) return true;
    seenSignatures.add(signature);
  }
  return false;
}

/** Feasibility check dùng chung cho pre-scan (pickFeasibleRandomAssignment) VÀ CMS_RESOLUTION
 * re-verify trong main() - CẢ FIRST_TARGET_SCORE và REDO_TARGET_SCORE phải khả thi trên CÙNG bộ
 * questions (2 lượt làm dùng lại đúng 1 room/bộ câu hỏi). Dùng LẠI `resolveScoringPlanForCandidate()`
 * (canonical, imported, mode="target") - KHÔNG tự làm subset-sum, chỉ orchestrate 2 lần gọi cho 2
 * target khác nhau (nhu cầu riêng của file này, không phải logic scoring mới). */
function bothTargetsAchievable(questions) {
  const first = resolveScoringPlanForCandidate(questions, { mode: "target", targetScoreEnv: FIRST_TARGET_SCORE });
  const redo = resolveScoringPlanForCandidate(questions, { mode: "target", targetScoreEnv: REDO_TARGET_SCORE });
  const achievableScores = first.achievableScores ?? redo.achievableScores ?? [];
  return { ok: Boolean(first.achievable && redo.achievable), hasFirst: Boolean(first.achievable), hasRedo: Boolean(redo.achievable), achievableScores };
}

/**
 * Random 1 candidate khả thi trong TOÀN BỘ cây eligible của `className` - đọc read-only, KHÔNG giao
 * bài thật cho tới khi hàm này trả về `ok:true` (main() mới thực sự gọi Web GV sau đó). Duyệt theo
 * thứ tự RANDOM (Fisher-Yates), dừng ở candidate ĐẦU TIÊN thoả cả 3 điều kiện: (a) handler hỗ trợ
 * đầy đủ (isTextChoiceCompatible), (b) KHÔNG có câu trùng full answer-set (hasDuplicateFullAnswerSet),
 * (c) achievableScores (subset-sum thật) chứa CẢ FIRST_TARGET_SCORE và REDO_TARGET_SCORE. Giới hạn
 * `maxAttempts` (mỗi lượt gọi `parseQuestionsFromExamPage()` mở 1 trang Exam Editor thật qua
 * Playwright, ~7-30s/candidate - KHÔNG duyệt hết cả trăm candidate). Không tìm được -> `ok:false`
 * kèm toàn bộ `attempts` đã thử (để báo cáo trung thực, không đoán/không âm thầm hạ tiêu chuẩn).
 */
async function pickFeasibleRandomAssignment({ className, maxAttempts = MAX_PRESCAN_ATTEMPTS }) {
  const tree = await fetchEligibleAssignmentTree(className);
  const flat = [];
  for (const u of tree.eligibleTree) {
    // LOẠI Unit "Review N" - Web GV UI cho Unit dạng Review LUÔN hiển thị ĐÚNG 3 tab lesson CỐ ĐỊNH
    // ("Vocabulary"/"Sentence patterns"/"Other") trong khi tên Lesson mà CMS API trả về cho Review
    // là tên TAXONOMY KHÁC hẳn - KHÔNG THỂ chọn đúng Lesson cho Review bằng tên lessonName từ CMS
    // (hạn chế THẬT của automation hiện tại, không phải đoán/né lỗi). Unit thường KHÔNG bị ảnh hưởng.
    if (/^Review\s+\d+/i.test(u.unitName)) continue;
    for (const l of u.lessons) {
      for (const it of l.items) {
        if (it.isSpeak) continue;
        if (!Array.isArray(it.examIds) || it.examIds.length !== 1) continue;
        flat.push({
          unitName: u.unitName,
          lessonName: l.lessonName,
          itemName: it.name,
          itemId: it.id,
          examId: it.examIds[0],
          questionCountHint: it.questionCount,
        });
      }
    }
  }
  const order = shuffle(flat).slice(0, maxAttempts);
  const attempts = [];
  for (const cand of order) {
    let questions = null;
    let errorMessage = null;
    try {
      const examData = await parseQuestionsFromExamPageWithRetry(cand.examId);
      questions = normalizeQuestions(examData);
    } catch (err) {
      errorMessage = err.message;
    }
    const compatible = questions ? isTextChoiceCompatible(questions) : false;
    const duplicateAnswerSet = compatible ? hasDuplicateFullAnswerSet(questions) : false;
    const feasibility = compatible && !duplicateAnswerSet ? bothTargetsAchievable(questions) : { ok: false, achievableScores: [] };
    const ok = Boolean(feasibility.ok);
    attempts.push({
      unitName: cand.unitName,
      lessonName: cand.lessonName,
      itemName: cand.itemName,
      itemId: cand.itemId,
      examId: cand.examId,
      questionCount: questions?.length ?? null,
      ok,
      reason:
        errorMessage ??
        (!compatible
          ? "UNSUPPORTED_TYPE_OR_MISSING_CORRECT_ANSWER"
          : duplicateAnswerSet
            ? "DUPLICATE_FULL_ANSWER_SET"
            : !ok
              ? `achievableScores=[${feasibility.achievableScores.join(", ")}] thiếu ${!feasibility.hasFirst ? FIRST_TARGET_SCORE : ""}${!feasibility.hasFirst && !feasibility.hasRedo ? " và " : ""}${!feasibility.hasRedo ? REDO_TARGET_SCORE : ""}`
              : null),
    });
    log(
      `  [PRESCAN] "${cand.unitName}/${cand.lessonName}/${cand.itemName}" (N=${questions?.length ?? "?"}): ${
        ok ? `KHẢ THI (achievableScores chứa cả ${FIRST_TARGET_SCORE} và ${REDO_TARGET_SCORE})` : `loại (${attempts[attempts.length - 1].reason})`
      }`,
    );
    if (ok) {
      return {
        ok: true,
        chosen: { ...cand, questions },
        classId: tree.classId,
        attempts,
        totalEligibleNonSpeakSingleExam: flat.length,
        treeStats: tree.stats,
      };
    }
  }
  return { ok: false, attempts, totalEligibleNonSpeakSingleExam: flat.length, treeStats: tree.stats };
}

async function main() {
  if (Number.isNaN(FIRST_TARGET_SCORE) || FIRST_TARGET_SCORE < 0 || FIRST_TARGET_SCORE > 10) {
    throw new Error(`FIRST_TARGET_SCORE=${process.env.FIRST_TARGET_SCORE} ngoài thang [0,10].`);
  }
  if (Number.isNaN(REDO_TARGET_SCORE) || REDO_TARGET_SCORE < 0 || REDO_TARGET_SCORE > 10) {
    throw new Error(`REDO_TARGET_SCORE=${process.env.REDO_TARGET_SCORE} ngoài thang [0,10].`);
  }

  const evidence = {};

  // ===== [SELECT_CANDIDATE] + [ASSIGN] + [RESOLVE_ROOM] =====
  let assignment, dueVnYmd, startVnYmd, APP_ID;

  if (process.env.REUSE_ROOM_ID) {
    // Escape hatch cho ĐÚNG 1 lớp lỗi đã gặp THẬT: teacher-assign THẬT thành công (room_id đã biết)
    // nhưng cần locate+resolve lại trên App HS - KHÔNG gọi lại Web GV (tránh tạo room trùng), chỉ
    // đọc lại metadata room đã có (read-only) rồi locate lại bằng canonical locate+verify bên dưới.
    const roomId = process.env.REUSE_ROOM_ID;
    log(`[SELECT_CANDIDATE] REUSE_ROOM_ID=${roomId} - bỏ qua pre-scan + giao bài lại, tự locate+resolve lại trên room đã có.`);
    const roomDetails = await fetchRoomDetails(roomId);
    const room = roomDetails?.room;
    if (!room) {
      return finish({ status: "FAIL", phase: "ROOM_RESOLUTION_FAILED", error: `fetchRoomDetails("${roomId}") không trả về room hợp lệ.`, evidence });
    }
    assignment = { id: room.id, title: room.name, classIds: room.class_id ?? [] };
    dueVnYmd = isoToVnYmd(room.end_time);
    startVnYmd = isoToVnYmd(room.start_time);
    evidence.locateCaveat = `Room "${roomId}" đã được xác nhận tồn tại thật qua fetchRoomDetails() - lần chạy này KHÔNG gọi lại Web GV (tránh tạo room trùng), chỉ tự locate+content-verify lại trên App HS.`;
    ({ APP_ID } = await import("./e2e-teacher-assign-student-open.mjs"));
  } else {
    log(`[SELECT_CANDIDATE] Pre-scan READ-ONLY toàn bộ cây eligible lớp ${TARGET_CLASS} để chọn 1 candidate khả thi (handler hỗ trợ + CẢ target=${FIRST_TARGET_SCORE} và target=${REDO_TARGET_SCORE} đều khả thi theo point CMS thật)...`);
    const picked = await pickFeasibleRandomAssignment({ className: TARGET_CLASS });
    evidence.randomSelection = {
      totalEligibleNonSpeakSingleExam: picked.totalEligibleNonSpeakSingleExam,
      treeStats: picked.treeStats,
      attemptsCount: picked.attempts.length,
      attempts: picked.attempts,
    };
    if (!picked.ok) {
      log(`  [BLOCKED] Đã thử ${picked.attempts.length} candidate, không candidate nào khả thi.`);
      return finish({
        status: "BLOCKED",
        phase: "PREFLIGHT_REJECT",
        error: `Đã thử ${picked.attempts.length}/${MAX_PRESCAN_ATTEMPTS} candidate random trong lớp ${TARGET_CLASS} - không candidate nào vừa có handler hỗ trợ đầy đủ vừa đạt được CẢ 2 target score (${FIRST_TARGET_SCORE}, ${REDO_TARGET_SCORE}) trên cùng 1 room (subset-sum theo point CMS thật).`,
        evidence,
      });
    }
    const chosen = picked.chosen;
    evidence.chosenCandidate = { unitName: chosen.unitName, lessonName: chosen.lessonName, itemName: chosen.itemName, itemId: chosen.itemId, examId: chosen.examId };
    log(`  [PASS] Chọn "${chosen.unitName}/${chosen.lessonName}/${chosen.itemName}" (itemId=${chosen.itemId}, N=${chosen.questions.length}) - cả target=${FIRST_TARGET_SCORE} và target=${REDO_TARGET_SCORE} đều khả thi.`);

    // ===== [ASSIGN] - giao bài THẬT (Web GV, Playwright) cho ĐÚNG candidate vừa chọn =====
    const dueDateDdMmYyyy = addDaysDdMmYyyy(ASSIGN_DUE_DATE_DAYS_AHEAD);
    log(`[ASSIGN] Giao bài "${chosen.itemName}" cho lớp ${TARGET_CLASS}, hạn nộp ${dueDateDdMmYyyy}...`);
    const assignResult = await assignHomeworkFlow({
      primaryClass: TARGET_CLASS,
      dueDate: dueDateDdMmYyyy,
      unitName: chosen.unitName,
      lessonName: chosen.lessonName,
      homeworkItemId: chosen.itemId,
      homeworkItemName: chosen.itemName,
      headless: true,
    });
    evidence.assignResult = { status: assignResult.status, steps: assignResult.steps?.map((s) => ({ name: s.name, status: s.status })) };
    if (assignResult.status !== "PASS") {
      return finish({ status: "FAIL", phase: "ASSIGN_FAILED", error: `assignHomeworkFlow() FAIL: ${assignResult.error}`, evidence });
    }
    log(`  [PASS] Đã giao bài qua Web GV.`);

    // ===== [RESOLVE_ROOM] - canonical, deterministic theo lesson_item_id (KHÔNG qua title/UI) =====
    log(`[RESOLVE_ROOM] Resolve room_id thật của bài vừa giao (lessonItemId=${chosen.itemId})...`);
    const room = await findRoomIdByLessonItem({
      lessonItemId: chosen.itemId,
      classId: picked.classId,
      endTimeDatePrefix: toIsoDatePrefix(dueDateDdMmYyyy),
    });
    const roomDetails = await fetchRoomDetails(room.id);
    const roomFull = roomDetails?.room;
    if (!roomFull) {
      return finish({ status: "BLOCKED", phase: "ROOM_RESOLUTION_FAILED", error: `fetchRoomDetails("${room.id}") không trả về room hợp lệ ngay sau findRoomIdByLessonItem().`, evidence });
    }
    assignment = { id: roomFull.id, title: roomFull.name, classIds: roomFull.class_id ?? [] };
    dueVnYmd = isoToVnYmd(roomFull.end_time);
    startVnYmd = isoToVnYmd(roomFull.start_time);
    ({ APP_ID } = await import("./e2e-teacher-assign-student-open.mjs"));
  }
  const dueDM = formatDM(dueVnYmd);
  log(`  [PASS] room_id=${assignment.id} title="${assignment.title}" due=${formatDMY(dueVnYmd)}`);

  // ===== [RESOLVE_CONTENT] - nguồn sự thật DUY NHẤT cho câu hỏi/đáp án của ĐÚNG room này =====
  log(`[RESOLVE_CONTENT] Resolve câu hỏi/đáp án CHÍNH XÁC theo room.id (KHÔNG qua title)...`);
  const resolved = await resolveHomeworkExamQuestionsForRoomId(assignment.id);
  if (resolved.status !== "RESOLVED") {
    return finish({
      status: "BLOCKED",
      phase: "DATA_INVALID",
      error: `resolveHomeworkExamQuestionsForRoomId("${assignment.id}") trả về status=${resolved.status}: ${resolved.reason}`,
      evidence,
    });
  }
  const swapAnswer = resolved.roomDetails?.room?.exams?.[0]?.is_swap_answer ?? null;
  const swapQuestion = resolved.roomDetails?.room?.exams?.[0]?.is_swap_question ?? null;
  if (swapAnswer || swapQuestion) {
    return finish({
      status: "BLOCKED",
      phase: "DATA_INVALID",
      error: `Room "${assignment.id}" có is_swap_answer=${swapAnswer}/is_swap_question=${swapQuestion} - CHƯA verify content khớp catalog khi swap=true, KHÔNG tin tưởng đáp án.`,
      evidence,
    });
  }
  const QUESTIONS = resolved.questions;
  if (!isTextChoiceCompatible(QUESTIONS)) {
    return finish({
      status: "BLOCKED",
      phase: "DATA_INVALID",
      error: `Nội dung THẬT của room "${assignment.id}" KHÔNG còn khớp điều kiện handler hỗ trợ đầy đủ (khác pre-scan candidate ban đầu - có thể do is_swap hoặc CMS đổi nội dung giữa lúc pre-scan và lúc giao bài).`,
      evidence,
    });
  }
  // PARTIAL phải EXACTLY 3 câu (acceptance requirement, hard invariant - KHÔNG fallback xuống 2).
  if (QUESTIONS.length < 3) {
    return finish({
      status: "BLOCKED",
      phase: "DATA_INVALID",
      error: `Room "${assignment.id}" chỉ có N=${QUESTIONS.length} câu (<3) - không đủ để đảm bảo PARTIAL_COUNT=3 câu.`,
      evidence,
    });
  }
  const PARTIAL_COUNT = 3;
  const feasibility = bothTargetsAchievable(QUESTIONS);
  if (!feasibility.ok) {
    return finish({
      status: "BLOCKED",
      phase: "DATA_INVALID",
      error: `Room "${assignment.id}" (N=${QUESTIONS.length} câu) - achievableScores=[${feasibility.achievableScores.join(", ")}] không chứa cả 2 target (${FIRST_TARGET_SCORE}, ${REDO_TARGET_SCORE}) theo point CMS thật (khác pre-scan - có thể do is_swap hoặc CMS đổi nội dung giữa lúc pre-scan và lúc giao bài).`,
      evidence,
    });
  }
  const firstPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "target", targetScoreEnv: FIRST_TARGET_SCORE });
  const redoPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "target", targetScoreEnv: REDO_TARGET_SCORE });
  if (!firstPlan.achievable || !redoPlan.achievable) {
    // Không nên xảy ra (đã pass bothTargetsAchievable() ngay phía trên, cùng questions) - báo tường
    // minh thay vì throw ngoài dự kiến, giữ đúng "không đoán/không silently proceed".
    return finish({
      status: "BLOCKED",
      phase: "DATA_INVALID",
      error: `Không resolve được correctIndices cho target dù bothTargetsAchievable() đã PASS - firstPlan.achievable=${firstPlan.achievable} (${firstPlan.reason ?? "-"}), redoPlan.achievable=${redoPlan.achievable} (${redoPlan.reason ?? "-"}).`,
      evidence,
    });
  }
  const firstCorrectIndices = firstPlan.correctIndices;
  const redoCorrectIndices = redoPlan.correctIndices;
  const WANT_CORRECT = buildWeightedWantCorrectPlan(QUESTIONS, firstCorrectIndices);
  const rd = resolved.roomDetails;
  evidence.randomAssignment = {
    unitName: rd.unit_name,
    lessonName: rd.lesson_name,
    lessonItemId: rd.lesson_item_id,
    roomExamId: resolved.examId,
    roomId: assignment.id,
    title: assignment.title,
    startTimeVn: formatDMY(startVnYmd),
    dueTimeVn: formatDMY(dueVnYmd),
    classIds: assignment.classIds,
    questionCount: QUESTIONS.length,
    firstTargetScore: FIRST_TARGET_SCORE,
    redoTargetScore: REDO_TARGET_SCORE,
    achievableScores: feasibility.achievableScores,
    partialCount: PARTIAL_COUNT,
  };
  log(`  [PASS] N=${QUESTIONS.length} câu, achievableScores=[${feasibility.achievableScores.join(", ")}] (chứa cả ${FIRST_TARGET_SCORE} và ${REDO_TARGET_SCORE}), PARTIAL_COUNT=${PARTIAL_COUNT}.`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);
  const mcpSessionStartedAt = Date.now();

  try {
    evidence.mcpPerformance = {
      mcpSessionStartedAt: new Date(mcpSessionStartedAt).toISOString(),
      get runCallCount() { return bridge.runCallCount; },
      get hierarchyCallCount() { return bridge.hierarchyCallCount; },
      get totalMcpToolCalls() { return bridge.session.toolCallCount; },
      newMaestroProcessesSpawnedForThisPhase: 1,
    };

    // ===== [LOCATE] + [VERIFY] + [OPEN] - canonical locate+content-verify, cta=null (bất kỳ CTA
    // nào - "Làm bài"/"Chinh phục" tuỳ tier, đây là lần mở ĐẦU TIÊN của bài vừa giao) =====
    log('[LOCATE+VERIFY+OPEN] Tìm + mở + xác thực nội dung đúng room vừa giao...');
    const openOutcome = await locateOpenAndVerifyAssignment(bridge, { title: assignment.title, dueDateDM: dueDM, cta: null, questions: QUESTIONS, maxCandidates: MAX_DISAMBIGUATE_CANDIDATES });
    evidence.openDisambiguation = { ok: openOutcome.ok, status: openOutcome.status ?? "FOUND", triedLogLength: openOutcome.triedLog?.length ?? 0 };
    if (!openOutcome.ok) {
      const phaseMap = { NOT_FOUND: "CARD_NOT_FOUND", AMBIGUOUS_CONTENT_MATCH: "CARD_AMBIGUOUS", CONTENT_MISMATCH: "CARD_IDENTITY_MISMATCH", OPEN_STEP_FAILED: "EXERCISE_OPEN_FAILED", REOPEN_FAILED: "EXERCISE_OPEN_FAILED", ERROR: "EXERCISE_OPEN_FAILED" };
      return finish({
        status: openOutcome.status === "NOT_FOUND" || openOutcome.status === "CONTENT_MISMATCH" ? "FAIL" : "BLOCKED",
        phase: phaseMap[openOutcome.status] ?? "CARD_NOT_FOUND",
        error: `locateOpenAndVerifyAssignment() (mở lần đầu) status=${openOutcome.status}: title="${assignment.title}"/Hạn nộp=${dueDM} - không tự chọn/không đoán.`,
        diagnostics: openOutcome.diagnostics,
        triedLog: openOutcome.triedLog,
        evidence,
      });
    }
    log(`  [PASS] Đã vào ĐÚNG màn làm bài (nội dung khớp room_id=${assignment.id} thật, câu đầu id="${openOutcome.matched.id}").`);

    // ===== [PARTIAL] - trả lời ĐÚNG 3 câu đầu =====
    log(`[PARTIAL] Làm THẬT ${PARTIAL_COUNT} câu đầu (đúng/sai theo kế hoạch nhắm target=${FIRST_TARGET_SCORE}, N=${QUESTIONS.length})...`);
    const answeredIds = new Set();
    const partialLog = [];
    let carryTree = openOutcome.matched._snapshot?.tree ?? null;
    for (let i = 0; i < PARTIAL_COUNT; i++) {
      const pool = QUESTIONS.filter((q) => !answeredIds.has(q.id));
      const matchResult = await findMatchingQuestion(bridge, pool, carryTree, i + 1, null);
      if (matchResult.status !== "MATCHED") {
        const visibleTexts = collectAllTexts(await bridge.hierarchy());
        return finish({
          status: "FAIL",
          phase: matchResult.status === "AMBIGUOUS" ? "QUESTION_AMBIGUOUS" : "QUESTION_NOT_FOUND",
          error: `Không khớp được câu hỏi nào (còn ${pool.length} câu) với màn hình hiện tại. classification=${matchResult.diagnostic?.classification ?? matchResult.status}`,
          visibleTexts,
          diagnostic: matchResult.diagnostic ?? null,
          evidence,
        });
      }
      const matched = matchResult.question;
      const { wantCorrect, outcome } = await answerOneQuestion(exam, matched, false, WANT_CORRECT);
      carryTree = outcome.finalTree ?? null;
      answeredIds.add(matched.id);
      partialLog.push({ id: matched.id, question: matched.question, wantCorrect, isTargetCorrect: outcome.isTargetCorrect, type: outcome.type });
      log(`  Câu ${i + 1}/${PARTIAL_COUNT} (${matched.id}): "${matched.question}" - nhắm ${wantCorrect ? "ĐÚNG" : "SAI"}, isTargetCorrect=${outcome.isTargetCorrect}`);
    }
    evidence.partial = { questionsAnswered: answeredIds.size, questionsTotal: QUESTIONS.length, log: partialLog };

    // ===== [EXIT] =====
    log("[EXIT] Thoát giữa chừng bằng nút X (KHÔNG stopApp/launchApp)...");
    await exitToHomeworkList(bridge);
    log("  [PASS] Đã về lại homework_screen, CÙNG session app (không restart).");

    // ===== [LOCATE_REDO... không, đây là RESUME] - canonical locate+content-verify, cta="Tiếp tục"
    // (cùng hàm dùng cho mở lần đầu ở trên - chỉ khác cta). ok:true tự chứng minh CẢ 2 điều: (a)
    // progress đã đổi thật (tồn tại card cta="Tiếp tục" - nếu KHÔNG đổi, card vẫn "Làm bài"/"Chinh
    // phục", sẽ NOT_FOUND với target cta="Tiếp tục"), (b) đúng room (content-verify) =====
    log('[RESUME] Tìm + mở lại + xác thực đúng room (cta="Tiếp tục")...');
    const resumeOutcome = await locateOpenAndVerifyAssignment(bridge, { title: assignment.title, dueDateDM: dueDM, cta: "Tiếp tục", questions: QUESTIONS, maxCandidates: MAX_DISAMBIGUATE_CANDIDATES });
    if (!resumeOutcome.ok) {
      const phaseMap = { NOT_FOUND: "RESUME_INVALID", AMBIGUOUS_CONTENT_MATCH: "RESUME_INVALID", CONTENT_MISMATCH: "RESUME_INVALID", OPEN_STEP_FAILED: "RESUME_INVALID", REOPEN_FAILED: "RESUME_INVALID", ERROR: "RESUME_INVALID" };
      return finish({
        status: "FAIL",
        phase: phaseMap[resumeOutcome.status] ?? "RESUME_INVALID",
        error: `locateOpenAndVerifyAssignment() (resume) status=${resumeOutcome.status}: title="${assignment.title}"/Hạn nộp=${dueDM}/cta="Tiếp tục" - card KHÔNG tìm lại được đúng, không đoán.`,
        diagnostics: resumeOutcome.diagnostics,
        triedLog: resumeOutcome.triedLog,
        evidence,
      });
    }
    evidence.progressChanged = { confirmedByResumeLocate: true };
    log(`  [PASS] Resume: card cta="Tiếp tục" tìm thấy + nội dung khớp room_id=${assignment.id} thật.`);

    // Verify resume vào ĐÚNG câu TIẾP THEO (chưa làm), KHÔNG phải reset về câu đã làm ở PARTIAL -
    // logic verify này GIỮ NGUYÊN (No-regression boundary) - locateOpenAndVerifyAssignment() chỉ
    // xác nhận "đúng room", KHÔNG xác nhận "đúng vị trí câu hỏi trong room" (2 việc khác nhau).
    const remainingPool = QUESTIONS.filter((q) => !answeredIds.has(q.id));
    const answeredPool = QUESTIONS.filter((q) => answeredIds.has(q.id));
    const matchedAfterResume = remainingPool.some((q) => q.id === resumeOutcome.matched.id) ? resumeOutcome.matched : null;
    if (!matchedAfterResume) {
      const isAlreadyAnswered = answeredPool.some((q) => q.id === resumeOutcome.matched.id);
      return finish({
        status: "FAIL",
        phase: "RESUME_INVALID",
        error: isAlreadyAnswered
          ? `RESUME_NOT_RESET FAIL: màn hình sau resume khớp câu "${resumeOutcome.matched.id}" - câu NÀY ĐÃ ĐƯỢC TRẢ LỜI ở PHASE PARTIAL, bằng chứng app RESET về câu cũ thay vì resume đúng câu đang dở.`
          : `Câu khớp sau resume ("${resumeOutcome.matched.id}") không thuộc pool chưa làm lẫn đã làm - không nhất quán.`,
        evidence,
      });
    }
    evidence.resume = { sameAssignment: true, resumedAtQuestionId: matchedAfterResume.id, resumedAtQuestion: matchedAfterResume.question, isAlreadyAnsweredQuestion: false };
    log(`  [PASS] Resume đúng vào câu "${matchedAfterResume.id}", KHÔNG phải câu đã làm ở PARTIAL.`);

    // ===== [COMPLETE_FIRST_ATTEMPT] - làm tiếp tất cả câu còn lại =====
    log("[COMPLETE_FIRST_ATTEMPT] Làm tiếp tất cả câu còn lại...");
    const resumeLog = [];
    let lastOutcome = null;
    carryTree = matchedAfterResume._snapshot?.tree ?? null;
    while (answeredIds.size < QUESTIONS.length) {
      const pool = QUESTIONS.filter((q) => !answeredIds.has(q.id));
      const matchResult = await findMatchingQuestion(bridge, pool, carryTree, answeredIds.size + 1, null);
      const matched = matchResult.status === "MATCHED" ? matchResult.question : null;
      if (!matched) {
        return finish({
          status: "FAIL",
          phase: matchResult.status === "AMBIGUOUS" ? "QUESTION_AMBIGUOUS" : "QUESTION_NOT_FOUND",
          error: `Không khớp được câu hỏi nào (còn ${pool.length} câu) với màn hình hiện tại. classification=${matchResult.diagnostic?.classification ?? matchResult.status}`,
          visibleTexts: collectAllTexts(await bridge.hierarchy()),
          diagnostic: matchResult.diagnostic ?? null,
          evidence: { ...evidence, resumeLog },
        });
      }
      const isLast = answeredIds.size === QUESTIONS.length - 1;
      const { wantCorrect, outcome } = await answerOneQuestion(exam, matched, isLast, WANT_CORRECT);
      lastOutcome = outcome;
      carryTree = outcome.finalTree ?? null;
      answeredIds.add(matched.id);
      resumeLog.push({ id: matched.id, question: matched.question, wantCorrect, isTargetCorrect: outcome.isTargetCorrect, type: outcome.type });
      log(`  Câu ${answeredIds.size}/${QUESTIONS.length} (${matched.id}): "${matched.question}" - nhắm ${wantCorrect ? "ĐÚNG" : "SAI"}, isTargetCorrect=${outcome.isTargetCorrect}`);
    }
    evidence.resumeLog = resumeLog;

    // ===== [VERIFY_FIRST_RESULT] =====
    log("[VERIFY_FIRST_RESULT] Xác nhận màn Kết quả (lần 1) + đọc điểm thật...");
    const finalTree = lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(finalTree)) {
      return finish({ status: "FAIL", phase: "FIRST_SCORE_MISMATCH", error: "Không thấy màn hình Kết quả sau khi trả lời hết toàn bộ câu.", evidence });
    }
    const result = exam.readResult(finalTree);
    evidence.result = result;
    log(`  ĐIỂM SỐ=${result.score} CHÍNH XÁC=${result.correct}`);

    const scoreNumber = result.score === null ? null : Number(result.score);
    const firstMatched = scoreNumber !== null && !Number.isNaN(scoreNumber) && Math.abs(scoreNumber - FIRST_TARGET_SCORE) < 1e-6;
    evidence.firstAttempt = { targetScore: FIRST_TARGET_SCORE, actualScore: scoreNumber, correct: result.correct, matched: firstMatched };
    if (!firstMatched) {
      return finish({ status: "FAIL", phase: "FIRST_SCORE_MISMATCH", error: `Điểm thật ${scoreNumber} KHÁC target ${FIRST_TARGET_SCORE}.`, evidence });
    }
    log(`  [PASS] TARGET=${FIRST_TARGET_SCORE} ĐIỂM THẬT=${scoreNumber} khớp.`);

    // Đóng màn Kết quả lần 1 để về danh sách - chỉ vừa giao ĐÚNG 1 bài nên không có "Tiếp theo"
    // thật để làm, xử lý "Hoàn thành" là chính (workaround đóng X cho "Tiếp theo" chỉ để an toàn) -
    // CTA CUỐI (sau Làm lại) mới bắt buộc bấm CTA THẬT.
    await bridge.runSteps([
      { runFlow: { when: { visible: "Hoàn thành" }, commands: [{ tapOn: { text: ".*(Hoàn thành).*" } }] } },
      { runFlow: { when: { visible: "Tiếp theo" }, commands: [{ tapOn: { id: "exercise_result_close_button" } }] } },
    ]);
    await bridge.wait({ id: "homework_screen" }, { timeout: 30000 });
    log("  [PASS] Đã đóng màn Kết quả (lần 1), về lại danh sách Bài tập.");

    // ===== [LOCATE_REDO] + [VERIFY_REDO] - canonical locate+content-verify, cta="Làm lại" =====
    log('[LOCATE_REDO+VERIFY_REDO] Tìm + mở + xác thực đúng room để "Làm lại"...');
    const redoOpenOutcome = await locateOpenAndVerifyAssignment(bridge, { title: assignment.title, dueDateDM: dueDM, cta: "Làm lại", questions: QUESTIONS, maxCandidates: MAX_DISAMBIGUATE_CANDIDATES });
    if (!redoOpenOutcome.ok) {
      const phaseMap = { NOT_FOUND: "REDO_CARD_NOT_FOUND", AMBIGUOUS_CONTENT_MATCH: "REDO_CARD_AMBIGUOUS", CONTENT_MISMATCH: "REDO_IDENTITY_MISMATCH", OPEN_STEP_FAILED: "REDO_IDENTITY_MISMATCH", REOPEN_FAILED: "REDO_IDENTITY_MISMATCH", ERROR: "REDO_IDENTITY_MISMATCH" };
      return finish({
        status: redoOpenOutcome.status === "NOT_FOUND" ? "FAIL" : "BLOCKED",
        phase: phaseMap[redoOpenOutcome.status] ?? "REDO_CARD_NOT_FOUND",
        error: `locateOpenAndVerifyAssignment() (Làm lại) status=${redoOpenOutcome.status}: title="${assignment.title}"/Hạn nộp=${dueDM}/cta="Làm lại" - không tự chọn/không đoán.`,
        diagnostics: redoOpenOutcome.diagnostics,
        triedLog: redoOpenOutcome.triedLog,
        evidence,
      });
    }
    evidence.lamLaiTapped = true;
    log(`  [PASS] Đã tap "Làm lại" - vào màn Doing (lần 2), nội dung khớp room_id=${assignment.id} thật.`);

    // ===== [REDO] - CÙNG vòng lặp findMatchingQuestion+answerCurrentQuestionOneShot đã dùng ở
    // PARTIAL/COMPLETE_FIRST_ATTEMPT, KHÔNG viết matcher/answer logic mới =====
    log(`[REDO] Trả lời lại ${QUESTIONS.length} câu, nhắm điểm ${REDO_TARGET_SCORE}...`);
    const redoWantCorrect = buildWeightedWantCorrectPlan(QUESTIONS, redoCorrectIndices);
    const redoAnsweredIds = new Set();
    const redoLog = [];
    let redoCarryTree = redoOpenOutcome.matched._snapshot?.tree ?? null;
    let redoLastOutcome = null;
    while (redoAnsweredIds.size < QUESTIONS.length) {
      const pool = QUESTIONS.filter((q) => !redoAnsweredIds.has(q.id));
      const matchResult = await findMatchingQuestion(bridge, pool, redoCarryTree, redoAnsweredIds.size + 1, null);
      if (matchResult.status !== "MATCHED") {
        return finish({
          status: "FAIL",
          phase: matchResult.status === "AMBIGUOUS" ? "QUESTION_AMBIGUOUS" : "QUESTION_NOT_FOUND",
          error: `Không khớp được câu hỏi nào (còn ${pool.length} câu) khi Làm lại. classification=${matchResult.diagnostic?.classification ?? matchResult.status}`,
          visibleTexts: collectAllTexts(await bridge.hierarchy()),
          diagnostic: matchResult.diagnostic ?? null,
          evidence: { ...evidence, redoLog },
        });
      }
      const matched = matchResult.question;
      const isLast = redoAnsweredIds.size === QUESTIONS.length - 1;
      const { wantCorrect, outcome } = await answerOneQuestion(exam, matched, isLast, redoWantCorrect);
      redoLastOutcome = outcome;
      redoCarryTree = outcome.finalTree ?? null;
      redoAnsweredIds.add(matched.id);
      redoLog.push({ id: matched.id, question: matched.question, wantCorrect, isTargetCorrect: outcome.isTargetCorrect, type: outcome.type });
      log(`  Câu ${redoAnsweredIds.size}/${QUESTIONS.length} (${matched.id}): "${matched.question}" - nhắm ${wantCorrect ? "ĐÚNG" : "SAI"}, isTargetCorrect=${outcome.isTargetCorrect}`);
    }
    evidence.redoLog = redoLog;

    // ===== [VERIFY_SECOND_RESULT] =====
    const redoFinalTree = redoLastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(redoFinalTree)) {
      return finish({ status: "FAIL", phase: "SECOND_SCORE_MISMATCH", error: "Không thấy màn Kết quả sau khi trả lời hết câu (Làm lại).", evidence });
    }
    const redoResult = exam.readResult(redoFinalTree);
    const redoScoreNumber = redoResult.score === null ? null : Number(redoResult.score);
    const redoMatched = redoScoreNumber !== null && !Number.isNaN(redoScoreNumber) && Math.abs(redoScoreNumber - REDO_TARGET_SCORE) < 1e-6;
    evidence.redoAttempt = { targetScore: REDO_TARGET_SCORE, actualScore: redoScoreNumber, correct: redoResult.correct, matched: redoMatched };
    log(`  TARGET=${REDO_TARGET_SCORE} ĐIỂM THẬT=${redoResult.score} CHÍNH XÁC=${redoResult.correct}`);
    if (!redoMatched) {
      return finish({ status: "FAIL", phase: "SECOND_SCORE_MISMATCH", error: `Điểm thật ${redoScoreNumber} KHÁC target ${REDO_TARGET_SCORE}.`, evidence });
    }

    // ===== [FINAL_CTA] - đọc CTA THẬT đang hiển thị rồi bấm THẬT (KHÔNG dùng workaround đóng X ở
    // màn Kết quả CUỐI này) =====
    log('[FINAL_CTA] Đọc CTA thật đang hiển thị trên màn Kết quả (Tiếp theo/Hoàn thành) rồi bấm THẬT...');
    const ctaTexts = collectAllTexts(redoFinalTree);
    const hasTiepTheo = ctaTexts.some((t) => /Tiếp theo/.test(t));
    const hasHoanThanh = ctaTexts.some((t) => /Hoàn thành/.test(t));
    if (!hasTiepTheo && !hasHoanThanh) {
      return finish({ status: "FAIL", phase: "CTA_INVALID", error: `Không thấy CTA "Tiếp theo" lẫn "Hoàn thành" trên màn Kết quả sau Làm lại. Texts: ${JSON.stringify(ctaTexts)}`, evidence });
    }
    const ctaToTap = hasTiepTheo ? "Tiếp theo" : "Hoàn thành";
    const tapFinalCta = await bridge.runSteps([{ tapOn: { text: `.*(${ctaToTap}).*` } }]);
    if (!tapFinalCta.success) {
      return finish({ status: "FAIL", phase: "CTA_INVALID", error: `Tap "${ctaToTap}" thất bại: ${tapFinalCta.error}`, evidence });
    }
    const landExpectation = ctaToTap === "Tiếp theo" ? { id: "exercise_close_button" } : { id: "homework_screen" };
    const landResult = await bridge.wait(landExpectation, { timeout: 30000 });
    evidence.finalCta = { cta: ctaToTap, landed: landResult.success };
    if (!landResult.success) {
      return finish({ status: "FAIL", phase: "CTA_INVALID", error: `Bấm "${ctaToTap}" nhưng không xác nhận được điều hướng đúng (${JSON.stringify(landExpectation)}): ${landResult.error}`, evidence });
    }
    log(`  [PASS] Đã bấm THẬT "${ctaToTap}" - điều hướng đúng.`);

    const overallPass =
      evidence.progressChanged?.confirmedByResumeLocate &&
      evidence.resume &&
      !evidence.resume.isAlreadyAnsweredQuestion &&
      answeredIds.size === QUESTIONS.length &&
      firstMatched &&
      redoAnsweredIds.size === QUESTIONS.length &&
      redoMatched &&
      landResult.success;

    return finish({
      status: overallPass ? "PASS" : "FAIL",
      phase: overallPass ? null : "FINAL_VERIFY",
      evidence,
    });
  } finally {
    await bridge.stop();
    log("[MCP] Đã dừng tiến trình `maestro mcp` (cleanup cuối flow).");
  }
}

main()
  .then((result) => {
    log(`\n=== KẾT QUẢ: ${result.status}${result.phase ? ` (phase=${result.phase})` : ""} ===`);
    log(`Đã ghi report ra ${OUTPUT_FILE}`);
    process.exit(result.status === "PASS" ? 0 : 1);
  })
  .catch((err) => {
    console.error("\n[e2e-teacher-assign-partial-resume-scored] Dừng lại vì lỗi ngoài dự kiến:\n");
    console.error(err);
    finish({ status: "ERROR", error: err.message, stack: err.stack });
    process.exit(2);
  });
