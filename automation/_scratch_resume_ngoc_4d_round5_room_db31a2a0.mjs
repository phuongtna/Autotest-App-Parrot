#!/usr/bin/env node
/**
 * Recovery-in-place (2026-11-05, round 5): host/session restart KILL tiến trình script chính giữa
 * chừng NGAY SAU KHI đã trả lời THẬT câu 1/10 (room db31a2a0-96e9-4cca-bfdb-a06e4b61dd25, "Choose
 * the best words to complete the sentences.", Unit 20: At summer camp, VOCABULARY, due 12/11/2026,
 * 10 scored items, targetScore lần 1=3, Làm lại=6 - đã log trước khi crash). App vẫn đang ở màn
 * Doing, câu 2/10 ("Mai is ___ a story about a brave girl.") - KHÔNG re-run script chính (sẽ giao
 * thêm 1 room thật thứ 2). Resume thẳng: tái tạo CHÍNH XÁC cùng scoring plan bằng mode="target"
 * (KHÔNG "range" - "range" sẽ random lại target, có thể LỆCH với câu 1 đã trả lời thật) rồi trả lời
 * tiếp PHẦN CÒN LẠI cho tới khi thấy màn Kết quả (KHÔNG đếm cứng 10 câu - chỉ còn 9 câu sẽ thật sự
 * hiển thị trong tiến trình này vì câu 1 đã xong từ tiến trình cũ).
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
import {
  resolveScoringPlanForCandidate,
  buildWeightedWantCorrectPlan,
} from "../flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs";
import { findMatchingQuestion } from "./bai_tap/discovery/answerSetMatcher.js";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "resume_ngoc_4d_round5_room_db31a2a0_report.json");
const ROOT_ENV = parseEnvFile(join(PROJECT_ROOT, ".env"));

const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const TARGET_ROOM_ID = "db31a2a0-96e9-4cca-bfdb-a06e4b61dd25";
const TARGET_TITLE = "Choose the best words to complete the sentences.";
const DUE_DATE_DDMMYYYY = "12/11/2026";
const FIRST_TARGET_SCORE = 3;
const REDO_TARGET_SCORE = 6;
const MAX_LOCATE_SCROLLS = 60;

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

/** Resume-aware: KHÔNG đếm cứng questions.length (1 câu đã trả lời THẬT ở tiến trình trước, không
 * còn hiển thị lại) - dừng khi THẤY màn Kết quả, không phải khi đếm đủ answeredIds.size. */
