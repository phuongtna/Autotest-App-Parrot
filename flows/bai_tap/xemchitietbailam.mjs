#!/usr/bin/env node
/**
 * HW-16 + HW-17 (GỘP) — "Xem bài đã làm" -> màn lịch sử -> "Xem chi tiết" đáp án của MỘT bài đã
 * làm (BẤT KỲ, không cần chọn bài cụ thể).
 *
 * GỘP 2026-08-18: HW-16 (flows/bai_tap/TEST-CASES.md dòng HW-16, "Lịch sử làm bài") và HW-17
 * (dòng HW-17, "Xem chi tiết đáp án") dùng CHUNG 1 luồng điều hướng - HW-16 chỉ verify màn lịch sử
 * ("Lần 1", "Điểm", "Đúng", "Thời gian nộp", "Làm lại") mà case này VỐN DĨ đã đi qua trước khi tap
 * "Xem chi tiết"; không phải 2 luồng độc lập nên KHÔNG cần login+điều hướng lại từ đầu ở 1 file
 * riêng - xem khối [HISTORY_LIST] bên dưới cho phần verify gộp từ HW-16. Bản gộp tương đương bằng
 * Maestro yaml thuần nằm ở flows/bai_tap/xemchitietbailam.yaml (case "HW-16+17") - file đó VẪN GIỮ
 * (không xoá) làm bản đối chiếu, dùng `scrollUntilVisible` (rủi ro đã ghi nhận, xem mục THAY THẾ
 * bên dưới). flows/bai_tap/HW-16-attempt-history.yaml (bản HW-16 tách riêng cũ) đã bị XÓA
 * (2026-08-18, nội dung đã gộp hết vào 2 file trên).
 *
 * MỤC TIÊU CASE: case này kiểm tra chức năng "xem chi tiết 1 bài đã làm" - card đã hoàn thành ->
 * "Xem bài đã làm" -> màn lịch sử "Lần 1" (đủ field Điểm/Đúng/Thời gian nộp/Làm lại - HW-16) ->
 * "Xem chi tiết" -> màn xem lại đáp án (bấm "Tiếp theo" qua hết các câu, câu cuối mới có "Xem
 * xong") -> "Xem xong" -> quay về màn DANH SÁCH BÀI TẬP. KHÔNG tạo assignment mới, KHÔNG làm bài mới,
 * KHÔNG phụ thuộc lesson/room_id cụ thể - bất kỳ card nào trong "Bài tập về nhà" có cta="Làm lại"
 * (đã hoàn thành, xem định nghĩa dưới) đều hợp lệ.
 *
 * THAY THẾ flows/bai_tap/xemchitietbailam.yaml (bản Maestro yaml thuần, giữ lại làm bản đối chiếu,
 * xem mục GỘP ở trên) - đổi sang Node + MaestroMcpBridge vì file .yaml đó dùng `scrollUntilVisible` với target
 * literal text ".*(Xem bài đã làm).*" và timeout cố định 25000ms. Lớp test 3B đã tích luỹ rất nhiều
 * room rác từ các lần chạy automation trước (nhiều card TRÙNG title, xem
 * automation/bai_tap/discovery/homeworkUiList.js docblock) - đo thật (2026-08-18) cho thấy phải
 * cuộn ~15-20 lượt (bằng swipe thô + đọc hierarchy) mới chạm tới 1 card đã hoàn thành; kể cả tăng
 * lên timeout=150000ms + speed=70 cho `scrollUntilVisible` cũng KHÔNG tìm ra (nghi bị đánh lừa bởi
 * nhiều dòng "N/M" trùng lặp liên tiếp của các card chưa làm - cùng lớp sự cố "cuộn không tiến
 * triển bị đánh lừa bởi nội dung trùng lặp" đã ghi nhận trong flows/helpers/locate-assignment-card.yaml).
 *
 * KHÔNG TỰ VIẾT LẠI thuật toán parse card - tái dùng CTA_TEXTS/SECTION_HEADERS/
 * collectTextNodesInsideScrollableList (automation/bai_tap/discovery/homeworkUiList.js, đã verify
 * qua nhiều testcase khác). CHỈ thêm 1 biến thể GIỮ BOUNDS của thuật toán đó
 * (findCompletedCardsWithLinkBounds() bên dưới) vì module gốc chỉ trả {title,cta} dạng text - không
 * đủ để tap thẳng "Xem bài đã làm" bằng toạ độ (xem lý do KHÔNG dùng selector text+below+index của
 * Maestro trong docstring MaestroBridge.hierarchy(): "cả selector lồng nhau LẪN selector đơn tầng
 * có index đều có thể đọc SAI" - đã xác nhận thật, không phải giả thuyết).
 *
 * AN TOÀN: KHÔNG BAO GIỜ dùng text CTA ("Xem bài đã làm"/"Làm lại") làm target cuộn - đây là ĐÚNG
 * pattern đã bị xác nhận có thể vô tình TAP nút đó ở lượt cuộn cuối (xem docblock
 * flows/bai_tap/hw21-22-upgrade-sheets.mjs, mục 1) - chỉ dùng swipe thô, sau đó đọc hierarchy để
 * phân loại card BẰNG CẤU TRÚC (title -> N/M hoặc Hạn nộp -> Điểm/Xem bài đã làm -> CTA), rồi mới
 * tap CÓ CHỦ ĐÍCH bằng toạ độ đã xác định.
 *
 * PHẠM VI: chỉ tìm trong section "Bài tập về nhà" - dừng cuộn NGAY khi gặp header "Bài tập nâng
 * cao" mà chưa thấy card hợp lệ (BLOCKED, không tự ý lấn sang section nâng cao - HW-17 không yêu
 * cầu verify nhánh đó, tránh biến case này thành HW-21/22).
 *
 * EVIDENCE (2026-08-18, bản vá 2): lượt chạy trước chỉ báo cáo history_screen/attempt_1/
 * detail_screen/review_screen - PASS được cả 4 dòng đó nhưng KHÔNG có bằng chứng RIÊNG cho việc
 * "Xem bài đã làm" thật sự đã bị tap (chỉ suy ra gián tiếp qua màn "Lần 1" xuất hiện sau đó - không
 * đủ chặt, vì màn đó có thể xuất hiện do nguyên nhân khác). Báo cáo bản vá này tách RÕ RÀNG từng
 * mốc bằng chứng độc lập: target_identity_verified (locate xong, đủ 4 anchor cấu trúc) ->
 * view_completed_visible/tapped (tap "Xem bài đã làm" - ghi nhận NGAY kết quả lệnh tapOn, không đợi
 * màn sau) -> detail_link_visible/tapped (tap "Xem chi tiết", cùng nguyên tắc) -> review_answer_screen
 * (nội dung màn xem lại đáp án) -> questions_advanced/reached_last_question (bấm "Tiếp theo" hết
 * các câu) -> returned_to_list (back, xem mục NAVIGATE bên dưới). screenshot cũng đổi sang gọi
 * `takeScreenshot` RIÊNG 1 lượt (không gộp cùng extendedWaitUntil) + `existsSync`/`statSync` xác
 * nhận file thật trên đĩa (lượt trước không verify được, xem artifacts/HW-21-upgrade-advanced.png/
 * HW-22-upgrade-redo.png trong flows/bai_tap/hw21-22-upgrade-sheets.mjs làm bằng chứng pattern này
 * hoạt động thật).
 *
 * CHẠY: node flows/bai_tap/xemchitietbailam.mjs
 * ENV: APP_ID (.env), PHONE/OTP (test_data/accounts.env), MAESTRO_DEVICE (tuỳ chọn).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MaestroMcpBridge } from "../../automation/bridge/maestroMcpBridge.js";
import { CTA_TEXTS, SECTION_HEADERS } from "../../automation/bai_tap/discovery/homeworkUiList.js";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "hw17_xem_chi_tiet_report.json");
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";

const MAX_LOCATE_SCROLLS = 60; // cùng bậc với REDO_SCROLL_CAP của hw21-22-upgrade-sheets.mjs (tìm
// cta="Làm lại" không bulk-jump) - đo thật chỉ cần ~15-20 lượt, đặt dư ra làm ngân sách an toàn.
const COMPLETED_CTA = "Làm lại";
const VIEW_LINK_TEXT = "Xem bài đã làm";
const ADVANCED_SECTION_HEADER = "Bài tập nâng cao";

// KHÔNG export từ homeworkUiList.js (chỉ CTA_TEXTS/SECTION_HEADERS/
// collectTextNodesInsideScrollableList được export) - lặp lại nguyên giá trị ở đây vì cần bản parse
// GIỮ BOUNDS (xem lý do ở docblock đầu file).
const PROGRESS_PATTERN = /^\d+\s*\/\s*\d+$/;
const DUE_DATE_PATTERN = /^Hạn nộp \d{2}\/\d{2}(\s*\(QUÁ HẠN\))?$/;
const SCORE_PATTERN = /^Điểm\s*[0-9.,]+.*$/;
const MAX_CTA_LOOKAHEAD = 6;

function loadEnvFile(path) {
  const env = {};
  if (!existsSync(path)) return env;
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return env;
}
const rootEnv = loadEnvFile(join(PROJECT_ROOT, ".env"));
const accountsEnv = loadEnvFile(join(PROJECT_ROOT, "test_data", "accounts.env"));
const APP_ID = process.env.APP_ID || rootEnv.APP_ID;
const PHONE = process.env.PHONE || accountsEnv.PHONE;
const OTP = process.env.OTP || accountsEnv.OTP;

function log(...args) {
  console.log(...args);
}

/** Escape text thường thành regex literal - dùng cho bridge.isVisible() (nhận regex, không phải
 * literal string) khi cần so khớp ĐÚNG 1 cụm cố định như "Tiếp theo"/"Xem xong" (không có ký tự
 * đặc biệt trong 2 cụm này thật, nhưng escape cho chắc/nhất quán - cùng idiom escapeRegex() đã có
 * trong flows/bai_tap/hw21-22-upgrade-sheets.mjs). */
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseBounds(boundsStr) {
  const m = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(boundsStr ?? "");
  if (!m) return null;
  // BUG THẬT đã xác nhận (2026-08-18, xác nhận bằng node -e độc lập): `m.slice(1)` đã bỏ phần tử
  // full-match (m[0]) ra khỏi mảng rồi, destructure với dấu phẩy thừa "[, x1, y1, x2, y2]" bỏ TIẾP
  // 1 phần tử nữa -> x1/y1/x2 bị lệch 1 vị trí (x1 nhận giá trị y1 thật, y1 nhận x2 thật, x2 nhận
  // y2 thật), y2 luôn thành `undefined` -> NaN khi tính centerPoint(). Tap theo toạ độ NaN khiến
  // Maestro không lỗi tường minh (runSteps vẫn success=true) nhưng không tap trúng gì - đã tái hiện
  // thật qua 1 lượt chạy FAIL với evidence "tapped tại (1270,NaN)". SỬA: bỏ dấu phẩy thừa.
  const [x1, y1, x2, y2] = m.slice(1).map(Number);
  return { x1, y1, x2, y2 };
}

