#!/usr/bin/env node
/**
 * E2E-Teacher-Assign-Student-Open-Homework
 *
 * Verify vế V03 CHƯA VERIFY của flows/giao_bai_tap/TESTCASES.md (TC1) + đúng phần "app HS nhận
 * thông báo" CHƯA VERIFY của flows/teacher/testcases/teacher-assign-homework-success.yaml:
 *
 *   Web GV giao bài -> xác nhận UI báo giao bài thành công -> App HS nhận đúng bài vừa giao ->
 *   HS mở đúng bài đó.
 *
 * KHÔNG kiểm tra đáp án của bất kỳ loại câu hỏi nào (MULTI/SINGLE/FILL/SPEAK) - mục tiêu DUY
 * NHẤT là chứng minh 3 mắt xích trên nối đúng nhau. Muốn kiểm tra tiếp lifecycle đầy đủ (thoát
 * giữa chừng, resume, hoàn thành, màn kết quả) xem e2e-teacher-assign-student-lifecycle.mjs (file
 * đó IMPORT assignHomeworkAndLocateOnApp() ở đây, không lặp lại logic Web GV/matching).
 *
 * TÁI SỬ DỤNG (không viết lại):
 *   - automation/giao_bai_tap/runtime/assignHomeworkFlow.js  - toàn bộ phần Web GV (Playwright):
 *     login, mở form, chọn lớp, chọn Unit/Lesson/bài, bấm "Giao bài đã chọn", chờ toast
 *     "Giao bài tập mới thành công" (page objects đã verify thật trong teacherPortalPageObjects.js).
 *   - automation/bai_tap/discovery/homeworks.js + model/homeworkModel.js - lấy metadata assignment
 *     (room.id/title/start_time/end_time/class_ids) qua API GET /api/user/exams/room.json, KHÔNG
 *     scrape UI Web GV (endpoint room_id-cho-bài-mới-tinh không tồn tại - xem comment homeworkModel.js
 *     "assignedDate"/"examId" UNRESOLVED - nên phải suy ra room mới bằng diff before/after).
 *   - flows/homework/verify-filter-web-vs-app.mjs (export sẵn, có guard argv nên import an toàn) -
 *     toàn bộ engine điều hướng+thu thập+match card App HS đã verify thật (login, mở tab Bài tập,
 *     đổi filter WEEK/MONTH, cuộn theo TOẠ ĐỘ, parse card từ hierarchy, quy đổi giờ VN, khoá match
 *     title+Hạn nộp). Không viết lại bất kỳ phần nào trong số này.
 *   - flows/helpers/open-exercise.yaml (không sửa) - bước tap "Làm bài" cuối cùng + cổng xác nhận
 *     "đã vào màn làm bài" generic (`exercise_close_button`, verify KHÔNG phụ thuộc loại câu hỏi -
 *     xem comment trong chính file đó).
 *
 * KHÔNG đụng tới EX-06/EX-12/các EX testcase khác, KHÔNG tạo selector mới, KHÔNG thao tác mic.
 *
 * BUSINESS RULE NGÀY (đã verify thật, xem docblock verify-filter-web-vs-app.mjs):
 *   room.start_time = Ngày giao, room.end_time = Hạn nộp. Filter WEEK/MONTH trên Web GV lọc theo
 *   end_time. Match App HS <-> Web GV dùng (title, Hạn nộp DD/MM quy đổi giờ VN từ end_time) -
 *   start_time CHỈ dùng để hiển thị "ngày giao" trong report, không dùng để quyết định filter/match.
 *
 * XỬ LÝ DUPLICATE: nếu Web GV có >1 room mới cùng title (double-submit bug đã biết - xem
 * flows/giao_bai_tap/TESTCASES.md) hoặc App HS có >1 card cùng khoá (title, Hạn nộp) mà không thể
 * quy về đúng 1 assignment vừa tạo -> BLOCKED_AMBIGUOUS_ASSIGNMENT_MATCH, KHÔNG tự chọn đại 1 card.
 *
 * CHẠY (cần .env có TEACHER_USERNAME/PASSWORD/TEACHER_ACCESS_TOKEN, test_data/accounts.env có
 * PHONE/OTP của học sinh lớp tương ứng, thiết bị Android đã kết nối - xem README.md):
 *   node flows/giao_bai_tap/e2e-teacher-assign-student-open.mjs
 * ENV (đều optional, có default khớp dữ liệu ĐÃ XÁC NHẬN THẬT trong TESTCASES.md):
 *   ASSIGN_PRIMARY_CLASS (default "3B"), ASSIGN_OTHER_GROUP_CLASS (default "6D"),
 *   ASSIGN_DUE_DATE "DD/MM/YYYY" (default hôm nay+7 ngày), ASSIGN_UNIT_NAME (default "Unit 1: Hello"),
 *   ASSIGN_LESSON_NAME (default "Lesson 1"), ASSIGN_HOMEWORK_ITEM_NAME
 *   (default "G3-U1-Lesson 1: Listen and repeat" - bài ĐÃ xác nhận thật tồn tại cho lớp 3B),
 *   ASSIGN_HEADLESS (default true), ASSIGN_DEBUG_DUMP (default true - chụp screenshot khi FAIL),
 *   TARGET_CLASS_ID (default id lớp "3B", PHẢI cùng trỏ 1 lớp thật với ASSIGN_PRIMARY_CLASS),
 *   APP_ID/PHONE/OTP/MAESTRO_DEVICE - đọc .env/test_data/accounts.env giống các script khác.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

import { assignHomeworkFlow } from "../../automation/giao_bai_tap/runtime/assignHomeworkFlow.js";
import { fetchAllHomeworkRooms } from "../../automation/bai_tap/discovery/homeworks.js";
import { normalizeHomework } from "../../automation/bai_tap/model/homeworkModel.js";
import { requireTeacherPortalConfig } from "../../automation/src/config.js";
import {
  isoToVnYmd,
  computeRange,
  inRange,
  formatDM,
  formatDMY,
  appDueDateKeyFragment,
  openHomeworkTabAtDefaultFilter,
  switchFilterToOneMonth,
  collectAllVisibleHomeworkCards,
} from "../homework/verify-filter-web-vs-app.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..");
const HELPERS_DIR = join(SELF_DIR, "..", "helpers");
const OPEN_EXERCISE_FLOW = join(HELPERS_DIR, "open-exercise.yaml");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "e2e_teacher_assign_student_open_report.json");

// Cùng 1 lớp thật với ASSIGN_PRIMARY_CLASS (mặc định "3B") - id lấy từ
// verify-filter-web-vs-app.mjs (đã xác nhận thật, không đoán).
const TARGET_CLASS_ID = process.env.TARGET_CLASS_ID || "b3336062-cacd-4d1a-a0af-4de44acf33d2";

const ASSIGN_PRIMARY_CLASS = process.env.ASSIGN_PRIMARY_CLASS || "3B";
const ASSIGN_OTHER_GROUP_CLASS = process.env.ASSIGN_OTHER_GROUP_CLASS || "6D";
const ASSIGN_UNIT_NAME = process.env.ASSIGN_UNIT_NAME || "Unit 1: Hello";
const ASSIGN_LESSON_NAME = process.env.ASSIGN_LESSON_NAME || "Lesson 1";
const ASSIGN_HOMEWORK_ITEM_NAME = process.env.ASSIGN_HOMEWORK_ITEM_NAME || "G3-U1-Lesson 1: Listen and repeat";
const ASSIGN_HEADLESS = process.env.ASSIGN_HEADLESS !== "false";
const ASSIGN_DEBUG_DUMP = process.env.ASSIGN_DEBUG_DUMP !== "false";

function addDaysDdMmYyyy(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
const ASSIGN_DUE_DATE = process.env.ASSIGN_DUE_DATE || addDaysDdMmYyyy(7);

export const DEVICE_ID = process.env.MAESTRO_DEVICE || "";
export function deviceArgs() {
  return DEVICE_ID ? ["--device", DEVICE_ID] : [];
}

function loadEnvFile(path) {
  const env = {};
  if (!existsSync(path)) return env;
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return env;
}
const rootEnv = loadEnvFile(join(PROJECT_ROOT, ".env"));
const accountsEnv = loadEnvFile(join(PROJECT_ROOT, "test_data", "accounts.env"));
export const APP_ID = process.env.APP_ID || rootEnv.APP_ID;
export const PHONE = process.env.PHONE || accountsEnv.PHONE;
export const OTP = process.env.OTP || accountsEnv.OTP;

/** Cuộn về đầu danh sách "Bài tập" - dùng ngay trước khi gọi open-exercise.yaml, vì
 * collectAllVisibleHomeworkCards() (import ở trên) có thể đã cuộn xuống rất sâu (full scan) khi
 * tìm card - nếu không cuộn lại về đầu, scrollUntilVisible DOWN của open-exercise.yaml sẽ không
 * thấy lại card đã cuộn qua (chỉ cuộn 1 chiều từ vị trí hiện tại). */
