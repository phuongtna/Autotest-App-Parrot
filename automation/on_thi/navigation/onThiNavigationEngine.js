import { onThiPageObjects as po } from "./onThiPageObjects.js";
import { findDeThi, scrollToTop, tapFoundDeCard } from "../discovery/findDeThi.js";
import { isoToDueDateDM } from "../model/onThiModel.js";

/**
 * OnThiNavigationEngine - điều hướng tab "Ôn thi" > "Đề thầy cô giao", CÙNG HÌNH DÁNG với
 * automation/bai_tap/navigation/homeworkNavigationEngine.js (danh sách phẳng theo card, có Filter
 * Sheet 2 lựa chọn, có "Xem bài đã làm" dẫn tới lịch sử) - theo đúng nhận định của BA/spec.json:
 * "Gồm đề cơ bản và đề nâng cao, thể hiện giống module Bài tập". TÁI SỬ DỤNG trực tiếp
 * `findDeThi()`/`scrollToTop()` (automation/on_thi/discovery/findDeThi.js, bản thân 2 hàm đó đã tái
 * sử dụng `runSearchStateMachine()` + `normalizeDueDateDM()` của module Bài tập) thay vì tự chế lại
 * cơ chế scroll/locate riêng - đúng yêu cầu tái dùng tối đa phần code đã có.
 *
 * CHƯA VERIFY TRÊN THIẾT BỊ THẬT - toàn bộ các hàm bên dưới viết theo ĐÚNG hành vi/thứ tự thao tác
 * đã verify thật ở HomeworkNavigationEngine (cùng tác giả, cùng kiến trúc app), nhưng chưa có lượt
 * chạy thật nào trên chính màn "Ôn thi" để xác nhận lại. Chạy xong 1 lượt thật, cập nhật docblock
 * này theo đúng quy ước "ĐÃ VERIFY THẬT (ngày, thiết bị, tài khoản): ..." như các file khác trong
 * repo, KHÔNG tự ý xoá cảnh báo "CHƯA VERIFY" tới khi đó.
 *
 * PHẠM VI: implement List/FilterSheet/mở "Xem bài đã làm" (điều hướng, không cần biết examId) -
 * việc TAP CTA mở đề MỚI ("Làm bài"/"Làm tiếp") tái sử dụng `flows/app/helpers/open-de.yaml` (Maestro
 * thuần, theo đúng cách module Bài tập đã làm thật qua `open-exercise.yaml` - KHÔNG qua class JS này,
 * vì màn "làm đề" dùng chung engine câu hỏi `exercise/doing.tsx` đã có sẵn helper YAML, không cần
 * bọc thêm 1 lớp JS mới).
 */
export class OnThiNavigationEngine {
  /** @param {import("../../bai_tap/bridge/maestroBridge.js").MaestroBridge} bridge */
  constructor(bridge) {
    this.bridge = bridge;
  }

  _dismissKnownPopupsSteps() {
    return po.popups.map(({ trigger, action }) => ({
      runFlow: { when: { visible: trigger }, commands: [{ tapOn: action }] },
    }));
  }

  /**
   * Tìm ĐÚNG 1 card đề khớp (title, Hạn nộp DD/MM, cta nếu có) qua `findDeThi()` - CÙNG lý do/kỹ
   * thuật đã verify đúng ở HomeworkNavigationEngine._locateAssignmentOrThrow() (xem docblock file
   * đó): KHÔNG dùng `scrollUntilVisible` title-only vì danh sách có thể có nhiều đề trùng title+hạn
   * nộp (đề giao lại nhiều lần).
   * @param {{title:string, deadlineEndTimeIso?:string, cta?:string}} de
   * @param {string} callerLabel
   */
  async _locateDeOrThrow(de, callerLabel) {
    const dueDateDM = de.deadlineEndTimeIso ? isoToDueDateDM(de.deadlineEndTimeIso) : de.dueDateDM ?? null;
    const located = await findDeThi(this.bridge, { title: de.title, dueDateDM, cta: de.cta });
    if (located.status !== "FOUND") {
      throw new Error(
        `OnThiNavigationEngine.${callerLabel}: không định vị được đề "${de.title}" ` +
          `(${located.status}${located.reason ? `/${located.reason}` : ""}).\n${located.diagnostics}`,
      );
    }
    return located.card;
  }

