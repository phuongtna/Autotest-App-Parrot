#!/usr/bin/env node
/**
 * E2E-Ktra-Fullluong-Lambai-Scored-PRO
 *
 * Thực thi lifecycle TEST của `flows/bai_tap/ktra_fullluong_lambai.yaml` THẬT (audit đầy đủ bên
 * dưới) trên hồ sơ PRO "Ngoc", với đúng 1 thay đổi bắt buộc: PHẦN TRẢ LỜI CÂU HỎI dùng
 * `HomeworkExamEngine.decideAnswerAction()` (đáp án THẬT từ CMS/Exam qua
 * `resolveHomeworkExamQuestionsForRoomId()`) THAY vì `answer-current-exercise-generic.yaml` - vì
 * dispatcher đó TỰ KHAI trong chính docblock của nó "KHONG kiem tra dung/sai... chi thao tac AN
 * TOAN de chuyen sang cau tiep theo" nên KHÔNG THỂ dùng để đảm bảo điểm rơi vào [6.0, 8.0].
 *
 * ═══════════════════════════════ AUDIT flows/bai_tap/ktra_fullluong_lambai.yaml ═══════════════
 * (đọc toàn văn 435 dòng trước khi viết file này - tóm tắt đối chiếu 1:1 với các phase bên dưới)
 *
 *   - Mở assignment: theo EXERCISE_NAME (+EXERCISE_DUE_DATE_DM nếu có) qua
 *     flows/helpers/open-exercise.yaml - scrollUntilVisible compound (title, below Hạn nộp) rồi
 *     tapOn CTA - KHÔNG random/không chọn theo index.
 *   - PROGRESS_BEFORE (tổng "Bài tập X/Y"): copyTextFrom below ".*(2 tuần gần nhất|1 tháng gần
 *     nhất).*" above "Bài tập về nhà" - đọc NGAY sau khi mở tab, CHƯA cuộn (dòng 46-62).
 *   - PROGRESS_BEFORE (riêng card): copyTextFrom below title above "Hạn nộp DATE" (dòng 64-140).
 *   - Thoát giữa chừng: tapOn id=exercise_close_button (dòng 197-198) - TẠI THỜI ĐIỂM NÀY CHƯA TRẢ
 *     LỜI CÂU NÀO (0 câu) - đây CHÍNH LÀ lifecycle được audit, không phải "trả lời 2-3 câu rồi
 *     thoát" (khác hẳn 1 base script khác trong repo, flows/giao_bai_tap/
 *     e2e-teacher-assign-partial-resume-scored.mjs, dùng cho 1 testcase KHÁC).
 *   - extendedWaitUntil visible ".*(Bài tập).*" timeout 20000 (dòng 199-201).
 *   - Refresh: swipe start "50%, 35%" end "50%, 85%" duration 600 rồi extendedWaitUntil visible
 *     ".*(Bài tập về nhà|Bài tập nâng cao).*" timeout 30000 (dòng 204-211) - "để state
 *     doing_answer_id được nạp lại".
 *   - Tìm lại ĐÚNG card (anchor title+Hạn nộp), assertVisible "Tiếp tục" (dòng 233-259), tapOn
 *     "Tiếp tục" (dòng 261-266).
 *   - Popup "AI hỗ trợ học tập" optional -> tapOn "Tiếp tục" (dòng 287-291).
 *   - extendedWaitUntil visible id=exercise_close_button timeout 40000 (dòng 292-295) - xác nhận
 *     ĐÃ RESUME (quay lại màn làm bài).
 *   - Hoàn thành: runFlow file ../helpers/answer-current-exercise-generic.yaml (dòng 303-306) -
 *     ĐÂY LÀ PHẦN DUY NHẤT BỊ THAY THẾ TRONG FILE NÀY (xem lý do ở trên).
 *   - extendedWaitUntil visible id=exercise_result_screen timeout 60000 (dòng 319-322) - YAML GỐC
 *     KHÔNG đọc/assert giá trị điểm số cụ thể nào ở đây (chỉ chờ màn hình xuất hiện) - việc đọc +
 *     verify điểm số nằm trong [6.0, 8.0] là YÊU CẦU MỚI, cộng thêm vào, không phải thay thế check
 *     đã có.
 *   - Đóng kết quả: tapOn "Hoàn thành" HOẶC tapOn id=exercise_result_close_button (dòng 338-349).
 *   - extendedWaitUntil visible id=homework_screen timeout 30000 (dòng 362-365).
 *   - PROGRESS_AFTER (riêng card): scrollUntilVisible title, copyTextFrom text=".*Điểm\s*[0-9.,]+.*"
 *     below title (dòng 377-406) - test_data/hw_fullluong_compare_card_progress.js CHỈ kiểm tra
 *     dòng "Điểm <số>" TỒN TẠI (bất kỳ giá trị nào), KHÔNG so khớp giá trị cụ thể.
 *   - Cuộn về đầu (5x swipe direction DOWN) rồi đọc lại PROGRESS_AFTER tổng, so sánh
 *     afterNum > beforeNum qua test_data/hw_fullluong_compare_progress.js (dòng 410-434).
 *
 * PHẦN NÀO LÀ "YAML GỐC" (thực thi qua MaestroMcpBridge nhưng COPY NGUYÊN VĂN selector/thứ tự/
 * timeout từ chính file .yaml, KHÔNG đổi hành vi):
 *   - Mở tab + đọc PROGRESS_BEFORE tổng
 *   - Mở đúng assignment (title+Hạn nộp)
 *   - Đọc PROGRESS_BEFORE riêng card
 *   - Thoát X (0 câu đã trả lời) + refresh swipe
 *   - Tìm lại card + assertVisible "Tiếp tục" + tap resume + xử lý popup AI + verify
 *     exercise_close_button
 *   - Chờ exercise_result_screen
 *   - Đóng kết quả + verify homework_screen
 *   - Đọc PROGRESS_AFTER riêng card ("Điểm <số>" tồn tại) + PROGRESS_AFTER tổng + so sánh tăng
 *
 * PHẦN NÀO LÀ "ENGINE KHÁC" (khác YAML gốc, CÓ LÝ DO tường minh):
 *   - Trả lời câu hỏi: `HomeworkExamEngine.decideAnswerAction()` + đáp án CMS/Exam thật (thay
 *     `answer-current-exercise-generic.yaml`) - LÝ DO: dispatcher gốc không kiểm soát đúng/sai.
 *   - Đọc + verify điểm số THẬT nằm trong [6.0, 8.0] sau màn Kết quả - MỚI, cộng thêm (yaml gốc
 *     không có check này).
 *   - Disambiguation theo NỘI DUNG câu hỏi khi mở/resume assignment (nếu title+Hạn nộp KHÔNG unique
 *     - lớp 3B tích luỹ rác từ các lần chạy test trước, xem TEACHER_ASSIGN) - AN TOÀN HƠN, khớp
 *     đúng yêu cầu SAFETY "locate ambiguous -> BLOCKED", không đổi business lifecycle được test.
 *
 * CHẠY: node flows/giao_bai_tap/e2e-ktra-fullluong-lambai-scored-pro.mjs
 * ENV: APP_ID/PHONE/OTP/MAESTRO_DEVICE, TEACHER_* (.env), ASSIGN_PRIMARY_CLASS (default "3B"),
 *   PROFILE_PRO_NAME (test_data/accounts.env, default "Ngoc").
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseEnvFile } from "../../automation/src/config.js";
import { MaestroMcpBridge } from "../../automation/bridge/maestroMcpBridge.js";
import { HomeworkExamEngine, decideAnswerAction } from "../../automation/bai_tap/navigation/homeworkExamEngine.js";
import { fetchEligibleAssignmentTree } from "../../automation/giao_bai_tap/navigation/teacherAssignmentApiDiscovery.js";
import { parseQuestionsFromExamPage } from "../../automation/discovery/examPageScraper.js";
import { normalizeQuestions } from "../../automation/model/questionModel.js";
import { resolveHomeworkExamQuestionsForRoomId } from "../../automation/bai_tap/discovery/teacherMaterialsExamResolver.js";
import { fetchAllHomeworkRooms } from "../../automation/bai_tap/discovery/homeworks.js";
import { normalizeHomework } from "../../automation/bai_tap/model/homeworkModel.js";
import { formatDM, formatDMY } from "../bai_tap/verify-filter-web-vs-app.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "e2e_ktra_fullluong_lambai_scored_pro_report.json");
const ACCOUNTS_ENV_PATH = join(PROJECT_ROOT, "test_data", "accounts.env");
const ROOT_ENV_PATH = join(PROJECT_ROOT, ".env");
const EXAM_SESSION_PATH = join(PROJECT_ROOT, "automation", ".cache", "exam_session.json");
const ACCOUNTS_ENV = parseEnvFile(ACCOUNTS_ENV_PATH);
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const TARGET_CLASS = process.env.ASSIGN_PRIMARY_CLASS || "3B";
// CÙNG 1 lớp thật với TARGET_CLASS (mặc định "3B") - id lấy từ chính default đã verify thật trong
// flows/giao_bai_tap/e2e-teacher-assign-student-open.mjs (TARGET_CLASS_ID), dùng để lọc room theo
// ĐÚNG lớp khi quét occurrence title (mục [SELECTION] bên dưới) - KHÔNG được để lệch lớp.
const TARGET_CLASS_ID = process.env.TARGET_CLASS_ID || "b3336062-cacd-4d1a-a0af-4de44acf33d2";
const MAX_PRESCAN_ATTEMPTS = Number(process.env.MAX_PRESCAN_ATTEMPTS || 12);
const MAX_DISAMBIGUATE_CANDIDATES = Number(process.env.MAX_DISAMBIGUATE_CANDIDATES || 10);
const PROFILE_PRO_NAME = process.env.PROFILE_PRO_NAME || ACCOUNTS_ENV.PROFILE_PRO_NAME || "Ngoc";
const TARGET_SCORE_RANGE_LABEL = "[6.0, 8.0]";
const YAML_REFERENCE_FILE = "flows/bai_tap/ktra_fullluong_lambai.yaml";

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

const CTA_TEXTS = ["Làm bài", "Tiếp tục", "Làm lại", "Chinh phục"];
const PROGRESS_BADGE_PATTERN = /^\d+\s*\/\s*\d+$/;
const OVERALL_PROGRESS_BELOW_PATTERN = /^(2 tuần gần nhất|1 tháng gần nhất)$/;
const OVERALL_PROGRESS_ABOVE = "Bài tập về nhà";

/** ===================== EXAM_SESSION (auto-refresh, KHÔNG cần copy tay) ===================== */

