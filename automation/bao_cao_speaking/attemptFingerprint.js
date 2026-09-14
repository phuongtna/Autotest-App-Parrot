/**
 * Track A (mở rộng 2026-09-14) - "fingerprint" theo từng câu của 1 lượt làm bài Speaking, dùng để
 * xác nhận Web đang hiển thị ĐÚNG lượt nào khi nhiều lượt hòa điểm tổng (selectBestAttempt.js chỉ
 * chọn được lượt "nên" đối chiếu, không tự chứng minh Web có thực sự dùng đúng lượt đó hay không -
 * so overall score không đủ phân biệt 2 lượt hòa điểm, xem ví dụ thật đã verify sống: room Vocab
 * 11A2, Lần 5 và Lần 1 cùng "Điểm 3"/"Đúng 3/10" nhưng khác nhau ở CÂU nào đúng/sai).
 *
 * Pure function - không phụ thuộc Playwright/Maestro, không gọi API/UI, không mutate input.
 */

/**
 * Chuẩn hoá mảng kết quả từng câu (thứ tự bất kỳ, nguồn App hoặc Web đều dùng chung hàm này) thành
 * fingerprint: mảng {questionNumber, correct, percent} đã sort theo questionNumber tăng dần.
 *
 * @param {Array<{questionNumber: number, correct: boolean, percent?: number|null}>} questionResults
 */
export function buildAttemptFingerprint(questionResults) {
  if (!Array.isArray(questionResults) || questionResults.length === 0) {
    throw new Error("buildAttemptFingerprint: questionResults rỗng hoặc không hợp lệ.");
  }

  const seenQuestionNumbers = new Set();
  for (const q of questionResults) {
    if (typeof q?.questionNumber !== "number" || Number.isNaN(q.questionNumber)) {
      throw new Error(`buildAttemptFingerprint: thiếu questionNumber hợp lệ - ${JSON.stringify(q)}`);
    }
    if (typeof q?.correct !== "boolean") {
      throw new Error(`buildAttemptFingerprint: thiếu correct (boolean) hợp lệ - ${JSON.stringify(q)}`);
    }
    if (seenQuestionNumbers.has(q.questionNumber)) {
      throw new Error(`buildAttemptFingerprint: questionNumber=${q.questionNumber} bị lặp lại.`);
    }
    seenQuestionNumbers.add(q.questionNumber);
  }

  return questionResults
    .map((q) => ({
      questionNumber: q.questionNumber,
      correct: q.correct,
      percent: typeof q.percent === "number" && !Number.isNaN(q.percent) ? q.percent : null,
    }))
    .sort((a, b) => a.questionNumber - b.questionNumber);
}

/**
 * So sánh 2 fingerprint theo ĐÚNG/SAI từng câu (Ưu tiên 1 theo yêu cầu - KHÔNG so `percent` ở đây,
 * xem `describePercentMismatches()` bên dưới nếu cần so percent riêng làm bằng chứng phụ). Không
 * giả định 2 fingerprint cùng độ dài đã được sort - tự sort lại trước khi so để an toàn dù input đã
 * qua `buildAttemptFingerprint()` hay chưa.
 *
 * @returns {{match: boolean, mismatches: Array<{questionNumber: number, expected: boolean, actual: boolean|null}>}}
 */
export function compareFingerprints(expected, actual) {
  const expectedSorted = [...expected].sort((a, b) => a.questionNumber - b.questionNumber);
  const actualByQuestion = new Map(actual.map((q) => [q.questionNumber, q]));

  const mismatches = [];
  for (const exp of expectedSorted) {
    const act = actualByQuestion.get(exp.questionNumber);
    if (!act || act.correct !== exp.correct) {
      mismatches.push({
        questionNumber: exp.questionNumber,
        expected: exp.correct,
        actual: act ? act.correct : null,
      });
    }
  }
  return { match: mismatches.length === 0, mismatches };
}

/**
 * So sánh `percent` từng câu - bằng chứng PHỤ (không phải fingerprint chính, xem docblock đầu file)
 * vì correctness đã đủ phân biệt attempt trong mọi case đã verify sống. Trả về danh sách câu có
 * percent lệch (rỗng nếu khớp hết).
 */
export function comparePercents(expected, actual) {
  const actualByQuestion = new Map(actual.map((q) => [q.questionNumber, q]));
  const mismatches = [];
  for (const exp of expected) {
    const act = actualByQuestion.get(exp.questionNumber);
    if (!act || act.percent !== exp.percent) {
      mismatches.push({
        questionNumber: exp.questionNumber,
        expectedPercent: exp.percent,
        actualPercent: act ? act.percent : null,
      });
    }
  }
  return mismatches;
}

/** Format fingerprint thành chuỗi ngắn dễ đọc trong log lỗi, vd "Q1:F|Q2:T|Q3:T|Q4:T". */
export function describeFingerprint(fingerprint) {
  return fingerprint.map((q) => `Q${q.questionNumber}:${q.correct ? "T" : "F"}`).join("|");
}
