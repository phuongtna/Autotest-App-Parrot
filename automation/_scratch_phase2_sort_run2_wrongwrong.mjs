import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { resolveVuiHocExamQuestions } from "./vui_hoc/vuihocQuestionResolver.js";
import { resolveSortTargetOrder, computeNextSortMove } from "./vui_hoc/vuiHocSortHandler.js";
import { collectTexts } from "./bai_tap/navigation/homeworkExamEngine.js";
import { buildWrongSortTargetOrder } from "./vui_hoc/vuiHocWrongAnswers.js";

const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });

const QID = process.argv[2];
const { questions } = await resolveVuiHocExamQuestions({
  bookName: "Khối 7",
  unitName: "Review 1",
  lessonName: "Language",
  exerciseName: "Thử thách Language",
});
const q = questions.find((x) => x.id === QID);
const correctOrder = resolveSortTargetOrder(q);
let wrongOrder = buildWrongSortTargetOrder(q);
if (JSON.stringify(wrongOrder) === JSON.stringify([...wrongOrder.keys()])) {
  wrongOrder = [...correctOrder];
  [wrongOrder[2], wrongOrder[3]] = [wrongOrder[3], wrongOrder[2]];
}
console.log("correctOrder", correctOrder, "wrongOrder", wrongOrder);

function checkButtonTap() {
  return { tapOn: { id: "exercise_check_button", optional: true } };
}
function classify(texts) {
  const correct = texts.some((t) => t.startsWith("Chính xác"));
  const incorrect = texts.some((t) => t.startsWith("Chưa chính xác"));
  const canRetry = texts.includes("Thử lại");
  return { correct, incorrect, canRetry };
}

async function dragToOrder(targetOrder, startTree) {
  let t = startTree;
  for (let round = 0; round < targetOrder.length; round++) {
    const move = computeNextSortMove(targetOrder, t);
    if (!move) return t;
    const r = await bridge.runSteps([move, { waitForAnimationToEnd: { timeout: 1500 } }]);
    if (!r.success) throw new Error(`drag thất bại (vòng ${round + 1}): ${r.error}`);
    t = await bridge.hierarchy();
  }
  return t;
}

let tree = await bridge.hierarchy();
console.log("BEFORE:", collectTexts(tree).filter(Boolean).join(" | "));

tree = await dragToOrder(wrongOrder, tree);
const check1 = await bridge.runSteps([checkButtonTap(), { waitForAnimationToEnd: { timeout: 1200 } }]);
if (!check1.success) throw new Error(`Kiểm tra lượt 1 thất bại: ${check1.error}`);
let tree1 = await bridge.hierarchy();
let texts1 = collectTexts(tree1);
let v1 = classify(texts1);
console.log("ATTEMPT 1 (wrong order):", JSON.stringify(v1), "\n  texts:", texts1.filter(Boolean).join(" | "));

if (!v1.canRetry) {
  console.log("KHÔNG có Thử lại sau lượt 1 - DỪNG.");
  process.exit(0);
}

const retryTap = await bridge.runSteps([checkButtonTap(), { waitForAnimationToEnd: { timeout: 800 } }]);
if (!retryTap.success) throw new Error(`Bấm Thử lại thất bại: ${retryTap.error}`);
let tree2 = await bridge.hierarchy();
tree2 = await dragToOrder(wrongOrder, tree2);
const check2 = await bridge.runSteps([checkButtonTap(), { waitForAnimationToEnd: { timeout: 1200 } }]);
if (!check2.success) throw new Error(`Kiểm tra lượt 2 thất bại: ${check2.error}`);
const treeFinal = await bridge.hierarchy();
const textsFinal = collectTexts(treeFinal);
const v2 = classify(textsFinal);
console.log("ATTEMPT 2 (wrong order again):", JSON.stringify(v2), "\n  texts:", textsFinal.filter(Boolean).join(" | "));
console.log("DONE - canRetry after attempt2:", v2.canRetry, "(expect false)");
