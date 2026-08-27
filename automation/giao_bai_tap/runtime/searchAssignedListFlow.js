import { loginTeacherPortal } from "../navigation/teacherPortalSession.js";
import { gotoAssignedList, searchByItemName } from "../navigation/teacherAssignedListPageObjects.js";

export class SearchAssignedListAssertionError extends Error {}

/**
 * Test CHỈ ĐỌC (không tạo/sửa/xóa dữ liệu nào) cho ô "Tìm theo tên bài tập" trên màn "Danh sách
 * bài tập đã giao" - ĐÃ XÁC NHẬN THẬT (2026-08-27): ô này KHÔNG phải live-search theo ký tự, PHẢI
 * bấm Enter mới submit (`fill()` một mình không tự trigger, xem searchByItemName). Test lấy tên 1
 * dòng CÓ SẴN thật trên trang 1 (không hardcode/không đoán tên), gõ đúng tên đó + Enter, xác nhận
 * kết quả CHỈ còn (các) dòng khớp đúng tên đã gõ.
 *
 * @param {{ headless?: boolean }} [params]
 * @returns {Promise<{status:"PASS"|"FAIL", steps, error?}>}
 */
export async function searchAssignedListFlow({ headless = true } = {}) {
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

  const { browser, page } = await loginTeacherPortal({ headless });
  try {
    let searchTerm = null;

    await step("gotoAssignedList", async () => {
      await gotoAssignedList(page);
    })();

    await step("pickRealItemNameFromPage1", async () => {
      const count = await page.locator("table tbody tr").count();
      if (count === 0) {
        throw new SearchAssignedListAssertionError("Trang 1 không có dòng nào để lấy tên thật cho test search.");
      }
      searchTerm = (await page.locator("table tbody tr").first().locator("td").nth(1).innerText()).trim();
      if (!searchTerm) {
        throw new SearchAssignedListAssertionError("Không đọc được tên bài tập của dòng đầu tiên.");
      }
    })();

    await step("searchByExactName", async () => {
      await searchByItemName(page, searchTerm);
    })();

    await step("verifyResultsMatchSearchTerm", async () => {
      const rowCount = await page.locator("table tbody tr").count();
      if (rowCount === 0) {
        throw new SearchAssignedListAssertionError(
          `Search "${searchTerm}" (chính xác tên 1 dòng vừa lấy từ trang 1) trả về 0 kết quả - phải có ít nhất 1.`,
        );
      }
      const titles = await page.evaluate(() =>
        Array.from(document.querySelectorAll("table tbody tr")).map(
          (r) => r.querySelectorAll("td")[1]?.innerText.trim() ?? "",
        ),
      );
      const mismatched = titles.filter((t) => !t.includes(searchTerm));
      if (mismatched.length > 0) {
        throw new SearchAssignedListAssertionError(
          `Sau khi search "${searchTerm}", có ${mismatched.length}/${titles.length} dòng KHÔNG khớp tên: ${JSON.stringify(mismatched)}.`,
        );
      }
    })();

    return { status: "PASS", steps, searchTerm };
  } catch (err) {
    return { status: "FAIL", steps, error: err.message };
  } finally {
    await browser.close();
  }
}
