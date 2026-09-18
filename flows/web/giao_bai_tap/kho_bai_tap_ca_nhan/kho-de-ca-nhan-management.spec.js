import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { teacherPortalPageObjects as po } from "../../../../automation/giao_bai_tap/navigation/teacherPortalPageObjects.js";
import { selectPersonalBankClassStably } from "../../../../automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/selectPersonalBankSource.js";

/**
 * TC011 + TC031 (xem TESTCASES.md cùng thư mục) - cả 2 case đều xoay quanh màn hình quản lý riêng
 * "Kho đề cá nhân" (`/teacher/quiz`, menu riêng trên thanh điều hướng, KHÁC màn "Giao bài tập").
 * CHỈ ĐỌC - không tạo/sửa/xóa dữ liệu nào, an toàn chạy lặp lại.
 *
 * TC031 (Nhóm 8, hồi quy): menu "Kho đề cá nhân" điều hướng đúng, hiển thị đúng cấu trúc
 * Khối/Unit/Lesson, không bị ảnh hưởng bởi tính năng mới ở "Giao bài tập".
 *
 * TC011 (Nhóm 3, phân quyền dữ liệu - đối chiếu số lượng/nội dung): danh sách bài tập hiển thị ở
 * "Giao bài tập" > "Kho bài tập cá nhân" phải KHỚP với dữ liệu gốc ở "Kho đề cá nhân". ĐÃ XÁC NHẬN
 * THẬT (2026-09-16, debug DOM 2 màn hình): id của item ở 2 màn hình KHÁC NHAU (`lesson-item-{id}`
 * ở "Giao bài tập" != id trong href "Sửa nội dung đề" ở "Kho đề cá nhân") - KHÔNG so khớp theo id
 * được, phải so khớp theo TIÊU ĐỀ (đúng cách tester gốc đã làm thủ công: đối chiếu ảnh chụp 2 màn
 * hình theo tên bài, xem cột "Actual" của TC011 trong xlsx gốc).
 *
 * ENV (dùng tài khoản GV thứ 2 "_2" - đã xác nhận có ≥2 item thật trong 1 Lesson, giống
 * tick-and-detail.spec.js - KHÔNG dùng mặc định .env production):
 *   SOURCE_BASE_URL, SOURCE_USERNAME_2, SOURCE_PASSWORD_2, SOURCE_PERSONAL_BANK_CLASS_2
 */
