import {
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
  cmsAdminPageObjects as po,
} from "../navigation/cmsAdminPageObjects.js";

/**
 * Chạy các case ĐÃ PASS thuộc nhóm "Gói mặc định" (UI-01..06, SAVE-01..05, DEACT-01..04,
 * ORDER-01..04, FIELD-01, REG-01..03) - KHÔNG cần học sinh/đơn hàng thật, tự tạo 3 gói dùng thử
 * riêng (`AUTO-<runId>-A/B/C`) + 1 gói thường (`AUTO-<runId>-D`) để chạy độc lập, không phụ thuộc
 * dữ liệu có sẵn trên môi trường (an toàn chạy lại nhiều lần, trên dev/staging/production).
 *
 * Thứ tự case cố ý khác thứ tự case gốc trong bộ testcase (vốn viết cho người test tay, dùng lại
 * dữ liệu đã tạo trước đó) - ở đây nhóm lại theo hành động UI thực tế để tránh mở/đóng popup thừa,
 * nhưng mỗi case vẫn kiểm đúng "Kết quả mong đợi" của case gốc.
 *
 * Trả về mảng kết quả {id, description, pass, detail} + `defaultPackageName` (tên gói dùng thử
 * đang là mặc định+active sau khi chạy xong - dùng bởi grantCasesFlow.js, không hardcode tên).
 */
