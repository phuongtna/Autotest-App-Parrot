#!/usr/bin/env node
/**
 * E2E-GiaoBai-ProfileHienTai-Diem3-LamLai-Diem8
 *
 * Case theo yêu cầu trực tiếp (2026-08-31): "giao bài tập trên profile hiện tại (không hardcode
 * điểm/bài giao/profile) -> làm bài điểm 3 -> tại màn kết quả bấm 'Làm lại' -> làm lại điểm 8 ->
 * tại màn kết quả bấm 'Tiếp theo' hoặc 'Hoàn thành' (CTA thật đang hiển thị)".
 *
 * CHƯA có sẵn 1 script nào làm ĐÚNG chuỗi này - GHÉP từ code đã verify, KHÔNG viết engine mới:
 *   - Assign (Web GV, Playwright): assignHomeworkFlow() (automation/giao_bai_tap/runtime/
 *     assignHomeworkFlow.js) + fetchEligibleAssignmentTree()/resolveClassId()/
 *     findRoomIdByLessonItem() (automation/giao_bai_tap/navigation/teacherAssignmentApiDiscovery.js)
 *     - CÙNG pipeline flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs dùng.
 *   - Scoring engine (subset-sum theo point thật CMS, KHÔNG giả định N câu=N điểm) +
 *     vòng lặp trả lời/đọc điểm: COPY nguyên từ automation/bai_tap/pro_lamlai_target_score.mjs
 *     (buildScoringPlan/resolveScoringPlanForCandidate/buildWeightedWantCorrectPlan/vòng lặp
 *     findMatchingQuestion+answerCurrentQuestionOneShot ở phase [E] file đó) - dùng LẠI 2 lần
 *     (lượt làm đầu + lượt "Làm lại"), KHÔNG viết engine chấm điểm thứ 2.
 *   - Mở bài LẦN ĐẦU (chưa từng làm): findAssignment()/scrollToTop()/tapFoundCard()
 *     (automation/bai_tap/discovery/findAssignment.js).
 *   - Tìm lại card để "Làm lại": locateSpecificCompletedCandidate()
 *     (automation/bai_tap/discovery/locateCompletedCandidate.js) - CÙNG cơ chế pro_lamlai_target_score.mjs.
 *   - CTA màn Kết quả "Tiếp theo"/"Hoàn thành": CÙNG 2 nhãn đã verify trong
 *     flows/app/bai_tap/ktra_ket_qua_tiep_theo_hoan_thanh.yaml/helpers/finish-exercise-and-return.yaml
 *     - KHÁC finish-exercise-and-return.yaml ở chỗ đây bấm THẬT "Tiếp theo" nếu hiện (đúng yêu cầu
 *       "Bấm Làm tiếp/Tiếp theo HOẶC Hoàn thành" - không dùng workaround đóng X).
 *
 * "PROFILE HIỆN TẠI" (không hardcode): đọc bằng probe read-only riêng trước khi viết file này -
 * hồ sơ đang active trên thiết bị test là "QA Auto Child 20260828_131937" (lớp "7QA-ReRun-0820"),
 * KHÔNG phải "Ngoc"/"Trần Duy Anh" mặc định của các script khác trong repo - đã xác nhận với người
 * yêu cầu trước khi tiếp tục (không đoán). Script này KHÔNG bao giờ tap "Chuyển profile" - nếu hồ
 * sơ active khác PROFILE_NAME lúc chạy thật (vd người khác đã đổi hồ sơ giữa lúc script chạy), BLOCK
 * ngay, không tự chuyển (đúng ngữ nghĩa "hiện tại", không ép về 1 hồ sơ cố định).
 *
 * "BÀI GIAO" (không hardcode): random 1 item eligible thật của lớp qua fetchEligibleAssignmentTree()
 * (CÙNG cơ chế assignHomeworkFlow() dùng khi không truyền homeworkItemName) - NHƯNG lọc thêm điều
 * kiện scoring: phải là text-choice-compatible (an toàn cho decideAnswerAction()) VÀ achievableScores
 * (subset-sum thật trên point CMS) phải chứa CẢ 3 và 8 - vì 2 lượt làm (đầu + Làm lại) dùng lại
 * CÙNG 1 room/bộ câu hỏi CMS, cần validate TRƯỚC khi giao bài thật (tránh giao rồi mới phát hiện
 * không đạt được 1 trong 2 điểm giữa chừng).
 *
 * AN TOÀN (đúng yêu cầu): CHỈ giao ĐÚNG 1 bài (không giao thêm nếu gặp BLOCKED_MISSING_EXERCISE_HANDLER/
 * NO_MATCH giữa chừng - dừng report BLOCKED/FAIL, không tự chọn bài khác để "cho qua").
 *
 * ENV: APP_ID/PHONE/OTP/MAESTRO_DEVICE (.env, test_data/accounts.env), TEACHER_ACCESS_TOKEN/
 *   EXAM_COOKIE (.env, get_teacher_token.sh/get_tokens.sh), TARGET_CLASS_NAME (default
 *   "7QA-ReRun-0820"), PROFILE_NAME (default "QA Auto Child 20260828_131937"),
 *   FIRST_TARGET_SCORE (default 3), REDO_TARGET_SCORE (default 8),
 *   ASSIGN_DUE_DATE_DAYS_AHEAD (default 7), MAX_CANDIDATE_PRESCAN_ATTEMPTS (default 40).
 *
 * CHẠY: node flows/web/giao_bai_tap/e2e-giaobai-profilehientai-diem3-lamlai-diem8.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parseEnvFile } from "../../../automation/src/config.js";
import { MaestroMcpBridge } from "../../../automation/bridge/maestroMcpBridge.js";
import { HomeworkExamEngine } from "../../../automation/bai_tap/navigation/homeworkExamEngine.js";
import {
  fetchEligibleAssignmentTree,
  findRoomIdByLessonItem,
} from "../../../automation/giao_bai_tap/navigation/teacherAssignmentApiDiscovery.js";
import { assignHomeworkFlow } from "../../../automation/giao_bai_tap/runtime/assignHomeworkFlow.js";
import { parseQuestionsFromExamPage } from "../../../automation/discovery/examPageScraper.js";
import { normalizeQuestions } from "../../../automation/model/questionModel.js";
import { resolveHomeworkExamQuestionsForRoomId } from "../../../automation/bai_tap/discovery/teacherMaterialsExamResolver.js";
import { scrollToTop } from "../../../automation/bai_tap/discovery/findAssignment.js";
import { locateSpecificCompletedCandidate } from "../../../automation/bai_tap/discovery/locateCompletedCandidate.js";
import { centerPoint } from "../../../automation/bai_tap/discovery/homeworkUiList.js";
import { findMatchingQuestion } from "../../../automation/bai_tap/discovery/answerSetMatcher.js";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "e2e_giaobai_profilehientai_diem3_lamlai_diem8_report.json");
const EXAM_SESSION_PATH = join(PROJECT_ROOT, "automation", ".cache", "exam_session.json");
const ACCOUNTS_ENV = parseEnvFile(join(PROJECT_ROOT, "test_data", "accounts.env"));
const ROOT_ENV = parseEnvFile(join(PROJECT_ROOT, ".env"));

const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const PHONE = process.env.PHONE || ACCOUNTS_ENV.PHONE;
const OTP = process.env.OTP || ACCOUNTS_ENV.OTP;
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
// Xác nhận thật qua probe read-only (2026-08-31) - xem docblock đầu file, KHÔNG đoán.
const TARGET_CLASS_NAME = process.env.TARGET_CLASS_NAME || "7QA-ReRun-0820";
const PROFILE_NAME = process.env.PROFILE_NAME || "QA Auto Child 20260828_131937";
const FIRST_TARGET_SCORE = Number(process.env.FIRST_TARGET_SCORE || 3);
const REDO_TARGET_SCORE = Number(process.env.REDO_TARGET_SCORE || 8);
const ASSIGN_DUE_DATE_DAYS_AHEAD = Number(process.env.ASSIGN_DUE_DATE_DAYS_AHEAD || 7);
const MAX_CANDIDATE_PRESCAN_ATTEMPTS = Number(process.env.MAX_CANDIDATE_PRESCAN_ATTEMPTS || 40);
const MAX_LOCATE_SCROLLS = 60;
const POINT_SCALE = 1000;

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

function addDaysDdMmYyyy(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function toDM(ddmmyyyy) {
  return ddmmyyyy.slice(0, 5);
}

function toIsoDatePrefix(ddmmyyyy) {
  const [dd, mm, yyyy] = ddmmyyyy.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

/** COPY từ automation/bai_tap/setup-ktra_ket_qua_tiep_theo_hoan_thanh.mjs#flattenNonSpeak() -
 * loại SPEAK (bấm mic khiến app thoát ra ngoài - giới hạn đã biết) + item KHÔNG có đúng 1 examId. */
