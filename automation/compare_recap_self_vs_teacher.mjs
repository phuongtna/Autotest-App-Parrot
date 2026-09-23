#!/usr/bin/env node
/**
 * Đối chiếu bài "Recap" giữa 2 tab trong CMS - Self-learning vs Tài liệu giáo viên
 *
 * Logic đơn giản:
 * - Với mỗi Khối + Unit có Recap+exam bên Self-learning:
 *   - Nếu Tài liệu giáo viên (cùng Khối+Unit) có Recap+exam -> so sánh nội dung câu hỏi
 *   - Nếu không có -> note lại "MISSING"
 *
 * Chạy:
 *   node compare_recap_self_vs_teacher.mjs            (mọi Khối)
 *   node compare_recap_self_vs_teacher.mjs "Khối 1"  (chỉ test Khối 1)
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getBooks } from "./discovery/books.js";
import { getUnitsOfBook, filterPublishedUnits } from "./discovery/units.js";
import { getLessonsOfUnit } from "./discovery/lessons.js";
import { getLessonItemsOfLesson, flattenLessonItems, filterExerciseItems } from "./discovery/lessonItems.js";
import { parseQuestionsFromExamPageWithRetry } from "./discovery/examPageScraper.js";
import { normalizeQuestions } from "./model/questionModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");
const OUTPUT_FILE = join(OUTPUT_DIR, "recap_comparison_report.json");

const khoiFilter = process.argv[2]; // "Khối 1" hoặc undefined (mọi khối)

function log(...args) { console.log(...args); }

/** Lấy Recap lesson + Exercise items của Unit cụ thể */
async function getRecapData(unit) {
  const lessons = await getLessonsOfUnit(unit);
  const recapLesson = lessons.find((l) => /recap/i.test(l.name));
  if (!recapLesson) return null;

  const topItems = await getLessonItemsOfLesson(recapLesson);
  const flat = await flattenLessonItems(topItems);
  const exerciseItems = filterExerciseItems(flat);

  return {
    lessonId: recapLesson.id,
    tagName: recapLesson.tag?.name,
    items: exerciseItems.map((it) => ({
      name: it.name,
      examIds: it.exam_ids || [],
    })),
  };
}

async function scrapeExam(examId) {
  const data = await parseQuestionsFromExamPageWithRetry(examId);
  return { examId, examName: data.examName, questions: normalizeQuestions(data) };
}

/**
 * So MULTISET (đếm số lần lặp), KHÔNG dùng Set đơn thuần - ĐÃ XÁC NHẬN THẬT (2026-09-23, Khối 2
 * Unit 5 "In the classroom"): Set collapse 2 câu SPEAK trùng text ("What's he doing?" xuất hiện 2
 * lần, khác audio/image thật) thành 1 key duy nhất -> overlap bị đếm THIẾU (6/7 thay vì đúng phải
 * là 7/7) dù đối chiếu bằng audio/image asset thật cho thấy nội dung giống hệt, chỉ khác thứ tự.
 * Dùng multiset (Map đếm) để mỗi lần lặp phải khớp với 1 lần lặp tương ứng bên kia, không bị dồn
 * chung theo key.
 */
function compareExams(examA, examB) {
  const keyOf = (q) => `${(q.question || "").trim()}|||${q.correctAnswer || ""}`;
  const remaining = new Map();
  for (const q of examB.questions) {
    const k = keyOf(q);
    remaining.set(k, (remaining.get(k) || 0) + 1);
  }
  let overlap = 0;
  for (const q of examA.questions) {
    const k = keyOf(q);
    const left = remaining.get(k) || 0;
    if (left > 0) {
      remaining.set(k, left - 1);
      overlap++;
    }
  }
  const identical = examA.questions.length === examB.questions.length &&
    overlap === examA.questions.length &&
    examA.questions.length > 0;

  return {
    slQuestions: examA.questions.length,
    tmQuestions: examB.questions.length,
    overlap,
    identical,
  };
}

