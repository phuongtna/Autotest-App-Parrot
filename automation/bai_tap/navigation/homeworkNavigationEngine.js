import { homeworkPageObjects as po } from "./homeworkPageObjects.js";
import { PendingExamLaunchError } from "../runtime/pendingExamLaunch.js";
import { findAssignment } from "../discovery/findAssignment.js";
import { centerPoint } from "../discovery/homeworkUiList.js";
import { isoToDueDateDM } from "../model/homeworkModel.js";

/**
 * HomeworkNavigationEngine - điều hướng tab "Bài tập" (Homework), tách riêng hoàn toàn khỏi
 * navigation/navigationEngine.js (Vui học): cây điều hướng khác hẳn (danh sách phẳng theo card,
 * không phải Book->Unit->Lesson->Exercise) và root tab khác ("Bài tập" thay vì "Vui học").
 *
 * PHẠM VI (2026-08-06, cập nhật sau khi verify `openAttemptDetail()` thật): implement điều hướng/
 * assertion cho List/FilterSheet/AttemptHistory (không cần Exam thật) VÀ màn Xem chi tiết 1 lần
 * làm ĐÃ NỘP (AttemptReview, xem homeworkPageObjects.js#reviewDetail) - màn này read-only, không
 * cần examId/endpoint mở đề nên không thuộc ranh giới Pending. CHỈ `startHomework()` (bắt đầu 1
 * lượt làm MỚI) còn throw PendingExamLaunchError - KHÔNG suy đoán examId, KHÔNG tự tạo endpoint/cơ
 * chế mở bài cho trường hợp đó.
 *
 * ĐÃ VERIFY THẬT trên thiết bị (BDB00056877, model "Aris", app com.inet.parrotedu, tài khoản học
 * sinh "Ngoc" lớp 3B, 2026-08-06): `openHomeworkTab()` (cả 2 chiều - đã ở sẵn tab VÀ chuyển thật
 * từ tab "Vui học" sang, không bị nhầm giữa tên tab và tiêu đề màn như lo ngại ban đầu),
 * `assertHomeworkCardVisible()`, `openFilterSheet()`/`selectFilterRange()`/`applyFilter()`,
 * `openAttemptHistory()`, và `bridge.back()` (quay từ AttemptHistory về List, không có dialog xác
 * nhận thoát). Toàn bộ text trong homeworkPageObjects.js khớp 100% với UI thật ở 3 màn này.
 *
 * ĐÃ VERIFY THẬT thêm `openAttemptDetail()` (2026-08-06, cùng thiết bị, homework "G3-U18-Lesson 1:
 * Listen and choose" lần làm "Đúng 2/5"): "Xem chi tiết" mở đúng màn Review (Câu 1..5, audio, đáp
 * án đã chọn); bấm "Tiếp theo" 4 lần đi hết Câu 2->5; ĐÚNG tại Câu 5/5 nút tự đổi text thành "Xem
 * xong" (không còn "Tiếp theo") - bấm vào quay sạch về AttemptHistory (danh sách "Lần N"), không
 * dialog xác nhận, không mất dữ liệu. Chưa verify trên lần làm có N khác 5 hay N=1.
 *
 * PHÁT HIỆN THẬT cần sửa so với bản viết từ ảnh Figma:
 * - `scrollUntilVisible` timeout mặc định 20000ms (như Vui học) KHÔNG đủ - card Bài tập cao hơn
 *   nhiều, đã đo thật cần tăng lên 45000 (xem chỗ dùng bên dưới).
 * - Có thêm 1 popup chung chưa từng biết ("Cập nhật phiên bản mới") - xem
 *   homeworkPageObjects.popups - đã thêm dismiss vào openHomeworkTab().
 * - AttemptHistory còn có field "Đúng X/Y" (số câu đúng) và "Thời gian nộp DD/MM" chưa khai báo
 *   trong page objects (không cần thiết cho assertion hiện tại, ghi chú lại để biết đã thấy).
 *
 * CHƯA VERIFY: trạng thái CTA "Tiếp tục" (chỉ thấy thật "Làm bài"/"Làm lại"/"Chinh phục" trên tài
 * khoản test này - không có Homework nào đang dở dang) - vẫn giữ nguyên trong page objects vì
 * suy ra hợp lý từ 3 trạng thái còn lại, nhưng CHƯA có bằng chứng thật.
 */
