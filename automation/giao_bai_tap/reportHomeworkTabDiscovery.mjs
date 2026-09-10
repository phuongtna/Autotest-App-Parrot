#!/usr/bin/env node
/**
 * SCRIPT ĐIỀU TRA DỮ LIỆU (KHÔNG PHẢI TESTCASE) - khảo sát tab "Bài tập về nhà" (mặc định) của
 * màn "Báo cáo học tập" (Web GV) - CHỈ ĐỌC, không tạo/sửa/xoá gì. Cùng tinh thần/kiến trúc
 * `reportClassSummaryDiscovery.mjs` (tab "Tổng kết lớp") - viết thêm vì tab "Bài tập về nhà" CHƯA
 * từng dump lại được (artifact `output/` cũ đã mất, bị gitignore, không commit) - cần xác nhận lại
 * xem zone "Thống kê bài làm" click vào 1 bài có điều hướng ra ĐÚNG `/teacher/exercise/{id}/report`
 * (cùng trang với `teacherReportPageObjects.js` đã xác nhận qua lối vào "Giao bài tập" khác) hay là
 * 1 cấu trúc khác hẳn, trước khi viết thêm test case Module I "Bài tập về nhà".
 *
 * ENV: ASSIGN_HEADLESS=false để xem browser thật (mặc định true); TARGET_CLASS_TEXT để đổi lớp.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loginTeacherPortal } from "./navigation/teacherPortalSession.js";

const HEADLESS = process.env.ASSIGN_HEADLESS !== "false";
const TARGET_CLASS_TEXT = process.env.TARGET_CLASS_TEXT || null;
const OUT_DIR = join(process.cwd(), "output", "data_discovery", "REPORT_HOMEWORK_TAB");
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

async function dumpDom(page, name) {
  const html = await page.evaluate(() => document.querySelector("main")?.outerHTML || document.body.outerHTML);
  writeFileSync(join(OUT_DIR, `${name}.html`), html, "utf8");
}

async function main() {
  const { browser, page } = await loginTeacherPortal({ headless: HEADLESS });
  attachNetworkCapture(page);
  try {
    await page.getByText("Báo cáo học tập", { exact: false }).first().click();
    await page
      .getByText("Hãy chờ trong giây lát", { exact: false })
      .waitFor({ state: "hidden", timeout: 20000 })
      .catch(() => {});
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);
    await dumpScreen(page, "01_report_home");

    if (TARGET_CLASS_TEXT) {
      const classDroplist = page.locator("select").first();
      const isNativeSelect = await classDroplist.count();
      if (isNativeSelect) {
        await classDroplist.selectOption({ label: TARGET_CLASS_TEXT }).catch(() => {});
      } else {
        // ĐÃ XÁC NHẬN THẬT (reportClassSummaryDiscovery.mjs, dùng lại nguyên): bấm vào label lớp
        // ĐANG hiển thị trên trigger trước để MỞ dropdown, rồi mới bấm text lớp đích (lúc đó mới
        // hiện trong danh sách option) - bấm thẳng text lớp đích khi dropdown còn đóng sẽ không
        // trúng gì (đã gặp thật, xem 01_report_home.text.txt lần chạy trước: dropdown vẫn ở "3B").
        await page.getByText("3B", { exact: true }).first().click().catch(() => {});
        await page.getByText(TARGET_CLASS_TEXT, { exact: false }).first().click().catch(() => {});
      }
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1000);
      await dumpScreen(page, "02_after_class_switch");
    }

    // Vùng nội dung tab render sau (spinner riêng, không phải "Hãy chờ trong giây lát") - chờ
    // networkidle THẬT SỰ ổn định (không chỉ 1 nhịp) + thêm thời gian cố định trước khi đọc DOM,
    // tránh đọc phải lúc còn spinner (ĐÃ GẶP THẬT lượt chạy trước: dump lúc còn "loading").
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await dumpScreen(page, "02b_after_wait_for_content");

    await dumpDom(page, "03_default_tab_dom");

    // Tìm zone "Thống kê bài làm" - dump toàn bộ link/clickable trong khu vực đó để biết click vào
    // 1 bài sẽ điều hướng đi đâu (KHÔNG click gì cho tới khi log rõ candidate).
    const clickableSummary = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a[href]")).map((a) => ({
        text: a.textContent.trim().slice(0, 80),
        href: a.getAttribute("href"),
      }));
      const rows = Array.from(document.querySelectorAll("table tbody tr")).map((r) =>
        Array.from(r.querySelectorAll("td")).map((c) => c.innerText.trim()),
      );
      // "Thống kê bài làm" có thể KHÔNG phải <table> (nhiều màn trong app này dùng div/card) - tìm
      // heading rồi liệt kê mọi phần tử con có thể bấm được (a/button/[role=button]/[onclick]) +
      // vài phần tử con cấp 1-2 để biết cấu trúc thật, không suy đoán theo <table>.
      const heading = Array.from(document.querySelectorAll("h1,h2,h3,h4,div,span")).find(
        (el) => el.children.length === 0 && /Thống kê bài làm/i.test(el.textContent || ""),
      );
      let zoneInfo = null;
      if (heading) {
        // Container = tổ tiên gần nhất có nhiều hơn 1 con (khu vực chứa cả heading + danh sách).
        let container = heading.parentElement;
        for (let i = 0; i < 4 && container && container.children.length <= 1; i++) {
          container = container.parentElement;
        }
        const clickableInZone = container
          ? Array.from(container.querySelectorAll("a[href], button, [role='button'], tr, [onclick]")).map((el) => ({
              tag: el.tagName,
              text: (el.textContent || "").trim().slice(0, 100),
              href: el.getAttribute ? el.getAttribute("href") : null,
            }))
          : [];
        zoneInfo = {
          headingText: heading.textContent.trim(),
          containerTag: container ? container.tagName : null,
          containerChildCount: container ? container.children.length : null,
          containerOuterHTMLSnippet: container ? container.outerHTML.slice(0, 3000) : null,
          clickableInZone: clickableInZone.slice(0, 20),
        };
      }
      return { anchors, tableRowCount: rows.length, firstRows: rows.slice(0, 5), zoneInfo };
    });
    writeFileSync(join(OUT_DIR, "04_clickable_summary.json"), JSON.stringify(clickableSummary, null, 2), "utf8");
    console.log("Clickable summary:", JSON.stringify(clickableSummary, null, 2));

    // Nếu có >=1 link trỏ /teacher/exercise/ - đây rất có thể là zone "Thống kê bài làm" - bấm thử
    // đúng 1 cái đầu tiên (CHỈ ĐỌC, click = điều hướng, không sửa dữ liệu) để xác nhận đích đến.
    const zoneClickables = clickableSummary.zoneInfo?.clickableInZone || [];
    const exerciseLink =
      zoneClickables.find((a) => a.href && a.href.includes("/teacher/exercise/")) ||
      clickableSummary.anchors.find((a) => a.href && a.href.includes("/teacher/exercise/"));
    if (exerciseLink) {
      writeFileSync(join(OUT_DIR, "05_chosen_link.json"), JSON.stringify(exerciseLink, null, 2), "utf8");
      await page.getByRole("link", { name: exerciseLink.text, exact: false }).first().click();
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1000);
      await dumpScreen(page, "06_after_click_first_item");
    } else {
      // Không có link <a> trực tiếp - có thể là hàng bảng có onClick (không phải <a>). Thử click
      // thẳng vào dòng đầu tiên của bảng "Thống kê bài làm" nếu có, đọc URL sau đó.
      const firstRow = page.locator("table tbody tr").first();
      if (await firstRow.count()) {
        await firstRow.click().catch(() => {});
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(1000);
        await dumpScreen(page, "06_after_click_first_row_fallback");
      } else {
        writeFileSync(join(OUT_DIR, "BLOCKED_no_clickable_row_found.txt"), "Không tìm thấy link /teacher/exercise/ hay dòng bảng nào để bấm thử.", "utf8");
      }
    }
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
