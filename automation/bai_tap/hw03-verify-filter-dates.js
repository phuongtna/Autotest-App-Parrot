#!/usr/bin/env node
/**
 * Verify DATA thật của "Hạn nộp" trên tab Bài tập cho CẢ 2 filter, trong CÙNG 1 session (1 lần
 * đăng nhập, không mở lại tab, không đổi tài khoản giữa chừng):
 *   1. "2 tuần gần nhất" (mặc định khi vào tab lần đầu)
 *        -> range = [hôm nay - 14 ngày, hôm nay + 14 ngày] (khoảng ĐỐI XỨNG quanh hôm nay)
 *   2. "1 tháng gần nhất" (sau khi đổi filter)
 *        -> range = [hôm nay - 1 tháng lịch, hôm nay + 1 tháng lịch] (khoảng ĐỐI XỨNG quanh hôm nay)
 * Business rule đối xứng này đã được QA xác nhận (không suy diễn "gần nhất" thành chỉ quá khứ ->
 * hôm nay): "gần nhất" bao phủ CẢ quá khứ lẫn tương lai quanh ngày hiện tại, cả 2 biên đều hợp lệ
 * (inclusive). KHÔNG được đánh FAIL 1 card chỉ vì Hạn nộp nằm ở tương lai, miễn còn trong range.
 *
 * VÌ SAO CẦN FILE NÀY (không làm được bằng Maestro YAML thuần):
 *  - `runScript` của Maestro chạy trong 1 JS engine sandbox riêng (không phải Node) - không có
 *    child_process/fs, không gọi được `maestro hierarchy`/adb - nên 1 bước YAML không tự đọc
 *    được hierarchy hay chạy lệnh hệ thống, dù `Date` (ngày giờ thật) vẫn dùng được vì đó là
 *    JS chuẩn.
 *  - Maestro YAML không có lệnh "lấy text của TẤT CẢ phần tử khớp 1 selector" - chỉ có
 *    `copyTextFrom` cho ĐÚNG 1 phần tử. Danh sách Homework có số card KHÔNG biết trước (tuỳ tài
 *    khoản/thời điểm) nên không thể duyệt hết bằng YAML thuần.
 *  - Cần đọc hierarchy NGAY SAU KHI vào tab (filter còn "2 tuần gần nhất") RỒI MỚI đổi sang
 *    "1 tháng" và đọc lại lần 2 - tức cần 1 CHECKPOINT giữa chừng luồng thao tác. `maestro test`
 *    chạy nguyên 1 file .yaml là hộp đen (không trả quyền điều khiển cho Node ở giữa), nên script
 *    này tự điều hướng bằng các bước YAML nhỏ (`runInlineSteps`, đã có sẵn) xen kẽ đọc hierarchy,
 *    thay vì gọi nguyên `HW-02_03_04-filter-lifecycle.yaml` như bản trước (bản đó chỉ chạy được
 *    tới cuối flow, không dừng lại được ở trạng thái "2 tuần" giữa chừng).
 *  - Bước "mở sheet -> chọn 1 tháng -> Xem -> chờ reload" dùng CHUNG 1 file với
 *    `HW-02_03_04-filter-lifecycle.yaml`: xem `flows/helpers/homework-select-month-filter.yaml`
 *    - tránh copy-paste 2 nơi cùng 1 chuỗi selector.
 *
 * NGUỒN CĂN CỨ (không suy đoán vị trí ngày hạn nộp):
 *  - Cấu trúc card + vị trí dòng "Hạn nộp DD/MM" đã xác nhận THẬT trên chính app này
 *    (com.inet.parrotedu, màn "Bài tập") qua `maestro hierarchy` thật, xem
 *    automation/output/resume_test_screenshots/A_before_start_hierarchy.txt (repo "Autotest app
 *    Parrot"): mỗi card gồm <title> -> "N / M" (tiến độ) -> "Hạn nộp DD/MM" (có thể kèm
 *    "(QUÁ HẠN)") -> CTA ("Tiếp tục"/"Làm bài"/...).
 *  - Bất biến "<title> = dòng NGAY TRƯỚC dòng khớp N/M" + cách lọc node theo cờ
 *    `scrollable === "true"` để loại control cố định (header hồ sơ, tab bar) tái dùng NGUYÊN VẸN
 *    từ automation/bai_tap/discovery/homeworkUiList.js (đã xác nhận thật qua nhiều lượt cuộn
 *    khác nhau trên cùng app/màn hình, xem comment đầu file đó). KHÔNG sửa logic này (đã verify
 *    PASS từ trước, không có bằng chứng mới cần đổi).
 *  - Bug đã xác nhận thật (TEST-CASES.md mục C-4 của bộ maestro_1 này): sau khi áp filter, danh
 *    sách KHÔNG tự cuộn về đầu (flatListRef không gắn vào component nào). Vì vậy trước khi gom
 *    card (ở CẢ 2 filter) phải tự cuộn ngược lên đầu (best-effort bằng `swipe direction DOWN`
 *    nhiều lần, cùng kỹ thuật ../helpers/open-tab-homework.yaml đã dùng) - nếu không sẽ bỏ sót
 *    card ở phía trên vị trí cuộn cũ.
 *  - Card dạng role-play (item_type = role_play, xem HW-18/19) KHÔNG hiện thanh tiến độ "N/M"
 *    (bất biến parser dùng để định vị 1 card) nên KHÔNG được bộ đếm này thu thập - đây là giới
 *    hạn có sẵn của parser tái dùng, không phải lỗi mới, không tự mở rộng parser khi chưa có
 *    bằng chứng cấu trúc thật của card role-play.
 *
 * GIỚI HẠN CÒN LẠI (không giả vờ đã xử lý hết):
 *  - Case "Hạn nộp Hôm nay" (nếu app hiển thị chữ "Hôm nay" thay vì DD/MM cho bài đến hạn đúng
 *    hôm nay - suy ra từ tên case HW-10 "Card han nop hom nay", CHƯA tự xác nhận đúng chữ hiển
 *    thị trong phiên soạn script này) được xử lý best-effort (coi = hôm nay, luôn PASS vì hôm nay
 *    luôn nằm TRONG khoảng hợp lệ đối xứng ở CẢ 2 filter, không còn là biên). Nếu app hiển thị
 *    chữ khác, card đó sẽ rơi vào nhánh BLOCKED "không đọc được Hạn nộp" - KHÔNG tự đoán, đúng
 *    theo yêu cầu.
 *  - Cuộn để gom hết card dùng chiến lược dừng khi 2 lượt cuộn liên tiếp không thấy card mới
 *    (tối đa 8 lượt an toàn) - nếu 1 card nào đó không bao giờ lọt vào viewport dù đã cuộn hết
 *    (layout lỗi thật), card đó sẽ không được thu thập - đây là giới hạn thật của cách dò bằng
 *    cuộn, không phải lỗi cố ý bỏ qua.
 *  - Card KHÔNG có dòng "Hạn nộp" (đọc được card nhưng không tìm thấy dòng ngày trong phạm vi
 *    lookahead) KHÔNG được coi là "loại hợp lệ không deadline" một cách tự động - vì hiện chưa
 *    có tài liệu/business rule nào xác nhận loại card nào (nếu có) được phép không có Hạn nộp.
 *    Card đó luôn rơi vào BLOCKED kèm tên card, KHÔNG tự PASS/bỏ qua âm thầm.
 *
 * DANH SÁCH RỖNG (ở BẤT KỲ filter nào): 0 card thu thập được KHÔNG tự PASS. Chỉ PASS nếu
 * hierarchy có thấy đúng text empty-state "Bạn không có bài tập nào đang chờ" (xem
 * HW-06-empty-state.yaml) - tức danh sách rỗng THẬT, không có gì cần verify. Nếu 0 card mà
 * KHÔNG thấy text đó (nhiều khả năng lỗi đọc hierarchy/cuộn chưa gom hết) thì BLOCKED.
 *
 * CHẠY (từ thư mục flows/homework/ hoặc bất kỳ đâu - dùng __dirname):
 *   node hw03-verify-filter-dates.js
 * (đọc APP_ID từ ../../.env, PHONE/OTP từ ../../test_data/accounts.env - 2 file cấu hình
 *  chung của repo "Autotest app Parrot"; có thể ghi đè bằng biến môi trường APP_ID/PHONE/OTP/
 *  MAESTRO_DEVICE)
 *
 * EXIT CODE: tổng hợp từ CẢ 2 filter, lấy trạng thái NẶNG NHẤT (BLOCKED > FAIL > PASS):
 *   0 = cả 2 PASS, 1 = có filter FAIL (và không filter nào BLOCKED), 2 = có filter BLOCKED.
 */
