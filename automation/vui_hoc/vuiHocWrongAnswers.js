/**
 * Suy ra 1 lựa chọn CHẮC CHẮN SAI (không phải đáp án đúng CMS) cho từng UI type của Vui học -
 * dùng riêng cho bộ test baseline/regression Self-learning (Scenario B "Sai lần 1 -> Đúng lần 2"
 * và Scenario C "Sai lần 1 -> Sai lần 2"). `vuiHocExamEngine.js` (production-path automation)
 * KHÔNG có cơ chế này - nó luôn chọn đáp án ĐÚNG thật từ CMS (xem docblock đầu file đó). File NÀY
 * CHỈ thêm khả năng "chọn sai có chủ đích", KHÔNG đổi bất kỳ hàm nào trong homeworkExamEngine.js/
 * vuiHocSortHandler.js (import thuần, tái sử dụng resolver đáp án ĐÚNG đã có để suy ra 1 phương án
 * SAI khác đáp án đúng).
 *
 * Trả về `null` khi không đủ dữ kiện để suy ra 1 lựa chọn sai AN TOÀN (vd DRAG_DROP 1 ô trống mà
 * CMS answers[] không có distractor nào khác đáp án đúng) - caller phải coi là NOT_VERIFIED, không
 * được đoán đại.
 */
import { decideAnswerAction, resolveConnectCorrectPairs } from "../bai_tap/navigation/homeworkExamEngine.js";
import { resolveSortTargetOrder } from "./vuiHocSortHandler.js";

/** CHOICE - decideAnswerAction() đã có sẵn tham số wantCorrect, tái sử dụng THẲNG (wantCorrect=false). */
export function buildWrongChoiceAction(tree, isVisible, questionModel) {
  return decideAnswerAction(tree, isVisible, questionModel, false);
}

/** FILL_WORD (SINGLE/MULTI) - 1 chuỗi vô nghĩa cố định, chắc chắn khác đáp án đúng CMS. */
export function buildWrongFillWordValues(correctValues) {
  return correctValues.map(() => "zzinvalidzz");
}

/** SORT - hoán đổi 2 phần tử ĐẦU của hoán vị đúng -> chắc chắn SAI thứ tự (khác đáp án đúng ở
 * đúng 1 cặp vị trí) nếu có >=2 đoạn. Trả về null nếu <2 đoạn (không có hoán vị sai nào khác). */
export function buildWrongSortTargetOrder(questionModel) {
  const correct = resolveSortTargetOrder(questionModel);
  if (!correct || correct.length < 2) return null;
  const wrong = [...correct];
  [wrong[0], wrong[1]] = [wrong[1], wrong[0]];
  return wrong;
}

/** DRAG_DROP - nếu >=2 ô trống: hoán đổi 2 giá trị đúng ĐẦU (tap theo thứ tự sai -> ô 0 nhận giá
 * trị của ô 1 và ngược lại). Nếu CHỈ 1 ô trống: cần 1 distractor THẬT từ answers[] CMS (khác đáp
 * án đúng) - trả về null nếu answers[] không có distractor nào (không đoán/bịa từ). */
export function buildWrongDragDropValues(questionModel, correctValues) {
  if (correctValues.length >= 2) {
    const wrong = [...correctValues];
    [wrong[0], wrong[1]] = [wrong[1], wrong[0]];
    return wrong;
  }
  const bank = questionModel?.metadata?.raw?.answers;
  if (!Array.isArray(bank)) return null;
  const distractor = bank.find((a) => typeof a === "string" && a !== correctValues[0]);
  if (!distractor) return null;
  return [distractor];
}

/** CONNECT - xoay vòng rightText giữa các cặp (pair i nhận rightText của pair i+1) -> MỌI cặp đều
 * sai (khác đáp án đúng ở cả 2 phía nối) nếu có >=2 cặp. Trả về null nếu <2 cặp. */
export function buildWrongConnectPairs(questionModel) {
  const correct = resolveConnectCorrectPairs(questionModel);
  if (!correct || correct.length < 2) return null;
  return correct.map((pair, i) => ({
    leftText: pair.leftText,
    rightText: correct[(i + 1) % correct.length].rightText,
  }));
}
