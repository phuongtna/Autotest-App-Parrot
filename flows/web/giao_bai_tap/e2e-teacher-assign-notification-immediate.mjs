#!/usr/bin/env node
/**
 * E2E-Teacher-Assign-Notification-Immediate (TB-01)
 *
 * Verify flows/app/thong_bao/TEST-CASES.md TB-01: GV bấm "Giao bài đã chọn" (hạn nộp = HÔM NAY)
 * -> mở icon chuông thông báo trên App HS -> 1 thông báo khớp đúng bài vừa giao phải xuất hiện
 * NGAY (đo timing thật, không giả định).
 *
 * KHÁC e2e-teacher-assign-student-open.mjs (không gọi assignHomeworkAndLocateOnApp() của file đó):
 * file đó đo "GV giao -> card xuất hiện trong danh sách Bài tập" (dùng findAssignment() cuộn tìm
 * card) - CASE NÀY đo 1 luồng khác hẳn: "GV giao -> item xuất hiện trong icon chuông Thông báo",
 * không liên quan gì tới danh sách Bài tập/card/CTA. Gộp chung sẽ đo sai thứ (cộng thêm thời gian
 * mở tab Bài tập + cuộn tìm card vào phép đo "thông báo xuất hiện nhanh không"). Vì vậy file này
 * tự viết lại phần "App HS: mở icon chuông + đối chiếu" (ngắn, ~30 dòng), nhưng TÁI SỬ DỤNG NGUYÊN
 * VẸN phần Web GV:
 *   - automation/giao_bai_tap/runtime/assignHomeworkFlow.js - Playwright: login, chọn lớp/Unit/
 *     Lesson/bài, bấm "Giao bài đã chọn", chờ toast thành công (KHÔNG viết lại).
 *   - automation/bai_tap/discovery/homeworks.js + model/homeworkModel.js - lấy metadata assignment
 *     vừa tạo (diff before/after qua GET /api/user/exams/room.json), CÙNG kỹ thuật diff đã dùng ở
 *     e2e-teacher-assign-student-open.mjs (không có hàm export sẵn cho riêng bước diff này - đây là
 *     đoạn ngắn ~10 dòng, chép lại y hệt logic đã verify, không phát minh cách khác).
 *   - automation/bai_tap/discovery/maestroMcpSession.js (MaestroMcpSession) - 1 tiến trình
 *     `maestro mcp` sống xuyên suốt cho App HS (login 1 lần + tap chuông lặp lại nhiều lượt khi
 *     poll, tránh chi phí ~40-50s/lệnh của `maestro test`/`maestro hierarchy` CLI riêng - xem
 *     docblock chính file đó).
 *   - Phần "launch app giữ session" + "login nếu cần" viết lại NATIVE qua session.run() (giống
 *     helpers/launch-keep-session.yaml + helpers/login.yaml, đã có tiền lệ y hệt trong
 *     automation/bai_tap/xemchitietbailam.mjs#launchFresh/#loginIfNeeded - sao chép đúng chuỗi
 *     bước đã verify thật ở đó, không tự chế cách khác) - lý do phải viết lại native thay vì
 *     runFlow: file tới login.yaml/launch-keep-session.yaml: MCP tool "run" nhận 1 chuỗi step rời,
 *     không có ngữ cảnh thư mục để resolve đường dẫn file .yaml tương đối (nó ghi ra 1 file tạm ở
 *     thư mục khác) - xem cùng lý do trong xemchitietbailam.mjs.
 *   - flows/app/helpers/open-notification.yaml (MỚI, cùng đợt): bản Maestro-yaml THUẦN của bước
 *     "tap icon chuông" - dùng làm tài liệu tham chiếu selector (`id: notification_bell_button`)
 *     cho bản native dưới đây, KHÔNG gọi trực tiếp (lý do runFlow ở trên).
 *
 * TẠI SAO POLL BẰNG "ĐÓNG RỒI MỞ LẠI" (không chỉ đọc hierarchy() lặp lại khi màn hình đứng yên):
 * chưa có bằng chứng màn "Thông báo" tự refresh khi có item mới (không phải mục tiêu xác nhận của
 * case này) - poll an toàn nhất là tự đóng (back) rồi mở lại (tap chuông) mỗi lượt, buộc app phải
 * fetch lại danh sách, giống hệt hành vi 1 người dùng thật đóng/mở lại icon chuông để "refresh".
 *
 * KHỚP THÔNG BÁO: không giả định 1 mẫu câu cố định. Khảo sát thật (2026-09-01, xem
 * flows/app/thong_bao/TEST-CASES.md) cho thấy CÓ NHIỀU mẫu câu khác nhau cho thông báo "bài tập
 * mới" (khác hẳn câu duy nhất "Ngoc nhận được bài tập ... Chúc con học tốt!" đã ghi ở
 * flows/web/giao_bai_tap/TESTCASES.md TC1, đó chỉ là 1 trong số các mẫu, không phải mẫu cố định
 * duy nhất) - nên match bằng 2 điều kiện ĐỘC LẬP với mẫu câu: content-desc của item chứa ĐÚNG
 * `"<title bài vừa giao>"` (giữ nguyên dấu ngoặc kép, đúng như UI hiển thị) VÀ chứa
 * `Hạn nộp: <DD/MM/YYYY>` khớp đúng hạn nộp vừa đặt (hôm nay).
 *
 * CHẠY (cần .env có TEACHER_USERNAME/PASSWORD/TEACHER_ACCESS_TOKEN, test_data/accounts.env có
 * PHONE/OTP của lớp 3B, thiết bị Android đã kết nối):
 *   node flows/web/giao_bai_tap/e2e-teacher-assign-notification-immediate.mjs
 * ENV (đều optional, cùng quy ước e2e-teacher-assign-student-open.mjs):
 *   ASSIGN_PRIMARY_CLASS (default "3B"), TARGET_CLASS_ID (default id lớp "3B"),
 *   ASSIGN_DUE_DATE "DD/MM/YYYY" (default HÔM NAY, giờ VN - KHÁC default "+7 ngày" của
 *   e2e-teacher-assign-student-open.mjs vì TB-01 yêu cầu rõ "hạn nộp cũng là hôm nay"),
 *   ASSIGN_UNIT_NAME/ASSIGN_LESSON_NAME/ASSIGN_HOMEWORK_ITEM_NAME (để trống -> random thật),
 *   ASSIGN_HEADLESS (default true), ASSIGN_DEBUG_DUMP (default true),
 *   NOTIFICATION_POLL_TIMEOUT_MS (default 90000) - tổng thời gian tối đa chờ thông báo xuất hiện
 *   trước khi kết luận FAIL, APP_ID/PHONE/OTP/MAESTRO_DEVICE đọc .env/test_data/accounts.env.
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

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "e2e_teacher_assign_notification_immediate_report.json");

// Cùng id lớp "3B" với e2e-teacher-assign-student-open.mjs (đã xác nhận thật, không đoán).
const TARGET_CLASS_ID = process.env.TARGET_CLASS_ID || "b3336062-cacd-4d1a-a0af-4de44acf33d2";
const ASSIGN_PRIMARY_CLASS = process.env.ASSIGN_PRIMARY_CLASS || "3B";
const ASSIGN_UNIT_NAME = process.env.ASSIGN_UNIT_NAME || undefined;
const ASSIGN_LESSON_NAME = process.env.ASSIGN_LESSON_NAME || undefined;
const ASSIGN_HOMEWORK_ITEM_NAME = process.env.ASSIGN_HOMEWORK_ITEM_NAME || undefined;
const ASSIGN_HEADLESS = process.env.ASSIGN_HEADLESS !== "false";
const ASSIGN_DEBUG_DUMP = process.env.ASSIGN_DEBUG_DUMP !== "false";
const NOTIFICATION_POLL_TIMEOUT_MS = Number(process.env.NOTIFICATION_POLL_TIMEOUT_MS || 90000);

// Hạn nộp mặc định = HÔM NAY (giờ VN) - đúng yêu cầu TB-01 ("giao hôm nay, hạn nộp cũng hôm nay"),
// KHÔNG dùng default "+7 ngày" như e2e-teacher-assign-student-open.mjs (case đó không cần hạn nộp
// hôm nay).
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

/** title optional: không truyền -> lấy TOÀN BỘ room của lớp (snapshot "before" khi title vừa
 * random chọn CHƯA XÁC ĐỊNH được tại thời điểm gọi) - y hệt fetchClassDataset() trong
 * e2e-teacher-assign-student-open.mjs (hàm đó không export - chép lại logic ngắn, đã verify thật). */
