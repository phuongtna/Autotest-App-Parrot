/**
 * Page Objects cho web Giáo viên (https://parrotedu.vn/teacher) - dùng bởi
 * runtime/assignHomeworkFlow.js (Playwright, KHÔNG phải Maestro - Maestro không điều khiển được
 * web, xem flows/giao_bai_tap/TESTCASES.md).
 *
 * NGUỒN text: lấy từ flows/giao_bai_tap/TESTCASES.md TC1 (ĐÃ XÁC NHẬN THẬT bằng thao tác tay
 * 2026-08-09, tài khoản GV "Phương") - các chuỗi text nút/tiêu đề dưới đây đúng với UI thật GV
 * đã thấy.
 *
 * ĐÃ CHẠY THẬT THÀNH CÔNG END-TO-END (2026-08-09, `npm run assign-homework`, tài khoản GV
 * "Phương", lớp 3B, hạn nộp 20/08/2026, Unit 1: Hello - Lesson 1 - "G3-U1-Lesson 1: Listen and
 * repeat"): toàn bộ selector/logic dưới đây (form login, checkbox chọn lớp, popover "Hạn nộp",
 * Radix Select "Chọn Unit", nút toggle "Chọn Lesson", checkbox "Danh sách bài tập", nút submit +
 * toast) đã xác nhận đúng qua debug screenshot/DOM dump thật - xem từng comment tại vị trí dùng
 * trong assignHomeworkFlow.js để biết chi tiết cấu trúc DOM thật của từng phần.
 */
export const teacherPortalPageObjects = {
  login: {
    path: "/teacher/login",
    usernameInput: 'input[type="text"], input[type="tel"], input[name="username"]',
    passwordInput: 'input[type="password"]',
    submitButton: "Đăng nhập",
  },

  menu: {
    // Menu "Giao bài tập" ở sidebar, sau đó bấm button cùng tên "Giao bài tập" để mở form tạo
    // mới (xem TESTCASES.md bước 2) - 2 node khác nhau dù trùng text, xử lý ở
    // assignHomeworkFlow.js (menu trước, button sau).
    menuItem: "Giao bài tập",
    createButton: "Giao bài tập",
  },

  // ĐÃ XÁC NHẬN THẬT (2026-08-09, debug screenshot trên trang thật): mỗi lớp là 1 <label> bọc 1
  // <input type="checkbox"> (ẩn, class "peer hidden") + 1 <span> chứa tên lớp. Lớp bị disable
  // (khối khác với lớp đã chọn) có checkbox.disabled = true - assignHomeworkFlow.js dùng xpath
  // "ancestor::label[1]//input[@type='checkbox']" từ text tên lớp để lấy đúng checkbox này, nên
  // không cần selector riêng ở đây.

  // ĐÃ XÁC NHẬN THẬT (2026-08-09, debug screenshot thật): field "Hạn nộp" KHÔNG phải input native
  // - là nút mở popover Radix hiển thị lịch chọn ngày (xem assignHomeworkFlow.js#setDueDate để
  // biết chi tiết cấu trúc popover: header "Tháng N", nút chuyển tháng, lưới số ngày).
  dueDate: {
    label: "Hạn nộp",
  },

  submit: {
    button: "Giao bài đã chọn",
    successToast: "Giao bài tập mới thành công",
  },

  assignedList: {
    // Danh sách "Bài tập đã giao" - dùng để đối chiếu tổng số dòng trước/sau khi giao (mục 6,
    // TC1: "tăng đúng 47 -> 48").
    sectionTitle: "Bài tập đã giao",
  },

  // ĐÃ XÁC NHẬN THẬT (2026-08-27, debug DOM dump thật trên tài khoản GV "Phương", xem
  // navigation/teacherAssignedListPageObjects.js để biết chi tiết cách dùng từng selector dưới
  // đây):
  //   - Mỗi dòng bảng "Bài tập đã giao" có cột "BÀI TẬP" là 1 <a href="/teacher/exercise/{id}/edit">
  //     - bấm vào TÊN bài chính là hành động "Sửa" (KHÔNG có nút "Sửa" riêng trên dòng).
  //   - Cột "HÀNH ĐỘNG" chỉ có 1 link text "Xem báo cáo" (= "Xem chi tiết" trong flow user mô tả),
  //     href "/teacher/exercise/{id}/report".
  //   - Trang "/edit" (breadcrumb "Chỉnh sửa bài tập"): MỌI field khác (Nguồn bài tập, Giao tới
  //     lớp, Chọn Unit/Lesson/Danh sách bài tập) đều bị disable - CHỈ "Hạn nộp" sửa được (đúng
  //     acceptance criteria "GV chỉ được phép chỉnh sửa hạn nộp"). Nút "Giao bài đã chọn" đóng vai
  //     trò Lưu. Nút xóa là icon-only cạnh "Hủy", `title="Xóa"`.
  //   - Bấm nút Xóa mở dialog xác nhận (role="dialog"): tiêu đề "Xóa bài tập", câu hỏi "Bạn có
  //     chắc chắn muốn xóa bài tập không?", 2 nút "Hủy"/"Xóa" (exact text - tránh bug đã gặp thật
  //     ở case khác: regex lỏng/index bấm nhầm text message thay vì nút, xem
  //     project_switch_profile_confirm_button_bug trong memory).
  editPage: {
    breadcrumb: "Chỉnh sửa bài tập",
    dueDateLabel: "Hạn nộp",
    saveButton: "Giao bài đã chọn",
    deleteIconButtonSelector: 'button[title="Xóa"]',
  },
  deleteConfirmDialog: {
    title: "Xóa bài tập",
    confirmButton: "Xóa",
    cancelButton: "Hủy",
  },
};