function centerPoint(bounds) {
  return { x: Math.round((bounds.x1 + bounds.x2) / 2), y: Math.round((bounds.y1 + bounds.y2) / 2) };
}

/** Đọc TOÀN BỘ text trên màn hình (không lọc theo scrollable) - dùng để verify header/tiêu đề màn
 * hình sau khi điều hướng (header nằm NGOÀI vùng scrollable list, khác lúc parse card). */
function collectAllTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectAllTexts(c, acc);
  return acc;
}

/**
 * BIẾN THỂ GIỮ BOUNDS của collectTextNodesInsideScrollableList() (automation/bai_tap/discovery/
 * homeworkUiList.js) - CÙNG điều kiện lọc "scrollable === 'true'" hệt bản gốc (dùng cờ scrollable,
 * KHÔNG dùng class - xem docblock hàm gốc về bug "Chuyển profile" lọt vào danh sách card khi lọc
 * theo class), chỉ khác giữ lại {text, bounds} thay vì text đơn thuần vì cần toạ độ để tap thẳng.
 */
function collectNodesWithBoundsInsideScrollableList(node, acc, insideScrollableList = false) {
  const attrs = node?.attributes ?? {};
  const nowInside = insideScrollableList || attrs?.scrollable === "true";
  const text = attrs.text;
  if (nowInside && typeof text === "string" && text.trim()) {
    acc.push({ text: text.trim(), bounds: parseBounds(attrs.bounds) });
  }
  for (const child of node?.children ?? []) collectNodesWithBoundsInsideScrollableList(child, acc, nowInside);
  return acc;
}

