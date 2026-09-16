/**
 * Page Objects cho field "Nguồn bài tập" mới ("Bộ sách Kết nối tri thức" / "Kho bài tập cá
 * nhân") trên form tạo "Giao bài tập" (Web GV) - TÁCH RIÊNG khỏi
 * automation/giao_bai_tap/navigation/teacherPortalPageObjects.js vì đây là module con của
 * tính năng "Kho bài tập cá nhân" (nguồn: TestCase_GiaoBaiTap_KhoBaiTapCaNhan.xlsx), không lẫn
 * vào page object dùng chung của "Giao bài tập".
 *
 * Dùng CHUNG với teacherPortalPageObjects.js (login, menu, submit...) qua import riêng ở nơi gọi
 * (xem runtime/sourceSelectorFlow.js) - file này CHỈ chứa selector đặc thù của "Nguồn bài tập".
 *
 * ĐÃ XÁC NHẬN THẬT (2026-09-16, debug DOM dump thật trên trang "Giao bài tập" tạo mới, tài khoản
 * GV "Phương", https://parrotedu.codeinet.com): field "Nguồn bài tập" là 1 radio group (2 <label>
 * bọc <input type="radio">, cùng pattern ẩn-qua-CSS như checkbox chọn lớp - xem comment "Giao tới
 * lớp" trong teacherPortalPageObjects.js). Radio "Bộ sách Kết nối tri thức" có value là UUID
 * book-set THẬT (đổi theo dữ liệu, vd "ad38c7e7-0817-4d78-b2f3-98fe65dde676") - KHÔNG dùng value
 * này để chọn, chọn qua label text. Radio "Kho bài tập cá nhân" có value CỐ ĐỊNH literal
 * `"__personal_bank__"` - ưu tiên dùng selector theo value này (ổn định tuyệt đối, không phụ
 * thuộc text hiển thị).
 *
 * Sau khi chọn nguồn + 1 lớp, khung "Chọn bài tập" bên phải có CÙNG cấu trúc cho cả 2 nguồn:
 * "Chọn Unit" (Radix Select) -> "Chọn Lesson" -> "Danh sách bài tập" (mỗi item 1
 * <button role="checkbox" id="lesson-item-{catalogItemId}">, xem
 * automation/giao_bai_tap/navigation/teacherAssignmentDiscovery.js). Khi CHƯA chọn lớp nào, khung
 * này chỉ hiện placeholder cho cả 2 nguồn (không có gì để chọn).
 *
 * Với hầu hết lớp, nguồn "Kho bài tập cá nhân" RỖNG (dropdown "Chọn Unit" không có option nào) -
 * dữ liệu thật phụ thuộc TỪNG tài khoản GV + TỪNG lớp cụ thể, không cố định 1 lớp nào trong code.
 */
export const sourcePageObjects = {
  groupLabel: "Nguồn bài tập",
  bookSetOptionText: "Bộ sách Kết nối tri thức",
  personalBankOptionText: "Kho bài tập cá nhân",
  personalBankRadioSelector: 'input[type="radio"][value="__personal_bank__"]',
  chooseExercisePlaceholder: "Thầy/cô hãy chọn lớp học trước để bắt đầu chọn bài tập",
  chooseUnitLabel: "Chọn Unit",
  chooseLessonLabel: "Chọn Lesson",
  assignmentListLabel: "Danh sách bài tập",

  // ĐÃ XÁC NHẬN THẬT (TestCase_GiaoBaiTap_KhoBaiTapCaNhan.xlsx TC_GBT_KBTCN_022, 2026-09-15):
  // bấm "Giao bài đã chọn" khi chưa tick bài nào -> cảnh báo màu đỏ hiện NGAY DƯỚI các tab Lesson,
  // không chuyển trang/không submit.
  emptySelectionWarningText: "Vui lòng chọn bài tập",
};
