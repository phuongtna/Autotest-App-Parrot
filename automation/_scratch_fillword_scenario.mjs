import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { collectTexts, collectBlankIndices } from "./bai_tap/navigation/homeworkExamEngine.js";
const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });

const valuesArg = process.argv[2]; // comma-separated values for each blank, in index order
const values = valuesArg.split(",");

const tree = await bridge.hierarchy();
const blankIndices = [...collectBlankIndices(tree)].sort((a,b)=>a-b);
console.log("blankIndices:", blankIndices, "values to type:", values);

const steps = [];
blankIndices.forEach((idx, i) => {
  steps.push({ tapOn: { id: `exercise_fillword_blank_${idx}` } });
  steps.push({ inputText: values[i] });
});
steps.push("hideKeyboard");
steps.push({ waitForAnimationToEnd: { timeout: 800 } });
steps.push({ tapOn: { id: "exercise_check_button" } });
steps.push({ waitForAnimationToEnd: { timeout: 1200 } });

const r = await bridge.runSteps(steps);
console.log("submit success:", r.success, r.error || "");
const tree2 = await bridge.hierarchy();
console.log(JSON.stringify(collectTexts(tree2), null, 2));
