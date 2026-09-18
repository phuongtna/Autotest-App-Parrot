import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { teacherPortalPageObjects as po } from "../../../../automation/giao_bai_tap/navigation/teacherPortalPageObjects.js";
import { selectPersonalBankClassStably } from "../../../../automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/selectPersonalBankSource.js";
import { resolveAndSelectUnit, resolveAndSelectLesson } from "../../../../automation/giao_bai_tap/navigation/teacherAssignmentDiscovery.js";
import { setDueDateViaPopover } from "../../../../automation/giao_bai_tap/navigation/dueDatePopover.js";

/**
 * Case bổ sung (2026-09-18, KHÔNG có trong xlsx gốc) - khoảng trống được xác định khi rà soát lại
 * toàn bộ TESTCASES.md của module: mọi lần test TC033 (xóa item nguồn -> bản ghi "Bài tập đã giao"
 * phải BIẾN MẤT, xem docblock delete-source-regression.spec.js để biết rule MỚI) từ trước tới nay
 * ĐỀU chỉ verify với ĐÚNG 1 room bị ảnh hưởng. Bug "ghost" NGHIÊM TRỌNG đã xác nhận
 * (`e2e-new-joiner-sees-deleted-source-assignment.mjs`, xem TESTCASES.md) cho thấy cơ chế "ẩn khi
 * xóa" có vẻ là 1 dạng cache/snapshot ĐÁNH GIÁ THEO TỪNG ĐIỀU KIỆN riêng (theo học sinh/theo lớp),
 * KHÔNG phải 1 rule tính toán tức thời đơn giản - nên có khả năng thật là nó cascade KHÔNG ĐỒNG NHẤT
 * khi 1 item nguồn được dùng bởi NHIỀU room khác nhau. Case này giao CÙNG 1 item cho 2 LỚP khác
 * nhau (2 room riêng biệt) rồi xóa item nguồn ĐÚNG 1 LẦN - kỳ vọng CẢ 2 room đều biến mất đồng thời.
 * Nếu chỉ 1 trong 2 biến mất -> xác nhận thêm 1 biến thể của bug cascade không đồng nhất.
 *
 * *** CẢNH BÁO - TEST NÀY PHÁ HUỶ THẬT: xóa vĩnh viễn 1 item trong Kho bài tập cá nhân
 * (`SOURCE_ITEM_ID_TO_DELETE`), "Hành động này không thể hoàn tác". Dùng config destructive riêng,
 * xem lệnh chạy cuối file. ***
 *
 * ENV (giống delete-source-regression.spec.js, THÊM SOURCE_PERSONAL_BANK_CLASS_2 - lớp thứ 2, PHẢI
 * cùng Khối với SOURCE_PERSONAL_BANK_CLASS để cùng thấy được item nguồn):
 *   SOURCE_BASE_URL, SOURCE_USERNAME, SOURCE_PASSWORD
 *   SOURCE_PERSONAL_BANK_CLASS, SOURCE_PERSONAL_BANK_CLASS_2 - 2 lớp KHÁC NHAU, CÙNG Khối.
 *   SOURCE_ITEM_ID_TO_DELETE, SOURCE_ITEM_TITLE, SOURCE_ITEM_UNIT, SOURCE_ITEM_ASSIGN_LESSON,
 *   SOURCE_ITEM_MANAGEMENT_LESSON - giống hệt ý nghĩa ở delete-source-regression.spec.js.
 *
 * Chạy:
 *   cd automation
 *   SOURCE_BASE_URL="https://parrotedu-staging.parrotedu.vn" SOURCE_USERNAME="0912312312" \
 *   SOURCE_PASSWORD="123456789" SOURCE_PERSONAL_BANK_CLASS="5D" SOURCE_PERSONAL_BANK_CLASS_2="5X-RKLRejoin2" \
 *   SOURCE_ITEM_ID_TO_DELETE="<uuid item disposable>" SOURCE_ITEM_TITLE="<tiêu đề item>" \
 *   SOURCE_ITEM_UNIT="<Unit chứa item>" SOURCE_ITEM_ASSIGN_LESSON="<tag kỹ năng>" \
 *   SOURCE_ITEM_MANAGEMENT_LESSON="<tên Lesson ở Kho đề cá nhân>" \
 *   npx playwright test --config=playwright.kho-bai-tap-ca-nhan-destructive.config.js delete-source-multi-room-cascade
 */
