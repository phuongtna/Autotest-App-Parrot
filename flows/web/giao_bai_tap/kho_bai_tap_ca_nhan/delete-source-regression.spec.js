import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { teacherPortalPageObjects as po } from "../../../../automation/giao_bai_tap/navigation/teacherPortalPageObjects.js";
import { selectPersonalBankClassStably } from "../../../../automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/selectPersonalBankSource.js";
import { resolveAndSelectUnit, resolveAndSelectLesson } from "../../../../automation/giao_bai_tap/navigation/teacherAssignmentDiscovery.js";
import { setDueDateViaPopover } from "../../../../automation/giao_bai_tap/navigation/dueDatePopover.js";

/**
 * TC033 - RULE ĐÃ ĐỔI (theo xác nhận trực tiếp của user, 2026-09-18): xóa 1 bài trong "Kho bài tập
 * cá nhân" SAU KHI đã giao bài đó -> acceptance criteria MỚI: bản ghi "Bài tập đã giao" PHẢI BIẾN
 * MẤT ở CẢ web ("Bài tập đã giao") LẪN app - ngược lại hoàn toàn với acceptance criteria GỐC trong
 * xlsx (yêu cầu bản ghi phải VẪN CÒN). Lịch sử xác nhận (xem TESTCASES.md cùng thư mục để biết đầy
 * đủ bằng chứng theo từng mốc thời gian):
 * 1. 2026-09-16, thao tác tay trên dev: bản ghi biến mất khỏi CẢ 2 nơi - lúc đó bị coi là BUG (vì
 *    xlsx gốc yêu cầu phải còn), backend "đã sửa" để bản ghi ở LẠI.
 * 2. 2026-09-16, chạy tự động hoá lần đầu trên dev sau "fix": xác nhận bản ghi VẪN CÒN ngay lập
 *    tức - lúc đó coi là ĐÃ FIX ĐÚNG, khoá spec lại theo hướng "phải còn".
 * 3. 2026-09-17 + 2026-09-18, chạy lại trên staging (2 lần, KHÔNG chủ ý thay đổi behavior): bản ghi
 *    LẠI biến mất - lúc đó bị coi là "fix ở dev chưa deploy sang staging".
 * 4. 2026-09-18: user xác nhận RULE THẬT ĐÃ ĐỔI - hành vi "biến mất" (mục 1 và 3) mới là ĐÚNG,
 *    hành vi "vẫn còn" (mục 2) là theo rule CŨ đã lỗi thời. Spec dưới đây đã đảo ngược assertion để
 *    khớp rule MỚI - KHÔNG được hiểu nhầm 2 lần FAIL ở mục 3 là bug môi trường staging nữa.
 *
 * *** CẢNH BÁO - TEST NÀY PHÁ HUỶ THẬT: xóa vĩnh viễn 1 item trong Kho bài tập cá nhân
 * (`SOURCE_ITEM_ID_TO_DELETE`), "Hành động này không thể hoàn tác" (nguyên văn dialog xác nhận).
 * CHỦ ĐỘNG bị loại khỏi `playwright.kho-bai-tap-ca-nhan.config.js` qua `testIgnore` - phải chạy
 * bằng config RIÊNG `playwright.kho-bai-tap-ca-nhan-destructive.config.js` (xem lệnh chạy dưới).
 * KHÔNG truyền id của item CUỐI CÙNG còn lại của lớp dùng cho source-selector.spec.js (TC001-008
 * cần ít nhất 1 item để tick) - luôn chuẩn bị/chỉ định 1 item riêng, disposable, trước khi chạy. ***
 *
 * ENV (giống các spec khác trong module - BẮT BUỘC, KHÔNG dùng mặc định .env production):
 *   SOURCE_BASE_URL, SOURCE_USERNAME, SOURCE_PASSWORD, SOURCE_PERSONAL_BANK_CLASS
 *   SOURCE_ITEM_ID_TO_DELETE - id (catalog/management item id, dạng UUID trong URL "Sửa nội dung
 *     đề" ở "Kho đề cá nhân", vd .../teacher/quiz/{id}/edit) của 1 item THẬT, DISPOSABLE, thuộc
 *     đúng SOURCE_PERSONAL_BANK_CLASS - BẮT BUỘC, không có giá trị mặc định (an toàn, tránh xóa
 *     nhầm). LƯU Ý QUAN TRỌNG (phát hiện thật 2026-09-16, giống bug id-mismatch đã gặp ở TC011):
 *     id này KHÁC HẲN id `lesson-item-{id}` dùng ở checkbox trên form "Giao bài tập" - 2 tầng id
 *     khác nhau cho cùng 1 item - CHỈ dùng id này để mở đúng trang xóa ở "Kho đề cá nhân", KHÔNG
 *     dùng để tìm checkbox bên "Giao bài tập" (tìm bằng SOURCE_ITEM_TITLE thay vào đó).
 *   SOURCE_ITEM_TITLE - tiêu đề CHÍNH XÁC của item (không có tiền tố "Bài thực hành: ") - dùng để
 *     tìm đúng checkbox ở "Giao bài tập" VÀ đúng hàng cần xóa ở "Kho đề cá nhân" (an toàn hơn id
 *     mismatch ở trên).
 *   SOURCE_ITEM_UNIT - tên Unit chứa item, GIỐNG NHAU ở cả 2 màn hình (đã xác nhận thật ở TC011:
 *     combobox "Giao bài tập" hiển thị cùng format VIẾT HOA với heading Unit ở "Kho đề cá nhân",
 *     vd "UNIT 2: OUTDOOR ACTIVITY").
 *   SOURCE_ITEM_ASSIGN_LESSON - tên nút Lesson ở form "Giao bài tập" - LƯU Ý: đây là TAG KỸ NĂNG
 *     (vd "Other"/"Reading"/"Speaking"), KHÁC với tên Lesson hiển thị ở "Kho đề cá nhân" (phát hiện
 *     thật 2026-09-16 - xem SOURCE_ITEM_MANAGEMENT_LESSON).
 *   SOURCE_ITEM_MANAGEMENT_LESSON - tên Lesson hiển thị Ở "Kho đề cá nhân" (heading viết hoa toàn
 *     bộ, vd "VOCABULARY AND GRAMMAR") - dùng để mở đúng Lesson accordion trước khi xóa.
 *
 * Chạy (CHỦ ĐỘNG, không chạy cùng full suite):
 *   cd automation
 *   SOURCE_BASE_URL="https://parrotedu.codeinet.com" SOURCE_USERNAME="0915315315" \
 *   SOURCE_PASSWORD="123456789" SOURCE_PERSONAL_BANK_CLASS="11A2" \
 *   SOURCE_ITEM_ID_TO_DELETE="<uuid item disposable>" SOURCE_ITEM_TITLE="<tiêu đề item>" \
 *   SOURCE_ITEM_UNIT="<Unit chứa item>" SOURCE_ITEM_ASSIGN_LESSON="<tag kỹ năng>" \
 *   SOURCE_ITEM_MANAGEMENT_LESSON="<tên Lesson ở Kho đề cá nhân>" \
 *   npx playwright test --config=playwright.kho-bai-tap-ca-nhan-destructive.config.js
 */
