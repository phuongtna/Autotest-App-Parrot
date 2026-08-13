import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loginTeacherPortal } from "../navigation/teacherPortalSession.js";
import { teacherPortalPageObjects as po } from "../navigation/teacherPortalPageObjects.js";
import {
  resolveAndSelectUnit,
  resolveAndSelectLesson,
  resolveAndSelectAssignment,
} from "../navigation/teacherAssignmentDiscovery.js";
import {
  fetchEligibleAssignmentTree,
  filterEligibleTree,
  pickRandomEligibleAssignment,
  NoEligibleAssignmentError,
} from "../navigation/teacherAssignmentApiDiscovery.js";

export { NoEligibleAssignmentError };

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, "..", "..", "output", "screenshots");

export class AssignHomeworkAssertionError extends Error {}

/** Parse "DD/MM/YYYY" (format dùng trong TESTCASES.md) thành {day, month, year} số nguyên. */
function parseDdMmYyyy(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) {
    throw new AssignHomeworkAssertionError(`dueDate "${value}" không đúng format "DD/MM/YYYY".`);
  }
  const [, dd, mm, yyyy] = match;
  return { day: Number(dd), month: Number(mm), year: Number(yyyy) };
}

const REQUIRED_PARAMS = ["primaryClass", "dueDate"];

// ĐÃ THAY THẾ (2026-08-12): bản cũ random Unit/Lesson MÙ trên UI rồi reroll-từ-đầu tối đa 20 lần
// khi gặp Lesson toàn item rỗng (~2/3 Unit/Lesson của bộ "Kết nối tri thức" KHÔNG có exercise item
// nào gắn exam thật - xem automation/output/data_discovery/A/network_log.json). Cách đó VẪN random
// mù ở tầng Unit/Lesson (chỉ né hậu quả bằng cách thử lại), có thể cạn hết lượt thử mà không báo
// đúng lý do (đã xảy ra thật: 1 lần chạy 2026-08-12 cạn 20 lượt, dừng ở Unit 15 - unit này 0/3
// lesson eligible, xem automation/output/e2e_teacher_assign_student_lifecycle_report.json cũ).
//
// BẢN MỚI: gọi thẳng navigation/teacherAssignmentApiDiscovery.js#fetchEligibleAssignmentTree() để
// dựng SẴN toàn bộ cây Unit->Lesson->Item eligible thật qua API (KHÔNG qua DOM, KHÔNG cần thử-sai)
// trước khi đụng tới Playwright, rồi random ĐÚNG 1 lần trong cây đã tỉa (pickRandomEligibleAssignment)
// - không còn khái niệm "reroll"/"ngõ cụt" nữa vì mọi item trong cây đã được xác nhận có exam thật.

/**
 * Tự động hoá TC1 (flows/giao_bai_tap/TESTCASES.md) PHÍA WEB GV bằng Playwright. Phần "app HS
 * nhận thông báo" trong TC1 nằm ngoài phạm vi hàm này (Playwright không điều khiển được app
 * Android) - vẫn cần verify tay hoặc bằng 1 flow Maestro riêng chạy sau khi hàm này PASS.
 *
 * @param {object} params
 * @param {string} params.primaryClass - lớp chọn đầu tiên (vd "3B" - ĐÃ XÁC NHẬN THẬT với tài
 *   khoản GV "Phương" hiện có trong .env).
 * @param {string} [params.otherGroupClass] - lớp KHÁC khối với primaryClass, dùng để xác nhận bị
 *   disable ngay sau khi chọn primaryClass (vd "6D"). OPTIONAL - bỏ qua bước xác nhận này nếu
 *   không truyền (2026-08-13: lớp "6D" đã bị xoá khỏi tài khoản GV test hiện tại - theo xác nhận
 *   trực tiếp của user - nên không còn lớp khối khác nào để verify business rule này; giữ tham số
 *   optional thay vì hardcode lại 1 lớp khác, để không tự đoán tên lớp thay thế).
 * @param {string} [params.sameGroupClass] - lớp CÙNG khối với primaryClass, dùng để xác nhận
 *   vẫn chọn được thêm. OPTIONAL - bỏ qua bước này nếu không truyền, vì tài khoản GV hiện tại
 *   KHÔNG có 2 lớp cùng khối để test (xem "GIỚI HẠN" trong TESTCASES.md).
 * @param {string} params.dueDate - hạn nộp, format "DD/MM/YYYY" (vd "20/08/2026") - chọn qua
 *   popover lịch thật trên UI, xem bước setDueDate bên dưới.
 * @param {string} [params.unitName] - CHỈ ĐỊNH SẴN Unit (dùng cho debug/case cần cố định). Không
 *   truyền -> RANDOM 1 Unit thật trong dropdown (xem automation/giao_bai_tap/navigation/
 *   teacherAssignmentDiscovery.js#resolveAndSelectUnit) - không đoán tên, không hardcode.
 * @param {string} [params.lessonName] - giống unitName, không truyền -> random 1 Lesson thật của
 *   Unit đã chọn.
 * @param {string} [params.homeworkItemName] - giống unitName, không truyền -> random 1 assignment
 *   thật trong "Danh sách bài tập" của Lesson đã chọn.
 * @param {boolean} [params.headless=true]
 * @returns {Promise<{status:"PASS"|"FAIL", steps, error?, selection:{unitName,lessonName,homeworkItemName,questionCount}}>}
 *   selection luôn phản ánh Unit/Lesson/assignment THẬT đã dùng (dù được caller chỉ định sẵn hay
 *   random) - caller BẮT BUỘC dùng lại selection.homeworkItemName để tra cứu metadata/đối chiếu
 *   App HS, không được giả định lại giá trị đã truyền vào (vì có thể là random).
 */
