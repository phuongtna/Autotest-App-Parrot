/**
 * Page Objects cho màn "Báo cáo lớp" (/teacher/exercise/{id}/report) + "Chi tiết bài làm học
 * sinh" (/teacher/exercise/{id}/result/{studentUserId}) - dùng bởi
 * runtime/openStudentResultFlow.js. CHỈ ĐỌC - không tạo/sửa/xóa dữ liệu nào, chỉ dùng trên
 * assignment CÓ SẴN thật (không tự tạo, vì cần có ít nhất 1 HS đã nộp bài thật để test được).
 *
 * ĐÃ XÁC NHẬN THẬT (2026-08-27, debug DOM dump thật, exerciseId "0a8b7074-..." lớp "7QA-Test"):
 *   - "Đã hoàn thành (N)" là 1 card riêng, mỗi HS là 1 <a href="/teacher/exercise/{roomId}/result/
 *     {studentUserId}">{tên HS}</a> - bấm vào TÊN HS chính là hành động "Chọn tên học sinh" người
 *     dùng mô tả.
 *   - Trang "/result/{studentUserId}" có breadcrumb "Tổng quan / Bài tập về nhà / Chi tiết bài
 *     làm", hiển thị đúng "Điểm số", "Thời gian nộp", "Thời gian làm bài", "Lịch sử nộp bài" +
 *     danh sách câu hỏi - khớp với mockup "Màn Chi tiết bài làm học sinh" trong tài liệu acceptance
 *     criteria gốc.
 */
export class NoCompletedStudentError extends Error {}

/** Tìm 1 dòng bất kỳ trên trang 1 "Danh sách bài tập đã giao" có ít nhất 1 HS đã làm ("HS ĐÃ LÀM"
 * dạng "x/y", x>0) - COPY heuristic đã xác nhận thật trong reportDiscovery.mjs (script điều tra
 * cũ), tách thành hàm dùng lại được. Trả về {className, itemName, dueDateLine} để caller tự định
 * vị lại dòng (Playwright locator không serialize được qua page.evaluate). */
export async function findRowWithCompletion(page) {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("table tbody tr"));
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("td")).map((c) => c.innerText.trim());
      if (cells.length < 5) continue;
      const doneCell = cells.find((c) => /^\d+\/\d+$/.test(c));
      if (doneCell && Number(doneCell.split("/")[0]) > 0) {
        return { className: cells[0], itemName: cells[1], dueDateLine: cells[2].split("\n")[0], doneCell };
      }
    }
    return null;
  });
}

/** Đọc danh sách HS trong card "Đã hoàn thành" của màn "Báo cáo lớp" đang mở -
 * {name, href}[] (href thật, dùng để bấm/điều hướng). */
export async function listCompletedStudents(page) {
  return page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll("h3")).find((h) => /Đã hoàn thành/i.test(h.textContent || ""));
    if (!heading) return [];
    const card = heading.closest("div")?.parentElement;
    if (!card) return [];
    return Array.from(card.querySelectorAll("a[href*='/result/']")).map((a) => ({
      name: a.textContent.trim(),
      href: a.getAttribute("href"),
    }));
  });
}

/**
 * Đọc 3 ô giá trị (Điểm số/Thời gian nộp/Thời gian làm bài) trên trang "Chi tiết bài làm học
 * sinh" (/teacher/exercise/{id}/result/{studentUserId}) - dùng bởi runtime cross-check giữa App
 * HS và Web GV cho 1 assignment đã có điểm.
 *
 * ĐÃ XÁC NHẬN THẬT (2026-08-27, DOM dump thật qua Playwright, exerciseId "0a8b7074-..." lớp
 * "7QA-Test", HS "Trần Duy Anh", bài "Choose the word whose underlined part is pronounced
 * differently from the others."): mỗi ô là 1 <div> có ĐÚNG 2 con - nhãn (<div>, không con, text
 * đúng label) rồi tới container giá trị (<div>, 2 con: giá trị lớn + đơn vị/phụ, vd
 * "5"+"Điểm", "16:30"+"Ngày 25 tháng 08", "04 phút"+"16 giây"). KHÔNG có data-testid/id ổn định -
 * dò bằng CẤU TRÚC (nhãn text CHÍNH XÁC, không dò theo class màu vì đó là class Tailwind tạo tự
 * động, không đảm bảo ổn định).
 */
export async function readStudentResultSummary(page) {
  return page.evaluate(() => {
    function readBoxByLabel(labelText) {
      const labelEl = Array.from(document.querySelectorAll("div")).find(
        (d) => d.children.length === 0 && d.textContent.trim() === labelText,
      );
      if (!labelEl) return null;
      const box = labelEl.parentElement;
      if (!box || box.children.length !== 2) return null;
      const valueContainer = labelEl.nextElementSibling;
      if (!valueContainer || valueContainer.children.length < 1) return null;
      const [valueEl, subEl] = Array.from(valueContainer.children);
      return { value: valueEl?.textContent.trim() ?? null, sub: subEl?.textContent.trim() ?? null };
    }
    const scoreBox = readBoxByLabel("Điểm số");
    const submitBox = readBoxByLabel("Thời gian nộp");
    const durationBox = readBoxByLabel("Thời gian làm bài");
    return {
      scoreText: scoreBox?.value ?? null,
      submitTimeText: submitBox?.value ?? null,
      submitDateText: submitBox?.sub ?? null,
      durationMinutesText: durationBox?.value ?? null,
      durationSecondsText: durationBox?.sub ?? null,
    };
  });
}

/**
 * Mở dropdown "Lịch sử nộp bài" (Radix `dropdown-menu-trigger`), đọc từng entry ("Bài nộp lần N"
 * + điểm tương ứng), rồi đóng lại (Escape - không để dropdown mở lại ảnh hưởng bước sau). Số
 * lượng entry = số lần học sinh đã nộp bài cho assignment này (đối chiếu "Lần N" trên App HS).
 *
 * ĐÃ XÁC NHẬN THẬT (2026-08-27, cùng phiên dump ở trên, HS "Trần Duy Anh" có 2 entry "Bài nộp
 * lần 2"/"Bài nộp lần 1", cả 2 cùng điểm "5"): mỗi entry là 1
 * `div[role="menuitem"][data-slot="dropdown-menu-item"]`, con đầu (<div>) = nhãn "Bài nộp lần N",
 * con sau (<span>) = điểm. Danh sách render mới nhất TRƯỚC (lần 2 đứng trên lần 1).
 */
export async function readSubmitHistory(page) {
  const trigger = page.getByRole("button", { name: /Lịch sử nộp bài/ });
  await trigger.click();
  await page.locator('[role="menuitem"][data-slot="dropdown-menu-item"]').first().waitFor({ timeout: 10000 });
  const entries = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('[role="menuitem"][data-slot="dropdown-menu-item"]'));
    return items.map((el) => {
      const label = el.children[0]?.textContent.trim() ?? "";
      const scoreText = el.children[1]?.textContent.trim() ?? null;
      const m = /^Bài nộp lần\s*(\d+)$/.exec(label);
      return { label, attemptNumber: m ? Number(m[1]) : null, scoreText };
    });
  });
  await page.keyboard.press("Escape");
  const attemptNumbers = entries.map((e) => e.attemptNumber).filter((n) => n != null);
  return {
    attemptCount: entries.length,
    maxAttemptNumber: attemptNumbers.length > 0 ? Math.max(...attemptNumbers) : null,
    entries,
  };
}
