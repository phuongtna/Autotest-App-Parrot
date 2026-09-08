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

  // Nút mở dialog "Yêu cầu chờ duyệt" trên "Chi tiết lớp" - label thật có badge số đếm dính liền
  // ("Yêu cầu chờ duyệt1"), dùng regex thay vì exact text để không phụ thuộc số đếm hiện tại.
  //
  // ĐÃ XÁC NHẬN THẬT (2026-09-08, staging, lớp "5X-RKLRejoin2" - id
  // db7ae7b7-ead9-4fd0-841d-7c1c13c5d57a, tài khoản GV "Phương"): dialog "Duyệt học sinh vào lớp"
  // có 1 bảng, mỗi hàng = 1 yêu cầu, cột "Học sinh" chứa CHÍNH XÁC tên hồ sơ con (không phải tên
  // phụ huynh) - dùng để định vị đúng hàng cần duyệt. Mỗi hàng có 2 nút riêng "Từ chối"/"Duyệt"
  // (không phải checkbox), ngoài ra có 1 nút "Duyệt tất cả (N)" ở header dialog duyệt toàn bộ cùng
  // lúc - KHÔNG dùng nút này khi cần duyệt đúng 1 học sinh cụ thể (có thể có nhiều yêu cầu khác
  // đang chờ không liên quan tới case đang chạy).
  //
  // QUAN TRỌNG - CẢ 2 dialog dưới đây (danh sách + xác nhận) đều có role="dialog" và tên
  // accessible (từ heading h2) CHỒNG LẤN NHAU: h2 của dialog danh sách chứa CẢ nút "Duyệt tất cả
  // (N)" bên trong (DOM thật: `<h2><p>Duyệt học sinh vào lớp</p><button>Duyệt tất cả (N)</button>
  // </h2>`), nên accessible name thật của nó là "Duyệt học sinh vào lớp Duyệt tất cả (N)" - vừa
  // KHÔNG khớp `exact:true` với string "Duyệt học sinh vào lớp" (thừa hậu tố), vừa VÔ TÌNH chứa
  // "Duyệt học sinh" (tên dialog xác nhận) làm substring. Kết quả: `getByRole("dialog", {name:...})`
  // dù dùng `exact:true` hay không đều có thể khớp NHẦM cả 2 dialog cùng lúc tuỳ chuỗi tìm - đã
  // gặp thật (2026-09-08, sửa qua lại vẫn sai). FIX: dùng `page.locator('[role="dialog"]',
  // {hasText: ...})` với 1 cụm CHỈ xuất hiện ở ĐÚNG 1 trong 2 dialog (không dùng chung tiền tố
  // "Duyệt học sinh") - xem cách dùng trong approveStudentRequestFlow.js.
  pendingRequestsButton: /Yêu cầu chờ duyệt/,
  pendingRequestsDialog: {
    // Cụm CHỈ có ở dialog danh sách (không xuất hiện trong dialog xác nhận).
    uniqueText: "Duyệt tất cả",
    approveAllButtonPattern: /Duyệt tất cả/,
    rowApproveButton: "Duyệt",
    rowRejectButton: "Từ chối",
  },
  // Bấm "Duyệt" trên 1 hàng mở TIẾP 1 dialog xác nhận lồng bên trên (KHÔNG duyệt ngay) - xác nhận
  // thật 2026-09-08: heading "Duyệt học sinh", nội dung nhắc lại CHÍNH XÁC tên học sinh, 2 nút
  // "Hủy"/"Xác nhận". Phải bấm "Xác nhận" ở dialog NÀY thì request duyệt thật mới được gửi.
  confirmApproveDialog: {
    // Cụm CHỈ có ở dialog xác nhận (không xuất hiện trong dialog danh sách).
    uniqueText: "Bạn có chắc chắn muốn duyệt học sinh",
    confirmButton: "Xác nhận",
    cancelButton: "Hủy",
  },
};
