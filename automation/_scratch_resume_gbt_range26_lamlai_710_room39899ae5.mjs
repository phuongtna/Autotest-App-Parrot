#!/usr/bin/env node
/**
 * Recovery-in-place (2026-11-04): e2e-giaobai-range34-lamlai-range67.mjs báo findAssignment()
 * NOT_FOUND/PROGRESS_STALLED cho room đã giao thật qua Web GV (room_id=39899ae5-fa3b-40cf-91ba-
 * cee3f088f655, "Choose the word that matches each description below.", class 3B, due 11/11/2026).
 * Xác nhận thủ công (screenshot + adb raw swipe) app KHÔNG freeze - card tồn tại thật, chỉ bị kẹt
 * trong vùng "Kiến thức trong bài" carousel (raw swipe gesture bị "nuốt" ở đó, đúng root cause đã
 * ghi nhận ở [[project_3b_carousel_swipe_swallow_locate_bug_2026_09_17]]) - findAssignment()'s
 * plateau-detection dừng sớm đúng thiết kế của nó (false negative, không phải end-of-list thật).
 *
 * KHÔNG re-run script chính (sẽ giao thêm 1 room thật thứ 2, [[feedback_recover_inplace_not_retry_after_partial_write]]).
 * Thay vào đó: tự locate bằng persistent-swipe (bỏ qua early-stop-on-plateau, cùng kỹ thuật đã PASS
 * trong memory trên) rồi nối tiếp NGUYÊN VĂN answerAllQuestions()/resolveScoringPlanForCandidate()
 * từ e2e-giaobai-range34-lamlai-range67.mjs cho cả 2 lượt làm (không viết engine mới).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { parseEnvFile } from "./src/config.js";
import { MaestroMcpBridge } from "./bridge/maestroMcpBridge.js";
import { HomeworkExamEngine } from "./bai_tap/navigation/homeworkExamEngine.js";
import { resolveHomeworkExamQuestionsForRoomId } from "./bai_tap/discovery/teacherMaterialsExamResolver.js";
import { locateCompletedCandidateOrOpenFromNotification } from "./bai_tap/discovery/locateCompletedCandidate.js";
import {
  collectTextNodesWithBoundsInsideScrollableList,
  parseHomeworkCardsWithDetail,
  centerPoint,
} from "./bai_tap/discovery/homeworkUiList.js";
import {
  resolveScoringPlanForCandidate,
  buildWeightedWantCorrectPlan,
} from "../flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs";
import { findMatchingQuestion } from "./bai_tap/discovery/answerSetMatcher.js";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "resume_gbt_range26_lamlai_710_room39899ae5_report.json");
const ROOT_ENV = parseEnvFile(join(PROJECT_ROOT, ".env"));

const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const TARGET_ROOM_ID = "39899ae5-fa3b-40cf-91ba-cee3f088f655";
const TARGET_TITLE = "Choose the word that matches each description below.";
const DUE_DATE_DDMMYYYY = "11/11/2026";
const FIRST_SCORE_MIN = 2.1;
const FIRST_SCORE_MAX = 5.9;
const REDO_SCORE_MIN = 7.1;
const REDO_SCORE_MAX = 10;
const MAX_LOCATE_SCROLLS = 60;
const MAX_PERSISTENT_SWIPES = 40;

/** Raw adb touch injection (KHÔNG qua Maestro `swipe`) - Maestro's swipe gesture đã confirm bị
 * "nuốt" trong vùng carousel "Kiến thức trong bài" ở room này (2 lần, cả findAssignment() lẫn
 * bridge.runSteps({swipe}) tự viết). Raw `adb shell input swipe` đã PROVEN thủ công di chuyển được
 * list xuyên suốt (kể cả qua carousel) - dùng lại CHÍNH injection path đó, chỉ đọc state qua
 * `bridge.hierarchy()` (độc lập với cách gesture được bơm vào, vẫn đúng UI hiện tại). */
function rawAdbSwipe(x1, y1, x2, y2, durationMs = 250) {
  execFileSync("adb", ["shell", "input", "swipe", String(x1), String(y1), String(x2), String(y2), String(durationMs)]);
}
function rawAdbSwipeDown() {
  rawAdbSwipe(460, 1700, 460, 700, 250);
}
function rawAdbSwipeUp() {
  rawAdbSwipe(460, 700, 460, 1900, 200);
}
async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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

/** COPY nguyên văn từ e2e-giaobai-range34-lamlai-range67.mjs / _scratch_resume_round12. */
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
        resultLabel: isLast ? "resume_gbt_range26_result_screen" : null,
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

/** Persistent-swipe locate (bỏ qua early-stop-on-plateau) - CÙNG kỹ thuật đã PASS trong
 * [[project_3b_carousel_swipe_swallow_locate_bug_2026_09_17]]: cứ swipe tiếp (STRATEGY_A, bất kể
 * viewport "trông như" không đổi), đọc lại hierarchy sau MỖI swipe, tìm card qua
 * parseHomeworkCardsWithDetail(). KHÔNG dùng findAssignment() (đã confirm stall ở đúng room này). */
