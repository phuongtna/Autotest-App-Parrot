// Đọc trạng thái thiết bị qua adb — CHỈ dùng các lệnh dumpsys/pidof "read-only", không dùng
// uiautomator (exclusive lock, sẽ đá nhau với Maestro nếu 1 flow đang chạy đồng thời).
import { execFileSync } from "node:child_process";

const ADB = process.env.ADB_PATH || "adb";

function adb(args, deviceId) {
  const fullArgs = deviceId ? ["-s", deviceId, ...args] : args;
  return execFileSync(ADB, fullArgs, { encoding: "utf8", timeout: 5000 });
}

function getForegroundPackage(deviceId) {
  const out = adb(["shell", "dumpsys", "window"], deviceId);
  const m = out.match(/mCurrentFocus=Window\{[^}]*\s([\w.]+)\/[\w.]+\}/);
  return m ? m[1] : null;
}

function getScreenInteractive(deviceId) {
  const out = adb(["shell", "dumpsys", "power"], deviceId);
  const m = out.match(/mWakefulness=(\w+)/);
  if (!m) return null; // không đọc được -> để tầng gọi quyết định (coi là lỗi, không suy đoán)
  return m[1] === "Awake";
}

function getProcessAlive(appId, deviceId) {
  try {
    const out = adb(["shell", "pidof", appId], deviceId);
    return out.trim().length > 0;
  } catch {
    // pidof exit code != 0 khi không có process nào khớp -> execFileSync throw, đây là kết quả
    // hợp lệ "không chạy", không phải lỗi adb.
    return false;
  }
}

// Đọc 1 lần đủ cả 3 tín hiệu cần cho vòng lặp watcher. Trả {ok:false, error} nếu adb/thiết bị
// không phản hồi được (KHÔNG suy ra màn hình tắt/app đóng từ lỗi adb - xem watch.mjs).
export function pollDeviceOnce(appId, deviceId) {
  try {
    const fg = getForegroundPackage(deviceId);
    const screenOn = getScreenInteractive(deviceId);
    const procAlive = getProcessAlive(appId, deviceId);
    if (screenOn === null) {
      return { ok: false, error: "Không đọc được mWakefulness từ dumpsys power" };
    }
    return { ok: true, fg, screenOn, procAlive };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}