async function main() {
  const allBooks = await getBooks();
  const selfLearnBooks = allBooks.filter((b) => b.type === "SELF_LEARN");
  const byTeacherBooks = allBooks.filter((b) => b.type === "BY_TEACHER");

  let booksToProcess = selfLearnBooks;
  if (khoiFilter) {
    booksToProcess = selfLearnBooks.filter((b) => b.name === khoiFilter);
    if (booksToProcess.length === 0) {
      log(`ERROR: Không tìm thấy "${khoiFilter}" trong Self-learning.`);
      process.exitCode = 1;
      return;
    }
    log(`=== TEST: Chỉ ${khoiFilter} ===\n`);
  } else {
    log(`=== ĐỐI CHIẾU RECAP: MỌI KHỐI ===\n`);
    log(`Self-learning: ${selfLearnBooks.length} Khối`);
    log(`Tài liệu giáo viên: ${byTeacherBooks.length} Khối\n`);
  }

  const results = {
    timestamp: new Date().toISOString(),
    filter: khoiFilter || "all",
    summary: { total: 0, compared: 0, missing: 0 },
    details: [],
  };

  for (const slBook of booksToProcess) {
    const khoi = slBook.name;
    const tbBook = byTeacherBooks.find((b) => b.name === khoi);
    if (!tbBook) {
      log(`[${khoi}] SKIP: không tìm Book type BY_TEACHER\n`);
      continue;
    }

    log(`[${khoi}] Đang xử lý...`);
    const slUnits = filterPublishedUnits(await getUnitsOfBook(slBook));
    const tbUnits = filterPublishedUnits(await getUnitsOfBook(tbBook));
    const tbByName = new Map(tbUnits.map((u) => [u.name, u]));

    const khoiResults = { khoi, units: [] };

    for (const slUnit of slUnits) {
      const slRecap = await getRecapData(slUnit);
      if (!slRecap) continue; // Unit này không có Recap bên SL - bỏ qua

      const slExamItem = slRecap.items.find((it) => it.examIds.length > 0);
      if (!slExamItem) continue; // Recap tồn tại nhưng không có exam - bỏ qua

      results.summary.total++;
      const unitResult = { unit: slUnit.name, status: null, details: null };

      const tbUnit = tbByName.get(slUnit.name);
      if (!tbUnit) {
        unitResult.status = "MISSING - Unit không tồn tại bên Tài liệu giáo viên";
        khoiResults.units.push(unitResult);
        results.summary.missing++;
        continue;
      }

      const tbRecap = await getRecapData(tbUnit);
      if (!tbRecap) {
        unitResult.status = "MISSING - Không có Recap lesson bên Tài liệu giáo viên";
        khoiResults.units.push(unitResult);
        results.summary.missing++;
        continue;
      }

      const tbExamItem = tbRecap.items.find((it) => it.examIds.length > 0);
      if (!tbExamItem) {
        unitResult.status = "MISSING - Recap tồn tại nhưng không có bài kiểm tra";
        unitResult.details = { slExamCount: slExamItem.examIds.length, tmExamCount: 0 };
        khoiResults.units.push(unitResult);
        results.summary.missing++;
        continue;
      }

      // Cả 2 bên có exam -> so sánh nội dung
      results.summary.compared++;
      let slExam = null, tbExam = null, slErr = null, tbErr = null;

      try {
        slExam = await scrapeExam(slExamItem.examIds[0]);
      } catch (err) {
        slErr = err.message;
      }

      try {
        tbExam = await scrapeExam(tbExamItem.examIds[0]);
      } catch (err) {
        tbErr = err.message;
      }

      if (slErr || tbErr) {
        unitResult.status = "ERROR_SCRAPING";
        unitResult.details = { slError: slErr, tmError: tbErr };
      } else {
        const cmp = compareExams(slExam, tbExam);
        unitResult.status = cmp.identical ? "OK_IDENTICAL" : "DIFFERENT_CONTENT";
        unitResult.details = {
          slExam: { name: slExam.examName, questions: cmp.slQuestions },
          tmExam: { name: tbExam.examName, questions: cmp.tmQuestions },
          comparison: cmp,
        };
      }

      khoiResults.units.push(unitResult);
    }

    results.details.push(khoiResults);
    const okCount = khoiResults.units.filter((u) => u.status?.startsWith("OK")).length;
    const diffCount = khoiResults.units.filter((u) => u.status === "DIFFERENT_CONTENT").length;
    const missCount = khoiResults.units.filter((u) => u.status?.startsWith("MISSING")).length;
    log(`  ${khoiResults.units.length} Unit: ${okCount} OK, ${diffCount} DIFFERENT, ${missCount} MISSING\n`);
  }

  // In báo cáo ra stdout
  log(`\n=== TỔNG HỢP ===`);
  log(`Tổng Unit có Recap+exam ở Self-learning: ${results.summary.total}`);
  log(`Được đối chiếu (cả 2 bên có exam): ${results.summary.compared}`);
  log(`THIẾU ở Tài liệu giáo viên: ${results.summary.missing}\n`);

  for (const khoiResult of results.details) {
    const khoi = khoiResult.khoi;
    log(`--- ${khoi} ---`);
    for (const u of khoiResult.units) {
      if (u.status?.startsWith("OK")) {
        log(`  ✓ ${u.unit}: ${u.status}`);
        if (u.details?.comparison) {
          log(`    SL "${u.details.slExam.name}"(${u.details.slExam.questions}q) = TM "${u.details.tmExam.name}"(${u.details.tmExam.questions}q)`);
        }
      } else if (u.status === "DIFFERENT_CONTENT") {
        log(`  ✗ ${u.unit}: ${u.status}`);
        if (u.details?.comparison) {
          log(`    SL ${u.details.slExam.questions}q vs TM ${u.details.tmExam.questions}q (trùng ${u.details.comparison.overlap})`);
        }
      } else {
        log(`  ✗ ${u.unit}: ${u.status}`);
      }
    }
    log("");
  }

  // Ghi file JSON
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), "utf8");
  log(`Báo cáo chi tiết: ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("\nERROR:", err.message);
  process.exitCode = 1;
});
