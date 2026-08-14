import { QuestionHandler } from "./questionHandler.js";

function stripHtml(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/**
 * Đọc toàn bộ ô `exercise_connect_left_{i}`/`exercise_connect_right_{i}` đang có trong 1 cây
 * hierarchy (từ `bridge.hierarchy()`), gom theo cột (left/right) kèm text đọc được.
 *
 * QUAN TRỌNG (xác nhận thật 2026-08-14, thiết bị 3201d866d40a1681, bài "G3-U19-L3: Listen and
 * choose"): nội dung KHÔNG nằm ở field "text" (luôn "") mà nằm ở "accessibilityText" - đây là lý
 * do flows/exercise/README.md mục 4 từng kết luận "id chỉ mang vị trí, không mang nội dung" (kết
 * luận đó SAI, chỉ vì chưa ai đọc field accessibilityText - MaestroBridge.isVisible()/
 * _collectTexts() hiện tại CŨNG chỉ đọc "text", không đọc "accessibilityText", nên không phát
 * hiện ra). Node ở đây tự đọc thẳng "attributes.accessibilityText" (fallback "attributes.text")
 * từ cây hierarchy thô, không qua Bridge (đúng tinh thần MaestroBridge.hierarchy() - "caller tự
 * phân tích bằng code thật").
 */
function collectConnectSlots(tree) {
  const slots = { left: [], right: [] };
  function walk(node) {
    const id = node?.attributes?.["resource-id"] || "";
    const match = id.match(/^exercise_connect_(left|right)_(\d+)$/);
    if (match) {
      const side = match[1];
      const index = Number(match[2]);
      const text = (node.attributes.accessibilityText || node.attributes.text || "").trim();
      slots[side].push({ index, text });
    }
    for (const child of node?.children ?? []) walk(child);
  }
  walk(tree);
  return slots;
}

/** Tìm ĐÚNG 1 ô (left hoặc right) có text khớp - throw nếu không thấy (BLOCKED_CONNECT_INTERACTION:
 * thiếu ô) hoặc thấy ≥2 ô cùng text (BLOCKED_CONNECT_INTERACTION: trùng lặp, không xác định được ô
 * đúng - xem yêu cầu "phải kiểm tra collision" thay vì đoán phần tử đầu). */
function resolveSlotIndex(slots, side, text, questionId) {
  const matches = slots[side].filter((s) => s.text === text);
  if (matches.length === 0) {
    throw new Error(
      `BLOCKED_CONNECT_INTERACTION: không tìm thấy ô "${side}" nào có text "${text}" trên màn hình ` +
        `(đã đọc ${slots[side].length} ô ${side} qua accessibilityText). Question ${questionId}.`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `BLOCKED_CONNECT_INTERACTION: text "${text}" trùng lặp ở ${matches.length} ô "${side}" trên ` +
        `màn hình - không xác định được ô đúng, KHÔNG đoán lấy ô đầu tiên. Question ${questionId}.`,
    );
  }
  return matches[0].index;
}

/**
 * Dạng Nối (Matching) - type "CONNECT".
 *
 * ĐÃ XÁC NHẬN THẬT trên thiết bị (2026-08-14, thiết bị 3201d866d40a1681, tài khoản PHONE=${PHONE
 * trong test_data/accounts.env}, profile "Gia Linh", bài "G3-U19-L3: Listen and choose", câu
 * "Listen and match" - 5 cặp Tom/Linda/Peter/Lucy/Ben ↔ skipping/skating/cycling/painting/flying a
 * kite):
 * - Cơ chế thao tác là TAP (không phải drag): tapOn "exercise_connect_left_{i}" rồi tapOn
 *   "exercise_connect_right_{j}" tạo thành 1 cặp - khớp pattern đã verify ở
 *   flows/helpers/solve-connect*.yaml (KHÔNG viết lại cơ chế tap khác).
 * - "exercise_connect_left_{i}"/"exercise_connect_right_{i}" MANG NỘI DUNG THẬT qua
 *   "accessibilityText" (không phải "text") - phát hiện MỚI, sửa lại kết luận cũ trong
 *   flows/exercise/README.md mục 4 ("id chỉ mang vị trí"). Nhờ vậy map được left/right theo NỘI
 *   DUNG (so khớp `stripHtml(answers[].content)` từ CMS với accessibilityText trên màn hình),
 *   KHÔNG giả định index i (đã verify thật: thứ tự hiển thị KHÔNG khớp thứ tự đúng, chỉ 1/5 cặp
 *   trùng vị trí ngẫu nhiên - "Lucy" ở index 3 hiển thị VÀ đúng đều là index 3, còn lại 4 cặp lệch
 *   hẳn).
 * - Chỉ verify được trên biến thể "Bài tập" (ConnectAnswerListV2, enableCheckAnswer=false) - màn
 *   này GIỮ cả cặp sai và KHÔNG render nhãn "Chính xác"/"Chưa chính xác" theo từng cặp (xem
 *   flows/exercise/EX-08-connect-pairs.yaml/EX-19-connect-any-build.yaml) - nút
 *   "Kiểm tra"/"Tiếp tục" chỉ bật khi đã nối KÍN hết ô, không phụ thuộc nối đúng/sai. Vì vậy
 *   execute() không assert "CORRECT"/"INCORRECT" qua bridge.assertAnswerResult() (biến thể này
 *   không có nhãn đó) - "actual" trả về là "REGISTERED" (đã nối xong + đã bấm Kiểm tra) chứ không
 *   phải kết quả chấm điểm; điểm số thật chỉ biết được ở màn kết quả (report/result screen), ngoài
 *   phạm vi handler này.
 * - CHƯA verify biến thể "Vui học" (ConnectAnswerList v1, bỏ cặp sai ngay, có nhãn đúng/sai) - map
 *   theo nội dung ở trên VẪN áp dụng được (cùng testID/accessibilityText), nhưng "actual" trả về
 *   sẽ khác (dùng được assertAnswerResult() ở biến thể đó) - KHÔNG đoán trước, để lần verify sau.
 */
export class MatchingHandler extends QuestionHandler {
  static supports(type) {
    return type === "CONNECT";
  }

  async execute(question) {
    const rawAnswers = question.metadata?.raw?.answers;
    const rawCorrect = question.metadata?.raw?.correct;
    if (!Array.isArray(rawAnswers) || !rawCorrect || typeof rawCorrect !== "object") {
      return { selectedAnswer: null, expected: question.correctAnswer, actual: null, status: "SKIPPED" };
    }

    const answerById = new Map(rawAnswers.map((a) => [a.id, a]));
    const pairs = Object.entries(rawCorrect).map(([leftId, rightId]) => ({
      leftText: stripHtml(answerById.get(leftId)?.content),
      rightText: stripHtml(answerById.get(rightId)?.content),
    }));
    const unresolved = pairs.find((p) => !p.leftText || !p.rightText);
    if (unresolved) {
      throw new Error(
        `MatchingHandler: "correct" trỏ tới answer id không có trong "answers[]" - không resolve ` +
          `được text cho ít nhất 1 cặp. Question ${question.id}.`,
      );
    }

    const tree = this.bridge.hierarchy();
    const slots = collectConnectSlots(tree);

    const tappedPairs = [];
    for (const pair of pairs) {
      const leftIndex = resolveSlotIndex(slots, "left", pair.leftText, question.id);
      const rightIndex = resolveSlotIndex(slots, "right", pair.rightText, question.id);
      await this.bridge.tap({ id: `exercise_connect_left_${leftIndex}` });
      await this.bridge.tap({ id: `exercise_connect_right_${rightIndex}` });
      tappedPairs.push(`${pair.leftText} ↔ ${pair.rightText}`);
    }

    // "Bài tập" (ConnectAnswerListV2) chỉ bật nút Kiểm tra khi đã nối KÍN hết ô - không có nhãn
    // đúng/sai theo cặp (xem docblock trên). Đọc lại hierarchy để xác nhận đã "registered" (nút đã
    // xuất hiện) TRƯỚC khi bấm, thay vì bấm mù rồi mới biết có tác dụng hay không.
    const afterTapTree = this.bridge.hierarchy();
    const checkButtonPresent = (function hasId(node, id) {
      if (node?.attributes?.["resource-id"] === id) return true;
      return (node?.children ?? []).some((c) => hasId(c, id));
    })(afterTapTree, "exercise_check_button");

    if (!checkButtonPresent) {
      return {
        selectedAnswer: tappedPairs.join(", "),
        expected: question.correctAnswer,
        actual: "BLOCKED_CONNECT_INTERACTION",
        status: "FAIL",
      };
    }

    await this.bridge.checkAnswer();
    await this.bridge.nextQuestion();

    return {
      selectedAnswer: tappedPairs.join(", "),
      expected: question.correctAnswer,
      actual: "REGISTERED",
      status: "PASS",
    };
  }
}
