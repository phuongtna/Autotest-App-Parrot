import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { collectTexts } from "./bai_tap/navigation/homeworkExamEngine.js";
const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const r = await bridge.runSteps([
  { tapOn: { id: "exercise_connect_left_0" } },
  { waitForAnimationToEnd: { timeout: 600 } },
  { tapOn: { id: "exercise_connect_right_1" } },
  { waitForAnimationToEnd: { timeout: 1000 } },
]);
console.log("tap success:", r.success, r.error || "");
const tree = await bridge.hierarchy();
function dump(n, out=[]) {
  if (!n) return out;
  const a = n.attributes || {};
  if (a["resource-id"] && /exercise_connect/.test(a["resource-id"])) out.push(a["resource-id"]);
  (n.children||[]).forEach(c=>dump(c,out));
  return out;
}
console.log("ids:", JSON.stringify(dump(tree)));
console.log(JSON.stringify(collectTexts(tree), null, 2));
