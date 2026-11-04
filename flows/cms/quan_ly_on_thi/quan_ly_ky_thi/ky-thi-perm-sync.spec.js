import { test, expect } from "../../../../automation/quan_ly_ky_thi/playwrightTest.js";
import {
  resolveCmsAdminBaseUrl,
  resolveCmsAdminCredentials,
  resolveCmsNonAdminCredentials,
  requireCmsAdminConfig,
} from "../../../../automation/src/config.js";
import {
  cmsKyThiPageObjects as po,
  gotoKyThi,
  createKyThi,
  deleteKyThiByName,
  openAddKyThiPopup,
  openEditKyThiPopup,
  cancelKyThiPopup,
  attachSection as attachSectionToKyThi,
  saveKyThiPopup,
  readAttachableSectionOptionTexts,
  readAttachedSectionNamesInOrder,
} from "../../../../automation/quan_ly_ky_thi/navigation/cmsKyThiPageObjects.js";
import {
  gotoSections,
  createSection,
  deleteSectionByName,
} from "../../../../automation/quan_ly_section/navigation/cmsSectionPageObjects.js";
import {
  gotoScoreTables,
  createScoreTable,
  deleteScoreTableByName,
} from "../../../../automation/cau_hinh_bang_diem/navigation/cmsScoreTablePageObjects.js";
import {
  cmsDeThiPageObjects as deThiPo,
  gotoDeThi,
  clickAddNew as clickAddNewDeThi,
  fillExamName,
  selectExamType,
  fillExamDuration,
  selectGrades,
  selectScoreTable,
  readSelectedScoreTable,
  readStructureSectionNamesInOrder,
  addSectionToStructure,
  clickSave as clickSaveDeThi,
  openEditDeThi,
  deleteDeThiByName,
} from "../../../../automation/ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

/**
 * Nhóm "5. Phân quyền truy cập" (PERM-01) và "6. Đồng bộ dữ liệu Kỳ thi ↔ Section, Bảng điểm, Đề
 * thi" (SYNC-01..07) của `flows/cms/quan_ly_on_thi/quan_ly_ky_thi/TESTCASES.md`.
 *
 * (2026-11-04) ĐÃ TỰ ĐỘNG HÓA ĐẦY ĐỦ - KHÔNG còn `test.skip` (trừ SYNC-04, xem lý do riêng bên
 * dưới) - tái sử dụng page objects "Ngân hàng đề thi"/"Quản lý Section"/"Cấu hình bảng điểm" (cùng
 * khuôn mẫu đã dùng ở `section-perm-sync.spec.js`/`score-table-perm-sync.spec.js`).
 *
 * PERM-01: dùng tài khoản CTV (không phải Admin) do chủ sản phẩm cung cấp trên staging
 * (`CMS_USERNAME_STAGING_NONADMIN`/`CMS_PASSWORD_STAGING_NONADMIN` trong `.env` - xem
 * `resolveCmsNonAdminCredentials()`). Tự `test.skip()` nếu 2 biến đó chưa điền. Dùng context/page
 * RIÊNG (đăng nhập tài khoản khác), không chung với `page` của nhóm SYNC.
 *
 * SYNC-04 VẪN `test.skip` - KHÔNG áp dụng được (N/A, không phải thiếu code): hệ thống hiện chỉ có
 * đúng 1 giá trị "Dạng quy đổi" ("Phổ thông") cho mọi Kỳ thi/Bảng điểm, không có cách nào tạo ra
 * Bảng điểm "khác Dạng quy đổi" để kiểm tra rule lọc - cùng kết luận ADD-03/EDIT-04/SYNC-02 của
 * `score-table-perm-sync.spec.js`.
 *
 * SYNC-06 (2026-11-04, LƯU Ý QUAN TRỌNG): case gốc kỳ vọng đổi "Loại kỳ thi" làm MỚI HOÀN TOÀN cấu
 * trúc gợi ý. Nhưng `cmsDeThiPageObjects.js` (đầu file, mục EDIT-04 của `ngan_hang_de_thi`) đã XÁC
 * NHẬN THẬT hành vi NGƯỢC LẠI: đổi "Loại kỳ thi" khi đề ĐÃ CÓ sẵn Section (dù chỉ do auto-fill lần
 * đầu, chưa lưu) KHÔNG làm mới/reset cấu trúc cũ. Giữ nguyên test theo ĐÚNG kỳ vọng gốc trong
 * `TESTCASES.md` (không sửa ngược lại cho khớp hành vi thật) để phản ánh trung thực 2 kỳ vọng trái
 * chiều đã biết giữa 2 file test case - nếu case này FAIL, đó là xác nhận lại phát hiện đã ghi ở
 * `cmsDeThiPageObjects.js`, KHÔNG phải lỗi viết test.
 */
