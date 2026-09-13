/**
 * Page Objects cho trang "Báo cáo lớp" của 1 bài tập (Web GV, /teacher/exercise/{roomId}/report)
 * - dùng bởi automation/bao_cao_speaking/ (test case xem TestCase_BaoCaoSpeaking.xlsx).
 *
 * ĐÃ XÁC NHẬN THẬT (2026-09-11, Dev https://parrotedu.codeinet.com, tài khoản GV
 * TEACHER_USERNAME_SPEAKING_REPORT, lớp 11A2, bài "Vocab" roomId=9cf81245-787e-44c8-8178-d66794f9832a,
 * 3/3 HS đã nộp): điều hướng tới trang này KHÔNG có nút "Xem báo cáo" riêng ở màn "Báo cáo học
 * tập" (/teacher/dashboard) như đoán ban đầu - link "Xem báo cáo" THẬT RA nằm ở màn "Giao bài tập"
 * (/teacher/exercise, bảng "Danh sách bài tập đã giao", cột "HÀNH ĐỘNG") - TÁI DÙNG
 * automation/giao_bai_tap/navigation/teacherAssignedListPageObjects.js (gotoAssignedList,
 * locateAssignedRow/locateAssignedRowAcrossPages, openRowReport) để tới đây, KHÔNG viết lại.
 *
 * API THẬT đứng sau trang (network capture thật, dùng để mock ở Tầng 2 - xem plan mục 3):
 *   - GET /api/user/report-stats/room-analytic?room_id={roomId}
 *       -> { submitted: [{id,profile_id,name,avatar,score}], not_submitted: [...],
 *            score_distribution: {below_5, from_5_to_6.9, from_7_to_8.9, from_9_to_10} }
 *       Nguồn dữ liệu cho "Chưa nộp bài"/"Đã hoàn thành"/"Phổ điểm".
 *   - GET /api/user/report-stats/room-questions-analytic?room_id={roomId}
 *       -> { questions_analysis: [{question_id, question_index, type, answer_stats,
 *            incorrect_count, error_rate}] } - nguồn dữ liệu "Phân tích lỗi sai" (10 ô C1..C10).
 *   - GET /api/user/report-stats/question-detail-analytic?question_id={qId}&room_id={roomId}
 *       -> { question: {content,image,title,...}, type: "SPEAK",
 *            correct_answer_groups: [...], incorrect_answer_groups: [
 *              { user_id, user_name, avatar, is_correct, answer: {
 *                  accuracy_score, actual_spoken_text, assessment_details: [
 *                    { text, is_error, error_type, syllables: [{text,is_error}] } ] } } ],
 *            total_answered, correct_count, incorrect_count }
 *       Nguồn dữ liệu CHÍNH XÁC cho tab Sai/Đúng + badge % + tô màu từ sai (TC_033) - phân loại
 *       Sai/Đúng đã có sẵn qua correct_answer_groups/incorrect_answer_groups (server tính sẵn,
 *       KHÔNG phải client tự so accuracy_score >= 51 - quan trọng cho Nhóm A/D khi viết mock).
 *   - QUAN TRỌNG (sửa nhận định trong plan mục 3): dữ liệu THẬT trên Dev ĐÃ CÓ SẴN accuracy_score
 *     = 51 và 49 ở câu "clothes" (question_id 156fc687-...) - ranh giới 50/51 KHÔNG hẳn "không thể
 *     ép ra chính xác" như plan giả định, ít nhất trên Dev đã có sẵn ca thật này, có thể dùng thay
 *     vì phải mock nếu dữ liệu không đổi.
 *
 * Cấu trúc UI KHÔNG có data-testid (đã quét toàn trang, mảng data-testid rỗng) - selector phải
 * dựa vào role/text hiển thị thật (giống convention teacherPortalPageObjects.js).
 */

/** Panel bên phải chứa toàn bộ khối câu hỏi đang chọn (tiêu đề "CÂU N" + tab Sai/Đúng + danh sách
 * thẻ học sinh) - ĐÃ XÁC NHẬN THẬT (2026-09-11, HTML dump): panel này có class Tailwind cố định
 * `lg:w-[40%]`, TÁCH BIỆT hoàn toàn khỏi panel "Chưa nộp bài"/"Đã hoàn thành" ở phía trên (nằm
 * trong 1 section KHÁC của trang) - dùng làm SEARCH ROOT cho studentAnswerCard() để KHÔNG BAO GIỜ
 * khớp nhầm 2 panel đó, bất kể "gần" hay "xa" trong DOM (xem lịch sử sửa 2 lần trước ở
 * studentAnswerCard - cả 2 lần đều chỉ thu hẹp cách LEO ancestor, vẫn khớp nhầm vì 2 panel kia
 * nằm CHUNG 1 tổ tiên đủ gần với danh sách thẻ thật; scope theo panel loại bỏ tận gốc, không phụ
 * thuộc khoảng cách DOM). */
