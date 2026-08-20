#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { deleteClassFlow } from "./runtime/deleteClassFlow.js";

/**
 * Entrypoint `npm run delete-class` - tự động hoá DEL-02
 * (flows/web/teacher/testcases/lop-phu-trach/xoa-lop.md) bằng Playwright. CHỈ dùng cho lớp KHÔNG
 * có học sinh (rule AC3 - xóa lớp có học sinh chưa được hỗ trợ, xem xoa-lop.md case DEL-04).
 *
 * Tham số qua ENV:
 *   DELETE_CLASS_NAME (bắt buộc, vd "7QA-Test" - phải khớp CHÍNH XÁC tên lớp)
 *   DELETE_CLASS_ID (optional, vd id trả về từ `npm run add-class` - truyền vào để vào thẳng
 *   trang chi tiết bằng URL, an toàn hơn khi có thể trùng tên lớp)
 *   DELETE_CLASS_HEADLESS=false (mặc định true)
 *   DELETE_CLASS_DEBUG_DUMP=true (mặc định false)
 *
 * Chạy:
 *   cd automation
 *   DELETE_CLASS_NAME="7QA-Test" DELETE_CLASS_HEADLESS=false npm run delete-class
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");
const OUTPUT_FILE = join(OUTPUT_DIR, "delete_class_result.json");

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name}.`);
  }
  return value;
}

async function main() {
  const params = {
    className: readRequiredEnv("DELETE_CLASS_NAME"),
    classId: process.env.DELETE_CLASS_ID || undefined,
    headless: process.env.DELETE_CLASS_HEADLESS !== "false",
    debugDump: process.env.DELETE_CLASS_DEBUG_DUMP === "true",
  };

  console.log("Đang chạy DEL-02 - Xóa lớp học (Web GV, Playwright)...");
  const result = await deleteClassFlow(params);

  for (const s of result.steps) {
    console.log(`  [${s.status}] ${s.name}${s.error ? ` - ${s.error}` : ""}`);
  }
  console.log(`\nKết quả: ${result.status}`);
  if (result.status !== "PASS" && !result.steps.some((s) => s.status === "FAIL")) {
    console.log(`  ${result.error}`);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  console.log(`Đã ghi kết quả ra ${OUTPUT_FILE}`);

  if (result.status !== "PASS") {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("\n[delete-class] Dừng lại vì lỗi ngoài dự kiến:\n");
  console.error(`  ${err.message}`);
  process.exitCode = 1;
});
