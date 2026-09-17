import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { teacherPortalPageObjects as po } from "../../../../automation/giao_bai_tap/navigation/teacherPortalPageObjects.js";
import { selectPersonalBankClassStably } from "../../../../automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/selectPersonalBankSource.js";
import { resolveAndSelectUnit, resolveAndSelectLesson } from "../../../../automation/giao_bai_tap/navigation/teacherAssignmentDiscovery.js";
import { setDueDateViaPopover } from "../../../../automation/giao_bai_tap/navigation/dueDatePopover.js";

/**
 * TH1/TH2 (bổ sung theo yêu cầu 2026-09-17, KHÔNG có trong xlsx gốc 30 case - xem TESTCASES.md
 * cùng thư mục mục "TH1/TH2" để biết đầy đủ bằng chứng) - sửa TÊN ĐỀ của 1 item trong "Kho bài tập
 * cá nhân" (trang "Chỉnh sửa đề bài", `/teacher/quiz/{id}/edit`) và đối chiếu tiêu đề hiển thị ở
 * "Danh sách bài tập đã giao" (web) tuỳ theo THỜI ĐIỂM sửa so với thời điểm giao bài:
 *   TH1: đã giao bài (tiêu đề CŨ) -> sửa tên đề -> "Bài tập đã giao" (web) VẪN giữ tiêu đề CŨ.
 *   TH2: sửa tên đề TRƯỚC -> giao bài -> "Bài tập đã giao" (web) hiển thị tiêu đề MỚI.
 *
 * ĐÃ XÁC NHẬN THẬT bằng thao tác tay qua chính tài khoản/item dùng ở đây TRƯỚC KHI viết spec
 * (2026-09-17, tài khoản GV Phương `0915315315`, lớp 11A2, item `3fea1b0a-...`): CẢ 2 hành vi trên
 * đều ĐÚNG như acceptance criteria (không phải bug) - "Bài tập đã giao" đọc "tên bài" như 1 SNAPSHOT
 * tại thời điểm giao (KHÔNG link sống tới tên đề gốc) - sửa tên đề sau khi giao KHÔNG ảnh hưởng bản
 * ghi đã giao, chỉ ảnh hưởng các bản ghi giao MỚI SAU thời điểm sửa.
 *
 * PHÁT HIỆN THÊM (khảo sát network lúc thao tác tay): lưu "Tên đề" ở `/teacher/quiz/{id}/edit` gọi
 * `PATCH .../api/user/exams/update_room.json` - cùng họ endpoint "exams"/"room" với "Bài tập đã
 * giao" (`GET .../api/user/exams/room.json`, xem automation/bai_tap/discovery/homeworks.js) - xác
 * nhận thêm kiến trúc: item Kho bài tập cá nhân + bản ghi đã giao CÙNG là 1 khái niệm "Room" ở tầng
 * backend, chỉ khác id/role, đúng tinh thần đã ghi trong `project_teacher_materials_examid_order_mismatch`/TC011.
 *
 * AN TOÀN - KHÔNG phá huỷ (khác `delete-source-regression.spec.js`/TC033): sửa tên đề LÀ CÓ THỂ
 * PHỤC HỒI - mỗi test tự phục hồi tên đề GỐC (`SOURCE_ITEM_TITLE`) trong khối `finally` (chạy dù
 * assertion ở giữa FAIL), và tự xoá bản ghi "Bài tập đã giao" vừa tạo qua đúng flow TC034
 * (`deleteAssignedRoom()`) - không cộng dồn rác, không để lại tên đề bị đổi vĩnh viễn trên item DÙNG
 * CHUNG với các spec khác trong module.
 *
 * GIỚI HẠN (chưa làm - xem TESTCASES.md): CHỈ verify phía WEB. Phía APP (màn "Bài tập" của học
 * sinh) CHƯA được tự động hoá - cùng loại gap với TC023 (cần 1 flow Maestro riêng, tái dùng
 * `collectVisibleHomeworkCards()`/`automation/bai_tap/discovery/homeworkUiList.js` để đọc tiêu đề
 * card thật trên thiết bị) - KHÔNG làm ở đây vì thiết bị test đang được user dùng cho môi trường
 * production tại thời điểm viết (2026-09-17), chưa xin được quyền thao tác.
 *
 * ENV (giống các spec khác trong module - BẮT BUỘC, KHÔNG dùng mặc định .env production):
 *   SOURCE_BASE_URL, SOURCE_USERNAME, SOURCE_PASSWORD, SOURCE_PERSONAL_BANK_CLASS
 *   SOURCE_ITEM_ID_FOR_TITLE_EDIT - id "Kho đề cá nhân" (dạng UUID trong URL
 *     `/teacher/quiz/{id}/edit`) của 1 item THẬT, thuộc đúng SOURCE_PERSONAL_BANK_CLASS - BẮT BUỘC,
 *     không có mặc định. KHÁC với id `lesson-item-{id}` dùng ở checkbox "Giao bài tập" (id-mismatch
 *     đã biết, xem TC011/TC033) - chỉ dùng id này để mở đúng trang sửa "Tên đề".
 *   SOURCE_ITEM_TITLE - tiêu đề CHÍNH XÁC hiện tại của item (không có tiền tố "Bài thực hành: ") -
 *     dùng để tìm đúng checkbox ở "Giao bài tập" (TH1) VÀ làm giá trị PHỤC HỒI sau mỗi test.
 *   SOURCE_ITEM_UNIT - tên Unit chứa item, format giống hệt combobox "Chọn Unit" ở Giao bài tập.
 *   SOURCE_ITEM_ASSIGN_LESSON - tên nút Lesson (TAG kỹ năng, vd "Other") ở form "Giao bài tập" -
 *     KHÁC tên Lesson thật ở "Kho đề cá nhân" (xem TC033 để biết chi tiết bug id/tên khác nhau).
 *
 * Chạy:
 *   cd automation
 *   SOURCE_BASE_URL="https://parrotedu.codeinet.com" SOURCE_USERNAME="0915315315" \
 *   SOURCE_PASSWORD="123456789" SOURCE_PERSONAL_BANK_CLASS="11A2" \
 *   SOURCE_ITEM_ID_FOR_TITLE_EDIT="3fea1b0a-8d30-49c4-87ff-dfe41d26d541" \
 *   SOURCE_ITEM_TITLE="Choose the word whose underlined part is pronounced differently from the others." \
 *   SOURCE_ITEM_UNIT="UNIT 2: OUTDOOR ACTIVITY" SOURCE_ITEM_ASSIGN_LESSON="Other" \
 *   npx playwright test --config=playwright.kho-bai-tap-ca-nhan.config.js source-title-edit-propagation
 */
