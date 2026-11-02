#!/usr/bin/env node
/**
 * Recovery-in-place (round 4, 2026-10-30): resume_lamlai_range_score.mjs's locateSpecificCompletedCandidate()
 * (list-scroll based) FAILED with PROGRESS_STALLED after 4 scrolls for room_id=89ecfd98-72cd-4340-
 * 8f25-c31d0353fad7 title "G3-U18-Lesson 2: Read and tick True or False" - same known-flaky mechanism
 * (see [[project_navigation_selector_and_card_locate_bugs]]). Backend API
 * (fetchRoomDetails) already confirmed round 4's first attempt is "status":"done",
 * total_correct=2/10 (matches target) - [[feedback_recover_inplace_not_retry_after_partial_write]]:
 * continue THIS room's "Làm lại", don't re-assign. Swap locate mechanism to
 * locateCompletedCandidateOrOpenFromNotification() (notification fallback, title+due-date) - the
 * SAME fallback e2e-giaobai-range34-lamlai-range67.mjs itself uses for its redo-locate step - KHÔNG
 * viết locate engine mới. Mọi phần khác COPY NGUYÊN từ resume_lamlai_range_score.mjs.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseEnvFile } from "./src/config.js";
import { MaestroMcpBridge } from "./bridge/maestroMcpBridge.js";
import { HomeworkExamEngine } from "./bai_tap/navigation/homeworkExamEngine.js";
import { resolveHomeworkExamQuestionsForRoomId } from "./bai_tap/discovery/teacherMaterialsExamResolver.js";
import { locateCompletedCandidateOrOpenFromNotification } from "./bai_tap/discovery/locateCompletedCandidate.js";
import { centerPoint } from "./bai_tap/discovery/homeworkUiList.js";
import { findMatchingQuestion } from "./bai_tap/discovery/answerSetMatcher.js";
import {
  resolveScoringPlanForCandidate,
  buildWeightedWantCorrectPlan,
} from "../flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "resume_lamlai_round4_via_notification_report.json");
const ROOT_ENV = parseEnvFile(join(PROJECT_ROOT, ".env"));

const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const PROFILE_NAME = "Gia Linh";
const TARGET_TITLE = "G3-U18-Lesson 2: Read and tick True or False";
const TARGET_ROOM_ID = "89ecfd98-72cd-4340-8f25-c31d0353fad7";
const TARGET_FIRST_SCORE = 2;
const NOTIFICATION_DUE_DATE = "06/11/2026";
const REDO_SCORE_MIN = 6.1;
const REDO_SCORE_MAX = 9.9;
const MAX_LOCATE_SCROLLS = 60;

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

async function ensureProfileActive(bridge) {
  const treeBefore = await bridge.hierarchy();
  const texts = collectAllTexts(treeBefore);
  const escaped = PROFILE_NAME.replace(/[.*+?^()|[\]\\]/g, (m) => "\\" + m);
  const alreadyActive = texts.some((t) => new RegExp(`.*(${escaped}).*`).test(t));
  return { active: alreadyActive, texts };
}

/** COPY nguyên văn từ resume_lamlai_range_score.mjs#answerAllQuestions(). */
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
        reason: matchResult.status === "AMBIGUOUS" ? `AMBIGUOUS_MATCH ở câu ${questionIndex}.` : `NO_MATCH ở câu ${questionIndex} (còn ${pool.length} câu).`,
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
        resultLabel: isLast ? "resume_round4_via_notification_result" : null,
        snapshot: matched._snapshot ?? null,
      }),
    );
    const outcome = answerT.result;
    if (!outcome.supported) {
      return { ok: false, reason: `Handler không hỗ trợ câu "${matched.question}": ${outcome.reason}`, outcomeLabel: "BLOCKED_MISSING_EXERCISE_HANDLER", answerLog, perQuestion };
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
      return finish({ ...evidence, status: "BLOCKED", error: `Hồ sơ đang active KHÔNG khớp "${PROFILE_NAME}". Texts: ${JSON.stringify(profileCheck.texts.slice(0, 10))}` });
    }
    log(`  [PASS] Hồ sơ "${PROFILE_NAME}" xác nhận đang active.`);

    log(`[3] Tìm card "${TARGET_TITLE}" (cta="Làm lại", điểm=${TARGET_FIRST_SCORE}) qua locateCompletedCandidateOrOpenFromNotification()...`);
    const relocated = await locateCompletedCandidateOrOpenFromNotification(bridge, TARGET_TITLE, {
      maxScrolls: MAX_LOCATE_SCROLLS,
      expectedScore: TARGET_FIRST_SCORE,
      notificationDueDateDdMmYyyy: NOTIFICATION_DUE_DATE,
    });
    evidence.locate = { source: relocated.source, scrollsUsed: relocated.scrollsUsed, stopReasonBeforeFallback: relocated.stopReasonBeforeFallback ?? null };

    if (relocated.source === "NOTIFICATION" && relocated.alreadyOnDoingScreen) {
      log(`  [PASS] Fallback thông báo "giao bài" PASS - đã vào màn Doing (lần 2).`);
    } else {
      const freshCandidate = relocated.candidates?.[0];
      if (!freshCandidate) {
        return finish({
          ...evidence,
          status: "FAIL",
          error: `Không tìm lại được card "${TARGET_TITLE}" sau ${relocated.scrollsUsed} lượt cuộn (stopReason=${relocated.stopReason ?? "UNKNOWN"})` + (relocated.notificationFallback ? ` - fallback thông báo CŨNG thất bại: ${relocated.notificationFallback.reason}` : ""),
        });
      }
      log(`  [PASS] Tìm thấy card "Làm lại" sau ${relocated.scrollsUsed} lượt cuộn.`);
      const ctaPoint = centerPoint(freshCandidate.ctaBounds);
      const tapRedo = await bridge.runSteps([
        { tapOn: { point: `${ctaPoint.x},${ctaPoint.y}` } },
        { waitForAnimationToEnd: { timeout: 3000 } },
        { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
        { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 15000 } },
      ]);
      if (!tapRedo.success) {
        return finish({ ...evidence, status: "FAIL", error: `Tap "Làm lại" thất bại: ${tapRedo.error}` });
      }
      log(`  [PASS] Đã tap "Làm lại" - vào màn Doing (lần 2).`);
    }
    const startedAt = Date.now();

    log(`[4] Trả lời ${QUESTIONS.length} câu, nhắm điểm ${plan.targetScore} (range [${REDO_SCORE_MIN},${REDO_SCORE_MAX}])...`);
    const answer = await answerAllQuestions(bridge, exam, QUESTIONS, plan.correctIndices);
    if (!answer.ok) {
      return finish({ ...evidence, status: answer.outcomeLabel === "BLOCKED_MISSING_EXERCISE_HANDLER" ? "BLOCKED" : "FAIL", error: answer.reason, answerLog: answer.answerLog });
    }
    const finalTree = answer.lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(finalTree)) {
      const liveTree = await bridge.hierarchy();
      return finish({ ...evidence, status: "FAIL", error: "Không thấy màn Kết quả sau khi trả lời hết câu (Làm lại).", liveTexts: collectAllTexts(liveTree).slice(0, 40) });
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
      perQuestion: answer.perQuestion,
    });
  } finally {
    await bridge.stop();
  }
}

main()
  .then((r) => process.exit(r.status === "PASS" ? 0 : r.status === "BLOCKED" ? 3 : 1))
  .catch((err) => {
    console.error("[resume-lamlai-round4-via-notification] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    process.exit(2);
  });
