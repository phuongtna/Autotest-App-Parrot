#!/usr/bin/env node
/**
 * Xem chi tiết câu hỏi KHÁC NHAU giữa Self-learning và Tài liệu giáo viên cho 1 Unit cụ thể
 * (dùng để soi rõ compare_recap_self_vs_teacher.mjs báo "DIFFERENT_CONTENT" là khác ở CÂU nào).
 *
 * Chạy: node diff_recap_unit.mjs "Khối 2" "Unit 5: In the classroom"
 */

import { getBooks } from "./discovery/books.js";
import { getUnitsOfBook, filterPublishedUnits } from "./discovery/units.js";
import { getLessonsOfUnit } from "./discovery/lessons.js";
import { getLessonItemsOfLesson, flattenLessonItems, filterExerciseItems } from "./discovery/lessonItems.js";
import { parseQuestionsFromExamPageWithRetry } from "./discovery/examPageScraper.js";
import { normalizeQuestions } from "./model/questionModel.js";

const khoiName = process.argv[2];
const unitName = process.argv[3];
if (!khoiName || !unitName) {
  console.error('Dùng: node diff_recap_unit.mjs "Khối 2" "Unit 5: In the classroom"');
  process.exit(1);
}

async function getRecapExamId(book, unitNameToFind) {
  const units = filterPublishedUnits(await getUnitsOfBook(book));
  const unit = units.find((u) => u.name === unitNameToFind);
  if (!unit) throw new Error(`Không tìm thấy Unit "${unitNameToFind}" trong Book "${book.name}" (type=${book.type})`);
  const lessons = await getLessonsOfUnit(unit);
  const recapLesson = lessons.find((l) => /recap/i.test(l.name));
  if (!recapLesson) throw new Error(`Unit "${unitNameToFind}" (${book.type}) không có lesson Recap`);
  const topItems = await getLessonItemsOfLesson(recapLesson);
  const flat = await flattenLessonItems(topItems);
  const exerciseItems = filterExerciseItems(flat);
  const item = exerciseItems.find((it) => (it.exam_ids || []).length > 0);
  if (!item) throw new Error(`Unit "${unitNameToFind}" (${book.type}) Recap không có exam nào`);
  return item.exam_ids[0];
}

async function main() {
  const allBooks = await getBooks();
  const slBook = allBooks.find((b) => b.type === "SELF_LEARN" && b.name === khoiName);
  const tbBook = allBooks.find((b) => b.type === "BY_TEACHER" && b.name === khoiName);
  if (!slBook || !tbBook) throw new Error(`Không tìm thấy Book cho "${khoiName}"`);

  console.log(`Đang lấy examId cho "${unitName}" (${khoiName})...`);
  const [slExamId, tbExamId] = await Promise.all([
    getRecapExamId(slBook, unitName),
    getRecapExamId(tbBook, unitName),
  ]);
  console.log(`  SL examId=${slExamId}`);
  console.log(`  TM examId=${tbExamId}`);

  console.log(`\nĐang scrape nội dung câu hỏi...`);
  const [slData, tbData] = await Promise.all([
    parseQuestionsFromExamPageWithRetry(slExamId),
    parseQuestionsFromExamPageWithRetry(tbExamId),
  ]);
  const slQ = normalizeQuestions(slData);
  const tbQ = normalizeQuestions(tbData);

  console.log(`\nSL "${slData.examName}": ${slQ.length} câu | TM "${tbData.examName}": ${tbQ.length} câu\n`);

  // So theo MULTISET nội dung (question+correctAnswer), KHÔNG theo thứ tự index - vì 2 bên có
  // thể xáo trộn thứ tự câu khác nhau. DÙNG MULTISET (đếm số lần xuất hiện), KHÔNG dùng Set đơn
  // thuần - ĐÃ XÁC NHẬN THẬT (2026-09-23, Khối 2 Unit 5): Set collapse 2 câu SPEAK trùng text
  // ("What's he doing?" xuất hiện 2 lần, khác audio/image) thành 1 key -> báo sai "khác nhau" dù
  // đối chiếu bằng audio/image asset thật cho thấy 7/7 câu giống hệt, chỉ khác thứ tự.
  const keyOf = (q) => `${(q.question || "").trim()}|||${q.correctAnswer || ""}`;
  function toCountMap(questions) {
    const map = new Map();
    for (const q of questions) {
      const k = keyOf(q);
      map.set(k, (map.get(k) || 0) + 1);
    }
    return map;
  }
  const slCounts = toCountMap(slQ);
  const tbCounts = toCountMap(tbQ);

  const onlyInSl = [];
  const onlyInTb = [];
  const remaining = new Map(tbCounts);
  for (const q of slQ) {
    const k = keyOf(q);
    const left = remaining.get(k) || 0;
    if (left > 0) {
      remaining.set(k, left - 1);
    } else {
      onlyInSl.push(q);
    }
  }
  const remainingSl = new Map(slCounts);
  for (const q of tbQ) {
    const k = keyOf(q);
    const left = remainingSl.get(k) || 0;
    if (left > 0) {
      remainingSl.set(k, left - 1);
    } else {
      onlyInTb.push(q);
    }
  }

  console.log(`So theo MULTISET nội dung (không phụ thuộc thứ tự, có tính số lần lặp):`);
  console.log(`  Trùng: ${slQ.length - onlyInSl.length}/${slQ.length}\n`);

  if (onlyInSl.length === 0 && onlyInTb.length === 0) {
    console.log("KHÔNG có câu nào khác nội dung thật - toàn bộ giống nhau, chỉ khác THỨ TỰ hiển thị.");
  } else {
    console.log(`Câu CHỈ CÓ ở Self-learning (${onlyInSl.length}) - không tìm thấy tương ứng bên Tài liệu giáo viên:`);
    for (const q of onlyInSl) {
      console.log(`  - [${q.type}] "${q.question}"`);
      if (q.answers.length) console.log(`      Đáp án: [${q.answers.join(" | ")}]`);
      if (q.correctAnswer) console.log(`      Đáp án đúng: ${q.correctAnswer}`);
    }
    console.log(`\nCâu CHỈ CÓ ở Tài liệu giáo viên (${onlyInTb.length}) - không tìm thấy tương ứng bên Self-learning:`);
    for (const q of onlyInTb) {
      console.log(`  - [${q.type}] "${q.question}"`);
      if (q.answers.length) console.log(`      Đáp án: [${q.answers.join(" | ")}]`);
      if (q.correctAnswer) console.log(`      Đáp án đúng: ${q.correctAnswer}`);
    }
  }
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exitCode = 1;
});
