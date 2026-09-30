#!/usr/bin/env node
/**
 * Giao bài "AUTO_QA_ALL_TYPES_..." (bài thực hành gộp đủ 10 dạng câu hỏi, tạo trong Kho bài tập cá
 * nhân, Khối 5 > UNIT 1: LEISURE TIME > READING) từ Web GV cho HS "Loan" (Lớp 5C) -> xác nhận App
 * HS nhận đúng bài -> mở được bài.
 *
 * TÁI SỬ DỤNG (KHÔNG viết lại logic đã có, chỉ ghép nối - [[feedback_reuse_first_workflow]]): CÙNG
 * cấu trúc với `e2e-personal-bank-assign-student-open.mjs` (TC023) trong cùng thư mục - tái dùng
 * NGUYÊN VĂN toàn bộ helper (`loginTeacherPortal`, `selectPersonalBankClassStably`,
 * `setDueDateViaPopover`, `ensure-profile-active.yaml`, `findAssignment`/`scrollToTop`,
 * `open-exercise.yaml`). CHỈ khác đúng 1 chỗ: TC023 tick checkbox ĐẦU TIÊN hiển thị (bất kỳ item
 * nào cũng hợp lệ cho case gốc); ở đây cần tick ĐÚNG 1 item theo TIÊU ĐỀ cụ thể (đã xác nhận thật
 * qua debug live: sau khi chọn lớp "5C", Unit "UNIT 1: LEISURE TIME" tự chọn sẵn và "Danh sách bài
 * tập" hiện phẳng TẤT CẢ item của mọi Lesson trong Unit đó - không cần điều hướng Lesson riêng).
 *
 * ENV: SOURCE_BASE_URL, SOURCE_USERNAME, SOURCE_PASSWORD, SOURCE_PERSONAL_BANK_CLASS,
 *   BANK_ITEM_TITLE, APP_ID, PHONE, OTP, PROFILE_NAME, MAESTRO_DEVICE (tuỳ chọn),
 *   ASSIGN_DUE_DATE_DAYS_AHEAD (mặc định 3).
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
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "assign_all_types_to_loan_report.json");

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
const BANK_ITEM_TITLE = readRequiredEnv("BANK_ITEM_TITLE");
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

/** Giống `assignFromPersonalBank()` của TC023 nhưng tick ĐÚNG item theo `BANK_ITEM_TITLE` (khớp
 * CHÍNH XÁC, không phải "checkbox đầu tiên"). */
async function assignSpecificItemFromPersonalBank() {
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

    // Đánh dấu ĐÚNG hàng chứa tiêu đề khớp chính xác bằng data-attribute tạm (kỹ thuật giống
    // `locatePracticeRow` trong themBaiThucHanhPageObjects.js) - tránh đoán mò index/nth().
    const markerId = `auto-qa-assign-row-${Date.now()}`;
    const tagged = await page.evaluate(
      ({ titleText, markerId }) => {
        const main = document.querySelector("main");
        const node = [...main.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim() === titleText);
        if (!node) return false;
        let row = node.parentElement;
        for (let i = 0; i < 6 && row; i++) {
          const checkbox = row.querySelector('button[role="checkbox"][id^="lesson-item-"]');
          if (checkbox) {
            checkbox.setAttribute("data-marker", markerId);
            return true;
          }
          row = row.parentElement;
        }
        return false;
      },
      { titleText: BANK_ITEM_TITLE, markerId },
    );
    if (!tagged) throw new Error(`Không tìm thấy checkbox cho item "${BANK_ITEM_TITLE}" trong Danh sách bài tập.`);

    const targetCheckbox = page.locator(`[data-marker="${markerId}"]`).first();
    await targetCheckbox.waitFor({ state: "visible", timeout: 10000 });
    await targetCheckbox.click();
    const checked = await targetCheckbox.getAttribute("aria-checked");
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

    return { roomId, title: BANK_ITEM_TITLE, dueDateDM: formatDM(day, month) };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function ensureProfileActive() {
  execCliSync(
    "maestro",
    [...deviceArgs(), "test", ENSURE_PROFILE_ACTIVE_FLOW, "-e", `APP_ID=${APP_ID}`, "-e", `PHONE=${PHONE}`, "-e", `OTP=${OTP}`, "-e", `TARGET_PROFILE_NAME=${PROFILE_NAME}`],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
}

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

  console.log(`[1/4] Giao "${BANK_ITEM_TITLE}" từ Kho bài tập cá nhân (Web GV, lớp "${SOURCE_PERSONAL_BANK_CLASS}")...`);
  const assigned = await assignSpecificItemFromPersonalBank();
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
      ? `  [PASS] "1 tháng gần nhất": cũng tìm thấy đúng card.`
      : `  [CẢNH BÁO] "1 tháng gần nhất": status=${oneMonth.status}.`,
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
    console.error("\n[e2e-assign-all-types-to-loan] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    finish({ status: "ERROR", summary: err.message, evidence: { stack: err.stack } });
    process.exit(2);
  });
