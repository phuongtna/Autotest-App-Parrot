#!/usr/bin/env node
/**
 * SCRIPT ĐIỀU TRA DỮ LIỆU (KHÔNG PHẢI TESTCASE) - dùng 1 lần cho Giai đoạn 0 Data Discovery
 * (xác định nguồn thật của assignment ID / "ngày giao" / "Xem báo cáo" trên Web GV). File này
 * KHÔNG được gọi bởi bất kỳ testcase/YAML nào, chỉ chạy tay qua `node dataDiscovery.mjs`.
 *
 * Việc này TẠO DỮ LIỆU THẬT trên tài khoản GV test ("Phương", lớp 3B - tài khoản test riêng
 * cho automation, không phải GV thật ngoài dự án, xem flows/giao_bai_tap/TESTCASES.md) - đúng
 * như flow "npm run assign-homework" vẫn làm.
 *
 * Ghi lại TOÀN BỘ network response chứa "/api/" + dump text/URL ở mỗi màn hình, để phân tích
 * field nào là "ngày giao" thật - KHÔNG tự kết luận field nào đúng ngay trong script, chỉ thu
 * thập bằng chứng thô ra file cho người xem lại.
 *
 * ENV:
 *   RUN_LABEL=A|B (mặc định "A") - dùng để tách log giữa 2 lần giao bài (khác lesson/item để
 *     tránh trùng tên, xem LESSON_INDEX/ITEM_INDEX bên dưới).
 *   ASSIGN_DUE_DATE="DD/MM/YYYY" (mặc định hôm nay + 14 ngày)
 *   ASSIGN_HEADLESS=false để xem browser thật (mặc định true)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loginTeacherPortal } from "./navigation/teacherPortalSession.js";
import { teacherPortalPageObjects as po } from "./navigation/teacherPortalPageObjects.js";

const RUN_LABEL = process.env.RUN_LABEL || "A";
const HEADLESS = process.env.ASSIGN_HEADLESS !== "false";
const OUT_DIR = join(process.cwd(), "output", "data_discovery", RUN_LABEL);
mkdirSync(OUT_DIR, { recursive: true });

function fmtDdMmYyyy(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

const DEFAULT_DUE = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return fmtDdMmYyyy(d);
})();
const ASSIGN_DUE_DATE = process.env.ASSIGN_DUE_DATE || DEFAULT_DUE;

const networkLog = [];
const timeline = [];

function markTime(label) {
  const entry = { label, wallClockISO: new Date().toISOString() };
  timeline.push(entry);
  console.log(`[TIME] ${label} @ ${entry.wallClockISO}`);
  return entry;
}

function attachNetworkCapture(page) {
  page.on("response", async (resp) => {
    try {
      const url = resp.url();
      if (!url.includes("/api/")) return;
      const req = resp.request();
      const ct = resp.headers()["content-type"] || "";
      let body = null;
      if (ct.includes("application/json")) {
        body = await resp.json().catch(() => null);
      } else if (ct.includes("text/")) {
        body = await resp.text().catch(() => null);
      }
      networkLog.push({
        capturedAtISO: new Date().toISOString(),
        method: req.method(),
        url,
        status: resp.status(),
        requestPostData: req.postData(),
        responseContentType: ct,
        responseBody: body,
      });
    } catch (err) {
      networkLog.push({ capturedAtISO: new Date().toISOString(), captureError: err.message });
    }
  });
}

async function dumpScreen(page, name) {
  const dir = OUT_DIR;
  const url = page.url();
  let text = "";
  try {
    text = await page.locator("body").innerText();
  } catch (err) {
    text = `<<innerText failed: ${err.message}>>`;
  }
  writeFileSync(join(dir, `${name}.url.txt`), url, "utf8");
  writeFileSync(join(dir, `${name}.text.txt`), text, "utf8");
  try {
    await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
  } catch (err) {
    console.log(`  (screenshot failed for ${name}: ${err.message})`);
  }
  console.log(`[DUMP] ${name} -> url=${url}`);
  return { url, text };
}

async function main() {
  markTime("script_start");
  console.log(`RUN_LABEL=${RUN_LABEL} ASSIGN_DUE_DATE=${ASSIGN_DUE_DATE} HEADLESS=${HEADLESS}`);

  const { browser, page } = await loginTeacherPortal({ headless: HEADLESS });
  attachNetworkCapture(page);
  markTime("logged_in");

  try {
    // 1. Vào danh sách "Bài tập đã giao" TRƯỚC khi giao, chụp baseline.
    await page.getByText(po.menu.menuItem, { exact: false }).first().click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await dumpScreen(page, "01_before_list");
    markTime("before_list_captured");

    // 2. Mở form giao bài. Danh sách "Bài tập đã giao" (màn trước) CŨNG có text "3B" (filter +
    //    nhiều dòng bảng) - phải đợi CHẮC CHẮN đã sang màn tạo mới (heading "Thông tin bài tập"
    //    chỉ có ở màn này) trước khi bấm chọn lớp, tránh bấm nhầm vào filter/bảng ở màn cũ (bug
    //    thật đã gặp: click "3B" quá sớm => vẫn ở màn danh sách, combobox "Chọn Unit" không bao
    //    giờ xuất hiện).
    await page.getByRole("button", { name: po.menu.createButton }).click();
    await page.getByText("Thông tin bài tập", { exact: true }).waitFor({
      state: "visible",
      timeout: 15000,
    });
    await dumpScreen(page, "02_assign_form_open");

    // 3. Chọn lớp 3B (đã xác nhận dùng được với tài khoản test này).
    await page.getByText("3B", { exact: false }).first().click();

    // 4. Đặt Hạn nộp (tái dùng đúng logic đã xác nhận thật trong assignHomeworkFlow.js).
    const [dd, mm] = ASSIGN_DUE_DATE.split("/");
    const day = Number(dd);
    const month = Number(mm);
    const trigger = page
      .getByText(po.dueDate.label, { exact: true })
      .locator("xpath=following-sibling::*[@aria-haspopup='menu'][1]");
    await trigger.click();
    const popover = page.getByRole("menu");
    await popover.waitFor({ state: "visible", timeout: 10000 });
    for (let i = 0; i < 12; i++) {
      const headerText = await popover.locator("h6").innerText();
      const shownMonth = Number(/Tháng (\d+)/.exec(headerText)?.[1]);
      if (shownMonth === month) break;
      const chevronClass = shownMonth < month ? "lucide-chevron-right" : "lucide-chevron-left";
      await popover.locator(`button:has(svg.${chevronClass})`).click();
    }
    await popover.getByText(String(day), { exact: true }).click();
    await popover.waitFor({ state: "hidden", timeout: 10000 });

    // 5. Ghi lại danh sách Unit/Lesson/homework item HIỆN CÓ (không hardcode tên bài - dump thật
    //    để chọn theo INDEX, tránh đoán tên bài chưa xác nhận tồn tại).
    const unitTrigger = page.getByRole("combobox").first();
    await unitTrigger.waitFor({ state: "visible", timeout: 10000 });
    const currentUnitText = (await unitTrigger.innerText()).trim();
    console.log(`  Unit hiện tại (giữ nguyên, không đổi): "${currentUnitText}"`);
    await page.waitForTimeout(1500);
    await dumpScreen(page, "02b_after_unit_visible");

    // Lesson là các button phẳng ngay dưới Unit selector - dump text tất cả để chọn theo index,
    // tách A/B dùng lesson khác nhau nếu có >1, tránh trùng tên bài giữa 2 lần chạy.
    const lessonCandidates = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll("button")).filter((b) => {
        const t = (b.innerText || "").trim();
        return /^Lesson\s+\d+/i.test(t);
      });
      return nodes.map((n) => n.innerText.trim());
    });
    console.log(`  Lesson candidates: ${JSON.stringify(lessonCandidates)}`);
    const lessonIndex = RUN_LABEL === "B" && lessonCandidates.length > 1 ? 1 : 0;
    const lessonName = lessonCandidates[lessonIndex];
    if (!lessonName) {
      throw new Error("Không tìm thấy Lesson nào trên UI - BLOCKED, không đoán tên.");
    }
    const lessonButton = page.getByText(lessonName, { exact: true });
    const isLessonActive = await lessonButton.evaluate((el) =>
      el.className.includes("bg-surface-action-sub"),
    );
    if (!isLessonActive) {
      await lessonButton.click();
    }
    await page.waitForTimeout(1000);

    // "Danh sách bài tập" KHÔNG dùng checkbox (đã xác nhận qua TESTCASES.md: "click vào từng
    // dòng để chọn/bỏ chọn, không phải checkbox riêng lẻ") - dò bằng dấu hiệu riêng "N câu hỏi"
    // (chỉ item bài tập có dòng này), leo lên ancestor gần nhất có cả "Xem chi tiết" để lấy tên.
    const itemCandidates = await page.evaluate(() => {
      const xemChiTietEls = Array.from(document.querySelectorAll("*")).filter(
        (el) => el.textContent.trim() === "Xem chi tiết",
      );
      const seen = new Set();
      const names = [];
      for (const btn of xemChiTietEls) {
        let node = btn.parentElement;
        let name = null;
        // Leo lên TỚI KHI tìm được ancestor có cả "câu hỏi" VÀ 1 dòng text khác (tên bài) -
        // không dừng ở ancestor gần nhất chỉ chứa "N câu hỏi" + "Xem chi tiết" (không có tên,
        // vì tên nằm ở nhánh sibling khác trong cùng 1 row, đã xác nhận qua debug DOM thật).
        for (let i = 0; i < 8 && node; i++) {
          if (/câu hỏi/i.test(node.innerText || "")) {
            const lines = (node.innerText || "")
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean);
            const candidate = lines.find((l) => !/câu hỏi/i.test(l) && l !== "Xem chi tiết");
            if (candidate) {
              name = candidate;
              break;
            }
          }
          node = node.parentElement;
        }
        if (name && !seen.has(name)) {
          seen.add(name);
          names.push(name);
        }
      }
      return names;
    });
    console.log(`  Homework item candidates (dò theo "N câu hỏi"): ${JSON.stringify(itemCandidates)}`);

    if (itemCandidates.length === 0) {
      const debugHtml = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll("*")).find((n) =>
          /câu hỏi/i.test(n.textContent) && n.textContent.length < 40,
        );
        if (!el) return "NO_ELEMENT_WITH_CAU_HOI_TEXT";
        let out = "";
        let node = el;
        for (let i = 0; i < 6 && node; i++) {
          out += `\n===== LEVEL ${i} (tag=${node.tagName}) =====\n${node.outerHTML.slice(0, 1200)}\n`;
          node = node.parentElement;
        }
        return out;
      });
      writeFileSync(join(OUT_DIR, "03b_cau_hoi_ancestors_debug.txt"), debugHtml, "utf8");
    }

    // Ghi lại nguyên trạng field "Thời gian giao" (PHÁT HIỆN MỚI - chưa có trong
    // teacherPortalPageObjects.js hiện tại) để phân tích xem có phải input/hidden value hay chỉ
    // là text tĩnh hiển thị ngày hôm nay.
    const thoiGianGiaoHtml = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("*"));
      const label = all.find((el) => el.textContent.trim() === "Thời gian giao" && el.children.length === 0);
      if (!label) return null;
      const container = label.parentElement ? label.parentElement.parentElement : null;
      return container ? container.outerHTML.slice(0, 1500) : label.outerHTML;
    });
    writeFileSync(
      join(OUT_DIR, "02c_thoi_gian_giao_html.txt"),
      thoiGianGiaoHtml || "NOT_FOUND",
      "utf8",
    );

    // Danh sách bài tập trong Lesson: chọn theo text thật lấy được ở trên, KHÔNG hardcode.
    // Ưu tiên item KHÁC index cho A/B để giảm khả năng trùng tên giữa 2 lần chạy.
    let homeworkItemName = null;
    const itemIndex = RUN_LABEL === "B" && itemCandidates.length > 1 ? 1 : 0;
    if (itemCandidates.length > 0) {
      homeworkItemName = itemCandidates[itemIndex];
      await page.getByText(homeworkItemName, { exact: false }).first().click();
    } else {
      // fallback: item có thể không phải checkbox+label chuẩn - dump toàn bộ vùng "Danh sách
      // bài tập" để xem thật, KHÔNG đoán selector.
      await dumpScreen(page, "03_homework_list_area_unrecognized");
      throw new Error(
        "Không tự nhận diện được cấu trúc 'Danh sách bài tập' (không phải checkbox+label chuẩn) " +
          "- BLOCKED, xem 03_homework_list_area_unrecognized.text.txt để xác định lại selector.",
      );
    }
    console.log(`  Đã chọn Lesson="${lessonName}" Item="${homeworkItemName}"`);
    await dumpScreen(page, "04_before_submit");

    // 6. Ghi mốc T1 NGAY TRƯỚC khi bấm submit, rồi submit.
    markTime("T1_before_submit_click");
    await page.getByRole("button", { name: po.submit.button }).click();
    await page.getByText(po.submit.successToast).waitFor({ timeout: 15000 });
    markTime("T1_after_success_toast");
    await dumpScreen(page, "05_after_submit_toast");

    // 7. Về lại danh sách "Bài tập đã giao", chụp AFTER để so sánh với baseline (01_before_list).
    await page.waitForTimeout(1500);
    await page.waitForLoadState("networkidle").catch(() => {});
    await dumpScreen(page, "06_after_list");

    // 8. Thử click vào TÊN bài học vừa giao để vào "Chỉnh sửa bài tập". Vì có thể trùng tên với
    //    bản ghi cũ, click vào KHỚP CUỐI CÙNG (thường là bản mới nhất nếu list thêm ở cuối/đầu -
    //    CHƯA xác nhận thứ tự, ghi rõ trong report, không coi đây là bằng chứng chắc chắn).
    const matches = page.getByText(homeworkItemName, { exact: false });
    const matchCount = await matches.count();
    console.log(`  Số dòng khớp tên "${homeworkItemName}" trong danh sách: ${matchCount}`);
    writeFileSync(
      join(OUT_DIR, "06b_match_count.txt"),
      `matchCount=${matchCount} homeworkItemName=${homeworkItemName}`,
      "utf8",
    );

    if (matchCount > 0) {
      const beforeUrl = page.url();
      const beforeTextSnapshot = await page.locator("body").innerText();
      await matches.last().click();
      await page.waitForTimeout(1500);
      await page.waitForLoadState("networkidle").catch(() => {});
      const afterUrl = page.url();
      const afterTextSnapshot = await page.locator("body").innerText();
      const screenChanged = beforeUrl !== afterUrl || beforeTextSnapshot !== afterTextSnapshot;
      writeFileSync(
        join(OUT_DIR, "07_click_title_effect.txt"),
        `beforeUrl=${beforeUrl}\nafterUrl=${afterUrl}\nscreenChanged=${screenChanged}`,
        "utf8",
      );
      await dumpScreen(page, "07_after_click_title");

      // Assignment ID lộ ra qua URL route /teacher/exercise/:id/edit - trích xuất trực tiếp,
      // KHÔNG đoán format, chỉ parse URL thật vừa điều hướng tới.
      const idMatch = /\/teacher\/exercise\/([0-9a-f-]{8,})\/edit/i.exec(page.url());
      const assignmentId = idMatch ? idMatch[1] : null;
      writeFileSync(
        join(OUT_DIR, "07b_assignment_id.txt"),
        `assignmentId=${assignmentId}\nsourceUrl=${page.url()}`,
        "utf8",
      );
      console.log(`  Assignment ID (từ URL): ${assignmentId}`);

      if (screenChanged) {
        // 9. "Xem báo cáo" KHÔNG nằm trên màn "Chỉnh sửa bài tập" (đã xác nhận qua dump thật -
        //    không có text này ở 07_after_click_title) - nó nằm ở CỘT "HÀNH ĐỘNG" trên chính
        //    DÒNG tương ứng trong bảng "Bài tập đã giao". Quay lại list, tìm ĐÚNG dòng bằng
        //    (tên bài + hạn nộp vừa đặt) rồi bấm "Xem báo cáo" CỦA DÒNG ĐÓ - KHÔNG bấm text
        //    "báo cáo" đầu tiên tìm được trên trang (bug thật ở lần chạy trước: bấm nhầm link
        //    sidebar "Báo cáo học tập", điều hướng sai sang /teacher/dashboard).
        await page.getByText(po.menu.menuItem, { exact: false }).first().click();
        await page
          .getByText("Danh sách bài tập đã giao", { exact: false })
          .waitFor({ timeout: 15000 });
        await page.waitForLoadState("networkidle").catch(() => {});

        const row = page
          .locator("tr", { hasText: homeworkItemName })
          .filter({ hasText: ASSIGN_DUE_DATE });
        const rowCount = await row.count();
        writeFileSync(join(OUT_DIR, "08_row_match_count.txt"), `rowCount=${rowCount}`, "utf8");
        console.log(`  Số dòng bảng khớp (tên + hạn nộp="${ASSIGN_DUE_DATE}"): ${rowCount}`);

        if (rowCount === 1) {
          const reportButton = row.getByText("Xem báo cáo", { exact: true });
          await reportButton.click();
          await page.waitForTimeout(1500);
          await page.waitForLoadState("networkidle").catch(() => {});
          await dumpScreen(page, "09_after_click_report");
        } else {
          writeFileSync(
            join(OUT_DIR, "09_ROW_MATCH_AMBIGUOUS_OR_NOT_FOUND.txt"),
            `rowCount=${rowCount} - cần đúng 1 dòng khớp cả tên+hạn nộp để bấm an toàn, không đoán.`,
            "utf8",
          );
        }
      } else {
        writeFileSync(
          join(OUT_DIR, "07_CLICK_TITLE_NO_EFFECT.txt"),
          "Click vào tên bài KHÔNG đổi URL/nội dung - không vào được màn Chỉnh sửa theo cách này.",
          "utf8",
        );
      }
    }
  } catch (err) {
    writeFileSync(join(OUT_DIR, "ERROR.txt"), `${err.message}\n${err.stack}`, "utf8");
    console.error("Lỗi:", err.message);
  } finally {
    markTime("script_end");
    writeFileSync(join(OUT_DIR, "timeline.json"), JSON.stringify(timeline, null, 2), "utf8");
    writeFileSync(join(OUT_DIR, "network_log.json"), JSON.stringify(networkLog, null, 2), "utf8");
    console.log(`\nĐã ghi toàn bộ artifact vào: ${OUT_DIR}`);
    console.log(`  - network_log.json (${networkLog.length} response API capture được)`);
    await browser.close();
  }
}

main();
