#!/usr/bin/env node
/**
 * TB02-Check-19h-Reminder (flows/app/thong_bao/TEST-CASES.md, TB-02)
 *
 * QUAN TRỌNG - ĐỌC TRƯỚC KHI DÙNG: đây là script QUAN SÁT (observational), KHÔNG PHẢI 1 bộ
 * assertion PASS/FAIL chặt. TEST-CASES.md hiện ghi TB-02 = "Tay" vì lý do "time-gated,
 * server-triggered" (xem mục "TB-02 — Quyết định: Tay" trong file đó) - script này là công cụ để
 * NGƯỜI kiểm thử tự làm đúng kỹ thuật user yêu cầu ("thoát thông báo bấm lại vào check thông báo
 * xem có đúng lúc 19h không") thay vì làm tay 100%, nhưng KHÔNG tự động đổi verdict TB-02 sang
 * "Auto" - phần chữ của thông báo nhắc hạn nộp CHƯA có mẫu nào được xác nhận thật (khác TB-01, nơi
 * đã biết 5 mẫu câu "bài tập mới" thật - xem TEST-CASES.md), nên KHÔNG giả định 1 mẫu câu cố định
 * để match/PASS-FAIL. Lượt chạy ĐẦU TIÊN của script này chỉ có nhiệm vụ: ghi lại NGUYÊN VĂN mọi
 * text thông báo quan sát được quanh mốc 19:00, gắn cờ (flag) những item CÓ VẺ là nhắc hạn nộp (không
 * khớp 5 mẫu "bài tập mới" đã biết, hoặc có cụm "hạn nộp"/"quá hạn"/"sắp hết hạn" kiểu câu nhắc nhở
 * chứ không phải câu "giao bài mới") để người xem sau tự đối chiếu bằng mắt - CHƯA đủ căn cứ để
 * biến thành 1 assertion tự động chặt (giống cách docblock HW-20 trong
 * flows/app/bai_tap/TEST-CASES.md từng ghi "Chưa chạy thử... cần refresh token trước" - cùng tinh
 * thần thành thật về việc gì đã/chưa xác nhận thật).
 *
 * KỸ THUẬT (đúng yêu cầu user, TÁI SỬ DỤNG NGUYÊN VẸN pattern
 * flows/web/giao_bai_tap/e2e-teacher-assign-notification-immediate.mjs - đọc file đó trước, đây là
 * cùng kiến trúc, KHÔNG viết lại cách khác):
 *   - automation/bai_tap/discovery/maestroMcpSession.js (MaestroMcpSession) - 1 tiến trình
 *     `maestro mcp` sống xuyên suốt cho App HS, login 1 lần rồi lặp lại tap chuông/đọc hierarchy
 *     nhiều lượt (tránh chi phí ~40-50s/lệnh của `maestro test`/`maestro hierarchy` CLI riêng).
 *   - launchKeepSession()/loginIfNeeded()/openNotification()/closeNotification()/flattenNodes():
 *     COPY NGUYÊN VẸN chuỗi bước native đã verify thật trong
 *     e2e-teacher-assign-notification-immediate.mjs (KHÔNG phát minh cách login/tap chuông khác).
 *   - "Đóng rồi mở lại icon chuông" mỗi lượt poll (back -> tap chuông lại) - đúng nguyên văn kỹ
 *     thuật user mô tả ("thoát thông báo bấm lại vào check"), CÙNG lý do TB-01 đã áp dụng: chưa có
 *     bằng chứng màn Thông báo tự refresh khi đứng yên, đóng/mở lại buộc app fetch lại danh sách.
 *   - automation/bai_tap/discovery/homeworks.js#fetchAllHomeworkRooms +
 *     automation/bai_tap/model/homeworkModel.js#normalizeHomework - lấy DANH SÁCH THẬT các bài của
 *     lớp 3B (không tạo bài mới, chỉ ĐỌC) rồi tự phân loại due-today/quá hạn/sắp tới hạn NGAY TẠI
 *     THỜI ĐIỂM CHẠY (không dùng số liệu tĩnh chốt sẵn lúc viết script - vì lượt chạy thật tối nay
 *     cách lúc viết script vài giờ, số liệu due-state có thể đổi) để cross-reference với text nhắc
 *     nhở quan sát được.
 *
 * "SẮP TỚI HẠN" KHÔNG CÓ ĐỊNH NGHĨA CỬA SỔ CỐ ĐỊNH NÀO TRONG REPO: đã tra flows/app/bai_tap/
 * TEST-CASES.md (HW-09 "quá hạn" = due_date < hôm nay, HW-10 "hôm nay" = due_date = hôm nay) - CHỈ
 * có 2 nhãn UI xác nhận thật, KHÔNG có nhãn/định nghĩa "sắp tới hạn" nào trong toàn repo. Script
 * này TỰ CHỌN cửa sổ "≤3 ngày tới" làm ứng viên "sắp tới hạn" (UPCOMING_WINDOW_DAYS, env chỉnh
 * được) - đây là quy ước riêng của script, KHÔNG PHẢI 1 định nghĩa đã xác nhận từ CMS/backend, ghi
 * rõ trong report để không ai nhầm là đã xác nhận thật.
 *
 * CỬA SỔ POLL MẶC ĐỊNH quanh 19:00 giờ VN (Asia/Ho_Chi_Minh, KHÔNG DST - lệch cố định +7h so với
 * UTC, cùng hằng số VN_OFFSET_MS dùng ở model/homeworkModel.js và verify-filter-web-vs-app.mjs):
 *   - Nếu chạy TRƯỚC (19:00 - TB02_PRE_WINDOW_MINUTES phút): script CHỜ (sleep) tới đúng mốc bắt
 *     đầu cửa sổ rồi mới bắt đầu poll (KHÔNG bắt đầu quá sớm, tránh log rác nhiều giờ trước).
 *   - Cửa sổ chính: [19:00 - TB02_PRE_WINDOW_MINUTES phút, 19:00 + TB02_POST_WINDOW_MINUTES phút].
 *   - Nếu chạy SAU khi cửa sổ chính đã kết thúc (vd quên chạy, giờ đã 20h): bắt đầu poll NGAY, chạy
 *     trong TB02_FALLBACK_DURATION_MINUTES phút (không cố lùi lại quá khứ).
 *   - TB02_FORCE_START_NOW=true: bỏ qua toàn bộ logic cửa sổ ở trên, poll ngay lập tức trong
 *     TB02_FALLBACK_DURATION_MINUTES phút - dùng để SMOKE-TEST cơ chế (login/tap chuông/đọc
 *     hierarchy) bất kỳ lúc nào trong ngày, KHÔNG dùng cho lượt chạy thật lúc 19:00 (dry-run này
 *     sẽ chỉ thấy thông báo hiện có, không phải thông báo nhắc hạn nộp thật).
 *   - TB02_MAX_ROUNDS (optional, không set = không giới hạn): chặn cứng số lượt poll - dùng kèm
 *     TB02_FORCE_START_NOW cho smoke-test ngắn (vd 2 lượt) thay vì chạy hết cả cửa sổ.
 *
 * PHÂN LOẠI TEXT THÔNG BÁO (không giả định mẫu câu nhắc hạn nộp - CHƯA có mẫu nào xác nhận thật):
 *   - KNOWN_ASSIGNMENT_SHAPED: khớp 1 trong các cụm động từ "giao bài mới" đã xác nhận thật ở 5 mẫu
 *     câu TB-01 (TEST-CASES.md) - "giao bài", "bài tập mới", "nhận được bài tập", "đã giao cho",
 *     "đã sẵn sàng" - CÁC MẪU NÀY vẫn chứa "Hạn nộp: <ngày>" nhưng không phải câu NHẮC NHỞ, ưu tiên
 *     phân loại này TRƯỚC (không rơi vào nhánh dưới dù có chữ "Hạn nộp").
 *   - POSSIBLE_DUE_DATE_REMINDER: KHÔNG khớp nhánh trên NHƯNG có cụm kiểu nhắc nhở
 *     ("hạn nộp"/"quá hạn"/"sắp hết hạn"/"sắp đến hạn"/"còn N ngày|giờ|phút"/"nhắc nhở"/"nhắc con"/
 *     "nhắc bạn") - đây là các item CẦN NGƯỜI XEM LẠI BẰNG MẮT, script chỉ flag không tự PASS/FAIL.
 *   - OTHER_UNKNOWN: không khớp cả 2 nhánh trên (vd thông báo hệ thống khác, không liên quan hạn nộp).
 *
 * CHẠY (cần .env có TEACHER_ACCESS_TOKEN còn hạn - JWT ngắn hạn ~1h, chạy ./get_teacher_token.sh
 * nếu gặp 401, test_data/accounts.env có PHONE/OTP của lớp 3B, thiết bị Android đã kết nối):
 *   node flows/app/thong_bao/tb02-check-19h-reminder.mjs
 * ENV (đều optional):
 *   TB02_REMINDER_HOUR (default 19), TB02_REMINDER_MINUTE (default 0) - mốc giờ VN mục tiêu.
 *   TB02_PRE_WINDOW_MINUTES (default 5), TB02_POST_WINDOW_MINUTES (default 15) - cửa sổ chính.
 *   TB02_FALLBACK_DURATION_MINUTES (default 20) - thời lượng chạy khi bắt đầu ngoài cửa sổ chính
 *     (hoặc khi TB02_FORCE_START_NOW=true).
 *   TB02_POLL_INTERVAL_MS (default 30000) - khoảng nghỉ giữa các lượt đóng/mở lại icon chuông.
 *   TB02_FORCE_START_NOW (default "false") - "true" để bỏ qua chờ cửa sổ, poll ngay (smoke-test).
 *   TB02_MAX_ROUNDS (optional, không default) - chặn cứng số lượt poll.
 *   UPCOMING_WINDOW_DAYS (default 3) - cửa sổ "sắp tới hạn" TỰ CHỌN của script (xem giải thích ở
 *     trên - KHÔNG PHẢI định nghĩa đã xác nhận từ CMS).
 *   TARGET_CLASS_ID (default id lớp "3B" đã xác nhận thật, giống TB-01),
 *   APP_ID/PHONE/OTP/MAESTRO_DEVICE đọc .env/test_data/accounts.env (giống TB-01).
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fetchAllHomeworkRooms } from "../../../automation/bai_tap/discovery/homeworks.js";
import { normalizeHomework } from "../../../automation/bai_tap/model/homeworkModel.js";
import { requireTeacherPortalConfig } from "../../../automation/src/config.js";
import { MaestroMcpSession } from "../../../automation/bai_tap/discovery/maestroMcpSession.js";
import { nowVnYmd, isoToVnYmd, formatDMY } from "../../../automation/bai_tap/verify-filter-web-vs-app.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "tb02_check_19h_reminder_report.json");

// Cùng id lớp "3B" đã xác nhận thật với e2e-teacher-assign-notification-immediate.mjs.
const TARGET_CLASS_ID = process.env.TARGET_CLASS_ID || "b3336062-cacd-4d1a-a0af-4de44acf33d2";

const REMINDER_HOUR = Number(process.env.TB02_REMINDER_HOUR || 19);
const REMINDER_MINUTE = Number(process.env.TB02_REMINDER_MINUTE || 0);
const PRE_WINDOW_MS = Number(process.env.TB02_PRE_WINDOW_MINUTES || 5) * 60 * 1000;
const POST_WINDOW_MS = Number(process.env.TB02_POST_WINDOW_MINUTES || 15) * 60 * 1000;
const FALLBACK_DURATION_MS = Number(process.env.TB02_FALLBACK_DURATION_MINUTES || 20) * 60 * 1000;
const POLL_INTERVAL_MS = Number(process.env.TB02_POLL_INTERVAL_MS || 30000);
const FORCE_START_NOW = String(process.env.TB02_FORCE_START_NOW || "false").toLowerCase() === "true";
const MAX_ROUNDS = process.env.TB02_MAX_ROUNDS ? Number(process.env.TB02_MAX_ROUNDS) : Infinity;
const UPCOMING_WINDOW_DAYS = Number(process.env.UPCOMING_WINDOW_DAYS || 3);

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

// ---- Cùng hằng số/kỹ thuật lệch giờ VN với homeworkModel.js/verify-filter-web-vs-app.mjs ----
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Mốc epoch ms của "hôm nay, giờ:phút chỉ định" theo giờ VN (không phụ thuộc TZ máy chạy). */
function vnTodayAtEpochMs(hour, minute) {
  const nowShifted = new Date(Date.now() + VN_OFFSET_MS);
  const y = nowShifted.getUTCFullYear();
  const m0 = nowShifted.getUTCMonth();
  const d = nowShifted.getUTCDate();
  const wallMs = Date.UTC(y, m0, d, hour, minute, 0, 0);
  return wallMs - VN_OFFSET_MS;
}

