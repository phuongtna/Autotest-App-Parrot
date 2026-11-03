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
} from "../../../../automation/quan_ly_section/navigation/cmsSectionPageObjects.js";
import { gotoKyThi, createKyThi } from "../../../../automation/quan_ly_ky_thi/navigation/cmsKyThiPageObjects.js";
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
  readSectionDurationInStructure,
  clickAddPracticeButton,
  selectPracticeInPopup,
  clickPracticePopupSave,
  selectTrangThai,
  clickSave as clickSaveDeThi,
  clickPublishButton,
  confirmPublish,
  readRowStatusBadge as readDeThiRowStatusBadge,
} from "../../../../automation/ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

/**
 * Nhóm "3. Chỉnh sửa Section" (EDIT-01..14) - xem ghi chú chung (env dev, tiền tố AUTO-) tại
 * `section-list.spec.js`.
 *
 * EDIT-04/05/12/13 (2026-11-03): tự động hoá đầy đủ bằng cách tái sử dụng page objects của module
 * "Ngân hàng đề thi" (`automation/ngan_hang_de_thi/`, viết sau `quan_ly_section` ban đầu) để dựng 1
 * Kỳ thi rỗng + 1 Bảng điểm + 1 Đề thi gắn SẴN section `BASE` của file này vào "Cấu trúc đề" (xem
 * `ensureDeThiFixtureForEditCases()` ngay dưới) - KHÔNG còn `test.skip` như trước (lúc đó module
 * Ngân hàng đề thi chưa tồn tại).
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
const KT_EMPTY_FOR_EDIT = `${runId}-kt-editcascade`;
const SCORE_TABLE_FOR_EDIT = `${runId}-bd-editcascade`;
const EXAM_FOR_EDIT = `${runId}-examEdit0405`;

test.describe.serial("Quản lý Section - 3. Chỉnh sửa Section (EDIT-01..14)", () => {
  let context;
  let page;
  let baseUrl;
  let deThiFixtureReady = false;
  // Tên hiển thị HIỆN TẠI của section `BASE` trên CMS - EDIT-12/13 đổi Tên thật của nó (để kiểm
  // tra cascade sang Đề thi) nên các bước sau trong 2 case đó phải định vị bằng biến này thay vì
  // hằng số `BASE` (đã đổi tên) - khôi phục lại = BASE ở cuối EDIT-13 để EDIT-14 vẫn định vị đúng.
  let currentBaseName = BASE;

  /** Dựng 1 lần (lazy, dùng cho cả EDIT-04/05/12/13): 1 Kỳ thi rỗng (không tự fill Section) + 1
   * Bảng điểm + 1 Đề thi Nháp gắn sẵn section `BASE` vào "Cấu trúc đề" (Thời lượng tự fill = 20,
   * đúng Thời lượng đang cấu hình ở Quản lý Section lúc này). */
  async function ensureDeThiFixtureForEditCases() {
    if (deThiFixtureReady) return;
    await gotoKyThi(page, baseUrl);
    await createKyThi(page, { name: KT_EMPTY_FOR_EDIT });

    await gotoScoreTables(page, baseUrl);
    await createScoreTable(page, { name: SCORE_TABLE_FOR_EDIT });

    await gotoDeThi(page, baseUrl);
    await clickAddNewDeThi(page);
    // Thứ tự điền field GIỐNG HỆT `createExam()` đã dùng Pass nhiều lần ở các spec khác (Loại kỳ
    // thi -> Thời lượng -> Khối lớp -> Bảng điểm quy đổi) - KHÔNG chọn Bảng điểm ngay sau Loại kỳ
    // thi (ĐÃ GẶP THẬT 2026-11-03: field "Bảng điểm quy đổi" vừa được enable/load lại danh sách
    // option ngay sau khi chọn Loại kỳ thi, chọn ngay lập tức bị miss do race condition - field vẫn
    // trống, chặn Lưu, Đề thi không được tạo).
    await fillExamName(page, EXAM_FOR_EDIT);
    await selectExamType(page, KT_EMPTY_FOR_EDIT);
    await fillExamDuration(page, 20);
    await selectGrades(page, ["Lớp 1"]);
    await selectScoreTable(page, SCORE_TABLE_FOR_EDIT);
    await addSectionToStructure(page, BASE);
    await clickSaveDeThi(page);
    deThiFixtureReady = true;
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

    await gotoSections(page, baseUrl);
    await createSection(page, { name: BASE, skill: "Đọc", duration: 20 });
  });

  test.afterAll(async () => {
    // KHÔNG xóa dữ liệu test - theo yêu cầu, giữ lại để xem sau khi chạy.
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
    // đổi lại tên gốc để các case SAU trong file này vẫn định vị được bằng BASE
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

  test("EDIT-04: sửa Thời lượng của Section đã gắn vào Đề thi - không cascade", async () => {
    await ensureDeThiFixtureForEditCases();

    await gotoSections(page, baseUrl);
    await openEditSectionPopup(page, currentBaseName);
    await fillSectionForm(page, { duration: 99 });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, EXAM_FOR_EDIT);
    expect(await readSectionDurationInStructure(page, currentBaseName)).toBe("20");

    // trả Thời lượng Section về gốc (20) - EDIT-05 và các case Thời lượng khác phía sau đều dựa
    // vào baseline này.
    await gotoSections(page, baseUrl);
    await openEditSectionPopup(page, currentBaseName);
    await fillSectionForm(page, { duration: 20 });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("EDIT-05: Thời lượng trong Đề thi vẫn sửa được riêng", async () => {
    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, EXAM_FOR_EDIT);
    await fillSectionDurationInStructure(page, currentBaseName, 40);
    await fillExamDuration(page, 40); // khớp lại tổng thời lượng đề để Lưu được
    await clickSaveDeThi(page);

    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, EXAM_FOR_EDIT);
    expect(await readSectionDurationInStructure(page, currentBaseName)).toBe("40");

    // Thời lượng RIÊNG của Section (Quản lý Section) không bị ảnh hưởng ngược lại.
    await gotoSections(page, baseUrl);
    expect((await readRowDuration(page, currentBaseName)).trim()).toBe("20 phút");
  });

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

  test("EDIT-12: sửa Section đã gắn Đề thi đã Công khai vẫn được phép", async () => {
    // Đưa EXAM_FOR_EDIT lên Công khai (cần Hoàn thành + Section có >=1 Bài thực hành) để có đúng
    // tiền điều kiện "Section đã gắn Đề thi đã Công khai".
    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, EXAM_FOR_EDIT);
    await clickAddPracticeButton(page, currentBaseName);
    // "AI vocabulary" (dùng ở de-thi-save-status.spec.js) KHÔNG áp dụng được ở đây - danh sách Đề
    // thi chọn làm Bài thực hành được lọc theo ĐÚNG Kỹ năng của section (`currentBaseName` = "Đọc"
    // lúc này), "AI vocabulary" thuộc Kỹ năng khác nên không bao giờ xuất hiện (ĐÃ GẶP THẬT
    // 2026-11-03: popup treo vô thời hạn chờ 1 phần tử không tồn tại) - dùng 1 đề thuộc đúng Kỹ
    // năng Đọc đang hiển thị thật trong danh sách.
    await selectPracticeInPopup(page, "Put the words in the correct order");
    await clickPracticePopupSave(page);
    await selectTrangThai(page, deThiPo.completedRadioLabel);
    await clickSaveDeThi(page);

    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, EXAM_FOR_EDIT);
    await clickPublishButton(page);
    await confirmPublish(page);
    await gotoDeThi(page, baseUrl);
    expect(await readDeThiRowStatusBadge(page, EXAM_FOR_EDIT)).toContain("Công khai");

    // Sửa Section đang gắn vào đề ĐÃ Công khai - kỳ vọng vẫn Lưu được bình thường, không bị chặn.
    const newName = `${BASE}-edit12`;
    await gotoSections(page, baseUrl);
    await openEditSectionPopup(page, currentBaseName);
    await fillSectionForm(page, { name: newName });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(po.tableRowSelector, { hasText: newName })).toBeVisible();
    currentBaseName = newName;
  });

  test("EDIT-13: sửa Tên/Kỹ năng của Section đã gắn Đề thi - cascade", async () => {
    // Tên đã đổi ở EDIT-12 (currentBaseName) - Đề thi phải hiển thị NGAY tên mới (cascade qua ID
    // dùng chung, không phải bản sao dữ liệu).
    await gotoDeThi(page, baseUrl);
    await openEditDeThi(page, EXAM_FOR_EDIT);
    await expect(page.getByText(currentBaseName, { exact: false }).first()).toBeVisible();

    // Đổi tiếp Kỹ năng - cùng cơ chế cascade (1 bản ghi Section, Đề thi chỉ tham chiếu theo id).
    await gotoSections(page, baseUrl);
    await openEditSectionPopup(page, currentBaseName);
    await fillSectionForm(page, { skill: "Viết" });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await readRowSkill(page, currentBaseName)).trim()).toBe("Viết");

    // khôi phục Tên + Kỹ năng gốc để EDIT-14 (và cleanup chung) vẫn định vị đúng bằng BASE.
    await openEditSectionPopup(page, currentBaseName);
    await fillSectionForm(page, { name: BASE, skill: "Đọc" });
    await saveSectionPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    currentBaseName = BASE;
  });

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
