/**
 * notificationGiaoBaiFallback.js - mở lại 1 bài tập ĐÃ GIAO qua thông báo "giao bài" BÊN TRONG app
 * (icon chuông, KHÔNG phải Android OS notification shade - khác `androidNotificationShade.js`).
 *
 * TẠI SAO CẦN FILE NÀY: `locateSpecificCompletedCandidate()` (locateCompletedCandidate.js) tìm card
 * "Làm lại" bằng cách cuộn danh sách "Bài tập" - ĐÃ XÁC NHẬN THẬT LIVE (2026-10-19, room
 * `082518c4-f1da-465a-80e2-bc093b305e17`, profile Ngoc/lớp 4D, class có 70-80+ bản ghi): 1 phòng vừa
 * hoàn thành ĐÚNG (point=5/10 xác nhận qua `resolveHomeworkExamQuestionsForRoomId()` gọi thẳng API)
 * có thể KHÔNG BAO GIỜ xuất hiện trong danh sách "Bài tập" - đã loại trừ nguyên nhân scroll/
 * pagination bằng bằng chứng thật (full app relaunch, cả 2 bộ lọc "2 tuần"/"1 tháng", >100 lượt
 * cuộn tự động + thủ công đều KHÔNG thấy). Đây là data-sync bug ở tầng list-aggregation (server/
 * cache), KHÔNG PHẢI lỗi client - KHÔNG thể "fix" bằng cách cuộn nhiều hơn/chờ lâu hơn. File này
 * cung cấp 1 ĐƯỜNG KHÁC để vào lại ĐÚNG bài đó khi list-locate đã cạn kiệt thật (không phải cố che
 * giấu bug, chỉ mở route thay thế để automation tiếp tục được).
 *
 * TẠI SAO DÙNG THÔNG BÁO "GIAO BÀI" (KHÔNG PHẢI thông báo "hoàn thành"): đã thử + xác nhận LIVE
 * (2026-10-19, cùng room) rằng thông báo "hoàn thành" (nhóm 3, xem flows/app/thong_bao/TB-05/
 * TB-07) dẫn tới màn "Xem chi tiết bài làm" (`exercise_show_answer_title`) - nhưng CẢ back-stack
 * (phím back OS) LẪN nút "X" đóng màn đó đều quay THẲNG về màn "Thông báo", KHÔNG BAO GIỜ chạm tới
 * màn "Lịch sử làm bài" (nơi có nút "Làm lại" cố định ở đáy, xem automation/bai_tap/
 * xemchitietbailam.mjs) - route đó là NGÕ CỤT cho mục đích "làm lại". Ngược lại, thông báo "giao
 * bài" GỐC (vẫn còn nguyên trong icon chuông sau khi bài đã hoàn thành - đã verify LIVE, tap được
 * lần 2) mở THẲNG 1 lượt làm MỚI (màn Doing, `exercise_close_button`) cho ĐÚNG room đó - về bản chất
 * tương đương bấm "Làm lại" trên card, chỉ khác điểm vào. Nội dung thông báo "giao bài" LUÔN chứa
 * ĐÚNG tên bài (trong ngoặc kép) + "Hạn nộp: DD/MM/YYYY" (xem flows/app/thong_bao/
 * e2e-teacher-assign-os-notification-shade.mjs#contentMatches(), PORT NGUYÊN VĂN tiêu chí đó ở
 * `assignmentNotificationMatches()` dưới đây) - identity MẠNH HƠN điểm số (điểm có thể trùng giữa
 * nhiều bài, tên bài + hạn nộp thì không, đúng tinh thần "không dùng điểm số làm tiêu chí nhận diện
 * duy nhất"). Thông báo "hoàn thành" NGƯỢC LẠI không hề chứa tên bài (chỉ có tên HS + điểm số, xem
 * flows/app/thong_bao/TEST-CASES.md mục "QUY TẮC NỘI DUNG THÔNG BÁO CHÍNH THỨC" Nhóm 3) nên KHÔNG
 * THỂ dùng làm định danh an toàn dù route của nó có khả thi hay không.
 *
 * KHÔNG dùng `automation/thong_bao/androidNotificationShade.js` (OS-level, yêu cầu app NGOÀI
 * foreground) - ở đây app ĐANG foreground (vừa làm xong lần 1, đang đứng trong app), nên dùng icon
 * chuông NỘI BỘ app (`flows/app/helpers/open-notification.yaml`), lái qua `bridge.runSteps()` giống
 * các flow .mjs khác (vd e2e-giaobai-notification-lambai-strict-range.mjs) đã inline bước tương tự
 * thay vì gọi `.yaml` trực tiếp (JS không import được `.yaml`).
 */

