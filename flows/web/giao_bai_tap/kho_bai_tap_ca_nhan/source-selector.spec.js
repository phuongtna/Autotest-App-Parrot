import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { teacherPortalPageObjects as po } from "../../../../automation/giao_bai_tap/navigation/teacherPortalPageObjects.js";
import { sourcePageObjects as sel } from "../../../../automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/sourcePageObjects.js";

/**
 * Playwright Test THẬT (`cd automation && npx playwright test
 * --config=playwright.kho-bai-tap-ca-nhan.config.js`, hoặc `npm run test-kho-bai-tap-ca-nhan-pw`)
 * cho TC001-008 (nguồn: TestCase_GiaoBaiTap_KhoBaiTapCaNhan.xlsx, xem TESTCASES.md cùng thư mục) -
 * field "Nguồn bài tập" mới ("Bộ sách Kết nối tri thức" / "Kho bài tập cá nhân") trên form tạo
 * "Giao bài tập" (Web GV). CHỈ ĐỌC - không bấm "Giao bài đã chọn", không tạo/sửa/xóa dữ liệu nào.
 *
 * MÔI TRƯỜNG/TÀI KHOẢN - BẮT BUỘC set qua ENV, KHÔNG dùng TEACHER_PORTAL_ENV/TEACHER_USERNAME/
 * TEACHER_PASSWORD mặc định trong .env (đó là tài khoản PRODUCTION, khác hẳn dev):
 *   SOURCE_BASE_URL     - vd "https://parrotedu.codeinet.com"
 *   SOURCE_USERNAME      - vd "0915315315"
 *   SOURCE_PASSWORD      - vd "123456789"
 *   SOURCE_PERSONAL_BANK_CLASS - tên lớp CÓ dữ liệu thật trong "Kho bài tập cá nhân" (tại
 *     2026-09-16, tài khoản GV dev trên chỉ có lớp "11A2" thoả điều kiện này - dùng nhầm lớp khác
 *     sẽ khiến TC003/TC007 fail vì "Danh sách bài tập" rỗng, không phải lỗi thật).
 *
 * ĐÃ XÁC NHẬN THẬT (2026-09-16, chạy live nhiều lần liên tiếp, toàn bộ 8/8 case PASS) - xem chi
 * tiết từng phát hiện (value cố định `__personal_bank__`, cấu trúc Unit/Lesson/Danh sách bài tập
 * giống hệt nguồn KNTT, tick RESET khi đổi nguồn qua lại - ĐÚNG theo kỳ vọng xlsx gốc, không phải
 * bug) trong TESTCASES.md cùng thư mục.
 */
