#!/usr/bin/env node
/**
 * PRO-Lamlai-Fullluong (KHÔNG scoring)
 *
 * Case: bấm "Làm lại" 1 bài ĐÃ HOÀN THÀNH TRƯỚC ĐÓ trên hồ sơ PRO "Ngoc" - KHÔNG giao bài mới,
 * KHÔNG resolve đáp án CMS, KHÔNG scoring engine, KHÔNG yêu cầu điểm 6-8. Mục tiêu CHỈ verify full
 * lifecycle "Làm lại" end-to-end: chọn 1 card completed hợp lệ -> tap "Làm lại" -> làm hết bằng
 * dispatcher chung (answer-current-exercise-generic.yaml, không biết đúng/sai) -> màn kết quả ->
 * đóng -> về lại danh sách.
 *
 * ĐÂY LÀ BẢN ĐƠN GIẢN HOÁ của flows/bai_tap/pro_lamlai_fullluong_xemchitiet.mjs - file đó CÒN thêm
 * 2 việc case này KHÔNG cần: (D) resolveHomeworkExamQuestionsForRoomId + HomeworkExamEngine để ép
 * điểm thật vào [6.0, 8.0], và (H) mở rộng sang case "xem chi tiết" (HW-16/17) sau khi redo. Phase
 * [D]/[H] đó BỊ BỎ HẲN ở đây (không phải rút gọn code, mà đúng theo yêu cầu case - KHÔNG mang
 * requirement điểm 6-8 từ case khác sang case này).
 *
 * TÁI SỬ DỤNG (không viết lại logic đã verify):
 *   - [A] ensureProProfileActive() - COPY nguyên từ pro_lamlai_fullluong_xemchitiet.mjs (đã verify
 *     PASS), dùng MaestroMcpBridge (không dùng maestro CLI subprocess ở phase này vì cần đọc
 *     hierarchy trực tiếp để verify chuyển hồ sơ, không có selector tĩnh đủ dùng qua `maestro test`).
 *   - [B] collectDistinctCompletedCandidates() - COPY nguyên (cùng file gốc) - cuộn "Bài tập về
 *     nhà" gom card cta="Làm lại", đọc CẤU TRÚC qua hierarchy (KHÔNG dùng text CTA làm scroll
 *     target/selector mù - nguyên tắc an toàn gốc từ flows/bai_tap/xemchitietbailam.mjs).
 *   - [C] resolveUniqueRoomIdForCandidate() - COPY nguyên (getHomeworks()/resolveMyStatus(), CHỈ
 *     đọc METADATA - title/classIds/deadline/status, KHÔNG đụng tới câu hỏi/đáp án) - dùng để định
 *     danh room_id DUY NHẤT cho candidate (đúng yêu cầu: "định danh bằng lesson_item_id/room_id,
 *     không dùng title đơn độc" khi ≥2 room cùng title) - loại candidate nếu KHÔNG resolve được
 *     đúng 1 room, KHÔNG đoán matches[0].
 *   - [E] Tap "Làm lại" theo TOẠ ĐỘ đã capture ở [B] (KHÔNG dùng text CTA làm selector - đã xác
 *     nhận thật có thể đọc/tap sai khi có card trùng cta) - COPY nguyên.
 *   - [F] MỚI (thay thế hoàn toàn [D]+[F] scoring gốc): dừng MCP bridge (nhường quyền điều khiển
 *     device), rồi chạy `maestro test flows/helpers/finish-exercise-and-return.yaml` (file MỚI,
 *     tối thiểu - tách nguyên phần "Hoàn thành -> màn Kết quả -> đóng -> về danh sách" của
 *     flows/bai_tap/ktra_fullluong_lambai.yaml, dùng LẠI answer-current-exercise-generic.yaml y
 *     hệt dispatcher gốc) - vì MaestroMcpSession.run() gửi YAML nguyên văn qua MCP, KHÔNG resolve
 *     được `runFlow: {file: ...}` (đã ghi nhận thật trong flows/giao_bai_tap/
 *     e2e-teacher-assign-partial-resume-scored-pro.mjs dòng 498-501) - phải rời khỏi bridge session
 *     để gọi flow file thật qua `maestro test`. App vẫn ĐANG đứng đúng màn Doing (session/profile
 *     giữ nguyên trên device) khi tiến trình `maestro test` mới bắt đầu - không launch/login lại.
 *
 * CHẠY: node flows/bai_tap/pro_lamlai_fullluong.mjs
 * ENV: APP_ID (.env), PHONE/OTP (test_data/accounts.env), MAESTRO_DEVICE (tuỳ chọn),
 *   PROFILE_PRO_NAME (default "Ngoc"), TARGET_CLASS_ID/TARGET_STUDENT_ID (default như
 *   pro_lamlai_fullluong_xemchitiet.mjs).
 */

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseEnvFile } from "../../../automation/src/config.js";
import { MaestroMcpBridge } from "../../../automation/bridge/maestroMcpBridge.js";
import { getHomeworks } from "../../../automation/bai_tap/discovery/homeworks.js";
import { resolveMyStatus } from "../../../automation/bai_tap/model/homeworkModel.js";
import { CTA_TEXTS, SECTION_HEADERS } from "../../../automation/bai_tap/discovery/homeworkUiList.js";
import { deviceArgs, APP_ID, PHONE, OTP } from "../../web/giao_bai_tap/e2e-teacher-assign-student-open.mjs";
import { formatDM } from "./verify-filter-web-vs-app.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "pro_lamlai_fullluong_report.json");
const ACCOUNTS_ENV = parseEnvFile(join(PROJECT_ROOT, "test_data", "accounts.env"));
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const PROFILE_PRO_NAME = process.env.PROFILE_PRO_NAME || ACCOUNTS_ENV.PROFILE_PRO_NAME || "Ngoc";
const TARGET_CLASS_ID = process.env.TARGET_CLASS_ID || "b3336062-cacd-4d1a-a0af-4de44acf33d2";
const TARGET_STUDENT_ID = process.env.TARGET_STUDENT_ID || "d87364c2-ad26-4136-8f7a-9078aff872ff";
const MAX_LOCATE_SCROLLS = 60;
const MAX_CANDIDATE_ATTEMPTS = 10;
const COMPLETED_CTA = "Làm lại";
const ADVANCED_SECTION_HEADER = "Bài tập nâng cao";
const FINISH_FLOW = join(PROJECT_ROOT, "flows", "app", "helpers", "finish-exercise-and-return.yaml");

