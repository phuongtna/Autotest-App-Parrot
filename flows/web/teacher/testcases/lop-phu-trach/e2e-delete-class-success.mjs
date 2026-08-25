#!/usr/bin/env node
/**
 * E2E — Xóa lớp học thành công (DEL-02, Web GV)
 *
 * Testcase: xoa-lop.md (case DEL-02, happy path) trong cùng thư mục này.
 *
 * Đảm bảo "chọn đúng lớp đã tạo trước đó": KHÔNG xóa 1 lớp có sẵn nào trong danh sách theo suy
 * đoán tên - tự tạo 1 lớp test mới (addClassFlow), lấy `id` thật trả về từ POST /api/classes, rồi
 * truyền THẲNG `id` đó vào deleteClassFlow qua `classId` để vào thẳng `/teacher/class/{id}` bằng
 * URL (an toàn tuyệt đối, không phụ thuộc trùng tên với lớp khác - xem case ADD-11 chưa rõ rule).
 *
 * TÁI SỬ DỤNG (không viết lại):
 *   - automation/quan_ly_lop_hoc/runtime/addClassFlow.js - tạo lớp test (Playwright, đã verify
 *     thật 2026-08-17/2026-08-20).
 *   - automation/quan_ly_lop_hoc/runtime/deleteClassFlow.js - xóa đúng lớp bằng classId (Playwright,
 *     đã verify thật 2026-08-20).
 *   - automation/quan_ly_lop_hoc/runtime/createThenDeleteClassFlow.js - nối 2 flow trên, tự lấy id
 *     lớp vừa tạo truyền qua bước xóa.
 *
 * Chạy:
 *   node flows/web/teacher/testcases/lop-phu-trach/e2e-delete-class-success.mjs
 *
 * Tham số qua ENV:
 *   DELETE_CLASS_KHOI (optional, mặc định "Khối 7")
 *   DELETE_CLASS_TEN_LOP (optional, mặc định tự sinh tên duy nhất theo timestamp)
 *   DELETE_CLASS_NAM_HOC (optional, vd "Năm học 2025-2026")
 *   DELETE_CLASS_HEADLESS=false (mặc định true)
 *   DELETE_CLASS_DEBUG_DUMP=true (mặc định false)
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createThenDeleteClassFlow } from "../../../../../automation/quan_ly_lop_hoc/runtime/createThenDeleteClassFlow.js";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "e2e_delete_class_success_report.json");

async function main() {
  const params = {
    khoi: process.env.DELETE_CLASS_KHOI || "Khối 7",
    tenLop: process.env.DELETE_CLASS_TEN_LOP || `7QA-DeleteTest-${Date.now()}`,
    namHoc: process.env.DELETE_CLASS_NAM_HOC || undefined,
    headless: process.env.DELETE_CLASS_HEADLESS !== "false",
    debugDump: process.env.DELETE_CLASS_DEBUG_DUMP === "true",
  };

  console.log(
    `Đang chạy DEL-02 - Xóa lớp học thành công (tạo lớp "${params.tenLop}" rồi xóa đúng lớp đó)...`,
  );
  const result = await createThenDeleteClassFlow(params);

  for (const s of result.steps) {
    console.log(`  [${s.status}] ${s.name}${s.error ? ` - ${s.error}` : ""}`);
  }
  console.log(`\nKết quả: ${result.status}`);
  if (result.status !== "PASS" && !result.steps.some((s) => s.status === "FAIL")) {
    console.log(`  ${result.error}`);
  }

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  console.log(`Đã ghi kết quả ra ${OUTPUT_FILE}`);

  process.exitCode = result.status === "PASS" ? 0 : 1;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error("\n[e2e-delete-class-success] Dừng lại vì lỗi ngoài dự kiến:\n");
    console.error(err);
    process.exitCode = 1;
  });
}
