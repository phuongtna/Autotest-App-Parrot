#!/usr/bin/env node
/**
 * CASE MỚI (bổ sung 2026-09-18, KHÔNG có trong xlsx gốc, theo phát hiện trực tiếp của user qua
 * ảnh chụp thật trên app - profile "Long"/11A2): TC033 (rule mới) xác nhận xóa item nguồn sau khi
 * đã giao làm bản ghi "Bài tập đã giao" BIẾN MẤT - nhưng CHỈ xác nhận với học sinh ĐÃ Ở TRONG lớp
 * từ trước. Case này kiểm tra 1 tình huống KHÁC: nếu 1 học sinh MỚI được duyệt vào lớp SAU KHI
 * item nguồn đã bị xóa, học sinh đó có nhìn thấy "bản ghi ma" (bài đã bị xóa nguồn) hay không -
 * nghi vấn thật của user: có, vẫn thấy (dạng bản ghi rỗng, "0/0") - đây là rò rỉ dữ liệu đáng lẽ
 * phải bị chặn giống hệt học sinh cũ.
 *
 * TÁI SỬ DỤNG HOÀN TOÀN 3 khối đã có sẵn, không viết logic mới ([[feedback_reuse_first_workflow]]):
 *   1. Giao bài + xóa item nguồn: Y HỆT `delete-source-regression.spec.js` (TC033) - tick 1 item
 *      Kho bài tập cá nhân cụ thể, Hạn nộp XA trong tương lai (để chắc chắn còn hạn khi học sinh
 *      mới vào xem), sau đó xóa item nguồn ở "Kho đề cá nhân".
 *   2. Tạo + duyệt học sinh mới vào lớp: `flows/app/roi_khoi_lop/RKL-12_19-step1-request-join-known-class.yaml`
 *      (tạo profile con dùng-1-lần, gửi yêu cầu vào lớp "5X-RKLRejoin2") +
 *      `automation/quan_ly_lop_hoc/runtime/approveStudentRequestFlow.js` (GV duyệt) - ĐÚNG cơ chế
 *      3 bước đã xác nhận PASS trong RKL-12_19-rejoin-after-teacher-approval.md, KHÔNG viết lại.
 *   3. Kiểm tra app: `ensure-profile-active.yaml` + `findAssignment()`/`scrollToTop()`
 *      (`automation/bai_tap/discovery/`) - tìm theo TIÊU ĐỀ (không cần Hạn nộp, vì mục tiêu là
 *      biết bản ghi CÓ xuất hiện hay không, bất kể Hạn nộp hiển thị ra sao).
 *
 * LỚP DÙNG (cập nhật 2026-09-18, re-run xác nhận fix): "5X-GhostRetest-20260918" (staging, id
 * `8a28a60b-4517-4695-ad99-1d6bed141aa0`, tài khoản GV `0912312312`) - lớp MỚI TẠO riêng cho lượt
 * re-run này (`npm run add-class`, tái sử dụng `automation/quan_ly_lop_hoc/runtime/addClassFlow.js`
 * có sẵn), thay cho "5X-RKLRejoin2" cũ (lớp gốc của module `roi_khoi_lop`, đã có sẵn ≥2 ghost card
 * tồn đọng từ lượt phát hiện bug đầu tiên - dùng lớp mới hoàn toàn sạch để kết quả re-run này phản
 * ánh đúng bản fix, không lẫn dữ liệu cũ). Yaml join-class dùng bản COPY riêng
 * `_rkl-step1-request-join-ghost-retest-class.yaml` (KHÔNG sửa file gốc dùng chung của
 * roi_khoi_lop) với tên lớp đã thay sẵn. Profile con luôn được tạo MỚI mỗi lần chạy (theo đúng
 * thiết kế gốc của `RKL-12_19-step1-request-join-known-class.yaml`), không cần đổi gì thêm cho yêu
 * cầu "profile mới".
 *
 * *** CẢNH BÁO - PHÁ HUỶ THẬT: xóa vĩnh viễn 1 item trong Kho bài tập cá nhân
 * (SOURCE_ITEM_ID_TO_DELETE) + tạo 1 profile con thật dưới tài khoản phụ huynh PHONE (throwaway,
 * an toàn theo đúng pattern RKL đã dùng nhiều lần) + gửi 1 yêu cầu vào lớp thật (được duyệt luôn
 * trong chính script này, không để lại request "chờ duyệt" treo). ***
 *
 * ENV (BẮT BUỘC):
 *   SOURCE_ITEM_ID_TO_DELETE, SOURCE_ITEM_TITLE, SOURCE_ITEM_UNIT, SOURCE_ITEM_ASSIGN_LESSON,
 *     SOURCE_ITEM_MANAGEMENT_LESSON (item disposable THẬT trong Khối 5 - xem docblock
 *     delete-source-regression.spec.js để biết ý nghĩa từng biến, GIỐNG HỆT ở đây)
 *   PHONE, OTP (tài khoản phụ huynh dùng tạo profile con mới - mặc định module roi_khoi_lop dùng
 *     0915775115/888888, TRUYỀN RÕ, không có mặc định để tránh nhầm tài khoản thật)
 *
 * CHẠY (từ thư mục gốc repo, KHÔNG phải automation/ - vì cần gọi cả maestro yaml lẫn npm script
 * của automation/):
 *   SOURCE_ITEM_ID_TO_DELETE="<uuid>" SOURCE_ITEM_TITLE="<tiêu đề>" \
 *   SOURCE_ITEM_UNIT="UNIT 3: FREE TIME" SOURCE_ITEM_ASSIGN_LESSON="Reading" \
 *   SOURCE_ITEM_MANAGEMENT_LESSON="VOCABULARY AND GRAMMAR" \
 *   PHONE="0915775115" OTP="888888" \
 *   node flows/web/giao_bai_tap/kho_bai_tap_ca_nhan/e2e-new-joiner-sees-deleted-source-assignment.mjs
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

import { loginTeacherPortal } from "../../../../automation/giao_bai_tap/navigation/teacherPortalSession.js";
import { teacherPortalPageObjects as po } from "../../../../automation/giao_bai_tap/navigation/teacherPortalPageObjects.js";
import { selectPersonalBankClassStably } from "../../../../automation/giao_bai_tap/kho_bai_tap_ca_nhan/navigation/selectPersonalBankSource.js";
import { resolveAndSelectUnit, resolveAndSelectLesson } from "../../../../automation/giao_bai_tap/navigation/teacherAssignmentDiscovery.js";
import { setDueDateViaPopover } from "../../../../automation/giao_bai_tap/navigation/dueDatePopover.js";
import { execCliSync } from "../../../../automation/src/execCli.js";
import { MaestroMcpSession } from "../../../../automation/bai_tap/discovery/maestroMcpSession.js";
import { findAssignment, scrollToTop } from "../../../../automation/bai_tap/discovery/findAssignment.js";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SELF_DIR, "..", "..", "..", "..");
const HELPERS_DIR = join(PROJECT_ROOT, "flows", "app", "helpers");
const ROI_KHOI_LOP_DIR = join(PROJECT_ROOT, "flows", "app", "roi_khoi_lop");
const ENSURE_PROFILE_ACTIVE_FLOW = join(HELPERS_DIR, "ensure-profile-active.yaml");
// RE-RUN 2026-09-18 (dev đã báo fix bug này, theo yêu cầu trực tiếp user "sửa dụng lớp mới và
// profile mới để giao" - tránh tái sử dụng lớp "5X-RKLRejoin2" cũ đã có sẵn 2 ghost card tồn đọng
// từ lượt phát hiện bug trước, dễ gây nhiễu kết quả xác nhận fix): dùng bản COPY riêng của module
// này (không sửa file gốc dùng chung của roi_khoi_lop) với tên lớp mới đã thay thế sẵn.
const JOIN_KNOWN_CLASS_FLOW = join(SELF_DIR, "_rkl-step1-request-join-ghost-retest-class.yaml");
const OUTPUT_FILE = join(PROJECT_ROOT, "automation", "output", "new_joiner_sees_deleted_source_report.json");
const MAESTRO_TESTS_DIR = join(homedir(), ".maestro", "tests");

const SOURCE_BASE_URL = "https://parrotedu-staging.parrotedu.vn";
const SOURCE_USERNAME = "0912312312";
const SOURCE_PASSWORD = "123456789";
// RE-RUN 2026-09-18: đổi sang lớp MỚI TẠO ("5X-GhostRetest-20260918", npm run add-class) thay vì
// tái sử dụng "5X-RKLRejoin2" cũ - lớp mới hoàn toàn sạch, không có ghost card tồn đọng từ lượt
// phát hiện bug trước, đảm bảo kết quả PASS/FAIL lần này phản ánh đúng bản fix mới, không lẫn dữ
// liệu cũ.
const CLASS_NAME = "5X-GhostRetest-20260918";
const CLASS_ID = "8a28a60b-4517-4695-ad99-1d6bed141aa0";
const SCHOOL_SEARCH_TEXT = "QA";
const SCHOOL_RADIO_POINT = "84,978";
const APP_ID = "com.inet.parrotedu";

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
loadEnvFile(join(PROJECT_ROOT, ".env"));

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Thiếu biến môi trường ${name} (xem docblock đầu file).`);
  return value;
}

const ITEM_ID_TO_DELETE = readRequiredEnv("SOURCE_ITEM_ID_TO_DELETE");
const ITEM_TITLE = readRequiredEnv("SOURCE_ITEM_TITLE");
const ITEM_UNIT = readRequiredEnv("SOURCE_ITEM_UNIT");
const ITEM_ASSIGN_LESSON = readRequiredEnv("SOURCE_ITEM_ASSIGN_LESSON");
const ITEM_MANAGEMENT_LESSON = readRequiredEnv("SOURCE_ITEM_MANAGEMENT_LESSON");
const PHONE = readRequiredEnv("PHONE");
const OTP = readRequiredEnv("OTP");
const DEVICE_ID = process.env.MAESTRO_DEVICE || "";

function deviceArgs() {
  return DEVICE_ID ? ["--device", DEVICE_ID] : [];
}
function finish(result) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  console.log(`\n=== KẾT QUẢ: ${result.status} ===`);
  console.log(result.summary);
  console.log(`\nĐã ghi report ra ${OUTPUT_FILE}`);
  return result;
}

/** Bước 1: giao ĐÚNG item chỉ định tới lớp "5X-RKLRejoin2", Hạn nộp XA trong tương lai (đảm bảo
 * còn hạn khi học sinh mới vào xem sau) - Y HỆT pattern setup test của
 * delete-source-regression.spec.js, chỉ đổi lớp + hạn nộp cố định xa hơn. */
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
    await selectPersonalBankClassStably(page, CLASS_NAME);

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

    const d = new Date();
    d.setDate(d.getDate() + 30); // Xa trong tương lai - chắc chắn còn hạn khi HS mới vào xem.
    const { day, month } = { day: d.getDate(), month: d.getMonth() + 1 };
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

    return { roomId, title: ITEM_TITLE };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

