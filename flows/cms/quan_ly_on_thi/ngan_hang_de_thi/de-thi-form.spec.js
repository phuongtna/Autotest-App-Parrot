import { test, expect } from "../../../../automation/ngan_hang_de_thi/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsDeThiPageObjects as po,
  gotoDeThi,
  clickAddNew,
  openEditDeThi,
  createExam,
  setupDeThiFixtures,
  teardownDeThiFixtures,
  fillExamName,
  selectExamType,
  readSelectedExamType,
  fillExamDuration,
  typeExamDurationRaw,
  selectGrades,
  readSelectedGrades,
  isScoreTableSelectDisabled,
  readScoreTableConversionNote,
  selectScoreTable,
  readSelectedScoreTable,
  readSelectedTrangThai,
  selectHinhThuc,
  clickSave,
} from "../../../../automation/ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

/**
 * Nhóm "2. Tạo mới đề thi - Thông tin chung" (FORM-01..18) - xem ghi chú chung (env dev, tiền tố
 * AUTO-, fixture dùng chung) tại `de-thi-list.spec.js`.
 *
 * FORM-03 (placeholder "Nhập tên đề thi") VÀ FORM-07 (placeholder "Chọn loại kỳ thi") được gộp
 * kiểm tra chung trong FORM-01 (quan sát cùng lúc lúc popup/trang vừa mở) thay vì tách case riêng
 * - cùng 1 lần quan sát, tránh lặp thao tác mở trang.
 */
const runId = `AUTO-${Date.now().toString(36)}`;
const EXAM_A = `${runId}-examA`;
const EXAM_DUP = `${runId}-examDup`;

