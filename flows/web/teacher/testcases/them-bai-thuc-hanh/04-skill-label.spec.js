import { test, expect } from "../../../../../automation/giao_bai_tap/playwrightTest.js";
import {
  themBaiThucHanhPageObjects as po,
  loginTeacherPortalUi,
  gotoKhoi,
  openUnit,
  openLesson,
  openAddPracticePopup,
  locatePracticeRow,
  deletePracticeByTitle,
  readKyNangChipLabel,
  selectKyNang,
  getPracticeItemSkillTag,
  getPracticeItemSkillTagAfterSave,
} from "../../../../../automation/them_bai_thuc_hanh/navigation/themBaiThucHanhPageObjects.js";

/**
 * Nhóm D (TC_TBT_012-013, 044) - Nhãn Kỹ năng của bài thực hành mới tạo (xem
 * Ke_hoach_Automation_Them_Bai_Thuc_Hanh.docx mục 5 + 6.7 - case này đã được BA chốt hành vi
 * 17-19/09/2026: control "Kỹ năng" nằm ở panel "Thông tin đề" trên trang Chỉnh sửa đề bài).
 *
 * ĐÃ XÁC NHẬN THẬT (2026-09-23): control Kỹ năng là 1 chip/tag selector (`aria-haspopup="dialog"`)
 * nằm ngay dưới label "Kỹ năng" trong panel "Thông tin đề"; LUÔN có sẵn 1 chip mặc định (đọc được
 * qua `readKyNangChipLabel()`, KHÔNG hardcode tên skill vì có thể khác theo tài khoản/version) dù
 * CHƯA từng bấm "Lưu thay đổi" - nhưng nhãn Kỹ năng CHỈ xuất hiện trong danh sách Lesson SAU khi
 * đã Lưu (bài mới tạo, chưa lưu, xuất hiện trong Lesson list KHÔNG có nhãn nào - đã xác nhận thật
 * bằng debug live). Cấu trúc popover mở ra khi click chip CHƯA được xác nhận thật - xem lưu ý ở
 * `openKyNangPicker()`/`selectKyNang()` trong themBaiThucHanhPageObjects.js, cần chỉnh selector
 * nếu sai khi chạy thật lần đầu.
 *
 * TC_TBT_012 tạo dữ liệu thật (prefix `AUTO_QA_TBT012_`), TC_TBT_044 tạo dữ liệu thật (prefix
 * `AUTO_QA_TBT044_`) - CẢ 2 TỰ XOÁ ở afterEach qua `deletePracticeByTitle()`. TC_TBT_013 CHỈ ĐỌC
 * (dùng lại 1 item CÓ SẴN, không tạo/sửa/xóa gì).
 *
 * ENV (bắt buộc): SOURCE_BASE_URL, SOURCE_USERNAME, SOURCE_PASSWORD.
 * ENV (tuỳ chọn): PRACTICE_KHOI, PRACTICE_UNIT_LABEL, PRACTICE_LESSON_WITH_ITEMS,
 * PRACTICE_EXISTING_ITEM_TITLE (tiêu đề 1 item CÓ SẴN dùng cho TC_013/044 - default là item đầu
 * tiên xác nhận thật trên tài khoản dev "Read the passage and choose the best answer (A, B, C or
 * D) for each question."), PRACTICE_EXISTING_ITEM_SKILL_TAG (nhãn Kỹ năng hiển thị của item đó,
 * default "Đọc" - đã xác nhận thật).
 */
