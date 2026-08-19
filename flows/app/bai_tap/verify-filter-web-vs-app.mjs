#!/usr/bin/env node
/**
 * Verify business rule filter "2 tuần gần nhất"/"1 tháng gần nhất" trên tab Bài tập (App Học
 * sinh) DỰA THEO NGÀY GIAO (room.start_time, lấy từ Web GV/API) - KHÔNG dựa theo Hạn nộp
 * (room.end_time). Đây là 1 file MỚI, TÁCH RIÊNG khỏi hw03-verify-filter-dates.js (không sửa
 * file đó) vì business rule khác bản chất: hw03 tự tính range rồi so trực tiếp với Hạn nộp đọc
 * từ card App HS; file này phải ĐỐI CHIẾU 2 NGUỒN DỮ LIỆU (Web GV ground-truth vs App HS card)
 * rồi mới quyết định PASS/FAIL dựa trên Ngày giao - Hạn nộp trên App HS CHỈ dùng làm khoá đối
 * chiếu (matching key), không dùng để quyết định business rule.
 *
 * TÓM TẮT LUỒNG (đã thống nhất qua nhiều lượt phân tích + verify sống trong hội thoại):
 *   Với period ∈ {WEEK ("2 tuần gần nhất"), MONTH ("1 tháng gần nhất")}:
 *     1. Web GV: getHomeworks-equivalent qua automation/bai_tap/discovery/homeworks.js với
 *        period tương ứng (period LỌC THEO room.end_time - xem bằng chứng dưới), lọc theo lớp
 *        của tài khoản App HS test (TARGET_CLASS_ID) -> dataset {id, title, startTime, endTime}.
 *     2. Với mỗi assignment, xác định TRẠNG THÁI của đúng học sinh test (TARGET_STUDENT_ID) qua
 *        room.answers[].user_id (tái dùng automation/bai_tap/model/homeworkModel.js#resolveMyStatus)
 *        - KHÔNG gọi thêm API cho bước này (room.answers đã có sẵn trong response period).
 *     3. App HS: mở tab Bài tập, chọn ĐÚNG filter UI tương ứng, cuộn hết, đọc hierarchy, phân
 *        loại card completed/uncompleted (completed = có CTA "Làm lại").
 *     4. Match:
 *        - uncompleted: khoá (title, Hạn nộp DD/MM quy đổi từ room.end_time giờ VN)
 *        - completed:   khoá (title, score) - score của Web GV lấy qua
 *          GET /api/user/report-stats/room-analytic?room_id=... (CHỈ gọi cho những room có title
 *          trùng với 1 card completed đang cần match - không gọi tràn cho cả dataset)
 *     5. Sau khi match, PASS/FAIL dựa trên room.start_time (quy đổi giờ VN) có nằm trong range
 *        filter hay không. Nhóm match trùng khoá mà các room có start_time rơi 2 phía biên khác
 *        nhau -> BLOCKED_AMBIGUOUS_MATCH cho đúng nhóm đó, không đoán.
 *
 * BẰNG CHỨNG ĐÃ XÁC NHẬN SỐNG (không suy đoán, xem lịch sử hội thoại "Giai đoạn 0 Data
 * Discovery" + phiên verify hôm nay 2026-08-11, thiết bị 3201d866d40a1681):
 *  - Web GV filter "2 tuần gần nhất"/"1 tháng gần nhất" map sang query param
 *    `GET /api/user/exams/room.json?period=WEEK|MONTH` - đã test biên thật: room có
 *    end_time=26/08/2026 (hôm nay 11/08 +15 ngày) bị loại khỏi WEEK nhưng có trong MONTH; room
 *    end_time=25/08/2026 (+14, đúng biên) có trong WEEK -> XÁC NHẬN period lọc theo end_time.
 *  - room.start_time là "Ngày giao" (label UI thật "Thời gian giao" trên Web GV, không editable,
 *    luôn = ngày bấm "Giao bài đã chọn") - xem payload POST create_room.json + response
 *    room_details.json cùng 1 phiên, lệch <120ms so với thời điểm bấm submit thật.
 *  - Completed card App HS: cấu trúc thật (dump hierarchy thật hôm nay) là
 *    "Điểm"(badge label) -> <score>(badge value, 2 node RIÊNG, đứng TRƯỚC title) -> <title> ->
 *    "N / M" -> "Điểm <score>" (1 node hợp nhất, đứng SAU N/M, cùng vị trí "Hạn nộp DD/MM" ở
 *    card uncompleted) -> "Xem bài đã làm" -> "Làm lại". KHÔNG có dòng "Hạn nộp" nào - đúng như
 *    đã cảnh báo, KHÔNG được coi là lỗi/BLOCKED vì thiếu Hạn nộp.
 *  - Completed card KHÔNG có identifier nào (đã dump toàn bộ 27 cấp ancestor từ root tới node
 *    title 1 completed card thật: resource-id/content-desc/accessibilityText RỖNG ở mọi cấp
 *    riêng-cho-card, chỉ có 2 container tĩnh dùng chung toàn màn hình) -> PHẢI dùng title+score.
 *  - room.answers[].user_id (KHÔNG phải profile_id của report-stats) là identifier đúng để lọc
 *    đúng học sinh trong room.json - đã đối chiếu: room.answers[].user_id ===
 *    room-analytic.submitted[].id (cùng giá trị "d87364c2-..." cho học sinh "Ngoc"), KHÁC
 *    "profile_id" ("3c324247-..." - 1 giá trị khác hẳn, không dùng nhầm).
 *  - room.answers[].point/total_point là điểm thô của 1 exam cụ thể (thang KHÁC, ví dụ "0/2"),
 *    KHÁC HẲN room-analytic.score (thang 0-10, khớp "Điểm N" hiển thị trên App HS) - đã xác nhận
 *    thật, TUYỆT ĐỐI không dùng point/total_point để so khớp "Điểm" trên App HS.
 *  - Đã quét toàn bộ 139 room (period=MONTH) tìm case học sinh làm ≥2 lần: có 6 room nhưng CẢ 6
 *    đều có point GIỐNG NHAU ở mọi lần làm (không có case điểm khác nhau giữa các lần) -> KHÔNG
 *    có bằng chứng nào trong dữ liệu hiện tại để xác định semantics max/avg/latest của field
 *    "score" - giữ BLOCKED_SCORE_SEMANTICS cho MỌI so sánh giá trị tuyệt đối của điểm (không ảnh
 *    hưởng việc DÙNG score làm khoá match, vì mọi lần làm đều cho cùng giá trị trong dữ liệu đã
 *    quét).
 *
 * KHÔNG tự sửa file hw03-verify-filter-dates.js hay automation/bai_tap/discovery/homeworkUiList.js
 * - các hàm helper Maestro (runInlineSteps, maestroHierarchy, login/mở tab/đổi filter) được VIẾT
 * LẠI Ở ĐÂY theo đúng cùng logic (2 file đó không export nên không import chéo được). RIÊNG phần
 * thu thập/gộp card KHÔNG giữ nguyên bản gốc của 2 file đó - đã phải sửa lại hẳn cách cuộn+gộp
 * (theo TOẠ ĐỘ thay vì đoán overlap theo nội dung) vì bản gốc (dùng Set/Map theo nội dung) làm
 * mất card khi có ≥2 card trùng hoàn toàn title+Hạn nộp - xem chi tiết ở comment
 * scrollPastLastEntry()/mergeWithBoundedOverlap() bên dưới.
 *
 * SEVERITY: BLOCKED(2) > FAIL(1) > PASS(0) - đúng convention hw03-verify-filter-dates.js đang
 * dùng (dòng "const severity = {PASS:0, FAIL:1, BLOCKED:2}"), giữ nguyên convention repo.
 *
 * AN TOÀN "APP TỰ RELOAD SAU ~30 PHÚT CUỘN LIÊN TỤC" (2026-08-11): app tab Bài tập tự reload
 * danh sách (ghi nhận thời gian sử dụng) nếu người dùng cuộn liên tục ~30 phút - testcase collector
 * TUYỆT ĐỐI không được chạy đến ngưỡng này. collectAllVisibleHomeworkCards() vì vậy có:
 *   - COLLECTION_HARD_TIMEOUT_MS (mặc định 10 phút/lần gọi, ENV override) - an toàn cứng THEO
 *     THỜI GIAN THỰC, độc lập với MAX_SCROLLS (an toàn theo SỐ LƯỢT).
 *   - Target early-stop qua ENV TARGET_HOMEWORK_TITLE + TARGET_DUE_DATE_DM: khi lần chạy chỉ cần
 *     verify ĐÚNG 1 nhóm assignment, dừng cuộn NGAY khi App HS đã đủ số card khớp khoá đó, không
 *     cuộn hết danh sách - xem buildTargetMatchConfig().
 *   - stopReason ("NO_NEW_CARDS"|"TARGET_REACHED"|"MAX_SCROLLS"|"HARD_TIMEOUT") suy ra scanQuality
 *     ("FULL_SCAN"|"TARGET_ONLY"|"INCOMPLETE") trong runFilterCheck - CHỈ scanQuality=INCOMPLETE
 *     mới report BLOCKED_COLLECTION_INCOMPLETE (không phải FAIL); TARGET_ONLY chỉ đánh giá đúng
 *     khoá target, bỏ qua các khoá khác (chưa được quét, không FAIL giả).
 *
 * CHẠY:
 *   node flows/homework/verify-filter-web-vs-app.mjs
 *   # Hoặc chỉ verify 1 target cụ thể (dừng cuộn sớm ngay khi đủ bằng chứng cho target đó):
 *   TARGET_HOMEWORK_TITLE="G3-U1-Lesson 1: Listen and repeat" TARGET_DUE_DATE_DM="20/08" \
 *     node flows/homework/verify-filter-web-vs-app.mjs
 * ENV (đều optional, có default):
 *   APP_ID, PHONE, OTP, MAESTRO_DEVICE - giống hw03 (đọc .env/test_data/accounts.env)
 *   TARGET_CLASS_ID   - lớp của tài khoản App HS test, default "b3336062-cacd-4d1a-a0af-4de44acf33d2" (lớp "3B")
 *   TARGET_STUDENT_ID - room.answers[].user_id của học sinh test, default "d87364c2-ad26-4136-8f7a-9078aff872ff" ("Ngoc")
 *   TARGET_HOMEWORK_TITLE, TARGET_DUE_DATE_DM (định dạng "DD/MM") - bật target early-stop, không có default.
 *   COLLECTION_HARD_TIMEOUT_MS - an toàn cứng (ms) cho 1 lần gọi collectAllVisibleHomeworkCards(), default 600000 (10 phút).
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

import { fetchAllHomeworkRooms } from "../../../automation/bai_tap/discovery/homeworks.js";
import { normalizeHomework, resolveMyStatus } from "../../../automation/bai_tap/model/homeworkModel.js";
import { config, requireTeacherPortalConfig } from "../../../automation/src/config.js";

const HOMEWORK_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(HOMEWORK_DIR, "..", "..", "..");
const HELPERS_DIR = join(HOMEWORK_DIR, "..", "helpers");
const LAUNCH_KEEP_SESSION_FLOW = join(HELPERS_DIR, "launch-keep-session.yaml");
const LOGIN_FLOW = join(HELPERS_DIR, "login.yaml");
const OPEN_TAB_HOMEWORK_FLOW = join(HELPERS_DIR, "open-tab-homework.yaml");
const SELECT_MONTH_FILTER_FLOW = join(HELPERS_DIR, "homework-select-month-filter.yaml");
// Cuộn theo TOẠ ĐỘ (scrollPastLastEntry) đi từ lastEntryBottomY lên marginTop - THỰC TẾ đây là 1
// lượt cuộn LỚN (gần hết màn hình khi lastEntryBottomY nằm gần đáy), không phải cuộn nhỏ, nên
// KHÔNG cần MAX_SCROLLS lớn để chạm đáy danh sách WEEK (~25 card raw, section WEEK thực tế chạm
// đáy trong ~9-10 lượt qua các lần chạy sống 2026-08-11). MAX_SCROLLS=40 trước đây chỉ là cận an
// toàn quá rộng - kết hợp với MAX_STALL_RETRIES cũ (mỗi lượt retry cũng là 1 lần swipe+hierarchy
// thật) khiến 1 lần thu thập có thể tốn tới 40*(4+1)=200 round-trip thiết bị, quá chậm và làm
// tăng cơ hội gặp race (xem MAX_STALL_RETRIES dưới). Điều kiện dừng THẬT vẫn là noNewStreak>=2 (2
// lượt liên tiếp không thêm card mới) - MAX_SCROLLS chỉ là cận an toàn để không treo vô hạn nếu
// danh sách bất thường không bao giờ dừng thêm card mới.
const MAX_SCROLLS = 18;
const SCROLL_TO_TOP_TIMES = 8;
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "verify_filter_web_vs_app_report.json");

// ĐO THẬT (2026-08-12, thiết bị 3201d866d40a1681, xem log [PERF] khi chạy sống): 1 lệnh CLI
// `maestro` bất kỳ (dù là `hierarchy` hay `test` 1 flow chỉ có 1 swipe) tốn ~52-59s - chi phí này
// chủ yếu là KHỞI ĐỘNG lại process/kết nối ADB (gần như CỐ ĐỊNH, không phụ thuộc độ phức tạp thao
// tác). => đòn bẩy DUY NHẤT để giảm tổng thời gian thu thập là GIẢM SỐ LỆNH CLI PHẢI GỌI, không
// phải tăng timeout hay tăng số lượt cuộn (những cái đó chỉ khiến 1 lần thu thập chạy lâu hơn với
// CÙNG chi phí/lượt). Vì vậy đường "tìm đúng 1 assignment cụ thể" (targetMatch, dùng bởi
// flows/giao_bai_tap/e2e-teacher-assign-student-open.mjs) dùng ngân sách NHỎ RIÊNG - KHÔNG dùng
// chung MAX_SCROLLS/MAX_STALL_RETRIES (2 hằng số đó vẫn giữ nguyên cho use-case "quét hết danh
// sách" của chính file này - verify-filter-web-vs-app.mjs#main(), không đổi hành vi ở đó):
//   - TARGET_LOOKUP_MAX_SCROLLS=6: 6 lượt * (1 swipe + tối đa 2 hierarchy nếu có 1 stall-retry)
//     = tối đa 18 lệnh CLI * ~55s ≈ 16 phút TRẦN TUYỆT ĐỐI - nhưng COLLECTION_HARD_TIMEOUT_MS
//     (giữ nguyên 10 phút, KHÔNG tăng) sẽ chặn trước trong đa số trường hợp thật (~5-6 lượt/10
//     phút theo đúng chi phí đã đo) - 2 an toàn độc lập, cái nào chạm trước thì dừng theo cái đó.
//   - TARGET_LOOKUP_MAX_STALL_RETRIES=1 (không phải 0): bỏ hẳn retry sẽ khiến 1 lượt đọc "lỡ" do
//     hierarchy chưa cập nhật (race đã xác nhận thật) bị tính nhầm thành "hết danh sách"
//     (noNewStreak) → kết luận SAI "không tồn tại" trong khi thật ra chỉ là CHƯA ĐỦ NGÂN SÁCH. Giữ
//     1 retry (không phải 2 như bản full-scan) để cân bằng giữa an toàn và chi phí.
// stopReason MAX_SCROLLS/HARD_TIMEOUT khi dùng ngân sách nhỏ này nghĩa là "CHƯA ĐỦ BẰNG CHỨNG để
// khẳng định không tồn tại" (khác NO_NEW_CARDS = đã cuộn thật tới hết danh sách) - caller PHẢI
// phân biệt 2 trường hợp này (xem BLOCKED_DISCOVERY_BUDGET_EXCEEDED vs BLOCKED_ASSIGNMENT_NOT_FOUND
// trong e2e-teacher-assign-student-open.mjs), không gộp chung thành 1 kết luận "not found".
const TARGET_LOOKUP_MAX_SCROLLS = 6;
const TARGET_LOOKUP_MAX_STALL_RETRIES = 1;

// An toàn cứng cho 1 LẦN GỌI collectAllVisibleHomeworkCards() - KHÔNG được để chạy tới ngưỡng
// app tự reload danh sách (~30 phút cuộn liên tục trong tab Bài tập, ghi nhận thời gian sử dụng).
// main() gọi hàm này 2 LẦN (WEEK rồi MONTH) + thời gian login/mở tab/đổi filter xen giữa, nên mỗi
// lần gọi chỉ được cấp 10 phút (dư an toàn rất rộng so với thực tế ~18 lượt*≤3 round-trip mỗi
// lượt cũng chỉ mất vài phút) - nếu chạm ngưỡng này, dừng cuộn ngay và coi thu thập là CHƯA ĐẦY
// ĐỦ (xem stopReason="HARD_TIMEOUT"/scanQuality="INCOMPLETE" trong collectAllVisibleHomeworkCards
// và runFilterCheck), KHÔNG kết luận FAIL từ dữ liệu thiếu.
const COLLECTION_HARD_TIMEOUT_MS = Number(process.env.COLLECTION_HARD_TIMEOUT_MS) || 10 * 60 * 1000;

const TARGET_CLASS_ID = process.env.TARGET_CLASS_ID || "b3336062-cacd-4d1a-a0af-4de44acf33d2";
const TARGET_STUDENT_ID = process.env.TARGET_STUDENT_ID || "d87364c2-ad26-4136-8f7a-9078aff872ff";

// Target early-stop (OPTIONAL, cả 2 phải được set thì mới bật) - khi lần chạy chỉ cần xác nhận
// ĐÚNG 1 nhóm assignment cụ thể (vd "G3-U1-Lesson 1: Listen and repeat" + Hạn nộp 20/08), set 2
// biến này để collectAllVisibleHomeworkCards() DỪNG CUỘN NGAY khi App HS đã có đủ số card khớp
// khoá (title, DD/MM Hạn nộp) - không cần cuộn hết danh sách. Không set -> giữ hành vi cũ (cuộn
// tới khi hết danh sách/MAX_SCROLLS), xem buildTargetMatchConfig().
// VD chạy: TARGET_HOMEWORK_TITLE="G3-U1-Lesson 1: Listen and repeat" TARGET_DUE_DATE_DM="20/08" \
//   node flows/homework/verify-filter-web-vs-app.mjs
const TARGET_HOMEWORK_TITLE = process.env.TARGET_HOMEWORK_TITLE || null;
const TARGET_DUE_DATE_DM = process.env.TARGET_DUE_DATE_DM || null;

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

const rootEnvFile = loadEnvFile(join(PROJECT_ROOT, ".env"));
const accountsEnvFile = loadEnvFile(join(PROJECT_ROOT, "test_data", "accounts.env"));
const APP_ID = process.env.APP_ID || rootEnvFile.APP_ID;
const PHONE = process.env.PHONE || accountsEnvFile.PHONE;
const OTP = process.env.OTP || accountsEnvFile.OTP;
const DEVICE_ID = process.env.MAESTRO_DEVICE || "";

if (!APP_ID) {
  console.error("Thiếu APP_ID - kiểm tra .env ở gốc repo, hoặc set biến môi trường APP_ID.");
  process.exit(2);
}
if (!PHONE || !OTP) {
  console.error("Thiếu PHONE/OTP - kiểm tra test_data/accounts.env, hoặc set biến môi trường PHONE/OTP.");
  process.exit(2);
}

function deviceArgs() {
  return DEVICE_ID ? ["--device", DEVICE_ID] : [];
}

function runInlineSteps(yamlSteps) {
  const dir = mkdtempSync(join(os.tmpdir(), "verify-filter-step-"));
  const flowPath = join(dir, "step.yaml");
  writeFileSync(flowPath, `appId: ${APP_ID}\n---\n${yamlSteps}\n`, "utf8");
  try {
    execFileSync(
      "maestro",
      [...deviceArgs(), "test", flowPath, "-e", `APP_ID=${APP_ID}`, "-e", `PHONE=${PHONE}`, "-e", `OTP=${OTP}`],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
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

function scrollToTopBestEffort() {
  const steps = Array.from({ length: SCROLL_TO_TOP_TIMES }, () => `- swipe:\n    direction: DOWN\n    duration: 250`).join("\n");
  runInlineSteps(steps);
}

function scrollDownOnce() {
  runInlineSteps(`- swipe:\n    start: "50%,80%"\n    end: "50%,25%"\n    duration: 400\n- waitForAnimationToEnd:\n    timeout: 750`);
}

// COPY NGUYÊN gesture đã verify trong flows/homework/HW-05-pull-to-refresh.yaml (không invent
// thao tác mới) - dùng khi target chưa thấy NGAY ở lượt đọc đầu tiên (trước khi cuộn gì cả): tab
// "Bài tập" có thể đang hiển thị danh sách CACHE CŨ (fetch trước khi GV giao bài) chưa kịp có
// assignment vừa tạo - pull-to-refresh 1 lần rẻ hơn nhiều so với cuộn mù nhiều lượt để "hy vọng"
// card mới tự xuất hiện dưới đáy danh sách cache cũ (nó sẽ KHÔNG bao giờ xuất hiện nếu đó thật là
// cache cũ, bất kể cuộn bao nhiêu lượt).
function pullToRefreshOnce() {
  runInlineSteps(
    `
- swipe:
    start: 50%, 35%
    end: 50%, 85%
    duration: 600
- extendedWaitUntil:
    visible:
      text: ".*(Bài tập về nhà|Bài tập nâng cao|Kiến thức trong bài|Bạn không có bài tập nào đang chờ).*"
    timeout: 30000
`.trim(),
  );
}

// ---- Thu thập card từ hierarchy (viết lại theo đúng bất biến đã verify PASS của
// automation/bai_tap/discovery/homeworkUiList.js + hw03-verify-filter-dates.js, KHÔNG đổi hành
// vi phần title/CTA/Hạn nộp - THÊM phần trích "Điểm N" cho completed card + BOUNDS mỗi entry, xem
// bằng chứng cấu trúc thật ở docblock đầu file) ----
const EMPTY_STATE_PATTERN = /Bạn không có bài tập nào đang chờ/;
const SECTION_HEADERS = ["Bài tập về nhà", "Bài tập nâng cao", "Kiến thức trong bài"];
const CTA_TEXTS = ["Làm bài", "Tiếp tục", "Làm lại", "Chinh phục"];
const COMPLETED_CTA = "Làm lại";
const PROGRESS_PATTERN = /^\d+\s*\/\s*\d+$/;
const DUE_DATE_DIGIT_PATTERN = /Hạn nộp\s+(\d{1,2})\/(\d{1,2})/;
const DUE_DATE_TODAY_PATTERN = /Hạn nộp\s+Hôm nay/i;
const SCORE_PATTERN = /^Điểm\s+(\d+(?:[.,]\d+)?)$/;
const MAX_LOOKAHEAD = 6;

function isScrollableContainerNode(attrs) {
  return attrs?.scrollable === "true";
}

function parseScreenBounds(boundsStr) {
  const m = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(boundsStr || "");
  if (!m) return null;
  return { left: +m[1], top: +m[2], right: +m[3], bottom: +m[4] };
}

/** Giống collectTextNodesInsideScrollableList (bất biến scrollable="true" giữ nguyên) nhưng
 *  giữ lại CẢ bounds mỗi node, không chỉ text - cần cho scroll-theo-toạ-độ (xem lý do ở
 *  collectAllVisibleHomeworkCards). */
