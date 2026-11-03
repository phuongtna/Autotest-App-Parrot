import { test, expect } from "../../../../automation/cau_hinh_bang_diem/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsScoreTablePageObjects as po,
  gotoScoreTables,
  createScoreTable,
  deleteScoreTableByName,
  readAllScoreTableNamesInOrder,
  readRowConversion,
  readRowDescription,
  readTotalCountBadge,
  readTotalRecordsText,
  searchScoreTables,
  clearSearch,
  filterByConversion,
  resetConversionFilter,
  readConversionFilterOptionTexts,
} from "../../../../automation/cau_hinh_bang_diem/navigation/cmsScoreTablePageObjects.js";

/**
 * Playwright Test THẬT (`cd automation && npm run test-cau-hinh-bang-diem-pw`) cho nhóm "1. Danh
 * sách Bảng điểm" (LIST-01..11) trong
 * `flows/cms/quan_ly_on_thi/cau_hinh_bang_diem/TESTCASES.md` (gốc:
 * `cauhinhbangdiem.xlsx`, đã chạy tay Pass toàn bộ 2026-10-19/2026-11-03).
 *
 * Chạy trên môi trường DEV (`CMS_ADMIN_URL_DEV`/`CMS_USERNAME_DEV`/`CMS_PASSWORD_DEV` trong
 * `.env` - host `parotedu-cms.codeinet.com`) - hardcode `envOverride: "dev"` giống
 * `quan_ly_section`, không phụ thuộc `CMS_ADMIN_ENV` mặc định ("staging").
 *
 * TẤT CẢ dữ liệu test tự tạo đều mang tiền tố `AUTO-<runId>-` để không đụng dữ liệu có sẵn trên
 * dev ("Thang điểm 1".."Thang điểm 9", "Bảng điểm thang 100 EDIT") - dọn dẹp lại bằng `afterAll`.
 *
 * LIST-10 (danh sách trống khi KHÔNG còn Bảng điểm nào) CHỦ ĐỘNG BỎ QUA (`test.skip`) - để tạo
 * đúng điều kiện này phải XÓA SẠCH toàn bộ bảng điểm thật đang có trên dev, một thao tác phá dữ
 * liệu khó hoàn tác trên môi trường dùng chung - KHÔNG an toàn để automation tự làm (cùng lý do
 * Section bỏ qua LIST-11).
 */
const runId = `AUTO-${Date.now().toString(36)}`;
const A = `${runId}-A`;
const B = `${runId}-B`;
const NO_DESC = `${runId}-nodesc`;

