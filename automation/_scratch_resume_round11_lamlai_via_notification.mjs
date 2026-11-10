#!/usr/bin/env node
// Scratch: resume room 616ba379 (Ngoc/4D, "You hear these sentences. Choose the correct meaning or
// month (A, B, C or D).", lần 1 đã PASS target=5 actual=5 - false-negative result-screen-not-detected
// đã xác nhận qua screenshot) - chỉ cần tìm lại "Làm lại" (locateSpecificCompletedCandidate() đã FAIL
// PROGRESS_STALLED) và trả lời lại, nhắm điểm range [7.1,9.9]. Reuse NGUYÊN VĂN
// locateCompletedCandidateOrOpenFromNotification() + answerAllQuestions loop từ
// e2e-giaobai-range34-lamlai-range67.mjs - KHÔNG viết engine mới.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnvFile } from "./src/config.js";
import { MaestroMcpBridge } from "./bridge/maestroMcpBridge.js";
import { HomeworkExamEngine } from "./bai_tap/navigation/homeworkExamEngine.js";
import { resolveHomeworkExamQuestionsForRoomId } from "./bai_tap/discovery/teacherMaterialsExamResolver.js";
import { locateCompletedCandidateOrOpenFromNotification } from "./bai_tap/discovery/locateCompletedCandidate.js";
import { centerPoint } from "./bai_tap/discovery/homeworkUiList.js";
import { findMatchingQuestion } from "./bai_tap/discovery/answerSetMatcher.js";
import { resolveScoringPlanForCandidate, buildWeightedWantCorrectPlan } from "../flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_ENV = parseEnvFile(join(SELF_DIR, "..", ".env"));
const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const TITLE = "You hear these sentences. Choose the correct meaning or month (A, B, C or D).";
const ROOM_ID = "616ba379-512a-4834-a596-447045cf3109";
const FIRST_SCORE = 5;
const DUE_DATE_DDMMYYYY = "14/11/2026";
const REDO_MIN = 7.1, REDO_MAX = 9.9;
const OUTPUT_FILE = join(SELF_DIR, "output", "resume_round11_lamlai_report.json");

function log(...a) { console.log(...a); }
function fmtSec(ms) { return `${(ms / 1000).toFixed(2)}s`; }
async function timed(fn) { const s = Date.now(); const r = await fn(); return { result: r, durationMs: Date.now() - s }; }

async function answerAllQuestions(bridge, exam, questions, correctIndices) {
  const wantCorrectMap = buildWeightedWantCorrectPlan(questions, correctIndices);
  const answeredIds = new Set();
  let carryTree = null, lastOutcome = null;
  while (answeredIds.size < questions.length) {
    const qIndex = answeredIds.size + 1;
    const pool = questions.filter((q) => !answeredIds.has(q.id));
    const matchT = await timed(() => findMatchingQuestion(bridge, pool, carryTree, qIndex));
    const matchResult = matchT.result;
    if (matchResult.status !== "MATCHED") {
      return { ok: false, reason: `${matchResult.status} ở câu ${qIndex}` };
    }
    const matched = matchResult.question;
    const isLast = answeredIds.size === questions.length - 1;
    const wantCorrect = wantCorrectMap.get(matched.id);
    const answerT = await timed(() => exam.answerCurrentQuestionOneShot(matched, { wantCorrect, resultLabel: isLast ? "resume_round11_result_screen" : null, snapshot: matched._snapshot ?? null }));
    const outcome = answerT.result;
    if (!outcome.supported) return { ok: false, reason: `Handler không hỗ trợ: ${outcome.reason}` };
    lastOutcome = outcome;
    carryTree = outcome.finalTree ?? null;
    answeredIds.add(matched.id);
    log(`    Câu ${answeredIds.size}/${questions.length}: nhắm ${wantCorrect ? "ĐÚNG" : "SAI"}, isTargetCorrect=${outcome.isTargetCorrect}, total=${fmtSec(answerT.durationMs)}`);
  }
  return { ok: true, lastOutcome };
}

