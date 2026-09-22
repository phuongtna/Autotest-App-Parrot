#!/usr/bin/env node
/**
 * Resume-Lamlai-Range-Score
 *
 * Case: 1 room "Bài tập" ĐÃ hoàn thành lần đầu (đã biết title + room_id thật) - chỉ cần bấm
 * "Làm lại" và làm lại với điểm nằm trong 1 range [MIN,MAX]. KHÔNG giao bài mới, KHÔNG làm lần đầu.
 *
 * LÝ DO VIẾT FILE NÀY (2026-09-21, KHÔNG viết engine mới, chỉ đổi cơ chế LOCATE đã chứng minh lỗi):
 *   automation/bai_tap/pro_lamlai_target_score.mjs (case anh em, cùng mục đích "làm lại 1 candidate
 *   đã hoàn thành") dùng `locateSpecificCompletedCandidate()` để tìm lại card "Làm lại" - CHÍNH cơ
 *   chế đó FAIL 2/2 LẦN LIÊN TIẾP trên đúng room này/đúng profile này (stopReason=END_OF_LIST ở
 *   scroll 33-34, dù card THẬT SỰ tồn tại - đã xác nhận qua CMS/getHomeworks). Chạy
 *   `PRECHECK_ONLY=true` của CHÍNH file đó (dùng `findAssignment()` làm cơ chế đối chứng, xem
 *   docblock PRECHECK ở đó) tìm thấy NGAY trong 14 lượt cuộn - CÙNG cơ chế `findAssignment()`/
 *   `tapFoundCard()` đã verify PASS nhiều lần cho bước "mở bài lần đầu" của
 *   flows/web/giao_bai_tap/e2e-giaobai-range34-lamlai-range67.mjs (bước "Làm lại" của CHÍNH file đó
 *   lại dùng locateSpecificCompletedCandidate() nên dính CÙNG lỗi - không phải file duy nhất bị).
 *   File này CHỈ thay bước locate "Làm lại" bằng findAssignment({title, cta:"Làm lại"}) +
 *   tapFoundCard() (COPY NGUYÊN từ 2 file trên) - mọi phần khác TÁI SỬ DỤNG NGUYÊN VĂN, KHÔNG viết
 *   engine mới:
 *     - resolveHomeworkExamQuestionsForRoomId (đã biết room_id, không cần quét/gom candidate)
 *     - resolveScoringPlanForCandidate(mode:"range") + buildWeightedWantCorrectPlan (từ
 *       flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs)
 *     - HomeworkExamEngine + findMatchingQuestion (answer loop COPY từ
 *       e2e-giaobai-range34-lamlai-range67.mjs#answerAllQuestions())
 *     - ensureProfileActive() verify-only (KHÔNG BAO GIỜ tự tap "Chuyển profile" -
 *       [[feedback_keep_active_profile_for_giao_bai]]) - COPY từ file đó.
 *
 * AN TOÀN: KHÔNG giao bài mới, KHÔNG mở lần làm đầu - chỉ tap "Làm lại" trên 1 room ĐÃ tồn tại thật
 * (TARGET_ROOM_ID bắt buộc, không đoán).
 *
 * ENV: APP_ID (.env), PHONE/OTP (default 0915775115/888888), PROFILE_NAME (bắt buộc, không default -
 *   để KHÔNG lỡ dùng nhầm profile), TARGET_TITLE (bắt buộc, đúng text hiển thị trên card App HS),
 *   TARGET_ROOM_ID (bắt buộc), REDO_SCORE_MIN/REDO_SCORE_MAX (bắt buộc), MAESTRO_DEVICE (tuỳ chọn).
 *
 * CHẠY: PROFILE_NAME="Hạnh vy" TARGET_TITLE="..." TARGET_ROOM_ID="..." REDO_SCORE_MIN=6.1 \
 *   REDO_SCORE_MAX=9.9 node automation/bai_tap/resume_lamlai_range_score.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseEnvFile } from "../src/config.js";
import { MaestroMcpBridge } from "../bridge/maestroMcpBridge.js";
import { HomeworkExamEngine } from "./navigation/homeworkExamEngine.js";
import { resolveHomeworkExamQuestionsForRoomId } from "./discovery/teacherMaterialsExamResolver.js";
import { locateSpecificCompletedCandidate } from "./discovery/locateCompletedCandidate.js";
import { centerPoint } from "./discovery/homeworkUiList.js";
import { findMatchingQuestion } from "./discovery/answerSetMatcher.js";
import {
  resolveScoringPlanForCandidate,
  buildWeightedWantCorrectPlan,
} from "../../flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "resume_lamlai_range_score_report.json");
const ROOT_ENV = parseEnvFile(join(PROJECT_ROOT, ".env"));

const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const PHONE = process.env.PHONE || "0915775115";
const OTP = process.env.OTP || "888888";
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const PROFILE_NAME = process.env.PROFILE_NAME;
const TARGET_TITLE = process.env.TARGET_TITLE;
const TARGET_ROOM_ID = process.env.TARGET_ROOM_ID;
// Optional - disambiguates when another completed card shares the exact same title (confirmed real
// collision 2026-09-22: an older "Làm lại"-eligible card with the same title as the just-assigned
// room). Completed cards render NO due-date line at all
// ([[project_open_exercise_due_date_completed_card_bug]]), so the FIRST attempt's real score is the
// usable disambiguator here, not a due date.
const TARGET_FIRST_SCORE = process.env.TARGET_FIRST_SCORE != null ? Number(process.env.TARGET_FIRST_SCORE) : null;
const REDO_SCORE_MIN = Number(process.env.REDO_SCORE_MIN);
const REDO_SCORE_MAX = Number(process.env.REDO_SCORE_MAX);
const MAX_LOCATE_SCROLLS = 60;

if (!PROFILE_NAME) throw new Error("Thiếu PROFILE_NAME (bắt buộc, không default).");
if (!TARGET_TITLE) throw new Error("Thiếu TARGET_TITLE (bắt buộc).");
if (!TARGET_ROOM_ID) throw new Error("Thiếu TARGET_ROOM_ID (bắt buộc).");
if (!Number.isFinite(REDO_SCORE_MIN) || !Number.isFinite(REDO_SCORE_MAX)) {
  throw new Error("Thiếu/sai REDO_SCORE_MIN/REDO_SCORE_MAX.");
}

function log(...args) {
  console.log(...args);
}

function fmtSec(ms) {
  return `${(ms / 1000).toFixed(2)}s`;
}

async function timed(fn) {
  const startedAt = Date.now();
  const result = await fn();
  const endedAt = Date.now();
  return { result, startedAt, endedAt, durationMs: endedAt - startedAt };
}

function collectAllTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectAllTexts(c, acc);
  return acc;
}

/** Verify-only - KHÔNG BAO GIỜ tự tap "Chuyển profile" (standing rule). */
async function ensureProfileActive(bridge) {
  const treeBefore = await bridge.hierarchy();
  const texts = collectAllTexts(treeBefore);
  const escaped = PROFILE_NAME.replace(/[.*+?^()|[\]\\]/g, (m) => "\\" + m);
  const alreadyActive = texts.some((t) => new RegExp(`.*(${escaped}).*`).test(t));
  if (!alreadyActive) return { active: false, texts };
  return { active: true, texts };
}

