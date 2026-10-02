import { parseQuestionsFromExamPageWithRetry } from "./discovery/examPageScraper.js";
import { normalizeQuestions } from "./model/questionModel.js";

const examId = process.argv[2];
const examData = await parseQuestionsFromExamPageWithRetry(examId);
const questions = normalizeQuestions(examData);
console.log(`examName=${examData.examName} totalQuestions=${questions.length}`);
for (const q of questions) {
  console.log("----");
  console.log(`id=${q.id} type=${q.type}`);
  console.log("raw.question.content_label=", q.metadata?.raw?.question?.content_label);
  console.log("raw.question.content=", q.metadata?.raw?.question?.content);
  console.log("raw.answers=", JSON.stringify(q.metadata?.raw?.answers));
  console.log("raw.correct=", JSON.stringify(q.metadata?.raw?.correct));
}
