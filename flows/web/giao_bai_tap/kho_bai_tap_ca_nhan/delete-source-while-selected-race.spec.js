import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { teacherPortalPageObjects as po } from "../../../../automation/giao_bai_tap/navigation/teacherPortalPageObjects.js";
import { selectPersonalBankClassStably } from "../../../../automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/selectPersonalBankSource.js";
import { resolveAndSelectUnit, resolveAndSelectLesson } from "../../../../automation/giao_bai_tap/navigation/teacherAssignmentDiscovery.js";
import { setDueDateViaPopover } from "../../../../automation/giao_bai_tap/navigation/dueDatePopover.js";

/**
 * TC026 (nguồn: TestCase_GiaoBaiTap_KhoBaiTapCaNhan.xlsx, xem TESTCASES.md cùng thư mục) - RACE
 * 2-TAB THẬT: Tab A đang tick 1 item ở form "Giao bài tập" (CHƯA submit) trong khi Tab B (cùng tài
 * khoản) xóa VĨNH VIỄN chính item đó ở "Kho đề cá nhân" - rồi quay lại Tab A (KHÔNG reload trang)
 * bấm "Giao bài đã chọn". xlsx gốc chỉ có bằng chứng Pass cho luồng ĐƠN GIẢN (xóa xong rồi mới quay
 * lại màn Giao bài tập - trang tự nhiên reload/re-fetch danh sách) - CHƯA test đúng race thật này
 * (Tab A không hề biết item đã bị xóa, vẫn hiển thị/tick như cũ).
 *
 * ĐÃ XÁC NHẬN THẬT bằng thao tác tay TRƯỚC khi viết spec này (2026-09-18, GV A `0912312312`, lớp
 * "5D" staging, item `e66648b7-f634-4341-bf56-f4bf9099aa65` "Choose the correct sentence (A, B, C
 * or D) made from the given words.", Khối 5 > UNIT 2: OUTDOOR ACTIVITY > WRITING): bấm "Giao bài đã
 * chọn" ở Tab A (vẫn đang hiển thị/tick item đã bị xóa ở Tab B) -> `POST create_room.json` trả về
 * **HTTP 500** `{"status":false,"message":"Failed to create rooms","error":"no assignable lesson
 * items found for lesson_item_ids","error_code":"INTERNAL_ERROR"}` -> UI hiện toast đỏ "Failed to
 * create rooms" (nguyên văn tiếng Anh, không dịch) -> KHÔNG có bản ghi "Bài tập đã giao" nào được
 * tạo ra (đếm tổng số trước/sau không đổi) -> trang KHÔNG crash/trắng, form vẫn dùng được bình
 * thường. Kết luận: backend chặn đúng, không tạo dữ liệu hỏng - PASS theo đúng kỳ vọng gốc của
 * TC026, dù cơ chế chặn là 1 lỗi 500 chung chung (đáng lẽ nên là 400 + thông báo dịch tiếng Việt -
 * ghi nhận như 1 điểm UX/API-design đáng cải thiện, KHÔNG phải bug mức độ nghiêm trọng).
 *
 * *** CẢNH BÁO - TEST NÀY PHÁ HUỶ THẬT: xóa vĩnh viễn 1 item trong Kho bài tập cá nhân
 * (`SOURCE_ITEM_ID_TO_DELETE`), không thể hoàn tác. CHỦ ĐỘNG bị loại khỏi
 * `playwright.kho-bai-tap-ca-nhan.config.js` qua `testIgnore` - chạy bằng config RIÊNG
 * `playwright.kho-bai-tap-ca-nhan-destructive.config.js`. KHÔNG truyền id của item CUỐI CÙNG còn
 * lại của lớp (source-selector.spec.js/TC001-008 cần ít nhất 1 item). ***
 *
 * ENV (giống delete-source-regression.spec.js - BẮT BUỘC, không có mặc định):
 *   SOURCE_BASE_URL, SOURCE_USERNAME, SOURCE_PASSWORD, SOURCE_PERSONAL_BANK_CLASS
 *   SOURCE_ITEM_ID_TO_DELETE, SOURCE_ITEM_TITLE, SOURCE_ITEM_UNIT, SOURCE_ITEM_ASSIGN_LESSON,
 *     SOURCE_ITEM_MANAGEMENT_LESSON (xem docblock delete-source-regression.spec.js để biết ý nghĩa
 *     từng biến - Y HỆT ở đây)
 *
 * Chạy (CHỦ ĐỘNG, không chạy cùng full suite):
 *   cd automation
 *   SOURCE_BASE_URL="https://parrotedu-staging.parrotedu.vn" SOURCE_USERNAME="0912312312" \
 *   SOURCE_PASSWORD="123456789" SOURCE_PERSONAL_BANK_CLASS="5D" \
 *   SOURCE_ITEM_ID_TO_DELETE="<uuid item disposable>" SOURCE_ITEM_TITLE="<tiêu đề item>" \
 *   SOURCE_ITEM_UNIT="<Unit chứa item>" SOURCE_ITEM_ASSIGN_LESSON="<tag kỹ năng>" \
 *   SOURCE_ITEM_MANAGEMENT_LESSON="<tên Lesson ở Kho đề cá nhân>" \
 *   npx playwright test --config=playwright.kho-bai-tap-ca-nhan-destructive.config.js delete-source-while-selected-race
 */
