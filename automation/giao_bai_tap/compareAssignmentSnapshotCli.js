#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Entrypoint `npm run compare-assignment-snapshot` - so 2 snapshot (before/after) do
 * `classAssignmentSnapshotCli.js` ghi ra, kết luận PASS/FAIL cho TC_16 (kế hoạch test "Rời khỏi
 * lớp" - tổng số HS đã làm + điểm TB được tính lại sau khi 1 học sinh rời lớp).
 *
 * GIỚI HẠN ĐÃ BIẾT: chỉ verify được 2 bất biến CẤU TRÚC - (a) tổng số HS ("y" trong "x/y") giảm
 * đúng 1 nếu học sinh rời lớp có nằm trong "chưa quá hạn"/còn được tính, (b) "ĐIỂM TB" phải ĐỔI
 * KHÁC (không đứng yên) nếu số HS đã làm ("x") giảm - tức học sinh rời lớp đã có trong tập tính
 * điểm TB. KHÔNG tự tính lại được giá trị điểm TB "đúng" kỳ vọng là bao nhiêu (cần biết điểm từng
 * HS còn lại, xem `readStudentResultSummary`/`listCompletedStudents` trong
 * teacherReportPageObjects.js nếu cần verify sâu hơn - chưa làm ở bản này).
 *
 * Tham số qua ENV:
 *   COMPARE_BEFORE_FILE (bắt buộc)
 *   COMPARE_AFTER_FILE (bắt buộc)
 *   COMPARE_STUDENT_HAD_SUBMITTED (optional, "true"/"false", mặc định "true" - học sinh rời lớp
 *     CÓ nằm trong số đã làm bài này không; nếu "false" thì kỳ vọng tổng số HS KHÔNG đổi)
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
  const beforePath = readRequiredEnv("COMPARE_BEFORE_FILE");
  const afterPath = readRequiredEnv("COMPARE_AFTER_FILE");
  const studentHadSubmitted = (process.env.COMPARE_STUDENT_HAD_SUBMITTED ?? "true") === "true";

  const before = readSnapshot(beforePath);
  const after = readSnapshot(afterPath);

  const results = [];

  const expectedTotal = studentHadSubmitted ? before.totalCount - 1 : before.totalCount;
  if (after.totalCount === expectedTotal) {
    results.push({
      tc: "TC_16 (tổng số HS)",
      status: "PASS",
      note: `Tổng số HS đã làm đúng kỳ vọng (${before.totalCount} -> ${after.totalCount}).`,
    });
  } else {
    results.push({
      tc: "TC_16 (tổng số HS)",
      status: "FAIL",
      note: `Tổng số HS không đúng kỳ vọng (trước=${before.totalCount}, sau=${after.totalCount}, kỳ vọng=${expectedTotal}).`,
    });
  }

  if (studentHadSubmitted && after.totalCount === 0) {
    // Không còn HS nào sau khi rời lớp -> "điểm TB" mất ý nghĩa toán học (average của tập rỗng).
    // Bất kỳ giá trị nào hiển thị lúc này (kể cả trùng ngẫu nhiên với giá trị "before", như trường
    // hợp before=0.0 vì HS DUY NHẤT đạt 0 điểm) đều là placeholder cho "không có dữ liệu", KHÔNG
    // phải bằng chứng tính sai/tính đúng - so sánh before/after ở trường hợp này không kết luận
    // được gì, xem ghi chú "GIỚI HẠN ĐÃ BIẾT" đầu file. Cần ≥2 HS ban đầu để verify thật ý nghĩa
    // "tính lại điểm TB" (1 HS rời, còn lại ≥1 HS khác để có 1 giá trị trung bình mới thật sự).
    results.push({
      tc: "TC_16 (điểm TB)",
      status: "SKIP",
      note: `Không còn HS nào sau khi rời (tổng số HS sau=0) - "điểm TB" không còn ý nghĩa toán học, không kết luận được PASS/FAIL từ giá trị hiển thị (${before.averageScoreText} -> ${after.averageScoreText}). Cần setup lại với ≥2 HS ban đầu để verify công thức tính lại thật.`,
    });
  } else if (studentHadSubmitted && before.totalCount !== after.totalCount) {
    if (before.averageScoreText !== after.averageScoreText) {
      results.push({
        tc: "TC_16 (điểm TB)",
        status: "PASS",
        note: `Điểm TB đã đổi khác sau khi bỏ 1 HS (${before.averageScoreText} -> ${after.averageScoreText}) - CHƯA verify giá trị mới có ĐÚNG hay không (xem giới hạn đã biết ở đầu file).`,
      });
    } else {
      results.push({
        tc: "TC_16 (điểm TB)",
        status: "FAIL",
        note: `Điểm TB KHÔNG đổi (${before.averageScoreText}) dù tổng số HS đã giảm - nghi ngờ chưa tính lại đúng.`,
      });
    }
  } else {
    results.push({
      tc: "TC_16 (điểm TB)",
      status: "SKIP",
      note: `Học sinh rời lớp không nằm trong số đã làm bài này (hoặc tổng số HS không đổi) - không có cơ sở kỳ vọng điểm TB đổi.`,
    });
  }

  console.log(`Đối chiếu bài "${before.itemName}" (lớp "${before.className}")\n`);
  for (const r of results) {
    console.log(`  [${r.status}] ${r.tc} - ${r.note}`);
  }

  if (results.some((r) => r.status === "FAIL")) {
    process.exitCode = 1;
  }
}

main();
