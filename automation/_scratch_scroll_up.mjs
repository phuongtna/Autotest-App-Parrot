import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const r = await bridge.runSteps([{ swipe: { start: "50%,30%", end: "50%,80%", duration: 400 } }, { waitForAnimationToEnd: { timeout: 600 } }]);
console.log("scroll up success:", r.success, r.error || "");
