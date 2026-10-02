import { MaestroMcpSession } from "../bai_tap/discovery/maestroMcpSession.js";

/**
 * MaestroMcpBridge - CÙNG mặt giao diện public với `MaestroBridge` (runSteps/tap/input/swipe/wait/
 * isVisible/hierarchy/checkAnswer/nextQuestion/back/assertAnswerResult) NHƯNG dùng transport khác:
 * 1 tiến trình `maestro mcp` DUY NHẤT sống xuyên suốt (qua `MaestroMcpSession`, xem file đó) thay vì
 * `MaestroBridge` (mỗi `runSteps()`/`hierarchy()` tự spawn 1 tiến trình CLI `maestro test`/
 * `maestro hierarchy` riêng, ~40-60s khởi động driver MỖI LẦN - xem đo đạc thật trong
 * `maestroMcpSession.js`). Dùng cho testcase cần NHIỀU lượt tương tác liên tiếp (mỗi câu hỏi 1 lượt
 * tap+chờ+đọc hierarchy) mà không muốn trả giá khởi động driver lại từ đầu cho mỗi lượt.
 *
 * KHÁC 1 ĐIỂM SO VỚI MaestroBridge (bắt buộc do bản chất transport): `hierarchy()`/`isVisible()` ở
 * đây là ASYNC (trả Promise) - MaestroBridge cũ là sync (chạy `execCliSync` chặn luôn). Caller PHẢI
 * `await` khi gọi 2 method này qua bridge này (khác code dùng MaestroBridge có thể gọi sync). Đã xác
 * nhận đúng 1 call site thật cần sửa (`homeworkExamEngine.js#answerCurrentQuestionOneShot`,
 * `treeAfter = await this.bridge.hierarchy()`) - AN TOÀN với CẢ 2 bridge (await 1 giá trị sync
 * không phải Promise vẫn resolve đúng giá trị đó, chỉ thêm 1 microtask tick).
 *
 * KHÔNG có start()/stop() ở MaestroBridge (không cần, mỗi lệnh tự đóng tiến trình) - bridge NÀY
 * BẮT BUỘC gọi `await bridge.start()` trước khi dùng và `await bridge.stop()` khi xong (nên đặt
 * trong `finally`, xem cách dùng trong flows/giao_bai_tap/e2e-teacher-assign-partial-resume-scored.mjs).
 */
export class MaestroMcpBridge {
  /** @param {{ appId: string, deviceId?: string }} config */
  constructor({ appId, deviceId } = {}) {
    if (!appId) throw new Error("MaestroMcpBridge cần appId (xem automation/src/config.js).");
    this.appId = appId;
    this.session = new MaestroMcpSession({ deviceId });
    // Đếm riêng "run" (tương ứng 1 lượt `maestro test` cũ) và "hierarchy" (tương ứng 1 lượt
    // `maestro hierarchy` cũ) - để báo cáo hiệu năng đối chiếu với kiến trúc CLI-per-interaction cũ
    // mà KHÔNG cần đọc `session.toolCallCount` (gộp cả 2 loại + `list_devices` lúc start()).
    this.runCallCount = 0;
    this.hierarchyCallCount = 0;
    // PILOT (2026-10-02, migration Vui học sang Persistent Maestro Session - xem
    // automation/_scratch_perf_pilot_mcp.mjs): THUẦN TUÝ ĐO ĐẠC, KHÔNG đổi hành vi/return value của
    // bất kỳ method nào - cùng pattern `callLog`/`setPhase()` đã verify ở `maestroBridge.js` (CLI),
    // thêm vào ĐÂY để NavigationEngine/vuiHocExamRunner.js (gọi `bridge.setPhase?.()` sẵn, optional
    // chaining - không crash dù bridge không có method này) có thể tạo breakdown phase cho CẢ 2
    // bridge, so sánh được apples-to-apples. Nhãn `type` ghi "test"/"hierarchy" (KHÔNG phải "run")
    // để tái dùng NGUYÊN VẸN `summarizeByPhase()` của pilot script (đã viết cho shape callLog của
    // MaestroBridge) - "test" ở đây nghĩa là 1 lượt tool `run` MCP, tương đương 1 `maestro test` cũ.
    this.callLog = [];
    this.currentPhase = "unspecified";
  }

  /** Đặt nhãn giai đoạn cho các lượt tiếp theo - CÙNG method/semantics với `MaestroBridge.setPhase()`. */
  setPhase(label) {
    this.currentPhase = label;
  }

  _logCall(type, seconds, meta) {
    this.callLog.push({ phase: this.currentPhase, type, seconds, ts: Date.now(), ...meta });
  }

  // PILOT - COMPATIBILITY SHIM: `vuiHocExamRunner.js` đọc TRỰC TIẾP `bridge.testInvocationCount`/
  // `bridge.hierarchyInvocationCount` (tên thuộc tính của `MaestroBridge` CLI cũ) để tính
  // test/hierarchy invocation delta MỖI câu - PHÁT HIỆN qua audit TRƯỚC KHI sửa code (Phase 1):
  // KHÔNG alias thì 2 thuộc tính này là `undefined` ở bridge MCP, phép trừ `undefined - number` ra
  // `NaN`, hỏng số liệu per-question (KHÔNG hỏng logic trả lời - chỉ hỏng báo cáo) mà không throw
  // lỗi rõ ràng. Alias trỏ THẲNG vào `runCallCount`/`hierarchyCallCount` đã có sẵn - KHÔNG đếm
  // trùng, KHÔNG thêm state mới, giữ `vuiHocExamRunner.js` NGUYÊN VẸN không cần sửa.
  get testInvocationCount() {
    return this.runCallCount;
  }

