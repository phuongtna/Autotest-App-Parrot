import { test, expect } from "../../../../automation/ngan_hang_de_thi/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsDeThiPageObjects as po,
  gotoDeThi,
  createExam,
  setupDeThiFixtures,
  teardownDeThiFixtures,
  readAllExamNamesInOrder,
  readRowGrades,
  readRowFormatBadge,
  readRowStatusBadge,
  readRowCreatedDate,
  readTotalCountBadge,
  readTotalRecordsText,
  searchDeThi,
  clearSearch,
  filterByExamType,
  resetExamTypeFilter,
  filterByGrade,
  resetGradeFilter,
  readGradeFilterOptionTexts,
} from "../../../../automation/ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

/**
 * Playwright Test THẬT (`cd automation && npm run test-ngan-hang-de-thi-pw`) cho nhóm "1. Danh
 * sách đề thi" (LIST-01..15) trong `TESTCASES.xlsx` của module Ngân hàng đề thi.
 *
 * Chạy trên môi trường DEV (giống hệt quy ước `quan_ly_ky_thi`/`quan_ly_section`/
 * `cau_hinh_bang_diem`) - TOÀN BỘ dữ liệu test tự tạo mang tiền tố `AUTO-<runId>-`, kể cả fixture
 * Kỳ thi/Section/Bảng điểm dựng riêng qua `setupDeThiFixtures()` (TÁI SỬ DỤNG thẳng
 * `createSection`/`createScoreTable`/`createKyThi` của 3 module kia) để không phụ thuộc dữ liệu
 * thật có sẵn trên dev.
 *
 * LIST-15 (danh sách trống khi KHÔNG còn đề thi nào) CHỦ ĐỘNG BỎ QUA (`test.skip`) - để tạo đúng
 * điều kiện này phải XÓA SẠCH toàn bộ đề thi thật đang có trên dev, không an toàn cho automation
 * tự thực hiện trên môi trường dùng chung (cùng lý do Kỳ thi bỏ qua LIST-08, Section bỏ qua
 * LIST-11).
 */
const runId = `AUTO-${Date.now().toString(36)}`;
const A = `${runId}-A`;
const B = `${runId}-B`;
const MULTI_GRADE = `${runId}-multigrade`;
const PRO_EXAM = `${runId}-pro`;