export class HomeworkNavigationEngine {
  /** @param {import("../bridge/maestroBridge.js").MaestroBridge} bridge */
  constructor(bridge) {
    this.bridge = bridge;
  }

  /** Trả về mảng bước dismiss popup chung (best-effort, không throw nếu không thấy). */
  _dismissKnownPopupsSteps() {
    return po.popups.map(({ trigger, action }) => ({
      runFlow: { when: { visible: trigger }, commands: [{ tapOn: action }] },
    }));
  }

  /**
   * Tìm ĐÚNG 1 card khớp (title, Hạn nộp DD/MM quy đổi từ deadline.endTime, cta nếu có) qua
   * `findAssignment()` (target-driven, KHÔNG phụ thuộc số lượng assignment - xem
   * discovery/findAssignment.js) - THAY THẾ hẳn `scrollUntilVisible` native trước đây (title-only,
   * đã CHỨNG MINH bị đánh lừa bởi card trùng title+Hạn nộp khi danh sách dài). Throw kèm
   * `diagnostics` đầy đủ (target/scroll count/last visible state/stop reason) nếu không FOUND.
   * @param {import("../model/homeworkModel.js").HomeworkModel} homework
   * @param {string} callerLabel - tên hàm gọi (cho message lỗi rõ nguồn).
   * @returns {Promise<Object>} card {title, titleBounds, dueDate, cta, ctaBounds}
   */
  async _locateAssignmentOrThrow(homework, callerLabel) {
    const dueDateDM = isoToDueDateDM(homework.deadline?.endTime);
    const located = await findAssignment(this.bridge, {
      title: homework.title,
      dueDateDM,
      cta: homework.cta,
    });
    if (located.status !== "FOUND") {
      throw new Error(
        `HomeworkNavigationEngine.${callerLabel}: không định vị được card "${homework.title}" ` +
          `(${located.status}${located.reason ? `/${located.reason}` : ""}).\n${located.diagnostics}`,
      );
    }
    return located.card;
  }

  /**
   * Mở tab "Bài tập" nếu chưa ở đó (idempotent - bỏ qua nếu section "Bài tập về nhà" đã hiển thị).
   * ĐÃ VERIFY THẬT (2026-08-06) cả 2 chiều: đã ở sẵn tab (bỏ qua tap) và chuyển thật từ tab
   * "Vui học" sang (tapOn theo text "Bài tập" KHÔNG bị nhầm sang tiêu đề màn dù trùng chữ - lúc
   * đang ở tab khác, "Bài tập" chỉ xuất hiện đúng 1 lần trên màn hình là tên tab).
   */
  async openHomeworkTab() {
    const steps = [
      {
        runFlow: {
          when: { notVisible: po.list.sectionRegular },
          commands: [
            { tapOn: { text: po.bottomTab.homeworkLabel } },
            { waitForAnimationToEnd: { timeout: 2000 } },
            ...this._dismissKnownPopupsSteps(),
          ],
        },
      },
      { waitForAnimationToEnd: { timeout: 2000 } },
      { assertVisible: { text: po.list.screenTitle } },
    ];
    const result = await this.bridge.runSteps(steps);
    if (!result.success) {
      throw new Error(`HomeworkNavigationEngine: không mở được tab "Bài tập": ${result.error}`);
    }
  }

