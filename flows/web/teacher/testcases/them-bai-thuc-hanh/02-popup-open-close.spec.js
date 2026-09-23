import { test, expect } from "../../../../../automation/giao_bai_tap/playwrightTest.js";
import {
  themBaiThucHanhPageObjects as po,
  loginTeacherPortalUi,
  gotoKhoi,
  openUnit,
  openLesson,
  openAddPracticePopup,
} from "../../../../../automation/them_bai_thuc_hanh/navigation/themBaiThucHanhPageObjects.js";

/**
 * Nhóm B (TC_TBT_004-007) - Mở/đóng popup "Thêm bài thực hành" (xem
 * Ke_hoach_Automation_Them_Bai_Thuc_Hanh.docx mục 5). CHỈ ĐỌC - không tạo bài thực hành nào (mọi
 * case ở nhóm này đều ĐÓNG popup trước khi submit), an toàn chạy lặp lại.
 *
 * ĐÃ XÁC NHẬN THẬT (2026-09-23, debug live trên dev, tài khoản `0915315315`, Khối 11 > UNIT 1:
 * LEISURE TIME > READING): popup là `role="dialog"`, nội dung nguyên văn
 * `Thêm bài thực hànhTên bài *HủyTạo & soạn câu hỏiClose` - heading "Thêm bài thực hành", label
 * "Tên bài *", input placeholder "Nhập tên bài thực hành", 2 nút "Hủy"/"Tạo & soạn câu hỏi", 1 nút
 * icon đóng có accessible name "Close". Đóng bằng "Hủy" hoặc icon Close đều ẩn dialog ngay (không
 * cần confirm phụ). Mở lại popup sau khi đã Hủy: field "Tên bài" LUÔN rỗng, không giữ giá trị cũ.
 *
 * ENV (bắt buộc): SOURCE_BASE_URL, SOURCE_USERNAME, SOURCE_PASSWORD.
 * ENV (tuỳ chọn): PRACTICE_KHOI, PRACTICE_UNIT_LABEL, PRACTICE_LESSON_WITH_ITEMS.
 */
function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} (xem docblock đầu file).`);
  }
  return value;
}

test.describe.serial("Thêm bài thực hành > Nhóm B - Mở/đóng popup (TC_TBT_004-007)", () => {
  const BASE_URL = readRequiredEnv("SOURCE_BASE_URL");
  const USERNAME = readRequiredEnv("SOURCE_USERNAME");
  const PASSWORD = readRequiredEnv("SOURCE_PASSWORD");
  const KHOI = process.env.PRACTICE_KHOI || "11";
  const UNIT_LABEL = process.env.PRACTICE_UNIT_LABEL || "UNIT 1: LEISURE TIME";
  const LESSON_LABEL = process.env.PRACTICE_LESSON_WITH_ITEMS || "READING";

  let context;
  let page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await loginTeacherPortalUi(page, { baseUrl: BASE_URL, username: USERNAME, password: PASSWORD });
    await gotoKhoi(page, BASE_URL, KHOI);
    await openUnit(page, UNIT_LABEL);
    const opened = await openLesson(page, LESSON_LABEL);
    expect(opened, `Không tìm thấy Lesson "${LESSON_LABEL}" trong Unit "${UNIT_LABEL}".`).toBe(true);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('TC_TBT_004: click nút "Bài thực hành" mở popup thêm mới đúng cấu trúc', async () => {
    const dialog = await openAddPracticePopup(page);

    await expect(dialog.getByText(po.addPopup.heading, { exact: true })).toBeVisible();
    await expect(dialog.getByText(po.addPopup.tenBaiLabel, { exact: false })).toBeVisible();
    await expect(dialog.locator(`input[placeholder="${po.addPopup.tenBaiInputPlaceholder}"]`)).toBeVisible();
    await expect(dialog.getByRole("button", { name: po.addPopup.cancelButton, exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: po.addPopup.createButton, exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: po.addPopup.closeButtonAccessibleName })).toBeVisible();

    // Đóng lại để không ảnh hưởng test sau.
    await dialog.getByRole("button", { name: po.addPopup.cancelButton, exact: true }).click();
  });

  test("TC_TBT_005: đóng popup bằng icon (X)", async () => {
    const dialog = await openAddPracticePopup(page);
    await dialog.getByRole("button", { name: po.addPopup.closeButtonAccessibleName }).click();

    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10000 });
    await expect(page.getByText(/thành công/i)).toHaveCount(0);
  });

  test('TC_TBT_006: đóng popup bằng nút "Hủy"', async () => {
    const dialog = await openAddPracticePopup(page);
    await dialog.getByRole("button", { name: po.addPopup.cancelButton, exact: true }).click();

    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10000 });
    await expect(page.getByText(/thành công/i)).toHaveCount(0);
  });

  test('TC_TBT_007: mở lại popup sau khi đã Hủy - không giữ dữ liệu cũ', async () => {
    let dialog = await openAddPracticePopup(page);
    const input = dialog.locator(`input[placeholder="${po.addPopup.tenBaiInputPlaceholder}"]`);
    await input.fill("temp_khong_duoc_giu_lai");
    await expect(input).toHaveValue("temp_khong_duoc_giu_lai");

    await dialog.getByRole("button", { name: po.addPopup.cancelButton, exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10000 });

    dialog = await openAddPracticePopup(page);
    await expect(dialog.locator(`input[placeholder="${po.addPopup.tenBaiInputPlaceholder}"]`)).toHaveValue("");

    await dialog.getByRole("button", { name: po.addPopup.cancelButton, exact: true }).click();
  });
});