/** Bước 2: xóa item nguồn - COPY nguyên logic đã verify thật ở delete-source-regression.spec.js. */
async function deleteSourceItem() {
  const { browser, context, page } = await loginTeacherPortal({
    headless: true,
    baseUrl: SOURCE_BASE_URL,
    username: SOURCE_USERNAME,
    password: SOURCE_PASSWORD,
  });
  try {
    const khoiNumber = CLASS_NAME.match(/^\d+/)?.[0];
    if (!khoiNumber) throw new Error(`Không suy ra được số khối từ tên lớp "${CLASS_NAME}".`);

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

/** Bước 3: tạo profile con mới + gửi yêu cầu vào lớp - GỌI ĐÚNG file yaml gốc của module
 * roi_khoi_lop qua `maestro test`, không viết lại logic. Trả về CHILD_NAME đọc từ tên file
 * screenshot (Maestro không có cơ chế truyền biến sang tiến trình khác). */
function requestJoinClassAndGetChildName() {
  const before = new Set(existsSync(MAESTRO_TESTS_DIR) ? readdirSync(MAESTRO_TESTS_DIR) : []);
  execCliSync(
    "maestro",
    [
      ...deviceArgs(),
      "test",
      JOIN_KNOWN_CLASS_FLOW,
      "-e",
      `APP_ID=${APP_ID}`,
      "-e",
      `PHONE=${PHONE}`,
      "-e",
      `OTP=${OTP}`,
      "-e",
      `SCHOOL_SEARCH_TEXT=${SCHOOL_SEARCH_TEXT}`,
      "-e",
      `SCHOOL_RADIO_POINT=${SCHOOL_RADIO_POINT}`,
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );

  const after = readdirSync(MAESTRO_TESTS_DIR).filter((d) => !before.has(d));
  if (after.length === 0) throw new Error("Không tìm được thư mục artifacts mới của lượt chạy maestro vừa xong.");
  const runDir = join(MAESTRO_TESTS_DIR, after.sort().reverse()[0]);
  const screenshotFile = execFileSync("find", [runDir, "-iname", "rkl12_19_step1_pending__*.png"], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")[0];
  if (!screenshotFile) throw new Error(`Không tìm thấy screenshot "rkl12_19_step1_pending__*.png" trong ${runDir}.`);
  const match = screenshotFile.match(/rkl12_19_step1_pending__(.+)\.png$/);
  if (!match) throw new Error(`Không đọc được CHILD_NAME từ tên file: ${screenshotFile}`);
  return match[1];
}

/** Bước 4: GV duyệt yêu cầu - gọi ĐÚNG hàm JS gốc của module quan_ly_lop_hoc, không viết lại. */
async function approveJoinRequest(childName) {
  process.env.TEACHER_PORTAL_ENV = "staging";
  const mod = await import("../../../../automation/quan_ly_lop_hoc/runtime/approveStudentRequestFlow.js");
  return mod.approveStudentRequestFlow({ classId: CLASS_ID, studentName: childName, headless: true });
}

function ensureProfileActive(profileName) {
  execCliSync(
    "maestro",
    [...deviceArgs(), "test", ENSURE_PROFILE_ACTIVE_FLOW, "-e", `APP_ID=${APP_ID}`, "-e", `PHONE=${PHONE}`, "-e", `OTP=${OTP}`, "-e", `TARGET_PROFILE_NAME=${profileName}`],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
}

async function checkAppSeesDeletedAssignment(title) {
  const session = new MaestroMcpSession(DEVICE_ID ? { deviceId: DEVICE_ID } : {});
  await session.start();
  try {
    const adapter = { hierarchy: () => session.hierarchy(), runSteps: (steps) => session.run(APP_ID, steps) };
    await session.run(APP_ID, [
      { swipe: { start: "50%, 35%", end: "50%, 85%", duration: 600 } },
      { extendedWaitUntil: { visible: { text: ".*(Bài tập về nhà|Bài tập nâng cao|Bạn không có bài tập nào đang chờ).*" }, timeout: 30000 } },
    ]);
    await scrollToTop(adapter);
    // KHÔNG truyền dueDateDM - mục tiêu chỉ là biết bản ghi CÓ xuất hiện dưới TIÊU ĐỀ này hay
    // không (bất kể Hạn nộp hiển thị ra sao), không phải xác định 1 room cụ thể.
    return findAssignment(adapter, { title });
  } finally {
    await session.stop();
  }
}

async function main() {
  console.log(`[1/5] Giao item "${ITEM_TITLE}" tới lớp "${CLASS_NAME}" (Hạn nộp xa, còn hạn)...`);
  const assigned = await assignSpecifiedItem();
  console.log(`  [PASS] room_id=${assigned.roomId}`);

  console.log(`[2/5] Xóa item nguồn trong Kho bài tập cá nhân (PHÁ HUỶ THẬT)...`);
  await deleteSourceItem();
  console.log(`  [PASS] Đã xóa "${ITEM_TITLE}".`);

  console.log(`[3/5] Tạo profile con mới + gửi yêu cầu vào lớp "${CLASS_NAME}" (SAU KHI đã xóa item nguồn)...`);
  const childName = requestJoinClassAndGetChildName();
  console.log(`  [PASS] Profile mới: "${childName}", đang chờ duyệt.`);

  console.log(`[4/5] GV duyệt yêu cầu vào lớp...`);
  const approveResult = await approveJoinRequest(childName);
  if (approveResult.status !== "PASS") {
    return finish({
      status: "BLOCKED",
      summary: `Duyệt yêu cầu vào lớp thất bại (${JSON.stringify(approveResult.steps)}) - không tới được bước kiểm tra chính, không phải kết quả case này.`,
      evidence: { assigned, childName, approveResult },
    });
  }
  console.log(`  [PASS] Đã duyệt "${childName}" vào lớp "${CLASS_NAME}".`);

  console.log(`[5/5] Xác nhận hồ sơ mới active + kiểm tra App có hiện "bản ghi ma" (bài đã xóa nguồn) không...`);
  ensureProfileActive(childName);
  const result = await checkAppSeesDeletedAssignment(ITEM_TITLE);

  if (result.status === "FOUND" || result.status === "AMBIGUOUS") {
    return finish({
      status: "FAIL",
      summary: `BUG XÁC NHẬN: profile MỚI "${childName}" (join SAU KHI item nguồn đã bị xóa) VẪN THẤY bản ghi "${ITEM_TITLE}" trên App - đáng lẽ phải bị chặn giống học sinh cũ (theo rule TC033 đã xác nhận). status=${result.status}${result.card ? `, card=${JSON.stringify(result.card)}` : ""}.`,
      evidence: { assigned, childName, approveResult, result },
    });
  }

  return finish({
    status: "PASS",
    summary: `ĐÚNG kỳ vọng: profile mới "${childName}" (join sau khi item nguồn đã bị xóa) KHÔNG thấy bản ghi "${ITEM_TITLE}" trên App (status=${result.status}) - không có rò rỉ dữ liệu.`,
    evidence: { assigned, childName, approveResult, result },
  });
}

main()
  .then((result) => process.exit(result?.status === "PASS" ? 0 : 1))
  .catch((err) => {
    console.error("\n[e2e-new-joiner-sees-deleted-source-assignment] Dừng lại vì lỗi ngoài dự kiến:\n", err);
    finish({ status: "ERROR", summary: err.message, evidence: { stack: err.stack } });
    process.exit(2);
  });
