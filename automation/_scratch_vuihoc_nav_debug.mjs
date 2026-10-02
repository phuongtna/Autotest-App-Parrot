import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { collectTexts, resolveFillWordValues, collectBlankIndices } from "./bai_tap/navigation/homeworkExamEngine.js";
import { resolveVuiHocExamQuestions } from "./vui_hoc/vuihocQuestionResolver.js";

const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const { questions } = await resolveVuiHocExamQuestions({ bookName: "Khối 8", unitName: "Review 4", lessonName: "Language", exerciseName: "Đề part 2" });
const q = questions.find((x) => x.id === "b6b32e57-4852-47a4-b645-42a7ae35f6b4");
const correctValues = resolveFillWordValues(q);
console.log("correctValues:", correctValues);

const tree = await bridge.hierarchy();
const blankIndices = [...collectBlankIndices(tree)].sort((a,b)=>a-b);
console.log("blankIndices:", blankIndices);

const steps = [];
blankIndices.forEach((idx, i) => {
  steps.push({ tapOn: { id: `exercise_fillword_blank_${idx}` } });
  steps.push({ inputText: correctValues[i] });
});
steps.push("hideKeyboard");
steps.push({ tapOn: { id: "exercise_check_button" } });
steps.push({ waitForAnimationToEnd: { timeout: 1500 } });

const r = await bridge.runSteps(steps);
console.log("answer result:", JSON.stringify(r));
console.log("after-answer texts:", JSON.stringify(collectTexts(await bridge.hierarchy())));
