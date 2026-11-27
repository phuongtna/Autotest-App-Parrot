#!/usr/bin/env node
// Investigate-only: find room_id for round6's in-progress assignment ("Choose the correct word to
// complete the sentences about the week", class 4D, due 27/11/2026) after a session-restart killed
// the e2e script mid-run (app left at 2/10 on Doing screen, scratchpad/log lost).
import { fetchAllHomeworkRooms } from "./bai_tap/discovery/homeworks.js";
import { normalizeHomework } from "./bai_tap/model/homeworkModel.js";

const TARGET_CLASS_ID = "b7cc07f2-43a7-4c8c-a4f1-c17a633f38db";
const TITLE = "Choose the correct word to complete the sentences about the week";

async function main() {
  const rawRooms = await fetchAllHomeworkRooms({ period: "MONTH" });
  const matches = rawRooms
    .filter((r) => (r.room?.class_ids ?? []).includes(TARGET_CLASS_ID))
    .map(normalizeHomework)
    .filter((h) => h.title.startsWith(TITLE));
  console.log(JSON.stringify(matches.map((m) => ({ id: m.id, title: m.title, startTime: m.deadline.startTime, endTime: m.deadline.endTime, attemptCount: (m.attempts ?? []).length, attempts: m.attempts })), null, 2));
}
main().catch((e) => { console.error("ERROR", e.message, e.stack); process.exit(2); });
