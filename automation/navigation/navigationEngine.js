/**
 * NavigationEngine - điều hướng app thật tới đúng Book -> Unit -> Lesson -> Exercise, tham số
 * hoá HOÀN TOÀN theo tên thật nhận từ Runtime (đọc từ automation/output/discovery.json) -
 * KHÔNG hardcode Book/Unit/Lesson/Exercise nào, KHÔNG gọi CMS, KHÔNG biết QuestionModel/
 * QuestionType là gì (không xử lý câu hỏi - đó là việc của Handler).
 *
 * GIẢ ĐỊNH (ngoài phạm vi NavigationEngine): app đã mở, đã đăng nhập, đang ở tab gốc "Vui học".
 * Đăng nhập là 1 bước UI riêng (không phải điều hướng Book/Unit/Lesson/Exercise) - Runtime tự
 * chịu trách nhiệm đảm bảo trạng thái này trước khi gọi navigateTo() (xem automation/README.md
 * mục Runtime).
 *
 * KIẾN TRÚC (đã refactor 2026-08-06 - xem lý do đo thời gian thật bên dưới): toàn bộ điều hướng
 * được GỘP thành 1 mảng bước Maestro NATIVE (runFlow/when, scrollUntilVisible, tapOn optional -
 * cùng cú pháp ĐÃ XÁC NHẬN THẬT trong flows/vui_hoc/study_unit9_protecting_environment.yaml và
 * flows/vui_hoc/unit9_getting_started_tram_khoi_hanh.yaml, viết lại tổng quát theo tên tham số,
 * KHÔNG sửa/dùng lại chính 2 file yaml đó) rồi chạy ĐÚNG 1 lượt `bridge.runSteps()` (= 1 lượt
 * `maestro test` DUY NHẤT) cho cả navigateTo(). Toàn bộ rẽ nhánh "đã ở đúng Book/Unit/Lesson
 * chưa" và "scroll tới khi thấy" đều do Maestro tự xử lý NGAY TRONG process đó (native
 * `when: visible/notVisible` + `scrollUntilVisible`) - Node không còn tự polling isVisible().
 *
 * TẠI SAO refactor (đo thật trên thiết bị 3201d866d40a1681, 2026-08-06): kiến trúc cũ gọi 1 lượt
 * `maestro test`/`maestro hierarchy` RIÊNG cho từng tap/swipe/isVisible - mỗi `maestro test` tốn
 * ~6s, nhưng mỗi `maestro hierarchy` (dùng bởi isVisible(), gọi trước hầu hết quyết định rẽ
 * nhánh VÀ trong mỗi vòng lặp scroll) tốn tới ~36-42s trên thiết bị thật này. isVisible() được
 * gọi rất nhiều lần (dismissKnownPopupsIfVisible 3 lần/lượt gọi x2, mỗi cấp Book/Unit/Lesson/
 * Exercise ít nhất 1 lần, cộng thêm 1 lần/vòng lặp scroll tới tối đa 40 vòng/cấp) - 1 lượt
 * navigateTo() thực tế đã chạy QUÁ 600s vẫn CHƯA xong (mới tới bước "Open Exercise") dù đây là
 * kịch bản gần best-case (Book đã đúng sẵn, chỉ cần đổi Unit). Ước lượng: best-case (không cần
 * scroll) đã ~15 lượt hierarchy + 5 lượt test ≈ 15×38s + 5×6s ≈ 600s (~10 phút); mỗi cấp cần
 * scroll thêm N vòng cộng thêm N×(38s+6s) ≈ 44s/vòng - khớp với việc bị treo >600s trong lần
 * chạy thật vừa rồi.
 *
 * KẾT QUẢ SAU REFACTOR: gộp thành 1 lượt `maestro test` DUY NHẤT cho cả navigateTo() (không còn
 * lượt `maestro hierarchy` nào - scroll/rẽ nhánh chạy native trong cùng process) - chi phí chỉ
 * còn 1 lần khởi động `maestro test` (~6s) + thời gian thao tác thật (vài giây mỗi scroll/tap
 * bên trong cùng 1 process, không phải khởi động lại CLI) - còn dưới 30s trong đa số trường hợp
 * thay vì hàng chục phút.
 *
 * SỰ CỐ SETTLE (2026-08-06, phát hiện khi verify Handler thật trên thiết bị, ĐÃ SỬA tối thiểu -
 * xem "FIX" ở các step builder bên dưới): chạy nhiều bước liên tiếp trong CÙNG 1 process đổi lấy
 * tốc độ, nhưng `runFlow: when: visible/notVisible` (chỉ đọc hierarchy 1 LẦN, không tự retry như
 * `extendedWaitUntil`) và `scrollUntilVisible` (retry bằng swipe nhưng có thể đọc hierarchy ngay
 * sau swipe, trước khi layout/network-image kịp settle) có thể đọc phải hierarchy CHƯA SETTLE
 * ngay sau 1 lần chuyển màn hình - đã xác nhận thật 2 kiểu lỗi khác nhau: (1) `scrollUntilVisible`
 * báo "not found" SAI cho 1 Unit dù hierarchy dump riêng ngay sau đó cho thấy phần tử hiển thị
 * đầy đủ; (2) `when: notVisible` báo SAI "đã visible" (bỏ qua scroll) cho 1 Lesson trong khi
 * hierarchy thật lúc đó chưa có phần tử này. CÁCH SỬA (tối thiểu, giữ nguyên kiến trúc 1 process,
 * KHÔNG tăng timeout của bất kỳ bước nào đã có): thêm `waitForAnimationToEnd` (bounded, TRẢ VỀ
 * NGAY khi settle - không phải sleep cố định) đúng trước các điểm đọc hierarchy ngay sau 1 lần
 * chuyển màn hình, cộng `assertVisible` (đọc hierarchy fresh) xác nhận lại NGAY sau khi
 * scroll/rẽ nhánh xong, trước khi tap - không tin tuyệt đối kết quả của `when`/`scrollUntilVisible`
 * nữa. LƯU Ý KHÁC (KHÔNG phải lỗi settle, KHÔNG sửa ở đây): 1 Exercise tên "Mẫu câu" random được
 * đã xác nhận KHÔNG tồn tại trong danh sách hoạt động PHẲNG của Lesson (chỉ có 4 mục cố định
 * "Trạm khởi hành"/"Thử thách 1"/"Thử thách 2"/"Trò chuyện cùng Parrot") - đây là Lesson Item
 * LỒNG NHAU (nested) trong CMS không map 1:1 ra UI phẳng mà NavigationEngine giả định - nằm
 * ngoài phạm vi sửa lần này, xử lý tạm bằng cách random lại Exercise khác khi gặp.
 */