"use strict";

import { execFileSync } from "child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import os from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));

const HOMEWORK_DIR = __dirname;
// automation/bai_tap -> automation -> repo root ("Autotest app Parrot")
const PROJECT_ROOT = join(HOMEWORK_DIR, "..", "..");
const HELPERS_DIR = join(PROJECT_ROOT, "flows", "app", "helpers");
const LAUNCH_KEEP_SESSION_FLOW = join(HELPERS_DIR, "launch-keep-session.yaml");
const LOGIN_FLOW = join(HELPERS_DIR, "login.yaml");
const OPEN_TAB_HOMEWORK_FLOW = join(HELPERS_DIR, "open-tab-homework.yaml");
const SELECT_MONTH_FILTER_FLOW = join(HELPERS_DIR, "homework-select-month-filter.yaml");
const MAX_SCROLLS = 8;
const SCROLL_TO_TOP_TIMES = 8;

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

// APP_ID sống ở .env gốc repo; PHONE/OTP sống ở test_data/accounts.env (gitignored) -
// 2 file cấu hình riêng, khác chỗ, xem README.md mục "flows/homework, flows/exercise,
// flows/report - port từ maestro_1".
const rootEnvFile = loadEnvFile(join(PROJECT_ROOT, ".env"));
const accountsEnvFile = loadEnvFile(join(PROJECT_ROOT, "test_data", "accounts.env"));
const APP_ID = process.env.APP_ID || rootEnvFile.APP_ID;
const PHONE = process.env.PHONE || accountsEnvFile.PHONE;
const OTP = process.env.OTP || accountsEnvFile.OTP;
const DEVICE_ID = process.env.MAESTRO_DEVICE || "";

