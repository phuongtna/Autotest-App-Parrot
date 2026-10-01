import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { dump } from "js-yaml";
import { execCliSync, sleepSync } from "../src/execCli.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_TMP_DIR = join(__dirname, "..", "output", ".tmp");

let callCounter = 0;

/**
 * MaestroBridge - lớp trung gian DUY NHẤT giữa Runtime/NavigationEngine/Handler và Maestro.
 * CHỈ cung cấp thao tác chung (tap/input/swipe/wait/isVisible/checkAnswer/nextQuestion) - KHÔNG
 * gọi CMS, KHÔNG biết Book/Unit/Lesson/Exercise/QuestionType là gì, KHÔNG chứa business logic
 * (rẽ nhánh theo tên Book/Unit, chọn đáp án theo QuestionType... là việc của NavigationEngine/
 * Handler, không phải ở đây).
 *
 * Mỗi thao tác (trừ isVisible) chạy 1 lượt `maestro test` RIÊNG (không tích lũy bước rồi chạy
 * gộp) - đơn giản, đúng nghĩa "cung cấp thao tác" theo yêu cầu kiến trúc, đổi lại chậm hơn 1
 * file Maestro gộp nhiều bước (mỗi lượt tốn thêm chi phí khởi động `maestro test`). Đã xác nhận
 * thật (cùng kỹ thuật dùng trước đây ở discovery/unitStatusProbe.js, nay đã xoá): nhiều lượt
 * `maestro test` RIÊNG BIỆT gọi liên tiếp KHÔNG làm mất trạng thái app (Maestro không tự
 * launchApp/clearState nếu flow không có bước đó) - nên tách rời từng thao tác vẫn hoạt động
 * đúng trên app thật.
 *
 * isVisible() KHÔNG chạy `maestro test` - chỉ đọc `maestro hierarchy` (nhanh hơn nhiều, không
 * tốn chi phí khởi động test runner) để trả lời NGAY true/false, dùng cho rẽ nhánh
 * (NavigationEngine/Handler tự quyết định làm gì tiếp theo) - cố tình KHÔNG dùng lệnh
 * `assertVisible` thật của Maestro vì lệnh đó THẤT BẠI sẽ làm dừng cả flow, không phù hợp để
 * hỏi "có thấy X không" rồi tự quyết định nhánh tiếp theo.
 */
export class MaestroBridge {
  /**
   * @param {{ appId: string, deviceId?: string }} config
   */
  constructor({ appId, deviceId } = {}) {
    if (!appId) throw new Error("MaestroBridge cần appId (xem automation/src/config.js).");
    this.appId = appId;
    this.deviceId = deviceId;
    // Đếm số lượt `maestro test` THẬT đã spawn qua instance này (mỗi `_runFlow()` = 1 tiến trình
    // `maestro test` riêng, tốn ~30-50s khởi động session - xem đo đạc thật 2026-08-07 ở
    // flows/bai_tap/testcases/homework-review-explanation.yaml). KHÔNG tính `maestro hierarchy`
    // (`_dumpHierarchy()`/`isVisible()`/`hierarchy()`) - lệnh đó rẻ, không khởi động session.
    // Dùng để báo cáo hiệu năng testcase (vd runtime/homeworkRandomScoringE2EOneSession.js).
    this.testInvocationCount = 0;
    // Đếm số lượt `maestro hierarchy` THẬT đã spawn (2026-09-10, thêm cho benchmark
    // automation/vui_hoc/runVuiHocExercise.mjs - đo THẬT cho thấy lệnh này KHÔNG hề rẻ như comment
    // cũ ở trên giả định, cùng bậc chi phí khởi động với `maestro test`, xem PERF audit trong
    // automation/bai_tap/navigation/homeworkExamEngine.js) - THUẦN TUÝ thêm 1 counter, không đổi
    // hành vi/kết quả trả về của bất kỳ method nào.
    this.hierarchyInvocationCount = 0;
    // PERF PROFILING (2026-10-01, thuần đo đạc - KHÔNG đổi hành vi/return value của bất kỳ method
    // nào): ghi lại mốc thời gian THẬT của MỖI lượt `maestro test`/`maestro hierarchy` kèm nhãn
    // "phase" do caller tự đặt qua `setPhase()` (NavigationEngine/vuiHocExamRunner gọi trước mỗi
    // đoạn lớn) - dùng để tổng hợp báo cáo breakdown theo giai đoạn (Navigation/Content opening/
    // Question execution/Submit-result) mà KHÔNG cần sửa logic nơi khác.
    this.callLog = [];
    this.currentPhase = "unspecified";
  }

