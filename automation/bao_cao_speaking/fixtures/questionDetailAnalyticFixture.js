/**
 * Builder tạo response giả (Tầng 2 - mock) cho
 * `GET /api/user/report-stats/question-detail-analytic?question_id=&room_id=` - schema THẬT lấy
 * từ network capture live trên Dev 2026-09-11 (xem comment API ở speakingReportPageObjects.js).
 *
 * QUAN TRỌNG: server đã TỰ phân loại Sai/Đúng sẵn qua 2 mảng `correct_answer_groups`/
 * `incorrect_answer_groups` - fixture builder này nhận trực tiếp danh sách "ai thuộc nhóm nào"
 * (KHÔNG tự suy luận ngưỡng accuracy_score >= 51 hay gì khác) vì đó là business rule của backend,
 * ngoài phạm vi test UI (test UI chỉ cần: "cho dữ liệu ĐÃ phân loại sẵn thế này, UI có render tab/
 * badge/màu đúng theo dữ liệu đó không").
 */

let sequentialWordIndex = 0;

/** Sinh 1 phần tử `assessment_details` cho 1 từ - `isError=true` -> tô đỏ (TC_033). */
export function buildWord(text, isError) {
  sequentialWordIndex += 1;
  return {
    text,
    is_error: isError,
    error_type: isError ? "Mispronunciation" : "None",
    syllables: [{ text, is_error: isError }],
  };
}

/**
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.userName
 * @param {number} params.accuracyScore - 0-100, hiển thị ở badge %.
 * @param {boolean} params.isCorrect - quyết định nằm ở correct_answer_groups hay incorrect_answer_groups.
 * @param {Array<{text:string, isError:boolean}>} [params.words] - nội dung transcription theo từ
 *   (TC_033 - tô đỏ từ sai). Mặc định 1 câu không lỗi nếu không truyền.
 * @param {string} [params.actualSpokenText]
 */
export function buildStudentAnswer({
  userId,
  userName,
  accuracyScore,
  isCorrect,
  words = [{ text: "sample", isError: false }],
  actualSpokenText,
}) {
  const assessmentDetails = words.map((w) => buildWord(w.text, w.isError));
  const contentText = words.map((w) => w.text).join(" ");
  return {
    user_id: userId,
    user_name: userName,
    avatar: "",
    is_correct: isCorrect,
    answer: {
      accuracy_score: accuracyScore,
      actual_spoken_text: actualSpokenText ?? contentText,
      ai_feedback: "Con đã hoàn thành bài đọc rồi. Con xem phần tô đỏ để biết âm nào cần luyện thêm nhé!",
      assessment_details: assessmentDetails,
      audioUri: `https://cdnparrotedu.codeinet.com/parrotedustorage/speak/mock/${userId}.wav`,
      content: contentText,
      content_type: words.length > 1 ? "sentence" : "word",
      expected_phonetic: "",
      expected_sapi_raw: "",
      ipa_content: "",
      spoken_phonetic: "",
      spoken_sapi_raw: "",
    },
  };
}

/**
 * @param {object} params
 * @param {string} params.questionId
 * @param {number} [params.index]
 * @param {{content:string, title:string, image?:string}} params.question
 * @param {ReturnType<typeof buildStudentAnswer>[]} params.correctAnswers
 * @param {ReturnType<typeof buildStudentAnswer>[]} params.incorrectAnswers
 */
export function buildQuestionDetailAnalytic({
  questionId,
  index = 1,
  question,
  correctAnswers = [],
  incorrectAnswers = [],
}) {
  return {
    status: true,
    id: questionId,
    index,
    question: {
      audio: "",
      content: question.content,
      image: question.image ?? "",
      ipa: "",
      suggest: "",
      title: question.title,
    },
    type: "SPEAK",
    answers: [],
    correct: "",
    correct_answer_groups: correctAnswers,
    incorrect_answer_groups: incorrectAnswers,
    total_answered: correctAnswers.length + incorrectAnswers.length,
    correct_count: correctAnswers.length,
    incorrect_count: incorrectAnswers.length,
  };
}
