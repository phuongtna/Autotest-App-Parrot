#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { addClassFlow } from "./runtime/addClassFlow.js";

/**
 * Entrypoint `npm run add-class` - tự động hoá TC-ADD-FULL / ADD-05
 * (flows/web/teacher/testcases/lop-phu-trach/them-moi.md) bằng Playwright (KHÔNG phải Maestro -
 * web không chạy được bằng Maestro).
 *
 * Tham số qua ENV - không hardcode tên lớp/khối cụ thể trong code:
 *   ADD_CLASS_KHOI (bắt buộc, vd "Khối 7")
 *   ADD_CLASS_TEN_LOP (bắt buộc, vd "7QA-Test")
 *   ADD_CLASS_NAM_HOC (optional, vd "Năm học 2025-2026" - không truyền thì giữ mặc định của popup)
 *   ADD_CLASS_HEADLESS=false (mặc định true - đặt "false" để xem browser thật khi cần chỉnh lại
 *   selector trong navigation/teacherClassPageObjects.js)
 *   ADD_CLASS_DEBUG_DUMP=true (mặc định false - chụp screenshot khi 1 step FAIL)
 *
 * Chạy:
 *   cd automation
 *   ADD_CLASS_KHOI="Khối 7" ADD_CLASS_TEN_LOP="7QA-Test" ADD_CLASS_HEADLESS=false npm run add-class
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");
const OUTPUT_FILE = join(OUTPUT_DIR, "add_class_result.json");

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name}.`);
  }
  return value;
}

async function main() {
  const params = {
    khoi: readRequiredEnv("ADD_CLASS_KHOI"),
    tenLop: readRequiredEnv("ADD_CLASS_TEN_LOP"),
    namHoc: process.env.ADD_CLASS_NAM_HOC || undefined,
    headless: process.env.ADD_CLASS_HEADLESS !== "false",
    debugDump: process.env.ADD_CLASS_DEBUG_DUMP === "true",
  };

  console.log("Đang chạy TC-ADD-FULL - Thêm mới lớp học (Web GV, Playwright)...");
  const result = await addClassFlow(params);

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
  console.error("\n[add-class] Dừng lại vì lỗi ngoài dự kiến:\n");
  console.error(`  ${err.message}`);
  process.exitCode = 1;
});