test.describe.serial("Ngân hàng đề thi - 2. Tạo mới đề thi - Thông tin chung (FORM-01..18)", () => {
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
    await teardownDeThiFixtures(page, baseUrl, fixtures, [EXAM_A, EXAM_DUP]);
    await context.close();
  });

  test("FORM-01/03/07: bấm Thêm mới chuyển đúng sang màn Tạo mới, field trống + placeholder đúng", async () => {
    await clickAddNew(page);
    await expect(page.locator(po.nameInput)).toHaveValue("");
    await expect(page.locator(po.nameInput)).toHaveAttribute("placeholder", "Nhập tên đề thi");
    await expect(page.getByText(po.examTypeSelectPlaceholder, { exact: true })).toBeVisible();
  });

  test("FORM-02: validate thiếu Tên đề thi", async () => {
    await selectExamType(page, fixtures.examTypeEmpty);
    await fillExamDuration(page, 30);
    await selectGrades(page, ["Lớp 1"]);
    await clickSave(page);
    await expect(page.getByText(po.nameRequiredError, { exact: true })).toBeVisible();
  });

  test("FORM-06: validate thiếu Loại kỳ thi (field khác đã điền đủ từ FORM-02)", async () => {
    await expect(page.getByText(po.examTypeRequiredError, { exact: true })).toHaveCount(0);
    // Loại kỳ thi đã chọn ở FORM-02 nên test riêng việc để trống ngay từ đầu:
    await page.reload({ waitUntil: "networkidle" });
    await fillExamName(page, EXAM_A);
    await fillExamDuration(page, 30);
    await selectGrades(page, ["Lớp 1"]);
    await clickSave(page);
    await expect(page.getByText(po.examTypeRequiredError, { exact: true })).toBeVisible();
  });

  test("FORM-08: dropdown Loại kỳ thi liệt kê đầy đủ các kỳ thi hiện có", async () => {
    await page.locator('[class*="n-form-item"]', { hasText: "Loại kỳ thi" }).locator(".n-base-selection").click();
    await expect(page.locator('.n-base-select-option:visible, [role="option"]:visible', { hasText: fixtures.examTypeEmpty })).toBeVisible();
    await expect(page.locator('.n-base-select-option:visible, [role="option"]:visible', { hasText: fixtures.examTypeWithSections })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("FORM-09: validate thiếu Thời gian làm bài", async () => {
    await selectExamType(page, fixtures.examTypeEmpty);
    await selectGrades(page, ["Lớp 1"]);
    await clickSave(page);
    await expect(page.getByText(po.durationRequiredError, { exact: true })).toBeVisible();
  });

  test("FORM-10: Thời gian làm bài chỉ nhận số nguyên dương - ký tự sai bị sanitize về rỗng", async () => {
    await typeExamDurationRaw(page, "abc-12.5");
    await clickSave(page);
    await expect(page.locator(po.durationInput)).toHaveValue("");
    await expect(page.getByText(po.durationRequiredError, { exact: true })).toBeVisible();
  });

  test("FORM-11: validate thiếu Khối lớp", async () => {
    await fillExamDuration(page, 30);
    await clickSave(page);
    await expect(page.getByText(po.gradeRequiredError, { exact: true })).toBeVisible();
  });

  test("FORM-12: Khối lớp cho phép chọn nhiều giá trị", async () => {
    await selectGrades(page, ["Lớp 3", "Lớp 4", "Lớp 5"]);
    const selected = await readSelectedGrades(page);
    expect(selected.join(" ")).toContain("Lớp 3");
    expect(selected.join(" ")).toContain("Lớp 4");
    expect(selected.join(" ")).toContain("Lớp 5");
  });

  test("FORM-13: validate thiếu Bảng điểm quy đổi", async () => {
    // Bảng điểm tự fill sẵn giá trị mặc định ngay khi chọn Loại kỳ thi (giống Kỳ thi SYNC-05) nên
    // KHÔNG thể ép về trạng thái trống qua UI thường - case này chỉ xác nhận lại hành vi tự fill
    // (không áp dụng được việc để trống thật, ghi chú rõ thay vì bỏ qua im lặng).
    const isDisabled = await isScoreTableSelectDisabled(page);
    expect(isDisabled).toBe(false);
    const selected = await readSelectedScoreTable(page);
    expect(selected.trim().length).toBeGreaterThan(0);
  });

  test("FORM-14: dropdown Bảng điểm quy đổi chỉ liệt kê đúng Dạng quy đổi của Loại kỳ thi đang chọn", async () => {
    const note = await readScoreTableConversionNote(page);
    expect(note).toContain("Phổ thông");
  });

  test("FORM-15: đổi Loại kỳ thi -> Bảng điểm quy đổi làm mới (giữ nguyên nếu cùng Dạng quy đổi - hệ thống hiện chỉ có 1 dạng)", async () => {
    const before = await readSelectedScoreTable(page);
    await selectExamType(page, fixtures.examTypeWithSections);
    const after = await readSelectedScoreTable(page);
    // Chỉ có 1 Dạng quy đổi "Phổ thông" trên toàn hệ thống (xem Giả định TESTCASES.md) nên không
    // quan sát được việc RESET giá trị không hợp lệ - chỉ xác nhận field vẫn có giá trị hợp lệ sau
    // khi đổi Loại kỳ thi (không bị treo rỗng/lỗi).
    expect(after.trim().length).toBeGreaterThan(0);
    expect(before.trim().length).toBeGreaterThan(0);
  });

  test("FORM-16: Trạng thái mặc định chọn Nháp", async () => {
    await page.reload({ waitUntil: "networkidle" });
    expect(await readSelectedTrangThai(page)).toBe(po.draftRadioLabel);
  });

  test("FORM-17/18: Hình thức mặc định Free, chọn Pro lưu đúng giá trị", async () => {
    await fillExamName(page, EXAM_A);
    await selectExamType(page, fixtures.examTypeEmpty);
    await fillExamDuration(page, 30);
    await selectGrades(page, ["Lớp 1"]);
    await expect(page.locator(".n-radio--checked", { hasText: po.freeRadioLabel })).toBeVisible();
    await selectHinhThuc(page, po.proRadioLabel);
    await selectScoreTable(page, fixtures.scoreTable);
    await clickSave(page);
    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, EXAM_A);
    await expect(page.locator(".n-radio--checked", { hasText: po.proRadioLabel })).toBeVisible();
  });

  test("FORM-04: validate trùng tên đề thi khi tạo mới (AC)", async () => {
    await gotoDeThi(page, baseUrl);
    await clickAddNew(page);
    await fillExamName(page, EXAM_A);
    await selectExamType(page, fixtures.examTypeEmpty);
    await fillExamDuration(page, 30);
    await selectGrades(page, ["Lớp 1"]);
    await clickSave(page);
    await expect(page.getByText(po.nameDuplicateError, { exact: false })).toBeVisible();
  });

  test("FORM-05: validate trùng tên khi sửa đề đổi tên thành tên đề đã tồn tại (AC)", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await createExam(page, { name: EXAM_DUP, examType: fixtures.examTypeEmpty, grades: ["Lớp 1"] });
    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, EXAM_DUP);
    await fillExamName(page, EXAM_A);
    await clickSave(page);
    await expect(page.getByText(po.nameDuplicateError, { exact: false })).toBeVisible();
  });
});
