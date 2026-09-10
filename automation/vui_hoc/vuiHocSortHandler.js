/**
 * Handler cho câu SẮP XẾP (CMS type "SORT") của Vui học - testID THẬT xác nhận qua `maestro
 * hierarchy` sống (2026-09-10, thiết bị 3201d866d40a1681, Khối 8 > Review 4 > Language > Đề part
 * 2, câu cuối "Reorder the sentences to make a meaningful paragraph"):
 *   - "exercise_sort_area"     - khung chứa toàn bộ câu SORT.
 *   - "exercise_sort_word_{i}" - từng dòng có thể kéo (handle "≡" bên phải). QUAN TRỌNG: hậu tố
 *     "{i}" là ĐỊNH DANH CỐ ĐỊNH theo nội dung/thứ tự XÁO TRỘN BAN ĐẦU do BE trả về - KHÔNG đổi
 *     khi kéo-thả (đã xác nhận thật: sau 1 lần kéo, "exercise_sort_word_0" đổi "bounds" nhưng vẫn
 *     đúng nội dung cũ) - "bounds" (vị trí hiện tại trên màn) mới là thứ thay đổi sau mỗi lần kéo.
 *
 * ĐÃ XÁC NHẬN THẬT - Maestro `tapOn` KHÔNG kéo được (đúng như audit cũ trong
 * flows/app/exercise/EX-20-sort-render-any-build.yaml: `SortableWord.tsx:174` - `tapGesture` chỉ
 * *báo cáo* vị trí hiện tại, không di chuyển). NHƯNG khác với audit cũ (kết luận "Maestro không
 * tạo được gesture" - audit đó CHƯA THỬ `swipe`, chỉ thử `tapOn`): `swipe` (nhấn-giữ-kéo-thả thật,
 * duration ~700-800ms) hoạt động ĐÚNG - xác nhận qua 2 lần kéo thật liên tiếp trên chính câu này,
 * đổi đúng thứ tự 2 dòng liền kề mỗi lần, nút "Kiểm tra" chuyển từ xám (disabled) sang xanh
 * (enabled) ngay sau lần kéo ĐẦU TIÊN.
 *
 * NGUỒN "thứ tự đúng" - KHÔNG cần OCR/đọc text trên màn (accessibilityText/text của
 * "exercise_sort_word_{i}" và toàn bộ con cháu đều RỖNG - app ẩn hẳn khỏi accessibility tree, đã
 * xác nhận qua dump `maestro hierarchy` thật, 0 text nào đọc được): CMS trả "question.content" là
 * chuỗi các đoạn/câu XÁO TRỘN nối bằng "/" - ĐÃ XÁC NHẬN THẬT thứ tự này khớp CHÍNH XÁC 1-1 với
 * "exercise_sort_word_{i}" ban đầu (i = vị trí trong mảng đã split, đối chiếu qua chính câu live
 * kể trên: content[0]="Additionally..." <-> word_0 nằm ở dòng đầu tiên lúc mới vào câu). "correct"
 * là chuỗi CÙNG các đoạn đó nhưng theo ĐÚNG thứ tự - so khớp text để suy ra hoán vị cần đạt, không
 * cần biết ý nghĩa nội dung.
 */