function collectEntriesInsideScrollableList(node, acc, insideScrollableList) {
  const attrs = node?.attributes ?? {};
  const nowInside = insideScrollableList || isScrollableContainerNode(attrs);
  const text = attrs.text;
  if (nowInside && typeof text === "string" && text.trim()) {
    acc.push({ text: text.trim(), bounds: parseScreenBounds(attrs.bounds) });
  }
  for (const child of node?.children ?? []) collectEntriesInsideScrollableList(child, acc, nowInside);
  return acc;
}

function findScrollableContainerBounds(node) {
  const attrs = node?.attributes ?? {};
  if (isScrollableContainerNode(attrs)) return parseScreenBounds(attrs.bounds);
  for (const child of node?.children ?? []) {
    const found = findScrollableContainerBounds(child);
    if (found) return found;
  }
  return null;
}

function treeHasEmptyState(node) {
  const text = node?.attributes?.text;
  if (typeof text === "string" && EMPTY_STATE_PATTERN.test(text)) return true;
  return (node?.children ?? []).some(treeHasEmptyState);
}

/**
 * Parse 1 mảng entries {text,bounds} (DFS order) thành card {title, cta, completed, dueDateText,
 * scoreText, boundsBottom}. dueDateText/scoreText đều dò trong CÙNG 1 phạm vi lookahead (giữa
 * "N/M" và CTA) - card completed sẽ luôn có scoreText và KHÔNG có dueDateText, card uncompleted
 * thì ngược lại. KHÔNG coi thiếu dueDateText ở card completed là lỗi (completed dùng scoreText
 * để match). `boundsBottom` = cạnh dưới của dòng CTA (dòng cuối cùng của 1 card, thấp nhất trên
 * màn hình) - dùng để cuộn CHÍNH XÁC qua khỏi card đó (xem collectAllVisibleHomeworkCards).
 */