async function answerRemainingUntilResult(bridge, exam, questions, correctIndices) {
  const wantCorrectMap = buildWeightedWantCorrectPlan(questions, correctIndices);
  const answeredIds = new Set();
  const perQuestion = [];
  let questionIndex = 1;
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
        resultLabel: "resume_round5_result_screen",
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

  // mode="target" (KHÔNG "range") - tái tạo CHÍNH XÁC plan đã dùng cho câu 1 đã trả lời thật
  // trước khi crash (buildScoringPlan() thuần/deterministic theo questions+target, xem
  // resolveScoringPlanForCandidate() trong e2e-teacher-assign-full-scored-target5.mjs).
  const firstPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "target", targetScoreEnv: FIRST_TARGET_SCORE });
  if (!firstPlan.achievable) {
    return finish({ ...evidence, status: "BLOCKED", error: `Target ${FIRST_TARGET_SCORE} không khả thi: ${firstPlan.reason}` });
  }
  const redoPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "target", targetScoreEnv: REDO_TARGET_SCORE });
  if (!redoPlan.achievable) {
    return finish({ ...evidence, status: "BLOCKED", error: `Target ${REDO_TARGET_SCORE} không khả thi: ${redoPlan.reason}` });
  }
  log(`  [PASS] targetScore lần 1=${firstPlan.targetScore} (tái tạo, cần đúng ${firstPlan.correctIndices.size}/${QUESTIONS.length}); targetScore Làm lại=${redoPlan.targetScore} (cần đúng ${redoPlan.correctIndices.size}/${QUESTIONS.length}).`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);

  try {
    log(`[2] Kiểm tra đã sẵn ở màn Doing chưa (tiến trình trước bị KILL giữa chừng ngay sau câu 1/10 - app vẫn giữ nguyên trạng thái câu 2/10)...`);
    const alreadyDoing = await bridge.wait({ id: "exercise_close_button" }, { timeout: 2000 });
    const firstAttemptStartedAt = Date.now();
    if (alreadyDoing.success) {
      log(`  [PASS] Đã ở màn Doing từ trước (lần làm đầu, đang dở) - bỏ qua locate/open, resume thẳng câu còn lại.`);
    } else {
      return finish({ ...evidence, status: "FAIL", error: "Không ở màn Doing và không có cơ chế relocate trong script resume này (chỉ xử lý case resume-giữa-chừng)." });
    }

    log(`[3] Trả lời các câu CÒN LẠI (lần làm đầu), nhắm tổng điểm ${firstPlan.targetScore}/10...`);
    const firstAnswer = await answerRemainingUntilResult(bridge, exam, QUESTIONS, firstPlan.correctIndices);
    if (!firstAnswer.ok) {
      return finish({ ...evidence, status: firstAnswer.outcomeLabel === "BLOCKED_MISSING_EXERCISE_HANDLER" ? "BLOCKED" : "FAIL", error: firstAnswer.reason, perQuestion: firstAnswer.perQuestion });
    }
    const firstAttemptEndedAt = Date.now();
    const firstResult = exam.readResult(firstAnswer.finalTree);
    const firstActualScore = firstResult.score === null ? null : Number(firstResult.score);
    const firstMatched = firstActualScore !== null && !Number.isNaN(firstActualScore) && Math.abs(firstActualScore - firstPlan.targetScore) < 1e-6;
    evidence.firstAttempt = {
      targetScore: firstPlan.targetScore,
      actualScore: firstActualScore,
      correct: firstResult.correct,
      matched: firstMatched,
      durationMs: firstAttemptEndedAt - firstAttemptStartedAt,
      perQuestion: firstAnswer.perQuestion,
      note: "1 câu đầu đã trả lời ở tiến trình trước khi crash - không có log perQuestion cho câu đó.",
    };
    log(`  TARGET=${firstPlan.targetScore} ĐIỂM THẬT=${firstResult.score} CHÍNH XÁC=${firstResult.correct} THỜI GIAN(phần resume)=${fmtSec(firstAttemptEndedAt - firstAttemptStartedAt)}`);
    if (!firstMatched) {
      return finish({ ...evidence, status: "FAIL", error: `Điểm thật ${firstActualScore} KHÁC target ${firstPlan.targetScore}.` });
    }

    const closeFirst = await bridge.runSteps([
      { runFlow: { when: { visible: "Hoàn thành" }, commands: [{ tapOn: { text: ".*(Hoàn thành).*" } }] } },
      { runFlow: { when: { visible: "Tiếp theo" }, commands: [{ tapOn: { id: "exercise_result_close_button" } }] } },
      { extendedWaitUntil: { visible: { id: "homework_screen" }, timeout: 30000 } },
    ]);
    if (!closeFirst.success) {
      return finish({ ...evidence, status: "FAIL", error: `Không quay lại homework_screen sau lần làm đầu: ${closeFirst.error}` });
    }
    log(`  [PASS] Đã đóng màn Kết quả (lần đầu), về lại danh sách Bài tập.`);

    log(`[4] Tìm lại card "${TARGET_TITLE}" (cta="Làm lại")...`);
    const relocated = await locateCompletedCandidateOrOpenFromNotification(bridge, TARGET_TITLE, {
      maxScrolls: MAX_LOCATE_SCROLLS,
      expectedScore: firstActualScore,
      notificationDueDateDdMmYyyy: DUE_DATE_DDMMYYYY,
    });
    evidence.locateLamLai = { source: relocated.source, scrollsUsed: relocated.scrollsUsed, stopReasonBeforeFallback: relocated.stopReasonBeforeFallback ?? null };

    let redoAttemptStartedAt;
    if (relocated.source === "NOTIFICATION" && relocated.alreadyOnDoingScreen) {
      log(`  [PASS] fallback qua thông báo "giao bài" PASS, đã vào màn Doing (lần 2).`);
      redoAttemptStartedAt = Date.now();
    } else {
      const freshCandidate = relocated.candidates?.[0];
      if (!freshCandidate) {
        return finish({ ...evidence, status: "FAIL", error: `locateCompletedCandidateOrOpenFromNotification không tìm thấy card "${TARGET_TITLE}" với cta="Làm lại".` });
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
      if (!tapRedo.success) {
        return finish({ ...evidence, status: "FAIL", error: `Tap "Làm lại" thất bại: ${tapRedo.error}` });
      }
      log(`  [PASS] Đã tap "Làm lại" - vào màn Doing (lần 2).`);
    }

    log(`[5] Trả lời lại (Làm lại, từ đầu - 10/10 câu mới), nhắm tổng điểm ${redoPlan.targetScore}/10...`);
    const redoAnswer = await answerRemainingUntilResult(bridge, exam, QUESTIONS, redoPlan.correctIndices);
    if (!redoAnswer.ok) {
      return finish({ ...evidence, status: redoAnswer.outcomeLabel === "BLOCKED_MISSING_EXERCISE_HANDLER" ? "BLOCKED" : "FAIL", error: redoAnswer.reason, redoPerQuestion: redoAnswer.perQuestion });
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
    };
    log(`  TARGET=${redoPlan.targetScore} ĐIỂM THẬT=${redoResult.score} CHÍNH XÁC=${redoResult.correct} THỜI GIAN=${fmtSec(redoAttemptEndedAt - redoAttemptStartedAt)}`);
    if (!redoMatched) {
      return finish({ ...evidence, status: "FAIL", error: `Điểm thật ${redoActualScore} KHÁC target ${redoPlan.targetScore}.` });
    }

    log(`[6] Đọc CTA thật đang hiển thị trên màn Kết quả rồi bấm THẬT...`);
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
    console.error("[resume-ngoc-4d-round5] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    process.exit(2);
  });
