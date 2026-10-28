#!/usr/bin/env node
/**
 * SCRATCH (2026-10-26) - giao 1 bài MỚI (khác hẳn 1 item đã biết có bug chấm điểm cap cứng, xem
 * [[project_truefalse_answer_engine_score_mismatch]]-style finding mới) rồi làm 1 lần nhắm điểm
 * trong 1 RANGE duy nhất. Dùng khi 1 case "giao bài -> làm lần 2 đạt range X" đã thực hiện xong lần
 * 1 trên room khác nhưng room đó không thể đạt được range của lần 2 (điểm bị chặn cứng dưới mức
 * yêu cầu dù nhắm 10/10) - theo chỉ đạo người dùng "giao bài mới (item khác) riêng cho lần 2".
 *
 * GHÉP từ code đã verify (đúng [[feedback_reuse_first_workflow]]):
 *   - fetchEligibleAssignmentTree/findRoomIdByLessonItem/assignHomeworkFlow/
 *     resolveHomeworkExamQuestionsForRoomId: COPY NGUYÊN từ
 *     flows/web/giao_bai_tap/e2e-giaobai-range34-lamlai-range67.mjs.
 *   - prescan 1-range (so với bản gốc pickCandidateAchievingBothRanges() cần 2 range, ở đây chỉ
 *     cần ĐÚNG 1 range) + flattenNonSpeak/isTextChoiceCompatible/shuffle: COPY tinh thần, rút gọn
 *     còn 1 range.
 *   - resolveScoringPlanForCandidate/buildWeightedWantCorrectPlan: import trực tiếp từ
 *     e2e-teacher-assign-full-scored-target5.mjs (export sẵn, KHÔNG viết lại subset-sum).
 *   - answerAllQuestions (vòng lặp trả lời + profiling thời gian): import trực tiếp từ
 *     e2e-giaobai-range34-lamlai-range67.mjs (export sẵn).
 *   - findAssignment/scrollToTop/tapFoundCard: automation/bai_tap/discovery/findAssignment.js.
 *   - Profile verify-only (KHÔNG tự switch): COPY pattern ngắn gọn từ
 *     _scratch_recover_lan2_only.mjs#main() bước [2].
 *
 * ENV: APP_ID/.env, MAESTRO_DEVICE, TARGET_CLASS_NAME, PROFILE_NAME, PHONE/OTP (không dùng vì
 *   profile verify-only, không tự login lại - giữ nguyên session đang active),
 *   RANGE_MIN/RANGE_MAX (range điểm duy nhất cần đạt), EXCLUDE_ITEM_NAMES (comma-separated, tên
 *   item cần loại khỏi prescan vì đã biết lỗi), ASSIGN_DUE_DATE_DAYS_AHEAD (default 7),
 *   MAX_CANDIDATE_PRESCAN_ATTEMPTS (default 40).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseEnvFile } from "../../../automation/src/config.js";
import { MaestroMcpBridge } from "../../../automation/bridge/maestroMcpBridge.js";
import { HomeworkExamEngine } from "../../../automation/bai_tap/navigation/homeworkExamEngine.js";
import {
  fetchEligibleAssignmentTree,
  findRoomIdByLessonItem,
} from "../../../automation/giao_bai_tap/navigation/teacherAssignmentApiDiscovery.js";
import { assignHomeworkFlow } from "../../../automation/giao_bai_tap/runtime/assignHomeworkFlow.js";
import { parseQuestionsFromExamPage } from "../../../automation/discovery/examPageScraper.js";
import { normalizeQuestions } from "../../../automation/model/questionModel.js";
import { resolveHomeworkExamQuestionsForRoomId } from "../../../automation/bai_tap/discovery/teacherMaterialsExamResolver.js";
import { findAssignment, scrollToTop, tapFoundCard } from "../../../automation/bai_tap/discovery/findAssignment.js";
import { resolveScoringPlanForCandidate } from "./e2e-teacher-assign-full-scored-target5.mjs";
import { answerAllQuestions } from "./e2e-giaobai-range34-lamlai-range67.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "scratch_assign_single_range_lan2_report.json");
const EXAM_SESSION_PATH = join(PROJECT_ROOT, "automation", ".cache", "exam_session.json");
const ROOT_ENV = parseEnvFile(join(PROJECT_ROOT, ".env"));

const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const TARGET_CLASS_NAME = process.env.TARGET_CLASS_NAME;
const PROFILE_NAME = process.env.PROFILE_NAME;
const RANGE_MIN = Number(process.env.RANGE_MIN);
const RANGE_MAX = Number(process.env.RANGE_MAX);
const EXCLUDE_ITEM_NAMES = (process.env.EXCLUDE_ITEM_NAMES || "").split(",").map((s) => s.trim()).filter(Boolean);
const ASSIGN_DUE_DATE_DAYS_AHEAD = Number(process.env.ASSIGN_DUE_DATE_DAYS_AHEAD || 7);
const MAX_CANDIDATE_PRESCAN_ATTEMPTS = Number(process.env.MAX_CANDIDATE_PRESCAN_ATTEMPTS || 40);
const MAX_LOCATE_SCROLLS = 60;

function log(...a) { console.log(...a); }
function fmtSec(ms) { return ms == null ? "-" : `${(ms / 1000).toFixed(2)}s`; }

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function addDaysDdMmYyyy(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function toDM(ddmmyyyy) { return ddmmyyyy.slice(0, 5); }
function toIsoDatePrefix(ddmmyyyy) {
  const [dd, mm, yyyy] = ddmmyyyy.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

function flattenNonSpeak(eligibleTree) {
  const flat = [];
  for (const u of eligibleTree) {
    for (const l of u.lessons) {
      if (!l.lessonTag) continue;
      for (const it of l.items) {
        if (it.isSpeak) continue;
        if (!Array.isArray(it.examIds) || it.examIds.length !== 1) continue;
        flat.push({ unitName: u.unitName, lessonName: l.lessonName, lessonTag: l.lessonTag, itemName: it.name, itemId: it.id, examId: it.examIds[0] });
      }
    }
  }
  return flat;
}

function isTextChoiceCompatible(questions) {
  if (!Array.isArray(questions) || questions.length < 3) return false;
  return questions.every((q) => {
    const nonEmptyAnswers = (q.answers ?? []).filter((a) => typeof a === "string" && a.trim().length > 0);
    return nonEmptyAnswers.length >= 2 && q.correctAnswer && nonEmptyAnswers.includes(q.correctAnswer);
  });
}

function refreshExamSessionFromEnvCookie() {
  const examCookie = process.env.EXAM_COOKIE || ROOT_ENV.EXAM_COOKIE;
  if (!examCookie) return { refreshed: false, reason: "EXAM_COOKIE không tồn tại trong .env - chạy get_tokens.sh trước." };
  const session = { examOrigin: "https://exam.parrotedu.vn", cookieHeader: `Bearer=${examCookie}`, localStorage: {} };
  mkdirSync(dirname(EXAM_SESSION_PATH), { recursive: true });
  writeFileSync(EXAM_SESSION_PATH, JSON.stringify(session, null, 2), "utf8");
  return { refreshed: true };
}

function collectAllTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectAllTexts(c, acc);
  return acc;
}

async function pickCandidateAchievingRange(pool, { maxAttempts }) {
  const distinctByName = [...new Map(pool.map((c) => [c.itemName, c])).values()].filter((c) => !EXCLUDE_ITEM_NAMES.includes(c.itemName));
  log(`  [DISCOVERY] distinct itemName sau dedupe+exclude: ${distinctByName.length}`);
  const order = shuffle(distinctByName);
  const attempts = [];
  for (let i = 0; i < order.length && attempts.length < maxAttempts; i++) {
    const cand = order[i];
    let questions = null;
    let reason = null;
    try {
      const examData = await parseQuestionsFromExamPage(cand.examId);
      questions = normalizeQuestions(examData);
    } catch (err) {
      reason = err.message;
    }
    if (!questions) {
      attempts.push({ itemName: cand.itemName, ok: false, reason: reason ?? "parseQuestionsFromExamPage lỗi." });
      log(`  [PRESCAN] "${cand.itemName}": loại (${attempts[attempts.length - 1].reason})`);
      continue;
    }
    if (!isTextChoiceCompatible(questions)) {
      attempts.push({ itemName: cand.itemName, ok: false, reason: "UNSUPPORTED_TYPE_OR_MISSING_CORRECT_ANSWER" });
      log(`  [PRESCAN] "${cand.itemName}": loại (${attempts[attempts.length - 1].reason})`);
      continue;
    }
    const probe = resolveScoringPlanForCandidate(questions, { mode: "range", rangeMin: RANGE_MIN, rangeMax: RANGE_MAX });
    if (!probe.achievable) {
      const reasonStr = `NONE (điểm khả thi thật: ${(probe.achievableScores ?? []).join(", ")})`;
      attempts.push({ itemName: cand.itemName, ok: false, reason: reasonStr });
      log(`  [PRESCAN] "${cand.itemName}": loại (${reasonStr})`);
      continue;
    }
    attempts.push({ itemName: cand.itemName, ok: true, totalScoredItems: questions.length });
    log(`  [PRESCAN] "${cand.itemName}": PASS (${questions.length} scored items) - range [${RANGE_MIN},${RANGE_MAX}] khả thi.`);
    return { picked: cand, attempts };
  }
  return { picked: null, attempts };
}

function finish(result) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  return result;
}

async function main() {
  if (!APP_ID) throw new Error("Thiếu APP_ID.");
  if (!TARGET_CLASS_NAME || !PROFILE_NAME) throw new Error("Thiếu TARGET_CLASS_NAME/PROFILE_NAME.");
  if (Number.isNaN(RANGE_MIN) || Number.isNaN(RANGE_MAX) || RANGE_MIN < 0 || RANGE_MAX > 10 || RANGE_MIN > RANGE_MAX) {
    throw new Error(`RANGE_MIN/MAX=[${RANGE_MIN},${RANGE_MAX}] không hợp lệ.`);
  }

  const overallStart = Date.now();
  const evidence = {};

  log(`[0] Refresh EXAM_COOKIE session...`);
  const sess = refreshExamSessionFromEnvCookie();
  if (!sess.refreshed) return finish({ status: "BLOCKED", phase: "EXAM_SESSION_REFRESH", error: sess.reason, evidence });
  log(`  [PASS] exam_session.json đã ghi.`);

  log(`[1] Quét cây assignment eligible thật của lớp "${TARGET_CLASS_NAME}"...`);
  const { eligibleTree, classId, stats } = await fetchEligibleAssignmentTree(TARGET_CLASS_NAME);
  log(`  [PASS] class_id=${classId}`);
  log(`  [EXERCISE_DISCOVERY] total items: ${stats.totalItems} | items with exam: ${stats.itemsWithExam} | items without exam: ${stats.itemsWithoutExam}`);
  const pool = flattenNonSpeak(eligibleTree);
  if (pool.length === 0) return finish({ status: "BLOCKED", phase: "ASSIGN_PRESCAN", error: `Lớp "${TARGET_CLASS_NAME}" không có item eligible non-SPEAK nào.`, evidence });

  log(`[1] Prescan candidate đạt range [${RANGE_MIN},${RANGE_MAX}] (loại trừ: ${EXCLUDE_ITEM_NAMES.join(", ") || "(none)"}, budget ${MAX_CANDIDATE_PRESCAN_ATTEMPTS})...`);
  const { picked, attempts } = await pickCandidateAchievingRange(pool, { maxAttempts: MAX_CANDIDATE_PRESCAN_ATTEMPTS });
  evidence.prescanAttempts = attempts.length;
  if (!picked) return finish({ status: "BLOCKED", phase: "ASSIGN_PRESCAN", error: `Đã thử ${attempts.length}/${pool.length} candidate - không candidate nào phù hợp.`, evidence });
  evidence.picked = { itemName: picked.itemName, unitName: picked.unitName, lessonName: picked.lessonName };
  log(`  [PASS] Chọn "${picked.itemName}" (unit=${picked.unitName}, lesson=${picked.lessonName}).`);

  const dueDateDdMmYyyy = addDaysDdMmYyyy(ASSIGN_DUE_DATE_DAYS_AHEAD);
  log(`[1] Giao bài "${picked.itemName}" cho lớp "${TARGET_CLASS_NAME}", hạn nộp ${dueDateDdMmYyyy}...`);
  const assignResult = await assignHomeworkFlow({
    primaryClass: TARGET_CLASS_NAME,
    dueDate: dueDateDdMmYyyy,
    unitName: picked.unitName,
    lessonName: picked.lessonTag,
    homeworkItemId: picked.itemId,
    homeworkItemName: picked.itemName,
    headless: true,
  });
  evidence.assignResult = { status: assignResult.status, steps: assignResult.steps?.map((s) => ({ name: s.name, status: s.status })) };
  if (assignResult.status !== "PASS") return finish({ status: "FAIL", phase: "ASSIGN", error: `assignHomeworkFlow() FAIL: ${assignResult.error}`, evidence });
  log(`  [PASS] Đã giao bài qua Web GV.`);

  log(`[1] Resolve room_id thật (lessonItemId=${picked.itemId})...`);
  const room = await findRoomIdByLessonItem({ lessonItemId: picked.itemId, classId, endTimeDatePrefix: toIsoDatePrefix(dueDateDdMmYyyy) });
  evidence.roomId = room.id;
  log(`  [PASS] room_id=${room.id}`);

  log(`[1] Resolve câu hỏi/đáp án thật qua CMS cho room_id=${room.id}...`);
  const resolved = await resolveHomeworkExamQuestionsForRoomId(room.id);
  if (resolved.status !== "RESOLVED") return finish({ status: "BLOCKED", phase: "RESOLVE_QUESTIONS", error: `status=${resolved.status}: ${resolved.reason}`, evidence });
  const swapAnswer = resolved.roomDetails?.room?.exams?.[0]?.is_swap_answer ?? null;
  const swapQuestion = resolved.roomDetails?.room?.exams?.[0]?.is_swap_question ?? null;
  if (swapAnswer || swapQuestion) return finish({ status: "BLOCKED", phase: "RESOLVE_QUESTIONS", error: `is_swap_answer=${swapAnswer}/is_swap_question=${swapQuestion}.`, evidence });
  const QUESTIONS = resolved.questions;
  evidence.totalScoredItems = QUESTIONS.length;
  log(`  [PASS] ${QUESTIONS.length} scored items resolved từ CMS.`);

  const plan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "range", rangeMin: RANGE_MIN, rangeMax: RANGE_MAX });
  if (!plan.achievable) return finish({ status: "BLOCKED", phase: "SCORE_PLAN", error: `Không random được target trong [${RANGE_MIN},${RANGE_MAX}] (${plan.reason}).`, evidence });
  log(`  [PASS] targetScore=${plan.targetScore} (cần đúng ${plan.correctIndices.size}/${QUESTIONS.length} item).`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);

  try {
    log(`[2] Xác nhận hồ sơ "${PROFILE_NAME}" đang active (KHÔNG switch)...`);
    const nav = await bridge.runSteps([
      { launchApp: { permissions: { all: "allow" } } },
      { extendedWaitUntil: { visible: { text: ".*(Vui học|Bài tập|Báo cáo).*" }, timeout: 30000 } },
      { tapOn: { text: "Bài tập" } },
      { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao|Bạn không có bài tập nào đang chờ|2 tuần gần nhất|1 tháng gần nhất).*" }, timeout: 30000 } },
    ]);
    if (!nav.success) return finish({ status: "FAIL", phase: "NAV_BAI_TAP", error: nav.error, evidence });
    const texts = collectAllTexts(await bridge.hierarchy());
    const profileActive = texts.some((t) => t.includes(PROFILE_NAME));
    evidence.profileActive = profileActive;
    if (!profileActive) return finish({ status: "BLOCKED", phase: "PROFILE_CHECK", error: `Hồ sơ "${PROFILE_NAME}" không active. Texts: ${JSON.stringify(texts.slice(0, 10))}`, evidence });
    log(`  [PASS] "${PROFILE_NAME}" active.`);

    log(`[2] Cuộn về đỉnh danh sách "Bài tập"...`);
    const topResult = await scrollToTop(bridge);
    if (!topResult.atTop) log(`  [WARN] scrollToTop() không xác nhận: ${topResult.reason} - vẫn tiếp tục.`);

    log(`[2] Mở bài "${picked.itemName}" (hạn nộp ${toDM(dueDateDdMmYyyy)}) qua findAssignment()...`);
    const dueDateDM = toDM(dueDateDdMmYyyy);
    const located = await findAssignment(bridge, { title: picked.itemName, dueDateDM }, { maxScrolls: MAX_LOCATE_SCROLLS });
    if (located.status !== "FOUND") return finish({ status: "FAIL", phase: "OPEN_NEW_ASSIGNMENT", error: `findAssignment() status=${located.status}:\n${located.diagnostics}`, evidence });
    const tapResult = await tapFoundCard(bridge, located.card);
    if (!tapResult.success) return finish({ status: "FAIL", phase: "OPEN_NEW_ASSIGNMENT", error: `tapFoundCard() thất bại: ${tapResult.error}`, evidence });
    const openNew = await bridge.runSteps([
      { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
      { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 40000 } },
    ]);
    const attemptStartedAt = Date.now();
    if (!openNew.success) return finish({ status: "FAIL", phase: "OPEN_NEW_ASSIGNMENT", error: `Mở bài thất bại: ${openNew.error}`, evidence });
    log(`  [PASS] Đã vào màn Doing.`);

    log(`[3] Trả lời ${QUESTIONS.length} câu, nhắm điểm ${plan.targetScore} (range [${RANGE_MIN},${RANGE_MAX}])...`);
    const answer = await answerAllQuestions(bridge, exam, QUESTIONS, plan.correctIndices);
    if (!answer.ok) {
      return finish({ status: answer.outcomeLabel === "BLOCKED_MISSING_EXERCISE_HANDLER" ? "BLOCKED" : "FAIL", phase: "ATTEMPT_ANSWER", error: answer.reason, evidence: { ...evidence, answerLog: answer.answerLog } });
    }
    const finalTree = answer.lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(finalTree)) return finish({ status: "FAIL", phase: "ATTEMPT_RESULT", error: "Không thấy màn Kết quả.", evidence });
    const attemptEndedAt = Date.now();
    const result = exam.readResult(finalTree);
    const actualScore = result.score === null ? null : Number(result.score);
    const matched = actualScore !== null && !Number.isNaN(actualScore) && Math.abs(actualScore - plan.targetScore) < 1e-6;
    const inUserRange = actualScore !== null && actualScore >= RANGE_MIN && actualScore <= RANGE_MAX;
    evidence.attempt = {
      targetScoreRange: `[${RANGE_MIN}, ${RANGE_MAX}]`,
      targetScore: plan.targetScore,
      actualScore,
      correct: result.correct,
      matched,
      inUserRange,
      timing: { startedAtIso: new Date(attemptStartedAt).toISOString(), endedAtIso: new Date(attemptEndedAt).toISOString(), durationMs: attemptEndedAt - attemptStartedAt, perQuestion: answer.perQuestion },
    };
    log(`  TARGET=${plan.targetScore} ĐIỂM THẬT=${result.score} CHÍNH XÁC=${result.correct} inUserRange=${inUserRange} THỜI GIAN=${fmtSec(attemptEndedAt - attemptStartedAt)}`);

    evidence.totalDurationSeconds = (Date.now() - overallStart) / 1000;
    return finish({ status: inUserRange ? "PASS" : "FAIL", phase: inUserRange ? null : "SCORE_OUT_OF_RANGE", error: inUserRange ? null : `Điểm thật ${actualScore} không nằm trong [${RANGE_MIN},${RANGE_MAX}].`, evidence });
  } catch (err) {
    return finish({ status: "ERROR", error: err.message, stack: err.stack, evidence });
  } finally {
    await bridge.stop();
    log("[MCP] Đã dừng tiến trình `maestro mcp`.");
  }
}

main()
  .then((result) => {
    console.log(`\n[RESULT] ${result.status} ${result.phase ?? ""} ${result.error ?? ""}`);
    console.log(JSON.stringify(result.evidence ?? {}, null, 2));
    process.exit(result.status === "PASS" ? 0 : result.status === "BLOCKED" ? 3 : 1);
  })
  .catch((err) => {
    console.error("[_scratch_assign_single_range_lan2] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    process.exit(2);
  });
