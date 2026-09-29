#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../src/config.js";
import { MaestroBridge } from "../bridge/maestroBridge.js";
import { NavigationEngine } from "../navigation/navigationEngine.js";
import { VuiHocExamEngine } from "./vuiHocExamEngine.js";
import { runVuiHocQuestionPool } from "./vuiHocExamRunner.js";
import { pickRandomExerciseWithRetry } from "../discovery/cli.js";
import { getEntityId, getEntityName } from "../discovery/entityId.js";

/**
 * "Random Vui học Exercise E2E": random 1 Book(SELF_LEARN)/Unit(published)/Lesson/Exercise THẬT
 * qua CMS, tự điều hướng trên thiết bị vào đúng bài, rồi làm bài THẬT (đáp án đúng từ CMS) tới
 * màn Kết quả - KHÔNG cần chỉ định tên trước (khác hẳn runVuiHocExercise.mjs, vốn yêu cầu
 * BOOK_NAME/UNIT_NAME/LESSON_NAME/EXERCISE_NAME VÀ giả định thiết bị đã đứng sẵn ở đúng câu hỏi).
 *
 * TÁI SỬ DỤNG TOÀN BỘ (không viết lại):
 *   - `discovery/cli.js#pickRandomExerciseWithRetry()` - CHÍNH XÁC cơ chế random CMS đã dùng bởi
 *     `npm run discover` (lọc Book type=SELF_LEARN + Unit status=done, retry 10 lần khi ngõ cụt) -
 *     export thêm (không đổi hành vi `npm run discover`, xem guard entrypoint cuối file đó).
 *   - `navigation/navigationEngine.js#NavigationEngine` - điều hướng Book -> Unit -> Lesson ->
 *     Exercise trên thiết bị thật, đã dùng bởi `runtime/index.js` (pipeline discover/generate-flow
 *     cũ) - dùng lại nguyên vẹn, KHÔNG viết navigation riêng cho Vui học.
 *   - `vuiHocExamEngine.js#VuiHocExamEngine` + `vuiHocExamRunner.js#runVuiHocQuestionPool()` -
 *     CÙNG vòng lặp trả lời/match câu đã dùng bởi runVuiHocExercise.mjs (tách chung 2026-09-29,
 *     xem docblock vuiHocExamRunner.js) - không viết lại state machine Kiểm tra/Thử lại/Tiếp tục.
 *
 * 4 BUG THẬT ĐÃ SỬA TRONG `NavigationEngine` (2026-09-29, live-verify nhiều vòng trên thiết bị
 * 3201d866d40a1681 - MODULE DÙNG CHUNG với `runtime/index.js`, không phải lỗi riêng của Vui học,
 * xem docblock chi tiết + evidence từng bug tại đúng vị trí trong navigationEngine.js):
 *   1. `_ensureBookSelectedSteps()`: selector đổi Khối `leftOf: "Chuyển profile"` FAIL 100%
 *      (khớp bug đã ghi nhận trong memory "Navigation selector + card-locate bugs") - UI hiện tại
 *      render "Khối X" là text tự nó tappable, không còn đúng vị trí `leftOf` giải quyết được -
 *      sửa bằng id thật `happy_learning_book_selector` (đọc từ screen-hierarchy thật).
 *   2. `_ensureUnitOpenSteps()`: timeout cuộn tìm Unit (20s) quá ngắn cho Book nhiều Unit (xác
 *      nhận: Unit "Review 2" của Khối 9 cần cuộn qua Unit 6+ mới tới, 20s chỉ đủ ~6 lượt swipe) -
 *      tăng lên 60s (cùng nguyên nhân/cách sửa đã áp dụng cho flows/app/helpers/open-exercise.yaml
 *      trước đây).
 *   3. `_openLessonSteps()`: tap "\\d+ / \\d+" (thanh tiến độ) không mở được danh sách hoạt động
 *      cho phần lớn Lesson gặp thật - mỗi Lesson card thật ra có id
 *      `happy_learning_lesson_{i}_open` (nút mũi tên "→", KHÁC `_toggle`) mới là nút mở đúng -
 *      sửa ưu tiên tap `_open`, fallback về tap tiến độ cũ nếu Lesson không có `_open`.
 *   4. `_ensureBookSelectedSteps()`: thiếu thời gian chờ settle sau khi đổi Khối - `bookName` hiện
 *      lên gần như ngay (chỉ đổi header) nhưng nội dung thật (banner + link "Tất cả units") vẫn
 *      đang tải, khiến bước điều hướng Unit ngay sau đó fail "not found" dù chỉ cần chờ thêm - đã
 *      xác nhận qua 2 screenshot CÙNG 1 màn "Unit 1..." lúc có/lúc chưa banner - thêm
 *      `waitForAnimationToEnd` sau khi đổi Khối.
 *
 * RETRY + RESET (thêm ở FILE NÀY, không phải NavigationEngine): NAVIGATE có thể fail giữa chừng
 * và để app kẹt ở màn con (không có tab bar) - lượt retry kế tiếp xuất phát từ màn kẹt đó thay vì
 * tab gốc sẽ fail vì lý do KHÁC HẲN (cascade sai lệch nguyên nhân thật) - `resetToVuiHocHome()`
 * chạy giữa các lượt retry để cắt đứt cascade này.
 *
 * GIỚI HẠN CÒN LẠI - CHƯA SỬA, CHẤP NHẬN THEO QUYẾT ĐỊNH CỦA USER (2026-09-29): rất nhiều Lesson
 * trong kho nội dung CMS hiện tại hiển thị dạng NHÓM LỒNG NHAU ("Thử thách 1/2/3"... - phải bấm mở
 * từng nhóm con mới thấy Exercise thật bên trong), không phải danh sách hoạt động PHẲNG mà
 * `_openExerciseSteps()`'s `scrollUntilVisible` giả định. ĐÃ ĐO THẬT qua nhiều batch live-test:
 * tỉ lệ gặp dạng nhóm lồng nhau CAO HƠN NHIỀU so với ước tính ban đầu trong NavigationEngine cũ
 * ("hiếm gặp") - phần lớn lượt random rơi vào dạng này, khiến `MAX_NAVIGATE_ATTEMPTS` mặc định (5)
 * thường KHÔNG đủ để random trúng 1 Exercise dạng phẳng. Workaround hiện tại (retry + random lại
 * hoàn toàn khi NAVIGATE fail) vẫn ĐÚNG và AN TOÀN (không đoán/không tự mở nhầm nhóm) nhưng có tỉ
 * lệ thành công thấp trong 1 lượt chạy ngắn - tăng `MAX_NAVIGATE_ATTEMPTS` qua env nếu cần tăng cơ
 * hội, hoặc xem đây là việc cần thiết kế riêng (tự phát hiện + mở đúng nhóm con) cho 1 phiên sau.
 *
 * GIẢ ĐỊNH (giống mọi runtime khác trong automation/): thiết bị Android thật đang kết nối, app đã
 * mở, ĐÃ đăng nhập sẵn, đang ở tab gốc "Vui học" (xem NavigationEngine).
 *
 * Chạy: node automation/vui_hoc/runVuiHocRandomExercise.mjs
 *       (tuỳ chọn: MAX_ATTEMPTS_PER_QUESTION=3, MAX_NAVIGATE_ATTEMPTS=5)
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");
const RESULT_FILE = join(OUTPUT_DIR, "vuihoc_random_exercise_run_result.json");

function nowNs() {
  return process.hrtime.bigint();
}
function secondsSince(startNs) {
  return Number(nowNs() - startNs) / 1e9;
}
function log(...args) {
  console.log(...args);
}

function safeGetId(entity) {
  try {
    return getEntityId(entity);
  } catch {
    return undefined;
  }
}

function toRef(entity) {
  return { id: safeGetId(entity), name: getEntityName(entity) };
}

/**
 * Đưa app về lại tab gốc "Vui học" SAU 1 lượt NAVIGATE fail - BUG THẬT đã gặp (2026-09-29,
 * live-verify): `NavigationEngine.navigateTo()` có thể fail GIỮA CHỪNG (vd hết timeout cuộn tìm
 * Unit - xem fix timeout trong navigationEngine.js), để app kẹt lại ở màn con (vd "Danh sách
 * Units") KHÔNG có tab bar/"Chuyển profile" - lượt random+navigate KẾ TIẾP trong vòng lặp retry
 * bên dưới xuất phát từ màn kẹt đó thay vì tab gốc như `navigateTo()` giả định, khiến lỗi CASCADE
 * sai lệch hẳn nguyên nhân thật (đã xác nhận: 4/5 lượt "FAIL" trong 1 lần chạy thật chỉ là hệ quả
 * của lượt đầu kẹt màn, không phải lỗi thật ở Book/Unit/Lesson/Exercise của các lượt sau).
 *
 * Bấm "back" tối đa 3 lần (mỗi lần chỉ chạy KHI CHƯA thấy lại nhãn tab "Vui học" - bounded, không
 * lặp vô hạn/không có rủi ro bấm back dư ra khỏi hẳn app) rồi tap thẳng vào tab theo id
 * `tab_happy_learning` (id thật, tái sử dụng nguyên văn từ
 * flows/app/helpers/open-vuihoc-connect.yaml - không phụ thuộc locale/nhãn a11y).
 *
 * LƯU Ý: `backIfNeeded()` PHẢI là hàm trả về object MỚI mỗi lần gọi, KHÔNG phải 1 object literal
 * dùng lại nhiều lần trong cùng mảng `steps` - BUG THẬT đã gặp khi live-verify (cùng bug đã ghi
 * nhận trong vuiHocExamEngine.js#checkButtonTap()): tái dùng 1 tham chiếu khiến `js-yaml` tự phát
 * sinh YAML anchor/alias (`&ref_0`/`*ref_0`) mà Maestro không hỗ trợ ("Invalid Command: ref_0"),
 * làm cả `runSteps()` fail ngay từ bước đầu.
 */
