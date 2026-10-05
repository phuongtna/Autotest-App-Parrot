import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const tree = await bridge.hierarchy();
function walk(n, out=[]) {
  if (!n) return out;
  const a = n.attributes || {};
  if (a["resource-id"] && /exercise_connect/.test(a["resource-id"])) {
    out.push({ id: a["resource-id"], bounds: a.bounds });
  }
  (n.children||[]).forEach(c=>walk(c,out));
  return out;
}
console.log(JSON.stringify(walk(tree), null, 2));
