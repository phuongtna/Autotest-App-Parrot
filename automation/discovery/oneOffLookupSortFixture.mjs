// One-off targeted lookup (KHÔNG phải pipeline discovery mới) - dùng lại các module đã
// confirmed trong automation/discovery/ + automation/model/questionModel.js để re-verify
// CMS type/shape của câu hỏi index 17 trong exam của Exercise "Đề part 1" (Khối 6, Review 4,
// Language) - exerciseId đã biết từ phiên trước (1ea73b9a-ad9a-4400-90e7-44106c24a488).
//
// Mục đích: xác nhận lại raw type + shape (answers/correct) qua CMS/API TRƯỚC khi tốn thời
// gian thiết bị thật, đúng theo rule "kiểm tra payload/metadata trước khi kết luận
// BLOCKED_UNKNOWN_CMS_TYPE" và tránh random lại từ đầu (đã có exerciseId).
//
// Chạy: node automation/discovery/oneOffLookupSortFixture.mjs
import { getExerciseDetail } from "./exercises.js";
import { getExamOfExercise } from "./exams.js";
import { parseQuestionsFromExamPage } from "./examPageScraper.js";
import { normalizeQuestions } from "../model/questionModel.js";

const EXERCISE_ID = "1ea73b9a-ad9a-4400-90e7-44106c24a488";
const TARGET_INDEX = 17; // 0-based, theo audit trước (câu SORT ở "index 17 của 20")

async function main() {
  console.log(`[lookup] getExerciseDetail cho exerciseId=${EXERCISE_ID} ...`);
  const exerciseItem = { id: EXERCISE_ID };
  const detail = await getExerciseDetail(exerciseItem);
  console.log(`[lookup] exam_ids:`, detail.exam_ids);

  const exam = getExamOfExercise(detail);
  console.log(`[lookup] Dùng examId=${exam.id}, đang mở exam page thật (Playwright)...`);

  const examData = await parseQuestionsFromExamPage(exam.id);
  console.log(`[lookup] examName="${examData.examName}", tổng số câu=${examData.questions.length}`);

  const normalized = normalizeQuestions(examData);
  console.log(`\n[lookup] === Toàn bộ raw type theo index ===`);
  normalized.forEach((q, i) => {
    console.log(`  [${i}] type=${q.type} title="${q.metadata.title}"`);
  });

  const target = normalized[TARGET_INDEX];
  if (!target) {
    console.log(`\n[lookup] KHÔNG có câu ở index ${TARGET_INDEX} (chỉ có ${normalized.length} câu).`);
    return;
  }
  console.log(`\n[lookup] === Câu ở index ${TARGET_INDEX} (câu SORT nghi vấn) ===`);
  console.log(JSON.stringify(target, null, 2));

  console.log(`\n[lookup] === Raw thô đầy đủ (chưa qua normalize) ===`);
  console.log(JSON.stringify(examData.questions[TARGET_INDEX], null, 2));
}

main().catch((err) => {
  console.error(`[lookup] LỖI:`, err.message);
  if (err.body) console.error(`[lookup] body:`, JSON.stringify(err.body));
  process.exit(1);
});
