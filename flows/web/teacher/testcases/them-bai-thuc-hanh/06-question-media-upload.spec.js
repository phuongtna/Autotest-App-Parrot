import { test, expect } from "../../../../../automation/giao_bai_tap/playwrightTest.js";
import {
  themBaiThucHanhPageObjects as po,
  loginTeacherPortalUi,
  gotoKhoi,
  openUnit,
  openLesson,
  createPractice,
  deletePracticeByTitle,
  markAnswerCorrect,
  deleteAnswerRow,
  questionTitleAttachButton,
  answerAttachButton,
  attachMediaFile,
  mediaPreviewLocator,
  removeAttachedMedia,
} from "../../../../../automation/them_bai_thuc_hanh/navigation/themBaiThucHanhPageObjects.js";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "../../../../../automation/them_bai_thuc_hanh/fixtures/upload-files");

/**
 * Nhóm E2 (TC_TBT_029/031/032/033) - Đính kèm Audio/Ảnh/Video cho câu hỏi (Tiêu đề câu hỏi + từng
 * đáp án) trong trang "Chỉnh sửa đề bài" (xem Ke_hoach_Automation_Them_Bai_Thuc_Hanh.docx mục 6.3
 * + 5).
 *
 * TỰ ĐỘNG HOÀN TOÀN (2026-09-24, chỉ đạo trực tiếp từ user - GHI ĐÈ yêu cầu "Bán tự động (BT)" ban
 * đầu ở docx mục 6.3, vốn yêu cầu `page.pause()` chờ người test tự chọn file): mọi bước "Upload
 * File" dưới đây dùng `attachMediaFile()` (page objects) - bắt sự kiện native file chooser bằng
 * `page.waitForEvent("filechooser")` rồi `chooser.setFiles()` nạp thẳng 1 file mẫu có sẵn trong
 * `fixtures/upload-files/` (xem `FIXTURES` bên dưới, ánh xạ theo ĐÚNG loại file test case cần:
 * Audio -> .wav thật, Ảnh -> .jpg thật, Video -> .mp4, sai định dạng -> .exe, quá khổ -> .jpg lớn).
 * KHÔNG còn dừng lại chờ người test thao tác - chạy được thẳng trên CI headless, không cần
 * `THEM_BAI_THUC_HANH_HEADLESS=false` nữa (dù vẫn bật được để xem trực quan nếu muốn).
 *
 * Nếu 1 file mẫu trong `FIXTURES` bị xoá/không đọc được, `attachMediaFile()` throw lỗi rõ ràng
 * ngay lập tức (không âm thầm bỏ qua) - đúng yêu cầu chỉ cần người can thiệp khi THẬT SỰ không có
 * file phù hợp nào, không phải mặc định mọi lần.
 *
 * ĐÃ XÁC NHẬN THẬT (2026-09-23, debug live bằng Playwright trực tiếp trên dev - dùng đúng kỹ thuật
 * `attachMediaFile()` này để tự khảo sát cấu trúc DOM trước khi viết test):
 *   - Loại câu hỏi mặc định "Chọn một" có sẵn 4 đáp án A-D, MỖI đáp án + Tiêu đề câu hỏi đều có bộ
 *     3 nút "+ Audio"/"+ Ảnh"/"+ Video" RIÊNG (cùng accessible name - phân biệt bằng `.nth()`, xem
 *     `questionTitleAttachButton()`/`answerAttachButton()` trong page objects).
 *   - "Lưu thay đổi" bị CHẶN HOÀN TOÀN (0 network request) nếu câu hỏi CHƯA chọn đáp án đúng -
 *     KHÔNG cần điền Nội dung câu hỏi/đáp án (để trống vẫn lưu được, miễn đã `markAnswerCorrect()`)
 *     - vì vậy các test dưới đây KHÔNG điền nội dung text (xem cảnh báo RTE chưa ổn định ở
 *     `fillQuestionContent`/`fillAnswerContent` trong page objects, không liên quan phạm vi này).
 *   - Toast lưu câu hỏi thật là "Cập nhật đề thành công" - KHÁC toast lúc `createPractice()` ("Tạo
 *     bài thực hành thành công"). Bug đo đạc đã gặp lúc khảo sát: dùng `/thành công/i` chung chung
 *     ngay sau khi vừa tạo bài đọc NHẦM toast cũ (chưa kịp tự ẩn) thành đã lưu câu hỏi thành công -
 *     TOÀN BỘ test dưới đây dùng ĐÚNG chuỗi `po.questionEditor.updateSuccessToast`.
 *   - Ảnh đính kèm -> `<img alt="preview">`; Audio -> `<audio controls>`. Sau khi Lưu thay đổi +
 *     reload, media giữ nguyên NGAY từ lần reload đầu tiên (KHÔNG có độ trễ lan truyền kiểu Tên
 *     đề/Kỹ năng đã gặp ở Nhóm E - xem TC_TBT_017/021).
 *   - CHƯA xác nhận thật trực tiếp preview của Video (`<video controls>` - suy ra tương tự Audio/
 *     Ảnh; `fixtures/upload-files/sample-video.mp4` là PLACEHOLDER không phải video phát được thật
 *     do máy viết test không có ffmpeg, xem `fixtures/upload-files/README.md`) - nếu assertion
 *     Video fail ở lần chạy thật đầu tiên, kiểm tra lại `mediaPreviewLocator()`/thay file mẫu.
 *   - Xoá 1 đáp án bằng icon thùng rác (`deleteAnswerRow()`) xoá ĐÚNG 1 đáp án, không ảnh hưởng
 *     đáp án khác hay media đã đính kèm ở đáp án khác.
 *
 * BUG CŨ ĐÃ FIX (docx mục 2.2, dòng 46 - TC_TBT_032, xác nhận sản phẩm KHÔNG validate định dạng/
 * kích thước file khi đính kèm Audio/Ảnh/Video): ĐÃ ĐƯỢC DEV FIX (xác nhận thật 2026-09-24) - hệ
 * thống giờ báo đúng lỗi "File không đúng định dạng ảnh. Vui lòng chọn lại file khác." và không
 * hiện preview cho file sai định dạng. TC_TBT_032 đã bỏ `test.fail()`, quay về assertion bình
 * thường như 1 test thường (không còn là bug-tracker).
 *
 * ENV (bắt buộc): SOURCE_BASE_URL, SOURCE_USERNAME, SOURCE_PASSWORD.
 * ENV (tuỳ chọn): PRACTICE_KHOI (default "11"), PRACTICE_UNIT_LABEL (default "UNIT 1: LEISURE TIME"),
 * PRACTICE_LESSON_WITH_ITEMS (default "READING").
 */