async function answerAllQuestions(bridge, exam, questions, correctIndices) {
  const wantCorrectMap = buildWeightedWantCorrectPlan(questions, correctIndices);
  const answeredIds = new Set();
  const answerLog = [];
  const perQuestion = [];
  let carryTree = null;
  let lastOutcome = null;
  while (answeredIds.size < questions.length) {
    const questionIndex = answeredIds.size + 1;
    const pool = questions.filter((q) => !answeredIds.has(q.id));
    const matchT = await timed(() => findMatchingQuestion(bridge, pool, carryTree, questionIndex));
    const matchResult = matchT.result;
    if (matchResult.status !== "MATCHED") {
      const outcomeLabel = matchResult.status === "AMBIGUOUS" ? "AMBIGUOUS_MATCH" : "NO_MATCH";
      return {
        ok: false,
        reason:
          matchResult.status === "AMBIGUOUS"
            ? `AMBIGUOUS_MATCH ở câu ${questionIndex}: ${matchResult.diagnostic.contentEvidence?.candidates?.length ?? "?"} candidate CMS cùng khớp đủ answer-set - không tự chọn.`
            : `NO_MATCH ở câu ${questionIndex} (còn ${pool.length} câu): không có candidate CMS nào khớp đủ đáp án đang hiển thị.`,
        outcomeLabel,
        answerLog,
        perQuestion,
      };
    }
    const matched = matchResult.question;
    const isLast = answeredIds.size === questions.length - 1;
    const wantCorrect = wantCorrectMap.get(matched.id);
    const answerT = await timed(() =>
      exam.answerCurrentQuestionOneShot(matched, {
        wantCorrect,
        resultLabel: isLast ? "resume_lamlai_range_result_screen" : null,
        snapshot: matched._snapshot ?? null,
      }),
    );
    const outcome = answerT.result;
    if (!outcome.supported) {
      return { ok: false, reason: `Handler không hỗ trợ câu "${matched.question}" (id=${matched.id}): ${outcome.reason}`, outcomeLabel: "BLOCKED_MISSING_EXERCISE_HANDLER", answerLog, perQuestion };
    }
    lastOutcome = outcome;
    carryTree = outcome.finalTree ?? null;
    answeredIds.add(matched.id);
    answerLog.push({ id: matched.id, question: matched.question, wantCorrect, isTargetCorrect: outcome.isTargetCorrect });
    perQuestion.push({ index: questionIndex, wantCorrect, isTargetCorrect: outcome.isTargetCorrect, durationMs: answerT.endedAt - matchT.startedAt });
    log(`    Câu ${answeredIds.size}/${questions.length}: nhắm ${wantCorrect ? "ĐÚNG" : "SAI"}, isTargetCorrect=${outcome.isTargetCorrect}, total=${fmtSec(answerT.endedAt - matchT.startedAt)}`);
  }
  return { ok: true, lastOutcome, answerLog, perQuestion };
}

