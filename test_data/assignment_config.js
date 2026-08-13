// Config bài NÂNG CAO CỤ THỂ dùng cho flows/bai_tap/HW-PROFILE-BASIC-PRO-ADVANCED.yaml - KHÔNG
// random. Nạp qua `runScript` (cùng convention Maestro với test_data/datatest.js/accounts.env) -
// dùng lại qua ${output.TEN_BIEN} ở các bước sau trong flow.
//
// NGUỒN (đã xác nhận thật, KHÔNG suy đoán):
//   - Room ADVANCED do GV giao thật qua Web GV (2026-08-13), lớp 3B - cùng lớp với 2 hồ sơ
//     Gia Linh (BASIC)/Ngoc (PRO), xem test_data/accounts.env PROFILE_BASIC_NAME/PROFILE_PRO_NAME.
//   - Xác nhận qua CMS API (automation/bai_tap/discovery/findAdvancedAssignmentCli.js, output đầy
//     đủ tại automation/output/find_advanced_assignment_report.json): room_id=566ffb0b-...,
//     level=ADVANCED (GET /api/cms/lesson-items/:id), Book="Khối 3", Unit="Unit 18: Playing and
//     doing", Lesson="Lesson 3", lessonItem.name="Các hoạt động ở trường học".
//   - Xác nhận THẬT trên thiết bị (2026-08-13, device 3201d866d40a1681, hồ sơ Ngoc/PRO): card nằm
//     trong section "Bài tập nâng cao" (đúng giữa "Bài tập về nhà" và "Kiến thức trong bài", khớp
//     3 section GV/PH mô tả) - text ĐẦY ĐỦ hiển thị trên app là "Trò chuyện cùng Parrot: Các hoạt
//     động ở trường học" (UI thêm tiền tố "Trò chuyện cùng Parrot: " so với lessonItem.name CMS -
//     dùng regex match theo phần lessonItem.name (KHÔNG hardcode tiền tố, có thể đổi) để chọn đúng
//     card mà không phụ thuộc tiền tố UI. Hạn nộp hiển thị "15/08" (khớp đúng endTime CMS quy đổi
//     giờ VN). CTA "Chinh phục" (nút xanh, không có icon khoá) khi xem bằng hồ sơ Ngoc/PRO.
//
// VALIDATE LẠI TRƯỚC MỖI LẦN CHẠY THẬT: chạy
//   node automation/bai_tap/discovery/validateAssignmentConfigCli.js
// (đọc lại CHÍNH room_id này qua CMS API, xác nhận còn tồn tại + level vẫn ADVANCED + Hạn nộp vẫn
// >= hôm nay) TRƯỚC khi `maestro test` flow này - nếu BLOCKED, KHÔNG tự đổi sang bài khác, báo lại
// để giao bài mới hoặc cập nhật config này bằng dữ liệu thật mới.
output.UNIT_NAME = 'Unit 18: Playing and doing';
output.LESSON_NAME = 'Lesson 3';
output.HOMEWORK_ITEM_NAME = 'Các hoạt động ở trường học';
output.LEVEL = 'ADVANCED';
output.ROOM_ID = '566ffb0b-0fc7-48c0-af9b-ffe0d28db1d5';
output.LESSON_ITEM_ID = '0ce3cd5e-2c8c-4b21-9627-b485acecb18f';
output.CLASS_NAME = '3B';
output.CLASS_ID = 'b3336062-cacd-4d1a-a0af-4de44acf33d2';
output.DUE_DATE_DM = '15/08';
