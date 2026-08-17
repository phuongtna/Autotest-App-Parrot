/**
 * Discovery THẬT (không hardcode tên) cho vùng "Chọn Unit -> Chọn Lesson -> Danh sách bài tập"
 * trên form giao bài Web GV - dùng bởi runtime/assignHomeworkFlow.js để chọn NGẪU NHIÊN 1 Unit,
 * 1 Lesson của Unit đó, 1 assignment của Lesson đó, hoàn toàn dựa trên dữ liệu/DOM thật đang hiển
 * thị (không tự bịa tên Unit/Lesson/assignment).
 *
 * TÁI SỬ DỤNG NGUYÊN VẸN 2 khối logic ĐÃ XÁC NHẬN THẬT trong automation/giao_bai_tap/dataDiscovery.mjs
 * (script điều tra dữ liệu 1 lần, không phải testcase) - chỉ tách ra thành hàm export dùng lại
 * được, KHÔNG viết lại cách dò khác:
 *   - Lesson: các <button> phẳng có text khớp `^Lesson\s+\d+` (KHÔNG phải dropdown, xem
 *     assignHomeworkFlow.js#selectUnitLessonHomework bản gốc).
 *   - Assignment: "Danh sách bài tập" KHÔNG dùng checkbox chuẩn - mỗi item nhận diện bằng dấu hiệu
 *     "Xem chi tiết" + dòng "N câu hỏi" cùng ancestor gần nhất, tên bài là dòng còn lại trong cùng
 *     ancestor đó (xem dataDiscovery.mjs#itemCandidates - ĐÃ XÁC NHẬN THẬT qua debug DOM dump
 *     2026-08-09/dữ liệu thật của tài khoản GV "Phương").
 *
 * Unit là Radix Select thật (trigger role="combobox", listbox role="listbox"/option role="option")
 * - ĐÃ XÁC NHẬN THẬT trong assignHomeworkFlow.js bản gốc, tái sử dụng y nguyên cách mở/đọc/đóng.
 */

/** Collapse mọi chuỗi khoảng trắng liên tiếp thành 1 + trim - dùng để so sánh title item giữa
 * nguồn API (item.name thô, có thể còn lỗi gõ 2 dấu cách liên tiếp) và nguồn DOM (node.innerText,
 * browser đã tự collapse khoảng trắng khi render) - xem comment tại nơi dùng trong
 * resolveAndSelectAssignment(). */
function normalizeWhitespace(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Đọc TOÀN BỘ option Unit thật đang có (mở dropdown), CHỌN 1 option theo unitName nếu truyền vào,
 * hoặc random 1 option thật nếu không truyền (KHÔNG đoán tên Unit không có trên UI). Trả về tên
 * Unit đã chọn (để caller lưu metadata). Giữ nguyên tối ưu "không mở dropdown nếu unitName đã
 * khớp giá trị hiện tại" cho case CHỈ ĐỊNH SẴN unitName (tránh bug đã gặp thật: mở dropdown xong
 * không chọn lại gì khiến nó che nút "Lesson 1" phía dưới). Case RANDOM buộc phải mở dropdown để
 * thấy hết danh sách Unit thật trước khi chọn nên luôn mở. */
