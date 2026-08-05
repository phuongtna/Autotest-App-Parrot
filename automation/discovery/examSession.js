import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = join(__dirname, "..", ".cache", "exam_session.json");

/**
 * Session thật (cookie + localStorage) export từ 1 phiên Chrome ĐÃ đăng nhập và đang xem
 * được câu hỏi thật trên exam.parrotedu.vn - không tự đăng nhập bằng tài khoản/mật khẩu.
 * File này nằm trong automation/.cache/ (đã gitignore), không commit.
 *
 * Format mong đợi (xem automation/README.md mục "Session cho Exam Scraper"):
 * {
 *   "examOrigin": "https://exam.parrotedu.vn",
 *   "cookieHeader": "name1=value1; name2=value2",   // copy từ Request Headers > cookie, có thể để ""
 *   "localStorage": { "access_token": "...", ... }    // copy(JSON.stringify(localStorage)) trên exam.parrotedu.vn
 * }
 */
export function loadExamSession() {
  if (!existsSync(SESSION_FILE)) {
    throw new Error(
      `Chưa có session thật cho Exam Scraper. Tạo file "${SESSION_FILE}" theo hướng dẫn ` +
        `trong automation/README.md (mục "Session cho Exam Scraper") trước khi chạy.`,
    );
  }
  const session = JSON.parse(readFileSync(SESSION_FILE, "utf8"));
  if (!session.examOrigin) {
    throw new Error(`File session thiếu "examOrigin" (vd "https://exam.parrotedu.vn")`);
  }
  return session;
}

/**
 * Parse 1 chuỗi header "cookie:" copy trực tiếp từ DevTools thành mảng cookie object mà
 * Playwright context.addCookies() chấp nhận (chỉ cần name/value/url là đủ để nó tự suy ra
 * domain/path phù hợp).
 */
export function parseCookieHeader(cookieHeader, url) {
  if (!cookieHeader) return [];
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf("=");
      return {
        name: part.slice(0, eq),
        value: part.slice(eq + 1),
        url,
      };
    });
}
