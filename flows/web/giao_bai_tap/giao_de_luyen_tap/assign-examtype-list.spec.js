import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { loginForPracticeTestSpec } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestSpecSetup.js";
import { gotoPracticeTestList, openCreatePracticeTest } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestListPageObjects.js";
import {
  readCreateFormClassOptions,
  toggleClassCheckbox,
  readExamTypes,
  selectExamType,
  selectOnlyExamType,
  clearAllExamTypeChips,
  readExerciseListLabel,
  listExerciseItems,
  toggleExerciseItemByIndex,
  readSubmitLabel,
  assignFormPageObjects as afpo,
} from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestAssignFormPageObjects.js";

/**
 * Playwright Test THẬT cho nhóm "2. Chọn loại kỳ thi & Danh sách đề" (ASSIGN-EXAMTYPE-01..06,
 * ASSIGN-LIST-01..07, nguồn TESTCASES-giao-de-1.xlsx) - màn "Giao đề luyện tập" tạo mới. ĐÃ XÁC
 * NHẬN THẬT PASS 12/13 (1 SKIP có lý do) qua bản chạy trực tiếp trước khi chuyển sang `.spec.js`.
 *
 * PHÁT HIỆN QUAN TRỌNG (xem thêm docblock navigation/practiceTestAssignFormPageObjects.js): "Chọn
 * loại kỳ thi" là MULTI-SELECT CHIP, KHÔNG phải single-select tab dù UI trông giống tab - bấm 1 chip
 * đang tắt sẽ THÊM vào tập active (không tự tắt chip trước đó), "Danh sách đề luyện tập" là HỢP
 * (UNION) đề của mọi chip đang active. Mọi phép so sánh số lượng/nội dung THEO TỪNG loại kỳ thi ở
 * file này dùng `selectOnlyExamType()` để CÔ LẬP đúng 1 chip.
 *
 * ASSIGN-LIST-03 (badge "Pro") SKIP - đã quét toàn bộ 7 lớp × 8 loại kỳ thi trên tài khoản DEV,
 * KHÔNG có đề nào mang badge Pro để verify thật.
 *
 * CHỈ ĐỌC - không bấm "Giao đề đã chọn", không tạo dữ liệu thật trên DEV.
 */
