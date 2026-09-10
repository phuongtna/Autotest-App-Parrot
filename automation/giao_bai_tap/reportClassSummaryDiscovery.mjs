#!/usr/bin/env node
/**
 * SCRIPT ĐIỀU TRA DỮ LIỆU (KHÔNG PHẢI TESTCASE) - khảo sát tab "Tổng kết lớp" của màn "Báo cáo
 * học tập" (Web GV) - CHỈ ĐỌC, không tạo/sửa/xoá gì. Mục tiêu: lấy cấu trúc DOM/API thật để viết
 * TEST-CASES.md đối chiếu (theo docx "Case báo cáo.docx" mục 2.2 "Báo cáo Tổng kết lớp"), tránh
 * suy đoán selector không có thật - cùng tinh thần reportDiscovery.mjs (tab "Bài tập về nhà").
 *
 * ENV: ASSIGN_HEADLESS=false để xem browser thật (mặc định true)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loginTeacherPortal } from "./navigation/teacherPortalSession.js";

const HEADLESS = process.env.ASSIGN_HEADLESS !== "false";
const TARGET_CLASS_TEXT = process.env.TARGET_CLASS_TEXT || null;
const OUT_DIR = join(process.cwd(), "output", "data_discovery", "REPORT_CLASS_SUMMARY");
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

async function dumpTables(page, name) {
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
  writeFileSync(join(OUT_DIR, `${name}.json`), JSON.stringify(tables, null, 2), "utf8");
  return tables;
}

async function main() {
  const { browser, page } = await loginTeacherPortal({ headless: HEADLESS });
  attachNetworkCapture(page);
  try {
    // Sidebar thật (đã xác nhận qua reportDiscovery.mjs trước đó): "Báo cáo học tập" / "Lớp phụ
    // trách" / "Giao bài tập" / "Đăng xuất".
    await page.getByText("Báo cáo học tập", { exact: false }).first().click();
    await page
      .getByText("Hãy chờ trong giây lát", { exact: false })
      .waitFor({ state: "hidden", timeout: 20000 })
      .catch(() => {});
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);
    await dumpScreen(page, "01_report_home");

    if (TARGET_CLASS_TEXT) {
      // Đổi lớp trong droplist "Báo cáo lớp" (góc trên) sang đúng lớp chứa profile đang test -
      // droplist thật là 1 combobox (native <select> hoặc Radix Select tuỳ implement), thử cả 2
      // cách: click mở rồi chọn option theo text, fallback selectOption theo label.
      const classDroplist = page.locator("select").first();
      const isNativeSelect = await classDroplist.count();
      if (isNativeSelect) {
        await classDroplist.selectOption({ label: TARGET_CLASS_TEXT }).catch(() => {});
      } else {
        await page.getByText("3B", { exact: true }).first().click().catch(() => {});
        await page.getByText(TARGET_CLASS_TEXT, { exact: false }).first().click().catch(() => {});
      }
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1000);
      await dumpScreen(page, "00_after_class_switch");
    }

    // Tab "Bài tập về nhà" (mặc định) - dump trước khi đổi tab, để có baseline so sánh.
    await dumpTables(page, "02_default_tab_tables");

    // Chuyển sang tab "Tổng kết lớp" (theo docx mục 2.2 - tên tab chính xác, chưa xác nhận DOM
    // thật nên thử match text rộng trước, ghi lại nếu không thấy).
    const tabLocator = page.getByText("Tổng kết lớp", { exact: false }).first();
    const tabExists = await tabLocator.count();
    if (!tabExists) {
      writeFileSync(
        join(OUT_DIR, "BLOCKED_tab_not_found.txt"),
        "Không tìm thấy text 'Tổng kết lớp' trên màn Báo cáo học tập - xem 01_report_home.text.txt để tìm tên tab thật.",
        "utf8",
      );
      return;
    }
    await tabLocator.click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1000);
    await dumpScreen(page, "03_class_summary_tab");
    await dumpTables(page, "04_class_summary_tables");

    // Droplist "Học kỳ" - đọc option thật (không bấm đổi, chỉ mở để xem danh sách - tránh side
    // effect ngoài dự kiến ở lượt khảo sát đầu tiên).
    const semesterDroplist = page.getByText("Học kỳ", { exact: false }).first();
    if (await semesterDroplist.count()) {
      await semesterDroplist.click().catch(() => {});
      await page.waitForTimeout(500);
      await dumpScreen(page, "05_semester_dropdown_open");
      await page.keyboard.press("Escape").catch(() => {});
    }

    // Bảng chuyên cần - có thể là 1 table riêng phía dưới, đã dump chung ở bước 04 nhưng chụp
    // thêm ảnh full-page cuộn xuống cuối để chắc chắn không bỏ sót phần dưới.
    await page.mouse.wheel(0, 2000).catch(() => {});
    await page.waitForTimeout(500);
    await dumpScreen(page, "06_class_summary_scrolled");
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
