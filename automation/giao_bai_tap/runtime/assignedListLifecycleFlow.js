import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loginTeacherPortal } from "../navigation/teacherPortalSession.js";
import { assignHomeworkFlow, AssignHomeworkAssertionError } from "./assignHomeworkFlow.js";
import {
  fetchEligibleAssignmentTree,
  filterEligibleTree,
  resolveClassId,
  findRoomIdByLessonItem,
  findRoomById,
  NoEligibleAssignmentError,
  RoomNotFoundError,
} from "../navigation/teacherAssignmentApiDiscovery.js";
import {
  gotoAssignedList,
  editDueDateAndSave,
  deleteFromEditPage,
} from "../navigation/teacherAssignedListPageObjects.js";
import { teacherPortalPageObjects as po } from "../navigation/teacherPortalPageObjects.js";
import { config } from "../../src/config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, "..", "..", "output", "screenshots");

export { AssignHomeworkAssertionError, RoomNotFoundError };
export class AssignedListLifecycleAssertionError extends Error {}

/** Parse "DD/MM/YYYY" -> {day, month} số nguyên. */
function parseDdMmYyyy(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) {
    throw new AssignedListLifecycleAssertionError(`dueDate "${value}" không đúng format "DD/MM/YYYY".`);
  }
  const [, dd, mm] = match;
  return { day: Number(dd), month: Number(mm) };
}

/** "DD/MM/YYYY" -> "YYYY-MM-DD" (so khớp tiền tố với room.end_time dạng ISO UTC - xem
 * navigation/teacherAssignmentApiDiscovery.js#findRoomById). Lưu ý end_time là 23:59:59 giờ VN
 * (UTC+7) = 16:59:59.999Z cùng ngày - so khớp tiền tố ngày vẫn đúng vì KHÔNG lệch ngày (16:59Z
 * vẫn cùng ngày dương lịch UTC với ngày VN tương ứng). */
