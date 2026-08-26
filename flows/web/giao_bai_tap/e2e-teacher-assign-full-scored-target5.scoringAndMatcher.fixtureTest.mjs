#!/usr/bin/env node
/**
 * Fixture test cho patch 2026-08-26 của e2e-teacher-assign-full-scored-target5.mjs (port full
 * answer-set matcher + weighted subset-sum scoring engine + dynamic runtime target score, theo
 * yêu cầu "TUYỆT ĐỐI KHÔNG HARDCODE TARGET SCORE"). CHỈ import + gọi trực tiếp các hàm THUẦN đã
 * export (không qua bridge/network/device) - main() có run-guard riêng (`process.argv[1] ===
 * resolve(...)`), import file này KHÔNG tự chạy E2E, KHÔNG mở Maestro, KHÔNG gọi API production.
 *
 * Bao phủ theo đúng yêu cầu review 2026-08-26 (mục 3 - edge cases):
 *   - candidate nhiều đáp án (5+ answers)
 *   - chỉ 1 phần answers hiển thị (partial-only -> NO_MATCH, KHÔNG first-fit)
 *   - nhiều candidate cùng full-match (AMBIGUOUS)
 *   - không candidate nào match (NO_MATCH, cả 2 nhánh: partial-only VÀ hoàn toàn không có text)
 *   - normalization (khoảng trắng/hoa-thường khác nhau vẫn coi là cùng 1 đáp án)
 *   - target score KHÔNG achievable (mode="target")
 *   - target score đúng NGAY BOUNDARY MIN/MAX (mode="range")
 *   - nhiều tổ hợp câu-đúng khác nhau cùng ra 1 điểm số (redundant combinations)
 *   - catalog vs room resolved question set KHÁC NHAU (mode="target" re-validate: cùng nội dung
 *     xáo trộn thứ tự -> vẫn PASS; nội dung thật khác hẳn -> BLOCKED rõ ràng, không đoán)
 *   - regression cho chính bug đã tìm thấy TRONG lúc viết fixture này (xem [SCORING BUG] bên dưới)
 *
 * Chạy: node "flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.scoringAndMatcher.fixtureTest.mjs"
 */

import {
  normalizeAnswerText,
  buildNormalizedVisibleSet,
  findFullAnswerSetMatches,
  findMatchingQuestion,
  buildScoringPlan,
  scaledSumForScore,
  achievableScoresList,
  resolveScoringPlanForCandidate,
  buildWeightedWantCorrectPlan,
} from "./e2e-teacher-assign-full-scored-target5.mjs";

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

function q(id, answers, correctAnswer, point = 1) {
  return { id, answers, correctAnswer, question: `Q-${id}`, metadata: { point } };
}

/** Cây hierarchy tối giản chỉ chứa các dòng text cho trước - đủ cho collectAllTexts()/isVisible()
 * (KHÔNG cần bounds/scrollable thật - findMatchingQuestion() không đọc bounds). */
function treeFromTexts(texts) {
  return { attributes: {}, children: texts.map((t) => ({ attributes: { text: t }, children: [] })) };
}

const staticBridge = {
  async hierarchy() {
    throw new Error("staticBridge.hierarchy() KHÔNG được gọi - test luôn truyền priorTree, gọi tới đây là bug của chính test.");
  },
  async runSteps() {
    throw new Error("staticBridge.runSteps() KHÔNG được gọi trong fixture test này.");
  },
};

console.log("=== [1] normalizeAnswerText / buildNormalizedVisibleSet ===");
{
  report("trim + lowercase + collapse whitespace", normalizeAnswerText("  Hello   World  ") === "hello world");
  report("normalize null/undefined an toàn (không throw)", normalizeAnswerText(null) === "" && normalizeAnswerText(undefined) === "");
  const set = buildNormalizedVisibleSet(["Cat", "  cat ", "Dog"]);
  report("buildNormalizedVisibleSet dedup theo normalized form", set.size === 2 && set.has("cat") && set.has("dog"), `size=${set.size}`);
}

