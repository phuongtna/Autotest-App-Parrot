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
 * 1 mảng phẳng. Nếu 1 node không có "children" embedded nhưng type là GROUP (có khả năng
 * còn item con), tự gọi getChildrenOfLessonItem() để lazy-load trước khi tiếp tục đệ quy.
 */
export async function flattenLessonItems(lessonItems) {
  const flat = [];
  for (const item of lessonItems) {
    flat.push(item);
    let children = item.children;
    if (!Array.isArray(children) && item.type === "GROUP") {
      children = await getChildrenOfLessonItem(item);
    }
    if (Array.isArray(children) && children.length > 0) {
      flat.push(...(await flattenLessonItems(children)));
    }
  }
  return flat;
}

/**
 * Lọc trong danh sách Lesson Item (đã flatten) các item có type = EXERCISE (yêu cầu bắt
 * buộc: chỉ random trong các Lesson Item là bài tập, không phải Flashcard/Dẫn nhập/Paragraph...).
 */
export function filterExerciseItems(flattenedLessonItems) {
  return flattenedLessonItems.filter((item) => item.type === EXERCISE_TYPE_VALUE);
}
