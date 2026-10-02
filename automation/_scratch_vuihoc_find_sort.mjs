import { parseQuestionsFromExamPageWithRetry } from "./discovery/examPageScraper.js";
import { normalizeQuestions } from "./model/questionModel.js";
const examData = await parseQuestionsFromExamPageWithRetry("f6844a09-37c7-4052-bddb-df5790084479");
const questions = normalizeQuestions(examData);
const sortQ = questions.find((q) => q.type === "SORT");
console.log(JSON.stringify(sortQ, null, 2));
