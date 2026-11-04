import { test, expect } from "../../../../automation/cau_hinh_bang_diem/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, resolveCmsNonAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsScoreTablePageObjects as po,
  gotoScoreTables,
  createScoreTable,
  deleteScoreTableByName,
  openEditScoreTablePopup,
  fillScoreTableForm,
  saveScoreTablePopup,
} from "../../../../automation/cau_hinh_bang_diem/navigation/cmsScoreTablePageObjects.js";
import {
  cmsDeThiPageObjects as deThiPo,
  gotoDeThi,
  clickAddNew,
  fillExamName,
  selectExamType,
  fillExamDuration,
  selectGrades,
  selectScoreTable,
  readSelectedScoreTable,
  isScoreTableOptionAvailable,
  openEditDeThi,
  clickSave,
  deleteDeThiByName,
} from "../../../../automation/ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";
import { gotoKyThi, createKyThi, deleteKyThiByName } from "../../../../automation/quan_ly_ky_thi/navigation/cmsKyThiPageObjects.js";

/**
 * Nhóm "5. Phân quyền truy cập" (PERM-01) + "6. Đồng bộ dữ liệu Bảng điểm sang Đề thi"
 * (SYNC-01..05).
 *
 * PERM-01 (2026-11-04): ĐÃ TỰ ĐỘNG HÓA - dùng tài khoản CTV (không phải Admin) do chủ sản phẩm
 * cung cấp trên staging (`CMS_USERNAME_STAGING_NONADMIN`/`CMS_PASSWORD_STAGING_NONADMIN` trong
 * `.env` - xem `resolveCmsNonAdminCredentials()` ở `automation/src/config.js`). Tự `test.skip()`
 * nếu 2 biến đó chưa điền (môi trường khác staging, hoặc chưa có tài khoản CTV). Dùng context/page
 * RIÊNG (đăng nhập tài khoản khác), không chung với `page` của nhóm SYNC bên dưới.
 *
 * SYNC-01/03/04 (2026-11-04): ĐÃ TỰ ĐỘNG HÓA - tái sử dụng page object của "Ngân hàng đề thi"/
 * "Quản lý kỳ thi" (giống cách EDIT-03/04/09 của `score-table-edit.spec.js` đã làm) để tự dựng 1 Kỳ
 * thi tối thiểu (chỉ dùng làm "Loại kỳ thi" khi tạo Đề thi, không cần Cấu trúc đề) - không còn phụ
 * thuộc màn hình ngoài phạm vi.
 *
 * SYNC-02 KHÔNG áp dụng được (N/A, không phải thiếu code) - cùng lý do ADD-03/EDIT-10: hệ thống
 * hiện chỉ có đúng 1 giá trị Dạng quy đổi ("Phổ thông") cho cả Bảng điểm lẫn Kỳ thi, không có cách
 * nào tạo ra tình huống "không khớp" để test rule chặn.
 *
 * SYNC-05 vẫn `test.skip` - Pending thật (xlsx 2026-11-03 ghi "Web chưa có để check"), màn làm bài
 * học sinh qua web chưa sẵn sàng tại thời điểm viết.
 */

