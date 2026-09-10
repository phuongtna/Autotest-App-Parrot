import { test, expect } from "../../../../../automation/giao_bai_tap/playwrightTest.js";
import { config } from "../../../../../automation/src/config.js";
import { teacherPortalPageObjects as po } from "../../../../../automation/giao_bai_tap/navigation/teacherPortalPageObjects.js";
import {
  gotoAssignedList,
  filterByClass,
  locateAssignedRow,
  openRowReport,
} from "../../../../../automation/giao_bai_tap/navigation/teacherAssignedListPageObjects.js";
import {
  findRowWithCompletion,
  listCompletedStudents,
} from "../../../../../automation/giao_bai_tap/navigation/teacherReportPageObjects.js";

/**
 * Playwright Test THẬT (`cd automation && npx playwright test --config=playwright.report.config.js`,
 * hoặc `npm run test-bao-cao-hoc-tap-pw`) - lát cắt ĐẠI DIỆN đầu tiên cho Module I "Bài tập về nhà"
 * của kế hoạch automation "Báo cáo học tập" (85 case gốc). CHỈ 3 case Easy/Medium, CHỈ ĐỌC (không
 * tạo/sửa/xóa dữ liệu nào) - phần còn lại của Module I + Module II/III làm ở các đợt sau, không
 * nằm trong phạm vi lát cắt này.
 *
 * LỚP DÙNG ĐỂ TEST - lớp CHỈ ĐỊNH SẴN cho "Báo cáo học tập" (KHÔNG tự tạo lớp/học sinh mới):
 * `7QA-Test-20260909_085649` (class_id `4d423639-8c35-4194-9c10-8e76bb092f08`), tài khoản GV
 * `0912312312` ("Phương"), 1 học sinh duy nhất "QA Report Test" (protocol `REPORT_TEST_PROFILE`).
 * Dữ liệu bài tập/hoạt động thật của lớp này đã được chuẩn bị trước và ghi log đầy đủ tại
 * `test_data/historical_activity_log.md` (nhiều room đã giao+hoàn thành, vd room `48819f9f-...`
 * "Choose the word whose underlined part is pronounced differently from the others." hoàn thành
 * 10/10) - dùng lại NGUYÊN VẸN, không seed thêm. Môi trường `TEACHER_PORTAL_ENV=production` (dữ
 * liệu THẬT, không phải staging) - test KHÔNG được ghi/sửa/xóa bất cứ gì, chỉ điều hướng + đọc.
 *
 * KHÔNG tự chọn cứng 1 room/hạn nộp cụ thể (tránh phụ thuộc dữ liệu có thể đổi giữa các lần chạy) -
 * dùng lại NGUYÊN heuristic đã xác nhận thật trong `reportDiscovery.mjs`/`openStudentResultFlow.js`
 * (`findRowWithCompletion`): sau khi lọc đúng lớp chỉ định, tự tìm 1 dòng bất kỳ có "HS ĐÃ LÀM" > 0
 * trên trang 1 rồi mới thao tác tiếp - an toàn vì hoàn toàn CHỈ ĐỌC.
 *
 * Độ trễ báo cáo 1 batch/ngày (xem `TEST-CASES-tong-ket-lop.md` mục "Bối cảnh cadence") áp dụng
 * cho tab "Tổng kết lớp", KHÔNG áp dụng cho 3 case dưới đây - cả 3 đều là kiểm tra HIỂN THỊ CẤU
 * TRÚC (có mở được màn báo cáo hay không / tiêu đề có đúng bài vừa chọn hay không / danh sách "Đã
 * hoàn thành" có đúng học sinh hay không) dựa trên bất kỳ dữ liệu thật nào đang có tại thời điểm
 * chạy, KHÔNG so khớp một con số đếm cố định nào - không bị ảnh hưởng bởi độ trễ batch.
 *
 * Mapping TC_ID -> case gốc trong file kế hoạch (mục I. Bài tập về nhà):
 *   TC_7  - Kiểm tra quan sát và thao tác click chọn 1 bài zone Thống kê bài làm (Easy)
 *   TC_8  - Kiểm tra hiển thị Tiêu đề bài (Easy)
 *   TC_12 - Kiểm tra hiển thị Danh sách học sinh đã nộp bài (Medium)
 * Các case Module I còn lại (TC_1-6,9-11,13-24), Module II, Module III: CHƯA làm ở đợt này.
 *
 * ĐÍNH CHÍNH (2026-09-10, phát hiện SAU khi file này đã chạy Pass): màn dùng ở đây là
 * "Giao bài tập" > "Danh sách bài tập đã giao" > "Xem báo cáo" (`/teacher/exercise/{id}/report`) -
 * qua khảo sát lại (`reportHomeworkTabDiscovery.mjs`), màn ĐÚNG mà kế hoạch Module I mô tả (zone
 * "Thống kê bài làm", "Phổ điểm", "Biểu đồ phân tích lỗi sai") thực ra nằm ở sidebar RIÊNG "Báo
 * cáo học tập" > tab "Bài tập về nhà" (`/teacher/dashboard`) - 2 màn khác nhau. 3 case trên VẪN
 * PASS THẬT cho tính năng chúng thực sự kiểm tra (drill-down từ "Giao bài tập"), nhưng KHÔNG còn
 * được coi là đã hoàn thành TC_7/TC_8/TC_12 của kế hoạch gốc - 3 case này được định nghĩa lại
 * (hiện BLOCKED, chờ dữ liệu) trong `bai-tap-ve-nha-cases.spec.js`, cùng 19 case Module I còn lại.
 * File này giữ nguyên, không xoá/sửa test - vẫn là 1 smoke check hợp lệ cho màn "Giao bài tập".
 */
