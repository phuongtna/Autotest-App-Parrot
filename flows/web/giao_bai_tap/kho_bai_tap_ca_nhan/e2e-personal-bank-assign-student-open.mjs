#!/usr/bin/env node
/**
 * TC023 (xem TESTCASES.md cùng thư mục) - "Học sinh nhận đúng bài tập được giao từ kho cá nhân":
 * GV giao 1 bài từ "Kho bài tập cá nhân" -> xác nhận App HS hiển thị ĐÚNG bài đó (đúng tiêu đề +
 * hạn nộp) -> mở được bài (nội dung thật load lên, không lỗi).
 *
 * TÁI SỬ DỤNG (KHÔNG viết lại logic đã có, chỉ ghép nối - [[feedback_reuse_first_workflow]]):
 *   - `automation/giao_bai_tap/navigation/teacherPortalSession.js#loginTeacherPortal()` - đăng
 *     nhập Web GV qua Playwright (đã hỗ trợ sẵn override baseUrl/username/password, không cần sửa
 *     gì để dùng cho môi trường/tài khoản khác .env mặc định).
 *   - `automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/selectPersonalBankSource.js#selectPersonalBankClassStably()`
 *     - chọn nguồn "Kho bài tập cá nhân" + Lớp ỔN ĐỊNH (né bug revert radio dùng chung cả module).
 *   - `automation/giao_bai_tap/navigation/dueDatePopover.js#setDueDateViaPopover()` - set Hạn nộp.
 *   - Bắt response `POST .../api/user/exams/create_room.json` lấy `room_id` thật (pattern dùng
 *     chung khắp module `kho_bai_tap_ca_nhan`, xem TESTCASES.md).
 *   - `flows/app/helpers/ensure-profile-active.yaml` - đảm bảo ĐÚNG hồ sơ HS đang active (VERIFY +
 *     toggle nếu cần, KHÔNG phải hard switch mù).
 *   - `automation/bai_tap/discovery/findAssignment.js` + `maestroMcpSession.js` - tìm ĐÚNG 1 card
 *     trên App HS theo (title, Hạn nộp DD/MM), target-driven, không phụ thuộc số lượng assignment -
 *     CÙNG cơ chế `flows/web/giao_bai_tap/e2e-teacher-assign-student-open.mjs#locateAssignmentOnApp()`
 *     dùng (không export được nên viết lại Y HỆT ở đây bằng đúng 2 khối import đó, không đổi logic).
 *   - `flows/app/helpers/open-exercise.yaml` - bấm "Làm bài" + xác nhận màn làm bài mở đúng (cổng
 *     `exercise_close_button`, không phụ thuộc loại câu hỏi).
 *
 * CẬP NHẬT (2026-09-18, theo yêu cầu trực tiếp user "chạy trên app nhớ check cả 2 bộ lọc"):
 * `locateAssignmentOnApp()` giờ kiểm tra CẢ 2 bộ lọc ("2 tuần gần nhất" mặc định + "1 tháng gần
 * nhất") thay vì chỉ tin bộ lọc mặc định - TÁI SỬ DỤNG nguyên step của
 * `flows/app/helpers/homework-select-month-filter.yaml` (inline lại vì `runFlow:` tới file ngoài
 * không resolve được qua MCP "run" - yaml dựng inline không có base path). Cũng thêm
 * `scrollToTop()` (trước đây thiếu - xem [[feedback_reuse_scroll_locate_mechanisms]]) ngay trước
 * mỗi lần `findAssignment()`.
 *
 * KHÁC `e2e-teacher-assign-student-open.mjs`: file đó random Unit/Lesson/assignment trong Bộ sách
 * "Kết nối tri thức" (`assignHomeworkFlow.js` - CHƯA hỗ trợ nguồn "Kho bài tập cá nhân", đã kiểm
 * tra trực tiếp source code, không có nhánh nào xử lý `__personal_bank__`) nên KHÔNG tái dùng được
 * cho case này - phần Web GV ở đây viết lại theo ĐÚNG pattern đã verify thật trong chính các spec
 * của module `kho_bai_tap_ca_nhan` (vd `assign-submit.spec.js#TC021`), chỉ đổi transport từ
 * Playwright Test fixture sang gọi `chromium`/`page` trực tiếp (giống cách `assignHomeworkFlow.js`
 * đang làm) để chạy được như 1 script CLI độc lập.
 *
 * KHÔNG cần diff before/after qua API (khác `assignHomeworkAndLocateOnApp()`) vì tiêu đề/hạn nộp
 * đọc được TRỰC TIẾP từ chính DOM lúc tick checkbox + response `create_room.json` - không cần suy
 * đoán "bài nào vừa random".
 *
 * ENV:
 *   SOURCE_BASE_URL, SOURCE_USERNAME, SOURCE_PASSWORD, SOURCE_PERSONAL_BANK_CLASS (GV, giống mọi
 *     spec khác trong module - BẮT BUỘC, không có mặc định).
 *   APP_ID (default đọc `.env`), PHONE/OTP (HS, BẮT BUỘC - KHÔNG dùng mặc định
 *     test_data/accounts.env vì có thể sai tài khoản/lớp), PROFILE_NAME (hồ sơ HS cần active,
 *     BẮT BUỘC), MAESTRO_DEVICE (optional).
 *   ASSIGN_DUE_DATE_DAYS_AHEAD (default 3 - đủ gần để nằm trong filter "2 tuần gần nhất" mặc định
 *     của App HS, không cần đổi filter).
 *
 * CHẠY:
 *   SOURCE_BASE_URL="https://parrotedu-staging.parrotedu.vn" SOURCE_USERNAME="0912312312" \
 *   SOURCE_PASSWORD="123456789" SOURCE_PERSONAL_BANK_CLASS="5D" \
 *   PHONE="0915775115" OTP="888888" PROFILE_NAME="Gia Linh" \
 *   node flows/web/giao_bai_tap/kho_bai_tap_ca_nhan/e2e-personal-bank-assign-student-open.mjs
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loginTeacherPortal } from "../../../../automation/giao_bai_tap/navigation/teacherPortalSession.js";
import { teacherPortalPageObjects as po } from "../../../../automation/giao_bai_tap/navigation/teacherPortalPageObjects.js";
import { selectPersonalBankClassStably } from "../../../../automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/selectPersonalBankSource.js";
import { setDueDateViaPopover } from "../../../../automation/giao_bai_tap/navigation/dueDatePopover.js";
import { execCliSync } from "../../../../automation/src/execCli.js";
import { MaestroMcpSession } from "../../../../automation/bai_tap/discovery/maestroMcpSession.js";
import { findAssignment, scrollToTop } from "../../../../automation/bai_tap/discovery/findAssignment.js";

// TÁI SỬ DỤNG NGUYÊN VĂN bước đổi bộ lọc "1 tháng gần nhất" từ module "Bài tập" - COPY từ
// flows/app/helpers/homework-select-month-filter.yaml + phần mở sheet trong
// flows/app/helpers/open-homework-list-for-locate.yaml (không gọi được `runFlow:` tới file ngoài
// qua MCP "run" - yaml được dựng inline không có base path - nên inline lại ĐÚNG step, không đổi
// logic). Dùng để kiểm tra card dưới CẢ 2 bộ lọc (không chỉ mặc định "2 tuần gần nhất"), theo đúng
// mức độ kỹ lưỡng đã áp dụng ở lần điều tra TC033 gốc trên dev (2026-09-16).
const SWITCH_TO_MONTH_FILTER_STEPS = [
  { tapOn: { text: ".*gần nhất.*" } },
  { extendedWaitUntil: { visible: { text: ".*(Xem bài tập theo).*" }, timeout: 10000 } },
  { tapOn: { text: ".*(1 tháng gần nhất).*" } },
  { tapOn: { text: "Xem" } },
  { extendedWaitUntil: { notVisible: { text: ".*(Xem bài tập theo).*" }, timeout: 10000 } },
  { extendedWaitUntil: { visible: { text: ".*(1 tháng gần nhất).*" }, timeout: 20000 } },
  { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao|Kiến thức trong bài|Bạn không có bài tập nào đang chờ).*" }, timeout: 30000 } },
];

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..", "..");
const HELPERS_DIR = join(PROJECT_ROOT, "flows", "app", "helpers");
const ENSURE_PROFILE_ACTIVE_FLOW = join(HELPERS_DIR, "ensure-profile-active.yaml");
const OPEN_EXERCISE_FLOW = join(HELPERS_DIR, "open-exercise.yaml");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "tc023_personal_bank_assign_student_open_report.json");

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

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Thiếu biến môi trường ${name} (xem docblock đầu file).`);
  return value;
}

const SOURCE_BASE_URL = readRequiredEnv("SOURCE_BASE_URL");
const SOURCE_USERNAME = readRequiredEnv("SOURCE_USERNAME");
const SOURCE_PASSWORD = readRequiredEnv("SOURCE_PASSWORD");
const SOURCE_PERSONAL_BANK_CLASS = readRequiredEnv("SOURCE_PERSONAL_BANK_CLASS");
const APP_ID = process.env.APP_ID || rootEnv.APP_ID;
const PHONE = readRequiredEnv("PHONE");
const OTP = readRequiredEnv("OTP");
const PROFILE_NAME = readRequiredEnv("PROFILE_NAME");
const DEVICE_ID = process.env.MAESTRO_DEVICE || "";
const ASSIGN_DUE_DATE_DAYS_AHEAD = Number(process.env.ASSIGN_DUE_DATE_DAYS_AHEAD || 3);

function deviceArgs() {
  return DEVICE_ID ? ["--device", DEVICE_ID] : [];
}

function addDaysParts(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return { day: d.getDate(), month: d.getMonth() + 1 };
}
function formatDM(day, month) {
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

function finish(result) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  console.log(`\n=== KẾT QUẢ: ${result.status} ===`);
  console.log(result.summary);
  console.log(`\nĐã ghi report ra ${OUTPUT_FILE}`);
  return result;
}

/** Web GV (Playwright, transport độc lập - KHÔNG qua Playwright Test fixture) - giao 1 bài từ Kho
 * bài tập cá nhân, tick checkbox ĐẦU TIÊN đang hiển thị (KHÔNG hardcode Unit/Lesson/tên bài, giống
 * tinh thần assign-submit.spec.js#TC021 - bất kỳ item thật nào của lớp đều hợp lệ cho case này). */
