import { callEndpoint, probeRequest, CmsApiError } from "./cmsClient.js";
import { endpoints } from "./endpoints.js";
import { extractList, guessChildCandidates, probeCandidates } from "./endpointProbe.js";
import { requireCmsConfig } from "../src/config.js";

function unwrapEntity(body) {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    if (body.data && typeof body.data === "object" && !Array.isArray(body.data)) {
      return body.data;
    }
    return body;
  }
  return body;
}

/**
 * Helper dùng chung cho units/lessons/lessonItems (list phụ thuộc 1 parent): gọi endpoint
 * đã khai báo trong endpoints.js; nếu endpoint đó chưa "confirmed" và request thất bại
 * (path suy đoán sai), tự thử các path ứng viên REST-conventional (endpointProbe.js)
 * trước khi báo lỗi hẳn.
 *
 * Không cache kết quả probe vào endpoints.js tự động (tránh ghi đè ngầm) - chỉ log ra
 * console để người dùng xác nhận rồi tự cập nhật endpoints.js.
 */
export async function fetchChildListWithFallback({
  endpointKey,
  params,
  parentCollection,
  parentId,
  childCollection,
}) {
  requireCmsConfig();
  const endpointDef = endpoints[endpointKey];
  try {
    const body = await callEndpoint(endpointKey, params);
    const list = extractList(body) ?? (Array.isArray(body) ? body : []);
    if (list.length > 0 || endpointDef.confirmed) {
      return list;
    }
    throw new CmsApiError("Danh sách rỗng từ endpoint chưa xác nhận, thử probe thêm", {});
  } catch (err) {
    if (endpointDef.confirmed) throw err;

    console.warn(
      `[discovery] Endpoint "${endpointKey}" (${endpointDef.path}) suy đoán chưa đúng ` +
        `(${err.message}). Đang thử tự dò path khác...`,
    );
    const candidates = guessChildCandidates(parentCollection, parentId, childCollection);
    const probe = await probeCandidates(candidates, { auth: endpointDef.auth });
    if (probe.found) {
      console.warn(
        `[discovery] Tìm thấy path hoạt động: ${probe.found} - hãy cập nhật endpoints.js ` +
          `("${endpointKey}") thành path này (thay ID thật bằng :param tương ứng).`,
      );
      return extractList(probe.body);
    }
    throw new CmsApiError(
      `Không tìm được endpoint hợp lệ cho "${endpointKey}". Đã thử: ${endpointDef.path} và ` +
        `${candidates.length} path suy đoán khác. Cần curl/response mẫu thật để xác định đúng path.`,
      { attempts: probe.attempts },
    );
  }
}

/**
 * Helper cho list gốc không phụ thuộc parent (hiện chỉ có Books). Nếu path suy đoán trong
 * endpoints.js sai, thử vài biến thể đơn giản (số ít/nhiều, có/không prefix) thay vì suy
 * luận theo quan hệ cha-con.
 */
export async function fetchRootListWithFallback({ endpointKey, rootCandidates }) {
  requireCmsConfig();
  const endpointDef = endpoints[endpointKey];
  try {
    const body = await callEndpoint(endpointKey, {});
    const list = extractList(body) ?? (Array.isArray(body) ? body : []);
    if (list.length > 0 || endpointDef.confirmed) {
      return list;
    }
    throw new CmsApiError("Danh sách rỗng từ endpoint chưa xác nhận, thử probe thêm", {});
  } catch (err) {
    if (endpointDef.confirmed) throw err;

    console.warn(
      `[discovery] Endpoint "${endpointKey}" (${endpointDef.path}) suy đoán chưa đúng ` +
        `(${err.message}). Đang thử tự dò path khác...`,
    );
    const probe = await probeCandidates(rootCandidates, { auth: endpointDef.auth });
    if (probe.found) {
      console.warn(
        `[discovery] Tìm thấy path hoạt động: ${probe.found} - hãy cập nhật endpoints.js ` +
          `("${endpointKey}") thành path này.`,
      );
      return extractList(probe.body);
    }
    throw new CmsApiError(
      `Không tìm được endpoint hợp lệ cho "${endpointKey}". Đã thử: ${endpointDef.path} và ` +
        `${rootCandidates.length} path suy đoán khác. Cần curl/response mẫu thật để xác định đúng path.`,
      { attempts: probe.attempts },
    );
  }
}

/**
 * Helper cho endpoint trả về 1 entity đơn (không phải list) - vd Exam của 1 Exercise, hoặc
 * chi tiết đầy đủ của 1 Lesson Item. Cùng cơ chế fallback probe như trên, nhưng chấp nhận
 * kết quả là object thay vì mảng.
 */
export async function fetchEntityWithFallback({ endpointKey, params, candidates }) {
  requireCmsConfig();
  const endpointDef = endpoints[endpointKey];
  try {
    const body = await callEndpoint(endpointKey, params);
    const entity = unwrapEntity(body);
    if (entity && Object.keys(entity).length > 0) {
      return entity;
    }
    throw new CmsApiError("Response rỗng từ endpoint chưa xác nhận, thử probe thêm", {});
  } catch (err) {
    if (endpointDef.confirmed) throw err;

    console.warn(
      `[discovery] Endpoint "${endpointKey}" (${endpointDef.path}) suy đoán chưa đúng ` +
        `(${err.message}). Đang thử tự dò path khác...`,
    );
    for (const path of candidates) {
      const result = await probeRequest(path, { auth: endpointDef.auth });
      if (result.ok) {
        const entity = unwrapEntity(result.body);
        if (entity && Object.keys(entity).length > 0) {
          console.warn(
            `[discovery] Tìm thấy path hoạt động: ${path} - hãy cập nhật endpoints.js ` +
              `("${endpointKey}") thành path này (thay ID thật bằng :param tương ứng).`,
          );
          return entity;
        }
      }
    }
    throw new CmsApiError(
      `Không tìm được endpoint hợp lệ cho "${endpointKey}". Đã thử: ${endpointDef.path} và ` +
        `${candidates.length} path suy đoán khác. Cần curl/response mẫu thật để xác định đúng path.`,
      {},
    );
  }
}
