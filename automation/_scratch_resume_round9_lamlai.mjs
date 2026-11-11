#!/usr/bin/env node
/**
 * Resume round 9 - lần đầu ĐÃ XÁC NHẬN PASS thật (target=2, actual=2, verify qua room.json API:
 * average_score=2, completed_students=1, status=done) - màn Kết quả bị auto-chain vượt qua trước khi
 * đọc được (false-negative đã biết, [[project_result_screen_detect_fail_autochains_but_actually_passes]]),
 * không phải FAIL thật. Đã đóng xong bài tập lạ bị auto-chain, hiện đang ở homework_screen sạch.
 * Tiếp tục từ bước [4]/[5] của script chính: tìm lại card "Làm lại" rồi làm lại nhắm target=8.
 */
import { MaestroMcpBridge } from "./bridge/maestroMcpBridge.js";
import { HomeworkExamEngine } from "./bai_tap/navigation/homeworkExamEngine.js";
import { resolveHomeworkExamQuestionsForRoomId } from "./bai_tap/discovery/teacherMaterialsExamResolver.js";
import { locateCompletedCandidateOrOpenFromNotification } from "./bai_tap/discovery/locateCompletedCandidate.js";
import { centerPoint } from "./bai_tap/discovery/homeworkUiList.js";
import { resolveScoringPlanForCandidate } from "../flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs";
import { answerAllQuestions } from "../flows/web/giao_bai_tap/e2e-giaobai-range34-lamlai-range67.mjs";

const ROOM_ID = "e268c084-bbf1-4481-8a56-2b947776fa6d";
const ITEM_NAME = "G4-U2-L3: Read and choose";
const DUE_DATE_DDMMYYYY = "17/11/2026";
const FIRST_ACTUAL_SCORE = 2;
const APP_ID = process.env.APP_ID;

function collectAllTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectAllTexts(c, acc);
  return acc;
}

async function main() {
  const resolved = await resolveHomeworkExamQuestionsForRoomId(ROOM_ID);
  if (resolved.status !== "RESOLVED") throw new Error(`resolve status=${resolved.status}: ${resolved.reason}`);
  const QUESTIONS = resolved.questions;
  console.log(`[1] ${QUESTIONS.length} scored items resolved từ CMS.`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);

  try {
    console.log(`[2] Tìm lại card "${ITEM_NAME}" (cta="Làm lại")...`);
    const relocated = await locateCompletedCandidateOrOpenFromNotification(bridge, ITEM_NAME, {
      maxScrolls: 60,
      expectedScore: FIRST_ACTUAL_SCORE,
      notificationDueDateDdMmYyyy: DUE_DATE_DDMMYYYY,
    });
    if (relocated.source === "NOTIFICATION" && relocated.alreadyOnDoingScreen) {
      console.log(`  [PASS] Fallback thông báo PASS - đã vào màn Doing (lần 2).`);
    } else {
      const freshCandidate = relocated.candidates?.[0];
      if (!freshCandidate) throw new Error(`Không tìm lại được card "Làm lại" (stopReason=${relocated.stopReason ?? "UNKNOWN"}).`);
      const ctaPoint = centerPoint(freshCandidate.ctaBounds);
      const tapRedo = await bridge.runSteps([
        { tapOn: { point: `${ctaPoint.x},${ctaPoint.y}` } },
        { waitForAnimationToEnd: { timeout: 3000 } },
        { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
        { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 15000 } },
      ]);
      if (!tapRedo.success) throw new Error(`Tap "Làm lại" thất bại: ${tapRedo.error}`);
      console.log("  [PASS] Đã tap \"Làm lại\" - vào màn Doing (lần 2).");
    }

    console.log("[3] Recompute redo plan qua mode=\"target\" (targetScoreEnv=8, deterministic)...");
    const redoPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "target", targetScoreEnv: 8 });
    if (!redoPlan.achievable) throw new Error(`Không rebuild được plan target=8: ${redoPlan.reason}`);
    console.log(`  [PASS] targetScore Làm lại=${redoPlan.targetScore} (cần đúng ${redoPlan.correctIndices.size}/${QUESTIONS.length} item).`);

    console.log(`[4] Trả lời lại ${QUESTIONS.length} câu, nhắm điểm ${redoPlan.targetScore}...`);
    const redoAnswer = await answerAllQuestions(bridge, exam, QUESTIONS, redoPlan.correctIndices);
    if (!redoAnswer.ok) throw new Error(`Làm lại FAIL: ${redoAnswer.reason}`);
    const redoFinalTree = redoAnswer.lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(redoFinalTree)) throw new Error("Không thấy màn Kết quả sau Làm lại.");
    const redoResult = exam.readResult(redoFinalTree);
    const redoActualScore = redoResult.score === null ? null : Number(redoResult.score);
    console.log(`  TARGET=${redoPlan.targetScore} ĐIỂM THẬT=${redoResult.score} CHÍNH XÁC=${redoResult.correct}`);
    if (Math.abs(redoActualScore - redoPlan.targetScore) > 1e-6) {
      throw new Error(`Điểm thật ${redoActualScore} KHÁC target ${redoPlan.targetScore}.`);
    }

    console.log("[5] Đọc CTA thật trên màn Kết quả cuối rồi bấm THẬT...");
    const ctaTexts = collectAllTexts(redoFinalTree);
    const hasTiepTheo = ctaTexts.some((t) => /Tiếp theo/.test(t));
    const hasHoanThanh = ctaTexts.some((t) => /Hoàn thành/.test(t));
    if (!hasTiepTheo && !hasHoanThanh) throw new Error(`Không thấy CTA cuối. Texts: ${JSON.stringify(ctaTexts)}`);
    const ctaToTap = hasTiepTheo ? "Tiếp theo" : "Hoàn thành";
    const tapFinalCta = await bridge.runSteps([{ tapOn: { text: `.*(${ctaToTap}).*` } }]);
    if (!tapFinalCta.success) throw new Error(`Tap "${ctaToTap}" thất bại: ${tapFinalCta.error}`);
    const landExpectation = ctaToTap === "Tiếp theo" ? { id: "exercise_close_button" } : { id: "homework_screen" };
    const landResult = await bridge.wait(landExpectation, { timeout: 30000 });
    if (!landResult.success) throw new Error(`Bấm "${ctaToTap}" nhưng không điều hướng đúng: ${landResult.error}`);
    console.log(`  [PASS] Đã bấm THẬT "${ctaToTap}" - điều hướng đúng.`);

    console.log("\n[OVERALL] PASS");
    console.log(`first_actual=${FIRST_ACTUAL_SCORE} redo_actual=${redoActualScore}`);
  } finally {
    await bridge.stop();
    console.log("[MCP] Đã dừng tiến trình `maestro mcp`.");
  }
}

main().catch((err) => {
  console.error("\n[resume_round9_lamlai] Dừng lại vì lỗi:\n", err);
  process.exit(1);
});
