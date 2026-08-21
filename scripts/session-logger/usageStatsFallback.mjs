// FALLBACK/RECOVERY ONLY (yêu cầu #7) — không được dùng làm nguồn chính. Dùng khi watcher vừa
// khởi động lại và phát hiện 1 session cũ còn "mở" nhưng trạng thái máy hiện tại đã khác: tra
// `adb shell dumpsys usagestats --history` để cố tìm bằng chứng THẬT về thời điểm/lý do kết
// thúc, thay vì đoán. Thiết bị chỉ giữ history dạng rolling 24h (xem
// memory/project_report_test_activity_log.md) — nếu session cũ hơn 24h thì sẽ không tìm được
// gì, và bên gọi phải ghi end = "unknown", KHÔNG suy đoán thời điểm.
import { execFileSync } from "node:child_process";

const ADB = process.env.ADB_PATH || "adb";
const LINE_RE =
  /time="(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})"\s+type=(\S+)\s+package=(\S+)/;

function toLocalIso(dumpsysTs) {
  // dumpsys in ra "yyyy-MM-dd HH:mm:ss" giờ local của thiết bị (không có offset) - thiết bị
  // test và host cùng timezone +07 (đã xác nhận thủ công), nên format lại thành ISO +07:00.
  const [datePart, timePart] = dumpsysTs.split(" ");
  return `${datePart}T${timePart}+07:00`;
}

export function tryReconcileViaUsageStats({ appId, deviceId, sinceIso }) {
  let raw;
  try {
    const args = deviceId
      ? ["-s", deviceId, "shell", "dumpsys", "usagestats", "--history"]
      : ["shell", "dumpsys", "usagestats", "--history"];
    raw = execFileSync(ADB, args, { encoding: "utf8", timeout: 15000, maxBuffer: 32 * 1024 * 1024 });
  } catch (err) {
    return { found: false, reason: null, ts: null, note: `Không đọc được usagestats: ${err.message}` };
  }

  const sinceMs = sinceIso ? Date.parse(sinceIso) : null;
  const events = [];
  for (const line of raw.split("\n")) {
    const m = line.match(LINE_RE);
    if (!m) continue;
    const [, tsRaw, type, pkg] = m;
    const iso = toLocalIso(tsRaw);
    const ms = Date.parse(iso);
    if (sinceMs !== null && ms < sinceMs) continue;
    events.push({ ts: iso, ms, type, pkg });
  }
  events.sort((a, b) => a.ms - b.ms);

  if (sinceMs !== null && events.length && events[0].ms - sinceMs > 24 * 3600 * 1000) {
    // an toàn thừa: nếu event sớm nhất tìm được đã cách sinceIso >24h, dữ liệu chắc chắn thiếu đoạn đầu.
  }

  // Ưu tiên tìm SCREEN_NON_INTERACTIVE sau khi app đã dừng foreground (== khoá màn hình thật).
  let lastAppForegroundEnd = null;
  for (const e of events) {
    if (e.pkg !== appId) continue;
    if (e.type === "ACTIVITY_STOPPED" || e.type === "ACTIVITY_PAUSED") lastAppForegroundEnd = e;
  }
  const screenOff = events.find(
    (e) => e.type === "SCREEN_NON_INTERACTIVE" && (!lastAppForegroundEnd || e.ms >= lastAppForegroundEnd.ms)
  );
  if (screenOff) {
    return { found: true, reason: "screen_locked", ts: screenOff.ts, note: "Suy ra từ usagestats --history (SCREEN_NON_INTERACTIVE)." };
  }

  if (lastAppForegroundEnd) {
    return {
      found: true,
      reason: "unknown",
      ts: lastAppForegroundEnd.ts,
      note: `Chỉ tìm được mốc app rời foreground (${lastAppForegroundEnd.type}) từ usagestats, không xác định được lý do kết thúc thật (không có SCREEN_NON_INTERACTIVE liền sau).`,
    };
  }

  return { found: false, reason: null, ts: null, note: "Không tìm thấy bằng chứng nào trong phạm vi usagestats còn lưu (rolling 24h)." };
}