/**
 * Tìm card ĐÃ HOÀN THÀNH (cta="Làm lại") kèm toạ độ link "Xem bài đã làm" của ĐÚNG card đó - tái
 * dùng NGUYÊN VẸN thuật toán anchor của parseHomeworkCardsFromTexts() (title = dòng ngay trước N/M
 * hoặc "Hạn nộp DD/MM", CTA = dòng khớp CTA_TEXTS gần nhất trong MAX_CTA_LOOKAHEAD dòng kế tiếp,
 * dừng sớm nếu gặp N/M hoặc section header khác trước khi thấy CTA), chỉ thêm việc ghi nhận dòng
 * "Điểm ..."/"Xem bài đã làm" gặp được trong đúng cửa sổ lookahead đó (bản gốc bỏ qua 2 dòng phụ
 * này, chỉ trả {title,cta}).
 * @param {Array<{text: string, bounds: object|null}>} nodes
 */
function findCompletedCardsWithLinkBounds(nodes, { sectionSeen: initialSectionSeen = false } = {}) {
  const results = [];
  let sectionSeen = initialSectionSeen;
  for (let i = 0; i < nodes.length; i++) {
    const { text } = nodes[i];
    if (SECTION_HEADERS.includes(text)) {
      sectionSeen = true;
      continue;
    }
    if (!sectionSeen) continue;
    if (!PROGRESS_PATTERN.test(text) && !DUE_DATE_PATTERN.test(text)) continue;

    const titleNode = nodes[i - 1];
    const title = titleNode?.text;
    if (
      !title ||
      SECTION_HEADERS.includes(title) ||
      PROGRESS_PATTERN.test(title) ||
      DUE_DATE_PATTERN.test(title) ||
      CTA_TEXTS.includes(title)
    ) {
      continue;
    }

    let cta = null;
    let scoreText = null;
    let viewLinkBounds = null;
    for (let j = i + 1; j < Math.min(nodes.length, i + 1 + MAX_CTA_LOOKAHEAD); j++) {
      const t = nodes[j].text;
      if (SCORE_PATTERN.test(t)) scoreText = t;
      if (t === VIEW_LINK_TEXT) viewLinkBounds = nodes[j].bounds;
      if (CTA_TEXTS.includes(t)) {
        cta = t;
        break;
      }
      // Gặp "N / M" hoặc section header khác trước khi thấy CTA - đã lỡ sang card/section kế tiếp,
      // dừng tìm CTA cho title này (giống hệt parseHomeworkCardsFromTexts).
      if (PROGRESS_PATTERN.test(t) || SECTION_HEADERS.includes(t)) break;
    }
    if (cta === COMPLETED_CTA && viewLinkBounds) {
      results.push({ title, cta, scoreText, viewLinkBounds });
    }
  }
  return { results, sectionSeen };
}

