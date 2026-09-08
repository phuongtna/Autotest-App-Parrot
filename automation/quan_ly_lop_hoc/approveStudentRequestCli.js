#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { approveStudentRequestFlow } from "./runtime/approveStudentRequestFlow.js";

/**
 * Entrypoint `npm run approve-student-request` - tự động hoá bước 2/3 của TC_12/TC_19 (duyệt yêu
 * cầu vào lớp phía giáo viên), xem flows/app/roi_khoi_lop/RKL-12_19-rejoin-after-teacher-approval.md.
 *
 * Tham số qua ENV:
 *   APPROVE_CLASS_ID (bắt buộc, vd id trả về từ `npm run add-class`)
 *   APPROVE_STUDENT_NAME (bắt buộc, tên hồ sơ con CẦN duyệt - phải khớp CHÍNH XÁC cột "Học sinh")
 *   APPROVE_HEADLESS=false (mặc định true)
 *   APPROVE_DEBUG_DUMP=true (mặc định false)
 *
 * Chạy:
 *   cd automation
 *   APPROVE_CLASS_ID="db7ae7b7-..." APPROVE_STUDENT_NAME="QA Auto Child 20260908_112008" \
 *     npm run approve-student-request
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");
const OUTPUT_FILE = join(OUTPUT_DIR, "approve_student_request_result.json");

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name}.`);
  }
  return value;
}

async function main() {
  const params = {
    classId: readRequiredEnv("APPROVE_CLASS_ID"),
    studentName: readRequiredEnv("APPROVE_STUDENT_NAME"),
    headless: process.env.APPROVE_HEADLESS !== "false",
    debugDump: process.env.APPROVE_DEBUG_DUMP === "true",
  };

  console.log("Đang duyệt yêu cầu vào lớp (Web GV, Playwright)...");
  const result = await approveStudentRequestFlow(params);

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
  console.error("\n[approve-student-request] Dừng lại vì lỗi ngoài dự kiến:\n");
  console.error(`  ${err.message}`);
  process.exitCode = 1;
});
