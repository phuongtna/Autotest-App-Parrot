#!/usr/bin/env node
/**
 * PRO-Lamlai-Fullluong-Xemchitiet — kịch bản GHÉP 3 case đã verify riêng lẻ trong repo, chạy nối
 * tiếp trên CÙNG 1 card thật (không phải 3 lượt chạy độc lập rồi so sánh):
 *
 *   [A] Chuyển sang hồ sơ PRO "Ngoc" (COPY `ensureProProfileActive()` của
 *       flows/giao_bai_tap/e2e-ktra-fullluong-lambai-scored-pro.mjs - đã verify PASS).
 *   [B] Tìm 1 card ĐÃ HOÀN THÀNH TRƯỚC ĐÓ (cta="Làm lại") trong "Bài tập về nhà" - tái dùng
 *       `findCompletedCardsWithLinkBounds()`/`collectNodesWithBoundsInsideScrollableList()`/
 *       `parseBounds()` (BẢN ĐÃ SỬA BUG NaN, xem docblock gốc) của flows/bai_tap/xemchitietbailam.mjs,
 *       MỞ RỘNG để giữ thêm bounds của chính CTA "Làm lại" (không chỉ "Xem bài đã làm") + dòng
 *       "Hạn nộp DD/MM" gần nhất phía TRƯỚC card (không có trên completed card - card completed
 *       không hiện Hạn nộp, xem verify-filter-web-vs-app.mjs dòng "KHÔNG có dòng Hạn nộp nào" -
 *       field này CHỈ dùng khi cần disambiguate ≥2 room cùng title, có thể null).
 *   [C] Resolve room_id DUY NHẤT cho candidate đó qua `getHomeworks({period:"MONTH"})` +
 *       `resolveMyStatus()` (automation/bai_tap/model/homeworkModel.js) - loại bỏ HẲN candidate nếu
 *       không match được ĐÚNG 1 room (KHÔNG đoán `matches[0]`, xem cảnh báo thật trong
 *       teacherMaterialsExamResolver.js docblock: lớp 3B đã có nhiều room trùng title từ các lần
 *       test trước) - disambiguate thêm bằng Hạn nộp nếu cần.
 *   [D] Resolve câu hỏi/đáp án thật qua `resolveHomeworkExamQuestionsForRoomId(roomId)`
 *       (automation/bai_tap/discovery/teacherMaterialsExamResolver.js) + check `is_swap_answer`/
 *       `is_swap_question`/`isTextChoiceCompatible`/`computeScorePlan` - COPY nguyên các hàm helper
 *       (`computeScorePlan`, `buildWantCorrectPlan`, `isTextChoiceCompatible`, `findMatchingQuestion`,
 *       `answerOneQuestion`) từ e2e-ktra-fullluong-lambai-scored-pro.mjs.
 *   [E] Tap "Làm lại" (tap theo TOẠ ĐỘ đã capture ở [B], KHÔNG dùng text CTA làm scroll target/
 *       selector mù - đúng nguyên tắc AN TOÀN của xemchitietbailam.mjs) -> xử lý popup "AI hỗ trợ
 *       học tập" -> verify `exercise_close_button` (màn Doing).
 *   [F] Trả lời TẤT CẢ câu hỏi cho điểm THẬT rơi vào [6.0, 8.0] - COPY NGUYÊN vòng lặp
 *       answerOneQuestion()/HomeworkExamEngine của file [9/N] trong e2e-ktra-fullluong-lambai-scored-pro.mjs,
 *       rồi đọc + verify điểm qua `exam.isResultScreen()`/`exam.readResult()`, đóng kết quả về
 *       `homework_screen` (pattern "Hoàn thành"/`exercise_result_close_button` giống hệt).
 *   [G] Từ màn danh sách, TÌM LẠI ĐÚNG card đó (cùng title + Hạn nộp nếu có) - card giờ lại có
 *       cta="Làm lại" (đã redo xong, thêm 1 lượt attempt) + dòng "Điểm <n>" MỚI - dùng LẠI
 *       `findCompletedCardsWithLinkBounds()` (không scrollUntilVisible theo text CTA).
 *   [H] Chạy đúng luồng "xem chi tiết" (case xemchitietbailam.yaml/HW-16+17) TRÊN CHÍNH card vừa
 *       redo: tap "Xem bài đã làm" -> verify màn lịch sử ("Lần 1"/Điểm/Đúng/Thời gian nộp/Làm lại) ->
 *       xác nhận attempt MỚI NHẤT hiển thị trước (đọc thứ tự "Lần N" thật trên màn, KHÔNG giả định
 *       index 0 = mới nhất mà không verify) -> tap "Xem chi tiết" trên attempt đó -> verify màn xem
 *       lại đáp án -> bấm "Tiếp theo" hết câu (kiểm tra "Xem xong" TRƯỚC mỗi lượt tap, không suy đoán
 *       theo số thứ tự - đã có bug thật ghi trong xemchitietbailam.mjs) -> chụp screenshot -> tap
 *       "Xem xong" -> verify về lại màn danh sách Bài tập.
 *
 * AN TOÀN (kế thừa nguyên văn từ 2 file gốc, KHÔNG nới lỏng):
 *   - KHÔNG BAO GIỜ dùng text CTA ("Làm lại"/"Xem bài đã làm"/"Tiếp tục") làm target scrollUntilVisible
 *     hay selector text+below+index của Maestro (đã xác nhận có thể đọc SAI/tap nhầm) - CHỈ swipe thô
 *     + đọc hierarchy để phân loại CẤU TRÚC rồi tap CÓ CHỦ ĐÍCH bằng toạ độ.
 *   - `tapOn` success=true KHÔNG phải bằng chứng đã tap TRÚNG - luôn verify bằng `isVisible()`/
 *     hierarchy đọc lại SAU khi tap (bug thật: "Xem xong" tap tại Câu 1 vẫn success=true).
 *   - KHÔNG đoán `matches[0]` khi resolve room theo title - phải resolve về ĐÚNG 1 room, nếu không
 *     move sang candidate khác (bounded).
 *   - `parseQuestionsFromExamPage()`/`resolveHomeworkExamQuestionsForRoomId()` có flaky networkidle
 *     đã đo thật (~1/3 fail) - retry BOUNDED tối đa 2 lần/candidate (KHÔNG vô hạn).
 *
 * CHẠY: node flows/bai_tap/pro_lamlai_fullluong_xemchitiet.mjs
 * ENV: APP_ID (.env), PHONE/OTP (test_data/accounts.env), MAESTRO_DEVICE (tuỳ chọn),
 *   PROFILE_PRO_NAME (default "Ngoc"), ASSIGN_PRIMARY_CLASS (default "3B"),
 *   TARGET_CLASS_ID (default "b3336062-cacd-4d1a-a0af-4de44acf33d2"),
 *   TARGET_STUDENT_ID (default "d87364c2-ad26-4136-8f7a-9078aff872ff").
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseEnvFile } from "../../automation/src/config.js";
import { MaestroMcpBridge } from "../../automation/bridge/maestroMcpBridge.js";
import { HomeworkExamEngine, decideAnswerAction } from "../../automation/bai_tap/navigation/homeworkExamEngine.js";
import { parseQuestionsFromExamPage } from "../../automation/discovery/examPageScraper.js";
import { normalizeQuestions } from "../../automation/model/questionModel.js";
import { resolveHomeworkExamQuestionsForRoomId } from "../../automation/bai_tap/discovery/teacherMaterialsExamResolver.js";
import { getHomeworks } from "../../automation/bai_tap/discovery/homeworks.js";
import { resolveMyStatus } from "../../automation/bai_tap/model/homeworkModel.js";
import { CTA_TEXTS, SECTION_HEADERS } from "../../automation/bai_tap/discovery/homeworkUiList.js";
import { formatDM } from "./verify-filter-web-vs-app.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "pro_lamlai_fullluong_xemchitiet_report.json");
const ACCOUNTS_ENV_PATH = join(PROJECT_ROOT, "test_data", "accounts.env");
const ROOT_ENV_PATH = join(PROJECT_ROOT, ".env");
const EXAM_SESSION_PATH = join(PROJECT_ROOT, "automation", ".cache", "exam_session.json");
const ACCOUNTS_ENV = parseEnvFile(ACCOUNTS_ENV_PATH);
const ROOT_ENV = parseEnvFile(ROOT_ENV_PATH);
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const PHONE = process.env.PHONE || ACCOUNTS_ENV.PHONE;
const OTP = process.env.OTP || ACCOUNTS_ENV.OTP;
const PROFILE_PRO_NAME = process.env.PROFILE_PRO_NAME || ACCOUNTS_ENV.PROFILE_PRO_NAME || "Ngoc";
const TARGET_CLASS = process.env.ASSIGN_PRIMARY_CLASS || "3B";
const TARGET_CLASS_ID = process.env.TARGET_CLASS_ID || "b3336062-cacd-4d1a-a0af-4de44acf33d2";
const TARGET_STUDENT_ID = process.env.TARGET_STUDENT_ID || "d87364c2-ad26-4136-8f7a-9078aff872ff";
const MAX_LOCATE_SCROLLS = 60; // cùng bậc với xemchitietbailam.mjs (đo thật ~15-20 lượt).
const MAX_CANDIDATE_ATTEMPTS = 10; // ngân sách thử candidate distinct trước khi BLOCKED.
const TARGET_SCORE_RANGE_LABEL = "[6.0, 8.0]";
const COMPLETED_CTA = "Làm lại";
const VIEW_LINK_TEXT = "Xem bài đã làm";
const ADVANCED_SECTION_HEADER = "Bài tập nâng cao";

function log(...args) {
  console.log(...args);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** ===================== card/hierarchy parsing (tái dùng flows/bai_tap/xemchitietbailam.mjs) ===================== */

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

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** BUG THẬT đã xác nhận + SỬA (xem docblock gốc flows/bai_tap/xemchitietbailam.mjs#parseBounds):
 * `m.slice(1)` đã bỏ m[0] rồi, KHÔNG được thêm dấu phẩy thừa khi destructure nữa (bản lỗi cũ
 * `[, x1, y1, x2, y2]` làm lệch 1 vị trí -> NaN). Giữ ĐÚNG bản đã sửa, không tái phát minh. */
function parseBounds(boundsStr) {
  const m = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(boundsStr ?? "");
  if (!m) return null;
  const [x1, y1, x2, y2] = m.slice(1).map(Number);
  return { x1, y1, x2, y2 };
}

function centerPoint(bounds) {
  return { x: Math.round((bounds.x1 + bounds.x2) / 2), y: Math.round((bounds.y1 + bounds.y2) / 2) };
}

/** BIẾN THỂ GIỮ BOUNDS của collectTextNodesInsideScrollableList() - giống hệt xemchitietbailam.mjs. */
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
 * MỞ RỘNG của findCompletedCardsWithLinkBounds() (xemchitietbailam.mjs) - THÊM bounds của chính CTA
 * "Làm lại" (không chỉ link "Xem bài đã làm") vì [E] cần tap "Làm lại" bằng toạ độ. Cũng bắt luôn
 * dòng "Hạn nộp DD/MM" đứng NGAY TRƯỚC title (nếu có - card completed thường KHÔNG có, giữ null) để
 * disambiguate khi resolve room_id ở [C] nếu title không unique.
 */
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
    // Hạn nộp đứng TRƯỚC title (nếu có) - node[i-2] khi node[i-1] là title thật.
    const maybeDueBeforeTitle = nodes[i - 2]?.text;
    const dueDateBefore = maybeDueBeforeTitle && DUE_DATE_PATTERN.test(maybeDueBeforeTitle) ? maybeDueBeforeTitle : null;

    let cta = null;
    let ctaBounds = null;
    let scoreText = null;
    let viewLinkBounds = null;
    for (let j = i + 1; j < Math.min(nodes.length, i + 1 + MAX_CTA_LOOKAHEAD); j++) {
      const t = nodes[j].text;
      if (SCORE_PATTERN.test(t)) scoreText = t;
      if (t === VIEW_LINK_TEXT) viewLinkBounds = nodes[j].bounds;
      if (CTA_TEXTS.includes(t)) {
        cta = t;
        ctaBounds = nodes[j].bounds;
        break;
      }
      if (PROGRESS_PATTERN.test(t) || SECTION_HEADERS.includes(t)) break;
    }
    if (cta === COMPLETED_CTA && ctaBounds) {
      results.push({ title, cta, ctaBounds, scoreText, viewLinkBounds, dueDateBefore });
    }
  }
  return { results, sectionSeen };
}

