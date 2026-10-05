import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const start = process.argv[2];
const end = process.argv[3];
const r = await bridge.runSteps([
  { swipe: { start, end, duration: 700 } },
  { waitForAnimationToEnd: { timeout: 1000 } },
]);
console.log("drag success:", r.success, r.error || "");
