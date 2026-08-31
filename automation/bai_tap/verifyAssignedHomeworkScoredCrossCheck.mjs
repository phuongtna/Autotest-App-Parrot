#!/usr/bin/env node
/**
 * Cross-check "bài tập cô giao" (App HS) <-> Web GV cho 1 assignment HS ĐÃ LÀM + ĐÃ CÓ ĐIỂM.
 *
 * YÊU CẦU GỐC (user, 2026-08-27): tìm 1 bài đã làm/đã có điểm trên tab Bài tập App HS, mở "Xem
 * bài đã làm" đọc tên/điểm/số lần làm, rồi đối chiếu ĐÚNG assignment đó trên Web GV (Báo cáo lớp
 * -> Đã hoàn thành -> Chi tiết bài làm học sinh) bằng NHIỀU tín hiệu (không chỉ tên), verify điểm/
 * số lần làm khớp nhau, verify Hạn nộp/Ngày giao lấy từ dữ liệu Web GV thật. KHÔNG hardcode tên
 * bài/điểm/số lần làm/ngày. KHÔNG chọn first-fit khi Web GV có nhiều assignment cùng tên - phải
 * log AMBIGUOUS/NO_MATCH thay vì đoán.
 *
 * TÁI SỬ DỤNG (không viết lại - xem báo cáo phân tích đã thống nhất với user trước khi code):
 *   - automation/bai_tap/discovery/locateCompletedCandidate.js#collectDistinctCompletedCandidates
 *     - tìm card completed (cta="Làm lại") + scoreText + bounds "Xem bài đã làm" (viewLinkBounds,
 *     field MỚI thêm cho case này - xem docblock file đó) trên App HS, qua MaestroMcpSession
 *     (nhanh, không bị đánh lừa bởi card trùng title - cùng kiến trúc đã dùng ở
 *     e2e-teacher-assign-student-open.mjs).
 *   - flows/app/helpers/open-homework-list-for-locate.yaml - login + mở tab Bài tập (preamble),
 *     KHÔNG đổi filter (xem "FILTER 'BÀI TẬP CÔ GIAO'" dưới).
 *   - automation/bai_tap/discovery/homeworks.js#fetchAllHomeworkRooms +
 *     model/homeworkModel.js#normalizeHomework/resolveMyStatus - dataset Web GV qua API.
 *   - automation/bai_tap/verify-filter-web-vs-app.mjs#fetchRoomAnalyticScore (MỞ RỘNG thêm tham
 *     số studentId + export - xem docblock tại đó) - điểm Web GV ĐÚNG thang 0-10 khớp "Điểm N"
 *     App HS (KHÔNG dùng room.answers[].point/total_point - đã xác nhận khác thang).
 *   - automation/bai_tap/verify-filter-web-vs-app.mjs#isoToVnYmd/formatDM/formatDMY - quy đổi giờ
 *     VN + format ngày, KHÔNG tự viết hàm ngày giờ mới (đã có comment tại homeworkModel.js cảnh
 *     báo "không tự copy-paste thêm lần thứ N").
 *   - automation/giao_bai_tap/runtime/openStudentResultFlow.js (MỞ RỘNG thêm target params +
 *     đọc summary/submitHistory thật - xem docblock tại đó, backward-compatible với TC5 cũ) -
 *     "Báo cáo lớp -> Đã hoàn thành -> Chi tiết bài làm học sinh" trên Web GV.
 *   - automation/giao_bai_tap/navigation/teacherAssignedListPageObjects.js#locateAssignedRow (qua
 *     openStudentResultFlow) - đã tự throw AssignedRowNotFoundError nếu 0 hoặc ≥2 dòng khớp
 *     class+tên+hạn nộp, dùng làm 1 lớp an toàn AMBIGUOUS bổ sung ở phía UI Web GV.
 *
 * FILTER "BÀI TẬP CÔ GIAO" (đã thống nhất với user, KHÔNG suy đoán riêng): sheet filter App HS
 * CHỈ có 2 option thật ("2 tuần gần nhất"/"1 tháng gần nhất" - xem homeworkPageObjects.js), không
 * có option nào tên "bài tập cô giao". Đã xác nhận với user: toàn bộ tab "Bài tập" (khác Vui học
 * tự học) CHÍNH LÀ "bài tập cô giao" - không phải 1 filter riêng. Case này chọn "1 tháng gần
 * nhất" thay vì mặc định "2 tuần" CHỈ để mở rộng phạm vi quét (đo thật: dưới "2 tuần" không đủ
 * card để collectDistinctCompletedCandidates() gặp 1 card completed nào trước khi dừng sớm) -
 * KHÔNG phải business rule, cả 2 filter đều hợp lệ theo yêu cầu "toàn bộ tab" đã thống nhất.
 *
 * HẠN NỘP CHO CARD ĐÃ CÓ ĐIỂM (đã thống nhất với user): card completed KHÔNG hiển thị dòng "Hạn
 * nộp" trên App (business rule đã xác nhận thật - xem homeworkUiList.js#SCORE_PATTERN docblock +
 * verify-filter-web-vs-app.mjs dòng 39-43). PHẦN 4/5 yêu cầu "verify hạn nộp đúng trên App" vì vậy
 * được hiểu là: assert App ĐÚNG state ẩn "Hạn nộp" (không phải so sánh giá trị hiển thị, vì không
 * có giá trị nào hiển thị) - Hạn nộp/Ngày giao thật lấy từ Web GV (room.end_time/start_time) chỉ
 * dùng để LOG làm bằng chứng đối chiếu, không so khớp ngược lại UI App.
 *
 * MATCH KHÔNG CHỈ THEO TÊN (PHẦN 3): khoá match = (title, score qua room-analytic) - CÙNG kỹ
 * thuật/khoá đã dùng bởi verify-filter-web-vs-app.mjs cho nhóm "completed". Nếu Web GV có ≥2 room
 * cùng title+status=COMPLETED(học sinh test) nhưng ĐIỂM KHÁC NHAU, chỉ giữ những room có điểm ==
 * appScore; nếu sau lọc điểm vẫn còn ≥2 -> AMBIGUOUS thật (2 room hoàn toàn không phân biệt được
 * bằng App), KHÔNG chọn đại. 0 room khớp (dù đã lọc theo cả title lẫn điểm) -> NO_MATCH.
 *
 * ENV (đều optional, có default cho tài khoản test đã xác nhận CÓ SẴN dữ liệu completed thật, xem
 * README.md "Reuse-first"): APP_ID/PHONE/OTP (.env/test_data/accounts.env), MAESTRO_DEVICE,
 * ASSIGN_HEADLESS (Web GV Playwright, default true), TARGET_CLASS_ID (id lớp thật của tài khoản
 * App HS test), TARGET_CLASS_NAME (tên lớp hiển thị trên Web GV, PHẢI cùng trỏ 1 lớp với
 * TARGET_CLASS_ID), TARGET_STUDENT_ID (room.answers[].user_id của HS test), TARGET_STUDENT_NAME
 * (tên hiển thị trên Web GV "Đã hoàn thành" của ĐÚNG học sinh TARGET_STUDENT_ID).
 *
 * CHẠY: node automation/bai_tap/verifyAssignedHomeworkScoredCrossCheck.mjs
 *
 * VERDICT: PASS | FAIL | BLOCKED_<lý do> (severity PASS(0) < FAIL(1) < BLOCKED(2), đúng convention
 * repo - xem verify-filter-web-vs-app.mjs).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MaestroMcpSession } from "./discovery/maestroMcpSession.js";
import { collectDistinctCompletedCandidates } from "./discovery/locateCompletedCandidate.js";
import { scrollToTop } from "./discovery/findAssignment.js";
import { fetchAllHomeworkRooms } from "./discovery/homeworks.js";
import { normalizeHomework, resolveMyStatus } from "./model/homeworkModel.js";
import { isoToVnYmd, formatDM, formatDMY, fetchRoomAnalyticScore } from "./verify-filter-web-vs-app.mjs";
import { requireTeacherPortalConfig } from "../src/config.js";
import { execCliSync } from "../src/execCli.js";
import { openStudentResultFlow } from "../giao_bai_tap/runtime/openStudentResultFlow.js";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..");
const HELPERS_DIR = join(PROJECT_ROOT, "flows", "app", "helpers");
const OPEN_HOMEWORK_LIST_FOR_LOCATE_FLOW = join(HELPERS_DIR, "open-homework-list-for-locate.yaml");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "verify_assigned_homework_scored_cross_check_report.json");

function loadEnvFile(path) {
  const env = {};
  if (!existsSync(path)) return env;
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return env;
}
const rootEnv = loadEnvFile(join(PROJECT_ROOT, ".env"));
const accountsEnv = loadEnvFile(join(PROJECT_ROOT, "test_data", "accounts.env"));

const APP_ID = process.env.APP_ID || rootEnv.APP_ID;
const PHONE = process.env.PHONE || accountsEnv.PHONE;
const OTP = process.env.OTP || accountsEnv.OTP;
const DEVICE_ID = process.env.MAESTRO_DEVICE || "";
const ASSIGN_HEADLESS = process.env.ASSIGN_HEADLESS !== "false";

// Defaults trỏ tới tài khoản/lớp/học sinh ĐÃ XÁC NHẬN THẬT có ≥1 assignment completed (2026-08-27,
// xem evidence trong report) - overridable qua ENV, KHÔNG hardcode logic match theo giá trị này
// (matching bên dưới hoàn toàn dựa vào title+score đọc runtime, không so sánh với 3 hằng số này).
const TARGET_CLASS_ID = process.env.TARGET_CLASS_ID || "da3efdea-e0ea-4627-b119-a11c329d3d4e";
const TARGET_CLASS_NAME = process.env.TARGET_CLASS_NAME || "7QA-Test";
const TARGET_STUDENT_ID = process.env.TARGET_STUDENT_ID || "4fad8ed3-0114-4ce4-817c-7af0d86a8f03";
const TARGET_STUDENT_NAME = process.env.TARGET_STUDENT_NAME || "Trần Duy Anh";

const MAX_LOCATE_SCROLLS = 30;
const SCORE_VALUE_PATTERN = /^Điểm\s*([0-9]+(?:[.,][0-9]+)?)/;

function deviceArgs() {
  return DEVICE_ID ? ["--device", DEVICE_ID] : [];
}

function parseScoreText(scoreText) {
  if (!scoreText) return null;
  const m = SCORE_VALUE_PATTERN.exec(scoreText);
  if (!m) return null;
  return Number(m[1].replace(",", "."));
}

function centerPoint(bounds) {
  return { x: Math.round((bounds.x1 + bounds.x2) / 2), y: Math.round((bounds.y1 + bounds.y2) / 2) };
}

function collectAllTexts(node, acc = []) {
  const text = node?.attributes?.text;
  if (typeof text === "string" && text.trim()) acc.push(text.trim());
  for (const child of node?.children ?? []) collectAllTexts(child, acc);
  return acc;
}

function openHomeworkListForLocate() {
  return execCliSync(
    "maestro",
    [...deviceArgs(), "test", OPEN_HOMEWORK_LIST_FOR_LOCATE_FLOW, "-e", `APP_ID=${APP_ID}`, "-e", `PHONE=${PHONE}`, "-e", `OTP=${OTP}`, "-e", "SWITCH_TO_MONTH_FILTER=true"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
}

/**
 * PHẦN 1 (App HS): tìm 1 card đã hoàn thành+có điểm bất kỳ, mở "Xem bài đã làm", đọc số lần làm
 * qua "Lần N" (kỹ thuật đã verify trong pro_lamlai_fullluong_xemchitiet.mjs, không viết lại thuật
 * toán match card - chỉ tái dùng collectDistinctCompletedCandidates()).
 * @returns {Promise<{ok:true, candidate, appScore, appAttemptCount}|{ok:false, status, classification, summary, evidence}>}
 */
