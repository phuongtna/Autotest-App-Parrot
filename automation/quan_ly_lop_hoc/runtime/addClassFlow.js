import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loginTeacherPortal } from "../../giao_bai_tap/navigation/teacherPortalSession.js";
import { teacherClassPageObjects as po } from "../navigation/teacherClassPageObjects.js";
import { readStableClassListCount } from "../navigation/classListCount.js";

// loginTeacherPortal() sống trong giao_bai_tap/ nhưng chỉ đăng nhập form web GV chung
// (username/password từ .env, không phụ thuộc gì tới nghiệp vụ "giao bài tập") - dùng lại thẳng
// thay vì copy lại ~30 dòng code đăng nhập.

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, "..", "..", "output", "screenshots");

export class AddClassAssertionError extends Error {}

const REQUIRED_PARAMS = ["khoi", "tenLop"];

/**
 * Tự động hoá TC-ADD-FULL / ADD-05 (flows/web/teacher/testcases/lop-phu-trach/them-moi.md)
 * PHÍA WEB GV bằng Playwright: đăng nhập -> vào "Lớp phụ trách" -> mở popup "Thêm mới lớp học"
 * -> chọn Khối + nhập Tên lớp (+ Năm học nếu truyền) -> Lưu -> assert POST /api/classes 201 +
 * số lượng lớp tăng đúng 1 + card lớp mới xuất hiện.
 *
 * @param {object} params
 * @param {string} params.khoi - label ĐÚNG của option trong dropdown Khối, vd "Khối 7" (không
 *   đoán id, chọn theo text hiển thị).
 * @param {string} params.tenLop - tên lớp (freetext), vd "7QA-Test". Caller chịu trách nhiệm
 *   truyền tên KHÔNG trùng với lớp đã có nếu muốn tránh case ADD-11 (trùng tên chưa rõ rule).
 * @param {string} [params.namHoc] - label ĐÚNG của option Năm học, vd "Năm học 2025-2026". Không
 *   truyền -> giữ nguyên giá trị mặc định (năm học hiện tại) của popup.
 * @param {boolean} [params.headless=true]
 * @param {boolean} [params.debugDump=false] - chụp screenshot khi 1 step FAIL, ghi vào
 *   automation/output/screenshots/.
 * @returns {Promise<{status:"PASS"|"FAIL", steps, error?, classCount?:{before:number,after:number},
 *   createdClass?:{name:string, khoi:string, namHoc:string|null, id:string|null}}>}
 */
