#!/usr/bin/env node
/**
 * Recovery-in-place #2 cho round 3 (2026-11-10): script resume đầu tiên
 * (automation/_scratch_resume_round3_room_74449baf.mjs) FAIL ở bước mở bài lần đầu -
 * `findAssignment()` báo NOT_FOUND/PROGRESS_STALLED (cuộn danh sách "Bài tập" không thấy card
 * "G4-U1-Lesson 2: Read and tick True or False" hạn nộp 17/11/2026 - flakiness đã biết, xem
 * [[project_findassignment_not_found_despite_visible_card_2026_10_26]]). KHÔNG mất side-effect gì
 * (findAssignment chỉ đọc/cuộn, chưa tap gì) - vẫn đứng ở homework_screen.
 *
 * RỦI RO ĐÃ KIỂM TRA TRƯỚC KHI DÙNG FALLBACK THÔNG BÁO: room round 1 (edfb9ed6-..., ĐÃ hoàn thành 2
 * lần làm, average_score=4) dùng CHUNG lessonItemId+classId+dueDate với room round 3 mới
 * (74449baf-...) - cùng title/hạn nộp, nên 2 room có thể cùng xuất hiện trong icon chuông với nội
 * dung GIỐNG HỆT. Đã đọc trực tiếp cây "Thông báo" (chưa cuộn) TRƯỚC khi gọi hàm fallback: CHỈ 1
 * thông báo khớp pattern title+"Hạn nộp: 17/11/2026" đang hiển thị ở vị trí này - "Cô Phương nhắc
 * Ngoc kiểm tra bài tập mới "G4-U1-Lesson 2: Read and tick True or False". Hạn nộp: 17/11/2026."
 * (7 phút trước, khớp đúng thời điểm giao bài round 3) - thông báo "giao bài" GỐC của round 1 (nếu
 * còn tồn tại) đã bị đẩy xuống dưới tầm nhìn bởi các thông báo mới hơn (8 điểm/33 phút trước, 3
 * điểm/40 phút trước, bài round 2/50 phút trước, 2 thông báo "hoàn thành" cũ nhất/1 giờ trước) - AN
 * TOÀN, không mơ hồ tại vị trí cuộn này. `openExerciseViaGiaoBaiNotification()` tự mở lại chuông +
 * tìm match + tap + verify title hiển thị đúng sau khi vào (safety-net sẵn có).
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
import { openExerciseViaGiaoBaiNotification } from "./thong_bao/notificationGiaoBaiFallback.js";
import {
  resolveScoringPlanForCandidate,
  buildWeightedWantCorrectPlan,
} from "../flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs";
import { findMatchingQuestion } from "./bai_tap/discovery/answerSetMatcher.js";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "resume_round3_via_notification_report.json");
const ROOT_ENV = parseEnvFile(join(PROJECT_ROOT, ".env"));

const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const TARGET_ROOM_ID = "74449baf-de6b-4715-93bf-39834e2fd35f";
const TARGET_TITLE = "G4-U1-Lesson 2: Read and tick True or False";
const DUE_DATE_DDMMYYYY = "17/11/2026";
const FIRST_SCORE_MIN = 1.1;
const FIRST_SCORE_MAX = 3.9;
const REDO_SCORE_MIN = 7.1;
const REDO_SCORE_MAX = 9.9;
const MAX_LOCATE_SCROLLS = 60;

function log(...args) {
  console.log(...args);
}
function fmtSec(ms) {
  return ms == null ? "-" : `${(ms / 1000).toFixed(2)}s`;
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
            ? `AMBIGUOUS_MATCH ở câu ${questionIndex}: ${matchResult.diagnostic.contentEvidence?.candidates?.length ?? "?"} candidate CMS cùng khớp đủ answer-set.`
            : `NO_MATCH ở câu ${questionIndex} (còn ${pool.length} câu).`,
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
        resultLabel: isLast ? "resume_round3_via_notification_result_screen" : null,
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
  const evidence = { title: TARGET_TITLE, roomId: TARGET_ROOM_ID };
  const overallStart = Date.now();

  log(`[1] Resolve câu hỏi/đáp án thật qua CMS cho room_id=${TARGET_ROOM_ID}...`);
  const resolved = await resolveHomeworkExamQuestionsForRoomId(TARGET_ROOM_ID);
  if (resolved.status !== "RESOLVED") {
    return finish({ ...evidence, status: "BLOCKED", error: `resolveHomeworkExamQuestionsForRoomId status=${resolved.status}: ${resolved.reason}` });
  }
  const QUESTIONS = resolved.questions;
  log(`  [PASS] ${QUESTIONS.length} scored items resolved từ CMS.`);

  const firstPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "range", rangeMin: FIRST_SCORE_MIN, rangeMax: FIRST_SCORE_MAX });
  if (!firstPlan.achievable) {
    return finish({ ...evidence, status: "BLOCKED", error: `Không có điểm khả thi trong [${FIRST_SCORE_MIN},${FIRST_SCORE_MAX}]: ${firstPlan.reason}` });
  }
  const redoPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "range", rangeMin: REDO_SCORE_MIN, rangeMax: REDO_SCORE_MAX });
  if (!redoPlan.achievable) {
    return finish({ ...evidence, status: "BLOCKED", error: `Không có điểm khả thi trong [${REDO_SCORE_MIN},${REDO_SCORE_MAX}]: ${redoPlan.reason}` });
  }
  log(`  [PASS] targetScore lần 1=${firstPlan.targetScore} (cần đúng ${firstPlan.correctIndices.size}/${QUESTIONS.length}); targetScore Làm lại=${redoPlan.targetScore} (cần đúng ${redoPlan.correctIndices.size}/${QUESTIONS.length}).`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);

  try {
    log(`[2] Mở bài "${TARGET_TITLE}" (hạn nộp ${DUE_DATE_DDMMYYYY}) qua thông báo "giao bài" (list-locate đã FAIL ở resume trước - PROGRESS_STALLED)...`);
    const viaNotif = await openExerciseViaGiaoBaiNotification(bridge, { title: TARGET_TITLE, dueDateDdMmYyyy: DUE_DATE_DDMMYYYY });
    if (!viaNotif.ok) {
      return finish({ ...evidence, status: "FAIL", error: `openExerciseViaGiaoBaiNotification() thất bại: ${viaNotif.reason}`, landedTexts: viaNotif.landedTexts });
    }
    log(`  [PASS] Đã vào màn Doing (lần làm đầu) qua thông báo "${viaNotif.matchedNotificationText}".`);
    const firstAttemptStartedAt = Date.now();

    log(`[3] Trả lời ${QUESTIONS.length} câu, nhắm điểm ${firstPlan.targetScore} (range [${FIRST_SCORE_MIN},${FIRST_SCORE_MAX}])...`);
    const firstAnswer = await answerAllQuestions(bridge, exam, QUESTIONS, firstPlan.correctIndices);
    if (!firstAnswer.ok) {
      return finish({ ...evidence, status: firstAnswer.outcomeLabel === "BLOCKED_MISSING_EXERCISE_HANDLER" ? "BLOCKED" : "FAIL", error: firstAnswer.reason, answerLog: firstAnswer.answerLog });
    }
    const firstFinalTree = firstAnswer.lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(firstFinalTree)) {
      const liveTree = await bridge.hierarchy();
      return finish({ ...evidence, status: "FAIL", error: "Không thấy màn Kết quả sau khi trả lời hết câu (lần làm đầu).", liveTexts: collectAllTexts(liveTree).slice(0, 40) });
    }
    const firstAttemptEndedAt = Date.now();
    const firstResult = exam.readResult(firstFinalTree);
    const firstActualScore = firstResult.score === null ? null : Number(firstResult.score);
    const firstMatched = firstActualScore !== null && !Number.isNaN(firstActualScore) && Math.abs(firstActualScore - firstPlan.targetScore) < 1e-6;
    evidence.firstAttempt = {
      targetScoreRange: `[${FIRST_SCORE_MIN}, ${FIRST_SCORE_MAX}]`,
      targetScore: firstPlan.targetScore,
      actualScore: firstActualScore,
      correct: firstResult.correct,
      matched: firstMatched,
      durationMs: firstAttemptEndedAt - firstAttemptStartedAt,
      perQuestion: firstAnswer.perQuestion,
    };
    log(`  TARGET=${firstPlan.targetScore} ĐIỂM THẬT=${firstResult.score} CHÍNH XÁC=${firstResult.correct} THỜI GIAN=${fmtSec(firstAttemptEndedAt - firstAttemptStartedAt)}`);
    if (!firstMatched) {
      return finish({ ...evidence, status: "FAIL", error: `Điểm thật ${firstActualScore} KHÁC target ${firstPlan.targetScore}.` });
    }

    const closeFirst = await bridge.runSteps([
      { runFlow: { when: { visible: "Hoàn thành" }, commands: [{ tapOn: { text: ".*(Hoàn thành).*" } }] } },
      { runFlow: { when: { visible: "Tiếp theo" }, commands: [{ tapOn: { id: "exercise_result_close_button" } }] } },
      { extendedWaitUntil: { visible: { id: "homework_screen" }, timeout: 30000 } },
    ]);
    if (!closeFirst.success) {
      return finish({ ...evidence, status: "FAIL", error: `Không quay lại homework_screen sau lần làm đầu: ${closeFirst.error}` });
    }
    log(`  [PASS] Đã đóng màn Kết quả (lần đầu), về lại danh sách Bài tập.`);

    log(`[4] Tìm lại card "${TARGET_TITLE}" (cta="Làm lại", điểm=${firstActualScore} - PHÂN BIỆT với room round 1 CÙNG title, average_score=4 khác điểm lần-1 thuần=${firstActualScore})...`);
    const relocated = await locateCompletedCandidateOrOpenFromNotification(bridge, TARGET_TITLE, {
      maxScrolls: MAX_LOCATE_SCROLLS,
      expectedScore: firstActualScore,
      notificationDueDateDdMmYyyy: DUE_DATE_DDMMYYYY,
    });
    evidence.locateLamLai = { source: relocated.source, scrollsUsed: relocated.scrollsUsed, stopReasonBeforeFallback: relocated.stopReasonBeforeFallback ?? null };

    let redoAttemptStartedAt;
    if (relocated.source === "NOTIFICATION" && relocated.alreadyOnDoingScreen) {
      log(`  [PASS] fallback qua thông báo "giao bài" PASS, đã vào màn Doing (lần 2).`);
      redoAttemptStartedAt = Date.now();
    } else {
      const freshCandidate = relocated.candidates?.[0];
      if (!freshCandidate) {
        return finish({ ...evidence, status: "FAIL", error: `locateCompletedCandidateOrOpenFromNotification không tìm thấy card "${TARGET_TITLE}" (điểm=${firstActualScore}) với cta="Làm lại".` });
      }
      log(`  [PASS] Tìm thấy card "Làm lại" sau ${relocated.scrollsUsed} lượt cuộn.`);
      const ctaPoint = centerPoint(freshCandidate.ctaBounds);
      const tapRedo = await bridge.runSteps([
        { tapOn: { point: `${ctaPoint.x},${ctaPoint.y}` } },
        { waitForAnimationToEnd: { timeout: 3000 } },
        { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
        { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 15000 } },
      ]);
      redoAttemptStartedAt = Date.now();
      if (!tapRedo.success) {
        return finish({ ...evidence, status: "FAIL", error: `Tap "Làm lại" thất bại: ${tapRedo.error}` });
      }
      log(`  [PASS] Đã tap "Làm lại" - vào màn Doing (lần 2).`);
    }

    log(`[5] Trả lời lại ${QUESTIONS.length} câu, nhắm điểm ${redoPlan.targetScore} (range [${REDO_SCORE_MIN},${REDO_SCORE_MAX}])...`);
    const redoAnswer = await answerAllQuestions(bridge, exam, QUESTIONS, redoPlan.correctIndices);
    if (!redoAnswer.ok) {
      return finish({ ...evidence, status: redoAnswer.outcomeLabel === "BLOCKED_MISSING_EXERCISE_HANDLER" ? "BLOCKED" : "FAIL", error: redoAnswer.reason, redoAnswerLog: redoAnswer.answerLog });
    }
    const redoFinalTree = redoAnswer.lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(redoFinalTree)) {
      const liveTree = await bridge.hierarchy();
      return finish({ ...evidence, status: "FAIL", error: "Không thấy màn Kết quả sau khi trả lời hết câu (Làm lại).", liveTexts: collectAllTexts(liveTree).slice(0, 40) });
    }
    const redoAttemptEndedAt = Date.now();
    const redoResult = exam.readResult(redoFinalTree);
    const redoActualScore = redoResult.score === null ? null : Number(redoResult.score);
    const redoMatched = redoActualScore !== null && !Number.isNaN(redoActualScore) && Math.abs(redoActualScore - redoPlan.targetScore) < 1e-6;
    evidence.redoAttempt = {
      targetScoreRange: `[${REDO_SCORE_MIN}, ${REDO_SCORE_MAX}]`,
      targetScore: redoPlan.targetScore,
      actualScore: redoActualScore,
      correct: redoResult.correct,
      matched: redoMatched,
      durationMs: redoAttemptEndedAt - redoAttemptStartedAt,
      perQuestion: redoAnswer.perQuestion,
    };
    log(`  TARGET=${redoPlan.targetScore} ĐIỂM THẬT=${redoResult.score} CHÍNH XÁC=${redoResult.correct} THỜI GIAN=${fmtSec(redoAttemptEndedAt - redoAttemptStartedAt)}`);
    if (!redoMatched) {
      return finish({ ...evidence, status: "FAIL", error: `Điểm thật ${redoActualScore} KHÁC target ${redoPlan.targetScore}.` });
    }

    log(`[6] Đọc CTA thật đang hiển thị trên màn Kết quả rồi bấm THẬT...`);
    const ctaTexts = collectAllTexts(redoFinalTree);
    const hasTiepTheo = ctaTexts.some((t) => /Tiếp theo/.test(t));
    const hasHoanThanh = ctaTexts.some((t) => /Hoàn thành/.test(t));
    if (!hasTiepTheo && !hasHoanThanh) {
      return finish({ ...evidence, status: "FAIL", error: `Không thấy CTA "Tiếp theo" lẫn "Hoàn thành". Texts: ${JSON.stringify(ctaTexts)}` });
    }
    const ctaToTap = hasTiepTheo ? "Tiếp theo" : "Hoàn thành";
    const tapFinalCta = await bridge.runSteps([{ tapOn: { text: `.*(${ctaToTap}).*` } }]);
    if (!tapFinalCta.success) {
      return finish({ ...evidence, status: "FAIL", error: `Tap "${ctaToTap}" thất bại: ${tapFinalCta.error}` });
    }
    const landExpectation = ctaToTap === "Tiếp theo" ? { id: "exercise_close_button" } : { id: "homework_screen" };
    const landResult = await bridge.wait(landExpectation, { timeout: 30000 });
    evidence.finalCta = { cta: ctaToTap, landed: landResult.success };
    if (!landResult.success) {
      return finish({ ...evidence, status: "FAIL", error: `Bấm "${ctaToTap}" nhưng không xác nhận được điều hướng đúng: ${landResult.error}` });
    }
    log(`  [PASS] Đã bấm THẬT "${ctaToTap}" - điều hướng đúng.`);

    evidence.totalDurationSeconds = (Date.now() - overallStart) / 1000;
    return finish({ ...evidence, status: "PASS" });
  } finally {
    await bridge.stop();
    log("[MCP] Đã dừng tiến trình `maestro mcp`.");
  }
}

main()
  .then((r) => {
    process.exit(r.status === "PASS" ? 0 : r.status === "BLOCKED" ? 3 : 1);
  })
  .catch((err) => {
    console.error("[resume-round3-via-notification] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    process.exit(2);
  });
