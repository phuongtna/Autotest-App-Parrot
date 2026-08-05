/**
 * Dạng bài Nối (Matching) - CHƯA XÁC NHẬN tên "type" thật từ CMS (chưa gặp qua
 * examPageScraper lần nào). Placeholder type dưới đây chắc chắn KHÔNG khớp type thật, nên
 * registry sẽ không bao giờ gọi handler này cho tới khi có ví dụ thật.
 *
 * Khi gặp dạng bài này (xem cảnh báo "Không có handler cho type ..." từ unsupportedHandler.js),
 * cập nhật `type` cho khớp giá trị thật, và dựa theo pattern đã xác nhận thủ công trong
 * flows/vui_hoc/unit9_getting_started_tram_khoi_hanh.yaml (bước S12): tapOn lần lượt từng
 * cặp trái/phải theo đúng thứ tự (app tự kiểm tra ngay khi ghép đủ cặp, KHÔNG có nút
 * "Kiểm tra" - khác các dạng bài khác). Cần biết trước raw "answers"/"correct" của dạng bài
 * này chứa cặp trái-phải ra sao (metadata.raw trong QuestionModel) trước khi viết buildSteps().
 */
export const type = "MATCHING_TODO_CONFIRM_CMS_TYPE";

/**
 * @param {import("../../model/questionModel.js").QuestionModel} questionModel
 * @returns {Array<Object>}
 */
export function buildSteps(questionModel) {
  throw new Error(
    `MatchingHandler chưa implement - chưa có ví dụ thật nào của dạng bài này từ CMS để xác ` +
      `nhận type/shape cặp trái-phải. Question ${questionModel.id} (type="${questionModel.type}") ` +
      `cần được dùng để cập nhật lại handler này trước khi dùng được.`,
  );
}