  /**
   * Scroll tới đúng card theo title (đọc từ HomeworkModel.title, KHÔNG hardcode) rồi assert
   * hiển thị - CHỈ xác nhận, KHÔNG tap vào CTA (tapOn CTA = "Start Homework", thuộc phạm vi
   * Pending, xem startHomework() bên dưới).
   * @param {import("../model/homeworkModel.js").HomeworkModel} homework
   */
  async assertHomeworkCardVisible(homework) {
    if (!homework?.title) {
      throw new Error("assertHomeworkCardVisible() cần homework.title (từ HomeworkModel).");
    }
    // ĐÃ ĐỔI (2026-08-19) từ `scrollUntilVisible` native (title-only, timeout tăng dần 20000 ->
    // 45000 qua nhiều lần "fix" không chạm root cause) sang `findAssignment()` (target-driven,
    // identity title+Hạn nộp, không phụ thuộc số lượng assignment) - xem docblock
    // discovery/findAssignment.js để biết lý do đầy đủ.
    await this._locateAssignmentOrThrow(homework, "assertHomeworkCardVisible");
  }

  /** Mở bottom sheet lọc theo khoảng thời gian ("Xem bài tập theo"). */
  async openFilterSheet() {
    const steps = [
      { tapOn: { text: po.list.filterHeaderPattern } },
      { assertVisible: { text: po.filterSheet.title } },
    ];
    const result = await this.bridge.runSteps(steps);
    if (!result.success) {
      throw new Error(`HomeworkNavigationEngine: không mở được Filter Sheet: ${result.error}`);
    }
  }

  /**
   * Chọn 1 lựa chọn trong Filter Sheet - `rangeLabel` do caller truyền vào (vd
   * `homeworkPageObjects.filterSheet.optionTwoWeeks`), engine không tự hardcode giá trị nào.
   * @param {string} rangeLabel
   */
  async selectFilterRange(rangeLabel) {
    await this.bridge.tap(rangeLabel);
  }

  /** Bấm "Xem" để áp dụng lựa chọn filter, quay lại màn danh sách. */
  async applyFilter() {
    await this.bridge.tap(po.filterSheet.applyButton);
    const result = await this.bridge.wait({ text: po.list.screenTitle }, { timeout: 5000 });
    if (!result.success) {
      throw new Error(`HomeworkNavigationEngine: áp dụng filter xong nhưng không thấy lại màn danh sách: ${result.error}`);
    }
  }

  /**
   * Mở "Xem bài đã làm" cho 1 Homework - CHỈ dẫn tới màn liệt kê lịch sử (điểm/thời gian từng
   * lần làm), KHÔNG hiển thị nội dung câu hỏi nên coi là NGOÀI phạm vi "Open Exam". Không tự
   * quyết định homework nào "đã hoàn thành" (cần biết userId của profile đang đăng nhập trên
   * thiết bị - CHƯA có cách xác nhận field này, xem automation/README.md) - caller tự chọn
   * homework nào để gọi hàm này.
   * @param {import("../model/homeworkModel.js").HomeworkModel} homework
   */
  async openAttemptHistory(homework) {
    if (!homework?.title) {
      throw new Error("openAttemptHistory() cần homework.title (từ HomeworkModel).");
    }
    // ĐÃ ĐỔI (2026-08-19): findAssignment() thay native scrollUntilVisible (cùng lý do
    // assertHomeworkCardVisible()) - card.dueDate (text THẬT của đúng card đã tìm, không phải suy
    // đoán) dùng làm lồng "below" cấp 2 để tránh khớp nhầm "Xem bài đã làm" của 1 card trùng title
    // khác đang cùng hiển thị trong viewport (đúng idiom đã verify trong flows/helpers/
    // open-exercise.yaml, đoạn tapOn CTA lồng 2 cấp title->Hạn nộp).
    const card = await this._locateAssignmentOrThrow(homework, "openAttemptHistory");
    const belowSelector = card.dueDate
      ? { text: card.dueDate, below: { text: homework.title } }
      : { text: homework.title };
    const steps = [
      { tapOn: { text: po.list.viewCompletedLink, below: belowSelector } },
      { waitForAnimationToEnd: { timeout: 2000 } },
      { assertVisible: { text: homework.title } },
    ];
    const result = await this.bridge.runSteps(steps);
    if (!result.success) {
      throw new Error(
        `HomeworkNavigationEngine: không mở được "Xem bài đã làm" cho "${homework.title}": ${result.error}`,
      );
    }
  }

