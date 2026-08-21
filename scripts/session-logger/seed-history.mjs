#!/usr/bin/env node
// Seed 1 LẦN các session lịch sử đã xác minh TRƯỚC KHI có watcher tự động (2026-08-20 và
// 2026-08-21, đến trước lúc watcher chạy) — đúng những gì đã đối chiếu thủ công qua Maestro log
// + usagestats trong cuộc trao đổi trước đó. KHÔNG bịa thêm mốc nào ngoài các mốc đã xác minh.
// Chạy 1 lần duy nhất (script tự chặn nếu event log đã có dữ liệu, tránh seed trùng).
import { appendEvent, readEvents } from "./eventStore.mjs";
import { renderAndWrite } from "./render.mjs";
import { EVENT_LOG_PATH } from "./paths.mjs";

const PROFILE = "Trần Duy Anh";
const PHONE = "0915151519";

const existing = readEvents(EVENT_LOG_PATH);
if (existing.length > 0) {
  console.error(`${EVENT_LOG_PATH} đã có ${existing.length} event — không seed lại (tránh trùng). Xoá file nếu thật sự muốn seed lại từ đầu.`);
  process.exit(1);
}

const events = [
  // ---- 2026-08-20 — session #1: chỉ biết được mốc kết thúc (usagestats rolling 24h không còn
  // giữ mốc bắt đầu vào lúc phát hiện, 2026-08-21) ----
  {
    ts: null,
    type: "session_start",
    sessionId: "2026-08-20-unknown-start",
    source: "usagestats_reconciliation",
    note: "start_time = unknown — thiết bị chỉ giữ usagestats rolling 24h, mốc bắt đầu thật đã nằm ngoài cửa sổ lưu trữ lúc phát hiện (21/08).",
  },
  {
    ts: "2026-08-20T17:49:31+07:00",
    type: "session_end",
    sessionId: "2026-08-20-unknown-start",
    source: "usagestats_reconciliation",
    end_reason: "screen_locked",
    note: "Xác nhận qua adb shell dumpsys usagestats --history (SCREEN_NON_INTERACTIVE ngay sau ACTIVITY_STOPPED của app).",
  },

  // ---- 2026-08-21 — session #1 ----
  {
    ts: "2026-08-21T08:42:00+07:00",
    type: "session_start",
    sessionId: "2026-08-21T08:42:00+07:00",
    source: "manual_note",
    note: "Login — ghi từ note thủ công trước khi có đối chiếu usagestats cho phiên này.",
  },
  {
    ts: "2026-08-21T09:20:00+07:00",
    type: "activity",
    sessionId: "2026-08-21T08:42:00+07:00",
    source: "manual_note",
    note: 'G7U2-HW-Lis-BTCB (Listening): làm câu 1-4/5, chưa hoàn thành (mất mạng giữa chừng 2 lần, mốc giờ ước lượng trong khoảng phiên).',
  },
  {
    ts: "2026-08-21T09:37:00+07:00",
    type: "session_end",
    sessionId: "2026-08-21T08:42:00+07:00",
    source: "manual_note",
    end_reason: "manual_stop_unverified",
    note: "Dừng theo yêu cầu (mạng chập chờn) — chưa xác minh bằng usagestats nên chưa rõ lý do kết thúc thật là logout hay màn hình khoá.",
  },

  // ---- 2026-08-21 — session #2 ----
  {
    ts: "2026-08-21T09:44:35+07:00",
    type: "session_start",
    sessionId: "2026-08-21T09:44:35+07:00",
    source: "maestro_flow",
    note: "Login thật (OTP) — xác nhận qua log Maestro (helpers/login.yaml).",
  },
  {
    ts: "2026-08-21T09:50:00+07:00",
    type: "activity",
    sessionId: "2026-08-21T09:44:35+07:00",
    source: "maestro_flow",
    note: 'G7U2-HW-Lis-BTCB: HOÀN THÀNH (5/5 câu, Điểm 10, "Bài tập 3/6" trên màn kết quả) — mốc giờ ước lượng trong khoảng 09:44-10:00 (chưa có timestamp Maestro chính xác đến giây cho bước này).',
  },
  {
    ts: "2026-08-21T12:21:56+07:00",
    type: "inactive_start",
    sessionId: "2026-08-21T09:44:35+07:00",
    source: "usagestats_reconciliation",
    note: "App về background ~2 phút (chưa tắt màn hình, chưa logout) — không tách session.",
  },
  {
    ts: "2026-08-21T12:23:59+07:00",
    type: "inactive_end",
    sessionId: "2026-08-21T09:44:35+07:00",
    source: "usagestats_reconciliation",
    note: "App mở lại foreground.",
  },
  {
    ts: "2026-08-21T16:03:11+07:00",
    type: "session_end",
    sessionId: "2026-08-21T09:44:35+07:00",
    source: "usagestats_reconciliation",
    end_reason: "screen_locked",
    note: "Xác nhận qua adb shell dumpsys usagestats --history (SCREEN_NON_INTERACTIVE).",
  },

  // ---- 2026-08-21 — session #3 ----
  {
    ts: "2026-08-21T16:50:38+07:00",
    type: "session_start",
    sessionId: "2026-08-21T16:50:38+07:00",
    source: "usagestats_reconciliation",
    note: "Màn hình sáng lại lúc 16:46:46 (còn ở launcher), app thực sự mở foreground lúc 16:50:38 (profile đã đăng nhập sẵn).",
  },
  {
    ts: "2026-08-21T17:12:16+07:00",
    type: "session_end",
    sessionId: "2026-08-21T16:50:38+07:00",
    source: "maestro_flow",
    end_reason: "logout",
    note: 'Xác nhận qua log Maestro (flows/app/report/RP-20-logout-confirm.yaml) — về màn "Nhập số điện thoại".',
  },
];

for (const e of events) {
  appendEvent(EVENT_LOG_PATH, { profile: PROFILE, phone: PHONE, ...e });
}
renderAndWrite({ profile: PROFILE, phone: PHONE });
console.log(`Đã seed ${events.length} event vào ${EVENT_LOG_PATH} và render lại activity_log_tranduyanh.md.`);
