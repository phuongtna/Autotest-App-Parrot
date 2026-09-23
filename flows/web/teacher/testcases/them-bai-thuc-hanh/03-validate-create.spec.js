import { test, expect } from "../../../../../automation/giao_bai_tap/playwrightTest.js";
import {
  themBaiThucHanhPageObjects as po,
  loginTeacherPortalUi,
  gotoKhoi,
  openUnit,
  openLesson,
  openAddPracticePopup,
  deletePracticeByTitle,
} from "../../../../../automation/them_bai_thuc_hanh/navigation/themBaiThucHanhPageObjects.js";

/**
 * Nhóm C (TC_TBT_008-011) - Trường "Tên bài" & nút "Tạo & soạn câu hỏi" (xem
 * Ke_hoach_Automation_Them_Bai_Thuc_Hanh.docx mục 5).
 *
 * ĐÃ XÁC NHẬN THẬT (2026-09-23, debug live trên dev, tài khoản `0915315315`): nút "Tạo & soạn câu
 * hỏi" có `disabled=true` khi input Tên bài rỗng HOẶC chỉ toàn khoảng trắng (validator có trim()),
 * `disabled=false` ngay khi có ký tự thật. Bấm nút khi hợp lệ điều hướng NGAY sang
 * `/teacher/quiz/{id}/edit?returnTo=...` (đã tạo bản ghi thật trong DB tại thời điểm này, TRƯỚC
 * khi soạn câu hỏi - xem TC_TBT_014/025).
 *
 * TC_TBT_010 tạo dữ liệu thật (prefix `AUTO_QA_TBT010_`) - TỰ XOÁ ở cuối test qua
 * `deletePracticeByTitle()` (afterEach) để không tích rác, đúng nguyên tắc mục 3.4 của docx.
 * TC_TBT_011 (giả lập mất mạng) KHÔNG tạo được bản ghi nào (đúng ý đồ test) nên không cần cleanup.
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

test.describe.serial("Thêm bài thực hành > Nhóm C - Validate Tên bài & tạo (TC_TBT_008-011)", () => {
  const BASE_URL = readRequiredEnv("SOURCE_BASE_URL");
  const USERNAME = readRequiredEnv("SOURCE_USERNAME");
  const PASSWORD = readRequiredEnv("SOURCE_PASSWORD");
  const KHOI = process.env.PRACTICE_KHOI || "11";
  const UNIT_LABEL = process.env.PRACTICE_UNIT_LABEL || "UNIT 1: LEISURE TIME";
  const LESSON_LABEL = process.env.PRACTICE_LESSON_WITH_ITEMS || "READING";

  let context;
  let page;
  let createdTitle;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await loginTeacherPortalUi(page, { baseUrl: BASE_URL, username: USERNAME, password: PASSWORD });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test.beforeEach(async () => {
    await gotoKhoi(page, BASE_URL, KHOI);
    await openUnit(page, UNIT_LABEL);
    const opened = await openLesson(page, LESSON_LABEL);
    expect(opened, `Không tìm thấy Lesson "${LESSON_LABEL}" trong Unit "${UNIT_LABEL}".`).toBe(true);
  });

  test('TC_TBT_008: bỏ trống Tên bài rồi bấm "Tạo & soạn câu hỏi" - nút bị disable', async () => {
    const dialog = await openAddPracticePopup(page);
    const createButton = dialog.getByRole("button", { name: po.addPopup.createButton, exact: true });

    await expect(createButton).toBeDisabled();

    await dialog.getByRole("button", { name: po.addPopup.cancelButton, exact: true }).click();
  });

  test("TC_TBT_009: nhập Tên bài chỉ toàn khoảng trắng - nút vẫn disable (validator có trim())", async () => {
    const dialog = await openAddPracticePopup(page);
    const input = dialog.locator(`input[placeholder="${po.addPopup.tenBaiInputPlaceholder}"]`);
    const createButton = dialog.getByRole("button", { name: po.addPopup.createButton, exact: true });

    await input.fill("   ");
    await expect(createButton).toBeDisabled();

    await dialog.getByRole("button", { name: po.addPopup.cancelButton, exact: true }).click();
  });

  test('TC_TBT_010: nhập Tên bài hợp lệ và tạo thành công (toast + điều hướng + Tên đề khớp)', async () => {
    createdTitle = `AUTO_QA_TBT010_${Date.now()}`;
    const dialog = await openAddPracticePopup(page);
    const input = dialog.locator(`input[placeholder="${po.addPopup.tenBaiInputPlaceholder}"]`);
    const createButton = dialog.getByRole("button", { name: po.addPopup.createButton, exact: true });

    await input.fill(createdTitle);
    await expect(createButton).toBeEnabled();

    await Promise.all([page.waitForURL(/\/teacher\/quiz\/[^/]+\/edit/, { timeout: 15000 }), createButton.click()]);

    // Toast text theo docx mục 5 (TC_TBT_014) - CHƯA re-verify độc lập trong phiên debug live này
    // (thao tác qua page.evaluate() ở bước khám phá thủ công điều hướng quá nhanh để bắt kịp
    // toast) - nếu sai chuỗi, chỉnh lại đây khi chạy thật lần đầu.
    await expect(page.getByText(/thành công/i).first()).toBeVisible({ timeout: 10000 });

    await expect(page.locator(`input[placeholder="${po.quizEditPage.tenDeInputPlaceholder}"]`)).toHaveValue(
      createdTitle,
    );
  });

  test.afterEach(async () => {
    if (createdTitle) {
      // Bài vừa tạo đang ở trang Chỉnh sửa đề bài - quay lại đúng Lesson list để xoá qua icon Xóa.
      await gotoKhoi(page, BASE_URL, KHOI);
      await openUnit(page, UNIT_LABEL);
      await openLesson(page, LESSON_LABEL);
      await deletePracticeByTitle(page, createdTitle);
      createdTitle = undefined;
    }
  });

  test('TC_TBT_011: bấm "Tạo & soạn câu hỏi" khi mất kết nối mạng', async () => {
    const dialog = await openAddPracticePopup(page);
    const input = dialog.locator(`input[placeholder="${po.addPopup.tenBaiInputPlaceholder}"]`);
    const createButton = dialog.getByRole("button", { name: po.addPopup.createButton, exact: true });
    const offlineTitle = `AUTO_QA_TBT011_${Date.now()}`;
    await input.fill(offlineTitle);

    // Giả lập mất mạng: chặn TOÀN BỘ request trước khi bấm tạo (xem docx mục 6.2).
    await page.route("**/*", (route) => route.abort());
    await createButton.click();

    // Popup KHÔNG đóng, KHÔNG điều hướng, giữ nguyên giá trị Tên bài đã nhập.
    await page.waitForTimeout(2000);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(input).toHaveValue(offlineTitle);
    await expect(page).toHaveURL(/\/teacher\/quiz\/[^/]+$/);

    await page.unroute("**/*");
    await dialog.getByRole("button", { name: po.addPopup.cancelButton, exact: true }).click();
  });
});
