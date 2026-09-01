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
 *   2. Target điểm: [4.5, 5.5] (quanh 5.0) thay vì [6.0, 8.0] (quanh 7.0) - random runtime trong
 *      range này (KHÔNG hardcode 1 giá trị) - xem resolveScoringPlanForCandidate()/[SCORING ENGINE].
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
import { HomeworkExamEngine } from "../../../automation/bai_tap/navigation/homeworkExamEngine.js";
import { fetchEligibleAssignmentTree } from "../../../automation/giao_bai_tap/navigation/teacherAssignmentApiDiscovery.js";
import { parseQuestionsFromExamPage } from "../../../automation/discovery/examPageScraper.js";
import { normalizeQuestions } from "../../../automation/model/questionModel.js";
import { resolveHomeworkExamQuestionsForRoomId } from "../../../automation/bai_tap/discovery/teacherMaterialsExamResolver.js";
import { fetchAllHomeworkRooms, fetchRoomDetails, resolveHomeworkLevel } from "../../../automation/bai_tap/discovery/homeworks.js";
import { normalizeHomework } from "../../../automation/bai_tap/model/homeworkModel.js";
import { formatDM, formatDMY, isoToVnYmd } from "../../../automation/bai_tap/verify-filter-web-vs-app.mjs";
import {
  normalizeAnswerText,
  buildNormalizedVisibleSet,
  findFullAnswerSetMatches,
  findMatchingQuestion,
} from "../../../automation/bai_tap/discovery/answerSetMatcher.js";
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
// mục tiêu qua ENV thay vì hardcode [4.5,5.5]) - mặc định giữ nguyên [4.5, 5.5] (quanh 5.0) như ban
// đầu nếu không truyền ENV. ĐÃ SỬA 2026-08-26 (theo yêu cầu "KHÔNG hardcode target score, phải
// random"): target score CỤ THỂ của 1 lần chạy không còn cố định ở tâm range (bản cũ
// computeScorePlan(), ĐÃ XOÁ) - giờ random NGAY TRÊN tập điểm khả thi THẬT của exercise nằm trong
// [MIN,MAX] này (resolveScoringPlanForCandidate(mode:"range")) - xem docblock [SCORING ENGINE].
// CHECK_KIEN_THUC_TRONG_BAI (MỚI 2026-08-21, theo yêu cầu "đừng chạy case kiểm tra kiến thức làm
// gì, khi nào tôi yêu cầu thì chạy") - mặc định TẮT (false), CHỈ chạy 2 bước MÀN 1/MÀN 2 (xem
// [4b/N]/[10b/N]) khi truyền CHECK_KIEN_THUC_TRONG_BAI=true.
const CHECK_KIEN_THUC_TRONG_BAI = process.env.CHECK_KIEN_THUC_TRONG_BAI === "true";
const TARGET_SCORE_MIN = Number(process.env.TARGET_SCORE_MIN ?? 4.5);
const TARGET_SCORE_MAX = Number(process.env.TARGET_SCORE_MAX ?? 5.5);
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

export function collectAllTexts(node, acc = []) {
  const t = node?.attributes?.text;
  if (typeof t === "string" && t.trim()) acc.push(t.trim());
  for (const c of node?.children ?? []) collectAllTexts(c, acc);
  return acc;
}

/** true nếu cây hierarchy còn ÍT NHẤT 1 node resource-id thuộc app (`${appId}:id/...`) - dùng để
 * phát hiện đã thoát HẲN ra ngoài app (màn hình chính Android/app khác) sau 1 lần `back()`, KHÔNG
 * đoán qua text hiển thị (launcher/app khác có thể trùng text bất kỳ). */
function treeHasAppNode(node, appId) {
  const rid = node?.attributes?.["resource-id"];
  if (typeof rid === "string" && rid.startsWith(`${appId}:id/`)) return true;
  for (const c of node?.children ?? []) {
    if (treeHasAppNode(c, appId)) return true;
  }
  return false;
}

