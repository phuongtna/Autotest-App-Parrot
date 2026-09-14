#!/usr/bin/env node
/**
 * Fixture test cho selectBestAttempt.js (Track A - chọn lượt điểm cao nhất/gần nhất khi hòa).
 * Không phụ thuộc device/network - chạy trực tiếp: node automation/bao_cao_speaking/selectBestAttempt.fixtureTest.mjs
 *
 * Case A - 1 attempt duy nhất -> trả về chính nó.
 * Case B - nhiều attempt, score khác nhau -> chọn attempt điểm cao nhất.
 * Case C - hòa điểm cao nhất, timestamp khác nhau -> chọn attempt timestamp mới nhất.
 * Case D - input KHÔNG theo thứ tự thời gian -> vẫn phải ra đúng kết quả (không giả định order).
 * Case E - hòa cả điểm lẫn timestamp -> không throw, giữ candidate đầu tiên theo input order.
 * Case F - input rỗng/không hợp lệ -> throw rõ ràng.
 */
import { selectBestAttempt } from "./selectBestAttempt.js";

let passes = 0;
let failures = 0;
function report(label, ok, detail = "") {
  if (ok) {
    passes++;
    console.log(`  [PASS] ${label}${detail ? ` (${detail})` : ""}`);
  } else {
    failures++;
    console.log(`  [FAIL] ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("=== [A] 1 attempt duy nhất ===");
{
  const attempts = [{ attemptNumber: 1, score: 6.0, timestamp: "2026-09-12T09:00:00" }];
  const result = selectBestAttempt(attempts);
  report("trả về đúng attempt duy nhất", result.attemptNumber === 1, JSON.stringify(result));
}

console.log("=== [B] nhiều attempt, score khác nhau ===");
{
  const attempts = [
    { attemptNumber: 1, score: 6.0, timestamp: "2026-09-12T09:00:00" },
    { attemptNumber: 2, score: 7.0, timestamp: "2026-09-12T10:00:00" },
    { attemptNumber: 3, score: 6.5, timestamp: "2026-09-12T11:00:00" },
  ];
  const result = selectBestAttempt(attempts);
  report("chọn attempt 2 (điểm cao nhất 7.0)", result.attemptNumber === 2, JSON.stringify(result));
}

console.log("=== [C] hòa điểm cao nhất, timestamp khác nhau ===");
{
  const attempts = [
    { attemptNumber: 1, score: 7.0, timestamp: "2026-09-12T10:00:00" },
    { attemptNumber: 2, score: 7.0, timestamp: "2026-09-12T11:00:00" },
  ];
  const result = selectBestAttempt(attempts);
  report(
    "chọn attempt 2 (cùng 7.0, timestamp gần nhất 11:00)",
    result.attemptNumber === 2,
    JSON.stringify(result),
  );
}

console.log("=== [D] input không theo thứ tự chronological ===");
{
  const attempts = [
    { attemptNumber: 3, score: 7.0, timestamp: "2026-09-12T11:00:00" },
    { attemptNumber: 1, score: 6.0, timestamp: "2026-09-12T09:00:00" },
    { attemptNumber: 2, score: 7.0, timestamp: "2026-09-12T10:00:00" },
  ];
  const result = selectBestAttempt(attempts);
  report(
    "không giả định thứ tự input - vẫn chọn đúng attempt 3 (7.0, gần nhất)",
    result.attemptNumber === 3,
    JSON.stringify(result),
  );
}

console.log("=== [E] hòa cả điểm lẫn timestamp ===");
{
  const attempts = [
    { attemptNumber: 1, score: 7.0, timestamp: "2026-09-12T10:00:00" },
    { attemptNumber: 2, score: 7.0, timestamp: "2026-09-12T10:00:00" },
  ];
  let result;
  let threw = false;
  try {
    result = selectBestAttempt(attempts);
  } catch {
    threw = true;
  }
  report("không throw chỉ vì timestamp bằng nhau", !threw, threw ? "đã throw" : "");
  report(
    "deterministic - giữ candidate đầu tiên theo input order (attempt 1)",
    !threw && result?.attemptNumber === 1,
    JSON.stringify(result),
  );
}

console.log("=== [F] input rỗng/không hợp lệ ===");
{
  let threwEmpty = false;
  try {
    selectBestAttempt([]);
  } catch {
    threwEmpty = true;
  }
  report("mảng rỗng -> throw", threwEmpty);

  let threwNotArray = false;
  try {
    selectBestAttempt(null);
  } catch {
    threwNotArray = true;
  }
  report("null -> throw", threwNotArray);

  let threwBadScore = false;
  try {
    selectBestAttempt([{ attemptNumber: 1, timestamp: "2026-09-12T09:00:00" }]);
  } catch {
    threwBadScore = true;
  }
  report("attempt thiếu score -> throw", threwBadScore);
}

console.log("=== [bonus] không mutate input array ===");
{
  const attempts = [
    { attemptNumber: 1, score: 6.0, timestamp: "2026-09-12T09:00:00" },
    { attemptNumber: 2, score: 7.0, timestamp: "2026-09-12T10:00:00" },
  ];
  const snapshot = JSON.stringify(attempts);
  selectBestAttempt(attempts);
  report("input array không bị thay đổi sau khi gọi", JSON.stringify(attempts) === snapshot);
}

console.log(`\n${passes} passed, ${failures} failed.`);
if (failures > 0) process.exitCode = 1;
