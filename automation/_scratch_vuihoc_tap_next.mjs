import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { collectTexts } from "./bai_tap/navigation/homeworkExamEngine.js";
import { detectQuestionUiType } from "./vui_hoc/vuiHocQuestionMatcher.js";

const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const result = await bridge.runSteps([
  { tapOn: { text: "Tiếp theo" } },
  { waitForAnimationToEnd: { timeout: 1500 } },
]);
console.log("result:", JSON.stringify(result));
const tree = await bridge.hierarchy();
const texts = collectTexts(tree);
console.log("uiType:", detectQuestionUiType(tree));
console.log("texts:", JSON.stringify(texts.slice(0, 60)));
