#!/usr/bin/env node
/**
 * PRO-Lamlai-Beat-Previous-Score
 *
 * Case (theo yêu cầu mới nhất, THAY yêu cầu "không scoring" của flows/bai_tap/
 * pro_lamlai_fullluong.mjs): "chọn đại 1 bài nào đó, làm được ra kết quả cao hơn điểm trước đó của
 * bài là được". Tức là: chọn 1 card ĐÃ HOÀN THÀNH TRƯỚC ĐÓ trên hồ sơ PRO "Ngoc" (không cần chọn kỹ
 * theo tiêu chí gì đặc biệt - "chọn đại"), đọc ĐIỂM CŨ hiển thị trên card, bấm "Làm lại", trả lời
 * TẤT CẢ câu ĐÚNG (để tối đa hoá điểm, đảm bảo an toàn nhất để vượt điểm cũ trừ khi điểm cũ đã tuyệt
 * đối), verify điểm MỚI (đọc từ màn Kết quả thật) > điểm CŨ.
 *
 * KHÁC automation/bai_tap/pro_lamlai_fullluong.mjs (case trước, KHÔNG scoring, dùng
 * answer-current-exercise-generic.yaml - dispatcher đó tự khai không biết đúng/sai nên KHÔNG dùng
 * được để đảm bảo "cao hơn điểm trước") - ở ĐÂY bắt buộc phải biết đáp án ĐÚNG thật (CMS/Exam) để
 * chủ động trả lời đúng hết, KHÔNG phải giới hạn/over-engineer thêm mà là YÊU CẦU THẬT của case này.
 *
 * TÁI SỬ DỤNG (không viết lại logic đã verify):
 *   - [A] ensureProProfileActive(), [B] collectDistinctCompletedCandidates(),
 *     resolveUniqueRoomIdForCandidate() - COPY nguyên từ automation/bai_tap/pro_lamlai_fullluong.mjs
 *     (đã verify PASS phần locate/định danh).
 *   - EXAM_SESSION refresh + resolveHomeworkExamQuestionsForRoomIdWithRetry() + isTextChoiceCompatible()
 *     + findMatchingQuestion() - COPY nguyên từ automation/bai_tap/pro_lamlai_fullluong_xemchitiet.mjs
 *     (đã verify PASS phần resolve CMS/trả lời bằng HomeworkExamEngine).
 *   - KHÔNG dùng computeScorePlan/buildWantCorrectPlan (mục tiêu điểm CỐ ĐỊNH [6.0,8.0] của case
 *     KHÁC) - ở đây LUÔN nhắm ĐÚNG hết (wantCorrect=true mọi câu), vì mục tiêu chỉ là "cao hơn điểm
 *     cũ", trả lời đúng tối đa là cách an toàn nhất để đạt được (trừ khi điểm cũ đã tuyệt đối).
 *
 * CHỌN CANDIDATE: duyệt lần lượt các card cta="Làm lại" tìm được (thứ tự xuất hiện trên danh sách -
 * ĐÚNG tinh thần "chọn đại", không ưu tiên/né title nào) - chỉ BỎ QUA nếu (a) không resolve được
 * room_id DUY NHẤT (an toàn, không đoán), hoặc (b) không đọc được điểm CŨ từ card, hoặc (c) CMS
 * không resolve được nội dung/không tương thích text-choice (SPEAK/SORT - dispatcher chấm điểm thật
 * KHÔNG tự động hoá được, KHÁC dispatcher chung chỉ cần "bấm cho qua"). Chọn candidate ĐẦU TIÊN
 * thoả cả 3 điều kiện - KHÔNG duyệt hết để tìm "tốt nhất".
 *
 * CHẠY: node automation/bai_tap/pro_lamlai_beat_previous_score.mjs
 * ENV: APP_ID (.env), PHONE/OTP (test_data/accounts.env), EXAM_COOKIE (.env, get_tokens.sh),
 *   MAESTRO_DEVICE (tuỳ chọn), PROFILE_PRO_NAME (default "Ngoc"), TARGET_CLASS_ID/TARGET_STUDENT_ID
 *   (default như pro_lamlai_fullluong_xemchitiet.mjs).
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseEnvFile } from "../src/config.js";
import { MaestroMcpBridge } from "../bridge/maestroMcpBridge.js";
import { HomeworkExamEngine, decideAnswerAction } from "./navigation/homeworkExamEngine.js";
import { resolveHomeworkExamQuestionsForRoomId } from "./discovery/teacherMaterialsExamResolver.js";
import { getHomeworks } from "./discovery/homeworks.js";
import { resolveMyStatus } from "./model/homeworkModel.js";
import { CTA_TEXTS, SECTION_HEADERS } from "./discovery/homeworkUiList.js";
import { formatDM } from "./verify-filter-web-vs-app.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "pro_lamlai_beat_previous_score_report.json");
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
const TARGET_CLASS_ID = process.env.TARGET_CLASS_ID || "b3336062-cacd-4d1a-a0af-4de44acf33d2";
const TARGET_STUDENT_ID = process.env.TARGET_STUDENT_ID || "d87364c2-ad26-4136-8f7a-9078aff872ff";
const MAX_LOCATE_SCROLLS = 60;
const MAX_CANDIDATE_ATTEMPTS = 10;
const COMPLETED_CTA = "Làm lại";
const ADVANCED_SECTION_HEADER = "Bài tập nâng cao";

function log(...args) {
  console.log(...args);
}

/** ===================== card/hierarchy parsing (COPY nguyên từ pro_lamlai_fullluong.mjs) ===================== */

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
  return { candidates: [...byTitle.values()], scrollsUsed, enteredAdvanced };
}

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

