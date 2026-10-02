import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { NavigationEngine } from "./navigation/navigationEngine.js";
import { collectTexts } from "./bai_tap/navigation/homeworkExamEngine.js";

const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const nav = new NavigationEngine(bridge);

async function step(label, steps) {
  console.log(`--- ${label} ---`);
  const result = await bridge.runSteps(steps);
  console.log("result:", JSON.stringify(result).slice(0, 300));
  const tree = await bridge.hierarchy();
  const texts = collectTexts(tree);
  console.log("texts:", JSON.stringify(texts.slice(0, 40)));
  return result;
}

await step("CLOSE STRAY", [
  { tapOn: { id: "exercise_close_button", optional: true } },
  { tapOn: { id: "learning_close_button", optional: true } },
  { tapOn: { text: ".*(Hoàn thành|Đóng|Thoát|Rời khỏi).*", optional: true } },
  { tapOn: { id: "tab_happy_learning", optional: true } },
]);
await step("DISMISS POPUPS", nav._dismissKnownPopupsSteps());
await step("BOOK SELECT", nav._ensureBookSelectedSteps("Khối 8"));
await step("UNIT OPEN", nav._ensureUnitOpenSteps("Review 4"));
