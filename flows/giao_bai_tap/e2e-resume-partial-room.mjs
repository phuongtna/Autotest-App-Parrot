#!/usr/bin/env node
/**
 * E2E-Resume-Partial-Room
 *
 * RESUME-FIRST (bắt buộc, theo yêu cầu user 2026-08-18): room_id=69b2ff65-f8c7-4632-8556-
 * cec3fe48db9c ("Choose the correct answer.", Unit 14: My bedroom/LESSON 1, N=10, due 25/08/2026)
 * ĐÃ có 3/10 câu trả lời THẬT (xác nhận qua log run trước, HomeworkExamEngine.answerCurrentQuestionOneShot
 * -> outcome.isTargetCorrect, KHÔNG phải self-assessment):
 *   - 1a5b11de-37ff-4099-944a-5f4b152a4ea8 "Which word means "cửa sổ"?" -> ĐÚNG (isTargetCorrect=true)
 *   - 287291ee-b1da-4a28-87e0-65a6598e94cf "Which word means "cái giường"?" -> SAI (isTargetCorrect=false)
 *   - 6d2cc944-488d-4754-a505-74565a5f88d5 "Which word means "cái cửa"?" -> ĐÚNG (isTargetCorrect=true)
 * => current_correct=2, current_wrong=1, answered=3, remaining=7.
 *
 * KHÔNG tạo assignment mới, KHÔNG random lại plan của cả 10 câu (đã bị chặn đúng - xem hội thoại:
 * random lại toàn bộ 10 câu sẽ ĐÈ LÊN 3 câu đã khoá kết quả thật, có thể đẩy tổng điểm ra ngoài
 * [6.0, 8.0] ngoài tầm kiểm soát). Script NÀY tính lại target CHỈ trên 7 câu CÒN LẠI:
 *   current_correct=2 cố định + additionalCorrect trong [4,6] (để tổng nằm [6,8], N=10) -> random
 *   1 giá trị hợp lệ trong đúng range đó (KHÔNG phải random lại từ đầu).
 *
 * CHẠY: node flows/giao_bai_tap/e2e-resume-partial-room.mjs
 * ENV: giống các flow cùng thư mục (APP_ID/PHONE/OTP/MAESTRO_DEVICE trong .env/test_data/accounts.env).
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseEnvFile } from "../../automation/src/config.js";
import { MaestroMcpBridge } from "../../automation/bridge/maestroMcpBridge.js";
import { HomeworkExamEngine, decideAnswerAction } from "../../automation/bai_tap/navigation/homeworkExamEngine.js";
import { resolveHomeworkExamQuestionsForRoomId } from "../../automation/bai_tap/discovery/teacherMaterialsExamResolver.js";
import { fetchRoomDetails } from "../../automation/bai_tap/discovery/homeworks.js";
import { formatDM, formatDMY, isoToVnYmd } from "../bai_tap/verify-filter-web-vs-app.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "e2e_resume_partial_room_report.json");
const ACCOUNTS_ENV_PATH = join(PROJECT_ROOT, "test_data", "accounts.env");
const ROOT_ENV_PATH = join(PROJECT_ROOT, ".env");
const ACCOUNTS_ENV = parseEnvFile(ACCOUNTS_ENV_PATH);
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const TARGET_SCORE_RANGE_LABEL = "[6.0, 8.0]";

const ROOM_ID = process.env.RESUME_ROOM_ID || "69b2ff65-f8c7-4632-8556-cec3fe48db9c";
// Ghi chú THẬT từ lần chạy trước (evidence.partial.log của automation/output/
// e2e_teacher_assign_partial_resume_scored_pro_report.json TRƯỚC KHI bị ghi đè bởi lần chạy sau -
// đã copy nguyên văn ra đây TRƯỚC khi mất, xem log terminal đã in trong hội thoại).
const KNOWN_ANSWERED = [
  { id: "1a5b11de-37ff-4099-944a-5f4b152a4ea8", question: 'Which word means "cửa sổ"?', wasCorrect: true },
  { id: "287291ee-b1da-4a28-87e0-65a6598e94cf", question: 'Which word means "cái giường"?', wasCorrect: false },
  { id: "6d2cc944-488d-4754-a505-74565a5f88d5", question: 'Which word means "cái cửa"?', wasCorrect: true },
];

function log(...args) {
  console.log(...args);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function collectAllTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectAllTexts(c, acc);
  return acc;
}

function isVisibleInTree(texts, textPattern) {
  const pattern = new RegExp(`^${textPattern}$`);
  return texts.some((t) => pattern.test(t));
}

const CTA_TEXTS = ["Làm bài", "Tiếp tục", "Làm lại", "Chinh phục"];
const PROGRESS_BADGE_PATTERN = /^\d+\s*\/\s*\d+$/;

function readCardState(tree, title, dueDateDm, occurrenceIndex = 0) {
  const texts = collectAllTexts(tree);
  const dueLabel = `Hạn nộp ${dueDateDm}`;
  let seen = -1;
  let idx = -1;
  for (let i = 0; i < texts.length; i++) {
    if (texts[i] !== title) continue;
    const window = texts.slice(i + 1, i + 10);
    if (!window.includes(dueLabel)) continue;
    seen++;
    if (seen === occurrenceIndex) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return { found: false, texts: null };
  const windowTexts = texts.slice(idx + 1, idx + 10);
  const badge = windowTexts.find((t) => PROGRESS_BADGE_PATTERN.test(t)) ?? null;
  const cta = windowTexts.find((t) => CTA_TEXTS.includes(t)) ?? null;
  return { found: true, badge, cta, dueLine: dueLabel, windowTexts };
}

async function scrollToCard(bridge, title, dueDateDm) {
  const esc = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const r1 = await bridge.runSteps([
    {
      scrollUntilVisible: {
        element: { text: `Hạn nộp ${dueDateDm}`, below: { text: `.*${esc}.*` } },
        direction: "DOWN",
        timeout: 240000,
        speed: 70,
        waitToSettleTimeoutMs: 500,
      },
    },
  ]);
  if (r1.success) return;
  const r2 = await bridge.runSteps([
    { scrollUntilVisible: { element: { text: `.*${esc}.*` }, direction: "DOWN", timeout: 240000, speed: 70, waitToSettleTimeoutMs: 500 } },
  ]);
  if (!r2.success) throw new Error(`Không cuộn tới được card "${title}": ${r1.error} / fallback: ${r2.error}`);
}

async function scrollAndReadCardState(bridge, title, dueDM, occurrenceIndex) {
  await scrollToCard(bridge, title, dueDM);
  let state = readCardState(await bridge.hierarchy(), title, dueDM, occurrenceIndex);
  for (let attempt = 0; attempt < 2 && (!state.found || !state.cta); attempt++) {
    await bridge.runSteps([
      { swipe: { start: "50%,80%", end: "50%,45%", duration: 500 } },
      { waitForAnimationToEnd: { timeout: 800 } },
    ]);
    state = readCardState(await bridge.hierarchy(), title, dueDM, occurrenceIndex);
  }
  return state;
}

async function findMatchingQuestion(bridge, pool, priorTree) {
  const tree = priorTree ?? (await bridge.hierarchy());
  const texts = collectAllTexts(tree);
  const isVisible = (t) => isVisibleInTree(texts, t);
  for (const q of pool) {
    const action = decideAnswerAction(tree, isVisible, q, true);
    if (action) return { ...q, _snapshot: { tree, texts } };
  }
  return null;
}

async function answerOneQuestion(exam, matched, isLast, wantCorrectMap) {
  const wantCorrect = wantCorrectMap.get(matched.id);
  const outcome = await exam.answerCurrentQuestionOneShot(matched, {
    wantCorrect,
    resultLabel: isLast ? "e2e_resume_partial_room_result_screen" : null,
    snapshot: matched._snapshot ?? null,
  });
  if (!outcome.supported) {
    throw new Error(`Handler không hỗ trợ câu "${matched.question}" (id=${matched.id}): ${outcome.reason}`);
  }
  return { matched, wantCorrect, outcome };
}

function finish(result) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  return result;
}

/**
 * Tính target CHỈ trên phần CÒN LẠI - KHÔNG random lại plan của cả 10 câu (xem docblock đầu file).
 * @param {number} totalCount tổng số câu (10)
 * @param {number} currentCorrect số câu ĐÃ trả lời đúng THẬT (server-confirmed, cố định = 2)
 * @param {number} remainingCount số câu CÒN LẠI (7)
 */
