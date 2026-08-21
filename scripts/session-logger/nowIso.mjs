// ISO 8601 CÓ offset local (không dùng Date#toISOString() vì nó luôn quy về UTC "Z", khó đọc
// khi đối chiếu bằng mắt với log Maestro/usagestats đều hiển thị giờ local +07).
export function nowIsoLocal(date = new Date()) {
  const tzOffsetMin = -date.getTimezoneOffset();
  const sign = tzOffsetMin >= 0 ? "+" : "-";
  const pad2 = (n) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  const offH = pad2(tzOffsetMin / 60);
  const offM = pad2(tzOffsetMin % 60);
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}${sign}${offH}:${offM}`;
}
