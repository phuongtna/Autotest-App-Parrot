/**
 * Đọc danh sách "Đề thầy cô giao" THẬT đang hiển thị trên UI (tab Ôn thi > Đề thầy cô giao) - CÙNG
 * kiến trúc với automation/bai_tap/discovery/homeworkUiList.js (đọc qua `bridge.hierarchy()`, tự
 * phân nhóm theo text, KHÔNG gọi CMS/teacher-portal API) vì module "Ôn thi" chưa có bất kỳ API
 * model nào được xác nhận (xem automation/on_thi/model/onThiModel.js).
 *
 * CHƯA VERIFY TRÊN THIẾT BỊ THẬT (khác hẳn homeworkUiList.js, file đó đã verify qua rất nhiều lượt
 * device thật) - toàn bộ hằng số bên dưới suy ra từ 2 nguồn duy nhất đang có:
 *   1. Mô tả nghiệp vụ (flows/app/on_thi/spec.json, mục 3.3.1 "Danh sách đề")
 *   2. 1 ảnh mockup Figma (control 1-4: Label số lượng đề, Dropdown thời gian giao, Card đề chưa
 *      nộp, Card đề đã nộp) do BA cung cấp trong phiên làm việc tạo test case
 * KHÔNG suy đoán thêm ngoài 2 nguồn này. BẮT BUỘC đối chiếu lại bằng `maestro hierarchy` trên thiết
 * bị thật (hoặc `uiautomator dump`) TRƯỚC KHI tin tưởng các hằng số dưới đây cho 1 lượt chạy thật -
 * xem ghi chú "CẦN XÁC MINH" ở từng hằng số.
 */

// CẦN XÁC MINH: ảnh mockup có nhãn "Đề cơ bản" (tag màu vàng nhạt) phía trên card đầu tiên - suy
// đoán hợp lý nhất là tương đương "Bài tập về nhà"/"Bài tập nâng cao" của module Bài tập (spec.json
// nói "Gồm đề cơ bản và đề nâng cao, thể hiện giống module Bài tập"), nhưng CHƯA thấy ảnh/hierarchy
// nào xác nhận nhãn "Đề nâng cao" tồn tại thật + CHƯA rõ đây là section-header (giống Bài tập) hay
// chỉ là 1 tag/badge gắn trên từng card riêng lẻ (khác cấu trúc hẳn) - 2 khả năng này cần cách parse
// khác nhau. Để SECTION_HEADERS rỗng (không dùng làm anchor bắt buộc) cho tới khi xác nhận, tránh
// lặp lại đúng lỗi "Chinh phục" từng gặp ở homeworkUiList.js (section không xuất hiện -> card bị bỏ
// sót vĩnh viễn nếu lỡ coi section header là bắt buộc).
const SECTION_HEADERS = ["Đề cơ bản", "Đề nâng cao"];

// CẦN XÁC MINH: spec.json liệt kê CTA "Làm bài" (chưa làm) / ngụ ý "Làm tiếp" (đang làm dở, suy từ
// văn phong "tiến độ x/y câu đã làm" + đối chiếu quy ước "Làm bài tập -> Làm bài/Tiếp tục" của module
// Bài tập) - ảnh mockup CHỈ chụp được "Làm tiếp" (card có tiến độ 8/30) và "Làm bài" (card 0/10) nên
// 2 giá trị này ĐÃ thấy thật trong ảnh, không phải suy đoán. "Xem bài đã làm" (đề đã nộp) là link
// riêng (như homeworkPageObjects.list.viewCompletedLink), KHÔNG liệt kê chung CTA_TEXTS bên dưới vì
// không kết thúc 1 card theo kiểu tap-để-mở-đề như 2 CTA kia.
const CTA_TEXTS = ["Làm bài", "Làm tiếp"];
const VIEW_COMPLETED_LINK = "Xem bài đã làm";

// Giống hệt PROGRESS_PATTERN của homeworkUiList.js ("x / y" có/không khoảng trắng) - ảnh mockup
// thật hiển thị "8 / 30" (card đang làm dở) và "0 / 10" (card chưa làm) - khớp định dạng này.
const PROGRESS_PATTERN = /^\d+\s*\/\s*\d+$/;

