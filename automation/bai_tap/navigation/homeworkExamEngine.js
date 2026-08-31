/**
 * HomeworkExamEngine - điều hướng màn "Doing" (đang làm 1 lượt Exam thật của Bài tập) + màn
 * "Kết thúc" (Kết quả) - 2 màn CỐ TÌNH CHƯA có trong `homeworkPageObjects.js`/
 * `homeworkNavigationEngine.js` (xem comment đầu 2 file đó: ranh giới "Start Homework/Open Exam"
 * trước đây chưa implement). Tách riêng file này, KHÔNG sửa 2 file trên, để giữ nguyên ranh giới đã
 * document trong đó (`startHomework()` vẫn cố tình throw `PendingExamLaunchError` cho luồng cũ) -
 * engine này chỉ dùng cho testcase random-E2E mới, tự tap CTA để mở bài (đã xác nhận qua thao tác
 * thật, xem automation/README.md mục "Đã LÀM THẬT 1 Homework tới hết", điểm 1: mở bài KHÔNG cần
 * endpoint riêng, chỉ là điều hướng UI thuần).
 *
 * QUY TẮC UI "Bài tập KHÁC Vui học" (đã xác nhận lại rõ, KHÔNG suy đoán): Bài tập KHÔNG hiển thị
 * chỉ báo đúng/sai ngay sau từng câu (không có "Kiểm tra"/"Chính xác"/"Chưa chính xác" như Vui
 * học) - chỉ có 1 màn Kết thúc DUY NHẤT sau khi trả lời hết toàn bộ câu. Vì vậy `answerCurrentQuestion()`
 * KHÔNG BAO GIỜ đọc/chờ chỉ báo đúng/sai - chỉ chọn 1 đáp án rồi bấm CTA để qua câu kế tiếp.
 *
 * NGUỒN "đáp án đúng" (để random đúng/sai theo tỉ lệ mong muốn + verify điểm sau Submit): tái sử
 * dụng NGUYÊN VẸN pipeline Exam/CMS đã có (`discovery/examPageScraper.js` + `model/questionModel.js`
 * - đọc thẳng `window.__NUXT__.data` của trang Exam Editor thật qua Playwright, KHÔNG gọi API mới/
 * không suy đoán endpoint) qua `discovery/homeworkExamResolver.js` (resolve examId của 1 Homework
 * cụ thể bằng `attempts[].examId`, nguồn DUY NHẤT đáng tin cậy đã xác nhận - xem file đó). Khi
 * KHÔNG resolve được (Room chưa có ai làm -> examId UNRESOLVED, hoặc session Exam Scraper hết hạn),
 * engine vẫn trả lời HỢP LỆ (tap 1 đáp án thật) nhưng KHÔNG kiểm soát đúng/sai - gọi
 * `answerCurrentQuestion(null)` (không truyền QuestionModel).
 *
 * PHẠM VI Question Type ĐƯỢC HỖ TRỢ (KHÔNG suy đoán/không tự tạo selector cho dạng bài chưa từng
 * xác nhận trên chính màn Doing của Bài tập):
 *   1. "TEXT_CHOICE" - answers[] (từ QuestionModel) có chữ THẬT trùng khớp text đang hiển thị
 *      trên màn hình (>= 2 lựa chọn khớp được) -> tapOn theo TEXT giống Vui học (đã xác nhận ổn
 *      định) - áp dụng được cho MỌI Question Type có đáp án dạng chữ (ONE/TRUE_FALSE...), không
 *      cần biết trước type cụ thể.
 *   2. "IMAGE_CHOICE_GRID" - answers[] không có chữ nào hiển thị được (đáp án là ảnH) NHƯNG khớp
 *      fingerprint lưới 2x2 đã xác nhận qua README (điểm 4: ĐÚNG 4 phần tử `clickable="true"`,
 *      không chữ, xếp 2x2, không có phần tử clickable nào khác có chữ trên màn) VÀ
 *      `questionModel.answers.length === 4` (khớp số box) -> map theo ĐÚNG thứ tự answers[] (đã
 *      xác nhận qua README: answers[0..3] -> A/B/C/D theo thứ tự đọc lưới trên-trái/trên-phải/
 *      dưới-trái/dưới-phải).
 * Mọi trường hợp khác (không có QuestionModel VÀ không khớp lưới 2x2; hoặc có QuestionModel nhưng
 * không khớp CẢ 2 chiến lược trên - vd matching/audio, sentence builder, fill blank, số đáp án
 * không khớp...) trả về `{ supported: false }` - CHỦ ĐÍCH để Runtime dừng lại và báo FAIL trung
 * thực theo đúng tiêu chí đề bài ("Handler không hỗ trợ Question Type" là 1 lý do FAIL hợp lệ).
 */

const AI_POPUP_TRIGGER = "AI hỗ trợ học tập";
const AI_POPUP_ACTION = "Tiếp tục";
// Chưa xác nhận chữ CTA thật ở câu CUỐI (README không nói tới nút "Nộp bài" riêng - mô tả "làm hết
// N câu rồi mới có 1 màn Kết thúc", gợi ý CTA cuối có thể vẫn là 1 trong các chữ dưới, tự đổi tuỳ
// UI) - dò LẦN LƯỢT các chữ đã biết trong app (đã xác nhận dùng nơi khác), KHÔNG đoán chữ mới.
const NEXT_OR_SUBMIT_CTA_CANDIDATES = ["Tiếp theo", "Nộp bài", "Hoàn thành"];
// Nhãn nút xác nhận phổ biến của app - dùng best-effort cho popup xác nhận nộp bài NẾU xuất hiện,
// không throw nếu không thấy (chưa xác nhận popup này có tồn tại thật hay không).
const CONFIRM_SUBMIT_BUTTON_CANDIDATES = ["Nộp bài", "Đồng ý", "Xác nhận"];

const RESULT_SCORE_LABEL = "ĐIỂM SỐ";
const RESULT_CORRECT_LABEL = "CHÍNH XÁC";

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function collectTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectTexts(c, acc);
  return acc;
}

export function hasResourceId(node, idPattern) {
  if (idPattern.test(node?.attributes?.["resource-id"] || "")) return true;
  return (node?.children ?? []).some((c) => hasResourceId(c, idPattern));
}

