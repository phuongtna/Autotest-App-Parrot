import { test, expect } from "../../../../automation/quan_ly_ky_thi/playwrightTest.js";
import { resolveCmsAdminBaseUrl, resolveCmsAdminCredentials, requireCmsAdminConfig } from "../../../../automation/src/config.js";
import {
  cmsKyThiPageObjects as po,
  gotoKyThi,
  openAddKyThiPopup,
  openEditKyThiPopup,
  fillKyThiForm,
  saveKyThiPopup,
  cancelKyThiPopup,
  closeKyThiPopupByIcon,
  readDialogText,
  readRowDescription,
  readAllKyThiNamesInOrder,
  deleteKyThiByName,
  kyThiRow,
  selectSectionToAttach,
  clickAttachSectionButton,
  attachSection,
  isAttachSectionButtonDisabled,
  isAttachSectionSelectDisabled,
  readAttachableSectionOptionTexts,
  readAttachedSectionNamesInOrder,
  moveAttachedSectionDown,
  isMoveUpDisabled,
  isMoveDownDisabled,
  unassignSection,
  readAttachedTotalCount,
} from "../../../../automation/quan_ly_ky_thi/navigation/cmsKyThiPageObjects.js";

/**
 * Nhóm "2. Thêm mới Kỳ thi" (ADD-01..23) - xem ghi chú chung (env dev, tiền tố AUTO-) tại
 * `ky-thi-list.spec.js`.
 *
 * Phần lớn case liên quan "Cấu hình đề xuất" (ADD-06..16) CHỈ thao tác BÊN TRONG popup rồi Hủy
 * (KHÔNG Lưu) - bảng danh sách Kỳ thi không hiển thị cột Section đã gắn nào nên không cần tạo bản
 * ghi thật mới kiểm tra được hành vi thêm/xóa/sắp xếp lại; tránh tạo rác dữ liệu không cần thiết.
 *
 * Hành vi "Cấu hình đề xuất" dưới đây ĐÃ XÁC NHẬN THẬT qua Playwright thật trên dev (2026-11-03,
 * dò DOM trực tiếp trước khi viết test, không suy đoán từ ảnh chụp):
 *   - Chọn 1 Section trong select KHÔNG tự gắn - phải bấm "Thêm" tường minh (ADD-13).
 *   - Mỗi dòng "Section đã gắn" là 1 `listitem` thật, có 3 nút tên thật "Lên trên"/"Xuống dưới"/
 *     "Bỏ gắn" (không phải icon-only vô danh).
 *   - Section vừa gắn biến mất khỏi select, xuất hiện lại khi "Bỏ gắn".
 *   - Dòng "Tổng: N section" chỉ xuất hiện khi N >= 1.
 *
 * ADD-03 (validate thiếu "Dạng quy đổi") BỎ QUA - field LUÔN pre-fill sẵn "Phổ thông" ngay khi mở
 * popup và KHÔNG thể xoá trống (hover không hiện icon "clear") - cùng kết luận đã xác nhận ở Bảng
 * điểm, không có cách nào tạo ra trạng thái "chưa chọn" để test case này áp dụng được.
 *
 * ADD-16 (droplist rỗng khi hệ thống chưa có Section nào) BỎ QUA - cần xóa sạch toàn bộ Section
 * thật trên dev để tạo điều kiện này, không an toàn cho automation tự thực hiện (cùng lý do
 * `LIST-08`).
 *
 * ADD-21 (trùng tên): `TESTCASES.md` tự ghi nhận rule này CHƯA CÓ xác nhận chính thức từ BA ("spec
 * không nêu"). ĐÃ XÁC NHẬN THẬT qua chạy test thật (2026-11-03): Kỳ thi CHẶN trùng tên với lỗi
 * "Tên kỳ thi đã tồn tại" - cùng rule với Section/Bảng điểm.
 * ADD-23 (giới hạn độ dài): vẫn giữ nguyên dạng Exploratory (không hard-code 1 nhánh cụ thể) vì
 * bản thân mục đích case là "quan sát khách quan" - xem comment tại test.
 */
const runId = `AUTO-${Date.now().toString(36)}`;
const createdNames = [];
function trackName(name) {
  createdNames.push(name);
  return name;
}

/** Lấy option ĐẦU TIÊN còn chọn được trong droplist "Cấu hình đề xuất" - không hard-code tên
 * Section cụ thể (dữ liệu thật trên dev có thể đổi theo thời gian), chỉ cần CÒN ít nhất 1 Section
 * chưa gắn là đủ cho các case không quan tâm tên cụ thể. */
