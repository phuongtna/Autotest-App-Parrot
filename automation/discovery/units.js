import { fetchChildListWithFallback } from "./fetchList.js";
import { getEntityId } from "./entityId.js";

const PUBLISHED_STATUS = "done";

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

/**
 * Lọc chỉ giữ Unit đã publish/hiển thị cho học sinh - ĐÃ XÁC NHẬN THẬT (2026-08-05, đối chiếu
 * TOÀN BỘ 25 Unit của 1 Book "SELF_LEARN" thật với kết quả quét `maestro hierarchy` trên app
 * thật): field "status" trên Unit ("draft"|"done") khớp CHÍNH XÁC 100% với việc Unit đó có hiển
 * thị trên app hay không - "done" = có trên app (đã publish), "draft" = KHÔNG có trên app (còn
 * đang soạn, học sinh không thấy). Khác với field "status" ở CẤP BOOK (luôn là "active", không
 * liên quan) - đây là field CÙNG TÊN nhưng khác entity, đừng nhầm lẫn.
 */
export function filterPublishedUnits(units) {
  return units.filter((u) => u.status === PUBLISHED_STATUS);
}
