/**
 * QuestionHandler - hợp đồng chung cho MỌI Handler dùng trong Runtime. Mỗi Handler chỉ xử lý
 * ĐÚNG MỘT QuestionType (khớp `QuestionModel.type`, xem automation/model/questionModel.js) -
 * không viết switch-case khổng lồ ở nơi khác, thêm dạng bài mới = thêm 1 Handler mới + đăng ký
 * vào handlerRegistry.js.
 *
 * Handler nhận `bridge` qua constructor (Dependency Injection từ Runtime) - chỉ được gọi thao
 * tác qua bridge (tap/input/swipe/checkAnswer/nextQuestion/assertAnswerResult), KHÔNG tự chạy
 * Maestro/adb riêng, KHÔNG gọi CMS.
 */
export class QuestionHandler {
  /** @param {import("../../bridge/maestroBridge.js").MaestroBridge} bridge */
  constructor(bridge) {
    this.bridge = bridge;
  }

  /**
   * @param {string} type - QuestionModel.type thô từ CMS (vd "ONE", "TRUE_FALSE"...)
   * @returns {boolean}
   */
  static supports(type) {
    throw new Error(`${this.name}.supports() chưa implement`);
  }

  /**
   * @param {import("../../model/questionModel.js").QuestionModel} question
   * @returns {Promise<{
   *   selectedAnswer: ?string,
   *   expected: ?string,
   *   actual: ?string,
   *   status: "PASS"|"FAIL"|"SKIPPED",
   * }>}
   */
  async execute(question) {
    throw new Error(`${this.constructor.name}.execute() chưa implement`);
  }
}
