import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { collectTexts } from "./bai_tap/navigation/homeworkExamEngine.js";
const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const target = process.argv[2];
const maxScrolls = parseInt(process.argv[3] || "10", 10);
for (let i = 0; i < maxScrolls; i++) {
  const tree = await bridge.hierarchy();
  const texts = collectTexts(tree);
  if (texts.some(t => t === target)) {
    console.log(`FOUND "${target}" after ${i} scrolls`);
    console.log(JSON.stringify(texts, null, 2));
    process.exit(0);
  }
  await bridge.runSteps([{ scroll: { direction: "DOWN", duration: 400 } }, { waitForAnimationToEnd: { timeout: 600 } }]);
}
console.log(`NOT FOUND "${target}" after ${maxScrolls} scrolls`);
const tree = await bridge.hierarchy();
console.log(JSON.stringify(collectTexts(tree), null, 2));
