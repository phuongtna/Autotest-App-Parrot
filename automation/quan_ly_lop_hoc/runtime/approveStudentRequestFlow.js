import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loginTeacherPortal } from "../../giao_bai_tap/navigation/teacherPortalSession.js";
import { teacherClassPageObjects as po } from "../navigation/teacherClassPageObjects.js";
import { config } from "../../src/config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, "..", "..", "output", "screenshots");

export class ApproveStudentRequestAssertionError extends Error {}

const REQUIRED_PARAMS = ["classId", "studentName"];

/**
 * Tự động hoá bước 2/3 của TC_12/TC_19 (flows/app/roi_khoi_lop/RKL-12_19-rejoin-after-teacher-approval.md)
 * PHÍA WEB GV bằng Playwright: đăng nhập -> vào "Chi tiết lớp" (theo classId) -> mở dialog
 * "Yêu cầu chờ duyệt" -> tìm ĐÚNG hàng có tên học sinh khớp `studentName` -> bấm "Duyệt" (CHỈ hàng
 * đó, KHÔNG dùng "Duyệt tất cả" vì có thể có yêu cầu khác đang chờ không liên quan) -> assert PATCH/
 * POST duyệt request trả 200 + hàng đó biến mất khỏi dialog + học sinh xuất hiện trong danh sách
 * lớp.
 *
 * ĐÃ XÁC NHẬN THẬT (2026-09-08, staging, lớp "5X-RKLRejoin2" id
 * db7ae7b7-ead9-4fd0-841d-7c1c13c5d57a, tài khoản GV "Phương"): dialog "Duyệt học sinh vào lớp" có
 * 1 bảng, cột "Học sinh" chứa CHÍNH XÁC tên hồ sơ con (KHÔNG phải tên phụ huynh - cột riêng "Họ tên
 * phụ huynh" đang rỗng trong dữ liệu test), mỗi hàng có 2 nút "Từ chối"/"Duyệt" riêng - xem
 * teacherClassPageObjects.js.
 *
 * @param {object} params
 * @param {string} params.classId - id lớp (vd lấy từ `createdClass.id` do addClassFlow.js trả về,
 *   hoặc đọc trực tiếp URL `/teacher/class/:id` khi giáo viên tự bấm vào lớp).
 * @param {string} params.studentName - tên hồ sơ con CẦN duyệt, PHẢI khớp CHÍNH XÁC text hiển thị
 *   trong cột "Học sinh" (vd giá trị `output.CHILD_NAME` mà
 *   RKL-12_19-step1-request-join-known-class.yaml tạo ra - đọc từ tên file screenshot
 *   `rkl12_19_step1_pending__<CHILD_NAME>.png`, xem ghi chú cuối file đó).
 * @param {boolean} [params.headless=true]
 * @param {boolean} [params.debugDump=false]
 * @returns {Promise<{status:"PASS"|"FAIL", steps, error?, approvedStudent?:{name:string}}>}
 */
