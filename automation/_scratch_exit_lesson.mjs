import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { collectTexts } from "./bai_tap/navigation/homeworkExamEngine.js";
const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const r = await bridge.runSteps([
  { tapOn: { id: "learning_close_button" } },
  { waitForAnimationToEnd: { timeout: 1500 } },
]);
console.log("tap close success:", r.success, r.error || "");
const tree = await bridge.hierarchy();
console.log(JSON.stringify(collectTexts(tree), null, 2));
