#!/usr/bin/env node
/**
 * HW-21_22 — FREE + 403: sheet nâng cấp bài NÂNG CAO, rồi sheet nâng cấp LÀM LẠI.
 *
 * THAY THẾ flows/bai_tap/ktra_hthipopup_upgrade.yaml (giữ file .yaml đó lại để đối chiếu/rollback,
 * không xoá) - đổi sang kịch bản Node + MaestroMcpBridge vì file .yaml cũ có 2 vấn đề xác nhận thật
 * qua audit (2026-08-17), không phải suy đoán:
 *
 * 1. NGUY HIỂM AN TOÀN THẬT: file .yaml cũ dùng `scrollUntilVisible` với chính text CTA làm target
 *    (".*(Chinh phục).*" và ".*(Làm lại).*"). Đây là ĐÚNG pattern đã bị xác nhận lỗi thật trong
 *    chính repo này (xem flows/giao_bai_tap/e2e-teacher-assign-partial-resume-scored.mjs, comment
 *    scrollAndReadCardState/scrollToCard, 2026-08-17): "`scrollUntilVisible` nhắm ĐÚNG vào text nút
 *    bấm CÓ THỂ vô tình TAP luôn nút đó ở lượt cuộn cuối" - đã quan sát thật 1 lần scrollUntilVisible
 *    target "Làm bài" khiến màn hình CHUYỂN THẲNG vào màn làm bài dù không có tapOn nào. "Chinh
 *    phục"/"Làm lại" là CÙNG loại widget CTA (cùng component list card), rủi ro y hệt - không có lý
 *    do tin loại CTA này miễn nhiễm. File này KHÔNG bao giờ dùng text CTA làm target cuộn - chỉ dùng
 *    `swipe` thô (không target) hoặc `scrollUntilVisible` trên text KHÔNG tương tác (section header
 *    "Bài tập nâng cao", hoặc <title> bài - đều là label, không phải nút).
 *
 * 2. CLAIM SAI đã sửa: bản .yaml cũ (bản vá gần nhất) lọc "1 tháng gần nhất" với giả định sai là
 *    giúp rút ngắn danh sách. Đo THẬT qua API (GET /api/user/exams/room.json, 2026-08-17):
 *    period=WEEK (~"2 tuần") = 45 room / 22 title riêng / 6 nhóm trùng title; period=MONTH
 *    (~"1 tháng") = 142 room / 47 title riêng / 23 nhóm trùng title - MONTH nhiều hơn WEEK ~3.2x,
 *    KHÔNG giúp rút ngắn gì cả. File này KHÔNG đổi filter, giữ nguyên mặc định của app (đã xác nhận
 *    qua ảnh chụp thật là "2 tuần gần nhất" - tập dữ liệu nhỏ hơn).
 *
 * KHÔNG TỰ VIẾT LẠI logic parse card - tái dùng collectTextNodesInsideScrollableList()/
 * parseHomeworkCardsFromTexts() (automation/bai_tap/discovery/homeworkUiList.js, đã verify qua
 * nhiều testcase khác) để xác định <title>/<cta> của TỪNG card theo cấu trúc hierarchy thật, KHÔNG
 * theo regex mù trên toàn màn hình - loại bỏ hẳn rủi ro match nhầm 1 "Chinh phục"/"Làm lại" ở nơi
 * khác màn hình không phải Homework card. Vòng lặp cuộn CỦA FILE NÀY khác helper
 * collectVisibleHomeworkCardsViaMcpSession() có sẵn (cùng file kia): helper đó dừng khi 2 lượt cuộn
 * liên tiếp KHÔNG thêm card mới (dedup theo title+cta) - với danh sách có runs trùng lặp liên tiếp
 * dài (vd "G3-U1-Lesson 1..." x10 cùng cta "Làm bài" quan sát thật qua API) có thể dừng SỚM giả
 * (false bottom) trước khi tới card mục tiêu. File này dừng theo MỤC TIÊU (đã thấy đủ cta cần tìm
 * chưa), không theo "còn card mới hay không" - an toàn hơn cho danh sách nhiều bản ghi trùng.
 *
 * CHIẾN LƯỢC LOCATE (đo/quan sát thật 2026-08-17 làm căn cứ, KHÔNG suy đoán):
 *   - HW-22 ("Làm lại", card đã hoàn thành - KHÔNG có section header riêng, nằm lẫn trong "Bài tập
 *     về nhà"): KHÔNG bulk-jump (đã đo thật qua diagnostic riêng: panel "Điểm" tự nó non-interactive
 *     xác nhận an toàn tap, nhưng xuất hiện NHIỀU lần trên cùng màn hình gắn với CTA khác nhau -
 *     không đủ tin cậy làm 1 anchor duy nhất) - cuộn thô từ đầu danh sách, cap REDO_SCROLL_CAP lần.
 *   - HW-21 ("Chinh phục", thuộc section "Bài tập nâng cao"): bulk-jump 1 lượt
 *     `scrollUntilVisible` target "Bài tập nâng cao" (label, an toàn) rồi cuộn thô (swipe) thêm tối
 *     đa LOCAL_SCROLL_CAP lần để vào tới card thật trong section.
 *
 * THỨ TỰ THỰC THI: HW-22 chạy TRƯỚC HW-21 (theo yêu cầu đảo thứ tự) - KHÔNG ảnh hưởng tính đúng đắn
 * của [CROSS_CHECK] (kiểm tra text sheet HW-22 không chứa message riêng của HW-21 nâng cao) vì phép
 * so khớp chỉ phụ thuộc NỘI DUNG 2 message đã ghi nhận, không phụ thuộc thứ tự thời gian ghi nhận
 * chúng.
 *
 * Nếu không tìm thấy card mục tiêu trong ngân sách cuộn -> BLOCKED_LOCATE (không tap đại candidate
 * đầu tiên nhìn thấy ngoài luồng parse card đã verify).
 *
 * CHẠY: node flows/bai_tap/hw21-22-upgrade-sheets.mjs
 * ENV: APP_ID (.env), PHONE/OTP (test_data/accounts.env), MAESTRO_DEVICE (tuỳ chọn).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MaestroMcpBridge } from "../../automation/bridge/maestroMcpBridge.js";
import {
  collectTextNodesInsideScrollableList,
  parseHomeworkCardsFromTexts,
} from "../../automation/bai_tap/discovery/homeworkUiList.js";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "hw21_22_upgrade_sheets_report.json");
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";

const LOCAL_SCROLL_CAP = 15; // HW-21, sau bulk-jump - section thường ngắn (1-3 card)
const REDO_SCROLL_CAP = 60; // HW-22, không bulk-jump - phải đủ sâu (xem docblock)

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

const MESSAGES_HW21 = [
  "Nâng cấp để con thực hành nâng cao",
  "Bài tập nâng cao dành cho tài khoản PRO",
  "Nâng cấp tài khoản",
  "Không thể bắt đầu làm bài",
];
const MESSAGES_HW22 = [
  "Nâng cấp để con tiếp tục học không giới hạn",
  "Làm lại bài tập dành cho tài khoản PRO",
  "Nâng cấp tài khoản",
  "Không thể bắt đầu làm bài",
];
const ADVANCED_ONLY_MESSAGE = "Bài tập nâng cao dành cho tài khoản PRO";

function log(...args) {
  console.log(...args);
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectAllTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectAllTexts(c, acc);
  return acc;
}

/** launch-fresh.yaml, viết lại nguyên vẹn thành bước native - CHỈ launchApp{stopApp:true} + chờ
 * dashboard, KHÔNG clearState/logout (xem docblock file gốc: "clearState xoá cả session -> phải
 * đăng nhập lại bằng OTP thật" - đã cố tình bỏ sau khi phát hiện sai mục đích). */