function log(...args) {
  console.log(...args);
}

/** ===================== card/hierarchy parsing (COPY nguyên từ pro_lamlai_fullluong_xemchitiet.mjs) ===================== */

const PROGRESS_PATTERN = /^\d+\s*\/\s*\d+$/;
const DUE_DATE_PATTERN = /^Hạn nộp \d{2}\/\d{2}(\s*\(QUÁ HẠN\))?$/;
const SCORE_PATTERN = /^Điểm\s*[0-9.,]+.*$/;
const MAX_CTA_LOOKAHEAD = 6;

function collectAllTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectAllTexts(c, acc);
  return acc;
}

function isVisibleInTree(texts, textPattern) {
  const pattern = new RegExp(`^${textPattern}$`);
  return texts.some((t) => pattern.test(t));
}

function parseBounds(boundsStr) {
  const m = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(boundsStr ?? "");
  if (!m) return null;
  const [x1, y1, x2, y2] = m.slice(1).map(Number);
  return { x1, y1, x2, y2 };
}

function centerPoint(bounds) {
  return { x: Math.round((bounds.x1 + bounds.x2) / 2), y: Math.round((bounds.y1 + bounds.y2) / 2) };
}

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

function findCompletedCardsWithCtaBounds(nodes, { sectionSeen: initialSectionSeen = false } = {}) {
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
    if (!title || SECTION_HEADERS.includes(title) || PROGRESS_PATTERN.test(title) || DUE_DATE_PATTERN.test(title) || CTA_TEXTS.includes(title)) {
      continue;
    }
    const maybeDueBeforeTitle = nodes[i - 2]?.text;
    const dueDateBefore = maybeDueBeforeTitle && DUE_DATE_PATTERN.test(maybeDueBeforeTitle) ? maybeDueBeforeTitle : null;

    let cta = null;
    let ctaBounds = null;
    let scoreText = null;
    for (let j = i + 1; j < Math.min(nodes.length, i + 1 + MAX_CTA_LOOKAHEAD); j++) {
      const t = nodes[j].text;
      if (SCORE_PATTERN.test(t)) scoreText = t;
      if (CTA_TEXTS.includes(t)) {
        cta = t;
        ctaBounds = nodes[j].bounds;
        break;
      }
      if (PROGRESS_PATTERN.test(t) || SECTION_HEADERS.includes(t)) break;
    }
    if (cta === COMPLETED_CTA && ctaBounds) {
      results.push({ title, cta, ctaBounds, scoreText, dueDateBefore });
    }
  }
  return { results, sectionSeen };
}

