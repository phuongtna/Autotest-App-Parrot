#!/usr/bin/env node
/**
 * E2E — Màn "Báo cáo lớp": cột "Đã hoàn thành" -> bấm chọn tên học sinh -> điều hướng sang màn
 * "Chi tiết bài làm học sinh" (Web GV).
 *
 * ĐÃ XÁC NHẬN THẬT (2026-08-27): mỗi HS trong card "Đã hoàn thành" là 1 link thật
 * `<a href="/teacher/exercise/{roomId}/result/{studentUserId}">{tên}</a>` - bấm vào điều hướng
 * đúng sang trang "Chi tiết bài làm" (breadcrumb "Tổng quan / Bài tập về nhà / Chi tiết bài làm"),
 * hiển thị đủ Điểm số/Thời gian nộp/Thời gian làm bài/Lịch sử nộp bài - khớp mockup gốc.
 *
 * CHỈ ĐỌC - không tạo/sửa/xóa dữ liệu nào. Test tự tìm 1 assignment CÓ SẴN thật đã có HS nộp bài
 * (không tự tạo - assignment tự tạo mới luôn 0 HS làm, không có gì để test drill-down này).
 *
 * Chạy:
 *   cd automation && npm run open-student-result
 *
 * ENV: ASSIGN_HEADLESS=false (mặc định true)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { openStudentResultFlow } from "../../../automation/giao_bai_tap/runtime/openStudentResultFlow.js";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "e2e_open_student_result_report.json");

async function main() {
  const params = { headless: process.env.ASSIGN_HEADLESS !== "false" };

  console.log("Đang chạy E2E - Báo cáo lớp -> Chi tiết bài làm học sinh...");
  const result = await openStudentResultFlow(params);

  for (const s of result.steps) {
    console.log(`  [${s.status}] ${s.name}${s.error ? ` - ${s.error}` : ""}`);
  }
  console.log(`\nKết quả: ${result.status}`);
  if (result.studentName) console.log(`  Học sinh đã bấm: "${result.studentName}"`);
  if (result.resultUrl) console.log(`  URL kết quả: ${result.resultUrl}`);

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  console.log(`Đã ghi kết quả ra ${OUTPUT_FILE}`);

  process.exitCode = result.status === "PASS" ? 0 : 1;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error("\n[e2e-open-student-result] Dừng lại vì lỗi ngoài dự kiến:\n");
    console.error(err);
    process.exitCode = 1;
  });
}
