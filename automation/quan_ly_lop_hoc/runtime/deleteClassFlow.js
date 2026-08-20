import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loginTeacherPortal } from "../../giao_bai_tap/navigation/teacherPortalSession.js";
import { teacherClassPageObjects as po } from "../navigation/teacherClassPageObjects.js";
import { readStableClassListCount } from "../navigation/classListCount.js";
import { config } from "../../src/config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, "..", "..", "output", "screenshots");

export class DeleteClassAssertionError extends Error {}

const REQUIRED_PARAMS = ["className"];

/**
 * Tự động hoá DEL-02 (flows/web/teacher/testcases/lop-phu-trach/xoa-lop.md) - xóa 1 lớp KHÔNG
 * có học sinh, PHÍA WEB GV bằng Playwright: đăng nhập -> vào "Lớp phụ trách" -> mở lớp cần xóa ->
 * "Chỉnh sửa lớp học" -> "Xóa lớp học" -> assert đúng tên lớp trong popup xác nhận -> "Xác nhận"
 * -> assert DELETE /api/classes/:id 200 + số lượng lớp giảm đúng 1 + card lớp biến mất.
 *
 * ĐÃ XÁC NHẬN THẬT (2026-08-20, dọn dẹp lớp test thật qua thao tác tay): popup xác nhận thật KHÁC
 * spec cũ trong xoa-lop.md - heading thật là "Xác nhận xóa lớp học" (không phải "Xoá lớp học
 * <tên>"), 2 nút thật là "Hủy"/"Xác nhận" (không phải "Từ chối"/"Đồng ý") - xem
 * navigation/teacherClassPageObjects.js để biết chi tiết + request DELETE thật.
 *
 * @param {object} params
 * @param {string} params.className - tên lớp CẦN XÓA, phải khớp CHÍNH XÁC (exact) với tên hiển thị
 *   trên card/heading chi tiết lớp.
 * @param {string} [params.classId] - id ổn định của lớp (vd lấy từ `createdClass.id` do
 *   addClassFlow.js trả về). Truyền vào -> vào thẳng `/teacher/class/{id}` bằng goto (an toàn tuyệt
 *   đối, không phụ thuộc tên lớp có bị trùng hay không). Không truyền -> tìm lớp bằng cách click
 *   card có tên khớp CHÍNH XÁC `className` trong danh sách (lỗi nếu có ≥2 lớp trùng tên - xem case
 *   ADD-11, chưa rõ rule chống trùng tên nên KHÔNG tự đoán chọn lớp nào).
 * @param {boolean} [params.headless=true]
 * @param {boolean} [params.debugDump=false]
 * @returns {Promise<{status:"PASS"|"FAIL", steps, error?, classCount?:{before:number,after:number},
 *   deletedClass?:{name:string, id:string|null}}>}
 */
