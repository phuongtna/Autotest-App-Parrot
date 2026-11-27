#!/usr/bin/env node
// One-off recovery (2026-11-23, round 7): attempt 1 answering loop hit the known false-negative
// result-screen-detection class at question 10 (matcher saw the already-transitioned Kết quả
// screen as an "UNKNOWN" question instead) - verified via live screenshot: real result screen,
// ĐIỂM SỐ=2, CHÍNH XÁC=2/10, EXACT match to target=2. Continues IN PLACE from here: close result,
// locate "Làm lại", answer attempt 2, final CTA. Per
// [[project_result_screen_detect_fail_autochains_but_actually_passes]] /
// [[feedback_recover_inplace_not_retry_after_partial_write]].
import { parseEnvFile } from "./src/config.js";
import { MaestroMcpBridge } from "./bridge/maestroMcpBridge.js";
import { HomeworkExamEngine } from "./bai_tap/navigation/homeworkExamEngine.js";
import { resolveHomeworkExamQuestionsForRoomId } from "./bai_tap/discovery/teacherMaterialsExamResolver.js";
import { locateCompletedCandidateOrOpenFromNotification } from "./bai_tap/discovery/locateCompletedCandidate.js";
import { centerPoint } from "./bai_tap/discovery/homeworkUiList.js";
import { resolveScoringPlanForCandidate } from "../flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs";
import { answerAllQuestions } from "../flows/web/giao_bai_tap/e2e-giaobai-range34-lamlai-range67.mjs";

const ROOT_ENV = parseEnvFile(new URL("../.env", import.meta.url).pathname);
for (const [k, v] of Object.entries(ROOT_ENV)) if (!process.env[k]) process.env[k] = v;
const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "3201d866d40a1681";

const ROOM_ID = "8c9daf71-8a34-4c0e-a982-54e1e095aab2";
const ITEM_NAME = "Choose the correct form: is or was.";
const DUE_DATE_DDMMYYYY = "30/11/2026";
const FIRST_ACTUAL_SCORE = 2;
const REDO_SCORE_MIN = 8, REDO_SCORE_MAX = 9;

function collectAllTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectAllTexts(c, acc);
  return acc;
}

