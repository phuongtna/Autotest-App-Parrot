/**
 * Dạng bài True/False - đã xác nhận thật qua examPageScraper (type "TRUE_FALSE") và đối
 * chiếu chéo với flow Unit9 viết tay trước đây (flows/vui_hoc/unit9_getting_started_tram_khoi_hanh.yaml,
 * bước S03): chọn đáp án đúng theo text ("True"/"False") rồi bấm "Kiểm tra".
 */
export const type = "TRUE_FALSE";

/**
 * @param {import("../../model/questionModel.js").QuestionModel} questionModel
 * @returns {Array<Object>} mảng Maestro command (plain object, serialize bằng js-yaml)
 */
export function buildSteps(questionModel) {
  if (!questionModel.correctAnswer) {
    throw new Error(
      `TrueFalseHandler: question ${questionModel.id} không có correctAnswer, không thể tạo bước tapOn.`,
    );
  }
  return [{ tapOn: questionModel.correctAnswer }, { tapOn: "Kiểm tra" }];
}