/** launch-fresh (launchApp giữ session, không clearState) - viết lại native, giống hw21-22-upgrade-sheets.mjs. */
async function launchFresh(bridge) {
  const r = await bridge.runSteps([
    { launchApp: { stopApp: true, permissions: { all: "allow" } } },
    { extendedWaitUntil: { visible: { text: ".*(Đăng nhập|Vui học|Bài tập|Báo cáo).*" }, timeout: 40000 } },
  ]);
  if (!r.success) throw new Error(`launchFresh thất bại: ${r.error}`);
}

/** login.yaml viết lại native - chỉ login nếu app đang ở màn chưa đăng nhập. */
async function loginIfNeeded(bridge) {
  const r = await bridge.runSteps([
    {
      runFlow: {
        when: { visible: ".*(Chào mừng bạn đến với ParrotEdu!|Nhập số điện thoại).*" },
        commands: [
          { tapOn: { text: ".*(Nhập số điện thoại).*" } },
          { inputText: PHONE },
          "hideKeyboard",
          { tapOn: { text: "Đăng nhập" } },
          { extendedWaitUntil: { visible: { text: ".*(Xác thực OTP).*" }, timeout: 30000 } },
          { tapOn: { below: "Đổi số điện thoại", above: "Xác nhận" } },
          { inputText: OTP },
          "hideKeyboard",
          {
            runFlow: {
              when: { visible: ".*(Xác nhận).*" },
              commands: [{ tapOn: { text: ".*(Xác nhận).*" } }],
            },
          },
          { extendedWaitUntil: { visible: { text: ".*(Vui học|Bài tập|Báo cáo).*" }, timeout: 60000 } },
        ],
      },
    },
    { extendedWaitUntil: { visible: { text: ".*(Vui học|Bài tập|Báo cáo).*" }, timeout: 30000 } },
  ]);
  if (!r.success) throw new Error(`loginIfNeeded thất bại: ${r.error}`);
}

/** open-tab-homework.yaml viết lại native. */
async function openHomeworkTab(bridge) {
  const r = await bridge.runSteps([
    { tapOn: { text: "Bài tập" } },
    {
      extendedWaitUntil: {
        visible: {
          text: ".*(Bài tập về nhà|Bài tập nâng cao|Bạn không có bài tập nào đang chờ|2 tuần gần nhất|1 tháng gần nhất).*",
        },
        timeout: 30000,
      },
    },
  ]);
  if (!r.success) throw new Error(`openHomeworkTab thất bại: ${r.error}`);
}

/**
 * Locate 1 card ĐÃ HOÀN THÀNH BẤT KỲ trong section "Bài tập về nhà" - dừng NGAY khi tìm thấy
 * candidate đầu tiên (không cuộn thêm để liệt kê hết, tối thiểu hoá số swipe). KHÔNG cuộn sang
 * section "Bài tập nâng cao" (dừng + BLOCKED nếu chạm header đó mà chưa tìm thấy - xem docblock
 * đầu file, mục PHẠM VI). CHỈ dùng swipe thô để cuộn - không target CTA nào (xem mục AN TOÀN).
 */
async function locateCompletedRegularCard(bridge, { maxScrolls }) {
  const startedAt = Date.now();
  let sectionSeen = false;
  let enteredAdvanced = false;

  const readOnce = async () => {
    const tree = await bridge.hierarchy();
    const nodes = collectNodesWithBoundsInsideScrollableList(tree, []);
    const advancedIdx = nodes.findIndex((n) => n.text === ADVANCED_SECTION_HEADER);
    if (advancedIdx !== -1) enteredAdvanced = true;
    // Cắt bỏ phần TỪ header "Bài tập nâng cao" trở đi trong CHÍNH lượt đọc này - không để 1 card
    // nâng cao lọt vào kết quả dù mới chỉ vừa chớm thấy header ở cuối khung nhìn.
    const relevantNodes = advancedIdx === -1 ? nodes : nodes.slice(0, advancedIdx);
    const { results, sectionSeen: newSectionSeen } = findCompletedCardsWithLinkBounds(relevantNodes, { sectionSeen });
    sectionSeen = newSectionSeen;
    return results;
  };

  let candidates = await readOnce();
  let scrollsUsed = 0;
  while (candidates.length === 0 && scrollsUsed < maxScrolls && !enteredAdvanced) {
    const swipeResult = await bridge.runSteps([
      { swipe: { start: "50%,80%", end: "50%,25%", duration: 400 } },
      { waitForAnimationToEnd: { timeout: 1200 } },
    ]);
    if (!swipeResult.success) {
      log(`  [LOCATE] swipe thất bại ở lượt ${scrollsUsed + 1}: ${swipeResult.error} - dừng cuộn.`);
      break;
    }
    scrollsUsed++;
    candidates = await readOnce();
  }

  const timeMs = Date.now() - startedAt;
  if (candidates.length === 0) {
    const blockedReason = enteredAdvanced
      ? `Hết section "Bài tập về nhà" (đã thấy header "${ADVANCED_SECTION_HEADER}") mà chưa gặp card cta="${COMPLETED_CTA}" nào.`
      : `Hết ngân sách cuộn (${maxScrolls} lượt) mà chưa gặp card cta="${COMPLETED_CTA}" nào.`;
    return { found: false, scrollsUsed, timeMs, blockedReason };
  }
  return { found: true, scrollsUsed, timeMs, target: candidates[0], candidateCount: candidates.length };
}