function stripHtml(value) {
  if (typeof value !== "string") return value;
  return value.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

/** CONNECT: đọc "exercise_connect_left_{i}"/"exercise_connect_right_{i}" - nội dung nằm ở
 * "accessibilityText" (KHÔNG phải "text") khi qua `maestro hierarchy` CLI (MaestroBridge) - xem
 * cùng phát hiện đã xác nhận thật trong automation/runtime/handlers/matchingHandler.js#collectConnectSlots().
 * BUG THẬT KHÁC đã xác nhận (2026-08-20, MaestroMcpBridge, assignment G7U2-HW-Lis-BTNC): tool MCP
 * "inspect_screen" dùng abbreviation KHÁC cho field này - `ui_schema.abbreviations` trả về
 * `"a11y": "content-desc"` (đọc RAW payload thật), khiến `maestroMcpSession.js#hierarchy()` (adapt()
 * dùng ĐÚNG tên field do chính MCP đặt) trả về `attributes["content-desc"]`, KHÔNG PHẢI
 * `attributes.accessibilityText` như CLI - 2 transport đặt tên KHÁC NHAU cho CÙNG 1 khái niệm.
 * Đọc CẢ 2 tên field (không đổi maestroMcpBridge.js/maestroMcpSession.js - sửa ở đây, nơi DIỄN GIẢI
 * tree, đúng nguyên tắc "1 điểm diễn giải shape thô" đã dùng cho questionModel.js). */
export function collectConnectSlots(tree) {
  const slots = { left: [], right: [] };
  function walk(node) {
    const id = node?.attributes?.["resource-id"] || "";
    const match = id.match(/^exercise_connect_(left|right)_(\d+)$/);
    if (match) {
      const side = match[1];
      const index = Number(match[2]);
      const text = (node.attributes.accessibilityText || node.attributes["content-desc"] || node.attributes.text || "").trim();
      slots[side].push({ index, text });
    }
    for (const child of node?.children ?? []) walk(child);
  }
  walk(tree);
  return slots;
}

/** Tìm ĐÚNG 1 ô khớp text - throw nếu 0 hoặc ≥2 khớp (không đoán lấy phần tử đầu) - COPY từ
 * matchingHandler.js#resolveSlotIndex(). */
function resolveConnectSlotIndex(slots, side, text, questionId) {
  const matches = slots[side].filter((s) => s.text === text);
  if (matches.length === 0) {
    throw new Error(
      `BLOCKED_CONNECT_INTERACTION: không tìm thấy ô "${side}" nào có text "${text}" trên màn hình ` +
        `(đã đọc ${slots[side].length} ô ${side} qua accessibilityText). Question ${questionId}.`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `BLOCKED_CONNECT_INTERACTION: text "${text}" trùng lặp ở ${matches.length} ô "${side}" trên ` +
        `màn hình - không xác định được ô đúng, KHÔNG đoán lấy ô đầu tiên. Question ${questionId}.`,
    );
  }
  return matches[0].index;
}

/** Lấy danh sách cặp {leftText, rightText} ĐÚNG từ metadata.raw (answers[] + correct{}) - COPY
 * logic từ matchingHandler.js#execute() (phần resolve cặp, trước phần thao tác UI). */
export function resolveConnectCorrectPairs(questionModel) {
  const rawAnswers = questionModel?.metadata?.raw?.answers;
  const rawCorrect = questionModel?.metadata?.raw?.correct;
  if (!Array.isArray(rawAnswers) || !rawCorrect || typeof rawCorrect !== "object") return null;
  const answerById = new Map(rawAnswers.map((a) => [a.id, a]));
  const pairs = Object.entries(rawCorrect).map(([leftId, rightId]) => ({
    leftText: stripHtml(answerById.get(leftId)?.content),
    rightText: stripHtml(answerById.get(rightId)?.content),
  }));
  if (pairs.some((p) => !p.leftText || !p.rightText)) return null;
  return pairs;
}

/** FILL_WORD ("Listen and complete the notes...") - đã xác nhận thật qua hierarchy dump thiết bị
 * 2026-08-20 (assignment G7U2-HW-Lis-BTNC): mỗi ô trống là 1 node "exercise_fillword_blank_{i}"
 * (i=0..n-1, ĐÚNG thứ tự đọc trên màn khớp thứ tự "(1)(2)(3)..."), 1 nút "exercise_check_button"
 * DÙNG CHUNG (không phải "exercise_fillword_check_button" - id đó chỉ thấy ở EX-07 YAML, KHÁC màn
 * "Bài tập" thực tế đang dùng ở đây). metadata.raw.correct là mảng string dạng "[tu_dung]" (CMS bọc
 * ngoặc vuông quanh đáp án đúng) - bóc ngoặc, KHÔNG đoán field khác. */
export function collectBlankIndices(tree) {
  const indices = new Set();
  function walk(node) {
    const id = node?.attributes?.["resource-id"] || "";
    const match = id.match(/^exercise_fillword_blank_(\d+)$/);
    if (match) indices.add(Number(match[1]));
    for (const child of node?.children ?? []) walk(child);
  }
  walk(tree);
  return indices;
}

export function resolveFillWordValues(questionModel) {
  const raw = questionModel?.metadata?.raw?.correct;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const values = raw.map((v) => String(v).replace(/^\[/, "").replace(/\]$/, "").trim());
  if (values.some((v) => !v)) return null;
  return values;
}

/**
 * PERF audit 2026-08-20 (yeu cau "toi uu kha nang xu ly UI cho TAT CA dang cau hoi"): truoc day
 * moi nhanh (TEXT_CHOICE/CONNECT/FILL_WORD) chi doc DUNG 1 lan hierarchy() dang co (tu snapshot)
 * roi gia dinh toan bo noi dung can thiet (cau hoi/options/pairs/blanks) da nam san trong do - DUNG
 * voi da so cau (vua 1 man hinh), nhung SAI khi cau dai hon 1 man hinh HOAC (da xac nhan that qua
 * bug CONNECT 5 cap, assignment G7U2-HW-Lis-BTNC 2026-08-20) khi UI ao hoa danh sach (kieu
 * RecyclerView) - phan tu ngoai vung nhin THAT SU CHUA duoc mount trong cay hierarchy (khong phai
 * chi la "co trong cay nhung bounds nam ngoai man hinh" nhu ScrollView thuong). Ca 2 truong hop deu
 * can 1 co che CHUNG: doc hien tai -> kiem tra DA DU chua (theo dinh nghia rieng cua tung dang bai,
 * xem cac ham ensure*Visible ben duoi) -> neu chua, cuon 1 buoc vua phai + doc lai -> lap lai toi
 * khi du HOAC 2 lan cuon lien tiep khong tien trien them (CUNG nguyen tac dung-som da dung that o
 * discovery/findAssignment.js va discovery/homeworkUiList.js#collectVisibleHomeworkCards() - khong
 * cuon co dinh so lan, khong doan).
 *
 * "Visible" o day KHONG chi la "ton tai trong hierarchy" (yeu cau ro rang cua nguoi dung) - dung
 * bounds thuc te so voi khung nhin (xem `isFullyInViewport`/`findNodeBounds`) LAN vong lap doc-lai
 * (bat cac phan tu chua duoc mount o lan doc truoc, dung cho ca 2 kieu UI ScrollView/RecyclerView
 * ma khong can biet truoc dang nao).
 */
const CONTENT_SWIPE = { start: "50%,80%", end: "50%,30%", duration: 400 };
const MAX_CONTENT_SCROLLS = 10;

/** Bounds string "[x1,y1][x2,y2]" -> {x1,y1,x2,y2} - dung LAI dinh dang da xac nhan that trong
 * discovery/homeworkUiList.js#parseBounds() (khong bia dinh dang moi). */
function parseBoundsSimple(boundsStr) {
  const m = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(boundsStr || "");
  if (!m) return null;
  const [, x1, y1, x2, y2] = m.map(Number);
  return { x1, y1, x2, y2 };
}

/** Tim bounds cua node dau tien khop resource-id pattern (DFS) - dung "exercise_doing_screen" lam
 * khung nhin (viewport) THAM CHIEU DUY NHAT: container goc, LUON co mat o moi man Doing bat ke dang
 * cau hoi (da xac nhan qua hierarchy dump that FILL_WORD/CONNECT cung ngay) - khong tu doan kich
 * thuoc man hinh thiet bi. */
function findNodeBounds(tree, idPattern) {
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

/** true neu bounds NAM HOAN TOAN trong viewport (khong bi cat tren/duoi) - dinh nghia "visible +
 * day du" DUY NHAT dung trong file nay (yeu cau ro rang: khong dua vao "ton tai trong hierarchy" de
 * ket luan visible). Khong xac dinh duoc bounds/viewport -> fail-open (coi nhu du, khong chan flow -
 * an toan hon la treo vong lap cuon vo ich khi khong doc duoc toa do). */
function isFullyInViewport(bounds, viewport) {
  if (!bounds || !viewport) return true;
  return bounds.y1 >= viewport.y1 && bounds.y2 <= viewport.y2;
}

/**
 * Nguyen tac CHUNG cho ca 3 dang bai (FILL_WORD/CONNECT/TEXT_CHOICE-IMAGE_CHOICE_GRID): doc hien
 * tai -> kiem tra du chua (`isDone`) -> neu chua, cuon 1 buoc + doc lai + gop vao accumulator
 * (`collect`, PHAI idempotent/merge duoc qua nhieu lan goi) -> lap lai toi da `MAX_CONTENT_SCROLLS`
 * lan HOAC toi khi 2 lan cuon lien tiep khong tien trien them (`sizeOf` khong tang - CUNG tieu chi
 * dung-som da dung o findAssignment.js/collectVisibleHomeworkCards()). KHONG cuon gi ca neu `tree`
 * ban dau da du (0 chi phi them - giu nguyen hieu nang cho cau vua 1 man hinh, da so cau thuc te).
 * @returns {Promise<{ tree: Object, acc: any, scrollCount: number }>}
 */
async function collectByScrollingIfNeeded(bridge, initialTree, { collect, isDone, sizeOf, initialAcc }) {
  let tree = initialTree;
  let acc = collect(tree, initialAcc);
  if (isDone(acc)) return { tree, acc, scrollCount: 0 };

  let lastSize = sizeOf(acc);
  let noProgressStreak = 0;
  let scrollCount = 0;
  while (scrollCount < MAX_CONTENT_SCROLLS && noProgressStreak < 2) {
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

/** FILL_WORD: cuon (neu can) toi khi doc du SO O TRONG mong doi (theo CMS) - merge index qua cac
 * lan doc (Set, idempotent). */
async function ensureAllBlanksVisible(bridge, initialTree, expectedCount) {
  return collectByScrollingIfNeeded(bridge, initialTree, {
    collect: (tree, acc) => {
      const next = new Set(acc);
      for (const idx of collectBlankIndices(tree)) next.add(idx);
      return next;
    },
    isDone: (acc) => acc.size >= expectedCount,
    sizeOf: (acc) => acc.size,
    initialAcc: new Set(),
  });
}

/** CONNECT: cuon (neu can) toi khi doc du TEXT cua toan bo pair DUNG (theo CMS, ca 2 phia) - merge
 * theo INDEX qua cac lan doc (Map index->text, idempotent - id resource-id la vi tri co dinh, an
 * toan de merge du UI ao hoa khong giu nguyen phan tu da cuon qua). Tra ve CUNG hinh dang
 * {left:[{index,text}], right:[...]} nhu `collectConnectSlots()` de tuong thich voi
 * `resolveConnectSlotIndex()` hien co (khong doi ham do). */
async function ensureAllConnectPairsVisible(bridge, initialTree, correctPairs) {
  const requiredLeft = new Set(correctPairs.map((p) => p.leftText));
  const requiredRight = new Set(correctPairs.map((p) => p.rightText));
  const { tree, acc, scrollCount } = await collectByScrollingIfNeeded(bridge, initialTree, {
    collect: (t, acc) => {
      const slots = collectConnectSlots(t);
      const next = { left: new Map(acc.left), right: new Map(acc.right) };
      for (const s of slots.left) if (s.text) next.left.set(s.index, s.text);
      for (const s of slots.right) if (s.text) next.right.set(s.index, s.text);
      return next;
    },
    isDone: (acc) => {
      const leftTexts = new Set(acc.left.values());
      const rightTexts = new Set(acc.right.values());
      return [...requiredLeft].every((t) => leftTexts.has(t)) && [...requiredRight].every((t) => rightTexts.has(t));
    },
    sizeOf: (acc) => acc.left.size + acc.right.size,
    initialAcc: { left: new Map(), right: new Map() },
  });
  const slots = {
    left: [...acc.left].map(([index, text]) => ({ index, text })),
    right: [...acc.right].map(([index, text]) => ({ index, text })),
  };
  return { tree, slots, scrollCount };
}

/** TEXT_CHOICE/IMAGE_CHOICE_GRID: cuon (neu can) toi khi TOAN BO answers[] (tu CMS) da hien thi DAY
 * DU trong khung nhin (bounds nam hoan toan trong "exercise_doing_screen" - khong chi "ton tai
 * trong cay"). IMAGE_CHOICE_GRID khong co text dap an (answers[] rong/toan chuoi rong sau
 * stripHtml) -> `wanted` rong -> tra ve ngay, KHONG cuon gi (giu nguyen hanh vi cu cho dang nay). */
async function ensureAllAnswersVisible(bridge, initialTree, questionModel) {
  const wanted = (questionModel?.answers ?? []).filter((a) => a && a.trim());
  if (wanted.length === 0) return { tree: initialTree, scrollCount: 0 };
  const viewport = findNodeBounds(initialTree, /^exercise_doing_screen$/);

  const collectVisibleAnswers = (tree, acc) => {
    const next = new Set(acc);
    function walk(node) {
      const t = node?.attributes?.text;
      if (typeof t === "string") {
        const trimmed = t.trim();
        if (trimmed && wanted.includes(trimmed) && isFullyInViewport(parseBoundsSimple(node.attributes.bounds), viewport)) {
          next.add(trimmed);
        }
      }
      for (const c of node?.children ?? []) walk(c);
    }
    walk(tree);
    return next;
  };

  const { tree, scrollCount } = await collectByScrollingIfNeeded(bridge, initialTree, {
    collect: collectVisibleAnswers,
    isDone: (acc) => wanted.every((w) => acc.has(w)),
    sizeOf: (acc) => acc.size,
    initialAcc: new Set(),
  });
  return { tree, scrollCount };
}

/** BUG ĐÃ AUDIT + FIX (2026-08-17, xem memory/root-cause report cùng ngày, đo thật trên thiết bị
 * 3201d866d40a1681: 1 lượt `maestro hierarchy` tốn ~53-59s - KHÔNG rẻ như comment cũ của
 * `MaestroBridge.isVisible()` giả định, CÙNG bậc chi phí với 1 lượt `maestro test`): trước đây
 * `answerCurrentQuestionOneShot()` truyền `isVisible = (t) => this.bridge.isVisible(t)` cho
 * `decideAnswerAction()` - hàm đó gọi `isVisible` cho TỪNG answer (`Array.filter` không
 * short-circuit, tối đa 4 lượt/câu) + `isResultScreen()` gọi thêm 2 lượt nữa - mỗi lượt
 * `bridge.isVisible()` tự spawn 1 tiến trình `maestro hierarchy` MỚI, bỏ qua hẳn `tree` đã có sẵn
 * trong cùng lượt gọi. Đo được TỔNG 8 lượt hierarchy + 1 lượt `maestro test` (runSteps) cho MỖI
 * câu không phải câu cuối - ~9-10 phút/câu, khớp đúng hiện tượng "run quá lâu" đã báo (2 câu hết
 * ~35 phút kể cả phase giao bài).
 *
 * SỬA: tra cứu trực tiếp trên mảng text ĐÃ CÓ SẴN trong bộ nhớ (từ CHÍNH `tree` đã fetch ở đầu
 * hàm) - hàm này CHỈ đọc dữ liệu đã có, không gọi ADB/Maestro. KHÔNG đổi `decideAnswerAction()`
 * (thuật toán quyết định đáp án, đã verify, ngoài phạm vi sửa) - CHỈ đổi cách `isVisible` được
 * cung cấp cho nó. CÙNG kỹ thuật đã verify trước đó trong flows/giao_bai_tap/
 * e2e-teacher-assign-partial-resume-scored.mjs#isVisibleInTree() (bản đó tự có bản sao riêng cho
 * lượt TÌM câu - bản NÀY vá cho lượt TRẢ LỜI câu, nơi bug thật sự còn tồn tại). */
function isVisibleInTree(texts, textPattern) {
  const pattern = new RegExp(`^${textPattern}$`);
  return texts.some((t) => pattern.test(t));
}

function flattenNodes(node, acc) {
  acc.push(node);
  for (const child of node?.children ?? []) flattenNodes(child, acc);
  return acc;
}

function nodeHasNonEmptyTextDeep(node) {
  const text = node?.attributes?.text;
  if (typeof text === "string" && text.trim()) return true;
  return (node?.children ?? []).some(nodeHasNonEmptyTextDeep);
}

function parseBounds(boundsStr) {
  const m = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(boundsStr || "");
  if (!m) return null;
  const [, x1, y1, x2, y2] = m.map(Number);
  return { x1, y1, x2, y2, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
}

/**
 * Nhận diện lưới 2x2 - xem fingerprint mô tả đầu file. Trả về null nếu không khớp (KHÔNG throw -
 * để caller tự thử fingerprint khác/kết luận unsupported).
 * @param {Object} tree - `bridge.hierarchy()`
 * @returns {Array<{x1:number,y1:number,x2:number,y2:number,cx:number,cy:number}> | null}
 */
export function detectImageChoiceGrid(tree) {
  const all = flattenNodes(tree, []);
  const clickableWithText = all.filter(
    (n) => n?.attributes?.clickable === "true" && nodeHasNonEmptyTextDeep(n),
  );
  if (clickableWithText.length > 0) return null; // có nút/label chữ khác -> không phải dạng này

  const blankLeafClickables = all.filter(
    (n) => n?.attributes?.clickable === "true" && !nodeHasNonEmptyTextDeep(n),
  );
  const boxes = blankLeafClickables.map((n) => parseBounds(n.attributes.bounds)).filter(Boolean);
  if (boxes.length !== 4) return null;

  const xs = [...new Set(boxes.map((b) => Math.round(b.cx / 20)))];
  const ys = [...new Set(boxes.map((b) => Math.round(b.cy / 20)))];
  const clusterCount = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    let groups = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] > 5) groups++;
    }
    return groups;
  };
  if (clusterCount(xs) !== 2 || clusterCount(ys) !== 2) return null;

  return boxes;
}

/**
 * Quyết định chiến lược trả lời cho câu hiện tại - KHÔNG tap gì cả, chỉ nhận diện + chọn mục tiêu
 * (tách riêng khỏi việc tap để dễ test logic mà không cần thiết bị).
 * @param {Object} tree - `bridge.hierarchy()`
 * @param {(text: string) => boolean} isVisible - `bridge.isVisible` (nhận vào để dễ test)
 * @param {import("../../model/questionModel.js").QuestionModel | null} questionModel
 * @param {boolean} wantCorrect
 * @returns {{ type: "TEXT_CHOICE", text: string, isTargetCorrect: boolean|null }
 *         | { type: "IMAGE_CHOICE_GRID", point: string, isTargetCorrect: boolean|null }
 *         | null}
 */
export function decideAnswerAction(tree, isVisible, questionModel, wantCorrect) {
  if (questionModel?.answers?.length >= 2) {
    const visibleAnswers = questionModel.answers.filter((a) => a && isVisible(escapeRegExp(a)));
    if (visibleAnswers.length >= 2) {
      const correct = questionModel.correctAnswer;
      const correctIsVisible = correct && visibleAnswers.includes(correct);
      const target =
        wantCorrect && correctIsVisible ? correct : visibleAnswers.find((a) => a !== correct) ?? visibleAnswers[0];
      return { type: "TEXT_CHOICE", text: target, isTargetCorrect: correct ? target === correct : null };
    }
  }

  const grid = detectImageChoiceGrid(tree);
  if (!grid) return null;

  if (questionModel?.answers?.length === grid.length) {
    const correctIdx = questionModel.correctAnswer ? questionModel.answers.indexOf(questionModel.correctAnswer) : -1;
    let idx;
    if (wantCorrect && correctIdx >= 0) idx = correctIdx;
    else if (correctIdx >= 0) idx = [...grid.keys()].find((i) => i !== correctIdx) ?? 0;
    else idx = Math.floor(Math.random() * grid.length);
    const box = grid[idx];
    return {
      type: "IMAGE_CHOICE_GRID",
      point: `${Math.round(box.cx)},${Math.round(box.cy)}`,
      isTargetCorrect: correctIdx >= 0 ? idx === correctIdx : null,
    };
  }

  if (!questionModel) {
    // Không có QuestionModel (examId chưa resolve được) - vẫn trả lời HỢP LỆ (1 box thật có tồn
    // tại trên UI), KHÔNG kiểm soát đúng/sai vì không có dữ liệu để biết đáp án nào đúng.
    const box = grid[Math.floor(Math.random() * grid.length)];
    return { type: "IMAGE_CHOICE_GRID", point: `${Math.round(box.cx)},${Math.round(box.cy)}`, isTargetCorrect: null };
  }

  return null; // có QuestionModel nhưng số đáp án không khớp lưới - không suy đoán tiếp, unsupported.
}

export class HomeworkExamEngine {
  /** @param {import("../../bridge/maestroBridge.js").MaestroBridge} bridge */
  constructor(bridge) {
    this.bridge = bridge;
  }

  /** Dismiss popup "AI hỗ trợ học tập" nếu xuất hiện ngay sau khi mở bài - best-effort. */
  async dismissAiPopupIfPresent() {
    await this.bridge.runSteps([
      {
        runFlow: {
          when: { visible: AI_POPUP_TRIGGER },
          commands: [{ tapOn: AI_POPUP_ACTION }],
        },
      },
    ]);
  }

  /**
   * Xác nhận đã vào ĐÚNG bài (identity) - tiêu đề Homework hiện lại trên màn Doing, và 2 dấu hiệu
   * phủ định xác nhận đã rời màn List (không còn thấy bottom tab bar - cùng cơ chế đã dùng trong
   * `runRandomOpenHomeworkFlow.js`).
   * @param {string} title
   */
  async verifyIdentity(title) {
    const result = await this.bridge.runSteps([
      { extendedWaitUntil: { visible: { text: title }, timeout: 10000 } },
      { assertNotVisible: { text: "Trò chuyện" } },
      { assertNotVisible: { text: "Bài tập về nhà" } },
    ]);
    if (!result.success) {
      throw new Error(`Identity mismatch - không xác nhận được đúng màn Doing của "${title}": ${result.error}`);
    }
  }

  /** @param {Object} [tree] - nếu đã có sẵn `bridge.hierarchy()` từ lượt gọi trước đó (SAME state,
   * chưa thao tác gì thêm), truyền vào để tránh spawn thêm 1 lượt `maestro hierarchy` mới (xem
   * bug/fix 2026-08-17 ở đầu file) - không truyền thì giữ nguyên hành vi cũ (tự đọc state live qua
   * `bridge.isVisible()`), dùng cho caller ngoài (vd flow .mjs gọi `exam.isResultScreen()` sau khi
   * đã hoàn thành TOÀN BỘ câu, không có tree nào đang cầm sẵn). */
  isResultScreen(tree) {
    if (tree) {
      const texts = collectTexts(tree);
      return texts.some((t) => t.startsWith(RESULT_SCORE_LABEL)) || texts.some((t) => t.startsWith(RESULT_CORRECT_LABEL));
    }
    return this.bridge.isVisible(`${RESULT_SCORE_LABEL}.*`) || this.bridge.isVisible(`${RESULT_CORRECT_LABEL}.*`);
  }

  /**
   * Chọn 1 đáp án cho câu hiện tại rồi bấm CTA để qua câu tiếp theo (hoặc nộp bài nếu là câu
   * cuối), rồi xác nhận màn hình ĐÃ ĐỔI - KHÔNG đọc/chờ bất kỳ chỉ báo đúng/sai nào (xem quy tắc
   * UI ở đầu file).
   * @param {import("../../model/questionModel.js").QuestionModel | null} questionModel - truyền
   *   `null` nếu chưa resolve được Exam (đáp án đúng UNRESOLVED) - engine sẽ trả lời hợp lệ nhưng
   *   không kiểm soát đúng/sai.
   * @param {{ wantCorrect?: boolean }} [options] - `wantCorrect` chỉ có ý nghĩa khi có
   *   `questionModel` với `correctAnswer` đã biết.
   * @returns {Promise<
   *     { supported: true, type: "TEXT_CHOICE"|"IMAGE_CHOICE_GRID", isTargetCorrect: boolean|null }
   *   | { supported: false, reason: string, texts: string[] }>}
   */
  async answerCurrentQuestion(questionModel = null, { wantCorrect = true } = {}) {
    const tree = this.bridge.hierarchy();
    const textsBefore = collectTexts(tree);
    const isVisible = (t) => this.bridge.isVisible(t);

    // CONNECT (dạng Nối/Match) - PHẢI kiểm tra TRƯỚC decideAnswerAction(): dispatcher đó chỉ biết
    // TEXT_CHOICE/IMAGE_CHOICE_GRID, và các ô nối (accessibilityText: "avoid", "tránh xa"...) từng
    // bị nhận NHẦM thành 1 đáp án TEXT_CHOICE hợp lệ (khớp ngẫu nhiên với answers[] của câu) -> tap
    // 1 ô rồi treo mãi vì "Kiểm tra" không bao giờ bật (cần nối KÍN hết cặp). Xem
    // automation/runtime/handlers/matchingHandler.js - CÙNG thuật toán, chỉ đổi cách gọi bridge
    // (tapOn theo id qua runSteps() thay vì bridge.tap()/checkAnswer() text cố định, để khớp quy
    // ước CTA riêng của "Bài tập" - xem NEXT_OR_SUBMIT_CTA_CANDIDATES bên dưới, không phải "Kiểm
    // tra"/"Tiếp theo" cố định của Vui học).
    if (hasResourceId(tree, /^exercise_connect_left_0$/)) {
      const correctPairs = resolveConnectCorrectPairs(questionModel);
      if (!correctPairs) {
        return {
          supported: false,
          reason: "CONNECT: không resolve được cặp đúng từ metadata.raw.answers/correct.",
          texts: textsBefore,
        };
      }
      const slots = collectConnectSlots(tree);
      // wantCorrect=false + >=2 cặp: xoay vòng rightText 1 vị trí -> đảm bảo KHÔNG cặp nào đúng
      // (derangement bằng rotate, không có điểm cố định khi n>=2). n===1 không thể tạo sai (chỉ 1
      // lựa chọn khả dĩ) - nối đúng, trả isTargetCorrect=true bất kể wantCorrect yêu cầu gì.
      const n = correctPairs.length;
      const isTargetCorrect = wantCorrect || n < 2;
      const pairsToTap = isTargetCorrect
        ? correctPairs
        : correctPairs.map((p, i) => ({ leftText: p.leftText, rightText: correctPairs[(i + 1) % n].rightText }));

      const tapSteps = [];
      for (const pair of pairsToTap) {
        const leftIndex = resolveConnectSlotIndex(slots, "left", pair.leftText, questionModel?.id);
        const rightIndex = resolveConnectSlotIndex(slots, "right", pair.rightText, questionModel?.id);
        tapSteps.push({ tapOn: { id: `exercise_connect_left_${leftIndex}` } });
        tapSteps.push({ tapOn: { id: `exercise_connect_right_${rightIndex}` } });
      }
      // Gộp TOÀN BỘ cặp vào 1 lượt runSteps() (1 `maestro test` duy nhất) - tránh 2*n lượt riêng
      // (mỗi lượt ~8-15s khởi động) khiến câu CONNECT chậm hơn hẳn câu khác (đã quan sát thật:
      // treo/chậm bất thường trên câu "Match" so với hôm trước).
      tapSteps.push({ waitForAnimationToEnd: { timeout: 1500 } });
      tapSteps.push({ takeScreenshot: "before_submit" });
      const connectTapResult = await this.bridge.runSteps(tapSteps);
      if (!connectTapResult.success) {
        throw new Error(`CONNECT: tap cặp thất bại: ${connectTapResult.error}`);
      }

      const afterTapTree = this.bridge.hierarchy();
      if (!hasResourceId(afterTapTree, /^exercise_check_button$/)) {
        throw new Error(
          `CONNECT: đã tap đủ ${n} cặp nhưng "exercise_check_button" chưa xuất hiện - chưa nối kín hết ô.`,
        );
      }

      let connectAdvanced = false;
      for (const cta of NEXT_OR_SUBMIT_CTA_CANDIDATES.concat(["Kiểm tra", "Tiếp tục"])) {
        if (this.bridge.isVisible(cta)) {
          const nextResult = await this.bridge.tap(cta);
          if (!nextResult.success) throw new Error(`CONNECT: không chuyển được câu (tapOn "${cta}"): ${nextResult.error}`);
          connectAdvanced = true;
          break;
        }
      }
      if (!connectAdvanced) {
        const idTapResult = await this.bridge.tap({ id: "exercise_check_button" });
        if (!idTapResult.success) throw new Error(`CONNECT: không bấm được exercise_check_button: ${idTapResult.error}`);
      }
      await this.bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1500 } }]);
      // "Kiểm tra" -> CTA đổi nhãn (Tiếp tục/Thử lại/Hoàn thành) - bấm CÙNG id lần 2 cho đủ chu kỳ
      // (giống ktra_fullluong_lambai.yaml: "cùng 1 nút, bấm 2 lần cho đủ chu kỳ"), best-effort.
      if (!this.isResultScreen()) {
        await this.bridge.tap({ id: "exercise_check_button" }).catch(() => {});
        await this.bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1000 } }]);
      }

      return { supported: true, type: "CONNECT", isTargetCorrect };
    }

    const action = decideAnswerAction(tree, isVisible, questionModel, wantCorrect);
    if (!action) {
      return {
        supported: false,
        reason: "Không khớp chiến lược trả lời nào có Handler hỗ trợ (TEXT_CHOICE / IMAGE_CHOICE_GRID 2x2)",
        texts: textsBefore,
      };
    }

    const tapStep = action.type === "TEXT_CHOICE" ? { tapOn: action.text } : { tapOn: { point: action.point } };
    // Gộp tap + chờ hoạt ảnh + screenshot "trước Submit" vào ĐÚNG 1 lượt `maestro test` (yêu cầu
    // hiệu năng của đề bài) - screenshot bị ĐÈ mỗi câu (cùng tên cố định), nên khi loop dừng lại
    // (chạm màn Kết thúc), file còn lại đúng là trạng thái ngay TRƯỚC lần bấm nộp bài/qua câu CUỐI
    // CÙNG - không cần biết trước câu nào là câu cuối.
    const tapResult = await this.bridge.runSteps([
      tapStep,
      { waitForAnimationToEnd: { timeout: 1500 } },
      { takeScreenshot: "before_submit" },
    ]);
    if (!tapResult.success) {
      throw new Error(`UI không nhận câu trả lời (${JSON.stringify(tapStep)} thất bại): ${tapResult.error}`);
    }

    let advanced = false;
    for (const cta of NEXT_OR_SUBMIT_CTA_CANDIDATES) {
      if (this.bridge.isVisible(cta)) {
        const nextResult = await this.bridge.tap(cta);
        if (!nextResult.success) {
          throw new Error(`Không chuyển được câu (tapOn "${cta}" thất bại): ${nextResult.error}`);
        }
        advanced = true;
        break;
      }
    }
    if (!advanced) {
      throw new Error(
        `Không tìm thấy nút chuyển câu/nộp bài sau khi chọn đáp án (đã thử: ${NEXT_OR_SUBMIT_CTA_CANDIDATES.join(", ")}).`,
      );
    }

    await this.bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1500 } }]);
    // Popup xác nhận nộp bài - best-effort, KHÔNG throw nếu không thấy (chưa xác nhận có tồn tại).
    for (const label of CONFIRM_SUBMIT_BUTTON_CANDIDATES) {
      if (this.bridge.isVisible(label)) {
        await this.bridge.tap(label);
        await this.bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1000 } }]);
        break;
      }
    }

    // Xác nhận ĐÃ chuyển sang câu tiếp theo (hoặc màn Kết thúc) - so khớp toàn bộ text hiển thị
    // TRƯỚC/SAU khi bấm CTA, KHÔNG đọc bất kỳ chỉ báo đúng/sai nào. Nếu màn hình không đổi, coi là
    // "Không chuyển được câu" (FAIL thật, không phải lỗi ẩn).
    if (!this.isResultScreen()) {
      const textsAfter = collectTexts(this.bridge.hierarchy());
      if (JSON.stringify(textsAfter) === JSON.stringify(textsBefore)) {
        throw new Error("Không chuyển được câu tiếp theo - màn hình không đổi sau khi bấm CTA.");
      }
    }

    return { supported: true, type: action.type, isTargetCorrect: action.isTargetCorrect };
  }

  /**
   * Biến thể GỘP của answerCurrentQuestion() - CÙNG thuật toán quyết định đáp án
   * (decideAnswerAction, KHÔNG đổi) và CÙNG contract trả về, chỉ khác cách gọi MaestroBridge: dồn
   * toàn bộ native step của 1 câu (tap đáp án, chờ hoạt ảnh, chụp "before_submit", tap CTA, chờ,
   * tap confirm-nếu-có, chờ) vào ĐÚNG 1 mảng `runSteps()` = ĐÚNG 1 lượt `maestro test`/câu, thay
   * vì 3 lượt riêng của bản gốc (tap đáp án -> tap CTA -> tap confirm, MỖI lượt tự spawn 1 tiến
   * trình `maestro test` riêng).
   *
   * LÝ DO (đo thật, xem flows/bai_tap/testcases/homework-review-explanation.yaml mục "TRẠNG THÁI"
   * 2026-08-07): mỗi lượt `maestro test` tốn ~30-50s CHỈ để khởi động session (thiết bị
   * 3201d866d40a1681, trung bình 32.9s/lượt trên 8 lượt đo được) - hoàn toàn KHÔNG liên quan tới
   * số bước bên trong 1 lượt. Gộp 3 lượt/câu thành 1 lượt/câu giữ ĐÚNG hành vi, chỉ đổi kiến trúc
   * gọi Bridge.
   *
   * CÁCH CHỌN CTA/nút xác nhận: dùng `tapOn: { optional: true }` cho TỪNG candidate theo ĐÚNG thứ
   * tự của NEXT_OR_SUBMIT_CTA_CANDIDATES/CONFIRM_SUBMIT_BUTTON_CANDIDATES (KHÔNG đổi danh sách) -
   * Maestro tự bỏ qua candidate không thấy, tap đúng candidate đang hiển thị. KHÁC 1 điểm nhỏ so
   * với bản gốc (đã cân nhắc, chấp nhận được): bản gốc dừng NGAY ở candidate đầu tiên thấy được
   * (`break`); bản này vẫn tiếp tục thử các candidate còn lại dưới dạng `optional` (không gây hại
   * trong THỰC TẾ vì tại 1 thời điểm CHỈ 1 candidate hiển thị - các candidate còn lại tự no-op vì
   * không tìm thấy phần tử).
   *
   * @param {import("../../model/questionModel.js").QuestionModel | null} questionModel
   * @param {{ wantCorrect?: boolean, resultLabel?: string|null, snapshot?: {tree: Object, texts: string[]}|null }} [options] -
   *   `resultLabel`: nếu đây là câu CUỐI (biết trước qua tổng số câu đã resolve), truyền tên
   *   screenshot màn Kết thúc để GỘP LUÔN vào lượt `runSteps()` này - tránh phải tốn thêm 1 lượt
   *   `maestro test` riêng chỉ để chụp màn Kết thúc ở phase RESULT. `snapshot` (MỚI, 2026-08-17,
   *   audit performance lần 2): nếu caller ĐÃ CÓ SẴN `{tree, texts}` từ 1 lượt `bridge.hierarchy()`
   *   TRƯỚC ĐÓ mà CHỨNG MINH ĐƯỢC state chưa đổi (KHÔNG có tap/thao tác thiết bị nào xảy ra giữa
   *   lúc fetch snapshot đó và lúc gọi hàm này - vd `findMatchingQuestion()` gọi ngay trước, cùng
   *   luồng đồng bộ, không await xen giữa), truyền vào để hàm này BỎ QUA việc tự fetch 1 lượt
   *   `maestro hierarchy` MỚI (tiết kiệm 1 lượt/câu). KHÔNG truyền (mặc định null) thì giữ NGUYÊN
   *   hành vi cũ (tự fetch state live) - AN TOÀN TUYỆT ĐỐI, dùng khi không chắc chắn state chưa đổi.
   * @returns {Promise<
   *     { supported: true, type: "TEXT_CHOICE"|"IMAGE_CHOICE_GRID", isTargetCorrect: boolean|null, finalTree: Object }
   *   | { supported: false, reason: string, texts: string[] }>} `finalTree` - tree đọc NGAY SAU khi
   *   tap (dùng để confirm chuyển câu/màn Kết thúc) - trả kèm để caller (vd bước RESULT cuối exam)
   *   tái sử dụng cho `isResultScreen(tree)`/`readResult(tree)`, tránh fetch lại hierarchy cho ĐÚNG
   *   cùng 1 trạng thái màn hình vừa đọc xong ở đây.
   */
  async answerCurrentQuestionOneShot(questionModel = null, { wantCorrect = true, resultLabel = null, snapshot = null } = {}) {
    let tree = snapshot?.tree ?? this.bridge.hierarchy();
    let textsBefore = snapshot?.texts ?? collectTexts(tree);
    // isVisible tra cứu trong `textsBefore` (bien co the duoc CAP NHAT boi buoc ensure*Visible ben
    // duoi neu phai cuon doc them noi dung - closure doc gia tri MOI NHAT tai thoi diem goi, khong
    // phai gia tri luc khoi tao). KHONG spawn `maestro hierarchy` mới cho mỗi answer khi khong can
    // cuon - xem bug/fix 2026-08-17 ở đầu file, hàm isVisibleInTree()).
    const isVisible = (t) => isVisibleInTree(textsBefore, t);

    // FILL_WORD (dien tu) - CUNG nguyen tac GOP nhu CONNECT (1 runSteps() DUY NHAT cho toan bo
    // o trong + check_button, 1 hierarchy() DUY NHAT sau cung).
    if (hasResourceId(tree, /^exercise_fillword_blank_0$/)) {
      const correctValues = resolveFillWordValues(questionModel);
      if (!correctValues) {
        return {
          supported: false,
          reason: "FILL_WORD: không resolve được đáp án đúng từ metadata.raw.correct.",
          texts: textsBefore,
        };
      }
      // Cuon (CHI khi can - xem ensureAllBlanksVisible) toi khi doc du so o trong mong doi truoc
      // khi ket luan "khong khop" - cau dai hon 1 man hinh truoc day se bi bao sai "khong khop so
      // dap an" dù thuc ra chi la chua cuon toi cac o con lai.
      const blanksResult = await ensureAllBlanksVisible(this.bridge, tree, correctValues.length);
      if (blanksResult.scrollCount > 0) {
        tree = blanksResult.tree;
        textsBefore = collectTexts(tree);
      }
      const blankIndices = [...blanksResult.acc].sort((a, b) => a - b);
      if (blankIndices.length !== correctValues.length) {
        return {
          supported: false,
          reason: `FILL_WORD: so o trong tren man (${blankIndices.length}) khong khop so dap an CMS (${correctValues.length}).`,
          texts: textsBefore,
        };
      }
      const isTargetCorrect = wantCorrect;
      const valuesToType = isTargetCorrect ? correctValues : correctValues.map(() => "zzzsaizzz");

      const steps = [];
      blankIndices.forEach((idx, i) => {
        steps.push({ tapOn: { id: `exercise_fillword_blank_${idx}` } });
        steps.push({ inputText: valuesToType[i] });
      });
      // Bare string, KHONG phai { hideKeyboard: null } - da xac nhan cu phap that qua
      // flows/app/exercise/EX-07-fillword-wrong.yaml dong 40 ("- hideKeyboard", khong co ":").
      steps.push("hideKeyboard");
      steps.push({ waitForAnimationToEnd: { timeout: 1500 } });
      steps.push({ takeScreenshot: "before_submit" });
      steps.push({ tapOn: { id: "exercise_check_button", optional: true } });
      steps.push({ waitForAnimationToEnd: { timeout: 1500 } });
      steps.push({ tapOn: { id: "exercise_check_button", optional: true } });
      steps.push(...NEXT_OR_SUBMIT_CTA_CANDIDATES.map((cta) => ({ tapOn: { text: cta, optional: true } })));
      steps.push({ waitForAnimationToEnd: { timeout: 1000 } });
      if (resultLabel) steps.push({ takeScreenshot: resultLabel });

      const stepsResult = await this.bridge.runSteps(steps);
      if (!stepsResult.success) {
        throw new Error(`FILL_WORD: chuỗi thao tác thất bại: ${stepsResult.error}`);
      }

      const treeAfter = await this.bridge.hierarchy();
      const textsAfter = collectTexts(treeAfter);
      if (!this.isResultScreen(treeAfter)) {
        if (JSON.stringify(textsAfter) === JSON.stringify(textsBefore)) {
          throw new Error("FILL_WORD: không chuyển được câu tiếp theo - màn hình không đổi sau khi bấm CTA.");
        }
      }

      return { supported: true, type: "FILL_WORD", isTargetCorrect, finalTree: treeAfter, scrollCount: blanksResult.scrollCount };
    }

    // CONNECT (Nối/Match) - biến thể GỘP, CÙNG nguyên tắc voi phan TEXT_CHOICE/IMAGE_CHOICE_GRID
    // ben duoi (snapshot tai su dung, 1 runSteps() DUY NHAT cho toan bo tap, 1 hierarchy() DUY
    // NHAT sau cung) - thay cho ban answerCurrentQuestion() (nhieu isVisible()/hierarchy() rieng
    // le, do that ~4-6 phut/cau CONNECT, xem PERF audit 2026-08-20).
    if (hasResourceId(tree, /^exercise_connect_left_0$/)) {
      const correctPairs = resolveConnectCorrectPairs(questionModel);
      if (!correctPairs) {
        return {
          supported: false,
          reason: "CONNECT: không resolve được cặp đúng từ metadata.raw.answers/correct.",
          texts: textsBefore,
        };
      }
      // Cuon (CHI khi can - xem ensureAllConnectPairsVisible) toi khi doc du TEXT ca 2 phia cua
      // TOAN BO pair dung - da xac nhan that (2026-08-20, G7U2-HW-Lis-BTNC 5 cap): 1 lan hierarchy()
      // khong cuon co the chi thay 4/5 cap (UI ao hoa kieu RecyclerView, phan tu ngoai vung nhin
      // CHUA duoc mount, khac ScrollView thuong giu nguyen toan bo con).
      const connectVisibleResult = await ensureAllConnectPairsVisible(this.bridge, tree, correctPairs);
      const slots = connectVisibleResult.slots;
      if (connectVisibleResult.scrollCount > 0) {
        tree = connectVisibleResult.tree;
        textsBefore = collectTexts(tree);
      }
      const n = correctPairs.length;
      const isTargetCorrect = wantCorrect || n < 2;
      const pairsToTap = isTargetCorrect
        ? correctPairs
        : correctPairs.map((p, i) => ({ leftText: p.leftText, rightText: correctPairs[(i + 1) % n].rightText }));

      const steps = [];
      for (const pair of pairsToTap) {
        const leftIndex = resolveConnectSlotIndex(slots, "left", pair.leftText, questionModel?.id);
        const rightIndex = resolveConnectSlotIndex(slots, "right", pair.rightText, questionModel?.id);
        steps.push({ tapOn: { id: `exercise_connect_left_${leftIndex}` } });
        steps.push({ tapOn: { id: `exercise_connect_right_${rightIndex}` } });
      }
      steps.push({ waitForAnimationToEnd: { timeout: 1500 } });
      steps.push({ takeScreenshot: "before_submit" });
      // "exercise_check_button" ("Kiểm tra" -> đổi nhãn Tiếp tục/Thử lại/Hoàn thành, cùng 1 nút) -
      // bấm theo ID 2 lần cho đủ chu kỳ (như ktra_fullluong_lambai.yaml) + toàn bộ candidate CTA
      // khác dạng optional - GỘP CHUNG 1 lượt runSteps(), Maestro tự bỏ qua candidate không tồn
      // tại, KHÔNG cần dò bằng isVisible() (mỗi lượt tốn 1 `maestro hierarchy` riêng).
      steps.push({ tapOn: { id: "exercise_check_button", optional: true } });
      steps.push({ waitForAnimationToEnd: { timeout: 1500 } });
      steps.push({ tapOn: { id: "exercise_check_button", optional: true } });
      steps.push(...NEXT_OR_SUBMIT_CTA_CANDIDATES.map((cta) => ({ tapOn: { text: cta, optional: true } })));
      steps.push({ waitForAnimationToEnd: { timeout: 1000 } });
      if (resultLabel) steps.push({ takeScreenshot: resultLabel });

      const stepsResult = await this.bridge.runSteps(steps);
      if (!stepsResult.success) {
        throw new Error(`CONNECT: chuỗi thao tác thất bại: ${stepsResult.error}`);
      }

      const treeAfter = await this.bridge.hierarchy();
      const textsAfter = collectTexts(treeAfter);
      if (!this.isResultScreen(treeAfter)) {
        if (JSON.stringify(textsAfter) === JSON.stringify(textsBefore)) {
          throw new Error("CONNECT: không chuyển được câu tiếp theo - màn hình không đổi sau khi bấm CTA.");
        }
      }

      return { supported: true, type: "CONNECT", isTargetCorrect, finalTree: treeAfter, scrollCount: connectVisibleResult.scrollCount };
    }

    // Cuon (CHI khi can - xem ensureAllAnswersVisible) toi khi TOAN BO answers[] tu CMS da hien thi
    // DAY DU trong khung nhin - cau dai/nhieu option hon 1 man hinh truoc day co the khien
    // decideAnswerAction() chi thay <2 option (khong du de nhan dien TEXT_CHOICE) hoac chon nham 1
    // option dang bi cat chu. IMAGE_CHOICE_GRID (khong co text dap an) bo qua ngay, khong cuon gi.
    const answersVisibleResult = await ensureAllAnswersVisible(this.bridge, tree, questionModel);
    if (answersVisibleResult.scrollCount > 0) {
      tree = answersVisibleResult.tree;
      textsBefore = collectTexts(tree);
    }

    const action = decideAnswerAction(tree, isVisible, questionModel, wantCorrect);
    if (!action) {
      return {
        supported: false,
        reason: "Không khớp chiến lược trả lời nào có Handler hỗ trợ (TEXT_CHOICE / IMAGE_CHOICE_GRID 2x2)",
        texts: textsBefore,
      };
    }

    const tapStep = action.type === "TEXT_CHOICE" ? { tapOn: action.text } : { tapOn: { point: action.point } };
    const steps = [
      tapStep,
      { waitForAnimationToEnd: { timeout: 1500 } },
      { takeScreenshot: "before_submit" },
      ...NEXT_OR_SUBMIT_CTA_CANDIDATES.map((cta) => ({ tapOn: { text: cta, optional: true } })),
      { waitForAnimationToEnd: { timeout: 1500 } },
      ...CONFIRM_SUBMIT_BUTTON_CANDIDATES.map((label) => ({ tapOn: { text: label, optional: true } })),
      { waitForAnimationToEnd: { timeout: 1000 } },
    ];
    if (resultLabel) steps.push({ takeScreenshot: resultLabel });

    const stepsResult = await this.bridge.runSteps(steps);
    if (!stepsResult.success) {
      throw new Error(
        `UI không nhận được chuỗi hành động cho câu hỏi (${JSON.stringify(tapStep)} thất bại): ${stepsResult.error}`,
      );
    }

    // Xác nhận ĐÃ chuyển sang câu tiếp theo (hoặc màn Kết thúc) - CÙNG cách so khớp text
    // trước/sau như bản gốc. State ĐÃ đổi thật (vừa tap) nên 1 lượt hierarchy MỚI ở đây là cần
    // thiết (không thể tái dùng textsBefore) - NHƯNG chỉ ĐÚNG 1 lượt cho CẢ isResultScreen() lẫn
    // so sánh textsAfter (bản cũ gọi RIÊNG isResultScreen() - 2 lượt isVisible/hierarchy - RỒI MỚI
    // gọi thêm bridge.hierarchy() lần nữa cho textsAfter nếu chưa xong - tổng 3 lượt lãng phí cho
    // đúng 1 lần "xác nhận state mới", xem bug/fix 2026-08-17 ở đầu file).
    const treeAfter = await this.bridge.hierarchy();
    const textsAfter = collectTexts(treeAfter);
    if (!this.isResultScreen(treeAfter)) {
      if (JSON.stringify(textsAfter) === JSON.stringify(textsBefore)) {
        throw new Error("Không chuyển được câu tiếp theo - màn hình không đổi sau khi bấm CTA.");
      }
    }

    return {
      supported: true,
      type: action.type,
      isTargetCorrect: action.isTargetCorrect,
      finalTree: treeAfter,
      scrollCount: answersVisibleResult.scrollCount,
    };
  }

  /**
   * Đọc điểm/kết quả thật trên màn Kết thúc - KHÔNG suy đoán vị trí cụ thể, chỉ lấy dòng text ĐI
   * NGAY SAU nhãn ("ĐIỂM SỐ" -> giá trị điểm, "CHÍNH XÁC" -> "X/Y").
   * @param {Object} [tree] - nếu đã có sẵn `bridge.hierarchy()` từ lượt gọi trước đó (SAME state,
   *   vd `finalTree` trả về từ `answerCurrentQuestionOneShot()` của câu cuối) truyền vào để tránh
   *   spawn thêm 1 lượt `maestro hierarchy` mới - không truyền thì tự đọc state live như cũ.
   * @returns {{ score: string|null, correct: string|null, correctCount: number|null, totalCount: number|null }}
   */
  readResult(tree) {
    const texts = collectTexts(tree ?? this.bridge.hierarchy());
    const scoreIdx = texts.findIndex((t) => t.startsWith(RESULT_SCORE_LABEL));
    const correctIdx = texts.findIndex((t) => t.startsWith(RESULT_CORRECT_LABEL));
    const score = scoreIdx >= 0 ? texts[scoreIdx + 1] ?? null : null;
    const correct = correctIdx >= 0 ? texts[correctIdx + 1] ?? null : null;
    const m = /^(\d+)\s*\/\s*(\d+)$/.exec(correct || "");
    return {
      score,
      correct,
      correctCount: m ? Number(m[1]) : null,
      totalCount: m ? Number(m[2]) : null,
    };
  }
}
