#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assignHomeworkFlow } from "./runtime/assignHomeworkFlow.js";

/**
 * Entrypoint `npm run assign-homework` - tự động hoá TC1 (flows/giao_bai_tap/TESTCASES.md)
 * PHÍA WEB GV bằng Playwright (KHÔNG phải Maestro - web không chạy được bằng Maestro). Phần
 * "app HS nhận thông báo" trong TC1 KHÔNG chạy ở đây, cần verify riêng (tay hoặc flow Maestro
 * khác) sau khi lệnh này báo PASS.
 *
 * Tham số qua ENV - không hardcode dữ liệu tài khoản/lớp/bài cụ thể trong code, vì dữ liệu này
 * phụ thuộc tài khoản GV test (xem TESTCASES.md mục "ĐÃ XÁC NHẬN THẬT" để biết giá trị đã dùng
 * thật với tài khoản hiện có trong .env):
 *   ASSIGN_PRIMARY_CLASS, ASSIGN_OTHER_GROUP_CLASS, ASSIGN_SAME_GROUP_CLASS (optional),
 *   ASSIGN_DUE_DATE, ASSIGN_UNIT_NAME, ASSIGN_LESSON_NAME, ASSIGN_HOMEWORK_ITEM_NAME,
 *   ASSIGN_HEADLESS=false (mặc định true - đặt "false" khi cần xem browser thật để chỉnh lại
 *   selector trong navigation/teacherPortalPageObjects.js).
 *
 * Chạy (ví dụ đúng dữ liệu đã xác nhận thật 2026-08-09):
 *   cd automation
 *   ASSIGN_PRIMARY_CLASS="3B" ASSIGN_OTHER_GROUP_CLASS="6D" ASSIGN_DUE_DATE="20/08/2026" \
 *   ASSIGN_UNIT_NAME="Unit 1: Hello" ASSIGN_LESSON_NAME="Lesson 1" \
 *   ASSIGN_HOMEWORK_ITEM_NAME="G3-U1-Lesson 1: Listen and repeat" \
 *   ASSIGN_HEADLESS=false npm run assign-homework
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");
const OUTPUT_FILE = join(OUTPUT_DIR, "assign_homework_result.json");

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name}.`);
  }
  return value;
}

async function main() {
  const params = {
    primaryClass: readRequiredEnv("ASSIGN_PRIMARY_CLASS"),
    otherGroupClass: readRequiredEnv("ASSIGN_OTHER_GROUP_CLASS"),
    sameGroupClass: process.env.ASSIGN_SAME_GROUP_CLASS || undefined,
    dueDate: readRequiredEnv("ASSIGN_DUE_DATE"),
    unitName: readRequiredEnv("ASSIGN_UNIT_NAME"),
    lessonName: readRequiredEnv("ASSIGN_LESSON_NAME"),
    homeworkItemName: readRequiredEnv("ASSIGN_HOMEWORK_ITEM_NAME"),
    headless: process.env.ASSIGN_HEADLESS !== "false",
    debugDump: process.env.ASSIGN_DEBUG_DUMP === "true",
  };

  console.log("Đang chạy TC1 - Giao bài tập (Web GV, Playwright)...");
  const result = await assignHomeworkFlow(params);

  for (const s of result.steps) {
    console.log(`  [${s.status}] ${s.name}${s.error ? ` - ${s.error}` : ""}`);
    if (s.debugInfo) console.log(JSON.stringify(s.debugInfo, null, 2));
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
  console.error("\n[assign-homework] Dừng lại vì lỗi ngoài dự kiến:\n");
  console.error(`  ${err.message}`);
  process.exitCode = 1;
});
