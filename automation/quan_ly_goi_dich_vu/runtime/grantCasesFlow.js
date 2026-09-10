import {
  gotoOrders,
  openCreateOrderPopup,
  cancelOrderPopup,
  saveOrderPopup,
  fillOrderPhone,
  selectFirstOrderProfileOption,
  selectOrderProfileByName,
  selectTrialPackageOption,
  readTrialPackageOptionTexts,
  readSelectedTrialPackage,
  readTrialPackageErrorText,
  confirmOrderSuccess,
  gotoPackages,
  openEditPackagePopup,
  fillPackageForm,
  savePackagePopup,
  searchStudent,
  readStudentAccountType,
  readStudentPackageText,
  openPackageHistory,
  readPackageHistoryRows,
  closePackageHistory,
  cmsAdminPageObjects as po,
} from "../navigation/cmsAdminPageObjects.js";

const SKIP_IDS_NO_STUDENT = [
  "GRANT-01",
  "GRANT-02",
  "GRANT-02b",
  "GRANT-03",
  "GRANT-04a",
  "GRANT-04b",
  "GRANT-05",
  "GRANT-06",
  "GRANT-08",
  "GRANT-12",
  "DEACT-05",
];

/**
 * Chạy các case ĐÃ PASS thuộc nhóm "Gán gói dùng thử khi tạo đơn thủ công" (GRANT-*) + DEACT-05 -
 * CẦN 1 học sinh CÓ THẬT trên môi trường đang chạy (order chỉ gán được cho profile đã tồn tại,
 * KHÔNG tự tạo học sinh mới qua form). Số điện thoại lấy từ `CMS_ADMIN_TEST_STUDENT_PHONE` trong
 * .env - PHẢI là 1 profile CÓ THẬT trên đúng môi trường đang test (dev/staging/production có dữ
 * liệu học sinh khác nhau, không dùng chung được).
 *
 * Nếu thiếu `studentPhone`, toàn bộ case nhóm này bị SKIP (không giả định Pass/Fail) - report cuối
 * sẽ liệt kê rõ để người chạy biết cần điền `CMS_ADMIN_TEST_STUDENT_PHONE` cho môi trường đó.
 *
 * GRANT-07 (đơn tự Hủy sau 24h) KHÔNG automate được trong 1 lần chạy ngắn - luôn SKIP kèm lý do,
 * không fabricate kết quả (đúng tinh thần "không đoán khi chưa có bằng chứng thật").
 * GRANT-09 (Blocked - không đạt được điều kiện tiên quyết) và GRANT-10/11 (Exploratory - chưa có
 * rule chính thức) không thuộc phạm vi "case đã Pass" nên KHÔNG đưa vào flow này.
 */
