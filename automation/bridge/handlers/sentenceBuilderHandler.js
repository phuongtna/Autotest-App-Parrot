/**
 * Dạng bài Sentence Builder (ghép câu/ghép chữ theo thứ tự) - CHƯA XÁC NHẬN tên "type" thật
 * từ CMS (chưa gặp qua examPageScraper lần nào). Placeholder type dưới đây chắc chắn KHÔNG
 * khớp type thật, nên registry sẽ không bao giờ gọi handler này cho tới khi có ví dụ thật.
 *
 * ĐÂY LÀ DẠNG BÀI PHỨC TẠP NHẤT theo kinh nghiệm từ flow Unit9 viết tay (bước S09 trong
 * flows/vui_hoc/unit9_getting_started_tram_khoi_hanh.yaml): tapOn theo "text" KHÔNG hoạt
 * động tin cậy khi tap nhiều ô chữ liên tiếp trong cùng 1 màn hình (lỗi resolve selector của
 * Maestro, đã xác nhận không phải do trùng chữ hay do reflow layout) - bắt buộc phải dùng
 * toạ độ pixel tuyệt đối lấy từ `maestro hierarchy` lúc chạy thật, và toạ độ NGÂN HÀNG chữ
 * cái chỉ dịch chuyển ở 1-2 mốc cố định (không phải sau mỗi lần tap) nên tính trước được từ
 * hierarchy lúc màn hình vừa hiện ra - xem toàn bộ ghi chú chi tiết tại bước S09 trong file
 * trên trước khi viết buildSteps() cho handler này.
 *
 * Vì vậy handler này cần discovery/hierarchyProbe.js (chưa viết - xem TaskList "[Deferred
 * phase 2] hierarchyProbe.js") để tự tính toạ độ tại thời điểm chạy, không thể tạo bước tĩnh
 * từ QuestionModel một cách đáng tin cậy.
 */
export const type = "SENTENCE_BUILDER_TODO_CONFIRM_CMS_TYPE";

/**
 * @param {import("../../model/questionModel.js").QuestionModel} questionModel
 * @returns {Array<Object>}
 */
export function buildSteps(questionModel) {
  throw new Error(
    `SentenceBuilderHandler chưa implement - cần hierarchyProbe.js (đọc toạ độ thật lúc chạy ` +
      `trên emulator) để hoạt động tin cậy, và chưa có ví dụ thật của dạng bài này để xác nhận ` +
      `type/shape. Question ${questionModel.id} (type="${questionModel.type}").`,
  );
}
