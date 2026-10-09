import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { resolveVuiHocExamQuestions } from "./vui_hoc/vuihocQuestionResolver.js";
import { resolveSortTargetOrder, computeNextSortMove } from "./vui_hoc/vuiHocSortHandler.js";
import { collectTexts } from "./bai_tap/navigation/homeworkExamEngine.js";

const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });

const { questions } = await resolveVuiHocExamQuestions({
  bookName: "Khối 7",
  unitName: "Review 1",
  lessonName: "Language",
  exerciseName: "Thử thách Language",
});
const q = questions.find((x) => x.id === "c29117e5-a6f7-4f3d-a44b-8a1d660b0dbc");
const correctOrder = resolveSortTargetOrder(q);
console.log("correctOrder", correctOrder);

function checkButtonTap() {
  return { tapOn: { id: "exercise_check_button", optional: true } };
}

let tree = await bridge.hierarchy();
console.log("BEFORE:", collectTexts(tree).filter(Boolean).join(" | "));

for (let round = 0; round < correctOrder.length; round++) {
  const move = computeNextSortMove(correctOrder, tree);
  if (!move) break;
  const r = await bridge.runSteps([move, { waitForAnimationToEnd: { timeout: 1500 } }]);
  if (!r.success) throw new Error(`drag thất bại (vòng ${round + 1}): ${r.error}`);
  tree = await bridge.hierarchy();
}

const check1 = await bridge.runSteps([checkButtonTap(), { waitForAnimationToEnd: { timeout: 1200 } }]);
if (!check1.success) throw new Error(`Kiểm tra thất bại: ${check1.error}`);
const treeFinal = await bridge.hierarchy();
console.log("RESULT:", collectTexts(treeFinal).filter(Boolean).join(" | "));