console.log("\n=== [2] findFullAnswerSetMatches - full/partial/ambiguous/none ===");
{
  // [2a] candidate nhiều đáp án (5) - full match khi CẢ 5 hiển thị.
  const many = q("many", ["A", "B", "C", "D", "E"], "C");
  const visibleAll = buildNormalizedVisibleSet(["A", "B", "C", "D", "E", "some other UI text"]);
  const r2a = findFullAnswerSetMatches([many], visibleAll);
  report("[2a] candidate 5 đáp án, cả 5 hiển thị -> full match", r2a.matches.length === 1 && r2a.matches[0].id === "many", JSON.stringify(r2a));

  // [2b] chỉ 1 phần answers hiển thị (3/5) -> KHÔNG match, nhưng anyPartialTextVisible=true.
  const visiblePartial = buildNormalizedVisibleSet(["A", "B", "C"]);
  const r2b = findFullAnswerSetMatches([many], visiblePartial);
  report("[2b] chỉ 3/5 đáp án hiển thị -> 0 match nhưng anyPartialTextVisible=true (KHÔNG first-fit)", r2b.matches.length === 0 && r2b.anyPartialTextVisible === true, JSON.stringify(r2b));

  // [2c] 2 candidate CÙNG full-match (dùng chung answer set) -> AMBIGUOUS ở tầng findFullAnswerSetMatches (trả cả 2 trong matches).
  const c1 = q("c1", ["X", "Y", "Z"], "X");
  const c2 = q("c2", ["X", "Y", "Z"], "Y");
  const visibleXYZ = buildNormalizedVisibleSet(["X", "Y", "Z"]);
  const r2c = findFullAnswerSetMatches([c1, c2], visibleXYZ);
  report("[2c] 2 candidate cùng answer-set, cả 2 đều hiển thị đủ -> 2 match (AMBIGUOUS)", r2c.matches.length === 2, JSON.stringify(r2c));

  // [2d] không candidate nào lộ dù 1 phần (0 chữ nào khớp) -> 0 match, anyPartialTextVisible=false.
  const visibleUnrelated = buildNormalizedVisibleSet(["Hoàn thành", "Tiếp theo"]);
  const r2d = findFullAnswerSetMatches([many, c1, c2], visibleUnrelated);
  report("[2d] không đáp án nào hiển thị -> 0 match, anyPartialTextVisible=false", r2d.matches.length === 0 && r2d.anyPartialTextVisible === false, JSON.stringify(r2d));

  // [2e] normalization: đáp án hiển thị lệch khoảng trắng/hoa-thường vẫn coi là khớp.
  const c3 = q("c3", ["Apple", "Banana"], "Apple");
  const visibleMessy = buildNormalizedVisibleSet(["  apple ", "BANANA"]);
  const r2e = findFullAnswerSetMatches([c3], visibleMessy);
  report("[2e] answers hiển thị lệch case/whitespace vẫn full-match nhờ normalize", r2e.matches.length === 1 && r2e.matches[0].id === "c3", JSON.stringify(r2e));

  // [2f] candidate <2 answers hợp lệ bị BỎ QUA hoàn toàn (không tính vào partial/full).
  const tooFew = q("toofew", ["OnlyOne"], "OnlyOne");
  const r2f = findFullAnswerSetMatches([tooFew], buildNormalizedVisibleSet(["OnlyOne"]));
  report("[2f] candidate <2 answers hợp lệ -> bỏ qua (0 match, KHÔNG tính partial)", r2f.matches.length === 0 && r2f.anyPartialTextVisible === false, JSON.stringify(r2f));
}

