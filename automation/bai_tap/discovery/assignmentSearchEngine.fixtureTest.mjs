#!/usr/bin/env node
/**
 * Fixture test cho assignmentSearchEngine.js (Phase 1, xem docblock file đó) - test THUẦN (pure
 * function `computeViewportSignature`/`compareSignatures`, không cần thiết bị) + integration test
 * qua static bridge (giống pattern ĐÃ CÓ trong homeworkUiList.parseCard.fixtureTest.mjs) cho
 * `findAssignment()`/`locateSpecificCompletedCandidate()` sau khi chuyển sang dùng engine chung.
 *
 * Chạy: node automation/bai_tap/discovery/assignmentSearchEngine.fixtureTest.mjs
 */

import { computeViewportSignature, compareSignatures, runSearchStateMachine } from "./assignmentSearchEngine.js";
import { findAssignment } from "./findAssignment.js";
import { locateSpecificCompletedCandidate } from "./locateCompletedCandidate.js";

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

function card(title, y, extra = {}) {
  return { title, titleBounds: y != null ? { x1: 0, y1: y, x2: 100, y2: y + 40 } : null, cta: "Làm bài", ...extra };
}

console.log("=== [1] compareSignatures - Case A: same card, Y changed đáng kể → STRONG_PROGRESS ===");
{
  const prev = computeViewportSignature([card("Unit A", 100)], 5);
  const curr = computeViewportSignature([card("Unit A", 40)], 5); // dịch 60px > MIN_MEANINGFUL_Y_SHIFT_PX
  report("Case A → STRONG_PROGRESS", compareSignatures(prev, curr) === "STRONG_PROGRESS");
}

console.log("\n=== [2] compareSignatures - Case B SỬA (Phase 2): khác card, 0 overlap → KHÔNG còn tự động STRONG_PROGRESS ===");
{
  // PHASE 2 (2026-10-06): bản Phase 1 coi expectation này ("khác card -> luôn STRONG_PROGRESS") là
  // ĐÚNG - benchmark thật (assignmentSearchBenchmark.mjs, 6/6 round Strategy A sharedCount=0) chứng
  // minh đây CHÍNH LÀ bug (zero-overlap bị chấp nhận ngay, không xác minh). Expectation SỬA LẠI:
  // "Unit A" và "Unit B" không có identity nào chung -> LOW_CONFIDENCE_PROGRESS, KHÔNG phải STRONG.
  const prev = computeViewportSignature([card("Unit A", 100)], 5);
  const curr = computeViewportSignature([card("Unit B", 100)], 5); // topCard.title KHÁC, 0 overlap
  report(
    "Case B zero-overlap (topCard đổi, không card nào chung) → LOW_CONFIDENCE_PROGRESS (KHÔNG tự tin STRONG_PROGRESS nữa)",
    compareSignatures(prev, curr) === "LOW_CONFIDENCE_PROGRESS",
  );
}

console.log("\n=== [2b] compareSignatures - Case B CÓ overlap thật → vẫn STRONG_PROGRESS (không regress case an toàn) ===");
{
  // Đúng ví dụ user đưa ra: previous=[A,B,C,D], current=[C,D,E,F] - C,D là anchor chung thật.
  const prev = computeViewportSignature([card("A", 100), card("B", 140), card("C", 180), card("D", 220)], 9);
  const curr = computeViewportSignature([card("C", 100), card("D", 140), card("E", 180), card("F", 220)], 9);
  report("Case B có overlap (C,D chung) → vẫn STRONG_PROGRESS như cũ", compareSignatures(prev, curr) === "STRONG_PROGRESS");
}

console.log("\n=== [2c] Regression Case A (yêu cầu Phase 2 mục 7) - [A B C D] → [C D E F] → STRONG_PROGRESS ===");
{
  const prev = computeViewportSignature(["A", "B", "C", "D"].map((t, i) => card(t, 100 + i * 40)), 10);
  const curr = computeViewportSignature(["C", "D", "E", "F"].map((t, i) => card(t, 100 + i * 40)), 10);
  report("[A B C D] → [C D E F] (2 card chung: C,D) → STRONG_PROGRESS", compareSignatures(prev, curr) === "STRONG_PROGRESS");
}

