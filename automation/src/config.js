import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, "..", "..", ".env");

export function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const vars = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

const fileVars = parseEnvFile(ENV_PATH);

function readVar(name) {
  return process.env[name] ?? fileVars[name] ?? "";
}

export const config = {
  appId: readVar("APP_ID"),
  cmsBaseUrl: readVar("CMS_BASE_URL").replace(/\/+$/, ""),
  cmsAccessToken: readVar("CMS_ACCESS_TOKEN"),
  // Optional - chỉ cần khi dùng Runtime (npm run run-e2e, xem bridge/maestroBridge.js) và có
  // NHIỀU thiết bị/emulator cùng kết nối. Để trống thì maestro/adb tự chọn thiết bị duy nhất
  // đang kết nối. Discovery (npm run discover) không dùng biến này - không cần thiết bị.
  deviceId: readVar("DEVICE_ID"),

  // Dùng cho discovery/homeworks.js (GET /api/user/exams/room.json) - hệ thống KHÁC hẳn CMS
  // (host/path/auth khác nhau, xem automation/README.md mục "Bài tập"). Token + cookie hiện chỉ
  // xác nhận hoạt động với tài khoản vai trò "teacher" - CHƯA xác nhận token học sinh thật.
  //
  // Môi trường chọn qua TEACHER_PORTAL_ENV (mặc định "staging") - xem resolveTeacherPortalBaseUrl().
  // SỰ CỐ THẬT (2026-09-08): trước khi có cơ chế này, biến phẳng TEACHER_PORTAL_BASE_URL (không có
  // khái niệm môi trường) khiến `npm run add-class` chạy nhầm lên production dù ý định thật là
  // staging - tạo nhầm 1 lớp thật trên production (đã xoá tay ngay sau đó). KHÔNG đọc lại biến
  // phẳng TEACHER_PORTAL_BASE_URL nữa dù .env còn sót giá trị cũ.
  teacherPortalEnv: (readVar("TEACHER_PORTAL_ENV") || "staging").trim().toLowerCase(),
  teacherPortalUrlsByEnv: {
    dev: readVar("TEACHER_PORTAL_BASE_URL_DEV").replace(/\/+$/, ""),
    staging: readVar("TEACHER_PORTAL_BASE_URL_STAGING").replace(/\/+$/, ""),
    production: readVar("TEACHER_PORTAL_BASE_URL_PRODUCTION").replace(/\/+$/, ""),
  },
  teacherAccessToken: readVar("TEACHER_ACCESS_TOKEN"),
  // Cookie header nguyên văn - ĐÃ XÁC NHẬN THẬT (2026-08-07) KHÔNG bắt buộc: gọi GET
  // /api/user/exams/room.json thành công chỉ với header Authorization (TEACHER_ACCESS_TOKEN lấy
  // qua get_teacher_token.sh -> POST /api/auth/login, role=teacher), đã test bỏ hẳn Cookie. Giữ
  // lại field này chỉ để tương thích với cách lấy tay qua DevTools trước đây, không còn cần thiết.
  teacherSessionCookie: readVar("TEACHER_SESSION_COOKIE"),
  // Dùng bởi giao_bai_tap/navigation/teacherPortalSession.js để đăng nhập THẬT qua form UI
  // (Playwright) - khác TEACHER_ACCESS_TOKEN ở trên (token đó chỉ xác nhận dùng được cho API,
  // CHƯA có bằng chứng web SPA đọc được token đó để coi là đã đăng nhập).
  teacherUsername: readVar("TEACHER_USERNAME"),
  teacherPassword: readVar("TEACHER_PASSWORD"),

  // CMS Quản lý (web admin: /packages, /orders, /students) - KHÁC cmsBaseUrl ở trên (đó là API
  // nội dung bài học/Exam). CMS_ADMIN_ENV chọn 1 trong 3 URL bên dưới - xem resolveCmsAdminBaseUrl().
  // Đăng nhập dùng chung cmsUsername/cmsPassword (CMS_USERNAME/CMS_PASSWORD) - cùng 1 tài khoản
  // admin cho cả 3 môi trường (xác nhận 2026-09-07).
  cmsUsername: readVar("CMS_USERNAME"),
  cmsPassword: readVar("CMS_PASSWORD"),
  cmsAdminEnv: (readVar("CMS_ADMIN_ENV") || "staging").trim().toLowerCase(),
  cmsAdminUrlsByEnv: {
    dev: readVar("CMS_ADMIN_URL_DEV").replace(/\/+$/, ""),
    staging: readVar("CMS_ADMIN_URL_STAGING").replace(/\/+$/, ""),
    production: readVar("CMS_ADMIN_URL_PRODUCTION").replace(/\/+$/, ""),
  },
  // Số điện thoại 1 học sinh CÓ THẬT trên môi trường đang test - dùng bởi
  // quan_ly_goi_dich_vu/runtime/grantCasesFlow.js (nhóm case GRANT-*/DEACT-05, tạo đơn hàng thật
  // gán cho profile này). PHẢI đổi giá trị khi đổi CMS_ADMIN_ENV - mỗi môi trường có dữ liệu học
  // sinh khác nhau, KHÔNG dùng chung số điện thoại giữa dev/staging/production được. Để trống thì
  // nhóm case đó tự SKIP (không giả định Pass/Fail).
  cmsAdminTestStudentPhone: readVar("CMS_ADMIN_TEST_STUDENT_PHONE"),
  // Tên profile con CỤ THỂ cần chọn khi 1 số điện thoại có nhiều profile con - để trống thì
  // grantCasesFlow.js tự chọn profile ĐẦU TIÊN trong dropdown (selectFirstOrderProfileOption).
  cmsAdminTestStudentProfileName: readVar("CMS_ADMIN_TEST_STUDENT_PROFILE_NAME"),
};