function computeRemainingScorePlan(totalCount, currentCorrect, remainingCount) {
  const minAdditional = Math.max(0, Math.ceil(6.0 - currentCorrect));
  const maxAdditional = Math.min(remainingCount, Math.floor(8.0 - currentCorrect));
  const validOptions = [];
  for (let a = minAdditional; a <= maxAdditional; a++) {
    const totalCorrect = currentCorrect + a;
    const predicted = Math.round((totalCorrect / totalCount) * 100) / 10;
    if (predicted >= 6.0 && predicted <= 8.0) validOptions.push({ additionalCorrect: a, totalCorrect, predictedScore: predicted });
  }
  if (validOptions.length === 0) return null;
  return validOptions[Math.floor(Math.random() * validOptions.length)];
}

function buildWantCorrectPlan(questionIds, correctCount) {
  const shuffled = shuffle(questionIds);
  const correctSet = new Set(shuffled.slice(0, correctCount));
  const map = new Map();
  for (const id of questionIds) map.set(id, correctSet.has(id));
  return map;
}

function formatReport(evidence, result) {
  const ra = evidence.randomAssignment ?? {};
  const pb = evidence.progressBefore ?? {};
  const resume = evidence.resume ?? {};
  const finishLog = evidence.resumeLog ?? [];
  const res = evidence.result ?? {};
  const si = evidence.scoreInterpretation ?? {};
  const perf = evidence.mcpPerformance ?? {};
  const lines = [];
  const push = (s = "") => lines.push(s);

  push(`[RUN_ID]`); push(ROOM_ID); push(``);
  push(`[RESUME_FIRST_RULE]`);
  push(`applied=true`);
  push(`reason=Room ${ROOM_ID} đã có 3/10 câu trả lời THẬT từ lần chạy trước (2 đúng/1 sai, server-confirmed) - KHÔNG tạo assignment mới, KHÔNG random lại plan cả 10 câu, chỉ tính target cho 7 câu còn lại.`);
  push(``);
  push(`[RANDOM_ASSIGNMENT]`);
  push(`unit=${ra.unitName ?? "-"}`);
  push(`lesson=${ra.lessonName ?? "-"}`);
  push(`lesson_item_id=${ra.lessonItemId ?? "-"}`);
  push(`exam_id=${ra.roomExamId ?? "-"}`);
  push(`assignment_id=${ROOM_ID}`);
  push(`room_id=${ROOM_ID}`);
  push(`title=${ra.title ?? "-"}`);
  push(`questionCount=${ra.questionCount ?? "-"}`);
  push(``);
  push(`[ALREADY_ANSWERED]`);
  for (const a of KNOWN_ANSWERED) push(`- ${a.id} "${a.question}" -> ${a.wasCorrect ? "ĐÚNG" : "SAI"} (server-confirmed lần chạy trước)`);
  push(`current_correct=2`);
  push(`current_wrong=1`);
  push(``);
  push(`[SCORING_PLAN_REMAINING]`);
  push(`remaining_count=${ra.remainingCount ?? "-"}`);
  push(`target_score_range=6.0..8.0`);
  push(`additional_correct_needed=${ra.additionalCorrect ?? "-"}`);
  push(`predicted_total_correct=${ra.predictedTotalCorrect ?? "-"}`);
  push(`predicted_score=${ra.predictedScore ?? "-"}`);
  push(``);
  push(`[PROGRESS_BEFORE_RESUME]`);
  push(`value=${pb.badge ?? "-"}`);
  push(`cta=${pb.cta ?? "-"}`);
  push(``);
  push(`[RESUME]`);
  push(`passed=${Boolean(resume.sameAssignment)}`);
  push(`same_assignment=${Boolean(resume.sameAssignment)}`);
  push(`resumed_question=${resume.resumedAtQuestionId ?? "-"}`);
  push(`question_was_unanswered=${resume.isAlreadyAnsweredQuestion === false}`);
  push(``);
  push(`[FINISH]`);
  push(`answered=${3 + finishLog.length}`);
  push(`total=${ra.questionCount ?? "-"}`);
  push(``);
  push(`[RESULT_SCREEN]`);
  push(`reached=${res.score != null}`);
  push(`actual_score=${res.score ?? "-"}`);
  push(``);
  push(`[FINAL_SCORE]`);
  push(`actual=${si.actualScore ?? "-"}`);
  push(`target_range=6.0 <= score <= 8.0`);
  push(`PASS/FAIL=${si.scoreInRangeTarget ? "PASS" : "FAIL"}`);
  push(``);
  push(`[CORRECTNESS]`);
  push(`planned_total_correct=${ra.predictedTotalCorrect ?? "-"}`);
  push(`server_confirmed_correct=${si.realCorrectCountFromResultScreen ?? "-"}`);
  push(`answer_selection_reliable=${finishLog.every((l) => l.isTargetCorrect !== null)}`);
  push(`assignment_identity_verified=${Boolean(evidence.progressBefore)}`);
  push(`question_identity_verified=${Boolean(resume.resumedAtQuestionId)}`);
  push(``);
  push(`[PERFORMANCE]`);
  push(`duration=${evidence.totalDurationSeconds != null ? `${evidence.totalDurationSeconds.toFixed(1)}s` : "-"}`);
  push(`hierarchy_calls=${perf.hierarchyCallCount ?? "-"}`);
  push(`run_calls=${perf.runCallCount ?? "-"}`);
  push(``);
  push(`[APP_RESTART]`);
  push(`stopApp=false`); push(`terminateApp=false`); push(`clearState=false`); push(`forceStop=false`); push(`unexpected_restart=false`);
  push(``);
  push(`[OVERALL]`); push(result.status); push(``);
  push(`[ROOT_CAUSE]`); push(result.status !== "PASS" ? result.error ?? result.phase ?? "-" : "-");
  return lines.join("\n");
}

