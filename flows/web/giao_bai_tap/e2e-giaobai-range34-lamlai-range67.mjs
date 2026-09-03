#!/usr/bin/env node
/**
 * E2E-GiaoBai-Range34-LamLai-Range67
 *
 * Case theo yêu cầu (2026-09-03): "giao bài tập -> làm bài đạt khoảng 3-4đ -> Màn kết quả -> bấm
 * 'Làm lại' -> Làm lại với điểm 6-7đ. Output: ghi lại chi tiết thời gian làm bài từ lúc vào bài ->
 * màn kết quả ở mỗi lần làm".
 *
 * GHÉP từ code đã verify, KHÔNG viết engine mới (đúng [[feedback_reuse_first_workflow]]):
 *   - Assign (Web GV, Playwright) + locate/mở bài lần đầu + vòng lặp trả lời/đọc điểm + tìm lại
 *     card "Làm lại" + CTA màn Kết quả cuối: COPY NGUYÊN cấu trúc từ
 *     flows/web/giao_bai_tap/e2e-giaobai-profilehientai-diem3-lamlai-diem8.mjs (case gần nhất cùng
 *     hình dạng "giao 1 bài -> làm điểm A -> Làm lại điểm B") - KHÁC 3 điểm:
 *     1. Target score là 1 RANGE (~3-4 và ~6-7), không phải 1 giá trị cố định (3 và 8) - dùng lại
 *        NGUYÊN VĂN resolveScoringPlanForCandidate(mode:"range")/buildScoringPlan() ĐÃ EXPORT từ
 *        flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs (import trực tiếp,
 *        KHÔNG copy-paste lại subset-sum engine lần 2 - file gốc đã có 2 vòng sửa lỗi null-handling/
 *        round-trip epsilon, xem docblock tại đó).
 *     2. Profile: mặc định fallback là [[feedback_default_test_account_tranduyanh]] (PHONE=
 *        0915151519, profile "Trần Duy Anh", lớp "7QA-Test") CHỈ khi env không truyền gì - NHƯNG
 *        theo [[feedback_keep_active_profile_for_giao_bai]] (standing rule, xác nhận lại 2026-09-03
 *        qua 1 lần FAIL thật: device đang login account Gia Linh/Ngoc/QA Auto Child, tap "Chuyển
 *        profile" -> "Trần Duy Anh" fail "Element not found" vì khác account hẳn, "Chuyển profile"
 *        chỉ liệt kê profile CÙNG account), ensureProfileActive() ở đây là VERIFY-ONLY (giống
 *        verifyActiveProfileNoSwitch() của case gốc) - KHÔNG BAO GIỜ tự tap "Chuyển profile" - BLOCK
 *        rõ nếu PROFILE_NAME truyền vào không khớp profile đang active. Caller LUÔN PHẢI đọc hierarchy
 *        thật trước rồi truyền đúng PROFILE_NAME/PHONE/OTP/TARGET_CLASS_NAME/TARGET_CLASS_ID của
 *        profile đang active, không dựa vào default.
 *     3. THÊM đo thời gian chi tiết mỗi lượt làm bài (từ lúc vào màn Doing - id=exercise_close_
 *        button visible - đến lúc xác nhận màn Kết quả) + breakdown từng câu (match/answer) - COPY
 *        pattern `timed()` + phaseE profiling của automation/bai_tap/pro_lamlai_target_score.mjs
 *        (KHÔNG viết cơ chế đo thời gian mới).
 *
 *   - Prescan chọn candidate: khác pickCandidateAchievingBothScores() gốc (dùng buildScoringPlan()
 *     nội bộ để check "đạt được ĐÚNG 2 giá trị điểm cố định") - bản này chỉ cần "đạt được ÍT NHẤT 1
 *     điểm khả thi trong MỖI range" (dùng resolveScoringPlanForCandidate(mode:"range") export - trả
 *     `achievable:false` nếu range rỗng), KHÔNG giữ target score cụ thể từ prescan (prescan chỉ lọc
 *     CANDIDATE nào dùng được, không lọc theo 1 điểm số cụ thể) - target score THẬT được random LẠI
 *     từ nội dung QUESTIONS THẬT sau khi resolve room (bước [ASSIGN]), tránh hẳn lớp bug "examId
 *     catalog vs room lệch nhau" (xem [[project_teacher_materials_examid_order_mismatch]]) mà không
 *     cần bước re-validate mode="target" riêng như target5.mjs (vì target score chưa từng được chọn
 *     trước khi có QUESTIONS thật).
 *
 * AN TOÀN: CHỈ giao ĐÚNG 1 bài (không giao thêm nếu BLOCKED/NO_MATCH giữa chừng).
 *
 * ENV: APP_ID (.env), TEACHER_ACCESS_TOKEN/EXAM_COOKIE (.env, get_teacher_token.sh/get_tokens.sh),
 *   PHONE/OTP (default "0915151519"/"888888" - [[feedback_default_test_account_tranduyanh]]),
 *   MAESTRO_DEVICE, TARGET_CLASS_NAME (default "7QA-Test"), TARGET_CLASS_ID (default
 *   "da3efdea-e0ea-4627-b119-a11c329d3d4e"), PROFILE_NAME (default "Trần Duy Anh"),
 *   FIRST_SCORE_MIN/FIRST_SCORE_MAX (default 3/4), REDO_SCORE_MIN/REDO_SCORE_MAX (default 6/7),
 *   ASSIGN_DUE_DATE_DAYS_AHEAD (default 7), MAX_CANDIDATE_PRESCAN_ATTEMPTS (default 40).
 *
 * CHẠY: node flows/web/giao_bai_tap/e2e-giaobai-range34-lamlai-range67.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parseEnvFile } from "../../../automation/src/config.js";
import { MaestroMcpBridge } from "../../../automation/bridge/maestroMcpBridge.js";
import { HomeworkExamEngine } from "../../../automation/bai_tap/navigation/homeworkExamEngine.js";
import {
  fetchEligibleAssignmentTree,
  findRoomIdByLessonItem,
} from "../../../automation/giao_bai_tap/navigation/teacherAssignmentApiDiscovery.js";
import { assignHomeworkFlow } from "../../../automation/giao_bai_tap/runtime/assignHomeworkFlow.js";
import { parseQuestionsFromExamPage } from "../../../automation/discovery/examPageScraper.js";
import { normalizeQuestions } from "../../../automation/model/questionModel.js";
import { resolveHomeworkExamQuestionsForRoomId } from "../../../automation/bai_tap/discovery/teacherMaterialsExamResolver.js";
import { findAssignment, scrollToTop, tapFoundCard } from "../../../automation/bai_tap/discovery/findAssignment.js";
import { locateSpecificCompletedCandidate } from "../../../automation/bai_tap/discovery/locateCompletedCandidate.js";
import { centerPoint } from "../../../automation/bai_tap/discovery/homeworkUiList.js";
import { findMatchingQuestion } from "../../../automation/bai_tap/discovery/answerSetMatcher.js";
import { resolveScoringPlanForCandidate, buildWeightedWantCorrectPlan } from "./e2e-teacher-assign-full-scored-target5.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "e2e_giaobai_range34_lamlai_range67_report.json");
const EXAM_SESSION_PATH = join(PROJECT_ROOT, "automation", ".cache", "exam_session.json");
const ROOT_ENV = parseEnvFile(join(PROJECT_ROOT, ".env"));

const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
// [[feedback_default_test_account_tranduyanh]] - KHÔNG đọc test_data/accounts.env (PHONE mặc định ở
// đó là 0915775115/profile Gia Linh-Ngoc, SAI tài khoản cho lớp "7QA-Test" bên dưới - xem
// [[project_target5_script_env_defaults_wrong_account]]).
const PHONE = process.env.PHONE || "0915151519";
const OTP = process.env.OTP || "888888";
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const TARGET_CLASS_NAME = process.env.TARGET_CLASS_NAME || "7QA-Test";
const TARGET_CLASS_ID = process.env.TARGET_CLASS_ID || "da3efdea-e0ea-4627-b119-a11c329d3d4e";
const PROFILE_NAME = process.env.PROFILE_NAME || "Trần Duy Anh";
const FIRST_SCORE_MIN = Number(process.env.FIRST_SCORE_MIN ?? 3);
const FIRST_SCORE_MAX = Number(process.env.FIRST_SCORE_MAX ?? 4);
const REDO_SCORE_MIN = Number(process.env.REDO_SCORE_MIN ?? 6);
const REDO_SCORE_MAX = Number(process.env.REDO_SCORE_MAX ?? 7);
const ASSIGN_DUE_DATE_DAYS_AHEAD = Number(process.env.ASSIGN_DUE_DATE_DAYS_AHEAD || 7);
const MAX_CANDIDATE_PRESCAN_ATTEMPTS = Number(process.env.MAX_CANDIDATE_PRESCAN_ATTEMPTS || 40);
const MAX_LOCATE_SCROLLS = 60;

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

function addDaysDdMmYyyy(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function toDM(ddmmyyyy) {
  return ddmmyyyy.slice(0, 5);
}

function toIsoDatePrefix(ddmmyyyy) {
  const [dd, mm, yyyy] = ddmmyyyy.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

/** COPY từ automation/bai_tap/pro_lamlai_target_score.mjs#now()/timed() - đo thời gian mỗi bước
 * KHÔNG viết cơ chế đo mới. */