export async function addClassFlow(params) {
  const missing = REQUIRED_PARAMS.filter((key) => !params[key]);
  if (missing.length > 0) {
    throw new AddClassAssertionError(`Thiếu tham số bắt buộc: ${missing.join(", ")}`);
  }

  const { khoi, tenLop, namHoc, headless = true, debugDump = false } = params;

  const steps = [];
  function step(name, fn, { page } = {}) {
    return async () => {
      try {
        await fn();
        steps.push({ name, status: "PASS" });
      } catch (err) {
        let screenshotPath = null;
        if (debugDump && page) {
          mkdirSync(SCREENSHOT_DIR, { recursive: true });
          screenshotPath = join(SCREENSHOT_DIR, `${name}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {
            screenshotPath = null;
          });
        }
        steps.push({ name, status: "FAIL", error: err.message, screenshotPath });
        throw err;
      }
    };
  }

  const classCount = { before: null, after: null };
  let createdClass = null;

  const { browser, page } = await loginTeacherPortal({ headless });
  try {
    await step(
      "openClassList",
      async () => {
        // ĐÃ XÁC NHẬN THẬT (2026-08-20): heading "Lớp phụ trách" render TĨNH ngay lập tức, TRƯỚC
        // khi GET /api/classes/teacher (danh sách lớp thật) resolve - nếu chỉ chờ heading rồi đọc
        // luôn, có thể đọc trúng lúc danh sách CHƯA có card nào (đang loading, count=0 thật ở thời
        // điểm đó). readStableClassListCount() (2 lần đọc liên tiếp bằng nhau) KHÔNG đủ để phát
        // hiện ca này - 2 lần đọc "0" liên tiếp TRONG lúc còn loading vẫn bị coi là "đã ổn định"
        // (đã gặp thật, xem output/screenshots/ lượt chạy tạo "12QA-DeleteTest-0820"). FIX: chờ
        // đúng response GET .../classes/teacher đầu tiên resolve trước, rồi mới đọc (poll ổn định
        // thêm 1 lớp an toàn cho khoảng re-render ngắn sau khi response về).
        await Promise.all([
          page.waitForResponse(
            (res) => res.url().includes("/api/classes/teacher") && res.request().method() === "GET",
            { timeout: 15000 },
          ),
          page.getByRole("link", { name: po.sidebar.classMenuLink }).click(),
        ]);
        await page
          .getByRole("heading", { name: po.pageHeading })
          .waitFor({ state: "visible", timeout: 15000 });
        classCount.before = await readStableClassListCount(page);
      },
      { page },
    )();

    const dialog = page.getByRole("dialog", { name: po.dialog.heading });

    await step(
      "openAddClassDialog",
      async () => {
        await page.locator("main").getByRole("button", { name: po.addClassButton }).click();
        await dialog.waitFor({ state: "visible", timeout: 10000 });
      },
      { page },
    )();

    await step(
      "fillClassForm",
      async () => {
        // ĐÃ XÁC NHẬN THẬT (2026-08-20): thứ tự DOM cố định trong popup - <select> đầu = Khối
        // học, <select> thứ hai = Năm học (xem teacherClassPageObjects.js).
        const khoiSelect = dialog.locator("select").nth(0);
        await khoiSelect.selectOption({ label: khoi });

        await dialog.getByPlaceholder(po.tenLopPlaceholder).fill(tenLop);

        if (namHoc) {
          const namHocSelect = dialog.locator("select").nth(1);
          await namHocSelect.selectOption({ label: namHoc });
        }
      },
      { page },
    )();

    await step(
      "submitAndVerify",
      async () => {
        const [response] = await Promise.all([
          page.waitForResponse(
            (res) => res.url().includes("/api/classes") && res.request().method() === "POST",
            { timeout: 30000 },
          ),
          dialog.getByRole("button", { name: po.saveButton }).click(),
        ]);

        if (response.status() !== 201) {
          throw new AddClassAssertionError(
            `POST /api/classes trả về status ${response.status()} (kỳ vọng 201).`,
          );
        }
        const body = await response.json().catch(() => null);

        await dialog.waitFor({ state: "hidden", timeout: 10000 });

        // Danh sách chỉ re-render (card mới + số đếm) SAU KHI dialog đã đóng - chờ card lớp mới
        // xuất hiện TRƯỚC khi đọc số đếm, để không đọc trúng danh sách cũ chưa refetch (đã gặp
        // thật: đọc ngay sau khi dialog đóng ra số đếm CŨ dù toast "Thêm mới lớp học thành công"
        // đã hiện - xem submitAndVerify.png trong output/screenshots/ của lượt chạy 2026-08-20).
        await page
          .locator("main")
          .getByRole("heading", { name: tenLop, exact: true })
          .waitFor({ state: "visible", timeout: 15000 });

        classCount.after = await readStableClassListCount(page);
        if (classCount.after !== classCount.before + 1) {
          throw new AddClassAssertionError(
            `Số lượng lớp không tăng đúng 1 (trước=${classCount.before}, sau=${classCount.after}).`,
          );
        }

        createdClass = {
          name: tenLop,
          khoi,
          namHoc: namHoc ?? null,
          id: body?.data?.id ?? null,
        };
      },
      { page },
    )();

    return { status: "PASS", steps, classCount, createdClass };
  } catch (err) {
    return { status: "FAIL", steps, error: err.message, classCount, createdClass };
  } finally {
    await browser.close();
  }
}
