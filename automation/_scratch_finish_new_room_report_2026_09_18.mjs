#!/usr/bin/env node
/**
 * Scratch: bypass findAssignment() flakiness (NOT_FOUND/END_OF_LIST dù card đã xác nhận CÓ THẬT
 * qua screenshot tay) cho room mới giao "Choose the correct sentence or the sentence closest in
 * meaning." (REPORT_TEST_PROFILE, hạn 18/09/2026 - trong tuần report đang chạy, đóng tối nay).
 * Cùng kỹ thuật "Direct handler invocation bypass" đã dùng cho _scratch_finish_stuck_room_fullscore.mjs,
 * chỉ khác: cta="Làm bài" (chưa làm, không phải "Tiếp tục"), và target score = 7/10 (KHÔNG full điểm)
 * theo đúng scoring plan đã resolve ở lượt chạy REUSE_ROOM_ID trước (targetScore=7, range [6.8,7.8]).
 */
import { MaestroMcpBridge } from "./bridge/maestroMcpBridge.js";
import { HomeworkExamEngine } from "./bai_tap/navigation/homeworkExamEngine.js";
import { findAssignment } from "./bai_tap/discovery/findAssignment.js";
import { findMatchingQuestion } from "./bai_tap/discovery/answerSetMatcher.js";
import { centerPoint } from "./bai_tap/discovery/homeworkUiList.js";
import { parseQuestionsFromExamPage } from "./discovery/examPageScraper.js";
import { normalizeQuestions } from "./model/questionModel.js";
import { refreshExamSessionFromEnvCookie, buildWeightedWantCorrectPlan } from "./bai_tap/pro_lamlai_target_score.mjs";

function collectAllTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectAllTexts(c, acc);
  return acc;
}

// Tham số hoá qua ENV (2026-09-18, lần dùng lại thứ 2 cùng ngày) - TÁI SỬ DỤNG file này cho MỌI
// room bị bug locate, không tạo file mới mỗi lần. correctCount ưu tiên hơn TARGET_SCORE nếu có
// (tránh sai số chia N không tròn - vd N=15, target=2.667 = đúng 4 câu, KHÔNG suy ra ngược từ
// TARGET_SCORE*N/10 dễ lệch do rounding).
const ROOM_ID = process.env.ROOM_ID || "662a4018-9f5d-47f4-8598-3e5e11ab5faf";
const REAL_EXAM_ID = process.env.REAL_EXAM_ID || "97a9d97e-5611-45d3-b72b-d3e9fb7984a2"; // room.exams[0].id thật, KHÁC catalog_exam_id
const TITLE = process.env.ROOM_TITLE || "Choose the correct sentence or the sentence closest in meaning.";
const DUE_DM = process.env.DUE_DM || "18/09";
const TARGET_SCORE = Number(process.env.TARGET_SCORE || 7);
const CORRECT_COUNT = process.env.CORRECT_COUNT ? Number(process.env.CORRECT_COUNT) : null;
const APP_ID = process.env.APP_ID || "com.inet.parrotedu";
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
// findAssignment() locate liên tục NOT_FOUND/END_OF_LIST sau 7 scroll (3 lần thử độc lập, khác
// hẳn sync-delay - xem project_navigation_selector_and_card_locate_bugs). Đã mở CARD BẰNG TAY
// (adb tap trực tiếp, xác nhận qua screenshot) - màn hiện đang bị chặn bởi popup "AI hỗ trợ học
// tập". Set ALREADY_OPEN=true để bỏ qua bước [2]-[4] (locate+tap CTA), chỉ dismiss popup rồi vào
// thẳng bước [5] trả lời - TÁI SỬ DỤNG HomeworkExamEngine/findMatchingQuestion nguyên trạng.
const ALREADY_OPEN = process.env.ALREADY_OPEN === "true";

function log(...a) {
  console.log(...a);
}

