import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, "..", ".cache");
const CACHE_FILE = join(CACHE_DIR, "exam_token.json");

let memoryCache = null;

function readFileCache() {
  if (!existsSync(CACHE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return null;
  }
}

function writeFileCache(entry) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(entry, null, 2), "utf8");
}

// Exam Token không rõ thời hạn thật - không có "expiresAt" xác nhận từ CMS nên coi cache
// chỉ hợp lệ trong phạm vi 1 process (memoryCache). File cache chỉ để debug/tái sử dụng
// nhanh giữa các lần chạy `npm run discover` liên tiếp trong cùng phiên làm việc; bất kỳ
// lỗi 401 nào khi dùng token cũ đều phải fetch lại (xem cmsClient.js).
export function getCachedExamToken() {
  if (memoryCache) return memoryCache;
  const fromFile = readFileCache();
  if (fromFile) {
    memoryCache = fromFile.token;
    return memoryCache;
  }
  return null;
}

export function setCachedExamToken(token) {
  memoryCache = token;
  writeFileCache({ token, fetchedAt: new Date().toISOString() });
}

export function clearCachedExamToken() {
  memoryCache = null;
}
