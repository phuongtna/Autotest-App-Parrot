#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Entrypoint `npm run compare-school-name-sequence` - kết luận PASS/FAIL cho case 9 (kế hoạch
 * test "Rời khỏi lớp" - đối chiếu CMS "Quản lý học sinh"): cột "TÊN TRƯỜNG" phải để trống ("—")
 * khi profile đang chờ duyệt HOẶC không có lớp, và hiện đúng tên trường thật khi đã được duyệt.
 *
 * Đọc 3 (hoặc 4) file snapshot do `readStudentSchoolNameCli.js` ghi ra tại các thời điểm khác
 * nhau (before/pending/approved/after-leave) - xem
 * flows/app/roi_khoi_lop/README.md mục "Case 9" để biết chuỗi thao tác đầy đủ.
 *
 * Tham số qua ENV:
 *   SCHOOL_PENDING_FILE (bắt buộc) - snapshot lúc "Đang chờ duyệt vào lớp"
 *   SCHOOL_APPROVED_FILE (bắt buộc) - snapshot sau khi giáo viên duyệt
 *   SCHOOL_AFTER_LEAVE_FILE (bắt buộc) - snapshot sau khi rời lớp thật
 *   SCHOOL_EXPECTED_NAME (optional) - tên trường kỳ vọng lúc đã duyệt (vd "Trường Tiểu học QA") -
 *     không truyền thì chỉ kiểm tra "không rỗng", không so khớp tên cụ thể.
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
  return JSON.parse(readFileSync(join(__dirname, "..", relPath), "utf8"));
}

function main() {
  const pendingPath = readRequiredEnv("SCHOOL_PENDING_FILE");
  const approvedPath = readRequiredEnv("SCHOOL_APPROVED_FILE");
  const afterLeavePath = readRequiredEnv("SCHOOL_AFTER_LEAVE_FILE");
  const expectedName = process.env.SCHOOL_EXPECTED_NAME || null;

  const pending = readSnapshot(pendingPath);
  const approved = readSnapshot(approvedPath);
  const afterLeave = readSnapshot(afterLeavePath);

  const results = [];

  results.push(
    pending.isEmpty
      ? { case: "Case 9 (đang chờ duyệt)", status: "PASS", note: `Tên trường để trống đúng như kỳ vọng ("${pending.schoolName}").` }
      : { case: "Case 9 (đang chờ duyệt)", status: "FAIL", note: `Tên trường KHÔNG để trống ("${pending.schoolName}") trong lúc đang chờ duyệt.` },
  );

  if (approved.isEmpty) {
    results.push({
      case: "Case 9 (đã duyệt)",
      status: "FAIL",
      note: `Tên trường vẫn để trống ("${approved.schoolName}") dù đã được duyệt vào lớp.`,
    });
  } else if (expectedName && approved.schoolName !== expectedName) {
    results.push({
      case: "Case 9 (đã duyệt)",
      status: "FAIL",
      note: `Tên trường hiện "${approved.schoolName}", kỳ vọng "${expectedName}".`,
    });
  } else {
    results.push({
      case: "Case 9 (đã duyệt)",
      status: "PASS",
      note: `Tên trường hiện đúng: "${approved.schoolName}".`,
    });
  }

  results.push(
    afterLeave.isEmpty
      ? { case: "Case 9 (sau khi rời lớp)", status: "PASS", note: `Tên trường để trống đúng như kỳ vọng ("${afterLeave.schoolName}").` }
      : { case: "Case 9 (sau khi rời lớp)", status: "FAIL", note: `Tên trường KHÔNG để trống ("${afterLeave.schoolName}") sau khi đã rời lớp.` },
  );

  console.log(`Đối chiếu case 9 - CMS "Quản lý học sinh" > cột "TÊN TRƯỜNG" (profile "${pending.profileName}")\n`);
  for (const r of results) {
    console.log(`  [${r.status}] ${r.case} - ${r.note}`);
  }

  if (results.some((r) => r.status === "FAIL")) {
    process.exitCode = 1;
  }
}

main();
