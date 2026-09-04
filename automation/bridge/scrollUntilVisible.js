/**
 * Utility scroll dùng CHUNG cho MỌI pipeline trả lời bài tập (bai_tap/navigation/
 * homeworkExamEngine.js VÀ runtime/handlers/*.js) - tách ra từ homeworkExamEngine.js (nơi thuật
 * toán này được audit + verify thật lần đầu, xem PERF audit 2026-08-20 ở lịch sử file đó) để
 * KHÔNG nhân bản thuật toán scroll ở nơi thứ 2 (mọi Handler cần "cuộn tới khi đủ nội dung/control"
 * đều import từ đây).
 *
 * NGUYÊN TẮC 2 PHASE (áp dụng nhất quán cho MỌI dạng bài, theo đúng yêu cầu UI-visibility-safety):
 *   PHASE A (nội dung câu hỏi/đáp án) - dùng `collectByScrollingIfNeeded()` trực tiếp với tiêu
 *     chí "đủ" riêng của từng dạng bài (vd đủ số ô trống, đủ cặp nối, đủ text đáp án) - ĐÃ có sẵn
 *     trong homeworkExamEngine.js (ensureAllBlanksVisible/ensureAllConnectPairsVisible/
 *     ensureAllAnswersVisible), KHÔNG di dời (đặc thù theo dạng bài, không tổng quát hoá được).
 *   PHASE B (control cuối - CTA/nút Kiểm tra) - `ensureIdVisible()`/`ensureTextVisible()` bên
 *     dưới, ĐỘC LẬP với Phase A (không yêu cầu nội dung câu hỏi VẪN đang hiển thị cùng lúc CTA -
 *     đúng tinh thần `ensure-exercise-controls-visible.yaml` đã verify thật: neo scroll vào CHÍNH
 *     control cần bấm, không phải 1 phần tử nội dung giữa trang).
 *
 * "Visible" ở đây LUÔN nghĩa là bounds nằm HOÀN TOÀN trong viewport (không chỉ "tồn tại trong
 * hierarchy") - 1 phần tử ngoài khung hình KHÔNG được kết luận là "không tồn tại" (yêu cầu rõ:
 * không lẫn lộn 2 khái niệm này).
 */

const CONTENT_SWIPE = { start: "50%,80%", end: "50%,30%", duration: 400 };
const MAX_CONTENT_SCROLLS = 10;
const MAX_CONTROL_SCROLLS = 8; // khớp "times: 8" đã verify thật trong ensure-exercise-controls-visible.yaml

/** Bounds string "[x1,y1][x2,y2]" -> {x1,y1,x2,y2} - ĐÚNG format đã xác nhận thật trong
 * discovery/homeworkUiList.js#parseBounds() (không bịa format mới). */
export function parseBoundsSimple(boundsStr) {
  const m = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(boundsStr || "");
  if (!m) return null;
  const [, x1, y1, x2, y2] = m.map(Number);
  return { x1, y1, x2, y2 };
}

/** Tìm bounds của node ĐẦU TIÊN khớp resource-id pattern (DFS). */
export function findNodeBounds(tree, idPattern) {
  let found = null;
  function walk(node) {
    if (found) return;
    if (idPattern.test(node?.attributes?.["resource-id"] || "")) {
      found = parseBoundsSimple(node.attributes.bounds);
      return;
    }
    for (const c of node?.children ?? []) walk(c);
  }
  walk(tree);
  return found;
}

/** Tìm bounds của node ĐẦU TIÊN có "text" khớp CHÍNH XÁC (dùng cho Phase B theo text, vd nút
 * "Kiểm tra"/đáp án TRUE_FALSE/ONE - các dạng bài không có resource-id ổn định). */
function findNodeBoundsByText(tree, text) {
  let found = null;
  function walk(node) {
    if (found) return;
    if (node?.attributes?.text === text) {
      found = parseBoundsSimple(node.attributes.bounds);
      return;
    }
    for (const c of node?.children ?? []) walk(c);
  }
  walk(tree);
  return found;
}

/** true nếu bounds NẰM HOÀN TOÀN trong viewport (không bị cắt trên/dưới). Không xác định được
 * bounds/viewport -> fail-open (coi như đủ, không chặn flow - an toàn hơn treo vòng lặp cuộn vô
 * ích khi không đọc được toạ độ). */
export function isFullyInViewport(bounds, viewport) {
  if (!bounds || !viewport) return true;
  return bounds.y1 >= viewport.y1 && bounds.y2 <= viewport.y2;
}

/** Viewport tham chiếu: ưu tiên "exercise_doing_screen" (màn "Bài tập", đã xác nhận luôn có mặt -
 * xem homeworkExamEngine.js), fallback về bounds của CHÍNH node gốc cây hierarchy (thường là toàn
 * bộ khung màn hình thiết bị trong mọi dump `maestro hierarchy`) - fallback này CẦN THIẾT cho
 * pipeline `runtime/handlers` (màn "Vui học", KHÔNG có "exercise_doing_screen") để Phase B vẫn có
 * 1 viewport thật thay vì luôn fail-open. Không tìm được cả 2 -> null (giữ nguyên fail-open ở
 * `isFullyInViewport()`). */
