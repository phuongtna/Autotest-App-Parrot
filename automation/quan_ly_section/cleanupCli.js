#!/usr/bin/env node
import { loginCmsAdmin } from "./navigation/cmsSectionSession.js";
import {
  gotoSections,
  setPageSize,
  readAllSectionNamesInOrder,
  deleteSectionByName,
  searchSections,
} from "./navigation/cmsSectionPageObjects.js";

/**
 * Entrypoint `npm run cleanup-quan-ly-section` - xóa các Section do automation tự tạo trong lúc
 * chạy `.spec.js` (tiền tố tên `AUTO-`, bao gồm cả `AUTOPG-` của `section-pagination.spec.js`) -
 * KHÔNG đụng section thật có sẵn trên môi trường. Dùng khi 1 lần chạy test bị ngắt giữa chừng
 * (Ctrl+C, lỗi mạng...) khiến `afterAll` không kịp dọn dẹp - cùng quy ước với
 * `quan_ly_goi_dich_vu/cleanupCli.js`.
 *
 * Chạy (mặc định env "dev" - môi trường duy nhất module này test tới):
 *   cd automation
 *   npm run cleanup-quan-ly-section
 *   npm run cleanup-quan-ly-section -- --env=staging   # nếu sau này mở rộng sang môi trường khác
 */

const PREFIX = "AUTO";

async function main() {
  const envOverride = process.argv.slice(2).find((a) => a.startsWith("--env="))?.split("=")[1] || "dev";
  const headless = process.env.CMS_ADMIN_HEADLESS !== "false";

  const { browser, page, baseUrl } = await loginCmsAdmin({ headless, envOverride });
  console.log("Đăng nhập CMS Admin thành công:", baseUrl);

  const deleted = [];
  const failed = [];
  try {
    await gotoSections(page, baseUrl);
    await searchSections(page, PREFIX);
    await setPageSize(page, 100);

    for (let guard = 0; guard < 500; guard += 1) {
      const names = await readAllSectionNamesInOrder(page);
      const target = names.find((n) => n.startsWith(PREFIX));
      if (!target) break;
      try {
        await deleteSectionByName(page, target);
        deleted.push(target);
        console.log("Đã xóa:", target);
      } catch (err) {
        failed.push({ name: target, error: err.message });
        console.error("Lỗi xóa", target, "-", err.message);
        break;
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
