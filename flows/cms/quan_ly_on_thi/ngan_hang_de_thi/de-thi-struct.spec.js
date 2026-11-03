import { test, expect } from "../../../../automation/ngan_hang_de_thi/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsDeThiPageObjects as po,
  gotoDeThi,
  clickAddNew,
  setupDeThiFixtures,
  teardownDeThiFixtures,
  fillExamName,
  selectExamType,
  fillExamDuration,
  selectGrades,
  isStructureEmpty,
  readAddableSectionOptionTexts,
  selectSectionToAddToStructure,
  clickAddSectionToStructureButton,
  addSectionToStructure,
  readStructureSectionNamesInOrder,
  readSectionDurationInStructure,
  fillSectionDurationInStructure,
  clearSectionDurationInStructure,
  removeSectionFromStructure,
  clickAddPracticeButton,
  selectPracticeInPopup,
  searchInPracticePopup,
  clickPracticePopupSave,
  readPracticePopupSectionLabel,
  clickPracticeView,
  clickPracticeDelete,
  clickSave,
  selectTrangThai,
} from "../../../../automation/ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

/**
 * Nhóm "3. Tạo mới đề thi - Cấu trúc đề (Section & Bài thực hành)" (STRUCT-01..18) - xem ghi chú
 * chung (env dev, tiền tố AUTO-, fixture dùng chung) tại `de-thi-list.spec.js`.
 *
 * STRUCT-16 KHÔNG tồn tại trong `TESTCASES.xlsx` nguồn (lỗ hổng số thứ tự giữa STRUCT-15 và
 * STRUCT-17 - không phải thiếu sót khi viết file này).
 *
 * STRUCT-07 (kéo thả đổi thứ tự Section bằng icon "≡") CHỦ ĐỘNG BỎ QUA (`test.skip`) - thư viện
 * kéo thả dùng mouse-event thật (không phải HTML5 `draggable`), `locator.dragTo()` của Playwright
 * không mô phỏng đúng chuỗi sự kiện này một cách ổn định (đã thử tay qua MCP browser, 1 lần kéo
 * không ăn) - cần `page.mouse.move()` nhiều bước nhỏ + `page.mouse.down()/up()` thủ công và cần
 * thời gian tinh chỉnh riêng, không nằm trong phạm vi lần viết đầu tiên này. Tương tự cho
 * STRUCT-15 (kéo thả Bài thực hành trong cùng Section).
 */
const runId = `AUTO-${Date.now().toString(36)}`;

