/**
 * OnThiExamEngine - điều hướng màn "Doing" (đang làm 1 lượt đề thật của Ôn thi) + màn "Kết quả bài
 * thi", CHO CẢ 2 TAB "Đề thầy cô giao" lẫn "Kho đề Parrot" (màn Doing/Kết quả là MỘT, dùng chung
 * bất kể đề mở từ tab nào - chỉ khác đường vào, đã xử lý ở `onThiNavigationEngine.js` +
 * `flows/app/helpers/open-de.yaml`/`open-tab-on-thi.yaml`).
 *
 * NGUỒN GỐC: chuyển thể (KHÔNG viết lại từ đầu) từ `automation/bai_tap/navigation/homeworkExamEngine.js`
 * (HomeworkExamEngine) - ĐÃ XÁC NHẬN THẬT qua phiên thao tác tay 2026-10-30 (thiết bị
 * 3201d866d40a1681, 3 đề: "Đề 2810", "Đề thi thử vào 10 Sở DGĐT TP Hà Nội", "Đề thi 14") rằng màn
 * làm bài của Ôn thi DÙNG CHUNG đúng 1 engine câu hỏi `exercise/doing.tsx` với Bài tập - mọi câu hỏi
 * quan sát được (multiple choice, multi-select, True/False, đoạn văn) đều hiển thị y hệt UI/testID
 * dạng `exercise_*` đã biết. Vì vậy module này KHÔNG viết lại thuật toán nhận diện/trả lời từng dạng
 * câu hỏi (TEXT_CHOICE/IMAGE_CHOICE_GRID/CONNECT/FILL_WORD/DRAG_DROP) - import + tái dùng NGUYÊN VẸN
 * các hàm thuần (không gắn `this`) đã export sẵn từ `homeworkExamEngine.js` (bản thân các hàm đó đã
 * generic, không có gì riêng của Bài tập - xem docblock từng hàm trong file gốc).
 *
 * PHẦN THẬT SỰ RIÊNG của Ôn thi (lý do file này tồn tại thay vì dùng thẳng HomeworkExamEngine) -
 * đã xác nhận qua chính phiên thao tác tay nói trên, xem TestCase_PAR-3172_OnThi_LamBai.xlsx:
 *   1. Section + đồng hồ: đề có 2 loại ("có thời gian theo Section" - mỗi section 1 đồng hồ riêng,
 *      reset khi đổi section; "không gắn thời gian theo Section" - 1 đồng hồ CHUNG cho cả đề, KHÔNG
 *      reset khi đổi section) - xem `detectSectionTimerMode()`.
 *   2. CTA cuối màn có 3 nhãn (Tiếp theo/Chuyển phần/Nộp bài), KHÁC Bài tập chỉ có 2
 *      (NEXT_OR_SUBMIT_CTA_CANDIDATES = Tiếp theo/Nộp bài/Hoàn thành, không có "Chuyển phần").
 *   3. 3 popup RIÊNG của Ôn thi, không tồn tại ở Bài tập: "Ngừng làm bài?" (tap icon Thoát),
 *      "Nộp bài ngay?" (tap "Nộp bài" - toolbar HOẶC CTA cuối màn, CÙNG popup), "Bạn muốn chuyển
 *      phần khác?" (CHỈ xuất hiện khi tap "Chuyển phần" lúc section hiện tại VẪN CÒN thời gian - đề
 *      không gắn thời gian theo Section KHÔNG BAO GIỜ gặp popup này).
 *   4. Có thể BỎ QUA 1 câu không trả lời được (vd Speaking - automation không giả lập được mic) chỉ
 *      bằng cách bấm thẳng CTA - KHÁC HẲN Bài tập (answerCurrentQuestion*() của Homework LUÔN throw
 *      "Không khớp chiến lược trả lời nào có Handler hỗ trợ" khi gặp dạng không hỗ trợ, coi đó là
 *      FAIL hợp lệ) - ĐÃ XÁC NHẬN THẬT: tap "Tiếp theo" trên câu Speaking (mic "Nhấn để nói", không
 *      có đáp án text/id nào khớp CONNECT/FILL_WORD/DRAG_DROP) vẫn chuyển câu bình thường.
 *   5. Màn Kết quả dùng bộ nhãn RIÊNG ("Điểm của bạn"/"Số câu đúng"/"Thời gian làm bài"/"Kết quả
 *      theo kỹ năng"), KHÁC HẲN Bài tập ("ĐIỂM SỐ"/"CHÍNH XÁC") - không tái dùng được
 *      `isResultScreen()`/`readResult()` của HomeworkExamEngine, viết lại ở đây.
 *
 * GIỚI HẠN ĐÃ BIẾT (KHÔNG suy đoán thêm, ghi rõ để người đọc sau không tưởng nhầm đã xong):
 *   - CHƯA chạy qua `maestro test`/MaestroBridge thật lần nào - toàn bộ quan sát ở trên đến từ thao
 *     tác tay bằng `adb shell input tap` + đọc screenshot, KHÔNG dump `maestro hierarchy` nên KHÔNG
 *     có resource-id nào được xác nhận (khác hẳn các hàm tái dùng từ homeworkExamEngine.js, nơi
 *     resource-id `exercise_*` đã verify qua hierarchy thật nhiều lần trước đó cho module Bài tập).
 *     Icon "Thoát"/"Đánh dấu xem lại" phải tap theo TOẠ ĐỘ TƯƠNG ĐỐI (góc màn hình) vì không có text
 *     - xem `tapExitIcon()`/`tapMarkForReviewIcon()`, CẦN XÁC MINH lại bằng hierarchy thật trước khi
 *     tin tưởng cho 1 lượt `maestro test` có ý nghĩa.
 *   - Module Ôn thi CHƯA có exam-resolver (xem docblock `automation/on_thi/model/onThiModel.js`) -
 *     mọi lời gọi `answerOrSkipCurrentQuestion()` trong file này mặc định `questionModel = null`.
 *     QUAN TRỌNG (đọc kỹ `decideAnswerAction()` trong file gốc trước khi tưởng đã xong): thiếu
 *     `questionModel` KHÔNG CHỈ mất khả năng "kiểm soát đúng/sai" - CONNECT/FILL_WORD/DRAG_DROP
 *     hoàn toàn KHÔNG trả lời được (bắt buộc `questionModel.metadata.raw.*`), và TEXT_CHOICE CŨNG
 *     KHÔNG nhận diện được (nhánh đó yêu cầu `questionModel?.answers?.length >= 2` để biết text nào
 *     là đáp án - không phải chỉ để biết đáp án nào đúng). CHỈ CÒN "IMAGE_CHOICE_GRID" (lưới 2x2
 *     không chữ) trả lời được HOÀN TOÀN KHÔNG CẦN model. Hệ quả THỰC TẾ: với phần lớn câu trắc
 *     nghiệm dạng chữ đã gặp thật hôm nay (vd "Choose the word..." 4 lựa chọn chữ, "Which of the
 *     following are fruits?") - `runFullAttempt()` sẽ rơi vào nhánh SKIP (bấm CTA không chọn gì) vì
 *     `decideAnswerAction()` trả về `null` khi không có model, KHÔNG PHẢI vì không hỗ trợ loại câu
 *     đó. SKIP có thật sự hoạt động cho câu trắc nghiệm bắt buộc (khác Speaking, vốn không bắt buộc
 *     chọn) hay không - CHƯA XÁC NHẬN (chỉ xác nhận skip hoạt động cho Speaking); nếu CTA không bấm
 *     được khi chưa chọn gì, `answerOrSkipCurrentQuestion()` sẽ throw lỗi trung thực (đúng tinh
 *     thần "FAIL trung thực" của repo, KHÔNG âm thầm coi là pass) chứ không giả vờ chạy qua được.
 *     MUỐN chạy xuyên suốt 1 đề trắc nghiệm chữ thật (không phải chỉ Speaking/ảnh) BẮT BUỘC phải
 *     xây dựng 1 exam-resolver riêng cho Ôn thi trước (mirror `homeworkExamResolver.js`) rồi truyền
 *     `questionModel` thật vào mỗi câu - CHƯA làm trong lượt viết code này (ngoài phạm vi yêu cầu
 *     gốc "viết code chuyển đổi cho phần làm bài", vốn tập trung vào khung điều hướng/popup/
 *     section/timer, không phải vào việc resolve đáp án đúng).
 *   - Câu hỏi multi-select ("Choose all that apply", ĐÃ quan sát thật 1 câu "Which of the following
 *     are fruits?") CHƯA có logic riêng - `decideAnswerAction()` tái dùng từ Bài tập chỉ chọn ĐÚNG 1
 *     đáp án text rồi bấm CTA ngay; CHƯA xác nhận bấm 1 lựa chọn có đủ để CTA enable hay cần ≥2 (lần
 *     quan sát thật duy nhất đã chọn sẵn 2 đáp án). Nếu CTA không bấm được sau khi chọn 1 đáp án,
 *     `answerOrSkipCurrentQuestion()` sẽ throw lỗi trung thực (KHÔNG âm thầm coi là pass) - xem log
 *     lỗi `MULTI_SELECT_CTA_BLOCKED` để biết khi nào cần bổ sung logic chọn nhiều đáp án thật.
 *   - `readTimerBadge()` CHỈ best-effort/diagnostic (không load-bearing cho vòng lặp chính) - ĐÃ
 *     THẤY THẬT 1 va chạm định dạng: câu dạng đoạn văn có kèm audio player cũng hiển thị text dạng
 *     mm:ss ("0:08"/"13:37" - thời lượng audio, KHÔNG PHẢI đồng hồ đếm ngược đề thi) - quét toàn bộ
 *     cây theo regex mm:ss CÓ THỂ đọc nhầm giá trị audio thay vì đồng hồ thật. KHÔNG dùng giá trị
 *     hàm này trả về để quyết định logic (vd "còn bao nhiêu giây để tránh timeout") - chỉ để log.
 */