export async function resolveAndSelectUnit(page, unitName) {
  const unitTrigger = page.getByRole("combobox").first();
  await unitTrigger.waitFor({ state: "visible", timeout: 10000 });
  const currentUnitText = (await unitTrigger.innerText()).trim();

  if (unitName) {
    if (currentUnitText !== unitName) {
      await unitTrigger.click();
      const listbox = page.getByRole("listbox");
      await listbox.waitFor({ state: "visible", timeout: 10000 });
      await listbox.getByRole("option", { name: unitName, exact: true }).click();
    }
    return unitName;
  }

  await unitTrigger.click();
  const listbox = page.getByRole("listbox");
  await listbox.waitFor({ state: "visible", timeout: 10000 });
  const options = (await listbox.getByRole("option").allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  if (options.length === 0) {
    throw new Error("Không tìm thấy Unit nào trên Web GV để random - BLOCKED, không đoán tên.");
  }
  const chosen = options[Math.floor(Math.random() * options.length)];
  await listbox.getByRole("option", { name: chosen, exact: true }).click();
  return chosen;
}

/** Lesson là các <button> phẳng (KHÔNG phải dropdown) - dùng cho CẢ Unit thường ("Lesson 1",
 * "Lesson 2"...) VÀ Unit dạng Review (nhóm nút category "Vocabulary"/"Sentence patterns"/"Other" -
 * KHÔNG khớp pattern "Lesson N").
 *
 * SỬA (2026-08-17, xác nhận thật qua random E2E FAIL thật: random chọn "Review 3" -> lỗi "Không
 * tìm thấy Lesson nào trên Web GV"): bản cũ lọc <button> toàn trang bằng regex `/^Lesson\s+\d+/i`
 * - giả định SAI rằng MỌI Unit đều đặt tên Lesson theo dạng "Lesson N". Đã xác nhận thật qua
 * Playwright DOM dump (headless, Unit "Review 3" VS Unit 1: Hello): CẢ 2 dạng Unit đều render
 * đúng CÙNG cấu trúc DOM - field "Chọn Lesson" là 1 <div class="group/field ..."> chứa label
 * text="Chọn Lesson" + 1 nhóm <button class="...rounded-xl border..."> con (Unit thường:
 * "Lesson 1"/"Lesson 2"/"Lesson 3"; Unit Review: "Vocabulary"/"Sentence patterns"/"Other") - CHỈ
 * KHÁC ở TÊN nút, không khác cấu trúc. SỬA: định vị field container qua chính label "Chọn Lesson"
 * (ổn định, không phụ thuộc nội dung tên Lesson) rồi lấy TẤT CẢ <button> con của field đó -
 * KHÔNG còn giả định format tên. */
export async function listLessonCandidates(page) {
  return page.evaluate(() => {
    const label = Array.from(document.querySelectorAll("*")).find(
      (el) => el.children.length === 0 && el.textContent.trim() === "Chọn Lesson",
    );
    if (!label) return [];
    const fieldContainer = label.closest(".group\\/field") ?? label.parentElement;
    return Array.from(fieldContainer.querySelectorAll("button"))
      .map((n) => n.innerText.trim())
      .filter(Boolean);
  });
}

/** Chọn lessonName nếu truyền vào, hoặc random 1 Lesson thật của Unit hiện tại nếu không truyền.
 * Giữ nguyên cơ chế "chỉ click nếu chưa active" (class `bg-surface-action-sub`) đã verify thật.
 *
 * ĐÃ SỬA (2026-08-14, xác nhận thật qua run lỗi thật): lessonName khi đến từ
 * teacherAssignmentApiDiscovery.js (random qua API, field `lesson.name` thô từ CMS) có thể khác
 * case với nút thật trên DOM (đã tái hiện: API trả "LESSON 3", nút DOM là "Lesson 3") - getByText
 * exact:true phân biệt hoa/thường nên không bao giờ khớp, timeout 30s ở bước click. Đối chiếu
 * case-insensitive với availableLessons (nguồn DOM thật) để lấy đúng case hiển thị trước khi tìm
 * nút bấm. */
export async function resolveAndSelectLesson(page, lessonName) {
  const availableLessons = await listLessonCandidates(page);
  const resolvedLessonName = lessonName
    ? availableLessons.find((l) => l.toLowerCase() === lessonName.toLowerCase())
    : availableLessons[Math.floor(Math.random() * availableLessons.length)];
  if (!resolvedLessonName) {
    throw new Error("Không tìm thấy Lesson nào trên Web GV để random/chọn - BLOCKED, không đoán tên.");
  }
  const lessonButton = page.getByText(resolvedLessonName, { exact: true });
  const isLessonActive = await lessonButton.evaluate((el) => el.className.includes("bg-surface-action-sub"));
  if (!isLessonActive) {
    await lessonButton.click();
  }
  return resolvedLessonName;
}

/** Danh sách assignment thật của Lesson đang chọn: {title, questionCount, id}[], theo ĐÚNG thứ tự
 * DOM (dùng làm index tham chiếu cho clickAssignmentAtIndex, giữ tương thích ngược). COPY NGUYÊN
 * heuristic "Xem chi tiết" + "N câu hỏi" đã verify thật trong dataDiscovery.mjs, CHỈ THÊM trích
 * xuất questionCount + id (dataDiscovery.mjs trước đây bỏ dòng "N câu hỏi" đi, ở đây giữ lại để
 * phục vụ report metadata).
 *
 * `id` (MỚI, 2026-08-17): xác nhận THẬT qua audit DOM trực tiếp (Playwright, headless, Unit 1:
 * Hello/Lesson 1 - fixture có ĐÚNG 2 item cùng title "Choose the correct answer." khác nội dung) -
 * mỗi item có 1 <button role="checkbox"> với id DOM dạng CỐ ĐỊNH `lesson-item-{catalogItemId}`,
 * catalogItemId đó KHỚP 100% với `item.id` trả về từ `POST /api/learn/items` (đã đối chiếu trực
 * tiếp: node "Choose the correct answer." đầu tiên trong DOM có
 * id="lesson-item-d8c84564-9d6f-4f1a-badd-892d2d82f1cd", CHÍNH XÁC bằng `item.id` của phần tử đầu
 * trong response API cho cùng Lesson). Đây là STABLE IDENTITY thật giữa CMS catalog <-> DOM Web GV
 * - trước đây KHÔNG được capture, khiến `resolveAndSelectAssignment(page, name)` phải dùng
 * `findIndex` theo title (SAI khi ≥2 item trùng title, luôn chọn NHẦM/không xác định được item đầu
 * tiên có phải đúng ý định hay không - xem lỗi thật đã audit 2026-08-17, root cause của case "2 bài
 * cùng title khác nội dung"). Từ nay ưu tiên chọn qua `id` (xem resolveAndSelectAssignmentById),
 * KHÔNG còn phụ thuộc thứ tự DOM/title để xác định đúng item nữa. */
export async function listAssignmentCandidates(page) {
  return page.evaluate(() => {
    const xemChiTietEls = Array.from(document.querySelectorAll("*")).filter(
      (el) => el.textContent.trim() === "Xem chi tiết",
    );
    const results = [];
    for (const btn of xemChiTietEls) {
      let node = btn.parentElement;
      // ĐÚNG bằng dataDiscovery.mjs bản gốc: chỉ break khi đã tìm được titleLine THẬT ở cấp hiện
      // tại - ancestor GẦN NHẤT chứa "câu hỏi" (badge + nút "Xem chi tiết") có thể CHƯA có title
      // (title nằm ở ancestor XA HƠN, sibling khác nhánh) - nếu break sớm ở đây (bug đã gặp thật
      // 2026-08-12: mọi item của Unit 5/Lesson 2 bị bỏ sót vì badge "Câu hỏi" không có số + nằm ở
      // ancestor riêng không chứa title), toàn bộ assignment thật đang hiển thị sẽ bị coi là "0
      // item" một cách sai lệch. Không tìm thấy title ở cấp này -> tiếp tục leo lên cấp cao hơn.
      for (let i = 0; i < 8 && node; i++) {
        if (/câu hỏi/i.test(node.innerText || "")) {
          const lines = (node.innerText || "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
          const titleLine = lines.find((l) => !/câu hỏi/i.test(l) && l !== "Xem chi tiết");
          if (titleLine) {
            const qLine = lines.find((l) => /câu hỏi/i.test(l));
            const m = qLine ? /(\d+)\s*câu hỏi/i.exec(qLine) : null;
            const checkboxEl = node.querySelector('button[role="checkbox"][id^="lesson-item-"]');
            const id = checkboxEl ? checkboxEl.id.replace(/^lesson-item-/, "") : null;
            results.push({ title: titleLine, questionCount: m ? Number(m[1]) : null, id });
            break;
          }
        }
        node = node.parentElement;
      }
    }
    return results;
  });
}

/** Bấm ĐÚNG 1 item bằng stable id (KHÔNG phụ thuộc title/thứ tự DOM) - xem docblock
 * listAssignmentCandidates. Throw nếu không tìm thấy ĐÚNG 1 phần tử khớp id (0 hoặc >1 đều là lỗi
 * thật cần biết, không đoán). */
export async function clickAssignmentById(page, itemId) {
  const locator = page.locator(`#lesson-item-${itemId}`);
  const count = await locator.count();
  if (count === 0) {
    throw new Error(`clickAssignmentById: không tìm thấy item nào với id="${itemId}" trong Lesson đang chọn.`);
  }
  if (count > 1) {
    throw new Error(`clickAssignmentById: id="${itemId}" khớp ${count} phần tử (không unique) - dừng lại, không đoán.`);
  }
  await locator.click();
}

export class AmbiguousAssignmentNameError extends Error {}

/** Chọn 1 assignment bằng id ổn định đã biết trước (caller đã resolve id qua CMS/API - vd
 * teacherAssignmentApiDiscovery.js#fetchEligibleAssignmentTree hoặc 1 lượt discovery read-only
 * riêng) - ĐƯỜNG AN TOÀN NHẤT khi ≥2 item cùng title (không cần phân biệt bằng title/index nữa).
 * @returns {Promise<{homeworkItemName: string, questionCount: number|null, id: string}>}
 */
export async function resolveAndSelectAssignmentById(page, itemId) {
  const availableItems = await listAssignmentCandidates(page);
  const item = availableItems.find((it) => it.id === itemId);
  if (!item) {
    throw new Error(
      `resolveAndSelectAssignmentById: không tìm thấy item id="${itemId}" trong "Danh sách bài tập" đang hiển thị - BLOCKED, không đoán/không bấm nhầm item khác.`,
    );
  }
  await clickAssignmentById(page, itemId);
  return { homeworkItemName: item.title, questionCount: item.questionCount, id: item.id };
}

/** Click ĐÚNG item tại index (thứ tự DOM giống hệt listAssignmentCandidates) bằng cách chạy lại
 * CHÍNH XÁC cùng 1 truy vấn DOM rồi dispatch click trực tiếp trên node title tại vị trí đó - đảm
 * bảo bấm ĐÚNG item đã random chọn ngay cả khi ≥2 item trùng title (không thể phân biệt bằng
 * page.getByText(title) khi title trùng nhau). */
export async function clickAssignmentAtIndex(page, index) {
  await page.evaluate((targetIndex) => {
    const xemChiTietEls = Array.from(document.querySelectorAll("*")).filter(
      (el) => el.textContent.trim() === "Xem chi tiết",
    );
    let seen = -1;
    for (const btn of xemChiTietEls) {
      let node = btn.parentElement;
      let titleNode = null;
      // Cùng lý do đã sửa ở listAssignmentCandidates: chỉ break khi đã tìm được titleLine THẬT,
      // không break ngay tại ancestor gần nhất chỉ có badge "câu hỏi"+"Xem chi tiết" mà chưa có
      // title (title nằm ở ancestor XA HƠN).
      for (let i = 0; i < 8 && node; i++) {
        if (/câu hỏi/i.test(node.innerText || "")) {
          const lines = (node.innerText || "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
          const titleLine = lines.find((l) => !/câu hỏi/i.test(l) && l !== "Xem chi tiết");
          if (titleLine) {
            titleNode =
              Array.from(node.querySelectorAll("*")).find(
                (el) => el.children.length === 0 && el.textContent.trim() === titleLine,
              ) || node;
            break;
          }
        }
        node = node.parentElement;
      }
      if (titleNode) {
        seen++;
        if (seen === targetIndex) {
          titleNode.click();
          return;
        }
      }
    }
    throw new Error(
      `clickAssignmentAtIndex: khong tim thay item tai index ${targetIndex} (tong so item da duyet=${seen + 1})`,
    );
  }, index);
}

/** Chọn homeworkItemName nếu truyền vào (hành vi CŨ - click theo text, giữ nguyên tương thích
 * ngược cho case ép tên cụ thể), hoặc random 1 assignment thật của Lesson hiện tại (click theo
 * index chính xác - xem clickAssignmentAtIndex). Trả về {homeworkItemName, questionCount} để
 * caller lưu metadata phục vụ HW-14_15/App HS matching.
 *
 * RANDOM CHỈ chọn trong các item CÓ badge "N câu hỏi" hiển thị SỐ THẬT (questionCount !== null) -
 * ĐÃ XÁC NHẬN THẬT bằng network capture trực tiếp (2026-08-12, GET /api/learn/items): những item
 * badge KHÔNG có số (vd nhiều dòng trùng tên "Choose the correct answer." xuất hiện ở hầu hết
 * Unit/Lesson) hoàn toàn KHÔNG có field exam_ids/room_id/question_count trong response - tức
 * KHÔNG có exam nào gắn vào, chỉ là 1 dòng lesson item rỗng trong catalog. Đã verify thật 2 lần
 * liên tiếp trên thiết bị: bấm "Giao bài đã chọn" với các item này KHÔNG BAO GIỜ hiện toast
 * "Giao bài tập mới thành công" (server không tạo được room vì exercise rỗng), trong khi mọi item
 * có số câu hỏi (vd "G3-U1-Lesson 1: Listen and repeat", 8 câu hỏi) đều submit PASS bình thường.
 * Loại các item rỗng này khỏi random để LUÔN random ra 1 assignment THẬT SỰ giao được - đây KHÔNG
 * phải né tránh 1 kết quả hợp lệ (khác hẳn assignment loại SPEAK: SPEAK có exam thật, exam_ids
 * đầy đủ, chỉ là exercise handler chưa hỗ trợ tự động hoá tiếp - case đó vẫn phải random bình
 * thường và để nguyên kết quả BLOCKED_MISSING_EXERCISE_HANDLER, không lọc bỏ). */
export async function resolveAndSelectAssignment(page, homeworkItemName) {
  const availableItems = await listAssignmentCandidates(page);

  if (!homeworkItemName) {
    const withRealExam = availableItems
      .map((item, index) => ({ ...item, index }))
      .filter((item) => item.questionCount !== null);
    if (withRealExam.length === 0) {
      throw new Error(
        "Không tìm thấy assignment nào có exam thật (badge hiển thị số câu hỏi) trong Lesson này để random - BLOCKED, không đoán tên.",
      );
    }
    const picked = withRealExam[Math.floor(Math.random() * withRealExam.length)];
    await clickAssignmentById(page, picked.id);
    return { homeworkItemName: picked.title, questionCount: picked.questionCount, id: picked.id };
  }

  // ĐÃ SỬA LẦN 2 (2026-08-17, root cause thật xác nhận qua audit DOM trực tiếp - xem
  // docblock listAssignmentCandidates): bản 2026-08-12 dùng `findIndex` theo title - CHỈ đúng khi
  // title unique. ĐÃ XÁC NHẬN THẬT title KHÔNG unique (Unit 1: Hello/Lesson 1 có ĐÚNG 2 item cùng
  // title "Choose the correct answer.", khác hẳn nội dung/exam_id/correctAnswer - xem
  // automation/bai_tap/discovery/teacherMaterialsExamResolver.js). `findIndex` khi đó LUÔN chọn
  // item ĐẦU TIÊN theo thứ tự DOM một cách ÂM THẦM, không có cách nào biết đó có phải đúng ý định
  // của caller hay không - RỦI RO THẬT, không phải giả thuyết. SỬA: đếm TẤT CẢ candidate khớp title
  // (chuẩn hoá khoảng trắng, giữ nguyên lý do chuẩn hoá cũ) - nếu ĐÚNG 1, bấm qua id (ổn định, xem
  // resolveAndSelectAssignmentById); nếu ≥2, throw AmbiguousAssignmentNameError kèm đủ id của từng
  // candidate - KHÔNG tự chọn đại, caller (assignHomeworkFlow.js) phải tự quyết định (vd yêu cầu
  // truyền thẳng homeworkItemId thay vì tên khi biết trước sẽ đụng Lesson có duplicate).
  const matches = availableItems.filter(
    (it) => normalizeWhitespace(it.title) === normalizeWhitespace(homeworkItemName),
  );
  if (matches.length === 0) {
    throw new Error(
      `Không tìm thấy assignment "${homeworkItemName}" trong "Danh sách bài tập" đang hiển thị của Lesson này - BLOCKED, không đoán/không bấm nhầm item khác.`,
    );
  }
  if (matches.length > 1) {
    throw new AmbiguousAssignmentNameError(
      `AMBIGUOUS_ASSIGNMENT_NAME: ${matches.length} item cùng title "${homeworkItemName}" trong Lesson này ` +
        `(id: ${matches.map((m) => m.id).join(", ")}) - không thể xác định đúng ý định chỉ bằng title, ` +
        `không đoán. Truyền homeworkItemId (1 trong các id trên) để chọn chính xác.`,
    );
  }
  await clickAssignmentById(page, matches[0].id);
  return { homeworkItemName, questionCount: matches[0].questionCount, id: matches[0].id };
}
