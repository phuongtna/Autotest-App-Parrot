#!/usr/bin/env node
/**
 * Setup + run cho HW-29 (flows/app/bai_tap/ktra_ket_qua_tiep_theo_hoan_thanh.yaml).
 *
 * MỞ RỘNG (2026-09-07, yêu cầu user - xem repo memory sau khi task này chạy xong): case này TRƯỚC
 * ĐÂY (docblock gốc 2026-08-22, xem lịch sử qua `git log` nếu cần) CHỦ Ý scope OUT việc verify điểm
 * THẬT - chỉ verify CTA "Tiếp theo"/"Hoàn thành" đúng nhãn + điều hướng đúng, trả lời câu bằng
 * `helpers/answer-current-exercise-generic.yaml` (dispatcher MÙ, tap cho qua, không biết đúng/sai).
 * User đã yêu cầu MỞ RỘNG rõ ràng: verify ĐIỂM SỐ THẬT đạt được sau khi nộp bài khớp 1 khoảng mục
 * tiêu (TARGET_SCORE_MIN/MAX) - đòi hỏi kiểm soát được đáp án đúng/sai theo CMS, việc mà YAML thuần
 * không làm được (không có nhánh CMS/scoring nào trong Maestro YAML).
 *
 * TÁI SỬ DỤNG (KHÔNG viết lại scoring engine/CMS pipeline đã có - xem
 * automation/bai_tap/pro_lamlai_target_score.mjs, case anh em ĐÃ có toàn bộ cơ chế này cho luồng
 * "làm lại"):
 *   - CMS/scoring engine: `refreshExamSessionFromEnvCookie`, `resolveHomeworkExamQuestionsForRoomIdCachedWithRetry`,
 *     `buildScoringPlan`, `scaledSumForScore`, `achievableScoresList`, `resolveScoringPlanForCandidate`,
 *     `buildWeightedWantCorrectPlan` - COPY-IMPORT NGUYÊN VẸN từ pro_lamlai_target_score.mjs (đã thêm
 *     `export` cho các hàm này, KHÔNG đổi logic bên trong - xem docblock SCORING ENGINE ở đó).
 *   - Answer/matching: `HomeworkExamEngine`/`answerCurrentQuestionOneShot`/`isResultScreen`/`readResult`
 *     (automation/bai_tap/navigation/homeworkExamEngine.js) + `findMatchingQuestion`
 *     (automation/bai_tap/discovery/answerSetMatcher.js) - CÙNG pipeline case "làm lại" đang dùng.
 *   - Bridge: `MaestroMcpBridge` (automation/bridge/maestroMcpBridge.js) - 1 tiến trình `maestro mcp`
 *     DUY NHẤT sống xuyên suốt phase mở+trả lời+submit+verify của CẢ 3 bài (current/near/far), THAY
 *     cho việc shell-out `maestro test <yaml>` cũ (không thể xen CMS/scoring engine vào giữa 1 lượt
 *     `maestro test` chạy độc lập).
 *   - Login: `loginAndDetectActiveProfile()` bên dưới MIRROR CÙNG chuỗi bước/testID/timeout đã verify
 *     trong `ensureProProfileActive()` của pro_lamlai_target_score.mjs (chính nó lại mirror
 *     `flows/app/helpers/ensure-profile-active.yaml` + `login.yaml` + `open-tab-homework.yaml`) -
 *     KHÔNG bịa selector mới, chỉ khác: KHÔNG switch sang 1 profileName cố định nào - xem MỞ RỘNG LẦN 2
 *     bên dưới (2026-09-07, yêu cầu user).
 *   - Mở bài từ danh sách: `openCurrentFromList()` bên dưới MIRROR chuỗi bước DEVICE_MODE=true của
 *     `flows/app/helpers/open-exercise.yaml` (scrollUntilVisible theo title -> assertVisible "Hạn nộp"
 *     ngay dưới title -> tapOn CTA lồng "below" 2 cấp) - CÙNG lý do lịch sử/bug đã ghi trong file đó
 *     (KHÔNG bịa cơ chế mới).
 *
 * KIẾN TRÚC MỚI (thay vì shell-out `maestro test` như bản cũ):
 *   [1] Quét cây assignment eligible thật + [1b] xác nhận CMS text-choice-compatible + [2] Giao 3 bài
 *       qua Web GV - GIỮ NGUYÊN 100% không đổi 1 dòng nào (đúng yêu cầu "preserve exactly").
 *   [3] MỚI: Resolve room_id (Homework mới giao, CHƯA ai làm - "attempts" còn null) + CMS answer key
 *       (`resolveHomeworkExamQuestionsForRoomIdCachedWithRetry`) + scoring plan (target score theo
 *       TARGET_SCORE_MIN/MAX env) cho CẢ 3 bài (current/near/far) TRƯỚC KHI đụng vào thiết bị - cùng
 *       tinh thần Phase B/C của pro_lamlai_target_score.mjs.
 *   [4] MỚI: 1 phiên `MaestroMcpBridge` DUY NHẤT: loginAndDetectActiveProfile() -> mở "current" từ danh sách ->
 *       trả lời theo wantCorrectMap đã tính -> đọc+verify điểm thật -> assert CTA "Tiếp theo" -> bấm
 *       thật -> lặp lại cho "near" (không mở lại từ danh sách - "Tiếp theo" tự đưa vào, ĐÚNG semantics
 *       cũ của YAML) -> assert CTA "Tiếp theo" -> bấm thật -> "far" -> assert CTA "Hoàn thành" -> bấm
 *       thật -> assert quay lại "homework_screen".
 *   File YAML gốc (`ktra_ket_qua_tiep_theo_hoan_thanh.yaml`) GIỮ NGUYÊN, KHÔNG xoá/sửa - vẫn dùng được
 *   độc lập cho 1 lượt chạy CHỈ verify CTA (không cần EXAM_COOKIE/CMS) nếu cần sau này.
 *
 * SCORE TARGETING (ENV, KHÔNG hardcode - đúng rule feedback_never_hardcode_score_or_exercise, exercise
 * pick vẫn 100% randomized qua [1]-[1b] như cũ, CHỈ target-score là có thể ép qua ENV cho mục đích
 * test):
 *   TARGET_SCORE_MIN, TARGET_SCORE_MAX (số, thang 0-10):
 *     - CẢ HAI bằng nhau -> mục tiêu CHÍNH XÁC giá trị đó (không đoán/không làm tròn - nếu điểm đó
 *       không khả thi với ĐÚNG bộ câu hỏi thật của bài, script BLOCKED rõ ràng kèm danh sách điểm khả
 *       thi thật, KHÔNG tự đổi bài/tự hạ yêu cầu).
 *     - MIN < MAX -> random 1 điểm KHẢ THI THẬT (không phải bất kỳ số nào trong khoảng - phải nằm
 *       trong tập điểm mà chính bộ câu hỏi CMS thật của bài có thể đạt được) nằm trong [MIN, MAX].
 *     - KHÔNG set biến nào -> mặc định random 1 điểm khả thi thật trong khoảng MỞ (0, 10) - loại trừ
 *       cả 2 đầu mút 0 và 10, không hardcode 1 giá trị cụ thể nào trong code.
 *   Áp dụng ĐỘC LẬP cho từng bài trong 3 bài (current/near/far đều tự random/target riêng theo cùng
 *   quy tắc trên - không dùng chung 1 target cho cả 3).
 *
 * FORBIDDEN (yêu cầu rõ của user, không có ngoại lệ): random-đáp-án-rồi-hy-vọng, retry-tới-khi-khớp,
 * sửa lại target SAU KHI đã thấy điểm thật, bỏ qua/làm mềm assertion điểm. Điểm thật KHÁC target ->
 * FAIL to, kèm đầy đủ: target, actual, breakdown câu nào nhắm đúng/sai, đáp án đúng CMS, cách tính.
 *
 * MỞ RỘNG LẦN 2 (2026-09-07, yêu cầu user - xem repo memory sau khi task này chạy xong): KHÔNG còn
 * hardcode PHONE/OTP/PROFILE_NAME/ASSIGN_PRIMARY_CLASS cho 1 tài khoản cố định. "Từ nay chạy case
 * này LUÔN dùng đúng profile ĐANG active trên chính thiết bị" - KHÔNG tự logout/switch/pm clear để
 * đổi sang tài khoản khác (cùng tinh thần memory feedback_keep_active_profile_for_giao_bai). Xem
 * `loginAndDetectActiveProfile()` (đọc tên profile bằng vị trí header, KHÔNG có resource-id) +
 * `resolveClassForProfileName()` (tra ngược lớp thật của profile đó qua API GV, năm học hiện tại -
 * MỚI export `listClassesForCurrentYear()`/`fetchClassStudents()` trong teacherAssignmentApiDiscovery.js
 * cho việc này). PHONE/OTP giờ CHỈ là fallback dùng khi app THẬT SỰ đang ở màn đăng nhập (chưa có
 * phiên nào active) - bình thường không bao giờ được dùng tới vì phiên đã sẵn có.
 *
 * ENV:
 *   APP_ID (.env)
 *   PHONE, OTP (KHÔNG có default - CHỈ dùng nếu app đang ở màn đăng nhập, xem MỞ RỘNG LẦN 2 ở trên)
 *   MAESTRO_DEVICE (tuỳ chọn, khớp deviceId khi khởi tạo MaestroMcpBridge)
 *   TEACHER_ACCESS_TOKEN/CMS_TOKEN/EXAM_COOKIE (.env, xem get_teacher_token.sh/get_tokens.sh - PHẢI
 *     refresh trước khi chạy, xem README/memory feedback_get_tokens_script)
 *   TARGET_SCORE_MIN / TARGET_SCORE_MAX (tuỳ chọn - xem SCORE TARGETING ở trên)
 *
 * CHẠY: node automation/bai_tap/setup-ktra_ket_qua_tiep_theo_hoan_thanh.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseEnvFile, requireTeacherPortalConfig } from "../src/config.js";
import { assignHomeworkFlow } from "../giao_bai_tap/runtime/assignHomeworkFlow.js";
import {
  fetchEligibleAssignmentTree,
  listClassesForCurrentYear,
  fetchClassStudents,
} from "../giao_bai_tap/navigation/teacherAssignmentApiDiscovery.js";
import { parseQuestionsFromExamPage } from "../discovery/examPageScraper.js";
import { normalizeQuestions } from "../model/questionModel.js";
import { MaestroMcpBridge } from "../bridge/maestroMcpBridge.js";
import { HomeworkExamEngine, collectTexts } from "./navigation/homeworkExamEngine.js";
import { getHomeworks } from "./discovery/homeworks.js";
import { isoToDueDateDM } from "./model/homeworkModel.js";
import { findMatchingQuestion } from "./discovery/answerSetMatcher.js";
import {
  refreshExamSessionFromEnvCookie,
  resolveHomeworkExamQuestionsForRoomIdCachedWithRetry,
  buildScoringPlan,
  scaledSumForScore,
  achievableScoresList,
} from "./pro_lamlai_target_score.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "ktra_ket_qua_tiep_theo_hoan_thanh_report.json");
const ROOT_ENV = parseEnvFile(join(PROJECT_ROOT, ".env"));

const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
// MỞ RỘNG (2026-09-07, yêu cầu user): KHÔNG còn hardcode PHONE/OTP/PROFILE_NAME/ASSIGN_PRIMARY_CLASS
// cho 1 tài khoản cố định ("Hoàng Lan"/2A, xem lịch sử cũ qua `git log` nếu cần) - "từ nay chạy case
// này luôn dùng đúng profile ĐANG active trên chính thiết bị", KHÔNG tự switch/logout/pm clear để
// đổi sang tài khoản khác (cùng tinh thần memory feedback_keep_active_profile_for_giao_bai, áp dụng
// RIÊNG cho case này bằng auto-detect thay vì chỉ "không tự đổi"). Xem loginAndDetectActiveProfile()
// + resolveClassForProfileName() bên dưới - PHONE/OTP giờ CHỈ là fallback dùng khi app THẬT SỰ đang
// ở màn đăng nhập (chưa có phiên nào active) - để trống nếu không cần (case bình thường: app đã có
// sẵn phiên active, PHONE/OTP không bao giờ được dùng tới).
const PHONE = process.env.PHONE || "";
const OTP = process.env.OTP || "";
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";

function log(...args) {
  console.log(...args);
}

function addDaysDdMmYyyy(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "DD/MM/YYYY" -> "DD/MM" (format EXERCISE_DUE_DATE_DM dùng trong open-exercise.yaml). */
function toDM(ddmmyyyy) {
  return ddmmyyyy.slice(0, 5);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Gom phẳng cây eligible + loại SPEAK (giới hạn thật đã biết - xem
 * flows/app/bai_tap/ktra_fullluong_lambai.yaml dòng 19-24: bấm mic trên thiết bị thật khiến app
 * thoát ra ngoài khi làm qua tab Bài tập).
 * QUAN TRỌNG: nút "Chọn Lesson" thật trên Web GV hiển thị theo `lesson.tag.name` (`lessonTag`),
 * KHÔNG PHẢI `lesson.name` - 2 giá trị CHỈ trùng nhau đôi khi (xác nhận thật 2026-08-22) - xem cùng
 * lỗi đã fix trong flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs dòng 538-547. */
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

/** COPY NGUYÊN từ automation/bai_tap/pro_lamlai_target_score.mjs#isTextChoiceCompatible() -
 * loại trừ SPEAK/CONNECT/DRAG_DROP/... XÁC NHẬN THẬT CẦN THIẾT (2026-08-22): item-level `isSpeak`
 * (dựa `skills` catalog) đã bỏ lọt 1 item "Listen and repeat" thực chứa câu SPEAK ("Nhấn để nói") -
 * report BLOCKED_MISSING_EXERCISE_HANDLER thật trên thiết bị. Check theo NỘI DUNG CÂU HỎI THẬT
 * (CMS) đáng tin hơn field `skills` ở cấp item. */
function isTextChoiceCompatible(questions) {
  if (!Array.isArray(questions) || questions.length < 1) return false;
  return questions.every((q) => {
    const nonEmptyAnswers = (q.answers ?? []).filter((a) => typeof a === "string" && a.trim().length > 0);
    return nonEmptyAnswers.length >= 2 && q.correctAnswer && nonEmptyAnswers.includes(q.correctAnswer);
  });
}

/** Random + xác nhận THẬT (qua CMS) cho tới khi đủ `count` candidate text-choice-compatible, KHÔNG
 * trùng itemName với nhau - nhiều item khác nhau (khác itemId, khác unit/lesson) có thể dùng CHUNG
 * 1 itemName mẫu, cần tên riêng biệt để không lẫn lộn khi đọc report/log. Giới hạn `maxAttempts`
 * lần thử (không phải mỗi lần PASS) để tránh quét vô hạn nếu class có quá nhiều câu SPEAK/CONNECT. */
async function pickVerifiedTextChoiceCandidates(pool, count, { maxAttempts = 40 } = {}) {
  const distinctByName = [...new Map(pool.map((c) => [c.itemName, c])).values()];
  log(`  [DISCOVERY] distinct itemName sau dedupe: ${distinctByName.length}`);
  const order = shuffle(distinctByName);
  const picked = [];
  const attempts = [];
  for (let i = 0; i < order.length && picked.length < count && attempts.length < maxAttempts; i++) {
    const cand = order[i];
    let questions = null;
    let reason = null;
    try {
      const examData = await parseQuestionsFromExamPage(cand.examId);
      questions = normalizeQuestions(examData);
    } catch (err) {
      reason = err.message;
    }
    const ok = questions ? isTextChoiceCompatible(questions) : false;
    attempts.push({ itemName: cand.itemName, ok, reason: reason ?? (!ok ? "UNSUPPORTED_TYPE_OR_MISSING_CORRECT_ANSWER (SPEAK/CONNECT/DRAG_DROP/...)" : null) });
    log(`  [PRESCAN] "${cand.itemName}" (unit=${cand.unitName}): ${ok ? "PASS (text-choice, an toàn cho dispatcher chung)" : `loại (${attempts[attempts.length - 1].reason})`}`);
    if (ok) picked.push(cand);
  }
  if (picked.length < count) {
    throw new Error(
      `BLOCKED_NOT_ENOUGH_TEXT_CHOICE_CANDIDATES: chỉ xác nhận được ${picked.length}/${count} candidate text-choice-compatible sau ${attempts.length} lần thử.\n${JSON.stringify(attempts, null, 2)}`,
    );
  }
  return picked;
}

async function assignOne(label, candidate, dueDateDdMmYyyy, primaryClass) {
  log(
    `[ASSIGN:${label}] "${candidate.itemName}" (unit=${candidate.unitName}, lesson=${candidate.lessonName}, webGvLessonTab=${candidate.lessonTag}) - hạn nộp ${dueDateDdMmYyyy}...`,
  );
  const result = await assignHomeworkFlow({
    primaryClass,
    dueDate: dueDateDdMmYyyy,
    unitName: candidate.unitName,
    lessonName: candidate.lessonTag,
    homeworkItemId: candidate.itemId,
    homeworkItemName: candidate.itemName,
    headless: true,
    debugDump: true,
  });
  if (result.status !== "PASS") {
    throw new Error(
      `assignHomeworkFlow("${label}", "${candidate.itemName}") FAIL: ${result.error}\nsteps=${JSON.stringify(result.steps, null, 2)}`,
    );
  }
  log(`  [PASS] Đã giao "${candidate.itemName}" (${label}).`);
  return result;
}

/** ===================== [3] Resolve room_id cho 1 Homework MỚI giao, CHƯA ai làm =====================
 * KHÁC `resolveUniqueRoomIdForCandidate()` của pro_lamlai_target_score.mjs (lọc theo
 * `resolveMyStatus(...) === "COMPLETED"` - dùng cho case "làm lại" 1 bài ĐÃ hoàn thành): ở đây bài
 * VỪA giao qua Web GV, CHƯA ai làm ("attempts" = null - xem model/homeworkModel.js#normalizeHomework).
 * Identity ổn định nhất có sẵn: `lessonItem.id` PHẢI khớp ĐÚNG `candidate.itemId` vừa dùng để giao bài
 * (không suy đoán theo title - nhiều lesson-item có thể dùng chung 1 tên mẫu, xem comment
 * flattenNonSpeak() ở trên) + hạn nộp (DD/MM giờ VN, `isoToDueDateDM()`) PHẢI khớp ĐÚNG hạn vừa giao -
 * 2 điều kiện CẦN cùng lúc để không đoán nhầm 1 room CŨ trùng lesson-item (vd chạy lại case nhiều
 * lần/ngày, cùng item có thể được giao lại). title chỉ dùng làm tie-break CUỐI khi vẫn còn >1 match
 * (không tự chọn matches[0]). */
async function resolveFreshRoom(candidate, dueDateDdMmYyyy, allHomeworks) {
  const wantDm = toDM(dueDateDdMmYyyy);
  let matches = allHomeworks.filter(
    (h) => h.lessonItem?.id === candidate.itemId && isoToDueDateDM(h.deadline.endTime) === wantDm,
  );
  if (matches.length > 1) {
    const scoped = matches.filter((h) => h.title === candidate.itemName);
    if (scoped.length > 0) matches = scoped;
  }
  return { matches, unique: matches.length === 1, room: matches.length === 1 ? matches[0] : null };
}

/** ===================== SCORE TARGET RANGE (env, mặc định khoảng MỞ (0,10)) ===================== */
function resolveTargetRange() {
  const rawMin = process.env.TARGET_SCORE_MIN;
  const rawMax = process.env.TARGET_SCORE_MAX;
  if (rawMin === undefined && rawMax === undefined) {
    // Mặc định KHÔNG set env nào - random trong khoảng MỞ (0,10), loại trừ CẢ 2 đầu mút - KHÔNG
    // hardcode 1 giá trị cụ thể nào (đúng rule feedback_never_hardcode_score_or_exercise).
    return { min: 0, max: 10, exclusive: true, source: "DEFAULT_OPEN_INTERVAL_0_10" };
  }
  const min = rawMin !== undefined ? Number(rawMin) : 0;
  const max = rawMax !== undefined ? Number(rawMax) : 10;
  if (Number.isNaN(min) || Number.isNaN(max)) {
    throw new Error(`TARGET_SCORE_MIN/MAX không hợp lệ (min="${rawMin}", max="${rawMax}") - phải là số.`);
  }
  if (min > max) throw new Error(`TARGET_SCORE_MIN(${min}) > TARGET_SCORE_MAX(${max}) - không hợp lệ.`);
  if (min < 0 || max > 10) throw new Error(`TARGET_SCORE_MIN/MAX phải nằm trong [0, 10] (min=${min}, max=${max}).`);
  return { min, max, exclusive: false, source: "ENV" };
}

function scoreInRange(score, range) {
  if (score === null || Number.isNaN(score)) return false;
  return range.exclusive ? score > range.min && score < range.max : score >= range.min && score <= range.max;
}

/** Tính scoring plan cho 1 candidate trong PHẠM VI [range.min, range.max] cụ thể - TÁI SỬ DỤNG
 * NGUYÊN VẸN `buildScoringPlan()`/`achievableScoresList()`/`scaledSumForScore()` đã có (DP subset-sum
 * thật trên `metadata.point`, KHÔNG viết lại) - hàm này CHỈ thêm phần "lọc điểm khả thi theo khoảng +
 * chọn 1 điểm trong khoảng đó (random nếu min<max, chính xác min nếu min===max)" mà
 * `resolveScoringPlanForCandidate()` gốc (mode target|random KHÔNG có khái niệm "khoảng") chưa hỗ trợ. */
function computeScoringPlanInRange(questions, range) {
  const plan = buildScoringPlan(questions);
  if (!plan) {
    return { achievable: false, reason: "Tổng điểm (metadata.point) của toàn bộ scored items = 0 - không tính được scoring." };
  }
  const achievableScores = achievableScoresList(plan.scaledTotal, plan.achievableScaledSums);
  const totalPointsRaw = plan.scaledTotal / 1000;
  const inRange = achievableScores.filter((s) => scoreInRange(s, range));
  if (inRange.length === 0) {
    return {
      achievable: false,
      reason:
        `Không có điểm khả thi thật nào trong khoảng [${range.min}, ${range.max}]` +
        `${range.exclusive ? " (MỞ, loại 2 đầu mút)" : ""} - điểm khả thi thật của bài này: ${achievableScores.join(", ") || "(rỗng)"}.`,
      achievableScores,
      totalScoredItems: questions.length,
      totalPointsRaw,
    };
  }
  const targetScore = range.min === range.max ? range.min : inRange[Math.floor(Math.random() * inRange.length)];
  const scaledSum = scaledSumForScore(plan.scaledTotal, targetScore);
  if (scaledSum === null) {
    return {
      achievable: false,
      reason: `Target ${targetScore} không rơi đúng vào mốc điểm nguyên nào theo scale nội bộ (bất thường - đã lọc từ achievableScores).`,
      achievableScores,
      totalScoredItems: questions.length,
      totalPointsRaw,
    };
  }
  const correctIndices = plan.correctIndicesForScaledSum(scaledSum);
  if (!correctIndices) {
    return {
      achievable: false,
      reason: `Target ${targetScore} không truy vết được tập item cần đúng (bất thường).`,
      achievableScores,
      totalScoredItems: questions.length,
      totalPointsRaw,
    };
  }
  return { achievable: true, targetScore, correctIndices, achievableScores, totalScoredItems: questions.length, totalPointsRaw };
}

/** Map câu hỏi -> wantCorrect - COPY NGUYÊN logic `buildWeightedWantCorrectPlan()` của
 * pro_lamlai_target_score.mjs (không import lại vì chữ ký hoàn toàn giống, giữ ở đây cho rõ ràng cạnh
 * `computeScoringPlanInRange()` - cùng 1 file dễ đọc hơn). KHÔNG đổi thuật toán. */
function buildWantCorrectMap(questions, correctIndices) {
  const map = new Map();
  questions.forEach((q, i) => {
    const pointRaw = Number(q.metadata?.point) || 0;
    map.set(q.id, pointRaw <= 0 || correctIndices.has(i));
  });
  return map;
}

/** ===================== [4] BRIDGE-DRIVEN DEVICE FLOW ===================== */

/** Đọc bounds "[x1,y1][x2,y2]" -> {x1,y1,x2,y2} - COPY tinh thần parseBounds() của
 * pro_lamlai_target_score.mjs (không import vì hàm đó không export, chỉ 1 dòng regex, không đáng
 * kể để đổi API công khai của file kia). */
function parseBoundsXY(boundsStr) {
  const m = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(boundsStr ?? "");
  if (!m) return null;
  const [x1, y1] = m.slice(1, 3).map(Number);
  return { x1, y1 };
}

/** ===================== PROFILE DETECTION (MỚI 2026-09-07, không hardcode profile) =====================
 * KHÔNG có resource-id nào cho tên profile (đã xác nhận thật qua `maestro hierarchy` live 2026-09-07 -
 * plain TextView, resource-id rỗng) - dùng VỊ TRÍ: xác nhận thật trên màn "Bài tập" của app này, header
 * LUÔN đúng 2 hàng cố định: hàng 1 (y nhỏ nhất, > 0 để loại status bar giờ/pin) = tên profile + badge
 * "Pro"/"Free" ngay bên phải; hàng 2 = tên lớp + nút "Chuyển profile". Tên profile luôn là text DUY
 * NHẤT ở hàng 1 sau khi loại "Pro"/"Free". Nếu không xác định được DUY NHẤT 1 text - BLOCKED rõ ràng,
 * KHÔNG đoán. */
function detectActiveProfileNameFromTree(tree) {
  const candidates = [];
  (function walk(node) {
    const a = node?.attributes ?? {};
    const text = (a.text ?? "").trim();
    const bounds = parseBoundsXY(a.bounds);
    if (text && bounds && bounds.y1 > 0) candidates.push({ text, ...bounds });
    for (const c of node?.children ?? []) walk(c);
  })(tree);

  const KNOWN_BADGES = new Set(["Pro", "Free"]);
  const headerRow = candidates.filter((c) => c.y1 < 300 && !KNOWN_BADGES.has(c.text) && c.text !== "Chuyển profile");
  if (headerRow.length === 0) {
    throw new Error(`BLOCKED_PROFILE_DETECT: không thấy text nào ở vùng header (y<300) để suy ra tên profile.`);
  }
  const minY = Math.min(...headerRow.map((c) => c.y1));
  const topRow = headerRow.filter((c) => c.y1 === minY);
  if (topRow.length !== 1) {
    throw new Error(
      `BLOCKED_PROFILE_DETECT: có ${topRow.length} text cùng nằm ở hàng trên cùng header (y=${minY}) - không xác định được DUY NHẤT tên profile: ${JSON.stringify(topRow)}`,
    );
  }
  return topRow[0].text;
}

/** Đăng nhập (CHỈ khi app THẬT SỰ đang ở màn đăng nhập - chưa có phiên nào active, dùng phone/otp
 * làm fallback) rồi mở tab "Bài tập" và ĐỌC (KHÔNG switch) tên profile đang active - CÙNG chuỗi
 * bước/testID/timeout đã verify trong `ensureProProfileActive()` (pro_lamlai_target_score.mjs)/
 * `flows/app/helpers/ensure-profile-active.yaml`, chỉ khác Ở CHỖ KHÔNG có nhánh "chuyển sang đúng
 * profileName" - case này giờ CHẤP NHẬN BẤT KỲ profile nào đang active (yêu cầu rõ của user
 * 2026-09-07: "không hardcode profile", "dùng đúng profile hiện tại đang đăng nhập"). */
async function loginAndDetectActiveProfile(bridge, { phone, otp }) {
  const launch = await bridge.runSteps([
    { launchApp: { permissions: { all: "allow" } } },
    { extendedWaitUntil: { visible: { text: ".*(Đăng nhập|Chào mừng bạn đến với ParrotEdu!|Vui học|Bài tập|Báo cáo).*" }, timeout: 30000 } },
  ]);
  if (!launch.success) throw new Error(`Không mở được app: ${launch.error}`);

  const needsLogin = collectTexts(await bridge.hierarchy()).some((t) =>
    /(Chào mừng bạn đến với ParrotEdu!|Nhập số điện thoại)/.test(t),
  );
  if (needsLogin) {
    if (!phone || !otp) {
      throw new Error(
        `BLOCKED_NO_ACTIVE_SESSION: app đang ở màn đăng nhập - chưa có phiên nào active, nên KHÔNG có "profile hiện tại" để dùng. ` +
          `Hãy đăng nhập thủ công trên thiết bị trước khi chạy case này, hoặc truyền PHONE/OTP nếu muốn tự đăng nhập vào 1 tài khoản cụ thể.`,
      );
    }
    log(`  [LOGIN] Chưa có phiên active - tự đăng nhập bằng PHONE=${phone}...`);
    const loginSteps = await bridge.runSteps([
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
    ]);
    if (!loginSteps.success) throw new Error(`Đăng nhập thất bại: ${loginSteps.error}`);
  }

  const nav = await bridge.runSteps([
    { extendedWaitUntil: { visible: ".*(Vui học|Bài tập|Báo cáo).*", timeout: 30000 } },
    { tapOn: { text: "Bài tập" } },
    {
      extendedWaitUntil: {
        visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao|Bạn không có bài tập nào đang chờ|2 tuần gần nhất|1 tháng gần nhất).*" },
        timeout: 30000,
      },
    },
  ]);
  if (!nav.success) throw new Error(`Không mở được tab "Bài tập": ${nav.error}`);

  const profileName = detectActiveProfileNameFromTree(await bridge.hierarchy());
  return { profileName, wasLoggedOut: needsLogin };
}

