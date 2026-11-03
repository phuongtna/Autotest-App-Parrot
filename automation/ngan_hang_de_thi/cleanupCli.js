#!/usr/bin/env node
import { loginCmsAdmin } from "./navigation/cmsDeThiSession.js";
import { gotoDeThi, searchDeThi, setPageSize, readAllExamNamesInOrder, deleteDeThiByName } from "./navigation/cmsDeThiPageObjects.js";
import { gotoKyThi, searchKyThi, readAllKyThiNamesInOrder, deleteKyThiByName } from "../quan_ly_ky_thi/navigation/cmsKyThiPageObjects.js";
import { gotoSections, searchSections, readAllSectionNamesInOrder, deleteSectionByName } from "../quan_ly_section/navigation/cmsSectionPageObjects.js";
import { gotoScoreTables, searchScoreTables, readAllScoreTableNamesInOrder, deleteScoreTableByName } from "../cau_hinh_bang_diem/navigation/cmsScoreTablePageObjects.js";

/**
 * Entrypoint `npm run cleanup-ngan-hang-de-thi` - xóa toàn bộ dữ liệu do automation tự tạo khi
 * chạy `.spec.js` của module Ngân hàng đề thi (tiền tố `AUTO-`), BAO GỒM cả Đề thi lẫn các fixture
 * Kỳ thi/Section/Bảng điểm dựng riêng cho module này (`setupDeThiFixtures`) - PHẢI xóa Đề thi
 * TRƯỚC (Kỳ thi/Section/Bảng điểm bị chặn xóa khi còn đang được Đề thi tham chiếu). Dùng khi 1 lần
 * chạy test bị ngắt giữa chừng khiến `afterAll` không kịp dọn - cùng quy ước với
 * `quan_ly_ky_thi/cleanupCli.js`.
 *
 * Chạy (mặc định env "dev" - môi trường duy nhất module này test tới):
 *   cd automation
 *   npm run cleanup-ngan-hang-de-thi
 */

const PREFIX = "AUTO";

async function main() {
  const envOverride = process.argv.slice(2).find((a) => a.startsWith("--env="))?.split("=")[1] || "dev";
  const headless = process.env.CMS_ADMIN_HEADLESS !== "false";

  const { browser, page, baseUrl } = await loginCmsAdmin({ headless, envOverride });
  console.log("Đăng nhập CMS Admin thành công:", baseUrl);

  const deleted = { deThi: [], kyThi: [], section: [], scoreTable: [] };
  const failed = [];

  try {
    await gotoDeThi(page, baseUrl);
    await searchDeThi(page, PREFIX);
    await setPageSize(page, 100);
    for (let guard = 0; guard < 500; guard += 1) {
      const names = await readAllExamNamesInOrder(page);
      const target = names.find((n) => n.startsWith(PREFIX));
      if (!target) break;
      try {
        await deleteDeThiByName(page, target);
        deleted.deThi.push(target);
        console.log("Đã xóa đề thi:", target);
      } catch (err) {
        failed.push({ type: "deThi", name: target, error: err.message });
        break;
      }
    }

    await gotoKyThi(page, baseUrl);
    await searchKyThi(page, PREFIX);
    await setPageSize(page, 100);
    for (let guard = 0; guard < 500; guard += 1) {
      const names = await readAllKyThiNamesInOrder(page);
      const target = names.find((n) => n.startsWith(PREFIX));
      if (!target) break;
      try {
        await deleteKyThiByName(page, target);
        deleted.kyThi.push(target);
        console.log("Đã xóa kỳ thi:", target);
      } catch (err) {
        failed.push({ type: "kyThi", name: target, error: err.message });
        break;
      }
    }

    await gotoSections(page, baseUrl);
    await searchSections(page, PREFIX);
    await setPageSize(page, 100);
    for (let guard = 0; guard < 500; guard += 1) {
      const names = await readAllSectionNamesInOrder(page);
      const target = names.find((n) => n.startsWith(PREFIX));
      if (!target) break;
      try {
        await deleteSectionByName(page, target);
        deleted.section.push(target);
        console.log("Đã xóa section:", target);
      } catch (err) {
        failed.push({ type: "section", name: target, error: err.message });
        break;
      }
    }

    await gotoScoreTables(page, baseUrl);
    await searchScoreTables(page, PREFIX);
    await setPageSize(page, 100);
    for (let guard = 0; guard < 500; guard += 1) {
      const names = await readAllScoreTableNamesInOrder(page);
      const target = names.find((n) => n.startsWith(PREFIX));
      if (!target) break;
      try {
        await deleteScoreTableByName(page, target);
        deleted.scoreTable.push(target);
        console.log("Đã xóa bảng điểm:", target);
      } catch (err) {
        failed.push({ type: "scoreTable", name: target, error: err.message });
        break;
      }
    }
  } finally {
    await browser.close();
  }

  const total = deleted.deThi.length + deleted.kyThi.length + deleted.section.length + deleted.scoreTable.length;
  console.log(
    `\nTổng đã xóa: ${total} (đề thi: ${deleted.deThi.length}, kỳ thi: ${deleted.kyThi.length}, section: ${deleted.section.length}, bảng điểm: ${deleted.scoreTable.length})${failed.length ? `, lỗi: ${failed.length}` : ""}`,
  );
  process.exitCode = failed.length > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error("LỖI:", err);
  process.exitCode = 1;
});