  /**
   * Biến thể GỘP của openHomeworkTab()+openFilterSheet()+selectFilterRange()+applyFilter() - CÙNG
   * chuỗi selector/hành vi 4 hàm gốc (KHÔNG đổi), chỉ gộp vào ĐÚNG 1 lượt `maestro test` DUY NHẤT
   * thay vì 4 lượt riêng (mỗi hàm gốc tự spawn 1 tiến trình `maestro test`, ~30-50s khởi động
   * session/lượt - xem đo đạc thật 2026-08-07 dẫn ở homeworkExamEngine.js#answerCurrentQuestionOneShot()).
   * @param {string} rangeLabel - vd `homeworkPageObjects.filterSheet.optionOneMonth`
   */
  async openHomeworkTabWithFilterOneShot(rangeLabel) {
    const steps = [
      {
        runFlow: {
          when: { notVisible: po.list.sectionRegular },
          commands: [
            { tapOn: { text: po.bottomTab.homeworkLabel } },
            { waitForAnimationToEnd: { timeout: 2000 } },
            ...this._dismissKnownPopupsSteps(),
          ],
        },
      },
      { waitForAnimationToEnd: { timeout: 2000 } },
      { assertVisible: { text: po.list.screenTitle } },
      { tapOn: { text: po.list.filterHeaderPattern } },
      { assertVisible: { text: po.filterSheet.title } },
      { tapOn: rangeLabel },
      { tapOn: po.filterSheet.applyButton },
      { extendedWaitUntil: { visible: { text: po.list.screenTitle }, timeout: 5000 } },
    ];
    const result = await this.bridge.runSteps(steps);
    if (!result.success) {
      throw new Error(`HomeworkNavigationEngine: không mở được tab "Bài tập" + áp filter (gộp 1 lượt): ${result.error}`);
    }
  }

