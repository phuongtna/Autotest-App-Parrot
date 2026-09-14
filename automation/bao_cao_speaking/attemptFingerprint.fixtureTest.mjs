#!/usr/bin/env node
/**
 * Fixture test cho attemptFingerprint.js. Không phụ thuộc device/network - chạy trực tiếp:
 * node automation/bao_cao_speaking/attemptFingerprint.fixtureTest.mjs
 *
 * Case A - buildAttemptFingerprint: sort đúng theo questionNumber, normalize percent.
 * Case B - buildAttemptFingerprint: throw khi rỗng/thiếu field/trùng questionNumber.
 * Case C - compareFingerprints: khớp hoàn toàn -> match=true.
 * Case D - compareFingerprints: lệch đúng/sai 1 câu -> match=false, mismatches đúng câu đó.
 * Case E - compareFingerprints: dùng đúng data thật đã verify sống (Lần 5 vs Lần 1, room Vocab
 *   11A2, 2026-09-14) - Lần 5 (expected) phải KHÔNG khớp Lần 1 (actual), lệch đúng ở Q4/Q5.
 * Case F - comparePercents: lệch percent nhưng correctness vẫn khớp.
 */
import {
  buildAttemptFingerprint,
  compareFingerprints,
  comparePercents,
  describeFingerprint,
} from "./attemptFingerprint.js";

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

console.log("=== [A] buildAttemptFingerprint - sort + normalize ===");
{
  const fp = buildAttemptFingerprint([
    { questionNumber: 3, correct: true, percent: 98 },
    { questionNumber: 1, correct: false, percent: 40 },
    { questionNumber: 2, correct: true },
  ]);
  report(
    "sort tăng dần theo questionNumber",
    fp.map((q) => q.questionNumber).join(",") === "1,2,3",
    JSON.stringify(fp),
  );
  report("percent thiếu -> null (không throw)", fp[1].percent === null, JSON.stringify(fp[1]));
  report("describeFingerprint format đúng", describeFingerprint(fp) === "Q1:F|Q2:T|Q3:T", describeFingerprint(fp));
}

console.log("=== [B] buildAttemptFingerprint - input không hợp lệ ===");
{
  let threwEmpty = false;
  try {
    buildAttemptFingerprint([]);
  } catch {
    threwEmpty = true;
  }
  report("mảng rỗng -> throw", threwEmpty);

  let threwMissingCorrect = false;
  try {
    buildAttemptFingerprint([{ questionNumber: 1 }]);
  } catch {
    threwMissingCorrect = true;
  }
  report("thiếu correct -> throw", threwMissingCorrect);

  let threwDuplicate = false;
  try {
    buildAttemptFingerprint([
      { questionNumber: 1, correct: true },
      { questionNumber: 1, correct: false },
    ]);
  } catch {
    threwDuplicate = true;
  }
  report("questionNumber trùng lặp -> throw", threwDuplicate);
}

console.log("=== [C] compareFingerprints - khớp hoàn toàn ===");
{
  const expected = buildAttemptFingerprint([
    { questionNumber: 1, correct: false },
    { questionNumber: 2, correct: true },
  ]);
  const actual = buildAttemptFingerprint([
    { questionNumber: 2, correct: true },
    { questionNumber: 1, correct: false },
  ]);
  const result = compareFingerprints(expected, actual);
  report("match=true dù input order khác nhau", result.match === true, JSON.stringify(result));
}

console.log("=== [D] compareFingerprints - lệch 1 câu ===");
{
  const expected = buildAttemptFingerprint([
    { questionNumber: 1, correct: false },
    { questionNumber: 2, correct: true },
    { questionNumber: 3, correct: false },
  ]);
  const actual = buildAttemptFingerprint([
    { questionNumber: 1, correct: false },
    { questionNumber: 2, correct: false }, // lệch tại đây
    { questionNumber: 3, correct: false },
  ]);
  const result = compareFingerprints(expected, actual);
  report("match=false", result.match === false, JSON.stringify(result));
  report(
    "mismatches chỉ ra ĐÚNG câu 2",
    result.mismatches.length === 1 && result.mismatches[0].questionNumber === 2,
    JSON.stringify(result.mismatches),
  );
}

console.log("=== [E] compareFingerprints - data thật (Lần 5 vs Lần 1, room Vocab 11A2) ===");
{
  // ĐÃ XÁC NHẬN THẬT (2026-09-14, live device 3201d866d40a1681): 2 lượt cùng "Điểm 3"/"Đúng 3/10"
  // nhưng khác nhau ở Q4/Q5 - đây chính là ví dụ "hòa điểm nhưng khác attempt" mà fingerprint phải
  // phân biệt được (overall score đơn thuần KHÔNG phân biệt được 2 case này).
  // Dữ liệu thật Lần 5: Q1=F,Q2=T,Q3=T,Q4=T,Q5=F,Q6=F,Q7=F,Q8=F,Q9=F,Q10=F (Đúng 3/10: Q2,Q3,Q4).
  const lan5Real = buildAttemptFingerprint([
    { questionNumber: 1, correct: false },
    { questionNumber: 2, correct: true },
    { questionNumber: 3, correct: true },
    { questionNumber: 4, correct: true },
    { questionNumber: 5, correct: false },
    { questionNumber: 6, correct: false },
    { questionNumber: 7, correct: false },
    { questionNumber: 8, correct: false },
    { questionNumber: 9, correct: false },
    { questionNumber: 10, correct: false },
  ]);
  const lan1Real = buildAttemptFingerprint([
    { questionNumber: 1, correct: false },
    { questionNumber: 2, correct: true },
    { questionNumber: 3, correct: true },
    { questionNumber: 4, correct: false },
    { questionNumber: 5, correct: true },
    { questionNumber: 6, correct: false },
    { questionNumber: 7, correct: false },
    { questionNumber: 8, correct: false },
    { questionNumber: 9, correct: false },
    { questionNumber: 10, correct: false },
  ]);
  const result = compareFingerprints(lan5Real, lan1Real);
  report("Lần 5 KHÔNG khớp Lần 1 dù cùng overall score/Đúng-N", result.match === false, JSON.stringify(result));
  report(
    "lệch đúng ở Q4 và Q5 (đúng như quan sát thật)",
    result.mismatches.length === 2 &&
      result.mismatches.some((m) => m.questionNumber === 4) &&
      result.mismatches.some((m) => m.questionNumber === 5),
    JSON.stringify(result.mismatches),
  );
  // self-compare vẫn phải khớp (sanity check).
  report("Lần 5 tự so với chính nó -> match=true", compareFingerprints(lan5Real, lan5Real).match === true);
}

console.log("=== [F] comparePercents - lệch percent, correctness vẫn khớp ===");
{
  const expected = buildAttemptFingerprint([
    { questionNumber: 1, correct: false, percent: 40 },
    { questionNumber: 2, correct: true, percent: 97 },
  ]);
  const actual = buildAttemptFingerprint([
    { questionNumber: 1, correct: false, percent: 39 }, // lệch 1% (vd làm tròn khác nhau)
    { questionNumber: 2, correct: true, percent: 97 },
  ]);
  const fpResult = compareFingerprints(expected, actual);
  const percentMismatches = comparePercents(expected, actual);
  report("correctness vẫn match=true (percent không ảnh hưởng)", fpResult.match === true);
  report(
    "comparePercents phát hiện đúng câu 1 lệch",
    percentMismatches.length === 1 && percentMismatches[0].questionNumber === 1,
    JSON.stringify(percentMismatches),
  );
}

console.log(`\n${passes} passed, ${failures} failed.`);
if (failures > 0) process.exitCode = 1;
