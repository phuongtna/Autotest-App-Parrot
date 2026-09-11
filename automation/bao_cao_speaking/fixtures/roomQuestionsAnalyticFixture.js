/**
 * Builder cho response giả `GET /api/user/report-stats/room-questions-analytic?room_id=` -
 * nguồn dữ liệu khối "Phân tích lỗi sai" (10 ô C1..C10, số hiển thị = incorrect_count, màu đỏ đậm
 * nếu error_rate >= 50, hồng nhạt nếu < 50 - xác nhận thật qua đối chiếu network capture: câu
 * "clothes" incorrect_count=2/error_rate=66.67 hiển thị đỏ đậm khớp "≥ 50% học sinh sai").
 *
 * CHỦ Ý chỉ đưa ĐÚNG 1 câu hỏi vào `questions` khi dùng cho test Nhóm A/D (mock) - để trang tự
 * chọn mặc định ĐÚNG câu đó (không có câu nào khác để chọn nhầm), tránh phải biết trước logic
 * "trang tự chọn câu nào làm mặc định" của FE.
 */
export function buildRoomQuestionsAnalytic({ roomId, roomName, examId, totalStudents, questions }) {
  return {
    status: true,
    room_id: roomId,
    room_name: roomName,
    exam_id: examId ?? "00000000-0000-0000-0000-000000000000",
    total_students: totalStudents,
    questions_analysis: questions.map((q) => ({
      question_id: q.questionId,
      question_index: q.questionIndex,
      type: "SPEAK",
      answer_stats: {},
      correct_answer: '""',
      incorrect_count: q.incorrectCount,
      error_rate: q.errorRate,
    })),
  };
}
