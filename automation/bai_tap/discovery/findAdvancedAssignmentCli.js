#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { fetchAllHomeworkRooms, resolveHomeworkLevel, TeacherPortalApiError } from "./homeworks.js";
import { normalizeHomework } from "../model/homeworkModel.js";
import { resolveClassId } from "../../giao_bai_tap/navigation/teacherAssignmentApiDiscovery.js";

/**
 * Entrypoint one-off cho testcase HW-PROFILE-BASIC-PRO-ADVANCED: tìm 1 Room ĐÃ TỒN TẠI (KHÔNG
 * phải giao bài mới) đang gán cho lớp của 2 hồ sơ Gia Linh (BASIC)/Ngoc (PRO) - cùng Khối/Lớp,
 * xác nhận qua flows/giao_bai_tap/TESTCASES.md TC1 + flows/teacher/testcases/
 * teacher-assign-homework-success.yaml (hồ sơ "Ngoc" lớp "3B") - có level=ADVANCED (nguồn:
 * discovery/homeworks.js#resolveHomeworkLevel(), CMS lesson-items/:id, KHÔNG suy đoán).
 *
 * KHÔNG random: quét toàn bộ Room của lớp theo ĐÚNG thứ tự API trả về (ổn định, không tự xáo),
 * dừng ở Room ADVANCED ĐẦU TIÊN tìm thấy - không phải chọn ngẫu nhiên giữa nhiều candidate.
 *
 * TÁI SỬ DỤNG (không viết lại logic):
 *   - fetchAllHomeworkRooms()/normalizeHomework() - discovery/homeworks.js + model/homeworkModel.js
 *     (đã xác nhận thật, dùng lại nguyên vẹn).
 *   - resolveHomeworkLevel() - discovery/homeworks.js (gọi CMS lesson-items/:id, đã xác nhận thật).
 *   - resolveClassId() - giao_bai_tap/navigation/teacherAssignmentApiDiscovery.js (tra class_id
 *     thật từ tên lớp hiển thị "3B", KHÔNG hardcode UUID cũ vì academic_year có thể đã đổi).
 *
 * Chạy: node automation/bai_tap/discovery/findAdvancedAssignmentCli.js [--class="3B"]
 * ENV: cần TEACHER_ACCESS_TOKEN (get_teacher_token.sh) + CMS_ACCESS_TOKEN (.env) - KHÔNG cần
 * thiết bị/Maestro (thuần API, giống discover-homework).
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "..", "output");
const OUTPUT_FILE = join(OUTPUT_DIR, "find_advanced_assignment_report.json");

const classArg = process.argv.find((a) => a.startsWith("--class="));
const CLASS_NAME = classArg ? classArg.split("=")[1] : process.env.TARGET_CLASS_NAME || "3B";

function log(...args) {
  console.log(...args);
}

function finish(result) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  log(`\n=== KẾT QUẢ: ${result.status} ===`);
  log(result.summary);
  log(`\nĐã ghi report ra ${OUTPUT_FILE}`);
  process.exit(result.status === "FOUND" ? 0 : 2);
}

async function main() {
  log(`[1/3] Tra class_id thật cho lớp "${CLASS_NAME}"...`);
  const classId = await resolveClassId(CLASS_NAME);
  log(`  classId=${classId}`);

  log(`[2/3] Lấy toàn bộ Room (period=MONTH) đang gán cho lớp "${CLASS_NAME}"...`);
  const rawRooms = await fetchAllHomeworkRooms({ period: "MONTH" });
  const homeworks = rawRooms.map(normalizeHomework).filter((h) => h.classIds.includes(classId));
  log(`  Tổng Room của lớp "${CLASS_NAME}": ${homeworks.length}`);

  if (homeworks.length === 0) {
    return finish({
      status: "BLOCKED_NO_ROOM_FOR_CLASS",
      summary: `Lớp "${CLASS_NAME}" (classId=${classId}) hiện KHÔNG có Room nào (period=MONTH) - không có gì để tìm ADVANCED. KHÔNG tự đoán/tạo dữ liệu giả.`,
      evidence: { className: CLASS_NAME, classId, roomCount: 0 },
    });
  }

  // KHÔNG dừng ở ADVANCED đầu tiên: ĐÃ GẶP THẬT (2026-08-13, xem automation/output/
  // find_advanced_assignment_report.json bản trước) - Room ADVANCED đầu tiên tìm thấy theo thứ tự
  // API có Hạn nộp ĐÃ QUA (endTime < hôm nay), xác nhận thật bằng scrollUntilVisible thất bại trên
  // thiết bị thật (không tìm thấy "Hạn nộp 31/07" trong danh sách mặc định "2 tuần gần nhất") - Room
  // quá hạn không còn hiển thị/thao tác được trên app HS, không dùng được cho testcase cần MỞ bài
  // thật. Quét HẾT toàn bộ Room (không early-stop) rồi lọc endTime >= hôm nay trong số ADVANCED tìm
  // được - vẫn KHÔNG random: chọn ĐÚNG 1 (đầu tiên theo thứ tự API trong tập đã lọc), không đoán.
  const now = new Date();
  const nowIso = now.toISOString();
  log(`[3/3] Quét TOÀN BỘ Room theo ĐÚNG thứ tự API trả về, gọi resolveHomeworkLevel() cho mỗi Room (không dừng sớm, để lọc thêm Hạn nộp >= hôm nay)...`);
  const checked = [];
  const advancedCandidates = [];
  for (const hw of homeworks) {
    if (!hw.lessonItem?.id) {
      checked.push({ id: hw.id, title: hw.title, level: null, error: "lessonItem.id null - bỏ qua" });
      continue;
    }
    let level;
    try {
      level = await resolveHomeworkLevel(hw.lessonItem.id);
    } catch (err) {
      checked.push({ id: hw.id, title: hw.title, level: null, error: err.message });
      continue;
    }
    checked.push({ id: hw.id, title: hw.title, level, endTime: hw.deadline.endTime });
    log(`  - [${level ?? "unknown"}] ${hw.title} (room_id=${hw.id}, Hạn nộp=${hw.deadline.endTime})`);
    if (level === "ADVANCED") advancedCandidates.push(hw);
  }

  if (advancedCandidates.length === 0) {
    return finish({
      status: "BLOCKED_NO_ADVANCED_FOUND",
      summary: `Đã quét ${checked.length}/${homeworks.length} Room của lớp "${CLASS_NAME}" - KHÔNG Room nào có level=ADVANCED (xem evidence.checked). KHÔNG tự hạ tiêu chuẩn/chọn BASIC thay thế.`,
      evidence: { className: CLASS_NAME, classId, checked },
    });
  }

  const stillOpen = advancedCandidates.filter((hw) => hw.deadline.endTime && new Date(hw.deadline.endTime) >= now);
  log(`  Tổng ADVANCED tìm thấy: ${advancedCandidates.length} (còn hạn/chưa quá hạn: ${stillOpen.length})`);

  if (stillOpen.length === 0) {
    return finish({
      status: "BLOCKED_ALL_ADVANCED_OVERDUE",
      summary: `Tìm được ${advancedCandidates.length} Room ADVANCED cho lớp "${CLASS_NAME}" nhưng TẤT CẢ đều đã quá Hạn nộp (so với ${nowIso}) - không dùng được cho testcase cần app HS mở bài thật (đã xác nhận thật qua scrollUntilVisible thất bại trên thiết bị với Room quá hạn trước đó). KHÔNG tự chọn Room quá hạn.`,
      evidence: { className: CLASS_NAME, classId, advancedCandidates: advancedCandidates.map((h) => ({ id: h.id, title: h.title, endTime: h.deadline.endTime })), checked },
    });
  }

  const found = stillOpen[0]; // đầu tiên theo thứ tự API trong tập đã lọc còn hạn - không random

  // Validate ĐẦY ĐỦ hierarchy Book -> Unit -> Lesson -> Item trước khi coi là dùng được.
  const missingHierarchy = [];
  if (!found.book?.name) missingHierarchy.push("book.name");
  if (!found.unit?.name) missingHierarchy.push("unit.name");
  if (!found.lesson?.name) missingHierarchy.push("lesson.name");
  if (!found.lessonItem?.name) missingHierarchy.push("lessonItem.name");

  if (missingHierarchy.length > 0) {
    return finish({
      status: "BLOCKED_INCOMPLETE_HIERARCHY",
      summary: `Tìm được Room ADVANCED "${found.title}" (room_id=${found.id}) nhưng thiếu field hierarchy: ${missingHierarchy.join(", ")} - không đủ để cấu hình test (cần đủ Book/Unit/Lesson/Item để validate lại sau này).`,
      evidence: { found, missingHierarchy, checked },
    });
  }

  return finish({
    status: "FOUND",
    summary: `Tìm được 1 Room ADVANCED hợp lệ cho lớp "${CLASS_NAME}": "${found.title}" (room_id=${found.id}, unit="${found.unit.name}", lesson="${found.lesson.name}").`,
    evidence: {
      className: CLASS_NAME,
      classId,
      roomId: found.id,
      title: found.title,
      book: found.book,
      unit: found.unit,
      lesson: found.lesson,
      lessonItem: found.lessonItem,
      deadline: found.deadline,
      classIds: found.classIds,
      checked,
    },
  });
}

main().catch((err) => {
  console.error("\n[find-advanced-assignment] Dừng lại vì lỗi ngoài dự kiến:\n");
  if (err instanceof TeacherPortalApiError) {
    console.error(`  ${err.message}`);
    if (err.status) console.error(`  HTTP status: ${err.status}`);
    if (err.body) console.error(`  Response body: ${JSON.stringify(err.body)}`);
  } else {
    console.error(err);
  }
  process.exit(2);
});