import {
  collectTexts,
  hasResourceId,
  decideAnswerAction,
  resolveConnectCorrectPairs,
  resolveFillWordValues,
  resolveDragDropCorrectValues,
  collectDragDropZoneIndices,
  ensureAllAnswersVisible,
  ensureAllBlanksVisible,
  ensureAllDragDropZonesVisible,
  ensureAllConnectPairsVisible,
  tapConnectPairs,
  HomeworkExamEngine,
} from "../../bai_tap/navigation/homeworkExamEngine.js";
import { ensureIdVisible, ensureTextVisible } from "../../bridge/scrollUntilVisible.js";
import { onThiPageObjects as po } from "./onThiPageObjects.js";

const EXIT_POPUP_TITLE = po.doing.exitConfirmPopup.title;
const SUBMIT_POPUP_TITLE = po.doing.submitConfirmPopup.title;
const SWITCH_SECTION_POPUP_TITLE = po.doing.switchSectionConfirmPopup.title;
const CTA_REGEX = po.doing.ctaRegex;

/**
 * "Cấu trúc đề" (màn Thông tin đề, TRƯỚC khi bấm "Bắt đầu làm bài") - xác định 1 trong 2 LOẠI đề
 * theo đúng 2 nhóm test case đã chạy thật (TestCase_PAR-3172_OnThi_LamBai.xlsx, nhóm 1 vs nhóm 2):
 * mỗi dòng section có kèm nhãn "N phút" ngay sau tên -> PER_SECTION (đồng hồ riêng/section, reset
 * khi đổi section, có popup "Bạn muốn chuyển phần khác?"); KHÔNG dòng nào kèm nhãn -> WHOLE_EXAM (1
 * đồng hồ chung, không reset, không có popup đó). KHÔNG suy đoán theo tên section - chỉ đếm số dòng
 * CÓ nhãn thời lượng trong đúng card "Cấu trúc đề" (dùng offset dòng NGAY SAU tiêu đề đó tới hết
 * card, giống cách TEST-CASES.md mô tả 2 đề đã quan sát thật).
 * @param {Object} examInfoTree - `bridge.hierarchy()` của màn "Thông tin đề"
 * @returns {{ mode: "PER_SECTION"|"WHOLE_EXAM"|"UNKNOWN", sectionNames: string[] }}
 */
