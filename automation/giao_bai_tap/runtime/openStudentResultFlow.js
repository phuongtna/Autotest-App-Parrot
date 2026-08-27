import { loginTeacherPortal } from "../navigation/teacherPortalSession.js";
import { gotoAssignedList, locateAssignedRowAcrossPages } from "../navigation/teacherAssignedListPageObjects.js";
import {
  findRowWithCompletion,
  listCompletedStudents,
  readStudentResultSummary,
  readSubmitHistory,
  NoCompletedStudentError,
} from "../navigation/teacherReportPageObjects.js";

export { NoCompletedStudentError };
export class OpenStudentResultAssertionError extends Error {}
export class TargetStudentNotFoundError extends Error {}

/**
 * Test CHỈ ĐỌC (không tạo/sửa/xóa dữ liệu nào) cho flow user mô tả: ở màn "Báo cáo lớp", cột
 * "Đã hoàn thành" -> bấm chọn tên học sinh -> điều hướng sang màn "Chi tiết bài làm học sinh".
 *
 * MẶC ĐỊNH (không truyền target*): CHỦ ĐỘNG dùng 1 assignment CÓ SẴN thật (không tự tạo như
 * TC2/assignedListLifecycleFlow.js) - vì cần có ít nhất 1 HS đã nộp bài THẬT để "Đã hoàn thành" có
 * dữ liệu; assignment tự tạo mới luôn có 0 HS làm bài. Test tự tìm 1 dòng bất kỳ có HS đã làm
 * (không hardcode/không đoán assignment cụ thể) - an toàn vì hoàn toàn CHỈ ĐỌC. Hành vi này GIỮ
 * NGUYÊN (TC5, npm run open-student-result) khi params target* để trống.
 *
 * MỞ RỘNG (2026-08-27, cho cross-check App HS <-> Web GV - xem
 * verifyAssignedHomeworkScoredCrossCheck.mjs): khi caller ĐÃ biết trước đúng 1 assignment (từ
 * App HS, đã resolve unique room qua API) + tên học sinh test, truyền targetClassName+
 * targetItemName+targetDueDateLine (dùng locateAssignedRow - throw AssignedRowNotFoundError nếu
 * không khớp đúng 1 dòng, không đoán) và targetStudentName (throw TargetStudentNotFoundError nếu
 * "Đã hoàn thành" không có đúng tên đó, KHÔNG fallback về students[0]) thay vì tự chọn đại.
 *
 * @param {{ headless?: boolean, targetClassName?: string, targetItemName?: string,
 *   targetDueDateLine?: string, targetStudentName?: string }} [params]
 * @returns {Promise<{status:"PASS"|"FAIL", steps, error?, studentName?, resultUrl?, summary?, submitHistory?}>}
 */
