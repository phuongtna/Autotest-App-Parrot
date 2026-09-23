import { teacherPortalPageObjects as loginPo } from "../../giao_bai_tap/navigation/teacherPortalPageObjects.js";

/**
 * Page Objects cho tính năng "Thêm bài thực hành" trong Lesson - màn "Kho đề cá nhân"
 * (`/teacher/quiz`, Web GV, domain dev `https://parrotedu.codeinet.com`).
 *
 * NGUỒN text/selector: ĐÃ XÁC NHẬN THẬT bằng debug live (javascript_tool trên browser thật,
 * 2026-09-23, tài khoản GV dev `0915315315`, Khối 11 > UNIT 1: LEISURE TIME > READING) - xem
 * `Ke_hoach_Automation_Them_Bai_Thuc_Hanh.docx` mục 2.2/3.3/5 cho ngữ cảnh gốc. Toàn bộ cụm text
 * dưới đây copy NGUYÊN VĂN từ DOM thật, không suy đoán từ tài liệu yêu cầu gốc.
 *
 * LƯU Ý CHÍNH TẢ ĐÃ XÁC NHẬN THẬT (dễ gây lỗi selector nếu không để ý): nút hủy ở popup "Thêm bài
 * thực hành" viết là "Hủy" (ủ), nhưng nút hủy ở trang "Chỉnh sửa đề bài" viết là "Huỷ" (uỷ) - 2
 * spelling khác nhau cho cùng 1 khái niệm, dùng ĐÚNG chuỗi theo từng context bên dưới.
 */
export const themBaiThucHanhPageObjects = {
  khoDeCaNhan: {
    path: "/teacher/quiz",
    totalCountPattern: /^Tổng số: \d+ khối$/,
  },

  // Section "Thêm nội dung của bài học" xuất hiện NGAY DƯỚI danh sách item hiện có của 1 Lesson
  // ĐÃ MỞ (accordion) - nút "Bài thực hành" là 1 <button> thuần (không phải link), nằm trong
  // section này. Accordion CỘNG DỒN (mở Lesson sau không đóng Lesson trước) - đã xác nhận thật
  // giống ghi chú trong kho-de-ca-nhan-management.spec.js.
  lessonSection: {
    addContentHeading: "Thêm nội dung của bài học",
    addPracticeButton: "Bài thực hành",
    itemTitlePrefix: "Bài thực hành: ",
    previewIconTitle: "Xem chi tiết",
    deleteIconTitle: "Xóa",
  },

  addPopup: {
    // ĐÃ XÁC NHẬN THẬT: popup CHỈ có 1 field "Tên bài *" (KHÔNG có dropdown "Kỹ năng" như mô tả
    // yêu cầu gốc - xem docx mục 2.2).
    heading: "Thêm bài thực hành",
    tenBaiLabel: "Tên bài",
    tenBaiInputPlaceholder: "Nhập tên bài thực hành",
    createButton: "Tạo & soạn câu hỏi",
    cancelButton: "Hủy",
    closeButtonAccessibleName: "Close",
  },

  quizEditPage: {
    // Breadcrumb thật: "Đề bài / Chỉnh sửa đề bài" (2 mảnh, mảnh 2 lặp lại làm tiêu đề trang).
    breadcrumbLastCrumb: "Chỉnh sửa đề bài",
    emptyStateTitle: "Nhấn để thêm câu hỏi đầu tiên",
    emptyStateSubtitle: "Hoặc chọn loại câu hỏi từ sidebar bên phải",
    infoPanelHeading: "Thông tin đề",
    tenDeLabel: "Tên đề",
    tenDeInputPlaceholder: "Nhập tên đề...",
    kyNangLabel: "Kỹ năng",
    addQuestionButton: "Thêm câu hỏi",
    previewButton: "Xem trước",
    saveButton: "Lưu thay đổi",
    cancelButton: "Huỷ", // Xem LƯU Ý CHÍNH TẢ ở đầu file - KHÁC "Hủy" của popup.
    exitButton: "Thoát",
  },

  deleteConfirmDialog: {
    heading: "Xóa bài",
    // Message thật: `Bạn có chắc chắn muốn xóa bài "{title}"? Hành động này không thể hoàn tác.`
    confirmButton: "Xóa",
    cancelButton: "Hủy",
  },
};

/**
 * Đăng nhập qua form UI thật (dùng `po.login` sẵn có của module giao_bai_tap - CÙNG 1 form login
 * `/teacher/login` dùng chung cho mọi domain/tài khoản, chỉ khác BASE_URL/tài khoản truyền vào).
 */
