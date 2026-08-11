#!/usr/bin/env node
/**
 * SCRIPT ĐIỀU TRA (KHÔNG PHẢI TESTCASE) - xác định filter "2 tuần gần nhất"/"1 tháng gần nhất"
 * trên "Bài tập đã giao" (Web GV) map sang API param nào, và response room.json có đủ
 * room_id/start_time/end_time để làm dataset ground-truth hay không. CHỈ ĐỌC, không tạo data.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loginTeacherPortal } from "./navigation/teacherPortalSession.js";
import { teacherPortalPageObjects as po } from "./navigation/teacherPortalPageObjects.js";

const HEADLESS = process.env.ASSIGN_HEADLESS !== "false";
const OUT_DIR = join(process.cwd(), "output", "data_discovery", "FILTER");
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
  try {
    text = await page.locator("body").innerText();
  } catch {}
  writeFileSync(join(OUT_DIR, `${name}.url.txt`), url, "utf8");
  writeFileSync(join(OUT_DIR, `${name}.text.txt`), text, "utf8");
  console.log(`[DUMP] ${name} -> url=${url}`);
}

async function main() {
  const { browser, page } = await loginTeacherPortal({ headless: HEADLESS });
  attachNetworkCapture(page);
  try {
    await page.getByText(po.menu.menuItem, { exact: false }).first().click();
    await page.getByText("Danh sách bài tập đã giao", { exact: false }).waitFor({ timeout: 15000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    await dumpScreen(page, "01_default_filter");

    console.log("--- room.json calls SAU KHI VÀO LIST (filter mặc định) ---");
    for (const e of networkLog.filter((x) => x.url.includes("room.json"))) {
      console.log(e.url);
    }

    // Tìm dropdown filter khoảng thời gian - đã thấy text "2 tuần gần nhất" / "1 tháng gần nhất"
    // trong dump trước, thử click vào trigger hiện đang hiển thị "2 tuần gần nhất".
    const periodTrigger = page.getByText("2 tuần gần nhất", { exact: true }).first();
    await periodTrigger.click();
    await page.waitForTimeout(500);
    await dumpScreen(page, "02_period_dropdown_open");

    const beforeSwitchCount = networkLog.length;
    await page.getByText("1 tháng gần nhất", { exact: true }).last().click();
    await page.waitForTimeout(1500);
    await page.waitForLoadState("networkidle").catch(() => {});
    await dumpScreen(page, "03_after_switch_to_month");

    console.log("--- room.json calls SAU KHI ĐỔI SANG '1 tháng gần nhất' ---");
    for (const e of networkLog.slice(beforeSwitchCount).filter((x) => x.url.includes("room.json"))) {
      console.log(e.url);
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
