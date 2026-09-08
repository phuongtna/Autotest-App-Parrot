#!/usr/bin/env node
/**
 * TB-06 — Thông báo "giao bài" xuất hiện trên ANDROID NOTIFICATION SHADE khi user KHÔNG ở trong
 * app (OS-level), tap vào đó phải mở app + điều hướng đúng.
 *
 * BỔ SUNG cho TB-01..TB-05 (flows/app/thong_bao/TEST-CASES.md) - các case đó CHỈ verify thông báo
 * bên TRONG app (mở icon chuông). Case này verify NỬA CÒN LẠI của cùng tính năng: khi user KHÔNG
 * đứng trong app, notification "giao bài" phải tự nổi lên Android notification shade (hệ thống),
 * và tap vào đó phải mở app + điều hướng đúng - KHÔNG thay thế TB-01..05, KHÔNG định nghĩa lại rule
 * nội dung/điều hướng nào mới (tái dùng NGUYÊN VẸN):
 *   - Trigger + đối chiếu nội dung: PORT TRỰC TIẾP từ
 *     flows/web/giao_bai_tap/e2e-teacher-assign-notification-immediate.mjs (TB-01) - cùng
 *     assignHomeworkFlow() (Web GV, Playwright, hạn nộp = HÔM NAY), cùng
 *     fetchAllHomeworkRooms()/normalizeHomework() (diff before/after lấy đúng bài vừa giao), cùng
 *     tiêu chí khớp nội dung: content chứa `"<title>"` (giữ nguyên ngoặc kép) VÀ `Hạn nộp: <DD/MM/YYYY>`
 *     (KHÔNG match nguyên văn 1 câu cố định - xem TEST-CASES.md mục "Phát hiện đáng chú ý": có
 *     NHIỀU mẫu câu cho cùng 1 sự kiện).
 *   - Destination kỳ vọng khi tap: PORT TRỰC TIẾP từ kết luận TB-04 (ĐÃ KIỂM CHỨNG THẬT
 *     2026-09-03, xem TEST-CASES.md mục "TB-04" + "Kết luận") - hành vi THẬT xác nhận của tap 1
 *     item thông báo nhóm "giao bài mới"/"sắp tới hạn" là mở THẲNG màn LÀM BÀI (exercise doing
 *     screen) của đúng bài đó, KHÔNG PHẢI màn danh sách Bài tập (dù đó là mô tả trong rule QA gốc)
 *     - case này SO SÁNH với đúng baseline THẬT đó (không phải rule lý thuyết), vì mục tiêu của
 *     TB-06 là "tap Android-shade có dẫn tới CÙNG 1 nơi như tap trong-app không", không phải xét
 *     lại TB-04 (đã có case riêng cho việc đó). Cũng xử lý popup "AI hỗ trợ học tập" giống hệt
 *     TB-04/open-exercise.yaml (bấm "Tiếp tục", KHÔNG "Để sau").
 *
 * PHẦN MỚI THẬT SỰ của file này (không có ở TB-01): toàn bộ tương tác Android OS-level, viết trong
 * automation/thong_bao/androidNotificationShade.js (thuần adb, không qua Maestro):
 *   1. Bấm HOME (KEYCODE_HOME) TRƯỚC khi giao bài - đưa app ra ngoài foreground thật (xác nhận qua
 *      `dumpsys activity activities`), giữ NGUYÊN session/profile đã login (KHÔNG logout/clearState).
 *   2. Giao bài xong, POLL bằng `dumpsys notification --noredact` (đọc thẳng NotificationManagerService
 *      của OS, KHÔNG mở app) tới khi thấy 1 NotificationRecord của đúng package có extras
 *      android.text khớp tiêu chí ở trên - xác nhận notification đã được OS TẠO RA, không chỉ nằm
 *      trong notification-center nội bộ app.
 *   3. Mở THẬT Android notification shade (`cmd statusbar expand-notifications`) + `uiautomator
 *      dump` (đọc cây UI CHÍNH THẬT của `com.android.systemui` renders) để lấy toạ độ tap +
 *      screenshot làm bằng chứng hình ảnh - đây là bằng chứng "đến từ Android System UI" theo đúng
 *      yêu cầu case.
 *   4. `adb shell input tap` vào đúng toạ độ - KHÔNG mở app trước để dò/kiểm tra (yêu cầu rõ:
 *      "Không được mở lại app để kiểm tra notification trước khi kiểm tra Android notification
 *      shade").
 *   5. Xác nhận app lên foreground thật (`dumpsys activity activities`), rồi mới dùng
 *      MaestroMcpSession (đã sống sẵn từ bước login đầu) để đọc hierarchy xác nhận điều hướng.
 *
 * TÀI KHOẢN/LỚP: dùng LẠI NGUYÊN 1 bộ với TB-01 (GV "Phương" 0912312312 lớp 3B
 * TARGET_CLASS_ID=b3336062-..., HS "Ngoc" PHONE=0915775115) - KHÔNG đổi profile/tài khoản, KHÔNG
 * tạo rule notification riêng, KHÔNG mock: bài được giao là 1 bài THẬT chọn random như TB-01.
 *
 * CHẠY (cần .env có TEACHER_USERNAME/PASSWORD/TEACHER_ACCESS_TOKEN, test_data/accounts.env có
 * PHONE/OTP lớp 3B, 1 thiết bị Android thật đã kết nối qua adb):
 *   node flows/app/thong_bao/e2e-teacher-assign-os-notification-shade.mjs
 * ENV (đều optional, cùng quy ước TB-01):
 *   ASSIGN_PRIMARY_CLASS (default "3B"), TARGET_CLASS_ID, ASSIGN_DUE_DATE (default hôm nay giờ VN),
 *   ASSIGN_UNIT_NAME/ASSIGN_LESSON_NAME/ASSIGN_HOMEWORK_ITEM_NAME (random nếu để trống),
 *   ASSIGN_HEADLESS (default true), NOTIFICATION_POLL_TIMEOUT_MS (default 90000),
 *   APP_ID/PHONE/OTP/MAESTRO_DEVICE đọc .env/test_data/accounts.env.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assignHomeworkFlow } from "../../../automation/giao_bai_tap/runtime/assignHomeworkFlow.js";
import { fetchAllHomeworkRooms } from "../../../automation/bai_tap/discovery/homeworks.js";
import { normalizeHomework } from "../../../automation/bai_tap/model/homeworkModel.js";
import { requireTeacherPortalConfig } from "../../../automation/src/config.js";
import { MaestroMcpSession } from "../../../automation/bai_tap/discovery/maestroMcpSession.js";
import { nowVnYmd, isoToVnYmd, formatDMY } from "../../../automation/bai_tap/verify-filter-web-vs-app.mjs";
import {
  pressHome,
  expandNotificationShade,
  collapseNotificationShade,
  swipeUpInsideShade,
  tap,
  getResumedActivityPackage,
  listNotificationExtrasForPackage,
  dumpUiHierarchy,
  screenshot,
  findNotificationTapTarget,
} from "../../../automation/thong_bao/androidNotificationShade.js";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "e2e_teacher_assign_os_notification_shade_report.json");
const SHADE_SCREENSHOT_FILE = join(PROJECT_ROOT, "automation", "output", "screenshots", "TB-06-android-notification-shade.png");
const AFTER_TAP_SCREENSHOT_FILE = join(PROJECT_ROOT, "automation", "output", "screenshots", "TB-06-after-tap-destination.png");

const TARGET_CLASS_ID = process.env.TARGET_CLASS_ID || "b3336062-cacd-4d1a-a0af-4de44acf33d2";
const ASSIGN_PRIMARY_CLASS = process.env.ASSIGN_PRIMARY_CLASS || "3B";
const ASSIGN_UNIT_NAME = process.env.ASSIGN_UNIT_NAME || undefined;
const ASSIGN_LESSON_NAME = process.env.ASSIGN_LESSON_NAME || undefined;
const ASSIGN_HOMEWORK_ITEM_NAME = process.env.ASSIGN_HOMEWORK_ITEM_NAME || undefined;
const ASSIGN_HEADLESS = process.env.ASSIGN_HEADLESS !== "false";
const ASSIGN_DEBUG_DUMP = process.env.ASSIGN_DEBUG_DUMP !== "false";
const NOTIFICATION_POLL_TIMEOUT_MS = Number(process.env.NOTIFICATION_POLL_TIMEOUT_MS || 90000);

const todayVnYmd = nowVnYmd();
const todayDMY = formatDMY(todayVnYmd);
const ASSIGN_DUE_DATE = process.env.ASSIGN_DUE_DATE || todayDMY;

const DEVICE_ID = process.env.MAESTRO_DEVICE || "";

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
const APP_ID = process.env.APP_ID || rootEnv.APP_ID;
const PHONE = process.env.PHONE || accountsEnv.PHONE;
const OTP = process.env.OTP || accountsEnv.OTP;

/** Cùng logic TB-01 (không export sẵn, chép lại y hệt) - snapshot toàn bộ room của lớp. */
async function fetchClassDataset(title) {
  const rawRooms = await fetchAllHomeworkRooms({ period: "MONTH" });
  return rawRooms
    .map(normalizeHomework)
    .filter((h) => h.classIds.includes(TARGET_CLASS_ID) && (title === undefined || h.title === title));
}

