#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../../src/config.js";
import { MaestroBridge } from "../../bridge/maestroBridge.js";
import { HomeworkNavigationEngine } from "../navigation/homeworkNavigationEngine.js";
import { homeworkPageObjects as po } from "../navigation/homeworkPageObjects.js";
import { HomeworkExamEngine } from "../navigation/homeworkExamEngine.js";
import { findAssignment, tapFoundCard } from "../discovery/findAssignment.js";
import { parseQuestionsFromExamPage } from "../../discovery/examPageScraper.js";
import { normalizeQuestions } from "../../model/questionModel.js";

/**
 * Weekly Report E2E test data generator - MO 1 bai tap CU THE (khong random) va tra loi dung
 * CHINH XAC N cau (khong random so cau dung) - dung de tao du lieu that co diem so kiem soat
 * duoc cho weekly_report_test_ledger (baocaotuan_2026-08-15.xlsx).
 *
 * KHONG dung resolveHomeworkExamQuestions() (bai_tap/discovery/homeworkExamResolver.js) vi ham do
 * BAT BUOC room.attempts[].examId - CHI co sau khi da co it nhat 1 luot lam (xem docblock file do).
 * Bai tap moi giao (0 attempt) se luon BLOCKED (UNRESOLVED_EXAM_ID) qua duong do. Thay vao do dung
 * THANG examId da biet truoc tu teacherAssignmentApiDiscovery.fetchEligibleAssignmentTree() (field
 * item.examIds - lay luc giao bai, xem giao_bai_tap/navigation/teacherAssignmentApiDiscovery.js)
 * roi goi thang parseQuestionsFromExamPage(examId) + normalizeQuestions() - CUNG 1 pipeline CMS
 * exam-scraper ma discovery/cli.js (Vui hoc) dang dung, chi khac nguon examId (biet truoc thay vi
 * random tu getExamOfExercise()). Khong doan/khong tao nguon moi.
 *
 * ENV bat buoc: TARGET_TITLE, CORRECT_COUNT (so nguyen >=0), EXAM_ID
 * ENV tuy chon: TARGET_DUE_DATE_DM ("DD/MM")
 *
 * Chay: node bai_tap/runtime/weeklyReportAnswerHomework.mjs
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "..", "output");
const MAX_QUESTIONS = 40;

function log(...args) {
  console.log(...args);
}

async function main() {
  const targetTitle = process.env.TARGET_TITLE;
  const targetDueDateDM = process.env.TARGET_DUE_DATE_DM || null;
  const correctCountEnv = process.env.CORRECT_COUNT;
  if (!targetTitle) throw new Error("Thieu env TARGET_TITLE.");
  if (correctCountEnv === undefined) throw new Error("Thieu env CORRECT_COUNT.");
  const correctCount = Number(correctCountEnv);
  if (!Number.isInteger(correctCount) || correctCount < 0) {
    throw new Error(`CORRECT_COUNT khong hop le: "${correctCountEnv}".`);
  }
  const examId = process.env.EXAM_ID;
  if (!examId) throw new Error("Thieu env EXAM_ID (lay tu fetchEligibleAssignmentTree luc giao bai).");

  const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId });
  const nav = new HomeworkNavigationEngine(bridge);
  const exam = new HomeworkExamEngine(bridge);

  const resultFile = join(OUTPUT_DIR, `weekly_report_answer_${targetTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
  const out = { targetTitle, targetDueDateDM, correctCount, phases: {} };

  log(`[MENU] Mo tab "Bai tap", filter "1 thang gan nhat"...`);
  await nav.openHomeworkTab();
  await nav.openFilterSheet();
  await nav.selectFilterRange(po.filterSheet.optionOneMonth);
  await nav.applyFilter();
  out.phases.menu = "PASS";

  log(`[FIND] Tim card "${targetTitle}" (dueDateDM=${targetDueDateDM ?? "(bo qua)"})...`);
  const found = await findAssignment(bridge, { title: targetTitle, dueDateDM: targetDueDateDM });
  if (found.status !== "FOUND") {
    out.phases.find = { status: found.status, reason: found.reason ?? null };
    writeFileSync(resultFile, JSON.stringify(out, null, 2), "utf8");
    throw new Error(`Khong tim thay assignment: status=${found.status} reason=${found.reason ?? "(khong ro)"}`);
  }
  out.phases.find = "PASS";
  log(`  FOUND: title="${found.card.title}" dueDate="${found.card.dueDate}" cta="${found.card.cta}"`);

  log(`[OPEN] Tap vao card...`);
  await tapFoundCard(bridge, found.card);
  await bridge.runSteps([
    { waitForAnimationToEnd: { timeout: 3000 } },
    { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
  ]);
  out.phases.open = "PASS";

  log(`[IDENTITY] Verify dung bai...`);
  await exam.verifyIdentity(found.card.title);
  out.phases.identity = "PASS";

  log(`[EXAM RESOLVE] Lay Question/CorrectAnswer qua CMS exam-scraper (examId da biet truoc: ${examId})...`);
  const examData = await parseQuestionsFromExamPage(examId);
  const questions = normalizeQuestions(examData);
  if (!questions || questions.length === 0) {
    out.phases.examResolve = { status: "BLOCKED", reason: "parseQuestionsFromExamPage tra ve 0 cau hoi." };
    writeFileSync(resultFile, JSON.stringify(out, null, 2), "utf8");
    throw new Error(`BLOCKED: examId=${examId} khong co cau hoi nao.`);
  }
  if (correctCount > questions.length) {
    throw new Error(`CORRECT_COUNT=${correctCount} > tong so cau (${questions.length}) cua bai nay.`);
  }
  // Ke hoach TAT DINH (khong random): K cau DAU tra dung, con lai tra sai - danh cho cong dung
  // "tao du lieu diem so kiem soat duoc", khong phai test co che cham diem (khac muc dich cua
  // homeworkRandomScoringE2E.js).
  const plan = questions.map((_, i) => i < correctCount);
  out.phases.examResolve = "PASS";
  out.questionCount = questions.length;
  log(`  RESOLVED: examId=${examId}, ${questions.length} cau - ke hoach: ${correctCount} cau DUNG, ${questions.length - correctCount} cau SAI.`);

  log(`[ANSWER] Tra loi theo ke hoach tat dinh...`);
  let answeredCount = 0;
  const achieved = [];
  let reachedResult = false;
  for (let i = 0; i < MAX_QUESTIONS; i++) {
    if (exam.isResultScreen()) {
      reachedResult = true;
      break;
    }
    const questionModel = questions[answeredCount];
    if (!questionModel) throw new Error(`Da tra loi ${answeredCount} cau nhung chi resolve duoc ${questions.length} cau.`);
    const wantCorrect = plan[answeredCount];
    const outcome = await exam.answerCurrentQuestion(questionModel, { wantCorrect });
    if (!outcome.supported) {
      throw new Error(`Handler khong ho tro cau ${answeredCount + 1}: ${outcome.reason} (${outcome.texts.join(" | ")})`);
    }
    if (outcome.isTargetCorrect === null) {
      throw new Error(`Cau ${answeredCount + 1}: khong xac dinh duoc dung/sai - dung lai.`);
    }
    answeredCount++;
    achieved.push(outcome.isTargetCorrect);
    log(`  Cau ${answeredCount}/${questions.length}: ${outcome.isTargetCorrect ? "DUNG" : "SAI"}`);
  }
  if (!reachedResult && !exam.isResultScreen()) {
    throw new Error(`Vuot qua ${MAX_QUESTIONS} cau ma chua thay man Ket qua.`);
  }
  out.phases.answer = "PASS";
  out.answeredCount = answeredCount;
  out.achieved = achieved;

  log(`[RESULT] Doc diem that...`);
  await bridge.runSteps([{ takeScreenshot: `weekly_report_answer_${targetTitle}_result` }]);
  const result = exam.readResult();
  out.result = result;
  log(`  Diem so: ${result.score ?? "(khong doc duoc)"} | So cau dung: ${result.correctCount ?? result.correct ?? "(khong doc duoc)"} / ${result.totalCount ?? "?"}`);

  const expectedCorrectCountFinal = achieved.filter((v) => v === true).length;
  if (result.correctCount !== null && expectedCorrectCountFinal !== result.correctCount) {
    out.phases.result = "MISMATCH";
    writeFileSync(resultFile, JSON.stringify(out, null, 2), "utf8");
    throw new Error(
      `Diem thuc te khong khop ke hoach: du kien ${expectedCorrectCountFinal}/${answeredCount} cau dung nhung man Ket qua bao ${result.correctCount}/${result.totalCount}.`,
    );
  }
  out.phases.result = "PASS";
  out.overall = "PASS";
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(resultFile, JSON.stringify(out, null, 2), "utf8");
  log(`\n[FINISH] PASS - diem that=${result.score}, da ghi ${resultFile}`);
}

main().catch((err) => {
  console.error(`\n[weeklyReportAnswerHomework] Loi: ${err.message}`);
  process.exitCode = 1;
});