async function locateAndOpenScoredCardOnApp() {
  const session = new MaestroMcpSession(DEVICE_ID ? { deviceId: DEVICE_ID } : {});
  await session.start();
  try {
    const adapter = { hierarchy: () => session.hierarchy(), runSteps: (steps) => session.run(APP_ID, steps) };

    console.log('[APP 1/3] Cuộn về đỉnh danh sách (tránh bỏ sót header section do vị trí cuộn còn sót lại từ phiên trước)...');
    await scrollToTop(adapter);

    // BUG THẬT đã gặp + sửa (2026-08-27, xem docblock collectDistinctCompletedCandidates()): hàm
    // đó chỉ set sectionSeen=true khi CHÍNH nó thấy header "Bài tập về nhà" trong 1 lượt đọc của
    // nó - phải gọi NGAY sau scrollToTop() (không cuộn tay trước) để header còn trong lượt đọc đầu
    // tiên. Đồng thời card completed nằm sau vài card CHƯA làm (progress không tăng vài lượt đầu là
    // BÌNH THƯỜNG, không phải list đứng yên) nên nới maxNoProgressStreak thay vì dùng default=2.
    console.log('[APP 1/3] Tìm 1 card "Bài tập về nhà" đã hoàn thành + có điểm (cta="Làm lại")...');
    const { candidates, scrollsUsed } = await collectDistinctCompletedCandidates(adapter, {
      maxScrolls: MAX_LOCATE_SCROLLS,
      maxDistinct: 1,
      maxNoProgressStreak: 8,
    });
    const withScore = candidates.filter((c) => c.scoreText && c.viewLinkBounds);
    if (withScore.length === 0) {
      return {
        ok: false,
        status: "BLOCKED",
        classification: "BLOCKED_NO_SCORED_CARD_FOUND",
        summary: `Không tìm thấy card nào đã hoàn thành + có điểm + có bounds "Xem bài đã làm" sau ${scrollsUsed} lượt cuộn (tab "Bài tập", filter mặc định).`,
        evidence: { scrollsUsed, candidatesSeen: candidates },
      };
    }
    const candidate = withScore[0];
    const appScore = parseScoreText(candidate.scoreText);
    console.log(`  [PASS] Chọn card "${candidate.title}" (scoreText="${candidate.scoreText}" -> score=${appScore}, dueDateBefore=${candidate.dueDateBefore ?? "null"}).`);
    if (appScore === null) {
      return {
        ok: false,
        status: "BLOCKED",
        classification: "BLOCKED_SCORE_UNPARSEABLE",
        summary: `Card "${candidate.title}" có scoreText="${candidate.scoreText}" nhưng không parse được thành số.`,
        evidence: { candidate },
      };
    }

    console.log('[APP 2/3] Bấm "Xem bài đã làm" (tap theo toạ độ, không dùng text selector)...');
    const point = centerPoint(candidate.viewLinkBounds);
    const tapResult = await session.run(APP_ID, [{ tapOn: { point: `${point.x},${point.y}` } }, { waitForAnimationToEnd: { timeout: 1500 } }]);
    if (!tapResult.success) {
      return {
        ok: false,
        status: "FAIL",
        classification: "VIEW_COMPLETED_TAP_FAILED",
        summary: `Tap "Xem bài đã làm" (point ${point.x},${point.y}) cho card "${candidate.title}" thất bại: ${tapResult.error}`,
        evidence: { candidate },
      };
    }

    console.log("[APP 3/3] Đọc màn lịch sử làm bài (đúng assignment? số lần làm?)...");
    const tree = await session.hierarchy();
    const texts = collectAllTexts(tree);
    const onHistoryScreen = texts.some((t) => /^Lần\s*\d+$/.test(t));
    const titleMatches = texts.includes(candidate.title);
    if (!onHistoryScreen || !titleMatches) {
      return {
        ok: false,
        status: "FAIL",
        classification: "VIEW_COMPLETED_WRONG_SCREEN",
        summary: `Sau khi tap "Xem bài đã làm" cho "${candidate.title}": onHistoryScreen=${onHistoryScreen}, titleMatches=${titleMatches} - không xác nhận được đã mở đúng màn lịch sử của đúng assignment.`,
        evidence: { candidate, textsSample: texts.slice(0, 40) },
      };
    }
    const lanNumbers = texts.map((t) => /^Lần\s*(\d+)$/.exec(t)).filter(Boolean).map((m) => Number(m[1]));
    const appAttemptCount = lanNumbers.length > 0 ? Math.max(...lanNumbers) : null;
    console.log(`  [PASS] Đúng màn lịch sử "${candidate.title}", số lần làm (max "Lần N") = ${appAttemptCount ?? "không đọc được"}.`);

    return { ok: true, candidate, appScore, appAttemptCount };
  } finally {
    await session.stop();
  }
}