/** ===================== EXAM_SESSION + CMS resolve (COPY nguyên từ pro_lamlai_fullluong_xemchitiet.mjs) ===================== */

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

async function answerOneQuestion(exam, matched, isLast) {
  const outcome = await exam.answerCurrentQuestionOneShot(matched, {
    wantCorrect: true,
    resultLabel: isLast ? "pro_lamlai_beat_previous_score_result_screen" : null,
    snapshot: matched._snapshot ?? null,
  });
  if (!outcome.supported) {
    throw new Error(`Handler không hỗ trợ câu "${matched.question}" (id=${matched.id}): ${outcome.reason}`);
  }
  return outcome;
}

function parsePreviousScore(scoreText) {
  const m = /Điểm\s*([0-9]+(?:[.,][0-9]+)?)/.exec(scoreText ?? "");
  if (!m) return null;
  return Number(m[1].replace(",", "."));
}

/** ===================== [A] PROFILE (COPY nguyên) ===================== */
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
  log(`\n[CANDIDATE]`);
  log(`title=${e.chosenCandidate?.title ?? "-"}`);
  log(`room_id=${e.chosenCandidate?.roomId ?? "-"}`);
  log(`candidates_found=${e.candidatesFound ?? "-"}`);
  log(`candidates_tried=${e.candidatesTried ?? "-"}`);
  if (Array.isArray(e.candidateAttempts)) {
    for (const a of e.candidateAttempts) log(`  - "${a.title}": ${a.ok ? "OK, chosen" : a.reason}`);
  }
  log(`\n[SCORE]`);
  log(`previous_score=${e.score?.previousScore ?? "-"}`);
  log(`actual_score=${e.score?.actualScore ?? "-"}`);
  log(`improved=${e.score?.improved ? "YES" : "NO"}`);
  log(`\n[FLOW]`);
  log(`assignment_opened=${e.redo?.landedOnDoing ? "YES" : "NO"}`);
  log(`result_screen=${e.score?.actualScore != null ? "YES" : "NO"}`);
  log(`returned_to_list=${e.back?.returnedToList ? "YES" : "NO"}`);
  log(`\n[SAFETY]`);
  log(`new_assignments_created=0 (dùng lại bài đã hoàn thành trước đó)`);
  log(`unique_room_resolution_used=true (không đoán matches[0])`);
  log(`\n[PERFORMANCE]`);
  log(`duration=${e.totalDurationSeconds != null ? `${e.totalDurationSeconds.toFixed(1)}s` : "-"}`);
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
  if (!refreshResult.refreshed) {
    return finish({ status: "BLOCKED", phase: "EXAM_SESSION_REFRESH", error: refreshResult.reason, evidence });
  }
  log(`  [PASS] automation/.cache/exam_session.json đã ghi.`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);

  try {
    log(`[A] Đảm bảo hồ sơ "${PROFILE_PRO_NAME}" (PRO) đang active...`);
    const profileResult = await ensureProProfileActive(bridge);
    evidence.profile = profileResult;
    log(`  [PASS] profile=${profileResult.name} switched=${profileResult.switched}`);

    log(`[B] Cuộn "Bài tập về nhà" gom candidate cta="Làm lại" (distinct theo title, budget ${MAX_CANDIDATE_ATTEMPTS})...`);
    const collected = await collectDistinctCompletedCandidates(bridge, { maxScrolls: MAX_LOCATE_SCROLLS, maxDistinct: MAX_CANDIDATE_ATTEMPTS });
    evidence.candidatesFound = collected.candidates.length;
    log(`  Tìm được ${collected.candidates.length} candidate distinct sau ${collected.scrollsUsed} lượt cuộn.`);
    if (collected.candidates.length === 0) {
      return finish({ status: "BLOCKED", phase: "LOCATE_CANDIDATE", error: `Chưa có card cta="${COMPLETED_CTA}" nào trên hồ sơ "${PROFILE_PRO_NAME}".`, evidence });
    }

    log(`[C] Chọn ĐẠI candidate đầu tiên thoả: room_id unique + đọc được điểm cũ + CMS resolve được nội dung text-choice...`);
    const attempts = [];
    let chosen = null;
    for (const candidate of collected.candidates.slice(0, MAX_CANDIDATE_ATTEMPTS)) {
      const attempt = { title: candidate.title };
      const previousScore = parsePreviousScore(candidate.scoreText);
      if (previousScore === null) {
        attempt.ok = false;
        attempt.reason = `Không đọc được điểm cũ từ card (scoreText="${candidate.scoreText ?? "-"}").`;
        attempts.push(attempt);
        log(`  [SKIP] "${candidate.title}": ${attempt.reason}`);
        continue;
      }
      const { matches, unique, room } = await resolveUniqueRoomIdForCandidate(candidate);
      if (!unique) {
        attempt.ok = false;
        attempt.reason = `Resolve room_id KHÔNG unique (matches=${matches.length}) - loại, không đoán matches[0].`;
        attempts.push(attempt);
        log(`  [SKIP] "${candidate.title}": ${attempt.reason}`);
        continue;
      }
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
        attempt.reason = "UNSUPPORTED_TYPE (SPEAK/SORT/khác) - CMS không đủ dữ liệu để tự động trả lời đúng.";
        attempts.push(attempt);
        log(`  [SKIP] "${candidate.title}" (room_id=${room.id}): ${attempt.reason}`);
        continue;
      }
      attempt.ok = true;
      attempts.push(attempt);
      log(`  [PASS] "${candidate.title}" (room_id=${room.id}) - N=${resolved.questions.length} câu, điểm cũ=${previousScore}. Chọn candidate này.`);
      chosen = { candidate, room, resolved, previousScore };
      break;
    }
    evidence.candidatesTried = attempts.length;
    evidence.candidateAttempts = attempts;
    if (!chosen) {
      return finish({
        status: "BLOCKED",
        phase: "CANDIDATE_FEASIBILITY",
        error: `Đã thử ${attempts.length}/${collected.candidates.length} candidate - không candidate nào vừa unique vừa CMS-resolvable (text-choice).`,
        evidence,
      });
    }
    evidence.chosenCandidate = { title: chosen.candidate.title, roomId: chosen.room.id };

    log(`[D] Tap "Làm lại" tại toạ độ đã capture cho card "${chosen.candidate.title}"...`);
    const ctaPoint = centerPoint(chosen.candidate.ctaBounds);
    const tapRedo = await bridge.runSteps([
      { tapOn: { point: `${ctaPoint.x},${ctaPoint.y}` } },
      { waitForAnimationToEnd: { timeout: 3000 } },
      { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
      { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 15000 } },
    ]);
    evidence.redo = { tapped: tapRedo.success, landedOnDoing: tapRedo.success };
    if (!tapRedo.success) {
      return finish({ status: "FAIL", phase: "TAP_LAM_LAI", error: `Tap "Làm lại" (point ${ctaPoint.x},${ctaPoint.y}) thất bại: ${tapRedo.error}`, evidence });
    }
    log(`  [PASS] Đã tap "Làm lại" tại (${ctaPoint.x},${ctaPoint.y}) - vào màn Doing.`);

    log(`[E] Trả lời TẤT CẢ ${chosen.resolved.questions.length} câu ĐÚNG (mục tiêu: vượt điểm cũ=${chosen.previousScore})...`);
    const QUESTIONS = chosen.resolved.questions;
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
          evidence: { ...evidence, answerLog },
        });
      }
      const isLast = answeredIds.size === QUESTIONS.length - 1;
      const outcome = await answerOneQuestion(exam, matched, isLast);
      lastOutcome = outcome;
      carryTree = outcome.finalTree ?? null;
      answeredIds.add(matched.id);
      answerLog.push({ id: matched.id, question: matched.question, isTargetCorrect: outcome.isTargetCorrect });
      log(`  Câu ${answeredIds.size}/${QUESTIONS.length}: nhắm ĐÚNG, isTargetCorrect=${outcome.isTargetCorrect}`);
    }
    evidence.answerLog = answerLog;

    const finalTree = lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(finalTree)) {
      return finish({ status: "FAIL", phase: "RESULT_SCREEN", error: "Không thấy màn hình Kết quả sau khi trả lời hết toàn bộ câu.", evidence });
    }
    const result = exam.readResult(finalTree);
    const actualScore = result.score === null ? null : Number(result.score);
    const improved = actualScore !== null && !Number.isNaN(actualScore) && actualScore > chosen.previousScore;
    evidence.score = { previousScore: chosen.previousScore, actualScore, realCorrectCount: result.correctCount, improved };
    log(`  ĐIỂM CŨ=${chosen.previousScore} ĐIỂM MỚI=${result.score} CHÍNH XÁC=${result.correct} (improved=${improved})`);
    if (!improved) {
      return finish({
        status: "FAIL",
        phase: "SCORE_VERIFY",
        error: `Điểm mới ${actualScore} KHÔNG cao hơn điểm cũ ${chosen.previousScore} (có thể điểm cũ đã tuyệt đối, hoặc 1 câu bị chấm sai dù nhắm đúng - xem answerLog).`,
        evidence,
      });
    }

    await bridge.runSteps([
      { runFlow: { when: { visible: "Hoàn thành" }, commands: [{ tapOn: { text: ".*(Hoàn thành).*" } }] } },
      { runFlow: { when: { visible: "Tiếp theo" }, commands: [{ tapOn: { id: "exercise_result_close_button" } }] } },
    ]);
    const backToList = await bridge.wait({ id: "homework_screen" }, { timeout: 30000 });
    evidence.back = { returnedToList: backToList.success };
    if (!backToList.success) {
      return finish({ status: "FAIL", phase: "CLOSE_RESULT", error: `Không quay lại được homework_screen sau khi đóng kết quả: ${backToList.error}`, evidence });
    }
    log(`  [PASS] Đã đóng màn Kết quả, quay lại homework_screen.`);

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
    console.error("\n[pro_lamlai_beat_previous_score] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    finish({ status: "ERROR", error: err.message, stack: err.stack });
    process.exit(2);
  });
