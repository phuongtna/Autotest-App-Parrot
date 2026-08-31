#!/usr/bin/env node
/**
 * Fixture test cho PHASE 4 (2026-08-31): questionTypeDetector.js#detectQuestionType() +
 * answerSetMatcher.js#diagnoseCurrentQuestion()/findMatchingQuestion() - CHỈ gọi hàm THUẦN đã export
 * (không bridge/network/device thật). Bao phủ ĐÚNG 9 case bắt buộc theo yêu cầu PHASE 3B Revision
 * Part 3 mục H (Test 1-9) - KHÔNG đổi hành vi MATCH/AMBIGUOUS cũ đã có regression test riêng ở
 * answerSetMatcher.fixtureTest.mjs (file đó vẫn PASS nguyên vẹn, xem PHASE 4 final report).
 *
 * Chạy: node automation/bai_tap/discovery/diagnoseCurrentQuestion.fixtureTest.mjs
 */

import { detectQuestionType } from "./questionTypeDetector.js";
import { diagnoseCurrentQuestion, findMatchingQuestion } from "./answerSetMatcher.js";

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

function node(attrs = {}, children = []) {
  return { attributes: attrs, children };
}
function textNode(t) {
  return node({ text: t });
}
function resourceIdNode(id) {
  return node({ "resource-id": id });
}
function clickableBox(x1, y1, x2, y2) {
  return node({ clickable: "true", bounds: `[${x1},${y1}][${x2},${y2}]` });
}

function treeFromTexts(texts) {
  return node({}, texts.map(textNode));
}

const staticBridge = (tree) => ({ async hierarchy() { return tree; } });

function collectAllTextsLocal(t) {
  const acc = [];
  (function walk(n) {
    if (typeof n?.attributes?.text === "string" && n.attributes.text.trim()) acc.push(n.attributes.text.trim());
    for (const c of n?.children ?? []) walk(c);
  })(t);
  return acc;
}

