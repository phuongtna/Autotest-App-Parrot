import { QuestionHandler } from "./questionHandler.js";

/**
 * Dạng trắc nghiệm 1 đáp án đúng - CMS trả về type "ONE".
 *
 * CẢNH BÁO QUAN TRỌNG (rút ra từ flow Unit9 viết tay trước đây, bước S05 trong
 * flows/vui_hoc/unit9_getting_started_tram_khoi_hanh.yaml - xem cùng cảnh báo trong
 * automation/bridge/handlers/multipleChoiceHandler.js): CMS type "ONE" KHÔNG đảm bảo luôn ánh
 * xạ sang đúng 1 kiểu thao tác UI cố định trên app - cùng type có thể render UI khác nhau
 * (từng gặp trường hợp UI thật là "Drag and drop", tapOn không đủ, nút Kiểm tra vẫn disabled).
 * Handler này chỉ đúng cho trường hợp UI thật là "tap để chọn đáp án".
 */
export class MultipleChoiceHandler extends QuestionHandler {
  static supports(type) {
    return type === "ONE";
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
