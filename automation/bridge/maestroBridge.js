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
  }

  _deviceArgs() {
    return this.deviceId ? ["--device", this.deviceId] : [];
  }

  /**
   * @param {Array<Object|string>} steps - mảng Maestro command (plain object hoặc string, vd
   *   "back") - serialize bằng js-yaml giống automation/bridge/flowGenerator.js.
   * @returns {{ success: boolean, error?: string }}
   */
  _runFlow(steps) {
    mkdirSync(OUTPUT_TMP_DIR, { recursive: true });
    const flowPath = join(OUTPUT_TMP_DIR, `bridge_step_${++callCounter}.yaml`);
    const yaml = `appId: \${APP_ID}\n---\n${dump(steps, { lineWidth: -1 })}`;
    writeFileSync(flowPath, yaml, "utf8");
    try {
      const args = [...this._deviceArgs(), "test", flowPath, "-e", `APP_ID=${this.appId}`];
      execCliSync("maestro", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      rmSync(flowPath, { force: true });
    }
  }

  _dumpHierarchy() {
    const args = [...this._deviceArgs(), "hierarchy"];
    const raw = execCliSync("maestro", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    return JSON.parse(raw);
  }

  _collectTexts(node, acc) {
    const text = node?.attributes?.text;
    if (typeof text === "string" && text.trim()) acc.push(text.trim());
    for (const child of node?.children ?? []) this._collectTexts(child, acc);
    return acc;
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