console.log("\n=== [3] findMatchingQuestion - integration với decideAnswerAction thật ===");
{
  // [3a] MATCHED: unique full-set match + decideAnswerAction thật tạo được action.
  const qa = q("qa", ["Đúng", "Sai"], "Đúng");
  const treeA = treeFromTexts(["Đúng", "Sai", "Nộp bài"]);
  const r3a = await findMatchingQuestion(staticBridge, [qa], treeA, 1, null);
  report("[3a] MATCHED khi unique full-set + decideAnswerAction thành công", r3a.status === "MATCHED" && r3a.question.id === "qa", JSON.stringify({ status: r3a.status }));

  // [3b] AMBIGUOUS: 2 candidate cùng answer-set đều hiển thị đủ.
  const qb1 = q("qb1", ["Yes", "No"], "Yes");
  const qb2 = q("qb2", ["Yes", "No"], "No");
  const treeB = treeFromTexts(["Yes", "No"]);
  const r3b = await findMatchingQuestion(staticBridge, [qb1, qb2], treeB, 2, null);
  report("[3b] AMBIGUOUS khi 2 candidate cùng khớp full answer-set", r3b.status === "AMBIGUOUS" && r3b.diagnostic.candidates.length === 2, JSON.stringify({ status: r3b.status }));

  // [3c] NO_MATCH: chỉ lộ 1 phần đáp án (partial-only, KHÔNG rơi xuống fallback first-fit).
  const qc = q("qc", ["Táo", "Chuối", "Cam"], "Táo");
  const treeC = treeFromTexts(["Táo", "Chuối"]); // thiếu "Cam"
  const r3c = await findMatchingQuestion(staticBridge, [qc], treeC, 3, null);
  report("[3c] NO_MATCH khi chỉ lộ 2/3 đáp án (partial-only)", r3c.status === "NO_MATCH" && r3c.diagnostic.reason.includes("partial-only"), JSON.stringify({ status: r3c.status, reason: r3c.diagnostic?.reason }));

  // [3d] NO_MATCH: không lộ đáp án dạng text nào + không có image-grid nào trên tree -> fallback first-fit cũng thất bại.
  const qd = q("qd", ["Foo", "Bar"], "Foo");
  const treeD = treeFromTexts(["Hoàn thành", "Tiếp theo"]);
  const r3d = await findMatchingQuestion(staticBridge, [qd], treeD, 4, null);
  report("[3d] NO_MATCH khi không có text nào khớp và cũng không có image-grid", r3d.status === "NO_MATCH", JSON.stringify({ status: r3d.status, reason: r3d.diagnostic?.reason }));

  // [3e] examIdContext chỉ ảnh hưởng log, KHÔNG ảnh hưởng status/question trả về.
  const r3e = await findMatchingQuestion(staticBridge, [qa], treeA, 5, { roomExamId: "real-1", candidateExamId: "catalog-1" });
  report("[3e] examIdContext không đổi kết quả match (chỉ để log)", r3e.status === "MATCHED" && r3e.question.id === "qa");
}

