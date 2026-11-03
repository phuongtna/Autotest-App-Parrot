import { test, expect } from "../../../../automation/quan_ly_section/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsSectionPageObjects as po,
  gotoSections,
  createSection,
  deleteSectionByName,
  readAllSectionNamesInOrder,
  readRowDuration,
  readRowSkill,
  readTotalCountBadge,
  readTotalRecordsText,
  searchSections,
  clearSearch,
  filterBySkill,
  resetSkillFilter,
  readSkillFilterOptionTexts,
} from "../../../../automation/quan_ly_section/navigation/cmsSectionPageObjects.js";

/**
 * Playwright Test THẬT (`cd automation && npm run test-quan-ly-section-pw`) cho nhóm "1. Danh sách
 * Section" (LIST-01..11) trong `flows/cms/quan_ly_on_thi/quan_ly_section/TESTCASES.md` (gốc:
 * `flows/cms/quan_ly_on_thi/quan_ly_section/qlysection.xlsx`, đã chạy tay Pass toàn bộ 2026-10-19).
 *
 * Môi trường chọn qua `QUAN_LY_SECTION_ENV` (mặc định "dev" - host `parotedu-cms.codeinet.com`,
 * admin/123456, do người dùng cung cấp trực tiếp 2026-11-03) - TÁCH RIÊNG khỏi `CMS_ADMIN_ENV`
 * (mặc định "staging", dùng bởi `quan_ly_goi_dich_vu`) để 2 bộ test không ảnh hưởng nhau. Chạy
 * `QUAN_LY_SECTION_ENV=staging npm run test-quan-ly-section-pw` để chạy trên staging
 * (`https://cms-staging.parrotedu.vn`, cùng tài khoản `CMS_USERNAME`/`CMS_PASSWORD` dùng chung -
 * xem `resolveCmsAdminCredentials()`).
 *
 * TẤT CẢ dữ liệu test tự tạo đều mang tiền tố `AUTO-<runId>-` để không đụng dữ liệu có sẵn trên
 * môi trường đang test - dọn dẹp lại bằng `afterAll`.
 *
 * LIST-11 (danh sách trống khi KHÔNG còn Section nào) CHỦ ĐỘNG BỎ QUA (`test.skip`) - để tạo đúng
 * điều kiện này phải XÓA SẠCH toàn bộ Section thật đang có trên dev, một thao tác phá dữ liệu khó
 * hoàn tác trên môi trường dùng chung - KHÔNG an toàn để automation tự làm.
 */
const SECTION_ENV = process.env.QUAN_LY_SECTION_ENV || "dev";
const runId = `AUTO-${Date.now().toString(36)}`;
const A = `${runId}-A`;
const B = `${runId}-B`;
const NO_DURATION = `${runId}-noduration`;

test.describe.serial("Quản lý Section - 1. Danh sách Section (LIST-01..11)", () => {
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
    for (const name of [A, B, NO_DURATION]) {
      await deleteSectionByName(page, name).catch(() => {});
    }
    await context.close();
  });

  test("LIST-01: truy cập menu hiển thị đúng bảng danh sách với đủ cột", async () => {
    await expect(page.getByRole("heading", { name: po.heading })).toBeVisible();
    for (const col of ["STT", "TÊN SECTION", "KỸ NĂNG", "THỜI LƯỢNG", "THAO TÁC"]) {
      await expect(page.getByText(col, { exact: true })).toBeVisible();
    }
  });

  test("LIST-02: thứ tự danh sách - tạo liên tiếp A rồi B -> B (tạo sau) lên đầu", async () => {
    await createSection(page, { name: A, skill: "Nghe" });
    await createSection(page, { name: B, skill: "Nghe" });
    const names = await readAllSectionNamesInOrder(page);
    const idxA = names.indexOf(A);
    const idxB = names.indexOf(B);
    expect(idxA).toBeGreaterThanOrEqual(0);
    expect(idxB).toBeGreaterThanOrEqual(0);
    expect(idxB).toBeLessThan(idxA);
  });

  test("LIST-03: Thời lượng rỗng hiển thị '—'", async () => {
    await createSection(page, { name: NO_DURATION, skill: "Nghe" });
    expect((await readRowDuration(page, NO_DURATION)).trim()).toBe(po.emptyDurationText);
  });

  test("LIST-04: badge 'X section' khớp với 'Tổng X bản ghi' khi không lọc/tìm kiếm", async () => {
    await clearSearch(page);
    await resetSkillFilter(page);
    const badge = await readTotalCountBadge(page);
    const total = await readTotalRecordsText(page);
    expect(badge).toBe(total);
  });

  test("LIST-05: tìm kiếm tương đối theo tên (không phân biệt hoa/thường)", async () => {
    await searchSections(page, A.toLowerCase());
    const names = await readAllSectionNamesInOrder(page);
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(n.toLowerCase()).toContain(A.toLowerCase());
  });

  test("LIST-06: tìm kiếm không có kết quả -> bảng rỗng, không lỗi", async () => {
    await searchSections(page, `khong-ton-tai-${runId}`);
    const names = await readAllSectionNamesInOrder(page);
    expect(names.length).toBe(0);
    await clearSearch(page);
  });

  test("LIST-07: lọc theo Kỹ năng -> chỉ hiện Section đúng kỹ năng đã chọn", async () => {
    // Lọc "Nghe" (không phải "Đọc") - ĐẢM BẢO count>0 bằng chính dữ liệu TỰ TẠO ở LIST-02/03
    // (A/B/NO_DURATION đều skill "Nghe"), KHÔNG phụ thuộc môi trường đang test có sẵn Section nào
    // skill "Đọc" hay không (dev có "Reading 01"/"QA-TC-Section-SYNC01" nhưng staging/production có
    // thể không có - assertion phải đúng trên MỌI môi trường, không riêng dev).
    await filterBySkill(page, "Nghe");
    const rows = page.locator(po.tableRowSelector);
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(rows.nth(i).locator("td").nth(2)).toContainText("Nghe");
    }
  });

  test("LIST-08: bỏ lọc kỹ năng -> hiện lại đầy đủ danh sách", async () => {
    const totalBeforeFilterReset = await readTotalRecordsText(page);
    await resetSkillFilter(page);
    const totalAfterReset = await readTotalRecordsText(page);
    expect(totalAfterReset).toBeGreaterThanOrEqual(totalBeforeFilterReset);
    const names = await readAllSectionNamesInOrder(page);
    expect(names).toContain(A);
  });

  test("LIST-09: kết hợp tìm kiếm + lọc kỹ năng (AND)", async () => {
    await searchSections(page, runId);
    await filterBySkill(page, "Nghe");
    const names = await readAllSectionNamesInOrder(page);
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(n).toContain(runId);
    for (let i = 0; i < names.length; i += 1) {
      await expect(page.locator(po.tableRowSelector).nth(i).locator("td").nth(2)).toContainText("Nghe");
    }
    await resetSkillFilter(page);
    await clearSearch(page);
  });

  test("LIST-10: danh sách kỹ năng trong dropdown lọc khớp đủ danh sách hard-code", async () => {
    const options = (await readSkillFilterOptionTexts(page)).map((t) => t.trim()).filter(Boolean);
    for (const skill of po.skillOptions) expect(options).toContain(skill);
    expect(options.length).toBe(po.skillOptions.length);
  });

  test.skip(
    "LIST-11: danh sách trống khi hệ thống chưa có Section nào - BỎ QUA: cần xóa sạch dữ liệu thật trên dev để tạo điều kiện này, không an toàn cho automation tự thực hiện trên môi trường dùng chung",
    () => {},
  );
});
