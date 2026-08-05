import { fetchRootListWithFallback } from "./fetchList.js";

/**
 * Lấy toàn bộ danh sách Book từ CMS. Không nhận tham số - đây là gốc của cây discovery.
 */
export async function getBooks() {
  return fetchRootListWithFallback({
    endpointKey: "books",
    rootCandidates: ["/books", "/book", "/cms/books"],
  });
}
