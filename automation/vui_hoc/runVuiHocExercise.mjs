#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../src/config.js";
import { MaestroBridge } from "../bridge/maestroBridge.js";
import { resolveVuiHocExamQuestions } from "./vuihocQuestionResolver.js";
import { VuiHocExamEngine } from "./vuiHocExamEngine.js";
import { runVuiHocQuestionPool } from "./vuiHocExamRunner.js";

/**
 * Chạy 1 Exercise Vui học THẬT từ câu hiện tại (bất kỳ, thứ tự bất kỳ) tới màn Kết quả - HOÀN
 * TOÀN TỰ ĐỘNG, KHÔNG cần biết trước câu nào đang hiển thị (2026-09-10, bỏ hẳn `START_INDEX` -
 * xem vuiHocQuestionMatcher.js#findMatchingPoolEntry(): mỗi vòng lặp tự nhận diện UI type rồi
 * khớp với ĐÚNG 1 câu còn lại trong pool CMS bằng nội dung, không giả định thứ tự tuần tự - "Thử
 * thách" đã xác nhận THẬT xáo trộn thứ tự câu mỗi lượt, khác "Đề part" tuần tự).
 *
 * GIẢ ĐỊNH DUY NHẤT còn lại: thiết bị đã mở app, đã đăng nhập, và ĐANG ĐỨNG Ở 1 CÂU HỎI (bất kỳ)
 * của ĐÚNG Exercise được truyền qua BOOK_NAME/UNIT_NAME/LESSON_NAME/EXERCISE_NAME - script KHÔNG
 * tự điều hướng vào bài (Vui học -> Khối -> Unit -> Lesson -> Exercise), phần đó vẫn thuộc về
 * flows/app/helpers/open-vuihoc-connect.yaml hoặc thao tác mở bài riêng.
 *
 * Chạy: BOOK_NAME="Khối 8" UNIT_NAME="Review 4" LESSON_NAME="Language" EXERCISE_NAME="Đề part 2" \
 *       node automation/vui_hoc/runVuiHocExercise.mjs
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");
const RESULT_FILE = join(OUTPUT_DIR, "vuihoc_exercise_run_result.json");

function nowNs() {
  return process.hrtime.bigint();
}
function secondsSince(startNs) {
  return Number(nowNs() - startNs) / 1e9;
}
function log(...args) {
  console.log(...args);
}

async function main() {
  const bookName = process.env.BOOK_NAME || "Khối 8";
  const unitName = process.env.UNIT_NAME || "Review 4";
  const lessonName = process.env.LESSON_NAME || "Language";
  const exerciseName = process.env.EXERCISE_NAME || "Đề part 2";
  const maxAttemptsPerQuestion = Number(process.env.MAX_ATTEMPTS_PER_QUESTION || 3);

  const overallStart = nowNs();

  log(`[runVuiHocExercise] Resolving question pool: "${bookName}" > "${unitName}" > "${lessonName}" > "${exerciseName}"`);
  const resolveStart = nowNs();
  const { examId, examName, questions } = await resolveVuiHocExamQuestions({
    bookName,
    unitName,
    lessonName,
    exerciseName,
  });
  const resolveQuestionsSeconds = secondsSince(resolveStart);
  const resolveInfo = { examId, examName, totalQuestions: questions.length, types: questions.map((q) => q.type) };
  log(`[runVuiHocExercise] Resolved exam "${examName}" (${examId}) - ${questions.length} câu: ${resolveInfo.types.join(", ")}`);
  log(`[runVuiHocExercise] Thời gian resolve CMS: ${resolveQuestionsSeconds.toFixed(2)}s`);

  const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
  const engine = new VuiHocExamEngine(bridge);

  const runOutcome = await runVuiHocQuestionPool({
    bridge,
    engine,
    questions,
    maxAttemptsPerQuestion,
    deviceId: config.deviceId || undefined,
    outputDir: OUTPUT_DIR,
    screenshotPrefix: "vuihoc",
  });

  const summary = {
    resolveInfo,
    maxAttemptsPerQuestion,
    stoppedReason: runOutcome.stoppedReason,
    finalResult: runOutcome.finalResult,
    resultScreenshotPath: runOutcome.resultScreenshotPath,
    resultTimestamp: runOutcome.resultTimestamp,
    perQuestionResults: runOutcome.perQuestionResults,
    benchmark: runOutcome.benchmark,
    timings: {
      resolveQuestionsSeconds,
      // Thời gian LÀM BÀI THẬT (chỉ vòng lặp trả lời câu hỏi, KHÔNG tính resolve CMS theo tên) -
      // xem giải thích tương tự trong runVuiHocRandomExercise.mjs.
      answerSeconds: runOutcome.timings.totalSeconds,
      perQuestionSeconds: runOutcome.timings.perQuestionSeconds,
      averagePerQuestionSeconds: runOutcome.timings.averagePerQuestionSeconds,
      totalSeconds: secondsSince(overallStart),
    },
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(RESULT_FILE, JSON.stringify(summary, null, 2), "utf8");
  log(`[runVuiHocExercise] Kết quả ghi tại ${RESULT_FILE}`);
  log(`[runVuiHocExercise] ĐIỂM SỐ: ${JSON.stringify(summary.finalResult)}`);
  log(`[runVuiHocExercise] Screenshot màn Kết quả: ${summary.resultScreenshotPath}`);
  log(
    `[runVuiHocExercise] Thời gian LÀM BÀI (không tính resolve CMS): ${summary.timings.answerSeconds.toFixed(2)}s cho ${summary.benchmark.questionsAnswered} câu.`,
  );
  log(
    `[runVuiHocExercise] Tổng thời gian: ${summary.timings.totalSeconds.toFixed(2)}s, TB/câu: ${summary.timings.averagePerQuestionSeconds?.toFixed(2)}s, ` +
      `${summary.benchmark.totalMaestroProcessLaunches} lượt Maestro CLI (${bridge.testInvocationCount} test + ${bridge.hierarchyInvocationCount} hierarchy)`,
  );
}

main().catch((err) => {
  console.error("[runVuiHocExercise] LỖI:", err);
  process.exit(1);
});