/** Đóng gói [PERFORMANCE] + ghi report ra đĩa - gọi tại MỌI điểm return của main() (kể cả early
 * return khi FAIL/BLOCKED) để JSON file trên đĩa LUÔN khớp với report in ra console (KHÔNG stamp
 * performance trong `finally` - lúc đó `finish()` của nhánh return trước đó đã ghi file XONG rồi,
 * `finally` chỉ còn sửa được object trong bộ nhớ, không sửa lại được file đã ghi). */
function finish(result, bridge, runStartedAt) {
  result.performance = {
    mcpProcesses: 1,
    hierarchyCalls: bridge.hierarchyCallCount,
    runCalls: bridge.runCallCount,
    deviceCalls: bridge.hierarchyCallCount + bridge.runCallCount,
    totalDurationMs: Date.now() - runStartedAt,
  };
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  return result;
}

function printReport(r) {
  log(`\n[RUN_ID]`);
  log(r.runId ?? "-");
  log("\n[LOCATE]");
  log(`selected_card_title=${r.locate?.title ?? "-"}`);
  log(`selected_card_score=${r.locate?.score ?? "-"}`);
  log(`selected_card_cta=${r.locate?.cta ?? "-"}`);
  log(`swipes=${r.locate?.swipes ?? "-"}`);
  log(`locate_time=${r.locate?.timeMs != null ? `${r.locate.timeMs}ms` : "-"}`);
  log(`target_identity_verified=${r.locate?.targetIdentityVerified ?? "NO"}`);
  log("\n[VIEW_COMPLETED]");
  log(`view_completed_visible=${r.viewCompleted?.visible ?? "NO"}`);
  log(`view_completed_tapped=${r.viewCompleted?.tapped ?? "NO"}`);
  log(`view_completed_card_title=${r.viewCompleted?.cardTitle ?? "-"}`);
  log("\n[HISTORY_LIST] (gộp HW-16)");
  log(`point_visible=${r.historyList?.pointVisible ?? "NO"}`);
  log(`correct_visible=${r.historyList?.correctVisible ?? "NO"}`);
  log(`submit_time_visible=${r.historyList?.submitTimeVisible ?? "NO"}`);
  log(`redo_visible=${r.historyList?.redoVisible ?? "NO"}`);
  log("\n[DETAIL]");
  log(`detail_link_visible=${r.detail?.linkVisible ?? "FAIL"}`);
  log(`detail_link_tapped=${r.detail?.linkTapped ?? "NO"}`);
  log(`detail_screen=${r.detail?.detailScreen ?? "FAIL"}`);
  log(`review_answer_screen=${r.detail?.reviewScreen ?? "FAIL"}`);
  log(`screenshot=${r.detail?.screenshot ?? "NOT_VERIFIED"}`);
  log("\n[NAVIGATE]");
  log(`questions_advanced=${r.navigate?.questionsAdvanced ?? 0}`);
  log(`reached_last_question=${r.navigate?.reachedLastQuestion ?? "NO"}`);
  log("\n[BACK]");
  log(`returned_to_list=${r.back?.returnedToList ?? "NO"}`);
  log("\n[SAFETY]");
  log(`wrong_card_opened=${r.safety?.wrongCardOpened ?? "NO"}`);
  log(`new_assignment_created=${r.safety?.newAssignmentCreated ?? "NO"}`);
  log(`unexpected_tap=${r.safety?.unexpectedTap ?? "NO"}`);
  log("\n[PERFORMANCE]");
  log(`mcp_processes=${r.performance?.mcpProcesses ?? "-"}`);
  log(`hierarchy_calls=${r.performance?.hierarchyCalls ?? "-"}`);
  log(`run_calls=${r.performance?.runCalls ?? "-"}`);
  log(`device_calls=${r.performance?.deviceCalls ?? "-"}`);
  log(`total_duration=${r.performance?.totalDurationMs != null ? `${r.performance.totalDurationMs}ms` : "-"}`);
  log("\n[OVERALL]");
  log(r.status);
  log("\n[ROOT_CAUSE]");
  log(r.status === "PASS" ? "-" : (r.error ?? r.blockedReason ?? "-"));
}