async function collectDistinctCompletedCandidates(bridge, { maxScrolls, maxDistinct }) {
  const startedAt = Date.now();
  let sectionSeen = false;
  let enteredAdvanced = false;
  const byTitle = new Map();

  const readOnce = async () => {
    const tree = await bridge.hierarchy();
    const nodes = collectNodesWithBoundsInsideScrollableList(tree, []);
    const advancedIdx = nodes.findIndex((n) => n.text === ADVANCED_SECTION_HEADER);
    if (advancedIdx !== -1) enteredAdvanced = true;
    const relevantNodes = advancedIdx === -1 ? nodes : nodes.slice(0, advancedIdx);
    const { results, sectionSeen: newSectionSeen } = findCompletedCardsWithCtaBounds(relevantNodes, { sectionSeen });
    sectionSeen = newSectionSeen;
    for (const r of results) {
      if (!byTitle.has(r.title)) byTitle.set(r.title, r);
    }
  };

  await readOnce();
  let scrollsUsed = 0;
  while (byTitle.size < maxDistinct && scrollsUsed < maxScrolls && !enteredAdvanced) {
    const swipeResult = await bridge.runSteps([
      { swipe: { start: "50%,80%", end: "50%,25%", duration: 400 } },
      { waitForAnimationToEnd: { timeout: 1200 } },
    ]);
    if (!swipeResult.success) {
      log(`  [LOCATE] swipe thất bại ở lượt ${scrollsUsed + 1}: ${swipeResult.error} - dừng cuộn.`);
      break;
    }
    scrollsUsed++;
    await readOnce();
  }
  return { candidates: [...byTitle.values()], scrollsUsed, timeMs: Date.now() - startedAt, enteredAdvanced };
}

/** ===================== [C] resolve room_id DUY NHẤT (COPY nguyên, chỉ đọc metadata) ===================== */

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
function isoToVnYmdLocal(iso) {
  const shifted = new Date(new Date(iso).getTime() + VN_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m0: shifted.getUTCMonth(), d: shifted.getUTCDate() };
}

async function resolveUniqueRoomIdForCandidate(candidate) {
  const homeworks = await getHomeworks({ period: "MONTH" });
  let matches = homeworks.filter(
    (h) => h.title === candidate.title && h.classIds.includes(TARGET_CLASS_ID) && resolveMyStatus(h, TARGET_STUDENT_ID) === "COMPLETED",
  );
  if (matches.length > 1 && candidate.dueDateBefore) {
    const wantDm = candidate.dueDateBefore.replace(/^Hạn nộp /, "").replace(/\s*\(QUÁ HẠN\)$/, "");
    const scoped = matches.filter((h) => h.deadline.endTime && formatDM(isoToVnYmdLocal(h.deadline.endTime)) === wantDm);
    if (scoped.length > 0) matches = scoped;
  }
  return { matches, unique: matches.length === 1, room: matches.length === 1 ? matches[0] : null };
}

