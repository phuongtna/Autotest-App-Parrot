import { spawn } from "node:child_process";
import { dump } from "js-yaml";

/**
 * MaestroMcpSession - giữ ĐÚNG 1 tiến trình `maestro mcp` sống xuyên suốt nhiều lệnh
 * (inspect_screen/run), thay cho cách cũ mỗi lệnh tự spawn 1 tiến trình CLI riêng
 * (`maestro test`/`maestro hierarchy` - xem `bridge/maestroBridge.js`).
 *
 * LÝ DO (đo THẬT 2026-08-07, thiết bị 3201d866d40a1681, model SM-M205G):
 * - `maestro --version` (không chạm thiết bị): ~4s - đây là chi phí khởi động JVM thuần.
 * - `maestro hierarchy`/`maestro test` (chạm thiết bị, tiến trình MỚI mỗi lần): ~40-52s MỖI LẦN,
 *   KHÔNG giảm ở lần gọi thứ 2 dù gọi ngay sau lần 1 (đã đo 2 lượt `maestro hierarchy` liên tiếp:
 *   52s rồi 40s) - phần chênh (~35-48s so với baseline JVM) là chi phí tái tạo driver/session
 *   TRÊN THIẾT BỊ, KHÔNG được cache giữa các TIẾN TRÌNH riêng biệt (mỗi tiến trình CLI mới coi
 *   như driver chưa từng tồn tại).
 * - Giữ 1 tiến trình `maestro mcp` sống (class này) rồi gọi lại tool `inspect_screen`/`run` NHIỀU
 *   LẦN trong CÙNG tiến trình đó: lượt ĐẦU vẫn ~38s (cùng chi phí cold-start driver, không tránh
 *   được) nhưng các lượt SAU chỉ còn ~1.7-2.5s (`inspect_screen`) và ~7.2-7.4s (`run` 1 swipe +
 *   chờ hoạt ảnh 1200ms) - vì driver/session đã sống sẵn trong tiến trình, không phải tạo lại.
 *   ~10 LẦN nhanh hơn cho phần lặp scroll+đọc hierarchy của Discovery.
 *
 * `maestro mcp` là subcommand CHÍNH THỨC của Maestro CLI 2.8.0 (`maestro mcp --help`: "Starts the
 * Maestro MCP server, exposing Maestro device and automation commands as Model Context Protocol
 * (MCP) tools over STDIO for LLM agents and automation clients") - KHÔNG phải cơ chế tự chế/hack
 * ngoài tài liệu. Giao tiếp qua JSON-RPC 2.0 newline-delimited trên stdin/stdout (chuẩn MCP stdio
 * transport) - class này CHỈ implement 3 method MCP thật sự cần (`initialize`, thông báo
 * `notifications/initialized`, `tools/call`), KHÔNG phải 1 SDK MCP đầy đủ.
 *
 * Tool "inspect_screen" trả JSON dạng RÚT GỌN (khoá viết tắt vd `txt`=text, `scroll`=scrollable,
 * `c`=children - KHÁC hẳn `maestro hierarchy` dạng `{attributes:{...}, children:[...]}`) - method
 * `hierarchy()` bên dưới CHUYỂN ĐỔI về ĐÚNG shape cũ để tái dùng NGUYÊN VẸN các hàm parse đã có
 * (`collectTextNodesInsideScrollableList()`, `parseHomeworkCardsFromTexts()` trong
 * homeworkUiList.js) - KHÔNG đổi logic parse, chỉ đổi NGUỒN dữ liệu. Map viết tắt/giá trị mặc định
 * đọc ĐỘNG từ `ui_schema` trả về MỖI LẦN gọi (KHÔNG hardcode bộ viết tắt) - phòng Maestro đổi bộ
 * viết tắt ở version sau.
 */
export class MaestroMcpSession {
  /**
   * @param {{ deviceId?: string }} [options] - để trống nếu chỉ có ĐÚNG 1 thiết bị đang kết nối
   *   (giống quy ước `MaestroBridge`: "Để trống thì maestro/adb tự chọn thiết bị duy nhất đang kết
   *   nối" - xem `automation/src/config.js`). Tool MCP `run`/`inspect_screen` BẮT BUỘC 1 `device_id`
   *   rõ ràng cho mỗi lệnh (khác `maestro test`/`maestro hierarchy` CLI tự suy ra khi chỉ có 1 thiết
   *   bị) - nếu không truyền, `start()` tự gọi tool `list_devices` để resolve, CHỈ tự chọn khi có
   *   ĐÚNG 1 thiết bị `connected: true` (không suy đoán khi có 0 hoặc nhiều hơn 1).
   */
  constructor({ deviceId } = {}) {
    this.deviceId = deviceId || null;
    this.proc = null;
    this._buf = "";
    this._pending = new Map();
    this._nextId = 1;
    // Đếm số lượt `tools/call` THẬT đã gọi trong session này (khác hẳn số tiến trình CLI đã
    // spawn - CHỈ 1 tiến trình `maestro mcp` cho toàn bộ session, xem so sánh ở nơi gọi).
    this.toolCallCount = 0;
  }

