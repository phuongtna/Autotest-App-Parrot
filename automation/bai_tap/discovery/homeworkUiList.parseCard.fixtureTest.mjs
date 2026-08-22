#!/usr/bin/env node
/**
 * Regression fixture cho bug THẬT đã xác nhận (2026-08-22, live device, room
 * 19e78018-8c11-48e9-845f-efefe4dff82f): `parseHomeworkCardsWithDetail()`/`parseHomeworkCardsFromTexts()`
 * (automation/bai_tap/discovery/homeworkUiList.js) LOẠI BỎ VĨNH VIỄN 1 card ĐÃ HOÀN THÀNH có CẢ 2
 * dòng phụ liên tiếp "N / M" (câu đúng/tổng) VÀ "Điểm N" - card thật "G3-U2-Lesson 2: Read and tick
 * True or False" (title -> "3/5" -> "Điểm 6" -> "Xem bài đã làm" -> "Làm lại") KHÔNG BAO GIỜ xuất
 * hiện trong kết quả parse, BẤT KỂ cuộn bao nhiêu - đã tưởng nhầm là lỗi biên độ cuộn (ĐÃ REVERT,
 * xem git log/comment cũ), thực ra là lỗi parse THUẦN, không liên quan gì tới cuộn/scroll.
 *
 * ROOT CAUSE: vòng lookahead tìm CTA break vô điều kiện khi gặp 1 dòng khớp PROGRESS_PATTERN/
 * SCORE_PATTERN, coi đó là "đã sang card kế tiếp" - SAI khi dòng đó là dòng phụ THỨ 2 của CHÍNH
 * card đang xét (progress rồi score, không có title chen giữa). FIX: chỉ break khi dòng NGAY TRƯỚC
 * anchor mới gặp là 1 title-thường (không phải anchor) - đúng bất biến "title luôn đứng ngay trước
 * anchor của NÓ" (docblock đầu homeworkUiList.js).
 *
 * Test cả 2 hàm dùng chung logic (parseHomeworkCardsWithDetail - dùng bởi findAssignment.js/
 * target5.mjs; parseHomeworkCardsFromTexts - dùng bởi collectVisibleHomeworkCards()) qua 5 cấu
 * trúc card (A-E theo yêu cầu) + case card thật 1:1 + integration test với findAssignment() thật.
 *
 * Chạy: node automation/bai_tap/discovery/homeworkUiList.parseCard.fixtureTest.mjs
 */

import { parseHomeworkCardsFromTexts, parseHomeworkCardsWithDetail } from "./homeworkUiList.js";
import { findAssignment } from "./findAssignment.js";

const SECTION = "Bài tập về nhà";

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

function boundsFor(index) {
  // Bounds giả định đơn điệu tăng theo thứ tự node - đủ cho parseHomeworkCardsWithDetail() (chỉ
  // cần bounds tồn tại/khác nhau, không cần đúng hình học thật cho fixture parse thuần này).
  return { x1: 84, y1: index * 50, x2: 996, y2: index * 50 + 40 };
}

function nodesFromTexts(texts) {
  return texts.map((text, i) => ({ text, bounds: boundsFor(i) }));
}

console.log("=== [A] Chưa làm: title -> N/M -> Hạn nộp -> Làm bài ===");
{
  const texts = [SECTION, "Unit A - Bài 1", "0 / 5", "Hạn nộp 20/08", "Làm bài"];
  const r1 = parseHomeworkCardsFromTexts(texts);
  report("parseHomeworkCardsFromTexts tìm đúng 1 card, cta=Làm bài", r1.cards.length === 1 && r1.cards[0].cta === "Làm bài", JSON.stringify(r1.cards));
  const r2 = parseHomeworkCardsWithDetail(nodesFromTexts(texts));
  report(
    "parseHomeworkCardsWithDetail tìm đúng 1 card, dueDate/cta đúng",
    r2.cards.length === 1 && r2.cards[0].dueDate === "Hạn nộp 20/08" && r2.cards[0].cta === "Làm bài",
    JSON.stringify(r2.cards),
  );
}

