// Log kỹ thuật/debug của CHÍNH watcher (lỗi adb, cảnh báo recovery...) — KHÔNG bao giờ ghi vào
// activity_log_tranduyanh.md (yêu cầu #9).
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DEBUG_LOG_PATH } from "./paths.mjs";
import { nowIsoLocal } from "./nowIso.mjs";

export function debugLog(message) {
  mkdirSync(dirname(DEBUG_LOG_PATH), { recursive: true });
  appendFileSync(DEBUG_LOG_PATH, `[${nowIsoLocal()}] ${message}\n`, "utf8");
}
