#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loginCmsAdmin } from "./navigation/cmsAdminSession.js";
import { runPackageCasesFlow } from "./runtime/packageCasesFlow.js";
import { runGrantCasesFlow } from "./runtime/grantCasesFlow.js";
import { config } from "../src/config.js";

/**
 * Entrypoint `npm run test-goi-dich-vu` - chạy TOÀN BỘ case ĐÃ PASS của bộ "Quản lý gói dịch vụ"
 * (UI-01..06, SAVE-01..05, DEACT-01..05, ORDER-01..04, FIELD-01, REG-01..03, GRANT-01..08/12) trên
 * 1 môi trường CMS Admin cụ thể (dev/staging/production).
 *
 * Chọn môi trường - dùng 1 trong 2 cách (không cần sửa code khi đổi môi trường):
 *   CMS_ADMIN_ENV=production npm run test-goi-dich-vu
 *   npm run test-goi-dich-vu -- --env=production
 * Không truyền gì thì dùng CMS_ADMIN_ENV trong .env (mặc định "staging").
 *
 * Tham số khác:
 *   CMS_ADMIN_HEADLESS=false npm run test-goi-dich-vu   # xem browser thật (mặc định headless)
 *
 * GRANT nhóm, DEACT-05 cần CMS_ADMIN_TEST_STUDENT_PHONE (1 học sinh CÓ THẬT trên môi trường đang
 * chạy) - thiếu thì tự SKIP nhóm đó, không giả định Pass/Fail. GRANT-07 (chờ 24h) luôn SKIP - xem
 * lý do trong report. GRANT-09 (Blocked)/GRANT-10/11 (Exploratory, chưa có rule chính thức) không
 * thuộc phạm vi "case đã Pass" nên không có trong danh sách trên.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");

function parseEnvArg() {
  const arg = process.argv.slice(2).find((a) => a.startsWith("--env="));
  return arg ? arg.split("=")[1] : undefined;
}

function printReport(results) {
  console.log("\n=== KẾT QUẢ ===");
  for (const r of results) {
    const label = r.pass === true ? "PASS" : r.pass === false ? "FAIL" : "SKIP";
    const suffix = r.detail ? ` (${r.detail})` : "";
    console.log(`[${label}] ${r.id} - ${r.description}${suffix}`);
  }
  const passCount = results.filter((r) => r.pass === true).length;
  const failCount = results.filter((r) => r.pass === false).length;
  const skipCount = results.filter((r) => r.pass === null).length;
  console.log(`\nTổng: ${results.length} | Pass: ${passCount} | Fail: ${failCount} | Skip: ${skipCount}`);
  return { passCount, failCount, skipCount };
}

async function main() {
  const envOverride = parseEnvArg();
  const headless = process.env.CMS_ADMIN_HEADLESS !== "false";
  const runId = Date.now().toString(36);
  const envLabel = envOverride || config.cmsAdminEnv;

  console.log(`=== Chạy case "Quản lý gói dịch vụ" (đã Pass) - môi trường: ${envLabel} - runId: ${runId} ===`);

  const { browser, page, baseUrl } = await loginCmsAdmin({ headless, envOverride });
  console.log("Đăng nhập CMS Admin thành công:", baseUrl);

  let allResults = [];
  try {
    const packageOutcome = await runPackageCasesFlow(page, baseUrl, { runId });
    allResults = allResults.concat(packageOutcome.results);

    const grantOutcome = await runGrantCasesFlow(page, baseUrl, {
      defaultPackageName: packageOutcome.defaultPackageName,
      ownPackages: packageOutcome.ownPackages,
      studentPhone: config.cmsAdminTestStudentPhone,
    });
    allResults = allResults.concat(grantOutcome.results);
  } finally {
    await browser.close();
  }

  const { failCount } = printReport(allResults);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const reportPath = join(OUTPUT_DIR, `goi_dich_vu_report_${runId}.json`);
  writeFileSync(
    reportPath,
    JSON.stringify({ env: envLabel, baseUrl, runId, generatedAt: new Date().toISOString(), results: allResults }, null, 2),
  );
  console.log("Report JSON:", reportPath);

  process.exitCode = failCount > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error("LỖI:", err);
  process.exitCode = 1;
});