  get hierarchyInvocationCount() {
    return this.hierarchyCallCount;
  }

  /** Khởi động tiến trình `maestro mcp` DUY NHẤT cho toàn bộ session - gọi 1 LẦN trước khi dùng. */
  async start() {
    await this.session.start();
    this.deviceId = this.session.deviceId;
  }

  /** Dừng tiến trình `maestro mcp` - gọi khi xong việc (nên đặt trong `finally`), KHÔNG để treo lại. */
  async stop() {
    await this.session.stop();
  }

  /**
   * Chạy 1 mảng bước Maestro NGUYÊN VẸN (native command, có thể gồm `runFlow: { when: ... }`,
   * `scrollUntilVisible`, `tapOn: { optional: true }`...) qua tool MCP "run" - CÙNG contract trả về
   * với `MaestroBridge.runSteps()` (`{success, error}`), khác transport (không spawn tiến trình mới).
   * @param {Array<Object|string>} steps
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async runSteps(steps) {
    this.runCallCount++;
    const startMs = Date.now();
    const result = await this.session.run(this.appId, steps);
    this._logCall("test", (Date.now() - startMs) / 1000, { stepCount: steps.length, success: result.success });
    return result;
  }

  /** @param {string|Object} selector */
  async tap(selector) {
    return this.runSteps([{ tapOn: selector }]);
  }

  /** @param {string} text */
  async input(text) {
    return this.runSteps([{ inputText: text }]);
  }

  /**
   * @param {string} start
   * @param {string} end
   */
  async swipe(start, end, { duration = 400 } = {}) {
    return this.runSteps([{ swipe: { start, end, duration } }]);
  }

  /** @param {string|Object} selector */
  async wait(selector, { timeout = 10000 } = {}) {
    const visible = typeof selector === "string" ? { text: selector } : selector;
    return this.runSteps([{ extendedWaitUntil: { visible, timeout } }]);
  }

  /**
   * Hỏi NGAY (không chờ) - so khớp FULL regex trên text hiển thị hiện tại, CÙNG ngữ nghĩa với
   * `MaestroBridge.isVisible()` - KHÁC 1 điểm: trả về Promise<boolean> (ASYNC), PHẢI `await`.
   * @param {string} textPattern
   * @returns {Promise<boolean>}
   */
  async isVisible(textPattern) {
    const tree = await this.hierarchy();
    const texts = this._collectTexts(tree, []);
    const pattern = new RegExp(`^${textPattern}$`);
    return texts.some((t) => pattern.test(t));
  }

  _collectTexts(node, acc) {
    const text = node?.attributes?.text;
    if (typeof text === "string" && text.trim()) acc.push(text.trim());
    for (const child of node?.children ?? []) this._collectTexts(child, acc);
    return acc;
  }

  /**
   * Trả về cây hierarchy thô hiện tại (CÙNG shape `{attributes:{...}, children:[...]}` của
   * `MaestroBridge.hierarchy()`) - qua tool MCP "inspect_screen" (rẻ, ~1.7-2.5s khi driver đã sống
   * sẵn trong session, xem đo đạc thật trong `maestroMcpSession.js`). KHÁC 1 điểm: ASYNC, PHẢI `await`.
   * @returns {Promise<Object>}
   */
  async hierarchy() {
    this.hierarchyCallCount++;
    const startMs = Date.now();
    const tree = await this.session.hierarchy();
    this._logCall("hierarchy", (Date.now() - startMs) / 1000, {});
    return tree;
  }

  /** Bấm nút nộp đáp án - chữ cố định, dùng chung cho MỌI dạng bài. */
  async checkAnswer() {
    return this.tap("Kiểm tra");
  }

  /** Bấm nút qua câu tiếp theo - chữ cố định, dùng chung cho MỌI dạng bài. */
  async nextQuestion() {
    return this.tap("Tiếp theo");
  }

  /** Lùi lại 1 màn hình - dùng cú pháp `back` chuẩn của Maestro. */
  async back() {
    return this.runSteps(["back"]);
  }

  /**
   * Poll xem app báo "Chính xác"/"Chưa chính xác" cho câu vừa nộp - CÙNG ngữ nghĩa với
   * `MaestroBridge.assertAnswerResult()`, khác 1 điểm: dùng `setTimeout` async (không có
   * `sleepSync` chặn event loop - session này cần event loop sống để đọc stdout tiến trình MCP).
   * @returns {Promise<"CORRECT"|"INCORRECT"|"UNKNOWN">}
   */
  async assertAnswerResult({ timeoutMs = 5000, pollMs = 300 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.isVisible("Chính xác.*")) return "CORRECT";
      if (await this.isVisible("Chưa chính xác.*")) return "INCORRECT";
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    return "UNKNOWN";
  }
}
