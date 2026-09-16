import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { teacherPortalPageObjects as po } from "../../../../automation/giao_bai_tap/navigation/teacherPortalPageObjects.js";
import { sourcePageObjects as sel } from "../../../../automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/sourcePageObjects.js";
import { setDueDateViaPopover } from "../../../../automation/giao_bai_tap/navigation/dueDatePopover.js";
import { selectPersonalBankClassStably } from "../../../../automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/selectPersonalBankSource.js";

/**
 * TC021/022/024/025 (nguồn: TestCase_GiaoBaiTap_KhoBaiTapCaNhan.xlsx "6. Giao bài tập (submit)",
 * xem TESTCASES.md cùng thư mục) - giao bài thành công từ Kho bài tập cá nhân, chặn submit rỗng,
 * bản ghi hiển thị đúng sau khi giao, "Hủy" không lưu lựa chọn. AN TOÀN chạy lặp lại - KHÔNG đụng
 * tới Kho bài tập cá nhân, chỉ tạo (TC021, giữ lại để TC024 kiểm tra) rồi để nguyên (không xóa -
 * khác `delete-assigned-regression.spec.js`, test này không cần dọn dẹp vì mỗi lần chạy dùng hạn
 * nộp random, không cộng dồn vô hạn dữ liệu rác nghiêm trọng, và giữ lại đúng tinh thần TC024 "vào
 * lại kiểm tra bản ghi đã giao").
 *
 * ENV (giống các spec khác trong module - BẮT BUỘC, KHÔNG dùng mặc định .env production):
 *   SOURCE_BASE_URL, SOURCE_USERNAME, SOURCE_PASSWORD, SOURCE_PERSONAL_BANK_CLASS
 *
 * Chạy: cd automation && ...(env)... npm run test-kho-bai-tap-ca-nhan-pw
 *   (hoặc thêm tên file để chạy riêng: ... assign-submit)
 */
