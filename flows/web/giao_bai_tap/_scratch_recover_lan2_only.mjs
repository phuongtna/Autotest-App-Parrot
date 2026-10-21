#!/usr/bin/env node
/**
 * RECOVERY (per [[feedback_recover_inplace_not_retry_after_partial_write]]) - GENERIC lần-2-only
 * resume: room already has a REAL, correctly-scored lần 1 (status="done" on server, confirmed via
 * fetchRoomDetails before running this), but the main script got killed/crashed before or during
 * lần 2 (e.g. a hung maestro driver - [[project_maestro_driver_died_navigate_fail]], 0% CPU on
 * dev.mobile.maestro while "stuck" on a locate step). Does NOT assume the Doing screen is already
 * open (unlike the dcf7d807-specific script) - starts from the homework list, uses
 * locateCompletedCandidateOrOpenFromNotification() (list-scan + its own title+score-based
 * notification fallback) to find/open "Làm lại" itself.
 *
 * ENV: ROOM_ID, ITEM_NAME, DUE_DATE_DD_MM_YYYY ("DD/MM/YYYY"), EXPECTED_FIRST_SCORE (real score of
 * the already-done lần 1, for disambiguating same-titled cards), REDO_SCORE_MIN/MAX, PROFILE_NAME.
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
import { resolveScoringPlanForCandidate } from "./e2e-teacher-assign-full-scored-target5.mjs";
import { answerAllQuestions } from "./e2e-giaobai-range34-lamlai-range67.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "recover_lan2_only_report.json");
const EXAM_SESSION_PATH = join(PROJECT_ROOT, "automation", ".cache", "exam_session.json");
const ROOT_ENV = parseEnvFile(join(PROJECT_ROOT, ".env"));

const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const ROOM_ID = process.env.ROOM_ID;
const ITEM_NAME = process.env.ITEM_NAME;
const DUE_DATE_DD_MM_YYYY = process.env.DUE_DATE_DD_MM_YYYY;
const EXPECTED_FIRST_SCORE = Number(process.env.EXPECTED_FIRST_SCORE);
const REDO_SCORE_MIN = Number(process.env.REDO_SCORE_MIN ?? 8.1);
const REDO_SCORE_MAX = Number(process.env.REDO_SCORE_MAX ?? 10);
const PROFILE_NAME = process.env.PROFILE_NAME || "Ngoc";
const MAX_LOCATE_SCROLLS = 60;

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
  if (!ROOM_ID || !ITEM_NAME || !DUE_DATE_DD_MM_YYYY || Number.isNaN(EXPECTED_FIRST_SCORE)) {
    throw new Error("Thiếu ROOM_ID/ITEM_NAME/DUE_DATE_DD_MM_YYYY/EXPECTED_FIRST_SCORE.");
  }
  const evidence = { roomId: ROOM_ID };
  const overallStart = Date.now();

  log(`[0] Refresh exam_session.json...`);
  const sess = refreshExamSessionFromEnvCookie();
  if (!sess.refreshed) return finish({ status: "BLOCKED", phase: "EXAM_SESSION_REFRESH", error: sess.reason, evidence });

  log(`[1] Resolve câu hỏi thật room_id=${ROOM_ID}...`);
  const resolved = await resolveHomeworkExamQuestionsForRoomId(ROOM_ID);
  if (resolved.status !== "RESOLVED") return finish({ status: "BLOCKED", phase: "RESOLVE_QUESTIONS", error: `status=${resolved.status}: ${resolved.reason}`, evidence });
  const QUESTIONS = resolved.questions;
  evidence.totalScoredItems = QUESTIONS.length;
  log(`  [PASS] ${QUESTIONS.length} scored items.`);

  const redoPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "range", rangeMin: REDO_SCORE_MIN, rangeMax: REDO_SCORE_MAX });
  if (!redoPlan.achievable) return finish({ status: "BLOCKED", phase: "REDO_SCORE_PLAN", error: redoPlan.reason, evidence });
  log(`  [PASS] targetScore lần 2=${redoPlan.targetScore} (${redoPlan.correctIndices.size}/${QUESTIONS.length}).`);

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
    if (!profileActive) return finish({ status: "BLOCKED", phase: "PROFILE_CHECK", error: `Hồ sơ "${PROFILE_NAME}" không active.`, evidence });
    log(`  [PASS] "${PROFILE_NAME}" active.`);

    log(`[3] Tìm card "${ITEM_NAME}" (cta="Làm lại", expectedScore=${EXPECTED_FIRST_SCORE})...`);
    const relocated = await locateCompletedCandidateOrOpenFromNotification(bridge, ITEM_NAME, {
      maxScrolls: MAX_LOCATE_SCROLLS,
      expectedScore: EXPECTED_FIRST_SCORE,
      notificationDueDateDdMmYyyy: DUE_DATE_DD_MM_YYYY,
    });
    evidence.locateLamLai = { source: relocated.source, scrollsUsed: relocated.scrollsUsed, stopReasonBeforeFallback: relocated.stopReasonBeforeFallback ?? null };
    if (relocated.notificationFallback) evidence.locateLamLai.notificationFallback = relocated.notificationFallback;

    if (relocated.source === "NOTIFICATION" && relocated.alreadyOnDoingScreen) {
      log(`  [PASS] fallback qua thông báo "giao bài" PASS, đã vào màn Doing (lần 2).`);
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
      if (!tapRedo.success) return finish({ status: "FAIL", phase: "TAP_LAM_LAI", error: tapRedo.error, evidence });
      log(`  [PASS] Đã tap "Làm lại" - vào màn Doing (lần 2).`);
    }
    const redoAttemptStartedAt = Date.now();

    log(`[4] Trả lời ${QUESTIONS.length} câu, nhắm điểm ${redoPlan.targetScore} (range [${REDO_SCORE_MIN},${REDO_SCORE_MAX}])...`);
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
    if (!redoResultConfirmed) return finish({ status: "FAIL", phase: "REDO_ATTEMPT_RESULT", error: "Không thấy màn Kết quả sau 5 lượt poll.", evidence });
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
    if (!redoMatched) return finish({ status: "FAIL", phase: "REDO_ATTEMPT_SCORE_VERIFY", error: `Điểm thật ${redoActualScore} KHÁC target ${redoPlan.targetScore}.`, evidence });

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
    process.exit(result.status === "PASS" ? 0 : result.status === "BLOCKED" ? 3 : 1);
  })
  .catch((err) => {
    console.error("[_scratch_recover_lan2_only] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    process.exit(2);
  });
