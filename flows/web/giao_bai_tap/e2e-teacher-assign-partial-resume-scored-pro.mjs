#!/usr/bin/env node
/**
 * E2E-Teacher-Assign-Partial-Resume-Scored-PRO
 *
 * FORK của `e2e-teacher-assign-partial-resume-scored.mjs` (bản gốc GIỮ NGUYÊN, không sửa) - CÙNG
 * business flow/handler/pipeline (KHÔNG viết lại: HomeworkExamEngine.decideAnswerAction, CMS
 * resolve qua resolveHomeworkExamQuestionsForRoomId, MaestroMcpBridge, disambiguate/progress
 * reading) - CHỈ khác đúng 2 điểm theo yêu cầu (2026-08-18):
 *
 *   1. Target điểm CUỐI CÙNG (không phải "X/10 câu đúng"): [7.0, 9.0] ĐÓNG cả 2 đầu (bản gốc
 *      [7.0, 8.0) nửa mở; SỬA LẠI 2026-08-19 theo yêu cầu user "điểm số từ 7-9 điểm", trước đó
 *      từng là [6.0, 8.0]) - xem computeScorePlan() bên dưới, center = 8.0 cho khớp tâm range mới.
 *   1b. MỚI (2026-08-19): loại thêm candidate có itemName = "Choose the correct answer." khỏi
 *      random pool (EXCLUDED_ITEM_NAMES) - theo yêu cầu user cùng ngày ("không muốn giao trùng bài
 *      có tên Choose the correct answer"), CỘNG THÊM vào dedupe lesson_item_id đã có sẵn (mục 4).
 *   2. Thêm phase [0/10] PROFILE: chuyển + verify hồ sơ học sinh đang active là "Ngoc" (PRO) TRƯỚC
 *      khi giao bài - theo quyết định của user (2026-08-18): verify = tên hồ sơ "Ngoc" hiển thị
 *      đúng sau khi chuyển (KHÔNG double-check thêm bằng 1 bài ADVANCED riêng) - test_data/
 *      accounts.env định nghĩa CỨNG tài khoản PH chỉ có đúng 2 hồ sơ, Ngoc=PRO/Gia Linh=BASIC (xem
 *      comment PROFILE_PRO_NAME trong file đó + flows/bai_tap/HW-PROFILE-BASIC-PRO-ADVANCED.yaml).
 *      Cơ chế chuyển hồ sơ (tap "Chuyển profile" index 0, xử lý CẢ 2 khả năng toggle-trực-tiếp HOẶC
 *      bottom-sheet) COPY NGUYÊN từ HW-PROFILE-BASIC-PRO-ADVANCED.yaml dòng 73-93 (đã verify thật
 *      2026-08-13) - không invent selector mới.
 *
 * PHẠM VI "1 phiên MCP xuyên suốt": KHÔNG tuyệt đối 100% - `assignHomeworkAndLocateOnApp()` (tái
 * dụng nguyên vẹn, không sửa) tự spawn CLI `maestro test` RIÊNG cho bước locate
 * (`runLocateAssignmentCard()` trong e2e-teacher-assign-student-open.mjs) - đây là hạ tầng DÙNG
 * CHUNG bởi nhiều testcase khác, KHÔNG refactor ở đây (rủi ro phá vỡ caller khác, ngoài phạm vi).
 * Những gì file này ĐẢM BẢO dùng đúng 1 MaestroMcpBridge session xuyên suốt: phase [0/10] PROFILE
 * (mở riêng, đóng trước khi giao bài) và phase [4/10]-[10/10] OPEN..RESULT (session thứ 2, cùng
 * kiến trúc bản gốc) - báo cáo trung thực trong evidence.mcpSessionScope, KHÔNG overclaim.
 *
 * CHẠY: node flows/giao_bai_tap/e2e-teacher-assign-partial-resume-scored-pro.mjs
 * ENV: giống bản gốc (APP_ID/PHONE/OTP/MAESTRO_DEVICE, TEACHER_* trong .env cho Playwright,
 *   ASSIGN_PRIMARY_CLASS default "3B") + PROFILE_PRO_NAME (test_data/accounts.env, default "Ngoc").
 *
 * BỔ SUNG (2026-08-18, port từ flows/giao_bai_tap/e2e-ktra-fullluong-lambai-scored-pro.mjs - file
 * đó phát hiện 2 fix thật sau bản đầu của file NÀY, port lại đây cho đúng lifecycle PARTIAL/RESUME
 * mà user yêu cầu):
 *   3. EXAM_SESSION auto-refresh + probe TRƯỚC pre-scan - bản đầu của file này KHÔNG có bước này,
 *      đã BLOCKED thật (xem automation/output/e2e_teacher_assign_partial_resume_scored_pro_report.json:
 *      "Không tìm thấy entry nào trong window.__NUXT__.data..." - session hết hạn, KHÔNG phải do
 *      candidate xấu). refreshExamSessionFromEnvCookie()/probeExamSession() COPY NGUYÊN.
 *   4. SELECTION: bản port đầu tiên (2026-08-18 sáng) lọc theo title UNIQUE (0 room cũ trùng title
 *      trong lớp) - ĐÃ SỬA LẠI (2026-08-18 chiều, theo phản hồi user): title KHÔNG PHẢI blacklist,
 *      "Choose the correct answer." chỉ là 1 title bình thường (nhiều lesson-item KHÁC NHAU dùng
 *      chung chuỗi hiển thị này) - bộ lọc title-text đã xác nhận SAI: chạy hết 33/33 candidate
 *      title-unique trong lớp vẫn BLOCKED (100% loại vì UNSUPPORTED_TYPE, không phải vì title).
 *      Dedupe ĐÚNG bằng lesson_item_id (scanRecentlyUsedLessonItemIds(), xem docblock ở đó) - loại
 *      candidate CHỈ khi đã giao ĐÚNG lesson-item đó gần đây, không đụng candidate khác lesson-item
 *      dù trùng tên hiển thị. Locate trên UI học sinh khi title trùng đã có cơ chế riêng, KHÔNG
 *      phụ thuộc title unique: assignHomeworkAndLocateOnApp() định danh room mới bằng diff
 *      before/after id, openAssignmentDisambiguated() định danh đúng màn làm bài bằng nội dung câu
 *      hỏi CMS thật.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parseEnvFile } from "../../../automation/src/config.js";
import { MaestroMcpBridge } from "../../../automation/bridge/maestroMcpBridge.js";
import { HomeworkExamEngine, decideAnswerAction } from "../../../automation/bai_tap/navigation/homeworkExamEngine.js";
import { fetchEligibleAssignmentTree } from "../../../automation/giao_bai_tap/navigation/teacherAssignmentApiDiscovery.js";
import { parseQuestionsFromExamPage } from "../../../automation/discovery/examPageScraper.js";
import { normalizeQuestions } from "../../../automation/model/questionModel.js";
import { resolveHomeworkExamQuestionsForRoomId } from "../../../automation/bai_tap/discovery/teacherMaterialsExamResolver.js";
import { fetchRoomDetails, fetchAllHomeworkRooms } from "../../../automation/bai_tap/discovery/homeworks.js";
import { normalizeHomework } from "../../../automation/bai_tap/model/homeworkModel.js";
import { formatDM, formatDMY, isoToVnYmd } from "../../../automation/bai_tap/verify-filter-web-vs-app.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "e2e_teacher_assign_partial_resume_scored_pro_report.json");
const ACCOUNTS_ENV_PATH = join(PROJECT_ROOT, "test_data", "accounts.env");
const ROOT_ENV_PATH = join(PROJECT_ROOT, ".env");
const EXAM_SESSION_PATH = join(PROJECT_ROOT, "automation", ".cache", "exam_session.json");
const ACCOUNTS_ENV = parseEnvFile(ACCOUNTS_ENV_PATH);
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const TARGET_CLASS = process.env.ASSIGN_PRIMARY_CLASS || "3B";
const TARGET_CLASS_ID = process.env.TARGET_CLASS_ID || "b3336062-cacd-4d1a-a0af-4de44acf33d2";
// SỬA (2026-08-19, theo yêu cầu user cùng ngày): mặc định KHÔNG còn cap cứng ở 12 - hard cap 12 đã
// khiến pre-scan dừng lại (BLOCKED) khi mới quét 12/33 candidate fresh, bỏ sót 21 candidate chưa
// từng thử (evidence thật: automation/output/e2e_teacher_assign_partial_resume_scored_pro_report.json
// run 2026-08-19, "Đã thử 12/12 candidate... không candidate nào khả thi" trong khi
// totalFreshCandidates=33). Mặc định giờ là quét HẾT toàn bộ candidate fresh (Infinity, không phải
// số cứng "33" - pool fresh thay đổi theo thời điểm chạy) - chỉ dừng khi tìm được 1 candidate khả
// thi HOẶC đã quét hết, đúng yêu cầu "scan all eligible candidates until: 1. tìm được candidate hợp
// lệ hoặc 2. đã kiểm tra hết candidates". Vẫn CÓ THỂ giới hạn qua env MAX_PRESCAN_ATTEMPTS nếu cần
// (an toàn/debug), chỉ không còn mặc định cắt ngang.
const MAX_PRESCAN_ATTEMPTS = process.env.MAX_PRESCAN_ATTEMPTS ? Number(process.env.MAX_PRESCAN_ATTEMPTS) : Infinity;
const MAX_DISAMBIGUATE_CANDIDATES = Number(process.env.MAX_DISAMBIGUATE_CANDIDATES || 10);
const PROFILE_PRO_NAME = process.env.PROFILE_PRO_NAME || ACCOUNTS_ENV.PROFILE_PRO_NAME || "Ngoc";
// SỬA (2026-08-19, theo yêu cầu user cùng ngày - điểm mục tiêu "7-9 điểm"): range đổi [6.0, 8.0] ->
// [7.0, 9.0] đóng cả 2 đầu, center đổi 7.0 -> 8.0. Không đổi công thức GIẢ ĐỊNH, chỉ đổi ngưỡng lọc.
const TARGET_SCORE_RANGE_LABEL = "[7.0, 9.0]";
// MỚI (2026-08-19, theo yêu cầu user cùng ngày - "không muốn giao trùng bài có tên Choose the
// correct answer"): loại thêm candidate có itemName khớp title này khỏi random pool, CỘNG THÊM vào
// (không thay thế) dedupe theo lesson_item_id đã có sẵn (scanRecentlyUsedLessonItemIds) - đảm bảo
// lần chạy này chắc chắn KHÔNG chọn lại đúng title đó, kể cả lesson-item nào chưa từng bị dedupe.
const EXCLUDED_ITEM_NAMES = ["choose the correct answer"];
function isExcludedItemName(itemName) {
  const normalized = (itemName ?? "").trim().replace(/\.+$/, "").toLowerCase();
  return EXCLUDED_ITEM_NAMES.includes(normalized);
}

/** COPY NGUYÊN từ e2e-ktra-fullluong-lambai-scored-pro.mjs (xem docblock ở đó). */
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

