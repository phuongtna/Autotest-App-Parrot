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
};
