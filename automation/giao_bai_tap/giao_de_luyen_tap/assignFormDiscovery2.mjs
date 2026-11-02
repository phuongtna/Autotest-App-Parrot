#!/usr/bin/env node
/**
 * SCRIPT ĐIỀU TRA VÒNG 2 (KHÔNG PHẢI TESTCASE) - bổ sung các điểm chưa rõ sau vòng 1
 * (assignFormDiscovery.mjs): disable-theo-khối khi chọn lớp, validate bắt buộc lớp/đề, cấu trúc
 * 2 nút ngày tháng, badge Pro, danh sách đề có nhiều hơn 1 item. CHỈ ĐỌC - không bấm "Giao đề đã
 * chọn" khi đã có đề được chọn (tránh tạo dữ liệu thật); có bấm khi CHƯA chọn gì để xem lỗi
 * validate (không gửi request thật vì bị chặn phía client).
 *
 * Chạy: cd automation && node giao_bai_tap/giao_de_luyen_tap/assignFormDiscovery2.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loginTeacherPortal } from "../navigation/teacherPortalSession.js";
import { gotoPracticeTestList, openCreatePracticeTest, resolvePracticeTestDevCredentials } from "./navigation/practiceTestListPageObjects.js";

const HEADLESS = process.env.ASSIGN_HEADLESS !== "false";
const OUT_DIR = join(process.cwd(), "output", "data_discovery", "GIAO_DE_LUYEN_TAP_ASSIGN_FORM");
mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const { baseUrl, username, password } = resolvePracticeTestDevCredentials();
  const { browser, page } = await loginTeacherPortal({ headless: HEADLESS, baseUrl, username, password });
  try {
    // --- A. Validate "Giao tới lớp" bắt buộc: trạng thái nút submit khi chưa chọn gì ---
    await gotoPracticeTestList(page);
    await openCreatePracticeTest(page);
    const submitBtnA = page.getByRole("button", { name: /Giao đề đã chọn/ });
    console.log("--- A. submit button when nothing selected: disabled =", await submitBtnA.isDisabled());
    console.log("submit button outerHTML:", (await submitBtnA.evaluate((el) => el.outerHTML)).slice(0, 300));

    // --- B. Chọn lớp rồi kiểm tra trạng thái submit khi chưa chọn đề ---
    const classLabels = page.locator("label").filter({ has: page.locator('input[type="checkbox"]') });
    const classNames = (await classLabels.allInnerTexts()).map((t) => t.trim());
    console.log("classNames:", classNames);
    await classLabels.first().click();
    await page.waitForTimeout(300);
    console.log("--- B. submit button when class selected but no exam: disabled =", await submitBtnA.isDisabled());

    // --- C. Kiểm tra disable theo khối: lớp "3C" đã chọn ở trên, in trạng thái disabled toàn bộ checkbox ---
    for (let i = 0; i < (await classLabels.count()); i++) {
      const label = classLabels.nth(i);
      const checkbox = label.locator('input[type="checkbox"]');
      const name = (await label.innerText()).trim();
      const disabled = await checkbox.isDisabled();
      const checked = await checkbox.isChecked();
      console.log(`  class="${name}" disabled=${disabled} checked=${checked}`);
    }

    // --- D. Bỏ chọn lớp đã chọn, xác nhận mở lại tất cả ---
    await classLabels.first().click();
    await page.waitForTimeout(300);
    console.log("--- D. After deselecting the only selected class ---");
    for (let i = 0; i < (await classLabels.count()); i++) {
      const label = classLabels.nth(i);
      const checkbox = label.locator('input[type="checkbox"]');
      const name = (await label.innerText()).trim();
      const disabled = await checkbox.isDisabled();
      console.log(`  class="${name}" disabled=${disabled}`);
    }

    // --- E. Chọn 2 lớp cùng khối (nếu có >=2 lớp cùng khối theo chữ số đầu) ---
    // group by leading digits
    const groups = {};
    for (const n of classNames) {
      const m = /^(\d+)/.exec(n);
      const key = m ? m[1] : n;
      groups[key] = groups[key] || [];
      groups[key].push(n);
    }
    console.log("groups by khối:", groups);

    // --- F. Date picker triggers: đếm + text xung quanh mỗi aria-haspopup=menu ---
    await page.reload();
    await page.waitForLoadState("networkidle").catch(() => {});
    const dateTriggers = page.locator('[aria-haspopup="menu"]');
    const n = await dateTriggers.count();
    console.log("--- F. aria-haspopup=menu triggers:", n);
    for (let i = 0; i < n; i++) {
      const t = dateTriggers.nth(i);
      const html = await t.evaluate((el) => el.outerHTML.slice(0, 200));
      // find preceding label text
      const context = await t.evaluate((el) => {
        let p = el;
        for (let k = 0; k < 5; k++) {
          p = p.parentElement;
          if (!p) break;
        }
        return p ? p.innerText.slice(0, 150) : "";
      });
      console.log(`  trigger[${i}] html=${html}`);
      console.log(`  trigger[${i}] ancestor-context=${JSON.stringify(context)}`);
    }

    // --- G. Tìm loại kỳ thi có nhiều đề + badge Pro ---
    await classLabels.first().click(); // re-select class
    await page.waitForTimeout(500);
    const examTypeButtons = page.locator("button").filter({ hasText: /./ }).and(page.locator('button[aria-pressed]'));
    const count = await examTypeButtons.count();
    console.log("--- G. exam type buttons:", count);
    for (let i = 0; i < count; i++) {
      const btn = examTypeButtons.nth(i);
      const label = (await btn.innerText()).trim();
      await btn.click();
      await page.waitForTimeout(500);
      const items = page.locator('button[role="checkbox"][id^="lesson-item-"]');
      const itemCount = await items.count();
      const listLabel = await page.getByText(/Danh sách đề luyện tập \(/).first().innerText().catch(() => "");
      console.log(`  examType="${label}" itemCount=${itemCount} listLabel="${listLabel}"`);
      if (itemCount > 0) {
        const html = await page.locator('div.max-h-96.overflow-y-auto').first().evaluate((el) => el.outerHTML).catch(() => "");
        writeFileSync(join(OUT_DIR, `G_examtype_${i}_${label.replace(/[^a-zA-Z0-9]/g, "_")}.html`), html, "utf8");
      }
    }
  } catch (err) {
    writeFileSync(join(OUT_DIR, "ERROR2.txt"), `${err.message}\n${err.stack}`, "utf8");
    console.error("Lỗi:", err.message);
  } finally {
    await browser.close();
  }
}

main();
