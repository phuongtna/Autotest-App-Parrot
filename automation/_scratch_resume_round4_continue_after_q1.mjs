#!/usr/bin/env node
/**
 * Continuation (2026-11-10, round 4): câu 1/10 của Làm lại (room de05be4b-92d8-4cd3-9e80-f8c0b7527d44)
 * đã được xử lý THỦ CÔNG qua `maestro test` (swipe CONTENT_SWIPE thêm 1 bước TRƯỚC khi tap "Rainy" -
 * TÁI DÙNG nguyên văn cơ chế cuộn đã có sẵn trong automation/bridge/scrollUntilVisible.js, theo đúng
 * yêu cầu/memory đã note trước đó - KHÔNG viết cơ chế cuộn mới). `resolveContentViewport()` cắt
 * viewport ở mép trên footer nhưng CHỈ so khớp PIXEL CHÍNH XÁC (text "Rainy" cách mép footer có
 * ~14px) - đủ để coi "đã visible" nên KHÔNG kích hoạt cuộn tự động, nhưng clearance đó KHÔNG đủ để
 * tap đăng ký thật (xác nhận qua diagnostic tap độc lập: thất bại cả khi cô lập hoàn toàn khỏi toàn
 * bộ answer engine). Cuộn thêm 1 bước thủ công (CÙNG hằng số CONTENT_SWIPE) đã xác nhận THẬT: fix
 * được ngay - "Rainy" selected=true, exercise_check_button enabled=true, tap "Tiếp theo" đã qua câu
 * 2/10. Script này tiếp tục trả lời các câu CÒN LẠI (2-10) qua đúng vòng lặp chuẩn
 * (findMatchingQuestion + answerCurrentQuestionOneShot, COPY từ automation/_scratch_resume_round4_
 * stuck_q1_redo.mjs's answerRemainingUntilResult()) - KHÔNG re-run script chính.
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
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "resume_round4_continue_after_q1_report.json");
const ROOT_ENV = parseEnvFile(join(PROJECT_ROOT, ".env"));

const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const TARGET_ROOM_ID = "de05be4b-92d8-4cd3-9e80-f8c0b7527d44";
const TARGET_TITLE = "Read the passage and choose the best answer (A, B, C or D) for each question.";
const REDO_TARGET_SCORE = 9;
const ALREADY_ANSWERED_IDS = ["8ff8237b-c4c0-485e-8f2c-ac7d49887685"]; // câu 1 (Rainy, ĐÚNG) - đã xử lý thủ công

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
        resultLabel: "resume_round4_continue_result_screen",
        snapshot: matched._snapshot ?? null,
      }),
    );
    const outcome = answerT.result;
    if (!outcome.supported) {
      return { ok: false, reason: `Handler không hỗ trợ câu "${matched.question}": ${outcome.reason}`, outcomeLabel: "BLOCKED_MISSING_EXERCISE_HANDLER", perQuestion, stuckQuestionId: matched.id, stuckWantCorrect: wantCorrect };
    }
    answeredIds.add(matched.id);
    perQuestion.push({ index: questionIndex, id: matched.id, question: matched.question, wantCorrect, isTargetCorrect: outcome.isTargetCorrect, durationMs: answerT.endedAt - matchT.startedAt });
    log(`    [resume] câu còn lại #${questionIndex} (id=${matched.id}): nhắm ${wantCorrect ? "ĐÚNG" : "SAI"}, isTargetCorrect=${outcome.isTargetCorrect}, total=${fmtSec(answerT.endedAt - matchT.startedAt)}`);
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

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);

  try {
    log(`[2] Kiểm tra đã ở màn Doing (câu 2/10, câu 1 đã xử lý thủ công qua cuộn+tap "Rainy") chưa...`);
    const alreadyDoing = await bridge.wait({ id: "exercise_close_button" }, { timeout: 2000 });
    if (!alreadyDoing.success) {
      return finish({ ...evidence, status: "FAIL", error: "Không ở màn Doing - script này chỉ tiếp tục từ câu 2 trở đi." });
    }
    log(`  [PASS] Đã ở màn Doing - tiếp tục câu 2.`);
    const redoAttemptStartedAt = Date.now();

    log(`[3] Trả lời các câu còn lại (2-10), nhắm tổng điểm ${redoPlan.targetScore}/10...`);
    const redoAnswer = await answerRemainingUntilResult(bridge, exam, QUESTIONS, redoPlan.correctIndices, ALREADY_ANSWERED_IDS);
    if (!redoAnswer.ok) {
      return finish({
        ...evidence,
        status: redoAnswer.outcomeLabel === "BLOCKED_MISSING_EXERCISE_HANDLER" ? "BLOCKED" : "FAIL",
        error: redoAnswer.reason,
        perQuestion: redoAnswer.perQuestion,
        stuckQuestionId: redoAnswer.stuckQuestionId,
        stuckWantCorrect: redoAnswer.stuckWantCorrect,
      });
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
      note: "Câu 1 xử lý thủ công qua cuộn+tap thủ công (automation/bridge/scrollUntilVisible.js's CONTENT_SWIPE, 1 bước thêm) trước khi chạy script này.",
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
    console.error("[resume-round4-continue] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    process.exit(2);
  });
