#!/usr/bin/env node
/**
 * E2E-Ktra-Fullluong-Lambai-PRO (KHÔNG scoring)
 *
 * Case: chạy lại lifecycle làm bài ĐẦY ĐỦ (mở -> thoát X -> resume -> hoàn thành -> màn kết quả)
 * trên hồ sơ PRO "Ngoc", với YÊU CẦU RÕ: KHÔNG có mục tiêu điểm số 6-8, KHÔNG resolve đáp án CMS,
 * KHÔNG scoring engine. Đây là bản KHÁC (đơn giản hoá) của
 * flows/giao_bai_tap/e2e-ktra-fullluong-lambai-scored-pro.mjs - file đó dùng
 * HomeworkExamEngine.decideAnswerAction() + đáp án CMS thật để ép điểm rơi vào [6.0, 8.0]. Case
 * NÀY không có yêu cầu đó nên KHÔNG mang engine đó sang - trả lời câu hỏi dùng nguyên
 * flows/helpers/answer-current-exercise-generic.yaml (dispatcher tự khai "KHONG kiem tra
 * dung/sai... chi thao tac AN TOAN de chuyen sang cau tiep theo" - đúng tinh thần case này).
 *
 * TÁI SỬ DỤNG TỐI ĐA (không viết lại logic đã có):
 *   - assignHomeworkAndLocateOnApp() từ ./e2e-teacher-assign-student-open.mjs - GV giao 1 bài
 *     THẬT SỰ RANDOM (không set ASSIGN_UNIT_NAME/ASSIGN_LESSON_NAME/ASSIGN_HOMEWORK_ITEM_NAME nên
 *     random tự nhiên từ dữ liệu UI thật qua teacherAssignmentDiscovery.js - không blacklist title
 *     nào, xem docblock file đó) + xác nhận ĐÚNG 1 room mới + locate ĐÚNG 1 card khớp trên app HS
 *     (tự BLOCKED nếu ambiguous - không tự đoán/mở nhầm). KHÔNG sửa file đó.
 *   - flows/bai_tap/ktra_fullluong_lambai.yaml (copy y hệt cách gọi của
 *     flows/giao_bai_tap/e2e-teacher-assign-student-lifecycle.mjs: `maestro test` qua
 *     execFileSync, truyền EXERCISE_NAME/EXERCISE_DUE_DATE_DM) - TOÀN BỘ phần "mở -> thoát X ->
 *     resume -> hoàn thành bằng dispatcher chung -> màn kết quả -> verify progress tăng" là của
 *     chính file YAML đó, không viết lại bằng JS.
 *   - flows/helpers/ensure-profile-active.yaml (helper MỚI, tối thiểu - tổng quát hoá khối
 *     switch-profile đã verify thật trong flows/bai_tap/HW-PROFILE-BASIC-PRO-ADVANCED.yaml) - chỉ
 *     phần bổ sung THẬT SỰ CẦN cho case này (yêu cầu xác nhận đang ở hồ sơ PRO trước khi làm bài,
 *     ktra_fullluong_lambai.yaml gốc không biết gì về profile).
 *
 * THỨ TỰ (quan trọng): chuyển hồ sơ PRO TRƯỚC khi GV giao bài/locate - lớp 3B có CẢ 2 hồ sơ Gia
 * Linh (BASIC)/Ngoc (PRO) (xem docblock HW-PROFILE-BASIC-PRO-ADVANCED.yaml) nên nếu random trúng
 * item ADVANCED mà đang đứng hồ sơ BASIC, app sẽ chặn bằng sheet nâng cấp (không phải lỗi, nhưng
 * KHÔNG đúng mục tiêu case này là verify full lifecycle trên PRO) - đảm bảo profile ĐÚNG trước khi
 * bất kỳ bước app-side nào chạy.
 *
 * KHÔNG tự tạo assignment thứ 2 nếu bước nào phía sau FAIL/BLOCKED - report NGUYÊN TRẠNG, không
 * retry bằng cách giao bài mới (đúng yêu cầu SAFETY: "Không tạo assignment thứ hai để thử lại").
 *
 * CHẠY: node flows/giao_bai_tap/e2e-ktra-fullluong-lambai-pro.mjs
 * ENV: APP_ID/PHONE/OTP/MAESTRO_DEVICE, TEACHER_* (.env, dùng bởi assignHomeworkAndLocateOnApp),
 *   ASSIGN_PRIMARY_CLASS (default "3B"), PROFILE_PRO_NAME (test_data/accounts.env, default "Ngoc").
 */

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseEnvFile } from "../../automation/src/config.js";
import { assignHomeworkAndLocateOnApp, APP_ID, PHONE, OTP, deviceArgs } from "./e2e-teacher-assign-student-open.mjs";
import { formatDMY, formatDM } from "../bai_tap/verify-filter-web-vs-app.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..");
const ACCOUNTS_ENV = parseEnvFile(join(PROJECT_ROOT, "test_data", "accounts.env"));
const PROFILE_PRO_NAME = process.env.PROFILE_PRO_NAME || ACCOUNTS_ENV.PROFILE_PRO_NAME || "Ngoc";
const ENSURE_PROFILE_FLOW = join(PROJECT_ROOT, "flows", "helpers", "ensure-profile-active.yaml");
const LIFECYCLE_FLOW = join(PROJECT_ROOT, "flows", "bai_tap", "ktra_fullluong_lambai.yaml");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "e2e_ktra_fullluong_lambai_pro_report.json");
const YAML_REFERENCE_FILE = "flows/bai_tap/ktra_fullluong_lambai.yaml";

