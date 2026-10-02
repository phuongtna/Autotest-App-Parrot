import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { collectTexts, hasResourceId } from "./bai_tap/navigation/homeworkExamEngine.js";
import { detectQuestionUiType } from "./vui_hoc/vuiHocQuestionMatcher.js";

const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const MAX = 12;
for (let i = 0; i < MAX; i++) {
  const tree = await bridge.hierarchy();
  const texts = collectTexts(tree);
  const uiType = detectQuestionUiType(tree);
  const hasCheckBtn = hasResourceId(tree, /^exercise_check_button$/);
  console.log(`[${i}] uiType=${uiType} hasCheckBtn=${hasCheckBtn} texts=${JSON.stringify(texts)}`);
  if (uiType && hasCheckBtn) {
    console.log(">>> STOP: found interactive question");
    break;
  }
  const next = texts.find(t => /^(Tiếp theo|Tiếp tục)$/.test(t));
  if (!next) {
    console.log(">>> STOP: no Tiếp theo/Tiếp tục button found");
    break;
  }
  const r = await bridge.runSteps([{ tapOn: next }, { waitForAnimationToEnd: { timeout: 1200 } }]);
  if (!r.success) { console.log(">>> tap failed:", r.error); break; }
}
