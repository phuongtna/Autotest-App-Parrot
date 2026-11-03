import { test, expect } from "../../../../automation/cau_hinh_bang_diem/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsScoreTablePageObjects as po,
  gotoScoreTables,
  openAddScoreTablePopup,
  fillScoreTableForm,
  saveScoreTablePopup,
  cancelScoreTablePopup,
  closeScoreTablePopupByIcon,
  readDialogText,
  readRowDescription,
  deleteScoreTableByName,
  scoreTableRow,
} from "../../../../automation/cau_hinh_bang_diem/navigation/cmsScoreTablePageObjects.js";

/**
 * Nhóm "2. Thêm mới Bảng điểm" (ADD-01..13) - xem ghi chú chung (env dev, tiền tố AUTO-) tại
 * `score-table-list.spec.js`.
 *
 * ADD-03/ADD-04 (validate thiếu "Dạng quy đổi") BỊ BỎ - KHÔNG áp dụng được: field này LUÔN có sẵn
 * giá trị mặc định "Phổ thông" ngay khi mở popup và hệ thống hiện tại chỉ có đúng 1 giá trị, không
 * có cách nào đưa field về trạng thái trống để test validate (cùng kết luận ghi trong
 * `TESTCASES.md`/`cauhinhbangdiem.xlsx` - 2 ID này không xuất hiện trong lần chạy tay thật).
 *
 * ADD-10 (trùng tên) và ADD-11 (tên toàn khoảng trắng) ĐÃ XÁC NHẬN THẬT qua script dò hành vi bằng
 * Playwright thật trước khi viết file này (2026-11-03, không đoán): trùng tên bị CHẶN với lỗi
 * "Tên bảng điểm đã tồn tại"; tên toàn khoảng trắng bị coi là rỗng, báo lỗi
 * "Vui lòng nhập tên bảng điểm" (dùng chung lỗi bắt buộc, không có lỗi riêng).
 *
 * ADD-13 (chuỗi rất dài 500+ ký tự) ĐÃ XÁC NHẬN THẬT qua chạy tay (xlsx, 2026-11-03): hệ thống
 * cho lưu thành công, KHÔNG giới hạn độ dài - khác hướng "Exploratory" ghi trong TESTCASES.md gốc
 * (viết trước khi có xác nhận thật).
 */
const runId = `AUTO-${Date.now().toString(36)}`;
const createdNames = [];
function trackName(name) {
  createdNames.push(name);
  return name;
}