function now() {
  return Date.now();
}
async function timed(fn) {
  const startedAt = now();
  const result = await fn();
  const endedAt = now();
  return { result, startedAt, endedAt, durationMs: endedAt - startedAt };
}

/** COPY từ e2e-giaobai-profilehientai-diem3-lamlai-diem8.mjs#flattenNonSpeak(). */
function flattenNonSpeak(eligibleTree) {
  const flat = [];
  for (const u of eligibleTree) {
    for (const l of u.lessons) {
      if (!l.lessonTag) continue;
      for (const it of l.items) {
        if (it.isSpeak) continue;
        if (!Array.isArray(it.examIds) || it.examIds.length !== 1) continue;
        flat.push({ unitName: u.unitName, lessonName: l.lessonName, lessonTag: l.lessonTag, itemName: it.name, itemId: it.id, examId: it.examIds[0] });
      }
    }
  }
  return flat;
}

/** COPY từ automation/bai_tap/pro_lamlai_target_score.mjs#isTextChoiceCompatible(). */
function isTextChoiceCompatible(questions) {
  if (!Array.isArray(questions) || questions.length < 3) return false;
  return questions.every((q) => {
    const nonEmptyAnswers = (q.answers ?? []).filter((a) => typeof a === "string" && a.trim().length > 0);
    return nonEmptyAnswers.length >= 2 && q.correctAnswer && nonEmptyAnswers.includes(q.correctAnswer);
  });
}

/** ===================== [ASSIGN-PRESCAN] chọn 1 candidate mà CẢ 2 range điểm đều có ÍT NHẤT 1 điểm
 * khả thi =====================
 * KHÁC bản gốc (pickCandidateAchievingBothScores() của e2e-giaobai-profilehientai-diem3-lamlai-
 * diem8.mjs check "đạt đúng 2 giá trị cố định"): ở đây chỉ cần range không rỗng - dùng lại
 * resolveScoringPlanForCandidate(mode:"range") export từ target5.mjs, KHÔNG re-implement subset-sum. */
