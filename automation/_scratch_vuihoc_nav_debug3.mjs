import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { NavigationEngine } from "./navigation/navigationEngine.js";
import { collectTexts } from "./bai_tap/navigation/homeworkExamEngine.js";

const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const nav = new NavigationEngine(bridge);

async function step(label, steps) {
  console.log(`--- ${label} ---`);
  const result = await bridge.runSteps(steps);
  console.log("result:", JSON.stringify(result).slice(0, 500));
  const tree = await bridge.hierarchy();
  const texts = collectTexts(tree);
  console.log("texts:", JSON.stringify(texts.slice(0, 50)));
  return result;
}

await step("LESSON OPEN (Language)", nav._openLessonSteps("Language"));
