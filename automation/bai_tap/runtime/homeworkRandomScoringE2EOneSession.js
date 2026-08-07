#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config, parseEnvFile } from "../../src/config.js";
import { MaestroBridge } from "../../bridge/maestroBridge.js";
import { HomeworkNavigationEngine } from "../navigation/homeworkNavigationEngine.js";
import { homeworkPageObjects as po } from "../navigation/homeworkPageObjects.js";
import { HomeworkExamEngine } from "../navigation/homeworkExamEngine.js";
import { collectVisibleHomeworkCardsViaMcpSession } from "../discovery/homeworkUiList.js";
import { MaestroMcpSession } from "../discovery/maestroMcpSession.js";
import { resolveHomeworkExamQuestions } from "../discovery/homeworkExamResolver.js";
import { pickRandom } from "../../discovery/randomPicker.js";

/**
 * Biến thể GỘP SESSION của `homeworkRandomScoringE2E.js` (file gốc GIỮ NGUYÊN không sửa, KHÔNG bị
 * xoá theo yêu cầu - xem cùng file cho mọi chi tiết business logic/quyết định đáp án/verify điểm,
 * KHÔNG lặp lại ở đây). CÙNG business flow, CÙNG Handler (`HomeworkExamEngine.decideAnswerAction`,
 * KHÔNG đổi), CÙNG cách resolve Exam/CMS/Correct Answer (`resolveHomeworkExamQuestions`, KHÔNG
 * đổi), CÙNG logic random Homework (`pickRandom`, KHÔNG đổi) - CHỈ khác kiến trúc gọi
 * `MaestroBridge`: dồn các thao tác UI tĩnh (không cần Node quyết định giữa chừng) vào ÍT lượt
 * `maestro test` nhất có thể, thay vì mỗi tap/wait 1 lượt riêng.
 *
 * LÝ DO (đo thật 2026-08-07, thiết bị 3201d866d40a1681, xem
 * flows/bai_tap/testcases/homework-review-explanation.yaml): mỗi lượt `maestro test` tốn ~30-50s
 * CHỈ để khởi động session (trung bình 32.9s/lượt trên 8 lượt đo được) - HOÀN TOÀN không phụ
 * thuộc số bước bên trong 1 lượt. Bản gốc (`homeworkRandomScoringE2E.js`) spawn RIÊNG 1 lượt cho
 * mỗi: openHomeworkTab, openFilterSheet, selectFilterRange, applyFilter, mỗi lượt cuộn discovery,
 * assertHomeworkCardVisible, screenshot target, tap CTA mở bài, verifyIdentity, screenshot exam
 * screen, VÀ mỗi câu hỏi lại spawn tới 3 lượt (tap đáp án, tap CTA qua câu, tap confirm-nếu-có) -
 * tổng cộng dễ dàng vượt 20-25 lượt cho 1 Homework 5 câu (~15-20 phút CHỈ overhead khởi động).
 *
 * KIẾN TRÚC MỚI - số lượt `maestro test` cho 1 lần chạy (N = số câu resolve được, S = số lượt cuộn
 * discovery tự dừng sớm khi hết card mới, thường 2-4):
 *   1 lượt  - MENU: openHomeworkTabWithFilterOneShot() (gộp openHomeworkTab+filter, 4 lượt gốc -> 1)
 *   S lượt  - DISCOVER: (ĐÃ SUPERSEDE bởi mục "CẬP NHẬT" bên dưới - giữ đoạn này để biết lý do gốc
 *             vẫn cần S lượt hành động RIÊNG dù đã đổi qua MCP session) mỗi lượt cuộn cần đọc
 *             hierarchy NGAY SAU để biết còn card mới hay không trước khi quyết định cuộn tiếp -
 *             phụ thuộc dữ liệu thật của UI, không thể gộp trước mà không có rủi ro bỏ sót card bị
 *             RecyclerView tái sử dụng/scroll qua mất - KHÔNG đổi ĐIỀU KIỆN DỪNG này để giữ đúng độ
 *             tin cậy của Discovery, CHỈ đổi transport (xem "CẬP NHẬT").
 *   1 lượt  - OPEN+IDENTITY: openHomeworkAndVerifyIdentityOneShot() (gộp assertCard+screenshot+tap
 *             CTA+chờ+dismiss AI popup+verifyIdentity+screenshot, 5 lượt gốc -> 1)
 *   N lượt  - ANSWER: answerCurrentQuestionOneShot() mỗi câu (gộp tap đáp án+chờ+screenshot+tap
 *             CTA+chờ+tap confirm-nếu-có+chờ, 3 lượt gốc/câu -> 1) - KHÔNG gộp được XUYÊN QUA các
 *             câu vì mỗi câu cần Node đọc hierarchy THẬT (câu hỏi/lựa chọn hiện tại) rồi mới quyết
 *             định được tap gì (đúng behavior `decideAnswerAction()`, KHÔNG đổi) - đây là ranh giới
 *             thật của kiến trúc "1 testcase = 1 `maestro test`", không phải giới hạn tuỳ ý.
 *   0 lượt  - RESULT: screenshot màn Kết thúc đã được GỘP vào lượt ANSWER của câu CUỐI (truyền
 *             `resultLabel`), readResult() chỉ đọc `bridge.hierarchy()` (rẻ, KHÔNG phải
 *             `maestro test`) - không tốn thêm lượt nào.
 * Tổng: 2 + S + N lượt `maestro test` (so với >= 5 + S + 3N của bản gốc).
 *
 * KHÁC 1 ĐIỂM NHỎ đã cân nhắc/chấp nhận so với bản gốc (xem chi tiết ở
 * homeworkExamEngine.js#answerCurrentQuestionOneShot()): CTA/nút xác nhận dùng `tapOn: { optional:
 * true }` cho từng candidate theo thứ tự, KHÔNG dừng ở candidate đầu tiên thấy được như bản gốc -
 * không gây hại trong thực tế vì tại 1 thời điểm chỉ 1 candidate hiển thị. status "openIdentity"
 * gộp chung 2 phase gốc (open/identity) làm 1 - mất độ chi tiết trạng thái riêng từng phase khi
 * FAIL, đổi lại giảm đúng 4 lượt `maestro test`.
 *
 * CẬP NHẬT (2026-08-07, sau khi verify độc lập Discovery): phase DISCOVER giờ dùng
 * `collectVisibleHomeworkCardsViaMcpSession()` (xem discovery/homeworkUiList.js +
 * discovery/maestroMcpSession.js) - giữ 1 tiến trình `maestro mcp` sống CHỈ trong lúc Discovery
 * (mở trước khi cuộn, đóng NGAY sau khi Discovery xong - PASS hay FAIL đều đóng, xem `finally` ở
 * phase DISCOVER bên dưới) thay cho `MaestroBridge` (mỗi lượt cuộn/đọc hierarchy tự spawn 1 tiến
 * trình CLI riêng, ~40-52s khởi động MỖI LẦN - đã đo thật, xem comment đầu
 * `discovery/maestroMcpSession.js`). Đo thật: DISCOVER 8 lượt cuộn giảm từ ~680-790s xuống
 * ~112s (~6-7 lần nhanh hơn), 15 card đọc đúng, "Chuyển profile" (bug đã fix riêng ở
 * `homeworkUiList.js`) không còn lọt vào danh sách. CHỈ ĐÚNG phase DISCOVER đổi transport - MENU/
 * OPEN+IDENTITY/ANSWER vẫn dùng `MaestroBridge`/`runSteps()` như trước, KHÔNG đổi gì thêm.
 *
 * Chạy: node bai_tap/runtime/homeworkRandomScoringE2EOneSession.js
 *   (hoặc npm run run-homework-random-scoring-e2e-onesession)
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "..", "output");
const RESULT_FILE = join(OUTPUT_DIR, "homework_random_scoring_e2e_onesession_result.json");
const ACCOUNTS_ENV_PATH = join(__dirname, "..", "..", "..", "test_data", "accounts.env");
const MAX_QUESTIONS = 40;

function log(...args) {
  console.log(...args);
}

function nowNs() {
  return process.hrtime.bigint();
}

function secondsSince(startNs) {
  return Number(nowNs() - startNs) / 1e9;
}

/** Random đúng `correctCount` (0..N) vị trí "true" trong mảng N phần tử - Fisher-Yates đơn giản. */
function buildRandomCorrectPlan(n) {
  const correctCount = Math.floor(Math.random() * (n + 1));
  const indices = [...Array(n).keys()];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const correctSet = new Set(indices.slice(0, correctCount));
  return Array.from({ length: n }, (_, i) => correctSet.has(i));
}

