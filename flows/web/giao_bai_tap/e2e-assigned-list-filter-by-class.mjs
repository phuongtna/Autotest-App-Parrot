#!/usr/bin/env node
/**
 * E2E — Dropdown "Tất cả các lớp" trên màn "Danh sách bài tập đã giao" (Web GV).
 *
 * ĐÃ XÁC NHẬN THẬT (2026-08-27): option list của dropdown CHÍNH XÁC là các lớp thật thuộc tài
 * khoản GV đang đăng nhập (không hardcode) - chọn 1 lớp gọi lại API với `class_id=<id thật>` và
 * bảng chỉ còn dòng của ĐÚNG lớp đó.
 *
 * CHỈ ĐỌC - không tạo/sửa/xóa dữ liệu nào.
 *
 * Chạy:
 *   cd automation && npm run assign-list-filter-class
 *
 * ENV: ASSIGN_HEADLESS=false (mặc định true)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { filterAssignedListByClassFlow } from "../../../automation/giao_bai_tap/runtime/filterAssignedListByClassFlow.js";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "e2e_assigned_list_filter_by_class_report.json");

async function main() {
  const params = { headless: process.env.ASSIGN_HEADLESS !== "false" };

  console.log("Đang chạy E2E - Lọc theo lớp học trên Danh sách bài tập đã giao...");
  const result = await filterAssignedListByClassFlow(params);

  for (const s of result.steps) {
    console.log(`  [${s.status}] ${s.name}${s.error ? ` - ${s.error}` : ""}`);
  }
  console.log(`\nKết quả: ${result.status}`);
  if (result.classOptions) {
    console.log(`  Các lớp thật đọc được trong dropdown: ${JSON.stringify(result.classOptions)}`);
  }
  if (result.filteredClass) {
    console.log(`  Đã lọc theo lớp: "${result.filteredClass}"`);
  }

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  console.log(`Đã ghi kết quả ra ${OUTPUT_FILE}`);

  process.exitCode = result.status === "PASS" ? 0 : 1;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error("\n[e2e-assigned-list-filter-by-class] Dừng lại vì lỗi ngoài dự kiến:\n");
    console.error(err);
    process.exitCode = 1;
  });
}