  /**
   * Mở tab "Ôn thi" > 1 trong 2 sub-tab (idempotent - bỏ qua nếu đã ở đó). ĐÃ XÁC NHẬN THẬT
   * (2026-10-30, thao tác tay qua `adb shell input tap` + screenshot, thiết bị 3201d866d40a1681):
   * "Ôn thi" đúng là tên tab điều hướng được trực tiếp bằng text, và 2 nhãn sub-tab
   * ("Đề thầy cô giao"/"Kho đề Parrot") đều tap được - xoá cảnh báo "CHƯA VERIFY tên tab gốc"
   * trước đây (xem `onThiPageObjects.js`). CHƯA chạy qua chính đoạn code Maestro này (chưa gọi qua
   * MaestroBridge thật) - chỉ xác nhận hành vi UI/text thật, không xác nhận cú pháp `runFlow`/
   * `tapOn` bên dưới.
   * @param {string} subTabLabel - `po.list.subTabAssignedByTeacher` hoặc `po.list.subTabParrotBank`.
   */
  async _openSubTab(subTabLabel) {
    const steps = [
      {
        runFlow: {
          when: { notVisible: po.list.subTabAssignedByTeacher },
          commands: [
            { tapOn: { text: po.bottomTab.onThiLabel } },
            { waitForAnimationToEnd: { timeout: 2000 } },
            ...this._dismissKnownPopupsSteps(),
          ],
        },
      },
      { waitForAnimationToEnd: { timeout: 2000 } },
      { assertVisible: { text: po.screenTitleSelector ?? po.list.screenTitle } },
      // Tap vào ĐÚNG label sub-tab mong muốn - an toàn kể cả khi đã đang chọn sẵn (idempotent,
      // giống cách openHomeworkTab() tap lại label tab dù có thể đã ở đó).
      { tapOn: { text: subTabLabel } },
      { waitForAnimationToEnd: { timeout: 1500 } },
    ];
    const result = await this.bridge.runSteps(steps);
    if (!result.success) {
      throw new Error(`OnThiNavigationEngine: không mở được tab "Ôn thi > ${subTabLabel}": ${result.error}`);
    }
  }

  /** Mở tab "Ôn thi" > sub-tab "Đề thầy cô giao". */
  async openDeThayCoGiaoTab() {
    return this._openSubTab(po.list.subTabAssignedByTeacher);
  }

  /** Mở tab "Ôn thi" > sub-tab "Kho đề Parrot" - THÊM MỚI 2026-10-30 (cùng đợt viết
   * `onThiExamEngine.js`, phục vụ yêu cầu "chạy cả 2 tab" - trước đây module chỉ có
   * `openDeThayCoGiaoTab()`). CÙNG mức độ verify với tab kia (xem docblock `_openSubTab()`). */
  async openKhoDeParrotTab() {
    return this._openSubTab(po.list.subTabParrotBank);
  }

  /** Mở bottom sheet lọc theo khoảng thời gian giao đề. */
  async openFilterSheet() {
    const steps = [
      { tapOn: { text: po.list.filterHeaderPattern } },
      { assertVisible: { text: po.filterSheet.title } },
    ];
    const result = await this.bridge.runSteps(steps);
    if (!result.success) {
      throw new Error(`OnThiNavigationEngine: không mở được Filter Sheet: ${result.error}`);
    }
  }

  /** @param {string} rangeLabel - vd `onThiPageObjects.filterSheet.optionOneMonth` */
  async selectFilterRange(rangeLabel) {
    await this.bridge.tap(rangeLabel);
  }

  async applyFilter() {
    await this.bridge.tap(po.filterSheet.applyButton);
    const result = await this.bridge.wait({ text: po.list.filterHeaderPattern }, { timeout: 5000 });
    if (!result.success) {
      throw new Error(`OnThiNavigationEngine: áp dụng filter xong nhưng không thấy lại nhãn filter: ${result.error}`);
    }
  }

