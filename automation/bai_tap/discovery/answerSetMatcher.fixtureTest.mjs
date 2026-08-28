#!/usr/bin/env node
/**
 * Fixture test cho automation/bai_tap/discovery/answerSetMatcher.js (2026-08-28, content-aware
 * disambiguation) - CHỈ gọi hàm THUẦN đã export (không bridge/network/device thật). Bao phủ đúng 5
 * case theo yêu cầu review:
 *   A. answer-set unique -> match bình thường (fast path không đổi, regression-safe).
 *   B. nhiều câu cùng answer-set nhưng question text khác -> chọn đúng candidate (fix chính).
 *   C. nhiều câu cùng answer-set + text không đủ phân biệt -> AMBIGUOUS (không đoán).
 *   D. không có candidate nào -> NO_MATCH.
 *   E. regression case project_teacher_materials_examid_order_mismatch (word-bank 4 câu cùng đáp
 *      án, câu hỏi CÓ nội dung phân biệt được) - không được silently match sai / không được vẫn
 *      AMBIGUOUS nếu nội dung đủ rõ để phân biệt.
 *
 * Chạy: node automation/bai_tap/discovery/answerSetMatcher.fixtureTest.mjs
 */

import {
  normalizeAnswerText,
  buildNormalizedVisibleSet,
  findFullAnswerSetMatches,
  normalizeQuestionTokens,
  disambiguateByQuestionText,
  findMatchingQuestion,
} from "./answerSetMatcher.js";

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

function q(id, { answers, correctAnswer, question = `Q-${id}`, point = 1 }) {
  return { id, answers, correctAnswer, question, metadata: { point } };
}

/** Cây hierarchy tối giản chỉ chứa các dòng text cho trước - đủ cho collectAllTexts()/isVisible()
 * (KHÔNG cần bounds/scrollable thật - findMatchingQuestion() không đọc bounds). */
function treeFromTexts(texts) {
  return { attributes: {}, children: texts.map((t) => ({ attributes: { text: t }, children: [] })) };
}

const staticBridge = (texts) => ({
  async hierarchy() {
    return treeFromTexts(texts);
  },
});

