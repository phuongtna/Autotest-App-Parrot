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
 * PHASE A ONLY - viewport "nội dung" đã CẮT bỏ vùng bị "exercise_check_button" che khuất - KHÁC
 * `resolveViewport()` ở trên (dùng nguyên cho PHASE B, nơi CHÍNH control đó là mục tiêu cần cuộn
 * tới, không được cắt bớt chính nó).
 *
 * XÁC NHẬN THẬT (2026-09-08, live device 3201d866d40a1681, câu TEXT_CHOICE 4 đáp án
 * "G8-U3-Reading-Bài tập nâng cao" câu 4/5, `maestro hierarchy` dump lúc treo thật):
 *   exercise_doing_screen = [0,0][1080,2301]
 *   exercise_answer_3     = [42,2130][1038,2301]   <- "fully in [0,2301]" theo check RAW cũ (PASS)
 *   exercise_check_button = [42,2110][1038,2250]   <- FOOTER CỐ ĐỊNH, đè lên y=2110..2250
 * `exercise_answer_3` bị footer che phần TRÊN (2130..2250) dù bounds của nó "nằm trong" doing_screen
 * theo phép so sánh toạ độ thuần tuý - `ensureAllAnswersVisible()` (dùng viewport RAW cũ) coi như đã
 * đủ, KHÔNG cuộn thêm, rồi tap vào đáp án đó KHÔNG đăng ký chọn (bị footer chặn) -> CTA đứng yên mãi
 * ("màn hình không đổi sau khi bấm CTA", answer-set vẫn khớp đúng, KHÔNG phải bug matching). CÙNG
 * hiện tượng "exercise_check_button là FOOTER CỐ ĐỊNH, luôn nằm trong khung nhìn bất kể đã cuộn" đã
 * ghi nhận trước đó cho DRAG_DROP (xem flows/app/helpers/answer-current-exercise-generic.yaml) -
 * giờ áp dụng CHUNG cho mọi nội dung PHASE A (TEXT_CHOICE/FILL_WORD/CONNECT): 1 phần tử chỉ THẬT SỰ
 * visible nếu nằm HOÀN TOÀN phía TRÊN mép trên của footer, không chỉ trong bounds màn hình.
 */
export function resolveContentViewport(tree) {
  const viewport = resolveViewport(tree);
  if (!viewport) return viewport;
  const footerBounds = findNodeBounds(tree, /^exercise_check_button$/);
  if (footerBounds && footerBounds.y1 < viewport.y2) {
    return { ...viewport, y2: footerBounds.y1 };
  }
  return viewport;
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

/**
 * PHASE A (tap TỪNG phần tử theo thứ tự KHÔNG đơn điệu) - khác `ensureIdVisible()` ở trên (chỉ
 * cuộn 1 CHIỀU xuống, dùng cho Phase B/control cuối cùng luôn nằm SAU nội dung). CONNECT ghép cặp
 * theo NỘI DUNG (accessibilityText), không theo vị trí - đã xác nhận thật thứ tự index cần tap
 * NHẢY LUNG TUNG so với thứ tự đọc (xem docblock MatchingHandler: "chỉ 1/5 cặp trùng vị trí ngẫu
 * nhiên"). Vì `collectByScrollingIfNeeded()`/`CONTENT_SWIPE` CHỈ cuộn xuống, sau khi Phase A (đọc
 * text) dừng lại ở 1 vị trí cuộn CUỐI CÙNG, các index đọc được ở lượt cuộn ĐẦU đã bị RecyclerView
 * unmount - tap thẳng theo id lúc này thất bại (BUG THẬT: "matching multi-scroll tap stale-index",
 * xác nhận qua đọc code 2026-09-23, bài dạng Nối cần cuộn 2-3 lần để thấy hết nội dung thì tap lại
 * không đưa được phần tử đã cuộn qua trở lại khung nhìn).
 *
 * SỬA: dùng `scrollUntilVisible` GỐC của Maestro (element theo resource-id, KHÔNG phải point-swipe
 * tự chế `CONTENT_SWIPE`) - đã xác nhận thật đáng tin cậy hơn cho việc di chuyển tới 1 phần tử CỤ
 * THỂ theo 1 hướng cho trước (xem `findAssignment.js#scrollToTop()`, dùng `direction: "UP"` thành
 * công ngay trong khi point-swipe tự chế bị "nuốt" ở đúng vị trí đó). Thử "DOWN" trước (trường hợp
 * phổ biến hơn: Phase A vừa merge xong thường dừng ở giữa/cuối danh sách, index cần tap có thể vẫn
 * còn ở phía dưới), fallback "UP" nếu không thấy. KHÔNG tin mù `result.success` của lệnh
 * `scrollUntilVisible` - đã ghi nhận 1 ca false-positive cho tool khác dùng cùng lệnh này
 * (`locateCompletedCandidate.js` 2026-08-22: báo thành công nhưng đọc lại hierarchy ra 0 candidate)
 * - LUÔN đọc lại hierarchy + tự kiểm tra bounds bằng `isFullyInViewport()` sau mỗi lần thử, trước
 * khi kết luận "visible" thật.
 *
 * CHƯA verify thật trên thiết bị cú pháp `scrollUntilVisible: { element: { id }, direction }` cho
 * riêng combo "id + CONNECT" (mới viết 2026-09-23) - `findAssignment.js` mới verify combo "text +
 * UP". Nếu combo này không hoạt động như kỳ vọng trên thiết bị thật, `visible` trả về `false` (an
 * toàn - không throw ở đây, để caller tự quyết định BLOCKED_CONNECT_INTERACTION), KHÔNG lặng lẽ coi
 * như đã tap được.
 * @param {string} idExact - resource-id CHÍNH XÁC (không phải regex - Maestro tự so khớp đúng 1 id).
 * @returns {Promise<{ tree: Object, visible: boolean, scrollCount: number }>}
 */
export async function ensureIdVisibleBidirectional(bridge, initialTree, idExact, { timeout = 8000 } = {}) {
  const idPattern = new RegExp(`^${idExact}$`);
  const checkVisible = (tree) => {
    const bounds = findNodeBounds(tree, idPattern);
    return Boolean(bounds && isFullyInViewport(bounds, resolveContentViewport(tree)));
  };
  if (checkVisible(initialTree)) return { tree: initialTree, visible: true, scrollCount: 0 };

  let scrollCount = 0;
  let tree = initialTree;
  for (const direction of ["DOWN", "UP"]) {
    const swipeResult = await bridge.runSteps([{ scrollUntilVisible: { element: { id: idExact }, direction, timeout } }]);
    scrollCount++;
    tree = await bridge.hierarchy();
    if (swipeResult.success && checkVisible(tree)) return { tree, visible: true, scrollCount };
  }
  return { tree, visible: false, scrollCount };
}
