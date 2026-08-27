/**
 * Helper dùng chung cho control "Hạn nộp" - CÙNG 1 cấu trúc DOM (button `aria-haspopup="menu"`
 * mở popover Radix `role="menu"` với header "Tháng N" + lịch chọn ngày) xuất hiện ở CẢ 2 nơi đã
 * xác nhận thật:
 *   - Form "Giao bài tập" mới (automation/giao_bai_tap/runtime/assignHomeworkFlow.js, xác nhận
 *     2026-08-09) - trigger là sibling của <label>"Hạn nộp".
 *   - Trang "Chỉnh sửa bài tập" (/teacher/exercise/{id}/edit, xác nhận 2026-08-27) - trigger nằm
 *     trong cùng field container với <label>"Hạn nộp" (không phải sibling trực tiếp).
 * Tách ra đây để dùng lại nguyên vẹn thay vì copy lần 2 - CHỈ khác cách 2 nơi định vị `trigger`
 * (do khác cấu trúc field bao quanh label), phần mở popover/chọn tháng/ngày giống hệt nhau.
 *
 * CHƯA xác nhận popover hiển thị NĂM ở đâu (chỉ thấy "Tháng N") - chỉ điều hướng theo THÁNG,
 * giả định đúng năm hiện tại (đủ dùng cho hạn nộp trong vòng vài tháng tới).
 */
export async function setDueDateViaPopover(page, trigger, { day, month }) {
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
}
