#!/usr/bin/env node
/**
 * Recover round 7 (2026-11-13): main script's findAssignment() reported NOT_FOUND for the newly
 * assigned room (list-locate strategies A/B couldn't observe scroll progress past a pile of old
 * debris cards) even though the card genuinely exists further down the list - confirmed by manual
 * scroll+screenshot. Manually tapped the card's "Làm bài" CTA; device is now sitting on question
 * 1/10 of the Doing screen RIGHT NOW. Recover in place
 * ([[feedback_recover_inplace_not_retry_after_partial_write]]): finish the FULL round (lần 1 + tìm
 * lại "Làm lại" + lần 2) reusing the SAME exported helpers as the main script (no new engine).
 *
 * room_id=76e37d35-9c17-447d-af95-d73ce2c4d4c4, item="Read the passage and decide whether each
 * statement is True (T) or False (F).", due 29/11/2026, PROFILE_NAME=Gia Linh, PHONE=0915775115,
 * class=3B. firstPlan targetScore=5 (same as main script already resolved), redoPlan range [9,10].
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnvFile } from "./src/config.js";
import { MaestroMcpBridge } from "./bridge/maestroMcpBridge.js";
import { HomeworkExamEngine } from "./bai_tap/navigation/homeworkExamEngine.js";
import { resolveHomeworkExamQuestionsForRoomId } from "./bai_tap/discovery/teacherMaterialsExamResolver.js";
import { locateCompletedCandidateOrOpenFromNotification } from "./bai_tap/discovery/locateCompletedCandidate.js";
import { centerPoint } from "./bai_tap/discovery/homeworkUiList.js";
import { resolveScoringPlanForCandidate } from "../flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs";
import { answerAllQuestions } from "../flows/web/giao_bai_tap/e2e-giaobai-range34-lamlai-range67.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..");
const ROOT_ENV = parseEnvFile(join(PROJECT_ROOT, ".env"));
const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;

const ROOM_ID = "307cf6f6-3e43-4433-8915-83caacb6c4ff";
const ITEM_NAME = "Choose the correct answer to complete the sentences";
const DUE_DATE_DDMMYYYY = "30/11/2026";
const FIRST_TARGET_SCORE = 6;
const REDO_SCORE_MIN = 9;
const REDO_SCORE_MAX = 10;
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "scratch_round8_20261113_full_recovery_report.json");

function log(...a) { console.log(...a); }
function fmtSec(ms) { return (ms / 1000).toFixed(2) + "s"; }

async function main() {
  const resolved = await resolveHomeworkExamQuestionsForRoomId(ROOM_ID);
  if (resolved.status !== "RESOLVED") throw new Error(`resolve FAIL: ${resolved.status}/${resolved.reason}`);
  const QUESTIONS = resolved.questions;
  log(`[PASS] ${QUESTIONS.length} scored items resolved từ CMS cho room ${ROOM_ID}.`);

  const firstPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "target", targetScoreEnv: FIRST_TARGET_SCORE });
  if (!firstPlan.achievable) throw new Error(`Không rebuild được plan target=${FIRST_TARGET_SCORE}: ${firstPlan.reason}`);
  const redoPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "range", rangeMin: REDO_SCORE_MIN, rangeMax: REDO_SCORE_MAX });
  if (!redoPlan.achievable) throw new Error(`Không random được target Làm lại trong [${REDO_SCORE_MIN},${REDO_SCORE_MAX}]: ${redoPlan.reason}`);
  log(`[PASS] targetScore lần 1=${firstPlan.targetScore}; targetScore Làm lại=${redoPlan.targetScore}.`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: "" });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);
  let result = { status: "ERROR" };
  try {
    log(`[3] Đã sẵn sàng ở màn Doing (lần đầu, câu 1/${QUESTIONS.length} đang hiển thị) - trả lời ${QUESTIONS.length} câu, nhắm điểm ${firstPlan.targetScore}...`);
    const firstAttemptStartedAt = Date.now();
    const firstAnswer = await answerAllQuestions(bridge, exam, QUESTIONS, firstPlan.correctIndices);
    if (!firstAnswer.ok) throw new Error(`answerAllQuestions FAIL (lần đầu): ${firstAnswer.reason}`);
    const firstFinalTree = firstAnswer.lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(firstFinalTree)) throw new Error("Không thấy màn Kết quả (lần đầu).");
    const firstAttemptEndedAt = Date.now();
    const firstResult = exam.readResult(firstFinalTree);
    const firstActualScore = firstResult.score === null ? null : Number(firstResult.score);
    const firstMatched = firstActualScore !== null && !Number.isNaN(firstActualScore) && Math.abs(firstActualScore - firstPlan.targetScore) < 1e-6;
    log(`  TARGET=${firstPlan.targetScore} ĐIỂM THẬT=${firstResult.score} CHÍNH XÁC=${firstResult.correct} THỜI GIAN=${fmtSec(firstAttemptEndedAt - firstAttemptStartedAt)}`);
    if (!firstMatched) throw new Error(`Điểm thật ${firstActualScore} KHÁC target ${firstPlan.targetScore} (lần đầu).`);

    const closeFirst = await bridge.runSteps([
      { runFlow: { when: { visible: "Hoàn thành" }, commands: [{ tapOn: { text: ".*(Hoàn thành).*" } }] } },
      { runFlow: { when: { visible: "Tiếp theo" }, commands: [{ tapOn: { id: "exercise_result_close_button" } }] } },
      { extendedWaitUntil: { visible: { id: "homework_screen" }, timeout: 30000 } },
    ]);
    if (!closeFirst.success) throw new Error(`Không quay lại homework_screen sau lần đầu: ${closeFirst.error}`);
    log(`  [PASS] Đã đóng màn Kết quả (lần đầu), về lại danh sách Bài tập.`);

    log(`[4] Tìm lại card "${ITEM_NAME}" (cta="Làm lại")...`);
    const relocated = await locateCompletedCandidateOrOpenFromNotification(bridge, ITEM_NAME, {
      maxScrolls: 60,
      expectedScore: firstActualScore,
      notificationDueDateDdMmYyyy: DUE_DATE_DDMMYYYY,
    });
    let redoAttemptStartedAt;
    if (relocated.source === "NOTIFICATION" && relocated.alreadyOnDoingScreen) {
      log(`  [PASS] fallback qua thông báo "giao bài" PASS, đã vào màn Doing (lần 2).`);
      redoAttemptStartedAt = Date.now();
    } else {
      const freshCandidate = relocated.candidates?.[0];
      if (!freshCandidate) throw new Error(`Không tìm lại được card "Làm lại" sau ${relocated.scrollsUsed} lượt cuộn.`);
      const ctaPoint = centerPoint(freshCandidate.ctaBounds);
      const tapRedo = await bridge.runSteps([
        { tapOn: { point: `${ctaPoint.x},${ctaPoint.y}` } },
        { waitForAnimationToEnd: { timeout: 3000 } },
        { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
        { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 15000 } },
      ]);
      redoAttemptStartedAt = Date.now();
      if (!tapRedo.success) throw new Error(`Tap "Làm lại" thất bại: ${tapRedo.error}`);
      log(`  [PASS] Đã tap "Làm lại" - vào màn Doing (lần 2).`);
    }

    log(`[5] Trả lời lại ${QUESTIONS.length} câu, nhắm điểm ${redoPlan.targetScore}...`);
    const redoAnswer = await answerAllQuestions(bridge, exam, QUESTIONS, redoPlan.correctIndices);
    if (!redoAnswer.ok) throw new Error(`answerAllQuestions FAIL (Làm lại): ${redoAnswer.reason}`);
    const redoFinalTree = redoAnswer.lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(redoFinalTree)) throw new Error("Không thấy màn Kết quả (Làm lại).");
    const redoAttemptEndedAt = Date.now();
    const redoResult = exam.readResult(redoFinalTree);
    const redoActualScore = redoResult.score === null ? null : Number(redoResult.score);
    const redoMatched = redoActualScore !== null && !Number.isNaN(redoActualScore) && Math.abs(redoActualScore - redoPlan.targetScore) < 1e-6;
    log(`  TARGET=${redoPlan.targetScore} ĐIỂM THẬT=${redoResult.score} CHÍNH XÁC=${redoResult.correct} THỜI GIAN=${fmtSec(redoAttemptEndedAt - redoAttemptStartedAt)}`);
    if (!redoMatched) throw new Error(`Điểm thật ${redoActualScore} KHÁC target ${redoPlan.targetScore} (Làm lại).`);

    log(`[6] Đọc CTA thật đang hiển thị trên màn Kết quả rồi bấm THẬT...`);
    function collectAllTexts(node, acc = []) {
      const t = node?.attributes?.text;
      if (typeof t === "string" && t.trim()) acc.push(t.trim());
      for (const c of node?.children ?? []) collectAllTexts(c, acc);
      return acc;
    }
    const ctaTexts = collectAllTexts(redoFinalTree);
    const hasTiepTheo = ctaTexts.some((t) => /Tiếp theo/.test(t));
    const hasHoanThanh = ctaTexts.some((t) => /Hoàn thành/.test(t));
    if (!hasTiepTheo && !hasHoanThanh) throw new Error(`Không thấy CTA "Tiếp theo" lẫn "Hoàn thành". Texts: ${JSON.stringify(ctaTexts)}`);
    const ctaToTap = hasTiepTheo ? "Tiếp theo" : "Hoàn thành";
    const tapFinalCta = await bridge.runSteps([{ tapOn: { text: `.*(${ctaToTap}).*` } }]);
    if (!tapFinalCta.success) throw new Error(`Tap "${ctaToTap}" thất bại: ${tapFinalCta.error}`);
    const landExpectation = ctaToTap === "Tiếp theo" ? { id: "exercise_close_button" } : { id: "homework_screen" };
    const landResult = await bridge.wait(landExpectation, { timeout: 30000 });
    if (!landResult.success) throw new Error(`Bấm "${ctaToTap}" nhưng không điều hướng đúng: ${landResult.error}`);
    log(`  [PASS] Đã bấm THẬT "${ctaToTap}" - điều hướng đúng.`);

    result = {
      status: "PASS",
      roomId: ROOM_ID,
      itemName: ITEM_NAME,
      totalScoredItems: QUESTIONS.length,
      firstAttempt: { targetScore: firstPlan.targetScore, actualScore: firstActualScore, correct: firstResult.correct, matched: firstMatched, durationMs: firstAttemptEndedAt - firstAttemptStartedAt },
      redoAttempt: { targetScore: redoPlan.targetScore, actualScore: redoActualScore, correct: redoResult.correct, matched: redoMatched, durationMs: redoAttemptEndedAt - redoAttemptStartedAt },
      finalCta: { cta: ctaToTap, landed: landResult.success },
    };
  } catch (err) {
    result = { status: "FAIL", error: err.message };
  } finally {
    await bridge.stop();
  }
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "PASS" ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
