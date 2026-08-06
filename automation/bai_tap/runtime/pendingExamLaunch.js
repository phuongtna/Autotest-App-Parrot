/**
 * Đánh dấu 1 bước bị chặn vì cần "mở/bắt đầu/nộp bài" (Start Homework / Open Exam / Submit
 * Exam) - PHẠM VI CỐ TÌNH CHƯA IMPLEMENT theo yêu cầu (2026-08-06): examId hiện là UNRESOLVED
 * (xem model/homeworkModel.js), không có endpoint nào đã được xác nhận để mở đúng bài làm thật -
 * KHÔNG suy đoán/không tự tạo endpoint giả cho bước này.
 *
 * Message CỐ ĐỊNH (1 nguồn duy nhất, dùng lại y hệt ở mọi nơi cần đánh dấu Pending - không gõ
 * lại chuỗi này tay ở chỗ khác để tránh lệch chữ):
 */
export const PENDING_EXAM_LAUNCH_MESSAGE = "Waiting for verified exam launch endpoint.";

export class PendingExamLaunchError extends Error {
  /** @param {{ homeworkId?: string, title?: string, step: string }} context */
  constructor(context) {
    super(PENDING_EXAM_LAUNCH_MESSAGE);
    this.name = "PendingExamLaunchError";
    this.context = context;
  }
}