/**
 * Cuộn qua "Bài tập về nhà" gom DISTINCT candidate completed (theo title) - dừng NGAY khi header
 * "Bài tập nâng cao" xuất hiện (cùng PHẠM VI rule của xemchitietbailam.mjs) - KHÔNG dùng text CTA
 * làm target cuộn, chỉ swipe thô rồi đọc hierarchy CẤU TRÚC (đúng nguyên tắc AN TOÀN).
 */
async function collectDistinctCompletedCandidates(bridge, { maxScrolls, maxDistinct }) {
  const startedAt = Date.now();
  let sectionSeen = false;
  let enteredAdvanced = false;
  const byTitle = new Map(); // title -> candidate (giữ lần đầu gặp)

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
  return {
    candidates: [...byTitle.values()],
    scrollsUsed,
    timeMs: Date.now() - startedAt,
    enteredAdvanced,
  };
}

/** Đọc lại 1 card completed CỤ THỂ theo title (dùng cho [G] tìm lại card sau redo) - CÙNG cách
 * cuộn+đọc thô như collectDistinctCompletedCandidates(), dừng NGAY khi thấy đúng title đó. */
async function relocateCompletedCardByTitle(bridge, title, { maxScrolls }) {
  const startedAt = Date.now();
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
  // Cuộn về đầu trước (card vừa redo có thể đã bị đẩy lên/xuống khác vị trí ban đầu).
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
  return { found, scrollsUsed, timeMs: Date.now() - startedAt, enteredAdvanced };
}