async function pickCandidateAchievingBothRanges(pool, { maxAttempts }) {
  const distinctByName = [...new Map(pool.map((c) => [c.itemName, c])).values()];
  log(`  [DISCOVERY] distinct itemName sau dedupe: ${distinctByName.length}`);
  const order = shuffle(distinctByName);
  const attempts = [];
  for (let i = 0; i < order.length && attempts.length < maxAttempts; i++) {
    const cand = order[i];
    let questions = null;
    let reason = null;
    try {
      const examData = await parseQuestionsFromExamPage(cand.examId);
      questions = normalizeQuestions(examData);
    } catch (err) {
      reason = err.message;
    }
    if (!questions) {
      attempts.push({ itemName: cand.itemName, ok: false, reason: reason ?? "parseQuestionsFromExamPage lỗi." });
      log(`  [PRESCAN] "${cand.itemName}": loại (${attempts[attempts.length - 1].reason})`);
      continue;
    }
    if (!isTextChoiceCompatible(questions)) {
      attempts.push({ itemName: cand.itemName, ok: false, reason: "UNSUPPORTED_TYPE_OR_MISSING_CORRECT_ANSWER (SPEAK/CONNECT/DRAG_DROP/...)" });
      log(`  [PRESCAN] "${cand.itemName}": loại (${attempts[attempts.length - 1].reason})`);
      continue;
    }
    const firstProbe = resolveScoringPlanForCandidate(questions, { mode: "range", rangeMin: FIRST_SCORE_MIN, rangeMax: FIRST_SCORE_MAX });
    const redoProbe = resolveScoringPlanForCandidate(questions, { mode: "range", rangeMin: REDO_SCORE_MIN, rangeMax: REDO_SCORE_MAX });
    if (!firstProbe.achievable || !redoProbe.achievable) {
      const reasonStr = `first[${FIRST_SCORE_MIN},${FIRST_SCORE_MAX}]=${firstProbe.achievable ? "OK" : "NONE"} redo[${REDO_SCORE_MIN},${REDO_SCORE_MAX}]=${redoProbe.achievable ? "OK" : "NONE"} (điểm khả thi thật: ${(firstProbe.achievableScores ?? redoProbe.achievableScores ?? []).join(", ")})`;
      attempts.push({ itemName: cand.itemName, ok: false, reason: reasonStr });
      log(`  [PRESCAN] "${cand.itemName}": loại (${reasonStr})`);
      continue;
    }
    attempts.push({ itemName: cand.itemName, ok: true, totalScoredItems: questions.length });
    log(`  [PRESCAN] "${cand.itemName}": PASS (${questions.length} scored items) - cả 2 range điểm đều khả thi.`);
    return { picked: cand, attempts };
  }
  return { picked: null, attempts };
}

/** COPY từ automation/bai_tap/pro_lamlai_target_score.mjs#refreshExamSessionFromEnvCookie(). */
function refreshExamSessionFromEnvCookie() {
  const examCookie = process.env.EXAM_COOKIE || ROOT_ENV.EXAM_COOKIE;
  if (!examCookie) {
    return { refreshed: false, reason: "EXAM_COOKIE không tồn tại trong .env - chạy get_tokens.sh trước." };
  }
  const session = { examOrigin: "https://exam.parrotedu.vn", cookieHeader: `Bearer=${examCookie}`, localStorage: {} };
  mkdirSync(dirname(EXAM_SESSION_PATH), { recursive: true });
  writeFileSync(EXAM_SESSION_PATH, JSON.stringify(session, null, 2), "utf8");
  return { refreshed: true };
}

function collectAllTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectAllTexts(c, acc);
  return acc;
}

/** ===================== PROFILE (KHÔNG switch/logout chủ động - [[feedback_keep_active_profile_for_giao_bai]])
 * =====================
 * SỬA 2026-09-03 (FAIL thật xác nhận qua run trước): bản đầu cho phép tự "Chuyển profile" sang
 * PROFILE_NAME hardcoded - vi phạm standing rule "never switch/log out proactively, keep whatever
 * profile/account is CURRENTLY logged into the app" (bottom sheet "Chuyển profile học tập" chỉ liệt
 * kê profile CÙNG 1 account - tap "Trần Duy Anh" fail với "Element not found" vì device đang đăng
 * nhập account KHÁC hẳn, có 3 profile Gia Linh/Ngoc/QA Auto Child, không phải account chứa "Trần Duy
 * Anh"). Đổi lại thành VERIFY-ONLY (giống verifyActiveProfileNoSwitch() của e2e-giaobai-
 * profilehientai-diem3-lamlai-diem8.mjs) - BLOCK báo rõ nếu PROFILE_NAME không active, KHÔNG tự
 * chuyển. Caller phải truyền đúng PROFILE_NAME/PHONE/OTP/TARGET_CLASS_NAME/TARGET_CLASS_ID của
 * profile ĐANG active trên thiết bị (đọc hierarchy trước khi chạy). */