/** Tra ngược lớp THẬT (năm học hiện tại) của 1 học sinh theo `full_name` khớp đúng tên profile đang
 * active trên app - quét toàn bộ lớp của GV (`listClassesForCurrentYear()`) + roster từng lớp
 * (`fetchClassStudents()`, cả 2 MỚI export 2026-09-07) - KHÔNG đoán/không tự chọn match đầu tiên khi
 * có ≥2 kết quả (vd trùng tên ở 2 lớp khác nhau) - BLOCKED rõ ràng, để user tự phân xử. */
async function resolveClassForProfileName(profileName) {
  const classes = await listClassesForCurrentYear();
  const matches = [];
  for (const c of classes) {
    const students = await fetchClassStudents(c.id);
    const hit = (students ?? []).find((s) => s.student?.full_name === profileName);
    if (hit) matches.push({ className: c.name, classId: c.id, studentId: hit.student_id });
  }
  if (matches.length === 0) {
    throw new Error(
      `BLOCKED_CLASS_RESOLVE: không tìm thấy học sinh nào tên "${profileName}" trong ${classes.length} lớp của năm học hiện tại (${classes.map((c) => c.name).join(", ")}).`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `BLOCKED_CLASS_RESOLVE: học sinh tên "${profileName}" xuất hiện ở ${matches.length} lớp khác nhau - không tự chọn: ${JSON.stringify(matches)}`,
    );
  }
  return matches[0];
}