function parseHomeworkCardsFromEntries(entries, sectionSeenIn) {
  const cards = [];
  let sectionSeen = sectionSeenIn;
  for (let i = 0; i < entries.length; i++) {
    const text = entries[i].text;
    if (SECTION_HEADERS.includes(text)) {
      sectionSeen = true;
      continue;
    }
    if (!sectionSeen) continue;
    if (!PROGRESS_PATTERN.test(text)) continue;

    const titleEntry = entries[i - 1];
    const title = titleEntry?.text;
    if (!title || SECTION_HEADERS.includes(title) || PROGRESS_PATTERN.test(title) || CTA_TEXTS.includes(title)) {
      continue;
    }

    let dueDateText = null;
    let scoreText = null;
    let cta = null;
    let boundsBottom = null;
    for (let j = i + 1; j < Math.min(entries.length, i + 1 + MAX_LOOKAHEAD); j++) {
      const t = entries[j].text;
      if (!dueDateText && (DUE_DATE_DIGIT_PATTERN.test(t) || DUE_DATE_TODAY_PATTERN.test(t))) dueDateText = t;
      if (!scoreText && SCORE_PATTERN.test(t)) scoreText = t;
      if (CTA_TEXTS.includes(t)) {
        cta = t;
        boundsBottom = entries[j].bounds?.bottom ?? null;
        break;
      }
      if (PROGRESS_PATTERN.test(t) || SECTION_HEADERS.includes(t)) break;
    }
    if (cta) cards.push({ title, cta, completed: cta === COMPLETED_CTA, dueDateText, scoreText, boundsBottom });
  }
  return { cards, sectionSeen };
}

function cardsFromTree(tree, sectionSeen) {
  const entries = collectEntriesInsideScrollableList(tree, [], false);
  return parseHomeworkCardsFromEntries(entries, sectionSeen);
}

/**
 * 1 lệnh `maestro hierarchy` DUY NHẤT (~52-59s, xem docblock TARGET_LOOKUP_* phía trên) - dùng
 * bởi flows/giao_bai_tap/e2e-teacher-assign-student-open.mjs SAU KHI
 * flows/helpers/locate-assignment-card.yaml (native scrollUntilVisible) đã xác nhận tìm thấy
 * target, CHỈ để lấy card object đầy đủ (cho report) + đếm số card khớp ĐÚNG khoá title+Hạn nộp
 * (phân biệt duplicate - xem BLOCKED_AMBIGUOUS_MATCH) - KHÔNG dùng để tự cuộn/tìm (đó là việc của
 * scrollUntilVisible native). sectionSeen=true vì tại điểm gọi hàm này, native scroll đã cuộn qua
 * ít nhất 1 section header thật (đã assertVisible tiêu đề card) - không cần dò lại từ đầu màn hình.
 */
