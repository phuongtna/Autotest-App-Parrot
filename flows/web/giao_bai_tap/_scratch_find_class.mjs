import { listClassesForCurrentYear } from "../../../automation/giao_bai_tap/navigation/teacherAssignmentApiDiscovery.js";

const classes = await listClassesForCurrentYear();
console.log(JSON.stringify(classes, null, 2));
