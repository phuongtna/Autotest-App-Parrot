/**
 * Đọc danh sách Homework THẬT đang hiển thị trên UI màn "Bài tập" (List) - KHÔNG gọi CMS/
 * teacher-portal API (khác hẳn `discovery/homeworks.js`, module đó lấy danh sách qua
 * `GET /api/user/exams/room.json`). Dùng cho testcase random-1-Homework-làm-thật: yêu cầu
 * nghiệp vụ là "random đúng bài đang thấy trên app", không phải "random 1 ID từ API rồi hy vọng
 * app cũng thấy" - 2 nguồn dữ liệu (API teacher-portal vs UI học sinh) đã xác nhận có thể lệch
 * nhau (xem automation/README.md mục "Bài tập" - GIỚI HẠN CHƯA XÁC NHẬN).
 *
 * Cách đọc: `bridge.hierarchy()` (đã có sẵn, parse JSON của `maestro hierarchy`) rồi tự PHÂN NHÓM
 * theo mẫu text thật đã quan sát trên thiết bị (không suy đoán):
 *   "Bài tập về nhà" | "Bài tập nâng cao"   (section header)
 *   <title>                                 (tên Homework - dòng bất kỳ, không cố định)
 *   ... (badge "Điểm"/"Điểm N", "Xem bài đã làm" - bỏ qua) ...
 *   "N / M"  hoặc  "Hạn nộp DD/MM (QUÁ HẠN)"  (anchor - xem LƯU Ý bên dưới, KHÔNG phải cả 2 luôn có)
 *   ...
 *   "Làm bài" | "Tiếp tục" | "Làm lại" | "Chinh phục"   (CTA - kết thúc 1 card)
 *
 * Bất biến dùng để xác định <title> đáng tin cậy nhất (đã đối chiếu 2 kiểu card thật khác nhau -
 * card CHƯA làm và card ĐÃ có điểm - thứ tự các dòng phụ khác nhau nhưng bất biến này đúng cho cả
 * 2): <title> luôn là dòng text đứng NGAY TRƯỚC dòng khớp mẫu "N / M" gần nhất, tính từ sau khi đã
 * thấy 1 section header. Tự loại được dòng đếm tổng ở đầu màn (vd "13 / 32" đứng ngay sau tiêu đề
 * màn "Bài tập") vì dòng đó xuất hiện TRƯỚC section header đầu tiên.
 *
 * NGOẠI LỆ đã xác nhận thật (hierarchy dump 2026-08-18, thiết bị 3201d866d40a1681, card "Chinh
 * phục" dưới section "Bài tập nâng cao" khi CHƯA làm): card này KHÔNG có dòng "N / M" - chỉ có
 * "Hạn nộp DD/MM" hoặc "Hạn nộp DD/MM (QUÁ HẠN)" đứng ngay sau title. Trước bản vá này,
 * `PROGRESS_PATTERN` là anchor DUY NHẤT nên card dạng này bị bỏ sót vĩnh viễn dù đang hiển thị
 * thật trên màn hình (xác nhận qua automation/bai_tap/hw21-22-upgrade-sheets.mjs BLOCKED_LOCATE ở
 * HW21_LOCATE dù target đã thấy rõ trong hierarchy). `DUE_DATE_PATTERN` được thêm làm anchor thay
 * thế cho đúng nhóm card này - không thay đổi hành vi của card có "N / M" (title-rejection đã loại
 * "Hạn nộp..." đứng sau "N / M" của CÙNG card khỏi bị đếm trùng làm anchor thứ 2).
 *
 * LƯU Ý QUAN TRỌNG (phát hiện khi tự đối chiếu dữ liệu hierarchy thật lúc cuộn xuống): section
 * header CHỈ xuất hiện 1 LẦN ở đầu mỗi section rồi cuộn mất khỏi màn hình - các lượt hierarchy đọc
 * SAU KHI đã cuộn qua header sẽ KHÔNG còn thấy lại chữ header đó, dù card vẫn đang hiển thị thật.
 * Vì vậy trạng thái "đã thấy header" (`sectionSeen`) phải được DUY TRÌ XUYÊN SUỐT nhiều lượt gọi
 * (nhiều lượt cuộn), KHÔNG được reset về false ở đầu mỗi lượt `parseHomeworkCardsFromTexts()` -
 * xem cách `collectVisibleHomeworkCards()` truyền lại `sectionSeen` giữa các lượt cuộn bên dưới.
 *
 * BUG THẬT đã xác nhận + SỬA (2026-08-07, thiết bị 3201d866d40a1681, chạy
 * homeworkRandomScoringE2EOneSession.js): nhãn "Chuyển profile" (control CỐ ĐỊNH ở góc trên màn
 * hình, dùng để chuyển hồ sơ học sinh, KHÔNG phải Homework) bị `parseHomeworkCardsFromTexts()`
 * nhận nhầm làm <title> vì hàm cũ đọc TOÀN BỘ text trên màn hình theo 1 mảng phẳng, không phân
 * biệt text đó có thực sự nằm TRONG danh sách Homework hay không - chỉ dựa vào "đứng ngay trước 1
 * dòng khớp mẫu N/M".
 *
 * Đối chiếu `maestro hierarchy` THẬT (JSON đầy đủ, không phải bản đã lọc text, nhiều lượt cuộn
 * khác nhau) cho thấy màn hình có TỚI 2 node `class: "android.widget.ScrollView"` LỒNG NHAU:
 * 1 node NGOÀI bọc TOÀN BỘ màn hình (bounds "[0,0][1080,2340]", `scrollable="false"` - KHÔNG phải
 * danh sách, chỉ là container chung, VẪN chứa cả header "Chuyển profile") và 1 node TRONG mới
 * đúng là danh sách Homework thật (bounds "[0,291][1080,2112]", `scrollable="true"` - LUÔN đúng
 * giá trị này ở mọi lượt cuộn đã đối chiếu). Vì vậy KHÔNG thể chỉ dựa vào `class ===
 * "android.widget.ScrollView"` (khớp cả node ngoài, vẫn lọt "Chuyển profile" - đã thử, xác nhận
 * SAI thật) - phải dùng ĐÚNG cờ `scrollable === "true"` (chỉ node danh sách thật có cờ này) làm
 * dấu hiệu CẤU TRÚC duy nhất, KHÔNG dựa vào so khớp text "Chuyển profile" hay bất kỳ chuỗi cụ thể
 * nào (không hardcode) - `collectTextNodes()` cũ (đọc TẤT CẢ text bất kể vị trí) đã đổi thành hàm
 * `collectTextNodesInsideScrollableList()` dưới đây.
 */