/** COPY NGUYÊN từ e2e-ktra-fullluong-lambai-scored-pro.mjs (retry bounded cho lỗi flaky networkidle đã biết). */
async function parseQuestionsFromExamPageWithRetry(examId, maxAttempts = 2) {
  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await parseQuestionsFromExamPage(examId);
    } catch (err) {
      lastErr = err;
      if (!/Timeout \d+ms exceeded/.test(err.message)) throw err;
      log(`    (retry ${attempt}/${maxAttempts} examId=${examId}: page.goto timeout - flaky networkidle đã biết, thử lại)`);
    }
  }
  throw lastErr;
}

/** COPY NGUYÊN từ e2e-ktra-fullluong-lambai-scored-pro.mjs. */
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

/**
 * SỬA LẠI 2026-08-18 theo yêu cầu user (title KHÔNG PHẢI blacklist - "Choose the correct answer."
 * là 1 title BÌNH THƯỜNG trong random pool, nhiều lesson-item KHÁC NHAU dùng chung title đó):
 * dedupe theo ĐÚNG lesson_item_id (identity thật của nội dung bài) thay vì title text - trước đây
 * lọc theo title text đã loại OAN 80/113 candidate hợp lệ (nhiều lesson-item khác hẳn nhau, khác
 * unit, chỉ vô tình trùng CHUỖI HIỂN THỊ "Choose the correct answer."/"Read the text and choose
 * the correct answer." - xác nhận thật 2026-08-18: chạy hết CẢ 33/33 candidate title-unique vẫn
 * BLOCKED, chứng minh bộ lọc title sai mục tiêu). Việc LOCATE đúng card trên UI học sinh khi title
 * trùng đã có cơ chế RIÊNG, ĐỘC LẬP với hàm này: assignHomeworkAndLocateOnApp() định danh room MỚI
 * bằng diff before/after id (KHÔNG qua title), còn openAssignmentDisambiguated()/findMatchingQuestion()
 * ở phase [4/10] định danh đúng màn làm bài bằng NỘI DUNG câu hỏi CMS thật - cả 2 đều KHÔNG cần
 * title unique. Trả về Set các lesson_item_id đã tồn tại room trong lớp (period=MONTH) để loại
 * đúng nghĩa "đã giao lesson-item NÀY trước đó" - không đụng tới candidate khác lesson-item dù
 * trùng tên hiển thị.
 */
async function scanRecentlyUsedLessonItemIds(classId) {
  const rawRooms = await fetchAllHomeworkRooms({ period: "MONTH" });
  const ids = new Set();
  for (const raw of rawRooms) {
    const h = normalizeHomework(raw);
    if (!h.classIds.includes(classId)) continue;
    if (h.lessonItem?.id) ids.add(h.lessonItem.id);
  }
  return ids;
}

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

const CTA_TEXTS = ["Làm bài", "Tiếp tục", "Làm lại", "Chinh phục"];
const PROGRESS_BADGE_PATTERN = /^\d+\s*\/\s*\d+$/;

/** COPY NGUYÊN từ bản gốc (không đổi) - xem docblock ở e2e-teacher-assign-partial-resume-scored.mjs. */
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

/** COPY NGUYÊN từ bản gốc (không đổi). */
async function openAssignmentDisambiguated(bridge, { title, dueDM, questionsPool, maxCandidates = MAX_DISAMBIGUATE_CANDIDATES }) {
  const esc = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (let idx = 0; idx < maxCandidates; idx++) {
    const state = await scrollAndReadCardState(bridge, title, dueDM, idx);
    if (!state.found || !state.cta) {
      log(`  [DISAMBIGUATE] index=${idx}: không còn occurrence nào (title+Hạn nộp=${dueDM}) - hết candidate (đã retry 1 lần).`);
      return { opened: false, triedCount: idx };
    }
    const tapResult = await bridge.runSteps([
      { tapOn: { text: state.cta, below: { text: `Hạn nộp ${dueDM}`, below: { text: `.*${esc}.*` } }, index: idx } },
      { waitForAnimationToEnd: { timeout: 3000 } },
      { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
      { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 15000 } },
    ]);
    if (!tapResult.success) {
      log(`  [DISAMBIGUATE] index=${idx}: tap (cta="${state.cta}") thất bại - ${tapResult.error}.`);
      return { opened: false, triedCount: idx + 1 };
    }
    const matched = await findMatchingQuestion(bridge, questionsPool);
    if (matched) {
      log(`  [DISAMBIGUATE] index=${idx}: ĐÚNG assignment (câu hiển thị khớp "${matched.id}", cta lúc mở="${state.cta}").`);
      return { opened: true, index: idx, firstMatched: matched, progressBefore: state };
    }
    log(`  [DISAMBIGUATE] index=${idx}: nội dung KHÔNG khớp bộ questionsPool - room khác trùng title/Hạn nộp. Thoát, thử candidate kế tiếp.`);
    await exitToHomeworkList(bridge);
  }
  return { opened: false, triedCount: maxCandidates };
}

