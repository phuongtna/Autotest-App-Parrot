#!/usr/bin/env node
// TEMP controlled verification (per user request 2026-10-01: "chạy E2E test đúng 1 bài
// Self-Learning thực tế" với target BẮT BUỘC nằm trong 1 group lồng nhau - không phẳng).
//
// KHÁC vui_hoc/runVuiHocRandomExercise.mjs ở 2 điểm, đúng yêu cầu của user:
//   1. Target chọn ở đây PHẢI có groupPath.length > 0 (lồng trong >=1 Lesson Item type=GROUP) -
//      lọc CMS, retry CHỈ ở bước discovery/CMS (chưa đụng thiết bị) tới khi tìm được 1 target
//      thật thoả điều kiện này.
//   2. Một khi đã LOCK target (đã đụng thiết bị, bắt đầu navigateTo()), KHÔNG random sang target
//      khác nếu navigate/answer FAIL - khác hẳn resetToVuiHocHome()+random-lại của
//      runVuiHocRandomExercise.mjs. Script này gọi navigateTo() ĐÚNG 1 LẦN rồi dừng lại debug tại
//      chỗ nếu fail, đúng yêu cầu "giữ nguyên target và debug đúng failure".
//
// TÁI SỬ DỤNG TOÀN BỘ (không viết lại):
//   - discovery/cli.js#pickExerciseAttempt() - CHÍNH cơ chế random CMS (Book SELF_LEARN/Unit
//     published/Lesson/Exercise) đã dùng bởi `npm run discover` - gọi lặp lại (bounded) CHỈ để lọc
//     ra 1 kết quả có groupPath lồng nhau, không đổi hành vi hàm đó.
//   - navigation/navigationEngine.js#NavigationEngine.navigateTo({groups}) - đã tự traverse group
//     lồng nhau (bất kỳ độ sâu), đã tự chụp screenshot nav_lesson_before_groups/nav_group_N_opened/
//     nav_target_found/nav_target_opened (xem docblock _openGroupSteps()/_openExerciseSteps()).
//   - vui_hoc/vuiHocExamEngine.js + vuiHocExamRunner.js#runVuiHocQuestionPool() - đúng vòng lặp
//     "bàn giao cho Vui học automation" đã dùng bởi 2 script kia, không viết lại state machine.
import { writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "./src/config.js";
import { MaestroBridge } from "./bridge/maestroBridge.js";
import { NavigationEngine } from "./navigation/navigationEngine.js";
import { VuiHocExamEngine } from "./vui_hoc/vuiHocExamEngine.js";
import { runVuiHocQuestionPool, captureScreenshotViaAdb } from "./vui_hoc/vuiHocExamRunner.js";
import { pickExerciseAttempt } from "./discovery/cli.js";
import { getEntityId, getEntityName } from "./discovery/entityId.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");
const DEVICE_ID = config.deviceId || "3201d866d40a1681";
const MAX_DISCOVERY_ATTEMPTS = 40; // chỉ dò CMS, chưa đụng thiết bị - KHÔNG tính vào "random khi fail".

function log(...a) {
  console.log(...a);
}
function toRef(entity) {
  try {
    return { id: getEntityId(entity), name: getEntityName(entity) };
  } catch {
    return { name: getEntityName(entity) };
  }
}
function nowNs() {
  return process.hrtime.bigint();
}
function secondsSince(startNs) {
  return Number(nowNs() - startNs) / 1e9;
}

/** Tìm screenshot PNG mới nhất Maestro vừa ghi khớp 1 phần tên (vd "nav_target_found") trong
 * ~/.maestro/tests/<timestamp>/.../screenshots/ - Maestro tự quyết định thư mục theo tên flow,
 * không điều khiển được từ Bridge, nên dò theo mtime mới nhất sau khi biết chắc bước đó đã chạy. */