function questionDetailPanel(page) {
  return page.locator('div[class*="lg:w-\\[40\\%\\]"]');
}

/** Bấm 1 thẻ học sinh (theo tên) trong danh sách Sai/Đúng để mở rộng/thu gọn - ĐÃ XÁC NHẬN THẬT:
 * bấm vào phần thân thẻ (không phải link tên trong "Đã hoàn thành" ở trên - đó là link điều
 * hướng sang "/result/{userId}", KHÁC thẻ này) mở ra khối "Học sinh phát âm là: <câu>" ngay bên
 * dưới; bấm lại thu gọn; bấm nút audio khi đang mở rộng KHÔNG làm thẻ thu gọn lại. */
export function studentAnswerCard(page, studentName) {
  return questionDetailPanel(page)
    .locator("div", { hasText: studentName })
    .filter({ has: page.getByRole("button", { name: po.audioButtonName }) })
    .last();
}

/** Số thẻ học sinh ĐANG HIỂN THỊ trong tab Sai/Đúng đang active - đếm qua SỐ NÚT AUDIO trong panel
 * (mỗi thẻ có ĐÚNG 1 nút audio, đã xác nhận thật) thay vì đếm div (dễ đếm trùng do div lồng nhau
 * cùng khớp điều kiện - xem lịch sử sửa studentAnswerCard) - dùng cho TC_010 (không lẫn/duplicate
 * dữ liệu khi chuyển tab nhanh). */
export function visibleStudentCardCount(page) {
  return questionDetailPanel(page).getByRole("button", { name: po.audioButtonName }).count();
}

export const po = {
  // Tab chuyển đổi trong khối câu hỏi đang chọn - text thật kèm số đếm, vd "Sai (3)"/"Đúng (0)".
  wrongTab: (count) => `Sai (${count})`,
  correctTab: (count) => `Đúng (${count})`,
  wrongTabAny: /^Sai \(\d+\)$/,
  correctTabAny: /^Đúng \(\d+\)$/,

  // ĐÃ XÁC NHẬN THẬT: accessible name thật của nút loa trên mỗi thẻ học sinh.
  audioButtonName: "Nghe lại phát âm của học sinh",

  // Khối transcription hiện ra khi thẻ mở rộng - text cố định đứng trước câu HS phát âm.
  expandedTranscriptionLabel: "Học sinh phát âm là:",

  // Panel "Chưa nộp bài"/"Đã hoàn thành" (đầu trang report).
  notSubmittedHeading: (count) => `Chưa nộp bài (${count})`,
  completedHeading: (count) => `Đã hoàn thành (${count})`,
  allSubmittedMessage: "Tất cả học sinh đã nộp bài!",

  // Khối "Phân tích lỗi sai" + badge câu đang chọn, vd "CÂU 8".
  errorAnalysisHeading: "Phân tích lỗi sai",
  currentQuestionBadge: (n) => `CÂU ${n}`,

  // ĐÃ XÁC NHẬN THẬT (2026-09-11, getComputedStyle qua mock Tầng 2) - màu badge % trên thẻ HS:
  // Đúng = xanh lá, Sai = đỏ/cam (TC_053).
  correctBadgeColorRgb: "rgb(57, 218, 132)",
  wrongBadgeColorRgb: "rgb(255, 106, 85)",

  // Text hiển thị khi 1 tab (Sai hoặc Đúng) rỗng - ĐÃ XÁC NHẬN THẬT qua mock (TC_008/TC_009).
  // KHÁC với allSubmittedMessage ở trên (đó là panel "Chưa nộp bài" rỗng, khác khối này).
  emptyTabMessage: "Không có học sinh nào.",

  // ĐÃ XÁC NHẬN THẬT (2026-09-11, HTML dump qua mock) - mỗi từ trong khối "Học sinh phát âm là:"
  // là 1 <span> riêng; từ sai (assessment_details[].is_error=true) có class "text-[#FF3B30]" (đỏ),
  // từ đúng có class="" (giữ màu mặc định) - MÀU KHÁC với wrongBadgeColorRgb ở trên (2 chỗ tô màu
  // "sai" độc lập nhau trong UI, không dùng chung 1 token màu).
  wrongWordColorRgb: "rgb(255, 59, 48)",

  // ĐÃ XÁC NHẬN THẬT (2026-09-11, dump class SVG <text> qua mock) - nhãn "C{n}" trong biểu đồ
  // "Phân tích lỗi sai" (Recharts) đổi class theo error_rate: >=50% -> "fill-error-dark" (đỏ),
  // <50% -> "fill-slate-400" (xám) - dùng cho TC_046.
  errorRateHighClass: "fill-error-dark",
  errorRateLowClass: "fill-slate-400",
};

