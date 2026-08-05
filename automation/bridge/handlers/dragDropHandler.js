/**
 * Dạng bài Drag & Drop - CMS trả về type "DRAG_DROP" (đã xác nhận qua examPageScraper, vd
 * exam "combine harvester": question.content là mảng đoạn văn bản quanh chỗ trống
 * ["", " harvester"], answers là word bank ["combine", "decline", "contract"], correct là
 * mảng string ["combine"]).
 *
 * CHƯA XÁC NHẬN TRÊN MÁY ẢO THẬT: implementation dưới đây chỉ là suy đoán hợp lý (tapOn
 * đúng từ trong word bank), CHƯA chạy thử trên emulator. Theo kinh nghiệm từ flow Unit9 viết
 * tay (bước S05 trong unit9_getting_started_tram_khoi_hanh.yaml), CMS type "ONE" từng render
 * ra UI thật là kéo-thả (phải dùng `swipe`, tapOn không đủ vì nút Kiểm tra vẫn disabled) - vì
 * tên type này LÀ "DRAG_DROP" nên khả năng cao UI thật cũng cần swipe, không chỉ tapOn. Cần
 * xác nhận bằng cách chạy trên máy ảo thật + `maestro hierarchy` để lấy toạ độ chính xác của
 * ô "Drop here" và từ trong word bank, rồi thay bước `tapOn` dưới đây bằng `swipe` (xem cách
 * làm mẫu ở comment S05 trong file flow kể trên).
 */
export const type = "DRAG_DROP";

/**
 * @param {import("../../model/questionModel.js").QuestionModel} questionModel
 * @returns {Array<Object>}
 */
export function buildSteps(questionModel) {
  if (!questionModel.correctAnswer) {
    throw new Error(
      `DragDropHandler: question ${questionModel.id} không có correctAnswer, không thể tạo bước thao tác.`,
    );
  }
  console.warn(
    `[bridge] DragDropHandler cho question ${questionModel.id}: dùng tapOn (CHƯA xác nhận trên ` +
      `máy ảo thật) - nếu UI thật cần kéo-thả, bước "Kiểm tra" sẽ fail vì nút vẫn disabled. ` +
      `Xem comment đầu file để biết cách xác nhận + sửa lại bằng swipe.`,
  );
  return [{ tapOn: questionModel.correctAnswer }, { tapOn: "Kiểm tra" }];
}