async function main() {
  console.log("=== Test 1 — DRAG_DROP beats TEXT_CHOICE (Conflict 1) ===");
  {
    // Tree: có resource-id exercise_dragdrop_zone_0 (DRAG_DROP thật) VÀ 2 word-bank chip "an"/"a"
    // tình cờ trùng answers[] của 1 candidate trong pool - trước đây sẽ bị phân loại NHẦM thành
    // TEXT_CHOICE (bug Conflict 1 đã audit PHASE 3A §D.2).
    const dragDropPool = [q("dd1", { answers: ["an", "a"], correctAnswer: "an", question: "Fill in ___ apple and ___ banana." })];
    const tree = node({}, [resourceIdNode("exercise_dragdrop_zone_0"), textNode("an"), textNode("a")]);
    const texts = collectAllTextsLocal(tree);
    const typeResult = detectQuestionType(tree, texts, dragDropPool);
    report("[1a] questionType = DRAG_DROP (không bị TEXT_CHOICE đánh bại)", typeResult.questionType === "DRAG_DROP", typeResult.questionType);
    report("[1b] answerable = false", typeResult.answerable === false);

    const diag = diagnoseCurrentQuestion(tree, dragDropPool, { questionIndex: 1 });
    report("[1c] contentMatch = NOT_ATTEMPTED (không thử content matching cho type chưa hỗ trợ)", diag.contentMatch === "NOT_ATTEMPTED");
    report("[1d] classification = UNSUPPORTED_QUESTION_TYPE", diag.classification === "UNSUPPORTED_QUESTION_TYPE", diag.classification);

    const matchResult = await findMatchingQuestion(staticBridge(tree), dragDropPool, undefined, 1, null);
    report("[1e] findMatchingQuestion() KHÔNG trả MATCHED cho DRAG_DROP", matchResult.status !== "MATCHED", matchResult.status);
  }

  console.log("=== Test 2 — Detector conflict evidence không bị mất khi precedence chọn được winner an toàn ===");
  {
    const pool = [q("c1", { answers: ["an", "a"], correctAnswer: "an" })];
    // CONNECT id + DRAG_DROP id cùng có mặt (kịch bản tổng hợp để chắc chắn >=2 detector nổ ra).
    const tree = node({}, [resourceIdNode("exercise_connect_left_0"), resourceIdNode("exercise_dragdrop_zone_0"), textNode("an"), textNode("a")]);
    const texts = collectAllTextsLocal(tree);
    const typeResult = detectQuestionType(tree, texts, pool);
    report("[2a] matchedDetectors.length >= 2", typeResult.matchedDetectors.length >= 2, JSON.stringify(typeResult.matchedDetectors));
    report("[2b] detectorConflict = true", typeResult.detectorConflict === true);
    report("[2c] questionType = CONNECT (precedence: CONNECT đứng trước DRAG_DROP)", typeResult.questionType === "CONNECT", typeResult.questionType);
    report("[2d] conflict evidence KHÔNG mất - typeEvidence liệt kê cả 2 detector đã nổ", typeResult.typeEvidence.filter((e) => e.matched).length >= 2);
  }

  console.log("=== Test 3 — SORT/SENTENCE_BUILDER ambiguous (không đoán 1 trong 2) ===");
  {
    const pool = [q("s1", { answers: ["a", "b"], correctAnswer: "a" })];
    const tree = treeFromTexts(["Reorder the letters"]);
    const texts = collectAllTextsLocal(tree);
    const typeResult = detectQuestionType(tree, texts, pool);
    report("[3a] questionType = SORT_OR_SENTENCE_BUILDER (không đoán SORT, không đoán SENTENCE_BUILDER)", typeResult.questionType === "SORT_OR_SENTENCE_BUILDER");

    const diag = diagnoseCurrentQuestion(tree, pool, { questionIndex: 1 });
    report("[3b] classification = AMBIGUOUS_QUESTION_TYPE", diag.classification === "AMBIGUOUS_QUESTION_TYPE", diag.classification);
  }

  console.log("=== Test 4 — content mismatch (TEXT_CHOICE thật, 0 candidate khớp) ===");
  {
    const pool = [
      q("t1", { answers: ["Cat", "Dog", "Bird"], correctAnswer: "Cat" }),
      q("t2", { answers: ["Red", "Blue"], correctAnswer: "Red" }),
    ];
    // exercise_answer_0 = tín hiệu CẤU TRÚC "đây là màn TEXT_CHOICE" ĐỘC LẬP với pool - màn đang hiện
    // "Paris"/"London" KHÔNG trùng bất kỳ candidate nào trong pool.
    const tree = node({}, [resourceIdNode("exercise_answer_0"), textNode("Paris"), textNode("London")]);
    const texts = collectAllTextsLocal(tree);
    const typeResult = detectQuestionType(tree, texts, pool);
    report("[4a] questionType = TEXT_CHOICE (detect được dù pool không khớp gì)", typeResult.questionType === "TEXT_CHOICE", typeResult.questionType);

    const diag = diagnoseCurrentQuestion(tree, pool, { questionIndex: 1 });
    report("[4b] contentMatch = NO_CONTENT_MATCH", diag.contentMatch === "NO_CONTENT_MATCH", diag.contentMatch);
    report("[4c] classification = CONTENT_MISMATCH", diag.classification === "CONTENT_MISMATCH", diag.classification);
    report("[4d] identityStatus = MISMATCH_SUSPECTED (KHÔNG BAO GIỜ tự suy ra WRONG_ASSIGNMENT)", diag.identityStatus === "MISMATCH_SUSPECTED");

    const matchResult = await findMatchingQuestion(staticBridge(tree), pool, undefined, 1, null);
    report("[4e] findMatchingQuestion() không MATCHED, không tự chọn candidate nào", matchResult.status === "NO_MATCH" && !matchResult.question);
  }

  console.log("=== Test 5 — partial content match (forensic evidence) ===");
  {
    const pool = [q("p1", { answers: ["Alpha", "Beta", "Gamma", "Delta"], correctAnswer: "Alpha" })];
    const tree = node({}, [resourceIdNode("exercise_answer_0"), textNode("Alpha"), textNode("Beta")]);
    const diag = diagnoseCurrentQuestion(tree, pool, { questionIndex: 1 });
    report("[5a] contentMatch = PARTIAL_MATCH", diag.contentMatch === "PARTIAL_MATCH", diag.contentMatch);
    report("[5b] classification = PARTIAL_CONTENT_MATCH", diag.classification === "PARTIAL_CONTENT_MATCH");
    const pm = diag.contentEvidence?.partialMatches?.[0];
    report("[5c] matchedTexts = [Alpha, Beta]", JSON.stringify(pm?.matchedTexts?.sort()) === JSON.stringify(["Alpha", "Beta"].sort()), JSON.stringify(pm?.matchedTexts));
    report("[5d] missingExpectedTexts = [Gamma, Delta]", JSON.stringify((pm?.missingExpectedTexts ?? []).sort()) === JSON.stringify(["Delta", "Gamma"]), JSON.stringify(pm?.missingExpectedTexts));
  }

  console.log("=== Test 6 — exact match (hành vi cũ giữ nguyên) ===");
  {
    const pool = [q("m1", { answers: ["Cat", "Dog", "Bird"], correctAnswer: "Cat", question: "Which animal says meow?" })];
    const tree = node({}, [resourceIdNode("exercise_answer_0"), textNode("Which animal says meow?"), textNode("Cat"), textNode("Dog"), textNode("Bird")]);
    const diag = diagnoseCurrentQuestion(tree, pool, { questionIndex: 1 });
    report("[6a] contentMatch = MATCH", diag.contentMatch === "MATCH", diag.contentMatch);
    report("[6b] matchedQuestion.id = m1", diag.matchedQuestion?.id === "m1");

    const matchResult = await findMatchingQuestion(staticBridge(tree), pool, undefined, 1, null);
    report("[6c] findMatchingQuestion() status = MATCHED (regression-safe)", matchResult.status === "MATCHED" && matchResult.question.id === "m1");
  }

  console.log("=== Test 7 — empty/unknown UI ===");
  {
    const pool = [q("u1", { answers: ["A", "B"], correctAnswer: "A" })];
    const tree = node({}, []);
    const typeResult = detectQuestionType(tree, [], pool);
    report("[7a] questionType = UNKNOWN", typeResult.questionType === "UNKNOWN");

    const diag = diagnoseCurrentQuestion(tree, pool, { questionIndex: 1 });
    report("[7b] classification = IDENTITY_UNVERIFIABLE", diag.classification === "IDENTITY_UNVERIFIABLE", diag.classification);

    const matchResult = await findMatchingQuestion(staticBridge(tree), pool, undefined, 1, null);
    report("[7c] findMatchingQuestion() không MATCHED, không fallback", matchResult.status === "NO_MATCH" && !matchResult.question);
  }

  console.log("=== Test 8 — first-fit regression guard (IMAGE_CHOICE_GRID, >=2 candidate cùng box count) ===");
  {
    // Trước đây (fallback first-fit CŨ): decideAnswerAction() được gọi TUẦN TỰ cho từng candidate
    // trong pool, chọn NGAY candidate ĐẦU TIÊN khớp box count - KHÔNG kiểm tra có candidate khác
    // cũng khớp hay không. Fixture này có 2 candidate CÙNG 4 đáp án (cùng khớp 4 box) - hành vi MỚI
    // phải trả AMBIGUOUS, KHÔNG được tự chọn candidate đầu tiên trong mảng.
    const gridA = q("gridA", { answers: ["a1", "a2", "a3", "a4"], correctAnswer: "a1" });
    const gridB = q("gridB", { answers: ["b1", "b2", "b3", "b4"], correctAnswer: "b1" });
    const pool = [gridA, gridB];
    const tree = node({}, [
      clickableBox(0, 0, 100, 100),
      clickableBox(400, 0, 500, 100),
      clickableBox(0, 400, 100, 500),
      clickableBox(400, 400, 500, 500),
    ]);
    const texts = collectAllTextsLocal(tree);
    const typeResult = detectQuestionType(tree, texts, pool);
    report("[8a] questionType = IMAGE_CHOICE_GRID", typeResult.questionType === "IMAGE_CHOICE_GRID", typeResult.questionType);

    const diag = diagnoseCurrentQuestion(tree, pool, { questionIndex: 1 });
    report("[8b] contentMatch = AMBIGUOUS (KHÔNG tự chọn gridA chỉ vì đứng đầu mảng)", diag.contentMatch === "AMBIGUOUS", diag.contentMatch);
    report("[8c] matchedQuestion = null (không có candidate nào được chọn)", diag.matchedQuestion === null);

    const matchResult = await findMatchingQuestion(staticBridge(tree), pool, undefined, 1, null);
    report("[8d] findMatchingQuestion() KHÔNG MATCHED, không tap/không chọn đại", matchResult.status !== "MATCHED", matchResult.status);

    // Đảo thứ tự pool - nếu vẫn còn first-fit ẩn, đảo thứ tự sẽ đổi kết quả (không đổi ở đây).
    const diagReordered = diagnoseCurrentQuestion(tree, [gridB, gridA], { questionIndex: 1 });
    report("[8e] Kết quả KHÔNG phụ thuộc thứ tự pool (không phải first-fit trá hình)", diagReordered.contentMatch === "AMBIGUOUS");
  }

  console.log("=== Test 9 — MULTI regression (diagnostic evidence only, KHÔNG sửa extraction) ===");
  {
    const pool = [q("mu1", { answers: ["X", "Y", "Z"], correctAnswer: "X, Y" })]; // mô phỏng bug join đã biết
    const tree = node({}, [resourceIdNode("exercise_answer_list_multi"), resourceIdNode("exercise_answer_0"), textNode("X"), textNode("Y"), textNode("Z")]);
    const texts = collectAllTextsLocal(tree);
    const typeResult = detectQuestionType(tree, texts, pool);
    report("[9a] knownCorrectnessRisk = MULTI_JOIN_BUG", typeResult.knownCorrectnessRisk === "MULTI_JOIN_BUG");
    report("[9b] questionType KHÔNG bị đổi thành MULTI (vẫn TEXT_CHOICE, hành vi pipeline giữ nguyên có chủ đích)", typeResult.questionType === "TEXT_CHOICE", typeResult.questionType);
  }

  console.log(`\n${passes} passed, ${failures} failed.`);
  if (failures > 0) process.exitCode = 1;
}

main();
