import { defineConfig } from "@playwright/test";

/**
 * Config cho Playwright Test - CHỈ dùng bởi các file `*.spec.js` trong
 * `../flows/cms/goi_dich_vu/` (test CMS Quản lý chạy thật trên dev/staging/production qua
 * `resolveCmsAdminBaseUrl()`, KHÔNG phải local dev server nên không cần `webServer`). File test
 * đặt ở `flows/` (không phải `automation/`) - cùng quy ước với `flows/web/giao_bai_tap/*.mjs`:
 * `automation/quan_ly_goi_dich_vu/` chỉ chứa code dùng lại (page objects/session), không chứa test
 * entrypoint.
 *
 * `workers: 1` + `fullyParallel: false` - BẮT BUỘC: các case trong 1 file `.spec.js` phụ thuộc
 * trạng thái lẫn nhau theo đúng thứ tự (`test.describe.serial`), chạy song song sẽ phá dữ liệu của
 * nhau (vd 2 file cùng sửa 1 gói dịch vụ). Chạy: `npx playwright test` (từ thư mục `automation/`).
 */
export default defineConfig({
  testDir: "../flows/cms/goi_dich_vu",
  testMatch: "**/*.spec.js",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"], ["html", { outputFolder: "output/playwright-report", open: "never" }]],
  use: {
    headless: process.env.CMS_ADMIN_HEADLESS !== "false",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