/** Đọc lại 1 card completed CỤ THỂ theo title (dùng để re-locate candidate KẾ TIẾP sau khi
 * candidate trước đó bị BLOCKED_MISSING_EXERCISE_HANDLER - bounds cũ có thể lệch vì đã rời màn
 * danh sách/scroll vị trí khác) - COPY nguyên relocateCompletedCardByTitle() của
 * flows/bai_tap/pro_lamlai_fullluong_xemchitiet.mjs. */
async function relocateCompletedCardByTitle(bridge, title, { maxScrolls }) {
  let sectionSeen = false;
  let enteredAdvanced = false;

  const readOnce = async () => {
    const tree = await bridge.hierarchy();
    const nodes = collectNodesWithBoundsInsideScrollableList(tree, []);
    const advancedIdx = nodes.findIndex((n) => n.text === ADVANCED_SECTION_HEADER);
    if (advancedIdx !== -1) enteredAdvanced = true;
    const relevantNodes = advancedIdx === -1 ? nodes : nodes.slice(0, advancedIdx);
    const { results, sectionSeen: newSectionSeen } = findCompletedCardsWithCtaBounds(relevantNodes, { sectionSeen });
    sectionSeen = newSectionSeen;
    return results.find((r) => r.title === title) ?? null;
  };

  let found = await readOnce();
  let scrollsUsed = 0;
  if (!found) {
    await bridge.runSteps([{ repeat: { times: 6, commands: [{ swipe: { direction: "DOWN", duration: 250 } }] } }]);
    found = await readOnce();
  }
  while (!found && scrollsUsed < maxScrolls && !enteredAdvanced) {
    const swipeResult = await bridge.runSteps([
      { swipe: { start: "50%,80%", end: "50%,25%", duration: 400 } },
      { waitForAnimationToEnd: { timeout: 1200 } },
    ]);
    if (!swipeResult.success) break;
    scrollsUsed++;
    found = await readOnce();
  }
  return { found, scrollsUsed, enteredAdvanced };
}

/** ===================== [A] PROFILE (COPY nguyên từ pro_lamlai_fullluong_xemchitiet.mjs) ===================== */
async function ensureProProfileActive(bridge) {
  const login = await bridge.runSteps([
    { launchApp: { permissions: { all: "allow" } } },
    { extendedWaitUntil: { visible: { text: ".*(Đăng nhập|Vui học|Bài tập|Báo cáo).*" }, timeout: 30000 } },
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
          { runFlow: { when: { visible: ".*(Xác nhận).*" }, commands: [{ tapOn: { text: ".*(Xác nhận).*" } }] } },
          { extendedWaitUntil: { visible: { text: ".*(Vui học|Bài tập|Báo cáo).*" }, timeout: 60000 } },
        ],
      },
    },
    { extendedWaitUntil: { visible: ".*(Vui học|Bài tập|Báo cáo).*", timeout: 30000 } },
    { tapOn: { text: "Bài tập" } },
    { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao|Bạn không có bài tập nào đang chờ|2 tuần gần nhất|1 tháng gần nhất).*" }, timeout: 30000 } },
  ]);
  if (!login.success) throw new Error(`Không mở được tab "Bài tập" để kiểm tra hồ sơ hiện tại: ${login.error}`);

  const treeBefore = await bridge.hierarchy();
  const alreadyActive = isVisibleInTree(collectAllTexts(treeBefore), `.*(${PROFILE_PRO_NAME}).*`);
  if (alreadyActive) {
    log(`  [PROFILE] Hồ sơ "${PROFILE_PRO_NAME}" đã đang active - không cần chuyển.`);
    return { name: PROFILE_PRO_NAME, alreadyActive: true, switched: false, verified: true };
  }

  log(`  [PROFILE] Hồ sơ hiện tại KHÔNG phải "${PROFILE_PRO_NAME}" - chuyển hồ sơ...`);
  const switchResult = await bridge.runSteps([
    { tapOn: { text: ".*(Chuyển profile).*", index: 0 } },
    {
      runFlow: {
        when: { visible: ".*(Chuyển profile học tập).*" },
        commands: [
          { tapOn: { text: `.*(${PROFILE_PRO_NAME}).*` } },
          { tapOn: { text: "Chuyển profile", index: 1 } },
        ],
      },
    },
    { extendedWaitUntil: { visible: `.*(${PROFILE_PRO_NAME}).*`, timeout: 20000 } },
  ]);
  if (!switchResult.success) throw new Error(`Chuyển sang hồ sơ "${PROFILE_PRO_NAME}" thất bại: ${switchResult.error}`);
  const verified = isVisibleInTree(collectAllTexts(await bridge.hierarchy()), `.*(${PROFILE_PRO_NAME}).*`);
  if (!verified) throw new Error(`Đã tap chuyển hồ sơ nhưng KHÔNG xác nhận lại được "${PROFILE_PRO_NAME}" hiển thị sau đó.`);
  log(`  [PROFILE] Đã chuyển + verify hồ sơ "${PROFILE_PRO_NAME}" đang active.`);
  return { name: PROFILE_PRO_NAME, alreadyActive: false, switched: true, verified: true };
}

