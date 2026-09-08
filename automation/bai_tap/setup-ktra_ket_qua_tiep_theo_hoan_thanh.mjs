#!/usr/bin/env node
/**
 * Setup + run cho HW-29 (flows/app/bai_tap/ktra_ket_qua_tiep_theo_hoan_thanh.yaml).
 *
 * KIẾN TRÚC (2026-09-08, sửa theo yêu cầu rõ của user - xem repo memory sau khi task này chạy
 * xong): bản TRƯỚC ĐÂY (2026-09-07) tự GIAO 3 bài MỚI qua Web GV để đảm bảo luôn có đủ đúng 3 bài
 * chưa hoàn thành cho luồng current/near/far. User đã CẤM RÕ việc giao bài mới cho case này VÀ chỉ
 * ra rằng "đúng 3 bài mới" chưa bao giờ là điều kiện THẬT của hành vi sản phẩm đang test (CTA "Tiếp
 * theo" khi còn bài chưa hoàn thành / "Hoàn thành" khi hết) - đó chỉ là cách code cũ tự mô hình hoá.
 *
 * SỬA: KHÔNG giao bài nào cả - quét TOÀN BỘ card "Bài tập" đang hiển thị THẬT trên màn hình của
 * profile ĐANG active (bất kể bao nhiêu), lọc lấy các bài CHƯA hoàn thành dùng được (CTA "Làm bài"/
 * "Tiếp tục"/"Chinh phục" - CẢ 3 đều dùng được, xem project_chinh_phuc_special_cta_bug.md mục
 * "CORRECTED 2026-09-08": "Chinh phục" từng bị nghi là luồng UI khác nhưng đã xác nhận SAI qua
 * hierarchy+probe thật, chỉ là nhãn CTA của "Bài tập nâng cao" - loại DUY NHẤT "Làm lại" = đã xong),
 * rồi chạy đúng chuỗi current -> (Tiếp theo)* -> Hoàn thành
 * với ĐỘ DÀI ĐỘNG (1..N bài, N = số bài thật sự lọc được) - "bài cuối" được xác định bằng CHÍNH CTA
 * thật hiển thị trên màn Kết quả tại mỗi bước, KHÔNG BAO GIỜ bằng 1 hằng số index cố định.
 *
 * TÁI SỬ DỤNG (KHÔNG viết lại scoring engine/CMS pipeline/answer engine đã có):
 *   - CMS/scoring engine: `refreshExamSessionFromEnvCookie`, `resolveHomeworkExamQuestionsForRoomIdCachedWithRetry`,
 *     `buildScoringPlan`, `scaledSumForScore`, `achievableScoresList` - COPY-IMPORT NGUYÊN VẸN từ
 *     pro_lamlai_target_score.mjs (không đổi).
 *   - Answer/matching: `HomeworkExamEngine`/`answerCurrentQuestionOneShot`/`isResultScreen`/`readResult`
 *     (navigation/homeworkExamEngine.js) + `findMatchingQuestion`/`findFullAnswerSetMatches`/
 *     `disambiguateByQuestionText` (discovery/answerSetMatcher.js) - CÙNG pipeline case "làm lại".
 *   - Bridge: `MaestroMcpBridge` (automation/bridge/maestroMcpBridge.js) - 1 tiến trình `maestro
 *     mcp` DUY NHẤT sống xuyên suốt phase quét+mở+trả lời+submit+verify của TOÀN BỘ hàng đợi.
 *   - Login: `loginAndDetectActiveProfile()` MIRROR `ensureProProfileActive()`
 *     (pro_lamlai_target_score.mjs) - KHÔNG switch sang 1 profileName cố định nào, dùng ĐÚNG
 *     profile đang active trên thiết bị (không đổi so với bản 2026-09-07).
 *   - Đọc danh sách card THẬT trên UI: `parseHomeworkCardsWithDetail`/
 *     `collectTextNodesWithBoundsInsideScrollableList` (discovery/homeworkUiList.js) - nguồn DUY
 *     NHẤT phân biệt được CTA "Làm bài"/"Tiếp tục"/"Làm lại"/"Chinh phục" (KHÔNG có field API nào
 *     tương đương - "Chinh phục" chỉ lộ ra qua chính UI này, xác nhận thật 2026-08-18).
 *   - Mở bài từ danh sách: `openCurrentFromList()` bên dưới MIRROR chuỗi bước DEVICE_MODE=true của
 *     `flows/app/helpers/open-exercise.yaml` - KHÔNG đổi.
 *
 * IDENTITY cho 1 bài ĐÃ TỒN TẠI SẴN (khác bài MỚI giao, vốn có itemId biết trước): (title, hạn nộp
 * DD/MM) đọc từ chính card UI, đối chiếu với `getHomeworks()` - CÙNG identity mà
 * `flows/app/helpers/open-exercise.yaml` đã dùng cho việc mở bài (title+hạn nộp phân biệt được 2
 * card trùng title). Nếu >1 room khớp cùng (title, hạn nộp) - bỏ qua candidate đó (log rõ lý do),
 * KHÔNG đoán.
 *
 * KHI APP TỰ CHUYỂN BÀI QUA "Tiếp theo" (identity của bài mới KHÔNG biết trước - app tự chọn, không
 * phải chúng ta): nếu hàng đợi đã lọc chỉ còn ĐÚNG 1 bài, không cần đoán (chỉ có 1 khả năng). Nếu
 * còn >1, xác định bằng NỘI DUNG câu hỏi đang hiển thị so với answer-set CMS đã resolve sẵn cho
 * TỪNG bài còn lại trong hàng đợi (tái sử dụng NGUYÊN `findFullAnswerSetMatches()`/
 * `disambiguateByQuestionText()` đã có, không viết thuật toán match mới) - không match được/còn
 * ambiguous ở mức ROOM thì BLOCKED rõ ràng, KHÔNG đoán. Nếu hàng đợi đã hết (0 bài còn lại) mà app
 * vẫn hiện "Tiếp theo" - nghĩa là app tự chuyển vào 1 bài NGOÀI hàng đợi đã kiểm tra (vd 1 candidate
 * bị SKIP ở bước lọc CMS/scoring, hoặc 1 bài không đọc được hạn nộp) - BLOCKED ngay, KHÔNG đoán/
 * KHÔNG giao thêm bài để "bù".
 *
 * AN TOÀN SCORING: chỉ đưa vào hàng đợi các bài CHƯA có câu nào được trả lời (progress "0/M" hoặc
 * không có dòng progress) - 1 bài đã có "N/M" với N>0 nghĩa là ĐÃ có câu trả lời từ lượt làm TRƯỚC
 * (không phải do phiên chạy này), việc tính scoring plan coi như kiểm soát đúng/sai cho TOÀN BỘ câu
 * sẽ SAI vì N câu đó đã bị khoá kết quả từ trước - loại các bài này khỏi hàng đợi (log rõ, không
 * fail cả run chỉ vì có bài như vậy tồn tại song song).
 *
 * SCORE TARGETING (ENV, KHÔNG hardcode - đúng rule feedback_never_hardcode_score_or_exercise):
 *   TARGET_SCORE_MIN, TARGET_SCORE_MAX (số, thang 0-10) - xem resolveTargetRange() bên dưới.
 *   KHÔNG set biến nào -> mặc định random 1 điểm khả thi thật trong khoảng MỞ (0, 10) - loại trừ cả
 *   2 đầu mút 0 và 10. Áp dụng ĐỘC LẬP cho từng bài trong hàng đợi.
 *
 * FORBIDDEN (yêu cầu rõ của user, không có ngoại lệ): giao thêm bài tập mới dưới bất kỳ hình thức
 * nào, random-đáp-án-rồi-hy-vọng, retry-tới-khi-khớp, sửa lại target SAU KHI đã thấy điểm thật, bỏ
 * qua/làm mềm assertion điểm, coi "đúng 3 bài" là precondition bắt buộc, logout/switch profile để
 * đổi tài khoản.
 *
 * ENV:
 *   APP_ID (.env)
 *   PHONE, OTP (KHÔNG có default - CHỈ dùng nếu app đang ở màn đăng nhập)
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
import { MaestroMcpBridge } from "../bridge/maestroMcpBridge.js";
import { HomeworkExamEngine, collectTexts } from "./navigation/homeworkExamEngine.js";
import { getHomeworks } from "./discovery/homeworks.js";
import { isoToDueDateDM } from "./model/homeworkModel.js";
import {
  findMatchingQuestion,
  findFullAnswerSetMatches,
  disambiguateByQuestionText,
  buildNormalizedVisibleSet,
} from "./discovery/answerSetMatcher.js";
import {
  parseHomeworkCardsWithDetail,
  collectTextNodesWithBoundsInsideScrollableList,
  parseBounds,
} from "./discovery/homeworkUiList.js";
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
// KHÔNG hardcode PHONE/OTP/PROFILE_NAME cho 1 tài khoản cố định - case này luôn dùng đúng profile
// ĐANG active trên thiết bị (xem loginAndDetectActiveProfile() bên dưới), KHÔNG tự switch/logout.
// PHONE/OTP chỉ là fallback dùng khi app THẬT SỰ đang ở màn đăng nhập (chưa có phiên nào active).
const PHONE = process.env.PHONE || "";
const OTP = process.env.OTP || "";
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";

function log(...args) {
  console.log(...args);
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

/** ===================== SCORE TARGET RANGE (env, mặc định khoảng MỞ (0,10)) ===================== */
function resolveTargetRange() {
  const rawMin = process.env.TARGET_SCORE_MIN;
  const rawMax = process.env.TARGET_SCORE_MAX;
  if (rawMin === undefined && rawMax === undefined) {
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
 * thật trên `metadata.point`, KHÔNG viết lại). */
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
 * pro_lamlai_target_score.mjs. KHÔNG đổi thuật toán. */
function buildWantCorrectMap(questions, correctIndices) {
  const map = new Map();
  questions.forEach((q, i) => {
    const pointRaw = Number(q.metadata?.point) || 0;
    map.set(q.id, pointRaw <= 0 || correctIndices.has(i));
  });
  return map;
}

/** Đọc bounds "[x1,y1][x2,y2]" -> {x1,y1} - COPY tinh thần parseBounds() của pro_lamlai_target_score.mjs. */
function parseBoundsXY(boundsStr) {
  const m = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(boundsStr ?? "");
  if (!m) return null;
  const [x1, y1] = m.slice(1, 3).map(Number);
  return { x1, y1 };
}

/** ===================== PROFILE DETECTION (không hardcode profile) =====================
 * KHÔNG có resource-id nào cho tên profile - dùng VỊ TRÍ: header luôn đúng 2 hàng cố định (hàng 1 =
 * tên profile + badge "Pro"/"Free", hàng 2 = tên lớp + "Chuyển profile"). Nếu không xác định được
 * DUY NHẤT 1 text - BLOCKED rõ ràng, KHÔNG đoán. */
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

/** Đăng nhập (CHỈ khi app THẬT SỰ đang ở màn đăng nhập, dùng phone/otp làm fallback) rồi mở tab
 * "Bài tập" và ĐỌC (KHÔNG switch) tên profile đang active. */
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

/** Escape ký tự regex đặc biệt trong title trước khi ghép vào selector Maestro. */
function escapeForMaestroRegex(text) {
  return String(text).replace(/[.*+?^()|[\]\\]/g, (m) => `\\${m}`);
}

/** Relaunch app + mở lại tab "Bài tập" - BẮT BUỘC gọi lại NGAY TRƯỚC khi mở bài đầu tiên (danh
 * sách trong bộ nhớ có thể là snapshot cũ). */
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
  if (!relaunch.success) throw new Error(`Không relaunch/mở lại tab "Bài tập": ${relaunch.error}`);
}

