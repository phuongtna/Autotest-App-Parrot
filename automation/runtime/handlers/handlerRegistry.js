import { TrueFalseHandler } from "./trueFalseHandler.js";
import { MultipleChoiceHandler } from "./multipleChoiceHandler.js";
import { FillBlankHandler } from "./fillBlankHandler.js";
import { SentenceBuilderHandler } from "./sentenceBuilderHandler.js";
import { MatchingHandler } from "./matchingHandler.js";
import { DragDropHandler } from "./dragDropHandler.js";

// Đăng ký Handler theo dạng bài (plugin registry) - thêm dạng bài mới CHỈ cần thêm 1 file
// Handler mới trong thư mục này rồi import + thêm vào mảng dưới đây, KHÔNG cần sửa Runtime hay
// bất kỳ Handler nào khác (không viết switch-case khổng lồ).
const HANDLER_CLASSES = [
  TrueFalseHandler,
  MultipleChoiceHandler,
  FillBlankHandler,
  SentenceBuilderHandler,
  MatchingHandler,
  DragDropHandler,
];

/**
 * HandlerRegistry - tạo Handler đúng cho 1 QuestionType, tự inject `bridge` (Dependency
 * Injection) vào Handler khi tạo - Runtime không tự new Handler trực tiếp.
 */
export class HandlerRegistry {
  /** @param {import("../../bridge/maestroBridge.js").MaestroBridge} bridge */
  constructor(bridge) {
    this.bridge = bridge;
  }

  /**
   * @param {string} type
   * @returns {import("./questionHandler.js").QuestionHandler|null} null nếu không có Handler
   *   nào khớp - Runtime tự quyết định bỏ qua (log rõ), không throw ở đây.
   */
  resolve(type) {
    const HandlerClass = HANDLER_CLASSES.find((Handler) => Handler.supports(type));
    return HandlerClass ? new HandlerClass(this.bridge) : null;
  }
}