async function main() {
  if (!APP_ID) throw new Error("Thiếu APP_ID - kiểm tra .env.");
  if (!PHONE || !OTP) throw new Error("Thiếu PHONE/OTP - kiểm tra test_data/accounts.env.");

  const runStartedAt = Date.now();
  const runId = `HW16-17-${runStartedAt}`;
  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();

  const result = {
    runId,
    locate: {},
    viewCompleted: { visible: "NO", tapped: "NO", cardTitle: "-" },
    historyList: {},
    detail: {},
    navigate: { questionsAdvanced: 0, reachedLastQuestion: "NO" },
    back: { returnedToList: "NO" },
    safety: { wrongCardOpened: "NO", newAssignmentCreated: "NO", unexpectedTap: "NO" },
    status: "BLOCKED",
  };

  try {
    // ===== [SETUP] =====
    await launchFresh(bridge);
    await loginIfNeeded(bridge);
    await openHomeworkTab(bridge);
    log("[SETUP] xong.");

    // ===== [LOCATE] bất kỳ card đã hoàn thành trong "Bài tập về nhà" =====
    const locate = await locateCompletedRegularCard(bridge, { maxScrolls: MAX_LOCATE_SCROLLS });
    result.locate = { swipes: locate.scrollsUsed, timeMs: locate.timeMs };
    if (!locate.found) {
      result.status = "BLOCKED";
      result.blockedReason = locate.blockedReason;
      log(`[LOCATE] BLOCKED: ${locate.blockedReason}`);
      return finish(result, bridge, runStartedAt);
    }
    const card = locate.target;
    // target_identity_verified=YES CHỈ khi CẢ 4 anchor cấu trúc (title, N/M|Hạn nộp, cta="Làm lại",
    // toạ độ "Xem bài đã làm") đều được xác nhận TRONG CÙNG 1 lượt đọc hierarchy - không phải suy
    // đoán/ghép từ nhiều lượt đọc khác nhau (findCompletedCardsWithLinkBounds() chỉ push vào
    // results khi đủ cả 4 điều kiện này, xem thân hàm đó).
    const identityVerified = Boolean(card.title && card.cta === COMPLETED_CTA && card.viewLinkBounds);
    result.locate.title = card.title;
    result.locate.score = card.scoreText ?? "-";
    result.locate.cta = card.cta;
    result.locate.targetIdentityVerified = identityVerified ? "YES" : "NO";
    log(
      `[LOCATE] PASS: title="${card.title}" cta="${card.cta}" score="${card.scoreText ?? "-"}" ` +
        `(swipes=${locate.scrollsUsed}, candidateCount=${locate.candidateCount}, identityVerified=${identityVerified})`,
    );
    if (!identityVerified) {
      result.status = "BLOCKED";
      result.blockedReason = `Card "${card.title}" thiếu 1 trong các anchor bắt buộc (title/cta/viewLinkBounds) - không tap khi chưa xác nhận đủ cấu trúc.`;
      return finish(result, bridge, runStartedAt);
    }

    // ===== [VIEW_COMPLETED] tap "Xem bài đã làm" - toạ độ tuyệt đối lấy TRỰC TIẾP từ lượt hierarchy
    // đã xác nhận identity ở trên (không đọc lại/không dùng selector text+below+index của Maestro -
    // xem lý do trong docblock đầu file). view_completed_visible=YES vì viewLinkBounds khác null
    // nghĩa là chính lượt đọc đó ĐÃ thấy node "Xem bài đã làm" thật (không phải suy đoán). =====
    result.viewCompleted.visible = "YES";
    result.viewCompleted.cardTitle = card.title;
    const linkPoint = centerPoint(card.viewLinkBounds);
    const tapLink = await bridge.runSteps([{ tapOn: { point: `${linkPoint.x},${linkPoint.y}` } }]);
    // view_completed_tapped phản ánh ĐÚNG 1 việc: lệnh tapOn này có thực thi thành công không - KHÔNG
    // suy ra từ màn hình xuất hiện sau đó (đó là bằng chứng của bước [DETAIL]/[BACK] riêng biệt).
    result.viewCompleted.tapped = tapLink.success ? "YES" : "NO";
    if (!tapLink.success) {
      result.status = "FAIL";
      result.error = `Tap "${VIEW_LINK_TEXT}" (point ${linkPoint.x},${linkPoint.y}) thất bại: ${tapLink.error}`;
      return finish(result, bridge, runStartedAt);
    }
    log(`[VIEW_COMPLETED] tapped "${VIEW_LINK_TEXT}" tại (${linkPoint.x},${linkPoint.y}) - card="${card.title}"`);

    // ===== chờ chuyển màn (không phải bằng chứng của tapped, chỉ để bước sau đọc hierarchy ổn định) =====
    await bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1500 } }]);

    // Xác nhận ĐÚNG card vừa chọn (không lẫn card khác) - so khớp title xuất hiện trên header màn
    // lịch sử vừa mở (header nằm ngoài scrollable list nên đọc bằng collectAllTexts, không phải bản
    // lọc scrollable dùng lúc locate).
    const treeAfterTap = await bridge.hierarchy();
    const textsAfterTap = collectAllTexts(treeAfterTap);
    const onHistoryScreen = textsAfterTap.some((t) => /Lần 1/.test(t));
    const titleMatchesOnScreen = textsAfterTap.some((t) => t.includes(card.title));
    result.safety.wrongCardOpened = onHistoryScreen && !titleMatchesOnScreen ? "YES" : "NO";
    if (!onHistoryScreen) {
      result.status = "FAIL";
      result.error = `Không thấy màn lịch sử "Lần 1" sau khi tap "${VIEW_LINK_TEXT}".`;
      return finish(result, bridge, runStartedAt);
    }
    if (!titleMatchesOnScreen) {
      result.status = "FAIL";
      result.error = `Màn lịch sử KHÔNG hiện title đã chọn ("${card.title}") - nghi mở nhầm card.`;
      return finish(result, bridge, runStartedAt);
    }

    // ===== [HISTORY_LIST] verify màn lịch sử "Lần N" (GỘP từ HW-16 - xem docblock đầu file) đủ
    // field kỳ vọng theo flows/bai_tap/TEST-CASES.md dòng HW-16: mỗi lần làm có "Điểm"/"Đúng"/
    // "Thời gian nộp", cuối màn có nút "Làm lại". "Xem chi tiết" KHÔNG check lại ở đây - khối
    // [DETAIL] ngay dưới đã verify riêng (tách biệt visible/tapped). Tái dùng textsAfterTap đã đọc
    // ở trên - KHÔNG gọi thêm hierarchy() lượt nào. =====
    const hasPoint = textsAfterTap.some((t) => /Điểm/.test(t));
    const hasCorrect = textsAfterTap.some((t) => /Đúng/.test(t));
    const hasSubmitTime = textsAfterTap.some((t) => /Thời gian nộp/.test(t));
    const hasRedo = textsAfterTap.some((t) => /Làm lại/.test(t));
    result.historyList = {
      pointVisible: hasPoint ? "YES" : "NO",
      correctVisible: hasCorrect ? "YES" : "NO",
      submitTimeVisible: hasSubmitTime ? "YES" : "NO",
      redoVisible: hasRedo ? "YES" : "NO",
    };
    if (!hasPoint || !hasCorrect || !hasSubmitTime || !hasRedo) {
      result.status = "FAIL";
      result.error =
        `Màn lịch sử thiếu field kỳ vọng của HW-16 (Điểm=${hasPoint}, Đúng=${hasCorrect}, ` +
        `Thời gian nộp=${hasSubmitTime}, Làm lại=${hasRedo}).`;
      return finish(result, bridge, runStartedAt);
    }
    log(`[HISTORY_LIST] đủ field: Điểm/Đúng/Thời gian nộp/Làm lại.`);

    // ===== [DETAIL] verify "Xem chi tiết" visible TRƯỚC khi tap (tách biệt visible/tapped) =====
    const detailVisibleCheck = await bridge.runSteps([
      { extendedWaitUntil: { visible: { text: ".*(Xem chi tiết).*" }, timeout: 20000 } },
    ]);
    result.detail.linkVisible = detailVisibleCheck.success ? "PASS" : "FAIL";
    if (!detailVisibleCheck.success) {
      result.status = "FAIL";
      result.error = `Không thấy "Xem chi tiết" trên màn lịch sử: ${detailVisibleCheck.error}`;
      return finish(result, bridge, runStartedAt);
    }

    const tapDetail = await bridge.runSteps([{ tapOn: { text: "Xem chi tiết" } }]);
    result.detail.linkTapped = tapDetail.success ? "YES" : "NO";
    result.detail.detailScreen = tapDetail.success ? "PASS" : "FAIL";
    if (!tapDetail.success) {
      result.status = "FAIL";
      result.error = `Tap "Xem chi tiết" thất bại: ${tapDetail.error}`;
      return finish(result, bridge, runStartedAt);
    }
    await bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1500 } }]);

    // ===== [VERIFY] màn xem lại đáp án: "Câu 1" + thông tin đúng/sai =====
    const reviewCheck = await bridge.runSteps([
      { extendedWaitUntil: { visible: { text: ".*(Câu 1|Chính xác|Đúng|Parrot giải thích).*" }, timeout: 30000 } },
    ]);
    result.detail.reviewScreen = reviewCheck.success ? "PASS" : "FAIL";
    if (!reviewCheck.success) {
      result.status = "FAIL";
      result.error = `Không thấy màn xem lại đáp án: ${reviewCheck.error}`;
      return finish(result, bridge, runStartedAt);
    }

    // Chụp screenshot RIÊNG 1 lượt runSteps (không gộp cùng extendedWaitUntil) - đúng pattern đã xác
    // nhận THẬT có tạo file trên đĩa (flows/bai_tap/hw21-22-upgrade-sheets.mjs, waitForUpgradeMessage(),
    // artifacts/HW-21-upgrade-advanced.png + HW-22-upgrade-redo.png đã verify tồn tại thật) - lượt
    // chạy trước gộp chung 1 mảng với extendedWaitUntil nên KHÔNG xác nhận được file có tạo ra không.
    const screenshotRelPath = "artifacts/HW-17-show-answer";
    const screenshotAbsPath = join(PROJECT_ROOT, `${screenshotRelPath}.png`);
    await bridge.runSteps([{ takeScreenshot: screenshotRelPath }]);
    const screenshotExists = existsSync(screenshotAbsPath) && statSync(screenshotAbsPath).size > 0;
    result.detail.screenshot = screenshotExists ? `${screenshotRelPath}.png` : "NOT_VERIFIED";
    log(`[DETAIL] screenshot ${screenshotExists ? "verified" : "KHÔNG xác nhận được"} tại ${screenshotAbsPath}`);

    // ===== [NAVIGATE] màn xem lại đáp án có N câu - mỗi câu (trừ câu cuối) chỉ có nút "Tiếp theo";
    // CHỈ câu cuối mới có "Xem xong" (đã xác nhận thật qua screenshot Câu 1/5: footer là "Giải
    // thích" + "Tiếp theo", KHÔNG có "Xem xong"). Phải bấm "Tiếp theo" hết các câu trước rồi mới
    // tới lượt "Xem xong" - không được tap thẳng "Xem xong" khi chưa chắc đang ở câu cuối (đã GẶP
    // THẬT: lượt chạy trước tap "Xem xong" ngay tại Câu 1 vẫn báo runSteps success=true dù nút đó
    // không tồn tại trên màn - `tapOn` qua MCP "run" không hard-fail rõ ràng như kỳ vọng, không thể
    // tin tưởng success=true làm bằng chứng đã tap TRÚNG - phải tự kiểm tra "Xem xong" visible
    // bằng isVisible() TRƯỚC khi tap, không suy đoán từ số thứ tự câu).
    const MAX_QUESTIONS = 30; // ngân sách an toàn - chưa gặp bài nào >30 câu trong lớp test này.
    let questionsAdvanced = 0;
    let onLastQuestion = await bridge.isVisible(`${escapeRegex("Xem xong")}.*`);
    while (!onLastQuestion && questionsAdvanced < MAX_QUESTIONS) {
      const nextVisible = await bridge.isVisible(`${escapeRegex("Tiếp theo")}.*`);
      if (!nextVisible) {
        result.status = "FAIL";
        result.error = `Không thấy "Tiếp theo" lẫn "Xem xong" sau ${questionsAdvanced} câu - kẹt giữa chừng màn xem lại đáp án.`;
        return finish(result, bridge, runStartedAt);
      }
      const tapNext = await bridge.runSteps([{ tapOn: { text: "Tiếp theo" } }, { waitForAnimationToEnd: { timeout: 1200 } }]);
      if (!tapNext.success) {
        result.status = "FAIL";
        result.error = `Tap "Tiếp theo" thất bại ở câu thứ ${questionsAdvanced + 1}: ${tapNext.error}`;
        return finish(result, bridge, runStartedAt);
      }
      questionsAdvanced++;
      onLastQuestion = await bridge.isVisible(`${escapeRegex("Xem xong")}.*`);
    }
    result.navigate = { questionsAdvanced, reachedLastQuestion: onLastQuestion ? "YES" : "NO" };
    if (!onLastQuestion) {
      result.status = "FAIL";
      result.error = `Đã bấm "Tiếp theo" ${questionsAdvanced} lần (chạm ngân sách ${MAX_QUESTIONS}) mà vẫn chưa thấy "Xem xong".`;
      return finish(result, bridge, runStartedAt);
    }
    log(`[NAVIGATE] đã qua ${questionsAdvanced} câu bằng "Tiếp theo", tới câu cuối (thấy "Xem xong").`);

    // ===== [BACK] "Xem xong" (CHỈ có ở câu cuối) -> quay về màn DANH SÁCH BÀI TẬP (không phải màn
    // lịch sử "Lần 1" - đây là hành vi CỦA NÚT "Xem xong", khác hẳn nút back OS xem trong bản .yaml
    // cũ chỉ lùi 1 màn về "Lần 1"). Verify bằng dấu hiệu màn danh sách Bài tập (section header/badge
    // filter), không dùng lại "Xem chi tiết" (nút đó thuộc màn Lần 1, không phải màn danh sách). =====
    const back = await bridge.runSteps([{ tapOn: { text: "Xem xong" } }]);
    if (!back.success) {
      result.status = "FAIL";
      result.error = `Tap "Xem xong" thất bại: ${back.error}`;
      return finish(result, bridge, runStartedAt);
    }
    const backVerify = await bridge.runSteps([
      {
        extendedWaitUntil: {
          visible: {
            text: ".*(Bài tập về nhà|Bài tập nâng cao|Bạn không có bài tập nào đang chờ|2 tuần gần nhất|1 tháng gần nhất).*",
          },
          timeout: 20000,
        },
      },
    ]);
    result.back.returnedToList = backVerify.success ? "YES" : "NO";
    if (!backVerify.success) {
      result.status = "FAIL";
      result.error = `Không quay về được màn danh sách bài tập sau khi "Xem xong": ${backVerify.error}`;
      return finish(result, bridge, runStartedAt);
    }
    log(`[BACK] "Xem xong" -> đã về màn danh sách Bài tập.`);

    result.status = "PASS";
    return finish(result, bridge, runStartedAt);
  } catch (err) {
    result.status = "ERROR";
    result.error = err.message;
    return finish(result, bridge, runStartedAt);
  } finally {
    // KHÔNG stamp [PERFORMANCE] ở đây - finish() đã làm việc đó tại MỌI điểm return phía trên (xem
    // docstring finish()); finally chỉ còn việc dừng tiến trình `maestro mcp`.
    await bridge.stop();
  }
}

main()
  .then((result) => {
    printReport(result);
    process.exit(result.status === "PASS" ? 0 : result.status === "BLOCKED" ? 3 : 1);
  })
  .catch((err) => {
    console.error("[xemchitietbailam] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    process.exit(2);
  });