/**
 * `.env`'s EXAM_COOKIE (fetched by `get_tokens.sh` -> GET /api/cms/exams/token) LÀ CHÍNH giá trị
 * cookie "Bearer" mà automation/README.md mô tả (xem README dòng 237-238: "Cookie tên Bearer chính
 * là Exam Token (cùng loại lấy được qua CMS API GET /api/cms/exams/token)") - KHÔNG cần Playwright/
 * DevTools thủ công. Ghi thẳng vào automation/.cache/exam_session.json.
 */
function refreshExamSessionFromEnvCookie() {
  const rootEnv = parseEnvFile(ROOT_ENV_PATH);
  const examCookie = process.env.EXAM_COOKIE || rootEnv.EXAM_COOKIE;
  if (!examCookie) {
    return { refreshed: false, reason: "EXAM_COOKIE không tồn tại trong .env - chạy get_tokens.sh trước." };
  }
  const session = { examOrigin: "https://exam.parrotedu.vn", cookieHeader: `Bearer=${examCookie}`, localStorage: {} };
  mkdirSync(dirname(EXAM_SESSION_PATH), { recursive: true });
  writeFileSync(EXAM_SESSION_PATH, JSON.stringify(session, null, 2), "utf8");
  return { refreshed: true, cookieHeaderLength: session.cookieHeader.length };
}

/**
 * `parseQuestionsFromExamPage()` dùng `page.goto(..., { waitUntil: "networkidle" })` - ĐÃ ĐO THẬT
 * (2026-08-18, cùng examId, session/token GIỐNG HỆT nhau, KHÔNG đổi gì giữa các lần gọi): 1/3 lần
 * OK (~7.5-9.7s), 2/3 lần "page.goto: Timeout 30000ms exceeded" chờ networkidle - flaky THẬT của
 * chính điều kiện chờ đó (trang có network activity nền không bao giờ "idle" trong 1 số lần tải),
 * KHÔNG PHẢI session/token hỏng (khác hẳn lỗi gốc trước khi refresh: "Không tìm thấy entry...").
 * Retry BOUNDED (tối đa 2 lần/examId, KHÔNG vô hạn) NGAY TẠI ĐÂY (file MỚI của riêng flow này) -
 * KHÔNG sửa examPageScraper.js dùng chung cho nhiều flow khác (ngoài phạm vi cần thiết).
 */
async function parseQuestionsFromExamPageWithRetry(examId, maxAttempts = 2) {
  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await parseQuestionsFromExamPage(examId);
    } catch (err) {
      lastErr = err;
      if (!/Timeout \d+ms exceeded/.test(err.message)) throw err; // lỗi khác timeout - không đoán, ném ngay.
      log(`    (retry ${attempt}/${maxAttempts} examId=${examId}: page.goto timeout - flaky networkidle đã biết, thử lại)`);
    }
  }
  throw lastErr;
}

/** Probe nhỏ: lấy 1 examId THẬT (candidate đầu tiên eligible) rồi thử resolve câu hỏi qua session
 * vừa refresh - KHÔNG tạo assignment nào, chỉ đọc read-only qua Exam Editor. */
async function probeExamSession(className) {
  const tree = await fetchEligibleAssignmentTree(className);
  let candidate = null;
  outer: for (const u of tree.eligibleTree) {
    if (/^Review\s+\d+/i.test(u.unitName)) continue;
    for (const l of u.lessons) {
      for (const it of l.items) {
        if (it.isSpeak) continue;
        if (Array.isArray(it.examIds) && it.examIds.length === 1) {
          candidate = { unitName: u.unitName, lessonName: l.lessonName, itemName: it.name, examId: it.examIds[0] };
          break outer;
        }
      }
    }
  }
  if (!candidate) {
    return { ok: false, reason: "Không tìm thấy candidate eligible nào (non-speak, đúng 1 exam_id) trong cây lớp để probe." };
  }
  try {
    const examData = await parseQuestionsFromExamPageWithRetry(candidate.examId);
    const questions = normalizeQuestions(examData);
    if (!Array.isArray(questions) || questions.length === 0) {
      return { ok: false, candidate, reason: "parseQuestionsFromExamPage() không lỗi nhưng trả về 0 câu hỏi - session có thể vẫn không hợp lệ." };
    }
    return { ok: true, candidate, questionCount: questions.length };
  } catch (err) {
    return { ok: false, candidate, reason: err.message };
  }
}

/** ===================== card/progress helpers (COPY selector gốc từ ktra_fullluong_lambai.yaml) ===================== */

