import * as trueFalseHandler from "./trueFalseHandler.js";
import * as multipleChoiceHandler from "./multipleChoiceHandler.js";
import * as dragDropHandler from "./dragDropHandler.js";
import * as fillBlankHandler from "./fillBlankHandler.js";
import * as matchingHandler from "./matchingHandler.js";
import * as sentenceBuilderHandler from "./sentenceBuilderHandler.js";
import * as unsupportedHandler from "./unsupportedHandler.js";

// Đăng ký handler theo dạng bài (plugin registry) - thêm dạng bài mới CHỈ cần thêm 1 file
// handler mới trong thư mục này rồi import + thêm vào mảng dưới đây, KHÔNG cần sửa Discovery
// (automation/discovery/) hay bất kỳ handler nào khác.
const HANDLERS = [
  trueFalseHandler,
  multipleChoiceHandler,
  dragDropHandler,
  fillBlankHandler,
  matchingHandler,
  sentenceBuilderHandler,
];

const REGISTRY = new Map(HANDLERS.map((handler) => [handler.type, handler]));

/**
 * Tìm handler khớp với "type" thô của question (từ QuestionModel.type). Không khớp cái nào
 * thì fallback sang unsupportedHandler (log cảnh báo, bỏ qua câu đó - không làm crash cả flow).
 */
export function resolveHandler(type) {
  return REGISTRY.get(type) ?? unsupportedHandler;
}

export { HANDLERS };
