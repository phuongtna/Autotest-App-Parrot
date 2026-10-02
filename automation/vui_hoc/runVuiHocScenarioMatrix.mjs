#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../src/config.js";
import { MaestroBridge } from "../bridge/maestroBridge.js";
import { NavigationEngine } from "../navigation/navigationEngine.js";
import { resolveVuiHocExamQuestions } from "./vuihocQuestionResolver.js";
import { VuiHocExamEngine } from "./vuiHocExamEngine.js";
import { findMatchingPoolEntry, detectQuestionUiType } from "./vuiHocQuestionMatcher.js";
import { resolveSortTargetOrder, computeNextSortMove } from "./vuiHocSortHandler.js";
import {
  collectTexts,
  hasResourceId,
  collectBlankIndices,
  resolveFillWordValues,
  collectDragDropZoneIndices,
  resolveDragDropCorrectValues,
  resolveConnectCorrectPairs,
  ensureAllConnectPairsVisible,
  tapConnectPairs,
  decideAnswerAction,
} from "../bai_tap/navigation/homeworkExamEngine.js";
import { ensureIdVisible } from "../bridge/scrollUntilVisible.js";
import {
  buildWrongChoiceAction,
  buildWrongFillWordValues,
  buildWrongSortTargetOrder,
  buildWrongDragDropValues,
  buildWrongConnectPairs,
} from "./vuiHocWrongAnswers.js";

/**
 * Chạy "Scenario Matrix" (Scenario A/B/C per câu, theo CMS id chỉ định) cho Self-learning baseline/
 * regression test - KHÁC `runVuiHocExercise.mjs` (luôn trả lời ĐÚNG mọi câu). Script NÀY cho phép
 * chỉ định 1 số câu CỤ THỂ (theo CMS id) phải trả lời theo Scenario B ("Sai lần 1 -> Đúng lần 2")
 * hoặc C ("Sai lần 1 -> Sai lần 2") - các câu còn lại mặc định Scenario A (đúng ngay lần 1, dùng
 * thẳng VuiHocExamEngine không đổi) để bài tiếp tục trôi tới màn Kết quả bình thường.
 *
 * Chạy:
 *   BOOK_NAME="Khối 8" UNIT_NAME="Review 4" LESSON_NAME="Language" EXERCISE_NAME="Đề part 2" \
 *   SCENARIO_MAP='{"<cmsId1>":"B","<cmsId2>":"C"}' \
 *   node automation/vui_hoc/runVuiHocScenarioMatrix.mjs
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");

function nowNs() {
  return process.hrtime.bigint();
}
function secondsSince(startNs) {
  return Number(nowNs() - startNs) / 1e9;
}
function log(...args) {
  console.log(...args);
}

function checkButtonTap() {
  return { tapOn: { id: "exercise_check_button", optional: true } };
}

function classifyTexts(texts) {
  const correct = texts.some((t) => t.startsWith("Chính xác"));
  const incorrect = texts.some((t) => t.startsWith("Chưa chính xác"));
  const canRetry = texts.includes("Thử lại");
  const ctaLabels = texts.filter((t) => /^(Thử lại|Tiếp tục|Tiếp theo|Hoàn thành)$/.test(t));
  return { correct, incorrect, canRetry, ctaLabels };
}

/** Chạy 1 batch step rồi đọc ĐÚNG 1 lần hierarchy() để lấy verdict - KHÔNG polling (cùng nguyên
 * tắc VuiHocExamEngine#_submitAndVerify()). */
async function submitAndRead(bridge, selectSteps, { retryTapFirst = false } = {}) {
  const steps = [
    ...(retryTapFirst ? [checkButtonTap(), { waitForAnimationToEnd: { timeout: 800 } }] : []),
    ...selectSteps,
    { waitForAnimationToEnd: { timeout: 1000 } },
    checkButtonTap(),
    { waitForAnimationToEnd: { timeout: 1200 } },
  ];
  const result = await bridge.runSteps(steps);
  if (!result.success) throw new Error(`submitAndRead thất bại: ${result.error}`);
  const tree = await bridge.hierarchy();
  const texts = collectTexts(tree);
  return { tree, texts, ...classifyTexts(texts) };
}

function isVisibleInTexts(texts) {
  return (t) => texts.some((x) => new RegExp(`^${t}$`).test(x));
}

