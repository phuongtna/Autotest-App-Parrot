import { test, expect } from "../../../../../automation/giao_bai_tap/playwrightTest.js";
import { config } from "../../../../../automation/src/config.js";
import { teacherPortalPageObjects as po } from "../../../../../automation/giao_bai_tap/navigation/teacherPortalPageObjects.js";
import {
  gotoReportHomeworkTab,
  switchReportClass,
  gotoClassSummaryTab,
  openSemesterDropdownAndReadOptions,
  readOverviewCards,
  resultSortSelect,
  attendanceSortSelect,
  readNativeSelect,
  readResultTable,
  readAttendanceTable,
  openNhapDiemPopup,
  closeNhapDiemPopup,
  readNhapDiemPopupContent,
} from "../../../../../automation/giao_bai_tap/navigation/reportClassSummaryPageObjects.js";

/**
 * Playwright Test THẬT (`cd automation && npx playwright test --config=playwright.report.config.js`,
 * hoặc `npm run test-bao-cao-hoc-tap-pw`) - lát cắt Module II "Tổng kết lớp" (Học kỳ I) của kế
 * hoạch automation "Báo cáo học tập". Dựa trên + đối chiếu lại
 * `flows/web/teacher/testcases/bao-cao-hoc-tap/TEST-CASES-tong-ket-lop.md` (TK-01..TK-13, viết
 * cùng ngày 2026-09-10, đã có bằng chứng thật cho 1 số control) + mapping ngược về TC_ID gốc của
 * kế hoạch 85 case. CHỈ 9 case PASS được, phần còn lại BLOCKED - lý do cụ thể ghi ở từng case
 * (`test.skip()`), theo ĐÚNG yêu cầu "không đoán/không làm yếu assertion khi fixture chưa thoả".
 *
 * FIXTURE DUY NHẤT (KHÔNG tạo lớp/học sinh mới, KHÔNG mutate dữ liệu production, KHÔNG nhập điểm):
 * lớp CHỈ ĐỊNH SẴN `7QA-Test-20260909_085649` (class_id `4d423639-8c35-4194-9c10-8e76bb092f08`),
 * tài khoản GV `0912312312` ("Phương"), 1 học sinh "QA Report Test".
 *
 * XÁC NHẬN QUYẾT ĐỊNH (2026-09-10, network log thật của `reportClassSummaryDiscovery.mjs`):
 * `GET /api/scores?...&semester=2` trả `classAvg.bt2Avg=0` + `industryStats[0]` toàn 0 cho lớp
 * này - XÁC NHẬN THẬT (không suy đoán) lớp KHÔNG có dữ liệu Học kỳ II. Mọi case cần dữ liệu Học kỳ
 * II hoặc cần "Nhập điểm" thật (thuộc phase Import điểm, ngoài phạm vi) đều BLOCKED thật sự, không
 * phải do chưa khảo sát đủ.
 *
 * TC_43/TC_44 (thứ tự bảng khi chưa có điểm/trùng điểm): KHÔNG lock hành vi alphabet - đã có quan
 * sát THẬT trái ngược mô tả docx trên lớp KHÁC (3B, xem TK-07 trong TEST-CASES-tong-ket-lop.md) -
 * NEEDS_CONFIRMATION với PO/dev trước khi viết assertion cho hành vi sort thật, NGOÀI RA lớp chỉ
 * định chỉ có 1 học sinh nên dù có xác nhận cũng không tự thoả được điều kiện "sort giữa nhiều HS".
 *
 * TC_58/TC_59 (bản "Tổng kết năm học" của cùng câu hỏi sort): NGOÀI PHẠM VI file này - tab "Tổng
 * kết năm học" CHƯA được khảo sát/xác nhận (TEST-CASES-tong-ket-lop.md tự nêu rõ "CHƯA làm").
 */