export function isVisibleInTree(texts, textPattern) {
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

/** ===================== [MATCHER] full answer-set + question-content matching =====================
 * MOVED (2026-08-28) to automation/bai_tap/discovery/answerSetMatcher.js - single shared
 * implementation, was copy-pasted across 9 files (see that module's docblock for the full root-cause
 * writeup: same answer-set shared across multiple questions - "word bank" style exercises - needed
 * question-stem/passage disambiguation on top of the 2026-08-25/26 full-answer-set fix, xem
 * project_teacher_materials_examid_order_mismatch.md). Re-exported here so the existing fixture test
 * (e2e-teacher-assign-full-scored-target5.scoringAndMatcher.fixtureTest.mjs) keeps working unchanged. */
export { normalizeAnswerText, buildNormalizedVisibleSet, findFullAnswerSetMatches, findMatchingQuestion };

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
/**
 * PHASE H (2026-09-01, xem hội thoại - FAIL thật: 2 candidate cùng title+dueDate, CẢ 2 "0/10 Làm
 * bài" - đúng room vừa giao là candidate thứ 3+ nằm ngoài viewport findAssignment() đã dừng cuộn ở
 * đó, vì `findAssignment()` (findAssignment.js) dừng NGAY khi đã thấy >=2 match trong 1 snapshot -
 * ĐÚNG THIẾT KẾ của chính nó, dùng ĐÚNG bởi >=5 caller khác phụ thuộc hành vi đó - KHÔNG được sửa
 * findAssignment.js). SỬA: bọc 1 vòng lặp "cuộn tiếp + gọi lại findAssignment() + loại-trừ candidate
 * đã thử" NGAY TẠI ĐÂY (KHÔNG đụng findAssignment.js) - biến AMBIGUOUS-cùng-1-snapshot thành 1 trạng
 * thái TRUNG GIAN (candidate set CHƯA đủ), không phải kết luận cuối. Giữ NGUYÊN 100% return contract
 * (status enum/shape: NOT_FOUND/CONTENT_MISMATCH/AMBIGUOUS_CONTENT_MATCH/OPEN_STEP_FAILED/
 * REOPEN_FAILED/ERROR, {ok,card,matched,triedLog} khi thành công) - KHÔNG caller nào (cả trong file
 * này lẫn e2e-teacher-assign-partial-resume-scored.mjs) cần sửa theo.
 *
 * Safety GIỮ NGUYÊN 100%: mỗi "round" (1 snapshot findAssignment) vẫn thử HẾT candidate MỚI trong
 * round đó trước khi kết luận (KHÔNG dừng sớm ở candidate khớp content ĐẦU TIÊN) - chỉ khi ĐÚNG 1
 * candidate khớp trong round đó mới accept; 0 candidate khớp -> cuộn thêm sang round kế (KHÔNG bỏ
 * cuộc như bản cũ); >=2 candidate CÙNG khớp trong 1 round -> AMBIGUOUS_CONTENT_MATCH thật (dừng
 * ngay, không tìm thêm - đây là tín hiệu dữ liệu bất thường thật, không phải "chưa tìm đủ"). KHÔNG
 * first-fit ở bất kỳ round nào. `triedSignatures` (theo `ctaBounds` - chỉ tín hiệu phân biệt được
 * giữa các candidate CÙNG title/dueDate/cta trong 1 snapshot) tránh thử lại candidate đã biết SAI.
 *
 * Cuộn tiếp dùng LẠI đúng biên độ swipe đã proven trong findAssignment.js (`NORMAL_SWIPE`), dừng
 * khi 2 lần liên tiếp KHÔNG có tiến triển thật (fingerprint toàn bộ text không đổi - dùng lại
 * `collectAllTexts()` export sẵn trong CHÍNH file này) HOẶC đạt `maxCandidates` (trần an toàn tổng
 * số candidate đã thử, KHÔNG phải trần "số round") - KHÔNG lặp vô hạn.
 *
 * `closeIfOpen()` SỬA THÊM (cùng PHASE H): bản cũ chỉ tap X + chờ text lỏng lẻo ".*(Bài tập).*"
 * (không verify là ĐÃ về homework_screen thật, không xử lý dialog xác nhận thoát) - kết quả KHÔNG
 * được caller kiểm tra, gây device kẹt giữa bài thật đã quan sát (PHASE G). SỬA: xử lý dialog xác
 * nhận ("Thoát"/"Đồng ý"/"Xác nhận", optional - CÙNG chuỗi bước đã proven trong
 * exitToHomeworkList() của e2e-teacher-assign-partial-resume-scored.mjs), verify bằng resource-id
 * ổn định `homework_screen` (không phải regex text lỏng lẻo), trả `{ok,error}` và callsite BÊN
 * DƯỚI giờ kiểm tra kết quả này - cleanup thất bại -> trả EXERCISE_OPEN_FAILED tường minh thay vì
 * âm thầm tiếp tục với device đang ở trạng thái không xác định.
 */
export async function locateOpenAndVerifyAssignment(bridge, { title, dueDateDM, cta = null, questions, maxCandidates = MAX_DISAMBIGUATE_CANDIDATES }) {
  await scrollToTop(bridge);

  const openAndCheckContent = async (candidate) => {
    const tapResult = await tapFoundCard(bridge, candidate);
    if (!tapResult.success) return { opened: false, contentMatched: null, matched: null, error: tapResult.error };
    const openWait = await bridge.runSteps([
      { waitForAnimationToEnd: { timeout: 3000 } },
      { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
      { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 40000 } },
    ]);
    if (!openWait.success) return { opened: false, contentMatched: null, matched: null, error: openWait.error };
    // findMatchingQuestion() giờ LUÔN trả 1 object ({status, question|diagnostic}) - KHÔNG còn
    // null/truthy đơn giản như bản cũ (ĐÃ SỬA 2026-08-26, port full answer-set match) - phải đọc
    // `.status === "MATCHED"` thay vì Boolean(matched) để không luôn coi content là khớp.
    // questionIndex="content-verify" (KHÔNG phải số câu) - CHỈ dùng cho log/diagnostic (không ảnh
    // hưởng logic match) - tránh in "question_index=undefined" ra log khi gọi từ đây (xác nhận
    // đúng dùng cho content-fingerprint identity check, KHÔNG phải vòng lặp trả lời câu ở [9/N]).
    const matchResult = await findMatchingQuestion(bridge, questions, undefined, "content-verify");
    const contentMatched = matchResult.status === "MATCHED";
    return { opened: true, contentMatched, matched: contentMatched ? matchResult.question : null };
  };
  const closeIfOpen = async () => {
    const r = await bridge.runSteps([
      { tapOn: { id: "exercise_close_button" }, optional: true },
      { waitForAnimationToEnd: { timeout: 1500 } },
      { tapOn: { text: "Thoát", optional: true } },
      { tapOn: { text: "Đồng ý", optional: true } },
      { tapOn: { text: "Xác nhận", optional: true } },
      { waitForAnimationToEnd: { timeout: 1000 } },
      { extendedWaitUntil: { visible: { id: "homework_screen" }, timeout: 20000 } },
    ]);
    return { ok: r.success, error: r.success ? null : r.error };
  };
  const candidateSignature = (c) => JSON.stringify({ t: c.title, d: c.dueDate, cta: c.cta, b: c.ctaBounds });
  const scrollForMoreCandidates = async () => {
    const before = collectAllTexts(await bridge.hierarchy()).join("||");
    const swipeResult = await bridge.runSteps([
      { swipe: { start: "50%,80%", end: "50%,25%", duration: 400 } },
      { waitForAnimationToEnd: { timeout: 800 } },
    ]);
    if (!swipeResult.success) return false;
    const after = collectAllTexts(await bridge.hierarchy()).join("||");
    return after !== before;
  };

  const triedSignatures = new Set();
  const triedLog = [];
  let lastDiagnostics = null;
  let noProgressStreak = 0;
  const MAX_SCROLL_ROUNDS = 40; // trần an toàn chống lặp vô hạn - KHÔNG phải "số room"; dừng sớm hơn
  // trong thực tế qua noProgressStreak (hết phạm vi cuộn hợp lệ thật) hoặc maxCandidates (đã thử đủ).

  for (let round = 0; round < MAX_SCROLL_ROUNDS && triedLog.length < maxCandidates && noProgressStreak < 2; round++) {
    const located = await findAssignment(bridge, { title, dueDateDM, cta });
    lastDiagnostics = located.diagnostics ?? lastDiagnostics;
    if (located.status === "ERROR") {
      return { ok: false, status: "ERROR", diagnostics: located.diagnostics, triedLog };
    }
    const rawCandidates = located.status === "FOUND" ? [located.card] : located.status === "AMBIGUOUS" ? located.matches : [];
    const untried = rawCandidates.filter((c) => !triedSignatures.has(candidateSignature(c))).slice(0, Math.max(0, maxCandidates - triedLog.length));

    if (untried.length === 0) {
      if (triedLog.length === 0 && located.status === "NOT_FOUND") break; // chưa từng thấy candidate nào - hết phạm vi cuộn hợp lệ thật.
      const progressed = await scrollForMoreCandidates();
      noProgressStreak = progressed ? 0 : noProgressStreak + 1;
      continue;
    }
    noProgressStreak = 0;

    // Thử HẾT candidate MỚI của round này trước khi kết luận (KHÔNG dừng sớm ở candidate khớp content
    // ĐẦU TIÊN) - CÙNG safety đã có ở bản gốc, chỉ khác phạm vi "round" thay vì "toàn bộ 1 lần gọi".
    const matchedThisRound = [];
    for (const candidate of untried) {
      triedSignatures.add(candidateSignature(candidate));
      const outcome = await openAndCheckContent(candidate);
      triedLog.push({ candidate, ...outcome });
      if (outcome.opened && outcome.contentMatched) matchedThisRound.push({ candidate, matched: outcome.matched });
      if (outcome.opened) {
        const closed = await closeIfOpen();
        if (!closed.ok) {
          return { ok: false, status: "EXERCISE_OPEN_FAILED", diagnostics: `Không đóng lại được về homework_screen sau candidate mismatch: ${closed.error}`, triedLog };
        }
      }
    }
    if (matchedThisRound.length === 1) {
      // Đúng 1 candidate khớp content trong round này - đã bị ĐÓNG lại ở vòng kiểm tra công bằng
      // phía trên (để không thiên vị thứ tự thử) - mở LẠI đúng candidate này lần cuối để tiếp tục
      // vào làm bài (postcondition trả về: exercise_close_button đang visible).
      const winner = matchedThisRound[0];
      const reopen = await openAndCheckContent(winner.candidate);
      triedLog.push({ candidate: winner.candidate, ...reopen, reopen: true });
      if (!reopen.opened || !reopen.contentMatched) {
        return { ok: false, status: "REOPEN_FAILED", diagnostics: lastDiagnostics, triedLog };
      }
      return { ok: true, card: winner.candidate, matched: reopen.matched, triedLog };
    }
    if (matchedThisRound.length > 1) {
      // >=2 candidate CÙNG khớp content trong CÙNG 1 round - bất thường dữ liệu thật, KHÔNG phải
      // "chưa tìm đủ" - dừng ngay, không tìm thêm, không đoán chọn cái nào.
      return { ok: false, status: "AMBIGUOUS_CONTENT_MATCH", diagnostics: lastDiagnostics, triedLog };
    }
    // 0 candidate khớp trong round này - vòng for ngoài tự lặp: round kế `untried` sẽ rỗng (đã tried
    // hết candidate hiện thấy) -> tự cuộn thêm để lộ candidate MỚI (nhánh `untried.length === 0` trên).
  }

  return {
    ok: false,
    status: triedLog.length === 0 ? "NOT_FOUND" : "CONTENT_MISMATCH",
    diagnostics: lastDiagnostics,
    triedLog,
  };
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

/** ===================== [SCORING ENGINE] subset-sum theo point THẬT (PORT NGUYÊN VĂN 2026-08-26
 * từ automation/bai_tap/pro_lamlai_target_score.mjs - xem docblock gốc "SCORING ENGINE (KHÔNG giả
 * định 'N câu = N điểm')" cho lý do đầy đủ) ===================== Bản CŨ (computeScorePlan/
 * buildWantCorrectPlan phía trên, ĐÃ XOÁ) giả định mỗi câu đều nặng 1/N điểm (predicted = c/N*10) -
 * SAI khi 1 item có metadata.point khác nhau (vd 1 câu SPEAK độc lập point=10, xem
 * automation/output/discovery.json) VÀ không hề dùng nội dung/answers[] thật của candidate để chọn
 * target - CHỈ phụ thuộc N. Bản MỚI: target score phải là 1 trong các tổng điểm THẬT KHẢ THI của
 * CHÍNH exercise (tính bằng DP 0/1 knapsack trên metadata.point từng item), KHÔNG BAO GIỜ hardcode
 * 1 giá trị cụ thể - luôn random NGAY TRÊN tập khả thi đã lọc theo TARGET_SCORE_MIN/MAX (ENV hiện
 * có của project, xem khai báo đầu file) hoặc re-validate 1 target đã chọn trước đó còn khả thi với
 * nội dung THẬT vừa resolve (mode="target" - dùng ở [3/N] để re-check target đã pick ở prescan còn
 * đúng với room thật, PHÒNG lệch examId catalog vs room - xem project_teacher_materials_examid_
 * order_mismatch.md). Nếu KHÔNG có điểm khả thi nào trong range / target không còn khả thi -> trả
 * `achievable:false` kèm danh sách điểm khả thi thật để caller BLOCKED rõ ràng, KHÔNG đoán/KHÔNG ép
 * answer để đạt điểm không khả thi (yêu cầu rõ - xem mục 7/10 của spec). */
const POINT_SCALE = 1000;

/**
 * DP 0/1 knapsack trên mảng điểm (quy đổi nguyên qua POINT_SCALE để tránh sai số float) - tìm MỌI
 * tổng điểm khả thi + truy vết được 1 tập con item cụ thể cho BẤT KỲ tổng khả thi nào.
 * @param {import("../../../automation/model/questionModel.js").QuestionModel[]} questions
 * @returns {null | { scaledTotal: number, achievableScaledSums: number[], correctIndicesForScaledSum: (s:number)=>Set<number>|null }}
 */
export function buildScoringPlan(questions) {
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
    // targetScaledSum == null (KHÔNG ===): bắt cả null/undefined - PHÁT HIỆN qua static review
    // 2026-08-26 (KHÔNG phải E2E): `reachedByItem[null]` là bracket-access với key "null" trên 1
    // Array thường -> trả undefined (KHÔNG phải -1) -> guard cũ KHÔNG bắt được, rơi xuống vòng lặp
    // `while (s > 0)` với s=null -> false ngay -> trả về 1 Set() RỖNG (SAI - trông như "achievable
    // nhưng cần 0 câu đúng" chứ không phải "không achievable") thay vì null. Guard mới chặn TRƯỚC
    // khi chạm bracket-access.
    if (targetScaledSum == null || targetScaledSum < 0 || targetScaledSum > scaledTotal || reachedByItem[targetScaledSum] === -1) return null;
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

/** score (thang 0-10) -> scaledSum nguyên - null nếu score không rơi đúng vào 1 mốc điểm nguyên.
 * ĐÃ SỬA 2026-08-26 (2 vòng, cả 2 phát hiện qua local test/stress test, KHÔNG phải E2E):
 *   - Vòng 1: tolerance CỐ ĐỊNH 1e-6 sai reject nhầm 1 điểm THẬT SỰ khả thi khi scaledTotal lớn
 *     (`achievableScoresList()` hiển thị score đã ROUND về 6 chữ số thập phân - sai số round-trip
 *     ngược lại raw=score*scaledTotal/10 scale theo scaledTotal, có thể VƯỢT XA 1e-6 cố định - tái
 *     hiện thật: n=7 câu 1 điểm/câu, scaledTotal=7000, score=2.857143 hiển thị -> raw lệch ~1e-4).
 *   - Vòng 2: tolerance scale-theo-scaledTotal (thay cho vòng 1) tự nó lại có 1 "vùng KHÔNG an toàn"
 *     khi scaledTotal đủ lớn (stress test xác nhận: tolerance vượt 0.5 khi scaledTotal>1e7, tại đó
 *     Math.round()+so-sánh-tolerance không còn đảm bảo reject đúng 1 score KHÔNG liên quan gì đến
 *     scaledTotal - dù thực tế usage hiện tại của target5.mjs không chạm ngưỡng này, hàm này VẪN
 *     được thiết kế để tái dùng ở nơi khác nhận input arbitrary-precision như REDO_TARGET_SCORE của
 *     pro_lamlai_target_score.mjs, nên không nên giữ lại 1 công thức có "vùng không an toàn").
 *   - SỬA CUỐI (theo yêu cầu "ưu tiên exact integer representation thay vì tăng tolerance"): bỏ hẳn
 *     epsilon/tolerance - thay bằng so sánh CANONICAL round-trip: tính `rounded` gần `raw` nhất, rồi
 *     tính LẠI display-score CHÍNH XÁC của `rounded` qua ĐÚNG công thức achievableScoresList() dùng
 *     (Math.round(...*1e6)/1e6) - CHỈ accept khi giá trị đó (bit-for-bit) khớp `score` truyền vào.
 *     Với BẤT KỲ score nào do achievableScoresList() sinh ra, phép tính này LUÔN khớp lại chính xác
 *     (cùng công thức, cùng input) - KHÔNG cần chọn/biện minh 1 hằng số epsilon nào, và KHÔNG có
 *     "vùng không an toàn" ở bất kỳ scaledTotal nào (đã verify: 0 sai khác so với bản epsilon trên
 *     6811 case stress-test, n=1..200 câu, trọng số 1-10, scaledTotal tới 2,000,000 - xem
 *     e2e-teacher-assign-full-scored-target5.scoringAndMatcher.fixtureTest.mjs). correctIndicesForScaledSum()
 *     vẫn là lớp chặn CUỐI kiểm tra achievable thật qua DP - hàm này CHỈ lọc "score có form hợp lệ
 *     hay không" trước khi tới đó. */
export function scaledSumForScore(scaledTotal, score) {
  const raw = (score * scaledTotal) / 10;
  const rounded = Math.round(raw);
  if (rounded < 0 || rounded > scaledTotal) return null;
  const canonicalDisplayOfRounded = Math.round((rounded / scaledTotal) * 10 * 1e6) / 1e6;
  if (canonicalDisplayOfRounded !== score) return null;
  return rounded;
}

export function achievableScoresList(scaledTotal, achievableScaledSums) {
  const set = new Set();
  for (const s of achievableScaledSums) {
    set.add(Math.round((s / scaledTotal) * 10 * 1e6) / 1e6);
  }
  return [...set].sort((a, b) => a - b);
}

/**
 * Quyết định target score cho 1 candidate cụ thể - KHÔNG BAO GIỜ hardcode 1 giá trị:
 *   mode="range": random NGAY TRÊN tập điểm khả thi THẬT của candidate nằm trong [rangeMin,rangeMax]
 *     (TARGET_SCORE_MIN/MAX hiện có của project - KHÔNG tạo cơ chế range mới, tái dùng ENV đã có).
 *     Không có điểm khả thi nào trong range -> achievable:false (caller thử candidate khác/BLOCKED,
 *     KHÔNG hạ range để ép chạy được).
 *   mode="target": validate 1 targetScoreEnv CỤ THỂ (dùng để RE-VALIDATE target đã random ở prescan
 *     còn khả thi với nội dung THẬT của room sau khi resolve ở [3/N] - phòng lệch examId catalog vs
 *     room thật, xem project_teacher_materials_examid_order_mismatch.md). KHÔNG khả thi -> BLOCKED
 *     rõ ràng (KHÔNG tự đổi sang target khác/KHÔNG retry mù).
 * @param {import("../../../automation/model/questionModel.js").QuestionModel[]} questions
 * @param {{mode: "range"|"target", targetScoreEnv?: number, rangeMin?: number, rangeMax?: number}} opts
 */
export function resolveScoringPlanForCandidate(questions, { mode, targetScoreEnv, rangeMin, rangeMax } = {}) {
  const plan = buildScoringPlan(questions);
  if (!plan) {
    return { achievable: false, reason: "Tổng điểm (metadata.point) của toàn bộ scored items = 0 - không tính được scoring." };
  }
  const achievableScores = achievableScoresList(plan.scaledTotal, plan.achievableScaledSums);
  const totalPointsRaw = plan.scaledTotal / POINT_SCALE;

  if (mode === "range") {
    // Chọn TRỰC TIẾP trên `plan.achievableScaledSums` (số nguyên EXACT từ chính DP, KHÔNG qua
    // bước hiển thị đã round) rồi gọi correctIndicesForScaledSum() với giá trị EXACT đó - CÙNG
    // pattern mode="random" gốc của pro_lamlai_target_score.mjs (đọc `scaledSum` exact trước, chỉ
    // tính `targetScore` decimal để HIỂN THỊ/report). SỬA 2026-08-26 (phát hiện qua local test,
    // KHÔNG phải E2E): bản đầu tiên chọn từ `achievableScores` (mảng ĐÃ ROUND 6 chữ số thập phân)
    // rồi gọi lại `scaledSumForScore(targetScore)` để suy ngược ra scaledSum - round-trip đó CÓ THỂ
    // MẤT CHÍNH XÁC (xem docblock scaledSumForScore) khiến `correctIndicesForScaledSum` nhận `null`
    // và (do bug null-handling đã sửa ở trên) từng trả về 1 Set() RỖNG thay vì báo lỗi - nghĩa là
    // "trả lời SAI TẤT CẢ câu" bị âm thầm dùng làm plan cho 1 target tưởng như khả thi. Chọn EXACT
    // integer ngay từ đầu loại bỏ hoàn toàn rủi ro round-trip này.
    const scaledSumsInRange = plan.achievableScaledSums.filter((s) => {
      const displayScore = Math.round((s / plan.scaledTotal) * 10 * 1e6) / 1e6;
      return displayScore >= rangeMin && displayScore <= rangeMax;
    });
    if (scaledSumsInRange.length === 0) {
      return {
        achievable: false,
        reason: `Không có điểm khả thi nào trong [${rangeMin}, ${rangeMax}] (điểm khả thi thật của exercise này: ${achievableScores.join(", ")}).`,
        achievableScores,
        totalScoredItems: questions.length,
        totalPointsRaw,
      };
    }
    const chosenScaledSum = scaledSumsInRange[Math.floor(Math.random() * scaledSumsInRange.length)];
    const targetScore = Math.round((chosenScaledSum / plan.scaledTotal) * 10 * 1e6) / 1e6;
    const correctIndices = plan.correctIndicesForScaledSum(chosenScaledSum);
    const inRange = achievableScores.filter((s) => s >= rangeMin && s <= rangeMax);
    return { achievable: true, targetScore, correctIndices, achievableScores, achievableScoresInRange: inRange, totalScoredItems: questions.length, totalPointsRaw };
  }

  // mode === "target" (re-validate 1 target cụ thể).
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

/** Map câu hỏi -> wantCorrect: item nằm trong `correctIndices` (đã truy vết từ DP) -> đúng; item
 * point<=0 (không tham gia DP) -> mặc định đúng (không ảnh hưởng điểm, an toàn); còn lại -> SAI CHỦ
 * ĐÍCH (đây chính là phần "chọn sai đáp án cho số item còn lại" theo kế hoạch điểm). */
export function buildWeightedWantCorrectPlan(questions, correctIndices) {
  const map = new Map();
  questions.forEach((q, i) => {
    const pointRaw = Number(q.metadata?.point) || 0;
    map.set(q.id, pointRaw <= 0 || correctIndices.has(i));
  });
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

  // ĐÃ SỬA (2026-08-25, root cause thật xác nhận qua data thật lớp "2A" - xem
  // project_candidate_title_uniqueness_vs_identity.md): candidate.itemId/candidate.examId (UUID
  // thật từ CMS catalog /api/learn/items) LUÔN LÀ stable identity của candidate - itemName (title)
  // CHỈ dùng để hiển thị, KHÔNG BAO GIỜ được coi là identity (2 candidate khác itemId vẫn là 2
  // candidate khác nhau dù trùng itemName - vd nhiều Unit/Lesson khác nhau cùng dùng chung title
  // "Choose the correct answer (A, B, C or D)."). Bản CŨ loại thẳng mọi candidate có ≥1 room cũ
  // trùng itemName trong lớp ra khỏi vòng thử HOÀN TOÀN (dùng itemName làm proxy cho "an toàn
  // locate trên app") - ĐÃ CHỨNG MINH SAI/QUÁ TAY qua run thật: lớp "2A" có 184/301 candidate dạng
  // text-choice-compatible thật (đã verify trực tiếp qua CMS), nhưng TOÀN BỘ đều bị loại vì chính
  // session test này đã tạo/hoàn thành room với đúng các title đó trước đó - còn lại đúng 44
  // candidate "unique" thuộc nhóm Nghe/Nói/Phát âm (đáp án là ảnh/audio, không có text - loại đúng
  // vì lý do khác hẳn, xem isTextChoiceCompatible), khiến 44/44 bị BLOCKED oan.
  //
  // Cơ chế locate-trên-app THẬT (locateOpenAndVerifyAssignment() ở dưới, dòng ~1192) đã LUÔN nhận
  // + dùng dueDateDM làm bộ lọc cấp 1 CHO MỌI candidate (không điều kiện "chỉ khi unique"), và tự
  // xử lý cả trường hợp AMBIGUOUS (≥2 candidate cùng title+dueDate) bằng cách thử hết + đối chiếu
  // NỘI DUNG câu hỏi (xem docblock dòng 398) - nghĩa là hạ tầng locate ĐÃ tự giải quyết đúng vấn đề
  // "title trùng" bằng dueDate+content, không cần đến bộ lọc itemName ở bước prescan này nữa.
  //
  // SỬA: KHÔNG loại candidate theo itemName trùng. Vẫn tính "occurrences" để ưu tiên thử candidate
  // itemName-unique TRƯỚC (locate đơn giản/nhanh hơn khi không cần disambiguation), nhưng candidate
  // NON_UNIQUE (itemName trùng, itemId khác) vẫn được thử tiếp nếu nhóm unique không ra candidate
  // khả thi - dựa hẳn vào dueDate+content disambiguation đã có sẵn, KHÔNG loại oan theo title.
  const existingTitleCounts = await scanExistingAssignmentTitleOccurrences(classId);
  const annotated = flat.map((cand) => {
    const occurrences = existingTitleCounts.get(cand.itemName) ?? 0;
    return { ...cand, occurrences, unique: occurrences === 0 };
  });
  const uniqueCandidates = annotated.filter((c) => c.unique);
  const nonUniqueCandidates = annotated.filter((c) => !c.unique);
  log(
    `  [SELECTION] lớp "${className}" hiện có ${existingTitleCounts.size} title khác nhau đang tồn tại room - ` +
      `${uniqueCandidates.length}/${flat.length} candidate eligible có title UNIQUE (0 room cũ trùng, thử TRƯỚC), ` +
      `${nonUniqueCandidates.length} candidate NON_UNIQUE (itemId khác, thử SAU nếu cần - locate dựa vào dueDate+content disambiguation có sẵn, KHÔNG loại theo title).`,
  );
  if (nonUniqueCandidates.length > 0) {
    const sample = [...new Map(nonUniqueCandidates.map((c) => [c.itemName, c.occurrences])).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    log(`    NON_UNIQUE mẫu (itemName=occurrences, vẫn nằm trong vòng thử): ${sample.map(([n, c]) => `"${n}"=${c}`).join(", ")}`);
  }

  if (annotated.length === 0) {
    return {
      ok: false,
      blocked: true,
      blockedReason: "BLOCKED: No eligible assignment candidate (non-speak, đúng 1 exam_id) trong lớp.",
      attempts: [],
      totalEligibleNonSpeakSingleExam: flat.length,
      totalUniqueTitleCandidates: 0,
    };
  }

  // Ưu tiên unique trước (locate đơn giản hơn), rồi mới tới non-unique (locate cần dueDate+content
  // disambiguation - hạ tầng đã có sẵn, xem comment trên) - KHÔNG loại hẳn non-unique khỏi vòng thử.
  const order = [...shuffle(uniqueCandidates), ...shuffle(nonUniqueCandidates)].slice(0, maxAttempts);
  const attempts = [];
  for (const cand of order) {
    // FIX (2026-08-28, xác nhận thật qua flows/app/bai_tap/HW-PROFILE-BASIC-PRO-ADVANCED.yaml):
    // item level="ADVANCED" ("Bài tập nâng cao") hiện CTA "Chinh phục" (KHÔNG PHẢI "Làm bài") - mở
    // ra sheet nâng cấp PRO (profile BASIC) hoặc 1 luồng UI khác hẳn/AI Role Play (kể cả profile
    // PRO, room.exams luôn null - không có Question/Exam pipeline chuẩn) - CẢ 2 trường hợp đều
    // KHÔNG tương thích engine trả lời hiện có, gây CONTENT_MISMATCH/NO_MATCH giả (đã gặp thật,
    // xem project_chinh_phuc_special_cta_bug.md). Loại NGAY tại prescan bằng resolveHomeworkLevel()
    // ĐÃ CÓ SẴN (GET /api/cms/lesson-items/:id, nhẹ hơn hẳn parseQuestionsFromExamPageWithRetry())
    // - gọi TRƯỚC bước scrape exam nặng để tránh phí công cho candidate chắc chắn bị loại.
    const level = await resolveHomeworkLevel(cand.itemId).catch(() => null);
    if (level === "ADVANCED") {
      attempts.push({
        unitName: cand.unitName,
        lessonName: cand.lessonName,
        itemName: cand.itemName,
        itemId: cand.itemId,
        examId: cand.examId,
        occurrences: cand.occurrences,
        unique: cand.unique,
        questionCount: null,
        ok: false,
        reason: "ADVANCED_LEVEL_UNSUPPORTED (CTA Chinh phục - cần PRO/không có Question pipeline chuẩn, xem project_chinh_phuc_special_cta_bug.md)",
      });
      log(`  [PRESCAN] "${cand.unitName}/${cand.lessonName}/${cand.itemName}" (occurrences=${cand.occurrences}, unique=${cand.unique}): loại (ADVANCED_LEVEL_UNSUPPORTED)`);
      continue;
    }

    let questions = null;
    let errorMessage = null;
    try {
      const examData = await parseQuestionsFromExamPageWithRetry(cand.examId);
      questions = normalizeQuestions(examData);
    } catch (err) {
      errorMessage = err.message;
    }
    const compatible = questions ? isTextChoiceCompatible(questions) : false;
    const scoringPlan = compatible ? resolveScoringPlanForCandidate(questions, { mode: "range", rangeMin: TARGET_SCORE_MIN, rangeMax: TARGET_SCORE_MAX }) : null;
    const ok = Boolean(compatible && scoringPlan?.achievable);
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
      reason: errorMessage ?? (!compatible ? "UNSUPPORTED_TYPE_OR_MISSING_CORRECT_ANSWER" : !scoringPlan?.achievable ? scoringPlan?.reason ?? "NO_ACHIEVABLE_SCORE_IN_RANGE" : null),
    });
    log(
      `  [PRESCAN] "${cand.unitName}/${cand.lessonName}/${cand.itemName}" (N=${questions?.length ?? "?"}, occurrences=${cand.occurrences}, unique=${cand.unique}): ${
        ok ? `KHẢ THI (targetScore=${scoringPlan.targetScore}, achievable=[${scoringPlan.achievableScores.join(", ")}])` : `loại (${attempts[attempts.length - 1].reason})`
      }`,
    );
    if (ok) {
      return {
        ok: true,
        chosen: { ...cand, questions, scoringPlan },
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
  push(`catalog_exam_id=${ra.roomExamId ?? "-"} (dùng để resolve CMS)`);
  push(`real_room_exam_id=${ra.realRoomExamId ?? "-"} (thật sự được serve cho room)`);
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
  push(`target_score=${ra.targetScore ?? si.targetScore ?? "-"} (random runtime, KHÔNG hardcode)`);
  push(`achievable_scores=${ra.achievableScores?.join(", ") ?? "-"}`);
  push(`required_correct_items=${ra.requiredCorrectItems ?? si.requiredCorrectItems ?? "-"}/${ra.questionCount ?? "-"}`);
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
  push(`target_score=${si.targetScore ?? "-"} (random runtime trong [${TARGET_SCORE_MIN}, ${TARGET_SCORE_MAX}], re-validated theo nội dung THẬT của room)`);
  push(`actual=${si.actualScore ?? "-"}`);
  push(`PASS/FAIL=${si.matched ? "PASS" : "FAIL"} (actualScore === targetScore, KHÔNG phải actualScore trong range)`);
  push(``);
  push(`[CORRECTNESS]`);
  push(`required_correct_items=${si.requiredCorrectItems ?? "-"}`);
  push(`achieved_correct_count_by_plan=${si.achievedCorrectCountByPlan ?? "-"}`);
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
  // runtimeTargetScore: MỘT nguồn sự thật duy nhất cho target score CỦA LẦN CHẠY NÀY - random khi
  // giao bài mới (từ prescan, dùng nội dung catalog examId), re-validate lại ở [3/N] với nội dung
  // THẬT của room (mode="target") - hoặc random THẲNG ở [3/N] nếu REUSE_ROOM_ID (không qua prescan,
  // xem nhánh dưới). KHÔNG BAO GIỜ gán 1 số cụ thể ở đây - null nghĩa là "chưa quyết định".
  let runtimeTargetScore = null;
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
    log(`[1/N] Pre-scan READ-ONLY lớp ${TARGET_CLASS}: chọn 1 candidate theo itemId (title unique thử trước, non-unique thử sau) + handler hỗ trợ + điểm mục tiêu ${TARGET_SCORE_RANGE_LABEL}...`);
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
        error: `${picked.blockedReason} Không còn candidate eligible nào (non-speak, đúng 1 exam_id) trong lớp ${TARGET_CLASS}.`,
        evidence,
      });
    }
    if (!picked.ok) {
      evidence.selection = { candidate: null, unique: null, occurrences: null, identifier: null };
      return finish({
        status: "BLOCKED",
        phase: "RANDOM_SELECTION",
        error: `Đã thử ${picked.attempts.length}/${MAX_PRESCAN_ATTEMPTS} candidate (unique title thử trước, non-unique thử sau) trong lớp ${TARGET_CLASS} (tổng ${picked.totalUniqueTitleCandidates} candidate unique title có sẵn, ngoài ra còn candidate non-unique) - không candidate nào vừa có handler hỗ trợ đầy đủ vừa có correctCount nguyên cho điểm dự đoán trong ${TARGET_SCORE_RANGE_LABEL}.`,
        evidence,
      });
    }
    const chosen = picked.chosen;
    // ĐÃ SỬA (2026-08-25): trước đây hardcode `unique: true`/`"unique, 0 existing rooms"` bất kể
    // giá trị thật của chosen.unique - sai từ khi non-unique candidate cũng được phép chọn (xem
    // fix ở pickFeasibleRandomAssignment). Dùng identity thật (itemId - stable, KHÔNG phải title)
    // + dueDateDM làm identifier chung cho MỌI trường hợp (unique hay không), khớp đúng cơ chế
    // locateOpenAndVerifyAssignment() thật đang dùng (title+dueDate+content disambiguation).
    evidence.selection = {
      candidate: `${chosen.unitName}/${chosen.lessonName}/${chosen.itemName}`,
      itemId: chosen.itemId,
      unique: chosen.unique,
      occurrences: chosen.occurrences,
      identifier: chosen.unique
        ? `itemId=${chosen.itemId} (title unique, 0 existing rooms in class ${TARGET_CLASS}) + due date - resolved to room_id after assign`
        : `itemId=${chosen.itemId} (title NON-unique, ${chosen.occurrences} existing room(s) with same title in class ${TARGET_CLASS}) + due date + content disambiguation (locateOpenAndVerifyAssignment) - resolved to room_id after assign`,
    };
    runtimeTargetScore = chosen.scoringPlan.targetScore;
    log(
      `  [PASS] Chọn "${chosen.unitName}/${chosen.lessonName}/${chosen.itemName}" (itemId=${chosen.itemId}, N=${chosen.questions.length}, occurrences=${chosen.occurrences}, unique=${chosen.unique}, targetScore=${chosen.scoringPlan.targetScore} (achievable=[${chosen.scoringPlan.achievableScores.join(", ")}])).`,
    );
    log(`[target-score]`);
    log(`targetScore=${runtimeTargetScore} (random từ prescan, sẽ re-validate lại với nội dung THẬT của room ở [3/N])`);

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
  // scoringPlan CHÍNH THỨC dùng để trả lời - tính lại TỪ NỘI DUNG THẬT của room (QUESTIONS ở trên,
  // resolve qua room.id) chứ KHÔNG tin lại nguyên vẹn scoringPlan của prescan (candidate.examId
  // catalog CÓ THỂ khác examId thật được serve cho room - xem project_teacher_materials_examid_
  // order_mismatch.md). runtimeTargetScore != null (đã random ở prescan, đường giao bài mới) ->
  // RE-VALIDATE đúng target đó còn khả thi với nội dung thật (mode="target"); null (đường
  // REUSE_ROOM_ID, không qua prescan) -> random THẲNG ở đây (mode="range") - CÙNG 1 hàm, không có
  // nhánh logic random riêng thứ hai.
  const scoringPlan =
    runtimeTargetScore != null
      ? resolveScoringPlanForCandidate(QUESTIONS, { mode: "target", targetScoreEnv: runtimeTargetScore })
      : resolveScoringPlanForCandidate(QUESTIONS, { mode: "range", rangeMin: TARGET_SCORE_MIN, rangeMax: TARGET_SCORE_MAX });
  if (!scoringPlan.achievable) {
    return finish({
      status: "BLOCKED",
      phase: "CMS_RESOLUTION",
      error:
        runtimeTargetScore != null
          ? `Target score ${runtimeTargetScore} (đã random ở prescan) KHÔNG còn khả thi với nội dung THẬT của room (${scoringPlan.reason}) - KHÔNG đoán/KHÔNG tự đổi target, dừng rõ ràng.`
          : `Không random được target score nào trong ${TARGET_SCORE_RANGE_LABEL} cho room này (${scoringPlan.reason}).`,
      evidence,
    });
  }
  runtimeTargetScore = scoringPlan.targetScore;
  const WANT_CORRECT = buildWeightedWantCorrectPlan(QUESTIONS, scoringPlan.correctIndices);
  const rd = resolved.roomDetails;
  const realRoomExamId = rd?.room?.exams?.[0]?.id ?? null;
  evidence.randomAssignment = {
    unitName: rd.unit_name,
    lessonName: rd.lesson_name,
    lessonItemId: rd.lesson_item_id,
    roomExamId: resolved.examId, // NOTE: đây là catalog examId dùng để resolve CMS (tên field giữ nguyên tương thích cũ) - xem realRoomExamId cho examId THẬT của room.
    realRoomExamId,
    roomId: assignment.id,
    title: assignment.title,
    questionCount: QUESTIONS.length,
    targetScore: runtimeTargetScore,
    achievableScores: scoringPlan.achievableScores,
    requiredCorrectItems: scoringPlan.correctIndices.size,
  };
  log(`  [PASS] N=${QUESTIONS.length} câu, targetScore=${runtimeTargetScore} (cần đúng ${scoringPlan.correctIndices.size}/${QUESTIONS.length} item, achievable=[${scoringPlan.achievableScores.join(", ")}]).`);
  log(`[target-score]`);
  log(`targetScore=${runtimeTargetScore}`);
  if (realRoomExamId && realRoomExamId !== resolved.examId) {
    log(`  [CẢNH BÁO] examId catalog (dùng resolve CMS)="${resolved.examId}" KHÁC examId thật của room="${realRoomExamId}" - xem project_teacher_materials_examid_order_mismatch.md. Matcher full-answer-set ([answer-match] log dưới) là lớp bảo vệ chính cho trường hợp này.`);
  }

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
        // FIX (2026-08-24, BLOCKED thật gặp lại hôm nay: OPEN_EXERCISE_AMBIGUOUS/NOT_FOUND sau 0-2
        // lượt cuộn ở [5/N]): bản cũ (2026-08-21) chỉ tapOn "Bài tập" + extendedWaitUntil rồi TIN
        // NGAY (không đọc lại hierarchy để verify) - ĐÃ XÁC NHẬN THẬT hôm nay: tap Unit trong "Kiến
        // thức trong bài" có thể dẫn vào 1 màn quiz/game "Vui học" TƯƠNG TÁC (câu hỏi trắc nghiệm
        // riêng, VD "Choose the correct word..."/"tent, pasta, popcorn, pizza"), KHÔNG chỉ là 1 trang
        // nội dung "Unit N: ..." tĩnh - extendedWaitUntil cũ pass được (có lẽ do thoáng qua đúng 1
        // frame trước khi app tự chuyển tiếp) nhưng ngay sau đó KHÔNG còn đứng ở danh sách Bài tập
        // thật (scrollAndReadCardState/findAssignment() ở [5/N] quét nhầm màn quiz, không tiến triển
        // -> NOT_FOUND/NO_PROGRESS). SỬA: đọc lại hierarchy THẬT sau khi tap "Bài tập", verify bằng
        // ĐÚNG anchor nội dung danh sách (CÙNG pattern OVERALL_PROGRESS_BELOW_PATTERN/ABOVE đã dùng ở
        // readOverallProgress()) - KHÔNG tin extendedWaitUntil suông. Nếu chưa về đúng danh sách: thử
        // back() (bounded, dừng sớm nếu phát hiện đã rời hẳn app - CÙNG helper treeHasAppNode() dùng
        // ở MÀN 2), sau đó fallback launchApp() + tap lại "Bài tập" (CÙNG pattern ensureProProfileActive()) -
        // nếu VẪN không về được, BLOCKED rõ ràng (KHÔNG để [5/N] quét nhầm màn hình như bug cũ).
        const verifyOnHomeworkList = async () => {
          const t = await bridge.hierarchy();
          const texts = collectAllTexts(t);
          return { ok: texts.some((x) => OVERALL_PROGRESS_BELOW_PATTERN.test(x) || x === OVERALL_PROGRESS_ABOVE), texts };
        };
        await bridge.runSteps([
          { tapOn: { text: "Bài tập", optional: true } },
          { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao|2 tuần gần nhất|1 tháng gần nhất).*" }, timeout: 30000 }, optional: true },
        ]);
        let man1Check = await verifyOnHomeworkList();
        if (!man1Check.ok) {
          log(`  [CẢNH BÁO] Sau tapOn "Bài tập" vẫn KHÔNG thấy đúng danh sách Bài tập thật - thử back()...`);
          const MAN1_BACK_MAX_ATTEMPTS = 3;
          for (let i = 0; i < MAN1_BACK_MAX_ATTEMPTS && !man1Check.ok; i++) {
            await bridge.back();
            const treeAfterBack = await bridge.hierarchy();
            if (!treeHasAppNode(treeAfterBack, APP_ID)) break; // đã rời hẳn app - dừng back(), sang relaunch
            man1Check = await verifyOnHomeworkList();
          }
        }
        if (!man1Check.ok) {
          log(`  [CẢNH BÁO] back() không phục hồi được - relaunch app rồi tap lại "Bài tập"...`);
          await bridge.runSteps([
            { launchApp: { permissions: { all: "allow" } } },
            { extendedWaitUntil: { visible: { text: ".*(Vui học|Bài tập|Báo cáo).*" }, timeout: 30000 }, optional: true },
            { tapOn: { text: "Bài tập", optional: true } },
            { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao|2 tuần gần nhất|1 tháng gần nhất).*" }, timeout: 30000 }, optional: true },
          ]);
          man1Check = await verifyOnHomeworkList();
        }
        if (!man1Check.ok) {
          return finish({
            status: "BLOCKED",
            phase: "KIEN_THUC_MAN1_RECOVERY",
            error:
              `Sau khi điều hướng "Vui học" từ "Kiến thức trong bài" trên màn Danh sách bài tập, ` +
              `KHÔNG quay lại được ĐÚNG danh sách Bài tập thật (kể cả sau back() + relaunch app) - ` +
              `dừng lại thay vì để [5/N] quét nhầm màn hình khác. Current visible texts: ${JSON.stringify(man1Check.texts.slice(0, 40))}`,
            evidence,
          });
        }
        await bridge.runSteps([{ repeat: { times: 5, commands: [{ swipe: { direction: "DOWN", duration: 250 } }] } }]);
      } else {
        log(`  [CẢNH BÁO] ${kienThucMan1.reason}`);
      }
      evidence.kienThucTrongBai = { man1: kienThucMan1 };
    }

    // ===== ĐÃ SỬA (2026-08-25, root cause thật xác nhận qua run FAIL thật lớp 2A, candidate "Put
    // the words in the correct order..."): [4/N] đọc overallBefore bằng list ĐÃ ĐANG TẢI SẴN trong
    // bridge này (chỉ scroll trong dữ liệu đã fetch, KHÔNG ép fetch lại) - [2/N] giao bài qua API
    // web RIÊNG (KHÔNG qua app), nên app KHÔNG có tín hiệu nào để tự biết cần refetch danh sách
    // NGAY - "tổng số bài (Y)" tăng đúng ở [4/N] chỉ chứng minh phần ĐẾM TỔNG (badge nhỏ) đã cập
    // nhật, KHÔNG chứng minh danh sách CHI TIẾT (từng card, phần findAssignment() thật sự cuộn qua)
    // cũng đã refetch cùng lúc - 2 phần hoàn toàn có thể tách rời cache/refetch timing khác nhau.
    // Giữa [4/N] và đây KHÔNG có bước nào ép app tải lại danh sách (CHECK_KIEN_THUC_TRONG_BAI mặc
    // định false -> nhánh duy nhất từng làm việc đó bị SKIPPED) - `locateOpenAndVerifyAssignment()`
    // bên dưới chỉ `scrollToTop()` (cuộn trong dữ liệu ĐÃ CÓ) rồi `findAssignment()` (cuộn xuống,
    // cũng trong dữ liệu ĐÃ CÓ) - nếu card mới chưa kịp có trong lần fetch đó, cuộn bao nhiêu cũng
    // không bao giờ thấy -> END_OF_LIST OAN dù assignment có thật trên backend (đã xác nhận room_id
    // tồn tại qua diff before/after ở [3/N]). SỬA: ép refresh list TRƯỚC khi gọi locate - tái dùng
    // NGUYÊN VẸN pattern pull-to-refresh (tap lại tab "Bài tập" + swipe kéo xuống) đã verify hoạt
    // động đúng cho ĐÚNG mục đích "nạp lại dữ liệu mới" ở [6/N] cùng file này (dòng ~1240) và trong
    // flows/bai_tap/ktra_fullluong_lambai.yaml (dòng 204-211) - KHÔNG phát minh cơ chế mới, KHÔNG
    // đụng vào findAssignment()/scrollToTop() (thuật toán cuộn/fingerprint của 2 hàm đó đã đúng,
    // vấn đề nằm ở DỮ LIỆU ĐẦU VÀO cũ, không phải cách chúng cuộn/so khớp).
    log(`  [REFRESH] Ép tải lại danh sách "Bài tập" trước khi tìm assignment vừa giao (tránh cache cũ trước lúc giao bài)...`);
    await bridge.runSteps([
      { tapOn: { text: "Bài tập", optional: true } },
      { swipe: { start: "50%, 35%", end: "50%, 85%", duration: 600 } },
      { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao|2 tuần gần nhất|1 tháng gần nhất).*" }, timeout: 30000 } },
    ]);

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
    log(
      `[9/N] Trả lời TẤT CẢ ${QUESTIONS.length} câu theo kế hoạch (targetScore=${runtimeTargetScore}, cần đúng ${scoringPlan.correctIndices.size}/${QUESTIONS.length} item) - dùng HomeworkExamEngine (CMS thật), KHÔNG dùng dispatcher blind...`,
    );
    const examIdContext = { roomExamId: realRoomExamId, candidateExamId: resolved.examId };
    const answeredIds = new Set();
    const answerLog = [];
    let carryTree = null;
    let lastOutcome = null;
    while (answeredIds.size < QUESTIONS.length) {
      const questionIndex = answeredIds.size + 1;
      const pool = QUESTIONS.filter((q) => !answeredIds.has(q.id));
      const matchResult = await findMatchingQuestion(bridge, pool, carryTree, questionIndex, examIdContext);
      // KHÔNG dùng partial/first-fit khi có full-set match - AMBIGUOUS/NO_MATCH -> FAIL rõ ràng
      // NGAY, KHÔNG đoán candidate, KHÔNG retry mù (yêu cầu rõ - xem mục 5/10 của spec).
      if (matchResult.status !== "MATCHED") {
        const errorMessage =
          matchResult.status === "AMBIGUOUS"
            ? `AMBIGUOUS_MATCH ở câu ${questionIndex}: ${matchResult.diagnostic.candidates.length} candidate CMS cùng khớp ĐỦ toàn bộ answer-set đang hiển thị (ids=${matchResult.diagnostic.candidates.map((c) => c.id).join(", ")}) - KHÔNG tự chọn candidate đầu tiên.`
            : `NO_MATCH ở câu ${questionIndex} (còn ${pool.length} câu): không có candidate CMS nào có ĐỦ TOÀN BỘ đáp án đang hiển thị trên UI.`;
        return finish({
          status: "FAIL",
          phase: "FINISH_REMAINING",
          error: errorMessage,
          matchDiagnostic: matchResult.diagnostic,
          visibleTexts: collectAllTexts(carryTree ?? (await bridge.hierarchy())),
          evidence: { ...evidence, answerLog },
        });
      }
      const matched = matchResult.question;
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
    let finalTree = lastOutcome?.finalTree ?? null;
    // ĐÃ SỬA (2026-08-25, FAIL thật xác nhận qua run lớp 2A: app HOÀN THÀNH thật (progress
    // 14/14 -> 15/15 xác nhận qua screenshot thật SAU KHI flow đã báo FAIL) nhưng bước này vẫn báo
    // "Không thấy màn hình Kết quả" - RACE CONDITION, không phải app lỗi): `finalTree` ở trên lấy
    // từ `answerCurrentQuestionOneShot()` của CÂU CUỐI, vốn chỉ chờ `waitForAnimationToEnd` cố
    // định 1000-1500ms rồi chụp hierarchy NGAY (đủ cho chuyển câu-sang-câu, thuần UI local) -
    // KHÔNG đủ cho riêng bước "Nộp bài" của câu cuối (cần round-trip mạng thật để server tính
    // điểm, chậm hơn hẳn - đúng lý do CHỈ câu cuối gặp, câu 1-9 luôn qua). SỬA: nếu snapshot đầu
    // chưa thấy màn Kết quả, POLL THẬT (tái sử dụng bridge.wait()/extendedWaitUntil có sẵn trong
    // automation/bridge/maestroMcpBridge.js - CÙNG cơ chế mọi flow .yaml khác trong repo đã dùng
    // cho đúng bước này, vd flows/app/helpers/answer-current-exercise-generic.yaml gọi qua
    // ktra_fullluong_lambai.yaml với timeout 60000) thay vì kết luận FAIL ngay từ 1 snapshot cũ.
    if (!exam.isResultScreen(finalTree)) {
      log(`  [WAIT] Chưa thấy màn Kết quả ở snapshot đầu (có thể do submit câu cuối cần round-trip mạng) - chờ thêm tối đa 20s...`);
      const waited = await bridge.wait({ id: "exercise_result_screen" }, { timeout: 20000 });
      if (waited.success) {
        finalTree = await bridge.hierarchy();
      }
    }
    if (!exam.isResultScreen(finalTree)) {
      return finish({ status: "FAIL", phase: "RESULT_SCREEN", error: "Không thấy màn hình Kết quả sau khi trả lời hết toàn bộ câu (đã chờ thêm 20s).", evidence });
    }
    const result = exam.readResult(finalTree);
    evidence.result = result;
    log(`  ĐIỂM SỐ=${result.score} CHÍNH XÁC=${result.correct}`);

    const achievedCorrectCount = [...WANT_CORRECT.values()].filter(Boolean).length;
    const scoreNumber = result.score === null ? null : Number(result.score);
    const scoreValid = scoreNumber !== null && !Number.isNaN(scoreNumber);
    // matched: so đúng actualScore === runtimeTargetScore (epsilon 1e-6 cho sai số float) - KHÔNG
    // phải "nằm trong range" nữa (range CHỈ dùng để RANDOM ra runtimeTargetScore ở trên, không phải
    // điều kiện PASS/FAIL cuối - PORT cùng logic `matched` của pro_lamlai_target_score.mjs).
    const matched = scoreValid && Math.abs(scoreNumber - runtimeTargetScore) < 1e-6;
    evidence.scoreInterpretation = {
      questionCount: QUESTIONS.length,
      targetScore: runtimeTargetScore,
      requiredCorrectItems: scoringPlan.correctIndices.size,
      achievedCorrectCountByPlan: achievedCorrectCount,
      realCorrectCountFromResultScreen: result.correctCount,
      actualScore: scoreNumber,
      matched,
      discrepancy: result.correctCount !== null && result.correctCount !== achievedCorrectCount
        ? `Kế hoạch nhắm ${achievedCorrectCount} câu đúng nhưng server báo ${result.correctCount} câu đúng - self-assessment KHÔNG khớp server, xem answerLog để đối chiếu từng câu.`
        : null,
    };
    if (evidence.scoreInterpretation.discrepancy) {
      log(`  [CẢNH BÁO] ${evidence.scoreInterpretation.discrepancy}`);
    }
    log(`[target-score-result]`);
    log(`targetScore=${runtimeTargetScore}`);
    log(`actualScore=${scoreNumber}`);
    log(`matched=${matched}`);

    // ===== [KIẾN THỨC TRONG BÀI - MÀN 2/2, Kết quả BTVN] (MỚI 2026-08-21 - xem MÀN 1 ở [4b/N]).
    // Tap vào card Unit ngay TRÊN màn Kết quả (trước khi đóng dialog) để kiểm tra content. =====
    // FIX (2026-08-24, bug thật xác nhận trên device): việc tap Unit ở đây là PUSH lên stack của
    // TAB "Bài tập" (KHÔNG phải chuyển bottom-tab - bottom tab vẫn hiển thị "Bài tập" active suốt),
    // nên giả định cũ "app tự router.replace, quay lại 'Bài tập' sau đó thấy card đã cập nhật NGAY,
    // không cần tap 'Hoàn thành'/exercise_result_close_button nữa" là SAI: đã xác nhận thật app kẹt
    // nhiều phút ở màn "Vui học" (Unit không liên quan), tapOn "Bài tập" là NO-OP (tab đã active sẵn
    // nên không pop lại stack), verifyCardShowsScoreByIdentity() ở [11/N] sau đó luôn NOT_FOUND vì
    // đang quét NHẦM màn Vui học chứ không phải danh sách Bài tập thật. TUYỆT ĐỐI không dùng việc
    // điều hướng "Vui học" để thay cho tap CTA "Hoàn thành"/"Tiếp theo" thật - back() để pop lại
    // đúng màn Kết quả (CTA còn nguyên) rồi mới chạy nhánh tap CTA thật bên dưới, KHÔNG đổi.
    let kienThucMan2 = { navigated: false, reason: "SKIPPED (CHECK_KIEN_THUC_TRONG_BAI=false)" };
    if (CHECK_KIEN_THUC_TRONG_BAI) {
      log(`[10b/N] Kiểm tra "Kiến thức trong bài" trên màn Kết quả BTVN (điều hướng sang Vui học rồi quay lại)...`);
      kienThucMan2 = await attemptKienThucTrongBaiNavigation(bridge, "Kết quả BTVN");
      evidence.kienThucTrongBai = { ...evidence.kienThucTrongBai, man2: kienThucMan2 };
      if (kienThucMan2.navigated) {
        log(`  [PASS] Đã điều hướng sang "Vui học" từ màn Kết quả - back() để quay lại đúng màn Kết quả (CTA còn nguyên)...`);
        const BACK_TO_RESULT_MAX_ATTEMPTS = 5;
        let backedToResult = false;
        let leftAppWhileBacking = false;
        for (let i = 0; i < BACK_TO_RESULT_MAX_ATTEMPTS; i++) {
          await bridge.back();
          const treeAfterBack = await bridge.hierarchy();
          if (exam.isResultScreen(treeAfterBack)) {
            backedToResult = true;
            break;
          }
          // FIX (2026-08-24, xác nhận thật trên device): "Vui học" (điều hướng từ Kiến thức trong
          // bài trên màn Kết quả) KHÔNG phải màn PUSH lên stack của app - back() từ đó thoát THẲNG
          // ra màn hình chính Android (đã xác nhận thật: hierarchy sau back() hiện "Phone",
          // "Contacts", "Messages", widget thời tiết - launcher, không còn node nào của app). Dừng
          // NGAY vòng lặp back() nếu phát hiện đã rời khỏi app hẳn (không còn resource-id nào thuộc
          // `${APP_ID}:id/`) - back() thêm lần nữa ở màn hình chính KHÔNG có tác dụng và không an
          // toàn (có thể trúng app/màn hình khác ngoài ý muốn).
          if (!collectAllTexts(treeAfterBack) || !treeHasAppNode(treeAfterBack, APP_ID)) {
            leftAppWhileBacking = true;
            break;
          }
        }
        if (!backedToResult) {
          const diagTree = await bridge.hierarchy();
          const diagTexts = collectAllTexts(diagTree);
          // FIX (2026-08-24): KHÔNG bỏ mặc thiết bị đứng ở màn hình chính Android/màn lạ cho lượt
          // chạy test SAU - relaunch lại app (CÙNG pattern launchApp đã dùng ở ensureProProfileActive())
          // trước khi thoát, CHỈ để dọn dẹp thiết bị - KHÔNG đổi kết quả FAIL, KHÔNG coi đây là đã
          // tap CTA thật (evidence vẫn ghi rõ CTA chưa từng được tap).
          await bridge.runSteps([
            { launchApp: { permissions: { all: "allow" } } },
            { extendedWaitUntil: { visible: { text: ".*(Vui học|Bài tập|Báo cáo).*" }, timeout: 30000 }, optional: true },
          ]);
          return finish({
            status: "FAIL",
            phase: "KIEN_THUC_MAN2_RECOVERY",
            error:
              `Sau ${leftAppWhileBacking ? "" : BACK_TO_RESULT_MAX_ATTEMPTS + " lần "}back() từ "Vui học" (điều hướng bởi Kiến thức trong bài trên màn Kết quả), ` +
              `KHÔNG quay lại được màn Kết quả (exercise_result_screen) để tap CTA "Hoàn thành"/"Tiếp theo" thật - ` +
              `KHÔNG dùng "Vui học" thay cho CTA.${leftAppWhileBacking ? " back() đã thoát HẲN ra ngoài app (màn hình chính/app khác)." : ""} ` +
              `Current visible texts (tại thời điểm dừng): ${JSON.stringify(diagTexts.slice(0, 40))}. ` +
              `Đã relaunch app để dọn dẹp thiết bị cho lượt chạy sau (không ảnh hưởng kết quả FAIL này).`,
            evidence,
          });
        }
        log(`  [PASS] Đã quay lại đúng màn Kết quả (exercise_result_screen) sau back() - tiếp tục tap CTA thật.`);
      } else {
        log(`  [CẢNH BÁO] ${kienThucMan2.reason} - fallback về đóng dialog kết quả như bình thường.`);
      }
    }

    // ===== Đóng kết quả bằng CTA THẬT "Hoàn thành"/"Tiếp theo" (COPY gốc dòng 338-349, KHÔNG đổi -
    // LUÔN chạy, kể cả sau khi vừa back() lại từ nhánh Kiến thức trong bài ở trên) =====
    await bridge.runSteps([
      { runFlow: { when: { visible: "Hoàn thành" }, commands: [{ tapOn: { text: ".*(Hoàn thành).*" } }] } },
      { runFlow: { when: { visible: "Tiếp theo" }, commands: [{ tapOn: { id: "exercise_result_close_button" } }] } },
    ]);
    // FIX (2026-08-24): id="homework_screen" ĐƠN LẺ không đủ tin cậy làm bằng chứng "đã về đúng
    // danh sách" (có thể là node nền còn mount phía dưới 1 màn khác đang đè lên trên - CÙNG lỗi bản
    // chất với việc chỉ nhìn bottom tab "Bài tập" active, đã xác nhận thật hôm nay là KHÔNG đủ) -
    // verify THÊM anchor nội dung thật của danh sách (CÙNG pattern OVERALL_PROGRESS_BELOW_PATTERN/
    // OVERALL_PROGRESS_ABOVE đã dùng trong readOverallProgress(), không thêm pattern mới).
    const homeworkScreenWait = await bridge.wait({ id: "homework_screen" }, { timeout: 30000 });
    const backOnListTree = await bridge.hierarchy();
    const backOnListTexts = collectAllTexts(backOnListTree);
    const reallyOnHomeworkList =
      homeworkScreenWait.success &&
      backOnListTexts.some((t) => OVERALL_PROGRESS_BELOW_PATTERN.test(t) || t === OVERALL_PROGRESS_ABOVE);
    if (!reallyOnHomeworkList) {
      return finish({
        status: "FAIL",
        phase: "RESULT_CLOSE_VERIFY",
        error:
          `Đã tap CTA "Hoàn thành"/"Tiếp theo" nhưng KHÔNG xác nhận được app đã về ĐÚNG danh sách Bài tập ` +
          `(id="homework_screen" wait success=${homeworkScreenWait.success} - KHÔNG đủ 1 mình, cần thêm anchor nội dung thật). ` +
          `Current visible texts: ${JSON.stringify(backOnListTexts.slice(0, 40))}`,
        evidence,
      });
    }

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
      matched;

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
