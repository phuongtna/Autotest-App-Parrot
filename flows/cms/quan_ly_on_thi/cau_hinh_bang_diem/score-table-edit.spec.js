import { test, expect } from "../../../../automation/cau_hinh_bang_diem/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsScoreTablePageObjects as po,
  gotoScoreTables,
  createScoreTable,
  openEditScoreTablePopup,
  fillScoreTableForm,
  saveScoreTablePopup,
  cancelScoreTablePopup,
  closeScoreTablePopupByIcon,
  readDialogText,
  readRowDescription,
  readAllScoreTableNamesInOrder,
  readSelectedConversionInForm,
  deleteScoreTableByName,
} from "../../../../automation/cau_hinh_bang_diem/navigation/cmsScoreTablePageObjects.js";
import {
  cmsDeThiPageObjects as deThiPo,
  gotoDeThi,
  searchDeThi,
  setupDeThiFixtures,
  teardownDeThiFixtures,
  clickAddNew,
  fillExamName,
  selectExamType,
  fillExamDuration,
  selectGrades,
  selectScoreTable,
  openEditDeThi,
  fillSectionDurationInStructure,
  clickAddPracticeButton,
  readPracticePopupOptionTexts,
  selectPracticeInPopup,
  clickPracticePopupSave,
  selectTrangThai,
  clickSave,
  clickPublishButton,
  confirmPublish,
} from "../../../../automation/ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

/**
 * Nhóm "3. Chỉnh sửa Bảng điểm" (EDIT-01..10) - xem ghi chú chung (env staging, tiền tố AUTO-) tại
 * `score-table-list.spec.js`.
 *
 * EDIT-03/04/09 TÁI SỬ DỤNG thẳng helper của module "Ngân hàng đề thi" (`cmsDeThiPageObjects.js` -
 * `setupDeThiFixtures`/`createExam` thủ công/`clickPublishButton`) để tự dựng 1 Đề thi CHƯA công
 * khai (gắn `scoreX`) + 1 Đề thi ĐÃ công khai (gắn `scoreY`), KHÔNG phụ thuộc dữ liệu thật có sẵn.
 * EDIT-09 gắn THÊM 1 Đề thi CHƯA công khai nữa vào CÙNG `scoreY` (đã gắn sẵn đề công khai ở
 * EDIT-04) để tái hiện đúng tình huống "vừa công khai vừa chưa công khai" mà không cần dựng lại từ
 * đầu - rule chặn sửa ("ít nhất 1 đề công khai") giống hệt EDIT-04 nên dùng lại được.
 *
 * LƯU Ý THẬT quan trọng phát hiện khi viết 3 case này (staging, 2026-11-03): chọn "Loại kỳ thi" ở
 * màn Đề thi XÓA SẠCH field "Tên đề thi" nếu đã điền trước đó (loại kỳ thi có Section cấu hình sẵn
 * kích hoạt rebuild lại cấu trúc đề, cuốn theo field Tên) - PHẢI chọn Loại kỳ thi TRƯỚC rồi mới
 * điền Tên đề thi (ngược thứ tự so với `createExam()`/`de-thi-save-status.spec.js` vốn điền Tên
 * trước - 2 file đó verify trên dev, có thể dev không có bug này). Practice item "AI vocabulary"
 * dùng trong `de-thi-save-status.spec.js` cũng KHÔNG tồn tại trên staging - lấy option ĐẦU TIÊN
 * trong popup "Thêm mới Bài thực hành" thay vì hard-code tên cụ thể.
 *
 * EDIT-10 (sửa Dạng quy đổi sang giá trị khác) BỎ QUA - hệ thống hiện tại chỉ có đúng 1 giá trị
 * "Phổ thông", không có giá trị thứ 2 để đổi sang - xlsx ghi "Pending" (chưa test được).
 */
