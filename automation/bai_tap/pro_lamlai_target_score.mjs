#!/usr/bin/env node
/**
 * PRO-Lamlai-Target-Score
 *
 * Case: "chọn 1 bài đã hoàn thành, bấm Làm lại, làm lại TOÀN BỘ bài, nộp bài, verify điểm THẬT ===
 * điểm MỤC TIÊU được cấu hình (REDO_TARGET_SCORE)". KHÁC hẳn tiêu chí của 2 case anh em:
 *   - automation/bai_tap/pro_lamlai_fullluong.mjs           : không scoring (bấm cho qua).
 *   - automation/bai_tap/pro_lamlai_beat_previous_score.mjs : actualScore > điểm CŨ (so sánh).
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
 *   TARGET_TITLE=<title chính xác>  (tuỳ chọn - redo ĐÚNG 1 card này thay vì để tự quét/chọn
 *     candidate đầu tiên thoả điều kiện - xem comment tại khai báo TARGET_TITLE bên dưới)
 *   REDO_SCORE_MODE=target|random (default "target")
 *   REDO_TARGET_SCORE=<số>        (bắt buộc khi mode=target, vd 9, 8.5, 10, 3)
 *     - mode=random: tự chọn 1 điểm KHẢ THI thật của CHÍNH candidate được chọn (không random đáp án
 *       trước rồi xem điểm ra bao nhiêu - random NGAY TRÊN tập điểm khả thi đã tính).
 *   APP_ID (.env), PHONE/OTP (test_data/accounts.env), EXAM_COOKIE (.env, get_tokens.sh),
 *   MAESTRO_DEVICE (tuỳ chọn), PROFILE_PRO_NAME (default "Ngoc"), TARGET_CLASS_ID/TARGET_STUDENT_ID
 *   (default như pro_lamlai_beat_previous_score.mjs).
 *
 * CHẠY: REDO_SCORE_MODE=target REDO_TARGET_SCORE=9 node automation/bai_tap/pro_lamlai_target_score.mjs
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parseEnvFile } from "../src/config.js";
import { MaestroMcpBridge } from "../bridge/maestroMcpBridge.js";
import { HomeworkExamEngine, decideAnswerAction } from "./navigation/homeworkExamEngine.js";
import { resolveHomeworkExamQuestionsForRoomId } from "./discovery/teacherMaterialsExamResolver.js";
import { getHomeworks } from "./discovery/homeworks.js";
import { resolveMyStatus } from "./model/homeworkModel.js";
// Scroll/locate cho card "Làm lại" (collectDistinctCompletedCandidates/locateSpecificCompletedCandidate)
// TÁCH ra automation/bai_tap/discovery/locateCompletedCandidate.js (2026-08-24) để dùng chung/dễ
// test độc lập - xem docblock đầu file đó cho lịch sử/ROOT CAUSE đầy đủ. COMPLETED_CTA re-export từ
// đó để giữ 1 nguồn sự thật duy nhất cho giá trị "Làm lại" (dùng lại ở log lỗi BLOCKED bên dưới).
import {
  collectDistinctCompletedCandidates,
  locateSpecificCompletedCandidate,
  COMPLETED_CTA,
} from "./discovery/locateCompletedCandidate.js";
// findAssignment()/scrollToTop() (MỚI 2026-08-25, xem PRECHECK bên dưới) - cơ chế locate CANONICAL
// dùng chung toàn bộ automation khác (target5.mjs, e2e-teacher-assign-student-open.mjs...), KHÁC
// locateSpecificCompletedCandidate() ở trên (implementation RIÊNG của chính file này - xem memory
// feedback_reuse_scroll_locate_mechanisms.md, phần bổ sung 2026-08-24). CHỈ dùng cho PRECHECK
// READ-ONLY (xem runCanonicalLocatePrecheck()) - KHÔNG thay locateSpecificCompletedCandidate() ở
// luồng "làm lại" thật (ngoài phạm vi yêu cầu, tránh đổi hành vi production đã verify).
import { findAssignment, scrollToTop } from "./discovery/findAssignment.js";
import { formatDM } from "./verify-filter-web-vs-app.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "pro_lamlai_target_score_report.json");
const ACCOUNTS_ENV_PATH = join(PROJECT_ROOT, "test_data", "accounts.env");
const ROOT_ENV_PATH = join(PROJECT_ROOT, ".env");
const EXAM_SESSION_PATH = join(PROJECT_ROOT, "automation", ".cache", "exam_session.json");
// CMS_CACHE_PATH (MỚI, tối ưu Phase C - xem PHÂN TÍCH BOTTLENECK cuối file): cache RIÊNG của
// CHÍNH file này (không đụng automation/bai_tap/discovery/teacherMaterialsExamResolver.js - blast
// radius CHỈ trong script này, không ảnh hưởng các flow khác đang dùng chung resolver đó).
const CMS_CACHE_PATH = join(PROJECT_ROOT, "automation", ".cache", "pro_lamlai_target_score_cms_cache.json");
const CMS_CACHE_DISABLE = (process.env.CMS_CACHE_DISABLE || "").trim().toLowerCase() === "true";
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
// COMPLETED_CTA: import từ locateCompletedCandidate.js (xem import block đầu file) - KHÔNG khai báo
// lại ở đây để tránh 2 nguồn sự thật lệch nhau.

const REDO_SCORE_MODE = (process.env.REDO_SCORE_MODE || "target").trim().toLowerCase();
const REDO_TARGET_SCORE_RAW = process.env.REDO_TARGET_SCORE;
// TARGET_TITLE (optional, MỚI 2026-08-22): chỉ định ĐÚNG 1 title cần "Làm lại" (khớp chính xác text
// hiển thị trên card App HS) thay vì để collectDistinctCompletedCandidates() tự quét/chọn candidate
// ĐẦU TIÊN thoả điều kiện - dùng khi cần redo ĐÚNG 1 bài cụ thể (vd "bài vừa hoàn thành sáng nay"),
// không phải bất kỳ bài "Làm lại" nào tìm thấy trước. collectDistinctCompletedCandidates() dừng CUỘN
// SỚM sau 2 lượt liên tiếp không tìm thêm candidate MỚI (thiết kế đúng cho quét tổng quát) - đã xác
// nhận thật (2026-08-22) điều này khiến quét bỏ lỡ 1 card cụ thể nằm xa hơn trong danh sách (dừng ở
// "G3-U3-Lesson 1: Read and complete" trong khi "G3-U2-Lesson 2: Read and tick True or False" - đã
// xác nhận COMPLETED qua getHomeworks() cùng room_id thật - nằm xa hơn, chưa cuộn tới). Khi có
// TARGET_TITLE, cuộn THẲNG tới đúng title đó (scrollUntilVisible, không có ngưỡng dừng sớm).
const TARGET_TITLE = process.env.TARGET_TITLE || null;
// Quy đổi point (có thể là số thập phân, vd 0.5) sang số nguyên để DP subset-sum không dính sai số
// float - 1000 đủ dư cho mọi độ chia nhỏ CMS đã quan sát thật (point nguyên hoặc 1 chữ số thập phân).
const POINT_SCALE = 1000;

// ===================== PRECHECK (MỚI 2026-08-25) =====================
// Rule đã có từ trước (feedback_reuse_scroll_locate_mechanisms.md, bổ sung 2026-08-24): TRƯỚC KHI
// chạy full script (~10 phút) với 1 TARGET_TITLE cụ thể, nên xác nhận trước card đó THẬT reachable
// qua cơ chế locate CANONICAL (findAssignment()) bằng 1 bước READ-ONLY nhanh (~vài chục giây) -
// tránh mất cả lượt chạy dài rồi mới biết bị "stuck scroll" (root cause thật gặp 2026-08-25:
// locateSpecificCompletedCandidate() báo BLOCKED "ADVANCED_SECTION_REACHED" dù card có thật và đang
// hiển thị điểm trên màn hình - stuck ở CHÍNH cơ chế locate riêng của file này, không phải do card
// không tồn tại).
//
// PRECHECK_ONLY=true: CHỈ chạy [A] profile-check + scrollToTop() + findAssignment() (identity=
// {title: TARGET_TITLE, cta: COMPLETED_CTA}, KHÔNG dùng locateSpecificCompletedCandidate()) rồi DỪNG
// - KHÔNG gọi resolveHomeworkExamQuestionsForRoomId/CMS, KHÔNG tap "Làm lại", KHÔNG trả lời câu nào,
// KHÔNG submit - đúng yêu cầu READ-ONLY. Hành vi chạy THƯỜNG (PRECHECK_ONLY không set/false) GIỮ
// NGUYÊN 100% - guard này chỉ CHẶN THÊM 1 nhánh mới trong main(), không đổi bất kỳ bước nào của
// luồng full script cũ.
const PRECHECK_ONLY = (process.env.PRECHECK_ONLY || "").trim().toLowerCase() === "true";
// maxScrolls RIÊNG cho precheck (mặc định 20, nhỏ hơn hẳn MAX_LOCATE_SCROLLS=60 dùng cho luồng full
// script) - đây là cách "cấu hình timeout riêng cho pre-check" ĐÚNG yêu cầu: chỉ truyền option
// `maxScrolls` cho ĐÚNG lệnh gọi findAssignment() này (findAssignment() đã hỗ trợ sẵn tham số này
// per-call, xem automation/bai_tap/discovery/findAssignment.js) - KHÔNG đổi DEFAULT_MAX_SCROLLS
// (giá trị mặc định 40) hay bất kỳ hằng số global nào trong file đó, KHÔNG ảnh hưởng caller khác.
const PRECHECK_MAX_SCROLLS = Number(process.env.PRECHECK_MAX_SCROLLS) || 20;

function log(...args) {
  console.log(...args);
}

/** ===================== PROFILING (instrumentation-only, MỚI 2026-08-22) =====================
 * Mục đích DUY NHẤT: đo thời gian từng phase/bước thật để xác định bottleneck TRƯỚC khi tối ưu -
 * KHÔNG đổi logic/hành vi/thứ tự bước nào đã có. Timer dùng Date.now() (đủ độ chính xác cho khoảng
 * đo tính bằng giây/trăm-ms của case này, không cần performance.now()).
 *
 * 1 THAY ĐỔI CẤU TRÚC DUY NHẤT để đo được (không phải đổi hành vi): một số bước trước đây gộp NHIỀU
 * lệnh Maestro trong 1 lần gọi `bridge.runSteps([...])` (vd swipe+waitForAnimationToEnd, hay
 * tapOn+wait+runFlow+extendedWaitUntil) - tách thành NHIỀU lần gọi `runSteps()` liên tiếp, MỖI lần 1
 * cụm lệnh, để có ranh giới đo thời gian giữa các cụm. Maestro session (`MaestroMcpSession`, xem
 * automation/bridge/maestroMcpBridge.js) là 1 tiến trình DUY NHẤT sống xuyên suốt, các lệnh vẫn chạy
 * TUẦN TỰ ĐÚNG THỨ TỰ CŨ, KHÔNG khác gì về hành vi/kết quả cuối cùng - chỉ khác số lần round-trip
 * qua MCP (không ảnh hưởng correctness, có thể cộng thêm vài ms overhead round-trip không đáng kể).
 */
