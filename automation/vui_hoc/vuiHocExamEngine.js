/**
 * VuiHocExamEngine - trả lời 1 câu hỏi của tab Vui học (tự học) BẰNG ĐÁP ÁN ĐÚNG THẬT (CMS), thay
 * cho lối "blind tap theo vị trí" của flows/app/helpers/answer-current-exercise-generic.yaml.
 *
 * KHÁC HẲN automation/bai_tap/navigation/homeworkExamEngine.js#HomeworkExamEngine (dùng cho Bài
 * tập - KHÔNG check đúng/sai từng câu): Vui học có chỉ báo đúng/sai NGAY sau khi bấm "Kiểm tra"
 * ("Chính xác"/"Chưa chính xác") và bắt "Thử lại" trước khi được đi tiếp - engine này PHẢI xử lý
 * chu trình đó, khác register-và-đi-tiếp đơn thuần của Bài tập.
 *
 * TÁI SỬ DỤNG TỐI ĐA (không viết lại):
 *   - Toàn bộ hàm "quyết định đáp án đúng" THUẦN (không đụng thiết bị) từ homeworkExamEngine.js:
 *     decideAnswerAction (CHOICE), resolveFillWordValues, resolveDragDropCorrectValues,
 *     resolveConnectCorrectPairs, collectBlankIndices, collectDragDropZoneIndices,
 *     resolveConnectSlotIndex, collectTexts, hasResourceId.
 *   - ensureIdVisible() (automation/bridge/scrollUntilVisible.js) - 0 chi phí thêm khi control đã
 *     visible sẵn (xem docblock file đó) - giữ nguyên cho câu dài hơn 1 màn hình.
 *   - ensureAllConnectPairsVisible()/tapConnectPairs() (homeworkExamEngine.js) - CÙNG thuật toán
 *     cuộn-gộp-text + batch-tap-với-fallback-cuộn-2-chiều đã dùng cho CONNECT của Bài tập (2026-09-
 *     23, fix bug "matching multi-scroll tap stale-index" - xem docblock 2 hàm đó).
 *   - HomeworkExamEngine#isResultScreen()/#readResult() - đọc màn "Kết quả", hoàn toàn chung.
 *   - detectQuestionUiType() (vuiHocQuestionMatcher.js) - nhận diện type qua testID, DÙNG CHUNG
 *     giữa matcher (tìm đúng câu CMS) và engine (chọn handler) - KHÔNG viết trùng 2 nơi.
 *
 * MỚI so với bai_tap/ (2026-09-10):
 *   - SORT (vuiHocSortHandler.js).
 *   - State machine "chọn đáp án -> Kiểm tra -> đọc NHÃN NÚT THẬT (Thử lại/Tiếp theo/Hoàn thành)
 *     -> lặp có giới hạn" - đọc TRỰC TIẾP 1 lần `hierarchy()` sau mỗi lượt Kiểm tra để quyết định
 *     nhánh, THAY vì polling `bridge.assertAnswerResult()` (hàm đó tự gọi `isVisible()` lặp lại
 *     nhiều lần, mỗi lần 1 tiến trình `maestro hierarchy` riêng - tốn tới ~13 lượt/câu nếu không
 *     thấy ngay, ĐO THẬT là bottleneck lớn nhất của phiên trước). Toàn bộ thao tác "chọn đáp án +
 *     bấm Kiểm tra" GỘP CHUNG 1 `runSteps()` (1 tiến trình Maestro) thay vì 2 lượt tách rời.
 *   - `answerCurrentQuestion()` nhận `tree`/`uiType` ĐÃ CÓ SẴN từ caller (runner đã đọc 1 lần để
 *     matching câu) - KHÔNG tự đọc lại hierarchy (tiết kiệm 1 lượt/câu).
 */
