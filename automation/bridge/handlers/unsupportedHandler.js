/**
 * Fallback khi không có handler nào khớp "type" của question (vd "SPEAK" - bài nói, không có
 * đáp án đúng rời rạc để tự động hoá - hoặc 1 dạng bài hoàn toàn mới CMS thêm sau này).
 * KHÔNG throw để 1 question lạ không làm hỏng toàn bộ flow - chỉ log cảnh báo rõ ràng và bỏ
 * qua (trả về mảng rỗng, không có bước Maestro nào cho question này).
 */
export const type = null; // không map với type cụ thể nào - chỉ dùng làm fallback trong registry

/**
 * @param {import("../../model/questionModel.js").QuestionModel} questionModel
 * @returns {Array<Object>}
 */
export function buildSteps(questionModel) {
  console.warn(
    `[bridge] Không có handler cho type "${questionModel.type}" (question id=${questionModel.id}, ` +
      `nội dung: "${questionModel.question}") - bỏ qua câu này. Nếu đây là dạng bài mới (không phải ` +
      `SPEAK), thêm 1 handler mới trong automation/bridge/handlers/ và đăng ký vào index.js.`,
  );
  return [];
}
