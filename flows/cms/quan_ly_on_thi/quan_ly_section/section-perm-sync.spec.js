import { test } from "../../../../automation/quan_ly_section/playwrightTest.js";

/**
 * Nhóm "5. Phân quyền truy cập" (PERM-01) và "6. Đồng bộ dữ liệu Section sang Kỳ thi / Đề thi"
 * (SYNC-01..07) của `flows/cms/quan_ly_on_thi/quan_ly_section/TESTCASES.md`.
 *
 * TOÀN BỘ case trong file này CHỦ ĐỘNG BỎ QUA (`test.skip`) - liệt kê đích danh ở đây (thay vì bỏ
 * hẳn khỏi bộ test) để giữ TRUY XUẤT ĐẦY ĐỦ 64 case ID gốc trong 1 lần chạy `npx playwright test`
 * (report sẽ hiện "skipped" kèm lý do, không bị lẫn với "không có case này").
 *
 * Lý do bỏ qua:
 *   - PERM-01: cần 1 tài khoản CMS KHÔNG có quyền Admin - chưa có tài khoản như vậy được cấu hình
 *     cho module này (`.env` hiện chỉ có `CMS_USERNAME_DEV`/`CMS_PASSWORD_DEV` - tài khoản Admin).
 *   - SYNC-01..07: cần thao tác qua lại giữa `/exam-prep/sections` và màn "Ngân hàng đề thi"/"Quản
 *     lý kỳ thi" (API/UI khác hẳn, CHƯA có page objects) - ngoài phạm vi yêu cầu tự động hoá lần
 *     này (chỉ `/exam-prep/sections`). TESTCASES.md ghi nhận cả 7 case đã chạy tay Pass 2026-10-19.
 *     Muốn tự động hoá đầy đủ, cần viết thêm `automation/ngan_hang_de_thi/` +
 *     `automation/quan_ly_ky_thi/` tương tự module này rồi mới nối lại được.
 */

test.describe("Quản lý Section - 5. Phân quyền truy cập (PERM-01)", () => {
  test.skip(
    "PERM-01: tài khoản không có quyền Admin CMS truy cập menu Quản lý Section - BỎ QUA: chưa có tài khoản CMS non-Admin được cấu hình cho module này",
    () => {},
  );
});

test.describe("Quản lý Section - 6. Đồng bộ dữ liệu Section sang Kỳ thi / Đề thi (SYNC-01..07)", () => {
  test.skip(
    "SYNC-01: Section mới tạo hiển thị ngay trong dropdown chọn Section ở Đề thi - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "SYNC-02: Section mới tạo hiển thị ngay trong dropdown chọn Section ở Kỳ thi - BỎ QUA: cần màn Quản lý kỳ thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "SYNC-03: sửa Tên phần thi của Section đã gắn Đề thi -> Đề thi hiển thị đúng tên mới - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "SYNC-04: sửa Kỹ năng của Section đã gắn Đề thi -> Đề thi hiển thị đúng kỹ năng mới - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "SYNC-05: sửa Tên/Kỹ năng của Section đã gắn Kỳ thi -> Kỳ thi hiển thị đúng dữ liệu mới - BỎ QUA: cần màn Quản lý kỳ thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "SYNC-06: Section bị xóa biến mất sạch khỏi cấu trúc Đề thi đang tham chiếu - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "SYNC-07: Section bị xóa biến mất sạch khỏi cấu trúc Kỳ thi đang tham chiếu - BỎ QUA: cần màn Quản lý kỳ thi (ngoài phạm vi)",
    () => {},
  );
});
