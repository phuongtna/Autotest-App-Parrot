#!/usr/bin/env node
/**
 * E2E-Teacher-Assign-Student-Lifecycle
 *
 * Mở rộng e2e-teacher-assign-student-open.mjs (dừng lại ở "đã mở đúng bài") thành lifecycle ĐẦY
 * ĐỦ của chính assignment vừa được GV giao:
 *
 *   GV giao bài -> Web GV xác nhận thành công -> App HS nhận đúng assignment -> HS mở đúng bài
 *   -> bắt đầu làm -> thoát giữa chừng bằng X -> quay lại tab Bài tập -> card đổi "Tiếp tục" ->
 *   resume ĐÚNG bài -> hoàn thành bằng exercise handler chung (không giả định loại câu hỏi) ->
 *   màn kết quả.
 *
 * TÁI SỬ DỤNG (không lặp lại logic):
 *   - assignHomeworkAndLocateOnApp() từ e2e-teacher-assign-student-open.mjs - TOÀN BỘ phần Web GV
 *     (Playwright, giao bài + assert toast thành công) + lấy metadata (diff before/after qua API
 *     room.json) + xác định ĐÚNG 1 card trên App HS khớp (title, Hạn nộp). Không viết lại.
 *   - flows/homework/HW-14_15-exercise-lifecycle.yaml (đã sửa để nhận EXERCISE_NAME, không còn
 *     chọn theo index 0) - toàn bộ phần "mở -> thoát X -> resume -> hoàn thành -> kết quả".
 *
 * File này CHỈ khác e2e-teacher-assign-student-open.mjs ở bước cuối: thay vì gọi
 * flows/helpers/open-exercise.yaml rồi dừng, gọi flows/homework/HW-14_15-exercise-lifecycle.yaml
 * (chạy tiếp lifecycle đầy đủ) với EXERCISE_NAME = title assignment vừa xác định được.
 *
 * CHẠY: node flows/giao_bai_tap/e2e-teacher-assign-student-lifecycle.mjs
 * ENV: giống hệt e2e-teacher-assign-student-open.mjs (xem docblock file đó).
 */

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assignHomeworkAndLocateOnApp, APP_ID, PHONE, OTP, deviceArgs } from "./e2e-teacher-assign-student-open.mjs";
import { formatDMY, formatDM } from "../bai_tap/verify-filter-web-vs-app.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..");
// ĐÃ SỬA (2026-08-12): HW-14_15-exercise-lifecycle.yaml đã bị đổi tên thành ktra_fullluong_lambai.yaml
// (cùng nội dung/name field "HW-14_15 Lifecycle..." bên trong file, chỉ đổi tên file) - path cũ
// không còn tồn tại trên đĩa, cập nhật lại để flow này chạy được.
// ĐÃ SỬA (2026-08-14): thư mục cũng đổi tên - flows/homework/ không còn tồn tại, file thật nằm ở
// flows/bai_tap/ (xác nhận qua `ls flows/`, thư mục flows/homework báo "No such file or directory").
const HW_14_15_FLOW = join(PROJECT_ROOT, "flows", "bai_tap", "ktra_fullluong_lambai.yaml");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "e2e_teacher_assign_student_lifecycle_report.json");

/** dueDateDm ("DD/MM"): neo tìm/tap card theo Hạn nộp thay vì theo title - ĐÃ GẶP THẬT title trùng
 * với 1 card cũ quá hạn (bài từng giao trước đó), xem cùng comment trong open-exercise.yaml. */
