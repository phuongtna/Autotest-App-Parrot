// Event store append-only (JSONL) — nguồn sự thật duy nhất cho session/activity. Mỗi lời gọi
// appendEvent() ghi và flush ngay (appendFileSync là I/O đồng bộ), không giữ gì trong memory,
// để app/watcher bị kill giữa chừng không làm mất event đã ghi trước đó.
import { appendFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function appendEvent(path, event) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(event) + "\n", "utf8");
  return event;
}

export function readEvents(path) {
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf8");
  const events = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // dòng hỏng (ví dụ ghi bị cắt giữa chừng do mất điện) - bỏ qua, không làm sập toàn bộ log.
    }
  }
  return events;
}

// Suy ra trạng thái session hiện tại của 1 profile HOÀN TOÀN từ việc replay events theo thứ
// tự — không có state riêng nào được tin hơn file này, để nhiều tiến trình (watcher daemon +
// log-activity CLI) ghi cùng lúc vẫn luôn nhất quán ở lần đọc tiếp theo.
export function deriveSessionState(events, profile) {
  let open = null; // { sessionId, startTs }
  let lastActivityTs = null;
  let inactiveOpenTs = null;

  for (const e of events) {
    if (e.profile !== profile) continue;

    if (e.type === "session_start") {
      open = { sessionId: e.sessionId, startTs: e.ts };
      lastActivityTs = e.ts;
      inactiveOpenTs = null;
      continue;
    }
    if (!open || e.sessionId !== open.sessionId) continue; // event lạc, không thuộc session đang mở

    switch (e.type) {
      case "session_end":
        open = null;
        lastActivityTs = null;
        inactiveOpenTs = null;
        break;
      case "activity":
        lastActivityTs = e.ts;
        inactiveOpenTs = null;
        break;
      case "inactive_start":
        inactiveOpenTs = e.ts;
        break;
      case "inactive_end":
        inactiveOpenTs = null;
        break;
      default:
        break;
    }
  }

  return { open, lastActivityTs, inactiveOpenTs };
}