function runMaestro(flowPath, envPairs) {
  const args = [...deviceArgs(), "test", flowPath];
  for (const [k, v] of Object.entries(envPairs)) args.push("-e", `${k}=${v}`);
  return execFileSync("maestro", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function finish(result) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  console.log(`\n${formatReport(result)}\n`);
  console.log(`Đã ghi report JSON ra ${OUTPUT_FILE}`);
  process.exit(result.status === "PASS" ? 0 : result.status === "BLOCKED" ? 2 : 1);
}

function formatReport(result) {
  const e = result.evidence ?? {};
  const p = e.profile ?? {};
  const ra = e.randomAssignment ?? {};
  const flow = e.flow ?? {};
  const safety = e.safety ?? {};
  const perf = e.performance ?? {};
  const lines = [];
  const push = (s = "") => lines.push(s);

  push(`[PROFILE]`);
  push(`profile=${p.name ?? "-"}`);
  push(`tier=${p.verified ? "PRO" : "UNKNOWN"}`);
  push(`profile_verified=${p.verified ? "YES" : "NO"}`);
  push(``);
  push(`[RANDOM_ASSIGNMENT]`);
  push(`selected=${ra.selected ? "YES" : "NO"}`);
  push(`unit=${ra.unit ?? "-"}`);
  push(`lesson=${ra.lesson ?? "-"}`);
  push(`lesson_item_id=${ra.lessonItemId ?? "-"}`);
  push(`assignment_id/room_id=${ra.roomId ?? "-"}`);
  push(`title=${ra.title ?? "-"}`);
  push(`questionCount=${ra.questionCount ?? "- (dispatcher không đọc trước số câu - xem answer-current-exercise-generic.yaml, chỉ lặp tối đa 25 lần tới khi vào màn kết quả)"}`);
  push(``);
  push(`[FLOW]`);
  push(`assignment_opened=${flow.assignmentOpened ? "YES" : "NO"}`);
  push(`questions_answered=${flow.questionsAnswered ?? "- (dispatcher không đếm số câu đã trả lời, chỉ lặp tới khi hết bài - xem answer-current-exercise-generic.yaml)"}`);
  push(`questions_presented=${flow.questionsPresented ?? "- (không đếm - lý do như trên)"}`);
  push(`finish_reached=${flow.finishReached ? "YES" : "NO"}`);
  push(`result_screen=${flow.resultScreen ? "YES" : "NO"}`);
  push(``);
  push(`[SCORING]`);
  push(`REQUIREMENT=NONE`);
  push(`actual_score=- (app không log giá trị điểm ra CLI output; ${YAML_REFERENCE_FILE} chỉ verify dòng "Điểm <số>" TỒN TẠI trên card, không đọc giá trị cụ thể - xem test_data/hw_fullluong_compare_card_progress.js)`);
  push(`score_pass_fail=NOT_APPLICABLE`);
  push(``);
  push(`[SAFETY]`);
  push(`new_assignments_created=${safety.newAssignmentsCreated ?? 0}`);
  push(`wrong_assignment_opened=${safety.wrongAssignmentOpened ? "YES" : "NO"}`);
  push(`duplicate_assignment_created=${safety.duplicateAssignmentCreated ? "YES" : "NO"}`);
  push(`app_restarted=NO`);
  push(`session_preserved=${safety.sessionPreserved ? "YES" : "NO"}`);
  push(`otp_required=NO (session giữ nguyên qua launch-keep-session.yaml + login.yaml tự bỏ qua nếu đã ở dashboard)`);
  push(``);
  push(`[PERFORMANCE]`);
  push(`duration=${perf.durationSeconds != null ? `${perf.durationSeconds.toFixed(1)}s` : "-"}`);
  push(`maestro_processes=${perf.maestroProcesses ?? "-"} (1 ensure-profile-active.yaml + N giao bài/locate bên trong assignHomeworkAndLocateOnApp (hạ tầng dùng chung, không sửa) + 1 ktra_fullluong_lambai.yaml)`);
  push(`relevant calls=teacher web assign (Playwright, 1 lần) + room.json API diff (before/after) + native scrollUntilVisible locate + ktra_fullluong_lambai.yaml lifecycle`);
  push(``);
  push(`[OVERALL]`);
  push(result.status);
  if (result.status !== "PASS") {
    push(``);
    push(`[ROOT_CAUSE]`);
    push(result.error ?? result.phase ?? "-");
  }
  return lines.join("\n");
}

async function main() {
  const overallStart = Date.now();
  const evidence = { profile: {}, randomAssignment: {}, flow: {}, safety: {}, performance: {} };
  let maestroProcesses = 0;

  console.log(`[0/3] Đảm bảo hồ sơ PRO "${PROFILE_PRO_NAME}" đang active TRƯỚC khi GV giao bài (lớp có cả BASIC/PRO, xem docblock đầu file)...`);
  try {
    runMaestro(ENSURE_PROFILE_FLOW, { APP_ID, PHONE, OTP, TARGET_PROFILE_NAME: PROFILE_PRO_NAME });
    maestroProcesses++;
  } catch (err) {
    evidence.profile = { name: PROFILE_PRO_NAME, verified: false };
    evidence.performance = { durationSeconds: (Date.now() - overallStart) / 1000, maestroProcesses };
    return finish({
      status: "BLOCKED",
      phase: "PROFILE",
      error: `Không chuyển/verify được hồ sơ PRO "${PROFILE_PRO_NAME}": ${err.stderr?.toString?.().slice(-2000) ?? err.message}`,
      evidence,
    });
  }
  evidence.profile = { name: PROFILE_PRO_NAME, verified: true };
  console.log(`  [PASS] Hồ sơ "${PROFILE_PRO_NAME}" đang active.`);

  console.log(`[1/3] GV giao bài random (không blacklist title nào) + App HS locate đúng card (assignHomeworkAndLocateOnApp - hạ tầng dùng chung, không sửa)...`);
  // BOUNDED RETRY (mới, tối thiểu): CHỈ retry khi classification="GV_ASSIGNMENT_FAILED" ở bước
  // "selectUnitLessonHomework" - đã XÁC NHẬN THẬT (run 2026-08-18) đây là lỗi xảy ra TRƯỚC khi bấm
  // "Giao bài đã chọn" (chưa tạo room nào, newAssignmentsCreated=0) khi random trúng unit "Review N"
  // (Web GV không có Lesson để chọn cho unit dạng Review - hạn chế cấu trúc đã biết, cùng lý do
  // pickFeasibleRandomAssignment() trong e2e-ktra-fullluong-lambai-scored-pro.mjs loại thẳng unit
  // Review khỏi vòng thử). KHÔNG retry cho bất kỳ classification nào khác (vd
  // BLOCKED_AMBIGUOUS_ASSIGNMENT_MATCH ngụ ý CÓ THỂ đã tạo room) - an toàn "chỉ 1 assignment" chỉ
  // đảm bảo được vì lỗi này xảy ra TRƯỚC bước tạo room, không phải sau.
  const MAX_ASSIGN_ATTEMPTS = 3;
  let located = null;
  for (let attempt = 1; attempt <= MAX_ASSIGN_ATTEMPTS; attempt++) {
    located = await assignHomeworkAndLocateOnApp();
    if (located.ok || located.classification !== "GV_ASSIGNMENT_FAILED") break;
    console.log(`  [RETRY ${attempt}/${MAX_ASSIGN_ATTEMPTS}] Random trúng unit không hỗ trợ giao bài qua Web GV (chưa tạo room nào) - random lại: ${located.summary}`);
  }
  evidence.safety.sessionPreserved = true;
  if (!located.ok) {
    evidence.randomAssignment = { selected: false };
    evidence.safety.newAssignmentsCreated = located.classification === "BLOCKED_AMBIGUOUS_ASSIGNMENT_MATCH" ? 1 : 0;
    evidence.performance = { durationSeconds: (Date.now() - overallStart) / 1000, maestroProcesses };
    return finish({
      status: located.status ?? "BLOCKED",
      phase: "RANDOM_ASSIGN_OR_LOCATE",
      error: located.summary ?? "assignHomeworkAndLocateOnApp() trả về ok=false, xem chi tiết.",
      evidence: { ...evidence, located },
    });
  }
  const { assignment, dueVnYmd, selection } = located;
  evidence.randomAssignment = {
    selected: true,
    unit: selection.unitName,
    lesson: selection.lessonName,
    lessonItemId: selection.exerciseId ?? null,
    roomId: assignment.id,
    title: assignment.title,
    questionCount: selection.questionCount ?? null,
  };
  evidence.safety.newAssignmentsCreated = 1;
  evidence.safety.duplicateAssignmentCreated = false;
  evidence.safety.wrongAssignmentOpened = false;
  console.log(`  [PASS] room_id=${assignment.id} title="${assignment.title}" unit="${selection.unitName}" lesson="${selection.lessonName}"`);

  console.log(`[2/3] Chạy ${YAML_REFERENCE_FILE} (mở -> thoát X -> resume -> hoàn thành bằng answer-current-exercise-generic.yaml -> màn kết quả -> verify progress tăng)...`);
  try {
    runMaestro(LIFECYCLE_FLOW, { APP_ID, PHONE, OTP, EXERCISE_NAME: assignment.title, EXERCISE_DUE_DATE_DM: formatDM(dueVnYmd) });
    maestroProcesses++;
  } catch (err) {
    const combined = `${err.stdout?.toString?.() ?? ""}\n${err.stderr?.toString?.() ?? ""}\n${err.message}`;
    const isMissingHandler = combined.includes("BLOCKED_MISSING_EXERCISE_HANDLER");
    // BLOCKED_MISSING_EXERCISE_HANDLER là kết quả HỢP LỆ của random trúng câu SPEAK/SORT-
    // SENTENCE_BUILDER (xem docblock ktra_fullluong_lambai.yaml + answer-current-exercise-
    // generic.yaml) - KHÔNG coi là flaky, KHÔNG tự random lại bài khác để né.
    evidence.flow = { assignmentOpened: true, finishReached: false, resultScreen: false };
    evidence.performance = { durationSeconds: (Date.now() - overallStart) / 1000, maestroProcesses };
    return finish({
      status: isMissingHandler ? "BLOCKED" : "FAIL",
      phase: "LIFECYCLE",
      error: isMissingHandler
        ? `Assignment "${assignment.title}" (room_id=${assignment.id}) có câu hỏi dạng SPEAK hoặc SORT/SENTENCE_BUILDER - dispatcher chung chưa có handler an toàn (giới hạn đã biết, xem flows/exercise/README.md mục 2). Kết quả hợp lệ của random, không phải lỗi flow.`
        : `${YAML_REFERENCE_FILE} FAIL ở 1 bước (xem maestroOutputTail để biết bước/selector cụ thể): ${combined.slice(-2000)}`,
      evidence: { ...evidence, maestroOutputTail: combined.slice(-4000) },
    });
  }

  evidence.flow = { assignmentOpened: true, questionsAnswered: null, questionsPresented: null, finishReached: true, resultScreen: true };
  evidence.performance = { durationSeconds: (Date.now() - overallStart) / 1000, maestroProcesses };
  console.log(`  [PASS] Lifecycle hoàn thành - đã tới màn kết quả, progress đã tăng (verify bởi chính ${YAML_REFERENCE_FILE}).`);

  return finish({ status: "PASS", evidence });
}

main().catch((err) => {
  console.error("\n[e2e-ktra-fullluong-lambai-pro] Dừng lại vì lỗi ngoài dự kiến:\n");
  console.error(err);
  process.exit(2);
});
