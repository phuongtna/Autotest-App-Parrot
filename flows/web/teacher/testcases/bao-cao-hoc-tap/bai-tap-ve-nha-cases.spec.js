import { test, expect } from "../../../../../automation/giao_bai_tap/playwrightTest.js";
import { config } from "../../../../../automation/src/config.js";
import { teacherPortalPageObjects as po } from "../../../../../automation/giao_bai_tap/navigation/teacherPortalPageObjects.js";
import {
  gotoReportHomeworkTab,
  switchReportClass,
  readHomeworkTabEmptyState,
} from "../../../../../automation/giao_bai_tap/navigation/reportHomeworkTabPageObjects.js";

/**
 * Playwright Test THẬT (`cd automation && npx playwright test --config=playwright.report.config.js`,
 * hoặc `npm run test-bao-cao-hoc-tap-pw`) cho TOÀN BỘ 22 case Module I "Bài tập về nhà" thuộc
 * Phase 1 + Phase 2 của kế hoạch gốc (TC_1-12,14-21,24-25 - KHÔNG gồm TC_13/22/23, 3 case Pending/
 * Todo mà kế hoạch gốc đã tự hoãn chờ QA/thiết kế xác nhận, xem mục "Việc cần làm tiếp" trong
 * TEST-CASES-tong-ket-lop.md - out of scope ở file này).
 *
 * QUAN TRỌNG - PHÁT HIỆN LẠI MÀN HÌNH ĐÚNG (2026-09-10): file `bai-tap-ve-nha-smoke.spec.js`
 * (lát cắt đại diện trước đó, ĐÃ CHẠY PASS) dùng màn "Giao bài tập" > "Danh sách bài tập đã giao"
 * > "Xem báo cáo" (`/teacher/exercise/{id}/report`) cho TC_7/TC_8/TC_12 - qua khảo sát lại hôm nay
 * bằng `reportHomeworkTabDiscovery.mjs` (`reportClassSummaryDiscovery.mjs` cho tab "Tổng kết lớp"
 * đã gợi ý trước: sidebar "Báo cáo học tập" điều hướng RIÊNG, khác "Giao bài tập"), xác nhận ĐÂY
 * MỚI LÀ màn Module I thật của kế hoạch ("Báo cáo học tập" > tab "Bài tập về nhà", zone "Thống kê
 * bài làm"...). File smoke cũ vẫn ĐÚNG và PASS thật cho tính năng nó mô tả (drill-down từ "Giao bài
 * tập"), nhưng KHÔNG coi là đã hoàn thành TC_7/TC_8/TC_12 của kế hoạch - 3 case này được định nghĩa
 * lại (BLOCKED) trong file này, xem ghi chú riêng từng case bên dưới.
 *
 * FIXTURE DUY NHẤT DÙNG CHO FILE NÀY (KHÔNG tạo lớp/học sinh mới, KHÔNG mutate dữ liệu production):
 * lớp CHỈ ĐỊNH SẴN cho "Báo cáo học tập" - `7QA-Test-20260909_085649`
 * (class_id `4d423639-8c35-4194-9c10-8e76bb092f08`), tài khoản GV `0912312312` ("Phương"), 1 học
 * sinh duy nhất "QA Report Test" (protocol `REPORT_TEST_PROFILE`,
 * xem `test_data/historical_activity_log.md`).
 *
 * PHÁT HIỆN QUYẾT ĐỊNH (2026-09-10, xác nhận thật qua `reportHomeworkTabDiscovery.mjs` chạy trên
 * đúng lớp/tab này): tab "Bài tập về nhà" của lớp chỉ định hiện hiển thị ĐÚNG empty-state
 * "Lớp 7QA-Test-20260909_085649 chưa có bài tập nào được giao" - MẶC DÙ lớp này đã có nhiều room
 * thật được giao+hoàn thành (xem log) - vì CẢ 6 room thật đều CHƯA qua hạn nộp theo quy tắc cadence
 * đã xác nhận trước đó (hiện từ NGÀY HÔM SAU hạn nộp): 3 room hạn 11/09/2026 (dự kiến lên báo cáo
 * từ 2026-09-12), 3 room hạn 16/09/2026 (dự kiến từ 2026-09-17). Do đó:
 *   - TC_2 (TH CHƯA có dữ liệu) khớp CHÍNH XÁC trạng thái thật hiện tại -> triển khai được NGAY,
 *     KHÔNG cần chờ/không cần dữ liệu giả lập.
 *   - TC_3 (chọn lớp + nhớ lựa chọn gần nhất) KHÔNG phụ thuộc dữ liệu bài tập -> triển khai được
 *     NGAY.
 *   - TẤT CẢ case còn lại giả định zone "Thống kê bài làm" CÓ dữ liệu -> BLOCKED tới khi có dữ liệu
 *     thật (`test.skip()`, lý do cụ thể ghi ở từng case - theo đúng yêu cầu "không đoán/không làm
 *     yếu assertion").
 */