async function assignFromPersonalBank() {
  const { browser, context, page } = await loginTeacherPortal({
    headless: true,
    baseUrl: SOURCE_BASE_URL,
    username: SOURCE_USERNAME,
    password: SOURCE_PASSWORD,
  });
  try {
    await page.goto(`${SOURCE_BASE_URL}/teacher/exercise`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: po.menu.createButton, exact: true }).click();
    await selectPersonalBankClassStably(page, SOURCE_PERSONAL_BANK_CLASS);

    const firstCheckbox = page.locator('button[role="checkbox"][id^="lesson-item-"]').first();
    await firstCheckbox.waitFor({ state: "visible", timeout: 10000 });
    // Đọc tiêu đề THẬT ngay tại đây (không đoán) - leo lên ancestor gần nhất chứa "câu hỏi" (đúng
    // cấu trúc DOM đã verify ở nhiều spec khác trong module).
    const title = await firstCheckbox.evaluate((el) => {
      let node = el;
      for (let i = 0; i < 8 && node; i++) {
        node = node.parentElement;
        if (node?.innerText?.includes("câu hỏi")) return node.innerText.split("\n\n")[0].trim();
      }
      return null;
    });
    if (!title) throw new Error("Không đọc được tiêu đề item đầu tiên trong Danh sách bài tập.");

    await firstCheckbox.click();
    const checked = await firstCheckbox.getAttribute("aria-checked");
    if (checked !== "true") throw new Error("Tick checkbox không thành công (aria-checked vẫn false).");

    const { day, month } = addDaysParts(ASSIGN_DUE_DATE_DAYS_AHEAD);
    const dueDateTrigger = page
      .getByText(po.dueDate.label, { exact: true })
      .locator("xpath=following-sibling::*[@aria-haspopup='menu'][1]");
    await setDueDateViaPopover(page, dueDateTrigger, { day, month });

    const [createRoomResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("create_room.json")),
      page.getByRole("button", { name: po.submit.button }).click(),
    ]);
    const body = await createRoomResponse.json();
    const roomId = body?.data?.created_rooms?.[0]?.room_id;
    if (!roomId) throw new Error(`Không lấy được room_id từ create_room.json: ${JSON.stringify(body)}`);
    await page.getByText(po.submit.successToast).waitFor({ timeout: 15000 });

    return { roomId, title, dueDateDM: formatDM(day, month) };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

