#!/usr/bin/env node
import { config } from "../../src/config.js";
import { getHomeworks, filterOutRolePlay } from "../discovery/homeworks.js";
import { pickRandom } from "../../discovery/randomPicker.js";
import { MaestroBridge } from "../../bridge/maestroBridge.js";
import { HomeworkNavigationEngine } from "../navigation/homeworkNavigationEngine.js";
import { PendingExamLaunchError } from "./pendingExamLaunch.js";
import { writeHomeworkRunResult } from "./homeworkResultWriter.js";

/**
 * Runtime cho "Bài tập" (Homework) - entrypoint `npm run run-homework-e2e`. ĐỘC LẬP với
 * runtime/index.js (Vui học).
 *
 * MILESTONE (2026-08-06): test end-to-end với ĐÚNG 1 Homework random, 3 giai đoạn tách biệt, mỗi
 * giai đoạn CHỈ chạy nếu giai đoạn trước PASS (không chạy tiếp trên nền lỗi):
 *   1. Discovery - getHomeworks() (teacher-portal thật) -> pickRandom() (KHÔNG hardcode Book/
 *      Unit/Room nào - random thuần trên danh sách API trả về).
 *   2. Navigation - openHomeworkTab() -> assertHomeworkCardVisible() (tìm + assert đúng card của
 *      Homework đã random - "điều hướng tới màn Homework" = cuộn tới đúng vị trí card đó trên
 *      danh sách, KHÔNG tap vào CTA - xem lý do ở bước 3).
 *   3. Runtime (launch) - GỌI THẬT `nav.startHomework(homework)` (không phải giả lập/không tự
 *      quyết định bỏ qua) - hàm này hiện LUÔN throw PendingExamLaunchError (xem
 *      navigation/homeworkNavigationEngine.js + runtime/pendingExamLaunch.js: chưa có endpoint
 *      mở bài nào được xác nhận, KHÔNG suy đoán examId, KHÔNG tự tạo endpoint giả). Bắt đúng
 *      PendingExamLaunchError -> dừng lại, ghi "Blocked by unresolved exam launch endpoint.",
 *      KHÔNG coi là crash (không set exitCode lỗi, không throw tiếp). Lỗi nào KHÁC
 *      PendingExamLaunchError vẫn được ghi nhận trung thực là "ERROR" (không tự quy về PASS/
 *      BLOCKED để giấu lỗi thật).
 *
 * GIẢ ĐỊNH (giống runtime/index.js): app đã mở, đã đăng nhập.
 *
 * Chạy: node bai_tap/runtime/homeworkIndex.js (hoặc npm run run-homework-e2e) - cần thiết bị/
 * emulator đang kết nối và app đã mở sẵn.
 */

function log(...args) {
  console.log(...args);
}

/** Bỏ metadata.raw (dữ liệu CMS thô, chỉ dùng để debug nội bộ) khỏi kết quả ghi ra file. */
function summarizeHomework(homework) {
  const { metadata, ...rest } = homework;
  return rest;
}

async function main() {
  let homework = null;
  let discoveryResult = { status: "PASS", message: null };
  let navigationResult = { status: "SKIPPED", message: null };
  let launchResult = { status: "SKIPPED", reason: null };

  log("[DISCOVERY]");
  try {
    const allHomeworks = await getHomeworks({ period: "WEEK" });
    // TẠM THỜI bỏ qua type="role_play" (theo yêu cầu 2026-08-06) - xem lý do trong
    // discovery/homeworks.js#filterOutRolePlay(). Không phải quyết định cuối cùng.
    const homeworks = filterOutRolePlay(allHomeworks);
    log(
      `Lấy được ${allHomeworks.length} Homework, bỏ ${allHomeworks.length - homeworks.length} ` +
        `role_play -> còn ${homeworks.length} để random.`,
    );
    if (homeworks.length === 0) {
      throw new Error(
        "Danh sách Homework rỗng sau khi lọc role_play (getHomeworks() trả về [] hoặc toàn role_play)",
      );
    }
    homework = pickRandom(homeworks);
    log(`Đã random 1/${homeworks.length} Homework: "${homework.title}"`);
    log(`  id=${homework.id} type=${homework.type}`);
    log(`  Book: ${homework.book.name} (id=${homework.book.id})`);
    log(`  Unit: ${homework.unit.name} (id=${homework.unit.id})`);
    log(`  Lesson: ${homework.lesson.name} (id=${homework.lesson.id})`);
    log(`  LessonItem: ${homework.lessonItem.name} (id=${homework.lessonItem.id})`);
  } catch (err) {
    discoveryResult = { status: "FAIL", message: err.message };
    log(`[DISCOVERY] FAIL: ${err.message}`);
  }

  if (discoveryResult.status === "PASS") {
    log("\n[NAVIGATION]");
    const bridge = new MaestroBridge({ appId: config.appId, deviceId: config.deviceId });
    const nav = new HomeworkNavigationEngine(bridge);
    try {
      log('Mở tab "Bài tập"...');
      await nav.openHomeworkTab();
      log(`Tìm và assert card "${homework.title}"...`);
      await nav.assertHomeworkCardVisible(homework);
      log("Card hiển thị đúng trên màn Bài tập - đã điều hướng tới đúng vị trí Homework.");
      navigationResult = { status: "PASS", message: null };
    } catch (err) {
      navigationResult = { status: "FAIL", message: err.message };
      log(`[NAVIGATION] FAIL: ${err.message}`);
    }

    if (navigationResult.status === "PASS") {
      log("\n[RUNTIME] Thử mở bài...");
      try {
        // Gọi THẬT - startHomework() hiện luôn throw PendingExamLaunchError (chưa có endpoint mở
        // bài nào được xác nhận). Nếu 1 phiên bản tương lai đã implement thật (có endpoint xác
        // nhận) và hàm không throw nữa, nhánh này sẽ tự trở thành "PASS" - không cần sửa lại nơi
        // gọi.
        await nav.startHomework(homework);
        launchResult = { status: "PASS", reason: null };
        log("Mở bài thành công.");
      } catch (err) {
        if (err instanceof PendingExamLaunchError) {
          const reason = "Blocked by unresolved exam launch endpoint.";
          launchResult = { status: "BLOCKED", reason };
          log(`[RUNTIME] BLOCKED: ${reason}`);
        } else {
          // KHÔNG quy lỗi lạ này về BLOCKED/PASS - ghi nhận trung thực để không giấu lỗi thật.
          launchResult = { status: "ERROR", reason: err.message };
          log(`[RUNTIME] ERROR (không phải PendingExamLaunchError): ${err.message}`);
        }
      }
    }
  }

  const result = {
    homework: homework ? summarizeHomework(homework) : null,
    discovery: discoveryResult,
    navigation: navigationResult,
    launch: launchResult,
    timestamp: new Date().toISOString(),
  };

  const resultFile = writeHomeworkRunResult(result);
  log(`\n[FINISH] Đã ghi kết quả ra ${resultFile}`);
  log(
    `Discovery=${discoveryResult.status} Navigation=${navigationResult.status} Launch=${launchResult.status}`,
  );
}

main().catch((err) => {
  console.error(`\n[run-homework-e2e] Lỗi ngoài dự kiến (crash thật): ${err.message}`);
  process.exitCode = 1;
});