console.log("\n=== [4] buildScoringPlan / scaledSumForScore / achievableScoresList - round-trip chính xác ===");
{
  // [SCORING BUG] Phát hiện 2026-08-26 khi viết CHÍNH fixture này (KHÔNG phải E2E): mode="range" bản
  // đầu random trên achievableScores (đã ROUND 6 chữ số thập phân) rồi suy ngược qua
  // scaledSumForScore() - round-trip đó mất chính xác với scaledTotal không "đẹp" (vd 7 câu 1
  // điểm/câu -> scaledTotal=7000), khiến scaledSumForScore() trả null; VÀ correctIndicesForScaledSum(null)
  // (do null bị bracket-access thành "reachedByItem[null]" = undefined, KHÔNG PHẢI -1) lọt qua guard
  // cũ, trả về 1 Set() RỖNG thay vì null - nghĩa là 1 target "tưởng khả thi" nhưng plan thật là "trả
  // lời SAI TẤT CẢ". ĐÃ SỬA: mode="range" giờ chọn EXACT scaledSum từ achievableScaledSums (không qua
  // display-rounded value); correctIndicesForScaledSum() thêm guard `== null`; scaledSumForScore()
  // nới tolerance theo scaledTotal. Test dưới đây chính là regression cho bug này.
  for (const n of [3, 7, 11]) {
    const questions = Array.from({ length: n }, (_, i) => q(`u${i}`, ["A", "B"], "A", 1));
    const plan = buildScoringPlan(questions);
    const scores = achievableScoresList(plan.scaledTotal, plan.achievableScaledSums);
    let allRoundTripOk = true;
    const bad = [];
    scores.forEach((s, i) => {
      const scaledSum = scaledSumForScore(plan.scaledTotal, s);
      const idx = scaledSum == null ? null : plan.correctIndicesForScaledSum(scaledSum);
      const ok = idx !== null && idx.size === i; // i-th achievable score (đều trọng số) cần đúng i item.
      if (!ok) { allRoundTripOk = false; bad.push({ score: s, scaledSum, size: idx ? idx.size : idx }); }
    });
    report(`[4-n${n}] achievableScoresList(${scores.length} mốc) round-trip đúng qua scaledSumForScore+correctIndicesForScaledSum`, allRoundTripOk, JSON.stringify(bad));
  }

  // [4-mixed] trọng số khác nhau (1 item point=10 + 9 item point=1, mô phỏng 1 câu SPEAK độc lập).
  const mixed = [q("speak", ["A", "B"], "A", 10), ...Array.from({ length: 9 }, (_, i) => q(`m${i}`, ["A", "B"], "A", 1))];
  const planMixed = buildScoringPlan(mixed);
  const scoresMixed = achievableScoresList(planMixed.scaledTotal, planMixed.achievableScaledSums);
  let mixedOk = true;
  for (const s of scoresMixed) {
    const scaledSum = scaledSumForScore(planMixed.scaledTotal, s);
    const idx = scaledSum == null ? null : planMixed.correctIndicesForScaledSum(scaledSum);
    if (idx === null) mixedOk = false;
  }
  report(`[4-mixed] trọng số khác nhau (point=10 + 9x point=1) - toàn bộ ${scoresMixed.length} mốc đều round-trip achievable`, mixedOk, `scaledTotal=${planMixed.scaledTotal}`);

  // [4-genuine-non-achievable] 1 score KHÔNG thật sự khả thi vẫn phải bị reject (không nới tolerance quá tay).
  const q7 = Array.from({ length: 7 }, (_, i) => q(`g${i}`, ["A", "B"], "A", 1));
  const plan7 = buildScoringPlan(q7);
  const ss5 = scaledSumForScore(plan7.scaledTotal, 5.0);
  const idx5 = ss5 == null ? null : plan7.correctIndicesForScaledSum(ss5);
  report("[4-genuine-non-achievable] score=5.0 với 7 câu 1đ/câu KHÔNG khả thi -> reject đúng (không false-positive)", idx5 === null, `scaledSum=${ss5}`);
  const ssRandom = scaledSumForScore(plan7.scaledTotal, 3.333333);
  report("[4-genuine-non-achievable] score=3.333333 (không rơi vào mốc nào) -> null ngay ở scaledSumForScore", ssRandom === null);
}

