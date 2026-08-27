#!/usr/bin/env node
/**
 * E2E — Màn "Danh sách bài tập đã giao" (Web GV): Xem chi tiết -> Sửa hạn nộp -> Lưu -> Xóa.
 *
 * Flow theo đúng mô tả của user (không phải TC1 - TC1 chỉ dừng ở bước "Giao bài tập thành
 * công"):
 *   1. Đăng nhập GV.
 *   2. Menu "Giao bài tập" -> danh sách bài tập đã giao.
 *   3. "Xem chi tiết" (= "Xem báo cáo" trên UI thật) -> xem tiến độ/kết quả làm bài.
 *   4. "Sửa" (= bấm vào tên bài, KHÔNG có nút "Sửa" riêng - xem
 *      automation/giao_bai_tap/navigation/teacherPortalPageObjects.js#editPage) -> đổi Hạn nộp ->
 *      Lưu -> xác nhận danh sách cập nhật hạn nộp mới.
 *   5. "Xóa" -> xác nhận -> xác nhận dòng biến mất khỏi danh sách.
 *
 * AN TOÀN: tự TẠO 1 assignment mới rồi CHỈ thao tác trên đúng dòng đó (không đụng dữ liệu HS đã
 * làm bài thật có sẵn) - xem docblock automation/giao_bai_tap/runtime/assignedListLifecycleFlow.js.
 *
 * TÁI SỬ DỤNG (không viết lại):
 *   - automation/giao_bai_tap/runtime/assignHomeworkFlow.js (TC1, đã verify thật) để tạo dữ liệu.
 *   - automation/giao_bai_tap/navigation/teacherAssignedListPageObjects.js (MỚI) cho các thao tác
 *     Xem báo cáo/Sửa/Xóa trên danh sách.
 *
 * Chạy:
 *   cd automation && npm run assign-list-lifecycle
 *   (hoặc: node ../flows/web/giao_bai_tap/e2e-assigned-list-lifecycle.mjs từ thư mục automation/)
 *
 * ENV (tất cả optional, có default an toàn đã xác nhận dùng được với tài khoản GV "Phương"):
 *   ASSIGN_LIST_PRIMARY_CLASS (default "3B")
 *   ASSIGN_LIST_DUE_DATE / ASSIGN_LIST_NEW_DUE_DATE (default hôm nay + 3 / + 6 ngày,
 *     format "DD/MM/YYYY" - CỐ Ý gần (trong vòng "2 tuần gần nhất", filter mặc định của danh
 *     sách - ĐÃ XÁC NHẬN THẬT 2026-08-27: hạn nộp xa hơn ~1 tuần có thể bị lọc khỏi mặc định,
 *     xem automation/giao_bai_tap/navigation/teacherAssignedListPageObjects.js#locateAssignedRowAcrossPages)
 *   ASSIGN_HEADLESS=false (mặc định true)
 *   ASSIGN_DEBUG_DUMP=true (mặc định false - chụp screenshot khi 1 bước FAIL)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assignedListLifecycleFlow } from "../../../automation/giao_bai_tap/runtime/assignedListLifecycleFlow.js";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "e2e_assigned_list_lifecycle_report.json");

function fmtDdMmYyyy(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return fmtDdMmYyyy(d);
}

async function main() {
  const params = {
    primaryClass: process.env.ASSIGN_LIST_PRIMARY_CLASS || "3B",
    dueDate: process.env.ASSIGN_LIST_DUE_DATE || addDays(3),
    newDueDate: process.env.ASSIGN_LIST_NEW_DUE_DATE || addDays(6),
    headless: process.env.ASSIGN_HEADLESS !== "false",
    debugDump: process.env.ASSIGN_DEBUG_DUMP === "true",
  };

  console.log(
    `Đang chạy E2E - Danh sách bài tập đã giao (lớp=${params.primaryClass}, hạn nộp=${params.dueDate} -> ${params.newDueDate})...`,
  );
  const result = await assignedListLifecycleFlow(params);

  for (const s of result.steps) {
    console.log(`  [${s.status}] ${s.name}${s.error ? ` - ${s.error}` : ""}`);
  }
  console.log(`\nKết quả: ${result.status}`);
  if (result.status !== "PASS" && !result.steps.some((s) => s.status === "FAIL")) {
    console.log(`  ${result.error}`);
  }
  if (result.selection) {
    console.log(`  Assignment đã dùng: ${JSON.stringify(result.selection)}`);
  }

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  console.log(`Đã ghi kết quả ra ${OUTPUT_FILE}`);

  process.exitCode = result.status === "PASS" ? 0 : 1;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error("\n[e2e-assigned-list-lifecycle] Dừng lại vì lỗi ngoài dự kiến:\n");
    console.error(err);
    process.exitCode = 1;
  });
}
