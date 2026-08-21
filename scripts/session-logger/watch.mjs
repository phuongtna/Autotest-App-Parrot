#!/usr/bin/env node
// Watcher liên tục: START SESSION khi mở app → theo dõi (idle KHÔNG kết thúc session) →
// END SESSION chỉ khi logout / màn hình khoá / process chết / mất kết nối thiết bị kéo dài.
//
// Chạy: node scripts/session-logger/watch.mjs
// Dừng: Ctrl+C (KHÔNG tự đóng session đang mở — dừng watcher != app đóng, xem recover() dưới).
// Kiểm tra đang chạy đúng: tail -f test_data/session_events.jsonl (phải có dòng mới mỗi khi có
// biến động thật), và test_data/activity_log_tranduyanh.md được viết lại ngay sau mỗi event.
import { pollDeviceOnce } from "./adbState.mjs";
import { appendEvent, readEvents, deriveSessionState } from "./eventStore.mjs";
import { renderAndWrite } from "./render.mjs";
import { tryReconcileViaUsageStats } from "./usageStatsFallback.mjs";
import { debugLog } from "./debugLog.mjs";
import { nowIsoLocal } from "./nowIso.mjs";
import { EVENT_LOG_PATH } from "./paths.mjs";
import { config } from "../../automation/src/config.js";

const APP_ID = process.env.APP_ID || config.appId;
const DEVICE_ID = process.env.DEVICE_ID || process.env.ANDROID_SERIAL || undefined;
const PROFILE = process.env.PROFILE_NAME || "Trần Duy Anh";
const PHONE = process.env.PROFILE_PHONE || "0915151519";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 5000);
const IDLE_THRESHOLD_MS = Number(process.env.IDLE_THRESHOLD_MS || 5 * 60 * 1000);
const MAX_CONSECUTIVE_FAILURES = 3;

if (!APP_ID) {
  console.error("Thiếu APP_ID (đặt trong .env hoặc env APP_ID) — không biết theo dõi app nào.");
  process.exit(1);
}

let consecutiveFailures = 0;
let running = true;

function log(message) {
  console.log(`[${nowIsoLocal()}] ${message}`);
}

function append(event) {
  const withDefaults = { profile: PROFILE, phone: PHONE, ...event };
  appendEvent(EVENT_LOG_PATH, withDefaults);
  renderAndWrite({ profile: PROFILE, phone: PHONE });
  return withDefaults;
}

// Yêu cầu #8: khi watcher khởi động (lần đầu hoặc sau khi bị dừng/crash), kiểm tra có session
// cũ còn "mở" không, và nếu có thì xử lý rõ ràng — KHÔNG tự tạo dữ liệu trùng, KHÔNG bịa mốc.
function recoverOnStart() {
  const events = readEvents(EVENT_LOG_PATH);
  const { open } = deriveSessionState(events, PROFILE);
  if (!open) {
    log("Không có session nào đang mở từ trước — sẽ tạo session mới khi phát hiện app foreground.");
    return;
  }

  log(`Phát hiện session cũ đang mở: ${open.sessionId} (bắt đầu ${open.startTs || "không rõ"}).`);
  const state = pollDeviceOnce(APP_ID, DEVICE_ID);
  const stillPlausiblyOpen = state.ok && state.screenOn && state.procAlive;

  if (stillPlausiblyOpen) {
    log("Trạng thái máy hiện tại vẫn khớp (màn hình sáng + process alive) — tiếp tục session cũ, không tạo session mới.");
    return;
  }

  debugLog(
    `Recovery: session ${open.sessionId} không còn khớp trạng thái máy hiện tại ` +
      `(ok=${state.ok}, screenOn=${state.screenOn}, procAlive=${state.procAlive}). Thử đối chiếu usagestats.`
  );
  const reconciled = tryReconcileViaUsageStats({ appId: APP_ID, deviceId: DEVICE_ID, sinceIso: open.startTs });

  if (reconciled.found) {
    log(`Đối chiếu usagestats tìm được bằng chứng: end_reason=${reconciled.reason} lúc ${reconciled.ts}.`);
    append({
      type: "session_end",
      sessionId: open.sessionId,
      source: "usagestats_reconciliation",
      ts: reconciled.ts,
      end_reason: reconciled.reason,
      note: reconciled.note,
    });
  } else {
    log("Không đối chiếu được bằng usagestats (hết hạn lưu trữ hoặc không tìm thấy) — đóng session với end=unknown, KHÔNG bịa mốc.");
    append({
      type: "session_end",
      sessionId: open.sessionId,
      source: "recovery_unknown",
      ts: null,
      end_reason: "unknown",
      note: `Watcher không chạy liên tục qua khoảng này. ${reconciled.note}`,
    });
  }
}

