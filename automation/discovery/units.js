import { fetchChildListWithFallback } from "./fetchList.js";
import { getEntityId } from "./entityId.js";

/**
 * Lấy danh sách Unit của 1 Book cụ thể (book lấy được từ getBooks(), không hardcode).
 */
export async function getUnitsOfBook(book) {
  const bookId = getEntityId(book, ["bookId"]);
  return fetchChildListWithFallback({
    endpointKey: "unitsOfBook",
    params: { bookId },
    parentCollection: "books",
    parentId: bookId,
    childCollection: "units",
  });
}
