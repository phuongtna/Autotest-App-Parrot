#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";
import { config } from "../src/config.js";
import { MaestroBridge } from "../bridge/maestroBridge.js";
import { HomeworkNavigationEngine } from "./navigation/homeworkNavigationEngine.js";
import { readVisibleHomeworkCards } from "./homeworkListReader.js";
import { pickRandom } from "../discovery/randomPicker.js";

/**
 * Smoke test ĐỘC LẬP, NHANH - "Random 1 Bài tập đang THẬT SỰ hiển thị trên UI -> mở đúng bài ->
 * verify identity". Entrypoint `npm run test-random-homework-open` (xem package.json).
 *
 * KHÔNG dùng CMS/teacher-portal API để quyết định target (2 bản trước đã thử - bỏ, xem git
 * history nếu cần đối chiếu): API trả Room theo TOÀN BỘ lớp giáo viên quản lý, ĐÃ XÁC NHẬN THẬT
 * (2026-08-07) không đảm bảo khớp với những gì tài khoản ĐANG đăng nhập trên thiết bị thực sự nhìn
 * thấy trong app (đã thử lọc theo classId + đồng bộ filter "period" app/API, vẫn gặp Homework hợp
 * lệ về data nhưng KHÔNG render trên UI - random trúng vẫn FAIL). Test này random THẲNG trên dữ
 * liệu UI thật nên loại bỏ hẳn lớp vấn đề đó - API không được dùng ở đây.
 *
 * KHÔNG dùng selector `above`/`below` kèm `index` của Maestro (`copyTextFrom`) để tự đọc danh sách
 * - ĐÃ XÁC NHẬN THẬT (2026-08-07) cả selector lồng nhau LẪN đơn tầng có `index` đều có thể đọc SAI
 * (3 lần liên tiếp index 0/1/2 cùng đọc ra 1 giá trị sai giống hệt nhau). Thay vào đó: dump
 * `maestro hierarchy` (JSON thật) rồi PARSE bằng code Node (`homeworkListReader.js`) - cách DUY
 * NHẤT đã kiểm chứng đáng tin trong phiên làm việc này.
 *
 * TỐI ƯU SỐ LẦN GỌI `maestro` CLI (mỗi lượt tốn vài giây khởi động + kết nối thiết bị):
 *   1. `openHomeworkTab()` (có sẵn, tự gộp mọi bước vào 1 lượt `bridge.runSteps()`)
 *   2. `hierarchy()` - ĐÚNG 1 lượt (không phải 1 lượt/lần cuộn) - đọc card đang hiển thị NGAY
 *      (không bắt buộc cuộn/scan hết danh sách - đủ để random là dừng). CHỈ cuộn thêm (đúng 1 lượt
 *      `runSteps()` gộp sẵn N bước swipe, rồi `hierarchy()` lại ĐÚNG 1 lần nữa) nếu viewport ban
 *      đầu không có card hợp lệ nào - không lặp lại nhiều vòng.
 *   3. Bấm CTA + dismiss popup - 1 lượt `runSteps()`.
 *   4. Verify identity - 1 lượt `runSteps()`.
 * Tổng cộng 4-5 lượt gọi `maestro` (không phải hàng chục) cho toàn bộ Discovery+Navigation+Verify.
 *
 * PHẠM VI (đề bài yêu cầu KHÔNG làm): không quét/kiểm tra toàn bộ danh sách, không trả lời câu
 * hỏi, không nộp bài, không chạy Handler, không phải full E2E, KHÔNG tự đổi sang Homework khác nếu
 * identity mismatch (FAIL với bằng chứng, không che lỗi). PASS ngay sau khi xác nhận đã mở ĐÚNG
 * bài (không dọn dẹp/thoát màn Doing sau đó).
 *
 * GIẢ ĐỊNH: thiết bị Android thật đang kết nối, app đã mở, ĐÃ đăng nhập sẵn.
 *
 * Chạy: node bai_tap/runRandomOpenHomeworkFlow.js (hoặc npm run test-random-homework-open)
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");

function log(...args) {
  console.log(...args);
}

function nowNs() {
  return process.hrtime.bigint();
}

function secondsSince(startNs) {
  return Number(nowNs() - startNs) / 1e9;
}

/**
 * Lấy danh sách card hợp lệ đang hiển thị - THỬ NGAY viewport hiện tại trước (0 lượt cuộn); nếu
 * rỗng, cuộn ĐÚNG 1 lượt (gộp sẵn nhiều bước swipe trong 1 `runSteps()`) rồi đọc lại ĐÚNG 1 lần
 * nữa - không lặp thêm, không scan hết danh sách.
 * @param {MaestroBridge} bridge
 */
async function collectSomeVisibleCards(bridge) {
  let cards = readVisibleHomeworkCards(bridge.hierarchy());
  if (cards.length > 0) return cards;

  log("Viewport ban đầu chưa có card hợp lệ - cuộn thêm 1 lượt (gộp 3 bước swipe/1 process)...");
  const scrollResult = await bridge.runSteps([
    { swipe: { start: "50%,70%", end: "50%,30%", duration: 300 } },
    { waitForAnimationToEnd: { timeout: 500 } },
    { swipe: { start: "50%,70%", end: "50%,30%", duration: 300 } },
    { waitForAnimationToEnd: { timeout: 500 } },
    { swipe: { start: "50%,70%", end: "50%,30%", duration: 300 } },
    { waitForAnimationToEnd: { timeout: 500 } },
  ]);
  if (!scrollResult.success) {
    throw new Error(`Cuộn danh sách thất bại: ${scrollResult.error}`);
  }
  cards = readVisibleHomeworkCards(bridge.hierarchy());
  return cards;
}