async function ensureProfileActive(bridge) {
  const login = await bridge.runSteps([
    { launchApp: { permissions: { all: "allow" } } },
    { extendedWaitUntil: { visible: { text: ".*(Đăng nhập|Vui học|Bài tập|Báo cáo).*" }, timeout: 30000 } },
    {
      runFlow: {
        when: { visible: ".*(Chào mừng bạn đến với ParrotEdu!|Nhập số điện thoại).*" },
        commands: [
          { tapOn: { text: ".*(Nhập số điện thoại).*" } },
          { inputText: PHONE },
          "hideKeyboard",
          { tapOn: { text: "Đăng nhập" } },
          { extendedWaitUntil: { visible: { text: ".*(Xác thực OTP).*" }, timeout: 30000 } },
          { tapOn: { below: "Đổi số điện thoại", above: "Xác nhận" } },
          { inputText: OTP },
          "hideKeyboard",
          { runFlow: { when: { visible: ".*(Xác nhận).*" }, commands: [{ tapOn: { text: ".*(Xác nhận).*" } }] } },
          { extendedWaitUntil: { visible: { text: ".*(Vui học|Bài tập|Báo cáo).*" }, timeout: 60000 } },
        ],
      },
    },
    { extendedWaitUntil: { visible: ".*(Vui học|Bài tập|Báo cáo).*", timeout: 30000 } },
    { tapOn: { text: "Bài tập" } },
    { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao|Bạn không có bài tập nào đang chờ|2 tuần gần nhất|1 tháng gần nhất).*" }, timeout: 30000 } },
  ]);
  if (!login.success) throw new Error(`Không mở được tab "Bài tập": ${login.error}`);

  const treeBefore = await bridge.hierarchy();
  const texts = collectAllTexts(treeBefore);
  const alreadyActive = texts.some((t) => new RegExp(`.*(${PROFILE_NAME.replace(/[.*+?^()|[\]\\]/g, (m) => "\\" + m)}).*`).test(t));
  if (!alreadyActive) {
    return { active: false, texts };
  }
  log(`  [PROFILE] Hồ sơ "${PROFILE_NAME}" xác nhận đang active - KHÔNG chuyển (standing rule).`);
  return { active: true, texts };
}

function finish(result) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  return result;
}

function fmtSec(ms) {
  return ms == null ? "-" : `${(ms / 1000).toFixed(2)}s`;
}

function printReport(r) {
  const e = r.evidence ?? {};
  log(`\n[PROFILE]`);
  log(`profile=${PROFILE_NAME} (không switch) active_confirmed=${e.profileActive ? "YES" : "NO"}`);
  log(`\n[ASSIGN]`);
  log(`class=${TARGET_CLASS_NAME}`);
  log(`item=${e.picked?.itemName ?? "-"}`);
  log(`room_id=${e.roomId ?? "-"}`);
  log(`total_scored_items=${e.totalScoredItems ?? "-"}`);

  for (const [label, key] of [["FIRST ATTEMPT (~3-4đ)", "firstAttempt"], ["LAM LAI - SECOND ATTEMPT (~6-7đ)", "redoAttempt"]]) {
    const a = e[key];
    log(`\n[${label}]`);
    if (!a) {
      log(`(chưa tới bước này)`);
      continue;
    }
    log(`target_score_range=${a.targetScoreRange}`);
    log(`target_score_chosen=${a.targetScore}`);
    log(`actual_score=${a.actualScore ?? "-"}`);
    log(`matched=${a.matched ? "YES" : "NO"}`);
    const t = a.timing;
    if (t) {
      log(`  [TIMING] vào bài (Doing) -> màn Kết quả: ${fmtSec(t.durationMs)}  (started=${t.startedAtIso}, ended=${t.endedAtIso})`);
      for (const q of t.perQuestion ?? []) {
        log(`    Câu ${q.index}/${t.perQuestion.length}: total=${fmtSec(q.durationMs)} (match=${fmtSec(q.matchDurationMs)}, answer=${fmtSec(q.answerDurationMs)}) wantCorrect=${q.wantCorrect} isTargetCorrect=${q.isTargetCorrect}`);
      }
    }
  }

  log(`\n[FINAL RESULT CTA]`);
  log(`cta_tapped=${e.finalCta?.cta ?? "-"}`);
  log(`landed=${e.finalCta?.landed ?? "-"}`);
  log(`\n[PERFORMANCE]`);
  log(`duration=${e.totalDurationSeconds != null ? `${e.totalDurationSeconds.toFixed(1)}s` : "-"}`);
  log(`\n[OVERALL]`);
  log(r.status);
  log(`\n[ROOT_CAUSE]`);
  log(r.status === "PASS" ? "-" : (r.error ?? r.phase ?? "-"));
}

/** Vòng lặp trả lời TOÀN BỘ questions theo correctIndices - COPY tinh thần phase [E] của
 * pro_lamlai_target_score.mjs (findMatchingQuestion + answerCurrentQuestionOneShot), tách thành
 * hàm dùng lại được cho CẢ lượt làm đầu lẫn lượt "Làm lại" - THÊM `timed()` mỗi câu (yêu cầu mới:
 * "ghi lại chi tiết thời gian làm bài"), KHÁC bản diem3-lamlai-diem8.mjs (không có profiling này). */