/** Escape ký tự regex đặc biệt trong title trước khi ghép vào selector Maestro - CÙNG lý do/fix đã
 * ghi trong flows/app/helpers/open-exercise.yaml (title có dấu ngoặc, vd "True (T) or False (F).",
 * khiến regex khớp sai vị trí nếu không escape). */
function escapeForMaestroRegex(text) {
  return String(text).replace(/[.*+?^()|[\]\\]/g, (m) => `\\${m}`);
}

/** Relaunch app + mở lại tab "Bài tập" - BẮT BUỘC gọi lại NGAY TRƯỚC khi mở "current" từ danh sách
 * (MỚI 2026-09-07, fix bug thật gặp khi live-test luồng auto-detect profile): `loginAndDetectActiveProfile()`
 * ở bước [0] mở tab "Bài tập" TRƯỚC KHI 3 bài được giao qua Web GV ở bước [2] (cần xong bước [0] mới
 * biết PROFILE_NAME -> mới tra ra ASSIGN_PRIMARY_CLASS -> mới giao bài được) - danh sách lúc đó là
 * SNAPSHOT CŨ, không tự fetch lại dù bài mới đã được giao xong ở server (xác nhận thật: "Không cuộn
 * tới được ... : No visible element found" cho bài VỪA giao). Bản gốc (shell-out `maestro test` sau
 * khi giao xong) không gặp lỗi này vì MỖI LẦN chạy là 1 launchApp hoàn toàn mới, luôn fetch lại từ
 * đầu - relaunch lại ở đây để khôi phục ĐÚNG tính chất đó, KHÔNG đổi gì khác. */