/** Scenario B/C cho CHOICE - decideAnswerAction() KHÔNG cần đọc lại thiết bị giữa 2 lượt (options
 * cố định trên màn), tái sử dụng THẲNG `tree` gốc cho cả 2 lượt tap - giống đúng cách
 * VuiHocExamEngine#_answerChoice() làm với đáp án đúng. */
async function runChoiceScenario(bridge, questionModel, tree, scenario) {
  const scrollResult = await ensureIdVisible(bridge, tree, /^exercise_check_button$/);
  const scrolledTree = scrollResult.tree;
  const texts = collectTexts(scrolledTree);
  const isVisible = isVisibleInTexts(texts);
  const wrongAction = buildWrongChoiceAction(scrolledTree, isVisible, questionModel);
  if (!wrongAction) return { supported: false, reason: "CHOICE: không suy ra được đáp án SAI." };
  const correctAction = decideAnswerAction(scrolledTree, isVisible, questionModel, true);
  if (!correctAction) return { supported: false, reason: "CHOICE: không suy ra được đáp án ĐÚNG." };

  const stepFor = (action) => (action.type === "TEXT_CHOICE" ? { tapOn: action.text } : { tapOn: { point: action.point } });

  const attempt1 = await submitAndRead(bridge, [stepFor(wrongAction)]);
  const attempts = [attempt1];
  if (attempt1.canRetry) {
    const secondAction = scenario === "B" ? correctAction : wrongAction;
    const attempt2 = await submitAndRead(bridge, [stepFor(secondAction)], { retryTapFirst: true });
    attempts.push(attempt2);
  }
  return { supported: true, type: "CHOICE_SCENARIO", attempts };
}

async function runFillWordScenario(bridge, questionModel, tree, uiType, scenario) {
  const correctValues = resolveFillWordValues(questionModel);
  if (!correctValues) return { supported: false, reason: "FILL_WORD: không resolve được đáp án đúng." };
  const wrongValues = buildWrongFillWordValues(correctValues);

  const scrollResult = await ensureIdVisible(bridge, tree, /^exercise_check_button$/);
  const scrolledTree = scrollResult.tree;

  let blankIndices = null;
  if (uiType === "FILL_WORD_MULTI") {
    blankIndices = [...collectBlankIndices(scrolledTree)].sort((a, b) => a - b);
    if (blankIndices.length !== correctValues.length) {
      return { supported: false, reason: `FILL_WORD_MULTI: số ô trống (${blankIndices.length}) khác CMS (${correctValues.length}).` };
    }
  }

  let typed = false;
  const buildSteps = (values) => {
    const steps = [];
    if (uiType === "FILL_WORD_SINGLE") {
      steps.push({ tapOn: { id: "exercise_fillword_input" } });
      if (typed) steps.push({ eraseText: 80 });
      steps.push({ inputText: values[0] }, "hideKeyboard");
    } else {
      blankIndices.forEach((idx, i) => {
        steps.push({ tapOn: { id: `exercise_fillword_blank_${idx}` } });
        if (typed) steps.push({ eraseText: 80 });
        steps.push({ inputText: values[i] });
      });
      steps.push("hideKeyboard");
    }
    typed = true;
    return steps;
  };

  const attempt1 = await submitAndRead(bridge, buildSteps(wrongValues));
  const attempts = [attempt1];
  if (attempt1.canRetry) {
    const secondValues = scenario === "B" ? correctValues : wrongValues;
    const attempt2 = await submitAndRead(bridge, buildSteps(secondValues), { retryTapFirst: true });
    attempts.push(attempt2);
  }
  return { supported: true, type: `${uiType}_SCENARIO`, attempts };
}