import {
  collectTexts,
  hasResourceId,
  resolveConnectCorrectPairs,
  resolveConnectSlotIndex,
  ensureAllConnectPairsVisible,
  tapConnectPairs,
  collectBlankIndices,
  resolveFillWordValues,
  collectDragDropZoneIndices,
  resolveDragDropCorrectValues,
  decideAnswerAction,
  HomeworkExamEngine,
} from "../bai_tap/navigation/homeworkExamEngine.js";
import { ensureIdVisible } from "../bridge/scrollUntilVisible.js";
import { resolveSortTargetOrder, computeNextSortMove } from "./vuiHocSortHandler.js";
import { detectQuestionUiType } from "./vuiHocQuestionMatcher.js";

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// HÀM (không phải hằng số dùng chung) - BUG THẬT đã gặp 2026-09-10: dùng 1 object literal DÙNG
// LẠI (cùng tham chiếu) hơn 1 lần trong CÙNG 1 mảng `steps` khiến `js-yaml` (serializer của
// MaestroBridge#_runFlow()) tự phát hiện "trùng tham chiếu" rồi phát YAML anchor/alias (`&ref_0`/
// `*ref_0`) để tránh lặp - hợp lệ theo chuẩn YAML nhưng Maestro KHÔNG hỗ trợ cú pháp alias này
// ("Invalid Command: ref_0"), làm cả lượt runSteps() thất bại. Xảy ra CHÍNH XÁC ở nhánh "Thử lại"
// (mảng steps gộp có 2 lần tap "exercise_check_button" - Thử lại + Kiểm tra lại). SỬA: mỗi lần
// cần bước tap này PHẢI tạo 1 object MỚI (hàm trả về literal mới mỗi lần gọi), không tái sử dụng
// tham chiếu.
function checkButtonTap() {
  return { tapOn: { id: "exercise_check_button", optional: true } };
}

// PERF FIX (2026-10-01, đo THẬT trên thiết bị 3201d866d40a1681 - xem PERF PROFILE REPORT phiên tối
// ưu Self-Learning, mục "Question execution"): TRƯỚC ĐÂY mỗi câu luôn tốn ÍT NHẤT 2 lượt `maestro
// test` RIÊNG (1: chọn đáp án + Kiểm tra, 1: bấm tiếp sau khi đã xác nhận "Chính xác" qua 1 lượt
// `hierarchy()` RỜI) + 1 lượt `hierarchy()` - đo thật 2 lượt chạy E2E liên tiếp cho ĐÚNG 1 target
// (10 câu, maxAttempts=3, 0/0 retry CẢ 2 lượt - automation LUÔN chọn đáp án ĐÚNG THẬT lấy từ CMS
// nên "Thử lại" trên thực tế gần như KHÔNG BAO GIỜ xảy ra, chỉ là safety net cho trục trặc thao
// tác UI) cho thấy "Question execution" chiếm 73.5% TOÀN BỘ runtime (654.68s/890.51s) - bottleneck
// LỚN NHẤT còn lại sau khi đã thêm `--no-reinstall-driver` ở MaestroBridge.
//
// SỬA: gộp bước "bấm tiếp" (advance) vào NGAY TRONG CÙNG 1 lượt `maestro test` với bước Kiểm tra,
// dùng native `runFlow: { when: { visible: "Chính xác..." } }` của CHÍNH Maestro (đọc hierarchy
// NỘI BỘ 1 lần duy nhất, KHÔNG lặp/poll) - AN TOÀN khác hẳn lớp bug "stale lazy-list" đã gặp ở
// Navigation (SỰ CỐ SETTLE/bug nested-group): banner "Chính xác"/"Chưa chính xác" là 1 OVERLAY
// TOÀN MÀN HÌNH xuất hiện NGAY LẬP TỨC sau đúng 1 hành động xác định (tap "Kiểm tra"), KHÔNG phải
// 1 hàng trong danh sách cuộn/ảo hoá (RecyclerView/LazyColumn) - không có cơ chế nào để nó "peek"
// 1 phần rồi đọc hụt như hàng Lesson đã gặp. Tiết kiệm ĐÚNG 1 lượt `maestro test`/câu cho trường
// hợp ĐÚNG NGAY (phổ biến áp đảo - xác nhận 0/0 retry). Nhánh "Thử lại"/"đã hết lượt, lộ đáp án"
// GIỮ NGUYÊN 100% logic cũ bên dưới (KHÔNG đổi, KHÔNG rủi ro thêm) - native block này CHỈ cộng
// thêm 1 bước điều kiện vào CUỐI mảng `steps` đã có, không thay bất kỳ bước nào khác.
function advanceIfCorrectSteps() {
  return [
    {
      runFlow: {
        when: { visible: "Chính xác.*" },
        commands: [checkButtonTap(), { waitForAnimationToEnd: { timeout: 1200 } }],
      },
    },
  ];
}

