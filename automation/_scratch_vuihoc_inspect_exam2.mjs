import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const tree = await bridge.hierarchy();
function walk(node, acc) {
  const id = node?.attributes?.["resource-id"];
  const text = node?.attributes?.text;
  const a11y = node?.attributes?.accessibilityText;
  if (id || text || a11y) acc.push(`id="${id||''}" text="${text||''}" a11y="${a11y||''}"`);
  for (const c of node?.children ?? []) walk(c, acc);
  return acc;
}
console.log(walk(tree, []).join("\n"));
