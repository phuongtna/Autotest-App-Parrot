#!/usr/bin/env node
/**
 * Recover round 12 (2026-11-17): main script hit RoomNotFoundError (2 rooms shared
 * lessonItemId+classId+dueDate=24/11/2026 - the first was an orphaned room from round 6's earlier
 * IDENTITY_UNVERIFIABLE failure, id=6e405d41-...). Disambiguated via direct API query (the orphaned
 * room has a "doing" answer already; the fresh one has none) and resumed with RESUME_ROOM_ID, but
 * then findAssignment() reported AMBIGUOUS (both duplicate cards show "0 / 10", title+dueDate alone
 * can't tell them apart - only the CTA text differs: "Làm bài" = fresh, "Tiếp tục" = the orphaned
 * one). Manually tapped the "Làm bài" CTA bounds from the AMBIGUOUS report. Device is now sitting
 * on question 1/10 of the Doing screen RIGHT NOW. Recover in place
 * ([[feedback_recover_inplace_not_retry_after_partial_write]]): finish the FULL round (lần 1 + tìm
 * lại "Làm lại" + lần 2) reusing the SAME exported helpers as the main script (no new engine).
 *
 * room_id=c0306af8-91b4-4d99-9a7c-71a4b2cbe993, item="Choose the best response (A, B, C or D) to
 * complete each short exchange.", due 24/11/2026, PROFILE_NAME=Ngoc, PHONE=0915775115, class=4D.
 * firstPlan range [1,5] (already resolved target=5 before the locate failure), redoPlan range [8,9].
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

const ROOM_ID = "c0306af8-91b4-4d99-9a7c-71a4b2cbe993";
const ITEM_NAME = "Choose the best response (A, B, C or D) to complete each short exchange.";
const DUE_DATE_DDMMYYYY = "24/11/2026";
const FIRST_SCORE_MIN = 1;
const FIRST_SCORE_MAX = 5;
const REDO_SCORE_MIN = 8;
const REDO_SCORE_MAX = 9;
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "scratch_round12_20261117_full_recovery_report.json");

function log(...a) { console.log(...a); }
function fmtSec(ms) { return (ms / 1000).toFixed(2) + "s"; }

async function main() {
  const resolved = await resolveHomeworkExamQuestionsForRoomId(ROOM_ID);
  if (resolved.status !== "RESOLVED") throw new Error(`resolve FAIL: ${resolved.status}/${resolved.reason}`);
  const QUESTIONS = resolved.questions;
  log(`[PASS] ${QUESTIONS.length} scored items resolved từ CMS cho room ${ROOM_ID}.`);

  const firstPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "range", rangeMin: FIRST_SCORE_MIN, rangeMax: FIRST_SCORE_MAX });
  if (!firstPlan.achievable) throw new Error(`Không random được target score trong [${FIRST_SCORE_MIN},${FIRST_SCORE_MAX}]: ${firstPlan.reason}`);
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