async function relaunchAndOpenHomeworkTab(bridge) {
  const relaunch = await bridge.runSteps([
    { launchApp: { permissions: { all: "allow" } } },
    { extendedWaitUntil: { visible: ".*(Vui học|Bài tập|Báo cáo).*", timeout: 30000 } },
    { tapOn: { text: "Bài tập" } },
    {
      extendedWaitUntil: {
        visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao|Bạn không có bài tập nào đang chờ|2 tuần gần nhất|1 tháng gần nhất).*" },
        timeout: 30000,
      },
    },
  ]);
  if (!relaunch.success) throw new Error(`Không relaunch/mở lại tab "Bài tập" sau khi giao bài: ${relaunch.error}`);
}

/** MIRROR của `flows/app/helpers/open-exercise.yaml` (nhánh DEVICE_MODE=true) - mở ĐÚNG 1 bài từ
 * danh sách "Bài tập" theo title + hạn nộp (KHÔNG tap theo index - xem lý do trong file YAML gốc:
 * danh sách phần lớn là bài "Làm lại", tap theo index dễ trúng nhầm bài SPEAK). CÙNG selector/
 * "below" lồng 2 cấp/timeout đã verify trong file đó - không bịa cơ chế mới. */
async function openCurrentFromList(bridge, { exerciseName, dueDateDm }) {
  // Reset trạng thái còn sót từ lần chạy trước (best-effort, CÙNG 3 bước DEVICE_MODE=true đầu file
  // open-exercise.yaml) - vô hại nếu không có gì để đóng.
  await bridge.runSteps([
    { tapOn: { id: "exercise_close_button", optional: true } },
    { tapOn: { id: "exercise_show_answer_next_button", optional: true } },
    { tapOn: { text: ".*(Hoàn thành|Đóng).*", optional: true } },
  ]);

  const titleRegex = `.*${escapeForMaestroRegex(exerciseName)}.*`;
  const dueRegex = `.*Hạn nộp ${dueDateDm}.*`;

  const scrollResult = await bridge.runSteps([
    {
      scrollUntilVisible: {
        element: { text: titleRegex },
        direction: "DOWN",
        timeout: 150000,
        speed: 70,
        waitToSettleTimeoutMs: 500,
      },
    },
  ]);
  if (!scrollResult.success) {
    throw new Error(`Không cuộn tới được "${exerciseName}" trong danh sách "Bài tập": ${scrollResult.error}`);
  }

  const verifyResult = await bridge.runSteps([{ assertVisible: { text: dueRegex, below: { text: titleRegex } } }]);
  if (!verifyResult.success) {
    throw new Error(`Không xác nhận được "Hạn nộp ${dueDateDm}" ngay dưới "${exerciseName}" - có thể đã cuộn nhầm card khác cùng title: ${verifyResult.error}`);
  }

  const tapResult = await bridge.runSteps([
    { tapOn: { text: ".*(Làm bài|Làm lại|Tiếp tục).*", below: { text: dueRegex, below: { text: titleRegex } } } },
  ]);
  if (!tapResult.success) {
    throw new Error(`Không bấm được nút mở bài cho "${exerciseName}": ${tapResult.error}`);
  }

  const readyResult = await bridge.runSteps([{ extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 40000 } }]);
  if (!readyResult.success) {
    throw new Error(`Không vào được màn Doing sau khi mở "${exerciseName}": ${readyResult.error}`);
  }
}

