// So sánh thanh tiến độ tổng "Bài tập X/Y" (đầu danh sách) trước/sau khi hoàn thành - HW-14_15
// luôn hoàn thành LẦN ĐẦU (mở bài -> thoát X -> resume -> làm hết), không phải nhánh "Làm lại",
// nên kỳ vọng tăng đúng 1 (cùng rule đã xác nhận thật trong
// flows/bai_tap/complete_random_homework_success.yaml, dùng chung cơ chế copyTextFrom).
var beforeNum = parseInt(output.beforeProgress.match(/\d+/)[0], 10);
var afterNum = parseInt(output.afterProgress.match(/\d+/)[0], 10);

output.progressOk = afterNum > beforeNum;