function flattenNonSpeak(eligibleTree) {
  const flat = [];
  for (const u of eligibleTree) {
    for (const l of u.lessons) {
      if (!l.lessonTag) continue;
      for (const it of l.items) {
        if (it.isSpeak) continue;
        if (!Array.isArray(it.examIds) || it.examIds.length !== 1) continue;
        flat.push({ unitName: u.unitName, lessonName: l.lessonName, lessonTag: l.lessonTag, itemName: it.name, itemId: it.id, examId: it.examIds[0] });
      }
    }
  }
  return flat;
}

/** COPY từ automation/bai_tap/pro_lamlai_target_score.mjs#isTextChoiceCompatible(). */
function isTextChoiceCompatible(questions) {
  if (!Array.isArray(questions) || questions.length < 3) return false;
  return questions.every((q) => {
    const nonEmptyAnswers = (q.answers ?? []).filter((a) => typeof a === "string" && a.trim().length > 0);
    return nonEmptyAnswers.length >= 2 && q.correctAnswer && nonEmptyAnswers.includes(q.correctAnswer);
  });
}

/** ===================== SCORING ENGINE - COPY NGUYÊN từ pro_lamlai_target_score.mjs =====================
 * (buildScoringPlan/scaledSumForScore/achievableScoresList/buildWeightedWantCorrectPlan) - CÙNG
 * công thức subset-sum theo point thật CMS, không giả định N câu = N điểm. Xem docblock đầy đủ
 * trong file gốc (mục "SCORING ENGINE") - không lặp lại ở đây. */