/**
 * PHẦN 3 (match App<->Web, KHÔNG chỉ theo tên): tìm room Web GV cùng title + cùng điểm (qua
 * room-analytic, đúng thang App) cho TARGET_STUDENT_ID trong lớp TARGET_CLASS_ID. Trả về đúng 1
 * room hoặc AMBIGUOUS/NO_MATCH kèm evidence đầy đủ - không chọn đại.
 */
async function resolveWebAssignment(appTitle, appScore) {
  requireTeacherPortalConfig();
  const rawRooms = await fetchAllHomeworkRooms({ period: "MONTH" });
  const inClassSameTitle = rawRooms
    .filter((r) => (r.room?.class_ids ?? []).includes(TARGET_CLASS_ID))
    .map(normalizeHomework)
    .filter((h) => h.title === appTitle);

  const completedSameTitle = inClassSameTitle.filter((h) => resolveMyStatus(h, TARGET_STUDENT_ID) === "COMPLETED");
  if (completedSameTitle.length === 0) {
    return {
      ok: false,
      status: "BLOCKED",
      classification: "BLOCKED_NO_MATCH",
      matchStatus: "NO_MATCH",
      summary: `Web GV không có room nào title="${appTitle}" ở lớp ${TARGET_CLASS_ID} với status=COMPLETED cho học sinh ${TARGET_STUDENT_ID} (title-only candidates: ${inClassSameTitle.length}).`,
      evidence: { titleOnlyCandidateCount: inClassSameTitle.length, titleOnlyRoomIds: inClassSameTitle.map((h) => h.id) },
    };
  }

  const scored = [];
  for (const h of completedSameTitle) {
    const webScore = await fetchRoomAnalyticScore(h.id, TARGET_STUDENT_ID);
    scored.push({ homework: h, webScore });
  }

  const blockedMismatch = scored.filter((s) => s.webScore === undefined || s.webScore === null);
  const scoreMatches = scored.filter((s) => typeof s.webScore === "number" && s.webScore === appScore);

  if (scoreMatches.length === 0) {
    return {
      ok: false,
      status: "BLOCKED",
      classification: blockedMismatch.length === scored.length ? "BLOCKED_ROOM_ANALYTIC_DATA_MISMATCH" : "BLOCKED_NO_MATCH",
      matchStatus: blockedMismatch.length === scored.length ? "BLOCKED" : "NO_MATCH",
      summary: `${completedSameTitle.length} room title="${appTitle}" status=COMPLETED nhưng KHÔNG room nào có room-analytic score == appScore(${appScore}) (scores thấy được: ${scored.map((s) => s.webScore).join(", ")}).`,
      evidence: { scored: scored.map((s) => ({ roomId: s.homework.id, webScore: s.webScore })) },
    };
  }
  if (scoreMatches.length > 1) {
    return {
      ok: false,
      status: "BLOCKED",
      classification: "BLOCKED_AMBIGUOUS_MATCH",
      matchStatus: "AMBIGUOUS",
      summary: `${scoreMatches.length} room Web GV CÙNG title="${appTitle}" CÙNG score=${appScore} cho học sinh ${TARGET_STUDENT_ID} - không phân biệt được đâu là đúng assignment trên App, không chọn đại.`,
      evidence: { roomIds: scoreMatches.map((s) => s.homework.id) },
    };
  }

  const match = scoreMatches[0].homework;
  return { ok: true, matchStatus: "MATCHED", homework: match, webScore: scoreMatches[0].webScore, allCandidateRoomIds: completedSameTitle.map((h) => h.id) };
}