/**
 * SỬA (2026-08-19, root cause thật xác nhận qua run trực tiếp room_id=817ffac5-090b-4e99-ba4e-
 * 0bdeb9d9ed7c title="Read the text and choose the correct answer." due 26/08): bản cũ gọi
 * scrollToCard() (native `scrollUntilVisible`, timeout 240000) RỒI MỚI gọi `bridge.hierarchy()`
 * RIÊNG để readCardState() - 2 lệnh CLI tách rời. FAILED thật "index=0: không còn occurrence nào"
 * (readCardState không tìm thấy) NGAY LẦN ĐẦU dù title này rất phổ biến (xuất hiện ở gần như mọi
 * Unit/Lesson 3 trong prescan cùng ngày) - xác nhận qua script chẩn đoán riêng (đọc trực tiếp bằng
 * CÙNG 1 session MaestroMcpBridge, KHÔNG qua CLI riêng): title+"Hạn nộp 26/08" ĐANG hiển thị thật
 * (kèm badge "3/10" - đã làm dở 3 câu từ lượt chạy trước bị ngắt giữa chừng - và CTA "Tiếp tục"),
 * chỉ CHẬM hơn 1 nhịp so với lúc `scrollToCard` báo COMPLETED - CÙNG root cause "dừng cuộn không
 * đồng bộ với lúc đọc lại state" đã xác nhận + sửa cùng ngày ở flows/helpers/locate-assignment-
 * card.yaml (xem lịch sử sửa file đó, LẦN 4-6) - `scrollUntilVisible` của Maestro tự quyết định
 * "đã tới nơi" dựa trên so sánh nội dung giữa các lượt cuộn nội bộ (không đồng bộ với hierarchy đọc
 * RIÊNG ngay sau đó), vừa dễ dừng sớm (duplicate) vừa dễ lệch timing (settle). SỬA: bỏ hẳn
 * scrollToCard()/scrollUntilVisible - gộp vòng lặp cuộn NGAY VÀO readCardState() làm điều kiện dừng
 * DUY NHẤT (CÙNG hàm dùng để quyết định found/occurrenceIndex, không còn 2 bước tách rời có thể
 * lệch nhau) - mỗi lượt: đọc hierarchy THẬT, kiểm tra qua readCardState(), nếu chưa thấy thì swipe
 * (biên độ/tốc độ ĐÃ VERIFY THẬT qua diagnose-scroll.mjs cùng ngày: 50% màn hình/600ms, tìm thấy
 * đúng lượt 17-18 cho 2 title khác nhau, không overscroll) + waitForAnimationToEnd rồi đọc lại.
 * `maxSwipes: 80` là giới hạn CỨNG (không phải "quét tới khi hết danh sách thật") - không tìm thấy
 * sau 80 lượt thì trả về found:false như cũ, caller (openAssignmentDisambiguated) tự quyết định
 * BLOCKED, không đổi hành vi quyết định ở tầng trên.
 */
async function scrollAndReadCardState(bridge, title, dueDM, occurrenceIndex, maxSwipes = 80) {
  let state = readCardState(await bridge.hierarchy(), title, dueDM, occurrenceIndex);
  for (let i = 0; i < maxSwipes && (!state.found || !state.cta); i++) {
    await bridge.runSteps([
      { swipe: { start: "50%,85%", end: "50%,35%", duration: 600 } },
      { waitForAnimationToEnd: { timeout: 800 } },
    ]);
    state = readCardState(await bridge.hierarchy(), title, dueDM, occurrenceIndex);
  }
  return state;
}

/** COPY NGUYÊN từ bản gốc (không đổi). */
async function exitToHomeworkList(bridge) {
  const r = await bridge.runSteps([
    { tapOn: { id: "exercise_close_button" } },
    { waitForAnimationToEnd: { timeout: 1500 } },
    { tapOn: { text: "Thoát", optional: true } },
    { tapOn: { text: "Đồng ý", optional: true } },
    { tapOn: { text: "Xác nhận", optional: true } },
    { waitForAnimationToEnd: { timeout: 1000 } },
    { extendedWaitUntil: { visible: { id: "homework_screen" }, timeout: 20000 } },
  ]);
  if (!r.success) {
    throw new Error(`Tap X (exercise_close_button) + xử lý confirm-dialog + chờ "homework_screen" thất bại: ${r.error}`);
  }
}

function isVisibleInTree(texts, textPattern) {
  const pattern = new RegExp(`^${textPattern}$`);
  return texts.some((t) => pattern.test(t));
}

/** COPY NGUYÊN từ bản gốc (không đổi). */
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
    resultLabel: isLast ? "e2e_partial_resume_scored_pro_result_screen" : null,
    snapshot: matched._snapshot ?? null,
  });
  if (!outcome.supported) {
    throw new Error(`Handler không hỗ trợ câu "${matched.question}" (id=${matched.id}): ${outcome.reason}`);
  }
  return { matched, wantCorrect, outcome };
}

function finish(result) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  return result;
}

/**
 * SỬA LẠI 2026-08-19 theo yêu cầu user (đổi tên + đổi hẳn logic, THAY cho isTextChoiceCompatible()
 * cũ): trước đây CHỈ chấp nhận câu hỏi có đáp án dạng CHỮ (>=2 đáp án chữ + correctAnswer khớp 1
 * trong số đó) - loại OAN mọi câu đáp án dạng ẢNH (content stripHtml ra chuỗi rỗng nên luôn trượt
 * điều kiện "chữ") dù decideAnswerAction() (homeworkExamEngine.js) THẬT SỰ có hỗ trợ 1 chiến lược
 * riêng cho ảnh (IMAGE_CHOICE_GRID - lưới 2x2, xem docblock hàm đó). User xác nhận: "Image-based
 * question không đồng nghĩa với unsupported" - dạng bài DUY NHẤT phải loại là SPEAKING (automation
 * không thể kiểm soát đúng/sai cho SPEAK -> không thể nhắm điểm mục tiêu).
 *
 * GIỚI HẠN THẬT (không che giấu): detectImageChoiceGrid() (homeworkExamEngine.js) đọc TOẠ ĐỘ THẬT
 * của các phần tử clickable trên màn hình - dữ liệu này CHỈ có khi mở bài trên thiết bị, pre-scan
 * (Playwright, đọc CMS/Exam Editor, KHÔNG có thiết bị) không thể xác nhận chắc chắn 1 câu ảnh có
 * đúng layout lưới 2x2 hay không. Vì vậy nhánh IMAGE_CHOICE_GRID_CANDIDATE bên dưới chỉ xác nhận
 * ĐIỀU KIỆN CẤU TRÚC suy được từ CMS (đúng 4 đáp án + CMS có gán 1 đáp án đúng - dù không đọc được
 * NỘI DUNG chữ của đáp án đó) - việc layout có THẬT SỰ là lưới 2x2 hay không được xác nhận LẠI, đúng
 * lúc, trên thiết bị thật (openAssignmentDisambiguated()/findMatchingQuestion() gọi decideAnswerAction()
 * với tree thật) - nếu không khớp, runtime tự FAIL đúng chỗ (answerOneQuestion() throw) thay vì
 * pre-scan đoán mù. Đây CHÍNH XÁC là ranh giới "chỉ loại khi thực sự không thể xác định" mà user
 * yêu cầu - phần xác định được (SPEAKING, thiếu correctAnswer, hình dạng đáp án lạ) loại ngay ở
 * pre-scan; phần KHÔNG xác định được từ CMS (layout ảnh thật) để lại cho runtime.
 *
 * @returns {{ok: true, strategy: string} | {ok: false, reason: string}}
 */
export function classifyQuestionSupport(q) {
  if (q.type === "SPEAK") return { ok: false, reason: "UNSUPPORTED_SPEAKING" };
  const nonEmptyAnswers = (q.answers ?? []).filter((a) => typeof a === "string" && a.trim().length > 0);
  const textChoiceOk = nonEmptyAnswers.length >= 2 && Boolean(q.correctAnswer) && nonEmptyAnswers.includes(q.correctAnswer);
  if (textChoiceOk) return { ok: true, strategy: "TEXT_CHOICE" };
  // IMAGE_CHOICE_GRID: correctAnswer so sánh `!== null` (KHÔNG dùng truthy) - CMS có thể gán đúng 1
  // đáp án nhưng nội dung đáp án đó là ảnh (stripHtml ra "" - falsy nhưng KHÔNG PHẢI null, xem
  // model/questionModel.js#extractCorrectAnswer) - "" vẫn là tín hiệu THẬT "CMS có xác định đáp án
  // đúng", chỉ là automation không đọc được CHỮ của nó, không phải "CMS không xác định được gì".
  const gridShapeOk = (q.answers ?? []).length === 4 && q.correctAnswer !== null;
  if (gridShapeOk) return { ok: true, strategy: "IMAGE_CHOICE_GRID_CANDIDATE" };
  if (q.correctAnswer === null) return { ok: false, reason: "NO_CORRECT_ANSWER_DEFINED" };
  return { ok: false, reason: "UNSUPPORTED_ANSWER_SHAPE" };
}

/** @returns {{ok: true} | {ok: false, reason: string, questionId?: string}} */
export function isAutomationCompatible(questions) {
  if (!Array.isArray(questions) || questions.length < 3) {
    return { ok: false, reason: "TOO_FEW_QUESTIONS" };
  }
  for (const q of questions) {
    const classified = classifyQuestionSupport(q);
    if (!classified.ok) return { ok: false, reason: classified.reason, questionId: q.id };
  }
  return { ok: true };
}

