#!/usr/bin/env node
import { chromium } from "playwright";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../src/config.js";
import { cmsAdminPageObjects as loginPo } from "../quan_ly_goi_dich_vu/navigation/cmsAdminPageObjects.js";
import {
  gotoScoreTables,
  createScoreTable,
  scoreTableRow,
  openDeleteConfirm,
  confirmDelete,
  deleteScoreTableByName,
  readDialogText,
} from "./navigation/cmsScoreTablePageObjects.js";
import {
  cmsDeThiPageObjects as deThiPo,
  gotoDeThi,
  setupDeThiFixtures,
  teardownDeThiFixtures,
  clickAddNew,
  fillExamName,
  selectExamType,
  fillExamDuration,
  selectGrades,
  selectScoreTable,
  fillSectionDurationInStructure,
  clickAddPracticeButton,
  searchInPracticePopup,
  selectPracticeInPopup,
  clickPracticePopupSave,
  selectTrangThai,
  clickSave,
  clickPublishButton,
  confirmPublish,
  deleteDeThiByName,
  deThiRow,
} from "../ngan_hang_de_thi/navigation/cmsDeThiPageObjects.js";

/**
 * Chạy TRỰC TIẾP (headed + slowMo, KHÔNG qua `npx playwright test`) 3 case bị `test.skip` trong
 * `score-table-delete.spec.js` vì cần màn "Ngân hàng đề thi" để tạo tiền điều kiện (gắn Bảng điểm
 * vào 1 Đề thi):
 *   - DEL-02: Bảng điểm gắn Đề thi CHƯA công khai -> kỳ vọng KHÔNG cho xóa.
 *   - DEL-03: Bảng điểm gắn Đề thi ĐÃ công khai -> kỳ vọng KHÔNG cho xóa.
 *   - DEL-06: Bảng điểm đã từng gắn Đề thi, Đề thi đó sau đó bị xóa hẳn -> kỳ vọng xóa bình thường.
 *
 * Chạy trên "staging" (https://cms-staging.parrotedu.vn) theo yêu cầu - CẢ Cấu hình bảng điểm LẪN
 * Ngân hàng đề thi đều thao tác trên CÙNG 1 base URL này trong 1 phiên trình duyệt duy nhất (khác
 * các file `.spec.js` khác trong repo, nơi Ngân hàng đề thi luôn hard-code "dev" - ở đây đổi hẳn
 * sang "staging" để tiền điều kiện gắn Bảng điểm vào Đề thi và thao tác xóa Bảng điểm nằm chung 1
 * database).
 *
 * 2 PHÁT HIỆN THẬT khi dò trên staging trước khi viết bản chạy chính thức dưới đây (đã xác nhận
 * bằng script chẩn đoán riêng, KHÔNG suy đoán):
 *   1) Chọn "Loại kỳ thi" XÓA TRẮNG field "Tên đề thi" nếu Tên đã điền TRƯỚC - workaround: chọn
 *      Loại kỳ thi TRƯỚC, điền Tên đề thi SAU (ngược thứ tự `createExam()` dùng ở các spec khác).
 *   2) "Đề thi cần có ít nhất 1 section" để Lưu ở Trạng thái Hoàn thành - cấu trúc rỗng (giống
 *      `examTypeEmpty`) KHÔNG đủ để Công khai, bắt buộc phải có Section + Section đó có bài thực
 *      hành. Thư viện bài thực hành trên staging CÓ nội dung thật (không rỗng như tưởng ban đầu)
 *      nhưng KHÁC tên với "AI vocabulary" dùng trên dev.
 *
 * Chạy: cd automation && node cau_hinh_bang_diem/runDel02Del03Del06Live.js
 */

const runId = `AUTO-${Date.now().toString(36)}`;
const SLOWMO_MS = Number(process.env.CMS_ADMIN_SLOWMO) || 250;
const PRACTICE_CANDIDATES = ["AI vocabulary", "Recap", "bài thực hành 1", "Bài thực hành 1"];

function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

