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
 *     quy đổi giờ VN, computeRange/inRange (business rule filter WEEK/MONTH), appDueDateKeyFragment
 *     (khoá match title+Hạn nộp), readHomeworkHierarchyOnce (1 lệnh `maestro hierarchy` DUY NHẤT
 *     dùng để phân biệt duplicate SAU KHI đã tìm thấy - KHÔNG dùng để tự cuộn/tìm nữa, xem mục
 *     "KIẾN TRÚC DISCOVERY" dưới). collectAllVisibleHomeworkCards() (swipe-ngoài+hierarchy theo
 *     TOẠ ĐỘ, budget TARGET_LOOKUP_*) VẪN CÒN trong file đó (không rollback, xem lịch sử) nhưng
 *     KHÔNG còn được import/gọi ở ĐÂY - xem lý do đo thật (~52-67s/lệnh CLI) trong docblock hằng
 *     số TARGET_LOOKUP_* của chính file đó.
 *   - flows/helpers/open-exercise.yaml (không sửa) - bước tap "Làm bài" cuối cùng + cổng xác nhận
 *     "đã vào màn làm bài" generic (`exercise_close_button`, verify KHÔNG phụ thuộc loại câu hỏi -
 *     xem comment trong chính file đó).
 *   - flows/helpers/locate-assignment-card.yaml (MỚI) - native `scrollUntilVisible` (Maestro tự
 *     cuộn bên trong 1 lần gọi CLI) tìm card theo (title, Hạn nộp DD/MM) - xem "KIẾN TRÚC
 *     DISCOVERY" dưới.
 *
 * KIẾN TRÚC DISCOVERY (2026-08-12, thay thế bản polling swipe-ngoài+`maestro hierarchy` cũ):
 *   ĐÃ ĐO THẬT (thiết bị 3201d866d40a1681, ≥25 lệnh qua 3 lần chạy sống) rằng MỖI lệnh CLI
 *   `maestro` (dù `hierarchy` hay `test` 1 flow nhỏ) tốn ~52-67s gần như CỐ ĐỊNH (chi phí khởi
 *   động lại process/kết nối ADB, không phụ thuộc độ phức tạp thao tác) - nên vòng "swipe ngoài
 *   -> đọc `maestro hierarchy` -> parse -> swipe tiếp" trả giá 1 lệnh CLI CHO MỖI LƯỢT CUỘN, quá
 *   đắt để dò sâu 1 danh sách dài. Native `scrollUntilVisible` (locate-assignment-card.yaml) cuộn
 *   NHIỀU LẦN BÊN TRONG CÙNG 1 lệnh CLI (Maestro tự lặp scroll+check nội bộ, timeout 90s) - cùng
 *   chi phí ~1 lệnh CLI nhưng không nhân theo số lượt cuộn. `maestro hierarchy` ngoài giờ CHỈ còn
 *   dùng ĐÚNG 1 LẦN, NGAY SAU KHI native locate đã assertVisible thành công - để phân biệt
 *   duplicate (App HS có ≥2 card giống hệt title+Hạn nộp không, xem BLOCKED_AMBIGUOUS_MATCH),
 *   KHÔNG dùng để tự tìm/cuộn.
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
 * quy về đúng 1 assignment vừa tạo -> BLOCKED_AMBIGUOUS_MATCH, KHÔNG tự chọn đại 1 card.
 *
 * CHỌN UNIT/LESSON/ASSIGNMENT (2026-08-12, thay hẳn bản cũ hardcode "G3-U1-Lesson 1: Listen and
 * repeat" - bài đó là Speaking nên LUÔN rơi vào BLOCKED_MISSING_EXERCISE_HANDLER, chưa từng chứng
 * minh được GV có thể giao bài KHÁC): MẶC ĐỊNH random 1 Unit thật (đọc từ Radix Select) -> random 1
 * Lesson thật của Unit đó (đọc từ các button "Lesson N") -> random 1 assignment thật của Lesson đó
 * (đọc theo dấu hiệu "Xem chi tiết"+"N câu hỏi") - xem
 * automation/giao_bai_tap/navigation/teacherAssignmentDiscovery.js (tái sử dụng heuristic đã xác
 * nhận thật trong dataDiscovery.mjs, không viết lại cách dò khác) +
 * automation/giao_bai_tap/runtime/assignHomeworkFlow.js#selectUnitLessonHomework. Unit/Lesson/
 * assignment RANDOM CHỌN ĐƯỢC PHẢI LÀ SPEAKING vẫn là 1 kết quả hợp lệ - KHÔNG được né bằng cách tự
 * chọn lại; nếu vậy, testcase downstream (HW-14_15 qua e2e-teacher-assign-student-lifecycle.mjs) sẽ
 * tự báo BLOCKED_MISSING_EXERCISE_HANDLER kèm đúng title/unit/lesson đã random, KHÔNG PASS giả.
 * ASSIGN_UNIT_NAME/ASSIGN_LESSON_NAME/ASSIGN_HOMEWORK_ITEM_NAME (xem ENV dưới) vẫn còn để ÉP CỐ
 * ĐỊNH khi cần debug/tái hiện lại 1 case cụ thể - để trống (mặc định) mới là random.
 *
 * CHẠY (cần .env có TEACHER_USERNAME/PASSWORD/TEACHER_ACCESS_TOKEN, test_data/accounts.env có
 * PHONE/OTP của học sinh lớp tương ứng, thiết bị Android đã kết nối - xem README.md):
 *   node flows/giao_bai_tap/e2e-teacher-assign-student-open.mjs
 * ENV (đều optional):
 *   ASSIGN_PRIMARY_CLASS (default "3B"), ASSIGN_OTHER_GROUP_CLASS (default "6D"),
 *   ASSIGN_DUE_DATE "DD/MM/YYYY" (default hôm nay+7 ngày),
 *   ASSIGN_UNIT_NAME/ASSIGN_LESSON_NAME/ASSIGN_HOMEWORK_ITEM_NAME (KHÔNG có default - để trống ->
 *   random thật trên UI, xem mục "CHỌN UNIT/LESSON/ASSIGNMENT" trên; chỉ set khi cần ép cố định),
 *   ASSIGN_HEADLESS (default true), ASSIGN_DEBUG_DUMP (default true - chụp screenshot khi FAIL),
 *   TARGET_CLASS_ID (default id lớp "3B", PHẢI cùng trỏ 1 lớp thật với ASSIGN_PRIMARY_CLASS),
 *   APP_ID/PHONE/OTP/MAESTRO_DEVICE - đọc .env/test_data/accounts.env giống các script khác.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
  readHomeworkHierarchyOnce,
} from "../bai_tap/verify-filter-web-vs-app.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..");
const HELPERS_DIR = join(SELF_DIR, "..", "helpers");
const OPEN_EXERCISE_FLOW = join(HELPERS_DIR, "open-exercise.yaml");
const LOCATE_ASSIGNMENT_FLOW = join(HELPERS_DIR, "locate-assignment-card.yaml");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "e2e_teacher_assign_student_open_report.json");