function randomFutureDate(offsetBase) {
  const offsetDays = offsetBase + Math.floor(Math.random() * 8);
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return { day: d.getDate(), month: d.getMonth() + 1 };
}

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} (xem docblock đầu file).`);
  }
  return value;
}

async function loginAndOpenCreateForm(page, { BASE_URL, USERNAME, PASSWORD }) {
  await page.goto(`${BASE_URL}${po.login.path}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.locator(po.login.usernameInput).first().fill(USERNAME);
  await page.locator(po.login.passwordInput).first().fill(PASSWORD);
  await page.getByRole("button", { name: po.login.submitButton }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });
}

async function assignItemToClass(page, { BASE_URL, className, ITEM_UNIT, ITEM_ASSIGN_LESSON, ITEM_TITLE, dueOffsetBase }) {
  // Điều hướng thẳng bằng goto (KHÔNG click sidebar "Giao bài tập" rồi click nút) - pattern đã xác
  // nhận ổn định ở assign-submit.spec.js. Quan trọng ở ĐÂY vì gọi hàm này 2 LẦN LIÊN TIẾP trong
  // cùng session - toast thành công của lượt giao TRƯỚC còn hiển thị (sonner toast tự tắt sau vài
  // giây) có thể che nút "Tạo mới"/"Giao bài tập" nếu chỉ click điều hướng nội bộ - goto tải lại
  // trang, tự loại bỏ toast cũ.
  await page.goto(`${BASE_URL}/teacher/exercise`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: po.menu.createButton }).click();
  await selectPersonalBankClassStably(page, className);
  await resolveAndSelectUnit(page, ITEM_UNIT);
  await page.waitForTimeout(1500);
  await resolveAndSelectLesson(page, ITEM_ASSIGN_LESSON);

  const titleNode = page.getByText(ITEM_TITLE, { exact: true }).first();
  await expect(
    titleNode,
    `Không tìm thấy item tiêu đề "${ITEM_TITLE}" trong "Danh sách bài tập" của lớp "${className}".`,
  ).toBeVisible({ timeout: 10000 });
  const targetCheckbox = titleNode.locator("xpath=ancestor::*[.//button[@role='checkbox']][1]//button[@role='checkbox']");
  await targetCheckbox.click();
  await expect(targetCheckbox).toHaveAttribute("aria-checked", "true");

  const { day, month } = randomFutureDate(dueOffsetBase);
  const dueDateTrigger = page
    .getByText(po.dueDate.label, { exact: true })
    .locator("xpath=following-sibling::*[@aria-haspopup='menu'][1]");
  await setDueDateViaPopover(page, dueDateTrigger, { day, month });

  const [createRoomResponse] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("create_room.json")),
    page.getByRole("button", { name: po.submit.button }).click(),
  ]);
  const createRoomBody = await createRoomResponse.json();
  const roomId = createRoomBody?.data?.created_rooms?.[0]?.room_id;
  expect(roomId, `Không lấy được room_id từ response create_room.json (lớp "${className}"): ${JSON.stringify(createRoomBody)}`).toBeTruthy();
  await page.getByText(po.submit.successToast).waitFor({ timeout: 15000 });
  return roomId;
}

