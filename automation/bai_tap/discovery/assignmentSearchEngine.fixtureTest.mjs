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

console.log("\n=== [2] compareSignatures - Case B: khác card, Y giống hệt → STRONG_PROGRESS ===");
{
  const prev = computeViewportSignature([card("Unit A", 100)], 5);
  const curr = computeViewportSignature([card("Unit B", 100)], 5); // topCard.title KHÁC, Y trùng ngẫu nhiên
  report("Case B (topCard đổi, Y trùng) → STRONG_PROGRESS (không xét Y khi card khác nhau)", compareSignatures(prev, curr) === "STRONG_PROGRESS");
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

console.log("\n=== [9] Integration findAssignment() qua engine - MAX_SCROLLS_REACHED tách biệt PROGRESS_STALLED ===");
{
  // Mỗi lượt hierarchy() trả 1 card MỚI (title đổi theo idx) - list "vẫn tiến triển thật" mãi, không
  // bao giờ plateau, nhưng target không nằm trong bất kỳ tree nào -> phải dừng vì maxScrolls, KHÔNG
  // phải vì "đứng yên".
  const trees = Array.from({ length: 3 }, (_, i) =>
    treeFromNodes(nodesFromTexts(["Bài tập về nhà", `Unit Progressing ${i}`, "0 / 5", "Hạn nộp 20/08", "Làm bài"])),
  );
  const bridge = makeStaticBridge(trees);
  const result = await findAssignment(bridge, { title: "Unit Khong Bao Gio Xuat Hien" }, { maxScrolls: 2 });
  report(
    "Vẫn tiến triển thật nhưng hết maxScrolls → NOT_FOUND/MAX_SCROLLS_REACHED (KHÔNG map thành PROGRESS_STALLED/END_OF_LIST)",
    result.status === "NOT_FOUND" && result.reason === "MAX_SCROLLS_REACHED",
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

console.log(`\n=== KẾT QUẢ: ${failures === 0 ? "PASS" : "FAIL"} (${passes} pass / ${failures} fail) ===`);
process.exit(failures === 0 ? 0 : 1);