export function detectSectionTimerMode(examInfoTree) {
  const texts = collectTexts(examInfoTree);
  const structureIdx = texts.indexOf(po.examInfo.structureSectionTitle);
  if (structureIdx < 0) return { mode: "UNKNOWN", sectionNames: [] };
  const durationPattern = new RegExp(`^${po.examInfo.sectionDurationPattern}$`);
  const rows = texts.slice(structureIdx + 1);
  const sectionNames = rows.filter((t) => !durationPattern.test(t));
  const durationCount = rows.filter((t) => durationPattern.test(t)).length;
  if (durationCount === 0) return { mode: "WHOLE_EXAM", sectionNames };
  if (durationCount === sectionNames.length) return { mode: "PER_SECTION", sectionNames };
  return { mode: "UNKNOWN", sectionNames };
}

export class OnThiExamEngine {
  /** @param {import("../../bridge/maestroBridge.js").MaestroBridge} bridge */
  constructor(bridge) {
    this.bridge = bridge;
    // Compose, KHÔNG kế thừa - chỉ mượn 2 hành vi thật sự chung toàn app (popup AI consent), mọi
    // hành vi khác của HomeworkExamEngine KHÔNG áp dụng được cho Ôn thi (xem docblock đầu file).
    this._homeworkEngine = new HomeworkExamEngine(bridge);
  }

  /** Dismiss popup chung "AI hỗ trợ học tập" nếu xuất hiện - CÙNG dialog toàn app, tái dùng thẳng. */
  async dismissAiPopupIfPresent() {
    return this._homeworkEngine.dismissAiPopupIfPresent();
  }

