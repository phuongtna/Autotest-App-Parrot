import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { collectTexts } from "./bai_tap/navigation/homeworkExamEngine.js";

const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });

async function step(label, steps) {
  console.log(`--- ${label} ---`);
  const result = await bridge.runSteps(steps);
  console.log("result:", JSON.stringify(result).slice(0, 300));
  const tree = await bridge.hierarchy();
  const texts = collectTexts(tree);
  console.log("texts:", JSON.stringify(texts.slice(0, 30)));
  return texts;
}

// Blind-advance through whatever remains of this incidental exercise (same idiom as
// flows/app/helpers/open-vuihoc-connect.yaml's scan loop) - NOT a controlled scenario, just
// clearing the resume pointer so navigateTo() can reach the intended target cleanly next.
for (let i = 0; i < 8; i++) {
  const texts = await step(`ADVANCE ${i}`, [
    { tapOn: { id: "exercise_answer_0", optional: true } },
    { tapOn: { id: "exercise_check_button", optional: true } },
    { waitForAnimationToEnd: { timeout: 1000 } },
    { tapOn: { id: "exercise_check_button", optional: true } },
    { waitForAnimationToEnd: { timeout: 1000 } },
    { tapOn: { id: "exercise_explain_button", optional: true } },
    { waitForAnimationToEnd: { timeout: 1000 } },
    { tapOn: { text: "Tiếp theo|Tiếp tục|Hoàn thành", optional: true } },
    { waitForAnimationToEnd: { timeout: 1000 } },
  ]);
  if (texts.some((t) => /Điểm số|Kết quả|Chính xác \d+/.test(t))) {
    console.log("Reached result-ish screen, stopping.");
    break;
  }
}
