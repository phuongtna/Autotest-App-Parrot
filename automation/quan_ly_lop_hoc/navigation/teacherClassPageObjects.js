/**
 * Page Objects cho màn "Lớp phụ trách" (https://parrotedu.vn/teacher/class) - dùng bởi
 * runtime/addClassFlow.js (Playwright, KHÔNG phải Maestro - Maestro không điều khiển được web,
 * xem flows/web/teacher/testcases/lop-phu-trach/them-moi.md).
 *
 * NGUỒN text/cấu trúc DOM: xác nhận thật qua thao tác tay bằng Claude Browser (Playwright-backed)
 * ngày 2026-08-17 và re-run 2026-08-20 (tài khoản GV "Phương") - xem
 * flows/web/teacher/testcases/lop-phu-trach/them-moi-tc-add-full.json để biết evidence đầy đủ
 * (request/response thật).
 *
 * ĐÃ XÁC NHẬN THẬT (2026-08-20, đọc DOM thật qua accessibility tree): popup "Thêm mới lớp học"
 * có 2 <select> native NẰM SAU 2 nút trigger dạng "combobox" tùy biến (Radix/tương tự) - set giá
 * trị thẳng vào <select> (KHÔNG cần click mở trigger trước) đã đủ để cả UI hiển thị lẫn state
 * form cập nhật đúng. Thứ tự DOM cố định: <select> đầu tiên = "Khối học", <select> thứ hai =
 * "Năm học" (không có <select> nào khác trong dialog).
 *
 * ĐÃ XÁC NHẬN THẬT (2026-08-20, 2 lượt `npm run add-class` headed thật): có 1 node DOM khác (nghi
 * skeleton/loading route ẩn) mang cố định text "Danh sách lớp học (0)" - scope locator vào "main"
 * KHÔNG ĐỦ để loại trừ node này (vẫn đọc nhầm ra "0" cho lần đọc trước khi thêm lớp, dù giá trị
 * thật đã ổn định từ lâu). navigation/classListCount.js đã đổi sang đếm số nhãn "Sĩ số:" (mỗi card
 * lớp thật có đúng 1 nhãn, node ẩn không có card nên không có nhãn này) thay vì parse text tiêu đề.
 *
 * ĐÃ XÁC NHẬN THẬT (2026-08-20, dọn dẹp lớp test thật bằng thao tác tay qua Claude Browser sau khi
 * debug addClassFlow.js): click card lớp trên "Lớp phụ trách" -> điều hướng client-side sang
 * `/teacher/class/:id` ("Chi tiết lớp") - trang này bắn 3 GET song song (`/api/classes/:id`,
 * `/students`, `/requests`); heading tên lớp CHỈ hiện đúng SAU khi cả 3 GET này resolve (trước đó
 * hiện placeholder "Chi tiết lớp") - PHẢI chờ heading "Lớp <tên>" thật hiện ra rồi mới bấm "Chỉnh
 * sửa lớp học", nếu bấm quá sớm (trong lúc cả trang mới điều hướng xong, GET còn đang chạy) các GET
 * này có thể bị hủy (net::ERR_ABORTED) và nút bấm không phản hồi. Nút "Xóa lớp học" nằm TRONG popup
 * "Chỉnh sửa thông tin lớp học" (KHÔNG phải "Chỉnh sửa lớp học" như tài liệu spec cũ suy đoán) -
 * bấm mở tiếp popup xác nhận "Xác nhận xóa lớp học" (KHÔNG phải "Xoá lớp học <tên>" như spec cũ),
 * nội dung "Bạn có chắc chắn muốn xóa lớp <tên> không ?", 2 nút "Hủy"/"Xác nhận" (KHÔNG phải "Từ
 * chối"/"Đồng ý"). Request thật khi bấm "Xác nhận": `DELETE /api/classes/:id` -> 200.
 */
export const teacherClassPageObjects = {
  path: "/teacher/class",

  sidebar: {
    classMenuLink: "Lớp phụ trách",
  },

  pageHeading: "Lớp phụ trách",
  addClassButton: "Thêm lớp học",

  dialog: {
    heading: "Thêm mới lớp học",
  },

  tenLopPlaceholder: "Ví dụ: 7A",
  saveButton: "Lưu",
  cancelButton: "Hủy",

  // Nhãn lặp lại đúng 1 lần trên mỗi card lớp thật - dùng để đếm số lượng lớp (xem ghi chú ở trên
  // về lý do KHÔNG dùng text "Danh sách lớp học (N)").
  classCardCountLabel: "Sĩ số:",

  // Màn "Chi tiết lớp" (/teacher/class/:id) - dùng bởi runtime/deleteClassFlow.js.
  detail: {
    editButton: "Chỉnh sửa lớp học",
    // Heading thật của trang là "Lớp <tên lớp>" - ghép chuỗi ở nơi dùng (cần biết tên lớp).
    headingPrefix: "Lớp ",
  },

  editDialog: {
    heading: "Chỉnh sửa thông tin lớp học",
    deleteButton: "Xóa lớp học",
  },

  confirmDeleteDialog: {
    heading: "Xác nhận xóa lớp học",
    confirmButton: "Xác nhận",
    cancelButton: "Hủy",
  },
};