async function main() {
  const overallStart = Date.now();
  const evidence = {};

  const rootEnvVars = parseEnvFile(ROOT_ENV_PATH);
  const APP_ID = process.env.APP_ID || rootEnvVars.APP_ID;
  const PHONE = process.env.PHONE || ACCOUNTS_ENV.PHONE;
  const OTP = process.env.OTP || ACCOUNTS_ENV.OTP;

  log(`[1/6] Lấy metadata room ${ROOM_ID} (API, KHÔNG tạo mới)...`);
  const roomDetails = await fetchRoomDetails(ROOM_ID);
  const room = roomDetails?.room;
  if (!room) {
    return finish({ status: "FAIL", phase: "ROOM_DETAILS", error: `fetchRoomDetails("${ROOM_ID}") không trả về room hợp lệ.`, evidence });
  }
  const title = room.name;
  const dueVnYmd = isoToVnYmd(room.end_time);
  const dueDM = formatDM(dueVnYmd);
  log(`  [PASS] title="${title}" due=${formatDMY(dueVnYmd)}`);

  log(`[2/6] Resolve câu hỏi/đáp án CHÍNH XÁC theo room.id (nguồn CMS/Exam, KHÔNG hardcode đáp án)...`);
  const resolved = await resolveHomeworkExamQuestionsForRoomId(ROOM_ID);
  if (resolved.status !== "RESOLVED") {
    return finish({ status: "BLOCKED", phase: "CMS_RESOLUTION", error: `resolveHomeworkExamQuestionsForRoomId trả về status=${resolved.status}: ${resolved.reason}`, evidence });
  }
  const QUESTIONS = resolved.questions;
  const rd = resolved.roomDetails;
  const knownIds = new Set(KNOWN_ANSWERED.map((a) => a.id));
  const remaining = QUESTIONS.filter((q) => !knownIds.has(q.id));
  if (remaining.length !== QUESTIONS.length - KNOWN_ANSWERED.length) {
    return finish({
      status: "FAIL",
      phase: "ANSWERED_ID_MISMATCH",
      error: `Kỳ vọng ${QUESTIONS.length - KNOWN_ANSWERED.length} câu còn lại nhưng tính được ${remaining.length} - danh sách KNOWN_ANSWERED không khớp QUESTIONS thật của room này (kiểm tra lại trước khi resume).`,
      evidence: { questionIds: QUESTIONS.map((q) => q.id), knownAnsweredIds: [...knownIds] },
    });
  }
  const currentCorrect = KNOWN_ANSWERED.filter((a) => a.wasCorrect).length;
  const plan = computeRemainingScorePlan(QUESTIONS.length, currentCorrect, remaining.length);
  if (!plan) {
    return finish({
      status: "BLOCKED",
      phase: "SCORING_PLAN_REMAINING",
      error: `Không tồn tại additionalCorrect nguyên nào trong 7 câu còn lại để tổng điểm rơi vào ${TARGET_SCORE_RANGE_LABEL} (current_correct=${currentCorrect}, total=${QUESTIONS.length}).`,
      evidence,
    });
  }
  const WANT_CORRECT = buildWantCorrectPlan(remaining.map((q) => q.id), plan.additionalCorrect);
  evidence.randomAssignment = {
    unitName: rd.unit_name,
    lessonName: rd.lesson_name,
    lessonItemId: rd.lesson_item_id,
    roomExamId: resolved.examId,
    title,
    questionCount: QUESTIONS.length,
    remainingCount: remaining.length,
    additionalCorrect: plan.additionalCorrect,
    predictedTotalCorrect: plan.totalCorrect,
    predictedScore: plan.predictedScore,
  };
  log(
    `  [PASS] N=${QUESTIONS.length} câu, current_correct=${currentCorrect} (đã khoá), remaining=${remaining.length}, ` +
      `additionalCorrect kế hoạch=${plan.additionalCorrect} (tổng dự đoán=${plan.totalCorrect}/${QUESTIONS.length} -> điểm dự đoán=${plan.predictedScore}).`,
  );

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);

  try {
    evidence.mcpPerformance = {
      get runCallCount() { return bridge.runCallCount; },
      get hierarchyCallCount() { return bridge.hierarchyCallCount; },
    };

    log(`[3/6] Mở app, vào tab "Bài tập", refresh (swipe) để nạp lại state tiến độ...`);
    const login = await bridge.runSteps([
      { launchApp: { permissions: { all: "allow" } } },
      { extendedWaitUntil: { visible: { text: ".*(Đăng nhập|Vui học|Bài tập|Báo cáo).*" }, timeout: 30000 } },
      {
        runFlow: {
          when: { visible: ".*(Chào mừng bạn đến với ParrotEdu!|Nhập số điện thoại).*" },
          commands: [
            { tapOn: { text: ".*(Nhập số điện thoại).*" } },
            { inputText: PHONE },
            "hideKeyboard",
            { tapOn: { text: "Đăng nhập" } },
            { extendedWaitUntil: { visible: { text: ".*(Xác thực OTP).*" }, timeout: 30000 } },
            { tapOn: { below: "Đổi số điện thoại", above: "Xác nhận" } },
            { inputText: OTP },
            "hideKeyboard",
            { runFlow: { when: { visible: ".*(Xác nhận).*" }, commands: [{ tapOn: { text: ".*(Xác nhận).*" } }] } },
            { extendedWaitUntil: { visible: { text: ".*(Vui học|Bài tập|Báo cáo).*" }, timeout: 60000 } },
          ],
        },
      },
      { extendedWaitUntil: { visible: ".*(Vui học|Bài tập|Báo cáo).*", timeout: 30000 } },
      { tapOn: { text: "Bài tập" } },
      { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao|2 tuần gần nhất|1 tháng gần nhất).*" }, timeout: 30000 } },
      { repeat: { times: 5, commands: [{ swipe: { direction: "DOWN", duration: 250 } }] } },
      { swipe: { start: "50%, 35%", end: "50%, 85%", duration: 600 } },
      { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao).*" }, timeout: 30000 } },
    ]);
    if (!login.success) throw new Error(`Không mở được tab "Bài tập"/refresh: ${login.error}`);

    const PROFILE_PRO_NAME = process.env.PROFILE_PRO_NAME || ACCOUNTS_ENV.PROFILE_PRO_NAME || "Ngoc";
    const profileVisible = isVisibleInTree(collectAllTexts(await bridge.hierarchy()), `.*(${PROFILE_PRO_NAME}).*`);
    evidence.profile = { name: PROFILE_PRO_NAME, verified: profileVisible };
    if (!profileVisible) {
      return finish({
        status: "BLOCKED",
        phase: "PROFILE_MISMATCH",
        error: `Hồ sơ hiện tại KHÔNG phải "${PROFILE_PRO_NAME}" - dừng lại thay vì resume nhầm hồ sơ (script này KHÔNG có logic chuyển hồ sơ, chỉ resume).`,
        evidence,
      });
    }
    log(`  [PASS] Hồ sơ "${PROFILE_PRO_NAME}" đang active.`);

    // SỬA (2026-08-18, root cause thật xác nhận qua run trước): room khác (86497c9e-..., Unit 7,
    // tạo trong 1 lượt trước đó rồi bị huỷ bỏ giữa chừng) TRÙNG HỆT title="Choose the correct
    // answer."+Hạn nộp=25/08 với room mục tiêu (69b2ff65-..., Unit 14) - occurrence index 0 KHÔNG
    // còn đủ để định danh đúng room. Disambiguate bằng NỘI DUNG câu hỏi (khớp với 1 trong ĐỦ 10 câu
    // CMS đã resolve cho ĐÚNG room 69b2ff65, cả đã làm lẫn còn lại) - GIỐNG cơ chế
    // openAssignmentDisambiguated() của flows/giao_bai_tap/e2e-teacher-assign-partial-resume-scored-pro.mjs.
    const fullPool = QUESTIONS;
    log(`[4/6] Tìm đúng room "${title}" / Hạn nộp ${dueDM} (disambiguate bằng nội dung, vì có room KHÁC trùng title+due)...`);
    let matchedAfterResume = null;
    let usedIndex = -1;
    let beforeState = null;
    const escTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (let idx = 0; idx < 10; idx++) {
      const state = await scrollAndReadCardState(bridge, title, dueDM, idx);
      if (!state.found || !state.cta) {
        log(`  [DISAMBIGUATE] index=${idx}: hết occurrence (title+Hạn nộp=${dueDM}).`);
        break;
      }
      log(`  [DISAMBIGUATE] index=${idx}: badge="${state.badge}" cta="${state.cta}" - mở thử để kiểm tra nội dung...`);
      const tapResult = await bridge.runSteps([
        { tapOn: { text: state.cta, below: { text: `Hạn nộp ${dueDM}`, below: { text: `.*${escTitle}.*` } }, index: idx } },
        { waitForAnimationToEnd: { timeout: 3000 } },
        { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
        { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 40000 } },
      ]);
      if (!tapResult.success) {
        log(`  [DISAMBIGUATE] index=${idx}: tap thất bại (${tapResult.error}) - thử index kế.`);
        continue;
      }
      const matched = await findMatchingQuestion(bridge, fullPool);
      if (matched) {
        log(`  [DISAMBIGUATE] index=${idx}: ĐÚNG room (câu hiển thị khớp "${matched.id}" trong 10 câu đã resolve cho room ${ROOM_ID}).`);
        matchedAfterResume = matched;
        usedIndex = idx;
        beforeState = state;
        break;
      }
      log(`  [DISAMBIGUATE] index=${idx}: nội dung KHÔNG khớp 10 câu của room ${ROOM_ID} - đây là room KHÁC trùng title/Hạn nộp. Thoát, thử index kế.`);
      await bridge.runSteps([
        { tapOn: { id: "exercise_close_button" } },
        { waitForAnimationToEnd: { timeout: 1500 } },
        { tapOn: { text: "Thoát", optional: true } },
        { tapOn: { text: "Đồng ý", optional: true } },
        { tapOn: { text: "Xác nhận", optional: true } },
        { extendedWaitUntil: { visible: { id: "homework_screen" }, timeout: 20000 } },
      ]);
    }
    if (!matchedAfterResume) {
      return finish({
        status: "BLOCKED",
        phase: "LOCATE_CARD_AMBIGUOUS",
        error: `Không định danh được ĐÚNG room ${ROOM_ID} giữa các occurrence cùng title="${title}"/Hạn nộp=${dueDM} (đã thử tối đa 10 candidate, so nội dung với 10 câu CMS đã resolve) - KHÔNG đoán/không trả lời nhầm room khác.`,
        evidence,
      });
    }
    evidence.progressBefore = beforeState;
    log(`  [PASS] Locate đúng room tại occurrence index=${usedIndex}. badge="${beforeState.badge}" cta="${beforeState.cta}"`);

    log(`[5/6] Verify vào ĐÚNG câu còn dở (KHÔNG phải 1 trong 3 câu đã làm)...`);
    if (knownIds.has(matchedAfterResume.id)) {
      return finish({ status: "FAIL", phase: "RESUME_NOT_RESET", error: `Resume vào câu "${matchedAfterResume.id}" - câu này NẰM TRONG danh sách đã trả lời trước đó (app reset về câu cũ thay vì câu đang dở).`, evidence });
    }
    evidence.resume = { sameAssignment: true, resumedAtQuestionId: matchedAfterResume.id, resumedAtQuestion: matchedAfterResume.question, isAlreadyAnsweredQuestion: false };
    log(`  [PASS] Resume đúng vào câu "${matchedAfterResume.id}" (KHÔNG phải câu đã làm).`);

    log(`[6/6] Làm tiếp ${remaining.length} câu còn lại theo kế hoạch...`);
    const answeredIds = new Set(knownIds);
    const resumeLog = [];
    let lastOutcome = null;
    let carryTree = matchedAfterResume._snapshot?.tree ?? null;
    while (answeredIds.size < QUESTIONS.length) {
      const pool = QUESTIONS.filter((q) => !answeredIds.has(q.id));
      const matched = await findMatchingQuestion(bridge, pool, carryTree);
      if (!matched) {
        return finish({
          status: "FAIL",
          phase: "FINISH_REMAINING",
          error: `Không khớp được câu hỏi nào (còn ${pool.length} câu) với màn hình hiện tại.`,
          visibleTexts: collectAllTexts(await bridge.hierarchy()),
          evidence: { ...evidence, resumeLog },
        });
      }
      const isLast = answeredIds.size === QUESTIONS.length - 1;
      const { wantCorrect, outcome } = await answerOneQuestion(exam, matched, isLast, WANT_CORRECT);
      lastOutcome = outcome;
      carryTree = outcome.finalTree ?? null;
      answeredIds.add(matched.id);
      resumeLog.push({ id: matched.id, question: matched.question, wantCorrect, isTargetCorrect: outcome.isTargetCorrect, type: outcome.type });
      log(`  Câu ${answeredIds.size}/${QUESTIONS.length} (${matched.id}): "${matched.question}" - nhắm ${wantCorrect ? "ĐÚNG" : "SAI"}, isTargetCorrect=${outcome.isTargetCorrect}`);
    }
    evidence.resumeLog = resumeLog;

    log("Xác nhận màn Kết quả + đọc điểm thật...");
    const finalTree = lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(finalTree)) {
      return finish({ status: "FAIL", phase: "RESULT_SCREEN", error: "Không thấy màn hình Kết quả sau khi trả lời hết toàn bộ câu.", evidence });
    }
    const result = exam.readResult(finalTree);
    evidence.result = result;
    log(`  ĐIỂM SỐ=${result.score} CHÍNH XÁC=${result.correct}`);

    const scoreNumber = result.score === null ? null : Number(result.score);
    const scoreValid = scoreNumber !== null && !Number.isNaN(scoreNumber);
    const scoreInRange = scoreValid && scoreNumber >= 6.0 && scoreNumber <= 8.0;
    evidence.scoreInterpretation = {
      questionCount: QUESTIONS.length,
      currentCorrectBeforeResume: currentCorrect,
      additionalCorrectPlanned: plan.additionalCorrect,
      predictedTotalCorrect: plan.totalCorrect,
      realCorrectCountFromResultScreen: result.correctCount,
      predictedScore: plan.predictedScore,
      actualScore: scoreNumber,
      scoreInRangeTarget: scoreInRange,
      targetRange: TARGET_SCORE_RANGE_LABEL,
    };

    await bridge.runSteps([
      { runFlow: { when: { visible: "Hoàn thành" }, commands: [{ tapOn: { text: ".*(Hoàn thành).*" } }] } },
      { runFlow: { when: { visible: "Tiếp theo" }, commands: [{ tapOn: { id: "exercise_result_close_button" } }] } },
    ]);
    await bridge.wait({ id: "homework_screen" }, { timeout: 30000 });

    const overallPass = evidence.resume && !evidence.resume.isAlreadyAnsweredQuestion && answeredIds.size === QUESTIONS.length && scoreInRange;
    evidence.totalDurationSeconds = (Date.now() - overallStart) / 1000;

    return finish({ status: overallPass ? "PASS" : "FAIL", phase: overallPass ? null : "SCORE_VERIFY", evidence });
  } finally {
    await bridge.stop();
    log("[MCP] Đã dừng tiến trình `maestro mcp` (cleanup cuối flow).");
  }
}

main()
  .then((result) => {
    log(`\n=== KẾT QUẢ: ${result.status}${result.phase ? ` (phase=${result.phase})` : ""} ===`);
    log(`Đã ghi report ra ${OUTPUT_FILE}`);
    log("\n" + formatReport(result.evidence ?? {}, result));
    process.exit(result.status === "PASS" ? 0 : result.status === "BLOCKED" ? 2 : 1);
  })
  .catch((err) => {
    console.error("\n[e2e-resume-partial-room] Dừng lại vì lỗi ngoài dự kiến:\n");
    console.error(err);
    process.exit(1);
  });
