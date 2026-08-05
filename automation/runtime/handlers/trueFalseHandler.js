import { QuestionHandler } from "./questionHandler.js";

/**
 * Dạng True/False - đã xác nhận thật qua đối chiếu chéo với flow Unit9 viết tay
 * (flows/vui_hoc/unit9_getting_started_tram_khoi_hanh.yaml, bước S03): chọn đáp án đúng theo
 * text ("True"/"False") rồi bấm "Kiểm tra" (cùng pattern với
 * automation/bridge/handlers/trueFalseHandler.js - viết lại theo contract Runtime mới, gọi
 * bridge trực tiếp thay vì sinh bước Maestro tĩnh cho flowGenerator.js).
 */
export class TrueFalseHandler extends QuestionHandler {
  static supports(type) {
    return type === "TRUE_FALSE";
  }

  async execute(question) {
    if (!question.correctAnswer) {
      return { selectedAnswer: null, expected: null, actual: null, status: "SKIPPED" };
    }
    await this.bridge.tap(question.correctAnswer);
    await this.bridge.checkAnswer();
    const actual = await this.bridge.assertAnswerResult();
    await this.bridge.nextQuestion();
    return {
      selectedAnswer: question.correctAnswer,
      expected: question.correctAnswer,
      actual,
      status: actual === "CORRECT" ? "PASS" : "FAIL",
    };
  }
}
