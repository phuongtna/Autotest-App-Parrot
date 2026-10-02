import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const tree = await bridge.hierarchy();
function walk(n, depth=0, out=[]) {
  if (!n) return out;
  const a = n.attributes || {};
  if (a.text === "Review 1" || a.clickable === "true") {
    out.push({ text: a.text, clickable: a.clickable, bounds: a.bounds, resourceId: a["resource-id"], cls: a.class });
  }
  (n.children||[]).forEach(c => walk(c, depth+1, out));
  return out;
}
console.log(JSON.stringify(walk(tree), null, 2));
