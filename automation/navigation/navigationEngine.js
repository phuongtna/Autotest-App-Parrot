/**
 * NavigationEngine - điều hướng app thật tới đúng Book -> Unit -> Lesson -> Exercise, tham số
 * hoá HOÀN TOÀN theo tên thật nhận từ Runtime (đọc từ automation/output/discovery.json) -
 * KHÔNG hardcode Book/Unit/Lesson/Exercise nào, KHÔNG gọi CMS, KHÔNG biết QuestionModel/
 * QuestionType là gì (không xử lý câu hỏi - đó là việc của Handler).
 *
 * Chỉ dùng thao tác chung do MaestroBridge cung cấp (tap/wait/isVisible/swipe) - toàn bộ trình
 * tự bước và rẽ nhánh (kiểm tra Book/Unit đang hiển thị hay chưa, scroll tìm Unit, số lần thử)
 * là logic ĐIỀU HƯỚNG, nằm ở đây - Bridge không biết TẠI SAO các bước này được gọi.
 *
 * GIẢ ĐỊNH (ngoài phạm vi NavigationEngine): app đã mở, đã đăng nhập, đang ở tab gốc "Vui học".
 * Đăng nhập là 1 bước UI riêng (không phải điều hướng Book/Unit/Lesson/Exercise) - Runtime tự
 * chịu trách nhiệm đảm bảo trạng thái này trước khi gọi navigateTo() (xem automation/README.md
 * mục Runtime).
 *
 * Trình tự bên dưới dựa trên pattern ĐÃ XÁC NHẬN THẬT trong
 * flows/vui_hoc/study_unit9_protecting_environment.yaml (chọn Khối, tìm Unit) và
 * flows/vui_hoc/unit9_getting_started_tram_khoi_hanh.yaml (mở Lesson qua progress badge, mở
 * Exercise theo tên, dismiss popup) - viết lại tổng quát theo tên tham số, KHÔNG sửa/dùng lại
 * chính 2 file yaml đó.
 */
export class NavigationEngine {
  /** @param {import("../bridge/maestroBridge.js").MaestroBridge} bridge */
  constructor(bridge) {
    this.bridge = bridge;
  }

  /**
   * Các popup CHUNG của app, có thể hiện hoặc không tuỳ trạng thái tài khoản - KHÔNG gắn với
   * Book/Unit/Lesson/Exercise cụ thể nào nên tap nếu thấy, không phải lỗi nếu không thấy.
   */
  async dismissKnownPopupsIfVisible() {
    const popups = [
      { trigger: "AI hỗ trợ học tập", action: "Tiếp tục" },
      { trigger: "Làm lại", action: "Làm lại" },
      { trigger: "Cho phép học", action: "Tiếp tục" },
    ];
    for (const { trigger, action } of popups) {
      if (this.bridge.isVisible(trigger)) {
        await this.bridge.tap(action);
      }
    }
  }

  /**
   * Đảm bảo đang ở đúng Khối (Book) - nếu chưa, mở dropdown chọn khối và chọn theo tên.
   * @param {string} bookName
   */
  async ensureBookSelected(bookName) {
    if (this.bridge.isVisible(bookName)) return;
    await this.bridge.tap({ leftOf: "Chuyển profile" });
    await this.bridge.wait("Chọn khối", { timeout: 5000 });
    const result = await this.bridge.tap(bookName);
    if (!result.success) {
      throw new Error(`NavigationEngine: không chọn được Book "${bookName}": ${result.error}`);
    }
    await this.bridge.wait(bookName, { timeout: 10000 });
  }

  /**
   * Vuốt tới khi thấy `textPattern` hoặc hết `maxSwipes` lần - dùng khi cần tìm 1 Unit nằm xa
   * trong danh sách dài (không biết trước vị trí).
   * @param {string} textPattern
   */
  async scrollUntilVisible(textPattern, { maxSwipes = 40 } = {}) {
    for (let i = 0; i < maxSwipes; i++) {
      if (this.bridge.isVisible(textPattern)) return true;
      await this.bridge.swipe("50%,80%", "50%,20%", { duration: 400 });
    }
    return this.bridge.isVisible(textPattern);
  }