function resolveViewport(tree) {
  return findNodeBounds(tree, /^exercise_doing_screen$/) ?? parseBoundsSimple(tree?.attributes?.bounds) ?? null;
}

/**
 * Nguyên tắc CHUNG cho scroll-tới-khi-đủ: đọc hiện tại -> kiểm tra đủ chưa (`isDone`) -> nếu
 * chưa, cuộn 1 bước + đọc lại + gộp vào accumulator (`collect`, PHẢI idempotent/merge được qua
 * nhiều lần gọi) -> lặp lại tối đa `maxScrolls` lần HOẶC tới khi 2 lần cuộn liên tiếp không tiến
 * triển thêm (`sizeOf` không tăng). KHÔNG cuộn gì cả nếu `tree` ban đầu đã đủ (0 chi phí thêm -
 * giữ nguyên hiệu năng cho câu vừa 1 màn hình, đa số câu thực tế - yêu cầu "preserve existing
 * successful behavior khi câu đã vừa màn hình").
 * @returns {Promise<{ tree: Object, acc: any, scrollCount: number }>}
 */
export async function collectByScrollingIfNeeded(
  bridge,
  initialTree,
  { collect, isDone, sizeOf, initialAcc },
  { maxScrolls = MAX_CONTENT_SCROLLS } = {},
) {
  let tree = initialTree;
  let acc = collect(tree, initialAcc);
  if (isDone(acc)) return { tree, acc, scrollCount: 0 };

  let lastSize = sizeOf(acc);
  let noProgressStreak = 0;
  let scrollCount = 0;
  while (scrollCount < maxScrolls && noProgressStreak < 2) {
    const swipeResult = await bridge.runSteps([{ swipe: CONTENT_SWIPE }, { waitForAnimationToEnd: { timeout: 600 } }]);
    if (!swipeResult.success) break;
    scrollCount++;
    tree = await bridge.hierarchy();
    acc = collect(tree, acc);
    if (isDone(acc)) return { tree, acc, scrollCount };
    const size = sizeOf(acc);
    noProgressStreak = size > lastSize ? 0 : noProgressStreak + 1;
    lastSize = size;
  }
  return { tree, acc, scrollCount };
}

/**
 * PHASE B: cuộn (nếu cần) tới khi 1 resource-id cụ thể (thường là control cuối cùng - CTA/nút
 * Kiểm tra) hiển thị ĐẦY ĐỦ trong viewport - KHÔNG yêu cầu nội dung câu hỏi/đáp án phải vẫn đang
 * hiển thị cùng lúc (2 phase độc lập, xem docblock đầu file). Bounded tại `maxScrolls` (mặc định
 * 8, khớp "times: 8" đã verify thật trong ensure-exercise-controls-visible.yaml) - dừng NGAY khi
 * đã visible, không cuộn thừa.
 * @returns {Promise<{ tree: Object, visible: boolean, scrollCount: number }>}
 */
export async function ensureIdVisible(bridge, initialTree, idPattern, { maxScrolls = MAX_CONTROL_SCROLLS } = {}) {
  const result = await collectByScrollingIfNeeded(
    bridge,
    initialTree,
    {
      collect: (tree) => {
        const bounds = findNodeBounds(tree, idPattern);
        return Boolean(bounds && isFullyInViewport(bounds, resolveViewport(tree)));
      },
      isDone: (acc) => acc === true,
      sizeOf: (acc) => (acc ? 1 : 0),
      initialAcc: false,
    },
    { maxScrolls },
  );
  return { tree: result.tree, visible: result.acc === true, scrollCount: result.scrollCount };
}

/**
 * PHASE B theo TEXT (dùng cho dạng bài chọn đáp án bằng text - TRUE_FALSE/ONE/nút "Kiểm tra"/CTA
 * "Tiếp theo"/"Nộp bài"/"Hoàn thành" - không có resource-id ổn định) - CÙNG nguyên tắc/giới hạn
 * với `ensureIdVisible()`. `texts` nhận 1 string HOẶC mảng string (ANY 1 khớp là đủ - dùng cho các
 * nhóm CTA "1 trong N nhãn, chỉ 1 nhãn hiển thị tại 1 thời điểm" đã có sẵn trong repo, vd
 * NEXT_OR_SUBMIT_CTA_CANDIDATES) - tránh phải cuộn RIÊNG cho từng candidate (lãng phí, vi phạm
 * "không cuộn thừa").
 * @param {string|string[]} texts
 * @returns {Promise<{ tree: Object, visible: boolean, scrollCount: number }>}
 */
export async function ensureTextVisible(bridge, initialTree, texts, { maxScrolls = MAX_CONTROL_SCROLLS } = {}) {
  const candidates = Array.isArray(texts) ? texts : [texts];
  const result = await collectByScrollingIfNeeded(
    bridge,
    initialTree,
    {
      collect: (tree) => {
        const viewport = resolveViewport(tree);
        return candidates.some((text) => {
          const bounds = findNodeBoundsByText(tree, text);
          return Boolean(bounds && isFullyInViewport(bounds, viewport));
        });
      },
      isDone: (acc) => acc === true,
      sizeOf: (acc) => (acc ? 1 : 0),
      initialAcc: false,
    },
    { maxScrolls },
  );
  return { tree: result.tree, visible: result.acc === true, scrollCount: result.scrollCount };
}