async function persistentSwipeLocate(bridge, { title, maxSwipes, ctaFilter = /Làm bài|Tiếp tục/, alreadyAtTop = false }) {
  if (!alreadyAtTop) {
    // Raw-adb scroll UP tới hết cỡ (quá trần an toàn 1 chút - list dừng cứng ở đỉnh thật, KHÔNG
    // hại gì khi "thừa" lượt) - KHÔNG dùng scrollToTop()/Maestro scrollUntilVisible (đã confirm bị
    // swallow/stuck trong carousel ở chính room này, xem docblock đầu file).
    for (let i = 0; i < 24; i++) {
      rawAdbSwipeUp();
      await sleep(250);
    }
  }
  let sectionSeen = false;
  const seenLog = [];
  for (let i = 0; i <= maxSwipes; i++) {
    const tree = await bridge.hierarchy();
    const nodes = collectTextNodesWithBoundsInsideScrollableList(tree, []);
    const parsed = parseHomeworkCardsWithDetail(nodes, { sectionSeen });
    sectionSeen = parsed.sectionSeen;
    seenLog.push(parsed.cards.map((c) => `${c.title}|${c.dueDate ?? c.score ?? "-"}|${c.cta}`));
    const match = parsed.cards.find((c) => c.title === title && c.cta && ctaFilter.test(c.cta));
    if (match) return { ok: true, card: match, swipesUsed: i, seenLog };
    if (i === maxSwipes) break;
    rawAdbSwipeDown();
    await sleep(350);
  }
  return { ok: false, swipesUsed: maxSwipes, seenLog };
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
    log(`[2] Persistent-swipe locate "${TARGET_TITLE}" (due ${DUE_DATE_DDMMYYYY}) qua raw adb swipe (Maestro swipe đã confirm bị carousel nuốt)...`);
    const located = await persistentSwipeLocate(bridge, { title: TARGET_TITLE, maxSwipes: MAX_PERSISTENT_SWIPES, alreadyAtTop: true });
    evidence.locateFirstOpen = { ok: located.ok, swipesUsed: located.swipesUsed };
    if (!located.ok) {
      return finish({ ...evidence, status: "FAIL", error: `Không tìm thấy card "${TARGET_TITLE}" sau ${located.swipesUsed} lượt persistent-swipe.`, seenLog: located.seenLog });
    }
    log(`  [PASS] Tìm thấy card sau ${located.swipesUsed} lượt persistent-swipe (cta=${located.card.cta}).`);

    const ctaPoint = centerPoint(located.card.ctaBounds);
    const openFirst = await bridge.runSteps([
      { tapOn: { point: `${ctaPoint.x},${ctaPoint.y}` } },
      { waitForAnimationToEnd: { timeout: 3000 } },
      { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
      { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 20000 } },
    ]);
    if (!openFirst.success) {
      return finish({ ...evidence, status: "FAIL", error: `Mở bài thất bại: ${openFirst.error}` });
    }
    log(`  [PASS] Đã mở bài - vào màn Doing (lần 1).`);
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

    log(`[4] Tìm lại card "${TARGET_TITLE}" (cta="Làm lại")...`);
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
        log(`  [WARN] locateCompletedCandidateOrOpenFromNotification không tìm thấy - thử persistent-swipe (cùng kỹ thuật bước [2])...`);
        const relocatedManual = await persistentSwipeLocate(bridge, { title: TARGET_TITLE, maxSwipes: MAX_PERSISTENT_SWIPES, ctaFilter: /^Làm lại$/ });
        if (!relocatedManual.ok || relocatedManual.card.cta !== "Làm lại") {
          return finish({
            ...evidence,
            status: "FAIL",
            error: `Không tìm lại được card "${TARGET_TITLE}" với cta="Làm lại" (API relocate + persistent-swipe đều thất bại).`,
          });
        }
        const ctaPointManual = centerPoint(relocatedManual.card.ctaBounds);
        const tapRedoManual = await bridge.runSteps([
          { tapOn: { point: `${ctaPointManual.x},${ctaPointManual.y}` } },
          { waitForAnimationToEnd: { timeout: 3000 } },
          { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
          { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 15000 } },
        ]);
        redoAttemptStartedAt = Date.now();
        if (!tapRedoManual.success) {
          return finish({ ...evidence, status: "FAIL", error: `Tap "Làm lại" (persistent-swipe fallback) thất bại: ${tapRedoManual.error}` });
        }
        log(`  [PASS] Đã tap "Làm lại" qua persistent-swipe fallback - vào màn Doing (lần 2).`);
      } else {
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
    console.error("[resume-gbt-range26] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    process.exit(2);
  });
