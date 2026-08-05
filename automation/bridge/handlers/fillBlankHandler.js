/**
 * Dạng bài Điền ký tự/Điền từ (Fill in the Blank) - CHƯA XÁC NHẬN tên "type" thật từ CMS
 * (chưa gặp qua examPageScraper lần nào - các Exercise random gặp được tới nay chỉ ra
 * "ONE", "TRUE_FALSE", "DRAG_DROP", "SPEAK"). Placeholder type dưới đây chắc chắn KHÔNG
 * khớp với type thật của CMS - handler này vì vậy sẽ không bao giờ được registry gọi tới
 * cho tới khi có ví dụ thật.
 *
 * Khi gặp dạng bài này qua examPageScraper (console sẽ log cảnh báo "Không có handler cho
 * type ..." - xem unsupportedHandler.js), cập nhật `type` bên dưới cho khớp giá trị thật rồi
 * viết buildSteps() dựa theo pattern đã xác nhận thủ công trong
 * flows/vui_hoc/unit9_getting_started_tram_khoi_hanh.yaml (bước S07): tapOn ô input đầu tiên
 * 1 lần, inputText từng ký tự, bấm "Tiếp theo" sau mỗi ký tự (trừ ký tự cuối bấm "Kiểm tra").
 */
export const type = "FILL_BLANK_TODO_CONFIRM_CMS_TYPE";

/**
 * @param {import("../../model/questionModel.js").QuestionModel} questionModel
 * @returns {Array<Object>}
 */
export function buildSteps(questionModel) {
  throw new Error(
    `FillBlankHandler chưa implement - chưa có ví dụ thật nào của dạng bài này từ CMS để xác ` +
      `nhận type/shape. Question ${questionModel.id} (type="${questionModel.type}") cần được ` +
      `dùng để cập nhật lại handler này trước khi dùng được.`,
  );
}
