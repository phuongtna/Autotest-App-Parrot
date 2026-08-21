// Sinh test_data/activity_log_tranduyanh.md từ test_data/session_events.jsonl. File .md là
// PRODUCT của events, không phải nguồn sự thật — không sửa tay .md nữa, mọi sửa đổi phải đi qua
// event log (watch.mjs / log-activity.mjs / seed-history.mjs) rồi chạy lại render.
import { writeFileSync } from "node:fs";
import { readEvents } from "./eventStore.mjs";
import { ACTIVITY_MD_PATH, EVENT_LOG_PATH } from "./paths.mjs";

const END_REASON_LABEL = {
  logout: "Logout",
  screen_locked: "Màn hình điện thoại khoá/tắt thật",
  app_terminated: "Process bị chấm dứt (crash / force-stop / bị hệ thống kill)",
  device_unreachable: "Mất kết nối thiết bị (adb không phản hồi liên tục)",
  manual_stop_unverified: "Dừng theo yêu cầu thủ công (chưa xác minh được bằng chứng thiết bị)",
  unknown: "Không xác định",
};

function fmtTs(ts) {
  if (!ts) return "không rõ";
  const m = ts.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  if (!m) return ts;
  return `${m[2]} +0700`;
}

function dateOf(ts) {
  if (!ts) return null;
  return ts.slice(0, 10);
}

function fmtDuration(startTs, endTs) {
  if (!startTs || !endTs) return "không xác định (thiếu mốc bắt đầu hoặc kết thúc thật)";
  const ms = Date.parse(endTs) - Date.parse(startTs);
  if (!Number.isFinite(ms) || ms < 0) return "không xác định";
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts = [];
  if (h) parts.push(`${h} giờ`);
  if (m) parts.push(`${m} phút`);
  if (s || (!h && !m)) parts.push(`${s} giây`);
  return parts.join(" ");
}

function groupIntoSessions(events, profile) {
  const forProfile = events.filter((e) => e.profile === profile);
  const sessions = [];
  const bySessionId = new Map();

  for (const e of forProfile) {
    if (e.type === "session_start") {
      const s = { sessionId: e.sessionId, startTs: e.ts, startSource: e.source, startNote: e.note, rows: [], endTs: null, endReason: null, endNote: null };
      bySessionId.set(e.sessionId, s);
      sessions.push(s);
      continue;
    }
    const s = bySessionId.get(e.sessionId);
    if (!s) continue; // event không khớp session nào đã biết -> bỏ (không nên xảy ra với event store hợp lệ)
    if (e.type === "session_end") {
      s.endTs = e.ts;
      s.endReason = e.end_reason || "unknown";
      s.endNote = e.note;
    } else {
      s.rows.push(e);
    }
  }
  return sessions;
}