/** Quét TOÀN BỘ card "Bài tập" đang hiển thị thật trên UI (không giao bài, không gọi CMS/API) -
 * cuộn (swipe) + đọc hierarchy nhiều lượt, dừng sớm khi 2 lượt liên tiếp không phát hiện thêm card
 * mới (CÙNG nguyên tắc dừng-sớm đã dùng thật trong discovery/homeworkUiList.js#collectVisibleHomeworkCards(),
 * chỉ khác transport: gọi trực tiếp 2 hàm parser THUẦN (bridge-agnostic) của file đó với
 * `await bridge.hierarchy()`/`await bridge.runSteps()` của MaestroMcpBridge (async) - KHÔNG dùng
 * thẳng wrapper `collectVisibleHomeworkCards(bridge)` vì wrapper đó viết cho `MaestroBridge` đồng bộ). */
// KHÔNG PHẢI logic mới - PORT NGUYÊN thuật toán đã verify + fix bug thật trong
// automation/bai_tap/verify-filter-web-vs-app.mjs (scrollPastLastEntry()/mergeWithBoundedOverlap(),
// xem docblock đầy đủ ở đó, đặc biệt đoạn "BUG THẬT đã phát hiện + PHÂN TÍCH KỸ" ngay phía trên
// scrollPastLastEntry()): cuộn theo % màn hình CỐ ĐỊNH (bản trước của hàm này, kể cả sau khi hạ từ
// 55% xuống 35%) VẪN có thể NHẢY QUA hẳn 1 card nằm gọn giữa 2 lượt đọc hierarchy liên tiếp - card
// đó KHÔNG BAO GIỜ xuất hiện trong bất kỳ lần đọc nào (không phải do dừng sớm, do THẬT SỰ nhảy
// qua) - xác nhận thật lại lần nữa (2026-09-08): dù đã giảm xuống 35%, "G8-U3-Reading-Bài tập nâng
// cao" (đang dở 3/10) vẫn có nguy cơ bị bỏ sót cùng kiểu lỗi. File verify-filter-web-vs-app.mjs đã
// tự chứng minh (2026-08-11): với N card giống hệt nhau xếp liên tiếp, KHÔNG có ngưỡng % màn hình
// cố định nào an toàn tuyệt đối - phải cuộn CHÍNH XÁC theo TOẠ ĐỘ (bounds thật của dòng CUỐI CÙNG
// đã đọc được) để đảm bảo overlap giữa 2 lượt đọc liên tiếp LUÔN ≤ 1 dòng, loại bỏ hẳn khả năng
// nhảy qua nội dung - CÙNG lý do file kia đã bỏ hẳn cách cuộn %.
function findScrollableContainerBounds(node) {
  if (node?.attributes?.scrollable === "true") return parseBounds(node.attributes.bounds);
  for (const child of node?.children ?? []) {
    const found = findScrollableContainerBounds(child);
    if (found) return found;
  }
  return null;
}