async function answerAllQuestions(bridge, exam, questions, correctIndices) {
  const wantCorrectMap = buildWeightedWantCorrectPlan(questions, correctIndices);
  const answeredIds = new Set();
  const answerLog = [];
  const perQuestion = [];
  let carryTree = null;
  let lastOutcome = null;
  while (answeredIds.size < questions.length) {
    const questionIndex = answeredIds.size + 1;
    const pool = questions.filter((q) => !answeredIds.has(q.id));
    const matchT = await timed(() => findMatchingQuestion(bridge, pool, carryTree, questionIndex));
    const matchResult = matchT.result;
    if (matchResult.status !== "MATCHED") {
      const outcomeLabel = matchResult.status === "AMBIGUOUS" ? "AMBIGUOUS_MATCH" : "NO_MATCH";
      return {
        ok: false,
        reason:
          matchResult.status === "AMBIGUOUS"
            // FIX (2026-09-03, ERROR thật xác nhận qua run trước): `diagnostic.candidates` không tồn
            // tại (shape thật là `diagnostic.contentEvidence.candidates`, xem answerSetMatcher.js
            // finalize()/dòng ~398) - crash "Cannot read properties of undefined (reading 'length')".
            // Cùng bug có trong e2e-giaobai-profilehientai-diem3-lamlai-diem8.mjs (COPY nguyên văn từ
            // đó, chưa từng bị test path AMBIGUOUS chạm tới).
            ? `AMBIGUOUS_MATCH ở câu ${questionIndex}: ${matchResult.diagnostic.contentEvidence?.candidates?.length ?? "?"} candidate CMS cùng khớp đủ answer-set - không tự chọn. (${matchResult.diagnostic.diagnosticReason ?? ""})`
            : `NO_MATCH ở câu ${questionIndex} (còn ${pool.length} câu): không có candidate CMS nào khớp đủ đáp án đang hiển thị.`,
        outcomeLabel,
        answerLog,
        perQuestion,
      };
    }
    const matched = matchResult.question;
    const isLast = answeredIds.size === questions.length - 1;
    const wantCorrect = wantCorrectMap.get(matched.id);
    const answerT = await timed(() =>
      exam.answerCurrentQuestionOneShot(matched, {
        wantCorrect,
        resultLabel: isLast ? "e2e_giaobai_range_result_screen" : null,
        snapshot: matched._snapshot ?? null,
      }),
    );
    const outcome = answerT.result;
    if (!outcome.supported) {
      return { ok: false, reason: `Handler không hỗ trợ câu "${matched.question}" (id=${matched.id}): ${outcome.reason}`, outcomeLabel: "BLOCKED_MISSING_EXERCISE_HANDLER", answerLog, perQuestion };
    }
    lastOutcome = outcome;
    carryTree = outcome.finalTree ?? null;
    answeredIds.add(matched.id);
    answerLog.push({ id: matched.id, question: matched.question, wantCorrect, isTargetCorrect: outcome.isTargetCorrect });
    perQuestion.push({
      index: questionIndex,
      wantCorrect,
      isTargetCorrect: outcome.isTargetCorrect,
      startedAt: matchT.startedAt,
      endedAt: answerT.endedAt,
      durationMs: answerT.endedAt - matchT.startedAt,
      matchDurationMs: matchT.durationMs,
      answerDurationMs: answerT.durationMs,
    });
    log(`    Câu ${answeredIds.size}/${questions.length}: nhắm ${wantCorrect ? "ĐÚNG" : "SAI"}, isTargetCorrect=${outcome.isTargetCorrect}, total=${fmtSec(answerT.endedAt - matchT.startedAt)}`);
  }
  return { ok: true, lastOutcome, answerLog, perQuestion };
}