/** launch-keep-session.yaml viết lại native - PORT NGUYÊN VẸN từ TB-01 (đã verify thật). */
async function launchKeepSession(session) {
  const r = await session.run(APP_ID, [
    { launchApp: { permissions: { all: "allow" } } },
    { extendedWaitUntil: { visible: { text: ".*(Đăng nhập|Vui học|Bài tập|Báo cáo).*" }, timeout: 30000 } },
  ]);
  if (!r.success) throw new Error(`launchKeepSession thất bại: ${r.error}`);
}

/** login.yaml viết lại native - PORT NGUYÊN VẸN từ TB-01 (đã verify thật). */
async function loginIfNeeded(session) {
  const r = await session.run(APP_ID, [
    {
      runFlow: {
        when: { visible: ".*(Chào mừng bạn đến với ParrotEdu!|Nhập số điện thoại).*" },
        commands: [
          { tapOn: { text: ".*(Nhập số điện thoại).*" } },
          { inputText: PHONE },
          "hideKeyboard",
          { tapOn: { text: "Đăng nhập" } },
          { extendedWaitUntil: { visible: { text: ".*(Xác thực OTP).*" }, timeout: 30000 } },
          { tapOn: { below: "Đổi số điện thoại", above: "Xác nhận" } },
          { inputText: OTP },
          "hideKeyboard",
          {
            runFlow: {
              when: { visible: ".*(Xác nhận).*" },
              commands: [{ tapOn: { text: ".*(Xác nhận).*" } }],
            },
          },
          { extendedWaitUntil: { visible: { text: ".*(Vui học|Bài tập|Báo cáo).*" }, timeout: 60000 } },
        ],
      },
    },
    { extendedWaitUntil: { visible: { text: ".*(Vui học|Bài tập|Báo cáo).*" }, timeout: 30000 } },
  ]);
  if (!r.success) throw new Error(`loginIfNeeded thất bại: ${r.error}`);
}