test.describe.serial("Ngân hàng đề thi - 1. Danh sách đề thi (LIST-01..15)", () => {
  let context;
  let page;
  let baseUrl;
  let fixtures;

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

    fixtures = await setupDeThiFixtures(page, baseUrl, runId);
    await gotoDeThi(page, baseUrl);
  });

  test.afterAll(async () => {
    await teardownDeThiFixtures(page, baseUrl, fixtures, [A, B, MULTI_GRADE, PRO_EXAM]);
    await context.close();
  });

  test("LIST-01: truy cập menu hiển thị đúng bảng danh sách", async () => {
    await expect(page.getByRole("heading", { name: po.heading })).toBeVisible();
    for (const col of ["TÊN ĐỀ THI", "KHỐI LỚP", "HÌNH THỨC", "CHẾ ĐỘ", "NGÀY TẠO", "THAO TÁC"]) {
      await expect(page.getByText(col, { exact: true }).first()).toBeVisible();
    }
  });

  test("LIST-02: thứ tự danh sách mới nhất lên đầu", async () => {
    await createExam(page, { name: A, examType: fixtures.examTypeEmpty, grades: ["Lớp 1"], scoreTable: fixtures.scoreTable });
    await gotoDeThi(page, baseUrl);
    await createExam(page, { name: B, examType: fixtures.examTypeEmpty, grades: ["Lớp 1"], scoreTable: fixtures.scoreTable });
    await gotoDeThi(page, baseUrl);
    await searchDeThi(page, runId);
    const names = await readAllExamNamesInOrder(page);
    expect(names.indexOf(B)).toBeLessThan(names.indexOf(A));
  });

  test("LIST-03: tổng số đề thi hiển thị đúng", async () => {
    await clearSearch(page);
    const badge = await readTotalCountBadge(page);
    const total = await readTotalRecordsText(page);
    expect(badge).toBe(total);
  });

  test("LIST-04: cột Khối lớp hiển thị đủ khi đề gắn nhiều Khối lớp", async () => {
    await createExam(page, { name: MULTI_GRADE, examType: fixtures.examTypeEmpty, grades: ["Lớp 3", "Lớp 4", "Lớp 5"], scoreTable: fixtures.scoreTable });
    await gotoDeThi(page, baseUrl);
    const gradesText = await readRowGrades(page, MULTI_GRADE);
    expect(gradesText).toContain("Lớp 3");
    expect(gradesText).toContain("Lớp 4");
    expect(gradesText).toContain("Lớp 5");
  });

  test("LIST-05: tìm kiếm tương đối theo tên đề thi", async () => {
    await searchDeThi(page, A);
    const names = await readAllExamNamesInOrder(page);
    expect(names).toContain(A);
    expect(names).not.toContain(B);
  });

  test("LIST-06: tìm kiếm không có kết quả", async () => {
    await searchDeThi(page, "zzz-khong-ton-tai-zzz");
    expect(await readAllExamNamesInOrder(page)).toEqual([]);
    await clearSearch(page);
  });

  test("LIST-07: lọc theo Loại kỳ thi mặc định 'Tất cả loại kỳ thi'", async () => {
    await expect(page.locator(".n-base-selection", { hasText: po.examTypeFilterDefaultText })).toBeVisible();
  });

  test("LIST-08: lọc theo Loại kỳ thi cụ thể", async () => {
    await searchDeThi(page, runId);
    await filterByExamType(page, fixtures.examTypeEmpty);
    const names = await readAllExamNamesInOrder(page);
    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain(A);
    await resetExamTypeFilter(page);
  });

  test("LIST-09: lọc theo Khối lớp", async () => {
    await searchDeThi(page, runId);
    await filterByGrade(page, "Lớp 5");
    const names = await readAllExamNamesInOrder(page);
    expect(names).toContain(MULTI_GRADE);
    expect(names).not.toContain(A);
    await resetGradeFilter(page);
  });

  test("LIST-10: kết hợp tìm kiếm + Loại kỳ thi + Khối lớp cùng lúc", async () => {
    await searchDeThi(page, runId);
    await filterByExamType(page, fixtures.examTypeEmpty);
    await filterByGrade(page, "Lớp 1");
    const names = await readAllExamNamesInOrder(page);
    expect(names).toContain(A);
    expect(names).not.toContain(MULTI_GRADE);
    await resetExamTypeFilter(page);
    await resetGradeFilter(page);
    await clearSearch(page);
  });

  test("LIST-11: danh sách Khối lớp trong dropdown lọc đúng Lớp 1-12", async () => {
    const texts = await readGradeFilterOptionTexts(page);
    for (let i = 1; i <= 12; i += 1) {
      expect(texts.some((t) => t.includes(`Lớp ${i}`))).toBe(true);
    }
  });

  test("LIST-12: cột Hình thức hiển thị đúng badge Free/Pro", async () => {
    await createExam(page, { name: PRO_EXAM, examType: fixtures.examTypeEmpty, grades: ["Lớp 1"], hinhThuc: po.proRadioLabel, scoreTable: fixtures.scoreTable });
    await gotoDeThi(page, baseUrl);
    expect(await readRowFormatBadge(page, PRO_EXAM)).toContain("Pro");
    expect(await readRowFormatBadge(page, A)).toContain("Free");
  });

  test("LIST-13: cột Chế độ hiển thị đúng Công khai/Chưa công khai", async () => {
    expect(await readRowStatusBadge(page, A)).toContain("Chưa công khai");
  });

  test("LIST-14: cột Ngày tạo đúng định dạng dd/mm/yyyy", async () => {
    const text = (await readRowCreatedDate(page, A)).trim();
    expect(text).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  test.skip("LIST-15: danh sách trống khi hệ thống chưa có đề thi nào - BỎ QUA: cần xóa sạch dữ liệu thật trên dev, không an toàn cho automation tự thực hiện", () => {});
});