async function runDragDropScenario(bridge, questionModel, tree, scenario) {
  const correctValues = resolveDragDropCorrectValues(questionModel);
  if (!correctValues) return { supported: false, reason: "DRAG_DROP: không resolve được đáp án đúng." };
  const wrongValues = buildWrongDragDropValues(questionModel, correctValues);
  if (!wrongValues) {
    return { supported: false, reason: "DRAG_DROP: không suy ra được đáp án SAI an toàn (thiếu distractor CMS cho câu 1 ô)." };
  }
  const scrollResult = await ensureIdVisible(bridge, tree, /^exercise_check_button$/);
  const zoneIndices = [...collectDragDropZoneIndices(scrollResult.tree)];
  if (zoneIndices.length !== correctValues.length) {
    return { supported: false, reason: `DRAG_DROP: số ô trống (${zoneIndices.length}) khác CMS (${correctValues.length}).` };
  }
  const buildSteps = (values) => values.map((word) => ({ tapOn: word }));

  const attempt1 = await submitAndRead(bridge, buildSteps(wrongValues));
  const attempts = [attempt1];
  if (attempt1.canRetry) {
    const secondValues = scenario === "B" ? correctValues : wrongValues;
    const attempt2 = await submitAndRead(bridge, buildSteps(secondValues), { retryTapFirst: true });
    attempts.push(attempt2);
  }
  return { supported: true, type: "DRAG_DROP_SCENARIO", attempts };
}

async function runSortScenario(bridge, questionModel, tree, scenario) {
  const correctOrder = resolveSortTargetOrder(questionModel);
  const wrongOrder = buildWrongSortTargetOrder(questionModel);
  if (!correctOrder || !wrongOrder) {
    return { supported: false, reason: "SORT: không suy ra được hoán vị SAI an toàn (cần >=2 đoạn)." };
  }

  const dragToOrder = async (targetOrder, startTree) => {
    let t = startTree;
    for (let round = 0; round < targetOrder.length; round++) {
      const move = computeNextSortMove(targetOrder, t);
      if (!move) return;
      const dragResult = await bridge.runSteps([move, { waitForAnimationToEnd: { timeout: 1500 } }]);
      if (!dragResult.success) throw new Error(`SORT: kéo thất bại (vòng ${round + 1}): ${dragResult.error}`);
      t = await bridge.hierarchy();
    }
  };

  await dragToOrder(wrongOrder, tree);
  const checkResult1 = await bridge.runSteps([checkButtonTap(), { waitForAnimationToEnd: { timeout: 1200 } }]);
  if (!checkResult1.success) throw new Error(`SORT: bấm Kiểm tra thất bại: ${checkResult1.error}`);
  const tree1 = await bridge.hierarchy();
  const texts1 = collectTexts(tree1);
  const attempt1 = { tree: tree1, texts: texts1, ...classifyTexts(texts1) };
  const attempts = [attempt1];

  if (attempt1.canRetry) {
    const retryTap = await bridge.runSteps([checkButtonTap(), { waitForAnimationToEnd: { timeout: 800 } }]);
    if (!retryTap.success) throw new Error(`SORT: bấm Thử lại thất bại: ${retryTap.error}`);
    const targetOrder2 = scenario === "B" ? correctOrder : wrongOrder;
    await dragToOrder(targetOrder2, await bridge.hierarchy());
    const checkResult2 = await bridge.runSteps([checkButtonTap(), { waitForAnimationToEnd: { timeout: 1200 } }]);
    if (!checkResult2.success) throw new Error(`SORT: bấm Kiểm tra (lượt 2) thất bại: ${checkResult2.error}`);
    const tree2 = await bridge.hierarchy();
    const texts2 = collectTexts(tree2);
    attempts.push({ tree: tree2, texts: texts2, ...classifyTexts(texts2) });
  }
  return { supported: true, type: "SORT_SCENARIO", attempts };
}