  /**
   * Đọc "Cấu trúc đề" trên màn Thông tin đề NGAY TRƯỚC khi bấm "Bắt đầu làm bài" - gọi hàm này rồi
   * giữ lại kết quả (`sectionTimerMode`) để truyền cho `runFullAttempt()`, vì sau khi vào màn Doing
   * sẽ không còn cách nào đọc lại "Cấu trúc đề" (màn đó không hiển thị thông tin này nữa).
   */
  async readExamInfo() {
    const tree = await this.bridge.hierarchy();
    return detectSectionTimerMode(tree);
  }

  /** Bấm "Bắt đầu làm bài" trên màn Thông tin đề -> xác nhận popup "Bắt đầu làm bài?" -> vào màn
   * Doing. Idempotent-safe: nếu KHÔNG thấy popup (vd đề "Làm tiếp" một lượt dở dang có thể bỏ qua
   * popup xác nhận - CHƯA xác nhận thật) thì bỏ qua bước xác nhận, không throw. */
  async startFromExamInfoScreen() {
    const tapStart = await this.bridge.tap(po.examInfo.startButton);
    if (!tapStart.success) {
      throw new Error(`OnThiExamEngine: không bấm được "${po.examInfo.startButton}": ${tapStart.error}`);
    }
    await this.bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1000 } }]);
    if (this.bridge.isVisible(po.examInfo.startConfirmPopup.title)) {
      const confirm = await this.bridge.tap(po.examInfo.startConfirmPopup.confirmButton);
      if (!confirm.success) {
        throw new Error(`OnThiExamEngine: không bấm được "${po.examInfo.startConfirmPopup.confirmButton}": ${confirm.error}`);
      }
    }
    await this.bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1500 } }]);
  }

  /** @param {Object} [tree] - tránh fetch lại hierarchy nếu caller đã có sẵn (cùng quy ước
   * `isResultScreen(tree)` của HomeworkExamEngine). */
  isExamResultScreen(tree) {
    const texts = collectTexts(tree ?? this.bridge.hierarchy());
    return texts.includes(po.resultScreen.screenTitle) || texts.includes(po.resultScreen.scoreLabel);
  }

  /**
   * Đọc điểm/kết quả thật trên màn "Kết quả bài thi" - CÙNG nguyên tắc `readResult()` của
   * HomeworkExamEngine (lấy dòng text NGAY SAU nhãn, không suy đoán vị trí cụ thể) nhưng bộ nhãn
   * hoàn toàn khác (xem docblock đầu file) nên viết lại, không gọi lại hàm gốc.
   * @param {Object} [tree]
   * @returns {{ score: string|null, correctCount: number|null, totalCount: number|null,
   *            durationText: string|null, skillBreakdown: Array<{skill:string, score:string}> }}
   */
  readExamResult(tree) {
    const texts = collectTexts(tree ?? this.bridge.hierarchy());
    const scoreIdx = texts.indexOf(po.resultScreen.scoreLabel);
    const correctIdx = texts.indexOf(po.resultScreen.correctCountLabel);
    const durationIdx = texts.indexOf(po.resultScreen.durationLabel);
    const skillIdx = texts.indexOf(po.resultScreen.skillBreakdownTitle);

    const score = scoreIdx >= 0 ? texts[scoreIdx + 1] ?? null : null;
    const correctText = correctIdx >= 0 ? texts[correctIdx + 1] ?? null : null;
    const durationText = durationIdx >= 0 ? texts[durationIdx + 1] ?? null : null;
    const m = /^(\d+)\s*\/\s*(\d+)$/.exec(correctText || "");

    // "Kết quả theo kỹ năng": cặp [tên kỹ năng, điểm] liên tiếp NGAY SAU tiêu đề, dừng lại ở nút
    // "Xem lại bài đã làm" (mốc kết thúc card, luôn có mặt - xem resultScreen.reviewLink) - KHÔNG
    // biết trước số dòng (1 hoặc nhiều kỹ năng tuỳ cấu trúc đề), đọc tới khi hết hoặc gặp mốc đó.
    const skillBreakdown = [];
    if (skillIdx >= 0) {
      for (let i = skillIdx + 1; i + 1 < texts.length; i += 2) {
        if (texts[i] === po.resultScreen.reviewLink) break;
        skillBreakdown.push({ skill: texts[i], score: texts[i + 1] });
      }
    }

    return {
      score,
      correctCount: m ? Number(m[1]) : null,
      totalCount: m ? Number(m[2]) : null,
      durationText,
      skillBreakdown,
    };
  }

  /** Best-effort, CHỈ để log/chẩn đoán - xem cảnh báo va chạm định dạng audio mm:ss ở docblock đầu
   * file. KHÔNG dùng giá trị trả về để quyết định luồng chạy. */
  readTimerBadge(tree) {
    const texts = collectTexts(tree ?? this.bridge.hierarchy());
    const candidates = texts.filter((t) => /^\d{1,2}:\d{2}$/.test(t));
    return candidates[0] ?? null;
  }

  /**
   * Tap icon "Thoát" (góc trái header, KHÔNG có text) rồi xử lý popup "Ngừng làm bài?".
   *
   * SỬA LẠI SAU KHI CHẠY THẬT (2026-11-04, thiết bị 3201d866d40a1681, qua `maestro hierarchy` thật
   * trong phiên viết/chạy bộ `flows/app/on_thi/CD-*.yaml`): icon này CÓ resource-id thật
   * (`po.doing.exitIconId` = "exam_prep_doing_header_left") - XOÁ bỏ yêu cầu tham số `iconPoint`
   * toạ độ đoán theo thiết bị cụ thể, tap thẳng bằng id (ổn định qua mọi độ phân giải).
   * @param {"stay"|"exit"} decision
   */
  async tapExitIcon(decision) {
    const tapIcon = await this.bridge.tap({ id: po.doing.exitIconId });
    if (!tapIcon.success) {
      throw new Error(`OnThiExamEngine.tapExitIcon: không tap được icon Thoát (id "${po.doing.exitIconId}"): ${tapIcon.error}`);
    }
    const wait = await this.bridge.wait(EXIT_POPUP_TITLE, { timeout: 5000 });
    if (!wait.success) {
      throw new Error(`OnThiExamEngine.tapExitIcon: không thấy popup "${EXIT_POPUP_TITLE}" sau khi tap icon Thoát: ${wait.error}`);
    }
    const buttonLabel = decision === "exit" ? po.doing.exitConfirmPopup.confirmExitButton : po.doing.exitConfirmPopup.stayButton;
    const tapButton = await this.bridge.tap(buttonLabel);
    if (!tapButton.success) {
      throw new Error(`OnThiExamEngine.tapExitIcon: không bấm được "${buttonLabel}": ${tapButton.error}`);
    }
    await this.bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1000 } }]);
  }

  /** Tap nút "Nộp bài" trên TOOLBAR (góc phải header, LUÔN hiển thị) rồi xử lý popup "Nộp bài
   * ngay?" - KHÁC `_advanceAfterAnswer()` bên dưới (nơi "Nộp bài" chỉ xuất hiện NẾU đang ở câu
   * cuối cùng của đề, dùng chung vị trí CTA cuối màn). */
  async submitViaToolbarButton(decision = "submit") {
    const tapToolbar = await this.bridge.tap(po.doing.toolbarSubmitButton);
    if (!tapToolbar.success) {
      throw new Error(`OnThiExamEngine.submitViaToolbarButton: không bấm được "${po.doing.toolbarSubmitButton}": ${tapToolbar.error}`);
    }
    const wait = await this.bridge.wait(SUBMIT_POPUP_TITLE, { timeout: 5000 });
    if (!wait.success) {
      throw new Error(`OnThiExamEngine.submitViaToolbarButton: không thấy popup "${SUBMIT_POPUP_TITLE}": ${wait.error}`);
    }
    const buttonLabel =
      decision === "submit" ? po.doing.submitConfirmPopup.confirmSubmitButton : po.doing.submitConfirmPopup.continueButton;
    const tapButton = await this.bridge.tap(buttonLabel);
    if (!tapButton.success) {
      throw new Error(`OnThiExamEngine.submitViaToolbarButton: không bấm được "${buttonLabel}": ${tapButton.error}`);
    }
    await this.bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1500 } }]);
  }

  /** Mở bottom sheet "Danh sách câu hỏi" qua nút x/y ở thanh công cụ dưới cùng. */
  async openQuestionList() {
    const result = await this.bridge.runSteps([
      { tapOn: { text: po.doing.questionListButtonPattern } },
      { assertVisible: { text: po.doing.questionListSheetTitle } },
    ]);
    if (!result.success) {
      throw new Error(`OnThiExamEngine.openQuestionList: không mở được bottom sheet: ${result.error}`);
    }
  }

  /** Đóng bottom sheet "Danh sách câu hỏi" bằng cách tap ra vùng tối phía trên (KHÔNG có nút "Đóng"
   * dạng text quan sát được) - `point` CẦN XÁC MINH tương tự `tapExitIcon()`. */
  async closeQuestionList(dimAreaPoint) {
    const result = await this.bridge.tap({ point: dimAreaPoint });
    if (!result.success) {
      throw new Error(`OnThiExamEngine.closeQuestionList: không tap được vùng đóng sheet: ${result.error}`);
    }
  }

  /** Trong bottom sheet "Danh sách câu hỏi" đang mở, tap đúng số thứ tự câu (dạng số nguyên, text
   * CHÍNH XÁC trùng số - KHÔNG dùng regex vì số câu 1 chữ số có thể khớp nhầm số nhiều chữ số chứa
   * nó, vd "1" khớp cả "11"/"12" nếu match substring). Caller tự chịu trách nhiệm chỉ gọi khi câu
   * đó KHÔNG bị khoá (section đã qua/chưa mở của đề có thời gian theo Section - xem TC_27/TC_28). */
  async tapQuestionNumberInSheet(questionNumber) {
    const result = await this.bridge.tap({ text: `^${questionNumber}$` });
    if (!result.success) {
      throw new Error(`OnThiExamEngine.tapQuestionNumberInSheet: không tap được câu số ${questionNumber}: ${result.error}`);
    }
  }

  /**
   * Trả lời (hoặc BỎ QUA nếu không hỗ trợ - xem điểm 4 docblock đầu file) câu hiện tại rồi bấm CTA
   * để qua câu kế tiếp/chuyển phần/nộp bài, xử lý CẢ 2 popup "Bạn muốn chuyển phần khác?"/"Nộp bài
   * ngay?" nếu xuất hiện NGAY SAU khi bấm CTA (best-effort, tap xác nhận LUÔN - vì mục đích hàm này
   * là ĐI TỚI màn Kết quả, không phải dừng lại để QA xem).
   *
   * TÁI SỬ DỤNG nguyên khối logic nhận diện/trả lời nội dung CONNECT/FILL_WORD/DRAG_DROP/
   * TEXT_CHOICE/IMAGE_CHOICE_GRID từ `homeworkExamEngine.js` (các hàm thuần export sẵn, xem import
   * đầu file) - CHỈ đổi phần "bấm CTA sau khi đã có nội dung trả lời" (CTA_REGEX riêng của Ôn thi)
   * và phần xử lý popup (Ôn thi có 2 popup riêng, Bài tập không có popup nào tương đương).
   *
   * @param {import("../../bai_tap/model/questionModel.js").QuestionModel | null} questionModel -
   *   `null` theo mặc định cho tới khi Ôn thi có exam-resolver riêng (xem docblock đầu file).
   * @param {{ wantCorrect?: boolean }} [options]
   * @returns {Promise<
   *     { supported: true, type: string, isTargetCorrect: boolean|null, skipped?: true }
   *   | { supported: false, reason: string }>}
   */
  async answerOrSkipCurrentQuestion(questionModel = null, { wantCorrect = true } = {}) {
    let tree = await this.bridge.hierarchy();
    let textsBefore = collectTexts(tree);

    let contentResult = null;

    if (hasResourceId(tree, /^exercise_connect_left_0$/)) {
      const correctPairs = resolveConnectCorrectPairs(questionModel);
      if (correctPairs) {
        const { tree: visibleTree, slots, scrollCount } = await ensureAllConnectPairsVisible(this.bridge, tree, correctPairs);
        if (scrollCount > 0) {
          tree = visibleTree;
          textsBefore = collectTexts(tree);
        }
        const n = correctPairs.length;
        const isTargetCorrect = wantCorrect || n < 2;
        const pairsToTap = isTargetCorrect
          ? correctPairs
          : correctPairs.map((p, i) => ({ leftText: p.leftText, rightText: correctPairs[(i + 1) % n].rightText }));
        await tapConnectPairs(this.bridge, pairsToTap, slots, questionModel?.id, {
          label: "OnThi CONNECT",
          trailingSteps: [{ waitForAnimationToEnd: { timeout: 1500 } }],
        });
        contentResult = { type: "CONNECT", isTargetCorrect };
      }
    } else if (hasResourceId(tree, /^exercise_fillword_blank_0$/)) {
      const correctValues = resolveFillWordValues(questionModel);
      if (correctValues) {
        const { tree: visibleTree, acc, scrollCount } = await ensureAllBlanksVisible(this.bridge, tree, correctValues.length);
        if (scrollCount > 0) {
          tree = visibleTree;
          textsBefore = collectTexts(tree);
        }
        const blankIndices = [...acc].sort((a, b) => a - b);
        if (blankIndices.length === correctValues.length) {
          const isTargetCorrect = wantCorrect;
          const valuesToType = isTargetCorrect ? correctValues : correctValues.map(() => "zzzsaizzz");
          const fillSteps = [];
          blankIndices.forEach((idx, i) => {
            fillSteps.push({ tapOn: { id: `exercise_fillword_blank_${idx}` } });
            fillSteps.push({ inputText: valuesToType[i] });
            if (i < blankIndices.length - 1) fillSteps.push("hideKeyboard");
          });
          fillSteps.push("hideKeyboard");
          fillSteps.push({ waitForAnimationToEnd: { timeout: 1500 } });
          const fillResult = await this.bridge.runSteps(fillSteps);
          if (!fillResult.success) throw new Error(`OnThi FILL_WORD: chuỗi thao tác thất bại: ${fillResult.error}`);
          await ensureIdVisible(this.bridge, await this.bridge.hierarchy(), /^exercise_check_button$/);
          const checkResult = await this.bridge.runSteps([
            { tapOn: { id: "exercise_check_button", optional: true } },
            { waitForAnimationToEnd: { timeout: 1500 } },
          ]);
          if (!checkResult.success) throw new Error(`OnThi FILL_WORD: không bấm được exercise_check_button: ${checkResult.error}`);
          contentResult = { type: "FILL_WORD", isTargetCorrect };
        }
      }
    } else if (hasResourceId(tree, /^exercise_dragdrop_zone_0$/)) {
      const correctValues = resolveDragDropCorrectValues(questionModel);
      if (correctValues) {
        const { tree: visibleTree, acc, scrollCount } = await ensureAllDragDropZonesVisible(this.bridge, tree, correctValues.length);
        if (scrollCount > 0) {
          tree = visibleTree;
          textsBefore = collectTexts(tree);
        }
        const zoneIndices = [...acc].sort((a, b) => a - b);
        if (zoneIndices.length === correctValues.length) {
          const n = correctValues.length;
          let isTargetCorrect;
          let wordsToTap;
          if (wantCorrect) {
            isTargetCorrect = true;
            wordsToTap = correctValues;
          } else if (n >= 2) {
            isTargetCorrect = false;
            wordsToTap = correctValues.map((_, i) => correctValues[(i + 1) % n]);
          } else {
            const wordBank = (questionModel?.answers ?? []).filter((a) => typeof a === "string" && a.trim());
            const distractor = wordBank.find((w) => w !== correctValues[0]);
            isTargetCorrect = !distractor;
            wordsToTap = distractor ? [distractor] : correctValues;
          }
          const answersVisible = await ensureAllAnswersVisible(this.bridge, tree, questionModel);
          if (answersVisible.scrollCount > 0) {
            tree = answersVisible.tree;
            textsBefore = collectTexts(tree);
          }
          const tapResult = await this.bridge.runSteps([
            ...wordsToTap.map((word) => ({ tapOn: word })),
            { waitForAnimationToEnd: { timeout: 1500 } },
          ]);
          if (!tapResult.success) throw new Error(`OnThi DRAG_DROP: chuỗi thao tác thất bại: ${tapResult.error}`);
          await ensureIdVisible(this.bridge, await this.bridge.hierarchy(), /^exercise_check_button$/);
          const checkResult = await this.bridge.runSteps([
            { tapOn: { id: "exercise_check_button", optional: true } },
            { waitForAnimationToEnd: { timeout: 1500 } },
          ]);
          if (!checkResult.success) throw new Error(`OnThi DRAG_DROP: không bấm được exercise_check_button: ${checkResult.error}`);
          contentResult = { type: "DRAG_DROP", isTargetCorrect };
        }
      }
    } else {
      const answersVisible = await ensureAllAnswersVisible(this.bridge, tree, questionModel);
      if (answersVisible.scrollCount > 0) {
        tree = answersVisible.tree;
        textsBefore = collectTexts(tree);
      }
      const isVisible = (t) => this.bridge.isVisible(t);
      const action = decideAnswerAction(tree, isVisible, questionModel, wantCorrect);
      if (action) {
        const tapStep = action.type === "TEXT_CHOICE" ? { tapOn: action.text } : { tapOn: { point: action.point } };
        const tapResult = await this.bridge.runSteps([tapStep, { waitForAnimationToEnd: { timeout: 1500 } }]);
        if (!tapResult.success) {
          throw new Error(`OnThi ${action.type}: UI không nhận câu trả lời (${JSON.stringify(tapStep)}): ${tapResult.error}`);
        }
        contentResult = { type: action.type, isTargetCorrect: action.isTargetCorrect };
      }
    }

    // KHÔNG khớp dạng nào có Handler hỗ trợ (vd Speaking "Nhấn để nói", hoặc thiếu questionModel
    // cho CONNECT/FILL_WORD/DRAG_DROP) - BỎ QUA, bấm thẳng CTA (KHÁC Bài tập, xem điểm 4 docblock
    // đầu file - đã xác nhận thật Ôn thi cho phép skip).
    const skipped = !contentResult;

    const ctaAnchorTree = await this.bridge.hierarchy();
    await ensureTextVisible(this.bridge, ctaAnchorTree, [po.doing.ctaNext, po.doing.ctaSwitchSection, po.doing.ctaSubmitAtLastQuestion]);

    const ctaResult = await this.bridge.runSteps([
      { tapOn: { text: CTA_REGEX } },
      { waitForAnimationToEnd: { timeout: 1000 } },
    ]);
    if (!ctaResult.success) {
      if (skipped) {
        return { supported: false, reason: "Không khớp dạng câu hỏi nào có Handler hỗ trợ, và cũng không bấm được CTA để bỏ qua." };
      }
      throw new Error(
        `OnThi: không bấm được CTA (${CTA_REGEX}) sau khi trả lời (có thể là MULTI_SELECT_CTA_BLOCKED - xem giới hạn đã biết ở docblock đầu file): ${ctaResult.error}`,
      );
    }

    // 2 popup RIÊNG của Ôn thi - best-effort, LUÔN xác nhận (mục đích là tiến tới màn Kết quả).
    let treeAfter = await this.bridge.hierarchy();
    let textsAfter = collectTexts(treeAfter);

    if (textsAfter.includes(SWITCH_SECTION_POPUP_TITLE)) {
      const confirm = await this.bridge.tap(po.doing.switchSectionConfirmPopup.confirmSwitchButton);
      if (!confirm.success) {
        throw new Error(`OnThi: thấy popup "${SWITCH_SECTION_POPUP_TITLE}" nhưng không bấm được xác nhận chuyển phần: ${confirm.error}`);
      }
      await this.bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1000 } }]);
      treeAfter = await this.bridge.hierarchy();
      textsAfter = collectTexts(treeAfter);
    }

    if (textsAfter.includes(SUBMIT_POPUP_TITLE)) {
      const confirm = await this.bridge.tap(po.doing.submitConfirmPopup.confirmSubmitButton);
      if (!confirm.success) {
        throw new Error(`OnThi: thấy popup "${SUBMIT_POPUP_TITLE}" nhưng không bấm được xác nhận nộp bài: ${confirm.error}`);
      }
      await this.bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1500 } }]);
      treeAfter = await this.bridge.hierarchy();
      textsAfter = collectTexts(treeAfter);
    }

    if (!this.isExamResultScreen(treeAfter) && JSON.stringify(textsAfter) === JSON.stringify(textsBefore)) {
      throw new Error("OnThi: không chuyển được câu/section/nộp bài - màn hình không đổi sau khi bấm CTA.");
    }

    if (skipped) return { supported: true, type: "SKIPPED_UNSUPPORTED", isTargetCorrect: null, skipped: true, finalTree: treeAfter };
    return { supported: true, type: contentResult.type, isTargetCorrect: contentResult.isTargetCorrect, finalTree: treeAfter };
  }

  /**
   * Vòng lặp chạy hết 1 lượt đề từ màn Doing (đã bấm "Bắt đầu làm bài" trước đó) tới màn Kết quả -
   * CÙNG HÌNH DÁNG vòng lặp trong `automation/bai_tap/runtime/homeworkRandomE2E.js` (gọi
   * answer.../OneShot lặp lại tới khi `isResultScreen()`), chỉ đổi tên hàm gọi + điều kiện dừng.
   * @param {{
   *   maxQuestions?: number,
   *   wantCorrect?: boolean,
   *   questionModels?: Map<number, import("../../bai_tap/model/questionModel.js").QuestionModel>,
   * }} [options] - `questionModels` optional, khoá theo thứ tự câu (1-based) nếu Ôn thi sau này có
   *   exam-resolver riêng - KHÔNG bắt buộc, mặc định mọi câu trả lời với `questionModel = null`.
   * @returns {Promise<{ attempted: number, skipped: number, result: ReturnType<OnThiExamEngine["readExamResult"]> }>}
   */
  async runFullAttempt({ maxQuestions = 60, wantCorrect = true, questionModels = new Map() } = {}) {
    let attempted = 0;
    let skipped = 0;
    while (attempted < maxQuestions) {
      if (this.isExamResultScreen(await this.bridge.hierarchy())) break;
      const questionModel = questionModels.get(attempted + 1) ?? null;
      const stepResult = await this.answerOrSkipCurrentQuestion(questionModel, { wantCorrect });
      if (!stepResult.supported) {
        throw new Error(`OnThiExamEngine.runFullAttempt: dừng ở câu thứ ${attempted + 1} - ${stepResult.reason}`);
      }
      attempted += 1;
      if (stepResult.skipped) skipped += 1;
      if (this.isExamResultScreen(stepResult.finalTree)) break;
    }
    if (attempted >= maxQuestions && !this.isExamResultScreen(await this.bridge.hierarchy())) {
      throw new Error(`OnThiExamEngine.runFullAttempt: chạm trần an toàn ${maxQuestions} câu mà chưa tới màn Kết quả - có thể đã kẹt vòng lặp.`);
    }
    const result = this.readExamResult(await this.bridge.hierarchy());
    return { attempted, skipped, result };
  }
}