function now() {
  return Date.now();
}

function newProfiling() {
  return {
    phaseA: null,
    phaseB: { scrolls: [], durationMs: null, startedAt: null, endedAt: null },
    phaseC: { apiCalls: [], durationMs: null, startedAt: null, endedAt: null },
    phaseD: { durationMs: null, startedAt: null, endedAt: null, tapMs: null, waitReadyMs: null },
    phaseE: { questions: [], durationMs: null, startedAt: null, endedAt: null },
    phaseF: { durationMs: null, startedAt: null, endedAt: null, readResultMs: null, closeTapMs: null, returnToListMs: null, reportWriteMs: null },
  };
}

/** Bọc 1 async step đã có sẵn bằng timer - KHÔNG đổi input/output/behavior của `fn`, chỉ đo. */
async function timed(fn) {
  const startedAt = now();
  const result = await fn();
  const endedAt = now();
  return { result, startedAt, endedAt, durationMs: endedAt - startedAt };
}

/** ===================== card/hierarchy parsing (COPY nguyên từ pro_lamlai_beat_previous_score.mjs) ===================== */

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

// collectDistinctCompletedCandidates()/locateSpecificCompletedCandidate() (scroll/locate cho card
// "Làm lại") ĐÃ CHUYỂN sang automation/bai_tap/discovery/locateCompletedCandidate.js (2026-08-24) -
// xem import block đầu file. Không còn định nghĩa ở đây.

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
  // TARGET_ROOM_ID (optional, cùng tinh thần REUSE_ROOM_ID của flows/web/giao_bai_tap/
  // e2e-teacher-assign-full-scored-target5.mjs): khi title trùng nhiều room cũ và card completed
  // KHÔNG hiển thị "Hạn nộp" (bị thay bằng "Điểm X" trên UI) nên dueDateBefore không đọc được để
  // tự phân biệt - cho phép ghim ĐÚNG 1 room_id đã biết chắc chắn qua nguồn khác (vd API), thay vì
  // BLOCKED AMBIGUOUS. CHỈ lọc trong tập `matches` đã qua điều kiện title/class/COMPLETED ở trên -
  // không tự thêm room ngoài điều kiện đó.
  if (matches.length > 1 && process.env.TARGET_ROOM_ID) {
    const scoped = matches.filter((h) => h.id === process.env.TARGET_ROOM_ID);
    if (scoped.length > 0) matches = scoped;
  }
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

/** ===================== CMS RESULT CACHE (MỚI - tối ưu Phase C, xem PHÂN TÍCH BOTTLENECK cuối
 * file) ===================== Cache RIÊNG của CHÍNH script này (KHÔNG sửa
 * teacherMaterialsExamResolver.js dùng chung - blast radius CHỈ trong file này, không ảnh hưởng
 * flow khác). Key = roomId, hết hạn sau ĐÚNG 1 ngày lịch VN (dateKey) - giới hạn rủi ro stale nếu
 * GV sửa nội dung đề giữa chừng (rủi ro RẤT THẤP với room test cố định dùng lại nhiều lần/ngày -
 * đúng use case "làm lại" của case này - nhưng KHÔNG bằng 0, nên có escape hatch
 * CMS_CACHE_DISABLE=true). CHỈ cache khi status === "RESOLVED" - không cache lỗi/BLOCKED (tránh 1
 * lỗi thoáng qua biến thành lỗi vĩnh viễn trong ngày). */