  /** Biến thể gộp mở tab + áp filter trong 1 lượt `maestro test` - cùng lý do tối ưu như
   *  `HomeworkNavigationEngine.openHomeworkTabWithFilterOneShot()`. */
  async openDeThayCoGiaoTabWithFilterOneShot(rangeLabel) {
    const steps = [
      {
        runFlow: {
          when: { notVisible: po.list.subTabAssignedByTeacher },
          commands: [
            { tapOn: { text: po.bottomTab.onThiLabel } },
            { waitForAnimationToEnd: { timeout: 2000 } },
            ...this._dismissKnownPopupsSteps(),
            { tapOn: { text: po.list.subTabAssignedByTeacher } },
            { waitForAnimationToEnd: { timeout: 1500 } },
          ],
        },
      },
      { tapOn: { text: po.list.filterHeaderPattern } },
      { assertVisible: { text: po.filterSheet.title } },
      { tapOn: rangeLabel },
      { tapOn: po.filterSheet.applyButton },
      { extendedWaitUntil: { visible: { text: po.list.filterHeaderPattern }, timeout: 5000 } },
    ];
    const result = await this.bridge.runSteps(steps);
    if (!result.success) {
      throw new Error(`OnThiNavigationEngine: không mở được tab + áp filter (gộp 1 lượt): ${result.error}`);
    }
  }

  /**
   * Scroll tới đúng card theo title rồi assert hiển thị - KHÔNG tap CTA (mở đề thật dùng
   * `flows/app/helpers/open-de.yaml`, xem docblock đầu file).
   * @param {{title:string, dueDateDM?:string, cta?:string}} de
   */
  async assertDeCardVisible(de) {
    if (!de?.title) throw new Error("assertDeCardVisible() cần de.title.");
    await this._locateDeOrThrow(de, "assertDeCardVisible");
  }

  /**
   * Mở "Xem bài đã làm" cho 1 đề đã nộp - CÙNG kỹ thuật `below` lồng 2 cấp đã verify đúng ở
   * `HomeworkNavigationEngine.openAttemptHistory()` (title -> anchor thật của card -> link).
   * @param {{title:string, dueDateDM?:string}} de
   */
  async openAttemptHistory(de) {
    if (!de?.title) throw new Error("openAttemptHistory() cần de.title.");
    const card = await this._locateDeOrThrow(de, "openAttemptHistory");
    const belowSelector = card.score
      ? { text: card.score, below: { text: de.title } }
      : { text: de.title };
    const steps = [
      { tapOn: { text: po.list.viewCompletedLink, below: belowSelector } },
      { waitForAnimationToEnd: { timeout: 2000 } },
      { assertVisible: { text: de.title } },
    ];
    const result = await this.bridge.runSteps(steps);
    if (!result.success) {
      throw new Error(`OnThiNavigationEngine: không mở được "Xem bài đã làm" cho "${de.title}": ${result.error}`);
    }
  }

  /**
   * Mở đề + tap CTA bằng toạ độ thật (`tapFoundDeCard`, né lỗi tap-nhầm-card-trùng-lặp) - dừng lại
   * NGAY SAU khi tap CTA (không tự verify màn làm bài ở đây, caller dùng tiếp
   * `flows/app/helpers/answer-current-exercise-generic.yaml`/`answer-and-wait-result.yaml` như module
   * Bài tập đã làm, không bọc lại logic đó trong JS).
   * @param {{title:string, dueDateDM?:string, cta:string}} de
   */
  async tapDeCta(de) {
    if (!de?.title || !de?.cta) throw new Error("tapDeCta() cần de.title + de.cta.");
    const card = await this._locateDeOrThrow(de, "tapDeCta");
    const result = await tapFoundDeCard(this.bridge, card);
    if (!result.success) {
      throw new Error(`OnThiNavigationEngine: tap CTA "${de.cta}" của đề "${de.title}" thất bại: ${result.error}`);
    }
  }

  /** Re-export tiện lợi - caller gọi `engine.scrollToTop()` thay vì import riêng. */
  async scrollToTop(options) {
    return scrollToTop(this.bridge, options);
  }
}
