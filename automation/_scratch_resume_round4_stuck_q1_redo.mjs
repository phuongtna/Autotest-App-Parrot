#!/usr/bin/env node
/**
 * Recovery-in-place (2026-11-10, round 4): script chính FAIL với "Không chuyển được câu tiếp theo -
 * màn hình không đổi sau khi bấm CTA" ngay ở câu 1/10 của LÀM LẠI (room
 * de05be4b-92d8-4cd3-9e80-f8c0b7527d44, "Read the passage and choose the best answer (A, B, C or D)
 * for each question.", class 4D, due 17/11/2026, 10 scored items - lần làm đầu ĐÃ PASS: target=3,
 * thật=3/10). Screenshot xác nhận ĐÂY LÀ false-alarm đã biết (xem
 * [[project_lamlai_cta_stuck_answer_not_registered]], confirmed 2026-10-22): app KHÔNG freeze - vẫn
 * đứng ở câu 1/10 THẬT ("What was the weather like last weekend?"), CTA "Tiếp theo" disabled, CHƯA
 * chọn đáp án nào - tap đáp án lần trước chỉ đơn giản KHÔNG đăng ký (silent fail), không phải lỗi hệ
 * thống. Theo memory: KHÔNG tin index-slicing của 1 lần resolve CMS mới (thứ tự mảng không ổn định
 * giữa các lần gọi) - CHỈ trả lời LẠI đúng câu đang hiển thị (identity đã biết từ log gốc:
 * CMS id=8ff8237b-c4c0-485e-8f2c-ac7d49887685, correct="Rainy") rồi tiếp tục vòng lặp CHUẨN
 * (findMatchingQuestion + answerCurrentQuestionOneShot) cho 9 câu còn lại - KHÔNG re-run script
 * chính (sẽ giao thêm 1 room thật thứ 2, bỏ rơi room này đã có 1 lần làm PASS thật).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseEnvFile } from "./src/config.js";
import { MaestroMcpBridge } from "./bridge/maestroMcpBridge.js";
import { HomeworkExamEngine } from "./bai_tap/navigation/homeworkExamEngine.js";
import { resolveHomeworkExamQuestionsForRoomId } from "./bai_tap/discovery/teacherMaterialsExamResolver.js";
import { resolveScoringPlanForCandidate, buildWeightedWantCorrectPlan } from "../flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs";
import { findMatchingQuestion } from "./bai_tap/discovery/answerSetMatcher.js";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "resume_round4_stuck_q1_redo_report.json");
const ROOT_ENV = parseEnvFile(join(PROJECT_ROOT, ".env"));

const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const TARGET_ROOM_ID = "de05be4b-92d8-4cd3-9e80-f8c0b7527d44";
const TARGET_TITLE = "Read the passage and choose the best answer (A, B, C or D) for each question.";
const REDO_TARGET_SCORE = 9;
const STUCK_QUESTION_INDEX = 4; // id=8ff8237b-... "What was the weather like last weekend?" correct="Rainy"

function log(...args) {
  console.log(...args);
}
function fmtSec(ms) {
  return ms == null ? "-" : `${(ms / 1000).toFixed(2)}s`;
}
async function timed(fn) {
  const startedAt = Date.now();
  const result = await fn();
  const endedAt = Date.now();
  return { result, startedAt, endedAt, durationMs: endedAt - startedAt };
}
function collectAllTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectAllTexts(c, acc);
  return acc;
}

async function answerRemainingUntilResult(bridge, exam, questions, correctIndices, alreadyAnsweredIds) {
  const wantCorrectMap = buildWeightedWantCorrectPlan(questions, correctIndices);
  const answeredIds = new Set(alreadyAnsweredIds ?? []);
  const perQuestion = [];
  let questionIndex = answeredIds.size + 1;
  for (;;) {
    const tree = await bridge.hierarchy();
    if (exam.isResultScreen(tree)) {
      return { ok: true, finalTree: tree, perQuestion };
    }
    const pool = questions.filter((q) => !answeredIds.has(q.id));
    if (pool.length === 0) {
      return { ok: false, reason: "Hết pool nhưng chưa thấy màn Kết quả.", perQuestion };
    }
    const matchT = await timed(() => findMatchingQuestion(bridge, pool, tree, questionIndex));
    const matchResult = matchT.result;
    if (matchResult.status !== "MATCHED") {
      const outcomeLabel = matchResult.status === "AMBIGUOUS" ? "AMBIGUOUS_MATCH" : "NO_MATCH";
      return {
        ok: false,
        reason:
          matchResult.status === "AMBIGUOUS"
            ? `AMBIGUOUS_MATCH ở câu hiện tại: ${matchResult.diagnostic.contentEvidence?.candidates?.length ?? "?"} candidate CMS cùng khớp đủ answer-set.`
            : `NO_MATCH ở câu hiện tại (còn ${pool.length} câu trong pool).`,
        outcomeLabel,
        perQuestion,
      };
    }
    const matched = matchResult.question;
    const wantCorrect = wantCorrectMap.get(matched.id);
    const answerT = await timed(() =>
      exam.answerCurrentQuestionOneShot(matched, {
        wantCorrect,
        resultLabel: "resume_round4_stuck_q1_redo_result_screen",
        snapshot: matched._snapshot ?? null,
      }),
    );
    const outcome = answerT.result;
    if (!outcome.supported) {
      return { ok: false, reason: `Handler không hỗ trợ câu "${matched.question}": ${outcome.reason}`, outcomeLabel: "BLOCKED_MISSING_EXERCISE_HANDLER", perQuestion };
    }
    answeredIds.add(matched.id);
    perQuestion.push({ index: questionIndex, wantCorrect, isTargetCorrect: outcome.isTargetCorrect, durationMs: answerT.endedAt - matchT.startedAt });
    log(`    [resume] câu còn lại #${questionIndex}: nhắm ${wantCorrect ? "ĐÚNG" : "SAI"}, isTargetCorrect=${outcome.isTargetCorrect}, total=${fmtSec(answerT.endedAt - matchT.startedAt)}`);
    questionIndex += 1;
    if (exam.isResultScreen(outcome.finalTree)) {
      return { ok: true, finalTree: outcome.finalTree, perQuestion };
    }
  }
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
  const evidence = { title: TARGET_TITLE, roomId: TARGET_ROOM_ID };
  const overallStart = Date.now();

  log(`[1] Resolve câu hỏi/đáp án thật qua CMS cho room_id=${TARGET_ROOM_ID}...`);
  const resolved = await resolveHomeworkExamQuestionsForRoomId(TARGET_ROOM_ID);
  if (resolved.status !== "RESOLVED") {
    return finish({ ...evidence, status: "BLOCKED", error: `resolveHomeworkExamQuestionsForRoomId status=${resolved.status}: ${resolved.reason}` });
  }
  const QUESTIONS = resolved.questions;
  log(`  [PASS] ${QUESTIONS.length} scored items resolved từ CMS.`);

  const redoPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "target", targetScoreEnv: REDO_TARGET_SCORE });
  if (!redoPlan.achievable) {
    return finish({ ...evidence, status: "BLOCKED", error: `Target ${REDO_TARGET_SCORE} không khả thi: ${redoPlan.reason}` });
  }
  log(`  [PASS] targetScore Làm lại=${redoPlan.targetScore} (tái tạo, cần đúng ${redoPlan.correctIndices.size}/${QUESTIONS.length}).`);

  const stuckQuestion = QUESTIONS[STUCK_QUESTION_INDEX];
  const stuckWantCorrect = redoPlan.correctIndices.has(STUCK_QUESTION_INDEX);
  log(`  [RECOVER] Câu 1/10 (redo) đang kẹt = CMS index ${STUCK_QUESTION_INDEX} (id=${stuckQuestion.id}, "${stuckQuestion.question}", correct="${stuckQuestion.correctAnswer}") - nhắm ${stuckWantCorrect ? "ĐÚNG" : "SAI"} (sẽ tap "${stuckWantCorrect ? stuckQuestion.correctAnswer : "đáp án sai bất kỳ"}").`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);

  try {
    log(`[2] Kiểm tra đã sẵn ở màn Doing (Làm lại, câu 1, CHƯA chọn đáp án - tap trước đó không đăng ký) chưa...`);
    const alreadyDoing = await bridge.wait({ id: "exercise_close_button" }, { timeout: 2000 });
    if (!alreadyDoing.success) {
      return finish({ ...evidence, status: "FAIL", error: "Không ở màn Doing - script resume này chỉ xử lý case câu 1 kẹt chưa trả lời." });
    }
    log(`  [PASS] Đã ở màn Doing - resume thẳng.`);
    const redoAttemptStartedAt = Date.now();

    log(`[3a] Trả lời LẠI câu 1/10 (đáp án đúng đã biết, retry tap)...`);
    const manualAnswerT = await timed(() =>
      exam.answerCurrentQuestionOneShot(stuckQuestion, {
        wantCorrect: stuckWantCorrect,
        resultLabel: "resume_round4_stuck_q1_redo_result_screen",
        snapshot: null,
      }),
    );
    if (!manualAnswerT.result.supported) {
      return finish({ ...evidence, status: "BLOCKED", error: `Handler không hỗ trợ câu kẹt: ${manualAnswerT.result.reason}` });
    }
    log(`    [resume] câu #1 (retry): nhắm ${stuckWantCorrect ? "ĐÚNG" : "SAI"}, isTargetCorrect=${manualAnswerT.result.isTargetCorrect}, total=${fmtSec(manualAnswerT.durationMs)}`);

    log(`[3b] Trả lời các câu CÒN LẠI (Làm lại), nhắm tổng điểm ${redoPlan.targetScore}/10...`);
    const redoAnswer = await answerRemainingUntilResult(bridge, exam, QUESTIONS, redoPlan.correctIndices, [stuckQuestion.id]);
    if (!redoAnswer.ok) {
      return finish({ ...evidence, status: redoAnswer.outcomeLabel === "BLOCKED_MISSING_EXERCISE_HANDLER" ? "BLOCKED" : "FAIL", error: redoAnswer.reason, perQuestion: redoAnswer.perQuestion });
    }
    const redoAttemptEndedAt = Date.now();
    const redoResult = exam.readResult(redoAnswer.finalTree);
    const redoActualScore = redoResult.score === null ? null : Number(redoResult.score);
    const redoMatched = redoActualScore !== null && !Number.isNaN(redoActualScore) && Math.abs(redoActualScore - redoPlan.targetScore) < 1e-6;
    evidence.redoAttempt = {
      targetScore: redoPlan.targetScore,
      actualScore: redoActualScore,
      correct: redoResult.correct,
      matched: redoMatched,
      durationMs: redoAttemptEndedAt - redoAttemptStartedAt,
      perQuestion: redoAnswer.perQuestion,
      note: "Câu 1 (redo) đã kẹt (tap không đăng ký) ở tiến trình trước - trả lời lại thủ công ở resume này.",
    };
    log(`  TARGET=${redoPlan.targetScore} ĐIỂM THẬT=${redoResult.score} CHÍNH XÁC=${redoResult.correct} THỜI GIAN(phần resume)=${fmtSec(redoAttemptEndedAt - redoAttemptStartedAt)}`);
    if (!redoMatched) {
      return finish({ ...evidence, status: "FAIL", error: `Điểm thật ${redoActualScore} KHÁC target ${redoPlan.targetScore}.` });
    }

    log(`[4] Đọc CTA thật đang hiển thị trên màn Kết quả rồi bấm THẬT...`);
    const ctaTexts = collectAllTexts(redoAnswer.finalTree);
    const hasTiepTheo = ctaTexts.some((t) => /Tiếp theo/.test(t));
    const hasHoanThanh = ctaTexts.some((t) => /Hoàn thành/.test(t));
    if (!hasTiepTheo && !hasHoanThanh) {
      return finish({ ...evidence, status: "FAIL", error: `Không thấy CTA "Tiếp theo" lẫn "Hoàn thành". Texts: ${JSON.stringify(ctaTexts)}` });
    }
    const ctaToTap = hasTiepTheo ? "Tiếp theo" : "Hoàn thành";
    const tapFinalCta = await bridge.runSteps([{ tapOn: { text: `.*(${ctaToTap}).*` } }]);
    if (!tapFinalCta.success) {
      return finish({ ...evidence, status: "FAIL", error: `Tap "${ctaToTap}" thất bại: ${tapFinalCta.error}` });
    }
    const landExpectation = ctaToTap === "Tiếp theo" ? { id: "exercise_close_button" } : { id: "homework_screen" };
    const landResult = await bridge.wait(landExpectation, { timeout: 30000 });
    evidence.finalCta = { cta: ctaToTap, landed: landResult.success };
    if (!landResult.success) {
      return finish({ ...evidence, status: "FAIL", error: `Bấm "${ctaToTap}" nhưng không xác nhận được điều hướng đúng: ${landResult.error}` });
    }
    log(`  [PASS] Đã bấm THẬT "${ctaToTap}" - điều hướng đúng.`);

    evidence.totalDurationSeconds = (Date.now() - overallStart) / 1000;
    return finish({ ...evidence, status: "PASS" });
  } finally {
    await bridge.stop();
    log("[MCP] Đã dừng tiến trình `maestro mcp`.");
  }
}

main()
  .then((r) => {
    process.exit(r.status === "PASS" ? 0 : r.status === "BLOCKED" ? 3 : 1);
  })
  .catch((err) => {
    console.error("[resume-round4-stuck-q1-redo] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    process.exit(2);
  });