async function main() {
  console.log(`[1] Resolve câu hỏi/đáp án thật qua CMS cho room_id=${ROOM_ID}...`);
  const resolved = await resolveHomeworkExamQuestionsForRoomId(ROOM_ID);
  if (resolved.status !== "RESOLVED") throw new Error(`resolveHomeworkExamQuestionsForRoomId status=${resolved.status}: ${resolved.reason}`);
  const QUESTIONS = resolved.questions;
  console.log(`  [PASS] ${QUESTIONS.length} scored items.`);

  const redoPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "range", rangeMin: REDO_SCORE_MIN, rangeMax: REDO_SCORE_MAX });
  if (!redoPlan.achievable) throw new Error(`Không random được target score trong [${REDO_SCORE_MIN},${REDO_SCORE_MAX}].`);
  console.log(`  [PASS] targetScore Làm lại=${redoPlan.targetScore}.`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);
  const report = { firstAttempt: { target: 2, actual: FIRST_ACTUAL_SCORE, matched: true } };

  try {
    console.log(`[2] Đóng màn Kết quả (lần đầu, đã xác nhận điểm=${FIRST_ACTUAL_SCORE} qua screenshot)...`);
    const closeFirst = await bridge.runSteps([
      { runFlow: { when: { visible: "Hoàn thành" }, commands: [{ tapOn: { text: ".*(Hoàn thành).*" } }] } },
      { runFlow: { when: { visible: "Tiếp theo" }, commands: [{ tapOn: { id: "exercise_result_close_button" } }] } },
      { extendedWaitUntil: { visible: { id: "homework_screen" }, timeout: 30000 } },
    ]);
    if (!closeFirst.success) throw new Error(`CLOSE_FIRST_RESULT: ${closeFirst.error}`);
    console.log(`  [PASS] Đã đóng màn Kết quả (lần đầu), về lại danh sách Bài tập.`);

    console.log(`[3] Tìm lại card "${ITEM_NAME}" (cta="Làm lại")...`);
    const relocated = await locateCompletedCandidateOrOpenFromNotification(bridge, ITEM_NAME, {
      maxScrolls: 60,
      expectedScore: FIRST_ACTUAL_SCORE,
      notificationDueDateDdMmYyyy: DUE_DATE_DDMMYYYY,
    });
    if (relocated.source === "NOTIFICATION" && relocated.alreadyOnDoingScreen) {
      console.log(`  [PASS] Fallback qua thông báo "giao bài" PASS, đã vào màn Doing (lần 2).`);
    } else {
      const freshCandidate = relocated.candidates?.[0];
      if (!freshCandidate) throw new Error(`Không tìm lại được card "${ITEM_NAME}" với cta="Làm lại" (stopReason=${relocated.stopReason ?? "UNKNOWN"}).`);
      const ctaPoint = centerPoint(freshCandidate.ctaBounds);
      const tapRedo = await bridge.runSteps([
        { tapOn: { point: `${ctaPoint.x},${ctaPoint.y}` } },
        { waitForAnimationToEnd: { timeout: 3000 } },
        { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
        { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 15000 } },
      ]);
      if (!tapRedo.success) throw new Error(`TAP_LAM_LAI: ${tapRedo.error}`);
      console.log(`  [PASS] Đã tap "Làm lại" - vào màn Doing (lần 2).`);
    }

    console.log(`[4] Trả lời lại ${QUESTIONS.length} câu, nhắm điểm ${redoPlan.targetScore}...`);
    const redoAnswer = await answerAllQuestions(bridge, exam, QUESTIONS, redoPlan.correctIndices);
    if (!redoAnswer.ok) throw new Error(`REDO_ATTEMPT_ANSWER: ${redoAnswer.reason}`);
    const redoFinalTree = redoAnswer.lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(redoFinalTree)) throw new Error("Không thấy màn Kết quả sau khi trả lời hết câu (Làm lại).");
    const redoResult = exam.readResult(redoFinalTree);
    const redoActualScore = Number(redoResult.score);
    const redoMatched = Math.abs(redoActualScore - redoPlan.targetScore) < 1e-6;
    report.redoAttempt = { target: redoPlan.targetScore, actual: redoActualScore, matched: redoMatched };
    console.log(`  TARGET=${redoPlan.targetScore} ĐIỂM THẬT=${redoResult.score} CHÍNH XÁC=${redoResult.correct} matched=${redoMatched}`);
    if (!redoMatched) throw new Error(`Điểm thật ${redoActualScore} KHÁC target ${redoPlan.targetScore}.`);

    console.log(`[5] Đọc CTA thật rồi bấm THẬT...`);
    const ctaTexts = collectAllTexts(redoFinalTree);
    const hasTiepTheo = ctaTexts.some((t) => /Tiếp theo/.test(t));
    const hasHoanThanh = ctaTexts.some((t) => /Hoàn thành/.test(t));
    if (!hasTiepTheo && !hasHoanThanh) throw new Error(`Không thấy CTA "Tiếp theo" lẫn "Hoàn thành". Texts: ${JSON.stringify(ctaTexts)}`);
    const ctaToTap = hasTiepTheo ? "Tiếp theo" : "Hoàn thành";
    const tapFinalCta = await bridge.runSteps([{ tapOn: { text: `.*(${ctaToTap}).*` } }]);
    if (!tapFinalCta.success) throw new Error(`Tap "${ctaToTap}" thất bại: ${tapFinalCta.error}`);
    const landExpectation = ctaToTap === "Tiếp theo" ? { id: "exercise_close_button" } : { id: "homework_screen" };
    const landResult = await bridge.wait(landExpectation, { timeout: 30000 });
    report.finalCta = { cta: ctaToTap, landed: landResult.success };
    if (!landResult.success) throw new Error(`Bấm "${ctaToTap}" nhưng không xác nhận được điều hướng đúng: ${landResult.error}`);
    console.log(`  [PASS] Đã bấm THẬT "${ctaToTap}" - điều hướng đúng.`);

    console.log("\nOVERALL=PASS\n" + JSON.stringify(report, null, 2));
  } finally {
    await bridge.stop();
  }
}

main().catch((err) => {
  console.error("\nOVERALL=ERROR\n", err);
  process.exit(2);
});
