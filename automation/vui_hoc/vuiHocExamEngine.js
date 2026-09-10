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
 *     collectConnectSlots, resolveConnectSlotIndex, collectTexts, hasResourceId.
 *   - ensureIdVisible() (automation/bridge/scrollUntilVisible.js) - 0 chi phí thêm khi control đã
 *     visible sẵn (xem docblock file đó) - giữ nguyên cho câu dài hơn 1 màn hình.
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
  collectConnectSlots,
  resolveConnectCorrectPairs,
  resolveConnectSlotIndex,
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
   * Lượt ĐẦU: `buildSelectSteps()` (chọn/gõ/kéo đáp án) + tap "exercise_check_button" GỘP CHUNG
   * 1 `runSteps()`. Sau đó đọc ĐÚNG 1 lần `hierarchy()` để lấy nhãn thật:
   *   - "Chính xác..."                          -> CORRECT, bấm thêm 1 lần để đi tiếp, DỪNG.
   *   - "Chưa chính xác..." + còn "Thử lại"      -> gộp (Thử lại + chọn lại đáp án + Kiểm tra lại)
   *                                                 vào 1 `runSteps()` cho lượt kế, lặp lại.
   *   - "Chưa chính xác..." + KHÔNG còn "Thử lại" -> đã reveal, bấm thêm 1 lần để đi tiếp, DỪNG.
   *   - Không thấy nhãn nào (đã tự chuyển màn)     -> DỪNG, correct=null.
   * Bounded bởi `maxAttempts` (an toàn, KHÔNG phải điều kiện thiết kế chính - chỉ chặn lặp vô hạn
   * nếu app vào trạng thái không lường trước).
   * @param {number} maxAttempts
   * @param {() => Array<Object>} buildSelectSteps - trả mảng Maestro step (KHÔNG async, KHÔNG tự
   *   thực thi) - gọi lại được nhiều lần (mỗi lần thử lại gọi 1 lần, PHẢI idempotent).
   */
  async _submitAndVerify(maxAttempts, buildSelectSteps) {
    let steps = [...buildSelectSteps(), { waitForAnimationToEnd: { timeout: 1000 } }, checkButtonTap(), { waitForAnimationToEnd: { timeout: 1200 } }];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await this.bridge.runSteps(steps);
      if (!result.success) throw new Error(`Thao tác trả lời câu thất bại (lượt ${attempt}): ${result.error}`);

      const tree = this.bridge.hierarchy(); // ĐÚNG 1 lượt đọc để biết verdict - không polling.
      const texts = collectTexts(tree);
      const correct = texts.some((t) => t.startsWith("Chính xác"));
      const incorrect = texts.some((t) => t.startsWith("Chưa chính xác"));
      const canRetry = texts.includes("Thử lại");

      if (correct) {
        await this.bridge.runSteps([checkButtonTap(), { waitForAnimationToEnd: { timeout: 1200 } }]); // "Tiếp tục"/"Hoàn thành"
        return { correct: true, attempts: attempt };
      }

      if (incorrect) {
        if (!canRetry || attempt >= maxAttempts) {
          // Hết lượt thử THẬT (nút đã đổi "Tiếp theo"/"Hoàn thành") HOẶC hết giới hạn an toàn -
          // bấm ĐÚNG 1 lần để đi tiếp, KHÔNG reselect (tránh thao tác nhầm sang câu kế tiếp).
          await this.bridge.runSteps([checkButtonTap(), { waitForAnimationToEnd: { timeout: 1200 } }]);
          return { correct: false, attempts: attempt };
        }
        // Gộp "Thử lại" + chọn lại đáp án + "Kiểm tra" lại vào 1 runSteps() DUY NHẤT cho lượt kế.
        steps = [
          checkButtonTap(), // "Thử lại"
          { waitForAnimationToEnd: { timeout: 800 } },
          ...buildSelectSteps(),
          { waitForAnimationToEnd: { timeout: 1000 } },
          checkButtonTap(), // "Kiểm tra" lại
          { waitForAnimationToEnd: { timeout: 1200 } },
        ];
        continue;
      }

      // Không thấy "Chính xác"/"Chưa chính xác" - có thể đã tự chuyển câu/màn Kết quả.
      return { correct: null, attempts: attempt };
    }
    return { correct: null, attempts: maxAttempts };
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
    const slots = collectConnectSlots(tree);
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
    const tapResult = await this.bridge.runSteps([...buildSelectSteps(), { waitForAnimationToEnd: { timeout: 1500 } }]);
    if (!tapResult.success) throw new Error(`CONNECT: nối cặp thất bại: ${tapResult.error}`);
    const afterTapTree = this.bridge.hierarchy();

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
        t = this.bridge.hierarchy();
      }
    };
    await fixOrder(tree); // Lượt ĐẦU dùng `tree` đã có sẵn cho round đầu tiên của fixOrder.

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const checkResult = await this.bridge.runSteps([checkButtonTap(), { waitForAnimationToEnd: { timeout: 1200 } }]);
      if (!checkResult.success) throw new Error(`SORT: bấm Kiểm tra thất bại (lượt ${attempt}): ${checkResult.error}`);

      const verdictTree = this.bridge.hierarchy();
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
        await fixOrder(this.bridge.hierarchy()); // vị trí có thể vẫn sai sau Thử lại - kéo lại.
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
    const t = tree ?? this.bridge.hierarchy();
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
