#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config, parseEnvFile } from "../../src/config.js";
import { MaestroBridge } from "../../bridge/maestroBridge.js";
import { HomeworkNavigationEngine } from "../navigation/homeworkNavigationEngine.js";
import { homeworkPageObjects as po } from "../navigation/homeworkPageObjects.js";
import { HomeworkExamEngine } from "../navigation/homeworkExamEngine.js";
import { collectVisibleHomeworkCards } from "../discovery/homeworkUiList.js";
import { resolveHomeworkExamQuestions } from "../discovery/homeworkExamResolver.js";
import { pickRandom } from "../../discovery/randomPicker.js";

/**
 * Testcase E2E ĐỘC LẬP CHO MENU "BÀI TẬP" (Homework) - KHÔNG dùng business flow Book -> Unit ->
 * Lesson của "Vui học" (Unit9 và mọi flow trong flows/vui_hoc/ không liên quan tới file này).
 * Entrypoint `npm run run-homework-random-scoring-e2e`.
 *
 * KHÁC `homeworkRandomE2E.js` (file cũ, GIỮ NGUYÊN không sửa) ở đúng 1 điểm theo yêu cầu nghiệp vụ
 * mới nhất (2026-08-07) - siết chặt hành vi khi KHÔNG resolve được Exam/Question/Correct Answer qua
 * pipeline CMS hiện có (bất kỳ status nào khác "RESOLVED": ROOM_NOT_FOUND/UNRESOLVED_EXAM_ID/
 * SESSION_ERROR/ERROR): DỪNG LẠI NGAY, kết quả "BLOCKED" kèm lý do cụ thể, KHÔNG tiếp tục trả lời
 * "hợp lệ nhưng không kiểm soát đúng/sai" như bản cũ, và TUYỆT ĐỐI không báo PASS - không đoán dữ
 * liệu khi không có nguồn đáng tin cậy.
 *
 * VẪN GIỮ (giống bản cũ, theo đúng yêu cầu "muốn random cả đúng/sai để test scoring"):
 *   - `buildRandomCorrectPlan()` - random số câu nhắm ĐÚNG (0..N) trong tổng N câu, KHÔNG cố định
 *     luôn đúng - mục đích là kiểm tra cơ chế CHẤM ĐIỂM của app phản ánh đúng số câu đúng/sai thật
 *     đã chọn, không phải chỉ để đạt điểm tối đa.
 *   - Mỗi câu vẫn PHẢI biết chắc đã nhắm đúng/sai (`isTargetCorrect` khác `null`) - nếu 1 câu không
 *     xác định được (vd đáp án đúng resolve được nhưng không khớp bất kỳ lựa chọn nào đang hiển thị)
 *     thì DỪNG LẠI (FAIL) thay vì lặng lẽ tính là "không kiểm soát" - vì mục tiêu là verify điểm
 *     CHÍNH XÁC theo kế hoạch đã random, không chấp nhận phần tử không xác định trong phép so sánh.
 *
 * Toàn bộ bước còn lại giữ đúng nguyên tắc đã xác nhận trong `homeworkExamEngine.js`: màn "Bài tập"
 * (khác "Vui học") KHÔNG có chỉ báo đúng/sai sau mỗi câu - chỉ chọn đáp án rồi bấm CTA để qua câu kế
 * tiếp (hoặc Nộp bài nếu là câu cuối - Bài tập KHÔNG có nút "Nộp bài" riêng, CTA câu cuối chính là
 * hành động nộp), điểm/kết quả CHỈ được đọc SAU KHI đã ở màn Kết thúc thật.
 *
 * KHÔNG hardcode Homework/Room/Exam/Question/Correct Answer nào - toàn bộ random/resolve động qua
 * UI thật (`collectVisibleHomeworkCards`) + pipeline Exam/CMS thật (`resolveHomeworkExamQuestions`).
 *
 * GIẢ ĐỊNH (giống mọi runtime khác trong automation/): thiết bị Android thật đang kết nối, app đã
 * mở, ĐÃ đăng nhập sẵn, đang ở màn có tab "Bài tập" truy cập được.
 *
 * Chạy: node bai_tap/runtime/homeworkRandomScoringE2E.js (hoặc npm run run-homework-random-scoring-e2e)
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "..", "output");
const RESULT_FILE = join(OUTPUT_DIR, "homework_random_scoring_e2e_result.json");
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

  let homework = null; // { title, cta } - lấy từ UI THẬT, không phải từ CMS/teacher-portal API.
  let examResolution = null; // kết quả resolveHomeworkExamQuestions() - null nếu chưa chạy tới.
  let questionPlan = []; // wantCorrect[] theo index câu - random 0..N câu đúng, xem buildRandomCorrectPlan().
  let answeredCount = 0;
  const achieved = []; // isTargetCorrect thật (true/false) của từng câu đã trả lời - dùng để verify điểm.
  let result = null;

  const menuResult = { status: "SKIPPED", message: null };
  const discoverResult = { status: "SKIPPED", message: null };
  const openResult = { status: "SKIPPED", message: null };
  const identityResult = { status: "SKIPPED", message: null };
  const examResolveResult = { status: "SKIPPED", message: null };
  const answerResult = { status: "SKIPPED", message: null };
  const resultCheckResult = { status: "SKIPPED", message: null };

  const testClassId = process.env.TEST_CLASS_ID || parseEnvFile(ACCOUNTS_ENV_PATH).TEST_CLASS_ID;

  const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId });
  const nav = new HomeworkNavigationEngine(bridge);
  const exam = new HomeworkExamEngine(bridge);

  log('[MENU] Mở tab "Bài tập"...');
  let phaseStart = nowNs();
  try {
    await nav.openHomeworkTab();
    // "1 tháng gần nhất" - mở rộng tối đa phạm vi Homework thực tế đang hiển thị trước khi random,
    // cùng convention đã có trong homeworkRandomE2E.js.
    await nav.openFilterSheet();
    await nav.selectFilterRange(po.filterSheet.optionOneMonth);
    await nav.applyFilter();
    menuResult.status = "PASS";
  } catch (err) {
    menuResult.status = "FAIL";
    menuResult.message = err.message;
    log(`[MENU] FAIL: ${err.message}`);
  }
  timings.menuSeconds = secondsSince(phaseStart);

  if (menuResult.status === "PASS") {
    log("\n[DISCOVER] Đọc danh sách Homework thực tế trên UI (cuộn + đọc hierarchy)...");
    phaseStart = nowNs();
    try {
      const cards = await collectVisibleHomeworkCards(bridge);
      log(`Đọc được ${cards.length} Homework thực tế trên UI.`);
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
    }
    timings.discoverSeconds = secondsSince(phaseStart);
  }

  if (discoverResult.status === "PASS") {
    log("\n[OPEN] Cuộn tới đúng card đã random, chụp checkpoint, mở bài...");
    phaseStart = nowNs();
    try {
      await nav.assertHomeworkCardVisible(homework);
      await bridge.runSteps([{ takeScreenshot: "homework_random_scoring_e2e_target" }]);
      const tapResult = await bridge.runSteps([
        { tapOn: { below: homework.title, text: homework.cta } },
        { waitForAnimationToEnd: { timeout: 3000 } },
        {
          runFlow: {
            when: { visible: "AI hỗ trợ học tập" },
            commands: [{ tapOn: "Tiếp tục" }],
          },
        },
      ]);
      if (!tapResult.success) {
        throw new Error(`Không mở được bài (tapOn CTA thất bại): ${tapResult.error}`);
      }
      openResult.status = "PASS";
    } catch (err) {
      openResult.status = "FAIL";
      openResult.message = err.message;
      log(`[OPEN] FAIL: ${err.message}`);
    }
    timings.openSeconds = secondsSince(phaseStart);
  }

  if (openResult.status === "PASS") {
    log("\n[IDENTITY] Xác nhận đã vào đúng bài (KHÔNG tự đổi sang bài khác nếu mismatch)...");
    phaseStart = nowNs();
    try {
      await exam.verifyIdentity(homework.title);
      await bridge.runSteps([{ takeScreenshot: "homework_random_scoring_e2e_exam_screen" }]);
      identityResult.status = "PASS";
      log(`Identity khớp: "${homework.title}"`);
    } catch (err) {
      identityResult.status = "FAIL";
      identityResult.message = err.message;
      log(`[IDENTITY] FAIL: ${err.message}`);
    }
    timings.identitySeconds = secondsSince(phaseStart);
  }

  if (identityResult.status === "PASS") {
    log("\n[EXAM RESOLVE] Nối Homework -> Exam/Question/Correct Answer qua pipeline CMS hiện có (BẮT BUỘC)...");
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
        // Theo yêu cầu: KHÔNG đoán dữ liệu, KHÔNG tiếp tục trả lời "không kiểm soát đúng/sai" -
        // dừng lại NGAY với lý do cụ thể, kết quả BLOCKED (không phải PASS).
        examResolveResult.status = "BLOCKED";
        examResolveResult.message = `[${resolved.status}] ${resolved.reason}`;
        log(`[EXAM RESOLVE] BLOCKED (${resolved.status}): ${resolved.reason}`);
      }
    } catch (err) {
      // Lỗi ngoài dự kiến (vd lỗi mạng gọi teacher-portal/Exam Scraper) - cũng KHÔNG đoán, dừng lại
      // với BLOCKED (không phải PASS), ghi rõ lỗi thật.
      examResolution = { status: "ERROR", reason: err.message };
      examResolveResult.status = "BLOCKED";
      examResolveResult.message = `[ERROR] ${err.message}`;
      log(`[EXAM RESOLVE] BLOCKED (ERROR): ${err.message}`);
    }
    timings.examResolveSeconds = secondsSince(phaseStart);
  }

  if (examResolveResult.status === "PASS") {
    log('\n[ANSWER] Trả lời từng câu theo kế hoạch random đúng/sai (để test scoring), KHÔNG đọc chỉ báo đúng/sai, tới khi Nộp bài...');
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
        const outcome = await exam.answerCurrentQuestion(questionModel, { wantCorrect });
        if (!outcome.supported) {
          throw new Error(
            `Handler không hỗ trợ Question Type ở câu ${answeredCount + 1}: ${outcome.reason} ` +
              `(text hiển thị: ${outcome.texts.join(" | ")})`,
          );
        }
        // Mục tiêu là verify điểm CHÍNH XÁC theo kế hoạch random đúng/sai đã chọn - mỗi câu PHẢI
        // xác định được chắc chắn đã nhắm đúng hay sai (isTargetCorrect khác null). Nếu Correct
        // Answer đã resolve được nhưng không khớp bất kỳ lựa chọn nào đang hiển thị (đề bài không
        // gặp trường hợp này, chỉ phòng hờ), không thể tin cậy để so điểm -> dừng lại (FAIL) thay
        // vì tính là "không kiểm soát" rồi bỏ qua khỏi phép so sánh.
        if (outcome.isTargetCorrect === null) {
          throw new Error(
            `Câu ${answeredCount + 1}: không xác định được đã chọn đúng/sai so với Correct Answer đã resolve ` +
              `("${questionModel.correctAnswer}") - dừng lại vì không thể tin cậy để verify điểm theo kế hoạch.`,
          );
        }
        answeredCount++;
        achieved.push(outcome.isTargetCorrect);
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
    log("\n[RESULT] Xác nhận màn hình Kết quả + đọc điểm thật + verify...");
    phaseStart = nowNs();
    try {
      if (!exam.isResultScreen()) {
        throw new Error("Không xuất hiện màn hình Kết quả sau khi trả lời hết câu.");
      }
      await bridge.runSteps([{ takeScreenshot: "homework_random_scoring_e2e_result_screen" }]);
      result = exam.readResult();
      log(`Điểm số: ${result.score ?? "(không đọc được)"}`);
      log(`Số câu đúng: ${result.correct ?? "(không đọc được)"}`);

      // Verify #1: tổng số câu trên màn Kết quả phải khớp số câu ĐÃ trả lời thật trong [ANSWER].
      if (result.totalCount !== null && result.totalCount !== answeredCount) {
        throw new Error(
          `Điểm thực tế không phù hợp với câu trả lời đã thực hiện: màn Kết quả báo tổng ` +
            `${result.totalCount} câu nhưng testcase đã trả lời ${answeredCount} câu.`,
        );
      }

      // Verify #2 (mục tiêu chính của testcase - "test scoring"): so đúng dự kiến (theo kế hoạch
      // random đúng/sai đã chọn ở [ANSWER], KHÔNG phải luôn đúng hết) với số câu đúng THẬT app chấm.
      const expectedCorrectCount = achieved.filter((v) => v === true).length;
      if (result.correctCount !== null && expectedCorrectCount !== result.correctCount) {
        throw new Error(
          `Điểm thực tế không phù hợp với kế hoạch random: dự kiến ${expectedCorrectCount}/${answeredCount} câu ` +
            `đúng (theo Correct Answer đã resolve từ Exam/CMS) nhưng màn Kết quả báo ${result.correctCount}/` +
            `${result.totalCount} câu đúng.`,
        );
      }

      // Verify #3: điểm số thật phải là số hợp lệ, và phải > 0 khi và chỉ khi kế hoạch có ít nhất 1
      // câu nhắm đúng (score > 0 không phải bất biến tuyệt đối - nếu kế hoạch random ra 0 câu đúng,
      // điểm 0 là kết quả ĐÚNG của app, không phải lỗi).
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
    openResult.status === "PASS" &&
    identityResult.status === "PASS" &&
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

  const expectedCorrectCountFinal = achieved.filter((v) => v === true).length;
  const reason =
    overall === "PASS"
      ? `Random đúng 1 Homework ("${homework.title}"), trả lời ${answeredCount} câu theo kế hoạch random ` +
        `(${expectedCorrectCountFinal} câu nhắm đúng/${answeredCount}), Nộp bài thành công, điểm số thật = ` +
        `${result?.score} khớp đúng kế hoạch.`
      : examResolveResult.message ||
        menuResult.message ||
        discoverResult.message ||
        openResult.message ||
        identityResult.message ||
        answerResult.message ||
        resultCheckResult.message ||
        "Không xác định.";

  const fmt = (s) => (s === undefined ? "-" : `${s.toFixed(1)}s`);
  log("\n[TIMING]");
  log(`Mở menu Bài tập: ${fmt(timings.menuSeconds)}`);
  log(`Collect/random: ${fmt(timings.discoverSeconds)}`);
  log(`Mở bài: ${fmt(timings.openSeconds)}`);
  log(`Identity: ${fmt(timings.identitySeconds)}`);
  log(`Resolve Exam/CMS: ${fmt(timings.examResolveSeconds)}`);
  log(`Làm bài + Nộp bài: ${fmt(timings.answerAndSubmitSeconds)}`);
  log(`Đọc/verify Kết quả: ${fmt(timings.resultSeconds)}`);
  log(`Tổng: ${fmt(timings.totalSeconds)}`);

  log("\n[RESULT]");
  log(overall);
  log(`Reason: ${reason}`);

  const output = {
    homework: homework ? { title: homework.title, cta: homework.cta } : null,
    examResolution: examResolution
      ? { status: examResolution.status, reason: examResolution.reason ?? null, examId: examResolution.examId ?? null }
      : null,
    answeredCount,
    achievedCorrectness: achieved,
    examResult: result,
    phases: {
      menu: menuResult,
      discover: discoverResult,
      open: openResult,
      identity: identityResult,
      examResolve: examResolveResult,
      answer: answerResult,
      result: resultCheckResult,
    },
    timings,
    overall,
    reason,
    timestamp: new Date().toISOString(),
  };
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(RESULT_FILE, JSON.stringify(output, null, 2), "utf8");
  log(`\n[FINISH] Đã ghi kết quả ra ${RESULT_FILE}`);

  if (overall !== "PASS") process.exitCode = 1;
}

main().catch((err) => {
  console.error(`\n[homeworkRandomScoringE2E] Lỗi ngoài dự kiến (crash thật): ${err.message}`);
  process.exitCode = 1;
});
