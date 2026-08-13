#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { fetchAllHomeworkRooms, resolveHomeworkLevel, TeacherPortalApiError } from "./homeworks.js";
import { normalizeHomework } from "../model/homeworkModel.js";

/**
 * Validate LẠI test_data/assignment_config.js qua CMS API TRƯỚC khi chạy
 * flows/bai_tap/HW-PROFILE-BASIC-PRO-ADVANCED.yaml - xác nhận room_id đã chốt VẪN còn tồn tại,
 * VẪN thuộc đúng lớp, VẪN level=ADVANCED, VẪN chưa quá Hạn nộp. KHÔNG tự chọn room khác nếu
 * BLOCKED (yêu cầu rõ - xem test_data/assignment_config.js) - chỉ báo cáo, dừng lại.
 *
 * TÁI SỬ DỤNG (không viết lại logic): fetchAllHomeworkRooms/resolveHomeworkLevel
 * (discovery/homeworks.js) + normalizeHomework (model/homeworkModel.js) - CÙNG hàm
 * findAdvancedAssignmentCli.js đã dùng để tìm ra room này lần đầu.
 *
 * Chạy: node automation/bai_tap/discovery/validateAssignmentConfigCli.js
 * ENV: cần TEACHER_ACCESS_TOKEN (get_teacher_token.sh) + CMS_ACCESS_TOKEN (.env) - giống
 * findAdvancedAssignmentCli.js.
 */

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const CONFIG_FILE = join(PROJECT_ROOT, "test_data", "assignment_config.js");

/** Parse thô các dòng `output.KEY = 'value';` trong file config Maestro runScript - KHÔNG import
 * ESM trực tiếp (file đó không phải module hợp lệ, thiếu khai báo biến `output`, dùng riêng cho
 * Maestro runtime) - cùng kỹ thuật parse thô đã dùng cho .env ở nơi khác trong repo. */
function parseMaestroOutputConfig(path) {
  const text = readFileSync(path, "utf8");
  const config = {};
  const re = /output\.(\w+)\s*=\s*'([^']*)'/g;
  let m;
  while ((m = re.exec(text))) {
    config[m[1]] = m[2];
  }
  return config;
}

function log(...args) {
  console.log(...args);
}

async function main() {
  const config = parseMaestroOutputConfig(CONFIG_FILE);
  const required = ["ROOM_ID", "LESSON_ITEM_ID", "CLASS_ID", "CLASS_NAME", "LEVEL", "DUE_DATE_DM", "HOMEWORK_ITEM_NAME"];
  const missing = required.filter((k) => !config[k]);
  if (missing.length > 0) {
    console.error(`BLOCKED_CONFIG_MISSING_FIELDS: thiếu ${missing.join(", ")} trong ${CONFIG_FILE}`);
    process.exit(2);
  }

  log(`Validate room_id=${config.ROOM_ID} (lớp "${config.CLASS_NAME}", kỳ vọng level=${config.LEVEL})...`);

  const rawRooms = await fetchAllHomeworkRooms({ period: "MONTH" });
  const homeworks = rawRooms.map(normalizeHomework);
  const room = homeworks.find((h) => h.id === config.ROOM_ID);

  if (!room) {
    console.error(
      `BLOCKED_ROOM_NOT_FOUND: room_id=${config.ROOM_ID} không còn tồn tại trong dữ liệu Room hiện tại (period=MONTH) của lớp "${config.CLASS_NAME}". KHÔNG tự chọn room khác - cần giao bài mới hoặc cập nhật lại test_data/assignment_config.js bằng dữ liệu thật mới.`,
    );
    process.exit(2);
  }

  if (!room.classIds.includes(config.CLASS_ID)) {
    console.error(
      `BLOCKED_CLASS_MISMATCH: room_id=${config.ROOM_ID} không còn thuộc lớp "${config.CLASS_NAME}" (classIds hiện tại: ${room.classIds.join(", ")}).`,
    );
    process.exit(2);
  }

  const now = new Date();
  const endTime = room.deadline.endTime ? new Date(room.deadline.endTime) : null;
  if (!endTime || endTime < now) {
    console.error(
      `BLOCKED_ROOM_OVERDUE: room_id=${config.ROOM_ID} Hạn nộp (${room.deadline.endTime ?? "null"}) đã qua so với hiện tại (${now.toISOString()}). KHÔNG tự chọn room khác - cần giao bài mới hoặc cập nhật lại config bằng dữ liệu thật mới.`,
    );
    process.exit(2);
  }

  let level;
  try {
    level = await resolveHomeworkLevel(room.lessonItem.id);
  } catch (err) {
    console.error(`BLOCKED_LEVEL_LOOKUP_FAILED: không gọi được resolveHomeworkLevel(${room.lessonItem.id}): ${err.message}`);
    process.exit(2);
  }

  if (level !== config.LEVEL) {
    console.error(
      `BLOCKED_LEVEL_CHANGED: room_id=${config.ROOM_ID} hiện có level="${level}" (kỳ vọng "${config.LEVEL}"). KHÔNG tự chọn room khác - cần cập nhật lại config bằng dữ liệu thật mới.`,
    );
    process.exit(2);
  }

  log(`  [PASS] title="${room.title}" unit="${room.unit.name}" lesson="${room.lesson.name}" level=${level} Hạn nộp(ISO)=${room.deadline.endTime}`);
  log("VALID - config vẫn dùng được, có thể chạy flows/bai_tap/HW-PROFILE-BASIC-PRO-ADVANCED.yaml.");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n[validate-assignment-config] Dừng lại vì lỗi ngoài dự kiến:\n");
  if (err instanceof TeacherPortalApiError) {
    console.error(`  ${err.message}`);
  } else {
    console.error(err);
  }
  process.exit(2);
});