export async function deleteClassFlow(params) {
  const missing = REQUIRED_PARAMS.filter((key) => !params[key]);
  if (missing.length > 0) {
    throw new DeleteClassAssertionError(`Thiếu tham số bắt buộc: ${missing.join(", ")}`);
  }

  const { className, classId, headless = true, debugDump = false } = params;

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
  let deletedClass = null;

  const { browser, page } = await loginTeacherPortal({ headless });
  try {
    await step(
      "openClassList",
      async () => {
        // Xem ghi chú chi tiết trong addClassFlow.js#openClassList - heading render trước khi GET
        // .../classes/teacher resolve, phải chờ đúng response này trước khi đọc số lượng lớp.
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

    await step(
      "openClassDetail",
      async () => {
        if (classId) {
          await page.goto(`${config.teacherPortalBaseUrl}${po.path}/${classId}`, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });
        } else {
          await page
            .locator("main")
            .getByRole("heading", { name: className, exact: true })
            .click();
        }

        // Trang "Chi tiết lớp" bắn 3 GET song song (class/:id, students, requests) - heading tên
        // lớp CHỈ hiện đúng sau khi cả 3 resolve (xem ghi chú trong teacherClassPageObjects.js).
        // PHẢI chờ heading thật này trước khi bấm "Chỉnh sửa lớp học", nếu không các GET có thể bị
        // hủy giữa chừng và nút bấm không phản hồi (đã gặp thật khi debug).
        await page
          .getByRole("heading", { name: `${po.detail.headingPrefix}${className}`, exact: true })
          .waitFor({ state: "visible", timeout: 20000 });
      },
      { page },
    )();

    const editDialog = page.getByRole("dialog", { name: po.editDialog.heading });

    await step(
      "openEditDialog",
      async () => {
        await page.locator("main").getByRole("button", { name: po.detail.editButton }).click();
        await editDialog.waitFor({ state: "visible", timeout: 10000 });
      },
      { page },
    )();

    const confirmDialog = page.getByRole("dialog", { name: po.confirmDeleteDialog.heading });

    await step(
      "openDeleteConfirm",
      async () => {
        await editDialog.getByRole("button", { name: po.editDialog.deleteButton }).click();
        await confirmDialog.waitFor({ state: "visible", timeout: 10000 });

        const confirmText = await confirmDialog.innerText();
        if (!confirmText.includes(className)) {
          throw new DeleteClassAssertionError(
            `Popup xác nhận xóa không nhắc đúng tên lớp "${className}" (nội dung thật: "${confirmText}").`,
          );
        }
      },
      { page },
    )();

    await step(
      "confirmDeleteAndVerify",
      async () => {
        // Đăng ký CẢ 2 listener (DELETE + GET refetch danh sách sau đó) TRƯỚC khi click - app
        // tự gọi refetch NGAY sau khi DELETE xong, đăng ký sau khi click dễ bị miss event (đã gặp
        // race tương tự ở addClassFlow.js#openClassList).
        const deleteResponsePromise = page.waitForResponse(
          (res) => res.url().includes("/api/classes/") && res.request().method() === "DELETE",
          { timeout: 15000 },
        );
        const refetchResponsePromise = page
          .waitForResponse(
            (res) => res.url().includes("/api/classes/teacher") && res.request().method() === "GET",
            { timeout: 15000 },
          )
          .catch(() => {});

        const [response] = await Promise.all([
          deleteResponsePromise,
          confirmDialog.getByRole("button", { name: po.confirmDeleteDialog.confirmButton }).click(),
        ]);

        if (response.status() !== 200) {
          throw new DeleteClassAssertionError(
            `DELETE /api/classes/:id trả về status ${response.status()} (kỳ vọng 200).`,
          );
        }

        const deletedId = new URL(response.url()).pathname.split("/").pop();

        // Sau khi xóa, SPA tự điều hướng về lại "Lớp phụ trách" VÀ tự refetch danh sách - chờ GET
        // refetch này + card đã xóa biến mất TRƯỚC khi đọc số đếm, không chỉ dựa vào heading "Lớp
        // phụ trách" hiện ra (heading render TĨNH trước khi refetch resolve).
        await refetchResponsePromise;
        await page
          .getByRole("heading", { name: po.pageHeading })
          .waitFor({ state: "visible", timeout: 15000 });
        await page
          .locator("main")
          .getByRole("heading", { name: className, exact: true })
          .waitFor({ state: "hidden", timeout: 10000 })
          .catch(() => {});

        classCount.after = await readStableClassListCount(page);
        if (classCount.after !== classCount.before - 1) {
          throw new DeleteClassAssertionError(
            `Số lượng lớp không giảm đúng 1 (trước=${classCount.before}, sau=${classCount.after}).`,
          );
        }

        deletedClass = { name: className, id: classId ?? deletedId };
      },
      { page },
    )();

    return { status: "PASS", steps, classCount, deletedClass };
  } catch (err) {
    return { status: "FAIL", steps, error: err.message, classCount, deletedClass };
  } finally {
    await browser.close();
  }
}