async function main() {
  console.log("=== [A] answer-set unique -> match bình thường (fast path, regression-safe) ===");
  {
    const unique = q("u1", { answers: ["Cat", "Dog", "Bird"], correctAnswer: "Cat", question: "Which animal says meow?" });
    const other = q("u2", { answers: ["Red", "Blue"], correctAnswer: "Red" });
    const texts = ["Which animal says meow?", "Cat", "Dog", "Bird"];
    const r = await findMatchingQuestion(staticBridge(texts), [unique, other], undefined, 1, null);
    report("[A1] MATCHED đúng candidate unique", r.status === "MATCHED" && r.question.id === "u1", JSON.stringify(r.status));

    // Fast path: ngay cả khi question text KHÔNG khớp gì (vd stem generic), unique answer-set vẫn
    // đủ để MATCHED - không được vô tình siết chặt thêm điều kiện text cho case fullMatches.length===1.
    const genericStem = q("u3", { answers: ["Foo", "Bar"], correctAnswer: "Foo", question: "Choose the correct answer." });
    const r2 = await findMatchingQuestion(staticBridge(["Foo", "Bar"]), [genericStem], undefined, 2, null);
    report("[A2] fast path không bị siết bởi text khi chỉ có 1 full-match", r2.status === "MATCHED" && r2.question.id === "u3", JSON.stringify(r2.status));
  }

  console.log("=== [B] nhiều câu cùng answer-set, question text KHÁC -> chọn đúng candidate ===");
  {
    const b1 = q("b1", {
      answers: ["cycling", "flying a kite", "playing badminton", "playing volleyball"],
      correctAnswer: "cycling",
      question: "Don't ___ your pimples, it will get worse.",
    });
    const b2 = q("b2", {
      answers: ["cycling", "flying a kite", "playing badminton", "playing volleyball"],
      correctAnswer: "playing badminton",
      question: "My brother enjoys ___ every weekend at the park near our house.",
    });
    const b3 = q("b3", {
      answers: ["cycling", "flying a kite", "playing badminton", "playing volleyball"],
      correctAnswer: "flying a kite",
      question: "On windy days, children love ___ in the open field.",
    });
    // màn hình đang hiển thị ĐÚNG câu b2 (đoạn văn dẫn đề trải nhiều text node, khác hẳn b1/b3).
    const texts = [
      "My brother enjoys",
      "every weekend at the park near our house.",
      "cycling", "flying a kite", "playing badminton", "playing volleyball",
    ];
    const disambig = disambiguateByQuestionText([b1, b2, b3], texts);
    report(
      "[B1] disambiguateByQuestionText chọn đúng winner theo nội dung câu hỏi",
      disambig.status === "MATCHED" && disambig.winner.id === "b2",
      JSON.stringify({ status: disambig.status, scores: disambig.scores.map((s) => ({ id: s.question.id, coverage: s.coverage })) }),
    );

    const r = await findMatchingQuestion(staticBridge(texts), [b1, b2, b3], undefined, 1, null);
    report("[B2] findMatchingQuestion() end-to-end chọn đúng b2 (không first-fit b1)", r.status === "MATCHED" && r.question.id === "b2", JSON.stringify(r.status));

    // Đảo thứ tự pool - winner phải KHÔNG phụ thuộc vị trí trong mảng (không phải first-fit trá hình).
    const rReordered = await findMatchingQuestion(staticBridge(texts), [b3, b2, b1], undefined, 1, null);
    report("[B3] kết quả không phụ thuộc thứ tự pool", rReordered.status === "MATCHED" && rReordered.question.id === "b2");
  }

  console.log("=== [C] nhiều câu cùng answer-set + text KHÔNG đủ phân biệt -> AMBIGUOUS ===");
  {
    // Case C1: cả 2 câu đều CÓ question text nhưng đoạn dẫn đề không hiển thị gì trên màn hình
    // (chỉ answer options hiển thị) - không đủ dữ liệu để phân biệt.
    const c1 = q("c1", { answers: ["X", "Y", "Z"], correctAnswer: "X", question: "This is the first distinct passage about apples and oranges." });
    const c2 = q("c2", { answers: ["X", "Y", "Z"], correctAnswer: "Y", question: "This is the second distinct passage about bananas and grapes." });
    const textsNoPassage = ["X", "Y", "Z"]; // chỉ đáp án, không có dòng nào của đoạn văn nào cả.
    const rNoPassage = await findMatchingQuestion(staticBridge(textsNoPassage), [c1, c2], undefined, 1, null);
    report("[C1] AMBIGUOUS khi không có text nào của đoạn văn hiển thị", rNoPassage.status === "AMBIGUOUS");

    // Case C2: question text quá ngắn/generic (như "Q-id" mặc định) - không đủ token nội dung.
    const c3 = q("c3", { answers: ["Yes", "No"], correctAnswer: "Yes", question: "Q-c3" });
    const c4 = q("c4", { answers: ["Yes", "No"], correctAnswer: "No", question: "Q-c4" });
    const rGeneric = await findMatchingQuestion(staticBridge(["Yes", "No"]), [c3, c4], undefined, 1, null);
    report("[C2] AMBIGUOUS khi question text quá ngắn để tin cậy (< MIN_CONTENT_TOKENS)", rGeneric.status === "AMBIGUOUS");

    // Case C3: 2 candidate có coverage GẦN BẰNG NHAU (không đủ margin) dù cả 2 đều "có vẻ" khớp
    // 1 phần - vd đoạn văn của cả 2 đều nhắc tới đúng những từ chung chung giống nhau.
    const c5 = q("c5", { answers: ["A", "B"], correctAnswer: "A", question: "Read the passage below about summer holiday activities carefully." });
    const c6 = q("c6", { answers: ["A", "B"], correctAnswer: "B", question: "Read the passage below about winter holiday activities carefully." });
    const textsAmbiguousOverlap = ["passage", "below", "holiday", "activities", "carefully", "A", "B"];
    const rCloseScore = await findMatchingQuestion(staticBridge(textsAmbiguousOverlap), [c5, c6], undefined, 1, null);
    report(
      "[C3] AMBIGUOUS khi 2 candidate có coverage quá gần nhau (thiếu margin)",
      rCloseScore.status === "AMBIGUOUS",
      JSON.stringify(rCloseScore.diagnostic?.questionTextScores),
    );
  }

  console.log("=== [D] không có candidate nào khớp -> NO_MATCH ===");
  {
    const d1 = q("d1", { answers: ["Alpha", "Beta"], correctAnswer: "Alpha", question: "Unrelated question one." });
    const d2 = q("d2", { answers: ["Gamma", "Delta"], correctAnswer: "Gamma", question: "Unrelated question two." });
    const textsElsewhere = ["Something", "Else", "Entirely"]; // không đáp án nào hiển thị, không partial.
    const rNone = await findMatchingQuestion(staticBridge(textsElsewhere), [d1, d2], undefined, 1, null);
    report("[D1] NO_MATCH khi không candidate nào lộ dù 1 phần đáp án (và không phải image-grid)", rNone.status === "NO_MATCH");

    // partial-only: >=2 đáp án của 1 candidate lộ ra nhưng chưa đủ hết -> vẫn NO_MATCH (không đoán).
    const d3 = q("d3", { answers: ["One", "Two", "Three", "Four"], correctAnswer: "One" });
    const rPartial = await findMatchingQuestion(staticBridge(["One", "Two"]), [d3], undefined, 1, null);
    report("[D2] NO_MATCH khi partial-only (2/4 đáp án lộ, chưa đủ hết)", rPartial.status === "NO_MATCH");
  }

  console.log("=== [E] regression project_teacher_materials_examid_order_mismatch (word-bank, 4 câu cùng đáp án) ===");
  {
    // Tái hiện đúng case live 2026-08-26/2026-08-28: N câu dùng chung 1 bộ đáp án dạng "word bank",
    // MỖI câu có 1 câu dẫn đề (fill-in-the-blank) riêng biệt, đủ nội dung để phân biệt.
    const bank = ["build", "affect", "pop", "avoid"];
    const e1 = q("e1", { answers: bank, correctAnswer: "avoid", question: "Don't ___ your pimples, it will get worse and leave scars." });
    const e2 = q("e2", { answers: bank, correctAnswer: "build", question: "Workers ___ a new bridge across the river last year." });
    const e3 = q("e3", { answers: bank, correctAnswer: "affect", question: "Loud noise can ___ your ability to concentrate on studying." });
    const e4 = q("e4", { answers: bank, correctAnswer: "pop", question: "Children love to ___ balloons at birthday parties." });
    const pool = [e1, e2, e3, e4];

    // Màn hình đang hiển thị ĐÚNG câu e3.
    const textsE3 = ["Loud noise can", "your ability to concentrate on studying.", ...bank];
    const rE3 = await findMatchingQuestion(staticBridge(textsE3), pool, undefined, 3, { roomExamId: "real", candidateExamId: "catalog" });
    report("[E1] chọn đúng câu e3 đang hiển thị (không mis-score sang e1/e2/e4)", rE3.status === "MATCHED" && rE3.question.id === "e3", JSON.stringify(rE3.status));

    // Đổi màn hình sang câu e1 - PHẢI đổi theo, không dính lại kết quả trước (no stale state).
    const textsE1 = ["Don't", "your pimples, it will get worse and leave scars.", ...bank];
    const rE1 = await findMatchingQuestion(staticBridge(textsE1), pool, undefined, 1, { roomExamId: "real", candidateExamId: "catalog" });
    report("[E2] chọn đúng câu e1 khi màn hình đổi sang câu khác", rE1.status === "MATCHED" && rE1.question.id === "e1");

    // Trường hợp THẬT đã gặp live (2026-08-26/28): câu dẫn đề KHÔNG đủ phân biệt (vd bị cắt cụt/
    // giống hệt nhau) - vẫn phải AMBIGUOUS, không được ép MATCHED chỉ vì "có vẻ tốt hơn nhiều so
    // với retry cũ". Ở đây mô phỏng bằng cách không hiển thị dòng nào của bất kỳ câu dẫn đề nào.
    const textsNone = [...bank];
    const rNone = await findMatchingQuestion(staticBridge(textsNone), pool, undefined, 2, { roomExamId: "real", candidateExamId: "catalog" });
    report("[E3] vẫn AMBIGUOUS nếu không có đoạn dẫn đề nào hiển thị (an toàn, không đoán)", rNone.status === "AMBIGUOUS");
  }

  console.log("=== helper unit tests (normalize/tokenize) ===");
  {
    report("normalizeAnswerText chuẩn hoá khoảng trắng + hoa/thường", normalizeAnswerText("  Cycling  ") === normalizeAnswerText("cycling"));
    report(
      "normalizeQuestionTokens loại placeholder + stopword + token quá ngắn",
      JSON.stringify(normalizeQuestionTokens("Don't ___ your pimples, it will get worse.")) === JSON.stringify(["don", "pimples", "will", "get", "worse"]),
      JSON.stringify(normalizeQuestionTokens("Don't ___ your pimples, it will get worse.")),
    );
    const set = buildNormalizedVisibleSet(["  Cat ", "DOG"]);
    report("buildNormalizedVisibleSet dùng chung normalize", set.has("cat") && set.has("dog"));
    const { matches } = findFullAnswerSetMatches(
      [q("f1", { answers: ["A", "B"], correctAnswer: "A" }), q("f2", { answers: ["A", "C"], correctAnswer: "A" })],
      buildNormalizedVisibleSet(["A", "B"]),
    );
    report("findFullAnswerSetMatches chỉ trả candidate khớp ĐỦ (f1, không f2)", matches.length === 1 && matches[0].id === "f1");
  }

  console.log(`\n${passes} passed, ${failures} failed.`);
  if (failures > 0) process.exitCode = 1;
}

main();