async function fetchClassDataset(title) {
  const rawRooms = await fetchAllHomeworkRooms({ period: "MONTH" });
  return rawRooms
    .map(normalizeHomework)
    .filter((h) => h.classIds.includes(TARGET_CLASS_ID) && (title === undefined || h.title === title));
}

/** launch-keep-session.yaml viết lại native (tiền lệ: automation/bai_tap/xemchitietbailam.mjs#launchFresh) - KHÔNG stopApp (giữ session, giống launch-keep-session.yaml, không phải launch-fresh.yaml). */
async function launchKeepSession(session) {
  const r = await session.run(APP_ID, [
    { launchApp: { permissions: { all: "allow" } } },
    { extendedWaitUntil: { visible: { text: ".*(Đăng nhập|Vui học|Bài tập|Báo cáo).*" }, timeout: 30000 } },
  ]);
  if (!r.success) throw new Error(`launchKeepSession thất bại: ${r.error}`);
}

/** login.yaml viết lại native (tiền lệ: automation/bai_tap/xemchitietbailam.mjs#loginIfNeeded) - chuỗi bước copy y hệt, đã verify thật. */
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

/** open-notification.yaml viết lại native - tap icon chuông (id notification_bell_button, đã xác
 * nhận thật 2026-09-01, có mặt trên cả 3 tab dashboard). */
