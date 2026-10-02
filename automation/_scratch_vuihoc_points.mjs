import { parseQuestionsFromExamPageWithRetry } from "./discovery/examPageScraper.js";
import { normalizeQuestions } from "./model/questionModel.js";
for (const examId of process.argv.slice(2)) {
  const examData = await parseQuestionsFromExamPageWithRetry(examId);
  const questions = normalizeQuestions(examData);
  const points = questions.map((q) => q.metadata?.point);
  const total = points.reduce((a, b) => a + (Number(b) || 0), 0);
  console.log(`exam=${examId} examName=${examData.examName} n=${questions.length} points=${JSON.stringify(points)} sum=${total}`);
}