const SECTION_HEADERS = ["Bài tập về nhà", "Bài tập nâng cao"];
const CTA_TEXTS = ["Làm bài", "Tiếp tục", "Làm lại", "Chinh phục"];
const PROGRESS_PATTERN = /^\d+\s*\/\s*\d+$/;
// Card "Bài tập nâng cao" chưa làm KHÔNG có dòng "N / M" (chỉ "Bài tập về nhà" mới có) - xác nhận
// thật qua hierarchy dump 2026-08-18 (thiết bị 3201d866d40a1681): card "Chinh phục" có cấu trúc
// title -> "Hạn nộp DD/MM" hoặc "Hạn nộp DD/MM (QUÁ HẠN)" -> CTA, không có N/M xen giữa. Dùng thêm
// mẫu này làm anchor thay thế để không bỏ sót nhóm card này (PROGRESS_PATTERN một mình không đủ).
const DUE_DATE_PATTERN = /^Hạn nộp \d{2}\/\d{2}(\s*\(QUÁ HẠN\))?$/;
// Card ĐÃ HOÀN THÀNH (có điểm) - xác nhận thật qua hierarchy dump 2026-08-21 (nhiều card mẫu: "Điểm
// 3", "Điểm 10", "Điểm 5"): KHÔNG còn render "N / M" lẫn "Hạn nộp ..." nữa, chỉ còn dòng "Điểm N"
// ngay sau title (rồi "Xem bài đã làm" -> CTA "Làm lại"). THIẾU anchor này khiến
// parseHomeworkCardsFromTexts()/parseHomeworkCardsWithDetail() bỏ sót VĨNH VIỄN mọi card đã hoàn
// thành (không anchor nào khớp -> không bao giờ xác định được title của nó) - hậu quả thật:
// findAssignment() báo NOT_FOUND/END_OF_LIST cho use case "làm lại 1 bài đã có điểm" BẤT KỂ cuộn
// bao nhiêu lần (không phải do cuộn chưa đủ - lỗi cấu trúc, không phải lỗi hết kiên nhẫn cuộn).
const SCORE_PATTERN = /^Điểm\s+[0-9]+(?:[.,][0-9]+)?$/;
// Lookahead tối đa (số dòng) từ sau "N / M" tới CTA - đủ rộng cho các dòng phụ đã biết ("Hạn nộp...",
// "Xem bài đã làm") nhưng vẫn có giới hạn để không lỡ ghép nhầm sang card kế tiếp.
const MAX_CTA_LOOKAHEAD = 6;

