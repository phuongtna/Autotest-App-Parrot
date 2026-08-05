import { QuestionHandler } from "./questionHandler.js";

/**
 * Dạng Drag & Drop - type "DRAG_DROP" ĐÃ XÁC NHẬN THẬT qua examPageScraper (xem
 * automation/bridge/handlers/dragDropHandler.js cho chi tiết shape).
 *
 * CHƯA XÁC NHẬN UI THẬT trên máy ảo qua Runtime (bản automation/bridge/handlers/dragDropHandler.js
 * hiện tại chỉ ĐOÁN dùng tapOn - tự nhận trong comment là CHƯA verify, có khả năng UI thật cần
 * `swipe` như trường hợp tương tự ở bước S05 trong
 * flows/vui_hoc/unit9_getting_started_tram_khoi_hanh.yaml). Theo đúng yêu cầu "không được đoán"
 * cho Runtime, handler này CHỈ tạo interface + TODO - KHÔNG copy lại thao tác tapOn chưa verify
 * đó. Verify xong (swipe đúng toạ độ nào, MaestroBridge cần thêm API gì) mới viết execute() thật.
 */
export class DragDropHandler extends QuestionHandler {
  static supports(type) {
    return type === "DRAG_DROP";
  }

  async execute(question) {
    throw new Error(
      `DragDropHandler chưa implement - type "DRAG_DROP" đã xác nhận từ CMS nhưng thao tác UI ` +
        `thật (tapOn hay swipe, toạ độ nào) CHƯA verify qua Runtime trên máy ảo thật. Question ` +
        `${question.id}.`,
    );
  }
}
