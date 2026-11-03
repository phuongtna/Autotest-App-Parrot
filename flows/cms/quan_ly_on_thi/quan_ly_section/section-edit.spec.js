import { test, expect } from "../../../../automation/quan_ly_section/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsSectionPageObjects as po,
  gotoSections,
  createSection,
  openEditSectionPopup,
  fillSectionForm,
  saveSectionPopup,
  cancelSectionPopup,
  closeSectionPopupByIcon,
  readDialogText,
  readRowSkill,
  readRowDuration,
  readAllSectionNamesInOrder,
  readSelectedSkillInForm,
  deleteSectionByName,
} from "../../../../automation/quan_ly_section/navigation/cmsSectionPageObjects.js";

/**
 * Nhóm "3. Chỉnh sửa Section" (EDIT-01..14) - xem ghi chú chung (env dev, tiền tố AUTO-) tại
 * `section-list.spec.js`.
 *
 * EDIT-04/05/12/13 BỎ QUA (`test.skip`) - cần thao tác trên màn "Ngân hàng đề thi" (gắn Section
 * vào 1 Đề thi, kiểm tra cascade/không-cascade) - MÀN KHÁC, ngoài phạm vi `/exam-prep/sections` mà
 * automation module này bao phủ. `flows/cms/quan_ly_on_thi/quan_ly_section/TESTCASES.md` ghi nhận
 * các case này đã chạy tay Pass (2026-10-19) - tự động hoá đầy đủ cần viết thêm page objects cho
 * màn Ngân hàng đề thi (việc riêng, chưa có trong phạm vi yêu cầu lần này).
 *
 * EDIT-07 (bỏ chọn Kỹ năng) ĐÃ XÁC NHẬN THẬT (2026-11-03): select Kỹ năng CÓ hiện icon "clear" khi
 * hover nhưng bấm vào KHÔNG xoá được giá trị đang chọn (hệ thống không cho phép bỏ trống Kỹ năng ở
 * form Sửa) - khác hành vi "chặn khi Lưu" như ADD, ở đây select tự giữ nguyên giá trị.
 */
const SECTION_ENV = process.env.QUAN_LY_SECTION_ENV || "dev";
const runId = `AUTO-${Date.now().toString(36)}`;
const BASE = `${runId}-base`;
const ORDER_A = `${runId}-ord-A`;
const ORDER_B = `${runId}-ord-B`;
const ORDER_C = `${runId}-ord-C`;
const createdNames = [BASE, ORDER_A, ORDER_B, ORDER_C];

