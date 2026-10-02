import { parseQuestionsFromExamPageWithRetry } from "./discovery/examPageScraper.js";
import { normalizeQuestions } from "./model/questionModel.js";

const examId = process.argv[2];
const examData = await parseQuestionsFromExamPageWithRetry(examId);
const questions = normalizeQuestions(examData);
console.log(`exam="${examData.examName}" N=${questions.length}`);
questions.forEach((q, i) => {
  console.log(`[${i}] id=${q.id} type=${q.type} point=${q?.metadata?.point ?? q?.point ?? "?"} content=${JSON.stringify((q.content || q.title || "").toString().slice(0,80))}`);
});
