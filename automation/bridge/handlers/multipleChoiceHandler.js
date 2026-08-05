/**
 * Dạng bài trắc nghiệm 1 đáp án đúng - CMS trả về type "ONE".
 *
 * CẢNH BÁO QUAN TRỌNG (rút ra từ flow Unit9 viết tay trước đây, bước S05 trong
 * flows/vui_hoc/unit9_getting_started_tram_khoi_hanh.yaml): testcase gốc ghi type này là
 * "Bài tập Trắc nghiệm" (tapOn theo đáp án như handler này làm), nhưng màn hình THẬT trên
 * app lại là "Drag and drop" (phải swipe, không tapOn được - nút Kiểm tra vẫn disabled nếu
 * chỉ tapOn). Nghĩa là: CMS type "ONE" KHÔNG đảm bảo luôn ánh xạ sang đúng 1 kiểu thao tác
 * UI cố định trên app - cùng type có thể render UI khác nhau tuỳ cách thiết kế bài học.
 *
 * Vì vậy handler này chỉ đúng cho trường hợp UI thật là "tap để chọn đáp án" - khi random
 * gặp Exercise mà UI thật hoá ra là kéo-thả (giống case Unit9 trên), flow sẽ fail ở bước
 * "Kiểm tra" (vẫn disabled) - cần bổ sung nhánh xử lý bằng cách quan sát hierarchy lúc chạy
 * thật (tương tự dragDropHandler.js) thay vì tin tuyệt đối vào "type" từ CMS.
 */
export const type = "ONE";

/**
 * @param {import("../../model/questionModel.js").QuestionModel} questionModel
 * @returns {Array<Object>}
 */
export function buildSteps(questionModel) {
  if (!questionModel.correctAnswer) {
    throw new Error(
      `MultipleChoiceHandler: question ${questionModel.id} không có correctAnswer, không thể tạo bước tapOn.`,
    );
  }
  return [{ tapOn: questionModel.correctAnswer }, { tapOn: "Kiểm tra" }];
}
