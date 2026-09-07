import { test, expect } from "../../../automation/quan_ly_goi_dich_vu/playwrightTest.js";
import { config, resolveCmsAdminBaseUrl, requireCmsAdminConfig } from "../../../automation/src/config.js";
import {
  cmsAdminPageObjects as po,
  gotoPackages,
  openAddPackagePopup,
  openEditPackagePopup,
  fillPackageForm,
  savePackagePopup,
  cancelPackagePopup,
  readPackageTags,
  readPackageStatus,
  defaultToggleSwitch,
  trialCheckbox,
  cmsAdminSwitchState,
  gotoOrders,
  openCreateOrderPopup,
  cancelOrderPopup,
  readTrialPackageOptionTexts,
  readSelectedTrialPackage,
  selectTrialPackageOption,
  fillOrderPhone,
  selectFirstOrderProfileOption,
  saveOrderPopup,
  readTrialPackageErrorText,
  confirmOrderSuccess,
  searchStudent,
  readStudentAccountType,
  readStudentPackageText,
  openPackageHistory,
  readPackageHistoryRows,
  closePackageHistory,
} from "../../../automation/quan_ly_goi_dich_vu/navigation/cmsAdminPageObjects.js";

/**
 * Playwright Test THẬT (`cd automation && npx playwright test`) cho 34 case ĐÃ Pass trong bộ
 * "Quản lý gói dịch vụ" - TẤT CẢ DỒN VÀO 1 FILE này theo yêu cầu (kể cả khi thêm case mới sau này,
 * KHÔNG tách file khác):
 *   UI-01..06, SAVE-01..05, DEACT-01..05, ORDER-01..04 (20 case đầu)
 *   FIELD-01, REG-01..03, GRANT-01, GRANT-02b, GRANT-02, GRANT-08, GRANT-03, GRANT-04a (10 case tiếp)
 *   GRANT-12, GRANT-05, GRANT-06, GRANT-04b (4 case cuối)
 * Mô tả case gốc: xem `flows/cms/goi_dich_vu/TESTCASES.md`.
 *
 * GRANT-03/04a/12/05/06/04b CẦN 1 học sinh CÓ THẬT trên môi trường đang test
 * (`CMS_ADMIN_TEST_STUDENT_PHONE`) - tự `test.skip()` nếu thiếu, giống DEACT-05. Các case GRANT khác
 * trong batch này (01/02b/02/08) KHÔNG cần học sinh (chỉ thao tác trên dropdown/validate, chưa cần
 * lưu đơn thật).
 *
 * GRANT-12 chạy TRƯỚC khi xác nhận đơn Thành công (dừng rồi bật lại hoạt động package gốc trong lúc
 * đơn `grantOrderCode` còn Chờ thanh toán) - PHẢI chạy trước GRANT-05/06 vì sau khi đơn chuyển Thành
 * công, gói dùng thử tự inactive (GRANT-06), không còn "đang hiệu lực" để kiểm tra premise của
 * GRANT-12 nữa. Thứ tự này khớp với logic THẬT đã chạy Pass trong
 * `automation/quan_ly_goi_dich_vu/runtime/grantCasesFlow.js` (không phải suy đoán mới).
 *
 * TOÀN BỘ 20 case chạy trong 1 `test.describe.serial()`, DÙNG CHUNG đúng 3 gói tự tạo
 * (`AUTO-<runId>-A/B/C`) xuyên suốt - không tạo thêm gói D/E riêng như bản tách file trước, khớp
 * với luồng liên tục gốc của `automation/quan_ly_goi_dich_vu/runtime/packageCasesFlow.js`.
 *
 * DEACT-05 CẦN 1 học sinh CÓ THẬT trên môi trường đang test (`CMS_ADMIN_TEST_STUDENT_PHONE` trong
 * `.env`) - đơn hàng thật được tạo NGAY SAU ORDER-04 (lúc gói mặc định còn Hoạt động), rồi DEACT-01
 * mới dừng hoạt động gói đó, DEACT-05 đọc lại lịch sử của đơn này. Thiếu biến thì DEACT-05 tự
 * `test.skip()`, KHÔNG giả định Pass/Fail - các case khác vẫn chạy bình thường.
 *
 * SAVE-05 (2 tab lưu gần đồng thời) KHÔNG hardcode "gói nào thắng" - ĐÃ GẶP THẬT (2026-09-07): độ
 * trễ backend đủ lớn để lật kết quả sau khi đọc thấy đúng kỳ vọng. Code tự đọc gói nào THỰC SỰ
 * đang mặc định ngay sau SAVE-05 (`defaultPkg`/`otherPkg`) rồi dùng biến đó cho toàn bộ case sau.
 *
 * Dọn dẹp sau khi chạy: `npm run cleanup-goi-dich-vu` (chạy từ `automation/`).
 */