console.log("\n=== [B] Đang làm: title -> N/M -> Hạn nộp -> Tiếp tục ===");
{
  const texts = [SECTION, "Unit B - Bài 2", "2 / 5", "Hạn nộp 21/08", "Tiếp tục"];
  const r1 = parseHomeworkCardsFromTexts(texts);
  report("parseHomeworkCardsFromTexts tìm đúng 1 card, cta=Tiếp tục", r1.cards.length === 1 && r1.cards[0].cta === "Tiếp tục", JSON.stringify(r1.cards));
  const r2 = parseHomeworkCardsWithDetail(nodesFromTexts(texts));
  report(
    "parseHomeworkCardsWithDetail tìm đúng 1 card, dueDate/cta đúng",
    r2.cards.length === 1 && r2.cards[0].dueDate === "Hạn nộp 21/08" && r2.cards[0].cta === "Tiếp tục",
    JSON.stringify(r2.cards),
  );
}

console.log('\n=== [C] Đã hoàn thành: title -> N/M -> Điểm N -> "Xem bài đã làm" -> Làm lại ===');
{
  const texts = [SECTION, "Unit C - Bài 3", "3 / 5", "Điểm 6", "Xem bài đã làm", "Làm lại"];
  const r1 = parseHomeworkCardsFromTexts(texts);
  report(
    "parseHomeworkCardsFromTexts KHÔNG bỏ sót card hoàn thành (bug gốc)",
    r1.cards.length === 1 && r1.cards[0].cta === "Làm lại" && r1.cards[0].title === "Unit C - Bài 3",
    JSON.stringify(r1.cards),
  );
  const r2 = parseHomeworkCardsWithDetail(nodesFromTexts(texts));
  report(
    "parseHomeworkCardsWithDetail KHÔNG bỏ sót card hoàn thành + progress/score đúng giá trị",
    r2.cards.length === 1 &&
      r2.cards[0].cta === "Làm lại" &&
      r2.cards[0].dueDate === null &&
      r2.cards[0].progress === "3 / 5" &&
      r2.cards[0].score === "Điểm 6",
    JSON.stringify(r2.cards),
  );
}

console.log("\n=== [D] Hai card gần giống nhau liên tiếp (G3-U1 vs G3-U2, cùng hạn nộp) ===");
{
  const texts = [
    SECTION,
    "G3-U1-Lesson 2: Read and tick True or False",
    "0 / 5",
    "Hạn nộp 29/08",
    "Làm bài",
    "G3-U2-Lesson 2: Read and tick True or False",
    "0 / 5",
    "Hạn nộp 29/08",
    "Làm bài",
  ];
  const r1 = parseHomeworkCardsFromTexts(texts);
  report(
    "parseHomeworkCardsFromTexts tách đúng 2 card riêng biệt, đúng thứ tự title",
    r1.cards.length === 2 &&
      r1.cards[0].title === "G3-U1-Lesson 2: Read and tick True or False" &&
      r1.cards[1].title === "G3-U2-Lesson 2: Read and tick True or False",
    JSON.stringify(r1.cards),
  );
  const r2 = parseHomeworkCardsWithDetail(nodesFromTexts(texts));
  report(
    "parseHomeworkCardsWithDetail tách đúng 2 card riêng biệt (không lẫn dueDate/cta giữa 2 card)",
    r2.cards.length === 2 && r2.cards[0].title !== r2.cards[1].title && r2.cards.every((c) => c.dueDate === "Hạn nộp 29/08" && c.cta === "Làm bài"),
    JSON.stringify(r2.cards),
  );
}

