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
 * Testcase E2E ĐỘC LẬP: "Bài tập -> random 1 bài -> làm bài thật -> Submit -> màn hình Kết quả".
 * Entrypoint `npm run run-homework-random-e2e` (chạy trong thư mục `automation/`).
 *
 * KHÁC HẲN `runRandomOpenHomeworkFlow.js` (chỉ PASS khi mở đúng bài, KHÔNG làm bài) và
 * `homeworkIndex.js` (milestone cũ, dừng ở PendingExamLaunchError) - file này đi tới CÙNG màn Kết
 * quả thật.
 *
 * QUYẾT ĐỊNH KIẾN TRÚC (đã trao đổi trực tiếp, không tự suy đoán): "danh sách Homework thực sự
 * đang hiển thị trên UI" CHỈ có thể đọc được bằng Node (`bridge.hierarchy()`) - đã kiểm chứng thật
 * (2026-08-07) rằng `runScript` của Maestro (chạy trong 1 file `.yaml` độc lập) KHÔNG có cách nào
 * tự đọc hierarchy hoặc `import` các class hiện có (không có `require`). Vì vậy đây là 1 file Node
 * (`.js`), KHÔNG phải file Maestro YAML - kiến trúc GIỐNG HỆT `runtime/index.js`/`homeworkIndex.js`
 * đã có (tự lái Maestro thật qua `MaestroBridge`), không phải kiến trúc mới.
 *
 * NGUỒN Correct Answer: TÁI SỬ DỤNG pipeline Exam/CMS đã có (`discovery/examPageScraper.js` +
 * `model/questionModel.js`) qua `discovery/homeworkExamResolver.js` (nối title UI -> examId qua
 * `attempts[].examId` của teacher-portal API - xem file đó) - KHÔNG yêu cầu người chạy nhập đáp án
 * tay, KHÔNG hardcode Homework/Exam ID nào. Nếu Room chưa có ai làm (examId UNRESOLVED) hoặc
 * session Exam Scraper hết hạn, testcase VẪN chạy tiếp (trả lời hợp lệ, không kiểm soát đúng/sai)
 * nhưng BÁO RÕ "examResolution" trong kết quả - KHÔNG suy đoán/không coi là lỗi ẩn.
 *
 * QUY TẮC "Bài tập KHÁC Vui học" (xem homeworkExamEngine.js): KHÔNG đọc/chờ chỉ báo đúng/sai sau
 * mỗi câu - chỉ chọn 1 đáp án, bấm "Tiếp theo"/tương đương, xác nhận đã chuyển câu; điểm/kết quả
 * CHỈ được đọc/verify SAU KHI đã ở màn Kết thúc thật.
 *
 * GIẢ ĐỊNH (giống mọi runtime khác trong automation/): thiết bị Android thật đang kết nối, app đã
 * mở, ĐÃ đăng nhập sẵn.
 *
 * Chạy: node bai_tap/runtime/homeworkRandomE2E.js (hoặc npm run run-homework-random-e2e)
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "..", "output");
const RESULT_FILE = join(OUTPUT_DIR, "homework_random_e2e_result.json");
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
  let examResolution = { status: "SKIPPED", reason: null, questionCount: null };
  let answeredCount = 0;
  const achieved = []; // isTargetCorrect thật của từng câu đã trả lời (true/false/null)
  let result = null;

  const menuResult = { status: "SKIPPED", message: null };
  const discoverResult = { status: "SKIPPED", message: null };
  const openResult = { status: "SKIPPED", message: null };
  const identityResult = { status: "SKIPPED", message: null };
  const answerResult = { status: "SKIPPED", message: null };
  const submitResult = { status: "SKIPPED", message: null };

  const testClassId = process.env.TEST_CLASS_ID || parseEnvFile(ACCOUNTS_ENV_PATH).TEST_CLASS_ID;

  const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId });
  const nav = new HomeworkNavigationEngine(bridge);
  const exam = new HomeworkExamEngine(bridge);

  log('[MENU] Mở tab "Bài tập"...');
  let phaseStart = nowNs();
  try {
    await nav.openHomeworkTab();
    // "1 tháng gần nhất" - mở rộng tối đa phạm vi Homework thực tế đang hiển thị (convention đã có
    // trong homeworkNavigationEngine.js/homeworkPageObjects.js).
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

  let questionPlan = []; // wantCorrect[] theo index câu, chỉ có ý nghĩa khi examResolution PASS.
  if (discoverResult.status === "PASS") {
    log("\n[EXAM RESOLVE] Nối Homework -> Exam/Question/Correct Answer qua pipeline CMS hiện có...");
    phaseStart = nowNs();
    try {
      const resolved = await resolveHomeworkExamQuestions(homework.title, { period: "MONTH", testClassId });
      examResolution.status = resolved.status;
      examResolution.reason = resolved.reason ?? null;
      if (resolved.status === "RESOLVED") {
        examResolution.questionCount = resolved.questions.length;
        questionPlan = buildRandomCorrectPlan(resolved.questions.length);
        homework.questions = resolved.questions;
        log(
          `RESOLVED: examId=${resolved.examId}, ${resolved.questions.length} câu - kế hoạch random: ` +
            `${questionPlan.filter(Boolean).length} câu nhắm ĐÚNG, ${questionPlan.filter((x) => !x).length} câu nhắm SAI.`,
        );
      } else {
        log(`${resolved.status}: ${resolved.reason}`);
        log("Vẫn tiếp tục làm bài - chọn đáp án HỢP LỆ nhưng KHÔNG kiểm soát đúng/sai (không có dữ liệu để biết).");
      }
    } catch (err) {
      // Lỗi ngoài dự kiến khi resolve (vd lỗi mạng gọi teacher-portal) - KHÔNG chặn cả lượt chạy,
      // ghi nhận trung thực rồi vẫn tiếp tục ở chế độ không kiểm soát đúng/sai.
      examResolution.status = "ERROR";
      examResolution.reason = err.message;
      log(`[EXAM RESOLVE] ERROR (không chặn testcase): ${err.message}`);
    }
    timings.examResolveSeconds = secondsSince(phaseStart);
  }

  if (discoverResult.status === "PASS") {
    log("\n[OPEN] Cuộn tới đúng card đã random, chụp checkpoint, mở bài...");
    phaseStart = nowNs();
    try {
      await nav.assertHomeworkCardVisible(homework);
      await bridge.runSteps([{ takeScreenshot: "homework_random_e2e_target" }]);
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
    log("\n[IDENTITY] Xác nhận đã vào đúng bài...");
    phaseStart = nowNs();
    try {
      await exam.verifyIdentity(homework.title);
      await bridge.runSteps([{ takeScreenshot: "homework_random_e2e_exam_screen" }]);
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
    log("\n[ANSWER] Trả lời từng câu (chọn đáp án, KHÔNG đọc chỉ báo đúng/sai) tới khi Nộp bài...");
    phaseStart = nowNs();
    try {
      let reachedResult = false;
      for (let i = 0; i < MAX_QUESTIONS; i++) {
        if (exam.isResultScreen()) {
          reachedResult = true;
          break;
        }
        const questionModel = homework.questions?.[answeredCount] ?? null;
        const wantCorrect = questionPlan[answeredCount] ?? true;
        const outcome = await exam.answerCurrentQuestion(questionModel, { wantCorrect });
        if (!outcome.supported) {
          throw new Error(
            `Handler không hỗ trợ Question Type ở câu ${answeredCount + 1}: ${outcome.reason} ` +
              `(text hiển thị: ${outcome.texts.join(" | ")})`,
          );
        }
        answeredCount++;
        achieved.push(outcome.isTargetCorrect);
        log(
          `  Câu ${answeredCount}: đã chọn đáp án (${outcome.type}), đã chuyển tiếp` +
            (outcome.isTargetCorrect === null ? " (không kiểm soát đúng/sai)." : outcome.isTargetCorrect ? " (nhắm ĐÚNG)." : " (nhắm SAI)."),
        );
      }
      if (!reachedResult && !exam.isResultScreen()) {
        throw new Error(`Vượt quá ${MAX_QUESTIONS} câu mà chưa thấy màn Kết thúc - dừng để tránh loop vô hạn.`);
      }
      answerResult.status = "PASS";
      submitResult.status = "PASS"; // "Nộp bài" ở Bài tập = CTA của câu cuối cùng, không phải nút riêng.
    } catch (err) {
      answerResult.status = "FAIL";
      answerResult.message = err.message;
      log(`[ANSWER] FAIL: ${err.message}`);
    }
    timings.answerAndSubmitSeconds = secondsSince(phaseStart);
  }

  if (submitResult.status === "PASS") {
    log("\n[RESULT] Xác nhận màn hình Kết quả + đọc điểm thật...");
    phaseStart = nowNs();
    try {
      if (!exam.isResultScreen()) {
        throw new Error("Không xuất hiện màn hình Kết quả sau khi trả lời hết câu.");
      }
      await bridge.runSteps([{ takeScreenshot: "homework_random_e2e_result_screen" }]);
      result = exam.readResult();
      log(`Điểm số: ${result.score ?? "(không đọc được)"}`);
      log(`Số câu đúng: ${result.correct ?? "(không đọc được)"}`);

      // Verify #1 (luôn làm được, không cần biết đáp án đúng): tổng số câu trên màn Kết quả phải
      // khớp số câu ĐÃ trả lời thật trong vòng lặp [ANSWER].
      if (result.totalCount !== null && result.totalCount !== answeredCount) {
        throw new Error(
          `Điểm thực tế không phù hợp với câu trả lời đã thực hiện: màn Kết quả báo tổng ` +
            `${result.totalCount} câu nhưng testcase đã trả lời ${answeredCount} câu.`,
        );
      }

      // Verify #2 (CHỈ khi có nguồn tin cậy - examResolution "RESOLVED" VÀ mọi câu đều biết chắc
      // đã nhắm đúng/sai, không có câu nào rơi vào "không kiểm soát được"): so expected vs thật.
      const allControlled = achieved.length > 0 && achieved.every((v) => v !== null);
      if (examResolution.status === "RESOLVED" && allControlled && result.correctCount !== null) {
        const expectedCorrectCount = achieved.filter((v) => v === true).length;
        if (expectedCorrectCount !== result.correctCount) {
          throw new Error(
            `Điểm thực tế không phù hợp với câu trả lời đã thực hiện: dự kiến ${expectedCorrectCount}/` +
              `${achieved.length} câu đúng (theo Correct Answer đã resolve từ Exam/CMS) nhưng màn Kết quả ` +
              `báo ${result.correctCount}/${result.totalCount}.`,
          );
        }
        log(`Verify điểm: khớp đúng dự kiến (${expectedCorrectCount}/${achieved.length} câu đúng theo kế hoạch random).`);
      } else {
        log(
          "Verify điểm: BỎ QUA so sánh expected-vs-actual (examResolution=" +
            `${examResolution.status}${allControlled ? "" : ", có câu không kiểm soát được đúng/sai"}) - ` +
            "chỉ xác nhận màn Kết quả xuất hiện với điểm/trạng thái hợp lệ.",
        );
      }

      if (result.score === null && result.correct === null) {
        log('CẢNH BÁO: không đọc được nhãn "ĐIỂM SỐ"/"CHÍNH XÁC" - có thể app đổi chữ hiển thị, cần đối chiếu lại homeworkExamEngine.js.');
      }
      submitResult.status = "PASS";
    } catch (err) {
      submitResult.status = "FAIL";
      submitResult.message = err.message;
      log(`[RESULT] FAIL: ${err.message}`);
    }
    timings.resultSeconds = secondsSince(phaseStart);
  }

  timings.totalSeconds = secondsSince(overallStart);

  const overallPass =
    menuResult.status === "PASS" &&
    discoverResult.status === "PASS" &&
    openResult.status === "PASS" &&
    identityResult.status === "PASS" &&
    answerResult.status === "PASS" &&
    submitResult.status === "PASS";

  const reason = overallPass
    ? `Random đúng 1 Homework ("${homework.title}"), trả lời ${answeredCount} câu, Nộp bài thành công, màn Kết quả hiển thị đúng (${result?.correct ?? result?.score ?? "?"}).`
    : menuResult.message ||
      discoverResult.message ||
      openResult.message ||
      identityResult.message ||
      answerResult.message ||
      submitResult.message ||
      "Không xác định.";

  const fmt = (s) => (s === undefined ? "-" : `${s.toFixed(1)}s`);
  log("\n[TIMING]");
  log(`Mở menu Bài tập: ${fmt(timings.menuSeconds)}`);
  log(`Collect/random: ${fmt(timings.discoverSeconds)}`);
  log(`Resolve Exam/CMS: ${fmt(timings.examResolveSeconds)}`);
  log(`Mở bài (+ identity): ${fmt((timings.openSeconds ?? 0) + (timings.identitySeconds ?? 0))}`);
  log(`Làm bài + Nộp bài: ${fmt(timings.answerAndSubmitSeconds)}`);
  log(`Đọc/verify Kết quả: ${fmt(timings.resultSeconds)}`);
  log(`Tổng: ${fmt(timings.totalSeconds)}`);

  log("\n[RESULT]");
  log(overallPass ? "PASS" : "FAIL");
  log(`Reason: ${reason}`);

  const output = {
    homework: homework ? { title: homework.title, cta: homework.cta } : null,
    examResolution,
    answeredCount,
    achievedCorrectness: achieved,
    examResult: result,
    phases: {
      menu: menuResult,
      discover: discoverResult,
      open: openResult,
      identity: identityResult,
      answer: answerResult,
      submit: submitResult,
    },
    timings,
    overall: overallPass ? "PASS" : "FAIL",
    reason,
    timestamp: new Date().toISOString(),
  };
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(RESULT_FILE, JSON.stringify(output, null, 2), "utf8");
  log(`\n[FINISH] Đã ghi kết quả ra ${RESULT_FILE}`);

  if (!overallPass) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`\n[homeworkRandomE2E] Lỗi ngoài dự kiến (crash thật): ${err.message}`);
  process.exitCode = 1;
});