export async function assignHomeworkFlow(params) {
  const missing = REQUIRED_PARAMS.filter((key) => !params[key]);
  if (missing.length > 0) {
    throw new AssignHomeworkAssertionError(`Thiếu tham số bắt buộc: ${missing.join(", ")}`);
  }

  const {
    primaryClass,
    otherGroupClass,
    sameGroupClass,
    dueDate,
    unitName,
    lessonName,
    homeworkItemName,
    headless = true,
  } = params;

  const selection = {
    unitName: null,
    lessonName: null,
    homeworkItemName: null,
    questionCount: null,
    exerciseId: null,
    examIds: null,
    type: null,
  };
  const steps = [];
  function step(name, fn, { page } = {}) {
    return async () => {
      try {
        await fn();
        steps.push({ name, status: "PASS" });
      } catch (err) {
        let screenshotPath = null;
        if (params.debugDump && page) {
          mkdirSync(SCREENSHOT_DIR, { recursive: true });
          screenshotPath = join(SCREENSHOT_DIR, `${name}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {
            screenshotPath = null;
          });
        }
        steps.push({ name, status: "FAIL", error: err.message, screenshotPath });
        throw err;
      }
    };
  }

  const { browser, page } = await loginTeacherPortal({ headless });
  try {
    await step(
      "openAssignForm",
      async () => {
        await page.getByText(po.menu.menuItem, { exact: false }).first().click();
        await page.getByRole("button", { name: po.menu.createButton }).click();
      },
      { page },
    )();

    await step(
      "selectPrimaryClass",
      async () => {
        await page.getByText(primaryClass, { exact: false }).first().click();
      },
      { page },
    )();

    // ĐÃ XÁC NHẬN THẬT (2026-08-09, debug screenshot/DOM dump): mỗi lớp là 1 <label> bọc 1
    // <input type="checkbox">; lớp bị disable có checkbox.disabled = true (label thêm class
    // "opacity-60 cursor-not-allowed" chỉ để hiển thị, không dùng để detect logic).
    if (otherGroupClass) {
      await step(
        "assertOtherGroupClassDisabled",
        async () => {
          const labelText = page.getByText(otherGroupClass, { exact: false }).first();
          const checkbox = labelText.locator("xpath=ancestor::label[1]//input[@type='checkbox']");
          const isDisabled = await checkbox.isDisabled();
          if (!isDisabled) {
            throw new AssignHomeworkAssertionError(
              `Lớp "${otherGroupClass}" (khối khác) chưa chuyển sang trạng thái disable sau khi ` +
                `chọn "${primaryClass}".`,
            );
          }
        },
        { page },
      )();
    }

    if (sameGroupClass) {
      await step(
        "selectSameGroupClass",
        async () => {
          await page.getByText(sameGroupClass, { exact: false }).first().click();
        },
        { page },
      )();
    }

    // ĐÃ XÁC NHẬN THẬT (2026-08-09, debug screenshot thật): "Hạn nộp" KHÔNG phải input ngày
    // native - là 1 nút mở popover Radix (`aria-haspopup="menu"`, sibling của <label>) hiển thị
    // lịch (role="menu", header "Tháng N" + 2 nút chuyển tháng bằng icon lucide-chevron-left/
    // -right + lưới số ngày trong tháng). CHƯA xác nhận popover có hiển thị NĂM ở đâu (chỉ thấy
    // "Tháng N") nên chỉ điều hướng theo THÁNG, giả định đúng năm hiện tại - đủ dùng cho hạn nộp
    // trong vòng vài tháng tới, CHƯA xác nhận đúng khi hạn nộp cách năm hiện tại nhiều năm.
    await step(
      "setDueDate",
      async () => {
        const { day, month } = parseDdMmYyyy(dueDate);

        const trigger = page
          .getByText(po.dueDate.label, { exact: true })
          .locator("xpath=following-sibling::*[@aria-haspopup='menu'][1]");
        await trigger.click();

        const popover = page.getByRole("menu");
        await popover.waitFor({ state: "visible", timeout: 10000 });

        for (let i = 0; i < 12; i++) {
          const headerText = await popover.locator("h6").innerText();
          const shownMonth = Number(/Tháng (\d+)/.exec(headerText)?.[1]);
          if (shownMonth === month) break;
          const chevronClass = shownMonth < month ? "lucide-chevron-right" : "lucide-chevron-left";
          await popover.locator(`button:has(svg.${chevronClass})`).click();
        }

        await popover.getByText(String(day), { exact: true }).click();
        await popover.waitFor({ state: "hidden", timeout: 10000 });
      },
      { page },
    )();

    // ĐÃ XÁC NHẬN THẬT (2026-08-09, debug screenshot thật): "Chọn Unit" là 1 Radix Select thật
    // (trigger <button role="combobox">, mở ra <div role="listbox"> chứa <div role="option">) -
    // KHÁC "Chọn Lesson" (chỉ là các <button> phẳng, không phải dropdown) và "Danh sách bài tập"
    // (mỗi bài nhận diện qua "Xem chi tiết"+"N câu hỏi", KHÔNG phải checkbox chuẩn - xem
    // teacherAssignmentDiscovery.js).
    //
    // Nếu homeworkItemName ĐÃ được chỉ định sẵn (case debug/tái hiện case cụ thể) -> dùng thẳng
    // unitName/lessonName/homeworkItemName truyền vào, KHÔNG gọi API discovery (không cần, đã biết
    // chính xác cần chọn gì). Ngược lại (case random - mặc định) -> gọi
    // navigation/teacherAssignmentApiDiscovery.js#fetchEligibleAssignmentTree() dựng SẴN cây
    // Unit->Lesson->Item eligible thật qua API (không qua DOM, không cần thử-sai/reroll) rồi random
    // ĐÚNG 1 lần trong cây đã tỉa - nếu unitName/lessonName có chỉ định sẵn (nhưng homeworkItemName
    // để trống), thu hẹp cây về đúng phạm vi đó trước khi random (random assignment TRONG Unit/
    // Lesson đã ép, không random tự do toàn bộ cây).
    await step(
      "resolveAssignmentSelection",
      async () => {
        if (homeworkItemName) {
          selection.unitName = unitName;
          selection.lessonName = lessonName;
          selection.homeworkItemName = homeworkItemName;
          return;
        }

        const { eligibleTree, stats } = await fetchEligibleAssignmentTree(primaryClass);
        console.log(
          `  [EXERCISE_DISCOVERY] total items: ${stats.totalItems} | items with exam: ${stats.itemsWithExam} | items without exam (EXCLUDED_NO_EXAM): ${stats.itemsWithoutExam}`,
        );
        const scoped = filterEligibleTree(eligibleTree, { unitName, lessonName });
        const picked = pickRandomEligibleAssignment(scoped);

        selection.unitName = picked.unitName;
        selection.lessonName = picked.lessonName;
        selection.homeworkItemName = picked.homeworkItemName;
        selection.questionCount = picked.questionCount;
        selection.exerciseId = picked.exerciseId;
        selection.examIds = picked.examIds;
        selection.type = picked.type;

        console.log(
          `  [RANDOM_SELECTION] unit=${selection.unitName} | lesson=${selection.lessonName} | assignment=${selection.homeworkItemName} | exerciseId=${selection.exerciseId} | type=${selection.type} | questionCount=${selection.questionCount}`,
        );
      },
      { page },
    )();

    // Đã biết CHÍNH XÁC unit/lesson/assignment cần chọn (chỉ định sẵn hoặc vừa random qua API ở
    // trên) - chọn trên UI bằng ĐÚNG tên đó (KHÔNG còn random mù trên DOM, KHÔNG còn reroll khi gặp
    // ngõ cụt vì cây eligible đã đảm bảo mọi item đều có exam thật).
    await step(
      "selectUnitLessonHomework",
      async () => {
        await resolveAndSelectUnit(page, selection.unitName);
        // Lesson list phụ thuộc Unit vừa chọn - chờ re-render (cùng ngân sách thời gian đã dùng
        // thật trong automation/giao_bai_tap/dataDiscovery.mjs, không đoán số mới).
        await page.waitForTimeout(1500);

        await resolveAndSelectLesson(page, selection.lessonName);
        await page.waitForTimeout(1000);

        const picked = await resolveAndSelectAssignment(page, selection.homeworkItemName);
        // questionCount đã có từ API discovery (chính xác hơn, luôn có số) - chỉ dùng lại giá trị
        // đọc từ DOM khi selection đến từ case chỉ định sẵn (API discovery không chạy, questionCount
        // vẫn null từ lúc khởi tạo selection).
        if (selection.questionCount === null) selection.questionCount = picked.questionCount;
      },
      { page },
    )();

    await step(
      "submitAssign",
      async () => {
        await page.getByRole("button", { name: po.submit.button }).click();
        await page.getByText(po.submit.successToast).waitFor({ timeout: 15000 });
      },
      { page },
    )();

    return { status: "PASS", steps, selection };
  } catch (err) {
    return { status: "FAIL", steps, error: err.message, selection };
  } finally {
    await browser.close();
  }
}
