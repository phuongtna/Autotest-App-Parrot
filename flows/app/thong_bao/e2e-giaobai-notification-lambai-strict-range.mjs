#!/usr/bin/env node
/**
 * E2E-GiaoBai-Notification-LamBai-StrictRange
 *
 * Case theo yêu cầu (2026-09-17): "giao bài tập -> làm bài (VÀO BÀI BẰNG CÁCH BẤM THÔNG BÁO NGOÀI
 * APP, không mở app rồi tự tìm card) -> lần 1 đạt điểm strictly >0 và <4 -> màn Kết quả -> bấm
 * 'Làm lại' -> lần 2 đạt điểm strictly >5 và <10". Output: báo cáo chi tiết thời gian chạy (tổng +
 * từng lượt làm + từng câu).
 *
 * GHÉP TỪ 2 kịch bản đã verify thật, KHÔNG viết engine mới ([[feedback_reuse_first_workflow]]):
 *   1. flows/web/giao_bai_tap/e2e-giaobai-range34-lamlai-range67.mjs (PASS thật nhiều lần, gần nhất
 *      2026-09-17 - xem [[project_gbt_lamlai_strict_range_run_2026_09_17]]): COPY NGUYÊN prescan
 *      2-range (pickCandidateAchievingBothRanges - dùng resolveScoringPlanForCandidate(mode:"range")
 *      export từ e2e-teacher-assign-full-scored-target5.mjs, KHÔNG re-implement subset-sum), vòng
 *      lặp trả lời có timing (answerAllQuestions/timed()), tìm lại card "Làm lại"
 *      (locateSpecificCompletedCandidate) và CTA màn Kết quả cuối. "Strict >X<Y" dùng ĐÚNG mẹo đã
 *      xác nhận nhiều lần ([[project_gbt_lamlai_strict_range_run_2026_09_15]] /
 *      [[project_gbt_lamlai_strict_range_run_2026_09_16]] / _17): range env = [X+0.1, Y-0.1].
 *   2. flows/app/thong_bao/e2e-teacher-assign-os-notification-shade.mjs (TB-06, PASS thật
 *      2026-09-14 - [[project_tb06_os_notification_shade_fix_2026_09_14]]): COPY NGUYÊN phần OS-
 *      level (automation/thong_bao/androidNotificationShade.js, thuần adb) để MỞ BÀI LẦN ĐẦU:
 *      bấm HOME đưa app ra ngoài foreground -> giao bài (KHÔNG chạm thiết bị) -> poll
 *      `dumpsys notification` tới khi OS tạo notification khớp title+hạn nộp -> mở THẬT Android
 *      notification shade (`uiautomator dump`) -> tap toạ độ thật -> xác nhận app lên foreground
 *      thật (`dumpsys activity activities`) - ĐÚNG yêu cầu "bấm từ thông báo bên ngoài app để vào
 *      làm bài", KHÔNG dùng findAssignment()/tapFoundCard() (locate-trong-app) của bản gốc (1) cho
 *      LẦN MỞ BÀI ĐẦU TIÊN. Lượt "Làm lại" (lần 2) vẫn mở TRONG app như bản gốc (user không yêu cầu
 *      notification cho lượt 2, và bản chất "Làm lại" là 1 CTA trên card đã hoàn thành, không có
 *      notification riêng cho hành động đó).
 *
 * KHÁC PRESCAN so với TB-06 gốc: TB-06 để Web GV random 1 bài BẤT KỲ (không cần đạt điểm gì) - bản
 * này PHẢI ép CHÍNH XÁC 1 candidate đã prescan đạt được CẢ 2 range strict (giống bản gốc (1)) rồi
 * mới assignHomeworkFlow() với unitName/lessonName/homeworkItemId/homeworkItemName CỐ ĐỊNH (không
 * để Web GV tự random) - nếu không, không thể đảm bảo có target score khả thi cho notification thật
 * sự sẽ dẫn tới.
 *
 * AN TOÀN: CHỈ giao ĐÚNG 1 bài. KHÔNG tự chuyển hồ sơ/profile - VERIFY-ONLY, giống bản gốc (1)
 * ([[feedback_keep_active_profile_for_giao_bai]]). Giao bài là WRITE thật lên
 * TEACHER_PORTAL_ENV hiện tại (production tại thời điểm viết - [[feedback_verify_teacher_portal_env_before_writes]]).
 *
 * ENV: APP_ID (.env), TEACHER_ACCESS_TOKEN/EXAM_COOKIE (.env, get_teacher_token.sh/get_tokens.sh),
 *   PHONE/OTP (default "0915151519"/"888888"), MAESTRO_DEVICE, TARGET_CLASS_NAME (default
 *   "7QA-Test"), TARGET_CLASS_ID (default "da3efdea-e0ea-4627-b119-a11c329d3d4e"), PROFILE_NAME
 *   (default "Trần Duy Anh"), FIRST_SCORE_MIN/MAX (default 0.1/3.9 = strict "0 < điểm < 4"),
 *   REDO_SCORE_MIN/MAX (default 5.1/9.9 = strict "5 < điểm < 10"), ASSIGN_DUE_DATE_DAYS_AHEAD
 *   (default 7), MAX_CANDIDATE_PRESCAN_ATTEMPTS (default 40), NOTIFICATION_POLL_TIMEOUT_MS
 *   (default 90000).
 *
 * CHẠY: node flows/app/thong_bao/e2e-giaobai-notification-lambai-strict-range.mjs
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
import { locateSpecificCompletedCandidate } from "../../../automation/bai_tap/discovery/locateCompletedCandidate.js";
import { centerPoint } from "../../../automation/bai_tap/discovery/homeworkUiList.js";
import { findMatchingQuestion } from "../../../automation/bai_tap/discovery/answerSetMatcher.js";
import {
  resolveScoringPlanForCandidate,
  buildWeightedWantCorrectPlan,
  collectAllTexts,
} from "../../web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs";
import {
  pressHome,
  expandNotificationShade,
  collapseNotificationShade,
  swipeUpInsideShade,
  tap,
  getResumedActivityPackage,
  listNotificationExtrasForPackage,
  dumpUiHierarchy,
  screenshot,
  findNotificationTapTarget,
} from "../../../automation/thong_bao/androidNotificationShade.js";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "e2e_giaobai_notification_lambai_strict_range_report.json");
const SHADE_SCREENSHOT_FILE = join(PROJECT_ROOT, "automation", "output", "screenshots", "GBT-NOTI-LAMBAI-shade.png");
const AFTER_TAP_SCREENSHOT_FILE = join(PROJECT_ROOT, "automation", "output", "screenshots", "GBT-NOTI-LAMBAI-after-tap.png");
const EXAM_SESSION_PATH = join(PROJECT_ROOT, "automation", ".cache", "exam_session.json");
const ROOT_ENV = parseEnvFile(join(PROJECT_ROOT, ".env"));

const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
// [[feedback_default_test_account_tranduyanh]] - KHÔNG đọc test_data/accounts.env (mặc định ở đó
// là tài khoản khác, sai cho lớp "7QA-Test" bên dưới - [[project_target5_script_env_defaults_wrong_account]]).
const PHONE = process.env.PHONE || "0915151519";
const OTP = process.env.OTP || "888888";
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const TARGET_CLASS_NAME = process.env.TARGET_CLASS_NAME || "7QA-Test";
const TARGET_CLASS_ID = process.env.TARGET_CLASS_ID || "da3efdea-e0ea-4627-b119-a11c329d3d4e";
const PROFILE_NAME = process.env.PROFILE_NAME || "Trần Duy Anh";
// Strict ">X<Y" = range env [X+0.1, Y-0.1] - mẹo đã xác nhận nhiều lần thật (xem docblock đầu file).
const FIRST_SCORE_MIN = Number(process.env.FIRST_SCORE_MIN ?? 0.1);
const FIRST_SCORE_MAX = Number(process.env.FIRST_SCORE_MAX ?? 3.9);
const REDO_SCORE_MIN = Number(process.env.REDO_SCORE_MIN ?? 5.1);
const REDO_SCORE_MAX = Number(process.env.REDO_SCORE_MAX ?? 9.9);
const ASSIGN_DUE_DATE_DAYS_AHEAD = Number(process.env.ASSIGN_DUE_DATE_DAYS_AHEAD || 7);
const MAX_CANDIDATE_PRESCAN_ATTEMPTS = Number(process.env.MAX_CANDIDATE_PRESCAN_ATTEMPTS || 40);
const NOTIFICATION_POLL_TIMEOUT_MS = Number(process.env.NOTIFICATION_POLL_TIMEOUT_MS || 90000);
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

function toIsoDatePrefix(ddmmyyyy) {
  const [dd, mm, yyyy] = ddmmyyyy.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

/** COPY từ automation/bai_tap/pro_lamlai_target_score.mjs#now()/timed() - đo thời gian mỗi bước. */
function now() {
  return Date.now();
}
async function timed(fn) {
  const startedAt = now();
  const result = await fn();
  const endedAt = now();
  return { result, startedAt, endedAt, durationMs: endedAt - startedAt };
}

