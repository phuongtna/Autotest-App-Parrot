#!/usr/bin/env node
/**
 * RECOVERY (per [[feedback_recover_inplace_not_retry_after_partial_write]]) - room
 * dcf7d807-63b7-4dce-8a8e-99ee8feb64a5 ("You hear these sentences. Choose the correct meaning or
 * month (A, B, C or D).", class 4D, due 28/10/2026) already had a REAL, correctly-scored lần 1
 * (target=2/10 actual=2/10, PASS) via `e2e-giaobai-range34-lamlai-range67.mjs` - that run then FAILed
 * at LOCATE_LAM_LAI (both list-scan AND the script's own notification fallback missed it, likely
 * pushed out of the bell's visible range by other notifications generated this session). Manually
 * found a late-arriving "reminder" notification (different wording, same title+due-date) and tapped
 * it live -> confirmed on-device, already sitting on a FRESH Doing screen (Q1 unanswered) for lần 2.
 * This script picks up EXACTLY from there: do NOT re-run the full assign script (would create a 3rd
 * real room) - just resolve the room's real questions/scoring plan and finish the already-open lần 2
 * attempt, reusing the same exported helpers, nothing re-implemented.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseEnvFile } from "../../../automation/src/config.js";
import { MaestroMcpBridge } from "../../../automation/bridge/maestroMcpBridge.js";
import { HomeworkExamEngine } from "../../../automation/bai_tap/navigation/homeworkExamEngine.js";
import { resolveHomeworkExamQuestionsForRoomId } from "../../../automation/bai_tap/discovery/teacherMaterialsExamResolver.js";
import { resolveScoringPlanForCandidate } from "./e2e-teacher-assign-full-scored-target5.mjs";
import { answerAllQuestions } from "./e2e-giaobai-range34-lamlai-range67.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "recover_room_dcf7d807_lan2_report.json");
const EXAM_SESSION_PATH = join(PROJECT_ROOT, "automation", ".cache", "exam_session.json");
const ROOT_ENV = parseEnvFile(join(PROJECT_ROOT, ".env"));

const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const ROOM_ID = "dcf7d807-63b7-4dce-8a8e-99ee8feb64a5";
const REDO_SCORE_MIN = 8.1;
const REDO_SCORE_MAX = 10;

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
    log(`[2] Xác nhận đang ở màn Doing (lần 2 đã mở sẵn qua thông báo thủ công)...`);
    const check = await bridge.wait({ id: "exercise_close_button" }, { timeout: 10000 });
    if (!check.success) return finish({ status: "FAIL", phase: "PRECONDITION_DOING_SCREEN", error: `Không xác nhận đang ở màn Doing: ${check.error}`, evidence });
    log(`  [PASS] Đang ở màn Doing.`);
    const redoAttemptStartedAt = Date.now();

    log(`[3] Trả lời ${QUESTIONS.length} câu, nhắm điểm ${redoPlan.targetScore} (range [${REDO_SCORE_MIN},${REDO_SCORE_MAX}])...`);
    const redoAnswer = await answerAllQuestions(bridge, exam, QUESTIONS, redoPlan.correctIndices);
    if (!redoAnswer.ok) {
      return finish({ status: redoAnswer.outcomeLabel === "BLOCKED_MISSING_EXERCISE_HANDLER" ? "BLOCKED" : "FAIL", phase: "REDO_ATTEMPT_ANSWER", error: redoAnswer.reason, evidence: { ...evidence, redoAnswerLog: redoAnswer.answerLog } });
    }
    // [[project_result_screen_confetti_animation_race]] - poll instead of a single isResultScreen()
    // check (which already burned 1 real extra attempt this session when it false-negatived once).
    let redoFinalTree = redoAnswer.lastOutcome?.finalTree ?? null;
    let resultConfirmed = exam.isResultScreen(redoFinalTree);
    for (let i = 0; i < 5 && !resultConfirmed; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      redoFinalTree = await bridge.hierarchy();
      resultConfirmed = exam.isResultScreen(redoFinalTree);
    }
    if (!resultConfirmed) return finish({ status: "FAIL", phase: "REDO_ATTEMPT_RESULT", error: "Không thấy màn Kết quả sau 5 lượt poll (7.5s).", evidence });
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

    // DELIBERATELY KHÔNG tap CTA cuối ở đây (khác bản gốc) - lần recover trước, ngay sau khi
    // answerAllQuestions() trả về finalTree KHÔNG phải màn Kết quả (false-negative race), 1 attempt
    // thứ 3 KHÔNG mong muốn (5/10) đã xuất hiện trên server ~40s sau, nguồn gốc chưa xác định chắc
    // chắn (nghi animation/CTA-tap race) - mục tiêu của lần redo này CHỈ là "lần 2 đạt range", KHÔNG
    // bắt buộc phải điều hướng tiếp, nên dừng lại NGAY sau khi đã verify điểm qua UI, để màn Kết quả
    // yên, không tap gì thêm.
    log(`  [PASS] Dừng lại ở màn Kết quả (không tap CTA tiếp - tránh nguy cơ lặp lại chain ngoài ý muốn).`);

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
    console.error("[_scratch_recover_room_dcf7d807_lan2] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    process.exit(2);
  });
