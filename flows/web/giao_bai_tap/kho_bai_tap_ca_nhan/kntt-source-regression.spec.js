import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { teacherPortalPageObjects as po } from "../../../../automation/giao_bai_tap/navigation/teacherPortalPageObjects.js";
import { sourcePageObjects as sel } from "../../../../automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/sourcePageObjects.js";
import { setDueDateViaPopover } from "../../../../automation/giao_bai_tap/navigation/dueDatePopover.js";

/**
 * TC030 (nguồn: TestCase_GiaoBaiTap_KhoBaiTapCaNhan.xlsx "8. Hồi quy (Bộ sách KNTT)", xem
 * TESTCASES.md cùng thư mục) - luồng "Bộ sách Kết nối tri thức" (nguồn MẶC ĐỊNH, có từ trước khi bổ
 * sung "Kho bài tập cá nhân") không bị ảnh hưởng: chọn Unit/Lesson, tick chọn bài, giao bài tập vẫn
 * hoạt động đúng. KHÔNG hardcode tên Unit/Lesson/bài tập cụ thể (dữ liệu dev có thể đổi) - dùng
 * NGUYÊN Unit/Lesson mặc định form tự chọn sẵn khi mở (đã xác nhận thật 2026-09-16: form nhớ lại
 * lựa chọn Unit/Lesson gần nhất của tài khoản, luôn có sẵn item để tick), giống cách class-
 * selection.spec.js#TC013 không cần chỉ định Unit/Lesson cụ thể.
 *
 * Dọn dẹp sau khi test: xóa bản ghi vừa tạo qua "Chỉnh sửa giao bài tập" (pattern giống hệt
 * delete-assigned-regression.spec.js/TC034 - xóa NGAY, không có độ trễ cache, an toàn) để không
 * cộng dồn rác mỗi lần chạy regression.
 *
 * ENV (giống các spec khác trong module - BẮT BUỘC, KHÔNG dùng mặc định .env production):
 *   SOURCE_BASE_URL, SOURCE_USERNAME, SOURCE_PASSWORD, SOURCE_PERSONAL_BANK_CLASS
 *   (lớp này chỉ cần CÓ dữ liệu Bộ sách KNTT thật - lớp dùng cho Kho bài tập cá nhân trong các
 *   spec khác của module đã xác nhận thật cũng có dữ liệu KNTT, xem TESTCASES.md)
 */
function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} (xem docblock đầu file).`);
  }
  return value;
}

function randomFutureDate() {
  const offsetDays = 3 + Math.floor(Math.random() * 8);
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return { day: d.getDate(), month: d.getMonth() + 1 };
}

test.describe.serial("Giao bài tập > Hồi quy Bộ sách Kết nối tri thức (TC030)", () => {
  const BASE_URL = readRequiredEnv("SOURCE_BASE_URL");
  const USERNAME = readRequiredEnv("SOURCE_USERNAME");
  const PASSWORD = readRequiredEnv("SOURCE_PASSWORD");
  const CLASS_NAME = readRequiredEnv("SOURCE_PERSONAL_BANK_CLASS");

  let context;
  let page;
  let assignedExerciseId = null;

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

  test("TC030: chọn Unit/Lesson/tick bài + giao bài ở Bộ sách KNTT vẫn hoạt động đúng", async () => {
    await page.goto(`${BASE_URL}/teacher/exercise`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: po.menu.createButton, exact: true }).click();

    // KHÔNG đụng gì tới radio "Nguồn bài tập" - mặc định vào form đã là "Bộ sách Kết nối tri
    // thức", đúng đối tượng cần hồi quy ở TC030 (KHÁC các spec khác trong module, không cần
    // selectPersonalBankClassStably ở đây).
    const bookSetRadio = page
      .getByText(sel.bookSetOptionText, { exact: true })
      .locator("xpath=ancestor::label[1]//input[@type='radio']");
    await expect(bookSetRadio).toBeChecked();

    const classLabel = page.getByText(CLASS_NAME, { exact: false }).first();
    const classCheckbox = classLabel.locator("xpath=ancestor::label[1]//input[@type='checkbox']");
    for (let attempt = 1; attempt <= 3; attempt++) {
      await classLabel.click();
      await page.waitForTimeout(300);
      if (await classCheckbox.isChecked().catch(() => false)) break;
    }
    await expect(classCheckbox, `Không chọn được lớp "${CLASS_NAME}".`).toBeChecked();

    // Unit/Lesson mặc định form tự chọn sẵn (nhớ theo tài khoản) - chỉ cần chờ danh sách bài tập
    // load xong, không chỉ định tên Unit/Lesson cụ thể (tránh hardcode dữ liệu dev có thể đổi).
    const checkboxes = page.locator('button[role="checkbox"][id^="lesson-item-"]');
    await expect(
      checkboxes.first(),
      `Unit/Lesson mặc định của lớp "${CLASS_NAME}" (Bộ sách KNTT) không có bài tập nào để tick - ` +
        `cần chọn tay 1 Unit/Lesson có dữ liệu trước khi chạy lại.`,
    ).toBeVisible({ timeout: 10000 });

    // Tick 2 bài tập (theo đúng bước gốc "Tick chọn 1-2 bài tập") - cả 2 phải giữ trạng thái đã
    // chọn đồng thời, giống hành vi đã xác nhận ở TC017 (component "Danh sách bài tập" dùng chung
    // giữa 2 nguồn).
    await checkboxes.nth(0).click();
    await expect(checkboxes.nth(0)).toHaveAttribute("aria-checked", "true");
    const count = await checkboxes.count();
    if (count >= 2) {
      await checkboxes.nth(1).click();
      await expect(checkboxes.nth(1)).toHaveAttribute("aria-checked", "true");
      await expect(checkboxes.nth(0)).toHaveAttribute("aria-checked", "true");
    }

    const { day, month } = randomFutureDate();
    const dueDateTrigger = page
      .getByText(po.dueDate.label, { exact: true })
      .locator("xpath=following-sibling::*[@aria-haspopup='menu'][1]");
    await setDueDateViaPopover(page, dueDateTrigger, { day, month });

    const [createRoomResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("create_room.json")),
      page.getByRole("button", { name: po.submit.button }).click(),
    ]);
    const createRoomBody = await createRoomResponse.json();
    assignedExerciseId = createRoomBody?.data?.created_rooms?.[0]?.room_id;
    expect(
      assignedExerciseId,
      `Không lấy được room_id từ response create_room.json: ${JSON.stringify(createRoomBody)}`,
    ).toBeTruthy();

    await page.getByText(po.submit.successToast).waitFor({ timeout: 15000 });
  });

  test("dọn dẹp: xóa bản ghi hồi quy vừa tạo", async () => {
    expect(assignedExerciseId, "Test giao bài (TC030) chưa chạy thành công - không có gì để dọn dẹp.").toBeTruthy();

    await page.goto(`${BASE_URL}/teacher/exercise/${assignedExerciseId}/edit`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Xóa", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: po.deleteConfirmDialog.confirmButton, exact: true }).click();
    await page.getByText("Xóa bài tập thành công").waitFor({ timeout: 15000 });
  });
});
