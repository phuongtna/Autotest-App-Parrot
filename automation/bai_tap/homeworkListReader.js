import { homeworkPageObjects as po } from "./navigation/homeworkPageObjects.js";

/**
 * Đọc danh sách card "Bài tập" ĐANG THỰC SỰ hiển thị trên màn hình từ 1 lần dump `maestro
 * hierarchy` (bridge.hierarchy()) - parse JSON THẬT bằng code Node, KHÔNG dùng selector
 * `above`/`below` kèm `index` của Maestro để tự đọc/random.
 *
 * LÝ DO (đã kiểm chứng thật, không suy đoán, thiết bị 3201d866d40a1681, 2026-08-07): thử cả
 * selector lồng nhau (`above: { above: {...} }`) LẪN selector đơn tầng có `index` (`above: {text,
 * index: 1}`, `index: 2}`) qua `copyTextFrom` - cả 2 cách đều cho kết quả SAI, có lúc đọc nhầm cả
 * 3 lần liên tiếp (index 0/1/2) đều ra "Chuyển profile" (label góc trên màn hình) dù dữ liệu thật
 * trên màn hình khác hẳn. Ngược lại, parse trực tiếp JSON của `maestro hierarchy` bằng code Node
 * (module này) đã dùng NHIỀU LẦN trong phiên làm việc này và LUÔN cho kết quả đúng - nên đây là
 * nguồn DUY NHẤT đáng tin để xác định "Homework nào đang hiển thị/CTA gì" trên màn Bài tập.
 *
 * QUY TẮC GHÉP (thứ tự đọc DOM thật của 1 card, xác nhận qua hierarchy nhiều lần):
 *   <tiêu đề> -> <badge tiến độ "X / Y"> -> <hạn nộp> -> <CTA>
 * 1 card hợp lệ = 1 badge "X / Y" tìm thấy, tiêu đề = phần tử NGAY TRƯỚC badge đó, CTA = phần tử
 * khớp 1 trong CTA_TEXTS tìm thấy SAU badge đó và TRƯỚC badge kế tiếp. Card thiếu tiêu đề (badge
 * đứng ngay sau 1 phần tử KHÔNG phải tiêu đề - vd card bị cắt 1 phần do vừa cuộn tới rìa màn hình)
 * hoặc thiếu CTA hợp lệ đều bị BỎ QUA - không suy đoán, không nhận card chưa hiển thị đủ.
 *
 * CỐ TÌNH LOẠI "Chinh phục" (CTA của Bài tập nâng cao/role_play) khỏi CTA_TEXTS - màn mở ra khi
 * bấm CTA này CHƯA được verify có cùng cấu trúc "HomeworkDoing" (tiêu đề ở đầu màn) hay không.
 */
export const CTA_TEXTS = [po.list.cta.notStartedRegular, po.list.cta.inProgress, po.list.cta.completed];

const PROGRESS_BADGE_PATTERN = /^\d+\s*\/\s*\d+$/;

function collectTexts(node, acc) {
  const text = node?.attributes?.text;
  if (typeof text === "string" && text.trim()) {
    acc.push({ text: text.trim(), bounds: node.attributes.bounds ?? "" });
  }
  for (const child of node?.children ?? []) collectTexts(child, acc);
  return acc;
}

/**
 * @param {Object} hierarchyTree - kết quả bridge.hierarchy() (đã parse JSON)
 * @returns {Array<{title: string, cta: string}>} card THẬT đang hiển thị đủ (có tiêu đề + CTA hợp
 *   lệ), theo đúng thứ tự đọc trên màn hình
 */
export function readVisibleHomeworkCards(hierarchyTree) {
  const flat = collectTexts(hierarchyTree, []);
  const cards = [];
  for (let i = 0; i < flat.length; i++) {
    if (!PROGRESS_BADGE_PATTERN.test(flat[i].text)) continue;
    const titleEntry = flat[i - 1];
    if (!titleEntry || PROGRESS_BADGE_PATTERN.test(titleEntry.text)) continue;

    let cta = null;
    for (let j = i + 1; j < flat.length; j++) {
      if (PROGRESS_BADGE_PATTERN.test(flat[j].text)) break; // đã sang card kế tiếp, dừng tìm
      if (CTA_TEXTS.includes(flat[j].text)) {
        cta = flat[j].text;
        break;
      }
    }
    if (!cta) continue;

    cards.push({ title: titleEntry.text, cta });
  }
  return cards;
}
