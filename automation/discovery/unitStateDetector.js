/**
 * UnitStateDetector - tách riêng TOÀN BỘ quyết định "Unit này đã Hoàn thành chưa" ra khỏi nơi
 * gọi (unitCompletion.js) và khỏi nơi đọc dữ liệu thô (unitStatusProbe.js). Nơi gọi chỉ nhận
 * kết quả `{ state, confidence, source, reason }` - không tự so khớp text "Chinh phục"/"Ôn
 * tập" hay tự đọc field CMS ở đâu khác. Muốn đổi rule (CMS đổi field, app đổi chữ nút, thêm
 * tín hiệu mới...) CHỈ cần sửa trong file này.
 *
 * STATES.UNKNOWN là kết quả HỢP LỆ, không phải lỗi - dùng khi không đủ căn cứ, KHÔNG suy diễn
 * thành NOT_COMPLETED (xem unitCompletion.js: còn UNKNOWN thì không được kết luận
 * "No completed Unit found.").
 */

export const STATES = {
  COMPLETED: "COMPLETED",
  NOT_COMPLETED: "NOT_COMPLETED",
  UNKNOWN: "UNKNOWN",
};

/**
 * Nhãn nút hành động hiện tại của app - tách thành DATA riêng (không nằm trong logic so khớp)
 * để khi app đổi chữ, chỉ cần sửa đúng danh sách này, không phải sửa detectFromUiSignals().
 * Đây KHÔNG phải nguồn duy nhất để suy ra trạng thái (xem detectFromUiSignals - progress
 * fraction "x / y" mới là tín hiệu chính, nhãn nút chỉ dùng để đối chiếu/tăng độ tin cậy).
 */
export const KNOWN_ACTION_LABELS = {
  [STATES.COMPLETED]: ["Ôn tập"],
  [STATES.NOT_COMPLETED]: ["Chinh phục"],
};

function classifyLabel(label, knownLabels) {
  if (!label) return null;
  if (knownLabels[STATES.COMPLETED]?.includes(label)) return STATES.COMPLETED;
  if (knownLabels[STATES.NOT_COMPLETED]?.includes(label)) return STATES.NOT_COMPLETED;
  return null;
}

/**
 * Parse "x / y" (đã xác nhận qua maestro hierarchy - luôn nằm ngay dưới tiêu đề Unit, KHÔNG
 * phụ thuộc chữ trên nút). Đây là tín hiệu hoàn thành ĐÁNG TIN CẬY NHẤT hiện có vì là số liệu
 * (progress thật/tổng số bài), không phải chữ hiển thị có thể đổi theo bản app.
 * @returns {{done: number, total: number}|null}
 */
export function parseProgressFraction(text) {
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec((text ?? "").trim());
  if (!m) return null;
  return { done: Number(m[1]), total: Number(m[2]) };
}

/**
 * Thử suy ra trạng thái THẲNG TỪ field CMS (getUnitsOfBook()) - xem lịch sử điều tra đầy đủ
 * trong automation/README.md mục "Chỉ random Unit đã Hoàn thành". Kết luận đã xác nhận thật
 * (gọi API thật 2026-08-05): CMS admin (CMS_ACCESS_TOKEN, role "admin") KHÔNG có field tiến độ
 * học sinh đáng tin (progress/completed_items/completed_lessons luôn = 0, "status" là trạng
 * thái biên tập nội dung draft/done - không phải tiến độ học) - nên hàm này hiện LUÔN trả về
 * null cho CMS thật, để detectFromUiSignals() quyết định. Vẫn giữ các field boolean tường minh
 * (completed/is_completed/completion_status/is_locked/unlocked) để tự hoạt động đúng ngay nếu
 * CMS sau này bổ sung field theo học sinh.
 * @returns {{state: string, confidence: number, source: "CMS", reason: string}|null}
 */
