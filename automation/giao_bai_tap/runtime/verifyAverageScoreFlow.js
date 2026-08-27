import { loginTeacherPortal } from "../navigation/teacherPortalSession.js";
import { findRetakeAverageScoreCandidate } from "../navigation/teacherAssignmentApiDiscovery.js";
import { gotoAssignedList, locateAssignedRowAcrossPages } from "../navigation/teacherAssignedListPageObjects.js";

export class NoRetakeCandidateError extends Error {}
export class AverageScoreAssertionError extends Error {}

/**
 * REGRESSION TEST cho bug THẬT đã xác nhận (2026-08-27, đối chiếu 11/11 room retake thật, khớp
 * CHÍNH XÁC): cột "ĐIỂM TB" trên "Danh sách bài tập đã giao" tính SAI khi 1 học sinh làm lại
 * (retake) ≥ 2 lần - công thức thực tế đang dùng là
 *
 *     ĐIỂM TB hiển thị = MAX(điểm các lần làm) / SỐ LẦN làm
 *
 * thay vì đúng theo mô tả acceptance criteria gốc ("Trong TH học sinh làm lại nhiều lần thì sử
 * dụng điểm của lần làm bài có điểm cao nhất" - tức chỉ cần lấy điểm cao nhất, KHÔNG chia thêm cho
 * số lần làm). Hậu quả: HS càng làm lại nhiều lần (kể cả để cải thiện điểm) thì "ĐIỂM TB" hiển
 * thị càng bị kéo THẤP xuống một cách giả tạo - ngược hẳn ý nghĩa khuyến khích làm lại của rule.
 *
 * Ví dụ thật: HS làm 1 bài, các lần được [8, 10, 7] điểm (thang 10) -> điểm đúng phải là 10 (lần
 * cao nhất) nhưng "ĐIỂM TB" trên danh sách hiển thị 3.3 (=10/3).
 *
 * CHỈ ĐỌC - không tạo/sửa/xóa dữ liệu nào. Test tự tìm 1 assignment CÓ SẴN thật có đúng 1 HS hoàn
 * thành với ≥2 lần làm (không tự tạo được - retake phải làm qua app HS, ngoài phạm vi Playwright
 * Web GV) - an toàn vì hoàn toàn CHỈ ĐỌC.
 *
 * KỲ VỌNG: test này SẼ FAIL cho tới khi bug được sửa (assert đúng theo spec, không tự hạ chuẩn để
 * PASS theo hành vi sai hiện tại) - giữ lại làm regression test, tự chuyển PASS khi backend sửa.
 *
 * @param {{ headless?: boolean }} [params]
 * @returns {Promise<{status:"PASS"|"FAIL", steps, error?, candidate?, actualListValue?}>}
 */
export async function verifyAverageScoreFlow({ headless = true } = {}) {
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

  let candidate = null;
  let actualListValue = null;

  const { browser, page } = await loginTeacherPortal({ headless });
  try {
    await step("findRetakeCandidateViaApi", async () => {
      candidate = await findRetakeAverageScoreCandidate({});
      if (!candidate) {
        throw new NoRetakeCandidateError(
          "Không tìm thấy assignment thật nào có đúng 1 HS hoàn thành với ≥2 lần làm (retake) - cần dữ liệu này để test cột ĐIỂM TB.",
        );
      }
      if (!candidate.className) {
        throw new NoRetakeCandidateError(`Không resolve được tên lớp cho room "${candidate.roomId}" (class_ids không khớp class_names).`);
      }
    })();

    await step("gotoAssignedList", async () => {
      await gotoAssignedList(page);
    })();

    let row = null;
    await step("locateRowOnList", async () => {
      row = await locateAssignedRowAcrossPages(page, {
        className: candidate.className,
        itemName: candidate.itemName,
        dueDateLine: candidate.dueDateLine,
      });
    })();

    await step("readActualListValue", async () => {
      const cells = await row.evaluate((r) => Array.from(r.querySelectorAll("td")).map((c) => c.innerText.trim()));
      actualListValue = Number(cells[4]);
    })();

    await step("assertAverageMatchesBestAttempt", async () => {
      if (actualListValue !== candidate.expectedCorrectAverage) {
        throw new AverageScoreAssertionError(
          `BUG XÁC NHẬN: "ĐIỂM TB" trên danh sách hiển thị ${actualListValue}, nhưng đúng ra phải là ` +
            `${candidate.expectedCorrectAverage} (điểm lần làm CAO NHẤT trong ${JSON.stringify(candidate.attemptScores)}, ` +
            `theo đúng rule "dùng điểm lần làm cao nhất khi retake"). Công thức đang dùng có vẻ là ` +
            `MAX/SỐ_LẦN_LÀM = ${candidate.expectedCorrectAverage}/${candidate.attemptsCount} = ` +
            `${Math.round((candidate.expectedCorrectAverage / candidate.attemptsCount) * 10) / 10} - khớp giá trị đang hiển thị.`,
        );
      }
    })();

    return { status: "PASS", steps, candidate, actualListValue };
  } catch (err) {
    return { status: "FAIL", steps, error: err.message, candidate, actualListValue };
  } finally {
    await browser.close();
  }
}
