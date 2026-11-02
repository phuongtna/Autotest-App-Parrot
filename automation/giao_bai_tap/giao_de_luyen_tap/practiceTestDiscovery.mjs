#!/usr/bin/env node
/**
 * SCRIPT ĐIỀU TRA (KHÔNG PHẢI TESTCASE) - xác định cấu trúc DOM thật của tab "Giao đề luyện tập"
 * (Web GV) trước khi viết page objects/flow thật, đúng nguyên tắc "không đoán selector" đã áp
 * dụng xuyên suốt repo này (xem automation/giao_bai_tap/filterDiscovery.mjs làm mẫu cho "Bài tập
 * đã giao" - đây là bản tương đương cho "Đề luyện tập đã giao").
 *
 * CHỈ ĐỌC - không tạo/sửa/xóa dữ liệu nào.
 *
 * Chạy: cd automation && node giao_bai_tap/giao_de_luyen_tap/practiceTestDiscovery.mjs
 * ENV: ASSIGN_HEADLESS=false (mặc định true)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loginTeacherPortal } from "../navigation/teacherPortalSession.js";

const HEADLESS = process.env.ASSIGN_HEADLESS !== "false";
const OUT_DIR = join(process.cwd(), "output", "data_discovery", "GIAO_DE_LUYEN_TAP");
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
  let html = "";
  try {
    text = await page.locator("body").innerText();
  } catch {}
  try {
    html = await page.locator("body").innerHTML();
  } catch {}
  writeFileSync(join(OUT_DIR, `${name}.url.txt`), url, "utf8");
  writeFileSync(join(OUT_DIR, `${name}.text.txt`), text, "utf8");
  writeFileSync(join(OUT_DIR, `${name}.html`), html, "utf8");
  console.log(`[DUMP] ${name} -> url=${url}`);
}

async function main() {
  const { browser, page } = await loginTeacherPortal({ headless: HEADLESS });
  attachNetworkCapture(page);
  try {
    await dumpScreen(page, "00_after_login");

    // Tìm menu sidebar chứa "Giao bài" (chưa biết text chính xác - đoán theo mô tả testcase LIST-01
    // "Vào menu 'Giao bài'" - dump trước để xác nhận).
    const sidebarText = await page.locator("body").innerText();
    writeFileSync(join(OUT_DIR, "sidebar_text_dump.txt"), sidebarText, "utf8");

    const candidates = ["Giao bài", "Giao bài tập", "Giao đề luyện tập"];
    for (const c of candidates) {
      const count = await page.getByText(c, { exact: false }).count();
      console.log(`  candidate menu text "${c}": ${count} match(es)`);
    }

    // Thử vào menu "Giao bài tập" hiện có trước (biết chắc tồn tại) rồi tìm tab trong màn đó.
    await page.getByText("Giao bài tập", { exact: false }).first().click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1000);
    await dumpScreen(page, "01_after_click_giao_bai_tap_menu");

    const tabCandidates = ["Giao bài tập", "Giao đề luyện tập"];
    for (const t of tabCandidates) {
      const count = await page.getByRole("tab", { name: t }).count();
      console.log(`  tab role candidate "${t}": ${count} match(es)`);
    }

    const practiceTab = page.getByText("Giao đề luyện tập", { exact: false }).first();
    if (await practiceTab.count()) {
      await practiceTab.click();
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1000);
      await dumpScreen(page, "02_after_click_practice_tab");

      console.log("--- API calls sau khi vào tab Giao đề luyện tập ---");
      for (const e of networkLog) {
        console.log(`${e.method} ${e.status} ${e.url}`);
      }
    } else {
      console.log('KHÔNG tìm thấy text "Giao đề luyện tập" ở màn hiện tại - cần kiểm tra lại đường dẫn menu.');
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