// ĐO THẬT (2026-08-12, thiết bị 3201d866d40a1681): mỗi lệnh CLI `maestro` ~52-67s bất kể nội
// dung - nên KHÔNG retry "native locate" hàng chục lần (mỗi lần retry vẫn là 1 lệnh CLI đầy đủ,
// gồm cả login lại). Giữ nhỏ (2) đúng yêu cầu "không retry hàng chục lần" - nếu native
// scrollUntilVisible (đã có timeout nội bộ RỘNG, 90s, đủ cho rất nhiều lượt cuộn NATIVE bên
// trong CÙNG 1 lệnh CLI đó) thất bại 2 lần độc lập, coi là bằng chứng khá chắc "không tồn tại"
// (khác hẳn bản cũ chỉ cuộn được 3-6 lần qua vòng swipe-ngoài+hierarchy trước khi hết ngân sách).
const LOCATE_MAX_ATTEMPTS = 2;

// Cùng 1 lớp thật với ASSIGN_PRIMARY_CLASS (mặc định "3B") - id lấy từ
// verify-filter-web-vs-app.mjs (đã xác nhận thật, không đoán).
const TARGET_CLASS_ID = process.env.TARGET_CLASS_ID || "b3336062-cacd-4d1a-a0af-4de44acf33d2";