// ĐÃ VERIFY THẬT (2026-10-28, thiết bị 3201d866d40a1681, app com.inet.parrotedu, tài khoản/profile
// "Phương" lớp 11A2, `maestro hierarchy` màn Ôn thi > Đề thầy cô giao): "Hạn nộp 28/10 (Hôm nay)" -
// KHÁC HẲN module Bài tập (dòng "Hạn nộp Hôm nay" KHÔNG kèm DD/MM, xem comment DUE_DATE_PATTERN của
// homeworkUiList.js) - on_thi LUÔN giữ DD/MM thật, chỉ thêm hậu tố "(Hôm nay)" giống hệt cách thêm
// hậu tố "(QUÁ HẠN)". Sửa pattern để nhận cả 2 hậu tố sau DD/MM (không còn nhánh "Hôm nay" đứng một
// mình như module Bài tập - CHƯA thấy biến thể đó ở on_thi).
const DUE_DATE_PATTERN = /^Hạn nộp \d{2}\/\d{2}(\s*\((QUÁ HẠN|Hôm nay)\))?$/;

// KHÁC homeworkUiList.js: card đã nộp của on_thi hiển thị "Điểm của lần làm bài cao nhất" (không
// phải điểm lần làm gần nhất) - CHƯA thấy ảnh/hierarchy xác nhận text chính xác đi kèm (vd "Điểm
// 8.0" hay "8.0 điểm" hay chỉ số thô "8.0") - để pattern rộng chấp nhận số thập phân (khác
// SCORE_PATTERN của Bài tập chỉ chấp nhận số nguyên có thể kèm 1 phần thập phân, giữ tương tự) NHƯNG
// đánh dấu CẦN XÁC MINH chữ "Điểm" có đứng trước hay không trước khi dùng pattern này làm anchor bắt
// buộc trong môi trường thật.
const SCORE_PATTERN = /^Điểm\s+[0-9]+(?:[.,][0-9]+)?$/;

const MAX_CTA_LOOKAHEAD = 6;

function isScrollableContainerNode(attrs) {
  // Cùng lý do/cùng cách né bug "Chuyển profile" đã ghi trong homeworkUiList.js: chỉ dựa cờ
  // `scrollable`, không dựa `class` (có thể cũng có 2 ScrollView lồng nhau giống màn Bài tập vì
  // cùng kiến trúc app) - CẦN XÁC MINH lại cấu trúc hierarchy thật của màn này, tạm áp dụng y hệt
  // giả định đã verify đúng ở module Bài tập.
  return attrs?.scrollable === "true";
}

/**
 * @param {Object} node
 * @param {Array<{text:string, bounds:?Object}>} acc
 * @param {boolean} insideScrollableList
 */
export function collectTextNodesWithBoundsInsideScrollableList(node, acc, insideScrollableList = false) {
  const attrs = node?.attributes ?? {};
  const nowInside = insideScrollableList || isScrollableContainerNode(attrs);
  const text = attrs.text;
  if (nowInside && typeof text === "string" && text.trim()) {
    acc.push({ text: text.trim(), bounds: parseBounds(attrs.bounds) });
  }
  for (const child of node?.children ?? []) collectTextNodesWithBoundsInsideScrollableList(child, acc, nowInside);
  return acc;
}

/** @param {?string} boundsStr - vd "[12,340][1068,520]" */
export function parseBounds(boundsStr) {
  const m = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(boundsStr ?? "");
  if (!m) return null;
  const [x1, y1, x2, y2] = m.slice(1).map(Number);
  return { x1, y1, x2, y2 };
}

/** @param {{x1:number,y1:number,x2:number,y2:number}} bounds */
export function centerPoint(bounds) {
  return { x: Math.round((bounds.x1 + bounds.x2) / 2), y: Math.round((bounds.y1 + bounds.y2) / 2) };
}