function findLatestMaestroScreenshot(namePart, sinceMs) {
  const root = join(process.env.HOME || "/root", ".maestro", "tests");
  if (!existsSync(root)) return null;
  let best = null;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(p);
      } else if (entry.isFile() && entry.name.includes(namePart) && entry.name.endsWith(".png")) {
        const st = statSync(p);
        if (st.mtimeMs >= sinceMs && (!best || st.mtimeMs > best.mtimeMs)) best = { path: p, mtimeMs: st.mtimeMs };
      }
    }
  };
  try {
    walk(root);
  } catch {
    /* best-effort */
  }
  return best?.path ?? null;
}

async function findNestedGroupTarget() {
  for (let attempt = 1; attempt <= MAX_DISCOVERY_ATTEMPTS; attempt++) {
    let picked;
    try {
      picked = await pickExerciseAttempt();
    } catch (err) {
      log(`[DISCOVERY] lượt ${attempt}/${MAX_DISCOVERY_ATTEMPTS} lỗi CMS (${err.message}) - thử lại...`);
      continue;
    }
    if (picked.groupPath.length === 0) {
      log(
        `[DISCOVERY] lượt ${attempt}/${MAX_DISCOVERY_ATTEMPTS}: "${getEntityName(picked.exercise)}" ` +
          `nằm TRỰC TIẾP dưới Lesson (phẳng) - cần target lồng trong group, thử lại...`,
      );
      continue;
    }
    log(`[DISCOVERY] lượt ${attempt}/${MAX_DISCOVERY_ATTEMPTS}: TÌM THẤY target lồng trong group.`);
    return picked;
  }
  throw new Error(`Không tìm được Exercise nào lồng trong group sau ${MAX_DISCOVERY_ATTEMPTS} lượt CMS.`);
}