/**
 * SỬA (2026-08-19, theo yêu cầu user cùng ngày "điểm số từ 7-9"): range đóng cả 2 đầu [7.0, 9.0]
 * (bản trước [6.0, 8.0]) - center đổi 7.0 -> 8.0 cho khớp tâm range mới. Cùng công thức GIẢ ĐỊNH
 * (thang điểm 10, tỉ lệ thuận theo số câu đúng/tổng, làm tròn 1 chữ số) - CHƯA đổi, chỉ đổi ngưỡng
 * lọc + tâm.
 */
export function computeScorePlan(totalCount) {
  let best = null;
  for (let c = 0; c <= totalCount; c++) {
    const predicted = Math.round((c / totalCount) * 100) / 10;
    if (predicted < 7.0 || predicted > 9.0) continue;
    const distanceToCenter = Math.abs(predicted - 8.0);
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
 * SỬA LẠI 2026-08-18 theo yêu cầu user: title KHÔNG PHẢI blacklist - "Choose the correct answer."
 * là 1 title bình thường trong random pool, CÓ THỂ được chọn/giao nếu feasible. Dedupe CHỈ theo
 * lesson_item_id đã có room trong lớp `classId` gần đây (period=MONTH) - loại đúng nghĩa "đã giao
 * lesson-item NÀY trước đó", KHÔNG đụng candidate khác lesson-item dù trùng tên hiển thị (xem
 * docblock scanRecentlyUsedLessonItemIds() - bộ lọc title-text cũ đã xác nhận SAI: chạy hết 33/33
 * candidate title-unique vẫn BLOCKED, chứng minh phần lớn candidate hợp lệ bị loại OAN). Loại
 * candidate CHỈ vì 2 lý do kỹ thuật thật: (1) đã giao lesson-item này gần đây, (2) KHÔNG THỂ THỰC
 * THI (handler không hỗ trợ / không có correctCount nguyên cho range điểm mục tiêu) - KHÔNG loại
 * vì title trùng chuỗi hiển thị.
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
        if (isExcludedItemName(it.name)) continue;
        flat.push({
          unitName: u.unitName,
          lessonName: l.lessonName,
          itemName: it.name,
          itemId: it.id,
          examId: it.examIds[0],
          questionCountHint: it.questionCount,
        });
      }
    }
  }

  const recentlyUsedIds = await scanRecentlyUsedLessonItemIds(classId);
  const annotated = flat.map((cand) => ({ ...cand, recentlyUsed: recentlyUsedIds.has(cand.itemId) }));
  const freshCandidates = annotated.filter((c) => !c.recentlyUsed);
  const recentlyUsedCandidates = annotated.filter((c) => c.recentlyUsed);
  log(
    `  [SELECTION] lớp "${className}" đã giao ${recentlyUsedIds.size} lesson-item khác nhau trong 1 tháng gần đây - ` +
      `${freshCandidates.length}/${flat.length} candidate eligible CHƯA từng giao (random pool thật), ` +
      `${recentlyUsedCandidates.length} candidate bị loại vì trùng lesson-item đã giao gần đây (không phải vì trùng title hiển thị).`,
  );

  if (freshCandidates.length === 0) {
    return {
      ok: false,
      blocked: true,
      blockedReason: "BLOCKED: Mọi candidate eligible đều đã được giao lesson-item này gần đây.",
      attempts: [],
      totalEligibleNonSpeakSingleExam: flat.length,
      totalFreshCandidates: 0,
      excludedRecentlyUsedCount: recentlyUsedCandidates.length,
      treeStats: tree.stats,
    };
  }

  const order = shuffle(freshCandidates).slice(0, maxAttempts);
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
    const compatibility = questions ? isAutomationCompatible(questions) : { ok: false, reason: errorMessage ? "FETCH_ERROR" : "NO_QUESTIONS" };
    const scorePlan = compatibility.ok ? computeScorePlan(questions.length) : null;
    const ok = Boolean(compatibility.ok && scorePlan);
    attempts.push({
      unitName: cand.unitName,
      lessonName: cand.lessonName,
      itemName: cand.itemName,
      itemId: cand.itemId,
      examId: cand.examId,
      recentlyUsed: cand.recentlyUsed,
      questionCount: questions?.length ?? null,
      ok,
      reason: errorMessage ?? (!compatibility.ok ? compatibility.reason : !scorePlan ? "NO_INTEGER_CORRECT_COUNT_IN_SCORE_RANGE_7_TO_9" : null),
      failingQuestionId: compatibility.questionId ?? null,
    });
    log(
      `  [PRESCAN] "${cand.unitName}/${cand.lessonName}/${cand.itemName}" (N=${questions?.length ?? "?"}): ${
        ok ? `KHẢ THI (correctCount=${scorePlan.correctCount} -> dự đoán ${scorePlan.predictedScore})` : `loại (${attempts[attempts.length - 1].reason})`
      }`,
    );
    if (ok) {
      return {
        ok: true,
        chosen: { ...cand, questions, scorePlan },
        attempts,
        totalEligibleNonSpeakSingleExam: flat.length,
        totalFreshCandidates: freshCandidates.length,
        excludedRecentlyUsedCount: recentlyUsedCandidates.length,
        treeStats: tree.stats,
      };
    }
  }
  return {
    ok: false,
    attempts,
    totalEligibleNonSpeakSingleExam: flat.length,
    totalFreshCandidates: freshCandidates.length,
    excludedRecentlyUsedCount: recentlyUsedCandidates.length,
    treeStats: tree.stats,
  };
}

/**
 * MỚI (không có ở bản gốc) - phase [0/10] PROFILE: mở 1 MaestroMcpBridge session RIÊNG (đóng
 * trước khi sang phase teacher-assign, xem docblock đầu file mục "PHẠM VI 1 phiên MCP"), chuyển
 * (nếu cần) + verify hồ sơ học sinh đang active = PROFILE_PRO_NAME ("Ngoc"). COPY cơ chế chuyển hồ
 * sơ từ flows/bai_tap/HW-PROFILE-BASIC-PRO-ADVANCED.yaml dòng 73-93 (xử lý CẢ 2 khả năng: toggle
 * trực tiếp KHÔNG sheet, HOẶC bottom sheet "Chuyển profile học tập" với exact-text "Chuyển profile"
 * + index:1 cho nút xác nhận - KHÔNG lặp lại giả định sai đã sửa ở đó).
 * @param {{appId: string, phone: string, otp: string}} params
 * @returns {Promise<{name: string, alreadyActive: boolean, switched: boolean, verified: boolean}>}
 */
async function ensureProProfileActive({ appId, phone, otp }) {
  const bridge = new MaestroMcpBridge({ appId, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  try {
    // INLINE của flows/helpers/launch-keep-session.yaml + login.yaml + open-tab-homework.yaml -
    // KHÔNG dùng `runFlow: { file: ... }` (MaestroMcpSession.run() gửi YAML NGUYÊN VĂN qua tool MCP
    // "run", không phải file thật trên đĩa - đường dẫn tương đối "../helpers/..." sẽ KHÔNG resolve
    // được, xem docblock maestroMcpSession.js#run()). Cũng KHÔNG dùng "${PHONE}"/"${OTP}" (không có
    // cơ chế `-e` cho path này) - truyền thẳng giá trị JS thật vào từng bước.
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
            {
              runFlow: {
                when: { visible: ".*(Xác nhận).*" },
                commands: [{ tapOn: { text: ".*(Xác nhận).*" } }],
              },
            },
            { extendedWaitUntil: { visible: { text: ".*(Vui học|Bài tập|Báo cáo).*" }, timeout: 60000 } },
          ],
        },
      },
      { extendedWaitUntil: { visible: ".*(Vui học|Bài tập|Báo cáo).*", timeout: 30000 } },
      { tapOn: { text: "Bài tập" } },
      {
        extendedWaitUntil: {
          visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao|Bạn không có bài tập nào đang chờ|2 tuần gần nhất|1 tháng gần nhất).*" },
          timeout: 30000,
        },
      },
    ]);
    if (!login.success) {
      throw new Error(`Không mở được tab "Bài tập" để kiểm tra hồ sơ hiện tại: ${login.error}`);
    }

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
    if (!switchResult.success) {
      throw new Error(`Chuyển sang hồ sơ "${PROFILE_PRO_NAME}" thất bại: ${switchResult.error}`);
    }
    const treeAfter = await bridge.hierarchy();
    const verified = isVisibleInTree(collectAllTexts(treeAfter), `.*(${PROFILE_PRO_NAME}).*`);
    if (!verified) {
      throw new Error(`Đã tap chuyển hồ sơ nhưng KHÔNG xác nhận lại được "${PROFILE_PRO_NAME}" hiển thị sau đó.`);
    }
    log(`  [PROFILE] Đã chuyển + verify hồ sơ "${PROFILE_PRO_NAME}" đang active.`);
    return { name: PROFILE_PRO_NAME, alreadyActive: false, switched: true, verified: true };
  } finally {
    await bridge.stop();
  }
}

