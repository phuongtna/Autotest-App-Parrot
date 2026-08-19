#!/usr/bin/env node
/**
 * E2E-Continue-From-Current-Screen
 *
 * PHÁT HIỆN THẬT (2026-08-18, xác nhận qua 2 lượt độc lập + screenshot trực tiếp): room
 * 69b2ff65-f8c7-4632-8556-cec3fe48db9c ("Choose the correct answer.", Unit 14/LESSON 1, N=10) tap
 * "Tiếp tục" LUÔN quay về CÂU 1 (screenshot xác nhận: "Which word means "cửa sổ"?", progress bar
 * chỉ ở vị trí câu 1/10, KHÔNG phải accumulated-correct) - dù badge card vẫn hiện "Tiếp tục" (khác
 * "Làm bài"). Bài tập KHÔNG persist tiến độ per-question khi thoát giữa chừng qua nút X - "Tiếp
 * tục" chỉ nghĩa là "mở lại đúng bài đang dở" ở CẤP ASSIGNMENT, KHÔNG phải "resume đúng câu chưa
 * làm". => 3 câu đã trả lời ở lượt chạy trước (2 đúng/1 sai) KHÔNG được server tính - baseline
 * current_correct=0 khi tiếp tục từ đây.
 *
 * KHÔNG tạo assignment mới (đúng RESUME-FIRST rule - vẫn dùng room 69b2ff65 sẵn có). Script NÀY
 * tiếp tục TRỰC TIẾP từ màn hình HIỆN TẠI trên thiết bị (đã xác nhận qua screenshot: đang ở câu 1,
 * chưa chọn đáp án) - KHÔNG launchApp/không điều hướng lại, tránh restart app không cần thiết
 * (PERFORMANCE: "Không restart app giữa các bước lifecycle trừ khi thực sự cần").
 *
 * CHẠY: node flows/giao_bai_tap/e2e-continue-from-current-screen.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MaestroMcpBridge } from "../../../automation/bridge/maestroMcpBridge.js";
import { HomeworkExamEngine, decideAnswerAction } from "../../../automation/bai_tap/navigation/homeworkExamEngine.js";
import { resolveHomeworkExamQuestionsForRoomId } from "../../../automation/bai_tap/discovery/teacherMaterialsExamResolver.js";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "e2e_continue_from_current_screen_report.json");
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const TARGET_SCORE_RANGE_LABEL = "[6.0, 8.0]";
const ROOM_ID = process.env.ROOM_ID || "69b2ff65-f8c7-4632-8556-cec3fe48db9c";

function log(...args) { console.log(...args); }

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function collectAllTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectAllTexts(c, acc);
  return acc;
}

function isVisibleInTree(texts, textPattern) {
  const pattern = new RegExp(`^${textPattern}$`);
  return texts.some((t) => pattern.test(t));
}

async function findMatchingQuestion(bridge, pool, priorTree) {
  const tree = priorTree ?? (await bridge.hierarchy());
  const texts = collectAllTexts(tree);
  const isVisible = (t) => isVisibleInTree(texts, t);
  for (const q of pool) {
    const action = decideAnswerAction(tree, isVisible, q, true);
    if (action) return { ...q, _snapshot: { tree, texts } };
  }
  return null;
}

async function answerOneQuestion(exam, matched, isLast, wantCorrectMap) {
  const wantCorrect = wantCorrectMap.get(matched.id);
  const outcome = await exam.answerCurrentQuestionOneShot(matched, {
    wantCorrect,
    resultLabel: isLast ? "e2e_continue_from_current_screen_result_screen" : null,
    snapshot: matched._snapshot ?? null,
  });
  if (!outcome.supported) {
    throw new Error(`Handler không hỗ trợ câu "${matched.question}" (id=${matched.id}): ${outcome.reason}`);
  }
  return { matched, wantCorrect, outcome };
}

function computeScorePlan(totalCount) {
  let best = null;
  for (let c = 0; c <= totalCount; c++) {
    const predicted = Math.round((c / totalCount) * 100) / 10;
    if (predicted < 6.0 || predicted > 8.0) continue;
    const validOptions = best ?? [];
    validOptions.push({ correctCount: c, predictedScore: predicted });
    best = validOptions;
  }
  return best;
}

function buildWantCorrectPlan(questionIds, correctCount) {
  const shuffled = shuffle(questionIds);
  const correctSet = new Set(shuffled.slice(0, correctCount));
  const map = new Map();
  for (const id of questionIds) map.set(id, correctSet.has(id));
  return map;
}

function finish(result) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  return result;
}

async function main() {
  const overallStart = Date.now();
  const evidence = {};

  log(`[1/3] Resolve câu hỏi/đáp án CHÍNH XÁC theo room.id (nguồn CMS/Exam)...`);
  const resolved = await resolveHomeworkExamQuestionsForRoomId(ROOM_ID);
  if (resolved.status !== "RESOLVED") {
    return finish({ status: "BLOCKED", phase: "CMS_RESOLUTION", error: `status=${resolved.status}: ${resolved.reason}`, evidence });
  }
  const QUESTIONS = resolved.questions;
  const rd = resolved.roomDetails;
  const options = computeScorePlan(QUESTIONS.length);
  if (!options || options.length === 0) {
    return finish({ status: "BLOCKED", phase: "SCORING_PLAN", error: `N=${QUESTIONS.length} câu - không tồn tại correctCount nguyên cho điểm dự đoán trong ${TARGET_SCORE_RANGE_LABEL}.`, evidence });
  }
  const chosenPlan = options[Math.floor(Math.random() * options.length)];
  const WANT_CORRECT = buildWantCorrectPlan(QUESTIONS.map((q) => q.id), chosenPlan.correctCount);
  evidence.randomAssignment = {
    unitName: rd.unit_name,
    lessonName: rd.lesson_name,
    lessonItemId: rd.lesson_item_id,
    roomExamId: resolved.examId,
    roomId: ROOM_ID,
    questionCount: QUESTIONS.length,
    plannedCorrectCount: chosenPlan.correctCount,
    predictedScore: chosenPlan.predictedScore,
    baselineNote: "current_correct=0 (phát hiện: 'Tiếp tục' reset về câu 1, 3 câu trả lời lượt trước KHÔNG được server tính) - plan tính lại cho ĐỦ 10 câu từ đầu, KHÔNG tạo assignment mới.",
  };
  log(`  [PASS] N=${QUESTIONS.length} câu, correctCount kế hoạch=${chosenPlan.correctCount} (dự đoán=${chosenPlan.predictedScore}).`);

  const bridge = new MaestroMcpBridge({ appId: process.env.APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);

  try {
    evidence.mcpPerformance = {
      get runCallCount() { return bridge.runCallCount; },
      get hierarchyCallCount() { return bridge.hierarchyCallCount; },
    };

    log(`[2/3] Xác nhận màn hình HIỆN TẠI (KHÔNG launchApp/điều hướng lại) khớp câu 1 của room này...`);
    const firstMatch = await findMatchingQuestion(bridge, QUESTIONS);
    if (!firstMatch) {
      return finish({
        status: "FAIL",
        phase: "CURRENT_SCREEN_MISMATCH",
        error: `Màn hình hiện tại KHÔNG khớp câu nào trong ${QUESTIONS.length} câu của room ${ROOM_ID} - có thể app đã điều hướng đi nơi khác.`,
        visibleTexts: collectAllTexts(await bridge.hierarchy()),
        evidence,
      });
    }
    log(`  [PASS] Màn hình hiện tại khớp câu "${firstMatch.id}" (${firstMatch.question}).`);

    log(`[3/3] Trả lời toàn bộ ${QUESTIONS.length} câu theo kế hoạch...`);
    const answeredIds = new Set();
    const answerLog = [];
    let lastOutcome = null;
    let carryTree = firstMatch._snapshot?.tree ?? null;
    while (answeredIds.size < QUESTIONS.length) {
      const pool = QUESTIONS.filter((q) => !answeredIds.has(q.id));
      const matched = await findMatchingQuestion(bridge, pool, carryTree);
      if (!matched) {
        return finish({
          status: "FAIL",
          phase: "ANSWER_LOOP",
          error: `Không khớp được câu hỏi nào (còn ${pool.length} câu) với màn hình hiện tại.`,
          visibleTexts: collectAllTexts(await bridge.hierarchy()),
          evidence: { ...evidence, answerLog },
        });
      }
      const isLast = answeredIds.size === QUESTIONS.length - 1;
      const { wantCorrect, outcome } = await answerOneQuestion(exam, matched, isLast, WANT_CORRECT);
      lastOutcome = outcome;
      carryTree = outcome.finalTree ?? null;
      answeredIds.add(matched.id);
      answerLog.push({ id: matched.id, question: matched.question, wantCorrect, isTargetCorrect: outcome.isTargetCorrect, type: outcome.type });
      log(`  Câu ${answeredIds.size}/${QUESTIONS.length} (${matched.id}): "${matched.question}" - nhắm ${wantCorrect ? "ĐÚNG" : "SAI"}, isTargetCorrect=${outcome.isTargetCorrect}`);
    }
    evidence.answerLog = answerLog;

    log("Xác nhận màn Kết quả + đọc điểm thật...");
    const finalTree = lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(finalTree)) {
      return finish({ status: "FAIL", phase: "RESULT_SCREEN", error: "Không thấy màn hình Kết quả sau khi trả lời hết toàn bộ câu.", evidence });
    }
    const result = exam.readResult(finalTree);
    evidence.result = result;
    log(`  ĐIỂM SỐ=${result.score} CHÍNH XÁC=${result.correct}`);

    const scoreNumber = result.score === null ? null : Number(result.score);
    const scoreValid = scoreNumber !== null && !Number.isNaN(scoreNumber);
    const scoreInRange = scoreValid && scoreNumber >= 6.0 && scoreNumber <= 8.0;
    evidence.scoreInterpretation = {
      questionCount: QUESTIONS.length,
      plannedCorrectCount: chosenPlan.correctCount,
      realCorrectCountFromResultScreen: result.correctCount,
      predictedScore: chosenPlan.predictedScore,
      actualScore: scoreNumber,
      scoreInRangeTarget: scoreInRange,
      targetRange: TARGET_SCORE_RANGE_LABEL,
    };

    await bridge.runSteps([
      { runFlow: { when: { visible: "Hoàn thành" }, commands: [{ tapOn: { text: ".*(Hoàn thành).*" } }] } },
      { runFlow: { when: { visible: "Tiếp theo" }, commands: [{ tapOn: { id: "exercise_result_close_button" } }] } },
    ]);
    await bridge.wait({ id: "homework_screen" }, { timeout: 30000 });

    const overallPass = answeredIds.size === QUESTIONS.length && scoreInRange;
    evidence.totalDurationSeconds = (Date.now() - overallStart) / 1000;
    return finish({ status: overallPass ? "PASS" : "FAIL", phase: overallPass ? null : "SCORE_VERIFY", evidence });
  } finally {
    await bridge.stop();
    log("[MCP] Đã dừng tiến trình `maestro mcp` (cleanup cuối flow).");
  }
}

main()
  .then((result) => {
    log(`\n=== KẾT QUẢ: ${result.status}${result.phase ? ` (phase=${result.phase})` : ""} ===`);
    log(`Đã ghi report ra ${OUTPUT_FILE}`);
    process.exit(result.status === "PASS" ? 0 : result.status === "BLOCKED" ? 2 : 1);
  })
  .catch((err) => {
    console.error("\n[e2e-continue-from-current-screen] Dừng lại vì lỗi ngoài dự kiến:\n");
    console.error(err);
    process.exit(1);
  });