/** MIRROR `answerOneQuestion()` của pro_lamlai_target_score.mjs - CÙNG lời gọi
 * `exam.answerCurrentQuestionOneShot()`, chỉ tham số hoá thêm `resultLabel` (bản gốc hardcode tên
 * screenshot riêng của chính nó "pro_lamlai_target_score_result_screen" - không phù hợp tái dùng
 * thẳng cho 3 bài current/near/far của case này, nên viết bản mirror thay vì import cả field không
 * cần export theo yêu cầu). KHÔNG đổi thuật toán answerCurrentQuestionOneShot()/decideAnswerAction(). */
async function answerOneQuestionForRun(exam, matched, isLast, wantCorrectMap, resultLabel) {
  const wantCorrect = wantCorrectMap.get(matched.id);
  const outcome = await exam.answerCurrentQuestionOneShot(matched, {
    wantCorrect,
    resultLabel: isLast ? resultLabel : null,
    snapshot: matched._snapshot ?? null,
  });
  if (!outcome.supported) {
    throw new Error(`Handler không hỗ trợ câu "${matched.question}" (id=${matched.id}): ${outcome.reason}`);
  }
  return { wantCorrect, outcome };
}

/** Vòng lặp trả lời TOÀN BỘ câu của 1 bài - CÙNG pattern Phase E của pro_lamlai_target_score.mjs
 * (findMatchingQuestion() + answerCurrentQuestionOneShot(), carry `finalTree` giữa các câu để tránh
 * gọi hierarchy() thừa) - viết lại vòng lặp (không import main() nguyên khối vì file kia không export
 * nó ở dạng tái sử dụng được cho 3 lượt độc lập), nhưng KHÔNG đổi bất kỳ bước con nào bên trong. */