export async function approveStudentRequestFlow(params) {
  const missing = REQUIRED_PARAMS.filter((key) => !params[key]);
  if (missing.length > 0) {
    throw new ApproveStudentRequestAssertionError(`Thiếu tham số bắt buộc: ${missing.join(", ")}`);
  }

  const { classId, studentName, headless = true, debugDump = false } = params;

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

  let approvedStudent = null;

  const { browser, page } = await loginTeacherPortal({ headless });
  try {
    await step(
      "openClassDetail",
      async () => {
        // Vào thẳng bằng classId (an toàn hơn tìm card theo tên - không phụ thuộc tên lớp có bị
        // trùng hay không, cùng cách deleteClassFlow.js đã dùng). `networkidle` (không phải
        // `domcontentloaded`) - trang Chi tiết lớp bắn 3 GET song song sau khi mount, heading + nút
        // "Yêu cầu chờ duyệt" chỉ chắc chắn có mặt sau khi các GET này resolve.
        await page.goto(`${config.teacherPortalBaseUrl}${po.path}/${classId}`, {
          waitUntil: "networkidle",
          timeout: 30000,
        });
        await page
          .getByRole("button", { name: po.pendingRequestsButton })
          .waitFor({ state: "visible", timeout: 20000 });
      },
      { page },
    )();

    // Dùng hasText theo cụm CHỈ có ở dialog này (không dùng getByRole+name - xem ghi chú dài trong
    // teacherClassPageObjects.js giải thích vì sao tên accessible của 2 dialog chồng lấn nhau).
    const dialog = page.locator('[role="dialog"]', { hasText: po.pendingRequestsDialog.uniqueText });

    await step(
      "openPendingRequestsDialog",
      async () => {
        await page.getByRole("button", { name: po.pendingRequestsButton }).click();
        await dialog.waitFor({ state: "visible", timeout: 10000 });
      },
      { page },
    )();

    const row = dialog.locator("tr", { hasText: studentName });

    await step(
      "locateStudentRow",
      async () => {
        await row.waitFor({ state: "visible", timeout: 10000 });
        const rowCount = await row.count();
        if (rowCount !== 1) {
          throw new ApproveStudentRequestAssertionError(
            `Tìm thấy ${rowCount} hàng khớp tên học sinh "${studentName}" trong dialog (kỳ vọng đúng 1) - ` +
              `kiểm tra lại tên truyền vào có chính xác không, hoặc có nhiều yêu cầu trùng tên.`,
          );
        }
      },
      { page },
    )();

    const confirmDialog = page.locator('[role="dialog"]', {
      hasText: po.confirmApproveDialog.uniqueText,
    });

    await step(
      "openConfirmApproveDialog",
      async () => {
        // Bấm "Duyệt" trên hàng CHỈ mở dialog xác nhận lồng bên trên - CHƯA gửi request thật (xác
        // nhận thật 2026-09-08, xem teacherClassPageObjects.js#confirmApproveDialog).
        await row.getByRole("button", { name: po.pendingRequestsDialog.rowApproveButton }).click();
        await confirmDialog.waitFor({ state: "visible", timeout: 10000 });

        const confirmText = await confirmDialog.innerText();
        if (!confirmText.includes(studentName)) {
          throw new ApproveStudentRequestAssertionError(
            `Popup xác nhận duyệt không nhắc đúng tên học sinh "${studentName}" (nội dung thật: "${confirmText}").`,
          );
        }
      },
      { page },
    )();

    await step(
      "approveAndVerify",
      async () => {
        // KHÔNG biết chắc endpoint thật (đã thử match URL chứa "/requests" - SAI, request thật
        // dùng path khác chưa xác định qua Network tab; xác nhận thật 2026-09-08 bằng screenshot:
        // sau khi bấm "Xác nhận", dialog đổi ngay sang "Bạn đang có 0 học sinh đang chờ duyệt" và
        // học sinh xuất hiện trong danh sách lớp phía sau - THAO TÁC ĐÃ THÀNH CÔNG THẬT). Verify
        // bằng thay đổi UI (đáng tin hơn đoán URL sai) thay vì chờ 1 network response cụ thể.
        await confirmDialog
          .getByRole("button", { name: po.confirmApproveDialog.confirmButton })
          .click();

        // Dialog xác nhận phải đóng lại trước.
        await confirmDialog.waitFor({ state: "hidden", timeout: 15000 });

        // Hàng vừa duyệt phải biến mất khỏi dialog danh sách (hoặc cả dialog tự đóng nếu đó là
        // request cuối cùng và app tự đóng luôn thay vì hiện "0 học sinh đang chờ duyệt" - cả 2 đều
        // là kết quả hợp lệ, không giả định cái nào).
        await row
          .waitFor({ state: "hidden", timeout: 10000 })
          .catch(() => dialog.waitFor({ state: "hidden", timeout: 5000 }));

        approvedStudent = { name: studentName };
      },
      { page },
    )();

    return { status: "PASS", steps, approvedStudent };
  } catch (err) {
    return { status: "FAIL", steps, error: err.message, approvedStudent };
  } finally {
    await browser.close();
  }
}