function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} (xem docblock đầu file).`);
  }
  return value;
}

test.describe.serial("Giao bài tập > Màn hình quản lý Kho đề cá nhân (TC011/TC031)", () => {
  const BASE_URL = readRequiredEnv("SOURCE_BASE_URL");
  const USERNAME = readRequiredEnv("SOURCE_USERNAME_2");
  const PASSWORD = readRequiredEnv("SOURCE_PASSWORD_2");
  const PERSONAL_BANK_CLASS = readRequiredEnv("SOURCE_PERSONAL_BANK_CLASS_2");

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

  test('TC031: menu "Kho đề cá nhân" điều hướng đúng, hiển thị đúng cấu trúc, không bị ảnh hưởng', async () => {
    await page.goto(`${BASE_URL}/teacher/exercise`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Kho đề cá nhân", exact: true }).click();

    await expect(page).toHaveURL(/\/teacher\/quiz$/);
    await expect(page.getByText(/^Tổng số: \d+ khối$/)).toBeVisible({ timeout: 10000 });
    // 12 khối lớp (1-12) - cấu trúc cố định của trường phổ thông, không phụ thuộc dữ liệu GV.
    await expect(page.getByText("Khối 1", { exact: true })).toBeVisible();
    await expect(page.getByText("Khối 12", { exact: true })).toBeVisible();
  });

  test("TC011: danh sách bài tập ở Giao bài tập khớp đúng dữ liệu gốc ở Kho đề cá nhân (đối chiếu theo tiêu đề)", async () => {
    // Bước 1: thu thập tiêu đề + tên Unit ĐANG chọn thật từ "Giao bài tập" > "Kho bài tập cá
    // nhân" TRƯỚC (không đoán Unit nào ở màn quản lý - đọc thẳng tên Unit combobox tự chọn sẵn,
    // rồi mới đi tìm ĐÚNG Unit đó ở "Kho đề cá nhân", tránh trường hợp 2 màn hình lệch Unit nhau
    // nếu tài khoản có ≥2 Unit thật có dữ liệu).
    await page.goto(`${BASE_URL}/teacher/exercise`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: po.menu.createButton, exact: true }).click();
    await selectPersonalBankClassStably(page, PERSONAL_BANK_CLASS);

    const unitCombo = page.getByRole("combobox").first();
    await expect(unitCombo).not.toHaveText(/^Chọn unit$/, { timeout: 10000 });
    // ĐÃ XÁC NHẬN THẬT (2026-09-16): combobox hiển thị NGUYÊN VĂN VIẾT HOA TOÀN BỘ (vd
    // "UNIT 1: LEISURE TIME") - khớp CHÍNH XÁC format hiển thị Unit ở màn "Kho đề cá nhân", không
    // cần chuẩn hoá hoa/thường.
    const unitLabel = (await unitCombo.innerText()).trim();

    await expect(page.locator('button[role="checkbox"][id^="lesson-item-"]').first()).toBeVisible({
      timeout: 10000,
    });
    const assignTitles = await page.evaluate(() => {
      const boxes = Array.from(document.querySelectorAll('button[role="checkbox"][id^="lesson-item-"]'));
      return boxes
        .map((b) => {
          let node = b;
          for (let i = 0; i < 8 && node; i++) {
            node = node.parentElement;
            if (node?.innerText?.includes("câu hỏi")) return node.innerText;
          }
          return null;
        })
        .filter(Boolean)
        .map((t) => t.split("\n\n")[0].trim());
    });
    expect(
      assignTitles.length,
      `Lớp "${PERSONAL_BANK_CLASS}" không có item nào ở Giao bài tập > Kho bài tập cá nhân để đối chiếu.`,
    ).toBeGreaterThan(0);

    // Bước 2: sang "Kho đề cá nhân" (nguồn gốc dữ liệu), mở ĐÚNG Unit vừa đọc được ở bước 1. "Kho
    // đề cá nhân" tổ chức theo KHỐI (không theo lớp) - suy ra số khối từ chữ số đầu tên lớp (vd
    // "11E" -> khối 11) thay vì đoán/hardcode.
    const khoiNumber = PERSONAL_BANK_CLASS.match(/^\d+/)?.[0];
    expect(khoiNumber, `Không suy ra được số khối từ tên lớp "${PERSONAL_BANK_CLASS}".`).toBeTruthy();

    await page.goto(`${BASE_URL}/teacher/quiz`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: `Khối ${khoiNumber}`, exact: true }).click();

    // ĐÃ XÁC NHẬN THẬT (2026-09-16, live click debug): hàng "UNIT N: ..." KHÔNG phải <button> thật
    // (chỉ 2 icon sửa/xóa cạnh bên mới là button) - nhưng bấm vào chính text vẫn expand được (row
    // cha có onClick), giống pattern "bấm label text" đã dùng khắp module này.
    const matchedUnitRow = page.getByText(unitLabel, { exact: true }).first();
    await expect(
      matchedUnitRow,
      `Không tìm thấy Unit "${unitLabel}" (đọc từ Giao bài tập) ở màn "Kho đề cá nhân" khối ${khoiNumber}.`,
    ).toBeVisible({ timeout: 10000 });
    await matchedUnitRow.click();

    // Lesson hiển thị dạng text VIẾT HOA TOÀN BỘ (vd "READING") - PHÂN BIỆT với tên Unit (có số +
    // dấu ":") và với tag kỹ năng cạnh bên (Title Case, vd "Reading").
    //
    // FIX (2026-09-18, FAIL thật xác nhận khi chạy trên môi trường staging - dữ liệu phong phú hơn
    // dev): bản gốc chỉ mở Lesson ĐẦU TIÊN của Unit, đúng khi tài khoản test chỉ có 1 Lesson/Unit
    // (trường hợp dev). Trên staging, 1 Unit có THỂ có NHIỀU Lesson CÙNG chung 1 tag kỹ năng (vd
    // Unit 2 khối 5 có 5 Lesson: PRONUNCIATION/VOCABULARY AND GRAMMAR/SPEAKING/READING/WRITING đều
    // tag "Other") - "Giao bài tập" gộp CHUNG item của mọi Lesson cùng tag vào 1 nút bấm ("Other"),
    // nên phải mở HẾT các Lesson row của Unit (không chỉ cái đầu) rồi mới đối chiếu, nếu không sẽ
    // báo "thiếu" oan cho các item thuộc Lesson thứ 2 trở đi - KHÔNG phải bug sản phẩm. Đã xác nhận
    // thật: các Lesson row mở kiểu accordion CỘNG DỒN (mở Lesson sau KHÔNG đóng Lesson trước), nên
    // click lần lượt hết rồi đọc 1 lần là đủ.
    const lessonRows = page.locator("main").getByText(/^[A-ZÀ-Ỹ]+(?: [A-ZÀ-Ỹ]+)*$/);
    await expect(lessonRows.first()).toBeVisible({ timeout: 10000 });

    // FIX (2026-09-18, FAIL thật xác nhận qua debug live trên staging): click TUẦN TỰ từng Lesson
    // qua Playwright locator (`.nth(i).click()`) chỉ mở được 1 phần số Lesson thật (ra thiếu item) -
    // nguyên nhân chưa rõ chính xác (nghi accordion re-render giữa các lượt click trusted-event làm
    // lệch trạng thái 1 vài row). Click TOÀN BỘ trong 1 lượt `page.evaluate()` (đã verify thật qua
    // javascript_tool: forEach click() 1 lượt duy nhất mở đủ cả 5 Lesson, ra đủ 7/7 item) - cùng kỹ
    // thuật "click trong page thay vì qua locator" đã dùng ở delete-source-regression.spec.js.
    const lessonLabelsClicked = await page.evaluate(() => {
      const re = /^[A-ZÀ-Ỹ]+(?: [A-ZÀ-Ỹ]+)*$/;
      const main = document.querySelector("main");
      const leaves = [...main.querySelectorAll("*")].filter(
        (e) => e.children.length === 0 && re.test(e.textContent.trim()),
      );
      leaves.forEach((e) => e.click());
      return leaves.map((e) => e.textContent.trim());
    });
    expect(lessonLabelsClicked.length, `Không tìm thấy Lesson nào để mở dưới Unit "${unitLabel}".`).toBeGreaterThan(0);

    // FIX (2026-09-16, FAIL thật xác nhận qua lượt chạy đầu): đọc DOM ngay sau click bắt được 0
    // item dù accessibility snapshot lúc fail cho thấy item ĐÃ render đầy đủ - race giữa click và
    // re-render danh sách item của Lesson (giống các race đã gặp ở nơi khác trong module). Chờ
    // link "Sửa nội dung đề" đầu tiên xuất hiện trước khi đọc, thay vì đọc ngay lập tức.
    await expect(page.locator('a[href*="/teacher/quiz/"][href*="/edit"]').first()).toBeVisible({
      timeout: 10000,
    });

    const managementTitles = await page.evaluate(() => {
      const editLinks = Array.from(document.querySelectorAll('a[href*="/teacher/quiz/"][href*="/edit"]'));
      return editLinks
        .map((a) => {
          let node = a;
          for (let i = 0; i < 8 && node; i++) {
            node = node.parentElement;
            if (node?.innerText?.includes("Bài thực hành")) return node.innerText;
          }
          return null;
        })
        .filter(Boolean)
        .map((t) => t.replace(/^Bài thực hành:\s*/, "").split("\n")[0].trim());
    });
    expect(
      managementTitles.length,
      `Không đọc được item nào từ Unit "${unitLabel}" ở Kho đề cá nhân - cần dữ liệu thật để test TC011.`,
    ).toBeGreaterThan(0);

    // Đối chiếu: MỌI tiêu đề hiển thị ở "Giao bài tập" phải xuất hiện trong tập tiêu đề gốc đọc từ
    // "Kho đề cá nhân" (không yêu cầu ngược lại vì "Kho đề cá nhân" có thể có nhiều Lesson hơn
    // phạm vi Lesson đang mở ở bước 2) - đúng tinh thần TC011 gốc "không thiếu, không lặp, đúng
    // nội dung", kiểm bằng dữ liệu thật thay vì ảnh chụp thủ công.
    const missing = assignTitles.filter((t) => !managementTitles.includes(t));
    expect(
      missing,
      `Có bài tập hiển thị ở "Giao bài tập" nhưng KHÔNG khớp tiêu đề nào trong "Kho đề cá nhân": ` +
        `${JSON.stringify(missing)}. Danh sách gốc: ${JSON.stringify(managementTitles)}.`,
    ).toEqual([]);
  });
});