/**
 * Parse card "Đề thầy cô giao" - CÙNG thuật toán/bất biến đã verify thật ở
 * homeworkUiList.js#parseHomeworkCardsWithDetail() ("title luôn đứng NGAY TRƯỚC anchor của chính
 * nó"; anchor = progress "x/y" HOẶC due-date "Hạn nộp..." HOẶC score "Điểm N"; CTA tìm trong
 * MAX_CTA_LOOKAHEAD dòng kế tiếp, bỏ qua anchor phụ thứ 2 của CÙNG card) - CHỈ đổi hằng số
 * (SECTION_HEADERS/CTA_TEXTS/...) theo on_thi, KHÔNG đổi thuật toán, để không lặp lại công sức sửa
 * lỗi đã tốn ở homeworkUiList.js (xem CTA_TEXTS bên trên cho khác biệt duy nhất: on_thi có thêm
 * "Xem bài đã làm" như 1 link riêng ngoài CTA_TEXTS - card đã nộp khớp bởi SCORE_PATTERN và CTA tìm
 * được chính là VIEW_COMPLETED_LINK, không phải "Làm lại").
 * @param {Array<{text:string, bounds:?Object}>} nodes
 * @param {{ sectionSeen?: boolean }} [state]
 * @returns {{ cards: Array<{title:string, titleBounds:?Object, dueDate:?string, progress:?string, score:?string, cta:string, ctaBounds:?Object}>, sectionSeen: boolean }}
 */
export function parseOnThiCardsWithDetail(nodes, { sectionSeen: initialSectionSeen = false } = {}) {
  const cards = [];
  let sectionSeen = initialSectionSeen;
  const allCta = [...CTA_TEXTS, VIEW_COMPLETED_LINK];
  for (let i = 0; i < nodes.length; i++) {
    const { text } = nodes[i];
    if (SECTION_HEADERS.includes(text)) {
      sectionSeen = true;
      continue;
    }
    // KHÁC homeworkUiList.js: không bắt buộc `sectionSeen` trước khi nhận card - section-header của
    // on_thi CHƯA xác nhận có tồn tại thật (xem ghi chú SECTION_HEADERS phía trên); nếu màn thật
    // KHÔNG có section-header, bắt buộc `sectionSeen` sẽ khiến mọi card bị bỏ sót vĩnh viễn giống
    // hệt lỗi "Chinh phục" cũ. Khi xác nhận thật có section-header bắt buộc, bỏ comment dòng dưới.
    // if (!sectionSeen) continue;

    const isProgress = PROGRESS_PATTERN.test(text);
    const isDue = DUE_DATE_PATTERN.test(text);
    const isScore = SCORE_PATTERN.test(text);
    if (!isProgress && !isDue && !isScore) continue;

    const titleNode = nodes[i - 1];
    const title = titleNode?.text;
    if (
      !title ||
      SECTION_HEADERS.includes(title) ||
      PROGRESS_PATTERN.test(title) ||
      DUE_DATE_PATTERN.test(title) ||
      SCORE_PATTERN.test(title) ||
      allCta.includes(title)
    ) {
      continue;
    }

    let dueDate = isDue ? text : null;
    let progress = isProgress ? text : null;
    let score = isScore ? text : null;
    let cta = null;
    let ctaBounds = null;
    for (let j = i + 1; j < Math.min(nodes.length, i + 1 + MAX_CTA_LOOKAHEAD); j++) {
      const t = nodes[j].text;
      if (!isScore && dueDate === null && DUE_DATE_PATTERN.test(t)) {
        dueDate = t;
        continue;
      }
      if (allCta.includes(t)) {
        cta = t;
        ctaBounds = nodes[j].bounds;
        break;
      }
      if (SECTION_HEADERS.includes(t)) break;
      if (PROGRESS_PATTERN.test(t) || SCORE_PATTERN.test(t)) {
        const prevText = nodes[j - 1]?.text;
        const prevIsAnchor = PROGRESS_PATTERN.test(prevText) || DUE_DATE_PATTERN.test(prevText) || SCORE_PATTERN.test(prevText);
        if (prevIsAnchor) {
          if (progress === null && PROGRESS_PATTERN.test(t)) progress = t;
          if (score === null && SCORE_PATTERN.test(t)) score = t;
          continue;
        }
        break;
      }
    }
    if (!cta) continue;

    cards.push({ title, titleBounds: titleNode.bounds, dueDate, progress, score, cta, ctaBounds });
  }
  return { cards, sectionSeen };
}

export { CTA_TEXTS, VIEW_COMPLETED_LINK, SECTION_HEADERS, PROGRESS_PATTERN, DUE_DATE_PATTERN, SCORE_PATTERN };
