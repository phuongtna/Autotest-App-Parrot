import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { collectTexts, hasResourceId } from "./bai_tap/navigation/homeworkExamEngine.js";
import { detectQuestionUiType } from "./vui_hoc/vuiHocQuestionMatcher.js";
const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const tree = await bridge.hierarchy();
const texts = collectTexts(tree);
console.log("uiType:", detectQuestionUiType(tree), "hasCheckBtn:", hasResourceId(tree, /^exercise_check_button$/));
console.log(JSON.stringify(texts, null, 2));
