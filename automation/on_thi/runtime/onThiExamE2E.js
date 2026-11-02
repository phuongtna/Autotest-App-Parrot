#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../../src/config.js";
import { MaestroBridge } from "../../bridge/maestroBridge.js";
import { OnThiNavigationEngine } from "../navigation/onThiNavigationEngine.js";
import { onThiPageObjects as po } from "../navigation/onThiPageObjects.js";
import { OnThiExamEngine } from "../navigation/onThiExamEngine.js";
import { findDeThi, tapFoundDeCard } from "../discovery/findDeThi.js";

/**
 * Testcase E2E: "Ôn thi (Đề thầy cô giao HOẶC Kho đề Parrot) -> mở 1 đề cụ thể -> làm bài thật ->
 * Nộp bài -> màn Kết quả". Entrypoint dự kiến `npm run run-on-thi-exam-e2e` (CHƯA thêm script vào
 * package.json - xem ghi chú cuối file).
 *
 * VIẾT 2026-10-30, CHƯA CHẠY QUA `maestro test`/MaestroBridge THẬT LẦN NÀO (đúng yêu cầu "viết
 * trước code, chưa chạy vội") - mirror kiến trúc đã verify thật của
 * `automation/bai_tap/runtime/homeworkRandomE2E.js` (tự lái Maestro qua MaestroBridge, KHÔNG shell
 * ra `maestro test <file>.yaml` song song - xem cảnh báo thật đã ghi nhận trong
 * memory/feedback_no_parallel_maestro_during_active_bridge_session.md: 1 lượt `maestro` CLI độc
 * lập chạy song song CÓ THỂ làm crash phiên MaestroBridge đang chạy dở, nên toàn bộ điều hướng ở
 * đây dùng JS method của `OnThiNavigationEngine`/`OnThiExamEngine`, KHÔNG gọi lại các file
 * `flows/app/helpers/open-de.yaml`/`open-tab-on-thi.yaml` bằng cách nào khác).
 *
 * KHÁC `homeworkRandomE2E.js` (tự random 1 Homework bất kỳ qua `collectVisibleHomeworkCards()`):
 * module Ôn thi CHƯA có hàm liệt kê card tương đương (chỉ có `findDeThi()` - tìm ĐÚNG 1 đề theo tên
 * đã biết trước, xem docblock file đó) - script này nhận THAM SỐ `DE_NAME` tường minh, KHÔNG tự
 * random, giống đúng hợp đồng tham số đã có của `open-de.yaml` (không bịa thêm 1 lớp discovery mới
 * chưa có bằng chứng cần thiết).
 *
 * Tham số (env hoặc `process.argv`, theo đúng quy ước `parseEnvFile`/`process.env` đã dùng chung
 * trong `automation/`):
 *   - DE_NAME (bắt buộc): tên đề hiển thị trên card, vd "Đề 2810".
 *   - DE_DUE_DATE_DM (optional): "DD/MM" - dùng khi DE_NAME có thể trùng ≥2 card (xem findDeThi.js).
 *   - ON_THI_TAB (optional, mặc định "Đề thầy cô giao"): truyền "Kho đề Parrot" để mở từ tab kia -
 *     ĐÂY LÀ PHẦN "CẢ 2 TAB" theo đúng yêu cầu gốc, màn Doing/Kết quả phía sau dùng CHUNG 1 engine
 *     (`OnThiExamEngine`) bất kể mở từ tab nào.
 *   - WANT_CORRECT (optional, mặc định "true"): "false" để cố tình nhắm SAI (chỉ có ý nghĩa khi
 *     Ôn thi có exam-resolver riêng cung cấp `questionModel` - HIỆN CHƯA CÓ, xem giới hạn đã biết
 *     trong docblock `onThiExamEngine.js`, nên tham số này hiện chưa đổi hành vi thật).
 *
 * GIẢ ĐỊNH (giống `homeworkRandomE2E.js`): thiết bị Android thật đang kết nối, app đã mở, ĐÃ đăng
 * nhập sẵn, đang đứng ở 1 màn bất kỳ trong app (script tự điều hướng từ đầu qua tab "Ôn thi").
 *
 * GIỚI HẠN ĐÃ BIẾT (kế thừa từ `onThiExamEngine.js`, nhắc lại ở đây cho người chạy sau không bỏ
 * sót): KHÔNG kiểm soát đúng/sai (không có exam-resolver), KHÔNG xử lý được multi-select cần ≥2 lựa
 * chọn, 2 icon "Thoát"/"Đánh dấu xem lại" CHƯA dùng trong vòng lặp chính (không cần cho 1 lượt làm
 * hết + nộp bài thuần tuý) - script này KHÔNG test popup Thoát/đánh dấu, chỉ test được luồng
 * "mở đề -> làm hết -> nộp bài -> đọc điểm", xem thêm các flow Maestro riêng
 * (`flows/app/on_thi/*.yaml`) cho các test case popup/UI khác đã liệt kê trong
 * `TestCase_PAR-3172_OnThi_LamBai.xlsx`.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "..", "output");
const RESULT_FILE = join(OUTPUT_DIR, "on_thi_exam_e2e_result.json");
const MAX_QUESTIONS = 60;

function log(...args) {
  console.log(...args);
}

function nowNs() {
  return process.hrtime.bigint();
}

function secondsSince(startNs) {
  return Number(nowNs() - startNs) / 1e9;
}

async function main() {
  const overallStart = nowNs();
  const timings = {};

  const DE_NAME = process.env.DE_NAME;
  if (!DE_NAME) {
    throw new Error('onThiExamE2E: cần truyền DE_NAME (vd DE_NAME="Đề 2810" npm run run-on-thi-exam-e2e).');
  }
  const DE_DUE_DATE_DM = process.env.DE_DUE_DATE_DM || null;
  const ON_THI_TAB = process.env.ON_THI_TAB || po.list.subTabAssignedByTeacher;
  const wantCorrect = process.env.WANT_CORRECT !== "false";

  const menuResult = { status: "SKIPPED", message: null };
  const openResult = { status: "SKIPPED", message: null };
  const startResult = { status: "SKIPPED", message: null };
  const answerResult = { status: "SKIPPED", message: null };
  const resultResult = { status: "SKIPPED", message: null };

  let sectionTimerMode = null;
  let attempted = 0;
  let skipped = 0;
  let examResult = null;

  const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId });
  const nav = new OnThiNavigationEngine(bridge);
  const exam = new OnThiExamEngine(bridge);

  log(`[MENU] Mở tab "Ôn thi" > "${ON_THI_TAB}"...`);
  let phaseStart = nowNs();
  try {
    if (ON_THI_TAB === po.list.subTabParrotBank) {
      await nav.openKhoDeParrotTab();
    } else {
      await nav.openDeThayCoGiaoTab();
    }
    menuResult.status = "PASS";
  } catch (err) {
    menuResult.status = "FAIL";
    menuResult.message = err.message;
    log(`[MENU] FAIL: ${err.message}`);
  }
  timings.menuSeconds = secondsSince(phaseStart);

  if (menuResult.status === "PASS") {
    log(`\n[OPEN] Tìm đề "${DE_NAME}" rồi tap CTA...`);
    phaseStart = nowNs();
    try {
      const located = await findDeThi(bridge, { title: DE_NAME, dueDateDM: DE_DUE_DATE_DM });
      if (located.status !== "FOUND") {
        throw new Error(`Không định vị được đề "${DE_NAME}" (${located.status}${located.reason ? `/${located.reason}` : ""}).`);
      }
      const tapped = await tapFoundDeCard(bridge, located.card);
      if (!tapped.success) throw new Error(`Tap CTA thất bại: ${tapped.error}`);
      await bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1500 } }]);
      await exam.dismissAiPopupIfPresent();
      openResult.status = "PASS";
    } catch (err) {
      openResult.status = "FAIL";
      openResult.message = err.message;
      log(`[OPEN] FAIL: ${err.message}`);
    }
    timings.openSeconds = secondsSince(phaseStart);
  }

  if (openResult.status === "PASS") {
    log('\n[START] Xử lý màn "Thông tin đề" (nếu có) rồi bấm "Bắt đầu làm bài"...');
    phaseStart = nowNs();
    try {
      // Màn "Thông tin đề" KHÔNG PHẢI lúc nào cũng xuất hiện (xem ghi chú open-de.yaml) - chỉ đọc
      // Cấu trúc đề/bấm Bắt đầu khi thấy nút đó, best-effort giống chính file open-de.yaml.
      if (bridge.isVisible(po.examInfo.startButton)) {
        const info = await exam.readExamInfo();
        sectionTimerMode = info.mode;
        log(`Loại đề phát hiện: ${info.mode} (section: ${info.sectionNames.join(", ") || "(không đọc được)"}).`);
        await exam.startFromExamInfoScreen();
      } else {
        log('Không thấy màn "Thông tin đề" - coi như đã vào thẳng màn Doing (vd "Làm tiếp" 1 lượt đang dở).');
      }
      await exam.dismissAiPopupIfPresent();
      startResult.status = "PASS";
    } catch (err) {
      startResult.status = "FAIL";
      startResult.message = err.message;
      log(`[START] FAIL: ${err.message}`);
    }
    timings.startSeconds = secondsSince(phaseStart);
  }

  if (startResult.status === "PASS") {
    log("\n[ANSWER] Trả lời/bỏ qua từng câu tới khi Nộp bài...");
    phaseStart = nowNs();
    try {
      const attemptSummary = await exam.runFullAttempt({ maxQuestions: MAX_QUESTIONS, wantCorrect });
      attempted = attemptSummary.attempted;
      skipped = attemptSummary.skipped;
      examResult = attemptSummary.result;
      log(`Đã xử lý ${attempted} câu (${skipped} câu bỏ qua vì không có Handler hỗ trợ - vd Speaking).`);
      answerResult.status = "PASS";
    } catch (err) {
      answerResult.status = "FAIL";
      answerResult.message = err.message;
      log(`[ANSWER] FAIL: ${err.message}`);
    }
    timings.answerSeconds = secondsSince(phaseStart);
  }

  if (answerResult.status === "PASS") {
    log("\n[RESULT] Xác nhận + đọc điểm màn Kết quả...");
    phaseStart = nowNs();
    try {
      if (!exam.isExamResultScreen(await bridge.hierarchy())) {
        throw new Error("Không xuất hiện màn Kết quả sau khi trả lời hết câu.");
      }
      log(`Điểm của bạn: ${examResult?.score ?? "(không đọc được)"}`);
      log(`Số câu đúng: ${examResult?.correctCount ?? "?"}/${examResult?.totalCount ?? "?"}`);
      log(`Thời gian làm bài: ${examResult?.durationText ?? "(không đọc được)"}`);
      if (examResult?.totalCount !== null && examResult?.totalCount !== attempted) {
        log(
          `CẢNH BÁO: màn Kết quả báo tổng ${examResult?.totalCount} câu nhưng testcase đã xử lý ${attempted} câu - ` +
            "có thể do câu hỏi nhóm (câu cha-câu con) đếm khác cách script đang đếm (xem TC_20/TC_41 trong " +
            "TestCase_PAR-3172_OnThi_LamBai.xlsx - CHƯA phải lỗi script, cần đối chiếu thủ công).",
        );
      }
      resultResult.status = "PASS";
    } catch (err) {
      resultResult.status = "FAIL";
      resultResult.message = err.message;
      log(`[RESULT] FAIL: ${err.message}`);
    }
    timings.resultSeconds = secondsSince(phaseStart);
  }

  timings.totalSeconds = secondsSince(overallStart);

  const overallPass =
    menuResult.status === "PASS" && openResult.status === "PASS" && startResult.status === "PASS" &&
    answerResult.status === "PASS" && resultResult.status === "PASS";

  const reason = overallPass
    ? `Mở đề "${DE_NAME}" (tab "${ON_THI_TAB}"), xử lý ${attempted} câu (${skipped} bỏ qua), Nộp bài thành công, màn Kết quả hiển thị đúng.`
    : menuResult.message || openResult.message || startResult.message || answerResult.message || resultResult.message || "Không xác định.";

  log("\n[RESULT]");
  log(overallPass ? "PASS" : "FAIL");
  log(`Reason: ${reason}`);

  const output = {
    deName: DE_NAME,
    onThiTab: ON_THI_TAB,
    sectionTimerMode,
    attempted,
    skipped,
    examResult,
    phases: { menu: menuResult, open: openResult, start: startResult, answer: answerResult, result: resultResult },
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
  console.error(`\n[onThiExamE2E] Lỗi ngoài dự kiến (crash thật): ${err.message}`);
  process.exitCode = 1;
});

// Chạy thử (SAU KHI đã sẵn sàng chạy thật - KHÔNG chạy vội theo đúng yêu cầu gốc):
//   DE_NAME="Đề 2810" node automation/on_thi/runtime/onThiExamE2E.js
//   DE_NAME="Đề thi 14" ON_THI_TAB="Kho đề Parrot" node automation/on_thi/runtime/onThiExamE2E.js
// CHƯA thêm "run-on-thi-exam-e2e" vào package.json scripts (xem cách automation/package.json đã
// đăng ký "run-homework-random-e2e" cho homeworkRandomE2E.js) - để nguyên cho người chạy tự quyết
// định tên script khi thật sự bắt đầu chạy thử, tránh đăng ký 1 script chưa ai xác nhận chạy được.