test.describe.serial("Cấu hình bảng điểm - 1. Danh sách Bảng điểm (LIST-01..11)", () => {
  let context;
  let page;
  let baseUrl;

  test.beforeAll(async ({ browser }) => {
    requireCmsAdminConfig();
    baseUrl = resolveCmsAdminBaseUrl("staging");
    const { username, password } = resolveCmsAdminCredentials("staging");
    context = await browser.newContext();
    page = await context.newPage();

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator(po.login.usernameInput).fill(username);
    await page.locator(po.login.passwordInput).fill(password);
    await page.getByRole("button", { name: po.login.submitButton }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    await gotoScoreTables(page, baseUrl);
  });

  test.afterAll(async () => {
    for (const name of [A, B, NO_DESC]) {
      await deleteScoreTableByName(page, name).catch(() => {});
    }
    await context.close();
  });

  test("LIST-01: truy cập menu hiển thị đúng bảng danh sách với đủ cột", async () => {
    await expect(page.getByRole("heading", { name: po.heading })).toBeVisible();
    for (const col of ["STT", "TÊN BẢNG ĐIỂM", "DẠNG QUY ĐỔI", "MÔ TẢ", "THAO TÁC"]) {
      await expect(page.getByText(col, { exact: true })).toBeVisible();
    }
  });

  test("LIST-02: thứ tự danh sách - tạo liên tiếp A rồi B -> B (tạo sau) lên đầu", async () => {
    await createScoreTable(page, { name: A });
    await createScoreTable(page, { name: B });
    const names = await readAllScoreTableNamesInOrder(page);
    const idxA = names.indexOf(A);
    const idxB = names.indexOf(B);
    expect(idxA).toBeGreaterThanOrEqual(0);
    expect(idxB).toBeGreaterThanOrEqual(0);
    expect(idxB).toBeLessThan(idxA);
  });

  test("LIST-03: badge 'X bảng điểm' khớp với 'Tổng X bản ghi' khi không lọc/tìm kiếm", async () => {
    await clearSearch(page);
    await resetConversionFilter(page);
    const badge = await readTotalCountBadge(page);
    const total = await readTotalRecordsText(page);
    expect(badge).toBe(total);
  });

  test("LIST-04: tìm kiếm tương đối theo tên (không phân biệt hoa/thường)", async () => {
    await searchScoreTables(page, A.toLowerCase());
    const names = await readAllScoreTableNamesInOrder(page);
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(n.toLowerCase()).toContain(A.toLowerCase());
  });

  test("LIST-05: tìm kiếm không có kết quả -> bảng rỗng, không lỗi", async () => {
    await searchScoreTables(page, `khong-ton-tai-${runId}`);
    const names = await readAllScoreTableNamesInOrder(page);
    expect(names.length).toBe(0);
    await clearSearch(page);
  });

  test("LIST-06: lọc theo Dạng quy đổi -> chỉ hiện Bảng điểm đúng dạng quy đổi đã chọn", async () => {
    await searchScoreTables(page, runId);
    await filterByConversion(page, "Phổ thông");
    const rows = page.locator(po.tableRowSelector);
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(rows.nth(i).locator("td").nth(2)).toContainText("Phổ thông");
    }
  });

  test("LIST-07: bỏ lọc dạng quy đổi -> hiện lại đầy đủ danh sách", async () => {
    const totalBeforeFilterReset = await readTotalRecordsText(page);
    await resetConversionFilter(page);
    const totalAfterReset = await readTotalRecordsText(page);
    expect(totalAfterReset).toBeGreaterThanOrEqual(totalBeforeFilterReset);
    const names = await readAllScoreTableNamesInOrder(page);
    expect(names).toContain(A);
    await clearSearch(page);
  });

  test("LIST-08: kết hợp tìm kiếm + lọc dạng quy đổi (AND)", async () => {
    await searchScoreTables(page, runId);
    await filterByConversion(page, "Phổ thông");
    const names = await readAllScoreTableNamesInOrder(page);
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(n).toContain(runId);
    for (let i = 0; i < names.length; i += 1) {
      await expect(page.locator(po.tableRowSelector).nth(i).locator("td").nth(2)).toContainText("Phổ thông");
    }
    await resetConversionFilter(page);
    await clearSearch(page);
  });

  test("LIST-09: danh sách dạng quy đổi trong dropdown lọc đúng với hard-code", async () => {
    const options = (await readConversionFilterOptionTexts(page)).map((t) => t.trim()).filter(Boolean);
    for (const conversion of po.conversionOptions) expect(options).toContain(conversion);
    expect(options.length).toBe(po.conversionOptions.length);
  });

  test("LIST-10: Mô tả khi không nhập Mô tả lúc tạo -> hiển thị '—'", async () => {
    await createScoreTable(page, { name: NO_DESC });
    expect((await readRowDescription(page, NO_DESC)).trim()).toBe(po.emptyDescriptionText);
  });

  test.skip(
    "LIST-11: danh sách trống khi hệ thống chưa có Bảng điểm nào - BỎ QUA: cần xóa sạch dữ liệu thật trên dev để tạo điều kiện này, không an toàn cho automation tự thực hiện trên môi trường dùng chung",
    () => {},
  );
});
