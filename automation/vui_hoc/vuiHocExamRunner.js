import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { findMatchingPoolEntry, detectQuestionUiType } from "./vuiHocQuestionMatcher.js";

/**
 * Vòng lặp lõi "đọc hierarchy -> detect UI type -> match pool -> answerCurrentQuestion -> lặp tới
 * màn Kết quả" - TÁCH RA (2026-09-29) từ runVuiHocExercise.mjs để dùng chung với
 * runVuiHocRandomExercise.mjs (random CMS, KHÔNG resolve theo tên) - KHÔNG đổi hành vi so với
 * bản gốc trong runVuiHocExercise.mjs, chỉ đổi chỗ ở.
 *
 * KHÔNG chịu trách nhiệm resolve câu hỏi (theo tên hay random) hay điều hướng vào bài - đó là việc
 * của caller, truyền sẵn `questions` (mảng QuestionModel) + `bridge`/`engine` đã sẵn sàng, ĐANG
 * ĐỨNG Ở 1 câu hỏi (bất kỳ) của đúng Exercise.
 */
function nowNs() {
  return process.hrtime.bigint();
}
function secondsSince(startNs) {
  return Number(nowNs() - startNs) / 1e9;
}
function log(...args) {
  console.log(...args);
}

/** Chụp màn hình THẬT qua `adb exec-out screencap` trực tiếp - KHÔNG qua Maestro (xem lý do gốc
 * trong runVuiHocExercise.mjs trước khi tách file này). Export (2026-09-29) để
 * runVuiHocRandomExercise.mjs tái sử dụng NGUYÊN VẸN cho screenshot "bắt đầu execution Vui học"
 * (checkpoint cuối của bộ 5 screenshot debug nested-group) thay vì viết lại hàm capture riêng. */
export function captureScreenshotViaAdb(deviceId, outPath) {
  const args = deviceId ? ["-s", deviceId, "exec-out", "screencap", "-p"] : ["exec-out", "screencap", "-p"];
  const png = execFileSync("adb", args, { maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(outPath, png);
  return outPath;
}

/**
 * @param {{
 *   bridge: import("../bridge/maestroBridge.js").MaestroBridge,
 *   engine: import("./vuiHocExamEngine.js").VuiHocExamEngine,
 *   questions: import("../model/questionModel.js").QuestionModel[],
 *   maxAttemptsPerQuestion?: number,
 *   deviceId?: string,
 *   outputDir: string,
 *   screenshotPrefix?: string,
 * }} params
 * @returns {Promise<Object>} kết quả chạy (KHÔNG bao gồm resolveInfo/discoverInfo riêng của
 *   caller) - caller tự gộp thêm phần của mình rồi ghi ra file kết quả riêng.
 */
export async function runVuiHocQuestionPool({
  bridge,
  engine,
  questions,
  maxAttemptsPerQuestion = 3,
  deviceId,
  outputDir,
  screenshotPrefix = "vuihoc",
}) {
  const overallStart = nowNs();
  const timings = { perQuestion: [], total: null };
  const perQuestionResults = [];
  let stoppedReason = "COMPLETED";
  let finalResult = null;
  let resultScreenshotPath = null;
  let resultTimestamp = null;

  // Pool CMS - đánh dấu `answered` khi ĐÃ trả lời thành công, KHÔNG dựa vào index tuần tự.
  const pool = questions.map((q) => ({ question: q, answered: false }));

  // Safety cap - KHÔNG hardcode: đủ số câu + margin nhỏ cho vòng lặp cuối (phát hiện màn Kết
  // quả) - KHÔNG phải điều kiện thiết kế chính, chỉ chặn lặp vô hạn nếu app kẹt thật.
  const maxIterations = questions.length + 3;

  let iter = 0;
  for (; iter < maxIterations; iter++) {
    const tree = bridge.hierarchy();

    if (engine.isResultScreen(tree)) {
      // DỪNG NGAY - KHÔNG bấm/thao tác gì thêm trước khi capture (yêu cầu bắt buộc).
      resultTimestamp = new Date().toISOString();
      finalResult = engine.readResult(tree);
      mkdirSync(outputDir, { recursive: true });
      const screenshotName = `${screenshotPrefix}_result_${resultTimestamp.replace(/[:.]/g, "-")}.png`;
      resultScreenshotPath = `${outputDir}/${screenshotName}`;
      try {
        captureScreenshotViaAdb(deviceId, resultScreenshotPath);
      } catch (err) {
        log(`[vuiHocExamRunner] CẢNH BÁO: chụp màn Kết quả qua adb thất bại: ${err.message}`);
        resultScreenshotPath = null;
      }
      log(`[vuiHocExamRunner] Đã tới màn Kết quả sau ${iter} câu.`);
      break;
    }

    const uiType = detectQuestionUiType(tree);
    if (!uiType) {
      stoppedReason = "UNKNOWN_SCREEN_TYPE";
      mkdirSync(outputDir, { recursive: true });
      try {
        captureScreenshotViaAdb(deviceId, `${outputDir}/${screenshotPrefix}_unknown_screen_iter${iter}.png`);
      } catch {
        /* best-effort */
      }
      log(`[vuiHocExamRunner] DỪNG - không nhận diện được UI type của màn hiện tại (vòng lặp ${iter}).`);
      break;
    }

    let entry;
    try {
      entry = findMatchingPoolEntry(tree, uiType, pool);
    } catch (err) {
      stoppedReason = `MATCH_ERROR: ${err.message}`;
      log(`[vuiHocExamRunner] DỪNG - ${err.message}`);
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
      `[vuiHocExamRunner] Câu ${perQuestionResults.length} (cmsType=${entry.question.type}, uiType=${uiType}) -> ` +
        `supported=${outcome.supported} correct=${outcome.correct} attempts=${outcome.attempts} (${qSeconds.toFixed(2)}s, ` +
        `${record.testInvocations} runSteps + ${record.hierarchyInvocations} hierarchy)`,
    );

    if (!outcome.supported) {
      stoppedReason = "UNSUPPORTED_QUESTION";
      mkdirSync(outputDir, { recursive: true });
      try {
        captureScreenshotViaAdb(deviceId, `${outputDir}/${screenshotPrefix}_blocked_${entry.question.id}.png`);
      } catch {
        /* best-effort */
      }
      log(`[vuiHocExamRunner] DỪNG - câu "${entry.question.id}" không được hỗ trợ: ${outcome.reason}`);
      break;
    }
  }

  if (!finalResult && iter >= maxIterations) {
    stoppedReason = "MAX_ITERATIONS_REACHED_WITHOUT_RESULT_SCREEN";
    log(`[vuiHocExamRunner] CẢNH BÁO: đã lặp ${maxIterations} lần (>= ${questions.length} câu + margin) nhưng chưa thấy màn Kết quả.`);
  }

  timings.total = secondsSince(overallStart);

  return {
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
      perQuestionSeconds: timings.perQuestion,
      averagePerQuestionSeconds:
        timings.perQuestion.length > 0
          ? timings.perQuestion.reduce((s, q) => s + q.seconds, 0) / timings.perQuestion.length
          : null,
      totalSeconds: timings.total,
    },
  };
}