function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} (xem docblock đầu file).`);
  }
  return value;
}

// Ánh xạ loại file test case cần -> file mẫu có sẵn phù hợp nhất trong fixtures/upload-files/
// (tên khớp đúng mục đích: hợp lệ theo từng loại Audio/Ảnh/Video, sai định dạng, quá khổ).
const FIXTURES = {
  audio: path.join(FIXTURES_DIR, "sample-audio.wav"),
  image: path.join(FIXTURES_DIR, "sample-image.jpg"),
  video: path.join(FIXTURES_DIR, "sample-video.mp4"),
  imageAlt: path.join(FIXTURES_DIR, "oversized-image.jpg"), // "1 file KHÁC" hợp lệ dùng cho TC_033 (đính kèm lại).
  invalid: path.join(FIXTURES_DIR, "invalid-format.exe"),
  oversized: path.join(FIXTURES_DIR, "oversized-image.jpg"),
};

for (const [kind, filePath] of Object.entries(FIXTURES)) {
  if (!existsSync(filePath)) {
    throw new Error(
      `Thiếu file mẫu cho "${kind}" tại "${filePath}" - cần người can thiệp bổ sung file test phù hợp vào fixtures/upload-files/.`,
    );
  }
}

test.describe.serial("Thêm bài thực hành > Nhóm E2 - Đính kèm media câu hỏi (TC_TBT_029/031/032/033)", () => {
  const BASE_URL = readRequiredEnv("SOURCE_BASE_URL");
  const USERNAME = readRequiredEnv("SOURCE_USERNAME");
  const PASSWORD = readRequiredEnv("SOURCE_PASSWORD");
  const KHOI = process.env.PRACTICE_KHOI || "11";
  const UNIT_LABEL = process.env.PRACTICE_UNIT_LABEL || "UNIT 1: LEISURE TIME";
  const LESSON_LABEL = process.env.PRACTICE_LESSON_WITH_ITEMS || "READING";

  let context;
  let page;
  let createdTitle;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await loginTeacherPortalUi(page, { baseUrl: BASE_URL, username: USERNAME, password: PASSWORD });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test.beforeEach(async () => {
    await gotoKhoi(page, BASE_URL, KHOI);
    await openUnit(page, UNIT_LABEL);
    const opened = await openLesson(page, LESSON_LABEL);
    expect(opened, `Không tìm thấy Lesson "${LESSON_LABEL}" trong Unit "${UNIT_LABEL}".`).toBe(true);
  });

  test.afterEach(async () => {
    // Cờ tạm để GIỮ LẠI dữ liệu test cho người xem kiểm tra trực quan (theo yêu cầu) - mặc định
    // vẫn tự dọn dẹp như bình thường, chỉ bỏ qua khi bật rõ ràng.
    if (process.env.THEM_BAI_THUC_HANH_SKIP_CLEANUP === "true") {
      if (createdTitle) console.log(`[SKIP_CLEANUP] Giữ lại item "${createdTitle}" để kiểm tra trực quan.`);
      createdTitle = undefined;
      return;
    }
    if (createdTitle) {
      await gotoKhoi(page, BASE_URL, KHOI);
      await openUnit(page, UNIT_LABEL);
      await openLesson(page, LESSON_LABEL);
      // Cùng kỹ thuật retry+reload đã xác nhận thật ở 05-quiz-edit-navigation.spec.js - danh sách
      // Lesson có thể có độ trễ lan truyền riêng cho item vừa Lưu thay đổi.
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await deletePracticeByTitle(page, createdTitle);
          break;
        } catch {
          if (attempt < 4) {
            await page.waitForTimeout(3000);
            await page.reload({ waitUntil: "networkidle" });
          }
        }
      }
      createdTitle = undefined;
    }
  });

  async function addQuestionAndMarkFirstAnswerCorrect() {
    await page.getByRole("button", { name: po.quizEditPage.addQuestionButton, exact: true }).click();
    await page.getByText(po.questionEditor.answerListHeading, { exact: true }).waitFor({ state: "visible", timeout: 10000 });
    // Bắt buộc - "Lưu thay đổi" bị chặn hoàn toàn nếu câu hỏi chưa chọn đáp án đúng (đã xác nhận
    // thật, xem docblock đầu file) - không liên quan tới nội dung text nào đã điền hay chưa.
    await markAnswerCorrect(page, 0);
  }

  async function saveAndAssertSuccess() {
    await page.getByRole("button", { name: po.quizEditPage.saveButton, exact: true }).click();
    await expect(page.getByText(po.questionEditor.updateSuccessToast, { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await page.waitForLoadState("networkidle");
  }

  test('TC_TBT_029: đính kèm Audio/Ảnh/Video cho Tiêu đề câu hỏi - giữ nguyên sau Lưu/mở lại', async () => {
    createdTitle = `AUTO_QA_TBT029_${Date.now()}`;
    await createPractice(page, createdTitle);
    await addQuestionAndMarkFirstAnswerCorrect();

    for (const kind of ["audio", "image", "video"]) {
      await attachMediaFile(page, questionTitleAttachButton(page, kind), FIXTURES[kind]);
      // Verify upload thành công trước khi sang loại media tiếp theo.
      await expect(mediaPreviewLocator(page, kind, 0), `Preview "${kind}" phải hiện ra sau khi upload`).toBeVisible({
        timeout: 15000,
      });
    }

    await saveAndAssertSuccess();
    await page.reload({ waitUntil: "networkidle" });
    for (const kind of ["audio", "image", "video"]) {
      await expect(mediaPreviewLocator(page, kind, 0), `Media "${kind}" ở Tiêu đề câu hỏi phải giữ nguyên sau reload`).toBeVisible(
        { timeout: 10000 },
      );
    }
  });

  test('TC_TBT_031: đính kèm media cho 1 đáp án + xoá 1 đáp án khác - không ảnh hưởng lẫn nhau', async () => {
    createdTitle = `AUTO_QA_TBT031_${Date.now()}`;
    await createPractice(page, createdTitle);
    await addQuestionAndMarkFirstAnswerCorrect();

    await attachMediaFile(page, answerAttachButton(page, 1, "image"), FIXTURES.image); // đáp án B (index 1)
    await expect(mediaPreviewLocator(page, "image", 0), "Preview ảnh ở đáp án B phải hiện ra sau khi upload").toBeVisible({
      timeout: 15000,
    });

    const contentPlaceholderBefore = await page
      .getByText(po.questionEditor.contentPlaceholderText, { exact: true })
      .count();
    await deleteAnswerRow(page, 3); // xoá đáp án D (Full-Auto, không cần chọn file)
    await expect(async () => {
      const countNow = await page.getByText(po.questionEditor.contentPlaceholderText, { exact: true }).count();
      expect(countNow, "Xoá đáp án D phải giảm đúng 1 ô nội dung trống").toBe(contentPlaceholderBefore - 1);
    }).toPass({ timeout: 5000 });

    // Media đính kèm ở đáp án B không bị ảnh hưởng bởi việc xoá đáp án D.
    await expect(mediaPreviewLocator(page, "image", 0), "Media đáp án B phải còn nguyên sau khi xoá đáp án D").toBeVisible();

    await saveAndAssertSuccess();
    await page.reload({ waitUntil: "networkidle" });
    await expect(mediaPreviewLocator(page, "image", 0), "Media đáp án B phải giữ nguyên sau reload").toBeVisible({ timeout: 10000 });
  });

  test('TC_TBT_032: đính kèm file sai định dạng/vượt kích thước - PHẢI bị chặn', async () => {
    // BUG cũ (docx mục 2.2) ĐÃ ĐƯỢC DEV FIX (xác nhận thật 2026-09-24, chỉ đạo trực tiếp từ user +
    // verify lại bằng script riêng): hệ thống giờ báo lỗi đúng "File không đúng định dạng ảnh. Vui
    // lòng chọn lại file khác." và KHÔNG hiện preview khi đính kèm file sai định dạng - bỏ
    // `test.fail()`, quay về assertion bình thường (test này giờ PASS thật, không còn là bug-tracker).
    createdTitle = `AUTO_QA_TBT032_${Date.now()}`;
    await createPractice(page, createdTitle);
    await addQuestionAndMarkFirstAnswerCorrect();

    // Dùng file sai định dạng (.exe) - có thể đổi sang FIXTURES.oversized để thử case vượt kích
    // thước thay vì sai định dạng.
    await attachMediaFile(page, questionTitleAttachButton(page, "image"), FIXTURES.invalid);

    await expect(
      page.getByText(/không đúng định dạng|định dạng không (được )?hỗ trợ|sai định dạng|vượt quá dung lượng|kích thước tối đa/i).first(),
      "Hệ thống phải báo lỗi và KHÔNG hiện preview khi file sai định dạng/vượt kích thước",
    ).toBeVisible({ timeout: 8000 });
    await expect(mediaPreviewLocator(page, "image", 0), "KHÔNG được hiện preview cho file không hợp lệ").toHaveCount(0);
  });

  test('TC_TBT_033: xoá 1 file media đã đính kèm (giữ nguyên đáp án) rồi đính kèm lại file khác', async () => {
    createdTitle = `AUTO_QA_TBT033_${Date.now()}`;
    await createPractice(page, createdTitle);
    await addQuestionAndMarkFirstAnswerCorrect();

    await attachMediaFile(page, answerAttachButton(page, 0, "image"), FIXTURES.image);
    await expect(mediaPreviewLocator(page, "image", 0), "Preview phải hiện ra sau khi upload lần 1").toBeVisible({ timeout: 15000 });

    // Xoá riêng file đã đính kèm (Full-Auto - không cần chọn file, chỉ hover + bấm nút "Xoá").
    await removeAttachedMedia(page, mediaPreviewLocator(page, "image", 0));
    await expect(mediaPreviewLocator(page, "image", 0), "Preview phải biến mất sau khi xoá file").toHaveCount(0);
    // Đáp án A vẫn còn (không bị xoá cả đáp án, chỉ xoá file media của nó).
    await expect(page.getByText("A.", { exact: true }).first()).toBeVisible();

    // Đính kèm lại bằng 1 file KHÁC (FIXTURES.imageAlt, không phải file vừa xoá).
    await attachMediaFile(page, answerAttachButton(page, 0, "image"), FIXTURES.imageAlt);
    await expect(mediaPreviewLocator(page, "image", 0), "Đính kèm lại phải hoạt động bình thường").toBeVisible({ timeout: 15000 });

    await saveAndAssertSuccess();
    await page.reload({ waitUntil: "networkidle" });
    await expect(mediaPreviewLocator(page, "image", 0), "File đính kèm lại phải giữ nguyên sau reload").toBeVisible({
      timeout: 10000,
    });
  });
});
