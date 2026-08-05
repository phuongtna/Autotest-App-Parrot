import { execFileSync } from "node:child_process";

/**
 * Chạy 1 CLI executable ngoài (vd "maestro") an toàn trên cả Windows lẫn Unix. ĐÃ XÁC NHẬN
 * THẬT trên Windows (2026-08-05): execFileSync("maestro", ...) báo ENOENT (file không có phần
 * mở rộng, Node không tự dò PATHEXT khi spawn trực tiếp) và execFileSync("maestro.bat", ...)
 * báo EINVAL (Windows không cho spawn .bat/.cmd trực tiếp nếu không qua shell) - chỉ chạy được
 * khi thêm `shell: true` để hệ điều hành tự resolve đúng file thực thi.
 *
 * An toàn dùng `shell: true` ở đây vì args luôn là giá trị NỘI BỘ tự sinh (đường dẫn file tạm
 * do chính process tạo ra, APP_ID/deviceId đọc từ .env của người chạy) - không có chuỗi CMS/dữ
 * liệu ngoài nào lọt trực tiếp vào args, nên không có rủi ro command injection dù không tự
 * escape args.
 */
export function execCliSync(bin, args = [], opts = {}) {
  return execFileSync(bin, args, { ...opts, shell: process.platform === "win32" });
}

/**
 * Sleep ĐỒNG BỘ cross-platform - thay cho execFileSync("sleep", [seconds]) (chỉ tồn tại trên
 * Unix, ĐÃ XÁC NHẬN báo ENOENT thật trên Windows vì không có lệnh "sleep"). Dùng Atomics.wait
 * thay vì spawn 1 tiến trình con nên hoạt động giống nhau trên mọi hệ điều hành.
 * @param {number} seconds
 */
export function sleepSync(seconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.round(seconds * 1000));
}