export async function openStudentResultFlow({
  headless = true,
  targetClassName = null,
  targetItemName = null,
  targetDueDateLine = null,
  targetStudentName = null,
} = {}) {
  const steps = [];
  function step(name, fn) {
    return async () => {
      try {
        await fn();
        steps.push({ name, status: "PASS" });
      } catch (err) {
        steps.push({ name, status: "FAIL", error: err.message });
        throw err;
      }
    };
  }

  let studentName = null;
  let resultUrl = null;
  const useTarget = Boolean(targetClassName && targetItemName && targetDueDateLine);

  const { browser, page } = await loginTeacherPortal({ headless });
  try {
    await step("gotoAssignedList", async () => {
      await gotoAssignedList(page);
    })();

    let candidate = null;
    await step(useTarget ? "useTargetCandidate" : "findRowWithCompletion", async () => {
      if (useTarget) {
        candidate = { className: targetClassName, itemName: targetItemName, dueDateLine: targetDueDateLine };
        return;
      }
      candidate = await findRowWithCompletion(page);
      if (!candidate) {
        throw new NoCompletedStudentError(
          "Không tìm thấy dòng nào trên trang 1 có HS đã làm (HS ĐÃ LÀM > 0) - cần dữ liệu thật để test drill-down này.",
        );
      }
    })();

    let row = null;
    await step("locateRow", async () => {
      row = await locateAssignedRowAcrossPages(page, candidate);
    })();

    await step("openReport", async () => {
      await row.getByText("Xem báo cáo", { exact: true }).click();
      await page.waitForURL(/\/teacher\/exercise\/.+\/report/, { timeout: 15000 });
      await page.getByText("Báo cáo lớp", { exact: true }).first().waitFor({ timeout: 15000 });
      // ĐÃ XÁC NHẬN THẬT: giống "Danh sách bài tập đã giao", heading card "Đã hoàn thành (N)" có
      // thể render TRƯỚC khi danh sách HS bên trong tải xong - chờ chính card này xuất hiện thay
      // vì chỉ chờ heading tổng của trang.
      await page.locator("h3", { hasText: "Đã hoàn thành" }).first().waitFor({ timeout: 15000 });
      await page.waitForLoadState("networkidle").catch(() => {});
    })();

    let students = null;
    await step("listCompletedStudents", async () => {
      students = await listCompletedStudents(page);
      if (students.length === 0) {
        throw new OpenStudentResultAssertionError(
          `Dòng "${candidate.itemName}" báo HS ĐÃ LÀM="${candidate.doneCell}" nhưng card "Đã hoàn thành" không có HS nào - dữ liệu không nhất quán.`,
        );
      }
    })();

    await step(targetStudentName ? "clickTargetStudentName" : "clickStudentName", async () => {
      let target = students[0];
      if (targetStudentName) {
        target = students.find((s) => s.name === targetStudentName);
        if (!target) {
          throw new TargetStudentNotFoundError(
            `Card "Đã hoàn thành" không có HS tên "${targetStudentName}" (chỉ có: ${students.map((s) => `"${s.name}"`).join(", ")}) - không tự chọn HS khác.`,
          );
        }
      }
      studentName = target.name;
      await page.getByRole("link", { name: target.name, exact: true }).first().click();
      await page.waitForURL(/\/teacher\/exercise\/.+\/result\/.+/, { timeout: 15000 });
      resultUrl = page.url();
    })();

    // "Chi tiết bài làm học sinh" - breadcrumb + field chính theo mockup gốc.
    await step("verifyStudentResultPage", async () => {
      await page.getByText("Chi tiết bài làm", { exact: true }).first().waitFor({ timeout: 15000 });
      const bodyText = await page.locator("body").innerText();
      if (!bodyText.includes(studentName)) {
        throw new OpenStudentResultAssertionError(`Trang kết quả không hiển thị đúng tên HS "${studentName}".`);
      }
      for (const label of ["Điểm số", "Thời gian nộp", "Thời gian làm bài", "Lịch sử nộp bài"]) {
        if (!bodyText.includes(label)) {
          throw new OpenStudentResultAssertionError(`Trang "Chi tiết bài làm" thiếu field "${label}" so với mockup.`);
        }
      }
    })();

    let summary = null;
    await step("readStudentResultSummary", async () => {
      summary = await readStudentResultSummary(page);
      if (summary.scoreText == null) {
        throw new OpenStudentResultAssertionError('Không đọc được giá trị "Điểm số" trên trang Chi tiết bài làm.');
      }
    })();

    let submitHistory = null;
    await step("readSubmitHistory", async () => {
      submitHistory = await readSubmitHistory(page);
      if (submitHistory.entries.length === 0) {
        throw new OpenStudentResultAssertionError('Dropdown "Lịch sử nộp bài" mở được nhưng không có entry nào.');
      }
    })();

    return { status: "PASS", steps, studentName, resultUrl, summary, submitHistory };
  } catch (err) {
    return { status: "FAIL", steps, error: err.message, studentName, resultUrl };
  } finally {
    await browser.close();
  }
}