function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} (xem docblock đầu file).`);
  }
  return value;
}

test.describe.serial("Thêm bài thực hành > Nhóm D - Nhãn Kỹ năng (TC_TBT_012-013, 044)", () => {
  const BASE_URL = readRequiredEnv("SOURCE_BASE_URL");
  const USERNAME = readRequiredEnv("SOURCE_USERNAME");
  const PASSWORD = readRequiredEnv("SOURCE_PASSWORD");
  const KHOI = process.env.PRACTICE_KHOI || "11";
  const UNIT_LABEL = process.env.PRACTICE_UNIT_LABEL || "UNIT 1: LEISURE TIME";
  const LESSON_LABEL = process.env.PRACTICE_LESSON_WITH_ITEMS || "READING";
  const EXISTING_ITEM_TITLE =
    process.env.PRACTICE_EXISTING_ITEM_TITLE ||
    "Read the passage and choose the best answer (A, B, C or D) for each question.";
  const EXISTING_ITEM_SKILL_TAG = process.env.PRACTICE_EXISTING_ITEM_SKILL_TAG || "Đọc";

  let context;
  let page;
  let createdTitles = [];

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

  test.afterEach(async () => {
    if (createdTitles.length > 0) {
      await gotoKhoi(page, BASE_URL, KHOI);
      await openUnit(page, UNIT_LABEL);
      await openLesson(page, LESSON_LABEL);
      for (const title of createdTitles) {
        await deletePracticeByTitle(page, title);
      }
      createdTitles = [];
    }
  });

  test("TC_TBT_012: bài thực hành mới tạo có/không có nhãn Kỹ năng trong danh sách Lesson đúng theo trạng thái Lưu", async () => {
    // FIX (2026-09-23, xác nhận thật qua debug script riêng - `_debug_skill.mjs`): control Kỹ
    // năng có 1 giá trị mặc định NHƯNG giá trị mặc định đó CHỈ tồn tại ở state cục bộ ngay sau khi
    // vừa tạo (trang chưa từng rời đi) - nếu Thoát KHÔNG lưu rồi mở lại (editLink.click() nạp lại
    // dữ liệu ĐàLƯU từ server, lúc này thật sự null), control quay về trạng thái KHÔNG có giá trị,
    // không tự phục hồi lại default cũ. Vì vậy 2 nhánh (trước lưu / sau lưu) PHẢI dùng 2 item khác
    // nhau, mỗi item chỉ ghé thăm trang edit ĐÚNG 1 LƯỢT liên tục (không rời đi rồi quay lại giữa
    // chừng) - test cũ dùng lại 1 item cho cả 2 nhánh nên luôn FAIL nhánh sau lưu.

    // Nhánh 1: tạo item A, Thoát NGAY không lưu -> Lesson list KHÔNG được hiện nhãn nào.
    const titleNoSave = `AUTO_QA_TBT012_NOSAVE_${Date.now()}`;
    createdTitles.push(titleNoSave);
    const dialogA = await openAddPracticePopup(page);
    await dialogA.locator(`input[placeholder="${po.addPopup.tenBaiInputPlaceholder}"]`).fill(titleNoSave);
    await Promise.all([
      page.waitForURL(/\/teacher\/quiz\/[^/]+\/edit/, { timeout: 15000 }),
      dialogA.getByRole("button", { name: po.addPopup.createButton, exact: true }).click(),
    ]);
    await page.getByRole("button", { name: po.quizEditPage.exitButton, exact: true }).click();
    await expect(page.getByText(`${po.lessonSection.itemTitlePrefix}${titleNoSave}`, { exact: true })).toBeVisible({
      timeout: 10000,
    });
    const tagBeforeSave = await getPracticeItemSkillTag(page, titleNoSave);
    expect(tagBeforeSave, "Item chưa Lưu Kỹ năng thì KHÔNG được có nhãn trong Lesson list.").toBeNull();

    // Nhánh 2: tạo item B MỚI, đọc giá trị Kỹ năng mặc định rồi Lưu NGAY trong CÙNG 1 lượt ghé
    // trang (không rời đi giữa chừng) -> nhãn phải xuất hiện đúng giá trị đó trong Lesson list.
    const titleSaved = `AUTO_QA_TBT012_SAVED_${Date.now()}`;
    createdTitles.push(titleSaved);
    const dialogB = await openAddPracticePopup(page);
    await dialogB.locator(`input[placeholder="${po.addPopup.tenBaiInputPlaceholder}"]`).fill(titleSaved);
    await Promise.all([
      page.waitForURL(/\/teacher\/quiz\/[^/]+\/edit/, { timeout: 15000 }),
      dialogB.getByRole("button", { name: po.addPopup.createButton, exact: true }).click(),
    ]);
    const defaultSkillLabel = await readKyNangChipLabel(page);
    expect(defaultSkillLabel, "Control Kỹ năng phải có sẵn 1 giá trị mặc định.").toBeTruthy();

    await page.getByRole("button", { name: po.quizEditPage.saveButton, exact: true }).click();
    // FIX (2026-09-23, FAIL thật xác nhận 2 lần liên tiếp): toast "thành công" hiện RA NGAY khi
    // bấm Lưu (optimistic UI) - KHÔNG chờ request lưu thật sự xong, nên chỉ chờ toast là CHƯA đủ
    // (Kỹ năng vẫn không được lưu nếu Thoát ngay sau đó). Phải chờ thêm `networkidle` để request
    // lưu thật sự hoàn tất trước khi điều hướng đi.
    await expect(page.getByText(/thành công/i).first()).toBeVisible({ timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: po.quizEditPage.exitButton, exact: true }).click();

    // FIX (2026-09-23, FAIL thật xác nhận qua debug riêng, RELOAD 1 LẦN CÓ LÚC VẪN CHƯA ĐỦ): sau
    // "Thoát", danh sách Lesson dùng lại dữ liệu đã fetch từ TRƯỚC lúc Lưu (điều hướng client-side
    // không tự refetch) - nhãn Kỹ năng MỚI lưu có độ trễ, cần reload LẶP LẠI vài lần
    // (`getPracticeItemSkillTagAfterSave`) mới chắc chắn đọc đúng giá trị đã lưu.
    const tagAfterSave = await getPracticeItemSkillTagAfterSave(page, titleSaved);
    expect(
      tagAfterSave,
      `Nhãn Kỹ năng của "${titleSaved}" phải hiển thị đúng giá trị đã Lưu ("${defaultSkillLabel}")`,
    ).toBe(defaultSkillLabel);
  });

  test('TC_TBT_013: control "Kỹ năng" tồn tại trong panel "Thông tin đề" trên trang Chỉnh sửa đề bài', async () => {
    const row = await locatePracticeRow(page, EXISTING_ITEM_TITLE);
    expect(row, `Không tìm thấy item có sẵn "${EXISTING_ITEM_TITLE}" để mở Sửa (chỉ đọc, không tạo mới).`).toBeTruthy();
    await row.editLink.click();
    await page.waitForURL(/\/teacher\/quiz\/[^/]+\/edit/, { timeout: 15000 });

    const infoPanel = page.getByText(po.quizEditPage.infoPanelHeading, { exact: true }).locator("xpath=ancestor::div[1]");
    await expect(infoPanel.getByText(po.quizEditPage.kyNangLabel, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: po.quizEditPage.exitButton, exact: true }).click();
  });

  test("TC_TBT_044: đối chiếu nhãn Kỹ năng giữa bài thực hành MỚI tạo và bài CŨ cùng Lesson - phải nhất quán", async () => {
    const newTitle = `AUTO_QA_TBT044_${Date.now()}`;
    createdTitles.push(newTitle);
    const dialog = await openAddPracticePopup(page);
    await dialog.locator(`input[placeholder="${po.addPopup.tenBaiInputPlaceholder}"]`).fill(newTitle);
    await Promise.all([
      page.waitForURL(/\/teacher\/quiz\/[^/]+\/edit/, { timeout: 15000 }),
      dialog.getByRole("button", { name: po.addPopup.createButton, exact: true }).click(),
    ]);

    await selectKyNang(page, EXISTING_ITEM_SKILL_TAG);
    await expect(async () => {
      expect(await readKyNangChipLabel(page)).toBe(EXISTING_ITEM_SKILL_TAG);
    }).toPass({ timeout: 10000 });

    await page.getByRole("button", { name: po.quizEditPage.saveButton, exact: true }).click();
    // Xem FIX cùng lý do ở TC_TBT_012 phía trên - toast hiện optimistic, phải chờ thêm networkidle.
    await expect(page.getByText(/thành công/i).first()).toBeVisible({ timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: po.quizEditPage.exitButton, exact: true }).click();
    // Xem cùng lý do ở TC_TBT_012 - reload lặp lại tới khi nhãn Kỹ năng mới lưu xuất hiện. Đọc
    // `oldTag` (item CŨ, ổn định lâu dài) cũng dùng hàm này thay vì gọi thẳng
    // `getPracticeItemSkillTag()` - đã xác nhận thật đọc thẳng đôi khi vẫn trúng lúc React
    // re-render dở dang, ra `null` oan cho 1 item vốn LUÔN có nhãn ổn định.
    const newTag = await getPracticeItemSkillTagAfterSave(page, newTitle);
    const oldTag = await getPracticeItemSkillTagAfterSave(page, EXISTING_ITEM_TITLE);
    expect(
      newTag,
      `Nhãn Kỹ năng của bài MỚI ("${newTag}") phải khớp bài CŨ cùng Lesson ("${oldTag}").`,
    ).toBe(oldTag);
  });
});