function tick() {
  const state = pollDeviceOnce(APP_ID, DEVICE_ID);

  if (!state.ok) {
    consecutiveFailures += 1;
    debugLog(`Poll adb thất bại (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}): ${state.error}`);
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      const events = readEvents(EVENT_LOG_PATH);
      const { open } = deriveSessionState(events, PROFILE);
      if (open) {
        log(`Mất kết nối thiết bị ${MAX_CONSECUTIVE_FAILURES} lần liên tiếp — đóng session ${open.sessionId} (device_unreachable).`);
        append({
          type: "session_end",
          sessionId: open.sessionId,
          source: "watcher",
          ts: nowIsoLocal(),
          end_reason: "device_unreachable",
          note: `adb không phản hồi ${MAX_CONSECUTIVE_FAILURES} lần liên tiếp: ${state.error}`,
        });
      }
    }
    return;
  }
  consecutiveFailures = 0;

  const events = readEvents(EVENT_LOG_PATH);
  const { open, lastActivityTs, inactiveOpenTs } = deriveSessionState(events, PROFILE);
  const nowTs = nowIsoLocal();

  if (!open) {
    if (state.procAlive && state.screenOn && state.fg === APP_ID) {
      log(`App foreground + màn hình sáng + process alive → session_start (${nowTs}).`);
      append({
        type: "session_start",
        sessionId: nowTs,
        source: "watcher",
        ts: nowTs,
        note: "Tự động phát hiện: app foreground + màn hình sáng + process alive.",
      });
    }
    return;
  }

  if (!state.procAlive) {
    log(`Process ${APP_ID} không còn tồn tại → session_end (app_terminated).`);
    append({
      type: "session_end",
      sessionId: open.sessionId,
      source: "watcher",
      ts: nowTs,
      end_reason: "app_terminated",
      note: "Process không còn tồn tại (pidof rỗng) khi màn hình vẫn sáng — nghi crash/force-stop/bị hệ thống kill.",
    });
    return;
  }

  if (!state.screenOn) {
    log("Màn hình khoá/tắt → session_end (screen_locked).");
    append({
      type: "session_end",
      sessionId: open.sessionId,
      source: "watcher",
      ts: nowTs,
      end_reason: "screen_locked",
      note: "mWakefulness != Awake.",
    });
    return;
  }

  // Vẫn trong session (screen on & process alive) — app có thể đang KHÔNG ở foreground (về
  // home 1 chút) nhưng đó vẫn chỉ là "không thao tác", không kết thúc session.
  if (lastActivityTs) {
    const idleMs = Date.now() - Date.parse(lastActivityTs);
    if (idleMs >= IDLE_THRESHOLD_MS && !inactiveOpenTs) {
      append({
        type: "inactive_start",
        sessionId: open.sessionId,
        source: "watcher",
        ts: lastActivityTs,
        note: `Không có activity nào trong >= ${Math.round(IDLE_THRESHOLD_MS / 60000)} phút. Session vẫn tiếp diễn.`,
      });
    }
  }
}

process.on("SIGINT", () => {
  log("Nhận SIGINT — dừng watcher. Session đang mở (nếu có) được GIỮ NGUYÊN, không tự đóng (dừng watcher != đóng app).");
  running = false;
  process.exit(0);
});
process.on("SIGTERM", () => {
  log("Nhận SIGTERM — dừng watcher, session đang mở (nếu có) được giữ nguyên.");
  running = false;
  process.exit(0);
});

log(`Bắt đầu watcher cho ${APP_ID} / profile "${PROFILE}" (poll mỗi ${POLL_INTERVAL_MS}ms).`);
recoverOnStart();
renderAndWrite({ profile: PROFILE, phone: PHONE });

const interval = setInterval(() => {
  if (!running) {
    clearInterval(interval);
    return;
  }
  try {
    tick();
  } catch (err) {
    debugLog(`Lỗi không mong đợi trong tick(): ${err?.stack || err}`);
  }
}, POLL_INTERVAL_MS);
