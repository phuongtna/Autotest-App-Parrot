#!/usr/bin/env node
/**
 * Round3 (2026-11-23): làm lại already finished for real (screenshot confirmed ĐIỂM SỐ=9,
 * CHÍNH XÁC=9/10, matching target range [8,9]) - only the final CTA tap remains. Raw adb tap by
 * estimated screenshot coordinates missed (screen is 1080x2340, preview-vs-real scaling
 * unreliable per [[feedback_screenshot_tap_coordinate_scaling]]). Use the same Maestro bridge
 * tapOn-by-text the main script itself uses instead of guessing pixel coords.
 */
import { parseEnvFile } from "./src/config.js";
import { MaestroMcpBridge } from "./bridge/maestroMcpBridge.js";

const ROOT_ENV = parseEnvFile(new URL("../.env", import.meta.url).pathname);
const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;

async function main() {
  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: "" });
  await bridge.start();
  try {
    const tap = await bridge.runSteps([{ tapOn: { text: ".*(Tiếp theo).*" } }]);
    if (!tap.success) throw new Error(`Tap "Tiếp theo" thất bại: ${tap.error}`);
    const land = await bridge.wait({ id: "exercise_close_button" }, { timeout: 30000 });
    console.log(JSON.stringify({ tapSuccess: tap.success, landed: land.success, landError: land.error ?? null }, null, 2));
  } finally {
    await bridge.stop();
  }
}

main().catch((err) => { console.error(err); process.exit(2); });