function readHomeworkHierarchyOnce() {
  const tree = maestroHierarchy();
  return cardsFromTree(tree, true).cards;
}

function cardSignature(card) {
  return `${card.title}|${card.dueDateText}|${card.scoreText}|${card.cta}`;
}

/**
 * BUG THẬT đã phát hiện + PHÂN TÍCH KỸ (2026-08-11, chạy live, người dùng tự đối chiếu tay xác
 * nhận 4 assignment Web GV cùng title+Hạn nộp -> 4 card App HS thật, script chỉ đếm được 1):
 *
 * Bản đầu tiên dùng Map/Set khoá theo NỘI DUNG card để dedupe giữa các lượt cuộn - SAI ngay từ
 * gốc vì không phân biệt được "cùng 1 card thấy lại do cuộn chồng vùng nhìn" với "N card KHÁC
 * NHAU nhưng giống hệt text".
 *
 * Bản 2 (đã bỏ, XEM LẠI LỊCH SỬ FILE) thử "sequence stitching": tìm đoạn overlap DÀI NHẤT giữa
 * đuôi danh sách đã gộp và đầu lượt đọc mới. Bản này VẪN SAI khi có ≥2 card trùng NỘI DUNG liền
 * kề nhau: với N card giống hệt xếp cạnh nhau (cùng chiều cao, cách đều), NHIỀU giá trị k khác
 * nhau đều "khớp nội dung" một cách tự nhất quán (đã tự chứng minh bằng số trước khi code: với
 * scroll ~55% màn hình qua 1 khoảng có 2 card giống hệt liên tiếp, cả k=1 và k=2 đều cho ra 1
 * phép "khớp" hợp lệ - không có căn cứ NỘI DUNG nào để chọn đúng k, đây là bài toán aliasing thật,
 * không thể sửa bằng cách chọn "k lớn nhất" hay thêm ngưỡng nội dung khác).
 *
 * SỬA ĐÚNG: bỏ hẳn việc "đoán" overlap dựa vào nội dung. Cuộn CHÍNH XÁC theo TOẠ ĐỘ (bounds thật
 * của dòng cuối cùng đã đọc được, lấy từ `maestro hierarchy`) để đảm bảo overlap giữa 2 lượt đọc
 * liên tiếp LUÔN ≤ 1 dòng (thay vì scroll cố định 55% màn hình rồi phải đoán). Với overlap bị
 * chặn cứng ở tối đa 1 dòng, việc gộp không còn mơ hồ: chỉ cần kiểm tra ĐÚNG 1 vị trí (dòng đầu
 * lượt đọc mới có trùng CHÍNH XÁC dòng cuối lượt đọc trước không) - xem scrollPastLastEntry() +
 * mergeWithBoundedOverlap() bên dưới. KHÔNG còn cần chọn "k" giữa nhiều khả năng.
 */
const DEBUG_COLLECTOR = process.env.DEBUG_COLLECTOR === "true";

function scrollPastLastEntry(rootBounds, containerBounds, lastEntryBottomY) {
  const left = rootBounds?.left ?? 0;
  const right = rootBounds?.right ?? 1080;
  const screenBottom = rootBounds?.bottom ?? 2340;
  const centerX = Math.round((left + right) / 2);
  const marginTop = (containerBounds?.top ?? 291) + 40;
  const startY = Math.min(Math.max(lastEntryBottomY - 5, marginTop + 50), screenBottom - 50);
  if (DEBUG_COLLECTOR) {
    console.error(
      `[DEBUG] scrollPastLastEntry: rootBounds=${JSON.stringify(rootBounds)} containerBounds=${JSON.stringify(containerBounds)} lastEntryBottomY=${lastEntryBottomY} -> centerX=${centerX} startY=${startY} marginTop=${marginTop}`,
    );
  }
  runInlineSteps(
    `
- swipe:
    start: "${centerX},${startY}"
    end: "${centerX},${marginTop}"
    duration: 400
- waitForAnimationToEnd:
    timeout: 750
`.trim(),
  );
}

/**
 * Gộp accumulated + newCards khi overlap ĐÃ ĐƯỢC ĐẢM BẢO ≤ 1 dòng bởi cách cuộn theo toạ độ
 * (scrollPastLastEntry) - chỉ cần kiểm tra ĐÚNG 1 vị trí, không cần "đoán k" như các bản trước.
 * Hàm THUẦN (không gọi Maestro) - dễ unit test độc lập với phần điều khiển thiết bị.
 */
function mergeWithBoundedOverlap(accumulated, newCards) {
  if (
    accumulated.length > 0 &&
    newCards.length > 0 &&
    cardSignature(accumulated[accumulated.length - 1]) === cardSignature(newCards[0])
  ) {
    return accumulated.concat(newCards.slice(1));
  }
  return accumulated.concat(newCards);
}

// Giảm từ 4 xuống 2 (2026-08-11): mỗi lượt retry là 1 lần swipe+hierarchy THẬT trên thiết bị,
// không phải chờ thuần - 4 retry * tối đa 18 lượt scroll làm 1 lần thu thập quá chậm. Giữ nguyên
// 2 (không giảm tiếp) dù animationWait đã giảm xuống ~750ms (xem scrollPastLastEntry/
// scrollDownOnce) - vẫn cần ít nhất 1 lần retry cho race hierarchy-chưa-cập-nhật đã xác nhận thật.
const MAX_STALL_RETRIES = 2;

// Khoá "unique" CHỈ dùng để LOG số liệu đối chiếu nhanh (raw vs unique) cho người theo dõi run
// sống - KHÔNG dùng để dedupe/merge card (mergeWithBoundedOverlap vẫn là nguồn sự thật duy nhất
// cho việc gộp, xem cảnh báo ở đó: card trùng title+Hạn nộp/Điểm là HỢP LỆ và phải giữ riêng).
function collectionKeyForLogging(card) {
  return `${card.title}|${card.dueDateText ?? card.scoreText}`;
}

/**
 * @param {object} [opts]
 * @param {{keyFn: (card) => string|null, key: string, expectedCount: number, titleForLog?: string, dueDateForLog?: string}} [opts.targetMatch]
 *   Khi set: sau MỖI lượt merge (kể cả lượt đọc ĐẦU TIÊN trước khi cuộn), đếm số card trong
 *   accumulated có keyFn(card)===key - nếu >= expectedCount thì DỪNG CUỘN NGAY
 *   (stopReason="TARGET_REACHED"), không cuộn tiếp để tìm thêm. Dùng khi lần chạy chỉ cần verify
 *   1 nhóm cụ thể (xem TARGET_HOMEWORK_TITLE/TARGET_DUE_DATE_DM + buildTargetMatchConfig(), hoặc
 *   e2e-teacher-assign-student-open.mjs). titleForLog/dueDateForLog CHỈ để in CHECKPOINT log
 *   (không ảnh hưởng logic match).
 * @param {number} [opts.hardTimeoutMs] An toàn cứng theo THỜI GIAN THỰC (Date.now(), không phải
 *   số lượt cuộn) - xem COLLECTION_HARD_TIMEOUT_MS. Nếu chạm ngưỡng trước khi dừng vì lý do khác,
 *   stopReason="HARD_TIMEOUT" (KHÔNG phải MAX_SCROLLS, dù MAX_SCROLLS cũng là 1 an toàn cứng khác
 *   theo SỐ LƯỢT - 2 an toàn độc lập, cái nào chạm trước thì dừng theo cái đó).
 * @param {number} [opts.maxScrolls] Ghi đè MAX_SCROLLS - dùng ngân sách NHỎ HƠN cho use-case tìm
 *   đúng 1 assignment (xem TARGET_LOOKUP_MAX_SCROLLS - lý do chọn số này ở comment hằng số đó).
 * @param {number} [opts.maxStallRetries] Ghi đè MAX_STALL_RETRIES tương tự.
 * @param {boolean} [opts.refreshOnceIfNotFoundImmediately] Khi true VÀ targetMatch chưa khớp ngay
 *   ở lượt đọc đầu tiên (trước khi cuộn): pull-to-refresh 1 lần (gesture ĐÃ VERIFY, xem
 *   pullToRefreshOnce()) rồi đọc lại, TRƯỚC KHI bắt đầu cuộn - đề phòng danh sách đang hiển thị
 *   cache cũ (chưa kịp fetch lại sau khi vừa có assignment mới). Mặc định false - KHÔNG đổi hành
 *   vi cũ của chính file này (main()#runFilterCheck không cần refresh vì không tìm 1 assignment
 *   vừa-mới-tạo-tức-thời).
 * @returns {{cards: object[], emptyStateSeen: boolean, stopReason: "NO_NEW_CARDS"|"TARGET_REACHED"|"MAX_SCROLLS"|"HARD_TIMEOUT", scrollCount: number, hierarchyCallCount: number}}
 *   stopReason cho caller biết có nên tin tưởng dữ liệu là ĐẦY ĐỦ hay không: NO_NEW_CARDS = đã
 *   cuộn tới hết danh sách thật (2 lượt liên tiếp không có card mới) - "không tìm thấy" ở đây là
 *   KẾT LUẬN ĐÃ XÁC NHẬN. MAX_SCROLLS/HARD_TIMEOUT = dừng SỚM vì HẾT NGÂN SÁCH (số lượt hoặc thời
 *   gian) - "không tìm thấy" ở đây là CHƯA ĐỦ BẰNG CHỨNG, không phải đã xác nhận không tồn tại
 *   (caller PHẢI phân biệt 2 trường hợp này khi quyết định BLOCKED_ASSIGNMENT_NOT_FOUND vs
 *   BLOCKED_DISCOVERY_BUDGET_EXCEEDED/BLOCKED_COLLECTION_INCOMPLETE, không gộp chung).
 */
