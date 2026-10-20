#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../src/config.js";
import { MaestroBridge } from "../bridge/maestroBridge.js";
import { NavigationEngine } from "../navigation/navigationEngine.js";
import { pickRandomExerciseWithRetry } from "../discovery/cli.js";
import { getEntityId, getEntityName } from "../discovery/entityId.js";
import { resetToVuiHocHome } from "./runVuiHocRandomExercise.mjs";
import { captureScreenshotViaAdb } from "./vuiHocExamRunner.js";
import { runScenarioExam } from "./runVuiHocScenarioMatrix.mjs";
import { resolveSortTargetOrder } from "./vuiHocSortHandler.js";
import { buildWrongSortTargetOrder, buildWrongDragDropValues } from "./vuiHocWrongAnswers.js";
import { resolveDragDropCorrectValues } from "../bai_tap/navigation/homeworkExamEngine.js";

/**
 * "Random Vui học Exercise, điểm trong khoảng mục tiêu": TÁI SỬ DỤNG TOÀN BỘ 3 khối đã có sẵn,
 * KHÔNG viết lại bất kỳ state machine nào:
 *   - `discovery/cli.js#pickRandomExerciseWithRetry()` + `runVuiHocRandomExercise.mjs#resetToVuiHocHome()`
 *     - CHÍNH XÁC cơ chế random CMS (Book SELF_LEARN/Unit published/Lesson/Exercise, nhóm lồng
 *     nhau qua groupPath) + reset-về-tab-gốc-khi-navigate-fail đã verify nhiều vòng trong
 *     runVuiHocRandomExercise.mjs - export thêm (không đổi hành vi file đó).
 *   - `navigation/navigationEngine.js#NavigationEngine` - điều hướng trên thiết bị, dùng y nguyên.
 *   - `vui_hoc/runVuiHocScenarioMatrix.mjs#runScenarioExam()` - vòng lặp trả lời theo
 *     scenario A (đúng)/B (sai->đúng, 50% điểm câu)/C (sai->sai, 0% điểm câu) đã verify qua
 *     self-learning-answering-baseline*.md (xem file đó: max=10, trọng số câu=10/N theo
 *     `metadata.point`, Correct=100%, Wrong->Correct=50%, Wrong->Wrong=0%, CONNECT luôn full điểm
 *     khi xong - KHÔNG có đường "sai" cho CONNECT) - TÁCH RA từ `main()` của file đó riêng cho mục
 *     đích này, không viết lại.
 *
 * FILE NÀY CHỈ THÊM: `planScenarioMap()` - chọn ngẫu nhiên 1 điểm mục tiêu trong
 * [TARGET_SCORE_MIN, TARGET_SCORE_MAX] (mặc định 4-6, KHÔNG hardcode - random mỗi lần chạy, đúng
 * chuẩn "never hardcode score/exercise"), rồi gán Scenario cho từng câu (thứ tự ngẫu nhiên) để
 * tổng điểm hạ dần từ 10 (mọi câu Scenario A) xuống đúng trong khoảng mục tiêu:
 *   - CONNECT: luôn ép Scenario A (không có cơ chế "sai" - xem baseline).
 *   - SORT: ép A nếu <2 đoạn (buildWrongSortTargetOrder() không suy ra được hoán vị sai an toàn).
 *   - DRAG_DROP: ép A nếu không suy ra được giá trị sai an toàn (1 ô trống, CMS answers[] không có
 *     distractor nào khác đáp án đúng).
 *   - CHOICE/FILL_WORD: luôn coi là hỗ trợ cả B/C (buildWrongChoiceAction() cần tree live nên
 *     không tiền-kiểm được, nhưng theo baseline + mọi lần live-test, CHOICE luôn có sẵn >=1 lựa
 *     chọn sai; buildWrongFillWordValues() luôn trả về giá trị sai hợp lệ, không bao giờ null).
 * Nếu tập câu của 1 Exercise không đủ "linh hoạt" để hạ điểm vào đúng khoảng mục tiêu (vd toàn bộ
 * là CONNECT, hoặc quá ít câu trong khi trọng số/câu quá lớn) - COI LÀ NGÕ CỤT GIỐNG `NAVIGATE
 * FAIL`, random lại Exercise khác (tái sử dụng `resetToVuiHocHome()` + retry loop), KHÔNG cố
 * "ép" sai trên CONNECT (sẽ làm bài kẹt vô hạn - xem baseline).
 *
 * GIẢ ĐỊNH: thiết bị Android thật đang kết nối, app đã mở, ĐÃ đăng nhập sẵn (profile/lớp hiện tại
 * giữ nguyên, KHÔNG tự switch profile - xem memory feedback_keep_active_profile_for_giao_bai).
 *
 * Chạy: node automation/vui_hoc/runVuiHocRandomTargetScore.mjs
 *       (tuỳ chọn: TARGET_SCORE_MIN=4 TARGET_SCORE_MAX=6 MAX_NAVIGATE_ATTEMPTS=8)
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");
const RESULT_FILE = join(OUTPUT_DIR, "vuihoc_random_target_score_run_result.json");

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
function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** CHOICE tương thích (xem vuiHocQuestionMatcher.js#isChoiceCms) - answers[] là mảng object. CHỈ
 * dùng làm sanity check PHỤ cho type "ONE" - KHÔNG dùng làm tiêu chí CHÍNH (BUG THẬT đã gặp
 * 2026-10-20 live-test: 1 câu type "DRAG_DROP_V2" - type KHÔNG được matcher nhận diện ở BẤT KỲ
 * đâu trong codebase, xem vuiHocQuestionMatcher.js#CMS_PREDICATE_BY_UI_TYPE - vẫn có
 * answers[]=mảng object giống CHOICE, lọt qua check structural này và bị coi nhầm là "assignable"
 * -> `findMatchingPoolEntry()` sẽ không khớp được câu này với BẤT KỲ uiType live nào (predicate
 * CHOICE lẫn DRAG_DROP đều không nhận "DRAG_DROP_V2") -> MATCH_ERROR giữa chừng bài, không phải do
 * SPEAK). SỬA: gate CHÍNH bằng allowlist `q.type` CHÍNH XÁC đã quan sát THẬT là matcher hỗ trợ. */