function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} (xem docblock đầu file).`);
  }
  return value;
}

// Random hạn nộp - tránh trùng hạn nộp với lượt chạy trước đó (đã gặp thật ở nhiều spec khác trong
// module: 2 assignment cùng lớp/cùng item/cùng hạn nộp bị BLOCK do trùng "room").
function randomFutureDate() {
  const offsetDays = 3 + Math.floor(Math.random() * 8);
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return { day: d.getDate(), month: d.getMonth() + 1 };
}

test.describe.serial("Giao bài tập > Sửa tên đề Kho bài tập cá nhân - đối chiếu Bài tập đã giao (TH1/TH2)", () => {
  const BASE_URL = readRequiredEnv("SOURCE_BASE_URL");
  const USERNAME = readRequiredEnv("SOURCE_USERNAME");
  const PASSWORD = readRequiredEnv("SOURCE_PASSWORD");
  const PERSONAL_BANK_CLASS = readRequiredEnv("SOURCE_PERSONAL_BANK_CLASS");
  const ITEM_ID_FOR_TITLE_EDIT = readRequiredEnv("SOURCE_ITEM_ID_FOR_TITLE_EDIT");
  const ORIGINAL_TITLE = readRequiredEnv("SOURCE_ITEM_TITLE");
  const ITEM_UNIT = readRequiredEnv("SOURCE_ITEM_UNIT");
  const ITEM_ASSIGN_LESSON = readRequiredEnv("SOURCE_ITEM_ASSIGN_LESSON");

  let context;
  let page;

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

  /** Sửa "Tên đề" của item Kho bài tập cá nhân + lưu - ĐÃ XÁC NHẬN THẬT (thao tác tay 2026-09-17):
   * input duy nhất `input[name="name"]` trong khối "Thông tin đề", nút lưu text "Lưu thay đổi", lưu
   * xong gọi `PATCH .../api/user/exams/update_room.json` (dùng làm tín hiệu chờ thay vì đoán text
   * toast, chưa xác nhận chuỗi toast chính xác). */
  async function setSourceItemTitle(newTitle) {
    await page.goto(`${BASE_URL}/teacher/quiz/${ITEM_ID_FOR_TITLE_EDIT}/edit`, { waitUntil: "networkidle" });
    const titleInput = page.locator('input[name="name"]');
    await expect(titleInput, `Không tìm thấy input "Tên đề" ở /teacher/quiz/${ITEM_ID_FOR_TITLE_EDIT}/edit.`).toBeVisible({
      timeout: 10000,
    });
    await titleInput.fill(newTitle);
    await Promise.all([
      page.waitForResponse((res) => res.url().includes("update_room.json")),
      page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click(),
    ]);
  }

  /** Giao item (đang có tiêu đề = `expectedCurrentTitle`) tới `PERSONAL_BANK_CLASS`, hạn nộp random
   * - COPY pattern giống hệt setup test của delete-source-regression.spec.js (resolveAndSelectUnit/
   * Lesson trước vì form không tự nhớ đúng Unit/Lesson của item chỉ định, tìm checkbox bằng TIÊU ĐỀ
   * vì id checkbox khác id quản lý - xem TC011/TC033), trả về room_id thật qua create_room.json. */
  async function assignSourceItem(expectedCurrentTitle) {
    await page.goto(`${BASE_URL}/teacher/exercise`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: po.menu.createButton, exact: true }).click();
    await selectPersonalBankClassStably(page, PERSONAL_BANK_CLASS);

    await resolveAndSelectUnit(page, ITEM_UNIT);
    await page.waitForTimeout(1500);
    await resolveAndSelectLesson(page, ITEM_ASSIGN_LESSON);

    const titleNode = page.getByText(expectedCurrentTitle, { exact: true }).first();
    await expect(
      titleNode,
      `Không tìm thấy item tiêu đề "${expectedCurrentTitle}" trong "Danh sách bài tập" của lớp ` +
        `"${PERSONAL_BANK_CLASS}" (Unit "${ITEM_UNIT}", Lesson "${ITEM_ASSIGN_LESSON}").`,
    ).toBeVisible({ timeout: 10000 });
    const checkbox = titleNode.locator("xpath=ancestor::*[.//button[@role='checkbox']][1]//button[@role='checkbox']");
    await checkbox.click();
    await expect(checkbox).toHaveAttribute("aria-checked", "true");

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
    const roomId = createRoomBody?.data?.created_rooms?.[0]?.room_id;
    expect(roomId, `Không lấy được room_id từ response create_room.json: ${JSON.stringify(createRoomBody)}`).toBeTruthy();
    await page.getByText(po.submit.successToast).waitFor({ timeout: 15000 });
    return roomId;
  }

  /** Đọc tiêu đề hiển thị của 1 bản ghi trên "Danh sách bài tập đã giao" - cột "BÀI TẬP" là 1
   * `<a href="/teacher/exercise/{id}/edit">`, text của chính link đó LÀ tiêu đề hiển thị (xem
   * teacherPortalPageObjects.js). Định vị bằng room_id (KHÔNG bằng text tiêu đề) vì tiêu đề này
   * KHÔNG unique giữa nhiều item (đã xác nhận thật - nhiều bản ghi khác trùng nguyên văn tiêu đề). */
  async function readAssignedListTitle(roomId) {
    await page.goto(`${BASE_URL}/teacher/exercise`, { waitUntil: "networkidle" });
    const link = page.locator(`a[href="/teacher/exercise/${roomId}/edit"]`);
    await expect(link, `Không tìm thấy bản ghi "${roomId}" trong "Danh sách bài tập đã giao".`).toBeVisible({
      timeout: 10000,
    });
    return (await link.innerText()).trim();
  }

  /** Xóa 1 bản ghi "Bài tập đã giao" - COPY NGUYÊN pattern đã verify thật ở TC034
   * (delete-assigned-regression.spec.js): dọn dẹp, KHÔNG đụng tới item nguồn. */
  async function deleteAssignedRoom(roomId) {
    await page.goto(`${BASE_URL}/teacher/exercise/${roomId}/edit`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Xóa", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: po.deleteConfirmDialog.confirmButton, exact: true }).click();
    await page.getByText("Xóa bài tập thành công").waitFor({ timeout: 15000 });
  }

  test("TH1: sửa tên đề SAU KHI đã giao bài -> Bài tập đã giao (web) vẫn giữ tiêu đề CŨ", async () => {
    const roomId = await assignSourceItem(ORIGINAL_TITLE);
    try {
      const titleBeforeEdit = await readAssignedListTitle(roomId);
      expect(titleBeforeEdit, "Sanity check: bản ghi vừa giao phải hiển thị đúng tiêu đề gốc.").toBe(ORIGINAL_TITLE);

      const editedTitle = `${ORIGINAL_TITLE} [TH1-EDIT-${roomId.slice(0, 8)}]`;
      await setSourceItemTitle(editedTitle);

      const titleAfterEdit = await readAssignedListTitle(roomId);
      expect(
        titleAfterEdit,
        `Bản ghi "Bài tập đã giao" (${roomId}) đã đổi theo tiêu đề MỚI của item nguồn - lẽ ra phải ` +
          `giữ nguyên tiêu đề tại thời điểm giao (snapshot), đây LÀ BUG nếu FAIL ở đây.`,
      ).toBe(ORIGINAL_TITLE);
    } finally {
      await setSourceItemTitle(ORIGINAL_TITLE);
      await deleteAssignedRoom(roomId);
    }
  });

  test("TH2: sửa tên đề TRƯỚC KHI giao bài -> Bài tập đã giao (web) hiển thị tiêu đề MỚI", async () => {
    const editedTitle = `${ORIGINAL_TITLE} [TH2-EDIT-${Date.now()}]`;
    await setSourceItemTitle(editedTitle);

    let roomId = null;
    try {
      roomId = await assignSourceItem(editedTitle);
      const titleInList = await readAssignedListTitle(roomId);
      expect(
        titleInList,
        `Bản ghi "Bài tập đã giao" (${roomId}) phải hiển thị ĐÚNG tiêu đề MỚI (đã sửa TRƯỚC khi giao).`,
      ).toBe(editedTitle);
    } finally {
      await setSourceItemTitle(ORIGINAL_TITLE);
      if (roomId) await deleteAssignedRoom(roomId);
    }
  });
});
