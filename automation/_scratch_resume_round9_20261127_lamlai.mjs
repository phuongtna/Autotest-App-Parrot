#!/usr/bin/env node
/**
 * Recover round9 (2026-11-27): main script e2e-giaobai-range34-lamlai-range67.mjs reported FAIL at
 * FIRST_ATTEMPT_RESULT ("Không thấy màn Kết quả sau khi trả lời hết câu (lần làm đầu)") but
 * notification screen confirmed the first attempt WAS real and committed (điểm 4, matching
 * target=4) - known false-negative detection class
 * ([[project_result_screen_detect_fail_autochains_but_actually_passes]]). Device already
 * auto-chained away and was closed back to a clean "Bài tập" list (not sitting on the result
 * screen). Recover in place ([[feedback_recover_inplace_not_retry_after_partial_write]]) by
 * locating the completed card (list-scroll + notification fallback, same helper as main script)
 * and finishing the làm lại phase by reusing the SAME exported helpers as the main script (no new
 * engine).
 *
 * room_id=752174a8-89d3-47a7-8aab-63dd473e5739, item="G4-U2-L3: Read and choose", due 04/12/2026,
 * firstActualScore=4, PROFILE_NAME=Ngoc, PHONE=0915775115, class=4D.
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

const ROOM_ID = "752174a8-89d3-47a7-8aab-63dd473e5739";
const ITEM_NAME = "G4-U2-L3: Read and choose";
const DUE_DATE_DDMMYYYY = "04/12/2026";
const FIRST_ACTUAL_SCORE = 4;
const REDO_SCORE_MIN = 8;
const REDO_SCORE_MAX = 10;
const MAX_LOCATE_SCROLLS = 60;
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "scratch_round9_20261127_lamlai_recovery_report.json");

function log(...a) { console.log(...a); }
function collectAllTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectAllTexts(c, acc);
  return acc;
}

async function main() {
  const resolved = await resolveHomeworkExamQuestionsForRoomId(ROOM_ID);
  if (resolved.status !== "RESOLVED") throw new Error(`resolve FAIL: ${resolved.status}/${resolved.reason}`);
  const QUESTIONS = resolved.questions;
  log(`[PASS] ${QUESTIONS.length} scored items resolved từ CMS cho room ${ROOM_ID}.`);

  const redoPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "range", rangeMin: REDO_SCORE_MIN, rangeMax: REDO_SCORE_MAX });
  if (!redoPlan.achievable) throw new Error(`Không random được target score trong [${REDO_SCORE_MIN},${REDO_SCORE_MAX}]: ${redoPlan.reason}`);
  log(`[PASS] targetScore Làm lại=${redoPlan.targetScore} (cần đúng ${redoPlan.correctIndices.size}/${QUESTIONS.length} item).`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: "" });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);
  let result = { status: "ERROR" };
  try {
    log(`[4] Tìm lại card "${ITEM_NAME}" (cta="Làm lại")...`);
    const relocated = await locateCompletedCandidateOrOpenFromNotification(bridge, ITEM_NAME, {
      maxScrolls: MAX_LOCATE_SCROLLS,
      expectedScore: FIRST_ACTUAL_SCORE,
      notificationDueDateDdMmYyyy: DUE_DATE_DDMMYYYY,
    });
    let redoAttemptStartedAt;
    if (relocated.source === "NOTIFICATION" && relocated.alreadyOnDoingScreen) {
      log(`  [PASS] Fallback thông báo "giao bài" PASS - đã vào màn Doing (lần 2).`);
      redoAttemptStartedAt = Date.now();
    } else {
      const freshCandidate = relocated.candidates?.[0];
      if (!freshCandidate) {
        throw new Error(
          `Không tìm lại được card "${ITEM_NAME}" sau ${relocated.scrollsUsed} lượt cuộn (stopReason=${relocated.stopReason ?? "UNKNOWN"})` +
          (relocated.notificationFallback ? ` - fallback thông báo CŨNG thất bại: ${relocated.notificationFallback.reason}` : "")
        );
      }
      log(`  [PASS] Tìm thấy card "Làm lại" sau ${relocated.scrollsUsed} lượt cuộn.`);
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

    log(`[5] Trả lời lại ${QUESTIONS.length} câu, nhắm điểm ${redoPlan.targetScore} (range [${REDO_SCORE_MIN},${REDO_SCORE_MAX}])...`);
    const redoAnswer = await answerAllQuestions(bridge, exam, QUESTIONS, redoPlan.correctIndices);
    if (!redoAnswer.ok) throw new Error(`answerAllQuestions FAIL: ${redoAnswer.reason}`);
    const redoFinalTree = redoAnswer.lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(redoFinalTree)) throw new Error("Không thấy màn Kết quả sau khi trả lời hết câu (Làm lại).");
    const redoAttemptEndedAt = Date.now();
    const redoResult = exam.readResult(redoFinalTree);
    const redoActualScore = redoResult.score === null ? null : Number(redoResult.score);
    const redoMatched = redoActualScore !== null && !Number.isNaN(redoActualScore) && Math.abs(redoActualScore - redoPlan.targetScore) < 1e-6;
    log(`  TARGET=${redoPlan.targetScore} ĐIỂM THẬT=${redoResult.score} CHÍNH XÁC=${redoResult.correct} THỜI GIAN=${((redoAttemptEndedAt - redoAttemptStartedAt) / 1000).toFixed(2)}s`);
    if (!redoMatched) throw new Error(`Điểm thật ${redoActualScore} KHÁC target ${redoPlan.targetScore}.`);

    log(`[6] Đọc CTA thật đang hiển thị trên màn Kết quả rồi bấm THẬT...`);
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
      redoAttempt: { targetScoreRange: `[${REDO_SCORE_MIN}, ${REDO_SCORE_MAX}]`, targetScore: redoPlan.targetScore, actualScore: redoActualScore, matched: redoMatched, durationMs: redoAttemptEndedAt - redoAttemptStartedAt },
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