export async function loginTeacherPortalUi(page, { baseUrl, username, password }) {
  await page.goto(`${baseUrl}${loginPo.login.path}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.locator(loginPo.login.usernameInput).first().fill(username);
  await page.locator(loginPo.login.passwordInput).first().fill(password);
  await page.getByRole("button", { name: loginPo.login.submitButton }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });
}

/**
 * Điều hướng thẳng tới 1 Khối trong "Kho đề cá nhân" (đã đăng nhập từ trước).
 */
export async function gotoKhoi(page, baseUrl, khoiNumber) {
  await page.goto(`${baseUrl}${themBaiThucHanhPageObjects.khoDeCaNhan.path}`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: `Khối ${khoiNumber}`, exact: true }).click();
  await page.waitForURL(/\/teacher\/quiz\/[^/?]+(\?.*)?$/, { timeout: 15000 });
}

/**
 * Mở 1 Unit theo đúng text hiển thị (vd "UNIT 1: LEISURE TIME") - bấm vào chính text vẫn expand
 * được dù hàng KHÔNG phải <button> thật (xem ghi chú thật trong kho-de-ca-nhan-management.spec.js).
 */
export async function openUnit(page, unitLabel) {
  const row = page.getByText(unitLabel, { exact: true }).first();
  await row.waitFor({ state: "visible", timeout: 10000 });
  await row.click();
}

/**
 * Mở 1 Lesson theo đúng text (VIẾT HOA TOÀN BỘ, vd "READING") bên trong Unit đã mở. Dùng
 * `page.evaluate()` click trực tiếp trong DOM (KHÔNG qua locator) - ĐÃ XÁC NHẬN THẬT đây là cách
 * duy nhất mở ổn định (click qua locator từng cái một có thể bỏ sót do accordion re-render giữa
 * các lượt, xem ghi chú thật cùng kỹ thuật trong kho-de-ca-nhan-management.spec.js).
 */
export async function openLesson(page, lessonLabel) {
  // FIX (2026-09-23, FAIL thật xác nhận khi chạy `test-them-bai-thuc-hanh-pw` lần đầu): gọi
  // `page.evaluate()` NGAY sau khi click mở Unit bắt được 0 kết quả dù snapshot lúc fail cho thấy
  // Lesson ĐÃ render đầy đủ - race giữa click mở Unit và re-render danh sách Lesson (giống race đã
  // gặp ở kho-de-ca-nhan-management.spec.js). Chờ text Lesson xuất hiện qua locator trước khi mới
  // đọc/click bằng `page.evaluate()`.
  const appeared = await page
    .getByText(lessonLabel, { exact: true })
    .first()
    .waitFor({ state: "visible", timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return false;

  const found = await page.evaluate((label) => {
    const main = document.querySelector("main");
    const el = [...main.querySelectorAll("*")].find(
      (e) => e.children.length === 0 && e.textContent.trim() === label,
    );
    if (el) el.click();
    return !!el;
  }, lessonLabel);

  // FIX (2026-09-23, xác nhận thật qua script debug riêng): danh sách item của Lesson vừa mở
  // render trễ hơn 1 nhịp so với chính hàng Lesson - các hàm đọc DOM 1 lượt qua `page.evaluate()`
  // (`locatePracticeRow`/`getPracticeItemSkillTag`) gọi NGAY sau `openLesson()` có thể đọc trúng
  // lúc danh sách item CHƯA kịp render (không có cơ chế tự retry như locator Playwright thường).
  // Chờ mạng ổn định trước khi trả về để MỌI nơi gọi `openLesson()` đều an toàn, không cần tự nhớ
  // thêm wait riêng.
  await page.waitForLoadState("networkidle").catch(() => {});
  return found;
}

/**
 * Đếm số nút "Bài thực hành" đang hiển thị trên trang (accordion cộng dồn - dùng để kiểm tra tính
 * nhất quán khi mở lần lượt nhiều Lesson, xem TC_TBT_003).
 */
export async function countAddPracticeButtons(page) {
  return page.getByRole("button", { name: themBaiThucHanhPageObjects.lessonSection.addPracticeButton, exact: true }).count();
}

/**
 * Mở popup "Thêm bài thực hành" của Lesson ĐANG MỞ. `buttonIndex` dùng khi trang có nhiều Lesson
 * đang mở cùng lúc (0 = Lesson mở đầu tiên).
 */
export async function openAddPracticePopup(page, buttonIndex = 0) {
  await page
    .getByRole("button", { name: themBaiThucHanhPageObjects.lessonSection.addPracticeButton, exact: true })
    .nth(buttonIndex)
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 10000 });
  return dialog;
}

/**
 * Tìm hàng (row) của 1 item "Bài thực hành" theo đúng tiêu đề, trả về link Sửa + 2 icon action.
 * Áp dụng kỹ thuật dò `parentElement` như đã xác nhận thật (level 0 = 1 lượt hop đã đủ chứa icon).
 */
export async function locatePracticeRow(page, title) {
  // FIX (2026-09-23, FAIL thật xác nhận khi chạy lần đầu): cách cũ dò `ancestor::*[...]` bằng
  // xpath từ editLink KHÔNG tìm ra đúng hàng cha chứa cả 2 icon action trong 1 số trường hợp
  // (deletePracticeByTitle im lặng trả `false` - dữ liệu test bị BỎ SÓT không xoá, tích rác thật
  // trên môi trường dev). Đánh dấu thẳng đúng element cha bằng 1 data-attribute tạm thời trong
  // CÙNG 1 lượt `page.evaluate()` (đã xác nhận thật ổn định hơn) - xoá mọi marker cũ trước khi gắn
  // marker mới để tránh dính marker của lần gọi trước đó (2 case D dùng chung 1 page, không
  // navigate lại giữa các lần gọi).
  //
  // FIX (2026-09-23, FAIL thật xác nhận LẶP LẠI nhiều lần): dù đã có `networkidle` sau
  // `openLesson()`, danh sách item ĐÔI KHI vẫn chưa kịp render tại đúng thời điểm gọi hàm này
  // (network đã idle nhưng React re-render chưa xong) - 1 lượt `page.evaluate()` không tự retry
  // như locator Playwright. Retry tối đa ~5s trước khi kết luận không tìm thấy.
  const deadline = Date.now() + 5000;
  let found = false;
  do {
    found = await page.evaluate((titleText) => {
      document.querySelectorAll("[data-auto-qa-target-row]").forEach((el) => el.removeAttribute("data-auto-qa-target-row"));
      const main = document.querySelector("main");
      const fullTitle = `Bài thực hành: ${titleText}`;
      // Tìm ĐÚNG leaf tiêu đề trước (khớp CHÍNH XÁC, không phải "includes") để tránh nhầm sang hàng
      // khác có tiêu đề chứa fullTitle làm tiền tố/hậu tố. Từ leaf này mới walk lên tìm ancestor gần
      // nhất chứa cả 2 icon action - KHÔNG giới hạn cứng số cấp (dừng ở `main`), vì item KHÔNG có
      // nhãn Kỹ năng có DOM nông hơn 1 cấp so với item CÓ nhãn (thiếu dòng tag), giới hạn cứng 8 cấp
      // đã xác nhận thật bỏ sót các item không có nhãn.
      const titleNode = [...main.querySelectorAll("*")].find(
        (e) => e.children.length === 0 && e.textContent.trim() === fullTitle,
      );
      if (!titleNode) return false;
      let row = titleNode.parentElement;
      while (row && row !== main) {
        if (row.querySelector('button[title="Xóa"]') && row.querySelector('button[title="Xem chi tiết"]') && row.querySelector('a[href*="/edit"]')) {
          row.setAttribute("data-auto-qa-target-row", "1");
          return true;
        }
        row = row.parentElement;
      }
      return false;
    }, title);
    if (!found && Date.now() < deadline) {
      await page.waitForTimeout(500);
    }
  } while (!found && Date.now() < deadline);
  if (!found) return null;

  const row = page.locator('[data-auto-qa-target-row="1"]').first();
  return {
    editLink: row.locator('a[href*="/edit"]').first(),
    previewButton: row.locator('button[title="Xem chi tiết"]'),
    deleteButton: row.locator('button[title="Xóa"]'),
  };
}

/**
 * Tạo 1 bài thực hành mới từ Lesson ĐANG MỞ (mở popup -> nhập Tên bài -> bấm Tạo & soạn câu hỏi
 * -> chờ điều hướng sang trang Chỉnh sửa đề bài). Trả về khi đã ở đúng trang `/edit`.
 */
export async function createPractice(page, title) {
  const dialog = await openAddPracticePopup(page);
  await dialog.locator(`input[placeholder="${themBaiThucHanhPageObjects.addPopup.tenBaiInputPlaceholder}"]`).fill(title);
  await Promise.all([
    page.waitForURL(/\/teacher\/quiz\/[^/]+\/edit/, { timeout: 15000 }),
    dialog.getByRole("button", { name: themBaiThucHanhPageObjects.addPopup.createButton, exact: true }).click(),
  ]);
}

/**
 * Mở popover chọn "Kỹ năng" trên trang Chỉnh sửa đề bài (control dạng chip/tag đa chọn,
 * `aria-haspopup="dialog"`, danh sách hiển thị dạng Command/cmdk - ĐÃ XÁC NHẬN THẬT qua debug
 * riêng 2026-09-23: popover chứa 9 lựa chọn "Nghe/Nói/Đọc/Viết/Ngữ pháp/Từ vựng/Phát âm/Ngữ âm/Mẫu
 * câu", KHÔNG tự đóng sau khi chọn (đóng bằng click ra ngoài hoặc Escape).
 */
export async function openKyNangPicker(page) {
  const label = page.locator("label", { hasText: themBaiThucHanhPageObjects.quizEditPage.kyNangLabel }).first();
  const container = label.locator("xpath=following-sibling::div[1]//div[@aria-haspopup='dialog']").first();
  await container.click();
  const popover = page.getByRole("dialog");
  await popover.waitFor({ state: "visible", timeout: 10000 });
  return popover;
}

/**
 * Chọn CHÍNH XÁC 1 giá trị Kỹ năng, bỏ chọn mọi giá trị đang có sẵn trước đó. ĐÃ XÁC NHẬN THẬT
 * (2026-09-23, debug riêng): đây là control ĐA CHỌN (multi-select) - bấm vào 1 lựa chọn ĐANG được
 * chọn sẽ BỎ CHỌN nó (không phải chọn thêm/thay thế); bấm vào lựa chọn CHƯA chọn sẽ THÊM chip mới
 * bên cạnh chip cũ (không tự thay thế) - vì vậy phải bỏ chọn hết chip cũ trước khi chọn giá trị
 * mới, nếu không sẽ có NHIỀU chip cùng lúc.
 */
export async function selectKyNang(page, skillLabel) {
  const popover = await openKyNangPicker(page);
  const label = page.locator("label", { hasText: themBaiThucHanhPageObjects.quizEditPage.kyNangLabel }).first();
  const chipContainer = label.locator("xpath=following-sibling::div[1]").first();

  // Bỏ chọn hết chip đang có (đọc lại danh sách sau MỖI lần bỏ vì DOM re-render, không dùng lại
  // mảng cũ đã stale). Giới hạn số lần lặp để tránh treo vĩnh viễn nếu bỏ chọn không thành công.
  const readChipLabels = () =>
    chipContainer.locator("button").evaluateAll((buttons) => buttons.map((b) => b.textContent?.trim()).filter(Boolean));
  let currentLabels = await readChipLabels();
  let guard = 0;
  while (currentLabels.length > 0 && guard < 10) {
    await popover.getByText(currentLabels[0], { exact: true }).first().click();
    await page.waitForTimeout(300);
    currentLabels = await readChipLabels();
    guard++;
  }

  await popover.getByText(skillLabel, { exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape").catch(() => {});
}

/**
 * Đọc label đang hiển thị trên chip Kỹ năng hiện tại (vd "Nghe") - dùng để đối chiếu KHÔNG cần
 * biết trước giá trị default là gì.
 */
export async function readKyNangChipLabel(page) {
  const label = page.locator("label", { hasText: themBaiThucHanhPageObjects.quizEditPage.kyNangLabel }).first();
  const chipButton = label.locator("xpath=following-sibling::div[1]//button").first();
  const text = await chipButton.textContent();
  return text?.trim();
}

/**
 * Đọc nhãn Kỹ năng (vd "Đọc") hiển thị dưới 1 item "Bài thực hành" trong danh sách Lesson - trả
 * về `null` nếu item chưa có nhãn (chưa từng Lưu thay đổi Kỹ năng). CHƯA xác nhận thật 100% cấu
 * trúc DOM tổng quát cho MỌI trường hợp (chỉ xác nhận thật với item có sẵn tag đơn dòng ngay sau
 * tiêu đề) - cần chỉnh nếu sai khi chạy thật lần đầu.
 */
export async function getPracticeItemSkillTag(page, title) {
  // FIX (2026-09-23, FAIL thật xác nhận khi chạy full suite - 1 item CŨ/ổn định lâu dài vẫn đọc
  // nhầm ra `null` do trùng đúng lúc React re-render item list dở dang): tìm KHÔNG thấy titleNode
  // (do DOM đang re-render) thì thử lại vài lần trong thời gian ngắn TRƯỚC KHI kết luận null thật
  // sự (không tìm thấy item hoặc item không có nhãn) - không reload, chỉ đọc lại DOM hiện tại.
  const deadline = Date.now() + 3000;
  let result;
  let titleFound;
  do {
    [result, titleFound] = await page.evaluate((titleText) => {
      const main = document.querySelector("main");
      const fullTitle = `Bài thực hành: ${titleText}`;
      const titleNode = [...main.querySelectorAll("*")].find(
        (e) => e.children.length === 0 && e.textContent.trim() === fullTitle,
      );
      if (!titleNode) return [null, false];
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_ELEMENT);
      let passedTitle = false;
      let node;
      while ((node = walker.nextNode())) {
        if (node === titleNode) {
          passedTitle = true;
          continue;
        }
        if (passedTitle && node.children.length === 0 && node.textContent.trim()) {
          const text = node.textContent.trim();
          // FIX (2026-09-23, FAIL thật xác nhận khi chạy lần đầu): item KHÔNG có nhãn thì "lá kế
          // tiếp" chính là dòng TIÊU ĐỀ của item SAU (không có tag nào chen giữa) - phải phân biệt
          // với dòng nhãn thật, nếu không sẽ đọc nhầm nhãn của item kế tiếp.
          //
          // FIX (2026-09-23, FAIL thật xác nhận lần 2 - item CUỐI trong Lesson): nếu item không có
          // nhãn VÀ là item CUỐI CÙNG, "lá kế tiếp" là heading "Thêm nội dung của bài học" (mở đầu
          // section nút "Bài thực hành") - CŨNG phải coi là "không có nhãn", không phải nhãn thật.
          if (text.startsWith("Bài thực hành: ") || text === "Thêm nội dung của bài học") return [null, true];
          return [text, true];
        }
      }
      return [null, true];
    }, title);
    if (!titleFound && Date.now() < deadline) {
      await page.waitForTimeout(300);
    }
  } while (!titleFound && Date.now() < deadline);
  return result;
}

/**
 * Đọc nhãn Kỹ năng của 1 item, RELOAD LẠI TRANG nếu chưa thấy - vừa Lưu xong danh sách Lesson
 * KHÔNG tự refetch qua điều hướng client-side ("Thoát") nên nhãn mới lưu có thể tạm thời đọc ra
 * `null` (ĐÃ XÁC NHẬN THẬT: reload 1 lần có lúc vẫn CHƯA đủ, cần thử lại vài lần với khoảng chờ).
 * Dùng thay cho gọi thẳng `getPracticeItemSkillTag()` ở bất kỳ đâu ngay sau khi vừa Lưu thay đổi.
 */
export async function getPracticeItemSkillTagAfterSave(page, title, { attempts = 8, waitMs = 3000 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const tag = await getPracticeItemSkillTag(page, title);
    if (tag !== null) return tag;
    if (i < attempts - 1) {
      await page.waitForTimeout(waitMs);
      await page.reload({ waitUntil: "networkidle" });
    }
  }
  return null;
}

/**
 * Xoá 1 bài thực hành theo tiêu đề (mở icon Xóa -> confirm dialog -> bấm Xóa). Dùng ở
 * afterEach/teardown để tự dọn dữ liệu test (xem docx mục 3.4 - bài rỗng KHÔNG tự xoá).
 */
export async function deletePracticeByTitle(page, title) {
  const row = await locatePracticeRow(page, title);
  if (!row) {
    // KHÔNG im lặng trả `false` - từng gây bỏ sót dọn dữ liệu test thật (xem FIX ở
    // locatePracticeRow) mà test vẫn báo "passed" vì afterEach nuốt lỗi.
    throw new Error(`deletePracticeByTitle: không tìm thấy hàng "${title}" để xoá.`);
  }
  await row.deleteButton.click();
  const dialog = page.getByRole("dialog").or(page.getByRole("alertdialog"));
  await dialog.getByRole("button", { name: themBaiThucHanhPageObjects.deleteConfirmDialog.confirmButton, exact: true }).click();
  await dialog.waitFor({ state: "hidden", timeout: 10000 });
  return true;
}