function ddmmyyyyToIsoDatePrefix(value) {
  const [dd, mm, yyyy] = value.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

const REQUIRED_PARAMS = ["primaryClass", "dueDate", "newDueDate"];

/**
 * Test flow màn "Danh sách bài tập đã giao" (Web GV, theo đúng flow user mô tả):
 *   đăng nhập GV -> menu "Giao bài tập" -> danh sách bài tập đã giao -> "Xem chi tiết" (report)
 *   -> "Sửa" hạn nộp -> Lưu -> "Xóa".
 *
 * AN TOÀN: KHÔNG đụng tới bất kỳ dòng có sẵn nào (có thể chứa dữ liệu làm bài thật của HS) - tự
 * TẠO 1 assignment mới (tái sử dụng assignHomeworkFlow.js, đã verify thật ở TC1) rồi CHỈ thao tác
 * (xem báo cáo/sửa/xóa) trên đúng dòng vừa tạo đó, giống pattern "tạo rồi xóa" đã dùng cho
 * DEL-02 (xoá lớp học) - xem flows/web/teacher/testcases/lop-phu-trach/e2e-delete-class-success.mjs.
 *
 * DÙNG API (findRoomIdByLessonItem) ĐỂ LẤY ĐÚNG room.id THẬT thay vì dò trên DOM danh sách (bấm
 * "Xem chi tiết"/"Sửa" của 1 dòng CHÍNH LÀ điều hướng tới "/teacher/exercise/{room.id}/report|edit"
 * - xem navigation/teacherPortalPageObjects.js#editPage - nên điều hướng thẳng bằng URL này tương
 * đương chính xác với bấm dòng đó). ĐÃ THỬ dò qua DOM (title+lớp+hạn nộp) và LOẠI BỎ - xác nhận
 * thật (2026-08-27) title bài tập rất chung chung, lặp lại giữa NHIỀU catalog item khác nhau (2
 * assignment thật trùng title+lớp+hạn nộp cùng lúc), khiến so khớp qua DOM bị ambiguous/không xác
 * định được đúng dòng - xem docblock findRoomIdByLessonItem để biết đầy đủ.
 *
 * @param {object} params
 * @param {string} params.primaryClass - lớp giao bài (vd "3B").
 * @param {string} params.dueDate - hạn nộp lúc TẠO, format "DD/MM/YYYY".
 * @param {string} params.newDueDate - hạn nộp MỚI dùng ở bước Sửa, format "DD/MM/YYYY" (PHẢI
 *   khác params.dueDate để phân biệt được đã sửa thật hay chưa).
 * @param {string} [params.unitName] / [params.lessonName] / [params.homeworkItemName] /
 *   [params.homeworkItemId] - CHỈ ĐỊNH SẴN (debug) - không truyền thì random 1 item KHÔNG phải
 *   SPEAK (xem lý do loại SPEAK bên dưới).
 * @param {boolean} [params.headless=true]
 * @returns {Promise<{status:"PASS"|"FAIL", steps, error?, selection}>}
 */
export async function assignedListLifecycleFlow(params) {
  const missing = REQUIRED_PARAMS.filter((key) => !params[key]);
  if (missing.length > 0) {
    throw new AssignedListLifecycleAssertionError(`Thiếu tham số bắt buộc: ${missing.join(", ")}`);
  }
  if (params.dueDate === params.newDueDate) {
    throw new AssignedListLifecycleAssertionError(
      "newDueDate phải KHÁC dueDate ban đầu để phân biệt được đã sửa thật hay chưa.",
    );
  }

  const {
    primaryClass,
    dueDate,
    newDueDate,
    unitName,
    lessonName,
    homeworkItemName,
    headless = true,
    debugDump = false,
  } = params;

  const steps = [];
  function step(name, fn, { page } = {}) {
    return async () => {
      try {
        await fn();
        steps.push({ name, status: "PASS" });
      } catch (err) {
        let screenshotPath = null;
        if (debugDump && page) {
          mkdirSync(SCREENSHOT_DIR, { recursive: true });
          screenshotPath = join(SCREENSHOT_DIR, `assignedListLifecycle_${name}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {
            screenshotPath = null;
          });
        }
        steps.push({ name, status: "FAIL", error: err.message, screenshotPath });
        throw err;
      }
    };
  }

  let selection = null;
  let homeworkItemId = params.homeworkItemId;

  // ĐÃ XÁC NHẬN THẬT (2026-08-27, FAIL thật xác nhận qua 1 lượt chạy): assignment type "SPEAK"
  // (kỹ năng SPEAKING) có link "Xem báo cáo" HỎNG trên danh sách (bấm vào không điều hướng đúng
  // sang "/report", url dừng lại ở "/teacher/exercise" cụt - PHÙ HỢP với ghi chú đã biết "Speaking
  // không đăng ký được điểm", xem project_exercise_types_scoring_capability trong memory). Test
  // này CHỈ kiểm tra cơ chế màn danh sách (xem/sửa/xóa), không phải hành vi riêng của SPEAK -
  // CHỦ ĐỘNG loại SPEAK khi tự random (không đụng tới khi caller đã CHỈ ĐỊNH SẴN homeworkItemId/
  // homeworkItemName - tôn trọng lựa chọn tường minh của caller).
  if (!homeworkItemId && !homeworkItemName) {
    await step("pickNonSpeakAssignment", async () => {
      const { eligibleTree } = await fetchEligibleAssignmentTree(primaryClass);
      const scoped = filterEligibleTree(eligibleTree, { unitName, lessonName });
      const nonSpeakUnits = scoped
        .map((u) => ({ ...u, lessons: u.lessons.map((l) => ({ ...l, items: l.items.filter((it) => !it.isSpeak) })).filter((l) => l.items.length > 0) }))
        .filter((u) => u.lessons.length > 0);
      if (nonSpeakUnits.length === 0) {
        throw new NoEligibleAssignmentError(
          "Không tìm thấy assignment eligible nào KHÔNG phải SPEAK để dùng cho test danh sách.",
        );
      }
      const unit = nonSpeakUnits[Math.floor(Math.random() * nonSpeakUnits.length)];
      const lesson = unit.lessons[Math.floor(Math.random() * unit.lessons.length)];
      const item = lesson.items[Math.floor(Math.random() * lesson.items.length)];
      homeworkItemId = item.id;
      params.unitName = unit.unitName;
      // ĐÃ XÁC NHẬN THẬT (2026-08-27, FAIL thật xác nhận qua 1 lượt chạy trúng Unit "Review 3"):
      // nút "Chọn Lesson" thật trên UI hiển thị `lesson.tag.name` (vd "Vocabulary"), KHÔNG PHẢI
      // `lesson.name` thô (vd "SPEAKING") - 2 field khác nhau với Unit dạng Review (xem comment
      // gốc tại teacherAssignmentApiDiscovery.js#fetchEligibleAssignmentTree, dòng gán
      // `lessonTag: lesson.tag?.name`). Dùng lessonTag khi có, fallback lessonName nếu không.
      params.lessonName = lesson.lessonTag ?? lesson.lessonName;
    })();
  }

  // Bước 1: TẠO assignment mới (session Playwright riêng, tự đóng browser khi xong - xem
  // assignHomeworkFlow.js) - đây chính là dữ liệu cần có sẵn để thao tác Xem chi tiết/Sửa/Xóa,
  // không đoán/không dùng dòng người khác đã tạo.
  const createResult = await assignHomeworkFlow({
    primaryClass,
    dueDate,
    unitName: params.unitName,
    lessonName: params.lessonName,
    homeworkItemName,
    homeworkItemId,
    headless,
    debugDump,
  });
  steps.push(...createResult.steps.map((s) => ({ ...s, name: `create.${s.name}` })));
  if (createResult.status !== "PASS") {
    return { status: "FAIL", steps, error: `Bước tạo assignment thất bại: ${createResult.error}`, selection: createResult.selection };
  }
  selection = createResult.selection;

  let roomId = null;
  let browser = null;
  try {
    await step("resolveRoomId", async () => {
      const classId = await resolveClassId(primaryClass);
      const room = await findRoomIdByLessonItem({
        lessonItemId: selection.exerciseId,
        classId,
        endTimeDatePrefix: ddmmyyyyToIsoDatePrefix(dueDate),
      });
      roomId = room.id;
    })();

    const opened = await loginTeacherPortal({ headless });
    browser = opened.browser;
    const page = opened.page;
    // "Hệ thống hiển thị danh sách bài tập giáo viên đã giao"
    await step("gotoAssignedList", async () => {
      await gotoAssignedList(page);
    }, { page })();

    // "Chọn Xem chi tiết để xem tiến độ và kết quả làm bài của từng học sinh trong lớp" - điều
    // hướng thẳng bằng room.id thật (tương đương bấm "Xem báo cáo" của đúng dòng vừa tạo - xem
    // docblock hàm này).
    await step("openReport", async () => {
      await page.goto(`${config.teacherPortalBaseUrl}/teacher/exercise/${roomId}/report`, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.getByText("Báo cáo lớp", { exact: true }).first().waitFor({ timeout: 15000 });
    }, { page })();

    // "Chọn sửa để chỉnh sửa Hạn nộp của bài tập -> Nhấn Lưu -> Hệ thống cập nhật hạn nộp mới"
    await step("openEditAndSaveNewDueDate", async () => {
      await page.goto(`${config.teacherPortalBaseUrl}/teacher/exercise/${roomId}/edit`, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.getByText(po.editPage.breadcrumb, { exact: true }).first().waitFor({ timeout: 15000 });
      const { day, month } = parseDdMmYyyy(newDueDate);
      await editDueDateAndSave(page, { day, month });
    }, { page })();

    await step("verifyDueDateUpdated", async () => {
      const room = await findRoomById(roomId);
      if (!room) {
        throw new AssignedListLifecycleAssertionError(`Không tìm thấy room "${roomId}" sau khi Sửa - có thể đã bị xóa nhầm.`);
      }
      const expectedPrefix = ddmmyyyyToIsoDatePrefix(newDueDate);
      if (!room.endTime.startsWith(expectedPrefix)) {
        throw new AssignedListLifecycleAssertionError(
          `Hạn nộp sau khi Sửa không khớp - kỳ vọng bắt đầu bằng "${expectedPrefix}", thực tế end_time="${room.endTime}".`,
        );
      }
    })();

    // "Chọn Xóa để xóa bài tập khỏi danh sách bài đã giao"
    await step("deleteAssignment", async () => {
      await page.goto(`${config.teacherPortalBaseUrl}/teacher/exercise/${roomId}/edit`, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.getByText(po.editPage.breadcrumb, { exact: true }).first().waitFor({ timeout: 15000 });
      await deleteFromEditPage(page);
    }, { page })();

    await step("verifyRemoved", async () => {
      const room = await findRoomById(roomId);
      if (room) {
        throw new AssignedListLifecycleAssertionError(`Room "${roomId}" vẫn còn tồn tại sau khi Xóa - có thể chưa xóa thật.`);
      }
    })();

    return { status: "PASS", steps, selection: { ...selection, roomId } };
  } catch (err) {
    return { status: "FAIL", steps, error: err.message, selection: { ...selection, roomId } };
  } finally {
    if (browser) await browser.close();
  }
}