console.log("\n=== [2d] Regression Case B (yêu cầu Phase 2 mục 7) - [A B C D] → [E F G H] → KHÔNG STRONG_PROGRESS vô điều kiện ===");
{
  const prev = computeViewportSignature(["A", "B", "C", "D"].map((t, i) => card(t, 100 + i * 40)), 10);
  const curr = computeViewportSignature(["E", "F", "G", "H"].map((t, i) => card(t, 100 + i * 40)), 10);
  const verdict = compareSignatures(prev, curr);
  report(
    "[A B C D] → [E F G H] (0 card chung) → KHÔNG được STRONG_PROGRESS vô điều kiện (verdict thật=LOW_CONFIDENCE_PROGRESS)",
    verdict !== "STRONG_PROGRESS" && verdict === "LOW_CONFIDENCE_PROGRESS",
    `verdict=${verdict}`,
  );
}

console.log("\n=== [2e] Regression Case C (yêu cầu Phase 2 mục 7) - [A B C D] → [A B C D] (lặp y hệt) → NO_PROGRESS ===");
{
  const sig = computeViewportSignature(["A", "B", "C", "D"].map((t, i) => card(t, 100 + i * 40)), 10);
  const sig2 = computeViewportSignature(["A", "B", "C", "D"].map((t, i) => card(t, 100 + i * 40)), 10);
  report("[A B C D] → [A B C D] y hệt → NO_PROGRESS", compareSignatures(sig, sig2) === "NO_PROGRESS");
}

console.log("\n=== [2f] Regression Case D (yêu cầu Phase 2 mục 7) - [A B] → [] (end of list) → xử lý hợp lệ, không crash ===");
{
  const prev = computeViewportSignature(["A", "B"].map((t, i) => card(t, 100 + i * 40)), 6);
  const curr = computeViewportSignature([], 1); // màn trống hoàn toàn
  let verdict = null;
  let threw = false;
  try {
    verdict = compareSignatures(prev, curr);
  } catch {
    threw = true;
  }
  report(
    "[A B] → [] không crash, KHÔNG tự động STRONG_PROGRESS (verdict thật=LOW_CONFIDENCE_PROGRESS - không đủ bằng chứng khẳng định hết danh sách)",
    !threw && verdict === "LOW_CONFIDENCE_PROGRESS",
    `threw=${threw} verdict=${verdict}`,
  );
}

console.log("\n=== [3] compareSignatures - Case C: same card, same Y, node count đổi → WEAK_PROGRESS ===");
{
  const prev = computeViewportSignature([card("Unit A", 100)], 5);
  const curr = computeViewportSignature([card("Unit A", 100)], 7); // rawNodeCount đổi (badge/score render trễ)
  report("Case C (node count đổi) → WEAK_PROGRESS (KHÔNG tự động thành NO_PROGRESS/END_OF_LIST)", compareSignatures(prev, curr) === "WEAK_PROGRESS");
}

console.log("\n=== [4] compareSignatures - mọi thứ giống hệt → NO_PROGRESS ===");
{
  const prev = computeViewportSignature([card("Unit A", 100)], 5);
  const curr = computeViewportSignature([card("Unit A", 100)], 5);
  report("Mọi tín hiệu giống hệt → NO_PROGRESS", compareSignatures(prev, curr) === "NO_PROGRESS");
}

console.log("\n=== [5] compareSignatures - Case E: thiếu bounds (titleBounds=null cả 2 phía) ===");
{
  const prev = computeViewportSignature([card("Unit A", null)], 3);
  const curr = computeViewportSignature([card("Unit A", null)], 3);
  // topYShift không tính được (null) NHƯNG cardIdentities+rawNodeCount giống hệt → vẫn là NO_PROGRESS
  // hợp lệ (bằng chứng từ 2 trục còn lại, không phải "không biết gì") - xem contract mục 4.
  report("Thiếu bounds nhưng identity+nodeCount giống hệt → NO_PROGRESS (không throw, không bịa)", compareSignatures(prev, curr) === "NO_PROGRESS");
}