/** Nhãn "C{n}" trong biểu đồ "Phân tích lỗi sai" (SVG <text>, Recharts) - bấm vào để chọn câu đó
 * (TC_047, ĐÃ XÁC NHẬN THẬT), đọc class để biết ngưỡng màu (TC_046). */
export function questionCell(page, questionNumber) {
  return page.getByText(`C${questionNumber}`, { exact: true });
}

/** 1 từ trong khối transcription "Học sinh phát âm là: <câu>" khi thẻ ĐANG MỞ RỘNG - dùng để đọc
 * màu tô đỏ/mặc định theo từng từ (TC_033). Thẻ phải mở rộng trước khi gọi (xem isCardExpanded/
 * studentAnswerCard(...).click()). */
export function transcriptionWord(page, studentName, word) {
  const card = studentAnswerCard(page, studentName);
  return card.locator("xpath=following-sibling::*[1]").getByText(word, { exact: true });
}

/** Tổng các số hiển thị trên 4 cột "Phổ điểm" (Dưới 5/5-6,9/7-8,9/9-10) - dùng cho TC_045 (tổng
 * phải khớp số "Đã hoàn thành (N)"). ĐÃ XÁC NHẬN THẬT (2026-09-11): giá trị mỗi cột là <text> SVG
 * (Recharts) nằm phía TRÊN 4 nhãn trục X - lọc theo toạ độ Y nhỏ hơn Y của heading "Phân tích lỗi
 * sai" (biểu đồ Phổ điểm luôn nằm TRÊN, tách biệt hẳn) để không lẫn với số trong biểu đồ kia. */
export async function getScoreDistributionSum(page) {
  const collect = (errorAnalysisHeadingText) => {
    const analysisHeading = Array.from(document.querySelectorAll("h3")).find(
      (h) => h.textContent.trim() === errorAnalysisHeadingText,
    );
    if (!analysisHeading) return null;
    const cutoffY = analysisHeading.getBoundingClientRect().y;
    const values = Array.from(document.querySelectorAll("svg text"))
      .filter((t) => /^\d+$/.test(t.textContent.trim()) && t.getBoundingClientRect().y < cutoffY)
      .map((t) => Number(t.textContent.trim()));
    return values.length ? values : null;
  };

  // SỬA (2026-09-11, FAIL thật xác nhận qua chạy live - TC_045 ra sum=0 dù dữ liệu mock đúng): chờ
  // CỐ ĐỊNH (waitForTimeout) trước khi đọc không đáng tin - biểu đồ Recharts có animation vào,
  // thời gian render thực tế dao động (đã thấy 1000ms KHÔNG đủ, 2500ms đủ ở lần chạy riêng lẻ
  // nhưng KHÔNG đủ khi chạy trong bộ suite đầy đủ). Poll tới khi thấy ÍT NHẤT 1 giá trị số thay vì
  // đoán 1 khoảng chờ cố định.
  const values = await page.waitForFunction(collect, po.errorAnalysisHeading, { timeout: 10000 }).then(
    (handle) => handle.jsonValue(),
    () => null,
  );
  if (!values) {
    throw new Error(
      "getScoreDistributionSum: không tìm thấy giá trị số nào trên biểu đồ 'Phổ điểm' sau 10s - " +
        "biểu đồ có thể chưa render xong hoặc heading 'Phân tích lỗi sai' không tồn tại.",
    );
  }
  return values.reduce((a, b) => a + b, 0);
}

/** Badge % trên thẻ học sinh (thu gọn hay mở rộng đều thấy) - dùng để đọc màu (TC_053) hoặc số %
 * hiển thị. */
export function studentScoreBadge(page, studentName) {
  return studentAnswerCard(page, studentName).getByText(/^\d+%$/);
}

/** Trả về true nếu thẻ học sinh (đã lấy qua studentAnswerCard) đang ở trạng thái mở rộng - dựa
 * vào việc khối "Học sinh phát âm là:" có đang hiển thị NGAY SAU thẻ hay không (không dùng CSS
 * class - toàn bộ class trên trang là utility Tailwind tự sinh, không ổn định để bám vào). */
export async function isCardExpanded(page, studentName) {
  const card = studentAnswerCard(page, studentName);
  const followingBlock = card.locator(
    `xpath=following-sibling::*[1][contains(., "${po.expandedTranscriptionLabel}")]`,
  );
  return (await followingBlock.count()) > 0;
}

