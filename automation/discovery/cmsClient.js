import { config, requireCmsConfig } from "../src/config.js";
import { buildPath } from "./endpoints.js";
import { getCachedExamToken, setCachedExamToken, clearCachedExamToken } from "./examToken.js";

class CmsApiError extends Error {
  constructor(message, { status, url, body } = {}) {
    super(message);
    this.name = "CmsApiError";
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

async function rawRequest(method, url, token) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

async function fetchExamToken() {
  requireCmsConfig();
  const { method, path } = buildPath("examToken");
  const url = `${config.cmsBaseUrl}${path}`;
  const result = await rawRequest(method, url, config.cmsAccessToken);
  if (!result.ok) {
    throw new CmsApiError(
      `Không lấy được Exam Token từ ${url} (status ${result.status}). Kiểm tra lại CMS_ACCESS_TOKEN trong .env.`,
      { status: result.status, url, body: result.body },
    );
  }
  // Chưa biết field thật chứa token trong response (vd "token" / "examToken" / "accessToken").
  // Thử vài tên phổ biến - khi có response mẫu thật sẽ chốt lại đúng field này.
  const token =
    result.body?.token ??
    result.body?.examToken ??
    result.body?.accessToken ??
    result.body?.data?.token ??
    result.body?.data?.examToken;
  if (!token) {
    throw new CmsApiError(
      `Gọi ${url} thành công nhưng không tìm thấy field token trong response. ` +
        `Response thật: ${JSON.stringify(result.body)} - cần cập nhật lại cách đọc field trong examToken().`,
      { status: result.status, url, body: result.body },
    );
  }
  return token;
}

async function getExamToken({ forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cached = getCachedExamToken();
    if (cached) return cached;
  }
  const token = await fetchExamToken();
  setCachedExamToken(token);
  return token;
}

/**
 * Gọi 1 endpoint đã khai báo trong endpoints.js. Tự gắn đúng loại token (cms/exam) và tự
 * refresh + gọi lại 1 lần nếu Exam Token bị 401 (hết hạn).
 */
export async function callEndpoint(endpointKey, params = {}) {
  requireCmsConfig();
  const endpoint = buildPath(endpointKey, params);
  const url = `${config.cmsBaseUrl}${endpoint.path}`;

  const token =
    endpoint.auth === "exam" ? await getExamToken() : config.cmsAccessToken;

  let result = await rawRequest(endpoint.method, url, token);

  if (!result.ok && result.status === 401 && endpoint.auth === "exam") {
    clearCachedExamToken();
    const freshToken = await getExamToken({ forceRefresh: true });
    result = await rawRequest(endpoint.method, url, freshToken);
  }

  if (!result.ok) {
    throw new CmsApiError(
      `${endpoint.method} ${url} trả về status ${result.status}`,
      { status: result.status, url, body: result.body },
    );
  }

  return result.body;
}

/**
 * Gọi thẳng 1 path tuỳ ý (dùng cho endpointProbe.js khi thử các path ứng viên chưa có
 * trong endpoints.js). Trả về { ok, status, body } thay vì throw, để bên gọi tự quyết định
 * ứng viên nào hợp lệ.
 */
export async function probeRequest(path, { auth = "cms" } = {}) {
  requireCmsConfig();
  const url = `${config.cmsBaseUrl}${path}`;
  const token = auth === "exam" ? await getExamToken() : config.cmsAccessToken;
  try {
    const result = await rawRequest("GET", url, token);
    return { ...result, url };
  } catch (err) {
    return { ok: false, status: 0, body: String(err), url };
  }
}

export { CmsApiError };
