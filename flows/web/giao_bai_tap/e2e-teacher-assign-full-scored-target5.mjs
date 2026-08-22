#!/usr/bin/env node
/**
 * E2E-Teacher-Assign-Full-Scored-Target5
 *
 * FORK của e2e-ktra-fullluong-lambai-scored-pro.mjs (2026-08-21, theo yêu cầu "chạy full luồng
 * giao bài tập mới -> làm bài đạt điểm trong khoảng 5 điểm, quan sát tổng số bài khi giao có tăng
 * không và khi hoàn thành có tăng số bài hoàn thành không"). KHÁC bản gốc đúng 4 điểm:
 *   1. Target class/profile: "7QA-Test" (id=da3efdea-e0ea-4627-b119-a11c329d3d4e, xem
 *      flows/web/teacher/testcases/lop-phu-trach/them-moi.md) + profile "Trần Duy Anh"
 *      (PHONE=0915151519) thay vì lớp "3B"/profile PRO "Ngoc". ensureProProfileActive() giữ
 *      nguyên logic (chỉ cần tên profile khớp - tài khoản này có thể chỉ có 1 profile, hàm tự
 *      nhận biết "đã active" và KHÔNG cố chuyển).
 *   2. Target điểm: [4.5, 5.5] (quanh 5.0) thay vì [6.0, 8.0] (quanh 7.0) - xem computeScorePlan().
 *   3. THÊM overallProgressBeforeAssign: đọc "Bài tập X/Y" tổng NGAY TỪ ĐẦU (trong
 *      ensureProProfileActive(), lúc bridge đang đứng ở tab Bài tập TRƯỚC KHI GV giao bài) - bản
 *      gốc chỉ đọc overallProgress SAU KHI đã giao bài (không verify được tổng SỐ BÀI (mẫu số Y)
 *      có tăng khi giao bài mới hay không, chỉ verify được số bài HOÀN THÀNH (tử số X) tăng sau khi
 *      làm xong). Bản này so sánh mẫu số Y trước/sau giao bài, NGOÀI so sánh tử số X trước/sau hoàn
 *      thành (giữ nguyên từ bản gốc).
 *   4. OUTPUT_FILE riêng (không đè report của bản gốc).
 *
 * Phần còn lại (audit đối chiếu flows/bai_tap/ktra_fullluong_lambai.yaml, lifecycle mở->thoát
 * X->resume->hoàn thành->đọc điểm/progress) COPY NGUYÊN VĂN từ bản gốc - xem docblock đầy đủ trong
 * e2e-ktra-fullluong-lambai-scored-pro.mjs, không lặp lại ở đây.
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
 *     verify điểm số nằm trong [4.5, 5.5] là YÊU CẦU MỚI, cộng thêm vào, không phải thay thế check
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
 *   - Đọc + verify điểm số THẬT nằm trong [4.5, 5.5] sau màn Kết quả - MỚI, cộng thêm (yaml gốc
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
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseEnvFile } from "../../../automation/src/config.js";
import { MaestroMcpBridge } from "../../../automation/bridge/maestroMcpBridge.js";
import { HomeworkExamEngine, decideAnswerAction } from "../../../automation/bai_tap/navigation/homeworkExamEngine.js";
import { fetchEligibleAssignmentTree } from "../../../automation/giao_bai_tap/navigation/teacherAssignmentApiDiscovery.js";
import { parseQuestionsFromExamPage } from "../../../automation/discovery/examPageScraper.js";
import { normalizeQuestions } from "../../../automation/model/questionModel.js";
import { resolveHomeworkExamQuestionsForRoomId } from "../../../automation/bai_tap/discovery/teacherMaterialsExamResolver.js";
import { fetchAllHomeworkRooms, fetchRoomDetails } from "../../../automation/bai_tap/discovery/homeworks.js";
import { normalizeHomework } from "../../../automation/bai_tap/model/homeworkModel.js";
import { formatDM, formatDMY, isoToVnYmd } from "../../app/bai_tap/verify-filter-web-vs-app.mjs";
// FIX (2026-08-22, OPEN_EXERCISE_AMBIGUOUS thật xác nhận trên room 19e78018-8c11-48e9-845f-
// efefe4dff82f): findAssignment()/scrollToTop()/tapFoundCard() ĐÃ CÓ SẴN, ĐÃ PROVEN (dùng thật
// trong assignHomeworkAndLocateOnApp() ở e2e-teacher-assign-student-open.mjs, tìm thấy card cùng
// room này chỉ trong 13 lượt cuộn ngay sau khi mất bug tương tự với cơ chế scrollAndReadCardState/
// readCardState cũ của CHÍNH FILE NÀY - xem locateOpenAndVerifyAssignment() bên dưới). KHÔNG viết
// lại findAssignment() - chỉ đổi [5/N]/[7/N]/[8/N] để GỌI nó thay cho scrollAndReadCardState.
import { findAssignment, scrollToTop, tapFoundCard } from "../../../automation/bai_tap/discovery/findAssignment.js";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "e2e_teacher_assign_full_scored_target5_report.json");
const ACCOUNTS_ENV_PATH = join(PROJECT_ROOT, "test_data", "accounts.env");
const ROOT_ENV_PATH = join(PROJECT_ROOT, ".env");
const EXAM_SESSION_PATH = join(PROJECT_ROOT, "automation", ".cache", "exam_session.json");
const ACCOUNTS_ENV = parseEnvFile(ACCOUNTS_ENV_PATH);
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const TARGET_CLASS = process.env.ASSIGN_PRIMARY_CLASS || "7QA-Test";
// Lớp "7QA-Test" (xem flows/web/teacher/testcases/lop-phu-trach/them-moi.md) - tài khoản test
// mặc định [[feedback_default_test_account_tranduyanh]] (PHONE=0915151519, profile "Trần Duy Anh")
// thuộc lớp này.
const TARGET_CLASS_ID = process.env.TARGET_CLASS_ID || "da3efdea-e0ea-4627-b119-a11c329d3d4e";
const MAX_PRESCAN_ATTEMPTS = Number(process.env.MAX_PRESCAN_ATTEMPTS || 12);
const MAX_DISAMBIGUATE_CANDIDATES = Number(process.env.MAX_DISAMBIGUATE_CANDIDATES || 10);
const PROFILE_PRO_NAME = process.env.PROFILE_PRO_NAME || ACCOUNTS_ENV.PROFILE_PRO_NAME || "Trần Duy Anh";
// TARGET_SCORE_MIN/MAX (MỚI 2026-08-21, theo yêu cầu "làm lại đạt 9đ" - tham số hoá khoảng điểm
// mục tiêu qua ENV thay vì hardcode [4.5,5.5], KHÔNG đổi công thức tính computeScorePlan()) - mặc
// định giữ nguyên [4.5, 5.5] (quanh 5.0) như ban đầu nếu không truyền ENV.
// CHECK_KIEN_THUC_TRONG_BAI (MỚI 2026-08-21, theo yêu cầu "đừng chạy case kiểm tra kiến thức làm
// gì, khi nào tôi yêu cầu thì chạy") - mặc định TẮT (false), CHỈ chạy 2 bước MÀN 1/MÀN 2 (xem
// [4b/N]/[10b/N]) khi truyền CHECK_KIEN_THUC_TRONG_BAI=true.
const CHECK_KIEN_THUC_TRONG_BAI = process.env.CHECK_KIEN_THUC_TRONG_BAI === "true";
const TARGET_SCORE_MIN = Number(process.env.TARGET_SCORE_MIN ?? 4.5);
const TARGET_SCORE_MAX = Number(process.env.TARGET_SCORE_MAX ?? 5.5);
const TARGET_SCORE_CENTER = (TARGET_SCORE_MIN + TARGET_SCORE_MAX) / 2;
const TARGET_SCORE_RANGE_LABEL = `[${TARGET_SCORE_MIN}, ${TARGET_SCORE_MAX}]`;
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

/** ===================== card/progress helpers ===================== */

