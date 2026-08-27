import { loginTeacherPortal } from "../navigation/teacherPortalSession.js";
import { gotoAssignedList, listClassFilterOptions, filterByClass } from "../navigation/teacherAssignedListPageObjects.js";

export class FilterByClassAssertionError extends Error {}

/**
 * Test CHỈ ĐỌC (không tạo/sửa/xóa dữ liệu nào) cho dropdown "Tất cả các lớp" trên màn "Danh sách
 * bài tập đã giao" - ĐÃ XÁC NHẬN THẬT (2026-08-27): option list CHÍNH XÁC là các lớp thật thuộc
 * tài khoản GV đang đăng nhập (đọc trực tiếp từ dropdown, không hardcode tên lớp), chọn 1 lớp gọi
 * lại `GET .../room.json?...&class_id=<id thật>` và bảng chỉ còn dòng của ĐÚNG lớp đó.
 *
 * Random chọn 1 lớp thật trong dropdown (không phải "Tất cả các lớp") để verify, ưu tiên lớp NÀO
 * ĐANG CÓ ít nhất 1 dòng trong danh sách mặc định (đọc từ cột "LỚP" trước khi filter) để đảm bảo
 * assertion có ý nghĩa (không rơi vào case 0 dòng khiến "mọi dòng đều khớp" đúng 1 cách vô nghĩa).
 *
 * @param {{ headless?: boolean }} [params]
 * @returns {Promise<{status:"PASS"|"FAIL", steps, error?, classOptions?, filteredClass?}>}
 */
export async function filterAssignedListByClassFlow({ headless = true } = {}) {
  const steps = [];
  function step(name, fn) {
    return async () => {
      try {
        await fn();
        steps.push({ name, status: "PASS" });
      } catch (err) {
        steps.push({ name, status: "FAIL", error: err.message });
        throw err;
      }
    };
  }

  let classOptions = null;
  let classesWithData = null;
  let targetClass = null;

  const { browser, page } = await loginTeacherPortal({ headless });
  try {
    await step("gotoAssignedList", async () => {
      await gotoAssignedList(page);
    })();

    await step("readClassesWithDataOnDefaultView", async () => {
      classesWithData = new Set(
        await page.evaluate(() =>
          Array.from(document.querySelectorAll("table tbody tr")).map(
            (r) => r.querySelectorAll("td")[0]?.innerText.trim(),
          ),
        ),
      );
    })();

    await step("readClassFilterOptions", async () => {
      classOptions = await listClassFilterOptions(page);
      if (classOptions.length <= 1) {
        throw new FilterByClassAssertionError(
          `Dropdown "Tất cả các lớp" chỉ có ${classOptions.length} option - cần ít nhất 1 lớp thật để test filter.`,
        );
      }
    })();

    await step("pickClassWithData", async () => {
      const realClasses = classOptions.filter((c) => c !== "Tất cả các lớp");
      targetClass = realClasses.find((c) => classesWithData.has(c)) || realClasses[0];
    })();

    await step("filterByPickedClass", async () => {
      await filterByClass(page, targetClass);
    })();

    await step("verifyAllRowsMatchClass", async () => {
      const rowCount = await page.locator("table tbody tr").count();
      const classValues = await page.evaluate(() =>
        Array.from(document.querySelectorAll("table tbody tr")).map(
          (r) => r.querySelectorAll("td")[0]?.innerText.trim() ?? "",
        ),
      );
      const mismatched = classValues.filter((c) => c !== targetClass);
      if (mismatched.length > 0) {
        throw new FilterByClassAssertionError(
          `Sau khi lọc lớp "${targetClass}", có ${mismatched.length}/${rowCount} dòng KHÔNG khớp lớp: ${JSON.stringify(mismatched)}.`,
        );
      }
    })();

    return { status: "PASS", steps, classOptions, filteredClass: targetClass };
  } catch (err) {
    return { status: "FAIL", steps, error: err.message, classOptions, filteredClass: targetClass };
  } finally {
    await browser.close();
  }
}
