#!/usr/bin/env node
/**
 * REPRO-Locate-Reuse-Room
 *
 * Focused reproduction (KHÔNG phải full E2E) theo yêu cầu debug (2026-09-07): "xác định chính xác
 * tại sao automation đang click/tab nhầm bài và sửa cơ chế locate/select bài tập" cho room ĐÃ TỒN
 * TẠI (KHÔNG giao bài mới): ROOM_ID="4c4314f9-74dc-48a9-a293-e4f2c430b43a" (title "G8U2-Listening-
 * BTTH", class "8D", profile "Hạnh vy").
 *
 * KẾT LUẬN SAU KHI ĐỌC flows/web/giao_bai_tap/e2e-teacher-assign-full-scored-target5.mjs (file được
 * chỉ định debug): `locateOpenAndVerifyAssignment()` (export sẵn, dòng 407 file đó) ĐÃ LÀ cơ chế
 * identity-based đúng yêu cầu (fix ngày 2026-08-22 cho chính bug "click nhầm card liền kề" - xem
 * docblock hàm đó) - KHÔNG viết lại, script này CHỈ gọi lại nguyên vẹn để tái hiện có kiểm chứng
 * trên room thật, KHÔNG sửa bất kỳ dòng nào trong file gốc.
 *
 * Cơ chế identity thật của locateOpenAndVerifyAssignment() (tóm tắt, xem docblock đầy đủ tại
 * nguồn):
 *   1. findAssignment() (automation/bai_tap/discovery/findAssignment.js) liệt kê MỌI candidate
 *      khớp title+dueDate+cta trên UI hiện tại (không dùng index, không dùng text quá chung chung -
 *      title so sánh EXACT).
 *   2. Với MỖI candidate (kể cả khi title/dueDate trùng nhau - vd 2 card cùng "Hạn nộp 14/09"),
 *      MỞ THẬT candidate đó rồi so nội dung câu hỏi đang hiển thị với bộ câu hỏi ĐÃ RESOLVE qua
 *      resolveHomeworkExamQuestionsForRoomId(ROOM_ID) (nguồn sự thật duy nhất, không suy đoán) -
 *      "content fingerprint" CHÍNH LÀ identity thật duy nhất khả dụng (app Android không lộ room_id
 *      qua UI, không có href/DOM id như web).
 *   3. Đúng 1 candidate khớp content trong 1 lượt quét -> ACCEPT. 0 candidate khớp -> cuộn thêm tìm
 *      candidate mới (không lặp vô hạn - MAX_SCROLL_ROUNDS=40 hoặc 2 lượt liên tiếp không tiến
 *      triển). >=2 candidate CÙNG khớp content trong CÙNG 1 lượt quét -> FAIL NGAY
 *      (AMBIGUOUS_CONTENT_MATCH), không đoán chọn.
 *   4. Toàn bộ candidate đã thử (kèm text/dueDate/cta/bounds/kết quả mở/kết quả so nội dung) được
 *      ghi vào `triedLog` - script này in ra ĐẦY ĐỦ, không rút gọn.
 *
 * SCOPE của repro này (KHÔNG làm gì khác): mở tab Bài tập -> verify profile hiện tại (BLOCK nếu
 * KHÔNG khớp, KHÔNG bao giờ tự chuyển profile - đúng yêu cầu "không chuyển profile" đã có trong hội
 * thoại) -> fetchRoomDetails(ROOM_ID) + resolveHomeworkExamQuestionsForRoomId(ROOM_ID) (chỉ ĐỌC,
 * không giao bài) -> locateOpenAndVerifyAssignment() -> nếu mở đúng, ĐÓNG LẠI NGAY (không trả lời
 * câu nào, không nộp bài) -> in report. KHÔNG target score, KHÔNG business logic assign, KHÔNG sửa
 * findAssignment.js/locateOpenAndVerifyAssignment().
 *
 * ENV: APP_ID/PHONE/OTP (.env, test_data/accounts.env), EXAM_COOKIE (.env, get_tokens.sh),
 *   MAESTRO_DEVICE (tuỳ chọn), ROOM_ID (default room "G8U2-Listening-BTTH" đã biết),
 *   PROFILE_NAME (default "Hạnh vy" - hồ sơ ĐANG active thật trên máy lúc viết file này).
 *
 * CHẠY: node flows/web/giao_bai_tap/repro-locate-reuse-room.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parseEnvFile } from "../../../automation/src/config.js";
import { MaestroMcpBridge } from "../../../automation/bridge/maestroMcpBridge.js";
import { fetchRoomDetails } from "../../../automation/bai_tap/discovery/homeworks.js";
import { resolveHomeworkExamQuestionsForRoomId } from "../../../automation/bai_tap/discovery/teacherMaterialsExamResolver.js";
import { formatDM, formatDMY, isoToVnYmd } from "../../../automation/bai_tap/verify-filter-web-vs-app.mjs";
// Gọi lại NGUYÊN VẸN cơ chế locate/identity đã có sẵn + đã fix trong file được chỉ định debug -
// KHÔNG viết lại, KHÔNG copy logic bên trong.
import { locateOpenAndVerifyAssignment, collectAllTexts, isVisibleInTree } from "./e2e-teacher-assign-full-scored-target5.mjs";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..");
const ROOT_ENV_PATH = join(PROJECT_ROOT, ".env");
const ACCOUNTS_ENV_PATH = join(PROJECT_ROOT, "test_data", "accounts.env");
const EXAM_SESSION_PATH = join(PROJECT_ROOT, "automation", ".cache", "exam_session.json");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "repro_locate_reuse_room_report.json");

const ROOT_ENV = parseEnvFile(ROOT_ENV_PATH);
const ACCOUNTS_ENV = parseEnvFile(ACCOUNTS_ENV_PATH);
const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
const PHONE = process.env.PHONE || ACCOUNTS_ENV.PHONE;
const OTP = process.env.OTP || ACCOUNTS_ENV.OTP;
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";
const ROOM_ID = process.env.ROOM_ID || "4c4314f9-74dc-48a9-a293-e4f2c430b43a";
const PROFILE_NAME = process.env.PROFILE_NAME || "Hạnh vy";

function log(...args) {
  console.log(...args);
}

function refreshExamSessionFromEnvCookie() {
  const examCookie = process.env.EXAM_COOKIE || ROOT_ENV.EXAM_COOKIE;
  if (!examCookie) return { refreshed: false, reason: "EXAM_COOKIE không tồn tại trong .env - chạy get_tokens.sh trước." };
  const session = { examOrigin: "https://exam.parrotedu.vn", cookieHeader: `Bearer=${examCookie}`, localStorage: {} };
  mkdirSync(dirname(EXAM_SESSION_PATH), { recursive: true });
  writeFileSync(EXAM_SESSION_PATH, JSON.stringify(session, null, 2), "utf8");
  return { refreshed: true };
}

function finish(result) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  return result;
}

function printTriedLog(triedLog) {
  log(`\n[CANDIDATES TRIED] (${triedLog.length})`);
  triedLog.forEach((t, i) => {
    const c = t.candidate;
    log(
      `  #${i + 1} title="${c?.title}" dueDate="${c?.dueDate}" cta="${c?.cta}" ctaBounds=${JSON.stringify(c?.ctaBounds)}` +
        ` opened=${t.opened} contentMatched=${t.contentMatched} reopen=${Boolean(t.reopen)}` +
        (t.error ? ` error=${t.error}` : "") +
        (t.matched ? ` matchedQuestionId=${t.matched.id}` : ""),
    );
  });
}

async function main() {
  if (!APP_ID) throw new Error("Thiếu APP_ID - kiểm tra .env.");
  if (!PHONE || !OTP) throw new Error("Thiếu PHONE/OTP - kiểm tra test_data/accounts.env.");

  const evidence = {};

  log(`[0] Refresh EXAM_COOKIE session...`);
  const sessionResult = refreshExamSessionFromEnvCookie();
  if (!sessionResult.refreshed) return finish({ status: "BLOCKED", phase: "EXAM_SESSION", error: sessionResult.reason, evidence });
  log(`  [PASS] exam_session.json đã ghi.`);

  log(`[1] fetchRoomDetails(ROOM_ID=${ROOM_ID}) (READ-ONLY, KHÔNG giao bài)...`);
  const roomDetails = await fetchRoomDetails(ROOM_ID);
  const room = roomDetails?.room;
  if (!room) return finish({ status: "FAIL", phase: "FETCH_ROOM", error: `fetchRoomDetails("${ROOM_ID}") không trả về room hợp lệ.`, evidence });
  const dueVnYmd = isoToVnYmd(room.end_time);
  const dueDM = formatDM(dueVnYmd);
  evidence.room = { id: room.id, title: room.name, dueTimeVn: formatDMY(dueVnYmd) };
  log(`  [PASS] room_id=${room.id} title="${room.name}" due=${formatDMY(dueVnYmd)}`);

  log(`[2] Resolve câu hỏi/đáp án THẬT qua CMS cho room_id=${ROOM_ID} (dùng làm content-fingerprint)...`);
  const resolved = await resolveHomeworkExamQuestionsForRoomId(ROOM_ID);
  if (resolved.status !== "RESOLVED") {
    return finish({ status: "BLOCKED", phase: "RESOLVE_QUESTIONS", error: `status=${resolved.status}: ${resolved.reason}`, evidence });
  }
  const swapAnswer = resolved.roomDetails?.room?.exams?.[0]?.is_swap_answer ?? null;
  const swapQuestion = resolved.roomDetails?.room?.exams?.[0]?.is_swap_question ?? null;
  if (swapAnswer || swapQuestion) {
    return finish({ status: "BLOCKED", phase: "RESOLVE_QUESTIONS", error: `is_swap_answer=${swapAnswer}/is_swap_question=${swapQuestion} - không tin tưởng đáp án.`, evidence });
  }
  const QUESTIONS = resolved.questions;
  evidence.totalScoredItems = QUESTIONS.length;
  log(`  [PASS] ${QUESTIONS.length} scored items resolved từ CMS.`);

  const bridge = new MaestroMcpBridge({ appId: APP_ID, deviceId: MAESTRO_DEVICE });
  await bridge.start();
  try {
    log(`[3] Mở app + tab "Bài tập" (KHÔNG chuyển profile - chỉ verify)...`);
    const openTab = await bridge.runSteps([
      { launchApp: { permissions: { all: "allow" } } },
      { extendedWaitUntil: { visible: { text: ".*(Đăng nhập|Vui học|Bài tập|Báo cáo).*" }, timeout: 30000 } },
      { tapOn: { text: "Bài tập", optional: true } },
      { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao|Bạn không có bài tập nào đang chờ|2 tuần gần nhất|1 tháng gần nhất).*" }, timeout: 30000 } },
    ]);
    if (!openTab.success) return finish({ status: "FAIL", phase: "OPEN_TAB", error: openTab.error, evidence });

    const activeTexts = collectAllTexts(await bridge.hierarchy());
    const profileActive = isVisibleInTree(activeTexts, `.*(${PROFILE_NAME}).*`);
    evidence.profileActive = profileActive;
    if (!profileActive) {
      return finish({
        status: "BLOCKED",
        phase: "PROFILE_CHECK",
        error: `Hồ sơ đang active KHÔNG khớp "${PROFILE_NAME}" - script này KHÔNG tự chuyển hồ sơ. Texts: ${JSON.stringify(activeTexts.slice(0, 10))}`,
        evidence,
      });
    }
    log(`  [PASS] Hồ sơ "${PROFILE_NAME}" xác nhận đang active.`);

    log(`[4] locateOpenAndVerifyAssignment() - title="${room.name}" dueDateDM="${dueDM}" (identity-based, KHÔNG index)...`);
    const located = await locateOpenAndVerifyAssignment(bridge, { title: room.name, dueDateDM: dueDM, questions: QUESTIONS });
    printTriedLog(located.triedLog ?? []);
    evidence.locateStatus = located.ok ? "OK" : located.status;
    evidence.triedCount = located.triedLog?.length ?? 0;

    if (!located.ok) {
      return finish({ status: "FAIL", phase: "LOCATE", error: `locateOpenAndVerifyAssignment() status=${located.status}: ${located.diagnostics ?? ""}`, evidence });
    }
    log(`\n  [PASS] Mở ĐÚNG assignment - matched question id=${located.matched?.id} text="${located.matched?.question}"`);
    evidence.matchedQuestion = { id: located.matched?.id, text: located.matched?.question };

    log(`[5] Đóng lại NGAY (repro chỉ scope tới bước locate+verify, KHÔNG trả lời câu nào)...`);
    const close = await bridge.runSteps([
      { tapOn: { id: "exercise_close_button" } },
      { waitForAnimationToEnd: { timeout: 1500 } },
      { tapOn: { text: "Thoát", optional: true } },
      { tapOn: { text: "Đồng ý", optional: true } },
      { tapOn: { text: "Xác nhận", optional: true } },
      { extendedWaitUntil: { visible: { id: "homework_screen" }, timeout: 20000 } },
    ]);
    if (!close.success) return finish({ status: "FAIL", phase: "CLOSE", error: close.error, evidence });
    log(`  [PASS] Đã đóng, quay lại homework_screen - KHÔNG có câu nào bị trả lời/nộp.`);

    return finish({ status: "PASS", evidence });
  } finally {
    await bridge.stop();
    log("[MCP] Đã dừng tiến trình `maestro mcp`.");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((result) => {
      log(`\n[OVERALL] ${result.status}`);
      if (result.status !== "PASS") log(`[ROOT_CAUSE] ${result.error ?? result.phase ?? "-"}`);
      log(`\nĐã ghi report ra ${OUTPUT_FILE}`);
      process.exitCode = result.status === "PASS" ? 0 : result.status === "BLOCKED" ? 3 : 1;
    })
    .catch((err) => {
      console.error("\n[repro-locate-reuse-room] Dừng lại vì lỗi ngoài dự kiến:\n", err);
      finish({ status: "ERROR", error: err.message, stack: err.stack });
      process.exitCode = 2;
    });
}
