import { QuestionHandler } from "./questionHandler.js";

/**
 * Dạng Sentence Builder (ghép câu/ghép chữ theo thứ tự) - CHƯA XÁC NHẬN tên "type" thật từ CMS
 * (chưa gặp qua examPageScraper lần nào). Placeholder type dưới đây chắc chắn KHÔNG khớp type
 * thật, nên handlerRegistry.js sẽ không bao giờ gọi tới handler này cho tới khi có ví dụ thật.
 *
 * ĐÂY LÀ DẠNG BÀI PHỨC TẠP NHẤT theo quan sát thủ công trước đây (bước S09 trong
 * flows/vui_hoc/unit9_getting_started_tram_khoi_hanh.yaml): tapOn theo "text" KHÔNG hoạt động
 * tin cậy khi tap nhiều ô chữ liên tiếp trong cùng 1 màn hình - bắt buộc phải dùng toạ độ pixel
 * tuyệt đối lấy từ `maestro hierarchy` LÚC CHẠY THẬT (không tính trước được từ QuestionModel).
 * Cần thêm khả năng đọc hierarchy lúc runtime (tương tự MaestroBridge.isVisible() nhưng trả
 * toạ độ, chưa có) trước khi viết execute() thật - CHỈ tạo interface + TODO, không đoán tọa độ.
 */
export class SentenceBuilderHandler extends QuestionHandler {
  static supports(type) {
    return type === "SENTENCE_BUILDER_TODO_CONFIRM_CMS_TYPE";
  }

  async execute(question) {
    throw new Error(
      `SentenceBuilderHandler chưa implement - cần đọc toạ độ thật lúc chạy (chưa có API tương ` +
        `ứng trong MaestroBridge) và chưa có ví dụ thật của dạng bài này qua Runtime để xác nhận ` +
        `type/shape. Question ${question.id} (type="${question.type}").`,
    );
  }
}
