#!/usr/bin/env node
/**
 * PRO-Lamlai-Target-Score
 *
 * Case: "chọn 1 bài đã hoàn thành, bấm Làm lại, làm lại TOÀN BỘ bài, nộp bài, verify điểm THẬT ===
 * điểm MỤC TIÊU được cấu hình (REDO_TARGET_SCORE)". KHÁC hẳn tiêu chí của 2 case anh em:
 *   - flows/app/bai_tap/pro_lamlai_fullluong.mjs           : không scoring (bấm cho qua).
 *   - flows/app/bai_tap/pro_lamlai_beat_previous_score.mjs : actualScore > điểm CŨ (so sánh).
 * Ở ĐÂY: KHÔNG so điểm cũ/mới - điểm cũ (nếu đọc được) chỉ để LOG, không phải điều kiện PASS/FAIL.
 * Điều kiện DUY NHẤT: actualScore === targetScore (đọc thật từ màn Kết quả).
 *
 * TÁI SỬ DỤNG (không viết lại logic đã verify, không tự tra CMS bằng cơ chế mới):
 *   - [A] ensureProProfileActive(), [B] collectDistinctCompletedCandidates(),
 *     resolveUniqueRoomIdForCandidate(), EXAM_SESSION refresh, isTextChoiceCompatible(),
 *     findMatchingQuestion() - COPY NGUYÊN từ pro_lamlai_beat_previous_score.mjs (đã verify PASS
 *     phần locate/định danh + resolve CMS/trả lời bằng HomeworkExamEngine).
 *   - Nguồn đáp án đúng: `resolveHomeworkExamQuestionsForRoomId()`
 *     (automation/bai_tap/discovery/teacherMaterialsExamResolver.js) - CHÍNH pipeline CMS/Exam
 *     (`parseQuestionsFromExamPage` + `questionModel.js#normalizeQuestions`) mà TOÀN BỘ case
 *     "lamlai"/"ktra_fullluong_lambai" trong repo đang dùng - KHÔNG có pipeline CMS thứ hai.
 *   - Vòng lặp trả lời (`answerCurrentQuestionOneShot`, `HomeworkExamEngine`) và cách đọc điểm
 *     (`isResultScreen`/`readResult` - đọc "CHÍNH XÁC X/Y" + "ĐIỂM SỐ" thật trên màn hình, KHÔNG suy
 *     đoán) - COPY NGUYÊN từ automation/bai_tap/navigation/homeworkExamEngine.js.
 *   - `computeScorePlan`/`buildWantCorrectPlan` (dùng ở các file e2e-*-scored*.mjs khác, giả định
 *     N câu = N điểm/10) CỐ TÌNH KHÔNG dùng ở đây - xem mục SCORING ENGINE bên dưới, đây chính là lý
 *     do case này tồn tại riêng (yêu cầu KHÔNG giả định "10 câu = 10 điểm").
 *
 * ===================== SCORING ENGINE (KHÔNG giả định "N câu = N điểm") =====================
 * `resolveHomeworkExamQuestionsForRoomId()` trả `questions[]` đã qua
 * `questionModel.js#normalizeQuestions()` - hàm đó ĐÃ LỌC BỎ node "GROUP" (tiêu đề/đoạn văn dẫn đề
 * của câu nhóm, point=0, KHÔNG phải câu hỏi thật - xem docblock hàm đó, xác nhận thật 2026-08-19),
 * chỉ giữ lại từng SUB-ITEM thật của câu nhóm (mỗi câu con "a/b/c/d/e" là 1 phần tử riêng trong
 * mảng, ĐÃ tự động tính đúng "totalScoredItems" mà KHÔNG cần logic gộp thêm ở đây). Mỗi phần tử có
 * `metadata.point` = trọng số điểm THẬT của CMS cho item đó (đã xác nhận qua dữ liệu thật,
 * automation/output/discovery.json: 1 câu SPEAK độc lập có point=10 - "point" KHÔNG cố định 1/câu).
 *
 * Công thức áp dụng (tổng quát, không giả định trọng số đều):
 *   score = (tổng điểm các item ĐÚNG / tổng điểm TẤT CẢ item) * 10
 * Nếu mọi item có point bằng nhau, công thức tự quy về đúng dạng "correctCount/totalCount*10" mà
 * các file computeScorePlan() khác đang dùng - KHÔNG mâu thuẫn, chỉ tổng quát hoá thêm cho trường
 * hợp trọng số khác nhau (yêu cầu rõ của case này).
 *
 * Để đạt CHÍNH XÁC 1 điểm mục tiêu (không chỉ ước lượng): giải bài toán "subset-sum" trên mảng điểm
 * từng item (quy đổi sang số nguyên qua POINT_SCALE để tránh sai số float) - `buildScoringPlan()`
 * chạy DP tìm MỌI tổng điểm khả thi (0/1 knapsack, mỗi item chỉ dùng 1 lần = đúng hoặc sai, không có
 * trạng thái thứ 3), rồi `correctIndicesForScaledSum()` truy vết ra ĐÚNG 1 tập con item cần trả lời
 * ĐÚNG để đạt tổng điểm đó. Target không rơi đúng vào 1 tổng khả thi -> KHÔNG khả thi, trả lỗi rõ
 * ràng kèm danh sách toàn bộ điểm khả thi thật của chính bài đó (không random đáp án rồi hy vọng).
 *
 * GIỚI HẠN CÒN LẠI (không suy đoán thêm, ghi nhận trung thực):
 *   - Công thức làm tròn hiển thị thật của app CHƯA được chứng minh (xem note
 *     "ASSUMED_LINEAR_SCALE_10_ROUND_1_DECIMAL" trong flows/web/giao_bai_tap/
 *     e2e-teacher-assign-partial-resume-scored-pro.mjs) - target nên chọn giá trị "sạch" theo bậc
 *     10/totalScoredItems (vd bội số 0.5 với 20 item đều trọng số) để tránh rủi ro lệch làm tròn.
 *   - `resolved.questions.length` (tổng điểm CMS) có thể KHÔNG khớp `result.totalCount` (tổng câu
 *     thật đọc từ màn Kết quả "CHÍNH XÁC X/Y") nếu candidate có random hoá đề/pool câu khác nhau mỗi
 *     lượt làm (đã từng quan sát mismatch thật ở pro_lamlai_beat_previous_score_report.json,
 *     2026-08-19: 10/10 câu nhắm đúng nhưng actualScore không như kỳ vọng) - case này CHỦ ĐỘNG log
 *     cảnh báo `denominatorMatches` khi 2 số lệch nhau, không che giấu, để dễ debug nếu FAIL.
 *
 * ENV:
 *   REDO_SCORE_MODE=target|random (default "target")
 *   REDO_TARGET_SCORE=<số>        (bắt buộc khi mode=target, vd 9, 8.5, 10, 3)
 *     - mode=random: tự chọn 1 điểm KHẢ THI thật của CHÍNH candidate được chọn (không random đáp án
 *       trước rồi xem điểm ra bao nhiêu - random NGAY TRÊN tập điểm khả thi đã tính).
 *   APP_ID (.env), PHONE/OTP (test_data/accounts.env), EXAM_COOKIE (.env, get_tokens.sh),
 *   MAESTRO_DEVICE (tuỳ chọn), PROFILE_PRO_NAME (default "Ngoc"), TARGET_CLASS_ID/TARGET_STUDENT_ID
 *   (default như pro_lamlai_beat_previous_score.mjs).
 *
 * CHẠY: REDO_SCORE_MODE=target REDO_TARGET_SCORE=9 node flows/app/bai_tap/pro_lamlai_target_score.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseEnvFile } from "../../../automation/src/config.js";
import { MaestroMcpBridge } from "../../../automation/bridge/maestroMcpBridge.js";
import { HomeworkExamEngine, decideAnswerAction } from "../../../automation/bai_tap/navigation/homeworkExamEngine.js";
import { resolveHomeworkExamQuestionsForRoomId } from "../../../automation/bai_tap/discovery/teacherMaterialsExamResolver.js";
import { getHomeworks } from "../../../automation/bai_tap/discovery/homeworks.js";
import { resolveMyStatus } from "../../../automation/bai_tap/model/homeworkModel.js";
import { CTA_TEXTS, SECTION_HEADERS } from "../../../automation/bai_tap/discovery/homeworkUiList.js";
import { formatDM } from "./verify-filter-web-vs-app.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "pro_lamlai_target_score_report.json");
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

const REDO_SCORE_MODE = (process.env.REDO_SCORE_MODE || "target").trim().toLowerCase();
const REDO_TARGET_SCORE_RAW = process.env.REDO_TARGET_SCORE;
// Quy đổi point (có thể là số thập phân, vd 0.5) sang số nguyên để DP subset-sum không dính sai số
// float - 1000 đủ dư cho mọi độ chia nhỏ CMS đã quan sát thật (point nguyên hoặc 1 chữ số thập phân).
const POINT_SCALE = 1000;

function log(...args) {
  console.log(...args);
}

/** ===================== card/hierarchy parsing (COPY nguyên từ pro_lamlai_beat_previous_score.mjs) ===================== */

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