test.describe.serial(
  'Báo cáo học tập > Tổng kết lớp (Học kỳ I) - lớp chỉ định "7QA-Test-20260909_085649" (đọc, không sửa dữ liệu)',
  () => {
    const TARGET_CLASS_NAME = "7QA-Test-20260909_085649";
    const STUDENT_NAME = "QA Report Test";

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
      await switchReportClass(page, TARGET_CLASS_NAME);
      await gotoClassSummaryTab(page);
    });

    test.afterAll(async () => {
      await context?.close();
    });

    test("TC_26: hiển thị tổng thể màn Báo cáo lớp Tổng kết học kỳ", async () => {
      await expect(page.getByText("Báo cáo lớp", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Bài tập về nhà", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Tổng kết lớp", { exact: true }).first()).toBeVisible();

      const cards = await readOverviewCards(page);
      expect(cards.diemTbCuoiKy).not.toBeNull();
      expect(cards.diemTbGiuaKy).not.toBeNull();
      expect(cards.diemTbBaiTap).not.toBeNull();

      const resultTable = await readResultTable(page, STUDENT_NAME);
      expect(resultTable.headers).toEqual([
        "TÊN HỌC SINH",
        "ĐIỂM 15'(1)",
        "ĐIỂM 15'(2)",
        "ĐIỂM 15'(3)",
        "ĐIỂM 15'(4)",
        "THI GIỮA KỲ",
        "THI CUỐI KỲ",
        "ĐIỂM TB",
        "XẾP HẠNG",
      ]);

      const attendanceTable = await readAttendanceTable(page, STUDENT_NAME);
      expect(attendanceTable.headers).toEqual([
        "TÊN HỌC SINH",
        "BÀI TẬP CÔ GIAO",
        "BÀI TỰ HỌC",
        "THỜI GIAN HỌC",
      ]);
    });

    test("TC_27: hiển thị và thao tác droplist danh sách học kỳ", async () => {
      const { currentLabel, visibleOptions } = await openSemesterDropdownAndReadOptions(page);
      expect(currentLabel).toBe("Học kỳ I");
      expect(visibleOptions.sort()).toEqual(["Cả năm", "Học kỳ I", "Học kỳ II"].sort());
    });

    test("TC_28: droplist học kỳ default focus Học kỳ II khi có dữ liệu", async () => {
      test.skip(
        true,
        "BLOCKED - cần lớp có dữ liệu điểm Học kỳ II để kiểm tra nhánh default-focus-kỳ-II. " +
          "Xác nhận THẬT qua network log GET /api/scores?...&semester=2 (2026-09-10): lớp chỉ định " +
          "có classAvg.bt2Avg=0 và industryStats toàn 0 - KHÔNG có dữ liệu Học kỳ II. Đây cũng là " +
          "khu vực từng có bug ID2080 (không tự động focus Học kỳ II khi có dữ liệu) - ưu tiên " +
          "revisit khi có lớp/kỳ dữ liệu phù hợp.",
      );
    });

    test("TC_29: hiển thị zone Tổng quát (TH chưa có dữ liệu điểm)", async () => {
      const cards = await readOverviewCards(page);
      expect(cards.diemTbCuoiKy).toBe("-");
      expect(cards.diemTbGiuaKy).toBe("-");
      expect(cards.diemTbBaiTap).toBe("-");
    });

    test("TC_30: hiển thị cột Điểm TB cuối kỳ (giá trị theo công thức)", async () => {
      test.skip(
        true,
        'BLOCKED - cần điểm "Thi cuối kỳ" thật đã nhập qua chức năng Nhập điểm để đối chiếu công ' +
          "thức trung bình cộng - lớp chỉ định hiện chưa có đầu điểm nào (cột hiện toàn '-'), và " +
          "Nhập điểm thuộc phase Import điểm (ngoài phạm vi Module II, không được seed dữ liệu).",
      );
    });

    test("TC_31: hiển thị cột Điểm TB giữa kỳ (giá trị theo công thức)", async () => {
      test.skip(true, "BLOCKED - cùng lý do TC_30 (cần điểm 'Thi giữa kỳ' thật qua Nhập điểm).");
    });

    test("TC_32: hiển thị cột Điểm TB bài tập (giá trị theo công thức, phụ thuộc ngày)", async () => {
      test.skip(
        true,
        'BLOCKED - card "ĐIỂM TB BÀI TẬP" phụ thuộc bài tập ĐÃ QUA HẠN NỘP trong kỳ (cùng dữ liệu ' +
          "nguồn với Module I) - cả 6 room thật của lớp chỉ định đều CHƯA qua hạn nộp (3 room hạn " +
          "11/09/2026, 3 room hạn 16/09/2026; quy tắc hiển thị từ ngày hôm sau hạn nộp). Dự kiến " +
          "testable từ 2026-09-12 (khớp TK-02 trong TEST-CASES-tong-ket-lop.md, cũng đang 'chưa " +
          "chạy được' vì lý do này).",
      );
    });

    test("TC_33: so sánh Kỳ II/Kỳ I - TH CÓ chênh lệch", async () => {
      test.skip(
        true,
        "BLOCKED - cần dữ liệu điểm ở CẢ Học kỳ I và Học kỳ II (khác nhau) để so sánh - lớp chỉ " +
          "định KHÔNG có dữ liệu Học kỳ II (xác nhận thật qua API, xem ghi chú đầu file) và Học kỳ " +
          "I cũng chưa có Nhập điểm thật.",
      );
    });

    test("TC_34: so sánh Kỳ II/Kỳ I - TH KHÔNG có chênh lệch", async () => {
      test.skip(true, "BLOCKED - cùng lý do TC_33 (cần dữ liệu điểm ở cả 2 kỳ).");
    });

    test("TC_35: hiển thị droplist Sắp xếp (Kết quả học tập)", async () => {
      const { currentValue, options } = await readNativeSelect(resultSortSelect(page));
      expect(currentValue).toBe("avg");
      expect(options).toEqual([
        { value: "avg", text: "Điểm trung bình" },
        { value: "tx1", text: "Điểm 15'(1)" },
        { value: "tx2", text: "Điểm 15'(2)" },
        { value: "tx3", text: "Điểm 15'(3)" },
        { value: "tx4", text: "Điểm 15'(4)" },
        { value: "gk", text: "Thi giữa kỳ" },
        { value: "ck", text: "Thi cuối kỳ" },
      ]);
    });

    test("TC_36: hiển thị và thao tác droplist Sắp xếp (ảnh hưởng bảng)", async () => {
      test.skip(
        true,
        "BLOCKED - đổi tiêu chí sắp xếp chỉ có ý nghĩa kiểm chứng khi có ≥1 học sinh có điểm phân " +
          "biệt được theo tiêu chí đó; toàn bộ cột điểm của lớp chỉ định hiện là '-' (chưa Nhập " +
          "điểm) - đổi sắp xếp trên dữ liệu toàn rỗng không kiểm tra được hành vi thật, KHÔNG viết " +
          "assertion yếu (vd chỉ check dropdown đóng lại) để thay thế.",
      );
    });

    test("TC_37: hiển thị và thao tác button Nhập điểm (mở/đóng popup, không nhập file)", async () => {
      await openNhapDiemPopup(page);
      const popupContent = await readNhapDiemPopupContent(page);
      expect(popupContent.hasDownloadTemplateButton).toBe(true);
      expect(popupContent.hasCancelButton).toBe(true);
      expect(popupContent.hasSubmitButton).toBe(true);
      await closeNhapDiemPopup(page);
    });

    test("TC_38: hiển thị Bảng kết quả học tập", async () => {
      const table = await readResultTable(page, STUDENT_NAME);
      expect(table.headers).toHaveLength(9);
      expect(table.headers).toContain("XẾP HẠNG");
      expect(table.rowCells).not.toBeNull();
      expect(table.rowCells[0]).toBe(STUDENT_NAME);
      expect(table.rowCells).toHaveLength(9);
    });

    test("TC_39: hiển thị Bảng kết quả học tập cột Điểm TB (giá trị)", async () => {
      test.skip(
        true,
        "BLOCKED - cần dữ liệu điểm thật đã Nhập điểm để đối chiếu công thức hệ số 1/2/3 - cột " +
          "hiện toàn '-' (chưa có đầu điểm nào).",
      );
    });

    test("TC_40: hiển thị Bảng kết quả học tập cột Xếp hạng (giá trị/thứ tự)", async () => {
      test.skip(
        true,
        "BLOCKED - TK-05 (TEST-CASES-tong-ket-lop.md) đã xác nhận CỘT XẾP HẠNG TỒN TẠI trong DOM " +
          "(xem TC_38 ở trên) nhưng kiểm tra GIÁ TRỊ/thứ tự xếp hạng cần dữ liệu điểm thật - cột " +
          "hiện toàn '-' cho học sinh duy nhất của lớp, không có gì để xếp hạng.",
      );
    });

    test("TC_41: hiển thị phân trang Bảng kết quả học tập", async () => {
      const table = await readResultTable(page, STUDENT_NAME);
      expect(table.paginationText).toBe("Hiển thị 1–1 trên tổng số 1 học sinh");
    });

    test("TC_42: thao tác chọn phân trang Bảng kết quả học tập", async () => {
      test.skip(
        true,
        "BLOCKED VĨNH VIỄN với fixture hiện tại - cần ≥2 trang (thường ≥11 học sinh, bảng hiển thị " +
          "10 HS/trang theo docx) để có nút chuyển trang; lớp chỉ định chỉ có 1 học sinh, không có " +
          "nút số trang nào để thao tác (giới hạn cố hữu của fixture).",
      );
    });

    test("TC_43: hiển thị danh sách HS Bảng kết quả học tập - TH chưa có dữ liệu điểm (thứ tự)", async () => {
      test.skip(
        true,
        "BLOCKED + NEEDS_CONFIRMATION - KHÔNG lock hành vi 'sắp xếp theo alphabet' như docx mô tả: " +
          "TK-07 (TEST-CASES-tong-ket-lop.md) đã quan sát THẬT trên lớp 3B (6 học sinh) rằng thứ tự " +
          "thật KHÔNG phải alphabet ('Hang, Gia Linh, Ngoc, Nguyệt, Minh Thien, Hanh vy' thay vì " +
          "'Gia Linh, Hang, Hanh vy, Minh Thien, Ngoc, Nguyệt') - CHƯA có xác nhận từ dev/PO đây là " +
          "bug hay tiêu chí sort khác (vd thứ tự tham gia lớp). Ngoài ra lớp CHỈ ĐỊNH cho Module II " +
          "chỉ có 1 học sinh - dù có xác nhận hành vi đúng, fixture này KHÔNG BAO GIỜ tự thoả được " +
          "điều kiện 'nhiều học sinh, chưa có điểm' để kiểm tra thứ tự có ý nghĩa (giới hạn cố hữu, " +
          "không phải vấn đề ngày/dữ liệu bài tập).",
      );
    });

    test("TC_44: hiển thị danh sách HS Bảng kết quả học tập - TH có HS bằng điểm nhau", async () => {
      test.skip(
        true,
        "BLOCKED VĨNH VIỄN với fixture hiện tại - cần ≥2 học sinh có điểm bằng nhau để kiểm tra " +
          "tie-break theo tên; lớp chỉ định chỉ có 1 học sinh (giới hạn cố hữu của fixture). Cùng " +
          "lưu ý NEEDS_CONFIRMATION về tiêu chí sort thật như TC_43 (nếu tie-break cũng theo tên, " +
          "áp dụng đúng quan sát chưa xác nhận của TK-07).",
      );
    });

    test("TC_45: hiển thị droplist Sắp xếp bảng chuyên cần", async () => {
      const { currentValue, options } = await readNativeSelect(attendanceSortSelect(page));
      expect(currentValue).toBe("homework");
      expect(options).toEqual([
        { value: "homework", text: "Bài tập cô giao" },
        { value: "self_study", text: "Bài tự học" },
        { value: "time", text: "Thời gian học" },
      ]);
    });

    test("TC_46: hiển thị Bảng chuyên cần", async () => {
      const table = await readAttendanceTable(page, STUDENT_NAME);
      expect(table.headers).toHaveLength(4);
      expect(table.rowCells).not.toBeNull();
      expect(table.rowCells[0]).toBe(STUDENT_NAME);
      // Format-level assertion (KHÔNG hardcode giá trị thật, vì "Bài tập cô giao"/"Thời gian học"
      // biến động theo thời gian thật/cadence - chỉ xác nhận ĐÚNG ĐỊNH DẠNG hiển thị, tránh vừa
      // hardcode số dễ vỡ vừa không phải là điều case này thật sự cần kiểm tra (đó là TC_47/TC_49).
      expect(table.rowCells[1]).toMatch(/^\d+\s*\/\s*\d+$/); // Bài tập cô giao: x/y
      expect(table.rowCells[2]).toMatch(/^\d+$/); // Bài tự học: số nguyên
      expect(table.rowCells[3]).toMatch(/^\d+\s*giờ$/); // Thời gian học: "N giờ"
    });

    test("TC_47: hiển thị Bảng chuyên cần cột Bài tập cô giao (công thức x/y theo hạn nộp)", async () => {
      test.skip(
        true,
        "BLOCKED - kiểm tra ĐÚNG CÔNG THỨC (x = số bài đã hoàn thành có hạn nộp trong kỳ, y = tổng " +
          "số bài được giao có hạn nộp trong kỳ) cần ≥1 room đã QUA HẠN NỘP - cả 6 room thật của " +
          "lớp chỉ định đều CHƯA qua hạn nộp (cùng lý do TC_32). Giá trị hiện tại '0/0' đúng nhưng " +
          "KHÔNG kiểm chứng được công thức (mọi vế đều 0). TC_46 đã xác nhận định dạng x/y hiển thị " +
          "đúng - dự kiến verify được công thức thật từ 2026-09-12.",
      );
    });

    test("TC_48: hiển thị Bảng chuyên cần cột Bài tự học", async () => {
      test.skip(
        true,
        "NOT IMPLEMENTED - case Todo trong kế hoạch gốc (chưa từng chạy tay để xác nhận Expected " +
          "Result trước khi automation, khác nhóm 'BLOCKED vì thiếu dữ liệu' của các case khác " +
          "trong file này) - giữ nguyên phân loại Phase 3 của kế hoạch, ngoài phạm vi lát cắt này.",
      );
    });

    test("TC_49: hiển thị Bảng chuyên cần cột Thời gian học (công thức, phụ thuộc ngày)", async () => {
      test.skip(
        true,
        "BLOCKED - kiểm tra ĐÚNG CÔNG THỨC (ceil(tổng giây đăng nhập app / 3600)) cần dựng lại độc " +
          "lập tổng thời gian đăng nhập thật từ log để đối chiếu - TK-09 (TEST-CASES-tong-ket-lop.md) " +
          "đã thử làm việc này thủ công và phát hiện lệch ~9.4% CHƯA giải thích được giữa số dựng " +
          "lại và study_time API trả về (dù cả 2 làm tròn ra cùng kết quả hiển thị) - method luận " +
          "verify công thức này CHƯA đủ tin cậy để tự động hoá, cần chờ TK-09 kết luận trước (dự " +
          "kiến có thêm 1 điểm dữ liệu sạch để so sánh từ 2026-09-11). TC_46 đã xác nhận định dạng " +
          "'N giờ' hiển thị đúng - đây chỉ là phần công thức/giá trị còn thiếu.",
      );
    });
  },
);
