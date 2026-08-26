#!/usr/bin/env node
/**
 * Setup + run cho HW-29 (flows/app/bai_tap/ktra_ket_qua_tiep_theo_hoan_thanh.yaml).
 *
 * Flow YAML tự nó KHÔNG tạo dữ liệu (Maestro thuần không gọi được Web GV) - cần ĐÚNG 3 bài tập
 * MỚI, hạn nộp 3 mốc rõ rệt (current < near < far), trên tài khoản/profile "Hoàng Lan" (xem memory
 * feedback_tieptheo_hoanthanh_test_account - tài khoản này được chọn RIÊNG cho nhóm case "Tiếp
 * theo"/"Hoàn thành" vì cố tình giữ ít bài tập, dễ kiểm soát dữ liệu). Script này:
 *   [1] Quét cây assignment eligible THẬT của lớp "2A" qua API (KHÔNG qua DOM/random mù) - tái
 *       dùng nguyên vẹn `fetchEligibleAssignmentTree()`.
 *   [2] Xác nhận THẬT qua CMS (không chỉ dựa `skills` catalog - đã xác nhận `isSpeak` catalog có
 *       thể bỏ lọt câu SPEAK thật, xem `pickVerifiedTextChoiceCandidates`) rằng câu hỏi là dạng chữ
 *       (text-choice), an toàn cho `answer-current-exercise-generic.yaml`. Dedupe theo itemName
 *       (nhiều item khác nhau có thể trùng tên mẫu, xem comment tại chỗ gọi).
 *   [3] Giao 3 item đã xác nhận qua Web GV (`assignHomeworkFlow()`, PINNED bằng `homeworkItemId`)
 *       với 3 hạn nộp cách nhau rõ rệt cho lớp "2A".
 *   [4] Chạy `maestro test ktra_ket_qua_tiep_theo_hoan_thanh.yaml` (flow YAML thuần, verify CTA
 *       thật trên thiết bị - xem file đó để biết chi tiết case).
 *
 * PHẠM VI (thống nhất 2026-08-22): case CHỈ verify hành vi CTA/điều hướng (nhãn đúng theo trạng
 * thái còn/hết bài + bấm thật + có điều hướng/quay về danh sách) - KHÔNG verify "Tiếp theo" có đưa
 * đúng vào bài hạn nộp gần nhất hay không (verify identity đó cần nội dung câu hỏi + so khớp trên
 * màn Doing, đã thử qua 1 bản riêng dùng MaestroMcpSession/findAssignment.js nhưng bị đánh giá phức
 * tạp không cần thiết cho mục tiêu case này).
 *
 * ENV:
 *   APP_ID (.env)
 *   PHONE (default "0911122231"), OTP (default "888888"), PROFILE_NAME (default "Hoàng Lan")
 *   ASSIGN_PRIMARY_CLASS (default "2A")
 *   MAESTRO_DEVICE (tuỳ chọn, khớp -device khi chạy `maestro`)
 *   TEACHER_ACCESS_TOKEN/CMS_TOKEN/EXAM_COOKIE (.env, xem get_teacher_token.sh/get_tokens.sh -
 *     PHẢI refresh trước khi chạy, xem README/memory feedback_get_tokens_script)
 *
 * CHẠY: node automation/bai_tap/setup-ktra_ket_qua_tiep_theo_hoan_thanh.mjs
 */

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseEnvFile, requireTeacherPortalConfig } from "../src/config.js";
import { assignHomeworkFlow } from "../giao_bai_tap/runtime/assignHomeworkFlow.js";
import { fetchEligibleAssignmentTree } from "../giao_bai_tap/navigation/teacherAssignmentApiDiscovery.js";
import { parseQuestionsFromExamPage } from "../discovery/examPageScraper.js";
import { normalizeQuestions } from "../model/questionModel.js";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..");
const FLOW_FILE = join(SELF_DIR, "ktra_ket_qua_tiep_theo_hoan_thanh.yaml");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "ktra_ket_qua_tiep_theo_hoan_thanh_report.json");
const ROOT_ENV = parseEnvFile(join(PROJECT_ROOT, ".env"));

const APP_ID = process.env.APP_ID || ROOT_ENV.APP_ID;
// Tài khoản/profile RIÊNG cho nhóm case Tiếp theo/Hoàn thành - KHÔNG dùng PHONE/OTP mặc định của
// test_data/accounts.env (tài khoản đó tích luỹ backlog, xem memory feedback_tieptheo_hoanthanh_test_account).
const PHONE = process.env.PHONE || "0911122231";
const OTP = process.env.OTP || "888888";
const PROFILE_NAME = process.env.PROFILE_NAME || "Hoàng Lan";
const ASSIGN_PRIMARY_CLASS = process.env.ASSIGN_PRIMARY_CLASS || "2A";
const MAESTRO_DEVICE = process.env.MAESTRO_DEVICE || "";