async function answerAllQuestions(bridge, exam, questions, wantCorrectMap, label) {
  const answeredIds = new Set();
  const answerLog = [];
  let carryTree = null;
  let lastOutcome = null;
  while (answeredIds.size < questions.length) {
    const questionIndex = answeredIds.size + 1;
    const pool = questions.filter((q) => !answeredIds.has(q.id));
    const matchResult = await findMatchingQuestion(bridge, pool, carryTree, questionIndex);
    if (matchResult.status !== "MATCHED") {
      const kind = matchResult.status === "AMBIGUOUS" ? "AMBIGUOUS_MATCH" : "NO_MATCH";
      throw new Error(
        `[${label}] ${kind} ở câu ${questionIndex}/${questions.length}: ${matchResult.diagnostic?.diagnosticReason ?? "(không có diagnosticReason)"}`,
      );
    }
    const matched = matchResult.question;
    const isLast = answeredIds.size === questions.length - 1;
    const { wantCorrect, outcome } = await answerOneQuestionForRun(
      exam,
      matched,
      isLast,
      wantCorrectMap,
      `HW-29-result-after-${label}`,
    );
    carryTree = outcome.finalTree ?? null;
    lastOutcome = outcome;
    answeredIds.add(matched.id);
    answerLog.push({ id: matched.id, question: matched.question, wantCorrect, isTargetCorrect: outcome.isTargetCorrect });
    log(`  [${label}] Câu ${answeredIds.size}/${questions.length}: nhắm ${wantCorrect ? "ĐÚNG" : "SAI"} (isTargetCorrect=${outcome.isTargetCorrect})`);
  }
  return { answerLog, lastOutcome };
}

/** Assert CTA đúng NHÃN mong đợi + đúng KHÔNG xuất hiện nhãn bị cấm - CÙNG 2 assertVisible/
 * assertNotVisible của YAML gốc, đọc trên `texts` đã có sẵn (finalTree của câu cuối) thay vì gọi thêm
 * 1 lượt hierarchy() mới. */
function assertCtaLabel(texts, expectedLabel, forbiddenLabel, context) {
  const hasExpected = texts.some((t) => t.includes(expectedLabel));
  const hasForbidden = texts.some((t) => t.includes(forbiddenLabel));
  if (!hasExpected) {
    throw new Error(`[CTA_ASSERT_FAIL][${context}] KHÔNG thấy CTA "${expectedLabel}" trên màn Kết quả. Texts=${JSON.stringify(texts)}`);
  }
  if (hasForbidden) {
    throw new Error(`[CTA_ASSERT_FAIL][${context}] CTA "${forbiddenLabel}" KHÔNG được xuất hiện cùng "${expectedLabel}". Texts=${JSON.stringify(texts)}`);
  }
}

/** Verify điểm THẬT đọc từ màn Kết quả khớp target đã tính - FAIL TO nếu sai lệch, kèm đầy đủ
 * target/actual/breakdown/answer-key/achievableScores (yêu cầu rõ #7 của user - KHÔNG được làm mềm/
 * bỏ qua/retry-tới-khi-khớp/sửa lại target sau khi đã biết actual). */
function verifyScoreOrThrow({ label, targetScore, range, result, questions, answerLog, achievableScores, requiredCorrectCount }) {
  const actualScore = result.score === null ? null : Number(result.score);
  const exactMatch = actualScore !== null && !Number.isNaN(actualScore) && Math.abs(actualScore - targetScore) < 1e-6;
  const withinRange = scoreInRange(actualScore, range);
  const denominatorMatches = result.totalCount === null || result.totalCount === questions.length;
  const passed = exactMatch && withinRange;
  if (!passed) {
    const breakdown = answerLog
      .map((a) => `    - id=${a.id} wantCorrect=${a.wantCorrect} isTargetCorrect=${a.isTargetCorrect} question="${a.question}"`)
      .join("\n");
    throw new Error(
      `[SCORE_VERIFY_FAIL][${label}]\n` +
        `  target_score=${targetScore} target_range=[${range.min}, ${range.max}]${range.exclusive ? " (mở, loại 2 đầu mút)" : ""}\n` +
        `  actual_score=${actualScore} actual_correct=${result.correct}\n` +
        `  exact_match=${exactMatch} within_range=${withinRange} denominator_matches_cms=${denominatorMatches} (cms_total=${questions.length}, ui_total=${result.totalCount})\n` +
        `  achievable_scores_that (bài này thật sự đạt được)=${achievableScores.join(", ")}\n` +
        `  required_correct_count=${requiredCorrectCount}/${questions.length}\n` +
        `  answer_key_breakdown (đáp án đúng/sai đã CHỦ ĐÍCH nhắm cho từng câu):\n${breakdown}`,
    );
  }
  return { actualScore, correctCount: result.correctCount, totalCount: result.totalCount, denominatorMatches };
}