export function renderMarkdown(events, { profile, phone }) {
  const sessions = groupIntoSessions(events, profile);

  // Nhóm theo ngày (theo startTs nếu biết, không thì theo endTs), sắp theo thời gian, đánh số
  // lại từ #1 mỗi ngày.
  const byDate = new Map();
  for (const s of sessions) {
    const d = dateOf(s.startTs) || dateOf(s.endTs) || "không-rõ-ngày";
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(s);
  }
  const dates = [...byDate.keys()].sort();

  let out = `# Activity log — tài khoản ${phone} / profile "${profile}"\n\n`;
  out += `Log này được sinh TỰ ĐỘNG bởi \`scripts/session-logger/render.mjs\` từ \`test_data/session_events.jsonl\`\n`;
  out += `(nguồn sự thật duy nhất, append-only, ghi liên tục trong lúc dùng app). KHÔNG sửa tay\n`;
  out += `file này — mọi thay đổi phải đi qua event log rồi render lại. Xem \`scripts/session-logger/\`\n`;
  out += `để biết cách chạy watcher liên tục / ghi activity / seed lịch sử.\n\n`;

  out += `## Quy ước session\n\n`;
  out += `- **session_start**: ngay khi login thành công, HOẶC ngay khi mở app mà profile đã đăng nhập sẵn.\n`;
  out += `- **session_end**: CHỈ khi (a) logout, (b) màn hình điện thoại khoá/tắt thật, (c) process bị\n`;
  out += `  chấm dứt (crash/force-stop/kill), hoặc (d) mất kết nối thiết bị kéo dài. Không thao tác\n`;
  out += `  trong một khoảng thời gian KHÔNG kết thúc session — chỉ ghi "không thao tác", session vẫn\n`;
  out += `  tiếp diễn.\n`;
  out += `- App về background một chút (screen vẫn sáng, chưa logout) rồi mở lại → vẫn cùng session.\n`;
  out += `- Logout rồi login lại → luôn tạo session mới.\n`;
  out += `- Chỉ ghi hoạt động thật của user (mở/chuyển màn hình, làm bài, hoàn thành bài, dùng chức\n`;
  out += `  năng...). KHÔNG ghi debug/kỹ thuật ở đây — xem \`test_data/session_watcher_debug.log\` và\n`;
  out += `  memory riêng (ví dụ project_switch_profile_confirm_button_bug).\n`;
  out += `- \`adb shell dumpsys usagestats --history\` chỉ dùng để ĐỐI CHIẾU/RECOVERY khi watcher bị\n`;
  out += `  gián đoạn, không phải nguồn ghi chính — và thiết bị chỉ giữ rolling 24h nên không phải lúc\n`;
  out += `  nào cũng recover được.\n\n`;

  for (const d of dates) {
    out += `## Sessions — ${d === "không-rõ-ngày" ? "(không xác định ngày)" : d}\n\n`;
    const list = byDate.get(d).sort((a, b) => (Date.parse(a.startTs || a.endTs) || 0) - (Date.parse(b.startTs || b.endTs) || 0));
    list.forEach((s, idx) => {
      const startLabel = s.startTs ? fmtTs(s.startTs) : "không rõ";
      const endLabel = s.endTs ? fmtTs(s.endTs) : "(đang diễn ra)";
      out += `### Session #${idx + 1} — ${startLabel} → ${endLabel}\n`;
      out += `| Mốc | Loại | Nội dung |\n|---|---|---|\n`;
      out += `| ${s.startTs ? fmtTs(s.startTs) : "không rõ"} | session_start${s.startSource ? ` (${s.startSource})` : ""} | ${s.startNote || ""} |\n`;

      for (const row of s.rows.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))) {
        if (row.type === "activity") {
          out += `| ${fmtTs(row.ts)} | activity | ${row.note || ""} |\n`;
        } else if (row.type === "inactive_start") {
          out += `| ${fmtTs(row.ts)} | không thao tác (bắt đầu) | ${row.note || "Vẫn cùng session, chưa kết thúc"} |\n`;
        } else if (row.type === "inactive_end") {
          out += `| ${fmtTs(row.ts)} | không thao tác (kết thúc) | ${row.note || ""} |\n`;
        }
      }

      if (s.endTs || s.endReason) {
        out += `| ${s.endTs ? fmtTs(s.endTs) : "không rõ"} | session_end | end_reason = **${s.endReason || "unknown"}** (${END_REASON_LABEL[s.endReason] || "?"})${s.endNote ? " — " + s.endNote : ""} |\n`;
        out += `| | session_duration | ${fmtDuration(s.startTs, s.endTs)} |\n`;
      } else {
        out += `| (hiện tại) | session_status | Đang mở, chưa kết thúc |\n`;
      }
      out += `\n`;
    });
  }

  return out;
}

export function renderAndWrite({ profile, phone }) {
  const events = readEvents(EVENT_LOG_PATH);
  const md = renderMarkdown(events, { profile, phone });
  writeFileSync(ACTIVITY_MD_PATH, md, "utf8");
  return md;
}
