import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { collectTexts, hasResourceId } from "./bai_tap/navigation/homeworkExamEngine.js";
import { detectQuestionUiType } from "./vui_hoc/vuiHocQuestionMatcher.js";

const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
const MAX = 30;

function findTappableOption(texts) {
  const skip = new Set(["Trạm khởi hành","Tiếp theo","Tiếp tục","Kiểm tra","Thử lại","Giải thích","Chính xác","Chưa chính xác","Hoàn thành"]);
  return texts.find(t => !skip.has(t) && !/^\d{1,2}:\d{2}$/.test(t) && !/^\d+%$/.test(t) && !/^\//.test(t) && t.length > 0 && t.length < 60);
}

for (let i = 0; i < MAX; i++) {
  const tree = await bridge.hierarchy();
  const texts = collectTexts(tree);
  const uiType = detectQuestionUiType(tree);
  const hasCheckBtn = hasResourceId(tree, /^exercise_check_button$/);
  console.log(`[${i}] uiType=${uiType} hasCheckBtn=${hasCheckBtn} texts=${JSON.stringify(texts)}`);

  if (uiType === "FILL_WORD_MULTI" || uiType === "FILL_WORD_SINGLE") {
    console.log(">>> STOP: found FILL_WORD question, uiType=" + uiType);
    break;
  }
  if (uiType === "CHOICE" && hasCheckBtn) {
    const opt = findTappableOption(texts);
    console.log("  tapping CHOICE option (blind, don't care right/wrong):", opt);
    const r1 = await bridge.runSteps([{ tapOn: opt }, { waitForAnimationToEnd: { timeout: 800 } }, { tapOn: { id: "exercise_check_button", optional: true } }, { waitForAnimationToEnd: { timeout: 1200 } }]);
    if (!r1.success) { console.log(">>> submit failed:", r1.error); break; }
    continue;
  }
  const next = texts.find(t => /^(Tiếp theo|Tiếp tục|Thử lại|Hoàn thành)$/.test(t));
  if (!next) {
    console.log(">>> STOP: no advance button found, uiType=" + uiType);
    break;
  }
  const r = await bridge.runSteps([{ tapOn: { id: "exercise_check_button", optional: true } }, { waitForAnimationToEnd: { timeout: 1200 } }]);
  if (!r.success) { console.log(">>> tap failed:", r.error); break; }
}