function isScrollableContainerNode(attrs) {
  // CHỈ dựa vào cờ `scrollable` (KHÔNG kèm `class`) - xem "BUG THẬT đã xác nhận + SỬA" ở đầu file:
  // có 1 ScrollView NGOÀI bọc cả header, luôn scrollable="false", nên nếu match theo class sẽ lọt
  // lại đúng bug này.
  return attrs?.scrollable === "true";
}

/**
 * Thu thập text CHỈ của node nằm TRONG vùng danh sách Homework thật (có tổ tiên là ScrollView bọc
 * danh sách - xem "BUG THẬT đã xác nhận + SỬA" ở đầu file) - loại hẳn control cố định (header
 * profile, bottom tab bar...) khỏi luồng dữ liệu bằng CẤU TRÚC hierarchy, không bằng so khớp text.
 * @param {Object} node
 * @param {string[]} acc
 * @param {boolean} insideScrollableList - đã gặp tổ tiên ScrollView/scrollable trên đường đi chưa
 */
function collectTextNodesInsideScrollableList(node, acc, insideScrollableList = false) {
  const attrs = node?.attributes ?? {};
  const nowInside = insideScrollableList || isScrollableContainerNode(attrs);
  const text = attrs.text;
  if (nowInside && typeof text === "string" && text.trim()) acc.push(text.trim());
  for (const child of node?.children ?? []) collectTextNodesInsideScrollableList(child, acc, nowInside);
  return acc;
}

/**
 * Phân tích 1 mảng text (thứ tự DFS của `maestro hierarchy`, đúng thứ tự hiển thị trên - dưới với
 * layout 1 cột của màn này) thành danh sách card {title, cta}.
 * @param {string[]} texts
 * @param {{ sectionSeen?: boolean }} [state] - `sectionSeen` mang từ lượt đọc TRƯỚC (xem lưu ý ở
 *   đầu file) - truyền `true` nếu 1 lượt trước đó (cùng phiên cuộn) đã từng thấy section header.
 * @returns {{ cards: Array<{ title: string, cta: string }>, sectionSeen: boolean }}
 */
