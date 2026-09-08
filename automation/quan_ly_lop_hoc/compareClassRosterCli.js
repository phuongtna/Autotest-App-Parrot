#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Entrypoint `npm run compare-class-roster` - so 2 snapshot (before/after) do
 * `classRosterSnapshotCli.js` ghi ra, kết luận PASS/FAIL cho TC_14 (học sinh KHÔNG còn trong danh
 * sách roster) + TC_15 (sĩ số giảm đúng 1). Thuần JS, không cần Playwright/đăng nhập lại - đọc
 * thẳng 2 file JSON đã chụp sẵn.
 *
 * Tham số qua ENV:
 *   COMPARE_BEFORE_FILE (bắt buộc, đường dẫn tương đối automation/)
 *   COMPARE_AFTER_FILE (bắt buộc)
 *   COMPARE_STUDENT_NAME (bắt buộc, tên học sinh ĐÃ rời lớp giữa 2 lần chụp)
 *
 * Chạy:
 *   cd automation
 *   COMPARE_BEFORE_FILE=output/roster_before.json COMPARE_AFTER_FILE=output/roster_after.json \
 *     COMPARE_STUDENT_NAME="QA Auto Child 20260908_112008" npm run compare-class-roster
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name}.`);
  }
  return value;
}

function readSnapshot(relPath) {
  const absPath = join(__dirname, "..", relPath);
  return JSON.parse(readFileSync(absPath, "utf8"));
}

function main() {
  const beforePath = readRequiredEnv("COMPARE_BEFORE_FILE");
  const afterPath = readRequiredEnv("COMPARE_AFTER_FILE");
  const studentName = readRequiredEnv("COMPARE_STUDENT_NAME");

  const before = readSnapshot(beforePath);
  const after = readSnapshot(afterPath);

  const results = [];

  // TC_14: học sinh phải CÓ MẶT trước và KHÔNG còn trong roster sau.
  const wasInBefore = before.rosterRows.some((row) => row.includes(studentName));
  const isInAfter = after.rosterRows.some((row) => row.includes(studentName));
  if (!wasInBefore) {
    results.push({
      tc: "TC_14",
      status: "SKIP",
      note: `Học sinh "${studentName}" không có trong roster BEFORE (${beforePath}) - kiểm tra lại tên/snapshot trước khi tin kết quả TC_15.`,
    });
  } else if (isInAfter) {
    results.push({
      tc: "TC_14",
      status: "FAIL",
      note: `Học sinh "${studentName}" VẪN còn trong roster AFTER (${afterPath}) - kỳ vọng đã biến mất sau khi rời lớp.`,
    });
  } else {
    results.push({ tc: "TC_14", status: "PASS", note: `Học sinh đã biến mất khỏi roster đúng như kỳ vọng.` });
  }

  // TC_15: sĩ số phải giảm đúng 1.
  const expectedAfter = before.siSo - 1;
  if (after.siSo === expectedAfter) {
    results.push({ tc: "TC_15", status: "PASS", note: `Sĩ số giảm đúng 1 (${before.siSo} -> ${after.siSo}).` });
  } else {
    results.push({
      tc: "TC_15",
      status: "FAIL",
      note: `Sĩ số không giảm đúng 1 (trước=${before.siSo}, sau=${after.siSo}, kỳ vọng=${expectedAfter}).`,
    });
  }

  console.log(`Đối chiếu "${before.className}" (before: ${beforePath} | after: ${afterPath})\n`);
  for (const r of results) {
    console.log(`  [${r.status}] ${r.tc} - ${r.note}`);
  }

  if (results.some((r) => r.status === "FAIL")) {
    process.exitCode = 1;
  }
}

main();
