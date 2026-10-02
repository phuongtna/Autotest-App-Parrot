import { resolveVuiHocExamQuestions } from "./vui_hoc/vuihocQuestionResolver.js";
const r = await resolveVuiHocExamQuestions({bookName:"Khối 8", unitName:"Review 4", lessonName:"Language", exerciseName:"Đề part 1"});
console.log("examId=", r.examId, "examName=", r.examName, "count=", r.questions.length);
const hit = r.questions.find(q => JSON.stringify(q.metadata?.raw).includes("interact"));
console.log("has 'interact' question:", !!hit);
console.log(JSON.stringify(r.questions.map(q=>q.type)));