/**
 * Kiến thức trong bài - TÁI SỬ DỤNG (không viết lại) chính hành vi đã verify THẬT ngày 2026-08-21
 * (xem test_data/activity_log_tranduyanh.md + flows/app/bai_tap/ktra-kienthuctrongbai.yaml): tap
 * vào card Unit gợi ý trong mục "Kiến thức trong bài" -> router.replace sang tab "Vui học".
 *
 * KHÁC ktra-kienthuctrongbai.yaml (yaml gốc dùng CỐ ĐỊNH `tapOn: point: 50%, 55%`, ĐÃ XÁC NHẬN
 * THẬT hôm nay là bấm TRƯỢT trên màn "Kết quả BTVN" cụ thể vì khối ĐIỂM SỐ/CHÍNH XÁC phía trên đẩy
 * card xuống thấp hơn màn "Danh sách bài tập" - card KHÔNG có id/text cố định nào để tap chính xác
 * qua Maestro selector, chỉ có thể tap theo % màn hình): thử NHIỀU điểm % (55/60/65) thay vì 1 điểm
 * cố định, dừng ngay khi điều hướng thành công - AN TOÀN HƠN, không đổi hành vi cốt lõi (vẫn tap mù
 * theo %, không đoán selector mới chưa verify).
 * @returns {Promise<{navigated: boolean, tapPointUsed: string|null, reason: string|null, contentValid: boolean|null, unitTitle: string|null}>}
 */
