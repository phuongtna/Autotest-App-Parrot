#!/usr/bin/env node
// Investigate-only: round6's e2e script was killed by a session restart with log/scratchpad lost.
// Find any room in class 4D created "today" (room.room.created_at ~ 2026-11-26) to see whether
// assignHomeworkFlow even got far enough to create a new room before the crash.
import { fetchAllHomeworkRooms } from "./bai_tap/discovery/homeworks.js";
import { normalizeHomework } from "./bai_tap/model/homeworkModel.js";

const TARGET_CLASS_ID = "b7cc07f2-43a7-4c8c-a4f1-c17a633f38db";

async function main() {
  const rawRooms = await fetchAllHomeworkRooms({ period: "MONTH" });
  const today = rawRooms.filter((r) => (r.room?.class_ids ?? []).includes(TARGET_CLASS_ID) && String(r.room?.created_at ?? "").startsWith("2026-11-26"));
  console.log(JSON.stringify(today.map((r) => {
    const m = normalizeHomework(r);
    return { id: m.id, title: m.title, created_at: r.room?.created_at, startTime: m.deadline.startTime, endTime: m.deadline.endTime, attempts: m.attempts };
  }), null, 2));
}
main().catch((e) => { console.error("ERROR", e.message, e.stack); process.exit(2); });
