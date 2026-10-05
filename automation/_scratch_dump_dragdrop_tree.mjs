import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const tree = await bridge.hierarchy();
function findById(n, idPat) {
  if (!n) return null;
  const a = n.attributes || {};
  if (a["resource-id"] && idPat.test(a["resource-id"])) return n;
  for (const c of (n.children||[])) {
    const f = findById(c, idPat);
    if (f) return f;
  }
  return null;
}
function allTexts(n, out=[]) {
  if (!n) return out;
  const a = n.attributes || {};
  if (a.text) out.push(a.text);
  (n.children||[]).forEach(c=>allTexts(c,out));
  return out;
}
for (let i=0;i<4;i++){
  const node = findById(tree, new RegExp(`^exercise_dragdrop_option_${i}$`));
  console.log(`option_${i}:`, JSON.stringify(allTexts(node)));
}
const zone = findById(tree, /^exercise_dragdrop_zone_0$/);
console.log("zone_0:", JSON.stringify(allTexts(zone)));