const SUPPORTED_EXACT_TYPES = new Set(["CONNECT", "SORT", "DRAG_DROP", "FILL_WORD", "ONE"]);
function isChoiceLikeCms(q) {
  const rawAnswers = q?.metadata?.raw?.answers;
  return Array.isArray(rawAnswers) && rawAnswers.length > 0 && typeof rawAnswers[0] === "object";
}

/** Type CMS KHÔNG có cơ chế trả lời SAI có kiểm soát (vd SPEAK - theo
 * project_exercise_types_scoring_capability.md: Speaking không đăng ký được điểm qua automation,
 * KHÔNG phải do engine thiếu handler UI type tương ứng) HOẶC type lạ matcher chưa hỗ trợ (vd
 * "DRAG_DROP_V2", xem ghi chú trên) - coi nguyên Exercise là ngõ cụt, random lại cái khác, KHÔNG
 * cố trả lời/ép scenario cho dạng này. */
function hasUnsupportedQuestionType(questions) {
  return questions.some((q) => !SUPPORTED_EXACT_TYPES.has(q.type) || (q.type === "ONE" && !isChoiceLikeCms(q)));
}

/**
 * Gán Scenario A/B/C cho từng câu để tổng điểm (giảm dần từ 10 = mọi câu A) hạ vào đúng
 * [targetLow, targetHigh]. Trả về `feasible: false` nếu KHÔNG đủ câu "sabotage được" để hạ điểm
 * vào khoảng (hoặc Exercise có type không hỗ trợ, vd SPEAK) - caller phải random Exercise khác,
 * không được chạy tiếp với kết quả ngoài khoảng/kẹt màn.
 */
