import { test, expect } from "../../../../automation/giao_bai_tap/playwrightTest.js";
import { loginForPracticeTestSpec } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestSpecSetup.js";
import { gotoPracticeTestList, openCreatePracticeTest } from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestListPageObjects.js";
import {
  readSourceRadios,
  readCreateFormClassOptions,
  toggleClassCheckbox,
  isClassCheckboxDisabled,
  isClassCheckboxChecked,
  groupClassNamesByKhoi,
  readDateField,
  setDateField,
  readDisabledCalendarDays,
  isSubmitDisabled,
  assignFormPageObjects as afpo,
} from "../../../../automation/giao_bai_tap/giao_de_luyen_tap/navigation/practiceTestAssignFormPageObjects.js";

/**
 * Playwright Test THẬT cho nhóm "1. Thông tin đề (Nguồn đề / Giao tới lớp / Thời gian giao / Hạn
 * nộp)" (ASSIGN-SOURCE-01..03, ASSIGN-CLASS-01..05, ASSIGN-TIME-01..03, ASSIGN-DUE-01..04, nguồn
 * TESTCASES-giao-de-1.xlsx tab "Giao de luyen tap") - màn "Giao đề luyện tập" TẠO MỚI
 * (`/teacher/exercise/practice/add`), KHÁC màn danh sách đã giao (xem
 * navigation/practiceTestAssignFormPageObjects.js). ĐÃ XÁC NHẬN THẬT PASS 15/15 qua bản chạy trực
 * tiếp trước khi chuyển sang `.spec.js`.
 *
 * CHỈ ĐỌC - không bấm "Giao đề đã chọn", không tạo dữ liệu thật trên DEV.
 */