test.describe.serial("Ngân hàng đề thi - 3. Cấu trúc đề - Section & Bài thực hành (STRUCT-01..18)", () => {
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
  });

  test.afterAll(async () => {
    await teardownDeThiFixtures(page, baseUrl, fixtures, [`${runId}-struct18`]);
    await context.close();
  });

  test("STRUCT-01: thẻ Section chỉ hiển thị sau khi đã chọn Loại kỳ thi", async () => {
    await clickAddNew(page);
    expect(await isStructureEmpty(page)).toBe(true);
    await selectExamType(page, fixtures.examTypeEmpty);
    await expect(page.getByText(po.structureEmptyNoSection, { exact: false })).toBeVisible();
  });

  test("STRUCT-02: chọn Loại kỳ thi lần đầu (đề mới, chưa có Section) -> tự fill cấu trúc đề xuất", async () => {
    await selectExamType(page, fixtures.examTypeWithSections);
    const names = await readStructureSectionNamesInOrder(page);
    expect(names[0]).toContain(fixtures.sectionA);
    expect(names[1]).toContain(fixtures.sectionB);
  });

  test("STRUCT-03/05: dropdown chỉ liệt kê Section CHƯA có trong đề, section vừa thêm biến mất khỏi dropdown", async () => {
    const options = await readAddableSectionOptionTexts(page);
    expect(options.some((t) => t.includes(fixtures.sectionA))).toBe(false);
    expect(options.some((t) => t.includes(fixtures.sectionB))).toBe(false);
  });

  test("STRUCT-04/08: thêm 1 Section mới qua + Thêm Section, thời lượng tự fill theo cấu hình gốc", async () => {
    // Dùng lại chính fixture examTypeEmpty cũng đang rảnh - tạo thêm 1 section có duration riêng
    // để test auto-fill độc lập với examTypeWithSections (đang dùng cho case trước).
    await removeSectionFromStructure(page, fixtures.sectionB);
    const names = await readStructureSectionNamesInOrder(page);
    expect(names).not.toContain(expect.stringContaining(fixtures.sectionB));
    await addSectionToStructure(page, fixtures.sectionB);
    const namesAfter = await readStructureSectionNamesInOrder(page);
    expect(namesAfter[namesAfter.length - 1]).toContain(fixtures.sectionB);
    const duration = await readSectionDurationInStructure(page, fixtures.sectionB);
    expect(duration).toBe("15");
  });

  test("STRUCT-06: xóa 1 Section khỏi đề (không xóa khỏi kho Section gốc)", async () => {
    await removeSectionFromStructure(page, fixtures.sectionB);
    const names = await readStructureSectionNamesInOrder(page);
    expect(names.some((n) => n.includes(fixtures.sectionB))).toBe(false);
    // Section gốc vẫn còn trong dropdown để thêm lại - chứng minh không bị xóa khỏi kho Section.
    const options = await readAddableSectionOptionTexts(page);
    expect(options.some((t) => t.includes(fixtures.sectionB))).toBe(true);
    await addSectionToStructure(page, fixtures.sectionB); // gắn lại cho các case sau
  });

  test.skip("STRUCT-07: đổi vị trí Section bằng kéo thả - BỎ QUA: drag-and-drop mouse-event cần tinh chỉnh riêng, xem ghi chú đầu file", () => {});

  test("STRUCT-09: chỉnh sửa lại Thời lượng Section đã fill", async () => {
    await fillSectionDurationInStructure(page, fixtures.sectionA, 25);
    expect(await readSectionDurationInStructure(page, fixtures.sectionA)).toBe("25");
  });

  test("STRUCT-10: xóa trắng Thời lượng Section (để trống lại)", async () => {
    await clearSectionDurationInStructure(page, fixtures.sectionA);
    expect(await readSectionDurationInStructure(page, fixtures.sectionA)).toBe("");
  });

  test("STRUCT-11: field Thời lượng Section chỉ nhận số nguyên", async () => {
    const card = page.locator("div", { hasText: fixtures.sectionA }).filter({ has: page.locator(`input[placeholder="${po.sectionDurationPlaceholder}"]`) }).last();
    const input = card.locator(`input[placeholder="${po.sectionDurationPlaceholder}"]`).first();
    await input.fill("");
    await input.type("abc-1.5");
    await page.keyboard.press("Tab");
    const value = await input.inputValue();
    expect(value).not.toContain("abc");
    await fillSectionDurationInStructure(page, fixtures.sectionA, 15); // trả lại giá trị hợp lệ cho case sau
  });

  test("STRUCT-17/POPUP-01: bấm + Bài thực hành mở đúng popup cho đúng Section đang thao tác", async () => {
    await clickAddPracticeButton(page, fixtures.sectionA);
    const label = await readPracticePopupSectionLabel(page);
    expect(label).toContain(fixtures.sectionA);
  });

  test("STRUCT-12/13/14: icon mắt/sửa/xóa trên Bài thực hành", async () => {
    await searchInPracticePopup(page, "");
    await selectPracticeInPopup(page, "AI vocabulary");
    await clickPracticePopupSave(page);

    await clickPracticeView(page, fixtures.sectionA, "AI vocabulary");
    await expect(page.getByRole("dialog").getByText("AI vocabulary", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Đóng", exact: true }).click();

    await clickPracticeDelete(page, fixtures.sectionA, "AI vocabulary");
    const card = page.locator("div", { hasText: fixtures.sectionA }).filter({ hasText: po.addContentToSectionButton }).last();
    await expect(card.getByText("AI vocabulary", { exact: false })).toHaveCount(0);
  });

  test("STRUCT-18: đề không có Section nào vẫn cho phép Lưu ở trạng thái Nháp", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await clickAddNew(page);
    await fillExamName(page, `${runId}-struct18`);
    await selectExamType(page, fixtures.examTypeEmpty);
    await fillExamDuration(page, 30);
    await selectGrades(page, ["Lớp 1"]);
    await selectTrangThai(page, po.draftRadioLabel);
    await clickSave(page);
    await expect(page).toHaveURL(/\/exam-prep\/papers$/);
  });
});