/** Tạo 1 Đề thi tối thiểu hợp lệ (Nháp) - thứ tự field tuân theo workaround (1) ở comment đầu file.
 * Xác nhận lại bằng cách tìm đúng dòng trong danh sách sau khi Lưu - ném lỗi ngay nếu không thấy
 * thay vì để lan sang bước sau (đã dính đúng lỗi này 1 lần trước khi thêm xác nhận). */
async function createExamSafe(page, baseUrl, { name, examType, duration = 30, grades = ["Lớp 1"], scoreTable } = {}) {
  await clickAddNew(page);
  await selectExamType(page, examType);
  await fillExamName(page, name);
  await fillExamDuration(page, duration);
  await selectGrades(page, grades);
  if (scoreTable !== undefined) await selectScoreTable(page, scoreTable);
  await clickSave(page);

  await gotoDeThi(page, baseUrl);
  await page.waitForTimeout(300);
  const row = deThiRow(page, name);
  if ((await row.count()) === 0) {
    throw new Error(`Tạo Đề thi "${name}" thất bại - sau khi Lưu không thấy dòng này trong danh sách (kiểm tra lại field bị reset/validate lỗi)`);
  }
}

/** Gắn 1 bài thực hành bất kỳ vào Section đang mở trong Cấu trúc đề - thử lần lượt các tên ứng viên
 * (thư viện nội dung khác nhau giữa dev/staging) tới khi tìm được 1 cái tồn tại thật. */
async function addFirstAvailablePractice(page, sectionName) {
  await clickAddPracticeButton(page, sectionName);
  const dialog = page.getByRole("dialog").filter({ hasText: deThiPo.popupAddPracticeTitle });
  for (const candidate of PRACTICE_CANDIDATES) {
    await searchInPracticePopup(page, candidate);
    const option = dialog.getByText(candidate, { exact: false }).first();
    if (await option.count()) {
      await option.click();
      await clickPracticePopupSave(page);
      return candidate;
    }
  }
  throw new Error(`Không tìm được bài thực hành nào cho section "${sectionName}" (đã thử: ${PRACTICE_CANDIDATES.join(", ")})`);
}

async function attemptDeleteScoreTable(page, name) {
  const row = scoreTableRow(page, name);
  const xoaBtn = row.getByRole("button", { name: "Xóa" });
  const disabledBefore = await xoaBtn.isDisabled().catch(() => false);
  if (disabledBefore) {
    return { blocked: true, reason: "Nút Xóa bị disable ngay trên dòng bảng" };
  }

  await openDeleteConfirm(page, name);
  const dialogText = await readDialogText(page).catch(() => "");
  await confirmDelete(page);
  await page.waitForTimeout(500);

  const stillThere = (await row.count()) > 0;
  if (stillThere) {
    return { blocked: true, reason: `Popup xác nhận vẫn mở được (nội dung: "${dialogText.trim()}") nhưng sau khi bấm Xóa, dòng vẫn còn trong bảng` };
  }
  return { blocked: false };
}

