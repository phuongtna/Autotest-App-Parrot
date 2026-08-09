import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loginTeacherPortal } from "../navigation/teacherPortalSession.js";
import { teacherPortalPageObjects as po } from "../navigation/teacherPortalPageObjects.js";

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

const REQUIRED_PARAMS = [
  "primaryClass",
  "otherGroupClass",
  "dueDate",
  "unitName",
  "lessonName",
  "homeworkItemName",
];

/**
 * Tự động hoá TC1 (flows/giao_bai_tap/TESTCASES.md) PHÍA WEB GV bằng Playwright. Phần "app HS
 * nhận thông báo" trong TC1 nằm ngoài phạm vi hàm này (Playwright không điều khiển được app
 * Android) - vẫn cần verify tay hoặc bằng 1 flow Maestro riêng chạy sau khi hàm này PASS.
 *
 * @param {object} params
 * @param {string} params.primaryClass - lớp chọn đầu tiên (vd "3B" - ĐÃ XÁC NHẬN THẬT với tài
 *   khoản GV "Phương" hiện có trong .env).
 * @param {string} params.otherGroupClass - lớp KHÁC khối với primaryClass, dùng để xác nhận bị
 *   disable ngay sau khi chọn primaryClass (vd "6D").
 * @param {string} [params.sameGroupClass] - lớp CÙNG khối với primaryClass, dùng để xác nhận
 *   vẫn chọn được thêm. OPTIONAL - bỏ qua bước này nếu không truyền, vì tài khoản GV hiện tại
 *   KHÔNG có 2 lớp cùng khối để test (xem "GIỚI HẠN" trong TESTCASES.md).
 * @param {string} params.dueDate - hạn nộp, format "DD/MM/YYYY" (vd "20/08/2026") - chọn qua
 *   popover lịch thật trên UI, xem bước setDueDate bên dưới.
 * @param {string} params.unitName
 * @param {string} params.lessonName
 * @param {string} params.homeworkItemName
 * @param {boolean} [params.headless=true]
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
    // (mỗi bài là 1 checkbox). Unit mặc định đã chọn sẵn Unit đầu tiên - CHỈ mở dropdown khi cần
    // đổi khác giá trị đang hiển thị, tránh mở rồi không đóng lại (đã gặp thật: mở dropdown xong
    // không chọn lại gì khiến nó che mất nút "Lesson 1" ở dưới, click tiếp bị chặn).
    await step(
      "selectUnitLessonHomework",
      async () => {
        const unitTrigger = page.getByRole("combobox").first();
        const currentUnitText = (await unitTrigger.innerText()).trim();
        if (currentUnitText !== unitName) {
          await unitTrigger.click();
          const listbox = page.getByRole("listbox");
          await listbox.waitFor({ state: "visible", timeout: 10000 });
          await listbox.getByRole("option", { name: unitName, exact: true }).click();
        }

        // ĐÃ XÁC NHẬN THẬT (2026-08-09): nút Lesson đang active có class chứa
        // "bg-surface-action-sub" (xem outerHTML thật bắt được lúc lỗi lần trước) - Lesson mặc
        // định cũng đã chọn sẵn 1 lesson (giống Unit) nên CHỈ click nếu lessonName CHƯA active,
        // tránh lặp lỗi bấm-vào-làm-mất-chọn như đã gặp thật với "Chọn Unit".
        const lessonButton = page.getByText(lessonName, { exact: true });
        const isLessonActive = await lessonButton.evaluate((el) =>
          el.className.includes("bg-surface-action-sub"),
        );
        if (!isLessonActive) {
          await lessonButton.click();
        }

        await page.getByText(homeworkItemName, { exact: false }).first().click();
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

    return { status: "PASS", steps };
  } catch (err) {
    return { status: "FAIL", steps, error: err.message };
  } finally {
    await browser.close();
  }
}