/** COPY từ e2e-giaobai-profilehientai-diem3-lamlai-diem8.mjs#flattenNonSpeak() (qua range34). */
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

/** COPY từ automation/bai_tap/pro_lamlai_target_score.mjs#isTextChoiceCompatible() (qua range34). */
function isTextChoiceCompatible(questions) {
  if (!Array.isArray(questions) || questions.length < 3) return false;
  return questions.every((q) => {
    const nonEmptyAnswers = (q.answers ?? []).filter((a) => typeof a === "string" && a.trim().length > 0);
    return nonEmptyAnswers.length >= 2 && q.correctAnswer && nonEmptyAnswers.includes(q.correctAnswer);
  });
}

/** COPY NGUYÊN VĂN từ range34#pickCandidateAchievingBothRanges() - prescan candidate mà CẢ 2 range
 * strict đều có ÍT NHẤT 1 điểm khả thi, dùng resolveScoringPlanForCandidate(mode:"range") export
 * (KHÔNG re-implement subset-sum). */
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

/** COPY từ automation/bai_tap/pro_lamlai_target_score.mjs#refreshExamSessionFromEnvCookie() (qua range34). */
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

/** COPY NGUYÊN VĂN từ TB-06#contentMatches() - tiêu chí khớp nội dung notification "giao bài":
 * chứa `"<title>"` (giữ nguyên ngoặc kép) VÀ `Hạn nộp: <DD/MM/YYYY>`. */
