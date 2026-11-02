#!/usr/bin/env node
/**
 * Recovery-in-place (2026-10-30): e2e-giaobai-range34-lamlai-range67.mjs lần làm đầu báo FAIL ở
 * phase FIRST_ATTEMPT_RESULT ("Không thấy màn Kết quả") nhưng hierarchy thật xác nhận attempt ĐÃ
 * thành công (exercise_result_screen hiển thị ĐIỂM SỐ=3, CHÍNH XÁC=3/10 - đúng target đã random) -
 * false negative quen thuộc (xem [[project_result_screen_detect_fail_autochains_but_actually_passes]]/
 * [[project_result_screen_confetti_animation_race]]). App ĐANG đứng sẵn ở màn Kết quả đó với nút
 * "Làm lại" visible - KHÔNG re-assign phòng mới ([[feedback_recover_inplace_not_retry_after_partial_write]]),
 * chỉ tap thẳng "Làm lại" (bỏ qua bước locate-card list-scroll đã biết dư thừa ở đây) rồi tái dùng
 * NGUYÊN VĂN answerAllQuestions()/resolveScoringPlanForCandidate() từ
 * automation/bai_tap/resume_lamlai_range_score.mjs - KHÔNG viết engine mới.
 *
 * room_id/target range lấy từ log thật của lần chạy trước (gbt_lambai_range1_5_lamlai_range6_10_
 * 20261030_082235.log): room_id=48c2cf62-7bdb-432a-844a-42352e296add, REDO_SCORE range [6.1,9.9].
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseEnvFile } from "./src/config.js";
import { MaestroMcpBridge } from "./bridge/maestroMcpBridge.js";
import { HomeworkExamEngine } from "./bai_tap/navigation/homeworkExamEngine.js";
import { resolveHomeworkExamQuestionsForRoomId } from "./bai_tap/discovery/teacherMaterialsExamResolver.js";
import { findMatchingQuestion } from "./bai_tap/discovery/answerSetMatcher.js";
import {
  resolveScoringPlanForCandidate,
  buildWeightedWantCorrectPlan,
} from "../flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "resume_lamlai_from_result_screen_report.json");
const ROOT_ENV = parseEnvFile(join(PROJECT_ROOT, ".env"));

const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const TARGET_ROOM_ID = "48c2cf62-7bdb-432a-844a-42352e296add";
const TARGET_TITLE = "Choose the best answer (A, B, C or D) to complete each sentence.";
const REDO_SCORE_MIN = 6.1;
const REDO_SCORE_MAX = 9.9;
const REDO_BUTTON_BOUNDS = { left: 42, top: 2112, right: 1038, bottom: 2259 };

function log(...args) {
  console.log(...args);
}
function fmtSec(ms) {
  return `${(ms / 1000).toFixed(2)}s`;
}
async function timed(fn) {
  const startedAt = Date.now();
  const result = await fn();
  const endedAt = Date.now();
  return { result, startedAt, endedAt, durationMs: endedAt - startedAt };
}
function centerPoint(b) {
  return { x: Math.round((b.left + b.right) / 2), y: Math.round((b.top + b.bottom) / 2) };
}
function collectAllTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectAllTexts(c, acc);
  return acc;
}

/** COPY nguyên văn từ resume_lamlai_range_score.mjs#answerAllQuestions(). */
async function answerAllQuestions(bridge, exam, questions, correctIndices) {
  const wantCorrectMap = buildWeightedWantCorrectPlan(questions, correctIndices);
  const answeredIds = new Set();
  const answerLog = [];
  const perQuestion = [];
  let carryTree = null;
  let lastOutcome = null;
  while (answeredIds.size < questions.length) {
    const questionIndex = answeredIds.size + 1;
    const pool = questions.filter((q) => !answeredIds.has(q.id));
    const matchT = await timed(() => findMatchingQuestion(bridge, pool, carryTree, questionIndex));
    const matchResult = matchT.result;
    if (matchResult.status !== "MATCHED") {
      const outcomeLabel = matchResult.status === "AMBIGUOUS" ? "AMBIGUOUS_MATCH" : "NO_MATCH";
      return {
        ok: false,
        reason:
          matchResult.status === "AMBIGUOUS"
            ? `AMBIGUOUS_MATCH ở câu ${questionIndex}.`
            : `NO_MATCH ở câu ${questionIndex} (còn ${pool.length} câu).`,
        outcomeLabel,
        answerLog,
        perQuestion,
      };
    }
    const matched = matchResult.question;
    const isLast = answeredIds.size === questions.length - 1;
    const wantCorrect = wantCorrectMap.get(matched.id);
    const answerT = await timed(() =>
      exam.answerCurrentQuestionOneShot(matched, {
        wantCorrect,
        resultLabel: isLast ? "resume_from_result_screen_result" : null,
        snapshot: matched._snapshot ?? null,
      }),
    );
    const outcome = answerT.result;
    if (!outcome.supported) {
      return { ok: false, reason: `Handler không hỗ trợ câu "${matched.question}": ${outcome.reason}`, outcomeLabel: "BLOCKED_MISSING_EXERCISE_HANDLER", answerLog, perQuestion };
    }
    lastOutcome = outcome;
    carryTree = outcome.finalTree ?? null;
    answeredIds.add(matched.id);
    answerLog.push({ id: matched.id, question: matched.question, wantCorrect, isTargetCorrect: outcome.isTargetCorrect });
    perQuestion.push({ index: questionIndex, wantCorrect, isTargetCorrect: outcome.isTargetCorrect, durationMs: answerT.endedAt - matchT.startedAt });
    log(`    Câu ${answeredIds.size}/${questions.length}: nhắm ${wantCorrect ? "ĐÚNG" : "SAI"}, isTargetCorrect=${outcome.isTargetCorrect}, total=${fmtSec(answerT.endedAt - matchT.startedAt)}`);
  }
  return { ok: true, lastOutcome, answerLog, perQuestion };
}

