import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { NavigationEngine } from "./navigation/navigationEngine.js";
import { collectTexts } from "./bai_tap/navigation/homeworkExamEngine.js";
import { detectQuestionUiType } from "./vui_hoc/vuiHocQuestionMatcher.js";

const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const nav = new NavigationEngine(bridge);
const start = process.hrtime.bigint();
await nav.navigateTo({
  book: { name: "Khối 6" },
  unit: { name: "Unit 1: My new school" },
  lesson: { name: "Getting started" },
  exercise: { name: "smart" },
});
console.log(`navigateTo done in ${Number(process.hrtime.bigint()-start)/1e9}s`);
const tree = await bridge.hierarchy();
const texts = collectTexts(tree);
console.log("UI type:", detectQuestionUiType(tree));
console.log(JSON.stringify(texts, null, 2));