console.log("\n=== [5] resolveScoringPlanForCandidate - mode=range / mode=target / boundary / redundant combos ===");
{
  const q7 = Array.from({ length: 7 }, (_, i) => q(`r${i}`, ["A", "B"], "A", 1));

  // [5a] mode="range" random trong [0,10] (full range) nhiều lần - PHẢI luôn ra correctIndices hợp lệ
  // (size khớp đúng target*scaledTotal/10), KHÔNG BAO GIỜ rơi vào bug Set() rỗng-giả-achievable.
  let rangeAllOk = true;
  const seenTargets = new Set();
  for (let i = 0; i < 40; i++) {
    const plan = resolveScoringPlanForCandidate(q7, { mode: "range", rangeMin: 0, rangeMax: 10 });
    seenTargets.add(plan.targetScore);
    const expectedCount = Math.round((plan.targetScore * 7) / 10);
    if (!plan.achievable || plan.correctIndices.size !== expectedCount) rangeAllOk = false;
  }
  report("[5a] mode=range random 40 lần đều achievable + correctIndices.size khớp targetScore", rangeAllOk);
  report("[5a] mode=range có random thật (không luôn ra 1 giá trị cố định)", seenTargets.size > 1, `seenTargets=${[...seenTargets].join(",")}`);

  // [5b] mode="range" với range KHÔNG chứa điểm khả thi nào (vd (0.01, 0.02) quá hẹp giữa 2 mốc 0 và 1.428571).
  const planNoRange = resolveScoringPlanForCandidate(q7, { mode: "range", rangeMin: 0.01, rangeMax: 0.02 });
  report("[5b] mode=range KHÔNG có điểm khả thi trong range hẹp -> achievable=false kèm reason", planNoRange.achievable === false && Array.isArray(planNoRange.achievableScores), JSON.stringify(planNoRange));

  // [5c] boundary: rangeMin===rangeMax===1 mốc khả thi CHÍNH XÁC (vd 10 câu 1đ/câu, target=5.0 đúng biên).
  const q10 = Array.from({ length: 10 }, (_, i) => q(`b${i}`, ["A", "B"], "A", 1));
  const planBoundary = resolveScoringPlanForCandidate(q10, { mode: "range", rangeMin: 5.0, rangeMax: 5.0 });
  report("[5c] boundary rangeMin=rangeMax=5.0 (đúng 1 mốc khả thi) -> chọn ĐÚNG 5.0, correctIndices.size=5", planBoundary.achievable && planBoundary.targetScore === 5 && planBoundary.correctIndices.size === 5, JSON.stringify(planBoundary));

  // [5d] mode="target" re-validate 1 giá trị KHÔNG khả thi -> BLOCKED rõ ràng, không đoán.
  const planTargetBad = resolveScoringPlanForCandidate(q7, { mode: "target", targetScoreEnv: 5.0 });
  report("[5d] mode=target với score không khả thi -> achievable=false", planTargetBad.achievable === false, JSON.stringify(planTargetBad.reason));

  // [5e] mode="target" re-validate 1 giá trị hợp lệ (đã pick ở "prescan" giả lập) trên CHÍNH exercise đó -> PASS.
  const rangePick = resolveScoringPlanForCandidate(q7, { mode: "range", rangeMin: 0, rangeMax: 10 });
  const revalidated = resolveScoringPlanForCandidate(q7, { mode: "target", targetScoreEnv: rangePick.targetScore });
  report(
    "[5e] mode=target re-validate ĐÚNG giá trị vừa random ở mode=range (cùng nội dung) -> PASS, correctIndices.size khớp",
    revalidated.achievable && revalidated.correctIndices.size === rangePick.correctIndices.size,
    JSON.stringify({ picked: rangePick.targetScore, revalidatedTarget: revalidated.targetScore }),
  );

  // [5f] redundant combinations: 4 câu 1đ/câu -> score=5.0 (2/4 đúng) có NHIỀU tổ hợp khả thi
  // ({0,1},{0,2},{0,3},{1,2},...) - DP chỉ lưu 1 đường truy vết nhưng PHẢI trả 1 tổ hợp HỢP LỆ (size=2),
  // không crash/không nhầm sang tổ hợp khác kích cỡ.
  const q4 = Array.from({ length: 4 }, (_, i) => q(`c${i}`, ["A", "B"], "A", 1));
  const plan4 = resolveScoringPlanForCandidate(q4, { mode: "target", targetScoreEnv: 5.0 });
  report("[5f] score=5.0 với 4 câu 1đ/câu (nhiều tổ hợp 2/4 khả thi) -> vẫn trả đúng 1 tổ hợp size=2", plan4.achievable && plan4.correctIndices.size === 2, JSON.stringify(plan4));

  // [5g] catalog vs room resolved question set KHÁC NHAU nhưng CÙNG nội dung XÁO TRỘN thứ tự (đúng
  // scenario bug thật project_teacher_materials_examid_order_mismatch.md) -> achievable set (dựa
  // trên multiset point, KHÔNG phụ thuộc order) PHẢI giống nhau -> re-validate PASS.
  const catalogOrder = [q("x0", ["A", "B"], "A", 1), q("x1", ["A", "B"], "A", 1), q("x2", ["A", "B"], "A", 1), q("x3", ["A", "B"], "A", 2)];
  const roomOrderShuffled = [catalogOrder[3], catalogOrder[1], catalogOrder[0], catalogOrder[2]]; // cùng multiset điểm [2,1,1,1], thứ tự khác.
  const catalogPlan = resolveScoringPlanForCandidate(catalogOrder, { mode: "range", rangeMin: 0, rangeMax: 10 });
  const roomRevalidated = resolveScoringPlanForCandidate(roomOrderShuffled, { mode: "target", targetScoreEnv: catalogPlan.targetScore });
  report(
    "[5g] room content CÙNG multiset point nhưng thứ tự khác catalog -> re-validate ở mode=target vẫn PASS (order-invariant)",
    roomRevalidated.achievable,
    JSON.stringify({ catalogTarget: catalogPlan.targetScore, roomAchievable: roomRevalidated.achievable, roomReason: roomRevalidated.reason }),
  );

  // [5h] catalog vs room THẬT SỰ khác nội dung (khác multiset point, vd room có ít câu hơn) -> target
  // không còn khả thi -> BLOCKED rõ ràng (KHÔNG đoán/KHÔNG dùng correctIndices rỗng).
  const roomDifferentContent = [q("y0", ["A", "B"], "A", 1), q("y1", ["A", "B"], "A", 1)]; // chỉ 2 câu, tổng điểm khác hẳn.
  const targetFromBigExercise = 8.0; // giả sử đã pick ở prescan trên đề catalog 10 câu.
  const roomBlocked = resolveScoringPlanForCandidate(roomDifferentContent, { mode: "target", targetScoreEnv: targetFromBigExercise });
  report(
    "[5h] room content KHÁC HẲN catalog (khác tổng điểm) -> target cũ không khả thi -> BLOCKED (achievable=false), KHÔNG âm thầm trả correctIndices rỗng",
    roomBlocked.achievable === false,
    JSON.stringify(roomBlocked),
  );
}

