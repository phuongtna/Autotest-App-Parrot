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
 * nữa.
 *
 * NESTED LESSON ITEM (GROUP) - ĐÃ SỬA (2026-09-29, cùng phiên với 4 bug live-verify ở trên): 1
 * Lesson KHÔNG phải lúc nào cũng có danh sách hoạt động PHẲNG ngay dưới nó - nhiều Lesson thật (đã
 * xác nhận qua CMS, vd "Trạm khởi hành 1/2", "Thử thách 1/2/3") gói Exercise thật bên trong 1 hoặc
 * nhiều tầng Lesson Item type=GROUP lồng nhau, phải bấm mở từng nhóm mới thấy Exercise. TRƯỚC ĐÂY
 * `_openExerciseSteps()` giả định phẳng (chỉ `scrollUntilVisible` tên Exercise ngay dưới Lesson) -
 * khi Exercise nằm trong GROUP, bước này luôn "not found" dù Exercise có thật, khiến caller (vd
 * runVuiHocRandomExercise.mjs) hiểu NHẦM thành NAVIGATE FAIL rồi random lại Exercise khác thay vì
 * mở đúng nhóm.
 *
 * CÁCH SỬA: KHÔNG dò "expandable" mù trên UI (vd đoán icon/chevron) - CMS đã tự phân biệt sẵn
 * GROUP (container, có thể còn "children") với các type khác (leaf, vd EXERCISE) NGAY TỪ NGUỒN
 * (xem `discovery/lessonItems.js#flattenLessonItemsWithPath()`, đệ quy CHÍNH XÁC cây Lesson Item
 * thật bất kỳ độ sâu nào, trả kèm `groupPath` = mảng GROUP tổ tiên thật, root -> gần nhất, của mỗi
 * leaf item). `navigateTo()` nhận thêm tham số `groups` (mảng `{name}`, LẤY TỪ `groupPath` đó,
 * KHÔNG hardcode "Trạm khởi hành"/"Thử thách" hay bất kỳ tên nhóm nào) - mở TUẦN TỰ từng nhóm bằng
 * `_openGroupSteps()` (state builder MỚI, dùng LẠI NGUYÊN idiom wait/scroll/assert/tap/dismiss đã
 * có ở `_openLessonSteps()`/`_openExerciseSteps()`, không viết logic mới) TRƯỚC bước tìm Exercise -
 * KHÔNG cần tự "biết" 1 phần tử có phải GROUP hay không, KHÔNG cần đóng nhóm/back lại (vì đường đi
 * đã biết trước, không phải dò mù nên không có nhánh sai cần backtrack), vẫn gộp CHUNG 1 lượt
 * `bridge.runSteps()` DUY NHẤT cho cả `navigateTo()` (giữ nguyên kiến trúc/hiệu năng 1 process ở
 * trên). Khi `groups` rỗng (Exercise nằm trực tiếp dưới Lesson, trường hợp PHẲNG cũ), hành vi/số
 * bước Maestro giống HỆT trước khi sửa - tương thích ngược hoàn toàn.
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
   *
   * ĐÃ SỬA (2026-09-29, xác nhận thật trên thiết bị 3201d866d40a1681, live-verify cho
   * runVuiHocRandomExercise.mjs): selector cũ `tapOn: { leftOf: "Chuyển profile" }` (copy từ
   * flows/app/vui_hoc/study_unit9_protecting_environment.yaml, từng "đã xác nhận thật" tại thời
   * điểm viết) FAIL 100% ("Element not found: Left of: Chuyển profile") - khớp đúng bug đã ghi
   * nhận trong memory "Navigation selector + card-locate bugs" (fail cả khi KHÔNG cần đổi Khối).
   * Root cause xác nhận qua screenshot thật: UI hiện tại render "Khối X" là 1 text-element TỰ NÓ
   * tappable (kèm chevron dropdown), KHÔNG còn nằm ở vị trí "bên trái Chuyển profile" mà
   * `leftOf` có thể giải quyết được (có thể do redesign UI sau thời điểm 2 file yaml gốc được
   * viết) - lúc đầu đổi sang tap text "Khối {số}" (regex) - đã verify mở đúng bottom sheet "Chọn
   * khối" (screenshot xác nhận, liệt kê Khối 1-12, Khối hiện tại được highlight).
   *
   * ĐÃ SỬA LẦN 2 (2026-09-29, cùng phiên): thay text regex bằng id THẬT `happy_learning_book_
   * selector` (đọc được qua screen-hierarchy khi debug lỗi Lesson - xem `_openLessonSteps()`) -
   * robust hơn text (không phụ thuộc locale/format hiển thị "Khối N").
   *
   * ĐÃ SỬA LẦN 3 (2026-09-29, cùng phiên - SỰ CỐ SETTLE): sau khi đổi Khối, `bookName` (vd
   * "Khối 9") hiện lên GẦN NHƯ NGAY (chỉ đổi header) nhưng nội dung THẬT của Khối mới (banner +
   * link "Tất cả units") vẫn đang tải - `_ensureUnitOpenSteps()` chạy NGAY SAU đó tap "Tất cả
   * units" có thể FAIL "Element not found" dù chỉ cần chờ thêm (đã xác nhận qua 2 screenshot cùng
   * 1 màn "Unit 1..." - lúc có banner+link, lúc chưa). Thêm `waitForAnimationToEnd` (bounded,
   * CÙNG pattern "FIX SỰ CỐ SETTLE" đã dùng cho các transition khác trong file này) SAU khi
   * `bookName` visible - CHỈ trong nhánh THẬT SỰ vừa đổi Khối, không tốn thêm chi phí khi đã
   * đúng Khối sẵn (skip cả block `when`).
   * @param {string} bookName
   */
  _ensureBookSelectedSteps(bookName) {
    return [
      {
        runFlow: {
          when: { notVisible: bookName },
          commands: [
            { tapOn: { id: "happy_learning_book_selector" } },
            { extendedWaitUntil: { visible: { text: "Chọn khối" }, timeout: 5000 } },
            { tapOn: bookName },
            { extendedWaitUntil: { visible: { text: bookName }, timeout: 10000 } },
            { waitForAnimationToEnd: { timeout: 3000 } },
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
   *
   * TIMEOUT scrollUntilVisible TĂNG 20000 -> 60000 (2026-09-29, xác nhận thật cho
   * runVuiHocRandomExercise.mjs, thiết bị 3201d866d40a1681): random trúng Unit "Review 2" của
   * Book "Khối 9" - 20000ms chỉ đủ ~6 lượt swipe, dừng ở Unit 6 (screenshot xác nhận), CHƯA tới
   * "Review 2" (nằm sau nhiều Unit hơn) -> FAILED sai "not found" dù Unit có thật, chỉ do timeout
   * quá ngắn cho danh sách dài - CÙNG NGUYÊN NHÂN đã từng sửa cho
   * flows/app/helpers/open-exercise.yaml (tăng 30000 -> 90000/150000, xem docblock file đó).
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
                timeout: 60000,
              },
            },
            // FIX: xác nhận lại NGAY (hierarchy fresh, không dùng lại kết quả nội bộ của
            // scrollUntilVisible) trước khi tiếp tục scroll tìm nút hành động.
            { assertVisible: { text: unitName } },
            {
              scrollUntilVisible: {
                element: { below: unitName, text: "Chinh phục|Ôn tập" },
                direction: "DOWN",
                timeout: 60000,
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
   *
   * ĐÃ SỬA (2026-09-29, live-verify runVuiHocRandomExercise.mjs, thiết bị 3201d866d40a1681): tap
   * "\\d+ / \\d+" (thanh tiến độ) KHÔNG mở được danh sách hoạt động cho phần lớn Lesson gặp thật
   * khi random (Khối 10 "Reading", Khối 11 "Language"...) - xác nhận qua screen-hierarchy: mỗi
   * Lesson card thật ra có id `happy_learning_lesson_{i}_open` (nút mũi tên xanh "→", RIÊNG biệt
   * với `happy_learning_lesson_{i}_toggle`) - "\\d+ / \\d+" tap trúng vùng progress/toggle
   * (không mở màn mới), khiến `scrollUntilVisible` bước sau đó tìm Exercise mãi không thấy (vẫn
   * đứng ở màn danh sách Lesson, KHÔNG phải Lesson Item lồng nhau như từng đoán ban đầu). SỬA: ưu
   * tiên tap `_open` (id) nếu có, CHỈ fallback về tap "\\d+ / \\d+" cũ khi Lesson đó KHÔNG có id
   * `_open` (giữ tương thích ngược với hành vi "đã xác nhận thật" cũ trong
   * unit9_getting_started_tram_khoi_hanh.yaml, đề phòng Lesson dạng khác không có nút `_open`).
   *
   * ĐÃ SỬA BUG THẬT #5 (2026-09-29, phát hiện khi live-verify nested group trên thiết bị
   * 3201d866d40a1681): 2 khối `runFlow` ưu tiên/fallback ở trên ĐỘC LẬP với nhau - mỗi khối tự đọc
   * hierarchy TẠI THỜI ĐIỂM nó chạy, KHÔNG phải "if/else" thật. Khi khối ưu tiên (`_open`) tap
   * THÀNH CÔNG và điều hướng sang màn MỚI (danh sách hoạt động của Lesson), khối fallback chạy
   * NGAY SAU đó tự đọc hierarchy MỚI (đã rời khỏi màn Lesson-list) - `notVisible: {below:
   * lessonName, id: openButtonId}` khi đó luôn ĐÚNG (vì `lessonName` không còn trên màn hình nữa,
   * không phải vì thiếu nút `_open`) -> vẫn tap "\\d+ / \\d+" (đã KHÔNG tồn tại trên màn mới) ->
   * FAIL, dù bước tap `_open` ngay trước đó đã hoàn toàn thành công. Xác nhận thật qua
   * screen-hierarchy: sau khi `_open` COMPLETED, log vẫn chạy tiếp block fallback rồi FAILED
   * "Element not found: \\d+ / \\d+, Below: Grammar" - chặn đứng MỌI lượt random gặp Lesson có nút
   * `_open` (cả trường hợp PHẲNG lẫn NHÓM lồng nhau, không liên quan `groups[]`).
   *
   * SỬA: thêm điều kiện `visible: lessonName` vào khối fallback (Maestro `Condition` chấp nhận
   * ĐỒNG THỜI `visible` + `notVisible`, ngữ nghĩa AND) - fallback CHỈ chạy khi VẪN CÒN đứng ở màn
   * Lesson-list (còn thấy `lessonName`) VÀ không thấy nút `_open`, không còn tự kích hoạt sai sau
   * khi khối ưu tiên đã điều hướng đi nơi khác.
   * @param {string} lessonName
   */
  _openLessonSteps(lessonName) {
    const openButtonId = "happy_learning_lesson_\\d+_open";
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
            { scrollUntilVisible: { element: { text: lessonName }, direction: "DOWN", timeout: 60000 } },
          ],
        },
      },
      // FIX: xác nhận lại NGAY bằng hierarchy fresh (bắt được cả trường hợp `when` báo sai ở
      // trên) trước khi tap - không tin tưởng tuyệt đối vào kết quả của `when`/scrollUntilVisible.
      { assertVisible: { text: lessonName } },
      {
        runFlow: {
          when: { visible: { below: lessonName, id: openButtonId } },
          commands: [{ tapOn: { below: lessonName, id: openButtonId } }],
        },
      },
      {
        runFlow: {
          // FIX BUG #5: thêm `visible: lessonName` - CHỈ fallback khi vẫn ở màn Lesson-list.
          when: { visible: lessonName, notVisible: { below: lessonName, id: openButtonId } },
          commands: [{ tapOn: { below: lessonName, text: "\\d+ / \\d+" } }],
        },
      },
    ];
  }

  /**
   * Mở 1 Lesson Item type=GROUP theo tên (vd "Trạm khởi hành 1", "Thử thách 1" - tên THẬT lấy từ
   * `groupPath` của discovery/lessonItems.js#flattenLessonItemsWithPath(), KHÔNG hardcode) rồi
   * dismiss popup chung nếu có - CÙNG idiom hệt `_openLessonSteps()`/`_openExerciseSteps()` (chờ
   * settle -> scroll nếu chưa thấy -> assert fresh -> tap -> dismiss popup) vì về mặt UI, "mở 1
   * GROUP" và "mở 1 Exercise/Lesson" đều là tap 1 hàng trong danh sách rồi chờ nội dung con hiện
   * ra (có thể mở màn mới HOẶC expand ngay tại chỗ - step builder này không cần phân biệt 2 kiểu
   * đó: bước kế tiếp trong `navigateTo()` luôn tự chờ settle + đọc hierarchy fresh trước khi tìm
   * tiếp, đúng như đã làm giữa Unit -> Lesson -> Exercise).
   * @param {string} groupName
   * @param {number} index - thứ tự nhóm trong `groups[]` (0-based, chỉ dùng đặt tên screenshot).
   */
  _openGroupSteps(groupName, index) {
    return [
      { waitForAnimationToEnd: { timeout: 2000 } },
      {
        runFlow: {
          when: { notVisible: groupName },
          commands: [
            { scrollUntilVisible: { element: { text: groupName }, direction: "DOWN", timeout: 60000 } },
          ],
        },
      },
      { assertVisible: { text: groupName } },
      { tapOn: groupName },
      { waitForAnimationToEnd: { timeout: 2000 } },
      ...this._dismissKnownPopupsSteps(),
      // BUG THẬT #6 (2026-09-29, live-verify thật trên thiết bị, xác nhận cùng phiên bởi user):
      // mở 1 GROUP KHÔNG vào thẳng danh sách content con - Lesson Item ĐẦU TIÊN bên trong 1 GROUP
      // luôn là type="Dẫn nhập" (chính là field `type` CMS đã dùng để lọc EXERCISE, xem
      // filterExerciseEntries() - "Dẫn nhập" là 1 trong các type KHÔNG phải EXERCISE bị lọc ra),
      // app tự render thành 1 màn narrative/mascot ("Khởi động nghe – đọc...", tiêu đề app bar =
      // tên GROUP) YÊU CẦU bấm "Tiếp theo" mới đi tiếp - xác nhận qua screenshot thật (group "Trạm
      // khởi hành") VÀ qua bằng chứng SẴN CÓ trong repo:
      // flows/app/exercise/EX-13-sentence-builder-blocked.yaml dòng 59-67 (fixture Unit 9, cũng
      // `tapOn: "Trạm khởi hành"` rồi 2 lượt `tapOn: {text: "Tiếp theo", optional: true}` liền
      // nhau - comment gốc "S01: Dẫn nhập -> Flashcard", "S02: Flashcard -> Bài tập" - TRÙNG khớp
      // hiện tượng gặp thật ở đây). KHÔNG có nút `_open` id nào cho items trong GROUP (khác
      // `_openLessonSteps()`) nên KHÔNG tái dùng được step builder đó - tái dùng ĐÚNG idiom
      // `optional: true` tuần tự đã CHỨNG MINH hoạt động thật trong EX-13 thay vì viết logic mới.
      // Bounded 2 lượt (khớp bằng chứng thật) - an toàn khi KHÔNG có Dẫn nhập (optional bỏ qua,
      // không throw) lẫn khi content thật SỰ có chữ "Tiếp theo" ở đâu đó khác (chỉ 2 lượt, ngay
      // sau khi vừa mở GROUP, trước khi có bất kỳ thao tác làm bài nào).
      { tapOn: { text: "Tiếp theo", optional: true } },
      { waitForAnimationToEnd: { timeout: 1500 } },
      { tapOn: { text: "Tiếp theo", optional: true } },
      { waitForAnimationToEnd: { timeout: 1500 } },
      { takeScreenshot: `nav_group_${index + 1}_opened` },
    ];
  }

  /**
   * Mở đúng Exercise theo tên trong danh sách hoạt động đã sổ ra sau openLesson (hoặc sau khi mở
   * hết `groups[]`, xem navigateTo()), rồi dismiss popup chung nếu có.
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
                timeout: 60000,
              },
            },
          ],
        },
      },
      // FIX: xác nhận lại NGAY bằng hierarchy fresh trước khi tap.
      { assertVisible: { text: exerciseName } },
      { takeScreenshot: "nav_target_found" },
      { tapOn: exerciseName },
      ...this._dismissKnownPopupsSteps(),
      { takeScreenshot: "nav_target_opened" },
    ];
  }

  /**
   * Điều hướng đầy đủ Book -> Unit -> Lesson -> (0 hoặc nhiều GROUP lồng nhau) -> Exercise trong
   * ĐÚNG 1 lượt `maestro test`.
   * @param {{
   *   book: {name:string}, unit: {name:string}, lesson: {name:string},
   *   groups?: Array<{name:string}>, exercise: {name:string},
   * }} target - `groups`: đường đi CHÍNH XÁC các Lesson Item type=GROUP tổ tiên của `exercise`,
   *   thứ tự root -> gần nhất (xem discovery/lessonItems.js#flattenLessonItemsWithPath() -
   *   `groupPath`). Bỏ trống/không truyền = Exercise nằm trực tiếp dưới Lesson (trường hợp PHẲNG).
   */
  async navigateTo({ book, unit, lesson, groups = [], exercise }) {
    if (!book?.name || !unit?.name || !lesson?.name || !exercise?.name) {
      throw new Error(
        "NavigationEngine.navigateTo() cần đủ book.name/unit.name/lesson.name/exercise.name.",
      );
    }
    groups.forEach((group, index) => {
      if (!group?.name) {
        throw new Error(
          `NavigationEngine.navigateTo(): groups[${index}] thiếu "name" (mỗi phần tử groups[] ` +
            `phải là 1 Lesson Item type=GROUP thật lấy từ groupPath - xem ` +
            `discovery/lessonItems.js#flattenLessonItemsWithPath()).`,
        );
      }
    });

    const steps = [
      ...this._dismissKnownPopupsSteps(),
      ...this._ensureBookSelectedSteps(book.name),
      ...this._ensureUnitOpenSteps(unit.name),
      ...this._openLessonSteps(lesson.name),
      ...(groups.length > 0 ? [{ takeScreenshot: "nav_lesson_before_groups" }] : []),
      ...groups.flatMap((group, index) => this._openGroupSteps(group.name, index)),
      ...this._openExerciseSteps(exercise.name),
    ];

    const result = await this.bridge.runSteps(steps);
    if (!result.success) {
      const groupPathDesc = groups.length ? ` qua nhóm [${groups.map((g) => g.name).join(" > ")}]` : "";
      throw new Error(
        `NavigationEngine: điều hướng tới Book "${book.name}" / Unit "${unit.name}" / Lesson ` +
          `"${lesson.name}"${groupPathDesc} / Exercise "${exercise.name}" thất bại: ${result.error}`,
      );
    }
  }
}