function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Thiếu biến môi trường ${name} - test này chạy trên môi trường dev riêng, không dùng mặc ` +
        `định .env (xem docblock đầu file).`,
    );
  }
  return value;
}

test.describe.serial(
  'Giao bài tập > "Nguồn bài tập" - Bộ sách Kết nối tri thức / Kho bài tập cá nhân (TC001-008)',
  () => {
    const BASE_URL = readRequiredEnv("SOURCE_BASE_URL");
    const USERNAME = readRequiredEnv("SOURCE_USERNAME");
    const PASSWORD = readRequiredEnv("SOURCE_PASSWORD");
    const PERSONAL_BANK_CLASS = readRequiredEnv("SOURCE_PERSONAL_BANK_CLASS");

    let context;
    let page;
    const dueDateBefore = { thoiGianGiao: null, hanNop: null };
    let tickedItemId = null;

    const bookSetRadio = () => page.getByRole("radio", { name: sel.bookSetOptionText });
    const personalBankRadio = () => page.locator(sel.personalBankRadioSelector);
    const classCheckbox = (className) =>
      page
        .getByText(className, { exact: false })
        .first()
        .locator("xpath=ancestor::label[1]//input[@type='checkbox']");

    test.beforeAll(async ({ browser }) => {
      context = await browser.newContext();
      page = await context.newPage();

      await page.goto(`${BASE_URL}${po.login.path}`, { waitUntil: "networkidle", timeout: 30000 });
      await page.locator(po.login.usernameInput).first().fill(USERNAME);
      await page.locator(po.login.passwordInput).first().fill(PASSWORD);
      await page.getByRole("button", { name: po.login.submitButton }).click();
      await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });

      await page.getByText(po.menu.menuItem, { exact: false }).first().click();
      await page.getByRole("button", { name: po.menu.createButton }).click();
    });

    test.afterAll(async () => {
      await context?.close();
    });

    test("TC001: 2 option Nguồn bài tập hiển thị đúng, cạnh nhau", async () => {
      await expect(bookSetRadio()).toBeVisible();
      await expect(personalBankRadio()).toBeVisible();
      await expect(page.getByText(sel.groupLabel, { exact: true })).toBeVisible();
    });

    test("TC002: mặc định load trang, Bộ sách Kết nối tri thức được chọn sẵn", async () => {
      await expect(bookSetRadio()).toBeChecked();
      await expect(personalBankRadio()).not.toBeChecked();
    });

    test("Chọn lớp có dữ liệu thật (setup cho TC003/TC007)", async () => {
      // FIX (đã gặp thật ở assignHomeworkFlow.js#selectPrimaryClass): click mù 1 lần có thể PASS
      // dù checkbox chưa thực sự chuyển sang checked (race giữa click và render) - thử lại tối đa
      // 3 lần, xác nhận lại state sau mỗi lần thay vì tin click đầu tiên.
      const checkbox = classCheckbox(PERSONAL_BANK_CLASS);
      const label = page.getByText(PERSONAL_BANK_CLASS, { exact: false }).first();
      let checked = false;
      for (let attempt = 1; attempt <= 3 && !checked; attempt++) {
        await label.click();
        await page.waitForTimeout(300);
        checked = await checkbox.isChecked().catch(() => false);
      }
      expect(checked, `Đã bấm chọn lớp "${PERSONAL_BANK_CLASS}" 3 lần nhưng checkbox vẫn chưa checked.`).toBe(true);

      dueDateBefore.thoiGianGiao = await page.getByText(/^\d{2}\/\d{2}\/\d{4}$/).first().innerText();
      dueDateBefore.hanNop = await page.getByText(/^\d{2}\/\d{2}\/\d{4}$/).last().innerText();
    });

    test("TC003: chọn Kho bài tập cá nhân đổi đúng cấu trúc khung Chọn bài tập", async () => {
      await personalBankRadio().click();
      await expect(page.getByText(sel.chooseUnitLabel, { exact: true })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(sel.chooseLessonLabel, { exact: true })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(sel.assignmentListLabel, { exact: true })).toBeVisible({ timeout: 10000 });
    });

    test("TC004: Lớp/Thời gian giao/Hạn nộp giữ nguyên vị trí + giá trị sau khi đổi nguồn", async () => {
      await expect(classCheckbox(PERSONAL_BANK_CLASS)).toBeChecked();
      await expect(page.getByText(/^\d{2}\/\d{2}\/\d{4}$/).first()).toHaveText(dueDateBefore.thoiGianGiao);
      await expect(page.getByText(/^\d{2}\/\d{2}\/\d{4}$/).last()).toHaveText(dueDateBefore.hanNop);
    });

    test("Tick 1 item thật trong Danh sách bài tập (setup cho TC007)", async () => {
      // FIX (2026-09-16): label "Danh sách bài tập" render trước khi item bên trong fetch xong -
      // dùng locator + toBeVisible (auto-retry) thay vì count() tức thời, tránh race đã gặp thật.
      const first = page.locator('button[role="checkbox"][id^="lesson-item-"]').first();
      await expect(
        first,
        `"Danh sách bài tập" của lớp "${PERSONAL_BANK_CLASS}" không có item nào để tick - kiểm tra ` +
          `lại Unit/Lesson mặc định đang chọn có dữ liệu không.`,
      ).toBeVisible({ timeout: 10000 });

      await first.click();
      tickedItemId = await first.getAttribute("id");
      await expect(first).toHaveAttribute("aria-checked", "true");
    });

    test("TC005: chuyển lại Bộ sách Kết nối tri thức cập nhật đúng UI", async () => {
      await bookSetRadio().click();
      await expect(bookSetRadio()).toBeChecked();
      await expect(personalBankRadio()).not.toBeChecked();
      await expect(page.getByText(sel.chooseUnitLabel, { exact: true })).toBeVisible({ timeout: 10000 });
    });

    test("TC006: chuyển lại Kho bài tập cá nhân cập nhật đúng UI", async () => {
      await personalBankRadio().click();
      await expect(personalBankRadio()).toBeChecked();
      await expect(bookSetRadio()).not.toBeChecked();
      await expect(page.getByText(sel.chooseUnitLabel, { exact: true })).toBeVisible({ timeout: 10000 });
    });

    test("TC007: tick bị RESET sau khi đổi nguồn qua lại (ĐÚNG theo kỳ vọng xlsx gốc)", async () => {
      // ĐÃ XÁC NHẬN THẬT (2026-09-16): tick RESET (không giữ) sau khi đổi nguồn rồi quay lại, kể cả
      // khi Unit/Lesson tự re-select về đúng vị trí cũ. File nguồn ghi TC007 là "Pass" (chỉ
      // TC_GBT_KBTCN_033 Fail trong 30 case) -> RESET là hành vi ĐÚNG, không phải bug.
      const tickedCheckbox = page.locator(`button[role="checkbox"]#${tickedItemId}`);
      await expect(tickedCheckbox).toHaveAttribute("aria-checked", "false");
    });

    test("TC008: Lớp/Thời gian giao/Hạn nộp không bị clear sau nhiều lần đổi nguồn", async () => {
      await expect(classCheckbox(PERSONAL_BANK_CLASS)).toBeChecked();
      await expect(page.getByText(/^\d{2}\/\d{2}\/\d{4}$/).first()).toHaveText(dueDateBefore.thoiGianGiao);
      await expect(page.getByText(/^\d{2}\/\d{2}\/\d{4}$/).last()).toHaveText(dueDateBefore.hanNop);
    });
  },
);
