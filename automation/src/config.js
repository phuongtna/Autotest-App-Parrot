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
  teacherPortalBaseUrl: (readVar("TEACHER_PORTAL_BASE_URL") || "https://parrotedu.vn").replace(
    /\/+$/,
    "",
  ),
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
};

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