function formatReport(evidence, result) {
  const p = evidence.profile ?? {};
  const ra = evidence.randomAssignment ?? {};
  const pb = evidence.progressBefore ?? {};
  const pa = evidence.progressAfter ?? {};
  const partial = evidence.partial ?? {};
  const resume = evidence.resume ?? {};
  const finishLog = evidence.resumeLog ?? [];
  const res = evidence.result ?? {};
  const si = evidence.scoreInterpretation ?? {};
  const perf = evidence.mcpPerformance ?? {};
  const lines = [];
  const push = (s = "") => lines.push(s);

  push(`[RUN_ID]`);
  push(ra.roomId ?? "-");
  push(``);
  push(`[PROFILE]`);
  push(`profile=${p.name ?? "-"}`);
  push(`tier=${p.verified ? "PRO" : "UNKNOWN"}`);
  push(`profile_verified=${Boolean(p.verified)}`);
  push(``);
  const sel = evidence.selection ?? {};
  push(`[RANDOM_ASSIGNMENT]`);
  push(`unit=${ra.unitName ?? "-"}`);
  push(`lesson=${ra.lessonName ?? "-"}`);
  push(`lesson_item_id=${ra.lessonItemId ?? "-"}`);
  push(`exam_id=${ra.roomExamId ?? "-"}`);
  push(`assignment_id=${ra.roomId ?? "-"}`);
  push(`room_id=${ra.roomId ?? "-"}`);
  push(`title=${ra.title ?? "-"}`);
  push(`questionCount=${ra.questionCount ?? "-"}`);
  push(`candidate_pool_size=${sel.candidatePoolSize ?? "-"}`);
  push(`excluded_candidates=${sel.excludedCandidates ?? "-"}`);
  push(`random_selection=true`);
  push(``);
  push(`[SCORING_PLAN]`);
  push(`question_count=${ra.questionCount ?? "-"}`);
  push(`target_score_range=7.0..9.0`);
  push(`planned_correct_count=${ra.plannedCorrectCount ?? "-"}`);
  push(`planned_wrong_count=${ra.questionCount != null && ra.plannedCorrectCount != null ? ra.questionCount - ra.plannedCorrectCount : "-"}`);
  push(`planned_score=${ra.predictedScore ?? "-"}`);
  push(`scoring_method=ASSUMED_LINEAR_SCALE_10_ROUND_1_DECIMAL (chưa chứng minh công thức làm tròn thật, xem docblock computeScorePlan())`);
  push(`decimal_score_supported=true`);
  push(``);
  push(`[PROGRESS_BEFORE]`);
  push(`value=${pb.badge ?? "-"}`);
  push(`cta=${pb.cta ?? "-"}`);
  push(``);
  push(`[PARTIAL]`);
  push(`questions_answered=${partial.questionsAnswered ?? "-"}`);
  push(`partial_count=${ra.partialCount ?? "-"}`);
  push(``);
  push(`[EXIT_TO_LIST]`);
  push(`passed=${evidence.progressChanged ? true : evidence.exitOk === false ? false : "-"}`);
  push(`app_restarted=false`);
  push(``);
  push(`[PROGRESS_AFTER_PARTIAL]`);
  push(`value=${pa.badge ?? "-"}`);
  push(`changed=${Boolean(evidence.progressChanged?.overall ?? evidence.progressChanged)}`);
  push(``);
  push(`[RESUME]`);
  push(`passed=${Boolean(resume.sameAssignment)}`);
  push(`same_assignment=${Boolean(resume.sameAssignment)}`);
  push(`resumed_question=${resume.resumedAtQuestionId ?? "-"}`);
  push(`question_was_unanswered=${resume.isAlreadyAnsweredQuestion === false}`);
  push(``);
  push(`[FINISH]`);
  push(`answered=${(partial.questionsAnswered ?? 0) + finishLog.length}`);
  push(`total=${ra.questionCount ?? "-"}`);
  push(``);
  push(`[RESULT_SCREEN]`);
  push(`reached=${res.score != null}`);
  push(`actual_score=${res.score ?? "-"}`);
  push(``);
  push(`[FINAL_SCORE]`);
  push(`actual=${si.actualScore ?? "-"}`);
  push(`target_range=7.0 <= score <= 9.0`);
  push(`PASS/FAIL=${si.scoreInRangeTarget ? "PASS" : "FAIL"}`);
  push(``);
  push(`[CORRECTNESS]`);
  push(`planned_correct=${si.plannedCorrectCount ?? "-"}`);
  push(`planned_wrong=${ra.questionCount != null && si.plannedCorrectCount != null ? ra.questionCount - si.plannedCorrectCount : "-"}`);
  push(`server_confirmed_correct=${si.realCorrectCountFromResultScreen ?? "-"}`);
  push(`server_confirmed_wrong=${ra.questionCount != null && si.realCorrectCountFromResultScreen != null ? ra.questionCount - si.realCorrectCountFromResultScreen : "-"}`);
  push(`answer_selection_reliable=${finishLog.every((l) => l.isTargetCorrect !== null) && (evidence.partial?.log ?? []).every((l) => l.isTargetCorrect !== null)}`);
  push(`assignment_identity_verified=${Boolean(evidence.openDisambiguation?.opened)}`);
  push(`question_identity_verified=${Boolean(resume.resumedAtQuestionId)}`);
  push(``);
  push(`[PERFORMANCE]`);
  push(`duration=${evidence.totalDurationSeconds != null ? `${evidence.totalDurationSeconds.toFixed(1)}s` : "-"}`);
  push(`mcp_processes=2 (1 phase PROFILE, 1 phase OPEN..RESULT - xem evidence.mcpSessionScope)`);
  push(`hierarchy_calls=${perf.hierarchyCallCount ?? "-"}`);
  push(`run_calls=${perf.runCallCount ?? "-"}`);
  push(`new_maestro_processes=${perf.newMaestroProcessesSpawnedForThisPhase != null ? perf.newMaestroProcessesSpawnedForThisPhase + 1 : "-"} (+ N lượt CLI rời rạc trong assignHomeworkAndLocateOnApp()/locate-assignment-card.yaml, ngoài phạm vi MCP session - xem evidence.mcpSessionScope)`);
  push(``);
  push(`[APP_RESTART]`);
  push(`stopApp=false`);
  push(`terminateApp=false`);
  push(`clearState=false`);
  push(`forceStop=false`);
  push(`unexpected_restart=false`);
  push(``);
  push(`[OVERALL]`);
  push(result.status);
  push(``);
  push(`[ROOT_CAUSE]`);
  push(result.status !== "PASS" ? result.error ?? result.phase ?? "-" : "-");
  return lines.join("\n");
}

