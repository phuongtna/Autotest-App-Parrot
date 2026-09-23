import { test, expect } from "../../../../../automation/giao_bai_tap/playwrightTest.js";
import {
  themBaiThucHanhPageObjects as po,
  loginTeacherPortalUi,
  gotoKhoi,
  openUnit,
  openLesson,
  countAddPracticeButtons,
} from "../../../../../automation/them_bai_thuc_hanh/navigation/themBaiThucHanhPageObjects.js";

/**
 * Nhóm A (TC_TBT_001-003) - Hiển thị nút "Bài thực hành" trong Lesson (xem
 * Ke_hoach_Automation_Them_Bai_Thuc_Hanh.docx mục 5). CHỈ ĐỌC - không tạo/sửa/xóa dữ liệu nào, an
 * toàn chạy lặp lại.
 *
 * ĐÃ XÁC NHẬN THẬT (2026-09-23, debug live trên dev `https://parrotedu.codeinet.com`, tài khoản
 * `0915315315`, Khối 11 > UNIT 1: LEISURE TIME > READING): nút "Bài thực hành" là 1 <button> nằm
 * ngay dưới heading "Thêm nội dung của bài học" của Lesson ĐÃ MỞ (accordion) - xuất hiện KHÔNG
 * PHỤ THUỘC Lesson đã có item hay chưa. Accordion CỘNG DỒN (mở Lesson sau không đóng Lesson
 * trước, xem cùng ghi chú thật trong kho-de-ca-nhan-management.spec.js).
 *
 * ENV (bắt buộc): SOURCE_BASE_URL, SOURCE_USERNAME, SOURCE_PASSWORD.
 * ENV (tuỳ chọn, default khớp dữ liệu THẬT đã xác nhận trên tài khoản dev - đổi nếu tài khoản
 * khác không có đúng cấu trúc này): PRACTICE_KHOI, PRACTICE_UNIT_LABEL,
 * PRACTICE_LESSON_WITH_ITEMS, PRACTICE_LESSON_EMPTY, PRACTICE_LESSON_LABELS (danh sách phân tách
 * dấu phẩy, đúng thứ tự Lesson thật trong Unit).
 */
function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} (xem docblock đầu file).`);
  }
  return value;
}

test.describe.serial("Thêm bài thực hành > Nhóm A - Hiển thị nút (TC_TBT_001-003)", () => {
  const BASE_URL = readRequiredEnv("SOURCE_BASE_URL");
  const USERNAME = readRequiredEnv("SOURCE_USERNAME");
  const PASSWORD = readRequiredEnv("SOURCE_PASSWORD");
  const KHOI = process.env.PRACTICE_KHOI || "11";
  const UNIT_LABEL = process.env.PRACTICE_UNIT_LABEL || "UNIT 1: LEISURE TIME";
  const LESSON_WITH_ITEMS = process.env.PRACTICE_LESSON_WITH_ITEMS || "READING";
  const LESSON_EMPTY = process.env.PRACTICE_LESSON_EMPTY || "WRITING";
  const LESSON_LABELS = (
    process.env.PRACTICE_LESSON_LABELS || "PRONUNCIATION,VOCABULARY AND GRAMMAR,SPEAKING,READING,WRITING"
  ).split(",");

  let context;
  let page;

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
  });

  test('TC_TBT_001: hiển thị nút "Bài thực hành" khi Lesson đã có sẵn bài thực hành', async () => {
    const opened = await openLesson(page, LESSON_WITH_ITEMS);
    expect(opened, `Không tìm thấy Lesson "${LESSON_WITH_ITEMS}" trong Unit "${UNIT_LABEL}".`).toBe(true);

    await expect(page.getByText(po.lessonSection.itemTitlePrefix, { exact: false }).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByRole("button", { name: po.lessonSection.addPracticeButton, exact: true }).first(),
    ).toBeVisible();
  });

  test('TC_TBT_002: nút "Bài thực hành" vẫn hiển thị khi Lesson rỗng (0 bài thực hành)', async () => {
    const opened = await openLesson(page, LESSON_EMPTY);
    expect(opened, `Không tìm thấy Lesson "${LESSON_EMPTY}" trong Unit "${UNIT_LABEL}".`).toBe(true);

    const existingItems = await page.getByText(po.lessonSection.itemTitlePrefix, { exact: false }).count();
    expect(
      existingItems,
      `Lesson "${LESSON_EMPTY}" đang có ${existingItems} bài thực hành sẵn - không còn rỗng để test ` +
        "TC_TBT_002, đổi env PRACTICE_LESSON_EMPTY sang 1 Lesson khác thật sự rỗng trên tài khoản này.",
    ).toBe(0);

    await expect(
      page.getByRole("button", { name: po.lessonSection.addPracticeButton, exact: true }).first(),
    ).toBeVisible();
  });

  test('TC_TBT_003: nút "Bài thực hành" hiển thị nhất quán ở mọi Lesson trong cùng Unit', async () => {
    for (let i = 0; i < LESSON_LABELS.length; i++) {
      const label = LESSON_LABELS[i].trim();
      const opened = await openLesson(page, label);
      expect(opened, `Không tìm thấy Lesson "${label}" trong Unit "${UNIT_LABEL}".`).toBe(true);

      // Accordion cộng dồn - số nút "Bài thực hành" hiển thị phải tăng đúng bằng số Lesson đã mở
      // tới thời điểm này (đã xác nhận thật: mở lesson sau không đóng lesson trước).
      await expect
        .poll(() => countAddPracticeButtons(page), {
          message: `Số nút "Bài thực hành" phải bằng ${i + 1} sau khi mở Lesson "${label}"`,
          timeout: 10000,
        })
        .toBe(i + 1);
    }
  });
});
