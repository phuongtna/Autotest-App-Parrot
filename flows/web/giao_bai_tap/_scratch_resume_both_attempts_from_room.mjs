#!/usr/bin/env node
/**
 * RECOVERY (per [[feedback_recover_inplace_not_retry_after_partial_write]]) - resume a BRAND-NEW
 * assignment (room already created via assignHomeworkFlow(), lần 1 NOT yet started) after
 * findAssignment() returned NOT_FOUND (a known ~50% locate flake -
 * [[project_navigation_selector_and_card_locate_bugs]]), WITHOUT re-assigning (would orphan the
 * existing room and burn another real assign cycle for nothing). Does BOTH lần 1 (range) and
 * "Làm lại" (range) in one run, starting from the already-known ROOM_ID/ITEM_NAME/DUE_DATE - skips
 * the entire [1] ASSIGN step of e2e-giaobai-range34-lamlai-range67.mjs, reuses everything else
 * (resolveHomeworkExamQuestionsForRoomId, findAssignment/tapFoundCard, answerAllQuestions,
 * resolveScoringPlanForCandidate, locateCompletedCandidateOrOpenFromNotification) UNCHANGED - no
 * new engine logic, only re-sequenced glue.
 *
 * ENV: ROOM_ID, ITEM_NAME, DUE_DATE_DD_MM_YYYY ("DD/MM/YYYY"), PROFILE_NAME,
 *   FIRST_SCORE_MIN/MAX, REDO_SCORE_MIN/MAX, MAESTRO_DEVICE.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseEnvFile } from "../../../automation/src/config.js";
import { MaestroMcpBridge } from "../../../automation/bridge/maestroMcpBridge.js";
import { HomeworkExamEngine } from "../../../automation/bai_tap/navigation/homeworkExamEngine.js";
import { resolveHomeworkExamQuestionsForRoomId } from "../../../automation/bai_tap/discovery/teacherMaterialsExamResolver.js";
import { findAssignment, scrollToTop, tapFoundCard } from "../../../automation/bai_tap/discovery/findAssignment.js";
import { locateCompletedCandidateOrOpenFromNotification } from "../../../automation/bai_tap/discovery/locateCompletedCandidate.js";
import { centerPoint, parseBounds } from "../../../automation/bai_tap/discovery/homeworkUiList.js";

function collectNodesWithBounds(node, acc = []) {
  const attrs = node?.attributes ?? {};
  const text = attrs.text;
  if (typeof text === "string" && text.trim()) acc.push({ text: text.trim(), bounds: parseBounds(attrs.bounds) });
  for (const c of node?.children ?? []) collectNodesWithBounds(c, acc);
  return acc;
}
import { resolveScoringPlanForCandidate } from "./e2e-teacher-assign-full-scored-target5.mjs";
import { answerAllQuestions } from "./e2e-giaobai-range34-lamlai-range67.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "resume_both_attempts_from_room_report.json");
const EXAM_SESSION_PATH = join(PROJECT_ROOT, "automation", ".cache", "exam_session.json");
const ROOT_ENV = parseEnvFile(join(PROJECT_ROOT, ".env"));

const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const ROOM_ID = process.env.ROOM_ID;
const ITEM_NAME = process.env.ITEM_NAME;
const DUE_DATE_DD_MM_YYYY = process.env.DUE_DATE_DD_MM_YYYY;
const PROFILE_NAME = process.env.PROFILE_NAME;
const FIRST_SCORE_MIN = Number(process.env.FIRST_SCORE_MIN ?? 2.1);
const FIRST_SCORE_MAX = Number(process.env.FIRST_SCORE_MAX ?? 5.9);
const REDO_SCORE_MIN = Number(process.env.REDO_SCORE_MIN ?? 7.1);
const REDO_SCORE_MAX = Number(process.env.REDO_SCORE_MAX ?? 10);
const MAX_LOCATE_SCROLLS = 60;

function log(...a) { console.log(...a); }
function fmtSec(ms) { return ms == null ? "-" : `${(ms / 1000).toFixed(2)}s`; }
function toDM(ddmmyyyy) { return ddmmyyyy.slice(0, 5); }

function refreshExamSessionFromEnvCookie() {
  const examCookie = process.env.EXAM_COOKIE || ROOT_ENV.EXAM_COOKIE;
  if (!examCookie) return { refreshed: false, reason: "EXAM_COOKIE không tồn tại trong .env." };
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

function finish(result) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  return result;
}

async function main() {
  if (!APP_ID) throw new Error("Thiếu APP_ID.");
  if (!ROOM_ID || !ITEM_NAME || !DUE_DATE_DD_MM_YYYY || !PROFILE_NAME) {
    throw new Error("Thiếu ROOM_ID/ITEM_NAME/DUE_DATE_DD_MM_YYYY/PROFILE_NAME.");
  }
  const evidence = { roomId: ROOM_ID };
  const overallStart = Date.now();

  log(`[0] Refresh exam_session.json...`);
  const sess = refreshExamSessionFromEnvCookie();
  if (!sess.refreshed) return finish({ status: "BLOCKED", phase: "EXAM_SESSION_REFRESH", error: sess.reason, evidence });

  log(`[1] Resolve câu hỏi thật room_id=${ROOM_ID}...`);
  const resolved = await resolveHomeworkExamQuestionsForRoomId(ROOM_ID);
  if (resolved.status !== "RESOLVED") return finish({ status: "BLOCKED", phase: "RESOLVE_QUESTIONS", error: `status=${resolved.status}: ${resolved.reason}`, evidence });
  const QUESTIONS = resolved.questions;
  evidence.totalScoredItems = QUESTIONS.length;
  log(`  [PASS] ${QUESTIONS.length} scored items.`);

  const firstPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "range", rangeMin: FIRST_SCORE_MIN, rangeMax: FIRST_SCORE_MAX });
  if (!firstPlan.achievable) return finish({ status: "BLOCKED", phase: "FIRST_SCORE_PLAN", error: firstPlan.reason, evidence });
  const redoPlan = resolveScoringPlanForCandidate(QUESTIONS, { mode: "range", rangeMin: REDO_SCORE_MIN, rangeMax: REDO_SCORE_MAX });
  if (!redoPlan.achievable) return finish({ status: "BLOCKED", phase: "REDO_SCORE_PLAN", error: redoPlan.reason, evidence });
  log(`  [PASS] targetScore lần 1=${firstPlan.targetScore}; targetScore Làm lại=${redoPlan.targetScore}.`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);

  try {
    log(`[2] Đưa app về tab "Bài tập" (xác nhận hồ sơ "${PROFILE_NAME}" vẫn active)...`);
    const nav = await bridge.runSteps([
      { launchApp: { permissions: { all: "allow" } } },
      { extendedWaitUntil: { visible: { text: ".*(Vui học|Bài tập|Báo cáo).*" }, timeout: 30000 } },
      { tapOn: { text: "Bài tập" } },
      { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao|Bạn không có bài tập nào đang chờ).*" }, timeout: 30000 } },
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

    log(`[2] Mở bài "${ITEM_NAME}" (hạn nộp ${toDM(DUE_DATE_DD_MM_YYYY)}) qua findAssignment()...`);
    const dueDateDM = toDM(DUE_DATE_DD_MM_YYYY);
    let openedViaFallback = false;
    const located = await findAssignment(bridge, { title: ITEM_NAME, dueDateDM }, { maxScrolls: MAX_LOCATE_SCROLLS });
    let openNew;
    if (located.status !== "FOUND") {
      // FALLBACK (2026-10-26): findAssignment() NOT_FOUND 2 lần liên tiếp trên CÙNG card dù diagnostic
      // thủ công (_scratch_diag_list_homework_cards.mjs, cùng swipe gesture "50%,75%"->"50%,30%")
      // chứng minh card THẬT SỰ hiển thị chỉ sau 2-3 lần cuộn đơn giản - findAssignment() có bug thật
      // (chưa debug sâu, ngoài phạm vi recovery này). Dùng cuộn đơn giản + tapOn theo text (title đã
      // xác nhận DUY NHẤT trong toàn danh sách, không title-collision) để KHÔNG kẹt case.
      log(`  [WARN] findAssignment() status=${located.status} - cuộn lại về đỉnh (findAssignment() có thể đã để list lệch vị trí) rồi thử fallback cuộn đơn giản + tap theo tọa độ thực (bounds)...`);
      const retop = await scrollToTop(bridge);
      if (!retop.atTop) log(`  [WARN] scrollToTop() (lần 2) không xác nhận: ${retop.reason} - vẫn tiếp tục.`);
      let tapped = false;
      for (let i = 0; i < 6 && !tapped; i++) {
        const tree = await bridge.hierarchy();
        const nodes = collectNodesWithBounds(tree);
        const hit = nodes.find((n) => n.text === ITEM_NAME && n.bounds);
        // Tiêu đề KHÔNG phải vùng bấm được - CTA thật ("Làm bài"/"Tiếp tục") là 1 text node RIÊNG
        // nằm NGAY DƯỚI tiêu đề (xác nhận thủ công 2026-10-26: title bounds y2=1429, "Làm bài" bounds
        // y1=1704, cùng 1 card) - phải tap CTA đó, không tap vào chữ tiêu đề.
        const cta = hit
          ? nodes
              .filter((n) => n.bounds && (n.text === "Làm bài" || n.text === "Tiếp tục") && n.bounds.y1 > hit.bounds.y2 && n.bounds.y1 - hit.bounds.y2 < 600)
              .sort((a, b) => a.bounds.y1 - b.bounds.y1)[0]
          : null;
        if (hit && cta) {
          const pt = centerPoint(cta.bounds);
          log(`  [FALLBACK] Tìm thấy "${ITEM_NAME}" (title y2=${hit.bounds.y2}), CTA "${cta.text}" tại bounds=${JSON.stringify(cta.bounds)}, tap point=${pt.x},${pt.y}`);
          const tapRes = await bridge.runSteps([{ tapOn: { point: `${pt.x},${pt.y}` } }]);
          if (tapRes.success) { tapped = true; break; }
        }
        await bridge.runSteps([{ swipe: { start: "50%, 75%", end: "50%, 30%", duration: 400 } }, { waitForAnimationToEnd: { timeout: 1500 } }]);
      }
      if (!tapped) return finish({ status: "FAIL", phase: "OPEN_NEW_ASSIGNMENT", error: `findAssignment() status=${located.status} VÀ fallback cuộn+tap-theo-bounds cũng không tap được "${ITEM_NAME}".\n${located.diagnostics}`, evidence });
      openedViaFallback = true;
      openNew = await bridge.runSteps([
        { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
        { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 40000 } },
      ]);
    } else {
      const tapResult = await tapFoundCard(bridge, located.card);
      if (!tapResult.success) return finish({ status: "FAIL", phase: "OPEN_NEW_ASSIGNMENT", error: `tapFoundCard() thất bại: ${tapResult.error}`, evidence });
      openNew = await bridge.runSteps([
        { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
        { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 40000 } },
      ]);
    }
    evidence.openedViaFallback = openedViaFallback;
    const firstAttemptStartedAt = Date.now();
    if (!openNew.success) return finish({ status: "FAIL", phase: "OPEN_NEW_ASSIGNMENT", error: `Mở bài thất bại: ${openNew.error}`, evidence });
    log(`  [PASS] Đã vào màn Doing (lần làm đầu).`);

    log(`[3] Trả lời ${QUESTIONS.length} câu, nhắm điểm ${firstPlan.targetScore} (range [${FIRST_SCORE_MIN},${FIRST_SCORE_MAX}])...`);
    const firstAnswer = await answerAllQuestions(bridge, exam, QUESTIONS, firstPlan.correctIndices);
    if (!firstAnswer.ok) {
      return finish({ status: firstAnswer.outcomeLabel === "BLOCKED_MISSING_EXERCISE_HANDLER" ? "BLOCKED" : "FAIL", phase: "FIRST_ATTEMPT_ANSWER", error: firstAnswer.reason, evidence: { ...evidence, firstAnswerLog: firstAnswer.answerLog } });
    }
    const firstFinalTree = firstAnswer.lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(firstFinalTree)) return finish({ status: "FAIL", phase: "FIRST_ATTEMPT_RESULT", error: "Không thấy màn Kết quả (lần làm đầu).", evidence });
    const firstAttemptEndedAt = Date.now();
    const firstResult = exam.readResult(firstFinalTree);
    const firstActualScore = firstResult.score === null ? null : Number(firstResult.score);
    const firstMatched = firstActualScore !== null && !Number.isNaN(firstActualScore) && Math.abs(firstActualScore - firstPlan.targetScore) < 1e-6;
    evidence.firstAttempt = { targetScoreRange: `[${FIRST_SCORE_MIN}, ${FIRST_SCORE_MAX}]`, targetScore: firstPlan.targetScore, actualScore: firstActualScore, correct: firstResult.correct, matched: firstMatched };
    log(`  TARGET=${firstPlan.targetScore} ĐIỂM THẬT=${firstResult.score} CHÍNH XÁC=${firstResult.correct} THỜI GIAN=${fmtSec(firstAttemptEndedAt - firstAttemptStartedAt)}`);
    if (!firstMatched) return finish({ status: "FAIL", phase: "FIRST_ATTEMPT_SCORE_VERIFY", error: `Điểm thật ${firstActualScore} KHÁC target ${firstPlan.targetScore}.`, evidence });

    const closeFirst = await bridge.runSteps([
      { runFlow: { when: { visible: "Hoàn thành" }, commands: [{ tapOn: { text: ".*(Hoàn thành).*" } }] } },
      { runFlow: { when: { visible: "Tiếp theo" }, commands: [{ tapOn: { id: "exercise_result_close_button" } }] } },
      { extendedWaitUntil: { visible: { id: "homework_screen" }, timeout: 30000 } },
    ]);
    if (!closeFirst.success) return finish({ status: "FAIL", phase: "CLOSE_FIRST_RESULT", error: `Không quay lại homework_screen: ${closeFirst.error}`, evidence });
    log(`  [PASS] Đã đóng màn Kết quả (lần đầu).`);

    log(`[4] Tìm lại card "${ITEM_NAME}" (cta="Làm lại")...`);
    const relocated = await locateCompletedCandidateOrOpenFromNotification(bridge, ITEM_NAME, {
      maxScrolls: MAX_LOCATE_SCROLLS,
      expectedScore: firstActualScore,
      notificationDueDateDdMmYyyy: DUE_DATE_DD_MM_YYYY,
    });
    evidence.locateLamLai = { source: relocated.source, scrollsUsed: relocated.scrollsUsed, stopReasonBeforeFallback: relocated.stopReasonBeforeFallback ?? null };

    let redoAttemptStartedAt;
    if (relocated.source === "NOTIFICATION" && relocated.alreadyOnDoingScreen) {
      log(`  [PASS] fallback qua thông báo PASS, đã vào màn Doing (lần 2).`);
      redoAttemptStartedAt = Date.now();
    } else {
      const freshCandidate = relocated.candidates?.[0];
      if (!freshCandidate) {
        return finish({ status: "FAIL", phase: "LOCATE_LAM_LAI", error: `Không tìm lại được card sau ${relocated.scrollsUsed} lượt cuộn.`, evidence });
      }
      const ctaPoint = centerPoint(freshCandidate.ctaBounds);
      const tapRedo = await bridge.runSteps([
        { tapOn: { point: `${ctaPoint.x},${ctaPoint.y}` } },
        { waitForAnimationToEnd: { timeout: 3000 } },
        { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
        { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 15000 } },
      ]);
      redoAttemptStartedAt = Date.now();
      if (!tapRedo.success) return finish({ status: "FAIL", phase: "TAP_LAM_LAI", error: tapRedo.error, evidence });
      log(`  [PASS] Đã tap "Làm lại" - vào màn Doing (lần 2).`);
    }

    log(`[5] Trả lời lại ${QUESTIONS.length} câu, nhắm điểm ${redoPlan.targetScore} (range [${REDO_SCORE_MIN},${REDO_SCORE_MAX}])...`);
    const redoAnswer = await answerAllQuestions(bridge, exam, QUESTIONS, redoPlan.correctIndices);
    if (!redoAnswer.ok) {
      return finish({ status: redoAnswer.outcomeLabel === "BLOCKED_MISSING_EXERCISE_HANDLER" ? "BLOCKED" : "FAIL", phase: "REDO_ATTEMPT_ANSWER", error: redoAnswer.reason, evidence: { ...evidence, redoAnswerLog: redoAnswer.answerLog } });
    }
    const redoFinalTree = redoAnswer.lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(redoFinalTree)) return finish({ status: "FAIL", phase: "REDO_ATTEMPT_RESULT", error: "Không thấy màn Kết quả (Làm lại).", evidence });
    const redoAttemptEndedAt = Date.now();
    const redoResult = exam.readResult(redoFinalTree);
    const redoActualScore = redoResult.score === null ? null : Number(redoResult.score);
    const redoMatched = redoActualScore !== null && !Number.isNaN(redoActualScore) && Math.abs(redoActualScore - redoPlan.targetScore) < 1e-6;
    evidence.redoAttempt = { targetScoreRange: `[${REDO_SCORE_MIN}, ${REDO_SCORE_MAX}]`, targetScore: redoPlan.targetScore, actualScore: redoActualScore, correct: redoResult.correct, matched: redoMatched };
    log(`  TARGET=${redoPlan.targetScore} ĐIỂM THẬT=${redoResult.score} CHÍNH XÁC=${redoResult.correct} THỜI GIAN=${fmtSec(redoAttemptEndedAt - redoAttemptStartedAt)}`);
    if (!redoMatched) return finish({ status: "FAIL", phase: "REDO_ATTEMPT_SCORE_VERIFY", error: `Điểm thật ${redoActualScore} KHÁC target ${redoPlan.targetScore}.`, evidence });

    log(`[6] Đọc CTA thật đang hiển thị trên màn Kết quả rồi bấm THẬT...`);
    const ctaTexts = collectAllTexts(redoFinalTree);
    const hasTiepTheo = ctaTexts.some((t) => /Tiếp theo/.test(t));
    const hasHoanThanh = ctaTexts.some((t) => /Hoàn thành/.test(t));
    const ctaToTap = hasTiepTheo ? "Tiếp theo" : hasHoanThanh ? "Hoàn thành" : null;
    if (ctaToTap) {
      const tapFinalCta = await bridge.runSteps([{ tapOn: { text: `.*(${ctaToTap}).*` } }]);
      const landExpectation = ctaToTap === "Tiếp theo" ? { id: "exercise_close_button" } : { id: "homework_screen" };
      const landResult = tapFinalCta.success ? await bridge.wait(landExpectation, { timeout: 30000 }) : { success: false };
      evidence.finalCta = { cta: ctaToTap, landed: landResult.success };
      log(landResult.success ? `  [PASS] Đã bấm THẬT "${ctaToTap}".` : `  [WARN] Bấm "${ctaToTap}" nhưng không xác nhận điều hướng.`);
    }

    evidence.totalDurationSeconds = (Date.now() - overallStart) / 1000;
    return finish({ status: "PASS", evidence });
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
    process.exit(result.status === "PASS" ? 0 : result.status === "BLOCKED" ? 3 : 1);
  })
  .catch((err) => {
    console.error("[_scratch_resume_both_attempts_from_room] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    process.exit(2);
  });
