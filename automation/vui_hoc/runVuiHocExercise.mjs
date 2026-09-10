#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { config } from "../src/config.js";
import { MaestroBridge } from "../bridge/maestroBridge.js";
import { resolveVuiHocExamQuestions } from "./vuihocQuestionResolver.js";
import { VuiHocExamEngine } from "./vuiHocExamEngine.js";
import { detectQuestionUiType, findMatchingPoolEntry } from "./vuiHocQuestionMatcher.js";

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

/** Chụp màn hình THẬT qua `adb exec-out screencap` trực tiếp - KHÔNG qua Maestro (screenshot của
 * Maestro `takeScreenshot` spawn thêm 1 tiến trình `maestro test` chỉ để chụp ảnh - lãng phí đúng
 * loại chi phí đang cần loại bỏ, xem Task 4). `adb` không có chi phí khởi động session như
 * Maestro CLI (đã đo thật: dưới 1s/lần). Trả về đường dẫn file đã lưu. */
function captureScreenshotViaAdb(deviceId, outPath) {
  const args = deviceId ? ["-s", deviceId, "exec-out", "screencap", "-p"] : ["exec-out", "screencap", "-p"];
  const png = execFileSync("adb", args, { maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(outPath, png);
  return outPath;
}

async function main() {
  const bookName = process.env.BOOK_NAME || "Khối 8";
  const unitName = process.env.UNIT_NAME || "Review 4";
  const lessonName = process.env.LESSON_NAME || "Language";
  const exerciseName = process.env.EXERCISE_NAME || "Đề part 2";
  const maxAttemptsPerQuestion = Number(process.env.MAX_ATTEMPTS_PER_QUESTION || 3);

  const overallStart = nowNs();
  const timings = { resolveQuestions: null, perQuestion: [], total: null };
  const perQuestionResults = [];
  let stoppedReason = "COMPLETED";
  let finalResult = null;
  let resultScreenshotPath = null;
  let resultTimestamp = null;

  log(`[runVuiHocExercise] Resolving question pool: "${bookName}" > "${unitName}" > "${lessonName}" > "${exerciseName}"`);
  const resolveStart = nowNs();
  const { examId, examName, questions } = await resolveVuiHocExamQuestions({
    bookName,
    unitName,
    lessonName,
    exerciseName,
  });
  timings.resolveQuestions = secondsSince(resolveStart);
  const resolveInfo = { examId, examName, totalQuestions: questions.length, types: questions.map((q) => q.type) };
  log(`[runVuiHocExercise] Resolved exam "${examName}" (${examId}) - ${questions.length} câu: ${resolveInfo.types.join(", ")}`);
  log(`[runVuiHocExercise] Thời gian resolve CMS: ${timings.resolveQuestions.toFixed(2)}s`);

  const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
  const engine = new VuiHocExamEngine(bridge);

  // Pool CMS - đánh dấu `answered` khi ĐÃ trả lời thành công, KHÔNG dựa vào index tuần tự.
  const pool = questions.map((q) => ({ question: q, answered: false }));

  // Safety cap - KHÔNG hardcode "times: 25": đủ số câu + margin nhỏ cho vòng lặp cuối (phát hiện
  // màn Kết quả) - KHÔNG phải điều kiện thiết kế chính, chỉ chặn lặp vô hạn nếu app kẹt thật.
  const maxIterations = questions.length + 3;

  let iter = 0;
  for (; iter < maxIterations; iter++) {
    const tree = bridge.hierarchy();

    if (engine.isResultScreen(tree)) {
      // DỪNG NGAY - KHÔNG bấm/thao tác gì thêm trước khi capture (yêu cầu bắt buộc).
      resultTimestamp = new Date().toISOString();
      finalResult = engine.readResult(tree);
      mkdirSync(OUTPUT_DIR, { recursive: true });
      const screenshotName = `vuihoc_result_${resultTimestamp.replace(/[:.]/g, "-")}.png`;
      resultScreenshotPath = join(OUTPUT_DIR, screenshotName);
      try {
        captureScreenshotViaAdb(config.deviceId || undefined, resultScreenshotPath);
      } catch (err) {
        log(`[runVuiHocExercise] CẢNH BÁO: chụp màn Kết quả qua adb thất bại: ${err.message}`);
        resultScreenshotPath = null;
      }
      log(`[runVuiHocExercise] Đã tới màn Kết quả sau ${iter} câu.`);
      break;
    }

    const uiType = detectQuestionUiType(tree);
    if (!uiType) {
      stoppedReason = "UNKNOWN_SCREEN_TYPE";
      mkdirSync(OUTPUT_DIR, { recursive: true });
      try {
        captureScreenshotViaAdb(config.deviceId || undefined, join(OUTPUT_DIR, `vuihoc_unknown_screen_iter${iter}.png`));
      } catch {
        /* best-effort */
      }
      log(`[runVuiHocExercise] DỪNG - không nhận diện được UI type của màn hiện tại (vòng lặp ${iter}).`);
      break;
    }

    let entry;
    try {
      entry = findMatchingPoolEntry(tree, uiType, pool);
    } catch (err) {
      stoppedReason = `MATCH_ERROR: ${err.message}`;
      log(`[runVuiHocExercise] DỪNG - ${err.message}`);
      break;
    }

    const testCallsBefore = bridge.testInvocationCount;
    const hierarchyCallsBefore = bridge.hierarchyInvocationCount;
    const qStart = nowNs();
    let outcome;
    try {
      outcome = await engine.answerCurrentQuestion(entry.question, { maxAttempts: maxAttemptsPerQuestion, tree, uiType });
    } catch (err) {
      outcome = { supported: false, reason: `THROW: ${err.message}` };
    }
    const qSeconds = secondsSince(qStart);
    entry.answered = true;

    const record = {
      cmsId: entry.question.id,
      cmsType: entry.question.type,
      uiType,
      seconds: qSeconds,
      testInvocations: bridge.testInvocationCount - testCallsBefore,
      hierarchyInvocations: bridge.hierarchyInvocationCount - hierarchyCallsBefore,
      ...outcome,
    };
    timings.perQuestion.push({ cmsId: entry.question.id, type: entry.question.type, seconds: qSeconds });
    perQuestionResults.push(record);
    log(
      `[runVuiHocExercise] Câu ${perQuestionResults.length} (cmsType=${entry.question.type}, uiType=${uiType}) -> ` +
        `supported=${outcome.supported} correct=${outcome.correct} attempts=${outcome.attempts} (${qSeconds.toFixed(2)}s, ` +
        `${record.testInvocations} runSteps + ${record.hierarchyInvocations} hierarchy)`,
    );

    if (!outcome.supported) {
      stoppedReason = "UNSUPPORTED_QUESTION";
      mkdirSync(OUTPUT_DIR, { recursive: true });
      try {
        captureScreenshotViaAdb(config.deviceId || undefined, join(OUTPUT_DIR, `vuihoc_blocked_${entry.question.id}.png`));
      } catch {
        /* best-effort */
      }
      log(`[runVuiHocExercise] DỪNG - câu "${entry.question.id}" không được hỗ trợ: ${outcome.reason}`);
      break;
    }
  }

  if (!finalResult && iter >= maxIterations) {
    stoppedReason = "MAX_ITERATIONS_REACHED_WITHOUT_RESULT_SCREEN";
    log(`[runVuiHocExercise] CẢNH BÁO: đã lặp ${maxIterations} lần (>= ${questions.length} câu + margin) nhưng chưa thấy màn Kết quả.`);
  }

  timings.total = secondsSince(overallStart);
  const summary = {
    resolveInfo,
    maxAttemptsPerQuestion,
    stoppedReason,
    finalResult,
    resultScreenshotPath,
    resultTimestamp,
    perQuestionResults,
    benchmark: {
      questionsAnswered: perQuestionResults.length,
      correctCount: perQuestionResults.filter((r) => r.correct === true).length,
      incorrectCount: perQuestionResults.filter((r) => r.correct === false).length,
      unknownVerdictCount: perQuestionResults.filter((r) => r.correct === null).length,
      totalRetryAttempts: perQuestionResults.reduce((s, r) => s + (r.attempts > 1 ? r.attempts - 1 : 0), 0),
      totalMaestroTestInvocations: bridge.testInvocationCount,
      totalMaestroHierarchyInvocations: bridge.hierarchyInvocationCount,
      totalMaestroProcessLaunches: bridge.testInvocationCount + bridge.hierarchyInvocationCount,
    },
    timings: {
      resolveQuestionsSeconds: timings.resolveQuestions,
      perQuestionSeconds: timings.perQuestion,
      averagePerQuestionSeconds:
        timings.perQuestion.length > 0
          ? timings.perQuestion.reduce((s, q) => s + q.seconds, 0) / timings.perQuestion.length
          : null,
      totalSeconds: timings.total,
    },
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(RESULT_FILE, JSON.stringify(summary, null, 2), "utf8");
  log(`[runVuiHocExercise] Kết quả ghi tại ${RESULT_FILE}`);
  log(`[runVuiHocExercise] ĐIỂM SỐ: ${JSON.stringify(finalResult)}`);
  log(`[runVuiHocExercise] Screenshot màn Kết quả: ${resultScreenshotPath}`);
  log(
    `[runVuiHocExercise] Tổng thời gian: ${timings.total.toFixed(2)}s, TB/câu: ${summary.timings.averagePerQuestionSeconds?.toFixed(2)}s, ` +
      `${summary.benchmark.totalMaestroProcessLaunches} lượt Maestro CLI (${bridge.testInvocationCount} test + ${bridge.hierarchyInvocationCount} hierarchy)`,
  );
}

main().catch((err) => {
  console.error("[runVuiHocExercise] LỖI:", err);
  process.exit(1);
});