function vnDateKeyNow() {
  const shifted = new Date(Date.now() + VN_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

function readCmsCache() {
  if (!existsSync(CMS_CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CMS_CACHE_PATH, "utf8"));
  } catch {
    return {}; // cache file hỏng/không đọc được - coi như rỗng, KHÔNG throw (không phải lỗi nghiệp vụ).
  }
}

function writeCmsCacheEntry(roomId, resolved) {
  const cache = readCmsCache();
  cache[roomId] = { dateKey: vnDateKeyNow(), cachedAtIso: new Date().toISOString(), resolved };
  mkdirSync(dirname(CMS_CACHE_PATH), { recursive: true });
  writeFileSync(CMS_CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

/** Trả {hit:true, resolved, cachedAtIso} nếu có cache CÙNG dateKey hôm nay cho roomId, ngược lại {hit:false}. */
function readCmsCacheEntry(roomId) {
  const cache = readCmsCache();
  const entry = cache[roomId];
  if (!entry || entry.dateKey !== vnDateKeyNow()) return { hit: false };
  return { hit: true, resolved: entry.resolved, cachedAtIso: entry.cachedAtIso };
}

/** Wrapper cache quanh resolveHomeworkExamQuestionsForRoomIdWithRetry() - KHÔNG đổi hàm gốc (giữ
 * nguyên để nơi khác vẫn gọi trực tiếp nếu cần bản không-cache). Cache HIT bỏ qua network hoàn
 * toàn; MISS gọi như cũ rồi ghi cache nếu RESOLVED. */
async function resolveHomeworkExamQuestionsForRoomIdCachedWithRetry(roomId, maxAttempts = 2) {
  if (!CMS_CACHE_DISABLE) {
    const cacheCheck = readCmsCacheEntry(roomId);
    if (cacheCheck.hit) {
      log(`    [CMS CACHE] HIT roomId=${roomId} (cached lúc ${cacheCheck.cachedAtIso}, cùng ngày VN hôm nay) - bỏ qua network scrape.`);
      return { ...cacheCheck.resolved, _profiling: { attempts: [], cacheHit: true } };
    }
  }
  const result = await resolveHomeworkExamQuestionsForRoomIdWithRetry(roomId, maxAttempts);
  if (!CMS_CACHE_DISABLE && result.status === "RESOLVED") {
    const { _profiling, ...toCache } = result;
    writeCmsCacheEntry(roomId, toCache);
  }
  return { ...result, _profiling: { ...(result._profiling ?? {}), cacheHit: false } };
}

async function resolveHomeworkExamQuestionsForRoomIdWithRetry(roomId, maxAttempts = 2) {
  // _profiling gắn THÊM vào object trả về (KHÔNG đổi field cũ nào) - chỉ để đo số lần gọi API +
  // thời gian từng lần, phục vụ Phase C profiling - xem docblock PROFILING đầu file.
  const attemptsLog = [];
  let last = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const t = await timed(() => resolveHomeworkExamQuestionsForRoomId(roomId));
    attemptsLog.push({ attempt, durationMs: t.durationMs, status: t.result.status });
    const resolved = t.result;
    if (resolved.status === "RESOLVED") return { ...resolved, _profiling: { attempts: attemptsLog } };
    last = resolved;
    const looksTimeoutShaped = resolved.status === "SESSION_ERROR" && /Timeout \d+ms exceeded/.test(resolved.reason ?? "");
    if (!looksTimeoutShaped) return { ...resolved, _profiling: { attempts: attemptsLog } };
    log(`    (retry ${attempt}/${maxAttempts} roomId=${roomId}: page.goto timeout - flaky networkidle đã biết, thử lại)`);
  }
  return { ...last, _profiling: { attempts: attemptsLog } };
}

function isTextChoiceCompatible(questions) {
  if (!Array.isArray(questions) || questions.length < 3) return false;
  return questions.every((q) => {
    const nonEmptyAnswers = (q.answers ?? []).filter((a) => typeof a === "string" && a.trim().length > 0);
    return nonEmptyAnswers.length >= 2 && q.correctAnswer && nonEmptyAnswers.includes(q.correctAnswer);
  });
}

/** ===================== [E] MATCHING (SỬA 2026-08-25 - full answer-set match) =====================
 * ROOT CAUSE xác nhận thật (xem memory project_teacher_materials_examid_order_mismatch.md): examId
 * catalog (dfe080b0-...) dùng để resolve CMS KHÁC examId thật của room (c1615ff2-...) - cùng 10
 * câu/đáp án NHƯNG thứ tự câu khác nhau, và nhiều câu DÙNG CHUNG một số từ đáp án (dress/friend/
 * these/celebrate...). Bản CŨ (duyệt `pool` theo thứ tự CMS, gọi decideAnswerAction() - hàm đó chỉ
 * yêu cầu >=2 answers của 1 candidate "nhìn thấy được" TRÊN TOÀN BỘ cây, KHÔNG cần đủ hết) trả về
 * candidate ĐẦU TIÊN thoả - khi thứ tự bị xáo trộn + có từ đáp án trùng giữa nhiều câu, candidate
 * SAI bị chọn nhầm ở câu sớm, để lại 2 candidate thật không khớp câu 9-10 -> "không khớp được câu
 * hỏi nào".
 *
 * SỬA: yêu cầu ĐỦ TOÀN BỘ answers[] của 1 candidate phải "nhìn thấy được" (full answer-set match,
 * so theo Set đã normalize - KHÔNG phụ thuộc thứ tự đáp án/thứ tự pool/thứ tự UI, xem
 * findFullAnswerSetMatches()) mới coi là khớp - KHÔNG tự chọn candidate đầu tiên có visibleCount>=2
 * như cũ. 0 candidate khớp full-set (nhưng có candidate lộ 1 phần) -> NO_MATCH (fail rõ, không
 * đoán); >1 candidate khớp full-set -> AMBIGUOUS (fail rõ, không tự chọn); ĐÚNG 1 -> chọn, rồi mới
 * gọi decideAnswerAction() (GIỮ NGUYÊN, KHÔNG sửa - dùng chung answerCurrentQuestionOneShot()/nhiều
 * flow khác) để lấy action tap thật cho đúng 1 candidate đó.
 *
 * FALLBACK giữ nguyên hành vi CŨ (first-fit qua decideAnswerAction() y nguyên, KHÔNG đổi) CHỈ khi
 * KHÔNG candidate nào lộ dù 1 phần đáp án dạng text (nghi ngờ màn hình đang render dạng
 * IMAGE_CHOICE_GRID - isTextChoiceCompatible() ở bước chọn candidate chỉ đảm bảo CMS MODEL có đáp
 * án text, KHÔNG đảm bảo UI thật render dạng text hay hình) - tránh regression cho case chưa từng
 * gặp lỗi này trong session chẩn đoán, không có dữ liệu thật để sửa đúng nên không suy đoán thêm.
 *
 * So sánh dùng Set string thuần (không dùng regex như isVisibleInTree/decideAnswerAction) - tránh
 * luôn rủi ro ký tự regex đặc biệt trong đáp án thật (dấu "(...)" đã từng phá regex Maestro, xem
 * memory project_maestro_regex_parens_due_today.md) làm hỏng so khớp.
 */
function normalizeAnswerText(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Set các text đang hiển thị, ĐÃ normalize - build 1 LẦN mỗi lượt gọi findMatchingQuestion() (không
 * phải mỗi candidate/mỗi answer) để tra cứu O(1) qua Set.has(), thay vì gọi lại isVisibleInTree()
 * (duyệt toàn bộ texts[], O(texts)) cho MỖI answer của MỖI candidate còn lại trong pool. */
function buildNormalizedVisibleSet(texts) {
  const set = new Set();
  for (const t of texts) set.add(normalizeAnswerText(t));
  return set;
}

/** Trả {matches, anyPartialTextVisible}: `matches` = TOÀN BỘ candidate trong pool có ĐỦ HẾT
 * answers[] (đã normalize) nằm trong tập đang hiển thị - không phụ thuộc thứ tự đáp án (so theo
 * Set) hay thứ tự pool (duyệt hết, không return sớm - Rule 1-3). `anyPartialTextVisible` = có ít
 * nhất 1 candidate lộ >=2 đáp án (ngưỡng "hợp lệ" cũ của decideAnswerAction()) nhưng chưa đủ hết -
 * dùng để phân biệt NO_MATCH thật (có text nhưng không đủ - case bug đã fix) với "không phải màn
 * text-choice" (fallback IMAGE_CHOICE_GRID bên dưới). */
function findFullAnswerSetMatches(pool, normalizedVisibleSet) {
  const matches = [];
  let anyPartialTextVisible = false;
  for (const q of pool) {
    const answers = (q.answers ?? []).filter((a) => typeof a === "string" && a.trim().length > 0);
    if (answers.length < 2) continue; // cùng ngưỡng "hợp lệ có đáp án" như decideAnswerAction() cũ.
    const visibleCount = answers.filter((a) => normalizedVisibleSet.has(normalizeAnswerText(a))).length;
    if (visibleCount >= 2) anyPartialTextVisible = true;
    if (visibleCount === answers.length) matches.push(q);
  }
  return { matches, anyPartialTextVisible };
}

async function findMatchingQuestion(bridge, pool, priorTree, questionIndex) {
  const tree = priorTree ?? (await bridge.hierarchy());
  const texts = collectAllTexts(tree);
  const isVisible = (t) => isVisibleInTree(texts, t); // GIỮ NGUYÊN - vẫn cần cho decideAnswerAction() thật + fallback dưới.
  const normalizedVisibleSet = buildNormalizedVisibleSet(texts);

  const { matches: fullMatches, anyPartialTextVisible } = findFullAnswerSetMatches(pool, normalizedVisibleSet);

  if (fullMatches.length === 1) {
    const winner = fullMatches[0];
    const action = decideAnswerAction(tree, isVisible, winner, true);
    if (action) {
      log(`  [MATCH] UI question ${questionIndex} -> CMS question id=${winner.id} | exact answer-set match`);
      return { status: "MATCHED", question: { ...winner, _snapshot: { tree, texts } } };
    }
    // action=null dù full-set match (vd decideAnswerAction() không suy đoán tiếp cho loại câu hỏi
    // không tương thích) - KHÔNG rơi xuống fallback first-fit (đã biết chắc đây là candidate đúng,
    // rơi xuống fallback chỉ gây nhiễu) - báo NO_MATCH rõ ràng, không đoán tiếp.
    log(`  [MATCH][NO_MATCH] question_index=${questionIndex} pool_size=${pool.length} - candidate id=${winner.id} khớp full answer-set nhưng decideAnswerAction() không tạo được action (loại câu hỏi không tương thích).`);
    return {
      status: "NO_MATCH",
      diagnostic: { questionIndex, poolSize: pool.length, reason: `decideAnswerAction() returned null for unique full-set match id=${winner.id}` },
    };
  }

  if (fullMatches.length > 1) {
    log(
      `  [MATCH][AMBIGUOUS] question_index=${questionIndex} pool_size=${pool.length} - ${fullMatches.length} candidate cùng khớp ĐỦ toàn bộ ` +
        `answer-set đang hiển thị: ${fullMatches.map((m) => `id=${m.id} answers=${JSON.stringify(m.answers)}`).join(" | ")}.`,
    );
    return {
      status: "AMBIGUOUS",
      diagnostic: {
        questionIndex,
        normalizedVisibleAnswers: [...normalizedVisibleSet],
        candidates: fullMatches.map((m) => ({ id: m.id, answers: m.answers })),
      },
    };
  }

  if (anyPartialTextVisible) {
    // Có candidate lộ MỘT PHẦN đáp án (>=2 nhưng chưa đủ hết) nhưng KHÔNG candidate nào đủ HẾT - đây
    // CHÍNH LÀ case bug đã fix: bản CŨ sẽ chọn nhầm candidate đầu tiên ở đây; bản MỚI báo NO_MATCH rõ
    // ràng thay vì đoán tiếp.
    log(`  [MATCH][NO_MATCH] question_index=${questionIndex} pool_size=${pool.length} - có candidate lộ MỘT PHẦN đáp án nhưng không candidate nào đủ HẾT answer-set.`);
    return {
      status: "NO_MATCH",
      diagnostic: { questionIndex, poolSize: pool.length, reason: "partial-only matches (>=2 nhưng chưa đủ hết) - không candidate nào đủ full answer-set" },
    };
  }

  // Không candidate nào lộ dù 1 phần đáp án dạng text - nghi ngờ màn hình đang render dạng khác (vd
  // IMAGE_CHOICE_GRID) dù CMS ghi nhận answers dạng text - GIỮ NGUYÊN hành vi first-fit CŨ qua
  // decideAnswerAction() cho trường hợp CHƯA có dữ liệu thật để sửa đúng, tránh regression.
  for (const q of pool) {
    const action = decideAnswerAction(tree, isVisible, q, true);
    if (action) {
      log(`  [MATCH] UI question ${questionIndex} -> CMS question id=${q.id} | fallback first-fit (không có đáp án dạng text nào hiển thị, có thể IMAGE_CHOICE_GRID)`);
      return { status: "MATCHED", question: { ...q, _snapshot: { tree, texts } } };
    }
  }
  log(`  [MATCH][NO_MATCH] question_index=${questionIndex} pool_size=${pool.length} - fallback first-fit cũng không tìm được candidate nào (decideAnswerAction() trả null cho toàn bộ pool).`);
  return {
    status: "NO_MATCH",
    diagnostic: { questionIndex, poolSize: pool.length, reason: "no text answers visible at all and legacy image-grid fallback found no match" },
  };
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
 * @param {import("../model/questionModel.js").QuestionModel[]} questions
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

/** ===================== PRECHECK (READ-ONLY, MỚI 2026-08-25) =====================
 * Xác nhận 1 card completed CỤ THỂ (title + cta="Làm lại") có THẬT reachable qua cơ chế locate
 * CANONICAL (`findAssignment()`/`scrollToTop()`, automation/bai_tap/discovery/findAssignment.js) -
 * KHÔNG dùng `locateSpecificCompletedCandidate()` (implementation riêng của chính file này, nguồn
 * của bug BLOCKED/ADVANCED_SECTION_REACHED đã gặp). TUYỆT ĐỐI READ-ONLY: chỉ `hierarchy()` + swipe
 * (bên trong scrollToTop()/findAssignment(), không tap CTA nào) - KHÔNG tap "Làm lại", KHÔNG mở bài,
 * KHÔNG chọn đáp án, KHÔNG submit, KHÔNG gọi CMS/resolveHomeworkExamQuestionsForRoomId().
 *
 * Trả về ĐÚNG 1 trong 3 trạng thái (không có trạng thái thứ 4):
 *   - PRECHECK_PASS: findAssignment() trả FOUND - card reachable, an toàn để chạy full script.
 *   - PRECHECK_NOT_FOUND: findAssignment() cuộn hết phạm vi (maxScrolls) mà không thấy - card có thể
 *     không tồn tại/đã bị xoá/tên khác đi, KHÔNG PHẢI lỗi cơ chế.
 *   - PRECHECK_BLOCKED: cơ chế canonical tự nó gặp lỗi/không quyết định được (ERROR - vd swipe thất
 *     bại) HOẶC AMBIGUOUS (≥2 card cùng khớp identity - không an toàn để 1 script khác tự đoán chọn
 *     1 trong số đó) - đây là vấn đề infrastructure/locate cần xử lý trước, KHÔNG phải lý do để
 *     retry full script.
 * @param {import("../bridge/maestroMcpBridge.js").MaestroMcpBridge} bridge
 * @param {string} title
 * @returns {Promise<{precheckStatus: "PRECHECK_PASS"|"PRECHECK_NOT_FOUND"|"PRECHECK_BLOCKED", canonicalStatus: string, scrollCount: number, canonicalFindMs: number, scrollToTopMs: number, diagnostics: string, card: ?Object}>}
 */
async function runCanonicalLocatePrecheck(bridge, title) {
  log(`[PRECHECK] START`);
  log(`[PRECHECK] target=${title} (cta=${COMPLETED_CTA})`);

  const scrollToTopT = await timed(() => scrollToTop(bridge));
  if (!scrollToTopT.result.atTop) {
    log(`[PRECHECK] result=BLOCKED (scrollToTop() thất bại: ${scrollToTopT.result.reason})`);
    log(`[PRECHECK] BLOCKED — do not run full script`);
    log(`[PRECHECK] END`);
    return {
      precheckStatus: "PRECHECK_BLOCKED",
      canonicalStatus: "SCROLL_TO_TOP_FAILED",
      scrollCount: 0,
      canonicalFindMs: 0,
      scrollToTopMs: scrollToTopT.durationMs,
      diagnostics: `scrollToTop() thất bại: ${scrollToTopT.result.reason}`,
      card: null,
    };
  }

  log(`[PRECHECK] canonical find started`);
  const findT = await timed(() => findAssignment(bridge, { title, cta: COMPLETED_CTA }, { maxScrolls: PRECHECK_MAX_SCROLLS }));
  const found = findT.result;

  const precheckStatus =
    found.status === "FOUND" ? "PRECHECK_PASS" : found.status === "NOT_FOUND" ? "PRECHECK_NOT_FOUND" : "PRECHECK_BLOCKED";

  log(`[PRECHECK] result=${found.status}`);
  log(`[PRECHECK] scrollCount=${found.scrollCount}`);
  log(`[PRECHECK] durationMs=${scrollToTopT.durationMs + findT.durationMs}`);
  if (precheckStatus === "PRECHECK_PASS") {
    log(`[PRECHECK] PASS — target reachable via canonical findAssignment`);
  } else if (precheckStatus === "PRECHECK_BLOCKED") {
    log(`[PRECHECK] BLOCKED — do not run full script`);
  }
  log(found.diagnostics);
  log(`[PRECHECK] END`);

  return {
    precheckStatus,
    canonicalStatus: found.status,
    scrollCount: found.scrollCount,
    canonicalFindMs: findT.durationMs,
    scrollToTopMs: scrollToTopT.durationMs,
    diagnostics: found.diagnostics,
    card: found.card ?? null,
  };
}

// overallStartMs (MỚI, profiling-only): stamp ở đầu main() - CHỈ dùng để `finish()` tự điền
// evidence.totalDurationSeconds cho CẢ nhánh BLOCKED/FAIL/ERROR thoát sớm (trước đây field này CHỈ
// được set thủ công ở nhánh PASS cuối cùng) - KHÔNG đổi status/error/field nào khác của result, chỉ
// thêm 1 số liệu quan sát để printProfilingSummary() tính % đúng ngay cả khi case không PASS.
let overallStartMs = null;

function finish(result) {
  if (result?.evidence && result.evidence.totalDurationSeconds == null && overallStartMs != null) {
    result.evidence.totalDurationSeconds = (Date.now() - overallStartMs) / 1000;
  }
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

function sumBy(arr, key) {
  return arr.reduce((acc, x) => acc + (x[key] ?? 0), 0);
}

/** In summary bảng phase + chi tiết Discovery/CMS - CHỈ đọc `profiling` đã thu thập trong main(),
 * KHÔNG tính toán/suy đoán số liệu mới ngoài những gì đã đo thật. */
function printProfilingSummary(r) {
  const p = r.evidence?.profiling;
  if (!p) {
    log(`\n[PROFILING] (không có dữ liệu - lỗi xảy ra trước khi profiling object được gắn vào evidence)`);
    return;
  }
  const totalMs = (r.evidence?.totalDurationSeconds ?? 0) * 1000;
  const questions = p.phaseE?.questions ?? [];
  const rows = [
    { label: "Setup", ms: p.phaseA?.durationMs ?? 0 },
    { label: "Discovery", ms: p.phaseB?.durationMs ?? 0 },
    { label: "CMS", ms: p.phaseC?.durationMs ?? 0 },
    { label: "Open + verify", ms: p.phaseD?.durationMs ?? 0 },
    ...questions.map((q) => ({ label: `Answer Q${q.index}`, ms: q.durationMs ?? 0 })),
    { label: "Submit/result", ms: p.phaseF?.durationMs ?? 0 },
  ];
  const measuredTotal = sumBy(rows, "ms");

  log(`\n[PROFILING SUMMARY]`);
  log(`| Phase | Duration | % total |`);
  log(`| --- | ---: | ---: |`);
  for (const row of rows) {
    const pct = totalMs > 0 ? ((row.ms / totalMs) * 100).toFixed(1) : "-";
    log(`| ${row.label} | ${(row.ms / 1000).toFixed(1)}s | ${pct}% |`);
  }
  log(
    `\ntotal_measured ≈ ${(measuredTotal / 1000).toFixed(1)}s vs totalDuration = ${(totalMs / 1000).toFixed(1)}s ` +
      `(chênh lệch = instrumentation overhead + phần không nằm trong 1 phase cụ thể, vd khoảng trống giữa các await).`,
  );

  const top3 = [...rows].sort((a, b) => b.ms - a.ms).slice(0, 3);
  log(`\n[TOP 3 BOTTLENECK - theo tổng thời gian]`);
  top3.forEach((row, i) => {
    const pct = totalMs > 0 ? ((row.ms / totalMs) * 100).toFixed(1) : "-";
    log(`  ${i + 1}. ${row.label}: ${(row.ms / 1000).toFixed(1)}s (${pct}%)`);
  });

  const scrolls = p.phaseB?.scrolls ?? [];
  log(`\n[DISCOVERY DETAIL]`);
  log(`scroll_iterations_used=${scrolls.length > 0 ? scrolls[scrolls.length - 1].scrollIndex : 0} (bao gồm lượt đọc đầu trước khi cuộn = scrollIndex 0)`);
  log(`totalDiscoveryDuration=${((p.phaseB?.durationMs ?? 0) / 1000).toFixed(1)}s`);
  log(`totalScrollDuration=${(sumBy(scrolls, "scrollDurationMs") / 1000).toFixed(2)}s`);
  log(`totalWaitDuration=${(sumBy(scrolls, "waitDurationMs") / 1000).toFixed(2)}s`);
  log(`totalHierarchyDuration=${(sumBy(scrolls, "hierarchyDurationMs") / 1000).toFixed(2)}s`);
  log(`totalParseDuration=${(sumBy(scrolls, "parseDurationMs") / 1000).toFixed(2)}s`);
  log(`totalMatchDuration=${(sumBy(scrolls, "matchDurationMs") / 1000).toFixed(2)}s`);
  for (const s of scrolls) {
    log(
      `  scroll#${s.scrollIndex}: scroll=${s.scrollDurationMs ?? "-"}ms wait=${s.waitDurationMs ?? "-"}ms hierarchy=${s.hierarchyDurationMs}ms ` +
        `parse=${s.parseDurationMs}ms match=${s.matchDurationMs}ms nodes=${s.visibleCardRange?.totalNodes} candidates=${s.candidateCount}`,
    );
  }

  const apiCalls = p.phaseC?.apiCalls ?? [];
  const retries = apiCalls.filter((c) => c.attempt > 1).length;
  log(`\n[CMS DETAIL]`);
  log(`total_api_calls=${apiCalls.length}`);
  log(`retries=${retries}`);
  for (const c of apiCalls) {
    log(`  - ${c.call} [${c.title ?? "-"}] attempt=${c.attempt} status=${c.status} duration=${(c.durationMs / 1000).toFixed(2)}s`);
  }

  log(`\n[ANSWERING DETAIL]`);
  for (const q of questions) {
    log(`  Q${q.index}: total=${(q.durationMs / 1000).toFixed(2)}s (match=${(q.matchDurationMs / 1000).toFixed(2)}s, answer=${q.answerDurationMs != null ? (q.answerDurationMs / 1000).toFixed(2) + "s" : "-"})${q.isLast ? " [câu cuối]" : ""}`);
  }

  log(`\n[GIỚI HẠN ĐO ĐẠC - chưa tách được]`);
  log(
    `"submit start -> server response" và "submit -> result screen" (Phase F, theo yêu cầu) hiện GỘP ` +
      `trong answerDurationMs của câu cuối (Answer Q${questions.length || "?"}, isLast=true) - nằm bên trong ` +
      `answerCurrentQuestionOneShot() của automation/bai_tap/navigation/homeworkExamEngine.js (dùng chung nhiều ` +
      `flow khác), KHÔNG chỉnh sửa file đó trong lần đo instrumentation-only này để tránh rủi ro đổi hành vi các ` +
      `flow khác đang dùng chung engine.`,
  );
}

/** Orchestrator RIÊNG cho PRECHECK_ONLY=true - KHÔNG tái dùng main() (main() có toàn bộ luồng CMS/
 * tap/answer/submit thật, giữ nguyên KHÔNG đổi 1 dòng nào theo yêu cầu tương thích) - chỉ làm đúng 3
 * việc: [0] validate env tối thiểu, [A] profile-check (reuse ensureProProfileActive() y nguyên,
 * cần để đứng đúng ở tab "Bài tập" + đúng profile trước khi locate), [PRECHECK] gọi
 * runCanonicalLocatePrecheck() rồi DỪNG - không có bước nào sau đó (không CMS, không tap, không
 * answer, không submit). KHÔNG gọi refreshExamSessionFromEnvCookie() (chỉ cần cho CMS resolve, ngoài
 * phạm vi 1 precheck UI-only). */
async function runPrecheckOnly() {
  if (!APP_ID) throw new Error("Thiếu APP_ID - kiểm tra .env.");
  if (!PHONE || !OTP) throw new Error("Thiếu PHONE/OTP - kiểm tra test_data/accounts.env.");
  if (!TARGET_TITLE) {
    throw new Error(
      `PRECHECK_ONLY=true yêu cầu TARGET_TITLE (precheck xác nhận 1 card CỤ THỂ reachable qua canonical findAssignment() - không có mục tiêu nào để check nếu để tự quét "bất kỳ").`,
    );
  }

  const overallStart = Date.now();
  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  const setupT = await timed(() => bridge.start());
  try {
    log(`[A] Đảm bảo hồ sơ "${PROFILE_PRO_NAME}" (PRO) đang active...`);
    const profileT = await timed(() => ensureProProfileActive(bridge));
    log(`  [PASS] profile=${profileT.result.name} switched=${profileT.result.switched}`);

    const precheck = await runCanonicalLocatePrecheck(bridge, TARGET_TITLE);
    const totalMs = Date.now() - overallStart;

    log(`\n[PRECHECK REPORT]`);
    log(`target=${TARGET_TITLE}`);
    log(`result=${precheck.precheckStatus}`);
    log(`canonical_status=${precheck.canonicalStatus}`);
    log(`scrollCount=${precheck.scrollCount}`);
    log(`setup_ms=${setupT.durationMs + profileT.durationMs}`);
    log(`scrollToTop_ms=${precheck.scrollToTopMs}`);
    log(`canonical_find_ms=${precheck.canonicalFindMs}`);
    log(`precheck_total_ms=${precheck.scrollToTopMs + precheck.canonicalFindMs}`);
    log(`overall_total_ms=${totalMs}`);
    log(
      precheck.precheckStatus === "PRECHECK_PASS"
        ? `\n=> PRECHECK_PASS - an toàn để chạy full script (bỏ PRECHECK_ONLY, giữ nguyên các ENV khác).`
        : `\n=> ${precheck.precheckStatus} - KHÔNG chạy full script, xem [PRECHECK REPORT]/diagnostics phía trên để xử lý trước.`,
    );

    mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
    writeFileSync(
      OUTPUT_FILE,
      JSON.stringify(
        {
          status: precheck.precheckStatus,
          target: TARGET_TITLE,
          canonicalStatus: precheck.canonicalStatus,
          scrollCount: precheck.scrollCount,
          setupMs: setupT.durationMs + profileT.durationMs,
          scrollToTopMs: precheck.scrollToTopMs,
          canonicalFindMs: precheck.canonicalFindMs,
          precheckTotalMs: precheck.scrollToTopMs + precheck.canonicalFindMs,
          overallTotalMs: totalMs,
          diagnostics: precheck.diagnostics,
        },
        null,
        2,
      ),
      "utf8",
    );
    return precheck.precheckStatus;
  } finally {
    await bridge.stop();
    log("[MCP] Đã dừng tiến trình `maestro mcp`.");
  }
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
  overallStartMs = overallStart;
  const evidence = {};
  // profiling gắn vào evidence NGAY từ đầu (cùng reference) - mọi mutation sau đó (kể cả nếu hàm
  // return sớm ở nhánh BLOCKED/FAIL) đều tự động phản ánh vào evidence.profiling mà không cần gán
  // lại ở từng điểm return - xem docblock PROFILING đầu file.
  const profiling = newProfiling();
  evidence.profiling = profiling;

  log(`[EXAM_SESSION] Refresh session từ .env EXAM_COOKIE...`);
  const phaseAStart = now();
  const refreshResult = refreshExamSessionFromEnvCookie();
  if (!refreshResult.refreshed) {
    profiling.phaseA = { startedAt: phaseAStart, endedAt: now(), durationMs: now() - phaseAStart, bridgeStartMs: null, profileCheckMs: null };
    return finish({ status: "BLOCKED", phase: "EXAM_SESSION_REFRESH", error: refreshResult.reason, evidence });
  }
  log(`  [PASS] automation/.cache/exam_session.json đã ghi.`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  const bridgeStartT = await timed(() => bridge.start());
  const exam = new HomeworkExamEngine(bridge);

  try {
    log(`[A] Đảm bảo hồ sơ "${PROFILE_PRO_NAME}" (PRO) đang active...`);
    const profileCheckT = await timed(() => ensureProProfileActive(bridge));
    const profileResult = profileCheckT.result;
    evidence.profile = profileResult;
    profiling.phaseA = {
      startedAt: phaseAStart,
      endedAt: now(),
      durationMs: now() - phaseAStart,
      bridgeStartMs: bridgeStartT.durationMs,
      profileCheckMs: profileCheckT.durationMs,
    };
    log(`  [PASS] profile=${profileResult.name} switched=${profileResult.switched}`);

    const phaseBStart = now();
    let collected;
    if (TARGET_TITLE) {
      log(`[B] TARGET_TITLE cấu hình - cuộn THẲNG tới đúng card "${TARGET_TITLE}" (scrollToTop trước, dừng sớm khi list plateau thật - xem fix 2026-08-24)...`);
      collected = await locateSpecificCompletedCandidate(bridge, TARGET_TITLE, { maxScrolls: MAX_LOCATE_SCROLLS, scrollLog: profiling.phaseB.scrolls });
      if (collected.candidates.length === 0) {
        profiling.phaseB.startedAt = phaseBStart;
        profiling.phaseB.endedAt = now();
        profiling.phaseB.durationMs = now() - phaseBStart;
        return finish({
          status: "BLOCKED",
          phase: "LOCATE_CANDIDATE",
          error: `Không tìm/khớp được card "${TARGET_TITLE}" với cta="${COMPLETED_CTA}" trên hồ sơ "${PROFILE_PRO_NAME}" sau ${collected.scrollsUsed} lượt cuộn (stopReason=${collected.stopReason ?? "UNKNOWN"}).`,
          evidence,
        });
      }
    } else {
      log(`[B] Cuộn "Bài tập về nhà" gom candidate cta="Làm lại" (distinct theo title, budget ${MAX_CANDIDATE_ATTEMPTS})...`);
      collected = await collectDistinctCompletedCandidates(bridge, { maxScrolls: MAX_LOCATE_SCROLLS, maxDistinct: MAX_CANDIDATE_ATTEMPTS, scrollLog: profiling.phaseB.scrolls });
      if (collected.candidates.length === 0) {
        profiling.phaseB.startedAt = phaseBStart;
        profiling.phaseB.endedAt = now();
        profiling.phaseB.durationMs = now() - phaseBStart;
        return finish({ status: "BLOCKED", phase: "LOCATE_CANDIDATE", error: `Chưa có card cta="${COMPLETED_CTA}" nào trên hồ sơ "${PROFILE_PRO_NAME}".`, evidence });
      }
    }
    profiling.phaseB.startedAt = phaseBStart;
    profiling.phaseB.endedAt = now();
    profiling.phaseB.durationMs = now() - phaseBStart;
    evidence.candidatesFound = collected.candidates.length;
    log(`  Tìm được ${collected.candidates.length} candidate distinct sau ${collected.scrollsUsed} lượt cuộn.`);

    log(`[C] Chọn candidate đầu tiên thoả: room_id unique + CMS resolve được nội dung text-choice + target score (mode=${REDO_SCORE_MODE}) khả thi...`);
    const phaseCStart = now();
    const attempts = [];
    let chosen = null;
    for (const candidate of collected.candidates.slice(0, MAX_CANDIDATE_ATTEMPTS)) {
      const attempt = { title: candidate.title, oldScoreOnCard: parsePreviousScoreForLog(candidate.scoreText) };
      const roomResolveT = await timed(() => resolveUniqueRoomIdForCandidate(candidate));
      const { matches, unique, room } = roomResolveT.result;
      profiling.phaseC.apiCalls.push({ call: "resolveUniqueRoomIdForCandidate(getHomeworks)", title: candidate.title, durationMs: roomResolveT.durationMs, attempt: 1, status: unique ? "UNIQUE" : "AMBIGUOUS" });
      if (!unique) {
        attempt.ok = false;
        attempt.reason = `Resolve room_id KHÔNG unique (matches=${matches.length}) - loại, không đoán matches[0].`;
        attempts.push(attempt);
        log(`  [SKIP] "${candidate.title}": ${attempt.reason}`);
        continue;
      }
      const resolveQuestionsT = await timed(() => resolveHomeworkExamQuestionsForRoomIdCachedWithRetry(room.id));
      const resolved = resolveQuestionsT.result;
      if (resolved._profiling?.cacheHit) {
        profiling.phaseC.apiCalls.push({ call: "resolveHomeworkExamQuestionsForRoomId", title: candidate.title, roomId: room.id, durationMs: resolveQuestionsT.durationMs, attempt: 0, status: "CACHE_HIT" });
      }
      for (const a of resolved._profiling?.attempts ?? []) {
        profiling.phaseC.apiCalls.push({ call: "resolveHomeworkExamQuestionsForRoomId", title: candidate.title, roomId: room.id, durationMs: a.durationMs, attempt: a.attempt, status: a.status });
      }
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
    profiling.phaseC.startedAt = phaseCStart;
    profiling.phaseC.endedAt = now();
    profiling.phaseC.durationMs = now() - phaseCStart;
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
    const phaseDStart = now();
    const ctaPoint = centerPoint(chosen.candidate.ctaBounds);
    // Tách "tap + AI hỗ trợ học tập (nếu có)" khỏi "chờ màn Doing sẵn sàng" thành 2 lần gọi runSteps
    // riêng (CÙNG lệnh/thứ tự cũ) để đo tapMs/waitReadyMs riêng - xem docblock PROFILING đầu file.
    const tapT = await timed(() =>
      bridge.runSteps([
        { tapOn: { point: `${ctaPoint.x},${ctaPoint.y}` } },
        { waitForAnimationToEnd: { timeout: 3000 } },
        { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
      ]),
    );
    const waitReadyT = tapT.result.success
      ? await timed(() => bridge.runSteps([{ extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 15000 } }]))
      : { result: tapT.result, durationMs: 0 };
    const tapRedo = tapT.result.success ? waitReadyT.result : tapT.result;
    profiling.phaseD = { startedAt: phaseDStart, endedAt: now(), durationMs: now() - phaseDStart, tapMs: tapT.durationMs, waitReadyMs: waitReadyT.durationMs };
    evidence.redo = { tapped: tapRedo.success, landedOnDoing: tapRedo.success };
    if (!tapRedo.success) {
      return finish({ status: "FAIL", phase: "TAP_LAM_LAI", error: `Tap "Làm lại" (point ${ctaPoint.x},${ctaPoint.y}) thất bại: ${tapRedo.error}`, evidence });
    }
    log(`  [PASS] Đã tap "Làm lại" tại (${ctaPoint.x},${ctaPoint.y}) - vào màn Doing.`);

    log(
      `[E] Trả lời TOÀN BỘ ${chosen.resolved.questions.length} câu (mục tiêu target=${chosen.scoringPlan.targetScore}, ` +
        `cần đúng ${chosen.scoringPlan.correctIndices.size}/${chosen.resolved.questions.length} item)...`,
    );
    const phaseEStart = now();
    const QUESTIONS = chosen.resolved.questions;
    const WANT_CORRECT = buildWeightedWantCorrectPlan(QUESTIONS, chosen.scoringPlan.correctIndices);
    const answeredIds = new Set();
    const answerLog = [];
    let carryTree = null;
    let lastOutcome = null;
    while (answeredIds.size < QUESTIONS.length) {
      const questionIndex = answeredIds.size + 1;
      const qStart = now();
      const pool = QUESTIONS.filter((q) => !answeredIds.has(q.id));
      const matchT = await timed(() => findMatchingQuestion(bridge, pool, carryTree, questionIndex));
      const matchResult = matchT.result;
      if (matchResult.status !== "MATCHED") {
        const outcomeLabel = matchResult.status === "AMBIGUOUS" ? "AMBIGUOUS_MATCH" : "NO_MATCH";
        profiling.phaseE.questions.push({ index: questionIndex, startedAt: qStart, endedAt: now(), durationMs: now() - qStart, matchDurationMs: matchT.durationMs, answerDurationMs: null, outcome: outcomeLabel });
        profiling.phaseE.startedAt = phaseEStart;
        profiling.phaseE.endedAt = now();
        profiling.phaseE.durationMs = now() - phaseEStart;
        const errorMessage =
          matchResult.status === "AMBIGUOUS"
            ? `AMBIGUOUS_MATCH ở câu ${questionIndex}: ${matchResult.diagnostic.candidates.length} candidate CMS cùng khớp ĐỦ toàn bộ answer-set đang hiển thị ` +
              `(ids=${matchResult.diagnostic.candidates.map((c) => c.id).join(", ")}) - KHÔNG tự chọn candidate đầu tiên, xem log [MATCH][AMBIGUOUS] phía trên.`
            : `NO_MATCH ở câu ${questionIndex} (còn ${pool.length} câu): không có candidate CMS nào có ĐỦ TOÀN BỘ đáp án đang hiển thị trên UI - nội dung hiển thị trên màn ` +
              `hình KHÔNG khớp answers[] đầy đủ của bất kỳ câu nào trong ${pool.length} câu CMS đã resolve (có thể đề thật của lượt "Làm lại" này khác nội dung catalog ` +
              `Teacher Materials - xem GIỚI HẠN CÒN LẠI đầu file).`;
        return finish({
          status: "FAIL",
          phase: "ANSWER_LOOP",
          error: errorMessage,
          matchDiagnostic: matchResult.diagnostic,
          visibleTexts: collectAllTexts(carryTree ?? (await bridge.hierarchy())),
          evidence: { ...evidence, answerLog },
        });
      }
      const matched = matchResult.question;
      const isLast = answeredIds.size === QUESTIONS.length - 1;
      const answerT = await timed(() => answerOneQuestion(exam, matched, isLast, WANT_CORRECT));
      const { wantCorrect, outcome } = answerT.result;
      lastOutcome = outcome;
      carryTree = outcome.finalTree ?? null;
      answeredIds.add(matched.id);
      answerLog.push({ id: matched.id, question: matched.question, wantCorrect, isTargetCorrect: outcome.isTargetCorrect });
      profiling.phaseE.questions.push({
        index: questionIndex,
        id: matched.id,
        startedAt: qStart,
        endedAt: now(),
        durationMs: now() - qStart,
        matchDurationMs: matchT.durationMs,
        answerDurationMs: answerT.durationMs,
        isLast,
        outcome: "OK",
      });
      log(`  Câu ${answeredIds.size}/${QUESTIONS.length}: nhắm ${wantCorrect ? "ĐÚNG" : "SAI"}, isTargetCorrect=${outcome.isTargetCorrect}`);
    }
    profiling.phaseE.startedAt = phaseEStart;
    profiling.phaseE.endedAt = now();
    profiling.phaseE.durationMs = now() - phaseEStart;
    evidence.answerLog = answerLog;

    // Phase F bắt đầu: đọc kết quả (không có bridge call mới - dùng lại finalTree đã có từ câu cuối)
    // rồi đóng màn Kết quả + quay lại danh sách + ghi report. LƯU Ý GIỚI HẠN (không suy đoán thêm):
    // "submit start -> server response" và "submit -> result screen" nằm BÊN TRONG
    // answerCurrentQuestionOneShot() của câu cuối (HomeworkExamEngine, file dùng chung cho NHIỀU
    // flow khác) - KHÔNG tách riêng được ở lớp instrumentation này (chỉ đo trong phạm vi file .mjs
    // này, không đụng vào engine dùng chung để tránh rủi ro đổi hành vi flow khác) - 2 mốc đó đã nằm
    // gộp trong `answerDurationMs` của "Answer Q{cuối}" (xem `isLast` trong phaseE.questions).
    const phaseFStart = now();
    const readResultT = await timed(async () => {
      const finalTree = lastOutcome?.finalTree ?? null;
      const isResult = exam.isResultScreen(finalTree);
      const result = isResult ? exam.readResult(finalTree) : null;
      return { finalTree, isResult, result };
    });
    const { finalTree, isResult, result } = readResultT.result;
    if (!isResult) {
      profiling.phaseF = { ...profiling.phaseF, startedAt: phaseFStart, endedAt: now(), durationMs: now() - phaseFStart, readResultMs: readResultT.durationMs };
      return finish({ status: "FAIL", phase: "RESULT_SCREEN", error: "Không thấy màn hình Kết quả sau khi trả lời hết toàn bộ câu.", evidence });
    }
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
      profiling.phaseF = { ...profiling.phaseF, startedAt: phaseFStart, endedAt: now(), durationMs: now() - phaseFStart, readResultMs: readResultT.durationMs };
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

    // Tách "tap Hoàn thành/Tiếp theo" khỏi "chờ về homework_screen" thành 2 lần gọi riêng (CÙNG
    // lệnh/thứ tự cũ) để đo closeTapMs/returnToListMs riêng - xem docblock PROFILING đầu file.
    const closeTapT = await timed(() =>
      bridge.runSteps([
        { runFlow: { when: { visible: "Hoàn thành" }, commands: [{ tapOn: { text: ".*(Hoàn thành).*" } }] } },
        { runFlow: { when: { visible: "Tiếp theo" }, commands: [{ tapOn: { id: "exercise_result_close_button" } }] } },
      ]),
    );
    const returnToListT = await timed(() => bridge.wait({ id: "homework_screen" }, { timeout: 30000 }));
    const backToList = returnToListT.result;
    evidence.back = { returnedToList: backToList.success };
    if (!backToList.success) {
      profiling.phaseF = {
        startedAt: phaseFStart,
        endedAt: now(),
        durationMs: now() - phaseFStart,
        readResultMs: readResultT.durationMs,
        closeTapMs: closeTapT.durationMs,
        returnToListMs: returnToListT.durationMs,
        reportWriteMs: null,
      };
      return finish({ status: "FAIL", phase: "CLOSE_RESULT", error: `Không quay lại được homework_screen sau khi đóng kết quả: ${backToList.error}`, evidence });
    }
    log(`  [PASS] Đã đóng màn Kết quả, quay lại homework_screen.`);

    evidence.totalDurationSeconds = (Date.now() - overallStart) / 1000;
    profiling.phaseF = {
      startedAt: phaseFStart,
      endedAt: now(),
      durationMs: now() - phaseFStart,
      readResultMs: readResultT.durationMs,
      closeTapMs: closeTapT.durationMs,
      returnToListMs: returnToListT.durationMs,
      reportWriteMs: null,
    };
    const finalResult = { status: "PASS", evidence };
    // Ghi file 2 LẦN có chủ đích: lần 1 để ĐO thời gian ghi thật (`writeFileSync`), lần 2 (ĐÈ cùng
    // file, cùng nội dung + đúng 1 field mới `reportWriteMs`) để chính report JSON phản ánh được số
    // đo đó - không có cách nào biết trước "thời gian ghi file" TRƯỚC KHI ghi. Không đổi status/kết
    // quả PASS, không ảnh hưởng correctness.
    const writeStart = now();
    finish(finalResult);
    profiling.phaseF.reportWriteMs = now() - writeStart;
    profiling.phaseF.durationMs += profiling.phaseF.reportWriteMs;
    return finish(finalResult);
  } catch (err) {
    return finish({ status: "ERROR", error: err.message, stack: err.stack, evidence });
  } finally {
    await bridge.stop();
    log("[MCP] Đã dừng tiến trình `maestro mcp`.");
  }
}

// Guard chuẩn ESM (MỚI 2026-08-24, đi kèm việc export locateSpecificCompletedCandidate() để viết
// test riêng cho fix scroll/plateau - xem ROOT CAUSE): CHỈ tự chạy main() khi file này được gọi trực
// tiếp (`node .../pro_lamlai_target_score.mjs`), KHÔNG chạy khi 1 script khác `import` để tái sử
// dụng hàm export - trước đây thiếu guard này khiến BẤT KỲ import nào cũng tự kích hoạt toàn bộ
// main() (login/profile-switch/redo/submit thật) như 1 side effect ngoài ý muốn. KHÔNG đổi hành vi
// khi chạy trực tiếp như cũ (điều kiện luôn đúng trong trường hợp đó).
// BUG ĐÃ SỬA (2026-08-24, phát hiện ngay lần chạy CLI thật đầu tiên sau khi thêm guard): so sánh
// thô `file://${process.argv[1]}` SAI ở 2 điểm - (1) process.argv[1] thường là đường dẫn TƯƠNG ĐỐI
// khi gọi `node flows/...mjs` từ thư mục gốc repo, trong khi import.meta.url LUÔN là URL TUYỆT ĐỐI;
// (2) đường dẫn repo có khoảng trắng ("Autotest app Parrot") - import.meta.url mã hoá thành "%20"
// nhưng ghép chuỗi thô thì không - khiến 2 vế KHÔNG BAO GIỜ khớp dù chạy trực tiếp, main() không bao
// giờ được gọi, script thoát code 0 mà KHÔNG làm gì (im lặng, không log, không ghi report) - lỗi rất
// nguy hiểm vì "thành công giả". Dùng `pathToFileURL().href` (chuẩn Node, tự resolve tuyệt đối +
// encode giống hệt import.meta.url) để so sánh đúng.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PRECHECK_ONLY) {
    // Nhánh RIÊNG cho precheck (MỚI 2026-08-25) - KHÔNG đụng nhánh main() cũ bên dưới (else ngầm định
    // khi PRECHECK_ONLY không set/false, hành vi 100% như trước). Exit code RIÊNG, không tái dùng
    // thang PASS=0/BLOCKED=3/khác=1 của main() để tránh lẫn 2 loại kết quả khác nhau:
    //   0 = PRECHECK_PASS, 3 = PRECHECK_NOT_FOUND, 4 = PRECHECK_BLOCKED, 2 = ERROR ngoài dự kiến.
    runPrecheckOnly()
      .then((status) => {
        process.exit(status === "PRECHECK_PASS" ? 0 : status === "PRECHECK_NOT_FOUND" ? 3 : 4);
      })
      .catch((err) => {
        console.error("\n[pro_lamlai_target_score PRECHECK] Dừng lại vì lỗi ngoài dự kiến:\n", err);
        process.exit(2);
      });
  } else {
    main()
      .then((result) => {
        printReport(result);
        printProfilingSummary(result);
        log(`\nĐã ghi report ra ${OUTPUT_FILE}`);
        process.exit(result.status === "PASS" ? 0 : result.status === "BLOCKED" ? 3 : 1);
      })
      .catch((err) => {
        console.error("\n[pro_lamlai_target_score] Dừng lại vì lỗi ngoài dự kiến:\n", err);
        finish({ status: "ERROR", error: err.message, stack: err.stack });
        process.exit(2);
      });
  }
}
