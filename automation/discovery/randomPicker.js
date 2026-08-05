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