function finish(result) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  return result;
}

function printReport(r) {
  const e = r.evidence ?? {};
  log(`\n[PROFILE]`);
  log(`profile=${e.profile?.name ?? "-"}`);
  log(`tier=${e.profile?.verified ? "PRO" : "UNKNOWN"}`);
  log(`profile_verified=${e.profile?.verified ? "YES" : "NO"}`);
  log(`\n[REDO_CANDIDATE]`);
  log(`title=${e.chosenCandidate?.title ?? "-"}`);
  log(`room_id=${e.chosenCandidate?.roomId ?? "-"}`);
  log(`candidates_found=${e.candidatesFound ?? "-"}`);
  log(`candidates_tried=${e.candidatesTried ?? "-"}`);
  if (Array.isArray(e.redoAttempts) && e.redoAttempts.length > 0) {
    log(`redo_attempts=${e.redoAttempts.map((a) => `"${a.title}"=${a.ok ? "PASS" : a.reason}`).join(" | ")}`);
  }
  log(`\n[FLOW]`);
  log(`assignment_opened=${e.redo?.landedOnDoing ? "YES" : "NO"}`);
  log(`finish_reached=${e.finish?.reached ? "YES" : "NO"}`);
  log(`result_screen=${e.finish?.reached ? "YES" : "NO"}`);
  log(`returned_to_list=${e.finish?.returnedToList ? "YES" : "NO"}`);
  log(`\n[SCORING]`);
  log(`REQUIREMENT=NONE`);
  log(`actual_score=- (không đọc - case này không cần điểm, xem docblock đầu file)`);
  log(`score_pass_fail=NOT_APPLICABLE`);
  log(`\n[SAFETY]`);
  log(`new_assignments_created=0 (KHÔNG giao bài mới - dùng lại bài đã hoàn thành trước đó)`);
  log(`unique_room_resolution_used=true (KHÔNG đoán matches[0])`);
  log(`cta_used_as_scroll_target=false`);
  log(`\n[PERFORMANCE]`);
  log(`duration=${e.totalDurationSeconds != null ? `${e.totalDurationSeconds.toFixed(1)}s` : "-"}`);
  log(`maestro_processes=2 (1 MCP bridge session cho [A/B/C/E] + 1 maestro test cho finish-exercise-and-return.yaml)`);
  log(`\n[OVERALL]`);
  log(r.status);
  log(`\n[ROOT_CAUSE]`);
  log(r.status === "PASS" ? "-" : (r.error ?? r.phase ?? "-"));
}

