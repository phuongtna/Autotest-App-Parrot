import { resolveVuiHocExamQuestions } from "./vui_hoc/vuihocQuestionResolver.js";
const { examId, examName, questions } = await resolveVuiHocExamQuestions({
  bookName: "Khối 1", unitName: "Review 1", lessonName: "Vocabulary", exerciseName: "Vocabulary"
});
questions.forEach((q, i) => {
  if (q.type === "CONNECT") {
    const raw = q?.metadata?.raw ?? {};
    console.log(`=== [${i}] id=${q.id} ===`);
    console.log("answers:", JSON.stringify(raw.answers?.map(a => ({id:a.id, group:a.group, label:a.label, image:a.image?.slice(-40), audio: !!a.audio})), null, 2));
    console.log("correct:", JSON.stringify(raw.correct, null, 2));
  }
});