/** ===================== EXAM_SESSION (COPY nguyên từ e2e-ktra-fullluong-lambai-scored-pro.mjs) ===================== */

function refreshExamSessionFromEnvCookie() {
  const examCookie = process.env.EXAM_COOKIE || ROOT_ENV.EXAM_COOKIE;
  if (!examCookie) {
    return { refreshed: false, reason: "EXAM_COOKIE không tồn tại trong .env - chạy get_tokens.sh trước." };
  }
  const session = { examOrigin: "https://exam.parrotedu.vn", cookieHeader: `Bearer=${examCookie}`, localStorage: {} };
  mkdirSync(dirname(EXAM_SESSION_PATH), { recursive: true });
  writeFileSync(EXAM_SESSION_PATH, JSON.stringify(session, null, 2), "utf8");
  return { refreshed: true, cookieHeaderLength: session.cookieHeader.length };
}

/** Retry BOUNDED (tối đa 2 lần) cho lỗi timeout-shaped của parseQuestionsFromExamPage() - CÙNG tinh
 * thần bounded-retry của e2e-ktra-fullluong-lambai-scored-pro.mjs, áp dụng cho
 * resolveHomeworkExamQuestionsForRoomId() (wrap parseQuestionsFromExamPage nội bộ, không tự retry). */
async function resolveHomeworkExamQuestionsForRoomIdWithRetry(roomId, maxAttempts = 2) {
  let last = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const resolved = await resolveHomeworkExamQuestionsForRoomId(roomId);
    if (resolved.status === "RESOLVED") return resolved;
    last = resolved;
    const looksTimeoutShaped = resolved.status === "SESSION_ERROR" && /Timeout \d+ms exceeded/.test(resolved.reason ?? "");
    if (!looksTimeoutShaped) return resolved;
    log(`    (retry ${attempt}/${maxAttempts} roomId=${roomId}: page.goto timeout - flaky networkidle đã biết, thử lại)`);
  }
  return last;
}

function isTextChoiceCompatible(questions) {
  if (!Array.isArray(questions) || questions.length < 3) return false;
  return questions.every((q) => {
    const nonEmptyAnswers = (q.answers ?? []).filter((a) => typeof a === "string" && a.trim().length > 0);
    return nonEmptyAnswers.length >= 2 && q.correctAnswer && nonEmptyAnswers.includes(q.correctAnswer);
  });
}

function computeScorePlan(totalCount) {
  let best = null;
  for (let c = 0; c <= totalCount; c++) {
    const predicted = Math.round((c / totalCount) * 100) / 10;
    if (predicted < 6.0 || predicted > 8.0) continue;
    const distanceToCenter = Math.abs(predicted - 7.0);
    const isBetter = !best || distanceToCenter < best.distanceToCenter;
    if (isBetter) best = { correctCount: c, predictedScore: predicted, distanceToCenter };
  }
  return best;
}

