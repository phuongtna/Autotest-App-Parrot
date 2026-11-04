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

  // Copy CHÍNH XÁC của bottom sheet nâng cấp riêng module Ôn thi VẪN CHƯA capture được (QA xlsx
  // "Ôn thi-Chi tiết đề.xlsx" TC_31/32/40 chỉ mô tả HÀNH VI "hiển thị bottom sheet nâng cấp tài
  // khoản", KHÔNG chụp/chép nguyên văn copy riêng cho màn Chi tiết đề) - KHÔNG bịa chuỗi text cụ
  // thể. TẠM DÙNG `genericTitlePattern` bên dưới (tái dùng 2 biến thể ĐÃ capture THẬT ở module Bài
  // tập qua `automation/bai_tap/hw21-22-upgrade-sheets.mjs` - cả 2 biến thể đều có tiêu đề chung
  // "Nâng cấp tài khoản") làm tín hiệu PHÁT HIỆN sheet đã mở (đủ cho mọi TC chỉ cần biết "có hiện
  // bottom sheet nâng cấp hay không", KHÔNG đủ để khẳng định copy Ôn thi giống hệt Bài tập - CẦN
  // XÁC MINH lại bằng ảnh chụp thật nếu sau này cần assert đúng nguyên văn riêng của Ôn thi).
  upgradeSheet: {
    knownCopyPatterns: [],
    genericTitlePattern: ".*(Nâng cấp).*",
  },

  /**
   * Màn "Thông tin đề" (trước khi bắt đầu 1 lượt làm) - CÙNG màn cho cả 2 tab (Đề thầy cô giao/Kho
   * đề Parrot), chỉ khác đường vào. ĐÃ QUAN SÁT THẬT qua thao tác tay bằng `adb shell input tap` +
   * screenshot (2026-10-30, thiết bị 3201d866d40a1681, app com.inet.parrotedu) trên 3 đề: "Đề
   * 2810" (2 section, mỗi section có thời gian riêng), "Đề thi thử vào 10 Sở DGĐT TP Hà Nội" (2
   * section có thời gian riêng), "Đề thi 14" (2 section KHÔNG gắn thời gian riêng, chỉ 1 "Thời
   * lượng tối đa" chung) - CHƯA chạy qua `maestro test`/MaestroBridge thật lần nào, chỉ xác nhận
   * đúng NGUYÊN VĂN text hiển thị, KHÔNG xác nhận resource-id nào (không dump `maestro hierarchy`
   * trong phiên quan sát đó, chỉ chụp ảnh màn hình).
   */
  examInfo: {
    // ĐÃ VERIFY THẬT qua `maestro hierarchy` (2026-11-04, thiết bị 3201d866d40a1681, đề "Đề ôn
    // luyện kỹ năng Nói", profile đang active trên máy lúc đó) - resource-id Tên đề.
    nameId: "exam_prep_detail_name",
    maxDurationLabel: "Thời lượng tối đa",
    totalQuestionsLabel: "Tổng số câu",
    structureSectionTitle: "Cấu trúc đề",
    historySectionTitle: "Lịch sử làm bài",
    historyViewAllLink: "Xem tất cả",
    startButton: "Bắt đầu làm bài",
    // Mỗi dòng "Cấu trúc đề" là 1 tên section, CÓ THỂ kèm theo nhãn thời lượng dạng "N phút" ngay
    // sau tên (đề có thời gian theo Section) hoặc KHÔNG kèm gì (đề không gắn thời gian theo
    // Section, chỉ dùng `maxDurationLabel` ở trên) - xem detectSectionTimerMode() trong
    // onThiExamEngine.js, KHÔNG suy đoán theo tên section cụ thể.
    sectionDurationPattern: "\\d+ phút",
    // Popup xác nhận khi bấm "Bắt đầu làm bài" - ĐÃ QUAN SÁT THẬT.
    startConfirmPopup: {
      title: "Bắt đầu làm bài?",
      confirmButton: "Bắt đầu",
      cancelButton: "Để sau",
    },

    // THÊM MỚI (2026-11-04) - nguồn: "Ôn thi-Chi tiết đề.xlsx" (TC_APP_OnThi_ChiTietDe_26..30), bộ
    // test case QA ĐÃ CHẠY THẬT và Pass trên thiết bị thật (copy đính kèm ảnh chụp màn hình
    // prnt.sc, không phải suy đoán) - khác mức độ tin cậy "CẦN XÁC MINH" của phần phía trên, các
    // field dưới đây coi là NGUYÊN VĂN TEXT đã xác nhận qua QA thủ công, nhưng VẪN CHƯA từng chạy
    // qua `maestro test`/MaestroBridge thật (chưa xác nhận lại resource-id/khớp đúng selector
    // Maestro), nên vẫn giữ nguyên tắc chung "chạy thật 1 lần trước khi tin tưởng kết quả FAIL ở
    // bước này là lỗi app chứ không phải sai selector".
    //
    // Nút action khi đề đang có phiên làm dở (thay cho `startButton` ở trên).
    continueButton: "Tiếp tục làm bài",
    // Popup khi bấm `continueButton` - 2 lựa chọn "Làm lại" (xoá phiên dở, bắt đầu lại từ câu 1) /
    // "Tiếp tục" (vào đúng vị trí làm dở, giữ nguyên số câu đã trả lời + thời gian đã trôi qua).
    resumeIncompletePopup: {
      title: "Bài làm chưa hoàn thành",
      // SỬA LẠI SAU KHI CHẠY THẬT (2026-11-04, đề "Đề kiểm tra giữa kỳ 1 - Khối 6 sửa 12"): nguyên
      // văn có XUỐNG DÒNG giữa 2 câu ("...này.\nBạn muốn...") KHÔNG PHẢI dấu cách như đoán ban đầu
      // từ xlsx (text 1 dòng trong Excel không phản ánh line-break thật trên UI) - title/2 nút
      // "Làm lại"/"Tiếp tục" khớp ĐÚNG 100% với thiết kế ban đầu, không cần sửa.
      bodyPattern: "Bạn chưa hoàn thành đề thi này\\.\\s*Bạn muốn tiếp tục làm hay bắt đầu lại\\?",
      retryButton: "Làm lại",
      continueButton: "Tiếp tục",
    },
    // SỬA LẠI SAU KHI CHẠY THẬT (2026-11-04, thiết bị 3201d866d40a1681, đề "Đề ôn luyện kỹ năng
    // Nói" - 2 lần làm, Lần 2 = 0 điểm, Lần 1 = 6 điểm): claim cũ "mỗi dòng dạng 1 chuỗi 'Lần N -
    // X.XX'" SAI - `maestro hierarchy` thật cho thấy nhãn "Lần N" và điểm số là 2 NODE TEXT RIÊNG
    // BIỆT trên CÙNG 1 hàng (label bên trái, điểm căn phải, KHÔNG có dấu "-" nối 2 phần, điểm cũng
    // KHÔNG chắc luôn có phần thập phân - ảnh thật chỉ thấy số nguyên "0"/"6", xlsx mô tả "7.25" có
    // thể là THẬT NHƯNG dạng hiển thị rút gọn khi điểm tròn, CẦN XÁC MINH thêm với 1 đề có điểm lẻ
    // thật). `historyRowPattern` CHỈ còn dùng để match NHÃN "Lần N" - KHÔNG dùng được để verify
    // đúng điểm của từng dòng qua text selector đơn thuần (label/điểm không nằm trong cùng 1 chuỗi
    // để regex gộp) - muốn đối chiếu đúng điểm của ĐÚNG lần (TC_APP_OnThi_ChiTietDe_15) cần đọc qua
    // `maestro hierarchy`/bounds (so khớp 2 node cùng 1 khoảng y) chứ không phải 1 `assertVisible`
    // text đơn giản như đã viết ban đầu trong `flows/app/on_thi/CD-09_10_11_12_13_14_15-lich-su-lam-bai.yaml`.
    historyRowPattern: "Lần \\d+",
  },

  /**
   * Màn "Doing" (đang làm 1 lượt đề) - DÙNG CHUNG `exercise/doing.tsx` với module Bài tập (testID
   * `exercise_*` y hệt, xem docblock đầu `automation/on_thi/navigation/onThiExamEngine.js`), CHỈ
   * phần khung bọc ngoài (header/toolbar/thanh tiến độ/đồng hồ/bottom sheet câu hỏi/popup) là RIÊNG
   * của Ôn thi - khác hẳn Bài tập (không có section, không có đồng hồ, không có bottom sheet danh
   * sách câu hỏi). ĐÃ QUAN SÁT THẬT qua `adb shell input tap` + screenshot (2026-10-30, thiết bị
   * 3201d866d40a1681) - CHƯA xác nhận qua Maestro/MaestroBridge thật, CHƯA có resource-id nào (chỉ
   * có text/toạ độ quan sát qua ảnh chụp màn hình, không dump `maestro hierarchy`).
   */
  doing: {
    // THÊM MỚI/SỬA LẠI SAU KHI CHẠY THẬT (2026-11-04, thiết bị 3201d866d40a1681, đề "Đề kiểm tra
    // giữa kỳ 1 - Khối 6 sửa 12", qua `maestro hierarchy` thật - KHÔNG phải suy đoán): khung Doing
    // của Ôn thi dùng bộ resource-id RIÊNG `exam_prep_doing_*`, KHÁC HẲN `exercise_*` của Bài tập -
    // XOÁ bỏ mọi "CHƯA XÁC MINH TOẠ ĐỘ" cho 2 icon Thoát/Đánh dấu xem lại vì giờ đã có id thật, tap
    // bằng id thay vì điểm toạ độ đoán. Icon flag quan sát được ở trạng thái CHƯA đánh dấu có id
    // `exam_prep_flag_off` - CHƯA xác nhận id lúc đã đánh dấu (có thể đổi thành `exam_prep_flag_on`
    // theo quy ước suffix on/off, CHƯA tự verify, chỉ suy luận hợp lý).
    screenId: "exam_prep_doing_screen",
    exitIconId: "exam_prep_doing_header_left",
    toolbarSubmitButtonId: "exam_prep_doing_submit_top",
    markForReviewIconId: "exam_prep_flag_off",
    questionNoId: "exam_prep_doing_question_no",
    timerId: "exam_prep_doing_timer",
    questionListButtonId: "exam_prep_doing_grid",
    ctaButtonId: "exam_prep_doing_next",
    // Nút "Nộp bài" trên thanh công cụ (góc phải header) - LUÔN hiển thị suốt quá trình làm bài,
    // KHÁC nút CTA cuối màn (đổi nhãn Tiếp theo/Chuyển phần/Nộp bài tuỳ vị trí câu). Giữ lại field
    // text này song song với `toolbarSubmitButtonId` ở trên (cả 2 đều ĐÃ XÁC NHẬN THẬT, dùng được
    // cả 2 cách).
    toolbarSubmitButton: "Nộp bài",
    // 3 nhãn CTA cuối màn - ĐÃ QUAN SÁT THẬT cả 3 trạng thái chuyển đổi đúng lúc:
    // "Tiếp theo" (còn câu trong section hiện tại/đề không gắn thời gian section còn câu),
    // "Chuyển phần" (câu cuối 1 section, chưa phải section cuối đề - CHỈ xuất hiện ở đề có thời
    // gian theo Section, đề không gắn thời gian theo Section KHÔNG có nhãn này - xem TC_38/TC_49),
    // "Nộp bài" (câu cuối cùng của toàn bộ đề, bất kể loại đề). Mọi nhãn đều dùng CHUNG 1 resource-
    // id `ctaButtonId` ở trên (ĐÃ XÁC NHẬN THẬT) - ưu tiên tap theo id, text chỉ để assert nhãn.
    ctaNext: "Tiếp theo",
    ctaSwitchSection: "Chuyển phần",
    ctaSubmitAtLastQuestion: "Nộp bài",
    ctaRegex: "Tiếp theo|Chuyển phần|Nộp bài",
    questionListButtonPattern: "\\d+/\\d+",
    questionListSheetTitle: "Danh sách câu hỏi",
    // popup khi tap icon Thoát (góc trái header) - ĐÃ QUAN SÁT THẬT. LƯU Ý: text nút thực tế là "Ở
    // lại" (KHÔNG PHẢI "Ở lại làm bài" như mô tả gốc trong 1 số tài liệu spec cũ - xem Note
    // TC_PAR_OnThiLamBai_3 trong TestCase_PAR-3172_OnThi_LamBai.xlsx, phiên 2026-10-30).
    // ĐÃ VERIFY LẠI THẬT (2026-11-04, cùng lượt đợt chạy CD-21..30 thật): title/2 nút khớp đúng
    // 100%, icon Thoát giờ tap bằng `exitIconId` (ở trên) thay vì toạ độ đoán.
    exitConfirmPopup: {
      title: "Ngừng làm bài?",
      bodyPattern: "Thời gian tiếp tục đếm khi bạn thoát\\.\\s*Bạn xác nhận rời khỏi màn làm bài\\?",
      stayButton: "Ở lại",
      confirmExitButton: "Thoát",
    },
    // popup khi tap "Nộp bài" (toolbar HOẶC CTA cuối màn) - CÙNG 1 popup cho cả 2 lối vào, ĐÃ QUAN
    // SÁT THẬT.
    submitConfirmPopup: {
      title: "Nộp bài ngay?",
      continueButton: "Làm tiếp",
      confirmSubmitButton: "Nộp bài",
    },
    // popup CHỈ xuất hiện khi tap "Chuyển phần" lúc section hiện tại VẪN CÒN thời gian (đề có thời
    // gian theo Section) - ĐÃ QUAN SÁT THẬT. Đề không gắn thời gian theo Section KHÔNG BAO GIỜ hiện
    // popup này (không có khái niệm "còn thời gian ở phần này") - xem TC_38/TC_49 (chuyển thẳng
    // không cần xác nhận).
    switchSectionConfirmPopup: {
      title: "Bạn muốn chuyển phần khác?",
      stayButton: "Ở lại",
      confirmSwitchButton: "Chuyển phần",
    },
  },

  /**
   * Màn "Kết quả bài thi" - KHÁC HẲN nhãn của Bài tập (`RESULT_SCORE_LABEL`="ĐIỂM SỐ"/
   * `RESULT_CORRECT_LABEL`="CHÍNH XÁC" trong homeworkExamEngine.js) - Ôn thi dùng bộ nhãn RIÊNG,
   * KHÔNG tái sử dụng được `readResult()`/`isResultScreen()` của HomeworkExamEngine, phải viết lại
   * (xem onThiExamEngine.js#isExamResultScreen()/readExamResult()). ĐÃ QUAN SÁT THẬT 2026-10-30.
   */
  resultScreen: {
    screenTitle: "Kết quả bài thi",
    scoreLabel: "Điểm của bạn",
    correctCountLabel: "Số câu đúng",
    durationLabel: "Thời gian làm bài",
    skillBreakdownTitle: "Kết quả theo kỹ năng",
    reviewLink: "Xem lại bài đã làm",
    chooseAnotherButton: "Chọn đề khác",
    retryButton: "Làm lại",
  },
};
