#!/usr/bin/env node
// Investigate-only: find room_id for round7's already-created-but-unstarted assignment ("Read the
// paragraph and decide whether each statement is True (T) or False (F).", class 4D, due 02/12/2026)
// WITHOUT re-assigning (recover-in-place - the room already exists, confirmed 0/10 on-app via
// findAssignment(), re-running the main script would create a duplicate orphaned room).
import { fetchAllHomeworkRooms } from "./bai_tap/discovery/homeworks.js";
import { normalizeHomework } from "./bai_tap/model/homeworkModel.js";

const TARGET_CLASS_ID = "b7cc07f2-43a7-4c8c-a4f1-c17a633f38db";
const TITLE = "Read the paragraph and decide whether each statement is True (T) or False (F).";

async function main() {
  const rawRooms = await fetchAllHomeworkRooms({ period: "MONTH" });
  const matches = rawRooms
    .filter((r) => (r.room?.class_ids ?? []).includes(TARGET_CLASS_ID))
    .map(normalizeHomework)
    .filter((h) => h.title === TITLE);
  console.log(JSON.stringify(matches.map((m) => ({ id: m.id, title: m.title, startTime: m.deadline.startTime, endTime: m.deadline.endTime, attemptCount: (m.attempts ?? []).length, attempts: m.attempts })), null, 2));
}
main().catch((e) => { console.error("ERROR", e.message, e.stack); process.exit(2); });
