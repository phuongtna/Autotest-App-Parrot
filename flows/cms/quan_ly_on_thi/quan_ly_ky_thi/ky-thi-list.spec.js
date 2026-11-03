import { test, expect } from "../../../../automation/quan_ly_ky_thi/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsKyThiPageObjects as po,
  gotoKyThi,
  createKyThi,
  deleteKyThiByName,
  readAllKyThiNamesInOrder,
  readRowDescription,
  readTotalCountBadge,
  readTotalRecordsText,
  searchKyThi,
  clearSearch,
} from "../../../../automation/quan_ly_ky_thi/navigation/cmsKyThiPageObjects.js";

/**
 * Playwright Test THẬT (`cd automation && npm run test-quan-ly-ky-thi-pw`) cho nhóm "1. Danh sách
 * Kỳ thi" (LIST-01..08) trong `flows/cms/quan_ly_on_thi/quan_ly_ky_thi/TESTCASES.md` (gốc:
 * `qlykythi.xlsx`, đã chạy tay Pass toàn bộ, kết quả cập nhật 2026-11-03).
 *
 * Chạy trên môi trường DEV (`CMS_ADMIN_URL_DEV`/`CMS_USERNAME_DEV`/`CMS_PASSWORD_DEV` trong
 * `.env`) - hardcode `envOverride: "dev"` vì module này VIẾT CHO đúng host đó, cùng quy ước với
 * `quan_ly_section`/`cau_hinh_bang_diem`.
 *
 * TẤT CẢ dữ liệu test tự tạo đều mang tiền tố `AUTO-<runId>-` để không đụng dữ liệu có sẵn trên
 * dev (`QA test`, `Kỳ thi 2610`, `Kỳ thi G`, `Kỳ thi F`, `Kỳ thi B`, v.v.) - dọn dẹp lại bằng
 * `afterAll`.
 *
 * LIST-08 (danh sách trống khi KHÔNG còn Kỳ thi nào) CHỦ ĐỘNG BỎ QUA (`test.skip`) - để tạo đúng
 * điều kiện này phải XÓA SẠCH toàn bộ Kỳ thi thật đang có trên dev, không an toàn cho automation
 * tự thực hiện trên môi trường dùng chung (cùng lý do Section bỏ qua LIST-11).
 */
const runId = `AUTO-${Date.now().toString(36)}`;
const A = `${runId}-A`;
const B = `${runId}-B`;
const NO_DESC = `${runId}-nodesc`;

test.describe.serial("Quản lý kỳ thi - 1. Danh sách Kỳ thi (LIST-01..08)", () => {
  let context;
  let page;
  let baseUrl;

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

    await gotoKyThi(page, baseUrl);
  });

  test.afterAll(async () => {
    for (const name of [A, B, NO_DESC]) {
      await deleteKyThiByName(page, name).catch(() => {});
    }
    await context.close();
  });

  test("LIST-01: truy cập menu hiển thị đúng bảng danh sách với đủ cột", async () => {
    await expect(page.getByRole("heading", { name: po.heading })).toBeVisible();
    for (const col of ["STT", "TÊN KỲ THI", "MÔ TẢ", "THAO TÁC"]) {
      await expect(page.getByText(col, { exact: true })).toBeVisible();
    }
  });

  test("LIST-02: thứ tự danh sách - tạo liên tiếp A rồi B -> B (tạo sau) lên đầu", async () => {
    await createKyThi(page, { name: A });
    await createKyThi(page, { name: B });
    const names = await readAllKyThiNamesInOrder(page);
    const idxA = names.indexOf(A);
    const idxB = names.indexOf(B);
    expect(idxA).toBeGreaterThanOrEqual(0);
    expect(idxB).toBeGreaterThanOrEqual(0);
    expect(idxB).toBeLessThan(idxA);
  });

  test("LIST-03: badge 'X kỳ thi' khớp với 'Tổng X bản ghi' khi không tìm kiếm", async () => {
    await clearSearch(page);
    const badge = await readTotalCountBadge(page);
    const total = await readTotalRecordsText(page);
    expect(badge).toBe(total);
  });

  test("LIST-04: tìm kiếm tương đối theo tên (không phân biệt hoa/thường)", async () => {
    await searchKyThi(page, A.toLowerCase());
    const names = await readAllKyThiNamesInOrder(page);
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(n.toLowerCase()).toContain(A.toLowerCase());
  });

  test("LIST-05: tìm kiếm không có kết quả -> bảng rỗng, không lỗi", async () => {
    await searchKyThi(page, `khong-ton-tai-${runId}`);
    const names = await readAllKyThiNamesInOrder(page);
    expect(names.length).toBe(0);
    await clearSearch(page);
  });

  test("LIST-06: Mô tả rỗng hiển thị '—'", async () => {
    await createKyThi(page, { name: NO_DESC });
    expect((await readRowDescription(page, NO_DESC)).trim()).toBe(po.emptyDescriptionText);
  });

  test("LIST-07: màn Kỳ thi không có droplist lọc nào ngoài ô tìm kiếm", async () => {
    // ĐÃ XÁC NHẬN THẬT (2026-11-03): khác Section/Bảng điểm (có thêm droplist lọc theo Kỹ
    // năng/Dạng quy đổi), màn Kỳ thi CHỈ có 1 `.n-base-selection` duy nhất trên trang (dropdown
    // "Hiển thị X/trang" của phân trang) khi không có popup nào đang mở.
    await clearSearch(page);
    const selectCount = await page.locator(".n-base-selection").count();
    expect(selectCount).toBe(1);
  });

  test.skip(
    "LIST-08: danh sách trống khi hệ thống chưa có Kỳ thi nào - BỎ QUA: cần xóa sạch dữ liệu thật trên dev để tạo điều kiện này, không an toàn cho automation tự thực hiện trên môi trường dùng chung",
    () => {},
  );
});
