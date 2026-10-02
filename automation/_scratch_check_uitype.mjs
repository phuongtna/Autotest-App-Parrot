import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { detectQuestionUiType } from "./vui_hoc/vuiHocQuestionMatcher.js";
const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const tree = await bridge.hierarchy();
console.log("UI type:", detectQuestionUiType(tree));

function walk(node, depth=0, out=[]) {
  if (!node) return out;
  const attrs = node.attributes || {};
  if (attrs["resource-id"] || attrs.text || attrs["accessibilityText"]) {
    out.push(`${"  ".repeat(depth)}id=${attrs["resource-id"]||""} text=${JSON.stringify(attrs.text||"")} a11y=${JSON.stringify(attrs["accessibilityText"]||"")}`);
  }
  (node.children||[]).forEach(c => walk(c, depth+1, out));
  return out;
}
console.log(walk(tree).join("\n"));