  /**
   * Mở đúng Unit theo tên - nếu chưa thấy trên màn hình chính, vào "Tất cả units" rồi scroll
   * tìm. Bấm nút hành động ("Chinh phục" hoặc "Ôn tập" - NavigationEngine không quan tâm Unit
   * đang ở trạng thái nào, chỉ cần mở được) ngay dưới tên Unit NẾU CÓ.
   *
   * Đã xác nhận thật: nếu Unit này đang là Unit "hiện tại" hiển thị sẵn trên tab gốc "Vui học"
   * (không phải trong "Danh sách Units"), màn hình đó đi thẳng vào danh sách Lesson, KHÔNG có
   * nút Chinh phục/Ôn tập nào để bấm (giống cách flows/vui_hoc/study_unit9_protecting_environment.yaml
   * xử lý: 2 `runFlow` riêng, mỗi cái chỉ chạy NẾU nút tương ứng đang hiển thị - không có nút
   * nào hiển thị thì bỏ qua cả 2, không phải lỗi). Vì vậy tap này CHỈ best-effort, không throw
   * khi không tìm thấy.
   * @param {string} unitName
   */
  async ensureUnitOpen(unitName) {
    if (!this.bridge.isVisible(unitName)) {
      const opened = await this.bridge.tap("Tất cả units");
      if (!opened.success) {
        throw new Error(`NavigationEngine: không mở được "Tất cả units": ${opened.error}`);
      }
      await this.bridge.wait("Danh sách Units.*", { timeout: 10000 });
      const found = await this.scrollUntilVisible(unitName);
      if (!found) {
        throw new Error(`NavigationEngine: không tìm thấy Unit "${unitName}" trong danh sách Units.`);
      }
    }
    await this.bridge.tap({ below: unitName, text: "Chinh phục|Ôn tập" });
  }

  /**
   * Mở danh sách bài học của Lesson - bấm vào thanh tiến độ dạng "x / y" ngay dưới tên Lesson
   * (KHÔNG bấm mũi tên "tiếp tục" - mũi tên tự nhảy sang activity dở, không xác định được đích
   * đến, xem ghi chú trong flows/vui_hoc/unit9_getting_started_tram_khoi_hanh.yaml). Danh sách
   * Lesson của 1 Unit có thể dài hơn 1 màn hình (đã xác nhận thật: Unit nhiều Lesson chỉ hiện
   * Lesson 1/2 ban đầu) nên cũng cần scroll tìm như ensureUnitOpen(), không giả định luôn thấy
   * ngay.
   * @param {string} lessonName
   */
  async openLesson(lessonName) {
    if (!this.bridge.isVisible(lessonName)) {
      const found = await this.scrollUntilVisible(lessonName);
      if (!found) {
        throw new Error(`NavigationEngine: không tìm thấy Lesson "${lessonName}" trên màn hình.`);
      }
    }
    const result = await this.bridge.tap({ below: lessonName, text: "\\d+ / \\d+" });
    if (!result.success) {
      throw new Error(
        `NavigationEngine: không mở được danh sách bài học của Lesson "${lessonName}": ${result.error}`,
      );
    }
  }

  /**
   * Mở đúng Exercise theo tên trong danh sách hoạt động đã sổ ra sau openLesson() - danh sách
   * này cũng có thể dài hơn 1 màn hình (đã xác nhận thật) nên cần scroll tìm như openLesson(),
   * rồi dismiss popup chung nếu có.
   * @param {string} exerciseName
   */
  async openExercise(exerciseName) {
    if (!this.bridge.isVisible(exerciseName)) {
      const found = await this.scrollUntilVisible(exerciseName);
      if (!found) {
        throw new Error(`NavigationEngine: không tìm thấy Exercise "${exerciseName}" trên màn hình.`);
      }
    }
    const result = await this.bridge.tap(exerciseName);
    if (!result.success) {
      throw new Error(`NavigationEngine: không mở được Exercise "${exerciseName}": ${result.error}`);
    }
    await this.dismissKnownPopupsIfVisible();
  }

  /**
   * Điều hướng đầy đủ Book -> Unit -> Lesson -> Exercise.
   * @param {{ book: {name:string}, unit: {name:string}, lesson: {name:string}, exercise: {name:string} }} target
   */
  async navigateTo({ book, unit, lesson, exercise }) {
    if (!book?.name || !unit?.name || !lesson?.name || !exercise?.name) {
      throw new Error(
        "NavigationEngine.navigateTo() cần đủ book.name/unit.name/lesson.name/exercise.name.",
      );
    }
    await this.dismissKnownPopupsIfVisible();
    await this.ensureBookSelected(book.name);
    await this.ensureUnitOpen(unit.name);
    await this.openLesson(lesson.name);
    await this.openExercise(exercise.name);
  }
}