// Random hạn nộp - tránh trùng hạn nộp với lượt chạy trước đó (đã gặp thật ở delete-assigned-
// regression.spec.js: 2 assignment cùng lớp/cùng item/cùng hạn nộp bị BLOCK do trùng "room").
function randomFutureDate() {
  const offsetDays = 3 + Math.floor(Math.random() * 8);
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return { day: d.getDate(), month: d.getMonth() + 1 };
}

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} (xem docblock đầu file - test này BẮT BUỘC ` +
      `chỉ định rõ, không có mặc định vì có thể xóa nhầm dữ liệu thật).`);
  }
  return value;
}

test.describe.serial("Kho bài tập cá nhân > Xóa bài đã từng giao (TC033 - REGRESSION)", () => {
  const BASE_URL = readRequiredEnv("SOURCE_BASE_URL");
  const USERNAME = readRequiredEnv("SOURCE_USERNAME");
  const PASSWORD = readRequiredEnv("SOURCE_PASSWORD");
  const PERSONAL_BANK_CLASS = readRequiredEnv("SOURCE_PERSONAL_BANK_CLASS");
  const ITEM_ID_TO_DELETE = readRequiredEnv("SOURCE_ITEM_ID_TO_DELETE");
  const ITEM_TITLE = readRequiredEnv("SOURCE_ITEM_TITLE");
  const ITEM_UNIT = readRequiredEnv("SOURCE_ITEM_UNIT");
  const ITEM_ASSIGN_LESSON = readRequiredEnv("SOURCE_ITEM_ASSIGN_LESSON");
  const ITEM_MANAGEMENT_LESSON = readRequiredEnv("SOURCE_ITEM_MANAGEMENT_LESSON");

  let context;
  let page;
  let assignedExerciseId = null;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto(`${BASE_URL}${po.login.path}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.locator(po.login.usernameInput).first().fill(USERNAME);
    await page.locator(po.login.passwordInput).first().fill(PASSWORD);
    await page.getByRole("button", { name: po.login.submitButton }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test("setup: giao item chỉ định (SOURCE_ITEM_ID_TO_DELETE) tới lớp chỉ định", async () => {
    await page.getByText(po.menu.menuItem, { exact: false }).first().click();
    await page.getByRole("button", { name: po.menu.createButton }).click();
    // Xem docblock selectPersonalBankSource.js - chọn lớp ngay sau radio có thể làm chính radio
    // đó bị revert âm thầm về lại KNTT (bug thật đã xác nhận riêng). ĐẶC BIỆT QUAN TRỌNG ở đây vì
    // test này XÓA THẬT 1 item - phải chắc chắn đang thao tác đúng trên nguồn Kho bài tập cá nhân.
    await selectPersonalBankClassStably(page, PERSONAL_BANK_CLASS);

    // FIX (2026-09-16, FAIL thật xác nhận lần chạy đầu tiên end-to-end): form KHÔNG tự load đúng
    // Unit/Lesson chứa item chỉ định (chỉ nhớ lựa chọn Unit/Lesson GẦN NHẤT của tài khoản) - phải
    // điều hướng thẳng tới đúng Unit/Lesson trước khi tìm checkbox, dùng lại nguyên 2 helper đã có
    // sẵn (KHÔNG viết lại cách dò Unit/Lesson).
    await resolveAndSelectUnit(page, ITEM_UNIT);
    // Danh sách Lesson phụ thuộc Unit vừa chọn - chờ re-render (cùng ngân sách thời gian đã dùng
    // thật trong assignHomeworkFlow.js#selectUnitLessonHomework, không đoán số mới).
    await page.waitForTimeout(1500);
    await resolveAndSelectLesson(page, ITEM_ASSIGN_LESSON);

    // FIX (2026-09-16, FAIL thật): SOURCE_ITEM_ID_TO_DELETE là id từ "Kho đề cá nhân", KHÔNG khớp
    // id `lesson-item-{id}` ở đây (2 tầng id khác nhau cho cùng item, giống bug id-mismatch đã gặp
    // ở TC011) - tìm checkbox bằng TIÊU ĐỀ thay vì id.
    const titleNode = page.getByText(ITEM_TITLE, { exact: true }).first();
    await expect(
      titleNode,
      `Không tìm thấy item tiêu đề "${ITEM_TITLE}" trong "Danh sách bài tập" của lớp ` +
        `"${PERSONAL_BANK_CLASS}" - kiểm tra lại Unit/Lesson đang chọn có đúng chứa item này không.`,
    ).toBeVisible({ timeout: 10000 });
    const targetCheckbox = titleNode.locator("xpath=ancestor::*[.//button[@role='checkbox']][1]//button[@role='checkbox']");
    await targetCheckbox.click();
    await expect(targetCheckbox).toHaveAttribute("aria-checked", "true");

    const { day, month } = randomFutureDate();
    const dueDateTrigger = page
      .getByText(po.dueDate.label, { exact: true })
      .locator("xpath=following-sibling::*[@aria-haspopup='menu'][1]");
    await setDueDateViaPopover(page, dueDateTrigger, { day, month });

    const [createRoomResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("create_room.json")),
      page.getByRole("button", { name: po.submit.button }).click(),
    ]);
    const createRoomBody = await createRoomResponse.json();
    assignedExerciseId = createRoomBody?.data?.created_rooms?.[0]?.room_id;
    expect(assignedExerciseId, `Không lấy được room_id từ response create_room.json: ${JSON.stringify(createRoomBody)}`).toBeTruthy();

    await page.getByText(po.submit.successToast).waitFor({ timeout: 15000 });
  });

  test("Xóa item nguồn trong Kho bài tập cá nhân", async () => {
    // FIX (2026-09-16, FAIL thật): KHÔNG có trang xóa riêng qua "/teacher/exercise/{id}/edit" cho
    // item nguồn (route đó là của bản ghi ĐÃ GIAO, khác hẳn item nguồn - xem TC034). Xóa item
    // nguồn phải làm NGAY TRÊN accordion "Kho đề cá nhân" bằng icon thùng rác (svg.lucide-trash2)
    // cạnh từng item - đã xác nhận thật qua debug DOM live (2026-09-16), "/teacher/quiz/{id}/edit"
    // chỉ là trang SỬA NỘI DUNG câu hỏi, không có nút xóa.
    const khoiNumber = PERSONAL_BANK_CLASS.match(/^\d+/)?.[0];
    expect(khoiNumber, `Không suy ra được số khối từ tên lớp "${PERSONAL_BANK_CLASS}".`).toBeTruthy();

    await page.goto(`${BASE_URL}/teacher/quiz`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: `Khối ${khoiNumber}`, exact: true }).click();

    const unitRow = page.getByText(ITEM_UNIT, { exact: true }).first();
    await expect(unitRow, `Không tìm thấy Unit "${ITEM_UNIT}" ở Kho đề cá nhân khối ${khoiNumber}.`).toBeVisible({
      timeout: 10000,
    });
    await unitRow.click();

    const lessonRow = page.getByText(ITEM_MANAGEMENT_LESSON, { exact: true }).first();
    await expect(
      lessonRow,
      `Không tìm thấy Lesson "${ITEM_MANAGEMENT_LESSON}" trong Unit "${ITEM_UNIT}" ở Kho đề cá nhân.`,
    ).toBeVisible({ timeout: 10000 });
    await lessonRow.click();

    // FIX (2026-09-16, FAIL thật, cùng loại race đã gặp/fix ở kho-de-ca-nhan-management.spec.js
    // TC011): đọc DOM ngay sau click bắt được 0 kết quả dù item đã render đầy đủ ngay sau đó - chờ
    // link "Sửa nội dung đề" đầu tiên xuất hiện trước khi tìm nút xóa.
    await expect(page.locator('a[href*="/teacher/quiz/"][href*="/edit"]').first()).toBeVisible({
      timeout: 10000,
    });

    // FIX (2026-09-16, FAIL thật - xpath ancestor:: qua getByText locator hang tới hết test
    // timeout, không rõ nguyên nhân chính xác): dùng lại NGUYÊN kỹ thuật đã kiểm chứng thật bằng
    // tay qua javascript_tool (tìm leaf node chứa đúng tiêu đề, leo lên tìm button có icon
    // lucide-trash2) thay vì dựng lại bằng Playwright locator/xpath.
    //
    // FIX (2026-09-17, FAIL thật xác nhận trên staging, tài khoản 0912312312/lớp 5D, Lesson
    // "PRONUNCIATION" có 2 item): `titleEl.closest("div")?.parentElement` LUÔN leo đúng 1 cấp cố
    // định - khi 2 item nằm cạnh nhau trong cùng Lesson, cấp cố định đó có thể là 1 container BAO
    // CẢ 2 item (không riêng item đang match title), khiến `row.querySelectorAll("button").find()`
    // luôn trả về nút xóa của item ĐẦU TIÊN trong danh sách bất kể ITEM_TITLE nào được truyền vào -
    // đã bắt được nhờ chính bước đối chiếu tiêu đề trong dialog xác nhận ngay sau đó (không xóa
    // nhầm dữ liệu thật). SỬA: leo dần từng cấp từ titleEl, dừng lại ở ancestor GẦN NHẤT chứa ĐÚNG
    // 1 nút có icon lucide-trash2 - đảm bảo phạm vi "row" luôn ứng với riêng item đang match, không
    // phụ thuộc số cấp cố định.
    const clicked = await page.evaluate((title) => {
      const titleEl = Array.from(document.querySelectorAll("*")).find(
        (el) => el.children.length === 0 && el.textContent.trim().includes(title),
      );
      if (!titleEl) return false;
      let node = titleEl;
      let trashBtn = null;
      for (let i = 0; i < 8 && node; i++) {
        const trashButtons = Array.from(node.querySelectorAll("button")).filter((b) =>
          b.querySelector("svg.lucide-trash2"),
        );
        if (trashButtons.length === 1) {
          trashBtn = trashButtons[0];
          break;
        }
        node = node.parentElement;
      }
      if (!trashBtn) return false;
      trashBtn.click();
      return true;
    }, ITEM_TITLE);
    expect(clicked, `Không click được nút xóa (icon thùng rác) cho item "${ITEM_TITLE}" ở Kho đề cá nhân.`).toBe(true);

    // FIX (2026-09-16, FAIL thật): dialog xóa item nguồn KHÔNG có role="dialog" (khác dialog "Xóa
    // bản ghi đã giao" dùng ở TC034/delete-assigned-regression.spec.js - component modal khác) -
    // getByRole("dialog") timeout dù dialog ĐÃ hiển thị đúng (xác nhận qua screenshot lúc fail).
    // Định vị qua chính nút "Xóa" có TEXT (duy nhất - icon thùng rác từng hàng KHÔNG có text) rồi
    // leo lên ancestor gần nhất chứa heading "Xóa bài" (chỉ xuất hiện khi dialog đang mở).
    //
    // AN TOÀN BẮT BUỘC (test này xóa THẬT, không thể hoàn tác): dialog tự hiển thị NGUYÊN VĂN tiêu
    // đề item ("Bạn có chắc chắn muốn xóa bài "..."?" - đã xác nhận thật qua debug live 2026-09-16)
    // - đối chiếu KHỚP đúng ITEM_TITLE trước khi bấm xác nhận, phòng trường hợp Lesson có ≥2 item
    // khiến bước tìm nút xóa ở trên bấm nhầm hàng.
    const confirmButton = page.getByRole("button", { name: po.deleteConfirmDialog.confirmButton, exact: true });
    await expect(confirmButton, "Dialog xác nhận xóa không xuất hiện sau khi bấm icon thùng rác.").toBeVisible({
      timeout: 10000,
    });
    const dialogContainer = confirmButton.locator("xpath=ancestor::*[contains(., 'Xóa bài')][1]");
    await expect(
      dialogContainer,
      `Dialog xác nhận xóa KHÔNG chứa đúng tiêu đề "${ITEM_TITLE}" - có thể đã bấm nhầm item khác, DỪNG LẠI không xác nhận.`,
    ).toContainText(ITEM_TITLE);

    await confirmButton.click();
    await page.getByText("Xóa bài thành công").waitFor({ timeout: 15000 });
  });

  test("TC033: bản ghi Bài tập đã giao BIẾN MẤT sau khi xóa item nguồn (RULE MỚI 2026-09-18, khoá lại tránh regress)", async () => {
    // RULE MỚI (xác nhận trực tiếp bởi user, 2026-09-18): xóa bài trong Kho bài tập cá nhân PHẢI
    // làm bản ghi "Bài tập đã giao" tương ứng biến mất khỏi web - đảo ngược hoàn toàn so với
    // acceptance criteria gốc trong xlsx (yêu cầu phải còn) - xem docblock đầu file để biết đầy đủ
    // lịch sử đảo chiều rule. Giữ poll (không assert ngay 1 lần) vì đã từng quan sát thật có độ trễ
    // cache ~2 phút ở lần phát hiện đầu tiên (2026-09-16) trước khi biến mất hẳn - dù các lần gần
    // đây (staging, 2026-09-17/18) biến mất gần như ngay lập tức.
    await expect
      .poll(
        async () => {
          await page.goto(`${BASE_URL}/teacher/exercise`, { waitUntil: "networkidle" });
          return page.evaluate((id) => document.body.innerHTML.includes(id), assignedExerciseId);
        },
        {
          message: `Bản ghi "${assignedExerciseId}" phải BIẾN MẤT khỏi "Danh sách bài tập đã giao" ` +
            `sau khi xóa item nguồn - đây là acceptance criteria MỚI (rule đã đổi 2026-09-18).`,
          timeout: 150_000,
          intervals: [15_000],
        },
      )
      .toBe(false);
  });
});
