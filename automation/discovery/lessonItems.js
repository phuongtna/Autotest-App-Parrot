import { fetchChildListWithFallback } from "./fetchList.js";
import { getEntityId } from "./entityId.js";
import { callEndpoint } from "./cmsClient.js";

const EXERCISE_TYPE_VALUE = "EXERCISE";

/**
 * Lấy các Lesson Item ở TOP-LEVEL của 1 Lesson (lesson lấy được từ getLessonsOfUnit(),
 * không hardcode). Xác nhận thực tế: đây luôn là các node type "GROUP" (vd "Trạm khởi
 * hành", "Thử thách"), mỗi node có thể kèm sẵn mảng "children" chứa Lesson Item con thật.
 */
export async function getLessonItemsOfLesson(lesson) {
  const lessonId = getEntityId(lesson, ["lessonId"]);
  return fetchChildListWithFallback({
    endpointKey: "lessonItemsOfLesson",
    params: { lessonId },
    parentCollection: "lessons",
    parentId: lessonId,
    childCollection: "items",
  });
}

/**
 * 1 số node GROUP có thể không kèm sẵn "children" (lazy-load) - gọi endpoint riêng để lấy.
 */
export async function getChildrenOfLessonItem(lessonItem) {
  const lessonItemId = getEntityId(lessonItem, ["lessonItemId"]);
  const body = await callEndpoint("childrenOfLessonItem", { lessonItemId });
  return body?.data ?? [];
}

/**
 * Đệ quy toàn bộ cây Lesson Item (top-level + children lồng nhau bất kỳ độ sâu nào) thành
 * 1 mảng phẳng CÁC ENTRY `{ item, groupPath }`, trong đó `groupPath` là mảng CÁC LESSON ITEM
 * TYPE=GROUP tổ tiên của `item` (thứ tự root -> gần nhất, KHÔNG gồm chính `item`, rỗng nếu
 * `item` nằm trực tiếp dưới Lesson) - đây CHÍNH LÀ cách CMS phân biệt "container còn item con"
 * (type=GROUP, có/sẽ-lazy-load "children") với "leaf content" (mọi type khác, vd EXERCISE) -
 * dùng cho NavigationEngine (automation/navigation/navigationEngine.js `groups` param) để biết
 * CHÍNH XÁC cần mở những nhóm lồng nhau nào (vd "Trạm khởi hành 1" > "Thử thách 1"...) trước khi
 * tìm 1 Lesson Item cụ thể trên UI - xem docblock navigateTo() để biết lý do dùng path CMS THẬT
 * thay vì tự dò "expandable" mù trên UI.
 *
 * Nếu 1 node không có "children" embedded nhưng type là GROUP (có khả năng còn item con), tự
 * gọi getChildrenOfLessonItem() để lazy-load trước khi tiếp tục đệ quy.
 * @param {Array<Object>} lessonItems
 * @param {Array<Object>} [ancestorGroups] - CHỈ dùng nội bộ khi tự gọi đệ quy.
 * @returns {Promise<Array<{item: Object, groupPath: Array<Object>}>>}
 */
export async function flattenLessonItemsWithPath(lessonItems, ancestorGroups = []) {
  const flat = [];
  for (const item of lessonItems) {
    flat.push({ item, groupPath: ancestorGroups });
    let children = item.children;
    if (!Array.isArray(children) && item.type === "GROUP") {
      children = await getChildrenOfLessonItem(item);
    }
    if (Array.isArray(children) && children.length > 0) {
      const childAncestors = item.type === "GROUP" ? [...ancestorGroups, item] : ancestorGroups;
      flat.push(...(await flattenLessonItemsWithPath(children, childAncestors)));
    }
  }
  return flat;
}

/**
 * Đệ quy toàn bộ cây Lesson Item thành 1 mảng phẳng CHỈ CÁC ITEM (không kèm groupPath) - giữ
 * NGUYÊN hành vi/chữ ký cũ cho các caller không cần biết vị trí lồng nhau (vd
 * vui_hoc/vuihocQuestionResolver.js, vốn giả định thiết bị đã đứng sẵn đúng câu hỏi, không tự
 * điều hướng) - triển khai lại bằng flattenLessonItemsWithPath() để không lặp code đệ quy.
 */
export async function flattenLessonItems(lessonItems) {
  const entries = await flattenLessonItemsWithPath(lessonItems);
  return entries.map((entry) => entry.item);
}

/**
 * Lọc trong danh sách Lesson Item (đã flatten) các item có type = EXERCISE (yêu cầu bắt
 * buộc: chỉ random trong các Lesson Item là bài tập, không phải Flashcard/Dẫn nhập/Paragraph...).
 */
export function filterExerciseItems(flattenedLessonItems) {
  return flattenedLessonItems.filter((item) => item.type === EXERCISE_TYPE_VALUE);
}

/**
 * Cùng bộ lọc EXERCISE trên nhưng cho mảng entry `{item, groupPath}` của
 * flattenLessonItemsWithPath() - dùng bởi discovery/cli.js#pickExerciseAttempt() để random 1
 * Exercise VÀ biết luôn groupPath thật của nó (thay vì phải tự tìm lại sau khi random).
 */
export function filterExerciseEntries(flattenedEntries) {
  return flattenedEntries.filter((entry) => entry.item.type === EXERCISE_TYPE_VALUE);
}