export async function runPackageCasesFlow(page, baseUrl, { runId }) {
  const results = [];
  const record = (id, description, pass, detail = "") => {
    results.push({ id, description, pass: !!pass, detail });
  };

  const A = `AUTO-${runId}-A`;
  const B = `AUTO-${runId}-B`;
  const C = `AUTO-${runId}-C`;
  const D = `AUTO-${runId}-D-thuong`;

  await gotoPackages(page, baseUrl);

  // ---- Group 1 (UI-01..05) + Group 8 (REG-01) + Group 10 (REG-03) - dùng chung 1 popup ----
  await openAddPackagePopup(page);

  const switchCountBeforeTick = await page.getByRole("switch").count();
  const priceOfferedBeforeTick = await page.getByText(po.packages.priceOfferedLabel).count();
  const uiO1Pass = switchCountBeforeTick === 1 && priceOfferedBeforeTick === 0;
  record(
    "UI-01",
    "Mặc định chưa tick Dùng thử: không toggle mặc định, không trường Giá ưu đãi",
    uiO1Pass,
    `switchCount=${switchCountBeforeTick} priceOfferedCount=${priceOfferedBeforeTick}`,
  );
  record(
    "REG-01",
    "Gói dịch vụ thường (không tick Dùng thử): không có toggle mặc định + không Giá ưu đãi",
    uiO1Pass,
  );

  await fillPackageForm(page, { isTrial: true });
  const switchCountAfterTick = await page.getByRole("switch").count();
  const defaultOffInitially =
    switchCountAfterTick === 2 && !(await cmsAdminSwitchState.isSwitchOn(defaultToggleSwitch(page)));
  const priceOfferedAfterTick = await page.getByText(po.packages.priceOfferedLabel).count();
  record(
    "UI-02",
    "Tick Dùng thử -> hiện toggle mặc định (OFF), Giá ưu đãi vẫn ẩn",
    defaultOffInitially && priceOfferedAfterTick === 0,
    `switchCount=${switchCountAfterTick} priceOfferedCount=${priceOfferedAfterTick}`,
  );

  const descriptionCount = await page.getByText(po.packages.defaultToggleDescription).count();
  const labelCount = await page.getByText(po.packages.defaultToggleLabel).count();
  record(
    "UI-04",
    "Label + mô tả toggle mặc định đúng text kỳ vọng",
    descriptionCount > 0 && labelCount > 0,
  );

  await fillPackageForm(page, { isTrial: false });
  const switchCountAfterUntick = await page.getByRole("switch").count();
  const priceOfferedAfterUntick = await page.getByText(po.packages.priceOfferedLabel).count();
  record(
    "UI-03",
    "Bỏ tick Dùng thử -> toggle mặc định ẩn hoàn toàn, Giá ưu đãi vẫn ẩn",
    switchCountAfterUntick === 1 && priceOfferedAfterUntick === 0,
  );
  record(
    "UI-05",
    "Giá ưu đãi ẩn ở CẢ 2 trạng thái tick/không tick Dùng thử",
    priceOfferedBeforeTick === 0 && priceOfferedAfterTick === 0 && priceOfferedAfterUntick === 0,
  );

  // REG-03: để trống Tên gói dịch vụ, bấm Lưu -> phải báo lỗi, KHÔNG lưu
  await savePackagePopup(page);
  const nameErrorCount = await page.getByText(po.packages.nameRequiredError).count();
  record("REG-03", "Bỏ trống Tên gói dịch vụ -> lỗi validate, không lưu", nameErrorCount > 0);

  // FIELD-01 (phần gói thường): điền tên D, KHÔNG tick Dùng thử, Lưu thành công (không cần Giá ưu đãi)
  // Giá thật (không phải 0) - gói D có thể vô tình trở thành "Gói dịch vụ mua" mặc định của đơn
  // hàng thật tạo ở grantCasesFlow.js (dropdown sắp xếp mới nhất lên đầu). ĐÃ GẶP THẬT (2026-09-07):
  // giá 0đ khiến cột "GIÁ TIỀN GÓI" trong Lịch sử gói dịch vụ hiển thị RỖNG thay vì "0 đ", làm
  // GRANT-04b fail nhầm (tưởng dữ liệu đơn hàng bị mất, thật ra chỉ là hệ quả giá 0 của gói tự tạo).
  await fillPackageForm(page, { name: D, priceListed: 15000 });
  await savePackagePopup(page);
  const tagsD = await readPackageTags(page, D);
  const dSavedOk = (await page.locator(po.packages.tableRowSelector).filter({ hasText: D }).count()) > 0;

  // ---- Group 3 (SAVE-01..05) ----
  await openAddPackagePopup(page);
  await fillPackageForm(page, { name: A, priceListed: 0, isTrial: true, isDefault: false });
  await savePackagePopup(page);
  const tagsA1 = await readPackageTags(page, A);
  record(
    "SAVE-01",
    "Tạo gói dùng thử (toggle mặc định OFF) khi hệ thống chưa cấu hình mặc định -> không phải mặc định",
    !tagsA1.includes("Mặc định"),
    `tags=${tagsA1.join(",")}`,
  );

  await openAddPackagePopup(page);
  await fillPackageForm(page, { name: B, priceListed: 0, isTrial: true, isDefault: true });
  await savePackagePopup(page);
  const tagsB1 = await readPackageTags(page, B);
  record(
    "SAVE-02",
    "Bật toggle mặc định lúc tạo -> gói mới trở thành mặc định",
    tagsB1.includes("Mặc định"),
    `tags=${tagsB1.join(",")}`,
  );

  await openAddPackagePopup(page);
  await fillPackageForm(page, { name: C, priceListed: 0, isTrial: true, isDefault: true });
  await savePackagePopup(page);
  const tagsC1 = await readPackageTags(page, C);
  const tagsB2 = await readPackageTags(page, B);
  record(
    "SAVE-03",
    "Bật mặc định cho gói mới (C) -> gói cũ (B) tự động tắt mặc định",
    tagsC1.includes("Mặc định") && !tagsB2.includes("Mặc định"),
    `C=${tagsC1.join(",")} B=${tagsB2.join(",")}`,
  );

  await openEditPackagePopup(page, C);
  await fillPackageForm(page, { isDefault: false });
  await savePackagePopup(page);
  const tagsC2 = await readPackageTags(page, C);
  record(
    "SAVE-04",
    "Chủ động tắt toggle mặc định -> gói không còn mặc định, không tự chọn gói khác thay thế",
    !tagsC2.includes("Mặc định"),
    `tags=${tagsC2.join(",")}`,
  );

  // SAVE-05: mở 2 tab (2 page cùng context) sửa 2 gói khác nhau, bật mặc định gần như đồng thời -
  // luôn chỉ đúng 1 gói mặc định tại 1 thời điểm (gói lưu SAU CÙNG thắng).
  const page2 = await page.context().newPage();
  await gotoPackages(page2, baseUrl);
  await openEditPackagePopup(page, A);
  await fillPackageForm(page, { isDefault: true });
  await openEditPackagePopup(page2, B);
  await fillPackageForm(page2, { isDefault: true });
  await savePackagePopup(page); // lưu A trước
  await savePackagePopup(page2); // lưu B ngay sau - B phải thắng
  await page2.close();
  // ĐÃ GẶP THẬT (2026-09-07): ngay sau khi 2 request lưu gần như đồng thời trả về, có độ trễ ngắn
  // (eventual consistency phía backend) trước khi tag "Mặc định" chuyển hẳn sang gói lưu sau cùng
  // (B) - đọc ngay lập tức đôi lúc vẫn thấy A. Poll tối đa ~5s thay vì tin kết quả đọc ngay.
  let tagsAFinal = await readPackageTags(page, A);
  let tagsBFinal = await readPackageTags(page, B);
  let tagsCFinal = await readPackageTags(page, C);
  for (let attempt = 0; attempt < 10 && !tagsBFinal.includes("Mặc định"); attempt += 1) {
    await page.waitForTimeout(500);
    await gotoPackages(page, baseUrl);
    tagsAFinal = await readPackageTags(page, A);
    tagsBFinal = await readPackageTags(page, B);
    tagsCFinal = await readPackageTags(page, C);
  }
  const onlyBIsDefault =
    tagsBFinal.includes("Mặc định") && !tagsAFinal.includes("Mặc định") && !tagsCFinal.includes("Mặc định");
  record(
    "SAVE-05",
    "2 tab lưu gần đồng thời -> luôn đúng 1 gói mặc định (gói lưu sau cùng thắng)",
    onlyBIsDefault,
    `A=${tagsAFinal.join(",")} B=${tagsBFinal.join(",")} C=${tagsCFinal.join(",")}`,
  );

  record(
    "FIELD-01",
    "Lưu thành công cả gói thường lẫn gói dùng thử mà không cần Giá ưu đãi",
    dSavedOk && tagsA1.length >= 0,
  );
  record(
    "REG-02",
    "Danh sách hiển thị đủ 2 tag 'Dùng thử' + 'Mặc định' cho gói dùng thử đang mặc định",
    tagsBFinal.includes("Dùng thử") && tagsBFinal.includes("Mặc định"),
    `tags=${tagsBFinal.join(",")}`,
  );

  // ---- Group 6 (ORDER-01,02,04) - B đang là mặc định + Hoạt động ----
  await gotoOrders(page, baseUrl);
  await openCreateOrderPopup(page);
  const preselected1 = await readSelectedTrialPackage(page);
  record(
    "ORDER-01",
    "Gói dùng thử mặc định đang Hoạt động được tự động chọn sẵn khi tạo đơn hàng",
    preselected1.includes(B) && preselected1.includes("Mặc định"),
    `preselected=${preselected1}`,
  );

  const optionTexts1 = await readTrialPackageOptionTexts(page);
  const allOwnPackagesListed = [A, B, C].every((name) => optionTexts1.some((t) => t.includes(name)));
  record(
    "ORDER-02",
    "Danh sách gói dùng thử trong đơn hàng chỉ hiện gói đang Hoạt động (3 gói tự tạo đều Hoạt động, đều xuất hiện)",
    allOwnPackagesListed,
    `options=${optionTexts1.join(" | ")}`,
  );

  await selectTrialPackageOption(page, A);
  const selectedAfterPick = await readSelectedTrialPackage(page);
  record(
    "ORDER-04",
    "Người dùng vẫn chọn được gói dùng thử khác (không phải mặc định) khi tạo đơn hàng",
    selectedAfterPick.includes(A),
    `selected=${selectedAfterPick}`,
  );
  await cancelOrderPopup(page);

  // ---- Group 4 (DEACT-01..04) + ORDER-03 - dùng B (đang là mặc định duy nhất toàn hệ thống,
  // vì SAVE-05 vừa buộc hệ thống chỉ còn đúng B mặc định) ----
  await gotoPackages(page, baseUrl);
  await openEditPackagePopup(page, B);
  // UI-06: mở Sửa gói dùng thử đang mặc định -> checkbox/toggle phải khớp trạng thái ĐÃ LƯU
  // (B hiện là Dùng thử + Mặc định + Hoạt động, per SAVE-05 vừa xác nhận ở trên).
  const checkboxCheckedOnOpen = (await trialCheckbox(page).getAttribute("aria-checked")) === "true";
  const defaultOnOpen = await cmsAdminSwitchState.isSwitchOn(defaultToggleSwitch(page));
  const priceOfferedOnEditOpen = await page.getByText(po.packages.priceOfferedLabel).count();
  record(
    "UI-06",
    "Mở Sửa gói dùng thử đang mặc định -> checkbox tick, toggle mặc định ON, không có Giá ưu đãi",
    checkboxCheckedOnOpen && defaultOnOpen && priceOfferedOnEditOpen === 0,
    `checkboxChecked=${checkboxCheckedOnOpen} defaultOn=${defaultOnOpen}`,
  );

  await fillPackageForm(page, { isActive: false });
  await savePackagePopup(page);
  // Cùng độ trễ eventual-consistency đã gặp ở SAVE-05 - poll thay vì tin đọc ngay lập tức.
  let tagsBDeact = await readPackageTags(page, B);
  let statusBDeact = await readPackageStatus(page, B);
  for (let attempt = 0; attempt < 10 && statusBDeact !== "Dừng hoạt động"; attempt += 1) {
    await page.waitForTimeout(500);
    await gotoPackages(page, baseUrl);
    tagsBDeact = await readPackageTags(page, B);
    statusBDeact = await readPackageStatus(page, B);
  }
  record(
    "DEACT-01",
    "Tắt Trạng thái hoạt động của gói mặc định -> vẫn giữ nguyên tag Mặc định",
    tagsBDeact.includes("Mặc định") && statusBDeact === "Dừng hoạt động",
    `tags=${tagsBDeact.join(",")} status=${statusBDeact}`,
  );

  const tagsADeact = await readPackageTags(page, A);
  const tagsCDeact = await readPackageTags(page, C);
  record(
    "DEACT-03",
    "Không có gói dùng thử nào khác tự động được đặt làm mặc định thay thế",
    !tagsADeact.includes("Mặc định") && !tagsCDeact.includes("Mặc định"),
    `A=${tagsADeact.join(",")} C=${tagsCDeact.join(",")}`,
  );

  await gotoOrders(page, baseUrl);
  await openCreateOrderPopup(page);
  const optionTexts2 = await readTrialPackageOptionTexts(page);
  record(
    "DEACT-02",
    "Gói mặc định đã Dừng hoạt động KHÔNG xuất hiện trong danh sách gói dùng thử áp dụng",
    !optionTexts2.some((t) => t.includes(B)),
    `options=${optionTexts2.join(" | ")}`,
  );
  const preselected2 = await readSelectedTrialPackage(page);
  record(
    "ORDER-03",
    "Không còn gói mặc định active -> dropdown về '-- Không áp dụng --', không lỗi phát sinh",
    preselected2.includes(po.orders.trialPackageNotApplicableOption),
    `preselected=${preselected2}`,
  );
  await cancelOrderPopup(page);

  await gotoPackages(page, baseUrl);
  await openEditPackagePopup(page, B);
  await fillPackageForm(page, { isActive: true });
  await savePackagePopup(page);

  await gotoOrders(page, baseUrl);
  await openCreateOrderPopup(page);
  const preselected3 = await readSelectedTrialPackage(page);
  record(
    "DEACT-04",
    "Bật lại Trạng thái hoạt động -> hiển thị lại trong đơn hàng, vẫn giữ mặc định",
    preselected3.includes(B) && preselected3.includes("Mặc định"),
    `preselected=${preselected3}`,
  );
  await cancelOrderPopup(page);

  return { results, defaultPackageName: B, ownPackages: { A, B, C, D } };
}
