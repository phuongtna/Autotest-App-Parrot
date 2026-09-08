import { teacherClassPageObjects as po } from "./teacherClassPageObjects.js";

/**
 * Đếm số lượng lớp đang hiển thị trên màn "Lớp phụ trách" - dùng chung bởi addClassFlow.js VÀ
 * deleteClassFlow.js. ĐÃ XÁC NHẬN THẬT (2026-08-20, nhiều lượt `npm run add-class` headed thật):
 * đọc text "Danh sách lớp học (n)" (kể cả scope `.locator("main")`) LUÔN có thể đọc ra "0" sai -
 * có 1 node DOM khác cố định mang text "(0)" (nghi skeleton/loading route ẩn, không thấy khi kiểm
 * tra `document.querySelectorAll('main')` - CHỈ có đúng 1 main thật, nhưng node lạ vẫn khớp
 * getByText). FIX: đếm số nhãn "Sĩ số:" (mỗi card lớp thật có đúng 1 nhãn, dùng substring match vì
 * label và số liệu nằm CHUNG 1 text node "Sĩ số: 6", không tách span như accessibility tree thể
 * hiện).
 */
export async function readClassListCount(page) {
  return page.getByText(po.classCardCountLabel, { exact: false }).count();
}

/**
 * Đọc số lượng lớp và chờ ổn định (N lần đọc LIÊN TIẾP cách nhau `intervalMs` ra CÙNG 1 số) -
 * dùng cho lần đọc "before" khi màn "Lớp phụ trách" vừa load xong, tránh dính state loading
 * thoáng qua (nếu có).
 *
 * ĐÃ XÁC NHẬN THẬT (2026-08-20, máy đang thiếu RAM nặng khi debug - `free -h` chỉ còn ~300Mi free,
 * đang swap): dù đã chờ thêm response GET `/api/classes/teacher` TRƯỚC khi bắt đầu đọc (xem
 * addClassFlow.js/deleteClassFlow.js#openClassList), requiredStableReads=2 (bản cũ) VẪN có thể đọc
 * nhầm "0" - nghi do main thread renderer bị delay nặng bởi swap nên "network response đã về"
 * KHÔNG đồng nghĩa "DOM đã re-render xong" trong lúc máy đang thrashing, 2 lần đọc liên tiếp vẫn
 * có thể rơi trọn vào khoảng delay đó. Tăng lên 3 lần đọc liên tiếp + timeout dài hơn để có nhiều
 * cơ hội hơn cho renderer bắt kịp.
 */
export async function readStableClassListCount(
  page,
  { timeoutMs = 20000, intervalMs = 400, requiredStableReads = 3 } = {},
) {
  const deadline = Date.now() + timeoutMs;
  let prev = await readClassListCount(page);
  let stableStreak = 1;
  while (Date.now() < deadline) {
    await page.waitForTimeout(intervalMs);
    const curr = await readClassListCount(page);
    if (curr === prev) {
      stableStreak += 1;
      if (stableStreak >= requiredStableReads) return curr;
    } else {
      stableStreak = 1;
      prev = curr;
    }
  }
  return prev;
}

/**
 * Đọc "Sĩ số: N" CỦA ĐÚNG 1 lớp cụ thể trên màn "Lớp phụ trách" (khác `readClassListCount` ở trên -
 * hàm đó đếm SỐ LƯỢNG lớp trong toàn danh sách, không đọc sĩ số của 1 lớp). Dùng cho TC_15 (kế
 * hoạch test "Rời khỏi lớp" - sĩ số giảm đúng 1 sau khi học sinh rời lớp).
 *
 * ĐÃ XÁC NHẬN THẬT (2026-09-08, staging, lớp "5X-RKLRejoin2"): mỗi card có cấu trúc DOM cố định -
 * `<div class="...flex-col..."><h3>{tên lớp}</h3><div class="space-y-3">...<span>Sĩ số:
 * <span>{n}</span></span>...</div></div>` - heading `<h3>` và khối "Sĩ số" là 2 CON TRỰC TIẾP của
 * CÙNG 1 div cha (không lồng sâu). Ban đầu thử `page.locator("div", {has: heading})` (không dùng
 * xpath) - SAI THẬT (2026-09-08): locator này khớp CẢ những div bao ngoài cùng (toàn bộ layout
 * trang, gồm sidebar + mọi card khác), vì bất kỳ div tổ tiên nào cũng "has" heading lẫn text "Sĩ
 * số" (text bubble lên mọi cấp cha) - đọc nhầm sĩ số của card ĐẦU TIÊN trong danh sách thay vì card
 * đang tìm. FIX: dùng `xpath=./parent::*` lấy ĐÚNG 1 phần tử cha trực tiếp của heading (khớp cấu
 * trúc DOM thật đã xác nhận), không dò theo "div chứa cả 2 thứ" nữa.
 */
export async function readClassCardSiSo(page, className) {
  const heading = page.locator("main").getByRole("heading", { name: className, exact: true });
  await heading.waitFor({ state: "visible", timeout: 15000 });
  const card = heading.locator("xpath=./parent::*");
  const text = await card.innerText();
  const match = /Sĩ số:\s*(\d+)/.exec(text);
  if (!match) {
    throw new Error(`Không đọc được "Sĩ số:" trong card của lớp "${className}" (nội dung: "${text}").`);
  }
  return Number(match[1]);
}
