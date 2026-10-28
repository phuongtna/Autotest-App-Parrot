/**
 * Page Objects cho module "Ôn thi" > tab "Đề thầy cô giao" - CÙNG kiểu tổ chức với
 * automation/bai_tap/navigation/homeworkPageObjects.js (tách selector/text khỏi logic điều hướng).
 *
 * NGUỒN (CHƯA VERIFY THẬT trên thiết bị - xem ghi chú đầu automation/on_thi/discovery/onThiUiList.js
 * để biết đầy đủ cái gì đã thấy thật trong ảnh mockup vs cái gì chỉ suy ra từ spec.json):
 *   - flows/app/on_thi/spec.json (mục I - "Màn hình và mô tả")
 *   - 1 ảnh mockup Figma (4 control được đánh số: Label số lượng đề, Dropdown thời gian giao,
 *     Card đề chưa nộp, Card đề đã nộp)
 *
 * KHÁC HẲN quy ước homeworkPageObjects.js (đã verify thật từng dòng qua nhiều lượt device) - mọi
 * giá trị dưới đây PHẢI đối chiếu `maestro hierarchy`/ảnh chụp thật trước khi tin tưởng cho 1 lượt
 * chạy có ý nghĩa, đặc biệt: tên tab gốc thật ("Ôn thi" có thể không phải tên tab bottom-bar, có thể
 * nằm trong tab "Vui học"/mục riêng khác - CHƯA xác nhận qua navigation thật), tên 2 sub-tab
 * ("Đề thầy cô giao" vs "Kho đề Parrot" - thấy trong ảnh mockup màn Danh sách đề đính kèm yêu cầu
 * gốc, KHÔNG phải ảnh mockup 4-control), và toàn bộ copy bottom-sheet nâng cấp Pro/Free (spec.json
 * mục "Rule quyền truy cập theo gói" KHÔNG cho nguyên văn copy - để trống field đó, KHÔNG bịa).
 */
export const onThiPageObjects = {
  bottomTab: {
    // CẦN XÁC MINH: tên tab gốc trên bottom bar - spec.json chỉ nói "màn Ôn thi", ảnh màn Danh sách
    // đề có header "< Ôn thi" (tiêu đề màn, có nút back) - CHƯA rõ đây là 1 tab độc lập hay 1 màn
    // con mở từ tab khác (vd từ "Vui học" hoặc từ 1 banner/icon riêng). Tạm coi là tên tab y hệt
    // tiêu đề màn, theo đúng quy ước đã verify đúng ở module Bài tập (bottomTab.homeworkLabel ===
    // list.screenTitle).
    onThiLabel: "Ôn thi",
  },

  // CẦN XÁC MINH: popup chung của app (vd "Cập nhật phiên bản mới" đã gặp thật ở module Bài tập) -
  // CHƯA biết module Ôn thi có gặp lại popup này hay không, tạm để trống (KHÔNG copy nguyên danh
  // sách popups của Bài tập sang nếu chưa xác nhận lại - popup có thể gắn theo điều kiện khác, xem
  // comment gốc trong homeworkPageObjects.js).
  popups: [],

  list: {
    // Tiêu đề màn (ảnh đính kèm yêu cầu: header "< Ôn thi") - khác tên 2 sub-tab bên dưới.
    screenTitle: "Ôn thi",
    // 2 sub-tab NGAY DƯỚI header, theo ảnh đính kèm yêu cầu gốc (không phải ảnh 4-control).
    subTabAssignedByTeacher: "Đề thầy cô giao",
    subTabParrotBank: "Kho đề Parrot",
    // CẦN XÁC MINH: tag "Đề cơ bản" thấy trong ảnh 4-control (control 3, ngay trên card đầu tiên) -
    // xem thêm ghi chú SECTION_HEADERS ở discovery/onThiUiList.js về việc CHƯA rõ đây có phải
    // section-header bắt buộc giống "Bài tập về nhà" hay không.
    sectionBasic: "Đề cơ bản",
    sectionAdvanced: "Đề nâng cao",
    // Label số lượng đề (control 1) - spec.json: "'N đề', tổng số đề theo khoảng thời gian giao
    // đang lọc". Regex đếm số bất kỳ + chữ "đề".
    countLabelPattern: "\\d+ đề",
    // Label dropdown (control 2) - GIỐNG HỆT module Bài tập (list.filterHeaderPattern), vì spec.json
    // dùng đúng 2 nhãn "2 tuần gần nhất"/"1 tháng gần nhất" y hệt Bài tập.
    filterHeaderPattern: "\\d+ (tuần|tháng) gần nhất",
    cta: {
      // Thấy thật trong ảnh mockup đính kèm yêu cầu gốc: card "Đề kiểm tra 15 phút - Unit 4" (0/10,
      // QUÁ HẠN) có CTA "Làm bài"; card "Đề kiểm tra giữa kỳ I" (8/30) có CTA "Làm tiếp".
      notStarted: "Làm bài",
      inProgress: "Làm tiếp",
    },
    viewCompletedLink: "Xem bài đã làm",
  },

  filterSheet: {
    // CẦN XÁC MINH: tiêu đề sheet - spec.json không cho nguyên văn, tạm suy từ quy ước "Xem bài tập
    // theo" (Bài tập) đổi "bài tập" -> "đề". KHÔNG chắc chắn, chỉ là best-effort placeholder.
    title: "Xem đề theo",
    optionTwoWeeks: "2 tuần gần nhất",
    optionOneMonth: "1 tháng gần nhất",
    // CẦN XÁC MINH: chưa chắc nút áp dụng cùng chữ "Xem" như Bài tập.
    applyButton: "Xem",
  },

  // CẦN XÁC MINH TOÀN BỘ: spec.json mục "Rule quyền truy cập theo gói" mô tả HÀNH VI (hiện bottom
  // sheet nâng cấp khi Free bấm "Bắt đầu làm bài" trên đề Pro) nhưng KHÔNG cho nguyên văn copy -
  // KHÔNG bịa chuỗi text cụ thể (khác hẳn module Bài tập, nơi hw21-22-upgrade-sheets.mjs đã có 4+
  // biến thể copy THẬT từ device). Để trống, caller/QA phải tự điền sau khi capture thật 1 lần.
  upgradeSheet: {
    // vd (placeholder, CHƯA xác nhận): "Nâng cấp để con làm đề Pro không giới hạn"
    knownCopyPatterns: [],
  },
};
