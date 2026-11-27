#!/usr/bin/env node
// Investigate-only (no answering, no tapping besides scroll): round7 was running in the background
// when the Claude Code session got interrupted/restarted; its log + scratchpad were lost (cleared by
// reboot). Notification bell shows "Cô Phương nhắc Ngoc kiểm tra bài tập mới "Read the paragraph and
// decide whether each statement is True (T) or False (F)." Hạn nộp: 02/12/2026." (6 phút trước) -
// this is almost certainly round7's freshly-assigned item, with NO completion notification after it,
// meaning round7 likely died mid-attempt-1. Just locate the card and report its current cta/progress
// - make NO changes yet.
import { parseEnvFile } from "./src/config.js";
import { MaestroMcpBridge } from "./bridge/maestroMcpBridge.js";
import { findAssignment } from "./bai_tap/discovery/findAssignment.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_ENV = parseEnvFile(join(SELF_DIR, "..", ".env"));
const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;

const TITLE = "Read the paragraph and decide whether each statement is True (T) or False (F).";
const DUE_DATE_DM = "02/12";

async function main() {
  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: "" });
  await bridge.start();
  try {
    const located = await findAssignment(bridge, { title: TITLE, dueDateDM: DUE_DATE_DM }, { maxScrolls: 40 });
    console.log(JSON.stringify(located, null, 2));
  } finally {
    await bridge.stop();
  }
}
main().catch((e) => { console.error("ERROR", e.message, e.stack); process.exit(2); });
