#!/usr/bin/env node
/**
 * E2E-Teacher-Assign-Partial-Resume-Scored (bản RANDOM, 2026-08-17 - thay hẳn bản PINNED cũ)
 *
 * Lifecycle ĐẦY ĐỦ "hành vi giống USER THẬT":
 *
 *   GV giao 1 bài MỚI random (Web GV, Playwright) -> App HS nhận đúng assignment -> HS mở đúng bài
 *   -> làm THẬT 2-3 câu đầu (đáp án lấy từ CMS, KHÔNG đoán) -> thoát bằng nút X (UI thật, KHÔNG
 *   stopApp/launchApp) -> quay về danh sách Bài tập (VẪN CÙNG session app) -> đọc progress của
 *   ĐÚNG card đó -> mở LẠI ĐÚNG bài đó -> xác nhận RESUME -> làm hết câu còn lại -> màn Kết quả ->
 *   đọc điểm THẬT -> verify điểm nằm trong [7.0, 8.0) (7.0 PASS, 8.0 KHÔNG PASS - KHÔNG ưu
 *   tiên riêng giá trị 7, không hardcode 7/10, xem computeScorePlan()).
 *
 * KHÁC bản PINNED cũ (2026-08-17, theo yêu cầu mới - xem hội thoại cùng ngày):
 *   1. KHÔNG còn pin cứng "Unit 1: Hello/Lesson 1/Choose the correct answer." - RANDOM thật trong
 *      TOÀN BỘ cây eligible của lớp (mọi Unit/Lesson), nhưng CHỈ trong tập con đã pre-scan READ-ONLY
 *      xác nhận (a) KHÔNG phải SPEAK, (b) đúng 1 exam_id (không AMBIGUOUS), (c) MỌI câu có
 *      correctAnswer hợp lệ + >=2 đáp án dạng chữ (khớp đúng 2 chiến lược mà decideAnswerAction() hỗ
 *      trợ - KHÔNG né SPEAK/CONNECT/DRAG_DROP theo kiểu "chọn lại cho dễ", mà vì bài KHÔNG kiểm soát
 *      được đúng/sai thì không thể nhắm điểm theo yêu cầu đề bài - xem pickFeasibleRandomAssignment()),
 *      (d) tồn tại correctCount nguyên cho điểm dự đoán nằm trong [7.0, 8.0) theo công thức GIẢ ĐỊNH
 *      (xem mục 2). KHÔNG hardcode QUESTIONS/correctCount - tất cả resolve tại runtime.
 *   2. KHÔNG còn giả định cứng "7 đúng/10 câu = điểm 7" - tổng số câu N của bài random ra QUYẾT ĐỊNH
 *      correctCount cần thiết. Công thức GIẢ ĐỊNH (thang điểm 10 tỉ lệ thuận, làm tròn 1 chữ số -
 *      CHƯA có đủ dữ liệu thật để chứng minh, xem docblock computeScorePlan()) chỉ dùng để LẬP KẾ
 *      HOẠCH trước - PASS/FAIL cuối cùng dựa vào ĐIỂM THẬT đọc được trên màn Kết quả, không fake.
 *   3. Định danh assignment/progress KHÔNG còn dựa vào (title, occurrenceIndex-theo-title) - đã xác
 *      nhận THẬT (2026-08-17) lớp 3B có tới 5+ room cùng title "Choose the correct answer." ở NHIỀU
 *      Hạn nộp khác nhau, khiến readCardState() bản cũ (title-only) đọc NHẦM progress của 1 card
 *      khác (Hạn nộp 21/08 thay vì 24/08). Bản này BẮT BUỘC anchor cả (title, Hạn nộp) khi đếm
 *      occurrence (xem readCardState()), và đọc CTA thật của ĐÚNG occurrence trước khi tap (xem
 *      openAssignmentDisambiguated()) - không còn dùng 1 `cta` cố định cho mọi candidate.
 *   4. maxCandidates disambiguate: không còn cố định 3 (đã gây FAIL thật OPEN_EXERCISE_AMBIGUOUS
 *      2026-08-17 vì lớp có sẵn 4 room khác cùng lesson_item_id do các lần chạy test trước để lại) -
 *      nâng lên 10, vẫn CÓ giới hạn (không lặp vô hạn), hết candidate -> BLOCKED_AMBIGUOUS_MATCH.
 *
 * TÁI SỬ DỤNG (không viết lại):
 *   - assignHomeworkAndLocateOnApp() (e2e-teacher-assign-student-open.mjs) - Web GV + matching App
 *     HS, PIN theo ASSIGN_HOMEWORK_ITEM_ID/NAME đã random chọn được ở bước pre-scan (không còn giá
 *     trị cố định qua ENV thủ công như bản cũ).
 *   - MaestroMcpBridge (bridge/maestroMcpBridge.js, MỚI 2026-08-17, đã smoke-test + verify thật qua
 *     1 lượt chạy thành công tới OPEN_EXERCISE) - 1 tiến trình `maestro mcp` DUY NHẤT xuyên suốt
 *     toàn bộ phần thao tác thiết bị, KHÔNG spawn CLI mới cho từng tương tác.
 *   - HomeworkExamEngine (bai_tap/navigation/homeworkExamEngine.js) - decideAnswerAction()/
 *     answerCurrentQuestionOneShot(), KHÔNG sửa thêm (đã sửa đúng 1 dòng await ở lượt trước, xem
 *     git log cùng ngày).
 *   - resolveHomeworkExamQuestionsForRoomId() (bai_tap/discovery/teacherMaterialsExamResolver.js,
 *     MỚI 2026-08-17) - resolve câu hỏi/đáp án CHÍNH XÁC theo room.id (KHÔNG qua title, tránh đúng
 *     bug duplicate-title ở mục 3 trên) - dùng làm NGUỒN SỰ THẬT DUY NHẤT cho QUESTIONS của room vừa
 *     được giao (pre-scan chỉ dùng để CHỌN candidate, không dùng content pre-scan để trả lời thật).
 *   - fetchEligibleAssignmentTree()/parseQuestionsFromExamPage()/normalizeQuestions() - pre-scan
 *     read-only toàn bộ cây eligible + đọc thử nội dung candidate (KHÔNG side-effect, không giao bài
 *     thật cho tới khi đã chọn xong 1 candidate khả thi).
 *
 * CHẠY: node flows/giao_bai_tap/e2e-teacher-assign-partial-resume-scored.mjs
 * ENV: giống e2e-teacher-assign-student-open.mjs (APP_ID/PHONE/OTP/MAESTRO_DEVICE, TEACHER_* trong
 *   .env cho Playwright, ASSIGN_PRIMARY_CLASS default "3B") - KHÔNG set ASSIGN_UNIT_NAME/
 *   ASSIGN_LESSON_NAME/ASSIGN_HOMEWORK_ITEM_NAME/ASSIGN_HOMEWORK_ITEM_ID (file này tự set sau khi
 *   random chọn xong candidate khả thi, TRƯỚC khi dynamic-import assignHomeworkAndLocateOnApp()).
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MaestroMcpBridge } from "../../../automation/bridge/maestroMcpBridge.js";
import { HomeworkExamEngine, decideAnswerAction } from "../../../automation/bai_tap/navigation/homeworkExamEngine.js";
import { fetchEligibleAssignmentTree } from "../../../automation/giao_bai_tap/navigation/teacherAssignmentApiDiscovery.js";
import { parseQuestionsFromExamPage } from "../../../automation/discovery/examPageScraper.js";
import { normalizeQuestions } from "../../../automation/model/questionModel.js";
import { resolveHomeworkExamQuestionsForRoomId } from "../../../automation/bai_tap/discovery/teacherMaterialsExamResolver.js";
import { fetchRoomDetails } from "../../../automation/bai_tap/discovery/homeworks.js";
import { formatDM, formatDMY, isoToVnYmd } from "../../../automation/bai_tap/verify-filter-web-vs-app.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "e2e_teacher_assign_partial_resume_scored_report.json");
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const TARGET_CLASS = process.env.ASSIGN_PRIMARY_CLASS || "3B";
const MAX_PRESCAN_ATTEMPTS = Number(process.env.MAX_PRESCAN_ATTEMPTS || 12);
const MAX_DISAMBIGUATE_CANDIDATES = Number(process.env.MAX_DISAMBIGUATE_CANDIDATES || 10);

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

/**
 * Đọc badge N/M + CTA thô của ĐÚNG 1 card (title + Hạn nộp) từ hierarchy hiện tại. FIX
 * (2026-08-17, root-cause thật của FAIL trước đó): bản cũ chỉ anchor theo `title`, đếm
 * occurrenceIndex KHÔNG phân biệt Hạn nộp - lớp 3B có sẵn 2 assignment cùng title nhưng KHÁC Hạn
 * nộp (24/08 vs 21/08), khiến occurrenceIndex=0 đọc NHẦM sang card 21/08 (đã xác nhận qua
 * `progressBefore.dueLine` thật = "Hạn nộp 21/08" trong lần chạy trước). Bản này CHỈ đếm occurrence
 * nào có `Hạn nộp ${dueDateDm}` xuất hiện NGAY SAU title (trong window 10 dòng) - loại hẳn occurrence
 * trùng title nhưng khác Hạn nộp trước khi đếm occurrenceIndex.
 */
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

