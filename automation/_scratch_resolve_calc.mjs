import { resolveVuiHocExamQuestions } from "./vui_hoc/vuihocQuestionResolver.js";
import { resolveFillWordValues } from "./bai_tap/navigation/homeworkExamEngine.js";
const { examId, examName, questions } = await resolveVuiHocExamQuestions({
  bookName: "Khối 6", unitName: "Unit 1: My new school", lessonName: "Vocabulary", exerciseName: "calculator"
});
console.log(examId, examName, questions.length);
const q = questions[0];
console.log("correct values:", resolveFillWordValues(q));
console.log("raw:", JSON.stringify(q?.metadata?.raw ?? q, null, 2).slice(0, 2000));