/** Đọc text hiển thị/đọc được của 1 node - THEO ĐÚNG thứ tự ưu tiên đã xác nhận thật khác nhau giữa
 * 2 transport Maestro (CLI "accessibilityText" vs MCP "content-desc") - COPY NGUYÊN pattern đã có ở
 * automation/bai_tap/navigation/homeworkExamEngine.js#collectConnectSlots() (KHÔNG export được từ
 * đó - hàm gốc là nội bộ 1 vòng walk khác hẳn mục đích - nhưng PATTERN đọc field phải giữ NGUYÊN,
 * không tự đặt tên field mới). Thông báo trong icon chuông là 1 ViewGroup clickable có nội dung nằm
 * ở content-desc (xem flows/app/helpers/open-notification.yaml docblock + TEST-CASES.md), không
 * phải `text` thường. */
function readNodeText(node) {
  const attrs = node?.attributes ?? {};
  return (attrs.accessibilityText || attrs["content-desc"] || attrs.text || "").trim();
}

function parseBounds(boundsStr) {
  const m = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(boundsStr ?? "");
  if (!m) return null;
  const [x1, y1, x2, y2] = m.slice(1).map(Number);
  return { x1, y1, x2, y2 };
}

function centerPoint(bounds) {
  return { x: Math.round((bounds.x1 + bounds.x2) / 2), y: Math.round((bounds.y1 + bounds.y2) / 2) };
}

function collectAllTexts(node, acc = []) {
  const t = readNodeText(node);
  if (t) acc.push(t);
  for (const c of node?.children ?? []) collectAllTexts(c, acc);
  return acc;
}

/** COPY NGUYÊN VĂN từ flows/app/thong_bao/e2e-teacher-assign-os-notification-shade.mjs#contentMatches()
 * (bản OS-shade) / flows/app/thong_bao/e2e-giaobai-notification-lambai-strict-range.mjs#contentMatches()
 * (bản đã "COPY NGUYÊN VĂN từ TB-06" lần thứ 2) - tiêu chí identity ĐÃ VERIFY THẬT 2 lần độc lập cho
 * thông báo "giao bài": chứa `"<title>"` (giữ nguyên ngoặc kép, đúng cách app render tên bài trong
 * thông báo) VÀ `Hạn nộp: <DD/MM/YYYY>`. Đặt tên khác (`assignmentNotificationMatches`, không phải
 * `contentMatches` trùng tên 2 bản kia) vì đây là bản EXPORT dùng chung - 2 bản cũ vẫn giữ nguyên
 * (không đụng, ngoài phạm vi task), file nào muốn dùng bản chung này tự import, không bắt buộc. */
export function assignmentNotificationMatches(text, title, dueDateDdMmYyyy) {
  return text.includes(`"${title}"`) && text.includes(`Hạn nộp: ${dueDateDdMmYyyy}`);
}

/** Tìm node thông báo ĐẦU TIÊN (thứ tự đọc cây = thứ tự hiển thị trên màn, mới nhất ở trên - cùng
 * quy ước `index: 0` đã dùng ở flows/app/thong_bao/TB-05-thong-bao-hoan-thanh-bai-tap.yaml) khớp
 * `matchFn`, trả {text, bounds} hoặc `null`. KHÔNG trả về nếu node khớp text nhưng thiếu bounds hợp
 * lệ (an toàn hơn throw - để caller tự quyết định coi như "không tìm thấy"). */
export function findInAppNotificationTapTarget(tree, matchFn) {
  let found = null;
  function walk(node) {
    if (found) return;
    const text = readNodeText(node);
    if (text && matchFn(text)) {
      const bounds = parseBounds(node?.attributes?.bounds);
      if (bounds) {
        found = { text, bounds };
        return;
      }
    }
    for (const child of node?.children ?? []) {
      walk(child);
      if (found) return;
    }
  }
  walk(tree);
  return found;
}