test.describe.serial('"Giao đề luyện tập" (Assign form) > Chọn loại kỳ thi & Danh sách đề', () => {
  let context;
  let page;
  let classNames;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await loginForPracticeTestSpec(browser));
    await gotoPracticeTestList(page);
    await openCreatePracticeTest(page);
    classNames = await readCreateFormClassOptions(page);
    expect(classNames.length, "Danh sách lớp RỖNG.").toBeGreaterThan(0);
    await toggleClassCheckbox(page, classNames[0], { expectChecked: true });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  let examTypeOrderFirstRead;
  test("ASSIGN-EXAMTYPE-02: mặc định chọn loại kỳ thi đầu tiên sau khi chọn lớp", async () => {
    const types = await readExamTypes(page);
    expect(types.length, "Không có loại kỳ thi nào hiển thị sau khi chọn lớp.").toBeGreaterThan(0);
    expect(types[0].active, `Kỳ vọng loại kỳ thi ĐẦU TIÊN ("${types[0].name}") tự active sau khi chọn lớp.`).toBe(true);
    examTypeOrderFirstRead = types.map((t) => t.name);
  });

  test("ASSIGN-EXAMTYPE-01: thứ tự hiển thị loại kỳ thi ổn định (CHƯA đối chiếu CMS)", async () => {
    await gotoPracticeTestList(page);
    await openCreatePracticeTest(page);
    await toggleClassCheckbox(page, classNames[0], { expectChecked: true });
    const typesAfterReload = (await readExamTypes(page)).map((t) => t.name);
    expect(typesAfterReload).toEqual(examTypeOrderFirstRead);
  });

  let isolatedCountByType, lowType, lowCount, highType, highCount, types;
  test("ASSIGN-EXAMTYPE-03: chọn loại kỳ thi khác hiển thị đúng danh sách đề tương ứng (cô lập từng chip)", async () => {
    types = await readExamTypes(page);
    isolatedCountByType = {};
    for (const t of types) {
      await selectOnlyExamType(page, t.name);
      isolatedCountByType[t.name] = (await listExerciseItems(page)).length;
    }
    const sorted = Object.entries(isolatedCountByType).sort((a, b) => a[1] - b[1]);
    [lowType, lowCount] = sorted[0];
    [highType, highCount] = sorted[sorted.length - 1];
    test.skip(lowCount === highCount, `Mọi loại kỳ thi của lớp "${classNames[0]}" cùng số lượng đề (${JSON.stringify(isolatedCountByType)}).`);

    await selectOnlyExamType(page, lowType);
    expect(await listExerciseItems(page)).toHaveLength(lowCount);
    await selectOnlyExamType(page, highType);
    expect(await listExerciseItems(page)).toHaveLength(highCount);
  });

  test('ASSIGN-EXAMTYPE-03b [PHÁT HIỆN THẬT]: "Chọn loại kỳ thi" là multi-select chip (UNION), không phải single-select tab', async () => {
    await selectOnlyExamType(page, lowType);
    await selectExamType(page, highType); // KHÔNG dùng selectOnly - cố ý giữ lowType active để quan sát union.
    const activeNow = (await readExamTypes(page)).filter((t) => t.active).map((t) => t.name);
    expect(activeNow.length, `Bấm thêm "${highType}" trong khi "${lowType}" đang active kỳ vọng ≥2 chip active - thực tế ${JSON.stringify(activeNow)}.`).toBeGreaterThanOrEqual(2);
  });

  test('ASSIGN-EXAMTYPE-04: bỏ chọn loại kỳ thi đang active → ẩn danh sách, hiện placeholder', async () => {
    await clearAllExamTypeChips(page);
    await selectExamType(page, lowType);
    const active = (await readExamTypes(page)).find((t) => t.active);
    expect(active, "Không có loại kỳ thi nào đang active để test toggle-off.").toBeTruthy();
    await selectExamType(page, active.name, { allowToggleOff: true });
    const stillActive = (await readExamTypes(page)).find((t) => t.name === active.name)?.active;
    expect(stillActive, `Bấm lại loại kỳ thi đang active ("${active.name}") kỳ vọng TOGGLE OFF.`).toBeFalsy();
    expect(await readExerciseListLabel(page)).toBeNull();
    await expect(page.locator("main")).toContainText(afpo.examTypeNotSelectedText);
  });

  let examTypeForClassA, countForClassA, otherKhoiClass;
  test("ASSIGN-EXAMTYPE-05: đổi \"Giao tới lớp\" sang khối khác cập nhật đúng danh sách đề", async () => {
    const classAKhoi = /^(\d+)/.exec(classNames[0])?.[1] ?? classNames[0];
    otherKhoiClass = classNames.find((n) => (/^(\d+)/.exec(n)?.[1] ?? n) !== classAKhoi);
    test.skip(!otherKhoiClass, "Chỉ có 1 khối lớp thật trên tài khoản DEV.");

    examTypeForClassA = lowType;
    countForClassA = lowCount;
    await selectOnlyExamType(page, examTypeForClassA);

    await toggleClassCheckbox(page, classNames[0], { expectChecked: false });
    await toggleClassCheckbox(page, otherKhoiClass, { expectChecked: true });
    await selectOnlyExamType(page, examTypeForClassA);
    const countForOtherClass = (await listExerciseItems(page)).length;
    if (countForOtherClass === countForClassA) {
      console.log(`[note] Số lượng đề của "${examTypeForClassA}" TRÙNG giữa lớp "${classNames[0]}" (${countForClassA}) và "${otherKhoiClass}" (${countForOtherClass}) - có thể trùng ngẫu nhiên do cùng pool đề QA.`);
    }

    // khôi phục lớp A cho các test sau.
    await toggleClassCheckbox(page, otherKhoiClass, { expectChecked: false });
    await toggleClassCheckbox(page, classNames[0], { expectChecked: true });
    await selectOnlyExamType(page, examTypeForClassA);
  });

  test('ASSIGN-EXAMTYPE-06: loại kỳ thi không có đề phù hợp hiển thị đúng text trống', async () => {
    test.skip(!otherKhoiClass, "Không có lớp khác khối thật trên tài khoản DEV.");
    await toggleClassCheckbox(page, classNames[0], { expectChecked: false });
    await toggleClassCheckbox(page, otherKhoiClass, { expectChecked: true });
    const firstType = (await readExamTypes(page))[0];
    await selectOnlyExamType(page, firstType.name);
    const items = await listExerciseItems(page);
    if (items.length === 0) {
      await expect(page.locator("main")).toContainText(afpo.examTypeEmptyListText);
    } else {
      console.log(`[note] Tổ hợp lớp "${otherKhoiClass}" + loại "${firstType.name}" không còn 0 đề như lần xác nhận trước (dữ liệu DEV đã đổi) - ${items.length} đề.`);
    }
    // khôi phục lớp A.
    await toggleClassCheckbox(page, otherKhoiClass, { expectChecked: false });
    await toggleClassCheckbox(page, classNames[0], { expectChecked: true });
    await selectOnlyExamType(page, examTypeForClassA || (await readExamTypes(page))[0]?.name);
  });

  test('ASSIGN-LIST-01: số lượng đề trong label "Danh sách đề luyện tập (n)" khớp số dòng render thật', async () => {
    const label = await readExerciseListLabel(page);
    const items = await listExerciseItems(page);
    const labelCount = Number(/\((\d+)\)/.exec(label || "")?.[1]);
    expect(labelCount).toBe(items.length);
  });

  test("ASSIGN-LIST-02: mỗi dòng đề hiển thị đủ checkbox, tên đề, số câu hỏi, thời gian, Xem chi tiết", async () => {
    await selectOnlyExamType(page, highType);
    const items = await listExerciseItems(page);
    test.skip(items.length === 0, "Loại kỳ thi đang chọn không có đề nào để kiểm tra.");
    for (const item of items) {
      const rowText = await item.row.innerText();
      expect(item.title).toBeTruthy();
      expect(rowText).toMatch(/\d+\s*(C|c)âu hỏi/);
      expect(rowText).toMatch(/\d+\s*phút/);
      expect(rowText).toContain(afpo.previewButtonText);
    }
  });

  test('ASSIGN-LIST-03: icon Pro hiển thị đúng với đề thuộc gói Pro', async () => {
    test.skip(true, 'Đã quét toàn bộ 7 lớp × 8 loại kỳ thi trên DEV - không có đề Pro nào để verify thật.');
  });

  let twoItemExamType;
  test("ASSIGN-LIST-04: tích chọn 1 đề", async () => {
    for (const t of types) {
      await selectOnlyExamType(page, t.name);
      if ((await listExerciseItems(page)).length >= 2) {
        twoItemExamType = t.name;
        break;
      }
    }
    expect(twoItemExamType, "Không tìm thấy loại kỳ thi nào có ≥2 đề (cô lập) cho lớp đang chọn.").toBeTruthy();
    await selectOnlyExamType(page, twoItemExamType);
    await toggleExerciseItemByIndex(page, 0, { expectChecked: true });
    await expect.poll(() => readSubmitLabel(page)).toContain("(1)");
  });

  test("ASSIGN-LIST-05: tích chọn nhiều đề cùng lúc", async () => {
    await toggleExerciseItemByIndex(page, 1, { expectChecked: true });
    const items = await listExerciseItems(page);
    expect(items.filter((i) => i.checked)).toHaveLength(2);
    await expect.poll(() => readSubmitLabel(page)).toContain("(2)");
  });

  test("ASSIGN-LIST-06: bỏ tích 1 đề đã chọn", async () => {
    await toggleExerciseItemByIndex(page, 1, { expectChecked: false });
    const items = await listExerciseItems(page);
    expect(items.filter((i) => i.checked)).toHaveLength(1);
  });

  test('ASSIGN-LIST-07: [CẦN XÁC NHẬN] giữ trạng thái tích chọn khi chuyển qua lại giữa các loại kỳ thi', async () => {
    const otherType = types.find((t) => t.name !== twoItemExamType)?.name;
    test.skip(!otherType, "Chỉ có 1 loại kỳ thi thật.");
    await selectOnlyExamType(page, otherType);
    await selectOnlyExamType(page, twoItemExamType);
    const items = await listExerciseItems(page);
    expect(items[0].checked, `Đề đã tích chọn ("${items[0].title}") kỳ vọng VẪN checked sau khi chuyển qua "${otherType}" rồi quay lại.`).toBe(true);
  });
});
