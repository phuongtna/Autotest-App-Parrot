import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { teacherPortalPageObjects as po } from "../../../../automation/giao_bai_tap/navigation/teacherPortalPageObjects.js";
import { sourcePageObjects as sel } from "../../../../automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/sourcePageObjects.js";
import { selectPersonalBankClassStably } from "../../../../automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/selectPersonalBankSource.js";

/**
 * TC010 (nguồn: TestCase_GiaoBaiTap_KhoBaiTapCaNhan.xlsx "Nhóm 3", xem TESTCASES.md cùng thư mục):
 * GV CHƯA có bài tập nào trong "Kho bài tập cá nhân" (không phải 1 lớp rỗng trong tài khoản có dữ
 * liệu ở lớp khác như TC015 - mà toàn bộ tài khoản chưa có gì) -> khung "Chọn bài tập" phải hiện
 * rỗng đúng cách, KHÔNG lỗi hệ thống, KHÔNG crash trang.
 *
 * Trước đây case này chưa có tài khoản phù hợp (cần 1 GV hoàn toàn chưa tạo bài nào trong Kho bài
 * tập cá nhân) - đã có tài khoản thật do user cung cấp (2026-09-18), CHỈ ĐỌC - an toàn chạy lặp lại.
 *
 * ENV (BẮT BUỘC, KHÔNG dùng mặc định .env production):
 *   SOURCE_BASE_URL, SOURCE_USERNAME, SOURCE_PASSWORD
 *   SOURCE_EMPTY_ACCOUNT_CLASS - tên lớp DUY NHẤT của tài khoản này (tài khoản hoàn toàn chưa có
 *     dữ liệu Kho bài tập cá nhân ở BẤT KỲ lớp nào)
 */
function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} (xem docblock đầu file).`);
  }
  return value;
}

test.describe("Giao bài tập > Kho bài tập cá nhân > GV chưa có bài tập nào trong kho (TC010)", () => {
  const BASE_URL = readRequiredEnv("SOURCE_BASE_URL");
  const USERNAME = readRequiredEnv("SOURCE_USERNAME");
  const PASSWORD = readRequiredEnv("SOURCE_PASSWORD");
  const EMPTY_ACCOUNT_CLASS = readRequiredEnv("SOURCE_EMPTY_ACCOUNT_CLASS");

  let context;
  let page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto(`${BASE_URL}${po.login.path}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.locator(po.login.usernameInput).first().fill(USERNAME);
    await page.locator(po.login.passwordInput).first().fill(PASSWORD);
    await page.getByRole("button", { name: po.login.submitButton }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test("TC010: chọn Kho bài tập cá nhân trên tài khoản chưa có dữ liệu -> rỗng đúng cách, không lỗi", async () => {
    await page.goto(`${BASE_URL}/teacher/exercise`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: po.menu.createButton, exact: true }).click();

    await selectPersonalBankClassStably(page, EMPTY_ACCOUNT_CLASS);

    // "Chọn Unit" phải hiện được (không kẹt ở placeholder "chọn lớp trước") nhưng KHÔNG có option
    // nào - khác cơ chế với TC015 (lớp rỗng NHƯNG Unit vẫn còn cho lớp khác trong CÙNG tài khoản);
    // ở đây toàn bộ tài khoản chưa có Unit/Lesson/item nào.
    await expect(page.getByText(sel.chooseUnitLabel, { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Chưa có lesson nào", { exact: false })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button[role="checkbox"][id^="lesson-item-"]')).toHaveCount(0);

    // Không lỗi hệ thống / không trắng trang - nút submit vẫn còn, form vẫn dùng được.
    await expect(page.getByRole("button", { name: po.submit.button })).toBeVisible();
    await expect(page.getByText(sel.personalBankOptionText, { exact: true })).toBeVisible();
  });
});