/**
 * Mở lại ĐÚNG 1 bài đã giao (bất kể đã hoàn thành hay chưa) qua thông báo "giao bài" trong icon
 * chuông - app PHẢI đang foreground + đứng ở 1 trong 3 tab dashboard (Vui học/Bài tập/Báo cáo),
 * giống tiền điều kiện của `flows/app/helpers/open-notification.yaml`.
 *
 * KHÔNG tự thử lại/chọn thông báo khác nếu thông báo đầu tiên khớp KHÔNG dẫn đúng màn Doing của
 * ĐÚNG bài (xem bước verify cuối) - trả `ok:false` kèm lý do rõ ràng, để caller tự quyết định
 * (đúng yêu cầu "không click nhầm thông báo của bài khác", không đoán/thử nhiều lần gây rủi ro
 * tap nhầm thêm).
 *
 * @param {import("../bai_tap/discovery/findAssignment.js").AssignmentBridge} bridge
 * @param {{ title: string, dueDateDdMmYyyy: string }} params - `dueDateDdMmYyyy` PHẢI đúng format
 *   "DD/MM/YYYY" xuất hiện nguyên văn trong thông báo (caller đã có sẵn giá trị này từ bước giao bài
 *   - KHÔNG tự suy luận/format lại ở đây).
 * @returns {Promise<
 *   | { ok: true, matchedNotificationText: string }
 *   | { ok: false, reason: string, landedTexts?: string[] }
 * >}
 */
export async function openExerciseViaGiaoBaiNotification(bridge, { title, dueDateDdMmYyyy }) {
  if (!title || !dueDateDdMmYyyy) {
    return { ok: false, reason: "openExerciseViaGiaoBaiNotification() cần cả title lẫn dueDateDdMmYyyy." };
  }

  const openBell = await bridge.runSteps([
    { tapOn: { id: "notification_bell_button" } },
    { extendedWaitUntil: { visible: { text: "Thông báo" }, timeout: 15000 } },
  ]);
  if (!openBell.success) {
    return { ok: false, reason: `Không mở được icon chuông ("Thông báo"): ${openBell.error}` };
  }

  const bellTree = await bridge.hierarchy();
  const target = findInAppNotificationTapTarget(bellTree, (t) => assignmentNotificationMatches(t, title, dueDateDdMmYyyy));
  if (!target) {
    return {
      ok: false,
      reason:
        `Không tìm thấy thông báo "giao bài" khớp title="${title}" + "Hạn nộp: ${dueDateDdMmYyyy}" trong icon chuông ` +
        `(có thể thông báo đã bị đẩy khỏi danh sách bởi thông báo mới hơn, hoặc chưa từng tạo).`,
    };
  }

  const point = centerPoint(target.bounds);
  const tapResult = await bridge.runSteps([
    { tapOn: { point: `${point.x},${point.y}` } },
    { waitForAnimationToEnd: { timeout: 1500 } },
    { runFlow: { when: { visible: "AI hỗ trợ học tập" }, commands: [{ tapOn: "Tiếp tục" }] } },
    { extendedWaitUntil: { visible: { id: "exercise_close_button" }, timeout: 20000 } },
  ]);
  if (!tapResult.success) {
    return { ok: false, reason: `Tap thông báo "giao bài" xong nhưng không vào được màn Doing (exercise_close_button): ${tapResult.error}` };
  }

  // Safety net (tinh thần classifyDestination() của TB-06 + "Safety net" của e2e-giaobai-notification-
  // lambai-strict-range.mjs#[7]): xác nhận ĐÚNG bài vừa giao đang hiển thị, KHÔNG PHẢI bài khác do
  // điều hướng sai/tap nhầm toạ độ lúc danh sách thông báo đang cuộn/render lại.
  const landedTree = await bridge.hierarchy();
  const landedTexts = collectAllTexts(landedTree);
  if (!landedTexts.some((t) => t.includes(title))) {
    return {
      ok: false,
      reason: `Tap thông báo "giao bài" đưa vào màn Doing nhưng KHÔNG thấy title "${title}" trên màn hình - có thể đã mở SAI bài.`,
      landedTexts: landedTexts.slice(0, 15),
    };
  }

  return { ok: true, matchedNotificationText: target.text };
}
