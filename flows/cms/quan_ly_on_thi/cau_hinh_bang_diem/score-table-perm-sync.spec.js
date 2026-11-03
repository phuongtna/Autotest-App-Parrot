import { test } from "../../../../automation/cau_hinh_bang_diem/playwrightTest.js";

/**
 * Nhóm "5. Phân quyền truy cập" (PERM-01) + "6. Đồng bộ dữ liệu Bảng điểm sang Đề thi"
 * (SYNC-01..05) - TOÀN BỘ `test.skip` stub, giữ lại CHỈ để đủ 44 ID trong 1 lần chạy báo cáo
 * `npx playwright test`, cùng quy ước với `section-perm-sync.spec.js`.
 *
 * Lý do bỏ qua:
 * - PERM-01: cần 1 tài khoản CMS KHÔNG có quyền Admin để thử truy cập - tài khoản dev hiện tại
 *   (`CMS_USERNAME_DEV`) là tài khoản Admin duy nhất có sẵn trên môi trường, automation không tự
 *   tạo tài khoản phân quyền khác.
 * - SYNC-01..05: cần màn "Ngân hàng đề thi" (nơi thực sự gắn Bảng điểm vào Đề thi) - MÀN KHÁC,
 *   ngoài phạm vi `/exam-prep/score-tables` mà automation module này bao phủ.
 *
 * `cauhinhbangdiem.xlsx` ghi nhận PERM-01/SYNC-01..04 đã chạy tay Pass (2026-11-03); riêng SYNC-05
 * (tính điểm cuối cùng theo rule "Phổ thông" khi học sinh làm đề) ghi "Pending" - "Web chưa có để
 * check" (màn làm bài học sinh qua web chưa sẵn sàng tại thời điểm chạy tay).
 */

test.describe("Cấu hình bảng điểm - 5+6. Phân quyền truy cập & Đồng bộ dữ liệu (PERM-01, SYNC-01..05)", () => {
  test.skip(
    "PERM-01: tài khoản không có quyền Admin truy cập menu Cấu hình bảng điểm - BỎ QUA: cần tài khoản CMS phân quyền khác, automation không tự tạo được",
    () => {},
  );
  test.skip(
    "SYNC-01: Bảng điểm mới tạo hiển thị ngay trong dropdown chọn Bảng điểm ở Đề thi - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "SYNC-02: Đề thi chỉ cho chọn Bảng điểm có Dạng quy đổi KHỚP với Dạng quy đổi của Kỳ thi - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "SYNC-03: Sửa Tên Bảng điểm -> Đề thi hiển thị đúng tên mới - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "SYNC-04: Bảng điểm bị xóa không còn xuất hiện trong dropdown chọn ở Đề thi - BỎ QUA: cần màn Ngân hàng đề thi (ngoài phạm vi)",
    () => {},
  );
  test.skip(
    "SYNC-05: Điểm cuối cùng của học sinh được tính đúng theo rule 'Phổ thông' khi làm đề - BỎ QUA: Pending trong xlsx ('Web chưa có để check'), cần màn làm bài học sinh qua web",
    () => {},
  );
});
