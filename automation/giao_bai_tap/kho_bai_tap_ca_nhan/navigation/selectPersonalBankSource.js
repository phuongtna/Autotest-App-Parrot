import { sourcePageObjects as sel } from "./sourcePageObjects.js";

export class SelectPersonalBankSourceError extends Error {}

/**
 * Chọn nguồn "Kho bài tập cá nhân" + 1 lớp trên form "Giao bài tập" (tạo mới HOẶC chỉnh sửa) -
 * MỘT CÁCH ỔN ĐỊNH, dùng chung cho MỌI spec trong module này thay vì mỗi file tự viết lại vòng
 * lặp retry riêng (đã từng làm vậy - KHÔNG đủ an toàn, xem lý do bên dưới).
 *
 * BUG THẬT ĐÃ XÁC NHẬN (2026-09-16, debug script riêng, gây sai lệch dữ liệu ÂM THẦM ở
 * `assign-submit.spec.js` và `tick-and-detail.spec.js` trước khi tìm ra nguyên nhân thật): radio
 * "Kho bài tập cá nhân" tự CHECKED đúng và GIỮ NGUYÊN checked ổn định nếu không đụng gì thêm
 * (verify: checked liên tục suốt 3.5s không đổi). Nhưng nếu SAU ĐÓ bấm chọn 1 CHECKBOX LỚP, hành
 * động chọn lớp có thể kích hoạt 1 effect làm radio "Kho bài tập cá nhân" ÂM THẦM REVERT về lại
 * "Bộ sách Kết nối tri thức" - không phải do thời gian trôi qua, mà do CHÍNH thao tác chọn lớp gây
 * ra. Hậu quả: toàn bộ luồng sau đó (Unit/Lesson/Danh sách bài tập/tick/submit) ám thầm dùng NHẦM
 * nguồn KNTT dù thao tác/UI nhìn như đang ở Kho bài tập cá nhân - rất khó phát hiện nếu không đối
 * chiếu id thật qua API response.
 *
 * Cách né ĐÚNG: verify CẢ 2 điều kiện (radio checked + đúng lớp checked) đồng thời NGAY SAU khi
 * chọn lớp - không chỉ verify radio một lần trước đó rồi giả định nó vẫn còn đúng. Nếu radio bị
 * revert, bấm lại radio + lớp từ đầu, lặp lại tối đa `maxAttempts` lần.
 *
 * @param {import("playwright").Page} page
 * @param {string} className - tên lớp (match theo substring, giống các nơi khác trong module)
 * @param {{ maxAttempts?: number }} [options]
 */
export async function selectPersonalBankClassStably(page, className, { maxAttempts = 5 } = {}) {
  const personalBankRadio = page.locator(sel.personalBankRadioSelector);
  const classLabel = page.getByText(className, { exact: false }).first();
  const classCheckbox = classLabel.locator("xpath=ancestor::label[1]//input[@type='checkbox']");

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await personalBankRadio.click();
    await page.waitForTimeout(400);
    const radioCheckedFirst = await personalBankRadio.isChecked().catch(() => false);
    if (!radioCheckedFirst) continue;

    await classLabel.click();
    await page.waitForTimeout(500);

    // Verify CẢ 2 điều kiện đồng thời - đây là bước bắt được bug thật (chọn lớp có thể làm radio
    // revert âm thầm).
    const radioStillChecked = await personalBankRadio.isChecked().catch(() => false);
    const classChecked = await classCheckbox.isChecked().catch(() => false);
    if (radioStillChecked && classChecked) {
      return;
    }
  }

  throw new SelectPersonalBankSourceError(
    `Không đạt được trạng thái ổn định "Kho bài tập cá nhân" + lớp "${className}" cùng checked ` +
      `sau ${maxAttempts} lần thử - có thể đang gặp lại bug revert đã biết (xem docblock hàm này).`,
  );
}