/**
 * Trả về base URL của CMS Quản lý (web admin) ứng với CMS_ADMIN_ENV hiện tại (mặc định "staging"
 * nếu không set). Truyền `envOverride` để ép chạy 1 môi trường cụ thể bất kể .env (vd script nhận
 * tham số CLI --env=production) mà không cần đổi file .env.
 *
 * Throw lỗi rõ ràng (liệt kê tên biến .env cần điền) nếu môi trường chưa cấu hình URL, thay vì
 * âm thầm test nhầm môi trường khác hoặc gọi tới URL rỗng.
 */
export function resolveCmsAdminBaseUrl(envOverride) {
  const env = (envOverride || config.cmsAdminEnv || "staging").trim().toLowerCase();
  const known = Object.keys(config.cmsAdminUrlsByEnv);
  if (!known.includes(env)) {
    throw new Error(
      `CMS_ADMIN_ENV="${env}" không hợp lệ - chỉ chấp nhận: ${known.join(" | ")}.`,
    );
  }
  const url = config.cmsAdminUrlsByEnv[env];
  if (!url) {
    const envVarName = `CMS_ADMIN_URL_${env.toUpperCase()}`;
    throw new Error(
      `Thiếu ${envVarName} trong .env (môi trường "${env}" chưa có URL). ` +
        `Điền giá trị vào ${envVarName} rồi thử lại.`,
    );
  }
  return url;
}

/**
 * Trả về base URL của Teacher Portal (web GV) ứng với TEACHER_PORTAL_ENV hiện tại (mặc định
 * "staging"). Truyền `envOverride` để ép chạy 1 môi trường cụ thể bất kể .env. Cùng cơ chế
 * resolveCmsAdminBaseUrl() ở trên - xem ghi chú SỰ CỐ THẬT 2026-09-08 tại field
 * config.teacherPortalEnv để biết lý do hàm này tồn tại (biến phẳng TEACHER_PORTAL_BASE_URL cũ
 * không có khái niệm môi trường, đã gây chạy nhầm production 1 lần thật).
 *
 * Throw lỗi rõ ràng nếu môi trường chưa cấu hình URL, thay vì âm thầm test nhầm môi trường khác.
 */
export function resolveTeacherPortalBaseUrl(envOverride) {
  const env = (envOverride || config.teacherPortalEnv || "staging").trim().toLowerCase();
  const known = Object.keys(config.teacherPortalUrlsByEnv);
  if (!known.includes(env)) {
    throw new Error(
      `TEACHER_PORTAL_ENV="${env}" không hợp lệ - chỉ chấp nhận: ${known.join(" | ")}.`,
    );
  }
  const url = config.teacherPortalUrlsByEnv[env];
  if (!url) {
    const envVarName = `TEACHER_PORTAL_BASE_URL_${env.toUpperCase()}`;
    throw new Error(
      `Thiếu ${envVarName} trong .env (môi trường "${env}" chưa có URL). ` +
        `Điền giá trị vào ${envVarName} rồi thử lại.`,
    );
  }
  return url;
}

// Tính sẵn 1 lần lúc load module - các file gọi thẳng `config.teacherPortalBaseUrl` (vd
// teacherPortalSession.js, deleteClassFlow.js) không cần đổi gì, tự động theo đúng
// TEACHER_PORTAL_ENV. Throw ngay lúc import nếu môi trường mặc định chưa có URL - lỗi lộ ra sớm
// thay vì âm thầm gọi tới chuỗi rỗng.
config.teacherPortalBaseUrl = resolveTeacherPortalBaseUrl();

export function requireCmsConfig() {
  const missing = [];
  if (!config.cmsBaseUrl) missing.push("CMS_BASE_URL");
  if (!config.cmsAccessToken) missing.push("CMS_ACCESS_TOKEN");
  if (missing.length > 0) {
    throw new Error(
      `Thiếu biến môi trường trong .env: ${missing.join(", ")}. ` +
        `Xem automation/README.md để biết cách cấu hình.`,
    );
  }
}

export function requireTeacherPortalConfig() {
  const missing = [];
  if (!config.teacherAccessToken) missing.push("TEACHER_ACCESS_TOKEN");
  if (missing.length > 0) {
    throw new Error(
      `Thiếu biến môi trường trong .env: ${missing.join(", ")}. ` +
        `Xem automation/README.md mục "Bài tập" để biết cách lấy giá trị này.`,
    );
  }
}

/**
 * Validate cấu hình cho CMS Quản lý (web admin /packages, /orders, /students). Gọi trước khi
 * đăng nhập (vd trong cmsAdminSession.js) - resolveCmsAdminBaseUrl() tự throw riêng nếu môi
 * trường chưa có URL, hàm này chỉ kiểm tra phần tài khoản đăng nhập.
 */
export function requireCmsAdminConfig() {
  const missing = [];
  if (!config.cmsUsername) missing.push("CMS_USERNAME");
  if (!config.cmsPassword) missing.push("CMS_PASSWORD");
  if (missing.length > 0) {
    throw new Error(
      `Thiếu biến môi trường trong .env: ${missing.join(", ")}. ` +
        `Xem automation/README.md để biết cách cấu hình.`,
    );
  }
}