  /** Đặt nhãn giai đoạn cho các lượt `runSteps()`/`hierarchy()`/`tap()` TIẾP THEO (chỉ gắn nhãn
   * cho mục đích đo đạc - KHÔNG ảnh hưởng hành vi). */
  setPhase(label) {
    this.currentPhase = label;
  }

  _logCall(type, seconds, meta) {
    this.callLog.push({ phase: this.currentPhase, type, seconds, ts: Date.now(), ...meta });
  }

  _deviceArgs() {
    return this.deviceId ? ["--device", this.deviceId] : [];
  }

  /**
   * @param {Array<Object|string>} steps - mảng Maestro command (plain object hoặc string, vd
   *   "back") - serialize bằng js-yaml giống automation/bridge/flowGenerator.js.
   * @returns {{ success: boolean, error?: string }}
   */
  /**
   * PERF FIX (2026-10-01, đo THẬT trên thiết bị 3201d866d40a1681 - xem PERF PROFILE REPORT phiên
   * tối ưu Self-Learning): mặc định `maestro test`/`maestro hierarchy` TỰ REINSTALL driver+server
   * app trên thiết bị TRƯỚC MỖI lượt gọi (hành vi mặc định của chính Maestro CLI, không phải code
   * của project) - đo trực tiếp (3 lượt `maestro hierarchy` KHÔNG qua code này, hoàn toàn cô lập)
   * cho kết quả ~48-58s/lượt dù KHÔNG thao tác gì với app; thêm cờ `--no-reinstall-driver` (CLI
   * flag CÓ SẴN của Maestro, không phải tự chế) giảm còn ~9-14s/lượt (ỔN ĐỊNH qua 4 lượt liên
   * tiếp) - ĐÚNG NGUYÊN NHÂN khiến 1 lượt chạy E2E thật (51 lượt gọi) tốn 3275s (51 × ~64s ≈
   * 3268s, khớp gần như tuyệt đối) dù KHÔNG hề có retry nào (totalRetryAttempts=0) và mọi
   * waitForAnimationToEnd đều bounded dưới 4s - ĐÂY LÀ BOTTLENECK DUY NHẤT CHIẾM ~100% RUNTIME,
   * không phải logic điều hướng/trả lời câu hỏi.
   *
   * RỦI RO đã cân nhắc: bỏ qua reinstall giả định driver/server app đã cài đúng + còn sống trên
   * thiết bị - đúng với mọi phiên làm việc thật trong repo này (device dùng liên tục nhiều giờ,
   * hàng chục/hàng trăm lượt gọi liên tiếp không có sự cố) nhưng về lý thuyết driver có thể crash
   * giữa 1 phiên dài. TỰ HỒI PHỤC (KHÔNG đổi hành vi bên ngoài - vẫn trả `{success,error}`/throw
   * như cũ nếu thật sự fail cả 2 lượt): nếu lượt gọi KHÔNG reinstall thất bại, retry ĐÚNG 1 lần CÓ
   * reinstall (buộc sửa driver nếu đó là nguyên nhân) trước khi kết luận fail thật.
   */
  _execMaestro(args) {
    try {
      return execCliSync("maestro", [...args, "--no-reinstall-driver"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    } catch (err) {
      try {
        return execCliSync("maestro", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
      } catch {
        throw err; // Báo lỗi gốc (lượt nhanh) - lượt reinstall chỉ để tự hồi phục, không che lỗi thật.
      }
    }
  }

  _runFlow(steps) {
    this.testInvocationCount++;
    const startMs = Date.now();
    mkdirSync(OUTPUT_TMP_DIR, { recursive: true });
    const flowPath = join(OUTPUT_TMP_DIR, `bridge_step_${++callCounter}.yaml`);
    const yaml = `appId: \${APP_ID}\n---\n${dump(steps, { lineWidth: -1 })}`;
    writeFileSync(flowPath, yaml, "utf8");
    try {
      const args = [...this._deviceArgs(), "test", flowPath, "-e", `APP_ID=${this.appId}`];
      this._execMaestro(args);
      this._logCall("test", (Date.now() - startMs) / 1000, { stepCount: steps.length, success: true });
      return { success: true };
    } catch (err) {
      this._logCall("test", (Date.now() - startMs) / 1000, { stepCount: steps.length, success: false });
      return { success: false, error: err.message };
    } finally {
      rmSync(flowPath, { force: true });
    }
  }

  _dumpHierarchy() {
    this.hierarchyInvocationCount++;
    const startMs = Date.now();
    const args = [...this._deviceArgs(), "hierarchy"];
    const raw = this._execMaestro(args);
    this._logCall("hierarchy", (Date.now() - startMs) / 1000, {});
    return JSON.parse(raw);
  }

  _collectTexts(node, acc) {
    const text = node?.attributes?.text;
    if (typeof text === "string" && text.trim()) acc.push(text.trim());
    for (const child of node?.children ?? []) this._collectTexts(child, acc);
    return acc;
  }

  /**
   * Chạy 1 mảng bước Maestro NGUYÊN VẸN (native command, có thể gồm `runFlow: { when: ... }`,
   * `scrollUntilVisible`, `tapOn: { optional: true }`...) trong ĐÚNG 1 lượt `maestro test` DUY
   * NHẤT - dùng cho NavigationEngine khi cần gộp nhiều bước liên tiếp (rẽ nhánh/scroll) thành 1
   * flow thay vì gọi tap/wait/isVisible rời rạc (mỗi lượt tốn thêm 1 lần khởi động `maestro
   * test`/`maestro hierarchy` - xem ghi chú đo thời gian thật trong navigationEngine.js). Bridge
   * không diễn giải nội dung `steps` - chỉ dump YAML rồi chạy, giống `_runFlow` nội bộ.
   * @param {Array<Object|string>} steps
   */
  async runSteps(steps) {
    return this._runFlow(steps);
  }

  /**
   * Bấm vào 1 phần tử. `selector` là string (khớp text, giống `tapOn: "..."` của Maestro) hoặc
   * object selector đầy đủ của Maestro (vd `{ below: "...", text: "..." }`, `{ leftOf: "..." }`,
   * `{ point: "x,y" }`) - truyền thẳng cho Maestro tự phân giải (đã dùng thật trong các flow
   * flows/vui_hoc/*.yaml hiện có), Bridge không tự diễn giải ý nghĩa selector.
   * @param {string|Object} selector
   */
  async tap(selector) {
    return this._runFlow([{ tapOn: selector }]);
  }

  /** @param {string} text */
  async input(text) {
    return this._runFlow([{ inputText: text }]);
  }

  /**
   * @param {string} start - vd "50%,80%" hoặc "540,1800"
   * @param {string} end
   */
  async swipe(start, end, { duration = 400 } = {}) {
    return this._runFlow([{ swipe: { start, end, duration } }]);
  }

  /**
   * Chờ tới khi thấy `selector` hoặc hết `timeout` (dùng khi ĐANG chờ 1 màn hình chuyển tiếp
   * thật sự cần chờ, khác isVisible() là hỏi ngay không chờ).
   * @param {string|Object} selector
   */
  async wait(selector, { timeout = 10000 } = {}) {
    const visible = typeof selector === "string" ? { text: selector } : selector;
    return this._runFlow([{ extendedWaitUntil: { visible, timeout } }]);
  }

  /**
   * Hỏi NGAY (không chờ, không làm dừng flow nếu không thấy) - so khớp FULL regex trên text
   * hiển thị hiện tại (đúng ngữ nghĩa selector "text" của Maestro - đã xác nhận qua nhiều lỗi
   * thật trong automation/discovery/: so khớp full string, không phải substring).
   * @param {string} textPattern
   * @returns {boolean}
   */
  isVisible(textPattern) {
    const tree = this._dumpHierarchy();
    const texts = this._collectTexts(tree, []);
    const pattern = new RegExp(`^${textPattern}$`);
    return texts.some((t) => pattern.test(t));
  }

  /**
   * Trả về cây hierarchy thô hiện tại (đúng dữ liệu `maestro hierarchy` đã parse JSON) - dùng khi
   * caller cần TỰ PHÂN TÍCH nhiều phần tử cùng lúc bằng code thật (Node), thay vì dựa vào selector
   * `above`/`below` kèm `index` của Maestro trong `copyTextFrom`/`tapOn` - ĐÃ XÁC NHẬN THẬT
   * (2026-08-07, thiết bị 3201d866d40a1681) cả selector lồng nhau LẪN selector đơn tầng có
   * `index` đều có thể đọc SAI (vd đọc nhầm cả 3 lần liên tiếp thành cùng 1 giá trị sai) - parse
   * trực tiếp JSON của `maestro hierarchy` là cách DUY NHẤT đã kiểm chứng đáng tin trong phiên làm
   * việc này (xem bai_tap/homeworkListReader.js). Chỉ nên gọi hàm này SAU KHI đã dùng
   * `runSteps()`/các method khác để đưa app về đúng trạng thái cần đọc (gộp scroll vào 1 lượt
   * `runSteps()` DUY NHẤT rồi mới gọi `hierarchy()` 1 lần - KHÔNG gọi xen kẽ hierarchy() sau MỖI
   * bước scroll, sẽ tốn 1 lượt khởi động `maestro hierarchy` RIÊNG mỗi lần, xem ghi chú đo thời
   * gian thật trong bai_tap/runRandomOpenHomeworkFlow.js).
   */
  hierarchy() {
    return this._dumpHierarchy();
  }

  /** Bấm nút nộp đáp án - chữ cố định, dùng chung cho MỌI dạng bài (đã xác nhận qua
   * flows/vui_hoc/unit9_getting_started_tram_khoi_hanh.yaml) - không phải business logic theo
   * QuestionType nên đặt ở Bridge, không ở Handler. */
  async checkAnswer() {
    return this.tap("Kiểm tra");
  }

  /** Bấm nút qua câu tiếp theo - chữ cố định, dùng chung cho MỌI dạng bài. */
  async nextQuestion() {
    return this.tap("Tiếp theo");
  }

  /**
   * Lùi lại 1 màn hình - dùng cú pháp `back` chuẩn của Maestro (native command, không phải suy
   * đoán riêng của project này). CHƯA verify hành vi cụ thể trong app ParrotEdu (vd có dialog xác
   * nhận thoát hay không) - dùng thận trọng, kiểm tra lại bằng isVisible()/assertVisible ngay sau
   * khi gọi thay vì giả định luôn quay đúng về màn trước đó.
   */
  async back() {
    return this._runFlow(["back"]);
  }

  /**
   * Poll xem app báo "Chính xác"/"Chưa chính xác" cho câu vừa nộp - dùng isVisible() (không
   * dùng assertVisible thật) để KHÔNG làm dừng flow khi trả lời sai, cho phép Runtime vẫn ghi
   * nhận kết quả FAIL rồi tiếp tục câu sau.
   * @returns {Promise<"CORRECT"|"INCORRECT"|"UNKNOWN">}
   */
  async assertAnswerResult({ timeoutMs = 5000, pollMs = 300 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.isVisible("Chính xác.*")) return "CORRECT";
      if (this.isVisible("Chưa chính xác.*")) return "INCORRECT";
      sleepSync(pollMs / 1000);
    }
    return "UNKNOWN";
  }
}
