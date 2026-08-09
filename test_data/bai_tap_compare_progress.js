// So sánh tiến độ tổng "Bài tập" trước/sau khi làm - đúng theo rule đã xác nhận thật
// (2026-08-09): hoàn thành lần đầu -> tiến độ tăng đúng 1; làm lại (Làm lại) -> không đổi.
var beforeNum = parseInt(output.beforeProgress.match(/\d+/)[0], 10);
var afterNum = parseInt(output.afterProgress.match(/\d+/)[0], 10);

if (output.isFirstAttempt) {
  output.progressOk = afterNum > beforeNum;
} else {
  output.progressOk = afterNum >= beforeNum;
}