function backIfNeeded() {
  return { runFlow: { when: { notVisible: "Vui học" }, commands: ["back", { waitForAnimationToEnd: { timeout: 1000 } }] } };
}

async function resetToVuiHocHome(bridge) {
  await bridge.runSteps([backIfNeeded(), backIfNeeded(), backIfNeeded(), { tapOn: { id: "tab_happy_learning" } }, { waitForAnimationToEnd: { timeout: 1500 } }]);
}

async function main() {
  const maxAttemptsPerQuestion = Number(process.env.MAX_ATTEMPTS_PER_QUESTION || 3);
  const maxNavigateAttempts = Number(process.env.MAX_NAVIGATE_ATTEMPTS || 5);
  const overallStart = nowNs();

  const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
  const nav = new NavigationEngine(bridge);

  let discoverInfo = null;
  let questions = null;
  let discoverSeconds = 0;
  let navigateSeconds = 0;
  let navigateError = null;
  const navigateAttempts = [];

  for (let attempt = 1; attempt <= maxNavigateAttempts; attempt++) {
    log(`\n[DISCOVER] (lượt ${attempt}/${maxNavigateAttempts}) Random Book(SELF_LEARN) -> Unit(published) -> Lesson -> Exercise qua CMS...`);
    const discoverStart = nowNs();
    const { book, unit, lesson, exerciseItem, exercise, examData, questions: pickedQuestions } = await pickRandomExerciseWithRetry();
    discoverSeconds = secondsSince(discoverStart);

    const navTarget = { book: toRef(book), unit: toRef(unit), lesson: toRef(lesson), exercise: toRef(exercise) };
    discoverInfo = {
      book: navTarget.book,
      unit: navTarget.unit,
      lesson: navTarget.lesson,
      exerciseItem: toRef(exerciseItem),
      exercise: navTarget.exercise,
      examId: examData.examId,
      examName: examData.examName,
      totalQuestions: pickedQuestions.length,
      types: pickedQuestions.map((q) => q.type),
    };
    log(`[DISCOVER] Book: ${navTarget.book.name}`);
    log(`[DISCOVER] Unit: ${navTarget.unit.name}`);
    log(`[DISCOVER] Lesson: ${navTarget.lesson.name}`);
    log(`[DISCOVER] Exercise: ${navTarget.exercise.name}`);
    log(`[DISCOVER] Exam: ${examData.examName} (${examData.examId}) - ${pickedQuestions.length} câu: ${discoverInfo.types.join(", ")}`);
    log(`[DISCOVER] Thời gian random CMS: ${discoverSeconds.toFixed(2)}s`);

    log("\n[NAVIGATE] Điều hướng trên thiết bị vào đúng bài...");
    const navigateStart = nowNs();
    navigateError = null;
    try {
      await nav.navigateTo(navTarget);
    } catch (err) {
      navigateError = err.message;
    }
    navigateSeconds = secondsSince(navigateStart);
    navigateAttempts.push({ attempt, discoverInfo, navigateError, navigateSeconds });

    if (!navigateError) {
      questions = pickedQuestions;
      log(`[NAVIGATE] Đã vào đúng bài (${navigateSeconds.toFixed(2)}s).`);
      break;
    }

    // Ngõ cụt CÓ THỂ GẶP (xem docblock đầu file): (1) Exercise nằm trong Lesson Item lồng nhau,
    // không hiện trực tiếp trong danh sách phẳng, hoặc (2) hết timeout cuộn tìm Unit/Lesson/
    // Exercise (đã tăng lên 60s trong navigationEngine.js nhưng vẫn có thể chưa đủ với danh sách
    // rất dài) - cả 2 đều random lại HOÀN TOÀN, không cố tự sửa.
    log(`[NAVIGATE] FAIL (lượt ${attempt}/${maxNavigateAttempts}): ${navigateError}`);
    if (attempt < maxNavigateAttempts) {
      log(`[NAVIGATE] Đưa app về tab gốc "Vui học" trước khi random lại (tránh cascade từ màn kẹt)...`);
      await resetToVuiHocHome(bridge);
      log(`[NAVIGATE] Random lại Exercise khác...`);
    }
  }

  if (navigateError) {
    const summary = {
      discoverInfo,
      maxAttemptsPerQuestion,
      maxNavigateAttempts,
      stoppedReason: "NAVIGATE_FAILED",
      navigateError,
      navigateAttempts,
      finalResult: null,
      resultScreenshotPath: null,
      resultTimestamp: null,
      perQuestionResults: [],
      timings: { discoverSeconds, navigateSeconds, totalSeconds: secondsSince(overallStart) },
    };
    mkdirSync(OUTPUT_DIR, { recursive: true });
    writeFileSync(RESULT_FILE, JSON.stringify(summary, null, 2), "utf8");
    log(`\n[runVuiHocRandomExercise] Đã hết ${maxNavigateAttempts} lượt random+navigate, đều FAIL.`);
    log(`[runVuiHocRandomExercise] Kết quả (FAIL) ghi tại ${RESULT_FILE}`);
    process.exitCode = 1;
    return;
  }

  const engine = new VuiHocExamEngine(bridge);
  log("\n[ANSWER] Trả lời từng câu (đáp án đúng từ CMS) tới màn Kết quả...");
  const runOutcome = await runVuiHocQuestionPool({
    bridge,
    engine,
    questions,
    maxAttemptsPerQuestion,
    deviceId: config.deviceId || undefined,
    outputDir: OUTPUT_DIR,
    screenshotPrefix: "vuihoc_random",
  });

  const summary = {
    discoverInfo,
    maxAttemptsPerQuestion,
    maxNavigateAttempts,
    stoppedReason: runOutcome.stoppedReason,
    navigateError: null,
    navigateAttempts,
    finalResult: runOutcome.finalResult,
    resultScreenshotPath: runOutcome.resultScreenshotPath,
    resultTimestamp: runOutcome.resultTimestamp,
    perQuestionResults: runOutcome.perQuestionResults,
    benchmark: runOutcome.benchmark,
    timings: {
      discoverSeconds,
      navigateSeconds,
      // Thời gian LÀM BÀI THẬT (chỉ vòng lặp trả lời câu hỏi, KHÔNG tính discover CMS/điều
      // hướng vào bài) - đúng bằng `runOutcome.timings.totalSeconds` của vuiHocExamRunner.js
      // (đo từ câu đầu tiên tới lúc dừng/tới màn Kết quả) - tách riêng khỏi `totalSeconds` tổng
      // của cả script để trả lời được câu hỏi "làm bài mất bao lâu" mà không lẫn thời gian
      // discover/navigate.
      answerSeconds: runOutcome.timings.totalSeconds,
      perQuestionSeconds: runOutcome.timings.perQuestionSeconds,
      averagePerQuestionSeconds: runOutcome.timings.averagePerQuestionSeconds,
      totalSeconds: secondsSince(overallStart),
    },
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(RESULT_FILE, JSON.stringify(summary, null, 2), "utf8");
  log(`\n[runVuiHocRandomExercise] Kết quả ghi tại ${RESULT_FILE}`);
  log(`[runVuiHocRandomExercise] ĐIỂM SỐ: ${JSON.stringify(summary.finalResult)}`);
  log(`[runVuiHocRandomExercise] Screenshot màn Kết quả: ${summary.resultScreenshotPath}`);
  log(
    `[runVuiHocRandomExercise] Thời gian LÀM BÀI (không tính discover/navigate): ` +
      `${summary.timings.answerSeconds.toFixed(2)}s cho ${summary.benchmark.questionsAnswered} câu.`,
  );
  log(
    `[runVuiHocRandomExercise] Tổng thời gian (discover ${discoverSeconds.toFixed(2)}s + navigate ${navigateSeconds.toFixed(2)}s + làm bài ${summary.timings.answerSeconds.toFixed(2)}s) = ${summary.timings.totalSeconds.toFixed(2)}s, TB/câu: ` +
      `${summary.timings.averagePerQuestionSeconds?.toFixed(2)}s, ${summary.benchmark.totalMaestroProcessLaunches} lượt Maestro CLI ` +
      `(${bridge.testInvocationCount} test + ${bridge.hierarchyInvocationCount} hierarchy)`,
  );
  if (summary.stoppedReason !== "COMPLETED") process.exitCode = 1;
}

main().catch((err) => {
  console.error("[runVuiHocRandomExercise] LỖI:", err);
  process.exit(1);
});