export function detectFromCmsFields(unit) {
  for (const key of ["completed", "is_completed", "completion_status"]) {
    const value = unit?.[key];
    if (typeof value === "boolean") {
      return {
        state: value ? STATES.COMPLETED : STATES.NOT_COMPLETED,
        confidence: 0.99,
        source: "CMS",
        reason: `field "${key}" = ${value}`,
      };
    }
    if (typeof value === "string") {
      if (/^(true|completed|done)$/i.test(value)) {
        return { state: STATES.COMPLETED, confidence: 0.99, source: "CMS", reason: `field "${key}" = "${value}"` };
      }
      if (/^(false|incomplete|in_progress|pending)$/i.test(value)) {
        return { state: STATES.NOT_COMPLETED, confidence: 0.99, source: "CMS", reason: `field "${key}" = "${value}"` };
      }
    }
  }
  if (typeof unit?.percent_completed === "number") {
    return {
      state: unit.percent_completed >= 100 ? STATES.COMPLETED : STATES.NOT_COMPLETED,
      confidence: 0.95,
      source: "CMS",
      reason: `percent_completed = ${unit.percent_completed}`,
    };
  }
  if (unit?.is_locked === true || unit?.unlocked === false) {
    return { state: STATES.NOT_COMPLETED, confidence: 0.8, source: "CMS", reason: "is_locked/unlocked cho biết Unit đang khoá" };
  }
  return null;
}

/**
 * Suy ra trạng thái từ tín hiệu đọc được trên app (unitStatusProbe.js#scanUnitsListScreen) -
 * ĐỌC NHIỀU THUỘC TÍNH (progress fraction, nhãn nút, enabled/clickable của nút), KHÔNG chỉ dựa
 * vào nhãn nút. Ưu tiên progress fraction (số liệu, ổn định) làm tín hiệu chính; nhãn nút chỉ
 * dùng đối chiếu - khớp thì tăng độ tin cậy, lệch thì tin fraction hơn nhưng hạ độ tin cậy
 * (có thể app đã đổi chữ nút mà chưa cập nhật KNOWN_ACTION_LABELS).
 *
 * @param {{fractionText?: string, buttonLabel?: string, buttonClickable?: boolean, buttonEnabled?: boolean}|null} uiCard
 *   - null nếu KHÔNG tìm thấy card của Unit này trên app (đã scroll hết danh sách vẫn không thấy)
 * @returns {{state: string, confidence: number, source: "UI", reason: string}}
 */
export function detectFromUiSignals(uiCard, { knownLabels = KNOWN_ACTION_LABELS } = {}) {
  if (!uiCard) {
    return {
      state: STATES.UNKNOWN,
      confidence: 0,
      source: "UI",
      reason: "Không tìm thấy card của Unit này trên app (có thể chưa publish/không nằm trong vùng scroll được)",
    };
  }

  const fraction = parseProgressFraction(uiCard.fractionText);
  const labelState = classifyLabel(uiCard.buttonLabel, knownLabels);
  // Chưa từng quan sát được nút bị disabled/không-clickable trên máy thật (mọi Unit gặp được
  // tới nay đều "enabled=true, clickable=true") - coi là dấu hiệu KHẢ NGHI (có thể là Unit
  // đang khoá, dạng chưa xác nhận) nên chỉ hạ độ tin cậy, không tự suy diễn thành 1 state cụ thể.
  const buttonSuspicious = uiCard.buttonClickable === false || uiCard.buttonEnabled === false;

  if (fraction && fraction.total > 0) {
    const fractionState = fraction.done >= fraction.total ? STATES.COMPLETED : STATES.NOT_COMPLETED;
    const fractionReason = `progress ${fraction.done}/${fraction.total}`;

    if (labelState && labelState === fractionState) {
      return {
        state: fractionState,
        confidence: buttonSuspicious ? 0.75 : 0.98,
        source: "UI",
        reason: `${fractionReason}, khớp nhãn nút "${uiCard.buttonLabel}"`,
      };
    }
    if (labelState && labelState !== fractionState) {
      return {
        state: fractionState,
        confidence: 0.7,
        source: "UI",
        reason:
          `${fractionReason} nhưng nhãn nút "${uiCard.buttonLabel}" lại gợi ý ngược lại - tin ` +
          `progress hơn (số liệu) nhưng hạ độ tin cậy vì 2 tín hiệu không khớp`,
      };
    }
    return {
      state: fractionState,
      confidence: buttonSuspicious ? 0.7 : 0.9,
      source: "UI",
      reason: `${fractionReason}, không có nhãn nút để đối chiếu`,
    };
  }

  if (labelState) {
    return {
      state: labelState,
      confidence: 0.55,
      source: "UI",
      reason: `chỉ có nhãn nút "${uiCard.buttonLabel}" (không đọc được progress fraction để đối chiếu)`,
    };
  }

  return {
    state: STATES.UNKNOWN,
    confidence: 0.4,
    source: "UI",
    reason: "không đọc được progress fraction lẫn nhãn nút hợp lệ từ card này",
  };
}