console.log("\n=== [6] buildWeightedWantCorrectPlan ===");
{
  const questions = [q("w0", ["A", "B"], "A", 1), q("w1", ["A", "B"], "A", 1), q("w2", ["A", "B"], "A", 0), q("w3", ["A", "B"], "A", 1)];
  const correctIndices = new Set([0, 3]); // muốn đúng item 0 và 3.
  const plan = buildWeightedWantCorrectPlan(questions, correctIndices);
  report(
    "buildWeightedWantCorrectPlan: item trong correctIndices -> true, item point<=0 -> luôn true (an toàn), còn lại -> false",
    plan.get("w0") === true && plan.get("w1") === false && plan.get("w2") === true && plan.get("w3") === true,
    JSON.stringify([...plan.entries()]),
  );
}

console.log("\n=== [7] runtimeTargetScore invariant: mode=range random ĐÚNG 1 lần, mode=target KHÔNG BAO GIỜ random lại ===");
{
  // [7a] Instrument Math.random() thật (KHÔNG mock toàn bộ device session - CHỈ theo dõi đúng 1 hàm
  // built-in liên quan trực tiếp tới câu hỏi "có random lại không") để CHỨNG MINH bằng thực thi thật
  // (không chỉ đọc code) rằng mode="target" (nhánh dùng ở [3/N] để RE-VALIDATE runtimeTargetScore đã
  // random ở prescan) không gọi Math.random() dù chỉ 1 lần - khớp đúng ý nghĩa "random đúng 1 lần rồi
  // chỉ re-validate" của biến runtimeTargetScore trong main().
  const q7 = Array.from({ length: 7 }, (_, i) => q(`t${i}`, ["A", "B"], "A", 1));
  const originalRandom = Math.random;
  let randomCallCount = 0;
  Math.random = (...args) => {
    randomCallCount++;
    return originalRandom(...args);
  };
  try {
    randomCallCount = 0;
    const rangeResult = resolveScoringPlanForCandidate(q7, { mode: "range", rangeMin: 0, rangeMax: 10 });
    report("[7a] mode=range GỌI Math.random() (đúng là nhánh random duy nhất)", randomCallCount > 0, `calls=${randomCallCount}`);

    randomCallCount = 0;
    const targetResult = resolveScoringPlanForCandidate(q7, { mode: "target", targetScoreEnv: rangeResult.targetScore });
    report("[7b] mode=target (re-validate) KHÔNG gọi Math.random() dù chỉ 1 lần", randomCallCount === 0, `calls=${randomCallCount}`);
    report("[7b] mode=target re-validate trả ĐÚNG targetScore đã random trước đó (không đổi giá trị)", targetResult.achievable && targetResult.targetScore === rangeResult.targetScore);

    // [7c] Determinism: gọi mode="target" NHIỀU LẦN với CÙNG input -> luôn ra CÙNG kết quả (không có
    // nguồn non-determinism ẩn nào trong nhánh re-validate).
    randomCallCount = 0;
    const repeat1 = resolveScoringPlanForCandidate(q7, { mode: "target", targetScoreEnv: rangeResult.targetScore });
    const repeat2 = resolveScoringPlanForCandidate(q7, { mode: "target", targetScoreEnv: rangeResult.targetScore });
    report(
      "[7c] mode=target gọi lại nhiều lần CÙNG input -> deterministic (cùng targetScore + cùng correctIndices)",
      randomCallCount === 0 &&
        repeat1.targetScore === repeat2.targetScore &&
        repeat1.correctIndices.size === repeat2.correctIndices.size &&
        [...repeat1.correctIndices].sort().join(",") === [...repeat2.correctIndices].sort().join(","),
      `calls=${randomCallCount}`,
    );
  } finally {
    Math.random = originalRandom; // LUÔN khôi phục - tránh rò rỉ instrumentation sang phần test khác.
  }
}

