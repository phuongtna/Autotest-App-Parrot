import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, "..", "..");

export const EVENT_LOG_PATH = join(ROOT, "test_data", "session_events.jsonl");
export const ACTIVITY_MD_PATH = join(ROOT, "test_data", "activity_log_tranduyanh.md");
export const DEBUG_LOG_PATH = join(ROOT, "test_data", "session_watcher_debug.log");
