import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { collectTexts } from "./bai_tap/navigation/homeworkExamEngine.js";
import { detectQuestionUiType } from "./vui_hoc/vuiHocQuestionMatcher.js";

// Blind-advance through whatever is currently showing - NOT a controlled scenario, just moving
// past content we don't need to test, to reach a type we still need evidence for. Stops as soon
// as it sees a NON-CHOICE uiType (so we can switch to controlled testing) or a Result screen, or
// after maxIters as a safety bound.
const maxIters = Number(process.argv[2] || 25);
const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });

for (let i = 0; i < maxIters; i++) {
  const tree = await bridge.hierarchy();
  const texts = collectTexts(tree);
  const uiType = detectQuestionUiType(tree);
  const isResult = texts.some((t) => /ĐIỂM SỐ|TỐC ĐỘ/.test(t));
  console.log(`[${i}] uiType=${uiType} isResult=${isResult} sample=${JSON.stringify(texts.slice(0, 12))}`);
  if (isResult) { console.log("REACHED RESULT SCREEN - stopping."); break; }
  if (uiType && uiType !== "CHOICE") { console.log(`REACHED NON-CHOICE TYPE (${uiType}) - stopping.`); break; }
  if (!uiType) { console.log("UNKNOWN SCREEN - stopping for manual inspection."); break; }

  // CHOICE: tap first answer option blind (don't care about correctness), check, retry-check once,
  // explain-dismiss, advance via "Tiếp theo" text (confirmed real advance control on this exercise
  // family) - all optional so whichever applies on this exact screen fires.
  const r = await bridge.runSteps([
    { tapOn: { id: "exercise_answer_0", optional: true } },
    { tapOn: { id: "exercise_check_button", optional: true } },
    { waitForAnimationToEnd: { timeout: 1000 } },
    { tapOn: { text: "Thử lại", optional: true } },
    { waitForAnimationToEnd: { timeout: 500 } },
    { tapOn: { id: "exercise_answer_1", optional: true } },
    { tapOn: { id: "exercise_check_button", optional: true } },
    { waitForAnimationToEnd: { timeout: 1000 } },
    { tapOn: { text: "Tiếp theo", optional: true } },
    { waitForAnimationToEnd: { timeout: 1200 } },
    { tapOn: { id: "exercise_check_button", optional: true } },
    { waitForAnimationToEnd: { timeout: 1000 } },
  ]);
  if (!r.success) { console.log("STEP FAILED:", r.error); break; }
}
