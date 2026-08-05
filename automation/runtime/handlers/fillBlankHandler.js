import { QuestionHandler } from "./questionHandler.js";

/**
 * Dạng Điền ký tự/Điền từ (Fill in the Blank) - CHƯA XÁC NHẬN tên "type" thật từ CMS qua
 * examPageScraper (các Exercise random gặp được tới nay chỉ ra "ONE", "TRUE_FALSE",
 * "DRAG_DROP", "SPEAK", "CONNECT" - xem automation/README.md). Placeholder type dưới đây chắc
 * chắn KHÔNG khớp type thật - handlerRegistry.js vì vậy sẽ không bao giờ gọi tới handler này
 * cho tới khi có ví dụ thật.
 *
 * Pattern UI đã quan sát THỦ CÔNG (chưa qua Runtime, xem
 * flows/vui_hoc/unit9_getting_started_tram_khoi_hanh.yaml bước S07): tapOn ô input đầu tiên 1
 * lần, inputText từng ký tự, bấm "Tiếp theo" sau mỗi ký tự (trừ ký tự cuối bấm "Kiểm tra"). CHỈ
 * viết execute() thật sau khi có type thật + xác nhận lại pattern này qua Runtime trên máy ảo
 * thật (không đoán trước).
 */
export class FillBlankHandler extends QuestionHandler {
  static supports(type) {
    return type === "FILL_BLANK_TODO_CONFIRM_CMS_TYPE";
  }

  async execute(question) {
    throw new Error(
      `FillBlankHandler chưa implement - chưa có ví dụ thật của dạng bài này qua Runtime để xác ` +
        `nhận type/pattern UI. Question ${question.id} (type="${question.type}").`,
    );
  }
}
