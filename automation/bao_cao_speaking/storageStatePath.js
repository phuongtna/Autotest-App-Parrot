import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// File tạm (KHÔNG commit - xem .gitignore) chứa cookie session GV Speaking-report đăng nhập bởi
// globalSetup.js - dùng chung bởi playwright.speaking-report.config.js (`use.storageState`).
export const STORAGE_STATE_PATH = join(__dirname, "..", "output", "speaking-report-storage-state.json");