async function main() {
  if (!APP_ID) throw new Error("Thiếu APP_ID - kiểm tra .env.");
  if (!PHONE || !OTP) throw new Error("Thiếu PHONE/OTP.");
  for (const [label, min, max] of [["FIRST_SCORE", FIRST_SCORE_MIN, FIRST_SCORE_MAX], ["REDO_SCORE", REDO_SCORE_MIN, REDO_SCORE_MAX]]) {
    if (Number.isNaN(min) || Number.isNaN(max) || min < 0 || max > 10 || min > max) {
      throw new Error(`${label}_MIN/MAX=[${min},${max}] không hợp lệ (phải trong [0,10] và MIN<=MAX).`);
    }
  }

  const overallStart = Date.now();
  const evidence = {};

  log(`[0] Refresh EXAM_COOKIE session (automation/.cache/exam_session.json)...`);
  const examSessionResult = refreshExamSessionFromEnvCookie();
  if (!examSessionResult.refreshed) {
    return finish({ status: "BLOCKED", phase: "EXAM_SESSION_REFRESH", error: examSessionResult.reason, evidence });
  }
  log(`  [PASS] exam_session.json đã ghi.`);

  // ===== [1] ASSIGN (Web GV, Playwright) =====
  log(`[1] Quét cây assignment eligible thật của lớp "${TARGET_CLASS_NAME}"...`);
  const { eligibleTree, classId, stats } = await fetchEligibleAssignmentTree(TARGET_CLASS_NAME);
  log(`  [PASS] class_id=${classId}`);
  log(`  [EXERCISE_DISCOVERY] total items: ${stats.totalItems} | items with exam: ${stats.itemsWithExam} | items without exam: ${stats.itemsWithoutExam}`);
  const pool = flattenNonSpeak(eligibleTree);
  if (pool.length === 0) {
    return finish({ status: "BLOCKED", phase: "ASSIGN_PRESCAN", error: `Lớp "${TARGET_CLASS_NAME}" không có item eligible non-SPEAK nào.`, evidence });
  }

  log(`[1] Prescan candidate mà CẢ range [${FIRST_SCORE_MIN},${FIRST_SCORE_MAX}] và [${REDO_SCORE_MIN},${REDO_SCORE_MAX}] đều có điểm khả thi (budget ${MAX_CANDIDATE_PRESCAN_ATTEMPTS})...`);
  const { picked, attempts } = await pickCandidateAchievingBothRanges(pool, { maxAttempts: MAX_CANDIDATE_PRESCAN_ATTEMPTS });
  evidence.prescanAttempts = attempts.length;
  if (!picked) {
    return finish({
      status: "BLOCKED",
      phase: "ASSIGN_PRESCAN",
      error: `Đã thử ${attempts.length}/${pool.length} candidate - không candidate nào vừa text-choice-compatible vừa có điểm khả thi trong CẢ 2 range ([${FIRST_SCORE_MIN},${FIRST_SCORE_MAX}], [${REDO_SCORE_MIN},${REDO_SCORE_MAX}]) trên cùng 1 room.`,
      evidence,
    });
  }
  evidence.picked = { itemName: picked.itemName, unitName: picked.unitName, lessonName: picked.lessonName };
  log(`  [PASS] Chọn "${picked.itemName}" (unit=${picked.unitName}, lesson=${picked.lessonName}).`);

  const dueDateDdMmYyyy = addDaysDdMmYyyy(ASSIGN_DUE_DATE_DAYS_AHEAD);
  log(`[1] Giao bài "${picked.itemName}" cho lớp "${TARGET_CLASS_NAME}", hạn nộp ${dueDateDdMmYyyy}...`);
  const assignResult = await assignHomeworkFlow({
    primaryClass: TARGET_CLASS_NAME,
    dueDate: dueDateDdMmYyyy,
    unitName: picked.unitName,
    lessonName: picked.lessonTag,
    homeworkItemId: picked.itemId,
    homeworkItemName: picked.itemName,
    headless: true,
  });
  evidence.assignResult = { status: assignResult.status, steps: assignResult.steps?.map((s) => ({ name: s.name, status: s.status })) };
  if (assignResult.status !== "PASS") {
    return finish({ status: "FAIL", phase: "ASSIGN", error: `assignHomeworkFlow() FAIL: ${assignResult.error}`, evidence });
  }
  log(`  [PASS] Đã giao bài qua Web GV.`);

  log(`[1] Resolve room_id thật của bài vừa giao (lessonItemId=${picked.itemId})...`);
  const room = await findRoomIdByLessonItem({ lessonItemId: picked.itemId, classId, endTimeDatePrefix: toIsoDatePrefix(dueDateDdMmYyyy) });
  evidence.roomId = room.id;
  log(`  [PASS] room_id=${room.id}`);

  log(`[1] Resolve câu hỏi/đáp án thật qua CMS cho room_id=${room.id}...`);
  const resolved = await resolveHomeworkExamQuestionsForRoomId(room.id);
  if (resolved.status !== "RESOLVED") {
    return finish({ status: "BLOCKED", phase: "RESOLVE_QUESTIONS", error: `resolveHomeworkExamQuestionsForRoomId status=${resolved.status}: ${resolved.reason}`, evidence });
  }
  const swapAnswer = resolved.roomDetails?.room?.exams?.[0]?.is_swap_answer ?? null;
  const swapQuestion = resolved.roomDetails?.room?.exams?.[0]?.is_swap_question ?? null;
  if (swapAnswer || swapQuestion) {
    return finish({ status: "BLOCKED", phase: "RESOLVE_QUESTIONS", error: `is_swap_answer=${swapAnswer}/is_swap_question=${swapQuestion} - không tin tưởng đáp án.`, evidence });
  }
  const QUESTIONS = resolved.questions;
  evidence.totalScoredItems = QUESTIONS.length;
  log(`  [PASS] ${QUESTIONS.length} scored items resolved từ CMS.`);

  // Random target score THẬT SỰ từ nội dung room THẬT (không mang theo giá trị từ prescan) - né lớp
  // bug examId catalog-vs-room lệch nhau bằng cách chỉ chọn con số SAU KHI đã có QUESTIONS thật.
  const firstPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "range", rangeMin: FIRST_SCORE_MIN, rangeMax: FIRST_SCORE_MAX });
  if (!firstPlan.achievable) {
    return finish({ status: "BLOCKED", phase: "FIRST_SCORE_PLAN", error: `Không random được target score nào trong [${FIRST_SCORE_MIN},${FIRST_SCORE_MAX}] cho room thật (${firstPlan.reason}).`, evidence });
  }
  const redoPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "range", rangeMin: REDO_SCORE_MIN, rangeMax: REDO_SCORE_MAX });
  if (!redoPlan.achievable) {
    return finish({ status: "BLOCKED", phase: "REDO_SCORE_PLAN", error: `Không random được target score nào trong [${REDO_SCORE_MIN},${REDO_SCORE_MAX}] cho room thật (${redoPlan.reason}).`, evidence });
  }
  log(`  [PASS] targetScore lần 1=${firstPlan.targetScore} (cần đúng ${firstPlan.correctIndices.size}/${QUESTIONS.length} item); targetScore Làm lại=${redoPlan.targetScore} (cần đúng ${redoPlan.correctIndices.size}/${QUESTIONS.length} item).`);

  // ===== [2] DEVICE (Maestro MCP bridge) =====
  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);

  try {
    log(`[2] Xác nhận hồ sơ "${PROFILE_NAME}" đang active (KHÔNG switch - [[feedback_keep_active_profile_for_giao_bai]])...`);
    const profileCheck = await ensureProfileActive(bridge);
    evidence.profileActive = profileCheck.active;
    if (!profileCheck.active) {
      return finish({
        status: "BLOCKED",
        phase: "PROFILE_CHECK",
        error: `Hồ sơ đang active KHÔNG khớp "${PROFILE_NAME}" - script này KHÔNG tự chuyển hồ sơ (standing rule). Texts đọc được: ${JSON.stringify(profileCheck.texts.slice(0, 10))}`,
        evidence,
      });
    }
    log(`  [PASS] Hồ sơ "${PROFILE_NAME}" xác nhận đang active.`);

    log(`[2] Cuộn về đỉnh danh sách "Bài tập" trước khi tìm bài vừa giao...`);
    const topResult = await scrollToTop(bridge);
    if (!topResult.atTop) log(`  [WARN] scrollToTop() không xác nhận: ${topResult.reason} - vẫn tiếp tục tìm từ vị trí hiện tại.`);

    // FIX (2026-09-03, FAIL thật xác nhận qua run trước): raw scrollUntilVisible+assertVisible (COPY
    // từ e2e-giaobai-profilehientai-diem3-lamlai-diem8.mjs, viết cho 1 lớp GẦN NHƯ RỖNG) không đủ
    // mạnh cho lớp "3B" (278 item, nhiều debris từ các lần chạy test trước - CÙNG root cause đã ghi
    // nhận trong docblock findAssignment.js: nhiều card TRÙNG title, scrollUntilVisible/assertVisible
    // dừng nhầm ở card debris cũ có Hạn nộp KHÁC). Đổi sang findAssignment()/tapFoundCard() (title+
    // dueDateDM, tap theo bounds THẬT của CTA - KHÔNG qua text selector dễ trùng) - CÙNG cơ chế
    // target5.mjs dùng cho chính lớp 3B, KHÔNG viết locate mới.
    log(`[2] Mở bài "${picked.itemName}" (hạn nộp ${toDM(dueDateDdMmYyyy)}) qua findAssignment()...`);
    const dueDateDM = toDM(dueDateDdMmYyyy);
    const located = await findAssignment(bridge, { title: picked.itemName, dueDateDM }, { maxScrolls: MAX_LOCATE_SCROLLS });
    if (located.status !== "FOUND") {
      return finish({ status: "FAIL", phase: "OPEN_NEW_ASSIGNMENT", error: `findAssignment() status=${located.status} cho "${picked.itemName}" (hạn nộp ${dueDateDM}):\n${located.diagnostics}`, evidence });
    }
    const tapResult = await tapFoundCard(bridge, located.card);
    if (!tapResult.success) {
      return finish({ status: "FAIL", phase: "OPEN_NEW_ASSIGNMENT", error: `tapFoundCard() thất bại: ${tapResult.error}`, evidence });
    }
    const openNew = await bridge.runSteps([
      { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
      { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 40000 } },
    ]);
    const firstAttemptStartedAt = Date.now();
    if (!openNew.success) {
      return finish({ status: "FAIL", phase: "OPEN_NEW_ASSIGNMENT", error: `Mở bài vừa giao thất bại sau khi tap card: ${openNew.error}`, evidence });
    }
    log(`  [PASS] Đã vào màn Doing (lần làm đầu).`);

    // ===== [3] LẦN LÀM ĐẦU - target ~FIRST_SCORE_MIN..FIRST_SCORE_MAX =====
    log(`[3] Trả lời ${QUESTIONS.length} câu, nhắm điểm ${firstPlan.targetScore} (range [${FIRST_SCORE_MIN},${FIRST_SCORE_MAX}])...`);
    const firstAnswer = await answerAllQuestions(bridge, exam, QUESTIONS, firstPlan.correctIndices);
    if (!firstAnswer.ok) {
      return finish({ status: firstAnswer.outcomeLabel === "BLOCKED_MISSING_EXERCISE_HANDLER" ? "BLOCKED" : "FAIL", phase: "FIRST_ATTEMPT_ANSWER", error: firstAnswer.reason, evidence: { ...evidence, firstAnswerLog: firstAnswer.answerLog } });
    }
    const firstFinalTree = firstAnswer.lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(firstFinalTree)) {
      return finish({ status: "FAIL", phase: "FIRST_ATTEMPT_RESULT", error: "Không thấy màn Kết quả sau khi trả lời hết câu (lần làm đầu).", evidence });
    }
    const firstAttemptEndedAt = Date.now();
    const firstResult = exam.readResult(firstFinalTree);
    const firstActualScore = firstResult.score === null ? null : Number(firstResult.score);
    const firstMatched = firstActualScore !== null && !Number.isNaN(firstActualScore) && Math.abs(firstActualScore - firstPlan.targetScore) < 1e-6;
    evidence.firstAttempt = {
      targetScoreRange: `[${FIRST_SCORE_MIN}, ${FIRST_SCORE_MAX}]`,
      targetScore: firstPlan.targetScore,
      actualScore: firstActualScore,
      correct: firstResult.correct,
      matched: firstMatched,
      timing: {
        startedAtIso: new Date(firstAttemptStartedAt).toISOString(),
        endedAtIso: new Date(firstAttemptEndedAt).toISOString(),
        durationMs: firstAttemptEndedAt - firstAttemptStartedAt,
        perQuestion: firstAnswer.perQuestion,
      },
    };
    log(`  TARGET=${firstPlan.targetScore} ĐIỂM THẬT=${firstResult.score} CHÍNH XÁC=${firstResult.correct} THỜI GIAN=${fmtSec(firstAttemptEndedAt - firstAttemptStartedAt)}`);
    if (!firstMatched) {
      return finish({ status: "FAIL", phase: "FIRST_ATTEMPT_SCORE_VERIFY", error: `Điểm thật ${firstActualScore} KHÁC target ${firstPlan.targetScore}.`, evidence });
    }

    const closeFirst = await bridge.runSteps([
      { runFlow: { when: { visible: "Hoàn thành" }, commands: [{ tapOn: { text: ".*(Hoàn thành).*" } }] } },
      { runFlow: { when: { visible: "Tiếp theo" }, commands: [{ tapOn: { id: "exercise_result_close_button" } }] } },
      { extendedWaitUntil: { visible: { id: "homework_screen" }, timeout: 30000 } },
    ]);
    if (!closeFirst.success) {
      return finish({ status: "FAIL", phase: "CLOSE_FIRST_RESULT", error: `Không quay lại homework_screen sau lần làm đầu: ${closeFirst.error}`, evidence });
    }
    log(`  [PASS] Đã đóng màn Kết quả (lần đầu), về lại danh sách Bài tập.`);

    // ===== [4] TÌM LẠI CARD -> "Làm lại" =====
    log(`[4] Tìm lại card "${picked.itemName}" (cta="Làm lại")...`);
    const relocated = await locateSpecificCompletedCandidate(bridge, picked.itemName, { maxScrolls: MAX_LOCATE_SCROLLS });
    const freshCandidate = relocated.candidates[0];
    if (!freshCandidate) {
      return finish({ status: "FAIL", phase: "LOCATE_LAM_LAI", error: `Không tìm lại được card "${picked.itemName}" với cta="Làm lại" sau ${relocated.scrollsUsed} lượt cuộn (stopReason=${relocated.stopReason ?? "UNKNOWN"}).`, evidence });
    }
    log(`  [PASS] Tìm thấy card "Làm lại" sau ${relocated.scrollsUsed} lượt cuộn.`);

    const ctaPoint = centerPoint(freshCandidate.ctaBounds);
    const tapRedo = await bridge.runSteps([
      { tapOn: { point: `${ctaPoint.x},${ctaPoint.y}` } },
      { waitForAnimationToEnd: { timeout: 3000 } },
      { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
      { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 15000 } },
    ]);
    const redoAttemptStartedAt = Date.now();
    if (!tapRedo.success) {
      return finish({ status: "FAIL", phase: "TAP_LAM_LAI", error: `Tap "Làm lại" thất bại: ${tapRedo.error}`, evidence });
    }
    log(`  [PASS] Đã tap "Làm lại" - vào màn Doing (lần 2).`);

    // ===== [5] LÀM LẠI - target ~REDO_SCORE_MIN..REDO_SCORE_MAX =====
    log(`[5] Trả lời lại ${QUESTIONS.length} câu, nhắm điểm ${redoPlan.targetScore} (range [${REDO_SCORE_MIN},${REDO_SCORE_MAX}])...`);
    const redoAnswer = await answerAllQuestions(bridge, exam, QUESTIONS, redoPlan.correctIndices);
    if (!redoAnswer.ok) {
      return finish({ status: redoAnswer.outcomeLabel === "BLOCKED_MISSING_EXERCISE_HANDLER" ? "BLOCKED" : "FAIL", phase: "REDO_ATTEMPT_ANSWER", error: redoAnswer.reason, evidence: { ...evidence, redoAnswerLog: redoAnswer.answerLog } });
    }
    const redoFinalTree = redoAnswer.lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(redoFinalTree)) {
      return finish({ status: "FAIL", phase: "REDO_ATTEMPT_RESULT", error: "Không thấy màn Kết quả sau khi trả lời hết câu (Làm lại).", evidence });
    }
    const redoAttemptEndedAt = Date.now();
    const redoResult = exam.readResult(redoFinalTree);
    const redoActualScore = redoResult.score === null ? null : Number(redoResult.score);
    const redoMatched = redoActualScore !== null && !Number.isNaN(redoActualScore) && Math.abs(redoActualScore - redoPlan.targetScore) < 1e-6;
    evidence.redoAttempt = {
      targetScoreRange: `[${REDO_SCORE_MIN}, ${REDO_SCORE_MAX}]`,
      targetScore: redoPlan.targetScore,
      actualScore: redoActualScore,
      correct: redoResult.correct,
      matched: redoMatched,
      timing: {
        startedAtIso: new Date(redoAttemptStartedAt).toISOString(),
        endedAtIso: new Date(redoAttemptEndedAt).toISOString(),
        durationMs: redoAttemptEndedAt - redoAttemptStartedAt,
        perQuestion: redoAnswer.perQuestion,
      },
    };
    log(`  TARGET=${redoPlan.targetScore} ĐIỂM THẬT=${redoResult.score} CHÍNH XÁC=${redoResult.correct} THỜI GIAN=${fmtSec(redoAttemptEndedAt - redoAttemptStartedAt)}`);
    if (!redoMatched) {
      return finish({ status: "FAIL", phase: "REDO_ATTEMPT_SCORE_VERIFY", error: `Điểm thật ${redoActualScore} KHÁC target ${redoPlan.targetScore}.`, evidence });
    }

    // ===== [6] MÀN KẾT QUẢ CUỐI - bấm THẬT "Tiếp theo" hoặc "Hoàn thành" =====
    log(`[6] Đọc CTA thật đang hiển thị trên màn Kết quả rồi bấm THẬT...`);
    const ctaTexts = collectAllTexts(redoFinalTree);
    const hasTiepTheo = ctaTexts.some((t) => /Tiếp theo/.test(t));
    const hasHoanThanh = ctaTexts.some((t) => /Hoàn thành/.test(t));
    if (!hasTiepTheo && !hasHoanThanh) {
      return finish({ status: "FAIL", phase: "FINAL_CTA_DETECT", error: `Không thấy CTA "Tiếp theo" lẫn "Hoàn thành" trên màn Kết quả sau Làm lại. Texts: ${JSON.stringify(ctaTexts)}`, evidence });
    }
    const ctaToTap = hasTiepTheo ? "Tiếp theo" : "Hoàn thành";
    const tapFinalCta = await bridge.runSteps([{ tapOn: { text: `.*(${ctaToTap}).*` } }]);
    if (!tapFinalCta.success) {
      return finish({ status: "FAIL", phase: "FINAL_CTA_TAP", error: `Tap "${ctaToTap}" thất bại: ${tapFinalCta.error}`, evidence });
    }
    const landExpectation = ctaToTap === "Tiếp theo" ? { id: "exercise_close_button" } : { id: "homework_screen" };
    const landResult = await bridge.wait(landExpectation, { timeout: 30000 });
    evidence.finalCta = { cta: ctaToTap, landed: landResult.success };
    if (!landResult.success) {
      return finish({ status: "FAIL", phase: "FINAL_CTA_LAND", error: `Bấm "${ctaToTap}" nhưng không xác nhận được điều hướng đúng (${JSON.stringify(landExpectation)}): ${landResult.error}`, evidence });
    }
    log(`  [PASS] Đã bấm THẬT "${ctaToTap}" - điều hướng đúng.`);

    evidence.totalDurationSeconds = (Date.now() - overallStart) / 1000;
    return finish({ status: "PASS", evidence });
  } catch (err) {
    return finish({ status: "ERROR", error: err.message, stack: err.stack, evidence });
  } finally {
    await bridge.stop();
    log("[MCP] Đã dừng tiến trình `maestro mcp`.");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((result) => {
      printReport(result);
      log(`\nĐã ghi report ra ${OUTPUT_FILE}`);
      process.exit(result.status === "PASS" ? 0 : result.status === "BLOCKED" ? 3 : 1);
    })
    .catch((err) => {
      console.error("\n[e2e-giaobai-range34-lamlai-range67] Dừng lại vì lỗi ngoài dự kiến:\n", err);
      finish({ status: "ERROR", error: err.message, stack: err.stack });
      process.exit(2);
    });
}