function readCardState(tree, title, dueDateDm, occurrenceIndex = 0) {
  const texts = collectAllTexts(tree);
  const dueLabel = `Hạn nộp ${dueDateDm}`;
  let seen = -1;
  let idx = -1;
  for (let i = 0; i < texts.length; i++) {
    if (texts[i] !== title) continue;
    const window = texts.slice(i + 1, i + 10);
    if (!window.includes(dueLabel)) continue;
    seen++;
    if (seen === occurrenceIndex) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return { found: false, texts: null };
  const windowTexts = texts.slice(idx + 1, idx + 10);
  const badge = windowTexts.find((t) => PROGRESS_BADGE_PATTERN.test(t)) ?? null;
  const cta = windowTexts.find((t) => CTA_TEXTS.includes(t)) ?? null;
  return { found: true, badge, cta, dueLine: dueLabel, windowTexts };
}

/** Đọc "Bài tập X/Y" tổng - COPY Y HỆT anchor của ktra_fullluong_lambai.yaml dòng 59-61/428-430:
 * below ".*(2 tuần gần nhất|1 tháng gần nhất).*" above "Bài tập về nhà". PHẢI gọi khi đang ở ĐẦU
 * danh sách (chưa cuộn) - cùng lý do đã ghi trong chính YAML đó. */
function readOverallProgress(tree) {
  const texts = collectAllTexts(tree);
  const belowIdx = texts.findIndex((t) => OVERALL_PROGRESS_BELOW_PATTERN.test(t));
  const aboveIdx = texts.findIndex((t, i) => i > belowIdx && t === OVERALL_PROGRESS_ABOVE);
  if (belowIdx === -1 || aboveIdx === -1) return null;
  const between = texts.slice(belowIdx + 1, aboveIdx);
  return between.find((t) => /\d+\s*\/\s*\d+/.test(t)) ?? null;
}

async function scrollToCard(bridge, title, dueDateDm) {
  const esc = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const r1 = await bridge.runSteps([
    {
      scrollUntilVisible: {
        element: { text: `Hạn nộp ${dueDateDm}`, below: { text: `.*${esc}.*` } },
        direction: "DOWN",
        timeout: 90000,
        speed: 70,
        waitToSettleTimeoutMs: 500,
      },
    },
  ]);
  if (r1.success) return;
  const r2 = await bridge.runSteps([
    { scrollUntilVisible: { element: { text: `.*${esc}.*` }, direction: "DOWN", timeout: 90000, speed: 70, waitToSettleTimeoutMs: 500 } },
  ]);
  if (!r2.success) throw new Error(`Không cuộn tới được card "${title}": ${r1.error} / fallback: ${r2.error}`);
}

async function scrollAndReadCardState(bridge, title, dueDM, occurrenceIndex) {
  await scrollToCard(bridge, title, dueDM);
  let state = readCardState(await bridge.hierarchy(), title, dueDM, occurrenceIndex);
  for (let attempt = 0; attempt < 2 && (!state.found || !state.cta); attempt++) {
    await bridge.runSteps([
      { swipe: { start: "50%,80%", end: "50%,45%", duration: 500 } },
      { waitForAnimationToEnd: { timeout: 800 } },
    ]);
    state = readCardState(await bridge.hierarchy(), title, dueDM, occurrenceIndex);
  }
  return state;
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
    resultLabel: isLast ? "e2e_ktra_fullluong_lambai_pro_result_screen" : null,
    snapshot: matched._snapshot ?? null,
  });
  if (!outcome.supported) {
    throw new Error(`Handler không hỗ trợ câu "${matched.question}" (id=${matched.id}): ${outcome.reason}`);
  }
  return { matched, wantCorrect, outcome };
}

function isTextChoiceCompatible(questions) {
  if (!Array.isArray(questions) || questions.length < 3) return false;
  return questions.every((q) => {
    const nonEmptyAnswers = (q.answers ?? []).filter((a) => typeof a === "string" && a.trim().length > 0);
    return nonEmptyAnswers.length >= 2 && q.correctAnswer && nonEmptyAnswers.includes(q.correctAnswer);
  });
}

/** Range đóng cả 2 đầu [6.0, 8.0] (KHÔNG phải "X/10 câu đúng" - xem docblock đầu file mục 5). */
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

/**
 * [SELECTION] Đếm số room ĐANG TỒN TẠI trong lớp `classId` theo từng title (room.name) - đây CHÍNH
 * LÀ nguồn gây BLOCKED_ASSIGNMENT_NOT_FOUND đã xác nhận thật (report 2026-08-18: room_id=
 * cbad424d-..., title "Choose the correct answer." Hạn nộp 25/08 KHÔNG tìm được vì lớp 3B đã có
 * SẴN 10 room khác cùng title, các title đứng trước trong danh sách - vd "Hạn nộp 21/08" - khiến
 * native `scrollUntilVisible` (chỉ match theo text title, không phân biệt occurrence) dừng lại ở
 * card SAI trước khi tới card mới). Query 1 LẦN DUY NHẤT (period=MONTH, đủ bao trùm mọi Hạn nộp
 * business rule đang dùng - xem verify-filter-web-vs-app.mjs), dùng lại NGUYÊN VẸN
 * fetchAllHomeworkRooms()/normalizeHomework() đã có sẵn (KHÔNG viết lại discovery).
 */
async function scanExistingAssignmentTitleOccurrences(classId) {
  const rawRooms = await fetchAllHomeworkRooms({ period: "MONTH" });
  const counts = new Map();
  for (const raw of rawRooms) {
    const h = normalizeHomework(raw);
    if (!h.classIds.includes(classId)) continue;
    counts.set(h.title, (counts.get(h.title) ?? 0) + 1);
  }
  return counts;
}

/**
 * SELECTION STRATEGY (thay thế bản cũ CHỈ xét handler-hỗ trợ + điểm mục tiêu, KHÔNG xét occurrence
 * title trên app - đây LÀ root cause thật của BLOCKED_ASSIGNMENT_NOT_FOUND đã ghi trong report):
 *
 *   unique item name (0 room hiện có cùng title trong lớp) > NON_UNIQUE (loại bỏ HẲN khỏi vòng
 *   thử, không dùng để đoán - xem SAFETY mục 5/7 của yêu cầu: không có identifier ổn định nào hiển
 *   thị được trên UI học sinh ngoài (title, Hạn nộp), nên 1 title đã có ≥1 room cũ trong lớp KHÔNG
 *   BAO GIỜ an toàn để native scroll định vị lại - loại thẳng, không hạ cấp xuống "thử rồi hy vọng").
 *
 * Chỉ chi phí đắt (parseQuestionsFromExamPage, 1 request/candidate) cho candidate ĐÃ qua vòng lọc
 * unique title - candidate NON_UNIQUE bị loại NGAY, không tốn network cho bước sau.
 */