export function parseHomeworkCardsFromTexts(texts, { sectionSeen: initialSectionSeen = false } = {}) {
  const cards = [];
  let sectionSeen = initialSectionSeen;
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    if (SECTION_HEADERS.includes(text)) {
      sectionSeen = true;
      continue;
    }
    if (!sectionSeen) continue;
    if (!PROGRESS_PATTERN.test(text) && !DUE_DATE_PATTERN.test(text) && !SCORE_PATTERN.test(text)) continue;

    const title = texts[i - 1];
    if (
      !title ||
      SECTION_HEADERS.includes(title) ||
      PROGRESS_PATTERN.test(title) ||
      DUE_DATE_PATTERN.test(title) ||
      SCORE_PATTERN.test(title) ||
      CTA_TEXTS.includes(title)
    ) {
      continue;
    }
    let cta = null;
    for (let j = i + 1; j < Math.min(texts.length, i + 1 + MAX_CTA_LOOKAHEAD); j++) {
      if (CTA_TEXTS.includes(texts[j])) {
        cta = texts[j];
        break;
      }
      if (SECTION_HEADERS.includes(texts[j])) break; // ranh giới cứng - luôn dừng ngay.
      // FIX (2026-08-22, BLOCKED thật xác nhận qua fixture + live device, room 19e78018-8c11-48e9-
      // 845f-efefe4dff82f): card ĐÃ HOÀN THÀNH có CẢ dòng "N / M" (số câu đúng/tổng) VÀ dòng
      // "Điểm N" liền sau nhau, CÙNG thuộc 1 card (xem SCORE_PATTERN comment đầu file) - break vô
      // điều kiện tại đây coi nhầm dòng "Điểm N" là anchor của card KHÁC, khiến card hoàn thành bị
      // loại VĨNH VIỄN khỏi kết quả (không do cuộn, do parse). Bất biến thật (đã ghi trong docblock
      // đầu file): title của 1 card LUÔN là dòng text THƯỜNG đứng ngay trước anchor của nó - ranh
      // giới card KẾ TIẾP chỉ tồn tại khi có 1 dòng title-thường như vậy chen giữa. Nếu dòng NGAY
      // TRƯỚC anchor vừa gặp CŨNG là 1 anchor (progress/due/score) - đó là dòng phụ thứ 2 của CHÍNH
      // card đang xét (badge nhiều dòng), KHÔNG PHẢI ranh giới - bỏ qua, tiếp tục tìm CTA trong ngân
      // sách lookahead còn lại.
      if (PROGRESS_PATTERN.test(texts[j]) || SCORE_PATTERN.test(texts[j])) {
        const prevText = texts[j - 1];
        const prevIsAnchor = PROGRESS_PATTERN.test(prevText) || DUE_DATE_PATTERN.test(prevText) || SCORE_PATTERN.test(prevText);
        if (prevIsAnchor) continue;
        break; // ranh giới card kế tiếp thật (có dòng title thường chen giữa) - dừng tìm CTA.
      }
    }
    if (cta) cards.push({ title, cta });
  }
  return { cards, sectionSeen };
}

/**
 * Đọc TOÀN BỘ card đang render trong cây hierarchy hiện tại (1 lượt `maestro hierarchy`, không tự
 * cuộn) - dùng cho `collectVisibleHomeworkCards()` lặp lại sau mỗi lần cuộn.
 * @param {import("../../bridge/maestroBridge.js").MaestroBridge} bridge
 * @param {{ sectionSeen?: boolean }} [state]
 */
export function readCurrentHomeworkCards(bridge, state) {
  const tree = bridge.hierarchy();
  return cardsFromTree(tree, state);
}

/** Dùng chung cho cả `readCurrentHomeworkCards()` (bridge, sync) và biến thể MCP session (async,
 *  xem `collectVisibleHomeworkCardsViaMcpSession()`) - tách riêng để không lặp lại cặp
 *  collect-text-rồi-parse ở 2 nơi. */
function cardsFromTree(tree, state) {
  const texts = collectTextNodesInsideScrollableList(tree, []);
  return parseHomeworkCardsFromTexts(texts, state);
}

/**
 * Cuộn (trong Node, KHÔNG dùng `scrollUntilVisible` của Maestro vì chưa biết trước title nào để
 * làm target - đây chính là việc cần làm) + đọc hierarchy nhiều lượt để gom đủ card đang thực sự
 * tồn tại trên UI trong danh sách đang mở (caller tự đảm bảo đã ở đúng màn List + đã áp filter
 * mong muốn trước khi gọi). Dừng sớm khi 2 lượt cuộn liên tiếp không phát hiện thêm card mới (đã
 * chạm đáy danh sách) - không cuộn cố định số lần, nhưng có `maxScrolls` làm giới hạn an toàn.
 * @param {import("../../bridge/maestroBridge.js").MaestroBridge} bridge
 * @param {{ maxScrolls?: number }} [options]
 * @returns {Promise<Array<{ title: string, cta: string }>>}
 */
