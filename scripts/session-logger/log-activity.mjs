#!/usr/bin/env node
// CLI để ghi 1 "activity" thật (hoặc mở/đóng session tường minh) vào cùng event log mà
// watch.mjs dùng — dùng cho những gì watcher KHÔNG tự phát hiện được bằng adb thuần (ví dụ:
// nội dung bài tập vừa hoàn thành, hoặc "logout" do 1 flow Maestro của TA chạy — watcher không
// đọc được UI text vì tránh xung đột uiautomator với Maestro).
//
// Cách dùng:
//   node scripts/session-logger/log-activity.mjs "G7U2-HW-Lis-BTCB: hoàn thành 5/5, Điểm 10"
//   node scripts/session-logger/log-activity.mjs --start-session --source maestro_flow "Login OTP qua login.yaml"
//   node scripts/session-logger/log-activity.mjs --end-session --reason logout "Xác nhận qua RP-20"
//
// Khuyến nghị: sau khi chạy flows/app/report/RP-20-logout-confirm.yaml thành công, gọi ngay
//   node scripts/session-logger/log-activity.mjs --end-session --reason logout
// để session được đóng đúng lúc logout thật xảy ra, không phải chờ watcher tự suy ra qua màn
// hình khoá (mà có thể không xảy ra ngay).
import { appendEvent, readEvents, deriveSessionState } from "./eventStore.mjs";
import { renderAndWrite } from "./render.mjs";
import { nowIsoLocal } from "./nowIso.mjs";
import { EVENT_LOG_PATH } from "./paths.mjs";

const PROFILE = process.env.PROFILE_NAME || "Trần Duy Anh";
const PHONE = process.env.PROFILE_PHONE || "0915151519";

const argv = process.argv.slice(2);

function flagValue(name) {
  const i = argv.indexOf(name);
  if (i === -1) return null;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
}

const isStart = argv.includes("--start-session");
const isEnd = argv.includes("--end-session");
if (isStart) argv.splice(argv.indexOf("--start-session"), 1);
if (isEnd) argv.splice(argv.indexOf("--end-session"), 1);
const source = flagValue("--source") || "cli";
const reason = flagValue("--reason") || "unknown";
const note = argv.join(" ").trim();

function append(event) {
  appendEvent(EVENT_LOG_PATH, { profile: PROFILE, phone: PHONE, ...event });
  renderAndWrite({ profile: PROFILE, phone: PHONE });
}

const events = readEvents(EVENT_LOG_PATH);
const { open } = deriveSessionState(events, PROFILE);
const nowTs = nowIsoLocal();

if (isEnd) {
  if (!open) {
    console.error("Không có session nào đang mở để đóng.");
    process.exit(1);
  }
  append({ type: "session_end", sessionId: open.sessionId, source, ts: nowTs, end_reason: reason, note: note || undefined });
  console.log(`Đã đóng session ${open.sessionId} (end_reason=${reason}).`);
  process.exit(0);
}

if (isStart) {
  if (open) {
    console.error(`Đã có session đang mở (${open.sessionId}) — không tạo session mới. Đóng session cũ trước nếu cần.`);
    process.exit(1);
  }
  append({ type: "session_start", sessionId: nowTs, source, ts: nowTs, note: note || undefined });
  console.log(`Đã mở session mới ${nowTs}.`);
  process.exit(0);
}

// Ghi activity bình thường — nếu chưa có session mở, tự mở 1 session mới (activity chỉ có thể
// xảy ra khi app đang mở), giữ đúng nguyên tắc "app opened = start session".
if (!note) {
  console.error('Thiếu nội dung activity. Dùng: node log-activity.mjs "nội dung"');
  process.exit(1);
}

let sessionId = open?.sessionId;
if (!open) {
  sessionId = nowTs;
  append({ type: "session_start", sessionId, source, ts: nowTs, note: "Tự động mở session vì có activity được ghi nhận." });
}
append({ type: "activity", sessionId, source, ts: nowIsoLocal(), note });
console.log(`Đã ghi activity vào session ${sessionId}.`);