console.log("\n=== [E] Card hoàn thành nằm cạnh card khác (cả 2 chiều thứ tự) ===");
{
  // E1: hoàn thành TRƯỚC, card thường SAU.
  const texts1 = [
    SECTION,
    "Unit E1 - Completed",
    "3 / 5",
    "Điểm 6",
    "Xem bài đã làm",
    "Làm lại",
    "Unit E1 - Pending",
    "0 / 4",
    "Hạn nộp 30/08",
    "Làm bài",
  ];
  const r1 = parseHomeworkCardsWithDetail(nodesFromTexts(texts1));
  report(
    "E1 (completed→pending): đúng 2 card, không lẫn cta/progress/score giữa 2 card",
    r1.cards.length === 2 &&
      r1.cards[0].title === "Unit E1 - Completed" &&
      r1.cards[0].cta === "Làm lại" &&
      r1.cards[0].score === "Điểm 6" &&
      r1.cards[1].title === "Unit E1 - Pending" &&
      r1.cards[1].cta === "Làm bài" &&
      r1.cards[1].score === null,
    JSON.stringify(r1.cards),
  );

  // E2: card thường TRƯỚC, hoàn thành SAU.
  const texts2 = [
    SECTION,
    "Unit E2 - Pending",
    "0 / 4",
    "Hạn nộp 30/08",
    "Làm bài",
    "Unit E2 - Completed",
    "3 / 5",
    "Điểm 6",
    "Xem bài đã làm",
    "Làm lại",
  ];
  const r2 = parseHomeworkCardsWithDetail(nodesFromTexts(texts2));
  report(
    "E2 (pending→completed): đúng 2 card, không lẫn cta/progress/score giữa 2 card",
    r2.cards.length === 2 &&
      r2.cards[0].title === "Unit E2 - Pending" &&
      r2.cards[0].cta === "Làm bài" &&
      r2.cards[1].title === "Unit E2 - Completed" &&
      r2.cards[1].cta === "Làm lại" &&
      r2.cards[1].score === "Điểm 6",
    JSON.stringify(r2.cards),
  );
}

console.log('\n=== [4] Regression đúng card thật "G3-U2-Lesson 2: Read and tick True or False" ===');
{
  const REAL_TITLE = "G3-U2-Lesson 2: Read and tick True or False";
  const texts = [SECTION, "G3-U1-Lesson 2: Read and tick True or False", "0 / 5", "Hạn nộp 29/08", "Làm bài", REAL_TITLE, "3 / 5", "Điểm 6", "Xem bài đã làm", "Làm lại"];
  const parsed = parseHomeworkCardsWithDetail(nodesFromTexts(texts));
  const card = parsed.cards.find((c) => c.title === REAL_TITLE);
  report(
    "parseHomeworkCardsWithDetail tìm thấy đúng card thật, progress=3/5, score=Điểm 6, cta=Làm lại",
    Boolean(card) && card.progress === "3 / 5" && card.score === "Điểm 6" && card.cta === "Làm lại",
    JSON.stringify(card),
  );

  // Integration: findAssignment() thật (KHÔNG viết lại) - card hiện diện ngay từ lượt đọc đầu tiên,
  // không cần mock scroll (chỉ cần bridge trả cùng 1 tree, đủ cho found ngay không cuộn).
  const tree = { attributes: { scrollable: "true" }, children: nodesFromTexts(texts).map((n) => ({ attributes: { text: n.text, bounds: `[${n.bounds.x1},${n.bounds.y1}][${n.bounds.x2},${n.bounds.y2}]` }, children: [] })) };
  const staticBridge = {
    async hierarchy() {
      return tree;
    },
    async runSteps() {
      return { success: true };
    },
  };
  const found = await findAssignment(staticBridge, { title: REAL_TITLE, cta: "Làm lại" }, { maxScrolls: 1 });
  report(`findAssignment() cũng tìm thấy đúng card thật (không nhầm sang "G3-U1...")`, found.status === "FOUND" && found.card?.title === REAL_TITLE, `status=${found.status}`);
}

console.log(`\n=== KẾT QUẢ: ${failures === 0 ? "PASS" : "FAIL"} (${passes} pass / ${failures} fail) ===`);
process.exit(failures === 0 ? 0 : 1);
