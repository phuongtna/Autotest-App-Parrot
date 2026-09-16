import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { teacherPortalPageObjects as po } from "../../../../automation/giao_bai_tap/navigation/teacherPortalPageObjects.js";
import { sourcePageObjects as sel } from "../../../../automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/sourcePageObjects.js";
import { setDueDateViaPopover } from "../../../../automation/giao_bai_tap/navigation/dueDatePopover.js";
import { selectPersonalBankClassStably } from "../../../../automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/selectPersonalBankSource.js";

/**
 * TC032 (nguồn: TestCase_GiaoBaiTap_KhoBaiTapCaNhan.xlsx "6. Giao bài tập (submit)", xem
 * TESTCASES.md cùng thư mục) - "Chỉnh sửa bài tập đã giao — giới hạn phạm vi được sửa". AN TOÀN
 * chạy lặp lại - KHÔNG đụng tới Kho bài tập cá nhân, chỉ tạo bản ghi "Bài tập đã giao" mới mỗi lần
 * (không xóa - số lượng tăng dần theo mỗi lần chạy, chấp nhận được vì hạn nộp/thời gian giao luôn
 * khác nhau, không tạo trùng room).
 *
 * ENV (giống các spec khác trong module - BẮT BUỘC, KHÔNG dùng mặc định .env production):
 *   SOURCE_BASE_URL, SOURCE_USERNAME, SOURCE_PASSWORD, SOURCE_PERSONAL_BANK_CLASS
 */
