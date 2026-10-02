import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { NavigationEngine } from "./navigation/navigationEngine.js";
import { collectTexts } from "./bai_tap/navigation/homeworkExamEngine.js";
import { detectQuestionUiType } from "./vui_hoc/vuiHocQuestionMatcher.js";

const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const nav = new NavigationEngine(bridge);
await nav.navigateTo({
  book: { name: "Khối 6" },
  unit: { name: "Unit 1: My new school" },
  lesson: { name: "Vocabulary" },
  exercise: { name: "calculator" },
});
console.log("navigateTo done");
const tree = await bridge.hierarchy();
console.log("UI type:", detectQuestionUiType(tree));
console.log(JSON.stringify(collectTexts(tree), null, 2));
