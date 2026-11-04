/**
 * locateDeThiCli.mjs - CLI tìm 1 đề CỤ THỂ trong tab "Ôn thi > Đề thầy cô giao" bằng thuật toán
 * CANONICAL (`findDeThi()` -> `runSearchStateMachine()`, xem automation/on_thi/discovery/findDeThi.js)
 * thay vì `scrollUntilVisible` thô trong flows/app/helpers/open-de.yaml.
 *
 * TẠI SAO CẦN FILE NÀY (2026-11-04): quan sát thật trên thiết bị khi chạy OT-07..13/OT-34-35 qua
 * `maestro test` cho thấy `scrollUntilVisible` (built-in Maestro) không phân biệt được "đã hết danh
 * sách thật" khỏi "chưa tới nơi, cần cuộn tiếp" - CÙNG lớp lỗi mà `assignmentSearchEngine.js` (module
 * Bài tập) đã sửa bằng viewportSignature đa tín hiệu + 2 chiến lược gesture độc lập trước khi kết
 * luận PROGRESS_STALLED (xem docblock file đó). `findDeThi()` đã có sẵn, tái dùng NGUYÊN VẸN engine
 * đó, nhưng CHƯA từng được gọi qua 1 CLI thật nào - file này là lớp CLI mỏng (tương tự cách
 * `pro_lamlai_target_score.mjs` gọi `findAssignment()`), KHÔNG thêm logic locate mới.
 *
 * Dùng Bridge MCP (`MaestroMcpBridge`, 1 tiến trình `maestro mcp` sống xuyên suốt) thay vì
 * `maestro test` CLI-per-lệnh - né luôn vấn đề "dev.mobile.maestro còn sống làm chết dev.mobile.
 * maestro.test" đã gặp phải khi chạy `maestro test`/`maestro hierarchy` xen kẽ trong phiên này.
 *
 * Tham số môi trường: APP_ID, DEVICE_ID (optional), DE_TITLE (bắt buộc), DE_DUE_DATE_DM (optional),
 * DE_CTA (optional, lọc thêm theo CTA khi title+due date vẫn chưa đủ phân biệt), MAX_SCROLLS
 * (optional, mặc định 40 - theo DEFAULT_MAX_SCROLLS của findDeThi.js), TAP_FOUND ("true" để tap CTA
 * của card sau khi FOUND, mặc định chỉ locate + in kết quả, KHÔNG tap).
 *
 * Output: in JSON {status, scrollCount, card|matches|reason, diagnostics} ra stdout - caller (script
 * Node khác, hoặc người vận hành đọc log) tự quyết định bước tiếp theo dựa trên `status`.
 */
import { config } from "../src/config.js";
import { MaestroMcpBridge } from "../bridge/maestroMcpBridge.js";
import { findDeThi, tapFoundDeCard, scrollToTop } from "./discovery/findDeThi.js";

const DE_TITLE = process.env.DE_TITLE;
const DE_DUE_DATE_DM = process.env.DE_DUE_DATE_DM || undefined;
const DE_CTA = process.env.DE_CTA || undefined;
const MAX_SCROLLS = process.env.MAX_SCROLLS ? Number(process.env.MAX_SCROLLS) : undefined;
const TAP_FOUND = process.env.TAP_FOUND === "true";
const APP_ID = process.env.APP_ID || config.appId;
const DEVICE_ID = process.env.DEVICE_ID || config.deviceId || undefined;

if (!DE_TITLE) {
  console.error("Thiếu DE_TITLE - vd: DE_TITLE=\"Đề ẩn\" DE_DUE_DATE_DM=\"30/10\" node automation/on_thi/locateDeThiCli.mjs");
  process.exit(1);
}
if (!APP_ID) {
  console.error("Thiếu APP_ID (env hoặc .env).");
  process.exit(1);
}

async function main() {
  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: DEVICE_ID });
  await bridge.start();
  try {
    const topResult = await scrollToTop(bridge);
    if (!topResult.atTop) {
      console.log(JSON.stringify({ status: "ERROR", reason: `scrollToTop thất bại: ${topResult.reason}` }, null, 2));
      process.exitCode = 1;
      return;
    }

    const target = { title: DE_TITLE, dueDateDM: DE_DUE_DATE_DM, cta: DE_CTA };
    const result = await findDeThi(bridge, target, { maxScrolls: MAX_SCROLLS });

    if (result.status === "FOUND" && TAP_FOUND) {
      const tapResult = await tapFoundDeCard(bridge, result.card);
      result.tapped = !!tapResult?.success;
      result.tapError = tapResult?.success ? null : tapResult?.error ?? null;
    }

    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === "FOUND" ? 0 : 2;
  } finally {
    await bridge.stop();
  }
}

main().catch((err) => {
  console.error("locateDeThiCli.mjs lỗi:", err?.stack || err);
  process.exit(1);
});
