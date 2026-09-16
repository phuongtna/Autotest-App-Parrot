import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { teacherPortalPageObjects as po } from "../../../../automation/giao_bai_tap/navigation/teacherPortalPageObjects.js";
import { selectPersonalBankClassStably } from "../../../../automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/selectPersonalBankSource.js";

/**
 * TC017/018/019 (nguồn: TestCase_GiaoBaiTap_KhoBaiTapCaNhan.xlsx "5. Chọn bài tập / Xem chi
 * tiết", xem TESTCASES.md cùng thư mục). CHỈ ĐỌC - không tạo/sửa/xóa dữ liệu nào, an toàn chạy
 * lặp lại.
 *
 * ĐÃ XÁC NHẬN THẬT (2026-09-16, thao tác tay trước khi viết assertion): "Xem chi tiết" mở 1
 * MODAL preview nội dung/câu hỏi ngay tại chỗ - KHÔNG điều hướng sang trang "Chỉnh sửa bài tập"
 * như 1 ghi chú "ĐÍNH CHÍNH" trong xlsx gốc mô tả (ghi chú đó có thể đang nói tới 1 luồng khác -
 * click từ đâu đó ngoài form Giao bài tập). Hành vi quan sát được khớp với mô tả GỐC (chưa đính
 * chính) của TC018: "Hiển thị đúng nội dung, câu hỏi của bài tập đã chọn".
 *
 * ENV (BẮT BUỘC, dùng tài khoản GV thứ 2 "_2" - đã xác nhận có ≥2 item thật trong 1 Lesson,
 * KHÔNG dùng mặc định .env production):
 *   SOURCE_BASE_URL, SOURCE_USERNAME_2, SOURCE_PASSWORD_2, SOURCE_PERSONAL_BANK_CLASS_2
 */
function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} (xem docblock đầu file).`);
  }
  return value;
}

test.describe.serial("Giao bài tập > Tick chọn + Xem chi tiết ở Kho bài tập cá nhân (TC017/018/019)", () => {
  const BASE_URL = readRequiredEnv("SOURCE_BASE_URL");
  const USERNAME = readRequiredEnv("SOURCE_USERNAME_2");
  const PASSWORD = readRequiredEnv("SOURCE_PASSWORD_2");
  const PERSONAL_BANK_CLASS = readRequiredEnv("SOURCE_PERSONAL_BANK_CLASS_2");

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

    await page.goto(`${BASE_URL}/teacher/exercise`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: po.menu.createButton, exact: true }).click();

    // Xem docblock selectPersonalBankSource.js - đây CHÍNH LÀ file đã phát hiện ra bug revert
    // thật (Xem chi tiết mở nhầm modal "BTCB 1" của Bộ sách KNTT thay vì item Kho cá nhân đã tick,
    // vì radio bị revert âm thầm ngay sau khi chọn lớp).
    await selectPersonalBankClassStably(page, PERSONAL_BANK_CLASS);

    await expect(page.locator('button[role="checkbox"][id^="lesson-item-"]').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test("TC017: tick chọn 2 bài tập cùng lúc, cả 2 giữ trạng thái đồng thời", async () => {
    const checkboxes = page.locator('button[role="checkbox"][id^="lesson-item-"]');
    const count = await checkboxes.count();
    expect(count, "Cần ít nhất 2 item thật trong Danh sách bài tập để test TC017.").toBeGreaterThanOrEqual(2);

    await checkboxes.nth(0).click();
    await expect(checkboxes.nth(0)).toHaveAttribute("aria-checked", "true");
    // Tick thêm mục thứ 2 - mục thứ 1 phải VẪN đang checked (không bị mất tick khi tick thêm mục
    // sau, đúng theo kỳ vọng xlsx gốc).
    await checkboxes.nth(1).click();
    await expect(checkboxes.nth(1)).toHaveAttribute("aria-checked", "true");
    await expect(checkboxes.nth(0)).toHaveAttribute("aria-checked", "true");
  });

  test("TC018/TC019: Xem chi tiết hiển thị đúng nội dung + số câu hỏi khớp badge", async () => {
    const firstRow = page.locator('button[role="checkbox"][id^="lesson-item-"]').first();
    const itemTitle = await firstRow.locator("xpath=following-sibling::*[1]").innerText();
    const badgeText = await firstRow.locator("xpath=following-sibling::*[2]").innerText();
    const expectedQuestionCount = Number(badgeText.match(/\d+/)?.[0]);
    expect(expectedQuestionCount, `Không đọc được số câu hỏi từ badge "${badgeText}".`).toBeGreaterThan(0);

    // "Xem chi tiết" trên DOM có thể không phải thẻ <button> thật (chỉ role="button" qua a11y) -
    // dùng getByRole trực tiếp thay vì xpath following-sibling::button (đã gặp thật: xpath không
    // khớp được phần tử nào, timeout).
    await page.getByRole("button", { name: "Xem chi tiết", exact: true }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10000 });
    // TC018: nội dung modal đúng bài tập đã chọn (tiêu đề khớp tên bài trong danh sách).
    await expect(dialog.getByText(itemTitle, { exact: false }).first()).toBeVisible();

    // TC019: đếm số "Câu N" thật hiển thị trong modal, đối chiếu với badge "N câu hỏi". Dùng
    // \s+ (không phải space literal) giữa "Câu" và số - đã gặp thật nbsp (non-breaking space)
    // thay cho space thường ở chỗ khác trong app này (xem project_pronunciation_answer_nbsp_tap_bug
    // trong memory), match literal " " có thể fail âm thầm vì lý do này.
    //
    // FIX (2026-09-16): nội dung câu hỏi trong modal load DẦN (chỉ "Câu 1" có ngay, "Câu 2.."
    // xuất hiện sau) - đọc quá sớm ra 0 câu dù modal đã visible/đúng tiêu đề. Chờ (poll) tới khi
    // đếm đủ số câu như badge, thay vì đọc 1 lần duy nhất.
    const countQuestionLabels = () =>
      dialog.evaluate((el) =>
        [...new Set(Array.from(el.querySelectorAll("*")).map((n) => n.textContent?.trim()).filter((t) => /^Câu\s+\d+$/.test(t || "")))].length,
      );
    await expect
      .poll(countQuestionLabels, {
        message: `Modal chưa hiển thị đủ ${expectedQuestionCount} câu như badge sau thời gian chờ.`,
        timeout: 15000,
      })
      .toBe(expectedQuestionCount);
  });
});