console.log("\n=== [6] runSearchStateMachine - throw nếu thiếu maxScrolls (Blocker 2, không default ngầm) ===");
{
  let threw = false;
  try {
    await runSearchStateMachine({ hierarchy: async () => ({}), runSteps: async () => ({ success: true }) }, {
      target: { title: "x" },
      collectNodes: () => [],
      parseVisibleCards: () => ({ cards: [], parserState: {} }),
      matchesTarget: () => false,
      dedupIdentity: () => "x",
      // maxScrolls cố tình bỏ trống
    });
  } catch {
    threw = true;
  }
  report("Thiếu maxScrolls → throw TypeError ngay (không âm thầm dùng giá trị đoán)", threw);
}

function nodesFromTexts(texts, section = "Bài tập về nhà") {
  return texts.map((text, i) => ({ text, bounds: { x1: 84, y1: i * 50, x2: 996, y2: i * 50 + 40 } }));
}
function treeFromNodes(nodes) {
  return {
    attributes: { scrollable: "true" },
    children: nodes.map((n) => ({
      attributes: { text: n.text, bounds: `[${n.bounds.x1},${n.bounds.y1}][${n.bounds.x2},${n.bounds.y2}]` },
      children: [],
    })),
  };
}
function makeStaticBridge(treeSequence) {
  let idx = 0;
  return {
    async hierarchy() {
      return treeSequence[Math.min(idx, treeSequence.length - 1)];
    },
    async runSteps(steps) {
      if (steps.some((s) => s && typeof s === "object" && "swipe" in s)) {
        idx = Math.min(idx + 1, treeSequence.length - 1);
      }
      return { success: true };
    },
  };
}

console.log('\n=== [7] Integration findAssignment() qua engine - target xuất hiện SAU 1 lượt cuộn ===');
{
  const notYet = treeFromNodes(nodesFromTexts(["Bài tập về nhà", "Unit X - khác", "0 / 5", "Hạn nộp 20/08", "Làm bài"]));
  const found = treeFromNodes(nodesFromTexts(["Bài tập về nhà", "Unit Target", "0 / 5", "Hạn nộp 20/08", "Làm bài"]));
  const bridge = makeStaticBridge([notYet, found]);
  const result = await findAssignment(bridge, { title: "Unit Target", cta: "Làm bài" }, { maxScrolls: 5 });
  report("findAssignment() tìm thấy đúng target sau khi cuộn qua engine mới", result.status === "FOUND" && result.card?.title === "Unit Target", `status=${result.status}`);
}

console.log("\n=== [8] Integration findAssignment() qua engine - target KHÔNG tồn tại → PROGRESS_STALLED ===");
{
  const staticTree = treeFromNodes(nodesFromTexts(["Bài tập về nhà", "Unit Khac", "0 / 5", "Hạn nộp 20/08", "Làm bài"]));
  const bridge = makeStaticBridge([staticTree]); // KHÔNG đổi qua các lượt swipe - plateau thật
  const result = await findAssignment(bridge, { title: "Unit Khong Ton Tai", cta: "Làm bài" }, { maxScrolls: 5 });
  report(
    "Target không tồn tại + list đứng yên → NOT_FOUND/PROGRESS_STALLED (KHÔNG đoán APP_FROZEN/END_OF_LIST)",
    result.status === "NOT_FOUND" && result.reason === "PROGRESS_STALLED",
    `status=${result.status} reason=${result.reason}`,
  );
}

console.log("\n=== [9] Integration findAssignment() qua engine - MAX_SCROLLS_REACHED tách biệt PROGRESS_STALLED (PHASE 2: fixture SỬA để có overlap thật) ===");
{
  // PHASE 2 (2026-10-06): bản Phase 1 dùng fixture "mỗi lượt 1 card HOÀN TOÀN KHÁC, 0 overlap" và
  // coi đó là "vẫn tiến triển thật mãi" - benchmark đã chứng minh 0-overlap KHÔNG còn là bằng chứng
  // tiến triển an toàn (xem test [2]/[2d]). Fixture SỬA LẠI dùng sliding-window CÓ overlap thật (mỗi
  // tree chung đúng 1 card với tree kế tiếp) - đây mới là kịch bản "tiến triển thật, xác minh được"
  // mà test MAX_SCROLLS_REACHED cần, không lẫn với trường hợp unverifiable ở test [9b] bên dưới.
  const slidingTrees = Array.from({ length: 5 }, (_, i) =>
    treeFromNodes(
      nodesFromTexts([
        "Bài tập về nhà",
        `Unit P${i}`, "0 / 5", "Hạn nộp 20/08", "Làm bài",
        `Unit P${i + 1}`, "0 / 5", "Hạn nộp 20/08", "Làm bài",
      ]),
    ),
  );
  const bridge = makeStaticBridge(slidingTrees);
  const result = await findAssignment(bridge, { title: "Unit Khong Bao Gio Xuat Hien" }, { maxScrolls: 2 });
  report(
    "Tiến triển thật CÓ overlap (xác minh được) nhưng hết maxScrolls → NOT_FOUND/MAX_SCROLLS_REACHED (KHÔNG map thành PROGRESS_STALLED)",
    result.status === "NOT_FOUND" && result.reason === "MAX_SCROLLS_REACHED",
    `status=${result.status} reason=${result.reason}`,
  );
}