const runId = `AUTO-${Date.now().toString(36)}`;
const BASE = `${runId}-base`;
const ORDER_A = `${runId}-ord-A`;
const ORDER_B = `${runId}-ord-B`;
const ORDER_C = `${runId}-ord-C`;
const SCORE_X = `${runId}-x`;
const SCORE_Y = `${runId}-y`;
const EXAM_X = `${runId}-examX`;
const EXAM_Y = `${runId}-examY`;
const EXAM_Z_DRAFT = `${runId}-examZ`;
const createdNames = [BASE, ORDER_A, ORDER_B, ORDER_C, SCORE_X, SCORE_Y];

test.describe.serial("Cấu hình bảng điểm - 3. Chỉnh sửa Bảng điểm (EDIT-01..10)", () => {
  let context;
  let page;
  let baseUrl;
  let deThiFixtures;

  test.beforeAll(async ({ browser }) => {
    // beforeAll nặng hơn hẳn các file .spec.js khác trong module (dựng thêm 1 Đề thi đầy đủ cấu
    // trúc + công khai qua helper của Ngân hàng đề thi cho EDIT-03/04/09) - timeout mặc định
    // 60s (từ `playwright.cau-hinh-bang-diem.config.js`) không đủ, nhất là khi chạy headed kèm
    // `CMS_ADMIN_SLOWMO`.
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
    await createScoreTable(page, { name: BASE, description: "Mô tả gốc" });
    await createScoreTable(page, { name: SCORE_X, description: "gắn đề chưa công khai" });
    await createScoreTable(page, { name: SCORE_Y, description: "gắn đề công khai" });

    deThiFixtures = await setupDeThiFixtures(page, baseUrl, runId);

    // EXAM_X: Nháp (chưa công khai), gắn SCORE_X - dùng cho EDIT-03 (kỳ vọng vẫn cho sửa)
    await gotoDeThi(page, baseUrl);
    await clickAddNew(page);
    await selectExamType(page, deThiFixtures.examTypeEmpty);
    await fillExamName(page, EXAM_X);
    await fillExamDuration(page, 10);
    await selectGrades(page, ["Lớp 2"]);
    await selectScoreTable(page, SCORE_X);
    await clickSave(page);

    // EXAM_Y: Hoàn thành + Công khai, gắn SCORE_Y - dùng cho EDIT-04 (kỳ vọng chặn sửa)
    await gotoDeThi(page, baseUrl);
    await clickAddNew(page);
    await selectExamType(page, deThiFixtures.examTypeWithSections);
    await fillExamName(page, EXAM_Y);
    await fillExamDuration(page, 25);
    await selectGrades(page, ["Lớp 1"]);
    await selectScoreTable(page, SCORE_Y);
    await fillSectionDurationInStructure(page, deThiFixtures.sectionA, 10);
    await fillSectionDurationInStructure(page, deThiFixtures.sectionB, 15);
    for (const section of [deThiFixtures.sectionA, deThiFixtures.sectionB]) {
      await clickAddPracticeButton(page, section);
      // Danh sách Bài thực hành trong popup tải bất đồng bộ SAU KHI dialog đã hiện tiêu đề - chờ
      // ngắn trước khi đọc option, nếu không `readPracticePopupOptionTexts()` trả về rỗng (ĐÃ GẶP
      // THẬT 2026-11-03, staging).
      await page.waitForTimeout(800);
      const [firstOption] = await readPracticePopupOptionTexts(page);
      await selectPracticeInPopup(page, firstOption);
      await clickPracticePopupSave(page);
    }
    await selectTrangThai(page, deThiPo.completedRadioLabel);
    await clickSave(page);

    await gotoDeThi(page, baseUrl);
    await searchDeThi(page, EXAM_Y);
    await openEditDeThi(page, EXAM_Y);
    await clickPublishButton(page);
    await confirmPublish(page);
  });

  test.afterAll(async () => {
    // PHẢI xóa Đề thi (tham chiếu) trước, sau đó mới xóa được Kỳ thi/Section (bị chặn khi còn
    // gắn) - rồi mới tới Bảng điểm SCORE_X/SCORE_Y (cũng bị chặn xóa khi còn gắn Đề thi, giống
    // rule Sửa ở EDIT-04/09).
    await teardownDeThiFixtures(page, baseUrl, deThiFixtures, [EXAM_X, EXAM_Y, EXAM_Z_DRAFT]);
    for (const name of createdNames) {
      await deleteScoreTableByName(page, name).catch(() => {});
    }
    await context.close();
  });

  test("EDIT-01: mở popup Sửa hiển thị đúng dữ liệu hiện tại", async () => {
    await gotoScoreTables(page, baseUrl);
    await openEditScoreTablePopup(page, BASE);
    await expect(page.getByRole("dialog").getByText(po.editDialogTitle)).toBeVisible();
    await expect(page.locator(po.nameInput)).toHaveValue(BASE);
    await expect(page.locator(po.descriptionInput)).toHaveValue("Mô tả gốc");
    expect((await readSelectedConversionInForm(page)).trim()).toBe(po.conversionDefaultValue);
    await cancelScoreTablePopup(page);
  });

  test("EDIT-02: sửa Tên/Mô tả Bảng điểm chưa gắn Đề thi nào -> bảng cập nhật ngay, không cần tải lại", async () => {
    const newName = `${BASE}-renamed`;
    await openEditScoreTablePopup(page, BASE);
    await fillScoreTableForm(page, { name: newName, description: "Mô tả mới" });
    await saveScoreTablePopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(po.tableRowSelector, { hasText: newName })).toBeVisible();
    expect((await readRowDescription(page, newName)).trim()).toBe("Mô tả mới");
    // đổi lại tên/mô tả gốc để các case sau (và afterAll cleanup) vẫn định vị được bằng BASE
    await openEditScoreTablePopup(page, newName);
    await fillScoreTableForm(page, { name: BASE, description: "Mô tả gốc" });
    await saveScoreTablePopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("EDIT-03: sửa Bảng điểm đã gắn Đề thi CHƯA công khai -> vẫn cho phép sửa", async () => {
    await gotoScoreTables(page, baseUrl);
    await openEditScoreTablePopup(page, SCORE_X);
    await fillScoreTableForm(page, { description: "đã sửa khi gắn đề chưa công khai" });
    await saveScoreTablePopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // readRowDescription() đọc 1 lần (không tự retry như expect(locator)) - bọc expect.poll để
    // chịu được độ trễ cập nhật bảng ngay sau Lưu (ĐÃ GẶP THẬT 2026-11-03, staging).
    await expect
      .poll(async () => (await readRowDescription(page, SCORE_X)).trim())
      .toBe("đã sửa khi gắn đề chưa công khai");
  });

  test("EDIT-04: sửa Bảng điểm đã gắn Đề thi ĐÃ công khai -> KHÔNG cho phép sửa", async () => {
    await gotoScoreTables(page, baseUrl);
    await openEditScoreTablePopup(page, SCORE_Y);
    await fillScoreTableForm(page, { description: "không được phép lưu" });
    await saveScoreTablePopup(page);
    // Lưu bị chặn thật (báo lỗi qua toast, KHÔNG phải lỗi validate trong popup) - dialog vẫn mở
    await expect(page.getByRole("dialog")).toBeVisible();
    const toastTexts = await page.locator(".n-message, [role='alert']").allInnerTexts();
    expect(toastTexts.join(" ")).toContain("Gỡ công khai các đề này trước khi chỉnh sửa");
    await cancelScoreTablePopup(page);
    expect((await readRowDescription(page, SCORE_Y)).trim()).toBe("gắn đề công khai");
  });

  test("EDIT-05: validate khi Sửa - xóa trống Tên bảng điểm", async () => {
    await openEditScoreTablePopup(page, BASE);
    await fillScoreTableForm(page, { name: "" });
    await saveScoreTablePopup(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await readDialogText(page)).toContain(po.nameRequiredError);
    await cancelScoreTablePopup(page);
    await expect(page.locator(po.tableRowSelector, { hasText: BASE })).toBeVisible();
  });

  test("EDIT-06: bấm Hủy khi đang sửa -> dữ liệu gốc giữ nguyên", async () => {
    await openEditScoreTablePopup(page, BASE);
    await fillScoreTableForm(page, { name: `${BASE}-should-not-save`, description: "không được lưu" });
    await cancelScoreTablePopup(page);
    await expect(page.locator(po.tableRowSelector, { hasText: BASE })).toBeVisible();
    expect((await readRowDescription(page, BASE)).trim()).toBe("Mô tả gốc");
  });

  test("EDIT-07: đóng popup Sửa bằng icon '×' -> dữ liệu gốc giữ nguyên", async () => {
    await openEditScoreTablePopup(page, BASE);
    await fillScoreTableForm(page, { name: `${BASE}-should-not-save-x` });
    await closeScoreTablePopupByIcon(page);
    await expect(page.locator(po.tableRowSelector, { hasText: BASE })).toBeVisible();
  });

  test("EDIT-08: vị trí trong danh sách không đổi sau khi Sửa bảng điểm không phải mới nhất", async () => {
    await createScoreTable(page, { name: ORDER_A });
    await createScoreTable(page, { name: ORDER_B });
    await createScoreTable(page, { name: ORDER_C });
    const beforeNames = await readAllScoreTableNamesInOrder(page);
    const beforeIdxB = beforeNames.indexOf(ORDER_B);
    expect(beforeIdxB).toBeGreaterThanOrEqual(0);

    await openEditScoreTablePopup(page, ORDER_B);
    await fillScoreTableForm(page, { description: "đã sửa mô tả" });
    await saveScoreTablePopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const afterNames = await readAllScoreTableNamesInOrder(page);
    expect(afterNames.indexOf(ORDER_B)).toBe(beforeIdxB);
    // C (tạo sau B) vẫn phải đứng trước B - B không nhảy lên đầu
    expect(afterNames.indexOf(ORDER_C)).toBeLessThan(afterNames.indexOf(ORDER_B));
  });

  test("EDIT-09: [Edge] Bảng điểm vừa gắn Đề thi đã công khai vừa gắn Đề thi chưa công khai -> vẫn KHÔNG cho phép sửa", async () => {
    // SCORE_Y đã gắn sẵn EXAM_Y (đã công khai) từ EDIT-04 - gắn thêm EXAM_Z_DRAFT (Nháp) vào CÙNG
    // SCORE_Y để tái hiện đúng tình huống "vừa công khai vừa chưa công khai".
    await gotoDeThi(page, baseUrl);
    await clickAddNew(page);
    await selectExamType(page, deThiFixtures.examTypeEmpty);
    await fillExamName(page, EXAM_Z_DRAFT);
    await fillExamDuration(page, 10);
    await selectGrades(page, ["Lớp 2"]);
    await selectScoreTable(page, SCORE_Y);
    await clickSave(page);

    await gotoScoreTables(page, baseUrl);
    await openEditScoreTablePopup(page, SCORE_Y);
    await fillScoreTableForm(page, { description: "vẫn không được phép" });
    await saveScoreTablePopup(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    const toastTexts = await page.locator(".n-message, [role='alert']").allInnerTexts();
    expect(toastTexts.join(" ")).toContain("Gỡ công khai các đề này trước khi chỉnh sửa");
    await cancelScoreTablePopup(page);
  });
  test.skip(
    "EDIT-10: sửa Dạng quy đổi sang giá trị khác - BỎ QUA: hệ thống hiện chỉ có đúng 1 giá trị 'Phổ thông', chưa có giá trị thứ 2 để test",
    () => {},
  );
});