async function openNotification(session) {
  const r = await session.run(APP_ID, [
    { tapOn: { id: "notification_bell_button" } },
    { extendedWaitUntil: { visible: { text: "Thông báo" }, timeout: 15000 } },
  ]);
  if (!r.success) throw new Error(`openNotification thất bại: ${r.error}`);
}

/** Đóng màn Thông báo (back) - dùng giữa các lượt poll để buộc lần tap chuông kế tiếp fetch lại. */
async function closeNotification(session) {
  const r = await session.run(APP_ID, ["back"]);
  if (!r.success) throw new Error(`closeNotification (back) thất bại: ${r.error}`);
}

function flattenNodes(node, out) {
  if (node.attributes && (node.attributes.text || node.attributes["content-desc"])) {
    out.push(node.attributes);
  }
  for (const c of node.children || []) flattenNodes(c, out);
  return out;
}

/** Tìm item thông báo khớp (title trong ngoặc kép + "Hạn nộp: DD/MM/YYYY") - không giả định 1 mẫu
 * câu cố định, xem giải thích ở docblock đầu file. */
function findMatchingNotification(hierarchy, title, dueDMY) {
  const nodes = flattenNodes(hierarchy, []);
  const needleTitle = `"${title}"`;
  const needleDue = `Hạn nộp: ${dueDMY}`;
  return nodes.find((attrs) => {
    const desc = attrs["content-desc"] || "";
    return desc.includes(needleTitle) && desc.includes(needleDue);
  });
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

  console.log("[1/5] App HS: launch + login (giữ session cho tới hết lượt poll)...");
  const session = new MaestroMcpSession(DEVICE_ID ? { deviceId: DEVICE_ID } : {});
  await session.start();
  try {
    await launchKeepSession(session);
    await loginIfNeeded(session);
    console.log("  [PASS] App HS đã login/đứng ở dashboard.");

    console.log("[2/5] Snapshot Web GV TRƯỚC khi giao bài (toàn bộ room của lớp)...");
    const before = await fetchClassDataset();
    const beforeIds = new Set(before.map((h) => h.id));

    console.log(
      `[3/5] Giao bài qua Web GV (Playwright): lớp=${ASSIGN_PRIMARY_CLASS}, hạn nộp=${ASSIGN_DUE_DATE}${
        ASSIGN_HOMEWORK_ITEM_NAME ? `, bài (ép cố định)="${ASSIGN_HOMEWORK_ITEM_NAME}"` : " (random thật trên UI)"
      }...`,
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
        classification: isNoEligible
          ? "BLOCKED_NO_ELIGIBLE_ASSIGNMENT"
          : failedStep?.name === "submitAssign"
            ? "GV_SUCCESS_MESSAGE_MISSING"
            : "GV_ASSIGNMENT_FAILED",
        summary: isNoEligible
          ? "Không còn Unit/Lesson/assignment nào thực sự có exam để random trong bộ sách của lớp này."
          : `Giao bài thất bại ở bước "${failedStep?.name}".`,
        evidence: { steps: assignResult.steps, error: assignResult.error, selection },
      });
    }
    const assignConfirmedAt = Date.now();
    console.log(`  [PASS] Toast "Giao bài tập mới thành công" đã hiện lúc t=${new Date(assignConfirmedAt).toISOString()}.`);

    console.log("[4/5] Lấy metadata assignment vừa tạo (diff before/after qua API room.json)...");
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
            ? `Web GV báo giao bài thành công nhưng không tìm thấy room mới nào qua API sau 3 lần thử.`
            : `Web GV tạo ${newRooms.length} room MỚI cùng title+lớp sau 1 lượt giao bài - không xác định được đâu là room vừa giao.`,
        evidence: { beforeCount: before.length, afterCount: after.length, selection, newRoomIds: newRooms.map((r) => r.id) },
      });
    }
    const assignment = newRooms[0];
    const dueVnYmd = isoToVnYmd(assignment.deadline.endTime);
    const dueDMY = formatDMY(dueVnYmd);
    console.log(`  [PASS] room_id=${assignment.id} title="${assignment.title}" hạn nộp(VN)=${dueDMY}.`);
    if (dueDMY !== todayDMY) {
      console.log(`  [CẢNH BÁO] Hạn nộp thật (${dueDMY}) khác hôm nay (${todayDMY}) - vẫn tiếp tục, ghi nhận lệch vào evidence.`);
    }

    console.log(
      `[5/5] App HS: mở icon chuông + đối chiếu (poll tối đa ${NOTIFICATION_POLL_TIMEOUT_MS}ms, đóng/mở lại mỗi lượt)...`,
    );
    let matched = null;
    let attempts = 0;
    const pollDeadline = assignConfirmedAt + NOTIFICATION_POLL_TIMEOUT_MS;
    while (Date.now() < pollDeadline) {
      attempts++;
      await openNotification(session);
      const hierarchy = await session.hierarchy();
      matched = findMatchingNotification(hierarchy, assignment.title, dueDMY);
      const elapsedSoFar = Date.now() - assignConfirmedAt;
      console.log(`  [POLL ${attempts}] t+${elapsedSoFar}ms - ${matched ? "KHỚP" : "chưa thấy"}.`);
      if (matched) break;
      await closeNotification(session);
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!matched) {
      return finish({
        status: "FAIL",
        classification: "NOTIFICATION_NOT_APPEARED",
        summary: `Sau ${NOTIFICATION_POLL_TIMEOUT_MS}ms (${attempts} lượt poll) KHÔNG thấy thông báo khớp title="${assignment.title}" + Hạn nộp=${dueDMY} trong icon chuông.`,
        evidence: { assignment: { roomId: assignment.id, title: assignment.title, dueDMY }, attempts, selection },
      });
    }

    const elapsedMs = Date.now() - assignConfirmedAt;
    console.log(`  [PASS] Thông báo khớp xuất hiện sau ${elapsedMs}ms: "${matched["content-desc"]}"`);
    return finish({
      status: "PASS",
      summary: `GV giao bài "${assignment.title}" (hạn nộp ${dueDMY}, hôm nay) -> thông báo khớp xuất hiện trong icon chuông App HS sau ${elapsedMs}ms (${attempts} lượt poll).`,
      evidence: {
        selection,
        assignment: { roomId: assignment.id, title: assignment.title, dueDMY, classIds: assignment.classIds },
        notificationText: matched["content-desc"],
        elapsedMs,
        attempts,
      },
    });
  } finally {
    await session.stop();
  }
}

main().catch((err) => {
  console.error("\n[e2e-teacher-assign-notification-immediate] Dừng lại vì lỗi ngoài dự kiến:\n");
  console.error(err);
  process.exit(2);
});