function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} (xem docblock đầu file - test này BẮT BUỘC ` +
      `chỉ định rõ, không có mặc định vì có thể xóa nhầm dữ liệu thật).`);
  }
  return value;
}

test.describe.serial("Kho bài tập cá nhân > Xóa item nguồn ngay khi đang được tick ở tab khác (TC026 - RACE 2 TAB)", () => {
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
  let pageA; // tab đang tick item, chưa submit
  let pageB; // tab dùng để xóa item nguồn giữa chừng
  let assignedListCountBefore = null;

  async function login(page) {
    await page.goto(`${BASE_URL}${po.login.path}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.locator(po.login.usernameInput).first().fill(USERNAME);
    await page.locator(po.login.passwordInput).first().fill(PASSWORD);
    await page.getByRole("button", { name: po.login.submitButton }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });
  }

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    pageA = await context.newPage();
    await login(pageA);
    // Tab B DÙNG CHUNG context (cùng cookie phiên đăng nhập) - đúng bản chất "2 tab cùng 1 tài
    // khoản trong 1 trình duyệt", KHÔNG cần đăng nhập lại.
    pageB = await context.newPage();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test("Tab A: chọn nguồn + tick item chỉ định, CHƯA submit", async () => {
    await pageA.goto(`${BASE_URL}/teacher/exercise`, { waitUntil: "networkidle" });
    assignedListCountBefore = await pageA
      .getByText(/^Danh sách bài tập đã giao \(\d+\)$/)
      .innerText()
      .then((t) => Number(t.match(/\((\d+)\)/)?.[1]))
      .catch(() => null);

    await pageA.getByRole("button", { name: po.menu.createButton, exact: true }).click();
    await selectPersonalBankClassStably(pageA, PERSONAL_BANK_CLASS);

    await resolveAndSelectUnit(pageA, ITEM_UNIT);
    await pageA.waitForTimeout(1500);
    await resolveAndSelectLesson(pageA, ITEM_ASSIGN_LESSON);

    const titleNode = pageA.getByText(ITEM_TITLE, { exact: true }).first();
    await expect(
      titleNode,
      `Không tìm thấy item tiêu đề "${ITEM_TITLE}" trong "Danh sách bài tập" của lớp ` +
        `"${PERSONAL_BANK_CLASS}" - kiểm tra lại Unit/Lesson đang chọn có đúng chứa item này không.`,
    ).toBeVisible({ timeout: 10000 });
    const targetCheckbox = titleNode.locator(
      "xpath=ancestor::*[.//button[@role='checkbox']][1]//button[@role='checkbox']",
    );
    await targetCheckbox.click();
    await expect(targetCheckbox).toHaveAttribute("aria-checked", "true");

    const { day, month } = { day: new Date().getDate() + 3, month: new Date().getMonth() + 1 };
    const dueDateTrigger = pageA
      .getByText(po.dueDate.label, { exact: true })
      .locator("xpath=following-sibling::*[@aria-haspopup='menu'][1]");
    await setDueDateViaPopover(pageA, dueDateTrigger, { day, month });
    // KHÔNG bấm "Giao bài đã chọn" ở đây - đây chính là trạng thái "đã tick, chưa submit" cần giữ
    // nguyên khi Tab B xóa item ở bước sau.
  });

  test("Tab B: xóa item nguồn đang được tick ở Tab A (PHÁ HUỶ THẬT)", async () => {
    const khoiNumber = PERSONAL_BANK_CLASS.match(/^\d+/)?.[0];
    expect(khoiNumber, `Không suy ra được số khối từ tên lớp "${PERSONAL_BANK_CLASS}".`).toBeTruthy();

    await pageB.goto(`${BASE_URL}/teacher/quiz`, { waitUntil: "networkidle" });
    await pageB.getByRole("link", { name: `Khối ${khoiNumber}`, exact: true }).click();

    const unitRow = pageB.getByText(ITEM_UNIT, { exact: true }).first();
    await expect(unitRow, `Không tìm thấy Unit "${ITEM_UNIT}" ở Kho đề cá nhân khối ${khoiNumber}.`).toBeVisible({
      timeout: 10000,
    });
    await unitRow.click();

    const lessonRow = pageB.getByText(ITEM_MANAGEMENT_LESSON, { exact: true }).first();
    await expect(
      lessonRow,
      `Không tìm thấy Lesson "${ITEM_MANAGEMENT_LESSON}" trong Unit "${ITEM_UNIT}" ở Kho đề cá nhân.`,
    ).toBeVisible({ timeout: 10000 });
    await lessonRow.click();

    await expect(pageB.locator('a[href*="/teacher/quiz/"][href*="/edit"]').first()).toBeVisible({
      timeout: 10000,
    });

    // Y HỆT kỹ thuật đã verify thật ở delete-source-regression.spec.js (leo dần từng cấp từ leaf
    // node chứa tiêu đề, dừng ở ancestor gần nhất chứa ĐÚNG 1 nút thùng rác) - KHÔNG viết lại khác.
    const clicked = await pageB.evaluate((title) => {
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

    const confirmButton = pageB.getByRole("button", { name: po.deleteConfirmDialog.confirmButton, exact: true });
    await expect(confirmButton, "Dialog xác nhận xóa không xuất hiện sau khi bấm icon thùng rác.").toBeVisible({
      timeout: 10000,
    });
    const dialogContainer = confirmButton.locator("xpath=ancestor::*[contains(., 'Xóa bài')][1]");
    await expect(
      dialogContainer,
      `Dialog xác nhận xóa KHÔNG chứa đúng tiêu đề "${ITEM_TITLE}" - có thể đã bấm nhầm item khác, DỪNG LẠI không xác nhận.`,
    ).toContainText(ITEM_TITLE);

    await confirmButton.click();
    await pageB.getByText("Xóa bài thành công").waitFor({ timeout: 15000 });
  });

  test("Tab A (KHÔNG reload): bấm Giao bài đã chọn - phải fail an toàn, KHÔNG tạo bản ghi hỏng", async () => {
    // Xác nhận Tab A vẫn "vô tri" - hoàn toàn không biết item đã bị xóa ở Tab B (đây chính là cốt
    // lõi của race case này: KHÔNG chủ động reload/re-fetch trước khi submit).
    const stillChecked = await pageA
      .locator('button[role="checkbox"][id^="lesson-item-"][aria-checked="true"]')
      .count();
    expect(stillChecked, "Tab A phải vẫn còn tick item như cũ (chưa reload) trước khi submit.").toBeGreaterThan(0);

    const [createRoomResponse] = await Promise.all([
      pageA.waitForResponse((res) => res.url().includes("create_room.json")),
      pageA.getByRole("button", { name: po.submit.button }).click(),
    ]);
    const status = createRoomResponse.status();
    const body = await createRoomResponse.json().catch(() => null);

    // KHÔNG hard-code kỳ vọng "phải là lỗi 4xx chuẩn" - ĐÃ XÁC NHẬN THẬT (thao tác tay 2026-09-18)
    // backend trả 500 (không phải 400) khi item đã bị xóa - ghi nhận đúng thực tế, chỉ đảm bảo yêu
    // cầu CỐT LÕI của TC026: không thành công (không status:true/không room_id nào được tạo).
    expect(
      status >= 400 || body?.status === false || !body?.data?.created_rooms?.length,
      `Submit với item đã bị xóa PHẢI fail - nhưng nhận được HTTP ${status}, body=${JSON.stringify(body)}.`,
    ).toBe(true);

    // Xác nhận KHÔNG có bản ghi "Bài tập đã giao" nào được tạo ra thêm (không dữ liệu hỏng).
    await pageA.goto(`${BASE_URL}/teacher/exercise`, { waitUntil: "networkidle" });
    const countAfterText = await pageA.getByText(/^Danh sách bài tập đã giao \(\d+\)$/).innerText();
    const countAfter = Number(countAfterText.match(/\((\d+)\)/)?.[1]);
    if (assignedListCountBefore != null) {
      expect(
        countAfter,
        `Số "Bài tập đã giao" phải KHÔNG đổi (trước=${assignedListCountBefore}, sau=${countAfter}) - ` +
          `submit thất bại không được để lại bản ghi rác.`,
      ).toBe(assignedListCountBefore);
    }
  });
});