function deviceArgs() {
  return MAESTRO_DEVICE ? ["--device", MAESTRO_DEVICE] : [];
}

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

async function assignOne(label, candidate, dueDateDdMmYyyy) {
  log(
    `[ASSIGN:${label}] "${candidate.itemName}" (unit=${candidate.unitName}, lesson=${candidate.lessonName}, webGvLessonTab=${candidate.lessonTag}) - hạn nộp ${dueDateDdMmYyyy}...`,
  );
  const result = await assignHomeworkFlow({
    primaryClass: ASSIGN_PRIMARY_CLASS,
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

async function main() {
  requireTeacherPortalConfig();
  if (!APP_ID) throw new Error("Thiếu APP_ID - kiểm tra .env.");

  log(`[1/3] Quét cây assignment eligible thật của lớp "${ASSIGN_PRIMARY_CLASS}" (API, không qua DOM/random mù)...`);
  const { eligibleTree, stats } = await fetchEligibleAssignmentTree(ASSIGN_PRIMARY_CLASS);
  log(`  [DISCOVERY] totalItems=${stats.totalItems} | itemsWithExam=${stats.itemsWithExam} | itemsWithoutExam=${stats.itemsWithoutExam}`);
  const flat = flattenNonSpeak(eligibleTree);
  log(`  [DISCOVERY] non-SPEAK eligible candidates (có lessonTag): ${flat.length}`);

  log(`[1b/3] Xác nhận nội dung CMS thật (loại SPEAK/CONNECT/DRAG_DROP còn sót) cho 3 candidate...`);
  const [current, near, far] = await pickVerifiedTextChoiceCandidates(flat, 3);
  log(`  [PICKED] current="${current.itemName}" | near="${near.itemName}" | far="${far.itemName}"`);

  const dueCurrent = addDaysDdMmYyyy(2);
  const dueNear = addDaysDdMmYyyy(6);
  const dueFar = addDaysDdMmYyyy(20);

  log(`[2/3] Giao 3 bài mới qua Web GV (lớp "${ASSIGN_PRIMARY_CLASS}", hạn nộp cách nhau rõ rệt: ${dueCurrent} / ${dueNear} / ${dueFar})...`);
  await assignOne("current", current, dueCurrent);
  await assignOne("near", near, dueNear);
  await assignOne("far", far, dueFar);

  log(`[3/3] Chạy flows/app/bai_tap/ktra_ket_qua_tiep_theo_hoan_thanh.yaml trên thiết bị thật...`);
  const flowEnv = {
    APP_ID,
    PHONE,
    OTP,
    PROFILE_NAME,
    EXERCISE_NAME_CURRENT: current.itemName,
    EXERCISE_DUE_DATE_DM_CURRENT: toDM(dueCurrent),
    EXERCISE_NAME_NEAR: near.itemName,
    EXERCISE_NAME_FAR: far.itemName,
  };
  const args = [...deviceArgs(), "test", FLOW_FILE];
  for (const [k, v] of Object.entries(flowEnv)) args.push("-e", `${k}=${v}`);
  log(`  maestro ${args.join(" ")}`);

  let maestroStatus = "PASS";
  let maestroOutput = "";
  try {
    maestroOutput = execFileSync("maestro", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    maestroStatus = "FAIL";
    maestroOutput = `${err.stdout?.toString?.() ?? ""}\n${err.stderr?.toString?.() ?? ""}\n${err.message}`;
  }
  console.log(maestroOutput);

  const report = {
    status: maestroStatus,
    assignedClass: ASSIGN_PRIMARY_CLASS,
    candidates: { current, near, far },
    dueDates: { current: dueCurrent, near: dueNear, far: dueFar },
    flowEnv,
    maestroOutputTail: maestroOutput.slice(-8000),
  };
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2), "utf8");
  log(`\n[OVERALL] ${maestroStatus}`);
  log(`Report: ${OUTPUT_FILE}`);
  process.exit(maestroStatus === "PASS" ? 0 : 1);
}

main().catch((err) => {
  console.error("\n[setup-ktra_ket_qua_tiep_theo_hoan_thanh] Dừng lại vì lỗi ngoài dự kiến:\n", err.message);
  process.exit(2);
});