async function runConnectScenario(bridge, questionModel, tree, scenario) {
  const correctPairs = resolveConnectCorrectPairs(questionModel);
  const wrongPairs = buildWrongConnectPairs(questionModel);
  if (!correctPairs || !wrongPairs) {
    return { supported: false, reason: "CONNECT: không suy ra được cặp SAI an toàn (cần >=2 cặp)." };
  }
  const visibleResult = await ensureAllConnectPairsVisible(bridge, tree, correctPairs);
  const slots = visibleResult.slots;

  await tapConnectPairs(bridge, wrongPairs, slots, questionModel?.id, {
    label: "CONNECT scenario: nối cặp SAI",
    trailingSteps: [{ waitForAnimationToEnd: { timeout: 1500 } }],
  });
  const afterTapTree = await bridge.hierarchy();

  if (!hasResourceId(afterTapTree, /^exercise_check_button$/)) {
    return {
      supported: false,
      reason: "CONNECT: màn này tự chấm ngay khi nối đủ cặp (không có nút Kiểm tra) - không có khái niệm Thử lại để test Scenario B/C.",
    };
  }

  const checkResult1 = await bridge.runSteps([checkButtonTap(), { waitForAnimationToEnd: { timeout: 1200 } }]);
  if (!checkResult1.success) throw new Error(`CONNECT: bấm Kiểm tra thất bại: ${checkResult1.error}`);
  const tree1 = await bridge.hierarchy();
  const texts1 = collectTexts(tree1);
  const attempt1 = { tree: tree1, texts: texts1, ...classifyTexts(texts1) };
  const attempts = [attempt1];

  if (attempt1.canRetry) {
    const retryTap = await bridge.runSteps([checkButtonTap(), { waitForAnimationToEnd: { timeout: 800 } }]);
    if (!retryTap.success) throw new Error(`CONNECT: bấm Thử lại thất bại: ${retryTap.error}`);
    const pairsToTap = scenario === "B" ? correctPairs : wrongPairs;
    const freshTree = await bridge.hierarchy();
    const freshVisible = await ensureAllConnectPairsVisible(bridge, freshTree, correctPairs);
    await tapConnectPairs(bridge, pairsToTap, freshVisible.slots, questionModel?.id, {
      label: "CONNECT scenario: nối cặp lượt 2",
      trailingSteps: [{ waitForAnimationToEnd: { timeout: 1500 } }],
    });
    const checkResult2 = await bridge.runSteps([checkButtonTap(), { waitForAnimationToEnd: { timeout: 1200 } }]);
    if (!checkResult2.success) throw new Error(`CONNECT: bấm Kiểm tra (lượt 2) thất bại: ${checkResult2.error}`);
    const tree2 = await bridge.hierarchy();
    const texts2 = collectTexts(tree2);
    attempts.push({ tree: tree2, texts: texts2, ...classifyTexts(texts2) });
  }
  return { supported: true, type: "CONNECT_SCENARIO", attempts };
}

/** Sau khi hoàn tất 1 câu Scenario B/C (dù còn banner "Chính xác"/"Chưa chính xác" VẪN hiện hay đã
 * hết lượt), bấm ĐÚNG 1 lần nút CTA cuối cùng để đi tiếp - KHÔNG đoán cần bấm mấy lần, đọc lại
 * hierarchy TRƯỚC khi quyết định có cần bấm thêm không. */
async function advanceToNext(bridge) {
  let tree = await bridge.hierarchy();
  let texts = collectTexts(tree);
  const hasCta = () => texts.some((t) => /^(Tiếp tục|Tiếp theo|Hoàn thành)$/.test(t));
  let guard = 0;
  while (hasCta() && guard < 3) {
    const tap = await bridge.runSteps([checkButtonTap(), { waitForAnimationToEnd: { timeout: 1200 } }]);
    if (!tap.success) throw new Error(`advanceToNext: bấm CTA thất bại: ${tap.error}`);
    tree = await bridge.hierarchy();
    texts = collectTexts(tree);
    guard++;
  }
  return tree;
}

async function runScenarioQuestion(bridge, questionModel, tree, uiType, scenario) {
  switch (uiType) {
    case "CHOICE":
      return runChoiceScenario(bridge, questionModel, tree, scenario);
    case "FILL_WORD_SINGLE":
    case "FILL_WORD_MULTI":
      return runFillWordScenario(bridge, questionModel, tree, uiType, scenario);
    case "DRAG_DROP":
      return runDragDropScenario(bridge, questionModel, tree, scenario);
    case "SORT":
      return runSortScenario(bridge, questionModel, tree, scenario);
    case "CONNECT":
      return runConnectScenario(bridge, questionModel, tree, scenario);
    default:
      return { supported: false, reason: `Scenario matrix: uiType "${uiType}" không có handler.` };
  }
}

