#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { captureClassAssignmentSnapshot } from "./runtime/classAssignmentSnapshotFlow.js";

/**
 * Entrypoint `npm run capture-assignment-snapshot` - chụp 1 snapshot dòng bài tập trên "Danh sách
 * bài tập đã giao" (TC_16, xem runtime/classAssignmentSnapshotFlow.js - CHƯA chạy thật, cần 1 lớp
 * có bài tập active + có HS đã làm). Gọi 2 lần quanh 1 sự kiện rời lớp thật với OUT_FILE khác nhau,
 * rồi so bằng `npm run compare-assignment-snapshot`.
 *
 * Tham số qua ENV:
 *   ASSIGN_CLASS_NAME (bắt buộc)
 *   ASSIGN_ITEM_NAME (bắt buộc)
 *   ASSIGN_DUE_DATE_LINE (bắt buộc)
 *   ASSIGN_OUT_FILE (optional, mặc định automation/output/assignment_snapshot.json - LUÔN đặt tên
 *     khác nhau cho "before"/"after")
 *   ASSIGN_HEADLESS=false (mặc định true)
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name}.`);
  }
  return value;
}

async function main() {
  const className = readRequiredEnv("ASSIGN_CLASS_NAME");
  const itemName = readRequiredEnv("ASSIGN_ITEM_NAME");
  const dueDateLine = readRequiredEnv("ASSIGN_DUE_DATE_LINE");
  const headless = process.env.ASSIGN_HEADLESS !== "false";
  const outFile = process.env.ASSIGN_OUT_FILE
    ? join(__dirname, "..", process.env.ASSIGN_OUT_FILE)
    : join(__dirname, "..", "output", "assignment_snapshot.json");

  console.log(`Đang chụp snapshot bài "${itemName}" (lớp "${className}", hạn "${dueDateLine}")...`);
  const snapshot = await captureClassAssignmentSnapshot({ className, itemName, dueDateLine, headless });

  console.log(`  Đã làm: ${snapshot.completedCount}/${snapshot.totalCount}`);
  console.log(`  Điểm TB: ${snapshot.averageScoreText}`);

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(snapshot, null, 2), "utf8");
  console.log(`Đã ghi snapshot ra ${outFile}`);
}

main().catch((err) => {
  console.error("\n[capture-assignment-snapshot] Dừng lại vì lỗi ngoài dự kiến:\n");
  console.error(`  ${err.message}`);
  process.exitCode = 1;
});
