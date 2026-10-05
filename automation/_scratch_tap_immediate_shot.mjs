import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const id = process.argv[2];
const r = await bridge.runSteps([{ tapOn: { id } }]);
console.log("tap success:", r.success, r.error || "");
