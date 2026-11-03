import { test } from "../../../../automation/quan_ly_ky_thi/playwrightTest.js";

/**
 * Nhóm "5. Phân quyền truy cập" (PERM-01) và "6. Đồng bộ dữ liệu Kỳ thi ↔ Section, Bảng điểm, Đề
 * thi" (SYNC-01..07) của `flows/cms/quan_ly_on_thi/quan_ly_ky_thi/TESTCASES.md`.
 *
 * TOÀN BỘ case trong file này CHỦ ĐỘNG BỎ QUA (`test.skip`) - liệt kê đích danh ở đây (thay vì bỏ
 * hẳn khỏi bộ test) để giữ TRUY XUẤT ĐẦY ĐỦ toàn bộ case ID gốc trong 1 lần chạy
 * `npx playwright test` (report sẽ hiện "skipped" kèm lý do, không bị lẫn với "không có case này") -
 * cùng quy ước `section-perm-sync.spec.js`/`score-table-perm-sync.spec.js`.
 *
 * Lý do bỏ qua:
 *   - PERM-01: cần 1 tài khoản CMS KHÔNG có quyền Admin - chưa có tài khoản như vậy được cấu hình
 *     cho module này (`.env` hiện chỉ có `CMS_USERNAME_DEV`/`CMS_PASSWORD_DEV` - tài khoản Admin).
 *   - SYNC-01..07: cần thao tác qua lại giữa `/exam-prep/exam-types` và màn "Ngân hàng đề thi" (nơi
 *     Admin thực sự chọn Kỳ thi khi tạo Đề thi, nhận cấu trúc đề xuất, lọc Bảng điểm theo Dạng quy
 *     đổi) - CHƯA có page objects cho màn đó, ngoài phạm vi yêu cầu tự động hoá lần này (chỉ
 *     `/exam-prep/exam-types`). `TESTCASES.md`/`qlykythi.xlsx` ghi nhận: SYNC-01,02,03,05,06,07 đã
 *     chạy tay Pass; SYNC-04 "Pending" (Dạng quy đổi hiện chỉ có 1 giá trị, chưa tạo được điều kiện
 *     khác biệt). Muốn tự động hoá đầy đủ, cần viết thêm `automation/ngan_hang_de_thi/` rồi mới nối
 *     lại được (cùng ghi chú đã để lại ở `section-perm-sync.spec.js`/`score-table-perm-sync.spec.js`).
 */

test.describe("Quản lý kỳ thi - 5. Phân quyền truy cập (PERM-01)", () => {
  test.skip(
    "PERM-01: tài khoản không có quyền Admin CMS truy cập menu Quản lý kỳ thi - BỎ QUA: chưa có tài khoản CMS non-Admin được cấu hình cho module này",
    () => {},
  );
});

test.describe("Quản lý kỳ thi - 6. Đồng bộ dữ liệu Kỳ thi ↔ Section, Bảng điểm, Đề thi (SYNC-01..07)", () => {
  test.skip(
    "SYNC-01: Section mới tạo/sửa ở Quản lý Section phản ánh đúng trong droplist 'Cấu hình đề xuất' - BỎ QUA: cần kiểm chứng cross-module live (ngoài phạm vi tách biệt theo module của lần tự động hoá này, dù cùng dùng chung cmsKyThiPageObjects)",
    () => {},
  );
  test.skip(
    "SYNC-02: Tạo Đề thi và chọn Kỳ thi -> cấu trúc đề xuất đúng theo Cấu hình đề xuất hiện tại - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "SYNC-03: Cấu trúc đề xuất chỉ là gợi ý - người tạo đề vẫn sửa được riêng - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "SYNC-04: Tạo Đề thi và chọn Kỳ thi -> dropdown Bảng điểm chỉ liệt kê đúng Dạng quy đổi của Kỳ thi - BỎ QUA: cần màn Ngân hàng đề thi; hiện tại Dạng quy đổi chỉ có 1 giá trị nên cũng chưa thể tạo điều kiện khác biệt (TESTCASES.md ghi 'Pending')",
    () => {},
  );
  test.skip(
    "SYNC-05: Dropdown Bảng điểm mặc định chọn bảng điểm được TẠO ĐẦU TIÊN cùng Dạng quy đổi - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "SYNC-06: Đổi Kỳ thi đang chọn khi tạo Đề thi -> cấu trúc gợi ý và danh sách Bảng điểm làm mới hoàn toàn - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "SYNC-07: Kỳ thi bị xóa không còn xuất hiện trong dropdown chọn Kỳ thi ở màn Tạo mới Đề thi - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
});