if (!APP_ID) {
  console.error("Thiếu APP_ID - kiểm tra file .env ở gốc repo (xem .env.example), hoặc set biến môi trường APP_ID.");
  process.exit(2);
}
if (!PHONE || !OTP) {
  console.error(
    "Thiếu PHONE/OTP - kiểm tra test_data/accounts.env (copy từ .env.example nếu chưa có), hoặc set biến môi trường PHONE/OTP."
  );
  process.exit(2);
}

function deviceArgs() {
  return DEVICE_ID ? ["--device", DEVICE_ID] : [];
}

// Luôn truyền -e APP_ID/PHONE/OTP: các step gọi tới helper thật qua runFlow (vd
// launch-keep-session.yaml, login.yaml, homework-select-month-filter.yaml) có header riêng
// `appId: ${APP_ID}` - đây là placeholder Maestro cấp TOÀN CỤC cho cả lượt `maestro test`,
// KHÔNG tự nhận giá trị literal đã ghi ở header của file step tạm (chỉ áp dụng cho chính file
// đó). Thiếu -e APP_ID sẽ ra lỗi "Package undefined is not installed" ngay ở helper đầu tiên.
function runInlineSteps(yamlSteps) {
  const dir = mkdtempSync(join(os.tmpdir(), "hw-verify-step-"));
  const flowPath = join(dir, "step.yaml");
  writeFileSync(flowPath, `appId: ${APP_ID}\n---\n${yamlSteps}\n`, "utf8");
  try {
    execFileSync(
      "maestro",
      [...deviceArgs(), "test", flowPath, "-e", `APP_ID=${APP_ID}`, "-e", `PHONE=${PHONE}`, "-e", `OTP=${OTP}`],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function maestroHierarchy() {
  const raw = execFileSync("maestro", [...deviceArgs(), "hierarchy"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(raw);
}

// Text empty-state thật của tab (xem HW-06-empty-state.yaml) - dùng để phân biệt "danh sách
// rỗng hợp lệ" với "không đọc được dữ liệu" khi 0 card được thu thập. Quét TOÀN BỘ cây (không
// giới hạn trong node scrollable="true" như collectTextNodesInsideScrollableList) vì empty-state
// là 1 dòng text tĩnh, không chắc nằm trong container có cờ scrollable.
const EMPTY_STATE_PATTERN = /Bạn không có bài tập nào đang chờ/;

function treeHasEmptyState(node) {
  const text = node?.attributes?.text;
  if (typeof text === "string" && EMPTY_STATE_PATTERN.test(text)) return true;
  return (node?.children ?? []).some(treeHasEmptyState);
}

function scrollToTopBestEffort() {
  const steps = Array.from({ length: SCROLL_TO_TOP_TIMES }, () => `- swipe:\n    direction: DOWN\n    duration: 250`).join("\n");
  runInlineSteps(steps);
}

function scrollDownOnce() {
  runInlineSteps(`- swipe:\n    start: "50%,80%"\n    end: "50%,25%"\n    duration: 400\n- waitForAnimationToEnd:\n    timeout: 1200`);
}

// ---- Parse Homework card {title, dueDateText, cta} từ hierarchy (KHÔNG đổi - đã verify PASS) ----
const SECTION_HEADERS = ["Bài tập về nhà", "Bài tập nâng cao", "Kiến thức trong bài"];
const CTA_TEXTS = ["Làm bài", "Tiếp tục", "Làm lại", "Chinh phục"];
const PROGRESS_PATTERN = /^\d+\s*\/\s*\d+$/;
const DUE_DATE_DIGIT_PATTERN = /Hạn nộp\s+(\d{1,2})\/(\d{1,2})/;
const DUE_DATE_TODAY_PATTERN = /Hạn nộp\s+Hôm nay/i;
const MAX_LOOKAHEAD = 6;

function isScrollableContainerNode(attrs) {
  return attrs?.scrollable === "true";
}

function collectTextNodesInsideScrollableList(node, acc, insideScrollableList) {
  const attrs = node?.attributes ?? {};
  const nowInside = insideScrollableList || isScrollableContainerNode(attrs);
  const text = attrs.text;
  if (nowInside && typeof text === "string" && text.trim()) acc.push(text.trim());
  for (const child of node?.children ?? []) collectTextNodesInsideScrollableList(child, acc, nowInside);
  return acc;
}

function parseHomeworkCardsFromTexts(texts, sectionSeenIn) {
  const cards = [];
  let sectionSeen = sectionSeenIn;
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    if (SECTION_HEADERS.includes(text)) {
      sectionSeen = true;
      continue;
    }
    if (!sectionSeen) continue;
    if (!PROGRESS_PATTERN.test(text)) continue;

    const title = texts[i - 1];
    if (!title || SECTION_HEADERS.includes(title) || PROGRESS_PATTERN.test(title) || CTA_TEXTS.includes(title)) {
      continue;
    }

    let dueDateText = null;
    let cta = null;
    for (let j = i + 1; j < Math.min(texts.length, i + 1 + MAX_LOOKAHEAD); j++) {
      const t = texts[j];
      if (!dueDateText && (DUE_DATE_DIGIT_PATTERN.test(t) || DUE_DATE_TODAY_PATTERN.test(t))) dueDateText = t;
      if (CTA_TEXTS.includes(t)) {
        cta = t;
        break;
      }
      if (PROGRESS_PATTERN.test(t) || SECTION_HEADERS.includes(t)) break;
    }
    if (cta) cards.push({ title, dueDateText, cta });
  }
  return { cards, sectionSeen };
}

function cardsFromTree(tree, sectionSeen) {
  const texts = collectTextNodesInsideScrollableList(tree, [], false);
  return parseHomeworkCardsFromTexts(texts, sectionSeen);
}

function collectAllVisibleHomeworkCards() {
  scrollToTopBestEffort();

  const seen = new Map();
  let sectionSeen = false;
  let emptyStateSeen = false;
  const addCards = (tree) => {
    if (treeHasEmptyState(tree)) emptyStateSeen = true;
    const result = cardsFromTree(tree, sectionSeen);
    sectionSeen = sectionSeen || result.sectionSeen;
    let added = 0;
    for (const card of result.cards) {
      const key = `${card.title}|${card.dueDateText}|${card.cta}`;
      if (!seen.has(key)) {
        seen.set(key, card);
        added++;
      }
    }
    return added;
  };

  addCards(maestroHierarchy());

  let noNewStreak = 0;
  for (let i = 0; i < MAX_SCROLLS && noNewStreak < 2; i++) {
    scrollDownOnce();
    const added = addCards(maestroHierarchy());
    noNewStreak = added === 0 ? noNewStreak + 1 : 0;
  }

  return { cards: Array.from(seen.values()), emptyStateSeen };
}

// ---- Date math (đã verify PASS; giữ nguyên nguyên tắc clamp cuối tháng, tổng quát hoá thành
// shift 2 chiều (cộng/trừ) để dựng khoảng ĐỐI XỨNG quanh hôm nay theo business rule QA đã xác
// nhận) ----
function daysInMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

// Cộng/trừ N tháng lịch (delta âm = trừ, delta dương = cộng). Cùng 1 nguyên tắc clamp ngày cuối
// tháng cho CẢ 2 chiều: nếu ngày hiện tại không tồn tại ở tháng đích (vd 31 -> tháng chỉ có 30,
// hoặc 29/02 năm nhuận -> tháng 2 năm thường) thì lùi về ngày cuối cùng của tháng đích.
function shiftCalendarMonth({ y, m0, d }, delta) {
  let total = y * 12 + m0 + delta;
  const ny = Math.floor(total / 12);
  const nm0 = ((total % 12) + 12) % 12;
  const clampedDay = Math.min(d, daysInMonth(ny, nm0));
  return { y: ny, m0: nm0, d: clampedDay };
}

// Cộng/trừ N ngày lịch thật (không phải tháng) - dùng Date native để tự cuốn qua ranh giới
// tháng/năm đúng (vd 03/01 - 14 ngày -> 20/12 năm trước), không tự tính tay để tránh sai lệch.
// days âm = trừ, days dương = cộng.
function shiftDays({ y, m0, d }, days) {
  const dt = new Date(y, m0, d);
  dt.setDate(dt.getDate() + days);
  return { y: dt.getFullYear(), m0: dt.getMonth(), d: dt.getDate() };
}

function ordinal({ y, m0, d }) {
  return Date.UTC(y, m0, d);
}

function formatDMY({ y, m0, d }) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d)}/${pad(m0 + 1)}/${y}`;
}

// UI chỉ hiện "DD/MM" (không có năm) - suy năm bằng cách chọn năm trong {năm nay -1, năm nay,
// năm nay +1} sao cho ngày kết quả GẦN hôm nay nhất. Khoảng hợp lệ rộng nhất (1_month đối xứng:
// -1 tháng .. +1 tháng, tối đa ~62 ngày) vẫn không đủ để có DD/MM hợp lệ ở nhiều hơn 1 năm khác
// nhau cùng lúc - suy năm theo "gần nhất" là an toàn cho cả 2 filter (kể cả khi range giờ trải
// sang cả tương lai).
function resolveDueDateFromDigits(dd, mm, today) {
  const candidates = [today.y - 1, today.y, today.y + 1].map((y) => ({ y, m0: mm - 1, d: dd }));
  let best = null;
  let bestDiff = Infinity;
  for (const c of candidates) {
    const jsDate = new Date(c.y, c.m0, c.d);
    if (jsDate.getMonth() !== c.m0 || jsDate.getDate() !== c.d) continue; // ngày không tồn tại thật (vd 30/02)
    const diff = Math.abs(ordinal(c) - ordinal(today));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = c;
    }
  }
  return best;
}

function resolveDueDate(dueDateText, today) {
  if (!dueDateText) return null;
  const digitMatch = dueDateText.match(DUE_DATE_DIGIT_PATTERN);
  if (digitMatch) return resolveDueDateFromDigits(parseInt(digitMatch[1], 10), parseInt(digitMatch[2], 10), today);
  if (DUE_DATE_TODAY_PATTERN.test(dueDateText)) return today;
  return null;
}

// ---- Điều hướng UI (thay cho việc gọi nguyên HW-02_03_04-filter-lifecycle.yaml, vì cần dừng
// lại được ở trạng thái "2 tuần gần nhất" giữa chừng để verify trước khi đổi filter) ----
function openHomeworkTabAtDefaultFilter() {
  console.log('Mở app (giữ session), đăng nhập, mở tab Bài tập, xác nhận filter mặc định "2 tuần gần nhất"...');
  runInlineSteps(
    `
- runFlow: "${LAUNCH_KEEP_SESSION_FLOW}"
- runFlow:
    file: "${LOGIN_FLOW}"
    env:
      PHONE: "${PHONE}"
      OTP: "${OTP}"
- runFlow: "${OPEN_TAB_HOMEWORK_FLOW}"
- assertVisible: ".*(2 tuần gần nhất).*"
`.trim()
  );
}

function switchFilterToOneMonth() {
  // Lỗi điều hướng đã xác nhận thật (không phải business logic): verifyHomeworkDueDates("2_weeks")
  // vừa chạy trước đó cuộn xuống nhiều lượt để gom hết card, nên danh sách có thể đang dừng ở
  // giữa chừng (KHÔNG ở đầu) khi hàm này chạy - nhãn filter ".*gần nhất.*" nằm ở phần header phía
  // TRÊN list, có thể đã trôi khỏi khung nhìn -> tapOn không thấy phần tử, throw. Phải cuộn về
  // đầu (best-effort, cùng cơ chế scrollToTopBestEffort dùng ở collectAllVisibleHomeworkCards)
  // TRƯỚC KHI tìm/tap nhãn filter.
  console.log("Cuộn về đầu danh sách trước khi mở lại sheet filter (tránh nhãn filter bị cuộn ra khỏi khung nhìn)...");
  scrollToTopBestEffort();
  console.log('Mở sheet filter, chọn "1 tháng gần nhất", bấm Xem, chờ danh sách reload...');
  runInlineSteps(
    `
- tapOn:
    text: ".*gần nhất.*"
- extendedWaitUntil:
    visible: ".*(Xem bài tập theo).*"
    timeout: 10000
- runFlow: "${SELECT_MONTH_FILTER_FLOW}"
`.trim()
  );
}

// ---- Verify dùng chung cho cả 2 filter ----
// Business rule QA đã xác nhận: CẢ 2 filter đều là khoảng ĐỐI XỨNG quanh hôm nay (bao gồm cả quá
// khứ lẫn tương lai, 2 biên đều inclusive) - KHÔNG phải chỉ "quá khứ -> hôm nay".
//   2_weeks: [hôm nay - 14 ngày, hôm nay + 14 ngày]
//   1_month: [hôm nay - 1 tháng lịch, hôm nay + 1 tháng lịch] (dùng shiftCalendarMonth, tự clamp
//            ngày cuối tháng/năm nhuận cho cả 2 chiều cộng/trừ)
function computeRange(filterType) {
  const now = new Date();
  const today = { y: now.getFullYear(), m0: now.getMonth(), d: now.getDate() };
  if (filterType === "2_weeks") {
    return { today, rangeStart: shiftDays(today, -14), rangeEnd: shiftDays(today, 14), filterLabel: "2 tuần gần nhất" };
  }
  if (filterType === "1_month") {
    return {
      today,
      rangeStart: shiftCalendarMonth(today, -1),
      rangeEnd: shiftCalendarMonth(today, 1),
      filterLabel: "1 tháng gần nhất",
    };
  }
  throw new Error(`filterType không hợp lệ: "${filterType}" (chỉ nhận "2_weeks" hoặc "1_month")`);
}

function printReport(sectionLabel, r) {
  console.log(`[${sectionLabel}]`);
  console.log(`Filter: ${r.filterLabel}`);
  console.log(`Ngày chạy: ${formatDMY(r.today)}`);
  console.log(`Ngày bắt đầu: ${formatDMY(r.rangeStart)}`);
  console.log(`Ngày hiện tại: ${formatDMY(r.today)}`);
  console.log(`Ngày kết thúc: ${formatDMY(r.rangeEnd)}`);
  console.log(`Số card kiểm tra: ${r.checked}`);
  console.log(`Số card hợp lệ: ${r.valid}`);
  console.log(`Số card ngoài range: ${r.outOfRange}`);
  console.log(`Danh sách card lỗi: ${r.invalidList.length ? "" : "(không có)"}`);
  r.invalidList.forEach((line) => console.log(`  - ${line}`));
  console.log(`Kết quả: ${r.status}`);
  console.log("");
}

/**
 * Verify Hạn nộp của toàn bộ Homework card đang hiển thị so với khoảng hợp lệ của filterType.
 * Tự đọc hierarchy hiện tại (KHÔNG tự mở app/đổi filter) - nơi gọi chịu trách nhiệm đưa app
 * về đúng trạng thái filter trước khi gọi hàm này.
 *
 * @param {"2_weeks"|"1_month"} filterType
 * @returns {{status: "PASS"|"FAIL"|"BLOCKED", ...}} report
 */
function verifyHomeworkDueDates(filterType) {
  const { today, rangeStart, rangeEnd, filterLabel } = computeRange(filterType);
  const rangeStartOrd = ordinal(rangeStart);
  const rangeEndOrd = ordinal(rangeEnd);
  const sectionLabel = filterType === "2_weeks" ? "2 TUẦN" : "1 THÁNG";

  console.log(`Cuộn về đầu + đọc hierarchy nhiều lượt để gom toàn bộ Homework card đang hiển thị (${filterLabel})...`);
  const { cards, emptyStateSeen } = collectAllVisibleHomeworkCards();

  // Screenshot tài liệu hoá đúng trạng thái danh sách tại thời điểm verify (dù kết quả cuối
  // là PASS/FAIL/BLOCKED) - tái dùng nguyên cơ chế runInlineSteps, không mở thêm loại tiến
  // trình mới.
  runInlineSteps(`- takeScreenshot: artifacts/HW-verify-${filterType}-result`);

  const results = cards.map((card) => {
    const resolved = resolveDueDate(card.dueDateText, today);
    if (!resolved) return { title: card.title, rawDueDateText: card.dueDateText, dueDateText: null, verdict: "BLOCKED" };
    const ord = ordinal(resolved);
    const verdict = ord >= rangeStartOrd && ord <= rangeEndOrd ? "PASS" : "FAIL";
    return { title: card.title, rawDueDateText: card.dueDateText, dueDateText: formatDMY(resolved), verdict };
  });

  const invalidList = results
    .filter((r) => r.verdict !== "PASS")
    .map((r) =>
      r.verdict === "BLOCKED"
        ? `${r.title} | Không đọc được Hạn nộp (raw: ${r.rawDueDateText ?? "không có dòng Hạn nộp"})`
        : `${r.title} | Hạn nộp: ${r.dueDateText} | ngoài khoảng ${formatDMY(rangeStart)} → ${formatDMY(rangeEnd)}`
    );

  const anyBlocked = results.some((r) => r.verdict === "BLOCKED");
  const anyFail = results.some((r) => r.verdict === "FAIL");

  let status;
  if (results.length === 0) {
    // 0 card: PHÂN BIỆT "danh sách rỗng hợp lệ" (thấy đúng text empty-state) với "không đọc
    // được dữ liệu" (không thấy card NÀO cũng không thấy empty-state).
    status = emptyStateSeen ? "PASS" : "BLOCKED";
  } else if (anyBlocked) status = "BLOCKED";
  else if (anyFail) status = "FAIL";
  else status = "PASS";

  const report = {
    filterType,
    filterLabel,
    today,
    rangeStart,
    rangeEnd,
    checked: results.length,
    valid: results.filter((r) => r.verdict === "PASS").length,
    outOfRange: results.filter((r) => r.verdict === "FAIL").length,
    blocked: results.filter((r) => r.verdict === "BLOCKED").length,
    invalidList,
    emptyStateSeen,
    status,
  };

  if (results.length === 0) {
    console.log(
      emptyStateSeen
        ? '(0 Homework, nhưng đã thấy text empty-state "Bạn không có bài tập nào đang chờ" -> danh sách rỗng HỢP LỆ, không có gì cần verify ngày.)'
        : "(0 Homework thu thập được và KHÔNG thấy text empty-state -> nhiều khả năng chưa gom hết/lỗi đọc hierarchy, KHÔNG coi là danh sách rỗng thật.)"
    );
  }

  printReport(sectionLabel, report);
  return report;
}

function main() {
  openHomeworkTabAtDefaultFilter();
  const weekResult = verifyHomeworkDueDates("2_weeks");

  switchFilterToOneMonth();
  const monthResult = verifyHomeworkDueDates("1_month");

  const severity = { PASS: 0, FAIL: 1, BLOCKED: 2 };
  const overall = severity[weekResult.status] >= severity[monthResult.status] ? weekResult.status : monthResult.status;

  console.log(`Overall (2 tuần + 1 tháng): ${overall}`);
  process.exit(overall === "PASS" ? 0 : overall === "FAIL" ? 1 : 2);
}

main();
