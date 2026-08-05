/**
 * Dạng bài Nối (Matching) - CMS trả về type "CONNECT" (ĐÃ XÁC NHẬN THẬT qua examPageScraper,
 * 2026-08-05 - xem cùng ghi chú ở automation/runtime/handlers/matchingHandler.js): "answers"
 * gồm 2 "group" (0: audio/text, 1: image) + "correct" là map {idNhóm0 -> idNhóm1}.
 *
 * CHƯA XÁC NHẬN UI THẬT trên máy ảo/thiết bị (chưa từng random gặp type này qua Bridge). Theo
 * pattern đã xác nhận thủ công cho dạng Nối KHÁC (bước S12 trong
 * flows/vui_hoc/unit9_getting_started_tram_khoi_hanh.yaml: tapOn lần lượt từng cặp trái/phải,
 * KHÔNG có nút "Kiểm tra" - app tự kiểm tra ngay khi ghép đủ cặp) NHƯNG dạng "CONNECT" này có
 * nhóm là ẢNH (không có text để tapOn theo), nên rất có thể cần toạ độ hoặc thao tác khác hẳn -
 * KHÔNG suy đoán, CHỈ throw rõ ràng cho tới khi verify được trên máy ảo/thiết bị thật (cùng
 * trạng thái với bản Runtime).
 */
export const type = "CONNECT";

/**
 * @param {import("../../model/questionModel.js").QuestionModel} questionModel
 * @returns {Array<Object>}
 */
export function buildSteps(questionModel) {
  throw new Error(
    `MatchingHandler chưa implement - type "CONNECT" đã xác nhận từ CMS nhưng thao tác UI thật ` +
      `(tapOn theo ảnh không có text, hoặc cần toạ độ/drag) CHƯA verify trên máy ảo/thiết bị. ` +
      `Question ${questionModel.id}.`,
  );
}