function finish(result) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  console.log(`\n=== KẾT QUẢ: ${result.status}${result.classification ? ` (${result.classification})` : ""} ===`);
  console.log(result.summary);
  console.log(`\nĐã ghi report ra ${OUTPUT_FILE}`);
  process.exitCode = result.status === "PASS" ? 0 : result.status === "FAIL" ? 1 : 2;
}

function logCrossCheck(fields) {
  console.log("[assignment-cross-check]");
  for (const [k, v] of Object.entries(fields)) console.log(`${k}=${v === null || v === undefined ? "null" : v}`);
}

async function main() {
  if (!APP_ID) throw new Error("Thiếu APP_ID - kiểm tra .env.");
  if (!PHONE || !OTP) throw new Error("Thiếu PHONE/OTP - kiểm tra test_data/accounts.env.");

  console.log('Mở app (giữ session), đăng nhập, mở tab "Bài tập" (filter mặc định = "bài tập cô giao")...');
  openHomeworkListForLocate();

  const appResult = await locateAndOpenScoredCardOnApp();
  if (!appResult.ok) return finish(appResult);
  const { candidate, appScore, appAttemptCount } = appResult;

  console.log(`\n[WEB 1/2] Resolve assignment Web GV khớp title="${candidate.title}" + score=${appScore} (không chỉ theo tên)...`);
  const webResolve = await resolveWebAssignment(candidate.title, appScore);
  if (!webResolve.ok) {
    logCrossCheck({
      appAssignmentName: candidate.title,
      webAssignmentName: null,
      appScore,
      webStudentScore: null,
      appAttemptCount,
      webAttemptCount: null,
      appDueDate: candidate.dueDateBefore,
      webDueDate: null,
      webAssignmentId: null,
      matchStatus: webResolve.matchStatus,
    });
    return finish(webResolve);
  }
  const { homework } = webResolve;
  const dueVnYmd = isoToVnYmd(homework.deadline.endTime);
  const startVnYmd = isoToVnYmd(homework.deadline.startTime);
  const webDueDateLine = formatDMY(dueVnYmd); // format bảng "Bài tập đã giao" Web GV (DD/MM/YYYY)
  console.log(`  [PASS] room_id=${homework.id} title="${homework.title}" score=${webResolve.webScore} hạn nộp(VN)=${webDueDateLine} ngày giao(VN)=${formatDMY(startVnYmd)}`);

  console.log('\n[WEB 2/2] Mở "Báo cáo lớp" -> "Đã hoàn thành" -> đúng học sinh -> "Chi tiết bài làm"...');
  const studentResult = await openStudentResultFlow({
    headless: ASSIGN_HEADLESS,
    targetClassName: TARGET_CLASS_NAME,
    targetItemName: homework.title,
    targetDueDateLine: webDueDateLine,
    targetStudentName: TARGET_STUDENT_NAME,
  });
  if (studentResult.status !== "PASS") {
    const failedStep = studentResult.steps.find((s) => s.status === "FAIL");
    logCrossCheck({
      appAssignmentName: candidate.title,
      webAssignmentName: homework.title,
      appScore,
      webStudentScore: webResolve.webScore,
      appAttemptCount,
      webAttemptCount: null,
      appDueDate: candidate.dueDateBefore,
      webDueDate: webDueDateLine,
      webAssignmentId: homework.id,
      matchStatus: "BLOCKED",
    });
    return finish({
      status: "BLOCKED",
      classification: "BLOCKED_WEB_UI_DRILLDOWN_FAILED",
      summary: `Đã resolve đúng room_id=${homework.id} qua API nhưng không mở được UI "Chi tiết bài làm" (bước "${failedStep?.name}"): ${studentResult.error}`,
      evidence: { homework: { id: homework.id, title: homework.title }, studentResultSteps: studentResult.steps },
    });
  }
  const webScoreFromUi = Number(String(studentResult.summary.scoreText).replace(",", "."));
  const webAttemptCount = studentResult.submitHistory.attemptCount;

  logCrossCheck({
    appAssignmentName: candidate.title,
    webAssignmentName: homework.title,
    appScore,
    webStudentScore: webScoreFromUi,
    appAttemptCount,
    webAttemptCount,
    appDueDate: candidate.dueDateBefore,
    webDueDate: webDueDateLine,
    webAssignmentId: homework.id,
    matchStatus: "MATCHED",
  });

  // ---- PHẦN 5: Assertion ----
  const findings = [];
  if (candidate.title !== homework.title) {
    findings.push({ verdict: "FAIL", note: `Tên bài App ("${candidate.title}") != tên bài Web ("${homework.title}") sau khi match - không nên xảy ra (bug matching).` });
  }
  if (appScore !== webScoreFromUi) {
    findings.push({ verdict: "FAIL", note: `Điểm App (${appScore}) != Điểm Web GV UI (${webScoreFromUi}).` });
  }
  if (candidate.dueDateBefore !== null) {
    findings.push({ verdict: "FAIL", note: `Card đã có điểm nhưng App vẫn hiển thị "Hạn nộp" ("${candidate.dueDateBefore}") - sai business rule đã xác nhận (card completed phải ẩn Hạn nộp).` });
  }
  if (appAttemptCount !== null && webAttemptCount !== appAttemptCount) {
    findings.push({ verdict: "FAIL", note: `Số lần làm App (${appAttemptCount}) != số lần làm Web GV (${webAttemptCount}).` });
  } else if (appAttemptCount === null) {
    findings.push({ verdict: "BLOCKED", note: `Không đọc được số lần làm trên App (màn lịch sử không có "Lần N" nào) - không so sánh được với Web (${webAttemptCount}).` });
  }

  const severity = { PASS: 0, FAIL: 1, BLOCKED: 2 };
  const overall = findings.reduce((acc, f) => (severity[f.verdict] > severity[acc] ? f.verdict : acc), "PASS");

  return finish({
    status: overall,
    summary:
      overall === "PASS"
        ? `Assignment "${candidate.title}" (room_id=${homework.id}) khớp hoàn toàn giữa App HS và Web GV: điểm=${appScore}, số lần làm=${appAttemptCount}, hạn nộp(Web)=${webDueDateLine}, ngày giao(Web)=${formatDMY(startVnYmd)}.`
        : `${findings.length} vấn đề khi đối chiếu App<->Web cho "${candidate.title}" (room_id=${homework.id}) - xem findings.`,
    findings,
    evidence: {
      app: { title: candidate.title, score: appScore, attemptCount: appAttemptCount, dueDateDisplayed: candidate.dueDateBefore },
      web: {
        roomId: homework.id,
        title: homework.title,
        scoreFromRoomAnalytic: webResolve.webScore,
        scoreFromUi: webScoreFromUi,
        attemptCount: webAttemptCount,
        dueDateLine: webDueDateLine,
        assignDateLine: formatDMY(startVnYmd),
        allCandidateRoomIdsBeforeScoreFilter: webResolve.allCandidateRoomIds,
        submitHistory: studentResult.submitHistory,
      },
    },
  });
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error("\n[verifyAssignedHomeworkScoredCrossCheck] Dừng lại vì lỗi ngoài dự kiến:\n");
    console.error(err);
    process.exitCode = 2;
  });
}

export { locateAndOpenScoredCardOnApp, resolveWebAssignment };