async function launchFresh(bridge) {
  const r = await bridge.runSteps([
    { launchApp: { stopApp: true, permissions: { all: "allow" } } },
    { extendedWaitUntil: { visible: { text: ".*(Đăng nhập|Vui học|Bài tập|Báo cáo).*" }, timeout: 40000 } },
  ]);
  if (!r.success) throw new Error(`launchFresh thất bại: ${r.error}`);
}

/** login.yaml, viết lại nguyên vẹn - chỉ login nếu app đang ở màn chưa đăng nhập (when: visible). */
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

/** open-tab-homework.yaml, viết lại nguyên vẹn - KHÔNG đổi filter (xem docblock đầu file: MONTH
 * không giúp rút ngắn gì, giữ mặc định app). */
async function openHomeworkTab(bridge) {
  const r = await bridge.runSteps([
    { tapOn: { text: "Bài tập" } },
    {
      extendedWaitUntil: {
        visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao|Bạn không có bài tập nào đang chờ|2 tuần gần nhất|1 tháng gần nhất).*" },
        timeout: 30000,
      },
    },
  ]);
  if (!r.success) throw new Error(`openHomeworkTab thất bại: ${r.error}`);
}

/**
 * Tìm TOÀN BỘ card đang hiển thị (trong ngân sách cuộn) có đúng `targetCta`, dừng NGAY khi tìm thấy
 * >=1 card (không cuộn thêm để "đếm cho đủ" - candidates trả về chỉ là những gì đã thấy TRONG lượt
 * hierarchy cuối cùng, dùng để báo cáo [DUPLICATE_RISK] chứ không phải một cuộc quét đầy đủ toàn bộ
 * danh sách). KHÔNG bao giờ target CTA để cuộn - chỉ swipe thô hoặc scrollUntilVisible trên
 * `bulkJumpAnchorRegex` (label, không phải nút).
 */