/** Cuộn CHÍNH XÁC từ toạ độ (centerX, lastEntryBottomY-5) lên (centerX, containerTop+40) - COPY
 * NGUYÊN công thức scrollPastLastEntry()/scrollPastLastEntryViaSession() của
 * verify-filter-web-vs-app.mjs (không đổi 1 con số nào) - đây LUÔN là 1 lượt cuộn vừa đủ để đưa
 * dòng cuối cùng vừa đọc lên gần đầu danh sách, không đoán %. */
async function scrollPastLastEntry(bridge, rootBounds, containerBounds, lastEntryBottomY) {
  const left = rootBounds?.x1 ?? 0;
  const right = rootBounds?.x2 ?? 1080;
  const screenBottom = rootBounds?.y2 ?? 2340;
  const centerX = Math.round((left + right) / 2);
  const marginTop = (containerBounds?.y1 ?? 291) + 40;
  const startY = Math.min(Math.max(lastEntryBottomY - 5, marginTop + 50), screenBottom - 50);
  const result = await bridge.runSteps([
    { swipe: { start: `${centerX},${startY}`, end: `${centerX},${marginTop}`, duration: 400 } },
    { waitForAnimationToEnd: { timeout: 750 } },
  ]);
  if (!result.success) throw new Error(`scrollPastLastEntry: cuộn thất bại: ${result.error}`);
}

function cardKeyForMerge(card) {
  return `${card.title}|${card.dueDate}|${card.progress}|${card.score}|${card.cta}`;
}

/** COPY NGUYÊN mergeWithBoundedOverlap() của verify-filter-web-vs-app.mjs - overlap đã bị CHẶN
 * CỨNG ở tối đa 1 phần tử bởi scrollPastLastEntry() nên chỉ cần so ĐÚNG 1 vị trí (phần tử cuối
 * accumulated có trùng phần tử đầu newCards không), KHÔNG cần "đoán k" như cách dedupe-theo-Map
 * cũ (Map/Set theo nội dung SAI khi có ≥2 card trùng hoàn toàn title+hạn nộp - card trùng key là
 * HỢP LỆ, vd 2 lượt giao khác nhau trùng tên+hạn, PHẢI giữ riêng, không được dedupe). */