const runId = `AUTO-${Date.now().toString(36)}`;

const SECTION_SYNC01 = `${runId}-sync01`;
const SECTION_SYNC02_A = `${runId}-sync02-A`;
const SECTION_SYNC02_B = `${runId}-sync02-B`;
const SECTION_SYNC03_C = `${runId}-sync03-C`;
const SECTION_SYNC06_A = `${runId}-sync06-A`;
const SECTION_SYNC06_B = `${runId}-sync06-B`;

const KT_SYNC02 = `${runId}-kt-sync02`; // dùng chung cho SYNC-02/03 (nối tiếp)
const KT_SYNC05 = `${runId}-kt-sync05`;
const KT_SYNC06_A = `${runId}-kt-sync06-A`;
const KT_SYNC06_B = `${runId}-kt-sync06-B`;
const KT_SYNC07 = `${runId}-kt-sync07`; // tự xóa ngay trong thân test

const SCORE_SYNC = `${runId}-bd-sync`;
const SCORE_SYNC05_NEW = `${runId}-sync05-new`;

const EXAM_SYNC02 = `${runId}-examSync02`; // dùng chung cho SYNC-02/03

const createdSectionNames = [SECTION_SYNC01, SECTION_SYNC02_A, SECTION_SYNC02_B, SECTION_SYNC03_C, SECTION_SYNC06_A, SECTION_SYNC06_B];
const createdKyThiNames = [KT_SYNC02, KT_SYNC05, KT_SYNC06_A, KT_SYNC06_B];
const createdScoreTableNames = [SCORE_SYNC, SCORE_SYNC05_NEW];
const createdExamNames = [EXAM_SYNC02];