/** Cuộn thăm dò NHỎ + đọc lại hierarchy giữa mỗi lượt (KHÔNG scroll mù/cố định) - dừng NGAY khi đủ
 * candidate mong muốn hoặc hết section, dừng SỚM khi 2 lượt liên tiếp không tiến triển thêm (cùng
 * nguyên tắc dừng-sớm đã dùng trong findAssignment.js/homeworkUiList.js). */
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
  let noProgressStreak = 0;
  let lastSize = byTitle.size;
  while (byTitle.size < maxDistinct && scrollsUsed < maxScrolls && !enteredAdvanced && noProgressStreak < 2) {
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
    noProgressStreak = byTitle.size > lastSize ? 0 : noProgressStreak + 1;
    lastSize = byTitle.size;
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

/** ===================== EXAM_SESSION + CMS resolve (COPY nguyên - CÙNG pipeline CMS duy nhất) ===================== */

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

async function answerOneQuestion(exam, matched, isLast, wantCorrectMap) {
  const wantCorrect = wantCorrectMap.get(matched.id);
  const outcome = await exam.answerCurrentQuestionOneShot(matched, {
    wantCorrect,
    resultLabel: isLast ? "pro_lamlai_target_score_result_screen" : null,
    snapshot: matched._snapshot ?? null,
  });
  if (!outcome.supported) {
    throw new Error(`Handler không hỗ trợ câu "${matched.question}" (id=${matched.id}): ${outcome.reason}`);
  }
  return { wantCorrect, outcome };
}

function parsePreviousScoreForLog(scoreText) {
  const m = /Điểm\s*([0-9]+(?:[.,][0-9]+)?)/.exec(scoreText ?? "");
  return m ? Number(m[1].replace(",", ".")) : null;
}

/** ===================== SCORING ENGINE (subset-sum theo point THẬT, không giả định trọng số đều) ===================== */

/**
 * DP 0/1 knapsack trên mảng điểm (đã quy đổi nguyên qua POINT_SCALE) - tìm MỌI tổng điểm khả thi
 * (mỗi item chỉ 2 trạng thái: đúng góp `point`, sai góp 0) + truy vết được 1 tập con item cụ thể cho
 * BẤT KỲ tổng khả thi nào. Item point<=0 (không nên còn tồn tại sau normalizeQuestions() lọc GROUP,
 * nhưng phòng hờ) bị loại khỏi DP (không góp/không đổi tổng dù đúng/sai) - xử lý riêng ở
 * buildWeightedWantCorrectPlan() (luôn coi là "đúng", không ảnh hưởng điểm).
 * @param {import("../../../automation/model/questionModel.js").QuestionModel[]} questions
 * @returns {null | { scaledTotal: number, achievableScaledSums: number[], correctIndicesForScaledSum: (s:number)=>Set<number>|null }}
 */
function buildScoringPlan(questions) {
  const scaledPoints = questions.map((q) => Math.round((Number(q.metadata?.point) || 0) * POINT_SCALE));
  const scaledTotal = scaledPoints.reduce((a, b) => a + b, 0);
  if (scaledTotal <= 0) return null;

  // reachedByItem[s] = index item VỪA ĐƯỢC THÊM để lần đầu đạt tổng s (-1 = chưa đạt được, -2 =
  // tổng 0, không cần item nào) - đủ để truy vết ngược ra 1 tập con hợp lệ (0/1, không dùng lại item).
  const reachedByItem = new Array(scaledTotal + 1).fill(-1);
  const prevSum = new Array(scaledTotal + 1).fill(-1);
  reachedByItem[0] = -2;

  for (let i = 0; i < scaledPoints.length; i++) {
    const p = scaledPoints[i];
    if (p <= 0) continue;
    for (let s = scaledTotal; s >= p; s--) {
      if (reachedByItem[s] === -1 && reachedByItem[s - p] !== -1) {
        reachedByItem[s] = i;
        prevSum[s] = s - p;
      }
    }
  }

  const achievableScaledSums = [];
  for (let s = 0; s <= scaledTotal; s++) if (reachedByItem[s] !== -1) achievableScaledSums.push(s);

  function correctIndicesForScaledSum(targetScaledSum) {
    if (targetScaledSum < 0 || targetScaledSum > scaledTotal || reachedByItem[targetScaledSum] === -1) return null;
    const chosen = new Set();
    let s = targetScaledSum;
    while (s > 0) {
      const itemIdx = reachedByItem[s];
      chosen.add(itemIdx);
      s = prevSum[s];
    }
    return chosen;
  }

  return { scaledTotal, achievableScaledSums, correctIndicesForScaledSum };
}

/** score (thang 0-10) -> scaledSum nguyên - null nếu score không rơi đúng vào 1 mốc điểm nguyên
 * (theo scale nội bộ) - KHÔNG làm tròn để "cho qua", coi thẳng là không khả thi. */
function scaledSumForScore(scaledTotal, score) {
  const raw = (score * scaledTotal) / 10;
  const rounded = Math.round(raw);
  if (Math.abs(raw - rounded) > 1e-6) return null;
  return rounded;
}

function achievableScoresList(scaledTotal, achievableScaledSums) {
  const set = new Set();
  for (const s of achievableScaledSums) {
    set.add(Math.round(((s / scaledTotal) * 10) * 1e6) / 1e6);
  }
  return [...set].sort((a, b) => a - b);
}

/**
 * Quyết định target score cho 1 candidate cụ thể + tập item cần trả lời ĐÚNG để đạt đúng target đó.
 * mode="target": validate REDO_TARGET_SCORE có khả thi với CHÍNH candidate này không (số scored
 *   items + trọng số điểm thật của nó) - không khả thi thì trả về danh sách điểm khả thi thật để
 *   BLOCKED rõ ràng, không cố chạy rồi fail mù ở cuối.
 * mode="random": random NGAY TRÊN tập điểm khả thi thật của candidate (không random đáp án rồi chờ
 *   xem điểm ra bao nhiêu).
 */
function resolveScoringPlanForCandidate(questions, { mode, targetScoreEnv }) {
  const plan = buildScoringPlan(questions);
  if (!plan) {
    return { achievable: false, reason: "Tổng điểm (metadata.point) của toàn bộ scored items = 0 - không tính được scoring." };
  }
  const achievableScores = achievableScoresList(plan.scaledTotal, plan.achievableScaledSums);
  const totalPointsRaw = plan.scaledTotal / POINT_SCALE;

  if (mode === "random") {
    const scaledSum = plan.achievableScaledSums[Math.floor(Math.random() * plan.achievableScaledSums.length)];
    const targetScore = Math.round(((scaledSum / plan.scaledTotal) * 10) * 1e6) / 1e6;
    return {
      achievable: true,
      targetScore,
      correctIndices: plan.correctIndicesForScaledSum(scaledSum),
      achievableScores,
      totalScoredItems: questions.length,
      totalPointsRaw,
    };
  }

  const scaledSum = scaledSumForScore(plan.scaledTotal, targetScoreEnv);
  if (scaledSum === null) {
    return {
      achievable: false,
      reason: `Target ${targetScoreEnv} không rơi đúng vào bất kỳ mốc điểm nguyên nào theo scale nội bộ (tổng điểm thật=${totalPointsRaw} của ${questions.length} scored items).`,
      achievableScores,
      totalScoredItems: questions.length,
      totalPointsRaw,
    };
  }
  const correctIndices = plan.correctIndicesForScaledSum(scaledSum);
  if (!correctIndices) {
    return {
      achievable: false,
      reason: `Target score ${targetScoreEnv} KHÔNG khả thi với ${questions.length} scored items (tổng điểm thật=${totalPointsRaw}). Các điểm khả thi: ${achievableScores.join(", ")}.`,
      achievableScores,
      totalScoredItems: questions.length,
      totalPointsRaw,
    };
  }
  return { achievable: true, targetScore: targetScoreEnv, correctIndices, achievableScores, totalScoredItems: questions.length, totalPointsRaw };
}

/** Map câu hỏi -> wantCorrect: item nằm trong tập "correctIndices" (đã truy vết từ DP) -> đúng; item
 * point<=0 (không tham gia DP) -> mặc định đúng (không ảnh hưởng điểm, an toàn); còn lại -> SAI CHỦ
 * ĐÍCH (đây chính là phần "chọn sai đáp án cho số item còn lại" theo yêu cầu). */
function buildWeightedWantCorrectPlan(questions, correctIndices) {
  const map = new Map();
  questions.forEach((q, i) => {
    const pointRaw = Number(q.metadata?.point) || 0;
    map.set(q.id, pointRaw <= 0 || correctIndices.has(i));
  });
  return map;
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
  log(`profile_verified=${e.profile?.verified ? "YES" : "NO"}`);
  log(`\n[MODE]`);
  log(`redo_score_mode=${REDO_SCORE_MODE}`);
  log(`redo_target_score_env=${REDO_SCORE_MODE === "target" ? REDO_TARGET_SCORE_RAW ?? "-" : "N/A (random)"}`);
  log(`\n[CANDIDATE]`);
  log(`title=${e.chosenCandidate?.title ?? "-"}`);
  log(`room_id=${e.chosenCandidate?.roomId ?? "-"}`);
  log(`candidates_found=${e.candidatesFound ?? "-"}`);
  log(`candidates_tried=${e.candidatesTried ?? "-"}`);
  if (Array.isArray(e.candidateAttempts)) {
    for (const a of e.candidateAttempts) log(`  - "${a.title}": ${a.ok ? "OK, chosen" : a.reason}`);
  }
  log(`\n[SCORING_PLAN]`);
  log(`total_scored_items=${e.scoringPlan?.totalScoredItems ?? "-"}`);
  log(`total_points_raw=${e.scoringPlan?.totalPointsRaw ?? "-"}`);
  log(`achievable_scores=${e.scoringPlan?.achievableScores?.join(", ") ?? "-"}`);
  log(`target_score=${e.scoringPlan?.targetScore ?? "-"}`);
  log(`required_correct_items=${e.scoringPlan?.requiredCorrectCount ?? "-"}/${e.scoringPlan?.totalScoredItems ?? "-"}`);
  log(`\n[SCORE]`);
  log(`old_score_on_card=${e.score?.oldScoreOnCard ?? "-"} (KHÔNG dùng làm điều kiện pass/fail)`);
  log(`target_score=${e.score?.targetScore ?? "-"}`);
  log(`actual_score=${e.score?.actualScore ?? "-"}`);
  log(`real_correct_count=${e.score?.realCorrectCount ?? "-"}/${e.score?.realTotalCount ?? "-"}`);
  log(`denominator_matches_cms=${e.score?.denominatorMatches ?? "-"}`);
  log(`matched=${e.score?.matched ? "YES" : "NO"}`);
  log(`\n[FLOW]`);
  log(`assignment_opened=${e.redo?.landedOnDoing ? "YES" : "NO"}`);
  log(`result_screen=${e.score?.actualScore != null ? "YES" : "NO"}`);
  log(`returned_to_list=${e.back?.returnedToList ? "YES" : "NO"}`);
  log(`\n[SAFETY]`);
  log(`new_assignments_created=0 (dùng lại bài đã hoàn thành trước đó)`);
  log(`unique_room_resolution_used=true (không đoán matches[0])`);
  log(`answers_chosen_by=SUBSET_SUM_ON_REAL_CMS_ANSWER_KEY (không random đáp án)`);
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
  if (REDO_SCORE_MODE !== "target" && REDO_SCORE_MODE !== "random") {
    throw new Error(`REDO_SCORE_MODE="${REDO_SCORE_MODE}" không hợp lệ - chỉ nhận "target" hoặc "random".`);
  }
  let targetScoreEnv = null;
  if (REDO_SCORE_MODE === "target") {
    targetScoreEnv = Number(REDO_TARGET_SCORE_RAW);
    if (REDO_TARGET_SCORE_RAW === undefined || REDO_TARGET_SCORE_RAW === "" || Number.isNaN(targetScoreEnv)) {
      throw new Error(`REDO_SCORE_MODE=target yêu cầu REDO_TARGET_SCORE là số hợp lệ (hiện tại="${REDO_TARGET_SCORE_RAW}").`);
    }
    if (targetScoreEnv < 0 || targetScoreEnv > 10) {
      throw new Error(`REDO_TARGET_SCORE=${targetScoreEnv} ngoài thang điểm hợp lệ [0, 10].`);
    }
  }

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

    log(`[C] Chọn candidate đầu tiên thoả: room_id unique + CMS resolve được nội dung text-choice + target score (mode=${REDO_SCORE_MODE}) khả thi...`);
    const attempts = [];
    let chosen = null;
    for (const candidate of collected.candidates.slice(0, MAX_CANDIDATE_ATTEMPTS)) {
      const attempt = { title: candidate.title, oldScoreOnCard: parsePreviousScoreForLog(candidate.scoreText) };
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
      const scoringPlan = resolveScoringPlanForCandidate(resolved.questions, { mode: REDO_SCORE_MODE, targetScoreEnv });
      if (!scoringPlan.achievable) {
        attempt.ok = false;
        attempt.reason = scoringPlan.reason;
        attempt.achievableScores = scoringPlan.achievableScores;
        attempts.push(attempt);
        log(`  [SKIP] "${candidate.title}" (room_id=${room.id}): ${attempt.reason}`);
        continue;
      }
      attempt.ok = true;
      attempt.totalScoredItems = scoringPlan.totalScoredItems;
      attempt.targetScore = scoringPlan.targetScore;
      attempts.push(attempt);
      log(
        `  [PASS] "${candidate.title}" (room_id=${room.id}) - totalScoredItems=${scoringPlan.totalScoredItems}, ` +
          `totalPointsRaw=${scoringPlan.totalPointsRaw}, targetScore=${scoringPlan.targetScore} KHẢ THI (achievable=[${scoringPlan.achievableScores.join(", ")}]).`,
      );
      chosen = { candidate, room, resolved, scoringPlan };
      break;
    }
    evidence.candidatesTried = attempts.length;
    evidence.candidateAttempts = attempts;
    if (!chosen) {
      return finish({
        status: "BLOCKED",
        phase: "CANDIDATE_FEASIBILITY",
        error: `Đã thử ${attempts.length}/${collected.candidates.length} candidate - không candidate nào vừa unique/CMS-resolvable vừa khả thi với target score cấu hình.`,
        evidence,
      });
    }
    evidence.chosenCandidate = { title: chosen.candidate.title, roomId: chosen.room.id };
    evidence.scoringPlan = {
      totalScoredItems: chosen.scoringPlan.totalScoredItems,
      totalPointsRaw: chosen.scoringPlan.totalPointsRaw,
      achievableScores: chosen.scoringPlan.achievableScores,
      targetScore: chosen.scoringPlan.targetScore,
      requiredCorrectCount: chosen.scoringPlan.correctIndices.size,
    };

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

    log(
      `[E] Trả lời TOÀN BỘ ${chosen.resolved.questions.length} câu (mục tiêu target=${chosen.scoringPlan.targetScore}, ` +
        `cần đúng ${chosen.scoringPlan.correctIndices.size}/${chosen.resolved.questions.length} item)...`,
    );
    const QUESTIONS = chosen.resolved.questions;
    const WANT_CORRECT = buildWeightedWantCorrectPlan(QUESTIONS, chosen.scoringPlan.correctIndices);
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
          error: `Không khớp được câu hỏi nào (còn ${pool.length} câu) - nội dung hiển thị trên màn hình KHÔNG khớp answers[] của bất kỳ câu nào trong ${pool.length} câu CMS đã resolve (có thể đề thật của lượt "Làm lại" này khác nội dung catalog Teacher Materials - xem GIỚI HẠN CÒN LẠI đầu file).`,
          visibleTexts: collectAllTexts(carryTree ?? (await bridge.hierarchy())),
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
    const actualScore = result.score === null ? null : Number(result.score);
    const denominatorMatches = result.totalCount === null || result.totalCount === QUESTIONS.length;
    const matched = actualScore !== null && !Number.isNaN(actualScore) && Math.abs(actualScore - chosen.scoringPlan.targetScore) < 1e-6;
    evidence.score = {
      oldScoreOnCard: parsePreviousScoreForLog(chosen.candidate.scoreText),
      targetScore: chosen.scoringPlan.targetScore,
      actualScore,
      realCorrectCount: result.correctCount,
      realTotalCount: result.totalCount,
      totalScoredItemsResolved: QUESTIONS.length,
      denominatorMatches,
      matched,
    };
    log(
      `  TARGET=${chosen.scoringPlan.targetScore} ĐIỂM THẬT=${result.score} CHÍNH XÁC=${result.correct} ` +
        `(denominator_matches_cms=${denominatorMatches}, matched=${matched})`,
    );
    if (!matched) {
      return finish({
        status: "FAIL",
        phase: "SCORE_VERIFY",
        error:
          `Điểm thật ${actualScore} KHÁC target ${chosen.scoringPlan.targetScore}` +
          (!denominatorMatches
            ? ` (CẢNH BÁO: tổng câu thật trên màn Kết quả=${result.totalCount} KHÁC tổng scored items CMS resolve được=${QUESTIONS.length} - nghi ngờ đây là nguyên nhân, xem note SCORING ENGINE đầu file).`
            : "."),
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
    console.error("\n[pro_lamlai_target_score] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    finish({ status: "ERROR", error: err.message, stack: err.stack });
    process.exit(2);
  });