async function main() {
  requireTeacherPortalConfig();
  if (!APP_ID) throw new Error("Thiếu APP_ID - kiểm tra .env.");

  log(`[0/5] Mở app + đọc (KHÔNG switch) profile ĐANG active trên thiết bị...`);
  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);
  const perExercise = [];
  let overallError = null;
  const overallStart = Date.now();
  let PROFILE_NAME = null;
  let ASSIGN_PRIMARY_CLASS = null;
  // Khai báo Ở NGOÀI try (thay vì const bên trong như bản trước refactor 2026-09-07) - report cuối
  // hàm (sau finally) cần đọc lại các giá trị này ngay cả khi có lỗi giữa chừng (vd BLOCKED ở [1b]
  // trước khi current/near/far được gán) - giữ null cho tới khi thật sự gán được.
  let current = null;
  let near = null;
  let far = null;
  let dueCurrent = null;
  let dueNear = null;
  let dueFar = null;
  let range = null;
  try {
    const { profileName } = await loginAndDetectActiveProfile(bridge, { phone: PHONE, otp: OTP });
    PROFILE_NAME = profileName;
    log(`  [PROFILE] Đang active trên thiết bị: "${PROFILE_NAME}"`);

    log(`[0b/5] Tra cứu lớp thật của "${PROFILE_NAME}" qua API GV (năm học hiện tại, không hardcode)...`);
    const classInfo = await resolveClassForProfileName(PROFILE_NAME);
    ASSIGN_PRIMARY_CLASS = classInfo.className;
    log(`  [CLASS] "${PROFILE_NAME}" thuộc lớp "${ASSIGN_PRIMARY_CLASS}" (class_id=${classInfo.classId}).`);

    log(`[1/5] Quét cây assignment eligible thật của lớp "${ASSIGN_PRIMARY_CLASS}" (API, không qua DOM/random mù)...`);
    const { eligibleTree, stats } = await fetchEligibleAssignmentTree(ASSIGN_PRIMARY_CLASS);
    log(`  [DISCOVERY] totalItems=${stats.totalItems} | itemsWithExam=${stats.itemsWithExam} | itemsWithoutExam=${stats.itemsWithoutExam}`);
    const flat = flattenNonSpeak(eligibleTree);
    log(`  [DISCOVERY] non-SPEAK eligible candidates (có lessonTag): ${flat.length}`);

    log(`[1b/5] Xác nhận nội dung CMS thật (loại SPEAK/CONNECT/DRAG_DROP còn sót) cho 3 candidate...`);
    [current, near, far] = await pickVerifiedTextChoiceCandidates(flat, 3);
    log(`  [PICKED] current="${current.itemName}" | near="${near.itemName}" | far="${far.itemName}"`);

    dueCurrent = addDaysDdMmYyyy(2);
    dueNear = addDaysDdMmYyyy(6);
    dueFar = addDaysDdMmYyyy(20);

    log(`[2/5] Giao 3 bài mới qua Web GV (lớp "${ASSIGN_PRIMARY_CLASS}", hạn nộp cách nhau rõ rệt: ${dueCurrent} / ${dueNear} / ${dueFar})...`);
    await assignOne("current", current, dueCurrent, ASSIGN_PRIMARY_CLASS);
    await assignOne("near", near, dueNear, ASSIGN_PRIMARY_CLASS);
    await assignOne("far", far, dueFar, ASSIGN_PRIMARY_CLASS);

    log(`[3/5] Resolve room_id + CMS answer key + scoring plan cho cả 3 bài (TRƯỚC khi đụng thiết bị)...`);
    const sessionRefresh = refreshExamSessionFromEnvCookie();
    if (!sessionRefresh.refreshed) {
      throw new Error(`Không refresh được exam_session.json từ EXAM_COOKIE: ${sessionRefresh.reason}`);
    }
    range = resolveTargetRange();
    log(`  [TARGET_RANGE] source=${range.source} min=${range.min} max=${range.max} exclusive=${range.exclusive}`);

    const allHomeworks = await getHomeworks({ period: "MONTH" });
    const exercises = [];
    for (const [label, candidate, dueDate] of [
      ["current", current, dueCurrent],
      ["near", near, dueNear],
      ["far", far, dueFar],
    ]) {
      const { matches, unique, room } = await resolveFreshRoom(candidate, dueDate, allHomeworks);
      if (!unique) {
        throw new Error(
          `BLOCKED_ROOM_RESOLVE[${label}]: room_id KHÔNG unique cho "${candidate.itemName}" (itemId=${candidate.itemId}, hạn nộp=${toDM(dueDate)}) - ${matches.length} match. ` +
            `KHÔNG đoán matches[0]. matches=${JSON.stringify(matches.map((m) => ({ id: m.id, title: m.title, dueDM: isoToDueDateDM(m.deadline.endTime) })))}`,
        );
      }
      log(`  [ROOM] ${label}: room_id=${room.id} title="${room.title}"`);

      const resolved = await resolveHomeworkExamQuestionsForRoomIdCachedWithRetry(room.id);
      if (resolved.status !== "RESOLVED") {
        throw new Error(`BLOCKED_CMS_RESOLVE[${label}]: resolveHomeworkExamQuestionsForRoomId status=${resolved.status}: ${resolved.reason}`);
      }
      if (!isTextChoiceCompatible(resolved.questions)) {
        throw new Error(
          `BLOCKED_CMS_RESOLVE[${label}]: bộ câu hỏi CMS thật (room_id=${room.id}) KHÔNG toàn bộ text-choice-compatible - không thể tính wantCorrectMap an toàn (dù prescan [1b] đã PASS - có thể "mã đề" khác lúc giao thật, xem GIỚI HẠN teacherMaterialsExamResolver.js).`,
        );
      }

      const scoringPlan = computeScoringPlanInRange(resolved.questions, range);
      if (!scoringPlan.achievable) {
        throw new Error(`BLOCKED_SCORING_PLAN[${label}] ("${candidate.itemName}", room_id=${room.id}): ${scoringPlan.reason}`);
      }
      log(
        `  [SCORING_PLAN] ${label}: totalScoredItems=${scoringPlan.totalScoredItems} totalPointsRaw=${scoringPlan.totalPointsRaw} ` +
          `targetScore=${scoringPlan.targetScore} (achievable=[${scoringPlan.achievableScores.join(", ")}]) requiredCorrect=${scoringPlan.correctIndices.size}/${scoringPlan.totalScoredItems}`,
      );
      const wantCorrectMap = buildWantCorrectMap(resolved.questions, scoringPlan.correctIndices);
      exercises.push({
        label,
        candidate,
        dueDate,
        dueDateDm: toDM(dueDate),
        room,
        questions: resolved.questions,
        scoringPlan,
        wantCorrectMap,
      });
    }

    log(`[4/5] Relaunch app + mở lại tab "Bài tập" (làm mới danh sách sau khi vừa giao 3 bài ở bước [2]) rồi mở + trả lời + verify điểm + verify CTA cho cả 3 bài...`);
    await relaunchAndOpenHomeworkTab(bridge);

    // ===== current: mở TỪ DANH SÁCH =====
    {
      const ex = exercises[0];
      const startedAt = Date.now();
      log(`  [current] Mở "${ex.candidate.itemName}" từ danh sách (hạn nộp ${ex.dueDateDm})...`);
      await openCurrentFromList(bridge, { exerciseName: ex.candidate.itemName, dueDateDm: ex.dueDateDm });
      await exam.dismissAiPopupIfPresent();
      log(`  [current] Trả lời ${ex.questions.length} câu (target=${ex.scoringPlan.targetScore})...`);
      const { answerLog, lastOutcome } = await answerAllQuestions(bridge, exam, ex.questions, ex.wantCorrectMap, "current");
      if (!lastOutcome?.finalTree || !exam.isResultScreen(lastOutcome.finalTree)) {
        throw new Error(`[current] Không thấy màn Kết quả sau khi trả lời hết câu.`);
      }
      const result = exam.readResult(lastOutcome.finalTree);
      const scoreVerify = verifyScoreOrThrow({
        label: "current",
        targetScore: ex.scoringPlan.targetScore,
        range,
        result,
        questions: ex.questions,
        answerLog,
        achievableScores: ex.scoringPlan.achievableScores,
        requiredCorrectCount: ex.scoringPlan.correctIndices.size,
      });
      log(`  [current] ĐIỂM THẬT=${scoreVerify.actualScore} (target=${ex.scoringPlan.targetScore}) - PASS.`);
      const texts = collectTexts(lastOutcome.finalTree);
      assertCtaLabel(texts, "Tiếp theo", "Hoàn thành", "current");
      const tapResult = await bridge.runSteps([{ tapOn: { text: ".*(Tiếp theo).*" } }]);
      if (!tapResult.success) throw new Error(`[current] Bấm CTA "Tiếp theo" thất bại: ${tapResult.error}`);
      const landedResult = await bridge.runSteps([{ extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 30000 } }]);
      if (!landedResult.success) throw new Error(`[current] Sau khi bấm "Tiếp theo" không vào được màn Doing tiếp theo: ${landedResult.error}`);
      const endedAt = Date.now();
      perExercise.push({
        label: "current",
        title: ex.candidate.itemName,
        roomId: ex.room.id,
        dueDate: ex.dueDate,
        targetScore: ex.scoringPlan.targetScore,
        achievableScores: ex.scoringPlan.achievableScores,
        requiredCorrectCount: ex.scoringPlan.correctIndices.size,
        totalScoredItems: ex.scoringPlan.totalScoredItems,
        actualScore: scoreVerify.actualScore,
        realCorrectCount: scoreVerify.correctCount,
        realTotalCount: scoreVerify.totalCount,
        denominatorMatches: scoreVerify.denominatorMatches,
        scorePassed: true,
        ctaExpected: "Tiếp theo",
        ctaVerified: true,
        answerLog,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        durationMs: endedAt - startedAt,
      });
    }

    // ===== near: KHÔNG mở lại từ danh sách - "Tiếp theo" đã tự đưa vào màn Doing =====
    {
      const ex = exercises[1];
      const startedAt = Date.now();
      await exam.dismissAiPopupIfPresent();
      log(`  [near] Trả lời ${ex.questions.length} câu (target=${ex.scoringPlan.targetScore}) - đang đứng sẵn ở màn Doing...`);
      const { answerLog, lastOutcome } = await answerAllQuestions(bridge, exam, ex.questions, ex.wantCorrectMap, "near");
      if (!lastOutcome?.finalTree || !exam.isResultScreen(lastOutcome.finalTree)) {
        throw new Error(`[near] Không thấy màn Kết quả sau khi trả lời hết câu.`);
      }
      const result = exam.readResult(lastOutcome.finalTree);
      const scoreVerify = verifyScoreOrThrow({
        label: "near",
        targetScore: ex.scoringPlan.targetScore,
        range,
        result,
        questions: ex.questions,
        answerLog,
        achievableScores: ex.scoringPlan.achievableScores,
        requiredCorrectCount: ex.scoringPlan.correctIndices.size,
      });
      log(`  [near] ĐIỂM THẬT=${scoreVerify.actualScore} (target=${ex.scoringPlan.targetScore}) - PASS.`);
      const texts = collectTexts(lastOutcome.finalTree);
      assertCtaLabel(texts, "Tiếp theo", "Hoàn thành", "near");
      const tapResult = await bridge.runSteps([{ tapOn: { text: ".*(Tiếp theo).*" } }]);
      if (!tapResult.success) throw new Error(`[near] Bấm CTA "Tiếp theo" thất bại: ${tapResult.error}`);
      const landedResult = await bridge.runSteps([{ extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 30000 } }]);
      if (!landedResult.success) throw new Error(`[near] Sau khi bấm "Tiếp theo" không vào được màn Doing tiếp theo: ${landedResult.error}`);
      const endedAt = Date.now();
      perExercise.push({
        label: "near",
        title: ex.candidate.itemName,
        roomId: ex.room.id,
        dueDate: ex.dueDate,
        targetScore: ex.scoringPlan.targetScore,
        achievableScores: ex.scoringPlan.achievableScores,
        requiredCorrectCount: ex.scoringPlan.correctIndices.size,
        totalScoredItems: ex.scoringPlan.totalScoredItems,
        actualScore: scoreVerify.actualScore,
        realCorrectCount: scoreVerify.correctCount,
        realTotalCount: scoreVerify.totalCount,
        denominatorMatches: scoreVerify.denominatorMatches,
        scorePassed: true,
        ctaExpected: "Tiếp theo",
        ctaVerified: true,
        answerLog,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        durationMs: endedAt - startedAt,
      });
    }

    // ===== far: bài CUỐI - CTA phải là "Hoàn thành" =====
    {
      const ex = exercises[2];
      const startedAt = Date.now();
      await exam.dismissAiPopupIfPresent();
      log(`  [far] Trả lời ${ex.questions.length} câu (target=${ex.scoringPlan.targetScore}) - đang đứng sẵn ở màn Doing...`);
      const { answerLog, lastOutcome } = await answerAllQuestions(bridge, exam, ex.questions, ex.wantCorrectMap, "far");
      if (!lastOutcome?.finalTree || !exam.isResultScreen(lastOutcome.finalTree)) {
        throw new Error(`[far] Không thấy màn Kết quả sau khi trả lời hết câu.`);
      }
      const result = exam.readResult(lastOutcome.finalTree);
      const scoreVerify = verifyScoreOrThrow({
        label: "far",
        targetScore: ex.scoringPlan.targetScore,
        range,
        result,
        questions: ex.questions,
        answerLog,
        achievableScores: ex.scoringPlan.achievableScores,
        requiredCorrectCount: ex.scoringPlan.correctIndices.size,
      });
      log(`  [far] ĐIỂM THẬT=${scoreVerify.actualScore} (target=${ex.scoringPlan.targetScore}) - PASS.`);
      const texts = collectTexts(lastOutcome.finalTree);
      assertCtaLabel(texts, "Hoàn thành", "Tiếp theo", "far");
      const tapResult = await bridge.runSteps([{ tapOn: { text: ".*(Hoàn thành).*" } }]);
      if (!tapResult.success) throw new Error(`[far] Bấm CTA "Hoàn thành" thất bại: ${tapResult.error}`);
      const backResult = await bridge.runSteps([{ extendedWaitUntil: { visible: { id: "homework_screen" }, timeout: 30000 } }]);
      if (!backResult.success) throw new Error(`[far] Sau khi bấm "Hoàn thành" không quay lại được homework_screen: ${backResult.error}`);
      const endedAt = Date.now();
      perExercise.push({
        label: "far",
        title: ex.candidate.itemName,
        roomId: ex.room.id,
        dueDate: ex.dueDate,
        targetScore: ex.scoringPlan.targetScore,
        achievableScores: ex.scoringPlan.achievableScores,
        requiredCorrectCount: ex.scoringPlan.correctIndices.size,
        totalScoredItems: ex.scoringPlan.totalScoredItems,
        actualScore: scoreVerify.actualScore,
        realCorrectCount: scoreVerify.correctCount,
        realTotalCount: scoreVerify.totalCount,
        denominatorMatches: scoreVerify.denominatorMatches,
        scorePassed: true,
        ctaExpected: "Hoàn thành",
        ctaVerified: true,
        returnedToList: true,
        answerLog,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        durationMs: endedAt - startedAt,
      });
    }
  } catch (err) {
    overallError = err.message;
  } finally {
    await bridge.stop();
    log("  [MCP] Đã dừng tiến trình `maestro mcp`.");
  }

  const overallEnd = Date.now();
  const status = overallError ? "FAIL" : "PASS";
  const report = {
    status,
    error: overallError,
    assignedClass: ASSIGN_PRIMARY_CLASS,
    candidates: { current, near, far },
    dueDates: { current: dueCurrent, near: dueNear, far: dueFar },
    targetRange: range,
    perExercise,
    totalDurationSeconds: (overallEnd - overallStart) / 1000,
  };
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2), "utf8");

  log(`\n[REPORT PER EXERCISE]`);
  for (const e of perExercise) {
    log(
      `  ${e.label}: "${e.title}" target=${e.targetScore} actual=${e.actualScore} (${e.realCorrectCount}/${e.realTotalCount}) ` +
        `cta=${e.ctaExpected}(OK) duration=${(e.durationMs / 1000).toFixed(1)}s [${e.startedAt} -> ${e.endedAt}]`,
    );
  }
  if (overallError) log(`\n[ROOT_CAUSE]\n${overallError}`);
  log(`\n[OVERALL] ${status}`);
  log(`Report: ${OUTPUT_FILE}`);
  process.exit(status === "PASS" ? 0 : 1);
}

main().catch((err) => {
  console.error("\n[setup-ktra_ket_qua_tiep_theo_hoan_thanh] Dừng lại vì lỗi ngoài dự kiến:\n", err);
  process.exit(2);
});