console.log("\n=== [9b] Integration findAssignment() qua engine - tiến triển liên tục nhưng KHÔNG BAO GIỜ overlap → PROGRESS_STALLED (hành vi MỚI, Phase 2) ===");
{
  // Đây CHÍNH LÀ fixture gốc của test [9] cũ (mỗi lượt 1 card hoàn toàn khác, 0 overlap bao giờ).
  // Expectation CŨ ("phải là MAX_SCROLLS_REACHED") dựa trên giả định đã benchmark chứng minh SAI (0-
  // overlap = an toàn). Hành vi ĐÚNG sau Phase 2: không thể phân biệt "tiến triển thật không overlap"
  // với "đã bỏ sót nội dung giữa 2 lần đọc" bằng công cụ hiện có (2 gesture cùng khoảng cách Y) - nên
  // phải dừng lại trung thực ở PROGRESS_STALLED thay vì tự tin cuộn tiếp qua khoảng tối (xem
  // compareSignatures() docblock, assignmentSearchBenchmark.mjs mục Recommendation).
  const trees = Array.from({ length: 3 }, (_, i) =>
    treeFromNodes(nodesFromTexts(["Bài tập về nhà", `Unit Progressing ${i}`, "0 / 5", "Hạn nộp 20/08", "Làm bài"])),
  );
  const bridge = makeStaticBridge(trees);
  const result = await findAssignment(bridge, { title: "Unit Khong Bao Gio Xuat Hien" }, { maxScrolls: 5 });
  report(
    "Tiến triển liên tục nhưng KHÔNG BAO GIỜ overlap → NOT_FOUND/PROGRESS_STALLED (KHÔNG đoán an toàn, KHÔNG map thành MAX_SCROLLS_REACHED giả)",
    result.status === "NOT_FOUND" && result.reason === "PROGRESS_STALLED",
    `status=${result.status} reason=${result.reason}`,
  );
}

console.log('\n=== [10] Integration locateSpecificCompletedCandidate() - titleBounds MỚI khả dụng (Blocker 1) ===');
{
  const tree = treeFromNodes(nodesFromTexts(["Bài tập về nhà", "Unit Done", "3 / 5", "Điểm 6", "Xem bài đã làm", "Làm lại"]));
  const bridge = makeStaticBridge([tree, tree]); // scrollToTop() gọi runSteps() 1 lần trước (không phải swipe) - không advance idx
  const result = await locateSpecificCompletedCandidate(bridge, "Unit Done", { maxScrolls: 5 });
  const found = result.candidates[0];
  report(
    "locateSpecificCompletedCandidate() tìm thấy card, ambiguous=false, và card CÓ titleBounds (Blocker 1 fix)",
    result.ambiguous === false && Boolean(found) && found.titleBounds != null && typeof found.titleBounds.y1 === "number",
    JSON.stringify({ ambiguous: result.ambiguous, titleBounds: found?.titleBounds }),
  );
}

console.log("\n=== [11] Integration locateSpecificCompletedCandidate() - AMBIGUOUS (2 card cùng title, KHÔNG truyền expectedScore) ===");
{
  const tree = treeFromNodes(
    nodesFromTexts([
      "Bài tập về nhà",
      "Unit Duplicate",
      "3 / 5",
      "Điểm 6",
      "Xem bài đã làm",
      "Làm lại",
      "Unit Duplicate",
      "4 / 5",
      "Điểm 8",
      "Xem bài đã làm",
      "Làm lại",
    ]),
  );
  const bridge = makeStaticBridge([tree]);
  const result = await locateSpecificCompletedCandidate(bridge, "Unit Duplicate", { maxScrolls: 5 });
  report(
    "2 card cùng title, identity không đủ phân biệt → ambiguous=true, candidates.length===2 (KHÔNG tự chọn candidate đầu)",
    result.ambiguous === true && result.candidates.length === 2,
    JSON.stringify(result.candidates.map((c) => c.scoreText)),
  );
}

