#!/usr/bin/env node
import { parseEnvFile } from "./src/config.js";
import { MaestroMcpBridge } from "./bridge/maestroMcpBridge.js";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT_ENV = parseEnvFile(join(process.cwd(), ".env"));
const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;

async function main() {
  const bridge = new MaestroMcpBridge({ appId: APP_ID });
  await bridge.start();
  try {
    const tree = await bridge.hierarchy();
    writeFileSync("/tmp/claude-1000/-home-mt-Documents-Autotest-app-Parrot/643df4e7-c687-4198-a658-4ed65bb6f881/scratchpad/hierarchy_dump.json", JSON.stringify(tree, null, 1));
    console.log("dumped");
  } finally {
    await bridge.stop();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