async function main() {
  const overallStart = nowNs();
  const timings = {};

  let homework = null;
  let collectResult = { status: "PASS", message: null };
  let navigationResult = { status: "SKIPPED", message: null };
  let verifyResult = { status: "SKIPPED", message: null };

  const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId });
  const nav = new HomeworkNavigationEngine(bridge);

  log("[COLLECT]");
  let phaseStart = nowNs();
  let cards = [];
  try {
    log('Mở tab "Bài tập"...');
    await nav.openHomeworkTab();
    const onListScreen = await bridge.wait("Bài tập về nhà", { timeout: 10000 });
    if (!onListScreen.success) {
      throw new Error(`Chưa thật sự ở màn List "Bài tập": ${onListScreen.error}`);
    }
    cards = await collectSomeVisibleCards(bridge);
    log(`Thu thập được ${cards.length} card hợp lệ (CTA "Làm bài"/"Tiếp tục"/"Làm lại").`);
    if (cards.length === 0) {
      throw new Error("Không tìm thấy card Bài tập hợp lệ nào trên màn hình (kể cả sau khi cuộn thêm 1 lượt).");
    }
  } catch (err) {
    collectResult = { status: "FAIL", message: err.message };
    log(`[COLLECT] FAIL: ${err.message}`);
  }
  timings.collectSeconds = secondsSince(phaseStart);

  phaseStart = nowNs();
  if (collectResult.status === "PASS") {
    homework = pickRandom(cards);
    log("\n[RANDOM]");
    log(`Selected: ${homework.title}`);
    log(`CTA: ${homework.cta}`);
    log(`Trong ${cards.length} card đã thu thập (không scan toàn bộ danh sách).`);

    mkdirSync(OUTPUT_DIR, { recursive: true });
    const targetFile = join(OUTPUT_DIR, "homework_target.json");
    writeFileSync(
      targetFile,
      JSON.stringify(
        { title: homework.title, cta: homework.cta, selector: `below:"${homework.title}"`, pickedAt: new Date().toISOString() },
        null,
        2,
      ),
      "utf8",
    );
    log(`Đã ghi identity ra ${targetFile}.`);
  }
  timings.randomSeconds = secondsSince(phaseStart);

  if (collectResult.status === "PASS") {
    log("\n[OPEN]");
    phaseStart = nowNs();
    try {
      log(`Bấm CTA "${homework.cta}" của "${homework.title}"...`);
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
        throw new Error(`Bấm CTA thất bại: ${tapResult.error}`);
      }
      navigationResult = { status: "PASS", message: null };
    } catch (err) {
      navigationResult = { status: "FAIL", message: err.message };
      log(`[OPEN] FAIL: ${err.message}`);
    }
    timings.openSeconds = secondsSince(phaseStart);
  }

  if (navigationResult.status === "PASS") {
    log("\n[IDENTITY VERIFICATION]");
    phaseStart = nowNs();
    try {
      // Identity: (1) tiêu đề hiện lại NGUYÊN VĂN ở màn Doing, (2)+(3) 2 dấu hiệu ổn định khác
      // xác nhận đã THẬT SỰ rời màn List - không chỉ "có 1 màn Doing nào đó mở ra". Nếu SAI ->
      // FAIL với bằng chứng (message lỗi thật của Maestro), KHÔNG tự chọn Homework khác để che.
      const verify = await bridge.runSteps([
        { extendedWaitUntil: { visible: { text: homework.title }, timeout: 10000 } },
        { assertNotVisible: { text: "Trò chuyện" } },
        { assertNotVisible: { text: "Bài tập về nhà" } },
      ]);
      if (!verify.success) {
        throw new Error(`Identity mismatch - không xác nhận được đúng màn Doing: ${verify.error}`);
      }
      verifyResult = { status: "PASS", message: null };
      log(`Exam screen detected: ${homework.title}`);
    } catch (err) {
      verifyResult = { status: "FAIL", message: err.message };
      log(`[IDENTITY VERIFICATION] FAIL: ${err.message}`);
    }
    timings.verifySeconds = secondsSince(phaseStart);
  }

  timings.totalSeconds = secondsSince(overallStart);

  const overallPass =
    collectResult.status === "PASS" && navigationResult.status === "PASS" && verifyResult.status === "PASS";
  const reason = overallPass
    ? `Random đúng 1 Homework đang hiển thị thật ("${homework.title}"), mở đúng bài, identity khớp.`
    : collectResult.message || navigationResult.message || verifyResult.message || "Không xác định.";

  const fmt = (s) => (s === undefined ? "-" : `${s.toFixed(1)}s`);
  log("\n[TIMING]");
  log(`Collect: ${fmt(timings.collectSeconds)}`);
  log(`Random: ${fmt(timings.randomSeconds)}`);
  log(`Open: ${fmt(timings.openSeconds)}`);
  log(`Identity verification: ${fmt(timings.verifySeconds)}`);
  log(`Total: ${fmt(timings.totalSeconds)}`);

  log("\n[RESULT]");
  log(overallPass ? "PASS" : "FAIL");
  log(`Reason: ${reason}`);

  const result = {
    homework,
    collect: collectResult,
    navigation: navigationResult,
    verify: verifyResult,
    timings,
    overall: overallPass ? "PASS" : "FAIL",
    reason,
    timestamp: new Date().toISOString(),
  };
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const resultFile = join(OUTPUT_DIR, "homework_random_open_result.json");
  writeFileSync(resultFile, JSON.stringify(result, null, 2), "utf8");
  log(`\n[FINISH] Đã ghi kết quả ra ${resultFile}`);

  if (!overallPass) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`\n[runRandomOpenHomeworkFlow] Lỗi ngoài dự kiến (crash thật): ${err.message}`);
  process.exitCode = 1;
});
