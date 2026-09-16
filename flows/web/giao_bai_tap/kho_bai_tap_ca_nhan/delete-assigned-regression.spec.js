import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { teacherPortalPageObjects as po } from "../../../../automation/giao_bai_tap/navigation/teacherPortalPageObjects.js";
import { setDueDateViaPopover } from "../../../../automation/giao_bai_tap/navigation/dueDatePopover.js";
import { selectPersonalBankClassStably } from "../../../../automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/selectPersonalBankSource.js";

/**
 * TC034 (xem TESTCASES.md cùng thư mục) - xóa bản ghi "Bài tập đã giao" qua "Chỉnh sửa giao bài
 * tập" phải mất đồng bộ NGAY (không có độ trễ cache như TC033). AN TOÀN chạy lặp lại nhiều lần -
 * KHÔNG đụng tới Kho bài tập cá nhân, chỉ tạo rồi xóa 1 bản ghi "Bài tập đã giao" (dùng lại item
 * Kho cá nhân CÒN LẠI của lớp chỉ định, không xóa item nguồn nào).
 *
 * ĐÃ XÁC NHẬN THẬT (2026-09-16): tạo bản ghi id `2ad8b7c5-...` (item
 * "Choose the word whose underlined part is pronounced differently from the others.", lớp 11A2) ->
 * bấm "Xóa" ở trang "Chỉnh sửa bài tập" -> mất khỏi "Danh sách bài tập đã giao" NGAY LẬP TỨC (kiểm
 * tra lại URL/DOM ngay sau khi xóa, không cần chờ) -> app HS (profile "Hoang Gia Minh") cũng không
 * còn dấu vết - đúng như kỳ vọng, không phải bug.
 *
 * ENV (giống source-selector.spec.js - BẮT BUỘC, KHÔNG dùng mặc định .env production):
 *   SOURCE_BASE_URL, SOURCE_USERNAME, SOURCE_PASSWORD, SOURCE_PERSONAL_BANK_CLASS
 *
 * Chạy: cd automation && ...(env)... npx playwright test
 *   --config=playwright.kho-bai-tap-ca-nhan.config.js delete-assigned-regression
 */
function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} (xem docblock đầu file).`);
  }
  return value;
}

// Random hạn nộp trong khoảng hôm nay+3..+10 ngày - tránh trùng hạn nộp với lượt chạy trước đó
// (đã gặp thật: 2 assignment cùng lớp/cùng item/cùng hạn nộp bị BLOCK do trùng "room"), KHÔNG cố
// định 1 ngày trong code.
function randomFutureDate() {
  const offsetDays = 3 + Math.floor(Math.random() * 8);
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return { day: d.getDate(), month: d.getMonth() + 1, dd: String(d.getDate()).padStart(2, "0"), mm: String(d.getMonth() + 1).padStart(2, "0"), yyyy: d.getFullYear() };
}

test.describe.serial("Giao bài tập > Xóa bản ghi đã giao qua Chỉnh sửa giao bài tập (TC034)", () => {
  const BASE_URL = readRequiredEnv("SOURCE_BASE_URL");
  const USERNAME = readRequiredEnv("SOURCE_USERNAME");
  const PASSWORD = readRequiredEnv("SOURCE_PASSWORD");
  const PERSONAL_BANK_CLASS = readRequiredEnv("SOURCE_PERSONAL_BANK_CLASS");

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

  test("setup: giao 1 bài từ Kho bài tập cá nhân (hạn nộp random để tránh trùng room)", async () => {
    await page.getByText(po.menu.menuItem, { exact: false }).first().click();
    await page.getByRole("button", { name: po.menu.createButton }).click();

    // Xem docblock selectPersonalBankSource.js - chọn lớp ngay sau radio có thể làm chính radio
    // đó bị revert âm thầm về lại KNTT (bug thật đã xác nhận riêng), dùng helper verify cả 2 điều
    // kiện đồng thời thay vì click rời rạc không retry như trước.
    await selectPersonalBankClassStably(page, PERSONAL_BANK_CLASS);

    const { day, month } = randomFutureDate();
    const dueDateTrigger = page
      .getByText(po.dueDate.label, { exact: true })
      .locator("xpath=following-sibling::*[@aria-haspopup='menu'][1]");
    await setDueDateViaPopover(page, dueDateTrigger, { day, month });

    const firstCheckbox = page.locator('button[role="checkbox"][id^="lesson-item-"]').first();
    await expect(
      firstCheckbox,
      `"Danh sách bài tập" của lớp "${PERSONAL_BANK_CLASS}" (Kho bài tập cá nhân) không có item ` +
        `nào để giao - cần ít nhất 1 item thật còn lại (xem TESTCASES.md).`,
    ).toBeVisible({ timeout: 10000 });
    await firstCheckbox.click();

    // ĐÃ XÁC NHẬN THẬT (2026-09-16): dò id bản ghi vừa tạo bằng text trong bảng "Danh sách bài tập
    // đã giao" (due date + lớp + tên bài) KHÔNG ĐÁNG TIN CẬY - tên bài tập KHÔNG unique giữa các
    // nguồn (gặp thật ở assign-submit.spec.js: lọc đủ 3 điều kiện vẫn lấy nhầm 1 bản ghi khác
    // nguồn KNTT trùng tên). Cách ĐÚNG: bắt response API
    // `POST .../api/user/exams/create_room.json` - trường `data.created_rooms[0].room_id` CHÍNH
    // LÀ id dùng trong URL `/teacher/exercise/{room_id}/edit`, đã verify khớp 100%.
    const [createRoomResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("create_room.json")),
      page.getByRole("button", { name: po.submit.button }).click(),
    ]);
    const createRoomBody = await createRoomResponse.json();
    assignedExerciseId = createRoomBody?.data?.created_rooms?.[0]?.room_id;
    expect(assignedExerciseId, `Không lấy được room_id từ response create_room.json: ${JSON.stringify(createRoomBody)}`).toBeTruthy();

    await page.getByText(po.submit.successToast).waitFor({ timeout: 15000 });
  });

  test("TC034: xóa bản ghi qua Chỉnh sửa giao bài tập -> mất khỏi Danh sách bài tập đã giao NGAY", async () => {
    await page.goto(`${BASE_URL}/teacher/exercise/${assignedExerciseId}/edit`, { waitUntil: "networkidle" });

    await page.getByRole("button", { name: "Xóa", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: po.deleteConfirmDialog.confirmButton, exact: true }).click();
    await page.getByText("Xóa bài tập thành công").waitFor({ timeout: 15000 });

    await page.goto(`${BASE_URL}/teacher/exercise`, { waitUntil: "networkidle" });
    const stillPresent = await page.evaluate(
      (id) => document.body.innerHTML.includes(id),
      assignedExerciseId,
    );
    expect(stillPresent, `Bản ghi "${assignedExerciseId}" vẫn còn trong danh sách sau khi xóa.`).toBe(false);
  });
});
