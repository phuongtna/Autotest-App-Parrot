import { probeRequest } from "./cmsClient.js";

// Heuristic dò endpoint khi path suy đoán trong endpoints.js không đúng (404 hoặc response
// không đúng shape mong đợi - vd không phải mảng khi ta cần 1 list). Thử lần lượt vài biến
// thể REST phổ biến. Đây là công cụ HỖ TRỢ khám phá, không thay thế endpoints.js: khi
// probe() tìm ra path đúng, cần copy path đó vào endpoints.js để lần sau khỏi phải probe lại.
//
// candidates: mảng path tuyệt đối (đã thay hết :param), thử theo đúng thứ tự.
export async function probeCandidates(candidates, { auth = "cms" } = {}) {
  const attempts = [];
  for (const path of candidates) {
    const result = await probeRequest(path, { auth });
    attempts.push({ path, status: result.status, ok: result.ok });
    if (result.ok && looksLikeUsableJson(result.body)) {
      return { found: path, body: result.body, attempts };
    }
  }
  return { found: null, body: null, attempts };
}

function looksLikeUsableJson(body) {
  if (Array.isArray(body)) return true;
  if (body && typeof body === "object") {
    // Nhiều CMS bọc list trong { data: [...] } hoặc { items: [...] }
    return (
      Array.isArray(body.data) ||
      Array.isArray(body.items) ||
      Array.isArray(body.results) ||
      Object.keys(body).length > 0
    );
  }
  return false;
}

/**
 * Sinh danh sách path ứng viên REST-conventional cho quan hệ parent -> children.
 * Ví dụ: guessChildCandidates("books", bookId, "units")
 *   -> ["/books/{id}/units", "/units?bookId={id}", "/book/{id}/units", ...]
 */
export function guessChildCandidates(parentCollection, parentId, childCollection) {
  const singularParent = parentCollection.replace(/s$/, "");
  return [
    `/${parentCollection}/${parentId}/${childCollection}`,
    `/${singularParent}/${parentId}/${childCollection}`,
    `/${childCollection}?${singularParent}Id=${parentId}`,
    `/${childCollection}?${parentCollection}Id=${parentId}`,
    `/${parentCollection}/${parentId}/${childCollection.replace(/s$/, "")}`,
  ];
}

/**
 * Rút ra danh sách item dùng được từ 1 response CMS có shape chưa biết trước
 * (mảng thẳng, hoặc bọc trong data/items/results).
 */
export function extractList(body) {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object") {
    if (Array.isArray(body.data)) return body.data;
    if (Array.isArray(body.items)) return body.items;
    if (Array.isArray(body.results)) return body.results;
  }
  return [];
}
