import { fetchRoomDetails } from "../../../automation/bai_tap/discovery/homeworks.js";
const d = await fetchRoomDetails("bf853c20-4346-4e72-8030-4115acb5ca75");
console.log(JSON.stringify(d, null, 2).slice(0, 3000));
