#!/usr/bin/env node
/**
 * Recovery script (per [[feedback_recover_inplace_not_retry_after_partial_write]]): main script
 * e2e-giaobai-range34-lamlai-range67.mjs already PASSED [1] ASSIGN for room
 * 5b5192a9-8463-42fc-a1bd-a992c496c536 ("Choose the best response (A, B, C or D) to complete each
 * short exchange.", class 3B, due 05/11/2026, 10 scored items) but FAILed at findAssignment()
 * NOT_FOUND (list-locate flake). Operator manually opened the exercise via the in-app "giao bài"
 * notification (now sitting live on question 1/10 Doing screen) - this script attaches a bridge to
 * the ALREADY-OPEN exam and drives the rest of the flow using the SAME exported helpers as the main
 * script (no re-implementation).
 */
import { parseEnvFile } from "./src/config.js";
import { MaestroMcpBridge } from "./bridge/maestroMcpBridge.js";
import { HomeworkExamEngine } from "./bai_tap/navigation/homeworkExamEngine.js";
import { resolveHomeworkExamQuestionsForRoomId } from "./bai_tap/discovery/teacherMaterialsExamResolver.js";
import { locateCompletedCandidateOrOpenFromNotification } from "./bai_tap/discovery/locateCompletedCandidate.js";
import { centerPoint } from "./bai_tap/discovery/homeworkUiList.js";
import { resolveScoringPlanForCandidate } from "../flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs";
import { answerAllQuestions } from "../flows/web/giao_bai_tap/e2e-giaobai-range34-lamlai-range67.mjs";

const PROJECT_ROOT = new URL("..", import.meta.url).pathname;
const ROOT_ENV = parseEnvFile(PROJECT_ROOT + ".env");
const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";

const ROOM_ID = process.env.RESUME_ROOM_ID || "5b5192a9-8463-42fc-a1bd-a992c496c536";
const ITEM_NAME = process.env.RESUME_ITEM_NAME || "Choose the best response (A, B, C or D) to complete each short exchange.";
const DUE_DATE_DDMMYYYY = process.env.RESUME_DUE_DATE_DDMMYYYY || "05/11/2026";
const FIRST_SCORE_MIN = Number(process.env.FIRST_SCORE_MIN ?? 2.1), FIRST_SCORE_MAX = Number(process.env.FIRST_SCORE_MAX ?? 4.9);
const REDO_SCORE_MIN = Number(process.env.REDO_SCORE_MIN ?? 8.1), REDO_SCORE_MAX = Number(process.env.REDO_SCORE_MAX ?? 10);
const MAX_LOCATE_SCROLLS = 60;

function log(...a) { console.log(...a); }
function fmtSec(ms) { return ms == null ? "-" : `${(ms / 1000).toFixed(2)}s`; }
function collectAllTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectAllTexts(c, acc);
  return acc;
}

