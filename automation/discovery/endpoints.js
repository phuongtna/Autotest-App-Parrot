// Bảng path template của CMS API - đây là nơi DUY NHẤT cần sửa khi biết endpoint thật
// (qua curl/response mẫu/network log user cung cấp). Các module khác trong discovery/
// không hardcode path - chỉ đọc từ đây, nên xác nhận 1 endpoint chỉ cần sửa đúng 1 dòng.
//
// `:param` sẽ được thay bằng ID thật lúc gọi (xem cmsClient.js#buildPath) - đây KHÔNG
// phải hardcode ID, chỉ là tên tham số.
//
// auth: "cms"  -> gắn Bearer CMS_ACCESS_TOKEN
// auth: "exam" -> gắn Bearer Exam Token (tự lấy qua examToken.js trước khi gọi)
//
// TRẠNG THÁI: tất cả endpoint dưới đây đã xác nhận bằng curl + HAR thật (2026-08-05).
// Question/Correct Answer KHÔNG dùng API (xem ghi chú cuối file) - dùng
// discovery/examPageScraper.js (Playwright) thay thế.
export const endpoints = {
  examToken: {
    auth: "cms",
    method: "GET",
    path: "/exams/token",
    confirmed: true,
  },

  books: {
    auth: "cms",
    method: "GET",
    path: "/books",
    confirmed: true,
    // Xác nhận qua HAR hỗ trợ thêm query filter: ?page=&limit=&type= (vd type=SELF_LEARN).
    // Không cần dùng ở đây vì getBooks() lấy toàn bộ, không lọc theo type.
  },
  // Chi tiết 1 Book (xác nhận qua HAR, chưa module nào trong discovery/ gọi tới - để sẵn
  // cho nhu cầu sau này, vd hiển thị mô tả/thumbnail đầy đủ của Book đã chọn).
  bookDetail: {
    auth: "cms",
    method: "GET",
    path: "/books/:bookId",
    confirmed: true,
  },
  unitsOfBook: {
    auth: "cms",
    method: "GET",
    path: "/books/:bookId/units",
    confirmed: true,
  },
  lessonsOfUnit: {
    auth: "cms",
    method: "GET",
    path: "/units/:unitId/lessons",
    confirmed: true,
  },
  // Trả về các Lesson Item Ở TOP-LEVEL của Lesson (quan sát thực tế: toàn bộ đều type
  // "GROUP", vd "Trạm khởi hành", "Thử thách"). Mỗi item có thể kèm sẵn mảng "children"
  // (đệ quy, có thể nhiều tầng) chứa các Lesson Item con thật (LEAD_IN, FLASH_CARD,
  // EXERCISE, PARAGRAPH...). Xem lessonItems.js#flattenLessonItems.
  lessonItemsOfLesson: {
    auth: "cms",
    method: "GET",
    path: "/lessons/:lessonId/items",
    confirmed: true,
  },
  // Dùng khi 1 node không có sẵn "children" embedded (lazy-load) - đã xác nhận hoạt động
  // với response shape giống lessonItemsOfLesson.
  childrenOfLessonItem: {
    auth: "cms",
    method: "GET",
    path: "/lesson-items/:lessonItemId/children",
    confirmed: true,
  },
  // Chi tiết 1 Lesson Item. Với item type EXERCISE, "data.item_content" là 1 Room, trong đó
  // "exams" là mảng Exam (thường 1 phần tử) và "total_questions" là tổng số câu hỏi. Lưu ý:
  // trong response của lessonItemsOfLesson/childrenOfLessonItem, node EXERCISE đã có sẵn
  // "room_id" + "exam_ids" (mảng id) ngay trong list - nên thường KHÔNG cần gọi endpoint
  // này, chỉ dùng làm fallback khi list không kèm 2 field đó.
  lessonItemDetail: {
    auth: "cms",
    method: "GET",
    path: "/lesson-items/:lessonItemId",
    confirmed: true,
  },
  // Danh sách Exam kiểu "cây thư mục" quản trị (page/limit, có field path/parent_id) - xác
  // nhận qua HAR (GET /exams?page=1&limit=20, CMS token, 200 OK) và test trực tiếp. ĐÂY
  // KHÔNG PHẢI endpoint để lấy full detail (câu hỏi) của 1 exam cụ thể theo id - đã test
  // "/exams/:id" (path) trả 404 dù dùng đúng id thật lấy từ exam_ids, nên không dùng
  // endpoint này để implement examDetail bên dưới, chỉ ghi nhận lại là đã biết nó tồn tại.
  examsList: {
    auth: "cms",
    method: "GET",
    path: "/exams",
    confirmed: true,
  },
  // ĐÃ XÁC NHẬN (2026-08-05): Question/Correct Answer KHÔNG có API riêng. Dữ liệu chỉ được
  // server render sẵn (SSR) vào window.__NUXT__.data của trang Exam Editor thật
  // (https://exam.parrotedu.vn/exam/add/manual?id=<examId>) - đây là lý do Network tab
  // không bao giờ thấy request Fetch/XHR nào cho dữ liệu này dù trang vẫn hiển thị đúng câu
  // hỏi. Đã bỏ 2 endpoint "questionsOfExam"/"correctAnswersOfQuestion" từng để ở đây (suy
  // đoán sai hướng - dò API) - xem discovery/examPageScraper.js#parseQuestionsFromExamPage()
  // (dùng Playwright + session export từ Chrome, xem automation/README.md mục "Exam Scraper").
};

export function buildPath(endpointKey, params = {}) {
  const endpoint = endpoints[endpointKey];
  if (!endpoint) {
    throw new Error(`Không tìm thấy endpoint "${endpointKey}" trong endpoints.js`);
  }
  let path = endpoint.path;
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`:${key}`, encodeURIComponent(value));
  }
  if (path.includes(":")) {
    throw new Error(
      `Thiếu tham số khi build path cho "${endpointKey}": "${path}" (params đã truyền: ${JSON.stringify(params)})`,
    );
  }
  return { ...endpoint, path };
}
