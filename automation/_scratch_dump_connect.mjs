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
  if (a.accessibilityText) out.push("[a11y]"+a.accessibilityText);
  (n.children||[]).forEach(c=>allTexts(c,out));
  return out;
}
for (const side of ["left","right"]) {
  for (let i=0;i<4;i++){
    const node = findById(tree, new RegExp(`^exercise_connect_${side}_${i}$`));
    const a = node?.attributes || {};
    console.log(`${side}_${i}: bounds=${a.bounds} texts=${JSON.stringify(allTexts(node))}`);
  }
}
