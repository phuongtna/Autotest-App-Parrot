/**
 * Page Objects cho module "Bài tập" (Homework) - chứa selector/text của 4 màn: HomeworkList (danh
 * sách), HomeworkFilterSheet (bottom sheet lọc), HomeworkAttemptHistory (lịch sử làm bài - liệt kê
 * điểm/thời gian từng lần), và HomeworkAttemptReview (Xem chi tiết 1 lần làm - ĐÃ VERIFY THẬT trên
 * thiết bị BDB00056877, 2026-08-06: đọc lại từng câu Câu 1..N của 1 lần làm ĐÃ NỘP, hoàn toàn
 * read-only, không cần biết examId/endpoint mở đề nào - khác hẳn "Start Homework" nên AN TOÀN để
 * implement, xem reviewDetail bên dưới).
 *
 * CỐ TÌNH KHÔNG có selector cho HomeworkDoing (màn LÀM MỚI 1 lượt Exam thật) - màn đó vẫn nằm sau
 * ranh giới "Start Homework/Open Exam", theo yêu cầu hiện chưa implement (xem
 * runtime/pendingExamLaunch.js). Review (xem lại lần đã nộp) và Doing (làm lượt mới) là 2 màn khác
 * nhau dù cùng hiển thị nội dung câu hỏi.
 *
 * NGUỒN: đa số text lấy từ ảnh Figma (xem lịch sử phân tích UI trong automation/README.md mục
 * "Bài tập") - riêng `reviewDetail` đã đối chiếu `maestro hierarchy` trên thiết bị thật.
 */
export const homeworkPageObjects = {
  bottomTab: {
    homeworkLabel: "Bài tập",
  },

  // Popup CHUNG của app, gặp thật ngoài dự kiến khi test chuyển tab (2026-08-06, thiết bị
  // BDB00056877): "Cập nhật phiên bản mới" - hiện ra khi vào lại tab (không rõ điều kiện chính
  // xác, có thể theo phiên bản app). Khác toàn bộ popup đã biết ở navigation/navigationEngine.js
  // (Vui học) - danh sách đó KHÔNG áp dụng cho Bài tập (chưa thấy xuất hiện trong lúc test).
  popups: [{ trigger: "Cập nhật phiên bản mới", action: "Để sau" }],

  list: {
    // Cùng chữ với label tab ("Bài tập") - lưu ý selector theo text có thể khớp cả 2 node (tab +
    // tiêu đề màn) khi dùng "tapOn"; CHƯA verify Maestro tự phân biệt thế nào trong app này.
    screenTitle: "Bài tập",
    sectionRegular: "Bài tập về nhà",
    sectionAdvanced: "Bài tập nâng cao",
    filterHeaderPattern: "\\d+ (tuần|tháng) gần nhất",
    cta: {
      notStartedRegular: "Làm bài",
      notStartedAdvanced: "Chinh phục",
      inProgress: "Tiếp tục",
      completed: "Làm lại",
    },
    viewCompletedLink: "Xem bài đã làm",
  },

  filterSheet: {
    title: "Xem bài tập theo",
    optionTwoWeeks: "2 tuần gần nhất",
    optionOneMonth: "1 tháng gần nhất",
    applyButton: "Xem",
  },

  attemptHistory: {
    attemptLabelPattern: "Lần \\d+",
    redoButton: "Làm lại",
    // Dẫn vào màn Review (reviewDetail bên dưới) - đã hết là ranh giới Pending, xem comment đầu
    // file. Text lặp lại 1 lần/attempt trên màn AttemptHistory - tapOn khớp lần xuất hiện đầu tiên
    // (chưa cần chọn đúng "Lần N" cụ thể nào, caller tự đảm bảo nếu cần).
    detailButton: "Xem chi tiết",
  },

  // Màn "Xem chi tiết" 1 lần làm - ĐÃ VERIFY THẬT (2026-08-06, thiết bị BDB00056877, homework
  // "G3-U18-Lesson 1: Listen and choose", lần làm "Đúng 2/5"): hiển thị lại đúng N câu (Câu 1..N,
  // đã thấy N=5) kèm audio/đáp án đã chọn, có nút "Giải thích" (KHÔNG dùng ở đây, ngoài phạm vi
  // hiện tại) và 1 nút chuyển câu ở vị trí cố định - text đổi từ "Tiếp theo" (còn câu sau) thành
  // "Xem xong" NGAY tại câu cuối (đã xác nhận N/N) - dùng để biết khi nào dừng loop và quay về
  // AttemptHistory, không cần biết trước N.
  reviewDetail: {
    nextButton: "Tiếp theo",
    doneButton: "Xem xong",
  },
};