test.describe.serial(
  'Báo cáo học tập > Bài tập về nhà - 22 case Phase 1+2, lớp chỉ định "7QA-Test-20260909_085649" (đọc, không sửa dữ liệu)',
  () => {
    const TARGET_CLASS_NAME = "7QA-Test-20260909_085649";

    let context;
    let page;

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

      await gotoReportHomeworkTab(page);
    });

    test.afterAll(async () => {
      await context?.close();
    });

    test("TC_1: hiển thị tổng thể màn Báo cáo lớp Bài tập về nhà (có dữ liệu)", async () => {
      test.skip(
        true,
        'BLOCKED - cần zone "Thống kê bài làm" có dữ liệu (danh sách bài + phổ điểm + biểu đồ lỗi ' +
          "sai) để kiểm tra hiển thị tổng thể, nhưng lớp chỉ định hiện đang ở empty-state thật " +
          '("chưa có bài tập nào được giao", xác nhận 2026-09-10) vì cả 6 room thật đều chưa qua ' +
          "hạn nộp (quy tắc cadence: hiện từ ngày hôm sau hạn nộp). Dự kiến có dữ liệu từ " +
          "2026-09-12 (3 room hạn 11/09). Case gốc còn được đánh giá Hard (biểu đồ/canvas) trong " +
          "kế hoạch, cần khảo sát DOM/API biểu đồ riêng trước khi tự động hoá dù đã có dữ liệu.",
      );
    });

    test("TC_2: hiển thị màn Báo cáo lớp Bài tập về nhà - TH chưa có dữ liệu GV giao bài tập", async () => {
      await switchReportClass(page, TARGET_CLASS_NAME);

      const emptyState = await readHomeworkTabEmptyState(page);
      expect(emptyState.isEmpty).toBe(true);
      expect(emptyState.messageText).toContain(TARGET_CLASS_NAME);
      expect(emptyState.messageText).toContain("chưa có bài tập nào được giao");
      expect(emptyState.hasCtaButton).toBe(true);
    });

    test("TC_3: hiển thị và thao tác chọn lớp (nhớ lựa chọn gần nhất khi quay lại)", async () => {
      // Điều kiện tiên quyết: TC_2 vừa chuyển đúng sang lớp chỉ định - tiếp tục dùng trạng thái đó
      // (KHÔNG đăng nhập/điều hướng lại từ đầu, đúng yêu cầu tái sử dụng session).
      let bodyText = await page.locator("body").innerText();
      expect(bodyText).toContain(TARGET_CLASS_NAME);

      // Rời màn "Báo cáo học tập" sang 1 màn khác (Lớp phụ trách) rồi quay lại - ĐÚNG kịch bản của
      // bug ID2041 ("Không focus đúng lớp được chọn gần nhất ở lần truy cập thứ 2").
      await page.getByText("Lớp phụ trách", { exact: false }).first().click();
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1000);

      await gotoReportHomeworkTab(page);

      bodyText = await page.locator("body").innerText();
      expect(bodyText).toContain(TARGET_CLASS_NAME);
    });

    test("TC_4: hiển thị danh sách bài tập zone Thống kê bài làm", async () => {
      test.skip(
        true,
        'BLOCKED - zone "Thống kê bài làm" đang rỗng (cùng lý do TC_1: chưa room nào qua hạn nộp, ' +
          "dự kiến có dữ liệu từ 2026-09-12).",
      );
    });

    test("TC_5: hiển thị thứ tự danh sách bài tập zone Thống kê bài làm (hạn nộp gần nhất)", async () => {
      test.skip(true, "BLOCKED - cùng lý do TC_4 (zone rỗng, cần dữ liệu từ 2026-09-12).");
    });

    test("TC_6: hiển thị nội dung danh sách các bài zone Thống kê bài làm (text truncation)", async () => {
      test.skip(
        true,
        "BLOCKED - cùng lý do TC_4 (zone rỗng). Khi có dữ liệu (từ 2026-09-12), fixture CÓ ứng " +
          'viên tiêu đề đủ dài để test truncation (vd room 48819f9f "Choose the word whose ' +
          'underlined part is pronounced differently from the others." - hạn 16/09, cần chờ tới ' +
          "2026-09-17).",
      );
    });

    test("TC_7: click chọn 1 bài zone Thống kê bài làm mở đúng zone drill-down", async () => {
      test.skip(
        true,
        'BLOCKED trên ĐÚNG màn "Báo cáo học tập > Bài tập về nhà" - zone "Thống kê bài làm" đang ' +
          "rỗng (cùng lý do TC_4). LƯU Ý: `bai-tap-ve-nha-smoke.spec.js` có 1 case cùng tên TC_7 " +
          'đã PASS nhưng qua màn KHÁC ("Giao bài tập" > "Xem báo cáo") - phát hiện lại 2026-09-10 ' +
          "đây KHÔNG phải màn kế hoạch mô tả, không tính là đã hoàn thành case này.",
      );
    });

    test("TC_8: hiển thị Tiêu đề bài (sau khi chọn 1 bài ở zone Thống kê bài làm)", async () => {
      test.skip(
        true,
        "BLOCKED trên ĐÚNG màn - cùng lý do TC_7 (zone rỗng + đã bị test nhầm màn trong smoke test " +
          "trước, xem ghi chú TC_7 ở trên).",
      );
    });

    test("TC_9: hiển thị Danh sách học sinh chưa nộp bài", async () => {
      test.skip(
        true,
        "BLOCKED - cùng lý do TC_4 (zone rỗng, cần dữ liệu từ 2026-09-12). LƯU Ý THÊM: lớp chỉ " +
          "định chỉ có 1 học sinh - kể cả khi có dữ liệu, danh sách 'chưa nộp' nhiều khả năng chỉ " +
          "có 0-1 dòng, không đại diện đầy đủ Expected Result gốc (nhiều học sinh, nhiều avatar).",
      );
    });

    test("TC_10: hiển thị avatar - TH học sinh không có avatar", async () => {
      test.skip(
        true,
        "BLOCKED - cùng lý do TC_4 (zone rỗng); ngoài ra CHƯA xác nhận học sinh 'QA Report Test' " +
          "có/không có avatar trên hệ thống thật.",
      );
    });

    test("TC_11: hiển thị và thao tác scroll trong danh sách học sinh", async () => {
      test.skip(
        true,
        "BLOCKED VĨNH VIỄN với fixture hiện tại - cần >6 học sinh trong 1 danh sách để test scroll; " +
          "lớp chỉ định chỉ có ĐÚNG 1 học sinh (giới hạn cố hữu của fixture, KHÔNG phải vấn đề " +
          "ngày/dữ liệu bài tập - có dữ liệu bài tập cũng không đổi được số học sinh của lớp).",
      );
    });

    test("TC_12: hiển thị Danh sách học sinh đã nộp bài", async () => {
      test.skip(
        true,
        'BLOCKED trên ĐÚNG màn - cùng lý do TC_7 (zone rỗng + đã bị test nhầm màn "Giao bài tập" ' +
          "trong smoke test trước, không tính là đã hoàn thành).",
      );
    });

    test("TC_14: hiển thị Danh sách học sinh đã nộp bài có điểm trùng nhau", async () => {
      test.skip(
        true,
        "BLOCKED VĨNH VIỄN với fixture hiện tại - cần ≥2 học sinh có điểm bằng nhau; lớp chỉ định " +
          "chỉ có 1 học sinh, không thể tạo ra tình huống 'trùng điểm giữa 2 học sinh' (giới hạn cố " +
          "hữu của fixture).",
      );
    });

    test("TC_15: hiển thị điểm số Danh sách học sinh đã nộp bài - TH làm 1 bài nhiều lần", async () => {
      test.skip(
        true,
        'BLOCKED - zone "Thống kê bài làm"/"Danh sách đã nộp" đang rỗng (cùng lý do TC_4). CÓ ỨNG ' +
          "VIÊN SẴN trong fixture khi dữ liệu lên: room 90a94466 ('Rearrange the words to make a " +
          "correct sentence. Choose the correct order.', hạn 11/09/2026) đã làm lại 1 lần " +
          "(2/10 -> 10/10 full, xem test_data/historical_activity_log.md dòng ~355-367) - dự kiến " +
          "TESTABLE từ 2026-09-12, ưu tiên revisit case này trước các case Module I khác.",
      );
    });

    test("TC_16: hiển thị Phổ điểm", async () => {
      test.skip(
        true,
        "BLOCKED - cùng lý do TC_4 (zone rỗng, cần dữ liệu từ 2026-09-12) + case gốc đã đánh giá " +
          "Hard (biểu đồ/canvas) - cần khảo sát DOM/API riêng cho biểu đồ này trước khi tự động " +
          "hoá dù có dữ liệu.",
      );
    });

    test("TC_17: hiển thị Biểu đồ phân tích lỗi sai", async () => {
      test.skip(
        true,
        "BLOCKED - cùng lý do TC_16 (zone rỗng + Hard/biểu đồ, cần khảo sát DOM/API riêng).",
      );
    });

    test("TC_18: hiển thị số câu zone Biểu đồ phân tích lỗi sai - TH câu hỏi nhóm", async () => {
      test.skip(
        true,
        "BLOCKED - cùng lý do TC_16 (zone rỗng); ngoài ra CHƯA xác nhận bài tập nào trong fixture " +
          "có câu hỏi dạng NHÓM (group question) - cần kiểm tra thêm qua CMS khi có dữ liệu.",
      );
    });

    test("TC_19: hiển thị và chọn câu hỏi zone Biểu đồ phân tích lỗi sai", async () => {
      test.skip(true, "BLOCKED - cùng lý do TC_16 (zone rỗng + Hard/biểu đồ).");
    });

    test("TC_20: hiển thị focus câu hỏi sai nhiều nhất - Biểu đồ phân tích lỗi sai", async () => {
      test.skip(
        true,
        "BLOCKED - cùng lý do TC_16 (zone rỗng, cần dữ liệu từ 2026-09-12). KHÔNG bị chặn thêm bởi " +
          "giới hạn 1-học-sinh của fixture (khái niệm 'câu sai nhiều nhất' so sánh GIỮA CÁC CÂU HỎI " +
          "cho 1 học sinh, không cần nhiều học sinh) - dự kiến TESTABLE từ 2026-09-12 nếu cấu trúc " +
          "biểu đồ cho phép đọc qua DOM (cần khảo sát thêm, xem TC_16/17).",
      );
    });

    test("TC_21: hiển thị Nội dung câu hỏi (sau khi chọn 1 câu ở Biểu đồ lỗi sai)", async () => {
      test.skip(true, "BLOCKED - cùng lý do TC_19 (cần chọn được 1 câu hỏi có dữ liệu trước).");
    });

    test("TC_24: hiển thị danh sách Học sinh làm đúng", async () => {
      test.skip(true, "BLOCKED - cùng lý do TC_4 (zone rỗng, cần dữ liệu từ 2026-09-12).");
    });

    test("TC_25: hiển thị màn Báo cáo lớp Bài tập về nhà - TH chưa có dữ liệu học sinh làm bài", async () => {
      test.skip(
        true,
        "BLOCKED - cần 1 bài tập ĐÃ hiển thị trên report (đã qua hạn nộp) nhưng CHƯA có học sinh " +
          "nào nộp. Học sinh duy nhất của lớp chỉ định ('QA Report Test') đã hoàn thành/làm lại " +
          "TẤT CẢ room hiện biết trong test_data/historical_activity_log.md (không có room nào bị " +
          "bỏ dở) - fixture hiện KHÔNG có sẵn trạng thái này, kể cả sau 2026-09-12 khi các room qua " +
          "hạn nộp (chúng sẽ hiện với TRẠNG THÁI ĐÃ HOÀN THÀNH, không phải 'chưa ai làm'). Cần 1 " +
          "room mới được giao mà cố tình để trống (không cho học sinh làm), hoặc xác nhận với user " +
          "nếu có room nào khác trong lớp thoả điều kiện này.",
      );
    });
  },
);
