// Không biết trước tên field ID thật của mỗi loại entity CMS trả về (có thể là "id",
// "_id", "bookId", "unitId"...). getEntityId() thử các tên phổ biến theo thứ tự, để mỗi
// resource module không phải tự đoán lặp lại logic này.
const COMMON_ID_KEYS = ["id", "_id", "uuid", "code"];

export function getEntityId(item, extraKeys = []) {
  for (const key of [...extraKeys, ...COMMON_ID_KEYS]) {
    if (item && item[key] !== undefined && item[key] !== null) {
      return item[key];
    }
  }
  throw new Error(
    `Không tìm được field ID trong entity: ${JSON.stringify(item)}. ` +
      `Cần cập nhật danh sách key ưu tiên trong entityId.js sau khi biết response thật.`,
  );
}

export function getEntityName(item, extraKeys = []) {
  for (const key of [...extraKeys, "name", "title", "label"]) {
    if (item && item[key] !== undefined && item[key] !== null) {
      return item[key];
    }
  }
  return undefined;
}