  /**
   * Biến thể GỘP của assertHomeworkCardVisible()+tapOn CTA (mở bài)+verifyIdentity() (hàm sau
   * thuộc HomeworkExamEngine) - CÙNG chuỗi selector/hành vi các hàm gốc, chỉ gộp vào ĐÚNG 1 lượt
   * `maestro test` DUY NHẤT (thay vì ~5 lượt riêng: assert card, screenshot target, tap CTA/chờ/
   * dismiss AI popup, verifyIdentity, screenshot exam screen).
   * @param {import("../model/homeworkModel.js").HomeworkModel} homework
   * @param {{ targetScreenshot?: string, examScreenshot?: string }} [options]
   */
  async openHomeworkAndVerifyIdentityOneShot(homework, { targetScreenshot, examScreenshot } = {}) {
    if (!homework?.title || !homework?.cta) {
      throw new Error("openHomeworkAndVerifyIdentityOneShot() cần homework.title + homework.cta.");
    }
    // ĐÃ ĐỔI (2026-08-19): findAssignment() thay native scrollUntilVisible - card trả về đã đứng
    // yên đúng vị trí (không cuộn thêm bước nào), + tap CTA bằng TOẠ ĐỘ thật (`ctaBounds`) thay vì
    // selector `below` (nguồn lỗi tap-nhầm-card-trùng-lặp đã ghi nhận, xem findAssignment.js) - vẫn
    // gộp phần còn lại (tap + AI consent + verify) vào ĐÚNG 1 lượt `runSteps()` như tên hàm
    // "OneShot" yêu cầu.
    const card = await this._locateAssignmentOrThrow(homework, "openHomeworkAndVerifyIdentityOneShot");
    const tapCtaStep = card.ctaBounds
      ? (() => {
          const point = centerPoint(card.ctaBounds);
          return { tapOn: { point: `${point.x},${point.y}` } };
        })()
      : { tapOn: { below: homework.title, text: homework.cta } };

    const steps = [];
    if (targetScreenshot) steps.push({ takeScreenshot: targetScreenshot });
    steps.push(
      tapCtaStep,
      { waitForAnimationToEnd: { timeout: 3000 } },
      { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
      { extendedWaitUntil: { visible: { text: homework.title }, timeout: 10000 } },
      { assertNotVisible: { text: "Trò chuyện" } },
      { assertNotVisible: { text: "Bài tập về nhà" } },
    );
    if (examScreenshot) steps.push({ takeScreenshot: examScreenshot });

    const result = await this.bridge.runSteps(steps);
    if (!result.success) {
      throw new Error(
        `HomeworkNavigationEngine: không mở được bài + xác nhận identity cho "${homework.title}" (gộp 1 lượt): ${result.error}`,
      );
    }
  }

  /**
   * CỐ TÌNH CHƯA IMPLEMENT - tapOn CTA ("Làm bài"/"Tiếp tục"/"Chinh phục"/"Làm lại") = bắt đầu
   * hoặc tiếp tục 1 lượt làm bài thật, cần biết cách app mở đúng Exam - xem
   * runtime/pendingExamLaunch.js.
   * @param {import("../model/homeworkModel.js").HomeworkModel} homework
   */
  async startHomework(homework) {
    throw new PendingExamLaunchError({
      homeworkId: homework?.id,
      title: homework?.title,
      step: "startHomework",
    });
  }

  /**
   * Mở "Xem chi tiết" cho lần làm ĐẦU TIÊN khớp trên màn AttemptHistory (caller gọi
   * openAttemptHistory() trước) rồi tự bấm "Tiếp theo" qua hết Câu 1..N (chưa biết trước N) tới
   * khi nút đổi thành "Xem xong" (đúng tại câu cuối) thì bấm để quay lại AttemptHistory - ĐÃ
   * VERIFY THẬT trên thiết bị (2026-08-06, xem homeworkPageObjects.js#reviewDetail). Đây là màn
   * xem lại lần đã NỘP (read-only, không cần examId/endpoint mở đề) nên KHÔNG thuộc ranh giới
   * PendingExamLaunchError như startHomework() (mở lượt làm MỚI) - khác hẳn dù cùng hiển thị nội
   * dung câu hỏi.
   * @param {import("../model/homeworkModel.js").HomeworkModel} homework
   */
  async openAttemptDetail(homework) {
    if (!homework?.title) {
      throw new Error("openAttemptDetail() cần homework.title (từ HomeworkModel).");
    }
    let result = await this.bridge.tap(po.attemptHistory.detailButton);
    if (!result.success) {
      throw new Error(
        `HomeworkNavigationEngine: không mở được "Xem chi tiết" cho "${homework.title}": ${result.error}`,
      );
    }

    // Chưa biết trước số câu N của lần làm này - dừng khi thấy "Xem xong" (luôn xuất hiện đúng
    // tại câu cuối, thay cho "Tiếp theo"), có mốc an toàn để không loop vô hạn nếu UI khác dự kiến.
    const MAX_QUESTIONS = 30;
    for (let i = 0; i < MAX_QUESTIONS; i++) {
      if (this.bridge.isVisible(po.reviewDetail.doneButton)) {
        result = await this.bridge.tap(po.reviewDetail.doneButton);
        if (!result.success) {
          throw new Error(`HomeworkNavigationEngine: bấm "Xem xong" thất bại: ${result.error}`);
        }
        return;
      }
      result = await this.bridge.tap(po.reviewDetail.nextButton);
      if (!result.success) {
        throw new Error(
          `HomeworkNavigationEngine: bấm "Tiếp theo" thất bại ở câu ${i + 1} trong màn Xem chi tiết: ${result.error}`,
        );
      }
    }
    throw new Error(
      `HomeworkNavigationEngine: vượt quá ${MAX_QUESTIONS} câu trong màn Xem chi tiết mà chưa thấy "Xem xong" - kiểm tra lại UI/loop.`,
    );
  }
}
