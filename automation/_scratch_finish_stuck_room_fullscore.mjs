#!/usr/bin/env node
/**
 * Scratch: hoàn thành 1 room ĐANG DỞ DANG (cta="Tiếp tục") mà locateOpenAndVerifyAssignment()
 * không resume được do CONTENT_MISMATCH (title templated dùng chung nhiều room, catalog resolver
 * lấy nhầm examId - xem project_truefalse_answer_engine_score_mismatch). Bypass hoàn toàn bước
 * content-fingerprint verify: dùng findAssignment() thô (chỉ UI-level title+dueDate+cta, KHÔNG
 * verify nội dung) để lấy ctaBounds rồi tap thẳng, sau đó dùng examId THẬT của CHÍNH room này
 * (room.exams[0].id qua fetchRoomDetails() - không phải examId catalog nhầm) để tự tay tra câu
 * hỏi/đáp án đúng qua parseQuestionsFromExamPage(), rồi trả lời FULL ĐIỂM (wantCorrect=true mọi
 * câu) bằng HomeworkExamEngine/findMatchingQuestion (CÙNG pipeline mọi flow khác dùng, chỉ khác
 * nguồn examId đầu vào).
 *
 * KHÔNG viết engine mới - chỉ orchestrate lại các hàm đã có sẵn theo đúng tinh thần
 * "Direct handler invocation bypass technique" (feedback_direct_handler_invocation_bypass).
 */
import { MaestroMcpBridge } from "./bridge/maestroMcpBridge.js";
import { HomeworkExamEngine } from "./bai_tap/navigation/homeworkExamEngine.js";
import { findAssignment } from "./bai_tap/discovery/findAssignment.js";
import { findMatchingQuestion } from "./bai_tap/discovery/answerSetMatcher.js";
import { centerPoint } from "./bai_tap/discovery/homeworkUiList.js";
import { parseQuestionsFromExamPage } from "./discovery/examPageScraper.js";
import { normalizeQuestions } from "./model/questionModel.js";
import { refreshExamSessionFromEnvCookie } from "./bai_tap/pro_lamlai_target_score.mjs";

function collectAllTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectAllTexts(c, acc);
  return acc;
}

const ROOM_ID = "ea84dfc3-6179-4a41-90fb-d9cead9b1421";
const REAL_EXAM_ID = "16beddd8-b503-444d-9a73-b66aa62284c4"; // room.exams[0].id thật (fetchRoomDetails), KHÁC examId catalog bị nhầm
const TITLE = "Read the passage and decide whether each statement is True (T) or False (F).";
const DUE_DM = "11/09";
const APP_ID = process.env.APP_ID || "com.inet.parrotedu";
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";

function log(...a) {
  console.log(...a);
}

async function main() {
  const refreshResult = refreshExamSessionFromEnvCookie();
  log("[EXAM_SESSION]", JSON.stringify(refreshResult));
  if (!refreshResult.refreshed) throw new Error("EXAM_COOKIE refresh thất bại - chạy get_tokens.sh trước.");

  log(`[CMS] Lấy câu hỏi THẬT của room qua examId đúng (${REAL_EXAM_ID}, KHÔNG qua catalog resolver)...`);
  const examData = await parseQuestionsFromExamPage(REAL_EXAM_ID);
  const QUESTIONS = normalizeQuestions(examData);
  log(`  [PASS] ${QUESTIONS.length} câu đã resolve. types=${QUESTIONS.map((q) => q.type).join(",")}`);
  const WANT_CORRECT = new Map(QUESTIONS.map((q) => [q.id, true]));

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);
  try {
    log('[1] Xác nhận hồ sơ "QA Report Test" đang active...');
    const treeCheck = await bridge.hierarchy();
    const texts = collectAllTexts(treeCheck);
    if (!texts.some((t) => /QA Report Test/.test(t))) {
      throw new Error(`Hồ sơ hiện tại KHÔNG phải "QA Report Test" - dừng, không tự chuyển. visibleTexts=${JSON.stringify(texts.slice(0, 20))}`);
    }
    log("  [PASS] Đúng hồ sơ.");

    log('[2] Mở tab "Bài tập", cuộn về đầu...');
    await bridge.runSteps([
      { tapOn: { text: "Bài tập", optional: true } },
      { repeat: { times: 5, commands: [{ swipe: { direction: "DOWN", duration: 250 } }] } },
      { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|2 tuần gần nhất).*" }, timeout: 30000 } },
    ]);

    log(`[3] findAssignment() thô (KHÔNG content-verify) - title="${TITLE}" due=${DUE_DM} cta=Tiếp tục...`);
    const located = await findAssignment(bridge, { title: TITLE, dueDateDM: DUE_DM, cta: "Tiếp tục" }, { maxScrolls: 30 });
    if (located.status !== "FOUND") {
      throw new Error(`findAssignment() không FOUND (status=${located.status}, reason=${located.reason ?? "-"}) - diagnostics=${located.diagnostics}`);
    }
    log(`  [PASS] Tìm thấy sau ${located.scrollCount} lượt cuộn.`);

    log('[4] Tap CTA "Tiếp tục", xử lý popup AI hỗ trợ nếu có...');
    const ctaPoint = centerPoint(located.card.ctaBounds);
    await bridge.runSteps([
      { tapOn: { point: `${ctaPoint.x},${ctaPoint.y}` } },
      { waitForAnimationToEnd: { timeout: 3000 } },
      { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
    ]);
    await bridge.wait({ id: "exercise_close_button" }, { timeout: 40000 });
    log("  [PASS] Đã vào màn Doing (resume thành công qua bypass).");

    log(`[5] Trả lời TẤT CẢ ${QUESTIONS.length} câu, ĐÚNG HẾT (full điểm)...`);
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
      const outcome = await exam.answerCurrentQuestionOneShot(matched, {
        wantCorrect: true,
        resultLabel: isLast ? "scratch_finish_stuck_room_result" : null,
        snapshot: matched._snapshot ?? null,
      });
      if (!outcome.supported) throw new Error(`Handler không hỗ trợ câu "${matched.question}" (id=${matched.id}): ${outcome.reason}`);
      lastOutcome = outcome;
      carryTree = outcome.finalTree ?? null;
      answeredIds.add(matched.id);
      log(`  Câu ${answeredIds.size}/${QUESTIONS.length}: isTargetCorrect=${outcome.isTargetCorrect}`);
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
    console.log(JSON.stringify({ roomId: ROOM_ID, examId: REAL_EXAM_ID, totalQuestions: QUESTIONS.length, isResult, result }, null, 2));
  } finally {
    await bridge.stop();
  }
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