async function main() {
  const bookName = process.env.BOOK_NAME;
  const unitName = process.env.UNIT_NAME;
  const lessonName = process.env.LESSON_NAME;
  const exerciseName = process.env.EXERCISE_NAME;
  const scenarioMap = JSON.parse(process.env.SCENARIO_MAP || "{}");
  if (!bookName || !unitName || !lessonName || !exerciseName) {
    throw new Error("Cần BOOK_NAME/UNIT_NAME/LESSON_NAME/EXERCISE_NAME.");
  }

  log(`[ScenarioMatrix] Resolving "${bookName}" > "${unitName}" > "${lessonName}" > "${exerciseName}"`);
  const { examId, examName, questions } = await resolveVuiHocExamQuestions({ bookName, unitName, lessonName, exerciseName });
  log(`[ScenarioMatrix] Exam "${examName}" (${examId}) - ${questions.length} câu: ${questions.map((q) => q.type).join(", ")}`);
  log(`[ScenarioMatrix] SCENARIO_MAP: ${JSON.stringify(scenarioMap)}`);

  const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
  if (process.env.SKIP_NAVIGATION === "true") {
    log(`[ScenarioMatrix] SKIP_NAVIGATION=true - giả định thiết bị ĐÃ đứng ở 1 câu hỏi của đúng Exercise.`);
  } else {
    const nav = new NavigationEngine(bridge);
    const navStart = nowNs();
    await nav.navigateTo({ book: { name: bookName }, unit: { name: unitName }, lesson: { name: lessonName }, exercise: { name: exerciseName } });
    log(`[ScenarioMatrix] Đã vào bài (${secondsSince(navStart).toFixed(2)}s).`);
  }

  const engine = new VuiHocExamEngine(bridge);
  const pool = questions.map((q) => ({ question: q, answered: false }));
  const maxIterations = questions.length + 3;
  const perQuestionResults = [];
  let stoppedReason = "COMPLETED";
  let finalResult = null;

  let iter = 0;
  for (; iter < maxIterations; iter++) {
    const tree = await bridge.hierarchy();
    if (engine.isResultScreen(tree)) {
      finalResult = engine.readResult(tree);
      log(`[ScenarioMatrix] Đã tới màn Kết quả sau ${iter} câu. finalResult=${JSON.stringify(finalResult)}`);
      break;
    }
    const uiType = detectQuestionUiType(tree);
    if (!uiType) {
      stoppedReason = "UNKNOWN_SCREEN_TYPE";
      log(`[ScenarioMatrix] DỪNG - không nhận diện được UI type (vòng ${iter}).`);
      break;
    }
    let entry;
    try {
      entry = findMatchingPoolEntry(tree, uiType, pool);
    } catch (err) {
      stoppedReason = `MATCH_ERROR: ${err.message}`;
      log(`[ScenarioMatrix] DỪNG - ${err.message}`);
      break;
    }
    const scenario = scenarioMap[entry.question.id] || "A";
    const qStart = nowNs();
    log(`[ScenarioMatrix] Câu ${perQuestionResults.length + 1}: cmsId=${entry.question.id} cmsType=${entry.question.type} uiType=${uiType} scenario=${scenario}`);

    let record;
    if (scenario === "A") {
      let outcome;
      try {
        outcome = await engine.answerCurrentQuestion(entry.question, { maxAttempts: 3, tree, uiType });
      } catch (err) {
        outcome = { supported: false, reason: `THROW: ${err.message}` };
      }
      record = { cmsId: entry.question.id, cmsType: entry.question.type, uiType, scenario, seconds: secondsSince(qStart), ...outcome };
    } else {
      let outcome;
      try {
        outcome = await runScenarioQuestion(bridge, entry.question, tree, uiType, scenario);
        if (outcome.supported) await advanceToNext(bridge);
      } catch (err) {
        outcome = { supported: false, reason: `THROW: ${err.message}` };
      }
      record = { cmsId: entry.question.id, cmsType: entry.question.type, uiType, scenario, seconds: secondsSince(qStart), ...outcome };
    }
    entry.answered = true;
    perQuestionResults.push(record);
    log(`[ScenarioMatrix]   -> supported=${record.supported} (${record.seconds.toFixed(1)}s)`);
    if (!record.supported) {
      stoppedReason = "UNSUPPORTED_QUESTION";
      log(`[ScenarioMatrix] DỪNG - câu "${entry.question.id}" không hỗ trợ: ${record.reason}`);
      break;
    }
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = join(OUTPUT_DIR, `vuihoc_scenario_matrix_${Date.now()}.json`);
  writeFileSync(
    outPath,
    JSON.stringify({ examId, examName, bookName, unitName, lessonName, exerciseName, scenarioMap, stoppedReason, finalResult, perQuestionResults }, null, 2),
  );
  log(`[ScenarioMatrix] Đã ghi kết quả: ${outPath}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
