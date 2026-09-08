import { loginTeacherPortal } from "../navigation/teacherPortalSession.js";
import { gotoAssignedList, widenDateRangeFilter, locateAssignedRowAcrossPages } from "../navigation/teacherAssignedListPageObjects.js";

/**
 * Chụp 1 "snapshot" của ĐÚNG 1 dòng trên "Danh sách bài tập đã giao" (Giao bài tập) - dùng cho
 * TC_16 (kế hoạch test "Rời khỏi lớp" - Giai đoạn 3: sau khi 1 học sinh rời lớp, tổng số HS đã làm
 * + điểm TB của bài đang active phải được tính lại, không còn tính học sinh đã rời).
 *
 * CHƯA CHẠY THẬT (2026-09-08) - chưa có assignment thật nào trong lớp test dùng để verify
 * TC_14/15 (`5X-RKLRejoin2`, xem classRosterSnapshotFlow.js) vì lớp đó mới tạo, không có bài tập.
 * Cần 1 lớp thật CÓ bài tập đang active (chưa quá hạn) VÀ có ≥1 học sinh đã làm mới verify được -
 * viết theo đúng convention đã có (`verifyAverageScoreFlow.js` đọc cùng 2 giá trị này từ CÙNG bảng,
 * cells[4] = "ĐIỂM TB", ô dạng "x/y" = số HS đã làm/tổng số HS) nhưng CHƯA có bằng chứng chạy thật
 * cho riêng kịch bản "trước/sau khi rời lớp" này.
 *
 * @param {object} params
 * @param {string} params.className - tên lớp, dùng để định vị đúng dòng (khớp
 *   `locateAssignedRowAcrossPages`).
 * @param {string} params.itemName - tên bài tập.
 * @param {string} params.dueDateLine - dòng hạn nộp hiển thị trên danh sách (dùng để phân biệt các
 *   lần giao khác nhau của cùng 1 bài).
 * @param {boolean} [params.headless=true]
 * @returns {Promise<{className:string, itemName:string, dueDateLine:string, doneCell:string|null,
 *   completedCount:number|null, totalCount:number|null, averageScoreText:string|null}>}
 */
export async function captureClassAssignmentSnapshot({ className, itemName, dueDateLine, headless = true }) {
  if (!className || !itemName || !dueDateLine) {
    throw new Error("Thiếu tham số bắt buộc: className, itemName, dueDateLine.");
  }

  const { browser, page } = await loginTeacherPortal({ headless });
  try {
    await gotoAssignedList(page);
    await widenDateRangeFilter(page);

    const row = await locateAssignedRowAcrossPages(page, { className, itemName, dueDateLine });
    const cells = await row.evaluate((r) => Array.from(r.querySelectorAll("td")).map((c) => c.innerText.trim()));

    const doneCell = cells.find((c) => /^\d+\/\d+$/.test(c)) ?? null;
    const [completedCount, totalCount] = doneCell
      ? doneCell.split("/").map((n) => Number(n))
      : [null, null];
    // ĐÃ XÁC NHẬN THẬT (2026-08-27, verifyAverageScoreFlow.js) - cột "ĐIỂM TB" nằm ở cells[4] của
    // bảng "Danh sách bài tập đã giao".
    const averageScoreText = cells[4] ?? null;

    return { className, itemName, dueDateLine, doneCell, completedCount, totalCount, averageScoreText };
  } finally {
    await browser.close();
  }
}