console.log("\n=== [8] scaledSumForScore / achievableScoresList - stress test scaledTotal lớn ===");
{
  // Theo yêu cầu review "stress-test với scaledTotal lớn": phủ N câu x trọng số khác nhau, tới
  // scaledTotal ~ vài triệu (v.d 500 câu, trọng số tới 10 -> scaledTotal tới 5,000,000) - lớn hơn hẳn
  // bất kỳ bài tập thật nào trong hệ thống (thực tế N thường <= vài chục câu), để xác nhận
  // scaledSumForScore() KHÔNG có "vùng không an toàn" nào (khác bản epsilon cũ, vùng đó THẬT SỰ tồn
  // tại toán học khi scaledTotal > 1e7 - đã verify bằng node -e ad-hoc trước khi sửa, xem memory
  // project_teacher_materials_examid_order_mismatch.md).
  const sizesToStress = [50, 97, 149, 211, 307, 401, 503];
  const pointVariants = [1, 3, 7, 10];
  let stressAllOk = true;
  let totalChecked = 0;
  const failures2 = [];
  for (const n of sizesToStress) {
    for (const pv of pointVariants) {
      const questions = Array.from({ length: n }, (_, i) => q(`s${i}`, ["A", "B"], "A", i % 4 === 0 ? pv : 1));
      const plan = buildScoringPlan(questions);
      if (!plan) continue;
      const scores = achievableScoresList(plan.scaledTotal, plan.achievableScaledSums);
      for (const s of scores) {
        totalChecked++;
        const scaledSum = scaledSumForScore(plan.scaledTotal, s);
        const idx = scaledSum == null ? null : plan.correctIndicesForScaledSum(scaledSum);
        if (idx === null) {
          stressAllOk = false;
          failures2.push({ n, pv, scaledTotal: plan.scaledTotal, score: s });
        }
      }
    }
  }
  report(
    `stress test ${totalChecked} achievable-score round-trip (n=${sizesToStress.join(",")}, point=${pointVariants.join(",")}, scaledTotal tới ${Math.max(...sizesToStress) * Math.max(...pointVariants) * 1000}) - TOÀN BỘ round-trip achievable`,
    stressAllOk && totalChecked > 0,
    JSON.stringify(failures2.slice(0, 5)),
  );

  // Genuine non-achievable ở scaledTotal LỚN vẫn phải bị reject đúng (không false-positive dù scaledTotal lớn).
  const bigQuestions = Array.from({ length: 503 }, (_, i) => q(`big${i}`, ["A", "B"], "A", 10));
  const bigPlan = buildScoringPlan(bigQuestions);
  const arbitraryScore = 6.123457; // KHÔNG phải 1 mốc khả thi thật (mốc thật cách nhau 10/503 ~ 0.0199, số này lệch mốc gần nhất).
  const ss = scaledSumForScore(bigPlan.scaledTotal, arbitraryScore);
  const idx = ss == null ? null : bigPlan.correctIndicesForScaledSum(ss);
  report(
    `scaledTotal LỚN (${bigPlan.scaledTotal}) + score KHÔNG khả thi (${arbitraryScore}) -> reject đúng, KHÔNG false-positive`,
    idx === null,
    `scaledSum=${ss}`,
  );
}