function buildScoringPlan(questions) {
  const scaledPoints = questions.map((q) => Math.round((Number(q.metadata?.point) || 0) * POINT_SCALE));
  const scaledTotal = scaledPoints.reduce((a, b) => a + b, 0);
  if (scaledTotal <= 0) return null;

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

function buildWeightedWantCorrectPlan(questions, correctIndices) {
  const map = new Map();
  questions.forEach((q, i) => {
    const pointRaw = Number(q.metadata?.point) || 0;
    map.set(q.id, pointRaw <= 0 || correctIndices.has(i));
  });
  return map;
}

/** Resolve correctIndices cho ĐÚNG 1 targetScore đã biết chắc khả thi (đã kiểm ở phase prescan) -
 * throw nếu vì lý do gì đó không khả thi nữa (không nên xảy ra, cùng questions/point đã prescan). */
function correctIndicesForExactScore(questions, targetScore) {
  const plan = buildScoringPlan(questions);
  if (!plan) throw new Error(`buildScoringPlan() trả null cho targetScore=${targetScore} (tổng point=0) - không nên xảy ra sau prescan.`);
  const scaledSum = scaledSumForScore(plan.scaledTotal, targetScore);
  if (scaledSum === null) throw new Error(`targetScore=${targetScore} không rơi đúng mốc điểm nguyên nào (scaledTotal=${plan.scaledTotal}) - không nên xảy ra sau prescan.`);
  const correctIndices = plan.correctIndicesForScaledSum(scaledSum);
  if (!correctIndices) throw new Error(`targetScore=${targetScore} không khả thi (scaledSum=${scaledSum}) - không nên xảy ra sau prescan.`);
  return correctIndices;
}

/** ===================== [ASSIGN-PRESCAN] chọn 1 candidate mà CẢ 2 target score đều khả thi =====================
 * COPY tinh thần pickVerifiedTextChoiceCandidates() (setup-ktra_ket_qua_tiep_theo_hoan_thanh.mjs) -
 * KHÁC ở chỗ điều kiện PASS thêm "achievableScores chứa CẢ FIRST_TARGET_SCORE và REDO_TARGET_SCORE"
 * (case này cần làm ĐÚNG 2 điểm khác nhau trên CÙNG 1 room, không phải chỉ "text-choice an toàn"). */
async function pickCandidateAchievingBothScores(pool, { maxAttempts }) {
  const distinctByName = [...new Map(pool.map((c) => [c.itemName, c])).values()];
  log(`  [DISCOVERY] distinct itemName sau dedupe: ${distinctByName.length}`);
  const order = shuffle(distinctByName);
  const attempts = [];
  for (let i = 0; i < order.length && attempts.length < maxAttempts; i++) {
    const cand = order[i];
    let questions = null;
    let reason = null;
    try {
      const examData = await parseQuestionsFromExamPage(cand.examId);
      questions = normalizeQuestions(examData);
    } catch (err) {
      reason = err.message;
    }
    if (!questions) {
      attempts.push({ itemName: cand.itemName, ok: false, reason: reason ?? "parseQuestionsFromExamPage lỗi." });
      log(`  [PRESCAN] "${cand.itemName}": loại (${attempts[attempts.length - 1].reason})`);
      continue;
    }
    if (!isTextChoiceCompatible(questions)) {
      attempts.push({ itemName: cand.itemName, ok: false, reason: "UNSUPPORTED_TYPE_OR_MISSING_CORRECT_ANSWER (SPEAK/CONNECT/DRAG_DROP/...)" });
      log(`  [PRESCAN] "${cand.itemName}": loại (${attempts[attempts.length - 1].reason})`);
      continue;
    }
    const plan = buildScoringPlan(questions);
    if (!plan) {
      attempts.push({ itemName: cand.itemName, ok: false, reason: "Tổng point CMS = 0." });
      log(`  [PRESCAN] "${cand.itemName}": loại (tổng point CMS = 0)`);
      continue;
    }
    const achievableScores = achievableScoresList(plan.scaledTotal, plan.achievableScaledSums);
    const hasFirst = scaledSumForScore(plan.scaledTotal, FIRST_TARGET_SCORE) !== null && plan.correctIndicesForScaledSum(scaledSumForScore(plan.scaledTotal, FIRST_TARGET_SCORE)) != null;
    const hasRedo = scaledSumForScore(plan.scaledTotal, REDO_TARGET_SCORE) !== null && plan.correctIndicesForScaledSum(scaledSumForScore(plan.scaledTotal, REDO_TARGET_SCORE)) != null;
    if (!hasFirst || !hasRedo) {
      attempts.push({ itemName: cand.itemName, ok: false, reason: `achievableScores=[${achievableScores.join(", ")}] thiếu ${!hasFirst ? FIRST_TARGET_SCORE : ""}${!hasFirst && !hasRedo ? " và " : ""}${!hasRedo ? REDO_TARGET_SCORE : ""}` });
      log(`  [PRESCAN] "${cand.itemName}": loại (${attempts[attempts.length - 1].reason})`);
      continue;
    }
    attempts.push({ itemName: cand.itemName, ok: true, achievableScores, totalScoredItems: questions.length });
    log(`  [PRESCAN] "${cand.itemName}": PASS (achievableScores=[${achievableScores.join(", ")}], ${questions.length} scored items) - cả ${FIRST_TARGET_SCORE} và ${REDO_TARGET_SCORE} đều khả thi.`);
    return { picked: cand, questions, attempts };
  }
  return { picked: null, questions: null, attempts };
}

/** COPY từ automation/bai_tap/pro_lamlai_target_score.mjs#refreshExamSessionFromEnvCookie() - cần
 * để parseQuestionsFromExamPage()/resolveHomeworkExamQuestionsForRoomId() (đọc CMS/Exam Editor qua
 * Playwright) có session hợp lệ. */
function refreshExamSessionFromEnvCookie() {
  const examCookie = process.env.EXAM_COOKIE || ROOT_ENV.EXAM_COOKIE;
  if (!examCookie) {
    return { refreshed: false, reason: "EXAM_COOKIE không tồn tại trong .env - chạy get_tokens.sh trước." };
  }
  const session = { examOrigin: "https://exam.parrotedu.vn", cookieHeader: `Bearer=${examCookie}`, localStorage: {} };
  mkdirSync(dirname(EXAM_SESSION_PATH), { recursive: true });
  writeFileSync(EXAM_SESSION_PATH, JSON.stringify(session, null, 2), "utf8");
  return { refreshed: true };
}

/** ===================== PROFILE (KHÔNG switch - đúng ngữ nghĩa "profile hiện tại") ===================== */
async function verifyActiveProfileNoSwitch(bridge) {
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
  if (!login.success) throw new Error(`Không mở được tab "Bài tập": ${login.error}`);

  const tree = await bridge.hierarchy();
  function collectAllTexts(node, acc = []) {
    const t = node?.attributes?.text;
    if (typeof t === "string" && t.trim()) acc.push(t.trim());
    for (const c of node?.children ?? []) collectAllTexts(c, acc);
    return acc;
  }
  const texts = collectAllTexts(tree);
  const pattern = new RegExp(`.*(${PROFILE_NAME.replace(/[.*+?^()|[\]\\]/g, (m) => "\\" + m)}).*`);
  const active = texts.some((t) => pattern.test(t));
  return { active, texts };
}

function finish(result) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  return result;
}