async function locateCardWithCta(bridge, { targetCta, bulkJumpAnchorRegex, maxScrolls, label }) {
  const startedAt = Date.now();
  let bulkJumped = null; // null = không thử, true/false = có thử + kết quả

  if (bulkJumpAnchorRegex) {
    const r = await bridge.runSteps([
      {
        scrollUntilVisible: {
          element: { text: bulkJumpAnchorRegex },
          direction: "DOWN",
          timeout: 150000,
          speed: 70,
          waitToSettleTimeoutMs: 500,
        },
      },
    ]);
    bulkJumped = r.success;
    if (!r.success) log(`  [${label}] bulk-jump anchor "${bulkJumpAnchorRegex}" KHÔNG thấy (${r.error}) - tiếp tục cuộn thô từ vị trí hiện tại.`);
  }

  let sectionSeen = false;
  const readOnce = async () => {
    const tree = await bridge.hierarchy();
    const texts = collectTextNodesInsideScrollableList(tree, []);
    const parsed = parseHomeworkCardsFromTexts(texts, { sectionSeen });
    sectionSeen = parsed.sectionSeen;
    return parsed.cards.filter((c) => c.cta === targetCta);
  };

  let candidates = await readOnce();
  let scrollsUsed = 0;
  while (candidates.length === 0 && scrollsUsed < maxScrolls) {
    const swipeResult = await bridge.runSteps([
      { swipe: { start: "50%,80%", end: "50%,25%", duration: 400 } },
      { waitForAnimationToEnd: { timeout: 1200 } },
    ]);
    if (!swipeResult.success) {
      log(`  [${label}] swipe thất bại ở lượt ${scrollsUsed + 1}: ${swipeResult.error} - dừng cuộn.`);
      break;
    }
    scrollsUsed++;
    candidates = await readOnce();
  }

  const timeMs = Date.now() - startedAt;
  if (candidates.length === 0) {
    return { found: false, candidates: [], scrollsUsed, bulkJumped, timeMs, label };
  }
  return { found: true, candidates, scrollsUsed, bulkJumped, timeMs, label, target: candidates[0] };
}

/** Tap CTA của candidate đã xác định qua parse hierarchy (title đứng NGAY TRƯỚC nó theo cấu trúc
 * card thật) - scope bằng `below: title` (label, không phải target cuộn) để không lẫn sang card
 * trùng CTA khác đang hiển thị đồng thời trên màn hình. */