test.describe.serial(
  'Báo cáo học tập > Bài tập về nhà - lớp chỉ định "7QA-Test-20260909_085649" (đọc, không sửa dữ liệu)',
  () => {
    const TARGET_CLASS_NAME = "7QA-Test-20260909_085649";

    let context;
    let page;
    let candidate; // { className, itemName, dueDateLine, doneCell } - trả về bởi findRowWithCompletion

    test.beforeAll(async ({ browser }) => {
      if (!config.teacherUsername || !config.teacherPassword) {
        throw new Error(
          "Thiếu TEACHER_USERNAME/TEACHER_PASSWORD trong .env (xem automation/README.md).",
        );
      }

      context = await browser.newContext();
      page = await context.newPage();

      await page.goto(`${config.teacherPortalBaseUrl}${po.login.path}`, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.locator(po.login.usernameInput).first().fill(config.teacherUsername);
      await page.locator(po.login.passwordInput).first().fill(config.teacherPassword);
      await page.getByRole("button", { name: po.login.submitButton }).click();
      await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });

      await gotoAssignedList(page);
      await filterByClass(page, TARGET_CLASS_NAME);

      candidate = await findRowWithCompletion(page);
    });

    test.afterAll(async () => {
      await context?.close();
    });

    test("TC_7: chọn 1 bài đã giao của lớp chỉ định mở đúng màn Báo cáo lớp", async () => {
      test.skip(
        !candidate,
        `Không tìm thấy dòng nào của lớp "${TARGET_CLASS_NAME}" có "HS ĐÃ LÀM" > 0 trên trang 1 tại ` +
          "thời điểm chạy - cần dữ liệu đã hoàn thành thật để test drill-down này (xem " +
          "test_data/historical_activity_log.md để biết trạng thái mong đợi của lớp).",
      );

      const row = await locateAssignedRow(page, candidate);
      await openRowReport(page, row);

      await expect(page).toHaveURL(/\/teacher\/exercise\/.+\/report/);
      await page.locator("h3", { hasText: "Đã hoàn thành" }).first().waitFor({ timeout: 15000 });
    });

    test("TC_8: Tiêu đề bài trên màn Báo cáo lớp đúng bài vừa chọn", async () => {
      test.skip(!candidate, "Bị chặn cùng lý do với TC_7 (không có dòng nào để chọn).");

      const bodyText = await page.locator("body").innerText();
      expect(bodyText).toContain(candidate.itemName);
    });

    test("TC_12: Danh sách học sinh đã nộp bài (card \"Đã hoàn thành\") hiển thị đúng học sinh của lớp", async () => {
      test.skip(!candidate, "Bị chặn cùng lý do với TC_7 (không có dòng nào để chọn).");

      const students = await listCompletedStudents(page);
      expect(students.length).toBeGreaterThan(0);
      expect(students.map((s) => s.name)).toContain("QA Report Test");
    });
  },
);
