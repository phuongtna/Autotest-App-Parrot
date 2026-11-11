#!/usr/bin/env node
/**
 * Recovery-in-place #2 (2026-11-10, cùng room f5eb91c6-1e87-47ec-ab78-edd39a0c26b9 - xem
 * automation/_scratch_resume_round2_room_f5eb91c6.mjs cho phần trước): lần làm đầu đã PASS
 * (target=3, thật=3/10). Bước "Làm lại" (target=8/10) MỞ LẠI qua thông báo thành công, trả lời câu
 * 1 (SAI, đúng kế hoạch) + câu 2 (ĐÚNG, đúng kế hoạch) - rồi gặp LẠI CHÍNH XÁC cùng AMBIGUOUS_MATCH
 * ở câu 3/10 (3 candidate CMS cùng answer-set {on,at,in,to}: index 0/4/5) - app vẫn đứng yên tại câu
 * đó (xác nhận qua screenshot, y hệt lần trước: "What do you do ____ Sundays? – I listen to music.").
 * Disambiguate THỦ CÔNG GIỐNG HỆT lần trước = CMS index 0, id=3f42a8f3-..., correct="on". Dưới
 * redoPlan (target=8) index 0/4/5 ĐỀU wantCorrect=true (cùng đáp án "on") nên dù có lẫn đúng candidate
 * nào trong 3 candidate đó, hành động tap ĐÚNG vẫn như nhau - identity vẫn ghi đúng theo CMS thật đã
 * xác nhận qua stem text để nhất quán log/pool, không đoán mò.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseEnvFile } from "./src/config.js";
import { MaestroMcpBridge } from "./bridge/maestroMcpBridge.js";
import { HomeworkExamEngine } from "./bai_tap/navigation/homeworkExamEngine.js";
import { resolveHomeworkExamQuestionsForRoomId } from "./bai_tap/discovery/teacherMaterialsExamResolver.js";
import {
  resolveScoringPlanForCandidate,
  buildWeightedWantCorrectPlan,
} from "../flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs";
import { findMatchingQuestion } from "./bai_tap/discovery/answerSetMatcher.js";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "resume_round2_redo_q3_room_f5eb91c6_report.json");
const ROOT_ENV = parseEnvFile(join(PROJECT_ROOT, ".env"));

const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const TARGET_ROOM_ID = "f5eb91c6-1e87-47ec-ab78-edd39a0c26b9";
const TARGET_TITLE = "Choose the correct word to complete the sentences about the week";
const REDO_TARGET_SCORE = 8;
const AMBIGUOUS_QUESTION_INDEX = 0; // id=3f42a8f3-... "What do you do ____ Sundays? – I listen to music."
const KNOWN_ANSWERED_IDS_SO_FAR = [
  "e125eb4f-61b7-4e12-b96c-3c2ac8677a6e", // câu 1 redo (nhắm SAI, đã trả lời thật)
  "d13dcc25-960d-4d8d-aaaf-7b885530f53e", // câu 2 redo (nhắm ĐÚNG, đã trả lời thật)
];

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
        resultLabel: "resume_round2_redo_result_screen",
        snapshot: matched._snapshot ?? null,
      }),
    );
    const outcome = answerT.result;
    if (!outcome.supported) {
      return { ok: false, reason: `Handler không hỗ trợ câu "${matched.question}": ${outcome.reason}`, outcomeLabel: "BLOCKED_MISSING_EXERCISE_HANDLER", perQuestion };
    }
    answeredIds.add(matched.id);
    perQuestion.push({ index: questionIndex, wantCorrect, isTargetCorrect: outcome.isTargetCorrect, durationMs: answerT.endedAt - matchT.startedAt });
    log(`    [resume-redo] câu còn lại #${questionIndex}: nhắm ${wantCorrect ? "ĐÚNG" : "SAI"}, isTargetCorrect=${outcome.isTargetCorrect}, total=${fmtSec(answerT.endedAt - matchT.startedAt)}`);
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

  const ambiguousQuestion = QUESTIONS[AMBIGUOUS_QUESTION_INDEX];
  const ambiguousWantCorrect = redoPlan.correctIndices.has(AMBIGUOUS_QUESTION_INDEX);
  log(`  [DISAMBIGUATE] Câu 3/10 (redo) hiện đang hiển thị xác định thủ công = CMS index ${AMBIGUOUS_QUESTION_INDEX} (id=${ambiguousQuestion.id}, "${ambiguousQuestion.question}") - nhắm ${ambiguousWantCorrect ? "ĐÚNG" : "SAI"}.`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);

  try {
    log(`[2] Kiểm tra đã sẵn ở màn Doing (Làm lại, câu 3) chưa...`);
    const alreadyDoing = await bridge.wait({ id: "exercise_close_button" }, { timeout: 2000 });
    if (!alreadyDoing.success) {
      return finish({ ...evidence, status: "FAIL", error: "Không ở màn Doing - script resume này chỉ xử lý case resume-giữa-chừng tại câu 3 của Làm lại." });
    }
    log(`  [PASS] Đã ở màn Doing (Làm lại, đang dở ở câu 3) - resume thẳng.`);
    const redoAttemptStartedAt = Date.now();

    log(`[3a] Trả lời THỦ CÔNG câu 3/10 redo (đã disambiguate, bỏ qua findMatchingQuestion())...`);
    const manualAnswerT = await timed(() =>
      exam.answerCurrentQuestionOneShot(ambiguousQuestion, {
        wantCorrect: ambiguousWantCorrect,
        resultLabel: "resume_round2_redo_result_screen",
        snapshot: null,
      }),
    );
    if (!manualAnswerT.result.supported) {
      return finish({ ...evidence, status: "BLOCKED", error: `Handler không hỗ trợ câu disambiguate thủ công: ${manualAnswerT.result.reason}` });
    }
    log(`    [resume-redo] câu #3 (thủ công): nhắm ${ambiguousWantCorrect ? "ĐÚNG" : "SAI"}, isTargetCorrect=${manualAnswerT.result.isTargetCorrect}, total=${fmtSec(manualAnswerT.durationMs)}`);

    const knownAnsweredIds = [...KNOWN_ANSWERED_IDS_SO_FAR, ambiguousQuestion.id];

    log(`[3b] Trả lời các câu CÒN LẠI (Làm lại), nhắm tổng điểm ${redoPlan.targetScore}/10...`);
    const redoAnswer = await answerRemainingUntilResult(bridge, exam, QUESTIONS, redoPlan.correctIndices, knownAnsweredIds);
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
      note: "Câu 1,2 (redo) đã trả lời ở tiến trình trước khi FAIL lần 2 (AMBIGUOUS_MATCH câu 3); câu 3 trả lời thủ công (disambiguate) ở resume này.",
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
    console.error("[resume-round2-redo-q3-room-f5eb91c6] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    process.exit(2);
  });
