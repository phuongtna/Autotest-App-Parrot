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

/** Lesson là các <button> phẳng (KHÔNG phải dropdown) - COPY NGUYÊN query đã verify thật trong
 * dataDiscovery.mjs, không invent selector khác. */
export async function listLessonCandidates(page) {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("button")).filter((b) => {
      const t = (b.innerText || "").trim();
      return /^Lesson\s+\d+/i.test(t);
    });
    return nodes.map((n) => n.innerText.trim());
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

/** Danh sách assignment thật của Lesson đang chọn: {title, questionCount}[], theo ĐÚNG thứ tự
 * DOM (dùng làm index tham chiếu cho clickAssignmentAtIndex). COPY NGUYÊN heuristic "Xem chi
 * tiết" + "N câu hỏi" đã verify thật trong dataDiscovery.mjs, CHỈ THÊM trích xuất questionCount
 * (dataDiscovery.mjs trước đây bỏ dòng "N câu hỏi" đi, ở đây giữ lại để phục vụ report metadata). */
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
            results.push({ title: titleLine, questionCount: m ? Number(m[1]) : null });
            break;
          }
        }
        node = node.parentElement;
      }
    }
    return results;
  });
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
    await clickAssignmentAtIndex(page, picked.index);
    return { homeworkItemName: picked.title, questionCount: picked.questionCount };
  }

  // ĐÃ SỬA (2026-08-12): trước đây bấm bằng page.getByText(homeworkItemName).first() - SAI khi
  // ≥2 item trùng title thật (đã xác nhận thật qua discovery API: 1 Lesson có thể có nhiều item
  // tên khác nhau nhưng KHÔNG loại trừ khả năng trùng - cùng rủi ro đã ghi nhận cho
  // clickAssignmentAtIndex ở trên). Tìm ĐÚNG index khớp title trong danh sách đọc theo cùng thứ
  // tự DOM rồi bấm theo index - AN TOÀN kể cả khi title trùng nhau, KHÔNG bao giờ dùng index cố
  // định (0) - index ở đây LUÔN suy ra từ chính title cần chọn.
  //
  // ĐÃ GẶP THẬT (2026-08-12, "Review 4"/"Vocabulary"): tên item từ API discovery
  // (teacherAssignmentApiDiscovery.js, field item.name) có thể chứa 2 dấu cách liên tiếp do lỗi
  // gõ trong CMS (vd "...Vocabulary -  Match the word..."), trong khi browser LUÔN collapse nhiều
  // khoảng trắng liên tiếp thành 1 khi render text - node.innerText đọc được ở đây vì vậy luôn có
  // đúng 1 khoảng trắng. So khớp CHÍNH XÁC (===) giữa 2 nguồn này sẽ luôn FAIL dù là CÙNG 1 item
  // thật (không phải khác nội dung, chỉ khác cách hiển thị khoảng trắng) - chuẩn hoá khoảng trắng
  // (collapse + trim) cho CẢ 2 vế trước khi so sánh. Đây KHÔNG phải nới lỏng matcher theo nghĩa
  // rủi ro (không làm tăng khả năng khớp NHẦM sang item khác - 2 item khác nhau thật vẫn khác
  // nhau sau khi chuẩn hoá khoảng trắng), chỉ bỏ qua sai khác thuần hiển thị do chính trình duyệt
  // tạo ra, ngoài tầm kiểm soát của dữ liệu/DOM.
  const matchIndex = availableItems.findIndex(
    (it) => normalizeWhitespace(it.title) === normalizeWhitespace(homeworkItemName),
  );
  if (matchIndex === -1) {
    throw new Error(
      `Không tìm thấy assignment "${homeworkItemName}" trong "Danh sách bài tập" đang hiển thị của Lesson này - BLOCKED, không đoán/không bấm nhầm item khác.`,
    );
  }
  await clickAssignmentAtIndex(page, matchIndex);
  return { homeworkItemName, questionCount: availableItems[matchIndex].questionCount };
}
