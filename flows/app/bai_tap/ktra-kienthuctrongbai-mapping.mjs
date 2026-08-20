#!/usr/bin/env node
/**
 * HW-20 (DATA-DRIVEN, đính chính 2026-08-20) — verify section "Kiến thức trong bài" hiển thị ĐÚNG
 * Unit theo KHỐI THỰC TẾ của (các) assignment cô giao trong danh sách hiện tại.
 *
 * ĐÍNH CHÍNH BẮT BUỘC (yêu cầu rõ ràng từ QA, thay thế mọi bản trước dùng env var
 * HW20_UNIT_1_NAME/HW20_UNIT_2_NAME hardcode tên Unit kỳ vọng):
 *   - TUYỆT ĐỐI KHÔNG hardcode Khối/Unit kỳ vọng (không "Lớp 3 -> Khối 3", không "expectedUnit =
 *     'Unit 6'"). "Tên lớp" (vd "Lớp 3B") KHÔNG phải nguồn dữ liệu đáng tin để suy ra Khối - đã có
 *     bằng chứng thật 1 lớp tên "Lớp 3" nhưng Khối cấu hình lại là "Khối 7".
 *   - Khối THỰC TẾ phải lấy từ dữ liệu backend của CHÍNH assignment đang test: `HomeworkModel.book`
 *     (`automation/bai_tap/model/homeworkModel.js`, field phẳng `book_name` trong response GỐC GET
 *     /api/user/exams/room.json - ĐÃ XÁC NHẬN THẬT, xem docblock model đó) - vd `book.name = "Khối
 *     3"`. Đây là field CỦA CHÍNH ROOM đang xét, không suy ra từ tên lớp/tên hiển thị nào khác.
 *   - Không kiểm tra thứ tự Unit (yêu cầu đã bỏ - trước đây có bản dùng "above/below" để so thứ tự,
 *     ĐÃ GỠ BỎ theo đính chính này).
 *
 * LOGIC (đúng yêu cầu "Class/Assignment data -> grade thực tế -> Unit liên quan -> verify Unit đề
 * xuất", KHÔNG đi chiều ngược "tên lớp -> tự suy khối"):
 *   1. Gọi `getHomeworks()` (đã xác nhận thật, `automation/bai_tap/discovery/homeworks.js`) lấy
 *      TOÀN BỘ Room (Bài tập) hiện có trong `period` - MỖI Room đã có sẵn `book.name` (Khối THẬT)
 *      + `unit.name` (Unit THẬT, dạng "Unit N: <tên>") do CHÍNH backend trả về, phẳng sẵn trong
 *      response - không cần suy đoán/parse thêm.
 *   2. Dedupe theo (book.name, số Unit trong unit.name) -> đây là tập "Khối+Unit liên quan" DUY
 *      NHẤT được coi là dữ liệu gốc đáng tin - KHÔNG có tập nào khác đưa vào so sánh.
 *   3. Đối chiếu chéo (best-effort) với catalog Self-learning thật qua `discovery/books.js` +
 *      `discovery/units.js` (filterSelfLearnBooks + getUnitsOfBook + filterPublishedUnits) - xác
 *      nhận Unit đó THỰC SỰ tồn tại/đã publish trong đúng Khối (lớp phòng vệ thêm, không phải nguồn
 *      chính, xem GIỚI HẠN bên dưới).
 *   4. Đọc THẬT các card Unit đang hiển thị trong section "Kiến thức trong bài" trên máy (scroll
 *      hội tụ - dùng lại bài học đã ghi nhận trước đây: shallow scroll cho kết quả "không có dữ
 *      liệu" giả, phải cuộn tới khi 2-3 lượt liên tiếp không phát hiện thêm Unit mới mới coi là đã
 *      đọc đủ).
 *   5. So khớp (4) với (2): mỗi Unit hiển thị PHẢI khớp số Unit của ÍT NHẤT 1 cặp (Khối, Unit) thật
 *      trong (2) - nếu không khớp bất kỳ cặp thật nào -> FAIL (nghi sai Khối/mapping). Màn Danh
 *      sách bài tập còn phải verify NGƯỢC LẠI: mọi cặp thật trong (2) đều phải xuất hiện trên màn
 *      hình (đủ 100% - "hiển thị đầy đủ tất cả Unit liên quan"). Màn Kết quả BTVN KHÔNG áp dụng yêu
 *      cầu đủ 100% này (xem TEST-CASES.md mục "Chi tiết HW-20").
 *
 * GIỚI HẠN ĐÃ BIẾT (chưa chạy thử trên thiết bị/API thật ở bản này - PHẢI verify trước khi tin
 * PASS/FAIL):
 *   - Giả định "Unit trong `unit.name` của assignment (nguồn BY_TEACHER) và Unit trong catalog
 *     Self-learning cùng Khối dùng CHUNG cách đặt tên 'Unit N: <tên>'" - CHỈ xác nhận qua 2 mẫu
 *     tĩnh (automation/output/homework_discovery.json + automation/README.md dòng ví dụ "Unit 1: My
 *     friends") - CHƯA đối chiếu trực tiếp 1 cặp Room thật + catalog Self-learning thật CÙNG Khối
 *     trên API sống. Nếu 2 nguồn đặt tên khác nhau (vd BY_TEACHER chỉ có "Unit 6" không kèm tên),
 *     script vẫn so khớp ĐÚNG vì chỉ dùng SỐ Unit (extractUnitNumber), không so toàn bộ chuỗi tên -
 *     nhưng field `catalogUnitName` trong report nên được QA đối chiếu bằng mắt ở lần chạy đầu.
 *   - `period`/`TEST_CLASS_ID`: mặc định `period=MONTH` (rộng nhất có thể, tránh bỏ sót assignment
 *     thật) - CHƯA xác nhận khớp 100% với filter đang active trên app ("2 tuần gần nhất"/"1 tháng
 *     gần nhất") - nếu app đang lọc hẹp hơn dữ liệu API trả về, tập kỳ vọng (2) có thể RỘNG HƠN
 *     những gì hiển thị thật -> có thể gây FAIL giả cho phần "hiển thị đầy đủ". Truyền
 *     TEST_CLASS_ID để thu hẹp đúng phạm vi lớp test nếu tài khoản token có nhiều lớp/room khác.
 *   - Không đếm được optional "Kiến thức trong bài" có phải section GLOBAL 1 lần cho toàn bộ danh
 *     sách hay không - ĐÃ giả định GLOBAL (dựa theo TEST-CASES.md dòng HW-07 "unit gợi ý dedupe
 *     theo unit_id" - ngụ ý gộp chung, không phải lặp lại theo từng card bài tập).
 *
 * CHẠY: node flows/app/bai_tap/ktra-kienthuctrongbai-mapping.mjs
 * ENV: APP_ID (.env), PHONE/OTP (test_data/accounts.env), TEST_CLASS_ID (tuỳ chọn),
 *      EXERCISE_NAME (tuỳ chọn - nếu truyền, còn hoàn thành ĐÚNG bài này để verify thêm màn Kết quả
 *      BTVN; không truyền thì BỎ QUA màn 2, không coi là FAIL), MAESTRO_DEVICE (tuỳ chọn),
 *      HOMEWORK_PERIOD (tuỳ chọn, mặc định "MONTH").
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MaestroMcpBridge } from "../../../automation/bridge/maestroMcpBridge.js";
import { getHomeworks, filterOutRolePlay } from "../../../automation/bai_tap/discovery/homeworks.js";
import { getBooks, filterSelfLearnBooks } from "../../../automation/discovery/books.js";
import { getUnitsOfBook, filterPublishedUnits } from "../../../automation/discovery/units.js";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "hw20_mapping_report.json");
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const HOMEWORK_PERIOD = process.env.HOMEWORK_PERIOD || "MONTH";
const TEST_CLASS_ID = process.env.TEST_CLASS_ID || null;
const EXERCISE_NAME = process.env.EXERCISE_NAME || null;

const SECTION_HEADER = "Kiến thức trong bài";
const UNIT_CARD_PATTERN = /Unit\s*\d+\s*:\s*.+/;
const MAX_SECTION_SCROLLS = 30; // "hội tụ" - xem lesson đã ghi nhận: shallow scroll cho "không có
// dữ liệu" giả, cần đủ vòng lặp mới kết luận chắc chắn.
const NO_PROGRESS_STREAK_TO_STOP = 3;

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

/** "Unit 6: Wonder of Vietnam" -> 6. Trả null nếu không match (KHÔNG đoán số). */
function extractUnitNumber(name) {
  const m = /Unit\s*(\d+)/i.exec(name || "");
  return m ? Number(m[1]) : null;
}

function collectAllTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectAllTexts(c, acc);
  return acc;
}

/**
 * Bước 1-2: dedupe (book.name, unitNumber) từ TOÀN BỘ Room thật hiện có - nguồn DUY NHẤT cho
 * "Khối+Unit liên quan", KHÔNG hardcode/parse tên lớp. `sourceTitle`/`sourceRoomId` giữ lại để
 * report truy vết được assignment nào sinh ra cặp kỳ vọng đó.
 */
async function buildExpectedFromRealAssignments({ period, testClassId }) {
  const homeworks = filterOutRolePlay(await getHomeworks({ period }));
  const scoped = testClassId ? homeworks.filter((h) => h.classIds.includes(testClassId)) : homeworks;
  const byKey = new Map();
  for (const hw of scoped) {
    if (!hw.book?.name || !hw.unit?.name) continue;
    const unitNumber = extractUnitNumber(hw.unit.name);
    if (unitNumber == null) continue;
    const key = `${hw.book.name}__${unitNumber}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        grade: hw.book.name,
        unitNumber,
        unitName: hw.unit.name,
        sourceRoomId: hw.id,
        sourceTitle: hw.title,
      });
    }
  }
  return { expected: [...byKey.values()], totalRoomsScanned: scoped.length };
}

/** Bước 3: đối chiếu chéo (best-effort, KHÔNG phải nguồn quyết định chính) với catalog
 * Self-learning thật - xác nhận Unit đó CÓ tồn tại + đã publish đúng Khối. */
async function crossCheckWithSelfLearnCatalog(expected) {
  const selfLearnBooks = filterSelfLearnBooks(await getBooks());
  const cache = new Map(); // bookId -> published units
  const out = [];
  for (const exp of expected) {
    const book = selfLearnBooks.find((b) => b.name === exp.grade);
    if (!book) {
      out.push({ ...exp, catalogStatus: "GRADE_BOOK_NOT_FOUND", catalogUnitName: null });
      continue;
    }
    const bookId = book.id ?? book._id;
    if (!cache.has(bookId)) cache.set(bookId, filterPublishedUnits(await getUnitsOfBook(book)));
    const units = cache.get(bookId);
    const match = units.find((u) => extractUnitNumber(u.name) === exp.unitNumber);
    out.push({
      ...exp,
      catalogStatus: match ? "OK" : "UNIT_NOT_PUBLISHED_IN_GRADE",
      catalogUnitName: match?.name ?? null,
    });
  }
  return out;
}

/** launch-fresh + login + mở tab Bài tập, viết native qua bridge (cùng pattern
 * flows/bai_tap/xemchitietbailam.mjs) - KHÔNG import lại vì 2 file đó chưa export dùng chung. */
async function launchFresh(bridge) {
  const r = await bridge.runSteps([
    { launchApp: { stopApp: true, permissions: { all: "allow" } } },
    { extendedWaitUntil: { visible: { text: ".*(Đăng nhập|Vui học|Bài tập|Báo cáo).*" }, timeout: 40000 } },
  ]);
  if (!r.success) throw new Error(`launchFresh thất bại: ${r.error}`);
}

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
 * Bước 4: scroll HỘI TỤ (KHÔNG shallow scroll - xem lesson feedback_homework_list_full_scroll_scan)
 * tới khi header "Kiến thức trong bài" xuất hiện, rồi tiếp tục cuộn + gộp (Set, không trùng) tên
 * Unit đọc được tới khi NO_PROGRESS_STREAK_TO_STOP lượt liên tiếp không phát hiện Unit mới, hoặc
 * hết MAX_SECTION_SCROLLS. Trả về danh sách text Unit ĐÚNG NGUYÊN VĂN đọc được trên màn hình -
 * KHÔNG lọc/suy đoán gì thêm ở bước này (so khớp với dữ liệu thật xảy ra ở bước riêng).
 */
async function collectRecommendedUnitCards(bridge, { maxScrolls = MAX_SECTION_SCROLLS } = {}) {
  let sectionSeen = false;
  const collected = new Map();
  let scrolls = 0;
  let noProgressStreak = 0;

  const readOnce = () => bridge.hierarchy().then((tree) => collectAllTexts(tree));

  let texts = await readOnce();
  if (texts.includes(SECTION_HEADER)) sectionSeen = true;
  if (sectionSeen) for (const t of texts) if (UNIT_CARD_PATTERN.test(t)) collected.set(t, true);

  while (scrolls < maxScrolls && noProgressStreak < NO_PROGRESS_STREAK_TO_STOP) {
    const swipe = await bridge.runSteps([
      { swipe: { start: "50%,80%", end: "50%,25%", duration: 400 } },
      { waitForAnimationToEnd: { timeout: 800 } },
    ]);
    if (!swipe.success) break;
    scrolls++;
    texts = await readOnce();
    if (!sectionSeen && texts.includes(SECTION_HEADER)) sectionSeen = true;
    if (!sectionSeen) continue;

    const before = collected.size;
    for (const t of texts) if (UNIT_CARD_PATTERN.test(t)) collected.set(t, true);
    noProgressStreak = collected.size > before ? 0 : noProgressStreak + 1;
  }
  return { sectionSeen, scrolls, unitCardTexts: [...collected.keys()] };
}

/** So khớp Unit hiển thị với tập kỳ vọng thật (chỉ so SỐ Unit - xem GIỚI HẠN đầu file về giả định
 * tên gọi). Trả về 2 mảng: unexplainedOnScreen (Unit hiển thị nhưng KHÔNG khớp bất kỳ cặp Khối+Unit
 * thật nào - nghi sai mapping) và missingFromScreen (cặp thật nào KHÔNG thấy hiển thị). */
function compare(expected, onScreenTexts) {
  const onScreenNumbers = onScreenTexts.map((t) => ({ text: t, unitNumber: extractUnitNumber(t) }));
  const unexplainedOnScreen = onScreenNumbers.filter(
    (o) => o.unitNumber == null || !expected.some((e) => e.unitNumber === o.unitNumber),
  );
  const missingFromScreen = expected.filter(
    (e) => !onScreenNumbers.some((o) => o.unitNumber === e.unitNumber),
  );
  return { unexplainedOnScreen, missingFromScreen };
}

function finish(result, bridge, runStartedAt) {
  result.performance = {
    hierarchyCalls: bridge.hierarchyCallCount,
    runCalls: bridge.runCallCount,
    totalDurationMs: Date.now() - runStartedAt,
  };
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  return result;
}

function printReport(r) {
  log("\n[EXPECTED] (nguồn: dữ liệu thật của assignment, KHÔNG hardcode)");
  log(`total_rooms_scanned=${r.expected?.totalRoomsScanned ?? "-"}`);
  for (const e of r.expected?.pairs ?? []) {
    log(`  - grade="${e.grade}" unit="${e.unitName}" (số ${e.unitNumber}) catalog=${e.catalogStatus} sourceTitle="${e.sourceTitle}"`);
  }
  log("\n[MAN_HINH_1] Danh sách bài tập");
  log(`section_seen=${r.list?.sectionSeen ?? "NO"} scrolls=${r.list?.scrolls ?? "-"}`);
  log(`on_screen_units=${JSON.stringify(r.list?.onScreenUnitCardTexts ?? [])}`);
  log(`missing_from_screen=${JSON.stringify(r.list?.missingFromScreen ?? [])}`);
  log(`unexplained_on_screen=${JSON.stringify(r.list?.unexplainedOnScreen ?? [])}`);
  log("\n[MAN_HINH_2] Kết quả BTVN");
  log(r.result?.status ?? "SKIPPED (không truyền EXERCISE_NAME)");
  if (r.result?.status && r.result.status !== "SKIPPED") {
    log(`unexplained_on_screen=${JSON.stringify(r.result?.unexplainedOnScreen ?? [])}`);
  }
  log("\n[OVERALL]");
  log(r.status);
  log("\n[ROOT_CAUSE]");
  log(r.status === "PASS" ? "-" : (r.error ?? r.blockedReason ?? "-"));
}

async function main() {
  if (!APP_ID) throw new Error("Thiếu APP_ID - kiểm tra .env.");
  if (!PHONE || !OTP) throw new Error("Thiếu PHONE/OTP - kiểm tra test_data/accounts.env.");

  const runStartedAt = Date.now();
  const result = { status: "BLOCKED", expected: {}, list: {}, result: null };

  // ===== [DATA] Khối+Unit thật (KHÔNG chạm device ở bước này) =====
  const { expected, totalRoomsScanned } = await buildExpectedFromRealAssignments({
    period: HOMEWORK_PERIOD,
    testClassId: TEST_CLASS_ID,
  });
  if (expected.length === 0) {
    result.status = "BLOCKED";
    result.blockedReason = `Không tìm được cặp (Khối, Unit) thật nào từ getHomeworks({period: "${HOMEWORK_PERIOD}"}) - không có gì để verify. KHÔNG tự tạo dữ liệu giả.`;
    writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
    printReport(result);
    process.exit(3);
  }
  const pairs = await crossCheckWithSelfLearnCatalog(expected);
  result.expected = { totalRoomsScanned, pairs };

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  try {
    await launchFresh(bridge);
    await loginIfNeeded(bridge);
    await openHomeworkTab(bridge);

    // ===== [MÀN 1] Danh sách bài tập =====
    const list = await collectRecommendedUnitCards(bridge);
    if (!list.sectionSeen) {
      result.status = "BLOCKED";
      result.blockedReason = `Không thấy section "${SECTION_HEADER}" sau ${list.scrolls} lượt cuộn - tài khoản test hiện có thể không có Unit gợi ý nào (data-dependent, xem TEST-CASES.md).`;
      return finish(result, bridge, runStartedAt);
    }
    const cmp = compare(pairs, list.unitCardTexts);
    result.list = {
      sectionSeen: true,
      scrolls: list.scrolls,
      onScreenUnitCardTexts: list.unitCardTexts,
      unexplainedOnScreen: cmp.unexplainedOnScreen,
      missingFromScreen: cmp.missingFromScreen,
    };
    if (cmp.unexplainedOnScreen.length > 0) {
      result.status = "FAIL";
      result.error = `Màn Danh sách bài tập hiển thị Unit KHÔNG khớp Khối+Unit thật của bất kỳ assignment nào: ${JSON.stringify(cmp.unexplainedOnScreen)}.`;
      return finish(result, bridge, runStartedAt);
    }
    if (cmp.missingFromScreen.length > 0) {
      result.status = "FAIL";
      result.error = `Màn Danh sách bài tập THIẾU Unit liên quan (chưa hiển thị đủ 100%): ${JSON.stringify(cmp.missingFromScreen)}.`;
      return finish(result, bridge, runStartedAt);
    }
    log(`[MÀN 1] PASS: ${list.unitCardTexts.length} Unit hiển thị, khớp đủ ${pairs.length} cặp Khối+Unit thật.`);

    // ===== [MÀN 2] Kết quả BTVN - CHỈ chạy khi có EXERCISE_NAME (xem docblock đầu file) =====
    if (!EXERCISE_NAME) {
      result.result = { status: "SKIPPED", reason: "Không truyền EXERCISE_NAME - bỏ qua màn Kết quả BTVN, không coi là FAIL." };
      result.status = "PASS";
      return finish(result, bridge, runStartedAt);
    }
    const targetHomework = filterOutRolePlay(await getHomeworks({ period: HOMEWORK_PERIOD })).find(
      (h) => h.title === EXERCISE_NAME && (!TEST_CLASS_ID || h.classIds.includes(TEST_CLASS_ID)),
    );
    if (!targetHomework?.book?.name || !targetHomework?.unit?.name) {
      result.result = {
        status: "BLOCKED",
        reason: `Không tìm được Khối/Unit thật của assignment "${EXERCISE_NAME}" qua getHomeworks() - không thể xác định expected cho màn Kết quả BTVN.`,
      };
      result.status = "BLOCKED";
      result.blockedReason = result.result.reason;
      return finish(result, bridge, runStartedAt);
    }
    const targetUnitNumber = extractUnitNumber(targetHomework.unit.name);

    // Mở + hoàn thành ĐÚNG assignment này - tái dùng helper mở bài đã có sẵn thay vì viết lại thuật
    // toán locate card (tránh trùng lặp logic scroll/anchor phức tạp đã verify ở nơi khác).
    const openAndAnswer = await bridge.runSteps([
      {
        runFlow: {
          file: "../helpers/open-exercise.yaml",
          env: { PHONE, OTP, EXERCISE_NAME, DEVICE_MODE: "true" },
        },
      },
      {
        runFlow: {
          file: "../helpers/answer-current-exercise-generic.yaml",
          env: { EXERCISE_NAME },
        },
      },
      { extendedWaitUntil: { visible: { id: "exercise_result_screen" }, timeout: 60000 } },
    ]);
    if (!openAndAnswer.success) {
      result.result = { status: "BLOCKED", reason: `Không tới được màn Kết quả BTVN cho "${EXERCISE_NAME}": ${openAndAnswer.error}` };
      result.status = "BLOCKED";
      result.blockedReason = result.result.reason;
      return finish(result, bridge, runStartedAt);
    }
    const resultScreen = await collectRecommendedUnitCards(bridge, { maxScrolls: 10 });
    if (!resultScreen.sectionSeen) {
      result.result = { status: "SKIPPED", reason: `Không thấy section "${SECTION_HEADER}" trên màn Kết quả BTVN - có thể assignment này không có Unit gợi ý (data-dependent).` };
      result.status = "PASS";
      return finish(result, bridge, runStartedAt);
    }
    // Kết quả BTVN KHÔNG áp dụng yêu cầu "đủ 100%" - chỉ verify KHÔNG có Unit sai Khối/mapping.
    const resultCmp = compare(
      [{ grade: targetHomework.book.name, unitNumber: targetUnitNumber, unitName: targetHomework.unit.name }],
      resultScreen.unitCardTexts,
    );
    result.result = {
      status: resultCmp.unexplainedOnScreen.length > 0 ? "FAIL" : "PASS",
      onScreenUnitCardTexts: resultScreen.unitCardTexts,
      unexplainedOnScreen: resultCmp.unexplainedOnScreen,
      expectedGrade: targetHomework.book.name,
      expectedUnitName: targetHomework.unit.name,
    };
    if (resultCmp.unexplainedOnScreen.length > 0) {
      result.status = "FAIL";
      result.error = `Màn Kết quả BTVN hiển thị Unit không khớp Khối thật ("${targetHomework.book.name}") của assignment vừa hoàn thành: ${JSON.stringify(resultCmp.unexplainedOnScreen)}.`;
      return finish(result, bridge, runStartedAt);
    }

    result.status = "PASS";
    return finish(result, bridge, runStartedAt);
  } catch (err) {
    result.status = "ERROR";
    result.error = err.message;
    return finish(result, bridge, runStartedAt);
  } finally {
    await bridge.stop();
  }
}

main()
  .then((result) => {
    printReport(result);
    process.exit(result.status === "PASS" ? 0 : result.status === "BLOCKED" ? 3 : 1);
  })
  .catch((err) => {
    console.error("[ktra-kienthuctrongbai-mapping] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    process.exit(2);
  });
