import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { collectTexts } from "./bai_tap/navigation/homeworkExamEngine.js";
const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const r = await bridge.runSteps([
  { swipe: { start: "540,1695", end: "120,1091", duration: 600 } },
  { waitForAnimationToEnd: { timeout: 1000 } },
]);
console.log("drag success:", r.success, r.error || "");
const tree = await bridge.hierarchy();
function dump(n, out=[]) {
  if (!n) return out;
  const a = n.attributes || {};
  if (a["resource-id"] && /exercise_dragdrop/.test(a["resource-id"])) out.push(a["resource-id"]);
  (n.children||[]).forEach(c=>dump(c,out));
  return out;
}
console.log("ids:", JSON.stringify(dump(tree)));
console.log(JSON.stringify(collectTexts(tree), null, 2));