test.describe.serial("Cấu hình bảng điểm - 5+6. Phân quyền truy cập & Đồng bộ dữ liệu (PERM-01, SYNC-01..05)", () => {
  let context;
  let page;
  let baseUrl;
  const runId = `AUTO-${Date.now().toString(36)}`;
  const examType = `${runId}-kt`;
  // Dọn qua `afterAll` (KHÔNG dọn cuối thân từng test) - ĐÃ GẶP THẬT (2026-11-04): lượt chạy SYNC-03
  // đầu tiên fail giữa chừng (bug timing, đã sửa) khiến dòng dọn dẹp cuối thân test không chạy tới,
  // để sót Đề thi + Bảng điểm rác mãi trên staging. Khai báo tên tạo ra ở đây, dọn tất cả dù test
  // pass/fail.
  const createdExamNames = [];
  const createdScoreTableNames = [];

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

    // Kỳ thi tối thiểu dùng chung cho SYNC-01/03/04 - chỉ cần làm "Loại kỳ thi" để field "Bảng
    // điểm quy đổi" hết bị disable, KHÔNG cần Cấu trúc đề (các case này không cần Công khai đề).
    await gotoKyThi(page, baseUrl);
    await createKyThi(page, { name: examType });
  });

  test.afterAll(async () => {
    // PHẢI xóa Đề thi (tham chiếu) trước, sau đó mới xóa được Bảng điểm/Kỳ thi (bị chặn xóa khi
    // còn gắn Đề thi).
    await gotoDeThi(page, baseUrl);
    for (const name of createdExamNames) {
      await deleteDeThiByName(page, name).catch(() => {});
    }
    await gotoScoreTables(page, baseUrl);
    for (const name of createdScoreTableNames) {
      await deleteScoreTableByName(page, name).catch(() => {});
    }
    await gotoKyThi(page, baseUrl);
    await deleteKyThiByName(page, examType).catch(() => {});
    await context.close();
  });

  test("PERM-01: tài khoản không có quyền Admin truy cập menu Cấu hình bảng điểm", async ({ browser }) => {
    const creds = resolveCmsNonAdminCredentials("staging");
    test.skip(!creds, "Chưa cấu hình CMS_USERNAME_STAGING_NONADMIN/CMS_PASSWORD_STAGING_NONADMIN trong .env");

    const ctvContext = await browser.newContext();
    const ctvPage = await ctvContext.newPage();
    await ctvPage.goto(baseUrl, { waitUntil: "networkidle" });
    await ctvPage.locator(po.login.usernameInput).fill(creds.username);
    await ctvPage.locator(po.login.passwordInput).fill(creds.password);
    await ctvPage.getByRole("button", { name: po.login.submitButton }).click();
    await ctvPage.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    // Menu "Cấu hình bảng điểm" KHÔNG hiển thị trong sidebar với tài khoản CTV.
    const menuItem = ctvPage.getByText(po.heading, { exact: true });
    await expect(menuItem).toHaveCount(0);

    // Thử truy cập thẳng URL cũng KHÔNG vào được màn danh sách thật (không hiển thị bảng/heading
    // "Cấu hình bảng điểm" - có thể bị chặn bằng redirect, trang trắng, hoặc thông báo lỗi quyền).
    await ctvPage.goto(`${baseUrl}${po.path}`, { waitUntil: "networkidle" });
    await expect(ctvPage.getByRole("heading", { name: po.heading })).toHaveCount(0);

    await ctvContext.close();
  });

  test("SYNC-01: Bảng điểm mới tạo hiển thị ngay trong dropdown chọn Bảng điểm ở Đề thi", async () => {
    const name = `${runId}-sync01`;
    await gotoScoreTables(page, baseUrl);
    await createScoreTable(page, { name });
    createdScoreTableNames.push(name);

    await gotoDeThi(page, baseUrl);
    await clickAddNew(page);
    await selectExamType(page, examType);
    // `selectScoreTable()` tự cuộn tìm option - chọn được tức là đã hiển thị ngay trong dropdown,
    // không cần tải lại trang.
    await selectScoreTable(page, name);
    expect((await readSelectedScoreTable(page)).trim()).toContain(name);
  });

  test.skip(
    "SYNC-02: Đề thi chỉ cho chọn Bảng điểm có Dạng quy đổi KHỚP với Dạng quy đổi của Kỳ thi - KHÔNG áp dụng: hệ thống hiện chỉ có đúng 1 giá trị Dạng quy đổi ('Phổ thông') cho cả Bảng điểm lẫn Kỳ thi, không có cách nào tạo tình huống 'không khớp' để test",
    () => {},
  );

  test("SYNC-03: Sửa Tên Bảng điểm -> Đề thi hiển thị đúng tên mới", async () => {
    const oldName = `${runId}-sync03-old`;
    const newName = `${runId}-sync03-new`;
    const examName = `${runId}-examSync03`;

    await gotoScoreTables(page, baseUrl);
    await createScoreTable(page, { name: oldName });
    createdScoreTableNames.push(oldName);

    await gotoDeThi(page, baseUrl);
    await clickAddNew(page);
    await selectExamType(page, examType);
    await fillExamName(page, examName);
    await fillExamDuration(page, 10);
    await selectGrades(page, ["Lớp 2"]);
    await selectScoreTable(page, oldName);
    await clickSave(page);
    createdExamNames.push(examName);

    await gotoScoreTables(page, baseUrl);
    await openEditScoreTablePopup(page, oldName);
    await fillScoreTableForm(page, { name: newName });
    await saveScoreTablePopup(page);
    createdScoreTableNames[createdScoreTableNames.indexOf(oldName)] = newName;

    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, examName);
    // Form điền lại dữ liệu đề thi (Loại kỳ thi -> Bảng điểm quy đổi hết disable) bất đồng bộ sau
    // khi heading hiện - đợi field Tên đề thi thật sự có giá trị trước khi đọc Bảng điểm quy đổi,
    // tránh đọc nhầm lúc field còn placeholder "Chọn loại kỳ thi trước".
    await expect(page.locator(deThiPo.nameInput)).toHaveValue(examName, { timeout: 10000 }).catch(() => {});
    await expect
      .poll(async () => (await readSelectedScoreTable(page)).trim(), { timeout: 10000 })
      .toContain(newName);
  });

  test("SYNC-04: Bảng điểm bị xóa không còn xuất hiện trong dropdown chọn ở Đề thi", async () => {
    const name = `${runId}-sync04`;
    await gotoScoreTables(page, baseUrl);
    await createScoreTable(page, { name });
    await deleteScoreTableByName(page, name);

    await gotoDeThi(page, baseUrl);
    await clickAddNew(page);
    await selectExamType(page, examType);
    expect(await isScoreTableOptionAvailable(page, name)).toBe(false);
  });

  test.skip(
    "SYNC-05: Điểm cuối cùng của học sinh được tính đúng theo rule 'Phổ thông' khi làm đề - BỎ QUA: Pending trong xlsx ('Web chưa có để check'), cần màn làm bài học sinh qua web",
    () => {},
  );
});