function splitSegments(text) {
  if (typeof text !== "string") return [];
  return text
    .trim()
    .split(/\s*\/\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeForCompare(text) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Suy ra hoán vị cần đạt từ QuestionModel (KHÔNG đọc thiết bị).
 * @param {import("../model/questionModel.js").QuestionModel} questionModel
 * @returns {number[]|null} targetWordIndices[slot] = word_{đó} phải nằm ở vị trí `slot` (0-based
 *   từ trên xuống) - null nếu không suy ra được (content/correct thiếu, số đoạn lệch nhau, hoặc
 *   không khớp text được đoạn nào đó - KHÔNG đoán, để caller tự quyết định BLOCKED).
 */
export function resolveSortTargetOrder(questionModel) {
  const initial = splitSegments(questionModel?.question);
  const target = splitSegments(questionModel?.correctAnswer);
  if (initial.length < 2 || target.length !== initial.length) return null;

  const normalizedInitial = initial.map(normalizeForCompare);
  const targetWordIndices = target.map((seg) => {
    const normSeg = normalizeForCompare(seg);
    let idx = normalizedInitial.indexOf(normSeg);
    return idx;
  });
  if (targetWordIndices.some((i) => i === -1)) return null;
  if (new Set(targetWordIndices).size !== initial.length) return null; // trùng lặp -> không tin cậy
  return targetWordIndices;
}

function parseBounds(boundsStr) {
  const m = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(boundsStr || "");
  if (!m) return null;
  const [, x1, y1, x2, y2] = m.map(Number);
  return { x1, y1, x2, y2, cy: (y1 + y2) / 2 };
}

/** Đọc bounds hiện tại của "exercise_sort_area" + toàn bộ "exercise_sort_word_{i}" từ 1 tree đã có
 * sẵn (không tự gọi hierarchy - caller quyết định khi nào cần đọc mới). */
export function collectSortState(tree) {
  let areaBounds = null;
  const wordBounds = new Map();
  function walk(node) {
    const id = node?.attributes?.["resource-id"] || "";
    if (id === "exercise_sort_area") areaBounds = parseBounds(node.attributes.bounds);
    const m = id.match(/^exercise_sort_word_(\d+)$/);
    if (m) {
      const b = parseBounds(node.attributes.bounds);
      if (b) wordBounds.set(Number(m[1]), b);
    }
    for (const c of node?.children ?? []) walk(c);
  }
  walk(tree);
  return { areaBounds, wordBounds };
}

/**
 * Tính TOẠ ĐỘ 1 LƯỢT KÉO TIẾP THEO (hoặc null nếu đã đúng thứ tự) - đọc bounds THẬT từ `tree`
 * TRUYỀN VÀO (KHÔNG mô phỏng/cộng dồn chiều cao) - mỗi lần gọi PHẢI truyền `tree` MỚI (đọc lại
 * `bridge.hierarchy()` sau mỗi lần kéo thật) để phản ánh đúng vị trí thật hiện tại.
 *
 * LỊCH SỬ (2026-09-10): bản trước GỘP toàn bộ N-1 lượt kéo vào 1 lần tính toán DUY NHẤT bằng cách
 * MÔ PHỎNG lại vị trí (cộng dồn chiều cao từng dòng từ 1 lần đọc bounds ban đầu, không đọc lại
 * thiết bị giữa chừng) - ĐÃ ĐO THẬT LỖI: kết quả cuối SAI 1 phần dù thuật toán hoán vị đúng trên
 * giấy (đối chiếu qua "maestro hierarchy" thật SAU khi chạy: cùng 1 hoán vị y hệt (2 lượt kéo) áp
 * dụng 2 lần trên chính câu này - 1 lần cho kết quả ĐÚNG hoàn toàn khi đọc lại bounds sau MỖI lần
 * kéo, 1 lần cho kết quả SAI khi mô phỏng gộp). ROOT CAUSE xác nhận: công thức mô phỏng
 * "top + Σheight" giả định các dòng XẾP SÁT NHAU không khoảng cách - bounds THẬT của
 * "exercise_sort_word_{i}" (`y2-y1`) KHÔNG bao gồm margin/spacing GIỮA 2 thẻ (đo thật: dòng thứ 3
 * trong danh sách lệch ~64px giữa toạ độ mô phỏng và toạ độ tâm THẬT sau 2 dòng có margin) - sai số
 * này CỘNG DỒN qua nhiều lần kéo trong cùng 1 lượt mô phỏng, đủ lớn để lượt kéo THỨ 2 nhắm SAI vị
 * trí. SỬA: bỏ hẳn mô phỏng, đọc bounds THẬT trước MỖI lần kéo (đúng lại kỹ thuật đã proven ở lần
 * live-test ĐẦU TIÊN, xem lịch sử git) - đổi lại tốn thêm N-2 lượt `hierarchy()` so với bản gộp,
 * NHƯNG đó là chi phí BẮT BUỘC để đúng - 1 câu SORT sai đáp án phá hỏng toàn bộ mục tiêu tự động
 * hoá, tốn kém hơn nhiều so với vài chục giây gọi thêm hierarchy().
 *
 * Điểm bấm giữ khi kéo: dùng CHUNG 1 toạ độ X gần mép phải "exercise_sort_area" (nơi có tay cầm
 * "≡") thay vì tâm dòng - khớp ĐÚNG điểm đã kéo thành công thật trên thiết bị (không phải tâm
 * "exercise_sort_word_{i}", vì bounds của node đó KHÔNG bao trùm tay cầm - tay cầm nằm ngoài,
 * thuộc container cha rộng hơn).
 *
 * @param {number[]} targetWordIndices
 * @param {Object} tree - `bridge.hierarchy()` MỚI NHẤT (đọc lại sau mỗi lần kéo trước đó).
 * @returns {Object|null} 1 Maestro `swipe` step, hoặc `null` nếu thứ tự đã đúng hoàn toàn.
 */
export function computeNextSortMove(targetWordIndices, tree) {
  const n = targetWordIndices.length;
  const { areaBounds, wordBounds } = collectSortState(tree);
  if (!areaBounds) throw new Error("SORT: không đọc được bounds của exercise_sort_area.");
  if (wordBounds.size !== n) {
    throw new Error(`SORT: số dòng đọc được trên màn (${wordBounds.size}) khác số đoạn CMS (${n}) - có thể chưa cuộn đủ.`);
  }
  const dragX = Math.round(areaBounds.x2 - 40);
  const order = [...wordBounds.entries()].sort((a, b) => a[1].cy - b[1].cy).map(([idx]) => idx);

  for (let slot = 0; slot < n - 1; slot++) {
    const desired = targetWordIndices[slot];
    if (order[slot] === desired) continue; // đã đúng vị trí, không cần kéo.
    const from = wordBounds.get(desired);
    const to = wordBounds.get(order[slot]);
    if (!from || !to) throw new Error(`SORT: thiếu bounds cho word index ${desired}/${order[slot]}.`);
    return { swipe: { start: `${dragX},${Math.round(from.cy)}`, end: `${dragX},${Math.round(to.cy)}`, duration: 700 } };
  }
  return null; // đã đúng thứ tự hoàn toàn.
}