export async function collectVisibleHomeworkCards(bridge, { maxScrolls = 8 } = {}) {
  const seen = new Map(); // key "title|cta" -> card, giữ thứ tự lần đầu gặp
  let sectionSeen = false;
  const addCards = (result) => {
    sectionSeen = sectionSeen || result.sectionSeen;
    let added = 0;
    for (const card of result.cards) {
      const key = `${card.title}|${card.cta}`;
      if (!seen.has(key)) {
        seen.set(key, card);
        added++;
      }
    }
    return added;
  };

  addCards(readCurrentHomeworkCards(bridge, { sectionSeen }));

  let noNewStreak = 0;
  for (let i = 0; i < maxScrolls && noNewStreak < 2; i++) {
    await bridge.runSteps([{ swipe: { start: "50%,80%", end: "50%,25%", duration: 400 } }, { waitForAnimationToEnd: { timeout: 1200 } }]);
    const added = addCards(readCurrentHomeworkCards(bridge, { sectionSeen }));
    noNewStreak = added === 0 ? noNewStreak + 1 : 0;
  }

  return Array.from(seen.values());
}

/**
 * Biến thể GỘP SESSION của `collectVisibleHomeworkCards()` - CÙNG hành vi/điều kiện dừng/thứ tự
 * cuộn (`noNewStreak < 2`, `maxScrolls` mặc định 8, cùng bước swipe "50%,80%"->"50%,25%" 400ms +
 * chờ hoạt ảnh 1200ms), CÙNG hàm parse (`cardsFromTree()` - tái dùng NGUYÊN VẸN, không đổi logic
 * đúng/sai của Discovery) - CHỈ khác transport: dùng `MaestroMcpSession` (1 tiến trình `maestro
 * mcp` sống xuyên suốt, xem file đó) thay vì `MaestroBridge` (mỗi swipe/hierarchy tự spawn 1 tiến
 * trình CLI riêng). Giữ nguyên `collectVisibleHomeworkCards()` bản gốc (không xoá, không sửa) để
 * rollback/so sánh - xem đo đạc thật trong flows/bai_tap/testcases/homework-review-explanation.yaml.
 *
 * KHÔNG hardcode Homework/tiêu chí dừng nào khác bản gốc - chỉ đổi cách gọi Maestro.
 * @param {import("./maestroMcpSession.js").MaestroMcpSession} mcpSession - đã `start()` sẵn.
 * @param {string} appId
 * @param {{ maxScrolls?: number }} [options]
 * @returns {Promise<Array<{ title: string, cta: string }>>}
 */
export async function collectVisibleHomeworkCardsViaMcpSession(mcpSession, appId, { maxScrolls = 8 } = {}) {
  const seen = new Map();
  let sectionSeen = false;
  const addCards = (result) => {
    sectionSeen = sectionSeen || result.sectionSeen;
    let added = 0;
    for (const card of result.cards) {
      const key = `${card.title}|${card.cta}`;
      if (!seen.has(key)) {
        seen.set(key, card);
        added++;
      }
    }
    return added;
  };

  addCards(cardsFromTree(await mcpSession.hierarchy(), { sectionSeen }));

  let noNewStreak = 0;
  for (let i = 0; i < maxScrolls && noNewStreak < 2; i++) {
    const swipeResult = await mcpSession.run(appId, [
      { swipe: { start: "50%,80%", end: "50%,25%", duration: 400 } },
      { waitForAnimationToEnd: { timeout: 1200 } },
    ]);
    if (!swipeResult.success) {
      throw new Error(`collectVisibleHomeworkCardsViaMcpSession: cuộn thất bại ở lượt ${i + 1}: ${swipeResult.error}`);
    }
    const added = addCards(cardsFromTree(await mcpSession.hierarchy(), { sectionSeen }));
    noNewStreak = added === 0 ? noNewStreak + 1 : 0;
  }

  return Array.from(seen.values());
}

