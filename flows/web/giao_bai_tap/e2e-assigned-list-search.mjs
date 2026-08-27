#!/usr/bin/env node
/**
 * E2E — Ô "Tìm theo tên bài tập" trên màn "Danh sách bài tập đã giao" (Web GV).
 *
 * ĐÃ XÁC NHẬN THẬT (2026-08-27): ô này PHẢI bấm Enter mới submit tìm kiếm (không phải live-search
 * theo ký tự - gõ xong không tự lọc) - lần điều tra đầu tiên (xem TC2 trong TESTCASES.md) chỉ
 * `fill()` rồi chờ nên kết luận NHẦM là ô search không hoạt động. `fill()` + Enter gọi đúng 1
 * request `GET .../room.json?...&search=<tên>` và lọc đúng danh sách.
 *
 * CHỈ ĐỌC - không tạo/sửa/xóa dữ liệu nào (lấy tên 1 dòng CÓ SẴN thật trên trang 1, search lại
 * đúng tên đó, xác nhận kết quả chỉ còn dòng khớp tên).
 *
 * Chạy:
 *   cd automation && npm run assign-list-search
 *
 * ENV: ASSIGN_HEADLESS=false (mặc định true)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { searchAssignedListFlow } from "../../../automation/giao_bai_tap/runtime/searchAssignedListFlow.js";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "e2e_assigned_list_search_report.json");

async function main() {
  const params = { headless: process.env.ASSIGN_HEADLESS !== "false" };

  console.log("Đang chạy E2E - Tìm kiếm trên Danh sách bài tập đã giao...");
  const result = await searchAssignedListFlow(params);

  for (const s of result.steps) {
    console.log(`  [${s.status}] ${s.name}${s.error ? ` - ${s.error}` : ""}`);
  }
  console.log(`\nKết quả: ${result.status}`);
  if (result.searchTerm) {
    console.log(`  Đã search: "${result.searchTerm}"`);
  }

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  console.log(`Đã ghi kết quả ra ${OUTPUT_FILE}`);

  process.exitCode = result.status === "PASS" ? 0 : 1;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error("\n[e2e-assigned-list-search] Dừng lại vì lỗi ngoài dự kiến:\n");
    console.error(err);
    process.exitCode = 1;
  });
}
