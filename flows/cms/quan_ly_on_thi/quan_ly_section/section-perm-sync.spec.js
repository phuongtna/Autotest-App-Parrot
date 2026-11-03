import { test, expect } from "../../../../automation/quan_ly_section/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsSectionPageObjects as po,
  gotoSections,
  createSection,
  openEditSectionPopup,
  fillSectionForm,
  saveSectionPopup,
  openDeleteConfirm,
  confirmDelete,
  sectionRow,
} from "../../../../automation/quan_ly_section/navigation/cmsSectionPageObjects.js";
import {
  cmsKyThiPageObjects as kyThiPo,
  gotoKyThi,
  createKyThi,
  openAddKyThiPopup,
  cancelKyThiPopup,
  openEditKyThiPopup,
  attachSection as attachSectionToKyThi,
  saveKyThiPopup,
  readAttachedSectionNamesInOrder,
  attachedSectionRow,
} from "../../../../automation/quan_ly_ky_thi/navigation/cmsKyThiPageObjects.js";
import { gotoScoreTables, createScoreTable } from "../../../../automation/cau_hinh_bang_diem/navigation/cmsScoreTablePageObjects.js";
import {
  cmsDeThiPageObjects as deThiPo,
  gotoDeThi,
  clickAddNew as clickAddNewDeThi,
  openEditDeThi,
  fillExamName,
  selectExamType,
  fillExamDuration,
  selectGrades,
  selectScoreTable,
  addSectionToStructure,
  fillSectionDurationInStructure,
  isStructureEmpty,
  clickSave as clickSaveDeThi,
} from "../../../../automation/ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

/**
 * Nhóm "5. Phân quyền truy cập" (PERM-01) và "6. Đồng bộ dữ liệu Section sang Kỳ thi / Đề thi"
 * (SYNC-01..07) của `flows/cms/quan_ly_on_thi/quan_ly_section/TESTCASES.md`.
 *
 * PERM-01 GIỮ NGUYÊN `test.skip` - chưa có tài khoản CMS non-Admin cấu hình cho module này (ngoài
 * phạm vi yêu cầu lần này, chỉ làm SYNC-*).
 *
 * SYNC-01..07 (2026-11-03): tự động hoá đầy đủ bằng cách tái sử dụng page objects của "Ngân hàng đề
 * thi"/"Quản lý kỳ thi" (cùng kỹ thuật đã dùng ở `section-edit.spec.js` EDIT-04/05/12/13 và
 * `section-delete.spec.js` DEL-02/03/04/06) - KHÔNG còn `test.skip`.
 *
 * SYNC-01/02 (2026-11-03, SỬA LẠI theo đúng ý case gốc - KHÔNG phải test "live update không cần
 * F5" như hiểu nhầm ban đầu của tôi, xem lịch sử sửa đổi): quy trình ĐÚNG đơn giản hơn nhiều - làm
 * xong thao tác (tạo/sửa/xóa Section) ở màn Quản lý Section TRƯỚC, SAU ĐÓ mới điều hướng sang mở
 * màn Đề thi/Kỳ thi (1 tab, tuần tự, KHÔNG cần 2 tab/không F5) để kiểm tra dữ liệu đã cập nhật đúng
 * chưa. Bản sửa trước đó (dùng 2 tab mô phỏng "không F5 tab đang mở sẵn") sai so với mô tả case gốc
 * trong TESTCASES.md.
 */
const SECTION_ENV = process.env.QUAN_LY_SECTION_ENV || "dev";
const runId = `AUTO-${Date.now().toString(36)}`;
// Tên KHÔNG được là substring lẫn nhau (ĐÃ GẶP THẬT 2026-11-03: "...-kt-sync" là substring của
// "...-kt-sync07" khiến `selectExamType`/`hasText` khớp nhầm sang kỳ thi khác - strict mode không
// bắt được vì mỗi lần chỉ có 1 phần tử `:visible` nhưng SAI phần tử, `.first()` lặng lẽ chọn nhầm).
const KT_FOR_SYNC = `${runId}-kt-syncA`;
const KT_FOR_SYNC02 = `${runId}-kt-syncB02`;
const KT_FOR_SYNC05 = `${runId}-kt-syncB05`;
const KT_FOR_SYNC07 = `${runId}-kt-syncB07`;
const SCORE_TABLE_FOR_SYNC = `${runId}-bd-sync`;

test.describe("Quản lý Section - 5. Phân quyền truy cập (PERM-01)", () => {
  test.skip(
    "PERM-01: tài khoản không có quyền Admin CMS truy cập menu Quản lý Section - BỎ QUA: chưa có tài khoản CMS non-Admin được cấu hình cho module này",
    () => {},
  );
});