function mergeWithBoundedOverlap(accumulated, newCards) {
  if (
    accumulated.length > 0 &&
    newCards.length > 0 &&
    cardKeyForMerge(accumulated[accumulated.length - 1]) === cardKeyForMerge(newCards[0])
  ) {
    return accumulated.concat(newCards.slice(1));
  }
  return accumulated.concat(newCards);
}

// SỬA BUG THẬT (2026-09-08, live-verify): "2 lượt liên tiếp không thêm card mới -> dừng" quá chặt
// khi màn hình có NHIỀU section rời nhau ("Bài tập về nhà" -> "Bài tập nâng cao" -> "Kiến thức
// trong bài", đã xác nhận thật đúng thứ tự này) - xác nhận thật: khoảng TRỐNG giữa card CUỐI của
// "Bài tập về nhà" và card ĐẦU của "Bài tập nâng cao" (banner/khoảng cách, không có text nào khớp
// mẫu card) cần ĐÚNG 2 lượt cuộn KHÔNG card nào để vượt qua - trùng NGAY ngưỡng dừng cũ, khiến scan
// dừng SỚM giữa chừng, bỏ sót toàn bộ "Bài tập nâng cao" dù nó vẫn còn ở phía dưới. "Kiến thức
// trong bài" đã là tín hiệu dừng DỨT KHOÁT, đáng tin cậy hơn hẳn (xem check reachedKnowledgeSection
// bên dưới) - nới ngưỡng noNewStreak lên rộng rãi (chỉ còn là lưới an toàn phụ, không phải điều
// kiện dừng chính), `maxScrolls` vẫn là trần cứng tuyệt đối không đổi.
async function scanExistingIncompleteCards(bridge, { maxScrolls = 20, maxStallRetries = 2, maxNoNewStreak = 6 } = {}) {
  let sectionSeen = false;
  // "Kiến thức trong bài" LUÔN là section NGAY SAU "Bài tập nâng cao" - section CUỐI CÙNG chứa card
  // Bài tập (xác nhận qua CHÍNH text này đã dùng làm mốc kết thúc ở nhiều nơi khác trong repo, vd
  // flows/app/bai_tap/HW-05-pull-to-refresh.yaml, ktra-kienthuctrongbai.yaml). Thấy section này ->
  // CHẮC CHẮN 100% không còn card Bài tập nào phía dưới nữa - dừng cuộn NGAY.
  const readOnce = async () => {
    const tree = await bridge.hierarchy();
    const nodes = collectTextNodesWithBoundsInsideScrollableList(tree, []);
    const result = parseHomeworkCardsWithDetail(nodes, { sectionSeen });
    sectionSeen = sectionSeen || result.sectionSeen;
    const rootBounds = parseBounds(tree?.attributes?.bounds);
    const containerBounds = findScrollableContainerBounds(tree);
    const lastEntryBottomY = nodes.length ? nodes[nodes.length - 1].bounds?.y2 ?? null : null;
    const reachedKnowledgeSection = nodes.some((n) => n.text.includes("Kiến thức trong bài"));
    return { cards: result.cards, rootBounds, containerBounds, lastEntryBottomY, reachedKnowledgeSection, entriesSignature: JSON.stringify(nodes) };
  };

  let prevRead = await readOnce();
  let accumulated = prevRead.cards;
  let noNewStreak = 0;
  let scrollCount = 0;
  log(`  [SCAN] lượt 0 (đọc đầu, trước khi cuộn): cards_lượt_này=${prevRead.cards.length} tổng=${accumulated.length}`);
  while (scrollCount < maxScrolls && noNewStreak < maxNoNewStreak && !prevRead.reachedKnowledgeSection) {
    scrollCount++;
    let newRead = null;
    let stalled = true;
    for (let retry = 0; retry <= maxStallRetries; retry++) {
      if (prevRead.lastEntryBottomY == null) {
        // Fallback hiếm gặp (không đo được bounds dòng cuối, vd danh sách rỗng) - cuộn % cố định
        // CHỈ cho lượt này, KHÔNG dừng cả script (mất đảm bảo overlap≤1 đúng lượt đó thôi).
        await bridge.runSteps([{ swipe: { start: "50%,80%", end: "50%,45%", duration: 400 } }, { waitForAnimationToEnd: { timeout: 1200 } }]);
      } else {
        await scrollPastLastEntry(bridge, prevRead.rootBounds, prevRead.containerBounds, prevRead.lastEntryBottomY);
      }
      const candidate = await readOnce();
      // BUG THẬT đã xác nhận trong verify-filter-web-vs-app.mjs (2026-08-11): đôi khi hierarchy đọc
      // được NGAY SAU waitForAnimationToEnd vẫn CHƯA kịp cập nhật sau cuộn (race) - toàn bộ entries
      // giống Y NGUYÊN lượt trước. Phát hiện bằng so signature TOÀN BỘ entries (không chỉ card) -
      // giống hệt thì coi như cuộn CHƯA có tác dụng, thử lại (không tính vào noNewStreak thật).
      if (candidate.entriesSignature !== prevRead.entriesSignature) {
        newRead = candidate;
        stalled = false;
        break;
      }
      newRead = candidate;
    }
    // SỬA BUG THẬT (2026-09-08, tự phát hiện khi live-verify): nếu HẾT retry vẫn stalled (hierarchy
    // không đổi 1 chữ nào - cuộn hoàn toàn không có tác dụng lượt này), TUYỆT ĐỐI KHÔNG được merge
    // lại `newRead.cards` (nó Y HỆT `prevRead.cards` đã merge rồi) - `mergeWithBoundedOverlap()` chỉ
    // cắt bỏ ĐÚNG 1 phần tử trùng, phần CÒN LẠI của danh sách y hệt sẽ bị nối thêm lần 2 như thể là
    // card MỚI, làm accumulated.length tăng giả -> noNewStreak reset sai (luôn về 0) -> vòng lặp
    // KHÔNG BAO GIỜ dừng đúng lúc, ăn hết maxScrolls trong khi vị trí cuộn không hề nhúc nhích -
    // hậu quả thật: bỏ sót toàn bộ section "Bài tập nâng cao" (đứng sau) vì ngân sách cuộn bị tiêu
    // hết ngay trong section "Bài tập về nhà" (đứng trước) do lặp lại card cũ giả làm "mới".
    let added = 0;
    if (stalled) {
      noNewStreak++;
    } else {
      const before = accumulated.length;
      accumulated = mergeWithBoundedOverlap(accumulated, newRead.cards);
      added = accumulated.length - before;
      noNewStreak = added > 0 ? 0 : noNewStreak + 1;
    }
    log(
      `  [SCAN] lượt ${scrollCount}: stalled=${stalled} cards_lượt_này=${newRead.cards.length} thêm_mới=${added} tổng=${accumulated.length} ` +
        `noNewStreak=${noNewStreak} reachedKnowledgeSection=${newRead.reachedKnowledgeSection}`,
    );
    prevRead = newRead;
  }
  return accumulated;
}