async function tapCard(bridge, card) {
  const esc = escapeRegex(card.title);
  const r = await bridge.runSteps([
    { tapOn: { text: card.cta, below: { text: `.*${esc}.*` }, index: 0 } },
    { waitForAnimationToEnd: { timeout: 1500 } },
    { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
  ]);
  if (!r.success) throw new Error(`tapCard("${card.title}", cta="${card.cta}") thất bại: ${r.error}`);
}

async function waitForUpgradeMessage(bridge, candidateMessages, { timeoutMs = 30000, screenshotName } = {}) {
  const pattern = `.*(${candidateMessages.join("|")}).*`;
  const r = await bridge.runSteps([{ extendedWaitUntil: { visible: { text: pattern }, timeout: timeoutMs } }]);
  if (!r.success) return { matched: false, error: r.error, text: null, allTexts: null };
  const tree = await bridge.hierarchy();
  const texts = collectAllTexts(tree);
  const matchedText = texts.find((t) => candidateMessages.some((m) => t.includes(m))) ?? null;
  if (screenshotName) {
    await bridge.runSteps([{ takeScreenshot: screenshotName }]);
  }
  return { matched: true, text: matchedText, allTexts: texts };
}

function finish(result) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  return result;
}

async function main() {
  if (!APP_ID) throw new Error("Thiếu APP_ID - kiểm tra .env.");
  if (!PHONE || !OTP) throw new Error("Thiếu PHONE/OTP - kiểm tra test_data/accounts.env.");

  const timings = {};
  const evidence = {};
  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();

  // report() = finish() + đính kèm số lượt gọi MCP thật (runCallCount/hierarchyCallCount đã đếm sẵn
  // trong bridge, xem automation/bridge/maestroMcpBridge.js) - phục vụ [PERFORMANCE] MCP_RUN_CALLS/
  // MCP_HIERARCHY_CALLS, không đoán số lượt.
  const report = (obj) =>
    finish({ ...obj, mcp: { runCalls: bridge.runCallCount, hierarchyCalls: bridge.hierarchyCallCount } });

  try {
    // ===== [SETUP] =====
    let t0 = Date.now();
    await launchFresh(bridge);
    await loginIfNeeded(bridge);
    await openHomeworkTab(bridge);
    timings.setupTimeMs = Date.now() - t0;
    log(`[SETUP] xong (${timings.setupTimeMs}ms).`);

    // ===== [HW-22] locate "Làm lại" (không bulk-jump, xem docblock) - CHẠY TRƯỚC HW-21 theo yêu cầu
    // (đảo thứ tự thực thi, KHÔNG đổi logic locate/tap/cross-check) =====
    log('[HW-22] Locate card cta="Làm lại" (KHÔNG bulk-jump - xem docblock file này)...');
    const locate22 = await locateCardWithCta(bridge, {
      targetCta: "Làm lại",
      bulkJumpAnchorRegex: null,
      maxScrolls: REDO_SCROLL_CAP,
      label: "HW-22",
    });
    timings.locateRedoTimeMs = locate22.timeMs;
    evidence.locateHw22 = {
      found: locate22.found,
      scrollsUsed: locate22.scrollsUsed,
      candidateCount: locate22.candidates.length,
      candidateTitles: locate22.candidates.map((c) => c.title),
    };
    if (!locate22.found) {
      return report({
        status: "BLOCKED_LOCATE",
        phase: "HW22_LOCATE",
        error: `Không tìm thấy card cta="Làm lại" trong ngân sách cuộn (${REDO_SCROLL_CAP} lượt, không bulk-jump).`,
        timings,
        evidence,
      });
    }
    log(`  [PASS] target="${locate22.target.title}" (candidateCount=${locate22.candidates.length}, scrolls=${locate22.scrollsUsed})`);

    t0 = Date.now();
    await tapCard(bridge, locate22.target);
    const msg22 = await waitForUpgradeMessage(bridge, MESSAGES_HW22, { screenshotName: "artifacts/HW-22-upgrade-redo" });
    timings.hw22SheetTimeMs = Date.now() - t0;
    evidence.hw22Message = msg22;
    if (!msg22.matched) {
      return report({ status: "FAIL", phase: "HW22_SHEET", error: `Không thấy upgrade sheet HW-22 trong timeout: ${msg22.error}`, timings, evidence });
    }
    log(`  [PASS] HW-22 message="${msg22.text}"`);

    // ===== [RESTART] đóng sheet, quay lại danh sách =====
    log("[RESTART] launch-fresh + mở lại tab Bài tập (giữ session, không OTP lại)...");
    t0 = Date.now();
    await launchFresh(bridge);
    await openHomeworkTab(bridge);
    timings.restartTimeMs = Date.now() - t0;
    evidence.restart = { appRestarted: true, sessionPreserved: true, otpRequired: false };

    // ===== [HW-21] locate "Bài tập nâng cao" -> "Chinh phục" =====
    log('[HW-21] Locate card cta="Chinh phục" (bulk-jump anchor "Bài tập nâng cao")...');
    const locate21 = await locateCardWithCta(bridge, {
      targetCta: "Chinh phục",
      bulkJumpAnchorRegex: ".*(Bài tập nâng cao).*",
      maxScrolls: LOCAL_SCROLL_CAP,
      label: "HW-21",
    });
    timings.locateAdvancedTimeMs = locate21.timeMs;
    evidence.locateHw21 = {
      found: locate21.found,
      scrollsUsed: locate21.scrollsUsed,
      bulkJumped: locate21.bulkJumped,
      candidateCount: locate21.candidates.length,
      candidateTitles: locate21.candidates.map((c) => c.title),
    };
    if (!locate21.found) {
      return report({
        status: "BLOCKED_LOCATE",
        phase: "HW21_LOCATE",
        error: `Không tìm thấy card cta="Chinh phục" trong ngân sách cuộn (${LOCAL_SCROLL_CAP} lượt sau bulk-jump).`,
        timings,
        evidence,
      });
    }
    log(`  [PASS] target="${locate21.target.title}" (candidateCount=${locate21.candidates.length}, scrolls=${locate21.scrollsUsed})`);

    t0 = Date.now();
    await tapCard(bridge, locate21.target);
    const msg21 = await waitForUpgradeMessage(bridge, MESSAGES_HW21, { screenshotName: "artifacts/HW-21-upgrade-advanced" });
    timings.hw21SheetTimeMs = Date.now() - t0;
    evidence.hw21Message = msg21;
    if (!msg21.matched) {
      return report({ status: "FAIL", phase: "HW21_SHEET", error: `Không thấy upgrade sheet HW-21 trong timeout: ${msg21.error}`, timings, evidence });
    }
    log(`  [PASS] HW-21 message="${msg21.text}"`);

    // ===== [CROSS_CHECK] - vẫn kiểm tra message HW-22 (đã có TỪ TRƯỚC) không lẫn message nâng cao
    // của HW-21 (vừa xác nhận SAU) - hướng đối chiếu không phụ thuộc thứ tự chạy, chỉ phụ thuộc nội
    // dung text thật của từng sheet =====
    const advancedMessageAbsentInHw22 = !(msg22.allTexts ?? []).some((t) => t.includes(ADVANCED_ONLY_MESSAGE));
    evidence.crossCheck = {
      hw21Message: msg21.text,
      hw22Message: msg22.text,
      advancedMessageAbsentInHw22,
    };
    log(`[CROSS_CHECK] advancedMessageAbsentInHw22=${advancedMessageAbsentInHw22}`);

    timings.totalTimeMs = Object.values(timings).reduce((a, b) => a + b, 0);
    const overallPass = advancedMessageAbsentInHw22;

    return report({
      status: overallPass ? "PASS" : "FAIL",
      phase: overallPass ? null : "CROSS_CHECK",
      timings,
      evidence,
    });
  } finally {
    await bridge.stop();
    log("[MCP] Đã dừng tiến trình `maestro mcp`.");
  }
}

main()
  .then((result) => {
    log(`\n=== KẾT QUẢ: ${result.status}${result.phase ? ` (phase=${result.phase})` : ""} ===`);
    log(`Đã ghi report ra ${OUTPUT_FILE}`);
    process.exit(result.status === "PASS" ? 0 : 1);
  })
  .catch((err) => {
    console.error("\n[hw21-22-upgrade-sheets] Dừng lại vì lỗi ngoài dự kiến:\n");
    console.error(err);
    finish({ status: "ERROR", error: err.message, stack: err.stack });
    process.exit(2);
  });