console.log("\n=== [9] examIdContext wiring - roomExamId/candidateExamId đi ĐÚNG vào [answer-match] log ===");
{
  // Theo yêu cầu review point 3: xác nhận examIdContext TRUYỀN ĐÚNG (không hoán đổi/rơi mất) từ nơi
  // gọi tới nơi log - capture console.log tạm thời (KHÔNG mock bridge/device, CHỈ chặn console.log
  // để đọc lại text đã in) rồi assert dòng "[answer-match] roomExamId=... candidateExamId=..." chứa
  // ĐÚNG 2 giá trị đã truyền vào, khớp ĐÚNG tên field dùng ở [9/N] thật trong main()
  // (`{ roomExamId: realRoomExamId, candidateExamId: resolved.examId }`).
  const originalConsoleLog = console.log;
  const capturedLines = [];
  console.log = (...args) => capturedLines.push(args.join(" "));
  try {
    const qi = q("wire", ["Cat", "Dog"], "Cat");
    const treeWire = treeFromTexts(["Cat", "Dog"]);
    await findMatchingQuestion(staticBridge, [qi], treeWire, 7, { roomExamId: "REAL_ROOM_EXAM_ID_XYZ", candidateExamId: "CATALOG_EXAM_ID_ABC" });
  } finally {
    console.log = originalConsoleLog;
  }
  const answerMatchLine = capturedLines.find((l) => l.startsWith("[answer-match]"));
  report(
    "[9] log [answer-match] chứa ĐÚNG roomExamId truyền vào (không hoán đổi với candidateExamId)",
    Boolean(answerMatchLine) && answerMatchLine.includes("roomExamId=REAL_ROOM_EXAM_ID_XYZ"),
    answerMatchLine,
  );
  report(
    "[9] log [answer-match] chứa ĐÚNG candidateExamId truyền vào",
    Boolean(answerMatchLine) && answerMatchLine.includes("candidateExamId=CATALOG_EXAM_ID_ABC"),
    answerMatchLine,
  );
  // Sanity ngược: đảm bảo test THẬT SỰ capture được log (không phải false-pass do capturedLines rỗng).
  report("[9] capture console.log hoạt động (có ít nhất 1 dòng [answer-match])", capturedLines.some((l) => l.startsWith("[answer-match]")));
}

console.log(`\n=== KẾT QUẢ: ${failures === 0 ? "PASS" : "FAIL"} (${passes} pass / ${failures} fail) ===`);
process.exit(failures === 0 ? 0 : 1);