function buildWantCorrectPlan(questionIds, correctCount) {
  const shuffled = shuffle(questionIds);
  const correctSet = new Set(shuffled.slice(0, correctCount));
  const map = new Map();
  for (const id of questionIds) map.set(id, correctSet.has(id));
  return map;
}

async function findMatchingQuestion(bridge, pool, priorTree) {
  const tree = priorTree ?? (await bridge.hierarchy());
  const texts = collectAllTexts(tree);
  const isVisible = (t) => isVisibleInTree(texts, t);
  for (const q of pool) {
    const action = decideAnswerAction(tree, isVisible, q, true);
    if (action) return { ...q, _snapshot: { tree, texts } };
  }
  return null;
}

async function answerOneQuestion(exam, matched, isLast, wantCorrectMap) {
  const wantCorrect = wantCorrectMap.get(matched.id);
  const outcome = await exam.answerCurrentQuestionOneShot(matched, {
    wantCorrect,
    resultLabel: isLast ? "pro_lamlai_fullluong_result_screen" : null,
    snapshot: matched._snapshot ?? null,
  });
  if (!outcome.supported) {
    throw new Error(`Handler không hỗ trợ câu "${matched.question}" (id=${matched.id}): ${outcome.reason}`);
  }
  return { matched, wantCorrect, outcome };
}

/** ===================== [PHASE A] PROFILE (COPY ensureProProfileActive) ===================== */
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

/** ===================== [PHASE C] Resolve room_id DUY NHẤT cho 1 candidate ===================== */
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

// Quy đổi ISO -> {y,m0,d} giờ VN (UTC+7) - CÙNG công thức isoToVnYmd() của verify-filter-web-vs-app.mjs
// (hàm đó không export riêng biệt khỏi phần "export {}" cuối file - COPY công thức, KHÔNG import lại
// toàn bộ module phụ không cần thiết ở đây).
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
function isoToVnYmdLocal(iso) {
  const shifted = new Date(new Date(iso).getTime() + VN_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m0: shifted.getUTCMonth(), d: shifted.getUTCDate() };
}

/** ===================== output/report ===================== */

function finish(result) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  return result;
}