function contentMatches(text, title, dueDMY) {
  return text.includes(`"${title}"`) && text.includes(`Hạn nộp: ${dueDMY}`);
}

/** COPY từ range34#ensureProfileActive() - VERIFY-ONLY, KHÔNG BAO GIỜ tự tap "Chuyển profile"
 * ([[feedback_keep_active_profile_for_giao_bai]]). BLOCK rõ nếu PROFILE_NAME không active. */
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

/** FIX (2026-09-17, FAIL thật xác nhận qua run trước - live screenshot bằng chứng): màn Kết quả
 * phát 1 animation confetti (Lottie) NGAY sau khi tap CTA câu cuối - "ĐIỂM SỐ"/"CHÍNH XÁC" (2 label
 * answerCurrentQuestionOneShot()/isResultScreen() dò tìm) CHỈ mount SAU khi confetti chạy xong, trễ
 * hơn hẳn khoảng chờ waitForAnimationToEnd(1000ms) sẵn có trong engine - `finalTree` bắt được ngay
 * lúc đó KHÔNG có 2 label này dù màn Kết quả đã lên đúng (đã xác nhận trực tiếp: chụp lại màn hình
 * live vài phút sau cho thấy ĐÚNG "ĐIỂM SỐ 2"/"CHÍNH XÁC 2/10" khớp target). KHÔNG sửa
 * homeworkExamEngine.js dùng chung (nhiều caller khác, chưa xác nhận tất cả có cùng ảnh hưởng) - vá
 * tại đây: poll lại `bridge.hierarchy()` vài lượt trước khi kết luận "không thấy màn Kết quả". */