console.log("\n=== [12] Integration locateSpecificCompletedCandidate() - duplicate title NHƯNG expectedScore phân biệt được ===");
{
  const tree = treeFromNodes(
    nodesFromTexts([
      "Bài tập về nhà",
      "Unit Duplicate",
      "3 / 5",
      "Điểm 6",
      "Xem bài đã làm",
      "Làm lại",
      "Unit Duplicate",
      "4 / 5",
      "Điểm 8",
      "Xem bài đã làm",
      "Làm lại",
    ]),
  );
  const bridge = makeStaticBridge([tree]);
  const result = await locateSpecificCompletedCandidate(bridge, "Unit Duplicate", { maxScrolls: 5, expectedScore: 8 });
  report(
    "expectedScore=8 phân biệt đúng 1/2 card trùng title → ambiguous=false, FOUND đúng card điểm 8",
    result.ambiguous === false && result.candidates.length === 1 && result.candidates[0].scoreText === "Điểm 8",
    JSON.stringify(result.candidates.map((c) => c.scoreText)),
  );
}

console.log("\n=== [13] Regression Case E (yêu cầu Phase 2 mục 7) - danh sách tổng hợp 30/50/100 card, overlap thật (sliding window), target giữa/gần cuối/cuối list ===");
{
  // Khác bridge tĩnh ở trên (treeSequence cố định) - bridge NÀY render ĐÚNG 1 "viewport" tổng hợp theo
  // vị trí cuộn hiện tại (cardsPerViewport=3, revealPerSwipe=2 -> 1 card overlap/swipe, AN TOÀN theo
  // đúng tinh thần Phase 2: tiến triển có xác minh được, KHÔNG phải zero-overlap như geometry thật
  // của device hôm nay - test này xác nhận engine ĐÃ SỬA vẫn tìm được target SÂU trong list lớn KHI
  // có overlap, không bị chính fix Phase 2 làm hỏng khả năng tìm xa vốn có).
  function buildOverlappingListBridge(totalCards, { cardsPerViewport = 3, revealPerSwipe = 2 } = {}) {
    let scrollIdx = 0;
    const maxStart = Math.max(0, totalCards - cardsPerViewport);
    return {
      async hierarchy() {
        const start = Math.min(scrollIdx * revealPerSwipe, maxStart);
        const texts = ["Bài tập về nhà"];
        for (let i = start; i < Math.min(start + cardsPerViewport, totalCards); i++) {
          texts.push(`Synthetic Card ${i}`, "0 / 5", "Hạn nộp 20/08", "Làm bài");
        }
        return treeFromNodes(nodesFromTexts(texts));
      },
      async runSteps(steps) {
        if (steps.some((s) => s && typeof s === "object" && "swipe" in s)) scrollIdx++;
        return { success: true };
      },
    };
  }

  for (const totalCards of [30, 50, 100]) {
    for (const [label, frac] of [
      ["giữa list", 0.5],
      ["gần cuối list", 0.9],
      ["cuối list (final card)", 0.99],
    ]) {
      const targetIdx = Math.min(totalCards - 1, Math.max(0, Math.round(totalCards * frac)));
      const bridge = buildOverlappingListBridge(totalCards);
      const result = await findAssignment(bridge, { title: `Synthetic Card ${targetIdx}`, cta: "Làm bài" }, { maxScrolls: 60 });
      report(
        `total=${totalCards} target=${label} (idx ${targetIdx}) → FOUND (overlap thật, không bị skip)`,
        result.status === "FOUND" && result.card?.title === `Synthetic Card ${targetIdx}`,
        `status=${result.status} scrollCount=${result.scrollCount}`,
      );
    }
  }
}

console.log(`\n=== KẾT QUẢ: ${failures === 0 ? "PASS" : "FAIL"} (${passes} pass / ${failures} fail) ===`);
process.exit(failures === 0 ? 0 : 1);
