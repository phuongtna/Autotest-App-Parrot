import { QuestionHandler } from "./questionHandler.js";

/**
 * Dạng Nối (Matching) - type "CONNECT" ĐÃ XÁC NHẬN THẬT qua examPageScraper (2026-08-05, xem
 * automation/output/discovery.json): "answers" gồm 2 "group" (0: audio/text, 1: image) +
 * "correct" là map {idNhóm0 -> idNhóm1} - đúng shape 1 dạng bài Nối/Ghép cặp.
 *
 * CHƯA XÁC NHẬN UI THẬT trên máy ảo (chưa từng random gặp type này qua Runtime) - theo pattern
 * đã xác nhận thủ công cho dạng Nối KHÁC (bước S12 trong
 * flows/vui_hoc/unit9_getting_started_tram_khoi_hanh.yaml: tapOn lần lượt từng cặp trái/phải,
 * KHÔNG có nút "Kiểm tra" - app tự kiểm tra ngay khi ghép đủ cặp) NHƯNG dạng "CONNECT" này có
 * nhóm là ẢNH (không có text để tapOn theo), nên rất có thể cần toạ độ hoặc thao tác khác hẳn -
 * KHÔNG suy đoán, CHỈ tạo interface + TODO cho tới khi verify được trên máy ảo thật.
 */
export class MatchingHandler extends QuestionHandler {
  static supports(type) {
    return type === "CONNECT";
  }

  async execute(question) {
    throw new Error(
      `MatchingHandler chưa implement - type "CONNECT" đã xác nhận từ CMS nhưng UI thao tác ` +
        `thật (tapOn theo ảnh không có text, hoặc cần toạ độ/drag) CHƯA verify trên máy ảo. ` +
        `Question ${question.id}.`,
    );
  }
}