test.describe.serial("Cấu hình bảng điểm - 2. Thêm mới Bảng điểm (ADD-01..13)", () => {
  let context;
  let page;
  let baseUrl;

  test.beforeAll(async ({ browser }) => {
    requireCmsAdminConfig();
    baseUrl = resolveCmsAdminBaseUrl("dev");
    const { username, password } = resolveCmsAdminCredentials("dev");
    context = await browser.newContext();
    page = await context.newPage();

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator(po.login.usernameInput).fill(username);
    await page.locator(po.login.passwordInput).fill(password);
    await page.getByRole("button", { name: po.login.submitButton }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    await gotoScoreTables(page, baseUrl);
  });

  test.afterAll(async () => {
    for (const name of createdNames) {
      await deleteScoreTableByName(page, name).catch(() => {});
    }
    await context.close();
  });

  test("ADD-01: mở popup Thêm mới - Tên/Mô tả trống đúng placeholder, Dạng quy đổi mặc định 'Phổ thông'", async () => {
    await openAddScoreTablePopup(page);
    await expect(page.getByRole("dialog").getByText(po.addDialogTitle)).toBeVisible();
    await expect(page.locator(po.nameInput)).toHaveValue("");
    await expect(page.locator(po.descriptionInput)).toHaveValue("");
    await expect(page.getByRole("dialog").getByText(po.conversionDefaultValue, { exact: true })).toBeVisible();
    await cancelScoreTablePopup(page);
  });

  test("ADD-02: validate thiếu 'Tên bảng điểm'", async () => {
    await openAddScoreTablePopup(page);
    await saveScoreTablePopup(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await readDialogText(page)).toContain(po.nameRequiredError);
    await cancelScoreTablePopup(page);
  });

  test.skip(
    "ADD-03: validate thiếu 'Dạng quy đổi' - KHÔNG áp dụng: field luôn có sẵn giá trị mặc định 'Phổ thông', không có cách nào đưa về trạng thái trống",
    () => {},
  );
  test.skip(
    "ADD-04: validate thiếu đồng thời cả 2 field bắt buộc - KHÔNG áp dụng (phụ thuộc ADD-03)",
    () => {},
  );

  test("ADD-05: Mô tả không bắt buộc - tạo thành công, hiển thị '—'", async () => {
    const name = trackName(`${runId}-add05`);
    await openAddScoreTablePopup(page);
    await fillScoreTableForm(page, { name });
    await saveScoreTablePopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await readRowDescription(page, name)).trim()).toBe(po.emptyDescriptionText);
  });

  test("ADD-06: Dạng quy đổi = 'Phổ thông' hiển thị đúng thông báo mô tả rule", async () => {
    await openAddScoreTablePopup(page);
    const dialogText = await readDialogText(page);
    expect(dialogText).toContain(po.conversionAlertLine1);
    expect(dialogText).toContain(po.conversionAlertLine2);
    await cancelScoreTablePopup(page);
  });

  test("ADD-07: tạo mới hợp lệ đầy đủ", async () => {
    const name = trackName(`${runId}-add07`);
    const description = "Mô tả test ADD-07";
    await openAddScoreTablePopup(page);
    await fillScoreTableForm(page, { name, description });
    await saveScoreTablePopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await readRowDescription(page, name)).trim()).toBe(description);
  });

  test("ADD-08: bấm Hủy khi đang nhập dở -> không tạo mới", async () => {
    const name = `${runId}-add08-notcreated`;
    await openAddScoreTablePopup(page);
    await fillScoreTableForm(page, { name, description: "abc" });
    await cancelScoreTablePopup(page);
    expect(await scoreTableRow(page, name).count()).toBe(0);
  });

  test("ADD-09: đóng popup bằng icon '×' -> hành vi giống Hủy, không tạo mới", async () => {
    const name = `${runId}-add09-notcreated`;
    await openAddScoreTablePopup(page);
    await fillScoreTableForm(page, { name });
    await closeScoreTablePopupByIcon(page);
    expect(await scoreTableRow(page, name).count()).toBe(0);
  });

  test("ADD-10: tạo 2 Bảng điểm trùng tên -> bị chặn", async () => {
    const name = trackName(`${runId}-add10-dup`);
    await openAddScoreTablePopup(page);
    await fillScoreTableForm(page, { name });
    await saveScoreTablePopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await openAddScoreTablePopup(page);
    await fillScoreTableForm(page, { name });
    await saveScoreTablePopup(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await readDialogText(page)).toContain(po.nameDuplicateError);
    await cancelScoreTablePopup(page);
    expect(await scoreTableRow(page, name).count()).toBe(1);
  });

  test("ADD-11: Tên bảng điểm chỉ gồm khoảng trắng -> coi là rỗng, báo lỗi bắt buộc", async () => {
    await openAddScoreTablePopup(page);
    await fillScoreTableForm(page, { name: "   " });
    await saveScoreTablePopup(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await readDialogText(page)).toContain(po.nameRequiredError);
    await cancelScoreTablePopup(page);
  });

  test("ADD-12: popup Thêm mới không giữ dữ liệu cũ sau khi Lưu thành công", async () => {
    const name = trackName(`${runId}-add12`);
    await openAddScoreTablePopup(page);
    await fillScoreTableForm(page, { name, description: "mô tả tạm" });
    await saveScoreTablePopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await openAddScoreTablePopup(page);
    await expect(page.locator(po.nameInput)).toHaveValue("");
    await expect(page.locator(po.descriptionInput)).toHaveValue("");
    await expect(page.getByRole("dialog").getByText(po.conversionDefaultValue, { exact: true })).toBeVisible();
    await cancelScoreTablePopup(page);
  });

  test("ADD-13: Tên bảng điểm / Mô tả rất dài (500+ ký tự) -> hệ thống cho lưu thành công, không giới hạn", async () => {
    const longName = trackName(`${runId}-add13-${"X".repeat(480)}`);
    const longDescription = "Y".repeat(520);
    await openAddScoreTablePopup(page);
    await fillScoreTableForm(page, { name: longName, description: longDescription });
    await saveScoreTablePopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await scoreTableRow(page, longName).count()).toBe(1);
  });
});
