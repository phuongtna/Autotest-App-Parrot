#!/usr/bin/env node
/**
 * SCRIPT ĐIỀU TRA (KHÔNG PHẢI TESTCASE) - xác định cấu trúc DOM thật của màn "Giao đề luyện tập"
 * (form tạo mới, /teacher/exercise/practice/add) trước khi viết page objects/flow thật cho bộ
 * testcase ASSIGN-* (TESTCASES-giao-de-1.xlsx). CHỈ ĐỌC - không bấm "Giao đề đã chọn" (không tạo
 * dữ liệu thật).
 *
 * Chạy: cd automation && node giao_bai_tap/giao_de_luyen_tap/assignFormDiscovery.mjs
 * ENV: ASSIGN_HEADLESS=false (mặc định true)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loginTeacherPortal } from "../navigation/teacherPortalSession.js";
import { gotoPracticeTestList, openCreatePracticeTest, resolvePracticeTestDevCredentials } from "./navigation/practiceTestListPageObjects.js";

const HEADLESS = process.env.ASSIGN_HEADLESS !== "false";
const OUT_DIR = join(process.cwd(), "output", "data_discovery", "GIAO_DE_LUYEN_TAP_ASSIGN_FORM");
mkdirSync(OUT_DIR, { recursive: true });

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
  const { baseUrl, username, password } = resolvePracticeTestDevCredentials();
  const { browser, page } = await loginTeacherPortal({ headless: HEADLESS, baseUrl, username, password });
  try {
    await gotoPracticeTestList(page);
    await openCreatePracticeTest(page);
    await dumpScreen(page, "00_create_form_initial");

    // Radio "Nguồn đề luyện tập"
    const radios = page.locator('[role="radio"], input[type="radio"]');
    console.log("radio count:", await radios.count());
    for (let i = 0; i < (await radios.count()); i++) {
      const r = radios.nth(i);
      console.log(`  radio[${i}]`, await r.evaluate((el) => el.outerHTML.slice(0, 300)));
    }

    // Class checkboxes
    const classLabels = page.locator("label").filter({ has: page.locator('input[type="checkbox"]') });
    console.log("class checkbox labels:", await classLabels.count());
    console.log(await classLabels.allInnerTexts());

    // Thời gian giao / Hạn nộp triggers
    const dateTriggers = page.locator('[aria-haspopup="menu"]');
    console.log("aria-haspopup=menu count:", await dateTriggers.count());

    // Exam type tabs
    const tabs = page.locator('[role="tab"]');
    console.log("tab count (within create form, includes outer 2 tabs too):", await tabs.count());
    console.log(await tabs.allInnerTexts());

    // Exercise item checkboxes
    const itemCheckboxes = page.locator('button[role="checkbox"][id^="lesson-item-"]');
    console.log("lesson-item checkboxes:", await itemCheckboxes.count());

    // "Xem chi tiết" links/buttons
    const previewBtns = page.getByText("Xem chi tiết", { exact: false });
    console.log('"Xem chi tiết" count:', await previewBtns.count());

    // Submit / cancel buttons
    console.log("Giao đề đã chọn button count:", await page.getByRole("button", { name: /Giao đề đã chọn/ }).count());
    console.log("Hủy button count:", await page.getByRole("button", { name: "Hủy", exact: true }).count());

    await dumpScreen(page, "01_create_form_after_inspection");

    // Try selecting first class to see exam type tabs / list appear
    const firstClassLabel = classLabels.first();
    if (await firstClassLabel.count()) {
      await firstClassLabel.click();
      await page.waitForTimeout(1000);
      await page.waitForLoadState("networkidle").catch(() => {});
      await dumpScreen(page, "02_after_select_first_class");

      const tabs2 = page.locator('[role="tab"]');
      console.log("tabs after class select:", await tabs2.allInnerTexts());

      const itemCheckboxes2 = page.locator('button[role="checkbox"][id^="lesson-item-"]');
      console.log("lesson-item checkboxes after class select:", await itemCheckboxes2.count());
      if (await itemCheckboxes2.count()) {
        const firstItem = itemCheckboxes2.first();
        const card = firstItem.locator("xpath=following-sibling::div[1]");
        console.log("first item card text:", (await card.innerText()).slice(0, 300));
        console.log("first item card html:", (await card.evaluate((el) => el.outerHTML)).slice(0, 2000));
      }

      // try opening preview popup
      const previewBtn2 = page.getByText("Xem chi tiết", { exact: false }).first();
      if (await previewBtn2.count()) {
        await previewBtn2.click();
        await page.waitForTimeout(1000);
        await dumpScreen(page, "03_after_open_preview_popup");
        const dialog = page.getByRole("dialog");
        console.log("dialog count:", await dialog.count());
        if (await dialog.count()) {
          console.log("dialog text sample:", (await dialog.first().innerText()).slice(0, 1500));
        }
      }
    }
  } catch (err) {
    writeFileSync(join(OUT_DIR, "ERROR.txt"), `${err.message}\n${err.stack}`, "utf8");
    console.error("Lỗi:", err.message);
  } finally {
    console.log(`\nĐã ghi artifact vào: ${OUT_DIR}`);
    await browser.close();
  }
}

main();
