#!/usr/bin/env node
/**
 * Recovery-in-place (2026-11-04, round 2): e2e-giaobai-range34-lamlai-range67.mjs (PROFILE_NAME=Ngoc,
 * TARGET_CLASS_NAME=4D) đã giao THẬT qua Web GV thành công (room_id=51b4451d-507d-43c2-b93a-
 * 217e4dc3ca5b, "Choose the best response (A, B, C or D) to complete each conversation.", Unit 20:
 * At summer camp, due 11/11/2026, 10 scored items) rồi bị KILL giữa chừng do máy/host restart (adb
 * daemon phải start lại, toàn bộ tiến trình node nền + scratchpad cũ biến mất) - KHÔNG phải lỗi
 * logic/app. KHÔNG re-run script chính (sẽ giao thêm 1 room thật thứ 2 cho cùng yêu cầu,
 * [[feedback_recover_inplace_not_retry_after_partial_write]]). Thay vào đó: resume thẳng vào room đã
 * có, dùng NGUYÊN VĂN locate (findAssignment/tapFoundCard - class 4D KHÔNG có bug carousel riêng của
 * 3B) + answerAllQuestions()/resolveScoringPlanForCandidate() từ chính script chính.
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
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "resume_ngoc_4d_room51b4451d_report.json");
const ROOT_ENV = parseEnvFile(join(PROJECT_ROOT, ".env"));

const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const TARGET_ROOM_ID = "51b4451d-507d-43c2-b93a-217e4dc3ca5b";
const TARGET_TITLE = "Choose the best response (A, B, C or D) to complete each conversation.";
const DUE_DATE_DDMMYYYY = "11/11/2026";
const FIRST_SCORE_MIN = 3;
const FIRST_SCORE_MAX = 4;
const REDO_SCORE_MIN = 6;
const REDO_SCORE_MAX = 7;
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
/** v3 fix: scrollToTop() (Maestro scrollUntilVisible) + findAssignment() (Maestro swipe) đã FAIL
 * 2 lần liên tiếp trên chính danh sách này ("No visible element found" / 0 card đọc được dù
 * screenshot thủ công cho thấy card RÕ RÀNG đang hiển thị) - CÙNG root cause đã ghi nhận ở
 * [[project_3b_carousel_raw_adb_swipe_fix_2026_11_04]] (không chỉ riêng 3B). Xác nhận thủ công
 * raw `adb shell input swipe` đưa được về đỉnh thật ("2 tuần gần nhất" hiện ra) chỉ sau 15 lượt.
 * Dùng lại kỹ thuật đó: cuộn bằng raw adb, đọc state bằng bridge.hierarchy() (độc lập injection
 * path). List này còn có 1 card debris TRÙNG TITLE hạn 30/10 (QUÁ HẠN) - PHẢI lọc thêm dueDate
 * chứa "11/11" để không tap nhầm card cũ đó. */
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

async function persistentSwipeLocate(bridge, { title, dueDateFragment, maxSwipes, ctaFilter = /Làm bài|Tiếp tục/, alreadyAtTop = false }) {
  if (!alreadyAtTop) {
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
    const match = parsed.cards.find(
      (c) => c.title === title && (!dueDateFragment || (c.dueDate && c.dueDate.includes(dueDateFragment))) && c.cta && ctaFilter.test(c.cta),
    );
    if (match) return { ok: true, card: match, swipesUsed: i, seenLog };
    if (i === maxSwipes) break;
    rawAdbSwipeDown();
    await sleep(350);
  }
  return { ok: false, swipesUsed: maxSwipes, seenLog };
}

/** COPY nguyên văn từ e2e-giaobai-range34-lamlai-range67.mjs. */
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
        resultLabel: isLast ? "resume_ngoc_4d_result_screen" : null,
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
    log(`[2] Kiểm tra đã sẵn ở màn Doing chưa (v4 trước đó mở bài xong rồi dừng ở câu 1 vì AMBIGUOUS_MATCH, CHƯA trả lời câu nào - KHÔNG re-locate, resume thẳng)...`);
    const alreadyDoing = await bridge.wait({ id: "exercise_close_button" }, { timeout: 2000 });
    if (alreadyDoing.success) {
      log(`  [PASS] Đã ở màn Doing (lần làm đầu) từ trước - bỏ qua locate/open.`);
    } else {
      log(`  Chưa ở màn Doing - cuộn về đỉnh danh sách "Bài tập" (raw adb swipe - Maestro scrollUntilVisible/swipe đã FAIL 2 lần liên tiếp trên chính list này)...`);
      for (let i = 0; i < 24; i++) {
        rawAdbSwipeUp();
        await sleep(250);
      }
      log(`  Persistent-swipe locate "${TARGET_TITLE}" (hạn nộp chứa "11/11", list có debris trùng title hạn 30/10)...`);
      const located = await persistentSwipeLocate(bridge, { title: TARGET_TITLE, dueDateFragment: "11/11", maxSwipes: 40, alreadyAtTop: true });
      if (!located.ok) {
        return finish({ ...evidence, status: "FAIL", error: `Không tìm thấy card "${TARGET_TITLE}" (hạn nộp chứa "11/11") sau ${located.swipesUsed} lượt persistent-swipe.`, seenLog: located.seenLog });
      }
      log(`  [PASS] Tìm thấy card sau ${located.swipesUsed} lượt persistent-swipe (cta=${located.card.cta}, dueDate=${located.card.dueDate}).`);
      const ctaPoint = centerPoint(located.card.ctaBounds);
      const tapResult = await bridge.runSteps([{ tapOn: { point: `${ctaPoint.x},${ctaPoint.y}` } }]);
      if (!tapResult.success) {
        return finish({ ...evidence, status: "FAIL", error: `tap card thất bại: ${tapResult.error}` });
      }
      const openNew = await bridge.runSteps([
        { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
        { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 40000 } },
      ]);
      if (!openNew.success) {
        return finish({ ...evidence, status: "FAIL", error: `Mở bài vừa giao thất bại sau khi tap card: ${openNew.error}` });
      }
      log(`  [PASS] Đã vào màn Doing (lần làm đầu).`);
    }
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
      let freshCandidate = relocated.candidates?.[0];
      if (!freshCandidate) {
        log(`  [WARN] locateCompletedCandidateOrOpenFromNotification không tìm thấy (Maestro-scroll có thể lại FAIL như bước [2]) - thử persistent raw-adb-swipe...`);
        const relocatedManual = await persistentSwipeLocate(bridge, { title: TARGET_TITLE, dueDateFragment: null, maxSwipes: 40, ctaFilter: /^Làm lại$/, alreadyAtTop: false });
        if (!relocatedManual.ok) {
          return finish({ ...evidence, status: "FAIL", error: `Không tìm lại được card "${TARGET_TITLE}" với cta="Làm lại" (API relocate + persistent raw-adb-swipe đều thất bại).` });
        }
        freshCandidate = relocatedManual.card;
        log(`  [PASS] Tìm thấy card "Làm lại" qua persistent raw-adb-swipe sau ${relocatedManual.swipesUsed} lượt.`);
      } else {
        log(`  [PASS] Tìm thấy card "Làm lại" sau ${relocated.scrollsUsed} lượt cuộn.`);
      }
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
    console.error("[resume-ngoc-4d] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    process.exit(2);
  });
