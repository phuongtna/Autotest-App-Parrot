import { config, requireTeacherPortalConfig } from "../../../automation/src/config.js";
import { fetchRoomDetails } from "../../../automation/bai_tap/discovery/homeworks.js";

async function rawFetch(path) {
  requireTeacherPortalConfig();
  const res = await fetch(`${config.teacherPortalBaseUrl}${path}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.teacherAccessToken}`,
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
  const json = await res.json().catch(() => null);
  return json?.data;
}

const LESSON_ITEM_ID = process.env.LESSON_ITEM_ID;
const CLASS_ID = process.env.CLASS_ID;
const DUE_PREFIX = process.env.DUE_PREFIX;

const matches = [];
for (let page = 1; page <= 6; page++) {
  const rows = (await rawFetch(`/api/user/exams/room.json?limit=50&page=${page}&_ts=${Date.now()}`)) || [];
  if (rows.length === 0) break;
  for (const row of rows) {
    const room = row.room;
    if (room?.lesson_item_id === LESSON_ITEM_ID && (room?.class_ids || []).includes(CLASS_ID)) {
      matches.push({ id: room.id, endTime: room.end_time });
    }
  }
}
const scoped = DUE_PREFIX ? matches.filter((m) => (m.endTime || "").startsWith(DUE_PREFIX)) : matches;
console.log("[MATCHES]", JSON.stringify(scoped, null, 2));

for (const m of scoped) {
  const details = await fetchRoomDetails(m.id);
  const answers = details?.room?.answers || [];
  console.log(`[ROOM ${m.id}] answers=${answers.length}`, JSON.stringify(answers.map((a) => ({
    user_id: a.user_id, point: a.point, status: a.status, started_at: a.started_at, finished_at: a.finished_at,
  }))));
}
