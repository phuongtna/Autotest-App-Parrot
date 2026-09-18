#!/usr/bin/env node
/**
 * TC033 - RULE MỚI (xác nhận trực tiếp bởi user, 2026-09-18, xem TESTCASES.md cùng thư mục): xóa 1
 * bài trong "Kho bài tập cá nhân" SAU KHI đã giao -> bản ghi "Bài tập đã giao" PHẢI BIẾN MẤT ở CẢ
 * web LẪN app. `delete-source-regression.spec.js` đã xác nhận chiều WEB (Playwright, cả dev lẫn
 * staging). File này xác nhận thêm chiều APP trên STAGING theo yêu cầu trực tiếp của user ("tôi
 * cài app trên staging mà") - GHÉP NỐI từ các khối đã có sẵn
 * ([[feedback_reuse_first_workflow]]), KHÔNG viết lại logic:
 *   - Web GV: `loginTeacherPortal()` + `selectPersonalBankClassStably()` +
 *     `resolveAndSelectUnit()`/`resolveAndSelectLesson()` + `setDueDateViaPopover()` + bắt
 *     `create_room.json` - Y HỆT pattern `delete-source-regression.spec.js` (chọn 1 item CỤ THỂ
 *     bằng Unit/Lesson/tiêu đề, không tick bừa checkbox đầu tiên như TC023, vì cần biết chính xác
 *     item nào để xóa ở bước sau).
 *   - Xóa item nguồn: COPY nguyên logic `page.evaluate()` tìm nút thùng rác (svg.lucide-trash2) +
 *     đối chiếu tiêu đề trong dialog xác nhận từ `delete-source-regression.spec.js` (an toàn bắt
 *     buộc cho 1 hành động không thể hoàn tác, không viết lại khác đi).
 *   - App HS: `findAssignment()` + `scrollToTop()`/`MaestroMcpSession` (`automation/bai_tap/discovery/`)
 *     - Y HỆT cơ chế scroll/tìm bài dùng chung của module "Bài tập" (KHÔNG tự chế lại): `scrollToTop()`
 *     BẮT BUỘC gọi ngay trước MỖI lần `findAssignment()` (xem docblock 2 hàm này) - thiếu bước này
 *     có thể báo NOT_FOUND SAI nếu danh sách đang cuộn dở từ trước (findAssignment chỉ cuộn 1
 *     chiều xuống). Gọi 2 lần (TRƯỚC khi xóa item nguồn, kỳ vọng FOUND; SAU khi xóa, kỳ vọng
 *     NOT_FOUND, poll vài lần vì có thể có độ trễ) - dùng CHUNG 1 `MaestroMcpSession` cho cả 2 lần
 *     gọi (đỡ tốn thời gian khởi động lại session mỗi lần).
 *
 * ENV (BẮT BUỘC, KHÔNG dùng mặc định):
 *   SOURCE_BASE_URL, SOURCE_USERNAME, SOURCE_PASSWORD, SOURCE_PERSONAL_BANK_CLASS (GV)
 *   SOURCE_ITEM_ID_TO_DELETE, SOURCE_ITEM_TITLE, SOURCE_ITEM_UNIT, SOURCE_ITEM_ASSIGN_LESSON,
 *     SOURCE_ITEM_MANAGEMENT_LESSON (item disposable THẬT - xem docblock delete-source-regression.spec.js
 *     để biết ý nghĩa từng biến, GIỐNG HỆT ở đây)
 *   APP_ID (default đọc .env), PHONE/OTP/PROFILE_NAME (HS, BẮT BUỘC)
 *   MAESTRO_DEVICE (optional), ASSIGN_DUE_DATE_DAYS_AHEAD (default 3)
 *
 * *** CẢNH BÁO - PHÁ HUỶ THẬT: xóa vĩnh viễn 1 item trong Kho bài tập cá nhân
 * (SOURCE_ITEM_ID_TO_DELETE), không thể hoàn tác. Luôn xin xác nhận user trước khi chạy. ***
 *
 * CHẠY:
 *   SOURCE_BASE_URL="https://parrotedu-staging.parrotedu.vn" SOURCE_USERNAME="0912312312" \
 *   SOURCE_PASSWORD="123456789" SOURCE_PERSONAL_BANK_CLASS="5D" \
 *   SOURCE_ITEM_ID_TO_DELETE="<uuid>" SOURCE_ITEM_TITLE="<tiêu đề>" \
 *   SOURCE_ITEM_UNIT="UNIT 2: OUTDOOR ACTIVITY" SOURCE_ITEM_ASSIGN_LESSON="Other" \
 *   SOURCE_ITEM_MANAGEMENT_LESSON="PRONUNCIATION" \
 *   PHONE="0915775115" OTP="888888" PROFILE_NAME="Gia Linh" \
 *   node flows/web/giao_bai_tap/kho_bai_tap_ca_nhan/e2e-personal-bank-delete-source-app-check.mjs
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loginTeacherPortal } from "../../../../automation/giao_bai_tap/navigation/teacherPortalSession.js";
import { teacherPortalPageObjects as po } from "../../../../automation/giao_bai_tap/navigation/teacherPortalPageObjects.js";
import { selectPersonalBankClassStably } from "../../../../automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/selectPersonalBankSource.js";
import { resolveAndSelectUnit, resolveAndSelectLesson } from "../../../../automation/giao_bai_tap/navigation/teacherAssignmentDiscovery.js";
import { setDueDateViaPopover } from "../../../../automation/giao_bai_tap/navigation/dueDatePopover.js";
import { execCliSync } from "../../../../automation/src/execCli.js";
import { MaestroMcpSession } from "../../../../automation/bai_tap/discovery/maestroMcpSession.js";
import { findAssignment, scrollToTop } from "../../../../automation/bai_tap/discovery/findAssignment.js";

// TÁI SỬ DỤNG NGUYÊN VĂN bước đổi bộ lọc "1 tháng gần nhất" từ module "Bài tập" - COPY từ
// flows/app/helpers/homework-select-month-filter.yaml + phần mở sheet trong
// flows/app/helpers/open-homework-list-for-locate.yaml (không gọi được `runFlow:` tới file ngoài
// qua MCP "run" - yaml dựng inline không có base path, nên inline lại ĐÚNG step, không đổi logic).
// Dùng để xác nhận card biến mất dưới CẢ 2 bộ lọc (không chỉ "2 tuần gần nhất" mặc định) - theo
// đúng mức độ kỹ lưỡng đã áp dụng ở lần điều tra TC033 gốc trên dev (2026-09-16, xem TESTCASES.md).
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
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "tc033_personal_bank_delete_source_app_check_report.json");

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
const ITEM_ID_TO_DELETE = readRequiredEnv("SOURCE_ITEM_ID_TO_DELETE");
const ITEM_TITLE = readRequiredEnv("SOURCE_ITEM_TITLE");
const ITEM_UNIT = readRequiredEnv("SOURCE_ITEM_UNIT");
const ITEM_ASSIGN_LESSON = readRequiredEnv("SOURCE_ITEM_ASSIGN_LESSON");
const ITEM_MANAGEMENT_LESSON = readRequiredEnv("SOURCE_ITEM_MANAGEMENT_LESSON");
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
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function finish(result) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  console.log(`\n=== KẾT QUẢ: ${result.status} ===`);
  console.log(result.summary);
  console.log(`\nĐã ghi report ra ${OUTPUT_FILE}`);
  return result;
}

/** Web GV - giao ĐÚNG item chỉ định (không tick bừa item đầu tiên, vì cần biết chính xác item nào
 * để xóa ở bước sau) - Y HỆT pattern setup test của delete-source-regression.spec.js. */
