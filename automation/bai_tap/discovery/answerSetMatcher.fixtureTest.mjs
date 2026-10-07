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
 *   F. regression case 2026-09-01 (room 22a98ee4-..., "G3-U18-Lesson 2: Read and tick True or
 *      False") - 5 câu con True/False dùng CHUNG 1 đoạn văn dẫn đề hiển thị NGUYÊN VẸN cho mọi câu
 *      con (đoạn văn liệt kê từ vựng của CẢ 5 câu), cộng 1 dòng phát biểu riêng ngắn đứng NGAY
 *      TRƯỚC 2 nút True/False - coverage-toàn-trang cũ cho mọi candidate điểm cao gần bằng nhau (vì
 *      đoạn văn chung chứa từ vựng của tất cả) nên luôn AMBIGUOUS dù dòng phát biểu riêng thừa sức
 *      phân biệt - xem disambiguateByQuestionText() (cửa sổ dòng ngay trước block đáp án).
 *   G. regression THẬT 2026-09-14 (room bd376b39-87a7-4082-8742-d639548b495c, lớp 8D, "Choose the
 *      word that has a different stress pattern from the others.") - 2/10 câu single-choice trùng
 *      CẢ answer-set LẪN question text (bài "odd one out" mọi câu con dùng chung ĐÚNG 1 câu dẫn đề)
 *      -> AMBIGUOUS ĐÚNG (reasonCode=NO_CANDIDATE_MEETS_THRESHOLD), không có tín hiệu nào (CMS lẫn
 *      UI) để phân biệt 2 câu này - xem answerSetMatcher.js AMBIGUOUS branch (comment 2026-09-14).
 *   H. tied score tường minh - winner đạt ngưỡng MIN_MATCH_COVERAGE nhưng KHÔNG bỏ xa runner-up đủ
 *      MIN_MARGIN_OVER_RUNNER_UP -> AMBIGUOUS (reasonCode=INSUFFICIENT_MARGIN_OVER_RUNNER_UP, khác
 *      hẳn case G/C là NO_CANDIDATE_MEETS_THRESHOLD - phân biệt 2 nguyên nhân AMBIGUOUS khác nhau).
 *   I. normalization differences (hoa/thường, khoảng trắng thừa giữa text UI thật và CMS) - vẫn phải
 *      MATCH đúng, không được tụt xuống AMBIGUOUS/NO_MATCH oan chỉ vì khác cách trình bày.
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
  buildSharedAnswerTokenSet,
} from "./answerSetMatcher.js";
import { decideAnswerAction } from "../navigation/homeworkExamEngine.js";

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

  console.log('=== [F] regression 2026-09-01 (True/False group-passage, room 22a98ee4-...) ===');
  {
    const f1 = q("f1", { answers: ["True", "False"], correctAnswer: "True", question: "Today is Club Day." });
    const f2 = q("f2", { answers: ["True", "False"], correctAnswer: "False", question: "The Reading Club is in the classroom." });
    const f3 = q("f3", { answers: ["True", "False"], correctAnswer: "True", question: "The Sports Club is playing basketball." });
    const f4 = q("f4", { answers: ["True", "False"], correctAnswer: "False", question: "The Art Club is drawing pictures in the schoolyard." });
    const f5 = q("f5", { answers: ["True", "False"], correctAnswer: "False", question: "The Music Club is dancing in the music room." });
    const pool = [f1, f2, f3, f4, f5];
    // Đoạn văn dẫn đề CHUNG (hiển thị y hệt cho cả 5 câu con) + dòng phát biểu riêng của câu "1/5"
    // đứng ngay trước 2 nút True/False - y hệt live capture thật (xem docblock đầu file).
    const passage =
      "Today is Club Day at school. The Music Club is singing and listening to music in the music room. " +
      "The Art Club is drawing pictures in the art room. In the playground, the Sports Club is playing " +
      "basketball because they like sports. In the library, the Reading Club is reading books. Everyone is happy and busy today.";
    const texts = ["G3-U18-Lesson 2: Read and tick True or False", "True or false", passage, "Xem thêm", "1/5", "Today is Club Day.", "True", "False", "Tiếp theo"];
    const disambig = disambiguateByQuestionText(pool, texts);
    report(
      "[F1] chọn đúng f1 (\"Today is Club Day.\") dù đoạn văn chung khiến mọi candidate đều có vẻ khớp",
      disambig.status === "MATCHED" && disambig.winner.id === "f1",
      JSON.stringify({ status: disambig.status, scores: disambig.scores.map((s) => ({ id: s.question.id, coverage: s.coverage })) }),
    );

    const texts2 = texts.slice(0, 5).concat(["The Sports Club is playing basketball.", "True", "False", "Tiếp theo"]);
    const disambig2 = disambiguateByQuestionText(pool, texts2);
    report("[F2] đổi dòng phát biểu riêng sang câu khác (f3) -> chọn đúng theo, không dính lại f1", disambig2.status === "MATCHED" && disambig2.winner.id === "f3");

    const r = await findMatchingQuestion(staticBridge(texts), pool, undefined, 1, null);
    report("[F3] findMatchingQuestion() end-to-end chọn đúng f1", r.status === "MATCHED" && r.question.id === "f1", JSON.stringify(r.status));
  }

  console.log("=== [G] regression THẬT 2026-09-14 (room bd376b39-..., lớp 8D, \"Choose the word that has a different stress pattern from the others.\") - 2 candidate trùng CẢ answer-set LẪN question text, không có tín hiệu nào phân biệt được ===");
  {
    const stem = "Choose the word that has a different stress pattern from the others.";
    // Dữ liệu THẬT lấy từ CMS room bd376b39-87a7-4082-8742-d639548b495c (2 trong 10 câu, id rút gọn).
    const g1 = q("g1_043d6cd2", { answers: ["important", "energy", "natural", "popular"], correctAnswer: "important", question: stem });
    const g2 = q("g2_bcbfa089", { answers: ["important", "popular", "natural", "energy"], correctAnswer: "important", question: stem });
    // Câu thứ 3 CÙNG stem nhưng answer-set KHÁC (unique) - xác nhận nó không bị lẫn vào candidate pool.
    const g3 = q("g3_1acf2a3c", { answers: ["attraction", "renewable", "energy", "important"], correctAnswer: "energy", question: stem });
    const texts = [stem, "energy", "important", "natural", "popular"];
    const r = await findMatchingQuestion(staticBridge(texts), [g1, g2, g3], undefined, 1, null);
    // g1/g2 có question text GIỐNG HỆT nhau (cùng stem) nên cả 2 đều đạt coverage=1.0 (EXACT) - đây là
    // tình huống "tied score ở mức tối đa" (winnerScore=runnerUpScore=1.0), đúng bản chất
    // INSUFFICIENT_MARGIN_OVER_RUNNER_UP (KHÔNG PHẢI NO_CANDIDATE_MEETS_THRESHOLD - cả 2 đều VƯỢT
    // ngưỡng dễ dàng, chỉ là không ai bỏ xa ai) - xác nhận matcher phân loại ĐÚNG bản chất bug, không
    // chỉ đơn thuần "không đủ nội dung".
    report(
      "[G1] AMBIGUOUS giữa g1/g2 (trùng cả answer-set lẫn question text, cả 2 đều coverage=1.0 tuyệt đối) - reasonCode=INSUFFICIENT_MARGIN_OVER_RUNNER_UP, KHÔNG đoán bừa",
      r.status === "AMBIGUOUS" &&
        r.diagnostic?.contentEvidence?.reasonCode === "INSUFFICIENT_MARGIN_OVER_RUNNER_UP" &&
        r.diagnostic?.contentEvidence?.winnerScore === 1 &&
        r.diagnostic?.contentEvidence?.runnerUpScore === 1,
      JSON.stringify({ status: r.status, reasonCode: r.diagnostic?.contentEvidence?.reasonCode, winnerScore: r.diagnostic?.contentEvidence?.winnerScore, runnerUpScore: r.diagnostic?.contentEvidence?.runnerUpScore }),
    );
    report(
      "[G2] contentEvidence.candidates CHỈ gồm đúng g1/g2 (answer-set trùng) - g3 (answer-set khác, dù chung stem) KHÔNG bị lẫn vào",
      r.diagnostic?.contentEvidence?.candidates?.length === 2 &&
        r.diagnostic.contentEvidence.candidates.every((c) => c.id === "g1_043d6cd2" || c.id === "g2_bcbfa089"),
      JSON.stringify(r.diagnostic?.contentEvidence?.candidates?.map((c) => c.id)),
    );
  }

  console.log("=== [H] tied score tường minh (winner đạt ngưỡng nhưng KHÔNG bỏ xa runner-up đủ margin) -> AMBIGUOUS/INSUFFICIENT_MARGIN_OVER_RUNNER_UP ===");
  {
    const h1 = q("h1", { answers: ["A", "B"], correctAnswer: "A", question: "Alpha bravo charlie delta echo foxtrot golf." });
    const h2 = q("h2", { answers: ["A", "B"], correctAnswer: "B", question: "Alpha bravo charlie delta echo hotel." });
    const texts = ["Alpha", "bravo", "charlie", "delta", "echo", "A", "B"];
    const r = await findMatchingQuestion(staticBridge(texts), [h1, h2], undefined, 1, null);
    report(
      "[H1] AMBIGUOUS khi winner/runner-up quá gần nhau (thiếu margin) dù winner đạt ngưỡng coverage",
      r.status === "AMBIGUOUS" && r.diagnostic?.contentEvidence?.reasonCode === "INSUFFICIENT_MARGIN_OVER_RUNNER_UP",
      JSON.stringify({ winnerScore: r.diagnostic?.contentEvidence?.winnerScore, runnerUpScore: r.diagnostic?.contentEvidence?.runnerUpScore }),
    );
  }

  console.log("=== [I] normalization differences (hoa/thường, khoảng trắng thừa giữa UI thật và CMS) vẫn khớp đúng ở tầng answer-set matching ===");
  {
    // Test Ở ĐÚNG TẦNG đang sửa (answer-set matching/disambiguation, findFullAnswerSetMatches +
    // disambiguateByQuestionText trong answerSetMatcher.js) - KHÔNG qua findMatchingQuestion() end-to-
    // end (decideAnswerAction() cần cấu trúc tappable element thật, ngoài phạm vi fixture thuần-text
    // này, và ngoài phạm vi sửa lần này - xem questionTypeDetector.js/homeworkExamEngine.js riêng).
    const i1 = q("i1", { answers: ["Ha Noi", "Ho Chi Minh"], correctAnswer: "Ha Noi", question: "What is the capital city of Vietnam?" });
    const i2 = q("i2", { answers: ["Paris", "London"], correctAnswer: "Paris", question: "What is the capital city of France?" });
    // UI thật thường lệch hoa/thường + khoảng trắng so với CMS (rendering khác nhau) - KHÔNG được vì
    // vậy mà tụt xuống "không khớp" oan.
    const visibleSet = buildNormalizedVisibleSet(["ha noi", "HO CHI MINH", "  Paris  "]);
    const { matches } = findFullAnswerSetMatches([i1, i2], visibleSet);
    report(
      "[I1] findFullAnswerSetMatches khớp đúng i1 dù UI khác hoa/thường + khoảng trắng thừa so với CMS, KHÔNG khớp i2 (thiếu \"London\")",
      matches.length === 1 && matches[0].id === "i1",
      JSON.stringify(matches.map((m) => m.id)),
    );
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

  console.log('=== [J] regression THẬT 2026-10-02 (room 80b88e7a-..., lớp 4D, "Choose the correct word (A, B, C or D) to complete each sentence.") - 3 câu ngắn cùng answer-set, chỉ còn 1-2 token riêng sau normalize (MIN_CONTENT_TOKENS cũ=3 từng ép AMBIGUOUS oan) ===');
  {
    const bank = ["tent", "photo", "story", "campfire"];
    const j1 = q("j1", { answers: bank, correctAnswer: "story", question: "She's telling a ___." }); // normalize -> [telling] (1 token)
    const j2 = q("j2", { answers: bank, correctAnswer: "campfire", question: "They're dancing around the ___." }); // -> [dancing, around] (2 token)
    const j3 = q("j3", { answers: bank, correctAnswer: "campfire", question: "Nam is building a ___." }); // -> [nam, building] (2 token)
    const pool = [j2, j1, j3]; // thứ tự xáo trộn - không được phụ thuộc index.

    report(
      "[J0] normalizeQuestionTokens xác nhận đúng short-token scenario thật",
      JSON.stringify(normalizeQuestionTokens(j1.question)) === JSON.stringify(["telling"]) &&
        JSON.stringify(normalizeQuestionTokens(j2.question)) === JSON.stringify(["dancing", "around"]) &&
        JSON.stringify(normalizeQuestionTokens(j3.question)) === JSON.stringify(["nam", "building"]),
    );

    const textsJ2 = ["They're dancing around the", ...bank];
    const rJ2 = await findMatchingQuestion(staticBridge(textsJ2), pool, undefined, 1, null);
    report("[J1] chọn đúng j2 dù chỉ còn 2 token riêng (dancing/around)", rJ2.status === "MATCHED" && rJ2.question.id === "j2", JSON.stringify(rJ2.status));

    const textsJ1 = ["She's telling a", ...bank];
    const rJ1 = await findMatchingQuestion(staticBridge(textsJ1), pool, undefined, 1, null);
    report("[J2] chọn đúng j1 dù chỉ còn ĐÚNG 1 token riêng (telling)", rJ1.status === "MATCHED" && rJ1.question.id === "j1", JSON.stringify(rJ1.status));

    const textsJ3 = ["Nam is building a", ...bank];
    const rJ3 = await findMatchingQuestion(staticBridge(textsJ3), pool, undefined, 1, null);
    report("[J3] chọn đúng j3 (nam/building)", rJ3.status === "MATCHED" && rJ3.question.id === "j3", JSON.stringify(rJ3.status));
  }

  console.log('=== [K] regression THẬT 2026-10-02 (room 3f119f63-..., lớp 4D, "Choose the correct question word...") - 3 câu cùng answer-set {Where,What,When,Who}, 1 trong 3 chỉ còn 2 token riêng ===');
  {
    const bank = ["Where", "What", "When", "Who"];
    const k1 = q("k1", { answers: bank, correctAnswer: "What", question: "______ are these animals? – They're hippos." }); // -> [animals, hippos] (2 token)
    const k2 = q("k2", { answers: bank, correctAnswer: "Who", question: "______'s he doing? – He's building a campfire." }); // -> [doing, building, campfire] (3 token)
    const k3 = q("k3", { answers: bank, correctAnswer: "What", question: "______ are they doing? – They're playing card games." }); // -> [doing, playing, card, games] (4 token)
    const pool = [k3, k1, k2];

    const textsK1 = ["are these animals?", "They're hippos.", ...bank];
    const rK1 = await findMatchingQuestion(staticBridge(textsK1), pool, undefined, 1, null);
    report(
      "[K1] chọn đúng k1 dù chỉ còn 2 token riêng (animals/hippos) - case thật từng bị AMBIGUOUS oan ở câu 7/10",
      rK1.status === "MATCHED" && rK1.question.id === "k1",
      JSON.stringify(rK1.status),
    );
  }

  console.log("=== [L] (tổng hợp, không phải data thật) chứng minh buildSharedAnswerTokenSet() thật sự loại answer token khỏi bằng chứng phân biệt ===");
  {
    const bank2 = ["garden", "kitchen", "bedroom"];
    // l2 cố ý chứa NGUYÊN 1 từ trùng đáp án dùng chung ("garden") làm từ DUY NHẤT còn lại sau lọc
    // stopword - nếu KHÔNG loại answer token, "garden" sẽ bị tính nhầm là bằng chứng nội dung chỉ vì
    // nó LUÔN hiển thị dưới dạng 1 trong các lựa chọn đáp án, không phải vì câu l2 thật sự đang hiển thị.
    const l1 = q("l1", { answers: bank2, correctAnswer: "garden", question: "Tom is watering flowers in the ___." });
    const l2 = q("l2", { answers: bank2, correctAnswer: "kitchen", question: "In the garden." });
    const pool = [l1, l2];

    report(
      "[L0] buildSharedAnswerTokenSet() derive đúng từ answers thật của nhóm (không hard-code)",
      (() => {
        const set = buildSharedAnswerTokenSet(pool);
        return set.has("garden") && set.has("kitchen") && set.has("bedroom");
      })(),
    );

    // Màn hình đang hiển thị ĐÚNG câu l1 - "garden" xuất hiện CHỈ vì nó là 1 đáp án hiển thị, không
    // phải vì l2 đang hiển thị.
    const textsL1 = ["Tom is watering flowers in the", ...bank2];
    const rL1 = await findMatchingQuestion(staticBridge(textsL1), pool, undefined, 1, null);
    report(
      "[L1] chọn đúng l1, l2 KHÔNG được 'ăn điểm' giả nhờ trùng đúng 1 từ với đáp án dùng chung (chứng minh filter có hiệu lực thật, không chỉ lý thuyết)",
      rL1.status === "MATCHED" && rL1.question.id === "l1",
      JSON.stringify(rL1.status),
    );
  }

  console.log('=== [M] regression THẬT 2026-10-07 (room 055cbc9f-..., lớp 4D, "G4-U2-L1: Listen and choose") - 5 câu con dùng CHUNG đúng answer-set {"A","B","C"} (đáp án là ẢNH, "A"/"B"/"C" chỉ là nhãn chữ đi kèm), câu dẫn đề CHỈ khác nhau đúng 1 số thứ tự ("Number 1".."Number 5") - trước fix, số thứ tự 1 CHỮ SỐ bị normalizeQuestionTokens() lọc mất (length>=3), khiến winnerScore=runnerUpScore=1.0 -> AMBIGUOUS SAI dù "Number 1" và "Number 2" là text KHÁC NHAU thật sự hiển thị trên màn ===');
  {
    // Dữ liệu THẬT lấy từ CMS examId 3eae6d90-895d-4585-b705-0b257d0cbf0c (xem inspect_raw_exam.mjs
    // live-dump 2026-10-07) - answers luôn là ["A","B","C"] (chữ nhãn đi kèm ảnh, answer.image mới là
    // ảnh thật nhưng app không expose identifier nào cho ảnh - xem báo cáo C, không liên quan fix này).
    const m1 = q("8a072c43-cf5a-4156-9eb1-eee640c81b69", { answers: ["A", "B", "C"], correctAnswer: "B", question: "Number 1" });
    const m2 = q("d7af94f7-5cf2-4e47-9135-14aae4db68cf", { answers: ["A", "B", "C"], correctAnswer: "A", question: "Number 2" });
    const m3 = q("b4d46631-9ed7-4ef1-80ba-8de39cd63e1e", { answers: ["A", "B", "C"], correctAnswer: "B", question: "Number 3" });
    const m4 = q("5de71bde-fffc-4ee3-b604-7071137aea72", { answers: ["A", "B", "C"], correctAnswer: "C", question: "Number 4" });
    const m5 = q("8a4da2e8-91f4-48ab-b90b-14fbce82206f", { answers: ["A", "B", "C"], correctAnswer: "B", question: "Number 5" });
    const pool = [m1, m2, m3, m4, m5];

    report(
      "[M0] normalizeQuestionTokens giữ lại số thứ tự - \"Number 1\" khác \"Number 2\" (trước fix: cả 2 đều -> [\"number\"], giống hệt nhau)",
      JSON.stringify(normalizeQuestionTokens("Number 1")) === JSON.stringify(["number", "1"]) &&
        JSON.stringify(normalizeQuestionTokens("Number 2")) === JSON.stringify(["number", "2"]) &&
        JSON.stringify(normalizeQuestionTokens("Number 1")) !== JSON.stringify(normalizeQuestionTokens("Number 2")),
      JSON.stringify({ n1: normalizeQuestionTokens("Number 1"), n2: normalizeQuestionTokens("Number 2") }),
    );

    // Màn hình đang hiển thị ĐÚNG "Number 1" (UI thật: "Number 1" + 3 option ảnh có nhãn A/B/C).
    const textsN1 = ["Number 1", "A", "B", "C"];
    const rN1 = await findMatchingQuestion(staticBridge(textsN1), pool, undefined, 1, null);
    report(
      "[M1] chọn đúng câu \"Number 1\" (không còn AMBIGUOUS giữa 5 candidate cùng answer-set)",
      rN1.status === "MATCHED" && rN1.question.id === "8a072c43-cf5a-4156-9eb1-eee640c81b69",
      JSON.stringify(rN1.status),
    );

    // Đổi màn hình sang "Number 3" - PHẢI đổi theo đúng candidate, không dính lại Number 1.
    const textsN3 = ["Number 3", "A", "B", "C"];
    const rN3 = await findMatchingQuestion(staticBridge(textsN3), pool, undefined, 3, null);
    report(
      "[M2] chọn đúng câu \"Number 3\" khi màn hình đổi sang câu khác (không stale theo M1)",
      rN3.status === "MATCHED" && rN3.question.id === "b4d46631-9ed7-4ef1-80ba-8de39cd63e1e",
      JSON.stringify(rN3.status),
    );

    // Đổi màn hình sang "Number 5" (đầu mút cuối, dễ bị nhầm với "5" của 1 số khác nếu regex token
    // hoá sai ranh giới từ) - xác nhận vẫn đúng.
    const textsN5 = ["Number 5", "A", "B", "C"];
    const rN5 = await findMatchingQuestion(staticBridge(textsN5), pool, undefined, 5, null);
    report(
      "[M3] chọn đúng câu \"Number 5\"",
      rN5.status === "MATCHED" && rN5.question.id === "8a4da2e8-91f4-48ab-b90b-14fbce82206f",
      JSON.stringify(rN5.status),
    );

    // Thứ tự pool bị xáo trộn - không được phụ thuộc index trong mảng.
    const rN2Reordered = await findMatchingQuestion(staticBridge(["Number 2", "A", "B", "C"]), [m5, m3, m1, m4, m2], undefined, 2, null);
    report(
      "[M4] kết quả không phụ thuộc thứ tự pool",
      rN2Reordered.status === "MATCHED" && rN2Reordered.question.id === "d7af94f7-5cf2-4e47-9135-14aae4db68cf",
      JSON.stringify(rN2Reordered.status),
    );

    // isVisible tối giản cùng ngữ nghĩa isVisibleInTree() thật (regex neo "^pattern$" trên từng text) -
    // đủ để test decideAnswerAction() (hàm THUẦN, nhận isVisible làm tham số đúng mục đích dễ test -
    // xem docblock homeworkExamEngine.js#decideAnswerAction()). KHÔNG cần tree thật vì nhánh TEXT_CHOICE
    // không đọc tree - chỉ dummy tree rỗng để nhánh fallback IMAGE_CHOICE_GRID (nếu rơi vào) tự trả null.
    const isVisibleFactory = (texts) => (pattern) => texts.some((t) => new RegExp(`^${pattern}$`).test(t));
    const dummyTree = { attributes: {}, children: [] };

    // Câu "Number 1" đã match đúng ở [M1] - giờ xác nhận decideAnswerAction() dùng ĐÚNG text "A"/"B"/"C"
    // (chữ nhãn CMS thật, KHÔNG phải vị trí/index đoán mò) để quyết định tap gì - đây CHÍNH LÀ cơ chế
    // "map CMS image answer -> app option" cho dạng bài này (xem báo cáo C: ảnh không có identifier gì,
    // nhưng chữ nhãn "A"/"B"/"C" đi kèm LÀ text thật, hiển thị thật, verify được qua isVisible() y hệt
    // TEXT_CHOICE thường - KHÔNG cần thêm cơ chế positional/accessibilityText song song).
    const isVisibleN1All = isVisibleFactory(["Number 1", "A", "B", "C"]);
    const actionCorrect = decideAnswerAction(dummyTree, isVisibleN1All, m1, true);
    report(
      '[M5] decideAnswerAction() chọn ĐÚNG text đáp án ("B") khi cả 3 option đều hiển thị + wantCorrect=true',
      actionCorrect?.type === "TEXT_CHOICE" && actionCorrect.text === "B" && actionCorrect.isTargetCorrect === true,
      JSON.stringify(actionCorrect),
    );
    const actionWrong = decideAnswerAction(dummyTree, isVisibleN1All, m1, false);
    report(
      "[M6] decideAnswerAction() chọn ĐÁP ÁN SAI có chủ đích khi wantCorrect=false (cho làm sai lần 1 theo target score)",
      actionWrong?.type === "TEXT_CHOICE" && actionWrong.text !== "B" && actionWrong.isTargetCorrect === false,
      JSON.stringify(actionWrong),
    );

    // Mô phỏng MISMATCH: màn hình thật chỉ hiển thị ĐÚNG 1/3 option (vd màn hình cũ chưa kịp render
    // hết/stale, hoặc candidate sai) - decideAnswerAction() PHẢI trả null (BLOCK), TUYỆT ĐỐI không tap
    // đại 1 trong các option còn thiếu bằng chứng (và KHÔNG fallback sang IMAGE_CHOICE_GRID giả vì
    // dummyTree không có box nào thật).
    const isVisibleMismatch = isVisibleFactory(["Number 1", "A"]);
    const actionBlocked = decideAnswerAction(dummyTree, isVisibleMismatch, m1, true);
    report(
      "[M7] decideAnswerAction() trả null (BLOCK) khi mismatch - chỉ 1/3 option hiển thị, KHÔNG đủ bằng chứng để tap",
      actionBlocked === null,
      JSON.stringify(actionBlocked),
    );
  }

  console.log(`\n${passes} passed, ${failures} failed.`);
  if (failures > 0) process.exitCode = 1;
}

main();