function finish(evidence) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(evidence, null, 2));
  log(`\n[OVERALL] ${evidence.status}`);
  if (evidence.error) log(`[ROOT_CAUSE] ${evidence.error}`);
  log(`\nĐã ghi report ra ${OUTPUT_FILE}`);
  return evidence;
}

async function main() {
  const evidence = { title: TARGET_TITLE, roomId: TARGET_ROOM_ID, profile: PROFILE_NAME, scoreRange: [REDO_SCORE_MIN, REDO_SCORE_MAX] };

  log(`[1] Resolve câu hỏi/đáp án thật qua CMS cho room_id=${TARGET_ROOM_ID}...`);
  const resolved = await resolveHomeworkExamQuestionsForRoomId(TARGET_ROOM_ID);
  const QUESTIONS = resolved.questions;
  log(`  [PASS] ${QUESTIONS.length} scored items resolved từ CMS.`);

  const plan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "range", rangeMin: REDO_SCORE_MIN, rangeMax: REDO_SCORE_MAX });
  if (!plan.achievable) {
    return finish({ ...evidence, status: "BLOCKED", error: `Không có điểm khả thi trong [${REDO_SCORE_MIN},${REDO_SCORE_MAX}]: ${plan.reason}` });
  }
  log(`  [PASS] targetScore=${plan.targetScore} (cần đúng ${plan.correctIndices.size}/${QUESTIONS.length} item).`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);

  try {
    log(`[2] Xác nhận hồ sơ "${PROFILE_NAME}" đang active (KHÔNG switch)...`);
    const profileCheck = await ensureProfileActive(bridge);
    if (!profileCheck.active) {
      return finish({ ...evidence, status: "BLOCKED", error: `Hồ sơ đang active KHÔNG khớp "${PROFILE_NAME}" - script KHÔNG tự chuyển hồ sơ. Texts: ${JSON.stringify(profileCheck.texts.slice(0, 10))}` });
    }
    log(`  [PASS] Hồ sơ "${PROFILE_NAME}" xác nhận đang active.`);

    log(`[3] Tìm card "${TARGET_TITLE}" (cta="Làm lại"${TARGET_FIRST_SCORE != null ? `, điểm=${TARGET_FIRST_SCORE}` : ""}) qua locateSpecificCompletedCandidate()...`);
    const relocated = await locateSpecificCompletedCandidate(bridge, TARGET_TITLE, {
      maxScrolls: MAX_LOCATE_SCROLLS,
      expectedScore: TARGET_FIRST_SCORE,
    });
    const freshCandidate = relocated.candidates[0];
    if (!freshCandidate) {
      return finish({ ...evidence, status: "FAIL", error: `locateSpecificCompletedCandidate() không tìm thấy card "${TARGET_TITLE}" sau ${relocated.scrollsUsed} lượt cuộn (stopReason=${relocated.stopReason ?? "UNKNOWN"}).` });
    }
    log(`  [PASS] Tìm thấy card sau ${relocated.scrollsUsed} lượt cuộn.`);

    const ctaPoint = centerPoint(freshCandidate.ctaBounds);
    const tapResult = await bridge.runSteps([{ tapOn: { point: `${ctaPoint.x},${ctaPoint.y}` } }]);
    if (!tapResult.success) {
      return finish({ ...evidence, status: "FAIL", error: `Tap "Làm lại" thất bại: ${tapResult.error}` });
    }
    const openResult = await bridge.runSteps([
      { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
      { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 40000 } },
    ]);
    const startedAt = Date.now();
    if (!openResult.success) {
      return finish({ ...evidence, status: "FAIL", error: `Mở bài "Làm lại" thất bại sau khi tap card: ${openResult.error}` });
    }
    log(`  [PASS] Đã tap "Làm lại" - vào màn Doing.`);

    log(`[4] Trả lời ${QUESTIONS.length} câu, nhắm điểm ${plan.targetScore} (range [${REDO_SCORE_MIN},${REDO_SCORE_MAX}])...`);
    const answer = await answerAllQuestions(bridge, exam, QUESTIONS, plan.correctIndices);
    if (!answer.ok) {
      return finish({ ...evidence, status: answer.outcomeLabel === "BLOCKED_MISSING_EXERCISE_HANDLER" ? "BLOCKED" : "FAIL", error: answer.reason, answerLog: answer.answerLog });
    }
    const finalTree = answer.lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(finalTree)) {
      return finish({ ...evidence, status: "FAIL", error: "Không thấy màn Kết quả sau khi trả lời hết câu." });
    }
    const endedAt = Date.now();
    const result = exam.readResult(finalTree);
    const actualScore = result.score === null ? null : Number(result.score);
    const matched = actualScore !== null && !Number.isNaN(actualScore) && Math.abs(actualScore - plan.targetScore) < 1e-6;
    log(`  TARGET=${plan.targetScore} ĐIỂM THẬT=${result.score} CHÍNH XÁC=${result.correct} THỜI GIAN=${fmtSec(endedAt - startedAt)}`);

    return finish({
      ...evidence,
      status: matched ? "PASS" : "FAIL",
      error: matched ? undefined : `Điểm thật ${actualScore} KHÁC target ${plan.targetScore}.`,
      targetScore: plan.targetScore,
      actualScore,
      correct: result.correct,
      durationMs: endedAt - startedAt,
    });
  } finally {
    await bridge.stop();
  }
}

main().catch((err) => {
  console.error("[resume-lamlai-range-score] Dừng lại vì lỗi ngoài dự kiến:\n", err);
  process.exit(1);
});