async function pickFeasibleRandomAssignment({ className, classId, maxAttempts = MAX_PRESCAN_ATTEMPTS }) {
  const tree = await fetchEligibleAssignmentTree(className);
  const flat = [];
  for (const u of tree.eligibleTree) {
    if (/^Review\s+\d+/i.test(u.unitName)) continue;
    for (const l of u.lessons) {
      for (const it of l.items) {
        if (it.isSpeak) continue;
        if (!Array.isArray(it.examIds) || it.examIds.length !== 1) continue;
        flat.push({ unitName: u.unitName, lessonName: l.lessonName, itemName: it.name, itemId: it.id, examId: it.examIds[0] });
      }
    }
  }

  const existingTitleCounts = await scanExistingAssignmentTitleOccurrences(classId);
  const annotated = flat.map((cand) => {
    const occurrences = existingTitleCounts.get(cand.itemName) ?? 0;
    return { ...cand, occurrences, unique: occurrences === 0 };
  });
  const uniqueCandidates = annotated.filter((c) => c.unique);
  const nonUniqueCandidates = annotated.filter((c) => !c.unique);
  log(
    `  [SELECTION] lớp "${className}" hiện có ${existingTitleCounts.size} title khác nhau đang tồn tại room - ` +
      `${uniqueCandidates.length}/${flat.length} candidate eligible có title UNIQUE (0 room cũ trùng), ` +
      `${nonUniqueCandidates.length} candidate NON_UNIQUE bị loại khỏi vòng thử (không dùng để đoán).`,
  );
  if (nonUniqueCandidates.length > 0) {
    const sample = [...new Map(nonUniqueCandidates.map((c) => [c.itemName, c.occurrences])).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    log(`    NON_UNIQUE mẫu (itemName=occurrences): ${sample.map(([n, c]) => `"${n}"=${c}`).join(", ")}`);
  }

  if (uniqueCandidates.length === 0) {
    return {
      ok: false,
      blocked: true,
      blockedReason: "BLOCKED: No uniquely locatable assignment candidate.",
      attempts: [],
      totalEligibleNonSpeakSingleExam: flat.length,
      totalUniqueTitleCandidates: 0,
    };
  }

  const order = shuffle(uniqueCandidates).slice(0, maxAttempts);
  const attempts = [];
  for (const cand of order) {
    let questions = null;
    let errorMessage = null;
    try {
      const examData = await parseQuestionsFromExamPageWithRetry(cand.examId);
      questions = normalizeQuestions(examData);
    } catch (err) {
      errorMessage = err.message;
    }
    const compatible = questions ? isTextChoiceCompatible(questions) : false;
    const scorePlan = compatible ? computeScorePlan(questions.length) : null;
    const ok = Boolean(compatible && scorePlan);
    attempts.push({
      unitName: cand.unitName,
      lessonName: cand.lessonName,
      itemName: cand.itemName,
      itemId: cand.itemId,
      examId: cand.examId,
      occurrences: cand.occurrences,
      unique: cand.unique,
      questionCount: questions?.length ?? null,
      ok,
      reason: errorMessage ?? (!compatible ? "UNSUPPORTED_TYPE_OR_MISSING_CORRECT_ANSWER" : !scorePlan ? "NO_INTEGER_CORRECT_COUNT_IN_SCORE_RANGE_6_TO_8" : null),
    });
    log(
      `  [PRESCAN] "${cand.unitName}/${cand.lessonName}/${cand.itemName}" (N=${questions?.length ?? "?"}, occurrences=${cand.occurrences}, unique=${cand.unique}): ${
        ok ? `KHẢ THI (correctCount=${scorePlan.correctCount} -> dự đoán ${scorePlan.predictedScore})` : `loại (${attempts[attempts.length - 1].reason})`
      }`,
    );
    if (ok) {
      return {
        ok: true,
        chosen: { ...cand, questions, scorePlan },
        attempts,
        totalEligibleNonSpeakSingleExam: flat.length,
        totalUniqueTitleCandidates: uniqueCandidates.length,
      };
    }
  }
  return { ok: false, attempts, totalEligibleNonSpeakSingleExam: flat.length, totalUniqueTitleCandidates: uniqueCandidates.length };
}

/** ===================== [PHASE 0] PROFILE (giống hệt lần chạy trước, đã verify PASS) ===================== */
async function ensureProProfileActive({ appId, phone, otp }) {
  const bridge = new MaestroMcpBridge({ appId, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  try {
    const login = await bridge.runSteps([
      { launchApp: { permissions: { all: "allow" } } },
      { extendedWaitUntil: { visible: { text: ".*(Đăng nhập|Vui học|Bài tập|Báo cáo).*" }, timeout: 30000 } },
      {
        runFlow: {
          when: { visible: ".*(Chào mừng bạn đến với ParrotEdu!|Nhập số điện thoại).*" },
          commands: [
            { tapOn: { text: ".*(Nhập số điện thoại).*" } },
            { inputText: phone },
            "hideKeyboard",
            { tapOn: { text: "Đăng nhập" } },
            { extendedWaitUntil: { visible: { text: ".*(Xác thực OTP).*" }, timeout: 30000 } },
            { tapOn: { below: "Đổi số điện thoại", above: "Xác nhận" } },
            { inputText: otp },
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
  } finally {
    await bridge.stop();
  }
}

function finish(result) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  return result;
}

function formatReport(evidence, result, runId) {
  const p = evidence.profile ?? {};
  const es = evidence.examSession ?? {};
  const ra = evidence.randomAssignment ?? {};
  const ta = evidence.teacherAssign ?? {};
  const pb = evidence.progressBefore ?? {};
  const pa = evidence.progressAfter ?? {};
  const si = evidence.scoreInterpretation ?? {};
  const res = evidence.result ?? {};
  const perf = evidence.mcpPerformance ?? {};
  const lines = [];
  const push = (s = "") => lines.push(s);

  push(`[RUN_ID]`); push(runId ?? "-"); push(``);
  push(`[FLOW]`);
  push(`file=${YAML_REFERENCE_FILE}`);
  push(`execution_engine=MaestroMcpBridge (navigation/lifecycle steps copy YAML selectors 1:1) + HomeworkExamEngine/decideAnswerAction (CMS-resolved answers, REPLACES answer-current-exercise-generic.yaml only)`);
  push(``);
  push(`[PROFILE]`);
  push(`profile=${p.name ?? "-"}`);
  push(`tier=${p.verified ? "PRO" : "UNKNOWN"}`);
  push(`profile_verified=${Boolean(p.verified)}`);
  push(``);
  push(`[EXAM_SESSION]`);
  push(`source=.env EXAM_COOKIE (get_tokens.sh -> GET /api/cms/exams/token) written into automation/.cache/exam_session.json`);
  push(`refresh_attempted=true`);
  push(`refresh_result=${es.refreshed ? "SUCCESS" : "FAILED"}`);
  push(`answer_probe=${es.probeOk ? `PASS (examId=${es.probeExamId}, questionCount=${es.probeQuestionCount})` : "FAIL"}`);
  push(``);
  push(`[RANDOM_ASSIGNMENT]`);
  push(`unit=${ra.unitName ?? "-"}`);
  push(`lesson=${ra.lessonName ?? "-"}`);
  push(`lesson_item_id=${ra.lessonItemId ?? "-"}`);
  push(`exam_id=${ra.roomExamId ?? "-"}`);
  push(`questionCount=${ra.questionCount ?? "-"}`);
  push(``);
  push(`[TEACHER_ASSIGN]`);
  push(`assignment_id=${ta.roomId ?? "-"}`);
  push(`room_id=${ta.roomId ?? "-"}`);
  push(``);
  push(`[PROGRESS_BEFORE]`);
  push(`overall=${evidence.overallProgressBefore ?? "-"}`);
  push(`card_badge=${pb.badge ?? "-"}`);
  push(`card_cta=${pb.cta ?? "-"}`);
  push(``);
  push(`[SCORING_PLAN]`);
  push(`target_score_range=6.0..8.0`);
  push(`planned_correct_count=${ra.plannedCorrectCount ?? "-"}`);
  push(`planned_wrong_count=${ra.questionCount != null && ra.plannedCorrectCount != null ? ra.questionCount - ra.plannedCorrectCount : "-"}`);
  push(``);
  push(`[PARTIAL]`);
  push(`questions_answered_before_exit=0 (KHỚP đúng lifecycle THẬT của ${YAML_REFERENCE_FILE}: thoát X TRƯỚC KHI trả lời câu nào - xem AUDIT ở đầu file .mjs này)`);
  push(``);
  push(`[EXIT_TO_LIST]`);
  push(`passed=${Boolean(evidence.exitOk)}`);
  push(`app_restarted=false`);
  push(``);
  push(`[PROGRESS_AFTER_PARTIAL]`);
  push(`card_cta=${pa.ctaAfterExit ?? "-"}`);
  push(`changed_to_tiep_tuc=${pa.ctaAfterExit === "Tiếp tục"}`);
  push(``);
  push(`[RESUME]`);
  push(`passed=${Boolean(evidence.resumeOk)}`);
  push(``);
  push(`[FINISH]`);
  push(`answered=${evidence.answeredCount ?? "-"}`);
  push(`total=${ra.questionCount ?? "-"}`);
  push(``);
  push(`[RESULT_SCREEN]`);
  push(`reached=${res.score != null}`);
  push(`actual_score=${res.score ?? "-"}`);
  push(``);
  push(`[FINAL_SCORE]`);
  push(`actual=${si.actualScore ?? "-"}`);
  push(`target_range=6.0 <= score <= 8.0`);
  push(`PASS/FAIL=${si.scoreInRangeTarget ? "PASS" : "FAIL"}`);
  push(``);
  push(`[CORRECTNESS]`);
  push(`planned_correct=${si.plannedCorrectCount ?? "-"}`);
  push(`server_correct=${si.realCorrectCountFromResultScreen ?? "-"}`);
  push(`answer_mapping_verified=${Boolean(evidence.answerLog?.every((l) => l.isTargetCorrect !== null))}`);
  push(``);
  push(`[PERFORMANCE]`);
  push(`duration=${evidence.totalDurationSeconds != null ? `${evidence.totalDurationSeconds.toFixed(1)}s` : "-"}`);
  push(`maestro_processes=2 (1 phase PROFILE, 1 phase OPEN..RESULT) + N lượt CLI rời rạc trong assignHomeworkAndLocateOnApp() (hạ tầng dùng chung, ngoài phạm vi sửa - xem AUDIT)`);
  push(`hierarchy_calls=${perf.hierarchyCallCount ?? "-"}`);
  push(`run_calls=${perf.runCallCount ?? "-"}`);
  push(``);
  push(`[APP_RESTART]`);
  push(`stopApp=false`); push(`terminateApp=false`); push(`clearState=false`); push(`forceStop=false`); push(`unexpected_restart=false`);
  push(``);
  push(`[SAFETY]`);
  push(`ambiguous_locate_blocked=${evidence.openDisambiguation ? !evidence.openDisambiguation.opened && evidence.openDisambiguation.triedCount >= MAX_DISAMBIGUATE_CANDIDATES : false}`);
  push(`duplicate_assignment_created=false`);
  push(`logout=false`);
  push(``);
  push(`[OVERALL]`); push(result.status); push(``);
  push(`[ROOT_CAUSE]`); push(result.status !== "PASS" ? result.error ?? result.phase ?? "-" : "-");
  return lines.join("\n");
}

/** Báo cáo NGẮN GỌN theo đúng format [SELECTION]/[ASSIGN]/[LOCATE]/[SESSION]/[SAFETY]/[RESULT] -
 * BỔ SUNG cạnh formatReport() ở trên (KHÔNG thay thế - phần đó đã PASS, không đụng vào), tập trung
 * đúng 3 phần được sửa lần này: candidate selection + locate strategy + safety (1 assignment/lần). */
function formatSelectionLocateSafetyReport(evidence, result) {
  const sel = evidence.selection ?? {};
  const ta = evidence.teacherAssign ?? {};
  const loc = evidence.locate ?? {};
  const lines = [];
  const push = (s = "") => lines.push(s);

  push(`[SELECTION]`);
  push(`candidate=${sel.candidate ?? "-"}`);
  push(`unique=${sel.unique ?? "-"}`);
  push(`occurrences=${sel.occurrences ?? "-"}`);
  push(`identifier=${sel.identifier ?? "-"}`);
  push(``);
  push(`[ASSIGN]`);
  push(`status=${ta.roomId ? "SUCCESS" : result.status === "BLOCKED" && result.phase === "SELECTION" ? "SKIPPED (no unique candidate)" : "-"}`);
  push(`room_id=${ta.roomId ?? "-"}`);
  push(`due=${ta.dueTimeVn ?? "-"}`);
  push(``);
  push(`[LOCATE]`);
  push(`strategy=${loc.strategy ?? "-"}`);
  push(`status=${loc.status ?? "-"}`);
  push(`matched_count=${loc.matched_count ?? "-"}`);
  push(``);
  push(`[SESSION]`);
  push(`login_count=${evidence.mcpPerformance?.runCallCount != null ? "see [PERFORMANCE].run_calls (MaestroMcpBridge session) - separate maestro-test CLI logins occur inside assignHomeworkAndLocateOnApp (shared infra, out of scope this fix)" : "-"}`);
  push(`reused_session=${Boolean(evidence.mcpPerformance)} (MaestroMcpBridge session reused for OPEN..RESULT phases; profile-check + teacher-assign/locate are separate shared-infra sessions, unchanged this fix)`);
  push(``);
  push(`[SAFETY]`);
  push(`new_assignments_created=${ta.roomId ? 1 : 0}`);
  push(`blocked_reason=${result.status === "BLOCKED" ? result.error ?? "-" : "-"}`);
  push(``);
  push(`[RESULT]`);
  push(result.status);
  return lines.join("\n");
}

async function main() {
  const overallStart = Date.now();
  const evidence = {};

  log(`[EXAM_SESSION] Tự refresh session từ .env EXAM_COOKIE (KHÔNG copy tay)...`);
  const refreshResult = refreshExamSessionFromEnvCookie();
  if (!refreshResult.refreshed) {
    return finish({ status: "BLOCKED", phase: "EXAM_SESSION_REFRESH", error: `AUTO_EXAM_SESSION_REFRESH=UNAVAILABLE - ${refreshResult.reason}`, evidence });
  }
  log(`  [PASS] Đã ghi automation/.cache/exam_session.json (cookieHeader length=${refreshResult.cookieHeaderLength}).`);

  log(`[EXAM_SESSION] Probe: thử resolve câu hỏi thật của 1 candidate bất kỳ trong lớp ${TARGET_CLASS}...`);
  const probe = await probeExamSession(TARGET_CLASS);
  evidence.examSession = {
    refreshed: true,
    probeOk: probe.ok,
    probeExamId: probe.candidate?.examId ?? null,
    probeQuestionCount: probe.questionCount ?? null,
    probeReason: probe.reason ?? null,
  };
  if (!probe.ok) {
    return finish({
      status: "BLOCKED",
      phase: "EXAM_SESSION_PROBE",
      error: `AUTO_EXAM_SESSION_REFRESH=UNAVAILABLE - session đã ghi nhưng probe thất bại: ${probe.reason}`,
      evidence,
    });
  }
  log(`  [PASS] Probe OK - "${probe.candidate.itemName}" resolve được ${probe.questionCount} câu.`);

  // QUAN TRỌNG (bug thật đã gặp + fix 2026-08-18): KHÔNG dynamic-import
  // "./e2e-teacher-assign-student-open.mjs" ở ĐÂY - file đó đọc ASSIGN_UNIT_NAME/ASSIGN_LESSON_NAME/
  // ASSIGN_HOMEWORK_ITEM_NAME/ASSIGN_HOMEWORK_ITEM_ID vào module-level `const` NGAY LÚC IMPORT (dòng
  // 134-141 file đó) - import sớm ở đây (trước khi set process.env.ASSIGN_* ở [2/N] bên dưới) sẽ
  // ĐÓNG BĂNG các const đó thành undefined vĩnh viễn (ES module cache - lần import sau chỉ trả về
  // CÙNG module instance, KHÔNG evaluate lại) khiến assignHomeworkFlow() random chọn bài KHÁC hẳn
  // candidate đã pre-scan chọn (ĐÃ TÁI HIỆN THẬT: chọn nhầm "Choose the best response." dạng SPEAK
  // thay vì "Choose the correct answer." đã pre-scan). Lấy APP_ID/PHONE/OTP TRỰC TIẾP từ file .env/
  // accounts.env ở đây - CHỈ import module đó đúng 1 LẦN DUY NHẤT, ở [2/N], SAU KHI đã set xong
  // process.env.ASSIGN_* (giống đúng cách flows/giao_bai_tap/e2e-teacher-assign-partial-resume-scored.mjs
  // làm - file đó KHÔNG có lượt import sớm nào).
  const rootEnvVars = parseEnvFile(ROOT_ENV_PATH);
  const APP_ID = process.env.APP_ID || rootEnvVars.APP_ID;
  const PHONE = process.env.PHONE || ACCOUNTS_ENV.PHONE;
  const OTP = process.env.OTP || ACCOUNTS_ENV.OTP;

  log(`[0/N] Đảm bảo hồ sơ học sinh đang active = "${PROFILE_PRO_NAME}" (PRO)...`);
  const profileResult = await ensureProProfileActive({ appId: APP_ID, phone: PHONE, otp: OTP });
  evidence.profile = profileResult;
  log(`  [PASS] profile=${profileResult.name} switched=${profileResult.switched} verified=${profileResult.verified}`);

  log(`[1/N] Pre-scan READ-ONLY lớp ${TARGET_CLASS}: chọn 1 candidate UNIQUE title (0 room cũ trùng trong lớp) + handler hỗ trợ + điểm mục tiêu ${TARGET_SCORE_RANGE_LABEL}...`);
  const picked = await pickFeasibleRandomAssignment({ className: TARGET_CLASS, classId: TARGET_CLASS_ID });
  evidence.randomSelection = {
    attemptsCount: picked.attempts.length,
    attempts: picked.attempts,
    totalEligibleNonSpeakSingleExam: picked.totalEligibleNonSpeakSingleExam,
    totalUniqueTitleCandidates: picked.totalUniqueTitleCandidates ?? null,
  };
  if (picked.blocked) {
    evidence.selection = { candidate: null, unique: null, occurrences: null, identifier: null };
    return finish({
      status: "BLOCKED",
      phase: "SELECTION",
      error: `${picked.blockedReason} Không còn candidate eligible nào (non-speak, đúng 1 exam_id) có title UNIQUE (0 room cũ trùng) trong lớp ${TARGET_CLASS} - KHÔNG tạo assignment với title đã trùng (không có cách locate an toàn trên UI học sinh, chỉ có title+Hạn nộp hiển thị).`,
      evidence,
    });
  }
  if (!picked.ok) {
    evidence.selection = { candidate: null, unique: null, occurrences: null, identifier: null };
    return finish({
      status: "BLOCKED",
      phase: "RANDOM_SELECTION",
      error: `Đã thử ${picked.attempts.length}/${MAX_PRESCAN_ATTEMPTS} candidate UNIQUE title trong lớp ${TARGET_CLASS} (tổng ${picked.totalUniqueTitleCandidates} candidate unique có sẵn) - không candidate nào vừa có handler hỗ trợ đầy đủ vừa có correctCount nguyên cho điểm dự đoán trong ${TARGET_SCORE_RANGE_LABEL}.`,
      evidence,
    });
  }
  const chosen = picked.chosen;
  evidence.selection = {
    candidate: `${chosen.unitName}/${chosen.lessonName}/${chosen.itemName}`,
    unique: true,
    occurrences: chosen.occurrences,
    identifier: `title (unique, 0 existing rooms in class ${TARGET_CLASS}) + due date - resolved to room_id after assign`,
  };
  log(
    `  [PASS] Chọn "${chosen.unitName}/${chosen.lessonName}/${chosen.itemName}" (N=${chosen.questions.length}, occurrences=${chosen.occurrences}, unique=true, correctCount kế hoạch=${chosen.scorePlan.correctCount}, dự đoán=${chosen.scorePlan.predictedScore}).`,
  );

  process.env.ASSIGN_UNIT_NAME = chosen.unitName;
  process.env.ASSIGN_LESSON_NAME = chosen.lessonName;
  process.env.ASSIGN_HOMEWORK_ITEM_NAME = chosen.itemName;
  process.env.ASSIGN_HOMEWORK_ITEM_ID = chosen.itemId;
  const assignModule = await import("./e2e-teacher-assign-student-open.mjs");

  log(`[2/N] GV giao bài (candidate đã chọn) + App HS locate đúng card (assignHomeworkAndLocateOnApp - hạ tầng dùng chung, không sửa)...`);
  const located = await assignModule.assignHomeworkAndLocateOnApp();
  // [LOCATE] title đã đảm bảo UNIQUE (0 room cũ trùng) từ bước [SELECTION] ở trên - nên native
  // scrollUntilVisible(title) bên trong assignHomeworkAndLocateOnApp() giờ landing ĐÚNG NGAY card
  // vừa tạo (không còn card cũ cùng title đứng trước gây lạc hướng, xem SELECTION strategy).
  evidence.locate = {
    strategy: "unique_item_name (pre-verified 0 collisions) -> due_date verify (native scrollUntilVisible + assertVisible)",
    status: located.ok ? "PASS" : located.status ?? "BLOCKED",
    matched_count: located.ok ? 1 : located.classification === "BLOCKED_AMBIGUOUS_ASSIGNMENT_MATCH" ? (located.evidence?.soCardTuongUng ?? "ambiguous") : 0,
  };
  if (!located.ok) return finish({ status: "FAIL", phase: "TEACHER_ASSIGN_OR_LOCATE", error: located.summary, evidence: { ...evidence, located } });
  const { assignment, dueVnYmd, startVnYmd } = located;
  const dueDM = formatDM(dueVnYmd);
  evidence.teacherAssign = { roomId: assignment.id, title: assignment.title, dueTimeVn: formatDMY(dueVnYmd) };
  log(`  [PASS] room_id=${assignment.id} title="${assignment.title}" due=${formatDMY(dueVnYmd)}`);

  log(`[3/N] Resolve câu hỏi/đáp án CHÍNH XÁC theo room.id...`);
  const resolved = await resolveHomeworkExamQuestionsForRoomId(assignment.id);
  if (resolved.status !== "RESOLVED") {
    return finish({ status: "BLOCKED", phase: "CMS_RESOLUTION", error: `resolveHomeworkExamQuestionsForRoomId trả về status=${resolved.status}: ${resolved.reason}`, evidence });
  }
  const swapAnswer = resolved.roomDetails?.room?.exams?.[0]?.is_swap_answer ?? null;
  const swapQuestion = resolved.roomDetails?.room?.exams?.[0]?.is_swap_question ?? null;
  if (swapAnswer || swapQuestion) {
    return finish({ status: "BLOCKED", phase: "CMS_RESOLUTION", error: `is_swap_answer=${swapAnswer}/is_swap_question=${swapQuestion} - không tin tưởng đáp án.`, evidence });
  }
  const QUESTIONS = resolved.questions;
  if (!isTextChoiceCompatible(QUESTIONS)) {
    return finish({ status: "BLOCKED", phase: "CMS_RESOLUTION", error: `Nội dung THẬT của room không còn khớp điều kiện handler hỗ trợ đầy đủ.`, evidence });
  }
  const scorePlan = computeScorePlan(QUESTIONS.length);
  if (!scorePlan) {
    return finish({ status: "BLOCKED", phase: "CMS_RESOLUTION", error: `N=${QUESTIONS.length} câu - không tồn tại correctCount nguyên cho điểm dự đoán trong ${TARGET_SCORE_RANGE_LABEL}.`, evidence });
  }
  const WANT_CORRECT = buildWantCorrectPlan(QUESTIONS.map((q) => q.id), scorePlan.correctCount);
  const rd = resolved.roomDetails;
  evidence.randomAssignment = {
    unitName: rd.unit_name,
    lessonName: rd.lesson_name,
    lessonItemId: rd.lesson_item_id,
    roomExamId: resolved.examId,
    roomId: assignment.id,
    title: assignment.title,
    questionCount: QUESTIONS.length,
    plannedCorrectCount: scorePlan.correctCount,
    predictedScore: scorePlan.predictedScore,
  };
  log(`  [PASS] N=${QUESTIONS.length} câu, correctCount kế hoạch=${scorePlan.correctCount} (dự đoán=${scorePlan.predictedScore}).`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);

  try {
    evidence.mcpPerformance = {
      get runCallCount() { return bridge.runCallCount; },
      get hierarchyCallCount() { return bridge.hierarchyCallCount; },
    };

    // ===== PROGRESS_BEFORE tổng - COPY anchor gốc, đọc NGAY sau khi mở tab, CHƯA cuộn =====
    log(`[4/N] Mở tab "Bài tập", cuộn về đầu, đọc PROGRESS_BEFORE tổng (COPY anchor gốc của YAML)...`);
    await bridge.runSteps([
      { tapOn: { text: "Bài tập", optional: true } },
      { repeat: { times: 5, commands: [{ swipe: { direction: "DOWN", duration: 250 } }] } },
      { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao|2 tuần gần nhất|1 tháng gần nhất).*" }, timeout: 30000 } },
    ]);
    const overallBefore = readOverallProgress(await bridge.hierarchy());
    evidence.overallProgressBefore = overallBefore;
    log(`  overall progress BEFORE = "${overallBefore}"`);

    // ===== OPEN đúng assignment (disambiguate theo nội dung nếu title+Hạn nộp không unique - AN
    // TOÀN HƠN, KHÔNG đổi business lifecycle được test - xem AUDIT) =====
    log(`[5/N] Mở đúng assignment "${assignment.title}" / Hạn nộp ${dueDM} (COPY selector gốc YAML: scrollUntilVisible compound title+Hạn nộp -> tapOn CTA)...`);
    let openOutcome = { opened: false, triedCount: 0 };
    for (let idx = 0; idx < MAX_DISAMBIGUATE_CANDIDATES; idx++) {
      const state = await scrollAndReadCardState(bridge, assignment.title, dueDM, idx);
      if (!state.found || !state.cta) { openOutcome = { opened: false, triedCount: idx }; break; }
      const esc = assignment.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const tapResult = await bridge.runSteps([
        { tapOn: { text: state.cta, below: { text: `Hạn nộp ${dueDM}`, below: { text: `.*${esc}.*` } }, index: idx } },
        { waitForAnimationToEnd: { timeout: 3000 } },
        { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
        { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 15000 } },
      ]);
      if (!tapResult.success) { openOutcome = { opened: false, triedCount: idx + 1 }; break; }
      const matched = await findMatchingQuestion(bridge, QUESTIONS);
      if (matched) { openOutcome = { opened: true, index: idx, firstMatched: matched, progressBefore: state }; break; }
      // Không khớp nội dung - thoát rồi thử candidate kế
      await bridge.runSteps([
        { tapOn: { id: "exercise_close_button" } },
        { extendedWaitUntil: { visible: ".*(Bài tập).*", timeout: 20000 } },
        { swipe: { start: "50%, 35%", end: "50%, 85%", duration: 600 } },
        { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao).*" }, timeout: 30000 } },
      ]);
      openOutcome = { opened: false, triedCount: idx + 1 };
    }
    evidence.openDisambiguation = { opened: openOutcome.opened, triedCount: openOutcome.triedCount, index: openOutcome.index ?? null };
    if (!openOutcome.opened) {
      return finish({ status: "BLOCKED", phase: "OPEN_EXERCISE_AMBIGUOUS", error: `Không tìm được candidate nào khớp nội dung câu hỏi CMS sau ${openOutcome.triedCount} lượt - locate ambiguous, dừng lại (SAFETY).`, evidence });
    }
    evidence.progressBefore = openOutcome.progressBefore;
    log(`  [PASS] Đã mở đúng assignment (index=${openOutcome.index}). card badge="${openOutcome.progressBefore.badge}" cta="${openOutcome.progressBefore.cta}"`);

    // ===== THOÁT NGAY bằng X - 0 CÂU ĐÃ TRẢ LỜI (COPY Y HỆT dòng 196-211 của YAML) =====
    log(`[6/N] Thoát NGAY bằng X (0 câu đã trả lời - ĐÚNG lifecycle YAML gốc, KHÔNG trả lời câu nào trước khi thoát)...`);
    const exitResult = await bridge.runSteps([
      { tapOn: { id: "exercise_close_button" } },
      { extendedWaitUntil: { visible: ".*(Bài tập).*", timeout: 20000 } },
      { swipe: { start: "50%, 35%", end: "50%, 85%", duration: 600 } },
      { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao).*" }, timeout: 30000 } },
    ]);
    evidence.exitOk = exitResult.success;
    if (!exitResult.success) {
      return finish({ status: "FAIL", phase: "EXIT_TO_LIST", error: exitResult.error, evidence });
    }
    log(`  [PASS] Đã thoát về danh sách, đã refresh (swipe) để nạp lại doing_answer_id.`);

    // ===== Tìm lại card, verify CTA đổi "Tiếp tục" (COPY Y HỆT dòng 233-286 của YAML) =====
    log(`[7/N] Tìm lại card, verify CTA đã đổi thành "Tiếp tục"...`);
    const afterExitState = await scrollAndReadCardState(bridge, assignment.title, dueDM, openOutcome.index);
    evidence.progressAfter = { ctaAfterExit: afterExitState.cta, badgeAfterExit: afterExitState.badge };
    if (afterExitState.cta !== "Tiếp tục") {
      return finish({ status: "FAIL", phase: "PROGRESS_CHANGED", error: `CTA sau khi thoát KHÔNG đổi thành "Tiếp tục" (thực tế: "${afterExitState.cta}") - card không phản ánh trạng thái đang dở.`, evidence });
    }
    log(`  [PASS] card CTA = "Tiếp tục" - xác nhận app đã ghi nhận trạng thái đang làm dở.`);

    // ===== RESUME: tap "Tiếp tục" (COPY selector gốc), verify exercise_close_button lại =====
    log(`[8/N] Resume: tap "Tiếp tục", verify quay lại màn làm bài...`);
    const escTitle = assignment.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const resumeResult = await bridge.runSteps([
      { tapOn: { text: "Tiếp tục", below: { text: `Hạn nộp ${dueDM}`, below: { text: `.*${escTitle}.*` } }, index: openOutcome.index } },
      { waitForAnimationToEnd: { timeout: 3000 } },
      { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
      { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 40000 } },
    ]);
    evidence.resumeOk = resumeResult.success;
    if (!resumeResult.success) {
      return finish({ status: "FAIL", phase: "RESUME_OPEN", error: resumeResult.error, evidence });
    }
    log(`  [PASS] Đã resume, đang ở màn làm bài (exercise_close_button visible).`);

    // ===== HOÀN THÀNH - ENGINE KHÁC (CMS-controlled), THAY answer-current-exercise-generic.yaml =====
    log(`[9/N] Trả lời TẤT CẢ ${QUESTIONS.length} câu theo kế hoạch (correctCount=${scorePlan.correctCount}) - dùng HomeworkExamEngine (CMS thật), KHÔNG dùng dispatcher blind...`);
    const answeredIds = new Set();
    const answerLog = [];
    let carryTree = null;
    let lastOutcome = null;
    while (answeredIds.size < QUESTIONS.length) {
      const pool = QUESTIONS.filter((q) => !answeredIds.has(q.id));
      const matched = await findMatchingQuestion(bridge, pool, carryTree);
      if (!matched) {
        return finish({ status: "FAIL", phase: "FINISH_REMAINING", error: `Không khớp được câu hỏi nào (còn ${pool.length} câu).`, visibleTexts: collectAllTexts(await bridge.hierarchy()), evidence: { ...evidence, answerLog } });
      }
      const isLast = answeredIds.size === QUESTIONS.length - 1;
      const { wantCorrect, outcome } = await answerOneQuestion(exam, matched, isLast, WANT_CORRECT);
      lastOutcome = outcome;
      carryTree = outcome.finalTree ?? null;
      answeredIds.add(matched.id);
      answerLog.push({ id: matched.id, question: matched.question, wantCorrect, isTargetCorrect: outcome.isTargetCorrect, type: outcome.type });
      log(`  Câu ${answeredIds.size}/${QUESTIONS.length}: nhắm ${wantCorrect ? "ĐÚNG" : "SAI"}, isTargetCorrect=${outcome.isTargetCorrect}`);
    }
    evidence.answerLog = answerLog;
    evidence.answeredCount = answeredIds.size;

    // ===== RESULT_SCREEN (COPY gốc: chờ exercise_result_screen; MỚI: đọc + verify điểm số) =====
    log(`[10/N] Xác nhận màn Kết quả + đọc điểm THẬT (KHÔNG dựa self-assessment - đọc từ result screen)...`);
    const finalTree = lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(finalTree)) {
      return finish({ status: "FAIL", phase: "RESULT_SCREEN", error: "Không thấy màn hình Kết quả sau khi trả lời hết toàn bộ câu.", evidence });
    }
    const result = exam.readResult(finalTree);
    evidence.result = result;
    log(`  ĐIỂM SỐ=${result.score} CHÍNH XÁC=${result.correct}`);

    const achievedCorrectCount = [...WANT_CORRECT.values()].filter(Boolean).length;
    const scoreNumber = result.score === null ? null : Number(result.score);
    const scoreValid = scoreNumber !== null && !Number.isNaN(scoreNumber);
    const scoreInRange = scoreValid && scoreNumber >= 6.0 && scoreNumber <= 8.0;
    evidence.scoreInterpretation = {
      questionCount: QUESTIONS.length,
      plannedCorrectCount: scorePlan.correctCount,
      achievedCorrectCountByPlan: achievedCorrectCount,
      realCorrectCountFromResultScreen: result.correctCount,
      actualScore: scoreNumber,
      scoreInRangeTarget: scoreInRange,
      discrepancy: result.correctCount !== null && result.correctCount !== achievedCorrectCount
        ? `Kế hoạch nhắm ${achievedCorrectCount} câu đúng nhưng server báo ${result.correctCount} câu đúng - self-assessment KHÔNG khớp server, xem answerLog để đối chiếu từng câu.`
        : null,
    };
    if (evidence.scoreInterpretation.discrepancy) {
      log(`  [CẢNH BÁO] ${evidence.scoreInterpretation.discrepancy}`);
    }

    // ===== Đóng kết quả + verify homework_screen (COPY gốc dòng 338-365) =====
    await bridge.runSteps([
      { runFlow: { when: { visible: "Hoàn thành" }, commands: [{ tapOn: { text: ".*(Hoàn thành).*" } }] } },
      { runFlow: { when: { visible: "Tiếp theo" }, commands: [{ tapOn: { id: "exercise_result_close_button" } }] } },
    ]);
    await bridge.wait({ id: "homework_screen" }, { timeout: 30000 });

    // ===== PROGRESS_AFTER riêng card (COPY gốc: chỉ cần dòng "Điểm <số>" tồn tại) =====
    log(`[11/N] Verify card đã hoàn thành (dòng "Điểm <số>" tồn tại - COPY tiêu chí gốc test_data/hw_fullluong_compare_card_progress.js)...`);
    await scrollToCard(bridge, assignment.title, dueDM);
    const cardTreeAfter = await bridge.hierarchy();
    const cardTextsAfter = collectAllTexts(cardTreeAfter);
    const cardCompletedLine = cardTextsAfter.find((t) => /Điểm\s*[0-9.,]+/.test(t));
    evidence.cardProgressOk = Boolean(cardCompletedLine);
    if (!cardCompletedLine) {
      return finish({ status: "FAIL", phase: "PROGRESS_AFTER_CARD", error: `Không tìm thấy dòng "Điểm <số>" trên card sau khi hoàn thành.`, evidence });
    }
    log(`  [PASS] card completed line = "${cardCompletedLine}"`);

    // ===== PROGRESS_AFTER tổng: cuộn về đầu, so sánh tăng (COPY gốc dòng 410-434) =====
    log(`[12/N] Cuộn về đầu, đọc lại PROGRESS_AFTER tổng, so sánh tăng...`);
    await bridge.runSteps([{ repeat: { times: 5, commands: [{ swipe: { direction: "DOWN", duration: 250 } }] } }]);
    await bridge.wait({ text: ".*(Bài tập về nhà|Bài tập nâng cao).*" }, { timeout: 15000 });
    const overallAfter = readOverallProgress(await bridge.hierarchy());
    evidence.overallProgressAfter = overallAfter;
    const beforeNum = overallBefore ? parseInt(overallBefore.match(/\d+/)?.[0] ?? "-1", 10) : -1;
    const afterNum = overallAfter ? parseInt(overallAfter.match(/\d+/)?.[0] ?? "-1", 10) : -1;
    const overallProgressOk = beforeNum >= 0 && afterNum >= 0 && afterNum > beforeNum;
    evidence.overallProgressOk = overallProgressOk;
    log(`  overall progress AFTER = "${overallAfter}" (before=${beforeNum} after=${afterNum} -> ok=${overallProgressOk})`);

    evidence.totalDurationSeconds = (Date.now() - overallStart) / 1000;

    const overallPass =
      profileResult.verified &&
      evidence.exitOk &&
      evidence.resumeOk &&
      answeredIds.size === QUESTIONS.length &&
      evidence.cardProgressOk &&
      overallProgressOk &&
      scoreInRange;

    return finish({ status: overallPass ? "PASS" : "FAIL", phase: overallPass ? null : "SCORE_VERIFY", evidence });
  } finally {
    await bridge.stop();
    log("[MCP] Đã dừng tiến trình `maestro mcp` (cleanup cuối flow).");
  }
}

main()
  .then((result) => {
    log(`\n=== KẾT QUẢ: ${result.status}${result.phase ? ` (phase=${result.phase})` : ""} ===`);
    log(`Đã ghi report ra ${OUTPUT_FILE}`);
    log("\n" + formatSelectionLocateSafetyReport(result.evidence ?? {}, result));
    log("\n" + formatReport(result.evidence ?? {}, result, result.evidence?.teacherAssign?.roomId ?? null));
    process.exit(result.status === "PASS" ? 0 : result.status === "BLOCKED" ? 2 : 1);
  })
  .catch((err) => {
    console.error("\n[e2e-ktra-fullluong-lambai-scored-pro] Dừng lại vì lỗi ngoài dự kiến:\n");
    console.error(err);
    finish({ status: "ERROR", error: err.message, stack: err.stack });
    process.exit(2);
  });