function printReport(r) {
  const e = r.evidence ?? {};
  log(`\n[PROFILE]`);
  log(`profile=${PROFILE_NAME} (không switch - đúng "hồ sơ hiện tại")`);
  log(`profile_active_confirmed=${e.profileActive ? "YES" : "NO"}`);
  log(`\n[ASSIGN]`);
  log(`class=${TARGET_CLASS_NAME}`);
  log(`item=${e.picked?.itemName ?? "-"}`);
  log(`room_id=${e.roomId ?? "-"}`);
  log(`total_scored_items=${e.totalScoredItems ?? "-"}`);
  log(`\n[FIRST ATTEMPT]`);
  log(`target_score=${FIRST_TARGET_SCORE}`);
  log(`actual_score=${e.firstAttempt?.actualScore ?? "-"}`);
  log(`matched=${e.firstAttempt?.matched ? "YES" : "NO"}`);
  log(`\n[LAM LAI - SECOND ATTEMPT]`);
  log(`target_score=${REDO_TARGET_SCORE}`);
  log(`actual_score=${e.redoAttempt?.actualScore ?? "-"}`);
  log(`matched=${e.redoAttempt?.matched ? "YES" : "NO"}`);
  log(`\n[FINAL RESULT CTA]`);
  log(`cta_tapped=${e.finalCta?.cta ?? "-"}`);
  log(`landed=${e.finalCta?.landed ?? "-"}`);
  log(`\n[PERFORMANCE]`);
  log(`duration=${e.totalDurationSeconds != null ? `${e.totalDurationSeconds.toFixed(1)}s` : "-"}`);
  log(`\n[OVERALL]`);
  log(r.status);
  log(`\n[ROOT_CAUSE]`);
  log(r.status === "PASS" ? "-" : (r.error ?? r.phase ?? "-"));
}

/** Vòng lặp trả lời TOÀN BỘ questions theo correctIndices - COPY tinh thần phase [E] của
 * pro_lamlai_target_score.mjs (findMatchingQuestion + answerCurrentQuestionOneShot), tách thành
 * hàm dùng lại được cho CẢ lượt làm đầu lẫn lượt "Làm lại" (KHÁC bản gốc chỉ dùng 1 lần cho redo). */
async function answerAllQuestions(bridge, exam, questions, correctIndices) {
  const wantCorrectMap = buildWeightedWantCorrectPlan(questions, correctIndices);
  const answeredIds = new Set();
  const answerLog = [];
  let carryTree = null;
  let lastOutcome = null;
  while (answeredIds.size < questions.length) {
    const questionIndex = answeredIds.size + 1;
    const pool = questions.filter((q) => !answeredIds.has(q.id));
    const matchResult = await findMatchingQuestion(bridge, pool, carryTree, questionIndex);
    if (matchResult.status !== "MATCHED") {
      const outcomeLabel = matchResult.status === "AMBIGUOUS" ? "AMBIGUOUS_MATCH" : "NO_MATCH";
      return {
        ok: false,
        reason:
          matchResult.status === "AMBIGUOUS"
            ? `AMBIGUOUS_MATCH ở câu ${questionIndex}: ${matchResult.diagnostic.candidates.length} candidate CMS cùng khớp đủ answer-set - không tự chọn.`
            : `NO_MATCH ở câu ${questionIndex} (còn ${pool.length} câu): không có candidate CMS nào khớp đủ đáp án đang hiển thị.`,
        outcomeLabel,
        answerLog,
      };
    }
    const matched = matchResult.question;
    const isLast = answeredIds.size === questions.length - 1;
    const wantCorrect = wantCorrectMap.get(matched.id);
    const outcome = await exam.answerCurrentQuestionOneShot(matched, {
      wantCorrect,
      resultLabel: isLast ? "e2e_giaobai_profile_result_screen" : null,
      snapshot: matched._snapshot ?? null,
    });
    if (!outcome.supported) {
      return { ok: false, reason: `Handler không hỗ trợ câu "${matched.question}" (id=${matched.id}): ${outcome.reason}`, outcomeLabel: "BLOCKED_MISSING_EXERCISE_HANDLER", answerLog };
    }
    lastOutcome = outcome;
    carryTree = outcome.finalTree ?? null;
    answeredIds.add(matched.id);
    answerLog.push({ id: matched.id, question: matched.question, wantCorrect, isTargetCorrect: outcome.isTargetCorrect });
    log(`    Câu ${answeredIds.size}/${questions.length}: nhắm ${wantCorrect ? "ĐÚNG" : "SAI"}, isTargetCorrect=${outcome.isTargetCorrect}`);
  }
  return { ok: true, lastOutcome, answerLog };
}