/**
 * Mở ĐÚNG assignment khi title+Hạn nộp KHÔNG unique trên UI (đã xác nhận THẬT 2026-08-17: lớp 3B
 * có thể có >=4-5 room cùng title/Hạn nộp tích tụ từ các lần chạy test trước). Disambiguate bằng
 * NỘI DUNG THẬT (questionsPool đã resolve CHÍNH XÁC theo room.id, xem main()) - mở candidate, kiểm
 * tra câu hỏi hiển thị có khớp bộ questionsPool hay không; nếu KHÔNG khớp, thoát rồi thử candidate
 * kế tiếp. CTA tap dùng ĐÚNG CTA đọc được của TỪNG occurrence (KHÔNG dùng 1 CTA cố định cho mọi
 * candidate - fix cùng lúc với readCardState(), vì các room trùng title có thể ở trạng thái CTA
 * khác nhau: 1 số "Làm bài" (chưa đụng), 1 số "Tiếp tục" (đã dở từ lần chạy test trước)).
 * Trả kèm `progressBefore` = state đọc được NGAY TRƯỚC lúc tap candidate KHỚP - đây chính là card
 * ĐÚNG (không còn tách rời bước đọc progress-before khỏi bước disambiguate như bản cũ, loại bỏ hẳn
 * rủi ro đọc nhầm card).
 */
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

