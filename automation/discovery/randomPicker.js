/**
 * Chọn ngẫu nhiên 1 phần tử từ 1 danh sách lấy được từ API - không có ID nào được cố định
 * trước, danh sách đầu vào luôn tới từ 1 lệnh gọi CMS thật ở nơi gọi hàm này.
 */
export function pickRandom(list) {
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("pickRandom() nhận được danh sách rỗng hoặc không hợp lệ");
  }
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

/**
 * Trả về 1 bản sao đã xáo trộn ngẫu nhiên toàn bộ (Fisher-Yates) - dùng khi cần duyệt 1 danh
 * sách theo thứ tự ngẫu nhiên (vd random Book/Unit lần lượt cho tới khi gặp Unit Hoàn thành,
 * xem unitCompletion.js) thay vì chỉ lấy 1 phần tử ngẫu nhiên duy nhất.
 */
export function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