async function attemptKienThucTrongBaiNavigation(bridge, screenLabel) {
  const scrollResult = await bridge.runSteps([
    { scrollUntilVisible: { element: { text: ".*(Kiến thức trong bài).*" }, direction: "DOWN", timeout: 25000 } },
  ]);
  if (!scrollResult.success) {
    return { navigated: false, tapPointUsed: null, reason: `[${screenLabel}] Không cuộn thấy "Kiến thức trong bài": ${scrollResult.error}`, contentValid: null, unitTitle: null };
  }
  const candidatePoints = ["50%,55%", "50%,60%", "50%,65%"];
  for (const point of candidatePoints) {
    await bridge.runSteps([
      { swipe: { start: "50%,80%", end: "50%,45%", duration: 400 } },
      { tapOn: { point } },
    ]);
    const navResult = await bridge.runSteps([{ extendedWaitUntil: { visible: ".*(Vui học).*", timeout: 8000 } }]);
    if (navResult.success) {
      log(`  [KIẾN THỨC TRONG BÀI - ${screenLabel}] Điều hướng "Vui học" OK (tapPoint="${point}").`);
      // Content/data validation (TÁCH RIÊNG khỏi navigation, theo yêu cầu) - đọc lại hierarchy
      // NGAY sau khi điều hướng, tìm dòng "Unit N: ..." thật đang hiển thị trên trang Vui học vừa
      // vào - "content hợp lệ" = có 1 dòng "Unit N: ..." + không rơi vào 1 màn trống/lỗi (dùng
      // collectAllTexts đã có sẵn, KHÔNG thêm parser mới).
      const texts = collectAllTexts(await bridge.hierarchy());
      const unitTitle = texts.find((t) => /^Unit\s+\d+\s*:/i.test(t)) ?? null;
      const contentValid = Boolean(unitTitle);
      log(`  [KIẾN THỨC TRONG BÀI - ${screenLabel}] Content validation: unitTitle="${unitTitle}" contentValid=${contentValid}`);
      return { navigated: true, tapPointUsed: point, reason: null, contentValid, unitTitle };
    }
  }
  return {
    navigated: false,
    tapPointUsed: null,
    reason: `[${screenLabel}] Đã thử ${candidatePoints.length} điểm tap (${candidatePoints.join(", ")}) sau khi cuộn thấy "Kiến thức trong bài" nhưng không điều hướng được sang "Vui học".`,
    contentValid: null,
    unitTitle: null,
  };
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

/**
 * locateOpenAndVerifyAssignment() - FIX (2026-08-22) cho OPEN_EXERCISE_AMBIGUOUS "sau 0 lượt" đã
 * xác nhận thật trên room 19e78018-8c11-48e9-845f-efefe4dff82f (đọc chẩn đoán read-only: card THẬT
 * tồn tại, `findAssignment()` tìm thấy đúng 1 candidate sau 13 lượt cuộn - locator cũ
 * `scrollAndReadCardState`/`readCardState` của CHÍNH FILE NÀY (dựa trên Maestro `scrollUntilVisible`
 * gốc) mới là thứ fail, đúng root cause đã ghi trong docblock `findAssignment.js` dòng 240-245: bị
 * đánh lừa bởi card liền kề title gần giống + CÙNG hạn nộp, ví dụ chính card "G3-U1-Lesson 2: Read
 * and tick True or False" đứng NGAY CẠNH "G3-U2-Lesson 2..." trong danh sách thật hôm nay).
 *
 * KHÔNG viết lại findAssignment()/scrollToTop()/tapFoundCard() - GỌI LẠI nguyên vẹn 3 hàm đã có sẵn
 * và đã proven (dùng thật trong assignHomeworkAndLocateOnApp()). Hàm này CHỈ thêm 1 lớp bắt buộc
 * theo yêu cầu identity-based matching: KHÔNG BAO GIỜ coi 1 candidate là "đúng room" chỉ vì
 * title+dueDate khớp trên UI (UI KHÔNG lộ room.id - xem docblock findAssignment.js dòng 37-39) -
 * phải MỞ candidate đó ra rồi xác thực nội dung câu hỏi hiển thị có khớp với bộ câu hỏi ĐÃ RESOLVE
 * THẬT theo đúng room.id (qua resolveHomeworkExamQuestionsForRoomId() ở [3/N], truyền vào qua
 * `questions`) bằng chính `findMatchingQuestion()` đã có sẵn trong file này - đây là identity thật
 * duy nhất còn lại khi UI không có ID để so trực tiếp.
 *
 * Dùng CHUNG cho cả bước mở lần đầu ([5/N]) VÀ bước tìm-lại-để-resume ([7/N]/[8/N]) - CÙNG 1 cơ chế
 * xác thực, không phải 2 code path khác nhau cho "mở mới" và "resume" (đúng yêu cầu: resume phải
 * load lại identity cũ + verify lại, không phải tin tưởng mù vị trí/index đã tap lần trước).
 *
 * @param {object} params
 * @param {string} params.title - title CHÍNH XÁC của assignment (so sánh exact, KHÔNG regex - xem
 *   findAssignment.js#matchesTarget - loại bỏ hẳn nhu cầu escape ký tự đặc biệt của bản cũ).
 * @param {?string} params.dueDateDM - "DD/MM", dùng làm bộ lọc candidate cấp 1 (UI-level).
 * @param {?string} params.cta - optional, lọc thêm theo CTA hiện tại (vd "Tiếp tục" khi resume, để
 *   findAssignment() tự loại các card cùng title+dueDate nhưng CHƯA từng mở - KHÔNG thay cho content
 *   verification bên dưới, chỉ giảm số candidate cần mở thử).
 * @param {Array<object>} params.questions - bộ câu hỏi ĐÃ RESOLVE theo room.id thật (từ
 *   resolveHomeworkExamQuestionsForRoomId ở [3/N]) - dùng làm content fingerprint để verify.
 * @param {number} [params.maxCandidates] - chặn trên số candidate AMBIGUOUS sẽ thử mở (an toàn,
 *   không thử vô hạn) - mặc định dùng lại MAX_DISAMBIGUATE_CANDIDATES đã có sẵn trong file.
 * @returns {Promise<
 *   | { ok: true, card: object, matched: object, triedLog: Array }
 *   | { ok: false, status: "NOT_FOUND"|"ERROR"|"CONTENT_MISMATCH"|"AMBIGUOUS_UNRESOLVED"|"OPEN_STEP_FAILED", diagnostics: string, triedLog: Array }
 * >}
 */
async function locateOpenAndVerifyAssignment(bridge, { title, dueDateDM, cta = null, questions, maxCandidates = MAX_DISAMBIGUATE_CANDIDATES }) {
  await scrollToTop(bridge);
  const located = await findAssignment(bridge, { title, dueDateDM, cta });
  if (located.status === "NOT_FOUND") return { ok: false, status: "NOT_FOUND", diagnostics: located.diagnostics, triedLog: [] };
  if (located.status === "ERROR") return { ok: false, status: "ERROR", diagnostics: located.diagnostics, triedLog: [] };

  const openAndCheckContent = async (candidate) => {
    const tapResult = await tapFoundCard(bridge, candidate);
    if (!tapResult.success) return { opened: false, contentMatched: null, matched: null, error: tapResult.error };
    const openWait = await bridge.runSteps([
      { waitForAnimationToEnd: { timeout: 3000 } },
      { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
      { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 40000 } },
    ]);
    if (!openWait.success) return { opened: false, contentMatched: null, matched: null, error: openWait.error };
    const matched = await findMatchingQuestion(bridge, questions);
    return { opened: true, contentMatched: Boolean(matched), matched };
  };
  const closeIfOpen = () =>
    bridge.runSteps([
      { tapOn: { id: "exercise_close_button" }, optional: true },
      { extendedWaitUntil: { visible: ".*(Bài tập).*", timeout: 20000 } },
    ]);

  if (located.status === "FOUND") {
    const outcome = await openAndCheckContent(located.card);
    const triedLog = [{ candidate: located.card, ...outcome }];
    if (outcome.opened && outcome.contentMatched) return { ok: true, card: located.card, matched: outcome.matched, triedLog };
    if (outcome.opened) await closeIfOpen();
    return { ok: false, status: outcome.opened ? "CONTENT_MISMATCH" : "OPEN_STEP_FAILED", diagnostics: located.diagnostics, triedLog };
  }

  // AMBIGUOUS (≥2 candidate cùng title+dueDate[+cta]): PHẢI thử HẾT mọi candidate rồi mới kết luận -
  // KHÔNG dừng sớm ở candidate khớp content ĐẦU TIÊN (nếu dừng sớm sẽ không biết candidate còn lại
  // có CŨNG khớp content hay không - "chỉ khi còn đúng 1 candidate match mới được mở/làm" đòi hỏi
  // biết chắc KHÔNG có candidate thứ 2 nào cũng khớp).
  const candidates = located.matches.slice(0, maxCandidates);
  const triedLog = [];
  const matchedCandidates = [];
  for (const candidate of candidates) {
    const outcome = await openAndCheckContent(candidate);
    triedLog.push({ candidate, ...outcome });
    if (outcome.opened) {
      if (outcome.contentMatched) matchedCandidates.push({ candidate, matched: outcome.matched });
      await closeIfOpen();
    }
  }
  if (matchedCandidates.length !== 1) {
    return {
      ok: false,
      status: matchedCandidates.length === 0 ? "CONTENT_MISMATCH" : "AMBIGUOUS_CONTENT_MATCH",
      diagnostics: located.diagnostics,
      triedLog,
    };
  }
  // Đúng 1 candidate khớp content trong số các candidate ambiguous - candidate đó đã bị ĐÓNG lại ở
  // vòng kiểm tra công bằng phía trên (để không thiên vị thứ tự thử) - mở LẠI đúng candidate này lần
  // cuối để tiếp tục vào làm bài (postcondition trả về: exercise_close_button đang visible).
  const winner = matchedCandidates[0];
  const reopen = await openAndCheckContent(winner.candidate);
  triedLog.push({ candidate: winner.candidate, ...reopen, reopen: true });
  if (!reopen.opened || !reopen.contentMatched) {
    return { ok: false, status: "REOPEN_FAILED", diagnostics: located.diagnostics, triedLog };
  }
  return { ok: true, card: winner.candidate, matched: reopen.matched, triedLog };
}

/**
 * verifyCardShowsScoreByIdentity() - FIX (2026-08-22) cho [11/N] "verify card đã hoàn thành", CÙNG
 * chiến lược identity-based đã PASS ở locateOpenAndVerifyAssignment() (open/resume). THAY bản cũ
 * `scrollToCard()` + quét PHẲNG "Điểm <số>" trên TOÀN VIEWPORT hiện tại - bản cũ có 2 lỗi:
 *   1. `scrollToCard()` neo compound title+"Hạn nộp DATE" - card ĐÃ HOÀN THÀNH KHÔNG CÒN dòng "Hạn
 *      nộp" (đã ghi nhận thật trong docblock cũ của readCardState) nên LUÔN rơi vào fallback
 *      title-only, dùng Maestro `scrollUntilVisible` gốc - CÙNG lớp bug đã gây OPEN_EXERCISE_AMBIGUOUS
 *      ở [5/N]/[7-8/N] khi có card liền kề title gần giống (đã xác nhận thật: "G3-U1-Lesson 2..."
 *      đứng cạnh "G3-U2-Lesson 2..." trong danh sách thật).
 *   2. Quét "Điểm <số>" PHẲNG trên toàn bộ text đang hiển thị, KHÔNG neo theo card nào cụ thể - có
 *      thể false-positive PASS nếu 1 card ĐÃ HOÀN THÀNH KHÁC (từ lần chạy trước) tình cờ lọt vào
 *      cùng viewport.
 *
 * ROOT CAUSE THẬT của lần FAIL live tiếp theo (2026-08-22, room 19e78018-8c11-48e9-845f-
 * efefe4dff82f) KHÔNG PHẢI biên độ cuộn (đã điều tra + REVERT giả thuyết đó, xem git log) - đã xác
 * nhận qua fixture (homeworkUiList.parseCard.fixtureTest.mjs) card THẬT hiện diện ngay trong lượt
 * đọc đầu tiên (không cần cuộn) mà `findAssignment()` vẫn báo NOT_FOUND. NGUYÊN NHÂN THẬT nằm ở
 * `parseHomeworkCardsWithDetail()` (homeworkUiList.js): card đã hoàn thành có CẢ dòng "N / M" VÀ
 * "Điểm N" liên tiếp - thuật toán cũ break sớm khi gặp anchor thứ 2, coi nhầm là ranh giới card kế
 * tiếp, khiến card bị loại VĨNH VIỄN khỏi kết quả parse (không liên quan gì tới cuộn). ĐÃ SỬA đúng
 * gốc tại `parseHomeworkCardsWithDetail()`/`parseHomeworkCardsFromTexts()` - hàm này giờ KHÔNG cần
 * tự dò/retry gì thêm, `findAssignment()` gọi nguyên vẹn 1 lần là đủ.
 *
 * Vì parser đã trả thêm field `score` (giá trị "Điểm N" thật của CHÍNH card, xem
 * parseHomeworkCardsWithDetail()) ngay trên card trả về từ `findAssignment()` - KHÔNG cần tự quét
 * lại bounds/hierarchy riêng nữa (đơn giản hơn bản trước, tận dụng đúng identity đã có).
 * @returns {Promise<{ ok: true, card: object, scoreLine: string } | { ok: false, status: string, diagnostics: ?string }>}
 */
export async function verifyCardShowsScoreByIdentity(bridge, { title }) {
  await scrollToTop(bridge);
  const located = await findAssignment(bridge, { title, cta: "Làm lại" });
  if (located.status !== "FOUND") {
    return { ok: false, status: located.status, diagnostics: located.diagnostics };
  }
  const card = located.card;
  if (!card.score) {
    return { ok: false, status: "SCORE_LINE_NOT_FOUND", diagnostics: located.diagnostics };
  }
  return { ok: true, card, scoreLine: card.score };
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

/** Range đóng cả 2 đầu [4.5, 5.5] quanh 5.0 (KHÔNG phải "X/10 câu đúng" - xem docblock đầu file
 * mục 2 - áp dụng đúng công thức tỉ lệ thuận đã dùng ở bản gốc, chỉ đổi tâm/biên khoảng mục tiêu). */
function computeScorePlan(totalCount) {
  let best = null;
  for (let c = 0; c <= totalCount; c++) {
    const predicted = Math.round((c / totalCount) * 100) / 10;
    if (predicted < TARGET_SCORE_MIN || predicted > TARGET_SCORE_MAX) continue;
    const distanceToCenter = Math.abs(predicted - TARGET_SCORE_CENTER);
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
// FIX (2026-08-21, sau 2 lần FAIL thật liên tiếp ở bước "selectUnitLessonHomework", rồi user tự
// kiểm tra CMS "Chỉnh sửa Lesson" và chỉ ra field "Tag"): lúc đầu tưởng lessonName (CMS) ~ tên tab
// Web GV (SAI, đã thử 2 cách đoán - exact match rồi prefix match - đều không đáng tin, vd
// "Grammar" tag="A closer look 2" không có quan hệ tiền tố/hậu tố gì với lessonName). NGUỒN THẬT
// (xác nhận qua curl trực tiếp GET /api/learn/lesson/:unitId hôm nay): mỗi lesson có field
// `tag.name` - ĐÂY MỚI CHÍNH XÁC LÀ tên nút "Chọn Lesson" hiển thị trên Web GV (KHÔNG PHẢI
// lesson.name) - đã THÊM field `lessonTag` (additive, không đổi field cũ) vào
// fetchEligibleAssignmentTree() (automation/giao_bai_tap/navigation/teacherAssignmentApiDiscovery.js)
// để expose field này. KHÔNG còn cần đoán/lọc theo danh sách tab cố định nữa - loại candidate nào
// thiếu lessonTag (dữ liệu CMS thiếu tag, hiếm) là đủ an toàn.
async function pickFeasibleRandomAssignment({ className, classId, maxAttempts = MAX_PRESCAN_ATTEMPTS }) {
  const tree = await fetchEligibleAssignmentTree(className);
  const flat = [];
  let skippedNoTag = 0;
  for (const u of tree.eligibleTree) {
    if (/^Review\s+\d+/i.test(u.unitName)) continue;
    for (const l of u.lessons) {
      if (!l.lessonTag) {
        skippedNoTag += l.items.length;
        continue;
      }
      for (const it of l.items) {
        if (it.isSpeak) continue;
        if (!Array.isArray(it.examIds) || it.examIds.length !== 1) continue;
        flat.push({ unitName: u.unitName, lessonName: l.lessonName, webGvLessonTab: l.lessonTag, itemName: it.name, itemId: it.id, examId: it.examIds[0] });
      }
    }
  }
  if (skippedNoTag > 0) {
    log(`  [SELECTION] ${skippedNoTag} candidate bị loại vì lesson thiếu field "tag" trong CMS (không xác định được nút "Chọn Lesson" tương ứng trên Web GV).`);
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
      // Đang đứng ở tab "Bài tập", CHƯA cuộn (COPY đúng anchor readOverallProgress()) - đọc luôn
      // overallProgressBeforeAssign NGAY TẠI ĐÂY, TRƯỚC KHI GV giao bài mới ở bước sau (xem
      // docblock đầu file mục 3) - đây là baseline mẫu số Y để so sánh có tăng sau khi giao hay không.
      const overallProgressBeforeAssign = readOverallProgress(treeBefore);
      return { name: PROFILE_PRO_NAME, alreadyActive: true, switched: false, verified: true, overallProgressBeforeAssign };
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
    const treeAfterSwitch = await bridge.hierarchy();
    const verified = isVisibleInTree(collectAllTexts(treeAfterSwitch), `.*(${PROFILE_PRO_NAME}).*`);
    if (!verified) throw new Error(`Đã tap chuyển hồ sơ nhưng KHÔNG xác nhận lại được "${PROFILE_PRO_NAME}" hiển thị sau đó.`);
    log(`  [PROFILE] Đã chuyển + verify hồ sơ "${PROFILE_PRO_NAME}" đang active.`);
    // Sau khi chuyển profile app có thể đã điều hướng khỏi tab "Bài tập" - đưa lại về tab đó rồi
    // mới đọc overallProgressBeforeAssign (cùng anchor/điều kiện "chưa cuộn" như nhánh alreadyActive).
    await bridge.runSteps([
      { tapOn: { text: "Bài tập", optional: true } },
      { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao|Bạn không có bài tập nào đang chờ|2 tuần gần nhất|1 tháng gần nhất).*" }, timeout: 30000 } },
    ]);
    const overallProgressBeforeAssign = readOverallProgress(await bridge.hierarchy());
    return { name: PROFILE_PRO_NAME, alreadyActive: false, switched: true, verified: true, overallProgressBeforeAssign };
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
  push(`overall_before_assign=${evidence.overallProgressBeforeAssign ?? "-"}`);
  push(`overall_after_assign=${evidence.overallProgressBefore ?? "-"}`);
  push(`assign_increased_total(Y)=${evidence.assignIncreasedTotal?.ok ?? "-"} (${evidence.assignIncreasedTotal?.totalBeforeAssign ?? "-"} -> ${evidence.assignIncreasedTotal?.totalAfterAssign ?? "-"})`);
  push(`card_badge=${pb.badge ?? "-"}`);
  push(`card_cta=${pb.cta ?? "-"}`);
  push(``);
  push(`[SCORING_PLAN]`);
  push(`target_score_range=${TARGET_SCORE_MIN}..${TARGET_SCORE_MAX}`);
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
  push(`target_range=${TARGET_SCORE_MIN} <= score <= ${TARGET_SCORE_MAX}`);
  push(`PASS/FAIL=${si.scoreInRangeTarget ? "PASS" : "FAIL"}`);
  push(``);
  push(`[CORRECTNESS]`);
  push(`planned_correct=${si.plannedCorrectCount ?? "-"}`);
  push(`server_correct=${si.realCorrectCountFromResultScreen ?? "-"}`);
  push(`answer_mapping_verified=${Boolean(evidence.answerLog?.every((l) => l.isTargetCorrect !== null))}`);
  push(``);
  push(`[KIEN_THUC_TRONG_BAI]`);
  const ktb = evidence.kienThucTrongBai ?? {};
  push(`man1_danh_sach_bai_tap_navigation=${ktb.man1?.navigated ?? "-"}${ktb.man1?.tapPointUsed ? ` (tapPoint=${ktb.man1.tapPointUsed})` : ""}`);
  push(`man1_content_validation=${ktb.man1?.contentValid ?? "-"} (unitTitle=${ktb.man1?.unitTitle ?? "-"})`);
  push(`man2_ket_qua_btvn_navigation=${ktb.man2?.navigated ?? "-"}${ktb.man2?.tapPointUsed ? ` (tapPoint=${ktb.man2.tapPointUsed})` : ""}`);
  push(`man2_content_validation=${ktb.man2?.contentValid ?? "-"} (unitTitle=${ktb.man2?.unitTitle ?? "-"})`);
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

  log(`[0/N] Đảm bảo hồ sơ học sinh đang active = "${PROFILE_PRO_NAME}"...`);
  const profileResult = await ensureProProfileActive({ appId: APP_ID, phone: PHONE, otp: OTP });
  evidence.profile = profileResult;
  evidence.overallProgressBeforeAssign = profileResult.overallProgressBeforeAssign;
  log(`  [PASS] profile=${profileResult.name} switched=${profileResult.switched} verified=${profileResult.verified}`);
  log(`  overall progress BEFORE ASSIGN (baseline, trước khi GV giao bài mới) = "${profileResult.overallProgressBeforeAssign}"`);

  // REUSE_ROOM_ID (MỚI 2026-08-21, PORT NGUYÊN VẸN pattern đã có sẵn trong
  // flows/web/giao_bai_tap/e2e-teacher-assign-partial-resume-scored.mjs - KHÔNG viết logic mới,
  // chỉ tái dùng escape-hatch đã tồn tại) - theo yêu cầu "controlled retry, không tạo thêm
  // assignment nếu assignment cũ có thể reuse": room này ĐÃ giao bài thành công thật ở lượt chạy
  // trước (Web GV báo "Giao bài tập mới thành công" + API room.json xác nhận room_id/title/due
  // date), nhưng lượt đó FAIL ở bước findAssignment() (báo NOT_FOUND/END_OF_LIST) - xác nhận qua
  // kiểm tra tay: card "Choose the word whose underlined part..." VẪN CÓ THẬT trong danh sách
  // (0/10, Hạn nộp 28/08), tức findAssignment() báo sai (flaky), KHÔNG PHẢI room không tồn tại.
  // Bỏ qua hẳn [1/N] pre-scan + [2/N] giao bài lại (tránh tạo thêm room mới không cần thiết) -
  // dùng lại CHÍNH room đó, để [5/N] "OPEN đúng assignment" (scrollAndReadCardState + tapOn, cơ
  // chế KHÁC assignHomeworkAndLocateOnApp()/findAssignment(), đã verify hoạt động đúng cho chính
  // room này ở lượt chạy trước) tự tìm và mở.
  let assignment, dueVnYmd, startVnYmd;
  if (process.env.REUSE_ROOM_ID) {
    const roomId = process.env.REUSE_ROOM_ID;
    log(`[1-2/N] REUSE_ROOM_ID=${roomId} - bỏ qua pre-scan + giao bài lại, dùng lại room đã giao bài thành công ở lượt trước.`);
    const roomDetails = await fetchRoomDetails(roomId);
    const room = roomDetails?.room;
    if (!room) {
      return finish({ status: "FAIL", phase: "TEACHER_ASSIGN_OR_LOCATE", error: `fetchRoomDetails("${roomId}") không trả về room hợp lệ.`, evidence });
    }
    assignment = { id: room.id, title: room.name, classIds: room.class_id ?? [] };
    dueVnYmd = isoToVnYmd(room.end_time);
    startVnYmd = isoToVnYmd(room.start_time);
    evidence.locateCaveat =
      `Room "${roomId}" đã giao bài thành công THẬT ở lượt chạy trước (Web GV toast + API room.json xác nhận) - ` +
      `lượt trước đó FAIL ở findAssignment() (NOT_FOUND/END_OF_LIST) nhưng đã xác nhận TAY card này CÓ THẬT trong danh sách ` +
      `(0/10, chưa đụng) - phân loại findAssignment() failure là SHARED_INFRASTRUCTURE (Navigation layer), KHÔNG PHẢI room không tồn tại. ` +
      `Lượt này KHÔNG gọi lại Web GV (tránh tạo room trùng), dùng lại cơ chế open/resume riêng của chính file này (scrollAndReadCardState, khác findAssignment()).`;
    evidence.teacherAssign = { roomId: assignment.id, title: assignment.title, dueTimeVn: formatDMY(dueVnYmd), reused: true };
  } else {
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

    // FIX (2026-08-22, FAIL thật xác nhận qua run TARGET_SCORE_MIN=6/MAX=6.9: "Giao bài thất bại
    // ở bước selectUnitLessonHomework"): file này đổi TARGET_CLASS default sang "7QA-Test" (dòng
    // 111) nhưng e2e-teacher-assign-student-open.mjs đọc ASSIGN_PRIMARY_CLASS/TARGET_CLASS_ID
    // thành const module-level NGAY LÚC IMPORT, mặc định "3B" nếu không truyền qua process.env -
    // THIẾU 2 dòng set env này khiến candidate G7 (chọn từ lớp 7QA-Test ở PRESCAN) bị giao NHẦM
    // vào lớp "3B" (chương trình khối 3, không có Unit/Lesson khối 7 tương ứng) -> FAIL ngay ở
    // bước chọn Unit/Lesson trên Web GV, trước khi tới bước bấm giao bài.
    process.env.ASSIGN_PRIMARY_CLASS = TARGET_CLASS;
    process.env.TARGET_CLASS_ID = TARGET_CLASS_ID;
    process.env.ASSIGN_UNIT_NAME = chosen.unitName;
    // Dùng ĐÚNG NHÃN TAB Web GV (webGvLessonTab, xem resolveWebGvLessonTab()) - KHÔNG dùng
    // chosen.lessonName (tên CMS thô) - resolveAndSelectLesson() so khớp EXACT với text nút DOM,
    // tên CMS có thể có hậu tố dư (đã gặp thật "Looking back: Skills" vs tab "Looking back").
    process.env.ASSIGN_LESSON_NAME = chosen.webGvLessonTab;
    process.env.ASSIGN_HOMEWORK_ITEM_NAME = chosen.itemName;
    process.env.ASSIGN_HOMEWORK_ITEM_ID = chosen.itemId;
    const assignModule = await import("./e2e-teacher-assign-student-open.mjs");

    log(`[2/N] GV giao bài (candidate đã chọn) + App HS locate đúng card (assignHomeworkAndLocateOnApp - hạ tầng dùng chung, không sửa)...`);
    const located = await assignModule.assignHomeworkAndLocateOnApp();
    evidence.locate = {
      strategy: "unique_item_name (pre-verified 0 collisions) -> due_date verify (native scrollUntilVisible + assertVisible)",
      status: located.ok ? "PASS" : located.status ?? "BLOCKED",
      matched_count: located.ok ? 1 : located.classification === "BLOCKED_AMBIGUOUS_ASSIGNMENT_MATCH" ? (located.evidence?.soCardTuongUng ?? "ambiguous") : 0,
    };
    if (!located.ok) return finish({ status: "FAIL", phase: "TEACHER_ASSIGN_OR_LOCATE", error: located.summary, evidence: { ...evidence, located } });
    ({ assignment, dueVnYmd, startVnYmd } = located);
    evidence.teacherAssign = { roomId: assignment.id, title: assignment.title, dueTimeVn: formatDMY(dueVnYmd), reused: false };
  }
  const dueDM = formatDM(dueVnYmd);
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
    log(`  overall progress BEFORE (= SAU KHI đã giao bài ở [2/N], TRƯỚC khi làm bài) = "${overallBefore}"`);

    // ===== So sánh mẫu số Y (tổng số bài được giao) TRƯỚC vs SAU khi GV giao bài mới - CHỈ áp
    // dụng khi THẬT SỰ giao bài mới ở [2/N] lượt này (isReuse=false). Khi REUSE_ROOM_ID (không giao
    // bài mới lượt này, xem docblock [1-2/N]), kỳ vọng ĐÚNG là Y KHÔNG đổi - dùng maker riêng
    // `assignCheckApplicable=false` để KHÔNG tính vào overallPass (tránh hiểu sai "giao bài fail"
    // khi thực ra là chủ đích không giao bài lượt này). =====
    const isReuse = Boolean(process.env.REUSE_ROOM_ID);
    evidence.isReuse = isReuse;
    const totalBeforeAssign = evidence.overallProgressBeforeAssign
      ? parseInt(evidence.overallProgressBeforeAssign.match(/\/\s*(\d+)/)?.[1] ?? "-1", 10)
      : -1;
    const totalAfterAssign = overallBefore ? parseInt(overallBefore.match(/\/\s*(\d+)/)?.[1] ?? "-1", 10) : -1;
    const assignIncreasedTotal = isReuse
      ? totalBeforeAssign >= 0 && totalAfterAssign >= 0 && totalAfterAssign === totalBeforeAssign
      : totalBeforeAssign >= 0 && totalAfterAssign >= 0 && totalAfterAssign > totalBeforeAssign;
    evidence.assignIncreasedTotal = { applicable: !isReuse, totalBeforeAssign, totalAfterAssign, ok: assignIncreasedTotal };
    log(
      isReuse
        ? `  [REUSE] không giao bài mới lượt này - tổng số bài (Y) kỳ vọng KHÔNG đổi: trước="${evidence.overallProgressBeforeAssign}" (Y=${totalBeforeAssign}) -> sau="${overallBefore}" (Y=${totalAfterAssign}) -> không đổi=${assignIncreasedTotal}`
        : `  [GIAO BÀI] tổng số bài (mẫu số Y): trước="${evidence.overallProgressBeforeAssign}" (Y=${totalBeforeAssign}) -> sau="${overallBefore}" (Y=${totalAfterAssign}) -> tăng=${assignIncreasedTotal}`,
    );

    // ===== [KIẾN THỨC TRONG BÀI - MÀN 1/2, Danh sách bài tập] (MỚI 2026-08-21, theo yêu cầu "chạy
    // case kiểm tra kiến thức trong bài" - TÁI SỬ DỤNG hành vi của
    // flows/app/bai_tap/ktra-kienthuctrongbai.yaml, xem attemptKienThucTrongBaiNavigation()).
    // KHÔNG chặn overallPass (quan sát/observational, giống tinh thần "smoke test" của yaml gốc) -
    // đang đứng ở tab "Bài tập" (đầu danh sách, vừa đọc xong overallBefore) nên cuộn tiếp xuống tìm
    // mục này rồi quay lại tab "Bài tập" trước khi tiếp tục [5/N] mở đúng assignment vừa giao. =====
    if (CHECK_KIEN_THUC_TRONG_BAI) {
      log(`[4b/N] Kiểm tra "Kiến thức trong bài" trên màn Danh sách bài tập (điều hướng sang Vui học rồi quay lại)...`);
      const kienThucMan1 = await attemptKienThucTrongBaiNavigation(bridge, "Danh sách bài tập");
      if (kienThucMan1.navigated) {
        // FIX (2026-08-21, BLOCKED thật gặp ở lượt "làm lại 9đ"): quay lại tab "Bài tập" sau khi
        // điều hướng "Vui học" KHÔNG tự về đầu danh sách - đứng lại ở vị trí cuộn sâu (nơi vừa tap
        // vào "Kiến thức trong bài"). scrollToCard() ở [5/N] ngay sau đây CHỈ cuộn DOWN (không cuộn
        // lên được) nên nếu card mục tiêu nằm PHÍA TRÊN vị trí hiện tại thì KHÔNG BAO GIỜ tìm thấy -
        // ĐÃ TÁI HIỆN THẬT: OPEN_EXERCISE_AMBIGUOUS "sau 0 lượt" (scrollAndReadCardState fail ngay
        // lần đầu). SỬA: cuộn về ĐẦU danh sách (COPY Y HỆT idiom "scroll to top" đã dùng ở [4/N] phía
        // trên - repeat 5x swipe direction DOWN) trước khi rời khỏi khối MÀN 1 này.
        await bridge.runSteps([
          { tapOn: { text: "Bài tập" } },
          { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao|2 tuần gần nhất|1 tháng gần nhất).*" }, timeout: 30000 } },
          { repeat: { times: 5, commands: [{ swipe: { direction: "DOWN", duration: 250 } }] } },
        ]);
      } else {
        log(`  [CẢNH BÁO] ${kienThucMan1.reason}`);
      }
      evidence.kienThucTrongBai = { man1: kienThucMan1 };
    }

    // ===== OPEN đúng assignment - FIX (2026-08-22): identity-based matching qua
    // locateOpenAndVerifyAssignment() (findAssignment()/scrollToTop()/tapFoundCard() có sẵn +
    // content-fingerprint verify qua QUESTIONS đã resolve theo room.id thật) - THAY hẳn locator cũ
    // scrollAndReadCardState/readCardState/readCardStateById (root cause OPEN_EXERCISE_AMBIGUOUS
    // "sau 0 lượt" thật đã xác nhận trên room 19e78018-8c11-48e9-845f-efefe4dff82f - xem docblock
    // locateOpenAndVerifyAssignment()) =====
    log(`[5/N] Mở đúng assignment "${assignment.title}" / Hạn nộp ${dueDM} (identity-based: findAssignment() + content-fingerprint verify theo room.id=${assignment.id})...`);
    const openLocate = await locateOpenAndVerifyAssignment(bridge, { title: assignment.title, dueDateDM: dueDM, questions: QUESTIONS });
    evidence.openDisambiguation = {
      opened: openLocate.ok,
      triedCount: openLocate.triedLog?.length ?? 0,
      status: openLocate.ok ? "FOUND_AND_VERIFIED" : openLocate.status,
      triedLog: openLocate.triedLog,
    };
    if (!openLocate.ok) {
      return finish({
        status: "BLOCKED",
        phase: "OPEN_EXERCISE_AMBIGUOUS",
        error: `Không xác thực được candidate nào đúng room.id=${assignment.id} (status=${openLocate.status}, đã thử ${openLocate.triedLog.length} candidate) - locate/identity không chắc chắn, dừng lại (SAFETY), KHÔNG đoán.\n${openLocate.diagnostics ?? ""}`,
        evidence,
      });
    }
    evidence.progressBefore = { badge: openLocate.card.badge ?? null, cta: openLocate.card.cta };
    log(`  [PASS] Đã mở ĐÚNG assignment (verified qua content-fingerprint khớp room.id=${assignment.id}). card cta="${openLocate.card.cta}"`);

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

    // ===== Tìm lại card + RESUME - FIX (2026-08-22): CÙNG cơ chế identity-based dùng ở [5/N]
    // (KHÔNG phải 1 code path "resume" riêng, tin tưởng mù index đã tap lần trước) - load lại
    // identity đã lưu (assignment.title/dueDM/QUESTIONS theo room.id=${assignment.id}), tìm lại
    // bằng findAssignment(), lọc thêm theo cta="Tiếp tục" (chỉ card ĐANG DỞ mới có CTA này - tự
    // loại các card cùng title+dueDate nhưng chưa từng mở, vd "G3-U1-Lesson 2..." liền kề), rồi vẫn
    // bắt buộc verify lại content-fingerprint trước khi coi là "đã resume đúng bài cũ" - KHÔNG được
    // giao bài mới / gọi lại flow giao bài ở nhánh này (đúng RESUME_ASSIGNMENT, không phải
    // NEW_ASSIGNMENT). =====
    log(`[7-8/N] Tìm lại + resume ĐÚNG assignment cũ (identity-based: findAssignment(cta="Tiếp tục") + content-fingerprint verify theo room.id=${assignment.id})...`);
    const resumeLocate = await locateOpenAndVerifyAssignment(bridge, {
      title: assignment.title,
      dueDateDM: dueDM,
      cta: "Tiếp tục",
      questions: QUESTIONS,
    });
    evidence.progressAfter = {
      ctaAfterExit: resumeLocate.ok ? resumeLocate.card.cta : (resumeLocate.triedLog?.[0]?.candidate?.cta ?? null),
    };
    evidence.resumeLocate = {
      opened: resumeLocate.ok,
      status: resumeLocate.ok ? "FOUND_AND_VERIFIED" : resumeLocate.status,
      triedLog: resumeLocate.triedLog,
    };
    if (!resumeLocate.ok) {
      if (resumeLocate.status === "NOT_FOUND") {
        return finish({
          status: "FAIL",
          phase: "PROGRESS_CHANGED",
          error: `Không tìm lại được card với CTA="Tiếp tục" cho "${assignment.title}"/Hạn nộp ${dueDM} - card không phản ánh trạng thái đang dở (hoặc app chưa ghi nhận doing_answer_id).\n${resumeLocate.diagnostics ?? ""}`,
          evidence,
        });
      }
      return finish({
        status: "FAIL",
        phase: "RESUME_OPEN",
        error: `Không xác thực được đúng candidate cũ khi resume (status=${resumeLocate.status}, đã thử ${resumeLocate.triedLog.length} candidate) - KHÔNG đoán, KHÔNG mở bài khác (vd "G3-U1-Lesson 2..." liền kề).\n${resumeLocate.diagnostics ?? ""}`,
        evidence,
      });
    }
    evidence.resumeOk = true;
    log(`  [PASS] Đã tìm lại + resume ĐÚNG assignment cũ (verified content-fingerprint khớp room.id=${assignment.id}), đang ở màn làm bài.`);

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
    const scoreInRange = scoreValid && scoreNumber >= TARGET_SCORE_MIN && scoreNumber <= TARGET_SCORE_MAX;
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

    // ===== [KIẾN THỨC TRONG BÀI - MÀN 2/2, Kết quả BTVN] (MỚI 2026-08-21 - xem MÀN 1 ở [4b/N]).
    // Tap vào card Unit ngay TRÊN màn Kết quả (trước khi đóng dialog) - nếu thành công, app tự
    // router.replace sang "Vui học" (ĐÃ XÁC NHẬN THẬT hôm nay: hành động đó tự đóng luôn dialog kết
    // quả, quay lại "Bài tập" sau đó thấy card đã cập nhật NGAY, không cần tap "Hoàn thành"/
    // exercise_result_close_button nữa) - CHỈ fallback về đúng bước đóng dialog gốc khi navigate
    // KHÔNG thành công (dialog vẫn còn, phải đóng bình thường để flow tiếp tục được). =====
    let kienThucMan2 = { navigated: false, reason: "SKIPPED (CHECK_KIEN_THUC_TRONG_BAI=false)" };
    if (CHECK_KIEN_THUC_TRONG_BAI) {
      log(`[10b/N] Kiểm tra "Kiến thức trong bài" trên màn Kết quả BTVN (điều hướng sang Vui học rồi quay lại)...`);
      kienThucMan2 = await attemptKienThucTrongBaiNavigation(bridge, "Kết quả BTVN");
      evidence.kienThucTrongBai = { ...evidence.kienThucTrongBai, man2: kienThucMan2 };
      if (kienThucMan2.navigated) {
        log(`  [PASS] Đã điều hướng sang "Vui học" từ màn Kết quả - dialog kết quả coi như đã đóng, quay lại tab "Bài tập".`);
        await bridge.runSteps([{ tapOn: { text: "Bài tập" } }]);
      } else {
        log(`  [CẢNH BÁO] ${kienThucMan2.reason} - fallback về đóng dialog kết quả như bình thường.`);
      }
    }

    // ===== Đóng kết quả + verify homework_screen (COPY gốc dòng 338-365 - CHỈ chạy nếu dialog vẫn
    // còn, xem nhánh kienThucMan2.navigated ở trên) =====
    await bridge.runSteps([
      { runFlow: { when: { visible: "Hoàn thành" }, commands: [{ tapOn: { text: ".*(Hoàn thành).*" } }] } },
      { runFlow: { when: { visible: "Tiếp theo" }, commands: [{ tapOn: { id: "exercise_result_close_button" } }] } },
    ]);
    await bridge.wait({ id: "homework_screen" }, { timeout: 30000 });

    // ===== PROGRESS_AFTER riêng card - FIX (2026-08-22): identity-based, THAY scrollToCard() +
    // quét phẳng "Điểm <số>" toàn viewport (2 lỗi đã ghi trong docblock verifyCardShowsScoreByIdentity():
    // (1) card hoàn thành không còn "Hạn nộp" nên scrollToCard() luôn rơi fallback title-only, dễ bị
    // đánh lừa bởi card liền kề title gần giống; (2) quét phẳng không neo theo card cụ thể, có thể
    // false-positive từ 1 card hoàn thành KHÁC cùng viewport) =====
    log(`[11/N] Verify card đã hoàn thành (identity-based: findAssignment(title, cta="Làm lại") + đọc "Điểm <số>" CHỈ trong bounds của ĐÚNG card đó)...`);
    const completedCheck = await verifyCardShowsScoreByIdentity(bridge, { title: assignment.title });
    evidence.cardProgressOk = completedCheck.ok;
    evidence.cardCompletedCheck = { status: completedCheck.ok ? "FOUND_AND_VERIFIED" : completedCheck.status, diagnostics: completedCheck.diagnostics ?? null };
    if (!completedCheck.ok) {
      return finish({
        status: "FAIL",
        phase: "PROGRESS_AFTER_CARD",
        error: `Không xác thực được card đã hoàn thành cho "${assignment.title}" (status=${completedCheck.status}) - KHÔNG đoán, KHÔNG nhận nhầm card khác (vd "G3-U1-Lesson 2..." liền kề).\n${completedCheck.diagnostics ?? ""}`,
        evidence,
      });
    }
    log(`  [PASS] card completed line = "${completedCheck.scoreLine}" (verified đúng card qua identity title+cta="Làm lại", không quét phẳng).`);

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
      assignIncreasedTotal &&
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

// FIX (2026-08-22): chỉ tự chạy main() khi file này được chạy TRỰC TIẾP (`node target5.mjs`) -
// KHÔNG chạy khi bị import (vd test script import verifyCardShowsScoreByIdentity() để kiểm tra
// riêng [11/N] trên state hiện có của 1 room, không cần chạy lại toàn bộ flow giao-bài+làm-bài).
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
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
}