function printReport(r) {
  const e = r.evidence ?? {};
  log(`\n[PROFILE]`);
  log(`profile=${e.profile?.name ?? "-"} switched=${e.profile?.switched ?? "-"} verified=${e.profile?.verified ?? "-"}`);
  log(`\n[LOCATE_CANDIDATE]`);
  log(`title=${e.chosenCandidate?.title ?? "-"}`);
  log(`room_id=${e.chosenCandidate?.roomId ?? "-"}`);
  log(`question_count=${e.chosenCandidate?.questionCount ?? "-"}`);
  log(`candidates_tried=${e.candidatesTried ?? "-"}`);
  log(`\n[REDO]`);
  log(`tapped=${e.redo?.tapped ?? "-"}`);
  log(`landed_on_doing_screen=${e.redo?.landedOnDoing ?? "-"}`);
  log(`\n[SCORE]`);
  log(`planned_correct_count=${e.score?.plannedCorrectCount ?? "-"}`);
  log(`actual_score=${e.score?.actualScore ?? "-"}`);
  log(`target_range=6.0 <= score <= 8.0`);
  log(`score_in_range=${e.score?.inRange ?? "-"}`);
  log(`\n[RELOCATE]`);
  log(`relocated=${e.relocate?.found ?? "-"}`);
  log(`scrolls=${e.relocate?.scrollsUsed ?? "-"}`);
  log(`new_score_line=${e.relocate?.scoreText ?? "-"}`);
  log(`\n[DETAIL]`);
  log(`history_screen=${e.detail?.historyScreen ?? "-"}`);
  log(`latest_attempt_label=${e.detail?.latestAttemptLabel ?? "-"}`);
  log(`review_answer_screen=${e.detail?.reviewScreen ?? "-"}`);
  log(`questions_advanced=${e.detail?.questionsAdvanced ?? "-"}`);
  log(`screenshot=${e.detail?.screenshot ?? "-"}`);
  log(`\n[BACK]`);
  log(`returned_to_list=${e.back?.returnedToList ?? "-"}`);
  log(`\n[SAFETY]`);
  log(`unique_room_resolution_used=true (KHÔNG đoán matches[0])`);
  log(`cta_used_as_scroll_target=false`);
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

  log(`[EXAM_SESSION] Refresh session từ .env EXAM_COOKIE...`);
  const refreshResult = refreshExamSessionFromEnvCookie();
  evidence.examSession = { refreshed: refreshResult.refreshed };
  if (!refreshResult.refreshed) {
    return finish({ status: "BLOCKED", phase: "EXAM_SESSION_REFRESH", error: refreshResult.reason, evidence });
  }
  log(`  [PASS] automation/.cache/exam_session.json đã ghi (cookieHeader length=${refreshResult.cookieHeaderLength}).`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);

  try {
    // ===== [A] PROFILE =====
    log(`[A] Đảm bảo hồ sơ "${PROFILE_PRO_NAME}" (PRO) đang active...`);
    const profileResult = await ensureProProfileActive(bridge);
    evidence.profile = profileResult;
    log(`  [PASS] profile=${profileResult.name} switched=${profileResult.switched}`);

    // ===== [B] Gom candidate completed distinct =====
    log(`[B] Cuộn "Bài tập về nhà" gom candidate cta="Làm lại" (distinct theo title, budget ${MAX_CANDIDATE_ATTEMPTS})...`);
    const collected = await collectDistinctCompletedCandidates(bridge, {
      maxScrolls: MAX_LOCATE_SCROLLS,
      maxDistinct: MAX_CANDIDATE_ATTEMPTS,
    });
    evidence.candidatesFound = collected.candidates.length;
    log(`  Tìm được ${collected.candidates.length} candidate distinct sau ${collected.scrollsUsed} lượt cuộn (enteredAdvanced=${collected.enteredAdvanced}).`);
    if (collected.candidates.length === 0) {
      return finish({
        status: "BLOCKED",
        phase: "LOCATE_CANDIDATE",
        error: collected.enteredAdvanced
          ? `Hết section "Bài tập về nhà" mà chưa gặp card cta="${COMPLETED_CTA}" nào.`
          : `Hết ngân sách cuộn (${MAX_LOCATE_SCROLLS} lượt) mà chưa gặp card cta="${COMPLETED_CTA}" nào.`,
        evidence,
      });
    }

    // ===== [C]+[D] Thử từng candidate cho tới khi feasible =====
    log(`[C/D] Thử resolve room_id DUY NHẤT + nội dung câu hỏi khả thi cho từng candidate...`);
    const attempts = [];
    let chosen = null;
    for (const candidate of collected.candidates.slice(0, MAX_CANDIDATE_ATTEMPTS)) {
      const attempt = { title: candidate.title, dueDateBefore: candidate.dueDateBefore, scoreTextBefore: candidate.scoreText };
      const { matches, unique, room } = await resolveUniqueRoomIdForCandidate(candidate);
      attempt.roomMatchCount = matches.length;
      if (!unique) {
        attempt.ok = false;
        attempt.reason = `Resolve room_id KHÔNG unique (matches=${matches.length}) - loại, không đoán matches[0].`;
        attempts.push(attempt);
        log(`  [SKIP] "${candidate.title}": ${attempt.reason}`);
        continue;
      }
      attempt.roomId = room.id;
      const resolved = await resolveHomeworkExamQuestionsForRoomIdWithRetry(room.id);
      if (resolved.status !== "RESOLVED") {
        attempt.ok = false;
        attempt.reason = `resolveHomeworkExamQuestionsForRoomId status=${resolved.status}: ${resolved.reason}`;
        attempts.push(attempt);
        log(`  [SKIP] "${candidate.title}" (room_id=${room.id}): ${attempt.reason}`);
        continue;
      }
      const swapAnswer = resolved.roomDetails?.room?.exams?.[0]?.is_swap_answer ?? null;
      const swapQuestion = resolved.roomDetails?.room?.exams?.[0]?.is_swap_question ?? null;
      if (swapAnswer || swapQuestion) {
        attempt.ok = false;
        attempt.reason = `is_swap_answer=${swapAnswer}/is_swap_question=${swapQuestion} - không tin tưởng đáp án.`;
        attempts.push(attempt);
        log(`  [SKIP] "${candidate.title}" (room_id=${room.id}): ${attempt.reason}`);
        continue;
      }
      if (!isTextChoiceCompatible(resolved.questions)) {
        attempt.ok = false;
        attempt.reason = "UNSUPPORTED_TYPE_OR_MISSING_CORRECT_ANSWER";
        attempts.push(attempt);
        log(`  [SKIP] "${candidate.title}" (room_id=${room.id}): ${attempt.reason}`);
        continue;
      }
      const scorePlan = computeScorePlan(resolved.questions.length);
      if (!scorePlan) {
        attempt.ok = false;
        attempt.reason = `N=${resolved.questions.length} câu - không tồn tại correctCount nguyên trong ${TARGET_SCORE_RANGE_LABEL}.`;
        attempts.push(attempt);
        log(`  [SKIP] "${candidate.title}" (room_id=${room.id}): ${attempt.reason}`);
        continue;
      }
      attempt.ok = true;
      attempt.questionCount = resolved.questions.length;
      attempt.plannedCorrectCount = scorePlan.correctCount;
      attempts.push(attempt);
      log(`  [PASS] "${candidate.title}" (room_id=${room.id}) KHẢ THI: N=${resolved.questions.length}, correctCount kế hoạch=${scorePlan.correctCount} (dự đoán=${scorePlan.predictedScore}).`);
      chosen = { candidate, room, resolved, scorePlan };
      break;
    }
    evidence.candidatesTried = attempts.length;
    evidence.candidateAttempts = attempts;
    if (!chosen) {
      return finish({
        status: "BLOCKED",
        phase: "CANDIDATE_FEASIBILITY",
        error: `Đã thử ${attempts.length}/${collected.candidates.length} candidate distinct - không candidate nào resolve được room_id duy nhất + nội dung câu hỏi khả thi cho điểm ${TARGET_SCORE_RANGE_LABEL}.`,
        evidence,
      });
    }
    evidence.chosenCandidate = {
      title: chosen.candidate.title,
      roomId: chosen.room.id,
      questionCount: chosen.resolved.questions.length,
      plannedCorrectCount: chosen.scorePlan.correctCount,
    };

    // ===== [E] Tap "Làm lại" theo toạ độ đã capture =====
    log(`[E] Tap "Làm lại" tại toạ độ đã capture cho card "${chosen.candidate.title}"...`);
    const ctaPoint = centerPoint(chosen.candidate.ctaBounds);
    const tapRedo = await bridge.runSteps([
      { tapOn: { point: `${ctaPoint.x},${ctaPoint.y}` } },
      { waitForAnimationToEnd: { timeout: 3000 } },
      { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
      { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 15000 } },
    ]);
    evidence.redo = { tapped: tapRedo.success, landedOnDoing: tapRedo.success };
    if (!tapRedo.success) {
      return finish({ status: "FAIL", phase: "TAP_LAM_LAI", error: `Tap "Làm lại" (point ${ctaPoint.x},${ctaPoint.y}) thất bại hoặc không vào được màn Doing: ${tapRedo.error}`, evidence });
    }
    log(`  [PASS] Đã tap "Làm lại" tại (${ctaPoint.x},${ctaPoint.y}) - vào màn Doing (exercise_close_button visible).`);

    // ===== [F] Trả lời tất cả câu hỏi cho điểm [6.0, 8.0] =====
    const QUESTIONS = chosen.resolved.questions;
    const WANT_CORRECT = buildWantCorrectPlan(QUESTIONS.map((q) => q.id), chosen.scorePlan.correctCount);
    log(`[F] Trả lời TẤT CẢ ${QUESTIONS.length} câu (correctCount kế hoạch=${chosen.scorePlan.correctCount})...`);
    const answeredIds = new Set();
    const answerLog = [];
    let carryTree = null;
    let lastOutcome = null;
    while (answeredIds.size < QUESTIONS.length) {
      const pool = QUESTIONS.filter((q) => !answeredIds.has(q.id));
      const matched = await findMatchingQuestion(bridge, pool, carryTree);
      if (!matched) {
        return finish({
          status: "FAIL",
          phase: "ANSWER_LOOP",
          error: `Không khớp được câu hỏi nào (còn ${pool.length} câu).`,
          visibleTexts: collectAllTexts(await bridge.hierarchy()),
          evidence: { ...evidence, answerLog },
        });
      }
      const isLast = answeredIds.size === QUESTIONS.length - 1;
      const { wantCorrect, outcome } = await answerOneQuestion(exam, matched, isLast, WANT_CORRECT);
      lastOutcome = outcome;
      carryTree = outcome.finalTree ?? null;
      answeredIds.add(matched.id);
      answerLog.push({ id: matched.id, question: matched.question, wantCorrect, isTargetCorrect: outcome.isTargetCorrect });
      log(`  Câu ${answeredIds.size}/${QUESTIONS.length}: nhắm ${wantCorrect ? "ĐÚNG" : "SAI"}, isTargetCorrect=${outcome.isTargetCorrect}`);
    }
    evidence.answerLog = answerLog;

    const finalTree = lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(finalTree)) {
      return finish({ status: "FAIL", phase: "RESULT_SCREEN", error: "Không thấy màn hình Kết quả sau khi trả lời hết toàn bộ câu.", evidence });
    }
    const result = exam.readResult(finalTree);
    const scoreNumber = result.score === null ? null : Number(result.score);
    const scoreValid = scoreNumber !== null && !Number.isNaN(scoreNumber);
    const scoreInRange = scoreValid && scoreNumber >= 6.0 && scoreNumber <= 8.0;
    evidence.score = {
      plannedCorrectCount: chosen.scorePlan.correctCount,
      realCorrectCountFromResultScreen: result.correctCount,
      actualScore: scoreNumber,
      inRange: scoreInRange,
    };
    log(`  ĐIỂM SỐ=${result.score} CHÍNH XÁC=${result.correct} (in range ${TARGET_SCORE_RANGE_LABEL}=${scoreInRange})`);
    if (!scoreInRange) {
      return finish({ status: "FAIL", phase: "SCORE_VERIFY", error: `Điểm thật ${scoreNumber} nằm ngoài ${TARGET_SCORE_RANGE_LABEL}.`, evidence });
    }

    // Đóng kết quả -> homework_screen (COPY pattern gốc).
    await bridge.runSteps([
      { runFlow: { when: { visible: "Hoàn thành" }, commands: [{ tapOn: { text: ".*(Hoàn thành).*" } }] } },
      { runFlow: { when: { visible: "Tiếp theo" }, commands: [{ tapOn: { id: "exercise_result_close_button" } }] } },
    ]);
    const backToList = await bridge.wait({ id: "homework_screen" }, { timeout: 30000 });
    if (!backToList.success) {
      return finish({ status: "FAIL", phase: "CLOSE_RESULT", error: `Không quay lại được homework_screen sau khi đóng kết quả: ${backToList.error}`, evidence });
    }
    log(`  [PASS] Đã đóng màn Kết quả, quay lại homework_screen.`);

    // ===== [G] Tìm lại đúng card đó từ màn danh sách =====
    log(`[G] Tìm lại card "${chosen.candidate.title}" từ màn danh sách (sau redo, kỳ vọng lại cta="Làm lại" + điểm mới)...`);
    const relocate = await relocateCompletedCardByTitle(bridge, chosen.candidate.title, { maxScrolls: MAX_LOCATE_SCROLLS });
    evidence.relocate = {
      found: Boolean(relocate.found),
      scrollsUsed: relocate.scrollsUsed,
      scoreText: relocate.found?.scoreText ?? null,
    };
    if (!relocate.found) {
      return finish({ status: "FAIL", phase: "RELOCATE_CARD", error: `Không tìm lại được card "${chosen.candidate.title}" (cta="${COMPLETED_CTA}") sau khi redo (scrolls=${relocate.scrollsUsed}, enteredAdvanced=${relocate.enteredAdvanced}).`, evidence });
    }
    log(`  [PASS] Đã tìm lại card (scrolls=${relocate.scrollsUsed}), score line mới="${relocate.found.scoreText ?? "-"}".`);
    const relocatedCard = relocate.found;

    // ===== [H] Xem chi tiết (case xemchitietbailam.yaml) trên card vừa redo =====
    log(`[H] Tap "Xem bài đã làm" trên card vừa redo...`);
    const detail = {};
    if (!relocatedCard.viewLinkBounds) {
      return finish({ status: "FAIL", phase: "VIEW_COMPLETED", error: `Card "${chosen.candidate.title}" thiếu bounds "Xem bài đã làm" sau khi tìm lại.`, evidence: { ...evidence, detail } });
    }
    const linkPoint = centerPoint(relocatedCard.viewLinkBounds);
    const tapLink = await bridge.runSteps([{ tapOn: { point: `${linkPoint.x},${linkPoint.y}` } }]);
    detail.viewCompletedTapped = tapLink.success;
    if (!tapLink.success) {
      return finish({ status: "FAIL", phase: "VIEW_COMPLETED", error: `Tap "${VIEW_LINK_TEXT}" (point ${linkPoint.x},${linkPoint.y}) thất bại: ${tapLink.error}`, evidence: { ...evidence, detail } });
    }
    await bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1500 } }]);

    const treeAfterTap = await bridge.hierarchy();
    const textsAfterTap = collectAllTexts(treeAfterTap);
    const onHistoryScreen = textsAfterTap.some((t) => /Lần\s*\d+/.test(t));
    const titleMatchesOnScreen = textsAfterTap.some((t) => t.includes(chosen.candidate.title));
    detail.historyScreen = onHistoryScreen;
    if (!onHistoryScreen) {
      return finish({ status: "FAIL", phase: "HISTORY_LIST", error: `Không thấy màn lịch sử "Lần N" sau khi tap "${VIEW_LINK_TEXT}".`, evidence: { ...evidence, detail } });
    }
    if (!titleMatchesOnScreen) {
      return finish({ status: "FAIL", phase: "HISTORY_LIST", error: `Màn lịch sử KHÔNG hiện title đã chọn ("${chosen.candidate.title}") - nghi mở nhầm card.`, evidence: { ...evidence, detail } });
    }

    // Verify field HW-16 (Điểm/Đúng/Thời gian nộp/Làm lại) - COPY tiêu chí xemchitietbailam.mjs.
    const hasPoint = textsAfterTap.some((t) => /Điểm/.test(t));
    const hasCorrect = textsAfterTap.some((t) => /Đúng/.test(t));
    const hasSubmitTime = textsAfterTap.some((t) => /Thời gian nộp/.test(t));
    const hasRedo = textsAfterTap.some((t) => /Làm lại/.test(t));
    detail.historyFields = { hasPoint, hasCorrect, hasSubmitTime, hasRedo };
    if (!hasPoint || !hasCorrect || !hasSubmitTime || !hasRedo) {
      return finish({
        status: "FAIL",
        phase: "HISTORY_LIST",
        error: `Màn lịch sử thiếu field HW-16 (Điểm=${hasPoint}, Đúng=${hasCorrect}, Thời gian nộp=${hasSubmitTime}, Làm lại=${hasRedo}).`,
        evidence: { ...evidence, detail },
      });
    }
    log(`  [PASS] Màn lịch sử đủ field Điểm/Đúng/Thời gian nộp/Làm lại.`);

    // Xác định attempt MỚI NHẤT bằng cách ĐỌC thứ tự "Lần N" thật trên màn (không giả định index 0
    // = mới nhất mà không verify) - lấy toàn bộ số N xuất hiện, số LỚN NHẤT tương ứng lần làm gần
    // đây nhất (lượt vừa redo ở [F]); "Xem chi tiết" ĐẦU TIÊN xuất hiện trên màn (thứ tự DFS/top-to-
    // bottom) PHẢI tương ứng đúng "Lần N" lớn nhất đó, nếu không -> BLOCKED (không đoán).
    const lanNumbers = textsAfterTap.map((t) => /^Lần\s*(\d+)$/.exec(t)).filter(Boolean).map((m) => Number(m[1]));
    const maxLan = lanNumbers.length > 0 ? Math.max(...lanNumbers) : null;
    const maxLanIdx = textsAfterTap.findIndex((t) => t === `Lần ${maxLan}`);
    const firstXemChiTietIdx = textsAfterTap.findIndex((t) => t === "Xem chi tiết");
    // "Lần <maxLan>" phải đứng TRƯỚC "Xem chi tiết" đầu tiên trong thứ tự đọc (cùng khối attempt) -
    // nếu không xác nhận được quan hệ này, KHÔNG suy đoán tiếp, coi là BLOCKED.
    const latestAttemptOrderVerified = maxLan !== null && maxLanIdx !== -1 && firstXemChiTietIdx !== -1 && maxLanIdx < firstXemChiTietIdx;
    detail.latestAttemptLabel = maxLan !== null ? `Lần ${maxLan}` : null;
    detail.latestAttemptOrderVerified = latestAttemptOrderVerified;
    log(`  [ATTEMPT] Lần lớn nhất tìm thấy trên màn = ${detail.latestAttemptLabel ?? "-"} (order_verified=${latestAttemptOrderVerified}).`);
    if (!latestAttemptOrderVerified) {
      return finish({
        status: "BLOCKED",
        phase: "LATEST_ATTEMPT_VERIFY",
        error: `Không xác nhận được "Xem chi tiết" đầu tiên trên màn tương ứng đúng attempt mới nhất (Lần ${maxLan ?? "?"}) - không đoán, dừng lại.`,
        evidence: { ...evidence, detail },
      });
    }

    // ===== "Xem chi tiết" trên attempt mới nhất (đầu tiên trên màn) =====
    const detailVisibleCheck = await bridge.runSteps([
      { extendedWaitUntil: { visible: { text: ".*(Xem chi tiết).*" }, timeout: 20000 } },
    ]);
    detail.detailLinkVisible = detailVisibleCheck.success;
    if (!detailVisibleCheck.success) {
      return finish({ status: "FAIL", phase: "DETAIL_LINK", error: `Không thấy "Xem chi tiết": ${detailVisibleCheck.error}`, evidence: { ...evidence, detail } });
    }
    const tapDetail = await bridge.runSteps([{ tapOn: { text: "Xem chi tiết", index: 0 } }]);
    detail.detailLinkTapped = tapDetail.success;
    if (!tapDetail.success) {
      return finish({ status: "FAIL", phase: "DETAIL_LINK", error: `Tap "Xem chi tiết" thất bại: ${tapDetail.error}`, evidence: { ...evidence, detail } });
    }
    await bridge.runSteps([{ waitForAnimationToEnd: { timeout: 1500 } }]);

    const reviewCheck = await bridge.runSteps([
      { extendedWaitUntil: { visible: { text: ".*(Câu 1|Chính xác|Đúng|Parrot giải thích).*" }, timeout: 30000 } },
    ]);
    detail.reviewScreen = reviewCheck.success;
    if (!reviewCheck.success) {
      return finish({ status: "FAIL", phase: "REVIEW_SCREEN", error: `Không thấy màn xem lại đáp án: ${reviewCheck.error}`, evidence: { ...evidence, detail } });
    }

    const screenshotRelPath = "artifacts/pro-lamlai-fullluong-xemchitiet-show-answer";
    const screenshotAbsPath = join(PROJECT_ROOT, `${screenshotRelPath}.png`);
    await bridge.runSteps([{ takeScreenshot: screenshotRelPath }]);
    const screenshotExists = existsSync(screenshotAbsPath) && statSync(screenshotAbsPath).size > 0;
    detail.screenshot = screenshotExists ? `${screenshotRelPath}.png` : "NOT_VERIFIED";
    log(`  [DETAIL] screenshot ${screenshotExists ? "verified" : "KHÔNG xác nhận được"} tại ${screenshotAbsPath}`);

    // ===== Bấm "Tiếp theo" hết câu (CÙNG vòng lặp xemchitietbailam.mjs) =====
    const MAX_QUESTIONS = 30;
    let questionsAdvanced = 0;
    let onLastQuestion = await bridge.isVisible(`${escapeRegex("Xem xong")}.*`);
    while (!onLastQuestion && questionsAdvanced < MAX_QUESTIONS) {
      const nextVisible = await bridge.isVisible(`${escapeRegex("Tiếp theo")}.*`);
      if (!nextVisible) {
        return finish({
          status: "FAIL",
          phase: "NAVIGATE_REVIEW",
          error: `Không thấy "Tiếp theo" lẫn "Xem xong" sau ${questionsAdvanced} câu - kẹt giữa chừng.`,
          evidence: { ...evidence, detail },
        });
      }
      const tapNext = await bridge.runSteps([{ tapOn: { text: "Tiếp theo" } }, { waitForAnimationToEnd: { timeout: 1200 } }]);
      if (!tapNext.success) {
        return finish({ status: "FAIL", phase: "NAVIGATE_REVIEW", error: `Tap "Tiếp theo" thất bại ở câu thứ ${questionsAdvanced + 1}: ${tapNext.error}`, evidence: { ...evidence, detail } });
      }
      questionsAdvanced++;
      onLastQuestion = await bridge.isVisible(`${escapeRegex("Xem xong")}.*`);
    }
    detail.questionsAdvanced = questionsAdvanced;
    detail.reachedLastQuestion = onLastQuestion;
    if (!onLastQuestion) {
      return finish({
        status: "FAIL",
        phase: "NAVIGATE_REVIEW",
        error: `Đã bấm "Tiếp theo" ${questionsAdvanced} lần (chạm ngân sách ${MAX_QUESTIONS}) mà vẫn chưa thấy "Xem xong".`,
        evidence: { ...evidence, detail },
      });
    }
    log(`  [NAVIGATE] đã qua ${questionsAdvanced} câu, tới câu cuối (thấy "Xem xong").`);
    evidence.detail = detail;

    // ===== [BACK] "Xem xong" -> màn danh sách =====
    const back = await bridge.runSteps([{ tapOn: { text: "Xem xong" } }]);
    if (!back.success) {
      return finish({ status: "FAIL", phase: "BACK", error: `Tap "Xem xong" thất bại: ${back.error}`, evidence });
    }
    const backVerify = await bridge.runSteps([
      {
        extendedWaitUntil: {
          visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao|Bạn không có bài tập nào đang chờ|2 tuần gần nhất|1 tháng gần nhất).*" },
          timeout: 20000,
        },
      },
    ]);
    evidence.back = { returnedToList: backVerify.success };
    if (!backVerify.success) {
      return finish({ status: "FAIL", phase: "BACK", error: `Không quay về được màn danh sách bài tập sau "Xem xong": ${backVerify.error}`, evidence });
    }
    log(`  [PASS] "Xem xong" -> đã về màn danh sách Bài tập.`);

    evidence.totalDurationSeconds = (Date.now() - overallStart) / 1000;
    return finish({ status: "PASS", evidence });
  } catch (err) {
    return finish({ status: "ERROR", error: err.message, stack: err.stack, evidence });
  } finally {
    await bridge.stop();
    log("[MCP] Đã dừng tiến trình `maestro mcp`.");
  }
}

main()
  .then((result) => {
    printReport(result);
    log(`\nĐã ghi report ra ${OUTPUT_FILE}`);
    process.exit(result.status === "PASS" ? 0 : result.status === "BLOCKED" ? 3 : 1);
  })
  .catch((err) => {
    console.error("\n[pro_lamlai_fullluong_xemchitiet] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    finish({ status: "ERROR", error: err.message, stack: err.stack });
    process.exit(2);
  });