async function main() {
  const overallStart = nowNs();
  const timings = {};

  let homework = null;
  let examResolution = null;
  let questionPlan = [];
  let answeredCount = 0;
  const achieved = [];
  const questionTypes = []; // Question Type thật (TEXT_CHOICE/IMAGE_CHOICE_GRID) theo thứ tự đã trả lời.
  let result = null;
  let discoverCardCount = null;
  let mcpToolCallCount = null;

  const menuResult = { status: "SKIPPED", message: null };
  const discoverResult = { status: "SKIPPED", message: null };
  const openIdentityResult = { status: "SKIPPED", message: null };
  const examResolveResult = { status: "SKIPPED", message: null };
  const answerResult = { status: "SKIPPED", message: null };
  const resultCheckResult = { status: "SKIPPED", message: null };

  const testClassId = process.env.TEST_CLASS_ID || parseEnvFile(ACCOUNTS_ENV_PATH).TEST_CLASS_ID;

  const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId });
  const nav = new HomeworkNavigationEngine(bridge);
  const exam = new HomeworkExamEngine(bridge);

  log('[MENU] Mở tab "Bài tập" + áp filter "1 tháng gần nhất" (1 lượt maestro test)...');
  let phaseStart = nowNs();
  try {
    await nav.openHomeworkTabWithFilterOneShot(po.filterSheet.optionOneMonth);
    menuResult.status = "PASS";
  } catch (err) {
    menuResult.status = "FAIL";
    menuResult.message = err.message;
    log(`[MENU] FAIL: ${err.message}`);
  }
  timings.menuSeconds = secondsSince(phaseStart);

  if (menuResult.status === "PASS") {
    log('\n[DISCOVER] Đọc danh sách Homework thực tế trên UI qua MCP session (1 tiến trình `maestro mcp` sống xuyên suốt Discovery)...');
    phaseStart = nowNs();
    let mcpSession = null;
    try {
      mcpSession = new MaestroMcpSession({ deviceId: config.deviceId });
      await mcpSession.start();
      const cards = await collectVisibleHomeworkCardsViaMcpSession(mcpSession, config.appId);
      discoverCardCount = cards.length;
      mcpToolCallCount = mcpSession.toolCallCount;
      log(
        `Đọc được ${cards.length} Homework thực tế trên UI (${mcpSession.toolCallCount} lượt MCP tools/call, ` +
          "1 tiến trình `maestro mcp` duy nhất).",
      );
      if (cards.length === 0) {
        throw new Error("Không tìm thấy Homework hợp lệ nào đang hiển thị trên UI.");
      }
      homework = pickRandom(cards);
      log(`Đã random 1/${cards.length}: title="${homework.title}" cta="${homework.cta}"`);
      discoverResult.status = "PASS";
    } catch (err) {
      discoverResult.status = "FAIL";
      discoverResult.message = err.message;
      log(`[DISCOVER] FAIL: ${err.message}`);
    } finally {
      // Đóng MCP session NGAY sau Discovery, bất kể PASS/FAIL - phase sau (OPEN+IDENTITY/ANSWER)
      // vẫn dùng `MaestroBridge` như cũ, KHÔNG cần giữ session MCP sống lâu hơn phạm vi Discovery.
      if (mcpSession) {
        await mcpSession.stop();
        log("Đã đóng MCP session (cleanup) sau Discovery.");
      }
    }
    timings.discoverSeconds = secondsSince(phaseStart);
  }

  if (discoverResult.status === "PASS") {
    log("\n[OPEN+IDENTITY] Cuộn tới card, chụp checkpoint, mở bài, xác nhận identity (1 lượt maestro test)...");
    phaseStart = nowNs();
    try {
      await nav.openHomeworkAndVerifyIdentityOneShot(homework, {
        targetScreenshot: "homework_random_scoring_e2e_onesession_target",
        examScreenshot: "homework_random_scoring_e2e_onesession_exam_screen",
      });
      openIdentityResult.status = "PASS";
      log(`Đã mở đúng bài + identity khớp: "${homework.title}"`);
    } catch (err) {
      openIdentityResult.status = "FAIL";
      openIdentityResult.message = err.message;
      log(`[OPEN+IDENTITY] FAIL: ${err.message}`);
    }
    timings.openIdentitySeconds = secondsSince(phaseStart);
  }

  if (openIdentityResult.status === "PASS") {
    log("\n[EXAM RESOLVE] Nối Homework -> Exam/Question/Correct Answer qua pipeline CMS hiện có (BẮT BUỘC, KHÔNG đổi)...");
    phaseStart = nowNs();
    try {
      const resolved = await resolveHomeworkExamQuestions(homework.title, { period: "MONTH", testClassId });
      examResolution = resolved;
      if (resolved.status === "RESOLVED") {
        homework.questions = resolved.questions;
        questionPlan = buildRandomCorrectPlan(resolved.questions.length);
        examResolveResult.status = "PASS";
        log(
          `RESOLVED: examId=${resolved.examId}, ${resolved.questions.length} câu - kế hoạch random: ` +
            `${questionPlan.filter(Boolean).length} câu nhắm ĐÚNG, ${questionPlan.filter((x) => !x).length} câu nhắm SAI.`,
        );
      } else {
        examResolveResult.status = "BLOCKED";
        examResolveResult.message = `[${resolved.status}] ${resolved.reason}`;
        log(`[EXAM RESOLVE] BLOCKED (${resolved.status}): ${resolved.reason}`);
      }
    } catch (err) {
      examResolution = { status: "ERROR", reason: err.message };
      examResolveResult.status = "BLOCKED";
      examResolveResult.message = `[ERROR] ${err.message}`;
      log(`[EXAM RESOLVE] BLOCKED (ERROR): ${err.message}`);
    }
    timings.examResolveSeconds = secondsSince(phaseStart);
  }

  if (examResolveResult.status === "PASS") {
    log('\n[ANSWER] Trả lời từng câu theo kế hoạch random đúng/sai (1 lượt maestro test/câu, gộp tap đáp án+CTA+confirm)...');
    phaseStart = nowNs();
    try {
      let reachedResult = false;
      for (let i = 0; i < MAX_QUESTIONS; i++) {
        if (exam.isResultScreen()) {
          reachedResult = true;
          break;
        }
        const questionModel = homework.questions[answeredCount];
        if (!questionModel) {
          throw new Error(
            `Đã trả lời ${answeredCount} câu nhưng Exam/CMS chỉ resolve được ${homework.questions.length} câu - ` +
              `không còn Correct Answer để dùng cho câu tiếp theo, KHÔNG đoán đáp án.`,
          );
        }
        const wantCorrect = questionPlan[answeredCount];
        const isLastQuestion = answeredCount === homework.questions.length - 1;
        const outcome = await exam.answerCurrentQuestionOneShot(questionModel, {
          wantCorrect,
          resultLabel: isLastQuestion ? "homework_random_scoring_e2e_onesession_result_screen" : null,
        });
        if (!outcome.supported) {
          throw new Error(
            `Handler không hỗ trợ Question Type ở câu ${answeredCount + 1}: ${outcome.reason} ` +
              `(text hiển thị: ${outcome.texts.join(" | ")})`,
          );
        }
        if (outcome.isTargetCorrect === null) {
          throw new Error(
            `Câu ${answeredCount + 1}: không xác định được đã chọn đúng/sai so với Correct Answer đã resolve ` +
              `("${questionModel.correctAnswer}") - dừng lại vì không thể tin cậy để verify điểm theo kế hoạch.`,
          );
        }
        answeredCount++;
        achieved.push(outcome.isTargetCorrect);
        questionTypes.push(outcome.type);
        log(
          `  Câu ${answeredCount}/${homework.questions.length}: đã chọn đáp án (${outcome.type}), đã chuyển tiếp` +
            (outcome.isTargetCorrect ? " (nhắm ĐÚNG)." : " (nhắm SAI)."),
        );
      }
      if (!reachedResult && !exam.isResultScreen()) {
        throw new Error(`Vượt quá ${MAX_QUESTIONS} câu mà chưa thấy màn Kết thúc - dừng để tránh loop vô hạn.`);
      }
      answerResult.status = "PASS";
    } catch (err) {
      answerResult.status = "FAIL";
      answerResult.message = err.message;
      log(`[ANSWER] FAIL: ${err.message}`);
    }
    timings.answerAndSubmitSeconds = secondsSince(phaseStart);
  }

  if (answerResult.status === "PASS") {
    log("\n[RESULT] Xác nhận màn hình Kết quả + đọc điểm thật + verify (chỉ đọc hierarchy, KHÔNG tốn thêm lượt maestro test)...");
    phaseStart = nowNs();
    try {
      if (!exam.isResultScreen()) {
        throw new Error("Không xuất hiện màn hình Kết quả sau khi trả lời hết câu.");
      }
      result = exam.readResult();
      log(`Điểm số: ${result.score ?? "(không đọc được)"}`);
      log(`Số câu đúng: ${result.correct ?? "(không đọc được)"}`);

      if (result.totalCount !== null && result.totalCount !== answeredCount) {
        throw new Error(
          `Điểm thực tế không phù hợp với câu trả lời đã thực hiện: màn Kết quả báo tổng ` +
            `${result.totalCount} câu nhưng testcase đã trả lời ${answeredCount} câu.`,
        );
      }

      const expectedCorrectCount = achieved.filter((v) => v === true).length;
      if (result.correctCount !== null && expectedCorrectCount !== result.correctCount) {
        throw new Error(
          `Điểm thực tế không phù hợp với kế hoạch random: dự kiến ${expectedCorrectCount}/${answeredCount} câu ` +
            `đúng (theo Correct Answer đã resolve từ Exam/CMS) nhưng màn Kết quả báo ${result.correctCount}/` +
            `${result.totalCount} câu đúng.`,
        );
      }

      const scoreNumber = result.score === null ? null : Number(result.score);
      if (scoreNumber === null || Number.isNaN(scoreNumber)) {
        throw new Error(`Không đọc được điểm số hợp lệ trên màn Kết quả (giá trị thật: ${JSON.stringify(result.score)}).`);
      }
      if (expectedCorrectCount > 0 && !(scoreNumber > 0)) {
        throw new Error(
          `Kế hoạch có ${expectedCorrectCount} câu nhắm đúng nhưng điểm số trả về không > 0 (giá trị thật: ${scoreNumber}).`,
        );
      }
      if (expectedCorrectCount === 0 && scoreNumber !== 0) {
        log(
          `CẢNH BÁO: kế hoạch random ra 0 câu đúng nhưng điểm số vẫn = ${scoreNumber} (khác 0) - ghi nhận, ` +
            `không coi là FAIL vì có thể app tính điểm theo thang khác 1 điểm/câu.`,
        );
      }

      log(
        `Verify điểm: PASS - ${expectedCorrectCount}/${answeredCount} câu đúng khớp kế hoạch random, điểm số thật = ${scoreNumber}.`,
      );
      resultCheckResult.status = "PASS";
    } catch (err) {
      resultCheckResult.status = "FAIL";
      resultCheckResult.message = err.message;
      log(`[RESULT] FAIL: ${err.message}`);
    }
    timings.resultSeconds = secondsSince(phaseStart);
  }

  timings.totalSeconds = secondsSince(overallStart);

  const allPhasesPass =
    menuResult.status === "PASS" &&
    discoverResult.status === "PASS" &&
    openIdentityResult.status === "PASS" &&
    examResolveResult.status === "PASS" &&
    answerResult.status === "PASS" &&
    resultCheckResult.status === "PASS";

  let overall;
  if (allPhasesPass) {
    overall = "PASS";
  } else if (examResolveResult.status === "BLOCKED") {
    overall = "BLOCKED";
  } else {
    overall = "FAIL";
  }

  // Phase chính xác bị fail (theo đúng thứ tự chạy) - null nếu overall === "PASS".
  const phaseOrder = [
    ["menu", menuResult],
    ["discover", discoverResult],
    ["openIdentity", openIdentityResult],
    ["examResolve", examResolveResult],
    ["answer", answerResult],
    ["result", resultCheckResult],
  ];
  const failedPhaseEntry = phaseOrder.find(([, r]) => r.status === "FAIL" || r.status === "BLOCKED");
  const failedPhase = overall === "PASS" ? null : failedPhaseEntry?.[0] ?? "unknown";

  const expectedCorrectCountFinal = achieved.filter((v) => v === true).length;
  const reason =
    overall === "PASS"
      ? `Random đúng 1 Homework ("${homework.title}"), trả lời ${answeredCount} câu theo kế hoạch random ` +
        `(${expectedCorrectCountFinal} câu nhắm đúng/${answeredCount}), Nộp bài thành công, điểm số thật = ` +
        `${result?.score} khớp đúng kế hoạch.`
      : examResolveResult.message ||
        menuResult.message ||
        discoverResult.message ||
        openIdentityResult.message ||
        answerResult.message ||
        resultCheckResult.message ||
        "Không xác định.";

  const fmt = (s) => (s === undefined ? "-" : `${s.toFixed(1)}s`);
  log("\n[TIMING]");
  log(`Mở menu + filter (gộp 1 lượt): ${fmt(timings.menuSeconds)}`);
  log(`Discover (MCP session): ${fmt(timings.discoverSeconds)}`);
  log(`Mở bài + identity (gộp 1 lượt): ${fmt(timings.openIdentitySeconds)}`);
  log(`Resolve Exam/CMS: ${fmt(timings.examResolveSeconds)}`);
  log(`Làm bài + Nộp bài (gộp/câu): ${fmt(timings.answerAndSubmitSeconds)}`);
  log(`Đọc/verify Kết quả (không tốn maestro test): ${fmt(timings.resultSeconds)}`);
  log(`Tổng: ${fmt(timings.totalSeconds)}`);

  log("\n[SPAWN COUNTS]");
  log(`Discover - số lượt MCP tools/call: ${mcpToolCallCount ?? "-"} (trong 1 tiến trình \`maestro mcp\` duy nhất)`);
  log(`Các phase còn lại - số lượt \`maestro test\` đã spawn (bridge.testInvocationCount): ${bridge.testInvocationCount}`);

  log("\n[HOMEWORK/QUESTIONS]");
  log(`Homework random: ${homework?.title ?? "-"} (cta="${homework?.cta ?? "-"}")`);
  log(`Số card Discovery: ${discoverCardCount ?? "-"}`);
  log(`Số câu (Exam resolve): ${homework?.questions?.length ?? "-"}`);
  log(`Question Types thật đã gặp: ${questionTypes.length ? [...new Set(questionTypes)].join(", ") : "-"}`);
  log(`Số câu đã trả lời: ${answeredCount}`);
  log(`Submit: ${answerResult.status}`);
  log(`Result: ${resultCheckResult.status}`);
  log(`Điểm số thật: ${result?.score ?? "-"} (Đúng ${result?.correct ?? "-"})`);

  log("\n[RESULT]");
  log(overall);
  if (failedPhase) log(`Fail tại phase: ${failedPhase}`);
  log(`Reason: ${reason}`);

  const output = {
    homework: homework ? { title: homework.title, cta: homework.cta } : null,
    discovery: { cardCount: discoverCardCount, mcpToolCalls: mcpToolCallCount },
    questionTypes,
    examResolution: examResolution
      ? { status: examResolution.status, reason: examResolution.reason ?? null, examId: examResolution.examId ?? null }
      : null,
    answeredCount,
    achievedCorrectness: achieved,
    examResult: result,
    phases: {
      menu: menuResult,
      discover: discoverResult,
      openIdentity: openIdentityResult,
      examResolve: examResolveResult,
      answer: answerResult,
      result: resultCheckResult,
    },
    timings,
    maestroTestInvocations: bridge.testInvocationCount,
    overall,
    failedPhase,
    reason,
    timestamp: new Date().toISOString(),
  };
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(RESULT_FILE, JSON.stringify(output, null, 2), "utf8");
  log(`\n[FINISH] Đã ghi kết quả ra ${RESULT_FILE}`);

  if (overall !== "PASS") process.exitCode = 1;
}

main().catch((err) => {
  console.error(`\n[homeworkRandomScoringE2EOneSession] Lỗi ngoài dự kiến (crash thật): ${err.message}`);
  process.exitCode = 1;
});
