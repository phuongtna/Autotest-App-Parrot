import { test, expect } from "../../../../automation/ngan_hang_de_thi/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsDeThiPageObjects as po,
  gotoDeThi,
  clickAddNew,
  fillExamName,
  selectExamType,
  fillExamDuration,
  selectGrades,
  setupDeThiFixtures,
  teardownDeThiFixtures,
  clickAddPracticeButton,
  readPracticePopupSectionLabel,
  searchInPracticePopup,
  readPracticePopupOptionTexts,
  selectPracticeInPopup,
  clickPracticePopupSave,
  clickPracticePopupCancel,
  practiceRow,
} from "../../../../automation/ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

/**
 * Nhóm "8. Popup Thêm mới Bài thực hành" (POPUP-01..10) - xem ghi chú chung tại
 * `de-thi-list.spec.js`. POPUP-01 đã test lồng trong `de-thi-struct.spec.js` (case STRUCT-17,
 * cùng 1 lần quan sát mở popup) - file này tập trung các case còn lại.
 *
 * POPUP-07 ("[Edge - cần xác nhận BA]") viết ở mức EXPLORATORY (không gắn `expect` cứng đúng/sai)
 * - chỉ ghi nhận quan sát khách quan, đúng tinh thần đánh dấu "cần xác nhận BA" trong
 * `TESTCASES.xlsx`.
 */
const runId = `AUTO-${Date.now().toString(36)}`;
const EXAM = `${runId}-popup`;

test.describe.serial("Ngân hàng đề thi - 8. Popup Thêm mới Bài thực hành (POPUP-01..10)", () => {
  let context;
  let page;
  let baseUrl;
  let fixtures;

  test.beforeAll(async ({ browser }) => {
    requireCmsAdminConfig();
    baseUrl = resolveCmsAdminBaseUrl("dev");
    const { username, password } = resolveCmsAdminCredentials("dev");
    context = await browser.newContext();
    page = await context.newPage();

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator(po.login.usernameInput).fill(username);
    await page.locator(po.login.passwordInput).fill(password);
    await page.getByRole("button", { name: po.login.submitButton }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    fixtures = await setupDeThiFixtures(page, baseUrl, runId);
    await gotoDeThi(page, baseUrl);
    await clickAddNew(page);
    await fillExamName(page, EXAM);
    await selectExamType(page, fixtures.examTypeWithSections);
    await fillExamDuration(page, 25);
    await selectGrades(page, ["Lớp 1"]);
  });

  test.afterAll(async () => {
    await teardownDeThiFixtures(page, baseUrl, fixtures, [EXAM]);
    await context.close();
  });

  test("POPUP-02: danh sách liệt kê đúng các bài thực hành trong kho core exam khi chưa gõ tìm kiếm", async () => {
    await clickAddPracticeButton(page, fixtures.sectionA);
    const texts = await readPracticePopupOptionTexts(page);
    expect(texts.length).toBeGreaterThan(0);
  });

  test("POPUP-03: tìm kiếm theo tên trong popup", async () => {
    await searchInPracticePopup(page, "vocabulary");
    const texts = await readPracticePopupOptionTexts(page);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.every((t) => t.toLowerCase().includes("vocabulary"))).toBe(true);
  });

  test("POPUP-04: tìm kiếm không có kết quả trong popup", async () => {
    await searchInPracticePopup(page, "zzz-khong-ton-tai-zzz");
    const texts = await readPracticePopupOptionTexts(page);
    expect(texts.length).toBe(0);
  });

  test("POPUP-08: chọn 1 bài thực hành rồi bấm Lưu -> xuất hiện ở cuối danh sách của đúng Section", async () => {
    await searchInPracticePopup(page, "AI vocabulary");
    await selectPracticeInPopup(page, "AI vocabulary");
    await clickPracticePopupSave(page);
    await expect(practiceRow(page, fixtures.sectionA, "AI vocabulary")).toBeVisible();
  });

  test("POPUP-05/06: Bài thực hành đã gắn vào section này bị ẩn khỏi danh sách chọn ở lần mở popup kế tiếp", async () => {
    await clickAddPracticeButton(page, fixtures.sectionA);
    const texts = await readPracticePopupOptionTexts(page);
    expect(texts.some((t) => t.includes("AI vocabulary"))).toBe(false);
    // Dòng ghi chú số lượng đề đã ẩn (POPUP-06) - đọc khách quan nếu tồn tại, không ép cứng số vì
    // phụ thuộc đúng 1 bài đã gắn (khác với kịch bản mẫu "2 đề" trong TESTCASES.xlsx).
    const hiddenNote = page.getByText(/Đã ẩn\s*\d+\s*đề/, { exact: false });
    if (await hiddenNote.count()) {
      await expect(hiddenNote.first()).toContainText("1");
    }
    await clickPracticePopupCancel(page);
  });

  test("POPUP-07: [Edge - cần xác nhận BA] 1 Bài thực hành được chọn cho Section khác trong cùng đề", async () => {
    await clickAddPracticeButton(page, fixtures.sectionB);
    const texts = await readPracticePopupOptionTexts(page);
    const stillVisible = texts.some((t) => t.includes("AI vocabulary"));
    // Quan sát khách quan, KHÔNG assert cứng đúng/sai - ghi log để người đọc report tự đối chiếu
    // với kỳ vọng "vẫn hiển thị" trong TESTCASES.xlsx, cần BA xác nhận đây có phải hành vi mong
    // muốn hay không trước khi coi là Pass/Fail chính thức.
    console.log(`POPUP-07 [Exploratory]: bài "AI vocabulary" đã gắn ở Section A, mở popup Section B -> ${stillVisible ? "VẪN hiển thị" : "BỊ ẨN"} (kỳ vọng trong xlsx: vẫn hiển thị)`);
    await clickPracticePopupCancel(page);
  });

  test("POPUP-09: bấm Lưu khi chưa chọn bài thực hành nào -> không thêm được gì", async () => {
    await clickAddPracticeButton(page, fixtures.sectionB);
    const before = await readPracticePopupOptionTexts(page);
    await clickPracticePopupSave(page);
    // Popup có thể vẫn mở (chặn Lưu) hoặc đóng mà không thêm gì - chỉ assert KHÔNG có bài nào mới
    // xuất hiện ở Section B.
    await page.waitForTimeout(300);
    const card = page.locator("div", { hasText: fixtures.sectionB }).filter({ hasText: po.addContentToSectionButton }).last();
    const rowCount = await card.locator("text=/Xem|Sửa/").count();
    expect(rowCount).toBe(0);
    if (await page.getByRole("dialog").getByText(po.popupAddPracticeTitle, { exact: true }).isVisible().catch(() => false)) {
      await clickPracticePopupCancel(page);
    }
  });

  test("POPUP-10: bấm Hủy đóng popup không thêm gì dù đã chọn 1 bài", async () => {
    await clickAddPracticeButton(page, fixtures.sectionB);
    await selectPracticeInPopup(page, "Reading 01");
    await clickPracticePopupCancel(page);
    const card = page.locator("div", { hasText: fixtures.sectionB }).filter({ hasText: po.addContentToSectionButton }).last();
    await expect(card.getByText("Reading 01", { exact: false })).toHaveCount(0);
  });
});
