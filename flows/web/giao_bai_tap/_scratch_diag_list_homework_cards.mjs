#!/usr/bin/env node
/**
 * DIAGNOSTIC ONLY - không trả lời bài, chỉ điều hướng tới tab "Bài tập", cuộn hết danh sách
 * "Bài tập về nhà" và in ra TOÀN BỘ title+Hạn nộp/Điểm nhìn thấy được, để xác định xem 1 room cụ
 * thể (vừa giao qua Web GV) có thực sự render trong app hay không - dùng khi findAssignment() báo
 * NOT_FOUND 2 lần liên tiếp với cùng SCROLL/SEEN count (nghi KHÔNG phải flake ngẫu nhiên).
 *
 * ENV: ITEM_NAME (tên cần tìm, chỉ để highlight), PROFILE_NAME, MAESTRO_DEVICE.
 */
import { MaestroMcpBridge } from "../../../automation/bridge/maestroMcpBridge.js";
import { parseEnvFile } from "../../../automation/src/config.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const ROOT_ENV = parseEnvFile(join(PROJECT_ROOT, ".env"));
const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const ITEM_NAME = process.env.ITEM_NAME || "";
const PROFILE_NAME = process.env.PROFILE_NAME || "";

function collectAllTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectAllTexts(c, acc);
  return acc;
}

async function main() {
  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  try {
    const nav = await bridge.runSteps([
      { launchApp: { permissions: { all: "allow" } } },
      { extendedWaitUntil: { visible: { text: ".*(Vui học|Bài tập|Báo cáo).*" }, timeout: 30000 } },
      { tapOn: { text: "Bài tập" } },
      { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao|Bạn không có bài tập nào đang chờ).*" }, timeout: 30000 } },
    ]);
    console.log("NAV_SUCCESS:", nav.success, nav.error ?? "");
    let tree = await bridge.hierarchy();
    let allTexts = new Set(collectAllTexts(tree));
    console.log(`\n=== SCREEN 0 (top) ===`);
    console.log([...collectAllTexts(tree)].join(" | "));

    for (let i = 1; i <= 15; i++) {
      await bridge.runSteps([{ swipe: { start: "50%, 75%", end: "50%, 30%", duration: 400 } }, { waitForAnimationToEnd: { timeout: 1500 } }]);
      tree = await bridge.hierarchy();
      const texts = collectAllTexts(tree);
      for (const t of texts) allTexts.add(t);
      console.log(`\n=== SCREEN ${i} (after scroll ${i}) ===`);
      console.log(texts.join(" | "));
    }

    console.log(`\n=== ITEM_NAME match check ===`);
    const matches = [...allTexts].filter((t) => ITEM_NAME && t.includes(ITEM_NAME));
    console.log(`ITEM_NAME="${ITEM_NAME}" found in collected texts: ${matches.length > 0 ? "YES" : "NO"}`, matches);

    console.log(`\n=== PROFILE check ===`);
    console.log(`PROFILE_NAME="${PROFILE_NAME}" active: ${[...allTexts].some((t) => t.includes(PROFILE_NAME))}`);
  } finally {
    await bridge.stop();
    console.log("[MCP] stopped.");
  }
}

main().catch((err) => {
  console.error("ERROR:", err.message, err.stack);
  process.exit(1);
});