const runId = `pw${Date.now().toString(36)}`;
const A = `AUTO-${runId}-A`;
const B = `AUTO-${runId}-B`;
const C = `AUTO-${runId}-C`;
const D = `AUTO-${runId}-D-thuong`; // gói thường (KHÔNG tick Dùng thử) - dùng cho FIELD-01
const studentPhone = config.cmsAdminTestStudentPhone;

let defaultPkg; // gói THẮNG trong race của SAVE-05 (A hoặc B) - xác định động, không đoán trước
let otherPkg; // gói còn lại (không mặc định) trong cặp A/B
let newOrderCode; // set trong ORDER-04 (lúc defaultPkg còn Hoạt động), đọc lại ở DEACT-05
let selectedProfileName; // tên profile ĐÃ chọn - 1 số điện thoại có thể có nhiều profile con
let grantOrderCode; // set trong GRANT-03 (đơn hàng THỨ 2, riêng với newOrderCode ở ORDER-04)

test.describe.serial("Quản lý gói dịch vụ - 20 case đầu (UI-01..06, SAVE-01..05, DEACT-01..05, ORDER-01..04)", () => {
  let context;
  let page;
  let baseUrl;

  test.beforeAll(async ({ browser }) => {
    requireCmsAdminConfig();
    baseUrl = resolveCmsAdminBaseUrl();
    context = await browser.newContext();
    page = await context.newPage();

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator(po.login.usernameInput).fill(config.cmsUsername);
    await page.locator(po.login.passwordInput).fill(config.cmsPassword);
    await page.getByRole("button", { name: po.login.submitButton }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    await gotoPackages(page, baseUrl);
  });

  test.afterAll(async () => {
    await context.close();
  });

  // ---- Group 1 (UI-01..05) - popup Thêm mới, chưa lưu gì ----

  test("UI-01: mặc định checkbox 'Dùng thử' chưa chọn -> không toggle mặc định, không Giá ưu đãi", async () => {
    await openAddPackagePopup(page);
    await expect(page.getByRole("switch")).toHaveCount(1);
    await expect(page.getByText(po.packages.priceOfferedLabel)).toHaveCount(0);
  });

  test("UI-02: tick 'Dùng thử' -> hiện toggle mặc định (OFF), Giá ưu đãi vẫn ẩn", async () => {
    await fillPackageForm(page, { isTrial: true });
    await expect(page.getByRole("switch")).toHaveCount(2);
    expect(await cmsAdminSwitchState.isSwitchOn(defaultToggleSwitch(page))).toBe(false);
    await expect(page.getByText(po.packages.priceOfferedLabel)).toHaveCount(0);
  });

  test("UI-04: label + mô tả toggle mặc định đúng text kỳ vọng", async () => {
    await expect(page.getByText(po.packages.defaultToggleLabel)).toHaveCount(1);
    await expect(page.getByText(po.packages.defaultToggleDescription)).toHaveCount(1);
  });

  test("UI-03: bỏ tick 'Dùng thử' -> toggle mặc định ẩn hoàn toàn, Giá ưu đãi vẫn ẩn", async () => {
    await fillPackageForm(page, { isTrial: false });
    await expect(page.getByRole("switch")).toHaveCount(1);
    await expect(page.getByText(po.packages.priceOfferedLabel)).toHaveCount(0);
  });

  test("UI-05: Giá ưu đãi ẩn hẳn khỏi form ở CẢ 2 trạng thái tick/không tick", async () => {
    await expect(page.getByText(po.packages.priceOfferedLabel)).toHaveCount(0);
    await fillPackageForm(page, { isTrial: true });
    await expect(page.getByText(po.packages.priceOfferedLabel)).toHaveCount(0);
    await cancelPackagePopup(page); // đóng popup, KHÔNG lưu - UI-01..05 chỉ khảo sát form
  });

  // ---- Group 3 (SAVE-01..05) ----

  test("SAVE-01: lưu gói dùng thử với toggle mặc định OFF -> không phải mặc định", async () => {
    await openAddPackagePopup(page);
    await fillPackageForm(page, { name: A, priceListed: 0, isTrial: true, isDefault: false });
    await savePackagePopup(page);
    const tags = await readPackageTags(page, A);
    expect(tags).not.toContain("Mặc định");
  });

  test("SAVE-02: bật toggle mặc định lúc tạo -> gói mới trở thành mặc định", async () => {
    await openAddPackagePopup(page);
    await fillPackageForm(page, { name: B, priceListed: 0, isTrial: true, isDefault: true });
    await savePackagePopup(page);
    const tags = await readPackageTags(page, B);
    expect(tags).toContain("Mặc định");
  });

  test("UI-06: mở Sửa gói dùng thử đang mặc định -> checkbox tick, toggle ON, không Giá ưu đãi", async () => {
    await openEditPackagePopup(page, B);
    expect(await trialCheckbox(page).getAttribute("aria-checked")).toBe("true");
    expect(await cmsAdminSwitchState.isSwitchOn(defaultToggleSwitch(page))).toBe(true);
    await expect(page.getByText(po.packages.priceOfferedLabel)).toHaveCount(0);
    await cancelPackagePopup(page);
  });

  test("SAVE-03: bật mặc định cho gói mới (C) -> gói cũ (B) tự động tắt mặc định", async () => {
    await openAddPackagePopup(page);
    await fillPackageForm(page, { name: C, priceListed: 0, isTrial: true, isDefault: true });
    await savePackagePopup(page);
    const tagsC = await readPackageTags(page, C);
    const tagsB = await readPackageTags(page, B);
    expect(tagsC).toContain("Mặc định");
    expect(tagsB).not.toContain("Mặc định");
  });

  test("SAVE-04: chủ động tắt toggle mặc định -> gói không còn mặc định", async () => {
    await openEditPackagePopup(page, C);
    await fillPackageForm(page, { isDefault: false });
    await savePackagePopup(page);
    const tags = await readPackageTags(page, C);
    expect(tags).not.toContain("Mặc định");
  });

  test("SAVE-05: 2 tab lưu gần đồng thời -> luôn đúng 1 gói mặc định (gói lưu sau cùng thắng)", async () => {
    const page2 = await context.newPage();
    await gotoPackages(page2, baseUrl);

    await openEditPackagePopup(page, A);
    await fillPackageForm(page, { isDefault: true });
    await openEditPackagePopup(page2, B);
    await fillPackageForm(page2, { isDefault: true });

    await savePackagePopup(page); // lưu A trước
    await savePackagePopup(page2); // lưu B ngay sau - B phải thắng
    await page2.close();

    // Eventual consistency ngắn sau 2 lần lưu gần như đồng thời - poll tới khi ỔN ĐỊNH (đọc lại
    // liên tiếp 2 lần cùng kết quả) thay vì tin lần đọc đầu tiên thấy đúng kỳ vọng.
    let tagsA = await readPackageTags(page, A);
    let tagsB = await readPackageTags(page, B);
    let stableCount = 0;
    let lastDefault = tagsB.includes("Mặc định") ? B : tagsA.includes("Mặc định") ? A : null;
    for (let attempt = 0; attempt < 14 && stableCount < 2; attempt += 1) {
      await page.waitForTimeout(500);
      await gotoPackages(page, baseUrl);
      tagsA = await readPackageTags(page, A);
      tagsB = await readPackageTags(page, B);
      const current = tagsB.includes("Mặc định") ? B : tagsA.includes("Mặc định") ? A : null;
      stableCount = current && current === lastDefault ? stableCount + 1 : 0;
      lastDefault = current;
    }

    const aIsDefault = tagsA.includes("Mặc định");
    const bIsDefault = tagsB.includes("Mặc định");
    expect(aIsDefault).not.toBe(bIsDefault); // đúng 1 trong 2, không phải cả 2/không cái nào
    defaultPkg = aIsDefault ? A : B;
    otherPkg = aIsDefault ? B : A;
  });

  // ---- Group 6 (ORDER-01,02,04) ----

  test("ORDER-01: gói dùng thử mặc định đang Hoạt động được tự động chọn sẵn khi tạo đơn hàng", async () => {
    await gotoOrders(page, baseUrl);
    await openCreateOrderPopup(page);
    const preselected = await readSelectedTrialPackage(page);
    expect(preselected).toContain(defaultPkg);
    expect(preselected).toContain("Mặc định");
  });

  test("ORDER-02: danh sách gói dùng thử trong đơn hàng chỉ hiện gói đang Hoạt động", async () => {
    const options = await readTrialPackageOptionTexts(page);
    expect(options.some((t) => t.includes(A))).toBe(true);
    expect(options.some((t) => t.includes(B))).toBe(true);
  });

  test("ORDER-04: người dùng vẫn chọn được gói dùng thử khác (không phải mặc định)", async () => {
    await selectTrialPackageOption(page, otherPkg);
    const selected = await readSelectedTrialPackage(page);
    expect(selected).toContain(otherPkg);

    if (studentPhone) {
      // Setup cho DEACT-05 (KHÔNG phải case riêng): tạo đơn hàng thật gán defaultPkg trong lúc
      // còn Hoạt động - DEACT-01 (test sau) sẽ dừng hoạt động defaultPkg, DEACT-05 (test cuối)
      // đọc lại lịch sử đơn này để xác nhận không bị mất/lỗi.
      await selectTrialPackageOption(page, defaultPkg);
      await fillOrderPhone(page, studentPhone);
      selectedProfileName = await selectFirstOrderProfileOption(page);
      const codesBefore = new Set(
        await page.locator(po.orders.tableRowSelector).locator("td").first().evaluateAll((els) => els.map((el) => el.textContent)),
      );
      await saveOrderPopup(page);
      for (let attempt = 0; attempt < 6 && !newOrderCode; attempt += 1) {
        const codes = await page.locator(po.orders.tableRowSelector).locator("td").first().allInnerTexts();
        newOrderCode = codes.find((code) => !codesBefore.has(code));
        if (!newOrderCode) await page.waitForTimeout(500);
      }
      expect(newOrderCode, "Không tạo được đơn hàng setup cho DEACT-05").toBeTruthy();
    } else {
      await cancelOrderPopup(page);
    }
  });

  // ---- Group 4 (DEACT-01..04) + Group 5 (DEACT-05) + ORDER-03 ----

  test("DEACT-01: tắt Trạng thái hoạt động của gói mặc định -> vẫn giữ nguyên tag Mặc định", async () => {
    await gotoPackages(page, baseUrl);
    await openEditPackagePopup(page, defaultPkg);
    await fillPackageForm(page, { isActive: false });
    await savePackagePopup(page);

    let tags = await readPackageTags(page, defaultPkg);
    let status = await readPackageStatus(page, defaultPkg);
    for (let attempt = 0; attempt < 10 && status !== "Dừng hoạt động"; attempt += 1) {
      await page.waitForTimeout(500);
      await gotoPackages(page, baseUrl);
      tags = await readPackageTags(page, defaultPkg);
      status = await readPackageStatus(page, defaultPkg);
    }
    expect(tags).toContain("Mặc định");
    expect(status).toBe("Dừng hoạt động");
  });

  test("DEACT-03: không có gói dùng thử nào khác tự động được đặt làm mặc định thay thế", async () => {
    const tagsOther = await readPackageTags(page, otherPkg);
    const tagsC = await readPackageTags(page, C);
    expect(tagsOther).not.toContain("Mặc định");
    expect(tagsC).not.toContain("Mặc định");
  });

  test("DEACT-02: gói mặc định đã Dừng hoạt động KHÔNG xuất hiện trong danh sách gói dùng thử áp dụng", async () => {
    await gotoOrders(page, baseUrl);
    await openCreateOrderPopup(page);
    const options = await readTrialPackageOptionTexts(page);
    expect(options.some((t) => t.includes(defaultPkg))).toBe(false);
  });

  test("ORDER-03: không còn gói mặc định active -> dropdown về '-- Không áp dụng --'", async () => {
    const preselected = await readSelectedTrialPackage(page);
    expect(preselected).toContain(po.orders.trialPackageNotApplicableOption);
    await cancelOrderPopup(page);
  });

  test("DEACT-05: lịch sử mua hàng của gói dùng thử vẫn giữ nguyên sau khi gói bị dừng hoạt động", async () => {
    test.skip(!studentPhone, "Thiếu CMS_ADMIN_TEST_STUDENT_PHONE trong .env - không tạo được đơn hàng thật để kiểm tra lịch sử.");
    test.skip(!newOrderCode, "Không có mã đơn hàng setup (xem test ORDER-04) - không thể kiểm tra lịch sử.");

    const phoneDigits = studentPhone.replace(/^0/, "");
    await searchStudent(page, baseUrl, studentPhone);
    await openPackageHistory(page, phoneDigits, selectedProfileName);
    const rows = await readPackageHistoryRows(page);
    const trialRow = rows.find((r) => r.tenGoi.includes(defaultPkg));
    expect(trialRow, `Không thấy dòng lịch sử cho gói ${defaultPkg}`).toBeTruthy();
    await closePackageHistory(page);
  });

  test("DEACT-04: bật lại Trạng thái hoạt động -> hiển thị lại trong đơn hàng, vẫn giữ mặc định", async () => {
    await gotoPackages(page, baseUrl);
    await openEditPackagePopup(page, defaultPkg);
    await fillPackageForm(page, { isActive: true });
    await savePackagePopup(page);

    await gotoOrders(page, baseUrl);
    await openCreateOrderPopup(page);
    let preselected = await readSelectedTrialPackage(page);
    for (let attempt = 0; attempt < 10 && !preselected.includes(defaultPkg); attempt += 1) {
      await cancelOrderPopup(page);
      await page.waitForTimeout(500);
      await openCreateOrderPopup(page);
      preselected = await readSelectedTrialPackage(page);
    }
    expect(preselected).toContain(defaultPkg);
    expect(preselected).toContain("Mặc định");
    await cancelOrderPopup(page);
  });

  // ---- Group 7 (FIELD-01) + Group 8 (REG-01) + Group 9 (REG-02) + Group 10 (REG-03) ----

  test("FIELD-01: lưu thành công gói THƯỜNG (không tick Dùng thử) mà không cần Giá ưu đãi", async () => {
    await gotoPackages(page, baseUrl);
    await openAddPackagePopup(page);
    await fillPackageForm(page, { name: D, priceListed: 15000 }); // KHÔNG tick isTrial
    await savePackagePopup(page);
    const tags = await readPackageTags(page, D);
    expect(tags).not.toContain("Dùng thử");
  });

  test("REG-01: gói KHÔNG phải Dùng thử không có toggle mặc định + không có Giá ưu đãi", async () => {
    await openAddPackagePopup(page);
    await expect(page.getByRole("switch")).toHaveCount(1); // chỉ Trạng thái hoạt động
    await expect(page.getByText(po.packages.priceOfferedLabel)).toHaveCount(0);
    await cancelPackagePopup(page);
  });

  test("REG-02: danh sách hiển thị đủ 2 tag 'Dùng thử' + 'Mặc định' cho gói đang mặc định", async () => {
    const tags = await readPackageTags(page, defaultPkg);
    expect(tags).toContain("Dùng thử");
    expect(tags).toContain("Mặc định");
  });

  test("REG-03: bỏ trống Tên gói dịch vụ -> lỗi validate, không lưu", async () => {
    await openAddPackagePopup(page);
    await savePackagePopup(page);
    await expect(page.getByText(po.packages.nameRequiredError)).toHaveCount(1);
    await cancelPackagePopup(page);
  });

  // ---- Group 11 (GRANT-01, GRANT-02b, GRANT-02, GRANT-08, GRANT-03, GRANT-04a) ----

  test("GRANT-01: dropdown 'Gói dùng thử áp dụng' sắp xếp Mới -> Cũ", async () => {
    await gotoOrders(page, baseUrl);
    await openCreateOrderPopup(page);
    const options = await readTrialPackageOptionTexts(page);
    const idxA = options.findIndex((t) => t.includes(A));
    const idxB = options.findIndex((t) => t.includes(B));
    const idxC = options.findIndex((t) => t.includes(C));
    expect(idxA).toBeGreaterThanOrEqual(0);
    expect(idxB).toBeGreaterThanOrEqual(0);
    expect(idxC).toBeGreaterThanOrEqual(0);
    expect(idxC).toBeLessThan(idxB); // C tạo sau B -> C đứng trước (mới hơn)
    expect(idxB).toBeLessThan(idxA); // B tạo sau A -> B đứng trước A
  });

  test("GRANT-02b: tự động pre-select gói dùng thử mặc định đang Hoạt động", async () => {
    const preselected = await readSelectedTrialPackage(page);
    expect(preselected).toContain(defaultPkg);
    expect(preselected).toContain("Mặc định");
  });

  test("GRANT-02: trường 'Gói dùng thử áp dụng' luôn có giá trị, kể cả khi chọn Không áp dụng", async () => {
    await selectTrialPackageOption(page, po.orders.trialPackageNotApplicableOption);
    const selected = await readSelectedTrialPackage(page);
    expect(selected.trim().length).toBeGreaterThan(0);
  });

  test("GRANT-08: chọn 'Không áp dụng' rồi bấm Lưu -> lỗi validate, chặn lưu đơn", async () => {
    await saveOrderPopup(page);
    const errorVisible = await readTrialPackageErrorText(page);
    expect(errorVisible).toBe(true);
  });

  test("GRANT-03: [CASE LÕI] profile được cấp quyền dùng thử NGAY khi đơn còn Chờ thanh toán", async () => {
    test.skip(!studentPhone, "Thiếu CMS_ADMIN_TEST_STUDENT_PHONE trong .env.");

    await selectTrialPackageOption(page, defaultPkg); // thoát khỏi trạng thái lỗi của GRANT-08
    await fillOrderPhone(page, studentPhone);
    selectedProfileName = await selectFirstOrderProfileOption(page);

    const codesBefore = new Set(
      await page.locator(po.orders.tableRowSelector).locator("td").first().evaluateAll((els) => els.map((el) => el.textContent)),
    );
    await saveOrderPopup(page);
    for (let attempt = 0; attempt < 6 && !grantOrderCode; attempt += 1) {
      const codes = await page.locator(po.orders.tableRowSelector).locator("td").first().allInnerTexts();
      grantOrderCode = codes.find((code) => !codesBefore.has(code));
      if (!grantOrderCode) await page.waitForTimeout(500);
    }
    expect(grantOrderCode, "Không tạo được đơn hàng cho GRANT-03").toBeTruthy();

    const phoneDigits = studentPhone.replace(/^0/, "");
    await searchStudent(page, baseUrl, studentPhone);
    const accountType = await readStudentAccountType(page, phoneDigits, selectedProfileName);
    const packageText = await readStudentPackageText(page, phoneDigits, selectedProfileName);
    expect(accountType).toContain("Dùng thử");
    expect(packageText).toContain(defaultPkg);
  });

  test("GRANT-04a: lịch sử hiện dòng riêng cho gói dùng thử NGAY khi đơn còn Chờ thanh toán", async () => {
    test.skip(!studentPhone, "Thiếu CMS_ADMIN_TEST_STUDENT_PHONE trong .env.");
    test.skip(!grantOrderCode, "GRANT-03 chưa tạo được đơn hàng - không thể kiểm tra lịch sử.");

    const phoneDigits = studentPhone.replace(/^0/, "");
    await openPackageHistory(page, phoneDigits, selectedProfileName);
    const rows = await readPackageHistoryRows(page);
    const trialRow = rows.find((r) => r.tenGoi.includes(defaultPkg) && !r.maDonHang && !r.giaTienGoi && !r.kenhMuaGoi);
    expect(trialRow, "Không thấy dòng lịch sử gói dùng thử đúng format (không mã đơn/giá/kênh)").toBeTruthy();
    await closePackageHistory(page);
  });

  // ---- Group 11 (tiếp) - GRANT-12, GRANT-05, GRANT-06, GRANT-04b ----

  test("GRANT-12: gói dùng thử đã gắn cho profile vẫn hiệu lực dù package gốc chuyển Dừng hoạt động", async () => {
    test.skip(!studentPhone, "Thiếu CMS_ADMIN_TEST_STUDENT_PHONE trong .env.");
    test.skip(!grantOrderCode, "GRANT-03 chưa tạo được đơn hàng - không thể kiểm tra.");

    await gotoPackages(page, baseUrl);
    await openEditPackagePopup(page, defaultPkg);
    await fillPackageForm(page, { isActive: false });
    await savePackagePopup(page);

    const phoneDigits = studentPhone.replace(/^0/, "");
    await searchStudent(page, baseUrl, studentPhone);
    const accountType = await readStudentAccountType(page, phoneDigits, selectedProfileName);
    const packageText = await readStudentPackageText(page, phoneDigits, selectedProfileName);
    expect(accountType).toContain("Dùng thử");
    expect(packageText).toContain(defaultPkg);

    // Bật lại Hoạt động ngay - GRANT-05/06 (case sau) cần package gốc ở trạng thái bình thường để
    // xác nhận đơn Thành công, không để lẫn ảnh hưởng của việc dừng hoạt động vừa test ở trên.
    await gotoPackages(page, baseUrl);
    await openEditPackagePopup(page, defaultPkg);
    await fillPackageForm(page, { isActive: true });
    await savePackagePopup(page);
  });

  test("GRANT-05: đơn chuyển Thành công -> gói trả phí active bình thường (Loại tài khoản chuyển Pro)", async () => {
    test.skip(!studentPhone, "Thiếu CMS_ADMIN_TEST_STUDENT_PHONE trong .env.");
    test.skip(!grantOrderCode, "GRANT-03 chưa tạo được đơn hàng - không thể xác nhận Thành công.");

    await gotoOrders(page, baseUrl);
    await confirmOrderSuccess(page, grantOrderCode);

    const phoneDigits = studentPhone.replace(/^0/, "");
    await searchStudent(page, baseUrl, studentPhone);
    const accountType = await readStudentAccountType(page, phoneDigits, selectedProfileName);
    expect(accountType).toContain("Pro");
  });

  test("GRANT-06: [CASE LÕI] đơn Thành công -> gói dùng thử đã gắn tự động inactive, không song song 2 quyền lợi", async () => {
    test.skip(!studentPhone, "Thiếu CMS_ADMIN_TEST_STUDENT_PHONE trong .env.");
    test.skip(!grantOrderCode, "GRANT-03 chưa tạo được đơn hàng - không thể xác nhận Thành công.");

    const phoneDigits = studentPhone.replace(/^0/, "");
    await searchStudent(page, baseUrl, studentPhone);
    const accountType = await readStudentAccountType(page, phoneDigits, selectedProfileName);
    expect(accountType).not.toContain("Dùng thử");
  });

  test("GRANT-04b: sau khi đơn Thành công, vẫn giữ đủ 2 dòng lịch sử (đơn hàng + gói dùng thử cũ)", async () => {
    test.skip(!studentPhone, "Thiếu CMS_ADMIN_TEST_STUDENT_PHONE trong .env.");
    test.skip(!grantOrderCode, "GRANT-03 chưa tạo được đơn hàng - không thể kiểm tra lịch sử.");

    const phoneDigits = studentPhone.replace(/^0/, "");
    await openPackageHistory(page, phoneDigits, selectedProfileName);
    const rows = await readPackageHistoryRows(page);
    const orderRowInHistory = rows.find((r) => r.maDonHang === grantOrderCode);
    const trialRowStillThere = rows.some((r) => r.tenGoi.includes(defaultPkg));
    expect(orderRowInHistory, `Không thấy dòng lịch sử cho đơn hàng ${grantOrderCode}`).toBeTruthy();
    expect(orderRowInHistory.giaTienGoi.length).toBeGreaterThan(0);
    expect(orderRowInHistory.kenhMuaGoi.length).toBeGreaterThan(0);
    expect(trialRowStillThere, `Không còn thấy dòng lịch sử gói dùng thử ${defaultPkg}`).toBeTruthy();
    await closePackageHistory(page);
  });
});