test.describe.serial("Quản lý kỳ thi - 5+6. Phân quyền truy cập & Đồng bộ dữ liệu (PERM-01, SYNC-01..07)", () => {
  let context;
  let page;
  let baseUrl;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
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
    await createScoreTable(page, { name: SCORE_SYNC });
  });

  test.afterAll(async () => {
    test.setTimeout(180_000);
    // Thứ tự dọn BẮT BUỘC: Đề thi (tham chiếu) trước, rồi Kỳ thi/Section, cuối cùng Bảng điểm (đều
    // bị chặn xóa khi còn đang gắn Đề thi).
    await gotoDeThi(page, baseUrl);
    for (const name of createdExamNames) {
      await deleteDeThiByName(page, name).catch(() => {});
    }
    await gotoKyThi(page, baseUrl);
    for (const name of createdKyThiNames) {
      await deleteKyThiByName(page, name).catch(() => {});
    }
    await gotoSections(page, baseUrl);
    for (const name of createdSectionNames) {
      await deleteSectionByName(page, name).catch(() => {});
    }
    await gotoScoreTables(page, baseUrl);
    for (const name of createdScoreTableNames) {
      await deleteScoreTableByName(page, name).catch(() => {});
    }
    await context.close();
  });

  test("PERM-01: tài khoản không có quyền Admin CMS truy cập menu Quản lý kỳ thi", async ({ browser }) => {
    const creds = resolveCmsNonAdminCredentials("staging");
    test.skip(!creds, "Chưa cấu hình CMS_USERNAME_STAGING_NONADMIN/CMS_PASSWORD_STAGING_NONADMIN trong .env");

    const ctvContext = await browser.newContext();
    const ctvPage = await ctvContext.newPage();
    await ctvPage.goto(baseUrl, { waitUntil: "networkidle" });
    await ctvPage.locator(po.login.usernameInput).fill(creds.username);
    await ctvPage.locator(po.login.passwordInput).fill(creds.password);
    await ctvPage.getByRole("button", { name: po.login.submitButton }).click();
    await ctvPage.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    // Menu "Quản lý kỳ thi" KHÔNG hiển thị trong sidebar với tài khoản CTV.
    const menuItem = ctvPage.getByText(po.heading, { exact: true });
    await expect(menuItem).toHaveCount(0);

    // Thử truy cập thẳng URL cũng KHÔNG vào được màn danh sách thật.
    await ctvPage.goto(`${baseUrl}${po.path}`, { waitUntil: "networkidle" });
    await expect(ctvPage.getByRole("heading", { name: po.heading })).toHaveCount(0);

    await ctvContext.close();
  });

  test("SYNC-01: Section mới tạo ở Quản lý Section phản ánh đúng trong droplist 'Cấu hình đề xuất' ở Kỳ thi", async () => {
    await gotoSections(page, baseUrl);
    await createSection(page, { name: SECTION_SYNC01, skill: "Nghe" });

    await gotoKyThi(page, baseUrl);
    await openAddKyThiPopup(page);
    const options = (await readAttachableSectionOptionTexts(page)).map((t) => t.trim()).filter(Boolean);
    expect(options.some((t) => t.includes(SECTION_SYNC01))).toBe(true);
    await cancelKyThiPopup(page);
  });

  test("SYNC-02: Tạo Đề thi và chọn Kỳ thi -> cấu trúc đề xuất đúng theo Cấu hình đề xuất hiện tại", async () => {
    await gotoSections(page, baseUrl);
    await createSection(page, { name: SECTION_SYNC02_A, skill: "Nghe" });
    await createSection(page, { name: SECTION_SYNC02_B, skill: "Nói" });

    await gotoKyThi(page, baseUrl);
    await createKyThi(page, { name: KT_SYNC02 });
    await openEditKyThiPopup(page, KT_SYNC02);
    await attachSectionToKyThi(page, `${SECTION_SYNC02_A} (Nghe)`);
    await attachSectionToKyThi(page, `${SECTION_SYNC02_B} (Nói)`);
    await saveKyThiPopup(page);

    await gotoDeThi(page, baseUrl);
    await clickAddNewDeThi(page);
    await selectExamType(page, KT_SYNC02);
    // Chọn "Loại kỳ thi" LẦN ĐẦU tự fill đúng danh sách + thứ tự Section theo Cấu hình đề xuất.
    expect(await readStructureSectionNamesInOrder(page)).toEqual([SECTION_SYNC02_A, SECTION_SYNC02_B]);

    await fillExamName(page, EXAM_SYNC02);
    await fillExamDuration(page, 10);
    await selectGrades(page, ["Lớp 2"]);
    await selectScoreTable(page, SCORE_SYNC);
    await clickSaveDeThi(page);
  });

  test("SYNC-03: Cấu trúc đề xuất chỉ là gợi ý - sửa riêng ở Đề thi KHÔNG ảnh hưởng ngược lại Kỳ thi gốc", async () => {
    await gotoSections(page, baseUrl);
    await createSection(page, { name: SECTION_SYNC03_C, skill: "Đọc" });

    // Nối tiếp SYNC-02: thêm riêng 1 Section (C) vào chính Đề thi vừa tạo, không qua màn Kỳ thi.
    // `openEditDeThi()` chỉ đợi tiêu đề hiện - form (gồm Cấu trúc đề) điền lại dữ liệu BẤT ĐỒNG BỘ
    // sau đó (cùng lưu ý đã ghi ở `score-table-perm-sync.spec.js` SYNC-03) nên PHẢI `expect.poll()`
    // thay vì đọc ngay, tránh đọc trúng lúc Cấu trúc đề còn rỗng.
    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, EXAM_SYNC02);
    await expect
      .poll(async () => readStructureSectionNamesInOrder(page), { timeout: 10000 })
      .toEqual([SECTION_SYNC02_A, SECTION_SYNC02_B]);
    await addSectionToStructure(page, SECTION_SYNC03_C);
    await clickSaveDeThi(page);

    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, EXAM_SYNC02);
    await expect
      .poll(async () => readStructureSectionNamesInOrder(page), { timeout: 10000 })
      .toEqual([SECTION_SYNC02_A, SECTION_SYNC02_B, SECTION_SYNC03_C]);

    // Cấu hình đề xuất GỐC của Kỳ thi KHÔNG bị ảnh hưởng - vẫn chỉ 2 Section ban đầu.
    await gotoKyThi(page, baseUrl);
    await openEditKyThiPopup(page, KT_SYNC02);
    expect(await readAttachedSectionNamesInOrder(page)).toEqual([SECTION_SYNC02_A, SECTION_SYNC02_B]);
    await cancelKyThiPopup(page);
  });

  test.skip(
    "SYNC-04: Tạo Đề thi và chọn Kỳ thi -> dropdown Bảng điểm chỉ liệt kê đúng Dạng quy đổi của Kỳ thi - KHÔNG áp dụng: hệ thống hiện chỉ có đúng 1 giá trị Dạng quy đổi ('Phổ thông') cho mọi Kỳ thi/Bảng điểm, không có cách nào tạo Bảng điểm khác Dạng quy đổi để kiểm tra rule lọc (cùng kết luận ADD-03/EDIT-04/SYNC-02 của score-table-perm-sync.spec.js)",
    () => {},
  );

  test("SYNC-05: Dropdown Bảng điểm mặc định giữ nguyên bảng điểm tạo sớm nhất, không đổi sang bảng mới hơn", async () => {
    await gotoKyThi(page, baseUrl);
    await createKyThi(page, { name: KT_SYNC05 });

    await gotoDeThi(page, baseUrl);
    await clickAddNewDeThi(page);
    await selectExamType(page, KT_SYNC05);
    const before = (await readSelectedScoreTable(page)).trim();

    // Tạo thêm 1 Bảng điểm MỚI HƠN - mặc định không được đổi sang bảng vừa tạo.
    await gotoScoreTables(page, baseUrl);
    await createScoreTable(page, { name: SCORE_SYNC05_NEW });

    await gotoDeThi(page, baseUrl);
    await clickAddNewDeThi(page);
    await selectExamType(page, KT_SYNC05);
    const after = (await readSelectedScoreTable(page)).trim();
    expect(after).toBe(before);
    expect(after).not.toContain(SCORE_SYNC05_NEW);
  });

  test("SYNC-06: Đổi Kỳ thi đang chọn khi tạo Đề thi -> cấu trúc gợi ý làm mới hoàn toàn theo Kỳ thi mới", async () => {
    await gotoSections(page, baseUrl);
    await createSection(page, { name: SECTION_SYNC06_A, skill: "Nghe" });
    await createSection(page, { name: SECTION_SYNC06_B, skill: "Nói" });

    await gotoKyThi(page, baseUrl);
    await createKyThi(page, { name: KT_SYNC06_A });
    await openEditKyThiPopup(page, KT_SYNC06_A);
    await attachSectionToKyThi(page, `${SECTION_SYNC06_A} (Nghe)`);
    await saveKyThiPopup(page);

    await createKyThi(page, { name: KT_SYNC06_B });
    await openEditKyThiPopup(page, KT_SYNC06_B);
    await attachSectionToKyThi(page, `${SECTION_SYNC06_B} (Nói)`);
    await saveKyThiPopup(page);

    await gotoDeThi(page, baseUrl);
    await clickAddNewDeThi(page);
    await selectExamType(page, KT_SYNC06_A);
    expect(await readStructureSectionNamesInOrder(page)).toEqual([SECTION_SYNC06_A]);

    await selectExamType(page, KT_SYNC06_B);
    expect(await readStructureSectionNamesInOrder(page)).toEqual([SECTION_SYNC06_B]);
  });

  test("SYNC-07: Kỳ thi bị xóa không còn xuất hiện trong dropdown chọn Loại kỳ thi ở màn Tạo mới Đề thi", async () => {
    await gotoKyThi(page, baseUrl);
    await createKyThi(page, { name: KT_SYNC07 });
    await deleteKyThiByName(page, KT_SYNC07);

    await gotoDeThi(page, baseUrl);
    await clickAddNewDeThi(page);
    const examTypeSelect = page.locator('[class*="n-form-item"]', { hasText: /^Loại kỳ thi/ }).locator(".n-base-selection");
    await examTypeSelect.click();
    const options = await page.locator('.n-base-select-option:visible, [role="option"]:visible').allInnerTexts();
    expect(options.some((t) => t.includes(KT_SYNC07))).toBe(false);
    await page.keyboard.press("Escape");
  });
});