/** Resolve room_id cho 1 card ĐÃ TỒN TẠI SẴN (khác bài mới giao - không có itemId biết trước) bằng
 * identity (title, hạn nộp DD/MM) - CÙNG identity `flows/app/helpers/open-exercise.yaml` đã dùng.
 * >1 match cùng identity - KHÔNG đoán, trả về để caller tự bỏ qua candidate đó (log rõ lý do). */
function resolveExistingRoomForCard(title, dueDm, allHomeworks) {
  const matches = allHomeworks.filter((h) => h.title === title && isoToDueDateDM(h.deadline.endTime) === dueDm);
  return { matches, unique: matches.length === 1, room: matches.length === 1 ? matches[0] : null };
}

/** MIRROR của `flows/app/helpers/open-exercise.yaml` (nhánh DEVICE_MODE=true) - mở ĐÚNG 1 bài từ
 * danh sách "Bài tập" theo title + hạn nộp (KHÔNG tap theo index). */
async function openCurrentFromList(bridge, { exerciseName, dueDateDm }) {
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

/** MIRROR `answerOneQuestion()` của pro_lamlai_target_score.mjs. KHÔNG đổi thuật toán
 * answerCurrentQuestionOneShot()/decideAnswerAction(). LUÔN truyền resultLabel (không điều kiện
 * theo "isLast" nữa) - CÙNG triết lý "ghi đè mỗi câu, lần ghi cuối cùng còn lại đúng là màn Kết quả"
 * đã dùng cho screenshot "before_submit" (xem docblock answerCurrentQuestionOneShot()) - cần thiết
 * vì với bài ĐANG DỞ (resume, xem answerAllQuestions() bên dưới) không còn biết trước CÂU NÀO là
 * câu cuối cùng thật sự (số câu CÒN LẠI trên UI có thể ít hơn tổng số câu CMS của bài). */
async function answerOneQuestionForRun(exam, matched, wantCorrectMap, resultLabel) {
  const wantCorrect = wantCorrectMap.get(matched.id);
  const outcome = await exam.answerCurrentQuestionOneShot(matched, {
    wantCorrect,
    resultLabel,
    snapshot: matched._snapshot ?? null,
  });
  if (!outcome.supported) {
    throw new Error(`Handler không hỗ trợ câu "${matched.question}" (id=${matched.id}): ${outcome.reason}`);
  }
  return { wantCorrect, outcome };
}

/** Vòng lặp trả lời TOÀN BỘ câu CÒN LẠI (chưa trả lời) của 1 bài - CÙNG pattern Phase E của
 * pro_lamlai_target_score.mjs. Dừng khi ĐÃ trả lời đủ `questions.length` (bài mở HOÀN TOÀN mới,
 * 0/M) HOẶC ngay khi màn hình hiện tại là màn Kết quả (bài ĐANG DỞ resume từ lượt làm TRƯỚC - số
 * câu THẬT còn hiển thị trên UI có thể ÍT HƠN `questions.length` vì N câu đầu đã được trả lời ở
 * lượt làm trước, không phải phiên chạy này - không có cách nào biết trước N mà không đoán, nên
 * dừng dựa vào TÍN HIỆU THẬT trên màn hình thay vì đếm số cố định). */
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
      if (carryTree && exam.isResultScreen(carryTree)) {
        log(`  [${label}] Đã tới màn Kết quả sau ${answeredIds.size}/${questions.length} câu - bài này ĐANG DỞ (resume), phần còn lại đã được trả lời ở lượt làm TRƯỚC.`);
        break;
      }
      const kind = matchResult.status === "AMBIGUOUS" ? "AMBIGUOUS_MATCH" : "NO_MATCH";
      throw new Error(
        `[${label}] ${kind} ở câu ${questionIndex}/${questions.length}: ${matchResult.diagnostic?.diagnosticReason ?? "(không có diagnosticReason)"}`,
      );
    }
    const matched = matchResult.question;
    const { wantCorrect, outcome } = await answerOneQuestionForRun(
      exam,
      matched,
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

/** Assert CTA đúng NHÃN mong đợi + đúng KHÔNG xuất hiện nhãn bị cấm. */
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
 * target/actual/breakdown/answer-key/achievableScores. */
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

/** Xác định app vừa TỰ CHUYỂN (qua "Tiếp theo") vào bài NÀO trong số các bài còn lại trong hàng đợi
 * - so nội dung câu hỏi đang hiển thị với answer-set CMS đã resolve sẵn cho TỪNG bài còn lại (TÁI
 * SỬ DỤNG NGUYÊN `findFullAnswerSetMatches()`/`disambiguateByQuestionText()`, không viết thuật toán
 * match mới) - không match được/còn ambiguous ở mức ROOM thì trả AMBIGUOUS/NO_MATCH, KHÔNG đoán. */
function identifyLandedRoomFromTree(tree, remainingExercises) {
  const texts = collectTexts(tree);
  const normalizedVisibleSet = buildNormalizedVisibleSet(texts);
  const pool = [];
  for (const ex of remainingExercises) {
    for (const q of ex.questions) pool.push({ ...q, _roomId: ex.roomId });
  }
  const { matches } = findFullAnswerSetMatches(pool, normalizedVisibleSet);
  if (matches.length === 0) return { status: "NO_MATCH" };
  const distinctRoomIds = [...new Set(matches.map((m) => m._roomId))];
  if (distinctRoomIds.length === 1) return { status: "MATCHED", roomId: distinctRoomIds[0] };
  const disambig = disambiguateByQuestionText(matches, texts);
  if (disambig.status === "MATCHED") return { status: "MATCHED", roomId: disambig.winner._roomId };
  return { status: "AMBIGUOUS", distinctRoomIds };
}

async function main() {
  requireTeacherPortalConfig();
  if (!APP_ID) throw new Error("Thiếu APP_ID - kiểm tra .env.");

  log(`[0/4] Mở app + đọc (KHÔNG switch) profile ĐANG active trên thiết bị...`);
  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);
  const perExercise = [];
  const queueSummary = [];
  let overallError = null;
  const overallStart = Date.now();
  let PROFILE_NAME = null;
  let range = null;

  try {
    const { profileName } = await loginAndDetectActiveProfile(bridge, { phone: PHONE, otp: OTP });
    PROFILE_NAME = profileName;
    log(`  [PROFILE] Đang active trên thiết bị: "${PROFILE_NAME}"`);

    log(`[1/4] Quét TOÀN BỘ card "Bài tập" đang hiển thị thật (KHÔNG giao bài mới)...`);
    const cards = await scanExistingIncompleteCards(bridge);
    log(`  [SCAN] Tổng số card đọc được: ${cards.length}`);

    // SỬA (2026-09-08, live-verify - xem project_chinh_phuc_special_cta_bug.md mục "CORRECTED"):
    // "Chinh phục" TRƯỚC ĐÂY bị loại vì nghi là 1 luồng UI khác - đã XÁC NHẬN SAI qua
    // `maestro hierarchy` (id giống HỆT exercise thường: exercise_answer_0..3/exercise_check_button/
    // exercise_close_button) + probe thật (tap qua 10 câu bằng CHÍNH cơ chế chung, tới màn Kết quả,
    // CTA "Hoàn thành" đúng, list sau đó lên "12/12" - hoàn thành THẬT, không phải giả). "Chinh phục"
    // chỉ là nhãn CTA của card thuộc "Bài tập nâng cao" - dùng được y hệt "Làm bài"/"Tiếp tục".
    const usableCards = cards.filter((c) => c.cta === "Làm bài" || c.cta === "Tiếp tục" || c.cta === "Chinh phục");
    for (const c of cards) {
      if (c.cta !== "Làm bài" && c.cta !== "Tiếp tục" && c.cta !== "Chinh phục") {
        log(`  [SKIP] "${c.title}" (CTA="${c.cta}") - không phải bài chưa hoàn thành (Làm lại = đã xong).`);
      }
    }
    // Trọng tâm case HW-29 là hành vi NÚT trên màn Kết quả (Tiếp theo/Hoàn thành), KHÔNG PHẢI kiểm
    // soát điểm số chính xác cho MỌI bài - 1 bài ĐANG DỞ (đã có câu trả lời từ lượt làm TRƯỚC, không
    // phải phiên chạy này) VẪN cần được đưa vào hàng đợi để chuỗi CTA thật sự đi qua đúng bài đó
    // (nếu loại bỏ, "Tiếp theo" thật của app vẫn có thể tự đưa vào đúng bài này - app không biết/
    // không quan tâm automation có kiểm soát điểm được hay không - và automation sẽ BLOCKED oan vì
    // hàng đợi "đã lọc" của mình thiếu đúng bài app đang thực sự dùng). CHỈ khác: với bài ĐANG DỞ,
    // KHÔNG tính scoring plan/target điểm chính xác (không kiểm soát được đúng/sai của các câu đã
    // trả lời TRƯỚC phiên này) - trả lời PHẦN CÒN LẠI nhắm ĐÚNG mặc định, chỉ ghi nhận điểm thật đạt
    // được để tham khảo, không assert khớp target.
    const candidateCards = [];
    for (const c of usableCards) {
      if (!c.dueDate) {
        log(`  [SKIP] "${c.title}" - không đọc được hạn nộp trên card, không đủ identity để resolve room_id.`);
        continue;
      }
      const m = /^(\d+)\s*\/\s*\d+$/.exec(c.progress ?? "");
      const scoreControlled = !(m && Number(m[1]) > 0);
      if (!scoreControlled) {
        log(`  [RESUME] "${c.title}" (progress="${c.progress}") - đã có câu trả lời từ lượt làm TRƯỚC; vẫn đưa vào hàng đợi để test CTA, KHÔNG target/verify điểm chính xác cho bài này.`);
      }
      candidateCards.push({ ...c, scoreControlled });
    }
    if (candidateCards.length === 0) {
      throw new Error(
        `BLOCKED_NO_USABLE_EXISTING_EXERCISE: không tìm thấy bài nào ĐANG chờ làm (CTA "Làm bài"/"Tiếp tục") trên profile "${PROFILE_NAME}" - không thể chạy case này (đã bị cấm giao bài mới).`,
      );
    }

    log(`[2/4] Resolve room_id + CMS answer key + scoring plan cho ${candidateCards.length} candidate...`);
    const sessionRefresh = refreshExamSessionFromEnvCookie();
    if (!sessionRefresh.refreshed) {
      throw new Error(`Không refresh được exam_session.json từ EXAM_COOKIE: ${sessionRefresh.reason}`);
    }
    range = resolveTargetRange();
    log(`  [TARGET_RANGE] source=${range.source} min=${range.min} max=${range.max} exclusive=${range.exclusive}`);

    const allHomeworks = await getHomeworks({ period: "MONTH" });
    const queue = [];
    for (const card of candidateCards) {
      const dueDm = card.dueDate.replace(/^Hạn nộp /, "").replace(/\s*\(QUÁ HẠN\)$/, "");
      queueSummary.push({ title: card.title, dueDate: card.dueDate, cta: card.cta, progress: card.progress, scoreControlled: card.scoreControlled });
      const { matches, unique, room } = resolveExistingRoomForCard(card.title, dueDm, allHomeworks);
      if (!unique) {
        log(`  [SKIP] "${card.title}" (hạn nộp ${dueDm}) - room_id không unique (${matches.length} match) - bỏ qua, không đoán.`);
        continue;
      }
      const resolved = await resolveHomeworkExamQuestionsForRoomIdCachedWithRetry(room.id);
      if (resolved.status !== "RESOLVED") {
        log(`  [SKIP] "${card.title}" - CMS resolve status=${resolved.status}: ${resolved.reason}`);
        continue;
      }
      if (!isTextChoiceCompatible(resolved.questions)) {
        log(`  [SKIP] "${card.title}" - câu hỏi không toàn bộ text-choice-compatible (SPEAK/CONNECT/DRAG_DROP...).`);
        continue;
      }
      if (!card.scoreControlled) {
        log(`  [QUEUE] "${card.title}" room_id=${room.id} (RESUME - không target điểm, chỉ test CTA)`);
        const wantCorrectMap = new Map(resolved.questions.map((q) => [q.id, true]));
        queue.push({
          title: card.title,
          dueDateDm: dueDm,
          roomId: room.id,
          questions: resolved.questions,
          scoringPlan: null,
          wantCorrectMap,
          scoreControlled: false,
        });
        continue;
      }
      const scoringPlan = computeScoringPlanInRange(resolved.questions, range);
      if (!scoringPlan.achievable) {
        log(`  [SKIP] "${card.title}" - ${scoringPlan.reason}`);
        continue;
      }
      log(
        `  [QUEUE] "${card.title}" room_id=${room.id} targetScore=${scoringPlan.targetScore} (achievable=[${scoringPlan.achievableScores.join(", ")}])`,
      );
      const wantCorrectMap = buildWantCorrectMap(resolved.questions, scoringPlan.correctIndices);
      queue.push({
        title: card.title,
        dueDateDm: dueDm,
        roomId: room.id,
        questions: resolved.questions,
        scoringPlan,
        wantCorrectMap,
        scoreControlled: true,
      });
    }
    if (queue.length === 0) {
      throw new Error(
        `BLOCKED_NO_USABLE_EXISTING_EXERCISE: ${freshCards.length} candidate ứng viên nhưng KHÔNG cái nào qua được resolve room/CMS/scoring - xem log [SKIP] phía trên.`,
      );
    }

    log(`[3/4] Relaunch app + mở lại tab "Bài tập" rồi mở bài đầu tiên trong hàng đợi (${queue.length} bài)...`);
    await relaunchAndOpenHomeworkTab(bridge);
    await openCurrentFromList(bridge, { exerciseName: queue[0].title, dueDateDm: queue[0].dueDateDm });

    const remaining = new Map(queue.map((ex) => [ex.roomId, ex]));
    let currentEx = queue[0];
    let index = 0;
    const MAX_ITER = 25;

    log(`[4/4] Trả lời tuần tự + verify điểm + verify CTA cho tới khi gặp "Hoàn thành"...`);
    while (true) {
      if (index >= MAX_ITER) {
        throw new Error(`BLOCKED_LOOP_SAFETY_CAP: đã lặp ${MAX_ITER} lần mà chưa thấy CTA "Hoàn thành" - dừng an toàn.`);
      }
      const label = `item${index}`;
      const startedAt = Date.now();
      await exam.dismissAiPopupIfPresent();
      const targetDesc = currentEx.scoreControlled ? `target=${currentEx.scoringPlan.targetScore}` : "RESUME - không target điểm";
      log(`  [${label}] "${currentEx.title}" - trả lời phần còn lại (${targetDesc})...`);
      const { answerLog, lastOutcome } = await answerAllQuestions(bridge, exam, currentEx.questions, currentEx.wantCorrectMap, label);
      if (!lastOutcome?.finalTree || !exam.isResultScreen(lastOutcome.finalTree)) {
        throw new Error(`[${label}] Không thấy màn Kết quả sau khi trả lời hết câu.`);
      }
      const result = exam.readResult(lastOutcome.finalTree);

      let scoreEntry;
      if (currentEx.scoreControlled) {
        const scoreVerify = verifyScoreOrThrow({
          label,
          targetScore: currentEx.scoringPlan.targetScore,
          range,
          result,
          questions: currentEx.questions,
          answerLog,
          achievableScores: currentEx.scoringPlan.achievableScores,
          requiredCorrectCount: currentEx.scoringPlan.correctIndices.size,
        });
        log(`  [${label}] ĐIỂM THẬT=${scoreVerify.actualScore} (target=${currentEx.scoringPlan.targetScore}) - PASS.`);
        scoreEntry = {
          targetScore: currentEx.scoringPlan.targetScore,
          achievableScores: currentEx.scoringPlan.achievableScores,
          requiredCorrectCount: currentEx.scoringPlan.correctIndices.size,
          totalScoredItems: currentEx.scoringPlan.totalScoredItems,
          actualScore: scoreVerify.actualScore,
          realCorrectCount: scoreVerify.correctCount,
          realTotalCount: scoreVerify.totalCount,
          denominatorMatches: scoreVerify.denominatorMatches,
          scorePassed: true,
        };
      } else {
        // Bài ĐANG DỞ (resume) - KHÔNG kiểm soát/assert điểm (không biết đúng/sai của các câu đã
        // trả lời TRƯỚC phiên này) - chỉ ghi nhận điểm thật đạt được để tham khảo, trọng tâm case
        // này (CTA màn Kết quả) vẫn được verify đầy đủ bên dưới bất kể nhánh này.
        const actualScore = result.score === null ? null : Number(result.score);
        log(`  [${label}] ĐIỂM THẬT=${actualScore} (RESUME - không assert, chỉ ghi nhận).`);
        scoreEntry = {
          targetScore: null,
          actualScore,
          realCorrectCount: result.correctCount,
          realTotalCount: result.totalCount,
          scorePassed: null,
        };
      }

      const texts = collectTexts(lastOutcome.finalTree);
      remaining.delete(currentEx.roomId);
      const hasNext = texts.some((t) => t.includes("Tiếp theo"));
      const hasComplete = texts.some((t) => t.includes("Hoàn thành"));
      const endedAt = Date.now();
      perExercise.push({
        label,
        title: currentEx.title,
        roomId: currentEx.roomId,
        scoreControlled: currentEx.scoreControlled,
        ...scoreEntry,
        ctaObserved: hasNext ? "Tiếp theo" : hasComplete ? "Hoàn thành" : "UNKNOWN",
        answerLog,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        durationMs: endedAt - startedAt,
      });

      if (hasNext && !hasComplete) {
        assertCtaLabel(texts, "Tiếp theo", "Hoàn thành", label);
        const tapResult = await bridge.runSteps([{ tapOn: { text: ".*(Tiếp theo).*" } }]);
        if (!tapResult.success) throw new Error(`[${label}] Bấm CTA "Tiếp theo" thất bại: ${tapResult.error}`);
        const landedResult = await bridge.runSteps([{ extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 30000 } }]);
        if (!landedResult.success) throw new Error(`[${label}] Sau khi bấm "Tiếp theo" không vào được màn Doing tiếp theo: ${landedResult.error}`);

        if (remaining.size === 0) {
          throw new Error(
            `[${label}] App hiện CTA "Tiếp theo" và tự chuyển màn nhưng hàng đợi đã lọc của chúng ta đã hết (0 bài còn lại) - ` +
              `app có thể đang tự động chuyển vào 1 bài NGOÀI hàng đợi đã kiểm tra (vd 1 candidate bị SKIP ở bước [2], hoặc 1 loại ` +
              `"Chinh phục" ẩn) - dừng lại, KHÔNG đoán, KHÔNG giao thêm bài để bù.`,
          );
        }
        let nextRoomId;
        if (remaining.size === 1) {
          nextRoomId = [...remaining.keys()][0];
        } else {
          const landedTree = await bridge.hierarchy();
          const identify = identifyLandedRoomFromTree(landedTree, [...remaining.values()]);
          if (identify.status !== "MATCHED") {
            throw new Error(
              `[${label}] Không xác định được app vừa tự chuyển vào bài nào trong ${remaining.size} bài còn lại trong hàng đợi ` +
                `(status=${identify.status}) - dừng lại, KHÔNG đoán.`,
            );
          }
          nextRoomId = identify.roomId;
        }
        currentEx = remaining.get(nextRoomId);
        index++;
        continue;
      }

      if (hasComplete && !hasNext) {
        assertCtaLabel(texts, "Hoàn thành", "Tiếp theo", label);
        const tapResult = await bridge.runSteps([{ tapOn: { text: ".*(Hoàn thành).*" } }]);
        if (!tapResult.success) throw new Error(`[${label}] Bấm CTA "Hoàn thành" thất bại: ${tapResult.error}`);
        const backResult = await bridge.runSteps([{ extendedWaitUntil: { visible: { id: "homework_screen" }, timeout: 30000 } }]);
        if (!backResult.success) throw new Error(`[${label}] Sau khi bấm "Hoàn thành" không quay lại được homework_screen: ${backResult.error}`);
        perExercise[perExercise.length - 1].returnedToList = true;
        break;
      }

      throw new Error(`[${label}] Trạng thái CTA bất thường trên màn Kết quả (hasNext=${hasNext}, hasComplete=${hasComplete}) - texts=${JSON.stringify(texts)}`);
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
    profileName: PROFILE_NAME,
    queueSummary,
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
        `cta=${e.ctaObserved} duration=${(e.durationMs / 1000).toFixed(1)}s [${e.startedAt} -> ${e.endedAt}]`,
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