function runLifecycleFlow(exerciseName, dueDateDm) {
  return execFileSync(
    "maestro",
    [
      ...deviceArgs(),
      "test",
      HW_14_15_FLOW,
      "-e",
      `APP_ID=${APP_ID}`,
      "-e",
      `PHONE=${PHONE}`,
      "-e",
      `OTP=${OTP}`,
      "-e",
      `EXERCISE_NAME=${exerciseName}`,
      "-e",
      `EXERCISE_DUE_DATE_DM=${dueDateDm}`,
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
}

function finish(result) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  console.log(`\n=== KẾT QUẢ: ${result.status}${result.classification ? ` (${result.classification})` : ""} ===`);
  console.log(result.summary);
  if (result.evidence) console.log(`\nEvidence:\n${JSON.stringify(result.evidence, null, 2)}`);
  console.log(`\nĐã ghi report ra ${OUTPUT_FILE}`);
  process.exit(result.status === "PASS" ? 0 : result.status === "FAIL" ? 1 : 2);
}

async function main() {
  const located = await assignHomeworkAndLocateOnApp();
  if (!located.ok) return finish(located);
  const { assignment, card, startVnYmd, dueVnYmd, selection } = located;

  console.log(
    `[5/5] Chạy HW-14_15 lifecycle (mở -> thoát X -> resume -> hoàn thành -> kết quả) cho "${assignment.title}" (unit="${selection.unitName}", lesson="${selection.lessonName}")...`,
  );
  let output = "";
  try {
    output = runLifecycleFlow(assignment.title, formatDM(dueVnYmd));
  } catch (err) {
    const combined = `${err.stdout?.toString?.() ?? ""}\n${err.stderr?.toString?.() ?? ""}\n${err.message}`;
    // Maestro không trả JUnit có cấu trúc qua execFileSync ở đây (chỉ CLI text output) - dò marker
    // "BLOCKED_MISSING_EXERCISE_HANDLER" đã cố tình nhúng trong
    // flows/helpers/answer-current-exercise-generic.yaml để phân biệt case này với lỗi khác, thay
    // vì đoán mò dựa trên bước nào trong flow đã fail.
    //
    // QUAN TRỌNG: đây có thể là kết quả HỢP LỆ của random chọn phải 1 assignment SPEAK (xem
    // docblock e2e-teacher-assign-student-open.mjs) - KHÔNG tự đổi sang assignment khác để né lỗi
    // này, chỉ report ĐÚNG unit/lesson/title đã random kèm classification BLOCKED_MISSING_EXERCISE_HANDLER.
    const isMissingHandler = combined.includes("BLOCKED_MISSING_EXERCISE_HANDLER");
    return finish({
      status: isMissingHandler ? "BLOCKED" : "FAIL",
      classification: isMissingHandler ? "BLOCKED_MISSING_EXERCISE_HANDLER" : "HS_LIFECYCLE_STEP_FAILED",
      summary: isMissingHandler
        ? `Assignment "${assignment.title}" (room_id=${assignment.id}, unit="${selection.unitName}", lesson="${selection.lessonName}") có câu hỏi dạng SPEAK - repo chưa có handler an toàn để tự động hoá tiếp (xem flows/exercise/README.md mục 2). Đây là kết quả hợp lệ của random, KHÔNG đổi sang assignment khác. Không phải flaky.`
        : `HW-14_15-exercise-lifecycle.yaml thất bại ở 1 bước nào đó (xem maestroOutputTail để biết chính xác bước/selector) cho assignment "${assignment.title}" (room_id=${assignment.id}, unit="${selection.unitName}", lesson="${selection.lessonName}").`,
      evidence: {
        assignment: { roomId: assignment.id, title: assignment.title, endTime: assignment.deadline.endTime },
        selection,
        maestroOutputTail: combined.slice(-4000),
      },
    });
  }

  return finish({
    status: "PASS",
    summary: `GV giao bài "${assignment.title}" (room_id=${assignment.id}, unit="${selection.unitName}", lesson="${selection.lessonName}") -> HS mở đúng bài -> thoát X -> resume đúng bài -> hoàn thành bằng exercise handler chung -> màn kết quả. Toàn bộ lifecycle PASS.`,
    evidence: {
      selection,
      assignment: {
        roomId: assignment.id,
        title: assignment.title,
        startTimeVn: formatDMY(startVnYmd),
        endTimeVn: formatDMY(dueVnYmd),
        classIds: assignment.classIds,
      },
      appCard: card,
      maestroOutputTail: output.slice(-2000),
    },
  });
}

main().catch((err) => {
  console.error("\n[e2e-teacher-assign-student-lifecycle] Dừng lại vì lỗi ngoài dự kiến:\n");
  console.error(err);
  process.exit(2);
});