function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} (xem docblock đầu file).`);
  }
  return value;
}

function todayDmy() {
  const d = new Date();
  return {
    day: d.getDate(),
    month: d.getMonth() + 1,
    dd: String(d.getDate()).padStart(2, "0"),
    mm: String(d.getMonth() + 1).padStart(2, "0"),
    yyyy: d.getFullYear(),
  };
}

function futureDmy(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return {
    day: d.getDate(),
    month: d.getMonth() + 1,
    dd: String(d.getDate()).padStart(2, "0"),
    mm: String(d.getMonth() + 1).padStart(2, "0"),
    yyyy: d.getFullYear(),
  };
}

test.describe.serial("Giao bài tập > Chỉnh sửa bài tập đã giao - giới hạn phạm vi được sửa (TC032)", () => {
  const BASE_URL = readRequiredEnv("SOURCE_BASE_URL");
  const USERNAME = readRequiredEnv("SOURCE_USERNAME");
  const PASSWORD = readRequiredEnv("SOURCE_PASSWORD");
  const PERSONAL_BANK_CLASS = readRequiredEnv("SOURCE_PERSONAL_BANK_CLASS");

  let context;
  let page;
  let todayExerciseId = null;
  let futureExerciseId = null;

  async function selectPersonalBankClass() {
    await page.goto(`${BASE_URL}/teacher/exercise`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: po.menu.createButton, exact: true }).click();

    // Xem docblock selectPersonalBankSource.js - chọn lớp ngay sau radio có thể làm chính radio
    // đó bị revert âm thầm về lại KNTT (bug thật đã xác nhận riêng, ảnh hưởng ĐÚNG file này trước
    // khi sửa - có nguy cơ TC032 âm thầm test nhầm bản ghi nguồn KNTT thay vì Kho bài tập cá nhân).
    await selectPersonalBankClassStably(page, PERSONAL_BANK_CLASS);
  }

  async function setThoiGianGiao({ day, month }) {
    const trigger = page
      .getByText("Thời gian giao", { exact: true })
      .locator("xpath=following-sibling::*[@aria-haspopup='menu'][1]");
    await setDueDateViaPopover(page, trigger, { day, month });
  }

  async function tickFirstItemAndSubmit() {
    const firstCheckbox = page.locator('button[role="checkbox"][id^="lesson-item-"]').first();
    await expect(firstCheckbox).toBeVisible({ timeout: 10000 });
    await firstCheckbox.click();

    const [createRoomResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("create_room.json")),
      page.getByRole("button", { name: po.submit.button }).click(),
    ]);
    const body = await createRoomResponse.json();
    const roomId = body?.data?.created_rooms?.[0]?.room_id;
    expect(roomId, `Không lấy được room_id: ${JSON.stringify(body)}`).toBeTruthy();
    await page.getByText(po.submit.successToast).waitFor({ timeout: 15000 });
    return roomId;
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

  test("setup: giao 1 bài với Thời gian giao = hôm nay (mặc định)", async () => {
    await selectPersonalBankClass();
    // Thời gian giao mặc định = hôm nay, không cần chỉnh gì thêm - đúng kịch bản cần test.
    todayExerciseId = await tickFirstItemAndSubmit();
  });

  test("TC032 (Thời gian giao = hôm nay): khóa sửa nội dung + Thời gian giao, Hạn nộp vẫn sửa được", async () => {
    await page.goto(`${BASE_URL}/teacher/exercise/${todayExerciseId}/edit`, { waitUntil: "networkidle" });

    await expect(page.locator(sel.personalBankRadioSelector)).toBeDisabled();
    const classCheckbox = page
      .getByText(PERSONAL_BANK_CLASS, { exact: false })
      .first()
      .locator("xpath=ancestor::label[1]//input[@type='checkbox']");
    await expect(classCheckbox).toBeDisabled();
    await expect(page.getByRole("combobox").first()).toBeDisabled();

    // ĐÃ XÁC NHẬN THẬT (2026-09-16, debug script riêng): trigger "Thời gian giao" KHÔNG có thuộc
    // tính HTML `disabled`/`aria-disabled` (khác hẳn radio/checkbox/combobox ở trên, đều dùng
    // thuộc tính `disabled` chuẩn) - khóa được thực hiện qua JS chặn mở popover khi click, không
    // phải qua disabled attribute. Assertion đúng: click xong, popover (role="menu") KHÔNG hiện.
    const thoiGianGiaoTrigger = page
      .getByText("Thời gian giao", { exact: true })
      .locator("xpath=following-sibling::*[@aria-haspopup='menu'][1]");
    await thoiGianGiaoTrigger.click();
    await page.waitForTimeout(800);
    await expect(page.getByRole("menu")).not.toBeVisible();

    const { day, month, dd, mm, yyyy } = todayDmy();
    const hanNopTrigger = page
      .getByText(po.dueDate.label, { exact: true })
      .locator("xpath=following-sibling::*[@aria-haspopup='menu'][1]");
    await expect(hanNopTrigger).toBeEnabled();
    await setDueDateViaPopover(page, hanNopTrigger, { day, month });

    await page.getByRole("button", { name: po.submit.button }).click();
    await page.getByText("Chỉnh sửa giao bài tập thành công").waitFor({ timeout: 15000 });

    // Lưu thành công xong, app tự điều hướng VỀ danh sách "Bài tập đã giao" (giống hành vi đã
    // biết ở TC034 sau khi xóa) - KHÔNG ở lại trang edit. Đọc lại Hạn nộp bằng cách quay lại thẳng
    // trang edit của đúng bản ghi này, không đọc mù text ngày trên trang list (đã gặp thật: đọc
    // nhầm ngày của 1 dòng KHÁC trong bảng do trang đã điều hướng đi).
    await page.goto(`${BASE_URL}/teacher/exercise/${todayExerciseId}/edit`, { waitUntil: "networkidle" });
    const hanNopNow = await page.getByText(/^\d{2}\/\d{2}\/\d{4}$/).last().innerText();
    expect(hanNopNow).toBe(`${dd}/${mm}/${yyyy}`);
  });

  test("setup: giao 1 bài với Thời gian giao = tương lai", async () => {
    await selectPersonalBankClass();
    const { day, month } = futureDmy(4);
    await setThoiGianGiao({ day, month });
    futureExerciseId = await tickFirstItemAndSubmit();
  });

  test("TC032 (Thời gian giao = tương lai): Thời gian giao vẫn sửa được bình thường (không khóa)", async () => {
    await page.goto(`${BASE_URL}/teacher/exercise/${futureExerciseId}/edit`, { waitUntil: "networkidle" });

    const thoiGianGiaoTrigger = page
      .getByText("Thời gian giao", { exact: true })
      .locator("xpath=following-sibling::*[@aria-haspopup='menu'][1]");
    await thoiGianGiaoTrigger.click();
    await expect(page.getByRole("menu")).toBeVisible({ timeout: 5000 });
  });
});
