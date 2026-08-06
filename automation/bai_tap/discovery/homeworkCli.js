#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getHomeworks, TeacherPortalApiError } from "./homeworks.js";

/**
 * Entrypoint `npm run discover-homework` - CHỈ gọi CMS/teacher-portal API (xem
 * discovery/homeworks.js), KHÔNG đụng tới thiết bị/Maestro/Exam - an toàn để chạy độc lập, không
 * phụ thuộc "exam launch" (xem runtime/pendingExamLaunch.js cho phần còn lại bị chặn).
 *
 * Chạy: cd automation && npm run discover-homework
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "..", "output");
const OUTPUT_FILE = join(OUTPUT_DIR, "homework_discovery.json");

const VERBOSE =
  process.argv.includes("--verbose") || process.env.npm_config_loglevel === "verbose";

function log(...args) {
  console.log(...args);
}

async function main() {
  log("Đang lấy danh sách Bài tập (GET /api/user/exams/room.json)...");
  const homeworks = await getHomeworks({ period: "WEEK" });

  log("---------------------------------------------");
  log(`Tổng số Bài tập: ${homeworks.length}`);
  for (const hw of homeworks) {
    log(`\n- [${hw.type}] ${hw.title} (id=${hw.id})`);
    log(`  Book/Unit/Lesson: ${hw.book.name} / ${hw.unit.name} / ${hw.lesson.name}`);
    log(`  Deadline: ${hw.deadline.startTime ?? "(trống)"} -> ${hw.deadline.endTime ?? "(trống)"}`);
    log(`  classIds: ${hw.classIds.join(", ") || "(không có)"}`);
    if (hw.attempts === null) {
      log(`  Attempts: (chưa có ai làm)`);
    } else {
      log(`  Attempts: ${hw.attempts.length} lượt`);
      if (VERBOSE) {
        for (const a of hw.attempts) {
          log(`    - userId=${a.userId} status=${a.status} point=${a.point}/${a.totalPoint}`);
        }
      }
    }
  }
  log("---------------------------------------------");

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(homeworks, null, 2), "utf8");
  log(`\nĐã ghi kết quả ra ${OUTPUT_FILE}`);
  log(
    `\nLưu ý: chưa ghi "examId"/"level" cho từng Homework ở đây - "examId" hiện là UNRESOLVED ` +
      `(xem model/homeworkModel.js), "level" cần gọi riêng resolveHomeworkLevel(lessonItem.id) ` +
      `(không gọi tự động ở đây để tránh N lượt gọi CMS không cần thiết khi chỉ cần xem danh sách).`,
  );
}

main().catch((err) => {
  console.error("\n[discover-homework] Dừng lại vì lỗi:\n");
  if (err instanceof TeacherPortalApiError) {
    console.error(`  ${err.message}`);
    if (err.status) console.error(`  HTTP status: ${err.status}`);
    if (err.body) console.error(`  Response body: ${JSON.stringify(err.body)}`);
  } else {
    console.error(`  ${err.message}`);
  }
  console.error(
    "\nKiểm tra TEACHER_ACCESS_TOKEN/TEACHER_SESSION_COOKIE trong .env (xem automation/README.md " +
      'mục "Bài tập").',
  );
  process.exitCode = 1;
});