async function main() {
  const overallStart = nowNs();
  const checkpoints = {};

  log("=== BƯỚC 1: Tìm 1 target Self-Learning THẬT nằm trong nested group (CMS, chưa đụng thiết bị) ===");
  const discoverStart = nowNs();
  const picked = await findNestedGroupTarget();
  const discoverSeconds = secondsSince(discoverStart);
  const { book, unit, lesson, exerciseItem, groupPath, exercise, examData, questions } = picked;

  checkpoints.unit = toRef(unit);
  checkpoints.lesson = toRef(lesson);
  checkpoints.groupPathInOrder = groupPath.map(toRef);
  checkpoints.targetContent = {
    exercise: toRef(exercise),
    exerciseItem: toRef(exerciseItem),
    examId: examData.examId,
    examName: examData.examName,
    questionCount: questions.length,
    questionTypes: [...new Set(questions.map((q) => q.type))],
  };

  log(`[TARGET] Book: ${checkpoints.unit.name ? "(xem Unit)" : ""}`);
  log(`[TARGET] Book: ${toRef(book).name}`);
  log(`[TARGET] Unit đã chọn: ${checkpoints.unit.name}`);
  log(`[TARGET] Lesson đã chọn: ${checkpoints.lesson.name}`);
  log(`[TARGET] Group lồng nhau theo thứ tự (root -> gần nhất): ${checkpoints.groupPathInOrder.map((g) => g.name).join(" > ")}`);
  log(`[TARGET] Target content (Exercise): ${checkpoints.targetContent.exercise.name}`);
  log(`[TARGET] Exam: ${examData.examName} (${examData.examId}) - ${questions.length} câu: ${checkpoints.targetContent.questionTypes.join(", ")}`);
  log(`[TARGET] Thời gian discovery CMS: ${discoverSeconds.toFixed(2)}s (${MAX_DISCOVERY_ATTEMPTS} lượt tối đa, chỉ CMS)`);
  log("[TARGET] LOCK target - từ đây không random sang target khác dù navigate/answer có fail.");

  const navTarget = {
    book: toRef(book),
    unit: checkpoints.unit,
    lesson: checkpoints.lesson,
    groups: checkpoints.groupPathInOrder,
    exercise: checkpoints.targetContent.exercise,
  };

  const bridge = new MaestroBridge({ appId: config.appId, deviceId: DEVICE_ID });
  const nav = new NavigationEngine(bridge);

  log("\n=== BƯỚC 2: NavigationEngine tự traverse group lồng nhau để mở target (1 lượt DUY NHẤT) ===");
  const navStart = nowNs();
  let navError = null;
  let failPhase = null;
  try {
    await nav.navigateTo(navTarget);
  } catch (err) {
    navError = err.message;
    failPhase = "NAVIGATION";
  }
  const navSeconds = secondsSince(navStart);

  // Screenshot bước 5/6 (trước/sau khi mở target) - NavigationEngine tự chụp "nav_target_found"
  // (ngay TRƯỚC khi tap mở target) và "nav_target_opened" (ngay SAU) bên trong navigateTo() -
  // dò lại file thật Maestro vừa ghi theo mtime (xem findLatestMaestroScreenshot()).
  const screenshotBefore = findLatestMaestroScreenshot("nav_target_found", navStart ? Number(navStart / 1000000n) : 0);
  const screenshotAfter = navError ? null : findLatestMaestroScreenshot("nav_target_opened", navStart ? Number(navStart / 1000000n) : 0);
  checkpoints.screenshotBeforeOpenTarget = screenshotBefore;
  checkpoints.screenshotAfterOpenTarget = screenshotAfter;
  log(`[NAV] Screenshot TRƯỚC khi mở target: ${screenshotBefore ?? "(không dò được file)"}`);
  log(`[NAV] Screenshot SAU khi mở target: ${screenshotAfter ?? "(không dò được file - navigate fail hoặc không tìm thấy)"}`);

  if (navError) {
    log(`\n[NAV] FAIL (${navSeconds.toFixed(2)}s): ${navError}`);
    log(`[NAV] KHÔNG random sang target khác - giữ nguyên target để debug.`);
    const summary = buildSummary({
      checkpoints,
      discoverSeconds,
      navSeconds,
      navError,
      failPhase,
      vuiHocStarted: false,
      runOutcome: null,
      overallStart,
    });
    writeResult(summary);
    printFinalReport(summary);
    process.exitCode = 1;
    return;
  }
  log(`[NAV] Đã mở target thành công (${navSeconds.toFixed(2)}s). Target vẫn đúng NGUYÊN từ BƯỚC 1 (không re-pick).`);

  log("\n=== BƯỚC 3: Bàn giao cho Vui học automation (VuiHocExamEngine + runVuiHocQuestionPool) ===");
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const handoffScreenshot = join(OUTPUT_DIR, `nested_group_vuihoc_started_${Date.now()}.png`);
  let vuiHocStarted = false;
  try {
    captureScreenshotViaAdb(DEVICE_ID, handoffScreenshot);
    vuiHocStarted = true;
    log(`[HANDOFF] Vui học automation BẮT ĐẦU - screenshot xác nhận: ${handoffScreenshot}`);
  } catch (err) {
    log(`[HANDOFF] CẢNH BÁO: không chụp được screenshot xác nhận bàn giao (${err.message}) - vẫn tiếp tục.`);
  }

  const engine = new VuiHocExamEngine(bridge);
  let runOutcome = null;
  let runError = null;
  try {
    runOutcome = await runVuiHocQuestionPool({
      bridge,
      engine,
      questions,
      maxAttemptsPerQuestion: Number(process.env.MAX_ATTEMPTS_PER_QUESTION || 3),
      deviceId: DEVICE_ID,
      outputDir: OUTPUT_DIR,
      screenshotPrefix: "nested_group",
    });
  } catch (err) {
    runError = err.message;
  }

  if (runError) {
    failPhase = "VUI_HOC_AUTOMATION";
  } else if (runOutcome.stoppedReason !== "COMPLETED") {
    const allAnswered = runOutcome.perQuestionResults.length >= questions.length;
    failPhase = allAnswered ? "SUBMIT_COMPLETE" : "VUI_HOC_AUTOMATION";
  }

  const summary = buildSummary({
    checkpoints,
    discoverSeconds,
    navSeconds,
    navError: null,
    failPhase,
    vuiHocStarted,
    handoffScreenshot: vuiHocStarted ? handoffScreenshot : null,
    runOutcome,
    runError,
    overallStart,
  });
  writeResult(summary);
  printFinalReport(summary);
  if (summary.completed) {
    log("\n=== KẾT LUẬN: Bài Self-Learning (nested group) đã HOÀN THÀNH - flow E2E hoạt động đúng. ===");
  } else {
    log(`\n=== KẾT LUẬN: CHƯA hoàn thành - fail ở: ${failPhase}. Giữ nguyên target để debug tiếp. ===`);
    process.exitCode = 1;
  }
}

