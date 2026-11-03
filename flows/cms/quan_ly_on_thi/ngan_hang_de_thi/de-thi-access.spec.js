import { test } from "../../../../automation/ngan_hang_de_thi/playwrightTest.js";

/**
 * Nhóm "9. Phân quyền Free/Pro & giao đề (AC)" (ACCESS-01..07) - TOÀN BỘ CHỦ ĐỘNG BỎ QUA.
 *
 * Cả 7 case đều yêu cầu đăng nhập APP DI ĐỘNG bằng tài khoản học sinh thật (Free/Pro/Dùng thử) để
 * mở đề hoặc yêu cầu luồng giáo viên giao đề cho học sinh (module "giao bài tập", KHÁC CMS web
 * admin "Ngân hàng đề thi" đang viết automation ở đây) - đúng tinh thần "case liên quan app học
 * sinh chưa viết vội" đã thống nhất khi bắt đầu viết automation cho module này.
 *
 * Khi cần viết automation cho nhóm này, tham khảo:
 *   - ACCESS-01..04 (user Free/Pro/Dùng thử mở đề Free/Pro): cần automation phía app di động
 *     (ngoài phạm vi Playwright CMS hiện tại của repo) hoặc automation web app nếu có.
 *   - ACCESS-05..07 (giáo viên giao đề cho học sinh theo gói Free/Pro): rule "giống module giao
 *     bài tập" theo chính ghi chú trong `TESTCASES.xlsx` - có thể tái sử dụng page object của
 *     `flows/web/giao_bai_tap/giao_de_luyen_tap/` làm điểm khởi đầu khi triển khai.
 */
test.describe("Ngân hàng đề thi - 9. Phân quyền Free/Pro & giao đề (ACCESS-01..07)", () => {
  test.skip("ACCESS-01: User Free làm đề Hình thức = Free - BỎ QUA: cần app di động + tài khoản học sinh thật", () => {});
  test.skip("ACCESS-02: User Free làm đề Hình thức = Pro - BỎ QUA: cần app di động + tài khoản học sinh thật", () => {});
  test.skip("ACCESS-03: User Pro làm đề Hình thức = Pro - BỎ QUA: cần app di động + tài khoản học sinh thật", () => {});
  test.skip("ACCESS-04: User Dùng thử (Trial) làm đề Hình thức = Pro - BỎ QUA: cần app di động + tài khoản học sinh thật", () => {});
  test.skip("ACCESS-05: Giáo viên giao đề Free cho học sinh Free - BỎ QUA: cần luồng giao bài tập + app học sinh thật", () => {});
  test.skip("ACCESS-06: Giáo viên giao đề Pro cho học sinh Free - BỎ QUA: cần luồng giao bài tập + app học sinh thật", () => {});
  test.skip("ACCESS-07: Giáo viên giao đề Pro cho học sinh Pro/Dùng thử - BỎ QUA: cần luồng giao bài tập + app học sinh thật", () => {});
});
