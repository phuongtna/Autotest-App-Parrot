import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });

// Clear blank_0 (currently holds leftover "zzzz"), then type fresh single-char values into each blank separately.
const r1 = await bridge.runSteps([
  { tapOn: { id: "exercise_fillword_blank_0" } },
  { eraseText: 20 },
  { inputText: "z" },
  "hideKeyboard",
  { waitForAnimationToEnd: { timeout: 600 } },
]);
console.log("step1 success:", r1.success, r1.error || "");

function dumpBlanks(tree) {
  const out = [];
  function walk(n) {
    if (!n) return;
    const a = n.attributes || {};
    if (a["resource-id"] && /exercise_fillword_blank|exercise_check_button/.test(a["resource-id"])) {
      out.push({ id: a["resource-id"], text: a.text, enabled: a.enabled });
    }
    (n.children||[]).forEach(walk);
  }
  walk(tree);
  return out;
}
const tree1 = await bridge.hierarchy();
console.log("after blank_0:", JSON.stringify(dumpBlanks(tree1)));

const r2 = await bridge.runSteps([
  { tapOn: { id: "exercise_fillword_blank_1" } },
  { eraseText: 20 },
  { inputText: "z" },
  "hideKeyboard",
  { waitForAnimationToEnd: { timeout: 600 } },
]);
console.log("step2 success:", r2.success, r2.error || "");
const tree2 = await bridge.hierarchy();
console.log("after blank_1:", JSON.stringify(dumpBlanks(tree2)));