async function firstAvailableOption(page) {
  const opts = (await readAttachableSectionOptionTexts(page)).map((t) => t.trim()).filter(Boolean);
  if (opts.length === 0) {
    throw new Error("Không còn Section nào trong hệ thống dev để chọn - cần có sẵn Section trước khi chạy test này.");
  }
  return opts[0];
}

/** Droplist hiển thị `"<Tên section> (<Kỹ năng>)"` nhưng dòng "Section đã gắn" chỉ hiển thị tên
 * (không kèm kỹ năng) - cắt bỏ hậu tố `" (...)"` để so khớp đúng. */
function sectionNameFromOption(optionText) {
  return optionText.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

test.describe.serial("Quản lý kỳ thi - 2. Thêm mới Kỳ thi (ADD-01..23)", () => {
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

    await gotoKyThi(page, baseUrl);
  });

  test.afterAll(async () => {
    for (const name of createdNames) {
      await deleteKyThiByName(page, name).catch(() => {});
    }
    await context.close();
  });

  test("ADD-01: mở popup Thêm mới - field trống, Dạng quy đổi pre-fill, chưa gắn section nào", async () => {
    await openAddKyThiPopup(page);
    await expect(page.getByRole("dialog").getByText(po.addDialogTitle)).toBeVisible();
    await expect(page.locator(po.nameInput)).toHaveValue("");
    await expect(page.locator(po.descriptionInput)).toHaveValue("");
    await expect(page.getByText(po.conversionDefaultValue)).toBeVisible();
    await expect(page.getByText(po.emptyAttachedSectionsText)).toBeVisible();
    expect(await readAttachedTotalCount(page)).toBeNull();
    await cancelKyThiPopup(page);
  });

  test("ADD-02: validate thiếu 'Tên kỳ thi'", async () => {
    await openAddKyThiPopup(page);
    await saveKyThiPopup(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await readDialogText(page)).toContain(po.nameRequiredError);
    await cancelKyThiPopup(page);
  });

  test.skip(
    "ADD-03: validate thiếu 'Dạng quy đổi' - BỎ QUA: field luôn pre-fill 'Phổ thông', không thể xoá trống (đã xác nhận thật 2026-11-03, hover không hiện icon clear) nên không tạo được điều kiện test",
    () => {},
  );

  test("ADD-04: Mô tả không bắt buộc - tạo thành công, hiển thị '—'", async () => {
    const name = trackName(`${runId}-add04`);
    await openAddKyThiPopup(page);
    await fillKyThiForm(page, { name });
    await saveKyThiPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await readRowDescription(page, name)).trim()).toBe(po.emptyDescriptionText);
  });

  test("ADD-05: Cấu hình đề xuất không bắt buộc - tạo thành công không gắn section nào", async () => {
    const name = trackName(`${runId}-add05`);
    await openAddKyThiPopup(page);
    await fillKyThiForm(page, { name });
    await saveKyThiPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(kyThiRow(page, name)).toBeVisible();
  });

  test("ADD-06: thêm 1 section vào Cấu hình đề xuất", async () => {
    await openAddKyThiPopup(page);
    const option = await firstAvailableOption(page);
    const sectionName = sectionNameFromOption(option);
    await attachSection(page, option);

    const names = await readAttachedSectionNamesInOrder(page);
    expect(names).toEqual([sectionName]);
    expect(await readAttachedTotalCount(page)).toBe(1);

    const remaining = (await readAttachableSectionOptionTexts(page)).map((t) => t.trim()).filter(Boolean);
    expect(remaining).not.toContain(option);
    await cancelKyThiPopup(page);
  });

  test("ADD-07: thêm nhiều section theo đúng thứ tự bấm", async () => {
    await openAddKyThiPopup(page);
    const expectedOrder = [];
    for (let i = 0; i < 3; i += 1) {
      const option = await firstAvailableOption(page);
      expectedOrder.push(sectionNameFromOption(option));
      await attachSection(page, option);
    }
    expect(await readAttachedSectionNamesInOrder(page)).toEqual(expectedOrder);
    expect(await readAttachedTotalCount(page)).toBe(3);
    await cancelKyThiPopup(page);
  });

  test("ADD-08: đổi vị trí section đã gắn bằng mũi tên xuống", async () => {
    await openAddKyThiPopup(page);
    const firstOption = await firstAvailableOption(page);
    const first = sectionNameFromOption(firstOption);
    await attachSection(page, firstOption);
    const secondOption = await firstAvailableOption(page);
    const second = sectionNameFromOption(secondOption);
    await attachSection(page, secondOption);

    expect(await readAttachedSectionNamesInOrder(page)).toEqual([first, second]);
    await moveAttachedSectionDown(page, first);
    expect(await readAttachedSectionNamesInOrder(page)).toEqual([second, first]);
    await cancelKyThiPopup(page);
  });

  test("ADD-09: nút mũi tên lên (Lên trên) vô hiệu ở section đầu tiên", async () => {
    await openAddKyThiPopup(page);
    const aOption = await firstAvailableOption(page);
    const a = sectionNameFromOption(aOption);
    await attachSection(page, aOption);
    const bOption = await firstAvailableOption(page);
    await attachSection(page, bOption);

    expect(await isMoveUpDisabled(page, a)).toBe(true);
    expect(await isMoveDownDisabled(page, a)).toBe(false);
    await cancelKyThiPopup(page);
  });

  test("ADD-10: nút mũi tên xuống (Xuống dưới) vô hiệu ở section cuối cùng", async () => {
    await openAddKyThiPopup(page);
    const aOption = await firstAvailableOption(page);
    await attachSection(page, aOption);
    const bOption = await firstAvailableOption(page);
    const b = sectionNameFromOption(bOption);
    await attachSection(page, bOption);

    expect(await isMoveDownDisabled(page, b)).toBe(true);
    expect(await isMoveUpDisabled(page, b)).toBe(false);
    await cancelKyThiPopup(page);
  });

  test("ADD-11: xóa 1 section khỏi 'Section đã gắn' - re-index và trả lại droplist", async () => {
    await openAddKyThiPopup(page);
    const aOption = await firstAvailableOption(page);
    const a = sectionNameFromOption(aOption);
    await attachSection(page, aOption);
    const bOption = await firstAvailableOption(page);
    const b = sectionNameFromOption(bOption);
    await attachSection(page, bOption);

    await unassignSection(page, a);
    expect(await readAttachedSectionNamesInOrder(page)).toEqual([b]);
    expect(await readAttachedTotalCount(page)).toBe(1);
    const remaining = (await readAttachableSectionOptionTexts(page)).map((t) => t.trim()).filter(Boolean);
    expect(remaining).toContain(aOption);
    await cancelKyThiPopup(page);
  });

  test("ADD-12: dòng 'Tổng: N section' ẩn khi gỡ hết section đã gắn", async () => {
    await openAddKyThiPopup(page);
    const option = await firstAvailableOption(page);
    const name = sectionNameFromOption(option);
    await attachSection(page, option);
    expect(await readAttachedTotalCount(page)).toBe(1);

    await unassignSection(page, name);
    expect(await readAttachedTotalCount(page)).toBeNull();
    await expect(page.getByText(po.emptyAttachedSectionsText)).toBeVisible();
    await cancelKyThiPopup(page);
  });

  test("ADD-13: chọn section trong droplist nhưng không bấm 'Thêm' -> không gắn vào kỳ thi", async () => {
    const name = trackName(`${runId}-add13`);
    await openAddKyThiPopup(page);
    await fillKyThiForm(page, { name });
    const option = await firstAvailableOption(page);
    await selectSectionToAttach(page, option); // CHỦ Ý không gọi clickAttachSectionButton()
    await saveKyThiPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await openEditKyThiPopup(page, name);
    await expect(page.getByText(po.emptyAttachedSectionsText)).toBeVisible();
    expect(await readAttachedTotalCount(page)).toBeNull();
    await cancelKyThiPopup(page);
  });

  test("ADD-14: nút 'Thêm' vô hiệu khi chưa chọn section nào trong droplist", async () => {
    await openAddKyThiPopup(page);
    expect(await isAttachSectionButtonDisabled(page)).toBe(true);
    await cancelKyThiPopup(page);
  });

  test("ADD-15: [Edge] droplist rỗng khi đã gắn hết toàn bộ Section hiện có", async () => {
    await openAddKyThiPopup(page);
    for (let guard = 0; guard < 50; guard += 1) {
      const opts = (await readAttachableSectionOptionTexts(page)).map((t) => t.trim()).filter(Boolean);
      if (opts.length === 0) break;
      await attachSection(page, opts[0]);
    }
    // Select "Cấu hình đề xuất" tự chuyển sang trạng thái disabled (ĐÃ XÁC NHẬN THẬT 2026-11-03) -
    // kiểm tra class trước, KHÔNG gọi readAttachableSectionOptionTexts() để tránh click vào 1
    // select đã disabled (Playwright treo "element is not stable" tới hết timeout).
    expect(await isAttachSectionSelectDisabled(page)).toBe(true);
    expect(await isAttachSectionButtonDisabled(page)).toBe(true);
    await cancelKyThiPopup(page);
  });

  test.skip(
    "ADD-16: [Edge] droplist rỗng khi hệ thống chưa có Section nào - BỎ QUA: cần xóa sạch dữ liệu Section thật trên dev, không an toàn cho automation tự thực hiện trên môi trường dùng chung",
    () => {},
  );

  test("ADD-17: tạo mới hợp lệ đầy đủ (tên + mô tả + 2 section)", async () => {
    const name = trackName(`${runId}-add17`);
    const description = `${runId} mo ta add17`;
    await openAddKyThiPopup(page);
    await fillKyThiForm(page, { name, description });
    const option1 = await firstAvailableOption(page);
    await attachSection(page, option1);
    const option2 = await firstAvailableOption(page);
    await attachSection(page, option2);
    await saveKyThiPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const names = await readAllKyThiNamesInOrder(page);
    expect(names[0]).toBe(name);
    expect((await readRowDescription(page, name)).trim()).toBe(description);
  });

  test("ADD-18: bấm Hủy khi đang nhập dở -> không tạo mới", async () => {
    const name = `${runId}-add18-notcreated`;
    await openAddKyThiPopup(page);
    await fillKyThiForm(page, { name, description: "mo ta" });
    await cancelKyThiPopup(page);
    expect(await kyThiRow(page, name).count()).toBe(0);
  });

  test("ADD-19: đóng popup bằng icon 'close' -> hành vi giống Hủy, không tạo mới", async () => {
    const name = `${runId}-add19-notcreated`;
    await openAddKyThiPopup(page);
    await fillKyThiForm(page, { name });
    await closeKyThiPopupByIcon(page);
    expect(await kyThiRow(page, name).count()).toBe(0);
  });

  test("ADD-20: popup Thêm mới không giữ dữ liệu cũ sau khi Lưu thành công", async () => {
    const name = trackName(`${runId}-add20`);
    await openAddKyThiPopup(page);
    await fillKyThiForm(page, { name, description: "mo ta add20" });
    const option = await firstAvailableOption(page);
    await attachSection(page, option);
    await saveKyThiPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await openAddKyThiPopup(page);
    await expect(page.locator(po.nameInput)).toHaveValue("");
    await expect(page.locator(po.descriptionInput)).toHaveValue("");
    await expect(page.getByText(po.emptyAttachedSectionsText)).toBeVisible();
    expect(await readAttachedTotalCount(page)).toBeNull();
    await cancelKyThiPopup(page);
  });

  test("ADD-21: [Edge] tạo 2 Kỳ thi trùng tên", async () => {
    const name = trackName(`${runId}-add21-dup`);
    await openAddKyThiPopup(page);
    await fillKyThiForm(page, { name });
    await saveKyThiPopup(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await openAddKyThiPopup(page);
    await fillKyThiForm(page, { name });
    await saveKyThiPopup(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await readDialogText(page)).toContain(po.nameDuplicateError);
    await cancelKyThiPopup(page);
    expect(await kyThiRow(page, name).count()).toBe(1);
  });

  test("ADD-22: [Edge] Tên kỳ thi chỉ gồm khoảng trắng -> coi là rỗng, báo lỗi bắt buộc", async () => {
    await openAddKyThiPopup(page);
    await fillKyThiForm(page, { name: "   " });
    await saveKyThiPopup(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await readDialogText(page)).toContain(po.nameRequiredError);
    await cancelKyThiPopup(page);
  });

  test("ADD-23: Tên kỳ thi vượt quá 500 ký tự -> chặn lưu kèm lỗi giới hạn", async () => {
    // ĐÃ XÁC NHẬN THẬT (2026-11-03): Tên kỳ thi giới hạn tối đa 500 ký tự, vượt quá bị chặn Lưu
    // kèm đúng lỗi "Tên kỳ thi tối đa 500 ký tự" (Mô tả dù cũng nhập rất dài không thấy lỗi tương
    // ứng trong cùng lần thử - không kết luận Mô tả có/không giới hạn riêng).
    const longName = `${runId}-add23-${"x".repeat(500)}`; // tổng > 500 ký tự
    await openAddKyThiPopup(page);
    await fillKyThiForm(page, { name: longName, description: "mo ta add23" });
    await saveKyThiPopup(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await readDialogText(page)).toContain(po.nameMaxLengthError);
    await cancelKyThiPopup(page);
  });
});