export function scrollToTopBeforeTap() {
  const dir = mkdtempSync(join(os.tmpdir(), "e2e-scrolltop-"));
  const flowPath = join(dir, "step.yaml");
  const steps = Array.from({ length: 8 }, () => `- swipe:\n    direction: DOWN\n    duration: 250`).join("\n");
  writeFileSync(flowPath, `appId: ${APP_ID}\n---\n${steps}\n`, "utf8");
  try {
    execFileSync("maestro", [...deviceArgs(), "test", flowPath, "-e", `APP_ID=${APP_ID}`], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Bấm "Làm bài" đúng card đã xác nhận (tái sử dụng nguyên vẹn open-exercise.yaml - không tự viết
 * lại thao tác scroll/tap/consent-AI/chờ exercise_close_button, đều đã verify thật trong file đó).
 * Truyền dueDateDm (Hạn nộp "DD/MM") để helper neo theo đó thay vì theo title - ĐÃ GẶP THẬT title
 * trùng với 1 card cũ quá hạn (bài từng giao trước đó), title-only scroll/tap không nhắm đúng. */
function tapAndOpenExercise(exerciseName, dueDateDm) {
  execFileSync(
    "maestro",
    [
      ...deviceArgs(),
      "test",
      OPEN_EXERCISE_FLOW,
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

/** Quan sát THÔNG TIN (không dùng để quyết định PASS/FAIL - xem mục 8/9 yêu cầu) loại câu hỏi vừa
 * mở, chỉ để ghi vào report "App evidence". */
function observeExerciseTypeBestEffort() {
  try {
    const raw = execFileSync("maestro", [...deviceArgs(), "hierarchy"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    if (/Nhấn để nói/.test(raw)) return "SPEAK (Nhấn để nói)";
    if (/Nhập câu trả lời/.test(raw)) return "FILL (Nhập câu trả lời)";
    if (/Kiểm tra/.test(raw)) return "MULTI/SINGLE (nút Kiểm tra)";
    return "unknown (không khớp mẫu quan sát nào)";
  } catch {
    return "unknown (không đọc được hierarchy)";
  }
}

async function fetchClassDatasetByTitle(title) {
  const rawRooms = await fetchAllHomeworkRooms({ period: "MONTH" });
  return rawRooms
    .map(normalizeHomework)
    .filter((h) => h.classIds.includes(TARGET_CLASS_ID) && h.title === title);
}

/**
 * Phần DÙNG CHUNG cho mọi testcase cần "GV giao 1 bài MỚI rồi xác định ĐÚNG 1 card tương ứng trên
 * App HS": giao bài (Web GV) -> lấy metadata (diff before/after qua API) -> mở tab Bài tập trên
 * App HS -> tìm card khớp (title, Hạn nộp) DUY NHẤT. KHÔNG bấm "Làm bài" - caller (file này hoặc
 * e2e-teacher-assign-student-lifecycle.mjs) tự quyết định bước tiếp theo (mở rồi dừng, hay mở rồi
 * chạy tiếp lifecycle đầy đủ).
 *
 * @returns {Promise<{ok:false, status, classification, summary, evidence} | {ok:true, assignment, card, scanOutcome, startVnYmd, dueVnYmd}>}
 */
export async function assignHomeworkAndLocateOnApp() {
  requireTeacherPortalConfig();
  if (!APP_ID) throw new Error("Thiếu APP_ID - kiểm tra .env.");
  if (!PHONE || !OTP) throw new Error("Thiếu PHONE/OTP - kiểm tra test_data/accounts.env.");

  console.log("[1/4] Snapshot Web GV TRƯỚC khi giao bài (để diff tìm room mới sau khi giao)...");
  const before = await fetchClassDatasetByTitle(ASSIGN_HOMEWORK_ITEM_NAME);
  const beforeIds = new Set(before.map((h) => h.id));

  console.log(`[2/4] Giao bài qua Web GV (Playwright): lớp=${ASSIGN_PRIMARY_CLASS}, hạn nộp=${ASSIGN_DUE_DATE}, bài="${ASSIGN_HOMEWORK_ITEM_NAME}"...`);
  const assignResult = await assignHomeworkFlow({
    primaryClass: ASSIGN_PRIMARY_CLASS,
    otherGroupClass: ASSIGN_OTHER_GROUP_CLASS,
    dueDate: ASSIGN_DUE_DATE,
    unitName: ASSIGN_UNIT_NAME,
    lessonName: ASSIGN_LESSON_NAME,
    homeworkItemName: ASSIGN_HOMEWORK_ITEM_NAME,
    headless: ASSIGN_HEADLESS,
    debugDump: ASSIGN_DEBUG_DUMP,
  });

  if (assignResult.status !== "PASS") {
    const failedStep = assignResult.steps.find((s) => s.status === "FAIL");
    const classification = failedStep?.name === "submitAssign" ? "GV_SUCCESS_MESSAGE_MISSING" : "GV_ASSIGNMENT_FAILED";
    return {
      ok: false,
      status: "FAIL",
      classification,
      summary:
        classification === "GV_SUCCESS_MESSAGE_MISSING"
          ? `Bấm "Giao bài đã chọn" nhưng không thấy toast "Giao bài tập mới thành công" (hoặc bấm nút thất bại) trong 15s.`
          : `Giao bài thất bại ở bước "${failedStep?.name}" (trước khi tới bước bấm giao bài).`,
      evidence: { steps: assignResult.steps, error: assignResult.error },
    };
  }
  console.log(`  [PASS] Toast "Giao bài tập mới thành công" đã hiện - Web GV giao bài OK.`);

  console.log("[3/4] Lấy metadata assignment vừa tạo (diff before/after qua API room.json)...");
  let after = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    after = await fetchClassDatasetByTitle(ASSIGN_HOMEWORK_ITEM_NAME);
    if (after.some((h) => !beforeIds.has(h.id))) break;
    if (attempt < 3) {
      console.log(`  Chưa thấy room mới (lần ${attempt}/3) - chờ 3s rồi thử lại (API có thể chưa kịp cập nhật)...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  const newRooms = after.filter((h) => !beforeIds.has(h.id));

  if (newRooms.length === 0) {
    return {
      ok: false,
      status: "BLOCKED",
      classification: "ASSIGNMENT_METADATA_MISSING",
      summary: `Web GV báo giao bài thành công nhưng không tìm thấy room mới nào qua GET /api/user/exams/room.json (lớp=${TARGET_CLASS_ID}, title="${ASSIGN_HOMEWORK_ITEM_NAME}") sau 3 lần thử.`,
      evidence: { beforeCount: before.length, afterCount: after.length },
    };
  }
  if (newRooms.length > 1) {
    return {
      ok: false,
      status: "BLOCKED",
      classification: "BLOCKED_AMBIGUOUS_ASSIGNMENT_MATCH",
      summary: `Web GV tạo ${newRooms.length} room MỚI cùng title+lớp sau 1 lượt giao bài (nghi vấn bug double-submit đã ghi nhận ở flows/giao_bai_tap/TESTCASES.md) - không thể xác định đâu là "đúng 1" assignment vừa giao để đối chiếu App HS, không đoán.`,
      evidence: {
        title: ASSIGN_HOMEWORK_ITEM_NAME,
        deadline: newRooms.map((r) => formatDMY(isoToVnYmd(r.deadline.endTime))),
        soAssignmentTrung: newRooms.length,
        roomIds: newRooms.map((r) => r.id),
      },
    };
  }

  const assignment = newRooms[0];
  const dueVnYmd = isoToVnYmd(assignment.deadline.endTime);
  const startVnYmd = isoToVnYmd(assignment.deadline.startTime);
  const dueDM = formatDM(dueVnYmd);
  console.log(
    `  [PASS] room_id=${assignment.id} title="${assignment.title}" ngày giao(VN)=${formatDMY(startVnYmd)} hạn nộp(VN)=${formatDMY(dueVnYmd)}`,
  );

  console.log("[4/4] App HS: login, mở tab Bài tập, tìm đúng card vừa giao...");
  try {
    openHomeworkTabAtDefaultFilter();
    const weekRange = computeRange("WEEK");
    if (!inRange(dueVnYmd, weekRange.rangeStart, weekRange.rangeEnd)) {
      console.log(`  Hạn nộp (${formatDMY(dueVnYmd)}) ngoài "2 tuần gần nhất" - đổi filter sang "1 tháng gần nhất"...`);
      switchFilterToOneMonth();
    }
  } catch (err) {
    return {
      ok: false,
      status: "FAIL",
      classification: "HS_HOMEWORK_TAB_FAILED",
      summary: `Không mở được tab "Bài tập" trên App HS (hoặc login thất bại): ${err.message}`,
      evidence: { assignment: { roomId: assignment.id, title: assignment.title } },
    };
  }

  const targetKey = `${assignment.title}|${dueDM}`;
  const { cards, stopReason, scrollCount } = collectAllVisibleHomeworkCards({
    targetMatch: {
      key: targetKey,
      expectedCount: 1,
      keyFn: (card) => (card.completed || !card.dueDateText ? null : `${card.title}|${appDueDateKeyFragment(card, dueVnYmd)}`),
    },
  });
  const scanOutcome = { stopReason, scrollCount };

  const cardsByTitle = cards.filter((c) => !c.completed && c.title === assignment.title);
  if (cardsByTitle.length === 0) {
    return {
      ok: false,
      status: "FAIL",
      classification: "HS_CARD_NOT_FOUND",
      summary: `Không thấy card nào tiêu đề "${assignment.title}" trên App HS sau khi thu thập (${scrollCount} lượt cuộn, dừng vì ${stopReason}).${
        stopReason !== "NO_NEW_CARDS" && stopReason !== "TARGET_REACHED"
          ? " CẢNH BÁO: thu thập dừng SỚM ngoài ý muốn (chưa cuộn hết) - không loại trừ khả năng card nằm ngoài phạm vi đã quét."
          : ""
      }`,
      evidence: { assignment: { roomId: assignment.id, title: assignment.title, endTime: assignment.deadline.endTime }, scanOutcome },
    };
  }

  const cardsMatchingDeadline = cardsByTitle.filter((c) => appDueDateKeyFragment(c, dueVnYmd) === dueDM);
  if (cardsMatchingDeadline.length === 0) {
    return {
      ok: false,
      status: "FAIL",
      classification: "HS_DEADLINE_MISMATCH",
      summary: `Tìm thấy card "${assignment.title}" nhưng Hạn nộp trên App HS không khớp: kỳ vọng ${formatDMY(dueVnYmd)}, thực tế card hiện "${cardsByTitle.map((c) => c.dueDateText).join(", ")}".`,
      evidence: { assignment: { roomId: assignment.id, title: assignment.title, expectedDueDate: formatDMY(dueVnYmd) }, actualDueDateTexts: cardsByTitle.map((c) => c.dueDateText), scanOutcome },
    };
  }
  if (cardsMatchingDeadline.length > 1) {
    return {
      ok: false,
      status: "BLOCKED",
      classification: "BLOCKED_AMBIGUOUS_ASSIGNMENT_MATCH",
      summary: `App HS có ${cardsMatchingDeadline.length} card giống hệt (title="${assignment.title}", hạn nộp=${formatDMY(dueVnYmd)}) - không thể xác định card nào ứng với room_id=${assignment.id} vừa giao, không đoán.`,
      evidence: {
        title: assignment.title,
        deadline: formatDMY(dueVnYmd),
        soAssignmentTrung: 1,
        roomIds: [assignment.id],
        soCardTuongUng: cardsMatchingDeadline.length,
        scanOutcome,
      },
    };
  }

  console.log(`  [PASS] Đúng 1 card khớp title+Hạn nộp - title="${cardsMatchingDeadline[0].title}" hạn nộp="${cardsMatchingDeadline[0].dueDateText}" CTA="${cardsMatchingDeadline[0].cta}".`);

  return { ok: true, assignment, card: cardsMatchingDeadline[0], scanOutcome, startVnYmd, dueVnYmd };
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
  const { assignment, card, scanOutcome, startVnYmd, dueVnYmd } = located;

  console.log('[5/5] Bấm "Làm bài" và xác nhận màn làm bài đã mở...');
  scrollToTopBeforeTap();
  try {
    tapAndOpenExercise(assignment.title, formatDM(dueVnYmd));
  } catch (err) {
    return finish({
      status: "FAIL",
      classification: "HS_EXERCISE_NOT_OPENED",
      summary: `Đã xác định đúng card ("${assignment.title}") nhưng không mở được màn làm bài (open-exercise.yaml thất bại): ${err.message}`,
      evidence: { assignment: { roomId: assignment.id, title: assignment.title }, card },
    });
  }
  const observedType = observeExerciseTypeBestEffort();
  console.log(`  [PASS] Màn làm bài đã mở (exercise_close_button visible). Loại câu hỏi quan sát được: ${observedType}.`);

  return finish({
    status: "PASS",
    summary: `GV giao bài thành công -> HS nhận đúng assignment (room_id=${assignment.id}) -> HS mở đúng bài "${assignment.title}".`,
    evidence: {
      assignment: {
        roomId: assignment.id,
        title: assignment.title,
        startTime: assignment.deadline.startTime,
        endTime: assignment.deadline.endTime,
        startTimeVn: formatDMY(startVnYmd),
        endTimeVn: formatDMY(dueVnYmd),
        classIds: assignment.classIds,
      },
      appCard: card,
      exerciseObservedType: observedType,
      scanOutcome,
    },
  });
}

// Guard giống verify-filter-web-vs-app.mjs: chỉ tự chạy main() khi file này được gọi trực tiếp,
// cho phép e2e-teacher-assign-student-lifecycle.mjs import assignHomeworkAndLocateOnApp() mà
// không vô tình kích hoạt cả main() (bấm "Làm bài" rồi dừng) của file này.
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error("\n[e2e-teacher-assign-student-open] Dừng lại vì lỗi ngoài dự kiến:\n");
    console.error(err);
    process.exit(2);
  });
}
