#!/usr/bin/env node
/**
 * RECOVERY script (per [[feedback_recover_inplace_not_retry_after_partial_write]]) - room
 * 83d9c443-889c-4efe-a3a7-ea18dd00ef84 ("Choose the correct answer to complete the sentences",
 * class 3B, due 28/10/2026) was ALREADY assigned successfully by
 * `e2e-giaobai-range34-lamlai-range67.mjs` (assignResult PASS, 10 scored items resolved) but the
 * run FAILed at OPEN_NEW_ASSIGNMENT (findAssignment() NOT_FOUND - known 3B
 * [[project_3b_carousel_swipe_swallow_locate_bug_2026_09_17]]/[[project_new_room_invisible_in_homework_list_bug]]
 * class of flakiness). Do NOT re-run the full script (would create a 2nd real orphaned room) -
 * recover against the SAME room: reuse resolveHomeworkExamQuestionsForRoomId()/
 * resolveScoringPlanForCandidate()/answerAllQuestions()/locateCompletedCandidateOrOpenFromNotification()
 * (all imported, none re-implemented), open the FIRST attempt via the in-app "giao bài"
 * notification (openExerciseViaGiaoBaiNotification - bypasses the list-locate bug entirely, works
 * "regardless of completed or not" per its own docblock) instead of findAssignment().
 *
 * Score ranges: lần 1 (1.1,4.9] inclusive both ends -> ">1 và <5đ"; lần 2 [8.1,10] -> ">8 và <=10đ".
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseEnvFile } from "../../../automation/src/config.js";
import { MaestroMcpBridge } from "../../../automation/bridge/maestroMcpBridge.js";
import { HomeworkExamEngine } from "../../../automation/bai_tap/navigation/homeworkExamEngine.js";
import { resolveHomeworkExamQuestionsForRoomId } from "../../../automation/bai_tap/discovery/teacherMaterialsExamResolver.js";
import { locateCompletedCandidateOrOpenFromNotification } from "../../../automation/bai_tap/discovery/locateCompletedCandidate.js";
import { centerPoint } from "../../../automation/bai_tap/discovery/homeworkUiList.js";
import { openExerciseViaGiaoBaiNotification } from "../../../automation/thong_bao/notificationGiaoBaiFallback.js";
import { resolveScoringPlanForCandidate } from "./e2e-teacher-assign-full-scored-target5.mjs";
import { answerAllQuestions } from "./e2e-giaobai-range34-lamlai-range67.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "recover_room_83d9c443_report.json");
const EXAM_SESSION_PATH = join(PROJECT_ROOT, "automation", ".cache", "exam_session.json");
const ROOT_ENV = parseEnvFile(join(PROJECT_ROOT, ".env"));

const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";

// Parameterized via env (2026-10-21, reused across several rounds this session) - defaults keep
// the original 83d9c443/3B case runnable unchanged if invoked with no overrides.
const ROOM_ID = process.env.ROOM_ID || "83d9c443-889c-4efe-a3a7-ea18dd00ef84";
const ITEM_NAME = process.env.ITEM_NAME || "Choose the correct answer to complete the sentences";
const DUE_DATE_DD_MM_YYYY = process.env.DUE_DATE_DD_MM_YYYY || "28/10/2026";
const FIRST_SCORE_MIN = Number(process.env.FIRST_SCORE_MIN ?? 1.1);
const FIRST_SCORE_MAX = Number(process.env.FIRST_SCORE_MAX ?? 4.9);
const REDO_SCORE_MIN = Number(process.env.REDO_SCORE_MIN ?? 8.1);
const REDO_SCORE_MAX = Number(process.env.REDO_SCORE_MAX ?? 10);
const MAX_LOCATE_SCROLLS = 60;
const PROFILE_NAME = process.env.PROFILE_NAME || "Ngoc";

function log(...a) { console.log(...a); }
function fmtSec(ms) { return ms == null ? "-" : `${(ms / 1000).toFixed(2)}s`; }

function refreshExamSessionFromEnvCookie() {
  const examCookie = process.env.EXAM_COOKIE || ROOT_ENV.EXAM_COOKIE;
  if (!examCookie) return { refreshed: false, reason: "EXAM_COOKIE không tồn tại trong .env." };
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

function finish(result) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  return result;
}

async function main() {
  if (!APP_ID) throw new Error("Thiếu APP_ID.");
  const evidence = { roomId: ROOM_ID, itemName: ITEM_NAME };
  const overallStart = Date.now();

  log(`[0] Refresh exam_session.json...`);
  const sess = refreshExamSessionFromEnvCookie();
  if (!sess.refreshed) return finish({ status: "BLOCKED", phase: "EXAM_SESSION_REFRESH", error: sess.reason, evidence });
  log(`  [PASS]`);

  log(`[1] Resolve câu hỏi/đáp án thật qua CMS cho room_id=${ROOM_ID}...`);
  const resolved = await resolveHomeworkExamQuestionsForRoomId(ROOM_ID);
  if (resolved.status !== "RESOLVED") {
    return finish({ status: "BLOCKED", phase: "RESOLVE_QUESTIONS", error: `status=${resolved.status}: ${resolved.reason}`, evidence });
  }
  const swapAnswer = resolved.roomDetails?.room?.exams?.[0]?.is_swap_answer ?? null;
  const swapQuestion = resolved.roomDetails?.room?.exams?.[0]?.is_swap_question ?? null;
  if (swapAnswer || swapQuestion) {
    return finish({ status: "BLOCKED", phase: "RESOLVE_QUESTIONS", error: `is_swap_answer=${swapAnswer}/is_swap_question=${swapQuestion}.`, evidence });
  }
  const QUESTIONS = resolved.questions;
  evidence.totalScoredItems = QUESTIONS.length;
  log(`  [PASS] ${QUESTIONS.length} scored items.`);

  const firstPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "range", rangeMin: FIRST_SCORE_MIN, rangeMax: FIRST_SCORE_MAX });
  if (!firstPlan.achievable) return finish({ status: "BLOCKED", phase: "FIRST_SCORE_PLAN", error: firstPlan.reason, evidence });
  const redoPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "range", rangeMin: REDO_SCORE_MIN, rangeMax: REDO_SCORE_MAX });
  if (!redoPlan.achievable) return finish({ status: "BLOCKED", phase: "REDO_SCORE_PLAN", error: redoPlan.reason, evidence });
  log(`  [PASS] targetScore lần 1=${firstPlan.targetScore} (${firstPlan.correctIndices.size}/${QUESTIONS.length}); targetScore lần 2=${redoPlan.targetScore} (${redoPlan.correctIndices.size}/${QUESTIONS.length}).`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);

  try {
    log(`[2] Đưa app về tab "Bài tập" (xác nhận hồ sơ "${PROFILE_NAME}" vẫn active)...`);
    const nav = await bridge.runSteps([
      { launchApp: { permissions: { all: "allow" } } },
      { extendedWaitUntil: { visible: { text: ".*(Vui học|Bài tập|Báo cáo).*" }, timeout: 30000 } },
      { tapOn: { text: "Bài tập" } },
      { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao|Bạn không có bài tập nào đang chờ).*" }, timeout: 30000 } },
    ]);
    if (!nav.success) return finish({ status: "FAIL", phase: "NAV_BAI_TAP", error: nav.error, evidence });
    const texts = collectAllTexts(await bridge.hierarchy());
    const profileActive = texts.some((t) => t.includes(PROFILE_NAME));
    evidence.profileActive = profileActive;
    if (!profileActive) {
      return finish({ status: "BLOCKED", phase: "PROFILE_CHECK", error: `Hồ sơ "${PROFILE_NAME}" không còn active. Texts: ${JSON.stringify(texts.slice(0, 10))}`, evidence });
    }
    log(`  [PASS] "${PROFILE_NAME}" active.`);

    // ===== [3] MỞ LẦN LÀM ĐẦU qua thông báo "giao bài" (bypass findAssignment() đã NOT_FOUND) =====
    log(`[3] Mở "${ITEM_NAME}" (hạn nộp ${DUE_DATE_DD_MM_YYYY}) qua thông báo "giao bài"...`);
    const openFirst = await openExerciseViaGiaoBaiNotification(bridge, { title: ITEM_NAME, dueDateDdMmYyyy: DUE_DATE_DD_MM_YYYY });
    if (!openFirst.ok) {
      return finish({ status: "FAIL", phase: "OPEN_NEW_ASSIGNMENT_VIA_NOTIFICATION", error: openFirst.reason, evidence: { ...evidence, landedTexts: openFirst.landedTexts } });
    }
    const firstAttemptStartedAt = Date.now();
    log(`  [PASS] Đã vào màn Doing (lần làm đầu) qua thông báo: "${openFirst.matchedNotificationText}".`);

    log(`[3] Trả lời ${QUESTIONS.length} câu, nhắm điểm ${firstPlan.targetScore} (range (${FIRST_SCORE_MIN},${FIRST_SCORE_MAX}))...`);
    const firstAnswer = await answerAllQuestions(bridge, exam, QUESTIONS, firstPlan.correctIndices);
    if (!firstAnswer.ok) {
      return finish({ status: firstAnswer.outcomeLabel === "BLOCKED_MISSING_EXERCISE_HANDLER" ? "BLOCKED" : "FAIL", phase: "FIRST_ATTEMPT_ANSWER", error: firstAnswer.reason, evidence: { ...evidence, firstAnswerLog: firstAnswer.answerLog } });
    }
    // [[project_result_screen_confetti_animation_race]] - poll instead of 1 check (a single
    // false-negative here burned a real extra attempt once this session, see
    // [[feedback_no_parallel_maestro_during_active_bridge_session]]).
    let firstFinalTree = firstAnswer.lastOutcome?.finalTree ?? null;
    let firstResultConfirmed = exam.isResultScreen(firstFinalTree);
    for (let i = 0; i < 5 && !firstResultConfirmed; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      firstFinalTree = await bridge.hierarchy();
      firstResultConfirmed = exam.isResultScreen(firstFinalTree);
    }
    if (!firstResultConfirmed) {
      return finish({ status: "FAIL", phase: "FIRST_ATTEMPT_RESULT", error: "Không thấy màn Kết quả sau 5 lượt poll (lần làm đầu).", evidence });
    }
    const firstAttemptEndedAt = Date.now();
    const firstResult = exam.readResult(firstFinalTree);
    const firstActualScore = firstResult.score === null ? null : Number(firstResult.score);
    const firstMatched = firstActualScore !== null && !Number.isNaN(firstActualScore) && Math.abs(firstActualScore - firstPlan.targetScore) < 1e-6;
    evidence.firstAttempt = {
      targetScoreRange: `(${FIRST_SCORE_MIN}, ${FIRST_SCORE_MAX})`,
      targetScore: firstPlan.targetScore,
      actualScore: firstActualScore,
      correct: firstResult.correct,
      matched: firstMatched,
      timing: { startedAtIso: new Date(firstAttemptStartedAt).toISOString(), endedAtIso: new Date(firstAttemptEndedAt).toISOString(), durationMs: firstAttemptEndedAt - firstAttemptStartedAt, perQuestion: firstAnswer.perQuestion },
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
    if (!closeFirst.success) return finish({ status: "FAIL", phase: "CLOSE_FIRST_RESULT", error: closeFirst.error, evidence });
    log(`  [PASS] Đã đóng màn Kết quả (lần đầu).`);

    // ===== [4] TÌM LẠI CARD "Làm lại" (list-locate, fallback qua thông báo nếu cần) =====
    log(`[4] Tìm lại card "${ITEM_NAME}" (cta="Làm lại")...`);
    const relocated = await locateCompletedCandidateOrOpenFromNotification(bridge, ITEM_NAME, {
      maxScrolls: MAX_LOCATE_SCROLLS,
      expectedScore: firstActualScore,
      notificationDueDateDdMmYyyy: DUE_DATE_DD_MM_YYYY,
    });
    evidence.locateLamLai = { source: relocated.source, scrollsUsed: relocated.scrollsUsed, stopReasonBeforeFallback: relocated.stopReasonBeforeFallback ?? null };
    if (relocated.notificationFallback) evidence.locateLamLai.notificationFallback = relocated.notificationFallback;

    let redoAttemptStartedAt;
    if (relocated.source === "NOTIFICATION" && relocated.alreadyOnDoingScreen) {
      log(`  [PASS] fallback qua thông báo "giao bài" PASS, đã vào màn Doing (lần 2).`);
      redoAttemptStartedAt = Date.now();
    } else {
      const freshCandidate = relocated.candidates?.[0];
      if (!freshCandidate) {
        return finish({ status: "FAIL", phase: "LOCATE_LAM_LAI", error: `Không tìm lại được card sau ${relocated.scrollsUsed} lượt cuộn.` + (relocated.notificationFallback ? ` Fallback cũng fail: ${relocated.notificationFallback.reason}` : ""), evidence });
      }
      const ctaPoint = centerPoint(freshCandidate.ctaBounds);
      const tapRedo = await bridge.runSteps([
        { tapOn: { point: `${ctaPoint.x},${ctaPoint.y}` } },
        { waitForAnimationToEnd: { timeout: 3000 } },
        { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
        { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 15000 } },
      ]);
      redoAttemptStartedAt = Date.now();
      if (!tapRedo.success) return finish({ status: "FAIL", phase: "TAP_LAM_LAI", error: tapRedo.error, evidence });
      log(`  [PASS] Đã tap "Làm lại" - vào màn Doing (lần 2).`);
    }

    // ===== [5] LÀM LẠI - target ~REDO =====
    log(`[5] Trả lời lại ${QUESTIONS.length} câu, nhắm điểm ${redoPlan.targetScore} (range [${REDO_SCORE_MIN},${REDO_SCORE_MAX}])...`);
    const redoAnswer = await answerAllQuestions(bridge, exam, QUESTIONS, redoPlan.correctIndices);
    if (!redoAnswer.ok) {
      return finish({ status: redoAnswer.outcomeLabel === "BLOCKED_MISSING_EXERCISE_HANDLER" ? "BLOCKED" : "FAIL", phase: "REDO_ATTEMPT_ANSWER", error: redoAnswer.reason, evidence: { ...evidence, redoAnswerLog: redoAnswer.answerLog } });
    }
    let redoFinalTree = redoAnswer.lastOutcome?.finalTree ?? null;
    let redoResultConfirmed = exam.isResultScreen(redoFinalTree);
    for (let i = 0; i < 5 && !redoResultConfirmed; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      redoFinalTree = await bridge.hierarchy();
      redoResultConfirmed = exam.isResultScreen(redoFinalTree);
    }
    if (!redoResultConfirmed) {
      return finish({ status: "FAIL", phase: "REDO_ATTEMPT_RESULT", error: "Không thấy màn Kết quả sau 5 lượt poll (Làm lại).", evidence });
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
      timing: { startedAtIso: new Date(redoAttemptStartedAt).toISOString(), endedAtIso: new Date(redoAttemptEndedAt).toISOString(), durationMs: redoAttemptEndedAt - redoAttemptStartedAt, perQuestion: redoAnswer.perQuestion },
    };
    log(`  TARGET=${redoPlan.targetScore} ĐIỂM THẬT=${redoResult.score} CHÍNH XÁC=${redoResult.correct} THỜI GIAN=${fmtSec(redoAttemptEndedAt - redoAttemptStartedAt)}`);
    if (!redoMatched) {
      return finish({ status: "FAIL", phase: "REDO_ATTEMPT_SCORE_VERIFY", error: `Điểm thật ${redoActualScore} KHÁC target ${redoPlan.targetScore}.`, evidence });
    }

    // DELIBERATELY KHÔNG tap CTA cuối (xem [[feedback_no_parallel_maestro_during_active_bridge_session]]
    // - 1 lần round trước, tap CTA cuối sau 1 false-negative result-check đã kéo theo 1 attempt thứ
    // 3 ngoài ý muốn). Mục tiêu CHỈ là "lần 2 đạt range" - dừng ở màn Kết quả sau khi verify điểm.
    log(`  [PASS] Dừng lại ở màn Kết quả (không tap CTA tiếp).`);

    evidence.totalDurationSeconds = (Date.now() - overallStart) / 1000;
    return finish({ status: "PASS", evidence });
  } catch (err) {
    return finish({ status: "ERROR", error: err.message, stack: err.stack, evidence });
  } finally {
    await bridge.stop();
    log("[MCP] Đã dừng tiến trình `maestro mcp`.");
  }
}

main()
  .then((result) => {
    console.log(`\n[RESULT] ${result.status} ${result.phase ?? ""} ${result.error ?? ""}`);
    console.log(JSON.stringify(result.evidence ?? {}, null, 2));
    console.log(`Đã ghi report ra ${OUTPUT_FILE}`);
    process.exit(result.status === "PASS" ? 0 : result.status === "BLOCKED" ? 3 : 1);
  })
  .catch((err) => {
    console.error("[_scratch_recover_room_83d9c443] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    process.exit(2);
  });
