#!/usr/bin/env node
/**
 * Fixture test cho `parseOnThiCardsWithDetail()` (automation/on_thi/discovery/onThiUiList.js) +
 * `findDeThi()` (findDeThi.js) - KHÔNG CẦN THIẾT BỊ/APP THẬT, chỉ kiểm tra logic parse/tìm kiếm
 * trên dữ liệu text giả lập, CÙNG KIỂU với
 * `automation/bai_tap/discovery/homeworkUiList.parseCard.fixtureTest.mjs` (file đó test
 * `parseHomeworkCardsWithDetail()` qua 5 cấu trúc A-E + regression card thật).
 *
 * Đây là lớp kiểm chứng DUY NHẤT có thể chạy được trước khi có thiết bị thật để đối chiếu UI on_thi
 * (xem TEST-CASES.md: "CHƯA CHẠY THẬT LẦN NÀO") - verify rằng việc TÁI SỬ DỤNG
 * `runSearchStateMachine()` (assignmentSearchEngine.js, module Bài tập) với parser mới
 * (`parseOnThiCardsWithDetail`) hoạt động đúng cho các cấu trúc card con dựng lại THEO ĐÚNG mô tả
 * trong spec.json + ảnh mockup (không phải cấu trúc thật đã verify qua device như module Bài tập).
 *
 * Chạy: node automation/on_thi/discovery/onThiUiList.parseCard.fixtureTest.mjs
 */

import { parseOnThiCardsWithDetail } from "./onThiUiList.js";
import { findDeThi } from "./findDeThi.js";

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
  return { x1: 84, y1: index * 50, x2: 996, y2: index * 50 + 40 };
}

function nodesFromTexts(texts) {
  return texts.map((text, i) => ({ text, bounds: boundsFor(i) }));
}

console.log("=== [A] Đề chưa làm (0/y): title -> N/M -> Hạn nộp -> Làm bài ===");
{
  const texts = ["Đề kiểm tra 15 phút - Unit 4", "0 / 10", "Hạn nộp 09/10 (QUÁ HẠN)", "Làm bài"];
  const r = parseOnThiCardsWithDetail(nodesFromTexts(texts));
  report(
    "tìm đúng 1 đề, dueDate kèm (QUÁ HẠN), cta=Làm bài",
    r.cards.length === 1 && r.cards[0].dueDate === "Hạn nộp 09/10 (QUÁ HẠN)" && r.cards[0].cta === "Làm bài",
    JSON.stringify(r.cards),
  );
}

console.log("\n=== [B] Đề đang làm dở: title -> N/M -> Hạn nộp -> Làm tiếp ===");
{
  const texts = ["Đề kiểm tra giữa kỳ I - Unit 1-5", "8 / 30", "Hạn nộp 12/10", "Làm tiếp"];
  const r = parseOnThiCardsWithDetail(nodesFromTexts(texts));
  report(
    "tìm đúng 1 đề, progress=8/30, cta=Làm tiếp",
    r.cards.length === 1 && r.cards[0].progress === "8 / 30" && r.cards[0].cta === "Làm tiếp",
    JSON.stringify(r.cards),
  );
}

console.log('\n=== [C] Đề đã nộp: title -> N/M -> Điểm N -> "Xem bài đã làm" ===');
{
  const texts = ["Đề kiểm tra 15 phút - Unit 3", "8 / 10", "Điểm 8", "Xem bài đã làm"];
  const r = parseOnThiCardsWithDetail(nodesFromTexts(texts));
  report(
    "tìm đúng 1 đề, KHÔNG bỏ sót (theo đúng fix đã verify ở module Bài tập cho cấu trúc N/M + Điểm liền nhau), cta=Xem bài đã làm",
    r.cards.length === 1 && r.cards[0].score === "Điểm 8" && r.cards[0].progress === "8 / 10" && r.cards[0].cta === "Xem bài đã làm",
    JSON.stringify(r.cards),
  );
}

