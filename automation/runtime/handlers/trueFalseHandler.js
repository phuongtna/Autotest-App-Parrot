import { QuestionHandler } from "./questionHandler.js";
import { ensureTextVisible } from "../../bridge/scrollUntilVisible.js";

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
    // PHASE A (nội dung): cuộn bounded (dừng ngay khi đã visible - 0 chi phí thêm nếu đáp án đã
    // nằm trong khung hình) trước khi tap - trước đây tap thẳng KHÔNG kiểm tra viewport, đáp án
    // ngoài khung hình khiến tap() thất bại âm thầm (kết quả không được đọc) rồi rơi vào FAIL/
    // UNKNOWN sai lệch qua assertAnswerResult() bên dưới.
    await ensureTextVisible(this.bridge, this.bridge.hierarchy(), question.correctAnswer);
    await this.bridge.tap(question.correctAnswer);
    // PHASE B (control): ĐỘC LẬP với Phase A ở trên - "Kiểm tra" có thể nằm dưới đáp án vừa chọn,
    // cần tự cuộn thêm (không yêu cầu đáp án + "Kiểm tra" cùng hiển thị 1 lúc).
    await ensureTextVisible(this.bridge, this.bridge.hierarchy(), "Kiểm tra");
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