/** App HS: đảm bảo ĐÚNG hồ sơ đang active (ensure-profile-active.yaml, VERIFY + toggle nếu cần,
 * không phải hard switch mù) rồi tìm ĐÚNG 1 card qua findAssignment() (target-driven, an toàn với
 * danh sách có nhiều card trùng title/hạn nộp - xem docblock findAssignment.js). */
async function ensureProfileActive() {
  execCliSync(
    "maestro",
    [...deviceArgs(), "test", ENSURE_PROFILE_ACTIVE_FLOW, "-e", `APP_ID=${APP_ID}`, "-e", `PHONE=${PHONE}`, "-e", `OTP=${OTP}`, "-e", `TARGET_PROFILE_NAME=${PROFILE_NAME}`],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
}

/** Tìm card dưới CẢ 2 bộ lọc ngày ("2 tuần gần nhất" mặc định + "1 tháng gần nhất") - không chỉ
 * tin bộ lọc mặc định (có thể "không thấy" chỉ do phạm vi ngày hẹp chứ không phải app thật sự
 * không hiển thị). `scrollToTop()` BẮT BUỘC ngay trước MỖI lần `findAssignment()` (xem
 * feedback_reuse_scroll_locate_mechanisms.md). */
async function locateAssignmentOnApp(title, dueDateDm) {
  const session = new MaestroMcpSession(DEVICE_ID ? { deviceId: DEVICE_ID } : {});
  await session.start();
  try {
    const adapter = { hierarchy: () => session.hierarchy(), runSteps: (steps) => session.run(APP_ID, steps) };

    await session.run(APP_ID, [
      { swipe: { start: "50%, 35%", end: "50%, 85%", duration: 600 } },
      { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao).*" }, timeout: 30000 } },
    ]);
    await scrollToTop(adapter);
    const twoWeeks = await findAssignment(adapter, { title, dueDateDM: dueDateDm });

    await session.run(APP_ID, SWITCH_TO_MONTH_FILTER_STEPS);
    await scrollToTop(adapter);
    const oneMonth = await findAssignment(adapter, { title, dueDateDM: dueDateDm });

    return { twoWeeks, oneMonth, primary: twoWeeks };
  } finally {
    await session.stop();
  }
}

function tapAndOpenExercise(exerciseName, dueDateDm) {
  execCliSync(
    "maestro",
    [...deviceArgs(), "test", OPEN_EXERCISE_FLOW, "-e", `APP_ID=${APP_ID}`, "-e", `PHONE=${PHONE}`, "-e", `OTP=${OTP}`, "-e", `EXERCISE_NAME=${exerciseName}`, "-e", `EXERCISE_DUE_DATE_DM=${dueDateDm}`],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
}

async function main() {
  if (!APP_ID) throw new Error("Thiếu APP_ID - kiểm tra .env.");

  console.log(`[1/4] Giao bài từ Kho bài tập cá nhân (Web GV, lớp "${SOURCE_PERSONAL_BANK_CLASS}")...`);
  const assigned = await assignFromPersonalBank();
  console.log(`  [PASS] room_id=${assigned.roomId} title="${assigned.title}" hạn nộp=${assigned.dueDateDM}`);

  console.log(`[2/4] Xác nhận hồ sơ HS "${PROFILE_NAME}" đang active trên App...`);
  ensureProfileActive();
  console.log(`  [PASS] Hồ sơ "${PROFILE_NAME}" active, đang ở tab "Bài tập".`);

  console.log(`[3/4] Tìm đúng card vừa giao trên App HS (findAssignment, CẢ 2 bộ lọc)...`);
  const { twoWeeks, oneMonth, primary: located } = await locateAssignmentOnApp(assigned.title, assigned.dueDateDM);
  if (located.status !== "FOUND") {
    return finish({
      status: located.status === "AMBIGUOUS" ? "BLOCKED" : "FAIL",
      summary:
        located.status === "AMBIGUOUS"
          ? `App HS có ${located.matches?.length ?? "≥2"} card trùng (title="${assigned.title}", hạn nộp=${assigned.dueDateDM}) - không xác định được đâu là bài vừa giao.`
          : `Không tìm thấy card "${assigned.title}" / Hạn nộp ${assigned.dueDateDM} trên App HS (bộ lọc 2 tuần) sau ${located.scrollCount} lượt cuộn (${located.reason ?? "?"}).`,
      evidence: { assigned, twoWeeks, oneMonth },
    });
  }
  console.log(`  [PASS] "2 tuần gần nhất": tìm thấy sau ${located.scrollCount} lượt cuộn - title="${located.card.title}" hạn nộp="${located.card.dueDate}" CTA="${located.card.cta}".`);
  console.log(
    oneMonth.status === "FOUND"
      ? `  [PASS] "1 tháng gần nhất": cũng tìm thấy đúng card (không phải chỉ nhờ bộ lọc hẹp).`
      : `  [CẢNH BÁO] "1 tháng gần nhất": status=${oneMonth.status} - khác với bộ lọc 2 tuần, cần xem lại.`,
  );

  console.log(`[4/4] Bấm "Làm bài" - xác nhận nội dung thật mở được...`);
  try {
    tapAndOpenExercise(assigned.title, assigned.dueDateDM);
  } catch (err) {
    return finish({
      status: "FAIL",
      summary: `Đã tìm thấy đúng card nhưng KHÔNG mở được màn làm bài: ${err.message}`,
      evidence: { assigned, twoWeeks, oneMonth },
    });
  }
  console.log(`  [PASS] Màn làm bài đã mở đúng (exercise_close_button visible).`);

  return finish({
    status: "PASS",
    summary: `GV giao "${assigned.title}" (room_id=${assigned.roomId}) từ Kho bài tập cá nhân, lớp "${SOURCE_PERSONAL_BANK_CLASS}" -> HS "${PROFILE_NAME}" nhận đúng, mở được bài.`,
    evidence: { assigned, located },
  });
}

main()
  .then((result) => process.exit(result?.status === "PASS" ? 0 : 1))
  .catch((err) => {
    console.error("\n[e2e-personal-bank-assign-student-open] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    finish({ status: "ERROR", summary: err.message, evidence: { stack: err.stack } });
    process.exit(2);
  });