console.log("\n=== [D] Không có section-header nào đứng trước (SECTION_HEADERS chưa bắt buộc) ===");
{
  // Khác module Bài tập (card KHÔNG được nhận nếu chưa thấy section header) - on_thi CỐ TÌNH không
  // bắt buộc section-header (xem comment trong onThiUiList.js) vì CHƯA xác nhận màn thật có section
  // header hay không. Test này khẳng định đúng hành vi đã chọn: card vẫn được nhận dù không có
  // header nào đứng trước.
  const texts = ["Đề thi 14", "0 / 5", "Hạn nộp 31/10", "Làm bài"];
  const r = parseOnThiCardsWithDetail(nodesFromTexts(texts));
  report("card được nhận dù KHÔNG có section-header đứng trước", r.cards.length === 1 && r.cards[0].title === "Đề thi 14", JSON.stringify(r.cards));
}

console.log("\n=== [E] Hai đề liên tiếp cùng Hạn nộp (collision - giống bug thật đã log Jira) ===");
{
  const texts = [
    "Đề giao 2 tuần",
    "0 / 15",
    "Hạn nộp 26/10 (QUÁ HẠN)",
    "Làm bài",
    "Đề luyện tập Unit 2: Health - Listening and Speaking Practice, Pronunciation, Vocabulary and Grammar",
    "0 / 10",
    "Hạn nộp 26/10 (QUÁ HẠN)",
    "Làm bài",
  ];
  const r = parseOnThiCardsWithDetail(nodesFromTexts(texts));
  report(
    "tách đúng 2 đề riêng biệt dù trùng Hạn nộp",
    r.cards.length === 2 && r.cards[0].title === "Đề giao 2 tuần" && r.cards[1].title.startsWith("Đề luyện tập Unit 2"),
    JSON.stringify(r.cards.map((c) => c.title)),
  );
}

console.log('\n=== [F] Integration: findDeThi() thật (không mock lại logic) trên tree 3-đề giống ảnh app thật ===');
{
  const texts = [
    "Đề thi 14",
    "0 / 5",
    "Hạn nộp 31/10",
    "Làm bài",
    "Đề giao 2 tuần",
    "0 / 15",
    "Hạn nộp 26/10 (QUÁ HẠN)",
    "Làm bài",
    "Đề luyện tập Unit 2: Health - Listening and Speaking Practice, Pronunciation, Vocabulary and Grammar",
    "0 / 10",
    "Hạn nộp 26/10 (QUÁ HẠN)",
    "Làm bài",
  ];
  const nodes = nodesFromTexts(texts);
  const tree = {
    attributes: { scrollable: "true" },
    children: nodes.map((n) => ({ attributes: { text: n.text, bounds: `[${n.bounds.x1},${n.bounds.y1}][${n.bounds.x2},${n.bounds.y2}]` }, children: [] })),
  };
  const staticBridge = {
    async hierarchy() {
      return tree;
    },
    async runSteps() {
      return { success: true };
    },
  };
  const found = await findDeThi(staticBridge, { title: "Đề giao 2 tuần", dueDateDM: "26/10" }, { maxScrolls: 1 });
  report(
    `findDeThi() tìm đúng "Đề giao 2 tuần" (không nhầm sang đề Unit 2 cùng Hạn nộp)`,
    found.status === "FOUND" && found.card?.title === "Đề giao 2 tuần",
    `status=${found.status}`,
  );

  const ambiguousCheck = await findDeThi(staticBridge, { title: "Không tồn tại" }, { maxScrolls: 1 });
  report(`findDeThi() trả NOT_FOUND cho title không tồn tại (không FOUND nhầm)`, ambiguousCheck.status === "NOT_FOUND", `status=${ambiguousCheck.status}`);
}

console.log(`\n=== KẾT QUẢ: ${failures === 0 ? "PASS" : "FAIL"} (${passes} pass / ${failures} fail) ===`);
process.exit(failures === 0 ? 0 : 1);
