import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { collectTexts, hasResourceId } from "./bai_tap/navigation/homeworkExamEngine.js";
import { detectQuestionUiType } from "./vui_hoc/vuiHocQuestionMatcher.js";

const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });

function findNodeTextsByResourceId(tree, idPattern) {
  const out = [];
  function walk(n) {
    if (!n) return;
    const a = n.attributes || {};
    if (a["resource-id"] && idPattern.test(a["resource-id"])) out.push(a.text || "");
    (n.children || []).forEach(walk);
  }
  walk(tree);
  return out;
}

const MAX = parseInt(process.argv[2] || "15", 10);
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
    const skip = new Set(["Trạm khởi hành","Tiếp theo","Tiếp tục","Kiểm tra","Thử lại","Giải thích","Chính xác","Chưa chính xác","Hoàn thành"]);
    const isNoise = (t) => skip.has(t) || /^\d{1,2}:\d{2}$/.test(t) || /^\d+%$/.test(t) || /^\//.test(t) || t.length === 0 || t.length >= 60;
    const titleIdx = texts.findIndex((t) => t === "Trạm khởi hành");
    const kiemTraIdx = texts.findIndex((t) => t === "Kiểm tra");
    const between = texts.slice(titleIdx + 1, kiemTraIdx).filter((t) => !isNoise(t));
    // between[0] la cau hoi ("Look and choose"...), phan con lai moi la option that su.
    const candidates = between.slice(1);
    const opt = candidates[candidates.length - 1] || candidates[0];
    console.log("  tapping CHOICE option (blind, candidates=" + JSON.stringify(candidates) + "):", opt);
    const r1 = await bridge.runSteps([{ tapOn: opt }, { waitForAnimationToEnd: { timeout: 800 } }, { tapOn: { id: "exercise_check_button" } }, { waitForAnimationToEnd: { timeout: 1200 } }]);
    if (!r1.success) { console.log(">>> submit failed:", r1.error); break; }
    const tree2 = await bridge.hierarchy();
    const texts2 = collectTexts(tree2);
    const retryBtn = texts2.find(t => t === "Thử lại");
    if (retryBtn) {
      console.log("  got retry, tapping Thử lại then advancing via Kiểm tra again blind");
      await bridge.runSteps([{ tapOn: { id: "exercise_check_button" } }, { waitForAnimationToEnd: { timeout: 1200 } }]);
    }
    continue;
  }
  const next = texts.find(t => /^(Tiếp theo|Tiếp tục|Hoàn thành)$/.test(t));
  if (!next) {
    console.log(">>> STOP: no advance button found, uiType=" + uiType);
    break;
  }
  const r = await bridge.runSteps([{ tapOn: next }, { waitForAnimationToEnd: { timeout: 1200 } }]);
  if (!r.success) { console.log(">>> tap failed:", r.error); break; }
}