const ASSIGN_PRIMARY_CLASS = process.env.ASSIGN_PRIMARY_CLASS || "3B";
// KHÔNG còn default "6D" (2026-08-13: lớp "6D" đã bị xoá khỏi tài khoản GV test - xác nhận trực
// tiếp từ user) - để trống (undefined) nghĩa là bỏ qua bước assertOtherGroupClassDisabled trong
// assignHomeworkFlow.js (tham số đã đổi thành optional), KHÔNG tự đoán 1 lớp khác khối thay thế.
const ASSIGN_OTHER_GROUP_CLASS = process.env.ASSIGN_OTHER_GROUP_CLASS || undefined;
// KHÔNG có default - để trống nghĩa là RANDOM thật trên UI (xem docblock đầu file). Chỉ set qua
// ENV khi cần ép cố định Unit/Lesson/assignment để debug/tái hiện lại 1 case cụ thể.
const ASSIGN_UNIT_NAME = process.env.ASSIGN_UNIT_NAME || undefined;
const ASSIGN_LESSON_NAME = process.env.ASSIGN_LESSON_NAME || undefined;
const ASSIGN_HOMEWORK_ITEM_NAME = process.env.ASSIGN_HOMEWORK_ITEM_NAME || undefined;
// ASSIGN_HOMEWORK_ITEM_ID (MỚI 2026-08-17, xem teacherAssignmentDiscovery.js#resolveAndSelectAssignmentById):
// id ổn định của catalog item - dùng khi caller ĐÃ BIẾT TRƯỚC Lesson mục tiêu có ≥2 item trùng
// ASSIGN_HOMEWORK_ITEM_NAME (AmbiguousAssignmentNameError) - bỏ qua hẳn so khớp theo tên, chọn
// CHẮC CHẮN đúng item. Không có default - để trống thì hành vi giữ nguyên như cũ (chọn theo tên).
const ASSIGN_HOMEWORK_ITEM_ID = process.env.ASSIGN_HOMEWORK_ITEM_ID || undefined;
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

/**
 * NATIVE locate (xem flows/helpers/locate-assignment-card.yaml) - scrollUntilVisible cuộn BÊN
 * TRONG 1 lần gọi CLI thay cho vòng swipe-ngoài+`maestro hierarchy` cũ. Throw nếu không tìm thấy
 * trong timeout nội bộ (90s) của scrollUntilVisible - caller tự quyết định retry.
 */
