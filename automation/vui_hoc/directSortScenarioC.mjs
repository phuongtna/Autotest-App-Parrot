import { config } from "../src/config.js";
import { MaestroBridge } from "../bridge/maestroBridge.js";
import { resolveVuiHocExamQuestions } from "./vuihocQuestionResolver.js";
import { resolveSortTargetOrder, computeNextSortMove } from "./vuiHocSortHandler.js";
import { collectTexts } from "../bai_tap/navigation/homeworkExamEngine.js";
import { buildWrongSortTargetOrder } from "./vuiHocWrongAnswers.js";

/**
 * Direct-handler bypass (per feedback_direct_handler_invocation_bypass.md): the generic
 * findMatchingPoolEntry() matcher can't disambiguate this exam's 2 SORT questions (both score 0
 * on anchor-text), but we already confirmed via CMS data + screenshot which one is live on
 * screen (id 359da13b..., "river pollution" paragraph) - drive it directly.
 */
const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });

const { questions } = await resolveVuiHocExamQuestions({
  bookName: "Khối 8",
  unitName: "Review 3",
  lessonName: "Language",
  exerciseName: "Language",
});
const q = questions.find((x) => x.id === "359da13b-94ab-485d-9121-c192a3fa3627");
if (!q) throw new Error("Không tìm thấy câu trong pool đã resolve.");

const correctOrder = resolveSortTargetOrder(q);
let wrongOrder = buildWrongSortTargetOrder(q);
// Nếu wrongOrder trùng hệt thứ tự ban đầu [0,1,2,3] (không cần kéo gì cả -> "Kiểm tra" không bao
// giờ enable), đổi sang hoán vị khác (swap 2 vị trí CUỐI của correctOrder) để đảm bảo có thao tác
// kéo thật xảy ra.
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
  const ctaLabels = texts.filter((t) => /^(Thử lại|Tiếp tục|Tiếp theo|Hoàn thành)$/.test(t));
  return { correct, incorrect, canRetry, ctaLabels };
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
  console.log("KHÔNG có Thử lại sau lượt 1 - DỪNG (không phải Scenario C mong đợi).");
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
