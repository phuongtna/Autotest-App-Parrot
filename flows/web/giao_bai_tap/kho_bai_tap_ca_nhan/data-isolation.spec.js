import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { teacherPortalPageObjects as po } from "../../../../automation/giao_bai_tap/navigation/teacherPortalPageObjects.js";
import { selectPersonalBankClassStably } from "../../../../automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/selectPersonalBankSource.js";

/**
 * TC009 (nguồn: TestCase_GiaoBaiTap_KhoBaiTapCaNhan.xlsx "3. Phân quyền dữ liệu theo giáo viên",
 * xem TESTCASES.md cùng thư mục) - "Kho bài tập cá nhân chỉ hiển thị bài tập do chính giáo viên đó
 * tạo". Test case quan trọng nhất về bảo mật/phân quyền dữ liệu theo đánh giá của tester gốc. CHỈ
 * ĐỌC - không tạo/sửa/xóa dữ liệu nào, dùng 2 `BrowserContext` song song (2 phiên đăng nhập độc
 * lập) để đối chiếu chéo.
 *
 * ENV (BẮT BUỘC, KHÔNG dùng mặc định .env production):
 *   SOURCE_BASE_URL - vd "https://parrotedu.codeinet.com"
 *   SOURCE_USERNAME / SOURCE_PASSWORD - tài khoản GV A (vd "0915315315"/"123456789", "Phương")
 *   SOURCE_PERSONAL_BANK_CLASS - lớp CÓ dữ liệu Kho bài tập cá nhân của GV A (vd "11A2")
 *   SOURCE_USERNAME_2 / SOURCE_PASSWORD_2 - tài khoản GV B (vd "0985285285"/"123456789",
 *     "Hoàng Kim Ngân")
 *   SOURCE_PERSONAL_BANK_CLASS_2 - lớp CÓ dữ liệu Kho bài tập cá nhân của GV B (vd "11E")
 *
 * Chạy:
 *   cd automation
 *   SOURCE_BASE_URL="https://parrotedu.codeinet.com" \
 *   SOURCE_USERNAME="0915315315" SOURCE_PASSWORD="123456789" SOURCE_PERSONAL_BANK_CLASS="11A2" \
 *   SOURCE_USERNAME_2="0985285285" SOURCE_PASSWORD_2="123456789" SOURCE_PERSONAL_BANK_CLASS_2="11E" \
 *   npx playwright test --config=playwright.kho-bai-tap-ca-nhan.config.js data-isolation
 */
function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} (xem docblock đầu file).`);
  }
  return value;
}

async function loginAndCollectPersonalBankItemIds(browser, baseUrl, username, password, className) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${baseUrl}${po.login.path}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.locator(po.login.usernameInput).first().fill(username);
  await page.locator(po.login.passwordInput).first().fill(password);
  await page.getByRole("button", { name: po.login.submitButton }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });

  const teacherName = await page
    .locator("banner, header")
    .first()
    .locator("text=/.+/")
    .first()
    .innerText()
    .catch(() => null);

  await page.goto(`${baseUrl}/teacher/exercise`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: po.menu.createButton, exact: true }).click();

  // Xem docblock selectPersonalBankSource.js - BUG THẬT: chọn lớp ngay sau radio có thể làm chính
  // radio đó bị revert âm thầm về lại KNTT. QUAN TRỌNG ĐẶC BIỆT ở TC009 (phân quyền dữ liệu) - nếu
  // không sửa, cả 2 GV có thể vô tình bị fallback về cùng nguồn KNTT (dữ liệu GLOBAL, dùng chung
  // mọi tài khoản) và test có thể PASS/FAIL SAI Ý NGHĨA mà không phát hiện ra (so sánh nhầm dữ liệu
  // dùng chung thay vì đúng dữ liệu riêng của từng GV).
  await selectPersonalBankClassStably(page, className);

  const firstCheckbox = page.locator('button[role="checkbox"][id^="lesson-item-"]').first();
  await expect(
    firstCheckbox,
    `[${username}] Lớp "${className}" không có item nào trong Kho bài tập cá nhân - cần dữ liệu ` +
      `thật để test TC009 có ý nghĩa.`,
  ).toBeVisible({ timeout: 10000 });

  const itemIds = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button[role="checkbox"][id^="lesson-item-"]')).map((b) =>
      b.id.replace(/^lesson-item-/, ""),
    ),
  );
  const unitLabel = await page.getByRole("combobox").first().innerText();

  await context.close();
  return { teacherName, className, unitLabel, itemIds };
}

test("TC009: Kho bài tập cá nhân chỉ hiển thị bài tập do chính GV đó tạo (phân quyền dữ liệu)", async ({
  browser,
}) => {
  const BASE_URL = readRequiredEnv("SOURCE_BASE_URL");
  const USERNAME_A = readRequiredEnv("SOURCE_USERNAME");
  const PASSWORD_A = readRequiredEnv("SOURCE_PASSWORD");
  const CLASS_A = readRequiredEnv("SOURCE_PERSONAL_BANK_CLASS");
  const USERNAME_B = readRequiredEnv("SOURCE_USERNAME_2");
  const PASSWORD_B = readRequiredEnv("SOURCE_PASSWORD_2");
  const CLASS_B = readRequiredEnv("SOURCE_PERSONAL_BANK_CLASS_2");

  const [gvA, gvB] = await Promise.all([
    loginAndCollectPersonalBankItemIds(browser, BASE_URL, USERNAME_A, PASSWORD_A, CLASS_A),
    loginAndCollectPersonalBankItemIds(browser, BASE_URL, USERNAME_B, PASSWORD_B, CLASS_B),
  ]);

  expect(gvA.itemIds.length, `GV A (${USERNAME_A}) không có item nào để đối chiếu.`).toBeGreaterThan(0);
  expect(gvB.itemIds.length, `GV B (${USERNAME_B}) không có item nào để đối chiếu.`).toBeGreaterThan(0);

  const overlap = gvA.itemIds.filter((id) => gvB.itemIds.includes(id));
  expect(
    overlap,
    `Phát hiện item TRÙNG giữa Kho bài tập cá nhân của 2 GV khác nhau (lẽ ra phải tách biệt hoàn ` +
      `toàn): GV A (${gvA.teacherName || USERNAME_A}, lớp ${CLASS_A}, ${gvA.unitLabel}) = ` +
      `${JSON.stringify(gvA.itemIds)}; GV B (${gvB.teacherName || USERNAME_B}, lớp ${CLASS_B}, ` +
      `${gvB.unitLabel}) = ${JSON.stringify(gvB.itemIds)}; item trùng = ${JSON.stringify(overlap)}.`,
  ).toEqual([]);
});