  /**
   * Khởi động tiến trình `maestro mcp` + handshake `initialize` - gọi 1 LẦN trước khi dùng. Nếu
   * chưa có `deviceId` (constructor không truyền), tự resolve qua tool `list_devices` NGAY sau
   * handshake - xem giải thích ở constructor.
   */
  async start() {
    this.proc = spawn("maestro", ["mcp", "--no-viewer"], { stdio: ["pipe", "pipe", "pipe"] });
    this.proc.stdout.on("data", (chunk) => this._onStdout(chunk));
    this.proc.on("exit", () => {
      for (const resolve of this._pending.values()) {
        resolve({ error: { message: "Tiến trình `maestro mcp` đã thoát ngoài dự kiến." } });
      }
      this._pending.clear();
    });
    await this._call("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "homework-discovery-mcp-session", version: "1.0" },
    });
    this._notify("notifications/initialized", {});

    if (!this.deviceId) {
      const text = await this._toolCall("list_devices", {});
      const { devices } = JSON.parse(text);
      const connected = (devices ?? []).filter((d) => d.connected);
      if (connected.length !== 1) {
        throw new Error(
          `MaestroMcpSession: không tự resolve được deviceId (cần ĐÚNG 1 thiết bị đang kết nối, ` +
            `thấy ${connected.length}: ${connected.map((d) => d.device_id).join(", ") || "(không có)"}) - ` +
            `truyền deviceId rõ ràng (vd qua DEVICE_ID trong .env) khi có nhiều hơn 1 thiết bị.`,
        );
      }
      this.deviceId = connected[0].device_id;
    }
  }

  _onStdout(chunk) {
    this._buf += chunk.toString("utf8");
    let idx;
    while ((idx = this._buf.indexOf("\n")) >= 0) {
      const line = this._buf.slice(0, idx).trim();
      this._buf = this._buf.slice(idx + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue; // dòng log kotlin-logging/không phải JSON-RPC - bỏ qua, không phải lỗi.
      }
      if (msg.id !== undefined && this._pending.has(msg.id)) {
        this._pending.get(msg.id)(msg);
        this._pending.delete(msg.id);
      }
    }
  }

  _call(method, params) {
    return new Promise((resolve) => {
      const id = this._nextId++;
      this._pending.set(id, resolve);
      this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  _notify(method, params) {
    this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }

  async _toolCall(name, args) {
    this.toolCallCount++;
    const res = await this._call("tools/call", { name, arguments: args });
    if (res.error) {
      throw new Error(`MCP tools/call "${name}" lỗi: ${JSON.stringify(res.error)}`);
    }
    const text = res.result?.content?.[0]?.text;
    if (typeof text !== "string") {
      throw new Error(`MCP tools/call "${name}" không trả về content.text hợp lệ: ${JSON.stringify(res)}`);
    }
    return text;
  }

  /**
   * Chạy 1 mảng bước Maestro (native command, giống `bridge.runSteps()`) qua MCP tool "run" -
   * dùng trong CÙNG session đang sống (không spawn tiến trình mới).
   * @param {string} appId
   * @param {Array<Object|string>} steps
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async run(appId, steps) {
    const yaml = `appId: ${appId}\n---\n${dump(steps, { lineWidth: -1 })}`;
    try {
      await this._toolCall("run", { device_id: this.deviceId, yaml });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Đọc hierarchy hiện tại qua MCP tool "inspect_screen", chuyển đổi về ĐÚNG shape
   * `{attributes:{...}, children:[...]}` của `bridge.hierarchy()` - xem giải thích ở đầu file.
   * @returns {Promise<Object>}
   */
  async hierarchy() {
    const text = await this._toolCall("inspect_screen", { device_id: this.deviceId });
    const payload = JSON.parse(text);
    const abbrev = payload.ui_schema?.abbreviations ?? {};
    const defaults = payload.ui_schema?.defaults ?? {};
    const fullNameOf = (abbrKey) => abbrev[abbrKey] ?? abbrKey;

    function adapt(node) {
      const attributes = {};
      for (const [key, value] of Object.entries(node)) {
        if (key === "c") continue;
        attributes[fullNameOf(key)] = typeof value === "boolean" ? String(value) : value;
      }
      if (attributes.text === undefined) attributes.text = defaults.txt ?? "";
      if (attributes.scrollable === undefined) attributes.scrollable = String(defaults.scrollable ?? false);
      return { attributes, children: (node.c ?? []).map(adapt) };
    }

    const roots = Array.isArray(payload.elements) ? payload.elements : [payload.elements];
    return { attributes: {}, children: roots.map(adapt) };
  }

  /** Dừng tiến trình `maestro mcp` - gọi khi xong việc, KHÔNG để tiến trình treo lại. */
  async stop() {
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
  }
}