test.describe.serial("Quản lý Section - 3. Chỉnh sửa Section (EDIT-01..14)", () => {
  let context;
  let page;
  let baseUrl;

  test.beforeAll(async ({ browser }) => {
    requireCmsAdminConfig();
    baseUrl = resolveCmsAdminBaseUrl(SECTION_ENV);
    const { username, password } = resolveCmsAdminCredentials(SECTION_ENV);
    context = await browser.newContext();
    page = await context.newPage();

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator(po.login.usernameInput).fill(username);
    await page.locator(po.login.passwordInput).fill(password);
    await page.getByRole("button", { name: po.login.submitButton }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    await gotoSections(page, baseUrl);
    await createSection(page, { name: BASE, skill: "Đọc", duration: 20 });
  });

  test.afterAll(async () => {
    for (const name of createdNames) {
      await deleteSectionByName(page, name).catch(() => {});
    }
    await context.close();
  });

  test("EDIT-01: mở popup Sửa hiển thị đúng dữ liệu hiện tại", async () => {
    await gotoSections(page, baseUrl);
    await openEditSectionPopup(page, BASE);
    await expect(page.getByRole("dialog").getByText(po.editDialogTitle)).toBeVisible();
    await expect(page.locator(po.nameInput)).toHaveValue(BASE);
    expect((await readSelectedSkillInForm(page)).trim()).toBe("Đọc");
    await expect(page.locator(po.durationInput)).toHaveValue("20");
    await cancelSectionPopup(page);
  });

  test("EDIT-02: sửa Tên phần thi -> bảng cập nhật ngay, không cần tải lại", async () => {
    const newName = `${BASE}-renamed`;
    await openEditSectionPopup(page, BASE);
    await fillSectionForm(page, { name: newName });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(po.tableRowSelector, { hasText: newName })).toBeVisible();
    // đổi lại tên gốc để các case sau (và afterAll cleanup) vẫn định vị được bằng BASE
    await openEditSectionPopup(page, newName);
    await fillSectionForm(page, { name: BASE });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("EDIT-03: sửa Kỹ năng -> cột Kỹ năng cập nhật đúng giá trị mới", async () => {
    await openEditSectionPopup(page, BASE);
    await fillSectionForm(page, { skill: "Viết" });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await readRowSkill(page, BASE)).trim()).toBe("Viết");
    // trả lại Kỹ năng gốc cho các case sau
    await openEditSectionPopup(page, BASE);
    await fillSectionForm(page, { skill: "Đọc" });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test.skip(
    "EDIT-04: sửa Thời lượng của Section đã gắn vào Đề thi - không cascade - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "EDIT-05: Thời lượng trong Đề thi vẫn sửa được riêng - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );

  test("EDIT-06: validate khi Sửa - xóa trống Tên phần thi", async () => {
    await openEditSectionPopup(page, BASE);
    await fillSectionForm(page, { name: "" });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await readDialogText(page)).toContain(po.nameRequiredError);
    await cancelSectionPopup(page);
    await expect(page.locator(po.tableRowSelector, { hasText: BASE })).toBeVisible();
  });

  test("EDIT-07: bỏ chọn Kỹ năng - hệ thống không cho phép, giữ nguyên giá trị đang chọn", async () => {
    await openEditSectionPopup(page, BASE);
    const before = (await readSelectedSkillInForm(page)).trim();
    const skillSelect = page.getByRole("dialog").locator(".n-base-selection");
    const clearBtn = skillSelect.locator(".n-base-clear, [class*='clear']").first();
    await skillSelect.hover();
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click().catch(() => {});
    }
    const after = (await readSelectedSkillInForm(page)).trim();
    expect(after).toBe(before);
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await readRowSkill(page, BASE)).trim()).toBe(before);
  });

  test("EDIT-08: bấm Hủy khi đang sửa -> dữ liệu gốc giữ nguyên", async () => {
    await openEditSectionPopup(page, BASE);
    await fillSectionForm(page, { name: `${BASE}-should-not-save`, skill: "Nói" });
    await cancelSectionPopup(page);
    await expect(page.locator(po.tableRowSelector, { hasText: BASE })).toBeVisible();
    expect((await readRowSkill(page, BASE)).trim()).toBe("Đọc");
  });

  test("EDIT-09: sửa Thời lượng từ có giá trị về trống -> hiển thị '—'", async () => {
    await openEditSectionPopup(page, BASE);
    await fillSectionForm(page, { duration: null });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await readRowDuration(page, BASE)).trim()).toBe(po.emptyDurationText);
    // khôi phục Thời lượng cho các case sau (không ảnh hưởng case nào đọc giá trị này)
    await openEditSectionPopup(page, BASE);
    await fillSectionForm(page, { duration: 20 });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("EDIT-10: vị trí trong danh sách không đổi sau khi Sửa section không phải mới nhất", async () => {
    await createSection(page, { name: ORDER_A, skill: "Nghe" });
    await createSection(page, { name: ORDER_B, skill: "Nghe" });
    await createSection(page, { name: ORDER_C, skill: "Nghe" });
    const beforeNames = await readAllSectionNamesInOrder(page);
    const beforeIdxB = beforeNames.indexOf(ORDER_B);
    expect(beforeIdxB).toBeGreaterThanOrEqual(0);

    await openEditSectionPopup(page, ORDER_B);
    await fillSectionForm(page, { skill: "Viết" });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const afterNames = await readAllSectionNamesInOrder(page);
    expect(afterNames.indexOf(ORDER_B)).toBe(beforeIdxB);
    // C (tạo sau B) vẫn phải đứng trước B - B không nhảy lên đầu
    expect(afterNames.indexOf(ORDER_C)).toBeLessThan(afterNames.indexOf(ORDER_B));
  });

  test("EDIT-11: đóng popup Sửa bằng icon '×' -> dữ liệu gốc giữ nguyên", async () => {
    await openEditSectionPopup(page, BASE);
    await fillSectionForm(page, { name: `${BASE}-should-not-save-x` });
    await closeSectionPopupByIcon(page);
    await expect(page.locator(po.tableRowSelector, { hasText: BASE })).toBeVisible();
  });

  test.skip(
    "EDIT-12: sửa Section đã gắn Đề thi đã Công khai vẫn được phép - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "EDIT-13: sửa Tên/Kỹ năng của Section đã gắn Đề thi - cascade - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );

  test("EDIT-14: validate khi Sửa - Thời lượng sai định dạng -> KHÔNG lưu, Thời lượng gốc giữ nguyên", async () => {
    // ĐÃ XÁC NHẬN THẬT (2026-11-03): khác ADD-06 (field rỗng -> gõ sai định dạng -> vẫn rỗng),
    // ở đây field ĐANG CÓ giá trị (20) - gõ sai định dạng rồi blur khiến n-input-number tự đảo về
    // giá trị HỢP LỆ GẦN NHẤT (= 20, giá trị gốc), đúng mô tả spec "Thời lượng gốc giữ nguyên".
    await openEditSectionPopup(page, BASE);
    await fillSectionForm(page, { duration: "xyz" });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await readRowDuration(page, BASE)).trim()).toBe("20 phút");
  });
});
