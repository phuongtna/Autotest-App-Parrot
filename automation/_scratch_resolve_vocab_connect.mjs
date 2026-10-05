import { resolveVuiHocExamQuestions } from "./vui_hoc/vuihocQuestionResolver.js";
import { resolveConnectCorrectPairs } from "./bai_tap/navigation/homeworkExamEngine.js";
const { examId, examName, questions } = await resolveVuiHocExamQuestions({
  bookName: "Khối 1", unitName: "Review 1", lessonName: "Vocabulary", exerciseName: "Vocabulary"
});
console.log(examId, examName, questions.length);
questions.forEach((q, i) => {
  if (q.type === "CONNECT") {
    console.log(`[${i}] id=${q.id}`);
    console.log("resolved pairs:", JSON.stringify(resolveConnectCorrectPairs(q), null, 2));
    console.log("raw:", JSON.stringify(q?.metadata?.raw ?? {}, null, 2));
  }
});