function collectAllVisibleHomeworkCards({
  targetMatch = null,
  hardTimeoutMs = COLLECTION_HARD_TIMEOUT_MS,
  maxScrolls = MAX_SCROLLS,
  maxStallRetries = MAX_STALL_RETRIES,
  refreshOnceIfNotFoundImmediately = false,
} = {}) {
  scrollToTopBestEffort();
  const startedAtMs = Date.now();
  let hierarchyCallCount = 0;

  let sectionSeen = false;
  let emptyStateSeen = false;
  // ĐO THẬT (xem hằng số TARGET_LOOKUP_* phía trên): `maestro hierarchy` là lệnh CLI ĐẮT NHẤT
  // trong toàn bộ hàm này (~52-59s/lệnh, chủ yếu chi phí khởi động lại process/ADB, gần như không
  // phụ thuộc nội dung đọc) - log [PERF] mỗi lần gọi để mọi run sống tự báo cáo chi phí thật, thay
  // vì đoán, và để phân biệt được "chậm vì hierarchy" hay "chậm vì swipe/parse".
  const readOnce = (label) => {
    const hStart = Date.now();
    const tree = maestroHierarchy();
    const hierarchy_ms = Date.now() - hStart;
    hierarchyCallCount++;
    const pStart = Date.now();
    if (treeHasEmptyState(tree)) emptyStateSeen = true;
    const entries = collectEntriesInsideScrollableList(tree, [], false);
    const result = parseHomeworkCardsFromEntries(entries, sectionSeen);
    sectionSeen = sectionSeen || result.sectionSeen;
    const rootBounds = parseScreenBounds(tree?.attributes?.bounds);
    const containerBounds = findScrollableContainerBounds(tree);
    const lastEntryBottomY = entries.length ? entries[entries.length - 1].bounds?.bottom ?? null : null;
    const parse_ms = Date.now() - pStart;
    console.log(`[PERF] ${label}: hierarchy_ms=${hierarchy_ms} parse_ms=${parse_ms} hierarchyCallCount=${hierarchyCallCount}`);
    if (DEBUG_COLLECTOR) {
      console.error(`[DEBUG] readOnce: entries.length=${entries.length} cards.length=${result.cards.length}`);
      console.error(`[DEBUG] last 5 entries: ${JSON.stringify(entries.slice(-5))}`);
    }
    // signature TOÀN BỘ entries (không chỉ dòng cuối) - dùng để phát hiện "lượt cuộn không có
    // tác dụng" (xem BUG THẬT dưới), không dùng để merge card.
    return { cards: result.cards, rootBounds, containerBounds, lastEntryBottomY, entriesSignature: JSON.stringify(entries) };
  };

  const targetMatchedCount = (accumulated) => (targetMatch ? accumulated.filter((c) => targetMatch.keyFn(c) === targetMatch.key).length : 0);

  // Log CHECKPOINT theo đúng format đã yêu cầu: mọi card ĐANG THẤY cùng title (kèm due date của
  // từng card) + targetFound - để phân biệt "chưa refresh/load", "parser đọc sai", "chưa cuộn
  // tới", "matcher sai" hay "card thực sự không tồn tại" (không đoán, đọc thẳng từ log).
  const logCheckpoint = (label, accumulated, scrollIteration) => {
    if (!targetMatch) return;
    const found = targetMatchedCount(accumulated) >= targetMatch.expectedCount;
    const sameTitleCards = targetMatch.titleForLog ? accumulated.filter((c) => c.title === targetMatch.titleForLog) : [];
    console.log(
      `CHECKPOINT[${label}]: elapsedMs=${Date.now() - startedAtMs} scrollIteration=${scrollIteration} rawCards=${accumulated.length} uniqueKeys=${new Set(accumulated.map(collectionKeyForLogging)).size}`,
    );
    console.log(`  TARGET: title="${targetMatch.titleForLog ?? "?"}" dueDate="${targetMatch.dueDateForLog ?? "?"}"`);
    if (sameTitleCards.length) {
      console.log(`  VISIBLE MATCHES (cùng title):`);
      for (const c of sameTitleCards) console.log(`    - due=${c.dueDateText ?? c.scoreText ?? "?"} cta=${c.cta} completed=${c.completed}`);
    } else {
      console.log(`  VISIBLE MATCHES (cùng title): (chưa thấy card nào cùng title trong lượt đọc này)`);
    }
    console.log(`  targetFound=${found}`);
  };

  let prevRead = readOnce("INITIAL_READ");
  let accumulated = prevRead.cards;
  logCheckpoint("INITIAL_READ", accumulated, 0);

  let stopReason = targetMatch && targetMatchedCount(accumulated) >= targetMatch.expectedCount ? "TARGET_REACHED" : null;
  if (DEBUG_COLLECTOR && stopReason === "TARGET_REACHED") {
    console.error(`[DEBUG] target đã đủ ngay từ lượt đọc đầu tiên (trước khi cuộn) - không cuộn gì thêm.`);
  }

  // Target-first: nếu target CHƯA thấy ngay ở lượt đọc đầu (trước khi cuộn gì cả), thử refresh
  // (pull-to-refresh - gesture ĐÃ VERIFY ở HW-05-pull-to-refresh.yaml, KHÔNG invent thao tác mới)
  // ĐÚNG 1 LẦN trước khi cuộn - rẻ hơn nhiều so với cuộn mù nhiều lượt "hy vọng" card mới tự xuất
  // hiện (nó sẽ không xuất hiện nếu đây thật là cache cũ, bất kể cuộn bao nhiêu).
  if (refreshOnceIfNotFoundImmediately && targetMatch && stopReason !== "TARGET_REACHED") {
    console.log(`Target chưa thấy ở lượt đọc đầu - pull-to-refresh 1 lần (đề phòng cache cũ) trước khi cuộn...`);
    const swipeStart = Date.now();
    pullToRefreshOnce();
    console.log(`[PERF] REFRESH: swipe_ms=${Date.now() - swipeStart}`);
    prevRead = readOnce("AFTER_REFRESH");
    accumulated = prevRead.cards; // danh sách MỚI sau refresh (đã về lại đầu) - không gộp với lượt trước
    logCheckpoint("AFTER_REFRESH", accumulated, 0);
    if (targetMatchedCount(accumulated) >= targetMatch.expectedCount) stopReason = "TARGET_REACHED";
  }

  let noNewStreak = 0;
  let scrollCount = 0;

  // Mỗi vòng lặp kiểm tra 2 an toàn cứng ĐỘC LẬP trước khi cuộn thêm (số lượt VÀ thời gian thực),
  // rồi kiểm tra 2 điều kiện dừng "có ý nghĩa" sau khi merge card mới (đủ target / hết card mới).
  while (!stopReason) {
    if (scrollCount >= maxScrolls) {
      stopReason = "MAX_SCROLLS";
      break;
    }
    if (Date.now() - startedAtMs >= hardTimeoutMs) {
      stopReason = "HARD_TIMEOUT";
      break;
    }

    scrollCount++;
    const iterStart = Date.now();
    let newRead = null;
    for (let retry = 0; retry <= maxStallRetries; retry++) {
      const label = `SCROLL_${scrollCount}${retry > 0 ? `_retry${retry}` : ""}`;
      const swipeStart = Date.now();
      if (prevRead.lastEntryBottomY == null) {
        // Fallback hiếm gặp (không đo được bounds dòng cuối) - giữ hành vi cuộn cố định cũ, KHÔNG
        // dừng cả script, nhưng mất đảm bảo overlap≤1 cho đúng lượt này.
        scrollDownOnce();
      } else {
        scrollPastLastEntry(prevRead.rootBounds, prevRead.containerBounds, prevRead.lastEntryBottomY);
      }
      console.log(`[PERF] ${label}: swipe_ms=${Date.now() - swipeStart}`);
      const candidate = readOnce(label);
      // BUG THẬT đã xác nhận (2026-08-11): đôi khi `maestro hierarchy` đọc được ngay SAU
      // `waitForAnimationToEnd` vẫn trả về hierarchy CHƯA kịp cập nhật sau cuộn (race) - toàn bộ
      // entries GIỐNG Y NGUYÊN lượt trước (kể cả bounds), khiến mergeWithBoundedOverlap (chỉ so
      // 1 vị trí) lọt cả cụm card trùng làm card MỚI giả. Phát hiện bằng so signature TOÀN BỘ
      // entries - nếu giống y nguyên, xem như cuộn CHƯA có tác dụng, thử lại (không lấy read này).
      if (candidate.entriesSignature !== prevRead.entriesSignature) {
        newRead = candidate;
        break;
      }
      if (DEBUG_COLLECTOR) console.error(`[DEBUG] stall detected (retry ${retry + 1}/${maxStallRetries}) - hierarchy giống y nguyên lượt trước, thử cuộn lại...`);
      newRead = candidate; // dùng tạm nếu hết lượt retry vẫn không đổi (sẽ added=0, dừng bằng noNewStreak)
    }
    const before = accumulated.length;
    accumulated = mergeWithBoundedOverlap(accumulated, newRead.cards);
    const added = accumulated.length - before;
    noNewStreak = added === 0 ? noNewStreak + 1 : 0;
    prevRead = newRead;
    console.log(`[PERF] SCROLL_${scrollCount}: iteration_ms=${Date.now() - iterStart}`);
    logCheckpoint(`SCROLL_${scrollCount}`, accumulated, scrollCount);
    if (DEBUG_COLLECTOR) {
      console.error(`[DEBUG] lượt cuộn ${scrollCount}/${maxScrolls}: +${added} card mới, tổng raw=${accumulated.length}, noNewStreak=${noNewStreak}`);
    }

    if (targetMatch && targetMatchedCount(accumulated) >= targetMatch.expectedCount) {
      stopReason = "TARGET_REACHED";
    } else if (noNewStreak >= 2) {
      stopReason = "NO_NEW_CARDS";
    }
  }

  const uniqueKeyCount = new Set(accumulated.map(collectionKeyForLogging)).size;
  console.log(
    `Thu thập xong sau ${scrollCount} lượt cuộn / ${hierarchyCallCount} lệnh hierarchy (dừng vì: ${stopReason}): ${accumulated.length} card RAW (không dedupe) / ${uniqueKeyCount} khoá (title+Hạn nộp hoặc title+Điểm) khác nhau. emptyStateSeen=${emptyStateSeen}`,
  );
  if (stopReason === "MAX_SCROLLS" || stopReason === "HARD_TIMEOUT") {
    console.log(`CẢNH BÁO: dừng thu thập SỚM ngoài ý muốn (${stopReason}) - dữ liệu App HS CHƯA ĐẦY ĐỦ, không dùng để kết luận FAIL.`);
  }

  return { cards: accumulated, emptyStateSeen, stopReason, scrollCount, hierarchyCallCount };
}