/** scrollToCard() + readCardState(), cuộn thêm AN TOÀN nếu chưa thấy đủ CTA - xem docblock
 * scrollToCard() cho root-cause + LÝ DO AN TOÀN (KHÔNG target trực tiếp text CTA để cuộn - đã xác
 * nhận THẬT 2026-08-17 trên thiết bị rằng `scrollUntilVisible` nhắm ĐÚNG vào text nút bấm CÓ THỂ vô
 * tình TAP luôn nút đó ở lượt cuộn cuối (quan sát thật: đang ở màn danh sách, gọi
 * `scrollUntilVisible(element: "Làm bài", ...)` xong thì màn hình đã CHUYỂN THẲNG vào màn làm bài
 * dù không có `tapOn` nào trong step - đã audit + rollback ngay, xem git log cùng ngày) - vì vậy
 * CHỈ dùng `swipe` (kéo thô, không target text nào) để cuộn thêm, không bao giờ target CTA. */
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

/** Tìm trong `pool` câu hỏi nào khớp màn hình hiện tại - ĐÚNG 1 lượt `bridge.hierarchy()` cho cả
 * lượt tìm (dù pool có bao nhiêu câu), trừ khi `priorTree` đã có sẵn (state chưa đổi từ lượt trước -
 * xem call site). wantCorrect truyền dummy `true`, chỉ dùng để PHÁT HIỆN câu, chưa tap. */
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
    resultLabel: isLast ? "e2e_partial_resume_scored_result_screen" : null,
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
 * Câu có "handler hỗ trợ đầy đủ" (đúng yêu cầu đề bài "chỉ chọn bài mà automation hiện tại có
 * handler hỗ trợ đầy đủ") theo ĐÚNG 2 chiến lược decideAnswerAction() hỗ trợ - chỉ pre-check được
 * chiến lược TEXT_CHOICE từ nội dung CMS (đáp án dạng chữ + correctAnswer xác định); KHÔNG pre-check
 * được IMAGE_CHOICE_GRID (cần nhìn layout thật trên màn hình, không suy ra được từ CMS) - CHỦ ĐÍCH
 * loại luôn candidate nào chỉ hỗ trợ được qua GRID (an toàn hơn, tránh false-positive lúc pre-scan).
 * Yêu cầu thêm N>=3 (đủ chỗ cho PARTIAL 2-3 câu + còn ít nhất 1 câu để RESUME).
 */
function isTextChoiceCompatible(questions) {
  if (!Array.isArray(questions) || questions.length < 3) return false;
  return questions.every((q) => {
    const nonEmptyAnswers = (q.answers ?? []).filter((a) => typeof a === "string" && a.trim().length > 0);
    return nonEmptyAnswers.length >= 2 && q.correctAnswer && nonEmptyAnswers.includes(q.correctAnswer);
  });
}

/**
 * GIẢ ĐỊNH công thức chấm (CHƯA có đủ dữ liệu thật để chứng minh - CHỈ 1 điểm dữ liệu quan sát được
 * trong toàn bộ codebase: 5/5 câu đúng -> "ĐIỂM SỐ"=10, xem automation/README.md mục 7 - khớp NHƯNG
 * KHÔNG chứng minh được quy tắc làm tròn cho trường hợp KHÔNG đúng hết): thang điểm 10, tỉ lệ thuận
 * theo số câu đúng/tổng số câu, làm tròn 1 chữ số - `score = round((correct/total)*10, 1)`. Dùng để
 * LẬP KẾ HOẠCH trước (chọn correctCount nào cho điểm dự đoán rơi vào khoảng mục tiêu THẬT
 * `7.0 <= score < 8.0`, đo bằng khoảng cách tới tâm 7.5) - KHÔNG dùng để tự phán PASS, PASS/FAIL
 * cuối cùng dựa vào điểm THẬT đọc từ màn Kết quả (xem main()).
 *
 * SỬA (2026-08-17, theo yêu cầu mới trong hội thoại cùng ngày): trước đây target range là [6,8]
 * (đóng cả 2 đầu) ưu tiên đúng 7 - ĐỔI hẳn sang range NỬA MỞ [7.0, 8.0) đúng nghĩa toán học (7.0
 * PASS, 8.0 KHÔNG PASS) - loại c=totalCount (mọi câu đúng, thường ra đúng 10.0) và bất kỳ c nào
 * làm tròn ra đúng 8.0 khỏi tập hợp lệ, KHÔNG còn ưu tiên riêng giá trị 7 (7.3/7.5/7.8... đều PASS
 * ngang nhau theo yêu cầu đề bài, không hardcode 7/10).
 * @returns {{correctCount: number, predictedScore: number, distanceToCenter: number} | null}
 */
function computeScorePlan(totalCount) {
  let best = null;
  for (let c = 0; c <= totalCount; c++) {
    const predicted = Math.round((c / totalCount) * 100) / 10;
    if (predicted < 7.0 || predicted >= 8.0) continue;
    const distanceToCenter = Math.abs(predicted - 7.5);
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
 * Random 1 candidate khả thi trong TOÀN BỘ cây eligible của `className` - đọc read-only, KHÔNG giao
 * bài thật cho tới khi hàm này trả về `ok:true` (main() mới thực sự gọi Web GV sau đó). Duyệt theo
 * thứ tự RANDOM (Fisher-Yates), dừng ở candidate ĐẦU TIÊN thoả cả 2 điều kiện: (a) handler hỗ trợ
 * đầy đủ (isTextChoiceCompatible), (b) tồn tại correctCount cho điểm dự đoán trong [7.0, 8.0)
 * (computeScorePlan). Giới hạn `maxAttempts` (mỗi lượt gọi `parseQuestionsFromExamPage()` mở 1
 * trang Exam Editor thật qua Playwright, ~7-30s/candidate đo thật 2026-08-17 - KHÔNG duyệt hết cả
 * trăm candidate). Không tìm được -> `ok:false` kèm toàn bộ `attempts` đã thử (để báo cáo trung
 * thực, không đoán/không âm thầm hạ tiêu chuẩn).
 */
async function pickFeasibleRandomAssignment({ className, maxAttempts = MAX_PRESCAN_ATTEMPTS }) {
  const tree = await fetchEligibleAssignmentTree(className);
  const flat = [];
  for (const u of tree.eligibleTree) {
    // LOẠI Unit "Review N" (SỬA 2026-08-17, xác nhận thật qua 2 lần random random TRÚNG Review
    // ĐỀU FAIL giống nhau ở "selectUnitLessonHomework" - Review 3/VOCABULARY rồi Review 1/WRITING):
    // Web GV UI cho Unit dạng Review LUÔN hiển thị ĐÚNG 3 tab lesson CỐ ĐỊNH ("Vocabulary"/
    // "Sentence patterns"/"Other" - xác nhận qua Playwright DOM dump thật, KHÔNG đổi theo Unit) -
    // trong khi tên Lesson mà CMS API (fetchEligibleAssignmentTree) trả về cho Review là tên
    // TAXONOMY KHÁC hẳn (vd "VOCABULARY", "WRITING"...) KHÔNG khớp bất kỳ tab nào trong 3 tab cố
    // định đó ("WRITING" không phải "Vocabulary"/"Sentence patterns"/"Other" - không phải lỗi
    // casing, là 2 hệ phân loại KHÁC NHAU thật). listLessonCandidates()/resolveAndSelectLesson()
    // vì vậy KHÔNG THỂ chọn đúng Lesson cho Review bằng tên lessonName từ CMS - đây là hạn chế THẬT
    // của automation hiện tại (mục 6 đề bài: "Loại bài không được automation hỗ trợ"), không phải
    // đoán/né lỗi. Unit thường ("Unit N: ...") KHÔNG bị ảnh hưởng (đã xác nhận buttons "Lesson 1/2/3"
    // khớp đúng tên CMS).
    if (/^Review\s+\d+/i.test(u.unitName)) continue;
    for (const l of u.lessons) {
      for (const it of l.items) {
        if (it.isSpeak) continue;
        if (!Array.isArray(it.examIds) || it.examIds.length !== 1) continue;
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
  const order = shuffle(flat).slice(0, maxAttempts);
  const attempts = [];
  for (const cand of order) {
    let questions = null;
    let errorMessage = null;
    try {
      const examData = await parseQuestionsFromExamPage(cand.examId);
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
      questionCount: questions?.length ?? null,
      ok,
      reason: errorMessage ?? (!compatible ? "UNSUPPORTED_TYPE_OR_MISSING_CORRECT_ANSWER" : !scorePlan ? "NO_INTEGER_CORRECT_COUNT_IN_SCORE_RANGE_7_TO_8" : null),
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
        treeStats: tree.stats,
      };
    }
  }
  return { ok: false, attempts, totalEligibleNonSpeakSingleExam: flat.length, treeStats: tree.stats };
}

async function main() {
  const evidence = {};

  // ===== [RANDOM_SELECTION] - pre-scan READ-ONLY, chưa giao bài thật =====
  let assignment, dueVnYmd, startVnYmd, APP_ID;

  if (process.env.REUSE_ROOM_ID) {
    // Escape hatch (giống bản PINNED cũ) cho ĐÚNG 1 lớp lỗi đã gặp THẬT: teacher-assign THẬT thành
    // công (xác nhận qua API diff, room_id đã biết) nhưng App HS locate bị BLOCKED bởi race
    // TRANSIENT giữa 2 lệnh CLI riêng biệt trong assignHomeworkAndLocateOnApp() (`maestro test`
    // scrollUntilVisible xong RỒI `maestro hierarchy` đọc lại không kịp thấy - KHÔNG phải lỗi ở
    // random-selection/CMS/MaestroMcpBridge của file này) - KHÔNG gọi lại Web GV (tránh tạo room
    // trùng), chỉ đọc lại metadata room đã có (read-only) rồi tự locate+disambiguate lại trên App
    // HS bằng nội dung câu hỏi thật (xem openAssignmentDisambiguated).
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
    ({ APP_ID } = await import("./e2e-teacher-assign-student-open.mjs"));
  } else {
    log(`[1/10] Pre-scan READ-ONLY toàn bộ cây eligible lớp ${TARGET_CLASS} để chọn 1 candidate khả thi (handler hỗ trợ + điểm mục tiêu [7.0, 8.0) khả thi)...`);
    const picked = await pickFeasibleRandomAssignment({ className: TARGET_CLASS });
    evidence.randomSelection = {
      totalEligibleNonSpeakSingleExam: picked.totalEligibleNonSpeakSingleExam,
      treeStats: picked.treeStats,
      attemptsCount: picked.attempts.length,
      attempts: picked.attempts,
    };
    if (!picked.ok) {
      log(`  [BLOCKED] Đã thử ${picked.attempts.length} candidate, không candidate nào khả thi.`);
      return finish({
        status: "BLOCKED",
        phase: "RANDOM_SELECTION",
        error: `Đã thử ${picked.attempts.length}/${MAX_PRESCAN_ATTEMPTS} candidate random trong lớp ${TARGET_CLASS} - không candidate nào vừa có handler hỗ trợ đầy đủ vừa có correctCount nguyên cho điểm dự đoán trong [7.0, 8.0).`,
        evidence,
      });
    }
    const chosen = picked.chosen;
    evidence.chosenCandidate = { unitName: chosen.unitName, lessonName: chosen.lessonName, itemName: chosen.itemName, itemId: chosen.itemId, examId: chosen.examId };
    log(
      `  [PASS] Chọn "${chosen.unitName}/${chosen.lessonName}/${chosen.itemName}" (itemId=${chosen.itemId}, N=${chosen.questions.length}, correctCount kế hoạch=${chosen.scorePlan.correctCount}, điểm dự đoán=${chosen.scorePlan.predictedScore}).`,
    );

    // ===== [TEACHER_ASSIGN] - giao bài THẬT cho ĐÚNG candidate vừa chọn =====
    process.env.ASSIGN_UNIT_NAME = chosen.unitName;
    process.env.ASSIGN_LESSON_NAME = chosen.lessonName;
    process.env.ASSIGN_HOMEWORK_ITEM_NAME = chosen.itemName;
    process.env.ASSIGN_HOMEWORK_ITEM_ID = chosen.itemId;
    const assignModule = await import("./e2e-teacher-assign-student-open.mjs");
    APP_ID = assignModule.APP_ID;

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
      error: `Room "${assignment.id}" có is_swap_answer=${swapAnswer}/is_swap_question=${swapQuestion} - CHƯA verify content khớp catalog khi swap=true (xem docblock teacherMaterialsExamResolver.js), KHÔNG tin tưởng đáp án.`,
      evidence,
    });
  }
  const QUESTIONS = resolved.questions;
  if (!isTextChoiceCompatible(QUESTIONS)) {
    return finish({
      status: "BLOCKED",
      phase: "CMS_RESOLUTION",
      error: `Nội dung THẬT của room "${assignment.id}" KHÔNG còn khớp điều kiện handler hỗ trợ đầy đủ (khác pre-scan candidate ban đầu - có thể do is_swap hoặc CMS đổi nội dung giữa lúc pre-scan và lúc giao bài).`,
      evidence,
    });
  }
  const scorePlan = computeScorePlan(QUESTIONS.length);
  if (!scorePlan) {
    return finish({
      status: "BLOCKED",
      phase: "CMS_RESOLUTION",
      error: `Room "${assignment.id}" có N=${QUESTIONS.length} câu - không tồn tại correctCount nguyên cho điểm dự đoán trong [7.0, 8.0).`,
      evidence,
    });
  }
  const WANT_CORRECT = buildWantCorrectPlan(QUESTIONS.map((q) => q.id), scorePlan.correctCount);
  const PARTIAL_COUNT = QUESTIONS.length >= 4 ? 3 : 2;
  // Nguồn unitName/lessonName/lessonItemId: LUÔN lấy từ `resolved.roomDetails` (ground truth của
  // ĐÚNG room này qua fetchRoomDetails, xem teacherMaterialsExamResolver.js) - KHÔNG lấy từ
  // `chosen` (biến chỉ tồn tại ở nhánh pre-scan random, KHÔNG có khi REUSE_ROOM_ID).
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

    // ===== [OPEN_EXERCISE] + [PROGRESS_BEFORE] (cùng 1 bước - xem docblock openAssignmentDisambiguated) =====
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
        return finish({
          status: "FAIL",
          phase: "FINISH_REMAINING",
          error: `Không khớp được câu hỏi nào (còn ${pool.length} câu) với màn hình hiện tại.`,
          visibleTexts: collectAllTexts(await bridge.hierarchy()),
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
    // [7.0, 8.0) NỬA MỞ - 7.0 PASS, 8.0 KHÔNG PASS (SỬA 2026-08-17, xem computeScorePlan()).
    const scoreInRange = scoreValid && scoreNumber >= 7.0 && scoreNumber < 8.0;
    evidence.scoreInterpretation = {
      questionCount: QUESTIONS.length,
      plannedCorrectCount: scorePlan.correctCount,
      achievedCorrectCountByPlan: achievedCorrectCount,
      realCorrectCountFromResultScreen: result.correctCount,
      predictedScore: scorePlan.predictedScore,
      actualScore: scoreNumber,
      scoreInRangeTarget: scoreInRange,
      targetRange: "[7.0, 8.0)",
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

    const overallPass = progressChanged && evidence.resume && !evidence.resume.isAlreadyAnsweredQuestion && answeredIds.size === QUESTIONS.length && scoreInRange;

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

main()
  .then((result) => {
    log(`\n=== KẾT QUẢ: ${result.status}${result.phase ? ` (phase=${result.phase})` : ""} ===`);
    log(`Đã ghi report ra ${OUTPUT_FILE}`);
    process.exit(result.status === "PASS" ? 0 : 1);
  })
  .catch((err) => {
    console.error("\n[e2e-teacher-assign-partial-resume-scored] Dừng lại vì lỗi ngoài dự kiến:\n");
    console.error(err);
    finish({ status: "ERROR", error: err.message, stack: err.stack });
    process.exit(2);
  });