async function assignSpecifiedItem() {
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

    await resolveAndSelectUnit(page, ITEM_UNIT);
    await page.waitForTimeout(1500);
    await resolveAndSelectLesson(page, ITEM_ASSIGN_LESSON);

    const titleNode = page.getByText(ITEM_TITLE, { exact: true }).first();
    await titleNode.waitFor({ state: "visible", timeout: 10000 });
    const targetCheckbox = titleNode.locator(
      "xpath=ancestor::*[.//button[@role='checkbox']][1]//button[@role='checkbox']",
    );
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

    return { roomId, title: ITEM_TITLE, dueDateDM: formatDM(day, month) };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

/** Xóa item nguồn ở "Kho đề cá nhân" - COPY nguyên logic đã verify thật ở
 * delete-source-regression.spec.js (climbing DOM tìm nút thùng rác duy nhất + đối chiếu tiêu đề
 * trong dialog xác nhận trước khi bấm xác nhận, an toàn bắt buộc cho hành động không thể hoàn tác). */
async function deleteSourceItem() {
  const { browser, context, page } = await loginTeacherPortal({
    headless: true,
    baseUrl: SOURCE_BASE_URL,
    username: SOURCE_USERNAME,
    password: SOURCE_PASSWORD,
  });
  try {
    const khoiNumber = SOURCE_PERSONAL_BANK_CLASS.match(/^\d+/)?.[0];
    if (!khoiNumber) throw new Error(`Không suy ra được số khối từ tên lớp "${SOURCE_PERSONAL_BANK_CLASS}".`);

    await page.goto(`${SOURCE_BASE_URL}/teacher/quiz`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: `Khối ${khoiNumber}`, exact: true }).click();

    const unitRow = page.getByText(ITEM_UNIT, { exact: true }).first();
    await unitRow.waitFor({ state: "visible", timeout: 10000 });
    await unitRow.click();

    const lessonRow = page.getByText(ITEM_MANAGEMENT_LESSON, { exact: true }).first();
    await lessonRow.waitFor({ state: "visible", timeout: 10000 });
    await lessonRow.click();

    await page.locator('a[href*="/teacher/quiz/"][href*="/edit"]').first().waitFor({ state: "visible", timeout: 10000 });

    const clicked = await page.evaluate((title) => {
      const titleEl = Array.from(document.querySelectorAll("*")).find(
        (el) => el.children.length === 0 && el.textContent.trim().includes(title),
      );
      if (!titleEl) return false;
      let node = titleEl;
      let trashBtn = null;
      for (let i = 0; i < 8 && node; i++) {
        const trashButtons = Array.from(node.querySelectorAll("button")).filter((b) =>
          b.querySelector("svg.lucide-trash2"),
        );
        if (trashButtons.length === 1) {
          trashBtn = trashButtons[0];
          break;
        }
        node = node.parentElement;
      }
      if (!trashBtn) return false;
      trashBtn.click();
      return true;
    }, ITEM_TITLE);
    if (!clicked) throw new Error(`Không click được nút xóa (icon thùng rác) cho item "${ITEM_TITLE}".`);

    const confirmButton = page.getByRole("button", { name: po.deleteConfirmDialog.confirmButton, exact: true });
    await confirmButton.waitFor({ state: "visible", timeout: 10000 });
    const dialogContainer = confirmButton.locator("xpath=ancestor::*[contains(., 'Xóa bài')][1]");
    const dialogText = await dialogContainer.innerText();
    if (!dialogText.includes(ITEM_TITLE)) {
      throw new Error(
        `Dialog xác nhận xóa KHÔNG chứa đúng tiêu đề "${ITEM_TITLE}" - có thể đã bấm nhầm item khác, DỪNG LẠI.`,
      );
    }
    await confirmButton.click();
    await page.getByText("Xóa bài thành công").waitFor({ timeout: 15000 });
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

function ensureProfileActive() {
  execCliSync(
    "maestro",
    [...deviceArgs(), "test", ENSURE_PROFILE_ACTIVE_FLOW, "-e", `APP_ID=${APP_ID}`, "-e", `PHONE=${PHONE}`, "-e", `OTP=${OTP}`, "-e", `TARGET_PROFILE_NAME=${PROFILE_NAME}`],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
}

/** TÁI SỬ DỤNG cơ chế scroll/tìm bài GỐC của module "Bài tập" (KHÔNG tự chế lại) -
 * `scrollToTop()` BẮT BUỘC gọi ngay trước `findAssignment()` (xem docblock 2 hàm này trong
 * findAssignment.js): nếu danh sách đang cuộn dở dang từ trước, findAssignment() CHỈ cuộn 1 chiều
 * (xuống) nên có thể báo NOT_FOUND SAI dù card thật sự đang nằm ở phía TRÊN vị trí xuất phát.
 * `monthFilter: true` đổi sang bộ lọc "1 tháng gần nhất" thay vì chỉ pull-to-refresh ở bộ lọc mặc
 * định "2 tuần gần nhất" - dùng để loại trừ khả năng "không thấy chỉ vì phạm vi ngày hẹp". */
async function refreshAndLocate(session, title, dueDateDm, { monthFilter = false } = {}) {
  const adapter = { hierarchy: () => session.hierarchy(), runSteps: (steps) => session.run(APP_ID, steps) };
  if (monthFilter) {
    await session.run(APP_ID, SWITCH_TO_MONTH_FILTER_STEPS);
  } else {
    await session.run(APP_ID, [
      { swipe: { start: "50%, 35%", end: "50%, 85%", duration: 600 } },
      { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao).*" }, timeout: 30000 } },
    ]);
  }
  const top = await scrollToTop(adapter);
  if (!top.atTop) throw new Error(`Không cuộn được về đầu danh sách "Bài tập": ${top.reason}`);
  return findAssignment(adapter, { title, dueDateDM: dueDateDm });
}

async function main() {
  if (!APP_ID) throw new Error("Thiếu APP_ID - kiểm tra .env.");

  console.log(`[1/6] Giao item chỉ định "${ITEM_TITLE}" từ Kho bài tập cá nhân, lớp "${SOURCE_PERSONAL_BANK_CLASS}"...`);
  const assigned = await assignSpecifiedItem();
  console.log(`  [PASS] room_id=${assigned.roomId} hạn nộp=${assigned.dueDateDM}`);

  console.log(`[2/6] Xác nhận hồ sơ HS "${PROFILE_NAME}" đang active trên App...`);
  ensureProfileActive();
  console.log(`  [PASS] Hồ sơ "${PROFILE_NAME}" active.`);

  const session = new MaestroMcpSession(DEVICE_ID ? { deviceId: DEVICE_ID } : {});
  await session.start();
  try {
    console.log(`[3/6] Xác nhận App HS ĐANG THẤY bài vừa giao (trước khi xóa item nguồn) - CẢ 2 bộ lọc...`);
    const beforeTwoWeeks = await refreshAndLocate(session, assigned.title, assigned.dueDateDM);
    const beforeOneMonth = await refreshAndLocate(session, assigned.title, assigned.dueDateDM, { monthFilter: true });
    if (beforeTwoWeeks.status !== "FOUND") {
      return finish({
        status: "BLOCKED",
        summary: `Không tìm thấy card "${assigned.title}"/Hạn nộp ${assigned.dueDateDM} trên App NGAY SAU KHI giao (bộ lọc 2 tuần, status=${beforeTwoWeeks.status}) - dừng lại trước khi xóa gì, không phải lỗi cần test.`,
        evidence: { assigned, beforeTwoWeeks, beforeOneMonth },
      });
    }
    console.log(`  [PASS] "2 tuần gần nhất": thấy đúng card (title="${beforeTwoWeeks.card.title}", hạn nộp="${beforeTwoWeeks.card.dueDate}").`);
    console.log(
      beforeOneMonth.status === "FOUND"
        ? `  [PASS] "1 tháng gần nhất": cũng thấy đúng card.`
        : `  [CẢNH BÁO] "1 tháng gần nhất": status=${beforeOneMonth.status} - khác với bộ lọc 2 tuần trước khi xóa gì, cần xem lại.`,
    );

    console.log(`[4/6] Xóa item nguồn trong Kho bài tập cá nhân (PHÁ HUỶ THẬT)...`);
    await deleteSourceItem();
    console.log(`  [PASS] Đã xóa "${ITEM_TITLE}" - toast "Xóa bài thành công".`);

    console.log(`[5/6] Poll App HS ("2 tuần gần nhất") - kỳ vọng card BIẾN MẤT theo rule mới (tối đa ~2 phút)...`);
    const deadline = Date.now() + 150_000;
    let after = { status: "FOUND" };
    while (Date.now() < deadline) {
      after = await refreshAndLocate(session, assigned.title, assigned.dueDateDM);
      if (after.status !== "FOUND") break;
      console.log(`  ... vẫn còn thấy, chờ thêm rồi thử lại`);
      await sleep(15_000);
    }

    if (after.status === "FOUND") {
      return finish({
        status: "FAIL",
        summary: `Card "${assigned.title}" VẪN CÒN trên App HS ("2 tuần gần nhất") sau 150s kể từ khi xóa item nguồn - trái với rule MỚI (phải biến mất).`,
        evidence: { assigned, beforeTwoWeeks, beforeOneMonth, after },
      });
    }

    console.log(`[6/6] Xác nhận thêm dưới "1 tháng gần nhất" - loại trừ khả năng "chỉ do phạm vi ngày hẹp"...`);
    const afterOneMonth = await refreshAndLocate(session, assigned.title, assigned.dueDateDM, { monthFilter: true });
    console.log(
      afterOneMonth.status !== "FOUND"
        ? `  [PASS] "1 tháng gần nhất": cũng biến mất (status=${afterOneMonth.status}) - không phải do phạm vi ngày hẹp.`
        : `  [CẢNH BÁO] "1 tháng gần nhất": VẪN THẤY card dù "2 tuần gần nhất" đã báo biến mất - cần xem lại (có thể là bất thường về cache/đồng bộ giữa 2 bộ lọc).`,
    );

    return finish({
      status: afterOneMonth.status === "FOUND" ? "PASS_WITH_WARNING" : "PASS",
      summary:
        afterOneMonth.status === "FOUND"
          ? `Rule mới ĐÚNG ở bộ lọc "2 tuần gần nhất" nhưng card VẪN CÒN ở "1 tháng gần nhất" sau khi xóa item nguồn "${ITEM_TITLE}" (room_id=${assigned.roomId}) - bất thường cần xem lại, không PASS tuyệt đối.`
          : `Đúng rule MỚI Ở CẢ 2 BỘ LỌC: sau khi xóa item nguồn "${ITEM_TITLE}" (room_id=${assigned.roomId}), card biến mất khỏi App HS "${PROFILE_NAME}" (2 tuần: ${after.status}, 1 tháng: ${afterOneMonth.status}).`,
      evidence: { assigned, beforeTwoWeeks, beforeOneMonth, after, afterOneMonth },
    });
  } finally {
    await session.stop();
  }
}

main()
  .then((result) => process.exit(result?.status === "PASS" ? 0 : 1))
  .catch((err) => {
    console.error("\n[e2e-personal-bank-delete-source-app-check] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    finish({ status: "ERROR", summary: err.message, evidence: { stack: err.stack } });
    process.exit(2);
  });