function ymdToOrdinal({ y, m0, d }) {
  return Date.UTC(y, m0, d);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** launch-keep-session.yaml viết lại native - COPY NGUYÊN VẸN từ
 * e2e-teacher-assign-notification-immediate.mjs (đã verify thật, không viết lại cách khác). */
async function launchKeepSession(session) {
  const r = await session.run(APP_ID, [
    { launchApp: { permissions: { all: "allow" } } },
    { extendedWaitUntil: { visible: { text: ".*(Đăng nhập|Vui học|Bài tập|Báo cáo).*" }, timeout: 30000 } },
  ]);
  if (!r.success) throw new Error(`launchKeepSession thất bại: ${r.error}`);
}

/** login.yaml viết lại native - COPY NGUYÊN VẸN từ e2e-teacher-assign-notification-immediate.mjs. */
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

/** open-notification.yaml viết lại native - COPY NGUYÊN VẸN (id notification_bell_button). */
async function openNotification(session) {
  const r = await session.run(APP_ID, [
    { tapOn: { id: "notification_bell_button" } },
    { extendedWaitUntil: { visible: { text: "Thông báo" }, timeout: 15000 } },
  ]);
  if (!r.success) throw new Error(`openNotification thất bại: ${r.error}`);
}

/** Đóng màn Thông báo (back) - buộc lần tap chuông kế tiếp fetch lại, đúng kỹ thuật user mô tả. */
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

/** Lấy toàn bộ content-desc "có vẻ là item thông báo" (có dấu phẩy + hậu tố thời gian tương đối
 * "x phút/giờ trước" - cùng shape đã xác nhận thật ở TEST-CASES.md) từ 1 lần đọc hierarchy. Không
 * lọc quá chặt (fallback: lấy MỌI content-desc non-trivial) để không bỏ sót mẫu câu nhắc hạn nộp
 * CHƯA biết trước hình dạng. */
function extractNotificationTexts(hierarchy) {
  const nodes = flattenNodes(hierarchy, []);
  const texts = new Set();
  for (const attrs of nodes) {
    const desc = attrs["content-desc"];
    if (desc && desc.trim()) texts.add(desc.trim());
  }
  return [...texts];
}

// ---- Phân loại text thông báo (xem giải thích đầy đủ ở docblock đầu file) ----
const ASSIGNMENT_SHAPE_PATTERNS = [/giao bài/i, /bài tập mới/i, /nhận được bài tập/i, /đã giao cho/i, /đã sẵn sàng/i];
const REMINDER_KEYWORD_PATTERN =
  /hạn nộp|quá hạn|sắp hết hạn|sắp đến hạn|còn\s*\d+\s*(ngày|giờ|phút)|nhắc nhở|nhắc con|nhắc bạn/i;

function classifyNotificationText(text) {
  if (ASSIGNMENT_SHAPE_PATTERNS.some((re) => re.test(text))) return "KNOWN_ASSIGNMENT_SHAPED";
  if (REMINDER_KEYWORD_PATTERN.test(text)) return "POSSIBLE_DUE_DATE_REMINDER";
  return "OTHER_UNKNOWN";
}

/** Đọc TOÀN BỘ room của lớp 3B (không tạo mới, chỉ đọc thật - GET /api/user/exams/room.json,
 * period=MONTH) rồi tự phân loại due-today/quá hạn/sắp tới hạn (UPCOMING_WINDOW_DAYS) NGAY TẠI
 * thời điểm gọi hàm này (không dùng số liệu tĩnh chốt sẵn lúc viết script). */
async function fetchDueStateCandidates() {
  const rawRooms = await fetchAllHomeworkRooms({ period: "MONTH" });
  const all = rawRooms.map(normalizeHomework).filter((h) => h.classIds.includes(TARGET_CLASS_ID));
  const today = nowVnYmd();
  const todayOrd = ymdToOrdinal(today);
  const rows = all.map((h) => {
    const dueYmd = isoToVnYmd(h.deadline.endTime);
    const dueOrd = dueYmd ? ymdToOrdinal(dueYmd) : null;
    const diffDays = dueOrd !== null ? Math.round((dueOrd - todayOrd) / 86400000) : null;
    let status;
    if (dueOrd === null) status = "NO_DEADLINE";
    else if (diffDays < 0) status = "OVERDUE";
    else if (diffDays === 0) status = "DUE_TODAY";
    else if (diffDays <= UPCOMING_WINDOW_DAYS) status = "UPCOMING";
    else status = "FUTURE";
    return { id: h.id, title: h.title, type: h.type, dueDMY: dueYmd ? formatDMY(dueYmd) : null, diffDays, status };
  });
  return {
    todayDMY: formatDMY(today),
    dueToday: rows.filter((r) => r.status === "DUE_TODAY"),
    overdue: rows.filter((r) => r.status === "OVERDUE").sort((a, b) => b.diffDays - a.diffDays), // gần nhất trước
    upcoming: rows.filter((r) => r.status === "UPCOMING").sort((a, b) => a.diffDays - b.diffDays),
  };
}

/** Với 1 text POSSIBLE_DUE_DATE_REMINDER, tìm các candidate homework mà title xuất hiện (nguyên
 * văn, có/không ngoặc kép - chưa biết mẫu câu thật nên thử cả 2 cách) trong text đó. */
function matchReminderToCandidates(text, candidates) {
  const matches = [];
  for (const c of candidates) {
    if (!c.title) continue;
    if (text.includes(`"${c.title}"`)) matches.push({ ...c, matchType: "QUOTED_TITLE" });
    else if (text.includes(c.title)) matches.push({ ...c, matchType: "BARE_TITLE" });
  }
  return matches;
}

function finish(result) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  console.log(`\n=== KẾT QUẢ (OBSERVATIONAL, không phải PASS/FAIL chặt): ${result.status} ===`);
  console.log(result.summary);
  console.log(`\nĐã ghi report ra ${OUTPUT_FILE}`);
  process.exit(result.status === "ERROR" ? 2 : 0);
}

