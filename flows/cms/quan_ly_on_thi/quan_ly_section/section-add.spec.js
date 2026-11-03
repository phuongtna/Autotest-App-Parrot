import { test, expect } from "../../../../automation/quan_ly_section/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsSectionPageObjects as po,
  gotoSections,
  openAddSectionPopup,
  fillSectionForm,
  saveSectionPopup,
  cancelSectionPopup,
  closeSectionPopupByIcon,
  readDialogText,
  readRowDuration,
  readRowSkill,
  sectionRow,
} from "../../../../automation/quan_ly_section/navigation/cmsSectionPageObjects.js";

/**
 * Nhóm "2. Thêm mới Section" (ADD-01..13) - xem ghi chú chung (env dev, tiền tố AUTO-) tại
 * `section-list.spec.js`.
 *
 * Hành vi field "Thời lượng" (Naive UI n-input-number) ĐÃ XÁC NHẬN THẬT qua Playwright trên dev
 * (2026-11-03), dùng làm cơ sở cho ADD-06/ADD-08 (KHÔNG suy đoán):
 *   - Gõ chữ cái ("abc") -> field tự xoá trắng khi blur -> Lưu thành công với Thời lượng rỗng ("—").
 *   - Gõ số 0 hoặc số âm (vd "-5") -> field tự ép về `1` khi blur -> Lưu thành công, hiển thị "1 phút".
 *   - Gõ số thập phân (vd "12.5") -> làm tròn thành số nguyên khi blur (không kiểm tra trong file
 *     này, chỉ ADD-06/08 cần).
 */
const SECTION_ENV = process.env.QUAN_LY_SECTION_ENV || "dev";
const runId = `AUTO-${Date.now().toString(36)}`;
// KHÔNG tự xóa dữ liệu test sau khi chạy (theo yêu cầu 2026-11-03) - `trackName()` chỉ còn mang
// tính đặt tên rõ ràng (đánh dấu section này DO automation tạo), không còn dùng để dọn dẹp.
function trackName(name) {
  return name;
}

test.describe.serial("Quản lý Section - 2. Thêm mới Section (ADD-01..13)", () => {
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
  });

  test.afterAll(async () => {
    // KHÔNG xóa dữ liệu test - theo yêu cầu, giữ lại để xem sau khi chạy.
    await context.close();
  });

  test("ADD-01: mở popup Thêm mới - 3 field trống, placeholder đúng", async () => {
    await openAddSectionPopup(page);
    await expect(page.getByRole("dialog").getByText(po.addDialogTitle)).toBeVisible();
    await expect(page.locator(po.nameInput)).toHaveValue("");
    await expect(page.getByText(po.skillPlaceholder)).toBeVisible();
    await expect(page.locator(po.durationInput)).toHaveValue("");
    await cancelSectionPopup(page);
  });

  test("ADD-02: validate thiếu 'Tên phần thi'", async () => {
    await openAddSectionPopup(page);
    await fillSectionForm(page, { skill: "Nghe" });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await readDialogText(page)).toContain(po.nameRequiredError);
    await cancelSectionPopup(page);
  });

  test("ADD-03: validate thiếu 'Kỹ năng'", async () => {
    await openAddSectionPopup(page);
    await fillSectionForm(page, { name: trackName(`${runId}-add03`) });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await readDialogText(page)).toContain(po.skillRequiredError);
    await cancelSectionPopup(page);
  });

  test("ADD-04: validate thiếu đồng thời cả 2 field bắt buộc", async () => {
    await openAddSectionPopup(page);
    await saveSectionPopup(page);
    const text = await readDialogText(page);
    expect(text).toContain(po.nameRequiredError);
    expect(text).toContain(po.skillRequiredError);
    await cancelSectionPopup(page);
  });

  test("ADD-05: Thời lượng không bắt buộc - tạo thành công, hiển thị '—'", async () => {
    const name = trackName(`${runId}-add05`);
    await openAddSectionPopup(page);
    await fillSectionForm(page, { name, skill: "Nghe" });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await readRowDuration(page, name)).trim()).toBe(po.emptyDurationText);
  });

  test("ADD-06: Thời lượng gõ ký tự không hợp lệ -> tự xoá trắng, lưu thành công không có Thời lượng", async () => {
    const name = trackName(`${runId}-add06`);
    await openAddSectionPopup(page);
    await fillSectionForm(page, { name, skill: "Nghe", duration: "abc" });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await readRowDuration(page, name)).trim()).toBe(po.emptyDurationText);
  });

  test("ADD-07: tạo mới hợp lệ đầy đủ 3 field", async () => {
    const name = trackName(`${runId}-add07`);
    await openAddSectionPopup(page);
    await fillSectionForm(page, { name, skill: "Đọc", duration: 20 });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await readRowSkill(page, name)).trim()).toBe("Đọc");
    expect((await readRowDuration(page, name)).trim()).toBe("20 phút");
  });

  test("ADD-08: Thời lượng = 0 hoặc số âm -> hệ thống tự ép về tối thiểu 1 phút", async () => {
    const name = trackName(`${runId}-add08`);
    await openAddSectionPopup(page);
    await fillSectionForm(page, { name, skill: "Nghe", duration: "-5" });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await readRowDuration(page, name)).trim()).toBe("1 phút");
  });

  test("ADD-09: bấm Hủy khi đang nhập dở -> không tạo mới", async () => {
    const name = `${runId}-add09-notcreated`;
    await openAddSectionPopup(page);
    await fillSectionForm(page, { name, skill: "Nghe", duration: 10 });
    await cancelSectionPopup(page);
    expect(await sectionRow(page, name).count()).toBe(0);
  });

  test("ADD-10: tạo 2 Section trùng tên -> bị chặn", async () => {
    const name = trackName(`${runId}-add10-dup`);
    await openAddSectionPopup(page);
    await fillSectionForm(page, { name, skill: "Nghe" });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await openAddSectionPopup(page);
    await fillSectionForm(page, { name, skill: "Viết" });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await readDialogText(page)).toContain(po.nameDuplicateError);
    await cancelSectionPopup(page);
    expect(await sectionRow(page, name).count()).toBe(1);
  });

  test("ADD-11: đóng popup bằng icon '×' -> hành vi giống Hủy, không tạo mới", async () => {
    const name = `${runId}-add11-notcreated`;
    await openAddSectionPopup(page);
    await fillSectionForm(page, { name, skill: "Nghe" });
    await closeSectionPopupByIcon(page);
    expect(await sectionRow(page, name).count()).toBe(0);
  });

  test("ADD-12: popup Thêm mới không giữ dữ liệu cũ sau khi Lưu thành công", async () => {
    const name = trackName(`${runId}-add12`);
    await openAddSectionPopup(page);
    await fillSectionForm(page, { name, skill: "Nghe", duration: 5 });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await openAddSectionPopup(page);
    await expect(page.locator(po.nameInput)).toHaveValue("");
    await expect(page.locator(po.durationInput)).toHaveValue("");
    await expect(page.getByText(po.skillPlaceholder)).toBeVisible();
    await cancelSectionPopup(page);
  });

  test("ADD-13: Tên phần thi chỉ gồm khoảng trắng -> coi là rỗng, báo lỗi bắt buộc", async () => {
    await openAddSectionPopup(page);
    await fillSectionForm(page, { name: "   ", skill: "Nghe" });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await readDialogText(page)).toContain(po.nameRequiredError);
    await cancelSectionPopup(page);
  });
});