// KHÔNG dùng `.serial` (khác các file khác trong module) - CÁC CASE ĐỘC LẬP VỚI NHAU (chỉ dùng
// chung `page`/fixture, không phụ thuộc kết quả nhau), và SYNC-01 CÓ THẬT 1 bug (xem ghi chú phía
// trên) nên PHẢI fail mà KHÔNG được kéo theo "did not run" cho SYNC-02..07 như `.serial` sẽ làm
// (ĐÃ GẶP THẬT 2026-11-03: `.serial` dừng toàn bộ case sau khi 1 case fail). Thứ tự chạy vẫn đúng
// theo khai báo trong file nhờ `workers: 1`/`fullyParallel: false` của config chung cả module.
test.describe("Quản lý Section - 6. Đồng bộ dữ liệu Section sang Kỳ thi / Đề thi (SYNC-01..07)", () => {
  let context;
  let page;
  let baseUrl;

  /** ĐÃ GẶP THẬT (2026-11-03, debug qua console.log): `readAddableSectionOptionTexts()`/
   * `readAttachableSectionOptionTexts()` đọc nguyên trạng list KHÔNG gõ tìm - trên môi trường đã
   * tích luỹ nhiều Section (AUTO- của các lượt chạy trước + dữ liệu thật), dropdown chỉ RENDER 1 lô
   * ~10 option đầu tiên (virtual scroll của Naive UI select) - Section mới tạo gần như CHẮC CHẮN
   * không rơi vào đúng lô đó, KHÔNG PHẢI do chưa đồng bộ/cần tải lại trang (đã xác nhận: chờ lặp lại
   * nhiều lần vẫn không thấy, trong khi list vẫn chứa đủ 10 phần tử khác). Gõ tìm (các select này hỗ
   * trợ filter-by-typing) để ép đúng Section cần tìm phải render ra mới đọc được - đây mới là cách
   * đúng để kiểm tra "có xuất hiện hay không", tách biệt khỏi vấn đề virtual-scroll không liên quan. */
  async function readAddableSectionOptionTextsFiltered(p, searchText) {
    const selectLocator = p.locator(".n-base-selection", { hasText: deThiPo.addSectionToStructurePlaceholder });
    await selectLocator.click();
    await p.keyboard.type(searchText, { delay: 20 });
    await p.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(1500);
    const options = p.locator('.n-base-select-option:visible, [role="option"]:visible');
    const texts = await options.allInnerTexts().catch(() => []);
    await p.keyboard.press("Escape");
    return texts;
  }

  async function readAttachableSectionOptionTextsFiltered(p, searchText) {
    const selectLocator = p.getByRole("dialog").locator(".n-base-selection").nth(1);
    await selectLocator.click();
    await p.keyboard.type(searchText, { delay: 20 });
    await p.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(1500);
    const options = p.locator('.n-base-select-option:visible, [role="option"]:visible');
    const texts = await options.allInnerTexts().catch(() => []);
    await p.keyboard.press("Escape");
    return texts;
  }

  async function createExamWithSection(examName, sectionName) {
    await gotoDeThi(page, baseUrl);
    await clickAddNewDeThi(page);
    await fillExamName(page, examName);
    await selectExamType(page, KT_FOR_SYNC);
    await fillExamDuration(page, 20);
    await selectGrades(page, ["Lớp 1"]);
    await selectScoreTable(page, SCORE_TABLE_FOR_SYNC);
    await addSectionToStructure(page, sectionName);
    await fillSectionDurationInStructure(page, sectionName, 20);
    await clickSaveDeThi(page);
  }

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

    // Fixture dùng chung: 1 Kỳ thi rỗng (chỉ làm "Loại kỳ thi" khi tạo Đề thi cho SYNC-01/03/04/06)
    // + 3 Kỳ thi RIÊNG cho SYNC-02/05/07 (cần gắn Section thật vào "Cấu hình đề xuất", tách biệt để
    // không ảnh hưởng lẫn nhau) + 1 Bảng điểm.
    await gotoKyThi(page, baseUrl);
    await createKyThi(page, { name: KT_FOR_SYNC });
    await createKyThi(page, { name: KT_FOR_SYNC02 });
    await createKyThi(page, { name: KT_FOR_SYNC05 });
    await createKyThi(page, { name: KT_FOR_SYNC07 });

    await gotoScoreTables(page, baseUrl);
    await createScoreTable(page, { name: SCORE_TABLE_FOR_SYNC });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("SYNC-01: Section mới tạo hiển thị trong dropdown chọn Section ở Đề thi", async () => {
    const newSection = `${runId}-sync01`;
    await gotoSections(page, baseUrl);
    await createSection(page, { name: newSection, skill: "Nghe" });

    await gotoDeThi(page, baseUrl);
    await clickAddNewDeThi(page);
    await selectExamType(page, KT_FOR_SYNC);
    const options = await readAddableSectionOptionTextsFiltered(page, newSection);
    expect(options.some((t) => t.includes(newSection))).toBe(true);
  });

  test("SYNC-02: Section mới tạo hiển thị trong dropdown chọn Section ở Kỳ thi", async () => {
    const newSection = `${runId}-sync02`;
    await gotoSections(page, baseUrl);
    await createSection(page, { name: newSection, skill: "Viết" });

    await gotoKyThi(page, baseUrl);
    await openEditKyThiPopup(page, KT_FOR_SYNC02);
    const options = await readAttachableSectionOptionTextsFiltered(page, newSection);
    expect(options.some((t) => t.includes(newSection))).toBe(true);
    await cancelKyThiPopup(page);
  });

  test("SYNC-03: sửa Tên phần thi của Section đã gắn Đề thi -> Đề thi hiển thị đúng tên mới ngay", async () => {
    const sectionName = `${runId}-sync0304`;
    const examName = `${runId}-examSync0304`;
    await gotoSections(page, baseUrl);
    await createSection(page, { name: sectionName, skill: "Đọc" });
    await createExamWithSection(examName, sectionName);

    const newName = `${sectionName}-renamed`;
    await gotoSections(page, baseUrl);
    await openEditSectionPopup(page, sectionName);
    await fillSectionForm(page, { name: newName });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, examName);
    await expect(page.getByText(newName, { exact: false }).first()).toBeVisible();
  });

  test("SYNC-04: sửa Kỹ năng của Section đã gắn Đề thi -> Đề thi hiển thị đúng kỹ năng mới", async () => {
    const sectionName = `${runId}-sync0304-renamed`; // tên hiện tại sau SYNC-03
    const examName = `${runId}-examSync0304`;
    const newSkill = "Viết";
    await gotoSections(page, baseUrl);
    await openEditSectionPopup(page, sectionName);
    await fillSectionForm(page, { skill: newSkill });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, examName);
    // `sectionCardInStructure()` dùng XPath THÔ, KHÔNG khớp đúng DOM thật (ĐÃ GẶP THẬT 2026-11-03,
    // xác nhận qua screenshot: nhãn Kỹ năng "Viết" THỰC SỰ hiển thị đúng cạnh tên Section, chỉ là
    // locator sai) - dùng lại chính pattern đã chạy ổn định ở `fillSectionDurationInStructure()`/
    // `removeSectionFromStructure()` trong cùng file thay vì export fragile đó.
    const card = page.locator("div", { hasText: sectionName }).filter({ has: page.getByRole("button", { name: deThiPo.removeSectionFromStructureButton }) }).last();
    await expect(card).toContainText(newSkill);
  });

  test("SYNC-05: sửa Tên/Kỹ năng của Section đã gắn Kỳ thi -> Kỳ thi hiển thị đúng dữ liệu mới", async () => {
    const sectionName = `${runId}-sync05`;
    await gotoSections(page, baseUrl);
    await createSection(page, { name: sectionName, skill: "Nghe" });

    await gotoKyThi(page, baseUrl);
    await openEditKyThiPopup(page, KT_FOR_SYNC05);
    await attachSectionToKyThi(page, `${sectionName} (Nghe)`);
    await saveKyThiPopup(page);

    const newName = `${sectionName}-renamed`;
    await gotoSections(page, baseUrl);
    await openEditSectionPopup(page, sectionName);
    await fillSectionForm(page, { name: newName, skill: "Nói" });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await gotoKyThi(page, baseUrl);
    await openEditKyThiPopup(page, KT_FOR_SYNC05);
    const names = await readAttachedSectionNamesInOrder(page);
    expect(names).toContain(newName);
    await expect(attachedSectionRow(page, newName)).toContainText("Nói");
    await cancelKyThiPopup(page);
  });

  test("SYNC-06: Section bị xóa biến mất sạch khỏi cấu trúc Đề thi đang tham chiếu", async () => {
    const sectionName = `${runId}-sync06`;
    const examName = `${runId}-examSync06`;
    await gotoSections(page, baseUrl);
    await createSection(page, { name: sectionName, skill: "Nghe" });
    await createExamWithSection(examName, sectionName);

    await gotoSections(page, baseUrl);
    await openDeleteConfirm(page, sectionName);
    await confirmDelete(page);
    await expect(sectionRow(page, sectionName)).toHaveCount(0);

    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, examName);
    expect(await isStructureEmpty(page)).toBe(true);
  });

  test("SYNC-07: Section bị xóa biến mất sạch khỏi cấu trúc Kỳ thi đang tham chiếu", async () => {
    const sectionName = `${runId}-sync07`;
    await gotoSections(page, baseUrl);
    await createSection(page, { name: sectionName, skill: "Viết" });

    await gotoKyThi(page, baseUrl);
    await openEditKyThiPopup(page, KT_FOR_SYNC07);
    await attachSectionToKyThi(page, `${sectionName} (Viết)`);
    await saveKyThiPopup(page);

    await gotoSections(page, baseUrl);
    await openDeleteConfirm(page, sectionName);
    await confirmDelete(page);
    await expect(sectionRow(page, sectionName)).toHaveCount(0);

    await gotoKyThi(page, baseUrl);
    await openEditKyThiPopup(page, KT_FOR_SYNC07);
    await expect(page.getByText(kyThiPo.emptyAttachedSectionsText, { exact: true })).toBeVisible();
    await cancelKyThiPopup(page);
  });
});