async function main() {
  if (!APP_ID) throw new Error("Thiếu APP_ID - kiểm tra .env.");
  if (!PHONE || !OTP) throw new Error("Thiếu PHONE/OTP - kiểm tra test_data/accounts.env.");

  const overallStart = Date.now();
  const evidence = {};

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  let bridgeStopped = false;

  try {
    log(`[A] Đảm bảo hồ sơ "${PROFILE_PRO_NAME}" (PRO) đang active...`);
    const profileResult = await ensureProProfileActive(bridge);
    evidence.profile = profileResult;
    log(`  [PASS] profile=${profileResult.name} switched=${profileResult.switched}`);

    log(`[B] Cuộn "Bài tập về nhà" gom candidate cta="Làm lại" (distinct theo title, budget ${MAX_CANDIDATE_ATTEMPTS})...`);
    const collected = await collectDistinctCompletedCandidates(bridge, { maxScrolls: MAX_LOCATE_SCROLLS, maxDistinct: MAX_CANDIDATE_ATTEMPTS });
    evidence.candidatesFound = collected.candidates.length;
    log(`  Tìm được ${collected.candidates.length} candidate distinct sau ${collected.scrollsUsed} lượt cuộn (enteredAdvanced=${collected.enteredAdvanced}).`);
    if (collected.candidates.length === 0) {
      return finish({
        status: "BLOCKED",
        phase: "LOCATE_CANDIDATE",
        error: collected.enteredAdvanced
          ? `Hết section "Bài tập về nhà" mà chưa gặp card cta="${COMPLETED_CTA}" nào - hồ sơ "${PROFILE_PRO_NAME}" có thể chưa hoàn thành bài nào để redo.`
          : `Hết ngân sách cuộn (${MAX_LOCATE_SCROLLS} lượt) mà chưa gặp card cta="${COMPLETED_CTA}" nào.`,
        evidence,
      });
    }

    log(`[C] Thử resolve room_id DUY NHẤT cho từng candidate (bounded ${MAX_CANDIDATE_ATTEMPTS})...`);
    const attempts = [];
    const feasible = [];
    for (const candidate of collected.candidates.slice(0, MAX_CANDIDATE_ATTEMPTS)) {
      const attempt = { title: candidate.title, dueDateBefore: candidate.dueDateBefore };
      const { matches, unique, room } = await resolveUniqueRoomIdForCandidate(candidate);
      attempt.roomMatchCount = matches.length;
      if (!unique) {
        attempt.ok = false;
        attempt.reason = `Resolve room_id KHÔNG unique (matches=${matches.length}) - loại, không đoán matches[0].`;
        attempts.push(attempt);
        log(`  [SKIP] "${candidate.title}": ${attempt.reason}`);
        continue;
      }
      attempt.ok = true;
      attempt.roomId = room.id;
      attempts.push(attempt);
      log(`  [OK] "${candidate.title}" (room_id=${room.id}) - identity unique.`);
      feasible.push({ candidate, room });
    }
    evidence.candidatesTried = attempts.length;
    evidence.candidateAttempts = attempts;
    if (feasible.length === 0) {
      return finish({
        status: "BLOCKED",
        phase: "CANDIDATE_FEASIBILITY",
        error: `Đã thử ${attempts.length}/${collected.candidates.length} candidate distinct - không candidate nào resolve được room_id DUY NHẤT (mọi candidate đều trùng title với ≥1 room khác cùng hoàn thành).`,
        evidence,
      });
    }

    // ===== [E]+[F] Thử LẦN LƯỢT từng candidate khả thi: tap "Làm lại" -> hoàn thành bằng dispatcher
    // chung. Nếu 1 candidate BLOCKED_MISSING_EXERCISE_HANDLER (câu hỏi dạng SPEAK/SORT-
    // SENTENCE_BUILDER, dispatcher chung chưa hỗ trợ - giới hạn đã biết, KHÔNG phải bug), thoát màn
    // Doing bằng exercise_close_button rồi thử candidate KẾ TIẾP - KHÔNG dừng ở candidate đầu tiên
    // (theo yêu cầu: được phép thử candidate khác khi candidate trước bị BLOCKED do giới hạn loại
    // câu hỏi, KHÔNG phải vì né 1 title cụ thể). Bất kỳ lỗi nào KHÁC BLOCKED_MISSING_EXERCISE_HANDLER
    // (FAIL thật, selector sai, crash...) DỪNG NGAY, không thử tiếp candidate khác.
    const redoAttempts = [];
    let passedCandidate = null;
    for (let i = 0; i < feasible.length; i++) {
      const { candidate, room } = feasible[i];
      log(`[E] (candidate ${i + 1}/${feasible.length}) Tìm lại + tap "Làm lại" cho card "${candidate.title}"...`);
      let ctaBounds = candidate.ctaBounds;
      if (i > 0) {
        // Không phải lần đầu: app đang đứng ở màn Doing của candidate BLOCKED trước đó - thoát ra,
        // rồi ĐỌC LẠI hierarchy để lấy bounds MỚI (bounds cũ đã capture ở [B] có thể lệch do đã rời
        // màn danh sách/scroll khác vị trí).
        //
        // ĐÃ SỬA (xác nhận thật qua run trước): tapOn exercise_close_button "optional:true" +
        // extendedWaitUntil KHÔNG kiểm tra .success - khi màn BLOCKED (vd SORT/SENTENCE_BUILDER)
        // không có exercise_close_button tappable ngay hoặc assertVisible của dispatcher đã dừng
        // flow ở trạng thái khác, code CŨ vẫn đi tiếp gọi relocateCompletedCardByTitle NGAY TRÊN màn
        // hình sai (chưa về danh sách) -> luôn "không tìm lại được card". SỬA: kiểm tra .success, nếu
        // thoát bằng X thất bại thì fallback CHẮC CHẮN hơn - relaunch app (GIỮ session, KHÔNG
        // clearState/logout, cùng cơ chế launch-keep-session.yaml) rồi mở lại tab "Bài tập" - đảm bảo
        // luôn về đúng danh sách bất kể trạng thái màn hình trước đó.
        const exitViaClose = await bridge.runSteps([
          { tapOn: { id: "exercise_close_button", optional: true } },
          { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao).*" }, timeout: 8000 } },
        ]);
        if (!exitViaClose.success) {
          log(`  [RECOVER] Thoát bằng X không thành công (${exitViaClose.error ?? "timeout"}) - relaunch app (giữ session) rồi mở lại tab Bài tập...`);
          await bridge.runSteps([
            { launchApp: { permissions: { all: "allow" } } },
            { extendedWaitUntil: { visible: { text: ".*(Đăng nhập|Vui học|Bài tập|Báo cáo).*" }, timeout: 30000 } },
            { tapOn: { text: "Bài tập" } },
            { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao|2 tuần gần nhất|1 tháng gần nhất).*" }, timeout: 30000 } },
          ]);
        }
        const relocated = await relocateCompletedCardByTitle(bridge, candidate.title, { maxScrolls: MAX_LOCATE_SCROLLS });
        if (!relocated.found) {
          redoAttempts.push({ title: candidate.title, roomId: room.id, ok: false, reason: "Không tìm lại được card sau khi thoát candidate trước." });
          log(`  [SKIP] "${candidate.title}": không tìm lại được card trên danh sách.`);
          continue;
        }
        ctaBounds = relocated.found.ctaBounds;
      }
      const ctaPoint = centerPoint(ctaBounds);
      const tapRedo = await bridge.runSteps([
        { tapOn: { point: `${ctaPoint.x},${ctaPoint.y}` } },
        { waitForAnimationToEnd: { timeout: 3000 } },
        { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
        { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 15000 } },
      ]);
      if (!tapRedo.success) {
        redoAttempts.push({ title: candidate.title, roomId: room.id, ok: false, reason: `Tap "Làm lại" (point ${ctaPoint.x},${ctaPoint.y}) thất bại: ${tapRedo.error}` });
        return finish({ status: "FAIL", phase: "TAP_LAM_LAI", error: redoAttempts[redoAttempts.length - 1].reason, evidence: { ...evidence, redoAttempts } });
      }
      log(`  [PASS] Đã tap "Làm lại" tại (${ctaPoint.x},${ctaPoint.y}) - vào màn Doing (exercise_close_button visible).`);

      log(`[F] Dừng MCP bridge, chạy flows/helpers/finish-exercise-and-return.yaml (dispatcher chung -> màn kết quả -> đóng -> về danh sách)...`);
      await bridge.stop();
      bridgeStopped = true;
      try {
        execFileSync(
          "maestro",
          [...deviceArgs(), "test", FINISH_FLOW, "-e", `APP_ID=${APP_ID}`, "-e", `EXERCISE_NAME=${candidate.title}`],
          { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
        );
        redoAttempts.push({ title: candidate.title, roomId: room.id, ok: true });
        passedCandidate = { candidate, room };
        break;
      } catch (err) {
        const combined = `${err.stdout?.toString?.() ?? ""}\n${err.stderr?.toString?.() ?? ""}\n${err.message}`;
        const isMissingHandler = combined.includes("BLOCKED_MISSING_EXERCISE_HANDLER");
        redoAttempts.push({ title: candidate.title, roomId: room.id, ok: false, reason: isMissingHandler ? "BLOCKED_MISSING_EXERCISE_HANDLER (SPEAK/SORT-SENTENCE_BUILDER)" : "HARD_FAIL" });
        if (!isMissingHandler) {
          evidence.finish = { reached: false, returnedToList: false };
          return finish({
            status: "FAIL",
            phase: "FINISH_EXERCISE",
            error: `finish-exercise-and-return.yaml FAIL ở 1 bước cho "${candidate.title}" (room_id=${room.id}): ${combined.slice(-2000)}`,
            evidence: { ...evidence, redoAttempts, maestroOutputTail: combined.slice(-4000) },
          });
        }
        log(`  [BLOCKED] "${candidate.title}" (room_id=${room.id}): câu hỏi dạng SPEAK/SORT-SENTENCE_BUILDER - dispatcher chung chưa hỗ trợ. Thử candidate kế tiếp (nếu còn)...`);
        // Cần bridge mới cho vòng lặp kế tiếp (bridge cũ đã stop() ở trên).
        if (i < feasible.length - 1) {
          await bridge.start();
          bridgeStopped = false;
        }
      }
    }
    evidence.redoAttempts = redoAttempts;

    if (!passedCandidate) {
      return finish({
        status: "BLOCKED",
        phase: "FINISH_EXERCISE",
        error: `Đã thử ${redoAttempts.length}/${feasible.length} candidate khả thi - TẤT CẢ đều BLOCKED_MISSING_EXERCISE_HANDLER (câu hỏi dạng SPEAK/SORT-SENTENCE_BUILDER, dispatcher chung chưa hỗ trợ). Giới hạn đã biết, không phải bug.`,
        evidence,
      });
    }
    evidence.chosenCandidate = { title: passedCandidate.candidate.title, roomId: passedCandidate.room.id };
    evidence.redo = { tapped: true, landedOnDoing: true };
    evidence.finish = { reached: true, returnedToList: true };
    log(`  [PASS] Đã hoàn thành, tới màn kết quả, đóng kết quả, về lại danh sách Bài tập.`);

    evidence.totalDurationSeconds = (Date.now() - overallStart) / 1000;
    return finish({ status: "PASS", evidence });
  } catch (err) {
    return finish({ status: "ERROR", error: err.message, stack: err.stack, evidence });
  } finally {
    if (!bridgeStopped) {
      await bridge.stop();
      log("[MCP] Đã dừng tiến trình `maestro mcp`.");
    }
  }
}

main()
  .then((result) => {
    printReport(result);
    log(`\nĐã ghi report ra ${OUTPUT_FILE}`);
    process.exit(result.status === "PASS" ? 0 : result.status === "BLOCKED" ? 3 : 1);
  })
  .catch((err) => {
    console.error("\n[pro_lamlai_fullluong] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    finish({ status: "ERROR", error: err.message, stack: err.stack });
    process.exit(2);
  });