async function main() {
  requireTeacherPortalConfig();
  if (!APP_ID) throw new Error("Thiếu APP_ID - kiểm tra .env.");
  if (!PHONE || !OTP) throw new Error("Thiếu PHONE/OTP - kiểm tra test_data/accounts.env.");

  console.log("[0/3] Đọc danh sách bài thật của lớp 3B (due-today/quá hạn/sắp tới hạn), KHÔNG tạo bài mới...");
  const candidatesSnapshot = await fetchDueStateCandidates();
  console.log(
    `  today=${candidatesSnapshot.todayDMY} | dueToday=${candidatesSnapshot.dueToday.length} | overdue=${candidatesSnapshot.overdue.length} | upcoming(<=${UPCOMING_WINDOW_DAYS}d)=${candidatesSnapshot.upcoming.length}`,
  );
  const allCandidates = [...candidatesSnapshot.dueToday, ...candidatesSnapshot.overdue, ...candidatesSnapshot.upcoming];

  const target = vnTodayAtEpochMs(REMINDER_HOUR, REMINDER_MINUTE);
  const windowStart = target - PRE_WINDOW_MS;
  const windowEnd = target + POST_WINDOW_MS;
  const now0 = Date.now();

  let pollStart;
  let pollEnd;
  let windowMode;
  if (FORCE_START_NOW) {
    pollStart = now0;
    pollEnd = now0 + FALLBACK_DURATION_MS;
    windowMode = "FORCE_START_NOW (smoke-test, KHÔNG phải lượt chạy thật 19:00)";
  } else if (now0 > windowEnd) {
    pollStart = now0;
    pollEnd = now0 + FALLBACK_DURATION_MS;
    windowMode = "FALLBACK_ALREADY_PAST_WINDOW";
  } else if (now0 < windowStart) {
    console.log(
      `[1/3] Chưa tới cửa sổ poll (bắt đầu lúc ${new Date(windowStart).toISOString()}) - chờ ${Math.round((windowStart - now0) / 1000)}s...`,
    );
    await sleep(windowStart - now0);
    pollStart = Date.now();
    pollEnd = windowEnd;
    windowMode = "PRIMARY_WINDOW_AFTER_WAIT";
  } else {
    pollStart = now0;
    pollEnd = windowEnd;
    windowMode = "PRIMARY_WINDOW_IMMEDIATE";
  }
  console.log(
    `[1/3] Cửa sổ poll: mode=${windowMode}, start=${new Date(pollStart).toISOString()}, end=${new Date(pollEnd).toISOString()}, interval=${POLL_INTERVAL_MS}ms${Number.isFinite(MAX_ROUNDS) ? `, maxRounds=${MAX_ROUNDS}` : ""}.`,
  );

  console.log("[2/3] App HS: launch + login (giữ session cho tới hết lượt poll)...");
  const session = new MaestroMcpSession(DEVICE_ID ? { deviceId: DEVICE_ID } : {});
  await session.start();
  const seen = new Map(); // text -> { firstSeenAt: iso, firstSeenRound: n, roundsSeen: [n,...] }
  let round = 0;
  let errorInfo = null;
  try {
    await launchKeepSession(session);
    await loginIfNeeded(session);
    console.log("  [PASS] App HS đã login/đứng ở dashboard.");

    console.log(`[3/3] Poll loop (đóng/mở lại icon chuông mỗi ${POLL_INTERVAL_MS}ms)...`);
    while (Date.now() < pollEnd && round < MAX_ROUNDS) {
      round++;
      const roundStartedAt = new Date();
      await openNotification(session);
      const hierarchy = await session.hierarchy();
      const texts = extractNotificationTexts(hierarchy);
      const newTexts = [];
      for (const text of texts) {
        if (!seen.has(text)) {
          seen.set(text, {
            firstSeenAt: roundStartedAt.toISOString(),
            firstSeenRound: round,
            classification: classifyNotificationText(text),
            roundsSeen: [round],
          });
          newTexts.push(text);
        } else {
          seen.get(text).roundsSeen.push(round);
        }
      }
      console.log(
        `  [POLL ${round}] ${roundStartedAt.toISOString()} - tổng ${texts.length} item, ${newTexts.length} text MỚI chưa từng thấy.`,
      );
      for (const t of newTexts) {
        console.log(`    + [${classifyNotificationText(t)}] ${t}`);
      }
      await closeNotification(session);
      if (Date.now() >= pollEnd || round >= MAX_ROUNDS) break;
      await sleep(POLL_INTERVAL_MS);
    }
  } catch (err) {
    errorInfo = { message: err.message, stack: err.stack };
    console.error(`[LỖI ngoài dự kiến ở round ${round}]`, err);
  } finally {
    await session.stop();
  }

  const distinctTexts = [...seen.entries()].map(([text, meta]) => ({ text, ...meta }));
  const reminderFlags = distinctTexts
    .filter((d) => d.classification === "POSSIBLE_DUE_DATE_REMINDER")
    .map((d) => ({ ...d, matchedCandidates: matchReminderToCandidates(d.text, allCandidates) }));

  const status = errorInfo ? "ERROR" : round === 0 ? "NO_ROUNDS_RUN" : "OBSERVED";
  const summary = errorInfo
    ? `Dừng lại vì lỗi ở round ${round}: ${errorInfo.message}`
    : `Chạy ${round} lượt poll (mode=${windowMode}), thấy ${distinctTexts.length} text thông báo khác nhau, trong đó ${reminderFlags.length} item được FLAG là "có vẻ là nhắc hạn nộp" (POSSIBLE_DUE_DATE_REMINDER) - cần người xem lại bằng mắt, script KHÔNG tự PASS/FAIL case TB-02.`;

  return finish({
    status,
    summary,
    windowMode,
    pollWindow: { start: new Date(pollStart).toISOString(), end: new Date(pollEnd).toISOString(), intervalMs: POLL_INTERVAL_MS },
    rounds: round,
    dueStateCandidatesSnapshot: candidatesSnapshot,
    distinctNotificationTexts: distinctTexts,
    reminderFlags,
    error: errorInfo,
  });
}

main().catch((err) => {
  console.error("\n[tb02-check-19h-reminder] Dừng lại vì lỗi ngoài dự kiến:\n");
  console.error(err);
  process.exit(2);
});
