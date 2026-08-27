#!/usr/bin/env node
/**
 * REGRESSION TEST — cột "ĐIỂM TB" trên "Danh sách bài tập đã giao" (Web GV) khi học sinh retake.
 *
 * ĐÃ XÁC NHẬN THẬT (2026-08-27, đối chiếu 11/11 assignment thật có retake, khớp CHÍNH XÁC): công
 * thức thực tế đang dùng là MAX(điểm các lần làm)/SỐ LẦN LÀM, thay vì chỉ MAX(điểm các lần làm)
 * như acceptance criteria gốc mô tả ("dùng điểm lần làm cao nhất khi retake"). HS retake càng
 * nhiều thì điểm hiển thị càng bị kéo thấp giả tạo - xem docblock
 * automation/giao_bai_tap/runtime/verifyAverageScoreFlow.js để biết chi tiết + ví dụ thật.
 *
 * TEST NÀY DỰ KIẾN SẼ FAIL cho tới khi backend sửa bug - giữ lại làm regression test (assert
 * đúng theo spec, không hạ chuẩn để PASS theo hành vi sai hiện tại).
 *
 * CHỈ ĐỌC - không tạo/sửa/xóa dữ liệu nào.
 *
 * Chạy:
 *   cd automation && npm run verify-average-score
 *
 * ENV: ASSIGN_HEADLESS=false (mặc định true)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyAverageScoreFlow } from "../../../automation/giao_bai_tap/runtime/verifyAverageScoreFlow.js";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "e2e_verify_average_score_report.json");

async function main() {
  const params = { headless: process.env.ASSIGN_HEADLESS !== "false" };

  console.log("Đang chạy REGRESSION TEST - Điểm TB khi học sinh retake...");
  const result = await verifyAverageScoreFlow(params);

  for (const s of result.steps) {
    console.log(`  [${s.status}] ${s.name}${s.error ? ` - ${s.error}` : ""}`);
  }
  console.log(`\nKết quả: ${result.status}`);
  if (result.candidate) {
    console.log(`  Assignment: "${result.candidate.itemName}" (lớp ${result.candidate.className}, hạn nộp ${result.candidate.dueDateLine})`);
    console.log(`  Điểm các lần làm: ${JSON.stringify(result.candidate.attemptScores)} -> đúng ra phải là ${result.candidate.expectedCorrectAverage}`);
    console.log(`  ĐIỂM TB thực tế trên danh sách: ${result.actualListValue}`);
  }

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  console.log(`Đã ghi kết quả ra ${OUTPUT_FILE}`);

  process.exitCode = result.status === "PASS" ? 0 : 1;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error("\n[e2e-verify-average-score] Dừng lại vì lỗi ngoài dự kiến:\n");
    console.error(err);
    process.exitCode = 1;
  });
}
