#!/usr/bin/env node
// Diagnostic-only (READ-ONLY, no answering): tìm hiểu vì sao persistentSwipeLocate() không khớp
// được card "Choose the word that matches each description below." (due 11/11/2026) dù swipe vẫn
// di chuyển list thật (confirmed - cuối cùng rơi vào vùng completed sau 25 lượt). In TOÀN BỘ card
// parse được mỗi lượt để tìm root cause (match predicate sai? CTA text khác? sectionSeen sai?).
import { parseEnvFile } from "./src/config.js";
import { MaestroMcpBridge } from "./bridge/maestroMcpBridge.js";
import { scrollToTop } from "./bai_tap/discovery/findAssignment.js";
import { collectTextNodesWithBoundsInsideScrollableList, parseHomeworkCardsWithDetail } from "./bai_tap/discovery/homeworkUiList.js";
import { join } from "node:path";

const ROOT_ENV = parseEnvFile(join(process.cwd(), ".env"));
const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const TITLE = "Choose the word that matches each description below.";

async function main() {
  const bridge = new MaestroMcpBridge({ appId: APP_ID });
  await bridge.start();
  try {
    await scrollToTop(bridge);
    let sectionSeen = false;
    for (let i = 0; i <= 20; i++) {
      const tree = await bridge.hierarchy();
      const nodes = collectTextNodesWithBoundsInsideScrollableList(tree, []);
      const parsed = parseHomeworkCardsWithDetail(nodes, { sectionSeen });
      sectionSeen = parsed.sectionSeen;
      console.log(`--- iter ${i} sectionSeen=${sectionSeen} cards=${parsed.cards.length} nodes=${nodes.length} ---`);
      for (const c of parsed.cards) {
        const hit = c.title === TITLE;
        console.log(`  ${hit ? ">>> MATCH " : ""}title=${JSON.stringify(c.title)} due=${c.dueDate} cta=${JSON.stringify(c.cta)} score=${c.score}`);
      }
      const found = parsed.cards.find((c) => c.title === TITLE);
      if (found) {
        console.log("FOUND", JSON.stringify(found));
        break;
      }
      await bridge.runSteps([{ swipe: { start: "50%,80%", end: "50%,55%", duration: 400 } }, { waitForAnimationToEnd: { timeout: 600 } }]);
    }
  } finally {
    await bridge.stop();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