async function main() {
  log(`[RESUME] room_id=${ROOM_ID} item="${ITEM_NAME}" due=${DUE_DATE_DDMMYYYY}`);
  log(`[RESUME] Resolve câu hỏi/đáp án thật qua CMS...`);
  const resolved = await resolveHomeworkExamQuestionsForRoomId(ROOM_ID);
  if (resolved.status !== "RESOLVED") throw new Error(`resolveHomeworkExamQuestionsForRoomId status=${resolved.status}: ${resolved.reason}`);
  const swapAnswer = resolved.roomDetails?.room?.exams?.[0]?.is_swap_answer ?? null;
  const swapQuestion = resolved.roomDetails?.room?.exams?.[0]?.is_swap_question ?? null;
  if (swapAnswer || swapQuestion) throw new Error(`is_swap_answer=${swapAnswer}/is_swap_question=${swapQuestion} - không tin tưởng đáp án.`);
  const QUESTIONS = resolved.questions;
  log(`  [PASS] ${QUESTIONS.length} scored items.`);

  const firstPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "range", rangeMin: FIRST_SCORE_MIN, rangeMax: FIRST_SCORE_MAX });
  if (!firstPlan.achievable) throw new Error(`Không random được target trong [${FIRST_SCORE_MIN},${FIRST_SCORE_MAX}]: ${firstPlan.reason}`);
  const redoPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "range", rangeMin: REDO_SCORE_MIN, rangeMax: REDO_SCORE_MAX });
  if (!redoPlan.achievable) throw new Error(`Không random được target trong [${REDO_SCORE_MIN},${REDO_SCORE_MAX}]: ${redoPlan.reason}`);
  log(`  [PASS] targetScore lần 1=${firstPlan.targetScore} (${firstPlan.correctIndices.size}/${QUESTIONS.length}); targetScore Làm lại=${redoPlan.targetScore} (${redoPlan.correctIndices.size}/${QUESTIONS.length}).`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);

  try {
    log(`[3] Trả lời ${QUESTIONS.length} câu từ trạng thái ĐANG MỞ SẴN (câu 1), nhắm điểm ${firstPlan.targetScore}...`);
    const firstStart = Date.now();
    const firstAnswer = await answerAllQuestions(bridge, exam, QUESTIONS, firstPlan.correctIndices);
    if (!firstAnswer.ok) throw new Error(`FIRST_ATTEMPT_ANSWER: ${firstAnswer.reason}`);
    const firstFinalTree = firstAnswer.lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(firstFinalTree)) throw new Error("Không thấy màn Kết quả sau lần làm đầu.");
    const firstEnd = Date.now();
    const firstResult = exam.readResult(firstFinalTree);
    const firstActualScore = firstResult.score === null ? null : Number(firstResult.score);
    const firstMatched = firstActualScore !== null && Math.abs(firstActualScore - firstPlan.targetScore) < 1e-6;
    log(`  TARGET=${firstPlan.targetScore} ĐIỂM THẬT=${firstResult.score} MATCHED=${firstMatched} THỜI GIAN=${fmtSec(firstEnd - firstStart)}`);
    if (!firstMatched) throw new Error(`FIRST_ATTEMPT_SCORE_VERIFY: điểm thật ${firstActualScore} khác target ${firstPlan.targetScore}.`);

    const closeFirst = await bridge.runSteps([
      { runFlow: { when: { visible: "Hoàn thành" }, commands: [{ tapOn: { text: ".*(Hoàn thành).*" } }] } },
      { runFlow: { when: { visible: "Tiếp theo" }, commands: [{ tapOn: { id: "exercise_result_close_button" } }] } },
      { extendedWaitUntil: { visible: { id: "homework_screen" }, timeout: 30000 } },
    ]);
    if (!closeFirst.success) throw new Error(`CLOSE_FIRST_RESULT: ${closeFirst.error}`);
    log(`  [PASS] Đã đóng màn Kết quả (lần đầu).`);

    log(`[4] Tìm lại card "${ITEM_NAME}" (cta="Làm lại")...`);
    const relocated = await locateCompletedCandidateOrOpenFromNotification(bridge, ITEM_NAME, {
      maxScrolls: MAX_LOCATE_SCROLLS,
      expectedScore: firstActualScore,
      notificationDueDateDdMmYyyy: DUE_DATE_DDMMYYYY,
    });
    let redoStart;
    if (relocated.source === "NOTIFICATION" && relocated.alreadyOnDoingScreen) {
      log(`  [PASS] fallback thông báo PASS - đã vào màn Doing (lần 2).`);
      redoStart = Date.now();
    } else {
      const freshCandidate = relocated.candidates?.[0];
      if (!freshCandidate) throw new Error(`LOCATE_LAM_LAI: không tìm lại được card sau ${relocated.scrollsUsed} lượt cuộn.`);
      const ctaPoint = centerPoint(freshCandidate.ctaBounds);
      const tapRedo = await bridge.runSteps([
        { tapOn: { point: `${ctaPoint.x},${ctaPoint.y}` } },
        { waitForAnimationToEnd: { timeout: 3000 } },
        { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
        { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 15000 } },
      ]);
      redoStart = Date.now();
      if (!tapRedo.success) throw new Error(`TAP_LAM_LAI: ${tapRedo.error}`);
      log(`  [PASS] Đã tap "Làm lại".`);
    }

    log(`[5] Trả lời lại ${QUESTIONS.length} câu, nhắm điểm ${redoPlan.targetScore}...`);
    const redoAnswer = await answerAllQuestions(bridge, exam, QUESTIONS, redoPlan.correctIndices);
    if (!redoAnswer.ok) throw new Error(`REDO_ATTEMPT_ANSWER: ${redoAnswer.reason}`);
    const redoFinalTree = redoAnswer.lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(redoFinalTree)) throw new Error("Không thấy màn Kết quả sau Làm lại.");
    const redoEnd = Date.now();
    const redoResult = exam.readResult(redoFinalTree);
    const redoActualScore = redoResult.score === null ? null : Number(redoResult.score);
    const redoMatched = redoActualScore !== null && Math.abs(redoActualScore - redoPlan.targetScore) < 1e-6;
    log(`  TARGET=${redoPlan.targetScore} ĐIỂM THẬT=${redoResult.score} MATCHED=${redoMatched} THỜI GIAN=${fmtSec(redoEnd - redoStart)}`);
    if (!redoMatched) throw new Error(`REDO_ATTEMPT_SCORE_VERIFY: điểm thật ${redoActualScore} khác target ${redoPlan.targetScore}.`);

    log(`[6] Đọc CTA thật trên màn Kết quả cuối rồi bấm THẬT...`);
    const ctaTexts = collectAllTexts(redoFinalTree);
    const hasTiepTheo = ctaTexts.some((t) => /Tiếp theo/.test(t));
    const hasHoanThanh = ctaTexts.some((t) => /Hoàn thành/.test(t));
    if (!hasTiepTheo && !hasHoanThanh) throw new Error(`FINAL_CTA_DETECT: không thấy CTA. Texts: ${JSON.stringify(ctaTexts)}`);
    const ctaToTap = hasTiepTheo ? "Tiếp theo" : "Hoàn thành";
    const tapFinalCta = await bridge.runSteps([{ tapOn: { text: `.*(${ctaToTap}).*` } }]);
    if (!tapFinalCta.success) throw new Error(`FINAL_CTA_TAP: ${tapFinalCta.error}`);
    const landExpectation = ctaToTap === "Tiếp theo" ? { id: "exercise_close_button" } : { id: "homework_screen" };
    const landResult = await bridge.wait(landExpectation, { timeout: 30000 });
    log(`  [PASS] Đã bấm THẬT "${ctaToTap}" - landed=${landResult.success}`);

    console.log("\n[OVERALL] PASS");
    console.log(JSON.stringify({
      room_id: ROOM_ID, item: ITEM_NAME,
      firstAttempt: { target: firstPlan.targetScore, actual: firstActualScore },
      redoAttempt: { target: redoPlan.targetScore, actual: redoActualScore },
      finalCta: { cta: ctaToTap, landed: landResult.success },
    }, null, 2));
  } catch (err) {
    console.error("\n[OVERALL] FAIL/ERROR:", err.message);
    process.exitCode = 1;
  } finally {
    await bridge.stop();
    log("[MCP] Đã dừng tiến trình `maestro mcp`.");
  }
}

main();