export async function runGrantCasesFlow(page, baseUrl, { defaultPackageName, ownPackages, studentPhone, profileName }) {
  const results = [];
  const record = (id, description, pass, detail = "") => {
    results.push({ id, description, pass, detail });
  };
  const skip = (id, reason) => record(id, reason, null, "SKIPPED");

  record(
    "GRANT-07",
    "Đơn tự động Hủy sau 24h -> gói dùng thử KHÔNG bị thu hồi",
    null,
    "SKIPPED - không automate được việc chờ 24h trong 1 lần chạy ngắn. Xem evidence thủ công đã có (2026-09-04).",
  );

  if (!studentPhone) {
    SKIP_IDS_NO_STUDENT.forEach((id) =>
      skip(
        id,
        "SKIPPED - thiếu CMS_ADMIN_TEST_STUDENT_PHONE trong .env (cần số điện thoại 1 học sinh CÓ THẬT trên môi trường đang test).",
      ),
    );
    return { results };
  }

  const { A, B, C } = ownPackages;
  const phoneDigits = studentPhone.replace(/^0/, "");

  // ---- GRANT-01: dropdown sắp xếp Mới -> Cũ (C tạo sau B, B tạo sau A -> C phải đứng trước) ----
  // Buffer ngắn trước khi mở popup đầu tiên của flow này - packageCasesFlow.js vừa đóng 1 popup
  // Tạo đơn hàng khác (DEACT-04) ngay trước đó, tránh mở lại quá nhanh trong lúc animation đóng
  // popup cũ còn chưa xong (ĐÃ GẶP THẬT: gây đọc nhầm state ở bước ngay sau).
  await page.waitForTimeout(500);
  await gotoOrders(page, baseUrl);
  await openCreateOrderPopup(page);
  const optionTexts = await readTrialPackageOptionTexts(page);
  const idxA = optionTexts.findIndex((t) => t.includes(A));
  const idxB = optionTexts.findIndex((t) => t.includes(B));
  const idxC = optionTexts.findIndex((t) => t.includes(C));
  record(
    "GRANT-01",
    "Dropdown 'Gói dùng thử áp dụng' sắp xếp Mới -> Cũ",
    idxC >= 0 && idxB >= 0 && idxA >= 0 && idxC < idxB && idxB < idxA,
    `options=${optionTexts.join(" | ")}`,
  );

  // ---- GRANT-02b: pre-select đúng gói mặc định đang Hoạt động ----
  const preselected = await readSelectedTrialPackage(page);
  record(
    "GRANT-02b",
    "Tự động pre-select gói dùng thử mặc định đang Hoạt động",
    preselected.includes(defaultPackageName) && preselected.includes("Mặc định"),
    `preselected=${preselected}`,
  );

  // Điền phone/profile TRƯỚC khi đổi field "Gói dùng thử áp dụng" - Naive UI validate eager theo
  // blur, đổi thứ tự ngược lại khiến dòng lỗi hiện SAU field trial-select và che mất dropdown
  // profile phía dưới (ĐÃ GẶP THẬT 2026-09-07: Playwright báo "element intercepts pointer events").
  await fillOrderPhone(page, studentPhone);
  let selectedProfileName;
  if (profileName) {
    // Số điện thoại có thể có nhiều profile con - chọn ĐÍCH DANH profile được chỉ định thay vì
    // profile đầu tiên trong dropdown (an toàn hơn khi test trên môi trường có dữ liệu thật).
    selectedProfileName = await selectOrderProfileByName(page, profileName);
  } else {
    selectedProfileName = await selectFirstOrderProfileOption(page);
  }

  // ---- GRANT-02 + GRANT-08: chọn "Không áp dụng" -> field vẫn có giá trị (không rỗng), Lưu bị chặn ----
  await selectTrialPackageOption(page, po.orders.trialPackageNotApplicableOption);
  const selectedNotApplicable = await readSelectedTrialPackage(page);
  record(
    "GRANT-02",
    "Trường 'Gói dùng thử áp dụng' luôn có giá trị (không rỗng/null) kể cả khi chọn Không áp dụng",
    selectedNotApplicable.trim().length > 0,
    `selected=${selectedNotApplicable}`,
  );

  await saveOrderPopup(page);
  const trialErrorVisible = await readTrialPackageErrorText(page);
  record(
    "GRANT-08",
    "Chọn 'Không áp dụng' rồi bấm Lưu -> lỗi validate, chặn lưu đơn",
    trialErrorVisible,
  );

  // ---- GRANT-03/04a: tạo đơn thật gán gói dùng thử, để Chờ thanh toán (KHÔNG xác nhận thanh toán) ----
  // Xác định mã đơn MỚI bằng cách đối chiếu tập mã đơn TRƯỚC/SAU khi lưu (KHÔNG tin vị trí "dòng
  // đầu bảng" - ĐÃ GẶP THẬT 2026-09-07: 1 lần chạy full suite, dòng đầu bảng vẫn là đơn CŨ ngay
  // sau khi lưu do popup đóng/mở quá nhanh giữa 2 bước liên tiếp, đọc nhầm đơn của lần chạy trước).
  const orderCodesBefore = new Set(
    await page.locator(po.orders.tableRowSelector).locator("td").first().evaluateAll((els) => els.map((el) => el.textContent)),
  );
  await selectTrialPackageOption(page, defaultPackageName);
  await saveOrderPopup(page);
  let newOrderCode;
  for (let attempt = 0; attempt < 6 && !newOrderCode; attempt += 1) {
    const currentCodes = await page.locator(po.orders.tableRowSelector).locator("td").first().allInnerTexts();
    newOrderCode = currentCodes.find((code) => !orderCodesBefore.has(code));
    if (!newOrderCode) await page.waitForTimeout(500);
  }
  if (!newOrderCode) {
    const validationErrors = await page.locator(".n-form-item-feedback__line").allInnerTexts().catch(() => []);
    throw new Error(
      "GRANT-03: không tạo được đơn hàng mới (không có mã đơn nào khác tập mã đơn trước khi lưu). " +
        `Lỗi validate còn hiện trên popup: ${JSON.stringify(validationErrors)}.`,
    );
  }

  await searchStudent(page, baseUrl, studentPhone);
  const accountTypeWhilePending = await readStudentAccountType(page, phoneDigits, selectedProfileName);
  const packageTextWhilePending = await readStudentPackageText(page, phoneDigits, selectedProfileName);
  record(
    "GRANT-03",
    "[CASE LÕI] Profile được cấp quyền dùng thử NGAY khi đơn còn Chờ thanh toán",
    accountTypeWhilePending.includes("Dùng thử") && packageTextWhilePending.includes(defaultPackageName),
    `accountType=${accountTypeWhilePending} package=${packageTextWhilePending}`,
  );

  await openPackageHistory(page, phoneDigits, selectedProfileName);
  const historyWhilePending = await readPackageHistoryRows(page);
  const trialRowWhilePending = historyWhilePending.find((r) => r.tenGoi.includes(defaultPackageName));
  record(
    "GRANT-04a",
    "Lịch sử hiện dòng riêng cho gói dùng thử NGAY khi đơn còn Chờ thanh toán, đúng format (không mã đơn/giá/kênh)",
    !!trialRowWhilePending &&
      !trialRowWhilePending.maDonHang &&
      !trialRowWhilePending.giaTienGoi &&
      !trialRowWhilePending.kenhMuaGoi,
    `row=${JSON.stringify(trialRowWhilePending)}`,
  );
  await closePackageHistory(page);

  // ---- GRANT-12: dừng hoạt động package gốc trong lúc trial đang active -> KHÔNG bị thu hồi ----
  await gotoPackages(page, baseUrl);
  await openEditPackagePopup(page, defaultPackageName);
  await fillPackageForm(page, { isActive: false });
  await savePackagePopup(page);

  await searchStudent(page, baseUrl, studentPhone);
  const accountTypeAfterDeactivate = await readStudentAccountType(page, phoneDigits, selectedProfileName);
  const packageTextAfterDeactivate = await readStudentPackageText(page, phoneDigits, selectedProfileName);
  record(
    "GRANT-12",
    "Gói dùng thử đã gắn cho profile vẫn hiệu lực dù package gốc chuyển Dừng hoạt động",
    accountTypeAfterDeactivate.includes("Dùng thử") && packageTextAfterDeactivate.includes(defaultPackageName),
    `accountType=${accountTypeAfterDeactivate} package=${packageTextAfterDeactivate}`,
  );

  await gotoPackages(page, baseUrl);
  await openEditPackagePopup(page, defaultPackageName);
  await fillPackageForm(page, { isActive: true });
  await savePackagePopup(page);

  // ---- GRANT-05/06: xác nhận đơn Thành công -> gói trả phí active, gói dùng thử tự inactive ----
  await gotoOrders(page, baseUrl);
  await confirmOrderSuccess(page, newOrderCode);

  await searchStudent(page, baseUrl, studentPhone);
  const accountTypeAfterSuccess = await readStudentAccountType(page, phoneDigits, selectedProfileName);
  record(
    "GRANT-05",
    "Đơn chuyển Thành công -> gói trả phí active bình thường (Loại tài khoản chuyển Pro)",
    accountTypeAfterSuccess.includes("Pro"),
    `accountType=${accountTypeAfterSuccess}`,
  );
  record(
    "GRANT-06",
    "[CASE LÕI] Đơn Thành công -> gói dùng thử đã gắn tự động inactive (không còn Dùng thử)",
    !accountTypeAfterSuccess.includes("Dùng thử"),
    `accountType=${accountTypeAfterSuccess}`,
  );

  // ---- GRANT-04b + DEACT-05: lịch sử vẫn đủ cả 2 dòng, dữ liệu đơn hàng không bị mất/lỗi ----
  await openPackageHistory(page, phoneDigits, selectedProfileName);
  const historyAfterSuccess = await readPackageHistoryRows(page);
  const orderRowInHistory = historyAfterSuccess.find((r) => r.maDonHang === newOrderCode);
  const trialRowStillThere = historyAfterSuccess.some((r) => r.tenGoi.includes(defaultPackageName));
  record(
    "GRANT-04b",
    "Sau khi Thành công, vẫn giữ đủ dòng đơn hàng (nay có giá/kênh) và dòng gói dùng thử đã gắn trước đó",
    !!orderRowInHistory &&
      orderRowInHistory.giaTienGoi.length > 0 &&
      orderRowInHistory.kenhMuaGoi.length > 0 &&
      trialRowStillThere,
    `orderRow=${JSON.stringify(orderRowInHistory)}`,
  );
  record(
    "DEACT-05",
    "Lịch sử mua hàng của gói dùng thử vẫn giữ nguyên, không lỗi hiển thị, sau khi package gốc từng bị dừng hoạt động",
    trialRowStillThere,
  );
  await closePackageHistory(page);

  return { results };
}
