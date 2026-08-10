// Sinh tên hồ sơ con động (kèm timestamp) để mỗi lần chạy testcase tạo hồ sơ mới
// đều là 1 tên chưa tồn tại, tránh trùng với hồ sơ con tạo ra ở lần chạy trước.
var now = new Date();
function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}
var timestamp = '' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) +
  '_' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
output.CHILD_NAME = 'QA Auto Child ' + timestamp;
