import { fetchRoomDetails } from "../../../automation/bai_tap/discovery/homeworks.js";
const d = await fetchRoomDetails("3e2da151-4ead-4420-a9ff-aa84b6858826");
const answers = d?.room?.answers || [];
console.log(JSON.stringify(answers.map(a => ({point: a.point, status: a.status, started_at: a.started_at, finished_at: a.finished_at, total_correct: a.total_correct})), null, 2));