function planScenarioMap(questions, targetLow, targetHigh) {
  if (hasUnsupportedQuestionType(questions)) {
    return { feasible: false, scenarioMap: {}, projectedScore: null, totalPoints: null, reason: "UNSUPPORTED_QUESTION_TYPE" };
  }
  const scenarioMap = {};
  const assignable = [];
  for (const q of questions) {
    const point = Number(q.metadata?.point) || 0;
    if (q.type === "CONNECT") {
      scenarioMap[q.id] = "A";
      continue;
    }
    if (q.type === "SORT") {
      const order = resolveSortTargetOrder(q);
      const wrongOrder = order ? buildWrongSortTargetOrder(q) : null;
      if (!wrongOrder) {
        scenarioMap[q.id] = "A";
        continue;
      }
    }
    if (q.type === "DRAG_DROP") {
      const correct = resolveDragDropCorrectValues(q);
      const wrong = correct ? buildWrongDragDropValues(q, correct) : null;
      if (!wrong) {
        scenarioMap[q.id] = "A";
        continue;
      }
    }
    assignable.push({ id: q.id, point });
  }

  const totalPoints = questions.reduce((s, q) => s + (Number(q.metadata?.point) || 0), 0);
  let remaining = totalPoints;
  for (const q of shuffle(assignable)) {
    if (remaining <= targetHigh) {
      scenarioMap[q.id] = "A";
      continue;
    }
    const ifC = remaining - q.point;
    if (ifC >= targetLow) {
      scenarioMap[q.id] = "C";
      remaining = ifC;
      continue;
    }
    const ifB = remaining - 0.5 * q.point;
    if (ifB >= targetLow && ifB <= targetHigh) {
      scenarioMap[q.id] = "B";
      remaining = ifB;
      continue;
    }
    scenarioMap[q.id] = "A";
  }

  if (remaining < targetLow - 1e-9 || remaining > targetHigh + 1e-9) {
    return { feasible: false, scenarioMap, projectedScore: remaining, totalPoints };
  }
  return { feasible: true, scenarioMap, projectedScore: remaining, totalPoints };
}

