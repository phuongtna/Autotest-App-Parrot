#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { captureClassRosterSnapshot } from "./runtime/classRosterSnapshotFlow.js";

/**
 * Entrypoint `npm run capture-class-roster` - chụp 1 snapshot trạng thái lớp phía web GV (TC_14/
 * TC_15, xem runtime/classRosterSnapshotFlow.js). Gọi 2 lần quanh 1 sự kiện rời lớp thật (trước và
 * sau khi chạy Maestro cho học sinh rời lớp) với OUT_FILE khác nhau, rồi so bằng
 * `npm run compare-class-roster`.
 *
 * Tham số qua ENV:
 *   SNAPSHOT_CLASS_ID (bắt buộc)
 *   SNAPSHOT_CLASS_NAME (bắt buộc, khớp CHÍNH XÁC tên lớp hiển thị)
 *   SNAPSHOT_OUT_FILE (optional, mặc định automation/output/class_roster_snapshot.json - LUÔN
 *     đặt tên khác nhau cho lần "before" và lần "after", nếu không lần sau sẽ ghi đè lần trước)
 *   SNAPSHOT_HEADLESS=false (mặc định true)
 *
 * Chạy:
 *   cd automation
 *   SNAPSHOT_CLASS_ID="..." SNAPSHOT_CLASS_NAME="5X-RKLRejoin2" \
 *     SNAPSHOT_OUT_FILE=output/roster_before.json npm run capture-class-roster
 *   # ... chạy Maestro cho học sinh rời lớp thật ở giữa ...
 *   SNAPSHOT_CLASS_ID="..." SNAPSHOT_CLASS_NAME="5X-RKLRejoin2" \
 *     SNAPSHOT_OUT_FILE=output/roster_after.json npm run capture-class-roster
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
  const classId = readRequiredEnv("SNAPSHOT_CLASS_ID");
  const className = readRequiredEnv("SNAPSHOT_CLASS_NAME");
  const headless = process.env.SNAPSHOT_HEADLESS !== "false";
  const outFile = process.env.SNAPSHOT_OUT_FILE
    ? join(__dirname, "..", process.env.SNAPSHOT_OUT_FILE)
    : join(__dirname, "..", "output", "class_roster_snapshot.json");

  console.log(`Đang chụp snapshot lớp "${className}" (${classId})...`);
  const snapshot = await captureClassRosterSnapshot({ classId, className, headless });

  console.log(`  Sĩ số: ${snapshot.siSo}`);
  console.log(`  Roster (${snapshot.rosterRows.length} dòng):`);
  for (const row of snapshot.rosterRows) console.log(`    - ${row.replace(/\n/g, " ")}`);

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(snapshot, null, 2), "utf8");
  console.log(`Đã ghi snapshot ra ${outFile}`);
}

main().catch((err) => {
  console.error("\n[capture-class-roster] Dừng lại vì lỗi ngoài dự kiến:\n");
  console.error(`  ${err.message}`);
  process.exitCode = 1;
});