function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} (xem docblock đầu file).`);
  }
  return value;
}

function randomFutureDate() {
  const offsetDays = 3 + Math.floor(Math.random() * 8);
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return {
    day: d.getDate(),
    month: d.getMonth() + 1,
    dd: String(d.getDate()).padStart(2, "0"),
    mm: String(d.getMonth() + 1).padStart(2, "0"),
    yyyy: d.getFullYear(),
  };
}

test.describe.serial("Giao bài tập > Submit từ Kho bài tập cá nhân (TC021/022/024/025)", () => {
  const BASE_URL = readRequiredEnv("SOURCE_BASE_URL");
  const USERNAME = readRequiredEnv("SOURCE_USERNAME");
  const PASSWORD = readRequiredEnv("SOURCE_PASSWORD");
  const PERSONAL_BANK_CLASS = readRequiredEnv("SOURCE_PERSONAL_BANK_CLASS");

  let context;
  let page;
  let dueDateDdMmYyyy = null;
  let assignedExerciseId = null;
  let assignedUnitLabel = null;
  let assignedItemId = null;

  async function openCreateFormWithClassSelected() {
    await page.goto(`${BASE_URL}/teacher/exercise`, { waitUntil: "networkidle" });
    // "Giao bài tập" text trùng giữa menu sidebar (<link>) và nút tạo mới (<button>) - dùng
    // getByRole("button", ...) để chắc chắn bấm đúng nút tạo mới, không bấm nhầm menu sidebar
    // (đã gặp thật: getByText().first() bấm trúng menu, ở lại nguyên trang danh sách).
    await page.getByRole("button", { name: po.menu.createButton, exact: true }).click();

    // Xem docblock selectPersonalBankSource.js - chọn lớp NGAY SAU khi chọn radio có thể làm
    // chính radio đó bị revert âm thầm về lại KNTT; helper dùng chung verify CẢ 2 điều kiện đồng
    // thời, không chỉ verify radio một lần riêng lẻ trước đó.
    await selectPersonalBankClassStably(page, PERSONAL_BANK_CLASS);
  }

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

  test("TC022: bấm Giao bài đã chọn khi chưa tick bài nào -> cảnh báo, không submit", async () => {
    await openCreateFormWithClassSelected();

    await expect(page.locator('button[role="checkbox"][id^="lesson-item-"]').first()).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("button", { name: po.submit.button }).click();

    await expect(page.getByText(sel.emptySelectionWarningText, { exact: false }).first()).toBeVisible({
      timeout: 5000,
    });
    // Vẫn ở màn tạo mới, KHÔNG có toast thành công - xác nhận submit bị chặn (đúng theo xlsx gốc,
    // chỉ yêu cầu cảnh báo hiện + không cho tiếp tục).
    //
    // QUAN SÁT THÊM (2026-09-16, KHÔNG PHẢI acceptance criteria gốc, chỉ ghi chú): sau khi bấm
    // submit rỗng, "Nguồn bài tập" tự chuyển ngược về "Bộ sách Kết nối tri thức" (kèm Unit đổi
    // theo, vd "Unit 6: A visit to school") dù cảnh báo vẫn đang hiển thị ở vị trí của layout
    // Kho bài tập cá nhân - có thể là UX lạ (radio/Unit không khớp) nhưng KHÔNG assert ở đây vì
    // nằm ngoài phạm vi TC022 gốc (chỉ yêu cầu: cảnh báo hiện, không cho submit).
    await expect(page.getByText(po.submit.successToast)).toHaveCount(0);
  });

  test("TC021: giao bài thành công từ Kho bài tập cá nhân", async () => {
    await openCreateFormWithClassSelected();

    // Chờ combobox Unit auto-select xong 1 Unit THẬT (không còn placeholder "Chọn unit") trước khi
    // đọc label - đã gặp thật: đọc quá sớm bắt được text placeholder thay vì tên Unit thật.
    const unitCombo = page.getByRole("combobox").first();
    await expect(unitCombo).not.toHaveText(/^Chọn unit$/, { timeout: 10000 });
    assignedUnitLabel = await unitCombo.innerText();

    const { day, month, dd, mm, yyyy } = randomFutureDate();
    const dueDateTrigger = page
      .getByText(po.dueDate.label, { exact: true })
      .locator("xpath=following-sibling::*[@aria-haspopup='menu'][1]");
    await setDueDateViaPopover(page, dueDateTrigger, { day, month });
    dueDateDdMmYyyy = `${dd}/${mm}/${yyyy}`;

    const firstCheckbox = page.locator('button[role="checkbox"][id^="lesson-item-"]').first();
    await expect(firstCheckbox).toBeVisible({ timeout: 10000 });
    assignedItemId = (await firstCheckbox.getAttribute("id"))?.replace(/^lesson-item-/, "");
    await firstCheckbox.click();
    await expect(firstCheckbox).toHaveAttribute("aria-checked", "true");

    // ĐÃ XÁC NHẬN THẬT (2026-09-16): lấy id bản ghi vừa tạo bằng cách dò text trong bảng "Danh
    // sách bài tập đã giao" (due date + lớp + tên bài) KHÔNG ĐÁNG TIN CẬY - tên bài tập KHÔNG
    // unique giữa các nguồn (vd "Choose the word whose underlined part..." tồn tại ở CẢ Bộ sách
    // KNTT lẫn Kho bài tập cá nhân, với id hoàn toàn khác nhau), gặp thật: dò ra nhầm 1 bản ghi cũ
    // khác nguồn KNTT dù đã lọc theo due date+lớp+tên. Cách ĐÚNG: bắt response API
    // `POST .../api/user/exams/create_room.json` (gọi khi bấm "Giao bài đã chọn") - trường
    // `data.created_rooms[0].room_id` CHÍNH LÀ id dùng trong URL `/teacher/exercise/{room_id}/edit`
    // VÀ trong bảng "Bài tập đã giao" - đã verify khớp 100% qua debug script riêng.
    const [createRoomResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("create_room.json")),
      page.getByRole("button", { name: po.submit.button }).click(),
    ]);
    const createRoomBody = await createRoomResponse.json();
    assignedExerciseId = createRoomBody?.data?.created_rooms?.[0]?.room_id;
    expect(assignedExerciseId, `Không lấy được room_id từ response create_room.json: ${JSON.stringify(createRoomBody)}`).toBeTruthy();

    await page.getByText(po.submit.successToast).waitFor({ timeout: 15000 });
  });

  test("TC024: bản ghi vừa giao hiển thị đầy đủ, đúng thông tin trong Chỉnh sửa bài tập", async () => {
    await page.goto(`${BASE_URL}/teacher/exercise/${assignedExerciseId}/edit`, { waitUntil: "networkidle" });

    await expect(page.locator(sel.personalBankRadioSelector)).toBeChecked();
    const classCheckbox = page
      .getByText(PERSONAL_BANK_CLASS, { exact: false })
      .first()
      .locator("xpath=ancestor::label[1]//input[@type='checkbox']");
    await expect(classCheckbox).toBeChecked();

    const hanNopText = await page.getByText(/^\d{2}\/\d{2}\/\d{4}$/).last().innerText();
    expect(hanNopText).toBe(dueDateDdMmYyyy);

    const unitCombo = page.getByRole("combobox").first();
    await expect(unitCombo).toContainText(assignedUnitLabel || "");

    const tickedCheckbox = page.locator(`button[role="checkbox"]#lesson-item-${assignedItemId}`);
    await expect(tickedCheckbox).toHaveAttribute("aria-checked", "true");
  });

  test("TC025: bấm Hủy khi đang thao tác Kho bài tập cá nhân -> không lưu lựa chọn", async () => {
    // Đếm SỐ BẢN GHI trên chính màn "Danh sách bài tập đã giao" TRƯỚC khi vào form tạo mới - text
    // "Danh sách bài tập đã giao (N)" CHỈ tồn tại ở màn list, không có ở màn tạo mới (đã gặp thật:
    // đọc count() ngay trên màn tạo mới trả về undefined vì không tìm thấy text).
    await page.goto(`${BASE_URL}/teacher/exercise`, { waitUntil: "networkidle" });
    const countBefore = await page.evaluate(() =>
      document.body.innerText.match(/Danh sách bài tập đã giao \((\d+)\)/)?.[1],
    );
    expect(countBefore, "Không đọc được số bản ghi hiện có trước khi test.").toBeTruthy();

    await openCreateFormWithClassSelected();

    const checkboxes = page.locator('button[role="checkbox"][id^="lesson-item-"]');
    await expect(checkboxes.first()).toBeVisible({ timeout: 10000 });
    await checkboxes.first().click();
    await expect(checkboxes.first()).toHaveAttribute("aria-checked", "true");

    await page.getByRole("button", { name: "Hủy", exact: true }).click();

    await expect(page).toHaveURL(/\/teacher\/exercise$/);
    await page.waitForLoadState("networkidle");
    const countAfter = await page.evaluate(() =>
      document.body.innerText.match(/Danh sách bài tập đã giao \((\d+)\)/)?.[1],
    );
    expect(countAfter, "Số bản ghi 'Bài tập đã giao' bị đổi sau khi bấm Hủy - lẽ ra không đổi.").toBe(
      countBefore,
    );
  });
});