// ---- Timezone: quy đổi TƯỜNG MINH sang giờ VN (UTC+7), KHÔNG dựa vào timezone của máy chạy
// script (dù máy hiện tại đang là Asia/Bangkok/UTC+7 - vẫn không dựa vào đó, theo đúng yêu cầu
// "chuẩn hoá đúng giờ VN trước khi so sánh", để script không phụ thuộc môi trường chạy) ----
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function epochMsToVnYmd(epochMs) {
  const shifted = new Date(epochMs + VN_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m0: shifted.getUTCMonth(), d: shifted.getUTCDate() };
}

function isoToVnYmd(iso) {
  if (!iso) return null;
  return epochMsToVnYmd(new Date(iso).getTime());
}

function nowVnYmd() {
  return epochMsToVnYmd(Date.now());
}

function daysInMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function shiftCalendarMonth({ y, m0, d }, delta) {
  let total = y * 12 + m0 + delta;
  const ny = Math.floor(total / 12);
  const nm0 = ((total % 12) + 12) % 12;
  const clampedDay = Math.min(d, daysInMonth(ny, nm0));
  return { y: ny, m0: nm0, d: clampedDay };
}

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

function formatDM({ y, m0, d }) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d)}/${pad(m0 + 1)}`;
}

function computeRange(period) {
  const today = nowVnYmd();
  if (period === "WEEK") {
    return { today, rangeStart: shiftDays(today, -14), rangeEnd: shiftDays(today, 14), filterLabel: "2 tuần gần nhất" };
  }
  if (period === "MONTH") {
    return {
      today,
      rangeStart: shiftCalendarMonth(today, -1),
      rangeEnd: shiftCalendarMonth(today, 1),
      filterLabel: "1 tháng gần nhất",
    };
  }
  throw new Error(`period không hợp lệ: "${period}" (chỉ nhận "WEEK" hoặc "MONTH")`);
}

function inRange(ymd, rangeStart, rangeEnd) {
  const ord = ordinal(ymd);
  return ord >= ordinal(rangeStart) && ord <= ordinal(rangeEnd);
}

// Khoá đối chiếu App HS cho card UNCOMPLETED: chỉ cần DD/MM (App không hiện năm) - đủ phân biệt
// vì range hợp lệ rộng nhất (1 tháng đối xứng, tối đa ~62 ngày) không đủ để 2 mốc DD/MM trùng
// nhau thuộc 2 năm khác nhau CÙNG lúc nằm trong phạm vi quan tâm.
function appDueDateKeyFragment(card, today) {
  if (!card.dueDateText) return null;
  if (DUE_DATE_TODAY_PATTERN.test(card.dueDateText)) return formatDM(today);
  const m = card.dueDateText.match(DUE_DATE_DIGIT_PATTERN);
  if (!m) return null;
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  return `${dd}/${mm}`;
}

// ---- Web GV: dataset + score lookup (plain fetch, tái dùng config.js - KHÔNG cần Playwright,
// đã xác nhận hoạt động qua getHomeworks()/fetchAllHomeworkRooms() sẵn có) ----
async function fetchWebGvDataset(period) {
  requireTeacherPortalConfig();
  const rawRooms = await fetchAllHomeworkRooms({ period });
  const inClass = rawRooms.filter((r) => (r.room?.class_ids ?? []).includes(TARGET_CLASS_ID));
  return inClass.map((raw) => {
    const homework = normalizeHomework(raw);
    const status = resolveMyStatus(homework, TARGET_STUDENT_ID);
    return {
      id: homework.id,
      title: homework.title,
      startTimeIso: homework.deadline.startTime,
      endTimeIso: homework.deadline.endTime,
      status, // "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"
      type: homework.type, // "exercise" | "role_play" - xem BLOCKED_ROLE_PLAY_NOT_COLLECTED
    };
  });
}

const roomAnalyticScoreCache = new Map();

/** score theo thang 0-10 khớp "Điểm N" trên App HS - KHÔNG dùng room.answers[].point/total_point
 *  (thang khác, đã xác nhận thật lệch nhau - xem docblock đầu file). Trả về:
 *  - number: có điểm
 *  - null: học sinh nằm trong "not_submitted" (chưa nộp) - mâu thuẫn với status COMPLETED suy từ
 *    room.answers, caller phải coi là BLOCKED (dữ liệu 2 nguồn Web GV lệch nhau, không đoán)
 *  - undefined: học sinh không xuất hiện ở CẢ 2 danh sách (không xác định được) */
async function fetchRoomAnalyticScore(roomId) {
  if (roomAnalyticScoreCache.has(roomId)) return roomAnalyticScoreCache.get(roomId);
  const url = `${config.teacherPortalBaseUrl}/api/user/report-stats/room-analytic?room_id=${encodeURIComponent(roomId)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${config.teacherAccessToken}` } });
  if (!res.ok) throw new Error(`GET ${url} trả về status ${res.status}`);
  const body = await res.json();
  const submitted = (body.submitted ?? []).find((s) => s.id === TARGET_STUDENT_ID);
  const result = submitted ? submitted.score : (body.not_submitted ?? []).some((s) => s.id === TARGET_STUDENT_ID) ? null : undefined;
  roomAnalyticScoreCache.set(roomId, result);
  return result;
}

// ---- Điều hướng App HS (viết lại theo đúng logic đã verify PASS của hw03, không đổi hành vi
// - xem hw03-verify-filter-dates.js#openHomeworkTabAtDefaultFilter/switchFilterToOneMonth) ----
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
`.trim(),
  );
}