export class VuiHocExamEngine {
  /** @param {import("../bridge/maestroBridge.js").MaestroBridge} bridge */
  constructor(bridge) {
    this.bridge = bridge;
    // Composition, KHÔNG kế thừa - chỉ mượn 2 method đọc màn Kết quả (generic, không phụ thuộc
    // business logic riêng của Bài tập).
    this._resultReader = new HomeworkExamEngine(bridge);
  }

  isResultScreen(tree) {
    return this._resultReader.isResultScreen(tree);
  }

  readResult(tree) {
    return this._resultReader.readResult(tree);
  }

  /**
   * State machine dựa HOÀN TOÀN vào nhãn nút/text THẬT đọc được sau mỗi lượt Kiểm tra - KHÔNG
   * dùng biến đếm để suy đoán "còn thử lại hay hết lượt" (bug thật đã gặp 2026-09-10: app có thể
   * hết lượt thử SỚM hơn giới hạn `maxAttempts` riêng của engine).
   *
   * Lượt ĐẦU: `buildSelectSteps()` (chọn/gõ/kéo đáp án) + tap "exercise_check_button" + (PERF FIX
   * 2026-10-01) `advanceIfCorrectSteps()` (native `runFlow: when: visible "Chính xác..."` - tự tap
   * tiếp NGAY TRONG CÙNG `runSteps()` nếu đúng, loại bỏ 1 lượt `maestro test` riêng cho trường hợp
   * PHỔ BIẾN NHẤT - đã đo thật 0/0 retry). Sau đó đọc ĐÚNG 1 lần `hierarchy()` để lấy nhãn thật:
   *   - "Chính xác..." VẪN còn visible (advance chưa kịp/không fire) -> CORRECT, DỪNG (không tap
   *     lại - advanceIfCorrectSteps() đã/sẽ tự xử lý trong steps, xem comment tại chỗ return).
   *   - "Chưa chính xác..." + còn "Thử lại"      -> gộp (Thử lại + chọn lại đáp án + Kiểm tra lại +
   *                                                 advanceIfCorrectSteps()) vào 1 `runSteps()` cho
   *                                                 lượt kế, lặp lại.
   *   - "Chưa chính xác..." + KHÔNG còn "Thử lại" -> đã reveal, bấm thêm 1 lần để đi tiếp, DỪNG.
   *   - Không thấy nhãn nào -> advanceIfCorrectSteps() ĐÃ tự tap xong (CÓ CĂN CỨ, xem comment tại
   *     chỗ return bên dưới) -> CORRECT, DỪNG. KHÁC bản gốc trước khi có native advance (lúc đó
   *     nhánh này thật sự mơ hồ, trả correct=null).
   * Bounded bởi `maxAttempts` (an toàn, KHÔNG phải điều kiện thiết kế chính - chỉ chặn lặp vô hạn
   * nếu app vào trạng thái không lường trước).
   * @param {number} maxAttempts
   * @param {() => Array<Object>} buildSelectSteps - trả mảng Maestro step (KHÔNG async, KHÔNG tự
   *   thực thi) - gọi lại được nhiều lần (mỗi lần thử lại gọi 1 lần, PHẢI idempotent).
   */
  async _submitAndVerify(maxAttempts, buildSelectSteps) {
    let steps = [
      ...buildSelectSteps(),
      { waitForAnimationToEnd: { timeout: 1000 } },
      checkButtonTap(),
      { waitForAnimationToEnd: { timeout: 1200 } },
      ...advanceIfCorrectSteps(),
    ];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await this.bridge.runSteps(steps);
      if (!result.success) throw new Error(`Thao tác trả lời câu thất bại (lượt ${attempt}): ${result.error}`);

      // ASYNC MIGRATION (pilot MaestroMcpBridge, xem docblock đầu file): `hierarchy()` là async ở
      // bridge MCP (sync ở MaestroBridge CLI cũ) - `await` ở đây tương thích CẢ 2 bridge (await 1
      // giá trị không phải Promise vẫn resolve đúng giá trị đó, chỉ thêm 1 microtask tick).
      const tree = await this.bridge.hierarchy(); // ĐÚNG 1 lượt đọc để biết verdict - không polling.
      const texts = collectTexts(tree);
      const correct = texts.some((t) => t.startsWith("Chính xác"));
      const incorrect = texts.some((t) => t.startsWith("Chưa chính xác"));
      const canRetry = texts.includes("Thử lại");

      if (correct) {
        // PERF FIX: bước "Tiếp tục"/"Hoàn thành" ĐÃ chạy native TRONG CÙNG `steps` ở trên
        // (advanceIfCorrectSteps()) - KHÔNG tap lại lần nữa (tránh double-tap sang màn/câu kế).
        // `tree` ở NHÁNH NÀY (banner "Chính xác" VẪN còn đọc được) là trường hợp HIẾM (native khi
        // chưa kịp fire do timing) - KHÔNG CHẮC đã phản ánh câu/màn kế tiếp -> nextTree=null (an
        // toàn, để caller tự đọc lại hierarchy() fresh cho vòng lặp sau, KHÔNG tái sử dụng nhầm).
        return { correct: true, attempts: attempt, nextTree: null };
      }

      if (incorrect) {
        if (!canRetry || attempt >= maxAttempts) {
          // Hết lượt thử THẬT (nút đã đổi "Tiếp theo"/"Hoàn thành") HOẶC hết giới hạn an toàn -
          // bấm ĐÚNG 1 lần để đi tiếp, KHÔNG reselect (tránh thao tác nhầm sang câu kế tiếp).
          // KHÔNG dùng advanceIfCorrectSteps() ở đây (điều kiện "Chính xác" chắc chắn false) -
          // GIỮ NGUYÊN lượt runSteps() riêng như cũ, không đổi hành vi nhánh hiếm gặp này.
          await this.bridge.runSteps([checkButtonTap(), { waitForAnimationToEnd: { timeout: 1200 } }]);
          // Không đọc tree mới ở nhánh hiếm này (giữ nguyên perf cũ) - nextTree=null.
          return { correct: false, attempts: attempt, nextTree: null };
        }
        // Gộp "Thử lại" + chọn lại đáp án + "Kiểm tra" lại vào 1 runSteps() DUY NHẤT cho lượt kế -
        // vẫn cộng thêm advanceIfCorrectSteps() để lượt thử lại CŨNG được hưởng tối ưu nếu đúng.
        steps = [
          checkButtonTap(), // "Thử lại"
          { waitForAnimationToEnd: { timeout: 800 } },
          ...buildSelectSteps(),
          { waitForAnimationToEnd: { timeout: 1000 } },
          checkButtonTap(), // "Kiểm tra" lại
          { waitForAnimationToEnd: { timeout: 1200 } },
          ...advanceIfCorrectSteps(),
        ];
        continue;
      }

      // BUG THẬT ĐÃ SỬA (2026-10-01, phát hiện NGAY SAU KHI thêm advanceIfCorrectSteps() ở trên -
      // live-verify thiết bị 3201d866d40a1681): "không thấy nhãn nào" KHÔNG còn mơ hồ như comment
      // gốc phía trên (viết TỪ TRƯỚC khi có native advance) - `steps` ở MỌI nhánh trong hàm này
      // (lượt đầu VÀ lượt "Thử lại") LUÔN kết thúc bằng `advanceIfCorrectSteps()`, mà khối lệnh đó
      // là HÀNH ĐỘNG DUY NHẤT trong `steps` có thể khiến banner biến mất (tap lần 2 vào CHÍNH
      // "exercise_check_button" NGAY SAU KHI "Chính xác..." đã thật sự visible native) - `result.
      // success` đã xác nhận cả `steps` chạy KHÔNG lỗi (nếu không đã throw ở trên). Vì vậy "đọc
      // hierarchy() SAU steps mà KHÔNG còn thấy banner nào" = BẰNG CHỨNG CÓ CĂN CỨ rằng nhánh native
      // "Chính xác" đã chạy, KHÔNG phải trường hợp mù mờ - đo thật: 10/10 câu rơi vào đúng nhánh
      // này (vì automation luôn chọn đáp án CMS đúng, "Chính xác" hiện NGAY lượt đầu) nhưng TRƯỚC
      // KHI sửa, hàm trả `correct: null` SAI cho cả 10 câu (benchmark/report mất khả năng xác nhận
      // "đã trả lời đúng" dù điểm cuối cùng vẫn đúng 10/10 qua đường readResult() riêng - 2 cơ chế
      // độc lập, lỗi này KHÔNG ảnh hưởng điểm số/completion thật, chỉ ảnh hưởng validate per-câu).
      // SỬA: trả correct=true (không phải null) cho đúng ý nghĩa MỚI của nhánh này.
      //
      // PERF FIX (2026-10-01, tiếp tục giảm "loop overhead"): CHÍNH `tree` vừa đọc ở đây ĐÃ LÀ
      // trạng thái màn hình SAU KHI advance - tức là màn hình của câu/kết quả KẾ TIẾP, giống hệt
      // dữ liệu mà vòng lặp runVuiHocQuestionPool() sẽ đọc lại bằng 1 lượt `bridge.hierarchy()`
      // RIÊNG ngay đầu iteration sau (lãng phí 1 lượt `maestro hierarchy` hoàn toàn trùng lặp, đo
      // thật chiếm ~100s/10 câu - "loop overhead" trong PERF PROFILE REPORT). Trả kèm `nextTree` để
      // caller TÁI SỬ DỤNG thay vì đọc lại - CHỈ an toàn ở ĐÚNG nhánh này (banner đã chắc chắn biến
      // mất, xem lập luận ở trên) - 2 nhánh "correct hiếm"/"incorrect hết lượt" ở trên trả
      // nextTree=null (caller tự đọc lại, KHÔNG đổi hành vi/an toàn của 2 nhánh đó).
      return { correct: true, attempts: attempt, nextTree: tree };
    }
    return { correct: null, attempts: maxAttempts, nextTree: null };
  }

  async _answerChoice(questionModel, tree, maxAttempts) {
    const scrollResult = await ensureIdVisible(this.bridge, tree, /^exercise_check_button$/);
    const scrolledTree = scrollResult.tree;
    const texts = collectTexts(scrolledTree);
    const isVisible = (t) => texts.some((x) => new RegExp(`^${t}$`).test(x));

    const action = decideAnswerAction(scrolledTree, isVisible, questionModel, true);
    if (!action) {
      return {
        supported: false,
        reason: "CHOICE: decideAnswerAction không nhận diện được (TEXT_CHOICE/IMAGE_CHOICE_GRID).",
        texts,
      };
    }
    const tapStep = action.type === "TEXT_CHOICE" ? { tapOn: action.text } : { tapOn: { point: action.point } };
    // Đáp án CỐ ĐỊNH (không cần đọc lại thiết bị) -> buildSelectSteps() không tốn thêm lượt nào.
    const buildSelectSteps = () => [tapStep];
    const verify = await this._submitAndVerify(maxAttempts, buildSelectSteps);
    return { supported: true, type: action.type, ...verify };
  }

  async _answerFillWordSingle(questionModel, tree, maxAttempts) {
    const correctValues = resolveFillWordValues(questionModel);
    if (!correctValues || correctValues.length !== 1) {
      return {
        supported: false,
        reason: "FILL_WORD (1 ô nhập): resolveFillWordValues không trả về đúng 1 giá trị.",
        texts: collectTexts(tree),
      };
    }
    await ensureIdVisible(this.bridge, tree, /^exercise_check_button$/);
    let typed = false;
    const buildSelectSteps = () => {
      const steps = [{ tapOn: { id: "exercise_fillword_input" } }];
      if (typed) steps.push({ eraseText: 80 }); // chỉ xoá khi đã gõ trước đó (lượt thử lại).
      steps.push({ inputText: correctValues[0] }, "hideKeyboard");
      typed = true;
      return steps;
    };
    const verify = await this._submitAndVerify(maxAttempts, buildSelectSteps);
    return { supported: true, type: "FILL_WORD_SINGLE", ...verify };
  }

  async _answerFillWordMulti(questionModel, tree, maxAttempts) {
    const correctValues = resolveFillWordValues(questionModel);
    if (!correctValues) {
      return {
        supported: false,
        reason: "FILL_WORD (nhiều ô): không resolve được đáp án đúng từ CMS.",
        texts: collectTexts(tree),
      };
    }
    const scrollResult = await ensureIdVisible(this.bridge, tree, /^exercise_check_button$/);
    const blankIndices = [...collectBlankIndices(scrollResult.tree)].sort((a, b) => a - b);
    if (blankIndices.length !== correctValues.length) {
      return {
        supported: false,
        reason: `FILL_WORD (nhiều ô): số ô trống trên màn (${blankIndices.length}) khác CMS (${correctValues.length}).`,
        texts: collectTexts(scrollResult.tree),
      };
    }
    // Vị trí các ô trống KHÔNG đổi giữa các lượt thử -> tính blankIndices 1 LẦN, tái sử dụng.
    const buildSelectSteps = () => {
      const steps = [];
      blankIndices.forEach((idx, i) => {
        steps.push({ tapOn: { id: `exercise_fillword_blank_${idx}` } });
        steps.push({ inputText: correctValues[i] });
      });
      steps.push("hideKeyboard");
      return steps;
    };
    const verify = await this._submitAndVerify(maxAttempts, buildSelectSteps);
    return { supported: true, type: "FILL_WORD_MULTI", ...verify };
  }

  async _answerDragDrop(questionModel, tree, maxAttempts) {
    const correctValues = resolveDragDropCorrectValues(questionModel);
    if (!correctValues) {
      return { supported: false, reason: "DRAG_DROP: không resolve được đáp án đúng từ CMS.", texts: collectTexts(tree) };
    }
    const scrollResult = await ensureIdVisible(this.bridge, tree, /^exercise_check_button$/);
    const zoneIndices = [...collectDragDropZoneIndices(scrollResult.tree)];
    if (zoneIndices.length !== correctValues.length) {
      return {
        supported: false,
        reason: `DRAG_DROP: số ô trống trên màn (${zoneIndices.length}) khác CMS (${correctValues.length}).`,
        texts: collectTexts(scrollResult.tree),
      };
    }
    const buildSelectSteps = () => correctValues.map((word) => ({ tapOn: word }));
    const verify = await this._submitAndVerify(maxAttempts, buildSelectSteps);
    return { supported: true, type: "DRAG_DROP", ...verify };
  }

  async _answerConnect(questionModel, tree, maxAttempts) {
    const correctPairs = resolveConnectCorrectPairs(questionModel);
    if (!correctPairs) {
      return { supported: false, reason: "CONNECT: không resolve được cặp đúng từ CMS.", texts: collectTexts(tree) };
    }
    // Cuộn (chỉ khi cần) tới khi đọc đủ TEXT cả 2 phía của TOÀN BỘ cặp đúng - TRƯỚC ĐÂY đọc thẳng
    // collectConnectSlots(tree) đúng 1 lần KHÔNG cuộn, khiến câu dài hơn 1 màn hình throw
    // BLOCKED_CONNECT_INTERACTION oan ngay từ bước resolve slot (bug thật xác nhận qua đọc code
    // 2026-09-23, "matching multi-scroll tap stale-index" - biến thể Vui học này còn thiếu cả
    // Phase A, không chỉ thiếu bước cuộn khôi phục trước khi tap). TÁI SỬ DỤNG
    // ensureAllConnectPairsVisible() từ homeworkExamEngine.js, không viết thuật toán cuộn riêng.
    const visibleResult = await ensureAllConnectPairsVisible(this.bridge, tree, correctPairs);
    const slots = visibleResult.slots;
    if (visibleResult.scrollCount > 0) tree = visibleResult.tree;

    const buildSelectSteps = () => {
      const steps = [];
      for (const pair of correctPairs) {
        const leftIndex = resolveConnectSlotIndex(slots, "left", pair.leftText, questionModel?.id);
        const rightIndex = resolveConnectSlotIndex(slots, "right", pair.rightText, questionModel?.id);
        steps.push({ tapOn: { id: `exercise_connect_left_${leftIndex}` } });
        steps.push({ tapOn: { id: `exercise_connect_right_${rightIndex}` } });
      }
      return steps;
    };

    // Nối cặp trước rồi đọc NGAY 1 lần: Vui học CONNECT có 2 hành vi khác nhau tuỳ màn - TỰ kiểm
    // tra ngay khi đủ cặp (không có "exercise_check_button", xem unit9_getting_started_tram_khoi_
    // hanh.yaml S12) HOẶC có nút Kiểm tra riêng như các dạng khác - kiểm tra thật, không giả định.
    //
    // tapConnectPairs() - thử BATCH 1 lượt trước (giữ nguyên PERF cũ), chỉ rớt xuống tap từng ô +
    // cuộn khôi phục 2 chiều khi batch thất bại (CÙNG bug/fix "matching multi-scroll tap stale-
    // index"). CHỈ áp dụng cho lượt nối cặp ĐẦU TIÊN này - lượt "Thử lại" sau (buildStepsForVerify
    // bên dưới) vẫn dùng buildSelectSteps() thô như cũ qua _submitAndVerify() (ngoài phạm vi bug đã
    // báo - chỉ xảy ra ở bước nối cặp đầu khi câu vừa hiện ra, chưa gặp thật ở lượt Thử lại).
    await tapConnectPairs(this.bridge, correctPairs, slots, questionModel?.id, {
      label: "CONNECT: nối cặp",
      trailingSteps: [{ waitForAnimationToEnd: { timeout: 1500 } }],
    });
    const afterTapTree = await this.bridge.hierarchy();

    if (hasResourceId(afterTapTree, /^exercise_check_button$/)) {
      // Đã nối xong ở trên rồi - lượt ĐẦU của _submitAndVerify chỉ cần bấm Kiểm tra (không nối lại
      // để tránh untoggle); các lượt "Thử lại" SAU mới cần nối lại (buildSelectSteps thật).
      let firstCall = true;
      const buildStepsForVerify = () => {
        if (firstCall) {
          firstCall = false;
          return [];
        }
        return buildSelectSteps();
      };
      const verify = await this._submitAndVerify(maxAttempts, buildStepsForVerify);
      return { supported: true, type: "CONNECT", ...verify };
    }

    // Không có nút Kiểm tra - app tự chấm ngay. Đọc thẳng texts đã có (afterTapTree), KHÔNG gọi
    // thêm polling nào.
    const texts = collectTexts(afterTapTree);
    const correct = texts.some((t) => t.startsWith("Chính xác"));
    const incorrect = texts.some((t) => t.startsWith("Chưa chính xác"));
    const advanceResult = await this.bridge.runSteps([
      { tapOn: { text: "Tiếp tục|Tiếp theo|Hoàn thành", optional: true } },
      { waitForAnimationToEnd: { timeout: 1000 } },
    ]);
    if (!advanceResult.success) throw new Error(`CONNECT: không đi tiếp được: ${advanceResult.error}`);
    return { supported: true, type: "CONNECT", correct: correct ? true : incorrect ? false : null, attempts: 1 };
  }

  /**
   * SORT KHÔNG dùng chung `_submitAndVerify()` (khác CHOICE/FILL_WORD/DRAG_DROP/CONNECT) - lý do:
   * `buildSelectSteps()` của các dạng kia là HÀM THUẦN (tính 1 lần, không cần đụng thiết bị giữa
   * chừng), trong khi SORT cần ĐỌC LẠI bounds thật SAU MỖI lần kéo để tính lượt kéo TIẾP THEO
   * (xem computeNextSortMove() - đã đo THẬT lỗi khi mô phỏng gộp không đọc lại thiết bị). Vòng lặp
   * kéo dưới đây tự đọc/kéo/đọc lại tới khi ĐÚNG thứ tự (hoặc hết vòng an toàn), rồi mới chuyển
   * sang chu trình Kiểm tra/Thử lại - CÙNG NGUYÊN TẮC state-machine đọc nhãn nút thật như
   * `_submitAndVerify()` (không tách 2 nơi khác thuật toán), chỉ khác ở chỗ "Thử lại" cần chạy lại
   * vòng lặp kéo (vị trí có thể vẫn sai) thay vì gọi lại 1 hàm build-steps thuần.
   */
  async _answerSort(questionModel, tree, maxAttempts) {
    const targetOrder = resolveSortTargetOrder(questionModel);
    if (!targetOrder) {
      return {
        supported: false,
        reason: "SORT: không suy ra được hoán vị đúng (content/correct thiếu, lệch số đoạn, hoặc không khớp text được).",
        texts: collectTexts(tree),
      };
    }

    // Kéo TỚI KHI ĐÚNG thứ tự - đọc bounds THẬT trước MỖI lần kéo (KHÔNG mô phỏng/gộp - xem
    // docblock computeNextSortMove()). Bounded bởi targetOrder.length (an toàn, đủ dư so với số
    // lượt kéo tối đa thật sự cần - selection sort cần tối đa n-1 lượt).
    const fixOrder = async (startTree) => {
      let t = startTree;
      for (let round = 0; round < targetOrder.length; round++) {
        const move = computeNextSortMove(targetOrder, t);
        if (!move) return;
        const dragResult = await this.bridge.runSteps([move, { waitForAnimationToEnd: { timeout: 1500 } }]);
        if (!dragResult.success) throw new Error(`SORT: kéo thất bại (vòng ${round + 1}): ${dragResult.error}`);
        t = await this.bridge.hierarchy(); // ASYNC MIGRATION - xem comment _submitAndVerify().
      }
    };
    await fixOrder(tree); // Lượt ĐẦU dùng `tree` đã có sẵn cho round đầu tiên của fixOrder.

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const checkResult = await this.bridge.runSteps([checkButtonTap(), { waitForAnimationToEnd: { timeout: 1200 } }]);
      if (!checkResult.success) throw new Error(`SORT: bấm Kiểm tra thất bại (lượt ${attempt}): ${checkResult.error}`);

      const verdictTree = await this.bridge.hierarchy(); // ASYNC MIGRATION - xem comment _submitAndVerify().
      const texts = collectTexts(verdictTree);
      const correct = texts.some((t) => t.startsWith("Chính xác"));
      const incorrect = texts.some((t) => t.startsWith("Chưa chính xác"));
      const canRetry = texts.includes("Thử lại");

      if (correct) {
        await this.bridge.runSteps([checkButtonTap(), { waitForAnimationToEnd: { timeout: 1200 } }]);
        return { supported: true, type: "SORT", correct: true, attempts: attempt };
      }
      if (incorrect) {
        if (!canRetry || attempt >= maxAttempts) {
          await this.bridge.runSteps([checkButtonTap(), { waitForAnimationToEnd: { timeout: 1200 } }]);
          return { supported: true, type: "SORT", correct: false, attempts: attempt };
        }
        const retryTapResult = await this.bridge.runSteps([checkButtonTap(), { waitForAnimationToEnd: { timeout: 800 } }]); // "Thử lại"
        if (!retryTapResult.success) throw new Error(`SORT: bấm Thử lại thất bại: ${retryTapResult.error}`);
        // ASYNC MIGRATION: `hierarchy()` TRẢ VỀ TRỰC TIẾP làm argument cho fixOrder() - PHẢI
        // `await` TRƯỚC khi truyền (khác các chỗ khác chỉ gán biến) - nếu không, bridge MCP (async)
        // sẽ truyền 1 Promise CHƯA RESOLVE làm `startTree`, fixOrder() dùng luôn làm tree sai hoàn
        // toàn (không throw rõ ràng, chỉ ra kết quả sai lặng lẽ) - BUG THẬT đã audit trước khi sửa.
        await fixOrder(await this.bridge.hierarchy()); // vị trí có thể vẫn sai sau Thử lại - kéo lại.
        continue;
      }
      return { supported: true, type: "SORT", correct: null, attempts: attempt };
    }
    return { supported: true, type: "SORT", correct: null, attempts: maxAttempts };
  }

  /**
   * Trả lời ĐÚNG câu hiện tại rồi xử lý trọn vòng Kiểm tra/Thử lại/Tiếp tục.
   * @param {import("../model/questionModel.js").QuestionModel} questionModel - câu ĐÃ được khớp
   *   sẵn với màn hình hiện tại (xem vuiHocQuestionMatcher.js#findMatchingPoolEntry) - engine
   *   KHÔNG tự tìm câu, chỉ thực thi.
   * @param {{ maxAttempts?: number, tree?: Object|null, uiType?: string|null }} [options] -
   *   `tree`/`uiType`: TRUYỀN VÀO nếu caller đã đọc/detect sẵn (runner luôn có, vì cần để matching
   *   câu TRƯỚC khi gọi hàm này) - tránh 1 lượt `hierarchy()` thừa. Không truyền thì tự đọc (dùng
   *   khi gọi độc lập/test).
   */
  async answerCurrentQuestion(questionModel, { maxAttempts = 3, tree = null, uiType = null } = {}) {
    const t = tree ?? (await this.bridge.hierarchy());
    const type = uiType ?? detectQuestionUiType(t);

    switch (type) {
      case "SORT":
        return this._answerSort(questionModel, t, maxAttempts);
      case "CONNECT":
        return this._answerConnect(questionModel, t, maxAttempts);
      case "FILL_WORD_SINGLE":
        return this._answerFillWordSingle(questionModel, t, maxAttempts);
      case "FILL_WORD_MULTI":
        return this._answerFillWordMulti(questionModel, t, maxAttempts);
      case "DRAG_DROP":
        return this._answerDragDrop(questionModel, t, maxAttempts);
      case "CHOICE":
        return this._answerChoice(questionModel, t, maxAttempts);
      default:
        return {
          supported: false,
          reason: "VuiHocExamEngine: không nhận diện được UI type của câu hiện tại.",
          texts: collectTexts(t),
        };
    }
  }
}