async function main() {
  requireCmsAdminConfig();
  const envOverride = "staging";
  const baseUrl = resolveCmsAdminBaseUrl(envOverride);
  const { username, password } = resolveCmsAdminCredentials(envOverride);

  console.log(`=== Xóa Bảng điểm DEL-02/03/06 (live run, env=staging) - runId=${runId} ===`);
  const browser = await chromium.launch({ headless: false, slowMo: SLOWMO_MS });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = {};
  let fixtures;
  const examsCreated = [];
  const scoreTablesCreated = [];

  try {
    log("LOGIN", `Đăng nhập CMS Admin staging: ${baseUrl}`);
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator(loginPo.login.usernameInput).fill(username);
    await page.locator(loginPo.login.passwordInput).fill(password);
    await page.getByRole("button", { name: loginPo.login.submitButton }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    log("SETUP", "Dựng fixture dùng chung: 2 Section + 2 Loại kỳ thi (1 trống, 1 đã gắn sẵn section)");
    fixtures = await setupDeThiFixtures(page, baseUrl, runId);

    // -----------------------------------------------------------------------------------------
    // DEL-02: gắn Bảng điểm vào 1 Đề thi CHƯA công khai (Nháp), rồi thử xóa Bảng điểm đó
    // -----------------------------------------------------------------------------------------
    const scoreTableDel02 = `${runId}-del02`;
    const examDel02 = `${runId}-exam-del02`;
    log("DEL-02", `Tạo Bảng điểm "${scoreTableDel02}"`);
    await gotoScoreTables(page, baseUrl);
    await createScoreTable(page, { name: scoreTableDel02 });
    scoreTablesCreated.push(scoreTableDel02);

    log("DEL-02", `Tạo Đề thi "${examDel02}" (Nháp, chưa công khai) gắn Bảng điểm vừa tạo - màn Ngân hàng đề thi`);
    await gotoDeThi(page, baseUrl);
    await createExamSafe(page, baseUrl, {
      name: examDel02,
      examType: fixtures.examTypeEmpty,
      duration: 20,
      grades: ["Lớp 1"],
      scoreTable: scoreTableDel02,
    });
    examsCreated.push(examDel02);

    log("DEL-02", `Quay lại Cấu hình bảng điểm, thử xóa "${scoreTableDel02}"`);
    await gotoScoreTables(page, baseUrl);
    const resDel02 = await attemptDeleteScoreTable(page, scoreTableDel02);
    results["DEL-02"] = resDel02.blocked
      ? { verdict: "PASS", detail: `Xóa bị chặn đúng như kỳ vọng - ${resDel02.reason}` }
      : { verdict: "FAIL", detail: "Bảng điểm đã gắn Đề thi chưa công khai nhưng vẫn xóa được (SAI kỳ vọng)" };
    log("DEL-02", `=> ${results["DEL-02"].verdict}: ${results["DEL-02"].detail}`);

    // -----------------------------------------------------------------------------------------
    // DEL-03: gắn Bảng điểm vào 1 Đề thi ĐÃ công khai, rồi thử xóa Bảng điểm đó
    // -----------------------------------------------------------------------------------------
    const scoreTableDel03 = `${runId}-del03`;
    const examDel03 = `${runId}-exam-del03`;
    log("DEL-03", `Tạo Bảng điểm "${scoreTableDel03}"`);
    await gotoScoreTables(page, baseUrl);
    await createScoreTable(page, { name: scoreTableDel03 });
    scoreTablesCreated.push(scoreTableDel03);

    log("DEL-03", `Tạo Đề thi "${examDel03}" (đủ Section + Bài thực hành để Công khai được) - màn Ngân hàng đề thi`);
    await gotoDeThi(page, baseUrl);
    await clickAddNew(page);
    await selectExamType(page, fixtures.examTypeWithSections);
    await fillExamName(page, examDel03);
    await fillExamDuration(page, 25);
    await selectGrades(page, ["Lớp 1"]);
    await selectScoreTable(page, scoreTableDel03);
    await fillSectionDurationInStructure(page, fixtures.sectionA, 10);
    await fillSectionDurationInStructure(page, fixtures.sectionB, 15);
    for (const section of [fixtures.sectionA, fixtures.sectionB]) {
      const practiceName = await addFirstAvailablePractice(page, section);
      log("DEL-03", `Gắn bài thực hành "${practiceName}" vào section "${section}"`);
    }
    await selectTrangThai(page, deThiPo.completedRadioLabel);
    await clickSave(page);

    log("DEL-03", `Bấm Công khai cho "${examDel03}"`);
    await clickPublishButton(page);
    await confirmPublish(page);
    await gotoDeThi(page, baseUrl);
    await page.waitForTimeout(300);
    if ((await deThiRow(page, examDel03).count()) === 0) {
      throw new Error(`Tạo + Công khai Đề thi "${examDel03}" thất bại - không thấy dòng này trong danh sách sau khi Lưu/Công khai`);
    }
    examsCreated.push(examDel03);

    log("DEL-03", `Quay lại Cấu hình bảng điểm, thử xóa "${scoreTableDel03}"`);
    await gotoScoreTables(page, baseUrl);
    const resDel03 = await attemptDeleteScoreTable(page, scoreTableDel03);
    results["DEL-03"] = resDel03.blocked
      ? { verdict: "PASS", detail: `Xóa bị chặn đúng như kỳ vọng - ${resDel03.reason}` }
      : { verdict: "FAIL", detail: "Bảng điểm đã gắn Đề thi đã công khai nhưng vẫn xóa được (SAI kỳ vọng)" };
    log("DEL-03", `=> ${results["DEL-03"].verdict}: ${results["DEL-03"].detail}`);

    // -----------------------------------------------------------------------------------------
    // DEL-06: gắn Bảng điểm vào 1 Đề thi, sau đó xóa HẲN Đề thi đó, rồi thử xóa lại Bảng điểm
    // -----------------------------------------------------------------------------------------
    const scoreTableDel06 = `${runId}-del06`;
    const examDel06 = `${runId}-exam-del06`;
    log("DEL-06", `Tạo Bảng điểm "${scoreTableDel06}"`);
    await gotoScoreTables(page, baseUrl);
    await createScoreTable(page, { name: scoreTableDel06 });
    scoreTablesCreated.push(scoreTableDel06);

    log("DEL-06", `Tạo Đề thi "${examDel06}" gắn Bảng điểm vừa tạo - màn Ngân hàng đề thi`);
    await gotoDeThi(page, baseUrl);
    await createExamSafe(page, baseUrl, {
      name: examDel06,
      examType: fixtures.examTypeEmpty,
      duration: 20,
      grades: ["Lớp 1"],
      scoreTable: scoreTableDel06,
    });

    log("DEL-06", `Xóa HẲN Đề thi "${examDel06}" (gỡ gắn bằng cách xóa đề)`);
    await gotoDeThi(page, baseUrl);
    await deleteDeThiByName(page, examDel06);

    log("DEL-06", `Quay lại Cấu hình bảng điểm, thử xóa "${scoreTableDel06}" (không còn gắn đề thi nào)`);
    await gotoScoreTables(page, baseUrl);
    const resDel06 = await attemptDeleteScoreTable(page, scoreTableDel06);
    results["DEL-06"] = !resDel06.blocked
      ? { verdict: "PASS", detail: "Không còn gắn Đề thi nào nên xóa thành công đúng như kỳ vọng" }
      : { verdict: "FAIL", detail: `Đề thi tham chiếu đã bị xóa nhưng vẫn KHÔNG xóa được Bảng điểm (SAI kỳ vọng) - ${resDel06.reason}` };
    log("DEL-06", `=> ${results["DEL-06"].verdict}: ${results["DEL-06"].detail}`);
  } finally {
    // ---------------------------------------------------------------------------------------
    // Dọn dẹp: phải xóa Đề thi (tham chiếu) trước mới xóa được Bảng điểm/Kỳ thi/Section
    // ---------------------------------------------------------------------------------------
    log("CLEANUP", "Dọn dẹp dữ liệu AUTO- vừa tạo (xóa Đề thi còn lại trước, rồi Bảng điểm/Kỳ thi/Section)");
    try {
      if (fixtures) {
        await teardownDeThiFixtures(page, baseUrl, fixtures, examsCreated);
      } else {
        for (const name of examsCreated) {
          await gotoDeThi(page, baseUrl);
          await deleteDeThiByName(page, name).catch(() => {});
        }
      }
      await gotoScoreTables(page, baseUrl);
      for (const name of scoreTablesCreated) {
        await deleteScoreTableByName(page, name).catch(() => {});
      }
    } catch (err) {
      console.error("Lỗi khi dọn dẹp (không chặn kết quả test ở trên):", err.message);
    }

    await browser.close();
  }

  console.log("\n=== KẾT QUẢ ===");
  for (const id of ["DEL-02", "DEL-03", "DEL-06"]) {
    const r = results[id] || { verdict: "SKIP", detail: "Không chạy tới (lỗi ở bước trước)" };
    console.log(`${id}: ${r.verdict} - ${r.detail}`);
  }
  const anyFail = Object.values(results).some((r) => r.verdict !== "PASS");
  process.exitCode = anyFail ? 1 : 0;
}

main().catch((err) => {
  console.error("LỖI:", err);
  process.exitCode = 1;
});
