#!/usr/bin/env node
/**
 * SCRIPT ĐIỀU TRA DỮ LIỆU (KHÔNG PHẢI TESTCASE) - phần "Xem báo cáo" của Giai đoạn 0 Data
 * Discovery. Chỉ ĐỌC (không tạo assignment mới) - bấm "Xem báo cáo" của 1 dòng đã có học sinh
 * làm bài trong bảng "Bài tập đã giao" hiện có, để xem cấu trúc màn "Báo cáo lớp" thật.
 *
 * ENV: ASSIGN_HEADLESS=false để xem browser thật (mặc định true)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loginTeacherPortal } from "./navigation/teacherPortalSession.js";
import { teacherPortalPageObjects as po } from "./navigation/teacherPortalPageObjects.js";

const HEADLESS = process.env.ASSIGN_HEADLESS !== "false";
const OUT_DIR = join(process.cwd(), "output", "data_discovery", "REPORT");
mkdirSync(OUT_DIR, { recursive: true });

const networkLog = [];

function attachNetworkCapture(page) {
  page.on("response", async (resp) => {
    try {
      const url = resp.url();
      if (!url.includes("/api/")) return;
      const req = resp.request();
      const ct = resp.headers()["content-type"] || "";
      let body = null;
      if (ct.includes("application/json")) body = await resp.json().catch(() => null);
      networkLog.push({
        capturedAtISO: new Date().toISOString(),
        method: req.method(),
        url,
        status: resp.status(),
        requestPostData: req.postData(),
        responseBody: body,
      });
    } catch (err) {
      networkLog.push({ capturedAtISO: new Date().toISOString(), captureError: err.message });
    }
  });
}

async function dumpScreen(page, name) {
  const url = page.url();
  let text = "";
  try {
    text = await page.locator("body").innerText();
  } catch (err) {
    text = `<<innerText failed: ${err.message}>>`;
  }
  writeFileSync(join(OUT_DIR, `${name}.url.txt`), url, "utf8");
  writeFileSync(join(OUT_DIR, `${name}.text.txt`), text, "utf8");
  try {
    await page.screenshot({ path: join(OUT_DIR, `${name}.png`), fullPage: true });
  } catch {}
  console.log(`[DUMP] ${name} -> url=${url}`);
}

async function main() {
  const { browser, page } = await loginTeacherPortal({ headless: HEADLESS });
  attachNetworkCapture(page);
  try {
    await page.getByText(po.menu.menuItem, { exact: false }).first().click();
    await page.getByText("Danh sách bài tập đã giao", { exact: false }).waitFor({ timeout: 15000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    await dumpScreen(page, "01_list");

    // Chọn dòng bất kỳ đã có HS làm (HS ĐÃ LÀM >= 1) - dò bằng cách quét text các dòng bảng,
    // KHÔNG hardcode tên bài (đã xác nhận thật qua dump trước: "G3-U18-Lesson 1: Listen and
    // choose" | 1/5 | 2.0 - nhưng có thể đổi theo thời điểm chạy nên dò lại bằng logic thật).
    const candidateRow = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("tr"));
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll("td")).map((c) => c.innerText.trim());
        if (cells.length < 5) continue;
        // Cột "HS ĐÃ LÀM" dạng "x/y" - lấy x, nếu > 0 thì có ít nhất 1 HS đã làm.
        const doneCell = cells.find((c) => /^\d+\/\d+$/.test(c));
        if (doneCell) {
          const [done] = doneCell.split("/").map(Number);
          if (done > 0) {
            return { cells, doneCell };
          }
        }
      }
      return null;
    });
    writeFileSync(
      join(OUT_DIR, "02_candidate_row.json"),
      JSON.stringify(candidateRow, null, 2),
      "utf8",
    );
    console.log("Candidate row:", JSON.stringify(candidateRow));

    if (!candidateRow) {
      writeFileSync(
        join(OUT_DIR, "BLOCKED_no_attempted_row_on_page1.txt"),
        "Không tìm thấy dòng nào có HS ĐÃ LÀM > 0 trên trang 1 - cần lật trang hoặc đổi filter.",
        "utf8",
      );
      return;
    }

    const itemName = candidateRow.cells[1];
    // "tên + HS đã làm" KHÔNG đủ phân biệt (đã xác nhận thật: "G3-U18-Lesson 1: Listen and
    // choose" xuất hiện 2 dòng cùng "1/5" nhưng khác hạn nộp/điểm) - phải thêm cả cột hạn nộp
    // (cells[2], có thể chứa "\n" giữa ngày và "QUÁ HẠN"/"CÒN N NGÀY") vào điều kiện khớp.
    const dueDateLine = candidateRow.cells[2].split("\n")[0];
    let row = page
      .locator("tr", { hasText: itemName })
      .filter({ hasText: candidateRow.doneCell })
      .filter({ hasText: dueDateLine });
    let rowCount = await row.count();
    console.log(
      `Số dòng khớp (tên="${itemName}" + hạn nộp="${dueDateLine}" + doneCell="${candidateRow.doneCell}"): ${rowCount}`,
    );
    if (rowCount !== 1) {
      writeFileSync(
        join(OUT_DIR, "BLOCKED_row_ambiguous.txt"),
        `rowCount=${rowCount} cho tên="${itemName}" + hạn nộp="${dueDateLine}" + doneCell="${candidateRow.doneCell}" - không đủ để bấm an toàn ngay cả khi thêm hạn nộp.`,
        "utf8",
      );
      return;
    }

    await row.getByText("Xem báo cáo", { exact: true }).click();
    await page.waitForTimeout(1500);
    await page.waitForLoadState("networkidle").catch(() => {});
    await dumpScreen(page, "03_after_click_report");

    // Dump toàn bộ <table> trên màn báo cáo (nếu có) ra JSON có cấu trúc, để đọc điểm/tên HS dễ
    // hơn so với chỉ đọc text thô.
    const tables = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("table")).map((t) => {
        const headerCells = Array.from(t.querySelectorAll("thead th, thead td")).map((c) =>
          c.innerText.trim(),
        );
        const rows = Array.from(t.querySelectorAll("tbody tr")).map((r) =>
          Array.from(r.querySelectorAll("td")).map((c) => c.innerText.trim()),
        );
        return { headerCells, rows };
      });
    });
    writeFileSync(join(OUT_DIR, "04_report_tables.json"), JSON.stringify(tables, null, 2), "utf8");
    console.log("Report tables:", JSON.stringify(tables));
  } catch (err) {
    writeFileSync(join(OUT_DIR, "ERROR.txt"), `${err.message}\n${err.stack}`, "utf8");
    console.error("Lỗi:", err.message);
  } finally {
    writeFileSync(join(OUT_DIR, "network_log.json"), JSON.stringify(networkLog, null, 2), "utf8");
    console.log(`\nĐã ghi artifact vào: ${OUT_DIR}`);
    await browser.close();
  }
}

main();