export class NavigationEngine {
  /** @param {import("../bridge/maestroBridge.js").MaestroBridge} bridge */
  constructor(bridge) {
    this.bridge = bridge;
  }

  /**
   * Các popup CHUNG của app, có thể hiện hoặc không tuỳ trạng thái tài khoản - trả về bước
   * `runFlow: when: visible` cho từng popup (Maestro tự bỏ qua nếu không thấy, không throw).
   */
  _dismissKnownPopupsSteps() {
    const popups = [
      { trigger: "AI hỗ trợ học tập", action: "Tiếp tục" },
      { trigger: "Làm lại", action: "Làm lại" },
      { trigger: "Cho phép học", action: "Tiếp tục" },
    ];
    return popups.map(({ trigger, action }) => ({
      runFlow: { when: { visible: trigger }, commands: [{ tapOn: action }] },
    }));
  }

  /**
   * Đảm bảo đang ở đúng Khối (Book) - nếu chưa, mở dropdown chọn khối và chọn theo tên.
   * @param {string} bookName
   */
  _ensureBookSelectedSteps(bookName) {
    return [
      {
        runFlow: {
          when: { notVisible: bookName },
          commands: [
            { tapOn: { leftOf: "Chuyển profile" } },
            { extendedWaitUntil: { visible: { text: "Chọn khối" }, timeout: 5000 } },
            { tapOn: bookName },
          ],
        },
      },
      { extendedWaitUntil: { visible: { text: bookName }, timeout: 10000 } },
    ];
  }

  /**
   * Mở đúng Unit theo tên - nếu chưa thấy trên màn hình chính, vào "Tất cả units" rồi
   * `scrollUntilVisible` (native, không lặp swipe+isVisible thủ công). Bấm nút hành động
   * ("Chinh phục" hoặc "Ôn tập") ngay dưới tên Unit - CHỈ best-effort (`optional: true`, xem
   * ghi chú cũ: Unit đang là Unit "hiện tại" trên tab gốc thì không có nút này).
   * @param {string} unitName
   */
  _ensureUnitOpenSteps(unitName) {
    return [
      {
        runFlow: {
          when: { notVisible: unitName },
          commands: [
            { tapOn: "Tất cả units" },
            { extendedWaitUntil: { visible: { text: "Danh sách Units.*" }, timeout: 10000 } },
            // FIX (2026-08-06, xem ghi chú "SỰ CỐ SETTLE" ở đầu file): danh sách Units vừa mở
            // còn đang load/layout - scrollUntilVisible bắt đầu quét NGAY có thể đọc hierarchy
            // chưa settle và báo "not found" sai (đã xác nhận thật với Unit "Review 4" - hierarchy
            // dump riêng ngay sau đó cho thấy phần tử hiển thị đầy đủ, không bị cắt). Chờ
            // animation/layout xong (tối đa 2000ms, KHÔNG phải sleep cố định - trả về ngay khi
            // settle) trước khi bắt đầu scroll.
            { waitForAnimationToEnd: { timeout: 2000 } },
            {
              scrollUntilVisible: {
                element: { text: unitName },
                direction: "DOWN",
                timeout: 20000,
              },
            },
            // FIX: xác nhận lại NGAY (hierarchy fresh, không dùng lại kết quả nội bộ của
            // scrollUntilVisible) trước khi tiếp tục scroll tìm nút hành động.
            { assertVisible: { text: unitName } },
            {
              scrollUntilVisible: {
                element: { below: unitName, text: "Chinh phục|Ôn tập" },
                direction: "DOWN",
                timeout: 20000,
              },
            },
          ],
        },
      },
      { waitForAnimationToEnd: { timeout: 1500 } },
      { tapOn: { below: unitName, text: "Chinh phục|Ôn tập", optional: true } },
    ];
  }

