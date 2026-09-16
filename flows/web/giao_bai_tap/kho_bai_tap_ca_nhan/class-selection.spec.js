import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { teacherPortalPageObjects as po } from "../../../../automation/giao_bai_tap/navigation/teacherPortalPageObjects.js";
import { sourcePageObjects as sel } from "../../../../automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/sourcePageObjects.js";

/**
 * TC013/014/015/016 (nguồn: TestCase_GiaoBaiTap_KhoBaiTapCaNhan.xlsx "4. Kết hợp lựa chọn Lớp",
 * xem TESTCASES.md cùng thư mục). CHỈ ĐỌC - không tạo/sửa/xóa dữ liệu nào, an toàn chạy lặp lại.
 *
 * ENV (BẮT BUỘC, KHÔNG dùng mặc định .env production):
 *   SOURCE_BASE_URL, SOURCE_USERNAME, SOURCE_PASSWORD
 *   SOURCE_PERSONAL_BANK_CLASS - lớp CÓ dữ liệu Kho bài tập cá nhân (vd "11A2")
 *   SOURCE_EMPTY_CLASS - lớp KHÔNG có dữ liệu Kho bài tập cá nhân, thuộc cùng tài khoản (vd "3E")
 */
function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} (xem docblock đầu file).`);
  }
  return value;
}

test.describe.serial("Giao bài tập > Kết hợp lựa chọn Lớp ở Kho bài tập cá nhân (TC013/014/015/016)", () => {
  const BASE_URL = readRequiredEnv("SOURCE_BASE_URL");
  const USERNAME = readRequiredEnv("SOURCE_USERNAME");
  const PASSWORD = readRequiredEnv("SOURCE_PASSWORD");
  const DATA_CLASS = readRequiredEnv("SOURCE_PERSONAL_BANK_CLASS");
  const EMPTY_CLASS = readRequiredEnv("SOURCE_EMPTY_CLASS");

  let context;
  let page;

  // BUG THẬT ĐÃ XÁC NHẬN (2026-09-16, xem docblock selectPersonalBankSource.js): bấm 1 checkbox
  // Lớp có thể làm radio "Kho bài tập cá nhân" ÂM THẦM revert về lại "Bộ sách Kết nối tri thức".
  // File này liên tục bật/tắt nhiều Lớp (TC013/014/015) nên không dùng thẳng
  // `selectPersonalBankClassStably` (chỉ hợp cho lần CHỌN đầu tiên) - verify + re-click radio nếu
  // cần NGAY SAU MỖI lần đổi Lớp.
  async function clickClassLabel(className) {
    await page.getByText(className, { exact: false }).first().click();
    await page.waitForTimeout(400);

    const personalBankRadio = page.locator(sel.personalBankRadioSelector);
    const reverted = !(await personalBankRadio.isChecked().catch(() => false));
    if (reverted) {
      await personalBankRadio.click();
      await page.waitForTimeout(400);
      const recovered = await personalBankRadio.isChecked().catch(() => false);
      expect(recovered, 'Radio "Kho bài tập cá nhân" bị revert sau khi đổi Lớp và không phục hồi lại được.').toBe(
        true,
      );
    }
  }

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

  test("TC016: danh sách Lớp phụ trách giống nhau ở cả 2 Nguồn bài tập", async () => {
    await page.goto(`${BASE_URL}/teacher/exercise`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: po.menu.createButton, exact: true }).click();

    const readClassLabels = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('input[type="checkbox"]'))
          .map((cb) => cb.closest("label")?.innerText?.trim())
          .filter(Boolean),
      );

    // Nguồn mặc định (Bộ sách Kết nối tri thức) đã chọn sẵn khi vừa mở form - chờ checkbox lớp
    // đầu tiên render xong (fetch async) trước khi đọc, tránh đọc quá sớm ra mảng rỗng. Input
    // checkbox thật bị ẩn qua CSS ("peer hidden" - style qua label, xem comment "Giao tới lớp" ở
    // teacherPortalPageObjects.js) nên không dùng `.toBeVisible()` trên input, chờ theo COUNT.
    await expect
      .poll(() => page.locator('input[type="checkbox"]').count(), { timeout: 10000 })
      .toBeGreaterThan(0);
    const classesOnBookSet = await readClassLabels();

    const personalBankRadio = page.locator(sel.personalBankRadioSelector);
    let personalBankChecked = false;
    for (let attempt = 1; attempt <= 3 && !personalBankChecked; attempt++) {
      await personalBankRadio.click();
      await page.waitForTimeout(500);
      personalBankChecked = await personalBankRadio.isChecked().catch(() => false);
    }
    expect(personalBankChecked, 'Radio "Kho bài tập cá nhân" không giữ được trạng thái checked.').toBe(true);
    const classesOnPersonalBank = await readClassLabels();

    expect(classesOnPersonalBank.sort()).toEqual(classesOnBookSet.sort());
  });

  test("TC013: chọn Lớp CÓ dữ liệu ở Kho bài tập cá nhân -> danh sách bài tập hiển thị đúng", async () => {
    await clickClassLabel(DATA_CLASS);

    await expect(page.getByRole("combobox").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button[role="checkbox"][id^="lesson-item-"]').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("TC015: chọn Lớp KHÔNG có dữ liệu phù hợp -> danh sách rỗng, không lỗi hệ thống", async () => {
    await clickClassLabel(DATA_CLASS); // bỏ chọn lớp có dữ liệu trước
    await clickClassLabel(EMPTY_CLASS);

    await expect(page.getByRole("combobox").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Chưa có lesson nào", { exact: false })).toBeVisible({ timeout: 10000 });
    // Không có item nào để tick, và trang không rơi vào trạng thái lỗi/trắng trang.
    await expect(page.locator('button[role="checkbox"][id^="lesson-item-"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: po.submit.button })).toBeVisible();
  });

  test("TC014: đổi lại Lớp CÓ dữ liệu -> danh sách bài tập cập nhật lại đúng", async () => {
    await clickClassLabel(EMPTY_CLASS); // bỏ chọn lớp rỗng
    await clickClassLabel(DATA_CLASS);

    await expect(page.locator('button[role="checkbox"][id^="lesson-item-"]').first()).toBeVisible({
      timeout: 10000,
    });
  });
});