function switchFilterToOneMonth() {
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
`.trim(),
  );
}

// ---- Matching + verdict ----

/**
 * Group 1 danh sách theo keyFn, trả về Map key -> items[].
 */
function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (key === null || key === undefined) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

/**
 * Với 1 nhóm assignment Web GV cùng khoá match (title+dueDate hoặc title+score), quyết định:
 *  - nếu TẤT CẢ cùng expectedVisible (mọi start_time cùng trong range hoặc cùng ngoài range):
 *    verify được ở mức GROUP/COUNT - trả {ambiguous:false, expectedVisible, expectedCount}
 *  - nếu KHÔNG (có room trong range VÀ có room ngoài range cùng khoá) -> ambiguous:true, không
 *    đoán assignment nào ứng với card nào (đúng mục 11 yêu cầu).
 */
function evaluateGroupVisibility(group, rangeStart, rangeEnd) {
  const flags = group.map((a) => inRange(isoToVnYmd(a.startTimeIso), rangeStart, rangeEnd));
  const allIn = flags.every(Boolean);
  const allOut = flags.every((f) => !f);
  if (allIn || allOut) return { ambiguous: false, expectedVisible: allIn, expectedCount: allIn ? group.length : 0 };
  return { ambiguous: true, expectedVisible: null, expectedCount: null };
}

/**
 * Chỉ bật early-stop khi ENV TARGET_HOMEWORK_TITLE + TARGET_DUE_DATE_DM ĐỀU được set VÀ dataset
 * Web GV của ĐÚNG period đang xét có ít nhất 1 assignment khớp khoá đó - nếu period này không có
 * (vd target chỉ nằm trong phạm vi MONTH chứ không phải WEEK) thì trả về null, giữ hành vi cuộn
 * hết danh sách như cũ cho period đó (an toàn, không bỏ sót vì lý do sai period).
 */
function buildTargetMatchConfig(webUncompletedGroups, today) {
  if (!TARGET_HOMEWORK_TITLE || !TARGET_DUE_DATE_DM) return null;
  const key = `${TARGET_HOMEWORK_TITLE}|${TARGET_DUE_DATE_DM}`;
  const group = webUncompletedGroups.get(key);
  if (!group || group.length === 0) return null;
  return {
    key,
    expectedCount: group.length,
    keyFn: (card) => (card.completed || !card.dueDateText ? null : `${card.title}|${appDueDateKeyFragment(card, today)}`),
  };
}

async function runFilterCheck(period, filterLabel) {
  const { today, rangeStart, rangeEnd } = computeRange(period);

  console.log(`Lấy dataset Web GV (period=${period}, lớp=${TARGET_CLASS_ID})...`);
  const webGvAll = await fetchWebGvDataset(period);
  const webGvUncompleted = webGvAll.filter((a) => a.status !== "COMPLETED");
  const webGvCompletedCandidates = webGvAll.filter((a) => a.status === "COMPLETED");

  // ---- UNCOMPLETED groups: tính TRƯỚC khi thu thập App HS (cần để build target early-stop) ----
  const webUncompletedGroups = groupBy(webGvUncompleted, (a) => `${a.title}|${formatDM(isoToVnYmd(a.endTimeIso))}`);
  const targetMatch = buildTargetMatchConfig(webUncompletedGroups, today);
  if (targetMatch) {
    console.log(
      `Target early-stop BẬT cho period=${period}: khoá "${targetMatch.key}" kỳ vọng ${targetMatch.expectedCount} card App HS - sẽ dừng cuộn ngay khi đủ, không cuộn hết danh sách.`,
    );
  }

  console.log(`Cuộn về đầu + đọc hierarchy App HS (${filterLabel})...`);
  const { cards, emptyStateSeen, stopReason, scrollCount } = collectAllVisibleHomeworkCards({ targetMatch });
  const appUncompleted = cards.filter((c) => !c.completed);
  const appCompleted = cards.filter((c) => c.completed);

  // scanQuality quyết định NHỮNG GÌ được phép đánh giá PASS/FAIL bên dưới:
  //  - FULL_SCAN: đã cuộn tới hết danh sách thật (noNewStreak>=2) -> tin tưởng mọi khoá.
  //  - TARGET_ONLY: dừng SỚM CÓ CHỦ ĐÍCH vì đã đủ bằng chứng cho đúng 1 khoá target -> CHỈ đánh
  //    giá khoá đó, các khoá khác trong dataset kỳ này coi như CHƯA quét (bỏ qua, không FAIL giả).
  //  - INCOMPLETE: dừng SỚM NGOÀI Ý MUỐN (chạm MAX_SCROLLS hoặc hard timeout trước khi đủ target
  //    hoặc trước khi hết danh sách) -> không tin tưởng khoá nào, report BLOCKED_COLLECTION_INCOMPLETE.
  const scanQuality = stopReason === "NO_NEW_CARDS" ? "FULL_SCAN" : stopReason === "TARGET_REACHED" ? "TARGET_ONLY" : "INCOMPLETE";

  const findings = []; // 1 phần tử / assignment hoặc / group, ghi vào report cuối

  if (webGvAll.length === 0) {
    findings.push({
      scope: "DATASET",
      verdict: "BLOCKED_EMPTY_GV_DATASET",
      note: `Web GV không có assignment nào cho lớp ${TARGET_CLASS_ID} ở period=${period} - không tự cho App HS PASS.`,
    });
  }

  if (scanQuality === "INCOMPLETE") {
    findings.push({
      scope: "COLLECTION",
      verdict: "BLOCKED_COLLECTION_INCOMPLETE",
      note: `Dừng thu thập App HS SỚM NGOÀI Ý MUỐN sau ${scrollCount} lượt cuộn (lý do: ${stopReason}) - chưa cuộn hết danh sách và chưa đủ bằng chứng cho target (nếu có). KHÔNG kết luận FAIL từ dữ liệu này; cần chạy lại (có thể cần tăng COLLECTION_HARD_TIMEOUT_MS hoặc thu hẹp phạm vi bằng TARGET_HOMEWORK_TITLE/TARGET_DUE_DATE_DM).`,
    });
  } else if (scanQuality === "TARGET_ONLY") {
    console.log(
      `Đã dừng cuộn sớm CÓ CHỦ ĐÍCH (đủ bằng chứng cho khoá target "${targetMatch.key}") - CHỈ đánh giá khoá này, bỏ qua các khoá/group khác trong dataset period=${period} vì App HS chưa được quét hết cho chúng.`,
    );
  }

  // ---- UNCOMPLETED: match theo (title, DD/MM Hạn nộp giờ VN) ----
  // Khi scanQuality=INCOMPLETE: bỏ qua toàn bộ đánh giá nhóm (đã có finding BLOCKED_COLLECTION_INCOMPLETE ở trên).
  // Khi scanQuality=TARGET_ONLY: CHỈ đánh giá đúng khoá target, các khoá khác bỏ qua (xem log trên).
  if (scanQuality !== "INCOMPLETE") {
    const appUncompletedNoDueDate = appUncompleted.filter((c) => !c.dueDateText);
    for (const card of appUncompletedNoDueDate) {
      if (scanQuality === "TARGET_ONLY" && card.title !== TARGET_HOMEWORK_TITLE) continue;
      findings.push({
        scope: "APP_CARD",
        title: card.title,
        completed: false,
        verdict: "BLOCKED_NO_DUE_DATE",
        note: "Card uncompleted nhưng không đọc được Hạn nộp trong lookahead - không dùng làm khoá match.",
      });
    }
    const appUncompletedByKey = groupBy(
      appUncompleted.filter((c) => c.dueDateText),
      (c) => `${c.title}|${appDueDateKeyFragment(c, today)}`,
    );
    const uncompletedKeys = new Set([...webUncompletedGroups.keys(), ...appUncompletedByKey.keys()]);
    for (const key of uncompletedKeys) {
      if (scanQuality === "TARGET_ONLY" && key !== targetMatch.key) continue;
      const webGroup = webUncompletedGroups.get(key) ?? [];
      const appGroup = appUncompletedByKey.get(key) ?? [];
      findings.push(...evaluateMatchedGroup(key, webGroup, appGroup, rangeStart, rangeEnd, "title+Hạn nộp(DD/MM)", "uncompleted"));
    }
  }

  // ---- COMPLETED: match theo (title, score qua room-analytic - chỉ gọi cho candidate cùng title) ----
  // Target early-stop chỉ áp dụng cho uncompleted (khoá theo Hạn nộp) - nên khi scanQuality !=
  // FULL_SCAN, KHÔNG có cơ sở nào để tin group completed đã được quét đủ -> bỏ qua hoàn toàn,
  // tránh gọi report-stats/room-analytic tốn kém cho dữ liệu chưa chắc đầy đủ.
  if (scanQuality === "FULL_SCAN") {
    const webCompletedByTitle = groupBy(webGvCompletedCandidates, (a) => a.title);
    const appCompletedNoScore = appCompleted.filter((c) => !c.scoreText);
    for (const card of appCompletedNoScore) {
      findings.push({
        scope: "APP_CARD",
        title: card.title,
        completed: true,
        verdict: "BLOCKED_NO_SCORE",
        note: "Card completed nhưng không đọc được 'Điểm N' trong lookahead - không dùng làm khoá match.",
      });
    }

    // Gán score Web GV cho từng candidate completed (chỉ những title xuất hiện ở ≥1 card completed).
    const titlesNeedingScore = new Set(appCompleted.filter((c) => c.scoreText).map((c) => c.title));
    const webCompletedWithScore = [];
    for (const title of titlesNeedingScore) {
      const candidates = webCompletedByTitle.get(title) ?? [];
      for (const a of candidates) {
        const score = await fetchRoomAnalyticScore(a.id);
        if (score === undefined) {
          findings.push({
            scope: "ASSIGNMENT",
            roomId: a.id,
            title: a.title,
            verdict: "BLOCKED_STUDENT_NOT_FOUND_IN_REPORT",
            note: `room-analytic không có học sinh ${TARGET_STUDENT_ID} ở cả submitted/not_submitted - dữ liệu 2 nguồn (room.answers vs report) không khớp, không đoán.`,
          });
          continue;
        }
        if (score === null) {
          findings.push({
            scope: "ASSIGNMENT",
            roomId: a.id,
            title: a.title,
            verdict: "BLOCKED_STATUS_MISMATCH",
            note: "room.answers cho thấy status=done nhưng room-analytic lại xếp học sinh vào not_submitted - dữ liệu 2 nguồn lệch nhau, không đoán.",
          });
          continue;
        }
        webCompletedWithScore.push({ ...a, score });
      }
    }
    const webCompletedByKey = groupBy(webCompletedWithScore, (a) => `${a.title}|${a.score}`);
    const appCompletedByKey = groupBy(
      appCompleted.filter((c) => c.scoreText),
      (c) => `${c.title}|${Number(String(c.scoreText.match(SCORE_PATTERN)[1]).replace(",", "."))}`,
    );
    const completedKeys = new Set([...webCompletedByKey.keys(), ...appCompletedByKey.keys()]);
    for (const key of completedKeys) {
      const webGroup = webCompletedByKey.get(key) ?? [];
      const appGroup = appCompletedByKey.get(key) ?? [];
      findings.push(...evaluateMatchedGroup(key, webGroup, appGroup, rangeStart, rangeEnd, "title+score", "completed"));
    }
  }

  // Role-play / card không có N/M: không thể thu thập bằng parser hiện tại - ghi nhận số lượng bị
  // loại (dò qua hierarchy thô, KHÔNG đoán nội dung) để không âm thầm bỏ qua.
  // (Không đếm chính xác được không có parser riêng cho loại này - ghi rõ giới hạn trong report.)

  const severity = { PASS: 0, FAIL: 1, BLOCKED: 2 };
  const toSeverityBucket = (verdict) => (verdict === "PASS" ? "PASS" : verdict === "FAIL" ? "FAIL" : "BLOCKED");
  let status;
  if (findings.length === 0) {
    status = emptyStateSeen ? "PASS" : "BLOCKED";
  } else {
    status = findings.reduce((acc, f) => {
      const bucket = toSeverityBucket(f.verdict);
      return severity[bucket] > severity[acc] ? bucket : acc;
    }, "PASS");
  }

  return {
    period,
    filterLabel,
    today,
    rangeStart,
    rangeEnd,
    webGvDatasetCount: webGvAll.length,
    appCardCount: cards.length,
    completedCardCount: appCompleted.length,
    uncompletedCardCount: appUncompleted.length,
    emptyStateSeen,
    stopReason,
    scrollCount,
    scanQuality,
    targetKey: targetMatch?.key ?? null,
    findings,
    status,
  };
}

/**
 * Đánh giá 1 group đã match theo khoá (title+dueDate hoặc title+score) - so số lượng room Web
 * GV kỳ vọng hiển thị (theo start_time) với số lượng card App HS thực tế cùng khoá.
 */
function evaluateMatchedGroup(key, webGroup, appGroup, rangeStart, rangeEnd, matchMethod, cardType) {
  const findings = [];
  if (webGroup.length === 0 && appGroup.length > 0) {
    findings.push({
      scope: "APP_CARD",
      key,
      matchMethod,
      cardType,
      verdict: "BLOCKED_UNMATCHED_APP_CARD",
      note: `${appGroup.length} card App HS khớp khoá "${key}" nhưng KHÔNG có assignment Web GV nào cùng khoá trong dataset (lớp/period đang xét) - không đoán, có thể do sai lớp/loại assignment ngoài phạm vi dataset.`,
    });
    return findings;
  }
  if (webGroup.length === 0) return findings;

  // Card role-play (room.type === "role_play", CTA thật "Chinh phục") KHÔNG có dòng "N / M" -
  // bất biến định vị card của parser (title = dòng ngay trước N/M) không áp dụng được, nên
  // parser KHÔNG BAO GIỜ thu thập được loại card này dù App có hiển thị đúng hay không (đã xác
  // nhận thật qua hierarchy dump 2026-08-11: "Trò chuyện cùng Parrot: ..." không có N/M). Nếu
  // im lặng coi "0 card thu thập được" = "App không hiển thị" sẽ ra FAIL giả cho MỌI role-play
  // item còn hạn - phải tách riêng thành BLOCKED thông tin, không đánh PASS/FAIL.
  if (webGroup.every((a) => a.type === "role_play")) {
    findings.push({
      scope: "ASSIGNMENT_GROUP",
      key,
      matchMethod,
      cardType,
      verdict: "BLOCKED_ROLE_PLAY_NOT_COLLECTED",
      assignments: webGroup.map((a) => ({ roomId: a.id, title: a.title, startTime: a.startTimeIso, endTime: a.endTimeIso })),
      actualCardCount: appGroup.length,
      note: "room.type=role_play - parser hierarchy không thu thập được loại card này (không có dòng N/M) nên KHÔNG thể verify PASS/FAIL, không phải App đang ẩn/hiện sai.",
    });
    return findings;
  }

  const { ambiguous, expectedVisible, expectedCount } = evaluateGroupVisibility(webGroup, rangeStart, rangeEnd);

  if (ambiguous) {
    findings.push({
      scope: "ASSIGNMENT_GROUP",
      key,
      matchMethod,
      cardType,
      verdict: "BLOCKED_AMBIGUOUS_MATCH",
      assignments: webGroup.map((a) => ({
        roomId: a.id,
        title: a.title,
        startTime: a.startTimeIso,
        endTime: a.endTimeIso,
        expectedVisible: inRange(isoToVnYmd(a.startTimeIso), rangeStart, rangeEnd),
      })),
      actualCardCount: appGroup.length,
      note: `${webGroup.length} assignment cùng khoá "${key}" nhưng start_time rơi 2 phía biên khác nhau - App HS chỉ có ${appGroup.length} card giống hệt text, không thể xác định card nào ứng assignment nào.`,
    });
    return findings;
  }

  const actualCount = appGroup.length;
  const verdict = actualCount === expectedCount ? "PASS" : "FAIL";
  findings.push({
    scope: "ASSIGNMENT_GROUP",
    key,
    matchMethod,
    cardType,
    verdict,
    assignments: webGroup.map((a) => ({ roomId: a.id, title: a.title, startTime: a.startTimeIso, endTime: a.endTimeIso })),
    expectedVisible,
    expectedCount,
    actualCardCount: actualCount,
    note:
      verdict === "PASS"
        ? `Khớp: kỳ vọng ${expectedCount} card hiển thị, App HS có ${actualCount}.`
        : `SAI: kỳ vọng ${expectedCount} card hiển thị (expectedVisible=${expectedVisible}) nhưng App HS có ${actualCount}.`,
  });
  return findings;
}

function printReport(sectionLabel, r) {
  console.log(`\n[FILTER: ${sectionLabel}]`);
  console.log(`Filter: ${r.filterLabel}`);
  console.log(`Ngày chạy (giờ VN): ${formatDMY(r.today)}`);
  console.log(`Range: ${formatDMY(r.rangeStart)} -> ${formatDMY(r.rangeEnd)}`);
  console.log(`Web GV dataset count (lớp ${TARGET_CLASS_ID}): ${r.webGvDatasetCount}`);
  console.log(`App HS card count: ${r.appCardCount} (completed=${r.completedCardCount}, uncompleted=${r.uncompletedCardCount})`);
  console.log(
    `Thu thập: ${r.scrollCount} lượt cuộn, dừng vì ${r.stopReason} (scanQuality=${r.scanQuality}${r.targetKey ? `, target="${r.targetKey}"` : ""})`,
  );
  console.log(`Findings: ${r.findings.length}`);
  for (const f of r.findings) {
    console.log(`  - [${f.verdict}] ${f.scope} ${f.key ?? f.title ?? ""} — ${f.note ?? ""}`);
  }
  console.log(`Kết quả filter: ${r.status}`);
}

async function main() {
  openHomeworkTabAtDefaultFilter();
  const weekResult = await runFilterCheck("WEEK", "2 tuần gần nhất");
  printReport("2 tuần gần nhất", weekResult);

  switchFilterToOneMonth();
  const monthResult = await runFilterCheck("MONTH", "1 tháng gần nhất");
  printReport("1 tháng gần nhất", monthResult);

  const severity = { PASS: 0, FAIL: 1, BLOCKED: 2 };
  const overall = severity[weekResult.status] >= severity[monthResult.status] ? weekResult.status : monthResult.status;

  console.log(`\nOVERALL (2 tuần + 1 tháng): ${overall}`);

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(
    OUTPUT_FILE,
    JSON.stringify({ targetClassId: TARGET_CLASS_ID, targetStudentId: TARGET_STUDENT_ID, week: weekResult, month: monthResult, overall }, null, 2),
    "utf8",
  );
  console.log(`Đã ghi report ra ${OUTPUT_FILE}`);

  process.exit(overall === "PASS" ? 0 : overall === "FAIL" ? 1 : 2);
}

// Chỉ tự chạy main() khi file này được gọi trực tiếp (`node verify-filter-web-vs-app.mjs`) -
// cho phép import các hàm thuần (parser/date-math/matching) từ file khác (vd script test) mà
// không vô tình kích hoạt điều khiển thiết bị/API thật.
// LƯU Ý: so `fileURLToPath(import.meta.url)` với `process.argv[1]` (KHÔNG so chuỗi
// `file://${process.argv[1]}` trực tiếp với `import.meta.url`) - đường dẫn repo có dấu cách
// ("Autotest app Parrot") nên `import.meta.url` mã hoá thành "%20" còn `process.argv[1]` thì
// không, so chuỗi thô sẽ luôn SAI (đã tự bắt được bug này lúc chạy thật: script thoát code 0
// sau 0.04s, không log gì, không chạy main() - export guard so sai điều kiện).
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error("\n[verify-filter-web-vs-app] Dừng lại vì lỗi ngoài dự kiến:\n");
    console.error(err);
    process.exit(2);
  });
}

export {
  parseHomeworkCardsFromEntries,
  cardsFromTree,
  cardSignature,
  mergeWithBoundedOverlap,
  isoToVnYmd,
  nowVnYmd,
  computeRange,
  inRange,
  formatDM,
  formatDMY,
  appDueDateKeyFragment,
  evaluateGroupVisibility,
  evaluateMatchedGroup,
  groupBy,
  // Debug-only (điều khiển thiết bị thật khi CALL, nhưng import không tự chạy gì - xem guard
  // fileURLToPath ở trên) - dùng cho script debug collector riêng, xem
  // scratchpad/debug-collector.mjs.
  openHomeworkTabAtDefaultFilter,
  switchFilterToOneMonth,
  collectAllVisibleHomeworkCards,
  TARGET_LOOKUP_MAX_SCROLLS,
  TARGET_LOOKUP_MAX_STALL_RETRIES,
  readHomeworkHierarchyOnce,
};