  /**
   * Mở danh sách bài học của Lesson - bấm vào thanh tiến độ dạng "x / y" ngay dưới tên Lesson
   * (KHÔNG bấm mũi tên "tiếp tục" - xem ghi chú trong unit9_getting_started_tram_khoi_hanh.yaml).
   * @param {string} lessonName
   */
  _openLessonSteps(lessonName) {
    return [
      // FIX (2026-08-06): điều kiện `when: notVisible` chỉ đọc hierarchy 1 LẦN DUY NHẤT (không
      // tự retry như extendedWaitUntil) - ngay sau khi màn Unit-list chuyển sang Lesson-list, đã
      // xác nhận thật 1 lần điều kiện này báo SAI "lessonName đã visible" (SKIPPED, bỏ qua scroll)
      // trong khi hierarchy thật lúc đó chưa hề có lessonName -> tap bước sau fail vì phần tử
      // không tồn tại. Chờ settle (tối đa 2000ms) TRƯỚC KHI điều kiện này được đánh giá.
      { waitForAnimationToEnd: { timeout: 2000 } },
      {
        runFlow: {
          when: { notVisible: lessonName },
          commands: [
            { scrollUntilVisible: { element: { text: lessonName }, direction: "DOWN", timeout: 20000 } },
          ],
        },
      },
      // FIX: xác nhận lại NGAY bằng hierarchy fresh (bắt được cả trường hợp `when` báo sai ở
      // trên) trước khi tap - không tin tưởng tuyệt đối vào kết quả của `when`/scrollUntilVisible.
      { assertVisible: { text: lessonName } },
      { tapOn: { below: lessonName, text: "\\d+ / \\d+" } },
    ];
  }

  /**
   * Mở đúng Exercise theo tên trong danh sách hoạt động đã sổ ra sau openLesson, rồi dismiss
   * popup chung nếu có.
   * @param {string} exerciseName
   */
  _openExerciseSteps(exerciseName) {
    return [
      // FIX (2026-08-06): cùng lý do với _openLessonSteps() - chờ settle TRƯỚC khi điều kiện
      // `when: notVisible` (chỉ đọc hierarchy 1 lần) được đánh giá, ngay sau khi màn Lesson-list
      // chuyển sang danh sách hoạt động.
      { waitForAnimationToEnd: { timeout: 2000 } },
      {
        runFlow: {
          when: { notVisible: exerciseName },
          commands: [
            {
              scrollUntilVisible: {
                element: { text: exerciseName },
                direction: "DOWN",
                timeout: 20000,
              },
            },
          ],
        },
      },
      // FIX: xác nhận lại NGAY bằng hierarchy fresh trước khi tap.
      { assertVisible: { text: exerciseName } },
      { tapOn: exerciseName },
      ...this._dismissKnownPopupsSteps(),
    ];
  }

  /**
   * Điều hướng đầy đủ Book -> Unit -> Lesson -> Exercise trong ĐÚNG 1 lượt `maestro test`.
   * @param {{ book: {name:string}, unit: {name:string}, lesson: {name:string}, exercise: {name:string} }} target
   */
  async navigateTo({ book, unit, lesson, exercise }) {
    if (!book?.name || !unit?.name || !lesson?.name || !exercise?.name) {
      throw new Error(
        "NavigationEngine.navigateTo() cần đủ book.name/unit.name/lesson.name/exercise.name.",
      );
    }

    const steps = [
      ...this._dismissKnownPopupsSteps(),
      ...this._ensureBookSelectedSteps(book.name),
      ...this._ensureUnitOpenSteps(unit.name),
      ...this._openLessonSteps(lesson.name),
      ...this._openExerciseSteps(exercise.name),
    ];

    const result = await this.bridge.runSteps(steps);
    if (!result.success) {
      throw new Error(
        `NavigationEngine: điều hướng tới Book "${book.name}" / Unit "${unit.name}" / Lesson ` +
          `"${lesson.name}" / Exercise "${exercise.name}" thất bại: ${result.error}`,
      );
    }
  }
}