/**
 * ===== PHẦN MỞ RỘNG cho findAssignment.js (2026-08-19) =====
 *
 * Mọi hàm/hằng số PHÍA TRÊN giữ NGUYÊN VẸN (không sửa) - "collect tất cả card đang thấy" vẫn đúng
 * như cũ. Phần dưới đây bổ sung THÊM 2 thứ mà findAssignment() cần mà các hàm trên chưa cung cấp:
 *   1. `bounds` (toạ độ) của title/CTA mỗi card - để tap bằng điểm thực tế thay vì lại nhờ Maestro
 *      tự khớp selector `below`/`text` (chính cơ chế đã CHỨNG MINH có thể khớp nhầm card trùng lặp
 *      - xem flows/helpers/open-exercise.yaml, đoạn "tapOn below Hạn nộp DATE (KHÔNG kèm title)").
 *   2. `dueDate` của mỗi card (không chỉ title+cta) - để phân biệt 2 card trùng title (bài bị giao
 *      lại) bằng (title, Hạn nộp), đúng identity đã dùng trong flows/helpers/open-exercise.yaml.
 *
 * Copy đúng công thức parse bounds "[x1,y1][x2,y2]" đã dùng thật trong
 * automation/bai_tap/pro_lamlai_fullluong.mjs (không bịa định dạng mới).
 */

/**
 * @param {?string} boundsStr - vd "[12,340][1068,520]"
 * @returns {?{x1:number,y1:number,x2:number,y2:number}}
 */
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
 * Giống `collectTextNodesInsideScrollableList()` nhưng giữ lại `bounds` (đã parse số, không phải
 * chuỗi thô) cùng mỗi text - cần cho tap-bằng-toạ-độ ở findAssignment.js.
 * @param {Object} node
 * @param {Array<{text:string, bounds:?{x1:number,y1:number,x2:number,y2:number}}>} acc
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

/**
 * Giống `parseHomeworkCardsFromTexts()` nhưng trả thêm `dueDate` (text "Hạn nộp DD/MM..." thật của
 * CHÍNH card đó, không phải đoán) + `titleBounds`/`ctaBounds` (toạ độ để tap). Cùng bất biến/mẫu
 * anchor đã verify thật (xem docblock đầu file) - CHỈ thêm field, không đổi logic nhận diện
 * title/CTA đã có.
 * @param {Array<{text:string, bounds:?Object}>} nodes
 * @param {{ sectionSeen?: boolean }} [state]
 * @returns {{ cards: Array<{title:string, titleBounds:?Object, dueDate:?string, progress:?string, score:?string, cta:string, ctaBounds:?Object}>, sectionSeen: boolean }}
 */
export function parseHomeworkCardsWithDetail(nodes, { sectionSeen: initialSectionSeen = false } = {}) {
  const cards = [];
  let sectionSeen = initialSectionSeen;
  for (let i = 0; i < nodes.length; i++) {
    const { text } = nodes[i];
    if (SECTION_HEADERS.includes(text)) {
      sectionSeen = true;
      continue;
    }
    if (!sectionSeen) continue;
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
      CTA_TEXTS.includes(title)
    ) {
      continue;
    }

    // Card ĐÃ HOÀN THÀNH (anchor = "Điểm N") không có dòng "Hạn nộp ..." (xem SCORE_PATTERN ở đầu
    // file) - dueDate PHẢI là null cho card này (không đoán/giữ giá trị cũ), đúng thực tế UI.
    let dueDate = isDue ? text : null;
    // progress/score (MỚI, additive - không đổi field cũ): card hoàn thành có CẢ "N / M" (câu
    // đúng/tổng) VÀ "Điểm N" cùng lúc (xem FIX ngay dưới) - lưu lại cả 2 giá trị thật đọc được,
    // thay vì chỉ biết "có tồn tại" như trước.
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
      if (CTA_TEXTS.includes(t)) {
        cta = t;
        ctaBounds = nodes[j].bounds;
        break;
      }
      if (SECTION_HEADERS.includes(t)) break; // ranh giới cứng - luôn dừng ngay.
      // FIX (2026-08-22, cùng root cause với parseHomeworkCardsFromTexts() ở trên - xem comment đầy
      // đủ tại đó): dòng "Điểm N" của CHÍNH card đang xét (theo NGAY SAU "N / M" của card đã hoàn
      // thành) bị coi nhầm là anchor của card KHÁC. Chỉ break khi dòng NGAY TRƯỚC anchor này là 1
      // title-thường (không phải anchor) - đúng bất biến "title luôn đứng ngay trước anchor của
      // NÓ", nghĩa là ranh giới card kế tiếp thật sự.
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

export { CTA_TEXTS, SECTION_HEADERS, collectTextNodesInsideScrollableList };