test.describe.serial('"Giao đề luyện tập" (Assign form) > Thông tin đề (SOURCE/CLASS/TIME/DUE)', () => {
  let context;
  let page;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await loginForPracticeTestSpec(browser));
    await gotoPracticeTestList(page);
    await openCreatePracticeTest(page);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('ASSIGN-SOURCE-01: giá trị mặc định "Nguồn đề luyện tập" = "Kho đề ParrotEdu"', async () => {
    const radios = await readSourceRadios(page);
    const parrot = radios.find((r) => r.value === afpo.sourceValues.parrot);
    expect(parrot?.checked, `Kỳ vọng radio "parrot" checked mặc định - thực tế: ${JSON.stringify(radios)}.`).toBe(true);
  });

  test('ASSIGN-SOURCE-02: radio "Nguồn đề luyện tập" luôn có đúng 1 lựa chọn, "Kho đề cá nhân" disabled', async () => {
    const radios = await readSourceRadios(page);
    const checkedCount = radios.filter((r) => r.checked).length;
    const personal = radios.find((r) => r.value === afpo.sourceValues.personal);
    expect(checkedCount, `Kỳ vọng đúng 1 radio checked - thực tế ${checkedCount}: ${JSON.stringify(radios)}.`).toBe(1);
    expect(personal?.disabled, `Kỳ vọng radio "personal" disabled (Kho đề cá nhân sắp ra mắt) - thực tế: ${JSON.stringify(personal)}.`).toBe(true);
  });

  test('ASSIGN-SOURCE-03: [PENDING] "Kho đề cá nhân" vẫn ở trạng thái chưa triển khai (disabled)', async () => {
    // Spec đánh dấu nguồn này "Pending, chưa làm" - verify tối thiểu trạng thái disabled hiện tại,
    // không có đường tương tác sâu hơn cho tới khi tính năng được triển khai thực tế.
    const radios = await readSourceRadios(page);
    const personal = radios.find((r) => r.value === afpo.sourceValues.personal);
    expect(personal?.disabled, 'Nếu "Kho đề cá nhân" vừa được enable, case này cần viết lại đầy đủ theo tính năng mới.').toBe(true);
  });

  let classNames;
  test('ASSIGN-CLASS-01: hiển thị đủ tất cả các lớp GV đã tạo (không rỗng, không trùng tên)', async () => {
    classNames = await readCreateFormClassOptions(page);
    expect(classNames.length, "Danh sách lớp RỖNG - cần ≥1 lớp thật để chạy các case còn lại.").toBeGreaterThan(0);
    expect(new Set(classNames).size, `Danh sách lớp có tên TRÙNG LẶP: ${JSON.stringify(classNames)}.`).toBe(classNames.length);
  });

  let classA, classB, otherKhoiClass;

  test("ASSIGN-CLASS-02: chọn 1 lớp → disable các lớp thuộc khối khác, giữ enable lớp cùng khối", async () => {
    const groups = groupClassNamesByKhoi(classNames);
    const khoiKeys = Object.keys(groups);
    const multiClassKhoi = khoiKeys.find((k) => groups[k].length >= 2);
    expect(multiClassKhoi, `Cần ≥1 khối có ≥2 lớp để test - nhóm theo khối hiện có: ${JSON.stringify(groups)}.`).toBeTruthy();
    [classA, classB] = groups[multiClassKhoi];
    otherKhoiClass = classNames.find((n) => !groups[multiClassKhoi].includes(n));

    await toggleClassCheckbox(page, classA, { expectChecked: true });
    if (otherKhoiClass) {
      expect(await isClassCheckboxDisabled(page, otherKhoiClass), `Kỳ vọng lớp khác khối "${otherKhoiClass}" bị disable sau khi chọn "${classA}".`).toBe(true);
    }
    expect(await isClassCheckboxDisabled(page, classB), `Kỳ vọng lớp cùng khối "${classB}" vẫn enabled sau khi chọn "${classA}".`).toBe(false);
  });

  test("ASSIGN-CLASS-03: chọn nhiều lớp cùng khối trong 1 lần giao", async () => {
    await toggleClassCheckbox(page, classB, { expectChecked: true });
    expect(await isClassCheckboxChecked(page, classA)).toBe(true);
    expect(await isClassCheckboxChecked(page, classB)).toBe(true);
  });

  test("ASSIGN-CLASS-04: bỏ chọn hết các lớp đã chọn → mở lại được tất cả các khối", async () => {
    await toggleClassCheckbox(page, classA, { expectChecked: false });
    await toggleClassCheckbox(page, classB, { expectChecked: false });
    for (const name of classNames) {
      expect(await isClassCheckboxDisabled(page, name), `Lớp "${name}" vẫn disabled sau khi bỏ chọn hết.`).toBe(false);
    }
  });

  test('ASSIGN-CLASS-05: không chọn lớp nào → chặn giao (nút "Giao đề đã chọn" disabled)', async () => {
    expect(await isSubmitDisabled(page)).toBe(true);
  });

  test('ASSIGN-TIME-01: giá trị mặc định "Thời gian giao" = ngày hiện tại', async () => {
    const today = new Date();
    const expected = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
    await expect.poll(() => readDateField(page, afpo.dateLabels.assignedAt)).toBe(expected);
  });

  test('ASSIGN-TIME-02: không cho chọn "Thời gian giao" là ngày trong quá khứ', async () => {
    const disabledDays = await readDisabledCalendarDays(page, afpo.dateLabels.assignedAt);
    const today = new Date();
    const pastDaysInMonth = today.getDate() - 1;
    if (pastDaysInMonth > 0) {
      expect(disabledDays.length, `Kỳ vọng ${pastDaysInMonth} ngày quá khứ bị disable - thực tế ${disabledDays.length}: ${JSON.stringify(disabledDays)}.`).toBeGreaterThanOrEqual(pastDaysInMonth);
    }
  });

  let assignedAtAfterPick;
  test('ASSIGN-TIME-03: cho phép chọn "Thời gian giao" là ngày hiện tại hoặc tương lai hợp lệ', async () => {
    const today = new Date();
    const future = new Date(today);
    future.setDate(future.getDate() + 3);
    await setDateField(page, afpo.dateLabels.assignedAt, { day: future.getDate(), month: future.getMonth() + 1 });
    assignedAtAfterPick = await readDateField(page, afpo.dateLabels.assignedAt);
    const expected = `${String(future.getDate()).padStart(2, "0")}/${String(future.getMonth() + 1).padStart(2, "0")}/${future.getFullYear()}`;
    expect(assignedAtAfterPick).toBe(expected);
  });

  test('ASSIGN-DUE-02: [CẦN XÁC NHẬN] đổi "Thời gian giao" cập nhật lại mặc định "Hạn nộp" (+2 ngày)', async () => {
    const dueDateAfter = await readDateField(page, afpo.dateLabels.dueDate);
    const [da, ma, ya] = assignedAtAfterPick.split("/").map(Number);
    const [dd, md, yd] = dueDateAfter.split("/").map(Number);
    const diffDays = Math.round((new Date(yd, md - 1, dd) - new Date(ya, ma - 1, da)) / 86400000);
    expect(diffDays, `"Hạn nộp"="${dueDateAfter}" lệch ${diffDays} ngày so với "Thời gian giao" mới (${assignedAtAfterPick}), kỳ vọng +2.`).toBe(2);
  });

  test('ASSIGN-DUE-01: giá trị mặc định "Hạn nộp" = "Thời gian giao" (mặc định) + 2 ngày', async () => {
    await gotoPracticeTestList(page);
    await openCreatePracticeTest(page);
    const assignedAt = await readDateField(page, afpo.dateLabels.assignedAt);
    const dueDate = await readDateField(page, afpo.dateLabels.dueDate);
    const [da, ma, ya] = assignedAt.split("/").map(Number);
    const [dd, md, yd] = dueDate.split("/").map(Number);
    const diffDays = Math.round((new Date(yd, md - 1, dd) - new Date(ya, ma - 1, da)) / 86400000);
    expect(diffDays, `"Hạn nộp"="${dueDate}" lệch ${diffDays} ngày so với "Thời gian giao" mặc định (${assignedAt}), kỳ vọng +2.`).toBe(2);
  });

  test('ASSIGN-DUE-04: [CẦN XÁC NHẬN] "Hạn nộp" trùng đúng ngày với "Thời gian giao" vẫn được phép chọn', async () => {
    const assignedAt = await readDateField(page, afpo.dateLabels.assignedAt);
    const [da, ma] = assignedAt.split("/").map(Number);
    await setDateField(page, afpo.dateLabels.dueDate, { day: da, month: ma });
    const dueDate = await readDateField(page, afpo.dateLabels.dueDate);
    expect(dueDate, `Kỳ vọng chọn được "Hạn nộp" trùng ngày "Thời gian giao" (${assignedAt}) - thực tế vẫn là "${dueDate}".`).toBe(assignedAt);
  });

  test('ASSIGN-DUE-03: không cho chọn "Hạn nộp" trước "Thời gian giao"', async () => {
    const today = new Date();
    const future = new Date(today);
    future.setDate(future.getDate() + 5);
    await setDateField(page, afpo.dateLabels.assignedAt, { day: future.getDate(), month: future.getMonth() + 1 });
    const disabledDays = await readDisabledCalendarDays(page, afpo.dateLabels.dueDate);
    const expectedDisabledCount = future.getDate() - 1;
    expect(disabledDays.length, `Kỳ vọng ≥${expectedDisabledCount} ngày trước "Thời gian giao" bị disable ở lịch "Hạn nộp" - thực tế ${disabledDays.length}: ${JSON.stringify(disabledDays)}.`).toBeGreaterThanOrEqual(expectedDisabledCount);
  });
});
