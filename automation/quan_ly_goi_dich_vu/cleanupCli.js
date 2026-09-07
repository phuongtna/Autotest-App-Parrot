#!/usr/bin/env node
import { loginCmsAdmin } from "./navigation/cmsAdminSession.js";
import {
  gotoPackages,
  setPageSize,
  readAllPackageNames,
  deletePackageByName,
} from "./navigation/cmsAdminPageObjects.js";

/**
 * Entrypoint `npm run cleanup-goi-dich-vu` - xóa các gói dịch vụ do automation/thao tác tay TỰ TẠO
 * trong lúc viết/test module này (tiền tố tên bắt đầu bằng `AUTO-`, hoặc tên khớp CHÍNH XÁC danh
 * sách `EXTRA_NAMES` bên dưới) - KHÔNG đụng tới gói thật/gói có sẵn trước đó trên môi trường.
 *
 * Chạy (ví dụ):
 *   cd automation
 *   CMS_ADMIN_ENV=staging npm run cleanup-goi-dich-vu
 */

const AUTO_PREFIX = "AUTO-";
// Gói tạo tay lúc chạy 40 testcase thủ công (2026-09-07, TRƯỚC khi có automation) - không theo
// tiền tố AUTO- vì đặt tên trước khi quy ước này tồn tại, liệt kê đích danh để xóa luôn thể.
const EXTRA_NAMES = ["Gói dùng thử RE-01", "Gói dùng thử RE-02", "Gói dùng thử RE-03"];

async function main() {
  const envOverride = process.argv.slice(2).find((a) => a.startsWith("--env="))?.split("=")[1];
  const headless = process.env.CMS_ADMIN_HEADLESS !== "false";

  const { browser, page, baseUrl } = await loginCmsAdmin({ headless, envOverride });
  console.log("Đăng nhập CMS Admin thành công:", baseUrl);

  const deleted = [];
  const failed = [];
  try {
    await gotoPackages(page, baseUrl);
    await setPageSize(page, 100);

    // Xóa từng cái một, đọc lại danh sách sau mỗi lần xóa (vị trí dòng dịch chuyển) - lặp tới khi
    // không còn tên nào khớp điều kiện xóa.
    for (let guard = 0; guard < 200; guard += 1) {
      const names = await readAllPackageNames(page);
      const target = names.find((n) => n.startsWith(AUTO_PREFIX) || EXTRA_NAMES.includes(n));
      if (!target) break;
      try {
        await deletePackageByName(page, target);
        deleted.push(target);
        console.log("Đã xóa:", target);
      } catch (err) {
        failed.push({ name: target, error: err.message });
        console.error("Lỗi xóa", target, "-", err.message);
        break; // tránh lặp vô hạn nếu 1 tên nào đó xóa mãi không được
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\nTổng đã xóa: ${deleted.length}${failed.length ? `, lỗi: ${failed.length}` : ""}`);
  process.exitCode = failed.length > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error("LỖI:", err);
  process.exitCode = 1;
});