async function pollResultScreen(bridge, exam, initialTree, { attempts = 6, intervalMs = 1500 } = {}) {
  let tree = initialTree;
  for (let i = 0; i < attempts; i++) {
    if (exam.isResultScreen(tree)) return tree;
    await new Promise((r) => setTimeout(r, intervalMs));
    tree = await bridge.hierarchy();
  }
  return tree;
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

  log(`\n[NOTIFICATION ENTRY]`);
  log(`os_notification_elapsed=${fmtSec(e.osNotifElapsedMs)} (${e.osAttempts ?? "-"} lượt poll dumpsys)`);
  log(`shade_ui_match_attempts=${e.shadeAttempts ?? "-"}`);
  log(`tap_to_foreground=${e.foregroundConfirmed ? "PASS" : "-"}`);

  for (const [label, key] of [["FIRST ATTEMPT (mở qua notification)", "firstAttempt"], ["LAM LAI - SECOND ATTEMPT (mở trong app)", "redoAttempt"]]) {
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

/** COPY NGUYÊN VĂN từ range34#answerAllQuestions() - vòng lặp trả lời TOÀN BỘ questions theo
 * correctIndices, THÊM timed() mỗi câu, dùng lại được cho CẢ 2 lượt làm. */
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
        resultLabel: isLast ? "e2e_giaobai_notification_result_screen" : null,
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
  collapseNotificationShade(MAESTRO_DEVICE || null);

  log(`[0] Refresh EXAM_COOKIE session (automation/.cache/exam_session.json)...`);
  const examSessionResult = refreshExamSessionFromEnvCookie();
  if (!examSessionResult.refreshed) {
    return finish({ status: "BLOCKED", phase: "EXAM_SESSION_REFRESH", error: examSessionResult.reason, evidence });
  }
  log(`  [PASS] exam_session.json đã ghi.`);

  // ===== [1] DEVICE: login + verify profile active (VERIFY-ONLY) =====
  let bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const resolvedDeviceId = bridge.deviceId;
  let bridgeAlive = true;

  try {
    log(`[1] Xác nhận hồ sơ "${PROFILE_NAME}" đang active (KHÔNG switch - [[feedback_keep_active_profile_for_giao_bai]])...`);
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

    // ===== [2] Đưa app ra NGOÀI foreground (bấm HOME thật qua adb) - PORT từ TB-06 =====
    log(`[2] Bấm HOME - đưa app ra ngoài foreground (user KHÔNG đứng trong app)...`);
    pressHome(resolvedDeviceId);
    await new Promise((r) => setTimeout(r, 1000));
    const resumedBeforeAssign = getResumedActivityPackage(resolvedDeviceId);
    if (resumedBeforeAssign === APP_ID) {
      throw new Error(`Bấm HOME xong nhưng ResumedActivity vẫn là ${APP_ID} - app CHƯA ra khỏi foreground.`);
    }
    log(`  [PASS] App state = Outside app (ResumedActivity = "${resumedBeforeAssign}").`);

    // Dừng `maestro mcp` TRƯỚC khi làm thao tác adb thuần bên dưới - tránh tranh chấp
    // UiAutomation connection ([[project_uiautomator_dump_unreliable]]).
    await bridge.stop();
    bridgeAlive = false;

    // ===== [3] ASSIGN-PRESCAN (Web GV, Playwright - KHÔNG chạm thiết bị) =====
    log(`[3] Quét cây assignment eligible thật của lớp "${TARGET_CLASS_NAME}"...`);
    const { eligibleTree, classId, stats } = await fetchEligibleAssignmentTree(TARGET_CLASS_NAME);
    log(`  [PASS] class_id=${classId}`);
    log(`  [EXERCISE_DISCOVERY] total items: ${stats.totalItems} | items with exam: ${stats.itemsWithExam} | items without exam: ${stats.itemsWithoutExam}`);
    const pool = flattenNonSpeak(eligibleTree);
    if (pool.length === 0) {
      return finish({ status: "BLOCKED", phase: "ASSIGN_PRESCAN", error: `Lớp "${TARGET_CLASS_NAME}" không có item eligible non-SPEAK nào.`, evidence });
    }

    log(`[3] Prescan candidate mà CẢ range [${FIRST_SCORE_MIN},${FIRST_SCORE_MAX}] và [${REDO_SCORE_MIN},${REDO_SCORE_MAX}] đều có điểm khả thi (budget ${MAX_CANDIDATE_PRESCAN_ATTEMPTS})...`);
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

    // ===== [4] ASSIGN THẬT (Web GV) - app vẫn ở ngoài foreground, hành động này KHÔNG chạm thiết bị =====
    const dueDateDdMmYyyy = addDaysDdMmYyyy(ASSIGN_DUE_DATE_DAYS_AHEAD);
    log(`[4] Giao bài "${picked.itemName}" cho lớp "${TARGET_CLASS_NAME}", hạn nộp ${dueDateDdMmYyyy}...`);
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
    const assignConfirmedAt = Date.now();
    log(`  [PASS] Đã giao bài qua Web GV lúc t=${new Date(assignConfirmedAt).toISOString()}.`);

    log(`[4] Resolve room_id thật của bài vừa giao (lessonItemId=${picked.itemId})...`);
    const room = await findRoomIdByLessonItem({ lessonItemId: picked.itemId, classId, endTimeDatePrefix: toIsoDatePrefix(dueDateDdMmYyyy) });
    evidence.roomId = room.id;
    log(`  [PASS] room_id=${room.id}`);

    log(`[4] Resolve câu hỏi/đáp án thật qua CMS cho room_id=${room.id}...`);
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

    // Random target score THẬT từ nội dung room THẬT (né bug examId catalog-vs-room lệch nhau).
    const firstPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "range", rangeMin: FIRST_SCORE_MIN, rangeMax: FIRST_SCORE_MAX });
    if (!firstPlan.achievable) {
      return finish({ status: "BLOCKED", phase: "FIRST_SCORE_PLAN", error: `Không random được target score nào trong [${FIRST_SCORE_MIN},${FIRST_SCORE_MAX}] cho room thật (${firstPlan.reason}).`, evidence });
    }
    const redoPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "range", rangeMin: REDO_SCORE_MIN, rangeMax: REDO_SCORE_MAX });
    if (!redoPlan.achievable) {
      return finish({ status: "BLOCKED", phase: "REDO_SCORE_PLAN", error: `Không random được target score nào trong [${REDO_SCORE_MIN},${REDO_SCORE_MAX}] cho room thật (${redoPlan.reason}).`, evidence });
    }
    log(`  [PASS] targetScore lần 1=${firstPlan.targetScore} (cần đúng ${firstPlan.correctIndices.size}/${QUESTIONS.length} item); targetScore Làm lại=${redoPlan.targetScore} (cần đúng ${redoPlan.correctIndices.size}/${QUESTIONS.length} item).`);

    // ===== [5] POLL Android OS notification (dumpsys, KHÔNG mở app) - PORT từ TB-06 =====
    log(`[5] POLL Android OS notification (dumpsys notification, tối đa ${NOTIFICATION_POLL_TIMEOUT_MS}ms)...`);
    let osMatched = null;
    let osAttempts = 0;
    const osPollDeadline = assignConfirmedAt + NOTIFICATION_POLL_TIMEOUT_MS;
    while (Date.now() < osPollDeadline) {
      osAttempts++;
      const records = listNotificationExtrasForPackage(resolvedDeviceId, APP_ID);
      osMatched = records.find((r) => r.text && contentMatches(r.text, picked.itemName, dueDateDdMmYyyy));
      const elapsed = Date.now() - assignConfirmedAt;
      log(`  [OS-POLL ${osAttempts}] t+${elapsed}ms - ${osMatched ? "KHỚP (dumpsys)" : "chưa thấy"}.`);
      if (osMatched) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!osMatched) {
      return finish({
        status: "FAIL",
        phase: "OS_NOTIFICATION_NOT_APPEARED",
        error: `Sau ${NOTIFICATION_POLL_TIMEOUT_MS}ms (${osAttempts} lượt poll) KHÔNG thấy NotificationRecord OS khớp title="${picked.itemName}" + Hạn nộp=${dueDateDdMmYyyy}.`,
        evidence,
      });
    }
    const osNotifElapsedMs = Date.now() - assignConfirmedAt;
    evidence.osNotifElapsedMs = osNotifElapsedMs;
    evidence.osAttempts = osAttempts;
    log(`  [PASS] OS đã tạo notification sau ${osNotifElapsedMs}ms: tag=${osMatched.tag} text="${osMatched.text}"`);

    // ===== [6] Mở THẬT Android notification shade + tap - PORT từ TB-06 =====
    log(`[6] Mở THẬT Android notification shade + đọc UI hierarchy (uiautomator dump)...`);
    let tapTarget = null;
    let shadeAttempts = 0;
    const shadeDeadline = Date.now() + 30000;
    while (Date.now() < shadeDeadline && !tapTarget) {
      shadeAttempts++;
      expandNotificationShade(resolvedDeviceId);
      await new Promise((r) => setTimeout(r, 800));
      const xml = dumpUiHierarchy(resolvedDeviceId);
      tapTarget = findNotificationTapTarget(xml, (t) => contentMatches(t, picked.itemName, dueDateDdMmYyyy));
      if (tapTarget) break;
      log(`  [SHADE-ATTEMPT ${shadeAttempts}] chưa thấy trong UI render - thử cuộn xuống...`);
      swipeUpInsideShade(resolvedDeviceId);
      await new Promise((r) => setTimeout(r, 500));
      const xml2 = dumpUiHierarchy(resolvedDeviceId);
      tapTarget = findNotificationTapTarget(xml2, (t) => contentMatches(t, picked.itemName, dueDateDdMmYyyy));
      if (tapTarget) break;
      collapseNotificationShade(resolvedDeviceId);
      await new Promise((r) => setTimeout(r, 500));
    }
    evidence.shadeAttempts = shadeAttempts;
    if (!tapTarget || !tapTarget.clickableBounds) {
      return finish({ status: "FAIL", phase: "SHADE_UI_MATCH_NOT_FOUND", error: `OS đã tạo notification nhưng KHÔNG tìm thấy item khớp trong Android notification shade sau ${shadeAttempts} lượt thử.`, evidence });
    }
    log(`  [PASS] Tìm thấy trong shade thật: title="${tapTarget.titleText}" body="${tapTarget.bodyText}"`);
    mkdirSync(dirname(SHADE_SCREENSHOT_FILE), { recursive: true });
    screenshot(resolvedDeviceId, SHADE_SCREENSHOT_FILE);

    const { x1, y1, x2, y2 } = tapTarget.clickableBounds;
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    log(`[TAP] Tap vào notification tại (${centerX}, ${centerY})...`);
    tap(resolvedDeviceId, centerX, centerY);
    const firstAttemptStartedAt = Date.now();

    log(`[VERIFY] Xác nhận app lên foreground thật (dumpsys activity activities)...`);
    let foregroundConfirmed = false;
    let resumedAfterTap = null;
    const fgDeadline = Date.now() + 15000;
    while (Date.now() < fgDeadline) {
      resumedAfterTap = getResumedActivityPackage(resolvedDeviceId);
      if (resumedAfterTap === APP_ID) {
        foregroundConfirmed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    evidence.foregroundConfirmed = foregroundConfirmed;
    if (!foregroundConfirmed) {
      return finish({ status: "FAIL", phase: "TAP_DID_NOT_FOREGROUND_APP", error: `Tap vào notification KHÔNG đưa app lên foreground trong 15s (ResumedActivity cuối = "${resumedAfterTap}").`, evidence });
    }
    log(`  [PASS] App đã lên foreground.`);

    try {
      mkdirSync(dirname(AFTER_TAP_SCREENSHOT_FILE), { recursive: true });
      screenshot(resolvedDeviceId, AFTER_TAP_SCREENSHOT_FILE);
    } catch (e) {
      log(`  (Không chụp được screenshot sau tap: ${e.message})`);
    }

    // ===== [7] Tái tạo MaestroMcpBridge, xử lý popup AI, xác nhận vào ĐÚNG màn Doing =====
    log(`[7] Tái tạo MaestroMcpBridge, xử lý popup "AI hỗ trợ học tập" (nếu có), xác nhận vào màn Doing...`);
    await new Promise((r) => setTimeout(r, 1000));
    bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: resolvedDeviceId });
    await bridge.start();
    bridgeAlive = true;
    const exam = new HomeworkExamEngine(bridge);
    const openNew = await bridge.runSteps([
      { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
      { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 40000 } },
    ]);
    if (!openNew.success) {
      return finish({ status: "FAIL", phase: "OPEN_NEW_ASSIGNMENT", error: `Sau khi tap notification, không vào được màn Doing: ${openNew.error}`, evidence });
    }
    // Safety net nhẹ (tinh thần classifyDestination() của TB-06): xác nhận ĐÚNG bài vừa giao đang
    // hiển thị trên màn hình, KHÔNG PHẢI 1 bài khác do điều hướng sai.
    const landedTree = await bridge.hierarchy();
    const landedTexts = collectAllTexts(landedTree);
    if (!landedTexts.some((t) => t.includes(picked.itemName))) {
      return finish({
        status: "FAIL",
        phase: "NOTIFICATION_DESTINATION_MISMATCH",
        error: `Tap notification đưa vào màn Doing nhưng KHÔNG thấy title "${picked.itemName}" trên màn hình - có thể đã mở SAI bài. Texts: ${JSON.stringify(landedTexts.slice(0, 15))}`,
        evidence,
      });
    }
    log(`  [PASS] Đã vào màn Doing ĐÚNG bài "${picked.itemName}" (lần làm đầu, mở qua notification).`);

    // ===== [8] LẦN LÀM ĐẦU - target strict [${FIRST_SCORE_MIN}, ${FIRST_SCORE_MAX}] =====
    log(`[8] Trả lời ${QUESTIONS.length} câu, nhắm điểm ${firstPlan.targetScore} (range strict [${FIRST_SCORE_MIN},${FIRST_SCORE_MAX}])...`);
    const firstAnswer = await answerAllQuestions(bridge, exam, QUESTIONS, firstPlan.correctIndices);
    if (!firstAnswer.ok) {
      return finish({ status: firstAnswer.outcomeLabel === "BLOCKED_MISSING_EXERCISE_HANDLER" ? "BLOCKED" : "FAIL", phase: "FIRST_ATTEMPT_ANSWER", error: firstAnswer.reason, evidence: { ...evidence, firstAnswerLog: firstAnswer.answerLog } });
    }
    const firstFinalTree = await pollResultScreen(bridge, exam, firstAnswer.lastOutcome?.finalTree ?? null);
    if (!exam.isResultScreen(firstFinalTree)) {
      return finish({ status: "FAIL", phase: "FIRST_ATTEMPT_RESULT", error: "Không thấy màn Kết quả sau khi trả lời hết câu (lần làm đầu).", evidence });
    }
    const firstAttemptEndedAt = Date.now();
    const firstResult = exam.readResult(firstFinalTree);
    const firstActualScore = firstResult.score === null ? null : Number(firstResult.score);
    const firstMatched = firstActualScore !== null && !Number.isNaN(firstActualScore) && Math.abs(firstActualScore - firstPlan.targetScore) < 1e-6;
    evidence.firstAttempt = {
      targetScoreRange: `(${Math.floor(FIRST_SCORE_MIN)}, ${Math.ceil(FIRST_SCORE_MAX)}) strict`,
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

    // ===== [9] TÌM LẠI CARD (TRONG APP) -> "Làm lại" =====
    log(`[9] Tìm lại card "${picked.itemName}" (cta="Làm lại")...`);
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

    // ===== [10] LÀM LẠI - target strict [${REDO_SCORE_MIN}, ${REDO_SCORE_MAX}] =====
    log(`[10] Trả lời lại ${QUESTIONS.length} câu, nhắm điểm ${redoPlan.targetScore} (range strict [${REDO_SCORE_MIN},${REDO_SCORE_MAX}])...`);
    const redoAnswer = await answerAllQuestions(bridge, exam, QUESTIONS, redoPlan.correctIndices);
    if (!redoAnswer.ok) {
      return finish({ status: redoAnswer.outcomeLabel === "BLOCKED_MISSING_EXERCISE_HANDLER" ? "BLOCKED" : "FAIL", phase: "REDO_ATTEMPT_ANSWER", error: redoAnswer.reason, evidence: { ...evidence, redoAnswerLog: redoAnswer.answerLog } });
    }
    const redoFinalTree = await pollResultScreen(bridge, exam, redoAnswer.lastOutcome?.finalTree ?? null);
    if (!exam.isResultScreen(redoFinalTree)) {
      return finish({ status: "FAIL", phase: "REDO_ATTEMPT_RESULT", error: "Không thấy màn Kết quả sau khi trả lời hết câu (Làm lại).", evidence });
    }
    const redoAttemptEndedAt = Date.now();
    const redoResult = exam.readResult(redoFinalTree);
    const redoActualScore = redoResult.score === null ? null : Number(redoResult.score);
    const redoMatched = redoActualScore !== null && !Number.isNaN(redoActualScore) && Math.abs(redoActualScore - redoPlan.targetScore) < 1e-6;
    evidence.redoAttempt = {
      targetScoreRange: `(${Math.floor(REDO_SCORE_MIN)}, ${Math.ceil(REDO_SCORE_MAX)}) strict`,
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

    // ===== [11] MÀN KẾT QUẢ CUỐI - bấm THẬT "Tiếp theo" hoặc "Hoàn thành" =====
    log(`[11] Đọc CTA thật đang hiển thị trên màn Kết quả rồi bấm THẬT...`);
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
    if (bridgeAlive) await bridge.stop();
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
      console.error("\n[e2e-giaobai-notification-lambai-strict-range] Dừng lại vì lỗi ngoài dự kiến:\n", err);
      finish({ status: "ERROR", error: err.message, stack: err.stack });
      process.exit(2);
    });
}