function buildSummary({
  checkpoints,
  discoverSeconds,
  navSeconds,
  navError,
  failPhase,
  vuiHocStarted,
  handoffScreenshot,
  runOutcome,
  runError,
  overallStart,
}) {
  return {
    unit: checkpoints.unit,
    lesson: checkpoints.lesson,
    groupPathInOrder: checkpoints.groupPathInOrder,
    targetContent: checkpoints.targetContent,
    screenshotBeforeOpenTarget: checkpoints.screenshotBeforeOpenTarget,
    screenshotAfterOpenTarget: checkpoints.screenshotAfterOpenTarget,
    vuiHocAutomationStarted: vuiHocStarted,
    handoffScreenshot: handoffScreenshot ?? null,
    completed: !navError && !runError && runOutcome?.stoppedReason === "COMPLETED",
    failPhase: navError ? "NAVIGATION" : failPhase,
    navigationError: navError,
    runError: runError ?? null,
    stoppedReason: runOutcome?.stoppedReason ?? (navError ? "NAVIGATE_FAILED" : null),
    finalResult: runOutcome?.finalResult ?? null,
    resultScreenshotPath: runOutcome?.resultScreenshotPath ?? null,
    perQuestionResults: runOutcome?.perQuestionResults ?? [],
    benchmark: runOutcome?.benchmark ?? null,
    timings: {
      discoverSeconds,
      navSeconds,
      answerSeconds: runOutcome?.timings?.totalSeconds ?? null,
      totalSeconds: secondsSince(overallStart),
    },
  };
}

function writeResult(summary) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const file = join(OUTPUT_DIR, "nested_group_e2e_run_result.json");
  writeFileSync(file, JSON.stringify(summary, null, 2), "utf8");
  log(`\n[RESULT] Đã ghi kết quả đầy đủ tại ${file}`);
}

function printFinalReport(summary) {
  log("\n--------- BÁO CÁO 9 MỤC YÊU CẦU ---------");
  log(`1. Unit đã chọn: ${summary.unit.name}`);
  log(`2. Lesson đã chọn: ${summary.lesson.name}`);
  log(`3. Group đã mở theo thứ tự: ${summary.groupPathInOrder.map((g) => g.name).join(" > ") || "(không có)"}`);
  log(`4. Target content: ${summary.targetContent.exercise.name} (exam ${summary.targetContent.examName}, ${summary.targetContent.questionCount} câu: ${summary.targetContent.questionTypes.join(", ")})`);
  log(`5. Screenshot TRƯỚC khi mở target: ${summary.screenshotBeforeOpenTarget ?? "(không có)"}`);
  log(`6. Screenshot SAU khi mở target: ${summary.screenshotAfterOpenTarget ?? "(không có)"}`);
  log(`7. Vui học automation có bắt đầu: ${summary.vuiHocAutomationStarted ? "CÓ" : "KHÔNG"}${summary.handoffScreenshot ? ` (screenshot: ${summary.handoffScreenshot})` : ""}`);
  log(`8. Bài có hoàn thành: ${summary.completed ? "CÓ" : "KHÔNG"}${summary.finalResult ? ` - ĐIỂM SỐ: ${JSON.stringify(summary.finalResult)}` : ""}`);
  log(`9. Nếu fail, fail ở: ${summary.completed ? "(không fail)" : summary.failPhase} ${summary.navigationError ?? summary.runError ?? summary.stoppedReason ?? ""}`);
  log("------------------------------------------");
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exitCode = 1;
});
