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
  // Optional - chỉ cần khi dùng unitStatusProbe.js (đọc trạng thái Hoàn thành trên app thật).
  // Để trống thì maestro/adb tự chọn thiết bị duy nhất đang kết nối.
  deviceId: readVar("DEVICE_ID"),
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