async function main() {
  const targetLow = Number(process.env.TARGET_SCORE_MIN || 4);
  const targetHigh = Number(process.env.TARGET_SCORE_MAX || 6);
  const maxNavigateAttempts = Number(process.env.MAX_NAVIGATE_ATTEMPTS || 8);
  const targetScore = randomInRange(targetLow, targetHigh);
  const overallStart = nowNs();

  log(`[TargetScore] Điểm mục tiêu random trong [${targetLow}, ${targetHigh}]: ${targetScore.toFixed(2)}`);

  const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId || undefined });
  const nav = new NavigationEngine(bridge);

  let discoverInfo = null;
  let questions = null;
  let scenarioMap = null;
  let planInfo = null;
  let navigateError = null;
  const attempts = [];

  log(`\n[TargetScore] Đưa thiết bị về tab gốc "Vui học"...`);
  await resetToVuiHocHome(bridge);

  for (let attempt = 1; attempt <= maxNavigateAttempts; attempt++) {
    log(`\n[DISCOVER] (lượt ${attempt}/${maxNavigateAttempts}) Random Book(SELF_LEARN) -> Unit -> Lesson -> Exercise qua CMS...`);
    const discoverStart = nowNs();
    const { book, unit, lesson, exerciseItem, groupPath, exercise, examData, questions: pickedQuestions } = await pickRandomExerciseWithRetry();
    const discoverSeconds = secondsSince(discoverStart);

    const navTarget = {
      book: toRef(book),
      unit: toRef(unit),
      lesson: toRef(lesson),
      groups: groupPath.map(toRef),
      exercise: toRef(exercise),
    };
    discoverInfo = {
      book: navTarget.book,
      unit: navTarget.unit,
      lesson: navTarget.lesson,
      groupPath: navTarget.groups,
      exerciseItem: toRef(exerciseItem),
      exercise: navTarget.exercise,
      examId: examData.examId,
      examName: examData.examName,
      totalQuestions: pickedQuestions.length,
      types: pickedQuestions.map((q) => q.type),
    };
    log(`[DISCOVER] "${navTarget.book.name}" > "${navTarget.unit.name}" > "${navTarget.lesson.name}"` + (navTarget.groups.length ? ` > [${navTarget.groups.map((g) => g.name).join(" > ")}]` : "") + ` > "${navTarget.exercise.name}"`);
    log(`[DISCOVER] Exam "${examData.examName}" (${examData.examId}) - ${pickedQuestions.length} câu: ${discoverInfo.types.join(", ")} (${discoverSeconds.toFixed(2)}s)`);

    const plan = planScenarioMap(pickedQuestions, targetLow, targetHigh);
    log(
      `[PLAN] feasible=${plan.feasible}` +
        (plan.feasible || plan.reason !== "UNSUPPORTED_QUESTION_TYPE" ? ` projectedScore=${plan.projectedScore?.toFixed(2)}/${plan.totalPoints?.toFixed(2)}` : ` reason=${plan.reason}`) +
        ` scenarioMap=${JSON.stringify(plan.scenarioMap)}`,
    );

    if (!plan.feasible) {
      attempts.push({ attempt, discoverInfo, plan, skipped: plan.reason || "PLAN_INFEASIBLE" });
      log(`[PLAN] KHÔNG dùng được Exercise này (${plan.reason || "không hạ được điểm vào khoảng mục tiêu"}) - random Exercise khác, KHÔNG điều hướng.`);
      continue;
    }

    log("\n[NAVIGATE] Điều hướng trên thiết bị vào đúng bài...");
    const navigateStart = nowNs();
    navigateError = null;
    try {
      await nav.navigateTo(navTarget);
    } catch (err) {
      navigateError = err.message;
    }
    const navigateSeconds = secondsSince(navigateStart);
    attempts.push({ attempt, discoverInfo, plan, navigateError, navigateSeconds });

    if (!navigateError) {
      questions = pickedQuestions;
      scenarioMap = plan.scenarioMap;
      planInfo = plan;
      log(`[NAVIGATE] Đã vào đúng bài (${navigateSeconds.toFixed(2)}s).`);
      mkdirSync(OUTPUT_DIR, { recursive: true });
      captureScreenshotViaAdb(config.deviceId || undefined, join(OUTPUT_DIR, `vuihoc_target_score_nav_done_${Date.now()}.png`));
      break;
    }

    log(`[NAVIGATE] FAIL (lượt ${attempt}/${maxNavigateAttempts}): ${navigateError}`);
    if (attempt < maxNavigateAttempts) {
      log(`[NAVIGATE] Đưa app về tab gốc "Vui học" trước khi random lại...`);
      await resetToVuiHocHome(bridge);
    }
  }

  if (!questions) {
    const summary = {
      targetScore,
      targetLow,
      targetHigh,
      stoppedReason: navigateError ? "NAVIGATE_FAILED" : "PLAN_INFEASIBLE_ALL_ATTEMPTS",
      attempts,
      finalResult: null,
      timings: { totalSeconds: secondsSince(overallStart) },
    };
    mkdirSync(OUTPUT_DIR, { recursive: true });
    writeFileSync(RESULT_FILE, JSON.stringify(summary, null, 2), "utf8");
    log(`\n[TargetScore] Đã hết ${maxNavigateAttempts} lượt, đều thất bại (random/navigate/plan). Kết quả ghi tại ${RESULT_FILE}`);
    process.exitCode = 1;
    return;
  }

  log(`\n[ANSWER] Trả lời ${questions.length} câu theo scenarioMap đã tính (mục tiêu ${targetScore.toFixed(2)})...`);
  const answerStart = nowNs();
  const { stoppedReason, finalResult, perQuestionResults } = await runScenarioExam({ bridge, questions, scenarioMap });
  const answerSeconds = secondsSince(answerStart);

  let resultScreenshotPath = null;
  if (stoppedReason === "COMPLETED") {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    resultScreenshotPath = join(OUTPUT_DIR, `vuihoc_target_score_result_${Date.now()}.png`);
    captureScreenshotViaAdb(config.deviceId || undefined, resultScreenshotPath);
  }

  const inRange =
    finalResult?.score != null && !Number.isNaN(Number(finalResult.score)) ? Number(finalResult.score) >= targetLow && Number(finalResult.score) <= targetHigh : null;

  const summary = {
    targetScore,
    targetLow,
    targetHigh,
    discoverInfo,
    scenarioMap,
    planInfo,
    maxNavigateAttempts,
    stoppedReason,
    attempts,
    finalResult,
    inRange,
    resultScreenshotPath,
    perQuestionResults,
    timings: { answerSeconds, totalSeconds: secondsSince(overallStart) },
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(RESULT_FILE, JSON.stringify(summary, null, 2), "utf8");
  log(`\n[TargetScore] Kết quả ghi tại ${RESULT_FILE}`);
  log(`[TargetScore] stoppedReason=${stoppedReason} ĐIỂM SỐ=${JSON.stringify(finalResult)} inRange(${targetLow}-${targetHigh})=${inRange}`);
  log(`[TargetScore] Screenshot màn Kết quả: ${resultScreenshotPath}`);
  log(`[TargetScore] Thời gian làm bài: ${answerSeconds.toFixed(2)}s, tổng: ${secondsSince(overallStart).toFixed(2)}s`);
  if (stoppedReason !== "COMPLETED" || inRange === false) process.exitCode = 1;
}

main().catch((err) => {
  console.error("[runVuiHocRandomTargetScore] LỖI:", err);
  process.exit(1);
});