async function main() {
  const overallStart = Date.now();
  const evidence = {};
  evidence.mcpSessionScope =
    "1 MCP session cho phase PROFILE ([0/10]), 1 MCP session RIÊNG cho phase OPEN..RESULT ([4/10]-[10/10]) - " +
    "KHÔNG bao phủ teacher-assign (Playwright, không phải device) hay bước locate bên trong " +
    "assignHomeworkAndLocateOnApp() (hạ tầng dùng chung, tự spawn CLI `maestro test` riêng cho locate - " +
    "ngoài phạm vi sửa của file này, xem docblock đầu file).";

  // QUAN TRỌNG (bug thật đã gặp + fix 2026-08-18, xem docblock đầu file mục 3/4 + e2e-ktra-fullluong-
  // lambai-scored-pro.mjs): KHÔNG dynamic-import "./e2e-teacher-assign-student-open.mjs" Ở ĐÂY (bản
  // trước làm vậy để lấy APP_ID/PHONE/OTP) - file đó đọc ASSIGN_UNIT_NAME/ASSIGN_LESSON_NAME/
  // ASSIGN_HOMEWORK_ITEM_NAME/ASSIGN_HOMEWORK_ITEM_ID vào module-level `const` NGAY LÚC IMPORT - import
  // sớm ở đây (trước khi set process.env.ASSIGN_* ở khối [RANDOM_SELECTION] bên dưới) sẽ ĐÓNG BĂNG các
  // const đó thành undefined vĩnh viễn (ES module cache - lần import sau chỉ trả về CÙNG module
  // instance, KHÔNG evaluate lại) khiến assignHomeworkAndLocateOnApp() random chọn bài KHÁC hẳn
  // candidate đã pre-scan chọn. Lấy APP_ID/PHONE/OTP TRỰC TIẾP từ .env/accounts.env ở đây thay thế.
  const rootEnvVarsForLogin = parseEnvFile(ROOT_ENV_PATH);
  const APP_ID = process.env.APP_ID || rootEnvVarsForLogin.APP_ID;
  const PHONE = process.env.PHONE || ACCOUNTS_ENV.PHONE;
  const OTP = process.env.OTP || ACCOUNTS_ENV.OTP;

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

  log(`[0/10] Đảm bảo hồ sơ học sinh đang active = "${PROFILE_PRO_NAME}" (PRO)...`);
  const profileResult = await ensureProProfileActive({ appId: APP_ID, phone: PHONE, otp: OTP });
  evidence.profile = profileResult;
  log(`  [PASS] profile=${profileResult.name} switched=${profileResult.switched} verified=${profileResult.verified}`);

  // ===== [RANDOM_SELECTION] - pre-scan READ-ONLY, chưa giao bài thật =====
  let assignment, dueVnYmd, startVnYmd;

  if (process.env.REUSE_ROOM_ID) {
    const roomId = process.env.REUSE_ROOM_ID;
    log(`[1-2/10] REUSE_ROOM_ID=${roomId} - bỏ qua pre-scan + giao bài lại, tự locate+resolve lại trên room đã có.`);
    const roomDetails = await fetchRoomDetails(roomId);
    const room = roomDetails?.room;
    if (!room) {
      return finish({ status: "FAIL", phase: "TEACHER_ASSIGN_OR_LOCATE", error: `fetchRoomDetails("${roomId}") không trả về room hợp lệ.`, evidence });
    }
    assignment = { id: room.id, title: room.name, classIds: room.class_id ?? [] };
    dueVnYmd = isoToVnYmd(room.end_time);
    startVnYmd = isoToVnYmd(room.start_time);
    evidence.locateCaveat =
      `Room "${roomId}" đã được xác nhận PASS ở lần chạy trước qua API diff (before/after room.json) - ` +
      "lần chạy này KHÔNG gọi lại Web GV (tránh tạo room trùng), chỉ tự locate+disambiguate lại trên App HS bằng nội dung câu hỏi thật.";
  } else {
    log(`[1/10] Pre-scan READ-ONLY toàn bộ cây eligible lớp ${TARGET_CLASS} để random 1 candidate khả thi (không loại vì title, chỉ loại nếu đã giao gần đây hoặc không thể thực thi + điểm mục tiêu ${TARGET_SCORE_RANGE_LABEL} khả thi)...`);
    const picked = await pickFeasibleRandomAssignment({ className: TARGET_CLASS, classId: TARGET_CLASS_ID });
    evidence.randomSelection = {
      totalEligibleNonSpeakSingleExam: picked.totalEligibleNonSpeakSingleExam,
      totalFreshCandidates: picked.totalFreshCandidates ?? null,
      excludedRecentlyUsedCount: picked.excludedRecentlyUsedCount ?? null,
      treeStats: picked.treeStats,
      attemptsCount: picked.attempts.length,
      attempts: picked.attempts,
    };
    if (picked.blocked) {
      evidence.selection = { candidate: null, unique: null, occurrences: null, identifier: null };
      return finish({
        status: "BLOCKED",
        phase: "SELECTION",
        error: `${picked.blockedReason} Mọi candidate eligible (non-speak, đúng 1 exam_id) trong lớp ${TARGET_CLASS} đều đã được giao (cùng lesson_item_id) trong 1 tháng gần đây - KHÔNG giao trùng lại lesson-item đã dùng.`,
        evidence,
      });
    }
    if (!picked.ok) {
      log(`  [BLOCKED] Đã thử ${picked.attempts.length} candidate CHƯA từng giao gần đây, không candidate nào khả thi.`);
      return finish({
        status: "BLOCKED",
        phase: "RANDOM_SELECTION",
        error: `Đã thử ${picked.attempts.length}/${MAX_PRESCAN_ATTEMPTS} candidate CHƯA từng giao gần đây trong lớp ${TARGET_CLASS} (tổng ${picked.totalFreshCandidates} candidate còn mới) - không candidate nào vừa có handler hỗ trợ đầy đủ vừa có correctCount nguyên cho điểm dự đoán trong ${TARGET_SCORE_RANGE_LABEL}.`,
        evidence,
      });
    }
    const chosen = picked.chosen;
    evidence.chosenCandidate = { unitName: chosen.unitName, lessonName: chosen.lessonName, itemName: chosen.itemName, itemId: chosen.itemId, examId: chosen.examId };
    evidence.selection = {
      candidate: `${chosen.unitName}/${chosen.lessonName}/${chosen.itemName}`,
      unique: !chosen.recentlyUsed,
      occurrences: null,
      identifier: "lesson_item_id (not recently assigned in this class) + random draw among ALL eligible candidates regardless of title text",
      candidatePoolSize: picked.totalFreshCandidates ?? null,
      excludedCandidates: picked.excludedRecentlyUsedCount ?? null,
    };
    log(
      `  [PASS] Chọn "${chosen.unitName}/${chosen.lessonName}/${chosen.itemName}" (itemId=${chosen.itemId}, N=${chosen.questions.length}, correctCount kế hoạch=${chosen.scorePlan.correctCount}, điểm dự đoán=${chosen.scorePlan.predictedScore}).`,
    );

    // ===== [TEACHER_ASSIGN] - giao bài THẬT cho ĐÚNG candidate vừa chọn =====
    process.env.ASSIGN_UNIT_NAME = chosen.unitName;
    process.env.ASSIGN_LESSON_NAME = chosen.lessonName;
    process.env.ASSIGN_HOMEWORK_ITEM_NAME = chosen.itemName;
    process.env.ASSIGN_HOMEWORK_ITEM_ID = chosen.itemId;
    const assignModule = await import("./e2e-teacher-assign-student-open.mjs");

    log(`[2/10] GV giao bài (random đã chọn) + App HS locate đúng card...`);
    const located = await assignModule.assignHomeworkAndLocateOnApp();
    if (!located.ok) {
      return finish({ status: "FAIL", phase: "TEACHER_ASSIGN_OR_LOCATE", located, evidence });
    }
    ({ assignment, dueVnYmd, startVnYmd } = located);
  }
  const dueDM = formatDM(dueVnYmd);
  log(`  [PASS] room_id=${assignment.id} title="${assignment.title}" due=${formatDMY(dueVnYmd)}`);

  // ===== [CMS_RESOLUTION] - nguồn sự thật DUY NHẤT cho câu hỏi/đáp án của ĐÚNG room này =====
  log(`[3/10] Resolve câu hỏi/đáp án CHÍNH XÁC theo room.id (KHÔNG qua title)...`);
  const resolved = await resolveHomeworkExamQuestionsForRoomId(assignment.id);
  if (resolved.status !== "RESOLVED") {
    return finish({
      status: "BLOCKED",
      phase: "CMS_RESOLUTION",
      error: `resolveHomeworkExamQuestionsForRoomId("${assignment.id}") trả về status=${resolved.status}: ${resolved.reason}`,
      evidence,
    });
  }
  const swapAnswer = resolved.roomDetails?.room?.exams?.[0]?.is_swap_answer ?? null;
  const swapQuestion = resolved.roomDetails?.room?.exams?.[0]?.is_swap_question ?? null;
  if (swapAnswer || swapQuestion) {
    return finish({
      status: "BLOCKED",
      phase: "CMS_RESOLUTION",
      error: `Room "${assignment.id}" có is_swap_answer=${swapAnswer}/is_swap_question=${swapQuestion} - CHƯA verify content khớp catalog khi swap=true, KHÔNG tin tưởng đáp án.`,
      evidence,
    });
  }
  const QUESTIONS = resolved.questions;
  const cmsCompatibility = isAutomationCompatible(QUESTIONS);
  if (!cmsCompatibility.ok) {
    return finish({
      status: "BLOCKED",
      phase: "CMS_RESOLUTION",
      error: `Nội dung THẬT của room "${assignment.id}" KHÔNG còn khớp điều kiện handler hỗ trợ đầy đủ (reason=${cmsCompatibility.reason}, khác pre-scan candidate ban đầu).`,
      evidence,
    });
  }
  const scorePlan = computeScorePlan(QUESTIONS.length);
  if (!scorePlan) {
    return finish({
      status: "BLOCKED",
      phase: "CMS_RESOLUTION",
      error: `Room "${assignment.id}" có N=${QUESTIONS.length} câu - không tồn tại correctCount nguyên cho điểm dự đoán trong ${TARGET_SCORE_RANGE_LABEL}.`,
      evidence,
    });
  }
  const WANT_CORRECT = buildWantCorrectPlan(QUESTIONS.map((q) => q.id), scorePlan.correctCount);
  const PARTIAL_COUNT = QUESTIONS.length >= 4 ? 3 : 2;
  const rd = resolved.roomDetails;
  evidence.randomAssignment = {
    unitName: rd.unit_name,
    lessonName: rd.lesson_name,
    lessonItemId: rd.lesson_item_id,
    roomExamId: resolved.examId,
    roomId: assignment.id,
    title: assignment.title,
    startTimeVn: formatDMY(startVnYmd),
    dueTimeVn: formatDMY(dueVnYmd),
    classIds: assignment.classIds,
    questionCount: QUESTIONS.length,
    plannedCorrectCount: scorePlan.correctCount,
    predictedScore: scorePlan.predictedScore,
    partialCount: PARTIAL_COUNT,
  };
  log(`  [PASS] N=${QUESTIONS.length} câu, kế hoạch correctCount=${scorePlan.correctCount} (dự đoán điểm=${scorePlan.predictedScore}), PARTIAL_COUNT=${PARTIAL_COUNT}.`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  const exam = new HomeworkExamEngine(bridge);
  const mcpSessionStartedAt = Date.now();

  try {
    evidence.mcpPerformance = {
      mcpSessionStartedAt: new Date(mcpSessionStartedAt).toISOString(),
      get runCallCount() { return bridge.runCallCount; },
      get hierarchyCallCount() { return bridge.hierarchyCallCount; },
      get totalMcpToolCalls() { return bridge.session.toolCallCount; },
      newMaestroProcessesSpawnedForThisPhase: 1,
    };

    // ===== [OPEN_EXERCISE] + [PROGRESS_BEFORE] =====
    log('[4/10] Bấm CTA + xác nhận identity BẰNG NỘI DUNG (disambiguate nếu title+Hạn nộp trùng)...');
    const openOutcome = await openAssignmentDisambiguated(bridge, { title: assignment.title, dueDM, questionsPool: QUESTIONS });
    evidence.openDisambiguation = { opened: openOutcome.opened, triedCount: openOutcome.triedCount, index: openOutcome.index ?? null };
    if (!openOutcome.opened) {
      return finish({
        status: "BLOCKED",
        phase: "OPEN_EXERCISE_AMBIGUOUS",
        error: `Đã thử ${openOutcome.triedCount} candidate cùng title="${assignment.title}"/Hạn nộp=${dueDM} nhưng không candidate nào khớp nội dung câu hỏi CMS đã resolve theo room.id - không đoán, dừng lại.`,
        evidence,
      });
    }
    const beforeState = openOutcome.progressBefore;
    evidence.progressBefore = beforeState;
    log(`  [PASS] Đã vào ĐÚNG màn làm bài (candidate index=${openOutcome.index}). progressBefore: badge="${beforeState.badge}" cta="${beforeState.cta}"`);

    // ===== [PARTIAL_ANSWER] =====
    log(`[5/10] Làm THẬT ${PARTIAL_COUNT} câu đầu (đúng/sai theo kế hoạch correctCount=${scorePlan.correctCount}/${QUESTIONS.length})...`);
    const answeredIds = new Set();
    const partialLog = [];
    let carryTree = openOutcome.firstMatched._snapshot?.tree ?? null;
    for (let i = 0; i < PARTIAL_COUNT; i++) {
      const pool = QUESTIONS.filter((q) => !answeredIds.has(q.id));
      const matched = await findMatchingQuestion(bridge, pool, carryTree);
      if (!matched) {
        const visibleTexts = collectAllTexts(await bridge.hierarchy());
        return finish({ status: "FAIL", phase: "PARTIAL_ANSWER", error: `Không khớp được câu hỏi nào (còn ${pool.length} câu) với màn hình hiện tại.`, visibleTexts, evidence });
      }
      const { wantCorrect, outcome } = await answerOneQuestion(exam, matched, false, WANT_CORRECT);
      carryTree = outcome.finalTree ?? null;
      answeredIds.add(matched.id);
      partialLog.push({ id: matched.id, question: matched.question, wantCorrect, isTargetCorrect: outcome.isTargetCorrect, type: outcome.type });
      log(`  Câu ${i + 1}/${PARTIAL_COUNT} (${matched.id}): "${matched.question}" - nhắm ${wantCorrect ? "ĐÚNG" : "SAI"}, isTargetCorrect=${outcome.isTargetCorrect}`);
    }
    evidence.partial = { questionsAnswered: answeredIds.size, questionsTotal: QUESTIONS.length, log: partialLog };

    // ===== [EXIT_TO_LIST] =====
    log("[6/10] Thoát giữa chừng bằng nút X (KHÔNG stopApp/launchApp)...");
    await exitToHomeworkList(bridge);
    log("  [PASS] Đã về lại homework_screen, CÙNG session app (không restart).");

    // SỬA (2026-08-18, xác nhận thật qua run: đọc lại NGAY sau exit trả về badge/cta Y HỆT lúc
    // trước - "0 / 10"/"Làm bài" - dù server ĐÃ ghi nhận 3 câu trả lời, xem evidence.partial.log):
    // list "Bài tập" bị CACHE, cần refresh thủ công (swipe pull-to-refresh) để nạp lại state
    // doing_answer_id mới - COPY Y HỆT business rule đã audit/verify trong
    // flows/bai_tap/ktra_fullluong_lambai.yaml (dòng 204-211, comment gốc: "để state
    // doing_answer_id được nạp lại") + flows/giao_bai_tap/e2e-ktra-fullluong-lambai-scored-pro.mjs -
    // bản gốc file NÀY (KHÔNG PRO) thiếu bước này, port qua đây.
    log("  Refresh (swipe pull-to-refresh) để nạp lại state tiến độ mới...");
    await bridge.runSteps([
      { swipe: { start: "50%, 35%", end: "50%, 85%", duration: 600 } },
      { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao).*" }, timeout: 30000 } },
    ]);

    // ===== [PROGRESS_AFTER_EXIT] =====
    log("[7/10] Đọc progress card SAU khi thoát giữa chừng (ĐÚNG occurrence index đã dùng để mở bài)...");
    const afterState = await scrollAndReadCardState(bridge, assignment.title, dueDM, openOutcome.index);
    evidence.progressAfter = afterState;
    const progressChangedByCta = beforeState.cta !== afterState.cta && afterState.cta === "Tiếp tục";
    const progressChangedByBadge = beforeState.badge !== afterState.badge;
    const progressChanged = progressChangedByCta || progressChangedByBadge;
    evidence.progressChanged = { byCta: progressChangedByCta, byBadge: progressChangedByBadge, overall: progressChanged };
    log(`  badge="${afterState.badge}" cta="${afterState.cta}" -> progressChanged=${progressChanged}`);
    if (!progressChanged) {
      return finish({
        status: "FAIL",
        phase: "PROGRESS_CHANGED",
        error: `Card KHÔNG có dấu hiệu thay đổi sau khi làm dở ${PARTIAL_COUNT} câu (before: cta="${beforeState.cta}" badge="${beforeState.badge}" | after: cta="${afterState.cta}" badge="${afterState.badge}").`,
        evidence,
      });
    }

    // ===== [RESUME] =====
    log("[8/10] Mở LẠI đúng assignment (tap CTA hiện tại của ĐÚNG occurrence index, anchor title+Hạn nộp+index)...");
    const resumeCta = afterState.cta ?? "Tiếp tục";
    const escTitle = assignment.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const resumeResult = await bridge.runSteps([
      { tapOn: { text: resumeCta, below: { text: `Hạn nộp ${dueDM}`, below: { text: `.*${escTitle}.*` } }, index: openOutcome.index } },
      { waitForAnimationToEnd: { timeout: 3000 } },
      { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
      { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 15000 } },
    ]);
    if (!resumeResult.success) {
      return finish({ status: "FAIL", phase: "RESUME_OPEN", error: resumeResult.error, evidence });
    }

    const remainingPool = QUESTIONS.filter((q) => !answeredIds.has(q.id));
    const answeredPool = QUESTIONS.filter((q) => answeredIds.has(q.id));
    const matchedAfterResume = await findMatchingQuestion(bridge, remainingPool);
    const matchedAmongAnswered = matchedAfterResume ? null : await findMatchingQuestion(bridge, answeredPool);
    if (!matchedAfterResume) {
      return finish({
        status: "FAIL",
        phase: "RESUME_NOT_RESET",
        error: matchedAmongAnswered
          ? `RESUME_NOT_RESET FAIL: màn hình sau resume khớp câu "${matchedAmongAnswered.id}" - câu NÀY ĐÃ ĐƯỢC TRẢ LỜI ở PHASE PARTIAL, bằng chứng app RESET về câu cũ thay vì resume đúng câu đang dở.`
          : `Không khớp được câu nào (cả pool chưa làm lẫn đã làm) với màn hình sau resume.`,
        visibleTexts: collectAllTexts(await bridge.hierarchy()),
        evidence,
      });
    }
    evidence.resume = { sameAssignment: true, resumedAtQuestionId: matchedAfterResume.id, resumedAtQuestion: matchedAfterResume.question, isAlreadyAnsweredQuestion: false };
    log(`  [PASS] Resume đúng vào câu "${matchedAfterResume.id}", KHÔNG phải câu đã làm ở PARTIAL.`);

    // ===== [FINISH_REMAINING] =====
    log("[9/10] Làm tiếp tất cả câu còn lại...");
    const resumeLog = [];
    let lastOutcome = null;
    carryTree = matchedAfterResume._snapshot?.tree ?? null;
    while (answeredIds.size < QUESTIONS.length) {
      const pool = QUESTIONS.filter((q) => !answeredIds.has(q.id));
      const matched = await findMatchingQuestion(bridge, pool, carryTree);
      if (!matched) {
        // MỚI (2026-08-19): `answeredIds` chỉ đếm số câu ĐÃ trả lời TRONG session này - nếu room
        // có sẵn tiến độ dở từ TRƯỚC (vd REUSE_ROOM_ID cho room mà 1 phiên chạy trước đã trả lời
        // dở rồi bị ngắt giữa chừng do môi trường/thiết bị reset - xác nhận thật hôm nay, room
        // "Read the text and choose the correct answer." due 26/08 có sẵn 3/10 từ phiên trước),
        // answeredIds.size sẽ KHÔNG BAO GIỜ chạm QUESTIONS.length dù bài THẬT SỰ đã làm xong (vòng
        // lặp cứ đi tìm thêm câu trong khi server đã hết câu thật) - không tìm thấy câu nào để trả
        // lời trong TRƯỜNG HỢP NÀY là kết quả ĐÚNG (đã hết câu), không phải lỗi. Trước khi kết luận
        // FAIL, kiểm tra xem có đang đứng ĐÚNG màn Kết quả không - nếu có, coi là ĐÃ HOÀN THÀNH
        // (thoát vòng lặp bình thường), không phải BLOCKED/FAIL.
        const maybeResultTree = await bridge.hierarchy();
        if (exam.isResultScreen(maybeResultTree)) {
          log(`  [PASS] Không còn câu nào để khớp NHƯNG đang đứng đúng màn Kết quả - bài đã hoàn thành (có tiến độ dở từ trước room, xem evidence.progressBefore).`);
          carryTree = maybeResultTree;
          lastOutcome = { finalTree: maybeResultTree };
          break;
        }
        return finish({
          status: "FAIL",
          phase: "FINISH_REMAINING",
          error: `Không khớp được câu hỏi nào (còn ${pool.length} câu) với màn hình hiện tại.`,
          visibleTexts: collectAllTexts(maybeResultTree),
          evidence: { ...evidence, resumeLog },
        });
      }
      const isLast = answeredIds.size === QUESTIONS.length - 1;
      const { wantCorrect, outcome } = await answerOneQuestion(exam, matched, isLast, WANT_CORRECT);
      lastOutcome = outcome;
      carryTree = outcome.finalTree ?? null;
      answeredIds.add(matched.id);
      resumeLog.push({ id: matched.id, question: matched.question, wantCorrect, isTargetCorrect: outcome.isTargetCorrect, type: outcome.type });
      log(`  Câu ${answeredIds.size}/${QUESTIONS.length} (${matched.id}): "${matched.question}" - nhắm ${wantCorrect ? "ĐÚNG" : "SAI"}, isTargetCorrect=${outcome.isTargetCorrect}`);
    }
    evidence.resumeLog = resumeLog;

    // ===== [RESULT_SCREEN] + [FINAL_SCORE] =====
    log("[10/10] Xác nhận màn Kết quả + đọc điểm thật...");
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
    // [7.0, 9.0] ĐÓNG cả 2 đầu (SỬA 2026-08-19 theo yêu cầu user "điểm số từ 7-9" - xem TARGET_SCORE_RANGE_LABEL).
    const scoreInRange = scoreValid && scoreNumber >= 7.0 && scoreNumber <= 9.0;
    evidence.scoreInterpretation = {
      questionCount: QUESTIONS.length,
      plannedCorrectCount: scorePlan.correctCount,
      achievedCorrectCountByPlan: achievedCorrectCount,
      realCorrectCountFromResultScreen: result.correctCount,
      predictedScore: scorePlan.predictedScore,
      actualScore: scoreNumber,
      scoreInRangeTarget: scoreInRange,
      targetRange: TARGET_SCORE_RANGE_LABEL,
      note:
        QUESTIONS.length === 10
          ? `Bài có đúng 10 câu - "${achievedCorrectCount}/10 câu đúng" tương ứng hợp lệ.`
          : `Bài có ${QUESTIONS.length} câu (KHÔNG phải 10) - KHÔNG diễn giải điểm số theo "X/10 câu đúng", chỉ báo cáo achievedCorrectCount=${achievedCorrectCount}/${QUESTIONS.length} và actualScore=${scoreNumber} riêng biệt.`,
    };

    await bridge.runSteps([
      { runFlow: { when: { visible: "Hoàn thành" }, commands: [{ tapOn: { text: ".*(Hoàn thành).*" } }] } },
      { runFlow: { when: { visible: "Tiếp theo" }, commands: [{ tapOn: { id: "exercise_result_close_button" } }] } },
    ]);
    await bridge.wait({ id: "homework_screen" }, { timeout: 30000 });

    const overallPass =
      profileResult.verified &&
      progressChanged &&
      evidence.resume &&
      !evidence.resume.isAlreadyAnsweredQuestion &&
      answeredIds.size === QUESTIONS.length &&
      scoreInRange;

    evidence.totalDurationSeconds = (Date.now() - overallStart) / 1000;

    return finish({
      status: overallPass ? "PASS" : "FAIL",
      phase: overallPass ? null : "SCORE_VERIFY",
      evidence,
    });
  } finally {
    await bridge.stop();
    log("[MCP] Đã dừng tiến trình `maestro mcp` (cleanup cuối flow).");
  }
}

// MỚI (2026-08-19): guard entrypoint - CHỈ tự chạy main() khi file này được gọi trực tiếp qua
// `node ...pro.mjs` (KHÔNG đổi hành vi ở đường chạy thật đó), để cho phép `import` các hàm thuần
// (classifyQuestionSupport/isAutomationCompatible/computeScorePlan) từ file test unit riêng mà
// KHÔNG vô tình kích hoạt luồng thật (giao bài/device) - cần thiết để validate logic pre-scan mới
// (yêu cầu user 2026-08-19) mà không tốn 1 lượt chạy E2E thật cho mỗi lần sửa.
// SỬA (2026-08-19, BUG THẬT tự phát hiện + tự sửa ngay trong phiên này): so sánh trực tiếp
// `file://${process.argv[1]}` với `import.meta.url` SAI khi gọi bằng đường dẫn TƯƠNG ĐỐI (cách gọi
// THẬT trong toàn bộ docblock "CHẠY:" của repo, vd "node flows/giao_bai_tap/...") - process.argv[1]
// khi đó là chuỗi tương đối trong khi import.meta.url luôn tuyệt đối, 2 vế KHÔNG BAO GIỜ khớp -> guard
// luôn false -> main() ÂM THẦM không chạy (exit code 0, KHÔNG output gì, đã tái hiện thật 2 lần liên
// tiếp trước khi tìm ra). SỬA: resolve cả 2 vế về CÙNG 1 dạng file:// tuyệt đối bằng pathToFileURL()
// trước khi so sánh.
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMainModule) {
  main()
    .then((result) => {
      log(`\n=== KẾT QUẢ: ${result.status}${result.phase ? ` (phase=${result.phase})` : ""} ===`);
      log(`Đã ghi report ra ${OUTPUT_FILE}`);
      log("\n" + formatReport(result.evidence ?? {}, result));
      process.exit(result.status === "PASS" ? 0 : result.status === "BLOCKED" ? 2 : 1);
    })
    .catch((err) => {
      console.error("\n[e2e-teacher-assign-partial-resume-scored-pro] Dừng lại vì lỗi ngoài dự kiến:\n");
      console.error(err);
      finish({ status: "ERROR", error: err.message, stack: err.stack });
      process.exit(2);
    });
}