async function main() {
  if (!APP_ID) throw new Error("Thiếu APP_ID - kiểm tra .env.");
  if (!PHONE || !OTP) throw new Error("Thiếu PHONE/OTP - kiểm tra test_data/accounts.env.");
  if (Number.isNaN(FIRST_TARGET_SCORE) || FIRST_TARGET_SCORE < 0 || FIRST_TARGET_SCORE > 10) {
    throw new Error(`FIRST_TARGET_SCORE=${process.env.FIRST_TARGET_SCORE} ngoài thang [0,10].`);
  }
  if (Number.isNaN(REDO_TARGET_SCORE) || REDO_TARGET_SCORE < 0 || REDO_TARGET_SCORE > 10) {
    throw new Error(`REDO_TARGET_SCORE=${process.env.REDO_TARGET_SCORE} ngoài thang [0,10].`);
  }

  const overallStart = Date.now();
  const evidence = {};

  log(`[0] Refresh EXAM_COOKIE session (automation/.cache/exam_session.json)...`);
  const examSessionResult = refreshExamSessionFromEnvCookie();
  if (!examSessionResult.refreshed) {
    return finish({ status: "BLOCKED", phase: "EXAM_SESSION_REFRESH", error: examSessionResult.reason, evidence });
  }
  log(`  [PASS] exam_session.json đã ghi.`);

  // ===== [1] ASSIGN (Web GV, Playwright) =====
  log(`[1] Quét cây assignment eligible thật của lớp "${TARGET_CLASS_NAME}" (kèm resolve class_id)...`);
  const { eligibleTree, classId, stats } = await fetchEligibleAssignmentTree(TARGET_CLASS_NAME);
  log(`  [PASS] class_id=${classId}`);
  log(`  [EXERCISE_DISCOVERY] total items: ${stats.totalItems} | items with exam: ${stats.itemsWithExam} | items without exam: ${stats.itemsWithoutExam}`);
  const pool = flattenNonSpeak(eligibleTree);
  if (pool.length === 0) {
    return finish({ status: "BLOCKED", phase: "ASSIGN_PRESCAN", error: `Lớp "${TARGET_CLASS_NAME}" không có item eligible non-SPEAK nào.`, evidence });
  }

  log(`[1] Prescan candidate mà CẢ target=${FIRST_TARGET_SCORE} và target=${REDO_TARGET_SCORE} đều khả thi (budget ${MAX_CANDIDATE_PRESCAN_ATTEMPTS})...`);
  const { picked, questions: prescanQuestions, attempts } = await pickCandidateAchievingBothScores(pool, { maxAttempts: MAX_CANDIDATE_PRESCAN_ATTEMPTS });
  evidence.prescanAttempts = attempts.length;
  if (!picked) {
    return finish({
      status: "BLOCKED",
      phase: "ASSIGN_PRESCAN",
      error: `Đã thử ${attempts.length}/${pool.length} candidate - không candidate nào vừa text-choice-compatible vừa đạt được CẢ 2 target score (${FIRST_TARGET_SCORE}, ${REDO_TARGET_SCORE}) trên cùng 1 room.`,
      evidence,
    });
  }
  evidence.picked = { itemName: picked.itemName, unitName: picked.unitName, lessonName: picked.lessonName };
  log(`  [PASS] Chọn "${picked.itemName}" (unit=${picked.unitName}, lesson=${picked.lessonName}).`);

  const dueDateDdMmYyyy = addDaysDdMmYyyy(ASSIGN_DUE_DATE_DAYS_AHEAD);
  log(`[1] Giao bài "${picked.itemName}" cho lớp "${TARGET_CLASS_NAME}", hạn nộp ${dueDateDdMmYyyy}...`);
  const assignResult = await assignHomeworkFlow({
    primaryClass: TARGET_CLASS_NAME,
    dueDate: dueDateDdMmYyyy,
    unitName: picked.unitName,
    // ĐÚNG NHÃN TAB Web GV thật (lessonTag = lesson.tag.name) - KHÔNG dùng picked.lessonName (tên
    // CMS thô, có thể khác text nút DOM) - xem comment gốc trong teacherAssignmentApiDiscovery.js
    // + cùng fix đã verify trong e2e-teacher-assign-full-scored-target5.mjs dòng 1273-1276.
    lessonName: picked.lessonTag,
    homeworkItemId: picked.itemId,
    homeworkItemName: picked.itemName,
    headless: true,
  });
  evidence.assignResult = { status: assignResult.status, steps: assignResult.steps?.map((s) => ({ name: s.name, status: s.status })) };
  if (assignResult.status !== "PASS") {
    return finish({ status: "FAIL", phase: "ASSIGN", error: `assignHomeworkFlow() FAIL: ${assignResult.error}`, evidence });
  }
  log(`  [PASS] Đã giao bài qua Web GV.`);

  log(`[1] Resolve room_id thật của bài vừa giao (lessonItemId=${picked.itemId})...`);
  const room = await findRoomIdByLessonItem({ lessonItemId: picked.itemId, classId, endTimeDatePrefix: toIsoDatePrefix(dueDateDdMmYyyy) });
  evidence.roomId = room.id;
  log(`  [PASS] room_id=${room.id}`);

  log(`[1] Resolve câu hỏi/đáp án thật qua CMS cho room_id=${room.id} (xác nhận lại, không dùng thẳng prescan)...`);
  const resolved = await resolveHomeworkExamQuestionsForRoomId(room.id);
  if (resolved.status !== "RESOLVED") {
    return finish({ status: "BLOCKED", phase: "RESOLVE_QUESTIONS", error: `resolveHomeworkExamQuestionsForRoomId status=${resolved.status}: ${resolved.reason}`, evidence });
  }
  const swapAnswer = resolved.roomDetails?.room?.exams?.[0]?.is_swap_answer ?? null;
  const swapQuestion = resolved.roomDetails?.room?.exams?.[0]?.is_swap_question ?? null;
  if (swapAnswer || swapQuestion) {
    return finish({ status: "BLOCKED", phase: "RESOLVE_QUESTIONS", error: `is_swap_answer=${swapAnswer}/is_swap_question=${swapQuestion} - không tin tưởng đáp án.`, evidence });
  }
  const QUESTIONS = resolved.questions;
  evidence.totalScoredItems = QUESTIONS.length;
  log(`  [PASS] ${QUESTIONS.length} scored items resolved từ CMS.`);

  const firstCorrectIndices = correctIndicesForExactScore(QUESTIONS, FIRST_TARGET_SCORE);
  const redoCorrectIndices = correctIndicesForExactScore(QUESTIONS, REDO_TARGET_SCORE);
  log(`  [PASS] targetScore=${FIRST_TARGET_SCORE} cần đúng ${firstCorrectIndices.size}/${QUESTIONS.length} item; targetScore=${REDO_TARGET_SCORE} cần đúng ${redoCorrectIndices.size}/${QUESTIONS.length} item.`);

  // ===== [2] DEVICE (Maestro MCP bridge) =====
  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);
  let bridgeStopped = false;

  try {
    log(`[2] Xác nhận hồ sơ "${PROFILE_NAME}" đang active (KHÔNG switch)...`);
    const profileCheck = await verifyActiveProfileNoSwitch(bridge);
    evidence.profileActive = profileCheck.active;
    if (!profileCheck.active) {
      return finish({
        status: "BLOCKED",
        phase: "PROFILE_CHECK",
        error: `Hồ sơ đang active KHÔNG khớp "${PROFILE_NAME}" - script này KHÔNG tự chuyển hồ sơ (đúng ngữ nghĩa "profile hiện tại"). Texts đọc được: ${JSON.stringify(profileCheck.texts.slice(0, 10))}`,
        evidence,
      });
    }
    log(`  [PASS] Hồ sơ "${PROFILE_NAME}" xác nhận đang active.`);

    log(`[2] Cuộn về đỉnh danh sách "Bài tập" trước khi tìm bài vừa giao...`);
    const topResult = await scrollToTop(bridge);
    if (!topResult.atTop) log(`  [WARN] scrollToTop() không xác nhận: ${topResult.reason} - vẫn tiếp tục tìm từ vị trí hiện tại.`);

    // ĐÃ ĐỔI (2026-08-31, FAIL thật xác nhận qua run trước): findAssignment()/tapFoundCard() (đọc
    // hierarchy qua Node + 1 swipe cố định 55% màn hình/lượt) BỎ LỠ card vừa giao khi CTA của nó
    // CHƯA kịp mount trong cây (title+due-date đã thấy ngay ở lượt đọc đầu tiên nhưng CTA "Làm bài"
    // nằm ngoài viewport - RecyclerView virtualization) - lượt cuộn kế tiếp lại NHẢY QUÁ xa (không
    // có cơ chế "cuộn nhỏ dò dần + tự chờ ổn định" như scrollUntilVisible gốc của Maestro), làm mất
    // hẳn card khỏi màn hình. CHUYỂN sang compound `scrollUntilVisible` NGUYÊN VĂN của Maestro
    // (SCROLL TARGET = title, due-date chỉ dùng VERIFY, tapOn CTA lồng 2 cấp "below") - CÙNG cơ chế
    // ĐÃ VERIFY trong flows/app/helpers/open-exercise.yaml (không viết lại logic, chỉ inline qua
    // bridge.runSteps() vì MaestroMcpSession không resolve được runFlow:{file:...} - xem docblock
    // automation/bai_tap/pro_lamlai_fullluong.mjs mục [F]). Escape regex đặc biệt trong title tính
    // sẵn ở Node (không cần biểu thức JS ${...} của Maestro, tránh luôn bug "$" đã ghi nhận ở đó).
    log(`[2] Mở bài "${picked.itemName}" (hạn nộp ${toDM(dueDateDdMmYyyy)}) qua scrollUntilVisible compound selector...`);
    const escapedTitle = picked.itemName.replace(/[.*+?^()|[\]\\]/g, (m) => "\\" + m);
    const dueDateDM = toDM(dueDateDdMmYyyy);
    const openNew = await bridge.runSteps([
      {
        scrollUntilVisible: {
          element: { text: `.*${escapedTitle}.*` },
          direction: "DOWN",
          timeout: 150000,
          speed: 70,
          waitToSettleTimeoutMs: 500,
        },
      },
      { assertVisible: { text: `.*Hạn nộp ${dueDateDM}.*`, below: { text: `.*${escapedTitle}.*` } } },
      {
        tapOn: {
          // PHASE 7 (2026-08-31, xem PHASE 6F/6G): thêm "Chinh phục" - CTA thật của card "Bài tập
          // nâng cao" chưa làm (vd "G7U2-HW-LB lang-BTNC", resource-id
          // homework_card_advanced_0_action_conquer) - đã xác nhận là giá trị hợp lệ từ trước trong
          // CTA_TEXTS (discovery/homeworkUiList.js:61), chỉ chưa được đưa vào selector RIÊNG của file
          // này. Trước bản vá: selector không match card dạng này -> Maestro trả "Element not found"
          // -> tap không bao giờ dispatch -> flow kẹt ở màn danh sách.
          text: ".*(Làm bài|Làm lại|Tiếp tục|Chinh phục).*",
          below: { text: `.*Hạn nộp ${dueDateDM}.*`, below: { text: `.*${escapedTitle}.*` } },
        },
      },
      { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
      { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 40000 } },
    ]);
    if (!openNew.success) {
      return finish({ status: "FAIL", phase: "OPEN_NEW_ASSIGNMENT", error: `Mở bài vừa giao thất bại: ${openNew.error}`, evidence });
    }
    log(`  [PASS] Đã vào màn Doing (lần làm đầu).`);

    // ===== [3] LẦN LÀM ĐẦU - target FIRST_TARGET_SCORE =====
    log(`[3] Trả lời ${QUESTIONS.length} câu, nhắm điểm ${FIRST_TARGET_SCORE}...`);
    const firstAnswer = await answerAllQuestions(bridge, exam, QUESTIONS, firstCorrectIndices);
    if (!firstAnswer.ok) {
      return finish({ status: firstAnswer.outcomeLabel === "BLOCKED_MISSING_EXERCISE_HANDLER" ? "BLOCKED" : "FAIL", phase: "FIRST_ATTEMPT_ANSWER", error: firstAnswer.reason, evidence: { ...evidence, firstAnswerLog: firstAnswer.answerLog } });
    }
    const firstFinalTree = firstAnswer.lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(firstFinalTree)) {
      return finish({ status: "FAIL", phase: "FIRST_ATTEMPT_RESULT", error: "Không thấy màn Kết quả sau khi trả lời hết câu (lần làm đầu).", evidence });
    }
    const firstResult = exam.readResult(firstFinalTree);
    const firstActualScore = firstResult.score === null ? null : Number(firstResult.score);
    const firstMatched = firstActualScore !== null && !Number.isNaN(firstActualScore) && Math.abs(firstActualScore - FIRST_TARGET_SCORE) < 1e-6;
    evidence.firstAttempt = { targetScore: FIRST_TARGET_SCORE, actualScore: firstActualScore, correct: firstResult.correct, matched: firstMatched };
    log(`  TARGET=${FIRST_TARGET_SCORE} ĐIỂM THẬT=${firstResult.score} CHÍNH XÁC=${firstResult.correct}`);
    if (!firstMatched) {
      return finish({ status: "FAIL", phase: "FIRST_ATTEMPT_SCORE_VERIFY", error: `Điểm thật ${firstActualScore} KHÁC target ${FIRST_TARGET_SCORE}.`, evidence });
    }

    // Đóng màn Kết quả lần đầu để về danh sách - KHÔNG có bài nào khác để "Tiếp theo" (chỉ vừa giao
    // đúng 1 bài), nên chỉ cần xử lý "Hoàn thành" (nếu "Tiếp theo" hiện, dùng nút đóng X - tình
    // huống này không nên xảy ra với đúng 1 bài giao, nhưng xử lý cho chắc, giống finish-exercise-
    // and-return.yaml).
    const closeFirst = await bridge.runSteps([
      { runFlow: { when: { visible: "Hoàn thành" }, commands: [{ tapOn: { text: ".*(Hoàn thành).*" } }] } },
      { runFlow: { when: { visible: "Tiếp theo" }, commands: [{ tapOn: { id: "exercise_result_close_button" } }] } },
      { extendedWaitUntil: { visible: { id: "homework_screen" }, timeout: 30000 } },
    ]);
    if (!closeFirst.success) {
      return finish({ status: "FAIL", phase: "CLOSE_FIRST_RESULT", error: `Không quay lại homework_screen sau lần làm đầu: ${closeFirst.error}`, evidence });
    }
    log(`  [PASS] Đã đóng màn Kết quả (lần đầu), về lại danh sách Bài tập.`);

    // ===== [4] TÌM LẠI CARD -> "Làm lại" =====
    log(`[4] Tìm lại card "${picked.itemName}" (cta="Làm lại")...`);
    const relocated = await locateSpecificCompletedCandidate(bridge, picked.itemName, { maxScrolls: MAX_LOCATE_SCROLLS });
    const freshCandidate = relocated.candidates[0];
    if (!freshCandidate) {
      return finish({ status: "FAIL", phase: "LOCATE_LAM_LAI", error: `Không tìm lại được card "${picked.itemName}" với cta="Làm lại" sau ${relocated.scrollsUsed} lượt cuộn (stopReason=${relocated.stopReason ?? "UNKNOWN"}).`, evidence });
    }
    log(`  [PASS] Tìm thấy card "Làm lại" sau ${relocated.scrollsUsed} lượt cuộn.`);

    const ctaPoint = centerPoint(freshCandidate.ctaBounds);
    const tapRedo = await bridge.runSteps([
      { tapOn: { point: `${ctaPoint.x},${ctaPoint.y}` } },
      { waitForAnimationToEnd: { timeout: 3000 } },
      { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
      { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 15000 } },
    ]);
    if (!tapRedo.success) {
      return finish({ status: "FAIL", phase: "TAP_LAM_LAI", error: `Tap "Làm lại" thất bại: ${tapRedo.error}`, evidence });
    }
    log(`  [PASS] Đã tap "Làm lại" - vào màn Doing (lần 2).`);

    // ===== [5] LÀM LẠI - target REDO_TARGET_SCORE =====
    log(`[5] Trả lời lại ${QUESTIONS.length} câu, nhắm điểm ${REDO_TARGET_SCORE}...`);
    const redoAnswer = await answerAllQuestions(bridge, exam, QUESTIONS, redoCorrectIndices);
    if (!redoAnswer.ok) {
      return finish({ status: redoAnswer.outcomeLabel === "BLOCKED_MISSING_EXERCISE_HANDLER" ? "BLOCKED" : "FAIL", phase: "REDO_ATTEMPT_ANSWER", error: redoAnswer.reason, evidence: { ...evidence, redoAnswerLog: redoAnswer.answerLog } });
    }
    const redoFinalTree = redoAnswer.lastOutcome?.finalTree ?? null;
    if (!exam.isResultScreen(redoFinalTree)) {
      return finish({ status: "FAIL", phase: "REDO_ATTEMPT_RESULT", error: "Không thấy màn Kết quả sau khi trả lời hết câu (Làm lại).", evidence });
    }
    const redoResult = exam.readResult(redoFinalTree);
    const redoActualScore = redoResult.score === null ? null : Number(redoResult.score);
    const redoMatched = redoActualScore !== null && !Number.isNaN(redoActualScore) && Math.abs(redoActualScore - REDO_TARGET_SCORE) < 1e-6;
    evidence.redoAttempt = { targetScore: REDO_TARGET_SCORE, actualScore: redoActualScore, correct: redoResult.correct, matched: redoMatched };
    log(`  TARGET=${REDO_TARGET_SCORE} ĐIỂM THẬT=${redoResult.score} CHÍNH XÁC=${redoResult.correct}`);
    if (!redoMatched) {
      return finish({ status: "FAIL", phase: "REDO_ATTEMPT_SCORE_VERIFY", error: `Điểm thật ${redoActualScore} KHÁC target ${REDO_TARGET_SCORE}.`, evidence });
    }

    // ===== [6] MÀN KẾT QUẢ CUỐI - bấm THẬT "Tiếp theo" hoặc "Hoàn thành" (CTA đang hiển thị) =====
    log(`[6] Đọc CTA thật đang hiển thị trên màn Kết quả (Tiếp theo/Hoàn thành) rồi bấm THẬT (không dùng workaround đóng X)...`);
    const ctaTexts = (function collectAllTexts(node, acc = []) {
      const t = node?.attributes?.text;
      if (typeof t === "string" && t.trim()) acc.push(t.trim());
      for (const c of node?.children ?? []) collectAllTexts(c, acc);
      return acc;
    })(redoFinalTree);
    const hasTiepTheo = ctaTexts.some((t) => /Tiếp theo/.test(t));
    const hasHoanThanh = ctaTexts.some((t) => /Hoàn thành/.test(t));
    if (!hasTiepTheo && !hasHoanThanh) {
      return finish({ status: "FAIL", phase: "FINAL_CTA_DETECT", error: `Không thấy CTA "Tiếp theo" lẫn "Hoàn thành" trên màn Kết quả sau Làm lại. Texts: ${JSON.stringify(ctaTexts)}`, evidence });
    }
    const ctaToTap = hasTiepTheo ? "Tiếp theo" : "Hoàn thành";
    const tapFinalCta = await bridge.runSteps([{ tapOn: { text: `.*(${ctaToTap}).*` } }]);
    if (!tapFinalCta.success) {
      return finish({ status: "FAIL", phase: "FINAL_CTA_TAP", error: `Tap "${ctaToTap}" thất bại: ${tapFinalCta.error}`, evidence });
    }
    const landExpectation = ctaToTap === "Tiếp theo" ? { id: "exercise_close_button" } : { id: "homework_screen" };
    const landResult = await bridge.wait(landExpectation, { timeout: 30000 });
    evidence.finalCta = { cta: ctaToTap, landed: landResult.success };
    if (!landResult.success) {
      return finish({ status: "FAIL", phase: "FINAL_CTA_LAND", error: `Bấm "${ctaToTap}" nhưng không xác nhận được điều hướng đúng (${JSON.stringify(landExpectation)}): ${landResult.error}`, evidence });
    }
    log(`  [PASS] Đã bấm THẬT "${ctaToTap}" - điều hướng đúng (${ctaToTap === "Tiếp theo" ? "vào bài tiếp theo" : "về danh sách Bài tập"}).`);

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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((result) => {
      printReport(result);
      log(`\nĐã ghi report ra ${OUTPUT_FILE}`);
      process.exit(result.status === "PASS" ? 0 : result.status === "BLOCKED" ? 3 : 1);
    })
    .catch((err) => {
      console.error("\n[e2e-giaobai-profilehientai-diem3-lamlai-diem8] Dừng lại vì lỗi ngoài dự kiến:\n", err);
      finish({ status: "ERROR", error: err.message, stack: err.stack });
      process.exit(2);
    });
}
