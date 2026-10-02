import { resolveVuiHocExamQuestions } from "./vui_hoc/vuihocQuestionResolver.js";
const { examId, examName, questions } = await resolveVuiHocExamQuestions({
  bookName: "Khối 1", unitName: "Review 1", lessonName: "Phonics", exerciseName: "Phonics"
});
console.log(examId, examName, questions.length);
questions.forEach((q, i) => {
  if (q.type === "DRAG_DROP") {
    console.log(`[${i}] id=${q.id} raw=${JSON.stringify(q?.metadata?.raw ?? {}, null, 2)}`);
  }
});
