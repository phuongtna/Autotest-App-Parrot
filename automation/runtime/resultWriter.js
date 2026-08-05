import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");
const RESULT_FILE = join(OUTPUT_DIR, "run-result.json");

/**
 * @param {Array<Object>} entries - xem shape trong runtime/index.js
 * @returns {string} đường dẫn file đã ghi
 */
export function writeRunResult(entries) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(RESULT_FILE, JSON.stringify(entries, null, 2), "utf8");
  return RESULT_FILE;
}