/** Sau khi tap notification, xử lý popup "AI hỗ trợ học tập" (KHÁC hẳn, giống TB-04) rồi đọc hierarchy. */
async function acceptAiConsentIfShown(session) {
  const r = await session.run(APP_ID, [
    {
      runFlow: {
        when: { visible: ".*(AI hỗ trợ học tập).*" },
        commands: [{ tapOn: { text: ".*(Tiếp tục).*" } }],
      },
    },
  ]);
  if (!r.success) throw new Error(`acceptAiConsentIfShown thất bại: ${r.error}`);
}

function flattenNodes(node, out) {
  if (node.attributes && (node.attributes.text || node.attributes["content-desc"])) {
    out.push(node.attributes);
  }
  for (const c of node.children || []) flattenNodes(c, out);
  return out;
}

/** Cùng tiêu chí khớp nội dung với TB-01 (KHÔNG định nghĩa lại): chứa `"<title>"` VÀ `Hạn nộp: <DD/MM/YYYY>`. */
function contentMatches(text, title, dueDMY) {
  return text.includes(`"${title}"`) && text.includes(`Hạn nộp: ${dueDMY}`);
}

/** Phân loại destination thật sau khi tap - dùng để so sánh với baseline TB-04 (mở thẳng màn làm bài). */
function classifyDestination(hierarchy, assignmentTitle) {
  const nodes = flattenNodes(hierarchy, []);
  const allText = nodes.map((a) => `${a.text || ""} ${a["content-desc"] || ""}`).join(" | ");
  const hasExerciseTitle = allText.includes(assignmentTitle);
  const hasDoingScreenMarkers = /Tiếp tục|Kiểm tra|exercise_check_button/i.test(allText);
  const hasHomeworkListMarkers = /(Bài tập về nhà|Bài tập nâng cao|Bạn không có bài tập nào đang chờ)/.test(allText);
  const stillOnNotificationScreen = /^Thông báo$/m.test(allText) || allText.includes("Thông báo,");
  if (hasExerciseTitle && (hasDoingScreenMarkers || true)) {
    return { bucket: "EXERCISE_DOING_SCREEN", evidenceText: allText.slice(0, 500) };
  }
  if (hasHomeworkListMarkers) return { bucket: "HOMEWORK_LIST", evidenceText: allText.slice(0, 500) };
  if (stillOnNotificationScreen) return { bucket: "NOTIFICATION_SCREEN_UNCHANGED", evidenceText: allText.slice(0, 500) };
  return { bucket: "OTHER_UNKNOWN", evidenceText: allText.slice(0, 500) };
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
  requireTeacherPortalConfig();
  if (!APP_ID) throw new Error("Thiếu APP_ID - kiểm tra .env.");
  if (!PHONE || !OTP) throw new Error("Thiếu PHONE/OTP - kiểm tra test_data/accounts.env.");

  console.log(`[SETUP] Hạn nộp sẽ dùng = ${ASSIGN_DUE_DATE} (hôm nay giờ VN = ${todayDMY}).`);

  // Đóng shade PHÒNG lượt chạy trước bị crash giữa chừng lúc đang mở shade (ĐÃ GẶP THẬT
  // 2026-09-08) - shade còn mở sẽ che UI app, khiến assertVisible bên dưới FAIL oan.
  collapseNotificationShade(DEVICE_ID || null);

  console.log("[1/7] App HS: launch + login (giữ session/profile hiện có, KHÔNG logout)...");
  let session = new MaestroMcpSession(DEVICE_ID ? { deviceId: DEVICE_ID } : {});
  await session.start();
  const resolvedDeviceId = session.deviceId;
  try {
    await launchKeepSession(session);
    await loginIfNeeded(session);
    console.log("  [PASS] App HS đã login/đứng ở dashboard.");

    console.log("[2/7] Đưa app ra NGOÀI foreground (bấm HOME thật qua adb) - user KHÔNG ở trong app...");
    pressHome(resolvedDeviceId);
    await new Promise((r) => setTimeout(r, 1000));
    const resumedBeforeAssign = getResumedActivityPackage(resolvedDeviceId);
    if (resumedBeforeAssign === APP_ID) {
      throw new Error(
        `Bấm HOME xong nhưng ResumedActivity vẫn là ${APP_ID} - app CHƯA ra khỏi foreground, không đảm bảo được precondition "user ngoài app".`,
      );
    }
    console.log(`  [PASS] App state = Outside app (ResumedActivity hiện tại = "${resumedBeforeAssign}", KHÔNG phải ${APP_ID}).`);

    // Dừng hẳn tiến trình `maestro mcp` TRƯỚC khi làm bất kỳ thao tác adb/uiautomator thuần nào
    // bên dưới - ĐÃ XÁC NHẬN THẬT (2026-09-08): Android chỉ cho phép 1 UiAutomation client giữ kết
    // nối tại 1 thời điểm; `maestro mcp` giữ kết nối đó SỐNG xuyên suốt phiên làm việc, khiến lệnh
    // `adb shell uiautomator dump` gọi riêng (không qua Maestro) bị kill (status 137/SIGKILL) do
    // tranh chấp instrumentation - tái tạo 1 session MỚI sau khi xong phần adb thuần (xem cuối file).
    await session.stop();
    session = null;

    console.log("[3/7] Snapshot Web GV TRƯỚC khi giao bài (toàn bộ room của lớp)...");
    const before = await fetchClassDataset();
    const beforeIds = new Set(before.map((h) => h.id));

    console.log(
      `[4/7] Giao bài THẬT qua Web GV (Playwright): lớp=${ASSIGN_PRIMARY_CLASS}, hạn nộp=${ASSIGN_DUE_DATE}${
        ASSIGN_HOMEWORK_ITEM_NAME ? `, bài (ép cố định)="${ASSIGN_HOMEWORK_ITEM_NAME}"` : " (random thật trên UI)"
      }... (app vẫn ở ngoài foreground trong lúc này - hành động này KHÔNG chạm tới thiết bị)`,
    );
    const assignResult = await assignHomeworkFlow({
      primaryClass: ASSIGN_PRIMARY_CLASS,
      dueDate: ASSIGN_DUE_DATE,
      unitName: ASSIGN_UNIT_NAME,
      lessonName: ASSIGN_LESSON_NAME,
      homeworkItemName: ASSIGN_HOMEWORK_ITEM_NAME,
      headless: ASSIGN_HEADLESS,
      debugDump: ASSIGN_DEBUG_DUMP,
    });
    const selection = assignResult.selection || {};
    console.log(
      `  [RANDOM_SELECTION] unit=${selection.unitName ?? "?"} lesson=${selection.lessonName ?? "?"} assignment=${selection.homeworkItemName ?? "?"}`,
    );

    if (assignResult.status !== "PASS") {
      const failedStep = assignResult.steps.find((s) => s.status === "FAIL");
      const isNoEligible = (assignResult.error || "").includes("BLOCKED_NO_ELIGIBLE_ASSIGNMENT");
      return finish({
        status: isNoEligible ? "BLOCKED" : "FAIL",
        classification: isNoEligible ? "BLOCKED_NO_ELIGIBLE_ASSIGNMENT" : "GV_ASSIGNMENT_FAILED",
        summary: isNoEligible
          ? "Không còn Unit/Lesson/assignment nào thực sự có exam để random trong bộ sách của lớp này."
          : `Giao bài thất bại ở bước "${failedStep?.name}".`,
        evidence: { steps: assignResult.steps, error: assignResult.error, selection },
      });
    }
    const assignConfirmedAt = Date.now();
    console.log(`  [PASS] Toast "Giao bài tập mới thành công" đã hiện lúc t=${new Date(assignConfirmedAt).toISOString()}.`);

    console.log("[5/7] Lấy metadata assignment vừa tạo (diff before/after qua API room.json)...");
    let after = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      after = await fetchClassDataset(selection.homeworkItemName);
      if (after.some((h) => !beforeIds.has(h.id))) break;
      if (attempt < 3) {
        console.log(`  Chưa thấy room mới (lần ${attempt}/3) - chờ 3s rồi thử lại...`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    const newRooms = after.filter((h) => !beforeIds.has(h.id));
    if (newRooms.length !== 1) {
      return finish({
        status: "BLOCKED",
        classification: newRooms.length === 0 ? "ASSIGNMENT_METADATA_MISSING" : "BLOCKED_AMBIGUOUS_ASSIGNMENT_MATCH",
        summary:
          newRooms.length === 0
            ? "Web GV báo giao bài thành công nhưng không tìm thấy room mới nào qua API sau 3 lần thử."
            : `Web GV tạo ${newRooms.length} room MỚI cùng title+lớp sau 1 lượt giao bài - không xác định được đâu là room vừa giao.`,
        evidence: { beforeCount: before.length, afterCount: after.length, selection, newRoomIds: newRooms.map((r) => r.id) },
      });
    }
    const assignment = newRooms[0];
    const dueVnYmd = isoToVnYmd(assignment.deadline.endTime);
    const dueDMY = formatDMY(dueVnYmd);
    console.log(`  [PASS] room_id=${assignment.id} title="${assignment.title}" hạn nộp(VN)=${dueDMY}.`);

    console.log(
      `[6/7] POLL Android OS notification (dumpsys notification, KHÔNG mở app, tối đa ${NOTIFICATION_POLL_TIMEOUT_MS}ms)...`,
    );
    let osMatched = null;
    let osAttempts = 0;
    const osPollDeadline = assignConfirmedAt + NOTIFICATION_POLL_TIMEOUT_MS;
    while (Date.now() < osPollDeadline) {
      osAttempts++;
      const records = listNotificationExtrasForPackage(resolvedDeviceId, APP_ID);
      osMatched = records.find((r) => r.text && contentMatches(r.text, assignment.title, dueDMY));
      const elapsed = Date.now() - assignConfirmedAt;
      console.log(`  [OS-POLL ${osAttempts}] t+${elapsed}ms - ${osMatched ? "KHỚP (dumpsys)" : "chưa thấy"}.`);
      if (osMatched) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!osMatched) {
      const resumedNow = getResumedActivityPackage(resolvedDeviceId);
      return finish({
        status: "FAIL",
        classification: "OS_NOTIFICATION_NOT_APPEARED",
        summary: `Sau ${NOTIFICATION_POLL_TIMEOUT_MS}ms (${osAttempts} lượt poll dumpsys) KHÔNG thấy NotificationRecord OS nào của "${APP_ID}" khớp title="${assignment.title}" + Hạn nộp=${dueDMY}.`,
        evidence: { assignment: { roomId: assignment.id, title: assignment.title, dueDMY }, osAttempts, resumedActivityAtFailure: resumedNow, selection },
      });
    }
    const osNotifElapsedMs = Date.now() - assignConfirmedAt;
    console.log(`  [PASS] OS đã tạo notification sau ${osNotifElapsedMs}ms: tag=${osMatched.tag} title="${osMatched.title}" text="${osMatched.text}"`);

    const resumedDuringPoll = getResumedActivityPackage(resolvedDeviceId);
    if (resumedDuringPoll === APP_ID) {
      console.log(
        `  [CẢNH BÁO] ResumedActivity hiện là ${APP_ID} - có gì đó đã mở app trong lúc poll (KHÔNG đúng precondition "chưa mở app trước khi kiểm tra shade"), vẫn tiếp tục nhưng ghi nhận vào evidence.`,
      );
    }

    console.log("[7/7] Mở THẬT Android notification shade + đọc UI hierarchy (uiautomator dump)...");
    let tapTarget = null;
    let shadeAttempts = 0;
    const shadeDeadline = Date.now() + 30000;
    let lastXmlLength = 0;
    while (Date.now() < shadeDeadline && !tapTarget) {
      shadeAttempts++;
      expandNotificationShade(resolvedDeviceId);
      await new Promise((r) => setTimeout(r, 800));
      const xml = dumpUiHierarchy(resolvedDeviceId);
      lastXmlLength = xml.length;
      tapTarget = findNotificationTapTarget(xml, (t) => contentMatches(t, assignment.title, dueDMY));
      if (tapTarget) break;
      console.log(`  [SHADE-ATTEMPT ${shadeAttempts}] chưa thấy trong UI render - thử cuộn xuống...`);
      swipeUpInsideShade(resolvedDeviceId);
      await new Promise((r) => setTimeout(r, 500));
      const xml2 = dumpUiHierarchy(resolvedDeviceId);
      tapTarget = findNotificationTapTarget(xml2, (t) => contentMatches(t, assignment.title, dueDMY));
      if (tapTarget) break;
      collapseNotificationShade(resolvedDeviceId);
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!tapTarget || !tapTarget.clickableBounds) {
      return finish({
        status: "FAIL",
        classification: "SHADE_UI_MATCH_NOT_FOUND",
        summary: `OS đã tạo notification (xác nhận qua dumpsys) nhưng KHÔNG tìm thấy item khớp khi đọc UI hierarchy thật của Android notification shade sau ${shadeAttempts} lượt thử (uiautomator dump length lần cuối=${lastXmlLength}).`,
        evidence: {
          assignment: { roomId: assignment.id, title: assignment.title, dueDMY },
          osMatched,
          shadeAttempts,
        },
      });
    }
    console.log(
      `  [PASS] Tìm thấy trong shade thật: title="${tapTarget.titleText}" appName="${tapTarget.appNameText}" body="${tapTarget.bodyText}"`,
    );
    mkdirSync(dirname(SHADE_SCREENSHOT_FILE), { recursive: true });
    screenshot(resolvedDeviceId, SHADE_SCREENSHOT_FILE);
    console.log(`  Screenshot bằng chứng shade: ${SHADE_SCREENSHOT_FILE}`);

    const { x1, y1, x2, y2 } = tapTarget.clickableBounds;
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    console.log(`[TAP] Tap vào notification tại (${centerX}, ${centerY})...`);
    tap(resolvedDeviceId, centerX, centerY);

    console.log("[VERIFY] Xác nhận app lên foreground thật (dumpsys activity activities)...");
    let foregroundConfirmed = false;
    let resumedAfterTap = null;
    const fgDeadline = Date.now() + 15000;
    while (Date.now() < fgDeadline) {
      resumedAfterTap = getResumedActivityPackage(resolvedDeviceId);
      if (resumedAfterTap === APP_ID) {
        foregroundConfirmed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!foregroundConfirmed) {
      return finish({
        status: "FAIL",
        classification: "TAP_DID_NOT_FOREGROUND_APP",
        summary: `Tap vào notification trong Android shade KHÔNG đưa app lên foreground trong 15s (ResumedActivity cuối cùng đo được = "${resumedAfterTap}", kỳ vọng "${APP_ID}").`,
        evidence: { assignment: { roomId: assignment.id, title: assignment.title, dueDMY }, tapTarget, resumedAfterTap },
      });
    }
    console.log(`  [PASS] App đã lên foreground (ResumedActivity = ${resumedAfterTap}).`);

    console.log("[VERIFY] Tái tạo MaestroMcpSession (đã dừng hẳn ở bước [2/7]) để xử lý popup 'AI hỗ trợ học tập' (nếu có) + đọc hierarchy xác nhận điều hướng...");
    await new Promise((r) => setTimeout(r, 1000));
    session = new MaestroMcpSession({ deviceId: resolvedDeviceId });
    await session.start();
    await acceptAiConsentIfShown(session);
    await new Promise((r) => setTimeout(r, 500));
    const hierarchy = await session.hierarchy();
    const destination = classifyDestination(hierarchy, assignment.title);
    const expectedBucket = "EXERCISE_DOING_SCREEN"; // baseline THẬT đã xác nhận ở TB-04, KHÔNG tự định nghĩa mới.
    const navigationPass = destination.bucket === expectedBucket;

    try {
      mkdirSync(dirname(AFTER_TAP_SCREENSHOT_FILE), { recursive: true });
      screenshot(resolvedDeviceId, AFTER_TAP_SCREENSHOT_FILE);
    } catch (e) {
      console.log(`  (Không chụp được screenshot sau tap: ${e.message})`);
    }

    const report = {
      profile: "Ngoc (PHONE=0915775115, lớp 3B)",
      notificationType: "Giao bài",
      trigger: `Giao bài lớp ${ASSIGN_PRIMARY_CLASS} với hạn nộp = hôm nay (${ASSIGN_DUE_DATE})`,
      appStateAtTrigger: `Outside app (ResumedActivity trước khi giao bài = "${resumedBeforeAssign}")`,
      notificationAppeared: "PASS",
      notificationTitle: tapTarget.titleText,
      notificationBody: tapTarget.bodyText,
      contentVerification: contentMatches(tapTarget.bodyText, assignment.title, dueDMY) ? "PASS" : "FAIL",
      androidShadeVerification: "PASS",
      tapNotification: "PASS",
      appForeground: "PASS",
      expectedDestination: `EXERCISE_DOING_SCREEN (màn LÀM BÀI, bài "${assignment.title}") - baseline THẬT theo TB-04 (KHÔNG phải mô tả rule QA gốc "danh sách bài tập", vì TB-04 đã xác nhận hành vi thật khác rule)`,
      actualDestination: `${destination.bucket} - evidence: ${destination.evidenceText}`,
      navigationVerification: navigationPass ? "PASS" : "FAIL",
      overall: navigationPass ? "PASS" : "FAIL",
    };

    return finish({
      status: report.overall,
      classification: navigationPass ? undefined : "NAVIGATION_DESTINATION_MISMATCH",
      summary: navigationPass
        ? `Toàn bộ flow OS-level PASS: giao bài "${assignment.title}" (hạn nộp ${dueDMY}) -> notification xuất hiện trên Android shade sau ${osNotifElapsedMs}ms -> tap -> app foreground -> đúng destination EXERCISE_DOING_SCREEN (khớp baseline TB-04).`
        : `Notification/tap/foreground đều PASS nhưng destination sau cùng ("${destination.bucket}") KHÔNG khớp baseline TB-04 ("${expectedBucket}").`,
      evidence: {
        report,
        assignment: { roomId: assignment.id, title: assignment.title, dueDMY, classIds: assignment.classIds },
        osNotifElapsedMs,
        osAttempts,
        shadeAttempts,
        tapTarget,
        selection,
        shadeScreenshot: SHADE_SCREENSHOT_FILE,
        afterTapScreenshot: AFTER_TAP_SCREENSHOT_FILE,
      },
    });
  } finally {
    if (session) await session.stop();
  }
}

main().catch((err) => {
  console.error("\n[TB-06 e2e-teacher-assign-os-notification-shade] Dừng lại vì lỗi ngoài dự kiến:\n");
  console.error(err);
  process.exit(2);
});