function runLocateAssignmentCard(title, dueDateDm, switchToMonthFilter) {
  return execFileSync(
    "maestro",
    [
      ...deviceArgs(),
      "test",
      LOCATE_ASSIGNMENT_FLOW,
      "-e",
      `APP_ID=${APP_ID}`,
      "-e",
      `PHONE=${PHONE}`,
      "-e",
      `OTP=${OTP}`,
      "-e",
      `TARGET_TITLE=${title}`,
      "-e",
      `TARGET_DUE_DATE_DM=${dueDateDm}`,
      "-e",
      `SWITCH_TO_MONTH_FILTER=${switchToMonthFilter ? "true" : "false"}`,
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
}

/** Best-effort: đọc hierarchy MỘT LẦN ngay khi 1 lượt native locate thất bại, chỉ để ghi log
 * [DISCOVERY_STALL] (title/Hạn nộp ĐANG THẤY được lúc đó) - phục vụ debug, KHÔNG dùng để quyết
 * định PASS/FAIL/BLOCKED (quyết định đó dựa trên số lần native locate thất bại, xem gọi hàm này). */
function peekVisibleCardsForStallLog(title) {
  try {
    const cards = readHomeworkHierarchyOnce();
    return cards.filter((c) => c.title === title).map((c) => ({ dueDateText: c.dueDateText, cta: c.cta }));
  } catch {
    return null;
  }
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

/** title optional: không truyền -> lấy TOÀN BỘ room của lớp (dùng làm snapshot "before" khi title
 * vừa random chọn CHƯA XÁC ĐỊNH được tại thời điểm gọi - xem assignHomeworkAndLocateOnApp). */
async function fetchClassDataset(title) {
  const rawRooms = await fetchAllHomeworkRooms({ period: "MONTH" });
  return rawRooms
    .map(normalizeHomework)
    .filter((h) => h.classIds.includes(TARGET_CLASS_ID) && (title === undefined || h.title === title));
}

/**
 * Phần DÙNG CHUNG cho mọi testcase cần "GV giao 1 bài MỚI rồi xác định ĐÚNG 1 card tương ứng trên
 * App HS": giao bài (Web GV) -> lấy metadata (diff before/after qua API) -> mở tab Bài tập trên
 * App HS -> tìm card khớp (title, Hạn nộp) DUY NHẤT. KHÔNG bấm "Làm bài" - caller (file này hoặc
 * e2e-teacher-assign-student-lifecycle.mjs) tự quyết định bước tiếp theo (mở rồi dừng, hay mở rồi
 * chạy tiếp lifecycle đầy đủ).
 *
 * @returns {Promise<{ok:false, status, classification, summary, evidence} | {ok:true, assignment, card, scanOutcome, startVnYmd, dueVnYmd, selection}>}
 */
export async function assignHomeworkAndLocateOnApp() {
  requireTeacherPortalConfig();
  if (!APP_ID) throw new Error("Thiếu APP_ID - kiểm tra .env.");
  if (!PHONE || !OTP) throw new Error("Thiếu PHONE/OTP - kiểm tra test_data/accounts.env.");

  // KHÔNG lọc theo title ở bước snapshot "before": title của assignment sẽ giao CHƯA XÁC ĐỊNH
  // được tại đây khi ASSIGN_HOMEWORK_ITEM_NAME để trống (random) - beforeIds phải là TOÀN BỘ id
  // hiện có của lớp để diff đúng sau khi biết title thật đã random chọn (xem bước [3/4]).
  console.log("[1/4] Snapshot Web GV TRƯỚC khi giao bài (toàn bộ room của lớp, để diff tìm room mới sau khi biết title vừa random)...");
  const before = await fetchClassDataset();
  const beforeIds = new Set(before.map((h) => h.id));

  console.log(
    `[2/4] Giao bài qua Web GV (Playwright): lớp=${ASSIGN_PRIMARY_CLASS}, hạn nộp=${ASSIGN_DUE_DATE}${
      ASSIGN_HOMEWORK_ITEM_NAME
        ? `, bài (ép cố định qua ENV)="${ASSIGN_HOMEWORK_ITEM_NAME}"`
        : " (Unit/Lesson/assignment RANDOM trên dữ liệu thật, xem docblock đầu file)"
    }...`,
  );
  const assignResult = await assignHomeworkFlow({
    primaryClass: ASSIGN_PRIMARY_CLASS,
    otherGroupClass: ASSIGN_OTHER_GROUP_CLASS,
    dueDate: ASSIGN_DUE_DATE,
    unitName: ASSIGN_UNIT_NAME,
    lessonName: ASSIGN_LESSON_NAME,
    homeworkItemName: ASSIGN_HOMEWORK_ITEM_NAME,
    homeworkItemId: ASSIGN_HOMEWORK_ITEM_ID,
    headless: ASSIGN_HEADLESS,
    debugDump: ASSIGN_DEBUG_DUMP,
  });

  // selection phản ánh Unit/Lesson/assignment THẬT đã dùng (random hoặc ép cố định) - bước
  // selectUnitLessonHomework luôn chạy TRƯỚC bước submit nên selection có giá trị kể cả khi giao
  // bài thất bại ở bước sau đó (submitAssign) - log NGAY ở đây, trước khi biết PASS/FAIL, để mọi
  // lần chạy đều để lại bằng chứng đã random cái gì.
  const selection = assignResult.selection || {};
  console.log(`[RANDOM_SELECTION]`);
  console.log(`unit: ${selection.unitName ?? "unknown"}`);
  console.log(`lesson: ${selection.lessonName ?? "unknown"}`);
  console.log(`assignment: ${selection.homeworkItemName ?? "unknown"}`);
  console.log(`exerciseId: ${selection.exerciseId ?? "unknown"}`);
  console.log(`type: ${selection.type ?? "unknown"}`);
  console.log(`questionCount: ${selection.questionCount ?? "unknown"}`);

  if (assignResult.status !== "PASS") {
    const failedStep = assignResult.steps.find((s) => s.status === "FAIL");
    // "resolveAssignmentSelection" fail = cây eligible rỗng (BLOCKED_NO_ELIGIBLE_ASSIGNMENT, xem
    // navigation/teacherAssignmentApiDiscovery.js#pickRandomEligibleAssignment) - phân biệt với
    // GV_ASSIGNMENT_FAILED (fail ở bước UI khác) bằng dò marker trong message, cùng quy ước đã
    // dùng cho BLOCKED_MISSING_EXERCISE_HANDLER ở e2e-teacher-assign-student-lifecycle.mjs.
    const isNoEligible = (assignResult.error || "").includes("BLOCKED_NO_ELIGIBLE_ASSIGNMENT");
    const classification = isNoEligible
      ? "BLOCKED_NO_ELIGIBLE_ASSIGNMENT"
      : failedStep?.name === "submitAssign"
        ? "GV_SUCCESS_MESSAGE_MISSING"
        : "GV_ASSIGNMENT_FAILED";
    console.log(`[TEACHER_ASSIGN]\n${isNoEligible ? "BLOCKED" : "FAIL"}`);
    return {
      ok: false,
      status: isNoEligible ? "BLOCKED" : "FAIL",
      classification,
      summary: isNoEligible
        ? "Không còn Unit/Lesson/assignment nào thực sự có exam để random trong bộ sách 'Kết nối tri thức' của lớp này (xem evidence.error để biết chi tiết cây eligible tại thời điểm chạy)."
        : classification === "GV_SUCCESS_MESSAGE_MISSING"
          ? `Bấm "Giao bài đã chọn" nhưng không thấy toast "Giao bài tập mới thành công" (hoặc bấm nút thất bại) trong 15s. Unit/Lesson/assignment đã chọn trước khi fail: unit="${selection.unitName}" lesson="${selection.lessonName}" assignment="${selection.homeworkItemName}".`
          : `Giao bài thất bại ở bước "${failedStep?.name}" (trước khi tới bước bấm giao bài).`,
      evidence: { steps: assignResult.steps, error: assignResult.error, selection },
    };
  }
  console.log(`  [PASS] Toast "Giao bài tập mới thành công" đã hiện - Web GV giao bài OK.`);
  console.log(`[TEACHER_ASSIGN]\nPASS`);

  console.log("[3/4] Lấy metadata assignment vừa tạo (diff before/after qua API room.json)...");
  let after = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    after = await fetchClassDataset(selection.homeworkItemName);
    if (after.some((h) => !beforeIds.has(h.id))) break;
    if (attempt < 3) {
      console.log(`  Chưa thấy room mới (lần ${attempt}/3) - chờ 3s rồi thử lại (API có thể chưa kịp cập nhật)...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  const newRooms = after.filter((h) => !beforeIds.has(h.id));

  if (newRooms.length === 0) {
    console.log(`[APP_MATCH]\nBLOCKED`);
    return {
      ok: false,
      status: "BLOCKED",
      classification: "ASSIGNMENT_METADATA_MISSING",
      summary: `Web GV báo giao bài thành công nhưng không tìm thấy room mới nào qua GET /api/user/exams/room.json (lớp=${TARGET_CLASS_ID}, title="${selection.homeworkItemName}") sau 3 lần thử.`,
      evidence: { beforeCount: before.length, afterCount: after.length, selection },
    };
  }
  if (newRooms.length > 1) {
    console.log(`[APP_MATCH]\nBLOCKED`);
    return {
      ok: false,
      status: "BLOCKED",
      classification: "BLOCKED_AMBIGUOUS_ASSIGNMENT_MATCH",
      summary: `Web GV tạo ${newRooms.length} room MỚI cùng title+lớp sau 1 lượt giao bài (nghi vấn bug double-submit đã ghi nhận ở flows/giao_bai_tap/TESTCASES.md) - không thể xác định đâu là "đúng 1" assignment vừa giao để đối chiếu App HS, không đoán.`,
      evidence: {
        title: selection.homeworkItemName,
        deadline: newRooms.map((r) => formatDMY(isoToVnYmd(r.deadline.endTime))),
        soAssignmentTrung: newRooms.length,
        roomIds: newRooms.map((r) => r.id),
        selection,
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

  // Không có selector/helper cho icon "thông báo" trong app (đã xác nhận CHƯA tự động hoá được ở
  // flows/teacher/testcases/teacher-assign-homework-success.yaml, automation/README.md và
  // assignHomeworkFlow.js/giao_bai_tap/cli.js - Playwright không điều khiển được app mobile). Vì
  // vậy dùng chính bước tìm-đúng-card-chưa-hoàn-thành dưới đây làm proxy cho "trạng thái assignment
  // mới theo UI thực tế" (card của bài vừa giao xuất hiện, CTA còn "Làm bài"/chưa "Làm lại").
  //
  // KIẾN TRÚC (2026-08-12, thay thế bản polling swipe-ngoài+`maestro hierarchy` cũ): ĐÃ ĐO THẬT
  // trên thiết bị 3201d866d40a1681 rằng MỖI lệnh CLI `maestro` (dù `hierarchy` hay `test` 1 flow
  // nhỏ) tốn ~52-67s gần như CỐ ĐỊNH (chi phí khởi động lại process/ADB, không phụ thuộc độ phức
  // tạp thao tác) - nên vòng "swipe ngoài -> hierarchy -> parse -> swipe tiếp" trả giá 1 lệnh CLI
  // CHO MỖI LƯỢT CUỘN. Native `scrollUntilVisible` (flows/helpers/locate-assignment-card.yaml)
  // cuộn NHIỀU LẦN BÊN TRONG CÙNG 1 lệnh CLI đó (Maestro tự lặp scroll+check nội bộ) - cùng chi
  // phí ~1 lệnh CLI nhưng cuộn được sâu hơn nhiều, không nhân với số lượt cuộn. `maestro hierarchy`
  // ngoài giờ CHỈ còn dùng ĐÚNG 1 LẦN, SAU KHI native locate đã xác nhận tìm thấy - để phân biệt
  // duplicate (BLOCKED_AMBIGUOUS_ASSIGNMENT_MATCH), không phải để tự tìm/cuộn.
  console.log("[4/4] App HS: native scroll (Maestro scrollUntilVisible) tìm đúng card vừa giao (proxy cho notification - xem comment)...");
  const weekRange = computeRange("WEEK");
  const switchToMonthFilter = !inRange(dueVnYmd, weekRange.rangeStart, weekRange.rangeEnd);
  if (switchToMonthFilter) {
    console.log(`  Hạn nộp (${formatDMY(dueVnYmd)}) ngoài "2 tuần gần nhất" - flow locate sẽ tự đổi filter sang "1 tháng gần nhất".`);
  }

  const discoveryStartedAt = Date.now();
  let locateError = null;
  let locateAttempts = 0;
  const stallLog = [];
  for (; locateAttempts < LOCATE_MAX_ATTEMPTS; locateAttempts++) {
    try {
      runLocateAssignmentCard(assignment.title, dueDM, switchToMonthFilter);
      locateError = null;
      break;
    } catch (err) {
      locateError = err;
      const visibleSameTitle = peekVisibleCardsForStallLog(assignment.title);
      const entry = {
        target: `${assignment.title}|${dueDM}`,
        scroll_attempt: locateAttempts + 1,
        elapsed_ms: Date.now() - discoveryStartedAt,
        last_visible_due_dates: visibleSameTitle ? visibleSameTitle.map((c) => c.dueDateText) : null,
        last_visible_titles: visibleSameTitle ? visibleSameTitle.map(() => assignment.title) : null,
      };
      stallLog.push(entry);
      console.log(`[DISCOVERY_STALL] ${JSON.stringify(entry)}`);
    }
  }

  if (locateError) {
    // 2 lần native locate ĐỘC LẬP đều thất bại, MỖI lần scrollUntilVisible đã có timeout nội bộ
    // rộng (90s, đủ cho rất nhiều lượt cuộn native) - đây là bằng chứng khá chắc "không tồn tại"
    // (KHÁC bản cũ chỉ cuộn được vài lượt qua vòng swipe-ngoài+hierarchy trước khi hết ngân sách
    // nhỏ) -> BLOCKED_ASSIGNMENT_NOT_FOUND, KHÔNG phải BLOCKED_DISCOVERY_BUDGET_EXCEEDED.
    console.log(`[APP_MATCH]\nBLOCKED`);
    return {
      ok: false,
      status: "BLOCKED",
      classification: "BLOCKED_ASSIGNMENT_NOT_FOUND",
      summary: `Không tìm thấy card "${assignment.title}" / Hạn nộp ${formatDMY(dueVnYmd)} trên App HS sau ${LOCATE_MAX_ATTEMPTS} lượt native locate độc lập (mỗi lượt scrollUntilVisible timeout nội bộ 90s) - xem [DISCOVERY_STALL] để biết card/Hạn nộp thực tế đang thấy tại thời điểm thất bại.`,
      evidence: {
        assignment: { roomId: assignment.id, title: assignment.title, endTime: assignment.deadline.endTime },
        stallLog,
        lastError: locateError.message,
        selection,
      },
    };
  }

  console.log(`  [PASS] Native scroll tìm thấy đúng cặp title+Hạn nộp sau ${locateAttempts + 1} lượt "maestro test" locate.`);

  // ĐÚNG 1 lệnh `maestro hierarchy` - CHỈ để lấy card object cho report + phân biệt duplicate
  // (App HS có ≥2 card giống hệt title+Hạn nộp không) - KHÔNG dùng để tự tìm/cuộn (đã xong ở trên).
  const hierarchyCards = readHomeworkHierarchyOnce();
  const cardsMatchingDeadline = hierarchyCards.filter(
    (c) => !c.completed && c.title === assignment.title && appDueDateKeyFragment(c, dueVnYmd) === dueDM,
  );
  const scanOutcome = { method: "NATIVE_SCROLL", nativeLocateAttempts: locateAttempts + 1, hierarchyCallCount: 1 };

  if (cardsMatchingDeadline.length === 0) {
    // Hiếm: native locate VỪA assertVisible thành công nhưng lượt `maestro hierarchy` đọc lại
    // (2 lệnh CLI riêng, có khoảng trễ giữa 2 lần) không thấy - CHƯA ĐỦ BẰNG CHỨNG để khẳng định
    // không tồn tại (native đã CONFIRM tồn tại ngay trước đó) -> BLOCKED_DISCOVERY_BUDGET_EXCEEDED,
    // không phải BLOCKED_ASSIGNMENT_NOT_FOUND (sẽ mâu thuẫn với việc native vừa mới xác nhận thấy).
    console.log(`[APP_MATCH]\nBLOCKED`);
    return {
      ok: false,
      status: "BLOCKED",
      classification: "BLOCKED_DISCOVERY_BUDGET_EXCEEDED",
      summary: `Native locate đã assertVisible thành công cho "${assignment.title}" / Hạn nộp ${formatDMY(dueVnYmd)} nhưng lệnh "maestro hierarchy" đọc lại ngay sau đó không thấy card này (có thể do timing giữa 2 lệnh CLI riêng) - không đủ bằng chứng để khẳng định không tồn tại.`,
      evidence: {
        assignment: { roomId: assignment.id, title: assignment.title, expectedDueDate: formatDMY(dueVnYmd) },
        scanOutcome,
        selection,
      },
    };
  }
  if (cardsMatchingDeadline.length > 1) {
    console.log(`[APP_MATCH]\nBLOCKED`);
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
        selection,
      },
    };
  }

  console.log(`  [PASS] Đúng 1 card khớp title+Hạn nộp - title="${cardsMatchingDeadline[0].title}" hạn nộp="${cardsMatchingDeadline[0].dueDateText}" CTA="${cardsMatchingDeadline[0].cta}".`);
  console.log(`[APP_MATCH]\nPASS`);

  return { ok: true, assignment, card: cardsMatchingDeadline[0], scanOutcome, startVnYmd, dueVnYmd, selection };
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
  const { assignment, card, scanOutcome, startVnYmd, dueVnYmd, selection } = located;

  // KHÔNG scroll-to-top trước khi gọi open-exercise.yaml (bản cũ cần vì collector cũ có thể đã
  // cuộn rất sâu) - native locate-assignment-card.yaml vừa để app ĐỨNG YÊN tại đúng vị trí target
  // đang hiển thị, scrollUntilVisible DOWN của open-exercise.yaml thấy ngay, không cần cuộn lại.
  console.log('[5/5] Bấm "Làm bài" và xác nhận màn làm bài đã mở...');
  try {
    tapAndOpenExercise(assignment.title, formatDM(dueVnYmd));
  } catch (err) {
    return finish({
      status: "FAIL",
      classification: "HS_EXERCISE_NOT_OPENED",
      summary: `Đã xác định đúng card ("${assignment.title}") nhưng không mở được màn làm bài (open-exercise.yaml thất bại): ${err.message}`,
      evidence: { assignment: { roomId: assignment.id, title: assignment.title }, card, selection },
    });
  }
  const observedType = observeExerciseTypeBestEffort();
  console.log(`  [PASS] Màn làm bài đã mở (exercise_close_button visible). Loại câu hỏi quan sát được: ${observedType}.`);

  // GHI CHÚ (yêu cầu "expose fixture cho HW-14_15"): selection + assignment ở đây là NGUỒN SỰ
  // THẬT duy nhất cho assignment vừa random giao - e2e-teacher-assign-student-lifecycle.mjs tái sử
  // dụng CHÍNH assignHomeworkAndLocateOnApp() này (import, không lặp lại logic) nên tự động nhận
  // được cùng fixture khi cần chạy tiếp lifecycle đầy đủ (mở -> thoát -> resume -> hoàn thành).
  return finish({
    status: "PASS",
    summary: `GV giao bài thành công (unit="${selection.unitName}", lesson="${selection.lessonName}") -> HS nhận đúng assignment (room_id=${assignment.id}) -> HS mở đúng bài "${assignment.title}".`,
    evidence: {
      selection,
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