async function main() {
  log(`[1] Resolve câu hỏi/đáp án thật qua CMS cho room_id=${ROOM_ID}...`);
  const resolved = await resolveHomeworkExamQuestionsForRoomId(ROOM_ID);
  const QUESTIONS = resolved.questions;
  log(`  [PASS] ${QUESTIONS.length} scored items resolved từ CMS.`);
  const plan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "range", rangeMin: REDO_MIN, rangeMax: REDO_MAX });
  if (!plan.achievable) { log(`[BLOCKED] ${plan.reason}`); process.exit(1); }
  log(`  [PASS] targetScore Làm lại=${plan.targetScore} (cần đúng ${plan.correctIndices.size}/${QUESTIONS.length}).`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: "" });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);
  try {
    log(`[2] Tìm lại card "${TITLE}" (cta="Làm lại", điểm=${FIRST_SCORE})...`);
    const relocated = await locateCompletedCandidateOrOpenFromNotification(bridge, TITLE, {
      maxScrolls: 60,
      expectedScore: FIRST_SCORE,
      notificationDueDateDdMmYyyy: DUE_DATE_DDMMYYYY,
    });
    let redoStartedAt;
    if (relocated.source === "NOTIFICATION" && relocated.alreadyOnDoingScreen) {
      log(`  [PASS] fallback qua thông báo "giao bài" PASS, đã vào màn Doing (lần 2).`);
      redoStartedAt = Date.now();
    } else {
      const freshCandidate = relocated.candidates?.[0];
      if (!freshCandidate) {
        log(`[FAIL] Không tìm lại được card sau ${relocated.scrollsUsed} lượt cuộn (stopReason=${relocated.stopReason ?? "UNKNOWN"})${relocated.notificationFallback ? ` - fallback thông báo cũng fail: ${relocated.notificationFallback.reason}` : ""}`);
        process.exit(1);
      }
      log(`  [PASS] Tìm thấy card "Làm lại" sau ${relocated.scrollsUsed} lượt cuộn.`);
      const ctaPoint = centerPoint(freshCandidate.ctaBounds);
      const tapRedo = await bridge.runSteps([
        { tapOn: { point: `${ctaPoint.x},${ctaPoint.y}` } },
        { waitForAnimationToEnd: { timeout: 3000 } },
        { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
        { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 15000 } },
      ]);
      redoStartedAt = Date.now();
      if (!tapRedo.success) { log(`[FAIL] Tap "Làm lại" thất bại: ${tapRedo.error}`); process.exit(1); }
      log(`  [PASS] Đã tap "Làm lại" - vào màn Doing (lần 2).`);
    }

    log(`[3] Trả lời lại ${QUESTIONS.length} câu, nhắm điểm ${plan.targetScore} (range [${REDO_MIN},${REDO_MAX}])...`);
    const redoAnswer = await answerAllQuestions(bridge, exam, QUESTIONS, plan.correctIndices);
    if (!redoAnswer.ok) { log(`[FAIL] ${redoAnswer.reason}`); process.exit(1); }
    const redoFinalTree = redoAnswer.lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(redoFinalTree)) { log(`[FAIL] Không thấy màn Kết quả sau Làm lại.`); process.exit(1); }
    const redoResult = exam.readResult(redoFinalTree);
    const redoEndedAt = Date.now();
    log(`  TARGET=${plan.targetScore} ĐIỂM THẬT=${redoResult.score} CHÍNH XÁC=${redoResult.correct} THỜI GIAN=${fmtSec(redoEndedAt - redoStartedAt)}`);

    log(`[4] Đọc CTA thật trên màn Kết quả rồi bấm THẬT...`);
    const tapCta = await bridge.runSteps([
      { runFlow: { when: { visible: "Hoàn thành" }, commands: [{ tapOn: { text: ".*(Hoàn thành).*" } }] } },
      { runFlow: { when: { visible: "Tiếp theo" }, commands: [{ tapOn: { text: ".*(Tiếp theo).*" } }] } },
      { extendedWaitUntil: { visible: { id: "homework_screen" }, timeout: 15000 } },
    ]);
    const ctaTapped = tapCta.success ? "Tiếp theo/Hoàn thành" : "-";
    log(`  [${tapCta.success ? "PASS" : "FAIL"}] CTA tapped=${ctaTapped}, landed=${tapCta.success}`);

    const report = {
      item: TITLE, room_id: ROOM_ID,
      firstAttempt: { targetScore: FIRST_SCORE, actualScore: FIRST_SCORE, note: "false-negative result-screen-not-detected ở lần chạy chính, xác nhận PASS qua screenshot thủ công" },
      redoAttempt: { targetScoreRange: [REDO_MIN, REDO_MAX], targetScore: plan.targetScore, actualScore: redoResult.score, correct: redoResult.correct, matched: Math.abs(redoResult.score - plan.targetScore) < 1e-6, durationMs: redoEndedAt - redoStartedAt },
      ctaTapped, landed: tapCta.success,
      overall: tapCta.success && Math.abs(redoResult.score - plan.targetScore) < 1e-6 ? "PASS" : "FAIL",
    };
    mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
    writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
    log(`\n[OVERALL] ${report.overall}`);
    log(`Đã ghi report ra ${OUTPUT_FILE}`);
  } finally {
    await bridge.stop();
  }
}

main().catch((e) => { console.error("ERROR", e.message, e.stack); process.exit(2); });
