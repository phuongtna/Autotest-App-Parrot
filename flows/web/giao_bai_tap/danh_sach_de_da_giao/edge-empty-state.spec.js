import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { teacherPortalPageObjects as teacherPo } from "../../../../automation/giao_bai_tap/navigation/teacherPortalPageObjects.js";
import { listClassFilterOptions } from "../../../../automation/giao_bai_tap/navigation/teacherAssignedListPageObjects.js";
import {
  gotoPracticeTestList,
  realDataRows,
  practiceTestListPageObjects as po,
  resolvePracticeTestDevCredentials,
} from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestListPageObjects.js";

/**
 * Playwright Test THẬT cho nhóm "10. Trường hợp đặc biệt" (EDGE-01, TESTCASES.xlsx tab "Giao đề
 * luyện tập") - chuyển thể 1:1 từ runtime/edgeEmptyStateFlow.js. CHỈ ĐỌC.
 *
 * Case này cần 1 tài khoản GV CHƯA TỪNG giao đề luyện tập nào. Tài khoản DEV mặc định ("Phương",
 * xem resolvePracticeTestDevCredentials()) ĐÃ CÓ sẵn hàng chục đề luyện tập thật - KHÔNG dùng được.
 * Test tự kiểm tra điều kiện tiên quyết (0 dòng) trước khi assert, SKIP rõ ràng nếu không thỏa (
 * KHÔNG tự xóa dữ liệu thật của tài khoản khác để ép rỗng).
 *
 * Truyền EDGE_BASE_URL/EDGE_USERNAME/EDGE_PASSWORD để chạy với 1 tài khoản GV khác CHƯA từng giao
 * đề luyện tập nào - không truyền thì luôn SKIP với tài khoản mặc định.
 */
test.describe('"Giao đề luyện tập" > Trường hợp đặc biệt (EDGE-01)', () => {
  let context;
  let page;
  let username;

  test.beforeAll(async ({ browser }) => {
    const devCreds = resolvePracticeTestDevCredentials();
    const baseUrl = process.env.EDGE_BASE_URL || devCreds.baseUrl;
    username = process.env.EDGE_USERNAME || devCreds.username;
    const password = process.env.EDGE_PASSWORD || devCreds.password;

    context = await browser.newContext();
    page = await context.newPage();
    await page.goto(`${baseUrl}${teacherPo.login.path}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.locator(teacherPo.login.usernameInput).first().fill(username);
    await page.locator(teacherPo.login.passwordInput).first().fill(password);
    await page.getByRole("button", { name: teacherPo.login.submitButton }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test("EDGE-01: màn hình khi GV chưa giao đề luyện tập nào", async () => {
    await gotoPracticeTestList(page);
    const realRowCount = await realDataRows(page).count();
    test.skip(
      realRowCount > 0,
      `Tài khoản GV đang dùng ("${username}") hiện CÓ ${realRowCount} đề luyện tập thật - KHÔNG thỏa điều kiện tiên quyết "chưa giao đề luyện tập nào". Truyền EDGE_BASE_URL/EDGE_USERNAME/EDGE_PASSWORD để chạy với tài khoản khác.`,
    );

    await expect(page.getByText(po.listHeadingPrefix, { exact: false }).first()).toContainText("(0)");
    const classOptions = await listClassFilterOptions(page);
    expect(classOptions.length, "Dropdown lọc lớp rỗng ngay cả khi tài khoản vẫn đang phụ trách lớp.").toBeGreaterThan(0);
  });
});
