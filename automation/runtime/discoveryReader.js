import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DISCOVERY_FILE = join(__dirname, "..", "output", "discovery.json");

/**
 * Runtime CHỈ đọc file JSON kết quả CUỐI CÙNG mà Discovery đã ghi ra
 * (automation/output/discovery.json) - KHÔNG import bất kỳ module nào trong
 * automation/discovery/, để Discovery giữ được tính độc lập hoàn toàn (Runtime không biết gì về
 * CMS/Playwright/cách Discovery hoạt động, chỉ biết đọc 1 file JSON theo contract QuestionModel
 * - xem automation/model/questionModel.js).
 */
export function loadDiscoveryOutput() {
  if (!existsSync(DISCOVERY_FILE)) {
    throw new Error(
      `Không tìm thấy ${DISCOVERY_FILE}. Chạy "npm run discover" trước để tạo file này.`,
    );
  }
  return JSON.parse(readFileSync(DISCOVERY_FILE, "utf8"));
}