test.describe.serial("Kho bài tập cá nhân > Xóa item nguồn dùng cho NHIỀU room (multi-class cascade)", () => {
  const BASE_URL = readRequiredEnv("SOURCE_BASE_URL");
  const USERNAME = readRequiredEnv("SOURCE_USERNAME");
  const PASSWORD = readRequiredEnv("SOURCE_PASSWORD");
  const CLASS_A = readRequiredEnv("SOURCE_PERSONAL_BANK_CLASS");
  const CLASS_B = readRequiredEnv("SOURCE_PERSONAL_BANK_CLASS_2");
  const ITEM_ID_TO_DELETE = readRequiredEnv("SOURCE_ITEM_ID_TO_DELETE");
  const ITEM_TITLE = readRequiredEnv("SOURCE_ITEM_TITLE");
  const ITEM_UNIT = readRequiredEnv("SOURCE_ITEM_UNIT");
  const ITEM_ASSIGN_LESSON = readRequiredEnv("SOURCE_ITEM_ASSIGN_LESSON");
  const ITEM_MANAGEMENT_LESSON = readRequiredEnv("SOURCE_ITEM_MANAGEMENT_LESSON");

  let context;
  let page;
  let roomIdA = null;
  let roomIdB = null;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await loginAndOpenCreateForm(page, { BASE_URL, USERNAME, PASSWORD });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test(`setup: giao item chỉ định tới lớp A ("${CLASS_A ?? ""}")`, async () => {
    roomIdA = await assignItemToClass(page, {
      BASE_URL,
      className: CLASS_A,
      ITEM_UNIT,
      ITEM_ASSIGN_LESSON,
      ITEM_TITLE,
      dueOffsetBase: 3,
    });
  });

  test(`setup: giao CÙNG item chỉ định tới lớp B ("${CLASS_B ?? ""}")`, async () => {
    roomIdB = await assignItemToClass(page, {
      BASE_URL,
      className: CLASS_B,
      ITEM_UNIT,
      ITEM_ASSIGN_LESSON,
      ITEM_TITLE,
      dueOffsetBase: 13,
    });
    expect(roomIdB, "room_id lớp B phải khác room_id lớp A (2 room riêng biệt).").not.toBe(roomIdA);
  });

  test("Xóa item nguồn trong Kho bài tập cá nhân (đúng 1 lần)", async () => {
    const khoiNumber = CLASS_A.match(/^\d+/)?.[0];
    expect(khoiNumber, `Không suy ra được số khối từ tên lớp "${CLASS_A}".`).toBeTruthy();

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

    await expect(page.locator('a[href*="/teacher/quiz/"][href*="/edit"]').first()).toBeVisible({
      timeout: 10000,
    });

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
    expect(clicked, `Không click được nút xóa cho item "${ITEM_TITLE}" ở Kho đề cá nhân.`).toBe(true);

    const confirmButton = page.getByRole("button", { name: po.deleteConfirmDialog.confirmButton, exact: true });
    await expect(confirmButton, "Dialog xác nhận xóa không xuất hiện.").toBeVisible({ timeout: 10000 });
    const dialogContainer = confirmButton.locator("xpath=ancestor::*[contains(., 'Xóa bài')][1]");
    await expect(
      dialogContainer,
      `Dialog xác nhận xóa KHÔNG chứa đúng tiêu đề "${ITEM_TITLE}" - DỪNG LẠI không xác nhận.`,
    ).toContainText(ITEM_TITLE);

    await confirmButton.click();
    await page.getByText("Xóa bài thành công").waitFor({ timeout: 15000 });
  });

  test("CẢ 2 room (lớp A và lớp B) phải BIẾN MẤT đồng thời khỏi Bài tập đã giao", async () => {
    let lastSeenA = null;
    let lastSeenB = null;
    await expect
      .poll(
        async () => {
          await page.goto(`${BASE_URL}/teacher/exercise`, { waitUntil: "networkidle" });
          const html = await page.evaluate(() => document.body.innerHTML);
          lastSeenA = html.includes(roomIdA);
          lastSeenB = html.includes(roomIdB);
          return { seenA: lastSeenA, seenB: lastSeenB };
        },
        {
          message: () =>
            `Kỳ vọng CẢ 2 room biến mất đồng thời. Trạng thái cuối: room A ("${CLASS_A}", ${roomIdA}) ` +
            `${lastSeenA ? "VẪN CÒN" : "đã biến mất"}, room B ("${CLASS_B}", ${roomIdB}) ` +
            `${lastSeenB ? "VẪN CÒN" : "đã biến mất"}. Nếu chỉ 1 trong 2 biến mất -> xác nhận bug cascade ` +
            `không đồng nhất (biến thể của bug ghost đã xác nhận ở TESTCASES.md).`,
          timeout: 150_000,
          intervals: [15_000],
        },
      )
      .toEqual({ seenA: false, seenB: false });
  });
});
