/**
 * Chuẩn hoá tên Unit để so khớp giữa CMS (getUnitsOfBook) và text thật hiển thị trên app.
 *
 * ĐÃ XÁC NHẬN THẬT (2026-08-05, qua maestro hierarchy): tên Unit trên CMS và trên app có thể
 * lệch nhau ở phần chữ dù cùng 1 Unit - vd CMS trả "Unit 20: Our summer holidays" nhưng app
 * hiển thị "Unit 20: Our summer holiday" (thiếu "s"). So khớp nguyên văn 2 chuỗi này sẽ luôn
 * fail dù rõ ràng là cùng 1 Unit - khiến readUnitStatusesFromScreen() không nhận diện được,
 * report nhầm thành "không thấy trên app" cho 1 Unit thực ra CÓ hiển thị.
 *
 * Vì số thứ tự ("Unit N"/"Review N") là khoá định danh ổn định hơn phần chữ mô tả theo sau
 * (không đổi dù nội dung mô tả được biên tập lại), so khớp theo số thứ tự này trước - chỉ khi
 * tên không có dạng "Unit N"/"Review N" (vd "Fun time", "Ngọc Anh test") mới so khớp nguyên văn
 * (đã trim + lowercase) làm phương án còn lại.
 *
 * @param {string} name
 * @returns {string} khoá chuẩn hoá - dùng làm key trong Map để so khớp CMS <-> app
 */
export function normalizeUnitKey(name) {
  if (!name) return "";
  const trimmed = name.trim();
  const numbered = /^(unit|review)\s+(\d+)\b/i.exec(trimmed);
  if (numbered) return `${numbered[1].toLowerCase()}:${numbered[2]}`;
  return trimmed.toLowerCase().replace(/\s+/g, " ");
}
