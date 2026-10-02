import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const tree = await bridge.hierarchy();
function walk(n, out=[]) {
  if (!n) return out;
  const a = n.attributes || {};
  if (a["resource-id"] && /exercise_fillword_blank/.test(a["resource-id"])) {
    out.push({ id: a["resource-id"], text: a.text, hintText: a.hintText, bounds: a.bounds, enabled: a.enabled, clickable: a.clickable });
  }
  if (a["resource-id"] === "exercise_check_button") {
    out.push({ id: a["resource-id"], text: a.text, bounds: a.bounds, enabled: a.enabled, clickable: a.clickable });
  }
  (n.children||[]).forEach(c => walk(c, out));
  return out;
}
console.log(JSON.stringify(walk(tree), null, 2));