function finish(evidence) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(evidence, null, 2));
  log(`\n[OVERALL] ${evidence.status}`);
  if (evidence.error) log(`[ROOT_CAUSE] ${evidence.error}`);
  log(`\nĐã ghi report ra ${OUTPUT_FILE}`);
  return evidence;
}

async function main() {
  const evidence = { title: TARGET_TITLE, roomId: TARGET_ROOM_ID, scoreRange: [REDO_SCORE_MIN, REDO_SCORE_MAX] };

  log(`[1] Resolve câu hỏi/đáp án thật qua CMS cho room_id=${TARGET_ROOM_ID}...`);
  const resolved = await resolveHomeworkExamQuestionsForRoomId(TARGET_ROOM_ID);
  const QUESTIONS = resolved.questions;
  log(`  [PASS] ${QUESTIONS.length} scored items resolved từ CMS.`);

  const plan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "range", rangeMin: REDO_SCORE_MIN, rangeMax: REDO_SCORE_MAX });
  if (!plan.achievable) {
    return finish({ ...evidence, status: "BLOCKED", error: `Không có điểm khả thi trong [${REDO_SCORE_MIN},${REDO_SCORE_MAX}]: ${plan.reason}` });
  }
  log(`  [PASS] targetScore=${plan.targetScore} (cần đúng ${plan.correctIndices.size}/${QUESTIONS.length} item).`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);

  try {
    log(`[2] Xác nhận app đang đứng ở màn Kết quả (lần đầu) với nút "Làm lại" visible...`);
    const tree = await bridge.hierarchy();
    const texts = collectAllTexts(tree);
    if (!texts.some((t) => /Làm lại/.test(t))) {
      return finish({ ...evidence, status: "BLOCKED", error: `App không đứng ở màn Kết quả có nút "Làm lại" như kỳ vọng. Texts: ${JSON.stringify(texts.slice(0, 20))}` });
    }
    log(`  [PASS] Màn Kết quả (lần đầu) xác nhận đang hiển thị, nút "Làm lại" visible.`);

    const ctaPoint = centerPoint(REDO_BUTTON_BOUNDS);
    const tapResult = await bridge.runSteps([{ tapOn: { point: `${ctaPoint.x},${ctaPoint.y}` } }]);
    if (!tapResult.success) {
      return finish({ ...evidence, status: "FAIL", error: `Tap "Làm lại" thất bại: ${tapResult.error}` });
    }
    const openResult = await bridge.runSteps([
      { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
      { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 40000 } },
    ]);
    const startedAt = Date.now();
    if (!openResult.success) {
      return finish({ ...evidence, status: "FAIL", error: `Mở bài "Làm lại" thất bại sau khi tap: ${openResult.error}` });
    }
    log(`  [PASS] Đã tap "Làm lại" - vào màn Doing (lần 2).`);

    log(`[3] Trả lời ${QUESTIONS.length} câu, nhắm điểm ${plan.targetScore} (range [${REDO_SCORE_MIN},${REDO_SCORE_MAX}])...`);
    const answer = await answerAllQuestions(bridge, exam, QUESTIONS, plan.correctIndices);
    if (!answer.ok) {
      return finish({ ...evidence, status: answer.outcomeLabel === "BLOCKED_MISSING_EXERCISE_HANDLER" ? "BLOCKED" : "FAIL", error: answer.reason, answerLog: answer.answerLog });
    }
    const finalTree = answer.lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(finalTree)) {
      // Có thể lại là false-negative result-screen detect - lưu lại hierarchy để kiểm tra thủ công.
      const liveTree = await bridge.hierarchy();
      return finish({ ...evidence, status: "FAIL", error: "Không thấy màn Kết quả sau khi trả lời hết câu (Làm lại).", liveTexts: collectAllTexts(liveTree).slice(0, 40) });
    }
    const endedAt = Date.now();
    const result = exam.readResult(finalTree);
    const actualScore = result.score === null ? null : Number(result.score);
    const matched = actualScore !== null && !Number.isNaN(actualScore) && Math.abs(actualScore - plan.targetScore) < 1e-6;
    log(`  TARGET=${plan.targetScore} ĐIỂM THẬT=${result.score} CHÍNH XÁC=${result.correct} THỜI GIAN=${fmtSec(endedAt - startedAt)}`);

    return finish({
      ...evidence,
      status: matched ? "PASS" : "FAIL",
      error: matched ? undefined : `Điểm thật ${actualScore} KHÁC target ${plan.targetScore}.`,
      targetScore: plan.targetScore,
      actualScore,
      correct: result.correct,
      durationMs: endedAt - startedAt,
      perQuestion: answer.perQuestion,
    });
  } finally {
    await bridge.stop();
  }
}

main()
  .then((r) => {
    process.exit(r.status === "PASS" ? 0 : r.status === "BLOCKED" ? 3 : 1);
  })
  .catch((err) => {
    console.error("[resume-lamlai-from-result-screen] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    process.exit(2);
  });
