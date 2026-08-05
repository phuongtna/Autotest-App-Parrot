import { fetchRootListWithFallback } from "./fetchList.js";

const SELF_LEARN_TYPE = "SELF_LEARN";

/**
 * Lấy toàn bộ danh sách Book từ CMS. Không nhận tham số - đây là gốc của cây discovery.
 */
export async function getBooks() {
  return fetchRootListWithFallback({
    endpointKey: "books",
    rootCandidates: ["/books", "/book", "/cms/books"],
  });
}

/**
 * Lọc chỉ giữ Book type "SELF_LEARN" - ĐÃ XÁC NHẬN THẬT (2026-08-05, đối chiếu id Unit thật lấy
 * qua getUnitsOfBook() với Unit id đọc được trên app thật qua `maestro hierarchy`): mỗi Khối có
 * 2 bản ghi Book TRÙNG TÊN nhưng "type" và "id" khác hẳn nhau - "BY_TEACHER" (sách giao bởi giáo
 * viên) và "SELF_LEARN" (sách tự học). Toàn bộ Unit id của bản ghi "BY_TEACHER" KHÔNG khớp với
 * bất kỳ gì hiển thị trên tab "Vui học" (tự học) của app - chỉ "SELF_LEARN" mới là sách thật sự
 * app hiển thị cho học sinh tự học. Không lọc field này thì `getUnitsOfBook()` có thể trả về
 * Unit của đúng Khối nhưng SAI Book, khiến Runtime tìm mãi không ra Unit trên app (không tồn
 * tại) dù Unit đó "có vẻ" hợp lệ theo tên/Khối.
 */
export function filterSelfLearnBooks(books) {
  return books.filter((b) => b.type === SELF_LEARN_TYPE);
}