/** Bấm audio (KHÔNG đụng vào phần thân thẻ) - dùng để test TC_013/TC_019/TC_020 (audio không làm
 * đổi trạng thái mở rộng/thu gọn của thẻ). */
export async function clickAudioButton(page, studentName) {
  const card = studentAnswerCard(page, studentName);
  await card.getByRole("button", { name: po.audioButtonName }).click();
}

/** Trả về locator `<audio>` THẬT tương ứng với 1 học sinh.
 *
 * SỬA (2026-09-11, FAIL thật xác nhận qua debug HTML dump thật): bản đầu tính index bằng
 * `studentAnswerCard(...).parentElement.children.indexOf(...)` - SAI, vì `studentAnswerCard()`
 * dùng `.last()` để chọn div "sâu nhất" khớp hasText+has(button) (cần thiết để tránh khớp nhầm
 * div cha bọc ngoài), div đó thường là 1 wrapper NẰM BÊN TRONG thẻ (vd hàng chứa tên+audio+badge),
 * KHÔNG phải chính thẻ "rounded-xl" cấp ngoài cùng - nên "index trong parent.children" ra số vị
 * trí trong ĐÚNG 1 thẻ (vd 0/1/2 giữa avatar/tên/badge), KHÔNG phải vị trí thẻ đó giữa 3 thẻ trong
 * danh sách - `page.locator("audio").nth(index)` vì vậy trỏ nhầm audio của HS khác (xác nhận thật
 * qua HTML dump: audio.parentElement luôn là `div.rounded-xl border...`, KHÁC cấp với div mà
 * studentAnswerCard() trả về).
 *
 * SỬA ĐÚNG: leo từ nút audio (chắc chắn nằm trong CHÍNH thẻ của học sinh đó) lên tới ancestor GẦN
 * NHẤT có chứa `<audio>` bên trong nó - ancestor đó chính là thẻ "rounded-xl" của học sinh này,
 * loại bỏ hoàn toàn phụ thuộc vào cấu trúc/độ sâu DOM cụ thể hay thứ tự anh em. */
export async function studentAudioElement(page, studentName) {
  const card = studentAnswerCard(page, studentName);
  const audioButton = card.getByRole("button", { name: po.audioButtonName });
  return audioButton.locator("xpath=ancestor::div[.//audio][1]//audio");
}

/** true nếu `<audio>` của học sinh đang phát (`!paused`) - ĐÃ XÁC NHẬN THẬT: bấm nút loa gọi
 * `audio.play()` thật (không phải animation giả), `paused` chuyển `false` NGAY khi bấm (đồng bộ,
 * không cần chờ tải xong mới phát hiện được), và bấm audio của HS KHÁC trong khi đang phát sẽ set
 * `paused=true` lại cho audio đang phát trước đó (chỉ 1 audio phát cùng lúc, xem TC_020). */
export async function isStudentAudioPlaying(page, studentName) {
  const audio = await studentAudioElement(page, studentName);
  return audio.evaluate((el) => !el.paused);
}

/** Chờ tới khi audio của học sinh THẬT SỰ đang phát (`paused===false`), tối đa `timeoutMs`.
 * SỬA (2026-09-11, FAIL thật xác nhận qua chạy live TC_020): khi đang dừng audio HS A để phát HS
 * B, có 1 nhịp chuyển tiếp ngắn (dừng A -> React re-render -> mới gọi `play()` cho B) - kiểm tra
 * NGAY sau click đôi khi bắt trúng đúng lúc B chưa kịp `play()` (đọc `paused=true` giả), gây FAIL
 * giả dù hành vi cuối cùng đúng. Poll thay vì check tức thời để chỉ fail khi THẬT SỰ không bao
 * giờ chuyển sang phát, không phải do trễ 1 nhịp render. */
export async function waitForStudentAudioPlaying(page, studentName, timeoutMs = 3000) {
  const audio = await studentAudioElement(page, studentName);
  await audio
    .evaluate(
      (el, timeout) =>
        new Promise((resolve, reject) => {
          if (!el.paused) return resolve();
          const start = Date.now();
          const check = () => {
            if (!el.paused) return resolve();
            if (Date.now() - start > timeout) return reject(new Error("audio never started playing"));
            requestAnimationFrame(check);
          };
          check();
        }),
      timeoutMs,
    )
    .catch(() => {
      throw new Error(
        `waitForStudentAudioPlaying: audio của "${studentName}" không chuyển sang trạng thái ` +
          `đang phát trong ${timeoutMs}ms.`,
      );
    });
}
