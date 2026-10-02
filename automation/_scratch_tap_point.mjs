import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { collectTexts } from "./bai_tap/navigation/homeworkExamEngine.js";
const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const point = process.argv[2]; // e.g. "540,1718"
const r = await bridge.runSteps([{ tapOn: { point } }, { waitForAnimationToEnd: { timeout: 1200 } }]);
console.log("tap success:", r.success, r.error || "");
const tree = await bridge.hierarchy();
console.log(JSON.stringify(collectTexts(tree), null, 2));
