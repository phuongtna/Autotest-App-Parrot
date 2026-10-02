import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { collectTexts } from "./bai_tap/navigation/homeworkExamEngine.js";
const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const result = await bridge.runSteps([
  { tapOn: "Tiếp theo" },
  { waitForAnimationToEnd: { timeout: 1500 } },
]);
console.log("tap success:", result.success, result.error || "");
const tree = await bridge.hierarchy();
console.log(JSON.stringify(collectTexts(tree), null, 2));