function pickCorrectIndices(total, count) {
  const idx = Array.from({ length: total }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return new Set(idx.slice(0, count));
}

async function main() {
  const refreshResult = refreshExamSessionFromEnvCookie();
  log("[EXAM_SESSION]", JSON.stringify(refreshResult));
  if (!refreshResult.refreshed) throw new Error("EXAM_COOKIE refresh thất bại - chạy get_tokens.sh trước.");

  log(`[CMS] Lấy câu hỏi THẬT của room qua examId đúng (${REAL_EXAM_ID}, KHÔNG qua catalog resolver)...`);
  const examData = await parseQuestionsFromExamPage(REAL_EXAM_ID);
  const QUESTIONS = normalizeQuestions(examData);
  log(`  [PASS] ${QUESTIONS.length} câu đã resolve. types=${QUESTIONS.map((q) => q.type).join(",")}`);

  const correctCount = CORRECT_COUNT ?? Math.round(TARGET_SCORE);
  const correctIndices = pickCorrectIndices(QUESTIONS.length, correctCount);
  const WANT_CORRECT = buildWeightedWantCorrectPlan(QUESTIONS, correctIndices);
  log(`[PLAN] targetScore=${TARGET_SCORE} correctCount=${correctCount}/${QUESTIONS.length}, correctIndices=${JSON.stringify([...correctIndices].sort((a, b) => a - b))}`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);
  try {
    if (ALREADY_OPEN) {
      log('[1] ALREADY_OPEN=true - bỏ qua check hồ sơ qua header (đã verify tay qua screenshot TRƯỚC khi mở card, header không còn hiển thị khi đã ở màn Doing)...');
    } else {
      log('[1] Xác nhận hồ sơ "QA Report Test" đang active...');
      const treeCheck = await bridge.hierarchy();
      const texts = collectAllTexts(treeCheck);
      if (!texts.some((t) => /QA Report Test/.test(t))) {
        throw new Error(`Hồ sơ hiện tại KHÔNG phải "QA Report Test" - dừng, không tự chuyển. visibleTexts=${JSON.stringify(texts.slice(0, 20))}`);
      }
      log("  [PASS] Đúng hồ sơ.");
    }

    if (ALREADY_OPEN) {
      log("[2-4] ALREADY_OPEN=true - bỏ qua locate+tap CTA (đã mở tay), chỉ dismiss popup AI hỗ trợ nếu có...");
      await bridge.runSteps([{ runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: { id: "app_dialog_ok_button" } }] } }]);
      await bridge.wait({ id: "exercise_close_button" }, { timeout: 40000 });
      log("  [PASS] Đã vào màn Doing.");
    } else {
      log('[2] Mở tab "Bài tập", cuộn về đầu...');
      await bridge.runSteps([
        { tapOn: { text: "Bài tập", optional: true } },
        { repeat: { times: 8, commands: [{ swipe: { direction: "DOWN", duration: 250 } }] } },
        { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|2 tuần gần nhất).*" }, timeout: 30000 } },
      ]);

      log(`[3] findAssignment() thô (KHÔNG content-verify) - title="${TITLE}" due=${DUE_DM} cta=Làm bài...`);
      const located = await findAssignment(bridge, { title: TITLE, dueDateDM: DUE_DM, cta: "Làm bài" }, { maxScrolls: 30 });
      if (located.status !== "FOUND") {
        throw new Error(`findAssignment() không FOUND (status=${located.status}, reason=${located.reason ?? "-"}) - diagnostics=${located.diagnostics}`);
      }
      log(`  [PASS] Tìm thấy sau ${located.scrollCount} lượt cuộn.`);

      log('[4] Tap CTA "Làm bài", xử lý popup AI hỗ trợ nếu có...');
      const ctaPoint = centerPoint(located.card.ctaBounds);
      await bridge.runSteps([
        { tapOn: { point: `${ctaPoint.x},${ctaPoint.y}` } },
        { waitForAnimationToEnd: { timeout: 3000 } },
        { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: { id: "app_dialog_ok_button" } }] } },
      ]);
      await bridge.wait({ id: "exercise_close_button" }, { timeout: 40000 });
      log("  [PASS] Đã vào màn Doing.");
    }

    log(`[5] Trả lời TẤT CẢ ${QUESTIONS.length} câu, đúng ${TARGET_SCORE}/${QUESTIONS.length}...`);
    const answeredIds = new Set();
    let carryTree = null;
    let lastOutcome = null;
    while (answeredIds.size < QUESTIONS.length) {
      const questionIndex = answeredIds.size + 1;
      const pool = QUESTIONS.filter((q) => !answeredIds.has(q.id));
      const matchResult = await findMatchingQuestion(bridge, pool, carryTree, questionIndex, { roomExamId: REAL_EXAM_ID, candidateExamId: REAL_EXAM_ID });
      if (matchResult.status !== "MATCHED") {
        throw new Error(
          `Match thất bại ở câu ${questionIndex} (status=${matchResult.status}) - visibleTexts=${JSON.stringify(collectAllTexts(carryTree ?? (await bridge.hierarchy())).slice(0, 30))}`,
        );
      }
      const matched = matchResult.question;
      const isLast = answeredIds.size === QUESTIONS.length - 1;
      const wantCorrect = WANT_CORRECT.get(matched.id) ?? true;
      const outcome = await exam.answerCurrentQuestionOneShot(matched, {
        wantCorrect,
        resultLabel: isLast ? "scratch_finish_new_room_result" : null,
        snapshot: matched._snapshot ?? null,
      });
      if (!outcome.supported) throw new Error(`Handler không hỗ trợ câu "${matched.question}" (id=${matched.id}): ${outcome.reason}`);
      lastOutcome = outcome;
      carryTree = outcome.finalTree ?? null;
      answeredIds.add(matched.id);
      log(`  Câu ${answeredIds.size}/${QUESTIONS.length}: wantCorrect=${wantCorrect} isTargetCorrect=${outcome.isTargetCorrect}`);
    }

    log("[6] Đọc màn Kết quả...");
    let finalTree = lastOutcome?.finalTree ?? (await bridge.hierarchy());
    if (!exam.isResultScreen(finalTree)) {
      await bridge.wait({ id: "exercise_result_screen" }, { timeout: 20000 });
      finalTree = await bridge.hierarchy();
    }
    const isResult = exam.isResultScreen(finalTree);
    const result = isResult ? exam.readResult(finalTree) : null;
    log(`  isResultScreen=${isResult} result=${JSON.stringify(result)}`);
    console.log("\n=== KẾT QUẢ ===");
    console.log(JSON.stringify({ roomId: ROOM_ID, examId: REAL_EXAM_ID, totalQuestions: QUESTIONS.length, targetScore: TARGET_SCORE, isResult, result }, null, 2));
  } finally {
    await bridge.stop();
  }
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
